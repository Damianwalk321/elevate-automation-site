(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase1stabilizer) return;

  const FLAG = "__ELEVATE_PHASE1_LAYOUT_STABILIZED__";

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function setStatus(message) {
    const bootStatus = document.getElementById("bootStatus");
    if (bootStatus) bootStatus.textContent = "";
    const welcomeText = document.getElementById("welcomeText");
    if (!welcomeText || !message) return;
    const current = clean(welcomeText.textContent || "");
    if (!current || /loading|booting|starting|workspace/i.test(current)) {
      welcomeText.textContent = message;
    }
  }

  function promoteCanonicalOverviewPass() {
    if (window[FLAG]) return true;
    try {
      NS.overview?.applyOverviewHierarchy?.();
      window[FLAG] = true;
      return true;
    } catch (error) {
      console.warn("[Elevate Dashboard] Phase 1 overview hierarchy warning:", error);
      return false;
    }
  }

  function bindBootstrapEvents() {
    if (window.__ELEVATE_PHASE1_EVENTS_BOUND__) return;
    window.__ELEVATE_PHASE1_EVENTS_BOUND__ = true;

    window.addEventListener("elevate:phase1-loader-complete", () => {
      setStatus("Finalizing workspace layout...");
      promoteCanonicalOverviewPass();
      NS.phase2render?.queueReadyCheck?.();
    });

    NS.events?.addEventListener?.("state:set", () => {
      promoteCanonicalOverviewPass();
      NS.phase2render?.queueReadyCheck?.();
    });

    window.addEventListener("elevate:workflow-updated", () => {
      NS.phase2render?.queueReadyCheck?.();
    });
  }

  function boot() {
    bindBootstrapEvents();
    setStatus("Loading your operator workspace...");
    promoteCanonicalOverviewPass();
    setTimeout(() => promoteCanonicalOverviewPass(), 400);
    setTimeout(() => NS.phase2render?.queueReadyCheck?.(), 700);
  }

  NS.phase1stabilizer = { boot, promoteCanonicalOverviewPass };
  NS.modules = NS.modules || {};
  NS.modules.phase1stabilizer = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();