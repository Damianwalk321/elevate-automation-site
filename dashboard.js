// dashboard.js
// Full replacement with extension control panel + dealer routing + setup state

const SUPABASE_URL = "https://teixblbxkoershwgqpym.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaXhibGJ4a29lcnNod2dxcHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODUzMDMsImV4cCI6MjA4ODY2MTMwM30.wxt9zjKhsBuflaFZZT9awZiwckRzYkEl-OLm_4q8qF4";

let supabaseClient = null;
let currentUser = null;
let currentProfile = null;
let currentAccountData = null;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    setBootStatus("Loading dashboard...");

    if (!window.supabase || !window.supabase.createClient) {
      setBootStatus("Supabase library missing.");
      return;
    }

    if (!SUPABASE_URL || SUPABASE_URL === "YOUR_SUPABASE_URL") {
      setBootStatus("Missing Supabase URL.");
      return;
    }

    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY") {
      setBootStatus("Missing Supabase anon key.");
      return;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    bindDashboardUI();

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

function bindDashboardUI() {
  const navButtons = document.querySelectorAll("[data-section]");
  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const sectionId = button.getAttribute("data-section");
      showSection(sectionId);
    });
  });

  const saveBtn = document.getElementById("saveProfileBtn");
  if (saveBtn) {
    saveBtn.type = "button";
    saveBtn.removeAttribute("onclick");
    saveBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await onSaveProfilePressed();
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

  const refreshExtensionStateBtn = document.getElementById("refreshExtensionStateBtn");
  if (refreshExtensionStateBtn) {
    refreshExtensionStateBtn.addEventListener("click", async () => {
      if (!currentUser) return;
      await loadAccountData(currentUser);
      setStatus("extensionActionStatus", "Extension state refreshed.");
    });
  }

  const openMarketplaceBtn = document.getElementById("openMarketplaceBtn");
  if (openMarketplaceBtn) {
    openMarketplaceBtn.addEventListener("click", () => {
      window.open("https://www.facebook.com/marketplace/create/vehicle", "_blank");
    });
  }

  const openInventoryBtn = document.getElementById("openInventoryBtn");
  if (openInventoryBtn) {
    openInventoryBtn.addEventListener("click", () => {
      const inventoryUrl = getFieldValue("inventory_url") || currentProfile?.inventory_url || "";
      if (!inventoryUrl) {
        setStatus("extensionActionStatus", "No inventory URL saved yet.");
        return;
      }
      window.open(normalizeUrlInput(inventoryUrl), "_blank");
      setStatus("extensionActionStatus", "Opening inventory URL...");
    });
  }

  const copySetupStepsBtn = document.getElementById("copySetupStepsBtn");
  if (copySetupStepsBtn) {
    copySetupStepsBtn.addEventListener("click", async () => {
      const setupText = buildSetupStepsText();
      try {
        await navigator.clipboard.writeText(setupText);
        setStatus("extensionActionStatus", "Setup steps copied.");
      } catch (error) {
        console.error("Clipboard error:", error);
        setStatus("extensionActionStatus", "Could not copy setup steps.");
      }
    });
  }
}

async function onSaveProfilePressed() {
  try {
    setStatus("profileStatus", "Save button clicked...");

    if (!currentUser) {
      setStatus("profileStatus", "No authenticated user found.");
      return;
    }

    await submitProfileSave(currentUser);

    if (currentUser) {
      await loadAccountData(currentUser);
    }
  } catch (error) {
    console.error("onSaveProfilePressed error:", error);
    setStatus("profileStatus", `Save failed: ${error.message || "Unknown error"}`);
  }
}

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
    extension: "Extension Control",
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

function renderUserBasics(user) {
  setTextForAll(".user-email", user.email || "");
  setTextForAll(".user-id", user.id || "");

  const welcomeText = document.getElementById("welcomeText");
  if (welcomeText) {
    welcomeText.textContent = `Welcome${user.email ? `, ${user.email}` : ""}`;
  }
}

async function loadProfile(userId) {
  try {
    setStatus("profileStatus", "Loading profile...");

    const response = await fetch(`/api/profile?id=${encodeURIComponent(userId)}`, {
      method: "GET"
    });

    const result = await response.json();

    if (!response.ok) {
      console.warn("Profile load failed:", result);
      currentProfile = null;
      renderProfileSummary(null);
      updateSetupStates(null, currentAccountData);
      setStatus("profileStatus", "No profile loaded yet.");
      return;
    }

    if (!result.data) {
      currentProfile = null;
      renderProfileSummary(null);
      updateSetupStates(null, currentAccountData);
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
    setFieldValue("dealer_website", result.data.dealer_website);
    setFieldValue("inventory_url", result.data.inventory_url);
    setFieldValue("scanner_type", result.data.scanner_type);
    setFieldValue("software_license_key", result.data.software_license_key || "");

    renderProfileSummary(result.data);
    updateSetupStates(currentProfile, currentAccountData);
    setStatus("profileStatus", "Profile loaded.");
  } catch (error) {
    console.error("loadProfile error:", error);
    setStatus("profileStatus", "Failed to load profile.");
  }
}

async function submitProfileSave(user) {
  try {
    setStatus("profileStatus", "Preparing profile payload...");

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
      compliance_mode: getFieldValue("compliance_mode"),
      dealer_website: normalizeUrlInput(getFieldValue("dealer_website")),
      inventory_url: normalizeUrlInput(getFieldValue("inventory_url")),
      scanner_type: getFieldValue("scanner_type")
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
      setStatus("profileStatus", `Save failed: ${result.error || result.message || "Unknown error"}`);
      return;
    }

    currentProfile = result.data || payload;

    if (currentProfile?.software_license_key) {
      setFieldValue("software_license_key", currentProfile.software_license_key);
    }

    renderProfileSummary(currentProfile);
    updateSetupStates(currentProfile, currentAccountData);
    setStatus("profileStatus", "Profile saved successfully.");
  } catch (error) {
    console.error("submitProfileSave error:", error);
    setStatus("profileStatus", `Failed to save profile: ${error.message || "Unknown error"}`);
  }
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
      <div><strong>Compliance License Number:</strong> Not set</div>
      <div><strong>Default Listing Location:</strong> Not set</div>
      <div><strong>Dealer Phone:</strong> Not set</div>
      <div><strong>Dealer Email:</strong> Not set</div>
      <div><strong>Compliance Mode:</strong> Not set</div>
      <div><strong>Dealer Website:</strong> Not set</div>
      <div><strong>Inventory URL:</strong> Not set</div>
      <div><strong>Scanner Type:</strong> Not set</div>
      <div><strong>Software License Key:</strong> Not loaded</div>
    `;
    return;
  }

  summaryEl.innerHTML = `
    <div><strong>Name:</strong> ${escapeHtml(profile.full_name || "Not set")}</div>
    <div><strong>Dealership:</strong> ${escapeHtml(profile.dealership || "Not set")}</div>
    <div><strong>City:</strong> ${escapeHtml(profile.city || "Not set")}</div>
    <div><strong>Province:</strong> ${escapeHtml(profile.province || "Not set")}</div>
    <div><strong>Phone:</strong> ${escapeHtml(profile.phone || "Not set")}</div>
    <div><strong>Compliance License Number:</strong> ${escapeHtml(profile.license_number || "Not set")}</div>
    <div><strong>Default Listing Location:</strong> ${escapeHtml(profile.listing_location || "Not set")}</div>
    <div><strong>Dealer Phone:</strong> ${escapeHtml(profile.dealer_phone || "Not set")}</div>
    <div><strong>Dealer Email:</strong> ${escapeHtml(profile.dealer_email || "Not set")}</div>
    <div><strong>Compliance Mode:</strong> ${escapeHtml(profile.compliance_mode || profile.province || "Not set")}</div>
    <div><strong>Dealer Website:</strong> ${escapeHtml(profile.dealer_website || "Not set")}</div>
    <div><strong>Inventory URL:</strong> ${escapeHtml(profile.inventory_url || "Not set")}</div>
    <div><strong>Scanner Type:</strong> ${escapeHtml(profile.scanner_type || "Not set")}</div>
    <div><strong>Software License Key:</strong> ${escapeHtml(profile.software_license_key || "Not loaded")}</div>
  `;
}

async function loadAccountData(user) {
  try {
    setStatus("accountStatus", "Loading account data...");
    setStatus("accountStatusBilling", "Loading account data...");
    setStatus("extensionAccessStatus", "Loading extension state...");

    const response = await fetch(`/api/extension-state?email=${encodeURIComponent(user.email)}`);
    const result = await response.json();

    if (!response.ok) {
      console.warn("Extension/account data load failed:", result);
      currentAccountData = null;
      renderAccessState(null);
      renderExtensionControl(null, currentProfile);
      updateSetupStates(currentProfile, null);
      setStatus("accountStatus", "Could not load account data.");
      setStatus("accountStatusBilling", "Could not load account data.");
      setStatus("extensionAccessStatus", "Could not load extension state.");
      return;
    }

    currentAccountData = result || null;

    renderAccessState(result);
    renderExtensionControl(result, currentProfile);
    updateSetupStates(currentProfile, result);

    setStatus("accountStatus", "Account data loaded.");
    setStatus("accountStatusBilling", "Account data loaded.");
    setStatus("extensionAccessStatus", "Extension state loaded.");

    const softwareLicenseKey = result?.license_key || "Not assigned";
    setTextByIdForAll("licenseKeyDisplay", softwareLicenseKey);
    setTextByIdForAll("licenseKeyDisplayBilling", softwareLicenseKey);

    const referral = result?.referral_code || "Not assigned yet";
    setTextByIdForAll("referralCode", referral);
    setTextByIdForAll("referralCodeAffiliate", referral);

    setTextByIdForAll("planNameBilling", result?.plan || result?.plan_name || "Founder Beta");
    setTextByIdForAll("subscriptionStatusBilling", result?.status || "inactive");

    const access = Boolean(result?.access);
    setTextByIdForAll("accessBadgeBilling", access ? "Active Access" : "Inactive Access");
    document.querySelectorAll("#accessBadgeBilling").forEach((el) => {
      el.classList.remove("active", "inactive", "warn");
      el.classList.add(access ? "active" : "inactive");
    });

    const softwareLicenseInput = document.getElementById("software_license_key");
    if (softwareLicenseInput) {
      softwareLicenseInput.value = result?.license_key || "";
    }

    if (currentProfile) {
      currentProfile.software_license_key = result?.license_key || "";
      renderProfileSummary(currentProfile);
    }
  } catch (error) {
    console.error("loadAccountData error:", error);
    currentAccountData = null;
    renderAccessState(null);
    renderExtensionControl(null, currentProfile);
    updateSetupStates(currentProfile, null);
    setStatus("accountStatus", "Failed to load account data.");
    setStatus("accountStatusBilling", "Failed to load account data.");
    setStatus("extensionAccessStatus", "Failed to load extension state.");
  }
}

function renderAccessState(data) {
  const hasAccess = Boolean(data?.access);

  setTextByIdForAll("accessBadge", hasAccess ? "Active Access" : "Inactive Access");
  setTextByIdForAll("planName", data?.plan || data?.plan_name || "Founder Beta");
  setTextByIdForAll("subscriptionStatus", data?.status || (hasAccess ? "active" : "inactive"));

  document.querySelectorAll("#accessBadge").forEach((el) => {
    el.classList.remove("active", "inactive", "warn");
    el.classList.add(hasAccess ? "active" : "inactive");
  });
}

function renderExtensionControl(data, profile) {
  const mergedProfile = profile || {};
  const extensionData = data || {};
  const hasAccess = Boolean(extensionData?.access);
  const limit = Number(extensionData?.posting_limit || 0);
  const used = Number(extensionData?.posts_today || 0);
  const remaining = Math.max(limit - used, 0);

  const dealerWebsite = extensionData?.dealer_site || mergedProfile?.dealer_website || "Not set";
  const inventoryUrl = extensionData?.inventory_url || mergedProfile?.inventory_url || "Not set";
  const scannerType = extensionData?.scanner_type || mergedProfile?.scanner_type || "Not set";
  const listingLocation = mergedProfile?.listing_location || "Not set";
  const complianceMode = mergedProfile?.compliance_mode || mergedProfile?.province || "Not set";
  const plan = extensionData?.plan || extensionData?.plan_name || "Founder Beta";

  setTextByIdForAll("extensionRemainingPosts", String(remaining));
  setTextByIdForAll("extensionScannerType", scannerType);
  setTextByIdForAll("extensionDealerWebsite", dealerWebsite);
  setTextByIdForAll("extensionInventoryUrl", inventoryUrl);
  setTextByIdForAll("extensionListingLocation", listingLocation);
  setTextByIdForAll("extensionComplianceMode", complianceMode);
  setTextByIdForAll("extensionPlan", plan);
  setTextByIdForAll("extensionPostsUsed", String(used));
  setTextByIdForAll("extensionPostLimit", String(limit));

  const accessText = !data
    ? "Unavailable"
    : !hasAccess
      ? "Inactive Access"
      : remaining <= 0
        ? "Limit Reached"
        : "Active Access";

  setTextByIdForAll("extensionAccessBadge", accessText);
  document.querySelectorAll("#extensionAccessBadge").forEach((el) => {
    el.classList.remove("active", "inactive", "warn");
    if (!data) el.classList.add("warn");
    else if (!hasAccess) el.classList.add("inactive");
    else if (remaining <= 0) el.classList.add("warn");
    else el.classList.add("active");
  });
}

function updateSetupStates(profile, accountData) {
  setSetupState("setupDealerWebsite", !!profile?.dealer_website);
  setSetupState("setupInventoryUrl", !!profile?.inventory_url);
  setSetupState("setupScannerType", !!profile?.scanner_type);
  setSetupState("setupListingLocation", !!profile?.listing_location);
  setSetupState("setupComplianceMode", !!(profile?.compliance_mode || profile?.province));
  setSetupState("setupAccess", !!accountData?.access);

  setSetupState("extSetupDealerWebsite", !!profile?.dealer_website);
  setSetupState("extSetupInventoryUrl", !!profile?.inventory_url);
  setSetupState("extSetupScannerType", !!profile?.scanner_type);
  setSetupState("extSetupListingLocation", !!profile?.listing_location);
  setSetupState("extSetupComplianceMode", !!(profile?.compliance_mode || profile?.province));
  setSetupState("extSetupAccess", !!accountData?.access);
}

function setSetupState(id, isGood) {
  const el = document.getElementById(id);
  if (!el) return;

  el.textContent = isGood ? "Ready" : "Needs Setup";
  el.classList.remove("good", "warn");
  el.classList.add(isGood ? "good" : "warn");
}

function buildSetupStepsText() {
  const profile = currentProfile || {};
  const account = currentAccountData || {};

  return [
    "Elevate Automation Setup",
    "",
    `Access: ${account?.access ? "Active" : "Inactive"}`,
    `Plan: ${account?.plan || account?.plan_name || "Founder Beta"}`,
    `Dealer Website: ${profile?.dealer_website || "Not set"}`,
    `Inventory URL: ${profile?.inventory_url || "Not set"}`,
    `Scanner Type: ${profile?.scanner_type || "Not set"}`,
    `Listing Location: ${profile?.listing_location || "Not set"}`,
    `Compliance Mode: ${profile?.compliance_mode || profile?.province || "Not set"}`,
    "",
    "Steps:",
    "1. Install or reload the Elevate Automation extension.",
    "2. Refresh extension access in the popup.",
    "3. Open your saved inventory URL.",
    "4. Run scan and queue a vehicle.",
    "5. Open Facebook Marketplace vehicle creation.",
    "6. Load next queued vehicle and run autofill."
  ].join("\n");
}

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

function normalizeUrlInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.showSection = showSection;
window.signOutUser = signOutUser;