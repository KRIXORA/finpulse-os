/* ==========================================================================
   FinPulse-OS — utils.js
   Shared formatters and small helpers.
   ========================================================================== */

import { icon } from './icons.js';

/** Format a number as Indian Rupee currency string, e.g. 124580 -> "₹1,24,580" */
export function formatCurrency(amount, { showSign = false } = {}) {
  const value = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

  if (!showSign) return formatted;
  return amount < 0 ? `−${formatted}` : `+${formatted}`;
}

/** Format an ISO date string as "Aug 14" */
export function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

/** Format an ISO date string as "14 Aug 2026" */
export function formatDateLong(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Generate a short unique id */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Clamp a number between min and max */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Map a category name to an SVG icon key (fallback: 'package') */
const CATEGORY_ICON_KEYS = {
  'Food & Groceries': 'cart',
  'Transport': 'car',
  'Entertainment': 'film',
  'Income': 'briefcase',
  'Bills & Utilities': 'zap',
  'Shopping': 'bag',
  'Health': 'pill',
  'Other': 'package',
};
export function categoryIcon(category) {
  return icon(CATEGORY_ICON_KEYS[category] || 'package', 18);
}

/** Escape HTML special characters — always use before inserting user text into innerHTML. */
export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

/** Show a transient toast notification instead of a blocking alert(). type: 'success' | 'error' | 'info' */
export function showToast(message, type = 'info', duration = 3500) {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

/** Debounce a function call */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
