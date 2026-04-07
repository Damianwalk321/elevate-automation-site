(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.api) return;

  async function getAuthAccessToken() {
    try {
      const client = window.supabaseClient;
      if (!client?.auth?.getSession) return "";
      const { data } = await client.auth.getSession();
      return data?.session?.access_token || "";
    } catch {
      return "";
    }
  }

  async function buildAuthHeaders(extra = {}) {
    const headers = { ...extra, "x-elevate-client": "dashboard" };
    const token = await getAuthAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function apiFetch(url, options = {}) {
    const headers = await buildAuthHeaders(options.headers || {});
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

  NS.api = { getAuthAccessToken, buildAuthHeaders, apiFetch, parseJsonSafe };
  NS.modules = NS.modules || {};
  NS.modules.api = true;
})();
