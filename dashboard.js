const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaXhibGJ4a29lcnNod2dxcHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODUzMDMsImV4cCI6MjA4ODY2MTMwM30.wxt9zjKhsBuflaFZZT9awZiwckRzYkEl-OLm_4q8qF4";
const GET_DASHBOARD_DATA_URL = "https://teixblbxkoershwgqpym.supabase.co/functions/v1/get-dashboard-data";

async function getDashboardData(email) {
  const response = await fetch(GET_DASHBOARD_DATA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ email })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to load dashboard.");
  }

  return data;
}

function setStatus(message, type = "") {
  const box = document.getElementById("dashboard-status");
  if (!box) return;
  box.className = `feedback-status ${type}`.trim();
  box.textContent = message;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "—";
}

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("dashboard-lookup-form");
  const content = document.getElementById("dashboard-content");

  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    try {
      setStatus("Loading dashboard...");
      if (content) content.classList.add("hidden");

      const email = document.getElementById("lookup-email").value.trim();
      if (!email) {
        setStatus("Enter an email address.", "error");
        return;
      }

      const result = await getDashboardData(email);

      if (!result.found) {
        setStatus(result.error || "No account found for that email.", "error");
        return;
      }

      const user = result.user || {};
      const subscription = result.subscription || {};
      const license = result.license || {};
      const limits = result.posting_limits || {};
      const referral = result.referral || {};

      setText("dash-name", `${user.first_name || ""} ${user.last_name || ""}`.trim() || "—");
      setText("dash-email", user.email || "—");
      setText("dash-company", user.company || "—");
      setText("dash-province", user.province || "—");

      setText("dash-plan", subscription.plan_type || license.plan_type || "—");
      setText("dash-subscription-status", subscription.subscription_status || "—");
      setText("dash-billing-status", subscription.billing_status || "—");

      setText("dash-license-key", license.license_key || "—");
      setText("dash-access-type", license.access_type || "—");
      setText("dash-license-status", license.status || "—");

      setText("dash-daily-limit", limits.daily_limit ?? "—");
      setText("dash-weekly-limit", limits.weekly_limit ?? "—");
      setText("dash-cooldown", limits.cooldown_minutes ? `${limits.cooldown_minutes} min` : "—");

      setText("dash-referral-code", referral.referral_code || "—");
      setText("dash-referral-eligible", referral.is_commission_eligible ? "Yes" : "No");
      setText("dash-referral-link", referral.referral_link || "—");

      if (content) content.classList.remove("hidden");
      setStatus("Dashboard loaded.", "success");
    } catch (error) {
      console.error("Dashboard load error:", error);
      setStatus("There was an issue loading the dashboard.", "error");
    }
  });
});
