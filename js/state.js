/* ==========================================================================
   FinPulse-OS — state.js
   In-memory cache backed by Supabase. Render functions read the cache
   synchronously; CRUD operations are async and hit Supabase directly,
   then update the cache and notify subscribers.
   ========================================================================== */

import { supabase } from './supabaseClient.js';

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
export function getTotals() {
  const income = cache.transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = cache.transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  return { income, expense, balance: income - expense };
}

export function getCategoryBreakdown() {
  const totals = {};
  cache.transactions
    .filter((t) => t.type === 'expense')
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

// ---------- Export ----------
export function exportTransactionsAsCSV() {
  const header = 'Date,Title,Category,Type,Amount\n';
  const rows = cache.transactions
    .map((t) => `${t.date},"${t.title}",${t.category},${t.type},${t.amount}`)
    .join('\n');
  return header + rows;
}
