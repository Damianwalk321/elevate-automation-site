(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.state) return;

  const store = {
    booted: false,
    user: null,
    profile: null,
    session: null,
    summary: null,
    listings: [],
    filteredListings: [],
    ui: {
      activeSection: "overview",
      listingQuickFilter: "all"
    }
  };

  function get(path, fallback = undefined) {
    if (!path) return store;
    return String(path).split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : fallback), store);
  }

  function set(path, value) {
    const keys = String(path).split(".");
    let ref = store;
    while (keys.length > 1) {
      const key = keys.shift();
      ref[key] = ref[key] || {};
      ref = ref[key];
    }
    ref[keys[0]] = value;
    NS.events.dispatchEvent(new CustomEvent("state:set", { detail: { path, value } }));
    return value;
  }

  function merge(path, payload = {}) {
    const current = get(path, {});
    const next = { ...current, ...payload };
    set(path, next);
    return next;
  }

  NS.state = { store, get, set, merge };
  NS.modules = NS.modules || {};
  NS.modules.state = true;
})();
