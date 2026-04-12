
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  const MODULE_KEY = "phase21shell";
  const STYLE_ID = "ea-phase5-portfolio-triage-shell";
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

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function n(value) { const num = Number(value); return Number.isFinite(num) ? num : 0; }
  function qs(selector, root = document) { return root.querySelector(selector); }
  function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
  function getSummary() { return window.dashboardSummary || {}; }
  function shallowCloneRows(rows) { return Array.isArray(rows) ? rows.map((row) => ({ ...row })) : []; }
  function titleKey(title) { return clean(title || "").toLowerCase(); }
  function placeholderVehicleImage(label) {
    const text = encodeURIComponent(clean(label || "Vehicle"));
    return `https://placehold.co/800x500/111111/d4af37?text=${text}`;
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
      id: clean(row.id || row.marketplace_listing_id || row.source_url || row.vin || row.stock_number || titleKey(title) || `row_${Date.now()}_${Math.random().toString(36).slice(2,8)}`),
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

  function rowsFromGlobalState() {
    return shallowCloneRows(window.dashboardListings).filter(Boolean).map(normalizeRow).filter((row) => row.title);
  }
  function rowsFromSummaryRecent() {
    return shallowCloneRows(getSummary().recent_listings).filter(Boolean).map(normalizeRow).filter((row) => row.title);
  }
  function rowsFromTopListingsDom() {
    const wrap = document.getElementById("topListings");
    if (!wrap) return [];
    const items = qsa(".top-list-item", wrap);
    return items.map((item, index) => {
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
        mileage: n((sub.match(/([\d,]+)\s*km/i) || [])[1]?.replace(/,/g, "")),
        views_count: n((metricsText.match(/👁\s*([\d,]+)/) || [])[1]?.replace(/,/g, "")),
        messages_count: n((metricsText.match(/💬\s*([\d,]+)/) || [])[1]?.replace(/,/g, "")),
        popularity_score: (n((metricsText.match(/💬\s*([\d,]+)/) || [])[1]) * 1000) + (n((metricsText.match(/👁\s*([\d,]+)/) || [])[1]) * 10),
        health_label: "Top Listing"
      });
    }).filter((row) => row.title);
  }
  function inferLifecycleFromText(text) {
    const raw = clean(text).toLowerCase();
    if (/review delete|likely sold|sold/i.test(raw)) return "review_delete";
    if (/review price|price review/i.test(raw)) return "review_price_update";
    if (/review new/i.test(raw)) return "review_new";
    if (/stale/i.test(raw)) return "stale";
    return raw || "active";
  }
  function rowsFromOverviewCardsDom() {
    const grid = document.getElementById("recentListingsGrid");
    if (!grid) return [];
    const cards = qsa(".listing-card", grid);
    return cards.map((card, index) => {
      const title = clean(card.querySelector(".listing-title")?.textContent || "");
      const sub = clean(card.querySelector(".listing-sub")?.textContent || "");
      const priceText = clean(card.querySelector(".listing-price")?.textContent || "");
      const noteText = qsa(".listing-note", card).map((el) => clean(el.textContent || "")).join(" | ");
      const badge = clean(card.querySelector(".listing-badge")?.textContent || "");
      const img = card.querySelector("img")?.getAttribute("src") || "";
      const metricPills = qsa(".metric-pill", card);
      let views = 0, messages = 0, ageDays = 0;
      metricPills.forEach((pill) => {
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
        needs_action: /needs action|review/i.test(noteText),
        popularity_score: (messages * 1000) + (views * 10)
      });
    }).filter((row) => row.title);
  }
  function rowsFromSummaryFallbackKpis() {
    const summary = getSummary();
    const topTitle = clean(summary.top_listing_title || "");
    if (!topTitle) return [];
    return [normalizeRow({
      id: `summary_top_${titleKey(topTitle)}`,
      title: topTitle,
      health_label: "Summary Fallback",
      recommended_action: "Inspect in source dashboard section",
      popularity_score: 1
    })];
  }
  function mergeRowsWithPriority(sourceRows) {
    const map = new Map();
    sourceRows.forEach(({ rows, priority, label }) => {
      rows.forEach((row) => {
        const key = clean(row.id || row.vin || row.stock_number || row.title).toLowerCase();
        if (!key) return;
        const existing = map.get(key);
        const payload = { ...row, __priority: priority, __source: label };
        if (!existing || priority >= existing.__priority) {
          map.set(key, payload);
        }
      });
    });
    return Array.from(map.values()).map(({ __priority, __source, ...row }) => row);
  }
  function resolveCanonicalListings() {
    const globalRows = rowsFromGlobalState();
    const overviewRows = rowsFromOverviewCardsDom();
    const topRows = rowsFromTopListingsDom();
    const summaryRows = rowsFromSummaryRecent();
    const summaryFallbackRows = rowsFromSummaryFallbackKpis();

    let rows = [];
    let source = "none";

    if (globalRows.length >= 2) {
      rows = mergeRowsWithPriority([
        { rows: summaryRows, priority: 1, label: "summary_recent" },
        { rows: topRows, priority: 2, label: "top_dom" },
        { rows: overviewRows, priority: 3, label: "overview_dom" },
        { rows: globalRows, priority: 4, label: "global_rows" }
      ]);
      source = "global_rows";
    } else if (overviewRows.length) {
      rows = mergeRowsWithPriority([
        { rows: summaryRows, priority: 1, label: "summary_recent" },
        { rows: topRows, priority: 2, label: "top_dom" },
        { rows: overviewRows, priority: 3, label: "overview_dom" }
      ]);
      source = "overview_dom";
    } else if (summaryRows.length) {
      rows = mergeRowsWithPriority([
        { rows: topRows, priority: 1, label: "top_dom" },
        { rows: summaryRows, priority: 2, label: "summary_recent" }
      ]);
      source = "summary_recent";
    } else if (topRows.length) {
      rows = mergeRowsWithPriority([{ rows: topRows, priority: 1, label: "top_dom" }]);
      source = "top_dom";
    } else if (summaryFallbackRows.length) {
      rows = summaryFallbackRows;
      source = "summary_kpi";
    }

    rows.sort((a, b) => n(b.popularity_score) - n(a.popularity_score));
    state.listingsSource = source;
    return rows;
  }
  function syncCanonicalListings() {
    const rows = resolveCanonicalListings();
    if (rows.length) {
      state.listingsCache = rows;
      window.dashboardListings = shallowCloneRows(rows);
      window.filteredListings = shallowCloneRows(rows);
    } else if (state.listingsCache.length) {
      window.dashboardListings = shallowCloneRows(state.listingsCache);
      window.filteredListings = shallowCloneRows(state.listingsCache);
    }
    return shallowCloneRows(window.dashboardListings || state.listingsCache);
  }
  function getListings() {
    const synced = syncCanonicalListings();
    return Array.isArray(synced) ? synced : [];
  }
  function getActionDetails() {
    return getSummary().action_center_details || {};
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .phase5-shell-note { color: var(--muted); font-size: 12px; line-height: 1.45; }
      .phase5-jumpbar { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin: 12px 0 16px; }
      .phase5-jumpbar .action-btn { min-height: 46px; }
      .phase5-section-hero { margin-bottom: 14px; background: linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.005)); }
      .phase5-eyebrow { color: var(--gold); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 8px; }
      .phase5-toolbar { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:14px; flex-wrap:wrap; }
      .phase5-toolbar-left, .phase5-toolbar-right { display:flex; gap:8px; flex-wrap:wrap; }
      .phase5-toolbar input, .phase5-toolbar select {
        min-width: 220px; background:#1a1a1a; color:#f5f5f5; border:1px solid rgba(255,255,255,.08);
        border-radius:12px; padding:11px 13px;
      }
      .phase5-statusline { color: var(--gold-soft); font-size: 12px; margin: 2px 0 10px; }
      .phase5-listing-card { border-radius: 16px; overflow:hidden; }
      .phase5-listing-card .listing-media { height: 165px; position: relative; }
      .phase5-chiprow {
        position:absolute; left:10px; right:10px; top:10px; display:flex; justify-content:space-between; gap:8px; align-items:flex-start;
      }
      .phase5-chipstack { display:flex; gap:6px; flex-wrap:wrap; }
      .phase5-chip {
        display:inline-flex; align-items:center; min-height:26px; padding:0 9px; border-radius:999px; font-size:11px; font-weight:700;
        border:1px solid rgba(255,255,255,.08); background:#101010; color:#f1f1f1;
      }
      .phase5-chip.critical { background: rgba(120,20,20,.9); color:#ffd3d3; border-color: rgba(255,120,120,.24); }
      .phase5-chip.high { background: rgba(212,175,55,.18); color:#f3ddb0; border-color: rgba(212,175,55,.24); }
      .phase5-chip.medium { background: rgba(80,80,80,.95); color:#f2f2f2; border-color: rgba(255,255,255,.14); }
      .phase5-cardbody { padding:14px; display:grid; gap:8px; }
      .phase5-headline { display:grid; gap:4px; }
      .phase5-title { font-size:18px; font-weight:800; line-height:1.2; }
      .phase5-sub { color: var(--muted); font-size:12px; line-height:1.45; }
      .phase5-pricerow { display:flex; justify-content:space-between; align-items:flex-end; gap:10px; }
      .phase5-price { font-size:24px; font-weight:800; color: var(--gold-soft); line-height:1.1; }
      .phase5-primaryaction { font-size:12px; font-weight:700; color: var(--gold-soft); text-align:right; }
      .phase5-metricrow { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:8px; }
      .phase5-metric {
        background:#171717; border:1px solid rgba(255,255,255,.06); border-radius:12px; padding:9px 10px;
      }
      .phase5-metric-label { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:var(--gold); margin-bottom:4px; font-weight:700; }
      .phase5-metric-value { font-size:13px; font-weight:700; color:#f0f0f0; }
      .phase5-reason {
        background: rgba(212,175,55,.06); border:1px solid rgba(212,175,55,.14); border-radius:12px; padding:10px 11px;
      }
      .phase5-reason-label { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:var(--gold); margin-bottom:4px; font-weight:700; }
      .phase5-reason-copy { font-size:12px; color:#f0e6cc; line-height:1.45; }
      .phase5-actiongrid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:8px; }
      .phase5-mini-row { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:10px; margin-bottom: 14px; }
      .phase5-mini-card { background:#161616; border:1px solid rgba(255,255,255,.06); border-radius:14px; padding:14px; }
      .phase5-mini-label { color: var(--gold); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; font-weight: 700; }
      .phase5-mini-value { font-size: 22px; font-weight: 800; line-height: 1.1; }
      .phase5-queue-grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:16px; margin-bottom: 16px; }
      .phase5-queue { display:grid; gap:10px; }
      .phase5-queue-item {
        display:grid; gap:8px; padding:14px; border-radius:14px; background:#161616; border:1px solid rgba(255,255,255,.06);
      }
      .phase5-queue-top { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
      .phase5-queue-title { font-weight:800; line-height:1.3; }
      .phase5-queue-sub { color: var(--muted); font-size:13px; line-height:1.45; }
      .phase5-queue-meta { display:flex; gap:6px; flex-wrap:wrap; }
      .phase5-empty { padding: 22px; text-align:center; color: var(--muted); border:1px dashed rgba(212,175,55,.18); border-radius: 14px; background:#111; }
      .phase5-overview-compressed .phase5-onboarding-card { padding:18px !important; }
      .phase5-overview-compressed .card h2.phase5-primary-hero { font-size: 24px !important; line-height:1.06 !important; }
      .phase5-overview-compressed .phase5-onboarding-card .stat-row,
      .phase5-overview-compressed .phase5-onboarding-card .mini-stat-grid { gap:8px !important; }
      @media (max-width: 1100px) {
        .phase5-queue-grid, .phase5-mini-row, .phase5-jumpbar, .phase5-actiongrid, .phase5-metricrow { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 760px) {
        .phase5-toolbar { flex-direction: column; align-items: stretch; }
        .phase5-toolbar input, .phase5-toolbar select { min-width: 100%; width: 100%; }
        .phase5-queue-grid, .phase5-mini-row, .phase5-jumpbar, .phase5-actiongrid, .phase5-metricrow { grid-template-columns: 1fr; }
      }
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
    section.innerHTML = `
      <div class="card phase5-section-hero">
        <div class="phase5-eyebrow">${title}</div>
        <h2>${title}</h2>
        <div class="subtext">${subtitle}</div>
      </div>
    `;
    return section;
  }

  function ensureSections() {
    const mainInner = qs(".main-inner");
    if (!mainInner) return;

    if (!document.getElementById(SECTION_LISTINGS)) {
      const listings = sectionShell(
        SECTION_LISTINGS,
        "Listings",
        "Cleaner portfolio cards with stronger price, status, and next-action hierarchy."
      );
      listings.insertAdjacentHTML("beforeend", `
        <div class="phase5-toolbar card">
          <div class="phase5-toolbar-left">
            <button class="action-btn active" type="button" data-phase5-filter="all">All</button>
            <button class="action-btn" type="button" data-phase5-filter="active">Active</button>
            <button class="action-btn" type="button" data-phase5-filter="review">Review</button>
            <button class="action-btn" type="button" data-phase5-filter="weak">Weak</button>
            <button class="action-btn" type="button" data-phase5-filter="likely_sold">Likely Sold</button>
            <button class="action-btn" type="button" data-phase5-filter="needs_action">Needs Action</button>
          </div>
          <div class="phase5-toolbar-right">
            <select id="phase5ListingsSort">
              <option value="popular">Sort: Most Popular</option>
              <option value="newest">Sort: Newest</option>
              <option value="price_high">Sort: Price High → Low</option>
              <option value="price_low">Sort: Price Low → High</option>
            </select>
            <input id="phase5ListingsSearch" type="text" placeholder="Search make, model, VIN, stock..." />
          </div>
        </div>
        <div id="phase5ListingsStatus" class="phase5-statusline"></div>
        <div id="phase5ListingsGrid" class="listing-grid"></div>
      `);
      mainInner.appendChild(listings);
    }

    if (!document.getElementById(SECTION_REVIEW)) {
      const review = sectionShell(
        SECTION_REVIEW,
        "Review Center",
        "Sharper triage cards with clearer urgency, reason, and next move."
      );
      review.insertAdjacentHTML("beforeend", `
        <div class="phase5-mini-row">
          <div class="phase5-mini-card"><div class="phase5-mini-label">Review Queue</div><div id="phase5ReviewQueue" class="phase5-mini-value">0</div></div>
          <div class="phase5-mini-card"><div class="phase5-mini-label">Likely Sold</div><div id="phase5LikelySold" class="phase5-mini-value">0</div></div>
          <div class="phase5-mini-card"><div class="phase5-mini-label">Weak Listings</div><div id="phase5WeakListings" class="phase5-mini-value">0</div></div>
          <div class="phase5-mini-card"><div class="phase5-mini-label">Promote Now</div><div id="phase5PromoteNow" class="phase5-mini-value">0</div></div>
        </div>
        <div id="phase5ReviewStatus" class="phase5-statusline"></div>
        <div class="phase5-queue-grid">
          <div class="card"><div class="section-head"><h2>Needs Attention</h2></div><div id="phase5NeedsAttention" class="phase5-queue"></div></div>
          <div class="card"><div class="section-head"><h2>Today</h2></div><div id="phase5TodayQueue" class="phase5-queue"></div></div>
          <div class="card"><div class="section-head"><h2>Opportunities</h2></div><div id="phase5Opportunities" class="phase5-queue"></div></div>
        </div>
        <div class="card">
          <div class="section-head">
            <div>
              <h2>Priority Review Cards</h2>
              <div class="subtext">Triage-first cards using the same canonical portfolio rows.</div>
            </div>
          </div>
          <div id="phase5ReviewCards" class="listing-grid"></div>
        </div>
      `);
      mainInner.appendChild(review);
    }
  }

  function patchOverview() {
    const overview = document.getElementById("overview");
    if (!overview) return;
    overview.classList.add("phase5-overview-compressed");
    let onboardingCard = null;
    qsa("#overview .card").forEach((card) => {
      const heading = clean(card.querySelector("h2")?.textContent || "");
      if (/complete setup to unlock first-post value|operator snapshot and next actions|action priorities and lifecycle pressure/i.test(heading)) onboardingCard = card;
    });
    if (onboardingCard) {
      onboardingCard.classList.add("phase5-onboarding-card");
      const heading = onboardingCard.querySelector("h2");
      if (heading) {
        heading.textContent = "Operator command center.";
        heading.classList.add("phase5-primary-hero");
      }
      const firstSub = onboardingCard.querySelector(".subtext, p");
      if (firstSub) firstSub.textContent = "Keep setup visible, but let live portfolio pressure and next actions lead the page.";
    }
    if (!overview.querySelector("#phase5OverviewJumpbar")) {
      const target = document.getElementById("overviewBlockers") || onboardingCard || overview.firstElementChild;
      const wrap = document.createElement("div");
      wrap.id = "phase5OverviewJumpbar";
      wrap.className = "phase5-jumpbar";
      wrap.innerHTML = `
        <button class="action-btn" type="button" data-phase5-open="${SECTION_LISTINGS}">Open Listings</button>
        <button class="action-btn" type="button" data-phase5-open="${SECTION_REVIEW}">Open Review Center</button>
        <button class="action-btn" type="button" data-phase5-open="extension">Open Tools</button>
        <button class="action-btn" type="button" data-phase5-open="profile">Open Setup</button>
      `;
      if (target?.insertAdjacentElement) target.insertAdjacentElement("afterend", wrap);
      else overview.prepend(wrap);
    }
  }

  function buildLifecycleBadge(item) {
    const text = clean(item.lifecycle_status || item.review_bucket || item.status || "active").replace(/_/g, " ") || "active";
    return `<span class="phase5-chip">${text}</span>`;
  }
  function buildUrgencyChip(item) {
    const level = urgencyLevel(item);
    return `<span class="phase5-chip ${level}">${urgencyLabel(item)}</span>`;
  }

  function buildListingCard(item = {}, context = "listings") {
    const id = clean(item.id || "");
    const title = clean(item.title || [item.year, item.make, item.model, item.trim].filter(Boolean).join(" ")) || "Vehicle Listing";
    const image = clean(item.image_url || "") || placeholderVehicleImage(title);
    const subtitle = [
      item.stock_number ? `Stock ${clean(item.stock_number)}` : "",
      item.vin ? `VIN ${clean(item.vin)}` : "",
      clean(item.body_style || "")
    ].filter(Boolean).join(" • ") || "Vehicle details";
    const reasonCopy = clean(item.recommended_action || item.pricing_insight || item.health_label || "No immediate issue detected.");
    const nextMove = primaryAction(item);

    const actions = context === "review"
      ? `
        <div class="phase5-actiongrid">
          <button class="action-btn" type="button" data-phase5-open-detail="${id}">Inspect</button>
          <button class="action-btn" type="button" data-phase5-status="${id}:sold">Mark Sold</button>
          <button class="action-btn" type="button" data-phase5-status="${id}:active">Mark Active</button>
          <button class="action-btn" type="button" data-phase5-status="${id}:price_review">Review Price</button>
          <button class="action-btn" type="button" data-phase5-open="${SECTION_LISTINGS}">Open Listings</button>
          <button class="action-btn" type="button" data-phase5-copy="${id}">Copy Summary</button>
        </div>
      `
      : `
        <div class="phase5-actiongrid">
          <button class="action-btn" type="button" data-phase5-open-detail="${id}">Inspect</button>
          <button class="action-btn" type="button" data-phase5-status="${id}:approved">Approve</button>
          <button class="action-btn" type="button" data-phase5-status="${id}:sold">Mark Sold</button>
          <button class="action-btn" type="button" data-phase5-open="${SECTION_REVIEW}">Review</button>
          <button class="action-btn" type="button" data-phase5-copy="${id}">Copy Summary</button>
          <button class="action-btn" type="button" data-phase5-open-source="${id}">Open Source</button>
        </div>
      `;

    return `
      <article class="listing-card phase5-listing-card">
        <div class="listing-media">
          <img src="${image}" alt="${title}" loading="lazy" onerror="this.src='${placeholderVehicleImage(title)}'" />
          <div class="phase5-chiprow">
            <div class="phase5-chipstack">
              ${buildLifecycleBadge(item)}
              ${buildUrgencyChip(item)}
            </div>
            <div class="phase5-chipstack">
              <span class="phase5-chip">${clean(item.health_label || "Tracked")}</span>
            </div>
          </div>
        </div>
        <div class="phase5-cardbody">
          <div class="phase5-headline">
            <div class="phase5-title">${title}</div>
            <div class="phase5-sub">${subtitle}</div>
          </div>
          <div class="phase5-pricerow">
            <div class="phase5-price">${formatCurrency(item.price)}</div>
            <div class="phase5-primaryaction">Next: ${nextMove}</div>
          </div>
          <div class="phase5-metricrow">
            <div class="phase5-metric"><div class="phase5-metric-label">Views</div><div class="phase5-metric-value">${n(item.views_count)}</div></div>
            <div class="phase5-metric"><div class="phase5-metric-label">Messages</div><div class="phase5-metric-value">${n(item.messages_count)}</div></div>
            <div class="phase5-metric"><div class="phase5-metric-label">Age</div><div class="phase5-metric-value">${n(item.age_days)}d</div></div>
            <div class="phase5-metric"><div class="phase5-metric-label">Last Seen</div><div class="phase5-metric-value">${formatRelative(item.last_seen_at || item.updated_at || item.posted_at)}</div></div>
          </div>
          <div class="phase5-reason">
            <div class="phase5-reason-label">${context === "review" ? "Review reason" : "Portfolio note"}</div>
            <div class="phase5-reason-copy">${reasonCopy}</div>
          </div>
          ${actions}
        </div>
      </article>
    `;
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
    const grid = document.getElementById("phase5ListingsGrid");
    if (!grid) return;
    const rowsBase = getListings();
    const search = clean(document.getElementById("phase5ListingsSearch")?.value || "").toLowerCase();
    const sortMode = clean(document.getElementById("phase5ListingsSort")?.value || "popular").toLowerCase();
    const activeFilter = document.querySelector("[data-phase5-filter].active")?.getAttribute("data-phase5-filter") || "all";
    let rows = [...rowsBase];
    if (activeFilter !== "all") rows = rows.filter((item) => matchesFilter(item, activeFilter));
    if (search) rows = rows.filter((item) => [item.title, item.make, item.model, item.vin, item.stock_number].join(" ").toLowerCase().includes(search));
    rows.sort((a, b) => {
      if (sortMode === "newest") return new Date(b.posted_at || b.updated_at || 0) - new Date(a.posted_at || a.updated_at || 0);
      if (sortMode === "price_high") return n(b.price) - n(a.price);
      if (sortMode === "price_low") return n(a.price) - n(b.price);
      return n(b.popularity_score) - n(a.popularity_score);
    });
    const statusEl = document.getElementById("phase5ListingsStatus");
    if (statusEl) {
      const sourceCopy = state.listingsSource === "global_rows" ? "Live listing rows"
        : state.listingsSource === "overview_dom" ? "Overview portfolio cards"
        : state.listingsSource === "summary_recent" ? "Summary recent listings fallback"
        : state.listingsSource === "top_dom" ? "Top listings fallback"
        : state.listingsSource === "summary_kpi" ? "Summary KPI fallback"
        : "Waiting for portfolio source";
      statusEl.textContent = `${sourceCopy} • ${rowsBase.length} row${rowsBase.length === 1 ? "" : "s"} available`;
    }
    grid.innerHTML = rows.length
      ? rows.map((item) => buildListingCard(item, "listings")).join("")
      : `<div class="phase5-empty">No portfolio rows are available yet.</div>`;
  }

  function queueHtml(items, emptyText) {
    if (!Array.isArray(items) || !items.length) return `<div class="phase5-empty">${emptyText}</div>`;
    return items.slice(0, 8).map((item) => {
      const listing = getListings().find((row) => String(row.id) === String(item.id)) || normalizeRow(item);
      return `
        <div class="phase5-queue-item">
          <div class="phase5-queue-top">
            <div class="phase5-queue-title">${clean(item.title || listing.title || "Listing")}</div>
            ${buildUrgencyChip(listing)}
          </div>
          <div class="phase5-queue-sub">${primaryAction(listing)}</div>
          <div class="phase5-queue-meta">
            <span class="phase5-chip">${formatCurrency(listing.price)}</span>
            <span class="phase5-chip">${n(listing.views_count)} views</span>
            <span class="phase5-chip">${n(listing.messages_count)} msgs</span>
          </div>
          <button class="action-btn" type="button" data-phase5-open-detail="${clean(item.id || listing.id || "")}">Inspect</button>
        </div>
      `;
    }).join("");
  }

  function buildReviewCards() {
    const rows = [...getListings()].filter((item) =>
      Boolean(item.needs_action) ||
      Boolean(item.weak) ||
      Boolean(item.likely_sold) ||
      ["review_delete", "review_price_update", "review_new", "stale"].includes(clean(item.lifecycle_status).toLowerCase())
    );
    rows.sort((a, b) => {
      const score = (row) => {
        let s = 0;
        if (row.likely_sold) s += 50;
        if (row.needs_action) s += 30;
        if (row.weak) s += 20;
        s += n(row.popularity_score) / 100;
        return s;
      };
      return score(b) - score(a);
    });
    return rows.slice(0, 12);
  }

  function renderReviewSection() {
    const summary = getSummary();
    const details = getActionDetails();
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    };
    setText("phase5ReviewQueue", n(summary.review_queue_count));
    setText("phase5LikelySold", n(summary.stale_listings || summary.review_delete_count));
    setText("phase5WeakListings", n(summary.weak_listings));
    setText("phase5PromoteNow", n(summary.action_center?.promote_today || 0));

    const needs = document.getElementById("phase5NeedsAttention");
    const today = document.getElementById("phase5TodayQueue");
    const opp = document.getElementById("phase5Opportunities");
    if (needs) needs.innerHTML = queueHtml(details.needs_attention, "No critical items right now.");
    if (today) today.innerHTML = queueHtml(details.today, "No queued actions for today.");
    if (opp) opp.innerHTML = queueHtml(details.opportunities, "No promotion opportunities yet.");

    const cards = document.getElementById("phase5ReviewCards");
    const rows = buildReviewCards();
    if (cards) {
      cards.innerHTML = rows.length
        ? rows.map((item) => buildListingCard(item, "review")).join("")
        : `<div class="phase5-empty">No review cards are hydrated into this section yet.</div>`;
    }
    const statusEl = document.getElementById("phase5ReviewStatus");
    if (statusEl) {
      statusEl.textContent = `${rows.length} review card${rows.length === 1 ? "" : "s"} hydrated • Portfolio source ${state.listingsSource || "none"}`;
    }
  }

  function setActiveNav(sectionId) {
    qsa("[data-section]").forEach((button) => {
      button.classList.toggle("active", button.getAttribute("data-section") === sectionId);
    });
  }
  function showSectionWithFallback(sectionId) {
    if (!sectionId) return;
    ensureSections();
    const sections = qsa(".dashboard-section");
    let matched = false;
    sections.forEach((section) => {
      const isActive = section.id === sectionId;
      section.style.display = isActive ? "block" : "none";
      if (isActive) matched = true;
    });
    setActiveNav(sectionId);
    const pageTitle = document.getElementById("dashboardPageTitle");
    const titleMap = { listings: "Listings", review_center: "Review Center" };
    if (pageTitle && titleMap[sectionId]) pageTitle.textContent = titleMap[sectionId];
    if (matched && NS.state?.set) NS.state.set("ui.activeSection", sectionId);
  }
  function patchShowSection() {
    if (window.__EA_PHASE5_SHOWSECTION_PATCHED__) return;
    const original = typeof window.showSection === "function" ? window.showSection : null;
    window.__EA_PHASE5_SHOWSECTION_PATCHED__ = true;
    window.showSection = function(sectionId) {
      if (sectionId === SECTION_LISTINGS || sectionId === SECTION_REVIEW) {
        showSectionWithFallback(sectionId);
        scheduleRender();
        return;
      }
      if (original) original(sectionId);
      else showSectionWithFallback(sectionId);
      const titleMap = { listings: "Listings", review_center: "Review Center" };
      const title = document.getElementById("dashboardPageTitle");
      if (title && titleMap[sectionId]) title.textContent = titleMap[sectionId];
    };
  }

  async function handleStatus(id, next) {
    if (!id || !next) return;
    try {
      if (next === "sold" && typeof window.markListingSold === "function") {
        await window.markListingSold(id);
      } else if (typeof window.markListingAction === "function") {
        await window.markListingAction(id, next);
      }
    } catch (error) {
      console.warn("phase5 status action warning", error);
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
      if (typeof window.showSection === "function") window.showSection(sectionId);
      else showSectionWithFallback(sectionId);
    }, true);
  }

  function bindShellEvents() {
    if (state.shellBound) return;
    state.shellBound = true;
    document.addEventListener("click", async (event) => {
      const open = event.target.closest("[data-phase5-open]");
      if (open) {
        const section = open.getAttribute("data-phase5-open");
        if (typeof window.showSection === "function") window.showSection(section);
        return;
      }
      const filter = event.target.closest("[data-phase5-filter]");
      if (filter) {
        qsa("[data-phase5-filter]").forEach((btn) => btn.classList.toggle("active", btn === filter));
        renderListingsSection();
        return;
      }
      const detail = event.target.closest("[data-phase5-open-detail]");
      if (detail) {
        const id = detail.getAttribute("data-phase5-open-detail");
        if (typeof window.openListingDetailModal === "function") window.openListingDetailModal(id);
        return;
      }
      const status = event.target.closest("[data-phase5-status]");
      if (status) {
        const raw = status.getAttribute("data-phase5-status") || "";
        const [id, next] = raw.split(":");
        await handleStatus(id, next);
        return;
      }
      const copyBtn = event.target.closest("[data-phase5-copy]");
      if (copyBtn) {
        const id = copyBtn.getAttribute("data-phase5-copy");
        if (typeof window.copyVehicleSummary === "function") window.copyVehicleSummary(id);
        return;
      }
      const sourceBtn = event.target.closest("[data-phase5-open-source]");
      if (sourceBtn) {
        const id = sourceBtn.getAttribute("data-phase5-open-source");
        const row = getListings().find((item) => String(item.id) === String(id));
        if (row?.source_url && typeof window.openListingSource === "function") {
          window.openListingSource(id, row.source_url);
        }
      }
    });
    document.addEventListener("input", (event) => {
      if (event.target?.id === "phase5ListingsSearch") renderListingsSection();
    });
    document.addEventListener("change", (event) => {
      if (event.target?.id === "phase5ListingsSort") renderListingsSection();
    });
  }

  function scheduleRender() {
    clearTimeout(state.renderTimer);
    state.renderTimer = setTimeout(() => {
      try { renderAll(); } catch (error) { console.warn("phase5 render warning", error); }
    }, 140);
  }

  function bindHydrationBridge() {
    if (state.hydrationBound) return;
    state.hydrationBound = true;
    const overviewGrid = document.getElementById("recentListingsGrid");
    const topListings = document.getElementById("topListings");
    const observeNode = (node) => {
      if (!node) return;
      const observer = new MutationObserver(() => {
        syncCanonicalListings();
        scheduleRender();
      });
      observer.observe(node, { childList: true, subtree: true });
    };
    if (!state.observerBound) {
      observeNode(overviewGrid);
      observeNode(topListings);
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
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
