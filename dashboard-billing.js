(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.billing) return;

  NS.billing = {
    mount() {
      return true;
    }
  };

  NS.modules = NS.modules || {};
  NS.modules.billing = true;
})();
