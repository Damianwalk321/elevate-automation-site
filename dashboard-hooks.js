(() => {
  const GOLD = '#d4af37';

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function setText(id, text) {
    qsa(`#${id}`).forEach((el) => { el.textContent = text || ''; });
  }

  function ensureRootAccent() {
    document.documentElement.style.setProperty('--accent', GOLD);
  }

  function showReadModal({ eyebrow = 'Dashboard', title = 'Preview', subtitle = '', body = '' } = {}) {
    const modal = qs('#readCopyModal');
    if (!modal) return;
    setText('readCopyModalEyebrow', eyebrow);
    setText('readCopyModalTitle', title);
    setText('readCopyModalSubtitle', subtitle);
    const bodyEl = qs('#readCopyModalBody');
    if (bodyEl) bodyEl.textContent = body;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeReadModal() {
    const modal = qs('#readCopyModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function closeListingModal() {
    const modal = qs('#listingDetailModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function getPlanLabel() {
    const badge = qs('#planNameBilling') || qs('#overviewPlanChip') || qs('#extensionPlan');
    return clean(badge?.textContent || 'Founder Beta');
  }

  function getUpgradeCopy(scope = 'overview') {
    const plan = getPlanLabel();
    const common = [
      `Current plan: ${plan}`,
      '',
      'Upgrade unlock path:',
      '• higher daily posting capacity',
      '• cleaner workflow leverage',
      '• more automation and intelligence surfaces',
      '• stronger operating visibility'
    ];

    if (scope === 'tools') {
      return {
        eyebrow: 'Premium Access',
        title: 'Tool Unlock Path',
        subtitle: 'See what opens as access increases.',
        body: [
          ...common,
          '',
          'Tool unlocks:',
          '• Scheduler',
          '• CRM / pipeline memory',
          '• mass SMS',
          '• deeper automation',
          '• market intelligence'
        ].join('\n')
      };
    }

    if (scope === 'analytics') {
      return {
        eyebrow: 'Premium Analytics',
        title: 'Analytics Upgrade Preview',
        subtitle: 'Revenue-facing insight gets deeper as the stack matures.',
        body: [
          ...common,
          '',
          'Analytics unlocks:',
          '• stronger opportunity scoring',
          '• cleaner revenue-leak identification',
          '• deeper listing intelligence',
          '• more actionable performance segmentation'
        ].join('\n')
      };
    }

    return {
      eyebrow: 'Leverage Upgrade',
      title: 'Overview Upgrade Path',
      subtitle: 'See how the platform increases leverage beyond the current operator surface.',
      body: [
        ...common,
        '',
        'Overview unlocks:',
        '• larger output capacity',
        '• tighter action center prioritization',
        '• better revenue intelligence',
        '• more advanced operator automation'
      ].join('\n')
    };
  }

  function bindUpgradeButtons() {
    const map = {
      overviewUpgradeBtn: 'overview',
      toolsUpgradeBtn: 'tools',
      analyticsUpgradeBtn: 'analytics'
    };

    Object.entries(map).forEach(([id, scope]) => {
      const btn = qs(`#${id}`);
      if (!btn || btn.dataset.phase2Bound === 'true') return;
      btn.dataset.phase2Bound = 'true';
      btn.addEventListener('click', () => showReadModal(getUpgradeCopy(scope)));
    });

    window.openPremiumPreviewModal = function openPremiumPreviewModal(scope = 'overview') {
      showReadModal(getUpgradeCopy(scope));
    };
  }

  function bindModalControls() {
    const closeRead = qs('#closeReadCopyModalBtn');
    if (closeRead && closeRead.dataset.phase2Bound !== 'true') {
      closeRead.dataset.phase2Bound = 'true';
      closeRead.addEventListener('click', closeReadModal);
    }

    const closeListing = qs('#closeListingDetailModalBtn');
    if (closeListing && closeListing.dataset.phase2Bound !== 'true') {
      closeListing.dataset.phase2Bound = 'true';
      closeListing.addEventListener('click', closeListingModal);
    }

    const copyBtn = qs('#copyReadCopyModalBtn');
    if (copyBtn && copyBtn.dataset.phase2Bound !== 'true') {
      copyBtn.dataset.phase2Bound = 'true';
      copyBtn.addEventListener('click', async () => {
        const text = clean(qs('#readCopyModalBody')?.textContent || '');
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = 'Copied';
          setTimeout(() => { copyBtn.textContent = 'Copy Text'; }, 1200);
        } catch {
          copyBtn.textContent = 'Copy Failed';
          setTimeout(() => { copyBtn.textContent = 'Copy Text'; }, 1200);
        }
      });
    }

    ['#readCopyModal', '#listingDetailModal'].forEach((selector) => {
      const modal = qs(selector);
      if (!modal || modal.dataset.phase2Backdrop === 'true') return;
      modal.dataset.phase2Backdrop = 'true';
      modal.addEventListener('click', (event) => {
        if (event.target !== modal) return;
        if (selector === '#readCopyModal') closeReadModal();
        else closeListingModal();
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      closeReadModal();
      closeListingModal();
    });
  }

  function showSectionAndFocus(sectionId, fieldId = '') {
    if (typeof window.showSection === 'function') {
      window.showSection(sectionId);
    } else {
      qsa('.dashboard-section').forEach((section) => {
        section.style.display = section.id === sectionId ? 'block' : 'none';
      });
      qsa('[data-section]').forEach((button) => {
        button.classList.toggle('active', button.getAttribute('data-section') === sectionId);
      });
    }

    if (fieldId) {
      setTimeout(() => {
        const target = qs(`#${fieldId}`);
        if (!target) return;
        target.focus();
        if (typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 120);
    }
  }

  function bindSectionLaunchers() {
    qsa('[data-open-section]').forEach((button) => {
      if (button.dataset.phase2Bound === 'true') return;
      button.dataset.phase2Bound = 'true';
      button.addEventListener('click', () => {
        showSectionAndFocus(
          clean(button.getAttribute('data-open-section') || 'overview'),
          clean(button.getAttribute('data-focus-field') || '')
        );
      });
    });
  }

  function getModuleDescription(tile) {
    const title = clean(qs('h3', tile)?.textContent || 'Module');
    const copy = clean(qs('p', tile)?.textContent || '');
    const state = clean(tile.getAttribute('data-module-state') || 'unknown');
    const group = clean(tile.getAttribute('data-module-group') || 'general');
    const requiredPlan = clean(tile.getAttribute('data-required-plan') || '');
    return [
      `Module: ${title}`,
      `Group: ${group}`,
      `State: ${state}`,
      requiredPlan ? `Required plan: ${requiredPlan}` : '',
      '',
      copy || 'No module detail available yet.'
    ].filter(Boolean).join('\n');
  }

  function renderModuleDetail(tile) {
    const panel = qs('#toolModuleDetailPanel');
    if (!panel || !tile) return;
    panel.innerHTML = `<div style="white-space:pre-wrap;">${getModuleDescription(tile)}</div>`;
  }

  function applyModuleFilters() {
    const group = clean(qs('#toolModuleFilter')?.value || 'all');
    const state = clean(qs('#toolStateFilter')?.value || 'all');
    const tiles = qsa('#toolsModuleGrid .tool-tile');

    let visible = 0;
    tiles.forEach((tile) => {
      const tileGroup = clean(tile.getAttribute('data-module-group') || 'all');
      const tileState = clean(tile.getAttribute('data-module-state') || 'all');
      const show = (group === 'all' || tileGroup === group) && (state === 'all' || tileState === state);
      tile.style.display = show ? '' : 'none';
      if (show) visible += 1;
    });

    const panel = qs('#toolModuleDetailPanel');
    if (panel && !panel.dataset.phase2UserPicked) {
      const firstVisible = tiles.find((tile) => tile.style.display !== 'none');
      if (firstVisible) renderModuleDetail(firstVisible);
    }

    const counts = qs('#moduleCountsPanel');
    if (counts) {
      counts.innerHTML = `
        <div class="sidebar-card"><div class="sidebar-card-label">Visible</div><div class="sidebar-card-value">${visible}</div></div>
        <div class="sidebar-card"><div class="sidebar-card-label">Filtered Group</div><div class="sidebar-card-value">${group === 'all' ? 'All Modules' : group}</div></div>
      `;
    }
  }

  function bindModuleFilters() {
    const groupSelect = qs('#toolModuleFilter');
    const stateSelect = qs('#toolStateFilter');
    [groupSelect, stateSelect].forEach((el) => {
      if (!el || el.dataset.phase2Bound === 'true') return;
      el.dataset.phase2Bound = 'true';
      el.addEventListener('change', applyModuleFilters);
    });

    qsa('#toolsModuleGrid .tool-tile').forEach((tile) => {
      if (tile.dataset.phase2Bound === 'true') return;
      tile.dataset.phase2Bound = 'true';
      tile.style.cursor = 'pointer';
      tile.addEventListener('click', () => {
        const panel = qs('#toolModuleDetailPanel');
        if (panel) panel.dataset.phase2UserPicked = 'true';
        renderModuleDetail(tile);
      });
    });

    applyModuleFilters();
  }

  function ensureRecentActivityPanel() {
    if (qs('#recentActivityFeed')) return;
    const toolsSection = qs('#tools');
    if (!toolsSection) return;

    const grid = document.createElement('div');
    grid.className = 'grid-2';
    grid.style.marginTop = '20px';
    grid.innerHTML = `
      <div class="card">
        <div class="section-head">
          <h2>Recent Activity</h2>
          <div class="subtext">Latest listing events and lifecycle movement</div>
        </div>
        <div id="recentActivityFeed" class="activity-feed">
          <div class="listing-empty">Loading activity...</div>
        </div>
      </div>
      <div class="card">
        <div class="section-head">
          <h2>Operator Notes</h2>
          <div class="subtext">Keep the dashboard cleaner while preserving the full stack.</div>
        </div>
        <div class="list-block">
          <div>• Overview should stay action-first.</div>
          <div>• Lower sections can carry depth without crowding the main surface.</div>
          <div>• Analytics should support decisions, not dominate first glance.</div>
        </div>
      </div>
    `;
    toolsSection.appendChild(grid);
  }

  function fillQuietPanels() {
    const defaults = {
      analyticsGrowthSignals: 'Growth signals will appear as usage and listing traction increase.',
      analyticsSystemHealth: 'System health is stable. Runtime and contract cleanup are being hardened.',
      creditActionPanel: 'Credit actions will unlock as the internal economy expands.',
      analyticsCreditActivity: 'No credit activity recorded yet.',
      revenueIntelligencePanel: 'Revenue-facing intelligence is loading from current listing and action data.',
      overviewUpgradePanel: 'Upgrade prompts appear when leverage or friction thresholds are reached.',
      analyticsUpgradePanel: 'Premium analytics preview is available through the upgrade button.',
      toolsUpgradePanel: 'Tool unlock path is available through the compare access button.'
    };

    Object.entries(defaults).forEach(([id, text]) => {
      const el = qs(`#${id}`);
      if (!el) return;
      if (clean(el.textContent)) return;
      el.innerHTML = `<div>${text}</div>`;
    });
  }

  function fillActionBucketsFromSummary() {
    const reviewQueue = Number(clean(qs('#kpiReviewQueue')?.textContent || '0')) || 0;
    const stale = Number(clean(qs('#kpiStaleListings')?.textContent || '0')) || 0;
    const needs = Number(clean(qs('#kpiNeedsAction')?.textContent || '0')) || 0;
    const weak = Number(clean(qs('#kpiWeakListings')?.textContent || '0')) || 0;

    setText('actionBucketDoNow', String(reviewQueue));
    setText('actionBucketDoToday', String(Math.max(stale, needs)));
    setText('actionBucketWatch', String(weak));
    setText('actionBucketLow', String(0));

    const summary = qs('#actionBucketSummary');
    if (summary) {
      summary.textContent = `Do Now: ${reviewQueue} • Do Today: ${Math.max(stale, needs)} • Watch: ${weak} • Low Priority: 0`;
    }
  }

  function bindReferralUtilities() {
    const referralCodeText = () => clean(qs('#referralCodeAffiliate')?.textContent || qs('#referralCode')?.textContent || '');
    const referralLink = () => {
      const code = referralCodeText();
      return code ? `${window.location.origin}/signup.html?ref=${encodeURIComponent(code)}` : '';
    };

    const map = {
      copyReferralCodeBtn: async () => navigator.clipboard.writeText(referralCodeText()),
      copyReferralLinkBtn: async () => navigator.clipboard.writeText(referralLink()),
      copyAffiliateDMBtn: async () => navigator.clipboard.writeText(
        'I’ve been using Elevate Automation to speed up Marketplace posting and organize listing flow. If you want early access, use my referral link.'
      ),
      copyAffiliatePitchBtn: async () => navigator.clipboard.writeText(
        'Elevate helps salespeople post faster, stay organized, and move more inventory from one operator surface.'
      ),
      copyAffiliatePostBtn: async () => navigator.clipboard.writeText(
        'Testing a cleaner posting workflow with Elevate Automation. Faster listing execution, tighter review flow, and a stronger operator dashboard.'
      )
    };

    Object.entries(map).forEach(([id, fn]) => {
      const btn = qs(`#${id}`);
      if (!btn || btn.dataset.phase2Bound === 'true') return;
      btn.dataset.phase2Bound = 'true';
      btn.addEventListener('click', async () => {
        try {
          await fn();
          btn.textContent = 'Copied';
          setTimeout(() => { btn.textContent = btn.dataset.originalLabel || btn.textContent; }, 1200);
        } catch {}
      });
      btn.dataset.originalLabel = btn.textContent;
    });
  }

  function bootstrapPhase2() {
    ensureRootAccent();
    bindUpgradeButtons();
    bindModalControls();
    bindSectionLaunchers();
    bindModuleFilters();
    ensureRecentActivityPanel();
    fillQuietPanels();
    fillActionBucketsFromSummary();
    bindReferralUtilities();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapPhase2);
  } else {
    bootstrapPhase2();
  }

  window.__ELEVATE_DASHBOARD_PHASE2__ = true;
})();