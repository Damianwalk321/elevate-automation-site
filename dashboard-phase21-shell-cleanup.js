
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  const MODULE_KEY = "phase21shell";
  const STYLE_ID = "ea-phase3-operator-shell";

  if (NS.modules?.[MODULE_KEY]) delete NS.modules[MODULE_KEY];

  const SECTION_LISTINGS = "listings";
  const SECTION_REVIEW = "review_center";

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
  function n(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }
  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }
  function qs(selector, root = document) {
    return root.querySelector(selector);
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
  function getListings() {
    if (Array.isArray(window.dashboardListings) && window.dashboardListings.length) return window.dashboardListings;
    const summaryRows = Array.isArray(getSummary().recent_listings) ? getSummary().recent_listings : [];
    return summaryRows;
  }
  function getActionDetails() {
    return getSummary().action_center_details || {};
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .phase3-shell-note { color: var(--muted); font-size: 13px; line-height: 1.5; }
      .phase3-jumpbar {
        display: grid;
        grid-template-columns: repeat(4, minmax(0,1fr));
        gap: 10px;
        margin: 14px 0 18px;
      }
      .phase3-jumpbar .action-btn { min-height: 48px; }
      .phase3-section-hero {
        margin-bottom: 16px;
        background: linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.005));
      }
      .phase3-eyebrow {
        color: var(--gold);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: .12em;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .phase3-toolbar {
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:center;
        margin-bottom:16px;
        flex-wrap:wrap;
      }
      .phase3-toolbar-left, .phase3-toolbar-right {
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }
      .phase3-toolbar input, .phase3-toolbar select {
        min-width: 220px;
        background:#1a1a1a;
        color:#f5f5f5;
        border:1px solid rgba(255,255,255,.08);
        border-radius:12px;
        padding:12px 14px;
      }
      .phase3-listing-card { border-radius: 16px; }
      .phase3-listing-card .listing-media { height: 170px; }
      .phase3-listing-card .listing-content { gap: 10px; }
      .phase3-mini-row {
        display:grid;
        grid-template-columns: repeat(4, minmax(0,1fr));
        gap: 10px;
        margin-bottom: 16px;
      }
      .phase3-mini-card {
        background:#161616;
        border:1px solid rgba(255,255,255,.06);
        border-radius:14px;
        padding:14px;
      }
      .phase3-mini-label {
        color: var(--gold);
        font-size: 11px;
        letter-spacing: .08em;
        text-transform: uppercase;
        margin-bottom: 6px;
        font-weight: 700;
      }
      .phase3-mini-value {
        font-size: 22px;
        font-weight: 800;
        line-height: 1.1;
      }
      .phase3-queue-grid {
        display:grid;
        grid-template-columns: repeat(3, minmax(0,1fr));
        gap:16px;
        margin-bottom: 18px;
      }
      .phase3-queue {
        display:grid;
        gap:10px;
      }
      .phase3-queue-item {
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:flex-start;
        padding:14px;
        border-radius:14px;
        background:#161616;
        border:1px solid rgba(255,255,255,.06);
      }
      .phase3-queue-title {
        font-weight:700;
        margin-bottom:5px;
      }
      .phase3-queue-sub {
        color: var(--muted);
        font-size:13px;
        line-height:1.45;
      }
      .phase3-queue-meta {
        color: var(--gold-soft);
        font-size:12px;
        line-height:1.45;
        margin-top: 6px;
      }
      .phase3-overview-compressed .card h2.phase3-primary-hero {
        font-size: 28px !important;
        line-height: 1.08 !important;
      }
      .phase3-overview-compressed .phase3-onboarding-card {
        border-color: rgba(212,175,55,.16);
      }
      .phase3-review-actions, .phase3-listing-actions {
        display:grid;
        grid-template-columns: repeat(3, minmax(0,1fr));
        gap:8px;
        margin-top: 10px;
      }
      .phase3-empty {
        padding: 22px;
        text-align:center;
        color: var(--muted);
        border:1px dashed rgba(212,175,55,.18);
        border-radius: 14px;
        background:#111;
      }
      @media (max-width: 1100px) {
        .phase3-queue-grid, .phase3-mini-row, .phase3-jumpbar, .phase3-review-actions, .phase3-listing-actions { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 760px) {
        .phase3-toolbar { flex-direction: column; align-items: stretch; }
        .phase3-toolbar input, .phase3-toolbar select { min-width: 100%; width: 100%; }
        .phase3-queue-grid, .phase3-mini-row, .phase3-jumpbar, .phase3-review-actions, .phase3-listing-actions { grid-template-columns: 1fr; }
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
      <div class="card phase3-section-hero">
        <div class="phase3-eyebrow">${title}</div>
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
        "Full client post library with lifecycle-aware filters, traction context, and quick actions."
      );
      listings.insertAdjacentHTML("beforeend", `
        <div class="phase3-toolbar card">
          <div class="phase3-toolbar-left">
            <button class="action-btn active" type="button" data-phase3-filter="all">All</button>
            <button class="action-btn" type="button" data-phase3-filter="active">Active</button>
            <button class="action-btn" type="button" data-phase3-filter="review">Review</button>
            <button class="action-btn" type="button" data-phase3-filter="weak">Weak</button>
            <button class="action-btn" type="button" data-phase3-filter="likely_sold">Likely Sold</button>
            <button class="action-btn" type="button" data-phase3-filter="needs_action">Needs Action</button>
          </div>
          <div class="phase3-toolbar-right">
            <select id="phase3ListingsSort">
              <option value="popular">Sort: Most Popular</option>
              <option value="newest">Sort: Newest</option>
              <option value="price_high">Sort: Price High → Low</option>
              <option value="price_low">Sort: Price Low → High</option>
            </select>
            <input id="phase3ListingsSearch" type="text" placeholder="Search make, model, VIN, stock..." />
          </div>
        </div>
        <div id="phase3ListingsGrid" class="listing-grid"></div>
      `);
      mainInner.appendChild(listings);
    }

    if (!document.getElementById(SECTION_REVIEW)) {
      const review = sectionShell(
        SECTION_REVIEW,
        "Review Center",
        "Process stale, sold, weak, and pricing-pressure listings from one operator workspace."
      );
      review.insertAdjacentHTML("beforeend", `
        <div class="phase3-mini-row">
          <div class="phase3-mini-card"><div class="phase3-mini-label">Review Queue</div><div id="phase3ReviewQueue" class="phase3-mini-value">0</div></div>
          <div class="phase3-mini-card"><div class="phase3-mini-label">Likely Sold</div><div id="phase3LikelySold" class="phase3-mini-value">0</div></div>
          <div class="phase3-mini-card"><div class="phase3-mini-label">Weak Listings</div><div id="phase3WeakListings" class="phase3-mini-value">0</div></div>
          <div class="phase3-mini-card"><div class="phase3-mini-label">Promote Now</div><div id="phase3PromoteNow" class="phase3-mini-value">0</div></div>
        </div>
        <div class="phase3-queue-grid">
          <div class="card"><div class="section-head"><h2>Needs Attention</h2></div><div id="phase3NeedsAttention" class="phase3-queue"></div></div>
          <div class="card"><div class="section-head"><h2>Today</h2></div><div id="phase3TodayQueue" class="phase3-queue"></div></div>
          <div class="card"><div class="section-head"><h2>Opportunities</h2></div><div id="phase3Opportunities" class="phase3-queue"></div></div>
        </div>
        <div class="card">
          <div class="section-head">
            <div>
              <h2>Operator Actions</h2>
              <div class="subtext">High-value review cards with direct decisions.</div>
            </div>
          </div>
          <div id="phase3ReviewCards" class="listing-grid"></div>
        </div>
      `);
      mainInner.appendChild(review);
    }
  }

  function patchOverview() {
    const overview = document.getElementById("overview");
    if (!overview) return;
    overview.classList.add("phase3-overview-compressed");

    let onboardingCard = null;
    qsa("#overview .card").forEach((card) => {
      const heading = clean(card.querySelector("h2")?.textContent || "");
      if (/complete setup to unlock first-post value/i.test(heading)) onboardingCard = card;
    });

    if (onboardingCard) {
      onboardingCard.classList.add("phase3-onboarding-card");
      const heading = onboardingCard.querySelector("h2");
      if (heading) {
        heading.textContent = "Operator snapshot and next actions.";
        heading.classList.add("phase3-primary-hero");
      }
      const firstSub = onboardingCard.querySelector(".subtext, p");
      if (firstSub) {
        firstSub.textContent = "Setup still matters, but this page should prioritize action, queue pressure, and listing health first.";
      }

      const nextBest = qsa("div, p, h3, h4", onboardingCard).find((el) =>
        /next best move/i.test(clean(el.textContent || ""))
      );
      if (nextBest) nextBest.textContent = "Top operator move";

      const setupBtn = qsa("button", onboardingCard).find((btn) => /complete setup/i.test(clean(btn.textContent || "")));
      if (setupBtn) setupBtn.textContent = "Open Setup";

      const walkBtn = qsa("button", onboardingCard).find((btn) => /walkthrough/i.test(clean(btn.textContent || "")));
      if (walkBtn) walkBtn.textContent = "Open Review Center";
    }

    if (!overview.querySelector("#phase3OverviewJumpbar")) {
      const target = document.getElementById("overviewBlockers") || onboardingCard || overview.firstElementChild;
      const wrap = document.createElement("div");
      wrap.id = "phase3OverviewJumpbar";
      wrap.className = "phase3-jumpbar";
      wrap.innerHTML = `
        <button class="action-btn" type="button" data-phase3-open="${SECTION_LISTINGS}">Open Listings</button>
        <button class="action-btn" type="button" data-phase3-open="${SECTION_REVIEW}">Open Review Center</button>
        <button class="action-btn" type="button" data-phase3-open="extension">Open Tools</button>
        <button class="action-btn" type="button" data-phase3-open="profile">Open Setup</button>
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
    const image = clean(item.image_url || "");
    const subtitle = [
      item.stock_number ? `Stock ${clean(item.stock_number)}` : "",
      item.vin ? `VIN ${clean(item.vin)}` : "",
      clean(item.body_style || "")
    ].filter(Boolean).join(" • ") || "Vehicle details";

    const actions = context === "review"
      ? `
        <div class="phase3-review-actions">
          <button class="action-btn" type="button" data-phase3-open-detail="${id}">Inspect</button>
          <button class="action-btn" type="button" data-phase3-status="${id}:approved">Approve</button>
          <button class="action-btn" type="button" data-phase3-status="${id}:sold">Mark Sold</button>
          <button class="action-btn" type="button" data-phase3-status="${id}:active">Mark Active</button>
          <button class="action-btn" type="button" data-phase3-open="${SECTION_LISTINGS}">Open Listings</button>
          <button class="action-btn" type="button" data-phase3-open-source="${id}">Open Source</button>
        </div>
      `
      : `
        <div class="phase3-listing-actions">
          <button class="action-btn" type="button" data-phase3-open-detail="${id}">Inspect</button>
          <button class="action-btn" type="button" data-phase3-status="${id}:approved">Approve</button>
          <button class="action-btn" type="button" data-phase3-status="${id}:sold">Mark Sold</button>
          <button class="action-btn" type="button" data-phase3-open-source="${id}">Open Source</button>
          <button class="action-btn" type="button" data-phase3-open="${SECTION_REVIEW}">Review</button>
          <button class="action-btn" type="button" data-phase3-copy="${id}">Copy Summary</button>
        </div>
      `;

    return `
      <article class="listing-card phase3-listing-card">
        <div class="listing-media">
          ${image ? `<img src="${image}" alt="${title}" loading="lazy" />` : ""}
          <div class="listing-badge">${buildLifecycleBadge(item)}</div>
        </div>
        <div class="listing-content">
          <div>
            <div class="listing-title">${title}</div>
            <div class="listing-sub">${subtitle}</div>
          </div>
          <div class="listing-price">${formatCurrency(item.price)}</div>
          <div class="listing-metrics">
            <div class="metric-pill"><div class="metric-pill-label">Views</div><div class="metric-pill-value">${n(item.views_count)}</div></div>
            <div class="metric-pill"><div class="metric-pill-label">Messages</div><div class="metric-pill-value">${n(item.messages_count)}</div></div>
            <div class="metric-pill"><div class="metric-pill-label">Age</div><div class="metric-pill-value">${n(item.age_days)}d</div></div>
          </div>
          <div class="phase3-shell-note"><strong>Health:</strong> ${clean(item.health_label || "Healthy")} • <strong>Recommended:</strong> ${clean(item.recommended_action || "Keep live")}</div>
          <div class="phase3-shell-note"><strong>Pricing:</strong> ${clean(item.pricing_insight || "Pricing signal still developing.")}</div>
          <div class="phase3-shell-note"><strong>Last seen:</strong> ${formatRelative(item.last_seen_at || item.updated_at || item.posted_at)}</div>
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
    return true
  }

  function renderListingsSection() {
    const grid = document.getElementById("phase3ListingsGrid");
    if (!grid) return;

    const search = clean(document.getElementById("phase3ListingsSearch")?.value || "").toLowerCase();
    const sortMode = clean(document.getElementById("phase3ListingsSort")?.value || "popular").toLowerCase();
    const activeFilter = document.querySelector("[data-phase3-filter].active")?.getAttribute("data-phase3-filter") || "all";

    let rows = [...getListings()];
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

    grid.innerHTML = rows.length
      ? rows.map((item) => buildListingCard(item, "listings")).join("")
      : `<div class="phase3-empty">No listings match this filter yet.</div>`;
  }

  function queueHtml(items, emptyText) {
    if (!Array.isArray(items) || !items.length) return `<div class="phase3-empty">${emptyText}</div>`;
    return items.slice(0, 8).map((item) => {
      const listing = getListings().find((row) => String(row.id) === String(item.id)) || item;
      return `
        <div class="phase3-queue-item">
          <div>
            <div class="phase3-queue-title">${clean(item.title || listing.title || "Listing")}</div>
            <div class="phase3-queue-sub">${clean(item.reason || item.recommended_action || listing.recommended_action || "Review required.")}</div>
            <div class="phase3-queue-meta">
              ${formatCurrency(listing.price)} • ${n(listing.views_count)} views • ${n(listing.messages_count)} messages
            </div>
          </div>
          <div>
            <button class="action-btn" type="button" data-phase3-open-detail="${clean(item.id || listing.id || "")}">Inspect</button>
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
    setText("phase3ReviewQueue", n(summary.review_queue_count));
    setText("phase3LikelySold", n(summary.stale_listings || summary.review_delete_count));
    setText("phase3WeakListings", n(summary.weak_listings));
    setText("phase3PromoteNow", n(summary.action_center?.promote_today || 0));

    const needs = document.getElementById("phase3NeedsAttention");
    const today = document.getElementById("phase3TodayQueue");
    const opp = document.getElementById("phase3Opportunities");
    if (needs) needs.innerHTML = queueHtml(details.needs_attention, "No critical items right now.");
    if (today) today.innerHTML = queueHtml(details.today, "No queued actions for today.");
    if (opp) opp.innerHTML = queueHtml(details.opportunities, "No promotion opportunities yet.");

    const cards = document.getElementById("phase3ReviewCards");
    if (cards) {
      const rows = buildReviewCards();
      cards.innerHTML = rows.length
        ? rows.map((item) => buildListingCard(item, "review")).join("")
        : `<div class="phase3-empty">No review cards are active right now.</div>`;
    }
  }

  function patchShowSection() {
    if (window.__EA_PHASE3_SHOWSECTION_PATCHED__) return;
    const original = typeof window.showSection === "function" ? window.showSection : null;
    if (!original) return;

    window.__EA_PHASE3_SHOWSECTION_PATCHED__ = true;
    window.showSection = function(sectionId) {
      original(sectionId);
      const titleMap = {
        listings: "Listings",
        review_center: "Review Center"
      };
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
      console.warn("phase3 status action warning", error);
    }
    setTimeout(renderAll, 250);
  }

  function bindEvents() {
    if (document.body?.dataset.phase3ShellBound === "true") return;
    if (document.body) document.body.dataset.phase3ShellBound = "true";

    document.addEventListener("click", async (event) => {
      const open = event.target.closest("[data-phase3-open]");
      if (open) {
        const section = open.getAttribute("data-phase3-open");
        if (typeof window.showSection === "function") window.showSection(section);
        return;
      }

      const filter = event.target.closest("[data-phase3-filter]");
      if (filter) {
        qsa("[data-phase3-filter]").forEach((btn) => btn.classList.toggle("active", btn === filter));
        renderListingsSection();
        return;
      }

      const detail = event.target.closest("[data-phase3-open-detail]");
      if (detail) {
        const id = detail.getAttribute("data-phase3-open-detail");
        if (typeof window.openListingDetailModal === "function") window.openListingDetailModal(id);
        return;
      }

      const status = event.target.closest("[data-phase3-status]");
      if (status) {
        const raw = status.getAttribute("data-phase3-status") || "";
        const [id, next] = raw.split(":");
        await handleStatus(id, next);
        return;
      }

      const sourceBtn = event.target.closest("[data-phase3-open-source]");
      if (sourceBtn) {
        const id = sourceBtn.getAttribute("data-phase3-open-source");
        const row = getListings().find((item) => String(item.id) === String(id));
        if (row?.source_url && typeof window.openListingSource === "function") {
          window.openListingSource(id, row.source_url);
        }
        return;
      }

      const copyBtn = event.target.closest("[data-phase3-copy]");
      if (copyBtn) {
        const id = copyBtn.getAttribute("data-phase3-copy");
        if (typeof window.copyVehicleSummary === "function") window.copyVehicleSummary(id);
      }
    });

    const search = document.getElementById("phase3ListingsSearch");
    if (search && !search.dataset.phase3Bound) {
      search.dataset.phase3Bound = "true";
      search.addEventListener("input", renderListingsSection);
    }
    const sort = document.getElementById("phase3ListingsSort");
    if (sort && !sort.dataset.phase3Bound) {
      sort.dataset.phase3Bound = "true";
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
