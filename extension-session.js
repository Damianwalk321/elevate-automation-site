// extension-session.js
// Full extension bridge for Elevate Automation beta

const ELEVATE_API_BASE = "https://elevate-automation-site.vercel.app";

const ELEVATE_STORAGE_KEYS = {
  sessionEmail: "elevate_session_email",
  sessionUserId: "elevate_session_user_id",
  cachedState: "elevate_cached_state",
  lastSyncAt: "elevate_last_sync_at"
};

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result || {}));
  });
}

function storageSet(payload) {
  return new Promise((resolve) => {
    chrome.storage.local.set(payload, () => resolve(true));
  });
}

function storageRemove(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => resolve(true));
  });
}

async function saveExtensionSession({ email, user_id }) {
  const payload = {};

  if (email) payload[ELEVATE_STORAGE_KEYS.sessionEmail] = String(email).trim().toLowerCase();
  if (user_id) payload[ELEVATE_STORAGE_KEYS.sessionUserId] = String(user_id).trim();

  await storageSet(payload);
  return true;
}

async function clearExtensionSession() {
  await storageRemove([
    ELEVATE_STORAGE_KEYS.sessionEmail,
    ELEVATE_STORAGE_KEYS.sessionUserId,
    ELEVATE_STORAGE_KEYS.cachedState,
    ELEVATE_STORAGE_KEYS.lastSyncAt
  ]);

  return true;
}

async function getSavedExtensionSession() {
  const result = await storageGet([
    ELEVATE_STORAGE_KEYS.sessionEmail,
    ELEVATE_STORAGE_KEYS.sessionUserId
  ]);

  return {
    email: result[ELEVATE_STORAGE_KEYS.sessionEmail] || null,
    user_id: result[ELEVATE_STORAGE_KEYS.sessionUserId] || null
  };
}

async function getCachedExtensionState() {
  const result = await storageGet([
    ELEVATE_STORAGE_KEYS.cachedState,
    ELEVATE_STORAGE_KEYS.lastSyncAt
  ]);

  return {
    state: result[ELEVATE_STORAGE_KEYS.cachedState] || null,
    lastSyncAt: result[ELEVATE_STORAGE_KEYS.lastSyncAt] || null
  };
}

async function cacheExtensionState(state) {
  await storageSet({
    [ELEVATE_STORAGE_KEYS.cachedState]: state,
    [ELEVATE_STORAGE_KEYS.lastSyncAt]: new Date().toISOString()
  });

  return true;
}

async function fetchExtensionState() {
  const session = await getSavedExtensionSession();

  if (!session.email && !session.user_id) {
    return {
      success: false,
      error: "No saved extension session"
    };
  }

  const params = new URLSearchParams();

  if (session.email) params.set("email", session.email);
  if (session.user_id) params.set("user_id", session.user_id);

  const response = await fetch(`${ELEVATE_API_BASE}/api/extension-state?${params.toString()}`, {
    method: "GET"
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: result?.error || "Failed to fetch extension state"
    };
  }

  await cacheExtensionState(result);

  if (result?.email || result?.user_id) {
    await saveExtensionSession({
      email: result.email || session.email,
      user_id: result.user_id || session.user_id
    });
  }

  return {
    success: true,
    data: result
  };
}

async function refreshExtensionState() {
  return fetchExtensionState();
}

async function getExtensionState() {
  const fresh = await fetchExtensionState();

  if (fresh.success) return fresh;

  const cached = await getCachedExtensionState();

  if (cached.state) {
    return {
      success: true,
      data: cached.state,
      cached: true
    };
  }

  return fresh;
}

function buildComplianceBlock(profile) {
  const safeProfile = profile || {};
  const complianceMode = String(
    safeProfile.compliance_mode || safeProfile.province || ""
  ).toUpperCase();

  if (complianceMode.includes("AB") || complianceMode.includes("ALBERTA")) {
    return [
      safeProfile.dealership ? `${safeProfile.dealership}` : "",
      safeProfile.listing_location ? `${safeProfile.listing_location}` : "",
      safeProfile.full_name ? `Sales: ${safeProfile.full_name}` : "",
      safeProfile.phone ? `Phone: ${safeProfile.phone}` : "",
      safeProfile.dealer_phone ? `Dealer Phone: ${safeProfile.dealer_phone}` : "",
      safeProfile.dealer_email ? `Email: ${safeProfile.dealer_email}` : "",
      safeProfile.license_number ? `License: ${safeProfile.license_number}` : "",
      "AMVIC Licensed Business"
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (complianceMode.includes("BC")) {
    return [
      safeProfile.dealership ? `${safeProfile.dealership}` : "",
      safeProfile.listing_location ? `${safeProfile.listing_location}` : "",
      safeProfile.full_name ? `Sales: ${safeProfile.full_name}` : "",
      safeProfile.phone ? `Phone: ${safeProfile.phone}` : "",
      safeProfile.dealer_phone ? `Dealer Phone: ${safeProfile.dealer_phone}` : "",
      safeProfile.dealer_email ? `Email: ${safeProfile.dealer_email}` : "",
      safeProfile.license_number ? `License: ${safeProfile.license_number}` : ""
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    safeProfile.dealership ? `${safeProfile.dealership}` : "",
    safeProfile.listing_location ? `${safeProfile.listing_location}` : "",
    safeProfile.full_name ? `Sales: ${safeProfile.full_name}` : "",
    safeProfile.phone ? `Phone: ${safeProfile.phone}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function buildCaptionFooter(profile) {
  const safeProfile = profile || {};

  return [
    safeProfile.dealership ? `📍 ${safeProfile.dealership}` : "",
    safeProfile.listing_location ? `🏷 ${safeProfile.listing_location}` : "",
    safeProfile.full_name ? `👤 ${safeProfile.full_name}` : "",
    safeProfile.phone ? `📞 ${safeProfile.phone}` : "",
    safeProfile.dealer_email ? `✉️ ${safeProfile.dealer_email}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function mergeCaptionWithProfile(baseCaption, profile) {
  const top = String(baseCaption || "").trim();
  const footer = buildCaptionFooter(profile);
  const compliance = buildComplianceBlock(profile);

  return [top, footer, compliance].filter(Boolean).join("\n\n").trim();
}

async function canUserPostNow() {
  const stateResponse = await getExtensionState();

  if (!stateResponse.success) {
    return {
      allowed: false,
      reason: stateResponse.error || "Failed to load extension state"
    };
  }

  const state = stateResponse.data;

  if (!state.access) {
    return {
      allowed: false,
      reason: "inactive_access",
      state
    };
  }

  const remaining = Number(state?.limits?.posts_remaining_today);

  if (!Number.isNaN(remaining) && remaining <= 0) {
    return {
      allowed: false,
      reason: "posting_limit_reached",
      state
    };
  }

  return {
    allowed: true,
    reason: "ok",
    state
  };
}

async function registerSuccessfulPost({ vehicle_id = "", platform = "marketplace" } = {}) {
  const session = await getSavedExtensionSession();

  if (!session.email || !session.user_id) {
    return {
      success: false,
      error: "Missing session for register post"
    };
  }

  const response = await fetch(`${ELEVATE_API_BASE}/api/register-post`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: session.email,
      user_id: session.user_id,
      vehicle_id,
      platform
    })
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: result?.error || "Failed to register post",
      data: result || null
    };
  }

  await refreshExtensionState();

  return {
    success: true,
    data: result
  };
}

window.ElevateExtensionSession = {
  saveExtensionSession,
  clearExtensionSession,
  getSavedExtensionSession,
  getCachedExtensionState,
  fetchExtensionState,
  refreshExtensionState,
  getExtensionState,
  buildComplianceBlock,
  buildCaptionFooter,
  mergeCaptionWithProfile,
  canUserPostNow,
  registerSuccessfulPost
};