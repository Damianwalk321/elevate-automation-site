
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  const MODULE_KEY = "phase21shell";
  const STYLE_ID = "ea-phase42-hydration-bridge-shell";
  const SECTION_LISTINGS = "listings";
  const SECTION_REVIEW = "review_center";

  if (NS.modules?.[MODULE_KEY]) delete NS.modules[MODULE_KEY];

  const bridgeState = {
    listingsCache: [],
    observerBound: false,
    eventsBound: false,
    navBound: false,
    shellBound: false,
    hydrationBound: false,
    renderTimer: null
  };

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
  function n(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }
  function qs(selector, root = document) {
    return root.querySelector(selector);
  }
  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }
  function formatCurrency(value) {
    const amount = n(value);
    if (!amount) return "$0";
    try {
      return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0
      }).format(amount);
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
  function getSummary() {
    return window.dashboardSummary || {};
  }
  function shallowCloneRows(rows) {
    return Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
  }
  function titleToKey(title) {
    return clean(title || "").toLowerCase();
  }
  function placeholderVehicleImage(label) {
    const text = encodeURIComponent(clean(label || "Vehicle"));
    return `https://placehold.co/800x500/111111/d4af37?text=${text}`;
  }

  function normalizeRow(row = {}) {
    const title = clean(row.title || [row.year, row.make, row.model, row.trim].filter(Boolean).join(" ")) || "Vehicle Listing";
    return {
      id: clean(row.id || row.marketplace_listing_id || row.source_url || titleToKey(title) || `row_${Date.now()}_${Math.random().toString(36).slice(2,8)}`),
      title,
      image_url: clean(row.image_url || row.cover_photo || row.photo || row.coverImage || ""),
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
    const globals = shallowCloneRows(window.dashboardListings);
    return globals.filter(Boolean).map(normalizeRow).filter((row) => row.title);
  }

  function rowsFromSummary() {
    const summaryRows = shallowCloneRows(getSummary().recent_listings);
    return summaryRows.filter(Boolean).map(normalizeRow).filter((row) => row.title);
  }

  function inferLifecycleFromText(text) {
    const raw = clean(text).toLowerCase();
    if (/review delete|likely sold|sold/i.test(raw)) return "review_delete";
    if (/review price|price review/i.test(raw)) return "review_price_update";
    if (/review new/i.test(raw)) return "review_new";
    if (/stale/i.test(raw)) return "stale";
    return raw || "active";
  }

  function rowsFromDomCards() {
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
        id: `dom_${index}_${titleToKey(title) || "listing"}`,
        title,
        image_url: img && !img.includes("placehold.co") ? img : placeholderVehicleImage(title),
        stock_number: stockMatch ? stockMatch[1] : "",
        vin: vinMatch ? vinMatch[1] : "",
        body_style: sub.includes("•") ? clean(sub.split("•").slice(-1)[0]) : "",
        price: n(priceText.replace(/[^\d.-]/g, "")),
        views_count: views,
        messages_count: messages,
        age_days: ageDays,
        lifecycle_status: inferLifecycleFromText(badge || noteText),
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

  function coalesceListings() {
    const fromGlobal = rowsFromGlobalState();
    const fromSummary = rowsFromSummary();
    const fromDom = rowsFromDomCards();

    const byKey = new Map();
    const addRows = (rows, priority) => {
      rows.forEach((row) => {
        const key = clean(row.id || row.vin || row.stock_number || row.title).toLowerCase();
        if (!key) return;
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, { ...row, __priority: priority });
          return;
        }
        if (priority >= existing.__priority) {
          byKey.set(key, {
            ...existing,
            ...row,
            image_url: clean(row.image_url || existing.image_url),
            title: clean(row.title || existing.title),
            __priority: priority
          });
        }
      });
    };

    addRows(fromSummary, 1);
    addRows(fromDom, 2);
    addRows(fromGlobal, 3);

    const merged = Array.from(byKey.values()).map(({ __priority, ...row }) => row);
    merged.sort((a, b) => n(b.popularity_score) - n(a.popularity_score));
    return merged;
  }

  function syncBridgeState() {
    const merged = coalesceListings();
    if (merged.length) {
      bridgeState.listingsCache = merged;
      window.dashboardListings = shallowCloneRows(merged);
      window.filteredListings = shallowCloneRows(merged);
    } else if (bridgeState.listingsCache.length) {
      window.dashboardListings = shallowCloneRows(bridgeState.listingsCache);
      window.filteredListings = shallowCloneRows(bridgeState.listingsCache);
    }
    return shallowCloneRows(window.dashboardListings || bridgeState.listingsCache);
  }

  function getListings() {
    const synced = syncBridgeState();
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
      .phase42-shell-note { color: var(--muted); font-size: 13px; line-height: 1.5; }
      .phase42-jumpbar { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin: 14px 0 18px; }
      .phase42-jumpbar .action-btn { min-height: 48px; }
      .phase42-section-hero { margin-bottom: 16px; background: linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.005)); }
      .phase42-eyebrow { color: var(--gold); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 8px; }
      .phase42-toolbar { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
      .phase42-toolbar-left, .phase42-toolbar-right { display:flex; gap:8px; flex-wrap:wrap; }
      .phase42-toolbar input, .phase42-toolbar select { min-width: 220px; background:#1a1a1a; color:#f5f5f5; border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:12px 14px; }
      .phase42-listing-card { border-radius: 16px; }
      .phase42-listing-card .listing-media { height: 170px; }
      .phase42-listing-card .listing-content { gap: 10px; }
      .phase42-mini-row { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin-bottom: 16px; }
      .phase42-mini-card { background:#161616; border:1px solid rgba(255,255,255,.06); border-radius:14px; padding:14px; }
      .phase42-mini-label { color: var(--gold); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; font-weight: 700; }
      .phase42-mini-value { font-size: 22px; font-weight: 800; line-height: 1.1; }
      .phase42-queue-grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:16px; margin-bottom: 18px; }
      .phase42-queue { display:grid; gap:10px; }
      .phase42-queue-item { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; padding:14px; border-radius:14px; background:#161616; border:1px solid rgba(255,255,255,.06); }
      .phase42-queue-title { font-weight:700; margin-bottom:5px; }
      .phase42-queue-sub { color: var(--muted); font-size:13px; line-height:1.45; }
      .phase42-queue-meta { color: var(--gold-soft); font-size:12px; line-height:1.45; margin-top: 6px; }
      .phase42-overview-compressed .card h2.phase42-primary-hero { font-size: 28px !important; line-height: 1.08 !important; }
      .phase42-overview-compressed .phase42-onboarding-card { border-color: rgba(212,175,55,.16); }
      .phase42-review-actions, .phase42-listing-actions { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:8px; margin-top: 10px; }
      .phase42-empty { padding: 22px; text-align:center; color: var(--muted); border:1px dashed rgba(212,175,55,.18); border-radius: 14px; background:#111; }
      .phase42-statusline { color: var(--gold-soft); font-size: 12px; margin: 4px 0 12px; }
      @media (max-width: 1100px) {
        .phase42-queue-grid, .phase42-mini-row, .phase42-jumpbar, .phase42-review-actions, .phase42-listing-actions { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 760px) {
        .phase42-toolbar { flex-direction: column; align-items: stretch; }
        .phase42-toolbar input, .phase42-toolbar select { min-width: 100%; width: 100%; }
        .phase42-queue-grid, .phase42-mini-row, .phase42-jumpbar, .phase42-review-actions, .phase42-listing-actions { grid-template-columns: 1fr; }
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
      <div class="card phase42-section-hero">
        <div class="phase42-eyebrow">${title}</div>
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
        "Hydrated client post library with lifecycle-aware filters, traction context, and quick actions."
      );
      listings.insertAdjacentHTML("beforeend", `
        <div class="phase42-toolbar card">
          <div class="phase42-toolbar-left">
            <button class="action-btn active" type="button" data-phase42-filter="all">All</button>
            <button class="action-btn" type="button" data-phase42-filter="active">Active</button>
            <button class="action-btn" type="button" data-phase42-filter="review">Review</button>
            <button class="action-btn" type="button" data-phase42-filter="weak">Weak</button>
            <button class="action-btn" type="button" data-phase42-filter="likely_sold">Likely Sold</button>
            <button class="action-btn" type="button" data-phase42-filter="needs_action">Needs Action</button>
          </div>
          <div class="phase42-toolbar-right">
            <select id="phase42ListingsSort">
              <option value="popular">Sort: Most Popular</option>
              <option value="newest">Sort: Newest</option>
              <option value="price_high">Sort: Price High → Low</option>
              <option value="price_low">Sort: Price Low → High</option>
            </select>
            <input id="phase42ListingsSearch" type="text" placeholder="Search make, model, VIN, stock..." />
          </div>
        </div>
        <div id="phase42ListingsStatus" class="phase42-statusline"></div>
        <div id="phase42ListingsGrid" class="listing-grid"></div>
      `);
      mainInner.appendChild(listings);
    }

    if (!document.getElementById(SECTION_REVIEW)) {
      const review = sectionShell(
        SECTION_REVIEW,
        "Review Center",
        "Hydrated review queues and operator cards sourced from live dashboard state."
      );
      review.insertAdjacentHTML("beforeend", `
        <div class="phase42-mini-row">
          <div class="phase42-mini-card"><div class="phase42-mini-label">Review Queue</div><div id="phase42ReviewQueue" class="phase42-mini-value">0</div></div>
          <div class="phase42-mini-card"><div class="phase42-mini-label">Likely Sold</div><div id="phase42LikelySold" class="phase42-mini-value">0</div></div>
          <div class="phase42-mini-card"><div class="phase42-mini-label">Weak Listings</div><div id="phase42WeakListings" class="phase42-mini-value">0</div></div>
          <div class="phase42-mini-card"><div class="phase42-mini-label">Promote Now</div><div id="phase42PromoteNow" class="phase42-mini-value">0</div></div>
        </div>
        <div id="phase42ReviewStatus" class="phase42-statusline"></div>
        <div class="phase42-queue-grid">
          <div class="card"><div class="section-head"><h2>Needs Attention</h2></div><div id="phase42NeedsAttention" class="phase42-queue"></div></div>
          <div class="card"><div class="section-head"><h2>Today</h2></div><div id="phase42TodayQueue" class="phase42-queue"></div></div>
          <div class="card"><div class="section-head"><h2>Opportunities</h2></div><div id="phase42Opportunities" class="phase42-queue"></div></div>
        </div>
        <div class="card">
          <div class="section-head">
            <div>
              <h2>Operator Actions</h2>
              <div class="subtext">Hydrated review cards with direct decisions.</div>
            </div>
          </div>
          <div id="phase42ReviewCards" class="listing-grid"></div>
        </div>
      `);
      mainInner.appendChild(review);
    }
  }

  function patchOverview() {
    const overview = document.getElementById("overview");
    if (!overview) return;
    overview.classList.add("phase42-overview-compressed");

    let onboardingCard = null;
    qsa("#overview .card").forEach((card) => {
      const heading = clean(card.querySelector("h2")?.textContent || "");
      if (/complete setup to unlock first-post value|operator snapshot and next actions|action priorities and lifecycle pressure/i.test(heading)) onboardingCard = card;
    });

    if (onboardingCard) {
      onboardingCard.classList.add("phase42-onboarding-card");
      const heading = onboardingCard.querySelector("h2");
      if (heading) {
        heading.textContent = "Operator snapshot and next actions.";
        heading.classList.add("phase42-primary-hero");
      }
      const firstSub = onboardingCard.querySelector(".subtext, p");
      if (firstSub) {
        firstSub.textContent = "This page should prioritize action, queue pressure, and listing health first.";
      }
    }

    if (!overview.querySelector("#phase42OverviewJumpbar")) {
      const target = document.getElementById("overviewBlockers") || onboardingCard || overview.firstElementChild;
      const wrap = document.createElement("div");
      wrap.id = "phase42OverviewJumpbar";
      wrap.className = "phase42-jumpbar";
      wrap.innerHTML = `
        <button class="action-btn" type="button" data-phase42-open="${SECTION_LISTINGS}">Open Listings</button>
        <button class="action-btn" type="button" data-phase42-open="${SECTION_REVIEW}">Open Review Center</button>
        <button class="action-btn" type="button" data-phase42-open="extension">Open Tools</button>
        <button class="action-btn" type="button" data-phase42-open="profile">Open Setup</button>
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
        <div class="phase42-review-actions">
          <button class="action-btn" type="button" data-phase42-open-detail="${id}">Inspect</button>
          <button class="action-btn" type="button" data-phase42-status="${id}:approved">Approve</button>
          <button class="action-btn" type="button" data-phase42-status="${id}:sold">Mark Sold</button>
          <button class="action-btn" type="button" data-phase42-status="${id}:active">Mark Active</button>
          <button class="action-btn" type="button" data-phase42-open="${SECTION_LISTINGS}">Open Listings</button>
          <button class="action-btn" type="button" data-phase42-copy="${id}">Copy Summary</button>
        </div>
      `
      : `
        <div class="phase42-listing-actions">
          <button class="action-btn" type="button" data-phase42-open-detail="${id}">Inspect</button>
          <button class="action-btn" type="button" data-phase42-status="${id}:approved">Approve</button>
          <button class="action-btn" type="button" data-phase42-status="${id}:sold">Mark Sold</button>
          <button class="action-btn" type="button" data-phase42-open="${SECTION_REVIEW}">Review</button>
          <button class="action-btn" type="button" data-phase42-copy="${id}">Copy Summary</button>
          <button class="action-btn" type="button" data-phase42-open-source="${id}">Open Source</button>
        </div>
      `;

    return `
      <article class="listing-card phase42-listing-card">
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
          <div class="phase42-shell-note"><strong>Health:</strong> ${clean(item.health_label || "Healthy")} • <strong>Recommended:</strong> ${clean(item.recommended_action || "Keep live")}</div>
          <div class="phase42-shell-note"><strong>Pricing:</strong> ${clean(item.pricing_insight || "Pricing signal still developing.")}</div>
          <div class="listing-metrics">
            <div class="metric-pill"><div class="metric-pill-label">Views</div><div class="metric-pill-value">${n(item.views_count)}</div></div>
            <div class="metric-pill"><div class="metric-pill-label">Messages</div><div class="metric-pill-value">${n(item.messages_count)}</div></div>
            <div class="metric-pill"><div class="metric-pill-label">Age</div><div class="metric-pill-value">${n(item.age_days)}d</div></div>
          </div>
          <div class="phase42-shell-note"><strong>Last seen:</strong> ${formatRelative(item.last_seen_at || item.updated_at || item.posted_at)}</div>
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
    const grid = document.getElementById("phase42ListingsGrid");
    if (!grid) return;

    const rowsBase = getListings();
    const search = clean(document.getElementById("phase42ListingsSearch")?.value || "").toLowerCase();
    const sortMode = clean(document.getElementById("phase42ListingsSort")?.value || "popular").toLowerCase();
    const activeFilter = document.querySelector("[data-phase42-filter].active")?.getAttribute("data-phase42-filter") || "all";

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

    const statusEl = document.getElementById("phase42ListingsStatus");
    if (statusEl) {
      const sourceLabel = rowsBase.length ? `Hydrated ${rowsBase.length} listing row${rowsBase.length === 1 ? "" : "s"}` : "Waiting for listing hydration";
      statusEl.textContent = `${sourceLabel} • Source bridge active`;
    }

    grid.innerHTML = rows.length
      ? rows.map((item) => buildListingCard(item, "listings")).join("")
      : `<div class="phase42-empty">No listings are hydrated into this section yet.</div>`;
  }

  function queueHtml(items, emptyText) {
    if (!Array.isArray(items) || !items.length) return `<div class="phase42-empty">${emptyText}</div>`;
    return items.slice(0, 8).map((item) => {
      const listing = getListings().find((row) => String(row.id) === String(item.id)) || normalizeRow(item);
      return `
        <div class="phase42-queue-item">
          <div>
            <div class="phase42-queue-title">${clean(item.title || listing.title || "Listing")}</div>
            <div class="phase42-queue-sub">${clean(item.reason || item.recommended_action || listing.recommended_action || "Review required.")}</div>
            <div class="phase42-queue-meta">
              ${formatCurrency(listing.price)} • ${n(listing.views_count)} views • ${n(listing.messages_count)} messages
            </div>
          </div>
          <div>
            <button class="action-btn" type="button" data-phase42-open-detail="${clean(item.id || listing.id || "")}">Inspect</button>
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
    setText("phase42ReviewQueue", n(summary.review_queue_count));
    setText("phase42LikelySold", n(summary.stale_listings || summary.review_delete_count));
    setText("phase42WeakListings", n(summary.weak_listings));
    setText("phase42PromoteNow", n(summary.action_center?.promote_today || 0));

    const needs = document.getElementById("phase42NeedsAttention");
    const today = document.getElementById("phase42TodayQueue");
    const opp = document.getElementById("phase42Opportunities");
    if (needs) needs.innerHTML = queueHtml(details.needs_attention, "No critical items right now.");
    if (today) today.innerHTML = queueHtml(details.today, "No queued actions for today.");
    if (opp) opp.innerHTML = queueHtml(details.opportunities, "No promotion opportunities yet.");

    const cards = document.getElementById("phase42ReviewCards");
    const rows = buildReviewCards();
    if (cards) {
      cards.innerHTML = rows.length
        ? rows.map((item) => buildListingCard(item, "review")).join("")
        : `<div class="phase42-empty">No review cards are hydrated into this section yet.</div>`;
    }

    const statusEl = document.getElementById("phase42ReviewStatus");
    if (statusEl) {
      statusEl.textContent = `${rows.length} review card${rows.length === 1 ? "" : "s"} hydrated • Queue bridge active`;
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
    if (window.__EA_PHASE42_SHOWSECTION_PATCHED__) return;
    const original = typeof window.showSection === "function" ? window.showSection : null;
    window.__EA_PHASE42_SHOWSECTION_PATCHED__ = true;

    window.showSection = function(sectionId) {
      if (sectionId === SECTION_LISTINGS || sectionId === SECTION_REVIEW) {
        showSectionWithFallback(sectionId);
        safeScheduleRender();
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
      console.warn("phase42 status action warning", error);
    }
    safeScheduleRender();
  }

  function bindNavHotfix() {
    if (bridgeState.navBound) return;
    bridgeState.navBound = true;

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
    if (bridgeState.shellBound) return;
    bridgeState.shellBound = true;

    document.addEventListener("click", async (event) => {
      const open = event.target.closest("[data-phase42-open]");
      if (open) {
        const section = open.getAttribute("data-phase42-open");
        if (typeof window.showSection === "function") window.showSection(section);
        return;
      }

      const filter = event.target.closest("[data-phase42-filter]");
      if (filter) {
        qsa("[data-phase42-filter]").forEach((btn) => btn.classList.toggle("active", btn === filter));
        renderListingsSection();
        return;
      }

      const detail = event.target.closest("[data-phase42-open-detail]");
      if (detail) {
        const id = detail.getAttribute("data-phase42-open-detail");
        if (typeof window.openListingDetailModal === "function") window.openListingDetailModal(id);
        return;
      }

      const status = event.target.closest("[data-phase42-status]");
      if (status) {
        const raw = status.getAttribute("data-phase42-status") || "";
        const [id, next] = raw.split(":");
        await handleStatus(id, next);
        return;
      }

      const copyBtn = event.target.closest("[data-phase42-copy]");
      if (copyBtn) {
        const id = copyBtn.getAttribute("data-phase42-copy");
        if (typeof window.copyVehicleSummary === "function") window.copyVehicleSummary(id);
        return;
      }

      const sourceBtn = event.target.closest("[data-phase42-open-source]");
      if (sourceBtn) {
        const id = sourceBtn.getAttribute("data-phase42-open-source");
        const row = getListings().find((item) => String(item.id) === String(id));
        if (row?.source_url && typeof window.openListingSource === "function") {
          window.openListingSource(id, row.source_url);
        }
      }
    });

    document.addEventListener("input", (event) => {
      if (event.target?.id === "phase42ListingsSearch") renderListingsSection();
    });
    document.addEventListener("change", (event) => {
      if (event.target?.id === "phase42ListingsSort") renderListingsSection();
    });
  }

  function safeScheduleRender() {
    clearTimeout(bridgeState.renderTimer);
    bridgeState.renderTimer = setTimeout(() => {
      try { renderAll(); } catch (error) { console.warn("phase42 render warning", error); }
    }, 120);
  }

  function bindHydrationBridge() {
    if (bridgeState.hydrationBound) return;
    bridgeState.hydrationBound = true;

    const recentGrid = document.getElementById("recentListingsGrid");
    if (recentGrid && !bridgeState.observerBound) {
      const observer = new MutationObserver(() => {
        syncBridgeState();
        safeScheduleRender();
      });
      observer.observe(recentGrid, { childList: true, subtree: true });
      bridgeState.observerBound = true;
    }

    if (!bridgeState.eventsBound) {
      bridgeState.eventsBound = true;
      window.addEventListener("elevate:tracking-refreshed", safeScheduleRender);
      document.addEventListener("DOMContentLoaded", safeScheduleRender);
      setTimeout(safeScheduleRender, 600);
      setTimeout(safeScheduleRender, 1600);
      setTimeout(safeScheduleRender, 3200);
      setTimeout(safeScheduleRender, 5500);
    }
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
    syncBridgeState();
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
