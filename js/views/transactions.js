/* ==========================================================================
   FinPulse-OS — views/transactions.js
   Returns the HTML template for the "Transactions" view. Mounted into #pageRoot
   by router.js. Dynamic content inside is filled in by transactions.js
   render functions after mount (see app.js renderEverything()).
   ========================================================================== */

export function template() {
  return `
<section class="page-section" id="transactions">
  <div class="page-section__header">
    <div>
      <h2 class="page-section__title">All Transactions</h2>
      <p class="page-section__subtitle">Complete history of your income and expenses.</p>
    </div>
    <div style="display:flex; gap: var(--space-3)">
      <button class="btn btn-secondary btn-sm" data-action="reset-filters">Reset Filters</button>
      <button class="btn btn-primary btn-sm" data-action="add-transaction">+ Add New</button>
    </div>
  </div>
  <div class="card">
    <table class="table">
      <thead>
        <tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th>Actions</th></tr>
      </thead>
      <tbody id="allTransactionsBody">
        <tr>
          <td>Aug 14</td>
          <td class="table-row-icon"><span class="icon-badge"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6"/></svg></span> Grocery Store</td>
          <td><span class="badge badge--neutral">Food</span></td>
          <td style="color:var(--color-danger)">&minus;&#8377;1,240</td>
          <td><button class="btn btn-ghost btn-sm">Edit</button></td>
        </tr>
      </tbody>
    </table>
    <div class="pagination" id="txPagination"></div>
  </div>
</section>`;
}
