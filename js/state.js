/* ==========================================================================
   FinPulse-OS — state.js
   In-memory cache backed by Supabase. Render functions read the cache
   synchronously; CRUD operations are async and hit Supabase directly,
   then update the cache and notify subscribers.
   ========================================================================== */

import { supabase } from './supabaseClient.js';
import { formatCurrency } from './utils.js';

let cache = {
  user: null,
  transactions: [],
  budgets: [],
  goals: [],
};

const listeners = new Set();
function notify() { listeners.forEach((fn) => fn(cache)); }
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------- Auth ----------
export async function isAuthenticated() {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

export async function signup(name, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw new Error(error.message);
  cache.user = data.user;
  return data.user;
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  cache.user = data.user;
  return data.user;
}

export async function logout() {
  await supabase.auth.signOut();
  cache = { user: null, transactions: [], budgets: [], goals: [] };
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`,
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export function getCurrentUser() {
  return cache.user;
}

/** Loads everything needed to render the dashboard. Call once after login / on page load. */
export async function initState() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  cache.user = user;

  const [txRes, budgetRes, goalRes] = await Promise.all([
    supabase.from('transactions').select('*').order('date', { ascending: false }),
    supabase.from('budgets').select('*'),
    supabase.from('goals').select('*'),
  ]);

  if (txRes.error) throw new Error(txRes.error.message);
  if (budgetRes.error) throw new Error(budgetRes.error.message);
  if (goalRes.error) throw new Error(goalRes.error.message);

  cache.transactions = txRes.data.map(normalizeTx);
  cache.budgets = budgetRes.data.map((b) => ({ category: b.category, limit: Number(b.limit_amount) }));
  cache.goals = goalRes.data.map((g) => ({ ...g, target: Number(g.target), saved: Number(g.saved) }));
  notify();
}

function normalizeTx(row) {
  return { id: row.id, type: row.type, title: row.title, category: row.category, amount: Number(row.amount), date: row.date };
}

// ---------- Transactions ----------
export async function addTransaction({ type, title, amount, category, date }) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({ user_id: cache.user.id, type, title, category, amount: Number(amount), date })
    .select()
    .single();
  if (error) throw new Error(error.message);
  cache.transactions.unshift(normalizeTx(data));
  notify();
  return data;
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw new Error(error.message);
  cache.transactions = cache.transactions.filter((t) => t.id !== id);
  notify();
}

export async function updateTransaction(id, updates) {
  const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  cache.transactions = cache.transactions.map((t) => (t.id === id ? normalizeTx(data) : t));
  notify();
}

export function getTransactions({ filter = 'all' } = {}) {
  if (filter === 'all') return cache.transactions;
  return cache.transactions.filter((t) => t.type === filter);
}

// ---------- Derived data (sync — reads cache only) ----------

/** True if an ISO date string falls within `monthOffset` months of today (0 = this month, -1 = last month). */
function isInMonth(dateStr, monthOffset = 0) {
  const d = new Date(dateStr);
  const ref = new Date();
  ref.setMonth(ref.getMonth() + monthOffset);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

/** Income/expense for a single calendar month. monthOffset 0 = current month, -1 = previous month. */
export function getMonthlyTotals(monthOffset = 0) {
  const txs = cache.transactions.filter((t) => isInMonth(t.date, monthOffset));
  const income = txs.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = txs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  return { income, expense, balance: income - expense };
}

/** All-time totals — used only for "Total Balance", which is meant to be cumulative across all history. */
export function getTotals() {
  const income = cache.transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = cache.transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  return { income, expense, balance: income - expense };
}

/** Expense-by-category. scope 'month' (default) matches the Budget Planner's monthly limits; pass 'all' for lifetime. */
export function getCategoryBreakdown(scope = 'month') {
  const totals = {};
  cache.transactions
    .filter((t) => t.type === 'expense')
    .filter((t) => (scope === 'month' ? isInMonth(t.date, 0) : true))
    .forEach((t) => { totals[t.category] = (totals[t.category] || 0) + t.amount; });
  return Object.entries(totals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function getMonthlyBudgetUsage() {
  const totalLimit = cache.budgets.reduce((sum, b) => sum + b.limit, 0);
  const totalSpent = getCategoryBreakdown().reduce((sum, c) => sum + c.amount, 0);
  const percent = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  return { totalLimit, totalSpent, percent, remaining: Math.max(totalLimit - totalSpent, 0) };
}

// ---------- Cash flow trend (respects 1M / 3M / 1Y range) ----------
export function getCashFlowSeries(range = '1M') {
  const days = range === '1M' ? 30 : range === '3M' ? 90 : 365;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const txs = cache.transactions
    .filter((t) => new Date(t.date) >= cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!txs.length) return [];

  if (range === '1Y') {
    const byMonth = new Map();
    txs.forEach((t) => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const net = t.type === 'income' ? t.amount : -t.amount;
      if (!byMonth.has(key)) {
        byMonth.set(key, { label: d.toLocaleDateString('en-IN', { month: 'short' }), value: 0 });
      }
      byMonth.get(key).value += net;
    });
    return [...byMonth.values()];
  }

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

// ---------- Financial health score (0-100) ----------
export function getFinancialHealthScore() {
  const { income, expense } = getMonthlyTotals();
  const savingsRate = income > 0 ? (income - expense) / income : 0;
  const savingsScore = Math.min(Math.max(savingsRate * 200, 0), 100);

  const budgets = getBudgets();
  const budgetScore = budgets.length
    ? Math.min(Math.max(100 - Math.max(0, (budgets.reduce((s, b) => s + b.percent, 0) / budgets.length) - 80) * 2, 0), 100)
    : 70;

  const goals = getGoals();
  const goalScore = goals.length
    ? Math.min(goals.reduce((s, g) => s + Math.min((g.saved / g.target) * 100, 100), 0) / goals.length, 100)
    : 70;

  const score = Math.round(savingsScore * 0.5 + budgetScore * 0.3 + goalScore * 0.2);

  let label, message;
  if (score >= 80) { label = 'Excellent'; message = 'Your finances are in great shape — keep it up.'; }
  else if (score >= 60) { label = 'Good'; message = savingsRate > 0 ? 'Your savings rate is healthy this month.' : 'Solid overall, but keep an eye on spending.'; }
  else if (score >= 40) { label = 'Fair'; message = 'There\u2019s room to tighten your budget and boost savings.'; }
  else { label = 'Needs attention'; message = income > 0 && expense > income ? 'You\u2019re spending more than you earn this month.' : 'Add more transactions so we can track your trend.'; }

  return { score, label, message };
}

// ---------- Rule-based spending insights ----------
export function getInsights() {
  const insights = [];
  const { income, expense } = getMonthlyTotals();
  const budgets = getBudgets();
  const categories = getCategoryBreakdown();

  if (!cache.transactions.length) {
    return [{
      icon: 'sparkles',
      title: 'Add your first transaction',
      message: 'Once you log income and expenses, FinPulse will surface personalized spending insights here.',
    }];
  }

  budgets.filter((b) => b.percent >= 100).forEach((b) => {
    insights.push({
      icon: 'alert',
      title: `${b.category} budget exceeded`,
      message: `You've spent ${formatCurrency(b.spent)} against a ${formatCurrency(b.limit)} limit — ${b.percent}% used.`,
    });
  });

  budgets.filter((b) => b.percent >= 85 && b.percent < 100).forEach((b) => {
    insights.push({
      icon: 'warning',
      title: `${b.category} nearing its limit`,
      message: `${b.percent}% of your ${formatCurrency(b.limit)} budget is used. ${formatCurrency(b.limit - b.spent)} left this month.`,
    });
  });

  if (categories.length) {
    const top = categories[0];
    const totalExpense = categories.reduce((s, c) => s + c.amount, 0);
    const share = Math.round((top.amount / totalExpense) * 100);
    if (share >= 35) {
      insights.push({
        icon: 'sparkles',
        title: `${top.category} is your biggest expense`,
        message: `It makes up ${share}% of your total spending (${formatCurrency(top.amount)}).`,
      });
    }
  }

  if (income > 0 && expense > income) {
    insights.push({
      icon: 'alert',
      title: 'Spending more than you earn',
      message: `Expenses (${formatCurrency(expense)}) have crossed income (${formatCurrency(income)}) this period.`,
    });
  } else if (income > 0) {
    const rate = Math.round(((income - expense) / income) * 100);
    if (rate >= 20) {
      insights.push({
        icon: 'sparkles',
        title: 'Strong savings rate',
        message: `You're saving about ${rate}% of your income — well above the recommended 20%.`,
      });
    }
  }

  if (!budgets.length) {
    insights.push({
      icon: 'sparkles',
      title: 'Set your first budget',
      message: 'Add category limits in the Budget Planner to get overspending alerts automatically.',
    });
  }

  return insights.slice(0, 4);
}

const BASE_CATEGORIES = ['Food & Groceries', 'Transport', 'Bills & Utilities', 'Shopping', 'Entertainment', 'Health', 'Other'];

/** Union of built-in categories and any custom ones the user has already used — so a
 *  custom category typed once shows up as a normal option from then on. */
export function getAllCategoryNames() {
  const used = new Set(BASE_CATEGORIES);
  cache.transactions.forEach((t) => { if (t.category) used.add(t.category); });
  cache.budgets.forEach((b) => { if (b.category) used.add(b.category); });
  return [...used].sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)));
}

export function getBudgets() {
  const spendByCategory = Object.fromEntries(getCategoryBreakdown().map((c) => [c.category, c.amount]));
  return cache.budgets.map((b) => ({
    ...b,
    spent: spendByCategory[b.category] || 0,
    percent: Math.min(Math.round(((spendByCategory[b.category] || 0) / b.limit) * 100), 100),
  }));
}

export async function upsertBudget(category, limit) {
  const { error } = await supabase
    .from('budgets')
    .upsert({ user_id: cache.user.id, category, limit_amount: Number(limit) }, { onConflict: 'user_id,category' });
  if (error) throw new Error(error.message);
  const existing = cache.budgets.find((b) => b.category === category);
  if (existing) existing.limit = Number(limit);
  else cache.budgets.push({ category, limit: Number(limit) });
  notify();
}

export async function deleteBudget(category) {
  const { error } = await supabase.from('budgets').delete().eq('user_id', cache.user.id).eq('category', category);
  if (error) throw new Error(error.message);
  cache.budgets = cache.budgets.filter((b) => b.category !== category);
  notify();
}

// ---------- Goals ----------
export function getGoals() {
  return cache.goals;
}

export async function addGoal({ name, target, saved = 0, deadline }) {
  const { data, error } = await supabase
    .from('goals')
    .insert({ user_id: cache.user.id, name, target: Number(target), saved: Number(saved), deadline: deadline || null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  cache.goals.push(data);
  notify();
  return data;
}

export async function updateGoal(id, { name, target, saved, deadline }) {
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (target !== undefined) updates.target = Number(target);
  if (saved !== undefined) updates.saved = Number(saved);
  if (deadline !== undefined) updates.deadline = deadline || null;

  const { data, error } = await supabase.from('goals').update(updates).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  cache.goals = cache.goals.map((g) => (g.id === id ? { ...g, ...data, target: Number(data.target), saved: Number(data.saved) } : g));
  notify();
  return data;
}

export async function deleteGoal(id) {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw new Error(error.message);
  cache.goals = cache.goals.filter((g) => g.id !== id);
  notify();
}

// ---------- Profile ----------
/** Updates display name and/or email. Changing email triggers Supabase's confirmation flow. */
export async function updateProfile({ name, email }) {
  const payload = {};
  if (name !== undefined) payload.data = { name };
  if (email !== undefined && email !== cache.user?.email) payload.email = email;

  if (!Object.keys(payload).length) return cache.user;

  const { data, error } = await supabase.auth.updateUser(payload);
  if (error) throw new Error(error.message);
  cache.user = data.user;
  notify();
  return data.user;
}

// ---------- Export ----------
function csvField(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function exportTransactionsAsCSV() {
  const header = 'Date,Title,Category,Type,Amount\n';
  const rows = cache.transactions
    .map((t) => [t.date, t.title, t.category, t.type, t.amount].map(csvField).join(','))
    .join('\n');
  return header + rows;
}
