(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.bootstrap) return;

  const RETRY_TIMEOUT_MS = 15000;
  const POLL_MS = 600;

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function getIndicators() {
    const userEmailText = clean(document.querySelector('.user-email')?.textContent || '');
    const welcomeText = clean(document.getElementById('welcomeText')?.textContent || '');
    return {
      shellLoading: /loading/i.test(userEmailText) || /loading dashboard/i.test(welcomeText),
      hasUser: Boolean(window.currentUser?.id) || (userEmailText && !/loading/i.test(userEmailText)),
      hasSession: Boolean(window.currentNormalizedSession?.subscription || window.currentAccountData),
      hasSummary: Boolean(window.dashboardSummary && typeof window.dashboardSummary === 'object'),
      hasListings: Array.isArray(window.dashboardListings) && window.dashboardListings.length > 0
    };
  }

  function setBootStatus(text) {
    const status = document.getElementById('bootStatus');
    if (status) status.textContent = text || '';
  }

  function startWatch() {
    setBootStatus('Watching dashboard readiness...');
    const startedAt = Date.now();

    const intervalId = setInterval(() => {
      const indicators = getIndicators();

      if (!indicators.shellLoading && indicators.hasUser && indicators.hasSummary && indicators.hasSession) {
        setBootStatus(indicators.hasListings ? 'Dashboard ready.' : 'Dashboard ready. Listings may still be hydrating.');
        clearInterval(intervalId);
        return;
      }

      if (Date.now() - startedAt > RETRY_TIMEOUT_MS) {
        setBootStatus('Bootstrap stalled. Remaining blocker is likely inside legacy boot internals or an API stage.');
        clearInterval(intervalId);
      }
    }, POLL_MS);
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
