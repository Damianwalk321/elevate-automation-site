(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.bootstrap) return;

  const RETRY_TIMEOUT_MS = 15000;
  const POLL_MS = 600;

  const CSS = '\n    .ea-boot-panel {\n      margin: 12px 0 18px;\n      padding: 14px 16px;\n      border: 1px solid rgba(212,175,55,0.14);\n      border-radius: 14px;\n      background: rgba(255,255,255,0.02);\n      display: grid;\n      gap: 8px;\n    }\n    .ea-boot-panel-head {\n      display: flex;\n      justify-content: space-between;\n      align-items: center;\n      gap: 12px;\n      flex-wrap: wrap;\n    }\n    .ea-boot-eyebrow {\n      color: #d4af37;\n      font-size: 11px;\n      font-weight: 700;\n      letter-spacing: 0.12em;\n      text-transform: uppercase;\n    }\n    .ea-boot-badge {\n      display: inline-flex;\n      align-items: center;\n      min-height: 28px;\n      padding: 0 10px;\n      border-radius: 999px;\n      font-size: 11px;\n      font-weight: 700;\n      border: 1px solid rgba(255,255,255,0.08);\n      background: #171717;\n      color: #f4f4f4;\n    }\n    .ea-boot-badge.running { color: #f3ddb0; border-color: rgba(212,175,55,0.18); }\n    .ea-boot-badge.ready { color: #9de8a8; border-color: rgba(157,232,168,0.22); }\n    .ea-boot-badge.error { color: #ffb4b4; border-color: rgba(255,180,180,0.2); }\n    .ea-boot-title { font-size: 14px; font-weight: 700; }\n    .ea-boot-detail { font-size: 13px; color: #b8b8b8; line-height: 1.5; }\n    .ea-boot-stage-list { display: grid; gap: 6px; }\n    .ea-boot-stage-item { font-size: 12px; color: #d6d6d6; }\n    .ea-boot-actions { display: flex; gap: 8px; flex-wrap: wrap; }\n    .ea-boot-actions button {\n      appearance: none;\n      border: 1px solid rgba(255,255,255,0.08);\n      background: #1a1a1a;\n      color: #f2f2f2;\n      border-radius: 10px;\n      padding: 10px 12px;\n      cursor: pointer;\n      font-size: 12px;\n    }\n  ';

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function ensureBootstrapState() {
    NS.bootstrapState = NS.bootstrapState && typeof NS.bootstrapState === 'object' ? NS.bootstrapState : {};
    if (!Array.isArray(NS.bootstrapState.stages)) NS.bootstrapState.stages = [];
    return NS.bootstrapState;
  }

  function injectStyles() {
    if (document.getElementById('ea-boot-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'ea-boot-panel-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    injectStyles();
    let panel = document.getElementById('eaBootPanel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'eaBootPanel';
    panel.className = 'ea-boot-panel';
    panel.innerHTML = '\n      <div class="ea-boot-panel-head">\n        <div>\n          <div class="ea-boot-eyebrow">Boot Telemetry</div>\n          <div id="eaBootTitle" class="ea-boot-title">Starting dashboard bootstrap...</div>\n        </div>\n        <div id="eaBootBadge" class="ea-boot-badge running">Running</div>\n      </div>\n      <div id="eaBootDetail" class="ea-boot-detail">Preparing telemetry and startup controller.</div>\n      <div id="eaBootStages" class="ea-boot-stage-list"></div>\n      <div class="ea-boot-actions">\n        <button id="eaBootRetryBtn" type="button">Retry bootstrap</button>\n        <button id="eaBootReloadBtn" type="button">Reload page</button>\n      </div>\n    ';

    const header = qs('.main-header') || document.body;
    header.insertAdjacentElement('afterend', panel);

    const retryBtn = document.getElementById('eaBootRetryBtn');
    if (retryBtn && retryBtn.dataset.bound !== 'true') {
      retryBtn.dataset.bound = 'true';
      retryBtn.addEventListener('click', () => triggerLegacyHydration('manual_retry'));
    }

    const reloadBtn = document.getElementById('eaBootReloadBtn');
    if (reloadBtn && reloadBtn.dataset.bound !== 'true') {
      reloadBtn.dataset.bound = 'true';
      reloadBtn.addEventListener('click', () => window.location.reload());
    }

    return panel;
  }

  function renderStages(stages = []) {
    const wrap = document.getElementById('eaBootStages');
    if (!wrap) return;
    wrap.innerHTML = stages.slice(-6).map((item) => '<div class="ea-boot-stage-item">• ' + item + '</div>').join('');
  }

  function updatePanel(status, title, detail) {
    ensurePanel();
    const badge = document.getElementById('eaBootBadge');
    const titleEl = document.getElementById('eaBootTitle');
    const detailEl = document.getElementById('eaBootDetail');
    if (badge) {
      badge.className = 'ea-boot-badge ' + status;
      badge.textContent = status === 'ready' ? 'Ready' : status === 'error' ? 'Error' : 'Running';
    }
    if (titleEl) titleEl.textContent = title || 'Boot status';
    if (detailEl) detailEl.textContent = detail || '';
    const bootStatus = document.getElementById('bootStatus');
    if (bootStatus) bootStatus.textContent = detail || title || '';
  }

  function pushStage(label, detail = '') {
    const state = ensureBootstrapState();
    const line = detail ? label + ': ' + detail : label;
    state.stages.push(line);
    renderStages(state.stages);
    updatePanel('running', label, detail);
  }

  function getIndicators() {
    const userEmailText = clean(qs('.user-email')?.textContent || '');
    const welcomeText = clean(document.getElementById('welcomeText')?.textContent || '');
    const hasUser = Boolean(window.currentUser?.id) || Boolean(userEmailText && !/loading/i.test(userEmailText));
    const hasSession = Boolean(window.currentNormalizedSession?.subscription || window.currentAccountData);
    const hasSummary = Boolean(window.dashboardSummary && typeof window.dashboardSummary === 'object');
    const hasListings = Array.isArray(window.dashboardListings) && window.dashboardListings.length > 0;
    const activeSectionVisible = Array.from(document.querySelectorAll('.dashboard-section')).some((section) => {
      return section.style.display === 'block' || !section.classList.contains('dashboard-section-hidden');
    });
    const shellLoading = !(
      hasUser &&
      hasSession &&
      hasSummary &&
      (hasListings || activeSectionVisible)
    ) && (/loading/i.test(userEmailText) || /loading dashboard/i.test(welcomeText));

    return {
      shellLoading,
      hasUser,
      hasSession,
      hasSummary,
      hasListings,
      activeSectionVisible
    };
  }

  function triggerLegacyHydration(reason = 'bootstrap') {
    const state = ensureBootstrapState();
    const now = Date.now();
    if (state.lastTriggerAt && reason !== 'manual_retry' && now - state.lastTriggerAt < 1200) {
      return;
    }
    state.lastTriggerAt = now;
    pushStage('Hydration', 'Dispatching legacy DOMContentLoaded (' + reason + ').');
    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true, cancelable: true }));
  }

  function maybeRenderPhase5() {
    try {
      NS.phase5workflow?.renderSalesOS?.();
    } catch (error) {
      console.warn('[Elevate Dashboard] Phase 5 render warning:', error);
    }
  }

  function startWatch() {
    ensurePanel();
    pushStage('Bootstrap', 'Watching shell hydration and data readiness.');

    const startedAt = Date.now();
    let hydrationTriggered = false;

    const tick = () => {
      const indicators = getIndicators();

      if (!hydrationTriggered && indicators.shellLoading) {
        hydrationTriggered = true;
        triggerLegacyHydration('shell_loading_detected');
      }

      if (indicators.hasUser && !indicators.hasSummary) {
        updatePanel('running', 'User resolved', 'Waiting for dashboard summary and workspace hydration.');
      }

      if (indicators.hasSummary && !indicators.hasSession) {
        updatePanel('running', 'Summary resolved', 'Waiting for normalized session and section render pass.');
      }

      if (indicators.hasSummary && indicators.hasSession) {
        maybeRenderPhase5();
      }

      if ((indicators.hasUser && indicators.hasSummary && indicators.hasSession && (indicators.hasListings || indicators.activeSectionVisible)) || !indicators.shellLoading) {
        pushStage('Ready', 'Core dashboard hydration completed.');
        updatePanel('ready', 'Dashboard hydrated', indicators.hasListings ? 'Workspace, summary, and listings are available.' : 'Workspace and summary are available. Listings may still be hydrating.');
        clearInterval(intervalId);
        return;
      }

      if (Date.now() - startedAt > RETRY_TIMEOUT_MS) {
        updatePanel('error', 'Bootstrap stalled', 'Shell is still partially loaded. Use Retry bootstrap, then refresh if needed.');
        clearInterval(intervalId);
      }
    };

    const intervalId = setInterval(tick, POLL_MS);
    tick();
  }

  function boot() {
    const state = ensureBootstrapState();
    if (state.started) return;
    state.started = true;
    startWatch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  NS.modules = NS.modules || {};
  NS.modules.bootstrap = true;
})();
