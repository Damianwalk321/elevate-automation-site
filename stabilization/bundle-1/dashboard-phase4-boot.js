(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase4boot) return;

  let phase5ScriptPromise = null;
  let renderTimer = null;
  let renderInFlight = false;

  function shouldRenderForPath(path = '') {
    const normalized = String(path || '');
    return [
      'booted',
      'workflow.mode',
      'workflow.role',
      'ui.activeSection',
      'summary',
      'listings',
      'filteredListings'
    ].includes(normalized);
  }

  function loadPhase5Workflow() {
    if (NS.flags?.disablePhase5) return Promise.resolve();
    if (phase5ScriptPromise) return phase5ScriptPromise;

    const src = '/dashboard-phase5-workflow.js?v=20260406-stab1';
    const existing = Array.from(document.scripts).find((script) => script.src && script.src.includes('/dashboard-phase5-workflow.js'));
    if (existing) {
      phase5ScriptPromise = Promise.resolve();
      return phase5ScriptPromise;
    }

    phase5ScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });

    return phase5ScriptPromise;
  }

  function queuePhase5Render(reason = 'boot') {
    if (NS.flags?.disablePhase5) return;
    if (renderInFlight) return;

    clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      renderInFlight = true;
      try {
        NS.phase5workflow?.renderSalesOS?.({ reason });
      } catch (error) {
        console.warn('[Elevate Dashboard] Phase 5 render warning:', error);
      } finally {
        renderInFlight = false;
      }
    }, 60);
  }

  async function boot() {
    try {
      if (!NS.flags?.disableOverviewHierarchy) {
        NS.overview?.applyOverviewHierarchy?.();
      }

      await loadPhase5Workflow().catch((error) => {
        console.warn('[Elevate Dashboard] Phase 5 workflow load warning:', error);
      });

      queuePhase5Render('phase4_boot');

      if (NS.events && !NS.__phase5StateListenerBound) {
        NS.__phase5StateListenerBound = true;
        NS.events.addEventListener('state:set', (event) => {
          const path = event?.detail?.path || '';
          if (shouldRenderForPath(path)) {
            queuePhase5Render(path);
          }
        });
      }

      if (NS.state && !NS.state.get?.('booted')) {
        NS.state.set('booted', true);
      }
    } catch (error) {
      console.warn('[Elevate Dashboard] Phase 4 boot warning:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  NS.modules = NS.modules || {};
  NS.modules.phase4boot = true;
})();
