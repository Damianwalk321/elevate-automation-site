(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.bootstrap) return;

  const RETRY_TIMEOUT_MS = 15000;
  const POLL_MS = 500;

  const CSS = `
    .ea-boot-panel {
      margin: 12px 0 18px;
      padding: 14px 16px;
      border: 1px solid rgba(212,175,55,0.14);
      border-radius: 14px;
      background: rgba(255,255,255,0.02);
      display: grid;
      gap: 8px;
    }
    .ea-boot-panel-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .ea-boot-eyebrow {
      color: #d4af37;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .ea-boot-badge {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      border: 1px solid rgba(255,255,255,0.08);
      background: #171717;
      color: #f4f4f4;
    }
    .ea-boot-badge.running { color: #f3ddb0; border-color: rgba(212,175,55,0.18); }
    .ea-boot-badge.ready { color: #9de8a8; border-color: rgba(157,232,168,0.22); }
    .ea-boot-badge.error { color: #ffb4b4; border-color: rgba(255,180,180,0.2); }
    .ea-boot-title { font-size: 14px; font-weight: 700; }
    .ea-boot-detail { font-size: 13px; color: #b8b8b8; line-height: 1.5; }
    .ea-boot-stage-list { display: grid; gap: 6px; }
    .ea-boot-stage-item { font-size: 12px; color: #d6d6d6; }
    .ea-boot-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .ea-boot-actions button {
      appearance: none;
      border: 1px solid rgba(255,255,255,0.08);
      background: #1a1a1a;
      color: #f2f2f2;
      border-radius: 10px;
      padding: 10px 12px;
      cursor: pointer;
      font-size: 12px;
    }
  `;

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function injectStyles() {
    if (document.getElementById('ea-boot-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'ea-boot-panel-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function openSafeMode() {
    const url = new URL(window.location.href);
    url.searchParams.set('safe', '1');
    window.location.href = url.toString();
  }

  function reloadPage() {
    window.location.reload();
  }

  function retryBootstrap() {
    if (typeof window.__ELEVATE_DASHBOARD_LEGACY_BOOT__ === 'function') {
      try {
        window.__ELEVATE_DASHBOARD_LEGACY_BOOT__();
      } catch (error) {
        console.warn('[Elevate Dashboard] retry bootstrap warning:', error);
      }
    }
    if (NS.phase5workflow?.renderSalesOS && !NS.flags?.disablePhase5) {
      try {
        NS.phase5workflow.renderSalesOS({ reason: 'manual_retry' });
      } catch (error) {
        console.warn('[Elevate Dashboard] phase5 retry warning:', error);
      }
    }
  }

  function ensurePanel() {
    injectStyles();
    let panel = document.getElementById('eaBootPanel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'eaBootPanel';
    panel.className = 'ea-boot-panel';
    panel.innerHTML = `
      <div class="ea-boot-panel-head">
        <div>
          <div class="ea-boot-eyebrow">Boot Telemetry</div>
          <div id="eaBootTitle" class="ea-boot-title">Starting dashboard bootstrap...</div>
        </div>
        <div id="eaBootBadge" class="ea-boot-badge running">Running</div>
      </div>
      <div id="eaBootDetail" class="ea-boot-detail">Preparing telemetry and startup controller.</div>
      <div id="eaBootStages" class="ea-boot-stage-list"></div>
      <div class="ea-boot-actions">
        <button id="eaBootRetryBtn" type="button">Retry bootstrap</button>
        <button id="eaBootSafeBtn" type="button">Open safe mode</button>
        <button id="eaBootReloadBtn" type="button">Reload page</button>
      </div>
    `;

    const header = qs('.main-header') || document.body;
    header.insertAdjacentElement('afterend', panel);

    document.getElementById('eaBootRetryBtn')?.addEventListener('click', retryBootstrap);
    document.getElementById('eaBootSafeBtn')?.addEventListener('click', openSafeMode);
    document.getElementById('eaBootReloadBtn')?.addEventListener('click', reloadPage);

    return panel;
  }

  function renderStages(stages = []) {
    const wrap = document.getElementById('eaBootStages');
    if (!wrap) return;
    wrap.innerHTML = stages.slice(-6).map((line) => `<div class="ea-boot-stage-item">• ${line}</div>`).join('');
  }

  function updatePanel(status, title, detail) {
    ensurePanel();
    const badge = document.getElementById('eaBootBadge');
    const titleEl = document.getElementById('eaBootTitle');
    const detailEl = document.getElementById('eaBootDetail');
    if (badge) {
      badge.className = `ea-boot-badge ${status}`;
      badge.textContent = status === 'ready' ? 'Ready' : status === 'error' ? 'Error' : 'Running';
    }
    if (titleEl) titleEl.textContent = title || 'Boot status';
    if (detailEl) detailEl.textContent = detail || '';
    const bootStatus = document.getElementById('bootStatus');
    if (bootStatus) bootStatus.textContent = detail || title || '';
  }

  function pushStage(label, detail = '') {
    NS.bootstrapState = NS.bootstrapState || { stages: [] };
    const line = detail ? `${label}: ${detail}` : label;
    NS.bootstrapState.stages.push(line);
    renderStages(NS.bootstrapState.stages);
    updatePanel('running', label, detail);
  }

  function getIndicators() {
    const userEmailText = clean(qs('.user-email')?.textContent || '');
    const welcomeText = clean(document.getElementById('welcomeText')?.textContent || '');
    return {
      shellLoading: /loading/i.test(userEmailText) || /loading dashboard/i.test(welcomeText),
      hasUser: Boolean(window.currentUser?.id) || (userEmailText && !/loading/i.test(userEmailText)),
      hasSession: Boolean(window.currentNormalizedSession?.subscription || window.currentAccountData),
      hasSummary: Boolean(window.dashboardSummary && typeof window.dashboardSummary === 'object'),
      hasListings: Array.isArray(window.dashboardListings) && window.dashboardListings.length > 0
    };
  }

  function maybeRenderPhase5() {
    if (NS.flags?.disablePhase5) return;
    try {
      NS.phase5workflow?.renderSalesOS?.({ reason: 'bootstrap_watch' });
    } catch (error) {
      console.warn('[Elevate Dashboard] phase5 render warning:', error);
    }
  }

  function startWatch() {
    ensurePanel();
    pushStage('Bootstrap', NS.flags?.safeMode
      ? 'Safe mode active. Watching core dashboard hydration only.'
      : 'Watching shell hydration and data readiness.');

    const startedAt = Date.now();

    const tick = () => {
      const indicators = getIndicators();

      if (indicators.hasUser && !indicators.hasSummary) {
        updatePanel('running', 'User resolved', 'Waiting for dashboard summary and workspace hydration.');
      }

      if (indicators.hasSummary && !indicators.hasSession) {
        updatePanel('running', 'Summary resolved', 'Waiting for normalized session and section render pass.');
      }

      if (indicators.hasSummary && indicators.hasSession) {
        maybeRenderPhase5();
      }

      if (!indicators.shellLoading && indicators.hasUser && indicators.hasSummary && indicators.hasSession) {
        pushStage('Ready', 'Core dashboard hydration completed.');
        updatePanel(
          'ready',
          'Dashboard hydrated',
          NS.flags?.safeMode
            ? 'Core dashboard is available in safe mode.'
            : (indicators.hasListings ? 'Workspace, summary, and listings are available.' : 'Workspace and summary are available. Listings may still be hydrating.')
        );
        clearInterval(intervalId);
        return;
      }

      if (Date.now() - startedAt > RETRY_TIMEOUT_MS) {
        updatePanel('error', 'Bootstrap stalled', 'Shell is still partially loaded. Try Retry bootstrap or Safe mode.');
        clearInterval(intervalId);
      }
    };

    const intervalId = setInterval(tick, POLL_MS);
    tick();
  }

  function boot() {
    if (NS.bootstrapState?.started) return;
    NS.bootstrapState = NS.bootstrapState || {};
    NS.bootstrapState.started = true;
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
