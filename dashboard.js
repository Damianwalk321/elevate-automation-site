// dashboard.js
// Full replacement matched to current dashboard.html

// =========================
// CONFIG
// =========================
const SUPABASE_URL = "https://teixblbxkoershwgqpym.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaXhibGJ4a29lcnNod2dxcHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODUzMDMsImV4cCI6MjA4ODY2MTMwM30.wxt9zjKhsBuflaFZZT9awZiwckRzYkEl-OLm_4q8qF4";

// =========================
// GLOBAL STATE
// =========================
let supabaseClient = null;
let currentUser = null;
let currentProfile = null;

// =========================
// BOOT
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    setBootStatus("Loading dashboard...");

    if (!window.supabase || !window.supabase.createClient) {
      console.error("Supabase library not found.");
      setBootStatus("Supabase library missing.");
      return;
    }

    if (!SUPABASE_URL || SUPABASE_URL === "YOUR_SUPABASE_URL") {
      console.error("Missing SUPABASE_URL in dashboard.js");
      setBootStatus("Missing Supabase URL.");
      return;
    }

    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY") {
      console.error("Missing SUPABASE_ANON_KEY in dashboard.js");
      setBootStatus("Missing Supabase anon key.");
      return;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    wireUI();

    const {
      data: { session },
      error: sessionError
    } = await supabaseClient.auth.getSession();

    if (sessionError) {
      console.error("Session error:", sessionError);
      setBootStatus("Session error.");
      return;
    }

    if (!session || !session.user) {
      redirectToLogin();
      return;
    }

    currentUser = session.user;

    renderUserBasics(currentUser);

    await syncUserIfNeeded(currentUser);
    await loadProfile(currentUser.id);
    await loadAccountData(currentUser);

    showSection("overview");

    setBootStatus("");
  } catch (error) {
    console.error("Dashboard boot failed:", error);
    setBootStatus("Dashboard failed to load.");
  }
});

// =========================
// UI WIRING
// =========================
function wireUI() {
  const navButtons = document.querySelectorAll("[data-section]");
  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const sectionId = button.getAttribute("data-section");
      showSection(sectionId);
    });
  });

  const saveProfileBtn = document.getElementById("saveProfileBtn");
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async () => {
      if (!currentUser) return;
      await saveProfile(currentUser);
    });
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await signOutUser();
    });
  }

  const refreshAccessBtn = document.getElementById("refreshAccessBtn");
  if (refreshAccessBtn) {
    refreshAccessBtn.addEventListener("click", async () => {
      if (!currentUser) return;
      await loadAccountData(currentUser);
    });
  }
}

// =========================
// SECTION CONTROL
// =========================
function showSection(sectionId) {
  const sections = document.querySelectorAll(".dashboard-section");
  const navButtons = document.querySelectorAll("[data-section]");

  sections.forEach((section) => {
    section.style.display = section.id === sectionId ? "block" : "none";
  });

  navButtons.forEach((button) => {
    const isActive = button.getAttribute("data-section") === sectionId;
    button.classList.toggle("active", isActive);
  });

  const titleMap = {
    overview: "Founder Beta Dashboard",
    profile: "Profile & Dealer Setup",
    compliance: "Compliance",
    affiliate: "Affiliate Center",
    billing: "Billing & Access",
    tools: "Tools & Modules"
  };

  const pageTitle = document.getElementById("dashboardPageTitle");
  if (pageTitle) {
    pageTitle.textContent = titleMap[sectionId] || "Dashboard";
  }
}

// =========================
// USER BASICS
// =========================
function renderUserBasics(user) {
  setTextForAll(".user-email", user.email || "");
  setTextForAll(".user-id", user.id || "");

  const welcomeText = document.getElementById("welcomeText");
  if (welcomeText) {
    welcomeText.textContent = `Welcome${user.email ? `, ${user.email}` : ""}`;
  }
}

// =========================
// PROFILE
// =========================
async function loadProfile(userId) {
  try {
    setStatus("profileStatus", "Loading profile...");

    const response = await fetch(`/api/profile?id=${encodeURIComponent(userId)}`);
    const result = await response.json();

    if (!response.ok) {
      console.warn("Profile load failed:", result);
      currentProfile = null;
      clearProfileFields();
      renderProfileSummary(null);
      setStatus("profileStatus", "No profile loaded yet.");
      return;
    }

    if (!result.data) {
      currentProfile = null;
      clearProfileFields();
      renderProfileSummary(null);
      setStatus("profileStatus", "No profile found yet.");
      return;
    }

    currentProfile = result.data;

    setFieldValue("full_name", result.data.full_name);
    setFieldValue("dealership", result.data.dealership);
    setFieldValue("city", result.data.city);
    setFieldValue("province", result.data.province);
    setFieldValue("phone", result.data.phone);
    setFieldValue("license_number", result.data.license_number);
    setFieldValue("listing_location", result.data.listing_location);
    setFieldValue("dealer_phone", result.data.dealer_phone);
    setFieldValue("dealer_email", result.data.dealer_email);
    setFieldValue("compliance_mode", result.data.compliance_mode || result.data.province);

    renderProfileSummary(result.data);
    setStatus("profileStatus", "Profile loaded.");
  } catch (error) {
    console.error("loadProfile error:", error);
    setStatus("profileStatus", "Failed to load profile.");
  }
}

async function saveProfile(user) {
  try {
    setStatus("profileStatus", "Saving profile...");

    const payload = {
      id: user.id,
      email: user.email || "",
      full_name: getFieldValue("full_name"),
      dealership: getFieldValue("dealership"),
      city: getFieldValue("city"),
      province: getFieldValue("province"),
      phone: getFieldValue("phone"),
      license_number: getFieldValue("license_number"),
      listing_location: getFieldValue("listing_location"),
      dealer_phone: getFieldValue("dealer_phone"),
      dealer_email: getFieldValue("dealer_email"),
      compliance_mode: getFieldValue("compliance_mode")
    };

    const response = await fetch("/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Profile save failed:", result);
      setStatus("profileStatus", `Save failed: ${result.error || "Unknown error"}`);
      return;
    }

    currentProfile = payload;
    renderProfileSummary(payload);
    setStatus("profileStatus", "Profile saved successfully.");
  } catch (error) {
    console.error("saveProfile error:", error);
    setStatus("profileStatus", "Failed to save profile.");
  }
}

function clearProfileFields() {
  const fieldIds = [
    "full_name",
    "dealership",
    "city",
    "province",
    "phone",
    "license_number",
    "listing_location",
    "dealer_phone",
    "dealer_email",
    "compliance_mode"
  ];

  fieldIds.forEach((id) => setFieldValue(id, ""));
}

function renderProfileSummary(profile) {
  const summaryEl = document.getElementById("profileSummary");
  if (!summaryEl) return;

  if (!profile) {
    summaryEl.innerHTML = `
      <div><strong>Name:</strong> Not set</div>
      <div><strong>Dealership:</strong> Not set</div>
      <div><strong>City:</strong> Not set</div>
      <div><strong>Province:</strong> Not set</div>
      <div><strong>Phone:</strong> Not set</div>
      <div><strong>License:</strong> Not set</div>
      <div><strong>Default Listing Location:</strong> Not set</div>
      <div><strong>Dealer Phone:</strong> Not set</div>
      <div><strong>Dealer Email:</strong> Not set</div>
      <div><strong>Compliance Mode:</strong> Not set</div>
    `;
    return;
  }

  summaryEl.innerHTML = `
    <div><strong>Name:</strong> ${escapeHtml(profile.full_name || "Not set")}</div>
    <div><strong>Dealership:</strong> ${escapeHtml(profile.dealership || "Not set")}</div>
    <div><strong>City:</strong> ${escapeHtml(profile.city || "Not set")}</div>
    <div><strong>Province:</strong> ${escapeHtml(profile.province || "Not set")}</div>
    <div><strong>Phone:</strong> ${escapeHtml(profile.phone || "Not set")}</div>
    <div><strong>License:</strong> ${escapeHtml(profile.license_number || "Not set")}</div>
    <div><strong>Default Listing Location:</strong> ${escapeHtml(profile.listing_location || "Not set")}</div>
    <div><strong>Dealer Phone:</strong> ${escapeHtml(profile.dealer_phone || "Not set")}</div>
    <div><strong>Dealer Email:</strong> ${escapeHtml(profile.dealer_email || "Not set")}</div>
    <div><strong>Compliance Mode:</strong> ${escapeHtml(profile.compliance_mode || profile.province || "Not set")}</div>
  `;
}

// =========================
// ACCOUNT / BILLING / ACCESS
// =========================
async function loadAccountData(user) {
  try {
    setStatus("accountStatus", "Loading account data...");

    const response = await fetch(`/api/get-user-data?email=${encodeURIComponent(user.email)}`);
    const result = await response.json();

    if (!response.ok) {
      console.warn("Account data load failed:", result);
      renderAccessState(null);
      setStatus("accountStatus", "Could not load account data.");
      return;
    }

    renderAccessState(result);
    setStatus("accountStatus", "Account data loaded.");
  } catch (error) {
    console.error("loadAccountData error:", error);
    renderAccessState(null);
    setStatus("accountStatus", "Failed to load account data.");
  }
}

function renderAccessState(data) {
  const hasAccess = Boolean(
    data &&
    (
      data.access === true ||
      data.active === true ||
      data.subscription_active === true ||
      data.status === "active"
    )
  );

  setTextByIdForAll("accessBadge", hasAccess ? "Active Access" : "Inactive Access");
  setTextByIdForAll("planName", data?.plan_name || data?.plan || data?.price_id || "Founder Beta");
  setTextByIdForAll("subscriptionStatus", data?.status || (hasAccess ? "active" : "inactive"));
  setTextByIdForAll("referralCode", data?.referral_code || data?.refCode || "Not assigned yet");
  setTextByIdForAll("licenseKeyDisplay", data?.license_key || data?.licenseKey || "Account-based access enabled");

  document.querySelectorAll("#accessBadge").forEach((el) => {
    el.classList.remove("active", "inactive");
    el.classList.add(hasAccess ? "active" : "inactive");
  });
}

// =========================
// USER SYNC
// =========================
async function syncUserIfNeeded(user) {
  try {
    await fetch("/api/sync-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: user.id,
        email: user.email || ""
      })
    });
  } catch (error) {
    console.warn("syncUserIfNeeded warning:", error);
  }
}

// =========================
// AUTH
// =========================
async function signOutUser() {
  try {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    redirectToLogin();
  } catch (error) {
    console.error("signOutUser error:", error);
    alert("Failed to sign out.");
  }
}

function redirectToLogin() {
  window.location.href = "/login.html";
}

// =========================
// HELPERS
// =========================
function getFieldValue(id) {
  const el = document.getElementById(id);
  if (!el) return "";
  return (el.value || "").trim();
}

function setFieldValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value || "";
}

function setStatus(id, text) {
  document.querySelectorAll(`#${id}`).forEach((el) => {
    el.textContent = text || "";
  });
}

function setBootStatus(text) {
  const el = document.getElementById("bootStatus");
  if (el) el.textContent = text || "";
}

function setTextForAll(selector, text) {
  document.querySelectorAll(selector).forEach((el) => {
    el.textContent = text || "";
  });
}

function setTextByIdForAll(id, text) {
  document.querySelectorAll(`#${id}`).forEach((el) => {
    el.textContent = text || "";
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// =========================
// OPTIONAL GLOBAL EXPOSURE
// =========================
window.showSection = showSection;
window.saveProfile = () => {
  if (!currentUser) return;
  return saveProfile(currentUser);
};
window.signOutUser = signOutUser;