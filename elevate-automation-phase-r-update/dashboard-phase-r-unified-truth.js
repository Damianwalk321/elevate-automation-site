// dashboard-phase-r-unified-truth.js
//
// Phase R cleanup/consolidation file for the website repo.
// Purpose:
// - replace stacked dashboard truth/enforcement patches with one unified layer
// - normalize visible plan/access/limit truth
// - publish canonical account truth from the live summary API
// - write bridge payloads to localStorage for extension sync
//
// Intended load order in dashboard.html:
// existing dashboard bundles first, then this file last.

(() => {
  if (window.__ELEVATE_PHASE_R_DASHBOARD_UNIFIED__) return;
  window.__ELEVATE_PHASE_R_DASHBOARD_UNIFIED__ = true;

  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  const STORAGE_KEYS = [
    "elevate.account_truth.v1",
    "elevate.extension_account_truth.v1",
    "elevate.posting_gate_truth.v1",
    "elevate.session_bridge_truth.v1"
  ];

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function n(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function apiFetch(url, options = {}) {
    if (NS.api?.apiFetch) return NS.api.apiFetch(url, options);
    return fetch(url, options);
  }

  async function parseJson(response) {
    if (NS.api?.parseJsonSafe) return NS.api.parseJsonSafe(response);
    try { return await response.json(); } catch { return {}; }
  }

  function normalizePlan(summary = {}) {
    const raw = clean(
      summary.plan_access?.plan_label ||
      summary.account_snapshot?.plan ||
      summary.account_snapshot?.plan_name ||
      summary.profile_snapshot?.plan ||
      ""
    ).toLowerCase();

    if (raw.includes("pro")) {
      return { plan_key: "pro", plan_name: "Pro", monthly_price: 79, daily_limit_default: 25 };
    }
    return { plan_key: "starter", plan_name: "Starter", monthly_price: 49, daily_limit_default: 5 };
  }

  function buildTruth(summary = {}) {
    const plan = normalizePlan(summary);
    const account = summary.account_snapshot || {};
    const planAccess = summary.plan_access || {};
    const setup = summary.setup_status || {};
    const profile = summary.profile_snapshot || {};

    const dailyLimit = n(
      summary.effective_posting_limit ??
      summary.daily_limit ??
      planAccess.posting_limit ??
      account.posting_limit,
      plan.daily_limit_default
    );

    const postsUsed = n(
      summary.posts_today ??
      account.posts_today ??
      account.posts_used_today,
      0
    );

    const postsRemaining = n(
      summary.posts_remaining ??
      account.posts_remaining,
      Math.max(dailyLimit - postsUsed, 0)
    );

    const rawStatus = clean(
      account.status ||
      summary.account_status ||
      (summary.can_post ? "active" : "inactive")
    ).toLowerCase();

    const access_state = rawStatus.includes("trial") ? "trial_active" : rawStatus || "active";

    return {
      source: "phase_r_dashboard_unified_truth",
      synced_at: new Date().toISOString(),
      email: clean(account.email || ""),
      user_id: clean(account.user_id || ""),
      plan_key: plan.plan_key,
      plan_name: plan.plan_name,
      monthly_price: plan.monthly_price,
      daily_limit: dailyLimit,
      posts_used_today: postsUsed,
      posts_remaining_today: Math.max(0, postsRemaining),
      can_post: Boolean(summary.can_post),
      active: Boolean(account.active !== false),
      access_state,
      trial_ends_at: clean(account.trial_end || "2026-04-20T00:00:00Z"),
      current_period_end: account.current_period_end || null,
      profile_complete: Boolean(setup.profile_complete),
      compliance_ready: Boolean(setup.compliance_mode_present && setup.dealership_name_present && setup.salesperson_name_present),
      inventory_url: clean(profile.inventory_url || account.inventory_url || ""),
      dealer_website: clean(profile.dealer_website || account.dealer_website || ""),
      scanner_type: clean(profile.scanner_type || account.scanner_type || ""),
      listing_location: clean(profile.listing_location || account.listing_location || ""),
      compliance_mode: clean(profile.compliance_mode || account.compliance_mode || "")
    };
  }

  function persistTruth(truth) {
    const payload = JSON.stringify(truth);
    STORAGE_KEYS.forEach((key) => localStorage.setItem(key, payload));
  }

  function publishTruth(truth) {
    NS.accountTruth = truth;
    try {
      NS.state?.set?.("accountTruth", truth, { silent: true });
    } catch {}

    try {
      window.dispatchEvent(new CustomEvent("elevate:account-truth", { detail: truth }));
      window.dispatchEvent(new CustomEvent("elevate:enforcement-bridge", { detail: truth }));
    } catch {}
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  }

  function applyTruth(truth) {
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

    const subscriptionStatus = document.getElementById("subscriptionStatusBilling");
    if (subscriptionStatus) {
      subscriptionStatus.textContent = truth.access_state === "trial_active" ? "Trial Active" : (truth.active ? "Active" : "Inactive");
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

  async function syncTruth() {
    const response = await apiFetch("/api/get-dashboard-summary");
    const data = await parseJson(response);
    if (!response.ok || !data?.data) {
      throw new Error(data?.error || "Failed to load dashboard summary");
    }

    const truth = buildTruth(data.data);
    persistTruth(truth);
    publishTruth(truth);
    applyTruth(truth);
    return truth;
  }

  function bindRefreshHooks() {
    ["refreshBillingBtn", "refreshAccessBtn"].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn || btn.dataset.phaseRBound === "true") return;
      btn.dataset.phaseRBound = "true";
      btn.addEventListener("click", () => {
        setTimeout(() => { syncTruth().catch(console.error); }, 400);
        setTimeout(() => { syncTruth().catch(console.error); }, 1600);
      });
    });
  }

  function run() {
    bindRefreshHooks();
    syncTruth().catch((error) => console.error("[Phase R] dashboard truth sync failed:", error));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  setTimeout(run, 1200);
  setTimeout(run, 3200);
})();
