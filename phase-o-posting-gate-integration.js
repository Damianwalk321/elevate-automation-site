
// phase-o-posting-gate-integration.js
//
// Direct posting-gate adapter.
// Load this AFTER extension-account-truth-bridge.js and phase-o-worker-enforcement.js
// in any context that currently uses canUserPostNow/registerSuccessfulPost style helpers.

(() => {
  if (globalThis.__ELEVATE_PHASE_O_POSTING_GATE__) return;
  globalThis.__ELEVATE_PHASE_O_POSTING_GATE__ = true;

  const BRIDGE = globalThis.ElevateAccountTruthBridge;
  const WORKER = globalThis.ElevatePhaseOEnforcement;

  if (!BRIDGE || !WORKER) {
    console.warn("[Phase O] Bridge or worker enforcement missing.");
    return;
  }

  async function canUserPostNow(payload = {}) {
    const result = await WORKER.canPostNow(payload);
    return {
      allowed: Boolean(result.allowed),
      ok: Boolean(result.ok),
      reason: result.reason,
      daily_limit: result.daily_limit,
      posts_used_today: result.posts_used_today,
      posts_remaining_today: result.posts_remaining_today,
      truth: result.truth
    };
  }

  async function registerSuccessfulPost(payload = {}) {
    const result = await WORKER.registerPostSuccess(payload);
    return result;
  }

  async function getPostingGateTruth() {
    const { truth } = await WORKER.getAccountTruth();
    return truth;
  }

  // Patch expected globals used by legacy gate/session code.
  globalThis.canUserPostNow = canUserPostNow;
  globalThis.registerSuccessfulPost = registerSuccessfulPost;
  globalThis.getPostingGateTruth = getPostingGateTruth;
})();
