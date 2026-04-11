(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.bootstrap) return;

  const RETRY_TIMEOUT_MS = 12000;
  const POLL_MS = 400;

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function ensureBootstrapState() {
    NS.bootstrapState = NS.bootstrapState && typeof NS.bootstrapState === "object" ? NS.bootstrapState : {};
    if (!Array.isArray(NS.bootstrapState.stages)) NS.bootstrapState.stages = [];
    return NS.bootstrapState;
  }

  function setWorkspaceState(state) {
    try {
      document.body?.setAttribute("data-dashboard-ready", state);
    } catch {}
  }

  function setFriendlyStatus(message) {
    const bootStatus = document.getElementById("bootStatus");
    if (bootStatus) bootStatus.textContent = "";

    const welcomeText = document.getElementById("welcomeText");
    if (!welcomeText || !message) return;

    const current = clean(welcomeText.textContent || "");
    const looksLoading = !current || /loading|booting|starting|workspace is taking longer/i.test(current);
    if (looksLoading) {
      welcomeText.textContent = message;
    }
  }

  function pushStage(label, detail = "") {
    const state = ensureBootstrapState();
    const line = detail ? `${label}: ${detail}` : label;
    state.stages.push(line);
    if (state.stages.length > 12) state.stages = state.stages.slice(-12);
  }

  function getIndicators() {
    const userEmailText = clean(qs(".user-email")?.textContent || "");
    const welcomeText = clean(document.getElementById("welcomeText")?.textContent || "");
    const hasUser = Boolean(window.currentUser?.id) || Boolean(userEmailText && !/loading/i.test(userEmailText));
    const hasSession = Boolean(window.currentNormalizedSession?.subscription || window.currentAccountData);
    const hasSummary = Boolean(window.dashboardSummary && typeof window.dashboardSummary === "object");
    const listingsReady = Array.isArray(window.dashboardListings);
    const activeSectionVisible = Array.from(document.querySelectorAll(".dashboard-section")).some((section) => section.style.display === "block");
    const visibleDashboardContent = Boolean(
      document.getElementById("recentListingsGrid")?.children?.length ||
      document.getElementById("overview")?.textContent?.includes("Operate the highest") ||
      activeSectionVisible
    );
    const shellLoading = /loading/i.test(userEmailText) || /loading workspace|loading operator/i.test(welcomeText);

    return {
      hasUser,
      hasSession,
      hasSummary,
      listingsReady,
      activeSectionVisible,
      visibleDashboardContent,
      shellLoading
    };
  }

  function maybeRenderPhase5() {
    try {
      NS.phase5workflow?.renderSalesOS?.();
    } catch (error) {
      console.warn("[Elevate Dashboard] Phase 5 render warning:", error);
    }
  }

  function finalizeReady(detailMessage) {
    setWorkspaceState("true");
    const bootStatus = document.getElementById("bootStatus");
    if (bootStatus) bootStatus.textContent = "";

    const welcomeText = document.getElementById("welcomeText");
    if (welcomeText) {
      const current = clean(welcomeText.textContent || "");
      if (!current || /loading|booting|starting|workspace is taking longer/i.test(current)) {
        welcomeText.textContent = detailMessage || "Workspace ready.";
      }
    }
  }

  function startWatch() {
    ensureBootstrapState();
    setWorkspaceState("false");
    pushStage("Bootstrap", "Watching startup silently in production mode.");

    const startedAt = Date.now();
    let readyCount = 0;

    const tick = () => {
      const indicators = getIndicators();

      if (indicators.hasUser && !indicators.hasSummary) {
        setFriendlyStatus("Loading your workspace data...");
      } else if (indicators.hasSummary && !indicators.hasSession) {
        setFriendlyStatus("Finalizing account access...");
      }

      if (indicators.hasSummary && indicators.hasSession) {
        maybeRenderPhase5();
      }

      const readyNow =
        indicators.hasUser &&
        indicators.hasSession &&
        indicators.hasSummary &&
        (indicators.listingsReady || indicators.visibleDashboardContent || indicators.activeSectionVisible);

      if (readyNow) {
        readyCount += 1;
      } else {
        readyCount = 0;
      }

      if (readyCount >= 2) {
        pushStage("Ready", "Core dashboard hydration completed.");
        finalizeReady("Workspace ready.");
        clearInterval(intervalId);
        return;
      }

      if (Date.now() - startedAt > RETRY_TIMEOUT_MS) {
        if (indicators.visibleDashboardContent || (indicators.hasUser && indicators.hasSession && indicators.hasSummary)) {
          pushStage("Ready", "Dashboard is usable; soft timeout ignored.");
          finalizeReady("Workspace ready.");
        } else {
          setWorkspaceState("timeout");
          setFriendlyStatus("Workspace is taking longer than normal. Refresh Access if needed.");
        }
        clearInterval(intervalId);
      }
    };

    const intervalId = setInterval(tick, POLL_MS);
    tick();
  }

  function boot() {
    const state = ensureBootstrapState();
    if (state.started) return;
    state.started = true;
    startWatch();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  NS.modules = NS.modules || {};
  NS.modules.bootstrap = true;
})();
