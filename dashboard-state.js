
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.state) return;

  if (!(NS.events instanceof EventTarget)) {
    NS.events = new EventTarget();
  }

  const STORAGE_KEY = "elevate.dashboard.bundleA.state.v1";

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
  }

  function safeReadStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function safeWriteStorage(payload) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }

  const persisted = safeReadStorage();

  const store = {
    booted: false,
    user: null,
    profile: null,
    session: null,
    summary: null,
    listings: Array.isArray(persisted.listings) ? persisted.listings : [],
    filteredListings: [],
    listingRegistry: persisted.listingRegistry && typeof persisted.listingRegistry === "object" ? persisted.listingRegistry : {},
    listingEvents: Array.isArray(persisted.listingEvents) ? persisted.listingEvents : [],
    analytics: persisted.analytics && typeof persisted.analytics === "object" ? persisted.analytics : {
      tracking_summary: {
        total_listings: 0,
        tracked_views: 0,
        tracked_messages: 0,
        high_interest_count: 0,
        high_views_low_messages_count: 0,
        weak_conversion_count: 0,
        message_leaders_count: 0,
        view_leaders_count: 0,
        stale_candidates_count: 0,
        refreshed_at: null
      },
      action_queue: [],
      leaders: {
        message_leaders: [],
        view_leaders: [],
        high_interest: [],
        high_views_low_messages: [],
        weak_conversion: []
      }
    },
    tracking: persisted.tracking && typeof persisted.tracking === "object" ? persisted.tracking : {
      last_rebuild_at: null,
      source: "local_foundation_v1"
    },
    ui: {
      activeSection: "overview",
      listingQuickFilter: "all"
    }
  };

  function get(path, fallback = undefined) {
    if (!path) return store;
    return String(path).split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : fallback), store);
  }

  function persistBundleAState() {
    safeWriteStorage({
      listings: store.listings,
      listingRegistry: store.listingRegistry,
      listingEvents: store.listingEvents.slice(-250),
      analytics: store.analytics,
      tracking: store.tracking
    });
  }

  function dispatch(path, value) {
    if (NS.events && typeof NS.events.dispatchEvent === "function") {
      NS.events.dispatchEvent(new CustomEvent("state:set", { detail: { path, value } }));
    }
  }

  function set(path, value, options = {}) {
    const keys = String(path).split(".");
    let ref = store;
    while (keys.length > 1) {
      const key = keys.shift();
      ref[key] = ref[key] || {};
      ref = ref[key];
    }
    ref[keys[0]] = value;
    if (!options.silent) dispatch(path, value);
    if (!options.skipPersist) persistBundleAState();
    return value;
  }

  function merge(path, payload = {}, options = {}) {
    const current = get(path, {});
    const next = { ...current, ...payload };
    return set(path, next, options);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function listingKey(input = {}) {
    const parts = [
      clean(input.id),
      clean(input.vin),
      clean(input.stock),
      clean(input.title),
      clean(input.price),
      clean(input.year),
      clean(input.make),
      clean(input.model)
    ].filter(Boolean);
    return parts[0] || `listing_${Math.random().toString(36).slice(2, 10)}`;
  }

  function logEvent(type, payload = {}) {
    const event = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      ts: nowIso(),
      payload: clone(payload)
    };
    store.listingEvents.push(event);
    if (store.listingEvents.length > 250) {
      store.listingEvents = store.listingEvents.slice(-250);
    }
    persistBundleAState();
    dispatch("listingEvents", event);
    return event;
  }

  function upsertListing(record = {}, options = {}) {
    const key = listingKey(record);
    const existing = store.listingRegistry[key] || {};
    const next = {
      key,
      id: clean(record.id) || existing.id || key,
      title: clean(record.title) || existing.title || "Untitled listing",
      price: clean(record.price) || existing.price || "",
      vin: clean(record.vin) || existing.vin || "",
      stock: clean(record.stock) || existing.stock || "",
      year: clean(record.year) || existing.year || "",
      make: clean(record.make) || existing.make || "",
      model: clean(record.model) || existing.model || "",
      views: Number.isFinite(Number(record.views)) ? Number(record.views) : Number(existing.views || 0),
      messages: Number.isFinite(Number(record.messages)) ? Number(record.messages) : Number(existing.messages || 0),
      status: clean(record.status) || existing.status || "active",
      source: clean(record.source) || existing.source || "dashboard_dom",
      first_seen_at: existing.first_seen_at || nowIso(),
      last_seen_at: nowIso(),
      last_view_at: Number(record.views) > Number(existing.views || 0) ? nowIso() : (existing.last_view_at || null),
      last_message_at: Number(record.messages) > Number(existing.messages || 0) ? nowIso() : (existing.last_message_at || null),
      image_url: clean(record.image_url) || existing.image_url || "",
      health_state: clean(record.health_state) || existing.health_state || "unknown"
    };

    store.listingRegistry[key] = next;
    store.listings = Object.values(store.listingRegistry);
    if (!options.silent) {
      logEvent("listing_upserted", { key, title: next.title, views: next.views, messages: next.messages, status: next.status });
    } else {
      persistBundleAState();
    }
    dispatch("listingRegistry", { key, record: next });
    return next;
  }

  function setAnalytics(payload = {}, options = {}) {
    store.analytics = { ...store.analytics, ...payload };
    if (!options.silent) {
      dispatch("analytics", store.analytics);
    }
    persistBundleAState();
    return store.analytics;
  }

  function rebuildFilteredListings() {
    const quickFilter = get("ui.listingQuickFilter", "all");
    const listings = Array.isArray(store.listings) ? store.listings : [];
    let filtered = listings;
    if (quickFilter === "active") filtered = listings.filter((item) => clean(item.status).toLowerCase() === "active");
    if (quickFilter === "review") filtered = listings.filter((item) => clean(item.health_state).toLowerCase().includes("review"));
    if (quickFilter === "weak") filtered = listings.filter((item) => clean(item.health_state).toLowerCase().includes("weak"));
    store.filteredListings = filtered;
    return filtered;
  }

  NS.state = {
    store,
    get,
    set,
    merge,
    clean,
    listingKey,
    logEvent,
    upsertListing,
    setAnalytics,
    rebuildFilteredListings
  };

  NS.modules = NS.modules || {};
  NS.modules.state = true;
})();
