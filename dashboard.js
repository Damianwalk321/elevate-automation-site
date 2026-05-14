
(() => {
  if (window.__ELEVATE_DASHBOARD_PHASE18_20_LOADER__) return;
  window.__ELEVATE_DASHBOARD_PHASE18_20_LOADER__ = true;

  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  NS.version = "bundle2-core-runtime-intelligence-review-2-4-20260513";
  NS.modules = NS.modules || {};
  NS.events = NS.events || new EventTarget();
  NS.loaderState = NS.loaderState && typeof NS.loaderState === "object" ? NS.loaderState : {};

  const MODULES = [
    "/dashboard-state.js?v=20260513truth2",
    "/dashboard-ui.js?v=20260406p12a",
    "/dashboard-section-governor.js?v=20260513stable1",
    "/dashboard-api.js?v=20260513truth1",
    "/dashboard-overview.js?v=20260512cc3",
    "/dashboard-listings-v23.js?v=20260513review24a",
    "/dashboard-profile.js?v=20260406p12a",
    "/dashboard-analytics.js?v=20260513performance1",
    "/dashboard-affiliate.js?v=20260406p12a",
    "/dashboard-billing.js?v=20260406p12a",
    "/dashboard-bootstrap.js?v=20260406p12a"
  ];

  const MODULE_STAGE_GROUPS = [
    { upto: 3, label: "Core shell" },
    { upto: 7, label: "Workspace modules" },
    { upto: 10, label: "Operator panels" },
    { upto: MODULES.length, label: "Bootstrap" }
  ];

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function setLoaderState(state) { try { document.body?.setAttribute("data-ea-loader", state); NS.loaderState.state = state; NS.loaderState.updatedAt = new Date().toISOString(); publishLoaderDiagnostics(); } catch {} }
  function setFriendlyStatus(message) { const bootStatus = document.getElementById("bootStatus"); if (bootStatus && /waiting|loading|boot/i.test(clean(bootStatus.textContent || ""))) bootStatus.textContent = ""; const welcomeText = document.getElementById("welcomeText"); if (!welcomeText) return; const current = clean(welcomeText.textContent || ""); const looksLoading = !current || /loading|booting|starting/i.test(current); if (message && looksLoading) welcomeText.textContent = message; }
  function setBootStatus(message) { const bootStatus = document.getElementById("bootStatus"); if (bootStatus) bootStatus.textContent = message || ""; }
  function stageLabelForIndex(index) { const oneBased = Math.max(1, Number(index) || 1); const group = MODULE_STAGE_GROUPS.find((item) => oneBased <= item.upto); return group?.label || "Finalizing workspace"; }
  function publishLoaderDiagnostics() { try { NS.events?.dispatchEvent?.(new CustomEvent("loader:state", { detail: { ...NS.loaderState } })); } catch {} }
  function updateProgress(index, src) { try { const loaded = Math.max(0, index); const stageLabel = stageLabelForIndex(loaded + 1); NS.loaderState.totalModules = MODULES.length; NS.loaderState.loadedModules = loaded; NS.loaderState.currentModule = src || ""; NS.loaderState.stageLabel = stageLabel; document.body?.setAttribute("data-ea-loader-progress", `${loaded}/${MODULES.length}`); if (loaded < MODULES.length) setBootStatus(`Loading stage: ${stageLabel} • ${loaded}/${MODULES.length}`); publishLoaderDiagnostics(); } catch {} }
  function hasCanonicalTruth() { const truth = window.ElevateDashboard?.accountTruth || null; if (truth && truth.user_id) return true; try { const raw = localStorage.getItem("elevate.account_truth.v1"); if (!raw) return false; const parsed = JSON.parse(raw); return Boolean(parsed && (parsed.user_id || parsed.email) && parsed.canonical_profile_table); } catch { return false; } }
  function authStillSettling() { const bootstrap = window.ElevateDashboard?.bootstrapState || {}; return Boolean(bootstrap.authSettling) || !Boolean(window.ElevateDashboard?.authSettled); }
  function loadScriptSequentially(index = 0) { if (index >= MODULES.length) return Promise.resolve(); const src = MODULES[index]; updateProgress(index, src); return new Promise((resolve, reject) => { const existing = Array.from(document.scripts).find((s) => s.src && s.src.includes(src.split("?")[0])); if (existing) { updateProgress(index + 1, src); return resolve(); } const script = document.createElement("script"); script.src = src; script.async = false; script.onload = () => { updateProgress(index + 1, src); resolve(); }; script.onerror = () => reject(new Error(`Failed to load ${src}`)); document.head.appendChild(script); }).then(() => loadScriptSequentially(index + 1)); }

  setLoaderState("loading");
  setFriendlyStatus("Loading your operator workspace...");
  updateProgress(0, MODULES[0]);
  loadScriptSequentially().then(() => { setLoaderState(hasCanonicalTruth() ? "truth-ready" : "modules-loaded"); setBootStatus(hasCanonicalTruth() ? "Canonical account data loaded." : (authStillSettling() ? "Modules loaded. Waiting for auth settle..." : "Modules loaded. Waiting for canonical account data...")); }).catch((error) => { console.error("[Elevate Dashboard] Loader error:", error); NS.loaderState.lastError = error?.message || String(error); setLoaderState("error"); setFriendlyStatus("Workspace load hit an issue. Refresh the page or use Refresh Access."); setBootStatus(`Loader error: ${NS.loaderState.lastError}`); });
})();
