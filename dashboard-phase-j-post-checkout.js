
(() => {
  if (window.__ELEVATE_PHASE_J_POST_CHECKOUT__) return;
  window.__ELEVATE_PHASE_J_POST_CHECKOUT__ = true;

  const STYLE_ID = "ea-phase-j-style";

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function money(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return "$0";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0
    }).format(num);
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ea-j-trial-shell{
        display:grid;
        gap:18px;
        margin-bottom:20px;
      }
      .ea-j-trial-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:14px;
      }
      .ea-j-trial-card{
        background:linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
        border:1px solid rgba(212,175,55,0.14);
        border-radius:16px;
        padding:16px;
        box-shadow:0 10px 30px rgba(0,0,0,0.22);
      }
      .ea-j-label{
        font-size:11px;
        text-transform:uppercase;
        letter-spacing:0.12em;
        color:#d4af37;
        font-weight:700;
        margin-bottom:8px;
      }
      .ea-j-value{
        font-size:24px;
        line-height:1.08;
        font-weight:800;
        color:#f5f5f5;
      }
      .ea-j-sub{
        margin-top:8px;
        font-size:13px;
        color:#a9a9a9;
        line-height:1.5;
      }
      .ea-j-banner{
        display:flex;
        justify-content:space-between;
        gap:16px;
        align-items:flex-start;
        padding:18px;
        border-radius:16px;
        border:1px solid rgba(212,175,55,0.18);
        background:linear-gradient(180deg, rgba(212,175,55,0.08), rgba(255,255,255,0.02));
      }
      .ea-j-banner-copy{
        display:grid;
        gap:8px;
      }
      .ea-j-chip-row{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }
      .ea-j-chip{
        display:inline-flex;
        align-items:center;
        min-height:36px;
        padding:0 12px;
        border-radius:999px;
        background:rgba(212,175,55,0.12);
        border:1px solid rgba(212,175,55,0.2);
        color:#f3ddb0;
        font-size:12px;
        font-weight:700;
        white-space:nowrap;
      }
      .ea-j-chip.success{
        background:rgba(46,125,50,0.18);
        border-color:rgba(157,232,168,0.22);
        color:#9de8a8;
      }
      .ea-j-billing-note{
        margin-top:14px;
        padding:14px 16px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,0.06);
        background:#171717;
        color:#d6d6d6;
        line-height:1.55;
        font-size:14px;
      }
      .ea-j-cta-row{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:12px;
        margin-top:14px;
      }
      .ea-j-inline-btn{
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
      .ea-j-inline-btn:hover{
        border-color:rgba(212,175,55,0.35);
        background:#212121;
      }
      @media (max-width: 1080px){
        .ea-j-trial-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
      }
      @media (max-width: 760px){
        .ea-j-trial-grid,.ea-j-cta-row{grid-template-columns:1fr;}
        .ea-j-banner{flex-direction:column;align-items:flex-start;}
      }
    `;
    document.head.appendChild(style);
  }

  function parseCheckoutState() {
    const params = new URLSearchParams(window.location.search);
    return {
      checkoutSuccess: params.get("checkout") === "success",
      checkoutCancelled: params.get("checkout") === "cancelled"
    };
  }

  function getPlanSnapshot() {
    const planText = clean(
      document.getElementById("planNameBilling")?.textContent ||
      document.getElementById("overviewPlanChip")?.textContent ||
      document.getElementById("extensionPlan")?.textContent ||
      ""
    ).toLowerCase();

    const accessText = clean(
      document.getElementById("subscriptionStatusBilling")?.textContent ||
      document.getElementById("accessBadgeBilling")?.textContent ||
      document.getElementById("overviewAccessChip")?.textContent ||
      ""
    ).toLowerCase();

    let planName = "Starter";
    let monthly = 49;
    let dailyLimit = 5;

    if (planText.includes("pro")) {
      planName = "Pro";
      monthly = 79;
      dailyLimit = 25;
    } else if (planText.includes("starter")) {
      planName = "Starter";
      monthly = 49;
      dailyLimit = 5;
    }

    const trialActive =
      window.location.search.includes("checkout=success") ||
      accessText.includes("trial") ||
      accessText.includes("active") ||
      clean(document.getElementById("accountStatusBilling")?.textContent || "").toLowerCase().includes("trial");

    return {
      planName,
      monthly,
      dailyLimit,
      trialActive
    };
  }

  function formatTrialDate() {
    const fixed = new Date("2026-04-20T00:00:00Z");
    return fixed.toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function renderOverviewTrialShell() {
    const overview = document.getElementById("overview");
    const commandCenter = overview?.querySelector(".command-center-grid");
    if (!overview || !commandCenter) return;

    const existing = document.getElementById("eaPhaseJTrialShell");
    if (existing) existing.remove();

    const checkout = parseCheckoutState();
    const snapshot = getPlanSnapshot();

    const shell = document.createElement("div");
    shell.id = "eaPhaseJTrialShell";
    shell.className = "ea-j-trial-shell";
    shell.innerHTML = `
      <div class="ea-j-banner">
        <div class="ea-j-banner-copy">
          <div class="ea-j-label">Post-Checkout State</div>
          <div class="ea-j-value">${checkout.checkoutSuccess ? "Your trial is live." : "Your account billing state is synced."}</div>
          <div class="ea-j-sub">
            ${checkout.checkoutSuccess
              ? `You can now finish setup, connect your inventory flow, and start testing the real workflow on <strong>${snapshot.planName}</strong>.`
              : `This panel shows the active plan, expected daily posting capacity, and the next billing expectation for <strong>${snapshot.planName}</strong>.`}
          </div>
        </div>
        <div class="ea-j-chip-row">
          <div class="ea-j-chip success">${snapshot.planName} Active</div>
          <div class="ea-j-chip">${snapshot.dailyLimit} posts/day</div>
          <div class="ea-j-chip">Trial through ${formatTrialDate()}</div>
        </div>
      </div>

      <div class="ea-j-trial-grid">
        <div class="ea-j-trial-card">
          <div class="ea-j-label">Current Plan</div>
          <div class="ea-j-value">${snapshot.planName}</div>
          <div class="ea-j-sub">This should match billing, dashboard access, and extension account truth.</div>
        </div>
        <div class="ea-j-trial-card">
          <div class="ea-j-label">Daily Capacity</div>
          <div class="ea-j-value">${snapshot.dailyLimit}</div>
          <div class="ea-j-sub">Expected post limit per day under the current plan.</div>
        </div>
        <div class="ea-j-trial-card">
          <div class="ea-j-label">Trial End</div>
          <div class="ea-j-value">${formatTrialDate()}</div>
          <div class="ea-j-sub">If the current date is still before April 20, billing should not start yet.</div>
        </div>
        <div class="ea-j-trial-card">
          <div class="ea-j-label">Expected Monthly</div>
          <div class="ea-j-value">${money(snapshot.monthly)}</div>
          <div class="ea-j-sub">Expected recurring plan amount after trial based on the selected tier.</div>
        </div>
      </div>
    `;
    commandCenter.parentNode.insertBefore(shell, commandCenter);
  }

  function enhanceBillingSection() {
    const billingSection = document.getElementById("billing");
    if (!billingSection) return;
    let panel = document.getElementById("eaPhaseJBillingPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "eaPhaseJBillingPanel";
      panel.className = "card";
      panel.style.marginTop = "20px";
      panel.innerHTML = `
        <div class="section-head">
          <div>
            <div class="ea-j-label">Trial & Billing Clarity</div>
            <h2 style="margin-top:6px;">What happens after checkout</h2>
            <div class="subtext">Make plan state, trial timing, and next billing expectations obvious to the user.</div>
          </div>
        </div>
        <div id="eaPhaseJBillingBody"></div>
      `;
      billingSection.appendChild(panel);
    }

    const snapshot = getPlanSnapshot();
    const checkout = parseCheckoutState();
    const body = panel.querySelector("#eaPhaseJBillingBody");
    if (!body) return;

    body.innerHTML = `
      <div class="ea-j-trial-grid">
        <div class="ea-j-trial-card">
          <div class="ea-j-label">Plan</div>
          <div class="ea-j-value">${snapshot.planName}</div>
          <div class="ea-j-sub">Starter should resolve to 5/day. Pro should resolve to 25/day.</div>
        </div>
        <div class="ea-j-trial-card">
          <div class="ea-j-label">Expected Limit</div>
          <div class="ea-j-value">${snapshot.dailyLimit}/day</div>
          <div class="ea-j-sub">Use this to confirm dashboard truth matches the extension and worker limits.</div>
        </div>
        <div class="ea-j-trial-card">
          <div class="ea-j-label">Trial Through</div>
          <div class="ea-j-value">${formatTrialDate()}</div>
          <div class="ea-j-sub">This is the live public trial window currently promised on the landing page.</div>
        </div>
        <div class="ea-j-trial-card">
          <div class="ea-j-label">Next Expected Billing</div>
          <div class="ea-j-value">${money(snapshot.monthly)}</div>
          <div class="ea-j-sub">Expected recurring charge once the public trial window ends.</div>
        </div>
      </div>

      <div class="ea-j-billing-note">
        ${checkout.checkoutSuccess
          ? "Checkout success is present in the URL. This is the best place to reassure the user that their trial is active, their plan is recognized, and the next step is finishing setup and opening the tool."
          : "Use this section to verify post-checkout truth: plan label, status label, extension access, and posting limit should all resolve consistently."}
      </div>

      <div class="ea-j-cta-row">
        <button class="ea-j-inline-btn" type="button" id="eaPhaseJRefreshBillingBtn">Refresh Billing Data</button>
        <button class="ea-j-inline-btn" type="button" id="eaPhaseJOpenSetupBtn">Finish Setup</button>
      </div>
    `;

    const refreshBtn = document.getElementById("eaPhaseJRefreshBillingBtn");
    if (refreshBtn) refreshBtn.onclick = () => document.getElementById("refreshBillingBtn")?.click();

    const setupBtn = document.getElementById("eaPhaseJOpenSetupBtn");
    if (setupBtn) setupBtn.onclick = () => window.showSection?.("profile");
  }

  function normalizeLanguage() {
    const replaceText = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      const current = clean(el.textContent || "");
      if (!current) return;
      if (/founder beta/i.test(current)) el.textContent = value;
    };

    replaceText("overviewPlanChip", "Starter");
    replaceText("extensionPlan", "Starter");
    replaceText("planNameBilling", "Starter");

    const status = document.getElementById("subscriptionStatusBilling");
    if (status) {
      const txt = clean(status.textContent || "");
      if (/founder beta/i.test(txt)) status.textContent = "Trial Active";
    }
  }

  function run() {
    installStyles();
    normalizeLanguage();
    renderOverviewTrialShell();
    enhanceBillingSection();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
  setTimeout(run, 800);
  setTimeout(run, 2200);
  setTimeout(run, 4200);
})();
