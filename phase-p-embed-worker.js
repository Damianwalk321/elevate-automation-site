// phase-p-embed-worker.js
//
// Production embed target for the real extension worker/service worker.
// Load AFTER extension-account-truth-bridge.js.
// This file is intended to be imported or pasted into the live worker path.

(() => {
  if (globalThis.__ELEVATE_PHASE_P_WORKER_EMBED__) return;
  globalThis.__ELEVATE_PHASE_P_WORKER_EMBED__ = true;

  const Bridge = globalThis.ElevateAccountTruthBridge;
  if (!Bridge) {
    console.warn("[Phase P] ElevateAccountTruthBridge missing in worker.");
    return;
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function vehicleKey(vehicle = {}) {
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

  async function canPost(payload = {}) {
    const result = await Bridge.canUserPostNow();
    return {
      ok: Boolean(result.allowed),
      allowed: Boolean(result.allowed),
      reason: result.reason || "unknown",
      vehicle_key: vehicleKey(payload.vehicle || payload),
      truth: result.truth || await Bridge.getCanonicalTruth()
    };
  }

  async function registerPost(payload = {}) {
    const count = Number(payload.count || 1);
    const truth = await Bridge.registerSuccessfulPost(count);
    return {
      ok: true,
      registered: true,
      count,
      vehicle_key: vehicleKey(payload.vehicle || payload),
      truth
    };
  }

  async function getTruth() {
    const truth = await Bridge.getCanonicalTruth();
    return { ok: true, truth };
  }

  async function refreshTruth() {
    await Bridge.resetDailyUsageForNewDay();
    return await getTruth();
  }

  async function handleRuntime(message) {
    const type = clean(message?.type || message?.action || "");
    if (type === "EA_CAN_POST" || type === "CAN_POST") return await canPost(message.payload || message);
    if (type === "EA_REGISTER_POST" || type === "REGISTER_SUCCESSFUL_POST") return await registerPost(message.payload || message);
    if (type === "EA_GET_ACCOUNT_TRUTH" || type === "GET_ACCOUNT_TRUTH") return await getTruth();
    if (type === "EA_REFRESH_DAILY_STATE") return await refreshTruth();
    return null;
  }

  if (chrome?.runtime?.onMessage && !globalThis.__ELEVATE_PHASE_P_RUNTIME_BOUND__) {
    globalThis.__ELEVATE_PHASE_P_RUNTIME_BOUND__ = true;
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      handleRuntime(message)
        .then((response) => {
          if (response) sendResponse(response);
        })
        .catch((error) => {
          console.error("[Phase P] worker runtime handler failed:", error);
          sendResponse({ ok: false, error: error?.message || "worker runtime failure" });
        });
      return true;
    });
  }

  globalThis.CAN_POST = canPost;
  globalThis.REGISTER_SUCCESSFUL_POST = registerPost;
  globalThis.GET_ACCOUNT_TRUTH = getTruth;
  globalThis.REFRESH_ACCOUNT_TRUTH = refreshTruth;
})();
