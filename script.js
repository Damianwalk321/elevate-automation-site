// script.js

document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll("[data-checkout]");

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        button.innerText = "Loading...";

        const emailInput = document.querySelector("#email");
        const email = emailInput ? emailInput.value.trim() : "";

        if (!email) {
          alert("Please enter your email to continue.");
          button.disabled = false;
          button.innerText = "Start Free → Lock Founder Pricing";
          return;
        }

        // Optional tracking fields
        const referralCode =
          localStorage.getItem("referral_code") || "";

        const planType = "founder_starter";
        const userType = "sales";
        const accessType = "founder";

        const res = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            referralCode,
            planType,
            userType,
            accessType,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Checkout failed");
        }

        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error("No checkout URL returned");
        }
      } catch (err) {
        console.error("Checkout error:", err);
        alert("Something went wrong. Please try again.");

        button.disabled = false;
        button.innerText = "Start Free → Lock Founder Pricing";
      }
    });
  });
});
