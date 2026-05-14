(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.listings) return;

  const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();
  const num = (v) => {
    const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const listingUi = { filter: "all", search: "", sort: "popular" };
  const reviewUi = { filter: "all" };

  const CSS = `
    .listing-card.truth-warning{border-color:rgba(212,175,55,.34)}
    .listing-placeholder{height:100%;min-height:160px;display:grid;place-items:center;text-align:center;color:#f3ddb0;background:linear-gradient(135deg,rgba(212,175,55,.08),rgba(255,255,255,.02));font-size:13px;font-weight:800;letter-spacing:.3px;padding:14px}
    .listing-truth-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .listing-truth-chip{display:inline-flex;align-items:center;min-height:28px;padding:0 9px;border-radius:999px;background:#171717;border:1px solid rgba(255,255,255,.07);font-size:12px;color:#d8d8d8}
    .listing-truth-chip.warn{color:#f3ddb0;border-color:rgba(212,175,55,.25);background:rgba(212,175,55,.08)}
    .listing-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .listing-card-actions .action-btn{min-height:34px;padding:7px 10px;font-size:12px}

    .review-clean-shell{display:grid;gap:16px}
    .review-clean-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;padding:16px;border:1px solid rgba(212,175,55,.12);border-radius:18px;background:linear-gradient(180deg,rgba(212,175,55,.045),rgba(255,255,255,.012))}
    .review-clean-head h3{margin:0;font-size:24px;line-height:1.1}.review-clean-head p{margin:7px 0 0;color:#a9a9a9;line-height:1.45}
    .review-clean-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
    .review-clean-kpi{background:#151515;border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:12px;min-width:118px}
    .review-clean-kpi strong{display:block;font-size:22px;line-height:1.1}.review-clean-kpi span{display:block;color:#a9a9a9;font-size:11px;line-height:1.3;margin-top:6px;text-transform:uppercase;letter-spacing:.7px;font-weight:900}.review-clean-kpi.critical{border-color:rgba(212,175,55,.35);background:rgba(212,175,55,.08)}
    .review-filter-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.review-filter-btn{appearance:none;border:1px solid rgba(255,255,255,.08);background:#171717;color:#d8d8d8;border-radius:999px;padding:10px 13px;font-size:12px;font-weight:900;cursor:pointer}.review-filter-btn.active{background:rgba(212,175,55,.16);border-color:rgba(212,175,55,.35);color:#f3ddb0}
    .review-queue{display:grid;gap:10px}.review-queue-card{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px;border-radius:16px;background:#151515;border:1px solid rgba(255,255,255,.06)}.review-queue-card.critical{border-color:rgba(212,175,55,.34);background:rgba(212,175,55,.055)}
    .review-thumb{width:64px;height:54px;border-radius:12px;overflow:hidden;background:#101010;display:grid;place-items:center;color:#f3ddb0;font-size:10px;font-weight:900;text-align:center}.review-thumb img{width:100%;height:100%;object-fit:cover;display:block}
    .review-main{min-width:0}.review-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.review-title{font-size:15px;font-weight:900;color:#f5f5f5}.review-chip{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;background:#101010;border:1px solid rgba(255,255,255,.07);color:#d8d8d8;font-size:11px;font-weight:800}.review-chip.gold{color:#f3ddb0;border-color:rgba(212,175,55,.24);background:rgba(212,175,55,.08)}.review-chip.critical{color:#f3ddb0;border-color:rgba(212,175,55,.36);background:rgba(212,175,55,.12)}
    .review-meta{font-size:12px;color:#bdbdbd;line-height:1.45;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.review-reason-compact{font-size:12px;color:#e4e4e4;line-height:1.45;margin-top:6px}.review-actions-compact{display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap}.review-actions-compact .action-btn{min-height:32px;padding:6px 9px;font-size:12px}.review-details{grid-column:2 / -1;margin-top:2px}.review-details summary{cursor:pointer;color:#f3ddb0;font-size:12px;font-weight:900}.review-detail-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:9px}.review-detail-box{background:#101010;border:1px solid rgba(255,255,255,.05);border-radius:10px;padding:9px}.review-detail-box span{display:block;color:#8f8f8f;font-size:10px;text-transform:uppercase;letter-spacing:.7px;font-weight:900}.review-detail-box strong{display:block;margin-top:4px;font-size:12px}.review-empty{padding:16px;border-radius:14px;background:#151515;border:1px solid rgba(255,255,255,.05);color:#a9a9a9}
    @media(max-width:1120px){.review-clean-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.review-queue-card{grid-template-columns:54px minmax(0,1fr)}.review-actions-compact{grid-column:2 / -1;justify-content:flex-start}.review-details{grid-column:1 / -1}.review-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:720px){.review-clean-kpis,.review-detail-grid{grid-template-columns:1fr}.review-queue-card{grid-template-columns:1fr}.review-thumb{width:100%;height:90px}.review-meta{white-space:normal}.review-actions-compact,.review-details{grid-column:1}}
  `;

  function injectStyle() {
    if (document.getElementById("ea-listings-truth-style")) return;
    const style = document.createElement("style");
    style.id = "ea-listings-truth-style";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function formatDate(value) {
    if (!value) return "Not recorded";
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Not recorded";
  }

  function ageDays(value) {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86400000)) : 0;
  }

  function formatMileage(item) {
    const text = clean(item.display_mileage_text || "");
    if (text) return text;
    const mileage = Number(item.mileage || item.kilometers || item.odometer || 0);
    return mileage > 0 ? `${mileage.toLocaleString()} km` : "Mileage pending";
  }

  function statusLower(item) { return clean(item.status).toLowerCase(); }
  function lifecycleLower(item) { return clean(item.lifecycle_status).toLowerCase(); }
  function bucketLower(item) { return clean(item.review_bucket).toLowerCase(); }

  function isRemovedOrReviewDelete(item) {
    return ["sold", "deleted", "inactive", "failed", "removed"].includes(statusLower(item)) || lifecycleLower(item) === "review_delete" || bucketLower(item) === "removedvehicles";
  }

  function isActivePortfolioItem(item) { return !isRemovedOrReviewDelete(item); }
  function isPriceReview(item) { return !!item.price_review_required || lifecycleLower(item) === "review_price_update" || bucketLower(item) === "pricechanges" || !!clean(item.price_warning); }
  function isMissingData(item) { return !!item.missing_image || !clean(item.image_url) || !clean(item.vin) || !clean(item.stock_number) || !clean(item.marketplace_url) || item.price_resolved === false; }
  function isWeakConversion(item) { return !!item.weak || clean(item.health_state).toLowerCase() === "weak_conversion" || (num(item.views || item.views_count) >= 12 && num(item.messages || item.messages_count) <= 1); }

  function primaryReviewCategory(item) {
    if (isRemovedOrReviewDelete(item) || item.likely_sold) return "inventory_missing";
    if (isPriceReview(item)) return "price_review";
    if (isMissingData(item)) return "missing_data";
    if (!isRemovedOrReviewDelete(item) && ageDays(item.last_seen_at) >= 14) return "not_seen";
    if (isWeakConversion(item)) return "weak_conversion";
    if (item.needs_action) return "action";
    return "none";
  }

  function isReviewItem(item) { return primaryReviewCategory(item) !== "none"; }

  function inferHealth(item) {
    const cat = primaryReviewCategory(item);
    if (cat === "inventory_missing") return "removed";
    if (cat === "price_review") return "price_attention";
    if (cat === "missing_data") return "needs_refresh";
    if (cat === "weak_conversion") return "weak_conversion";
    const views = num(item.views || item.views_count);
    const messages = num(item.messages || item.messages_count);
    if (messages >= 3) return "message_leader";
    if (views >= 25 && messages === 0) return "high_views_low_messages";
    if (views === 0 && messages === 0) return "low_signal";
    return "active";
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
      views: num(item.views || item.views_count),
      views_count: num(item.views || item.views_count),
      messages: num(item.messages || item.messages_count),
      messages_count: num(item.messages || item.messages_count),
      image_url: clean(item.image_url || ""),
      marketplace_url: clean(item.marketplace_url || ""),
      source_url: clean(item.source_url || ""),
      source: "api_get_user_listings",
      sync_source: "api_get_user_listings",
      sync_confidence: "synced",
      last_seen_at: item.last_seen_at || item.updated_at || item.posted_at || new Date().toISOString(),
      posted_at: item.posted_at || item.created_at || item.updated_at || null,
      status: item.status || "active",
      lifecycle_status: item.lifecycle_status || "active",
      review_bucket: item.review_bucket || "",
      source_table: item.source_table || "user_listings",
      likely_sold: Boolean(item.likely_sold),
      weak: Boolean(item.weak),
      needs_action: Boolean(item.needs_action),
      missing_image: Boolean(item.missing_image || !item.image_url),
      price_resolved: item.price_resolved !== false,
      price_review_required: Boolean(item.price_review_required),
      price_warning: item.price_warning || "",
      recommended_action: item.recommended_action || "Review listing"
    };
    normalized.primary_review_category = primaryReviewCategory(normalized);
    normalized.health_state = inferHealth(normalized);
    return normalized;
  }

  async function fetchListingsFromApi() {
    if (!NS.api?.apiFetch || !NS.api?.parseJsonSafe) return null;
    try {
      const response = await NS.api.apiFetch("/api/get-user-listings?limit=300&sort=newest", { method: "GET" });
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
        version: "v2_1_review_cleanup",
        issues: [],
        listings: rows.map(normalizeApiListing),
        events: []
      };
    } catch (error) {
      console.warn("[dashboard-listings] api exception:", error);
      return null;
    }
  }

  function getWindowRemotePayload() {
    return [window.__EA_REMOTE_SYNC_PAYLOAD, window.__EA_SYNC_PAYLOAD, window.__EA_LISTING_SYNC, window.__ELEVATE_REMOTE_SYNC].find((x) => x && typeof x === "object") || null;
  }

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
    NS.state.setSyncState?.({
      source: payload.source || "api_get_user_listings",
      confidence: payload.confidence || "synced",
      last_ingest_at: payload.ingested_at || new Date().toISOString(),
      last_reconcile_at: new Date().toISOString(),
      remote_listing_count: Object.keys(registry).length,
      remote_event_count: 0,
      payload_version: payload.version || "v2_1_review_cleanup",
      issues: []
    }, { silent: true, skipPersist: true });
    NS.state.persist?.();
    return true;
  }

  function allRegistryListings() { return Object.values(NS.state?.get?.("listingRegistry", {}) || {}); }
  function activePortfolio() { return allRegistryListings().filter(isActivePortfolioItem); }
  function reviewRows() { return allRegistryListings().filter(isReviewItem); }

  function buildAnalyticsFromRegistry() {
    const all = allRegistryListings();
    const active = activePortfolio();
    const reviews = reviewRows();
    const trackedViews = active.reduce((sum, item) => sum + num(item.views || item.views_count), 0);
    const trackedMessages = active.reduce((sum, item) => sum + num(item.messages || item.messages_count), 0);
    const payload = {
      tracking_summary: {
        total_listings: active.length,
        tracked_views: trackedViews,
        tracked_messages: trackedMessages,
        review_queue_count: reviews.length,
        price_attention_count: reviews.filter((x) => primaryReviewCategory(x) === "price_review").length,
        missing_data_count: reviews.filter((x) => primaryReviewCategory(x) === "missing_data").length,
        likely_sold_count: reviews.filter((x) => primaryReviewCategory(x) === "inventory_missing").length,
        sync_source: "supabase_truth",
        sync_confidence: "synced",
        sync_remote_listing_count: all.length,
        refreshed_at: new Date().toISOString()
      },
      action_queue: [],
      leaders: {}
    };
    NS.state?.setAnalytics?.(payload, { silent: false });
    NS.state?.set?.("tracking.source", "supabase_truth", { silent: true, skipPersist: false });
    return payload;
  }

  function applyHealthToRegistry() {
    allRegistryListings().forEach((item) => {
      const next = { ...item, primary_review_category: primaryReviewCategory(item), health_state: inferHealth(item) };
      NS.state?.upsertListing?.(next, { silent: true, skipEvents: true, skipPersist: true });
    });
  }

  function ingestRemotePayload(payload) {
    if (!payload) return false;
    if (payload.source === "api_get_user_listings") replaceRegistryWithSupabaseTruth(payload);
    else if (NS.state?.applyRemoteSync) NS.state.applyRemoteSync(payload);
    applyHealthToRegistry();
    NS.state?.rebuildFilteredListings?.();
    buildAnalyticsFromRegistry();
    renderHydratedViews();
    return true;
  }

  function applyListingFilter(items) {
    const search = clean(listingUi.search).toLowerCase();
    let out = [...items];
    if (listingUi.filter === "review") out = reviewRows();
    else if (listingUi.filter === "weak") out = activePortfolio().filter(isWeakConversion);
    else if (listingUi.filter === "likely_sold") out = reviewRows().filter((item) => primaryReviewCategory(item) === "inventory_missing");
    else if (listingUi.filter === "needs_action") out = activePortfolio().filter((item) => !!item.needs_action || isPriceReview(item) || isMissingData(item));
    else out = activePortfolio();

    if (search) out = out.filter((item) => [item.title, item.make, item.model, item.vin, item.stock_number].map((v) => clean(v).toLowerCase()).join(" ").includes(search));
    if (listingUi.sort === "newest") out.sort((a, b) => new Date(b.updated_at || b.posted_at || 0) - new Date(a.updated_at || a.posted_at || 0));
    else if (listingUi.sort === "price_high") out.sort((a, b) => num(b.price) - num(a.price));
    else if (listingUi.sort === "price_low") out.sort((a, b) => num(a.price) - num(b.price));
    else out.sort((a, b) => (num(b.messages || b.messages_count) * 1000 + num(b.views || b.views_count)) - (num(a.messages || a.messages_count) * 1000 + num(a.views || a.views_count)));
    return out;
  }

  function cardBadge(item) {
    const cat = primaryReviewCategory(item);
    if (cat === "inventory_missing") return '<span class="badge sold">Inventory Missing</span>';
    if (cat === "price_review") return '<span class="badge warn">Price Review</span>';
    if (cat === "missing_data") return '<span class="badge warn">Missing Data</span>';
    if (item.needs_action) return '<span class="badge warn">Needs Action</span>';
    if (statusLower(item) === "active") return '<span class="badge active">Active</span>';
    return `<span class="badge warn">${clean(item.status || "Tracked")}</span>`;
  }

  function formatPrice(item) {
    const p = clean(item.display_price_text || item.current_price || item.price || "");
    if (item.price_review_required || item.price_resolved === false || /needs review|pending/i.test(p)) return "Price needs review";
    return p || "Price pending";
  }

  function bindListingActions(root = document) {
    root.querySelectorAll("[data-listing-open]").forEach((btn) => {
      if (btn.dataset.boundOpen === "true") return;
      btn.dataset.boundOpen = "true";
      btn.addEventListener("click", () => window.open(btn.getAttribute("data-listing-open"), "_blank", "noopener,noreferrer"));
    });
    root.querySelectorAll("[data-copy-text]").forEach((btn) => {
      if (btn.dataset.boundCopy === "true") return;
      btn.dataset.boundCopy = "true";
      const original = btn.textContent;
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(btn.getAttribute("data-copy-text") || "");
          btn.textContent = "Copied";
          setTimeout(() => { btn.textContent = original; }, 1200);
        } catch {}
      });
    });
  }

  function listingActions(item) {
    const source = clean(item.source_url);
    const marketplace = clean(item.marketplace_url);
    return `<div class="listing-card-actions">${marketplace ? `<button class="action-btn" type="button" data-listing-open="${marketplace}">Open Marketplace</button>` : ""}${source ? `<button class="action-btn" type="button" data-listing-open="${source}">Open Source</button>` : ""}</div>`;
  }

  function listingCard(item) {
    const warning = primaryReviewCategory(item) !== "none";
    return `<article class="listing-card ${warning ? "truth-warning" : ""}" data-hydrated="true"><div class="listing-media">${item.image_url ? `<img src="${item.image_url}" alt="${clean(item.title)}" />` : '<div class="listing-placeholder">Image not synced</div>'}<div class="listing-badge">${cardBadge(item)}</div></div><div class="listing-content"><div><div class="listing-title">${clean(item.title || "Untitled Listing")}</div><div class="listing-sub">${clean(item.stock_number || "")}${item.vin ? ` • ${clean(item.vin)}` : ""}</div></div><div class="listing-price">${formatPrice(item)}</div><div class="listing-truth-row"><span class="listing-truth-chip">${formatMileage(item)}</span><span class="listing-truth-chip">Posted ${formatDate(item.posted_at)}</span><span class="listing-truth-chip">Seen ${formatDate(item.last_seen_at)}</span>${item.price_warning ? `<span class="listing-truth-chip warn">${clean(item.price_warning).split("|")[0].replace(/_/g, " ")}</span>` : ""}</div><div class="listing-metrics"><div class="metric-pill"><div class="metric-pill-label">Views</div><div class="metric-pill-value">${num(item.views || item.views_count)}</div></div><div class="metric-pill"><div class="metric-pill-label">Messages</div><div class="metric-pill-value">${num(item.messages || item.messages_count)}</div></div><div class="metric-pill"><div class="metric-pill-label">Status</div><div class="metric-pill-value">${clean(item.lifecycle_status || item.status || "tracked")}</div></div></div><div class="listing-sub">${clean(item.recommended_action || "Review listing")}</div>${listingActions(item)}</div></article>`;
  }

  const REVIEW_LABELS = {
    all: ["All Review", "Every item that needs operator validation."],
    inventory_missing: ["Inventory Missing", "Posted vehicles no longer confirmed in active inventory."],
    price_review: ["Price Review", "Price or mileage truth requires validation."],
    not_seen: ["Not Seen", "Vehicles not recently confirmed by source data."],
    missing_data: ["Missing Data", "Image, VIN/stock, source, or Marketplace URL is incomplete."],
    weak_conversion: ["Weak Conversion", "Listings with weak pressure or conversion signals."]
  };

  function reviewReason(item) {
    const cat = primaryReviewCategory(item);
    if (cat === "inventory_missing") return "Previously posted vehicle is not confirmed in active inventory. Check source before deleting or keeping live.";
    if (cat === "price_review") return clean(item.price_warning) ? `Price truth issue: ${clean(item.price_warning).split("|")[0].replace(/_/g, " ")}.` : "Price or mileage truth needs verification.";
    if (cat === "missing_data") return "Missing image, VIN/stock, Marketplace URL, source URL, or resolved price.";
    if (cat === "not_seen") return `Not confidently seen recently. Last seen ${formatDate(item.last_seen_at)}.`;
    if (cat === "weak_conversion") return "Weak conversion signal. Review title, photos, pricing, and CTA.";
    return clean(item.recommended_action || "Review listing.");
  }

  function reviewPriority(item) {
    const cat = primaryReviewCategory(item);
    if (cat === "inventory_missing") return "Critical";
    if (cat === "price_review") return "High";
    if (cat === "missing_data" || cat === "not_seen") return "Medium";
    if (cat === "weak_conversion") return "Low";
    return "Review";
  }

  function reviewActionText(item) {
    const cat = primaryReviewCategory(item);
    if (cat === "inventory_missing") return "Open source or Marketplace, then confirm keep/delete.";
    if (cat === "price_review") return "Verify price against source and Marketplace.";
    if (cat === "missing_data") return "Sync missing truth before marking clean.";
    if (cat === "not_seen") return "Check source and confirm availability.";
    if (cat === "weak_conversion") return "Refresh creative, pricing, or CTA.";
    return clean(item.recommended_action || "Review listing.");
  }

  function marketplaceChip(item) {
    return clean(item.marketplace_url) ? '<span class="review-chip gold">Marketplace linked</span>' : '<span class="review-chip">Marketplace URL missing</span>';
  }

  function reviewCard(item) {
    const cat = primaryReviewCategory(item);
    const source = clean(item.source_url);
    const marketplace = clean(item.marketplace_url);
    const vin = clean(item.vin);
    const stock = clean(item.stock_number);
    return `<article class="review-queue-card ${cat === "inventory_missing" ? "critical" : ""}"><div class="review-thumb">${item.image_url ? `<img src="${item.image_url}" alt="${clean(item.title)}" />` : "No image"}</div><div class="review-main"><div class="review-line"><span class="review-title">${clean(item.title || "Listing")}</span><span class="review-chip ${cat === "inventory_missing" ? "critical" : "gold"}">${REVIEW_LABELS[cat]?.[0] || "Review"}</span><span class="review-chip">${reviewPriority(item)}</span>${marketplaceChip(item)}</div><div class="review-meta">${stock || "No stock"}${vin ? ` · ${vin}` : ""} · ${formatPrice(item)} · ${formatMileage(item)}</div><div class="review-reason-compact"><strong>Why:</strong> ${reviewReason(item)} <strong>Next:</strong> ${reviewActionText(item)}</div></div><div class="review-actions-compact">${marketplace ? `<button class="action-btn" type="button" data-listing-open="${marketplace}">Marketplace</button>` : ""}${source ? `<button class="action-btn" type="button" data-listing-open="${source}">Source</button>` : ""}${vin ? `<button class="action-btn" type="button" data-copy-text="${vin}">Copy VIN</button>` : ""}${stock ? `<button class="action-btn" type="button" data-copy-text="${stock}">Copy Stock</button>` : ""}</div><details class="review-details"><summary>Details</summary><div class="review-detail-grid"><div class="review-detail-box"><span>Posted</span><strong>${formatDate(item.posted_at)}</strong></div><div class="review-detail-box"><span>Last Seen</span><strong>${formatDate(item.last_seen_at)}</strong></div><div class="review-detail-box"><span>Age</span><strong>${ageDays(item.posted_at)} days</strong></div><div class="review-detail-box"><span>Source</span><strong>${source ? "Connected" : "Missing"}</strong></div></div></details></article>`;
  }

  function reviewCounts(rows) {
    return {
      all: rows.length,
      inventory_missing: rows.filter((item) => primaryReviewCategory(item) === "inventory_missing").length,
      price_review: rows.filter((item) => primaryReviewCategory(item) === "price_review").length,
      not_seen: rows.filter((item) => primaryReviewCategory(item) === "not_seen").length,
      missing_data: rows.filter((item) => primaryReviewCategory(item) === "missing_data").length,
      weak_conversion: rows.filter((item) => primaryReviewCategory(item) === "weak_conversion").length
    };
  }

  function renderReviewFilters(counts) {
    const keys = ["all", "inventory_missing", "price_review", "not_seen", "missing_data", "weak_conversion"];
    return `<div class="review-filter-row">${keys.map((key) => `<button class="review-filter-btn ${reviewUi.filter === key ? "active" : ""}" type="button" data-review-filter="${key}">${REVIEW_LABELS[key][0]} · ${counts[key] || 0}</button>`).join("")}</div>`;
  }

  function bindReviewFilters(root) {
    root.querySelectorAll("[data-review-filter]").forEach((btn) => {
      if (btn.dataset.boundReviewFilter === "true") return;
      btn.dataset.boundReviewFilter = "true";
      btn.addEventListener("click", () => {
        reviewUi.filter = btn.getAttribute("data-review-filter") || "all";
        renderReviewCenter();
      });
    });
  }

  function renderListingsSection() {
    const mount = document.getElementById("analyticsListingsGrid");
    if (!mount) return;
    const rows = applyListingFilter(activePortfolio());
    const activeCount = activePortfolio().length;
    const statusNode = document.getElementById("analyticsListingsStatus");
    const gridStatus = document.getElementById("analyticsListingsGridStatus");
    const label = listingUi.filter === "all" ? "active portfolio" : listingUi.filter.replace(/_/g, " ");
    if (statusNode) statusNode.textContent = `${label} • ${rows.length} rows available`;
    if (gridStatus) gridStatus.textContent = activeCount ? `${activeCount} active listing row${activeCount === 1 ? "" : "s"} loaded from Supabase truth.` : "No active portfolio rows are available yet.";
    mount.innerHTML = rows.length ? `<div class="listing-grid">${rows.slice(0, 60).map(listingCard).join("")}</div>` : '<div class="listing-empty">No portfolio rows are available for this filter.</div>';
    bindListingActions(mount);
  }

  function renderReviewCenter() {
    const reviewMount = document.getElementById("analyticsReviewQueue");
    const actionMount = document.getElementById("analyticsNeedsActionQueue");
    const priceMount = document.getElementById("analyticsPriceWatchQueue");
    if (!reviewMount && !actionMount && !priceMount) return;

    const rows = reviewRows();
    const counts = reviewCounts(rows);
    const filtered = reviewUi.filter === "all" ? rows : rows.filter((item) => primaryReviewCategory(item) === reviewUi.filter);
    const [activeTitle, activeCopy] = REVIEW_LABELS[reviewUi.filter] || REVIEW_LABELS.all;

    const html = `<div class="review-clean-shell"><div class="review-clean-head"><div><h3>Operator Review Queue</h3><p>One decision surface for inventory missing, price truth, missing data, and weak conversion. Each vehicle appears in one primary bucket only.</p></div><div class="review-clean-kpis"><div class="review-clean-kpi critical"><strong>${counts.inventory_missing}</strong><span>Inventory Missing</span></div><div class="review-clean-kpi"><strong>${counts.price_review}</strong><span>Price Review</span></div><div class="review-clean-kpi"><strong>${counts.not_seen}</strong><span>Not Seen</span></div><div class="review-clean-kpi"><strong>${counts.missing_data}</strong><span>Missing Data</span></div><div class="review-clean-kpi"><strong>${counts.weak_conversion}</strong><span>Weak Conversion</span></div></div></div>${renderReviewFilters(counts)}<section class="review-bucket"><div class="review-bucket-head"><div><div class="review-bucket-title">${activeTitle}</div><div class="review-bucket-copy">${activeCopy}</div></div><div class="review-bucket-count">${filtered.length}</div></div><div class="review-queue">${filtered.length ? filtered.slice(0, 80).map(reviewCard).join("") : '<div class="review-empty">No items in this queue.</div>'}</div></section></div>`;

    if (reviewMount) reviewMount.innerHTML = html;
    if (actionMount) actionMount.innerHTML = "";
    if (priceMount) priceMount.innerHTML = "";

    const reviewPane = document.getElementById("analyticsPaneReview");
    if (reviewPane) {
      reviewPane.querySelectorAll(".card").forEach((card) => {
        if (!card.contains(reviewMount)) card.style.display = "none";
      });
      const grid = reviewPane.querySelector(".ea-analytics-review-grid");
      if (grid) grid.style.display = "block";
    }

    bindReviewFilters(reviewMount || document);
    bindListingActions(reviewMount || document);
  }

  function bindControls() {
    const filterWrap = document.getElementById("analyticsListingQuickFilters");
    const sortSelect = document.getElementById("analyticsListingSortSelect");
    const search = document.getElementById("analyticsListingSearchInput");
    if (filterWrap && filterWrap.dataset.hydratedBindings !== "true") {
      filterWrap.dataset.hydratedBindings = "true";
      const buttons = Array.from(filterWrap.querySelectorAll("button[data-filter]"));
      buttons.forEach((btn) => btn.addEventListener("click", () => {
        listingUi.filter = btn.getAttribute("data-filter") || "all";
        buttons.forEach((b) => b.classList.toggle("active", b === btn));
        renderListingsSection();
        renderReviewCenter();
      }));
    }
    if (sortSelect && sortSelect.dataset.hydratedBindings !== "true") {
      sortSelect.dataset.hydratedBindings = "true";
      sortSelect.addEventListener("change", () => {
        const value = clean(sortSelect.value || "").toLowerCase();
        if (value.includes("new")) listingUi.sort = "newest";
        else if (value.includes("price_high")) listingUi.sort = "price_high";
        else if (value.includes("price_low")) listingUi.sort = "price_low";
        else listingUi.sort = "popular";
        renderListingsSection();
      });
    }
    if (search && search.dataset.hydratedBindings !== "true") {
      search.dataset.hydratedBindings = "true";
      search.addEventListener("input", () => {
        listingUi.search = search.value || "";
        renderListingsSection();
      });
    }
  }

  function renderHydratedViews() {
    injectStyle();
    renderListingsSection();
    renderReviewCenter();
    bindControls();
  }

  async function hydrateListings() {
    injectStyle();
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
    renderHydratedViews();
    return false;
  }

  function bindRefresh() {
    const btn = document.getElementById("refreshListingsBtn");
    if (!btn || btn.dataset.packageFBound === "true") return;
    btn.dataset.packageFBound = "true";
    btn.addEventListener("click", async () => {
      await hydrateListings();
      window.dispatchEvent(new CustomEvent("elevate:tracking-refreshed"));
    });
  }

  async function boot() {
    injectStyle();
    await hydrateListings();
    bindRefresh();
    setTimeout(() => { hydrateListings(); }, 1200);
    setTimeout(() => {
      const payload = getWindowRemotePayload();
      if (payload) ingestRemotePayload(payload);
    }, 3200);
  }

  window.addEventListener("elevate:remote-sync", (event) => { if (event?.detail) ingestRemotePayload(event.detail); });
  window.addEventListener("elevate:tracking-refreshed", renderHydratedViews);
  window.addEventListener("elevate:analytics-workspace-mounted", renderHydratedViews);

  NS.listings = { buildAnalyticsFromRegistry, ingestRemotePayload, hydrateListings, renderHydratedViews };
  NS.modules = NS.modules || {};
  NS.modules.listings = true;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { boot(); }, { once: true });
  else boot();
})();
