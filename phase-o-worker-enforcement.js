
// phase-o-worker-enforcement.js
//
// Direct worker/posting-gate integration layer for Elevate Automation.
// Load this in the extension service worker AFTER extension-account-truth-bridge.js.
// This turns the bridge into a live enforcement path for worker/runtime callers.

(() => {
  if (globalThis.__ELEVATE_PHASE_O_WORKER_ENFORCEMENT__) return;
  globalThis.__ELEVATE_PHASE_O_WORKER_ENFORCEMENT__ = true;

  const BRIDGE = globalThis.ElevateAccountTruthBridge;
  if (!BRIDGE) {
    console.warn("[Phase O] ElevateAccountTruthBridge is missing. Load extension-account-truth-bridge.js first.");
    return;
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeVehicleKey(vehicle = {}) {
    return clean(
      vehicle.vin ||
      vehicle.stock_number ||
      vehicle.stock ||
      vehicle.vehicle_id ||
      vehicle.id ||
      [
        clean(vehicle.year),
        clean(vehicle.make),
        clean(vehicle.model),
        clean(vehicle.price),
        clean(vehicle.mileage)
      ].filter(Boolean).join("|")
    );
  }

  async function canPostNow(payload = {}) {
    const bridge = await BRIDGE.canUserPostNow();
    const truth = bridge.truth || await BRIDGE.getCanonicalTruth();

    return {
      ok: Boolean(bridge.allowed),
      allowed: Boolean(bridge.allowed),
      reason: bridge.reason || "unknown",
      vehicle_key: normalizeVehicleKey(payload.vehicle || payload),
      plan_key: truth.plan_key,
      plan_name: truth.plan_name,
      daily_limit: truth.daily_limit,
      posts_used_today: truth.posts_used_today,
      posts_remaining_today: truth.posts_remaining_today,
      active: truth.active,
      can_post: truth.can_post,
      access_state: truth.access_state,
      truth
    };
  }

  async function registerPostSuccess(payload = {}) {
    const count = Number(payload.count || 1);
    const truth = await BRIDGE.registerSuccessfulPost(count);

    return {
      ok: true,
      registered: true,
      count,
      vehicle_key: normalizeVehicleKey(payload.vehicle || payload),
      plan_key: truth.plan_key,
      plan_name: truth.plan_name,
      daily_limit: truth.daily_limit,
      posts_used_today: truth.posts_used_today,
      posts_remaining_today: truth.posts_remaining_today,
      truth
    };
  }

  async function getAccountTruth() {
    const truth = await BRIDGE.getCanonicalTruth();
    return {
      ok: true,
      truth
    };
  }

  async function refreshDailyState() {
    await BRIDGE.resetDailyUsageForNewDay();
    const truth = await BRIDGE.getCanonicalTruth();
    return truth;
  }

  function attachRuntimeHandlers() {
    if (!chrome?.runtime?.onMessage || globalThis.__ELEVATE_PHASE_O_RUNTIME_BOUND__) return;
    globalThis.__ELEVATE_PHASE_O_RUNTIME_BOUND__ = true;

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const type = clean(message?.type || message?.action || "");

      (async () => {
        if (type === "EA_CAN_POST" || type === "CAN_POST") {
          sendResponse(await canPostNow(message.payload || message));
          return;
        }

        if (type === "EA_REGISTER_POST" || type === "REGISTER_SUCCESSFUL_POST") {
          sendResponse(await registerPostSuccess(message.payload || message));
          return;
        }

        if (type === "EA_GET_ACCOUNT_TRUTH" || type === "GET_ACCOUNT_TRUTH") {
          sendResponse(await getAccountTruth());
          return;
        }

        if (type === "EA_REFRESH_DAILY_STATE") {
          const truth = await refreshDailyState();
          sendResponse({ ok: true, truth });
          return;
        }
      })().catch((error) => {
        console.error("[Phase O] runtime handler failed:", error);
        sendResponse({
          ok: false,
          error: error?.message || "Phase O handler failed"
        });
      });

      return true;
    });
  }

  // Global helpers for existing worker code to call directly.
  globalThis.ElevatePhaseOEnforcement = {
    canPostNow,
    registerPostSuccess,
    getAccountTruth,
    refreshDailyState,
    attachRuntimeHandlers
  };

  globalThis.CAN_POST = async function (payload = {}) {
    return await canPostNow(payload);
  };

  globalThis.REGISTER_SUCCESSFUL_POST = async function (payload = {}) {
    return await registerPostSuccess(payload);
  };

  globalThis.GET_ACCOUNT_TRUTH = async function () {
    return await getAccountTruth();
  };

  attachRuntimeHandlers();
})();
