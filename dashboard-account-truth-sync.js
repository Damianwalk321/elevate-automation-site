
// dashboard-account-truth-sync.js
//
// Content script for elevate-automation-site pages.
// Reads canonical account truth published by the dashboard/site and copies it into
// chrome.storage.local so extension service worker / popup / posting gate can use it.

(() => {
  if (window.__ELEVATE_PHASE_N_DASHBOARD_SYNC__) return;
  window.__ELEVATE_PHASE_N_DASHBOARD_SYNC__ = true;

  const SITE_KEYS = [
    "elevate.account_truth.v1",
    "elevate.extension_account_truth.v1",
    "elevate.posting_gate_truth.v1",
    "elevate.session_bridge_truth.v1"
  ];

  const EXT_KEYS = {
    canonical: "elevate_extension_account_truth",
    postingGate: "elevate_posting_gate_truth",
    session: "elevate_session_bridge_truth",
    meta: "elevate_account_truth_meta"
  };

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function safeParse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function normalizeTruth(payload = {}) {
    const planKey = clean(payload.plan_key || payload.plan || "starter").toLowerCase().includes("pro") ? "pro" : "starter";
    return {
      source: clean(payload.source || "dashboard_account_truth_sync"),
      synced_at: new Date().toISOString(),
      email: clean(payload.email || ""),
      user_id: clean(payload.user_id || ""),
      plan_key: planKey,
      plan_name: planKey === "pro" ? "Pro" : "Starter",
      monthly_price: Number(planKey === "pro" ? 79 : 49),
      daily_limit: Number(payload.daily_limit || (planKey === "pro" ? 25 : 5)),
      posts_used_today: Number(payload.posts_used_today || 0),
      posts_remaining_today: Number(
        payload.posts_remaining_today != null
          ? payload.posts_remaining_today
          : Math.max(Number(payload.daily_limit || (planKey === "pro" ? 25 : 5)) - Number(payload.posts_used_today || 0), 0)
      ),
      can_post: Boolean(payload.can_post),
      active: Boolean(payload.active !== false),
      access_state: clean(payload.access_state || "active"),
      trial_ends_at: clean(payload.trial_ends_at || "2026-04-20T00:00:00Z"),
      current_period_end: payload.current_period_end || null,
      profile_complete: Boolean(payload.profile_complete),
      compliance_ready: Boolean(payload.compliance_ready),
      inventory_url: clean(payload.inventory_url || ""),
      dealer_website: clean(payload.dealer_website || ""),
      scanner_type: clean(payload.scanner_type || ""),
      listing_location: clean(payload.listing_location || ""),
      compliance_mode: clean(payload.compliance_mode || "")
    };
  }

  function readFirstTruth() {
    for (const key of SITE_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = safeParse(raw);
      if (parsed && typeof parsed === "object") return normalizeTruth(parsed);
    }
    return null;
  }

  async function writeToExtensionStorage(truth) {
    if (!truth || !chrome?.storage?.local) return;
    await chrome.storage.local.set({
      [EXT_KEYS.canonical]: truth,
      [EXT_KEYS.postingGate]: truth,
      [EXT_KEYS.session]: truth,
      [EXT_KEYS.meta]: {
        source: "dashboard_content_script",
        synced_at: new Date().toISOString(),
        url: location.href
      }
    });
  }

  async function syncNow() {
    const truth = readFirstTruth();
    if (!truth) return;
    await writeToExtensionStorage(truth);
  }

  window.addEventListener("storage", () => {
    syncNow().catch((error) => console.error("[Phase N] storage sync failed:", error));
  });

  window.addEventListener("elevate:account-truth", (event) => {
    const truth = normalizeTruth(event?.detail || {});
    writeToExtensionStorage(truth).catch((error) => console.error("[Phase N] event sync failed:", error));
  });

  window.addEventListener("elevate:enforcement-bridge", (event) => {
    const truth = normalizeTruth(event?.detail || {});
    writeToExtensionStorage(truth).catch((error) => console.error("[Phase N] bridge event sync failed:", error));
  });

  syncNow().catch((error) => console.error("[Phase N] initial sync failed:", error));
  setInterval(() => syncNow().catch(() => {}), 12000);
})();
