
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  const MODULE_KEY = "phase21shell";
  const STYLE_ID = "ea-phase4-lifecycle-operator-shell";

  const SECTION_LISTINGS = "listings";
  const SECTION_REVIEW = "review_center";

  if (NS.modules?.[MODULE_KEY]) delete NS.modules[MODULE_KEY];

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
  function getSummary() {
    return window.dashboardSummary || {};
  }
  function getListings() {
    if (Array.isArray(window.dashboardListings) && window.dashboardListings.length) return window.dashboardListings;
    return Array.isArray(getSummary().recent_listings) ? getSummary().recent_listings : [];
  }
  function getActionDetails() {
    return getSummary().action_center_details || {};
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
  function formatDate(value) {
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
    return formatDate(value);
  }
  function lifecycle(item) {
    return clean(item.lifecycle_status || item.review_bucket || item.status || "active").toLowerCase();
  }
  function urgencyLevel(item) {
    if (item.likely_sold || lifecycle(item) === "review_delete") return "critical";
    if (item.needs_action || lifecycle(item) === "review_price_update") return "high";
    if (item.weak || lifecycle(item) === "review_new" || lifecycle(item) === "stale") return "medium";
    return "normal";
  }
  function confidenceLabel(item) {
    const score = n(item.confidence_score || item.match_confidence || item.lifecycle_confidence);
    if (score >= 80) return "High confidence";
    if (score >= 55) return "Moderate confidence";
    if (score > 0) return "Low confidence";
    if (item.likely_sold) return "High confidence";
    if (item.needs_action || item.weak) return "Moderate confidence";
    return "Developing";
  }
  function queueReason(item) {
    return clean(
      item.reason ||
      item.recommended_action ||
      item.pricing_insight ||
      item.health_label ||
      item.lifecycle_status ||
      "Lifecycle review required."
    );
  }
  function healthSortValue(item) {
    let score = 0;
    if (item.likely_sold) score += 50;
    if (item.needs_action) score += 30;
    if (item.weak) score += 20;
    if (["review_delete", "review_price_update", "review_new", "stale"].includes(lifecycle(item))) score += 15;
    score += n(item.popularity_score) / 100;
    return score;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .phase4-shell-note { color: var(--muted); font-size: 13px; line-height: 1.5; }
      .phase4-overview-compressed #overview .card h2.phase4-primary-hero { font-size: 26px !important; line-height: 1.08 !important; }
      .phase4-overview-compressed #overview .phase4-onboarding-card { padding: 20px !important; }
      .phase4-jumpbar {
        display:grid;
        grid-template-columns: repeat(4, minmax(0,1fr));
        gap:10px;
        margin: 12px 0 16px;
      }
      .phase4-section-hero {
        margin-bottom:16px;
        background: linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.005));
      }
      .phase4-eyebrow {
        color: var(--gold);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: .12em;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .phase4-toolbar {
        display:flex;
        justify-content:space-between;
        align-items:center;
        flex-wrap:wrap;
        gap:12px;
        margin-bottom: 16px;
      }
      .phase4-toolbar-left, .phase4-toolbar-right {
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }
      .phase4-toolbar input, .phase4-toolbar select {
        min-width:220px;
        background:#1a1a1a;
        color:#f5f5f5;
        border:1px solid rgba(255,255,255,.08);
        border-radius:12px;
        padding:12px 14px;
      }
      .phase4-filter.active {
        background: linear-gradient(135deg, rgba(212,175,55,0.18), rgba(212,175,55,0.06));
        border-color: rgba(212,175,55,0.52);
      }
      .phase4-listing-grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:16px; }
      .phase4-card {
        background: linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0));
        border: 1px solid rgba(212,175,55,0.12);
        border-radius: 18px;
        overflow: hidden;
        box-shadow: var(--shadow);
      }
      .phase4-media { position:relative; height:170px; background:#171717; border-bottom:1px solid rgba(255,255,255,.05); }
      .phase4-media img { width:100%; height:100%; object-fit:cover; display:block; }
      .phase4-badge-row {
        position:absolute;
        top:10px;
        left:10px;
        right:10px;
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:8px;
      }
      .phase4-chip-stack { display:flex; gap:6px; flex-wrap:wrap; }
      .phase4-chip {
        display:inline-flex;
        align-items:center;
        min-height: 28px;
        padding: 0 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .04em;
        border:1px solid rgba(255,255,255,.08);
        background:#111;
        color:#f3f3f3;
      }
      .phase4-chip.urgency-critical { background: rgba(120,20,20,.88); color:#ffd3d3; border-color: rgba(255,120,120,.25); }
      .phase4-chip.urgency-high { background: rgba(212,175,55,.18); color:#f3ddb0; border-color: rgba(212,175,55,.25); }
      .phase4-chip.urgency-medium { background: rgba(65,65,65,.9); color:#ececec; border-color: rgba(255,255,255,.12); }
      .phase4-body { padding:16px; display:grid; gap:10px; }
      .phase4-title { font-size:18px; font-weight:700; line-height:1.3; }
      .phase4-sub { color:var(--muted); font-size:13px; line-height:1.5; }
      .phase4-price { font-size:24px; font-weight:700; color: var(--gold-soft); line-height: 1.2; }
      .phase4-metrics { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:8px; }
      .phase4-metric {
        background:#171717;
        border:1px solid rgba(255,255,255,.06);
        border-radius:12px;
        padding:10px;
      }
      .phase4-metric-label {
        font-size:11px;
        text-transform:uppercase;
        letter-spacing: .08em;
        color: var(--gold);
        margin-bottom: 5px;
        font-weight: 700;
      }
      .phase4-metric-value {
        font-size:14px;
        font-weight:700;
        color:#f0f0f0;
      }
      .phase4-action-grid {
        display:grid;
        grid-template-columns: repeat(3, minmax(0,1fr));
        gap:8px;
        margin-top: 2px;
      }
      .phase4-mini-row {
        display:grid;
        grid-template-columns: repeat(5, minmax(0,1fr));
        gap:10px;
        margin-bottom: 16px;
      }
      .phase4-mini-card {
        background:#161616;
        border:1px solid rgba(255,255,255,.06);
        border-radius:14px;
        padding:14px;
      }
      .phase4-mini-label {
        color: var(--gold);
        font-size: 11px;
        letter-spacing: .08em;
        text-transform: uppercase;
        margin-bottom: 6px;
        font-weight: 700;
      }
      .phase4-mini-value { font-size: 22px; font-weight: 800; line-height:1.1; }
      .phase4-queue-grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:16px; margin-bottom:18px; }
      .phase4-queue { display:grid; gap:10px; }
      .phase4-queue-item {
        display:flex;
        justify-content:space-between;
        gap:10px;
        align-items:flex-start;
        padding:14px;
        border-radius:14px;
        background:#161616;
        border:1px solid rgba(255,255,255,.06);
      }
      .phase4-queue-title { font-weight:700; margin-bottom:5px; }
      .phase4-queue-sub { color:var(--muted); font-size:13px; line-height:1.45; }
      .phase4-queue-meta { color: var(--gold-soft); font-size:12px; line-height:1.45; margin-top:6px; }
      .phase4-empty {
        padding:24px;
        text-align:center;
        color:var(--muted);
        border:1px dashed rgba(212,175,55,.18);
        border-radius:14px;
        background:#111;
      }
      @media (max-width: 1200px) {
        .phase4-listing-grid, .phase4-queue-grid, .phase4-mini-row { grid-template-columns: repeat(2, minmax(0,1fr)); }
      }
      @media (max-width: 780px) {
        .phase4-jumpbar, .phase4-listing-grid, .phase4-queue-grid, .phase4-mini-row, .phase4-action-grid, .phase4-metrics { grid-template-columns: 1fr; }
        .phase4-toolbar { flex-direction:column; align-items:stretch; }
        .phase4-toolbar input, .phase4-toolbar select { min-width:100%; width:100%; }
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
      <div class="card phase4-section-hero">
        <div class="phase4-eyebrow">${title}</div>
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
        "Full client post portfolio with lifecycle filters, health sorting, and quick actions."
      );
      listings.insertAdjacentHTML("beforeend", `
        <div class="phase4-toolbar card">
          <div class="phase4-toolbar-left">
            <button class="action-btn phase4-filter active" type="button" data-phase4-filter="all">All</button>
            <button class="action-btn phase4-filter" type="button" data-phase4-filter="active">Active</button>
            <button class="action-btn phase4-filter" type="button" data-phase4-filter="review">Review</button>
            <button class="action-btn phase4-filter" type="button" data-phase4-filter="price_review">Price Review</button>
            <button class="action-btn phase4-filter" type="button" data-phase4-filter="weak">Weak</button>
            <button class="action-btn phase4-filter" type="button" data-phase4-filter="likely_sold">Likely Sold</button>
            <button class="action-btn phase4-filter" type="button" data-phase4-filter="promote">Promote</button>
          </div>
          <div class="phase4-toolbar-right">
            <select id="phase4ListingsSort">
              <option value="health">Sort: Health Priority</option>
              <option value="popular">Sort: Most Popular</option>
              <option value="newest">Sort: Newest</option>
              <option value="last_seen">Sort: Last Seen</option>
              <option value="price_high">Sort: Price High → Low</option>
              <option value="price_low">Sort: Price Low → High</option>
            </select>
            <input id="phase4ListingsSearch" type="text" placeholder="Search make, model, VIN, stock..." />
          </div>
        </div>
        <div id="phase4ListingsGrid" class="phase4-listing-grid"></div>
      `);
      mainInner.appendChild(listings);
    }

    if (!document.getElementById(SECTION_REVIEW)) {
      const review = sectionShell(
        SECTION_REVIEW,
        "Review Center",
        "Lifecycle execution workspace for sold, stale, weak, and pricing-pressure decisions."
      );
      review.insertAdjacentHTML("beforeend", `
        <div class="phase4-mini-row">
          <div class="phase4-mini-card"><div class="phase4-mini-label">Review Queue</div><div id="phase4ReviewQueue" class="phase4-mini-value">0</div></div>
          <div class="phase4-mini-card"><div class="phase4-mini-label">Likely Sold</div><div id="phase4LikelySold" class="phase4-mini-value">0</div></div>
          <div class="phase4-mini-card"><div class="phase4-mini-label">Price Review</div><div id="phase4PriceReview" class="phase4-mini-value">0</div></div>
          <div class="phase4-mini-card"><div class="phase4-mini-label">Weak Listings</div><div id="phase4WeakListings" class="phase4-mini-value">0</div></div>
          <div class="phase4-mini-card"><div class="phase4-mini-label">Promote Now</div><div id="phase4PromoteNow" class="phase4-mini-value">0</div></div>
        </div>
        <div class="phase4-queue-grid">
          <div class="card"><div class="section-head"><h2>Needs Attention</h2></div><div id="phase4NeedsAttention" class="phase4-queue"></div></div>
          <div class="card"><div class="section-head"><h2>Today</h2></div><div id="phase4TodayQueue" class="phase4-queue"></div></div>
          <div class="card"><div class="section-head"><h2>Opportunities</h2></div><div id="phase4Opportunities" class="phase4-queue"></div></div>
        </div>
        <div class="card">
          <div class="section-head">
            <div>
              <h2>Lifecycle Actions</h2>
              <div class="subtext">Direct operator cards with urgency, confidence, and one-click decisions.</div>
            </div>
          </div>
          <div id="phase4ReviewCards" class="phase4-listing-grid"></div>
        </div>
      `);
      mainInner.appendChild(review);
    }
  }

  function patchOverview() {
    const overview = document.getElementById("overview");
    if (!overview) return;
    document.body.classList.add("phase4-overview-compressed");

    let onboardingCard = null;
    qsa("#overview .card").forEach((card) => {
      const heading = clean(card.querySelector("h2")?.textContent || "");
      if (/complete setup to unlock first-post value|operator snapshot and next actions/i.test(heading)) onboardingCard = card;
    });

    if (onboardingCard) {
      onboardingCard.classList.add("phase4-onboarding-card");
      const heading = onboardingCard.querySelector("h2");
      if (heading) {
        heading.textContent = "Action priorities and lifecycle pressure.";
        heading.classList.add("phase4-primary-hero");
      }
      const firstSub = onboardingCard.querySelector(".subtext, p");
      if (firstSub) {
        firstSub.textContent = "Keep setup visible, but keep this page focused on review pressure, live inventory health, and next best operator moves.";
      }
      const setupBtn = qsa("button", onboardingCard).find((btn) => /setup/i.test(clean(btn.textContent || "")));
      if (setupBtn) setupBtn.textContent = "Open Setup";
      const reviewBtn = qsa("button", onboardingCard).find((btn) => /review center|walkthrough/i.test(clean(btn.textContent || "")));
      if (reviewBtn) reviewBtn.textContent = "Open Review Center";
    }

    if (!overview.querySelector("#phase4OverviewJumpbar")) {
      const target = document.getElementById("overviewBlockers") || onboardingCard || overview.firstElementChild;
      const wrap = document.createElement("div");
      wrap.id = "phase4OverviewJumpbar";
      wrap.className = "phase4-jumpbar";
      wrap.innerHTML = `
        <button class="action-btn" type="button" data-phase4-open="${SECTION_LISTINGS}">Open Listings</button>
        <button class="action-btn" type="button" data-phase4-open="${SECTION_REVIEW}">Open Review Center</button>
        <button class="action-btn" type="button" data-phase4-open="extension">Open Tools</button>
        <button class="action-btn" type="button" data-phase4-open="profile">Open Setup</button>
      `;
      if (target?.insertAdjacentElement) target.insertAdjacentElement("afterend", wrap);
      else overview.prepend(wrap);
    }
  }

  function buildBadgeChip(text, cls = "") {
    return `<span class="phase4-chip ${cls}">${text}</span>`;
  }

  function lifecycleDisplay(item) {
    return clean(item.lifecycle_status || item.review_bucket || item.status || "active").replace(/_/g, " ") || "active";
  }

  function buildListingCard(item = {}, mode = "listings") {
    const id = clean(item.id || "");
    const title = clean(item.title || [item.year, item.make, item.model, item.trim].filter(Boolean).join(" ")) || "Vehicle Listing";
    const image = clean(item.image_url || "");
    const subtitle = [
      item.stock_number ? `Stock ${clean(item.stock_number)}` : "",
      item.vin ? `VIN ${clean(item.vin)}` : "",
      clean(item.body_style || "")
    ].filter(Boolean).join(" • ") || "Vehicle details";

    const urgency = urgencyLevel(item);
    const confidence = confidenceLabel(item);
    const reason = queueReason(item);

    const buttons = mode === "review"
      ? `
        <div class="phase4-action-grid">
          <button class="action-btn" type="button" data-phase4-open-detail="${id}">Inspect</button>
          <button class="action-btn" type="button" data-phase4-status="${id}:sold">Mark Sold</button>
          <button class="action-btn" type="button" data-phase4-status="${id}:active">Mark Active</button>
          <button class="action-btn" type="button" data-phase4-status="${id}:price_review">Needs Price Review</button>
          <button class="action-btn" type="button" data-phase4-status="${id}:snoozed">Snooze</button>
          <button class="action-btn" type="button" data-phase4-status="${id}:promote">Promote</button>
        </div>
      `
      : `
        <div class="phase4-action-grid">
          <button class="action-btn" type="button" data-phase4-open-detail="${id}">Inspect</button>
          <button class="action-btn" type="button" data-phase4-status="${id}:approved">Approve</button>
          <button class="action-btn" type="button" data-phase4-status="${id}:sold">Mark Sold</button>
          <button class="action-btn" type="button" data-phase4-status="${id}:price_review">Price Review</button>
          <button class="action-btn" type="button" data-phase4-open="${SECTION_REVIEW}">Review</button>
          <button class="action-btn" type="button" data-phase4-copy="${id}">Copy Summary</button>
        </div>
      `;

    return `
      <article class="phase4-card">
        <div class="phase4-media">
          ${image ? `<img src="${image}" alt="${title}" loading="lazy" />` : ""}
          <div class="phase4-badge-row">
            <div class="phase4-chip-stack">
              ${buildBadgeChip(lifecycleDisplay(item))}
              ${buildBadgeChip(urgency.toUpperCase(), `urgency-${urgency}`)}
            </div>
            <div class="phase4-chip-stack">
              ${buildBadgeChip(confidence)}
            </div>
          </div>
        </div>
        <div class="phase4-body">
          <div>
            <div class="phase4-title">${title}</div>
            <div class="phase4-sub">${subtitle}</div>
          </div>
          <div class="phase4-price">${formatCurrency(item.price)}</div>
          <div class="phase4-metrics">
            <div class="phase4-metric"><div class="phase4-metric-label">Views</div><div class="phase4-metric-value">${n(item.views_count)}</div></div>
            <div class="phase4-metric"><div class="phase4-metric-label">Messages</div><div class="phase4-metric-value">${n(item.messages_count)}</div></div>
            <div class="phase4-metric"><div class="phase4-metric-label">Age</div><div class="phase4-metric-value">${n(item.age_days)}d</div></div>
            <div class="phase4-metric"><div class="phase4-metric-label">Last Seen</div><div class="phase4-metric-value">${formatRelative(item.last_seen_at || item.updated_at || item.posted_at)}</div></div>
          </div>
          <div class="phase4-shell-note"><strong>Reason:</strong> ${reason}</div>
          <div class="phase4-shell-note"><strong>Health:</strong> ${clean(item.health_label || "Healthy")} • <strong>Pricing:</strong> ${clean(item.pricing_insight || "Pricing signal still developing.")}</div>
          ${buttons}
        </div>
      </article>
    `;
  }

  function matchesFilter(item, filter) {
    const life = lifecycle(item);
    const status = clean(item.status || "").toLowerCase();
    if (filter === "active") return !["sold", "deleted", "inactive", "stale"].includes(status) && life !== "review_delete";
    if (filter === "review") return ["review_delete", "review_price_update", "review_new", "stale"].includes(life) || Boolean(item.needs_action);
    if (filter === "price_review") return life === "review_price_update" || /price/i.test(queueReason(item));
    if (filter === "weak") return Boolean(item.weak);
    if (filter === "likely_sold") return Boolean(item.likely_sold) || life === "review_delete";
    if (filter === "promote") return /promote/i.test(clean(item.recommended_action || "")) || n(item.views_count) > 0 && n(item.messages_count) === 0;
    return true;
  }

  function renderListingsSection() {
    const grid = document.getElementById("phase4ListingsGrid");
    if (!grid) return;

    const search = clean(document.getElementById("phase4ListingsSearch")?.value || "").toLowerCase();
    const sortMode = clean(document.getElementById("phase4ListingsSort")?.value || "health").toLowerCase();
    const activeFilter = document.querySelector("[data-phase4-filter].active")?.getAttribute("data-phase4-filter") || "all";

    let rows = [...getListings()];
    if (activeFilter !== "all") rows = rows.filter((item) => matchesFilter(item, activeFilter));
    if (search) {
      rows = rows.filter((item) =>
        [item.title, item.make, item.model, item.vin, item.stock_number].join(" ").toLowerCase().includes(search)
      );
    }

    rows.sort((a, b) => {
      if (sortMode === "popular") return n(b.popularity_score) - n(a.popularity_score);
      if (sortMode === "newest") return new Date(b.posted_at || b.updated_at || 0) - new Date(a.posted_at || a.updated_at || 0);
      if (sortMode === "last_seen") return new Date(b.last_seen_at || b.updated_at || 0) - new Date(a.last_seen_at || a.updated_at || 0);
      if (sortMode === "price_high") return n(b.price) - n(a.price);
      if (sortMode === "price_low") return n(a.price) - n(b.price);
      return healthSortValue(b) - healthSortValue(a);
    });

    grid.innerHTML = rows.length
      ? rows.map((item) => buildListingCard(item, "listings")).join("")
      : `<div class="phase4-empty">No listings match this filter yet.</div>`;
  }

  function queueHtml(items, emptyText) {
    if (!Array.isArray(items) || !items.length) return `<div class="phase4-empty">${emptyText}</div>`;
    return items.slice(0, 8).map((item) => {
      const listing = getListings().find((row) => String(row.id) === String(item.id)) || item;
      const urgency = urgencyLevel(listing);
      return `
        <div class="phase4-queue-item">
          <div>
            <div class="phase4-queue-title">${clean(item.title || listing.title || "Listing")}</div>
            <div class="phase4-queue-sub">${queueReason(listing)}</div>
            <div class="phase4-queue-meta">
              ${buildBadgeChip(urgency.toUpperCase(), `urgency-${urgency}`)}
              ${buildBadgeChip(confidenceLabel(listing))}
            </div>
          </div>
          <div>
            <button class="action-btn" type="button" data-phase4-open-detail="${clean(item.id || listing.id || "")}">Inspect</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function reviewRows() {
    const rows = [...getListings()].filter((item) =>
      Boolean(item.likely_sold) ||
      Boolean(item.needs_action) ||
      Boolean(item.weak) ||
      ["review_delete", "review_price_update", "review_new", "stale"].includes(lifecycle(item))
    );
    rows.sort((a, b) => healthSortValue(b) - healthSortValue(a));
    return rows.slice(0, 12);
  }

  function renderReviewSection() {
    const summary = getSummary();
    const details = getActionDetails();
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    };

    setText("phase4ReviewQueue", n(summary.review_queue_count));
    setText("phase4LikelySold", n(summary.stale_listings || summary.review_delete_count));
    setText("phase4PriceReview", n(summary.review_price_change_count));
    setText("phase4WeakListings", n(summary.weak_listings));
    setText("phase4PromoteNow", n(summary.action_center?.promote_today || 0));

    const needs = document.getElementById("phase4NeedsAttention");
    const today = document.getElementById("phase4TodayQueue");
    const opp = document.getElementById("phase4Opportunities");
    if (needs) needs.innerHTML = queueHtml(details.needs_attention, "No critical items right now.");
    if (today) today.innerHTML = queueHtml(details.today, "No queued actions for today.");
    if (opp) opp.innerHTML = queueHtml(details.opportunities, "No promotion opportunities yet.");

    const cards = document.getElementById("phase4ReviewCards");
    if (cards) {
      const rows = reviewRows();
      cards.innerHTML = rows.length
        ? rows.map((item) => buildListingCard(item, "review")).join("")
        : `<div class="phase4-empty">No review cards are active right now.</div>`;
    }
  }

  function patchShowSection() {
    if (window.__EA_PHASE4_SHOWSECTION_PATCHED__) return;
    const original = typeof window.showSection === "function" ? window.showSection : null;
    if (!original) return;
    window.__EA_PHASE4_SHOWSECTION_PATCHED__ = true;

    window.showSection = function(sectionId) {
      original(sectionId);
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
      console.warn("phase4 status action warning", error);
    }
    setTimeout(renderAll, 250);
  }

  function bindEvents() {
    if (document.body?.dataset.phase4ShellBound === "true") return;
    if (document.body) document.body.dataset.phase4ShellBound = "true";

    document.addEventListener("click", async (event) => {
      const open = event.target.closest("[data-phase4-open]");
      if (open) {
        const section = open.getAttribute("data-phase4-open");
        if (typeof window.showSection === "function") window.showSection(section);
        return;
      }

      const filter = event.target.closest("[data-phase4-filter]");
      if (filter) {
        qsa("[data-phase4-filter]").forEach((btn) => btn.classList.toggle("active", btn === filter));
        renderListingsSection();
        return;
      }

      const detail = event.target.closest("[data-phase4-open-detail]");
      if (detail) {
        const id = detail.getAttribute("data-phase4-open-detail");
        if (typeof window.openListingDetailModal === "function") window.openListingDetailModal(id);
        return;
      }

      const status = event.target.closest("[data-phase4-status]");
      if (status) {
        const raw = status.getAttribute("data-phase4-status") || "";
        const [id, next] = raw.split(":");
        await handleStatus(id, next);
        return;
      }

      const copyBtn = event.target.closest("[data-phase4-copy]");
      if (copyBtn) {
        const id = copyBtn.getAttribute("data-phase4-copy");
        if (typeof window.copyVehicleSummary === "function") window.copyVehicleSummary(id);
        return;
      }
    });

    const search = document.getElementById("phase4ListingsSearch");
    if (search && !search.dataset.phase4Bound) {
      search.dataset.phase4Bound = "true";
      search.addEventListener("input", renderListingsSection);
    }
    const sort = document.getElementById("phase4ListingsSort");
    if (sort && !sort.dataset.phase4Bound) {
      sort.dataset.phase4Bound = "true";
      sort.addEventListener("change", renderListingsSection);
    }
  }

  function renderAll() {
    injectStyle();
    ensureNavButtons();
    ensureSections();
    patchOverview();
    patchShowSection();
    bindEvents();
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

  window.addEventListener("elevate:tracking-refreshed", renderAll);
})();
