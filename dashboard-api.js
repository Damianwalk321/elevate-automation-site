(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.api) return;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
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

  function hydrateSummaryIntoDom(summary = {}) {
    const data = summary?.data || summary || {};
    const setup = data.setup_status || {};
    const profile = data.profile_snapshot || data.account_snapshot || {};
    const planAccess = data.plan_access || {};
    const account = data.account_snapshot || {};

    setText("extensionAccessState", account.access_granted ? "Active" : (account.status || "Inactive"));
    setText("extensionReviewQueue", String(data.review_queue_count ?? 0));
    setText("extensionRemainingPosts", String(data.posts_remaining ?? data.daily_limit ?? 0));
    setText("extensionComplianceMode", profile.compliance_mode || profile.province || "Unset");

    setText("kpiActiveListings", String(data.active_listings ?? 0));
    setText("kpiReviewQueue", String(data.review_queue_count ?? 0));
    setText("kpiNeedsAction", String(data.needs_action_count ?? 0));
    setText("kpiWeakListings", String(data.weak_listings ?? 0));
    setText("kpiQueuedVehicles", String(data.queue_count ?? 0));
    setText("kpiPostsRemaining", String(data.posts_remaining ?? 0));
    setText("kpiCreditsBalance", String(data.credits?.balance ?? 0));
    setText("commandCreditsBalance", String(data.credits?.balance ?? 0));
    setText("commandPostsUsed", `${Number(data.posts_today ?? 0)}/${Number(data.effective_posting_limit ?? data.daily_limit ?? 0)}`);
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
    window.dashboardSummary = payload.data || {};
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
    hydrateSummaryIntoDom
  };
  NS.modules = NS.modules || {};
  NS.modules.api = true;
})();