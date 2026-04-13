// /script.js

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || params.get(name.replace(/_/g, "-")) || params.get(name.replace(/-/g, "_"));
}

function normalizeReferralCode(value) {
  return String(value || "").trim();
}

function getStoredReferralData() {
  try {
    return {
      code: normalizeReferralCode(localStorage.getItem("elevate_referral_code")),
      source: normalizeReferralCode(localStorage.getItem("elevate_referral_source")) || "direct"
    };
  } catch (error) {
    console.error("Could not read stored referral data:", error);
    return { code: "", source: "direct" };
  }
}

function storeReferralData(code, source = "direct") {
  const normalizedCode = normalizeReferralCode(code);
  if (!normalizedCode) return;

  try {
    const existing = normalizeReferralCode(localStorage.getItem("elevate_referral_code"));
    if (existing && existing !== normalizedCode) return;
    localStorage.setItem("elevate_referral_code", normalizedCode);
    localStorage.setItem("elevate_referral_source", normalizeReferralCode(source) || "direct");
  } catch (error) {
    console.error("Could not store referral data:", error);
  }
}

function showReferralBanner(refCode, source = "direct") {
  const banner = document.getElementById("referral-banner");
  const display = document.getElementById("referral-code-display");
  if (!banner || !display || !refCode) return;
  display.textContent = refCode;
  banner.classList.remove("hidden");
  storeReferralData(refCode, source);
}

function loadStoredReferralCode() {
  const queryRef = normalizeReferralCode(
    getQueryParam("ref") ||
    getQueryParam("referral_code") ||
    getQueryParam("affiliate") ||
    getQueryParam("code")
  );
  const stored = getStoredReferralData();

  if (queryRef) {
    storeReferralData(queryRef, stored.code ? stored.source : "link");
    const locked = getStoredReferralData();
    showReferralBanner(locked.code, locked.source);
    return locked.code;
  }

  if (stored.code) {
    showReferralBanner(stored.code, stored.source);
    return stored.code;
  }

  return null;
}

function showCheckoutMessage(message) {
  const el = document.getElementById("checkout-message");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
}

async function getLoggedInUserEmail() {
  try {
    if (typeof window.getCurrentUser === "function") {
      const user = await window.getCurrentUser();
      if (user?.email) {
        localStorage.setItem("user_email", user.email);
        return user.email;
      }
    }
  } catch (error) {
    console.error("Could not get current auth user:", error);
  }

  try {
    return localStorage.getItem("user_email");
  } catch (error) {
    console.error("Could not read cached user email:", error);
    return null;
  }
}

async function getAuthAccessTokenForCheckout() {
  try {
    if (window.supabaseClient?.auth?.getSession) {
      const { data } = await window.supabaseClient.auth.getSession();
      return data?.session?.access_token || "";
    }
  } catch (error) {
    console.error("Could not read checkout auth token:", error);
  }
  return "";
}

function normalizePlanPayload(planType) {
  const plan = String(planType || "").trim().toLowerCase();
  if (plan === "pro") {
    return { planType: "pro", userType: "pro", accessType: "pro" };
  }
  return { planType: "starter", userType: "starter", accessType: "starter" };
}

async function startCheckout(planType) {
  try {
    const email = await getLoggedInUserEmail();
    const referralCode = loadStoredReferralCode();
    const referralSource = getStoredReferralData().source;
    const normalized = normalizePlanPayload(planType);

    if (!email) {
      showCheckoutMessage("Please create an account or log in before starting your free trial.");
      window.location.href = "/login.html";
      return;
    }

    showCheckoutMessage("Redirecting to secure checkout...");

    const token = await getAuthAccessTokenForCheckout();
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(token ? { "x-elevate-client": "dashboard" } : {})
      },
      body: JSON.stringify({
        email,
        referralCode,
        referralSource,
        planType: normalized.planType,
        userType: normalized.userType,
        accessType: normalized.accessType
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Checkout session could not be created.");
    }

    if (data.url) {
      window.location.href = data.url;
      return;
    }

    throw new Error("Checkout URL missing.");
  } catch (error) {
    console.error("Checkout error:", error);
    showCheckoutMessage(error.message || "Could not start checkout.");
  }
}

function bindCheckoutButtons() {
  document.querySelectorAll(".checkout-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      await startCheckout(button.dataset.planType || "starter");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadStoredReferralCode();
  bindCheckoutButtons();
});
