document.addEventListener("DOMContentLoaded", function () {
  const betaForm = document.getElementById("beta-waitlist-form");
  const partnerForm = document.getElementById("partner-waitlist-form");

  if (betaForm) {
    betaForm.addEventListener("submit", function (e) {
      e.preventDefault();
      alert("Phase 1 complete: Beta waitlist form UI is built. Supabase connection is added in Phase 2.");
    });
  }

  if (partnerForm) {
    partnerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      alert("Phase 1 complete: Partner waitlist form UI is built. Supabase connection is added in Phase 2.");
    });
  }
});
