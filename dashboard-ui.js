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

  function desiredNavOrder() {
    return ['overview', 'tools', 'analytics', 'compliance', 'partners', 'setup', 'billing'];
  }

  function canonicalNavKey(button) {
    const slot = Number(button.dataset.eaNavSlot);
    const order = desiredNavOrder();
    if (Number.isInteger(slot) && order[slot]) return order[slot];

    const raw = clean(button.dataset.eaOriginalSection || button.getAttribute('data-section') || button.dataset.section || '');
    const resolved = clean(resolveSectionId(raw));
    if (resolved === 'overview') return 'overview';
    if (resolved === 'extension' || resolved === 'tools') return 'tools';
    if (resolved === 'analytics') return 'analytics';
    if (resolved === 'compliance') return 'compliance';
    if (resolved === 'affiliate' || resolved === 'partners') return 'partners';
    if (resolved === 'profile' || resolved === 'setup') return 'setup';
    if (resolved === 'billing') return 'billing';

    const text = lower(button.textContent || '');
    if (text.includes('command centre') || text === 'overview') return 'overview';
    if (text.includes('tools')) return 'tools';
    if (text.includes('analytics')) return 'analytics';
    if (text.includes('compliance')) return 'compliance';
    if (text.includes('partners')) return 'partners';
    if (text.includes('setup')) return 'setup';
    if (text.includes('billing')) return 'billing';

    return raw || resolved || 'overview';
  }

  function markActiveNav(sectionId, sectionEl = null) {
    const resolved = clean(sectionEl?.id || resolveSectionId(sectionId));
    qsa("[data-section], .nav-btn").forEach((button) => {
      const buttonResolved = clean(resolveSectionId(canonicalNavKey(button)) || canonicalNavKey(button));
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

  function sidebarNavMeta() {
    return {
      overview: {
        label: "Command Centre",
        detail: "Overview",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="6" height="6" rx="1.3"></rect><rect x="14.5" y="4.5" width="6" height="6" rx="1.3"></rect><rect x="3.5" y="15.5" width="6" height="6" rx="1.3"></rect><path d="M17.5 15.5v6"></path><path d="M14.5 18.5h6"></path></svg>`
      },
      tools: {
        label: "Tools",
        detail: "Posting, queue, extension",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a4.5 4.5 0 0 0-5.96 5.96L4 17l3 3 4.74-4.74a4.5 4.5 0 0 0 5.96-5.96l-2.02 2.02-3-3z"></path></svg>`
      },
      analytics: {
        label: "Analytics",
        detail: "Listings, review, performance",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5h16"></path><path d="M7 16V9"></path><path d="M12 16V5"></path><path d="M17 16v-4"></path></svg>`
      },
      compliance: {
        label: "Compliance",
        detail: "AB/BC readiness, disclosures",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-2.7 7.9-7 10-4.3-2.1-7-5.5-7-10V6l7-3z"></path><path d="m9.5 12 1.7 1.7 3.3-3.7"></path></svg>`
      },
      partners: {
        label: "Partners",
        detail: "Affiliates, referrals, growth",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path><path d="M16 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"></path><path d="M3.5 19c.8-2.5 3-4 5.5-4s4.7 1.5 5.5 4"></path><path d="M13.5 18c.5-1.7 1.9-2.8 3.8-2.8 1.3 0 2.5.6 3.2 1.6"></path></svg>`
      },
      setup: {
        label: "Setup",
        detail: "Profile, dealer, activation",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"></circle><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.3 1.3 0 0 1 0 1.9l-.9.9a1.3 1.3 0 0 1-1.9 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.3 1.3 0 0 1-1.3 1.3h-1.3A1.3 1.3 0 0 1 11.2 20v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.3 1.3 0 0 1-1.9 0l-.9-.9a1.3 1.3 0 0 1 0-1.9l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4.8A1.3 1.3 0 0 1 3.5 13.1v-1.3a1.3 1.3 0 0 1 1.3-1.3H5a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.3 1.3 0 0 1 0-1.9l.9-.9a1.3 1.3 0 0 1 1.9 0l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4.8A1.3 1.3 0 0 1 11.5 3.5h1.3a1.3 1.3 0 0 1 1.3 1.3V5a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.3 1.3 0 0 1 1.9 0l.9.9a1.3 1.3 0 0 1 0 1.9l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6h.2a1.3 1.3 0 0 1 1.3 1.3v1.3a1.3 1.3 0 0 1-1.3 1.3h-.2a1 1 0 0 0-.9.6z"></path></svg>`
      },
      billing: {
        label: "Billing",
        detail: "Plan, access, usage",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2"></rect><path d="M3.5 9.5h17"></path><path d="M7.5 14.5h3"></path></svg>`
      }
    };
  }

  function sidebarChromeCss() {
    return `
      .sidebar{padding:22px 18px;gap:16px}
      .brand-wrap.ea-sidebar-brand{padding:0 0 18px;border-bottom:1px solid rgba(212,175,55,.16)}
      .ea-brand-head{display:flex;align-items:flex-start;gap:12px}
      .ea-brand-badge{display:grid;place-items:center;min-width:44px;width:44px;height:44px;border-radius:16px;border:1px solid rgba(212,175,55,.42);background:rgba(212,175,55,.10);color:var(--gold)}
      .ea-brand-badge svg{width:20px;height:20px}
      .ea-brand-copy{min-width:0}
      .ea-brand-overline{color:var(--gold);font-size:11px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;margin-bottom:8px}
      .ea-brand-title{font-size:20px;font-weight:800;line-height:1.06;letter-spacing:-.02em;color:var(--text)}
      .ea-brand-subtitle{margin-top:10px;color:var(--muted);font-size:13px;line-height:1.55}
      .sidebar-card.ea-session-card{border-radius:18px;padding:16px;background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0));border:1px solid rgba(212,175,55,.16);position:relative}
      .ea-session-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
      .ea-session-label-wrap{display:inline-flex;align-items:center;gap:7px;min-width:0}
      .ea-session-label{font-size:12px;color:var(--gold);text-transform:uppercase;letter-spacing:1.4px;font-weight:800}
      .ea-session-crown{display:inline-flex;align-items:center;justify-content:center;color:var(--gold-soft);opacity:.95}
      .ea-session-crown svg{width:12px;height:12px;display:block}
      .ea-live-dot{width:9px;height:9px;border-radius:999px;background:#62d26f;box-shadow:0 0 0 4px rgba(98,210,111,.12)}
      .ea-session-name{font-size:16px;color:var(--text);font-weight:700;word-break:break-word}
      .ea-session-email,.user-email{font-size:14px;color:var(--text);word-break:break-word}
      .ea-hidden-identity{position:absolute !important;left:-9999px !important;top:auto !important;width:1px !important;height:1px !important;overflow:hidden !important;opacity:0 !important;pointer-events:none !important}
      .sidebar-nav{gap:10px}
      .nav-btn.ea-nav-enhanced{display:block;padding:0;overflow:hidden;border-radius:18px;border:1px solid rgba(255,255,255,.06);background:#121212;min-height:0}
      .nav-btn.ea-nav-enhanced:hover{background:#161616;border-color:rgba(212,175,55,.18)}
      .nav-btn.ea-nav-enhanced.active{background:linear-gradient(135deg, rgba(212,175,55,.16), rgba(212,175,55,.05));border-color:rgba(212,175,55,.52)}
      .ea-nav-inner{display:flex;align-items:flex-start;gap:12px;padding:14px 14px 13px}
      .ea-nav-icon{display:grid;place-items:center;width:18px;height:18px;color:#a5a5a5;flex:0 0 18px;margin-top:1px}
      .nav-btn.active .ea-nav-icon{color:var(--gold-soft)}
      .ea-nav-icon svg{width:18px;height:18px}
      .ea-nav-copy{min-width:0}
      .ea-nav-label{display:block;font-size:14px;font-weight:700;line-height:1.25;color:#f4f4f4}
      .ea-nav-detail{display:block;margin-top:5px;font-size:11px;line-height:1.35;color:var(--muted)}
    `;
  }

  function enhanceSidebarBrand() {
    const brand = qs('.brand-wrap');
    if (!brand) return;
    injectStyleOnce('elevate-sidebar-upgrade', sidebarChromeCss());
    brand.classList.add('ea-sidebar-brand');
    brand.innerHTML = `
      <div class="ea-brand-head">
        <div class="ea-brand-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3.5 5.5 7v10L12 20.5 18.5 17V7L12 3.5Z"></path>
            <path d="M8.5 10.5 12 8l3.5 2.5"></path>
            <path d="M12 8v8"></path>
          </svg>
        </div>
        <div class="ea-brand-copy">
          <div class="ea-brand-overline">Elevate Automation</div>
          <div class="ea-brand-title">Elevate Operator Console</div>
          <div class="ea-brand-subtitle">Sales automation command center</div>
        </div>
      </div>
    `;
  }

  function pickOperatorProfile() {
    const stateUser = NS.state?.get?.('user', {}) || {};
    const stateProfile = NS.state?.get?.('profile', {}) || {};
    const stateSession = NS.state?.get?.('session', {}) || {};
    const summary = window.dashboardSummary || NS.state?.get?.('summary_v2', {}) || {};
    const currentUser = window.currentUser || {};

    const email = clean(
      currentUser.email ||
      stateUser.email ||
      stateProfile.email ||
      stateSession.email ||
      summary.email ||
      qs('.sidebar-card .user-email')?.textContent ||
      ''
    );

    const fullName = clean(
      currentUser.user_metadata?.full_name ||
      currentUser.user_metadata?.name ||
      currentUser.full_name ||
      currentUser.name ||
      stateProfile.full_name ||
      stateProfile.name ||
      stateUser.full_name ||
      stateUser.name ||
      stateSession.full_name ||
      stateSession.name ||
      summary.full_name ||
      summary.name ||
      ''
    );

    let firstName = clean(fullName.split(' ')[0] || '');
    if (!firstName && email && !/loading/i.test(email)) {
      firstName = clean(email.split('@')[0].split(/[._-]/)[0] || '');
      firstName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : '';
    }

    return {
      email: email || 'Loading...',
      firstName: firstName || 'Loading...'
    };
  }

  function enhanceSessionCard() {
    const label = qsa('.sidebar-card-label').find((el) => {
      const value = lower(el.textContent || '');
      return value === 'logged in' || value === 'operator';
    });
    const card = label?.closest('.sidebar-card');
    if (!card) return;

    const profile = pickOperatorProfile();
    card.classList.add('ea-session-card');
    card.innerHTML = `
      <div class="ea-session-head">
        <div class="ea-session-label-wrap">
          <div class="ea-session-label">Operator</div>
          <span class="ea-session-crown" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 8 4.5 4 4.5-7 4.5 7L21 8l-2 10H5L3 8Z"></path>
              <path d="M5 18h14"></path>
            </svg>
          </span>
        </div>
        <span class="ea-live-dot" aria-hidden="true"></span>
      </div>
      <div class="ea-session-name">${profile.firstName}</div>
      <div class="sidebar-card-label ea-hidden-identity">Operator</div>
      <div class="sidebar-card-value user-email ea-hidden-identity">${profile.email}</div>
    `;
  }

  function stampSidebarNavSlots() {
    const nav = findSidebarNav();
    if (!nav) return;
    const slots = desiredNavOrder();
    qsa('.nav-btn, [data-section]', nav)
      .filter((button, index, array) => array.indexOf(button) === index)
      .forEach((button, index) => {
        if (!button.dataset.eaNavSlot) button.dataset.eaNavSlot = String(index);
        if (!button.dataset.eaOriginalSection) button.dataset.eaOriginalSection = clean(button.getAttribute('data-section') || button.dataset.section || '');
        button.dataset.eaNavKey = slots[index] || canonicalNavKey(button);
      });
  }

  function bindExistingNavButtons() {
    stampSidebarNavSlots();
    qsa('[data-section], .nav-btn').forEach((button) => {
      if (button.dataset.eaBound === 'true') return;
      button.dataset.eaBound = 'true';
      button.addEventListener('click', (event) => {
        const sectionId = clean(resolveSectionId(canonicalNavKey(button)) || canonicalNavKey(button));
        if (!sectionId) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        showSection(sectionId, { scroll: false });
      }, true);
    });
  }

  function enhanceSidebarNavVisuals() {
    injectStyleOnce('elevate-sidebar-upgrade', sidebarChromeCss());
    stampSidebarNavSlots();
    const meta = sidebarNavMeta();
    qsa('.sidebar-nav .nav-btn').forEach((button) => {
      const key = canonicalNavKey(button);
      const item = meta[key];
      if (!item) return;
      const currentActive = button.classList.contains('active');
      button.classList.add('ea-nav-enhanced');
      button.dataset.eaNavKey = key;
      button.dataset.section = key;
      button.setAttribute('data-section', key);
      button.setAttribute('aria-label', item.label);
      button.innerHTML = `
        <span class="ea-nav-inner">
          <span class="ea-nav-icon" aria-hidden="true">${item.icon}</span>
          <span class="ea-nav-copy">
            <span class="ea-nav-label">${item.label}</span>
            <span class="ea-nav-detail">${item.detail}</span>
          </span>
        </span>
      `;
      if (currentActive) button.classList.add('active');
    });
  }

  function reorderSidebarNav() {
    const nav = findSidebarNav();
    if (!nav) return;
    stampSidebarNavSlots();
    const order = desiredNavOrder();
    const buttons = qsa('.nav-btn, [data-section]', nav).filter((button, index, array) => array.indexOf(button) === index);
    const keyed = new Map();
    const leftovers = [];

    buttons.forEach((button) => {
      const key = canonicalNavKey(button);
      if (order.includes(key) && !keyed.has(key)) keyed.set(key, button);
      else leftovers.push(button);
    });

    order.forEach((key) => {
      const button = keyed.get(key);
      if (button) nav.appendChild(button);
    });
    leftovers.forEach((button) => nav.appendChild(button));
  }

  function bindSidebarIdentityRefresh() {
    if (window.__ELEVATE_SIDEBAR_IDENTITY_BOUND__) return;
    window.__ELEVATE_SIDEBAR_IDENTITY_BOUND__ = true;
    const rerender = () => setTimeout(() => enhanceSessionCard(), 80);
    window.addEventListener('elevate:summary-ready', rerender);
    window.addEventListener('elevate:auth-ready', rerender);
    window.addEventListener('elevate:account-truth', rerender);
  }

  function bootSidebarNavRepair() {
    reorderSidebarNav();
    enhanceSidebarBrand();
    enhanceSessionCard();
    enhanceSidebarNavVisuals();
    bindExistingNavButtons();
    bindSidebarIdentityRefresh();
    const sections = getDashboardSections();
    if (!sections.length) return;
    const active = NS.state?.get?.('ui.activeSection') || sections[0].id || 'overview';
    const shown = showSection(active, { scroll: false });
    if (!shown) revealFallbackSections();
  }

  NS.ui = {
    qs,
    qsa,
    clean,
    setText,
    setStatus,
    showSection,
    injectStyleOnce,
    findSectionElement,
    bindExistingNavButtons,
    reorderSidebarNav,
    enhanceSidebarBrand,
    enhanceSidebarNavVisuals,
    enhanceSessionCard
  };
  window.showSection = showSection;
  NS.modules = NS.modules || {};
  NS.modules.ui = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSidebarNavRepair, { once: true });
  } else {
    bootSidebarNavRepair();
  }
})();