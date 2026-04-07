(() => {
  if (window.__ELEVATE_DASHBOARD_PHASE4_LOADER__) {
    console.warn('[Elevate Dashboard] Phase 4 loader already initialized.');
    return;
  }
  window.__ELEVATE_DASHBOARD_PHASE4_LOADER__ = true;

  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  NS.version = 'phase4-loader-bundle-2';
  NS.modules = NS.modules || {};
  NS.events = NS.events || new EventTarget();

  const MODULES = [
    '/dashboard-state.js?v=20260407b2',
    '/dashboard-ui.js?v=20260407b2',
    '/dashboard-api.js?v=20260407b2',
    '/dashboard-overview.js?v=20260407b2',
    '/dashboard-listings.js?v=20260407b2',
    '/dashboard-profile.js?v=20260407b2',
    '/dashboard-tools.js?v=20260407b2',
    '/dashboard-analytics.js?v=20260407b2',
    '/dashboard-affiliate.js?v=20260407b2',
    '/dashboard-billing.js?v=20260407b2',
    '/dashboard-dom-ready-bridge.js?v=20260407b2',
    '/dashboard-legacy.js?v=20260407b2',
    '/dashboard-phase4-boot.js?v=20260407b2',
    '/dashboard-bootstrap.js?v=20260407b2'
  ];

  function setBootStatus(message) {
    const status = document.getElementById('bootStatus');
    if (status) status.textContent = message || '';
  }

  function hasScript(pathname) {
    return Array.from(document.scripts).some((script) => {
      try {
        return script.src && new URL(script.src, window.location.origin).pathname === pathname;
      } catch {
        return false;
      }
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const pathname = src.split('?')[0];
      if (hasScript(pathname)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function loadSequentially() {
    for (const src of MODULES) {
      await loadScript(src);
    }
  }

  loadSequentially().catch((error) => {
    console.error('[Elevate Dashboard] Phase 4 loader error:', error);
    setBootStatus(`Phase 4 loader failed: ${error.message || 'Unknown error'}`);
  });
})();
