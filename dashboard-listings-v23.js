(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  NS.modules = NS.modules || {};

  const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
  const number = (v) => {
    const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const listingUi = { filter: 'all', search: '', sort: 'popular' };
  const reviewUi = { filter: 'all' };
  let rows = [];

  const REVIEW = {
    all: ['All Review', 'All unresolved operator checks.'],
    inventory_missing: ['Inventory Missing', 'Posted vehicle no longer confirmed in active inventory.'],
    price_review: ['Price Review', 'Price or mileage truth needs validation.'],
    not_seen: ['Not Seen', 'Vehicle has not been recently confirmed.'],
    data_cleanup: ['Data Cleanup', 'Marketplace URL, source, image, VIN, or stock is incomplete.'],
    weak_conversion: ['Weak Conversion', 'Low pressure listing that may need optimization.']
  };

  const STYLE = `
    .listing-card.truth-warning{border-color:rgba(212,175,55,.34)}
    .listing-placeholder{height:100%;min-height:160px;display:grid;place-items:center;text-align:center;color:#f3ddb0;background:linear-gradient(135deg,rgba(212,175,55,.08),rgba(255,255,255,.02));font-size:13px;font-weight:800;letter-spacing:.3px;padding:14px}
    .listing-truth-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.listing-truth-chip{display:inline-flex;align-items:center;min-height:28px;padding:0 9px;border-radius:999px;background:#171717;border:1px solid rgba(255,255,255,.07);font-size:12px;color:#d8d8d8}.listing-truth-chip.warn{color:#f3ddb0;border-color:rgba(212,175,55,.25);background:rgba(212,175,55,.08)}
    .listing-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.listing-card-actions .action-btn{min-height:34px;padding:7px 10px;font-size:12px}
    .review-command-shell{display:grid;gap:14px}.review-command-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;padding:14px 16px;border-radius:18px;background:#121212;border:1px solid rgba(212,175,55,.14)}.review-command-head h3{margin:0;font-size:22px;line-height:1.08}.review-command-head p{margin:6px 0 0;color:#a9a9a9;font-size:13px;line-height:1.45}.review-score{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;min-width:min(540px,100%)}.review-score-card{padding:11px;border-radius:13px;background:#171717;border:1px solid rgba(255,255,255,.06)}.review-score-card strong{display:block;font-size:21px;line-height:1}.review-score-card span{display:block;margin-top:6px;font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#aaa;font-weight:900}.review-score-card.critical{background:rgba(212,175,55,.08);border-color:rgba(212,175,55,.34)}
    .review-filter-bar{display:flex;gap:8px;flex-wrap:wrap}.review-filter-bar button{appearance:none;border:1px solid rgba(255,255,255,.08);background:#171717;color:#d8d8d8;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:900;cursor:pointer}.review-filter-bar button.active{background:rgba(212,175,55,.15);border-color:rgba(212,175,55,.35);color:#f3ddb0}
    .review-command-table{display:grid;gap:7px}.review-row{display:grid;grid-template-columns:12px minmax(220px,1.2fr) 150px minmax(280px,1.4fr) 150px auto;gap:10px;align-items:center;padding:10px 12px;border:1px solid rgba(255,255,255,.055);border-radius:13px;background:#151515}.review-row.critical{border-color:rgba(212,175,55,.34);background:rgba(212,175,55,.055)}.review-dot{width:9px;height:9px;border-radius:999px;background:#777}.review-row.critical .review-dot{background:#d4af37}.review-vehicle{min-width:0}.review-vehicle strong{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.review-vehicle span,.review-evidence,.review-reason{display:block;color:#a9a9a9;font-size:12px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.review-category{display:inline-flex;align-items:center;justify-content:center;min-height:26px;padding:0 9px;border-radius:999px;background:#101010;border:1px solid rgba(255,255,255,.07);color:#f3ddb0;font-size:11px;font-weight:900}.review-actions{display:flex;gap:7px;justify-content:flex-end}.review-actions .action-btn{min-height:31px;padding:6px 9px;font-size:12px}.review-empty{padding:16px;border-radius:14px;background:#151515;border:1px solid rgba(255,255,255,.05);color:#a9a9a9}.review-secondary-note{font-size:12px;color:#8d8d8d;line-height:1.45}
    @media(max-width:1160px){.review-row{grid-template-columns:12px minmax(0,1fr);align-items:start}.review-category,.review-evidence,.review-reason,.review-actions{grid-column:2}.review-actions{justify-content:flex-start}.review-score{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:720px){.review-score{grid-template-columns:1fr}.review-row{grid-template-columns:1fr}.review-dot{display:none}.review-category,.review-evidence,.review-reason,.review-actions{grid-column:1}}
  `;

  function injectStyle() {
    let style = document.getElementById('ea-listings-truth-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ea-listings-truth-style';
      document.head.appendChild(style);
    }
    style.textContent = STYLE;
  }

  function dateShort(value) {
    const d = value ? new Date(value) : null;
    return d && Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Not recorded';
  }

  function ageDays(value) {
    const d = value ? new Date(value).getTime() : 0;
    return Number.isFinite(d) && d > 0 ? Math.max(0, Math.floor((Date.now() - d) / 86400000)) : 0;
  }

  function formatPrice(item) {
    const text = clean(item.display_price_text || item.current_price || item.price);
    if (item.price_review_required || item.price_resolved === false || /needs review|pending/i.test(text)) return 'Price review';
    if (/^\$/.test(text)) return text;
    const n = number(text);
    return n > 0 ? `$${n.toLocaleString()}` : 'Price pending';
  }

  function formatMileage(item) {
    const text = clean(item.display_mileage_text);
    if (text) return text;
    const mileage = number(item.mileage || item.kilometers || item.odometer);
    return mileage > 0 ? `${mileage.toLocaleString()} km` : 'Mileage pending';
  }

  function status(item) { return clean(item.status).toLowerCase(); }
  function lifecycle(item) { return clean(item.lifecycle_status).toLowerCase(); }
  function bucket(item) { return clean(item.review_bucket).toLowerCase(); }

  function isInventoryMissing(item) {
    return ['sold', 'deleted', 'inactive', 'failed', 'removed'].includes(status(item)) || lifecycle(item) === 'review_delete' || bucket(item) === 'removedvehicles' || item.likely_sold;
  }

  function isPriceReview(item) {
    return !!item.price_review_required || item.price_resolved === false || lifecycle(item) === 'review_price_update' || bucket(item) === 'pricechanges' || !!clean(item.price_warning);
  }

  function isDataCleanup(item) {
    return !clean(item.marketplace_url) || !clean(item.source_url) || !clean(item.vin) || !clean(item.stock_number) || !!item.missing_image || !clean(item.image_url);
  }

  function isWeakConversion(item) {
    return !!item.weak || clean(item.health_state).toLowerCase() === 'weak_conversion' || (number(item.views_count || item.views) >= 12 && number(item.messages_count || item.messages) <= 1);
  }

  function primaryCategory(item) {
    if (isInventoryMissing(item)) return 'inventory_missing';
    if (isPriceReview(item)) return 'price_review';
    if (ageDays(item.last_seen_at) >= 14) return 'not_seen';
    if (isWeakConversion(item)) return 'weak_conversion';
    if (isDataCleanup(item)) return 'data_cleanup';
    if (item.needs_action) return 'data_cleanup';
    return 'none';
  }

  function normalize(item = {}) {
    const next = {
      ...item,
      id: clean(item.identity_key || item.id || item.marketplace_listing_id || item.vin || item.stock_number || item.title),
      identity_key: clean(item.identity_key || item.id || item.marketplace_listing_id || item.vin || item.stock_number || item.title),
      title: clean(item.title || `${clean(item.year)} ${clean(item.make)} ${clean(item.model)}`),
      price: item.display_price_text || item.current_price || item.price || '',
      current_price: item.display_price_text || item.current_price || item.price || '',
      views_count: number(item.views_count || item.views),
      messages_count: number(item.messages_count || item.messages),
      marketplace_url: clean(item.marketplace_url || item.posted_url || item.platform_listing_url),
      source_url: clean(item.source_url),
      image_url: clean(item.image_url),
      posted_at: item.posted_at || item.created_at || item.updated_at || null,
      last_seen_at: item.last_seen_at || item.updated_at || item.posted_at || null,
      status: item.status || 'active',
      lifecycle_status: item.lifecycle_status || 'active',
      review_bucket: item.review_bucket || '',
      sync_source: 'api_get_user_listings',
      sync_confidence: 'synced'
    };
    next.primary_review_category = primaryCategory(next);
    return next;
  }

  function isActive(item) { return !isInventoryMissing(item); }
  function reviewRows() { return rows.filter((item) => primaryCategory(item) !== 'none'); }
  function activeRows() { return rows.filter(isActive); }

  async function loadRows() {
    if (!NS.api?.apiFetch || !NS.api?.parseJsonSafe) return false;
    try {
      const res = await NS.api.apiFetch('/api/get-user-listings?limit=300&sort=newest', { method: 'GET' });
      const json = await NS.api.parseJsonSafe(res);
      if (!res.ok) throw new Error(json?.error || res.statusText);
      rows = (Array.isArray(json?.data) ? json.data : []).map(normalize);
      const registry = {};
      rows.forEach((item) => { registry[item.identity_key || item.id] = item; });
      NS.state?.set?.('listingRegistry', registry, { silent: true, skipPersist: true });
      NS.state?.setSyncState?.({ source: 'api_get_user_listings', confidence: 'synced', remote_listing_count: rows.length, last_ingest_at: new Date().toISOString() }, { silent: true, skipPersist: true });
      NS.state?.persist?.();
      return true;
    } catch (error) {
      console.warn('[dashboard-listings-v23] load failed:', error);
      rows = Object.values(NS.state?.get?.('listingRegistry', {}) || {}).map(normalize);
      return false;
    }
  }

  function applyListingFilter() {
    let out = activeRows();
    if (listingUi.filter === 'review') out = reviewRows();
    if (listingUi.filter === 'weak') out = activeRows().filter(isWeakConversion);
    if (listingUi.filter === 'needs_action') out = activeRows().filter((item) => item.needs_action || isPriceReview(item));
    if (listingUi.filter === 'likely_sold') out = reviewRows().filter((item) => primaryCategory(item) === 'inventory_missing');
    const search = clean(listingUi.search).toLowerCase();
    if (search) out = out.filter((item) => [item.title, item.vin, item.stock_number, item.make, item.model].map((v) => clean(v).toLowerCase()).join(' ').includes(search));
    if (listingUi.sort === 'newest') out.sort((a, b) => new Date(b.updated_at || b.posted_at || 0) - new Date(a.updated_at || a.posted_at || 0));
    else if (listingUi.sort === 'price_high') out.sort((a, b) => number(b.price) - number(a.price));
    else if (listingUi.sort === 'price_low') out.sort((a, b) => number(a.price) - number(b.price));
    else out.sort((a, b) => (number(b.messages_count) * 1000 + number(b.views_count)) - (number(a.messages_count) * 1000 + number(a.views_count)));
    return out;
  }

  function badge(item) {
    const cat = primaryCategory(item);
    if (cat === 'inventory_missing') return '<span class="badge sold">Inventory Missing</span>';
    if (cat === 'price_review') return '<span class="badge warn">Price Review</span>';
    if (cat === 'data_cleanup') return '<span class="badge warn">Data Cleanup</span>';
    return '<span class="badge active">Active</span>';
  }

  function listingCard(item) {
    const source = clean(item.source_url);
    const marketplace = clean(item.marketplace_url);
    return `<article class="listing-card" data-hydrated="true"><div class="listing-media">${item.image_url ? `<img src="${item.image_url}" alt="${clean(item.title)}" />` : '<div class="listing-placeholder">Image not synced</div>'}<div class="listing-badge">${badge(item)}</div></div><div class="listing-content"><div><div class="listing-title">${clean(item.title || 'Untitled Listing')}</div><div class="listing-sub">${clean(item.stock_number || '')}${item.vin ? ` • ${clean(item.vin)}` : ''}</div></div><div class="listing-price">${formatPrice(item)}</div><div class="listing-truth-row"><span class="listing-truth-chip">${formatMileage(item)}</span><span class="listing-truth-chip">Posted ${dateShort(item.posted_at)}</span><span class="listing-truth-chip">Seen ${dateShort(item.last_seen_at)}</span></div><div class="listing-metrics"><div class="metric-pill"><div class="metric-pill-label">Views</div><div class="metric-pill-value">${number(item.views_count)}</div></div><div class="metric-pill"><div class="metric-pill-label">Messages</div><div class="metric-pill-value">${number(item.messages_count)}</div></div><div class="metric-pill"><div class="metric-pill-label">Status</div><div class="metric-pill-value">${clean(item.lifecycle_status || item.status || 'tracked')}</div></div></div><div class="listing-card-actions">${marketplace ? `<button class="action-btn" type="button" data-open-url="${marketplace}">Open Marketplace</button>` : ''}${source ? `<button class="action-btn" type="button" data-open-url="${source}">Open Source</button>` : ''}</div></div></article>`;
  }

  function categoryReason(item) {
    const cat = primaryCategory(item);
    if (cat === 'inventory_missing') return 'Check availability';
    if (cat === 'price_review') return 'Verify price';
    if (cat === 'not_seen') return 'Confirm source';
    if (cat === 'weak_conversion') return 'Review conversion';
    return 'Clean data';
  }

  function evidence(item) {
    const age = ageDays(item.posted_at);
    return `Posted ${dateShort(item.posted_at)} · Seen ${dateShort(item.last_seen_at)} · ${age}d live`;
  }

  function row(item) {
    const cat = primaryCategory(item);
    const [label] = REVIEW[cat] || REVIEW.data_cleanup;
    const source = clean(item.source_url);
    const marketplace = clean(item.marketplace_url);
    const critical = cat === 'inventory_missing';
    return `<article class="review-row ${critical ? 'critical' : ''}"><div class="review-dot"></div><div class="review-vehicle"><strong>${clean(item.title || 'Listing')}</strong><span>${clean(item.stock_number || 'No stock')}${item.vin ? ` · ${clean(item.vin)}` : ''}</span></div><div><span class="review-category">${label}</span></div><div class="review-reason">${categoryReason(item)} · ${formatPrice(item)} · ${formatMileage(item)}</div><div class="review-evidence">${evidence(item)}</div><div class="review-actions">${marketplace ? `<button class="action-btn" type="button" data-open-url="${marketplace}">Marketplace</button>` : ''}${source ? `<button class="action-btn" type="button" data-open-url="${source}">Source</button>` : ''}${item.vin ? `<button class="action-btn" type="button" data-copy-text="${clean(item.vin)}">VIN</button>` : ''}</div></article>`;
  }

  function counts() {
    const r = reviewRows();
    return {
      all: r.length,
      inventory_missing: r.filter((x) => primaryCategory(x) === 'inventory_missing').length,
      price_review: r.filter((x) => primaryCategory(x) === 'price_review').length,
      not_seen: r.filter((x) => primaryCategory(x) === 'not_seen').length,
      data_cleanup: r.filter((x) => primaryCategory(x) === 'data_cleanup').length,
      weak_conversion: r.filter((x) => primaryCategory(x) === 'weak_conversion').length
    };
  }

  function filters(c) {
    return ['all', 'inventory_missing', 'price_review', 'not_seen', 'data_cleanup', 'weak_conversion'].map((key) => `<button type="button" class="${reviewUi.filter === key ? 'active' : ''}" data-review-filter="${key}">${REVIEW[key][0]} · ${c[key] || 0}</button>`).join('');
  }

  function renderListings() {
    const mount = document.getElementById('analyticsListingsGrid');
    if (!mount) return;
    const list = applyListingFilter();
    const status = document.getElementById('analyticsListingsStatus');
    const gridStatus = document.getElementById('analyticsListingsGridStatus');
    if (status) status.textContent = `${listingUi.filter === 'all' ? 'active portfolio' : listingUi.filter.replace(/_/g, ' ')} • ${list.length} rows available`;
    if (gridStatus) gridStatus.textContent = `${activeRows().length} active listing row${activeRows().length === 1 ? '' : 's'} loaded from Supabase truth.`;
    mount.innerHTML = list.length ? `<div class="listing-grid">${list.slice(0, 60).map(listingCard).join('')}</div>` : '<div class="listing-empty">No portfolio rows are available for this filter.</div>';
    bindActions(mount);
  }

  function renderReview() {
    const mount = document.getElementById('analyticsReviewQueue');
    const action = document.getElementById('analyticsNeedsActionQueue');
    const price = document.getElementById('analyticsPriceWatchQueue');
    if (action) action.innerHTML = '';
    if (price) price.innerHTML = '';
    if (!mount) return;
    const c = counts();
    const all = reviewRows();
    const critical = all.filter((x) => primaryCategory(x) === 'inventory_missing');
    const secondary = all.filter((x) => primaryCategory(x) !== 'inventory_missing');
    let visible = reviewUi.filter === 'all' ? [...critical, ...secondary] : all.filter((x) => primaryCategory(x) === reviewUi.filter);
    mount.innerHTML = `<div class="review-command-shell"><div class="review-command-head"><div><h3>Operator Review Queue</h3><p>Reduced command queue. Critical inventory checks stay above secondary cleanup.</p></div><div class="review-score"><div class="review-score-card critical"><strong>${c.inventory_missing}</strong><span>Critical</span></div><div class="review-score-card"><strong>${c.price_review}</strong><span>Price</span></div><div class="review-score-card"><strong>${c.data_cleanup}</strong><span>Cleanup</span></div><div class="review-score-card"><strong>${c.weak_conversion + c.not_seen}</strong><span>Secondary</span></div></div></div><div class="review-filter-bar">${filters(c)}</div><div class="review-secondary-note">Showing ${visible.length} of ${all.length} review items. Image and Marketplace URL gaps are secondary unless they block action.</div><div class="review-command-table">${visible.length ? visible.slice(0, 100).map(row).join('') : '<div class="review-empty">No items in this queue.</div>'}</div></div>`;
    bindReviewFilters(mount);
    bindActions(mount);
  }

  function bindActions(root = document) {
    root.querySelectorAll('[data-open-url]').forEach((btn) => {
      if (btn.dataset.boundOpen === 'true') return;
      btn.dataset.boundOpen = 'true';
      btn.addEventListener('click', () => window.open(btn.getAttribute('data-open-url'), '_blank', 'noopener,noreferrer'));
    });
    root.querySelectorAll('[data-copy-text]').forEach((btn) => {
      if (btn.dataset.boundCopy === 'true') return;
      btn.dataset.boundCopy = 'true';
      const original = btn.textContent;
      btn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(btn.getAttribute('data-copy-text') || ''); btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = original; }, 1000); } catch {}
      });
    });
  }

  function bindReviewFilters(root) {
    root.querySelectorAll('[data-review-filter]').forEach((btn) => {
      if (btn.dataset.boundReviewFilter === 'true') return;
      btn.dataset.boundReviewFilter = 'true';
      btn.addEventListener('click', () => { reviewUi.filter = btn.getAttribute('data-review-filter') || 'all'; renderReview(); });
    });
  }

  function bindControls() {
    const filters = document.getElementById('analyticsListingQuickFilters');
    const sort = document.getElementById('analyticsListingSortSelect');
    const search = document.getElementById('analyticsListingSearchInput');
    if (filters && filters.dataset.v23 !== 'true') {
      filters.dataset.v23 = 'true';
      Array.from(filters.querySelectorAll('button[data-filter]')).forEach((btn) => btn.addEventListener('click', () => {
        listingUi.filter = btn.getAttribute('data-filter') || 'all';
        Array.from(filters.querySelectorAll('button')).forEach((b) => b.classList.toggle('active', b === btn));
        renderListings();
      }));
    }
    if (sort && sort.dataset.v23 !== 'true') { sort.dataset.v23 = 'true'; sort.addEventListener('change', () => { listingUi.sort = clean(sort.value || 'popular'); renderListings(); }); }
    if (search && search.dataset.v23 !== 'true') { search.dataset.v23 = 'true'; search.addEventListener('input', () => { listingUi.search = search.value || ''; renderListings(); }); }
  }

  function renderAll() {
    injectStyle();
    renderListings();
    renderReview();
    bindControls();
    try {
      const summary = { tracking_summary: { total_listings: activeRows().length, review_queue_count: reviewRows().length, sync_source: 'supabase_truth', sync_confidence: 'synced', refreshed_at: new Date().toISOString() }, action_queue: [], leaders: {} };
      NS.state?.setAnalytics?.(summary, { silent: false });
    } catch {}
  }

  async function hydrateListings() {
    await loadRows();
    renderAll();
    return true;
  }

  window.addEventListener('elevate:remote-sync', hydrateListings);
  window.addEventListener('elevate:tracking-refreshed', renderAll);
  window.addEventListener('elevate:analytics-workspace-mounted', () => { hydrateListings(); });

  NS.listings = { hydrateListings, renderHydratedViews: renderAll, ingestRemotePayload: () => renderAll(), buildAnalyticsFromRegistry: () => ({}) };
  NS.modules.listings = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrateListings, { once: true });
  else hydrateListings();
})();