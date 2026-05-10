(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.bootstrap) return;

  const AUTH_SETTLE_MS = 2200;
  const FINAL_TIMEOUT_MS = 12000;

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
    if (bootStatus && /waiting|loading|boot/i.test(clean(bootStatus.textContent || ""))) {
      bootStatus.textContent = "";
    }

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
    if (state.stages.length > 20) state.stages = state.stages.slice(-20);
    try {
      console.info("[Elevate Bootstrap]", line);
    } catch {}
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

  function hasAuthenticatedUser() {
    const truth = readCanonicalTruth();
    if (truth?.user_id || truth?.email) return true;
    const emailText = clean(document.querySelector(".user-email")?.textContent || "");
    if (emailText && !/loading/i.test(emailText)) return true;
    return Boolean(window.currentUser?.id || window.currentAccountData || window.currentNormalizedSession?.subscription);
  }

  function hasSummaryOrTruth() {
    const truth = readCanonicalTruth();
    if (truth?.truth_ready || truth?.user_id || truth?.email) return true;
    return Boolean(window.dashboardSummary && typeof window.dashboardSummary === "object");
  }

  function markReady(message = "Workspace ready.") {
    const state = ensureBootstrapState();
    if (state.ready) return;
    state.ready = true;
    state.readyAt = new Date().toISOString();
    state.authSettled = true;
    NS.authSettled = true;

    setWorkspaceState("true");
    NS.phase2render?.markReady?.("ready");

    const bootStatus = document.getElementById("bootStatus");
    if (bootStatus) bootStatus.textContent = "";

    const welcomeText = document.getElementById("welcomeText");
    if (welcomeText) {
      const current = clean(welcomeText.textContent || "");
      if (!current || /loading|booting|starting|workspace is taking longer/i.test(current)) {
        welcomeText.textContent = message;
      }
    }

    pushStage("Ready", "Canonical startup finished.");
  }

  function markFailed(message, detail = "") {
    const state = ensureBootstrapState();
    if (state.ready) return;
    state.failed = true;
    state.failedAt = new Date().toISOString();
    setWorkspaceState("timeout");
    NS.phase2render?.markReady?.("timeout");
    setFriendlyStatus(message || "Workspace is taking longer than normal. Refresh Access if needed.");
    setBootStatus(detail || "Startup timed out");
    pushStage("Failed", detail || message || "Startup timed out.");
  }

  function attemptReady(source = "check") {
    const state = ensureBootstrapState();
    if (state.ready) return true;

    const truth = readCanonicalTruth();
    const authSettled = Boolean(NS.authSettled || truth?.auth_settled || truth?.truth_ready);
    const hasUser = hasAuthenticatedUser();
    const hasSummary = hasSummaryOrTruth();

    if (hasUser && hasSummary) {
      pushStage("Ready check", `passed via ${source}`);
      markReady("Workspace ready.");
      return true;
    }

    if (authSettled && !hasUser) {
      pushStage("Auth", `settled unauthenticated via ${source}`);
      setWorkspaceState("auth-settled");
      setFriendlyStatus("Session not active. Please log in.");
      setBootStatus("Auth settled without active session.");
      return false;
    }

    pushStage("Waiting", `${source} • user=${hasUser} summary=${hasSummary} authSettled=${authSettled}`);
    setBootStatus(authSettled ? "Waiting on dashboard summary..." : "Waiting on auth settle...");
    if (hasUser && !hasSummary) setFriendlyStatus("Loading your workspace data...");
    return false;
  }

  function bindStartupListeners() {
    if (window.__ELEVATE_BOOTSTRAP_LISTENERS_BOUND__) return;
    window.__ELEVATE_BOOTSTRAP_LISTENERS_BOUND__ = true;

    const rerun = (source) => {
      try {
        attemptReady(source);
      } catch (error) {
        console.warn("[Elevate Bootstrap] readiness check warning:", error);
      }
    };

    window.addEventListener("elevate:account-truth", () => rerun("account-truth-event"));
    window.addEventListener("elevate:enforcement-bridge", () => rerun("enforcement-bridge-event"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") rerun("visibility-visible");
    });
  }

  function boot() {
    const state = ensureBootstrapState();
    if (state.started) return;
    state.started = true;
    state.startedAt = new Date().toISOString();
    state.authSettling = true;

    setWorkspaceState("false");
    NS.phase2render?.prepare?.();
    setFriendlyStatus("Loading your operator workspace...");
    setBootStatus("Waiting on auth settle...");
    pushStage("Bootstrap", "Event-driven startup watcher armed.");
    bindStartupListeners();

    setTimeout(() => {
      state.authSettling = false;
      NS.authSettled = Boolean(NS.authSettled || readCanonicalTruth()?.auth_settled || readCanonicalTruth()?.truth_ready);
      pushStage("Auth settle", "Initial auth settle window completed.");
      attemptReady("auth-settle-window");
    }, AUTH_SETTLE_MS);

    setTimeout(() => {
      attemptReady("mid-startup-check");
    }, 3000);

    setTimeout(() => {
      if (!attemptReady("final-timeout-check")) {
        markFailed("Workspace is taking longer than normal. Refresh Access if needed.", "Canonical summary did not stabilize before timeout.");
      }
    }, FINAL_TIMEOUT_MS);

    attemptReady("initial");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  NS.modules = NS.modules || {};
  NS.modules.bootstrap = true;
})();
