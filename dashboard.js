(() => {
  if (window.__ELEVATE_DASHBOARD_PHASE4_LOADER__) {
    console.warn("[Elevate Dashboard] Phase 4 loader already initialized.");
    return;
  }
  window.__ELEVATE_DASHBOARD_PHASE4_LOADER__ = true;

  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  NS.version = "phase4-loader-v3";
  NS.modules = NS.modules || {};
  NS.events = NS.events || new EventTarget();

  const MODULES = [
    "/dashboard-state.js?v=20260406p12a",
    "/dashboard-ui.js?v=20260406p12a",
    "/dashboard-api.js?v=20260406p12a",
    "/dashboard-overview.js?v=20260406p12a",
    "/dashboard-listings.js?v=20260406p12a",
    "/dashboard-profile.js?v=20260406p12a",
    "/dashboard-tools.js?v=20260406p12a",
    "/dashboard-analytics.js?v=20260406p12a",
    "/dashboard-affiliate.js?v=20260406p12a",
    "/dashboard-billing.js?v=20260406p12a",
    "/dashboard-legacy.js?v=20260406p12a",
    "/dashboard-phase4-boot.js?v=20260406p12a",
    "/dashboard-bootstrap.js?v=20260406p12a"
  ];

  function installLateDOMContentLoadedCompat() {
    if (window.__ELEVATE_LATE_DOMCONTENTLOADED_COMPAT__) return;
    window.__ELEVATE_LATE_DOMCONTENTLOADED_COMPAT__ = true;

    const originalAddEventListener = document.addEventListener.bind(document);

    document.addEventListener = function (type, listener, options) {
      if (
        type === "DOMContentLoaded" &&
        typeof listener === "function" &&
        document.readyState !== "loading"
      ) {
        try {
          queueMicrotask(() => {
            try {
              listener.call(document, new Event("DOMContentLoaded"));
            } catch (error) {
              console.error("[Elevate Dashboard] Late DOMContentLoaded listener failed:", error);
            }
          });
        } catch (error) {
          setTimeout(() => {
            try {
              listener.call(document, new Event("DOMContentLoaded"));
            } catch (innerError) {
              console.error("[Elevate Dashboard] Late DOMContentLoaded listener failed:", innerError);
            }
          }, 0);
        }

        if (options && typeof options === "object" && options.once) {
          return;
        }
      }

      return originalAddEventListener(type, listener, options);
    };
  }

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

  installLateDOMContentLoadedCompat();

  loadScriptSequentially().catch((error) => {
    console.error("[Elevate Dashboard] Phase 4 loader error:", error);
    const status = document.getElementById("bootStatus");
    if (status) {
      status.textContent = `Phase 4 loader failed: ${error.message || "Unknown error"}`;
    }
  });
})();
