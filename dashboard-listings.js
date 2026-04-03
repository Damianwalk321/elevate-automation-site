(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.listings) return;

  NS.listings = {
    mount() {
      return true;
    }
  };

  NS.modules = NS.modules || {};
  NS.modules.listings = true;
})();
