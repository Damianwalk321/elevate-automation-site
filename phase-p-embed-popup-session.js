// phase-p-embed-popup-session.js
//
// Production embed target for popup/session UI.
// Reads canonical truth and keeps visible plan/limit state in sync.

(() => {
  if (globalThis.__ELEVATE_PHASE_P_POPUP_EMBED__) return;
  globalThis.__ELEVATE_PHASE_P_POPUP_EMBED__ = true;

  const Bridge = globalThis.ElevateAccountTruthBridge;
  if (!Bridge) return;

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  }

  async function renderTruth() {
    const truth = await Bridge.getCanonicalTruth();
    setText("extensionPlan", truth.plan_name);
    setText("extensionPostLimit", `${truth.daily_limit} posts/day`);
    setText("extensionPostsUsed", `${truth.posts_used_today}`);
    setText("extensionRemainingPosts", `${truth.posts_remaining_today}`);
    setText("extensionAccessState", truth.access_state);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => renderTruth().catch(console.error), { once: true });
  } else {
    renderTruth().catch(console.error);
  }

  setTimeout(() => renderTruth().catch(() => {}), 1200);
})();
