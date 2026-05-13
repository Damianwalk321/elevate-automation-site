(() => {
  if (window.__ELEVATE_DASHBOARD_NAV_HOTFIX__) return;
  window.__ELEVATE_DASHBOARD_NAV_HOTFIX__ = true;

  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function getSections() {
    return Array.from(document.querySelectorAll('.dashboard-section')).filter(Boolean);
  }

  function desiredNavOrder() {
    return ['overview', 'tools', 'analytics', 'compliance', 'partners', 'setup', 'billing'];
  }

  function aliasMap() {
    return {
      overview: ['overview', 'overviewSection', 'overview-section'],
      tools: ['extension', 'extensionSection', 'extension-section', 'tools-panel'],
      analytics: ['analytics', 'analyticsSection', 'analytics-section', 'tools', 'toolsSection', 'tools-section'],
      compliance: ['compliance', 'complianceSection', 'compliance-section'],
      partners: ['partners', 'partnersSection', 'partners-section', 'affiliate'],
      setup: ['setup', 'setupSection', 'setup-section', 'profile'],
      billing: ['billing', 'billingSection', 'billing-section']
    };
  }

  function resolveSectionElement(sectionId) {
    const requested = clean(sectionId);
    if (!requested) return null;
    const aliases = aliasMap()[requested] || [requested];
    for (const id of aliases) {
      const direct = document.getElementById(id);
      if (direct) return direct;
    }
    const sections = getSections();
    for (const id of aliases) {
      const matched = sections.find((section) => clean(section.id) === clean(id));
      if (matched) return matched;
    }
    return null;
  }

  function markActive(sectionId, sectionEl = null) {
    const resolved = clean(sectionEl?.id || resolveSectionElement(sectionId)?.id || sectionId);
    document.querySelectorAll('.sidebar-nav .nav-btn').forEach((button, index) => {
      const key = clean(button.dataset.eaNavKey || desiredNavOrder()[index] || 'overview');
      const buttonResolved = clean(resolveSectionElement(key)?.id || key);
      button.classList.toggle('active', Boolean(resolved) && buttonResolved === resolved);
    });
  }

  function patchedShowSection(sectionId, options = {}) {
    const target = resolveSectionElement(sectionId);
    const sections = getSections();
    if (!sections.length || !target) return false;

    sections.forEach((section) => {
      section.style.display = section === target ? 'block' : 'none';
    });

    markActive(sectionId, target);
    if (clean(target.id)) NS.state?.set?.('ui.activeSection', clean(target.id));

    if (options.scroll !== false) {
      try {
        target.scrollIntoView({ block: 'start', behavior: options.behavior || 'auto' });
      } catch {}
    }
    return true;
  }

  function bindSidebar() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav || nav.dataset.eaNavHotfixBound === 'true') return;
    nav.dataset.eaNavHotfixBound = 'true';

    nav.addEventListener('click', (event) => {
      const button = event.target.closest('.nav-btn');
      if (!button || !nav.contains(button)) return;
      const buttons = Array.from(nav.querySelectorAll('.nav-btn')).filter(Boolean);
      const index = buttons.indexOf(button);
      const key = desiredNavOrder()[index] || clean(button.dataset.eaNavKey || 'overview');
      event.preventDefault();
      event.stopImmediatePropagation();
      patchedShowSection(key, { scroll: false });
    }, true);
  }

  function boot() {
    window.showSection = patchedShowSection;
    bindSidebar();
    const active = NS.state?.get?.('ui.activeSection') || 'overview';
    patchedShowSection(active, { scroll: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener('load', boot);
})();
