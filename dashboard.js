(function () {
  "use strict";

  // =========================================================
  // Elevate Automation Dashboard
  // Matches rebuilt sidebar dashboard.html
  // =========================================================

  const SUPABASE_URL =
    window.SUPABASE_URL ||
    window.__SUPABASE_URL__ ||
    "YOUR_SUPABASE_URL";

  const SUPABASE_ANON_KEY =
    window.SUPABASE_ANON_KEY ||
    window.__SUPABASE_ANON_KEY__ ||
    "YOUR_SUPABASE_ANON_KEY";

  const LOGIN_PATH = "/login.html";
  const DEFAULT_HOME_PATH = "/";
  const DEFAULT_PROFILE_PATH = "/profile.html";

  let supabaseClient = null;
  let currentUser = null;
  let currentAccountData = null;

  // ---------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------
  const $ = (id) => document.getElementById(id);

  function setText(id, value, fallback = "-") {
    const node = $(id);
    if (!node) return;
    const finalValue =
      value === undefined || value === null || value === ""
        ? fallback
        : String(value);
    node.textContent = finalValue;
  }

  function setHref(id, href) {
    const node = $(id);
    if (!node) return;
    node.href = href;
  }

  function showStatus(message, type = "") {
    const banner = $("statusBanner");
    if (!banner) return;

    banner.textContent = message;
    banner.className = "status-banner show";

    if (type) banner.classList.add(type);
  }

  function clearStatus() {
    const banner = $("statusBanner");
    if (!banner) return;
    banner.textContent = "";
    banner.className = "status-banner";
  }

  function formatBool(value) {
    return value ? "Yes" : "No";
  }

  function safeUpper(str) {
    return String(str || "").trim().toUpperCase();
  }

  function clip(str, max = 42) {
    const s = String(str || "");
    if (s.length <= max) return s;
    return `${s.slice(0, max)}...`;
  }

  function buildReferralLink(code) {
    if (!code) return "";
    const origin = window.location.origin || "";
    return `${origin}/?ref=${encodeURIComponent(code)}`;
  }

  // ---------------------------------------------------------
  // Sidebar / section navigation
  // ---------------------------------------------------------
  const sectionMeta = {
    overview: {
      title: "Founder Beta Dashboard",
      subtitle:
        "Control center for account access, referral growth, billing status, invite progression, and future Elevate automation tools.",
    },
    poster: {
      title: "Vehicle Poster",
      subtitle:
        "Execution layer for Marketplace posting, queue flow, helper logic, next/publish controls, and future posting analytics.",
    },
    profile: {
      title: "Profile & Setup",
      subtitle:
        "Save salesperson identity, dealership defaults, compliance preferences, and listing behavior inside the current authenticated dashboard.",
    },
    compliance: {
      title: "Compliance Center",
      subtitle:
        "Province-aware posting safeguards, rule presets, blocked phrase controls, and disclaimer infrastructure.",
    },
    ai: {
      title: "AI Studio",
      subtitle:
        "Generate descriptions, captions, CTAs, and platform-specific copy from vehicle, user, and dealership data.",
    },
    referrals: {
      title: "Referral System",
      subtitle:
        "Manage invite growth, referral links, beta expansion, and tracked successful referrals.",
    },
    billing: {
      title: "Billing",
      subtitle:
        "View founder pricing, plan status, billing readiness, and future commercial tier access.",
    },
    settings: {
      title: "Settings",
      subtitle:
        "Platform configuration, automation defaults, account controls, and future team-level system settings.",
    },
  };

  function setActiveSection(sectionKey) {
    const navItems = document.querySelectorAll(".nav-item");
    const sections = document.querySelectorAll(".section");
    const pageTitle = $("pageTitle");
    const pageSubtitle = $("pageSubtitle");

    navItems.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.section === sectionKey);
    });

    sections.forEach((section) => {
      section.classList.toggle("active", section.id === `section-${sectionKey}`);
    });

    const meta = sectionMeta[sectionKey] || sectionMeta.overview;

    if (pageTitle) pageTitle.textContent = meta.title;
    if (pageSubtitle) pageSubtitle.textContent = meta.subtitle;

    try {
      window.history.replaceState(null, "", `#${sectionKey}`);
    } catch (err) {
      console.warn("Failed to update hash:", err);
    }
  }

  function initSectionNavigation() {
    const navItems = document.querySelectorAll(".nav-item");

    navItems.forEach((btn) => {
      btn.addEventListener("click", () => {
        const sectionKey = btn.dataset.section || "overview";
        setActiveSection(sectionKey);
      });
    });

    const initialHash = (window.location.hash || "").replace("#", "").trim();
    const initialSection = sectionMeta[initialHash] ? initialHash : "overview";
    setActiveSection(initialSection);
  }

  // ---------------------------------------------------------
  // Auth
  // ---------------------------------------------------------
  function initSupabase() {
    if (
      !window.supabase ||
      !SUPABASE_URL ||
      SUPABASE_URL === "YOUR_SUPABASE_URL" ||
      !SUPABASE_ANON_KEY ||
      SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY"
    ) {
      console.warn("Supabase config missing on dashboard.");
      return false;
    }

    try {
      supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
      );
      return true;
    } catch (err) {
      console.error("Failed to initialize Supabase:", err);
      return false;
    }
  }

  async function getCurrentUser() {
    if (!supabaseClient) return null;

    try {
      const {
        data: { user },
        error,
      } = await supabaseClient.auth.getUser();

      if (error) {
        console.warn("getUser error:", error.message);
        return null;
      }

      return user || null;
    } catch (err) {
      console.error("Failed to get current user:", err);
      return null;
    }
  }

  async function handleLogout() {
    try {
      if (supabaseClient) {
        await supabaseClient.auth.signOut();
      }
    } catch (err) {
      console.warn("Sign out error:", err);
    }

    window.location.href = LOGIN_PATH;
  }

  // ---------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------
  async function fetchJson(url, options = {}) {
    const res = await fetch(url, options);
    let json = null;

    try {
      json = await res.json();
    } catch (err) {
      json = null;
    }

    if (!res.ok) {
      const message =
        json?.error || json?.message || `Request failed: ${res.status}`;
      throw new Error(message);
    }

    return json;
  }

  async function fetchUserData(email) {
    if (!email) throw new Error("Missing user email");

    const attempts = [
      async () =>
        fetchJson(`/api/get-user-data?email=${encodeURIComponent(email)}`),
      async () =>
        fetchJson(`/api/get-user-data?user_email=${encodeURIComponent(email)}`),
      async () =>
        fetchJson("/api/get-user-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }),
      async () =>
        fetchJson("/api/get-user-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_email: email }),
        }),
    ];

    let lastError = null;

    for (const attempt of attempts) {
      try {
        const data = await attempt();
        return data;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("Failed to load user data");
  }

  async function fetchProfileData(email) {
    if (!email) return null;

    try {
      const json = await fetchJson(
        `/api/profile?user_email=${encodeURIComponent(email)}`
      );
      return json?.profile || null;
    } catch (err) {
      console.warn("Profile load skipped/failed:", err.message);
      return null;
    }
  }

  // ---------------------------------------------------------
  // Normalization
  // ---------------------------------------------------------
  function normalizeAccountData(raw, userEmail) {
    const account = raw?.user || raw?.account || raw?.data || raw || {};

    const email =
      account.email ||
      account.user_email ||
      account.customer_email ||
      userEmail ||
      "";

    const referralCode =
      account.referral_code ||
      account.referralCode ||
      account.ref_code ||
      account.code ||
      "";

    const referralLink =
      account.referral_link ||
      account.referralLink ||
      buildReferralLink(referralCode);

    const inviteTier =
      account.invite_tier ||
      account.inviteTier ||
      account.tier ||
      "Founder Beta";

    const stripeCustomer =
      account.stripe_customer_id ||
      account.stripeCustomerId ||
      account.stripe_customer ||
      "";

    const plan =
      account.plan ||
      account.plan_name ||
      account.subscription_plan ||
      "Founder Beta";

    const subscriptionStatus =
      account.subscription_status ||
      account.status ||
      account.billing_status ||
      "active";

    const founderPricing =
      account.founder_pricing ||
      account.founderPricing ||
      "Locked";

    const billingStatus =
      account.billing_status ||
      account.subscription_status ||
      "active";

    const successfulReferrals = Number(
      account.successful_referrals ||
        account.referrals_count ||
        account.referral_count ||
        account.referrals ||
        0
    );

    const unlockedInvites = Number(
      account.unlocked_invites ||
        account.invites_unlocked ||
        account.max_invites ||
        1
    );

    const usedInvites = Number(
      account.used_invites || account.invites_used || 0
    );

    const remainingInvites = Math.max(
      0,
      Number(
        account.remaining_invites ??
          account.invites_remaining ??
          unlockedInvites - usedInvites
      )
    );

    const billingReadiness =
      account.billing_readiness ||
      account.billingReady ||
      (stripeCustomer ? "Ready" : "Pending");

    return {
      email,
      referralCode,
      referralLink,
      inviteTier,
      stripeCustomer,
      plan,
      subscriptionStatus,
      founderPricing,
      billingStatus,
      successfulReferrals,
      unlockedInvites,
      usedInvites,
      remainingInvites,
      billingReadiness,
      raw: account,
    };
  }

  function normalizeProfile(profile, emailFallback) {
    if (!profile) {
      return {
        full_name: "",
        dealership_name: "",
        city: "",
        province: "",
        compliance_mode: "",
        display_email: emailFallback || "",
      };
    }

    return {
      full_name: profile.full_name || "",
      dealership_name: profile.dealership_name || "",
      city: profile.city || "",
      province: profile.province || "",
      compliance_mode: profile.compliance_mode || "",
      display_email:
        profile.display_email || profile.user_email || emailFallback || "",
    };
  }

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------
  function renderAccount(account, profile) {
    currentAccountData = account;

    // Overview
    setText("founderPricingValue", account.founderPricing);
    setText("billingStatusValue", safeUpper(account.billingStatus));
    setText("currentPlanValue", account.plan);
    setText("planValue", account.plan);
    setText("subscriptionStatusValue", safeUpper(account.subscriptionStatus));
    setText("privateReferralLink", account.referralLink || "-");
    setText("referralCount", account.successfulReferrals);
    setText("unlockedInvites", account.unlockedInvites);
    setText("usedInvites", account.usedInvites);
    setText("remainingInvites", account.remainingInvites);
    setText("billingReadiness", account.billingReadiness);

    // Snapshot
    setText("snapshotEmail", account.email || profile.display_email || "-");
    setText("snapshotReferralCode", account.referralCode || "-");
    setText("snapshotInviteTier", account.inviteTier || "-");
    setText("snapshotStripeCustomer", clip(account.stripeCustomer || "-", 28));

    // Sidebar workspace
    const workspaceName =
      profile.dealership_name || "Elevate Automation Workspace";
    const workspaceMeta = [profile.city, profile.province]
      .filter(Boolean)
      .join(", ");

    setText("sidebarWorkspaceName", workspaceName);
    setText("sidebarWorkspaceMeta", workspaceMeta || "Founder Beta");

    // Referrals section
    setText("referralLinkSectionValue", clip(account.referralLink || "-", 36));
    setText("referralCodeSectionValue", account.referralCode || "-");
    setText("referralCountSectionValue", account.successfulReferrals);
    setText("remainingInvitesSectionValue", account.remainingInvites);

    // Billing section
    setText("billingPlanValue", account.plan);
    setText("billingStatusSectionValue", safeUpper(account.billingStatus));
    setText("billingFounderValue", account.founderPricing);
    setText(
      "billingStripeValue",
      clip(account.stripeCustomer || "Not created yet", 28)
    );
  }

  // ---------------------------------------------------------
  // Referral copy
  // ---------------------------------------------------------
  async function copyReferralLink() {
    const link = currentAccountData?.referralLink || "";

    if (!link) {
      showStatus("Referral link is not available yet.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      showStatus("Referral link copied.", "success");
    } catch (err) {
      console.error("Copy failed:", err);
      showStatus("Failed to copy referral link.", "error");
    }
  }

  function wireButtons() {
    $("copyReferralTopBtn")?.addEventListener("click", copyReferralLink);
    $("copyReferralSidebarBtn")?.addEventListener("click", copyReferralLink);
    $("copyReferralInlineBtn")?.addEventListener("click", copyReferralLink);
    $("copyReferralSectionBtn")?.addEventListener("click", copyReferralLink);

    $("logoutBtn")?.addEventListener("click", handleLogout);
    $("logoutTopBtn")?.addEventListener("click", handleLogout);

    // Optional quick route helpers if you add these later
    const profileLinkTargets = document.querySelectorAll(
      '[data-go-profile="true"]'
    );
    profileLinkTargets.forEach((btn) => {
      btn.addEventListener("click", () => {
        window.location.href = DEFAULT_PROFILE_PATH;
      });
    });
  }

  // ---------------------------------------------------------
  // Session watcher
  // ---------------------------------------------------------
  function wireAuthWatcher() {
    if (!supabaseClient) return;

    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        window.location.href = LOGIN_PATH;
      }
    });
  }

  // ---------------------------------------------------------
  // Init
  // ---------------------------------------------------------
  async function initDashboard() {
    initSectionNavigation();
    wireButtons();

    showStatus("Loading dashboard...", "");

    const supabaseReady = initSupabase();

    if (!supabaseReady) {
      showStatus(
        "Supabase config missing in dashboard.js. Set SUPABASE_URL and SUPABASE_ANON_KEY first.",
        "error"
      );
      return;
    }

    wireAuthWatcher();

    currentUser = await getCurrentUser();

    if (!currentUser) {
      window.location.href = LOGIN_PATH;
      return;
    }

    try {
      const [userDataRaw, profileRaw] = await Promise.all([
        fetchUserData(currentUser.email),
        fetchProfileData(currentUser.email),
      ]);

      const account = normalizeAccountData(userDataRaw, currentUser.email);
      const profile = normalizeProfile(profileRaw, currentUser.email);

      renderAccount(account, profile);
      clearStatus();
    } catch (err) {
      console.error("Dashboard load failed:", err);

      // still render a partial safe state using session info
      const fallbackAccount = normalizeAccountData({}, currentUser.email);
      const fallbackProfile = normalizeProfile(null, currentUser.email);

      renderAccount(fallbackAccount, fallbackProfile);

      showStatus(
        `Dashboard loaded partially. ${err.message || "Some account data could not be loaded."}`,
        "error"
      );
    }
  }

  document.addEventListener("DOMContentLoaded", initDashboard);
})();



