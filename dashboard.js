(() => {
  if (window.__ELEVATE_DASHBOARD_PHASE4_LOADER__) {
    console.warn("[Elevate Dashboard] Phase 4 loader already initialized.");
    return;
  }
  window.__ELEVATE_DASHBOARD_PHASE4_LOADER__ = true;

  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  NS.version = "phase4-loader-v1";
  NS.modules = NS.modules || {};
  NS.events = NS.events || new EventTarget();

  const MODULES = [
    "/dashboard-state.js?v=20260403p4a",
    "/dashboard-ui.js?v=20260403p4a",
    "/dashboard-api.js?v=20260403p4a",
    "/dashboard-overview.js?v=20260403p4a",
    "/dashboard-listings.js?v=20260403p4a",
    "/dashboard-profile.js?v=20260403p4a",
    "/dashboard-tools.js?v=20260403p4a",
    "/dashboard-analytics.js?v=20260403p4a",
    "/dashboard-affiliate.js?v=20260403p4a",
    "/dashboard-billing.js?v=20260403p4a",
    "/dashboard-legacy.js?v=20260403p4a",
    "/dashboard-phase4-boot.js?v=20260403p4a"
  ];

  function loadScriptSequentially(index = 0) {
    if (index >= MODULES.length) return Promise.resolve();

    const src = MODULES[index];
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((s) => s.src && s.src.includes(src.split("?")[0]));
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    }).then(() => loadScriptSequentially(index + 1));
  }

  loadScriptSequentially().catch((error) => {
    console.error("[Elevate Dashboard] Phase 4 loader error:", error);
    const status = document.getElementById("bootStatus");
    if (status) {
      status.textContent = `Phase 4 loader failed: ${error.message || "Unknown error"}`;
    }
  });
})();
