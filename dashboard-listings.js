(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.listings) return;

  const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();
  const n = (v) => { const m = String(v || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : 0; };
  const listingUi = { filter: "all", search: "", sort: "popular" };

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
    const lifecycle = clean(item.lifecycle_status).toLowerCase();
    const reviewBucket = clean(item.review_bucket).toLowerCase();
    const previousPrice = clean(item.previous_price);
    const currentPrice = clean(item.current_price || item.price);
    const hasViewLift = events.some((evt) => evt.type === "view_update" && Number(evt.meta?.delta || 0) >= 5);
    const hasMessageLift = events.some((evt) => evt.type === "message_update" && Number(evt.meta?.delta || 0) >= 1);
    const lastSeenMins = minutesSince(item.last_seen_at);

    if (status === "removed" || lifecycle === "review_delete" || reviewBucket === "removedvehicles") return "removed";
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
    if (item.source === "api_get_user_listings") return "synced";
    if (item.source === "recent_listings_grid") return "tracked";
    if (item.source === "summary_fallback") return "estimated";
    return "mixed";
  }

  function normalizeApiListing(item = {}) {
    return {
      ...item,
      id: clean(item.identity_key || item.id || item.marketplace_listing_id || item.vin || item.stock_number),
      title: clean(item.title || `${clean(item.year)} ${clean(item.make)} ${clean(item.model)}`.trim()),
      price: item.display_price_text || item.current_price || item.price || "",
      current_price: item.display_price_text || item.current_price || item.price || "",
      views: Number(item.views || item.views_count || 0),
      views_count: Number(item.views || item.views_count || 0),
      messages: Number(item.messages || item.messages_count || 0),
      messages_count: Number(item.messages || item.messages_count || 0),
      image_url: item.image_url || "",
      source: "api_get_user_listings",
      sync_source: "api_get_user_listings",
      sync_confidence: "synced",
      last_seen_at: item.last_seen_at || item.updated_at || item.posted_at || new Date().toISOString(),
      posted_at: item.posted_at || item.created_at || item.updated_at || null,
      status: item.status || "active",
      lifecycle_status: item.lifecycle_status || "active",
      review_bucket: item.review_bucket || "",
      previous_price: item.previous_price || "",
      source_table: item.source_table || "user_listings",
      likely_sold: Boolean(item.likely_sold),
      weak: Boolean(item.weak),
      needs_action: Boolean(item.needs_action),
      recommended_action: item.recommended_action || "Review listing"
    };
  }

  async function fetchListingsFromApi() {
    if (!NS.api?.apiFetch || !NS.api?.parseJsonSafe) return null;
    try {
      const response = await NS.api.apiFetch("/api/get-user-listings?limit=200&sort=newest", { method: "GET" });
      const result = await NS.api.parseJsonSafe(response);
      if (!response.ok) {
        console.warn("[dashboard-listings] api load failed:", result?.error || response.statusText);
        return null;
      }
      const rows = Array.isArray(result?.data) ? result.data : [];
      return {
        source: "api_get_user_listings",
        confidence: rows.length ? "synced" : "empty",
        ingested_at: new Date().toISOString(),
        version: "v1",
        issues: [],
        listings: rows.map(normalizeApiListing),
        events: []
      };
    } catch (error) {
      console.warn("[dashboard-listings] api exception:", error);
      return null;
    }
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
    const candidates = [window.__EA_REMOTE_SYNC_PAYLOAD, window.__EA_SYNC_PAYLOAD, window.__EA_LISTING_SYNC, window.__ELEVATE_REMOTE_SYNC];
    return candidates.find((x) => x && typeof x === "object") || null;
  }

  function buildAnalyticsFromRegistry() {
    const state = NS.state;
    const listings = Object.values(state?.get?.("listingRegistry", {}) || {});
    const sync = state?.get?.("sync", {}) || {};
    const events = state?.get?.("listingEvents", []) || [];
    const sortedByViews = [...listings].sort((a, b) => Number(b.views || b.views_count || 0) - Number(a.views || a.views_count || 0));
    const sortedByMessages = [...listings].sort((a, b) => Number(b.messages || b.messages_count || 0) - Number(a.messages || a.messages_count || 0));
    const reviewQueue = listings.filter((item) => isReviewItem(item));

    const buckets = {
      message_leaders: listings.filter((item) => item.health_state === "message_leader").slice(0, 5),
      view_leaders: listings.filter((item) => item.health_state === "view_leader").slice(0, 5),
      high_interest: listings.filter((item) => item.health_state === "high_interest").slice(0, 5),
      high_views_low_messages: listings.filter((item) => item.health_state === "high_views_low_messages").slice(0, 5),
      weak_conversion: listings.filter((item) => item.health_state === "weak_conversion" || item.weak).slice(0, 5),
      fresh_traction: listings.filter((item) => item.health_state === "fresh_traction").slice(0, 5),
      needs_refresh: listings.filter((item) => item.health_state === "needs_refresh").slice(0, 5),
      price_attention: listings.filter((item) => item.health_state === "price_attention" || clean(item.lifecycle_status).toLowerCase() === "review_price_update").slice(0, 5),
      cooling_off: listings.filter((item) => Number(item.views || 0) > 0 && minutesSince(item.last_view_at) > 240 && Number(item.messages || 0) <= 1).slice(0, 5),
      recovered: listings.filter((item) => {
        const listingEvents = state?.getListingEvents?.(item.id) || [];
        return listingEvents.some((evt) => evt.type === "price_changed") && listingEvents.some((evt) => evt.type === "message_update");
      }).slice(0, 5)
    };

    const trackedViews = listings.reduce((sum, item) => sum + Number(item.views || item.views_count || 0), 0);
    const trackedMessages = listings.reduce((sum, item) => sum + Number(item.messages || item.messages_count || 0), 0);
    const actionQueue = [];
    if ((sync.issues || []).length) actionQueue.push({ id: "sync_issue", title: "Sync truth needs attention", copy: (sync.issues || []).slice(0, 2).join(" "), reason: "Recommendations may rely on fallback tracking until sync is healthy.", tone: "cleanup", section: "tools", focus: "listingSearchInput" });
    if (buckets.high_views_low_messages.length) {
      const leader = buckets.high_views_low_messages[0];
      actionQueue.push({ id: "high_views_low_messages", title: `${buckets.high_views_low_messages.length} listing${buckets.high_views_low_messages.length === 1 ? "" : "s"} have traction without conversion`, copy: `${leader.title || "Top listing"} is pulling views without messages. Review price, CTA, and media.`, reason: "High views with flat message velocity is a conversion leak.", tone: "revenue", section: "tools", focus: "listingSearchInput" });
    }
    if (!actionQueue.length) actionQueue.push({ id: "sync_quiet", title: "Unified sync layer is live", copy: "Hydrated portfolio rows are now coming from the canonical listing registry.", reason: "Current state is stable and synced.", tone: "growth", section: "tools", focus: null });

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
        review_queue_count: reviewQueue.length,
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

  function rebuildRegistryFromFallback() {
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
    applyHealthToRegistry();
    state?.rebuildFilteredListings?.();
    return buildAnalyticsFromRegistry();
  }

  function applyHealthToRegistry() {
    const state = NS.state;
    const registry = Object.values(state?.get?.("listingRegistry", {}) || {});
    registry.forEach((item) => {
      const listingEvents = state?.getListingEvents?.(item.id) || [];
      item.health_state = inferHealth(item, listingEvents);
      item.confidence = confidenceFor(item);
      state.upsertListing(item, { silent: true, skipEvents: true, skipPersist: true });
    });
  }

  function ingestRemotePayload(payload) {
    if (!payload || !NS.state?.applyRemoteSync) return false;
    NS.state.applyRemoteSync(payload);
    applyHealthToRegistry();
    NS.state.rebuildFilteredListings?.();
    buildAnalyticsFromRegistry();
    renderHydratedViews();
    return true;
  }

  function allRegistryListings() {
    return Object.values(NS.state?.get?.("listingRegistry", {}) || {});
  }

  function isReviewItem(item) {
    const lifecycle = clean(item.lifecycle_status).toLowerCase();
    const bucket = clean(item.review_bucket).toLowerCase();
    return lifecycle.startsWith("review_") || bucket === "removedvehicles" || bucket === "pricechanges" || !!item.needs_action || !!item.weak;
  }

  function applyFilter(items) {
    const search = clean(listingUi.search).toLowerCase();
    let out = [...items];
    if (listingUi.filter === "active") out = out.filter((item) => clean(item.status).toLowerCase() === "active" && !isReviewItem(item));
    if (listingUi.filter === "review") out = out.filter((item) => isReviewItem(item));
    if (listingUi.filter === "weak") out = out.filter((item) => !!item.weak || clean(item.health_state).toLowerCase() === "weak_conversion");
    if (listingUi.filter === "likely_sold") out = out.filter((item) => !!item.likely_sold || clean(item.lifecycle_status).toLowerCase() === "review_delete" || clean(item.review_bucket).toLowerCase() === "removedvehicles");
    if (listingUi.filter === "needs_action") out = out.filter((item) => !!item.needs_action);
    if (search) out = out.filter((item) => [item.title, item.make, item.model, item.vin, item.stock_number].map((v) => clean(v).toLowerCase()).join(" ").includes(search));
    if (listingUi.sort === "newest") out.sort((a, b) => new Date(b.updated_at || b.posted_at || 0) - new Date(a.updated_at || a.posted_at || 0));
    else if (listingUi.sort === "price_high") out.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    else if (listingUi.sort === "price_low") out.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    else out.sort((a, b) => (Number(b.messages || b.messages_count || 0) * 1000 + Number(b.views || b.views_count || 0)) - (Number(a.messages || a.messages_count || 0) * 1000 + Number(a.views || a.views_count || 0)));
    return out;
  }

  function findSection(id, titleText) {
    return document.getElementById(id) || Array.from(document.querySelectorAll('.dashboard-section, section, .card')).find((node) => {
      const heading = node.querySelector('h1, h2, h3');
      return clean(heading?.textContent).toLowerCase() === clean(titleText).toLowerCase();
    }) || null;
  }

  function ensureMount(section, mountId) {
    if (!section) return null;
    let mount = section.querySelector(`#${mountId}`);
    if (mount) return mount;
    mount = document.createElement('div');
    mount.id = mountId;
    mount.style.marginTop = '18px';
    section.appendChild(mount);
    return mount;
  }

  function cardBadge(item) {
    const lifecycle = clean(item.lifecycle_status).toLowerCase();
    if (lifecycle === 'review_delete') return '<span class="badge sold">Likely Sold</span>';
    if (lifecycle === 'review_price_update') return '<span class="badge warn">Price Watch</span>';
    if (item.needs_action) return '<span class="badge warn">Needs Action</span>';
    if (clean(item.status).toLowerCase() === 'active') return '<span class="badge active">Active</span>';
    return `<span class="badge warn">${clean(item.status || 'Tracked')}</span>`;
  }

  function formatPrice(item) {
    const p = clean(item.current_price || item.price || item.display_price_text || '');
    return p || 'Price pending';
  }

  function listingCard(item) {
    return `
      <article class="listing-card" data-hydrated="true">
        <div class="listing-media">
          ${item.image_url ? `<img src="${item.image_url}" alt="${clean(item.title)}" />` : ''}
          <div class="listing-badge">${cardBadge(item)}</div>
        </div>
        <div class="listing-content">
          <div>
            <div class="listing-title">${clean(item.title || 'Untitled Listing')}</div>
            <div class="listing-sub">${clean(item.stock_number || '')}${item.vin ? ` • ${clean(item.vin)}` : ''}</div>
          </div>
          <div class="listing-price">${formatPrice(item)}</div>
          <div class="listing-metrics">
            <div class="metric-pill"><div class="metric-pill-label">Views</div><div class="metric-pill-value">${Number(item.views || item.views_count || 0)}</div></div>
            <div class="metric-pill"><div class="metric-pill-label">Messages</div><div class="metric-pill-value">${Number(item.messages || item.messages_count || 0)}</div></div>
            <div class="metric-pill"><div class="metric-pill-label">Status</div><div class="metric-pill-value">${clean(item.lifecycle_status || item.status || 'tracked')}</div></div>
          </div>
          <div class="listing-sub">${clean(item.recommended_action || 'Review listing')}</div>
        </div>
      </article>
    `;
  }

  function reviewCard(item) {
    return `
      <article class="overview-action-item" data-hydrated-review="true">
        <div>
          <div class="title">${clean(item.title || 'Listing')}</div>
          <div class="sub">${clean(item.recommended_action || 'Review listing')} • ${clean(item.stock_number || item.vin || '')}</div>
        </div>
        <div>${cardBadge(item)}</div>
      </article>
    `;
  }

  function renderListingsSection() {
    const section = findSection('listings', 'Listings');
    if (!section) return;
    const mount = ensureMount(section, 'eaHydratedListingsMount');
    if (!mount) return;
    const rows = applyFilter(allRegistryListings());
    const statusNode = Array.from(section.querySelectorAll('*')).find((node) => clean(node.textContent).toLowerCase().includes('rows available'));
    if (statusNode) statusNode.textContent = `${listingUi.filter.replace('_', ' ')} • ${rows.length} rows available`;
    Array.from(section.querySelectorAll('.listing-empty')).forEach((node) => { node.style.display = rows.length ? 'none' : 'block'; });
    mount.innerHTML = rows.length ? `<div class="listing-grid">${rows.slice(0, 60).map(listingCard).join('')}</div>` : `<div class="listing-empty">No portfolio rows are available yet.</div>`;
  }

  function setReviewMetric(labelMatchers, value) {
    const labels = Array.from(document.querySelectorAll('.stat-label, .sidebar-card-label, .card h3, .card h2, .card div'));
    labels.forEach((label) => {
      const text = clean(label.textContent).toLowerCase();
      if (!labelMatchers.some((matcher) => text.includes(matcher))) return;
      const card = label.closest('.card');
      const statValue = card?.querySelector('.stat-value');
      if (statValue) statValue.textContent = String(value);
    });
  }

  function renderReviewCenter() {
    const section = findSection('reviewCenter', 'Review Center') || findSection('review-center', 'Review Center');
    if (!section) return;
    const mount = ensureMount(section, 'eaHydratedReviewMount');
    if (!mount) return;
    const reviewRows = allRegistryListings().filter(isReviewItem);
    const likelySold = reviewRows.filter((item) => !!item.likely_sold || clean(item.lifecycle_status).toLowerCase() === 'review_delete' || clean(item.review_bucket).toLowerCase() === 'removedvehicles');
    const weakRows = allRegistryListings().filter((item) => !!item.weak || clean(item.health_state).toLowerCase() === 'weak_conversion');
    const priceWatch = reviewRows.filter((item) => clean(item.lifecycle_status).toLowerCase() === 'review_price_update' || clean(item.review_bucket).toLowerCase() === 'pricechanges');
    const needsAttention = reviewRows.filter((item) => !!item.needs_action).slice(0, 6);
    setReviewMetric(['review queue'], reviewRows.length);
    setReviewMetric(['likely sold'], likelySold.length);
    setReviewMetric(['weak listings'], weakRows.length);
    setReviewMetric(['promote now'], allRegistryListings().filter((item) => clean(item.recommended_action).toLowerCase().includes('promote')).length);
    mount.innerHTML = `
      <div class="grid-2" style="margin-top:18px;">
        <div class="card"><h3>Needs Attention</h3><div class="overview-action-list">${needsAttention.length ? needsAttention.map(reviewCard).join('') : '<div class="listing-empty">No critical items right now.</div>'}</div></div>
        <div class="card"><h3>Price Watch</h3><div class="overview-action-list">${priceWatch.length ? priceWatch.slice(0, 6).map(reviewCard).join('') : '<div class="listing-empty">No price-watch items right now.</div>'}</div></div>
      </div>
      <div class="card" style="margin-top:18px;">
        <h3>Priority Review Cards</h3>
        <div class="overview-action-list">${reviewRows.length ? reviewRows.slice(0, 20).map(reviewCard).join('') : '<div class="listing-empty">No review cards are hydrated into this section yet.</div>'}</div>
      </div>
    `;
  }

  function bindControls() {
    const section = findSection('listings', 'Listings');
    if (!section || section.dataset.hydratedBindings === 'true') return;
    section.dataset.hydratedBindings = 'true';
    const buttons = Array.from(section.querySelectorAll('button')).filter((btn) => ['all', 'active', 'review', 'weak', 'likely sold', 'needs action'].includes(clean(btn.textContent).toLowerCase()));
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const text = clean(btn.textContent).toLowerCase();
        listingUi.filter = text.replace(' ', '_');
        buttons.forEach((b) => b.classList.toggle('active', b === btn));
        renderListingsSection();
      });
    });
    const select = section.querySelector('select');
    if (select) {
      select.addEventListener('change', () => {
        const value = clean(select.value || select.options?.[select.selectedIndex]?.textContent).toLowerCase();
        if (value.includes('new')) listingUi.sort = 'newest';
        else if (value.includes('high')) listingUi.sort = 'price_high';
        else if (value.includes('low')) listingUi.sort = 'price_low';
        else listingUi.sort = 'popular';
        renderListingsSection();
      });
    }
    const search = section.querySelector('input');
    if (search) {
      search.addEventListener('input', () => {
        listingUi.search = search.value || '';
        renderListingsSection();
      });
    }
  }

  function renderHydratedViews() {
    renderListingsSection();
    renderReviewCenter();
    bindControls();
  }

  async function hydrateListings() {
    const apiPayload = await fetchListingsFromApi();
    if (apiPayload?.listings?.length) {
      ingestRemotePayload(apiPayload);
      return true;
    }
    const remote = getWindowRemotePayload();
    if (remote) {
      ingestRemotePayload(remote);
      return true;
    }
    rebuildRegistryFromFallback();
    renderHydratedViews();
    return false;
  }

  function bindRefresh() {
    const btn = document.getElementById('refreshListingsBtn');
    if (!btn || btn.dataset.packageFBound === 'true') return;
    btn.dataset.packageFBound = 'true';
    btn.addEventListener('click', async () => {
      await hydrateListings();
      window.dispatchEvent(new CustomEvent('elevate:tracking-refreshed'));
    });
  }

  async function boot() {
    await hydrateListings();
    bindRefresh();
    setTimeout(() => { hydrateListings(); }, 1200);
    setTimeout(() => { const payload = getWindowRemotePayload(); if (payload) ingestRemotePayload(payload); }, 3200);
  }

  window.addEventListener('elevate:remote-sync', (event) => { if (event?.detail) ingestRemotePayload(event.detail); });
  window.addEventListener('elevate:tracking-refreshed', renderHydratedViews);

  NS.listings = { rebuildRegistry: rebuildRegistryFromFallback, buildAnalyticsFromRegistry, ingestRemotePayload, hydrateListings, renderHydratedViews };
  NS.modules = NS.modules || {};
  NS.modules.listings = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { boot(); }, { once: true });
  else boot();
})();
