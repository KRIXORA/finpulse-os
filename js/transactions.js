/* ==========================================================================
   FinPulse-OS — transactions.js
   DOM rendering for transaction-related UI: tables, category list, stats.
   Pure render functions — read from state, write to DOM. No state mutation here.
   ========================================================================== */

import { formatCurrency, formatDate, categoryIcon, escapeHTML } from './utils.js';
import { icon } from './icons.js';
import { CATEGORY_PALETTE } from './charts.js';
import {
  getTransactions, getTotals, getMonthlyTotals, getCategoryBreakdown, getMonthlyBudgetUsage,
  getBudgets, getGoals, getFinancialHealthScore, getInsights, getCurrentUser, getRecurring,
  getNetWorth, getAccounts, getDebts, getDebtPayoffPlan, getSafeToSpend, getFiftyThirtyTwenty,
  getUpcomingBills, detectSubscriptions, getMonthComparison, getOnboardingProgress, isAccountEmpty,
} from './state.js';

function txRowHTML(t, { withActions = false } = {}) {
  const sign = t.type === 'income' ? '+' : '−';
  const color = t.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)';
  return `
    <tr data-id="${t.id}">
      <td data-label="Date">${formatDate(t.date)}</td>
      <td class="table-row-icon" data-label-heading><span class="icon-badge">${categoryIcon(t.category)}</span> ${escapeHTML(t.title)}</td>
      <td data-label="Category"><span class="badge badge--neutral">${escapeHTML(t.category)}</span></td>
      <td data-label="Amount" style="color:${color}">${sign}${formatCurrency(t.amount)}</td>
      ${withActions ? `<td data-label="Actions">
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

const TX_PAGE_SIZE = 15;

export function renderAllTransactions(filter = 'all', page = 1) {
  const body = document.getElementById('allTransactionsBody');
  const paginationEl = document.getElementById('txPagination');
  if (!body) return 1;

  const all = getTransactions({ filter });
  const totalPages = Math.max(1, Math.ceil(all.length / TX_PAGE_SIZE));
  const clampedPage = Math.min(Math.max(page, 1), totalPages);
  const start = (clampedPage - 1) * TX_PAGE_SIZE;
  const pageItems = all.slice(start, start + TX_PAGE_SIZE);

  body.innerHTML = pageItems.length
    ? pageItems.map((t) => txRowHTML(t, { withActions: true })).join('')
    : `<tr><td colspan="5" style="text-align:center; color:var(--color-text-muted); padding: var(--space-6)">No transactions yet</td></tr>`;

  if (paginationEl) {
    paginationEl.innerHTML = all.length > TX_PAGE_SIZE ? `
      <button class="btn btn-ghost btn-sm" data-action="tx-prev-page" ${clampedPage === 1 ? 'disabled' : ''}>&larr; Prev</button>
      <span class="pagination__label">Page ${clampedPage} of ${totalPages} &middot; ${all.length} transactions</span>
      <button class="btn btn-ghost btn-sm" data-action="tx-next-page" ${clampedPage === totalPages ? 'disabled' : ''}>Next &rarr;</button>
    ` : '';
  }

  return clampedPage;
}

function deltaText(current, previous) {
  if (previous === 0) return current > 0 ? { text: 'New this month', cls: 'stat-card__meta--positive' } : { text: 'No activity last month', cls: '' };
  const pct = Math.round(((current - previous) / previous) * 100);
  const sign = pct > 0 ? '+' : '';
  return { text: `${sign}${pct}% vs last month`, cls: pct >= 0 ? 'stat-card__meta--positive' : 'stat-card__meta--negative' };
}

export function renderStatCards() {
  const { balance } = getTotals(); // lifetime — "Total Balance" is cumulative by design
  const { income, expense } = getMonthlyTotals(0);
  const prev = getMonthlyTotals(-1);

  const balanceEl = document.getElementById('statBalance');
  const incomeEl = document.getElementById('statIncome');
  const expenseEl = document.getElementById('statExpense');
  const incomeDeltaEl = document.getElementById('statIncomeDelta');
  const expenseDeltaEl = document.getElementById('statExpenseDelta');

  if (balanceEl) balanceEl.textContent = formatCurrency(balance);
  if (incomeEl) incomeEl.textContent = formatCurrency(income);
  if (expenseEl) expenseEl.textContent = formatCurrency(expense);

  if (incomeDeltaEl) {
    const d = deltaText(income, prev.income);
    incomeDeltaEl.textContent = d.text;
    incomeDeltaEl.className = `stat-card__meta ${d.cls}`;
  }
  if (expenseDeltaEl) {
    // For expenses, a rise is the "negative" direction and a drop is "positive" — invert the color logic.
    const d = deltaText(expense, prev.expense);
    expenseDeltaEl.textContent = d.text;
    const invertedCls = d.cls === 'stat-card__meta--positive' ? 'stat-card__meta--negative'
      : d.cls === 'stat-card__meta--negative' ? 'stat-card__meta--positive' : d.cls;
    expenseDeltaEl.className = `stat-card__meta ${invertedCls}`;
  }
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
            <span class="category-row__name">${escapeHTML(c.category)}</span>
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
        <div class="card" data-category="${escapeHTML(b.category)}">
          <div class="card__header">
            <span class="card__title">${escapeHTML(b.category)}</span>
            <span class="badge ${badgeType}">${b.percent}% used</span>
          </div>
          <div class="progress-track"><div class="progress-fill ${fillType}" style="width:${b.percent}%"></div></div>
          <p style="margin-top:var(--space-3); font-size:var(--text-sm); color:var(--color-text-secondary)">${formatCurrency(b.spent)} of ${formatCurrency(b.limit)} limit</p>
          <div style="display:flex; gap:var(--space-2); margin-top:var(--space-3)">
            <button class="btn btn-ghost btn-sm" data-action="edit-budget" data-category="${escapeHTML(b.category)}" data-limit="${b.limit}">Edit</button>
            <button class="btn btn-ghost btn-sm" data-action="delete-budget" data-category="${escapeHTML(b.category)}" style="color:var(--color-danger)">Delete</button>
          </div>
        </div>`;
      }).join('')
    : `<div class="card empty-state" style="grid-column:1/-1">
        <span class="empty-state__icon">${categoryIcon('Other')}</span>
        <strong>No budgets set yet</strong>
        <p style="font-size:var(--text-sm)">Tap "Set Limit Threshold" to create your first spending limit.</p>
      </div>`;
}

export function renderGoals() {
  const grid = document.getElementById('goalsGrid');
  if (!grid) return;
  const goals = getGoals();
  if (!goals.length) {
    grid.innerHTML = `<div class="card empty-state" style="grid-column:1/-1">
        <span class="empty-state__icon">${categoryIcon('Other')}</span>
        <strong>No savings goals yet</strong>
        <p style="font-size:var(--text-sm)">Tap "+ New Goal" to set your first financial target.</p>
      </div>`;
    return;
  }
  grid.innerHTML = goals.map((g) => {
    const percent = Math.min(Math.round((g.saved / g.target) * 100), 100);
    const deadline = g.deadline ? new Date(g.deadline).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'No deadline';
    return `
      <div class="card goal-card" data-id="${g.id}">
        <div class="goal-card__header">
          <span class="goal-card__title">${escapeHTML(g.name)}</span>
          <span class="goal-card__deadline">${deadline}</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
        <div class="goal-card__amounts">
          <span>${formatCurrency(g.saved)} saved</span>
          <span>Target: ${formatCurrency(g.target)}</span>
        </div>
        <div style="display:flex; gap:var(--space-2); margin-top:var(--space-3)">
          <button class="btn btn-ghost btn-sm" data-action="edit-goal" data-id="${g.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-action="delete-goal" data-id="${g.id}" style="color:var(--color-danger)">Delete</button>
        </div>
      </div>`;
  }).join('');
}

export function renderHealthScore() {
  const { score, label, message } = getFinancialHealthScore();
  const scoreEl = document.querySelector('#insights .stat-card__value--accent');
  const msgEl = document.querySelector('#insights .health-score__details p');
  if (scoreEl) scoreEl.textContent = `${score} / 100`;
  if (msgEl) msgEl.textContent = `${label} — ${message}`;
  return score;
}

export function renderInsights() {
  const grid = document.getElementById('insightsGrid');
  if (!grid) return;
  const insights = getInsights();
  grid.innerHTML = insights.map((ins) => `
    <div class="card insight-card">
      <div class="insight-card__icon">${icon(ins.icon, 18)}</div>
      <div class="insight-card__body">
        <strong>${ins.title}</strong>
        <p>${ins.message}</p>
      </div>
    </div>`).join('');
}

export function renderCategoryLegend(scope = 'month') {
  const legend = document.getElementById('categoryLegend');
  if (!legend) return;
  const categories = getCategoryBreakdown(scope);
  const total = categories.reduce((s, c) => s + c.amount, 0);

  if (!categories.length) {
    legend.innerHTML = `<p style="color:var(--color-text-muted); font-size:var(--text-sm)">No expenses recorded yet.</p>`;
    return;
  }

  legend.innerHTML = categories.map((c, i) => `
    <div class="legend-row">
      <span class="legend-row__dot" style="background:${CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]}"></span>
      <span class="legend-row__label">${escapeHTML(c.category)}</span>
      <span class="legend-row__amount">${formatCurrency(c.amount)}</span>
      <span class="legend-row__percent">${Math.round((c.amount / total) * 100)}%</span>
    </div>`).join('');
}

export function renderSettingsProfile() {
  const nameInput = document.getElementById('settingsNameInput');
  const emailInput = document.getElementById('settingsEmailInput');
  if (!nameInput && !emailInput) return;
  const user = getCurrentUser();
  if (!user) return;
  if (nameInput && !nameInput.dataset.touched && !nameInput.value) {
    nameInput.value = user.user_metadata?.name || '';
  }
  if (emailInput && !emailInput.dataset.touched && !emailInput.value) {
    emailInput.value = user.email || '';
  }
}

export function renderRecurringList() {
  const list = document.getElementById('recurringList');
  if (!list) return;
  const rules = getRecurring();

  if (!rules.length) {
    list.innerHTML = `<p style="font-size:var(--text-sm); color:var(--color-text-muted)">No recurring transactions set up.</p>`;
    return;
  }

  list.innerHTML = rules.map((r) => `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-3); padding:var(--space-3) 0; border-top:1px solid var(--color-border);">
      <div style="min-width:0;">
        <strong style="display:block; font-size:var(--text-sm);">${escapeHTML(r.title)}</strong>
        <span style="font-size:var(--text-xs); color:var(--color-text-muted);">
          ${r.frequency === 'monthly' ? 'Monthly' : 'Weekly'} &middot; ${formatCurrency(r.amount)} &middot; next on ${formatDate(r.nextRunDate)}
        </span>
      </div>
      <button class="btn btn-ghost btn-sm" data-action="delete-recurring" data-id="${r.id}" style="color:var(--color-danger); flex-shrink:0;">Delete</button>
    </div>`).join('');
}

/** Re-renders every data-driven part of the UI. Call after any state change. */
export function renderAll(activeFilter = 'all', txPage = 1) {
  renderStatCards();
  renderRecentTransactions(activeFilter);
  const clampedPage = renderAllTransactions(activeFilter, txPage);
  renderCategoryList();
  renderBudgetGaugeText();
  renderBudgetPlanner();
  renderGoals();
  renderHealthScore();
  renderInsights();
  renderCategoryLegend();
  renderSettingsProfile();
  renderRecurringList();
  renderNetWorth();
  renderAnalyticsExtra();
  renderOnboarding();
  return clampedPage;
}


export function renderNetWorth() {
  const nw = getNetWorth();
  const el = (id, val) => { const n = document.getElementById(id); if (n) n.textContent = formatCurrency(val); };
  el('statNetWorth', nw.netWorth);
  el('statAssets', nw.assets);
  el('statLiabilities', nw.liabilities);

  const safe = getSafeToSpend();
  const safeEl = document.getElementById('safeToSpendValue');
  const safeMeta = document.getElementById('safeToSpendMeta');
  if (safeEl) safeEl.textContent = formatCurrency(safe.safe);
  if (safeMeta) {
    safeMeta.textContent = safe.upcomingBills > 0
      ? `After near-term bills of ${formatCurrency(safe.upcomingBills)}. Monthly left: ${formatCurrency(safe.left)}.`
      : `Based on this month's activity. Cash left: ${formatCurrency(safe.left)}.`;
  }

  const rule = getFiftyThirtyTwenty();
  const ruleEl = document.getElementById('rule502030');
  if (ruleEl) {
    const row = (label, block, target) => `
      <div class="rule-row">
        <div class="rule-row__top"><span>${label} (target ${target}%)</span><span>${formatCurrency(block.amount)} · ${block.pct}%</span></div>
        <div class="progress-track"><div class="progress-fill ${block.pct > target + 5 ? 'progress-fill--danger' : ''}" style="width:${Math.min(block.pct, 100)}%"></div></div>
      </div>`;
    ruleEl.innerHTML = row('Needs', rule.needs, 50) + row('Wants', rule.wants, 30) + row('Savings', rule.savings, 20);
  }

  const accList = document.getElementById('accountsList');
  if (accList) {
    const accounts = getAccounts();
    accList.innerHTML = accounts.length ? accounts.map((a) => `
      <div class="list-row">
        <div>
          <strong>${escapeHTML(a.name)}</strong>
          <span class="badge badge--neutral" style="margin-left:8px">${a.kind}</span>
          <div style="font-size:var(--text-xs); color:var(--color-text-muted)">${formatCurrency(a.balance)}</div>
        </div>
        <div style="display:flex; gap:4px">
          <button class="btn btn-ghost btn-sm" data-action="edit-account" data-id="${a.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-action="delete-account" data-id="${a.id}" style="color:var(--color-danger)">Delete</button>
        </div>
      </div>`).join('') : `<p style="font-size:var(--text-sm); color:var(--color-text-muted)">No accounts yet. Add bank/cash/investments to track net worth.</p>`;
  }

  const debtMethod = document.querySelector('#debtMethodTabs .tab.is-active')?.dataset?.method || 'avalanche';
  const debtsList = document.getElementById('debtsList');
  if (debtsList) {
    const debts = getDebtPayoffPlan(debtMethod);
    debtsList.innerHTML = debts.length ? debts.map((d) => `
      <div class="list-row">
        <div>
          <strong>#${d.priority} ${escapeHTML(d.name)}</strong>
          <div style="font-size:var(--text-xs); color:var(--color-text-muted)">${formatCurrency(d.balance)} · ${d.interestRate}% APR · min ${formatCurrency(d.minPayment)}</div>
        </div>
        <div style="display:flex; gap:4px">
          <button class="btn btn-ghost btn-sm" data-action="edit-debt" data-id="${d.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-action="delete-debt" data-id="${d.id}" style="color:var(--color-danger)">Delete</button>
        </div>
      </div>`).join('') : `<p style="font-size:var(--text-sm); color:var(--color-text-muted)">No debts tracked. Add loans or credit cards to plan payoff.</p>`;
  }

  const bills = document.getElementById('upcomingBillsList');
  if (bills) {
    const list = getUpcomingBills(14);
    bills.innerHTML = list.length ? list.map((b) => `
      <div class="list-row">
        <div>
          <strong>${escapeHTML(b.title)}</strong>
          <div style="font-size:var(--text-xs); color:var(--color-text-muted)">${escapeHTML(b.category)} · due ${formatDate(b.due)} (${b.daysUntil}d)</div>
        </div>
        <span style="color:var(--color-danger)">${formatCurrency(b.amount)}</span>
      </div>`).join('') : `<p style="font-size:var(--text-sm); color:var(--color-text-muted)">No recurring bills due in the next 14 days.</p>`;
  }
}

export function renderAnalyticsExtra() {
  const cmp = getMonthComparison();
  const box = document.getElementById('monthCompare');
  if (box) {
    box.innerHTML = `
      <div class="compare-item"><span class="label">Income</span><strong>${formatCurrency(cmp.current.income)}</strong><span class="${cmp.incomeDelta >= 0 ? 'up' : 'down'}">${cmp.incomePct >= 0 ? '+' : ''}${cmp.incomePct}% vs last</span></div>
      <div class="compare-item"><span class="label">Expense</span><strong>${formatCurrency(cmp.current.expense)}</strong><span class="${cmp.expenseDelta <= 0 ? 'up' : 'down'}">${cmp.expensePct >= 0 ? '+' : ''}${cmp.expensePct}% vs last</span></div>
      <div class="compare-item"><span class="label">Last month income</span><strong>${formatCurrency(cmp.previous.income)}</strong></div>
      <div class="compare-item"><span class="label">Last month expense</span><strong>${formatCurrency(cmp.previous.expense)}</strong></div>`;
  }
  const subs = document.getElementById('subscriptionsList');
  if (subs) {
    const list = detectSubscriptions();
    subs.innerHTML = list.length ? list.map((s) => `
      <div class="list-row">
        <div>
          <strong>${escapeHTML(s.title)}</strong>
          <div style="font-size:var(--text-xs); color:var(--color-text-muted)">${s.cadence} · ${s.occurrences} times · last ${formatDate(s.lastDate)}</div>
        </div>
        <span>${formatCurrency(s.amount)}</span>
      </div>`).join('') : `<p style="font-size:var(--text-sm); color:var(--color-text-muted)">No subscription-like patterns yet. Add a few months of recurring expenses to detect them.</p>`;
  }
}

export function renderOnboarding() {
  const host = document.getElementById('onboardingChecklist');
  if (!host) return;
  const { steps, done, total, complete } = getOnboardingProgress();
  const empty = isAccountEmpty();

  // Always show demo card when account is empty; otherwise show checklist until complete
  if (complete && !empty) {
    host.style.display = 'none';
    return;
  }
  host.style.display = 'block';

  const demoBlock = empty ? `
    <div class="demo-banner">
      <div>
        <strong>Sample workspace</strong>
        <p>Sample data usually loads automatically on first visit. If the dashboard is still empty, load it here — or open Help (?) for a guided tour.</p>
      </div>
      <button type="button" class="btn btn-primary btn-sm" data-action="load-demo">Load sample data</button>
    </div>` : '';

  const checklist = complete ? '' : `
    <div class="card__header">
      <span class="card__title">Getting started</span>
      <span class="badge badge--neutral">${done}/${total}</span>
    </div>
    <ul class="onboard-list">
      ${steps.map((s) => `<li class="${s.done ? 'is-done' : ''}">${s.done ? '✓' : '○'} ${escapeHTML(s.label)}</li>`).join('')}
    </ul>`;

  host.innerHTML = `
    <div class="card" style="border-color: rgba(59,130,246,0.35)">
      ${demoBlock}
      ${checklist}
    </div>`;
}

