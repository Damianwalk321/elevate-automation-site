// dashboard.js
// Full replacement for Elevate Automation dashboard logic

// =========================
// CONFIG
// =========================
const SUPABASE_URL = "https://teixblbxkoershwgqpym.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaXhibGJ4a29lcnNod2dxcHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODUzMDMsImV4cCI6MjA4ODY2MTMwM30.wxt9zjKhsBuflaFZZT9awZiwckRzYkEl-OLm_4q8qF4";

// =========================
// GLOBALS
// =========================
let supabaseClient = null;
let currentUser = null;
let currentProfile = null;

// =========================
// STARTUP
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    bootStatus("Loading dashboard...");

    if (!window.supabase || !window.supabase.createClient) {
      console.error("Supabase library not found on window.");
      bootStatus("Supabase library missing.");
      return;
    }

    if (!SUPABASE_URL || SUPABASE_URL === "YOUR_SUPABASE_URL") {
      console.error("SUPABASE_URL missing in dashboard.js");
      bootStatus("Supabase config missing: URL");
      return;
    }

    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY") {
      console.error("SUPABASE_ANON_KEY missing in dashboard.js");
      bootStatus("Supabase config missing: ANON KEY");
      return;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    await initializeDashboard();
    wireUI();

    bootStatus("");
  } catch (error) {
    console.error("Dashboard boot error:", error);
    bootStatus("Dashboard failed to load.");
  }
});

// =========================
// INITIALIZE
// =========================
async function initializeDashboard() {
  const {
    data: { session },
    error: sessionError
  } = await supabaseClient.auth.getSession();

  if (sessionError) {
    console.error("Session error:", sessionError);
    bootStatus("Session error.");
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
}

// =========================
// UI WIRING
// =========================
function wireUI() {
  // Sidebar / nav section buttons
  const navButtons = document.querySelectorAll("[data-section]");
  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-section");
      showSection(target);
    });
  });

  // Save profile button
  const saveBtn = document.getElementById("saveProfileBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      if (!currentUser) return;
      await saveProfile(currentUser);
    });
  }

  // Logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", signOutUser);
  }

  // Refresh account/access button
  const refreshBtn = document.getElementById("refreshAccessBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      if (!currentUser) return;
      await loadAccountData(currentUser);
    });
  }
}

// =========================
// SECTION SWITCHING
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

  const pageTitle = document.getElementById("dashboardPageTitle");
  if (pageTitle) {
    const titles = {
      overview: "Founder Beta Dashboard",
      profile: "Profile & Dealer Setup",
      compliance: "Compliance Settings",
      affiliate: "Affiliate Center",
      billing: "Billing & Access",
      tools: "Tools & Modules"
    };

    pageTitle.textContent = titles[sectionId] || "Dashboard";
  }
}

// =========================
// USER BASICS
// =========================
function renderUserBasics(user) {
  const emailEls = document.querySelectorAll(".user-email");
  emailEls.forEach((el) => {
    el.textContent = user.email || "";
  });

  const idEls = document.querySelectorAll(".user-id");
  idEls.forEach((el) => {
    el.textContent = user.id || "";
  });

  const welcomeEl = document.getElementById("welcomeText");
  if (welcomeEl) {
    welcomeEl.textContent = `Welcome${user.email ? `, ${user.email}` : ""}`;
  }
}

// =========================
// PROFILE LOAD / SAVE
// =========================
async function loadProfile(userId) {
  try {
    setStatus("profileStatus", "Loading profile...");

    const res = await fetch(`/api/profile?id=${encodeURIComponent(userId)}`);
    const result = await res.json();

    if (!res.ok) {
      console.warn("Profile load failed:", result);
      setStatus("profileStatus", "No profile loaded yet.");
      return;
    }

    if (!result.data) {
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

    // Optional fields for future-proofing
    setFieldValue("dealer_phone", result.data.dealer_phone);
    setFieldValue("dealer_email", result.data.dealer_email);
    setFieldValue("compliance_mode", result.data.compliance_mode);

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

      // Optional/future-safe fields
      dealer_phone: getFieldValue("dealer_phone"),
      dealer_email: getFieldValue("dealer_email"),
      compliance_mode: getFieldValue("compliance_mode")
    };

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!res.ok) {
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

function renderProfileSummary(profile) {
  const summaryEl = document.getElementById("profileSummary");
  if (!summaryEl) return;

  const fullName = profile.full_name || "Not set";
  const dealership = profile.dealership || "Not set";
  const city = profile.city || "Not set";
  const province = profile.province || "Not set";
  const phone = profile.phone || "Not set";
  const license = profile.license_number || "Not set";
  const listingLocation = profile.listing_location || "Not set";

  summaryEl.innerHTML = `
    <div><strong>Name:</strong> ${escapeHtml(fullName)}</div>
    <div><strong>Dealership:</strong> ${escapeHtml(dealership)}</div>
    <div><strong>City:</strong> ${escapeHtml(city)}</div>
    <div><strong>Province:</strong> ${escapeHtml(province)}</div>
    <div><strong>Phone:</strong> ${escapeHtml(phone)}</div>
    <div><strong>License:</strong> ${escapeHtml(license)}</div>
    <div><strong>Default Listing Location:</strong> ${escapeHtml(listingLocation)}</div>
  `;
}

// =========================
// ACCOUNT / BILLING / ACCESS
// =========================
async function loadAccountData(user) {
  try {
    setStatus("accountStatus", "Loading account data...");

    const res = await fetch(`/api/get-user-data?email=${encodeURIComponent(user.email)}`);
    const result = await res.json();

    if (!res.ok) {
      console.warn("Account data load failed:", result);
      setStatus("accountStatus", "Could not load account data.");
      renderAccessState(null);
      return;
    }

    renderAccessState(result);
    setStatus("accountStatus", "Account data loaded.");
  } catch (error) {
    console.error("loadAccountData error:", error);
    setStatus("accountStatus", "Failed to load account data.");
    renderAccessState(null);
  }
}

function renderAccessState(data) {
  const accessBadge = document.getElementById("accessBadge");
  const planEl = document.getElementById("planName");
  const statusEl = document.getElementById("subscriptionStatus");
  const referralEl = document.getElementById("referralCode");
  const licenseEl = document.getElementById("licenseKeyDisplay");

  if (!data) {
    if (accessBadge) accessBadge.textContent = "Unknown";
    if (planEl) planEl.textContent = "Not available";
    if (statusEl) statusEl.textContent = "Not available";
    if (referralEl) referralEl.textContent = "Not available";
    if (licenseEl) licenseEl.textContent = "Not available";
    return;
  }

  const hasAccess =
    data.access === true ||
    data.active === true ||
    data.subscription_active === true ||
    data.status === "active";

  if (accessBadge) {
    accessBadge.textContent = hasAccess ? "Active Access" : "Inactive Access";
    accessBadge.classList.toggle("active", hasAccess);
    accessBadge.classList.toggle("inactive", !hasAccess);
  }

  if (planEl) {
    planEl.textContent =
      data.plan_name ||
      data.plan ||
      data.price_id ||
      "Founder Beta";
  }

  if (statusEl) {
    statusEl.textContent =
      data.status ||
      (hasAccess ? "active" : "inactive");
  }

  if (referralEl) {
    referralEl.textContent =
      data.referral_code ||
      data.refCode ||
      "Not assigned yet";
  }

  if (licenseEl) {
    licenseEl.textContent =
      data.license_key ||
      data.licenseKey ||
      "Account-based access enabled";
  }
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
        email: user.email
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
    console.error("Logout error:", error);
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
  return el.value ? el.value.trim() : "";
}

function setFieldValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value || "";
}

function setStatus(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || "";
}

function bootStatus(text) {
  const el = document.getElementById("bootStatus");
  if (!el) return;
  el.textContent = text || "";
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
// EXPOSE OPTIONAL GLOBALS
// =========================
window.showSection = showSection;
window.saveProfile = () => {
  if (!currentUser) return;
  saveProfile(currentUser);
};
window.signOutUser = signOutUser;