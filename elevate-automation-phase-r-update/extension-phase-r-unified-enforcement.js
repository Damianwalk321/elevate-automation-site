// extension-phase-r-unified-enforcement.js
//
// Phase R cleanup/consolidation file for the extension repo.
// Purpose:
// - replace scattered bridge/helper/worker/gate layers with one unified enforcement module
// - read canonical account truth from chrome.storage.local
// - expose the same truth to worker, popup/session UI, and posting gate

(() => {
  if (globalThis.__ELEVATE_PHASE_R_EXTENSION_UNIFIED__) return;
  globalThis.__ELEVATE_PHASE_R_EXTENSION_UNIFIED__ = true;

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
    const used = Number(payload.posts_used_today || 0);
    return {
      source: clean(payload.source || "phase_r_extension_unified"),
      synced_at: clean(payload.synced_at || ""),
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

  async function getTruth() {
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
      truth.posts_remaining_today = Math.max(0, truth.daily_limit - usedToday);
    }

    return truth;
  }

  async function saveTruth(payload = {}) {
    const truth = normalizeTruth(payload);
    await setStorage({
      [STORAGE_KEYS.canonical]: truth,
      [STORAGE_KEYS.postingGate]: truth,
      [STORAGE_KEYS.session]: truth,
      [STORAGE_KEYS.meta]: {
        source: "phase_r_extension_unified",
        synced_at: new Date().toISOString()
      }
    });
    return truth;
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

  async function canUserPostNow() {
    await resetDailyUsageForNewDay();
    const truth = await getTruth();

    const allowed = Boolean(
      truth.active &&
      truth.can_post &&
      truth.posts_remaining_today > 0
    );

    return {
      allowed,
      ok: allowed,
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
    const truth = await getTruth();
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

  function setText(id, value) {
    if (typeof document === "undefined") return;
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  }

  async function renderUi() {
    if (typeof document === "undefined") return;
    const truth = await getTruth();
    setText("extensionPlan", truth.plan_name);
    setText("extensionPostLimit", `${truth.daily_limit} posts/day`);
    setText("extensionPostsUsed", `${truth.posts_used_today}`);
    setText("extensionRemainingPosts", `${truth.posts_remaining_today}`);
    setText("extensionAccessState", truth.access_state);
  }

  function bindRuntime() {
    if (!chrome?.runtime?.onMessage || globalThis.__ELEVATE_PHASE_R_RUNTIME_BOUND__) return;
    globalThis.__ELEVATE_PHASE_R_RUNTIME_BOUND__ = true;

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const type = clean(message?.type || message?.action || "");
      (async () => {
        if (type === "EA_CAN_POST" || type === "CAN_POST") {
          sendResponse(await canUserPostNow());
          return;
        }
        if (type === "EA_REGISTER_POST" || type === "REGISTER_SUCCESSFUL_POST") {
          sendResponse({ ok: true, truth: await registerSuccessfulPost(Number(message?.count || 1)) });
          return;
        }
        if (type === "EA_GET_ACCOUNT_TRUTH" || type === "GET_ACCOUNT_TRUTH") {
          sendResponse({ ok: true, truth: await getTruth() });
          return;
        }
        if (type === "EA_REFRESH_DAILY_STATE") {
          await resetDailyUsageForNewDay();
          sendResponse({ ok: true, truth: await getTruth() });
          return;
        }
      })().catch((error) => {
        console.error("[Phase R] runtime handler failed:", error);
        sendResponse({ ok: false, error: error?.message || "runtime failure" });
      });
      return true;
    });
  }

  globalThis.ElevateUnifiedEnforcement = {
    STORAGE_KEYS,
    normalizeTruth,
    getTruth,
    saveTruth,
    canUserPostNow,
    registerSuccessfulPost,
    resetDailyUsageForNewDay,
    renderUi
  };

  globalThis.canUserPostNow = canUserPostNow;
  globalThis.registerSuccessfulPost = async (payload = {}) => {
    const count = Number(payload?.count || payload || 1);
    return await registerSuccessfulPost(count);
  };
  globalThis.getCurrentPostingLimit = async () => (await getTruth()).daily_limit;
  globalThis.getCurrentAccountTruth = async () => await getTruth();

  bindRuntime();

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => renderUi().catch(console.error), { once: true });
    } else {
      renderUi().catch(console.error);
    }
    setTimeout(() => renderUi().catch(() => {}), 1200);
  }
})();
