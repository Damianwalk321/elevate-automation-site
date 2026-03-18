// /script.js

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function showReferralBanner(refCode) {
  const banner = document.getElementById("referral-banner");
  const display = document.getElementById("referral-code-display");

  if (!banner || !display || !refCode) return;

  display.textContent = refCode;
  banner.classList.remove("hidden");

  try {
    localStorage.setItem("elevate_referral_code", refCode);
  } catch (error) {
    console.error("Could not store referral code:", error);
  }
}

function loadStoredReferralCode() {
  const queryRef = getQueryParam("ref");

  if (queryRef) {
    showReferralBanner(queryRef);
    return queryRef;
  }

  try {
    const storedRef = localStorage.getItem("elevate_referral_code");
    if (storedRef) {
      showReferralBanner(storedRef);
      return storedRef;
    }
  } catch (error) {
    console.error("Could not read stored referral code:", error);
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

async function startCheckout(planType, userType, accessType) {
  try {
    const email = await getLoggedInUserEmail();
    const referralCode = loadStoredReferralCode();

    if (!email) {
      showCheckoutMessage("Please create an account or log in before checkout.", true);
      window.location.href = "/login.html";
      return;
    }

    showCheckoutMessage("Redirecting to secure checkout...");

    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        referralCode,
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

function setElementDisplay(id, show, displayType = "inline-flex") {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = show ? displayType : "none";
}

async function updateAuthAwareUI() {
  let loggedIn = false;

  try {
    if (typeof window.getCurrentUser === "function") {
      const user = await window.getCurrentUser();
      loggedIn = !!user;
      if (user?.email) {
        localStorage.setItem("user_email", user.email);
      }
    }
  } catch (error) {
    console.error("Auth-aware UI check failed:", error);
  }

  setElementDisplay("loginNavBtn", !loggedIn, "inline-flex");
  setElementDisplay("signupNavBtn", !loggedIn, "inline-flex");
  setElementDisplay("dashboardNavBtn", loggedIn, "inline-flex");
  setElementDisplay("logoutNavBtn", loggedIn, "inline-flex");

  setElementDisplay("heroSignupBtn", !loggedIn, "inline-flex");
  setElementDisplay("heroLoginBtn", !loggedIn, "inline-flex");
  setElementDisplay("heroDashboardBtn", loggedIn, "inline-flex");
}

function bindLogoutButton() {
  const logoutBtn = document.getElementById("logoutNavBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    try {
      if (typeof window.signOutUser === "function") {
        await window.signOutUser();
      } else {
        localStorage.removeItem("user_email");
      }

      window.location.href = "/login.html";
    } catch (error) {
      console.error("Logout failed:", error);
      alert(error.message || "Logout failed.");
    }
  });
}

function showFormMessage(form, message, isError = false) {
  if (!form) return;

  let msgEl = form.querySelector(".dynamic-form-message");

  if (!msgEl) {
    msgEl = document.createElement("p");
    msgEl.className = "dynamic-form-message";
    msgEl.style.marginTop = "12px";
    msgEl.style.fontSize = "14px";
    msgEl.style.lineHeight = "1.5";
    form.appendChild(msgEl);
  }

  msgEl.textContent = message;
  msgEl.style.color = isError ? "#ffb3b3" : "#d4af37";
}

function serializeForm(form) {
  const formData = new FormData(form);
  const payload = {};

  for (const [key, value] of formData.entries()) {
    payload[key] = typeof value === "string" ? value.trim() : value;
  }

  return payload;
}

function bindWaitlistForms() {
  const betaForm = document.getElementById("beta-waitlist-form");
  const partnerForm = document.getElementById("partner-waitlist-form");

  if (betaForm) {
    betaForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const payload = serializeForm(betaForm);
      const referralCode = loadStoredReferralCode();
      if (referralCode) payload.referral_code = referralCode;
      payload.list_type = "beta";

      try {
        showFormMessage(betaForm, "Submitting...");

        const response = await fetch("/api/waitlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not submit beta waitlist form.");
        }

        showFormMessage(betaForm, "Beta waitlist submitted.");
        betaForm.reset();
      } catch (error) {
        console.error("Beta waitlist error:", error);
        showFormMessage(betaForm, error.message || "Could not submit beta waitlist form.", true);
      }
    });
  }

  if (partnerForm) {
    partnerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const payload = serializeForm(partnerForm);
      const referralCode = loadStoredReferralCode();
      if (referralCode) payload.referral_code = referralCode;
      payload.list_type = "partner";

      try {
        showFormMessage(partnerForm, "Submitting...");

        const response = await fetch("/api/waitlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not submit partner waitlist form.");
        }

        showFormMessage(partnerForm, "Partner waitlist submitted.");
        partnerForm.reset();
      } catch (error) {
        console.error("Partner waitlist error:", error);
        showFormMessage(partnerForm, error.message || "Could not submit partner waitlist form.", true);
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  loadStoredReferralCode();
  bindCheckoutButtons();
  bindLogoutButton();
  bindWaitlistForms();
  await updateAuthAwareUI();
});
