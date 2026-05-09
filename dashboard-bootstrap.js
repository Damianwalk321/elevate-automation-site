(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.bootstrap) return;

  const RETRY_TIMEOUT_MS = 12000;
  const POLL_MS = 350;
  const AUTH_SETTLE_MS = 2200;
  const REQUIRED_FAILED_AUTH_TICKS = 2;

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function ensureBootstrapState() {
    NS.bootstrapState = NS.bootstrapState && typeof NS.bootstrapState === "object" ? NS.bootstrapState : {};
    if (!Array.isArray(NS.bootstrapState.stages)) NS.bootstrapState.stages = [];
    NS.bootstrapState.failedAuthTicks = Number(NS.bootstrapState.failedAuthTicks || 0);
    return NS.bootstrapState;
  }

  function setWorkspaceState(state) {
    try {
      document.body?.setAttribute("data-dashboard-ready", state);
    } catch {}
  }

  function setFriendlyStatus(message) {
    const bootStatus = document.getElementById("bootStatus");
    if (bootStatus && /waiting|loading|boot/i.test(clean(bootStatus.textContent || ""))) bootStatus.textContent = "";

    const welcomeText = document.getElementById("welcomeText");
    if (!welcomeText || !message) return;

    const current = clean(welcomeText.textContent || "");
    const looksLoading = !current || /loading|booting|starting|workspace is taking longer/i.test(current);
    if (looksLoading) {
      welcomeText.textContent = message;
    }
  }

  function setBootStatus(message) {
    const bootStatus = document.getElementById("bootStatus");
    if (bootStatus) bootStatus.textContent = message || "";
  }

  function pushStage(label, detail = "") {
    const state = ensureBootstrapState();
    const line = detail ? `${label}: ${detail}` : label;
    state.stages.push(line);
    state.lastStage = line;
    if (state.stages.length > 12) state.stages = state.stages.slice(-12);
  }

  function readCanonicalTruth() {
    if (NS.accountTruth && typeof NS.accountTruth === "object") return NS.accountTruth;
    try {
      const raw = localStorage.getItem("elevate.account_truth.v1");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function hasVisibleAuthenticatedUser() {
    const userEmailText = clean(qs(".user-email")?.textContent || "");
    const loggedInBanner = clean(document.body?.textContent?.includes("LOGGED IN") ? "LOGGED IN" : "");
    return Boolean(
      window.currentUser?.id ||
      (userEmailText && !/loading/i.test(userEmailText)) ||
      loggedInBanner
    );
  }

  function getIndicators() {
    const userEmailText = clean(qs(".user-email")?.textContent || "");
    const welcomeText = clean(document.getElementById("welcomeText")?.textContent || "");
    const canonicalTruth = readCanonicalTruth();
    const hasCanonicalTruth = Boolean(canonicalTruth && (canonicalTruth.user_id || canonicalTruth.email));
    const hasUser = Boolean(window.currentUser?.id) || hasCanonicalTruth || Boolean(userEmailText && !/loading/i.test(userEmailText));
    const hasSession = Boolean(window.currentNormalizedSession?.subscription || window.currentAccountData || hasCanonicalTruth);
    const hasSummary = Boolean(window.dashboardSummary && typeof window.dashboardSummary === "object") || hasCanonicalTruth;
    const listingsReady = Array.isArray(window.dashboardListings);
    const activeSectionVisible = Array.from(document.querySelectorAll(".dashboard-section")).some((section) => section.style.display === "block");
    const visibleDashboardContent = Boolean(
      document.getElementById("recentListingsGrid")?.children?.length ||
      document.getElementById("overview")?.textContent?.includes("Operate the highest") ||
      activeSectionVisible
    );
    const shellLoading = /loading/i.test(userEmailText) || /loading workspace|loading operator/i.test(welcomeText);
    const authSettled = Boolean(NS.authSettled || canonicalTruth?.auth_settled || canonicalTruth?.truth_ready);

    return {
      hasUser,
      hasSession,
      hasSummary,
      hasCanonicalTruth,
      listingsReady,
      activeSectionVisible,
      visibleDashboardContent,
      shellLoading,
      authSettled,
      hasVisibleAuthenticatedUser: hasVisibleAuthenticatedUser()
    };
  }

  function waitingStage(indicators) {
    if (!indicators.hasUser) return "Waiting on auth session";
    if (!indicators.hasCanonicalTruth && !indicators.hasSummary) return "Waiting on summary data";
    if (!indicators.hasSession) return "Waiting on account access";
    if (!indicators.listingsReady && !indicators.visibleDashboardContent && !indicators.activeSectionVisible) return "Waiting on dashboard sections";
    return "Hydration in progress";
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
    NS.phase2render?.markReady?.("ready");
    const state = ensureBootstrapState();
    state.ready = true;
    state.readyAt = new Date().toISOString();
    state.authSettled = true;
    NS.authSettled = true;

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
    const state = ensureBootstrapState();
    setWorkspaceState("false");
    NS.phase2render?.prepare?.();
    pushStage("Bootstrap", "Watching startup silently in production mode.");

    const startedAt = Date.now();
    let readyCount = 0;

    const tick = () => {
      const indicators = getIndicators();
      const elapsed = Date.now() - startedAt;
      const stageText = waitingStage(indicators);
      state.waitingStage = stageText;
      state.authSettling = elapsed < AUTH_SETTLE_MS && !indicators.authSettled;
      setBootStatus(state.authSettling ? `${stageText} • settling auth...` : stageText);

      if (indicators.hasCanonicalTruth || indicators.hasSession || indicators.hasVisibleAuthenticatedUser) {
        state.failedAuthTicks = 0;
      } else if (!state.authSettling) {
        state.failedAuthTicks += 1;
      }

      if (indicators.hasUser && !indicators.hasSummary) {
        setFriendlyStatus("Loading your workspace data...");
      } else if (indicators.hasSummary && !indicators.hasSession) {
        setFriendlyStatus("Finalizing account access...");
      }

      if (indicators.hasSummary && indicators.hasSession) {
        maybeRenderPhase5();
      }

      const readyNow =
        indicators.hasCanonicalTruth || (
          indicators.hasUser &&
          indicators.hasSession &&
          indicators.hasSummary &&
          (indicators.listingsReady || indicators.visibleDashboardContent || indicators.activeSectionVisible)
        );

      if (readyNow) {
        readyCount += 1;
      } else {
        readyCount = 0;
      }

      if (readyCount >= 2) {
        pushStage("Ready", indicators.hasCanonicalTruth ? "Canonical dashboard truth detected." : "Core dashboard hydration completed.");
        finalizeReady("Workspace ready.");
        clearInterval(intervalId);
        return;
      }

      if (
        !state.authSettling &&
        state.failedAuthTicks >= REQUIRED_FAILED_AUTH_TICKS &&
        !indicators.hasCanonicalTruth &&
        !indicators.hasVisibleAuthenticatedUser
      ) {
        pushStage("Auth", "Stable unauthenticated state detected.");
        state.authSettled = true;
        NS.authSettled = true;
      }

      if (Date.now() - startedAt > RETRY_TIMEOUT_MS) {
        if (indicators.hasCanonicalTruth || indicators.visibleDashboardContent || (indicators.hasUser && indicators.hasSession && indicators.hasSummary)) {
          pushStage("Ready", "Dashboard is usable; soft timeout ignored.");
          finalizeReady("Workspace ready.");
        } else {
          setWorkspaceState("timeout");
          NS.phase2render?.markReady?.("timeout");
          setFriendlyStatus("Workspace is taking longer than normal. Refresh Access if needed.");
          setBootStatus(`${stageText} • timed out`);
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
    state.startedAt = new Date().toISOString();
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
