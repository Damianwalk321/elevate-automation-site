
// extension-account-truth-bridge.js
//
// Shared extension-side truth consumer for service worker, popup, posting gate,
// and session bridge. Reads the canonical payload copied from dashboard pages into
// chrome.storage.local and exposes a normalized enforcement contract.

(() => {
  if (globalThis.__ELEVATE_PHASE_N_EXTENSION_BRIDGE__) return;
  globalThis.__ELEVATE_PHASE_N_EXTENSION_BRIDGE__ = true;

  const STORAGE_KEYS = {
    canonical: "elevate_extension_account_truth",
    postingGate: "elevate_posting_gate_truth",
    session: "elevate_session_bridge_truth",
    usage: "elevate_extension_usage_today",
    meta: "elevate_account_truth_meta"
  };

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function normalizeTruth(payload = {}) {
    const planKey = clean(payload.plan_key || payload.plan || "starter").toLowerCase().includes("pro") ? "pro" : "starter";
    const dailyLimit = Number(payload.daily_limit || (planKey === "pro" ? 25 : 5));
    const postsUsed = Number(payload.posts_used_today || 0);
    const postsRemaining = Number(
      payload.posts_remaining_today != null
        ? payload.posts_remaining_today
        : Math.max(dailyLimit - postsUsed, 0)
    );

    return {
      source: clean(payload.source || "extension_account_truth_bridge"),
      synced_at: clean(payload.synced_at || ""),
      email: clean(payload.email || ""),
      user_id: clean(payload.user_id || ""),
      plan_key: planKey,
      plan_name: planKey === "pro" ? "Pro" : "Starter",
      monthly_price: Number(planKey === "pro" ? 79 : 49),
      daily_limit: dailyLimit,
      posts_used_today: postsUsed,
      posts_remaining_today: Math.max(0, postsRemaining),
      can_post: payload.can_post !== false,
      active: payload.active !== false,
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

  async function getStorage(keys) {
    return await chrome.storage.local.get(keys);
  }

  async function setStorage(payload) {
    return await chrome.storage.local.set(payload);
  }

  async function getCanonicalTruth() {
    const stored = await getStorage([
      STORAGE_KEYS.canonical,
      STORAGE_KEYS.postingGate,
      STORAGE_KEYS.session,
      STORAGE_KEYS.usage
    ]);

    const truth = normalizeTruth(
      stored[STORAGE_KEYS.canonical] ||
      stored[STORAGE_KEYS.postingGate] ||
      stored[STORAGE_KEYS.session] ||
      {}
    );

    const usage = stored[STORAGE_KEYS.usage] || {};
    const key = todayKey();
    const usedToday = usage[key]?.posts_used_today;

    if (Number.isFinite(usedToday)) {
      truth.posts_used_today = usedToday;
      truth.posts_remaining_today = Math.max(0, truth.daily_limit - truth.posts_used_today);
    }

    return truth;
  }

  async function saveCanonicalTruth(payload = {}) {
    const truth = normalizeTruth(payload);
    await setStorage({
      [STORAGE_KEYS.canonical]: truth,
      [STORAGE_KEYS.postingGate]: truth,
      [STORAGE_KEYS.session]: truth,
      [STORAGE_KEYS.meta]: {
        source: "extension_account_truth_bridge",
        synced_at: new Date().toISOString()
      }
    });
    return truth;
  }

  async function canUserPostNow() {
    const truth = await getCanonicalTruth();
    const allowed = Boolean(
      truth.active &&
      truth.can_post &&
      truth.posts_remaining_today > 0
    );

    return {
      allowed,
      reason: allowed
        ? "allowed"
        : !truth.active
          ? "inactive_account"
          : !truth.can_post
            ? "posting_blocked"
            : "daily_limit_reached",
      truth
    };
  }

  async function registerSuccessfulPost(count = 1) {
    const truth = await getCanonicalTruth();
    const key = todayKey();
    const stored = await getStorage([STORAGE_KEYS.usage]);
    const usage = stored[STORAGE_KEYS.usage] || {};
    const current = Number(usage[key]?.posts_used_today || truth.posts_used_today || 0);
    const nextUsed = current + Number(count || 1);

    usage[key] = {
      posts_used_today: nextUsed,
      updated_at: new Date().toISOString()
    };

    const nextTruth = {
      ...truth,
      posts_used_today: nextUsed,
      posts_remaining_today: Math.max(0, truth.daily_limit - nextUsed),
      synced_at: new Date().toISOString()
    };

    await setStorage({
      [STORAGE_KEYS.usage]: usage,
      [STORAGE_KEYS.canonical]: nextTruth,
      [STORAGE_KEYS.postingGate]: nextTruth,
      [STORAGE_KEYS.session]: nextTruth
    });

    return nextTruth;
  }

  async function resetDailyUsageForNewDay() {
    const stored = await getStorage([STORAGE_KEYS.usage]);
    const usage = stored[STORAGE_KEYS.usage] || {};
    const key = todayKey();
    if (!usage[key]) {
      usage[key] = {
        posts_used_today: 0,
        updated_at: new Date().toISOString()
      };
      await setStorage({ [STORAGE_KEYS.usage]: usage });
    }
    return usage[key];
  }

  globalThis.ElevateAccountTruthBridge = {
    STORAGE_KEYS,
    normalizeTruth,
    getCanonicalTruth,
    saveCanonicalTruth,
    canUserPostNow,
    registerSuccessfulPost,
    resetDailyUsageForNewDay
  };
})();
