(() => {
  if (window.__ELEVATE_DASHBOARD_PHASE4_LOADER__) {
    console.warn("[Elevate Dashboard] Phase 4 loader already initialized.");
    return;
  }
  window.__ELEVATE_DASHBOARD_PHASE4_LOADER__ = true;

  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  NS.version = "phase4-loader-v5";
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

  function installBlockingApiFallbacks() {
    if (window.__ELEVATE_BLOCKING_API_FALLBACKS__) return;
    window.__ELEVATE_BLOCKING_API_FALLBACKS__ = true;

    const originalFetch = window.fetch.bind(window);
    const TIMEOUTS = {
      "/api/get-dashboard-summary": 2500,
      "/api/get-user-listings": 2500
    };

    function getUrl(input) {
      return typeof input === "string" ? input : (input && input.url) ? input.url : "";
    }

    function matchPath(url) {
      return Object.keys(TIMEOUTS).find((path) => url.includes(path)) || "";
    }

    function jsonResponse(payload, headers = {}) {
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json", ...headers }
      });
    }

    function fallbackPayloadFor(path) {
      if (path.includes("/api/get-dashboard-summary")) {
        return jsonResponse({
          success: true,
          data: {},
          meta: { fallback: "timeout_summary" }
        }, { "x-elevate-fallback": "summary-timeout" });
      }

      if (path.includes("/api/get-user-listings")) {
        return jsonResponse({
          success: true,
          data: [],
          meta: {
            warnings: ["listings_timeout_fallback"],
            sources: { user_listings: 0, listings: 0, merged: 0 }
          }
        }, { "x-elevate-fallback": "listings-timeout" });
      }

      return jsonResponse({ success: true, data: {} }, { "x-elevate-fallback": "generic-timeout" });
    }

    window.fetch = async function (input, init) {
      const url = getUrl(input);
      const matchedPath = matchPath(url);
      if (!matchedPath) {
        return originalFetch(input, init);
      }

      let timeoutId = null;
      try {
        return await Promise.race([
          originalFetch(input, init),
          new Promise((resolve) => {
            timeoutId = setTimeout(() => {
              console.warn(`[Elevate Dashboard] ${matchedPath} timed out; using fallback payload.`);
              resolve(fallbackPayloadFor(matchedPath));
            }, TIMEOUTS[matchedPath]);
          })
        ]);
      } catch (error) {
        console.warn(`[Elevate Dashboard] ${matchedPath} failed; using fallback payload.`, error);
        return fallbackPayloadFor(matchedPath);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };
  }

  function installNonBlockingFirstPaint() {
    if (window.__ELEVATE_NONBLOCKING_FIRST_PAINT__) return;
    window.__ELEVATE_NONBLOCKING_FIRST_PAINT__ = true;

    function revealOverview() {
      try {
        if (typeof window.showSection === "function") {
          window.showSection("overview");
        }
        const boot = document.getElementById("bootStatus");
        if (boot && /loading|booting/i.test(String(boot.textContent || ""))) {
          boot.textContent = "Loading dashboard data in background...";
        }
        document.body.setAttribute("data-ea-first-paint", "true");
      } catch (error) {
        console.warn("[Elevate Dashboard] first-paint reveal warning:", error);
      }
    }

    setTimeout(revealOverview, 1200);
    setTimeout(revealOverview, 2400);
    setTimeout(revealOverview, 4200);
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
  installBlockingApiFallbacks();
  installNonBlockingFirstPaint();

  loadScriptSequentially().catch((error) => {
    console.error("[Elevate Dashboard] Phase 4 loader error:", error);
    const status = document.getElementById("bootStatus");
    if (status) {
      status.textContent = `Phase 4 loader failed: ${error.message || "Unknown error"}`;
    }
  });
})();
