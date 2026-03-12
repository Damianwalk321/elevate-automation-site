const SUPABASE_URL = "https://teixblbxkoershwgqpym.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaXhibGJ4a29lcnNod2dxcHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODUzMDMsImV4cCI6MjA4ODY2MTMwM30.wxt9zjKhsBuflaFZZT9awZiwckRzYkEl-OLm_4q8qF4";
const CREATE_CHECKOUT_SESSION_URL = "https://teixblbxkoershwgqpym.supabase.co/functions/v1/create-checkout-session";

async function insertIntoSupabase(table, payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Submission failed.");
  }

  return true;
}

function setButtonLoading(button, loadingText) {
  if (!button) return;
  button.dataset.originalText = button.textContent;
  button.textContent = loadingText;
  button.disabled = true;
}

function resetButton(button) {
  if (!button) return;
  button.textContent = button.dataset.originalText || "Submit";
  button.disabled = false;
}

function getReferralCode() {
  return localStorage.getItem("elevate_ref_code") || "";
}

function setReferralCode(code) {
  if (!code) return;
  localStorage.setItem("elevate_ref_code", code);
}

function showReferralBanner() {
  const banner = document.getElementById("referral-banner");
  const display = document.getElementById("referral-code-display");
  const code = getReferralCode();

  if (banner && display && code) {
    display.textContent = code;
    banner.classList.remove("hidden");
  }
}

function handleReferralParam() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");

  if (ref && ref.trim()) {
    setReferralCode(ref.trim().toUpperCase());
  }
}

function showCheckoutMessage() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("checkout");
  const box = document.getElementById("checkout-message");

  if (!box || !status) return;

  box.classList.remove("hidden", "success", "cancelled");

  if (status === "success") {
    box.classList.add("success");
    box.textContent = "Checkout completed successfully. Your access is now being processed.";
  } else if (status === "cancelled") {
    box.classList.add("cancelled");
    box.textContent = "Checkout was cancelled. You can return to pricing and try again when ready.";
  } else {
    box.classList.add("hidden");
  }
}

async function createCheckoutSession(payload) {
  const response = await fetch(CREATE_CHECKOUT_SESSION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to create checkout session.");
  }

  return data;
}

document.addEventListener("DOMContentLoaded", function () {
  handleReferralParam();
  showReferralBanner();
  showCheckoutMessage();

  const betaForm = document.getElementById("beta-waitlist-form");
  const partnerForm = document.getElementById("partner-waitlist-form");
  const checkoutButtons = document.querySelectorAll(".checkout-btn");

  if (betaForm) {
    betaForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const submitButton = betaForm.querySelector('button[type="submit"]');
      const note = betaForm.querySelector(".form-note");

      try {
        setButtonLoading(submitButton, "Submitting...");

        const formData = new FormData(betaForm);

        const payload = {
          first_name: formData.get("first_name")?.toString().trim() || null,
          last_name: formData.get("last_name")?.toString().trim() || null,
          email: formData.get("email")?.toString().trim() || null,
          phone: formData.get("phone")?.toString().trim() || null,
          company: formData.get("company")?.toString().trim() || null,
          role: formData.get("role")?.toString().trim() || null,
          province: formData.get("province")?.toString().trim() || null,
          vehicles_per_week: formData.get("vehicles_per_week")?.toString().trim() || null,
          source: "website"
        };

        await insertIntoSupabase("beta_waitlist", payload);

        betaForm.reset();
        if (note) {
          note.textContent = "Request received. We’ll review your early access submission.";
        }
      } catch (error) {
        console.error("Beta waitlist error:", error);
        if (note) {
          note.textContent = "There was an issue submitting your request. Please try again.";
        }
      } finally {
        resetButton(submitButton);
      }
    });
  }

  if (partnerForm) {
    partnerForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const submitButton = partnerForm.querySelector('button[type="submit"]');
      const note = partnerForm.querySelector(".form-note");

      try {
        setButtonLoading(submitButton, "Submitting...");

        const formData = new FormData(partnerForm);

        const payload = {
          first_name: formData.get("first_name")?.toString().trim() || null,
          last_name: formData.get("last_name")?.toString().trim() || null,
          email: formData.get("email")?.toString().trim() || null,
          phone: formData.get("phone")?.toString().trim() || null,
          company: formData.get("company")?.toString().trim() || null,
          role: formData.get("role")?.toString().trim() || null,
          province: formData.get("province")?.toString().trim() || null,
          audience_size: formData.get("audience_size")?.toString().trim() || null,
          source: "website"
        };

        await insertIntoSupabase("partner_waitlist", payload);

        partnerForm.reset();
        if (note) {
          note.textContent = "Application received. We’ll review your partner request.";
        }
      } catch (error) {
        console.error("Partner waitlist error:", error);
        if (note) {
          note.textContent = "There was an issue submitting your application. Please try again.";
        }
      } finally {
        resetButton(submitButton);
      }
    });
  }

  checkoutButtons.forEach((button) => {
    button.addEventListener("click", async function () {
      try {
        setButtonLoading(button, "Redirecting...");

        const priceId = button.dataset.priceId;
        const planType = button.dataset.planType;
        const userType = button.dataset.userType;
        const accessType = button.dataset.accessType;
        const affiliateCode = getReferralCode();

        const email = window.prompt("Enter your email for access setup:");
        if (!email) {
          resetButton(button);
          return;
        }

        const firstName = window.prompt("First name:");
        if (!firstName) {
          resetButton(button);
          return;
        }

        const lastName = window.prompt("Last name:") || "";
        const phone = window.prompt("Phone number:") || "";
        const company = window.prompt("Company / dealership:") || "";
        const province = window.prompt("Province:") || "";

        const payload = {
          priceId,
          successUrl: "https://elevate-automation-site.vercel.app/?checkout=success",
          cancelUrl: "https://elevate-automation-site.vercel.app/?checkout=cancelled",
          firstName,
          lastName,
          phone,
          company,
          province,
          userType,
          planType,
          source: "website",
          affiliateCode,
          accessType,
          email
        };

        const result = await createCheckoutSession(payload);

        if (result.url) {
          window.location.href = result.url;
          return;
        }

        throw new Error("No checkout URL returned.");
      } catch (error) {
        console.error("Checkout error:", error);
        alert("There was an issue starting checkout. Please try again.");
        resetButton(button);
      }
    });
  });
});
