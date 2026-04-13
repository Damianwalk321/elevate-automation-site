
// phase-o-session-ui-sync.js
//
// Optional UI/session sync helper for popup or extension pages.
// Reads canonical truth and renders obvious Starter/Pro + remaining-post state.

(() => {
  if (globalThis.__ELEVATE_PHASE_O_SESSION_UI_SYNC__) return;
  globalThis.__ELEVATE_PHASE_O_SESSION_UI_SYNC__ = true;

  const BRIDGE = globalThis.ElevateAccountTruthBridge;
  if (!BRIDGE) return;

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  }

  async function render() {
    const truth = await BRIDGE.getCanonicalTruth();

    setText("extensionPlan", truth.plan_name);
    setText("extensionPostLimit", `${truth.daily_limit} posts/day`);
    setText("extensionPostsUsed", `${truth.posts_used_today}`);
    setText("extensionRemainingPosts", `${truth.posts_remaining_today}`);
    setText("extensionAccessState", truth.access_state);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => render().catch(console.error), { once: true });
  } else {
    render().catch(console.error);
  }

  setTimeout(() => render().catch(() => {}), 1200);
})();
