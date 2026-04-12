(() => {
  if (window.__ELEVATE_DASHBOARD_PHASE18_20_LOADER__) return;
  window.__ELEVATE_DASHBOARD_PHASE18_20_LOADER__ = true;

  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  NS.version = "phase21-bundle-v1";
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
    "/dashboard-bootstrap.js?v=20260406p12a",
    "/dashboard-phase2-render.js?v=20260411p2",
    "/dashboard-phase3-canonical.js?v=20260411p3",
    "/dashboard-phase4-readiness.js?v=20260411p4",
    "/dashboard-phase4_2-cleanup.js?v=20260411p42",
    "/dashboard-phase5-command.js?v=20260411p5",
    "/dashboard-phase5_2-hotfix.js?v=20260411p52",
    "/dashboard-phase5_3-listings-shell.js?v=20260411p53",
    "/dashboard-phase5_4-overview-listings.js?v=20260411p54",
    "/dashboard-phase5_5-overview-sync.js?v=20260411p55",
    "/dashboard-phase5_6-overview-promote.js?v=20260411p56",
    "/dashboard-phase5_7R-layout-only.js?v=20260411p57r",
    "/dashboard-phase6-intelligence.js?v=20260411p6",
    "/dashboard-phase7-events.js?v=20260411p7",
    "/dashboard-phase8R-containment.js?v=20260411p8r",
    "/dashboard-phase9-commercial.js?v=20260411p9",
    "/dashboard-phase10-moat.js?v=20260411p10",
    "/dashboard-phase11R-safe-consolidation.js?v=20260411p11r",
    "/dashboard-phase12-summary.js?v=20260411p12",
    "/dashboard-phase13-entities.js?v=20260411p13",
    "/dashboard-phase14-registry-authority.js?v=20260411p14",
    "/dashboard-phase15-attribution-v2.js?v=20260411p15",
    "/dashboard-phase16-optimization-v2.js?v=20260411p16",
    "/dashboard-phase17-team-command-v2.js?v=20260411p17",
    "/dashboard-phase18-commercial-v2.js?v=20260411p18",
    "/dashboard-phase19-language-compression.js?v=20260411p19",
    "/dashboard-phase20-rc-hardening.js?v=20260411p20",
    "/dashboard-phase21-shell-cleanup.js?v=20260412p21"
  ];

  let compatBootTriggered = false;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function setLoaderState(state) {
    try { document.body?.setAttribute("data-ea-loader", state); } catch {}
  }

  function setFriendlyStatus(message) {
    const bootStatus = document.getElementById("bootStatus");
    if (bootStatus) bootStatus.textContent = "";
    const welcomeText = document.getElementById("welcomeText");
    if (!welcomeText) return;
    const current = clean(welcomeText.textContent || "");
    const looksLoading = !current || /loading|booting|starting/i.test(current);
    if (message && looksLoading) welcomeText.textContent = message;
  }

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
            try { listener.call(document, new Event("DOMContentLoaded")); }
            catch (error) { console.error("[Elevate Dashboard] Late DOMContentLoaded listener failed:", error); }
          });
        } catch {
          setTimeout(() => {
            try { listener.call(document, new Event("DOMContentLoaded")); }
            catch (innerError) { console.error("[Elevate Dashboard] Late DOMContentLoaded listener failed:", innerError); }
          }, 0);
        }
        if (options && typeof options === "object" && options.once) return;
      }
      return originalAddEventListener(type, listener, options);
    };
  }

  function userLooksHydrated() {
    const emailText = clean(document.querySelector(".user-email")?.textContent || "");
    return Boolean(window.currentUser?.id || (emailText && !/loading/i.test(emailText)));
  }

  function kickLegacyBoot() {
    if (compatBootTriggered) return;
    compatBootTriggered = true;
    try { document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true, cancelable: true })); }
    catch (error) { console.error("[Elevate Dashboard] Compatibility boot failed:", error); }
  }

  function installControlledBootKick() {
    if (window.__ELEVATE_CONTROLLED_BOOT_KICK__) return;
    window.__ELEVATE_CONTROLLED_BOOT_KICK__ = true;
    setTimeout(() => { if (!userLooksHydrated()) kickLegacyBoot(); }, 600);
  }

  function loadScriptSequentially(index = 0) {
    if (index >= MODULES.length) return Promise.resolve();
    const src = MODULES[index];
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((s) => s.src && s.src.includes(src.split("?")[0]));
      if (existing) return resolve();
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    }).then(() => loadScriptSequentially(index + 1));
  }

  installLateDOMContentLoadedCompat();
  setLoaderState("loading");
  setFriendlyStatus("Loading your operator workspace...");

  loadScriptSequentially()
    .then(() => {
      installControlledBootKick();
      setLoaderState("modules-loaded");
    })
    .catch((error) => {
      console.error("[Elevate Dashboard] Loader error:", error);
      setLoaderState("error");
      setFriendlyStatus("Workspace load hit an issue. Refresh the page or use Refresh Access.");
    });
})();
