(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.profile) return;

  const FIELD_IDS = {
    full_name: ["full_name", "profile_full_name", "salesperson_name"],
    phone: ["phone", "profile_phone", "salesperson_phone"],
    email: ["display_email", "dealer_email", "email", "profile_email"],
    dealership: ["dealership", "dealership_name", "dealer_name", "company"],
    city: ["city", "profile_city"],
    province: ["province", "profile_province"],
    dealer_phone: ["dealer_phone"],
    dealer_email: ["dealer_email", "display_email"],
    dealer_website: ["dealer_website", "dealership_website", "website"],
    inventory_url: ["inventory_url", "inventoryUrl"],
    scanner_type: ["scanner_type", "scannerType"],
    listing_location: ["listing_location", "location", "listing_city"],
    license_number: ["license_number", "licenseNumber"],
    compliance_mode: ["compliance_mode", "complianceMode"],
    booking_link: ["booking_link"],
    instagram_handle: ["instagram_handle"],
    primary_cta: ["primary_cta"],
    default_seller_name: ["default_seller_name"],
    active_disclaimer: ["active_disclaimer"],
    logo_url: ["logo_url"],
    trades_welcome: ["trades_welcome"],
    financing_cta: ["financing_cta"],
    delivery_available: ["delivery_available"],
    carfax_mention: ["carfax_mention"]
  };

  const FIELD_LABELS = {
    full_name: ["full name", "salesperson name", "name"],
    phone: ["phone", "your phone", "salesperson phone"],
    email: ["email", "display email"],
    dealership: ["dealership / company", "dealership", "company", "dealer name"],
    city: ["city"],
    province: ["province"],
    dealer_phone: ["dealer phone"],
    dealer_email: ["dealer email"],
    dealer_website: ["dealer website", "website", "dealership website"],
    inventory_url: ["inventory url", "inventory"],
    scanner_type: ["scanner type", "scanner"],
    listing_location: ["listing location", "location"],
    license_number: ["license number", "license"],
    compliance_mode: ["compliance mode", "compliance"],
    booking_link: ["booking link"],
    instagram_handle: ["instagram handle", "instagram"],
    primary_cta: ["primary cta", "cta"],
    default_seller_name: ["default seller name"],
    active_disclaimer: ["active disclaimer", "disclaimer"],
    logo_url: ["logo url", "logo"],
    trades_welcome: ["trades welcome"],
    financing_cta: ["financing cta", "financing"],
    delivery_available: ["delivery available", "delivery"],
    carfax_mention: ["carfax mention", "carfax"]
  };

  const REQUIRED_SETUP_FIELDS = {
    salesperson_name_present: ["salesperson name", "salesperson", "full name", "name"],
    dealership_name_present: ["dealership", "dealer name"],
    inventory_url_present: ["inventory url", "inventory"],
    compliance_mode_present: ["compliance", "province mode"],
    dealer_website_present: ["dealer website", "website"],
    scanner_type_present: ["scanner", "scanner type"],
    listing_location_present: ["listing location", "location", "city"]
  };

  let currentProfile = null;
  let currentSetupFields = null;
  let saveBound = false;
  let lifecycleBound = false;
  let loadingPromise = null;
  let saving = false;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function findById(id) {
    return document.getElementById(id) || document.querySelector(`[name="${id}"]`) || null;
  }

  function findFieldByLabel(fieldName) {
    const labels = FIELD_LABELS[fieldName] || [];
    if (!labels.length) return null;
    const nodes = Array.from(document.querySelectorAll("label, .field label, .setup label"));
    for (const node of nodes) {
      const text = lower(node.textContent || "");
      if (!text) continue;
      if (!labels.some((label) => text.includes(label))) continue;
      const fieldWrap = node.closest(".field, .form-group, .input-group, .setup-field") || node.parentElement;
      const selector = 'input, select, textarea';
      let input = null;
      const forId = clean(node.getAttribute?.("for") || "");
      if (forId) input = document.getElementById(forId);
      if (!input && fieldWrap) input = fieldWrap.querySelector(selector);
      if (!input) input = node.parentElement?.querySelector?.(selector) || null;
      if (input) return input;
    }
    return null;
  }

  function findFieldElement(fieldName) {
    const ids = FIELD_IDS[fieldName] || [fieldName];
    for (const id of ids) {
      const el = findById(id);
      if (el) return el;
    }
    return findFieldByLabel(fieldName);
  }

  function setFieldValue(fieldName, value) {
    const el = findFieldElement(fieldName);
    if (!el) return false;
    if (el.type === "checkbox") {
      el.checked = !!value;
    } else {
      el.value = value == null ? "" : String(value);
      try {
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } catch {}
    }
    return true;
  }

  function getFieldValue(fieldName, fallback = "") {
    const el = findFieldElement(fieldName);
    if (!el) return fallback;
    if (el.type === "checkbox") return !!el.checked;
    return clean(el.value || fallback);
  }

  function setTextByCandidates(ids, value) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    }
  }

  function setSidebarValueByLabel(labelMatchers, value) {
    const labels = Array.from(document.querySelectorAll('.sidebar-card-label'));
    for (const label of labels) {
      const text = lower(label.textContent || '');
      if (!labelMatchers.some((matcher) => text.includes(matcher))) continue;
      const card = label.closest('.sidebar-card');
      const valueNode = card?.querySelector('.sidebar-card-value');
      if (valueNode) valueNode.textContent = value;
    }
  }

  function ensureStatusBox() {
    let status = document.getElementById("dashboardProfileStatus");
    if (status) return status;

    const anchor = document.querySelector(".profile-summary") || document.querySelector("#setup .card") || document.querySelector("#setupSection .card") || document.querySelector(".dashboard-section .card");
    if (!anchor) return null;

    status = document.createElement("div");
    status.id = "dashboardProfileStatus";
    status.style.marginTop = "12px";
    status.style.padding = "12px 14px";
    status.style.borderRadius = "12px";
    status.style.border = "1px solid rgba(212,175,55,0.16)";
    status.style.background = "#161616";
    status.style.fontSize = "14px";
    status.style.lineHeight = "1.5";
    status.style.color = "#f3f3f3";
    anchor.prepend(status);
    return status;
  }

  function showStatus(message, tone = "info") {
    const box = ensureStatusBox();
    if (!box) return;
    box.textContent = message;
    if (tone === "success") {
      box.style.borderColor = "rgba(157,232,168,0.22)";
      box.style.color = "#9de8a8";
      box.style.background = "rgba(46,125,50,0.12)";
    } else if (tone === "error") {
      box.style.borderColor = "rgba(255,180,180,0.24)";
      box.style.color = "#ffb4b4";
      box.style.background = "rgba(120,20,20,0.16)";
    } else {
      box.style.borderColor = "rgba(212,175,55,0.16)";
      box.style.color = "#f3f3f3";
      box.style.background = "#161616";
    }
  }

  function buildProfileSummaryHtml(profile = {}) {
    const rows = [
      ["Name", profile.full_name || "—"],
      ["Dealership", profile.dealership || "—"],
      ["Phone", profile.phone || "—"],
      ["Dealer Email", profile.dealer_email || profile.email || "—"],
      ["Dealer Website", profile.dealer_website || "—"],
      ["Inventory URL", profile.inventory_url || "—"],
      ["Scanner", profile.scanner_type || "—"],
      ["Location", [profile.city, profile.province].filter(Boolean).join(", ") || profile.listing_location || "—"],
      ["Compliance", profile.compliance_mode || "—"]
    ];
    return rows.map(([label, value]) => `<div><strong>${label}:</strong> ${String(value)}</div>`).join("");
  }

  function renderProfileSummary(profile = {}) {
    const summary = document.querySelector(".profile-summary") || document.getElementById("profileSummary");
    if (!summary) return;
    summary.innerHTML = buildProfileSummaryHtml(profile);
  }

  function setSetupStateChip(chip, ok) {
    chip.textContent = ok ? "Complete" : "Missing";
    chip.classList.remove("good", "warn");
    chip.classList.add(ok ? "good" : "warn");
  }

  function renderSetupFields(setupFields = {}) {
    currentSetupFields = setupFields;
    const items = Array.from(document.querySelectorAll(".setup-item"));
    for (const item of items) {
      const label = lower(item.querySelector(".setup-item-label")?.textContent || item.textContent || "");
      const state = item.querySelector(".setup-state") || item.querySelector("[class*='setup-state']");
      if (!state) continue;
      for (const [key, matchers] of Object.entries(REQUIRED_SETUP_FIELDS)) {
        if (matchers.some((matcher) => label.includes(matcher))) {
          setSetupStateChip(state, !!setupFields[key]);
          break;
        }
      }
    }

    const total = Math.max(Object.keys(REQUIRED_SETUP_FIELDS).length, 1);
    const percent = Math.round((Object.values(setupFields).filter(Boolean).length / total) * 100);
    setTextByCandidates(["setupProgressValue", "setupPercentValue", "overviewSetupChip"], `${percent}%`);
  }

  function populateForm(profile = {}) {
    currentProfile = profile;
    setFieldValue("full_name", profile.full_name || "");
    setFieldValue("phone", profile.phone || profile.dealer_phone || "");
    setFieldValue("email", profile.dealer_email || profile.email || "");
    setFieldValue("dealership", profile.dealership || "");
    setFieldValue("city", profile.city || "");
    setFieldValue("province", profile.province || "");
    setFieldValue("dealer_phone", profile.dealer_phone || profile.phone || "");
    setFieldValue("dealer_email", profile.dealer_email || profile.email || "");
    setFieldValue("dealer_website", profile.dealer_website || "");
    setFieldValue("inventory_url", profile.inventory_url || "");
    setFieldValue("scanner_type", profile.scanner_type || "");
    setFieldValue("listing_location", profile.listing_location || profile.city || "");
    setFieldValue("license_number", profile.license_number || "");
    setFieldValue("compliance_mode", profile.compliance_mode || "");
    setFieldValue("booking_link", profile.booking_link || "");
    setFieldValue("instagram_handle", profile.instagram_handle || "");
    setFieldValue("primary_cta", profile.primary_cta || "");
    setFieldValue("default_seller_name", profile.default_seller_name || profile.full_name || "");
    setFieldValue("active_disclaimer", profile.active_disclaimer || "");
    setFieldValue("logo_url", profile.logo_url || "");
    setFieldValue("trades_welcome", profile.trades_welcome ?? true);
    setFieldValue("financing_cta", profile.financing_cta ?? true);
    setFieldValue("delivery_available", profile.delivery_available ?? false);
    setFieldValue("carfax_mention", profile.carfax_mention ?? true);

    renderProfileSummary(profile);
    setTextByCandidates(["sessionEmail", "profileEmailValue"], profile.email || "—");
    setTextByCandidates(["profileRecordStatus"], "Loaded");
    setTextByCandidates(["dealershipContext"], [profile.dealership, profile.city].filter(Boolean).join(" • ") || "—");
    setTextByCandidates(["complianceContext"], [profile.province, profile.compliance_mode].filter(Boolean).join(" • ") || "—");
    setSidebarValueByLabel(["logged in", "session", "email"], profile.email || "—");
    setSidebarValueByLabel(["company", "dealership"], profile.dealership || "—");
  }

  function collectPayload() {
    return {
      full_name: getFieldValue("full_name", currentProfile?.full_name || ""),
      phone: getFieldValue("phone", currentProfile?.phone || ""),
      dealership: getFieldValue("dealership", currentProfile?.dealership || ""),
      city: getFieldValue("city", currentProfile?.city || ""),
      province: getFieldValue("province", currentProfile?.province || ""),
      dealer_phone: getFieldValue("dealer_phone", currentProfile?.dealer_phone || ""),
      dealer_email: getFieldValue("dealer_email", currentProfile?.dealer_email || currentProfile?.email || ""),
      dealer_website: getFieldValue("dealer_website", currentProfile?.dealer_website || ""),
      inventory_url: getFieldValue("inventory_url", currentProfile?.inventory_url || ""),
      scanner_type: getFieldValue("scanner_type", currentProfile?.scanner_type || ""),
      listing_location: getFieldValue("listing_location", currentProfile?.listing_location || currentProfile?.city || ""),
      license_number: getFieldValue("license_number", currentProfile?.license_number || ""),
      compliance_mode: getFieldValue("compliance_mode", currentProfile?.compliance_mode || ""),
      booking_link: getFieldValue("booking_link", currentProfile?.booking_link || ""),
      instagram_handle: getFieldValue("instagram_handle", currentProfile?.instagram_handle || ""),
      primary_cta: getFieldValue("primary_cta", currentProfile?.primary_cta || ""),
      default_seller_name: getFieldValue("default_seller_name", currentProfile?.default_seller_name || currentProfile?.full_name || ""),
      active_disclaimer: getFieldValue("active_disclaimer", currentProfile?.active_disclaimer || ""),
      logo_url: getFieldValue("logo_url", currentProfile?.logo_url || ""),
      trades_welcome: !!getFieldValue("trades_welcome", currentProfile?.trades_welcome ?? true),
      financing_cta: !!getFieldValue("financing_cta", currentProfile?.financing_cta ?? true),
      delivery_available: !!getFieldValue("delivery_available", currentProfile?.delivery_available ?? false),
      carfax_mention: !!getFieldValue("carfax_mention", currentProfile?.carfax_mention ?? true)
    };
  }

  function discoverSaveButtons() {
    const explicit = ["saveProfileBtn", "saveSetupBtn", "saveTopBtn", "saveBottomBtn"].map((id) => document.getElementById(id)).filter(Boolean);
    const fuzzy = Array.from(document.querySelectorAll("button")).filter((button) => {
      const text = lower(button.textContent || "");
      return text.includes("save profile") || text.includes("save setup") || text === "save";
    });
    return [...new Set([...explicit, ...fuzzy])];
  }

  function setSaveButtonsBusy(isBusy) {
    for (const button of discoverSaveButtons()) {
      button.disabled = isBusy;
      if (button.dataset.originalLabel == null) button.dataset.originalLabel = clean(button.textContent || "Save");
      button.textContent = isBusy ? "Saving..." : (button.dataset.originalLabel || "Save");
    }
  }

  async function waitForAuthReady(maxAttempts = 8, delayMs = 450) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const token = await NS.api.getAuthAccessToken();
      if (token) return token;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return "";
  }

  async function requestProfile(method = "GET", body = null, attempts = 4) {
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      await waitForAuthReady(Math.min(3, attempt + 1), 350);
      const response = await NS.api.apiFetch("/api/profile", {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      const result = await NS.api.parseJsonSafe(response);
      if (response.ok) return result;
      lastError = new Error(result?.error || `${method} /api/profile failed`);
      const message = lower(lastError.message);
      const retryable = response.status === 401 || response.status === 403 || message.includes("unauthorized") || message.includes("jwt") || message.includes("session");
      if (!retryable || attempt === attempts) throw lastError;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
    throw lastError || new Error("Profile request failed.");
  }

  async function loadProfile() {
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
      showStatus("Loading saved profile...", "info");
      const result = await requestProfile("GET", null, 5);
      const profile = result?.profile || result?.data?.profile || null;
      const setupFields = result?.setup_fields || result?.data?.setup_fields || null;
      if (profile) populateForm(profile);
      if (setupFields) renderSetupFields(setupFields);
      if (profile) {
        showStatus("Saved profile loaded.", "success");
      } else {
        showStatus("No saved profile found yet. Complete setup and save.", "info");
      }
      return { profile, setupFields };
    })().finally(() => {
      loadingPromise = null;
    });
    return loadingPromise;
  }

  async function saveProfile() {
    if (saving) return;
    saving = true;
    setSaveButtonsBusy(true);
    showStatus("Saving profile...", "info");
    try {
      const payload = collectPayload();
      const result = await requestProfile("POST", payload, 5);
      const profile = result?.profile || result?.data?.profile || currentProfile || payload;
      const setupFields = result?.setup_fields || result?.data?.setup_fields || currentSetupFields || null;
      populateForm(profile);
      if (setupFields) renderSetupFields(setupFields);
      try {
        window.dispatchEvent(new CustomEvent("elevate:account-truth", { detail: { profile_saved: true } }));
      } catch {}
      showStatus("Profile saved successfully.", "success");
    } catch (error) {
      console.error("[dashboard-profile] save error:", error);
      showStatus(error?.message || "Failed to save profile.", "error");
    } finally {
      saving = false;
      setSaveButtonsBusy(false);
    }
  }

  function bindSaveButtons() {
    if (saveBound) return;
    saveBound = true;
    for (const button of discoverSaveButtons()) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        saveProfile();
      });
    }
  }

  function bindLifecycle() {
    if (lifecycleBound) return;
    lifecycleBound = true;
    document.addEventListener("click", () => bindSaveButtons(), { passive: true });
    window.addEventListener("elevate:account-truth", () => {
      if (!currentProfile && !loadingPromise) {
        loadProfile().catch((error) => console.warn("[dashboard-profile] reload warning:", error));
      }
    });
  }

  function mount() {
    bindSaveButtons();
    bindLifecycle();
    loadProfile().catch((error) => {
      console.error("[dashboard-profile] load error:", error);
      showStatus(error?.message || "Failed to load saved profile.", "error");
    });
    return true;
  }

  NS.profile = { mount, loadProfile, saveProfile };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }

  NS.modules = NS.modules || {};
  NS.modules.profile = true;
})();
