// /js/dashboard.js

function setText(id, value, fallback = "-") {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? fallback;
}

function showError(message) {
  const errorEl = document.getElementById("dashboardError");
  if (!errorEl) return;
  errorEl.textContent = message || "Something went wrong loading the dashboard.";
  errorEl.style.display = "block";
}

function updateInviteUI(unlockedInvites, usedInvites) {
  const unlocked = Number(unlockedInvites || 1);
  const used = Number(usedInvites || 0);
  const remaining = Math.max(unlocked - used, 0);

  setText("unlockedInvites", unlocked);
  setText("usedInvites", used);
  setText("remainingInvites", remaining);

  let tier = "Tester";
  let width = "33%";
  let label = `${Math.min(unlocked, 3)} of 3 unlocked`;
  let unlockMessage =
    "Complete activation, feedback, or beta participation to unlock invite #2.";

  if (unlocked >= 3) {
    tier = "Founding Partner";
    width = "100%";
    unlockMessage =
      "All 3 invite spots unlocked. Founder-level beta access is active.";
  } else if (unlocked >= 2) {
    tier = "Contributor";
    width = "66%";
    unlockMessage =
      "Bring in 1 qualified user or complete the next contribution milestone to unlock invite #3.";
  }

  setText("inviteTier", tier);
  setText("inviteTierBadge", tier);
  setText("inviteProgressLabel", label);
  setText("unlockMessage", unlockMessage);

  const fill = document.getElementById("inviteProgressFill");
  if (fill) fill.style.width = width;
}

function buildReferralLink(referralCode) {
  if (!referralCode) return "-";
  return `${window.location.origin}/?ref=${referralCode}`;
}

async function loadDashboard() {
  try {
    const user = await requireAuth();
    if (!user || !user.email) return;

    localStorage.setItem("user_email", user.email);

    const response = await fetch("/api/get-user-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: user.email })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load dashboard.");
    }

    setText("userEmail", data.email || user.email);
    setText("userPlan", data.plan || "Beta");
    setText("userStatus", data.subscription_status || "active");
    setText(
      "founderPricing",
      data.founder_pricing_locked ? "Locked In" : "Not Locked"
    );
    setText("referralCode", data.referral_code || "-");
    setText("referralCount", Number(data.referral_count || 0));

    const refLink = buildReferralLink(data.referral_code || "");
    setText("refLink", refLink);

    updateInviteUI(
      Number(data.unlocked_invites || 1),
      Number(data.used_invites || 0)
    );
  } catch (error) {
    console.error("Dashboard load error:", error);
    showError(error.message || "Could not load dashboard.");
  }
}

async function copyReferralLink() {
  try {
    const refLinkEl = document.getElementById("refLink");
    if (!refLinkEl) return;

    const link = refLinkEl.textContent || "";
    if (!link || link === "-") return;

    await navigator.clipboard.writeText(link);

    const primaryBtn = document.getElementById("copyReferralBtn");
    const secondaryBtn = document.getElementById("copyReferralBtnSecondary");

    const originalPrimary = primaryBtn ? primaryBtn.textContent : null;
    const originalSecondary = secondaryBtn ? secondaryBtn.textContent : null;

    if (primaryBtn) primaryBtn.textContent = "Copied";
    if (secondaryBtn) secondaryBtn.textContent = "Copied";

    setTimeout(() => {
      if (primaryBtn && originalPrimary) primaryBtn.textContent = originalPrimary;
      if (secondaryBtn && originalSecondary) secondaryBtn.textContent = originalSecondary;
    }, 1500);
  } catch (error) {
    console.error("Copy failed:", error);
    alert("Could not copy referral link.");
  }
}

async function logoutUser() {
  try {
    await signOutUser();
    window.location.href = "/login.html";
  } catch (error) {
    console.error("Logout failed:", error);
    alert(error.message || "Logout failed.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const homeBtn = document.getElementById("homeBtn");
  const copyBtn = document.getElementById("copyReferralBtn");
  const copyBtnSecondary = document.getElementById("copyReferralBtnSecondary");
  const logoutBtn = document.getElementById("logoutBtn");

  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      window.location.href = "/";
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", copyReferralLink);
  }

  if (copyBtnSecondary) {
    copyBtnSecondary.addEventListener("click", copyReferralLink);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutUser);
  }

  await loadDashboard();
});
