(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase4boot) return;

  function boot() {
    try {
      NS.overview?.applyOverviewHierarchy?.();
      if (NS.state) NS.state.set("booted", true);
    } catch (error) {
      console.warn("[Elevate Dashboard] Phase 4 boot warning:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  NS.modules = NS.modules || {};
  NS.modules.phase4boot = true;
})();
