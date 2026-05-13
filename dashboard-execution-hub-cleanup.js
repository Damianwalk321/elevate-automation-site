(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.executionHubCleanup) return;

  const CSS = `
    #executionHubV2Shell{gap:16px}
    #executionHubV2Shell .xh-module-band{order:-20}
    #executionHubV2Shell .xh-hero-grid{order:-10}
    #executionHubV2Shell .xh-module-band{grid-template-columns:minmax(0,1fr) minmax(320px,.85fr);padding:18px 20px}
    #executionHubV2Shell .xh-module-band h2{font-size:28px;margin-bottom:6px}
    #executionHubV2Shell .xh-module-band-copy{font-size:14px}
    #executionHubV2Shell .xh-primary-card{padding:20px}
    #executionHubV2Shell .xh-side-card{padding:18px}
    #executionHubV2Shell .xh-title-row{margin-bottom:10px}
    #executionHubV2Shell .xh-title-row h2{font-size:30px;margin-bottom:6px}
    #executionHubV2Shell .xh-meta-grid,
    #executionHubV2Shell .xh-command-list,
    #executionHubP3Vehicle,
    #executionHubPlanCard{display:none !important}
    #executionHubV2Shell .xh-kpi-grid .xh-kpi-card:nth-child(n+5){display:none !important}
    #executionHubV2Shell .xh-workspace-head{margin-bottom:0}
    #executionHubV2Shell .xh-module-card{padding:18px}
    #executionHubV2Shell .xh-state-card,
    #executionHubV2Shell .xh-action-card,
    #executionHubV2Shell .xh-blocker-card,
    #executionHubV2Shell .xh-activity-card{padding:16px}
    #extension > *:not(#executionHubV2Shell):not(.main-header){display:none !important}
    @media (max-width: 1200px){
      #executionHubV2Shell .xh-module-band{grid-template-columns:1fr}
    }
  `;

  function ensureStyle() {
    if (document.getElementById('execution-hub-cleanup-style')) return;
    const style = document.createElement('style');
    style.id = 'execution-hub-cleanup-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }

  function relabelHeaderAndNav() {
    const section = document.getElementById('extension');
    if (section) {
      const h1 = section.querySelector('.main-header h1') || section.querySelector('h1');
      if (h1) h1.textContent = 'Execution Hub';
      const sub = section.querySelector('.main-header .subtext');
      if (sub) sub.textContent = 'Live execution surface for Vehicle Poster, posting readiness, and future platform modules.';
    }

    const labels = {
      overview: ['Command Centre', 'Overview'],
      tools: ['Execution Hub', 'Vehicle Poster, execution'],
      analytics: ['Intelligence Centre', 'Listings, review, performance'],
      compliance: ['Compliance', 'AB/BC readiness, disclosures'],
      partners: ['Partner Network', 'Affiliates, referrals, growth'],
      setup: ['Activation', 'Profile, dealer, activation'],
      billing: ['Plan & Access', 'Plan, access, usage']
    };
    document.querySelectorAll('.sidebar-nav .nav-btn').forEach((btn) => {
      const key = clean(btn.dataset.eaNavKey || btn.dataset.section || btn.getAttribute('data-section'));
      const item = labels[key];
      if (!item) return;
      const label = btn.querySelector('.ea-nav-label');
      const detail = btn.querySelector('.ea-nav-detail');
      if (label) label.textContent = item[0];
      if (detail) detail.textContent = item[1];
      btn.setAttribute('aria-label', item[0]);
    });
  }

  function moveModuleBandFirst() {
    const shell = document.getElementById('executionHubV2Shell');
    const band = shell?.querySelector('.xh-module-band');
    const hero = shell?.querySelector('.xh-hero-grid');
    if (!shell || !band || !hero) return;
    if (shell.firstElementChild !== band) shell.insertBefore(band, shell.firstElementChild);
    const primaryTitle = hero.querySelector('.xh-title-row h2');
    if (primaryTitle && /execution hub/i.test(primaryTitle.textContent)) {
      primaryTitle.textContent = 'Post next vehicle';
    }
  }

  function enhance() {
    ensureStyle();
    relabelHeaderAndNav();
    moveModuleBandFirst();
  }

  NS.modules = NS.modules || {};
  NS.modules.executionHubCleanup = true;
  window.addEventListener('load', () => setTimeout(enhance, 60));
  window.addEventListener('elevate:tracking-refreshed', () => setTimeout(enhance, 60));
  window.addEventListener('elevate:summary-ready', () => setTimeout(enhance, 60));
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(enhance, 60), { once: true });
  } else {
    setTimeout(enhance, 60);
  }
})();
