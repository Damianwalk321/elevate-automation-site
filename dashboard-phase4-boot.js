(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase4boot) return;

  function loadPhase5Workflow() {
    const src = "/dashboard-phase5-workflow.js?v=20260403pr1";
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

  async function boot() {
    try {
      NS.overview?.applyOverviewHierarchy?.();
      await loadPhase5Workflow().catch((error) => {
        console.warn("[Elevate Dashboard] Phase 5 workflow load warning:", error);
      });
      NS.phase5workflow?.renderSalesOS?.();
      if (NS.events) {
        NS.events.addEventListener("state:set", () => {
          try { NS.phase5workflow?.renderSalesOS?.(); } catch {}
        });
      }
  function boot() {
    try {
      NS.overview?.applyOverviewHierarchy?.();
      if (NS.state) NS.state.set("booted", true);
    } catch (error) {
      console.warn("[Elevate Dashboard] Phase 4 boot warning:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { boot(); });
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  NS.modules = NS.modules || {};
  NS.modules.phase4boot = true;
})();
