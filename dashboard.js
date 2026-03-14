// /js/dashboard.js

async function loadDashboard() {
  try {
    const email = localStorage.getItem("user_email");

    if (!email) {
      console.error("No user email found in localStorage");
      window.location.href = "/login.html";
      return;
    }

    const response = await fetch("/api/get-user-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load dashboard");
    }

    // Account info
    const emailEl = document.getElementById("userEmail");
    const planEl = document.getElementById("userPlan");
    const statusEl = document.getElementById("userStatus");

    if (emailEl) emailEl.textContent = data.email || "-";
    if (planEl) planEl.textContent = data.plan || "Beta";
    if (statusEl) statusEl.textContent = data.subscription_status || "active";

    // Referral / invite info
    const referralCode = data.referral_code || "";
    const referralCount = Number(data.referral_count || 0);
    const unlockedInvites = Number(data.unlocked_invites || 1);
    const usedInvites = Number(data.used_invites || 0);
    const remainingInvites = Math.max(unlockedInvites - usedInvites, 0);

    const refLinkEl = document.getElementById("refLink");
    const referralCodeEl = document.getElementById("referralCode");
    const referralCountEl = document.getElementById("referralCount");
    const unlockedInvitesEl = document.getElementById("unlockedInvites");
    const usedInvitesEl = document.getElementById("usedInvites");
    const remainingInvitesEl = document.getElementById("remainingInvites");

    const referralLink = `${window.location.origin}/?ref=${referralCode}`;

    if (refLinkEl) refLinkEl.textContent = referralLink;
    if (referralCodeEl) referralCodeEl.textContent = referralCode || "-";
    if (referralCountEl) referralCountEl.textContent = referralCount;
    if (unlockedInvitesEl) unlockedInvitesEl.textContent = unlockedInvites;
    if (usedInvitesEl) usedInvitesEl.textContent = usedInvites;
    if (remainingInvitesEl) remainingInvitesEl.textContent = remainingInvites;

    // Invite tier status
    const inviteTierEl = document.getElementById("inviteTier");
    if (inviteTierEl) {
      if (unlockedInvites >= 3) {
        inviteTierEl.textContent = "Founding Partner";
      } else if (unlockedInvites >= 2) {
        inviteTierEl.textContent = "Contributor";
      } else {
        inviteTierEl.textContent = "Tester";
      }
    }

    // Progress / unlock messaging
    const unlockMessageEl = document.getElementById("unlockMessage");
    if (unlockMessageEl) {
      if (unlockedInvites === 1) {
        unlockMessageEl.textContent =
          "Complete activation, feedback, or beta participation to unlock invite #2.";
      } else if (unlockedInvites === 2) {
        unlockMessageEl.textContent =
          "Bring in 1 qualified user or complete the next contribution step to unlock invite #3.";
      } else {
        unlockMessageEl.textContent =
          "All 3 invite spots unlocked. Founder-level beta access active.";
      }
    }

    // Founder pricing
    const founderPricingEl = document.getElementById("founderPricing");
    if (founderPricingEl) {
      founderPricingEl.textContent = data.founder_pricing_locked ? "Locked In" : "Not Locked";
    }

  } catch (error) {
    console.error("Dashboard load error:", error);

    const errorEl = document.getElementById("dashboardError");
    if (errorEl) {
      errorEl.textContent = error.message || "Something went wrong loading the dashboard.";
      errorEl.style.display = "block";
    }
  }
}

function copyReferralLink() {
  const refLinkEl = document.getElementById("refLink");
  if (!refLinkEl) return;

  const text = refLinkEl.textContent || "";
  if (!text) return;

  navigator.clipboard.writeText(text)
    .then(() => {
      const btn = document.getElementById("copyReferralBtn");
      if (btn) {
        const original = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = original;
        }, 1500);
      }
    })
    .catch((err) => {
      console.error("Clipboard copy failed:", err);
      alert("Could not copy referral link.");
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const copyBtn = document.getElementById("copyReferralBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", copyReferralLink);
  }

  loadDashboard();
});
