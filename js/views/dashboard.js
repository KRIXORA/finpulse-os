/* ==========================================================================
   FinPulse-OS — views/dashboard.js
   Returns the HTML template for the "Dashboard" view. Mounted into #pageRoot
   by router.js. Dynamic content inside is filled in by transactions.js
   render functions after mount (see app.js renderEverything()).
   ========================================================================== */

export function template() {
  return `
<section class="page-section" id="dashboard">
  <div class="page-section__header">
    <div>
      <h1 class="page-section__title">Welcome back</h1>
      <p class="page-section__subtitle" id="dashboardSubtitle">Here's your financial overview.</p>
    </div>
  </div>

  <div class="grid-stats">
    <div class="card stat-card">
      <div class="stat-card__top">
        <span class="stat-card__label">Total Balance</span>
        <div class="stat-card__icon stat-card__icon--accent"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z"/><path d="M16 7V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2"/><circle cx="16" cy="13" r="1.5"/></svg></div>
      </div>
      <div class="stat-card__value stat-card__value--accent" id="statBalance">&#8377;0</div>
      <div class="stat-card__meta">Across all accounts</div>
    </div>

    <div class="card stat-card">
      <div class="stat-card__top">
        <span class="stat-card__label">Monthly Income</span>
        <div class="stat-card__icon stat-card__icon--success"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="6 11 12 5 18 11"/></svg></div>
      </div>
      <div class="stat-card__value" id="statIncome">&#8377;0</div>
      <div class="stat-card__meta" id="statIncomeDelta"></div>
    </div>

    <div class="card stat-card">
      <div class="stat-card__top">
        <span class="stat-card__label">Monthly Expense</span>
        <div class="stat-card__icon stat-card__icon--danger"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="18 13 12 19 6 13"/></svg></div>
      </div>
      <div class="stat-card__value" id="statExpense">&#8377;0</div>
      <div class="stat-card__meta" id="statExpenseDelta"></div>
    </div>
  </div>

  <div class="grid-charts">
    <div class="card">
      <div class="card__header">
        <span class="card__title">Cash Flow Trend</span>
        <div class="tab-group">
          <span class="tab is-active">1M</span>
          <span class="tab">3M</span>
          <span class="tab">1Y</span>
        </div>
      </div>
      <div class="chart-card__canvas-wrap">
        <canvas id="cashFlowChart" role="img" aria-label="Cash flow trend chart"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="card__header">
        <span class="card__title">Budget Gauge</span>
        <button class="btn btn-ghost btn-sm">Edit</button>
      </div>
      <div class="gauge-wrap">
        <div class="gauge">
          <canvas id="budgetGauge" aria-hidden="true"></canvas>
          <div class="gauge__value">
            <div class="gauge__percent">46%</div>
            <div class="gauge__label">Used</div>
          </div>
        </div>
        <div class="gauge__remaining">Remaining: &#8377;25,660</div>
      </div>
    </div>
  </div>

  <div class="grid-charts">
    <!-- Recent transactions -->
    <div class="card">
      <div class="card__header">
        <span class="card__title">Recent Transactions</span>
        <div class="tab-group">
          <span class="tab is-active">All</span>
          <span class="tab">Income</span>
          <span class="tab">Expense</span>
        </div>
      </div>
      <table class="table">
        <thead>
          <tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th></tr>
        </thead>
        <tbody id="recentTransactionsBody">
          <tr>
            <td>Aug 14</td>
            <td class="table-row-icon"><span class="icon-badge"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6"/></svg></span> Grocery Store</td>
            <td><span class="badge badge--neutral">Food</span></td>
            <td style="color:var(--color-danger)">&minus;&#8377;1,240</td>
          </tr>
          <tr>
            <td>Aug 12</td>
            <td class="table-row-icon"><span class="icon-badge"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span> Freelance Payment</td>
            <td><span class="badge badge--neutral">Income</span></td>
            <td style="color:var(--color-success)">+&#8377;15,000</td>
          </tr>
          <tr>
            <td>Aug 10</td>
            <td class="table-row-icon"><span class="icon-badge"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="7" y1="4" x2="7" y2="20"/><line x1="17" y1="4" x2="17" y2="20"/><line x1="3" y1="9" x2="7" y2="9"/><line x1="3" y1="15" x2="7" y2="15"/><line x1="17" y1="9" x2="21" y2="9"/><line x1="17" y1="15" x2="21" y2="15"/></svg></span> Netflix</td>
            <td><span class="badge badge--neutral">Entertainment</span></td>
            <td style="color:var(--color-danger)">&minus;&#8377;499</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Spending category -->
    <div class="card">
      <div class="card__header">
        <span class="card__title">Spending Category</span>
      </div>
      <div class="category-list" id="categoryList">
        <div class="category-row">
          <div class="category-row__info">
            <div class="category-row__top">
              <span class="category-row__name">Food & Groceries</span>
              <span class="category-row__amount">&#8377;8,200</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:62%"></div></div>
          </div>
        </div>
        <div class="category-row">
          <div class="category-row__info">
            <div class="category-row__top">
              <span class="category-row__name">Transport</span>
              <span class="category-row__amount">&#8377;3,400</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:34%"></div></div>
          </div>
        </div>
        <div class="category-row">
          <div class="category-row__info">
            <div class="category-row__top">
              <span class="category-row__name">Entertainment</span>
              <span class="category-row__amount">&#8377;1,900</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:18%"></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;
}
