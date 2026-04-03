(() => {
  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function make(tag, attrs = {}, html = '') {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'class') el.className = value;
      else if (key === 'dataset' && value && typeof value === 'object') {
        Object.entries(value).forEach(([k, v]) => { el.dataset[k] = v; });
      } else {
        el.setAttribute(key, value);
      }
    });
    if (html) el.innerHTML = html;
    return el;
  }

  function applyStreamlinedOverview() {
    const overview = qs('#overview');
    if (!overview || overview.dataset.phase3Built === 'true') return;
    overview.dataset.phase3Built = 'true';

    const commandGrid = qs('.command-center-grid', overview);
    const operatorStrip = qs('.operator-strip', overview);
    const overviewCards = qsa(':scope > .card, :scope > .grid-2, :scope > .grid-4', overview);
    const actionRow = overviewCards.find((el) => el.classList.contains('grid-2'));
    const upgradeCard = qsa('.upgrade-card', overview)[0];
    const kpiGrid = qsa('.grid-4', overview)[0];
    const listingsCard = qsa('.card', overview).find((card) => qs('#recentListingsGrid', card));
    const bottomGrid = qsa('.grid-2', overview).find((grid) => qs('#snapshotSetupSummary', grid) || qs('#setupReadinessSummary', grid));

    const shell = make('div', { class: 'phase3-overview-shell' });
    const coreGroup = make('div', { class: 'phase3-overview-group', dataset: { group: 'core' } });
    const listingsGroup = make('div', { class: 'phase3-overview-group', dataset: { group: 'listings' } });
    const secondaryGroup = make('div', { class: 'phase3-overview-group phase3-quiet', dataset: { group: 'secondary' } });

    const toolbar = make('div', { class: 'phase3-toolbar' }, `
      <div>
        <span class="phase3-section-tag">Operator Focus</span>
      </div>
      <div class="phase3-segment" id="phase3OverviewSegment">
        <button type="button" data-mode="core" class="active">Core</button>
        <button type="button" data-mode="listings">Listings</button>
        <button type="button" data-mode="secondary">Secondary</button>
        <button type="button" data-mode="all">All</button>
      </div>
    `);

    overview.prepend(shell);
    shell.appendChild(toolbar);
    shell.appendChild(coreGroup);
    shell.appendChild(listingsGroup);
    shell.appendChild(secondaryGroup);

    [commandGrid, operatorStrip, actionRow, kpiGrid].filter(Boolean).forEach((el) => coreGroup.appendChild(el));
    [listingsCard].filter(Boolean).forEach((el) => listingsGroup.appendChild(el));

    if (upgradeCard) {
      upgradeCard.classList.add('phase3-muted-block');
      secondaryGroup.appendChild(upgradeCard);
    }

    if (bottomGrid) {
      const collapse = make('div', { class: 'phase3-collapse open' });
      const head = make('div', { class: 'phase3-collapse-head' }, `
        <div>
          <div class="phase3-section-tag">Secondary Detail</div>
          <strong>Account Snapshot & Setup Readiness</strong>
        </div>
        <div class="subtext">Collapse</div>
      `);
      const body = make('div', { class: 'phase3-collapse-body' });
      const inner = make('div', { class: 'phase3-secondary-grid' });
      inner.appendChild(bottomGrid);
      body.appendChild(inner);
      collapse.appendChild(head);
      collapse.appendChild(body);
      secondaryGroup.appendChild(collapse);

      head.addEventListener('click', () => {
        collapse.classList.toggle('open');
        const sub = qs('.subtext', head);
        if (sub) sub.textContent = collapse.classList.contains('open') ? 'Collapse' : 'Expand';
      });
    }

    if (listingsCard) {
      listingsCard.classList.add('phase3-listings-shell');
      const head = qs('.section-head', listingsCard);
      if (head) {
        head.classList.add('phase3-listings-head');
        const left = head.firstElementChild;
        if (left && !qs('.phase3-section-tag', left)) {
          const tag = make('div', { class: 'phase3-section-tag' }, 'Live Listings');
          left.prepend(tag);
        }
      }
    }

    const segment = qs('#phase3OverviewSegment');
    if (segment) {
      const buttons = qsa('button', segment);
      const groups = {
        core: [coreGroup],
        listings: [listingsGroup],
        secondary: [secondaryGroup],
        all: [coreGroup, listingsGroup, secondaryGroup]
      };

      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          buttons.forEach((b) => b.classList.toggle('active', b === button));
          const mode = button.dataset.mode || 'all';
          [coreGroup, listingsGroup, secondaryGroup].forEach((group) => group.classList.add('phase3-hidden'));
          (groups[mode] || groups.all).forEach((group) => group.classList.remove('phase3-hidden'));
        });
      });
    }
  }

  function softenSecondarySections() {
    ['#extension', '#tools', '#affiliate', '#billing', '#compliance', '#profile'].forEach((selector) => {
      const section = qs(selector);
      if (!section) return;
      const firstCard = qsa('.card', section)[0];
      if (firstCard && !qs('.phase3-section-tag', firstCard)) {
        const head = qs('.section-head', firstCard) || qs('h2', firstCard);
        if (head && head.parentElement) {
          const tag = make('div', { class: 'phase3-section-tag', style: 'margin-bottom:10px;' }, section.id === 'tools' ? 'Analytics' : section.id.charAt(0).toUpperCase() + section.id.slice(1));
          head.parentElement.insertBefore(tag, head);
        }
      }
    });
  }

  function bootstrap() {
    applyStreamlinedOverview();
    softenSecondarySections();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  window.__ELEVATE_DASHBOARD_PHASE3__ = true;
})();
