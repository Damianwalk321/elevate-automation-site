
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.state) return;

  if (!(NS.events instanceof EventTarget)) {
    NS.events = new EventTarget();
  }

  const STORAGE_KEY = "elevate.dashboard.state.v3";

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
  }

  function baseStore() {
    return {
      booted: false,
      user: null,
      profile: null,
      session: null,
      summary: null,
      listings: [],
      filteredListings: [],
      listingRegistry: {},
      listingEvents: [],
      analytics: {
        tracking_summary: {},
        action_queue: [],
        leaders: {
          message_leaders: [],
          view_leaders: [],
          high_interest: [],
          high_views_low_messages: [],
          weak_conversion: [],
          fresh_traction: [],
          needs_refresh: [],
          price_attention: [],
          cooling_off: [],
          recovered: []
        }
      },
      tracking: {
        source: "bundle_c_events",
        last_rebuild_at: null
      },
      ui: {
        activeSection: "overview",
        listingQuickFilter: "all"
      }
    };
  }

  function hydrate() {
    const base = baseStore();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      return {
        ...base,
        ...parsed,
        ui: { ...base.ui, ...(parsed.ui || {}) },
        analytics: {
          ...base.analytics,
          ...(parsed.analytics || {}),
          leaders: {
            ...base.analytics.leaders,
            ...((parsed.analytics || {}).leaders || {})
          }
        },
        tracking: { ...base.tracking, ...(parsed.tracking || {}) },
        listingRegistry: parsed.listingRegistry || {},
        listingEvents: Array.isArray(parsed.listingEvents) ? parsed.listingEvents : []
      };
    } catch {
      return base;
    }
  }

  const store = hydrate();

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {}
  }

  function get(path, fallback = undefined) {
    if (!path) return store;
    return String(path).split(".").reduce((acc, key) => (
      acc && acc[key] !== undefined ? acc[key] : fallback
    ), store);
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

    if (!options.skipPersist) persist();

    if (!options.silent && NS.events && typeof NS.events.dispatchEvent === "function") {
      NS.events.dispatchEvent(new CustomEvent("state:set", { detail: { path, value } }));
    }

    return value;
  }

  function merge(path, payload = {}, options = {}) {
    const current = get(path, {});
    const next = { ...current, ...payload };
    set(path, next, options);
    return next;
  }

  function canonicalListingId(item = {}) {
    const preferred = String(item.id || item.listing_id || item.vin || item.stock_number || "").trim();
    if (preferred) return preferred;
    const title = String(item.title || "").trim().toLowerCase();
    const price = String(item.price || "").trim().toLowerCase();
    const image = String(item.image_url || "").trim().toLowerCase();
    return [title, price, image].filter(Boolean).join("|") || `listing_${Date.now()}`;
  }

  function appendListingEvent(event = {}, options = {}) {
    const events = Array.isArray(get("listingEvents", [])) ? get("listingEvents", []) : [];
    const next = {
      id: event.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      listing_id: event.listing_id || "",
      type: event.type || "listing_updated",
      timestamp: event.timestamp || new Date().toISOString(),
      meta: clone(event.meta || {})
    };
    events.push(next);
    while (events.length > 500) events.shift();
    set("listingEvents", events, options);
    return next;
  }

  function getListingEvents(listingId) {
    return (get("listingEvents", []) || []).filter((evt) => evt.listing_id === listingId);
  }

  function upsertListing(item = {}, options = {}) {
    const registry = get("listingRegistry", {});
    const id = canonicalListingId(item);
    const existing = registry[id] || {};
    const now = new Date().toISOString();

    const views = Number(item.views ?? existing.views ?? 0);
    const messages = Number(item.messages ?? existing.messages ?? 0);
    const previousViews = Number(existing.views || 0);
    const previousMessages = Number(existing.messages || 0);
    const previousPrice = String(existing.current_price || existing.price || "");
    const incomingPrice = String(item.price || existing.current_price || existing.price || "");

    const next = {
      ...existing,
      ...item,
      id,
      views,
      messages,
      first_seen_at: existing.first_seen_at || item.first_seen_at || now,
      last_seen_at: item.last_seen_at || now,
      last_view_at: views > previousViews ? now : (existing.last_view_at || null),
      last_message_at: messages > previousMessages ? now : (existing.last_message_at || null),
      previous_price: previousPrice && previousPrice !== incomingPrice ? previousPrice : (existing.previous_price || ""),
      current_price: incomingPrice,
      status: item.status || existing.status || "active",
      updated_at: now
    };

    registry[id] = next;
    set("listingRegistry", registry, { silent: options.silent, skipPersist: options.skipPersist });

    if (!options.skipEvents) {
      if (!existing.id) {
        appendListingEvent({ listing_id: id, type: "listing_seen", meta: { title: next.title || "" } }, { silent: true });
      }
      if (views > previousViews) {
        appendListingEvent({ listing_id: id, type: "view_update", meta: { from: previousViews, to: views, delta: views - previousViews } }, { silent: true });
      }
      if (messages > previousMessages) {
        appendListingEvent({ listing_id: id, type: "message_update", meta: { from: previousMessages, to: messages, delta: messages - previousMessages } }, { silent: true });
      }
      if (previousPrice && incomingPrice && previousPrice !== incomingPrice) {
        appendListingEvent({ listing_id: id, type: "price_changed", meta: { from: previousPrice, to: incomingPrice } }, { silent: true });
      }
    }

    if (!options.skipPersist) persist();
    return next;
  }

  function markMissingListingsRemoved(currentIds = [], options = {}) {
    const registry = get("listingRegistry", {});
    const now = new Date().toISOString();
    Object.values(registry).forEach((item) => {
      if (item && item.id && !currentIds.includes(item.id) && String(item.status || "").toLowerCase() !== "removed") {
        registry[item.id] = { ...item, status: "removed", removed_at: now, updated_at: now };
        if (!options.skipEvents) {
          appendListingEvent({ listing_id: item.id, type: "listing_removed", meta: { title: item.title || "" } }, { silent: true });
        }
      }
    });
    set("listingRegistry", registry, { silent: true, skipPersist: options.skipPersist });
    return registry;
  }

  function rebuildFilteredListings() {
    const registry = Object.values(get("listingRegistry", {}));
    set("listings", registry, { silent: true });
    set("filteredListings", registry, { silent: true });
    return registry;
  }

  function setAnalytics(payload = {}, options = {}) {
    const next = {
      tracking_summary: payload.tracking_summary || {},
      action_queue: payload.action_queue || [],
      leaders: {
        message_leaders: payload.leaders?.message_leaders || [],
        view_leaders: payload.leaders?.view_leaders || [],
        high_interest: payload.leaders?.high_interest || [],
        high_views_low_messages: payload.leaders?.high_views_low_messages || [],
        weak_conversion: payload.leaders?.weak_conversion || [],
        fresh_traction: payload.leaders?.fresh_traction || [],
        needs_refresh: payload.leaders?.needs_refresh || [],
        price_attention: payload.leaders?.price_attention || [],
        cooling_off: payload.leaders?.cooling_off || [],
        recovered: payload.leaders?.recovered || []
      }
    };
    set("analytics", next, options);
    return next;
  }

  NS.state = {
    store,
    get,
    set,
    merge,
    persist,
    upsertListing,
    markMissingListingsRemoved,
    rebuildFilteredListings,
    setAnalytics,
    canonicalListingId,
    appendListingEvent,
    getListingEvents
  };

  NS.modules = NS.modules || {};
  NS.modules.state = true;
})();
