(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  const MODULE_KEY = "phase21shell";
  const STYLE_ID = "ea-phase7-setup-overview-cleanup";
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
    hydrationBound: false
  };

  const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();
  const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const getSummary = () => window.dashboardSummary || {};
  const cloneRows = (rows) => Array.isArray(rows) ? rows.map((r) => ({ ...r })) : [];
  const titleKey = (t) => clean(t).toLowerCase();
  const placeholderVehicleImage = (label) => `https://placehold.co/800x500/111111/d4af37?text=${encodeURIComponent(clean(label || "Vehicle"))}`;

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

  function normalizeRow(row = {}) {
    const title = clean(row.title || [row.year, row.make, row.model, row.trim].filter(Boolean).join(" ")) || "Vehicle Listing";
    return {
      id: clean(row.id || row.marketplace_listing_id || row.source_url || row.vin || row.stock_number || titleKey(title) || `row_${Math.random().toString(36).slice(2, 10)}`),
      title,
      image_url: clean(row.image_url || row.cover_photo || row.photo || row.coverImage || row.thumb || ""),
      year: n(row.year) || "",
      make: clean(row.make || ""),
      model: clean(row.model || ""),
      trim: clean(row.trim || ""),
      vin: clean(row.vin || ""),
      stock_number: clean(row.stock_number || row.stockNumber || ""),
      body_style: clean(row.body_style || row.bodyStyle || ""),
      price: n(row.price),
      mileage: n(row.mileage || row.km || row.kilometers),
      views_count: n(row.views_count || row.views),
      messages_count: n(row.messages_count || row.messages),
      age_days: n(row.age_days),
      status: clean(row.status || "active").toLowerCase(),
      lifecycle_status: clean(row.lifecycle_status || row.review_status || row.review_bucket || "").toLowerCase(),
      review_bucket: clean(row.review_bucket || ""),
      likely_sold: Boolean(row.likely_sold),
      weak: Boolean(row.weak),
      needs_action: Boolean(row.needs_action),
      recommended_action: clean(row.recommended_action || ""),
      pricing_insight: clean(row.pricing_insight || ""),
      health_label: clean(row.health_label || ""),
      popularity_score: n(row.popularity_score),
      posted_at: row.posted_at || row.created_at || row.updated_at || "",
      updated_at: row.updated_at || row.posted_at || row.created_at || "",
      last_seen_at: row.last_seen_at || row.updated_at || row.posted_at || "",
      source_url: clean(row.source_url || "")
    };
  }

  function inferLifecycleFromText(text) {
    const raw = clean(text).toLowerCase();
    if (/review delete|likely sold|sold/.test(raw)) return "review_delete";
    if (/review price|price review/.test(raw)) return "review_price_update";
    if (/review new/.test(raw)) return "review_new";
    if (/stale/.test(raw)) return "stale";
    return raw || "active";
  }

  function rowsFromGlobal() { return cloneRows(window.dashboardListings).map(normalizeRow).filter((r) => r.title); }
  function rowsFromSummary() { return cloneRows(getSummary().recent_listings).map(normalizeRow).filter((r) => r.title); }
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
        popularity_score: (n((metricsText.match(/💬\s*([\d,]+)/) || [])[1]) * 1000) + (n((metricsText.match(/👁\s*([\d,]+)/) || [])[1]) * 10),
        health_label: "Top Listing"
      });
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
      const pills = qsa(".metric-pill", card);
      let views = 0, messages = 0, ageDays = 0;
      pills.forEach((pill) => {
        const label = clean(pill.querySelector(".metric-pill-label")?.textContent || "").toLowerCase();
        const value = clean(pill.querySelector(".metric-pill-value")?.textContent || "");
        if (label == "views"): views = n(value)
        if (label == "messages"): messages = n(value)
        if (label == "age"): ageDays = n(value)
      })
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
        needs_action: /needs action|review/i.test(noteText),
        popularity_score: (messages * 1000) + (views * 10)
      });
    }).filter((r) => r.title);
  }

  function mergeRowsWithPriority(sourceRows) {
    const map = new Map();
    sourceRows.forEach(({ rows, priority }) => {
      rows.forEach((row) => {
        const key = clean(row.id || row.vin || row.stock_number || row.title).toLowerCase();
        if (!key) return;
        const existing = map.get(key);
        if (!existing || priority >= existing.__priority) map.set(key, { ...row, __priority: priority });
      });
    });
    return Array.from(map.values()).map(({ __priority, ...row }) => row);
  }

  function resolveCanonicalListings() {
    const globalRows = rowsFromGlobal();
    const overviewRows = rowsFromOverviewDom();
    const topRows = rowsFromTopDom();
    const summaryRows = rowsFromSummary();

    let rows = [];
    let source = "none";
    if (globalRows.length >= 2) {
      rows = mergeRowsWithPriority([{ rows: summaryRows, priority: 1 }, { rows: topRows, priority: 2 }, { rows: overviewRows, priority: 3 }, { rows: globalRows, priority: 4 }]);
      source = "global_rows";
    } else if (overviewRows.length) {
      rows = mergeRowsWithPriority([{ rows: summaryRows, priority: 1 }, { rows: topRows, priority: 2 }, { rows: overviewRows, priority: 3 }]);
      source = "overview_dom";
    } else if (summaryRows.length) {
      rows = mergeRowsWithPriority([{ rows: topRows, priority: 1 }, { rows: summaryRows, priority: 2 }]);
      source = "summary_recent";
    } else if (topRows.length) {
      rows = mergeRowsWithPriority([{ rows: topRows, priority: 1 }]);
      source = "top_dom";
    }
    rows.sort((a, b) => n(b.popularity_score) - n(a.popularity_score));
    state.listingsSource = source;
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
  function getListings() { const synced = syncCanonicalListings(); return Array.isArray(synced) ? synced : []; }
  function getOverviewMetrics() {
    const rows = getListings();
    const reviewRows = rows.filter((item) => Boolean(item.needs_action) || Boolean(item.weak) || Boolean(item.likely_sold) || ["review_delete", "review_price_update", "review_new", "stale"].includes(clean(item.lifecycle_status).toLowerCase()));
    const activeRows = rows.filter((item) => !["sold", "deleted", "inactive"].includes(clean(item.status).toLowerCase()));
    const likelySold = rows.filter((item) => item.likely_sold || clean(item.lifecycle_status) === "review_delete").length;
    const weak = rows.filter((item) => item.weak).length;
    const top = [...rows].sort((a, b) => n(b.popularity_score) - n(a.popularity_score))[0] || null;
    return { live: activeRows.length, review: reviewRows.length, likelySold, weak, topTitle: clean(top?.title || "No top listing yet"), topAction: top ? primaryAction(top) : "Complete setup, queue inventory, and post the first vehicle.", topPrice: top ? formatCurrency(top.price) : "$0" };
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .phase7-eyebrow{color:var(--gold);font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px}
      .phase7-statusline{color:var(--gold-soft);font-size:12px;margin:2px 0 10px}
      .phase7-overview-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin:14px 0 16px}
      .phase7-command-card,.phase7-priority-card,.phase7-setup-module{padding:18px}
      .phase7-command-title{font-size:28px;font-weight:900;line-height:1.06;margin-bottom:8px}
      .phase7-command-sub,.phase7-priority-copy{color:var(--muted);font-size:13px;line-height:1.5}
      .phase7-kpi-row,.phase7-setup-grid,.phase7-actiongrid,.phase7-metricrow,.phase7-mini-row,.phase7-jumpbar{display:grid;gap:10px}
      .phase7-kpi-row{grid-template-columns:repeat(4,minmax(0,1fr))}
      .phase7-kpi,.phase7-setup-module,.phase7-mini-card{background:#161616;border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:12px}
      .phase7-kpi-label,.phase7-mini-label,.phase7-setup-label{color:var(--gold);font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin-bottom:6px}
      .phase7-kpi-value,.phase7-mini-value{font-size:22px;font-weight:800;line-height:1.1}
      .phase7-priority-title{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);font-weight:700}
      .phase7-priority-headline{font-size:22px;font-weight:800;line-height:1.15}
      .phase7-priority-chiprow,.phase7-chipstack,.phase7-queue-meta{display:flex;gap:8px;flex-wrap:wrap}
      .phase7-jumpbar{grid-template-columns:repeat(4,minmax(0,1fr));margin:12px 0 16px}
      .phase7-jumpbar .action-btn{min-height:46px}
      .phase7-toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
      .phase7-toolbar-left,.phase7-toolbar-right{display:flex;gap:8px;flex-wrap:wrap}
      .phase7-toolbar input,.phase7-toolbar select{min-width:220px;background:#1a1a1a;color:#f5f5f5;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:11px 13px}
      .phase7-chip{display:inline-flex;align-items:center;min-height:26px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.08);background:#101010;color:#f1f1f1}
      .phase7-chip.critical{background:rgba(120,20,20,.9);color:#ffd3d3;border-color:rgba(255,120,120,.24)}
      .phase7-chip.high{background:rgba(212,175,55,.18);color:#f3ddb0;border-color:rgba(212,175,55,.24)}
      .phase7-chip.medium{background:rgba(80,80,80,.95);color:#f2f2f2;border-color:rgba(255,255,255,.14)}
      .phase7-listing-card{border-radius:16px;overflow:hidden}
      .phase7-listing-card .listing-media{height:165px;position:relative}
      .phase7-chiprow{position:absolute;left:10px;right:10px;top:10px;display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
      .phase7-cardbody{padding:14px;display:grid;gap:8px}
      .phase7-title{font-size:18px;font-weight:800;line-height:1.2}
      .phase7-sub{color:var(--muted);font-size:12px;line-height:1.45}
      .phase7-pricerow{display:flex;justify-content:space-between;align-items:flex-end;gap:10px}
      .phase7-price{font-size:24px;font-weight:800;color:var(--gold-soft);line-height:1.1}
      .phase7-primaryaction{font-size:12px;font-weight:800;color:var(--gold-soft);text-align:right}
      .phase7-metricrow{grid-template-columns:repeat(4,minmax(0,1fr))}
      .phase7-metric{background:#171717;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:9px 10px}
      .phase7-metric-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--gold);margin-bottom:4px;font-weight:700}
      .phase7-metric-value{font-size:13px;font-weight:700;color:#f0f0f0}
      .phase7-reason{background:rgba(212,175,55,.06);border:1px solid rgba(212,175,55,.14);border-radius:12px;padding:10px 11px}
      .phase7-reason-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--gold);margin-bottom:4px;font-weight:700}
      .phase7-reason-copy{font-size:12px;color:#f0e6cc;line-height:1.45}
      .phase7-mini-row{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:14px}
      .phase7-queue-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:16px}
      .phase7-queue{display:grid;gap:10px}
      .phase7-queue-item{display:grid;gap:8px;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.06)}
      .phase7-queue-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .phase7-queue-title{font-weight:800;line-height:1.3}
      .phase7-queue-sub{color:var(--muted);font-size:13px;line-height:1.45}
      .phase7-empty{padding:22px;text-align:center;color:var(--muted);border:1px dashed rgba(212,175,55,.18);border-radius:14px;background:#111}
      .phase7-setup-grid{grid-template-columns:repeat(3,minmax(0,1fr));margin:14px 0 16px}
      .phase7-setup-title{font-size:18px;font-weight:800;line-height:1.2;margin-bottom:8px}
      .phase7-setup-copy{color:var(--muted);font-size:13px;line-height:1.45;margin-bottom:10px}
      .phase7-setup-list{display:grid;gap:8px}
      .phase7-setup-item{display:flex;justify-content:space-between;gap:10px;align-items:center;background:#171717;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:10px 12px}
      .phase7-setup-item span:last-child{color:var(--gold-soft);font-weight:700}
      .phase7-overview-demoted{opacity:.86}
      @media (max-width:1100px){.phase7-overview-grid,.phase7-queue-grid,.phase7-mini-row,.phase7-jumpbar,.phase7-actiongrid,.phase7-metricrow,.phase7-kpi-row,.phase7-setup-grid{grid-template-columns:1fr 1fr}}
      @media (max-width:760px){.phase7-toolbar{flex-direction:column;align-items:stretch}.phase7-toolbar input,.phase7-toolbar select{min-width:100%;width:100%}.phase7-overview-grid,.phase7-queue-grid,.phase7-mini-row,.phase7-jumpbar,.phase7-actiongrid,.phase7-metricrow,.phase7-kpi-row,.phase7-setup-grid{grid-template-columns:1fr}}
    `;
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
    section.innerHTML = `<div class="card"><div class="phase7-eyebrow">${title}</div><h2>${title}</h2><div class="subtext">${subtitle}</div></div>`;
    return section;
  }

  function ensureSections() {
    const mainInner = qs(".main-inner");
    if (!mainInner) return;
    if (!document.getElementById(SECTION_LISTINGS)) {
      const listings = sectionShell(SECTION_LISTINGS, "Listings", "Cleaner portfolio cards with stronger price, urgency, and next-action hierarchy.");
      listings.insertAdjacentHTML("beforeend", `<div class="phase7-toolbar card"><div class="phase7-toolbar-left"><button class="action-btn active" type="button" data-phase7-filter="all">All</button><button class="action-btn" type="button" data-phase7-filter="active">Active</button><button class="action-btn" type="button" data-phase7-filter="review">Review</button><button class="action-btn" type="button" data-phase7-filter="weak">Weak</button><button class="action-btn" type="button" data-phase7-filter="likely_sold">Likely Sold</button><button class="action-btn" type="button" data-phase7-filter="needs_action">Needs Action</button></div><div class="phase7-toolbar-right"><select id="phase7ListingsSort"><option value="popular">Sort: Most Popular</option><option value="newest">Sort: Newest</option><option value="price_high">Sort: Price High → Low</option><option value="price_low">Sort: Price Low → High</option></select><input id="phase7ListingsSearch" type="text" placeholder="Search make, model, VIN, stock..." /></div></div><div id="phase7ListingsStatus" class="phase7-statusline"></div><div id="phase7ListingsGrid" class="listing-grid"></div>`);
      mainInner.appendChild(listings);
    }
    if (!document.getElementById(SECTION_REVIEW)) {
      const review = sectionShell(SECTION_REVIEW, "Review Center", "Sharper triage cards with clearer urgency, reason, and dominant next move.");
      review.insertAdjacentHTML("beforeend", `<div class="phase7-mini-row"><div class="phase7-mini-card"><div class="phase7-mini-label">Review Queue</div><div id="phase7ReviewQueue" class="phase7-mini-value">0</div></div><div class="phase7-mini-card"><div class="phase7-mini-label">Likely Sold</div><div id="phase7LikelySold" class="phase7-mini-value">0</div></div><div class="phase7-mini-card"><div class="phase7-mini-label">Weak Listings</div><div id="phase7WeakListings" class="phase7-mini-value">0</div></div><div class="phase7-mini-card"><div class="phase7-mini-label">Promote Now</div><div id="phase7PromoteNow" class="phase7-mini-value">0</div></div></div><div id="phase7ReviewStatus" class="phase7-statusline"></div><div class="phase7-queue-grid"><div class="card"><div class="section-head"><h2>Needs Attention</h2></div><div id="phase7NeedsAttention" class="phase7-queue"></div></div><div class="card"><div class="section-head"><h2>Today</h2></div><div id="phase7TodayQueue" class="phase7-queue"></div></div><div class="card"><div class="section-head"><h2>Opportunities</h2></div><div id="phase7Opportunities" class="phase7-queue"></div></div></div><div class="card"><div class="section-head"><div><h2>Priority Review Cards</h2><div class="subtext">Triage-first cards using the same canonical portfolio rows.</div></div></div><div id="phase7ReviewCards" class="listing-grid"></div></div>`);
      mainInner.appendChild(review);
    }
  }

  function ensureOverviewCommandCenter() {
    const overview = document.getElementById("overview");
    if (!overview) return;
    const metrics = getOverviewMetrics();
    if (!overview.querySelector("#phase7OverviewCommandCenter")) {
      const block = document.createElement("div");
      block.id = "phase7OverviewCommandCenter";
      block.className = "phase7-overview-grid";
      block.innerHTML = `<div class="card phase7-command-card"><div class="phase7-eyebrow">Command Center</div><div class="phase7-command-title">Run the portfolio. Clear the next pressure point.</div><div class="phase7-command-sub">Lead from live portfolio pressure, review volume, and top opportunity instead of setup-first messaging.</div><div class="phase7-kpi-row"><div class="phase7-kpi"><div class="phase7-kpi-label">Live Portfolio</div><div id="phase7LiveKpi" class="phase7-kpi-value">0</div></div><div class="phase7-kpi"><div class="phase7-kpi-label">Review Pressure</div><div id="phase7ReviewKpi" class="phase7-kpi-value">0</div></div><div class="phase7-kpi"><div class="phase7-kpi-label">Likely Sold</div><div id="phase7SoldKpi" class="phase7-kpi-value">0</div></div><div class="phase7-kpi"><div class="phase7-kpi-label">Weak Listings</div><div id="phase7WeakKpi" class="phase7-kpi-value">0</div></div></div></div><div class="card phase7-priority-card"><div class="phase7-priority-title">Next best move</div><div id="phase7PriorityHeadline" class="phase7-priority-headline">Inspect the top listing and clear the next action.</div><div id="phase7PriorityCopy" class="phase7-priority-copy">This panel should hold the highest-leverage move.</div><div class="phase7-priority-chiprow"><span id="phase7PriorityPrice" class="phase7-chip">$0</span><span class="phase7-chip">Command center live</span></div><div class="phase7-actiongrid"><button class="action-btn" type="button" data-phase7-open="${SECTION_LISTINGS}">Open Listings</button><button class="action-btn" type="button" data-phase7-open="${SECTION_REVIEW}">Open Review Center</button><button class="action-btn" type="button" data-phase7-open="extension">Open Tools</button></div></div>`;
      const anchor = overview.firstElementChild;
      if (anchor?.insertAdjacentElement) anchor.insertAdjacentElement("afterend", block);
      else overview.prepend(block);
    }
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
    setText("phase7LiveKpi", metrics.live);
    setText("phase7ReviewKpi", metrics.review);
    setText("phase7SoldKpi", metrics.likelySold);
    setText("phase7WeakKpi", metrics.weak);
    setText("phase7PriorityHeadline", metrics.topTitle);
    setText("phase7PriorityCopy", metrics.topAction);
    setText("phase7PriorityPrice", metrics.topPrice);
  }

  function ensureSetupModules() {
    const profile = document.getElementById("profile");
    if (!profile) return;
    if (!profile.querySelector("#phase7SetupModules")) {
      const modules = document.createElement("div");
      modules.id = "phase7SetupModules";
      modules.className = "phase7-setup-grid";
      modules.innerHTML = `<div class="phase7-setup-module"><div class="phase7-setup-label">Profile</div><div class="phase7-setup-title">Operator identity</div><div class="phase7-setup-copy">Contact, dealer, and personal operator details.</div><div class="phase7-setup-list"><div class="phase7-setup-item"><span>Name / dealer</span><span id="phase7SetupProfileStatus">In progress</span></div><div class="phase7-setup-item"><span>Phone / email</span><span id="phase7SetupContactStatus">In progress</span></div></div></div><div class="phase7-setup-module"><div class="phase7-setup-label">Posting</div><div class="phase7-setup-title">Inventory readiness</div><div class="phase7-setup-copy">Dealer website, inventory URL, scanner type, and post location.</div><div class="phase7-setup-list"><div class="phase7-setup-item"><span>Website / inventory</span><span id="phase7SetupInventoryStatus">Missing</span></div><div class="phase7-setup-item"><span>Scanner / location</span><span id="phase7SetupScannerStatus">Missing</span></div></div></div><div class="phase7-setup-module"><div class="phase7-setup-label">Compliance</div><div class="phase7-setup-title">Publish readiness</div><div class="phase7-setup-copy">Province, compliance mode, and required publishing details.</div><div class="phase7-setup-list"><div class="phase7-setup-item"><span>Province / mode</span><span id="phase7SetupComplianceStatus">Needs setup</span></div><div class="phase7-setup-item"><span>License / dealer fields</span><span id="phase7SetupDealerStatus">Needs setup</span></div></div></div>`;
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
      setupCard.classList.add("phase7-overview-demoted");
      const heading = setupCard.querySelector("h2");
      if (heading) heading.textContent = "Setup and readiness";
      const sub = setupCard.querySelector(".subtext, p");
      if (sub) sub.textContent = "Keep required setup visible, but let it support the command center instead of leading the page.";
    }
    if (!overview.querySelector("#phase7OverviewJumpbar")) {
      const target = document.getElementById("phase7OverviewCommandCenter") || setupCard || overview.firstElementChild;
      const wrap = document.createElement("div");
      wrap.id = "phase7OverviewJumpbar";
      wrap.className = "phase7-jumpbar";
      wrap.innerHTML = `<button class="action-btn" type="button" data-phase7-open="${SECTION_LISTINGS}">Open Listings</button><button class="action-btn" type="button" data-phase7-open="${SECTION_REVIEW}">Open Review Center</button><button class="action-btn" type="button" data-phase7-open="extension">Open Tools</button><button class="action-btn" type="button" data-phase7-open="profile">Open Setup</button>`;
      if (target?.insertAdjacentElement) target.insertAdjacentElement("afterend", wrap);
      else overview.prepend(wrap);
    }
  }

  function buildLifecycleBadge(item) { return `<span class="phase7-chip">${clean(item.lifecycle_status || item.review_bucket || item.status || "active").replace(/_/g, " ") || "active"}</span>`; }
  function buildUrgencyChip(item) { const level = urgencyLevel(item); return `<span class="phase7-chip ${level}">${urgencyLabel(item)}</span>`; }

  function buildListingCard(item = {}, context = "listings") {
    const id = clean(item.id || "");
    const title = clean(item.title || [item.year, item.make, item.model, item.trim].filter(Boolean).join(" ")) || "Vehicle Listing";
    const image = clean(item.image_url || "") || placeholderVehicleImage(title);
    const subtitle = [item.stock_number ? `Stock ${clean(item.stock_number)}` : "", item.vin ? `VIN ${clean(item.vin)}` : "", clean(item.body_style || "")].filter(Boolean).join(" • ") || "Vehicle details";
    const reasonCopy = clean(item.recommended_action || item.pricing_insight || item.health_label || "No immediate issue detected.");
    const nextMove = primaryAction(item);
    const actions = context == "review"
      ? `<div class="phase7-actiongrid"><button class="action-btn" type="button" data-phase7-open-detail="${id}">Inspect</button><button class="action-btn" type="button" data-phase7-status="${id}:sold">Mark Sold</button><button class="action-btn" type="button" data-phase7-status="${id}:active">Mark Active</button><button class="action-btn" type="button" data-phase7-status="${id}:price_review">Review Price</button><button class="action-btn" type="button" data-phase7-copy="${id}">Copy Summary</button><button class="action-btn" type="button" data-phase7-open="${SECTION_LISTINGS}">Open Listings</button></div>`
      : `<div class="phase7-actiongrid"><button class="action-btn" type="button" data-phase7-open-detail="${id}">Inspect</button><button class="action-btn" type="button" data-phase7-status="${id}:approved">Approve</button><button class="action-btn" type="button" data-phase7-status="${id}:sold">Mark Sold</button><button class="action-btn" type="button" data-phase7-open="${SECTION_REVIEW}">Review</button><button class="action-btn" type="button" data-phase7-copy="${id}">Copy Summary</button><button class="action-btn" type="button" data-phase7-open-source="${id}">Open Source</button></div>`;
    return `<article class="listing-card phase7-listing-card"><div class="listing-media"><img src="${image}" alt="${title}" loading="lazy" onerror="this.src='${placeholderVehicleImage(title)}'" /><div class="phase7-chiprow"><div class="phase7-chipstack">${buildLifecycleBadge(item)}${buildUrgencyChip(item)}</div><div class="phase7-chipstack"><span class="phase7-chip">${clean(item.health_label || "Tracked")}</span></div></div></div><div class="phase7-cardbody"><div><div class="phase7-title">${title}</div><div class="phase7-sub">${subtitle}</div></div><div class="phase7-pricerow"><div class="phase7-price">${formatCurrency(item.price)}</div><div class="phase7-primaryaction">Next: ${nextMove}</div></div><div class="phase7-metricrow"><div class="phase7-metric"><div class="phase7-metric-label">Views</div><div class="phase7-metric-value">${n(item.views_count)}</div></div><div class="phase7-metric"><div class="phase7-metric-label">Messages</div><div class="phase7-metric-value">${n(item.messages_count)}</div></div><div class="phase7-metric"><div class="phase7-metric-label">Age</div><div class="phase7-metric-value">${n(item.age_days)}d</div></div><div class="phase7-metric"><div class="phase7-metric-label">Last Seen</div><div class="phase7-metric-value">${formatRelative(item.last_seen_at || item.updated_at || item.posted_at)}</div></div></div><div class="phase7-reason"><div class="phase7-reason-label">${context == "review" ? "Review reason" : "Portfolio note"}</div><div class="phase7-reason-copy">${reasonCopy}</div></div>${actions}</div></article>`;
  }

  function matchesFilter(item, filter) {
    const lifecycle = clean(item.lifecycle_status || "").toLowerCase();
    const bucket = clean(item.review_bucket || "").toLowerCase().replace(/[\s_-]+/g, "");
    const status = clean(item.status || "").toLowerCase();
    if (filter == "active") return !["sold", "deleted", "inactive", "stale"].includes(status) && lifecycle != "review_delete";
    if (filter == "review") return ["review_delete", "review_price_update", "review_new"].includes(lifecycle) || ["removedvehicles", "pricechanges", "newvehicles"].includes(bucket);
    if (filter == "weak") return Boolean(item.weak);
    if (filter == "likely_sold") return Boolean(item.likely_sold) || lifecycle == "review_delete";
    if (filter == "needs_action") return Boolean(item.needs_action);
    return True;
  }

  function renderListingsSection() {
    const grid = document.getElementById("phase7ListingsGrid");
    if (!grid) return;
    const rowsBase = getListings();
    const search = clean(document.getElementById("phase7ListingsSearch")?.value || "").toLowerCase();
    const sortMode = clean(document.getElementById("phase7ListingsSort")?.value || "popular").toLowerCase();
    const activeFilter = document.querySelector("[data-phase7-filter].active")?.getAttribute("data-phase7-filter") || "all";
    let rows = [...rowsBase];
    if (activeFilter != "all") rows = rows.filter((item) => matchesFilter(item, activeFilter));
    if (search) rows = rows.filter((item) => [item.title, item.make, item.model, item.vin, item.stock_number].join(" ").toLowerCase().includes(search));
    rows.sort((a, b) => {
      if (sortMode == "newest") return new Date(b.posted_at || b.updated_at || 0) - new Date(a.posted_at || a.updated_at || 0);
      if (sortMode == "price_high") return n(b.price) - n(a.price);
      if (sortMode == "price_low") return n(a.price) - n(b.price);
      return n(b.popularity_score) - n(a.popularity_score);
    });
    const statusEl = document.getElementById("phase7ListingsStatus");
    if (statusEl) statusEl.textContent = `${state.listingsSource || "waiting"} • ${rowsBase.length} row${rowsBase.length === 1 ? "" : "s"} available`;
    grid.innerHTML = rows.length ? rows.map((item) => buildListingCard(item, "listings")).join("") : `<div class="phase7-empty">No portfolio rows are available yet.</div>`;
  }

  function queueHtml(items, emptyText) {
    if (!Array.isArray(items) || !items.length) return `<div class="phase7-empty">${emptyText}</div>`;
    return items.slice(0, 8).map((item) => {
      const listing = getListings().find((row) => String(row.id) === String(item.id)) || normalizeRow(item);
      return `<div class="phase7-queue-item"><div class="phase7-queue-top"><div class="phase7-queue-title">${clean(item.title || listing.title || "Listing")}</div>${buildUrgencyChip(listing)}</div><div class="phase7-queue-sub">${primaryAction(listing)}</div><div class="phase7-queue-meta"><span class="phase7-chip">${formatCurrency(listing.price)}</span><span class="phase7-chip">${n(listing.views_count)} views</span><span class="phase7-chip">${n(listing.messages_count)} msgs</span></div><button class="action-btn" type="button" data-phase7-open-detail="${clean(item.id || listing.id || "")}">Inspect</button></div>`;
    }).join("");
  }

  function buildReviewCards() {
    const rows = [...getListings()].filter((item) => Boolean(item.needs_action) || Boolean(item.weak) || Boolean(item.likely_sold) || ["review_delete", "review_price_update", "review_new", "stale"].includes(clean(item.lifecycle_status).toLowerCase()));
    rows.sort((a, b) => ((b.likely_sold ? 50 : 0) + (b.needs_action ? 30 : 0) + (b.weak ? 20 : 0) + (n(b.popularity_score) / 100)) - ((a.likely_sold ? 50 : 0) + (a.needs_action ? 30 : 0) + (a.weak ? 20 : 0) + (n(a.popularity_score) / 100)));
    return rows.slice(0, 12);
  }

  function renderReviewSection() {
    const summary = getSummary();
    const details = getSummary().action_center_details || {};
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
    setText("phase7ReviewQueue", n(summary.review_queue_count));
    setText("phase7LikelySold", n(summary.stale_listings || summary.review_delete_count));
    setText("phase7WeakListings", n(summary.weak_listings));
    setText("phase7PromoteNow", n(summary.action_center?.promote_today || 0));
    const needs = document.getElementById("phase7NeedsAttention");
    const today = document.getElementById("phase7TodayQueue");
    const opp = document.getElementById("phase7Opportunities");
    if (needs) needs.innerHTML = queueHtml(details.needs_attention, "No critical items right now.");
    if (today) today.innerHTML = queueHtml(details.today, "No queued actions for today.");
    if (opp) opp.innerHTML = queueHtml(details.opportunities, "No promotion opportunities yet.");
    const cards = document.getElementById("phase7ReviewCards");
    const rows = buildReviewCards();
    if (cards) cards.innerHTML = rows.length ? rows.map((item) => buildListingCard(item, "review")).join("") : `<div class="phase7-empty">No review cards are hydrated into this section yet.</div>`;
    const statusEl = document.getElementById("phase7ReviewStatus");
    if (statusEl) statusEl.textContent = `${rows.length} review card${rows.length === 1 ? "" : "s"} hydrated • Portfolio source ${state.listingsSource || "none"}`;
  }

  function setActiveNav(sectionId) {
    qsa("[data-section]").forEach((button) => { button.classList.toggle("active", button.getAttribute("data-section") == sectionId); });
  }
  function showSectionWithFallback(sectionId) {
    if (!sectionId) return;
    ensureSections();
    qsa(".dashboard-section").forEach((section) => { section.style.display = section.id == sectionId ? "block" : "none"; });
    setActiveNav(sectionId);
    const pageTitle = document.getElementById("dashboardPageTitle");
    const titleMap = { listings: "Listings", review_center: "Review Center" };
    if (pageTitle && titleMap[sectionId]) pageTitle.textContent = titleMap[sectionId];
    if (NS.state?.set) NS.state.set("ui.activeSection", sectionId);
  }
  function patchShowSection() {
    if (window.__EA_PHASE7_SHOWSECTION_PATCHED__) return;
    const original = typeof window.showSection == "function" ? window.showSection : null;
    window.__EA_PHASE7_SHOWSECTION_PATCHED__ = true;
    window.showSection = function(sectionId) {
      if (sectionId == SECTION_LISTINGS || sectionId == SECTION_REVIEW) {
        showSectionWithFallback(sectionId);
        scheduleRender();
        return;
      }
      if (original) original(sectionId);
    };
  }

  async function handleStatus(id, next) {
    if (!id || !next) return;
    try {
      if (next == "sold" && typeof window.markListingSold == "function") await window.markListingSold(id);
      else if (typeof window.markListingAction == "function") await window.markListingAction(id, next);
    } catch (error) {
      console.warn("phase7 status action warning", error);
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
      if (sectionId != SECTION_LISTINGS && sectionId != SECTION_REVIEW) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof window.showSection == "function") window.showSection(sectionId);
      else showSectionWithFallback(sectionId);
    }, true);
  }

  function bindShellEvents() {
    if (state.shellBound) return;
    state.shellBound = true;
    document.addEventListener("click", async (event) => {
      const open = event.target.closest("[data-phase7-open]");
      if (open) {
        const section = open.getAttribute("data-phase7-open");
        if (typeof window.showSection == "function") window.showSection(section);
        return;
      }
      const filter = event.target.closest("[data-phase7-filter]");
      if (filter) {
        qsa("[data-phase7-filter]").forEach((btn) => btn.classList.toggle("active", btn == filter));
        renderListingsSection();
        return;
      }
      const detail = event.target.closest("[data-phase7-open-detail]");
      if (detail) {
        const id = detail.getAttribute("data-phase7-open-detail");
        if (typeof window.openListingDetailModal == "function") window.openListingDetailModal(id);
        return;
      }
      const status = event.target.closest("[data-phase7-status]");
      if (status) {
        const [id, next] = String(status.getAttribute("data-phase7-status") || "").split(":");
        await handleStatus(id, next);
        return;
      }
      const copyBtn = event.target.closest("[data-phase7-copy]");
      if (copyBtn) {
        const id = copyBtn.getAttribute("data-phase7-copy");
        if (typeof window.copyVehicleSummary == "function") window.copyVehicleSummary(id);
        return;
      }
      const sourceBtn = event.target.closest("[data-phase7-open-source]");
      if (sourceBtn) {
        const id = sourceBtn.getAttribute("data-phase7-open-source");
        const row = getListings().find((item) => String(item.id) == String(id));
        if (row?.source_url && typeof window.openListingSource == "function") window.openListingSource(id, row.source_url);
      }
    });
    document.addEventListener("input", (event) => {
      if (event.target?.id == "phase7ListingsSearch") renderListingsSection();
      if (event.target?.closest("#profile")) ensureSetupModules();
    });
    document.addEventListener("change", (event) => {
      if (event.target?.id == "phase7ListingsSort") renderListingsSection();
      if (event.target?.closest("#profile")) ensureSetupModules();
    });
  }

  function scheduleRender() {
    clearTimeout(state.renderTimer);
    state.renderTimer = setTimeout(() => {
      try { renderAll(); } catch (error) { console.warn("phase7 render warning", error); }
    }, 140);
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
  }

  NS.phase21shell = { renderAll };
  NS.modules = NS.modules || {};
  NS.modules.phase21shell = true;

  const boot = () => {
    renderAll();
    setTimeout(renderAll, 1200);
    setTimeout(renderAll, 3200);
  };
  if (document.readyState == "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();