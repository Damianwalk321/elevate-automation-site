(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.reviewV24) return;

  const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
  const lower = (v) => clean(v).toLowerCase();
  const upper = (v) => clean(v).toUpperCase();
  const number = (v) => {
    const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const ui = { filter: 'all' };
  let rows = [];

  const LABELS = {
    all: ['All Review', 'Operational checks only. Weak listing optimization stays in Performance/Listings.'],
    delete_check: ['Delete Check', 'Posted vehicles no longer confirmed in source inventory.'],
    price_check: ['Price Check', 'Price or mileage truth needs validation.'],
    data_cleanup: ['Data Cleanup', 'Core data missing: source, VIN, stock, or unresolved price.']
  };

  const STYLE = `
    .review-v24-shell{display:grid;gap:14px}.review-v24-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;padding:14px 16px;border-radius:18px;background:#121212;border:1px solid rgba(212,175,55,.14)}.review-v24-head h3{margin:0;font-size:22px;line-height:1.08}.review-v24-head p{margin:6px 0 0;color:#a9a9a9;font-size:13px;line-height:1.45}.review-v24-score{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;min-width:min(430px,100%)}.review-v24-card{padding:11px;border-radius:13px;background:#171717;border:1px solid rgba(255,255,255,.06)}.review-v24-card strong{display:block;font-size:21px;line-height:1}.review-v24-card span{display:block;margin-top:6px;font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#aaa;font-weight:900}.review-v24-card.critical{background:rgba(212,175,55,.08);border-color:rgba(212,175,55,.34)}
    .review-v24-filters{display:flex;gap:8px;flex-wrap:wrap}.review-v24-filters button{appearance:none;border:1px solid rgba(255,255,255,.08);background:#171717;color:#d8d8d8;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:900;cursor:pointer}.review-v24-filters button.active{background:rgba(212,175,55,.15);border-color:rgba(212,175,55,.35);color:#f3ddb0}
    .review-v24-note{font-size:12px;color:#8d8d8d;line-height:1.45}.review-v24-note b{color:#f3ddb0}.review-v24-table{display:grid;gap:7px}.review-v24-row{display:grid;grid-template-columns:12px minmax(220px,1.15fr) 126px minmax(240px,1fr) 160px auto;gap:10px;align-items:center;padding:10px 12px;border:1px solid rgba(255,255,255,.055);border-radius:13px;background:#151515}.review-v24-row.critical{border-color:rgba(212,175,55,.34);background:rgba(212,175,55,.055)}.review-v24-dot{width:9px;height:9px;border-radius:999px;background:#777}.review-v24-row.critical .review-v24-dot{background:#d4af37}.review-v24-vehicle{min-width:0}.review-v24-vehicle strong{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.review-v24-vehicle span,.review-v24-evidence,.review-v24-reason{display:block;color:#a9a9a9;font-size:12px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.review-v24-category{display:inline-flex;align-items:center;justify-content:center;min-height:26px;padding:0 9px;border-radius:999px;background:#101010;border:1px solid rgba(255,255,255,.07);color:#f3ddb0;font-size:11px;font-weight:900}.review-v24-category.blocked{color:#ffdc9f;border-color:rgba(255,190,90,.25);background:rgba(255,190,90,.075)}.review-v24-actions{display:flex;gap:7px;justify-content:flex-end;align-items:center;flex-wrap:wrap}.review-v24-actions .action-btn{min-height:31px;padding:6px 9px;font-size:12px}.review-v24-blocker{display:inline-flex;align-items:center;min-height:31px;padding:0 9px;border-radius:999px;background:#101010;border:1px solid rgba(255,255,255,.07);color:#a9a9a9;font-size:11px;font-weight:800}.review-v24-empty{padding:16px;border-radius:14px;background:#151515;border:1px solid rgba(255,255,255,.05);color:#a9a9a9}
    @media(max-width:1160px){.review-v24-row{grid-template-columns:12px minmax(0,1fr);align-items:start}.review-v24-category,.review-v24-evidence,.review-v24-reason,.review-v24-actions{grid-column:2}.review-v24-actions{justify-content:flex-start}.review-v24-score{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:720px){.review-v24-score{grid-template-columns:1fr}.review-v24-row{grid-template-columns:1fr}.review-v24-dot{display:none}.review-v24-category,.review-v24-evidence,.review-v24-reason,.review-v24-actions{grid-column:1}}
  `;

  function injectStyle() {
    let style = document.getElementById('ea-review-v24-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ea-review-v24-style';
      document.head.appendChild(style);
    }
    style.textContent = STYLE;
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
    const vin = normalizeVin(item.vin || item.id || item.identity_key);
    if (vin) return `VIN:${vin}`;
    const stock = upper(item.stock_number);
    if (stock) return `STOCK:${stock}`;
    const mpId = clean(item.marketplace_listing_id).replace(/[^0-9]/g, '');
    if (mpId) return `MARKETPLACE:${mpId}`;
    const mp = lower(marketplaceUrl(item));
    if (mp) return `MPURL:${mp}`;
    const source = lower(item.source_url);
    if (source) return `URL:${source}`;
    return `TITLE:${[item.title, item.price || item.display_price_text, item.mileage || item.display_mileage_text].map(clean).filter(Boolean).join('|').toLowerCase()}`;
  }

  function rowScore(item) {
    return (marketplaceUrl(item) ? 600 : 0) +
      (clean(item.marketplace_listing_id) ? 300 : 0) +
      (clean(item.source_url) ? 90 : 0) +
      (clean(item.image_url) ? 40 : 0) +
      (new Date(item.updated_at || item.posted_at || item.created_at || 0).getTime() / 100000000000);
  }

  function dedupe(list) {
    const map = new Map();
    list.forEach((item) => {
      const normalized = normalize(item);
      const key = canonicalKey(normalized);
      const existing = map.get(key);
      if (!existing || rowScore(normalized) >= rowScore(existing)) {
        map.set(key, { ...(existing || {}), ...normalized, id: key, identity_key: key, duplicate_count: existing ? number(existing.duplicate_count || 1) + 1 : number(normalized.duplicate_count || 1) });
      } else {
        existing.duplicate_count = number(existing.duplicate_count || 1) + 1;
      }
    });
    return [...map.values()].map((item) => ({ ...item, primary_review_category: category(item) }));
  }

  function status(item) { return lower(item.status); }
  function lifecycle(item) { return lower(item.lifecycle_status); }
  function bucket(item) { return lower(item.review_bucket); }
  function isDeleteCheck(item) { return ['sold', 'deleted', 'inactive', 'failed', 'removed'].includes(status(item)) || lifecycle(item) === 'review_delete' || bucket(item) === 'removedvehicles' || item.likely_sold; }
  function isPriceCheck(item) { return !!item.price_review_required || item.price_resolved === false || lifecycle(item) === 'review_price_update' || bucket(item) === 'pricechanges' || !!clean(item.price_warning); }
  function isDataCleanup(item) { return !clean(item.source_url) || !normalizeVin(item.vin || item.id) || !clean(item.stock_number) || item.price_resolved === false; }
  function category(item) { if (isDeleteCheck(item)) return 'delete_check'; if (isPriceCheck(item)) return 'price_check'; if (isDataCleanup(item)) return 'data_cleanup'; return 'none'; }

  function normalize(item = {}) {
    const vin = normalizeVin(item.vin || item.id);
    return {
      ...item,
      title: clean(item.title || `${clean(item.year)} ${clean(item.make)} ${clean(item.model)}`),
      vin: vin || clean(item.vin || ''),
      stock_number: clean(item.stock_number),
      marketplace_url: marketplaceUrl(item),
      source_url: clean(item.source_url),
      posted_at: item.posted_at || item.created_at || item.updated_at || null,
      last_seen_at: item.last_seen_at || item.updated_at || item.posted_at || null,
      status: item.status || 'active',
      lifecycle_status: item.lifecycle_status || 'active',
      review_bucket: item.review_bucket || ''
    };
  }

  function dateShort(value) { const d = value ? new Date(value) : null; return d && Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Not recorded'; }
  function ageDays(value) { const d = value ? new Date(value).getTime() : 0; return Number.isFinite(d) && d > 0 ? Math.max(0, Math.floor((Date.now() - d) / 86400000)) : 0; }
  function formatPrice(item) { const text = clean(item.display_price_text || item.current_price || item.price); if (item.price_review_required || item.price_resolved === false || /needs review|pending/i.test(text)) return 'Price check'; if (/^\$/.test(text)) return text; const n = number(text); return n > 0 ? `$${n.toLocaleString()}` : 'Price pending'; }
  function formatMileage(item) { const text = clean(item.display_mileage_text); if (text) return text; const mileage = number(item.mileage || item.kilometers || item.odometer); return mileage > 0 ? `${mileage.toLocaleString()} km` : 'Mileage pending'; }

  async function loadRows() {
    try {
      if (!NS.api?.apiFetch || !NS.api?.parseJsonSafe) throw new Error('API client unavailable');
      const res = await NS.api.apiFetch('/api/get-user-listings?limit=300&sort=newest', { method: 'GET' });
      const json = await NS.api.parseJsonSafe(res);
      if (!res.ok) throw new Error(json?.error || res.statusText);
      rows = dedupe(Array.isArray(json?.data) ? json.data : []);
      return true;
    } catch (err) {
      console.warn('[dashboard-review-v24] fallback:', err);
      rows = dedupe(Object.values(NS.state?.get?.('listingRegistry', {}) || {}));
      return false;
    }
  }

  function reviewRows() { return rows.filter((item) => category(item) !== 'none'); }
  function counts() {
    const r = reviewRows();
    return {
      all: r.length,
      delete_check: r.filter((x) => category(x) === 'delete_check').length,
      price_check: r.filter((x) => category(x) === 'price_check').length,
      data_cleanup: r.filter((x) => category(x) === 'data_cleanup').length
    };
  }

  function filters(c) {
    return ['all', 'delete_check', 'price_check', 'data_cleanup'].map((key) => `<button type="button" class="${ui.filter === key ? 'active' : ''}" data-review-v24-filter="${key}">${LABELS[key][0]} · ${c[key] || 0}</button>`).join('');
  }

  function reason(item) {
    const cat = category(item);
    if (cat === 'delete_check') return marketplaceUrl(item) ? 'Open Facebook listing and delete if sold/removed' : 'Facebook link missing; verify from source first';
    if (cat === 'price_check') return `Verify price · ${formatPrice(item)} · ${formatMileage(item)}`;
    return 'Core data cleanup required';
  }

  function evidence(item) { return `Posted ${dateShort(item.posted_at)} · Seen ${dateShort(item.last_seen_at)} · ${ageDays(item.posted_at)}d live`; }

  function row(item) {
    const cat = category(item);
    const [label] = LABELS[cat] || LABELS.data_cleanup;
    const fb = marketplaceUrl(item);
    const source = clean(item.source_url);
    const merged = number(item.duplicate_count) > 1 ? ` · merged ${number(item.duplicate_count)}` : '';
    return `<article class="review-v24-row ${cat === 'delete_check' ? 'critical' : ''}"><div class="review-v24-dot"></div><div class="review-v24-vehicle"><strong>${clean(item.title || 'Listing')}</strong><span>${clean(item.stock_number || 'No stock')}${item.vin ? ` · ${clean(item.vin)}` : ''}${merged}</span></div><div><span class="review-v24-category ${cat === 'delete_check' && !fb ? 'blocked' : ''}">${label}</span></div><div class="review-v24-reason">${reason(item)}</div><div class="review-v24-evidence">${evidence(item)}</div><div class="review-v24-actions">${fb ? `<button class="action-btn" type="button" data-review-v24-open="${fb}">Facebook Listing</button>` : (cat === 'delete_check' ? '<span class="review-v24-blocker">Facebook link missing</span>' : '')}${source ? `<button class="action-btn" type="button" data-review-v24-open="${source}">Source</button>` : ''}${item.vin ? `<button class="action-btn" type="button" data-review-v24-copy="${clean(item.vin)}">VIN</button>` : ''}</div></article>`;
  }

  function bind(root = document) {
    root.querySelectorAll('[data-review-v24-open]').forEach((btn) => {
      if (btn.dataset.boundReviewV24Open === 'true') return;
      btn.dataset.boundReviewV24Open = 'true';
      btn.addEventListener('click', () => window.open(btn.getAttribute('data-review-v24-open'), '_blank', 'noopener,noreferrer'));
    });
    root.querySelectorAll('[data-review-v24-copy]').forEach((btn) => {
      if (btn.dataset.boundReviewV24Copy === 'true') return;
      btn.dataset.boundReviewV24Copy = 'true';
      const original = btn.textContent;
      btn.addEventListener('click', async () => { try { await navigator.clipboard.writeText(btn.getAttribute('data-review-v24-copy') || ''); btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = original; }, 1000); } catch {} });
    });
    root.querySelectorAll('[data-review-v24-filter]').forEach((btn) => {
      if (btn.dataset.boundReviewV24Filter === 'true') return;
      btn.dataset.boundReviewV24Filter = 'true';
      btn.addEventListener('click', () => { ui.filter = btn.getAttribute('data-review-v24-filter') || 'all'; render(); });
    });
  }

  function render() {
    injectStyle();
    const mount = document.getElementById('analyticsReviewQueue');
    const oldAction = document.getElementById('analyticsNeedsActionQueue');
    const oldPrice = document.getElementById('analyticsPriceWatchQueue');
    if (oldAction) oldAction.innerHTML = '';
    if (oldPrice) oldPrice.innerHTML = '';
    if (!mount) return;
    const c = counts();
    const all = reviewRows();
    const visible = ui.filter === 'all' ? all : all.filter((item) => category(item) === ui.filter);
    const mergedCount = rows.reduce((sum, item) => sum + Math.max(0, number(item.duplicate_count || 1) - 1), 0);
    mount.innerHTML = `<div class="review-v24-shell"><div class="review-v24-head"><div><h3>Operator Review Queue</h3><p>Review now shows only operational cleanup: delete checks, price checks, and hard data blockers. Weak listing optimization is handled outside Review.</p></div><div class="review-v24-score"><div class="review-v24-card critical"><strong>${c.delete_check}</strong><span>Delete Check</span></div><div class="review-v24-card"><strong>${c.price_check}</strong><span>Price</span></div><div class="review-v24-card"><strong>${c.data_cleanup}</strong><span>Cleanup</span></div></div></div><div class="review-v24-filters">${filters(c)}</div><div class="review-v24-note">Showing ${visible.length} of ${all.length} review items.${mergedCount ? ` <b>Merged ${mergedCount} duplicate row${mergedCount === 1 ? '' : 's'} by VIN/stock.</b>` : ''} Delete Check requires captured Facebook listing URLs; Source is fallback until post capture is wired.</div><div class="review-v24-table">${visible.length ? visible.map(row).join('') : '<div class="review-v24-empty">No items in this queue.</div>'}</div></div>`;
    bind(mount);
  }

  async function hydrate() {
    await loadRows();
    render();
  }

  window.addEventListener('elevate:analytics-workspace-mounted', hydrate);
  window.addEventListener('elevate:tracking-refreshed', hydrate);
  window.addEventListener('elevate:sync-refreshed', hydrate);

  NS.reviewV24 = { hydrate, render };
  NS.modules.reviewV24 = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrate, { once: true });
  else hydrate();
})();