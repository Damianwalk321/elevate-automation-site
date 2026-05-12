(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.ui) return;

  function qs(selector, root = document) { return root.querySelector(selector); }
  function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function lower(value) { return clean(value).toLowerCase(); }

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

  function canonicalNavKey(button) {
    const text = lower(button.textContent || "");
    if (text === "overview") return "overview";
    if (text === "tools") return "tools";
    if (text === "analytics") return "analytics";
    if (text === "compliance") return "compliance";
    if (text === "partners") return "partners";
    if (text === "setup") return "setup";
    if (text === "billing") return "billing";

    const raw = clean(button.getAttribute("data-section") || button.dataset.section || "");
    const resolved = clean(resolveSectionId(raw));
    if (resolved === "overview") return "overview";
    if (resolved === "extension" || resolved === "tools") return "tools";
    if (resolved === "analytics") return "analytics";
    if (resolved === "compliance") return "compliance";
    if (resolved === "affiliate" || resolved === "partners") return "partners";
    if (resolved === "profile" || resolved === "setup") return "setup";
    if (resolved === "billing") return "billing";
    return raw || resolved || text;
  }

  function reorderSidebarNav() {
    const nav = findSidebarNav();
    if (!nav) return;

    const desiredOrder = ["overview", "tools", "analytics", "compliance", "partners", "setup", "billing"];
    const buttons = qsa("[data-section]", nav);
    const buckets = new Map();

    buttons.forEach((button) => {
      const key = canonicalNavKey(button);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(button);
    });

    desiredOrder.forEach((key) => {
      (buckets.get(key) || []).forEach((button) => nav.appendChild(button));
      buckets.delete(key);
    });

    Array.from(buckets.values()).flat().forEach((button) => nav.appendChild(button));
  }

  function pinSidebarOrder() {
    const nav = findSidebarNav();
    if (!nav || nav.dataset.eaPinned === "true") return;
    nav.dataset.eaPinned = "true";
    let runs = 0;
    const interval = setInterval(() => {
      reorderSidebarNav();
      runs += 1;
      if (runs >= 40) clearInterval(interval);
    }, 250);
  }

  function bootSidebarNavRepair() {
    bindExistingNavButtons();
    reorderSidebarNav();
    pinSidebarOrder();
    setTimeout(reorderSidebarNav, 50);
    setTimeout(reorderSidebarNav, 250);
    setTimeout(reorderSidebarNav, 1000);
    setTimeout(reorderSidebarNav, 2500);
    const sections = getDashboardSections();
    if (!sections.length) return;
    const active = NS.state?.get?.("ui.activeSection") || sections[0].id || "overview";
    const shown = showSection(active, { scroll: false });
    if (!shown) revealFallbackSections();
  }

  NS.ui = { qs, qsa, clean, setText, setStatus, showSection, injectStyleOnce, findSectionElement, bindExistingNavButtons, reorderSidebarNav, pinSidebarOrder };
  window.showSection = showSection;
  NS.modules = NS.modules || {};
  NS.modules.ui = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSidebarNavRepair, { once: true });
  } else {
    bootSidebarNavRepair();
  }
})();