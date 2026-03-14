(function () {
  const SUPABASE_URL = window.SUPABASE_URL || "YOUR_SUPABASE_URL";
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";

  const statusBox = document.getElementById("statusBox");
  const saveTopBtn = document.getElementById("saveTopBtn");
  const saveBottomBtn = document.getElementById("saveBottomBtn");

  const el = (id) => document.getElementById(id);

  const fields = {
    full_name: el("full_name"),
    phone: el("phone"),
    display_email: el("display_email"),
    booking_link: el("booking_link"),
    instagram_handle: el("instagram_handle"),
    primary_cta: el("primary_cta"),
    dealership_name: el("dealership_name"),
    dealership_website: el("dealership_website"),
    city: el("city"),
    province: el("province"),
    logo_url: el("logo_url"),
    default_seller_name: el("default_seller_name"),
    compliance_mode: el("compliance_mode"),
    active_disclaimer: el("active_disclaimer"),
    trades_welcome: el("trades_welcome"),
    financing_cta: el("financing_cta"),
    delivery_available: el("delivery_available"),
    carfax_mention: el("carfax_mention"),
  };

  const meta = {
    sessionEmail: el("sessionEmail"),
    profileRecordStatus: el("profileRecordStatus"),
    complianceContext: el("complianceContext"),
    dealershipContext: el("dealershipContext"),
  };

  if (
    !SUPABASE_URL ||
    SUPABASE_URL === "YOUR_SUPABASE_URL" ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY"
  ) {
    showStatus("Set SUPABASE_URL and SUPABASE_ANON_KEY in profile.js or expose them safely via your existing config.", "error");
    return;
  }

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let currentUser = null;

  init();

  async function init() {
    bindEvents();

    try {
      const {
        data: { user },
        error,
      } = await supabaseClient.auth.getUser();

      if (error || !user) {
        window.location.href = "/login.html";
        return;
      }

      currentUser = user;

      meta.sessionEmail.textContent = user.email || "-";
      fields.display_email.value = user.email || "";

      await loadProfile(user.email);
    } catch (err) {
      console.error(err);
      showStatus(err.message || "Failed to initialize profile page.", "error");
    }
  }

  function bindEvents() {
    saveTopBtn?.addEventListener("click", saveProfile);
    saveBottomBtn?.addEventListener("click", saveProfile);
  }

  async function loadProfile(email) {
    meta.profileRecordStatus.textContent = "Loading...";

    try {
      const res = await fetch(`/api/profile?user_email=${encodeURIComponent(email)}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load profile");
      }

      const profile = json.profile;

      if (!profile) {
        meta.profileRecordStatus.textContent = "No saved record yet";
        meta.complianceContext.textContent = fields.province.value || "-";
        meta.dealershipContext.textContent = fields.dealership_name.value || "-";
        return;
      }

      setFieldValues(profile);

      meta.profileRecordStatus.textContent = "Loaded";
      meta.complianceContext.textContent = `${profile.province || "-"} / ${profile.compliance_mode || "-"}`;
      meta.dealershipContext.textContent = profile.dealership_name || "-";
    } catch (err) {
      console.error(err);
      meta.profileRecordStatus.textContent = "Load failed";
      showStatus(err.message || "Failed to load profile.", "error");
    }
  }

  function setFieldValues(profile) {
    fields.full_name.value = profile.full_name || "";
    fields.phone.value = profile.phone || "";
    fields.display_email.value = profile.display_email || currentUser?.email || "";
    fields.booking_link.value = profile.booking_link || "";
    fields.instagram_handle.value = profile.instagram_handle || "";
    fields.primary_cta.value = profile.primary_cta || "";
    fields.dealership_name.value = profile.dealership_name || "";
    fields.dealership_website.value = profile.dealership_website || "";
    fields.city.value = profile.city || "";
    fields.province.value = profile.province || "Alberta";
    fields.logo_url.value = profile.logo_url || "";
    fields.default_seller_name.value = profile.default_seller_name || "";
    fields.compliance_mode.value = profile.compliance_mode || "strict";
    fields.active_disclaimer.value = profile.active_disclaimer || "";
    fields.trades_welcome.checked = !!profile.trades_welcome;
    fields.financing_cta.checked = !!profile.financing_cta;
    fields.delivery_available.checked = !!profile.delivery_available;
    fields.carfax_mention.checked = !!profile.carfax_mention;
  }

  function buildPayload() {
    return {
      user_email: currentUser?.email || "",
      full_name: fields.full_name.value.trim(),
      phone: fields.phone.value.trim(),
      display_email: fields.display_email.value.trim(),
      booking_link: fields.booking_link.value.trim(),
      instagram_handle: fields.instagram_handle.value.trim(),
      primary_cta: fields.primary_cta.value.trim(),
      dealership_name: fields.dealership_name.value.trim(),
      dealership_website: fields.dealership_website.value.trim(),
      city: fields.city.value.trim(),
      province: fields.province.value,
      logo_url: fields.logo_url.value.trim(),
      default_seller_name: fields.default_seller_name.value.trim(),
      compliance_mode: fields.compliance_mode.value,
      active_disclaimer: fields.active_disclaimer.value.trim(),
      trades_welcome: fields.trades_welcome.checked,
      financing_cta: fields.financing_cta.checked,
      delivery_available: fields.delivery_available.checked,
      carfax_mention: fields.carfax_mention.checked,
    };
  }

  async function saveProfile() {
    if (!currentUser?.email) {
      showStatus("No authenticated user found. Please log in again.", "error");
      return;
    }

    const payload = buildPayload();

    try {
      setSavingState(true);
      showStatus("Saving profile...", "loading");

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to save profile");
      }

      meta.profileRecordStatus.textContent = "Saved";
      meta.complianceContext.textContent = `${payload.province} / ${payload.compliance_mode}`;
      meta.dealershipContext.textContent = payload.dealership_name || "-";

      showStatus("Profile saved successfully.", "success");
    } catch (err) {
      console.error(err);
      showStatus(err.message || "Failed to save profile.", "error");
    } finally {
      setSavingState(false);
    }
  }

  function setSavingState(isSaving) {
    saveTopBtn.disabled = isSaving;
    saveBottomBtn.disabled = isSaving;
    saveTopBtn.textContent = isSaving ? "Saving..." : "Save Profile";
    saveBottomBtn.textContent = isSaving ? "Saving..." : "Save Profile";
  }

  function showStatus(message, type = "loading") {
    statusBox.textContent = message;
    statusBox.className = "status show";

    if (type === "success") statusBox.classList.add("success");
    if (type === "error") statusBox.classList.add("error");
  }
})();
