
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  const MODULE_KEY = "phase21shell";
  const STYLE_ID = "ea-phase43-listings-source-truth-shell";
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
      .phase43-shell-note { color: var(--muted); font-size: 13px; line-height: 1.5; }
      .phase43-jumpbar { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin: 14px 0 18px; }
      .phase43-jumpbar .action-btn { min-height: 48px; }
      .phase43-section-hero { margin-bottom: 16px; background: linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.005)); }
      .phase43-eyebrow { color: var(--gold); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 8px; }
      .phase43-toolbar { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
      .phase43-toolbar-left, .phase43-toolbar-right { display:flex; gap:8px; flex-wrap:wrap; }
      .phase43-toolbar input, .phase43-toolbar select { min-width: 220px; background:#1a1a1a; color:#f5f5f5; border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:12px 14px; }
      .phase43-listing-card { border-radius: 16px; }
      .phase43-listing-card .listing-media { height: 170px; }
      .phase43-listing-card .listing-content { gap: 10px; }
      .phase43-mini-row { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin-bottom: 16px; }
      .phase43-mini-card { background:#161616; border:1px solid rgba(255,255,255,.06); border-radius:14px; padding:14px; }
      .phase43-mini-label { color: var(--gold); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; font-weight: 700; }
      .phase43-mini-value { font-size: 22px; font-weight: 800; line-height: 1.1; }
      .phase43-queue-grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:16px; margin-bottom: 18px; }
      .phase43-queue { display:grid; gap:10px; }
      .phase43-queue-item { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; padding:14px; border-radius:14px; background:#161616; border:1px solid rgba(255,255,255,.06); }
      .phase43-queue-title { font-weight:700; margin-bottom:5px; }
      .phase43-queue-sub { color: var(--muted); font-size:13px; line-height:1.45; }
      .phase43-queue-meta { color: var(--gold-soft); font-size:12px; line-height:1.45; margin-top: 6px; }
      .phase43-overview-compressed .card h2.phase43-primary-hero { font-size: 28px !important; line-height: 1.08 !important; }
      .phase43-overview-compressed .phase43-onboarding-card { border-color: rgba(212,175,55,.16); }
      .phase43-review-actions, .phase43-listing-actions { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:8px; margin-top: 10px; }
      .phase43-empty { padding: 22px; text-align:center; color: var(--muted); border:1px dashed rgba(212,175,55,.18); border-radius: 14px; background:#111; }
      .phase43-statusline { color: var(--gold-soft); font-size: 12px; margin: 4px 0 12px; }
      @media (max-width: 1100px) {
        .phase43-queue-grid, .phase43-mini-row, .phase43-jumpbar, .phase43-review-actions, .phase43-listing-actions { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 760px) {
        .phase43-toolbar { flex-direction: column; align-items: stretch; }
        .phase43-toolbar input, .phase43-toolbar select { min-width: 100%; width: 100%; }
        .phase43-queue-grid, .phase43-mini-row, .phase43-jumpbar, .phase43-review-actions, .phase43-listing-actions { grid-template-columns: 1fr; }
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
      <div class="card phase43-section-hero">
        <div class="phase43-eyebrow">${title}</div>
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
        "Portfolio page fed from the same live listing sources already powering the dashboard."
      );
      listings.insertAdjacentHTML("beforeend", `
        <div class="phase43-toolbar card">
          <div class="phase43-toolbar-left">
            <button class="action-btn active" type="button" data-phase43-filter="all">All</button>
            <button class="action-btn" type="button" data-phase43-filter="active">Active</button>
            <button class="action-btn" type="button" data-phase43-filter="review">Review</button>
            <button class="action-btn" type="button" data-phase43-filter="weak">Weak</button>
            <button class="action-btn" type="button" data-phase43-filter="likely_sold">Likely Sold</button>
            <button class="action-btn" type="button" data-phase43-filter="needs_action">Needs Action</button>
          </div>
          <div class="phase43-toolbar-right">
            <select id="phase43ListingsSort">
              <option value="popular">Sort: Most Popular</option>
              <option value="newest">Sort: Newest</option>
              <option value="price_high">Sort: Price High → Low</option>
              <option value="price_low">Sort: Price Low → High</option>
            </select>
            <input id="phase43ListingsSearch" type="text" placeholder="Search make, model, VIN, stock..." />
          </div>
        </div>
        <div id="phase43ListingsStatus" class="phase43-statusline"></div>
        <div id="phase43ListingsGrid" class="listing-grid"></div>
      `);
      mainInner.appendChild(listings);
    }

    if (!document.getElementById(SECTION_REVIEW)) {
      const review = sectionShell(
        SECTION_REVIEW,
        "Review Center",
        "Review queues fed from the same canonical listing bridge."
      );
      review.insertAdjacentHTML("beforeend", `
        <div class="phase43-mini-row">
          <div class="phase43-mini-card"><div class="phase43-mini-label">Review Queue</div><div id="phase43ReviewQueue" class="phase43-mini-value">0</div></div>
          <div class="phase43-mini-card"><div class="phase43-mini-label">Likely Sold</div><div id="phase43LikelySold" class="phase43-mini-value">0</div></div>
          <div class="phase43-mini-card"><div class="phase43-mini-label">Weak Listings</div><div id="phase43WeakListings" class="phase43-mini-value">0</div></div>
          <div class="phase43-mini-card"><div class="phase43-mini-label">Promote Now</div><div id="phase43PromoteNow" class="phase43-mini-value">0</div></div>
        </div>
        <div id="phase43ReviewStatus" class="phase43-statusline"></div>
        <div class="phase43-queue-grid">
          <div class="card"><div class="section-head"><h2>Needs Attention</h2></div><div id="phase43NeedsAttention" class="phase43-queue"></div></div>
          <div class="card"><div class="section-head"><h2>Today</h2></div><div id="phase43TodayQueue" class="phase43-queue"></div></div>
          <div class="card"><div class="section-head"><h2>Opportunities</h2></div><div id="phase43Opportunities" class="phase43-queue"></div></div>
        </div>
        <div class="card">
          <div class="section-head">
            <div>
              <h2>Operator Actions</h2>
              <div class="subtext">Review cards sourced from the same canonical portfolio rows.</div>
            </div>
          </div>
          <div id="phase43ReviewCards" class="listing-grid"></div>
        </div>
      `);
      mainInner.appendChild(review);
    }
  }

  function patchOverview() {
    const overview = document.getElementById("overview");
    if (!overview) return;
    overview.classList.add("phase43-overview-compressed");

    let onboardingCard = null;
    qsa("#overview .card").forEach((card) => {
      const heading = clean(card.querySelector("h2")?.textContent || "");
      if (/complete setup to unlock first-post value|operator snapshot and next actions|action priorities and lifecycle pressure/i.test(heading)) onboardingCard = card;
    });

    if (onboardingCard) {
      onboardingCard.classList.add("phase43-onboarding-card");
      const heading = onboardingCard.querySelector("h2");
      if (heading) {
        heading.textContent = "Operator snapshot and next actions.";
        heading.classList.add("phase43-primary-hero");
      }
      const firstSub = onboardingCard.querySelector(".subtext, p");
      if (firstSub) firstSub.textContent = "This page should prioritize action, queue pressure, and listing health first.";
    }

    if (!overview.querySelector("#phase43OverviewJumpbar")) {
      const target = document.getElementById("overviewBlockers") || onboardingCard || overview.firstElementChild;
      const wrap = document.createElement("div");
      wrap.id = "phase43OverviewJumpbar";
      wrap.className = "phase43-jumpbar";
      wrap.innerHTML = `
        <button class="action-btn" type="button" data-phase43-open="${SECTION_LISTINGS}">Open Listings</button>
        <button class="action-btn" type="button" data-phase43-open="${SECTION_REVIEW}">Open Review Center</button>
        <button class="action-btn" type="button" data-phase43-open="extension">Open Tools</button>
        <button class="action-btn" type="button" data-phase43-open="profile">Open Setup</button>
      `;
      if (target?.insertAdjacentElement) target.insertAdjacentElement("afterend", wrap);
      else overview.prepend(wrap);
    }
  }

  function buildLifecycleBadge(item) {
    const text = clean(item.lifecycle_status || item.review_bucket || item.status || "active").replace(/_/g, " ");
    return `<span class="badge warn">${text || "active"}</span>`;
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

    const actions = context === "review"
      ? `
        <div class="phase43-review-actions">
          <button class="action-btn" type="button" data-phase43-open-detail="${id}">Inspect</button>
          <button class="action-btn" type="button" data-phase43-status="${id}:approved">Approve</button>
          <button class="action-btn" type="button" data-phase43-status="${id}:sold">Mark Sold</button>
          <button class="action-btn" type="button" data-phase43-status="${id}:active">Mark Active</button>
          <button class="action-btn" type="button" data-phase43-open="${SECTION_LISTINGS}">Open Listings</button>
          <button class="action-btn" type="button" data-phase43-copy="${id}">Copy Summary</button>
        </div>
      `
      : `
        <div class="phase43-listing-actions">
          <button class="action-btn" type="button" data-phase43-open-detail="${id}">Inspect</button>
          <button class="action-btn" type="button" data-phase43-status="${id}:approved">Approve</button>
          <button class="action-btn" type="button" data-phase43-status="${id}:sold">Mark Sold</button>
          <button class="action-btn" type="button" data-phase43-open="${SECTION_REVIEW}">Review</button>
          <button class="action-btn" type="button" data-phase43-copy="${id}">Copy Summary</button>
          <button class="action-btn" type="button" data-phase43-open-source="${id}">Open Source</button>
        </div>
      `;

    return `
      <article class="listing-card phase43-listing-card">
        <div class="listing-media">
          <img src="${image}" alt="${title}" loading="lazy" onerror="this.src='${placeholderVehicleImage(title)}'" />
          <div class="listing-badge">${buildLifecycleBadge(item)}</div>
        </div>
        <div class="listing-content">
          <div>
            <div class="listing-title">${title}</div>
            <div class="listing-sub">${subtitle}</div>
          </div>
          <div class="listing-price">${formatCurrency(item.price)}</div>
          <div class="phase43-shell-note"><strong>Health:</strong> ${clean(item.health_label || "Healthy")} • <strong>Recommended:</strong> ${clean(item.recommended_action || "Keep live")}</div>
          <div class="phase43-shell-note"><strong>Pricing:</strong> ${clean(item.pricing_insight || "Pricing signal still developing.")}</div>
          <div class="listing-metrics">
            <div class="metric-pill"><div class="metric-pill-label">Views</div><div class="metric-pill-value">${n(item.views_count)}</div></div>
            <div class="metric-pill"><div class="metric-pill-label">Messages</div><div class="metric-pill-value">${n(item.messages_count)}</div></div>
            <div class="metric-pill"><div class="metric-pill-label">Age</div><div class="metric-pill-value">${n(item.age_days)}d</div></div>
          </div>
          <div class="phase43-shell-note"><strong>Last seen:</strong> ${formatRelative(item.last_seen_at || item.updated_at || item.posted_at)}</div>
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
    const grid = document.getElementById("phase43ListingsGrid");
    if (!grid) return;

    const rowsBase = getListings();
    const search = clean(document.getElementById("phase43ListingsSearch")?.value || "").toLowerCase();
    const sortMode = clean(document.getElementById("phase43ListingsSort")?.value || "popular").toLowerCase();
    const activeFilter = document.querySelector("[data-phase43-filter].active")?.getAttribute("data-phase43-filter") || "all";

    let rows = [...rowsBase];
    if (activeFilter !== "all") rows = rows.filter((item) => matchesFilter(item, activeFilter));
    if (search) {
      rows = rows.filter((item) => [item.title, item.make, item.model, item.vin, item.stock_number].join(" ").toLowerCase().includes(search));
    }

    rows.sort((a, b) => {
      if (sortMode === "newest") return new Date(b.posted_at || b.updated_at || 0) - new Date(a.posted_at || a.updated_at || 0);
      if (sortMode === "price_high") return n(b.price) - n(a.price);
      if (sortMode === "price_low") return n(a.price) - n(b.price);
      return n(b.popularity_score) - n(a.popularity_score);
    });

    const statusEl = document.getElementById("phase43ListingsStatus");
    if (statusEl) {
      const sourceName = state.listingsSource || "none";
      const sourceCopy = sourceName === "global_rows"
        ? "Live listing rows"
        : sourceName === "overview_dom"
          ? "Overview portfolio cards"
          : sourceName === "summary_recent"
            ? "Summary recent listings fallback"
            : sourceName === "top_dom"
              ? "Top listings fallback"
              : sourceName === "summary_kpi"
                ? "Summary KPI fallback"
                : "Waiting for portfolio source";
      statusEl.textContent = `${sourceCopy} • ${rowsBase.length} row${rowsBase.length === 1 ? "" : "s"} available`;
    }

    grid.innerHTML = rows.length
      ? rows.map((item) => buildListingCard(item, "listings")).join("")
      : `<div class="phase43-empty">No portfolio rows are available yet. The source-of-truth bridge is still waiting on listing data.</div>`;
  }

  function queueHtml(items, emptyText) {
    if (!Array.isArray(items) || !items.length) return `<div class="phase43-empty">${emptyText}</div>`;
    return items.slice(0, 8).map((item) => {
      const listing = getListings().find((row) => String(row.id) === String(item.id)) || normalizeRow(item);
      return `
        <div class="phase43-queue-item">
          <div>
            <div class="phase43-queue-title">${clean(item.title || listing.title || "Listing")}</div>
            <div class="phase43-queue-sub">${clean(item.reason || item.recommended_action || listing.recommended_action || "Review required.")}</div>
            <div class="phase43-queue-meta">
              ${formatCurrency(listing.price)} • ${n(listing.views_count)} views • ${n(listing.messages_count)} messages
            </div>
          </div>
          <div>
            <button class="action-btn" type="button" data-phase43-open-detail="${clean(item.id || listing.id || "")}">Inspect</button>
          </div>
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
      const aw = Number(Boolean(a.likely_sold)) + Number(Boolean(a.needs_action)) + Number(Boolean(a.weak));
      const bw = Number(Boolean(b.likely_sold)) + Number(Boolean(b.needs_action)) + Number(Boolean(b.weak));
      return bw - aw || n(b.popularity_score) - n(a.popularity_score);
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
    setText("phase43ReviewQueue", n(summary.review_queue_count));
    setText("phase43LikelySold", n(summary.stale_listings || summary.review_delete_count));
    setText("phase43WeakListings", n(summary.weak_listings));
    setText("phase43PromoteNow", n(summary.action_center?.promote_today || 0));

    const needs = document.getElementById("phase43NeedsAttention");
    const today = document.getElementById("phase43TodayQueue");
    const opp = document.getElementById("phase43Opportunities");
    if (needs) needs.innerHTML = queueHtml(details.needs_attention, "No critical items right now.");
    if (today) today.innerHTML = queueHtml(details.today, "No queued actions for today.");
    if (opp) opp.innerHTML = queueHtml(details.opportunities, "No promotion opportunities yet.");

    const cards = document.getElementById("phase43ReviewCards");
    const rows = buildReviewCards();
    if (cards) {
      cards.innerHTML = rows.length
        ? rows.map((item) => buildListingCard(item, "review")).join("")
        : `<div class="phase43-empty">No review cards are hydrated into this section yet.</div>`;
    }

    const statusEl = document.getElementById("phase43ReviewStatus");
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
    if (window.__EA_PHASE43_SHOWSECTION_PATCHED__) return;
    const original = typeof window.showSection === "function" ? window.showSection : null;
    window.__EA_PHASE43_SHOWSECTION_PATCHED__ = true;

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
      console.warn("phase43 status action warning", error);
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
      const open = event.target.closest("[data-phase43-open]");
      if (open) {
        const section = open.getAttribute("data-phase43-open");
        if (typeof window.showSection === "function") window.showSection(section);
        return;
      }

      const filter = event.target.closest("[data-phase43-filter]");
      if (filter) {
        qsa("[data-phase43-filter]").forEach((btn) => btn.classList.toggle("active", btn === filter));
        renderListingsSection();
        return;
      }

      const detail = event.target.closest("[data-phase43-open-detail]");
      if (detail) {
        const id = detail.getAttribute("data-phase43-open-detail");
        if (typeof window.openListingDetailModal === "function") window.openListingDetailModal(id);
        return;
      }

      const status = event.target.closest("[data-phase43-status]");
      if (status) {
        const raw = status.getAttribute("data-phase43-status") || "";
        const [id, next] = raw.split(":");
        await handleStatus(id, next);
        return;
      }

      const copyBtn = event.target.closest("[data-phase43-copy]");
      if (copyBtn) {
        const id = copyBtn.getAttribute("data-phase43-copy");
        if (typeof window.copyVehicleSummary === "function") window.copyVehicleSummary(id);
        return;
      }

      const sourceBtn = event.target.closest("[data-phase43-open-source]");
      if (sourceBtn) {
        const id = sourceBtn.getAttribute("data-phase43-open-source");
        const row = getListings().find((item) => String(item.id) === String(id));
        if (row?.source_url && typeof window.openListingSource === "function") {
          window.openListingSource(id, row.source_url);
        }
      }
    });

    document.addEventListener("input", (event) => {
      if (event.target?.id === "phase43ListingsSearch") renderListingsSection();
    });
    document.addEventListener("change", (event) => {
      if (event.target?.id === "phase43ListingsSort") renderListingsSection();
    });
  }

  function scheduleRender() {
    clearTimeout(state.renderTimer);
    state.renderTimer = setTimeout(() => {
      try { renderAll(); } catch (error) { console.warn("phase43 render warning", error); }
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
