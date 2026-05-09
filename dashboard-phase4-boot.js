(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase4boot) return;

  let renderScheduled = false;
  let lastRenderReason = "";
  let lastRenderDigest = "";

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function buildRenderDigest() {
    const truth = NS.accountTruth || {};
    const summary = window.dashboardSummary || {};
    const listings = Array.isArray(window.dashboardListings) ? window.dashboardListings.length : 0;
    return JSON.stringify({
      truth_ready: Boolean(NS.truthReady || truth.truth_ready),
      auth_settled: Boolean(NS.authSettled || truth.auth_settled),
      user_id: clean(truth.user_id || summary?.account_snapshot?.user_id || ""),
      email: clean(truth.email || summary?.account_snapshot?.email || ""),
      queue_count: Number(summary?.queue_count || 0),
      review_queue_count: Number(summary?.review_queue_count || 0),
      listings
    });
  }

  function shouldRenderForStateEvent(detail = {}) {
    const key = clean(detail?.key || detail?.name || "").toLowerCase();
    if (!key) return false;
    return ["summary", "session", "profile", "listings", "accounttruth"].includes(key);
  }

  function loadPhase5Workflow() {
    const src = "/dashboard-phase5-workflow.js?v=20260403pr2";
    const existing = Array.from(document.scripts).find((s) => s.src && s.src.includes("/dashboard-phase5-workflow.js"));
    if (existing) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  function runPhase5Render(reason = "boot") {
    const digest = buildRenderDigest();
    const truthReady = Boolean(NS.truthReady || NS.accountTruth?.truth_ready);
    const authSettled = Boolean(NS.authSettled || NS.accountTruth?.auth_settled);

    if (reason !== "boot" && digest === lastRenderDigest) return;
    if (reason !== "boot" && !truthReady && !authSettled) return;

    lastRenderDigest = digest;
    lastRenderReason = reason;

    try {
      NS.overview?.applyOverviewHierarchy?.();
    } catch (error) {
      console.warn("[Elevate Dashboard] Overview hierarchy warning:", error);
    }

    try {
      NS.phase5workflow?.renderSalesOS?.();
    } catch (error) {
      console.warn("[Elevate Dashboard] Phase 5 render warning:", error);
    }
  }

  function scheduleRender(reason = "state") {
    if (renderScheduled) return;
    renderScheduled = true;
    setTimeout(() => {
      renderScheduled = false;
      runPhase5Render(reason);
    }, 180);
  }

  async function boot() {
    try {
      await loadPhase5Workflow().catch((error) => {
        console.warn("[Elevate Dashboard] Phase 5 workflow load warning:", error);
      });

      runPhase5Render("boot");

      if (NS.events && !NS.__phase4StateListenerBound) {
        NS.__phase4StateListenerBound = true;
        NS.events.addEventListener("state:set", (event) => {
          if (!shouldRenderForStateEvent(event?.detail || {})) return;
          scheduleRender("state:set");
        });
      }

      if (!window.__ELEVATE_PHASE4_TRUTH_BOUND__) {
        window.__ELEVATE_PHASE4_TRUTH_BOUND__ = true;
        window.addEventListener("elevate:account-truth", () => {
          scheduleRender("account-truth");
        });
      }

      if (!window.__ELEVATE_PHASE4_SYNC_BOUND__) {
        window.__ELEVATE_PHASE4_SYNC_BOUND__ = true;
        window.addEventListener("elevate:sync-refreshed", () => {
          scheduleRender("sync-refreshed");
        });
      }

      if (NS.state) NS.state.set("booted", true);
    } catch (error) {
      console.warn("[Elevate Dashboard] Phase 4 boot warning:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  NS.phase4boot = {
    scheduleRender,
    getLastRenderReason: () => lastRenderReason
  };
  NS.modules = NS.modules || {};
  NS.modules.phase4boot = true;
})();
