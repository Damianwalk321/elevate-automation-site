(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.api) return;

  function getSupabaseClient() {
    try {
      if (window.supabaseClient) return window.supabaseClient;
      if (typeof window.getElevateSupabaseClient === "function") {
        return window.getElevateSupabaseClient();
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

  NS.api = { getSupabaseClient, getAuthAccessToken, buildAuthHeaders, apiFetch, parseJsonSafe };
  NS.modules = NS.modules || {};
  NS.modules.api = true;
})();
