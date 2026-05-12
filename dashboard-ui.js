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

  function sectionAliases() {
    return {
      reviewCenter: ["reviewCenter", "review-center", "review_center"],
      listings: ["listings", "listingSection", "listing-section"],
      analytics: ["analytics", "analyticsSection", "analytics-section"],
      overview: ["overview", "overviewSection", "overview-section"],
      setup: ["setup", "setupSection", "setup-section", "profile"],
      tools: ["tools", "toolsSection", "tools-section", "extension"],
      compliance: ["compliance", "complianceSection", "compliance-section"],
      partners: ["partners", "partnersSection", "partners-section", "affiliate"],
      billing: ["billing", "billingSection", "billing-section"]
    };
  }

  function resolveSectionId(sectionId) {
    const requested = clean(sectionId);
    if (!requested) return requested;
    if (document.getElementById(requested)) return requested;
    const aliases = sectionAliases();
    const candidates = aliases[requested] || [requested];
    return candidates.find((id) => document.getElementById(id)) || requested;
  }

  function getDashboardSections() {
    return qsa(".dashboard-section").filter(Boolean);
  }

  function findSectionElement(sectionId) {
    const resolvedId = resolveSectionId(sectionId);
    if (resolvedId) {
      const direct = document.getElementById(resolvedId);
      if (direct) return direct;
    }

    const aliases = sectionAliases();
    const candidates = aliases[clean(sectionId)] || [clean(sectionId)];
    const sections = getDashboardSections();
    for (const candidate of candidates) {
      const matched = sections.find((section) => clean(section.id) === candidate);
      if (matched) return matched;
    }

    const loweredCandidates = candidates.map((value) => clean(value).toLowerCase()).filter(Boolean);
    const headingMatch = sections.find((section) => {
      const heading = clean(section.querySelector("h1, h2, h3")?.textContent || "").toLowerCase();
      return loweredCandidates.some((candidate) => heading.includes(candidate.replace(/[-_]/g, " ")));
    });
    return headingMatch || null;
  }

  function markActiveNav(sectionId, sectionEl = null) {
    const resolved = clean(sectionEl?.id || resolveSectionId(sectionId));
    qsa("[data-section], .nav-btn").forEach((button) => {
      const raw = button.getAttribute("data-section") || button.dataset.section || "";
      const buttonResolved = clean(resolveSectionId(raw));
      button.classList.toggle("active", Boolean(resolved) && buttonResolved === resolved);
    });
  }

  function revealFallbackSections() {
    const sections = getDashboardSections();
    if (!sections.length) return;
    sections.forEach((section, index) => {
      section.style.display = index === 0 ? "block" : "none";
    });
    markActiveNav(sections[0].id || "", sections[0]);
    NS.state?.set?.("ui.activeSection", clean(sections[0].id || "overview"));
  }

  function showSection(sectionId, options = {}) {
    const target = findSectionElement(sectionId);
    const sections = getDashboardSections();

    if (!sections.length) return false;

    if (!target) {
      revealFallbackSections();
      return false;
    }

    sections.forEach((section) => {
      section.style.display = section === target ? "block" : "none";
    });

    markActiveNav(sectionId, target);
    const activeId = clean(target.id || resolveSectionId(sectionId) || sectionId);
    if (activeId) NS.state?.set?.("ui.activeSection", activeId);

    if (options.scroll !== false) {
      try {
        target.scrollIntoView({ block: "start", behavior: options.behavior || "auto" });
      } catch {}
    }
    return true;
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

  function bindExistingNavButtons() {
    qsa("[data-section], .nav-btn").forEach((button) => {
      if (button.dataset.eaBound === "true") return;
      const sectionId = clean(button.getAttribute("data-section") || button.dataset.section || "");
      if (!sectionId) return;
      button.dataset.eaBound = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showSection(sectionId, { scroll: false });
      });
    });
  }

  function reorderSidebarNav() {
    const nav = findSidebarNav();
    if (!nav) return;
    const desiredOrder = ["overview", "tools", "analytics", "compliance", "affiliate", "profile", "billing"];
    const buttons = qsa("[data-section]", nav);
    const byKey = new Map();

    buttons.forEach((button) => {
      const raw = clean(button.getAttribute("data-section") || button.dataset.section || "");
      const resolved = clean(resolveSectionId(raw));
      const key = raw || resolved;
      byKey.set(key, button);
      if (resolved && !byKey.has(resolved)) byKey.set(resolved, button);
    });

    desiredOrder.forEach((key) => {
      const button = byKey.get(key) || byKey.get(resolveSectionId(key));
      if (button) nav.appendChild(button);
    });
  }

  function bootSidebarNavRepair() {
    bindExistingNavButtons();
    reorderSidebarNav();
    const sections = getDashboardSections();
    if (!sections.length) return;
    const active = NS.state?.get?.("ui.activeSection") || sections[0].id || "overview";
    const shown = showSection(active, { scroll: false });
    if (!shown) revealFallbackSections();
  }

  NS.ui = { qs, qsa, clean, setText, setStatus, showSection, injectStyleOnce, findSectionElement, bindExistingNavButtons, reorderSidebarNav };
  window.showSection = showSection;
  NS.modules = NS.modules || {};
  NS.modules.ui = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSidebarNavRepair, { once: true });
  } else {
    bootSidebarNavRepair();
  }
})();