/* ==========================================================================
   FinPulse-OS — views/settings.js
   Returns the HTML template for the "Settings" view. Mounted into #pageRoot
   by router.js. Dynamic content inside is filled in by transactions.js
   render functions after mount (see app.js renderEverything()).
   ========================================================================== */

export function template() {
  return `
<section class="page-section" id="settings">
  <div class="page-section__header">
    <div>
      <h2 class="page-section__title">System Preferences</h2>
      <p class="page-section__subtitle">Manage your account details and data.</p>
    </div>
  </div>
  <div class="card" style="display:flex; flex-direction:column; gap:var(--space-4); max-width:480px;">
    <div class="field">
      <label class="field__label" for="settingsNameInput">Full Name</label>
      <input class="input" type="text" id="settingsNameInput" placeholder="Your name">
    </div>
    <div class="field">
      <label class="field__label" for="settingsEmailInput">Email Address</label>
      <input class="input" type="email" id="settingsEmailInput" placeholder="you@example.com">
      <p style="font-size:var(--text-xs); color:var(--color-text-muted); margin-top:var(--space-1)">Changing this sends a confirmation link to the new address.</p>
    </div>
    <div style="display:flex; gap:var(--space-3); flex-wrap:wrap">
      <button class="btn btn-primary" id="saveProfileBtn">Save Changes</button>
      <button class="btn btn-secondary">Export CSV Report</button>
      <button class="btn btn-danger-outline" id="logoutBtn">Log Out</button>
    </div>
  </div>
</section>`;
}
