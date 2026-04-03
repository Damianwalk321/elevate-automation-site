(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.affiliate) return;

  NS.affiliate = {
    mount() {
      return true;
    }
  };

  NS.modules = NS.modules || {};
  NS.modules.affiliate = true;
})();
