(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  const MODULE_KEY = "phase21shellshim";
  const SECTION_LISTINGS = "listings";
  const SECTION_REVIEW = "review_center";

  if (NS.modules?.[MODULE_KEY]) return;

  const state = {
    navBound: false,
    truthBound: false,
    sectionsEnsured: false,
    activeSection: "overview"
  };

  const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  function truthReady() {
    const truth = NS.accountTruth || {};
    return Boolean(NS.truthReady || truth.truth_ready || truth.user_id || truth.email);
  }

  function suppressStaleStatusUI() {
    if (!truthReady()) return;

    const bootStatus = document.getElementById("bootStatus");
    if (
      bootStatus &&
      /session expired|redirecting to login|checking login session|syncing account record/i.test(clean(bootStatus.textContent))
    ) {
      bootStatus.textContent = "";
    }

    const welcomeText = document.getElementById("welcomeText");
    if (
      welcomeText &&
      /loading your operator workspace|loading next best actions/i.test(clean(welcomeText.textContent))
    ) {
      welcomeText.textContent = "Workspace ready.";
    }
  }

  function ensureNavButtons() {
    const nav = qs(".sidebar-nav");
    if (!nav) return;
    const placeBefore = nav.querySelector('[data-section="tools"]') || null;

    if (!nav.querySelector(`[data-section="${SECTION_LISTINGS}"]`)) {
      const btn = document.createElement("button");
      btn.className = "nav-btn";
      btn.type = "button";
      btn.setAttribute("data-section", SECTION_LISTINGS);
      btn.textContent = "Listings";
      nav.insertBefore(btn, placeBefore);
    }

    if (!nav.querySelector(`[data-section="${SECTION_REVIEW}"]`)) {
      const btn = document.createElement("button");
      btn.className = "nav-btn";
      btn.type = "button";
      btn.setAttribute("data-section", SECTION_REVIEW);
      btn.textContent = "Review Center";
      nav.insertBefore(btn, placeBefore);
    }
  }

  function sectionShell(id, title, subtitle) {
    const section = document.createElement("section");
    section.id = id;
    section.className = "dashboard-section";
    section.style.display = "none";
    section.innerHTML = `
      <div class="card">
        <div class="eyebrow">${title}</div>
        <h2>${title}</h2>
        <div class="subtext">${subtitle}</div>
      </div>
    `;
    return section;
  }

  function ensureSections() {
    if (state.sectionsEnsured) return;
    const mainInner = qs(".main-inner");
    if (!mainInner) return;

    if (!document.getElementById(SECTION_LISTINGS)) {
      mainInner.appendChild(sectionShell(SECTION_LISTINGS, "Listings", "Listings workspace is available from the live dashboard runtime."));
    }

    if (!document.getElementById(SECTION_REVIEW)) {
      mainInner.appendChild(sectionShell(SECTION_REVIEW, "Review Center", "Review queues are managed by the live dashboard runtime."));
    }

    state.sectionsEnsured = true;
  }

  function visibleSections() {
    return qsa(".dashboard-section").filter((section) => section && section.offsetParent !== null && section.style.display !== "none");
  }

  function pickDefaultSection() {
    const visible = visibleSections();
    if (visible.find((section) => section.id === "overview")) return "overview";
    if (visible[0]?.id) return visible[0].id;
    return state.activeSection || "overview";
  }

  function showSection(sectionId, { force = false } = {}) {
    const targetId = clean(sectionId || pickDefaultSection());
    if (!targetId) return;

    const sections = qsa(".dashboard-section");
    if (!sections.length) return;

    const target = document.getElementById(targetId);
    if (!target) return;

    const currentlyVisible = visibleSections();
    if (!force && currentlyVisible.length === 1 && currentlyVisible[0].id === targetId) {
      state.activeSection = targetId;
      return;
    }

    sections.forEach((section) => {
      section.style.display = section.id === targetId ? "block" : "none";
    });

    qsa(".nav-btn[data-section]").forEach((btn) => {
      const active = btn.getAttribute("data-section") === targetId;
      btn.classList.toggle("active", active);
    });

    state.activeSection = targetId;
  }

  function bindNav() {
    if (state.navBound) return;
    state.navBound = true;

    document.addEventListener("click", (event) => {
      const btn = event.target.closest(".nav-btn[data-section]");
      if (!btn) return;
      const sectionId = clean(btn.getAttribute("data-section"));
      if (!sectionId) return;
      if (!document.getElementById(sectionId)) return;
      showSection(sectionId, { force: true });
    });
  }

  function bindTruthEvents() {
    if (state.truthBound) return;
    state.truthBound = true;

    const onTruth = () => {
      suppressStaleStatusUI();
      if (!visibleSections().length) {
        showSection(pickDefaultSection(), { force: true });
      }
    };

    window.addEventListener("elevate:account-truth", onTruth);
    window.addEventListener("elevate:sync-refreshed", onTruth);
  }

  function boot() {
    ensureNavButtons();
    ensureSections();
    bindNav();
    bindTruthEvents();
    suppressStaleStatusUI();

    if (!visibleSections().length) {
      showSection(pickDefaultSection(), { force: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  NS.phase21shellshim = {
    showSection,
    suppressStaleStatusUI
  };
  NS.modules = NS.modules || {};
  NS.modules[MODULE_KEY] = true;
})();
