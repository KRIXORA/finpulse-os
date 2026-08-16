/* ==========================================================================
   FinPulse-OS — app.js
   Entry point. Guards the page behind auth, loads real data from the
   API, and wires state -> render -> DOM events together.
   ========================================================================== */

import {
  addTransaction, deleteTransaction, getTransactions,
  getCategoryBreakdown, getMonthlyBudgetUsage, subscribe,
  exportTransactionsAsCSV, initState, isAuthenticated, logout, getCurrentUser,
} from './state.js';
import { renderAll } from './transactions.js';
import { drawLineChart, drawGauge, drawDonut, drawRing } from './charts.js';

let currentFilter = 'all';

// ---------- Chart builders ----------
function buildCashFlowPoints() {
  const txs = [...getTransactions()].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (!txs.length) return [];
  let running = 0;
  const byDate = new Map();
  txs.forEach((t) => {
    running += t.type === 'income' ? t.amount : -t.amount;
    byDate.set(t.date, running);
  });
  return [...byDate.entries()].map(([date, value]) => ({
    label: new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    value,
  }));
}

function renderCharts() {
  drawLineChart(document.getElementById('cashFlowChart'), buildCashFlowPoints());
  drawGauge(document.getElementById('budgetGauge'), getMonthlyBudgetUsage().percent);
  drawDonut(
    document.getElementById('categoryPieChart'),
    getCategoryBreakdown().map((c) => ({ label: c.category, value: c.amount }))
  );
  drawRing(document.getElementById('healthScoreRing'), 78); // real scoring logic lands in Phase 5
}

function renderUserGreeting() {
  const user = getCurrentUser();
  const heading = document.querySelector('#dashboard .page-section__title');
  if (heading && user?.name) heading.textContent = `Welcome back, ${user.name.split(' ')[0]}`;
}

function renderEverything() {
  renderAll(currentFilter);
  renderCharts();
  renderUserGreeting();
}

subscribe(renderEverything);

// ---------- Initial data load ----------
async function boot() {
  const authed = await isAuthenticated();
  if (!authed) {
    window.location.href = 'auth.html';
    return;
  }

  try {
    await initState();
    renderEverything();
  } catch (err) {
    console.error(err);
    alert(err.message || 'Something went wrong while loading your data.');
    await logout();
    window.location.href = 'auth.html';
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

document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('is-active'));
    link.classList.add('is-active');
    closeSidebar();
  });
});

// ---------- Add Transaction modal ----------
const transactionModal = document.getElementById('transactionModal');
const addTransactionBtn = document.getElementById('addTransactionBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const modalTabGroup = transactionModal?.querySelector('.tab-group');
const saveRecordBtn = transactionModal?.querySelector('.btn-primary');

function openModal() { transactionModal.style.display = 'flex'; }
function closeModal() {
  transactionModal.style.display = 'none';
  transactionModal.querySelectorAll('.input').forEach((el) => (el.value = ''));
}

addTransactionBtn?.addEventListener('click', openModal);
closeModalBtn?.addEventListener('click', closeModal);
cancelModalBtn?.addEventListener('click', closeModal);
transactionModal?.addEventListener('click', (e) => { if (e.target === transactionModal) closeModal(); });

saveRecordBtn?.addEventListener('click', async () => {
  const type = modalTabGroup.querySelector('.tab.is-active').textContent.trim().toLowerCase();
  const [titleInput, amountInput] = transactionModal.querySelectorAll('.input[type="text"], .input[type="number"]');
  const categorySelect = transactionModal.querySelector('.select');
  const dateInput = transactionModal.querySelector('.input[type="date"]');

  const title = titleInput.value.trim();
  const amount = Number(amountInput.value);
  const category = categorySelect.value;
  const date = dateInput.value || new Date().toISOString().slice(0, 10);

  if (!title || !amount || amount <= 0) {
    alert('Please enter a valid title and amount.');
    return;
  }

  saveRecordBtn.disabled = true;
  try {
    await addTransaction({ type, title, amount, category, date });
    closeModal();
  } catch (err) {
    alert(err.message || 'Could not save transaction.');
  } finally {
    saveRecordBtn.disabled = false;
  }
});

// ---------- Tab groups ----------
document.querySelectorAll('.tab-group').forEach((group) => {
  if (group === modalTabGroup) {
    group.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        group.querySelectorAll('.tab').forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
      });
    });
    return;
  }

  group.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      group.querySelectorAll('.tab').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');

      const label = tab.textContent.trim().toLowerCase();
      if (['all', 'income', 'expense'].includes(label)) {
        currentFilter = label;
        renderEverything();
      }
    });
  });
});

// ---------- Delete / edit delegation ----------
document.getElementById('allTransactionsBody')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const row = btn.closest('tr');
  const id = row?.dataset.id;
  if (!id) return;

  if (btn.dataset.action === 'delete') {
    if (confirm('Delete this transaction?')) {
      try {
        await deleteTransaction(id);
      } catch (err) {
        alert(err.message || 'Could not delete transaction.');
      }
    }
  }
});

// ---------- Settings actions ----------
document.querySelectorAll('#settings .btn-secondary').forEach((btn) => {
  btn.addEventListener('click', () => {
    const csv = exportTransactionsAsCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finpulse-transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  });
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  if (confirm('Sign out of FinPulse-OS?')) {
    await logout();
    window.location.href = 'auth.html';
  }
});
