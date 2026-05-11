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

  function resolveSectionId(sectionId) {
    const requested = clean(sectionId);
    if (!requested) return requested;
    if (document.getElementById(requested)) return requested;

    const aliases = {
      reviewCenter: ["review-center", "reviewCenter", "review_center"],
      listings: ["listings", "listingSection", "listing-section"],
      analytics: ["analytics", "analyticsSection", "analytics-section"],
      overview: ["overview", "overviewSection", "overview-section"],
      setup: ["setup", "setupSection", "setup-section"],
      tools: ["tools", "toolsSection", "tools-section"],
      compliance: ["compliance", "complianceSection", "compliance-section"],
      partners: ["partners", "partnersSection", "partners-section"],
      billing: ["billing", "billingSection", "billing-section"]
    };

    const candidates = aliases[requested] || [requested];
    return candidates.find((id) => document.getElementById(id)) || requested;
  }

  function showSection(sectionId) {
    const resolvedSectionId = resolveSectionId(sectionId);
    qsa(".dashboard-section").forEach((section) => {
      section.style.display = section.id === resolvedSectionId ? "block" : "none";
    });

    qsa("[data-section]").forEach((button) => {
      const buttonSection = resolveSectionId(button.getAttribute("data-section") || "");
      button.classList.toggle("active", buttonSection === resolvedSectionId);
    });

    NS.state?.set?.("ui.activeSection", resolvedSectionId);
  }

  function injectStyleOnce(id, css) {
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function findSidebarNav() {
    return qs(".sidebar-nav") || qs("[data-sidebar-nav]") || null;
  }

  function existingNavSectionIds() {
    return new Set(qsa("[data-section]").map((button) => clean(button.getAttribute("data-section") || "")).filter(Boolean));
  }

  function createNavButton(label, sectionId) {
    const button = document.createElement("button");
    button.className = "nav-btn";
    button.type = "button";
    button.setAttribute("data-section", sectionId);
    button.textContent = label;
    button.addEventListener("click", () => showSection(sectionId));
    return button;
  }

  function ensureSidebarEntries() {
    const nav = findSidebarNav();
    if (!nav) return;

    const toEnsure = [
      { label: "Listings", preferredId: "listings", after: "tools" },
      { label: "Review Center", preferredId: "reviewCenter", after: "listings" }
    ];

    const existing = existingNavSectionIds();

    toEnsure.forEach((item) => {
      const resolved = resolveSectionId(item.preferredId);
      const sectionEl = document.getElementById(resolved);
      if (!sectionEl) return;
      if (existing.has(item.preferredId) || existing.has(resolved)) return;

      const button = createNavButton(item.label, resolved);
      const navButtons = qsa("[data-section]", nav);
      const afterButton = navButtons.find((btn) => {
        const btnSection = clean(btn.getAttribute("data-section") || "");
        return btnSection === item.after || resolveSectionId(btnSection) === resolveSectionId(item.after);
      });

      if (afterButton?.nextSibling) nav.insertBefore(button, afterButton.nextSibling);
      else nav.appendChild(button);
      existing.add(resolved);
    });
  }

  function bootSidebarNavRepair() {
    ensureSidebarEntries();
    const active = NS.state?.get?.("ui.activeSection") || "overview";
    showSection(active);
  }

  NS.ui = { qs, qsa, clean, setText, setStatus, showSection, injectStyleOnce, ensureSidebarEntries };
  window.showSection = window.showSection || showSection;
  NS.modules = NS.modules || {};
  NS.modules.ui = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSidebarNavRepair, { once: true });
  } else {
    bootSidebarNavRepair();
  }
})();
