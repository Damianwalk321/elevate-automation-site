(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.listingCentreUpgradeV21) return;
  NS.modules = NS.modules || {};

  const VERSION = 'intelligence-centre-2.1-20260524b';
  const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
  const lower = (v) => clean(v).toLowerCase();
  const upper = (v) => clean(v).toUpperCase();
  const num = (v) => {
    const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const esc = (v) => clean(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const state = {
    rows: [],
    activePane: 'listings',
    listingFilter: 'clean',
    reviewFilter: 'all',
    sort: 'newest',
    search: '',
    lastMeta: null,
    loading: false,
    error: ''
  };

  const REVIEW = {
    all: { label: 'All Review', tone: 'gold', copy: 'All unresolved listing review items.' },
    delete: { label: 'Delete/Sold Review', tone: 'danger', copy: 'Source inventory no longer confirms the vehicle or the row is marked sold/removed.' },
    price: { label: 'Price Update', tone: 'warn', copy: 'Source price, mileage, or pricing truth needs verification.' },
    url: { label: 'Missing Facebook URL', tone: 'warn', copy: 'The source listing exists, but the Marketplace URL has not been captured.' },
    image: { label: 'Missing Image', tone: 'warn', copy: 'The row has no synced listing image or cover photo.' },
    weak: { label: 'Weak Listing', tone: 'warn', copy: 'Listing has weak response relative to traffic.' },
    cleanup: { label: 'Data Cleanup', tone: 'neutral', copy: 'VIN, stock, source URL, or other required data is incomplete.' }
  };

  const CSS = `
    .ea-lc-shell{display:grid;gap:16px}.ea-lc-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.ea-lc-title h2{margin:6px 0 6px;font-size:27px}.ea-lc-title .subtext{max-width:780px}.ea-lc-version{font-size:11px;color:#7d7d7d;margin-top:4px}.ea-lc-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.ea-lc-kpi{background:#151515;border:1px solid rgba(255,255,255,.06);border-radius:15px;padding:13px}.ea-lc-kpi strong{display:block;font-size:24px;line-height:1}.ea-lc-kpi span{display:block;margin-top:7px;color:#a9a9a9;font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}.ea-lc-kpi.gold{border-color:rgba(212,175,55,.34);background:rgba(212,175,55,.07)}.ea-lc-kpi.danger{border-color:rgba(255,120,120,.25);background:rgba(255,90,90,.055)}
    .ea-lc-toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;background:#111;border:1px solid rgba(212,175,55,.12);border-radius:18px;padding:12px}.ea-lc-tabs,.ea-lc-filters{display:flex;gap:8px;flex-wrap:wrap}.ea-lc-tab,.ea-lc-filter{appearance:none;border:1px solid rgba(255,255,255,.08);background:#171717;color:#d8d8d8;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:900;cursor:pointer}.ea-lc-tab.active,.ea-lc-filter.active{background:rgba(212,175,55,.16);border-color:rgba(212,175,55,.38);color:#f3ddb0}.ea-lc-search{display:flex;gap:8px;flex-wrap:wrap}.ea-lc-search input,.ea-lc-search select{background:#101010;border:1px solid rgba(255,255,255,.08);color:#f5f5f5;border-radius:12px;padding:10px 12px;min-height:38px}.ea-lc-search input{min-width:260px}
    .ea-lc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.ea-lc-card{background:linear-gradient(180deg,rgba(255,255,255,.015),rgba(255,255,255,0));border:1px solid rgba(212,175,55,.14);border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.24)}.ea-lc-card.needs-review{border-color:rgba(212,175,55,.25)}.ea-lc-card.danger{border-color:rgba(255,120,120,.22)}.ea-lc-media{height:175px;background:#171717;position:relative;border-bottom:1px solid rgba(255,255,255,.055)}.ea-lc-media img{width:100%;height:100%;object-fit:cover;display:block}.ea-lc-placeholder{height:100%;display:grid;place-items:center;color:#f3ddb0;font-size:13px;font-weight:900;background:linear-gradient(135deg,rgba(212,175,55,.08),rgba(255,255,255,.02));padding:14px;text-align:center}.ea-lc-badge{position:absolute;right:12px;top:12px}.ea-lc-chip{display:inline-flex;align-items:center;min-height:26px;padding:0 9px;border-radius:999px;background:#101010;border:1px solid rgba(255,255,255,.08);color:#d8d8d8;font-size:11px;font-weight:900}.ea-lc-chip.gold,.ea-lc-chip.warn{background:rgba(212,175,55,.11);border-color:rgba(212,175,55,.32);color:#f3ddb0}.ea-lc-chip.danger{background:rgba(255,90,90,.09);border-color:rgba(255,120,120,.22);color:#ffb4b4}.ea-lc-chip.good{background:rgba(80,190,110,.08);border-color:rgba(110,220,130,.2);color:#baf0c2}.ea-lc-chip.muted{color:#999}.ea-lc-body{padding:15px;display:grid;gap:11px}.ea-lc-vehicle{display:grid;gap:4px}.ea-lc-vehicle strong{font-size:17px;line-height:1.25}.ea-lc-sub{color:#a9a9a9;font-size:12px;line-height:1.4}.ea-lc-price{font-size:22px;font-weight:900;color:#f3ddb0}.ea-lc-truth{display:flex;gap:7px;flex-wrap:wrap}.ea-lc-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.ea-lc-metric{background:#171717;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:9px}.ea-lc-metric span{display:block;color:#d4af37;font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}.ea-lc-metric strong{display:block;margin-top:5px;font-size:13px}.ea-lc-actionline{display:flex;gap:8px;flex-wrap:wrap}.ea-lc-actionline .action-btn{min-height:34px;padding:7px 10px;font-size:12px}.ea-lc-section-title{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}.ea-lc-section-title h3{margin:0;font-size:20px}.ea-lc-section-copy{color:#aaa;font-size:13px;line-height:1.45;margin-top:4px}
    .ea-lc-review-table{display:grid;gap:8px}.ea-lc-review-row{display:grid;grid-template-columns:minmax(240px,1.15fr) 155px minmax(280px,1fr) 170px auto;gap:10px;align-items:center;background:#151515;border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:11px}.ea-lc-review-row.critical{border-color:rgba(212,175,55,.36);background:rgba(212,175,55,.055)}.ea-lc-review-row.danger{border-color:rgba(255,120,120,.25);background:rgba(255,90,90,.045)}.ea-lc-review-row strong{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ea-lc-review-row span{font-size:12px;color:#a9a9a9}.ea-lc-reason{font-size:12px;color:#d8d8d8;line-height:1.4}.ea-lc-empty{padding:22px;border-radius:16px;border:1px dashed rgba(212,175,55,.2);background:#111;color:#a9a9a9;text-align:center}.ea-lc-status{color:#a9a9a9;font-size:12px;line-height:1.5}.ea-lc-hidden{display:none!important}.ea-lc-mini-list{display:grid;gap:9px}.ea-lc-mini-item{padding:12px;border-radius:13px;background:#151515;border:1px solid rgba(255,255,255,.06);display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.ea-lc-mini-item strong{display:block;font-size:13px}.ea-lc-mini-item span{display:block;color:#aaa;font-size:12px;margin-top:4px;line-height:1.4}.ea-lc-future-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.ea-lc-future{padding:12px;border-radius:13px;background:#141414;border:1px solid rgba(255,255,255,.06)}.ea-lc-future strong{display:block;font-size:13px}.ea-lc-future span{display:block;font-size:11px;color:#888;margin-top:5px}
    @media(max-width:1280px){.ea-lc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ea-lc-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.ea-lc-review-row{grid-template-columns:1fr}.ea-lc-review-row .ea-lc-actionline{justify-content:flex-start}.ea-lc-future-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:720px){.ea-lc-grid,.ea-lc-kpis,.ea-lc-metrics,.ea-lc-future-grid{grid-template-columns:1fr}.ea-lc-search input{min-width:100%;width:100%}}
  `;

  function injectStyle() {
    let style = document.getElementById('ea-listing-centre-upgrade-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ea-listing-centre-upgrade-style';
      document.head.appendChild(style);
    }
    style.textContent = CSS;
  }

  function marketplaceUrl(item) {
    const direct = clean(item.marketplace_url || item.platform_listing_url || item.posted_url || '');
    if (/^https?:\/\//i.test(direct)) return direct;
    const id = clean(item.marketplace_listing_id || '').replace(/[^0-9]/g, '');
    return id ? `https://www.facebook.com/marketplace/item/${id}` : '';
  }

  function sourceUrl(item) {
    const direct = clean(item.source_url || item.inventory_url || item.vdp_url || item.url || '');
    return /^https?:\/\//i.test(direct) ? direct : '';
  }

  function normalizeVin(value) {
    const vin = upper(value).replace(/^VIN:/i, '');
    return /^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin) ? vin : clean(value || '');
  }

  function keyFor(item) {
    const existing = clean(item.identity_key || item.canonical_key);
    const vin = normalizeVin(item.vin || existing);
    if (vin && /^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin)) return `VIN:${vin}`;
    const stock = upper(item.stock_number || '');
    if (stock) return `STOCK:${stock}`;
    const mp = clean(item.marketplace_listing_id || '').replace(/[^0-9]/g, '');
    if (mp) return `MARKETPLACE:${mp}`;
    const mpUrl = lower(marketplaceUrl(item));
    if (mpUrl) return `MPURL:${mpUrl}`;
    const src = lower(sourceUrl(item));
    if (src) return `SOURCE:${src}`;
    return `ROW:${clean(item.id || item.title || Math.random())}`;
  }

  function status(item) { return lower(item.status); }
  function lifecycle(item) { return lower(item.lifecycle_status); }
  function bucket(item) { return lower(item.review_bucket).replace(/[\s_-]+/g, ''); }
  function sourceConfirmedGone(item) {
    return Boolean(item.source_missing || item.source_removed || item.removed_from_source || item.no_longer_in_inventory || item.likely_sold);
  }
  function isDeleteReview(item) {
    return ['sold', 'deleted', 'inactive', 'failed', 'removed', 'stale', 'unavailable'].includes(status(item)) ||
      lifecycle(item) === 'review_delete' ||
      lifecycle(item) === 'review_sold' ||
      bucket(item) === 'removedvehicles' ||
      bucket(item) === 'soldvehicles' ||
      sourceConfirmedGone(item);
  }
  function isPriceReview(item) { return Boolean(item.price_review_required || item.price_resolved === false || lifecycle(item) === 'review_price_update' || bucket(item) === 'pricechanges' || clean(item.price_warning)); }
  function hasMarketplace(item) { return Boolean(marketplaceUrl(item)); }
  function hasSource(item) { return Boolean(sourceUrl(item)); }
  function hasImage(item) { return Boolean(clean(item.image_url || item.cover_photo_url || item.photo_url)); }
  function hasVin(item) { return Boolean(normalizeVin(item.vin || '')); }
  function hasStock(item) { return Boolean(clean(item.stock_number || item.stock || '')); }
  function isMissingFacebookUrl(item) { return !isDeleteReview(item) && hasSource(item) && !hasMarketplace(item); }
  function isMissingImage(item) { return !isDeleteReview(item) && !hasImage(item); }
  function isWeak(item) { return Boolean(item.weak || item.health_state === 'weak_conversion' || (num(item.views_count) >= 12 && num(item.messages_count) <= 1)); }
  function isCleanup(item) { return !isDeleteReview(item) && (!hasSource(item) || !hasVin(item) || !hasStock(item)); }
  function isCleanActive(item) { return !isDeleteReview(item) && !isPriceReview(item) && !isMissingFacebookUrl(item) && !isMissingImage(item) && !isWeak(item) && !isCleanup(item) && !item.needs_action; }
  function needsAction(item) { return !isCleanActive(item); }
  function reviewCategory(item) {
    if (isDeleteReview(item)) return 'delete';
    if (isPriceReview(item)) return 'price';
    if (isMissingFacebookUrl(item)) return 'url';
    if (isMissingImage(item)) return 'image';
    if (isWeak(item)) return 'weak';
    if (isCleanup(item) || item.needs_action) return 'cleanup';
    return 'none';
  }

  function normalize(item = {}) {
    const priceText = clean(item.display_price_text || item.current_price || item.price || '');
    const mileageText = clean(item.display_mileage_text || item.mileage || item.kilometers || item.odometer || '');
    const title = clean(item.title || `${clean(item.year)} ${clean(item.make)} ${clean(item.model)} ${clean(item.trim)}`.trim()) || 'Untitled listing';
    const next = {
      ...item,
      title,
      vin: normalizeVin(item.vin || ''),
      stock_number: clean(item.stock_number || item.stock || ''),
      marketplace_url: marketplaceUrl(item),
      source_url: sourceUrl(item),
      image_url: clean(item.image_url || item.cover_photo_url || item.photo_url || ''),
      display_price_text: priceText,
      display_mileage_text: mileageText,
      price: item.price ?? priceText,
      mileage: item.mileage ?? mileageText,
      views_count: num(item.views_count || item.views),
      messages_count: num(item.messages_count || item.messages),
      status: clean(item.status || 'active'),
      lifecycle_status: clean(item.lifecycle_status || 'active'),
      review_bucket: clean(item.review_bucket || ''),
      posted_at: item.posted_at || item.created_at || item.updated_at || null,
      updated_at: item.updated_at || item.created_at || item.posted_at || null,
      last_seen_at: item.last_seen_at || item.updated_at || item.created_at || null,
      price_resolved: item.price_resolved !== false && !item.price_review_required,
      price_review_required: Boolean(item.price_review_required || item.price_resolved === false || clean(item.price_warning))
    };
    next.identity_key = keyFor(next);
    next.review_category = reviewCategory(next);
    next.active_like = !isDeleteReview(next);
    next.clean_active = isCleanActive(next);
    return next;
  }

  function rowScore(item) {
    return (hasMarketplace(item) ? 600 : 0) +
      (hasSource(item) ? 160 : 0) +
      (hasImage(item) ? 90 : 0) +
      (item.price_resolved !== false ? 50 : 0) +
      num(item.views_count || item.views) + num(item.messages_count || item.messages) * 15 +
      (new Date(item.updated_at || item.posted_at || item.created_at || 0).getTime() / 100000000000);
  }

  function dedupe(list) {
    const map = new Map();
    for (const raw of list) {
      const item = normalize(raw);
      const key = item.identity_key;
      const current = map.get(key);
      if (!current || rowScore(item) >= rowScore(current)) {
        map.set(key, { ...(current || {}), ...item, duplicate_count: current ? num(current.duplicate_count || 1) + 1 : num(item.duplicate_count || 1) });
      } else {
        current.duplicate_count = num(current.duplicate_count || 1) + 1;
      }
    }
    return [...map.values()].map((item) => ({ ...item, review_category: reviewCategory(item), active_like: !isDeleteReview(item), clean_active: isCleanActive(item) }));
  }

  function fmtPrice(item) {
    if (isPriceReview(item)) return 'Price check';
    const text = clean(item.display_price_text || item.current_price || item.price || '');
    if (/^\$/.test(text)) return text;
    const value = num(text);
    return value > 0 ? `$${value.toLocaleString()}` : 'Price pending';
  }

  function fmtMileage(item) {
    const text = clean(item.display_mileage_text || '');
    if (text && /km|mi/i.test(text)) return text;
    const value = num(text || item.mileage || item.kilometers || item.odometer);
    return value > 0 ? `${value.toLocaleString()} km` : 'Mileage pending';
  }

  function fmtDate(value) {
    const d = value ? new Date(value) : null;
    return d && Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Not recorded';
  }

  function counts() {
    const rows = state.rows;
    const active = rows.filter((x) => x.active_like);
    const review = rows.filter((x) => x.review_category !== 'none');
    return {
      total: rows.length,
      active: active.length,
      clean: rows.filter(isCleanActive).length,
      review: review.length,
      delete: rows.filter((x) => x.review_category === 'delete').length,
      price: rows.filter((x) => x.review_category === 'price').length,
      url: rows.filter((x) => x.review_category === 'url').length,
      image: rows.filter((x) => x.review_category === 'image').length,
      weak: rows.filter((x) => x.review_category === 'weak').length,
      cleanup: rows.filter((x) => x.review_category === 'cleanup').length
    };
  }

  function filteredListings() {
    let out = [...state.rows];
    if (state.listingFilter === 'clean') out = out.filter(isCleanActive);
    if (state.listingFilter === 'all' || state.listingFilter === 'active') out = out.filter((x) => x.active_like);
    if (state.listingFilter === 'review') out = out.filter((x) => x.review_category !== 'none');
    if (state.listingFilter === 'needs_action') out = out.filter(needsAction);
    if (state.listingFilter === 'price') out = out.filter(isPriceReview);
    if (state.listingFilter === 'url') out = out.filter(isMissingFacebookUrl);
    if (state.listingFilter === 'image') out = out.filter(isMissingImage);
    if (state.listingFilter === 'weak') out = out.filter(isWeak);
    if (state.listingFilter === 'delete') out = out.filter(isDeleteReview);
    const q = lower(state.search);
    if (q) out = out.filter((item) => [item.title, item.vin, item.stock_number, item.make, item.model, item.trim].map(lower).join(' ').includes(q));
    if (state.sort === 'popular') out.sort((a,b) => (num(b.messages_count)*1000 + num(b.views_count)) - (num(a.messages_count)*1000 + num(a.views_count)));
    else if (state.sort === 'price_high') out.sort((a,b) => num(b.price) - num(a.price));
    else if (state.sort === 'price_low') out.sort((a,b) => num(a.price) - num(b.price));
    else out.sort((a,b) => new Date(b.updated_at || b.posted_at || 0) - new Date(a.updated_at || a.posted_at || 0));
    return out;
  }

  function filteredReview() {
    let out = state.rows.filter((x) => x.review_category !== 'none');
    if (state.reviewFilter !== 'all') out = out.filter((x) => x.review_category === state.reviewFilter);
    const q = lower(state.search);
    if (q) out = out.filter((item) => [item.title, item.vin, item.stock_number, item.make, item.model, item.trim].map(lower).join(' ').includes(q));
    out.sort((a,b) => {
      const weight = { delete: 7, price: 6, url: 5, image: 4, weak: 3, cleanup: 2, none: 0 };
      return (weight[b.review_category] || 0) - (weight[a.review_category] || 0) || new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    });
    return out;
  }

  async function loadRows() {
    state.loading = true;
    state.error = '';
    renderStatus();
    try {
      if (!NS.api?.apiFetch || !NS.api?.parseJsonSafe) throw new Error('Dashboard API helpers unavailable');
      const response = await NS.api.apiFetch('/api/get-user-listings?limit=300&sort=newest', { method: 'GET' });
      const json = await NS.api.parseJsonSafe(response);
      if (!response.ok) throw new Error(json?.error || response.statusText || 'Listing API failed');
      const raw = Array.isArray(json?.data) ? json.data : [];
      state.rows = dedupe(raw);
      state.lastMeta = json?.meta || null;
      const registry = {};
      state.rows.forEach((item) => { registry[item.identity_key || item.id] = item; });
      NS.state?.set?.('listingRegistry', registry, { silent: true, skipPersist: true });
      NS.state?.setSyncState?.({ source: 'api_get_user_listings_intelligence_2_1', confidence: 'owner_scoped_supabase', remote_listing_count: state.rows.length, raw_listing_count: raw.length, last_ingest_at: new Date().toISOString(), meta: state.lastMeta }, { silent: true, skipPersist: true });
      window.dispatchEvent(new CustomEvent('elevate:tracking-refreshed'));
    } catch (error) {
      state.error = error?.message || String(error);
      const fallback = Object.values(NS.state?.get?.('listingRegistry', {}) || {});
      state.rows = dedupe(fallback);
    } finally {
      state.loading = false;
      renderAll();
    }
  }

  function shellHtml() {
    const c = counts();
    return `<section id="analyticsWorkspace" class="card ea-lc-shell"><div class="ea-lc-head"><div class="ea-lc-title"><div class="module-group-label">Intelligence Centre</div><h2>Intelligence Centre</h2><div id="eaLcStatus" class="subtext">Listings, leads, reviews, and performance signals are consolidated into one operating area. Current lane: listing portfolio and listing review.</div><div class="ea-lc-version">${VERSION}</div></div><button id="eaLcRefresh" class="action-btn" type="button">Refresh Intelligence</button></div><div class="ea-lc-kpis"><div class="ea-lc-kpi gold"><strong>${c.active}</strong><span>Active Listings</span></div><div class="ea-lc-kpi gold"><strong>${c.clean}</strong><span>Clean Active</span></div><div class="ea-lc-kpi gold"><strong>${c.review}</strong><span>Review Queue</span></div><div class="ea-lc-kpi danger"><strong>${c.delete}</strong><span>Delete/Sold</span></div><div class="ea-lc-kpi"><strong>${c.url}</strong><span>Missing FB URL</span></div><div class="ea-lc-kpi"><strong>${c.total}</strong><span>Total Loaded</span></div></div><div class="ea-lc-toolbar"><div class="ea-lc-tabs" id="eaLcTabs"><button class="ea-lc-tab ${state.activePane === 'performance' ? 'active' : ''}" data-pane="performance" type="button">Performance</button><button class="ea-lc-tab ${state.activePane === 'listings' ? 'active' : ''}" data-pane="listings" type="button">Listings</button><button class="ea-lc-tab ${state.activePane === 'review' ? 'active' : ''}" data-pane="review" type="button">Review</button></div><div class="ea-lc-search"><select id="eaLcSort"><option value="newest" ${state.sort === 'newest' ? 'selected' : ''}>Sort: Newest</option><option value="popular" ${state.sort === 'popular' ? 'selected' : ''}>Sort: Most Popular</option><option value="price_high" ${state.sort === 'price_high' ? 'selected' : ''}>Price High → Low</option><option value="price_low" ${state.sort === 'price_low' ? 'selected' : ''}>Price Low → High</option></select><input id="eaLcSearch" value="${esc(state.search)}" placeholder="Search make, model, VIN, stock..." /></div></div><div id="eaLcPanePerformance" class="${state.activePane === 'performance' ? '' : 'ea-lc-hidden'}">${performanceHtml()}</div><div id="eaLcPaneListings" class="${state.activePane === 'listings' ? '' : 'ea-lc-hidden'}">${listingsHtml()}</div><div id="eaLcPaneReview" class="${state.activePane === 'review' ? '' : 'ea-lc-hidden'}">${reviewHtml()}</div></section>`;
  }

  function performanceHtml() {
    const c = counts();
    const views = state.rows.reduce((sum, x) => sum + num(x.views_count), 0);
    const messages = state.rows.reduce((sum, x) => sum + num(x.messages_count), 0);
    const source = state.lastMeta?.auth_mode || 'owner_scoped';
    const future = [['Lead Review','Coming later'],['Follow-Up Review','Coming later'],['Compliance Review','Coming later'],['Automation Review','Coming later']];
    return `<div class="ea-lc-grid"><div class="ea-lc-card"><div class="ea-lc-body"><div class="ea-lc-vehicle"><strong>Performance Intelligence</strong><div class="ea-lc-sub">Calculated from the authenticated operator's Supabase listing rows only.</div></div><div class="ea-lc-metrics"><div class="ea-lc-metric"><span>Views</span><strong>${views}</strong></div><div class="ea-lc-metric"><span>Messages</span><strong>${messages}</strong></div><div class="ea-lc-metric"><span>Conversion</span><strong>${views ? ((messages / views) * 100).toFixed(1) : '0.0'}%</strong></div></div></div></div><div class="ea-lc-card"><div class="ea-lc-body"><div class="ea-lc-vehicle"><strong>Owner Scope</strong><div class="ea-lc-sub">Damians see Damians. Kyles see Kyles. Jakes see Jakes. The API is bearer-authenticated and filtered by verified user_id/email.</div></div><div class="ea-lc-truth"><span class="ea-lc-chip gold">${esc(source)}</span><span class="ea-lc-chip">${state.lastMeta?.sources?.user_listings ?? 0} user_listings</span><span class="ea-lc-chip">${state.lastMeta?.sources?.listings ?? 0} legacy listings</span></div></div></div><div class="ea-lc-card"><div class="ea-lc-body"><div class="ea-lc-vehicle"><strong>Review Pressure</strong><div class="ea-lc-sub">Delete/sold and price rows are true operator action. Missing Facebook URL is now classified separately as data capture.</div></div><div class="ea-lc-truth"><span class="ea-lc-chip danger">${c.delete} delete/sold</span><span class="ea-lc-chip warn">${c.price} price</span><span class="ea-lc-chip warn">${c.url} missing URL</span><span class="ea-lc-chip">${c.cleanup} cleanup</span></div></div></div></div><div class="ea-lc-future-grid">${future.map(([a,b]) => `<div class="ea-lc-future"><strong>${a}</strong><span>${b}</span></div>`).join('')}</div>`;
  }

  function listingFilters() {
    const c = counts();
    const opts = [['clean',`Clean Active · ${c.clean}`],['active',`All Active · ${c.active}`],['needs_action',`Needs Action · ${c.review}`],['url',`Missing Facebook URL · ${c.url}`],['image',`Missing Image · ${c.image}`],['price',`Price Watch · ${c.price}`],['weak',`Weak · ${c.weak}`],['delete',`Sold/Delete · ${c.delete}`]];
    return `<div class="ea-lc-filters">${opts.map(([k,label]) => `<button class="ea-lc-filter ${state.listingFilter === k ? 'active' : ''}" type="button" data-listing-filter="${k}">${label}</button>`).join('')}</div>`;
  }

  function reviewFilters() {
    const c = counts();
    const opts = [['all',`All · ${c.review}`],['delete',`Delete/Sold · ${c.delete}`],['price',`Price · ${c.price}`],['url',`Missing FB URL · ${c.url}`],['image',`Missing Image · ${c.image}`],['weak',`Weak · ${c.weak}`],['cleanup',`Cleanup · ${c.cleanup}`]];
    return `<div class="ea-lc-filters">${opts.map(([k,label]) => `<button class="ea-lc-filter ${state.reviewFilter === k ? 'active' : ''}" type="button" data-review-filter="${k}">${label}</button>`).join('')}</div>`;
  }

  function listingsHtml() {
    const list = filteredListings();
    return `<div class="ea-lc-shell"><div class="ea-lc-section-title"><div><h3>Listing Portfolio</h3><div class="ea-lc-section-copy">Active listing cards, health chips, and source/Facebook actions. Default view is clean active inventory.</div></div></div>${listingFilters()}<div class="ea-lc-status">${list.length} listing card${list.length === 1 ? '' : 's'} shown. Missing Facebook URL is data capture, not delete/sold review.</div>${list.length ? `<div class="ea-lc-grid">${list.slice(0,90).map(cardHtml).join('')}</div>` : '<div class="ea-lc-empty">No portfolio rows are available for this filter.</div>'}</div>`;
  }

  function reviewHtml() {
    const list = filteredReview();
    return `<div class="ea-lc-shell"><div class="ea-lc-section-title"><div><h3>Review Queue</h3><div class="ea-lc-section-copy">Listing Review is live now. Lead, follow-up, compliance, and automation reviews can be layered into this same centre later.</div></div></div>${reviewFilters()}<div class="ea-lc-status">${list.length} review item${list.length === 1 ? '' : 's'} shown. Delete/sold review requires source removal, sold status, lifecycle delete, or explicit stale/unavailable signal.</div>${list.length ? `<div class="ea-lc-review-table">${list.slice(0,120).map(reviewRowHtml).join('')}</div>` : '<div class="ea-lc-empty">No review items for this queue.</div>'}</div>`;
  }

  function badgeHtml(item) {
    const cat = item.review_category;
    if (cat === 'delete') return '<span class="ea-lc-chip danger">Delete/Sold Review</span>';
    if (cat === 'price') return '<span class="ea-lc-chip warn">Price Update</span>';
    if (cat === 'url') return '<span class="ea-lc-chip warn">Missing Facebook URL</span>';
    if (cat === 'image') return '<span class="ea-lc-chip warn">Missing Image</span>';
    if (cat === 'weak') return '<span class="ea-lc-chip warn">Weak Listing</span>';
    if (cat === 'cleanup') return '<span class="ea-lc-chip">Data Cleanup</span>';
    return '<span class="ea-lc-chip good">Active</span>';
  }

  function statusChips(item) {
    const chips = [];
    chips.push(item.active_like ? '<span class="ea-lc-chip good">Active</span>' : '<span class="ea-lc-chip danger">Inactive</span>');
    chips.push(hasSource(item) ? '<span class="ea-lc-chip good">Source Synced</span>' : '<span class="ea-lc-chip warn">Source Missing</span>');
    chips.push(hasMarketplace(item) ? '<span class="ea-lc-chip good">Facebook URL</span>' : '<span class="ea-lc-chip warn">Facebook URL Missing</span>');
    chips.push(hasImage(item) ? '<span class="ea-lc-chip good">Image Synced</span>' : '<span class="ea-lc-chip warn">Image Missing</span>');
    if (isPriceReview(item)) chips.push('<span class="ea-lc-chip warn">Price Check</span>');
    if (isWeak(item)) chips.push('<span class="ea-lc-chip warn">Weak</span>');
    return chips.join('');
  }

  function cardHtml(item) {
    const mp = marketplaceUrl(item);
    const src = sourceUrl(item);
    const tone = item.review_category === 'delete' ? 'danger' : item.review_category !== 'none' ? 'needs-review' : '';
    return `<article class="ea-lc-card ${tone}"><div class="ea-lc-media">${item.image_url ? `<img src="${esc(item.image_url)}" alt="${esc(item.title)}" />` : '<div class="ea-lc-placeholder">Image not synced</div>'}<div class="ea-lc-badge">${badgeHtml(item)}</div></div><div class="ea-lc-body"><div class="ea-lc-vehicle"><strong>${esc(item.title)}</strong><div class="ea-lc-sub">${esc(item.stock_number || 'No stock')}${item.vin ? ` · ${esc(item.vin)}` : ''}</div></div><div class="ea-lc-price">${esc(fmtPrice(item))}</div><div class="ea-lc-truth"><span class="ea-lc-chip">${esc(fmtMileage(item))}</span><span class="ea-lc-chip">Posted ${esc(fmtDate(item.posted_at))}</span>${num(item.duplicate_count) > 1 ? `<span class="ea-lc-chip warn">Merged ${num(item.duplicate_count)}</span>` : ''}</div><div class="ea-lc-truth">${statusChips(item)}</div><div class="ea-lc-metrics"><div class="ea-lc-metric"><span>Views</span><strong>${num(item.views_count)}</strong></div><div class="ea-lc-metric"><span>Messages</span><strong>${num(item.messages_count)}</strong></div><div class="ea-lc-metric"><span>Status</span><strong>${esc(item.lifecycle_status || item.status || 'active')}</strong></div></div><div class="ea-lc-actionline">${mp ? `<button class="action-btn" data-open-url="${esc(mp)}" type="button">Open Facebook</button>` : ''}${src ? `<button class="action-btn" data-open-url="${esc(src)}" type="button">Open Source</button>` : ''}<button class="action-btn" data-copy-text="${esc(summaryText(item))}" type="button">Copy Summary</button></div></div></article>`;
  }

  function reviewReason(item) {
    if (item.review_category === 'delete') return marketplaceUrl(item) ? 'Source inventory no longer confirms this vehicle. Open Marketplace and delete the listing if the unit is sold or unavailable.' : 'Source inventory no longer confirms this vehicle. Facebook URL is missing, so verify from source before manual Marketplace cleanup.';
    if (item.review_category === 'price') return 'Source price changed or could not be verified. Open Facebook listing and update pricing if the listing is still active.';
    if (item.review_category === 'url') return 'Facebook listing URL not captured. Confirm whether the unit is live on Marketplace, then sync or capture the listing URL.';
    if (item.review_category === 'image') return 'Listing image is not synced. Re-scan source media or capture a cover photo before relying on the card.';
    if (item.review_category === 'weak') return 'Listing is getting traffic but weak buyer response. Refresh title, first photo, CTA, or pricing angle.';
    return 'Required listing data is incomplete. Capture missing source URL, VIN, stock, or other required fields.';
  }

  function reviewRowHtml(item) {
    const mp = marketplaceUrl(item);
    const src = sourceUrl(item);
    const cat = item.review_category;
    const tone = cat === 'delete' ? 'danger' : (cat === 'price' || cat === 'url' ? 'critical' : '');
    return `<article class="ea-lc-review-row ${tone}"><div><strong>${esc(item.title)}</strong><span>${esc(item.stock_number || 'No stock')}${item.vin ? ` · ${esc(item.vin)}` : ''}</span></div><div>${badgeHtml(item)}</div><div class="ea-lc-reason">${esc(reviewReason(item))}<br>${esc(fmtPrice(item))} · ${esc(fmtMileage(item))}</div><div><span>Posted ${esc(fmtDate(item.posted_at))}<br>Seen ${esc(fmtDate(item.last_seen_at))}</span></div><div class="ea-lc-actionline">${mp ? `<button class="action-btn" data-open-url="${esc(mp)}" type="button">Facebook Listing</button>` : ''}${src ? `<button class="action-btn" data-open-url="${esc(src)}" type="button">Source</button>` : ''}${item.vin ? `<button class="action-btn" data-copy-text="${esc(item.vin)}" type="button">VIN</button>` : ''}<button class="action-btn" data-copy-text="${esc(summaryText(item))}" type="button">Summary</button></div></article>`;
  }

  function summaryText(item) {
    return `${item.title}\nStock: ${item.stock_number || 'N/A'}\nVIN: ${item.vin || 'N/A'}\nPrice: ${fmtPrice(item)}\nMileage: ${fmtMileage(item)}\nReview Category: ${REVIEW[item.review_category]?.label || 'Active'}\nAction: ${reviewReason(item)}\nFacebook: ${marketplaceUrl(item) || 'Not captured'}\nSource: ${sourceUrl(item) || 'Not captured'}`;
  }

  function mountRoot() {
    const section = document.getElementById('analytics') || document.getElementById('tools');
    if (!section) return null;
    let root = document.getElementById('eaRootG');
    if (!root) {
      root = document.createElement('div');
      root.id = 'eaRootG';
      section.prepend(root);
    }
    return root;
  }

  function renderStatus() {
    const el = document.getElementById('eaLcStatus');
    if (!el) return;
    if (state.loading) el.textContent = 'Loading owner-scoped intelligence from Supabase...';
    else if (state.error) el.textContent = `Intelligence Centre warning: ${state.error}`;
    else el.textContent = `Owner-scoped Intelligence Centre loaded. ${state.rows.length} listing row${state.rows.length === 1 ? '' : 's'} available. Future lanes: leads, follow-up, compliance, and automation review.`;
  }

  function renderAll() {
    injectStyle();
    const root = mountRoot();
    if (!root) return;
    root.innerHTML = shellHtml();
    bindControls(root);
    renderStatus();
  }

  function bindControls(root) {
    root.querySelector('#eaLcRefresh')?.addEventListener('click', loadRows);
    root.querySelectorAll('[data-pane]').forEach((btn) => btn.addEventListener('click', () => { state.activePane = btn.getAttribute('data-pane') || 'listings'; renderAll(); }));
    root.querySelectorAll('[data-listing-filter]').forEach((btn) => btn.addEventListener('click', () => { state.listingFilter = btn.getAttribute('data-listing-filter') || 'clean'; renderAll(); }));
    root.querySelectorAll('[data-review-filter]').forEach((btn) => btn.addEventListener('click', () => { state.reviewFilter = btn.getAttribute('data-review-filter') || 'all'; renderAll(); }));
    root.querySelector('#eaLcSort')?.addEventListener('change', (event) => { state.sort = event.target.value || 'newest'; renderAll(); });
    root.querySelector('#eaLcSearch')?.addEventListener('input', (event) => { state.search = event.target.value || ''; renderAll(); });
    root.querySelectorAll('[data-open-url]').forEach((btn) => btn.addEventListener('click', () => window.open(btn.getAttribute('data-open-url'), '_blank', 'noopener,noreferrer')));
    root.querySelectorAll('[data-copy-text]').forEach((btn) => btn.addEventListener('click', async () => { const original = btn.textContent; try { await navigator.clipboard.writeText(btn.getAttribute('data-copy-text') || ''); btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = original; }, 1000); } catch {} }));
  }

  function boot() {
    injectStyle();
    renderAll();
    loadRows();
    setTimeout(() => { if (!state.rows.length) loadRows(); }, 2200);
  }

  NS.listingCentre = { loadRows, renderAll, getRows: () => [...state.rows], version: VERSION };
  NS.modules.listingCentreUpgrade = true;
  NS.modules.listingCentreUpgradeV21 = true;

  window.addEventListener('elevate:analytics-workspace-mounted', () => setTimeout(boot, 80));
  window.addEventListener('elevate:remote-sync', loadRows);
  window.addEventListener('elevate:sync-refreshed', loadRows);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else setTimeout(boot, 80);
})();
