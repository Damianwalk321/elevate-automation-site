(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.loaderInitialized) return;
  NS.loaderInitialized = true;

  function safeLocalStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  const params = new URLSearchParams(window.location.search);
  const hasParam = (key) => params.get(key) === '1';
  const hasStoredFlag = (key) => safeLocalStorageGet(key) === '1';

  const flags = {
    safeMode: hasParam('safe') || hasStoredFlag('ea_dashboard_safe_mode'),
    disablePhase5: hasParam('disablePhase5') || hasStoredFlag('ea_dashboard_disable_phase5'),
    disableOverviewHierarchy: hasParam('disableOverviewHierarchy') || hasStoredFlag('ea_dashboard_disable_overview_hierarchy'),
    debugBoot: hasParam('debugBoot') || hasStoredFlag('ea_dashboard_debug_boot')
  };

  if (flags.safeMode) {
    flags.disablePhase5 = true;
  }

  NS.flags = { ...(NS.flags || {}), ...flags };
  NS.version = 'dashboard-stabilization-bundle-1';
  window.__EA_DASHBOARD_FLAGS__ = NS.flags;

  const MODULES = [
    '/dashboard-state.js?v=20260406-stab1',
    '/dashboard-ui.js?v=20260406-stab1',
    '/dashboard-api.js?v=20260406-stab1',
    '/dashboard-overview.js?v=20260406-stab1',
    '/dashboard-listings.js?v=20260406-stab1',
    '/dashboard-profile.js?v=20260406-stab1',
    '/dashboard-tools.js?v=20260406-stab1',
    '/dashboard-analytics.js?v=20260406-stab1',
    '/dashboard-affiliate.js?v=20260406-stab1',
    '/dashboard-billing.js?v=20260406-stab1',
    '/dashboard-legacy.js?v=20260406-stab1',
    '/dashboard-phase4-boot.js?v=20260406-stab1',
    '/dashboard-bootstrap.js?v=20260406-stab1'
  ];

  function setBootStatus(message) {
    const node = document.getElementById('bootStatus');
    if (node) node.textContent = message || '';
  }

  function scriptAlreadyPresent(src) {
    const base = src.split('?')[0];
    return Array.from(document.scripts).some((script) => {
      try {
        return script.src && new URL(script.src, window.location.origin).pathname === base;
      } catch {
        return false;
      }
    });
  }

  function loadModule(src) {
    return new Promise((resolve, reject) => {
      if (scriptAlreadyPresent(src)) {
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

  async function loadSequentially(index = 0) {
    if (index >= MODULES.length) return;
    const src = MODULES[index];
    await loadModule(src);
    await loadSequentially(index + 1);
  }

  loadSequentially()
    .then(() => {
      if (NS.flags.safeMode) {
        setBootStatus('Safe mode active. Phase 5 workflow is disabled.');
      }
    })
    .catch((error) => {
      console.error('[Elevate Dashboard] loader failure:', error);
      setBootStatus(`Loader failed: ${error.message || 'Unknown error'}`);
    });
})();
