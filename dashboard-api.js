(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.api) return;

  const MODE_STORAGE_KEY = "elevate.command_center.mode.v1";

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function num(value) {
    const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getStoredMode() {
    try {
      const value = localStorage.getItem(MODE_STORAGE_KEY);
      return value === "operator" || value === "activation" ? value : "";
    } catch {
      return "";
    }
  }

  function persistMode(mode) {
    try {
      if (mode === "operator" || mode === "activation") {
        localStorage.setItem(MODE_STORAGE_KEY, mode);
      }
    } catch {}
  }

  function getSupabaseClient() {
    try {
      if (window.supabaseClient) return window.supabaseClient;
      if (typeof window.getElevateSupabaseClient === "function") {
        return window.getElevateSupabaseClient();
      }
      if (window.supabase?.createClient && window.__ELEVATE_SUPABASE_URL && window.__ELEVATE_SUPABASE_ANON_KEY) {
        window.supabaseClient = window.supabase.createClient(window.__ELEVATE_SUPABASE_URL, window.__ELEVATE_SUPABASE_ANON_KEY);
        return window.supabaseClient;
      }
    } catch (error) {
      console.warn("[dashboard-api] supabase client init warning:", error);
    }
    return null;
  }

  async function getSessionTokenFromClient(client) {
    if (!client?.auth) return "";
    try {
      const { data } = await client.auth.getSession();
      const token = data?.session?.access_token || "";
      if (token) return token;
    } catch {}

    try {
      const { data } = await client.auth.getUser();
      if (data?.user) {
        const { data: sessionData } = await client.auth.getSession();
        return sessionData?.session?.access_token || "";
      }
    } catch {}

    return "";
  }

  async function getCurrentUser() {
    const client = getSupabaseClient();
    if (!client?.auth) return null;
    try {
      const { data } = await client.auth.getUser();
      return data?.user || null;
    } catch {
      return null;
    }
  }

  async function getAuthAccessToken({ waitForRestore = true } = {}) {
    const client = getSupabaseClient();
    if (!client?.auth) return "";

    const immediate = await getSessionTokenFromClient(client);
    if (immediate || !waitForRestore) return immediate;

    const attempts = 6;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 300 + attempt * 150));
      const token = await getSessionTokenFromClient(client);
      if (token) return token;
    }

    return "";
  }

  async function buildAuthHeaders(extra = {}, options = {}) {
    const headers = { ...extra, "x-elevate-client": "dashboard" };
    const token = await getAuthAccessToken(options || {});
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function apiFetch(url, options = {}) {
    const headers = await buildAuthHeaders(options.headers || {}, {
      waitForRestore: options.waitForAuth !== false
    });
    return fetch(url, { ...options, headers });
  }

  async function parseJsonSafe(response) {
    const text = await response.text();
    try {
      return JSON.parse(text || "{}");
    } catch {
      return { ok: false, raw_text: text };
    }
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function buildPrimaryCommand(data, mode, postsRemaining, setupStatus) {
    const reviewDelete = num(data.review_delete_count);
    const reviewPrice = num(data.review_price_change_count);
    const needsAction = num(data.needs_action_count);
    const queueCount = num(data.queue_count);
    const activationScore = num((setupStatus.profile_completion_score || 0) * 100 || data.activation_score || 0);

    if (mode !== "operator") {
      if (!setupStatus.profile_complete) {
        return {
          type: "finish_profile",
          title: "Complete your operator profile",
          message: "Finish the required setup fields so the workspace can leave activation and move into operator mode.",
          primary_action: "open_setup",
          secondary_action: "open_compliance"
        };
      }
      if (!setupStatus.compliance_mode_present) {
        return {
          type: "finish_compliance",
          title: "Complete compliance setup",
          message: "Set the correct compliance mode before running a full live posting cycle.",
          primary_action: "open_compliance",
          secondary_action: "open_setup"
        };
      }
      return {
        type: "first_post",
        title: "Run the first clean posting cycle",
        message: `Activation is ${activationScore}% complete. Push the first clean vehicle through the flow to lock this account into operator mode.`,
        primary_action: "open_tools",
        secondary_action: "open_setup"
      };
    }

    if (reviewDelete > 0) {
      return {
        type: "review_stale",
        title: `Review ${reviewDelete} stale or removed listing${reviewDelete === 1 ? "" : "s"}`,
        message: "Clean up stale inventory first so the machine stays accurate before you add more volume.",
        primary_action: "open_review_queue",
        secondary_action: "open_analytics"
      };
    }

    if (reviewPrice > 0) {
      return {
        type: "review_price_changes",
        title: `Review ${reviewPrice} price-change item${reviewPrice === 1 ? "" : "s"}`,
        message: "Price-change review is currently the highest-leverage action in the operator queue.",
        primary_action: "open_review_queue",
        secondary_action: "open_tools"
      };
    }

    if (needsAction > 0) {
      return {
        type: "needs_action",
        title: `Resolve ${needsAction} listing${needsAction === 1 ? "" : "s"} needing action`,
        message: "Clear the active action queue before adding fresh posting pressure.",
        primary_action: "open_review_queue",
        secondary_action: "open_analytics"
      };
    }

    if (!data.can_post) {
      return {
        type: "restore_posting",
        title: "Restore posting readiness",
        message: "Operator mode is active, but posting is not currently clear. Review access and session state before pushing more listings.",
        primary_action: "refresh_sync",
        secondary_action: "open_tools"
      };
    }

    if (queueCount > 0 && postsRemaining > 0) {
      const pushCount = Math.min(queueCount, postsRemaining);
      return {
        type: "post_queue",
        title: `Push ${pushCount} queued vehicle${pushCount === 1 ? "" : "s"} next`,
        message: `You currently have ${queueCount} queued unit${queueCount === 1 ? "" : "s"} and ${postsRemaining} posting slot${postsRemaining === 1 ? "" : "s"} remaining today.`,
        primary_action: "open_tools",
        secondary_action: "open_analytics"
      };
    }

    if (postsRemaining > 0) {
      return {
        type: "queue_next",
        title: "Queue the next best unit",
        message: `There are still ${postsRemaining} posting slot${postsRemaining === 1 ? "" : "s"} remaining today. Keep output moving while the machine is clean.`,
        primary_action: "open_tools",
        secondary_action: "open_analytics"
      };
    }

    return {
      type: "hold_quality",
      title: "Maintain listing quality and operator rhythm",
      message: "The account is live, the machine is stable, and most current capacity is used. Stay focused on review quality and listing health.",
      primary_action: "open_analytics",
      secondary_action: "open_compliance"
    };
  }

  function enrichSummaryData(raw = {}) {
    const data = { ...(raw || {}) };
    const setupStatus = { ...(data.setup_status || {}) };
    const accountSnapshot = { ...(data.account_snapshot || {}) };
    const profileSnapshot = { ...(data.profile_snapshot || {}) };

    const profileComplete = Boolean(setupStatus.profile_complete);
    const complianceReady = Boolean(setupStatus.compliance_mode_present);
    const dealerReady = Boolean(setupStatus.dealership_name_present && setupStatus.inventory_url_present && setupStatus.dealer_website_present);
    const firstPostComplete = Boolean(setupStatus.first_post_complete || num(data.total_listings) > 0 || num(data.posts_today) > 0);
    const activationScore = Math.round((Number(setupStatus.profile_completion_score || 0)) * 100);

    const explicitMode = clean(data.dashboard_mode || accountSnapshot.dashboard_mode || "").toLowerCase();
    const storedMode = getStoredMode();
    const shouldQualifyOperator = profileComplete && complianceReady && dealerReady && firstPostComplete;

    let dashboardMode = "activation";
    if (explicitMode === "operator" || explicitMode === "activation") {
      dashboardMode = explicitMode;
    } else if (storedMode === "operator") {
      dashboardMode = "operator";
    } else if (shouldQualifyOperator) {
      dashboardMode = "operator";
    }

    if (dashboardMode === "operator") {
      persistMode("operator");
    }

    const postsRemaining = num(data.posts_remaining ?? data.daily_limit ?? 0);
    const primaryCommand = buildPrimaryCommand(data, dashboardMode, postsRemaining, {
      ...setupStatus,
      profile_complete: profileComplete,
      compliance_mode_present: complianceReady,
      first_post_complete: firstPostComplete,
      profile_completion_score: Number(setupStatus.profile_completion_score || 0)
    });

    const commandCenter = {
      ...(data.command_center || {}),
      primary_command: primaryCommand,
      kpis: {
        active_listings: num(data.active_listings),
        posted_today: num(data.posts_today),
        remaining_today: postsRemaining,
        in_review: num(data.review_queue_count),
        needs_action: num(data.needs_action_count),
        at_risk: num(data.weak_listings)
      },
      work_queues: {
        ready_to_post: num(data.queue_count),
        review_queue: num(data.review_queue_count),
        compliance_blocked: complianceReady ? 0 : 1,
        failed_posts: 0,
        stale_review: num(data.review_delete_count)
      },
      machine_health: {
        extension_connected: Boolean(accountSnapshot.access_granted || data.can_post),
        session_valid: Boolean(data.can_post || accountSnapshot.active),
        last_successful_post_at: data.recent_listings?.[0]?.posted_at || null,
        queue_healthy: true,
        duplicate_protection: true,
        compliance_engine: true,
        last_sync_at: new Date().toISOString()
      },
      performance_snapshot: {
        posted_7d: num(data.posts_this_month),
        active_trend: num(data.active_listings),
        review_trend: num(data.review_queue_count),
        action_trend: num(data.needs_action_count)
      },
      quick_actions: dashboardMode === "operator"
        ? ["open_tools", "open_analytics", "open_review_queue", "open_compliance", "refresh_sync"]
        : ["open_setup", "open_compliance", "open_tools", "refresh_sync"]
    };

    return {
      ...data,
      dashboard_mode: dashboardMode,
      dashboard_mode_locked: dashboardMode === "operator",
      operator_qualified: dashboardMode === "operator",
      activation_complete: Boolean(profileComplete && complianceReady && firstPostComplete),
      activation_score: activationScore,
      setup_status: {
        ...setupStatus,
        profile_complete: profileComplete,
        compliance_mode_present: complianceReady,
        first_post_complete: firstPostComplete,
        activation_score: activationScore
      },
      account_snapshot: {
        ...accountSnapshot,
        dashboard_mode: dashboardMode,
        dashboard_mode_locked: dashboardMode === "operator"
      },
      profile_snapshot: profileSnapshot,
      command_center: commandCenter
    };
  }

  function hydrateSummaryIntoDom(summary = {}) {
    const data = summary?.data || summary || {};
    const setup = data.setup_status || {};
    const profile = data.profile_snapshot || data.account_snapshot || {};
    const planAccess = data.plan_access || {};
    const account = data.account_snapshot || {};

    setText("extensionAccessState", account.access_granted ? "Active" : (account.status || "Inactive"));
    setText("extensionReviewQueue", String(data.review_queue_count ?? data.command_center?.kpis?.in_review ?? 0));
    setText("extensionRemainingPosts", String(data.posts_remaining ?? data.command_center?.kpis?.remaining_today ?? data.daily_limit ?? 0));
    setText("extensionComplianceMode", profile.compliance_mode || profile.province || "Unset");

    setText("kpiActiveListings", String(data.active_listings ?? data.command_center?.kpis?.active_listings ?? 0));
    setText("kpiReviewQueue", String(data.review_queue_count ?? data.command_center?.kpis?.in_review ?? 0));
    setText("kpiNeedsAction", String(data.needs_action_count ?? data.command_center?.kpis?.needs_action ?? 0));
    setText("kpiWeakListings", String(data.weak_listings ?? data.command_center?.kpis?.at_risk ?? 0));
    setText("kpiQueuedVehicles", String(data.queue_count ?? data.command_center?.work_queues?.ready_to_post ?? 0));
    setText("kpiPostsRemaining", String(data.posts_remaining ?? data.command_center?.kpis?.remaining_today ?? 0));
    setText("kpiCreditsBalance", String(data.credits?.balance ?? 0));
    setText("commandCreditsBalance", String(data.credits?.balance ?? 0));
    setText("commandPostsUsed", `${Number(data.posts_today ?? data.command_center?.kpis?.posted_today ?? 0)}/${Number(data.effective_posting_limit ?? data.daily_limit ?? 0)}`);
    setText("commandSetupProgress", `${Math.round((Number(setup.profile_completion_score || 0)) * 100)}%`);
    setText("setupReadinessPercent", `${Math.round((Number(setup.profile_completion_score || 0)) * 100)}%`);

    setText("setupDealerWebsite", setup.dealer_website_present ? "READY" : "MISSING");
    setText("setupInventoryUrl", setup.inventory_url_present ? "READY" : "MISSING");
    setText("setupScannerType", setup.scanner_type_present ? "READY" : "MISSING");
    setText("setupListingLocation", setup.listing_location_present ? "READY" : "MISSING");
    setText("setupComplianceMode", setup.compliance_mode_present ? "READY" : "MISSING");
    setText("setupAccess", account.access_granted ? "READY" : "MISSING");

    setText("planNameBilling", planAccess.plan_label || account.plan || "Founder Beta");
    setText("overviewPlanChip", planAccess.plan_label || account.plan || "Founder Beta");
    setText("subscriptionStatusBilling", account.status || "inactive");
  }

  async function fetchDashboardSummary() {
    const response = await apiFetch("/api/get-dashboard-summary", { method: "GET" });
    const result = await parseJsonSafe(response);
    if (!response.ok) {
      throw new Error(result?.error || result?.message || response.statusText || "Dashboard summary failed");
    }
    const payload = result?.data ? result : { success: true, data: result };
    window.dashboardSummary = enrichSummaryData(payload.data || {});
    hydrateSummaryIntoDom(window.dashboardSummary);
    try {
      window.dispatchEvent(new CustomEvent("elevate:summary-ready", { detail: window.dashboardSummary }));
      window.dispatchEvent(new CustomEvent("elevate:account-truth", { detail: { summary_ready: true } }));
    } catch {}
    return window.dashboardSummary;
  }

  async function syncUserIfNeeded() {
    const response = await apiFetch("/api/sync-user", { method: "POST" });
    const result = await parseJsonSafe(response);
    if (!response.ok) {
      throw new Error(result?.error || result?.message || response.statusText || "Sync user failed");
    }
    return result;
  }

  async function refreshAccess() {
    const user = await getCurrentUser();
    if (user) window.currentUser = user;
    await syncUserIfNeeded();
    return fetchDashboardSummary();
  }

  async function signOut() {
    const client = getSupabaseClient();
    try {
      await client?.auth?.signOut?.();
    } catch (error) {
      console.warn("[dashboard-api] sign out warning:", error);
    }
    try {
      localStorage.removeItem("elevate.dashboard.state.v4");
      localStorage.removeItem("elevate.account_truth.v1");
      localStorage.removeItem(MODE_STORAGE_KEY);
    } catch {}
    window.location.href = "/login.html";
  }

  NS.api = {
    getSupabaseClient,
    getCurrentUser,
    getAuthAccessToken,
    buildAuthHeaders,
    apiFetch,
    parseJsonSafe,
    fetchDashboardSummary,
    syncUserIfNeeded,
    refreshAccess,
    signOut,
    hydrateSummaryIntoDom,
    enrichSummaryData
  };
  NS.modules = NS.modules || {};
  NS.modules.api = true;
})();