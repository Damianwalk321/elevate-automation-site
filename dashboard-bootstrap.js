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
    if (state.stages.length > 30) state.stages = state.stages.slice(-30);
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
    return Boolean(window.dashboardSummary && typeof window.dashboardSummary === "object" && Object.keys(window.dashboardSummary || {}).length);
  }

  async function hasVerifiedToken() {
    try {
      const token = await NS.api?.getAuthAccessToken?.({ waitForRestore: false });
      return Boolean(clean(token));
    } catch {
      return false;
    }
  }

  async function hydrateCurrentUserIfNeeded(source = "hydrate-user") {
    if (hasAuthenticatedUser()) return true;
    if (!NS.api?.getCurrentUser) return false;
    try {
      pushStage("Auth", `hydrating current user via ${source}`);
      const user = await NS.api.getCurrentUser();
      if (user) {
        window.currentUser = user;
        try {
          window.dispatchEvent(new CustomEvent("elevate:auth-ready", {
            detail: { source, hydrated_user: true, email: user.email || "" }
          }));
        } catch {}
        return true;
      }
    } catch (error) {
      pushStage("Auth", `current user hydrate failed via ${source}: ${error?.message || error}`);
    }
    return false;
  }

  async function hydrateSummaryIfNeeded(source = "hydrate") {
    if (!NS.api?.fetchDashboardSummary) return false;
    if (hasSummaryOrTruth()) return true;
    try {
      pushStage("Summary", `fetching via ${source}`);
      await NS.api.fetchDashboardSummary();
      return true;
    } catch (error) {
      pushStage("Summary", `fetch failed via ${source}: ${error?.message || error}`);
      return false;
    }
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

    pushStage("Ready", "Canonical startup finished with verified auth.");
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

  async function attemptReady(source = "check") {
    const state = ensureBootstrapState();
    if (state.ready) return true;

    const truth = readCanonicalTruth();
    const authSettled = Boolean(NS.authSettled || truth?.auth_settled || truth?.truth_ready);
    let hasUser = hasAuthenticatedUser();
    const tokenReady = await hasVerifiedToken();

    if (!hasUser && tokenReady) {
      await hydrateCurrentUserIfNeeded(source);
      hasUser = hasAuthenticatedUser();
    }

    if (hasUser && tokenReady && !hasSummaryOrTruth()) {
      await hydrateSummaryIfNeeded(source);
    }

    const hasSummary = hasSummaryOrTruth();

    if (hasUser && hasSummary && tokenReady) {
      pushStage("Ready check", `passed via ${source}`);
      markReady("Workspace ready.");
      return true;
    }

    if (authSettled && !tokenReady) {
      pushStage("Waiting", `${source} • awaiting verified token`);
      setWorkspaceState("auth-pending");
      setFriendlyStatus("Restoring secure session...");
      setBootStatus("Waiting on verified session token...");
      return false;
    }

    if (authSettled && !hasUser) {
      pushStage("Auth", `settled unauthenticated via ${source}`);
      setWorkspaceState("auth-settled");
      setFriendlyStatus("Session not active. Please log in.");
      setBootStatus("Auth settled without active session.");
      return false;
    }

    pushStage("Waiting", `${source} • user=${hasUser} summary=${hasSummary} authSettled=${authSettled} token=${tokenReady}`);
    setBootStatus(authSettled ? "Waiting on secure dashboard startup..." : "Waiting on auth settle...");
    if (hasUser && !hasSummary) setFriendlyStatus("Loading your workspace data...");
    return false;
  }

  function bindStartupListeners() {
    if (window.__ELEVATE_BOOTSTRAP_LISTENERS_BOUND__) return;
    window.__ELEVATE_BOOTSTRAP_LISTENERS_BOUND__ = true;

    const rerun = (source) => {
      Promise.resolve()
        .then(() => attemptReady(source))
        .catch((error) => {
          console.warn("[Elevate Bootstrap] readiness check warning:", error);
        });
    };

    window.addEventListener("elevate:account-truth", () => rerun("account-truth-event"));
    window.addEventListener("elevate:enforcement-bridge", () => rerun("enforcement-bridge-event"));
    window.addEventListener("elevate:auth-ready", () => rerun("auth-ready-event"));
    window.addEventListener("elevate:summary-ready", () => rerun("summary-ready-event"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") rerun("visibility-visible");
    });
  }

  function bindAuthWatcher() {
    const client = NS.api?.getSupabaseClient?.();
    if (!client?.auth?.onAuthStateChange || window.__ELEVATE_BOOTSTRAP_AUTH_BOUND__) return;
    window.__ELEVATE_BOOTSTRAP_AUTH_BOUND__ = true;
    client.auth.onAuthStateChange((event, session) => {
      if (session?.access_token || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        try {
          window.dispatchEvent(new CustomEvent("elevate:auth-ready", {
            detail: { event, has_token: Boolean(session?.access_token) }
          }));
        } catch {}
      }
    });
  }

  function bindActionButtons() {
    if (window.__ELEVATE_BOOTSTRAP_ACTIONS_BOUND__) return;
    window.__ELEVATE_BOOTSTRAP_ACTIONS_BOUND__ = true;

    const bindByText = (matcher, handler) => {
      Array.from(document.querySelectorAll("button")).forEach((button) => {
        const text = clean(button.textContent || "").toLowerCase();
        if (!matcher(text)) return;
        if (button.dataset.eaBootstrapBound === "true") return;
        button.dataset.eaBootstrapBound = "true";
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          await handler(button);
        });
      });
    };

    bindByText((text) => text === "refresh access", async (button) => {
      const original = button.textContent;
      button.disabled = true;
      button.textContent = "Refreshing...";
      try {
        setBootStatus("Refreshing access...");
        await NS.api?.refreshAccess?.();
        setBootStatus("Access refreshed.");
        await attemptReady("refresh-access-click");
      } catch (error) {
        setBootStatus(error?.message || "Refresh access failed.");
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    });

    bindByText((text) => text === "logout" || text === "log out", async () => {
      await NS.api?.signOut?.();
    });
  }

  function loadSideNavRestore() {
    try {
      if (document.querySelector('script[src*="dashboard-side-nav-restore.js"]')) return;
      const script = document.createElement("script");
      script.src = "/dashboard-side-nav-restore.js?v=20260524f";
      script.async = false;
      script.onload = () => pushStage("Side nav", "restore module loaded");
      script.onerror = () => pushStage("Side nav", "restore module failed to load");
      document.head.appendChild(script);
    } catch (error) {
      pushStage("Side nav", `restore injection failed: ${error?.message || error}`);
    }
  }

  function boot() {
    const state = ensureBootstrapState();
    if (state.started) return;
    state.started = true;
    state.startedAt = new Date().toISOString();
    state.authSettling = true;

    loadSideNavRestore();
    setWorkspaceState("false");
    NS.phase2render?.prepare?.();
    setFriendlyStatus("Loading your operator workspace...");
    setBootStatus("Waiting on auth settle...");
    pushStage("Bootstrap", "Event-driven startup watcher armed.");
    bindStartupListeners();
    bindAuthWatcher();
    bindActionButtons();

    setTimeout(() => {
      state.authSettling = false;
      NS.authSettled = Boolean(NS.authSettled || readCanonicalTruth()?.auth_settled || readCanonicalTruth()?.truth_ready);
      pushStage("Auth settle", "Initial auth settle window completed.");
      attemptReady("auth-settle-window");
    }, AUTH_SETTLE_MS);

    setTimeout(() => {
      loadSideNavRestore();
      attemptReady("mid-startup-check");
      bindActionButtons();
    }, 3000);

    setTimeout(() => {
      Promise.resolve(attemptReady("final-timeout-check")).then((ready) => {
        if (!ready) {
          markFailed("Workspace is taking longer than normal. Refresh Access if needed.", "Protected dashboard auth did not stabilize before timeout.");
        }
      });
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