
const EXTENSION_DOWNLOAD_URL = "/downloads/elevate-automation-extension.zip";
const EXTENSION_FALLBACK_URL = "https://github.com/Damianwalk321/elevate-automation-vehicle-poster/archive/refs/heads/Dev.zip";

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}



function getPlanAccessSnapshot() {
  const summary = dashboardSummary || {};
  const snapshot = summary.plan_access || {};
  const sessionPlan = currentNormalizedSession?.subscription?.plan_access || {};
  const planLabel = cleanText(snapshot.plan_label || sessionPlan.plan_label || summary.account_snapshot?.plan || currentNormalizedSession?.subscription?.plan || 'Founder Beta') || 'Founder Beta';
  const normalized = planLabel.toLowerCase();
  const isPro = typeof snapshot.is_pro === 'boolean' ? snapshot.is_pro : (typeof sessionPlan.is_pro === 'boolean' ? sessionPlan.is_pro : normalized.includes('pro'));
  return {
    plan_label: planLabel,
    is_pro: isPro,
    posting_limit: numberOrZero(snapshot.posting_limit || sessionPlan.posting_limit || summary.account_snapshot?.posting_limit),
    upgrade_target: cleanText(snapshot.upgrade_target || (isPro ? 'Pro' : (normalized.includes('founder') ? 'Founder Pro' : 'Pro')))
  };
}

function openPremiumPreviewModal(context = 'overview') {
  const preview = dashboardSummary?.premium_preview || {};
  const prompts = Array.isArray(dashboardSummary?.upgrade_prompts) ? dashboardSummary.upgrade_prompts : [];
  const matching = prompts.filter((item) => !context || item.placement === context);
  const promptCopy = matching.length
    ? matching.map((item) => `• ${cleanText(item.title)} — ${cleanText(item.copy)}`).join('\n\n')
    : 'Upgrade prompts will appear here as usage and traction build.';
  const bullets = Array.isArray(preview.bullets) ? preview.bullets : [];
  const body = [cleanText(preview.subheadline), bullets.length ? bullets.map((item) => `• ${item}`).join('\n') : '', '', promptCopy].filter(Boolean).join('\n\n');
  openReadCopyModal({
    title: cleanText(preview.headline || 'Premium Preview'),
    subtitle: 'Read the upgrade path inside the dashboard first. Copy only if you want to reuse the positioning elsewhere.',
    eyebrow: 'Monetization Layer',
    body
  });
}

function renderMonetizationPanels() {
  const summary = dashboardSummary || {};
  const planAccess = getPlanAccessSnapshot();
  const prompts = Array.isArray(summary.upgrade_prompts) ? summary.upgrade_prompts : [];
  const reasons = Array.isArray(summary.upgrade_reasons) ? summary.upgrade_reasons : [];
  const lockedModules = Array.isArray(summary.locked_modules) ? summary.locked_modules : [];
  const premiumPreview = summary.premium_preview || {};

  const renderPromptBlock = (placement) => {
    const matched = prompts.filter((item) => item.placement === placement);
    if (!matched.length) {
      return `<div><strong>${escapeHtml(planAccess.plan_label)}</strong> ${planAccess.is_pro ? 'is already active.' : 'currently includes the core dashboard and posting stack.'}</div>`;
    }
    return matched.map((item) => `
      <div>
        <div class="mini">${escapeHtml(item.title || 'Upgrade Trigger')}</div>
        <div>${escapeHtml(item.copy || '')}</div>
      </div>
    `).join('');
  };

  const overviewPanel = document.getElementById('overviewUpgradePanel');
  if (overviewPanel) {
    overviewPanel.innerHTML = `${renderPromptBlock('overview')}
      <div class="upgrade-reason-list">${reasons.slice(0, 2).map((item) => `<div>• ${escapeHtml(cleanText(item))}</div>`).join('') || '<div>• Keep using the core workflow until the next upgrade trigger appears.</div>'}</div>`;
  }

  const analyticsPanel = document.getElementById('analyticsUpgradePanel');
  if (analyticsPanel) {
    analyticsPanel.innerHTML = `${renderPromptBlock('analytics')}
      <div><strong>${escapeHtml(cleanText(premiumPreview.headline || 'Premium Preview'))}</strong></div>
      <div>${Array.isArray(premiumPreview.bullets) ? premiumPreview.bullets.map((item) => `• ${escapeHtml(cleanText(item))}`).join('<br/>') : ''}</div>`;
  }

  const toolsPanel = document.getElementById('toolsUpgradePanel');
  if (toolsPanel) {
    const locked = lockedModules.filter((item) => !item.unlocked).slice(0, 4);
    toolsPanel.innerHTML = `${renderPromptBlock('tools')}
      <div class="upgrade-reason-list">${locked.length ? locked.map((item) => `<div>• <strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(cleanText(item.teaser || item.reason || 'Premium module'))}</div>`).join('') : '<div>• Premium tools are already active on this plan.</div>'}</div>`;
  }

  const bindButton = (id, placement) => {
    const btn = document.getElementById(id);
    if (!btn || btn.dataset.boundUpgrade === 'true') return;
    btn.dataset.boundUpgrade = 'true';
    btn.addEventListener('click', () => openPremiumPreviewModal(placement));
  };
  bindButton('overviewUpgradeBtn', 'overview');
  bindButton('analyticsUpgradeBtn', 'analytics');
  bindButton('toolsUpgradeBtn', 'tools');

  document.querySelectorAll('.tool-tile').forEach((tile) => {
    const requiredPlan = cleanText(tile.getAttribute('data-required-plan') || '').toLowerCase();
    const isLocked = requiredPlan === 'pro' && !planAccess.is_pro;
    tile.classList.toggle('is-locked-plan', isLocked);
    const statusEl = tile.querySelector('.tool-status');
    if (statusEl && requiredPlan === 'pro') {
      statusEl.className = `tool-status ${planAccess.is_pro ? 'live' : 'pro'}`;
      statusEl.textContent = planAccess.is_pro ? 'Live Now' : 'Pro';
    }
    if (isLocked) {
      tile.setAttribute('title', `${tile.querySelector('h3')?.textContent || 'Module'} unlocks with ${planAccess.upgrade_target}.`);
    }
  });
}

function getActionLabel(actionType) {
  switch (clean(actionType).toLowerCase()) {
    case "promote_now": return "Promote";
    case "relisted": return "Repost";
    case "needs_price_review": return "Review Price";
    case "approved": return "Mark Reviewed";
    case "dismissed": return "Dismiss";
    default: return "Act Now";
  }
}
function getActionPayload(actionType) {
  switch (clean(actionType).toLowerCase()) {
    case "promote_now": return "promote_now";
    case "relisted": return "relisted";
    case "needs_price_review": return "needs_price_review";
    case "dismissed": return "dismissed";
    default: return "approved";
  }
}
function getSnoozedActionIds() {
  try { return JSON.parse(localStorage.getItem("elevate_action_center_snoozed") || "[]"); } catch { return []; }
}
function setSnoozedActionIds(ids) {
  try { localStorage.setItem("elevate_action_center_snoozed", JSON.stringify(ids)); } catch {}
}
function snoozeActionItem(listingId) {
  const ids = new Set(getSnoozedActionIds());
  ids.add(String(listingId || ""));
  setSnoozedActionIds(Array.from(ids));
  renderPrioritiesPanels();
}
async function executeActionCenterItem(item) {
  if (!item?.id) return;
  try {
    await markListingAction(item.id, getActionPayload(item.action_type || item.status || item.lifecycle_status));
    await refreshDashboardState(true);
  } catch (error) {
    console.warn("execute action center item warning", error);
  }
}
function renderActionCenterList(targetId, items, emptyText) {
  const wrap = document.getElementById(targetId);
  if (!wrap) return;
  const snoozed = new Set(getSnoozedActionIds());
  const visible = (Array.isArray(items) ? items : []).filter((item) => !snoozed.has(String(item.id || "")));
  if (!visible.length) {
    wrap.innerHTML = `<div class="listing-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }
  wrap.innerHTML = `<div class="action-center-list">${visible.map((item) => `
    <div class="action-center-item">
      <div class="action-center-item-head">
        <div>
          <div class="action-center-item-title">${escapeHtml(item.title || "Listing")}</div>
          <div class="action-center-item-meta">${escapeHtml(item.subtitle || "")}</div>
        </div>
        <div class="badge ${item.priority === "opportunity" ? "active" : "warn"}">${escapeHtml(item.priority === "opportunity" ? "Opportunity" : "Needs Action")}</div>
      </div>
      <div class="action-center-item-copy">${escapeHtml(item.reason || item.recommended_action || "Review this listing.")}</div>
      <div class="action-center-item-actions">
        <button class="action-btn" type="button" onclick='executeActionCenterItemById("${escapeJs(String(item.id || ""))}", "${escapeJs(String(item.action_type || ""))}")'>${escapeHtml(getActionLabel(item.action_type))}</button>
        <button class="action-btn secondary" type="button" onclick='openListingDetail("${escapeJs(String(item.id || ""))}")'>Inspect</button>
        <button class="action-btn secondary" type="button" onclick='snoozeActionItem("${escapeJs(String(item.id || ""))}")'>Snooze</button>
      </div>
    </div>`).join("")}</div>`;
}

async function executeActionCenterItemById(listingId, actionType) {
  if (!listingId) return;
  try {
    await markListingAction(listingId, getActionPayload(actionType));
    await refreshDashboardState(true);
  } catch (error) {
    console.warn("execute action center item warning", error);
  }
}


let bootStages = [];

let supabaseClient = null;
let currentUser = null;
let currentProfile = null;
let currentAccountData = null;
let currentNormalizedSession = null;
let dashboardSummary = null;

function getSummaryProfileSnapshot() {
  return dashboardSummary?.profile_snapshot || dashboardSummary?.account_snapshot || {};
}

function readLocalProfileSnapshot() {
  const keys = [
    'ea_dashboard_profile_v1',
    'elevate_profile_snapshot',
    'ea_profile_snapshot',
    'ea_user_profile',
    'ea_account_profile'
  ];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (error) {
      console.warn('readLocalProfileSnapshot warning:', error);
    }
  }
  return {};
}

function readFormProfileSnapshot() {
  const ids = ['full_name','dealership','city','province','phone','license_number','listing_location','dealer_phone','dealer_email','compliance_mode','dealer_website','inventory_url','scanner_type','software_license_key'];
  const out = {};
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    out[id] = clean(el.value || '');
  });
  return out;
}

function getCanonicalProfileState(overrideProfile = null, overrideSession = null) {
  const summaryProfile = getSummaryProfileSnapshot();
  const storedProfile = readLocalProfileSnapshot();
  const formProfile = readFormProfileSnapshot();
  const session = overrideSession || currentNormalizedSession || {};
  const profile = overrideProfile || currentProfile || {};
  const sessionProfile = session?.profile || {};
  const dealership = session?.dealership || {};
  const merged = {
    ...summaryProfile,
    ...storedProfile,
    ...sessionProfile,
    ...profile,
    ...formProfile,
    full_name: clean(profile.full_name || sessionProfile.full_name || sessionProfile.salesperson_name || summaryProfile.full_name || summaryProfile.salesperson_name || currentUser?.user_metadata?.full_name || currentUser?.email || ''),
    dealership: clean(profile.dealership || profile.dealer_name || sessionProfile.dealership || sessionProfile.dealer_name || dealership.name || dealership.dealer_name || summaryProfile.dealership || summaryProfile.dealer_name || ''),
    city: clean(profile.city || sessionProfile.city || summaryProfile.city || ''),
    province: clean(profile.province || sessionProfile.province || dealership.province || summaryProfile.province || ''),
    phone: clean(profile.phone || sessionProfile.phone || summaryProfile.phone || ''),
    license_number: clean(profile.license_number || sessionProfile.license_number || summaryProfile.license_number || ''),
    listing_location: clean(profile.listing_location || sessionProfile.listing_location || summaryProfile.listing_location || profile.city || sessionProfile.city || summaryProfile.city || ''),
    dealer_phone: clean(profile.dealer_phone || sessionProfile.dealer_phone || dealership.phone || summaryProfile.dealer_phone || ''),
    dealer_email: clean(profile.dealer_email || sessionProfile.dealer_email || dealership.email || summaryProfile.dealer_email || ''),
    compliance_mode: clean(profile.compliance_mode || sessionProfile.compliance_mode || summaryProfile.compliance_mode || profile.province || sessionProfile.province || summaryProfile.province || ''),
    dealer_website: clean(profile.dealer_website || sessionProfile.dealer_website || dealership.website || summaryProfile.dealer_website || ''),
    inventory_url: clean(profile.inventory_url || sessionProfile.inventory_url || dealership.inventory_url || summaryProfile.inventory_url || ''),
    scanner_type: clean(profile.scanner_type || sessionProfile.scanner_type || session?.scanner_config?.scanner_type || dealership.scanner_type || summaryProfile.scanner_type || ''),
    software_license_key: clean(profile.software_license_key || session?.subscription?.license_key || summaryProfile.software_license_key || '')
  };
  merged.salesperson_name = merged.full_name;
  merged.dealer_name = merged.dealership;
  return merged;
}

function getCanonicalSubscriptionState(overrideSession = null) {
  const session = overrideSession || currentNormalizedSession || {};
  const subscription = session?.subscription || {};
  const snapshot = dashboardSummary?.account_snapshot || {};
  const planAccess = dashboardSummary?.plan_access || {};
  const email = clean(currentUser?.email || session?.user?.email || snapshot?.email || '').toLowerCase();
  const forceTestingAccess = email === 'damian044@icloud.com';
  const plan = clean(subscription.plan || subscription.normalized_plan || snapshot.plan || planAccess.plan_label || 'Founder Beta') || 'Founder Beta';
  const status = clean(subscription.normalized_status || subscription.status || snapshot.status || (snapshot.active ? 'active' : 'inactive')) || 'inactive';
  const baseLimit = Math.max(
    numberOrZero(subscription.posting_limit || subscription.daily_posting_limit),
    numberOrZero(snapshot.base_posting_limit),
    numberOrZero(snapshot.posting_limit),
    numberOrZero(planAccess.posting_limit)
  );
  const used = Math.max(
    numberOrZero(subscription.posts_today),
    numberOrZero(snapshot.posts_today ?? snapshot.posts_used_today),
    numberOrZero(dashboardSummary?.posts_today)
  );
  const remaining = Math.max(
    numberOrZero(subscription.posts_remaining),
    numberOrZero(snapshot.posts_remaining),
    Math.max(baseLimit - used, 0)
  );
  const active = Boolean(
    forceTestingAccess ||
    subscription.access_granted === true ||
    subscription.active === true ||
    snapshot.access_granted === true ||
    snapshot.active === true ||
    status.toLowerCase() === 'active'
  );
  return {
    ...snapshot,
    ...subscription,
    plan,
    normalized_plan: plan,
    status,
    normalized_status: status,
    active,
    access_granted: active,
    posting_limit: forceTestingAccess ? Math.max(25, baseLimit) : baseLimit,
    posts_today: used,
    posts_remaining: forceTestingAccess ? Math.max(0, Math.max(25, baseLimit) - used) : remaining,
    license_key: clean(subscription.license_key || snapshot.software_license_key || '')
  };
}

function rerenderCanonicalPanels() {
  const canonicalSession = currentNormalizedSession || buildFallbackSessionFromLocalState();
  const canonicalProfile = getCanonicalProfileState(currentProfile, canonicalSession);
  renderProfileSummary(canonicalProfile);
  populateComplianceSummary(canonicalProfile);
  renderAccessState(canonicalSession);
  renderExtensionControl(canonicalSession, canonicalProfile);
  updateSetupStates(canonicalProfile, canonicalSession);
  renderSetupWorkspace(canonicalProfile, canonicalSession);
  renderComplianceWorkspace(canonicalProfile, canonicalSession);
  renderToolsWorkspace(canonicalProfile, canonicalSession);
  persistProfileSnapshots(buildExtensionProfileSnapshot(canonicalSession, canonicalProfile, currentUser), canonicalSession);
}

let currentReadCopyText = "";
let selectedToolModule = null;
let currentListingDetail = null;

async function getAuthAccessToken() {
  try {
    if (supabaseClient?.auth?.getSession) {
      const { data } = await supabaseClient.auth.getSession();
      return data?.session?.access_token || "";
    }
  } catch (error) {
    console.warn("getAuthAccessToken warning:", error);
  }
  return "";
}

async function buildAuthHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders, "x-elevate-client": "dashboard" };
  const token = await getAuthAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function apiFetch(url, options = {}) {
  const headers = await buildAuthHeaders(options.headers || {});
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    setBootStatus("Session expired. Redirecting to login...");
    setTimeout(() => redirectToLogin(), 500);
  }
  return response;
}

function openReadCopyModal({ title = "Read in Dashboard", subtitle = "Read this in the dashboard first, then copy only if needed.", eyebrow = "Dashboard Script", body = "" } = {}) {
  const modal = document.getElementById("readCopyModal");
  if (!modal) return;
  currentReadCopyText = String(body || "");
  const titleEl = document.getElementById("readCopyModalTitle");
  const subtitleEl = document.getElementById("readCopyModalSubtitle");
  const eyebrowEl = document.getElementById("readCopyModalEyebrow");
  const bodyEl = document.getElementById("readCopyModalBody");
  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;
  if (eyebrowEl) eyebrowEl.textContent = eyebrow;
  if (bodyEl) bodyEl.textContent = currentReadCopyText;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}
function closeReadCopyModal() {
  const modal = document.getElementById("readCopyModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}


async function redeemCreditActionRequest(actionKey, quantity = 1) {
  const response = await apiFetch("/api/redeem-credit-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: actionKey, quantity })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(cleanText(data.error || "Unable to redeem credit action."));
  }
  return data;
}

function bindCreditActionButtons() {
  document.querySelectorAll("[data-credit-action]").forEach((button) => {
    if (button.dataset.boundCreditAction === "true") return;
    button.dataset.boundCreditAction = "true";
    button.addEventListener("click", async () => {
      const actionKey = cleanText(button.getAttribute("data-credit-action"));
      if (!actionKey) return;
      const original = button.textContent;
      try {
        button.disabled = true;
        button.textContent = "Applying...";
        const result = await redeemCreditActionRequest(actionKey, 1);
        const statusEl = document.getElementById("creditActionStatus");
        if (statusEl) statusEl.textContent = `${cleanText(result.action?.title || "Action applied")}: -${numberOrZero(result.amount_spent)} credits, +${numberOrZero(result.grants_posts)} post today.`;
        await refreshDashboardData?.();
      } catch (error) {
        const statusEl = document.getElementById("creditActionStatus");
        if (statusEl) statusEl.textContent = cleanText(error.message || "Unable to redeem credit action.");
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    });
  });
}

let dashboardListings = [];
let filteredListings = [];
let dashboardListingsMeta = { total: 0, source_counts: { user_listings: 0, listings: 0, merged: 0 }, used_summary_fallback: false, source: "api" };
let listingQuickFilter = "all";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    setBootStatus("Booting dashboard...");

    if (!window.supabase || !window.supabase.createClient) {
      setBootStatus("Supabase library missing.");
      return;
    }

    supabaseClient =
      window.supabaseClient ||
      window.supabase.createClient(
        window.__ELEVATE_SUPABASE_URL,
        window.__ELEVATE_SUPABASE_ANON_KEY
      );

    if (!supabaseClient) {
      setBootStatus("Supabase client unavailable.");
      return;
    }

    bindDashboardUI();

    pushBootStage("Session", "Checking login session...");
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

    pushBootStage("User", "Syncing account record...");
    await syncUserIfNeeded(currentUser);

    pushBootStage("Profile", "Loading saved dealer profile...");
    await loadProfile(currentUser.id);

    pushBootStage("Workspace", "Loading billing, extension state, metrics, and listings...");
    await refreshDashboardState(true);

    pushBootStage("Extension", "Pushing live profile sync to extension...");
    await pushExtensionProfileSync();

    showSection("overview");
    setBootStatus("Dashboard ready.");
  } catch (error) {
    console.error("Dashboard boot failed:", error);
    setBootStatus(`Dashboard failed to load: ${error.message || "Unknown error"}`);
  }
});

function bindDashboardUI() {
  document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionId = button.getAttribute("data-section");
      showSection(sectionId);
    });
  });


const closeReadCopyModalBtn = document.getElementById("closeReadCopyModalBtn");
if (closeReadCopyModalBtn) closeReadCopyModalBtn.addEventListener("click", closeReadCopyModal);
const readCopyModal = document.getElementById("readCopyModal");
if (readCopyModal) {
  readCopyModal.addEventListener("click", (event) => {
    if (event.target === readCopyModal) closeReadCopyModal();
  });
}
const copyReadCopyModalBtn = document.getElementById("copyReadCopyModalBtn");
if (copyReadCopyModalBtn) {
  copyReadCopyModalBtn.addEventListener("click", async () => {
    if (!currentReadCopyText) return;
    try {
      await navigator.clipboard.writeText(currentReadCopyText);
      setBootStatus("Text copied.");
    } catch (error) {
      console.error("read copy modal clipboard error:", error);
      setBootStatus("Could not copy text.");
    }
  });
}

const closeListingDetailModalBtn = document.getElementById('closeListingDetailModalBtn');
if (closeListingDetailModalBtn) closeListingDetailModalBtn.addEventListener('click', closeListingDetailModal);
const listingDetailModal = document.getElementById('listingDetailModal');
if (listingDetailModal) {
  listingDetailModal.addEventListener('click', (event) => {
    if (event.target === listingDetailModal) closeListingDetailModal();
  });
}
const toolModuleFilter = document.getElementById('toolModuleFilter');
if (toolModuleFilter) toolModuleFilter.addEventListener('change', applyToolModuleFilters);
const toolStateFilter = document.getElementById('toolStateFilter');
if (toolStateFilter) toolStateFilter.addEventListener('change', applyToolModuleFilters);
document.querySelectorAll('.tool-tile').forEach((tile) => {
  tile.addEventListener('click', () => {
    const requiredPlan = cleanText(tile.getAttribute('data-required-plan') || '').toLowerCase();
    if (requiredPlan === 'pro' && !getPlanAccessSnapshot().is_pro) {
      openPremiumPreviewModal('tools');
    }
    selectedToolModule = {
      title: cleanText(tile.querySelector('h3')?.textContent || 'Module'),
      description: cleanText(tile.querySelector('p')?.textContent || ''),
      group: cleanText(tile.getAttribute('data-module-group') || ''),
      state: cleanText(tile.getAttribute('data-module-state') || '')
    };
    renderToolModuleDetail();
  });
});

  const saveProfileBtn = document.getElementById("saveProfileBtn");
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      await onSaveProfilePressed();
    });
  }

  document.addEventListener('click', (event) => {
    const jumpBtn = event.target.closest('.setup-jump-btn');
    if (jumpBtn) {
      jumpToSetupField(jumpBtn.getAttribute('data-field-id') || '');
      return;
    }
    const toolsJump = event.target.closest('[data-open-section]');
    if (toolsJump) {
      const sectionId = toolsJump.getAttribute('data-open-section');
      const fieldId = toolsJump.getAttribute('data-focus-field') || '';
      if (sectionId) showSection(sectionId);
      if (fieldId) jumpToSetupField(fieldId);
    }
  });

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
      await refreshDashboardState(true);
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
    downloadExtensionBtn.addEventListener("click", async () => {
      const target = await resolveExtensionDownloadUrl();
      window.open(target, "_blank");
      setStatus(
        "extensionActionStatus",
        target === EXTENSION_DOWNLOAD_URL
          ? "Opening hosted extension download..."
          : "Hosted extension file missing. Opening GitHub fallback..."
      );
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
  copySetupStepsBtn.addEventListener("click", () => {
    openReadCopyModal({
      title: "Setup Steps",
      subtitle: "Read the setup flow here, then copy only if you need to send it elsewhere.",
      eyebrow: "Tools",
      body: buildSetupStepsText()
    });
    setStatus("extensionActionStatus", "Setup steps opened.");
  });
}
  const copyReferralCodeBtn = document.getElementById("copyReferralCodeBtn");
  if (copyReferralCodeBtn) {
    copyReferralCodeBtn.addEventListener("click", async () => {
      const referral = document.getElementById("referralCodeAffiliate")?.textContent?.trim() || "";
      if (!referral || referral === "Loading...") return;
      try {
        await navigator.clipboard.writeText(referral);
        setBootStatus("Referral code copied.");
      } catch (error) {
        console.error("copyReferralCodeBtn error:", error);
      }
    });
  }

  function getAffiliateCode() {
    return document.getElementById("referralCodeAffiliate")?.textContent?.trim() || "";
  }
  function getAffiliateLink() {
    const code = getAffiliateCode();
    return code && code !== "Loading..." ? `${window.location.origin}/signup.html?ref=${encodeURIComponent(code)}` : "";
  }
  async function copyAffiliateText(text, successMessage) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setBootStatus(successMessage);
    } catch (error) {
      console.error("affiliate copy error:", error);
    }
  }

  const copyReferralLinkBtn = document.getElementById("copyReferralLinkBtn");
  if (copyReferralLinkBtn) {
    copyReferralLinkBtn.addEventListener("click", async () => {
      await copyAffiliateText(getAffiliateLink(), "Referral link copied.");
    });
  }


const copyAffiliateDMBtn = document.getElementById("copyAffiliateDMBtn");
if (copyAffiliateDMBtn) {
  copyAffiliateDMBtn.addEventListener("click", () => {
    const code = getAffiliateCode() || "[YOUR CODE]";
    const dm = `I have early access to Elevate Automation. It helps salespeople post inventory faster, stay consistent, and track performance. If you want founder access, use my code ${code}.`;
    openReadCopyModal({ title: "Affiliate DM Script", subtitle: "Read the message first, then copy from the modal only if you need it.", eyebrow: "Affiliate Center", body: dm });
  });
}

const copyAffiliatePitchBtn = document.getElementById("copyAffiliatePitchBtn");
if (copyAffiliatePitchBtn) {
  copyAffiliatePitchBtn.addEventListener("click", () => {
    const code = getAffiliateCode() || "[YOUR CODE]";
    const pitch = `I’m a founding partner with Elevate Automation. It helps salespeople post inventory faster and manage listing performance more consistently. Use my code ${code} if you want founder access.`;
    openReadCopyModal({ title: "Affiliate Short Pitch", subtitle: "Read this in-dashboard first so the user does not need Notes just to understand it.", eyebrow: "Affiliate Center", body: pitch });
  });
}

const copyAffiliatePostBtn = document.getElementById("copyAffiliatePostBtn");
if (copyAffiliatePostBtn) {
  copyAffiliatePostBtn.addEventListener("click", () => {
    const link = getAffiliateLink() || "[YOUR LINK]";
    const post = `I’m a founding partner with Elevate Automation. If you post inventory consistently and want a faster way to build Marketplace presence, message me or use this link: ${link}`;
    openReadCopyModal({ title: "Affiliate Story / Post", subtitle: "Read this in-dashboard first, then copy only if you want to publish it elsewhere.", eyebrow: "Affiliate Center", body: post });
  });
}


  const openBillingPortalBtn = document.getElementById("openBillingPortalBtn");
  if (openBillingPortalBtn) {
    openBillingPortalBtn.addEventListener("click", async () => {
      try {
        if (!currentUser?.id) {
          setStatus("accountStatusBilling", "No logged-in user found.");
          return;
        }

        setStatus("accountStatusBilling", "Opening billing portal...");

        const response = await apiFetch("/api/create-billing-portal-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userId: currentUser.id,
            email: currentUser.email
          })
        });

        const rawText = await response.text();

        let data;
        try {
          data = JSON.parse(rawText);
        } catch (parseError) {
          console.error("[billing] Non-JSON response:", rawText);
          throw new Error("Server error (non-JSON response)");
        }

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
        await pushExtensionProfileSync();
        setStatus("accountStatusBilling", "Billing data refreshed.");
      } catch (error) {
        console.error("refreshBillingBtn error:", error);
        setStatus("accountStatusBilling", "Could not refresh billing data.");
      }
    });
  }

  const listingSortSelect = document.getElementById("listingSortSelect");
  if (listingSortSelect) {
    listingSortSelect.addEventListener("change", () => {
      applyListingFiltersAndRender();
    });
  }

  const listingSearchInput = document.getElementById("listingSearchInput");
  if (listingSearchInput) {
    listingSearchInput.addEventListener("input", () => {
      applyListingFiltersAndRender();
    });
  }

  const refreshListingsBtn = document.getElementById("refreshListingsBtn");
  if (refreshListingsBtn) {
    refreshListingsBtn.addEventListener("click", async () => {
      try {
        if (!currentUser) return;
        setStatus("listingGridStatus", "Refreshing listings...");
        await loadListingDashboardData(true);
        setStatus("listingGridStatus", "Listings refreshed.");
      } catch (error) {
        console.error("refreshListingsBtn error:", error);
        setStatus("listingGridStatus", "Could not refresh listings.");
      }
    });
  }

  window.addEventListener("resize", debounce(() => {
    drawActivityChart(buildChartSeries());
  }, 150));
}

async function onSaveProfilePressed() {
  try {
    setStatus("profileStatus", "Saving profile...");

    if (!currentUser) {
      setStatus("profileStatus", "No authenticated user found.");
      return;
    }

    await submitProfileSave(currentUser);
    await loadAccountData(currentUser, true);
    await pushExtensionProfileSync();
  } catch (error) {
    console.error("onSaveProfilePressed error:", error);
    setStatus("profileStatus", `Save failed: ${error.message || "Unknown error"}`);
  }
}

async function refreshDashboardState(forceFresh = false) {
  await loadAccountData(currentUser, forceFresh);
  await loadListingDashboardData(forceFresh);
}

async function loadListingDashboardData(forceFresh = false) {
  try {
    dashboardSummary = await fetchDashboardSummary(forceFresh);
    dashboardListings = await fetchUserListings(forceFresh);

    dashboardListings = Array.isArray(dashboardListings)
      ? dashboardListings.map(normalizeListingRecord).filter(Boolean)
      : [];

    if (!dashboardSummary) {
      dashboardSummary = buildDashboardSummaryFromListings(dashboardListings);
    } else {
      dashboardSummary = mergeSummaryWithListings(dashboardSummary, dashboardListings);
    }

    filteredListings = [...dashboardListings];
    rerenderCanonicalPanels();

    renderDashboardAnalytics();
    renderSetupSnapshot();
    applyListingFiltersAndRender();
  } catch (error) {
    console.error("loadListingDashboardData error:", error);
    dashboardListings = [];
    dashboardSummary = buildDashboardSummaryFromListings(dashboardListings);
    filteredListings = [];
    rerenderCanonicalPanels();
    renderDashboardAnalytics();
    renderSetupSnapshot();
    applyListingFiltersAndRender();
  }
}

async function fetchDashboardSummary(forceFresh = false) {
  try {
    if (!currentUser?.id) return null;

    const url = new URL("/api/get-dashboard-summary", window.location.origin);
    url.searchParams.set("userId", currentUser.id);
    if (currentUser.email) url.searchParams.set("email", currentUser.email);
    if (forceFresh) url.searchParams.set("_ts", String(Date.now()));

    const response = await apiFetch(url.toString(), {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) return null;

    const result = await response.json();
    return result?.data || result || null;
  } catch (error) {
    console.warn("fetchDashboardSummary fallback:", error);
    return null;
  }
}

async function fetchUserListings(forceFresh = false) {
  dashboardListingsMeta = {
    total: 0,
    source_counts: { user_listings: 0, listings: 0, merged: 0 },
    used_summary_fallback: false,
    source: "api"
  };

  try {
    const previewRows = Array.isArray(dashboardSummary?.recent_listings) ? dashboardSummary.recent_listings : [];

    if (!currentUser?.id) {
      dashboardListingsMeta = {
        total: previewRows.length,
        source_counts: { user_listings: 0, listings: 0, merged: previewRows.length },
        used_summary_fallback: previewRows.length > 0,
        source: previewRows.length ? "summary_preview" : "api"
      };
      return previewRows;
    }

    const url = new URL("/api/get-user-listings", window.location.origin);
    url.searchParams.set("userId", currentUser.id);
    if (currentUser.email) url.searchParams.set("email", currentUser.email);
    url.searchParams.set("limit", "250");
    if (forceFresh) url.searchParams.set("_ts", String(Date.now()));

    const response = await apiFetch(url.toString(), {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      dashboardListingsMeta = {
        total: previewRows.length,
        source_counts: { user_listings: 0, listings: 0, merged: previewRows.length },
        used_summary_fallback: previewRows.length > 0,
        source: previewRows.length ? "summary_preview" : "api_error"
      };
      return previewRows;
    }

    const result = await response.json();
    const rows = result?.data || result?.listings || result || [];
    const normalizedRows = Array.isArray(rows) ? rows : [];
    const metaSources = result?.meta?.sources || {};

    if (!normalizedRows.length && previewRows.length) {
      dashboardListingsMeta = {
        total: previewRows.length,
        source_counts: {
          user_listings: numberOrZero(metaSources.user_listings),
          listings: numberOrZero(metaSources.listings),
          merged: numberOrZero(metaSources.merged || previewRows.length)
        },
        used_summary_fallback: true,
        source: "summary_preview"
      };
      return previewRows;
    }

    dashboardListingsMeta = {
      total: normalizedRows.length,
      source_counts: {
        user_listings: numberOrZero(metaSources.user_listings),
        listings: numberOrZero(metaSources.listings),
        merged: numberOrZero(metaSources.merged || normalizedRows.length)
      },
      used_summary_fallback: false,
      source: "api"
    };

    return normalizedRows;
  } catch (error) {
    console.warn("fetchUserListings fallback:", error);
    const previewRows = Array.isArray(dashboardSummary?.recent_listings) ? dashboardSummary.recent_listings : [];
    dashboardListingsMeta = {
      total: previewRows.length,
      source_counts: { user_listings: 0, listings: 0, merged: previewRows.length },
      used_summary_fallback: previewRows.length > 0,
      source: previewRows.length ? "summary_preview" : "api_exception"
    };
    return previewRows;
  }
}

function normalizeListingRecord(row) {
  if (!row || typeof row !== "object") return null;

  const year = numberOrZero(row.year);
  const make = clean(row.make || "");
  const model = clean(row.model || "");
  const trim = clean(row.trim || "");
  const title =
    clean(row.title || buildVehicleTitle({ year, make, model, trim })) || "Vehicle Listing";

  const postedAt =
    row.posted_at ||
    row.created_at ||
    row.timestamp ||
    new Date().toISOString();

  const views = numberOrZero(row.views_count ?? row.views ?? 0);
  const messages = numberOrZero(row.messages_count ?? row.messages ?? 0);
  const price = numberOrZero(row.price);
  const mileage = numberOrZero(row.mileage || row.kilometers || row.km);

  const imageUrl =
    clean(
      row.image_url ||
      row.cover_photo ||
      row.coverImage ||
      row.photo ||
      row.photos?.[0] ||
      ""
    ) || placeholderVehicleImage(title);

  const status = clean(row.status || "posted").toLowerCase();
  const lifecycleStatus = clean(row.lifecycle_status || row.review_status || "").toLowerCase();

  const intelligence = computeListingIntelligence({ ...row, posted_at: postedAt, status, lifecycle_status: lifecycleStatus, views_count: views, messages_count: messages, review_bucket: clean(row.review_bucket || '') });
  return {
    id: clean(row.id || row.marketplace_listing_id || row.source_url || cryptoRandomFallback()),
    user_id: clean(row.user_id || ""),
    dealership_id: clean(row.dealership_id || ""),
    vin: clean(row.vin || ""),
    stock_number: clean(row.stock_number || row.stockNumber || ""),
    source_url: clean(row.source_url || row.sourceUrl || ""),
    image_url: imageUrl,
    year,
    make,
    model,
    trim,
    vehicle_type: clean(row.vehicle_type || row.vehicleType || ""),
    body_style: clean(row.body_style || row.bodyStyle || ""),
    exterior_color: clean(row.exterior_color || row.exteriorColor || row.color || ""),
    fuel_type: clean(row.fuel_type || row.fuelType || ""),
    mileage,
    price,
    title,
    status,
    lifecycle_status: lifecycleStatus,
    review_bucket: clean(row.review_bucket || ""),
    posted_at: postedAt,
    created_at: row.created_at || postedAt,
    views_count: views,
    messages_count: messages,
    popularity_score: (messages * 1000) + (views * 10) + getTimestamp(postedAt) / 100000000,
    ...intelligence
  };
}

function buildDashboardSummaryFromListings(listings) {
  const now = new Date();
  const todayKey = toDateKey(now);
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let postsToday = 0;
  let postsMonth = 0;
  let activeListings = 0;
  let totalViews = 0;
  let totalMessages = 0;
  let staleListings = 0;
  let reviewDeleteCount = 0;
  let reviewPriceChangeCount = 0;
  let reviewNewCount = 0;
  let weakListings = 0;
  let needsActionCount = 0;

  for (const item of listings) {
    const itemDate = new Date(item.posted_at);
    if (!Number.isNaN(itemDate.getTime())) {
      if (toDateKey(itemDate) === todayKey) postsToday += 1;
      if (`${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, "0")}` === monthKey) {
        postsMonth += 1;
      }
    }

    if (!["sold", "deleted", "inactive"].includes(item.status)) activeListings += 1;
    totalViews += numberOrZero(item.views_count);
    totalMessages += numberOrZero(item.messages_count);

    if (item.lifecycle_status === "stale") staleListings += 1;
    if (item.lifecycle_status === "review_delete" || item.review_bucket === "removedVehicles") reviewDeleteCount += 1;
    if (item.lifecycle_status === "review_price_update" || item.review_bucket === "priceChanges") reviewPriceChangeCount += 1;
    if (item.lifecycle_status === "review_new" || item.review_bucket === "newVehicles") reviewNewCount += 1;
    if (item.weak) weakListings += 1;
    if (item.needs_action) needsActionCount += 1;
  }

  const topListing = [...listings]
    .sort((a, b) => b.popularity_score - a.popularity_score)[0] || null;

  return {
    posts_today: postsToday,
    posts_this_month: postsMonth,
    active_listings: activeListings,
    total_views: totalViews,
    total_messages: totalMessages,
    stale_listings: staleListings,
    review_delete_count: reviewDeleteCount,
    review_price_change_count: reviewPriceChangeCount,
    review_new_count: reviewNewCount,
    review_queue_count: reviewDeleteCount + reviewPriceChangeCount + reviewNewCount,
    weak_listings: weakListings,
    needs_action_count: needsActionCount,
    top_listing_title: topListing?.title || "None yet"
  };
}


function computeListingIntelligence(item = {}) {
  const postedAt = item.posted_at || item.created_at || item.updated_at || null;
  const ageDays = postedAt ? Math.max(0, Math.floor((Date.now() - getTimestamp(postedAt)) / 86400000)) : 0;
  const views = numberOrZero(item.views_count);
  const messages = numberOrZero(item.messages_count);
  const status = cleanText(item.status || '').toLowerCase();
  const lifecycle = cleanText(item.lifecycle_status || '').toLowerCase();
  const bucket = cleanText(item.review_bucket || '').toLowerCase().replace(/[\s_-]+/g, '');
  const staleLike = status === 'stale' || lifecycle === 'stale' || lifecycle === 'review_delete' || bucket === 'removedvehicles';
  const likelySold = lifecycle === 'review_delete' || bucket === 'removedvehicles';
  const promoteNow = !['sold','deleted','inactive'].includes(status) && views >= 20 && messages >= 1;
  const lowPerformance = !['sold','deleted','inactive'].includes(status) && ageDays >= 7 && views < 5 && messages === 0;
  const weak = staleLike || lowPerformance;
  const needsAction = staleLike || lowPerformance || (views >= 20 && messages === 0) || lifecycle === 'review_price_update' || bucket === 'pricechanges';
  let healthScore = 100 - Math.min(ageDays * 2, 30) + Math.min(messages * 12, 36) + Math.min(views, 20);
  if (staleLike) healthScore -= 35;
  if (lowPerformance) healthScore -= 20;
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));
  let healthLabel = 'Healthy';
  if (promoteNow) healthLabel = 'High Performer';
  else if (needsAction) healthLabel = 'Needs Action';
  else if (weak) healthLabel = 'Weak';
  let recommendedAction = 'Keep live';
  if (likelySold) recommendedAction = 'Check if sold or stale';
  else if (lifecycle === 'review_price_update' || bucket === 'pricechanges' || (views >= 20 && messages === 0)) recommendedAction = 'Review price';
  else if (bucket === 'newvehicles' || lifecycle === 'review_new') recommendedAction = 'Review new listing';
  else if (lowPerformance) recommendedAction = 'Refresh title/photos';
  else if (promoteNow) recommendedAction = 'Promote now';
  let predictedScore = 50 + Math.min(views, 25) + Math.min(messages * 18, 36) - Math.min(ageDays * 3, 24);
  if (views >= 20 && messages === 0) predictedScore -= 8;
  if (weak) predictedScore -= 20;
  predictedScore = Math.max(0, Math.min(100, Math.round(predictedScore)));
  const predictedLabel = predictedScore >= 75 ? 'High Performer' : (predictedScore >= 55 ? 'Likely Performer' : (predictedScore < 35 ? 'Low Probability' : 'Uncertain'));
  const pricingInsight = (views >= 20 && messages === 0) ? 'Price may be limiting conversion.' : (messages >= 2 ? 'Pricing appears competitive.' : (views === 0 && ageDays >= 3 ? 'Listing may need stronger value or visibility.' : 'Pricing signal still developing.'));
  let contentScore = 60;
  if (cleanText(item.title).length >= 18) contentScore += 10;
  if (cleanText(item.stock_number)) contentScore += 5;
  if (cleanText(item.vin)) contentScore += 5;
  if (cleanText(item.exterior_color)) contentScore += 5;
  if (cleanText(item.body_style)) contentScore += 5;
  if (cleanText(item.fuel_type)) contentScore += 5;
  if (ageDays >= 7 && views < 5) contentScore -= 10;
  contentScore = Math.max(0, Math.min(100, Math.round(contentScore)));
  const contentFeedback = contentScore >= 80 ? 'Listing structure looks strong.' : (contentScore >= 65 ? 'Content is workable but could be tightened.' : 'Listing likely needs a stronger title and better detail signals.');
  return { age_days: ageDays, likely_sold: likelySold, promote_now: promoteNow, weak, needs_action: needsAction, health_score: healthScore, health_label: healthLabel, recommended_action: recommendedAction, predicted_score: predictedScore, predicted_label: predictedLabel, pricing_insight: pricingInsight, content_score: contentScore, content_feedback: contentFeedback };
}

function mergeSummaryWithListings(summary, listings) {
  const computed = buildDashboardSummaryFromListings(listings);
  const sessionPostsToday = numberOrZero(currentNormalizedSession?.subscription?.posts_today);
  const snapshotPostsToday = numberOrZero(summary?.account_snapshot?.posts_today ?? summary?.account_snapshot?.posts_used_today);
  const bestPostsToday = Math.max(
    numberOrZero(summary.posts_today ?? computed.posts_today),
    sessionPostsToday,
    snapshotPostsToday
  );

  return {
    posts_today: bestPostsToday,
    posts_this_month: numberOrZero(summary.posts_this_month ?? computed.posts_this_month),
    active_listings: numberOrZero(summary.active_listings ?? computed.active_listings),
    total_views: numberOrZero(summary.total_views ?? computed.total_views),
    total_messages: numberOrZero(summary.total_messages ?? computed.total_messages),
    stale_listings: numberOrZero(summary.stale_listings ?? computed.stale_listings),
    review_delete_count: numberOrZero(summary.review_delete_count ?? computed.review_delete_count),
    review_price_change_count: numberOrZero(summary.review_price_change_count ?? computed.review_price_change_count),
    review_new_count: numberOrZero(summary.review_new_count ?? computed.review_new_count),
    review_queue_count: numberOrZero(summary.review_queue_count ?? computed.review_queue_count),
    weak_listings: numberOrZero(summary.weak_listings ?? computed.weak_listings),
    needs_action_count: numberOrZero(summary.needs_action_count ?? computed.needs_action_count),
    queue_count: numberOrZero(summary.queue_count ?? 0),
    lifecycle_updated_at: clean(summary.lifecycle_updated_at || ""),
    top_listing_title: clean(summary.top_listing_title || computed.top_listing_title || "None yet"),
    account_snapshot: summary.account_snapshot || {},
    setup_status: summary.setup_status || {},
    manager_access: Boolean(summary.manager_access),
    action_center: summary.action_center || summary.daily_ops_queues || {},
    daily_ops_queues: summary.daily_ops_queues || summary.action_center || {},
    manager_summary: summary.manager_summary || {},
    manager_recommendations: Array.isArray(summary.manager_recommendations) ? summary.manager_recommendations : [],
    segment_performance: Array.isArray(summary.segment_performance) ? summary.segment_performance : [],
    alerts: Array.isArray(summary.alerts) ? summary.alerts : [],
    scorecards: summary.scorecards || {},
    intelligence: summary.intelligence || {},
    affiliate: summary.affiliate || {},
    activation: summary.activation || {},
    first_win: summary.first_win || {},
    growth_actions: summary.growth_actions || {},
    setup_blockers: Array.isArray(summary.setup_blockers) ? summary.setup_blockers : [],
    setup_recommendations: Array.isArray(summary.setup_recommendations) ? summary.setup_recommendations : [],
    revenue_intelligence: summary.revenue_intelligence || {},
    listing_action_summary: summary.listing_action_summary || {},
    opportunity_signals: Array.isArray(summary.opportunity_signals) ? summary.opportunity_signals : [],
    roi_snapshot: summary.roi_snapshot || {},
    credits: summary.credits || { balance: 0, lifetime_earned: 0, lifetime_spent: 0, recent_earned: 0, recent_events: [] }
  };
}


function applyToolModuleFilters() {
  const group = cleanText(document.getElementById('toolModuleFilter')?.value || 'all').toLowerCase();
  const state = cleanText(document.getElementById('toolStateFilter')?.value || 'all').toLowerCase();
  document.querySelectorAll('.tool-tile').forEach((tile) => {
    const matchesGroup = group === 'all' || cleanText(tile.getAttribute('data-module-group')).toLowerCase() === group;
    const matchesState = state === 'all' || cleanText(tile.getAttribute('data-module-state')).toLowerCase() === state;
    tile.style.display = matchesGroup && matchesState ? '' : 'none';
  });
}

function renderToolModuleDetail() {
  const panel = document.getElementById('toolModuleDetailPanel');
  if (!panel) return;
  const module = selectedToolModule || {
    title: 'Vehicle Poster',
    description: 'Inventory scan, queue build, Marketplace fill, and posting engine.',
    group: 'core',
    state: 'live'
  };
  const stateLabel = module.state === 'live' ? 'Live Now' : module.state === 'beta' ? 'Founder Beta' : module.state === 'planned' ? 'Coming Soon' : module.state === 'pro' ? 'Pro' : 'Locked';
  const why = module.group === 'core'
    ? 'This is directly tied to day-one execution and the operator flow.'
    : module.group === 'pipeline'
    ? 'This expands the platform into follow-up, lead handling, and repeatable workflows.'
    : 'This creates retention through insight, growth loops, and portfolio visibility.';
  panel.innerHTML = `<div><strong>${escapeHtml(module.title)}</strong> <span class="tool-status ${escapeHtml(module.state)}">${escapeHtml(stateLabel)}</span></div><div>${escapeHtml(module.description)}</div><div><strong>Why it matters:</strong> ${escapeHtml(why)}</div><div><strong>When to use:</strong> ${escapeHtml(module.state === 'live' ? 'Use it now inside your current operating flow.' : module.state === 'beta' ? 'Use selectively while it continues to harden.' : module.state === 'planned' ? 'This is part of the near-term expansion roadmap.' : module.state === 'pro' ? 'This module becomes available on higher-access plans.' : 'This remains reserved until supporting layers are complete.')}</div>`;
}

function openListingDetailModal(listingId) {
  const item = dashboardListings.find((row) => String(row.id) === String(listingId));
  if (!item) return;
  currentListingDetail = item;
  const modal = document.getElementById('listingDetailModal');
  const title = document.getElementById('listingDetailTitle');
  const subtitle = document.getElementById('listingDetailSubtitle');
  const body = document.getElementById('listingDetailBody');
  if (!modal || !title || !subtitle || !body) return;
  title.textContent = buildVehicleTitle(item);
  subtitle.textContent = `${item.action_bucket_label || 'Low Priority'} • ${item.health_label || 'Healthy'} • ${item.recommended_action || 'Keep live'}`;
  body.innerHTML = `
    <div><strong>Health Score:</strong> ${numberOrZero(item.health_score)} • <strong>Predicted:</strong> ${numberOrZero(item.predicted_score)} (${escapeHtml(item.predicted_label || 'Uncertain')})</div>
    <div><strong>Opportunity Score:</strong> ${numberOrZero(item.opportunity_score)} • <strong>Bucket:</strong> ${escapeHtml(item.action_bucket_label || 'Low Priority')}</div>
    <div><strong>Post Priority:</strong> ${numberOrZero(item.post_priority)} • <strong>Refresh Priority:</strong> ${numberOrZero(item.refresh_priority)} • <strong>Price Review:</strong> ${numberOrZero(item.price_review_priority)}</div>
    <div><strong>Views:</strong> ${numberOrZero(item.views_count)} • <strong>Messages:</strong> ${numberOrZero(item.messages_count)} • <strong>Age:</strong> ${numberOrZero(item.age_days)} day(s)</div>
    <div><strong>Pricing Insight:</strong> ${escapeHtml(item.pricing_insight || 'Pricing signal still developing.')}</div>
    <div><strong>Content Feedback:</strong> ${escapeHtml(item.content_feedback || 'Listing structure looks strong.')}</div>
    <div><strong>Compliance:</strong> ${escapeHtml(currentProfile?.compliance_mode || currentNormalizedSession?.compliance?.mode || 'Profile not finished')}</div>
    <div><strong>Last Sync:</strong> ${escapeHtml(formatRelativeOrDate(item.updated_at || item.posted_at || ''))}</div>`;
  const primary = document.getElementById('listingDetailPrimaryBtn');
  const secondary = document.getElementById('listingDetailSecondaryBtn');
  if (primary) {
    primary.textContent = item.source_url ? 'Open Source' : 'Log View';
    primary.onclick = () => item.source_url ? openListingSource(item.id, item.source_url) : trackListingView(item.id);
  }
  if (secondary) {
    secondary.textContent = 'Copy Summary';
    secondary.onclick = () => copyVehicleSummary(item.id);
  }
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeListingDetailModal() {
  const modal = document.getElementById('listingDetailModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  currentListingDetail = null;
}

function renderRevenueActionPanels() {
  const summary = dashboardSummary || {};
  const listingActionSummary = summary.listing_action_summary || {};
  setTextByIdForAll('actionBucketDoNow', String(numberOrZero(listingActionSummary.do_now)));
  setTextByIdForAll('actionBucketDoToday', String(numberOrZero(listingActionSummary.do_today)));
  setTextByIdForAll('actionBucketWatch', String(numberOrZero(listingActionSummary.watch)));
  setTextByIdForAll('actionBucketLow', String(numberOrZero(listingActionSummary.low_priority)));
  const actionSummary = document.getElementById('actionBucketSummary');
  if (actionSummary) {
    const next = (summary.activation?.next_best_actions || [])[0] || 'No urgent action detected right now.';
    actionSummary.textContent = next;
  }
  const revenuePanel = document.getElementById('revenueIntelligencePanel');
  if (revenuePanel) {
    const revenue = summary.revenue_intelligence || {};
    const signals = Array.isArray(summary.opportunity_signals) ? summary.opportunity_signals : [];
    revenuePanel.innerHTML = `
      <div><strong>Time Saved Today:</strong> ${numberOrZero(revenue.time_saved_today_minutes)} min</div>
      <div><strong>Time Saved This Week:</strong> ${numberOrZero(revenue.time_saved_week_minutes)} min</div>
      <div><strong>Refresh Candidates:</strong> ${numberOrZero(revenue.refresh_candidates)}</div>
      <div><strong>Price Review Candidates:</strong> ${numberOrZero(revenue.price_review_candidates)}</div>
      <div><strong>Missed Opportunity Estimate:</strong> ${numberOrZero(revenue.missed_opportunity_estimate)}</div>
      <div style="margin-top:10px;"><strong>Signals:</strong></div>
      ${signals.length ? signals.map((item) => `<div>• ${escapeHtml(cleanText(item))}</div>`).join('') : '<div>No major opportunity signals yet.</div>'}`;
  }
}

function renderDashboardAnalytics() {
  setTextByIdForAll("kpiPostsToday", String(numberOrZero(dashboardSummary?.posts_today)));
  setTextByIdForAll("kpiPostsMonth", String(numberOrZero(dashboardSummary?.posts_this_month)));
  setTextByIdForAll("kpiActiveListings", String(numberOrZero(dashboardSummary?.active_listings)));
  setTextByIdForAll("kpiViews", String(numberOrZero(dashboardSummary?.total_views)));
  setTextByIdForAll("kpiMessages", String(numberOrZero(dashboardSummary?.total_messages)));
  setTextByIdForAll("kpiPostsRemaining", String(numberOrZero(currentNormalizedSession?.subscription?.posts_remaining ?? dashboardSummary?.account_snapshot?.posts_remaining)));
  setTextByIdForAll("kpiDailyLimit", String(numberOrZero(currentNormalizedSession?.subscription?.posting_limit ?? dashboardSummary?.account_snapshot?.posting_limit)));

  // lifecycle-ready safe no-op if ids do not exist yet
  setTextByIdForAll("kpiReviewQueue", String(numberOrZero(dashboardSummary?.review_queue_count)));
  setTextByIdForAll("kpiStaleListings", String(numberOrZero(dashboardSummary?.stale_listings)));
  setTextByIdForAll("kpiPriceChanges", String(numberOrZero(dashboardSummary?.review_price_change_count)));
  setTextByIdForAll("kpiQueuedVehicles", String(numberOrZero(dashboardSummary?.queue_count)));
  setTextByIdForAll("kpiReviewNew", String(numberOrZero(dashboardSummary?.review_new_count)));
  setTextByIdForAll("kpiReviewDelete", String(numberOrZero(dashboardSummary?.review_delete_count)));
  setTextByIdForAll("kpiWeakListings", String(numberOrZero(dashboardSummary?.weak_listings)));
  setTextByIdForAll("kpiNeedsAction", String(numberOrZero(dashboardSummary?.needs_action_count)));

  renderPrioritiesPanels();
  renderScorecards();
  renderIntelligencePanels();
  renderAffiliateCenter();
  renderTopListings(dashboardListings);
  renderRecentActivity(dashboardListings);
  renderOverviewOperatorPanel();
  renderAnalyticsHub();
  renderMonetizationPanels();
  renderSetupWorkspace();
  renderComplianceWorkspace();
  renderToolsWorkspace();
  drawActivityChart(buildChartSeries());
}




function getSetupChecklist(profile = null, session = null) {
  const mergedProfile = getCanonicalProfileState(profile, session);
  const normalizedSession = session || currentNormalizedSession || {};
  const setup = dashboardSummary?.setup_status || {};
  const subscription = getCanonicalSubscriptionState(normalizedSession);
  return [
    { key: 'full_name', label: 'Salesperson identity', ready: Boolean(setup.salesperson_name_present || mergedProfile.full_name), target: 'full_name' },
    { key: 'dealership', label: 'Dealership name', ready: Boolean(setup.dealership_name_present || mergedProfile.dealership), target: 'dealership' },
    { key: 'dealer_website', label: 'Dealer website', ready: Boolean(setup.dealer_website_present || mergedProfile.dealer_website), target: 'dealer_website' },
    { key: 'inventory_url', label: 'Inventory URL', ready: Boolean(setup.inventory_url_present || mergedProfile.inventory_url), target: 'inventory_url' },
    { key: 'scanner_type', label: 'Scanner type', ready: Boolean(setup.scanner_type_present || mergedProfile.scanner_type), target: 'scanner_type' },
    { key: 'listing_location', label: 'Listing location', ready: Boolean(setup.listing_location_present || mergedProfile.listing_location), target: 'listing_location' },
    { key: 'compliance_mode', label: 'Compliance mode', ready: Boolean(setup.compliance_mode_present || mergedProfile.compliance_mode || mergedProfile.province), target: 'compliance_mode' },
    { key: 'license_number', label: 'License number', ready: Boolean(mergedProfile.license_number), target: 'license_number' },
    { key: 'access', label: 'Account access', ready: Boolean(subscription.active), target: null }
  ];
}

function jumpToSetupField(fieldId) {
  showSection('profile');
  if (!fieldId) return;
  const el = document.getElementById(fieldId);
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    try { el.focus({ preventScroll: true }); } catch {}
  });
}

function renderSetupWorkspace(profile = null, session = null) {
  const checklist = getSetupChecklist(profile, session);
  const readyCount = checklist.filter((item) => item.ready).length;
  const total = checklist.length;
  const percent = total ? Math.round((readyCount / total) * 100) : 0;
  const blockers = checklist.filter((item) => !item.ready && item.key !== 'access');
  setTextByIdForAll('setupReadinessPercent', `${percent}%`);
  setTextByIdForAll('setupReadinessSummary', `${readyCount}/${total} setup checkpoints are ready.`);
  const blockersEl = document.getElementById('setupBlockersList');
  if (blockersEl) {
    blockersEl.innerHTML = blockers.length
      ? blockers.map((item) => `<div class="action-row"><div><strong>${escapeHtml(item.label)}</strong><div class="subtext">Required before the posting flow is truly launch-ready.</div></div><button class="action-btn setup-jump-btn" type="button" data-field-id="${escapeHtml(item.target || '')}">Fix Now</button></div>`).join('')
      : '<div>No setup blockers remain. This account is ready for the posting flow.</div>';
  }
  const nextStepEl = document.getElementById('setupNextStepPanel');
  if (nextStepEl) {
    const nextItem = blockers[0] || checklist.find((item) => item.key === 'access' && !item.ready);
    nextStepEl.innerHTML = nextItem
      ? `<div><strong>Next step:</strong> ${escapeHtml(nextItem.label)}</div><div class="subtext">Complete this first so the platform has clean dealer routing and compliant output.</div>`
      : '<div><strong>Setup complete.</strong> Move into Tools to verify posting state or Analytics to watch performance.</div>';
  }
}

function buildComplianceFooterPreview(profile) {
  const lines = [];
  if (profile.dealership) lines.push(profile.dealership);
  if (profile.listing_location) lines.push(profile.listing_location);
  if (profile.dealer_phone || profile.phone) lines.push(profile.dealer_phone || profile.phone);
  if (profile.dealer_email) lines.push(profile.dealer_email);
  if ((profile.compliance_mode || profile.province || '').toUpperCase().startsWith('AB')) lines.push('AMVIC Licensed Business. Pricing plus taxes and fees as applicable.');
  if ((profile.compliance_mode || profile.province || '').toUpperCase().startsWith('BC')) lines.push('Licensed dealer. Pricing and documentation subject to BC dealer requirements.');
  return lines.filter(Boolean).join('\n') || 'Dealer footer preview will appear here once setup is complete.';
}

function renderComplianceWorkspace(profile = null, session = null) {
  const mergedProfile = getCanonicalProfileState(profile, session);
  const blockers = [];
  if (!mergedProfile.province && !mergedProfile.compliance_mode) blockers.push('Province or compliance mode missing');
  if (!mergedProfile.license_number) blockers.push('License number missing');
  if (!mergedProfile.dealership) blockers.push('Dealership name missing');
  if (!mergedProfile.dealer_phone && !mergedProfile.phone) blockers.push('Dealer or salesperson phone missing');
  const statusEl = document.getElementById('complianceStatusPanel');
  if (statusEl) {
    statusEl.innerHTML = blockers.length
      ? `<div class="status-line warn"><strong>Not ready to publish.</strong> ${escapeHtml(blockers.join(' • '))}</div>`
      : '<div class="status-line success"><strong>Compliance ready.</strong> Profile data is present for dealer footer and province output.</div>';
  }
  const footerEl = document.getElementById('complianceFooterPreview');
  if (footerEl) footerEl.textContent = buildComplianceFooterPreview(mergedProfile);
  const descEl = document.getElementById('complianceDescriptionPreview');
  if (descEl) {
    const mode = (mergedProfile.compliance_mode || mergedProfile.province || '').toUpperCase();
  }
  if (descEl) {
    const mode = (mergedProfile.compliance_mode || mergedProfile.province || '').toUpperCase();
    descEl.textContent = mode.startsWith('AB')
      ? 'AB / Alberta output: include dealership identity, AMVIC framing where required, and pricing language that avoids ambiguous all-in claims.'
      : mode.startsWith('BC')
        ? 'BC output: keep dealer identity visible, preserve compliance wording, and ensure listing copy aligns with BC dealer expectations.'
        : 'Select a compliance mode to preview the output block that will feed Marketplace posting.';
  }
  const blockerEl = document.getElementById('complianceBlockersList');
  if (blockerEl) {
    blockerEl.innerHTML = blockers.length
      ? blockers.map((item) => `<div>• ${escapeHtml(item)}</div>`).join('')
      : '<div>• Province logic present</div><div>• License field present</div><div>• Dealer contact block available</div>';
  }
}

function renderToolsWorkspace(profile = null, session = null) {
  const mergedProfile = getCanonicalProfileState(profile, session);
  const subscription = getCanonicalSubscriptionState(session);
  const blockers = [];
  if (!subscription.active) blockers.push('Access inactive');
  if (!mergedProfile.inventory_url) blockers.push('Inventory URL missing');
  if (!mergedProfile.scanner_type) blockers.push('Scanner type missing');
  if (!(mergedProfile.compliance_mode || mergedProfile.province)) blockers.push('Compliance mode missing');
  const statusEl = document.getElementById('toolsSystemStatusPanel');
  if (statusEl) {
    statusEl.innerHTML = blockers.length
      ? `<div><strong>Ready to Post:</strong> No</div><div class="subtext">${escapeHtml(blockers.join(' • '))}</div>`
      : '<div><strong>Ready to Post:</strong> Yes</div><div class="subtext">Routing, compliance, and access checks are present for beta operation.</div>';
  }
  const nextEl = document.getElementById('toolsNextStepPanel');
  if (nextEl) {
    nextEl.innerHTML = blockers.length
      ? `<div><strong>Next step:</strong> ${escapeHtml(blockers[0])}</div><div class="subtext">Resolve this first, then refresh extension state.</div>`
      : '<div><strong>Next step:</strong> Open inventory or Marketplace and run the posting flow.</div>';
  }
  const countsEl = document.getElementById('moduleCountsPanel');
  if (countsEl) {
    const modules = Array.from(document.querySelectorAll('.tool-tile'));
    const count = (state) => modules.filter((tile) => cleanText(tile.getAttribute('data-module-state')).toLowerCase() === state).length;
    countsEl.innerHTML = `
      <div class="sidebar-card"><div class="sidebar-card-label">Active</div><div class="sidebar-card-value">${count('live')}</div></div>
      <div class="sidebar-card"><div class="sidebar-card-label">Beta</div><div class="sidebar-card-value">${count('beta')}</div></div>
      <div class="sidebar-card"><div class="sidebar-card-label">Locked / Pro</div><div class="sidebar-card-value">${count('pro') + count('locked')}</div></div>
      <div class="sidebar-card"><div class="sidebar-card-label">Planned</div><div class="sidebar-card-value">${count('planned')}</div></div>`;
  }
}

function renderOverviewOperatorPanel() {
  const roi = dashboardSummary?.roi_snapshot || {};
  const accountSnapshot = dashboardSummary?.account_snapshot || {};
  const setup = dashboardSummary?.setup_status || {};
  const credits = dashboardSummary?.credits || {};
  const queues = dashboardSummary?.daily_ops_queues || dashboardSummary?.action_center || {};
  const details = dashboardSummary?.action_center_details || {};

  const timeSavedToday = numberOrZero(roi.estimated_minutes_saved_today || (numberOrZero(dashboardSummary?.posts_today) * 18));
  const postsToday = numberOrZero(dashboardSummary?.posts_today);
  const postingLimit = numberOrZero(
    currentNormalizedSession?.subscription?.posting_limit ??
    accountSnapshot?.effective_posting_limit ??
    accountSnapshot?.posting_limit
  );
  const postsRemaining = Math.max(
    0,
    numberOrZero(
      currentNormalizedSession?.subscription?.posts_remaining ??
      accountSnapshot?.posts_remaining ??
      (postingLimit > 0 ? postingLimit - postsToday : 0)
    )
  );
  const readyQueue = numberOrZero(dashboardSummary?.queue_count);
  const reviewQueue = numberOrZero(dashboardSummary?.review_queue_count);
  const staleListings = numberOrZero(dashboardSummary?.stale_listings);
  const weakListings = numberOrZero(dashboardSummary?.weak_listings);
  const needsAction = numberOrZero(dashboardSummary?.needs_action_count);
  const revenueAttention = reviewQueue + staleListings + weakListings + needsAction;
  const planName = cleanText(
    currentNormalizedSession?.subscription?.plan_name ||
    currentNormalizedSession?.subscription?.plan ||
    accountSnapshot?.plan_name ||
    dashboardSummary?.plan_name ||
    'Founder Beta'
  );
  const accessActive = Boolean(
    currentNormalizedSession?.access?.has_access ??
    currentNormalizedSession?.subscription?.active ??
    accountSnapshot?.access_active ??
    dashboardSummary?.has_access ??
    true
  );

  const setupChecks = [
    { label: 'Dealer website', ready: Boolean(setup.dealer_website_present || currentProfile?.dealer_website || currentNormalizedSession?.dealership?.website) },
    { label: 'Inventory URL', ready: Boolean(setup.inventory_url_present || currentProfile?.inventory_url || currentNormalizedSession?.dealership?.inventory_url) },
    { label: 'Scanner type', ready: Boolean(setup.scanner_type_present || currentProfile?.scanner_type || currentNormalizedSession?.scanner_config?.scanner_type || currentNormalizedSession?.dealership?.scanner_type) },
    { label: 'Listing location', ready: Boolean(setup.listing_location_present || currentProfile?.listing_location || currentNormalizedSession?.profile?.listing_location) },
    { label: 'Compliance mode', ready: Boolean(setup.compliance_mode_present || currentProfile?.compliance_mode || currentProfile?.province || currentNormalizedSession?.profile?.compliance_mode || currentNormalizedSession?.dealership?.province) },
    { label: 'Access active', ready: accessActive }
  ];
  const setupReadyCount = setupChecks.filter((item) => item.ready).length;
  const setupPercent = Math.round((setupReadyCount / setupChecks.length) * 100);
  const setupGaps = Array.isArray(setup.setup_gaps) ? setup.setup_gaps.filter(Boolean) : [];

  setTextByIdForAll('overviewTimeSavedToday', `${timeSavedToday} min`);
  setTextByIdForAll('overviewPlanChip', planName || 'Founder Beta');
  setTextByIdForAll('overviewAccessChip', accessActive ? 'Active Access' : 'Access Needs Attention');
  setTextByIdForAll('commandSetupChip', `Setup ${setupPercent}%`);
  setTextByIdForAll('commandPostsUsed', `${postsToday} / ${postingLimit || 0}`);
  setTextByIdForAll('commandReadyQueue', String(readyQueue));
  setTextByIdForAll('commandRevenueAttention', String(revenueAttention));
  setTextByIdForAll('commandCreditsBalance', String(numberOrZero(credits.balance)));
  setTextByIdForAll('commandCreditsEarned', String(numberOrZero(credits.lifetime_earned)));
  setTextByIdForAll('commandSetupProgress', `${setupPercent}%`);

  const commandCenterSubtext = document.getElementById('commandCenterSubtext');
  if (commandCenterSubtext) {
    const opener = accessActive
      ? `You have ${postsRemaining} post${postsRemaining === 1 ? '' : 's'} left today with ${readyQueue} vehicle${readyQueue === 1 ? '' : 's'} in queue.`
      : 'Access needs attention before clean extension usage and posting.';
    const closer = revenueAttention > 0
      ? `${revenueAttention} listing${revenueAttention === 1 ? '' : 's'} currently need attention or promotion.`
      : 'No urgent listing pressure right now—focus on output and setup completeness.';
    commandCenterSubtext.textContent = `${opener} ${closer}`;
  }

  const overviewActionList = document.getElementById('overviewActionList');
  if (overviewActionList) {
    const actionItems = []
      .concat(Array.isArray(details.today) ? details.today : [])
      .concat(Array.isArray(details.opportunities) ? details.opportunities.slice(0, 2) : [])
      .slice(0, 4);

    overviewActionList.innerHTML = actionItems.length
      ? actionItems.map((item, index) => {
          const title = cleanText(item?.title || item?.label || `Priority ${index + 1}`);
          const copy = cleanText(item?.copy || item?.description || item?.reason || '');
          const actionId = cleanText(item?.id || item?.action || '');
          const actionBtn = actionId
            ? `<button class="mini-btn" type="button" onclick="executeActionCenterItemById('${escapeJs(actionId)}')">Run</button>`
            : '';
          return `
            <div class="overview-action-item">
              <div>
                <div class="title">${escapeHtml(title)}</div>
                <div class="sub">${escapeHtml(copy || 'Keep momentum moving on the highest-value task next.')}</div>
              </div>
              ${actionBtn}
            </div>
          `;
        }).join('')
      : `
        <div class="overview-action-item">
          <div>
            <div class="title">No urgent blockers detected</div>
            <div class="sub">Keep posting, watch traction, and use credits when volume creates leverage.</div>
          </div>
        </div>
      `;
  }

  const blockers = [];
  if (!accessActive) blockers.push('Billing or access needs attention.');
  if (reviewQueue > 0) blockers.push(`${reviewQueue} listing${reviewQueue === 1 ? '' : 's'} waiting for review.`);
  if (staleListings > 0) blockers.push(`${staleListings} stale listing${staleListings === 1 ? '' : 's'} need refresh.`);
  if (weakListings > 0) blockers.push(`${weakListings} weak listing${weakListings === 1 ? '' : 's'} need stronger copy or media.`);
  if (postsRemaining <= 0 && postingLimit > 0) blockers.push('Daily posting limit reached.');
  if (setupGaps.length) blockers.push(`Setup gaps: ${setupGaps.slice(0, 3).join(', ')}${setupGaps.length > 3 ? '...' : ''}`);

  const blockersEl = document.getElementById('overviewBlockers');
  if (blockersEl) {
    const summaryBits = [
      `<strong>Posts:</strong> ${postsToday}/${postingLimit || 0}`,
      `<strong>Remaining:</strong> ${postsRemaining}`,
      `<strong>Ready Queue:</strong> ${readyQueue}`,
      `<strong>Time Saved:</strong> ${timeSavedToday} min`
    ];
    const blockerCopy = blockers.length
      ? blockers.map((item) => `• ${escapeHtml(item)}`).join(' ')
      : '• No major blockers right now. Stay in flow and keep the queue moving.';
    blockersEl.innerHTML = `${summaryBits.join(' &nbsp;•&nbsp; ')}<br>${blockerCopy}`;
  }

  const setupFill = document.getElementById('commandSetupFill');
  if (setupFill) {
    setupFill.style.width = `${setupPercent}%`;
  }

  const setupSummary = document.getElementById('commandSetupSummary');
  if (setupSummary) {
    setupSummary.textContent = setupGaps.length
      ? `Still missing: ${setupGaps.slice(0, 3).join(' • ')}${setupGaps.length > 3 ? '…' : ''}`
      : 'Setup is in strong shape for beta usage and compliance flow.';
  }

  const setupChecklist = document.getElementById('commandSetupChecklist');
  if (setupChecklist) {
    setupChecklist.innerHTML = setupChecks.slice(0, 4).map((item) => `
      <div class="setup-check ${item.ready ? 'good' : 'warn'}">
        <span>${escapeHtml(item.label)}</span>
        <strong>${item.ready ? 'Ready' : 'Needs Setup'}</strong>
      </div>
    `).join('');
  }

  const recentEvents = Array.isArray(credits.recent_events) ? credits.recent_events : [];
  const latestEvent = recentEvents[0] || null;
  setTextByIdForAll('commandCreditsLatest', latestEvent ? `+${numberOrZero(latestEvent.amount)}` : '—');

  const creditPreview = document.getElementById('overviewCreditPreview');
  if (creditPreview) {
    creditPreview.innerHTML = latestEvent
      ? `<strong>${escapeHtml(cleanText(latestEvent.label || latestEvent.type || 'Credit event'))}</strong><br><span style="color:var(--muted);">${escapeHtml(formatRelativeOrDate(latestEvent.created_at || ''))}</span>`
      : 'No credit activity yet. Post inventory and activate referral loops to start building balance.';
  }
}


function renderAnalyticsHub() {
  const roi = dashboardSummary?.roi_snapshot || {};
  const credits = dashboardSummary?.credits || {};
  const postsToday = numberOrZero(dashboardSummary?.posts_today);
  const postingLimit = numberOrZero(currentNormalizedSession?.subscription?.posting_limit ?? dashboardSummary?.account_snapshot?.posting_limit);
  const reviewQueue = numberOrZero(dashboardSummary?.review_queue_count);
  const staleListings = numberOrZero(dashboardSummary?.stale_listings);
  const weakListings = numberOrZero(dashboardSummary?.weak_listings);
  const messages = numberOrZero(dashboardSummary?.total_messages);
  const views = numberOrZero(dashboardSummary?.total_views);
  const weekMinutes = numberOrZero(roi.estimated_minutes_saved_week || postsToday * 18);
  const dayMinutes = numberOrZero(roi.estimated_minutes_saved_today || postsToday * 18);
  const estimatedValue = Number(roi.estimated_value_saved || (((dayMinutes / 60) * 30).toFixed(2)) || 0);
  const efficiency = postingLimit > 0 ? Math.min(100, Math.round((postsToday / postingLimit) * 100)) : 0;

  setTextByIdForAll("analyticsTimeSavedToday", `${dayMinutes} min`);
  setTextByIdForAll("analyticsTimeSavedWeek", `${weekMinutes} min`);
  setTextByIdForAll("analyticsEstimatedValue", formatCurrency(estimatedValue));
  setTextByIdForAll("analyticsEfficiencyScore", `${efficiency}%`);
  setTextByIdForAll("kpiCreditsBalance", String(numberOrZero(credits.balance)));
  setTextByIdForAll("kpiCreditsEarned", String(numberOrZero(credits.lifetime_earned)));
  setTextByIdForAll("analyticsCreditsBalance", String(numberOrZero(credits.balance)));
  setTextByIdForAll("analyticsCreditsEarned", String(numberOrZero(credits.lifetime_earned)));

  const systemHealth = document.getElementById("analyticsSystemHealth");
  if (systemHealth) {
    systemHealth.innerHTML = [
      `<div><strong>Review Queue:</strong> ${reviewQueue}</div>`,
      `<div><strong>Stale Listings:</strong> ${staleListings}</div>`,
      `<div><strong>Weak Listings:</strong> ${weakListings}</div>`,
      `<div><strong>Lifecycle Updated:</strong> ${escapeHtml(cleanText(dashboardSummary?.lifecycle_updated_at || dashboardSummary?.account_snapshot?.current_period_end || '—'))}</div>`
    ].join("");
  }

  const growthSignals = document.getElementById("analyticsGrowthSignals");
  if (growthSignals) {
    growthSignals.innerHTML = [
      `<div><strong>Posts Today:</strong> ${postsToday}</div>`,
      `<div><strong>Views:</strong> ${views}</div>`,
      `<div><strong>Messages:</strong> ${messages}</div>`,
      `<div><strong>Top Listing:</strong> ${escapeHtml(cleanText(dashboardSummary?.top_listing_title || 'None yet'))}</div>`
    ].join("");
  }

  const creditActivity = document.getElementById("analyticsCreditActivity");
  if (creditActivity) {
    const events = Array.isArray(credits.recent_events) ? credits.recent_events : [];
    creditActivity.innerHTML = events.length
      ? events.map((event) => `<div><strong>+${numberOrZero(event.amount)}</strong> ${escapeHtml(cleanText(event.label || event.type || 'Credit event'))} <span style="color:var(--muted);">• ${escapeHtml(formatRelativeOrDate(event.created_at || ''))}</span></div>`).join('')
      : '<div>No credit activity yet.</div>';
  }

  const oppSignals = document.getElementById("analyticsOpportunitySignals");
  if (oppSignals) {
    oppSignals.innerHTML = [
      `<div><strong>Posts Remaining:</strong> ${numberOrZero(currentNormalizedSession?.subscription?.posts_remaining ?? dashboardSummary?.account_snapshot?.posts_remaining)}</div>`,
      `<div><strong>Queued Vehicles:</strong> ${numberOrZero(dashboardSummary?.queue_count)}</div>`,
      `<div><strong>Messages Ready For Follow-Up:</strong> ${messages}</div>`,
      `<div><strong>Promote / Review Opportunities:</strong> ${numberOrZero(dashboardSummary?.needs_action_count)}</div>`
    ].join("");
  }
}

function applyListingFiltersAndRender() {
  const searchTerm = clean((document.getElementById("listingSearchInput")?.value || "").toLowerCase());
  const sortMode = clean(document.getElementById("listingSortSelect")?.value || "popular");

  let rows = [...dashboardListings];

  if (listingQuickFilter !== "all") {
    rows = rows.filter((item) => {
      const lifecycle = clean((item.lifecycle_status || "").toLowerCase());
      const bucket = clean((item.review_bucket || "").toLowerCase()).replace(/[\s_-]+/g, "");
      const status = clean((item.status || "").toLowerCase());

      if (listingQuickFilter === "review") return ["review_delete", "review_price_update", "review_new"].includes(lifecycle) || ["removedvehicles", "pricechanges", "newvehicles"].includes(bucket);
      if (listingQuickFilter === "stale") return lifecycle === "stale" || status === "stale" || lifecycle === "review_delete" || bucket === "removedvehicles";
      if (listingQuickFilter === "price") return lifecycle === "review_price_update" || bucket === "pricechanges";
      if (listingQuickFilter === "new") return lifecycle === "review_new" || bucket === "newvehicles";
      if (listingQuickFilter === "weak") return Boolean(item.weak);
      if (listingQuickFilter === "needs_action") return Boolean(item.needs_action);
      if (listingQuickFilter === "promote") return Boolean(item.promote_now);
      if (listingQuickFilter === "likely_sold") return Boolean(item.likely_sold);
      if (listingQuickFilter === "active") return !["sold", "deleted", "inactive", "stale"].includes(status) && lifecycle !== "review_delete";
      return true;
    });
  }

  if (searchTerm) {
    rows = rows.filter((item) => {
      const haystack = [
        item.title,
        item.make,
        item.model,
        item.trim,
        item.vin,
        item.stock_number,
        item.body_style,
        item.lifecycle_status,
        item.review_bucket
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchTerm);
    });
  }

  rows.sort((a, b) => {
    if (sortMode === "newest") return getTimestamp(b.posted_at) - getTimestamp(a.posted_at);
    if (sortMode === "price_high") return numberOrZero(b.price) - numberOrZero(a.price);
    if (sortMode === "price_low") return numberOrZero(a.price) - numberOrZero(b.price);
    return numberOrZero(b.popularity_score) - numberOrZero(a.popularity_score);
  });

  filteredListings = rows;
  renderListingsGrid(filteredListings);
}

async function logListingUsage(action, listingId, metadata = {}) {
  try {
    const email = clean(window.currentUser?.email || window.currentUserEmail || "").toLowerCase();
    const userId = clean(window.currentUser?.id || window.currentUserId || "");
    const response = await apiFetch("/api/log-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, listing_id: listingId, listingId, email, user_id: userId, userId, metadata })
    });
    return await response.json().catch(() => ({}));
  } catch (error) {
    console.warn("log listing usage warning", error);
    return { success: false, error: error.message };
  }
}

async function trackListingView(listingId) {
  await logListingUsage("listing_viewed", listingId, { source: "dashboard_card" });
  await refreshDashboardData?.();
}

async function trackListingMessage(listingId) {
  await logListingUsage("listing_message", listingId, { source: "dashboard_card" });
  await refreshDashboardData?.();
}

async function openListingSource(listingId, sourceUrl) {
  await logListingUsage("listing_card_opened", listingId, { source: "dashboard_open_source", source_url: sourceUrl });
  if (sourceUrl) window.open(sourceUrl, "_blank");
  setTimeout(() => { refreshDashboardData?.(); }, 400);
}

function renderListingDataState(listings = []) {
  const subtext = document.getElementById("listingDataStatus");
  const statusEl = document.getElementById("listingGridStatus");
  const summary = dashboardSummary || {};
  const activeListings = numberOrZero(summary.active_listings);
  const counts = dashboardListingsMeta?.source_counts || {};
  const mergedCount = numberOrZero(dashboardListingsMeta?.total || listings.length);
  const fallbackUsed = Boolean(dashboardListingsMeta?.used_summary_fallback);
  const sourceLabel = fallbackUsed ? "summary preview" : "live listing rows";

  const subtextParts = [
    `${mergedCount} listing${mergedCount === 1 ? "" : "s"} loaded from ${sourceLabel}.`,
    activeListings ? `${activeListings} active tracked.` : "No active tracked listings yet."
  ];
  if (fallbackUsed) subtextParts.push("Showing summary-backed preview while direct listing rows hydrate.");

  if (subtext) subtext.textContent = subtextParts.join(" ");

  if (statusEl) {
    if (!listings.length && activeListings > 0) {
      statusEl.textContent = `Tracked counts exist (${activeListings} active) but detailed listing cards are still hydrating. Refresh listings or trigger another backend sync after the next post/scan.`;
      return;
    }

    statusEl.textContent = [
      `${mergedCount} listing${mergedCount === 1 ? "" : "s"} loaded.`,
      `Rows: user_listings ${numberOrZero(counts.user_listings)} • listings ${numberOrZero(counts.listings)} • merged ${numberOrZero(counts.merged || mergedCount)}.`,
      summary.lifecycle_updated_at ? `Last lifecycle sync: ${cleanText(summary.lifecycle_updated_at)}.` : ""
    ].filter(Boolean).join(" ");
  }
}

function renderListingsGrid(listings) {
  const grid = document.getElementById("recentListingsGrid");
  if (!grid) return;

  if (!Array.isArray(listings) || !listings.length) {
    const activeTracked = numberOrZero(dashboardSummary?.active_listings);
    grid.innerHTML = `<div class="listing-empty">${activeTracked > 0 ? `Tracked listing counts exist (${activeTracked} active), but detailed cards have not hydrated yet. Refresh listings after the next sync or post commit.` : `No listings available yet. As posts get registered, vehicle cards will appear here.`}</div>`;
    renderListingDataState([]);
    return;
  }

  const html = listings.map((item) => {
    return `
      <article class="listing-card">
        <div class="listing-media">
          <img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='${escapeHtml(placeholderVehicleImage(item.title))}'" />
          <div class="listing-badge">${renderBadgeHtml(item.status, item.lifecycle_status)}</div>
        </div>

        <div class="listing-content">
          <div>
            <div class="listing-title">${escapeHtml(item.title)}</div>
            <div class="listing-sub">${escapeHtml(buildListingSubtitle(item))}</div>
          </div>

          <div class="listing-price">${formatCurrency(item.price)}</div>
          <div class="status-line">${escapeHtml(item.health_label || 'Healthy')} • ${escapeHtml(item.recommended_action || 'Keep live')}</div>

          <div class="listing-specs">
            <div class="spec-chip">
              <div class="spec-chip-label">Mileage</div>
              <div class="spec-chip-value">${formatMileage(item.mileage)}</div>
            </div>
            <div class="spec-chip">
              <div class="spec-chip-label">Color</div>
              <div class="spec-chip-value">${escapeHtml(item.exterior_color || "Not set")}</div>
            </div>
            <div class="spec-chip">
              <div class="spec-chip-label">Fuel</div>
              <div class="spec-chip-value">${escapeHtml(item.fuel_type || "Not set")}</div>
            </div>
          </div>

          <div class="listing-note" style="margin:0 0 12px;color:var(--muted);font-size:12px;"><strong>Bucket:</strong> ${escapeHtml(item.action_bucket_label || 'Low Priority')} • <strong>Opportunity:</strong> ${numberOrZero(item.opportunity_score)}<br/><strong>Recommended:</strong> ${escapeHtml(item.recommended_action || 'Keep live')}<br/><strong>Pricing:</strong> ${escapeHtml(item.pricing_insight || 'Pricing signal still developing.')}<br/><strong>Content:</strong> ${escapeHtml(item.content_feedback || 'Listing structure looks strong.')}</div>

          <div class="listing-metrics">
            <div class="metric-pill">
              <div class="metric-pill-label">Views</div>
              <div class="metric-pill-value">${numberOrZero(item.views_count)}</div>
            </div>
            <div class="metric-pill">
              <div class="metric-pill-label">Messages</div>
              <div class="metric-pill-value">${numberOrZero(item.messages_count)}</div>
            </div>
            <div class="metric-pill">
              <div class="metric-pill-label">Posted</div>
              <div class="metric-pill-value">${formatShortDate(item.posted_at)}</div>
            </div>
          </div>

          <div class="listing-actions">
            <button class="action-btn" type="button" onclick="openListingDetailModal('${escapeJs(item.id)}')">Inspect</button>
            <button class="action-btn" type="button" onclick="markListingAction('${escapeJs(item.id)}','approved')">Approve</button>
            <button class="action-btn" type="button" onclick="markListingSold('${escapeJs(item.id)}')">Mark Sold</button>
            <button class="action-btn" type="button" onclick="trackListingView('${escapeJs(item.id)}')">Log View</button>
            <button class="action-btn" type="button" onclick="trackListingMessage('${escapeJs(item.id)}')">Log Message</button>
            ${
              item.source_url
                ? `<button class="action-btn" type="button" onclick="openListingSource('${escapeJs(item.id)}','${escapeJs(item.source_url)}')">Open Source</button>`
                : `<button class="action-btn" type="button" onclick="copyVehicleSummary('${escapeJs(item.id)}')">Copy Summary</button>`
            }
          </div>
        </div>
      </article>
    `;
  }).join("");

  grid.innerHTML = html;
  renderListingDataState(listings);
}


function renderAffiliateCenter() {
  const affiliate = dashboardSummary?.affiliate || {};
  const referralCode = cleanText(affiliate.referral_code || document.getElementById("referralCodeAffiliate")?.textContent || "Not assigned yet") || "Not assigned yet";
  setTextByIdForAll("referralCodeAffiliate", referralCode);
  setTextByIdForAll("affiliatePartnerType", cleanText(affiliate.partner_type || "Founding Partner"));
  setTextByIdForAll("affiliateDirectCommission", `${numberOrZero(affiliate.direct_commission_percent || 20)}% recurring`);
  setTextByIdForAll("affiliateTierOverride", `${numberOrZero(affiliate.second_level_override_percent || 5)}% second level`);
  setTextByIdForAll("affiliatePayoutStatus", cleanText(affiliate.payout_status || "Manual founder-stage payouts"));
  setTextByIdForAll("affiliateCommissionEarned", formatCurrency(affiliate.commission_earned || 0));
  setTextByIdForAll("affiliatePendingPayout", formatCurrency(affiliate.pending_payout || 0));
  setTextByIdForAll("affiliateTotalReferrals", String(numberOrZero(affiliate.total_referrals)));
  setTextByIdForAll("affiliateActiveReferrals", String(numberOrZero(affiliate.active_referrals)));
  setTextByIdForAll("affiliateEstimatedMRR", formatCurrency(affiliate.estimated_mrr_commission || 0));
  setTextByIdForAll("affiliatePaidOutAllTime", formatCurrency(affiliate.paid_out_all_time || 0));
  setTextByIdForAll("affiliateInvitedCount", String(numberOrZero(affiliate.invited_referrals ?? affiliate.total_referrals)));
  setTextByIdForAll("affiliateSignedUpCount", String(numberOrZero(affiliate.signed_up_referrals ?? affiliate.total_referrals)));
  setTextByIdForAll("affiliatePayingCount", String(numberOrZero(affiliate.paying_referrals ?? affiliate.active_referrals)));
  setTextByIdForAll("affiliateChurnedCount", String(numberOrZero(affiliate.churned_referrals)));

  const recentWrap = document.getElementById('affiliateRecentReferrals');
  if (recentWrap) {
    const rows = Array.isArray(affiliate.recent_referrals) ? affiliate.recent_referrals : [];
    recentWrap.innerHTML = rows.length
      ? rows.map((row) => `<div><strong>${escapeHtml(cleanText(row.name || row.email || 'Referral'))}</strong> • ${escapeHtml(cleanText(row.status || 'signed_up'))} • ${escapeHtml(cleanText(row.plan || 'Starter'))}<br><span style="color:var(--muted)">${escapeHtml(cleanText(row.email || ''))} • ${formatCurrency(row.estimated_commission || 0)} est.</span></div>`).join('')
      : '<div>No referrals tracked yet.</div>';
  }

  const actionsWrap = document.getElementById('affiliateRecommendedActions');
  if (actionsWrap) {
    const actions = Array.isArray(affiliate.recommended_actions) ? affiliate.recommended_actions : [];
    actionsWrap.innerHTML = actions.length
      ? actions.map((item) => `<div>• ${escapeHtml(cleanText(item))}</div>`).join('')
      : '<div>No actions yet.</div>';
  }
}

function renderPrioritiesPanels() {
  const queues = dashboardSummary?.daily_ops_queues || dashboardSummary?.action_center || {};
  const details = dashboardSummary?.action_center_details || {};
  const prioritiesEl = document.getElementById('todaysPrioritiesPanel');
  if (prioritiesEl) {
    const topLine = [
      `<div><strong>Today:</strong> ${numberOrZero(dashboardSummary?.posts_today)} posts • ${numberOrZero(dashboardSummary?.total_views)} views • ${numberOrZero(dashboardSummary?.total_messages)} messages</div>`,
      `<div><strong>Queue:</strong> ${numberOrZero(dashboardSummary?.queue_count)} ready • <strong>Needs Attention:</strong> ${numberOrZero(dashboardSummary?.needs_action_count)} • <strong>Opportunities:</strong> ${numberOrZero(queues.promote_today)}</div>`
    ].join('');
    prioritiesEl.innerHTML = `${topLine}<div class="section-collapsible"></div>`;
    renderActionCenterList('todaysPrioritiesPanel', details.today, 'No urgent actions right now. Keep posting and monitoring traction.');
  }
  renderActionCenterList('alertsPanel', details.needs_attention, 'No critical items need intervention right now.');
  renderActionCenterList('opportunitiesPanel', details.opportunities, 'No clear opportunities detected yet.');
  const managerSection = document.getElementById('managerInsightsSection');
  const managerEnabled = Boolean(dashboardSummary?.manager_access);
  if (managerSection) managerSection.style.display = managerEnabled ? '' : 'none';
  if (managerEnabled) {
    setTextByIdForAll('managerLiveInventory', String(numberOrZero(dashboardSummary?.manager_summary?.live_inventory)));
    setTextByIdForAll('managerViewToMessageRate', `${numberOrZero(dashboardSummary?.manager_summary?.view_to_message_rate)}%`);
    const segEl = document.getElementById('managerTopSegments');
    if (segEl) {
      const segs = Array.isArray(dashboardSummary?.segment_performance) ? dashboardSummary.segment_performance : [];
      segEl.innerHTML = segs.length ? segs.map((seg) => `<div><strong>${escapeHtml(seg.key || 'Segment')}:</strong> ${numberOrZero(seg.listings)} listings • ${numberOrZero(seg.views)} views • ${numberOrZero(seg.messages)} messages</div>`).join('') : '<div>No segment data yet.</div>';
    }
    const recEl = document.getElementById('managerRecommendations');
    if (recEl) {
      const recs = Array.isArray(dashboardSummary?.manager_recommendations) ? dashboardSummary.manager_recommendations : [];
      recEl.innerHTML = recs.length ? recs.map((item) => `<div>• ${escapeHtml(item)}</div>`).join('') : '<div>No recommendations yet.</div>';
    }
  }
}


function renderAlertsPanel() {
  const wrap = document.getElementById('alertsPanel');
  if (!wrap) return;
  const alerts = Array.isArray(dashboardSummary?.alerts) ? dashboardSummary.alerts : [];
  if (!alerts.length) { wrap.innerHTML = '<div>No active alerts right now.</div>'; return; }
  wrap.innerHTML = alerts.map((alert) => `<div><strong>${escapeHtml(alert.title || 'Alert')}:</strong> ${escapeHtml(alert.message || '')}</div>`).join('');
}

function renderScorecards() {
  const dailyWrap = document.getElementById('dailyScorecardPanel');
  const weeklyWrap = document.getElementById('weeklyScorecardPanel');
  const daily = dashboardSummary?.scorecards?.daily || {};
  const weekly = dashboardSummary?.scorecards?.weekly || {};
  if (dailyWrap) {
    dailyWrap.innerHTML = [`<div><strong>Posts:</strong> ${numberOrZero(daily.posts_today)}</div>`,`<div><strong>Views Est:</strong> ${numberOrZero(daily.views_today_est)}</div>`,`<div><strong>Messages Est:</strong> ${numberOrZero(daily.messages_today_est)}</div>`,`<div><strong>Weak Listings:</strong> ${numberOrZero(daily.weak_listings)}</div>`,`<div><strong>Completion Score:</strong> ${numberOrZero(daily.completion_score)}%</div>`].join('');
  }
  if (weeklyWrap) {
    weeklyWrap.innerHTML = [`<div><strong>7-Day Views:</strong> ${numberOrZero(weekly.views_7d)}</div>`,`<div><strong>7-Day Messages:</strong> ${numberOrZero(weekly.messages_7d)}</div>`,`<div><strong>Views Delta:</strong> ${numberOrZero(weekly.views_delta)}</div>`,`<div><strong>Messages Delta:</strong> ${numberOrZero(weekly.messages_delta)}</div>`,`<div><strong>Activity Delta:</strong> ${numberOrZero(weekly.activity_delta)}</div>`].join('');
  }
}

function renderIntelligencePanels() {
  const intelWrap = document.getElementById('intelligencePanel');
  const oppWrap = document.getElementById('opportunitiesPanel');
  const intelligence = dashboardSummary?.intelligence || {};
  if (intelWrap) {
    const top = Array.isArray(intelligence.top_segments) ? intelligence.top_segments.slice(0, 4) : [];
    const weak = Array.isArray(intelligence.weak_segments) ? intelligence.weak_segments.slice(0, 3) : [];
    const blocks = [];
    if (top.length) blocks.push(`<div><strong>Top Segments</strong></div>${top.map((seg) => `<div>${escapeHtml(seg.key || 'Segment')} • ${numberOrZero(seg.listings)} listings • ${numberOrZero(seg.messages)} messages</div>`).join('')}`);
    if (weak.length) blocks.push(`<div style="margin-top:10px;"><strong>Watch Segments</strong></div>${weak.map((seg) => `<div>${escapeHtml(seg.key || 'Segment')} • weak ${numberOrZero(seg.weak)} • conv ${numberOrZero(seg.conversion_rate)}%</div>`).join('')}`);
    intelWrap.innerHTML = blocks.length ? blocks.join('') : '<div>Intelligence is still building as more listing data comes in.</div>';
  }
  if (oppWrap) {
    const opps = Array.isArray(intelligence.opportunities) ? intelligence.opportunities.slice(0, 5) : [];
    oppWrap.innerHTML = opps.length ? opps.map((seg) => `<div><strong>${escapeHtml(seg.key || 'Segment')}</strong> • ${numberOrZero(seg.views)} views • ${numberOrZero(seg.messages)} messages • ${numberOrZero(seg.conversion_rate)}% conversion</div>`).join('') : '<div>No opportunity clusters detected yet.</div>';
  }
}

async function markListingAction(listingId, status) {
  try {
    await apiFetch('/api/update-listing-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, status })
    });
    await refreshDashboardData?.();
  } catch (error) {
    console.warn('mark listing action warning', error);
  }
}

function renderTopListings(listings) {
  const wrap = document.getElementById("topListings");
  if (!wrap) return;

  const ranked = [...listings]
    .sort((a, b) => numberOrZero(b.popularity_score) - numberOrZero(a.popularity_score))
    .slice(0, 4);

  if (!ranked.length) {
    wrap.innerHTML = `<div class="listing-empty">No listings yet.</div>`;
    return;
  }

  wrap.innerHTML = ranked.map((item, index) => {
    return `
      <div class="top-list-item">
        <div class="top-rank">${index + 1}</div>
        <div class="top-thumb">
          <img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='${escapeHtml(placeholderVehicleImage(item.title))}'" />
        </div>
        <div class="top-info">
          <div class="top-title">${escapeHtml(item.title)}</div>
          <div class="top-sub">${escapeHtml(formatCurrency(item.price))} • ${escapeHtml(formatMileage(item.mileage))}</div>
        </div>
        <div class="top-metrics">
          <div>👁 ${numberOrZero(item.views_count)}</div>
          <div>💬 ${numberOrZero(item.messages_count)}</div>
        </div>
      </div>
    `;
  }).join("");
}

function renderRecentActivity(listings) {
  const wrap = document.getElementById("recentActivityFeed");
  if (!wrap) return;

  const rows = [...listings]
    .sort((a, b) => getTimestamp(b.posted_at) - getTimestamp(a.posted_at))
    .slice(0, 6);

  if (!rows.length) {
    wrap.innerHTML = `<div class="listing-empty">No activity yet.</div>`;
    return;
  }

  wrap.innerHTML = rows.map((item) => {
    return `
      <div class="activity-item">
        <div>
          <div class="activity-item-title">${escapeHtml(item.title)}</div>
          <div class="activity-item-sub">
            ${escapeHtml(item.lifecycle_status || item.status || "posted")} • ${escapeHtml(item.stock_number || item.vin || "No stock/VIN")} • ${escapeHtml(formatCurrency(item.price))}
          </div>
        </div>
        <div class="activity-item-time">${escapeHtml(formatRelativeOrDate(item.posted_at))}</div>
      </div>
    `;
  }).join("");
}

function buildChartSeries() {
  const now = new Date();
  const days = [];

  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push({
      key: toDateKey(d),
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      posts: 0,
      views: 0
    });
  }

  const map = new Map(days.map((d) => [d.key, d]));

  for (const item of dashboardListings) {
    const key = toDateKey(item.posted_at);
    if (!map.has(key)) continue;
    const bucket = map.get(key);
    bucket.posts += 1;
    bucket.views += numberOrZero(item.views_count);
  }

  const labelsWrap = document.getElementById("graphXLabels");
  if (labelsWrap) {
    labelsWrap.innerHTML = days.map((d) => `<div>${escapeHtml(d.label)}</div>`).join("");
  }

  return days;
}

function drawActivityChart(series) {
  const canvas = document.getElementById("activityChart");
  if (!canvas) return;

  const wrap = canvas.parentElement;
  const rect = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  const width = Math.max(300, Math.floor(rect.width));
  const height = Math.max(180, Math.floor(rect.height));

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (!Array.isArray(series) || !series.length) return;

  const padding = { top: 18, right: 18, bottom: 18, left: 18 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxPosts = Math.max(1, ...series.map((d) => numberOrZero(d.posts)));
  const maxViews = Math.max(1, ...series.map((d) => numberOrZero(d.views)));
  const maxValue = Math.max(maxPosts, maxViews);

  const xStep = chartWidth / Math.max(1, series.length - 1);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  const pointsPosts = series.map((d, index) => {
    const x = padding.left + (index * xStep);
    const y = padding.top + chartHeight - ((numberOrZero(d.posts) / maxValue) * chartHeight);
    return { x, y };
  });

  const pointsViews = series.map((d, index) => {
    const x = padding.left + (index * xStep);
    const y = padding.top + chartHeight - ((numberOrZero(d.views) / maxValue) * chartHeight);
    return { x, y };
  });

  ctx.fillStyle = "rgba(212, 175, 55, 0.10)";
  ctx.beginPath();
  ctx.moveTo(pointsViews[0].x, padding.top + chartHeight);
  pointsViews.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pointsViews[pointsViews.length - 1].x, padding.top + chartHeight);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(243, 221, 176, 0.78)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  pointsViews.forEach((p, index) => {
    if (index === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 3;
  ctx.beginPath();
  pointsPosts.forEach((p, index) => {
    if (index === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  ctx.fillStyle = "#d4af37";
  pointsPosts.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

async function pushExtensionProfileSync() {
  try {
    if (!currentUser) return;

    const normalized = currentNormalizedSession || buildFallbackSessionFromLocalState();
    const profileSnapshot = buildExtensionProfileSnapshot(normalized, currentProfile, currentUser);

    persistProfileSnapshots(profileSnapshot, normalized);

    window.postMessage({
      type: "ELEVATE_PROFILE_SYNC",
      payload: normalized
    }, "*");

    window.postMessage({
      type: "ELEVATE_PROFILE_SNAPSHOT",
      payload: profileSnapshot
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
    overview: "Elevate Operator Console",
    profile: "Setup",
    extension: "Tools",
    compliance: "Compliance",
    affiliate: "Partners",
    billing: "Billing",
    tools: "Analytics"
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

    const response = await apiFetch(`/api/profile?id=${encodeURIComponent(userId)}`, {
      method: "GET",
      cache: "no-store"
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(cleanText(result?.error || "Failed to load profile."));
    }

    if (!result?.data) {
      currentProfile = null;
      rerenderCanonicalPanels();
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

    rerenderCanonicalPanels();
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

    const response = await apiFetch("/api/profile", {
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

    persistProfileSnapshots(buildExtensionProfileSnapshot(currentNormalizedSession || buildFallbackSessionFromLocalState(), currentProfile, currentUser), currentNormalizedSession || buildFallbackSessionFromLocalState());
    await refreshDashboardState(true);
    rerenderCanonicalPanels();
    setStatus("profileStatus", "Profile saved successfully.");
  } catch (error) {
    console.error("submitProfileSave error:", error);
    setStatus("profileStatus", `Failed to save profile: ${error.message || "Unknown error"}`);
  }
}

function renderProfileSummary(profile) {
  const summaryEl = document.getElementById("profileSummary");
  if (!summaryEl) return;

  const merged = getCanonicalProfileState(profile);

  if (!merged.full_name && !merged.dealership && !merged.inventory_url && !merged.compliance_mode) {
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
  const canonical = getCanonicalProfileState(profile);
  setTextByIdForAll("complianceProvinceDisplay", canonical.province || "Not set");
  setTextByIdForAll("complianceModeDisplay", canonical.compliance_mode || canonical.province || "Not set");
  setTextByIdForAll("complianceLicenseDisplay", canonical.license_number || "Not set");

  const contactBits = [
    canonical.dealer_phone || canonical.phone || null,
    canonical.dealer_email || null
  ].filter(Boolean);

  setTextByIdForAll("complianceDealerContactDisplay", contactBits.length ? contactBits.join(" • ") : "Not set");
}

async function loadAccountData(user, forceFresh = false) {
  try {
    setStatus("accountStatus", "Loading account data...");
    setStatus("accountStatusBilling", "Loading account data...");
    setStatus("extensionActionStatus", "Loading extension state...");

    let result = null;
    let extensionStateError = "";

    try {
      const url = new URL("/api/extension-state", window.location.origin);
      url.searchParams.set("email", user.email || "");
      if (window.location.hostname) {
        url.searchParams.set("hostname", window.location.hostname);
      }
      if (forceFresh) {
        url.searchParams.set("_ts", String(Date.now()));
      }

      const response = await apiFetch(url.toString(), {
        cache: "no-store"
      });

      if (!response.ok) {
        extensionStateError = `extension-state ${response.status}`;
        console.warn("[dashboard] extension-state unavailable:", response.status);
        setStatus("extensionActionStatus", "Extension state unavailable. Using saved account summary.");
      } else {
        result = await response.json().catch(() => null);
      }
    } catch (innerError) {
      extensionStateError = innerError?.message || String(innerError);
      console.warn("[dashboard] extension-state request failed:", innerError);
      setStatus("extensionActionStatus", "Extension state unavailable. Using saved account summary.");
    }

    if (result) {
      currentAccountData = result || null;
      currentNormalizedSession = normalizeExtensionStateResponse(result, currentUser, currentProfile);
    } else {
      currentAccountData = null;
      currentNormalizedSession = buildFallbackSessionFromLocalState();
    }

    rerenderCanonicalPanels();

    const extensionLoaded = Boolean(result);
    setStatus("accountStatus", extensionLoaded ? "Account data loaded." : "Account data loaded from dashboard summary.");
    setStatus("accountStatusBilling", extensionLoaded ? "Account data loaded." : "Account data loaded from dashboard summary.");
    if (!extensionLoaded && extensionStateError) {
      console.warn("[dashboard] proceeding without extension-state:", extensionStateError);
    } else {
      setStatus("extensionActionStatus", "Extension state loaded.");
    }

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
    setTextByIdForAll("subscriptionStatusBilling", currentNormalizedSession?.subscription?.status || "inactive");
    setTextByIdForAll("affiliateDirectCommission", "20% recurring");
    setTextByIdForAll("affiliateTierOverride", "5% second level");
    setTextByIdForAll("affiliatePartnerType", "Founding Partner");
    setTextByIdForAll("affiliatePayoutStatus", "Manual founder-stage payouts");
    setTextByIdForAll("affiliatePendingPayout", "$0.00");

    const summarySnapshot = dashboardSummary?.account_snapshot || {};
    const access = Boolean(
      currentNormalizedSession?.subscription?.access_granted ??
      currentNormalizedSession?.subscription?.active ??
      summarySnapshot?.access_granted ??
      summarySnapshot?.active ??
      false
    );
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
      rerenderCanonicalPanels();
    }
  } catch (error) {
    console.error("loadAccountData error:", error);
    currentAccountData = null;
    currentNormalizedSession = buildFallbackSessionFromLocalState();
    rerenderCanonicalPanels();
    setStatus("accountStatus", "Failed to load extension-state. Using dashboard summary.");
    setStatus("accountStatusBilling", "Failed to load extension-state. Using dashboard summary.");
    setStatus("extensionActionStatus", "Extension state unavailable. Using saved account summary.");
  }
}

function normalizeExtensionStateResponse(result, user, profile) {
  const raw = result?.session ? result.session : result;

  const subscription = raw?.subscription || {};
  const dealership = raw?.dealership || {};
  const scannerConfig = raw?.scanner_config || {};
  const profileData = raw?.profile || {};
  const rawUser = raw?.user || {};

  const mergedProfile = {
    ...(profile || {}),
    ...(profileData || {})
  };

  const fullName = clean(
    mergedProfile.full_name ||
    mergedProfile.salesperson_name ||
    rawUser.full_name ||
    rawUser.name ||
    ""
  );

  const dealerName = clean(
    mergedProfile.dealership ||
    mergedProfile.dealer_name ||
    dealership.name ||
    dealership.dealer_name ||
    ""
  );

  const rawStatus = clean(subscription.normalized_status || subscription.status || (subscription.active ? "active" : "inactive")) || "inactive";
  const hardNegative = ["canceled", "cancelled", "unpaid", "past_due", "expired", "suspended"].includes(rawStatus.toLowerCase());
  const setupReady = Boolean(
    raw?.meta?.setup_ready ||
    (
      fullName &&
      clean(dealership.inventory_url || mergedProfile.inventory_url || "") &&
      rawUser?.active !== false &&
      dealership?.active !== false
    )
  );
  const founderBridgePlan = ["founder beta", "no plan", ""].includes(clean(subscription.plan || subscription.plan_name || "").toLowerCase());
  const normalizedActive = Boolean(
    subscription.active ||
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    (setupReady && founderBridgePlan && !hardNegative)
  );
  const normalizedPlan = clean(subscription.normalized_plan || subscription.plan || subscription.plan_name || "");
  const normalizedSubscription = {
    active: normalizedActive,
    access_granted: normalizedActive,
    status: clean(rawStatus || (normalizedActive ? "active" : "inactive")) || (normalizedActive ? "active" : "inactive"),
    normalized_status: clean(rawStatus || (normalizedActive ? "active" : "inactive")) || (normalizedActive ? "active" : "inactive"),
    plan: clean(
      (normalizedActive && (!normalizedPlan || normalizedPlan === "No Plan"))
        ? "Founder Beta"
        : (normalizedPlan || "Founder Beta")
    ) || "Founder Beta",
    normalized_plan: clean(
      (normalizedActive && (!normalizedPlan || normalizedPlan === "No Plan"))
        ? "Founder Beta"
        : (normalizedPlan || "Founder Beta")
    ) || "Founder Beta",
    license_key: clean(subscription.license_key || subscription.software_license_key || ""),
    posting_limit: Number(subscription.posting_limit || subscription.daily_posting_limit || 0),
    posts_today: Number(subscription.posts_today || 0),
    posts_remaining: Number(
      subscription.posts_remaining ??
      Math.max(Number(subscription.posting_limit || 0) - Number(subscription.posts_today || 0), 0)
    )
  };

  return {
    user: {
      id: user?.id || rawUser?.id || "",
      email: user?.email || rawUser?.email || "",
      full_name: fullName || ""
    },
    subscription: normalizedSubscription,
    dealership: {
      name: dealerName || "",
      dealer_name: dealerName || "",
      website: clean(dealership.website || mergedProfile.dealer_website || ""),
      inventory_url: clean(dealership.inventory_url || mergedProfile.inventory_url || ""),
      province: clean(dealership.province || mergedProfile.province || ""),
      scanner_type: clean(dealership.scanner_type || mergedProfile.scanner_type || ""),
      phone: clean(dealership.phone || mergedProfile.dealer_phone || ""),
      email: clean(dealership.email || mergedProfile.dealer_email || "")
    },
    scanner_config: {
      scanner_type: clean(scannerConfig.scanner_type || mergedProfile.scanner_type || "")
    },
    profile: {
      full_name: fullName || "",
      salesperson_name: fullName || "",
      dealer_name: dealerName || "",
      dealership: dealerName || "",
      phone: clean(mergedProfile.phone || ""),
      dealer_phone: clean(mergedProfile.dealer_phone || dealership.phone || ""),
      email: clean(user?.email || rawUser?.email || mergedProfile.email || ""),
      dealer_email: clean(mergedProfile.dealer_email || dealership.email || ""),
      city: clean(mergedProfile.city || ""),
      province: clean(mergedProfile.province || dealership.province || ""),
      listing_location: clean(profileData.listing_location || mergedProfile.listing_location || ""),
      compliance_mode: clean(profileData.compliance_mode || mergedProfile.compliance_mode || mergedProfile.province || ""),
      license_number: clean(mergedProfile.license_number || ""),
      dealer_website: clean(mergedProfile.dealer_website || dealership.website || ""),
      inventory_url: clean(mergedProfile.inventory_url || dealership.inventory_url || ""),
      scanner_type: clean(mergedProfile.scanner_type || scannerConfig.scanner_type || dealership.scanner_type || "")
    }
  };
}

function buildFallbackSessionFromLocalState() {
  const summaryProfile = getSummaryProfileSnapshot();
  const fullName = clean(currentProfile?.full_name || summaryProfile.full_name || summaryProfile.salesperson_name || "");
  const dealerName = clean(currentProfile?.dealership || currentProfile?.dealer_name || summaryProfile.dealership || summaryProfile.dealer_name || "");
  const snapshot = dashboardSummary?.account_snapshot || {};
  const dashboardEmail = clean(currentUser?.email || snapshot.email || "").toLowerCase();
  const forceTestingAccess = dashboardEmail === "damian044@icloud.com";
  const snapshotPlan = clean(snapshot.plan || "Founder Beta") || "Founder Beta";
  const configuredLimit = Number(snapshot.posting_limit || snapshot.daily_posting_limit || 0);
  const snapshotLimit = forceTestingAccess ? Math.max(configuredLimit, 25) : configuredLimit;
  const snapshotUsed = Number(snapshot.posts_today ?? snapshot.posts_used_today ?? dashboardSummary?.posts_today ?? 0);
  const snapshotRemaining = Number(snapshot.posts_remaining ?? Math.max(snapshotLimit - snapshotUsed, 0));
  const snapshotActive = Boolean(
    forceTestingAccess ||
    snapshot.access_granted === true ||
    snapshot.active === true ||
    clean(snapshot.status).toLowerCase() === "active" ||
    snapshotLimit > 0
  );
  const snapshotStatus = clean(snapshot.status || (snapshotActive ? "active" : "inactive")) || (snapshotActive ? "active" : "inactive");

  return {
    user: {
      id: currentUser?.id || "",
      email: currentUser?.email || "",
      full_name: fullName || ""
    },
    subscription: {
      active: snapshotActive,
      access_granted: snapshotActive,
      status: snapshotStatus,
      normalized_status: snapshotStatus,
      plan: snapshotPlan,
      normalized_plan: snapshotPlan,
      license_key: currentProfile?.software_license_key || summaryProfile.software_license_key || "",
      posting_limit: snapshotLimit,
      daily_posting_limit: snapshotLimit,
      posts_today: snapshotUsed,
      posts_remaining: snapshotRemaining
    },
    dealership: {
      name: dealerName || "",
      dealer_name: dealerName || "",
      website: currentProfile?.dealer_website || summaryProfile.dealer_website || "",
      inventory_url: currentProfile?.inventory_url || summaryProfile.inventory_url || "",
      province: currentProfile?.province || summaryProfile.province || "",
      scanner_type: currentProfile?.scanner_type || summaryProfile.scanner_type || "",
      phone: currentProfile?.dealer_phone || summaryProfile.dealer_phone || "",
      email: currentProfile?.dealer_email || summaryProfile.dealer_email || ""
    },
    scanner_config: {
      scanner_type: currentProfile?.scanner_type || summaryProfile.scanner_type || ""
    },
    profile: {
      full_name: fullName || "",
      salesperson_name: fullName || "",
      dealer_name: dealerName || "",
      dealership: dealerName || "",
      phone: currentProfile?.phone || summaryProfile.phone || "",
      dealer_phone: currentProfile?.dealer_phone || summaryProfile.dealer_phone || "",
      email: currentUser?.email || "",
      dealer_email: currentProfile?.dealer_email || summaryProfile.dealer_email || "",
      city: currentProfile?.city || summaryProfile.city || "",
      province: currentProfile?.province || summaryProfile.province || "",
      listing_location: currentProfile?.listing_location || summaryProfile.listing_location || "",
      compliance_mode: currentProfile?.compliance_mode || currentProfile?.province || summaryProfile.compliance_mode || summaryProfile.province || "",
      license_number: currentProfile?.license_number || summaryProfile.license_number || "",
      dealer_website: currentProfile?.dealer_website || summaryProfile.dealer_website || "",
      inventory_url: currentProfile?.inventory_url || summaryProfile.inventory_url || "",
      scanner_type: currentProfile?.scanner_type || summaryProfile.scanner_type || ""
    }
  };
}

function buildExtensionProfileSnapshot(session, profile, user) {
  const fallback = buildFallbackSessionFromLocalState();
  const s = session || fallback || {};
  const p = profile || currentProfile || {};

  const fullName = clean(
    s?.profile?.full_name ||
    s?.profile?.salesperson_name ||
    s?.user?.full_name ||
    p?.full_name ||
    ""
  );

  const dealerName = clean(
    s?.profile?.dealer_name ||
    s?.profile?.dealership ||
    s?.dealership?.dealer_name ||
    s?.dealership?.name ||
    p?.dealership ||
    p?.dealer_name ||
    ""
  );

  return {
    full_name: fullName || "",
    salesperson_name: fullName || "",
    dealer_name: dealerName || "",
    dealership: dealerName || "",
    phone: clean(s?.profile?.phone || p?.phone || ""),
    email: clean(s?.profile?.email || user?.email || ""),
    dealer_phone: clean(s?.profile?.dealer_phone || s?.dealership?.phone || p?.dealer_phone || ""),
    dealer_email: clean(s?.profile?.dealer_email || s?.dealership?.email || p?.dealer_email || ""),
    city: clean(s?.profile?.city || p?.city || ""),
    province: clean(s?.profile?.province || s?.dealership?.province || p?.province || ""),
    listing_location: clean(s?.profile?.listing_location || p?.listing_location || ""),
    compliance_mode: clean(s?.profile?.compliance_mode || p?.compliance_mode || p?.province || ""),
    license_number: clean(s?.profile?.license_number || p?.license_number || ""),
    dealer_website: clean(s?.profile?.dealer_website || s?.dealership?.website || p?.dealer_website || ""),
    inventory_url: clean(s?.profile?.inventory_url || s?.dealership?.inventory_url || p?.inventory_url || ""),
    scanner_type: clean(s?.profile?.scanner_type || s?.scanner_config?.scanner_type || s?.dealership?.scanner_type || p?.scanner_type || ""),
    software_license_key: clean(s?.subscription?.license_key || p?.software_license_key || "")
  };
}

function persistProfileSnapshots(profileSnapshot, session) {
  try {
    const safeProfile = profileSnapshot || {};
    const safeSession = session || buildFallbackSessionFromLocalState();

    localStorage.setItem("ea_dashboard_profile_v1", JSON.stringify(safeProfile));
    localStorage.setItem("elevate_profile_snapshot", JSON.stringify(safeProfile));
    localStorage.setItem("ea_profile_snapshot", JSON.stringify(safeProfile));
    localStorage.setItem("ea_user_profile", JSON.stringify(safeProfile));
    localStorage.setItem("ea_account_profile", JSON.stringify(safeProfile));
    localStorage.setItem("elevate_session_snapshot", JSON.stringify(safeSession));
  } catch (error) {
    console.warn("persistProfileSnapshots localStorage warning:", error);
  }
}

function renderSetupSnapshot() {
  const snapshot = dashboardSummary?.account_snapshot || {};
  const setup = dashboardSummary?.setup_status || {};
  const canonicalProfile = getCanonicalProfileState();
  const subscription = getCanonicalSubscriptionState();

  setTextByIdForAll("snapshotPostingLimit", String(Math.max(numberOrZero(snapshot.posting_limit), numberOrZero(subscription.posting_limit))));
  setTextByIdForAll("snapshotPostsRemaining", String(Math.max(numberOrZero(snapshot.posts_remaining), numberOrZero(currentNormalizedSession?.subscription?.posts_remaining))));
  setTextByIdForAll("snapshotPostsUsed", String(Math.max(numberOrZero(snapshot.posts_today ?? snapshot.posts_used_today), numberOrZero(currentNormalizedSession?.subscription?.posts_today), numberOrZero(dashboardSummary?.posts_today))));
  setTextByIdForAll("snapshotBillingSource", clean(currentNormalizedSession?.subscription?.billing_source || snapshot.billing_source || "subscriptions/users") || "subscriptions/users");
  setTextByIdForAll("snapshotCurrentPeriodEnd", formatShortDate(snapshot.current_period_end || currentNormalizedSession?.subscription?.current_period_end || ""));
  setTextByIdForAll("snapshotProfileComplete", setup.profile_complete ? "Ready" : "Needs setup");

  // lifecycle-ready safe no-op ids
  setTextByIdForAll("snapshotReviewQueueCount", String(numberOrZero(dashboardSummary?.review_queue_count)));
  setTextByIdForAll("snapshotStaleListings", String(numberOrZero(dashboardSummary?.stale_listings)));
  setTextByIdForAll("snapshotPriceChanges", String(numberOrZero(dashboardSummary?.review_price_change_count)));
  setTextByIdForAll("snapshotQueuedVehicles", String(numberOrZero(dashboardSummary?.queue_count)));
  setTextByIdForAll("snapshotLifecycleUpdatedAt", formatShortDate(dashboardSummary?.lifecycle_updated_at || ""));

  const summaryBits = Array.isArray(setup.setup_gaps) && setup.setup_gaps.length
    ? setup.setup_gaps
    : [
        setup.salesperson_name_present ? null : "salesperson name missing",
        setup.dealership_name_present ? null : "dealership missing",
        setup.inventory_url_present ? null : "inventory URL missing",
        setup.compliance_mode_present ? null : "compliance mode missing"
      ].filter(Boolean);

  setStatus("snapshotSetupSummary", summaryBits.length ? `Setup gaps: ${summaryBits.join(" • ")}` : "Account setup looks complete for beta use.");
}

function renderAccessState(session) {
  const subscription = getCanonicalSubscriptionState(session);

  setTextByIdForAll("accessBadge", subscription.active ? "Active Access" : "Inactive Access");
  setTextByIdForAll("planName", subscription.plan || "Founder Beta");
  setTextByIdForAll("subscriptionStatus", subscription.status || (subscription.active ? "active" : "inactive"));

  document.querySelectorAll("#accessBadge").forEach((el) => {
    el.classList.remove("active", "inactive", "warn");
    el.classList.add(subscription.active ? "active" : "inactive");
  });
}

function renderExtensionControl(session, profile) {
  const mergedProfile = getCanonicalProfileState(profile, session);
  const subscription = getCanonicalSubscriptionState(session);
  const dealerWebsite = mergedProfile.dealer_website || "Not set";
  const inventoryUrl = mergedProfile.inventory_url || "Not set";
  const scannerType = mergedProfile.scanner_type || "Not set";
  const listingLocation = mergedProfile.listing_location || "Not set";
  const complianceMode = mergedProfile.compliance_mode || mergedProfile.province || "Not set";

  setTextByIdForAll("extensionRemainingPosts", String(numberOrZero(subscription.posts_remaining)));
  setTextByIdForAll("extensionScannerType", scannerType);
  setTextByIdForAll("extensionDealerWebsite", dealerWebsite);
  setTextByIdForAll("extensionInventoryUrl", inventoryUrl);
  setTextByIdForAll("extensionListingLocation", listingLocation);
  setTextByIdForAll("extensionComplianceMode", complianceMode);
  setTextByIdForAll("extensionPlan", subscription.plan || "Founder Beta");
  setTextByIdForAll("extensionPostsUsed", String(numberOrZero(subscription.posts_today)));
  setTextByIdForAll("extensionPostLimit", String(numberOrZero(subscription.posting_limit)));
  const postingUsageFound = Boolean(dashboardSummary?.ingest_debug?.posting_usage_row_found);
  const postingUsageUpdatedAt = cleanText(dashboardSummary?.ingest_debug?.posting_usage_updated_at);
  const syncStatusText = postingUsageFound
    ? `Backend sync live${postingUsageUpdatedAt ? ` • ${new Date(postingUsageUpdatedAt).toLocaleString()}` : ""}`
    : "No committed post sync yet";
  setTextByIdForAll("extensionSyncStatus", syncStatusText);
  setTextByIdForAll("extensionCommittedRows", String(numberOrZero(dashboardSummary?.ingest_debug?.listing_rows_found)));
  setTextByIdForAll("extensionViewsTracked", String(numberOrZero(dashboardSummary?.total_views)));
  setTextByIdForAll("extensionMessagesTracked", String(numberOrZero(dashboardSummary?.total_messages)));
  setTextByIdForAll("extensionReviewQueue", String(numberOrZero(dashboardSummary?.review_queue_count)));
  setTextByIdForAll("extensionStaleListings", String(numberOrZero(dashboardSummary?.stale_listings)));

  const accessText = !subscription.active
    ? "Inactive Access"
    : numberOrZero(subscription.posts_remaining) <= 0
      ? "Limit Reached"
      : "Active Access";

  setTextByIdForAll("extensionAccessState", accessText);
}

function updateSetupStates(profile, session) {
  const setup = dashboardSummary?.setup_status || {};
  const mergedProfile = getCanonicalProfileState(profile, session);
  const subscription = getCanonicalSubscriptionState(session);

  const websiteReady = Boolean(setup.dealer_website_present || mergedProfile.dealer_website);
  const inventoryReady = Boolean(setup.inventory_url_present || mergedProfile.inventory_url);
  const scannerReady = Boolean(setup.scanner_type_present || mergedProfile.scanner_type);
  const listingReady = Boolean(setup.listing_location_present || mergedProfile.listing_location);
  const complianceReady = Boolean(setup.compliance_mode_present || mergedProfile.compliance_mode || mergedProfile.province);
  const accessReady = Boolean(subscription.active);

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
  const profile = getCanonicalProfileState();
  const session = currentNormalizedSession || buildFallbackSessionFromLocalState();
  const subscription = getCanonicalSubscriptionState(session);

  return [
    "Elevate Automation Setup",
    "",
    `Access: ${subscription.active ? "Active" : "Inactive"}`,
    `Plan: ${subscription.plan || "Founder Beta"}`,
    `Dealer Website: ${profile.dealer_website || "Not set"}`,
    `Inventory URL: ${profile.inventory_url || "Not set"}`,
    `Scanner Type: ${profile.scanner_type || "Not set"}`,
    `Listing Location: ${profile.listing_location || "Not set"}`,
    `Compliance Mode: ${profile.compliance_mode || profile.province || "Not set"}`,
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
    await apiFetch("/api/sync-user", {
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

async function markListingSold(listingId) {
  try {
    const row = dashboardListings.find((item) => item.id === listingId);
    if (!row) return;

    row.status = "sold";

    const response = await apiFetch("/api/update-listing-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        listingId,
        status: "sold",
        userId: currentUser?.id || "",
        email: currentUser?.email || ""
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Could not update listing status.");
    }

    await loadListingDashboardData(true);
    setStatus("listingGridStatus", "Listing marked sold.");
  } catch (error) {
    console.error("markListingSold error:", error);
    setStatus("listingGridStatus", error.message || "Could not mark listing sold.");
  }
}

function copyVehicleSummary(listingId) {
  const row = dashboardListings.find((item) => item.id === listingId);
  if (!row) return;

  const text = [
    row.title,
    `Price: ${formatCurrency(row.price)}`,
    `Mileage: ${formatMileage(row.mileage)}`,
    `VIN: ${row.vin || "Not set"}`,
    `Stock: ${row.stock_number || "Not set"}`,
    `Posted: ${formatShortDate(row.posted_at)}`,
    `Lifecycle: ${row.lifecycle_status || row.status || "posted"}`
  ].join("\n");

  navigator.clipboard.writeText(text)
    .then(() => setStatus("listingGridStatus", "Vehicle summary copied."))
    .catch(() => setStatus("listingGridStatus", "Could not copy vehicle summary."));
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

function pushBootStage(stage, detail) {
  const line = `${stage}: ${detail}`;
  bootStages.push(line);
  bootStages = bootStages.slice(-5);
  setBootStatus(bootStages.join("  |  "));
}

async function resolveExtensionDownloadUrl() {
  try {
    const response = await fetch(EXTENSION_DOWNLOAD_URL, { method: "HEAD", cache: "no-store" });
    if (response.ok) return EXTENSION_DOWNLOAD_URL;
  } catch (error) {
    console.warn("resolveExtensionDownloadUrl fallback:", error);
  }
  return EXTENSION_FALLBACK_URL;
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

function formatCurrency(value) {
  const n = numberOrZero(value);
  if (!n) return "$0";
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0
    }).format(n);
  } catch {
    return `$${n.toLocaleString()}`;
  }
}

function formatMileage(value) {
  const n = numberOrZero(value);
  if (!n) return "Not set";
  return `${n.toLocaleString()} km`;
}

function buildVehicleTitle(item) {
  return [item.year || "", item.make || "", item.model || "", item.trim || ""]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function buildListingSubtitle(item) {
  const parts = [];
  if (item.stock_number) parts.push(`Stock ${item.stock_number}`);
  if (item.vin) parts.push(`VIN ${item.vin}`);
  if (item.body_style) parts.push(item.body_style);
  if (item.lifecycle_status) parts.push(item.lifecycle_status);
  return parts.join(" • ") || "Vehicle details";
}

function renderBadgeHtml(status, lifecycleStatus = "") {
  const normalized = clean(status || "posted").toLowerCase();
  const lifecycle = clean(lifecycleStatus || "").toLowerCase();

  if (lifecycle === "stale") {
    return `<span class="badge warn">Stale</span>`;
  }
  if (lifecycle === "review_delete") {
    return `<span class="badge warn">Review Delete</span>`;
  }
  if (lifecycle === "review_price_update") {
    return `<span class="badge warn">Review Price</span>`;
  }
  if (lifecycle === "review_new") {
    return `<span class="badge active">Review New</span>`;
  }

  let badgeClass = "warn";
  let badgeText = normalized || "posted";

  if (normalized === "active" || normalized === "posted") {
    badgeClass = "active";
    badgeText = normalized === "posted" ? "Posted" : "Active";
  } else if (normalized === "sold") {
    badgeClass = "sold";
    badgeText = "Sold";
  } else if (normalized === "inactive" || normalized === "failed" || normalized === "deleted") {
    badgeClass = "inactive";
  }

  return `<span class="badge ${badgeClass}">${escapeHtml(badgeText)}</span>`;
}

function formatShortDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function formatRelativeOrDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  const diffMs = Date.now() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatShortDate(value);
}

function toDateKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTimestamp(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function placeholderVehicleImage(label) {
  const text = encodeURIComponent(clean(label || "Vehicle"));
  return `https://placehold.co/800x500/111111/d4af37?text=${text}`;
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeJs(str) {
  return String(str || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', '\\"');
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function debounce(fn, wait = 150) {
  let timeout = null;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

function cryptoRandomFallback() {
  try {
    return crypto.randomUUID();
  } catch {
    return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

window.markListingSold = markListingSold;
window.copyVehicleSummary = copyVehicleSummary;

window.trackListingView = trackListingView;
window.trackListingMessage = trackListingMessage;
window.openListingSource = openListingSource;

window.markListingAction = markListingAction;

window.openListingDetailModal = openListingDetailModal;
window.showSection = showSection;
