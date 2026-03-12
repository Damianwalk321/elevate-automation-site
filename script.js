const SUPABASE_URL = "https://teixblbxkoershwgqpym.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaXhibGJ4a29lcnNod2dxcHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODUzMDMsImV4cCI6MjA4ODY2MTMwM30.wxt9zjKhsBuflaFZZT9awZiwckRzYkEl-OLm_4q8qF4";

console.log("Elevate script loaded");

async function insertIntoSupabase(table, payload) {
  console.log("Submitting to table:", table, payload);

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
    console.error("Supabase response error:", errorText);
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

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM fully loaded");

  const betaForm = document.getElementById("beta-waitlist-form");
  const partnerForm = document.getElementById("partner-waitlist-form");

  console.log("Beta form found:", !!betaForm);
  console.log("Partner form found:", !!partnerForm);

  if (betaForm) {
    betaForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      console.log("Beta form submit intercepted");

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
      console.log("Partner form submit intercepted");

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
});
