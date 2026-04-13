
// phase-n-posting-gate-patch.js
//
// Optional additive shim. Load after extension-account-truth-bridge.js
// and before / alongside posting-gate.js if you want a bridge-backed global API.

(() => {
  if (globalThis.__ELEVATE_PHASE_N_POSTING_GATE_PATCH__) return;
  globalThis.__ELEVATE_PHASE_N_POSTING_GATE_PATCH__ = true;

  if (!globalThis.ElevateAccountTruthBridge) {
    console.warn("[Phase N] ElevateAccountTruthBridge missing.");
    return;
  }

  globalThis.canUserPostNow = async function () {
    return await globalThis.ElevateAccountTruthBridge.canUserPostNow();
  };

  globalThis.registerSuccessfulPost = async function (count = 1) {
    return await globalThis.ElevateAccountTruthBridge.registerSuccessfulPost(count);
  };

  globalThis.getCurrentPostingLimit = async function () {
    const truth = await globalThis.ElevateAccountTruthBridge.getCanonicalTruth();
    return truth.daily_limit;
  };

  globalThis.getCurrentAccountTruth = async function () {
    return await globalThis.ElevateAccountTruthBridge.getCanonicalTruth();
  };
})();
