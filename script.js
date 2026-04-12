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

function showReferralBanner(refCode) {
  const banner = document.getElementById("referral-banner");
  const display = document.getElementById("referral-code-display");

  if (!banner || !display || !refCode) return;

  display.textContent = refCode;
  banner.classList.remove("hidden");
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
    showReferralBanner(locked.code);
    return locked.code;
  }

  if (stored.code) {
    showReferralBanner(stored.code);
    return stored.code;
  }

  return null;
}

function showCheckoutMessage(message, isError = false) {
  const el = document.getElementById("checkout-message");
  if (!el) return;

  el.textContent = message;
  el.classList.remove("hidden");
  el.style.color = isError ? "#ffb3b3" : "";
  el.style.borderColor = isError ? "rgba(255,92,92,0.22)" : "";
  el.style.background = isError ? "rgba(255,92,92,0.08)" : "";
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

async function startCheckout(planType, userType, accessType) {
  try {
    const email = await getLoggedInUserEmail();
    const referralCode = loadStoredReferralCode();
    const referralSource = getStoredReferralData().source;

    if (!email) {
      showCheckoutMessage("Please create an account or log in before checkout.", true);
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
        planType,
        userType,
        accessType
      })
    });

    const data = await response.json();

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
    showCheckoutMessage(error.message || "Could not start checkout.", true);
  }
}

function bindCheckoutButtons() {
  const buttons = document.querySelectorAll(".checkout-btn");
  if (!buttons.length) return;

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      const planType = button.dataset.planType || "";
      const userType = button.dataset.userType || "";
      const accessType = button.dataset.accessType || "";
      await startCheckout(planType, userType, accessType);
    });
  });
}

function bindStaticPartnerActions() {
  const betaAccessButtons = document.querySelectorAll("[data-beta-access]");
  betaAccessButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const email = await getLoggedInUserEmail();
      window.location.href = email ? "/dashboard.html" : "/signup.html";
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  loadStoredReferralCode();
  bindCheckoutButtons();
  bindStaticPartnerActions();
});