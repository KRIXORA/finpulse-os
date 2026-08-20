/* ==========================================================================
   FinPulse-OS — app.js
   Entry point. Guards the page behind auth, boots the router, loads real
   data from the API, and wires state -> render -> DOM events together.

   Only ONE view's markup exists in the DOM at a time (see router.js /
   js/views/*.js), so any listener bound to an element inside a view must
   be delegated from a container that survives navigation (#pageRoot),
   never attached directly to the view's own elements.
   ========================================================================== */

import {
  addTransaction, deleteTransaction, updateTransaction,
  getCategoryBreakdown, getMonthlyBudgetUsage, subscribe,
  exportTransactionsAsCSV, exportFullBackup, initState, isAuthenticated, logout, getCurrentUser,
  getCashFlowSeries, getFinancialHealthScore, getTransactions, getGoals,
  upsertBudget, deleteBudget, addGoal, updateGoal, deleteGoal,
  updateProfile, getInsights, getAllCategoryNames,
  getRecurring, addRecurring, deleteRecurring, advanceDate,
  getAccounts, upsertAccount, deleteAccount, getDebts, upsertDebt, deleteDebt,
  parseTransactionsCSV, importTransactions, getSafeToSpend, seedDemoData, resetAllData, isAccountEmpty,
} from './state.js';
import { renderAll, renderCategoryLegend } from './transactions.js';
import { drawLineChart, drawGauge, drawDonut, drawRing } from './charts.js';
import { showToast, debounce, escapeHTML, registerServiceWorker, initConnectivityBanner } from './utils.js';
import { isSupabaseConfigured } from './config.js';
import { icon } from './icons.js';
import { initRouter, setOnRouteChange } from './router.js';

let currentFilter = 'all';
let cashFlowRange = '1M';
let txPage = 1;
let analyticsScope = 'month'; // 'month' | 'all' — for the Analytics category breakdown

const MAX_TRANSACTION_AMOUNT = 1_00_00_000; // ₹1 crore — sane upper bound against fat-finger entry
const MAX_TITLE_LENGTH = 80;

const pageRoot = document.getElementById('pageRoot');

/** Rebuilds a category <select>'s options from live data + a "custom" option, keeping `keep` selected if present. */
function populateCategorySelect(selectEl, keep, { includeCustomOption = true } = {}) {
  if (!selectEl) return;
  const names = getAllCategoryNames();
  selectEl.innerHTML = names.map((n) => {
    const safe = escapeHTML(n);
    return `<option value="${safe}">${safe}</option>`;
  }).join('')
    + (includeCustomOption ? `<option value="__custom__">+ Add custom category&hellip;</option>` : '');
  selectEl.value = keep && names.includes(keep) ? keep : names[0];
}

/** Wires a select + its adjacent "new category name" field so choosing "__custom__" reveals the input. */
function wireCustomCategoryToggle(selectEl, fieldEl, inputEl) {
  selectEl?.addEventListener('change', () => {
    const isCustom = selectEl.value === '__custom__';
    fieldEl.style.display = isCustom ? 'block' : 'none';
    if (isCustom) inputEl.focus();
  });
}

/** Resolves the category to save: either the select's value, or the trimmed custom input if "__custom__" is chosen. */
function resolveCategory(selectEl, inputEl) {
  if (selectEl.value !== '__custom__') return { category: selectEl.value, error: null };
  const name = inputEl.value.trim().slice(0, 40);
  if (!name) return { category: null, error: 'Please name your new category.' };
  return { category: name, error: null };
}

/** Keeps Tab/Shift+Tab cycling within a modal instead of escaping to the page behind it. */
function enableFocusTrap(modalEl) {
  modalEl?.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusable = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

function renderCharts() {
  drawLineChart(document.getElementById('cashFlowChart'), getCashFlowSeries(cashFlowRange));
  drawGauge(document.getElementById('budgetGauge'), getMonthlyBudgetUsage().percent);
  drawDonut(
    document.getElementById('categoryPieChart'),
    getCategoryBreakdown(analyticsScope).map((c) => ({ label: c.category, value: c.amount }))
  );
  renderCategoryLegend(analyticsScope);
  drawRing(document.getElementById('healthScoreRing'), getFinancialHealthScore().score);
}

function renderUserGreeting() {
  const user = getCurrentUser();
  const heading = document.querySelector('#dashboard .page-section__title');
  const name = user?.user_metadata?.name || user?.name;
  if (heading && name) heading.textContent = `Welcome back, ${name.split(' ')[0]}`;

  const subtitle = document.getElementById('dashboardSubtitle');
  if (subtitle) {
    const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    subtitle.textContent = `Here's your financial overview for ${monthLabel}.`;
  }

  const chip = document.getElementById('dashboardSafeChip');
  if (chip) {
    try {
      const { safe } = getSafeToSpend();
      chip.textContent = `Safe to spend · ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(safe)}`;
    } catch (_) {
      chip.textContent = '';
    }
  }
}

/** Re-applies the in-memory filter/range selection to whichever view just mounted. */
function syncActiveTabs() {
  const cashFlowTabGroup = document.getElementById('cashFlowChart')?.closest('.card')?.querySelector('.tab-group');
  cashFlowTabGroup?.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('is-active', t.textContent.trim() === cashFlowRange);
  });

  const recentTxTabGroup = document.getElementById('recentTransactionsBody')?.closest('.card')?.querySelector('.tab-group');
  recentTxTabGroup?.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('is-active', t.textContent.trim().toLowerCase() === currentFilter);
  });

  document.getElementById('txFilterTabs')?.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('is-active', t.textContent.trim().toLowerCase() === currentFilter);
  });

  const analyticsTabGroup = document.getElementById('analyticsScopeTabs');
  analyticsTabGroup?.querySelectorAll('.tab').forEach((t) => {
    const isMonth = t.textContent.trim() === 'This Month';
    t.classList.toggle('is-active', (analyticsScope === 'month') === isMonth);
  });
}

function renderEverything() {
  txPage = renderAll(currentFilter, txPage);
  renderCharts();
  renderUserGreeting();
  syncActiveTabs();
  applySearchFilter(); // re-apply any active search after a full re-render
  updateNotifBadge();
}

subscribe(renderEverything);
// Whenever the router swaps in a new view, repopulate it with live data.
setOnRouteChange(renderEverything);

// ---------- Loading overlay ----------
function hideLoader() {
  const loader = document.getElementById('appLoader');
  loader?.classList.add('is-hidden');
  setTimeout(() => loader?.remove(), 300);
}

// ---------- Initial data load ----------

// ---------- Theme (dark / light) ----------
function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}
function applyTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('finpulse-theme', next); } catch (_) {}
  const sun = document.getElementById('themeIconSun');
  const moon = document.getElementById('themeIconMoon');
  if (sun && moon) {
    sun.style.display = next === 'light' ? 'none' : 'block';
    moon.style.display = next === 'light' ? 'block' : 'none';
  }
  // Redraw charts so canvas colors stay readable
  try { renderCharts(); } catch (_) {}
}
applyTheme(getTheme());
document.getElementById('themeToggle')?.addEventListener('click', () => {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
});

// ---------- Help / How to use ----------
const helpModal = document.getElementById('helpModal');
enableFocusTrap(helpModal);
function openHelp() {
  if (!helpModal) return;
  helpModal.style.display = 'flex';
  try { localStorage.setItem('finpulse-help-seen', '1'); } catch (_) {}
}
function closeHelp() {
  if (helpModal) helpModal.style.display = 'none';
}
document.getElementById('helpBtn')?.addEventListener('click', openHelp);
document.getElementById('closeHelpModalBtn')?.addEventListener('click', closeHelp);
document.getElementById('closeHelpModalBtn2')?.addEventListener('click', closeHelp);
helpModal?.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && helpModal?.style.display === 'flex') closeHelp();
  // ? opens help when not typing
  if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName || '')) {
    e.preventDefault();
    openHelp();
  }
});

async function boot() {
  registerServiceWorker();
  initConnectivityBanner();

  if (!isSupabaseConfigured()) {
    hideLoader();
    showToast('Supabase is not configured. Open js/config.js and add your Project URL + anon key.', 'error', 8000);
    return;
  }

  const authed = await isAuthenticated();
  if (!authed) {
    window.location.href = 'auth.html';
    return;
  }

  try {
    const { autoPostedCount } = await initState();

    // First visit: auto-load sample data so the product is never an empty shell
    let seeded = false;
    if (isAccountEmpty()) {
      try {
        await seedDemoData({ force: true });
        seeded = true;
        try { localStorage.setItem('finpulse-demo-seeded', '1'); } catch (_) {}
      } catch (seedErr) {
        console.warn('Auto sample data skipped:', seedErr.message);
      }
    }

    initRouter(); // mounts the initial view and renders it via setOnRouteChange -> renderEverything
    hideLoader();

    if (seeded) {
      showToast('Welcome — sample data is loaded so you can explore every feature. Replace it anytime from Settings.', 'info', 6000);
      // Soft-open how-to once for brand-new sessions
      try {
        if (!localStorage.getItem('finpulse-help-seen')) {
          setTimeout(() => document.getElementById('helpBtn')?.click(), 800);
        }
      } catch (_) {}
    } else if (autoPostedCount > 0) {
      showToast(
        `Added ${autoPostedCount} recurring transaction${autoPostedCount > 1 ? 's' : ''} that came due since your last visit.`,
        'info', 5000
      );
    }
  } catch (err) {
    console.error(err);
    hideLoader();
    showToast(err.message || 'Something went wrong while loading your data.', 'error', 4000);
    setTimeout(async () => {
      await logout();
      window.location.href = 'auth.html';
    }, 1500);
  }
}
boot();

// ---------- Mobile sidebar toggle ----------
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const menuToggle = document.getElementById('menuToggle');

function openSidebar() {
  sidebar.classList.add('is-open');
  sidebarBackdrop.classList.add('is-visible');
  document.body.classList.add('sidebar-locked');
}
function closeSidebar() {
  sidebar.classList.remove('is-open');
  sidebarBackdrop.classList.remove('is-visible');
  document.body.classList.remove('sidebar-locked');
}

menuToggle?.addEventListener('click', openSidebar);
sidebarBackdrop?.addEventListener('click', closeSidebar);

// Sidebar nav links live outside #pageRoot and are never re-rendered, so a
// direct binding is fine here. Active-state highlighting itself is handled
// by router.js on every navigation.
document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', closeSidebar);
});

// ---------- Add Transaction modal ----------
// The modal lives outside #pageRoot too (index.html), so it's safe to bind directly.
const transactionModal = document.getElementById('transactionModal');
const transactionModalTitle = document.getElementById('transactionModalTitle');
enableFocusTrap(transactionModal);
const addTransactionBtn = document.getElementById('addTransactionBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const modalTabGroup = transactionModal?.querySelector('.tab-group');
const saveRecordBtn = document.getElementById('saveRecordBtn');
const txCategorySelect = document.getElementById('txCategorySelect');
const txCustomCategoryField = document.getElementById('txCustomCategoryField');
const txCustomCategoryInput = document.getElementById('txCustomCategoryInput');
wireCustomCategoryToggle(txCategorySelect, txCustomCategoryField, txCustomCategoryInput);

const txRecurringField = document.getElementById('txRecurringField');
const txRecurringCheckbox = document.getElementById('txRecurringCheckbox');
const txFrequencyField = document.getElementById('txFrequencyField');
const txFrequencySelect = document.getElementById('txFrequencySelect');
txRecurringCheckbox?.addEventListener('change', () => {
  txFrequencyField.style.display = txRecurringCheckbox.checked ? 'block' : 'none';
});

let lastFocusedEl = null;
let editingTransactionId = null;

/** Pass a transaction to edit it; omit to open in "add new" mode. */
function openModal(tx = null) {
  lastFocusedEl = document.activeElement;
  editingTransactionId = tx?.id || null;
  transactionModal.style.display = 'flex';

  const [titleInput, amountInput] = transactionModal.querySelectorAll('.input[type="text"], .input[type="number"]');
  const dateInput = transactionModal.querySelector('.input[type="date"]');
  const today = new Date().toISOString().slice(0, 10);
  dateInput.max = today;

  populateCategorySelect(txCategorySelect, tx?.category);
  txCustomCategoryField.style.display = 'none';
  txCustomCategoryInput.value = '';
  txRecurringCheckbox.checked = false;
  txFrequencyField.style.display = 'none';
  txFrequencySelect.value = 'monthly';
  // Recurring only makes sense when creating a fresh entry, not while editing one.
  txRecurringField.style.display = tx ? 'none' : 'block';

  if (tx) {
    transactionModalTitle.textContent = 'Edit Transaction';
    saveRecordBtn.textContent = 'Update Record';
    titleInput.value = tx.title;
    amountInput.value = tx.amount;
    dateInput.value = tx.date;
    const notesInput = document.getElementById('txNotesInput');
    if (notesInput) notesInput.value = tx.notes || '';
    modalTabGroup.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('is-active', t.textContent.trim().toLowerCase() === tx.type);
    });
  } else {
    transactionModalTitle.textContent = 'Add Transaction';
    saveRecordBtn.textContent = 'Save Record';
    if (!dateInput.value) dateInput.value = today;
  }

  titleInput.focus();
}

function closeModal() {
  transactionModal.style.display = 'none';
  transactionModal.querySelectorAll('.input').forEach((el) => (el.value = ''));
  const notesInput = document.getElementById('txNotesInput');
  if (notesInput) notesInput.value = '';
  txCustomCategoryField.style.display = 'none';
  txRecurringCheckbox.checked = false;
  txFrequencyField.style.display = 'none';
  modalTabGroup?.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('is-active', i === 0));
  editingTransactionId = null;
  lastFocusedEl?.focus();
}

addTransactionBtn?.addEventListener('click', () => openModal());
closeModalBtn?.addEventListener('click', closeModal);
cancelModalBtn?.addEventListener('click', closeModal);
transactionModal?.addEventListener('click', (e) => { if (e.target === transactionModal) closeModal(); });

// Accessibility: Escape closes whichever modal/panel is open.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (transactionModal.style.display === 'flex') closeModal();
  if (budgetModal?.style.display === 'flex') closeBudgetModal();
  if (goalModal?.style.display === 'flex') closeGoalModal();
});
transactionModal?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName !== 'SELECT') {
    e.preventDefault();
    saveRecordBtn?.click();
  }
});

modalTabGroup?.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    modalTabGroup.querySelectorAll('.tab').forEach((t) => t.classList.remove('is-active'));
    tab.classList.add('is-active');
  });
});

saveRecordBtn?.addEventListener('click', async () => {
  const type = modalTabGroup.querySelector('.tab.is-active').textContent.trim().toLowerCase();
  const [titleInput, amountInput] = transactionModal.querySelectorAll('.input[type="text"], .input[type="number"]');
  const dateInput = transactionModal.querySelector('.input[type="date"]');

  const title = titleInput.value.trim().slice(0, MAX_TITLE_LENGTH);
  const amount = Number(amountInput.value);
  const { category, error: categoryError } = resolveCategory(txCategorySelect, txCustomCategoryInput);
  const date = dateInput.value || new Date().toISOString().slice(0, 10);

  if (!title) {
    showToast('Please enter a title for this transaction.', 'error');
    titleInput.focus();
    return;
  }
  if (categoryError) {
    showToast(categoryError, 'error');
    txCustomCategoryInput.focus();
    return;
  }
  if (!amount || amount <= 0 || !Number.isFinite(amount)) {
    showToast('Please enter a valid amount greater than zero.', 'error');
    amountInput.focus();
    return;
  }
  if (amount > MAX_TRANSACTION_AMOUNT) {
    showToast('That amount looks too large. Please double-check it.', 'error');
    amountInput.focus();
    return;
  }
  if (new Date(date) > new Date(new Date().toDateString())) {
    showToast('Transaction date cannot be in the future.', 'error');
    dateInput.focus();
    return;
  }

  const isEditing = Boolean(editingTransactionId);
  saveRecordBtn.disabled = true;
  saveRecordBtn.textContent = isEditing ? 'Updating…' : 'Saving…';
  try {
    const notes = document.getElementById('txNotesInput')?.value.trim().slice(0, 200) || '';
    if (isEditing) {
      await updateTransaction(editingTransactionId, { type, title, amount, category, date, notes });
      showToast('Transaction updated.', 'success');
    } else {
      await addTransaction({ type, title, amount, category, date, notes });
      if (txRecurringCheckbox.checked) {
        const frequency = txFrequencySelect.value;
        await addRecurring({ title, category, type, amount, frequency, nextRunDate: advanceDate(date, frequency) });
        showToast(`Transaction added — it'll repeat ${frequency}.`, 'success');
      } else {
        showToast('Transaction added.', 'success');
      }
    }
    closeModal();
  } catch (err) {
    showToast(err.message || 'Could not save transaction. Please try again.', 'error');
  } finally {
    saveRecordBtn.disabled = false;
    saveRecordBtn.textContent = isEditing ? 'Update Record' : 'Save Record';
  }
});

// ---------- View-scoped interactions (delegated from #pageRoot, which survives navigation) ----------

// Toolbar buttons that open modals or reset view-local state.
pageRoot?.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="add-transaction"]')) {
    openModal();
    return;
  }
  if (e.target.closest('[data-action="reset-filters"]')) {
    currentFilter = 'all';
    txPage = 1;
    const desk = document.getElementById('desktopSearchInput');
    const mob = document.getElementById('mobileSearchInput');
    if (desk) desk.value = '';
    if (mob) mob.value = '';
    renderEverything();
    return;
  }
  if (e.target.closest('[data-action="tx-prev-page"]')) {
    txPage = Math.max(1, txPage - 1);
    txPage = renderAll(currentFilter, txPage);
    applySearchFilter();
    return;
  }
  if (e.target.closest('[data-action="tx-next-page"]')) {
    txPage += 1;
    txPage = renderAll(currentFilter, txPage);
    applySearchFilter();
    return;
  }
  if (e.target.closest('[data-action="add-budget"]')) {
    openBudgetModal();
    return;
  }
  if (e.target.closest('[data-action="add-goal"]')) {
    openGoalModal();
  }
});

// Filter / range tabs (Recent Transactions: All/Income/Expense, Cash Flow: 1M/3M/1Y).
pageRoot?.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab-group .tab');
  if (!tab) return;

  const group = tab.parentElement;
  group.querySelectorAll('.tab').forEach((t) => t.classList.remove('is-active'));
  tab.classList.add('is-active');

  const label = tab.textContent.trim();
  const lower = label.toLowerCase();
  if (['all', 'income', 'expense'].includes(lower)) {
    currentFilter = lower;
    txPage = 1;
    renderEverything();
  } else if (['1M', '3M', '1Y'].includes(label)) {
    cashFlowRange = label;
    renderCharts();
  } else if (['This Month', 'All Time'].includes(label)) {
    analyticsScope = label === 'This Month' ? 'month' : 'all';
    renderCharts();
  }
});

// Delete / edit delegation for the full transactions table.
pageRoot?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn || !['delete', 'edit'].includes(btn.dataset.action)) return;
  const row = btn.closest('tr');
  const id = row?.dataset.id;
  if (!id) return;

  if (btn.dataset.action === 'edit') {
    const tx = getTransactions({ filter: 'all' }).find((t) => t.id === id);
    if (tx) openModal(tx);
    return;
  }

  if (btn.dataset.action === 'delete') {
    if (confirm('Delete this transaction? This cannot be undone.')) {
      const originalLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = '…';
      try {
        await deleteTransaction(id);
        showToast('Transaction deleted.', 'success');
      } catch (err) {
        showToast(err.message || 'Could not delete transaction.', 'error');
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    }
  }
});

// Budget card actions (Edit / Delete) — delegated since #budgetGrid is only in the DOM when active.
pageRoot?.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-action="edit-budget"]');
  if (editBtn) {
    openBudgetModal({ category: editBtn.dataset.category, limit: editBtn.dataset.limit });
    return;
  }

  const deleteBtn = e.target.closest('[data-action="delete-budget"]');
  if (deleteBtn) {
    if (confirm(`Remove the budget limit for "${deleteBtn.dataset.category}"?`)) {
      try {
        await deleteBudget(deleteBtn.dataset.category);
        showToast('Budget limit removed.', 'success');
      } catch (err) {
        showToast(err.message || 'Could not remove budget.', 'error');
      }
    }
  }
});

// Recurring transaction removal (Settings page).
pageRoot?.addEventListener('click', async (e) => {
  const deleteBtn = e.target.closest('[data-action="delete-recurring"]');
  if (!deleteBtn) return;
  if (confirm('Stop this recurring transaction? Past entries it already created will stay.')) {
    try {
      await deleteRecurring(deleteBtn.dataset.id);
      showToast('Recurring transaction removed.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not remove recurring transaction.', 'error');
    }
  }
});

// Goal card actions (Edit / Delete) — delegated since #goalsGrid is only in the DOM when active.
pageRoot?.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-action="edit-goal"]');
  if (editBtn) {
    const goal = getGoals().find((g) => g.id === editBtn.dataset.id);
    if (goal) openGoalModal(goal);
    return;
  }

  const deleteBtn = e.target.closest('[data-action="delete-goal"]');
  if (deleteBtn) {
    if (confirm('Delete this savings goal? This cannot be undone.')) {
      try {
        await deleteGoal(deleteBtn.dataset.id);
        showToast('Goal deleted.', 'success');
      } catch (err) {
        showToast(err.message || 'Could not delete goal.', 'error');
      }
    }
  }
});

// ---------- Set Budget Limit modal ----------
const budgetModal = document.getElementById('budgetModal');
const budgetModalTitle = document.getElementById('budgetModalTitle');
enableFocusTrap(budgetModal);
const budgetCategoryInput = document.getElementById('budgetCategoryInput');
const budgetLimitInput = document.getElementById('budgetLimitInput');
const saveBudgetBtn = document.getElementById('saveBudgetBtn');
const budgetCustomCategoryField = document.getElementById('budgetCustomCategoryField');
const budgetCustomCategoryInput = document.getElementById('budgetCustomCategoryInput');
wireCustomCategoryToggle(budgetCategoryInput, budgetCustomCategoryField, budgetCustomCategoryInput);
let editingBudgetCategory = null;

function openBudgetModal(existing = null) {
  editingBudgetCategory = existing?.category || null;
  budgetModalTitle.textContent = existing ? 'Edit Budget Limit' : 'Set Budget Limit';
  populateCategorySelect(budgetCategoryInput, existing?.category, { includeCustomOption: !existing });
  budgetCategoryInput.disabled = Boolean(existing); // category is the unique key — lock it on edit
  budgetCustomCategoryField.style.display = 'none';
  budgetCustomCategoryInput.value = '';
  budgetLimitInput.value = existing?.limit ?? '';
  budgetModal.style.display = 'flex';
  budgetLimitInput.focus();
}

function closeBudgetModal() {
  budgetModal.style.display = 'none';
  budgetCategoryInput.disabled = false;
  budgetCustomCategoryField.style.display = 'none';
  budgetCustomCategoryInput.value = '';
  editingBudgetCategory = null;
}

document.getElementById('closeBudgetModalBtn')?.addEventListener('click', closeBudgetModal);
document.getElementById('cancelBudgetModalBtn')?.addEventListener('click', closeBudgetModal);
budgetModal?.addEventListener('click', (e) => { if (e.target === budgetModal) closeBudgetModal(); });

saveBudgetBtn?.addEventListener('click', async () => {
  const { category, error: categoryError } = resolveCategory(budgetCategoryInput, budgetCustomCategoryInput);
  const limit = Number(budgetLimitInput.value);

  if (categoryError) {
    showToast(categoryError, 'error');
    budgetCustomCategoryInput.focus();
    return;
  }
  if (!limit || limit <= 0 || !Number.isFinite(limit)) {
    showToast('Please enter a valid limit greater than zero.', 'error');
    budgetLimitInput.focus();
    return;
  }

  saveBudgetBtn.disabled = true;
  saveBudgetBtn.textContent = 'Saving…';
  try {
    await upsertBudget(category, limit);
    showToast('Budget limit saved.', 'success');
    closeBudgetModal();
  } catch (err) {
    showToast(err.message || 'Could not save budget limit.', 'error');
  } finally {
    saveBudgetBtn.disabled = false;
    saveBudgetBtn.textContent = 'Save Limit';
  }
});

// ---------- Savings Goal modal ----------
const goalModal = document.getElementById('goalModal');
const goalModalTitle = document.getElementById('goalModalTitle');
enableFocusTrap(goalModal);
const goalNameInput = document.getElementById('goalNameInput');
const goalTargetInput = document.getElementById('goalTargetInput');
const goalSavedInput = document.getElementById('goalSavedInput');
const goalDeadlineInput = document.getElementById('goalDeadlineInput');
const saveGoalBtn = document.getElementById('saveGoalBtn');
let editingGoalId = null;

function openGoalModal(existing = null) {
  editingGoalId = existing?.id || null;
  goalModalTitle.textContent = existing ? 'Edit Savings Goal' : 'New Savings Goal';
  goalNameInput.value = existing?.name || '';
  goalTargetInput.value = existing?.target ?? '';
  goalSavedInput.value = existing?.saved ?? 0;
  goalDeadlineInput.value = existing?.deadline || '';
  goalModal.style.display = 'flex';
  goalNameInput.focus();
}

function closeGoalModal() {
  goalModal.style.display = 'none';
  editingGoalId = null;
}

document.getElementById('closeGoalModalBtn')?.addEventListener('click', closeGoalModal);
document.getElementById('cancelGoalModalBtn')?.addEventListener('click', closeGoalModal);
goalModal?.addEventListener('click', (e) => { if (e.target === goalModal) closeGoalModal(); });

saveGoalBtn?.addEventListener('click', async () => {
  const name = goalNameInput.value.trim().slice(0, 80);
  const target = Number(goalTargetInput.value);
  const saved = Number(goalSavedInput.value || 0);
  const deadline = goalDeadlineInput.value || null;

  if (!name) {
    showToast('Please name this goal.', 'error');
    goalNameInput.focus();
    return;
  }
  if (!target || target <= 0 || !Number.isFinite(target)) {
    showToast('Please enter a valid target amount.', 'error');
    goalTargetInput.focus();
    return;
  }
  if (saved < 0 || !Number.isFinite(saved)) {
    showToast('Amount already saved can\u2019t be negative.', 'error');
    goalSavedInput.focus();
    return;
  }

  const isEditing = Boolean(editingGoalId);
  saveGoalBtn.disabled = true;
  saveGoalBtn.textContent = isEditing ? 'Updating…' : 'Saving…';
  try {
    if (isEditing) {
      await updateGoal(editingGoalId, { name, target, saved, deadline });
      showToast('Goal updated.', 'success');
    } else {
      await addGoal({ name, target, saved, deadline });
      showToast('Goal created.', 'success');
    }
    closeGoalModal();
  } catch (err) {
    showToast(err.message || 'Could not save goal.', 'error');
  } finally {
    saveGoalBtn.disabled = false;
    saveGoalBtn.textContent = 'Save Goal';
  }
});

// ---------- Notifications ----------
const notifBtn = document.getElementById('notifBtn');
const notifPanel = document.getElementById('notifPanel');
const notifBadge = document.getElementById('notifBadge');

function updateNotifBadge() {
  if (!notifBadge) return;
  notifBadge.style.display = getInsights().length ? 'block' : 'none';
}

function renderNotifPanel() {
  const insights = getInsights();
  const header = `<div class="notif-panel__header"><span>Insights</span><span style="font-size:var(--text-xs);color:var(--color-text-muted)">${insights.length} active</span></div>`;
  notifPanel.innerHTML = header + (insights.length
    ? insights.map((ins) => `
      <div class="notif-item">
        <span class="notif-item__icon">${icon(ins.icon, 18)}</span>
        <div>
          <span class="notif-item__title">${escapeHTML(ins.title)}</span>
          <p class="notif-item__message">${escapeHTML(ins.message)}</p>
        </div>
      </div>`).join('')
    : `<div class="notif-empty">You're all caught up — no budget alerts right now.</div>`);
}

function toggleNotifPanel(show) {
  const isOpen = show ?? notifPanel.style.display === 'none';
  notifPanel.style.display = isOpen ? 'block' : 'none';
  notifBtn.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) renderNotifPanel();
}

notifBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleNotifPanel();
});
document.addEventListener('click', (e) => {
  if (notifPanel?.style.display === 'block' && !e.target.closest('#notifWrap')) {
    toggleNotifPanel(false);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && notifPanel?.style.display === 'block') toggleNotifPanel(false);
});

// ---------- Settings: Save Changes ----------
pageRoot?.addEventListener('click', async (e) => {
  if (!e.target.closest('#saveProfileBtn')) return;
  const btn = e.target.closest('#saveProfileBtn');
  const name = document.getElementById('settingsNameInput')?.value.trim();
  const email = document.getElementById('settingsEmailInput')?.value.trim();

  if (!name) {
    showToast('Please enter your name.', 'error');
    return;
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }

  const emailChanged = email !== getCurrentUser()?.email;
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await updateProfile({ name, email });
    showToast(emailChanged ? 'Saved. Check your new email to confirm the change.' : 'Profile updated.', 'success');
  } catch (err) {
    showToast(err.message || 'Could not update profile.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
});

// Track manual edits so a background re-render doesn't overwrite what the user is typing.
pageRoot?.addEventListener('input', (e) => {
  if (e.target.matches('#settingsNameInput, #settingsEmailInput')) {
    e.target.dataset.touched = '1';
  }
});
pageRoot?.addEventListener('click', async (e) => {
  if (e.target.closest('[data-action="export-csv"]')) {
    try {
      const csv = exportTransactionsAsCSV();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'finpulse-transactions.csv';
      a.click();
      URL.revokeObjectURL(url);
      showToast('CSV export started.', 'success');
    } catch (err) {
      showToast('Could not export CSV.', 'error');
    }
    return;
  }

  if (e.target.closest('[data-action="export-json"]')) {
    try {
      const json = exportFullBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finpulse-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Full backup downloaded.', 'success');
    } catch (err) {
      showToast('Could not export backup.', 'error');
    }
    return;
  }

  if (e.target.closest('#logoutBtn')) {
    if (confirm('Sign out of FinPulse-OS?')) {
      try {
        await logout();
        window.location.href = 'auth.html';
      } catch (err) {
        showToast('Could not sign out. Please try again.', 'error');
      }
    }
  }
});




// ---------- Data: sample / reset ----------
function setDataStatus(msg, type = '') {
  const el = document.getElementById('dataActionStatus');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.remove('is-success', 'is-error');
  if (type) el.classList.add(type === 'success' ? 'is-success' : 'is-error');
}

pageRoot?.addEventListener('click', async (e) => {
  const loadBtn = e.target.closest('[data-action="load-demo"]');
  const resetDemoBtn = e.target.closest('[data-action="reset-and-demo"]');
  const resetBtn = e.target.closest('[data-action="reset-all"]');
  if (!loadBtn && !resetDemoBtn && !resetBtn) return;

  if (loadBtn) {
    if (!confirm('Load sample data?\n\nAdds example salary, expenses, budgets, goals, accounts and debts.\nOnly works if your account is empty.')) return;
    loadBtn.disabled = true;
    const label = loadBtn.textContent;
    loadBtn.textContent = 'Loading…';
    setDataStatus('Loading sample data…');
    try {
      const result = await seedDemoData();
      const msg = `Sample ready — ${result.transactions} transactions, ${result.budgets} budgets, ${result.goals} goals. Explore Dashboard, then edit or delete anything.`;
      setDataStatus(msg, 'success');
      showToast(msg, 'success', 5000);
    } catch (err) {
      setDataStatus(err.message || 'Could not load sample data.', 'error');
      showToast(err.message || 'Could not load sample data.', 'error');
    } finally {
      loadBtn.disabled = false;
      loadBtn.textContent = label;
    }
    return;
  }

  if (resetDemoBtn) {
    if (!confirm('Reset everything and load sample data?\n\nThis DELETES all your transactions, budgets, goals, accounts and debts, then fills the account with demo numbers.\n\nThis cannot be undone.')) return;
    if (!confirm('Final check: delete all current data and replace with sample data?')) return;
    resetDemoBtn.disabled = true;
    const label = resetDemoBtn.textContent;
    resetDemoBtn.textContent = 'Resetting…';
    setDataStatus('Clearing your data and loading sample…');
    try {
      const result = await resetAllData({ loadDemo: true });
      const msg = `Fresh start with sample data — ${result.transactions} transactions loaded. Change anything you like.`;
      setDataStatus(msg, 'success');
      showToast(msg, 'success', 5000);
    } catch (err) {
      setDataStatus(err.message || 'Reset failed.', 'error');
      showToast(err.message || 'Reset failed.', 'error');
    } finally {
      resetDemoBtn.disabled = false;
      resetDemoBtn.textContent = label;
    }
    return;
  }

  if (resetBtn) {
    if (!confirm('Reset ALL data?\n\nDeletes every transaction, budget, goal, account, debt and recurring rule.\nYour login stays the same.\n\nThis cannot be undone.')) return;
    if (!confirm('Really wipe this account clean? Type-level confirm: OK to delete everything.')) return;
    resetBtn.disabled = true;
    const label = resetBtn.textContent;
    resetBtn.textContent = 'Resetting…';
    setDataStatus('Deleting all data…');
    try {
      await resetAllData({ loadDemo: false });
      const msg = 'All data cleared. Add your own transactions, or tap “Load sample data”.';
      setDataStatus(msg, 'success');
      showToast(msg, 'success', 5000);
    } catch (err) {
      setDataStatus(err.message || 'Reset failed.', 'error');
      showToast(err.message || 'Reset failed.', 'error');
    } finally {
      resetBtn.disabled = false;
      resetBtn.textContent = label;
    }
  }
});

// ---------- Account modal ----------
const accountModal = document.getElementById('accountModal');
enableFocusTrap(accountModal);
let editingAccountId = null;

function openAccountModal(existing = null) {
  editingAccountId = existing?.id || null;
  document.getElementById('accountModalTitle').textContent = existing ? 'Edit Account' : 'Add Account';
  document.getElementById('accountNameInput').value = existing?.name || '';
  document.getElementById('accountKindSelect').value = existing?.kind || 'asset';
  document.getElementById('accountBalanceInput').value = existing?.balance ?? '';
  accountModal.style.display = 'flex';
  document.getElementById('accountNameInput').focus();
}
function closeAccountModal() {
  accountModal.style.display = 'none';
  editingAccountId = null;
}
document.getElementById('closeAccountModalBtn')?.addEventListener('click', closeAccountModal);
document.getElementById('cancelAccountModalBtn')?.addEventListener('click', closeAccountModal);
accountModal?.addEventListener('click', (e) => { if (e.target === accountModal) closeAccountModal(); });
document.getElementById('saveAccountBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('accountNameInput').value.trim();
  const kind = document.getElementById('accountKindSelect').value;
  const balance = Number(document.getElementById('accountBalanceInput').value);
  if (!name) { showToast('Please name this account.', 'error'); return; }
  if (!Number.isFinite(balance)) { showToast('Enter a valid balance.', 'error'); return; }
  try {
    await upsertAccount({ id: editingAccountId, name, kind, balance });
    showToast('Account saved.', 'success');
    closeAccountModal();
  } catch (err) {
    showToast(err.message || 'Could not save account.', 'error');
  }
});

// ---------- Debt modal ----------
const debtModal = document.getElementById('debtModal');
enableFocusTrap(debtModal);
let editingDebtId = null;

function openDebtModal(existing = null) {
  editingDebtId = existing?.id || null;
  document.getElementById('debtModalTitle').textContent = existing ? 'Edit Debt' : 'Add Debt';
  document.getElementById('debtNameInput').value = existing?.name || '';
  document.getElementById('debtBalanceInput').value = existing?.balance ?? '';
  document.getElementById('debtRateInput').value = existing?.interestRate ?? 0;
  document.getElementById('debtMinInput').value = existing?.minPayment ?? 0;
  debtModal.style.display = 'flex';
  document.getElementById('debtNameInput').focus();
}
function closeDebtModal() {
  debtModal.style.display = 'none';
  editingDebtId = null;
}
document.getElementById('closeDebtModalBtn')?.addEventListener('click', closeDebtModal);
document.getElementById('cancelDebtModalBtn')?.addEventListener('click', closeDebtModal);
debtModal?.addEventListener('click', (e) => { if (e.target === debtModal) closeDebtModal(); });
document.getElementById('saveDebtBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('debtNameInput').value.trim();
  const balance = Number(document.getElementById('debtBalanceInput').value);
  const interestRate = Number(document.getElementById('debtRateInput').value);
  const minPayment = Number(document.getElementById('debtMinInput').value);
  if (!name) { showToast('Please name this debt.', 'error'); return; }
  if (!Number.isFinite(balance) || balance < 0) { showToast('Enter a valid balance.', 'error'); return; }
  try {
    await upsertDebt({ id: editingDebtId, name, balance, interestRate, minPayment });
    showToast('Debt saved.', 'success');
    closeDebtModal();
  } catch (err) {
    showToast(err.message || 'Could not save debt.', 'error');
  }
});

// Net worth page actions
pageRoot?.addEventListener('click', async (e) => {
  if (e.target.closest('[data-action="add-account"]')) { openAccountModal(); return; }
  if (e.target.closest('[data-action="add-debt"]')) { openDebtModal(); return; }

  const editAcc = e.target.closest('[data-action="edit-account"]');
  if (editAcc) {
    const acc = getAccounts().find((a) => a.id === editAcc.dataset.id);
    if (acc) openAccountModal(acc);
    return;
  }
  const delAcc = e.target.closest('[data-action="delete-account"]');
  if (delAcc) {
    if (confirm('Delete this account?')) {
      try { await deleteAccount(delAcc.dataset.id); showToast('Account deleted.', 'success'); }
      catch (err) { showToast(err.message || 'Could not delete.', 'error'); }
    }
    return;
  }
  const editDebt = e.target.closest('[data-action="edit-debt"]');
  if (editDebt) {
    const d = getDebts().find((x) => x.id === editDebt.dataset.id);
    if (d) openDebtModal(d);
    return;
  }
  const delDebt = e.target.closest('[data-action="delete-debt"]');
  if (delDebt) {
    if (confirm('Delete this debt?')) {
      try { await deleteDebt(delDebt.dataset.id); showToast('Debt deleted.', 'success'); }
      catch (err) { showToast(err.message || 'Could not delete.', 'error'); }
    }
  }
});

// Debt method tabs (avalanche / snowball) — re-render only debts section via full render
pageRoot?.addEventListener('click', (e) => {
  const tab = e.target.closest('#debtMethodTabs .tab');
  if (!tab) return;
  tab.parentElement.querySelectorAll('.tab').forEach((t) => t.classList.remove('is-active'));
  tab.classList.add('is-active');
  renderEverything();
});

// CSV import
pageRoot?.addEventListener('change', async (e) => {
  const input = e.target.closest('#csvImportInput');
  if (!input?.files?.length) return;
  const file = input.files[0];
  const status = document.getElementById('importStatus');
  try {
    const text = await file.text();
    const rows = parseTransactionsCSV(text);
    if (status) status.textContent = `Found ${rows.length} rows. Importing…`;
    const n = await importTransactions(rows);
    showToast(`Imported ${n} transactions.`, 'success');
    if (status) status.textContent = `Imported ${n} transactions from ${file.name}.`;
  } catch (err) {
    showToast(err.message || 'Import failed.', 'error');
    if (status) status.textContent = err.message || 'Import failed.';
  } finally {
    input.value = '';
  }
});

// Escape closes account/debt modals too
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (accountModal?.style.display === 'flex') closeAccountModal();
  if (debtModal?.style.display === 'flex') closeDebtModal();
});

// ---------- Search (desktop + mobile) ----------
const searchInput = document.getElementById('desktopSearchInput') || document.querySelector('.topbar__search input');
const mobileSearchInput = document.getElementById('mobileSearchInput');
const searchToggle = document.getElementById('searchToggle');
const mobileSearch = document.getElementById('mobileSearch');

function applySearchFilter() {
  const term = (
    (document.activeElement === mobileSearchInput ? mobileSearchInput?.value : null)
    ?? searchInput?.value
    ?? mobileSearchInput?.value
    ?? ''
  ).trim().toLowerCase();

  // Keep both inputs in sync
  if (searchInput && mobileSearchInput && searchInput.value !== mobileSearchInput.value) {
    if (document.activeElement === mobileSearchInput) searchInput.value = mobileSearchInput.value;
    else if (document.activeElement === searchInput) mobileSearchInput.value = searchInput.value;
  }

  ['recentTransactionsBody', 'allTransactionsBody'].forEach((id) => {
    const body = document.getElementById(id);
    if (!body) return;
    body.querySelectorAll('tr[data-id]').forEach((row) => {
      const rowText = row.textContent.toLowerCase();
      row.style.display = !term || rowText.includes(term) ? '' : 'none';
    });
  });
}

const debouncedSearch = debounce(applySearchFilter, 200);
searchInput?.addEventListener('input', debouncedSearch);
mobileSearchInput?.addEventListener('input', debouncedSearch);

searchToggle?.addEventListener('click', () => {
  const open = !mobileSearch?.classList.contains('is-open');
  mobileSearch?.classList.toggle('is-open', open);
  searchToggle.setAttribute('aria-expanded', String(open));
  if (open) mobileSearchInput?.focus();
});

// ---------- Scroll to top ----------
const scrollTopBtn = document.getElementById('scrollTopBtn');
window.addEventListener('scroll', () => {
  const show = window.scrollY > 320;
  scrollTopBtn?.classList.toggle('is-visible', show);
}, { passive: true });
scrollTopBtn?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---------- Chart resize (orientation / window changes) ----------
window.addEventListener('resize', debounce(() => {
  try { renderCharts(); } catch (_) { /* view may not have canvases */ }
}, 200));

// ---------- Keyboard shortcuts ----------
document.addEventListener('keydown', (e) => {
  // Ignore when typing in inputs
  const tag = (e.target && e.target.tagName) || '';
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

  // "n" → new transaction
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    openModal();
  }
  // "/" → focus search
  if (e.key === '/') {
    e.preventDefault();
    if (window.matchMedia('(max-width: 768px)').matches) {
      mobileSearch?.classList.add('is-open');
      searchToggle?.setAttribute('aria-expanded', 'true');
      mobileSearchInput?.focus();
    } else {
      searchInput?.focus();
    }
  }
});

