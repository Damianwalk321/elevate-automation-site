// dashboard-phase-s-hardening.js
//
// Repo-ready hardening layer for the website/dashboard repo.
// Adds:
// - stale truth detection
// - retry/backoff summary sync
// - operator-visible diagnostics panel
// - missing truth / sync failure visibility
//
// Load after dashboard-phase-r-unified-truth.js.

(() => {
  if (window.__ELEVATE_PHASE_S_DASHBOARD_HARDENING__) return;
  window.__ELEVATE_PHASE_S_DASHBOARD_HARDENING__ = true;

  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  const PANEL_ID = "eaPhaseSHardeningPanel";
  const STYLE_ID = "ea-phase-s-style";
  const STALE_MINUTES = 15;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ea-s-panel{
        margin-top:20px;
        border:1px solid rgba(212,175,55,0.14);
        border-radius:18px;
        padding:18px;
        background:linear-gradient(180deg, rgba(212,175,55,0.05), rgba(255,255,255,0.02));
      }
      .ea-s-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;
        margin-top:14px;
      }
      .ea-s-card{
        background:#171717;
        border:1px solid rgba(255,255,255,0.06);
        border-radius:14px;
        padding:14px;
      }
      .ea-s-label{
        font-size:11px;
        text-transform:uppercase;
        letter-spacing:.12em;
        color:#d4af37;
        font-weight:700;
        margin-bottom:8px;
      }
      .ea-s-value{
        font-size:22px;
        line-height:1.08;
        font-weight:800;
        color:#f5f5f5;
      }
      .ea-s-sub{
        margin-top:8px;
        font-size:13px;
        color:#a9a9a9;
        line-height:1.5;
      }
      .ea-s-note{
        margin-top:14px;
        padding:14px 16px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,0.06);
        background:#171717;
        color:#d6d6d6;
        line-height:1.55;
        font-size:14px;
      }
      .ea-s-note.warn{
        border-color:rgba(212,175,55,0.22);
        background:rgba(212,175,55,0.08);
        color:#f3ddb0;
      }
      .ea-s-note.danger{
        border-color:rgba(255,120,120,0.22);
        background:rgba(120,20,20,0.22);
        color:#ffcccc;
      }
      .ea-s-actions{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:12px;
        margin-top:14px;
      }
      .ea-s-btn{
        appearance:none;
        border:1px solid rgba(255,255,255,0.08);
        background:#1a1a1a;
        color:#f2f2f2;
        border-radius:12px;
        padding:14px 16px;
        cursor:pointer;
        font-size:14px;
        text-align:center;
      }
      .ea-s-btn:hover{
        border-color:rgba(212,175,55,0.35);
        background:#212121;
      }
      @media (max-width:1080px){ .ea-s-grid{grid-template-columns:repeat(2,minmax(0,1fr));} }
      @media (max-width:760px){ .ea-s-grid,.ea-s-actions{grid-template-columns:1fr;} }
    `;
    document.head.appendChild(style);
  }

  function getTruth() {
    return NS.accountTruth || NS.state?.get?.("accountTruth", {}) || {};
  }

  function minutesSince(iso) {
    const ts = new Date(iso || "").getTime();
    if (!ts || Number.isNaN(ts)) return null;
    return Math.max(0, Math.floor((Date.now() - ts) / 60000));
  }

  async function fetchSummary() {
    const response = NS.api?.apiFetch
      ? await NS.api.apiFetch("/api/get-dashboard-summary")
      : await fetch("/api/get-dashboard-summary");
    const data = NS.api?.parseJsonSafe
      ? await NS.api.parseJsonSafe(response)
      : await response.json().catch(() => ({}));
    if (!response.ok || !data?.data) {
      throw new Error(data?.error || "Failed to load dashboard summary");
    }
    return data.data;
  }

  function setStatus(text) {
    const boot = document.getElementById("bootStatus");
    if (boot) boot.textContent = text;
  }

  function injectPanel(state) {
    const billing = document.getElementById("billing");
    if (!billing) return;

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.className = "ea-s-panel";
      billing.appendChild(panel);
    }

    const truth = getTruth();
    const syncAge = minutesSince(truth.synced_at);
    const stale = syncAge != null && syncAge >= STALE_MINUTES;
    const diagnosticClass = state.error ? "danger" : stale ? "warn" : "";
    const diagnosticText = state.error
      ? `Sync error: ${state.error}`
      : stale
        ? `Truth may be stale. Last successful sync was ${syncAge} minute(s) ago.`
        : `Truth healthy. Last successful sync ${syncAge == null ? "unknown" : `${syncAge} minute(s) ago`}.`;

    panel.innerHTML = `
      <div class="section-head">
        <div>
          <div class="ea-s-label">Production Hardening</div>
          <h2 style="margin-top:6px;">Diagnostics, retries, and stale-truth visibility.</h2>
          <div class="subtext">This layer helps operators see when account truth is old, missing, or failing to refresh.</div>
        </div>
      </div>

      <div class="ea-s-grid">
        <div class="ea-s-card">
          <div class="ea-s-label">Sync Status</div>
          <div class="ea-s-value">${state.error ? "Error" : stale ? "Stale" : "Healthy"}</div>
          <div class="ea-s-sub">Operator-visible truth freshness.</div>
        </div>
        <div class="ea-s-card">
          <div class="ea-s-label">Last Sync</div>
          <div class="ea-s-value">${clean(truth.synced_at || "—") || "—"}</div>
          <div class="ea-s-sub">Canonical dashboard truth timestamp.</div>
        </div>
        <div class="ea-s-card">
          <div class="ea-s-label">Retry Count</div>
          <div class="ea-s-value">${state.retries}</div>
          <div class="ea-s-sub">Current backoff attempts since last success.</div>
        </div>
        <div class="ea-s-card">
          <div class="ea-s-label">Can Post</div>
          <div class="ea-s-value">${truth.can_post === false ? "No" : "Yes"}</div>
          <div class="ea-s-sub">${clean(truth.plan_name || "Unknown plan")} • ${truth.daily_limit || "?"} posts/day</div>
        </div>
      </div>

      <div class="ea-s-note ${diagnosticClass}">${diagnosticText}</div>

      <div class="ea-s-actions">
        <button id="eaPhaseSRetryBtn" class="ea-s-btn" type="button">Retry Summary Sync</button>
        <button id="eaPhaseSOpenBillingBtn" class="ea-s-btn" type="button">Open Billing Section</button>
      </div>
    `;

    const retryBtn = document.getElementById("eaPhaseSRetryBtn");
    if (retryBtn) retryBtn.onclick = () => retrySync(true);

    const billingBtn = document.getElementById("eaPhaseSOpenBillingBtn");
    if (billingBtn) billingBtn.onclick = () => window.showSection?.("billing");
  }

  const state = {
    retries: 0,
    error: "",
    timer: null
  };

  async function retrySync(manual = false) {
    clearTimeout(state.timer);
    try {
      setStatus(manual ? "Retrying summary sync..." : "Refreshing dashboard truth...");
      await fetchSummary();
      state.retries = 0;
      state.error = "";
      injectPanel(state);
      setStatus("Dashboard truth healthy.");
    } catch (error) {
      state.retries += 1;
      state.error = clean(error?.message || "Unknown summary sync failure");
      injectPanel(state);
      setStatus("Dashboard truth sync failed.");
      const delay = Math.min(30000, 2000 * state.retries);
      state.timer = setTimeout(() => retrySync(false), delay);
    }
  }

  function run() {
    installStyles();
    injectPanel(state);
    const truth = getTruth();
    const syncAge = minutesSince(truth.synced_at);
    if (syncAge == null || syncAge >= STALE_MINUTES) {
      retrySync(false);
    }
  }

  window.addEventListener("elevate:account-truth", () => {
    state.error = "";
    state.retries = 0;
    injectPanel(state);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  setTimeout(run, 1600);
  setTimeout(run, 4200);
})();
