// /profile.js
// Elevate Automation Profile Module
// Uses the existing Supabase auth session + /api/profile backend route
// Persists supported profile fields to Supabase and keeps newer UI-only fields in local storage

(function () {
  const SUPABASE_URL =
    window.__ELEVATE_SUPABASE_URL ||
    "https://teixblbxkoershwgqpym.supabase.co";

  const SUPABASE_ANON_KEY =
    window.__ELEVATE_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaXhibGJ4a29lcnNod2dxcHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODUzMDMsImV4cCI6MjA4ODY2MTMwM30.wxt9zjKhsBuflaFZZT9awZiwckRzYkEl-OLm_4q8qF4";

  const els = {};
  let supabaseClient = null;
  let currentUser = null;
  let currentProfile = null;
  let isSaving = false;

  const EXTRA_PROFILE_PREFIX = "ea_profile_extras_v1_";

  function $(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    [
      "full_name",
      "phone",
      "display_email",
      "booking_link",
      "instagram_handle",
      "primary_cta",
      "dealership_name",
      "dealership_website",
      "city",
      "province",
      "logo_url",
      "default_seller_name",
      "compliance_mode",
      "active_disclaimer",
      "trades_welcome",
      "financing_cta",
      "delivery_available",
      "carfax_mention",
      "saveTopBtn",
      "saveBottomBtn",
      "statusBox",
      "sessionEmail",
      "profileRecordStatus",
      "complianceContext",
      "dealershipContext"
    ].forEach((id) => {
      els[id] = $(id);
    });
  }

  function ensureSupabaseClient() {
    if (window.supabaseClient) {
      supabaseClient = window.supabaseClient;
      return supabaseClient;
    }

    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase CDN client is not loaded.");
    }

    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

    window.supabaseClient = supabaseClient;
    window.__ELEVATE_SUPABASE_URL = SUPABASE_URL;
    window.__ELEVATE_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

    return supabaseClient;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function extrasStorageKey(userId) {
    return `${EXTRA_PROFILE_PREFIX}${userId || "guest"}`;
  }

  function getExtraProfile() {
    if (!currentUser?.id) return {};

    try {
      const raw = localStorage.getItem(extrasStorageKey(currentUser.id));
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.error("[profile] extras load error:", error);
      return {};
    }
  }

  function setExtraProfile(value) {
    if (!currentUser?.id) return;

    try {
      localStorage.setItem(
        extrasStorageKey(currentUser.id),
        JSON.stringify(value || {})
      );
    } catch (error) {
      console.error("[profile] extras save error:", error);
    }
  }

  function showStatus(message, type = "info") {
    if (!els.statusBox) return;

    els.statusBox.className = "status show";
    if (type === "success") els.statusBox.classList.add("success");
    if (type === "error") els.statusBox.classList.add("error");
    els.statusBox.innerHTML = escapeHtml(message);
  }

  function clearStatus() {
    if (!els.statusBox) return;
    els.statusBox.className = "status";
    els.statusBox.textContent = "";
  }

  function setSavingState(isBusy) {
    isSaving = !!isBusy;
    const label = isBusy ? "Saving..." : "Save Profile";

    if (els.saveTopBtn) {
      els.saveTopBtn.disabled = isBusy;
      els.saveTopBtn.textContent = label;
    }

    if (els.saveBottomBtn) {
      els.saveBottomBtn.disabled = isBusy;
      els.saveBottomBtn.textContent = label;
    }
  }

  function getCheckbox(id, fallback = false) {
    return !!(els[id] ? els[id].checked : fallback);
  }

  function setCheckbox(id, value) {
    if (els[id]) {
      els[id].checked = !!value;
    }
  }

  function getValue(id, fallback = "") {
    return els[id] ? clean(els[id].value) : fallback;
  }

  function setValue(id, value) {
    if (els[id]) {
      els[id].value = value == null ? "" : String(value);
    }
  }

  function provinceShortName(province) {
    const map = {
      alberta: "AB",
      "british columbia": "BC",
      saskatchewan: "SK",
      ontario: "ON"
    };
    return map[lower(province)] || clean(province);
  }

  function buildDefaultDisclaimer() {
    const province = getValue("province", "Alberta");
    const fullName = getValue("full_name");
    const dealership = getValue("dealership_name");
    const phone = getValue("phone");
    const city = getValue("city");
    const provinceCode = provinceShortName(province);

    const sellerPart = fullName ? `Contact ${fullName}` : "Contact our team";
    const dealerPart = dealership ? ` at ${dealership}` : "";
    const phonePart = phone ? ` at ${phone}` : "";
    const locationPart =
      city && provinceCode ? ` in ${city}, ${provinceCode}` : "";

    if (lower(province) === "british columbia") {
      return `${sellerPart}${dealerPart}${phonePart}${locationPart} for current pricing, availability, financing options, trade appraisal information, and full vehicle details. Dealer fees, taxes, and licensing may apply.`;
    }

    if (lower(province) === "alberta") {
      return `AMVIC-compliant dealer listing. ${sellerPart}${dealerPart}${phonePart}${locationPart} for current pricing, availability, financing options, and trade appraisal information. Dealer fees, taxes, and licensing may apply.`;
    }

    return `${sellerPart}${dealerPart}${phonePart}${locationPart} for current pricing, availability, financing options, trade appraisal information, and full vehicle details. Dealer fees, taxes, and licensing may apply.`;
  }

  function maybeRefreshDefaultDisclaimer(force) {
    const current = getValue("active_disclaimer");
    if (!current || force) {
      setValue("active_disclaimer", buildDefaultDisclaimer());
    }
  }

  function populateAccountContext() {
    if (els.sessionEmail) {
      els.sessionEmail.textContent = currentUser?.email || "-";
    }

    const province = getValue("province", currentProfile?.province || "Alberta");
    const mode = getValue(
      "compliance_mode",
      currentProfile?.compliance_mode || "strict"
    );
    const dealership = getValue(
      "dealership_name",
      currentProfile?.dealership || ""
    );
    const city = getValue("city", currentProfile?.city || "");

    if (els.profileRecordStatus) {
      els.profileRecordStatus.textContent = currentProfile
        ? "Loaded"
        : "Not saved yet";
    }

    if (els.complianceContext) {
      const label = `${provinceShortName(province)} • ${mode || "strict"}`;
      els.complianceContext.textContent = label;
    }

    if (els.dealershipContext) {
      els.dealershipContext.textContent =
        [dealership, city].filter(Boolean).join(" • ") || "-";
    }
  }

  function populateForm(profile, extras) {
    currentProfile = profile || null;

    setValue("full_name", profile?.full_name || "");
    setValue("phone", profile?.phone || profile?.dealer_phone || "");
    setValue("display_email", profile?.dealer_email || profile?.email || currentUser?.email || "");
    setValue("dealership_name", profile?.dealership || "");
    setValue("dealership_website", profile?.dealer_website || "");
    setValue("city", profile?.city || profile?.listing_location || "");
    setValue("province", profile?.province || "Alberta");
    setValue("compliance_mode", profile?.compliance_mode || "strict");

    setValue("booking_link", extras?.booking_link || "");
    setValue("instagram_handle", extras?.instagram_handle || "");
    setValue("primary_cta", extras?.primary_cta || "");
    setValue("logo_url", extras?.logo_url || "");
    setValue(
      "default_seller_name",
      extras?.default_seller_name || profile?.full_name || ""
    );
    setValue("active_disclaimer", extras?.active_disclaimer || "");

    setCheckbox(
      "trades_welcome",
      typeof extras?.trades_welcome === "boolean" ? extras.trades_welcome : true
    );
    setCheckbox(
      "financing_cta",
      typeof extras?.financing_cta === "boolean" ? extras.financing_cta : true
    );
    setCheckbox(
      "delivery_available",
      typeof extras?.delivery_available === "boolean"
        ? extras.delivery_available
        : false
    );
    setCheckbox(
      "carfax_mention",
      typeof extras?.carfax_mention === "boolean" ? extras.carfax_mention : true
    );

    maybeRefreshDefaultDisclaimer(false);
    populateAccountContext();
  }

  function collectPayload() {
    const fullName = getValue("full_name");
    const phone = getValue("phone");
    const displayEmail = lower(getValue("display_email") || currentUser?.email || "");
    const dealershipName = getValue("dealership_name");
    const dealershipWebsite = getValue("dealership_website");
    const city = getValue("city");
    const province = getValue("province", "Alberta");
    const complianceMode = getValue("compliance_mode", "strict");

    const payload = {
      id: currentUser?.id || "",
      email: lower(currentUser?.email || displayEmail),
      full_name: fullName,
      dealership: dealershipName,
      city,
      province,
      phone,
      license_number: "",
      listing_location: city,
      dealer_phone: phone,
      dealer_email: displayEmail,
      compliance_mode: complianceMode,
      dealer_website: dealershipWebsite,
      inventory_url: "",
      scanner_type: ""
    };

    const extras = {
      booking_link: getValue("booking_link"),
      instagram_handle: getValue("instagram_handle"),
      primary_cta:
        getValue("primary_cta") ||
        (fullName ? `Call or text ${fullName} today` : ""),
      logo_url: getValue("logo_url"),
      default_seller_name: getValue("default_seller_name") || fullName,
      active_disclaimer:
        getValue("active_disclaimer") || buildDefaultDisclaimer(),
      trades_welcome: getCheckbox("trades_welcome", true),
      financing_cta: getCheckbox("financing_cta", true),
      delivery_available: getCheckbox("delivery_available", false),
      carfax_mention: getCheckbox("carfax_mention", true)
    };

    return { payload, extras };
  }

  async function getCurrentUserFromSession() {
    const client = ensureSupabaseClient();

    const sessionResult = await client.auth.getSession();
    if (sessionResult?.error) {
      throw sessionResult.error;
    }

    const sessionUser = sessionResult?.data?.session?.user;
    if (sessionUser) return sessionUser;

    const userResult = await client.auth.getUser();
    if (userResult?.error) {
      throw userResult.error;
    }

    return userResult?.data?.user || null;
  }

  async function buildAuthHeaders(extraHeaders = {}) {
    const headers = { Accept: "application/json", ...extraHeaders };
    try {
      const client = ensureSupabaseClient();
      const sessionResult = await client.auth.getSession();
      const token = sessionResult?.data?.session?.access_token || "";
      if (token) headers.Authorization = `Bearer ${token}`;
      headers["x-elevate-client"] = "dashboard";
    } catch (error) {
      console.warn("[profile] auth header warning:", error);
    }
    return headers;
  }

  async function loadProfile() {
    if (!currentUser?.id) {
      throw new Error("Missing authenticated user id.");
    }

    const response = await fetch(
      `/api/profile?id=${encodeURIComponent(currentUser.id)}`,
      {
        method: "GET",
        headers: await buildAuthHeaders()
      }
    );

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.error || "Failed to load profile.");
    }

    return result?.data || null;
  }

  async function saveProfile() {
    if (isSaving) return;

    clearStatus();

    if (!currentUser?.id) {
      showStatus("No active authenticated user session found.", "error");
      return;
    }

    const { payload, extras } = collectPayload();

    if (!payload.full_name) {
      showStatus("Full Name is required.", "error");
      if (els.full_name) els.full_name.focus();
      return;
    }

    if (!payload.dealership) {
      showStatus("Dealership Name is required.", "error");
      if (els.dealership_name) els.dealership_name.focus();
      return;
    }

    if (!payload.city) {
      showStatus("City is required.", "error");
      if (els.city) els.city.focus();
      return;
    }

    setSavingState(true);
    showStatus("Saving profile...", "info");

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: await buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Failed to save profile.");
      }

      setExtraProfile(extras);
      currentProfile = result?.data || payload;
      populateForm(currentProfile, extras);

      showStatus("Profile saved successfully.", "success");
    } catch (error) {
      console.error("[profile] save error:", error);
      showStatus(error?.message || "Failed to save profile.", "error");
    } finally {
      setSavingState(false);
    }
  }

  function bindEvents() {
    if (els.saveTopBtn) {
      els.saveTopBtn.addEventListener("click", saveProfile);
    }

    if (els.saveBottomBtn) {
      els.saveBottomBtn.addEventListener("click", saveProfile);
    }

    ["province", "full_name", "phone", "dealership_name", "city"].forEach((id) => {
      if (!els[id]) return;
      els[id].addEventListener("change", function () {
        if (!getValue("active_disclaimer")) {
          maybeRefreshDefaultDisclaimer(false);
        }
        populateAccountContext();
      });
    });

    if (els.compliance_mode) {
      els.compliance_mode.addEventListener("change", function () {
        populateAccountContext();
      });
    }

    if (els.dealership_name) {
      els.dealership_name.addEventListener("input", populateAccountContext);
    }

    if (els.city) {
      els.city.addEventListener("input", populateAccountContext);
    }

    if (els.active_disclaimer) {
      els.active_disclaimer.addEventListener("focus", function () {
        if (!getValue("active_disclaimer")) {
          maybeRefreshDefaultDisclaimer(false);
        }
      });
    }
  }

  async function boot() {
    cacheElements();
    setSavingState(false);
    showStatus("Checking session...", "info");

    try {
      ensureSupabaseClient();

      currentUser = await getCurrentUserFromSession();

      if (!currentUser) {
        window.location.href = "/login.html";
        return;
      }

      localStorage.setItem("user_email", currentUser.email || "");

      const [profile, extras] = await Promise.all([
        loadProfile(),
        Promise.resolve(getExtraProfile())
      ]);

      populateForm(profile, extras);
      bindEvents();

      showStatus(
        profile
          ? "Profile loaded. Review and save any changes."
          : "No saved profile found yet. Complete setup and save.",
        profile ? "success" : "info"
      );
    } catch (error) {
      console.error("[profile] boot error:", error);
      showStatus(error?.message || "Failed to load profile module.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
