/* ==========================================================================
   FinPulse-OS — views/analytics.js
   Returns the HTML template for the "Analytics" view. Mounted into #pageRoot
   by router.js. Dynamic content inside is filled in by transactions.js
   render functions after mount (see app.js renderEverything()).
   ========================================================================== */

export function template() {
  return `
<section class="page-section" id="analytics">
  <div class="page-section__header">
    <div>
      <h2 class="page-section__title">Deep Analytics</h2>
      <p class="page-section__subtitle">Granular breakdowns of your spending patterns.</p>
    </div>
  </div>
  <div class="card">
    <div class="card__header"><span class="card__title">Expense Breakdown by Category</span></div>
    <div class="chart-card__canvas-wrap chart-card__canvas-wrap--donut">
      <canvas id="categoryPieChart" aria-hidden="true"></canvas>
    </div>
    <div class="legend-list" id="categoryLegend"></div>
  </div>
</section>`;
}
