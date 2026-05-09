
(() => {
  if (window.__ELEVATE_DASHBOARD_PHASE18_20_LOADER__) return;
  window.__ELEVATE_DASHBOARD_PHASE18_20_LOADER__ = true;

  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  NS.version = "phase25-bundle-e";
  NS.modules = NS.modules || {};
  NS.events = NS.events || new EventTarget();
  NS.loaderState = NS.loaderState && typeof NS.loaderState === "object" ? NS.loaderState : {};

  const MODULES = [
    "/dashboard-state.js?v=20260406p12a",
    "/dashboard-ui.js?v=20260406p12a",
    "/dashboard-api.js?v=20260406p12a",
    "/dashboard-overview.js?v=20260406p12a",
    "/dashboard-listings.js?v=20260406p12a",
    "/dashboard-profile.js?v=20260406p12a",
    "/dashboard-tools.js?v=20260406p12a",
    "/dashboard-analytics.js?v=20260412p22e",
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
    "/dashboard-phase21-shell-repair.js?v=20260412p23",
    "/dashboard-phase23-bundle-c.js?v=20260412c1",
    "/dashboard-bundle-e-review-actions.js?v=20260412e1"
  ];

  const MODULE_STAGE_GROUPS = [
    { upto: 3, label: "Core shell" },
    { upto: 10, label: "Workspace modules" },
    { upto: 17, label: "Boot and readiness" },
    { upto: 24, label: "Overview and listings" },
    { upto: 32, label: "Intelligence and entities" },
    { upto: MODULES.length, label: "Hardening and review actions" }
  ];

  let compatBootTriggered = false;
  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function setLoaderState(state) {
    try {
      document.body?.setAttribute("data-ea-loader", state);
      NS.loaderState.state = state;
      NS.loaderState.updatedAt = new Date().toISOString();
      publishLoaderDiagnostics();
    } catch {}
  }
  function setFriendlyStatus(message) {
    const bootStatus = document.getElementById("bootStatus");
    if (bootStatus && /waiting|loading|boot/i.test(clean(bootStatus.textContent || ""))) bootStatus.textContent = "";
    const welcomeText = document.getElementById("welcomeText");
    if (!welcomeText) return;
    const current = clean(welcomeText.textContent || "");
    const looksLoading = !current || /loading|booting|starting/i.test(current);
    if (message && looksLoading) welcomeText.textContent = message;
  }
  function setBootStatus(message) {
    const bootStatus = document.getElementById("bootStatus");
    if (bootStatus) bootStatus.textContent = message || "";
  }
  function stageLabelForIndex(index) {
    const oneBased = Math.max(1, Number(index) || 1);
    const group = MODULE_STAGE_GROUPS.find((item) => oneBased <= item.upto);
    return group?.label || "Finalizing workspace";
  }
  function publishLoaderDiagnostics() {
    try {
      NS.events?.dispatchEvent?.(new CustomEvent("loader:state", { detail: { ...NS.loaderState } }));
    } catch {}
  }
  function updateProgress(index, src) {
    try {
      const loaded = Math.max(0, index);
      const stageLabel = stageLabelForIndex(loaded + 1);
      NS.loaderState.totalModules = MODULES.length;
      NS.loaderState.loadedModules = loaded;
      NS.loaderState.currentModule = src || "";
      NS.loaderState.stageLabel = stageLabel;
      document.body?.setAttribute("data-ea-loader-progress", `${loaded}/${MODULES.length}`);
      if (loaded < MODULES.length) {
        setBootStatus(`Loading stage: ${stageLabel} • ${loaded}/${MODULES.length}`);
      }
      publishLoaderDiagnostics();
    } catch {}
  }
  function installLateDOMContentLoadedCompat() {
    if (window.__ELEVATE_LATE_DOMCONTENTLOADED_COMPAT__) return;
    window.__ELEVATE_LATE_DOMCONTENTLOADED_COMPAT__ = true;
    const originalAddEventListener = document.addEventListener.bind(document);
    document.addEventListener = function (type, listener, options) {
      if (type === "DOMContentLoaded" && typeof listener === "function" && document.readyState !== "loading") {
        try { queueMicrotask(() => listener.call(document, new Event("DOMContentLoaded"))); } catch { setTimeout(() => listener.call(document, new Event("DOMContentLoaded")), 0); }
        if (options && typeof options === "object" && options.once) return;
      }
      return originalAddEventListener(type, listener, options);
    };
  }
  function hasCanonicalTruth() {
    const truth = window.ElevateDashboard?.accountTruth || null;
    if (truth && truth.user_id) return true;
    try {
      const raw = localStorage.getItem("elevate.account_truth.v1");
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed && (parsed.user_id || parsed.email) && parsed.canonical_profile_table);
    } catch {
      return false;
    }
  }
  function userLooksHydrated() {
    const emailText = clean(document.querySelector(".user-email")?.textContent || "");
    return Boolean(window.currentUser?.id || hasCanonicalTruth() || (emailText && !/loading/i.test(emailText)));
  }
  function kickLegacyBoot() {
    if (compatBootTriggered) return;
    compatBootTriggered = true;
    try {
      document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true, cancelable: true }));
      NS.events?.dispatchEvent?.(new CustomEvent("loader:compat-boot", { detail: { at: Date.now() } }));
    } catch (error) {
      console.error("[Elevate Dashboard] Compatibility boot failed:", error);
    }
  }
  function installControlledBootKick() {
    if (window.__ELEVATE_CONTROLLED_BOOT_KICK__) return;
    window.__ELEVATE_CONTROLLED_BOOT_KICK__ = true;
    setTimeout(() => {
      if (!userLooksHydrated() && !hasCanonicalTruth()) kickLegacyBoot();
    }, 600);
    setTimeout(() => {
      if (!userLooksHydrated() && !hasCanonicalTruth()) {
        setLoaderState("waiting-for-data");
        setFriendlyStatus("Finalizing your workspace data...");
        setBootStatus("Waiting on canonical account data...");
      }
    }, 1800);
  }
  function loadScriptSequentially(index = 0) {
    if (index >= MODULES.length) return Promise.resolve();
    const src = MODULES[index];
    updateProgress(index, src);
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((s) => s.src && s.src.includes(src.split("?")[0]));
      if (existing) {
        updateProgress(index + 1, src);
        return resolve();
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => {
        updateProgress(index + 1, src);
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    }).then(() => loadScriptSequentially(index + 1));
  }

  installLateDOMContentLoadedCompat();
  setLoaderState("loading");
  setFriendlyStatus("Loading your operator workspace...");
  updateProgress(0, MODULES[0]);

  loadScriptSequentially()
    .then(() => {
      installControlledBootKick();
      setLoaderState(hasCanonicalTruth() ? "truth-ready" : "modules-loaded");
      if (hasCanonicalTruth()) setBootStatus("Canonical account data loaded.");
      else setBootStatus("Modules loaded. Waiting for canonical account data...");
    })
    .catch((error) => {
      console.error("[Elevate Dashboard] Loader error:", error);
      NS.loaderState.lastError = error?.message || String(error);
      setLoaderState("error");
      setFriendlyStatus("Workspace load hit an issue. Refresh the page or use Refresh Access.");
      setBootStatus(`Loader error: ${NS.loaderState.lastError}`);
    });
})();
