(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.listings) return;

  const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();
  const n = (v) => { const m = String(v || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : 0; };
  function minutesSince(iso) {
    if (!iso) return Infinity;
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return Infinity;
    return Math.max(0, Math.round((Date.now() - ts) / 60000));
  }

  function inferHealth(item, events = []) {
    const views = Number(item.views || item.views_count || 0);
    const messages = Number(item.messages || item.messages_count || 0);
    const status = clean(item.status).toLowerCase();
    const previousPrice = clean(item.previous_price);
    const currentPrice = clean(item.current_price || item.price);
    const hasViewLift = events.some((evt) => evt.type === "view_update" && Number(evt.meta?.delta || 0) >= 5);
    const hasMessageLift = events.some((evt) => evt.type === "message_update" && Number(evt.meta?.delta || 0) >= 1);
    const lastSeenMins = minutesSince(item.last_seen_at);

    if (status === "removed") return "removed";
    if (status === "sold") return "sold";
    if (hasMessageLift && messages >= 2) return "fresh_traction";
    if (messages >= 3) return "message_leader";
    if (minutesSince(item.last_message_at) <= 180 && messages > 0) return "high_interest";
    if (views >= 25 && messages === 0) return "high_views_low_messages";
    if (views >= 12 && messages <= 1) return "weak_conversion";
    if (previousPrice && currentPrice && previousPrice !== currentPrice) return "price_attention";
    if (lastSeenMins > 240 && views > 0 && !hasViewLift && !hasMessageLift) return "needs_refresh";
    if (minutesSince(item.last_view_at) <= 180 && views > 0) return "view_leader";
    if (views === 0 && messages === 0) return "low_signal";
    return "active";
  }

  function confidenceFor(item) {
    const sync = clean(item.sync_confidence || "").toLowerCase();
    if (sync) return sync;
    if (item.source === "recent_listings_grid") return "tracked";
    if (item.source === "summary_fallback") return "estimated";
    return "mixed";
  }

  function readListingCardsFromDOM() {
    const cards = Array.from(document.querySelectorAll("#recentListingsGrid .listing-card"));
    return cards.map((card, idx) => {
      const title = clean(card.querySelector(".listing-title")?.textContent || `Listing ${idx + 1}`);
      const price = clean(card.querySelector(".listing-price")?.textContent || "");
      const specs = Array.from(card.querySelectorAll(".spec-chip, .metric-pill")).map((el) => clean(el.textContent));
      const textBlob = clean(card.textContent || "");
      const views = n(specs.find((s) => /view/i.test(s)) || (textBlob.match(/views?\s*:?\s*([\d,]+)/i) || [])[1] || 0);
      const messages = n(specs.find((s) => /message/i.test(s)) || (textBlob.match(/messages?\s*:?\s*([\d,]+)/i) || [])[1] || 0);
      const image = card.querySelector("img")?.getAttribute("src") || "";
      return {
        id: clean(card.dataset.listingId || title || `listing_${idx}`),
        title, price, views, messages, image_url: image,
        source: "recent_listings_grid",
        status: "active",
        last_seen_at: new Date().toISOString(),
        sync_source: "dom_fallback",
        sync_confidence: "tracked"
      };
    });
  }

  function readSummaryFallback() {
    const summary = window.dashboardSummary || {};
    const activeListings = Number(summary.active_listings || 0);
    const totalViews = Number(summary.total_views || summary.views || 0);
    const totalMessages = Number(summary.total_messages || summary.messages || 0);
    const items = [];
    if (!activeListings) return items;
    const avgViews = Math.round(totalViews / Math.max(activeListings, 1));
    const avgMessages = Math.round(totalMessages / Math.max(activeListings, 1));
    for (let i = 0; i < Math.min(activeListings, 5); i += 1) {
      items.push({
        id: `summary_listing_${i + 1}`,
        title: `Tracked Listing ${i + 1}`,
        price: "",
        views: avgViews,
        messages: avgMessages,
        source: "summary_fallback",
        status: "active",
        last_seen_at: new Date().toISOString(),
        sync_source: "summary_fallback",
        sync_confidence: "estimated"
      });
    }
    return items;
  }

  function getWindowRemotePayload() {
    const candidates = [
      window.__EA_REMOTE_SYNC_PAYLOAD,
      window.__EA_SYNC_PAYLOAD,
      window.__EA_LISTING_SYNC,
      window.__ELEVATE_REMOTE_SYNC
    ];
    return candidates.find((x) => x && typeof x === "object") || null;
  }

  function buildAnalyticsFromRegistry() {
    const state = NS.state;
    const listings = Object.values(state?.get?.("listingRegistry", {}) || {}).filter((item) => clean(item.status).toLowerCase() !== "removed");
    const sync = state?.get?.("sync", {}) || {};
    const events = state?.get?.("listingEvents", []) || [];
    const sortedByViews = [...listings].sort((a, b) => Number(b.views || b.views_count || 0) - Number(a.views || a.views_count || 0));
    const sortedByMessages = [...listings].sort((a, b) => Number(b.messages || b.messages_count || 0) - Number(a.messages || a.messages_count || 0));

    const buckets = {
      message_leaders: listings.filter((item) => item.health_state === "message_leader").slice(0, 5),
      view_leaders: listings.filter((item) => item.health_state === "view_leader").slice(0, 5),
      high_interest: listings.filter((item) => item.health_state === "high_interest").slice(0, 5),
      high_views_low_messages: listings.filter((item) => item.health_state === "high_views_low_messages").slice(0, 5),
      weak_conversion: listings.filter((item) => item.health_state === "weak_conversion").slice(0, 5),
      fresh_traction: listings.filter((item) => item.health_state === "fresh_traction").slice(0, 5),
      needs_refresh: listings.filter((item) => item.health_state === "needs_refresh").slice(0, 5),
      price_attention: listings.filter((item) => item.health_state === "price_attention").slice(0, 5),
      cooling_off: listings.filter((item) => Number(item.views || 0) > 0 && minutesSince(item.last_view_at) > 240 && Number(item.messages || 0) <= 1).slice(0, 5),
      recovered: listings.filter((item) => {
        const listingEvents = state?.getListingEvents?.(item.id) || [];
        return listingEvents.some((evt) => evt.type === "price_changed") && listingEvents.some((evt) => evt.type === "message_update");
      }).slice(0, 5)
    };

    const trackedViews = listings.reduce((sum, item) => sum + Number(item.views || item.views_count || 0), 0);
    const trackedMessages = listings.reduce((sum, item) => sum + Number(item.messages || item.messages_count || 0), 0);
    const actionQueue = [];

    if ((sync.issues || []).length) {
      actionQueue.push({
        id: "sync_issue",
        title: "Sync truth needs attention",
        copy: (sync.issues || []).slice(0, 2).join(" "),
        reason: "Recommendations may rely on fallback tracking until sync is healthy.",
        tone: "cleanup",
        section: "tools",
        focus: "listingSearchInput"
      });
    }
    if (buckets.fresh_traction.length) {
      const leader = buckets.fresh_traction[0];
      actionQueue.push({
        id: "fresh_traction",
        title: `${buckets.fresh_traction.length} listing${buckets.fresh_traction.length === 1 ? "" : "s"} have fresh traction`,
        copy: `${leader.title || "A listing"} just gained message activity. Promote or keep it visible while momentum is fresh.`,
        reason: "Backed by recent message-update history.",
        tone: "growth",
        section: "overview",
        focus: "listingSearchInput"
      });
    }
    if (buckets.high_views_low_messages.length) {
      const leader = buckets.high_views_low_messages[0];
      actionQueue.push({
        id: "high_views_low_messages",
        title: `${buckets.high_views_low_messages.length} listing${buckets.high_views_low_messages.length === 1 ? "" : "s"} have traction without conversion`,
        copy: `${leader.title || "Top listing"} is pulling views without messages. Review price, CTA, and media.`,
        reason: "High views with flat message velocity is a conversion leak.",
        tone: "revenue",
        section: "tools",
        focus: "listingSearchInput"
      });
    }
    if (buckets.weak_conversion.length) {
      const leader = buckets.weak_conversion[0];
      actionQueue.push({
        id: "weak_conversion",
        title: `${buckets.weak_conversion.length} weak converter${buckets.weak_conversion.length === 1 ? "" : "s"} need rescue`,
        copy: `${leader.title || "A listing"} has enough attention to matter, but not enough response to stay unchanged.`,
        reason: "Weak conversion compared with current tracked attention.",
        tone: "cleanup",
        section: "tools",
        focus: "listingSearchInput"
      });
    }
    if (buckets.price_attention.length) {
      const leader = buckets.price_attention[0];
      actionQueue.push({
        id: "price_attention",
        title: `${buckets.price_attention.length} listing${buckets.price_attention.length === 1 ? "" : "s"} need price attention`,
        copy: `${leader.title || "A listing"} changed price. Check whether traction improved or if more intervention is needed.`,
        reason: "Price change should be followed by traction review.",
        tone: "cleanup",
        section: "tools",
        focus: "listingSearchInput"
      });
    }
    if (!actionQueue.length) {
      actionQueue.push({
        id: "sync_quiet",
        title: "Unified sync layer is live",
        copy: "As more synced listing payloads and events arrive, recommendation quality should continue improving.",
        reason: "Current state is stable but signal volume is still building.",
        tone: "growth",
        section: "tools",
        focus: null
      });
    }

    const countType = (type) => events.filter((evt) => evt.type === type).length;
    const payload = {
      tracking_summary: {
        total_listings: listings.length,
        tracked_views: trackedViews,
        tracked_messages: trackedMessages,
        message_leaders_count: buckets.message_leaders.length || sortedByMessages.filter((item) => Number(item.messages || 0) > 0).length,
        view_leaders_count: buckets.view_leaders.length || sortedByViews.filter((item) => Number(item.views || 0) > 0).length,
        high_interest_count: buckets.high_interest.length,
        high_views_low_messages_count: buckets.high_views_low_messages.length,
        weak_conversion_count: buckets.weak_conversion.length,
        fresh_traction_count: buckets.fresh_traction.length,
        needs_refresh_count: buckets.needs_refresh.length,
        price_attention_count: buckets.price_attention.length,
        cooling_off_count: buckets.cooling_off.length,
        recovered_count: buckets.recovered.length,
        listing_seen_events: countType("listing_seen"),
        view_update_events: countType("view_update"),
        message_update_events: countType("message_update"),
        price_changed_events: countType("price_changed"),
        listing_removed_events: countType("listing_removed"),
        sync_source: clean(sync.source || "local_only"),
        sync_confidence: clean(sync.confidence || "local"),
        sync_remote_listing_count: Number(sync.remote_listing_count || 0),
        sync_remote_event_count: Number(sync.remote_event_count || 0),
        refreshed_at: new Date().toISOString()
      },
      action_queue: actionQueue,
      leaders: buckets
    };
    state?.setAnalytics?.(payload, { silent: false });
    state?.set?.("tracking.last_rebuild_at", payload.tracking_summary.refreshed_at, { silent: true });
    state?.set?.("tracking.source", "package_f_sync", { silent: true, skipPersist: false });
    return payload;
  }

  function rebuildRegistry() {
    const state = NS.state;
    if (!state?.upsertListing) return;
    let items = readListingCardsFromDOM();
    if (!items.length) items = readSummaryFallback();

    const currentIds = [];
    items.forEach((item, idx) => {
      const next = { ...item };
      if (!next.id) next.id = `${next.title || "listing"}_${idx + 1}`;
      const upserted = state.upsertListing(next, { silent: true });
      currentIds.push(upserted.id);
    });

    state?.markMissingListingsRemoved?.(currentIds, { skipPersist: false });
    const registry = Object.values(state?.get?.("listingRegistry", {}) || {});
    registry.forEach((item) => {
      const listingEvents = state?.getListingEvents?.(item.id) || [];
      item.health_state = inferHealth(item, listingEvents);
      item.confidence = confidenceFor(item);
      state.upsertListing(item, { silent: true, skipEvents: true });
    });

    state?.rebuildFilteredListings?.();
    return buildAnalyticsFromRegistry();
  }

  function ingestRemotePayload(payload) {
    if (!payload || !NS.state?.applyRemoteSync) return false;
    NS.state.applyRemoteSync(payload);
    const registry = Object.values(NS.state.get("listingRegistry", {}) || {});
    registry.forEach((item) => {
      const listingEvents = NS.state.getListingEvents?.(item.id) || [];
      item.health_state = inferHealth(item, listingEvents);
      item.confidence = confidenceFor(item);
      NS.state.upsertListing(item, { silent: true, skipEvents: true, skipPersist: true });
    });
    NS.state.rebuildFilteredListings?.();
    buildAnalyticsFromRegistry();
    return true;
  }

  function bindRefresh() {
    const btn = document.getElementById("refreshListingsBtn");
    if (!btn || btn.dataset.packageFBound === "true") return;
    btn.dataset.packageFBound = "true";
    btn.addEventListener("click", () => {
      const remote = getWindowRemotePayload();
      if (remote) ingestRemotePayload(remote);
      else rebuildRegistry();
      window.dispatchEvent(new CustomEvent("elevate:tracking-refreshed"));
    });
  }

  function boot() {
    const remote = getWindowRemotePayload();
    if (remote) ingestRemotePayload(remote);
    else rebuildRegistry();
    bindRefresh();
    setTimeout(() => { const payload = getWindowRemotePayload(); if (payload) ingestRemotePayload(payload); else rebuildRegistry(); }, 1200);
    setTimeout(() => { const payload = getWindowRemotePayload(); if (payload) ingestRemotePayload(payload); }, 3200);
  }

  window.addEventListener("elevate:remote-sync", (event) => { if (event?.detail) ingestRemotePayload(event.detail); });

  NS.listings = { rebuildRegistry, buildAnalyticsFromRegistry, ingestRemotePayload };
  NS.modules = NS.modules || {};
  NS.modules.listings = true;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();