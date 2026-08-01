/* ==========================================================================
   SMART FINANCE OS - MAIN APPLICATION LOGIC (OPTIMIZED)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {

  // --- STATE & DATA MANAGEMENT ---
  const DEFAULT_CATEGORIES = [
    { id: 'cat-1', name: 'Food & Dining', type: 'expense' },
    { id: 'cat-2', name: 'Utilities', type: 'expense' },
    { id: 'cat-3', name: 'Shopping', type: 'expense' },
    { id: 'cat-4', name: 'Salary', type: 'income' },
    { id: 'cat-5', name: 'Investments', type: 'income' },
    { id: 'cat-6', name: 'Entertainment', type: 'expense' }
  ];

  const DEFAULT_TRANSACTIONS = [
    { id: 't-1', title: 'Monthly Salary', amount: 85000, type: 'income', category: 'Salary', date: '2026-07-01' },
    { id: 't-2', title: 'Grocery Supermarket', amount: 5400, type: 'expense', category: 'Food & Dining', date: '2026-07-05' },
    { id: 't-3', title: 'Fiber Broadband Bill', amount: 1499, type: 'expense', category: 'Utilities', date: '2026-07-10' },
    { id: 't-4', title: 'Dividend Payout', amount: 12500, type: 'income', category: 'Investments', date: '2026-07-15' },
    { id: 't-5', title: 'Weekend Movie Night', amount: 1100, type: 'expense', category: 'Entertainment', date: '2026-07-22' }
  ];

  let state = {
    user: JSON.parse(localStorage.getItem('fin_os_user')) || { name: 'Guest User', email: 'guest@finance.os', role: 'Visitor' },
    transactions: JSON.parse(localStorage.getItem('fin_os_transactions')) || DEFAULT_TRANSACTIONS,
    categories: JSON.parse(localStorage.getItem('fin_os_categories')) || DEFAULT_CATEGORIES,
    budgetLimit: parseFloat(localStorage.getItem('fin_os_budget')) || 40000,
    goals: JSON.parse(localStorage.getItem('fin_os_goals')) || [
      { id: 'g-1', title: 'New Laptop', target: 75000, current: 25000, deadline: '2026-12-31' }
    ],
    theme: localStorage.getItem('fin_os_theme') || 'dark',
    notifications: JSON.parse(localStorage.getItem('fin_os_notifications')) || [
      { id: 1, title: 'Welcome to Finance OS v2.0', time: 'Just now', unread: true }
    ],
    isBalanceVisible: true,
    filterType: 'all',
    searchQuery: '',
    editingId: null
  };

  // --- DOM ELEMENTS CACHE ---
  const body = document.body;
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');

  // Auth Elements
  const authBtn = document.getElementById('authBtn');
  const authBtnText = document.getElementById('authBtnText');
  const authIcon = document.getElementById('authIcon');
  const userCardBtn = document.getElementById('userCardBtn');
  const userNameDisplay = document.getElementById('userNameDisplay');
  const userRoleDisplay = document.getElementById('userRoleDisplay');
  const headerUserName = document.getElementById('headerUserName');
  const authModal = document.getElementById('authModal');
  const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
  const cancelAuthModalBtn = document.getElementById('cancelAuthModalBtn');
  const authForm = document.getElementById('authForm');
  const authNameInput = document.getElementById('authName');
  const authEmailInput = document.getElementById('authEmail');

  // Dashboard Metrics
  const totalBalanceDisplay = document.getElementById('totalBalanceDisplay');
  const monthlyIncomeDisplay = document.getElementById('monthlyIncomeDisplay');
  const monthlyExpenseDisplay = document.getElementById('monthlyExpenseDisplay');
  const budgetPercentDisplay = document.getElementById('budgetPercentDisplay');
  const budgetRemainingDisplay = document.getElementById('budgetRemainingDisplay');
  const toggleBalanceBtn = document.getElementById('toggleBalanceBtn');
  const eyeIcon = document.getElementById('eyeIcon');

  // Lists & Tables
  const recentTransactionsList = document.getElementById('recentTransactionsList');
  const allTransactionsTableBody = document.getElementById('allTransactionsTableBody');

  // Navigation & Views
  const navItems = document.querySelectorAll('.nav-item, .bottom-nav-item');
  const viewContents = document.querySelectorAll('.view-content');

  // Modals & Forms
  const transactionModal = document.getElementById('transactionModal');
  const openModalBtn = document.getElementById('openModalBtn');
  const addNewTransactionBtn = document.getElementById('addNewTransactionBtn');
  const fabAddBtn = document.getElementById('fabAddBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const transactionForm = document.getElementById('transactionForm');
  const modalTitle = document.getElementById('modalTitle');
  const transTypeSelect = document.getElementById('transType');
  const transTitleInput = document.getElementById('transTitle');
  const transAmountInput = document.getElementById('transAmount');
  const transCategorySelect = document.getElementById('transCategory');
  const transDateInput = document.getElementById('transDate');

  // Goal Elements
  const goalModal = document.getElementById('goalModal');
  const openGoalModalBtn = document.getElementById('openGoalModalBtn');
  const closeGoalModalBtn = document.getElementById('closeGoalModalBtn');
  const cancelGoalModalBtn = document.getElementById('cancelGoalModalBtn');
  const goalForm = document.getElementById('goalForm');
  const goalsGridContainer = document.getElementById('goalsGridContainer');
  const aiInsightsContainer = document.getElementById('aiInsightsContainer');

  // Search & Filters
  const searchInput = document.getElementById('searchInput');
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  const filterChips = document.querySelectorAll('.filter-chip');

  // Notifications
  const notificationsBtn = document.getElementById('notificationsBtn');
  const notificationDropdown = document.getElementById('notificationDropdown');
  const notificationList = document.getElementById('notificationList');
  const notificationDot = document.getElementById('notificationDot');
  const clearNotificationsBtn = document.getElementById('clearNotificationsBtn');

  // Quick Action Buttons
  const addIncomeQuickBtn = document.getElementById('addIncomeQuickBtn');
  const addExpenseQuickBtn = document.getElementById('addExpenseQuickBtn');
  const addCategoryQuickBtn = document.getElementById('addCategoryQuickBtn');
  const exportCSVBtn = document.getElementById('exportCSVBtn');
  const exportCSVSettingsBtn = document.getElementById('exportCSVSettingsBtn');
  const resetDataBtn = document.getElementById('resetDataBtn');
  const resetDataSettingsBtn = document.getElementById('resetDataSettingsBtn');
  const editBudgetBtn = document.getElementById('editBudgetBtn');
  const setBudgetBtnView = document.getElementById('setBudgetBtnView');

  // Custom Dialog Modal Elements
  const customDialogModal = document.getElementById('customDialogModal');
  const customDialogTitle = document.getElementById('customDialogTitle');
  const customDialogBody = document.getElementById('customDialogBody');
  const customDialogInputGroup = document.getElementById('customDialogInputGroup');
  const customDialogInput = document.getElementById('customDialogInput');
  const customDialogOkBtn = document.getElementById('customDialogOkBtn');
  const customDialogCancelBtn = document.getElementById('customDialogCancelBtn');

  // --- CHART INSTANCES ---
  let cashFlowChartInstance = null;
  let budgetGaugeChartInstance = null;
  let categoryChartInstance = null;
  let analyticsCategoryChartInstance = null;

  // --- LOCALSTORAGE SYNC ---
  function saveState() {
    try {
      localStorage.setItem('fin_os_transactions', JSON.stringify(state.transactions));
      localStorage.setItem('fin_os_categories', JSON.stringify(state.categories));
      localStorage.setItem('fin_os_budget', state.budgetLimit);
      localStorage.setItem('fin_os_goals', JSON.stringify(state.goals));
      localStorage.setItem('fin_os_user', JSON.stringify(state.user));
      localStorage.setItem('fin_os_theme', state.theme);
      localStorage.setItem('fin_os_notifications', JSON.stringify(state.notifications));
    } catch (error) {
      console.error('Failed to save state to localStorage:', error);
    }
  }

  // --- SAFE ICON REFRESH ---
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // --- INITIALIZATION ---
  function init() {
    applyTheme();
    updateUserInterface();
    populateCategoryDropdown();
    renderAll();
    setupEventListeners();
  }

  function applyTheme() {
    body.setAttribute('data-theme', state.theme);
    if (state.theme === 'dark') {
      body.classList.add('dark-theme');
      themeIcon.setAttribute('data-lucide', 'sun');
    } else {
      body.classList.remove('dark-theme');
      themeIcon.setAttribute('data-lucide', 'moon');
    }
    refreshIcons();
  }

  function updateUserInterface() {
    userNameDisplay.textContent = state.user.name;
    userRoleDisplay.textContent = state.user.role;
    headerUserName.textContent = state.user.name.split(' ')[0];
    if (state.user.name !== 'Guest User') {
      authBtnText.textContent = 'Logout';
      authIcon.setAttribute('data-lucide', 'log-out');
    } else {
      authBtnText.textContent = 'Login';
      authIcon.setAttribute('data-lucide', 'log-in');
    }
    refreshIcons();
  }

  // --- CUSTOM DIALOG SYSTEM (MEMORY LEAK FIXED) ---
  function showCustomDialog(title, message, isPrompt = false, defaultValue = '') {
    return new Promise((resolve) => {
      customDialogTitle.textContent = title;
      customDialogBody.textContent = message;
      
      const handleOk = () => {
        cleanup();
        customDialogModal.classList.remove('active');
        customDialogModal.setAttribute('aria-hidden', 'true');
        resolve(isPrompt ? customDialogInput.value : true);
      };
      
      const handleCancel = () => {
        cleanup();
        customDialogModal.classList.remove('active');
        customDialogModal.setAttribute('aria-hidden', 'true');
        resolve(isPrompt ? null : false);
      };

      const handleKeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleOk();
        } else if (e.key === 'Escape') {
          handleCancel();
        }
      };

      const cleanup = () => {
        customDialogOkBtn.removeEventListener('click', handleOk);
        customDialogCancelBtn.removeEventListener('click', handleCancel);
        customDialogInput.removeEventListener('keydown', handleKeydown);
      };

      customDialogOkBtn.addEventListener('click', handleOk);
      customDialogCancelBtn.addEventListener('click', handleCancel);

      if (isPrompt) {
        customDialogInputGroup.style.display = 'block';
        customDialogInput.value = defaultValue;
        customDialogCancelBtn.style.display = 'block';
        customDialogInput.addEventListener('keydown', handleKeydown);
        setTimeout(() => customDialogInput.focus(), 50);
      } else {
        customDialogInputGroup.style.display = 'none';
        customDialogCancelBtn.style.display = 'none';
      }

      customDialogModal.classList.add('active');
      customDialogModal.setAttribute('aria-hidden', 'false');
    });
  }

  // --- RENDER MASTER FUNCTION ---
  function renderAll() {
    calculateMetrics();
    renderRecentTransactions();
    renderAllTransactionsTable();
    renderCharts();
    renderNotifications();
    renderGoals();
    renderInsights();
  }

  // --- METRICS CALCULATION ---
  function calculateMetrics() {
    let totalIncome = 0;
    let totalExpense = 0;

    state.transactions.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') totalIncome += amt;
      else totalExpense += amt;
    });

    const netBalance = totalIncome - totalExpense;

    if (state.isBalanceVisible) {
      totalBalanceDisplay.textContent = `₹ ${netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    } else {
      totalBalanceDisplay.textContent = '••••••••';
    }

    monthlyIncomeDisplay.textContent = `₹ ${totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    monthlyExpenseDisplay.textContent = `₹ ${totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const budgetUsedPercent = state.budgetLimit > 0 ? Math.min(Math.round((totalExpense / state.budgetLimit) * 100), 100) : 0;
    const remainingBudget = state.budgetLimit - totalExpense;

    budgetPercentDisplay.textContent = `${budgetUsedPercent}%`;
    budgetRemainingDisplay.textContent = `Remaining: ₹ ${remainingBudget.toLocaleString('en-IN')}`;
  }

  // --- POPULATE CATEGORY DROPDOWN ---
  function populateCategoryDropdown() {
    const selectedType = transTypeSelect.value;
    const filteredCats = state.categories.filter(c => c.type === selectedType);
    transCategorySelect.innerHTML = '';
    filteredCats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = cat.name;
      transCategorySelect.appendChild(opt);
    });
  }

  // --- RENDER TRANSACTIONS ---
  function getFilteredTransactions() {
    const query = state.searchQuery.toLowerCase().trim();
    return state.transactions.filter(t => {
      const matchesFilter = state.filterType === 'all' || t.type === state.filterType;
      const matchesSearch = t.title.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function renderRecentTransactions() {
    const filtered = getFilteredTransactions().slice(0, 5);
    recentTransactionsList.innerHTML = '';

    if (filtered.length === 0) {
      recentTransactionsList.innerHTML = `<p style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 16px;">No transactions recorded yet.</p>`;
      return;
    }

    filtered.forEach(t => {
      const isIncome = t.type === 'income';
      const item = document.createElement('div');
      item.className = 'trans-item';
      item.innerHTML = `
        <div class="trans-info">
          <div class="trans-icon ${isIncome ? 'icon-success' : 'icon-danger'}">
            <i data-lucide="${isIncome ? 'arrow-down-left' : 'arrow-up-right'}" style="width: 18px; height: 18px;"></i>
          </div>
          <div class="trans-details">
            <h4>${escapeHTML(t.title)}</h4>
            <p>${escapeHTML(t.category)} • ${t.date}</p>
          </div>
        </div>
        <div class="trans-amount-wrap">
          <span class="trans-amount ${isIncome ? 'icon-success-text' : 'icon-danger-text'}">
            ${isIncome ? '+' : '-'} ₹ ${parseFloat(t.amount).toLocaleString('en-IN')}
          </span>
          <button class="edit-trans-btn icon-btn-sm" data-id="${t.id}" title="Edit" aria-label="Edit Transaction"><i data-lucide="edit-2" style="width: 14px; height: 14px;"></i></button>
          <button class="delete-trans-btn icon-btn-sm" data-id="${t.id}" title="Delete" aria-label="Delete Transaction"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
        </div>
      `;
      recentTransactionsList.appendChild(item);
    });
    refreshIcons();
  }

  function renderAllTransactionsTable() {
    const filtered = getFilteredTransactions();
    allTransactionsTableBody.innerHTML = '';

    if (filtered.length === 0) {
      allTransactionsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No transaction records found.</td></tr>`;
      return;
    }

    filtered.forEach(t => {
      const isIncome = t.type === 'income';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Date">${t.date}</td>
        <td data-label="Title"><strong>${escapeHTML(t.title)}</strong></td>
        <td data-label="Category">${escapeHTML(t.category)}</td>
        <td data-label="Amount" class="${isIncome ? 'icon-success-text' : 'icon-danger-text'}" style="font-weight: 700;">
          ${isIncome ? '+' : '-'} ₹ ${parseFloat(t.amount).toLocaleString('en-IN')}
        </td>
        <td data-label="Actions">
          <button class="btn-sm edit-trans-btn" data-id="${t.id}"><i data-lucide="edit-2" style="width: 12px;"></i> Edit</button>
          <button class="btn-sm delete-trans-btn" data-id="${t.id}" style="color: var(--error);"><i data-lucide="trash-2" style="width: 12px;"></i> Delete</button>
        </td>
      `;
      allTransactionsTableBody.appendChild(tr);
    });
    refreshIcons();
  }

  // --- GOALS RENDERING ---
  function renderGoals() {
    if (!goalsGridContainer) return;
    goalsGridContainer.innerHTML = '';

    if (state.goals.length === 0) {
      goalsGridContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; grid-column: span 12; padding: 20px;">No savings goals active.</p>`;
      return;
    }

    state.goals.forEach(g => {
      const percent = Math.min(Math.round((g.current / g.target) * 100), 100);
      const card = document.createElement('div');
      card.className = 'glass-card goal-card';
      card.style.cssText = 'grid-column: span 4; display: flex; flex-direction: column; justify-content: space-between;';
      card.innerHTML = `
        <div>
          <div class="card-title-wrap">
            <h3>${escapeHTML(g.title)}</h3>
            <button class="btn-sm delete-goal-btn" data-id="${g.id}" style="color: var(--error); background: transparent; border: none; cursor: pointer;" aria-label="Delete Goal"><i data-lucide="trash-2" style="width: 14px;"></i></button>
          </div>
          <p style="font-size: 13px; color: var(--text-muted);">Target Deadline: ${g.deadline}</p>
          <div style="width: 100%; height: 10px; background: rgba(255, 255, 255, 0.1); border-radius: 5px; overflow: hidden; margin: 14px 0 8px 0;">
            <div style="height: 100%; background: var(--primary, #4f46e5); width: ${percent}%; border-radius: 5px; transition: width 0.4s ease;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; margin-top: 8px;">
            <span>₹ ${parseFloat(g.current).toLocaleString('en-IN')}</span>
            <span style="color: var(--text-muted);">Goal: ₹ ${parseFloat(g.target).toLocaleString('en-IN')} (${percent}%)</span>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm deposit-goal-btn" data-id="${g.id}" style="margin-top: 16px; width: 100%;"><i data-lucide="plus-circle" style="width: 14px;"></i> Add Savings</button>
      `;
      goalsGridContainer.appendChild(card);
    });
    refreshIcons();
  }

  // --- AI SPENDING INSIGHTS RENDERING ---
  function renderInsights() {
    if (!aiInsightsContainer) return;
    aiInsightsContainer.innerHTML = '';

    let totalExpense = 0;
    const catMap = {};
    state.transactions.filter(t => t.type === 'expense').forEach(t => {
      const amt = parseFloat(t.amount);
      totalExpense += amt;
      catMap[t.category] = (catMap[t.category] || 0) + amt;
    });

    const insights = [];

    if (state.budgetLimit > 0) {
      const ratio = totalExpense / state.budgetLimit;
      if (ratio > 0.85) {
        insights.push({
          title: 'Critical Budget Alert',
          desc: `You have consumed over ${Math.round(ratio * 100)}% of your monthly designated budget limit. Consider curbing non-essential expenses.`,
          icon: 'alert-triangle',
          color: 'icon-danger',
          textColor: 'icon-danger-text'
        });
      } else {
        insights.push({
          title: 'Healthy Budget Pace',
          desc: `Your spending is currently within safe limits relative to your ₹ ${state.budgetLimit.toLocaleString('en-IN')} ceiling.`,
          icon: 'check-circle',
          color: 'icon-success',
          textColor: 'icon-success-text'
        });
      }
    }

    for (const [cat, amt] of Object.entries(catMap)) {
      if (totalExpense > 0 && (amt / totalExpense) > 0.35) {
        insights.push({
          title: `High Concentration in ${cat}`,
          desc: `Over ${Math.round((amt / totalExpense) * 100)}% of your total expenses this cycle are directed towards "${cat}".`,
          icon: 'pie-chart',
          color: 'icon-danger',
          textColor: 'icon-danger-text'
        });
      }
    }

    if (insights.length < 2) {
      insights.push({
        title: 'Savings Optimization Tip',
        desc: 'Automating your monthly deposits into designated Goals right after salary credit can accelerate your target timelines by 20%.',
        icon: 'trending-up',
        color: 'icon-success',
        textColor: 'icon-success-text'
      });
    }

    insights.forEach(ins => {
      const box = document.createElement('div');
      box.className = 'insight-alert-box';
      box.style.cssText = 'display: flex; align-items: flex-start; gap: 14px; padding: 16px; border-radius: 14px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border);';
      box.innerHTML = `
        <div style="width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" class="${ins.color}">
          <i data-lucide="${ins.icon}" class="${ins.textColor}" style="width: 20px; height: 20px;"></i>
        </div>
        <div>
          <h4 style="font-size: 15px; font-weight: 700; margin-bottom: 4px;">${ins.title}</h4>
          <p style="font-size: 13px; color: var(--text-muted);">${ins.desc}</p>
        </div>
      `;
      aiInsightsContainer.appendChild(box);
    });
    refreshIcons();
  }

  // --- CHARTS RENDERING ---
  function renderCharts() {
    // 1. Cash Flow Trend Chart
    const cashFlowCtx = document.getElementById('cashFlowChart').getContext('2d');
    const datesMap = {};
    state.transactions.forEach(t => {
      if (!datesMap[t.date]) datesMap[t.date] = { income: 0, expense: 0 };
      if (t.type === 'income') datesMap[t.date].income += parseFloat(t.amount);
      else datesMap[t.date].expense += parseFloat(t.amount);
    });

    const sortedDates = Object.keys(datesMap).sort((a, b) => new Date(a) - new Date(b)).slice(-7);
    const incomeData = sortedDates.map(d => datesMap[d].income);
    const expenseData = sortedDates.map(d => datesMap[d].expense);

    if (cashFlowChartInstance) cashFlowChartInstance.destroy();
    cashFlowChartInstance = new Chart(cashFlowCtx, {
      type: 'line',
      data: {
        labels: sortedDates.length ? sortedDates : ['No Data'],
        datasets: [
          { label: 'Income', data: sortedDates.length ? incomeData : [0], borderColor: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.1)', tension: 0.4, fill: true },
          { label: 'Expense', data: sortedDates.length ? expenseData : [0], borderColor: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.1)', tension: 0.4, fill: true }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom' } } }
    });

    // 2. Budget Gauge Chart
    const budgetCtx = document.getElementById('budgetGaugeChart').getContext('2d');
    let totalExp = 0;
    state.transactions.filter(t => t.type === 'expense').forEach(t => totalExp += parseFloat(t.amount));
    const remBudget = Math.max(state.budgetLimit - totalExp, 0);

    if (budgetGaugeChartInstance) budgetGaugeChartInstance.destroy();
    budgetGaugeChartInstance = new Chart(budgetCtx, {
      type: 'doughnut',
      data: {
        labels: ['Spent', 'Remaining'],
        datasets: [{ data: [totalExp, remBudget], backgroundColor: ['#dc2626', '#059669'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '78%', plugins: { legend: { display: false } } }
    });

    // 3. Category Doughnut Chart
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    const catMap = {};
    state.transactions.filter(t => t.type === 'expense').forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + parseFloat(t.amount);
    });

    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(categoryCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(catMap).length ? Object.keys(catMap) : ['No Data'],
        datasets: [{ data: Object.keys(catMap).length ? Object.values(catMap) : [1], backgroundColor: ['#4f46e5', '#059669', '#f59e0b', '#dc2626', '#8b5cf6', '#ec4899'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
    });

    // 4. Analytics Bar Chart
    const analyticsCtx = document.getElementById('analyticsCategoryChart').getContext('2d');
    if (analyticsCategoryChartInstance) analyticsCategoryChartInstance.destroy();
    analyticsCategoryChartInstance = new Chart(analyticsCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(catMap).length ? Object.keys(catMap) : ['No Data'],
        datasets: [{ label: 'Expense by Category (₹)', data: Object.keys(catMap).length ? Object.values(catMap) : [0], backgroundColor: '#4f46e5', borderRadius: 8 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }

  // --- NOTIFICATIONS RENDERING ---
  function renderNotifications() {
    notificationList.innerHTML = '';
    if (state.notifications.length === 0) {
      notificationList.innerHTML = `<p style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 16px;">No new alerts.</p>`;
      notificationDot.style.display = 'none';
      return;
    }
    notificationDot.style.display = 'block';
    state.notifications.forEach(n => {
      const div = document.createElement('div');
      div.style.cssText = 'padding: 12px 18px; border-bottom: 1px solid var(--glass-border); font-size: 13px;';
      div.innerHTML = `<strong>${escapeHTML(n.title)}</strong><br/><span style="font-size: 11px; color: var(--text-muted);">${n.time}</span>`;
      notificationList.appendChild(div);
    });
  }

  // --- EVENT LISTENERS SETUP ---
  function setupEventListeners() {
    themeToggleBtn.addEventListener('click', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      applyTheme();
      saveState();
    });

    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = item.getAttribute('data-view');
        if (!targetView) return;

        navItems.forEach(nav => nav.classList.remove('active'));
        document.querySelectorAll(`[data-view="${targetView}"]`).forEach(n => n.classList.add('active'));

        viewContents.forEach(view => view.classList.remove('active'));
        const targetViewEl = document.getElementById(`${targetView}View`);
        if (targetViewEl) targetViewEl.classList.add('active');
      });
    });

    toggleBalanceBtn.addEventListener('click', () => {
      state.isBalanceVisible = !state.isBalanceVisible;
      eyeIcon.setAttribute('data-lucide', state.isBalanceVisible ? 'eye' : 'eye-off');
      refreshIcons();
      calculateMetrics();
    });

    notificationsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notificationDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!notificationDropdown.contains(e.target) && !notificationsBtn.contains(e.target)) {
        notificationDropdown.classList.remove('active');
      }
    });

    clearNotificationsBtn.addEventListener('click', () => {
      state.notifications = [];
      saveState();
      renderNotifications();
    });

    authBtn.addEventListener('click', async () => {
      if (state.user.name !== 'Guest User') {
        const confirmLogout = await showCustomDialog('Sign Out', 'Are you sure you want to terminate your current session?', false);
        if (confirmLogout) {
          state.user = { name: 'Guest User', email: 'guest@finance.os', role: 'Visitor' };
          saveState();
          updateUserInterface();
          showCustomDialog('Signed Out', 'You have been safely signed out.');
        }
      } else {
        authModal.classList.add('active');
        authModal.setAttribute('aria-hidden', 'false');
      }
    });

    userCardBtn.addEventListener('click', () => {
      if (state.user.name === 'Guest User') {
        authModal.classList.add('active');
        authModal.setAttribute('aria-hidden', 'false');
      }
    });

    const closeAuthModal = () => {
      authModal.classList.remove('active');
      authModal.setAttribute('aria-hidden', 'true');
    };
    closeAuthModalBtn.addEventListener('click', closeAuthModal);
    cancelAuthModalBtn.addEventListener('click', closeAuthModal);

    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      state.user = { name: authNameInput.value, email: authEmailInput.value, role: 'Verified Member' };
      saveState();
      updateUserInterface();
      closeAuthModal();
      showCustomDialog('Welcome!', `Successfully authenticated as ${state.user.name}.`);
    });

    const openModal = (type = 'expense', editItem = null) => {
      transactionModal.classList.add('active');
      transactionModal.setAttribute('aria-hidden', 'false');
      if (editItem) {
        modalTitle.textContent = 'Edit Record';
        transTypeSelect.value = editItem.type;
        populateCategoryDropdown();
        transTitleInput.value = editItem.title;
        transAmountInput.value = editItem.amount;
        transCategorySelect.value = editItem.category;
        transDateInput.value = editItem.date;
        state.editingId = editItem.id;
      } else {
        modalTitle.textContent = 'Add Transaction';
        transTypeSelect.value = type;
        populateCategoryDropdown();
        transTitleInput.value = '';
        transAmountInput.value = '';
        transDateInput.value = new Date().toISOString().split('T')[0];
        state.editingId = null;
      }
    };

    openModalBtn.addEventListener('click', () => openModal('expense'));
    addNewTransactionBtn.addEventListener('click', () => openModal('expense'));
    fabAddBtn.addEventListener('click', () => openModal('expense'));
    addIncomeQuickBtn.addEventListener('click', () => openModal('income'));
    addExpenseQuickBtn.addEventListener('click', () => openModal('expense'));

    const closeTransModal = () => {
      transactionModal.classList.remove('active');
      transactionModal.setAttribute('aria-hidden', 'true');
    };
    closeModalBtn.addEventListener('click', closeTransModal);
    cancelModalBtn.addEventListener('click', closeTransModal);

    transTypeSelect.addEventListener('change', () => populateCategoryDropdown());

    transactionForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newTrans = {
        id: state.editingId || 't-' + Date.now(),
        title: transTitleInput.value.trim(),
        amount: parseFloat(transAmountInput.value),
        type: transTypeSelect.value,
        category: transCategorySelect.value,
        date: transDateInput.value
      };

      if (state.editingId) {
        const index = state.transactions.findIndex(t => t.id === state.editingId);
        if (index !== -1) state.transactions[index] = newTrans;
      } else {
        state.transactions.unshift(newTrans);
      }

      saveState();
      renderAll();
      closeTransModal();
    });

    const openGoalModal = () => {
      goalModal.classList.add('active');
      goalModal.setAttribute('aria-hidden', 'false');
    };
    const closeGoalModal = () => {
      goalModal.classList.remove('active');
      goalModal.setAttribute('aria-hidden', 'true');
    };

    openGoalModalBtn.addEventListener('click', openGoalModal);
    closeGoalModalBtn.addEventListener('click', closeGoalModal);
    cancelGoalModalBtn.addEventListener('click', closeGoalModal);

    goalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newGoal = {
        id: 'g-' + Date.now(),
        title: document.getElementById('goalTitle').value.trim(),
        target: parseFloat(document.getElementById('goalTarget').value),
        current: parseFloat(document.getElementById('goalCurrent').value) || 0,
        deadline: document.getElementById('goalDeadline').value
      };
      state.goals.push(newGoal);
      saveState();
      renderGoals();
      closeGoalModal();
      goalForm.reset();
    });

    document.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.delete-trans-btn');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        const confirmDel = await showCustomDialog('Confirm Deletion', 'Are you sure you want to remove this ledger entry?', false);
        if (confirmDel) {
          state.transactions = state.transactions.filter(t => t.id !== id);
          saveState();
          renderAll();
        }
      }

      const editBtn = e.target.closest('.edit-trans-btn');
      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const item = state.transactions.find(t => t.id === id);
        if (item) openModal(item.type, item);
      }

      const deleteGoalBtn = e.target.closest('.delete-goal-btn');
      if (deleteGoalBtn) {
        const id = deleteGoalBtn.getAttribute('data-id');
        state.goals = state.goals.filter(g => g.id !== id);
        saveState();
        renderGoals();
      }

      const depositGoalBtn = e.target.closest('.deposit-goal-btn');
      if (depositGoalBtn) {
        const id = depositGoalBtn.getAttribute('data-id');
        const goal = state.goals.find(g => g.id === id);
        if (goal) {
          const val = await showCustomDialog('Add Savings', `Enter amount to add towards "${goal.title}" (₹):`, true, '1000');
          if (val !== null && !isNaN(val) && val.trim() !== '') {
            goal.current += parseFloat(val);
            saveState();
            renderGoals();
          }
        }
      }
    });

    const handleSearch = (e) => {
      state.searchQuery = e.target.value;
      renderRecentTransactions();
      renderAllTransactionsTable();
    };

    searchInput.addEventListener('input', handleSearch);
    mobileSearchInput.addEventListener('input', handleSearch);

    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.filterType = chip.getAttribute('data-filter');
        renderRecentTransactions();
      });
    });

    document.getElementById('resetSearchBtn').addEventListener('click', () => {
      searchInput.value = '';
      mobileSearchInput.value = '';
      state.searchQuery = '';
      state.filterType = 'all';
      filterChips.forEach(c => c.classList.remove('active'));
      const allFilterChip = document.querySelector('[data-filter="all"]');
      if (allFilterChip) allFilterChip.classList.add('active');
      renderAllTransactionsTable();
    });

    const handleBudgetEdit = async () => {
      const val = await showCustomDialog('Configure Budget', 'Enter new monthly expense boundary (₹):', true, state.budgetLimit);
      if (val !== null && !isNaN(val) && val.trim() !== '') {
        state.budgetLimit = parseFloat(val);
        saveState();
        renderAll();
        showCustomDialog('Success', 'Fiscal guardrails updated successfully.');
      }
    };

    editBudgetBtn.addEventListener('click', handleBudgetEdit);
    setBudgetBtnView.addEventListener('click', handleBudgetEdit);

    const handleAddCategory = async () => {
      const catName = await showCustomDialog('Add Category', 'Enter classification name:', true);
      if (catName && catName.trim() !== '') {
        state.categories.push({ id: 'cat-' + Date.now(), name: catName.trim(), type: 'expense' });
        saveState();
        populateCategoryDropdown();
        showCustomDialog('Success', `Category "${catName}" registered successfully.`);
      }
    };

    addCategoryQuickBtn.addEventListener('click', handleAddCategory);
    document.getElementById('addCategorySettingsBtn').addEventListener('click', handleAddCategory);

    const handleExportCSV = () => {
      let csvContent = 'data:text/csv;charset=utf-8,ID,Title,Amount,Type,Category,Date\n';
      state.transactions.forEach(t => {
        csvContent += `${t.id},"${t.title.replace(/"/g, '""')}",${t.amount},${t.type},"${t.category}",${t.date}\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', 'finance_os_report.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    exportCSVBtn.addEventListener('click', handleExportCSV);
    exportCSVSettingsBtn.addEventListener('click', handleExportCSV);

    const handleResetData = async () => {
      const confirmReset = await showCustomDialog('Factory Reset', 'Are you sure you want to revert all system logs back to factory demo defaults?', false);
      if (confirmReset) {
        state.transactions = DEFAULT_TRANSACTIONS;
        state.categories = DEFAULT_CATEGORIES;
        state.budgetLimit = 40000;
        state.goals = [{ id: 'g-1', title: 'New Laptop', target: 75000, current: 25000, deadline: '2026-12-31' }];
        saveState();
        renderAll();
        showCustomDialog('Reset Successful', 'System restored to baseline default templates.');
      }
    };

    resetDataBtn.addEventListener('click', handleResetData);
    resetDataSettingsBtn.addEventListener('click', handleResetData);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g,
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' } [tag] || tag)
    );
  }

  init();
});
