// dashboard.js

const SUPABASE_URL = "https://teixblbxkoershwgqpym.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3RlaXhibGJ4a29lcnNod2dxcHltLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJhbm9uLWtleSIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjIwODg2NjEzMDMsImlhdCI6MTc3MzA4NTMwMywiaXNzIjoiaHR0cHM6Ly90ZWl4YmxieGtvZXJzaHdncXB5bS5zdXBhYmFzZS5jby9hdXRoL3YxIiwianRpIjoiOWRmNzE2NmEtZjcxMC00MzQ0LTkwOWEtZjIyM2ZkZjI5NzY2Iiwicm9sZSI6ImFub24ifQ.5kX1L0r3gSMX1mN1V7zI2XHevNdf2gZl5ZLMbYh2v0Y";

// Change this if your extension zip lives elsewhere.
const EXTENSION_DOWNLOAD_URL = "/downloads/elevate-automation-extension.zip";

let supabaseClient = null;
let currentUser = null;
let currentProfile = null;
let currentAccountData = null;
let currentNormalizedSession = null;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    setBootStatus("Loading dashboard...");

    if (!window.supabase || !window.supabase.createClient) {
      setBootStatus("Supabase library missing.");
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
    saveBtn.addEventListener("click", async (event) => {
      event.preventDefault();
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
      await loadAccountData(currentUser, true);
      await pushExtensionProfileSync();
    });
  }

  const refreshExtensionStateBtn = document.getElementById("refreshExtensionStateBtn");
  if (refreshExtensionStateBtn) {
    refreshExtensionStateBtn.addEventListener("click", async () => {
      if (!currentUser) return;
      await loadAccountData(currentUser, true);
      await pushExtensionProfileSync();
      setStatus("extensionActionStatus", "Extension state refreshed.");
    });
  }

  const downloadExtensionBtn = document.getElementById("downloadExtensionBtn");
  if (downloadExtensionBtn) {
    downloadExtensionBtn.addEventListener("click", () => {
      window.open(EXTENSION_DOWNLOAD_URL, "_blank");
      setStatus("extensionActionStatus", "Opening extension download...");
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
      const inventoryUrl =
        getFieldValue("inventory_url") ||
        currentProfile?.inventory_url ||
        currentNormalizedSession?.dealership?.inventory_url ||
        "";

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

  const openBillingPortalBtn = document.getElementById("openBillingPortalBtn");
  if (openBillingPortalBtn) {
    openBillingPortalBtn.addEventListener("click", async () => {
      try {
        if (!currentUser?.email) {
          setStatus("accountStatusBilling", "No logged-in user email found.");
          return;
        }

        setStatus("accountStatusBilling", "Opening billing portal...");

        const response = await fetch("/api/create-billing-portal-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: currentUser.email
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not open billing portal.");
        }

        if (!data.url) {
          throw new Error("Billing portal URL missing.");
        }

        window.location.href = data.url;
      } catch (error) {
        console.error("Billing portal error:", error);
        setStatus("accountStatusBilling", error.message || "Could not open billing portal.");
      }
    });
  }

  const refreshBillingBtn = document.getElementById("refreshBillingBtn");
  if (refreshBillingBtn) {
    refreshBillingBtn.addEventListener("click", async () => {
      try {
        if (!currentUser) return;
        setStatus("accountStatusBilling", "Refreshing billing data...");
        await loadAccountData(currentUser, true);
        setStatus("accountStatusBilling", "Billing data refreshed.");
      } catch (error) {
        console.error("refreshBillingBtn error:", error);
        setStatus("accountStatusBilling", "Could not refresh billing data.");
      }
    });
  }
}

async function onSaveProfilePressed() {
  try {
    setStatus("profileStatus", "Saving profile...");

    if (!currentUser) {
      setStatus("profileStatus", "No authenticated user found.");
      return;
    }

    await submitProfileSave(currentUser);

    if (currentUser) {
      await loadAccountData(currentUser, true);
    }

    await pushExtensionProfileSync();
  } catch (error) {
    console.error("onSaveProfilePressed error:", error);
    setStatus("profileStatus", `Save failed: ${error.message || "Unknown error"}`);
  }
}

async function pushExtensionProfileSync() {
  try {
    if (!currentUser) return;

    const normalized = currentNormalizedSession || buildFallbackSessionFromLocalState();

    window.postMessage({
      type: "ELEVATE_PROFILE_SYNC",
      payload: normalized
    }, "*");

    setStatus("extensionActionStatus", "Dealer profile sync pushed to extension.");
  } catch (error) {
    console.error("pushExtensionProfileSync error:", error);
    setStatus("extensionActionStatus", "Failed to push profile sync.");
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
  if (pageTitle) pageTitle.textContent = titleMap[sectionId] || "Dashboard";
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
      method: "GET",
      cache: "no-store"
    });

    const result = await response.json();

    if (!response.ok || !result.data) {
      currentProfile = null;
      renderProfileSummary(null);
      updateSetupStates(null, currentNormalizedSession);
      populateComplianceSummary(null);
      setStatus("profileStatus", "No profile loaded yet.");
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
    populateComplianceSummary(result.data);
    updateSetupStates(currentProfile, currentNormalizedSession);
    setStatus("profileStatus", "Profile loaded.");
  } catch (error) {
    console.error("loadProfile error:", error);
    setStatus("profileStatus", "Failed to load profile.");
  }
}

async function submitProfileSave(user) {
  try {
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
      setStatus("profileStatus", `Save failed: ${result.error || result.message || "Unknown error"}`);
      return;
    }

    currentProfile = result.data || payload;

    if (currentProfile?.software_license_key) {
      setFieldValue("software_license_key", currentProfile.software_license_key);
    }

    renderProfileSummary(currentProfile);
    populateComplianceSummary(currentProfile);
    updateSetupStates(currentProfile, currentNormalizedSession);
    setStatus("profileStatus", "Profile saved successfully.");
  } catch (error) {
    console.error("submitProfileSave error:", error);
    setStatus("profileStatus", `Failed to save profile: ${error.message || "Unknown error"}`);
  }
}

function renderProfileSummary(profile) {
  const summaryEl = document.getElementById("profileSummary");
  if (!summaryEl) return;

  const merged = {
    ...(profile || {}),
    software_license_key:
      profile?.software_license_key ||
      currentNormalizedSession?.subscription?.license_key ||
      ""
  };

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
      <div><strong>Software License Key:</strong> Auto-assignment pending</div>
    `;
    return;
  }

  summaryEl.innerHTML = `
    <div><strong>Name:</strong> ${escapeHtml(merged.full_name || "Not set")}</div>
    <div><strong>Dealership:</strong> ${escapeHtml(merged.dealership || "Not set")}</div>
    <div><strong>City:</strong> ${escapeHtml(merged.city || "Not set")}</div>
    <div><strong>Province:</strong> ${escapeHtml(merged.province || "Not set")}</div>
    <div><strong>Phone:</strong> ${escapeHtml(merged.phone || "Not set")}</div>
    <div><strong>Compliance License Number:</strong> ${escapeHtml(merged.license_number || "Not set")}</div>
    <div><strong>Default Listing Location:</strong> ${escapeHtml(merged.listing_location || "Not set")}</div>
    <div><strong>Dealer Phone:</strong> ${escapeHtml(merged.dealer_phone || "Not set")}</div>
    <div><strong>Dealer Email:</strong> ${escapeHtml(merged.dealer_email || "Not set")}</div>
    <div><strong>Compliance Mode:</strong> ${escapeHtml(merged.compliance_mode || merged.province || "Not set")}</div>
    <div><strong>Dealer Website:</strong> ${escapeHtml(merged.dealer_website || "Not set")}</div>
    <div><strong>Inventory URL:</strong> ${escapeHtml(merged.inventory_url || "Not set")}</div>
    <div><strong>Scanner Type:</strong> ${escapeHtml(merged.scanner_type || "Not set")}</div>
    <div><strong>Software License Key:</strong> ${escapeHtml(merged.software_license_key || "Auto-assignment pending")}</div>
  `;
}

function populateComplianceSummary(profile) {
  setTextByIdForAll("complianceProvinceDisplay", profile?.province || "Not set");
  setTextByIdForAll("complianceModeDisplay", profile?.compliance_mode || profile?.province || "Not set");
  setTextByIdForAll("complianceLicenseDisplay", profile?.license_number || "Not set");

  const contactBits = [
    profile?.dealer_phone || null,
    profile?.dealer_email || null
  ].filter(Boolean);

  setTextByIdForAll("complianceDealerContactDisplay", contactBits.length ? contactBits.join(" • ") : "Not set");
}

async function loadAccountData(user, forceFresh = false) {
  try {
    setStatus("accountStatus", "Loading account data...");
    setStatus("accountStatusBilling", "Loading account data...");
    setStatus("extensionActionStatus", "Loading extension state...");

    const url = new URL("/api/extension-state", window.location.origin);
    url.searchParams.set("email", user.email || "");
    if (window.location.hostname) {
      url.searchParams.set("hostname", window.location.hostname);
    }
    if (forceFresh) {
      url.searchParams.set("_ts", String(Date.now()));
    }

    const response = await fetch(url.toString(), {
      cache: "no-store"
    });

    const result = await response.json();

    if (!response.ok || !result) {
      currentAccountData = null;
      currentNormalizedSession = null;
      renderAccessState(null);
      renderExtensionControl(null, currentProfile);
      updateSetupStates(currentProfile, null);
      setStatus("accountStatus", "Could not load account data.");
      setStatus("accountStatusBilling", "Could not load account data.");
      setStatus("extensionActionStatus", "Could not load extension state.");
      return;
    }

    currentAccountData = result || null;
    currentNormalizedSession = normalizeExtensionStateResponse(result, currentUser, currentProfile);

    renderAccessState(currentNormalizedSession);
    renderExtensionControl(currentNormalizedSession, currentProfile);
    updateSetupStates(currentProfile, currentNormalizedSession);

    setStatus("accountStatus", "Account data loaded.");
    setStatus("accountStatusBilling", "Account data loaded.");
    setStatus("extensionActionStatus", "Extension state loaded.");

    const licenseKey = currentNormalizedSession?.subscription?.license_key || "Auto-assignment pending";
    setTextByIdForAll("licenseKeyDisplay", licenseKey);
    setTextByIdForAll("licenseKeyDisplayBilling", licenseKey);

    const referral =
      result?.referral_code ||
      result?.session?.referral_code ||
      "Not assigned yet";
    setTextByIdForAll("referralCode", referral);
    setTextByIdForAll("referralCodeAffiliate", referral);

    setTextByIdForAll("planNameBilling", currentNormalizedSession?.subscription?.plan || "Founder Beta");
    setTextByIdForAll(
      "subscriptionStatusBilling",
      currentNormalizedSession?.subscription?.status || "inactive"
    );

    const access = Boolean(currentNormalizedSession?.subscription?.active);
    setTextByIdForAll("accessBadgeBilling", access ? "Active Access" : "Inactive Access");
    document.querySelectorAll("#accessBadgeBilling").forEach((el) => {
      el.classList.remove("active", "inactive", "warn");
      el.classList.add(access ? "active" : "inactive");
    });

    const softwareLicenseInput = document.getElementById("software_license_key");
    if (softwareLicenseInput) {
      softwareLicenseInput.value = currentNormalizedSession?.subscription?.license_key || "";
      softwareLicenseInput.placeholder = currentNormalizedSession?.subscription?.license_key
        ? ""
        : "Auto-assignment pending";
    }

    if (currentProfile) {
      currentProfile.software_license_key = currentNormalizedSession?.subscription?.license_key || "";
      renderProfileSummary(currentProfile);
    }
  } catch (error) {
    console.error("loadAccountData error:", error);
    currentAccountData = null;
    currentNormalizedSession = null;
    renderAccessState(null);
    renderExtensionControl(null, currentProfile);
    updateSetupStates(currentProfile, null);
    setStatus("accountStatus", "Failed to load account data.");
    setStatus("accountStatusBilling", "Failed to load account data.");
    setStatus("extensionActionStatus", "Failed to load extension state.");
  }
}

function normalizeExtensionStateResponse(result, user, profile) {
  const raw = result?.session ? result.session : result;

  const subscription = raw?.subscription || {};
  const dealership = raw?.dealership || {};
  const scannerConfig = raw?.scanner_config || {};
  const profileData = raw?.profile || {};

  const normalizedSubscription = {
    active: Boolean(
      subscription.active ||
      subscription.status === "active" ||
      subscription.status === "trialing"
    ),
    status: clean(subscription.status || (subscription.active ? "active" : "inactive")) || "inactive",
    plan: clean(subscription.plan || subscription.plan_name || "Founder Beta") || "Founder Beta",
    license_key: clean(subscription.license_key || subscription.software_license_key || ""),
    posting_limit: Number(subscription.posting_limit || subscription.daily_post_limit || 0),
    posts_today: Number(subscription.posts_today || 0),
    posts_remaining: Number(
      subscription.posts_remaining ??
      Math.max(Number(subscription.posting_limit || 0) - Number(subscription.posts_today || 0), 0)
    )
  };

  return {
    user: {
      id: user?.id || raw?.user?.id || "",
      email: user?.email || raw?.user?.email || ""
    },
    subscription: normalizedSubscription,
    dealership: {
      website: clean(dealership.website || profile?.dealer_website || ""),
      inventory_url: clean(dealership.inventory_url || profile?.inventory_url || ""),
      province: clean(dealership.province || profile?.province || ""),
      scanner_type: clean(dealership.scanner_type || "")
    },
    scanner_config: {
      scanner_type: clean(scannerConfig.scanner_type || profile?.scanner_type || "")
    },
    profile: {
      listing_location: clean(profileData.listing_location || profile?.listing_location || ""),
      compliance_mode: clean(profileData.compliance_mode || profile?.compliance_mode || profile?.province || "")
    }
  };
}

function buildFallbackSessionFromLocalState() {
  return {
    subscription: {
      active: false,
      status: "inactive",
      plan: "Founder Beta",
      license_key: currentProfile?.software_license_key || "",
      posting_limit: 0,
      posts_today: 0,
      posts_remaining: 0
    },
    dealership: {
      website: currentProfile?.dealer_website || "",
      inventory_url: currentProfile?.inventory_url || "",
      province: currentProfile?.province || "",
      scanner_type: currentProfile?.scanner_type || ""
    },
    scanner_config: {
      scanner_type: currentProfile?.scanner_type || ""
    },
    profile: {
      listing_location: currentProfile?.listing_location || "",
      compliance_mode: currentProfile?.compliance_mode || currentProfile?.province || ""
    }
  };
}

function renderAccessState(session) {
  const hasAccess = Boolean(session?.subscription?.active);
  const plan = session?.subscription?.plan || "Founder Beta";
  const status = session?.subscription?.status || (hasAccess ? "active" : "inactive");

  setTextByIdForAll("accessBadge", hasAccess ? "Active Access" : "Inactive Access");
  setTextByIdForAll("planName", plan);
  setTextByIdForAll("subscriptionStatus", status);

  document.querySelectorAll("#accessBadge").forEach((el) => {
    el.classList.remove("active", "inactive", "warn");
    el.classList.add(hasAccess ? "active" : "inactive");
  });
}

function renderExtensionControl(session, profile) {
  const mergedProfile = profile || {};
  const hasAccess = Boolean(session?.subscription?.active);
  const limit = Number(session?.subscription?.posting_limit || 0);
  const used = Number(session?.subscription?.posts_today || 0);
  const remaining = Number(session?.subscription?.posts_remaining ?? Math.max(limit - used, 0));

  const dealerWebsite =
    session?.dealership?.website ||
    mergedProfile?.dealer_website ||
    "Not set";

  const inventoryUrl =
    session?.dealership?.inventory_url ||
    mergedProfile?.inventory_url ||
    "Not set";

  const scannerType =
    session?.scanner_config?.scanner_type ||
    session?.dealership?.scanner_type ||
    mergedProfile?.scanner_type ||
    "Not set";

  const listingLocation =
    session?.profile?.listing_location ||
    mergedProfile?.listing_location ||
    "Not set";

  const complianceMode =
    session?.profile?.compliance_mode ||
    mergedProfile?.compliance_mode ||
    mergedProfile?.province ||
    session?.dealership?.province ||
    "Not set";

  const plan = session?.subscription?.plan || "Founder Beta";

  setTextByIdForAll("extensionRemainingPosts", String(remaining));
  setTextByIdForAll("extensionScannerType", scannerType);
  setTextByIdForAll("extensionDealerWebsite", dealerWebsite);
  setTextByIdForAll("extensionInventoryUrl", inventoryUrl);
  setTextByIdForAll("extensionListingLocation", listingLocation);
  setTextByIdForAll("extensionComplianceMode", complianceMode);
  setTextByIdForAll("extensionPlan", plan);
  setTextByIdForAll("extensionPostsUsed", String(used));
  setTextByIdForAll("extensionPostLimit", String(limit));

  const accessText = !session
    ? "Unavailable"
    : !hasAccess
      ? "Inactive Access"
      : remaining <= 0
        ? "Limit Reached"
        : "Active Access";

  setTextByIdForAll("extensionAccessState", accessText);
}

function updateSetupStates(profile, session) {
  const websiteReady = Boolean(profile?.dealer_website || session?.dealership?.website);
  const inventoryReady = Boolean(profile?.inventory_url || session?.dealership?.inventory_url);
  const scannerReady = Boolean(profile?.scanner_type || session?.scanner_config?.scanner_type || session?.dealership?.scanner_type);
  const listingReady = Boolean(profile?.listing_location || session?.profile?.listing_location);
  const complianceReady = Boolean(profile?.compliance_mode || profile?.province || session?.profile?.compliance_mode || session?.dealership?.province);
  const accessReady = Boolean(session?.subscription?.active);

  setSetupState("setupDealerWebsite", websiteReady);
  setSetupState("setupInventoryUrl", inventoryReady);
  setSetupState("setupScannerType", scannerReady);
  setSetupState("setupListingLocation", listingReady);
  setSetupState("setupComplianceMode", complianceReady);
  setSetupState("setupAccess", accessReady);

  setSetupState("extSetupDealerWebsite", websiteReady);
  setSetupState("extSetupInventoryUrl", inventoryReady);
  setSetupState("extSetupScannerType", scannerReady);
  setSetupState("extSetupListingLocation", listingReady);
  setSetupState("extSetupComplianceMode", complianceReady);
  setSetupState("extSetupAccess", accessReady);
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
  const session = currentNormalizedSession || buildFallbackSessionFromLocalState();
  const active = Boolean(session?.subscription?.active);

  return [
    "Elevate Automation Setup",
    "",
    `Access: ${active ? "Active" : "Inactive"}`,
    `Plan: ${session?.subscription?.plan || "Founder Beta"}`,
    `Dealer Website: ${profile?.dealer_website || session?.dealership?.website || "Not set"}`,
    `Inventory URL: ${profile?.inventory_url || session?.dealership?.inventory_url || "Not set"}`,
    `Scanner Type: ${profile?.scanner_type || session?.scanner_config?.scanner_type || session?.dealership?.scanner_type || "Not set"}`,
    `Listing Location: ${profile?.listing_location || session?.profile?.listing_location || "Not set"}`,
    `Compliance Mode: ${profile?.compliance_mode || profile?.province || session?.profile?.compliance_mode || session?.dealership?.province || "Not set"}`,
    "",
    "Steps:",
    "1. Install or reload the Elevate Automation extension.",
    "2. Refresh extension access in the dashboard.",
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

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
