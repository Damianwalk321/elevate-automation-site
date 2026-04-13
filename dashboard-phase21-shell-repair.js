
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  const MODULE_KEY = "phase21shell";
  const STYLE_ID = "ea-phase23-lifecycle-pricing";
  const SECTION_LISTINGS = "listings";
  const SECTION_REVIEW = "review_center";

  if (NS.modules?.[MODULE_KEY]) delete NS.modules[MODULE_KEY];

  const state = {
    listingsCache: [],
    listingsSource: "none",
    observerBound: false,
    renderTimer: null,
    shellBound: false,
    navBound: false,
    hydrationBound: false,
    activeListingsFilter: "all",
    activePortfolioTab: "active",
    pendingActions: {}
  };

  const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const cloneRows = (rows) => Array.isArray(rows) ? rows.map((r) => ({ ...r })) : [];
  const getSummary = () => window.dashboardSummary || {};
  const titleKey = (t) => clean(t).toLowerCase();

  function n(v) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const raw = String(v ?? "").replace(/,/g, "").trim();
    const match = raw.match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function nonEmpty(...values) {
    for (const value of values) {
      const out = clean(value);
      if (out) return out;
    }
    return "";
  }

  function placeholderVehicleImage(label) {
    return `https://placehold.co/800x500/111111/d4af37?text=${encodeURIComponent(clean(label || "Vehicle"))}`;
  }

  function formatCurrency(value) {
    const amount = n(value);
    if (!amount) return "$0";
    try {
      return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(amount);
    } catch {
      return `$${amount.toLocaleString()}`;
    }
  }

  function formatShortDate(value) {
    const d = new Date(value || "");
    if (!Number.isFinite(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function formatRelative(value) {
    const d = new Date(value || "");
    if (!Number.isFinite(d.getTime())) return "—";
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatShortDate(value);
  }

  function inferLifecycleFromText(text) {
    const raw = clean(text).toLowerCase();
    if (/review delete|likely sold|sold/.test(raw)) return "review_delete";
    if (/review price|price review/.test(raw)) return "review_price_update";
    if (/review new/.test(raw)) return "review_new";
    if (/stale/.test(raw)) return "stale";
    return raw || "active";
  }

  function inferCanonicalKey(row = {}) {
    const vin = clean(row.vin || "");
    if (vin) return `vin:${vin.toLowerCase()}`;
    const stock = clean(row.stock_number || row.stockNumber || "");
    if (stock) return `stock:${stock.toLowerCase()}`;
    const listingId = clean(row.marketplace_listing_id || row.listing_id || row.id || "");
    if (listingId && !/^overview_|^top_|^summary_/i.test(listingId)) return `listing:${listingId.toLowerCase()}`;
    const url = clean(row.source_url || row.url || "");
    if (url) return `url:${url.toLowerCase()}`;
    const title = clean(row.title || [row.year, row.make, row.model, row.trim].filter(Boolean).join(" "));
    const year = clean(row.year || "");
    const make = clean(row.make || "");
    const model = clean(row.model || "");
    return `title:${[year, make, model, title].filter(Boolean).join("|").toLowerCase()}`;
  }

  function pickPrice(row = {}) {
    const candidates = [
      row.current_price,
      row.price,
      row.asking_price,
      row.list_price,
      row.sale_price,
      row.marketplace_price,
      row.display_price,
      row.price_amount,
      row.currentPrice,
      row.listPrice,
      row.askingPrice
    ];
    for (const value of candidates) {
      const amount = n(value);
      if (amount > 0) return amount;
    }
    return 0;
  }

  function pricePriorityForSource(source) {
    if (source === "summary_recent") return 400;
    if (source === "global_rows") return 300;
    if (source === "overview_dom") return 200;
    if (source === "top_dom") return 100;
    return 0;
  }

  function rowPriorityForSource(source) {
    if (source === "summary_recent") return 40;
    if (source === "global_rows") return 30;
    if (source === "overview_dom") return 20;
    if (source === "top_dom") return 10;
    return 0;
  }

  function normalizeRow(row = {}, source = "unknown") {
    const title = clean(row.title || [row.year, row.make, row.model, row.trim].filter(Boolean).join(" ")) || "Vehicle Listing";
    const lifecycle = clean(row.lifecycle_status || row.review_status || row.review_bucket || "").toLowerCase();
    const status = clean(row.status || "active").toLowerCase();
    const reviewBucket = clean(row.review_bucket || "").toLowerCase();
    const likelySold = Boolean(row.likely_sold) || lifecycle === "review_delete";
    const weak = Boolean(row.weak) || status === "stale";
    const needsAction = Boolean(row.needs_action) || ["review_delete", "review_price_update", "review_new", "stale"].includes(lifecycle);
    const canonicalKey = inferCanonicalKey(row);

    return {
      id: clean(row.id || row.marketplace_listing_id || row.source_url || row.vin || row.stock_number || titleKey(title) || `row_${Math.random().toString(36).slice(2, 10)}`),
      canonical_key: canonicalKey,
      title,
      image_url: clean(row.image_url || row.cover_photo || row.photo || row.coverImage || row.thumb || ""),
      year: clean(row.year || ""),
      make: clean(row.make || ""),
      model: clean(row.model || ""),
      trim: clean(row.trim || ""),
      vin: clean(row.vin || ""),
      stock_number: clean(row.stock_number || row.stockNumber || ""),
      body_style: clean(row.body_style || row.bodyStyle || ""),
      price: pickPrice(row),
      price_source: source,
      price_priority: pricePriorityForSource(source),
      mileage: n(row.mileage || row.km || row.kilometers),
      views_count: n(row.views_count || row.views),
      messages_count: n(row.messages_count || row.messages),
      age_days: n(row.age_days),
      status,
      lifecycle_status: lifecycle,
      review_bucket: reviewBucket,
      likely_sold: likelySold,
      weak,
      needs_action: needsAction,
      recommended_action: clean(row.recommended_action || ""),
      pricing_insight: clean(row.pricing_insight || ""),
      health_label: clean(row.health_label || ""),
      popularity_score: n(row.popularity_score || (n(row.messages_count || row.messages) * 1000) + (n(row.views_count || row.views) * 10)),
      posted_at: row.posted_at || row.created_at || row.updated_at || "",
      updated_at: row.updated_at || row.posted_at || row.created_at || "",
      last_seen_at: row.last_seen_at || row.updated_at || row.posted_at || "",
      source_url: clean(row.source_url || ""),
      row_source: source,
      row_priority: rowPriorityForSource(source)
    };
  }

  function rowsFromGlobal() {
    return cloneRows(window.dashboardListings).filter(Boolean).map((r) => normalizeRow(r, "global_rows")).filter((r) => r.title);
  }

  function rowsFromSummary() {
    return cloneRows(getSummary().recent_listings).filter(Boolean).map((r) => normalizeRow(r, "summary_recent")).filter((r) => r.title);
  }

  function rowsFromTopDom() {
    const wrap = document.getElementById("topListings");
    if (!wrap) return [];
    return qsa(".top-list-item", wrap).map((item, index) => {
      const title = clean(item.querySelector(".top-title")?.textContent || "");
      const sub = clean(item.querySelector(".top-sub")?.textContent || "");
      const img = item.querySelector("img")?.getAttribute("src") || "";
      const metricsText = clean(item.querySelector(".top-metrics")?.textContent || "");
      const priceMatch = sub.match(/\$[\d,]+/);
      return normalizeRow({
        id: `top_${index}_${titleKey(title) || "listing"}`,
        title,
        image_url: img && !img.includes("placehold.co") ? img : placeholderVehicleImage(title),
        price: priceMatch ? n(priceMatch[0].replace(/[^\d.-]/g, "")) : 0,
        views_count: n((metricsText.match(/👁\s*([\d,]+)/) || [])[1]?.replace(/,/g, "")),
        messages_count: n((metricsText.match(/💬\s*([\d,]+)/) || [])[1]?.replace(/,/g, "")),
        health_label: "Top Listing"
      }, "top_dom");
    }).filter((r) => r.title);
  }

  function rowsFromOverviewDom() {
    const grid = document.getElementById("recentListingsGrid");
    if (!grid) return [];
    return qsa(".listing-card", grid).map((card, index) => {
      const title = clean(card.querySelector(".listing-title")?.textContent || "");
      const sub = clean(card.querySelector(".listing-sub")?.textContent || "");
      const priceText = clean(card.querySelector(".listing-price")?.textContent || "");
      const noteText = qsa(".listing-note", card).map((el) => clean(el.textContent || "")).join(" | ");
      const badge = clean(card.querySelector(".listing-badge")?.textContent || "");
      const img = card.querySelector("img")?.getAttribute("src") || "";
      let views = 0;
      let messages = 0;
      let ageDays = 0;
      qsa(".metric-pill", card).forEach((pill) => {
        const label = clean(pill.querySelector(".metric-pill-label")?.textContent || "").toLowerCase();
        const value = clean(pill.querySelector(".metric-pill-value")?.textContent || "");
        if (label === "views") views = n(value);
        if (label === "messages") messages = n(value);
        if (label === "age") ageDays = n(value);
      });
      const stockMatch = sub.match(/Stock\s+([^\s•]+)/i);
      const vinMatch = sub.match(/VIN\s+([^\s•]+)/i);
      return normalizeRow({
        id: `overview_${index}_${titleKey(title) || "listing"}`,
        title,
        image_url: img && !img.includes("placehold.co") ? img : placeholderVehicleImage(title),
        stock_number: stockMatch ? stockMatch[1] : "",
        vin: vinMatch ? vinMatch[1] : "",
        body_style: sub.includes("•") ? clean(sub.split("•").slice(-1)[0]) : "",
        price: n(priceText.replace(/[^\d.-]/g, "")),
        views_count: views,
        messages_count: messages,
        age_days: ageDays,
        lifecycle_status: inferLifecycleFromText(`${badge} ${noteText}`),
        recommended_action: noteText,
        pricing_insight: noteText,
        health_label: /high performer/i.test(noteText) ? "High Performer" : (/needs action/i.test(noteText) ? "Needs Action" : ""),
        likely_sold: /review delete|likely sold|sold/i.test(`${badge} ${noteText}`),
        weak: /weak/i.test(noteText),
        needs_action: /needs action|review/i.test(noteText)
      }, "overview_dom");
    }).filter((r) => r.title);
  }

  function mergeRows(rowsBySource) {
    const map = new Map();

    for (const row of rowsBySource.flat()) {
      const key = clean(row.canonical_key || row.id || row.title).toLowerCase();
      if (!key) continue;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...row });
        continue;
      }

      const merged = { ...existing };

      if (row.row_priority > existing.row_priority) {
        merged.row_source = row.row_source;
        merged.row_priority = row.row_priority;
      }

      if (row.price > 0 && (existing.price <= 0 || row.price_priority > existing.price_priority)) {
        merged.price = row.price;
        merged.price_source = row.price_source;
        merged.price_priority = row.price_priority;
      }

      for (const field of ["title", "year", "make", "model", "trim", "vin", "stock_number", "body_style", "source_url"]) {
        if (!clean(merged[field]) && clean(row[field])) merged[field] = row[field];
      }
      if (!clean(merged.image_url) && clean(row.image_url)) merged.image_url = row.image_url;

      merged.views_count = Math.max(n(existing.views_count), n(row.views_count));
      merged.messages_count = Math.max(n(existing.messages_count), n(row.messages_count));
      merged.popularity_score = Math.max(n(existing.popularity_score), n(row.popularity_score));
      merged.age_days = n(existing.age_days) || n(row.age_days);

      if (!clean(merged.lifecycle_status) && clean(row.lifecycle_status)) merged.lifecycle_status = row.lifecycle_status;
      if (!clean(merged.review_bucket) && clean(row.review_bucket)) merged.review_bucket = row.review_bucket;
      merged.likely_sold = Boolean(existing.likely_sold || row.likely_sold);
      merged.weak = Boolean(existing.weak || row.weak);
      merged.needs_action = Boolean(existing.needs_action || row.needs_action);

      if (!clean(merged.recommended_action) && clean(row.recommended_action)) merged.recommended_action = row.recommended_action;
      if (!clean(merged.pricing_insight) && clean(row.pricing_insight)) merged.pricing_insight = row.pricing_insight;
      if (!clean(merged.health_label) && clean(row.health_label)) merged.health_label = row.health_label;

      merged.posted_at = nonEmpty(existing.posted_at, row.posted_at);
      merged.updated_at = nonEmpty(existing.updated_at, row.updated_at);
      merged.last_seen_at = nonEmpty(existing.last_seen_at, row.last_seen_at);

      map.set(key, merged);
    }

    return Array.from(map.values());
  }

  function applyPendingOverlays(rows) {
    return rows.map((row) => {
      const overlay = state.pendingActions[row.canonical_key] || state.pendingActions[row.id];
      if (!overlay) return row;
      const next = { ...row, ...overlay };
      if (overlay._resolvedAt) next.health_label = clean(next.health_label || "Updated");
      return next;
    });
  }

  function resolveCanonicalListings() {
    const summaryRows = rowsFromSummary();
    const globalRows = rowsFromGlobal();
    const overviewRows = rowsFromOverviewDom();
    const topRows = rowsFromTopDom();

    let rows = [];
    if (summaryRows.length || globalRows.length || overviewRows.length || topRows.length) {
      rows = mergeRows([summaryRows, globalRows, overviewRows, topRows]);
      state.listingsSource = summaryRows.length ? "summary_recent" : (globalRows.length ? "global_rows" : (overviewRows.length ? "overview_dom" : "top_dom"));
    } else {
      state.listingsSource = "none";
    }

    rows = applyPendingOverlays(rows);
    rows.sort((a, b) => n(b.popularity_score) - n(a.popularity_score));
    return rows;
  }

  function syncCanonicalListings() {
    const rows = resolveCanonicalListings();
    if (rows.length) {
      state.listingsCache = rows;
      window.dashboardListings = cloneRows(rows);
      window.filteredListings = cloneRows(rows);
    } else if (state.listingsCache.length) {
      window.dashboardListings = cloneRows(state.listingsCache);
      window.filteredListings = cloneRows(state.listingsCache);
    }
    return cloneRows(window.dashboardListings || state.listingsCache);
  }

  function getListings() {
    const synced = syncCanonicalListings();
    return Array.isArray(synced) ? synced : [];
  }

  function urgencyLevel(item) {
    const life = clean(item.lifecycle_status || item.review_bucket || item.status || "").toLowerCase();
    if (item.likely_sold || life === "review_delete") return "critical";
    if (item.needs_action || life === "review_price_update") return "high";
    if (item.weak || life === "review_new" || life === "stale") return "medium";
    return "normal";
  }

  function urgencyLabel(item) {
    const level = urgencyLevel(item);
    if (level === "critical") return "Act now";
    if (level === "high") return "High priority";
    if (level === "medium") return "Review soon";
    return "Stable";
  }

  function primaryAction(item) {
    const life = clean(item.lifecycle_status || "").toLowerCase();
    if (item.likely_sold || life === "review_delete") return "Mark sold or confirm active";
    if (life === "review_price_update" || /price/i.test(clean(item.pricing_insight || ""))) return "Review price";
    if (item.weak) return "Refresh positioning";
    if (item.needs_action) return "Inspect and decide";
    return "Keep live";
  }

  function getOverviewMetrics() {
    const rows = getListings();
    const reviewRows = rows.filter((item) => Boolean(item.needs_action) || Boolean(item.weak) || Boolean(item.likely_sold) || ["review_delete", "review_price_update", "review_new", "stale"].includes(clean(item.lifecycle_status).toLowerCase()));
    const activeRows = rows.filter((item) => !["sold", "deleted", "inactive"].includes(clean(item.status).toLowerCase()));
    const likelySold = rows.filter((item) => item.likely_sold || clean(item.lifecycle_status) === "review_delete").length;
    const weak = rows.filter((item) => item.weak).length;
    const top = [...rows].sort((a, b) => n(b.popularity_score) - n(a.popularity_score))[0] || null;
    return {
      live: activeRows.length,
      review: reviewRows.length,
      likelySold,
      weak,
      topTitle: clean(top?.title || "No top listing yet"),
      topAction: top ? primaryAction(top) : "Complete setup, queue inventory, and post the first vehicle.",
      topPrice: top ? formatCurrency(top.price) : "$0"
    };
  }

  function buildPortfolioBuckets(rows) {
    return {
      active: rows.filter((item) => !["sold", "deleted", "inactive"].includes(item.status) && item.lifecycle_status !== "review_delete"),
      review: rows.filter((item) => ["review_delete", "review_price_update", "review_new", "stale"].includes(item.lifecycle_status) || item.needs_action),
      price_watch: rows.filter((item) => item.lifecycle_status === "review_price_update" || /price/i.test(item.pricing_insight || "") || item.price <= 0),
      stale_sold: rows.filter((item) => item.lifecycle_status === "review_delete" || item.status === "stale" || item.likely_sold),
      sold_archived: rows.filter((item) => ["sold", "deleted", "inactive"].includes(item.status))
    };
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `.phase23-eyebrow{color:var(--gold);font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px}.phase23-statusline{color:var(--gold-soft);font-size:12px;margin:2px 0 10px}.phase23-overview-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin:14px 0 16px}.phase23-command-card,.phase23-priority-card,.phase23-setup-module{padding:18px}.phase23-command-title{font-size:28px;font-weight:900;line-height:1.06;margin-bottom:8px}.phase23-command-sub,.phase23-priority-copy{color:var(--muted);font-size:13px;line-height:1.5}.phase23-kpi-row,.phase23-setup-grid,.phase23-actiongrid,.phase23-metricrow,.phase23-mini-row,.phase23-jumpbar{display:grid;gap:10px}.phase23-kpi-row{grid-template-columns:repeat(4,minmax(0,1fr))}.phase23-kpi,.phase23-setup-module,.phase23-mini-card{background:#161616;border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:12px}.phase23-kpi-label,.phase23-mini-label,.phase23-setup-label{color:var(--gold);font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin-bottom:6px}.phase23-kpi-value,.phase23-mini-value{font-size:22px;font-weight:800;line-height:1.1}.phase23-priority-title{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);font-weight:700}.phase23-priority-headline{font-size:22px;font-weight:800;line-height:1.15}.phase23-priority-chiprow,.phase23-chipstack,.phase23-queue-meta,.phase23-portfolio-tabs,.phase23-portfolio-actions{display:flex;gap:8px;flex-wrap:wrap}.phase23-jumpbar{grid-template-columns:repeat(4,minmax(0,1fr));margin:12px 0 16px}.phase23-jumpbar .action-btn{min-height:46px}.phase23-toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px;flex-wrap:wrap}.phase23-toolbar-left,.phase23-toolbar-right{display:flex;gap:8px;flex-wrap:wrap}.phase23-toolbar input,.phase23-toolbar select{min-width:220px;background:#1a1a1a;color:#f5f5f5;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:11px 13px}.phase23-chip{display:inline-flex;align-items:center;min-height:26px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.08);background:#101010;color:#f1f1f1}.phase23-chip.critical{background:rgba(120,20,20,.9);color:#ffd3d3;border-color:rgba(255,120,120,.24)}.phase23-chip.high{background:rgba(212,175,55,.18);color:#f3ddb0;border-color:rgba(212,175,55,.24)}.phase23-chip.medium{background:rgba(80,80,80,.95);color:#f2f2f2;border-color:rgba(255,255,255,.14)}.phase23-listing-card{border-radius:16px;overflow:hidden}.phase23-listing-card .listing-media{height:165px;position:relative}.phase23-chiprow{position:absolute;left:10px;right:10px;top:10px;display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.phase23-cardbody{padding:14px;display:grid;gap:8px}.phase23-title{font-size:18px;font-weight:800;line-height:1.2}.phase23-sub{color:var(--muted);font-size:12px;line-height:1.45}.phase23-pricerow{display:flex;justify-content:space-between;align-items:flex-end;gap:10px}.phase23-price{font-size:24px;font-weight:800;color:var(--gold-soft);line-height:1.1}.phase23-primaryaction{font-size:12px;font-weight:800;color:var(--gold-soft);text-align:right}.phase23-metricrow{grid-template-columns:repeat(4,minmax(0,1fr))}.phase23-metric{background:#171717;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:9px 10px}.phase23-metric-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--gold);margin-bottom:4px;font-weight:700}.phase23-metric-value{font-size:13px;font-weight:700;color:#f0f0f0}.phase23-reason{background:rgba(212,175,55,.06);border:1px solid rgba(212,175,55,.14);border-radius:12px;padding:10px 11px}.phase23-reason-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--gold);margin-bottom:4px;font-weight:700}.phase23-reason-copy{font-size:12px;color:#f0e6cc;line-height:1.45}.phase23-mini-row{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:14px}.phase23-queue-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:16px}.phase23-queue{display:grid;gap:10px}.phase23-queue-item{display:grid;gap:8px;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.06)}.phase23-queue-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.phase23-queue-title{font-weight:800;line-height:1.3}.phase23-queue-sub{color:var(--muted);font-size:13px;line-height:1.45}.phase23-empty{padding:22px;text-align:center;color:var(--muted);border:1px dashed rgba(212,175,55,.18);border-radius:14px;background:#111}.phase23-setup-grid{grid-template-columns:repeat(3,minmax(0,1fr));margin:14px 0 16px}.phase23-setup-title{font-size:18px;font-weight:800;line-height:1.2;margin-bottom:8px}.phase23-setup-copy{color:var(--muted);font-size:13px;line-height:1.45;margin-bottom:10px}.phase23-setup-list{display:grid;gap:8px}.phase23-setup-item{display:flex;justify-content:space-between;gap:10px;align-items:center;background:#171717;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:10px 12px}.phase23-setup-item span:last-child{color:var(--gold-soft);font-weight:700}.phase23-overview-demoted{opacity:.86}.phase23-portfolio-shell{display:grid;gap:12px}.phase23-portfolio-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.phase23-portfolio-row{display:grid;grid-template-columns:92px 1fr auto;gap:12px;padding:12px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.06);align-items:center}.phase23-portfolio-thumb{width:92px;height:70px;border-radius:10px;overflow:hidden;background:#111}.phase23-portfolio-thumb img{width:100%;height:100%;object-fit:cover}.phase23-portfolio-main{display:grid;gap:6px}.phase23-portfolio-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.phase23-portfolio-title{font-weight:800;line-height:1.25}.phase23-portfolio-sub{font-size:12px;color:var(--muted);line-height:1.45}.phase23-portfolio-stats{display:flex;gap:6px;flex-wrap:wrap}.phase23-portfolio-actions{justify-content:flex-end}.phase23-result-banner{padding:10px 12px;border-radius:12px;background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.16);color:#f3ddb0;font-size:12px}@media (max-width:1100px){.phase23-overview-grid,.phase23-queue-grid,.phase23-mini-row,.phase23-jumpbar,.phase23-actiongrid,.phase23-metricrow,.phase23-kpi-row,.phase23-setup-grid,.phase23-portfolio-grid{grid-template-columns:1fr 1fr}}@media (max-width:760px){.phase23-toolbar{flex-direction:column;align-items:stretch}.phase23-toolbar input,.phase23-toolbar select{min-width:100%;width:100%}.phase23-overview-grid,.phase23-queue-grid,.phase23-mini-row,.phase23-jumpbar,.phase23-actiongrid,.phase23-metricrow,.phase23-kpi-row,.phase23-setup-grid,.phase23-portfolio-grid{grid-template-columns:1fr}.phase23-portfolio-row{grid-template-columns:1fr}.phase23-portfolio-actions{justify-content:flex-start}}`;
    document.head.appendChild(style);
  }

  function ensureNavButtons() {
    const nav = qs(".sidebar-nav");
    if (!nav) return;
    const placeBefore = nav.querySelector('[data-section="tools"]') || null;
    if (!nav.querySelector(`[data-section="${SECTION_LISTINGS}"]`)) {
      const btn = document.createElement("button");
      btn.className = "nav-btn";
      btn.type = "button";
      btn.setAttribute("data-section", SECTION_LISTINGS);
      btn.textContent = "Listings";
      nav.insertBefore(btn, placeBefore);
    }
    if (!nav.querySelector(`[data-section="${SECTION_REVIEW}"]`)) {
      const btn = document.createElement("button");
      btn.className = "nav-btn";
      btn.type = "button";
      btn.setAttribute("data-section", SECTION_REVIEW);
      btn.textContent = "Review Center";
      nav.insertBefore(btn, placeBefore);
    }
  }

  function sectionShell(id, title, subtitle) {
    const section = document.createElement("section");
    section.id = id;
    section.className = "dashboard-section";
    section.innerHTML = `<div class="card"><div class="phase23-eyebrow">${title}</div><h2>${title}</h2><div class="subtext">${subtitle}</div></div>`;
    return section;
  }

  function ensureSections() {
    const mainInner = qs(".main-inner");
    if (!mainInner) return;

    if (!document.getElementById(SECTION_LISTINGS)) {
      const listings = sectionShell(SECTION_LISTINGS, "Listings", "Cleaner portfolio cards with stronger price, urgency, and next-action hierarchy.");
      listings.insertAdjacentHTML("beforeend", `<div class="phase23-toolbar card"><div class="phase23-toolbar-left"><button class="action-btn active" type="button" data-phase23-filter="all">All</button><button class="action-btn" type="button" data-phase23-filter="active">Active</button><button class="action-btn" type="button" data-phase23-filter="review">Review</button><button class="action-btn" type="button" data-phase23-filter="weak">Weak</button><button class="action-btn" type="button" data-phase23-filter="likely_sold">Likely Sold</button><button class="action-btn" type="button" data-phase23-filter="needs_action">Needs Action</button></div><div class="phase23-toolbar-right"><select id="phase23ListingsSort"><option value="popular">Sort: Most Popular</option><option value="newest">Sort: Newest</option><option value="price_high">Sort: Price High → Low</option><option value="price_low">Sort: Price Low → High</option></select><input id="phase23ListingsSearch" type="text" placeholder="Search make, model, VIN, stock..." /></div></div><div id="phase23ListingsBanner"></div><div id="phase23ListingsStatus" class="phase23-statusline"></div><div id="phase23ListingsGrid" class="listing-grid"></div>`);
      mainInner.appendChild(listings);
    }

    if (!document.getElementById(SECTION_REVIEW)) {
      const review = sectionShell(SECTION_REVIEW, "Review Center", "Sharper triage cards with clearer urgency, reason, and dominant next move.");
      review.insertAdjacentHTML("beforeend", `<div class="phase23-mini-row"><div class="phase23-mini-card"><div class="phase23-mini-label">Review Queue</div><div id="phase23ReviewQueue" class="phase23-mini-value">0</div></div><div class="phase23-mini-card"><div class="phase23-mini-label">Likely Sold</div><div id="phase23LikelySold" class="phase23-mini-value">0</div></div><div class="phase23-mini-card"><div class="phase23-mini-label">Weak Listings</div><div id="phase23WeakListings" class="phase23-mini-value">0</div></div><div class="phase23-mini-card"><div class="phase23-mini-label">Promote Now</div><div id="phase23PromoteNow" class="phase23-mini-value">0</div></div></div><div id="phase23ReviewStatus" class="phase23-statusline"></div><div class="phase23-queue-grid"><div class="card"><div class="section-head"><h2>Needs Attention</h2></div><div id="phase23NeedsAttention" class="phase23-queue"></div></div><div class="card"><div class="section-head"><h2>Today</h2></div><div id="phase23TodayQueue" class="phase23-queue"></div></div><div class="card"><div class="section-head"><h2>Price Watch</h2></div><div id="phase23PriceQueue" class="phase23-queue"></div></div><div class="card"><div class="section-head"><h2>Likely Sold / Stale</h2></div><div id="phase23StaleQueue" class="phase23-queue"></div></div></div><div class="card"><div class="section-head"><div><h2>Priority Review Cards</h2><div class="subtext">Triage-first cards using the same canonical portfolio rows.</div></div></div><div id="phase23ReviewCards" class="listing-grid"></div></div>`);
      mainInner.appendChild(review);
    }
  }

  function ensureOverviewCommandCenter() {
    const overview = document.getElementById("overview");
    if (!overview) return;
    const metrics = getOverviewMetrics();
    if (!overview.querySelector("#phase23OverviewCommandCenter")) {
      const block = document.createElement("div");
      block.id = "phase23OverviewCommandCenter";
      block.className = "phase23-overview-grid";
      block.innerHTML = `<div class="card phase23-command-card"><div class="phase23-eyebrow">Command Center</div><div class="phase23-command-title">Run the portfolio. Clear the next pressure point.</div><div class="phase23-command-sub">Lead from live portfolio pressure, review volume, and top opportunity instead of setup-first messaging.</div><div class="phase23-kpi-row"><div class="phase23-kpi"><div class="phase23-kpi-label">Live Portfolio</div><div id="phase23LiveKpi" class="phase23-kpi-value">0</div></div><div class="phase23-kpi"><div class="phase23-kpi-label">Review Pressure</div><div id="phase23ReviewKpi" class="phase23-kpi-value">0</div></div><div class="phase23-kpi"><div class="phase23-kpi-label">Likely Sold</div><div id="phase23SoldKpi" class="phase23-kpi-value">0</div></div><div class="phase23-kpi"><div class="phase23-kpi-label">Weak Listings</div><div id="phase23WeakKpi" class="phase23-kpi-value">0</div></div></div></div><div class="card phase23-priority-card"><div class="phase23-priority-title">Next best move</div><div id="phase23PriorityHeadline" class="phase23-priority-headline">Inspect the top listing and clear the next action.</div><div id="phase23PriorityCopy" class="phase23-priority-copy">This panel should hold the highest-leverage move.</div><div class="phase23-priority-chiprow"><span id="phase23PriorityPrice" class="phase23-chip">$0</span><span class="phase23-chip">Command center live</span></div><div class="phase23-actiongrid"><button class="action-btn" type="button" data-phase23-open="${SECTION_LISTINGS}">Open Listings</button><button class="action-btn" type="button" data-phase23-open="${SECTION_REVIEW}">Open Review Center</button><button class="action-btn" type="button" data-phase23-open="tools">Open Analytics</button></div></div>`;
      const anchor = overview.firstElementChild;
      if (anchor?.insertAdjacentElement) anchor.insertAdjacentElement("afterend", block);
      else overview.prepend(block);
    }
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
    setText("phase23LiveKpi", metrics.live);
    setText("phase23ReviewKpi", metrics.review);
    setText("phase23SoldKpi", metrics.likelySold);
    setText("phase23WeakKpi", metrics.weak);
    setText("phase23PriorityHeadline", metrics.topTitle);
    setText("phase23PriorityCopy", metrics.topAction);
    setText("phase23PriorityPrice", metrics.topPrice);
  }

  function ensureSetupModules() {
    const profile = document.getElementById("profile");
    if (!profile) return;
    if (!profile.querySelector("#phase23SetupModules")) {
      const modules = document.createElement("div");
      modules.id = "phase23SetupModules";
      modules.className = "phase23-setup-grid";
      modules.innerHTML = `<div class="phase23-setup-module"><div class="phase23-setup-label">Profile</div><div class="phase23-setup-title">Operator identity</div><div class="phase23-setup-copy">Contact, dealer, and personal operator details.</div><div class="phase23-setup-list"><div class="phase23-setup-item"><span>Name / dealer</span><span id="phase23SetupProfileStatus">In progress</span></div><div class="phase23-setup-item"><span>Phone / email</span><span id="phase23SetupContactStatus">In progress</span></div></div></div><div class="phase23-setup-module"><div class="phase23-setup-label">Posting</div><div class="phase23-setup-title">Inventory readiness</div><div class="phase23-setup-copy">Dealer website, inventory URL, scanner type, and post location.</div><div class="phase23-setup-list"><div class="phase23-setup-item"><span>Website / inventory</span><span id="phase23SetupInventoryStatus">Missing</span></div><div class="phase23-setup-item"><span>Scanner / location</span><span id="phase23SetupScannerStatus">Missing</span></div></div></div><div class="phase23-setup-module"><div class="phase23-setup-label">Compliance</div><div class="phase23-setup-title">Publish readiness</div><div class="phase23-setup-copy">Province, compliance mode, and required publishing details.</div><div class="phase23-setup-list"><div class="phase23-setup-item"><span>Province / mode</span><span id="phase23SetupComplianceStatus">Needs setup</span></div><div class="phase23-setup-item"><span>License / dealer fields</span><span id="phase23SetupDealerStatus">Needs setup</span></div></div></div>`;
      const anchor = profile.firstElementChild;
      if (anchor?.insertAdjacentElement) anchor.insertAdjacentElement("afterend", modules);
      else profile.prepend(modules);
    }
  }

  function patchOverview() {
    const overview = document.getElementById("overview");
    if (!overview) return;
    ensureOverviewCommandCenter();

    let setupCard = null;
    qsa("#overview .card").forEach((card) => {
      const heading = clean(card.querySelector("h2")?.textContent || "");
      if (/complete setup to unlock first-post value|operator snapshot and next actions|action priorities and lifecycle pressure|setup and readiness/i.test(heading)) setupCard = card;
    });

    if (setupCard) {
      setupCard.classList.add("phase23-overview-demoted");
      const heading = setupCard.querySelector("h2");
      if (heading) heading.textContent = "Setup and readiness";
      const sub = setupCard.querySelector(".subtext, p");
      if (sub) sub.textContent = "Keep required setup visible, but let it support the command center instead of leading the page.";
    }

    if (!overview.querySelector("#phase23OverviewJumpbar")) {
      const target = document.getElementById("phase23OverviewCommandCenter") || setupCard || overview.firstElementChild;
      const wrap = document.createElement("div");
      wrap.id = "phase23OverviewJumpbar";
      wrap.className = "phase23-jumpbar";
      wrap.innerHTML = `<button class="action-btn" type="button" data-phase23-open="${SECTION_LISTINGS}">Open Listings</button><button class="action-btn" type="button" data-phase23-open="${SECTION_REVIEW}">Open Review Center</button><button class="action-btn" type="button" data-phase23-open="tools">Open Analytics</button><button class="action-btn" type="button" data-phase23-open="profile">Open Setup</button>`;
      if (target?.insertAdjacentElement) target.insertAdjacentElement("afterend", wrap);
      else overview.prepend(wrap);
    }
  }

  function buildLifecycleBadge(item) { return `<span class="phase23-chip">${clean(item.lifecycle_status || item.review_bucket || item.status || "active").replace(/_/g, " ") || "active"}</span>`; }
  function buildUrgencyChip(item) { const level = urgencyLevel(item); return `<span class="phase23-chip ${level}">${urgencyLabel(item)}</span>`; }

  function buildResultBanner() {
    const entries = Object.values(state.pendingActions).filter((x) => x && x._banner);
    if (!entries.length) return "";
    const latest = entries.sort((a, b) => (b._resolvedAt || 0) - (a._resolvedAt || 0))[0];
    return latest ? `<div class="phase23-result-banner">${latest._banner}</div>` : "";
  }

  function buildListingCard(item = {}, context = "listings") {
    const id = clean(item.id || "");
    const title = clean(item.title || [item.year, item.make, item.model, item.trim].filter(Boolean).join(" ")) || "Vehicle Listing";
    const image = clean(item.image_url || "") || placeholderVehicleImage(title);
    const subtitle = [item.stock_number ? `Stock ${clean(item.stock_number)}` : "", item.vin ? `VIN ${clean(item.vin)}` : "", clean(item.body_style || "")].filter(Boolean).join(" • ") || "Vehicle details";
    const reasonCopy = clean(item.recommended_action || item.pricing_insight || item.health_label || "No immediate issue detected.");
    const nextMove = primaryAction(item);
    const actions = context === "review" ? `<div class="phase23-actiongrid"><button class="action-btn" type="button" data-phase23-open-detail="${id}">Inspect</button><button class="action-btn" type="button" data-phase23-status="${id}:sold">Mark Sold</button><button class="action-btn" type="button" data-phase23-status="${id}:active">Mark Active</button><button class="action-btn" type="button" data-phase23-status="${id}:price_review">Review Price</button><button class="action-btn" type="button" data-phase23-copy="${id}">Copy Summary</button><button class="action-btn" type="button" data-phase23-open="${SECTION_LISTINGS}">Open Listings</button></div>` : `<div class="phase23-actiongrid"><button class="action-btn" type="button" data-phase23-open-detail="${id}">Inspect</button><button class="action-btn" type="button" data-phase23-status="${id}:approved">Approve</button><button class="action-btn" type="button" data-phase23-status="${id}:sold">Mark Sold</button><button class="action-btn" type="button" data-phase23-open="${SECTION_REVIEW}">Review</button><button class="action-btn" type="button" data-phase23-copy="${id}">Copy Summary</button><button class="action-btn" type="button" data-phase23-open-source="${id}">Open Source</button></div>`;
    return `<article class="listing-card phase23-listing-card"><div class="listing-media"><img src="${image}" alt="${title}" loading="lazy" onerror="this.src='${placeholderVehicleImage(title)}'" /><div class="phase23-chiprow"><div class="phase23-chipstack">${buildLifecycleBadge(item)}${buildUrgencyChip(item)}</div><div class="phase23-chipstack"><span class="phase23-chip">${clean(item.health_label || "Tracked")}</span><span class="phase23-chip">${clean(item.price_source || "unknown").replace(/_/g, " ")}</span></div></div></div><div class="phase23-cardbody"><div><div class="phase23-title">${title}</div><div class="phase23-sub">${subtitle}</div></div><div class="phase23-pricerow"><div class="phase23-price">${formatCurrency(item.price)}</div><div class="phase23-primaryaction">Next: ${nextMove}</div></div><div class="phase23-metricrow"><div class="phase23-metric"><div class="phase23-metric-label">Views</div><div class="phase23-metric-value">${n(item.views_count)}</div></div><div class="phase23-metric"><div class="phase23-metric-label">Messages</div><div class="phase23-metric-value">${n(item.messages_count)}</div></div><div class="phase23-metric"><div class="phase23-metric-label">Age</div><div class="phase23-metric-value">${n(item.age_days)}d</div></div><div class="phase23-metric"><div class="phase23-metric-label">Last Seen</div><div class="phase23-metric-value">${formatRelative(item.last_seen_at || item.updated_at || item.posted_at)}</div></div></div><div class="phase23-reason"><div class="phase23-reason-label">${context === "review" ? "Review reason" : "Portfolio note"}</div><div class="phase23-reason-copy">${reasonCopy}</div></div>${actions}</div></article>`;
  }

  function buildPortfolioRow(item = {}) {
    const id = clean(item.id || "");
    const title = clean(item.title || "Listing");
    const image = clean(item.image_url || "") || placeholderVehicleImage(title);
    const subtitle = [item.stock_number ? `Stock ${clean(item.stock_number)}` : "", item.vin ? `VIN ${clean(item.vin)}` : "", clean(item.body_style || "")].filter(Boolean).join(" • ") || "Vehicle details";
    return `<div class="phase23-portfolio-row"><div class="phase23-portfolio-thumb"><img src="${image}" alt="${title}" loading="lazy" onerror="this.src='${placeholderVehicleImage(title)}'" /></div><div class="phase23-portfolio-main"><div class="phase23-portfolio-head"><div><div class="phase23-portfolio-title">${title}</div><div class="phase23-portfolio-sub">${subtitle}</div></div><div class="phase23-chipstack">${buildLifecycleBadge(item)}${buildUrgencyChip(item)}</div></div><div class="phase23-portfolio-stats"><span class="phase23-chip">${formatCurrency(item.price)}</span><span class="phase23-chip">${n(item.views_count)} views</span><span class="phase23-chip">${n(item.messages_count)} msgs</span><span class="phase23-chip">${n(item.age_days)}d old</span><span class="phase23-chip">${clean(item.price_source || "unknown").replace(/_/g, " ")}</span></div><div class="phase23-portfolio-sub">${clean(item.recommended_action || item.pricing_insight || primaryAction(item))}</div></div><div class="phase23-portfolio-actions"><button class="action-btn" type="button" data-phase23-open-detail="${id}">Inspect</button><button class="action-btn" type="button" data-phase23-status="${id}:price_review">Price</button><button class="action-btn" type="button" data-phase23-status="${id}:sold">Sold</button></div></div>`;
  }

  function matchesFilter(item, filter) {
    const lifecycle = clean(item.lifecycle_status || "").toLowerCase();
    const bucket = clean(item.review_bucket || "").toLowerCase().replace(/[\s_-]+/g, "");
    const status = clean(item.status || "").toLowerCase();
    if (filter === "active") return !["sold", "deleted", "inactive", "stale"].includes(status) && lifecycle !== "review_delete";
    if (filter === "review") return ["review_delete", "review_price_update", "review_new"].includes(lifecycle) || ["removedvehicles", "pricechanges", "newvehicles"].includes(bucket);
    if (filter === "weak") return Boolean(item.weak);
    if (filter === "likely_sold") return Boolean(item.likely_sold) || lifecycle === "review_delete";
    if (filter === "needs_action") return Boolean(item.needs_action);
    return true;
  }

  function renderListingsSection() {
    const grid = document.getElementById("phase23ListingsGrid");
    if (!grid) return;
    const rowsBase = getListings();
    const search = clean(document.getElementById("phase23ListingsSearch")?.value || "").toLowerCase();
    const sortMode = clean(document.getElementById("phase23ListingsSort")?.value || "popular").toLowerCase();
    const activeFilter = document.querySelector("[data-phase23-filter].active")?.getAttribute("data-phase23-filter") || "all";
    let rows = [...rowsBase];
    if (activeFilter !== "all") rows = rows.filter((item) => matchesFilter(item, activeFilter));
    if (search) rows = rows.filter((item) => [item.title, item.make, item.model, item.vin, item.stock_number].join(" ").toLowerCase().includes(search));
    rows.sort((a, b) => {
      if (sortMode === "newest") return new Date(b.posted_at || b.updated_at || 0) - new Date(a.posted_at || a.updated_at || 0);
      if (sortMode === "price_high") return n(b.price) - n(a.price);
      if (sortMode === "price_low") return n(a.price) - n(b.price);
      return n(b.popularity_score) - n(a.popularity_score);
    });
    const banner = document.getElementById("phase23ListingsBanner");
    if (banner) banner.innerHTML = buildResultBanner();
    const statusEl = document.getElementById("phase23ListingsStatus");
    if (statusEl) statusEl.textContent = `${state.listingsSource || "waiting"} • ${rowsBase.length} row${rowsBase.length === 1 ? "" : "s"} available`;
    grid.innerHTML = rows.length ? rows.map((item) => buildListingCard(item, "listings")).join("") : `<div class="phase23-empty">No portfolio rows are available yet.</div>`;
  }

  function queueHtml(items, emptyText) {
    if (!Array.isArray(items) || !items.length) return `<div class="phase23-empty">${emptyText}</div>`;
    return items.slice(0, 8).map((item) => {
      const listing = getListings().find((row) => clean(row.canonical_key) === clean(item.canonical_key) || String(row.id) === String(item.id)) || normalizeRow(item, item.row_source || "unknown");
      return `<div class="phase23-queue-item"><div class="phase23-queue-top"><div class="phase23-queue-title">${clean(item.title || listing.title || "Listing")}</div>${buildUrgencyChip(listing)}</div><div class="phase23-queue-sub">${primaryAction(listing)}</div><div class="phase23-queue-meta"><span class="phase23-chip">${formatCurrency(listing.price)}</span><span class="phase23-chip">${n(listing.views_count)} views</span><span class="phase23-chip">${n(listing.messages_count)} msgs</span></div><button class="action-btn" type="button" data-phase23-open-detail="${clean(item.id || listing.id || "")}">Inspect</button></div>`;
    }).join("");
  }

  function buildReviewCards() {
    const rows = [...getListings()].filter((item) => Boolean(item.needs_action) || Boolean(item.weak) || Boolean(item.likely_sold) || ["review_delete", "review_price_update", "review_new", "stale"].includes(clean(item.lifecycle_status).toLowerCase()));
    rows.sort((a, b) => ((b.likely_sold ? 50 : 0) + (b.needs_action ? 30 : 0) + (b.weak ? 20 : 0) + (n(b.popularity_score) / 100)) - ((a.likely_sold ? 50 : 0) + (a.needs_action ? 30 : 0) + (a.weak ? 20 : 0) + (n(a.popularity_score) / 100)));
    return rows.slice(0, 12);
  }

  function renderReviewSection() {
    const summary = getSummary();
    const rows = getListings();
    const buckets = buildPortfolioBuckets(rows);
    const details = getSummary().action_center_details || {};
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
    setText("phase23ReviewQueue", n(summary.review_queue_count || buckets.review.length));
    setText("phase23LikelySold", n(summary.stale_listings || summary.review_delete_count || buckets.stale_sold.length));
    setText("phase23WeakListings", n(summary.weak_listings || rows.filter((r) => r.weak).length));
    setText("phase23PromoteNow", n(summary.action_center?.promote_today || 0));
    const needs = document.getElementById("phase23NeedsAttention");
    const today = document.getElementById("phase23TodayQueue");
    const price = document.getElementById("phase23PriceQueue");
    const stale = document.getElementById("phase23StaleQueue");
    if (needs) needs.innerHTML = queueHtml(details.needs_attention || buckets.review, "No critical items right now.");
    if (today) today.innerHTML = queueHtml(details.today || buckets.active.slice(0, 6), "No queued actions for today.");
    if (price) price.innerHTML = queueHtml(buckets.price_watch, "No price-watch items right now.");
    if (stale) stale.innerHTML = queueHtml(buckets.stale_sold, "No likely sold or stale items right now.");
    const cards = document.getElementById("phase23ReviewCards");
    const reviewRows = buildReviewCards();
    if (cards) cards.innerHTML = reviewRows.length ? reviewRows.map((item) => buildListingCard(item, "review")).join("") : `<div class="phase23-empty">No review cards are hydrated into this section yet.</div>`;
    const statusEl = document.getElementById("phase23ReviewStatus");
    if (statusEl) statusEl.textContent = `${reviewRows.length} review card${reviewRows.length === 1 ? "" : "s"} hydrated • Portfolio source ${state.listingsSource || "none"}`;
  }

  function renderAnalyticsPortfolio() {
    const tools = document.getElementById("tools");
    if (!tools) return;
    let shell = document.getElementById("phase23PortfolioShell");
    if (!shell) {
      shell = document.createElement("div");
      shell.id = "phase23PortfolioShell";
      shell.className = "card phase23-portfolio-shell";
      shell.innerHTML = `<div class="section-head"><div><div class="phase23-eyebrow">Portfolio Intelligence</div><h2>Client posts and lifecycle workspace</h2><div class="subtext">View actual posts, sort them by lifecycle state, and take action without leaving the dashboard.</div></div></div><div id="phase23PortfolioBanner"></div><div class="phase23-portfolio-tabs" id="phase23PortfolioTabs"><button class="action-btn active" type="button" data-phase23-portfolio-tab="active">Active</button><button class="action-btn" type="button" data-phase23-portfolio-tab="review">Review</button><button class="action-btn" type="button" data-phase23-portfolio-tab="price_watch">Price Watch</button><button class="action-btn" type="button" data-phase23-portfolio-tab="stale_sold">Stale / Likely Sold</button><button class="action-btn" type="button" data-phase23-portfolio-tab="sold_archived">Sold / Archived</button></div><div id="phase23PortfolioStatus" class="phase23-statusline"></div><div id="phase23PortfolioGrid" class="phase23-portfolio-grid"></div>`;
      tools.prepend(shell);
    }
    const rows = getListings();
    const buckets = buildPortfolioBuckets(rows);
    const current = state.activePortfolioTab in buckets ? state.activePortfolioTab : "active";
    const selected = buckets[current] || [];
    qsa("[data-phase23-portfolio-tab]", shell).forEach((btn) => btn.classList.toggle("active", btn.getAttribute("data-phase23-portfolio-tab") === current));
    const banner = document.getElementById("phase23PortfolioBanner");
    if (banner) banner.innerHTML = buildResultBanner();
    const status = document.getElementById("phase23PortfolioStatus");
    if (status) {
      const labels = {active: "Live posts", review: "Review queue", price_watch: "Price watch", stale_sold: "Stale / likely sold", sold_archived: "Sold / archived"};
      status.textContent = `${labels[current] || "Portfolio"} • ${selected.length} row${selected.length === 1 ? "" : "s"}`;
    }
    const grid = document.getElementById("phase23PortfolioGrid");
    if (grid) grid.innerHTML = selected.length ? selected.slice(0, 24).map((item) => buildPortfolioRow(item)).join("") : `<div class="phase23-empty">No rows in this portfolio bucket yet.</div>`;
  }

  function setActiveNav(sectionId) {
    qsa("[data-section]").forEach((button) => button.classList.toggle("active", button.getAttribute("data-section") === sectionId));
  }

  function showSectionWithFallback(sectionId) {
    if (!sectionId) return;
    ensureSections();
    qsa(".dashboard-section").forEach((section) => { section.style.display = section.id === sectionId ? "block" : "none"; });
    setActiveNav(sectionId);
    const pageTitle = document.getElementById("dashboardPageTitle");
    const titleMap = { listings: "Listings", review_center: "Review Center" };
    if (pageTitle && titleMap[sectionId]) pageTitle.textContent = titleMap[sectionId];
    if (NS.state?.set) NS.state.set("ui.activeSection", sectionId);
  }

  function patchShowSection() {
    if (window.__EA_PHASE23_SHOWSECTION_PATCHED__) return;
    const original = typeof window.showSection === "function" ? window.showSection : null;
    window.__EA_PHASE23_SHOWSECTION_PATCHED__ = true;
    window.showSection = function(sectionId) {
      if (sectionId === SECTION_LISTINGS || sectionId === SECTION_REVIEW) {
        showSectionWithFallback(sectionId);
        scheduleRender();
        return;
      }
      if (original) original(sectionId);
    };
  }

  function resolveOverlayForAction(listing, action) {
    const base = { _resolvedAt: Date.now() };
    if (action === "sold") return { ...base, status: "sold", lifecycle_status: "sold", likely_sold: false, needs_action: false, weak: false, health_label: "Marked Sold", _banner: `${clean(listing.title || "Listing")} marked sold.` };
    if (action === "active" || action === "approved") return { ...base, status: "active", lifecycle_status: "active", likely_sold: false, needs_action: false, weak: false, health_label: "Confirmed Active", _banner: `${clean(listing.title || "Listing")} moved back to active.` };
    if (action === "price_review") return { ...base, status: "active", lifecycle_status: "review_price_update", needs_action: true, health_label: "Price Review", pricing_insight: clean(listing.pricing_insight || "Review price against the source of truth before editing Marketplace."), _banner: `${clean(listing.title || "Listing")} moved to Price Watch.` };
    if (action === "stale") return { ...base, status: "stale", lifecycle_status: "stale", needs_action: true, weak: true, health_label: "Stale", _banner: `${clean(listing.title || "Listing")} marked stale.` };
    return { ...base, _banner: `${clean(listing.title || "Listing")} updated.` };
  }

  async function handleStatus(id, next) {
    if (!id || !next) return;
    const listing = getListings().find((item) => String(item.id) === String(id)) || {};
    const overlay = resolveOverlayForAction(listing, next);
    const overlayKey = clean(listing.canonical_key || id);
    state.pendingActions[overlayKey] = overlay;
    try {
      if (next === "sold" && typeof window.markListingSold === "function") await window.markListingSold(id);
      else if (typeof window.markListingAction === "function") await window.markListingAction(id, next);
    } catch (error) {
      console.warn("phase23 status action warning", error);
      state.pendingActions[overlayKey] = { ...overlay, _banner: `${clean(listing.title || "Listing")} updated locally. Server action still needs verification.` };
    }
    scheduleRender();
  }

  function bindNavHotfix() {
    if (state.navBound) return;
    state.navBound = true;
    document.addEventListener("click", (event) => {
      const navButton = event.target.closest("[data-section]");
      if (!navButton) return;
      const sectionId = navButton.getAttribute("data-section");
      if (sectionId !== SECTION_LISTINGS && sectionId !== SECTION_REVIEW) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof window.showSection === "function") window.showSection(sectionId); else showSectionWithFallback(sectionId);
    }, true);
  }

  function bindShellEvents() {
    if (state.shellBound) return;
    state.shellBound = true;
    document.addEventListener("click", async (event) => {
      const open = event.target.closest("[data-phase23-open]");
      if (open) { const section = open.getAttribute("data-phase23-open"); if (typeof window.showSection === "function") window.showSection(section); return; }
      const filter = event.target.closest("[data-phase23-filter]");
      if (filter) { qsa("[data-phase23-filter]").forEach((btn) => btn.classList.toggle("active", btn === filter)); renderListingsSection(); return; }
      const tab = event.target.closest("[data-phase23-portfolio-tab]");
      if (tab) { state.activePortfolioTab = tab.getAttribute("data-phase23-portfolio-tab") || "active"; renderAnalyticsPortfolio(); return; }
      const detail = event.target.closest("[data-phase23-open-detail]");
      if (detail) { const id = detail.getAttribute("data-phase23-open-detail"); if (typeof window.openListingDetailModal === "function") window.openListingDetailModal(id); return; }
      const status = event.target.closest("[data-phase23-status]");
      if (status) { const raw = status.getAttribute("data-phase23-status") || ""; const [id, next] = raw.split(":"); await handleStatus(id, next); return; }
      const copyBtn = event.target.closest("[data-phase23-copy]");
      if (copyBtn) { const id = copyBtn.getAttribute("data-phase23-copy"); if (typeof window.copyVehicleSummary === "function") window.copyVehicleSummary(id); return; }
      const sourceBtn = event.target.closest("[data-phase23-open-source]");
      if (sourceBtn) { const id = sourceBtn.getAttribute("data-phase23-open-source"); const row = getListings().find((item) => String(item.id) === String(id)); if (row?.source_url && typeof window.openListingSource === "function") window.openListingSource(id, row.source_url); }
    });
    document.addEventListener("input", (event) => { if (event.target?.id === "phase23ListingsSearch") renderListingsSection(); });
    document.addEventListener("change", (event) => { if (event.target?.id === "phase23ListingsSort") renderListingsSection(); });
  }

  function scheduleRender() {
    clearTimeout(state.renderTimer);
    state.renderTimer = setTimeout(() => { try { renderAll(); } catch (error) { console.warn("phase23 render warning", error); } }, 140);
  }

  function bindHydrationBridge() {
    if (state.hydrationBound) return;
    state.hydrationBound = true;
    const observeNode = (node) => {
      if (!node) return;
      const observer = new MutationObserver(() => { syncCanonicalListings(); scheduleRender(); });
      observer.observe(node, { childList: true, subtree: true });
    };
    if (!state.observerBound) {
      observeNode(document.getElementById("recentListingsGrid"));
      observeNode(document.getElementById("topListings"));
      state.observerBound = true;
    }
    window.addEventListener("elevate:tracking-refreshed", scheduleRender);
    document.addEventListener("DOMContentLoaded", scheduleRender);
    setTimeout(scheduleRender, 600);
    setTimeout(scheduleRender, 1600);
    setTimeout(scheduleRender, 3200);
    setTimeout(scheduleRender, 5200);
  }

  function renderAll() {
    injectStyle();
    ensureNavButtons();
    ensureSections();
    patchOverview();
    ensureSetupModules();
    patchShowSection();
    bindNavHotfix();
    bindShellEvents();
    bindHydrationBridge();
    syncCanonicalListings();
    renderListingsSection();
    renderReviewSection();
    renderAnalyticsPortfolio();
  }

  NS.phase21shell = { renderAll };
  NS.modules = NS.modules || {};
  NS.modules.phase21shell = true;

  const boot = () => { renderAll(); setTimeout(renderAll, 1200); setTimeout(renderAll, 3200); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
