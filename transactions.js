/* ==========================================================================
   FinPulse-OS — transactions.js
   DOM rendering for transaction-related UI: tables, category list, stats.
   Pure render functions — read from state, write to DOM. No state mutation here.
   ========================================================================== */

import { formatCurrency, formatDate, categoryIcon } from './utils.js';
import { getTransactions, getTotals, getCategoryBreakdown, getMonthlyBudgetUsage, getBudgets, getGoals } from './state.js';

function txRowHTML(t, { withActions = false } = {}) {
  const sign = t.type === 'income' ? '+' : '−';
  const color = t.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)';
  return `
    <tr data-id="${t.id}">
      <td>${formatDate(t.date)}</td>
      <td class="table-row-icon"><span class="icon-badge">${categoryIcon(t.category)}</span> ${t.title}</td>
      <td><span class="badge badge--neutral">${t.category}</span></td>
      <td style="color:${color}">${sign}${formatCurrency(t.amount)}</td>
      ${withActions ? `<td>
        <button class="btn btn-ghost btn-sm" data-action="edit">Edit</button>
        <button class="btn btn-ghost btn-sm" data-action="delete" style="color:var(--color-danger)">Delete</button>
      </td>` : ''}
    </tr>`;
}

export function renderRecentTransactions(filter = 'all') {
  const body = document.getElementById('recentTransactionsBody');
  if (!body) return;
  const txs = getTransactions({ filter }).slice(0, 6);
  body.innerHTML = txs.length
    ? txs.map((t) => txRowHTML(t)).join('')
    : `<tr><td colspan="4" style="text-align:center; color:var(--color-text-muted); padding: var(--space-6)">No transactions yet</td></tr>`;
}

export function renderAllTransactions(filter = 'all') {
  const body = document.getElementById('allTransactionsBody');
  if (!body) return;
  const txs = getTransactions({ filter });
  body.innerHTML = txs.length
    ? txs.map((t) => txRowHTML(t, { withActions: true })).join('')
    : `<tr><td colspan="5" style="text-align:center; color:var(--color-text-muted); padding: var(--space-6)">No transactions yet</td></tr>`;
}

export function renderStatCards() {
  const { income, expense, balance } = getTotals();
  const balanceEl = document.querySelector('#dashboard .stat-card__value--accent');
  const cards = document.querySelectorAll('#dashboard .stat-card');
  if (balanceEl) balanceEl.textContent = formatCurrency(balance);
  if (cards[1]) cards[1].querySelector('.stat-card__value').textContent = formatCurrency(income);
  if (cards[2]) cards[2].querySelector('.stat-card__value').textContent = formatCurrency(expense);
}

export function renderCategoryList() {
  const list = document.getElementById('categoryList');
  if (!list) return;
  const categories = getCategoryBreakdown();
  const max = categories[0]?.amount || 1;

  list.innerHTML = categories.length
    ? categories.slice(0, 5).map((c) => `
      <div class="category-row">
        <div class="category-row__info">
          <div class="category-row__top">
            <span class="category-row__name">${c.category}</span>
            <span class="category-row__amount">${formatCurrency(c.amount)}</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.round((c.amount / max) * 100)}%"></div></div>
        </div>
      </div>`).join('')
    : `<p style="color:var(--color-text-muted); font-size:var(--text-sm)">No expenses recorded yet.</p>`;
}

export function renderBudgetGaugeText() {
  const usage = getMonthlyBudgetUsage();
  const percentEl = document.querySelector('.gauge__percent');
  const remainingEl = document.querySelector('.gauge__remaining');
  if (percentEl) percentEl.textContent = `${usage.percent}%`;
  if (remainingEl) remainingEl.textContent = `Remaining: ${formatCurrency(usage.remaining)}`;
  return usage;
}

export function renderBudgetPlanner() {
  const grid = document.getElementById('budgetGrid');
  if (!grid) return;
  const budgets = getBudgets();
  grid.innerHTML = budgets.length
    ? budgets.map((b) => {
        const badgeType = b.percent > 90 ? 'badge--danger' : b.percent > 75 ? 'badge--warning' : 'badge--success';
        const fillType = b.percent > 90 ? 'progress-fill--danger' : b.percent > 75 ? 'progress-fill--warning' : '';
        return `
        <div class="card">
          <div class="card__header">
            <span class="card__title">${b.category}</span>
            <span class="badge ${badgeType}">${b.percent}% used</span>
          </div>
          <div class="progress-track"><div class="progress-fill ${fillType}" style="width:${b.percent}%"></div></div>
          <p style="margin-top:var(--space-3); font-size:var(--text-sm); color:var(--color-text-secondary)">${formatCurrency(b.spent)} of ${formatCurrency(b.limit)} limit</p>
        </div>`;
      }).join('')
    : '';
}

export function renderGoals() {
  const grid = document.getElementById('goalsGrid');
  if (!grid) return;
  const goals = getGoals();
  grid.innerHTML = goals.map((g) => {
    const percent = Math.min(Math.round((g.saved / g.target) * 100), 100);
    const deadline = new Date(g.deadline).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    return `
      <div class="card goal-card">
        <div class="goal-card__header">
          <span class="goal-card__title">${g.name}</span>
          <span class="goal-card__deadline">${deadline}</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
        <div class="goal-card__amounts">
          <span>${formatCurrency(g.saved)} saved</span>
          <span>Target: ${formatCurrency(g.target)}</span>
        </div>
      </div>`;
  }).join('');
}

/** Re-renders every data-driven part of the UI. Call after any state change. */
export function renderAll(activeFilter = 'all') {
  renderStatCards();
  renderRecentTransactions(activeFilter);
  renderAllTransactions(activeFilter);
  renderCategoryList();
  renderBudgetGaugeText();
  renderBudgetPlanner();
  renderGoals();
}
