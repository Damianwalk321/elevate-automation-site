(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.ui) return;

  function qs(selector, root = document) { return root.querySelector(selector); }
  function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }

  function setText(id, text) {
    qsa(`#${id}`).forEach((el) => { el.textContent = text || ""; });
  }

  function setStatus(id, text) {
    qsa(`#${id}`).forEach((el) => { el.textContent = text || ""; });
  }

  function showSection(sectionId) {
    qsa(".dashboard-section").forEach((section) => {
      section.style.display = section.id === sectionId ? "block" : "none";
    });

    qsa("[data-section]").forEach((button) => {
      button.classList.toggle("active", button.getAttribute("data-section") === sectionId);
    });

    NS.state?.set?.("ui.activeSection", sectionId);
  }

  function injectStyleOnce(id, css) {
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }

  NS.ui = { qs, qsa, clean, setText, setStatus, showSection, injectStyleOnce };
  window.showSection = window.showSection || showSection;
  NS.modules = NS.modules || {};
  NS.modules.ui = true;
})();
