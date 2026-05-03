function getElevateSupabaseConfig() {
  const config = window.__ELEVATE_SUPABASE_CONFIG || null;
  const url = config?.url || window.__ELEVATE_SUPABASE_URL || "";
  const apiKey =
    config?.publishableKey ||
    window.__ELEVATE_SUPABASE_PUBLISHABLE_KEY ||
    window.__ELEVATE_SUPABASE_ANON_KEY ||
    "";

  if (!url || !apiKey) {
    throw new Error(
      "Elevate Supabase config is unavailable. Ensure /js/supabase-client.js is loaded before beta.js."
    );
  }

  return { url, apiKey };
}

async function insertIntoSupabase(table, payload) {
  const { url, apiKey } = getElevateSupabaseConfig();

  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Prefer: "return=minimal"
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

document.addEventListener("DOMContentLoaded", function () {
  const feedbackForm = document.getElementById("beta-feedback-form");

  if (!feedbackForm) return;

  feedbackForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const submitButton = feedbackForm.querySelector('button[type="submit"]');
    const statusBox = document.getElementById("feedback-status");

    try {
      setButtonLoading(submitButton, "Submitting...");

      const formData = new FormData(feedbackForm);

      const payload = {
        name: formData.get("name")?.toString().trim() || null,
        email: formData.get("email")?.toString().trim() || null,
        issue_type: formData.get("issue_type")?.toString().trim() || "bug",
        priority: formData.get("priority")?.toString().trim() || "normal",
        description: formData.get("description")?.toString().trim() || null,
        screenshot_link: formData.get("screenshot_link")?.toString().trim() || null,
        source: "beta_portal"
      };

      await insertIntoSupabase("beta_feedback", payload);

      feedbackForm.reset();

      if (statusBox) {
        statusBox.className = "feedback-status success";
        statusBox.textContent = "Feedback submitted successfully. Thank you — this helps improve the beta fast.";
      }
    } catch (error) {
      console.error("Beta feedback error:", error);
      if (statusBox) {
        statusBox.className = "feedback-status error";
        statusBox.textContent =
          error?.message ||
          "There was an issue submitting your feedback. Please try again.";
      }
    } finally {
      resetButton(submitButton);
    }
  });
});
