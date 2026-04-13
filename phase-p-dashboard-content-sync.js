// phase-p-dashboard-content-sync.js
//
// Production content-script target for the website/dashboard domain.
// Copies canonical truth from dashboard localStorage into extension chrome.storage.local.

(() => {
  if (window.__ELEVATE_PHASE_P_DASHBOARD_SYNC__) return;
  window.__ELEVATE_PHASE_P_DASHBOARD_SYNC__ = true;

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

  function safeParse(v) {
    try { return JSON.parse(v); } catch { return null; }
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(payload = {}) {
    const planKey = clean(payload.plan_key || payload.plan || "starter").toLowerCase().includes("pro") ? "pro" : "starter";
    const dailyLimit = Number(payload.daily_limit || (planKey === "pro" ? 25 : 5));
    const used = Number(payload.posts_used_today || 0);
    return {
      source: clean(payload.source || "phase_p_dashboard_sync"),
      synced_at: new Date().toISOString(),
      email: clean(payload.email || ""),
      user_id: clean(payload.user_id || ""),
      plan_key: planKey,
      plan_name: planKey === "pro" ? "Pro" : "Starter",
      monthly_price: Number(planKey === "pro" ? 79 : 49),
      daily_limit: dailyLimit,
      posts_used_today: used,
      posts_remaining_today: Number(payload.posts_remaining_today != null ? payload.posts_remaining_today : Math.max(dailyLimit - used, 0)),
      can_post: payload.can_post !== false,
      active: payload.active !== false,
      access_state: clean(payload.access_state || "active"),
      trial_ends_at: clean(payload.trial_ends_at || "2026-04-20T00:00:00Z")
    };
  }

  function readTruth() {
    for (const key of SITE_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = safeParse(raw);
      if (parsed && typeof parsed === "object") return normalize(parsed);
    }
    return null;
  }

  async function syncTruth() {
    const truth = readTruth();
    if (!truth || !chrome?.storage?.local) return;
    await chrome.storage.local.set({
      [EXT_KEYS.canonical]: truth,
      [EXT_KEYS.postingGate]: truth,
      [EXT_KEYS.session]: truth,
      [EXT_KEYS.meta]: { synced_at: new Date().toISOString(), source: "dashboard_content_script" }
    });
  }

  window.addEventListener("storage", () => syncTruth().catch(console.error));
  window.addEventListener("elevate:account-truth", (e) => {
    const truth = normalize(e?.detail || {});
    chrome?.storage?.local?.set({
      [EXT_KEYS.canonical]: truth,
      [EXT_KEYS.postingGate]: truth,
      [EXT_KEYS.session]: truth,
      [EXT_KEYS.meta]: { synced_at: new Date().toISOString(), source: "dashboard_event" }
    });
  });

  syncTruth().catch(console.error);
  setInterval(() => syncTruth().catch(() => {}), 12000);
})();
