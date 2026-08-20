export function template() {
  return `
<section class="page-section" id="settings">
  <div class="page-section__header">
    <div>
      <h2 class="page-section__title">System Preferences</h2>
      <p class="page-section__subtitle">Account, sample data, import/export, and reset.</p>
    </div>
  </div>

  <div class="grid-two">
    <div class="card" style="display:flex; flex-direction:column; gap:var(--space-4);">
      <div class="card__header"><span class="card__title">Profile</span></div>
      <div class="field">
        <label class="field__label" for="settingsNameInput">Full Name</label>
        <input class="input" type="text" id="settingsNameInput" placeholder="Your name" autocomplete="name">
      </div>
      <div class="field">
        <label class="field__label" for="settingsEmailInput">Email Address</label>
        <input class="input" type="email" id="settingsEmailInput" placeholder="you@example.com" autocomplete="email">
        <p style="font-size:var(--text-xs); color:var(--color-text-muted); margin-top:var(--space-1)">Changing email sends a confirmation link to the new address.</p>
      </div>
      <div style="display:flex; gap:var(--space-3); flex-wrap:wrap">
        <button class="btn btn-primary" id="saveProfileBtn">Save Changes</button>
        <button class="btn btn-danger-outline" id="logoutBtn">Log Out</button>
      </div>
    </div>

    <div class="card" style="display:flex; flex-direction:column; gap:var(--space-4);">
      <div class="card__header"><span class="card__title">Sample data &amp; reset</span></div>
      <p style="font-size:var(--text-sm); color:var(--color-text-secondary); line-height:1.5">
        New here? Load sample data to explore charts, budgets, and net worth.
        Ready for real numbers? Reset clears everything so you can start fresh.
      </p>
      <div class="settings-actions">
        <button type="button" class="btn btn-primary" data-action="load-demo">
          Load sample data
        </button>
        <button type="button" class="btn btn-secondary" data-action="reset-and-demo">
          Reset &amp; load sample
        </button>
        <button type="button" class="btn btn-danger-outline" data-action="reset-all">
          Reset all data
        </button>
      </div>
      <p id="dataActionStatus" class="settings-status" role="status"></p>
      <p style="font-size:var(--text-xs); color:var(--color-text-muted)">
        <strong>Load sample</strong> works on empty accounts only.
        <strong>Reset &amp; load sample</strong> deletes your current data, then fills demo numbers.
        <strong>Reset all</strong> only deletes — leaves a blank workspace.
      </p>
    </div>
  </div>

  <div class="card" style="margin-top:var(--space-5); display:flex; flex-direction:column; gap:var(--space-4);">
    <div class="card__header"><span class="card__title">Import / export</span></div>
    <p style="font-size:var(--text-sm); color:var(--color-text-secondary)">CSV needs columns: Date, Title, Category, Type, Amount (Notes optional). JSON is a full backup of this account.</p>
    <div class="settings-actions">
      <button class="btn btn-secondary" data-action="export-csv">Export CSV</button>
      <button class="btn btn-secondary" data-action="export-json">Full backup (JSON)</button>
      <label class="btn btn-primary" style="cursor:pointer; margin:0;">
        Import CSV
        <input type="file" id="csvImportInput" accept=".csv,text/csv" hidden>
      </label>
    </div>
    <p id="importStatus" style="font-size:var(--text-xs); color:var(--color-text-muted)"></p>
  </div>

  <div class="card" style="margin-top:var(--space-5);">
    <div class="card__header"><span class="card__title">Recurring Transactions</span></div>
    <p style="font-size:var(--text-sm); color:var(--color-text-secondary); margin-bottom:var(--space-3);">Set up a repeat when adding a transaction. Manage active rules here.</p>
    <div id="recurringList"></div>
  </div>
</section>`;
}
