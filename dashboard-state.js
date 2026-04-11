(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.state) return;
  if (!(NS.events instanceof EventTarget)) NS.events = new EventTarget();

  const STORAGE_KEY = "elevate.dashboard.state.v4";
  const nowIso = () => new Date().toISOString();
  const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();
  const clone = (v) => { try { return JSON.parse(JSON.stringify(v)); } catch { return v; } };

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
      tracking: { source: "package_f_sync", last_rebuild_at: null },
      sync: {
        source: "local_only",
        confidence: "local",
        last_ingest_at: null,
        last_reconcile_at: null,
        remote_listing_count: 0,
        remote_event_count: 0,
        payload_version: null,
        issues: []
      },
      ui: { activeSection: "overview", listingQuickFilter: "all" }
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
          leaders: { ...base.analytics.leaders, ...((parsed.analytics || {}).leaders || {}) }
        },
        tracking: { ...base.tracking, ...(parsed.tracking || {}) },
        sync: { ...base.sync, ...(parsed.sync || {}) },
        listingRegistry: parsed.listingRegistry || {},
        listingEvents: Array.isArray(parsed.listingEvents) ? parsed.listingEvents : []
      };
    } catch {
      return base;
    }
  }

  const store = hydrate();

  function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch {} }
  function get(path, fallback = undefined) {
    if (!path) return store;
    return String(path).split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : fallback), store);
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
    if (!options.silent) NS.events.dispatchEvent(new CustomEvent("state:set", { detail: { path, value } }));
    return value;
  }
  function merge(path, payload = {}, options = {}) {
    const current = get(path, {});
    const next = { ...current, ...payload };
    set(path, next, options);
    return next;
  }

  function canonicalListingId(item = {}) {
    const preferred = clean(item.id || item.listing_id || item.marketplace_listing_id || item.vin || item.stock_number);
    if (preferred) return preferred;
    const title = clean(item.title).toLowerCase();
    const price = clean(item.current_price || item.price).toLowerCase();
    const image = clean(item.image_url).toLowerCase();
    return [title, price, image].filter(Boolean).join("|") || `listing_${Date.now()}`;
  }

  function appendListingEvent(event = {}, options = {}) {
    const events = Array.isArray(get("listingEvents", [])) ? get("listingEvents", []) : [];
    const next = {
      id: event.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      listing_id: clean(event.listing_id),
      type: clean(event.type || "listing_updated") || "listing_updated",
      timestamp: event.timestamp || nowIso(),
      source: clean(event.source || "local"),
      meta: clone(event.meta || {})
    };
    if (!next.listing_id) return null;
    const duplicate = events.find((evt) =>
      evt.listing_id === next.listing_id &&
      evt.type === next.type &&
      String(evt.timestamp) === String(next.timestamp) &&
      JSON.stringify(evt.meta || {}) === JSON.stringify(next.meta || {})
    );
    if (duplicate) return duplicate;
    events.push(next);
    while (events.length > 1500) events.shift();
    set("listingEvents", events, options);
    return next;
  }

  function getListingEvents(listingId) {
    return (get("listingEvents", []) || []).filter((evt) => evt.listing_id === listingId);
  }

  function setSyncState(payload = {}, options = {}) {
    const current = get("sync", {});
    const next = { ...current, ...payload, issues: Array.isArray(payload.issues) ? payload.issues : (current.issues || []) };
    set("sync", next, options);
    return next;
  }

  function upsertListing(item = {}, options = {}) {
    const registry = get("listingRegistry", {});
    const id = canonicalListingId(item);
    const existing = registry[id] || {};
    const now = nowIso();

    const views = n(item.views ?? item.views_count ?? existing.views ?? existing.views_count ?? 0);
    const messages = n(item.messages ?? item.messages_count ?? existing.messages ?? existing.messages_count ?? 0);
    const previousViews = n(existing.views ?? existing.views_count ?? 0);
    const previousMessages = n(existing.messages ?? existing.messages_count ?? 0);
    const previousPrice = clean(existing.current_price || existing.price);
    const incomingPrice = clean(item.current_price || item.price || existing.current_price || existing.price);

    const next = {
      ...existing,
      ...item,
      id,
      views,
      views_count: views,
      messages,
      messages_count: messages,
      first_seen_at: existing.first_seen_at || item.first_seen_at || now,
      last_seen_at: item.last_seen_at || now,
      last_view_at: views > previousViews ? now : (existing.last_view_at || null),
      last_message_at: messages > previousMessages ? now : (existing.last_message_at || null),
      previous_price: previousPrice && previousPrice !== incomingPrice ? previousPrice : (existing.previous_price || ""),
      current_price: incomingPrice,
      status: item.status || existing.status || "active",
      sync_source: clean(item.sync_source || existing.sync_source || "local"),
      sync_confidence: clean(item.sync_confidence || existing.sync_confidence || "local"),
      updated_at: now
    };

    registry[id] = next;
    set("listingRegistry", registry, { silent: options.silent, skipPersist: options.skipPersist });

    if (!options.skipEvents) {
      if (!existing.id) appendListingEvent({ listing_id: id, type: "listing_seen", source: next.sync_source, meta: { title: next.title || "" } }, { silent: true });
      if (views > previousViews) appendListingEvent({ listing_id: id, type: "view_update", source: next.sync_source, meta: { from: previousViews, to: views, delta: views - previousViews } }, { silent: true });
      if (messages > previousMessages) appendListingEvent({ listing_id: id, type: "message_update", source: next.sync_source, meta: { from: previousMessages, to: messages, delta: messages - previousMessages } }, { silent: true });
      if (previousPrice && incomingPrice && previousPrice != incomingPrice) appendListingEvent({ listing_id: id, type: "price_changed", source: next.sync_source, meta: { from: previousPrice, to: incomingPrice } }, { silent: true });
    }

    if (!options.skipPersist) persist();
    return next;
  }

  function markMissingListingsRemoved(currentIds = [], options = {}) {
    const registry = get("listingRegistry", {});
    const now = nowIso();
    Object.values(registry).forEach((item) => {
      if (item && item.id && !currentIds.includes(item.id) && clean(item.status).toLowerCase() !== "removed") {
        registry[item.id] = { ...item, status: "removed", removed_at: now, updated_at: now };
        if (!options.skipEvents) appendListingEvent({ listing_id: item.id, type: "listing_removed", source: "reconcile", meta: { title: item.title || "" } }, { silent: true });
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

  function applyRemoteSync(payload = {}, options = {}) {
    const listings = Array.isArray(payload.listings) ? payload.listings : [];
    const events = Array.isArray(payload.events) ? payload.events : [];
    const removedIds = Array.isArray(payload.removed_listing_ids) ? payload.removed_listing_ids.map(clean).filter(Boolean) : [];
    const issues = Array.isArray(payload.issues) ? payload.issues.filter(Boolean) : [];
    const now = nowIso();

    listings.forEach((item) => {
      upsertListing({
        ...item,
        sync_source: clean(payload.source || item.sync_source || "remote_sync"),
        sync_confidence: clean(payload.confidence || item.sync_confidence || "synced"),
        last_seen_at: item.last_seen_at || now
      }, { silent: true, skipPersist: true, skipEvents: false });
    });

    events.forEach((evt) => {
      const listingId = clean(evt.listing_id || canonicalListingId(evt));
      appendListingEvent({
        id: evt.id,
        listing_id: listingId,
        type: clean(evt.type || "listing_updated"),
        timestamp: evt.timestamp || now,
        source: clean(evt.source || payload.source || "remote_sync"),
        meta: evt.meta || {}
      }, { silent: true, skipPersist: true });
    });

    if (removedIds.length) {
      const registry = get("listingRegistry", {});
      removedIds.forEach((id) => {
        if (registry[id]) {
          registry[id] = { ...registry[id], status: "removed", removed_at: now, sync_source: clean(payload.source || "remote_sync"), sync_confidence: "synced", updated_at: now };
          appendListingEvent({ listing_id: id, type: "listing_removed", timestamp: now, source: clean(payload.source || "remote_sync"), meta: { reason: "remote_removed" } }, { silent: true, skipPersist: true });
        }
      });
      set("listingRegistry", registry, { silent: true, skipPersist: true });
    }

    setSyncState({
      source: clean(payload.source || "remote_sync"),
      confidence: clean(payload.confidence || ((listings.length || events.length) ? "synced" : "local")),
      last_ingest_at: payload.ingested_at || now,
      last_reconcile_at: now,
      remote_listing_count: listings.length,
      remote_event_count: events.length,
      payload_version: clean(payload.version || "v1"),
      issues
    }, { silent: true, skipPersist: true });

    rebuildFilteredListings();
    persist();
    if (!options.silent) {
      NS.events.dispatchEvent(new CustomEvent("sync:applied", { detail: { listings: listings.length, events: events.length } }));
      window.dispatchEvent(new CustomEvent("elevate:sync-refreshed", { detail: payload }));
    }
    return { listings: listings.length, events: events.length };
  }

  NS.state = {
    store, get, set, merge, persist,
    upsertListing, markMissingListingsRemoved, rebuildFilteredListings, setAnalytics,
    canonicalListingId, appendListingEvent, getListingEvents,
    setSyncState, applyRemoteSync
  };

  NS.modules = NS.modules || {};
  NS.modules.state = true;
})();