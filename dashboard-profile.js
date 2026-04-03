(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.profile) return;

  NS.profile = {
    mount() {
      return true;
    }
  };

  NS.modules = NS.modules || {};
  NS.modules.profile = true;
})();
