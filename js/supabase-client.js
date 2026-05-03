// /js/supabase-client.js

(function () {
  const config = {
    url: "https://teixblbxkoershwgqpym.supabase.co",
    publishableKey: "sb_publishable_low3Lfh2rAsN-kqBlwHF2Q_Kc6OhQLB",
    legacyAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaXhibGJ4a29lcnNod2dxcHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODUzMDMsImV4cCI6MjA4ODY2MTMwM30.wxt9zjKhsBuflaFZZT9awZiwckRzYkEl-OLm_4q8qF4"
  };

  if (!config.url || config.url === "YOUR_SUPABASE_URL") {
    console.error("Elevate Supabase URL is missing in /js/supabase-client.js");
    return;
  }

  if (!config.publishableKey || config.publishableKey === "YOUR_SUPABASE_PUBLISHABLE_KEY") {
    console.error("Elevate Supabase publishable key is missing in /js/supabase-client.js");
    return;
  }

  const frozenConfig = Object.freeze({ ...config });

  window.__ELEVATE_SUPABASE_CONFIG = frozenConfig;
  window.__ELEVATE_SUPABASE_URL = frozenConfig.url;
  window.__ELEVATE_SUPABASE_PUBLISHABLE_KEY = frozenConfig.publishableKey;
  window.__ELEVATE_SUPABASE_ANON_KEY = frozenConfig.publishableKey;
  window.__ELEVATE_SUPABASE_LEGACY_ANON_KEY = frozenConfig.legacyAnonKey;

  window.getElevateSupabaseConfig = function () {
    return window.__ELEVATE_SUPABASE_CONFIG;
  };

  window.getElevateSupabaseClient = function () {
    if (window.supabaseClient) {
      return window.supabaseClient;
    }

    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase CDN client is not loaded.");
    }

    window.supabaseClient = window.supabase.createClient(
      frozenConfig.url,
      frozenConfig.publishableKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: "pkce"
        }
      }
    );

    return window.supabaseClient;
  };

  if (!window.supabase || !window.supabase.createClient) {
    console.warn("Supabase CDN client is not loaded yet. Config was registered without initializing the client.");
    return;
  }

  try {
    window.getElevateSupabaseClient();
    console.log("Elevate Supabase client initialized.");
  } catch (error) {
    console.error("Failed to initialize Elevate Supabase client:", error);
  }
})();
