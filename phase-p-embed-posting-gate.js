// phase-p-embed-posting-gate.js
//
// Production embed target for the real posting gate file.
// Load AFTER extension-account-truth-bridge.js and worker embed.

(() => {
  if (globalThis.__ELEVATE_PHASE_P_GATE_EMBED__) return;
  globalThis.__ELEVATE_PHASE_P_GATE_EMBED__ = true;

  const Bridge = globalThis.ElevateAccountTruthBridge;
  if (!Bridge) {
    console.warn("[Phase P] ElevateAccountTruthBridge missing in posting gate.");
    return;
  }

  async function canUserPostNow(payload = {}) {
    const result = await Bridge.canUserPostNow();
    return {
      allowed: Boolean(result.allowed),
      ok: Boolean(result.allowed),
      reason: result.reason || "unknown",
      truth: result.truth || await Bridge.getCanonicalTruth()
    };
  }

  async function registerSuccessfulPost(payload = {}) {
    const count = Number(payload.count || 1);
    return await Bridge.registerSuccessfulPost(count);
  }

  async function getPostingGateTruth() {
    return await Bridge.getCanonicalTruth();
  }

  globalThis.canUserPostNow = canUserPostNow;
  globalThis.registerSuccessfulPost = registerSuccessfulPost;
  globalThis.getPostingGateTruth = getPostingGateTruth;
})();
