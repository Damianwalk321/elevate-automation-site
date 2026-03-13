const SUPABASE_URL = "https://teixblbxkoershwgqpym.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaXhibGJ4a29lcnNod2dxcHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODUzMDMsImV4cCI6MjA4ODY2MTMwM30.wxt9zjKhsBuflaFZZT9awZiwckRzYkEl-OLm_4q8qF4";

async function supabaseSelect(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Request failed.");
  }

  return response.json();
}

function setStatus(message, type = "") {
  const box = document.getElementById("dashboard-status");
  if (!box) return;
  box.className = `feedback-status ${type}`.trim();
  box.textContent = message;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value ?? "—";
  }
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

      const users = await supabaseSelect(`users?email=eq.${encodeURIComponent(email)}&select=*`);
      if (!users.length) {
        setStatus("No account found for that email.", "error");
        return;
      }

      const user = users[0];

      const subscriptions = await supabaseSelect(
        `subscriptions?user_id=eq.${user.id}&select=*&order=created_at.desc&limit=1`
      );

      const licenses = await supabaseSelect(
        `license_keys?user_id=eq.${user.id}&select=*&order=created_at.desc&limit=1`
      );

      const referralCodes = await supabaseSelect(
        `user_referral_codes?user_id=eq.${user.id}&select=*&limit=1`
      );

      let postingLimit = null;

      if (licenses.length && licenses[0].plan_type) {
        const limits = await supabaseSelect(
          `posting_limits?plan_type=eq.${licenses[0].plan_type}&select=*&limit=1`
        );
        postingLimit = limits.length ? limits[0] : null;
      }

      const subscription = subscriptions.length ? subscriptions[0] : null;
      const license = licenses.length ? licenses[0] : null;
      const referral = referralCodes.length ? referralCodes[0] : null;

      setText("dash-name", `${user.first_name || ""} ${user.last_name || ""}`.trim() || "—");
      setText("dash-email", user.email || "—");
      setText("dash-company", user.company || "—");
      setText("dash-province", user.province || "—");

      setText("dash-plan", subscription?.plan_type || license?.plan_type || "—");
      setText("dash-subscription-status", subscription?.subscription_status || "—");
      setText("dash-billing-status", subscription?.billing_status || "—");

      setText("dash-license-key", license?.license_key || "—");
      setText("dash-access-type", license?.access_type || "—");
      setText("dash-license-status", license?.status || "—");

      setText("dash-daily-limit", postingLimit?.daily_limit ?? "—");
      setText("dash-weekly-limit", postingLimit?.weekly_limit ?? "—");
      setText("dash-cooldown", postingLimit ? `${postingLimit.cooldown_minutes} min` : "—");

      setText("dash-referral-code", referral?.referral_code || "—");
      setText("dash-referral-eligible", referral?.is_commission_eligible ? "Yes" : "No");
      setText(
        "dash-referral-link",
        referral?.referral_code
          ? `https://elevate-automation-site.vercel.app/?ref=${referral.referral_code}`
          : "—"
      );

      if (content) content.classList.remove("hidden");
      setStatus("Dashboard loaded.", "success");
    } catch (error) {
      console.error("Dashboard load error:", error);
      setStatus("There was an issue loading the dashboard.", "error");
    }
  });
});
