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
  exportTransactionsAsCSV, initState, isAuthenticated, logout, getCurrentUser,
  getCashFlowSeries, getFinancialHealthScore, getTransactions, getGoals,
  upsertBudget, deleteBudget, addGoal, updateGoal, deleteGoal,
  updateProfile, getInsights, getAllCategoryNames,
} from './state.js';
import { renderAll } from './transactions.js';
import { drawLineChart, drawGauge, drawDonut, drawRing } from './charts.js';
import { showToast, debounce, escapeHTML } from './utils.js';
import { icon } from './icons.js';
import { initRouter, setOnRouteChange } from './router.js';

let currentFilter = 'all';
let cashFlowRange = '1M';
let txPage = 1;

const MAX_TRANSACTION_AMOUNT = 1_00_00_000; // ₹1 crore — sane upper bound against fat-finger entry
const MAX_TITLE_LENGTH = 80;

const pageRoot = document.getElementById('pageRoot');

/** Rebuilds a category <select>'s options from live data + a "custom" option, keeping `keep` selected if present. */
function populateCategorySelect(selectEl, keep, { includeCustomOption = true } = {}) {
  if (!selectEl) return;
  const names = getAllCategoryNames();
  selectEl.innerHTML = names.map((n) => `<option value="${n}">${n}</option>`).join('')
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
    getCategoryBreakdown().map((c) => ({ label: c.category, value: c.amount }))
  );
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
async function boot() {
  const authed = await isAuthenticated();
  if (!authed) {
    window.location.href = 'auth.html';
    return;
  }

  try {
    await initState();
    initRouter(); // mounts the initial view and renders it via setOnRouteChange -> renderEverything
    hideLoader();
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

function openSidebar() { sidebar.classList.add('is-open'); sidebarBackdrop.classList.add('is-visible'); }
function closeSidebar() { sidebar.classList.remove('is-open'); sidebarBackdrop.classList.remove('is-visible'); }

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

  if (tx) {
    transactionModalTitle.textContent = 'Edit Transaction';
    saveRecordBtn.textContent = 'Update Record';
    titleInput.value = tx.title;
    amountInput.value = tx.amount;
    dateInput.value = tx.date;
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
  txCustomCategoryField.style.display = 'none';
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
    if (isEditing) {
      await updateTransaction(editingTransactionId, { type, title, amount, category, date });
      showToast('Transaction updated.', 'success');
    } else {
      await addTransaction({ type, title, amount, category, date });
      showToast('Transaction added.', 'success');
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
    if (searchInput) searchInput.value = '';
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
  notifPanel.innerHTML = insights.length
    ? insights.map((ins) => `
      <div class="notif-item">
        <span class="notif-item__icon">${icon(ins.icon, 18)}</span>
        <div>
          <span class="notif-item__title">${escapeHTML(ins.title)}</span>
          <p class="notif-item__message">${escapeHTML(ins.message)}</p>
        </div>
      </div>`).join('')
    : `<div class="notif-empty">You're all caught up.</div>`;
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
  const name = document.querySelector('#settings input[type="text"]')?.value.trim();
  const email = document.querySelector('#settings input[type="email"]')?.value.trim();

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
  if (e.target.matches('#settings input[type="text"], #settings input[type="email"]')) {
    e.target.dataset.touched = '1';
  }
});
pageRoot?.addEventListener('click', async (e) => {
  if (e.target.closest('#settings .btn-secondary')) {
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

// ---------- Search (topbar) ----------
// The search input lives outside #pageRoot, but the rows it filters don't
// exist until the Dashboard/Transactions view is mounted — applySearchFilter()
// already no-ops safely when they're absent.
const searchInput = document.querySelector('.topbar__search input');

function applySearchFilter() {
  const term = (searchInput?.value || '').trim().toLowerCase();
  ['recentTransactionsBody', 'allTransactionsBody'].forEach((id) => {
    const body = document.getElementById(id);
    if (!body) return;
    body.querySelectorAll('tr[data-id]').forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display = !term || text.includes(term) ? '' : 'none';
    });
  });
}

searchInput?.addEventListener('input', debounce(applySearchFilter, 200));
