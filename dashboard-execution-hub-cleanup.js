(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.executionHubCleanup) return;

  const CSS = `
    #executionHubV2Shell{gap:16px}
    #executionHubV2Shell .xh-hero-grid{order:2}
    #executionHubV2Shell .xh-module-card{order:3}
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
    .execution-hub-cleanup-band{order:1;display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.85fr);gap:16px;align-items:end;background:#121212;border:1px solid rgba(212,175,55,.14);border-radius:22px;padding:18px 20px;box-shadow:0 10px 30px rgba(0,0,0,.28)}
    .execution-hub-cleanup-band h2{font-size:28px;line-height:1.06;margin-bottom:6px}
    .execution-hub-cleanup-band-copy{color:#a9a9a9;line-height:1.55;max-width:760px}
    .execution-hub-cleanup-select-wrap{display:grid;gap:8px;min-width:280px}
    .execution-hub-cleanup-select-wrap label{font-size:12px;color:#d4af37;font-weight:800;letter-spacing:1.3px;text-transform:uppercase}
    .execution-hub-cleanup-select-row{display:flex;gap:12px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
    .execution-hub-cleanup-select-row .xh-module-select{min-width:280px}
    #executionHubV2Shell .xh-module-select-row{display:none !important}
    #extension .card,
    #extension [class*="extension-"]{ }
    .execution-hub-hide-legacy{display:none !important}
    @media (max-width: 1200px){
      .execution-hub-cleanup-band{grid-template-columns:1fr}
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

  function buildTopModuleBand() {
    const shell = document.getElementById('executionHubV2Shell');
    if (!shell) return;

    let band = document.getElementById('executionHubCleanupBand');
    const sourceSelect = shell.querySelector('#executionHubModuleSelect');
    const sourceStatus = shell.querySelector('.xh-workspace-head .xh-module-status') || shell.querySelector('.xh-module-status');
    if (!sourceSelect) return;

    if (!band) {
      band = document.createElement('div');
      band.id = 'executionHubCleanupBand';
      band.className = 'execution-hub-cleanup-band';
      band.innerHTML = `
        <div>
          <div class="xh-eyebrow">Execution Module</div>
          <h2>Execution Hub</h2>
          <div class="execution-hub-cleanup-band-copy">Select the execution layer you want to view. Vehicle Poster remains the live flagship tool.</div>
        </div>
        <div class="execution-hub-cleanup-select-wrap">
          <label for="executionHubModuleSelectClone">Execution Module</label>
          <div class="execution-hub-cleanup-select-row">
            <select id="executionHubModuleSelectClone" class="xh-module-select"></select>
            <div class="xh-module-status" id="executionHubCleanupStatus">Live Now</div>
          </div>
        </div>
      `;
      shell.prepend(band);
    }

    const clone = band.querySelector('#executionHubModuleSelectClone');
    clone.innerHTML = sourceSelect.innerHTML;
    clone.value = sourceSelect.value;
    const status = band.querySelector('#executionHubCleanupStatus');
    if (status && sourceStatus) status.textContent = clean(sourceStatus.textContent || 'Live Now');

    if (clone.dataset.boundCleanup !== 'true') {
      clone.dataset.boundCleanup = 'true';
      clone.addEventListener('change', () => {
        sourceSelect.value = clone.value;
        sourceSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
  }

  function simplifyHero() {
    const shell = document.getElementById('executionHubV2Shell');
    if (!shell) return;
    const hero = shell.querySelector('.xh-hero-grid');
    if (!hero) return;
    const title = hero.querySelector('.xh-title-row h2');
    if (title && /execution hub/i.test(title.textContent)) title.textContent = 'Post next vehicle';
  }

  function hideLegacyCards() {
    const section = document.getElementById('extension');
    if (!section) return;
    Array.from(section.querySelectorAll('.card')).forEach((card) => {
      if (card.closest('#executionHubV2Shell')) return;
      card.classList.add('execution-hub-hide-legacy');
    });
    Array.from(section.children).forEach((child) => {
      if (child.id === 'executionHubV2Shell') return;
      if (child.classList?.contains('main-header')) return;
      if (child.matches?.('.card')) child.classList.add('execution-hub-hide-legacy');
    });
  }

  function enhance() {
    ensureStyle();
    relabelHeaderAndNav();
    buildTopModuleBand();
    simplifyHero();
    hideLegacyCards();
  }

  NS.modules = NS.modules || {};
  NS.modules.executionHubCleanup = true;
  window.addEventListener('load', () => setTimeout(enhance, 80));
  window.addEventListener('elevate:tracking-refreshed', () => setTimeout(enhance, 80));
  window.addEventListener('elevate:summary-ready', () => setTimeout(enhance, 80));
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(enhance, 80), { once: true });
  } else {
    setTimeout(enhance, 80);
  }
})();
