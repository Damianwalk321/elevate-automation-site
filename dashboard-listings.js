(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.listings) return;

  const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();
  const num = (v) => { const n = Number(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const listingUi = { filter: "all", search: "", sort: "popular" };

  const CSS = `
    .listing-card.truth-warning{border-color:rgba(212,175,55,.34)}
    .listing-placeholder{height:100%;min-height:160px;display:grid;place-items:center;text-align:center;color:#f3ddb0;background:linear-gradient(135deg,rgba(212,175,55,.08),rgba(255,255,255,.02));font-size:13px;font-weight:800;letter-spacing:.3px;padding:14px}
    .listing-truth-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.listing-truth-chip{display:inline-flex;align-items:center;min-height:28px;padding:0 9px;border-radius:999px;background:#171717;border:1px solid rgba(255,255,255,.07);font-size:12px;color:#d8d8d8}.listing-truth-chip.warn{color:#f3ddb0;border-color:rgba(212,175,55,.25);background:rgba(212,175,55,.08)}
    .listing-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.listing-card-actions .action-btn{min-height:34px;padding:7px 10px;font-size:12px}
    .review-command-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:16px}.review-command-card{background:#151515;border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:14px}.review-command-card strong{display:block;font-size:24px;line-height:1.1}.review-command-card span{display:block;color:#a9a9a9;font-size:12px;margin-top:7px;line-height:1.35}.review-command-card.critical{border-color:rgba(212,175,55,.36);background:rgba(212,175,55,.08)}
    .review-workspace{display:grid;gap:16px}.review-bucket{background:#121212;border:1px solid rgba(212,175,55,.12);border-radius:20px;padding:16px}.review-bucket-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.review-bucket-title{font-size:18px;font-weight:900}.review-bucket-copy{color:#a9a9a9;font-size:13px;line-height:1.45;margin-top:4px}.review-bucket-count{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:34px;padding:0 10px;border-radius:999px;background:rgba(212,175,55,.12);border:1px solid rgba(212,175,55,.22);color:#f3ddb0;font-weight:900}
    .review-card{display:grid;grid-template-columns:96px minmax(0,1fr);gap:14px;padding:14px;border-radius:16px;background:#171717;border:1px solid rgba(255,255,255,.06);margin-top:10px}.review-card-media{border-radius:12px;overflow:hidden;background:#101010;min-height:82px}.review-card-media img{width:100%;height:100%;object-fit:cover;display:block}.review-card-placeholder{height:100%;min-height:82px;display:grid;place-items:center;color:#f3ddb0;font-size:11px;font-weight:800;text-align:center;padding:8px}.review-card-title{font-size:16px;font-weight:900}.review-card-meta{color:#cfcfcf;font-size:12px;line-height:1.45;margin-top:4px}.review-reason{margin-top:10px;color:#e5e5e5;font-size:13px;line-height:1.5}.review-evidence{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.review-evidence div{background:#101010;border:1px solid rgba(255,255,255,.05);border-radius:12px;padding:9px}.review-evidence span{display:block;color:#8f8f8f;font-size:10px;text-transform:uppercase;letter-spacing:.7px;font-weight:900}.review-evidence strong{display:block;margin-top:4px;font-size:12px}.review-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.review-actions .action-btn{min-height:34px;padding:7px 10px;font-size:12px}.review-priority{display:inline-flex;align-items:center;min-height:26px;padding:0 9px;border-radius:999px;border:1px solid rgba(212,175,55,.24);background:rgba(212,175,55,.09);color:#f3ddb0;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.5px}.review-empty{padding:16px;border-radius:14px;background:#151515;border:1px solid rgba(255,255,255,.05);color:#a9a9a9}
    @media(max-width:1100px){.review-command-row{grid-template-columns:repeat(2,minmax(0,1fr))}.review-evidence{grid-template-columns:1fr}}@media(max-width:720px){.review-command-row{grid-template-columns:1fr}.review-card{grid-template-columns:1fr}}
  `;

  function injectStyle() { if (document.getElementById('ea-listings-truth-style')) return; const style = document.createElement('style'); style.id = 'ea-listings-truth-style'; style.textContent = CSS; document.head.appendChild(style); }
  function formatDate(value) { if (!value) return "Not recorded"; const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Not recorded"; }
  function ageDays(value) { if (!value) return 0; const t = new Date(value).getTime(); return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86400000)) : 0; }
  function formatMileage(item) { const text = clean(item.display_mileage_text || ""); if (text) return text; const mileage = Number(item.mileage || item.kilometers || item.odometer || 0); return mileage > 0 ? `${mileage.toLocaleString()} km` : "Mileage pending"; }
  function statusLower(item) { return clean(item.status).toLowerCase(); }
  function lifecycleLower(item) { return clean(item.lifecycle_status).toLowerCase(); }
  function bucketLower(item) { return clean(item.review_bucket).toLowerCase(); }
  function isRemovedOrReviewDelete(item) { return ['sold','deleted','inactive','failed','removed'].includes(statusLower(item)) || lifecycleLower(item) === 'review_delete' || bucketLower(item) === 'removedvehicles'; }
  function isActivePortfolioItem(item) { return !isRemovedOrReviewDelete(item); }
  function isPriceReview(item) { return !!item.price_review_required || lifecycleLower(item) === 'review_price_update' || bucketLower(item) === 'pricechanges' || clean(item.price_warning); }
  function isMissingData(item) { return !!item.missing_image || !clean(item.image_url) || !clean(item.vin) || !clean(item.stock_number) || !clean(item.marketplace_url) || item.price_resolved === false; }
  function isWeakConversion(item) { return !!item.weak || clean(item.health_state).toLowerCase() === 'weak_conversion' || (num(item.views || item.views_count) >= 12 && num(item.messages || item.messages_count) <= 1); }
  function isReviewItem(item) { return lifecycleLower(item).startsWith('review_') || bucketLower(item) === 'removedvehicles' || bucketLower(item) === 'pricechanges' || !!item.needs_action || isPriceReview(item) || isMissingData(item) || isWeakConversion(item); }

  function inferHealth(item) {
    const views = num(item.views || item.views_count);
    const messages = num(item.messages || item.messages_count);
    if (isRemovedOrReviewDelete(item)) return 'removed';
    if (isPriceReview(item)) return 'price_attention';
    if (isMissingData(item)) return 'needs_refresh';
    if (messages >= 3) return 'message_leader';
    if (views >= 25 && messages === 0) return 'high_views_low_messages';
    if (views >= 12 && messages <= 1) return 'weak_conversion';
    if (views === 0 && messages === 0) return 'low_signal';
    return 'active';
  }

  function normalizeApiListing(item = {}) {
    const normalized = {
      ...item,
      id: clean(item.identity_key || item.id || item.marketplace_listing_id || item.vin || item.stock_number),
      identity_key: clean(item.identity_key || item.id || item.marketplace_listing_id || item.vin || item.stock_number),
      title: clean(item.title || `${clean(item.year)} ${clean(item.make)} ${clean(item.model)}`.trim()),
      price: item.display_price_text || item.current_price || item.price || "",
      current_price: item.display_price_text || item.current_price || item.price || "",
      mileage: Number(item.mileage || 0),
      display_mileage_text: item.display_mileage_text || "",
      views: num(item.views || item.views_count), views_count: num(item.views || item.views_count),
      messages: num(item.messages || item.messages_count), messages_count: num(item.messages || item.messages_count),
      image_url: clean(item.image_url || ""), marketplace_url: clean(item.marketplace_url || ""), source_url: clean(item.source_url || ""),
      source: "api_get_user_listings", sync_source: "api_get_user_listings", sync_confidence: "synced",
      last_seen_at: item.last_seen_at || item.updated_at || item.posted_at || new Date().toISOString(),
      posted_at: item.posted_at || item.created_at || item.updated_at || null,
      status: item.status || "active", lifecycle_status: item.lifecycle_status || "active", review_bucket: item.review_bucket || "",
      source_table: item.source_table || "user_listings", likely_sold: Boolean(item.likely_sold), weak: Boolean(item.weak), needs_action: Boolean(item.needs_action),
      missing_image: Boolean(item.missing_image || !item.image_url), price_resolved: item.price_resolved !== false, price_review_required: Boolean(item.price_review_required), price_warning: item.price_warning || "",
      recommended_action: item.recommended_action || "Review listing"
    };
    normalized.health_state = inferHealth(normalized);
    return normalized;
  }

  async function fetchListingsFromApi() {
    if (!NS.api?.apiFetch || !NS.api?.parseJsonSafe) return null;
    try {
      const response = await NS.api.apiFetch("/api/get-user-listings?limit=300&sort=newest", { method: "GET" });
      const result = await NS.api.parseJsonSafe(response);
      if (!response.ok) { console.warn("[dashboard-listings] api load failed:", result?.error || response.statusText); return null; }
      const rows = Array.isArray(result?.data) ? result.data : [];
      return { source: "api_get_user_listings", confidence: rows.length ? "synced" : "empty", ingested_at: new Date().toISOString(), version: "v2_truth_review", issues: [], listings: rows.map(normalizeApiListing), events: [] };
    } catch (error) { console.warn("[dashboard-listings] api exception:", error); return null; }
  }

  function getWindowRemotePayload() { return [window.__EA_REMOTE_SYNC_PAYLOAD, window.__EA_SYNC_PAYLOAD, window.__EA_LISTING_SYNC, window.__ELEVATE_REMOTE_SYNC].find((x) => x && typeof x === "object") || null; }

  function replaceRegistryWithSupabaseTruth(payload) {
    if (!payload?.listings?.length || !NS.state?.set) return false;
    const registry = {};
    payload.listings.forEach((item) => {
      const id = NS.state.canonicalListingId ? NS.state.canonicalListingId(item) : clean(item.identity_key || item.id);
      if (!id) return;
      registry[id] = { ...item, id, identity_key: item.identity_key || id, sync_source: payload.source || "api_get_user_listings", sync_confidence: payload.confidence || "synced", last_seen_at: item.last_seen_at || new Date().toISOString() };
    });
    NS.state.set("listingRegistry", registry, { silent: true, skipPersist: true });
    NS.state.rebuildFilteredListings?.();
    NS.state.setSyncState?.({ source: payload.source || "api_get_user_listings", confidence: payload.confidence || "synced", last_ingest_at: payload.ingested_at || new Date().toISOString(), last_reconcile_at: new Date().toISOString(), remote_listing_count: Object.keys(registry).length, remote_event_count: 0, payload_version: payload.version || "v2_truth_review", issues: [] }, { silent: true, skipPersist: true });
    NS.state.persist?.();
    return true;
  }

  function allRegistryListings() { return Object.values(NS.state?.get?.("listingRegistry", {}) || {}); }
  function activePortfolio() { return allRegistryListings().filter(isActivePortfolioItem); }
  function reviewRows() { return allRegistryListings().filter(isReviewItem); }

  function reviewCategory(item) {
    if (isRemovedOrReviewDelete(item) || item.likely_sold) return 'removed';
    if (isPriceReview(item)) return 'price';
    if (!isRemovedOrReviewDelete(item) && ageDays(item.last_seen_at) >= 14) return 'not_seen';
    if (isWeakConversion(item)) return 'weak';
    if (isMissingData(item)) return 'missing';
    return 'action';
  }

  function reviewPriority(item) {
    const cat = reviewCategory(item);
    if (cat === 'removed') return 'Critical';
    if (cat === 'price') return 'High';
    if (cat === 'not_seen') return 'Medium';
    if (cat === 'missing') return 'Medium';
    if (cat === 'weak') return 'Low';
    return 'Review';
  }

  function reviewReason(item) {
    const cat = reviewCategory(item);
    if (cat === 'removed') return 'Scanner or lifecycle state indicates this vehicle may no longer be in active inventory. Confirm whether the Marketplace listing should be deleted or kept live.';
    if (cat === 'price') return clean(item.price_warning) ? `Price truth issue detected: ${clean(item.price_warning).split('|')[0].replace(/_/g, ' ')}.` : 'Price or mileage truth needs verification before this listing is trusted.';
    if (cat === 'not_seen') return `This vehicle has not been confidently seen recently. Last seen: ${formatDate(item.last_seen_at)}.`;
    if (cat === 'weak') return 'Listing has weak conversion or low message pressure. Review price, title, photos, and CTA before scaling output.';
    if (cat === 'missing') return 'Listing is missing key data such as image, VIN/stock, marketplace link, or resolved price.';
    return 'Listing requires operator validation before the queue is considered clean.';
  }

  function recommendedAction(item) {
    const cat = reviewCategory(item);
    if (cat === 'removed') return 'Open listing and delete if sold/removed.';
    if (cat === 'price') return 'Verify price against source and Marketplace.';
    if (cat === 'not_seen') return 'Check inventory source and confirm it is still available.';
    if (cat === 'weak') return 'Refresh title/photos or review price.';
    if (cat === 'missing') return 'Sync missing data or mark verified.';
    return clean(item.recommended_action || 'Review listing');
  }

  function buildAnalyticsFromRegistry() {
    const listings = allRegistryListings();
    const active = activePortfolio();
    const reviews = reviewRows();
    const trackedViews = active.reduce((sum, item) => sum + num(item.views || item.views_count), 0);
    const trackedMessages = active.reduce((sum, item) => sum + num(item.messages || item.messages_count), 0);
    const payload = { tracking_summary: { total_listings: active.length, tracked_views: trackedViews, tracked_messages: trackedMessages, review_queue_count: reviews.length, price_attention_count: reviews.filter((x) => reviewCategory(x) === 'price').length, missing_data_count: reviews.filter((x) => reviewCategory(x) === 'missing').length, likely_sold_count: reviews.filter((x) => reviewCategory(x) === 'removed').length, sync_source: 'supabase_truth', sync_confidence: 'synced', sync_remote_listing_count: listings.length, refreshed_at: new Date().toISOString() }, action_queue: [], leaders: {} };
    NS.state?.setAnalytics?.(payload, { silent: false });
    NS.state?.set?.("tracking.source", "supabase_truth", { silent: true, skipPersist: false });
    return payload;
  }

  function applyHealthToRegistry() {
    const registry = allRegistryListings();
    registry.forEach((item) => { item.health_state = inferHealth(item); NS.state?.upsertListing?.(item, { silent: true, skipEvents: true, skipPersist: true }); });
  }

  function ingestRemotePayload(payload) {
    if (!payload) return false;
    if (payload.source === "api_get_user_listings") replaceRegistryWithSupabaseTruth(payload);
    else if (NS.state?.applyRemoteSync) NS.state.applyRemoteSync(payload);
    applyHealthToRegistry(); NS.state?.rebuildFilteredListings?.(); buildAnalyticsFromRegistry(); renderHydratedViews(); return true;
  }

  function applyFilter(items) {
    const search = clean(listingUi.search).toLowerCase();
    let out = [...items];
    if (listingUi.filter === "review") out = reviewRows();
    else if (listingUi.filter === "weak") out = out.filter(isWeakConversion);
    else if (listingUi.filter === "likely_sold") out = reviewRows().filter((item) => reviewCategory(item) === 'removed');
    else if (listingUi.filter === "needs_action") out = out.filter((item) => !!item.needs_action || isPriceReview(item) || isMissingData(item));
    else out = out.filter(isActivePortfolioItem);
    if (search) out = out.filter((item) => [item.title, item.make, item.model, item.vin, item.stock_number].map((v) => clean(v).toLowerCase()).join(" ").includes(search));
    if (listingUi.sort === "newest") out.sort((a, b) => new Date(b.updated_at || b.posted_at || 0) - new Date(a.updated_at || a.posted_at || 0));
    else if (listingUi.sort === "price_high") out.sort((a, b) => num(b.price) - num(a.price));
    else if (listingUi.sort === "price_low") out.sort((a, b) => num(a.price) - num(b.price));
    else out.sort((a, b) => (num(b.messages || b.messages_count) * 1000 + num(b.views || b.views_count)) - (num(a.messages || a.messages_count) * 1000 + num(a.views || a.views_count)));
    return out;
  }

  function cardBadge(item) { const lc = lifecycleLower(item); if (lc === 'review_delete') return '<span class="badge sold">Likely Sold</span>'; if (isPriceReview(item)) return '<span class="badge warn">Price Review</span>'; if (isMissingData(item)) return '<span class="badge warn">Missing Data</span>'; if (item.needs_action) return '<span class="badge warn">Needs Action</span>'; if (statusLower(item) === 'active') return '<span class="badge active">Active</span>'; return `<span class="badge warn">${clean(item.status || 'Tracked')}</span>`; }
  function formatPrice(item) { const p = clean(item.display_price_text || item.current_price || item.price || ''); if (item.price_review_required || item.price_resolved === false || /needs review|pending/i.test(p)) return 'Price needs review'; return p || 'Price pending'; }
  function listingActions(item) { const source = clean(item.source_url); const marketplace = clean(item.marketplace_url); return `<div class="listing-card-actions">${marketplace ? `<button class="action-btn" type="button" data-listing-open="${marketplace}">Open Marketplace</button>` : ''}${source ? `<button class="action-btn" type="button" data-listing-open="${source}">Open Source</button>` : ''}</div>`; }
  function listingCard(item) { const warning = isPriceReview(item) || isMissingData(item); return `<article class="listing-card ${warning ? 'truth-warning' : ''}" data-hydrated="true"><div class="listing-media">${item.image_url ? `<img src="${item.image_url}" alt="${clean(item.title)}" />` : '<div class="listing-placeholder">Image not synced</div>'}<div class="listing-badge">${cardBadge(item)}</div></div><div class="listing-content"><div><div class="listing-title">${clean(item.title || 'Untitled Listing')}</div><div class="listing-sub">${clean(item.stock_number || '')}${item.vin ? ` • ${clean(item.vin)}` : ''}</div></div><div class="listing-price">${formatPrice(item)}</div><div class="listing-truth-row"><span class="listing-truth-chip">${formatMileage(item)}</span><span class="listing-truth-chip">Posted ${formatDate(item.posted_at)}</span><span class="listing-truth-chip">Seen ${formatDate(item.last_seen_at)}</span>${item.price_warning ? `<span class="listing-truth-chip warn">${clean(item.price_warning).split('|')[0].replace(/_/g, ' ')}</span>` : ''}</div><div class="listing-metrics"><div class="metric-pill"><div class="metric-pill-label">Views</div><div class="metric-pill-value">${num(item.views || item.views_count)}</div></div><div class="metric-pill"><div class="metric-pill-label">Messages</div><div class="metric-pill-value">${num(item.messages || item.messages_count)}</div></div><div class="metric-pill"><div class="metric-pill-label">Status</div><div class="metric-pill-value">${clean(item.lifecycle_status || item.status || 'tracked')}</div></div></div><div class="listing-sub">${clean(item.recommended_action || 'Review listing')}</div>${listingActions(item)}</div></article>`; }

  function reviewBucketMeta(key) {
    return {
      removed: ['Removed From Inventory / Likely Sold', 'Highest-confidence cleanup. VIN/stock or lifecycle suggests the listing may need deletion.'],
      price: ['Price Changed / Price Review', 'Price, mileage, or source truth requires validation.'],
      not_seen: ['Not Seen Recently', 'Inventory was not recently confirmed. Use date evidence before acting.'],
      weak: ['Weak Conversion', 'Low conversion or weak signal listings that need optimization.'],
      missing: ['Missing Data', 'Image, price, VIN/stock, or Marketplace link is incomplete.']
    }[key] || ['General Review', 'Operator validation required.'];
  }

  function reviewActions(item) {
    const marketplace = clean(item.marketplace_url);
    const source = clean(item.source_url);
    const vin = clean(item.vin);
    const stock = clean(item.stock_number);
    return `<div class="review-actions">${marketplace ? `<button class="action-btn" type="button" data-listing-open="${marketplace}">Open Marketplace Listing</button>` : '<button class="action-btn" type="button" disabled>Marketplace link not captured</button>'}${source ? `<button class="action-btn" type="button" data-listing-open="${source}">Open Source</button>` : ''}${vin ? `<button class="action-btn" type="button" data-copy-text="${vin}">Copy VIN</button>` : ''}${stock ? `<button class="action-btn" type="button" data-copy-text="${stock}">Copy Stock</button>` : ''}<button class="action-btn" type="button" data-review-local="verified">Mark Verified</button><button class="action-btn" type="button" data-review-local="keep">Keep Active</button></div>`;
  }

  function reviewCard(item) {
    return `<article class="review-card"><div class="review-card-media">${item.image_url ? `<img src="${item.image_url}" alt="${clean(item.title)}" />` : '<div class="review-card-placeholder">Image not synced</div>'}</div><div><div class="review-card-title">${clean(item.title || 'Listing')}</div><div class="review-card-meta">${clean(item.stock_number || 'No stock')} ${item.vin ? `• ${clean(item.vin)}` : ''} • ${formatPrice(item)} • ${formatMileage(item)}</div><div style="margin-top:8px;"><span class="review-priority">${reviewPriority(item)}</span></div><div class="review-reason"><strong>Reason:</strong> ${reviewReason(item)}<br><strong>Recommended:</strong> ${recommendedAction(item)}</div><div class="review-evidence"><div><span>Posted</span><strong>${formatDate(item.posted_at)}</strong></div><div><span>Last Seen</span><strong>${formatDate(item.last_seen_at)}</strong></div><div><span>Age</span><strong>${ageDays(item.posted_at)} days</strong></div></div>${reviewActions(item)}</div></article>`;
  }

  function bindListingActions(root = document) {
    root.querySelectorAll('[data-listing-open]').forEach((btn) => { if (btn.dataset.boundOpen === 'true') return; btn.dataset.boundOpen = 'true'; btn.addEventListener('click', () => window.open(btn.getAttribute('data-listing-open'), '_blank', 'noopener,noreferrer')); });
    root.querySelectorAll('[data-copy-text]').forEach((btn) => { if (btn.dataset.boundCopy === 'true') return; btn.dataset.boundCopy = 'true'; btn.addEventListener('click', async () => { try { await navigator.clipboard.writeText(btn.getAttribute('data-copy-text') || ''); btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = btn.getAttribute('data-copy-text')?.length === 17 ? 'Copy VIN' : 'Copy Stock'; }, 1200); } catch {} }); });
    root.querySelectorAll('[data-review-local]').forEach((btn) => { if (btn.dataset.boundReviewLocal === 'true') return; btn.dataset.boundReviewLocal = 'true'; btn.addEventListener('click', () => { btn.textContent = btn.getAttribute('data-review-local') === 'keep' ? 'Kept Locally' : 'Verified Locally'; }); });
  }

  function renderListingsSection() {
    const mount = document.getElementById('analyticsListingsGrid'); if (!mount) return;
    const rows = applyFilter(activePortfolio());
    const activeCount = activePortfolio().length;
    const statusNode = document.getElementById('analyticsListingsStatus'); const gridStatus = document.getElementById('analyticsListingsGridStatus');
    const label = listingUi.filter === 'all' ? 'active portfolio' : listingUi.filter.replace(/_/g, ' ');
    if (statusNode) statusNode.textContent = `${label} • ${rows.length} rows available`;
    if (gridStatus) gridStatus.textContent = activeCount ? `${activeCount} active listing row${activeCount === 1 ? '' : 's'} loaded from Supabase truth.` : 'No active portfolio rows are available yet.';
    mount.innerHTML = rows.length ? `<div class="listing-grid">${rows.slice(0, 60).map(listingCard).join('')}</div>` : `<div class="listing-empty">No portfolio rows are available for this filter.</div>`;
    bindListingActions(mount);
  }

  function renderReviewCenter() {
    const reviewMount = document.getElementById('analyticsReviewQueue'); const actionMount = document.getElementById('analyticsNeedsActionQueue'); const priceMount = document.getElementById('analyticsPriceWatchQueue');
    if (!reviewMount && !actionMount && !priceMount) return;
    const rows = reviewRows();
    const groups = ['removed','price','not_seen','weak','missing'].reduce((acc, key) => ({ ...acc, [key]: rows.filter((item) => reviewCategory(item) === key) }), {});
    const command = `<div class="review-command-row"><div class="review-command-card critical"><strong>${groups.removed.length}</strong><span>Likely sold / removed</span></div><div class="review-command-card"><strong>${groups.price.length}</strong><span>Price review</span></div><div class="review-command-card"><strong>${groups.not_seen.length}</strong><span>Not seen recently</span></div><div class="review-command-card"><strong>${groups.weak.length}</strong><span>Weak conversion</span></div><div class="review-command-card"><strong>${groups.missing.length}</strong><span>Missing data</span></div></div>`;
    const buckets = ['removed','price','not_seen','weak','missing'].map((key) => { const [title, copy] = reviewBucketMeta(key); const items = groups[key] || []; return `<section class="review-bucket"><div class="review-bucket-head"><div><div class="review-bucket-title">${title}</div><div class="review-bucket-copy">${copy}</div></div><div class="review-bucket-count">${items.length}</div></div>${items.length ? items.slice(0, 12).map(reviewCard).join('') : '<div class="review-empty">No items in this bucket.</div>'}</section>`; }).join('');
    const html = `<div class="review-workspace">${command}${buckets}</div>`;
    if (reviewMount) reviewMount.innerHTML = html;
    if (actionMount) actionMount.innerHTML = rows.length ? rows.slice(0, 8).map(reviewCard).join('') : '<div class="listing-empty">No critical items right now.</div>';
    if (priceMount) priceMount.innerHTML = [...groups.price, ...groups.removed].slice(0, 12).map(reviewCard).join('') || '<div class="listing-empty">No price watch or sold-risk items right now.</div>';
    bindListingActions(document.getElementById('analyticsPaneReview') || document);
  }

  function bindControls() {
    const filterWrap = document.getElementById('analyticsListingQuickFilters'); const sortSelect = document.getElementById('analyticsListingSortSelect'); const search = document.getElementById('analyticsListingSearchInput');
    if (filterWrap && filterWrap.dataset.hydratedBindings !== 'true') { filterWrap.dataset.hydratedBindings = 'true'; const buttons = Array.from(filterWrap.querySelectorAll('button[data-filter]')); buttons.forEach((btn) => btn.addEventListener('click', () => { listingUi.filter = btn.getAttribute('data-filter') || 'all'; buttons.forEach((b) => b.classList.toggle('active', b === btn)); renderListingsSection(); renderReviewCenter(); })); }
    if (sortSelect && sortSelect.dataset.hydratedBindings !== 'true') { sortSelect.dataset.hydratedBindings = 'true'; sortSelect.addEventListener('change', () => { const value = clean(sortSelect.value || '').toLowerCase(); if (value.includes('new')) listingUi.sort = 'newest'; else if (value.includes('price_high')) listingUi.sort = 'price_high'; else if (value.includes('price_low')) listingUi.sort = 'price_low'; else listingUi.sort = 'popular'; renderListingsSection(); }); }
    if (search && search.dataset.hydratedBindings !== 'true') { search.dataset.hydratedBindings = 'true'; search.addEventListener('input', () => { listingUi.search = search.value || ''; renderListingsSection(); }); }
  }

  function renderHydratedViews() { injectStyle(); renderListingsSection(); renderReviewCenter(); bindControls(); }
  async function hydrateListings() { injectStyle(); const apiPayload = await fetchListingsFromApi(); if (apiPayload?.listings?.length) { ingestRemotePayload(apiPayload); return true; } const remote = getWindowRemotePayload(); if (remote) { ingestRemotePayload(remote); return true; } renderHydratedViews(); return false; }
  function bindRefresh() { const btn = document.getElementById('refreshListingsBtn'); if (!btn || btn.dataset.packageFBound === 'true') return; btn.dataset.packageFBound = 'true'; btn.addEventListener('click', async () => { await hydrateListings(); window.dispatchEvent(new CustomEvent('elevate:tracking-refreshed')); }); }
  async function boot() { injectStyle(); await hydrateListings(); bindRefresh(); setTimeout(() => { hydrateListings(); }, 1200); setTimeout(() => { const payload = getWindowRemotePayload(); if (payload) ingestRemotePayload(payload); }, 3200); }

  window.addEventListener('elevate:remote-sync', (event) => { if (event?.detail) ingestRemotePayload(event.detail); }); window.addEventListener('elevate:tracking-refreshed', renderHydratedViews); window.addEventListener('elevate:analytics-workspace-mounted', renderHydratedViews);
  NS.listings = { buildAnalyticsFromRegistry, ingestRemotePayload, hydrateListings, renderHydratedViews };
  NS.modules = NS.modules || {}; NS.modules.listings = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { boot(); }, { once: true }); else boot();
})();
