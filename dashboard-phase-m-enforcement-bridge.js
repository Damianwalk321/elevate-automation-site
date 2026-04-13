
(() => {
  if (window.__ELEVATE_PHASE_M_ENFORCEMENT_BRIDGE__) return;
  window.__ELEVATE_PHASE_M_ENFORCEMENT_BRIDGE__ = true;

  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  const STYLE_ID = "ea-phase-m-style";
  const STORAGE_KEYS = {
    canonical: "elevate.account_truth.v1",
    extension: "elevate.extension_account_truth.v1",
    postingGate: "elevate.posting_gate_truth.v1",
    sessionBridge: "elevate.session_bridge_truth.v1"
  };

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function money(value) {
    const n = safeNumber(value, 0);
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0
    }).format(n);
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ea-m-bridge-card{
        margin-top:20px;
        border:1px solid rgba(212,175,55,0.14);
        border-radius:18px;
        padding:18px;
        background:linear-gradient(180deg, rgba(212,175,55,0.06), rgba(255,255,255,0.02));
      }
      .ea-m-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;
        margin-top:14px;
      }
      .ea-m-cell{
        background:#171717;
        border:1px solid rgba(255,255,255,0.06);
        border-radius:14px;
        padding:14px;
      }
      .ea-m-label{
        font-size:11px;
        text-transform:uppercase;
        letter-spacing:.12em;
        color:#d4af37;
        font-weight:700;
        margin-bottom:8px;
      }
      .ea-m-value{
        font-size:22px;
        line-height:1.08;
        font-weight:800;
        color:#f5f5f5;
      }
      .ea-m-sub{
        margin-top:8px;
        font-size:13px;
        color:#a9a9a9;
        line-height:1.5;
      }
      .ea-m-note{
        margin-top:14px;
        padding:14px 16px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,0.06);
        background:#171717;
        color:#d6d6d6;
        line-height:1.55;
        font-size:14px;
      }
      @media (max-width:1100px){
        .ea-m-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
      }
      @media (max-width:760px){
        .ea-m-grid{grid-template-columns:1fr;}
      }
    `;
    document.head.appendChild(style);
  }

  function getEmailGuess() {
    return clean(
      NS.state?.get?.("user.email", "") ||
      document.querySelector(".user-email")?.textContent ||
      ""
    );
  }

  async function fetchDashboardSummary() {
    if (NS.api?.apiFetch) {
      const response = await NS.api.apiFetch("/api/get-dashboard-summary");
      const data = NS.api.parseJsonSafe ? await NS.api.parseJsonSafe(response) : await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to fetch dashboard summary");
      return data?.data || {};
    }

    const response = await fetch("/api/get-dashboard-summary");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "Failed to fetch dashboard summary");
    return data?.data || {};
  }

  function buildBridgeTruth(summary = {}) {
    const planAccess = summary.plan_access || {};
    const snapshot = summary.account_snapshot || {};
    const profile = summary.profile_snapshot || {};
    const publishing = summary.publishing_readiness || {};

    const planKey = clean(planAccess.plan_key || snapshot.plan || "starter").toLowerCase().includes("pro")
      ? "pro"
      : "starter";

    const planName = planKey === "pro" ? "Pro" : "Starter";
    const dailyLimit = safeNumber(
      summary.effective_posting_limit || summary.daily_limit || planAccess.posting_limit || snapshot.posting_limit,
      planKey === "pro" ? 25 : 5
    );
    const postsUsed = safeNumber(
      summary.posts_today || snapshot.posts_used_today || snapshot.posts_today,
      0
    );
    const postsRemaining = safeNumber(
      summary.posts_remaining || snapshot.posts_remaining,
      Math.max(dailyLimit - postsUsed, 0)
    );

    const accessState = clean(snapshot.billing?.status || snapshot.status || (snapshot.active ? "active" : "inactive")) || "active";
    const normalizedAccessState = /trial/i.test(accessState) ? "trial_active" : accessState;
    const active = snapshot.access_granted === true || snapshot.active === true || normalizedAccessState === "active" || normalizedAccessState === "trial_active";

    return {
      source: "phase_m_summary_bridge",
      synced_at: new Date().toISOString(),
      email: clean(snapshot.email || getEmailGuess()),
      user_id: clean(snapshot.user_id || ""),
      plan_key: planKey,
      plan_name: planName,
      monthly_price: planKey === "pro" ? 79 : 49,
      daily_limit: dailyLimit,
      posts_used_today: postsUsed,
      posts_remaining_today: postsRemaining,
      can_post: Boolean(summary.can_post),
      active,
      access_state: normalizedAccessState,
      trial_ends_at: snapshot.trial_end || "2026-04-20T00:00:00Z",
      current_period_end: snapshot.current_period_end || null,
      profile_complete: Boolean(summary.setup_status?.profile_complete),
      compliance_ready: Boolean(publishing.ready),
      inventory_url: clean(profile.inventory_url || snapshot.inventory_url || ""),
      dealer_website: clean(profile.dealer_website || snapshot.dealer_website || ""),
      scanner_type: clean(profile.scanner_type || snapshot.scanner_type || ""),
      listing_location: clean(profile.listing_location || snapshot.listing_location || ""),
      compliance_mode: clean(profile.compliance_mode || snapshot.compliance_mode || ""),
      account_snapshot: snapshot,
      plan_access: planAccess
    };
  }

  function persistBridgeTruth(truth) {
    const payload = JSON.stringify(truth);
    try {
      localStorage.setItem(STORAGE_KEYS.canonical, payload);
      localStorage.setItem(STORAGE_KEYS.extension, payload);
      localStorage.setItem(STORAGE_KEYS.postingGate, payload);
      localStorage.setItem(STORAGE_KEYS.sessionBridge, payload);
    } catch (error) {
      console.error("[Phase M] Could not persist bridge truth:", error);
    }
  }

  function publishBridgeTruth(truth) {
    NS.accountTruth = truth;
    NS.enforcementBridge = truth;

    try {
      NS.state?.set?.("accountTruth", truth, { silent: true });
      NS.state?.set?.("enforcementBridge", truth, { silent: true });
    } catch (error) {
      console.error("[Phase M] Could not write bridge truth to dashboard state:", error);
    }

    try {
      NS.events?.dispatchEvent?.(new CustomEvent("accountTruth:updated", { detail: truth }));
      NS.events?.dispatchEvent?.(new CustomEvent("enforcementBridge:updated", { detail: truth }));
    } catch {}

    try {
      window.dispatchEvent(new CustomEvent("elevate:account-truth", { detail: truth }));
      window.dispatchEvent(new CustomEvent("elevate:enforcement-bridge", { detail: truth }));
    } catch {}
  }

  function applyBridgeToDom(truth) {
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = value;
    };

    setText("overviewPlanChip", truth.plan_name);
    setText("extensionPlan", truth.plan_name);
    setText("planNameBilling", truth.plan_name);
    setText("extensionPostLimit", `${truth.daily_limit} posts/day`);
    setText("extensionPostsUsed", String(truth.posts_used_today));
    setText("extensionRemainingPosts", String(truth.posts_remaining_today));
    setText("snapshotPostsRemaining", String(truth.posts_remaining_today));
    setText("kpiPostsRemaining", String(truth.posts_remaining_today));

    const commandPostsUsed = document.getElementById("commandPostsUsed");
    if (commandPostsUsed) commandPostsUsed.textContent = `${truth.posts_used_today} / ${truth.daily_limit}`;

    const accessBadge = document.getElementById("accessBadgeBilling");
    if (accessBadge) {
      accessBadge.textContent = truth.access_state === "trial_active" ? "Trial Active" : (truth.active ? "Active" : "Inactive");
      accessBadge.className = truth.active ? "badge active" : "badge inactive";
    }

    const subStatus = document.getElementById("subscriptionStatusBilling");
    if (subStatus) {
      subStatus.textContent = truth.access_state === "trial_active" ? "Trial Active" : (truth.active ? "Active" : "Inactive");
    }

    const overviewAccessChip = document.getElementById("overviewAccessChip");
    if (overviewAccessChip) {
      overviewAccessChip.textContent = truth.access_state === "trial_active" ? "Trial Active" : (truth.active ? "Active Access" : "Inactive");
    }

    const accountStatusBilling = document.getElementById("accountStatusBilling");
    if (accountStatusBilling) {
      accountStatusBilling.textContent = `${truth.plan_name} • ${truth.daily_limit} posts/day • ${truth.posts_remaining_today} remaining today`;
    }
  }

  function renderBridgePanel(truth, errorMessage = "") {
    const billing = document.getElementById("billing");
    if (!billing) return;

    let panel = document.getElementById("eaPhaseMBridgePanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "eaPhaseMBridgePanel";
      panel.className = "ea-m-bridge-card";
      billing.appendChild(panel);
    }

    if (errorMessage) {
      panel.innerHTML = `
        <div class="section-head">
          <div>
            <div class="ea-m-label">Enforcement Bridge</div>
            <h2 style="margin-top:6px;">Bridge sync hit an issue.</h2>
            <div class="subtext">The dashboard could not refresh canonical account truth from the summary API.</div>
          </div>
        </div>
        <div class="ea-m-note">${errorMessage}</div>
      `;
      return;
    }

    panel.innerHTML = `
      <div class="section-head">
        <div>
          <div class="ea-m-label">Cross-System Enforcement Bridge</div>
          <h2 style="margin-top:6px;">Canonical account truth is now bridged from the live summary API.</h2>
          <div class="subtext">This layer reuses the current dashboard summary contract so plan, limit, and access truth come from one backend-fed source.</div>
        </div>
      </div>

      <div class="ea-m-grid">
        <div class="ea-m-cell">
          <div class="ea-m-label">Plan</div>
          <div class="ea-m-value">${truth.plan_name}</div>
          <div class="ea-m-sub">${money(truth.monthly_price)} recurring target</div>
        </div>
        <div class="ea-m-cell">
          <div class="ea-m-label">Posting Limit</div>
          <div class="ea-m-value">${truth.daily_limit}</div>
          <div class="ea-m-sub">Canonical posts/day for dashboard and bridge caches.</div>
        </div>
        <div class="ea-m-cell">
          <div class="ea-m-label">Posts Remaining</div>
          <div class="ea-m-value">${truth.posts_remaining_today}</div>
          <div class="ea-m-sub">${truth.posts_used_today} already used today.</div>
        </div>
        <div class="ea-m-cell">
          <div class="ea-m-label">Access State</div>
          <div class="ea-m-value">${truth.access_state}</div>
          <div class="ea-m-sub">${truth.active ? "Posting is allowed when the gate confirms." : "Account appears blocked."}</div>
        </div>
      </div>

      <div class="ea-m-note">
        Bridge keys written to local storage:
        <br>• ${STORAGE_KEYS.canonical}
        <br>• ${STORAGE_KEYS.extension}
        <br>• ${STORAGE_KEYS.postingGate}
        <br>• ${STORAGE_KEYS.sessionBridge}
      </div>
    `;
  }

  async function syncBridgeTruth() {
    try {
      const summary = await fetchDashboardSummary();
      const truth = buildBridgeTruth(summary);
      persistBridgeTruth(truth);
      publishBridgeTruth(truth);
      applyBridgeToDom(truth);
      renderBridgePanel(truth);
      return truth;
    } catch (error) {
      console.error("[Phase M] Bridge sync failed:", error);
      renderBridgePanel(null, clean(error?.message || "Bridge sync failed."));
      return null;
    }
  }

  function bindRefreshHooks() {
    const btnIds = ["refreshBillingBtn", "refreshAccessBtn"];
    btnIds.forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn || btn.dataset.phaseMBound === "true") return;
      btn.dataset.phaseMBound = "true";
      btn.addEventListener("click", () => {
        setTimeout(() => { syncBridgeTruth(); }, 500);
        setTimeout(() => { syncBridgeTruth(); }, 1800);
      });
    });
  }

  function run() {
    installStyles();
    bindRefreshHooks();
    syncBridgeTruth();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  setTimeout(run, 900);
  setTimeout(run, 2400);
  setTimeout(run, 4200);
})();
