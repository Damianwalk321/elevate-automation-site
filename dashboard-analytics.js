(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.analytics) return;

  NS.analytics = {
    mount() {
      return true;
    }
  };

  NS.modules = NS.modules || {};
  NS.modules.analytics = true;
})();
