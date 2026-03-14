// /js/supabase-client.js

(function () {
  if (!window.supabase || !window.supabase.createClient) {
    console.error("Supabase CDN client is not loaded.");
    return;
  }

  const SUPABASE_URL = "https://teixblbxkoershwgqpym.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaXhibGJ4a29lcnNod2dxcHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODUzMDMsImV4cCI6MjA4ODY2MTMwM30.wxt9zjKhsBuflaFZZT9awZiwckRzYkEl-OLm_4q8qF4";

  if (
    !SUPABASE_URL ||
    SUPABASE_URL === "YOUR_SUPABASE_URL" ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY"
  ) {
    console.error("Supabase URL or anon key is missing in /js/supabase-client.js");
    return;
  }

  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  console.log("Supabase client initialized.");
})();
