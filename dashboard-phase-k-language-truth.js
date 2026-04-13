
(() => {
  if (window.__ELEVATE_PHASE_K_LANGUAGE_TRUTH__) return;
  window.__ELEVATE_PHASE_K_LANGUAGE_TRUTH__ = true;

  const STYLE_ID = "ea-phase-k-style";

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ea-k-note{
        margin-top:14px;
        padding:14px 16px;
        border-radius:14px;
        border:1px solid rgba(212,175,55,0.16);
        background:linear-gradient(180deg, rgba(212,175,55,0.08), rgba(255,255,255,0.02));
        color:#e9e9e9;
        line-height:1.55;
        font-size:14px;
      }
      .ea-k-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:12px;
        margin-top:14px;
      }
      .ea-k-card{
        background:#171717;
        border:1px solid rgba(255,255,255,0.06);
        border-radius:14px;
        padding:14px;
      }
      .ea-k-label{
        font-size:11px;
        text-transform:uppercase;
        letter-spacing:.12em;
        color:#d4af37;
        font-weight:700;
        margin-bottom:8px;
      }
      .ea-k-value{
        font-size:22px;
        line-height:1.08;
        font-weight:800;
        color:#f5f5f5;
      }
      .ea-k-sub{
        margin-top:8px;
        font-size:13px;
        color:#a9a9a9;
        line-height:1.5;
      }
      .ea-k-inline-pill{
        display:inline-flex;
        align-items:center;
        min-height:30px;
        padding:0 10px;
        border-radius:999px;
        background:rgba(212,175,55,0.12);
        border:1px solid rgba(212,175,55,0.2);
        color:#f3ddb0;
        font-size:12px;
        font-weight:700;
      }
      @media (max-width:900px){
        .ea-k-grid{grid-template-columns:1fr;}
      }
    `;
    document.head.appendChild(style);
  }

  function getPlanTruth() {
    const candidates = [
      clean(document.getElementById("planNameBilling")?.textContent || ""),
      clean(document.getElementById("extensionPlan")?.textContent || ""),
      clean(document.getElementById("overviewPlanChip")?.textContent || ""),
      clean(document.getElementById("subscriptionStatusBilling")?.textContent || "")
    ].filter(Boolean);

    const haystack = candidates.join(" ").toLowerCase();

    if (haystack.includes("pro")) {
      return {
        planName: "Pro",
        dailyLimit: 25,
        monthlyLabel: "$79/month",
        upgradeLabel: "Higher-volume tier active"
      };
    }

    return {
      planName: "Starter",
      dailyLimit: 5,
      monthlyLabel: "$49/month",
      upgradeLabel: "Upgrade to Pro for 25/day"
    };
  }

  function replaceText(el, value) {
    if (!el) return;
    if (clean(el.textContent || "") === value) return;
    el.textContent = value;
  }

  function normalizePrimaryLabels(truth) {
    replaceText(document.getElementById("overviewPlanChip"), truth.planName);
    replaceText(document.getElementById("extensionPlan"), truth.planName);
    replaceText(document.getElementById("planNameBilling"), truth.planName);

    const statusEl = document.getElementById("subscriptionStatusBilling");
    if (statusEl) {
      const current = clean(statusEl.textContent || "").toLowerCase();
      if (!current || current.includes("founder beta")) {
        statusEl.textContent = "Trial Active";
      }
    }

    const accessBadge = document.getElementById("accessBadgeBilling");
    if (accessBadge) {
      const current = clean(accessBadge.textContent || "").toLowerCase();
      if (!current || current.includes("loading") || current.includes("founder")) {
        accessBadge.textContent = "Active";
        accessBadge.className = "badge active";
      }
    }

    const overviewAccessChip = document.getElementById("overviewAccessChip");
    if (overviewAccessChip) {
      const current = clean(overviewAccessChip.textContent || "").toLowerCase();
      if (!current || current.includes("founder")) {
        overviewAccessChip.textContent = "Trial Active";
      }
    }
  }

  function normalizeUsageLabels(truth) {
    const limitEl = document.getElementById("extensionPostLimit");
    if (limitEl) {
      const txt = clean(limitEl.textContent || "");
      if (!txt || txt.toLowerCase().includes("loading") || txt.toLowerCase().includes("founder")) {
        limitEl.textContent = `${truth.dailyLimit} posts/day`;
      }
    }

    const postsUsedEl = document.getElementById("commandPostsUsed");
    if (postsUsedEl) {
      const current = clean(postsUsedEl.textContent || "");
      if (/0\s*\/\s*0/.test(current)) {
        postsUsedEl.textContent = `0 / ${truth.dailyLimit}`;
      }
    }

    const kpiRemaining = document.getElementById("kpiPostsRemaining");
    if (kpiRemaining) {
      const current = clean(kpiRemaining.textContent || "");
      if (!current || current === "0") {
        kpiRemaining.textContent = String(truth.dailyLimit);
      }
    }

    const snapshotRemaining = document.getElementById("snapshotPostsRemaining");
    if (snapshotRemaining) {
      const current = clean(snapshotRemaining.textContent || "");
      if (!current || /loading/i.test(current)) {
        snapshotRemaining.textContent = `${truth.dailyLimit} available at reset`;
      }
    }
  }

  function normalizeUpgradePanels(truth) {
    const targets = [
      document.getElementById("overviewUpgradePanel"),
      document.getElementById("toolsUpgradePanel"),
      document.getElementById("analyticsUpgradePanel")
    ].filter(Boolean);

    targets.forEach((target) => {
      const text = clean(target.textContent || "").toLowerCase();
      if (!text || text.includes("loading") || text.includes("founder beta") || text.includes("founder")) {
        target.innerHTML = `
          <div class="ea-k-note">
            <strong>${truth.planName}</strong> is the current visible plan truth for this account.
            Daily capacity should resolve to <strong>${truth.dailyLimit} posts/day</strong>.
            ${truth.planName === "Starter"
              ? `The next commercial unlock is <strong>Pro</strong> at <strong>$79/month</strong> for <strong>25 posts/day</strong>.`
              : `This account is already on the higher-volume plan path with <strong>25 posts/day</strong>.`}
          </div>
        `;
      }
    });

    const overviewUpgradeBtn = document.getElementById("overviewUpgradeBtn");
    if (overviewUpgradeBtn && truth.planName === "Pro") {
      overviewUpgradeBtn.textContent = "View Current Leverage";
    }

    const toolsUpgradeBtn = document.getElementById("toolsUpgradeBtn");
    if (toolsUpgradeBtn && truth.planName === "Pro") {
      toolsUpgradeBtn.textContent = "View Pro Access";
    }

    const analyticsUpgradeBtn = document.getElementById("analyticsUpgradeBtn");
    if (analyticsUpgradeBtn && truth.planName === "Pro") {
      analyticsUpgradeBtn.textContent = "View Premium Analytics";
    }
  }

  function injectCommercialTruthPanel(truth) {
    const billing = document.getElementById("billing");
    if (!billing) return;

    let panel = document.getElementById("eaPhaseKCommercialTruth");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "eaPhaseKCommercialTruth";
      panel.className = "card";
      panel.style.marginTop = "20px";
      billing.appendChild(panel);
    }

    panel.innerHTML = `
      <div class="section-head">
        <div>
          <div class="ea-k-label">Plan Truth Layer</div>
          <h2 style="margin-top:6px;">Commercial state should read the same everywhere.</h2>
          <div class="subtext">This layer forces one visible truth across overview, tools, billing, and upgrade messaging.</div>
        </div>
      </div>
      <div class="ea-k-grid">
        <div class="ea-k-card">
          <div class="ea-k-label">Visible Plan</div>
          <div class="ea-k-value">${truth.planName}</div>
          <div class="ea-k-sub">Primary plan label shown to the user.</div>
        </div>
        <div class="ea-k-card">
          <div class="ea-k-label">Daily Limit</div>
          <div class="ea-k-value">${truth.dailyLimit}</div>
          <div class="ea-k-sub">Posting capacity that should match worker, dashboard, and extension truth.</div>
        </div>
        <div class="ea-k-card">
          <div class="ea-k-label">Commercial Path</div>
          <div class="ea-k-value">${truth.monthlyLabel}</div>
          <div class="ea-k-sub">${truth.upgradeLabel}</div>
        </div>
      </div>
      <div class="ea-k-note">
        Old Founder wording should not leak into plan chips, billing labels, tool panels, or upgrade copy.
        This patch keeps the visible account state anchored to <span class="ea-k-inline-pill">${truth.planName}</span>
        and <span class="ea-k-inline-pill">${truth.dailyLimit} posts/day</span>.
      </div>
    `;
  }

  function normalizeBundleIBillingFallback(truth) {
    const shell = document.getElementById("bundleIBillingShell");
    if (!shell) return;
    const textNodes = shell.querySelectorAll("*");
    textNodes.forEach((node) => {
      if (!node || !node.textContent) return;
      const txt = clean(node.textContent);
      if (txt === "Founder Beta") {
        node.textContent = truth.planName;
      }
    });
  }

  function run() {
    installStyles();
    const truth = getPlanTruth();
    normalizePrimaryLabels(truth);
    normalizeUsageLabels(truth);
    normalizeUpgradePanels(truth);
    injectCommercialTruthPanel(truth);
    normalizeBundleIBillingFallback(truth);
  }

  let observer = null;
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(() => run());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      run();
      startObserver();
    }, { once: true });
  } else {
    run();
    startObserver();
  }

  setTimeout(run, 800);
  setTimeout(run, 2200);
  setTimeout(run, 4200);
})();
