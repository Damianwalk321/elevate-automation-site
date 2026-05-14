(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  NS.modules = NS.modules || {};

  const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
  const lower = (v) => clean(v).toLowerCase();
  const upper = (v) => clean(v).toUpperCase();
  const number = (v) => {
    const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const listingUi = { filter: 'all', search: '', sort: 'popular' };
  const reviewUi = { filter: 'all' };
  let rows = [];

  const REVIEW = {
    all: ['All Review', 'All unresolved operator checks.'],
    delete_check: ['Delete Check', 'Posted vehicles no longer confirmed in source inventory.'],
    price_check: ['Price Check', 'Price or mileage truth needs validation.'],
    data_cleanup: ['Data Cleanup', 'Marketplace URL, source, image, VIN, or stock is incomplete.'],
    weak_listing: ['Weak Listings', 'Low-pressure listings that may need creative, CTA, or price optimization.']
  };

  const STYLE = `
    .listing-card.truth-warning{border-color:rgba(212,175,55,.34)}
    .listing-placeholder{height:100%;min-height:160px;display:grid;place-items:center;text-align:center;color:#f3ddb0;background:linear-gradient(135deg,rgba(212,175,55,.08),rgba(255,255,255,.02));font-size:13px;font-weight:800;letter-spacing:.3px;padding:14px}
    .listing-truth-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.listing-truth-chip{display:inline-flex;align-items:center;min-height:28px;padding:0 9px;border-radius:999px;background:#171717;border:1px solid rgba(255,255,255,.07);font-size:12px;color:#d8d8d8}.listing-truth-chip.warn{color:#f3ddb0;border-color:rgba(212,175,55,.25);background:rgba(212,175,55,.08)}
    .listing-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.listing-card-actions .action-btn{min-height:34px;padding:7px 10px;font-size:12px}
    .review-command-shell{display:grid;gap:14px}.review-command-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;padding:14px 16px;border-radius:18px;background:#121212;border:1px solid rgba(212,175,55,.14)}.review-command-head h3{margin:0;font-size:22px;line-height:1.08}.review-command-head p{margin:6px 0 0;color:#a9a9a9;font-size:13px;line-height:1.45}.review-score{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;min-width:min(540px,100%)}.review-score-card{padding:11px;border-radius:13px;background:#171717;border:1px solid rgba(255,255,255,.06)}.review-score-card strong{display:block;font-size:21px;line-height:1}.review-score-card span{display:block;margin-top:6px;font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#aaa;font-weight:900}.review-score-card.critical{background:rgba(212,175,55,.08);border-color:rgba(212,175,55,.34)}
    .review-filter-bar{display:flex;gap:8px;flex-wrap:wrap}.review-filter-bar button{appearance:none;border:1px solid rgba(255,255,255,.08);background:#171717;color:#d8d8d8;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:900;cursor:pointer}.review-filter-bar button.active{background:rgba(212,175,55,.15);border-color:rgba(212,175,55,.35);color:#f3ddb0}
    .review-command-table{display:grid;gap:7px}.review-row{display:grid;grid-template-columns:12px minmax(220px,1.2fr) 132px minmax(240px,1.1fr) 170px auto;gap:10px;align-items:center;padding:10px 12px;border:1px solid rgba(255,255,255,.055);border-radius:13px;background:#151515}.review-row.critical{border-color:rgba(212,175,55,.34);background:rgba(212,175,55,.055)}.review-dot{width:9px;height:9px;border-radius:999px;background:#777}.review-row.critical .review-dot{background:#d4af37}.review-vehicle{min-width:0}.review-vehicle strong{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.review-vehicle span,.review-evidence,.review-reason{display:block;color:#a9a9a9;font-size:12px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.review-category{display:inline-flex;align-items:center;justify-content:center;min-height:26px;padding:0 9px;border-radius:999px;background:#101010;border:1px solid rgba(255,255,255,.07);color:#f3ddb0;font-size:11px;font-weight:900}.review-category.blocked{color:#ffdc9f;border-color:rgba(255,190,90,.25);background:rgba(255,190,90,.075)}.review-actions{display:flex;gap:7px;justify-content:flex-end;align-items:center;flex-wrap:wrap}.review-actions .action-btn{min-height:31px;padding:6px 9px;font-size:12px}.review-blocker{display:inline-flex;align-items:center;min-height:31px;padding:0 9px;border-radius:999px;background:#101010;border:1px solid rgba(255,255,255,.07);color:#a9a9a9;font-size:11px;font-weight:800}.review-empty{padding:16px;border-radius:14px;background:#151515;border:1px solid rgba(255,255,255,.05);color:#a9a9a9}.review-secondary-note{font-size:12px;color:#8d8d8d;line-height:1.45}.review-dedupe-note{color:#f3ddb0}
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

  function normalizeVin(value) {
    const vin = upper(value).replace(/^VIN:/i, '');
    return /^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin) ? vin : '';
  }

  function marketplaceUrl(item) {
    const direct = clean(item.marketplace_url || item.posted_url || item.platform_listing_url);
    if (/^https?:\/\//i.test(direct)) return direct;
    const id = clean(item.marketplace_listing_id).replace(/[^0-9]/g, '');
    return id ? `https://www.facebook.com/marketplace/item/${id}` : '';
  }

  function canonicalKey(item) {
    const existing = clean(item.identity_key || item.canonical_key);
    const vin = normalizeVin(item.vin || item.id || existing);
    if (vin) return `VIN:${vin}`;
    const stock = upper(item.stock_number);
    if (stock) return `STOCK:${stock}`;
    const mpId = clean(item.marketplace_listing_id).replace(/[^0-9]/g, '');
    if (mpId) return `MARKETPLACE:${mpId}`;
    const mpUrl = lower(marketplaceUrl(item));
    if (mpUrl) return `MPURL:${mpUrl}`;
    const source = lower(item.source_url);
    if (source) return `URL:${source}`;
    const titleKey = [item.title, item.price || item.display_price_text, item.mileage || item.display_mileage_text].map(clean).filter(Boolean).join('|').toLowerCase();
    return titleKey ? `TITLE:${titleKey}` : `ID:${clean(item.id || item.title || Math.random())}`;
  }

  function rowScore(item) {
    return (marketplaceUrl(item) ? 500 : 0) +
      (clean(item.marketplace_listing_id) ? 300 : 0) +
      (clean(item.image_url) ? 90 : 0) +
      (clean(item.source_url) ? 80 : 0) +
      (item.price_resolved !== false && clean(item.display_price_text || item.price) ? 50 : 0) +
      (clean(item.stock_number) ? 30 : 0) +
      (new Date(item.updated_at || item.posted_at || item.created_at || 0).getTime() / 100000000000);
  }

  function dedupeListings(list) {
    const map = new Map();
    for (const item of list) {
      const key = canonicalKey(item);
      const current = map.get(key);
      if (!current || rowScore(item) >= rowScore(current)) {
        map.set(key, { ...(current || {}), ...item, id: key, identity_key: key, duplicate_count: current ? (number(current.duplicate_count) + 1) : number(item.duplicate_count || 1) });
      } else {
        current.duplicate_count = number(current.duplicate_count || 1) + 1;
      }
    }
    return [...map.values()];
  }

  function formatPrice(item) {
    const text = clean(item.display_price_text || item.current_price || item.price);
    if (item.price_review_required || item.price_resolved === false || /needs review|pending/i.test(text)) return 'Price check';
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

  function status(item) { return lower(item.status); }
  function lifecycle(item) { return lower(item.lifecycle_status); }
  function bucket(item) { return lower(item.review_bucket); }

  function isDeleteCheck(item) {
    return ['sold', 'deleted', 'inactive', 'failed', 'removed'].includes(status(item)) || lifecycle(item) === 'review_delete' || bucket(item) === 'removedvehicles' || item.likely_sold;
  }

  function isPriceCheck(item) {
    return !!item.price_review_required || item.price_resolved === false || lifecycle(item) === 'review_price_update' || bucket(item) === 'pricechanges' || !!clean(item.price_warning);
  }

  function isDataCleanup(item) {
    return !marketplaceUrl(item) || !clean(item.source_url) || !normalizeVin(item.vin || item.id) || !clean(item.stock_number) || !!item.missing_image || !clean(item.image_url);
  }

  function isWeakListing(item) {
    return !!item.weak || lower(item.health_state) === 'weak_conversion' || (number(item.views_count || item.views) >= 12 && number(item.messages_count || item.messages) <= 1);
  }

  function primaryCategory(item) {
    if (isDeleteCheck(item)) return 'delete_check';
    if (isPriceCheck(item)) return 'price_check';
    if (isWeakListing(item)) return 'weak_listing';
    if (isDataCleanup(item)) return 'data_cleanup';
    if (item.needs_action) return 'data_cleanup';
    return 'none';
  }

  function normalize(item = {}) {
    const mpUrl = marketplaceUrl(item);
    const vin = normalizeVin(item.vin || item.id);
    const next = {
      ...item,
      id: clean(item.identity_key || item.id || item.marketplace_listing_id || item.vin || item.stock_number || item.title),
      title: clean(item.title || `${clean(item.year)} ${clean(item.make)} ${clean(item.model)}`),
      vin: vin || clean(item.vin || ''),
      price: item.display_price_text || item.current_price || item.price || '',
      current_price: item.display_price_text || item.current_price || item.price || '',
      views_count: number(item.views_count || item.views),
      messages_count: number(item.messages_count || item.messages),
      marketplace_url: mpUrl,
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
    next.identity_key = canonicalKey(next);
    next.primary_review_category = primaryCategory(next);
    return next;
  }

  function isActive(item) { return !isDeleteCheck(item); }
  function reviewRows() { return rows.filter((item) => primaryCategory(item) !== 'none'); }
  function activeRows() { return rows.filter(isActive); }

  async function loadRows() {
    if (!NS.api?.apiFetch || !NS.api?.parseJsonSafe) return false;
    try {
      const res = await NS.api.apiFetch('/api/get-user-listings?limit=300&sort=newest', { method: 'GET' });
      const json = await NS.api.parseJsonSafe(res);
      if (!res.ok) throw new Error(json?.error || res.statusText);
      const raw = Array.isArray(json?.data) ? json.data : [];
      rows = dedupeListings(raw.map(normalize)).map((item) => ({ ...item, primary_review_category: primaryCategory(item) }));
      const registry = {};
      rows.forEach((item) => { registry[item.identity_key || item.id] = item; });
      NS.state?.set?.('listingRegistry', registry, { silent: true, skipPersist: true });
      NS.state?.setSyncState?.({ source: 'api_get_user_listings', confidence: 'synced', remote_listing_count: rows.length, raw_listing_count: raw.length, last_ingest_at: new Date().toISOString() }, { silent: true, skipPersist: true });
      NS.state?.persist?.();
      return true;
    } catch (error) {
      console.warn('[dashboard-listings-v23] load failed:', error);
      rows = dedupeListings(Object.values(NS.state?.get?.('listingRegistry', {}) || {}).map(normalize));
      return false;
    }
  }

  function applyListingFilter() {
    let out = activeRows();
    if (listingUi.filter === 'review') out = reviewRows();
    if (listingUi.filter === 'weak') out = activeRows().filter(isWeakListing);
    if (listingUi.filter === 'needs_action') out = activeRows().filter((item) => item.needs_action || isPriceCheck(item));
    if (listingUi.filter === 'likely_sold') out = reviewRows().filter((item) => primaryCategory(item) === 'delete_check');
    const search = lower(listingUi.search);
    if (search) out = out.filter((item) => [item.title, item.vin, item.stock_number, item.make, item.model].map((v) => lower(v)).join(' ').includes(search));
    if (listingUi.sort === 'newest') out.sort((a, b) => new Date(b.updated_at || b.posted_at || 0) - new Date(a.updated_at || a.posted_at || 0));
    else if (listingUi.sort === 'price_high') out.sort((a, b) => number(b.price) - number(a.price));
    else if (listingUi.sort === 'price_low') out.sort((a, b) => number(a.price) - number(b.price));
    else out.sort((a, b) => (number(b.messages_count) * 1000 + number(b.views_count)) - (number(a.messages_count) * 1000 + number(a.views_count)));
    return out;
  }

  function badge(item) {
    const cat = primaryCategory(item);
    if (cat === 'delete_check') return '<span class="badge sold">Delete Check</span>';
    if (cat === 'price_check') return '<span class="badge warn">Price Check</span>';
    if (cat === 'data_cleanup') return '<span class="badge warn">Data Cleanup</span>';
    return '<span class="badge active">Active</span>';
  }

  function listingCard(item) {
    const source = clean(item.source_url);
    const marketplace = marketplaceUrl(item);
    return `<article class="listing-card" data-hydrated="true"><div class="listing-media">${item.image_url ? `<img src="${item.image_url}" alt="${clean(item.title)}" />` : '<div class="listing-placeholder">Image not synced</div>'}<div class="listing-badge">${badge(item)}</div></div><div class="listing-content"><div><div class="listing-title">${clean(item.title || 'Untitled Listing')}</div><div class="listing-sub">${clean(item.stock_number || '')}${item.vin ? ` • ${clean(item.vin)}` : ''}</div></div><div class="listing-price">${formatPrice(item)}</div><div class="listing-truth-row"><span class="listing-truth-chip">${formatMileage(item)}</span><span class="listing-truth-chip">Posted ${dateShort(item.posted_at)}</span><span class="listing-truth-chip">Seen ${dateShort(item.last_seen_at)}</span>${number(item.duplicate_count) > 1 ? `<span class="listing-truth-chip warn">Merged ${number(item.duplicate_count)} rows</span>` : ''}</div><div class="listing-metrics"><div class="metric-pill"><div class="metric-pill-label">Views</div><div class="metric-pill-value">${number(item.views_count)}</div></div><div class="metric-pill"><div class="metric-pill-label">Messages</div><div class="metric-pill-value">${number(item.messages_count)}</div></div><div class="metric-pill"><div class="metric-pill-label">Status</div><div class="metric-pill-value">${clean(item.lifecycle_status || item.status || 'tracked')}</div></div></div><div class="listing-card-actions">${marketplace ? `<button class="action-btn" type="button" data-open-url="${marketplace}">Open Marketplace</button>` : ''}${source ? `<button class="action-btn" type="button" data-open-url="${source}">Open Source</button>` : ''}</div></div></article>`;
  }

  function categoryReason(item) {
    const cat = primaryCategory(item);
    if (cat === 'delete_check') return marketplaceUrl(item) ? 'Open Facebook listing and delete if sold/removed' : 'Facebook link missing; verify from source first';
    if (cat === 'price_check') return 'Verify price';
    if (cat === 'weak_listing') return 'Review conversion';
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
    const marketplace = marketplaceUrl(item);
    const critical = cat === 'delete_check';
    const duplicateLabel = number(item.duplicate_count) > 1 ? ` · merged ${number(item.duplicate_count)}` : '';
    return `<article class="review-row ${critical ? 'critical' : ''}"><div class="review-dot"></div><div class="review-vehicle"><strong>${clean(item.title || 'Listing')}</strong><span>${clean(item.stock_number || 'No stock')}${item.vin ? ` · ${clean(item.vin)}` : ''}${duplicateLabel}</span></div><div><span class="review-category ${critical && !marketplace ? 'blocked' : ''}">${label}</span></div><div class="review-reason">${categoryReason(item)} · ${formatPrice(item)} · ${formatMileage(item)}</div><div class="review-evidence">${evidence(item)}</div><div class="review-actions">${marketplace ? `<button class="action-btn" type="button" data-open-url="${marketplace}">Facebook Listing</button>` : (critical ? '<span class="review-blocker">Facebook link missing</span>' : '')}${source ? `<button class="action-btn" type="button" data-open-url="${source}">Source</button>` : ''}${item.vin ? `<button class="action-btn" type="button" data-copy-text="${clean(item.vin)}">VIN</button>` : ''}</div></article>`;
  }

  function counts() {
    const r = reviewRows();
    return {
      all: r.length,
      delete_check: r.filter((x) => primaryCategory(x) === 'delete_check').length,
      price_check: r.filter((x) => primaryCategory(x) === 'price_check').length,
      data_cleanup: r.filter((x) => primaryCategory(x) === 'data_cleanup').length,
      weak_listing: r.filter((x) => primaryCategory(x) === 'weak_listing').length
    };
  }

  function filters(c) {
    return ['all', 'delete_check', 'price_check', 'data_cleanup', 'weak_listing'].map((key) => `<button type="button" class="${reviewUi.filter === key ? 'active' : ''}" data-review-filter="${key}">${REVIEW[key][0]} · ${c[key] || 0}</button>`).join('');
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
    const critical = all.filter((x) => primaryCategory(x) === 'delete_check');
    const secondary = all.filter((x) => primaryCategory(x) !== 'delete_check');
    const visible = reviewUi.filter === 'all' ? [...critical, ...secondary] : all.filter((x) => primaryCategory(x) === reviewUi.filter);
    const mergedCount = rows.reduce((sum, item) => sum + Math.max(0, number(item.duplicate_count || 1) - 1), 0);
    mount.innerHTML = `<div class="review-command-shell"><div class="review-command-head"><div><h3>Operator Review Queue</h3><p>Delete checks are vehicles that may need Marketplace cleanup. Facebook link capture is required for one-click deletion workflow.</p></div><div class="review-score"><div class="review-score-card critical"><strong>${c.delete_check}</strong><span>Delete Check</span></div><div class="review-score-card"><strong>${c.price_check}</strong><span>Price</span></div><div class="review-score-card"><strong>${c.data_cleanup}</strong><span>Cleanup</span></div><div class="review-score-card"><strong>${c.weak_listing}</strong><span>Weak</span></div></div></div><div class="review-filter-bar">${filters(c)}</div><div class="review-secondary-note">Showing ${visible.length} of ${all.length} review items.${mergedCount ? ` <span class="review-dedupe-note">Merged ${mergedCount} duplicate row${mergedCount === 1 ? '' : 's'} by VIN/stock.</span>` : ''} Delete Check needs Facebook listing URLs; Source is fallback until post capture is wired.</div><div class="review-command-table">${visible.length ? visible.slice(0, 100).map(row).join('') : '<div class="review-empty">No items in this queue.</div>'}</div></div>`;
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