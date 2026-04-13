(() => {
  if (window.__ELEVATE_BUNDLE_D_OPS__) return;
  window.__ELEVATE_BUNDLE_D_OPS__ = true;

  const CSS = `
    .ea-bundle-d-shell{display:grid;gap:18px}
    .ea-nav-inserted{position:relative}
    .ea-review-shell{display:grid;gap:18px}
    .ea-review-hero,.ea-review-lane,.ea-listings-hero{
      background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006));
      border:1px solid rgba(212,175,55,.12);
      border-radius:18px;
      padding:18px;
      box-shadow:0 10px 30px rgba(0,0,0,.28);
    }
    .ea-review-hero-grid,.ea-review-lanes{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:14px;
    }
    .ea-review-lanes{grid-template-columns:repeat(4,minmax(0,1fr))}
    .ea-review-mini{
      background:#161616;
      border:1px solid rgba(255,255,255,.05);
      border-radius:14px;
      padding:14px;
    }
    .ea-review-mini .mini-label{
      color:#d4af37;
      text-transform:uppercase;
      letter-spacing:.08em;
      font-size:11px;
      margin-bottom:8px;
      font-weight:700;
    }
    .ea-review-mini strong{
      font-size:24px;
      line-height:1;
      display:block;
      margin-bottom:6px;
    }
    .ea-review-lane-head{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:10px;
      margin-bottom:12px;
    }
    .ea-review-lane-list{
      display:grid;
      gap:10px;
      align-content:start;
    }
    .ea-review-item{
      background:#151515;
      border:1px solid rgba(255,255,255,.06);
      border-radius:14px;
      padding:14px;
      display:grid;
      gap:10px;
    }
    .ea-review-item-title{font-weight:700;line-height:1.35}
    .ea-review-item-sub{font-size:12px;color:#a9a9a9;line-height:1.45}
    .ea-review-reason{
      font-size:12px;
      line-height:1.55;
      color:#d8d8d8;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.05);
      border-radius:10px;
      padding:10px;
    }
    .ea-review-actions{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:8px;
    }
    .ea-lane-badge{
      display:inline-flex;
      align-items:center;
      min-height:28px;
      padding:0 10px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.08);
      background:#171717;
      font-size:12px;
      font-weight:700;
      color:#f3ddb0;
    }
    .ea-price-pending{
      color:#ffcfad;
      font-weight:700;
    }
    .ea-overview-soft-hide #overviewUpgradeCard,
    .ea-overview-soft-hide #overviewAccountGrid{
      display:none !important;
    }
    .ea-overview-soft-hide [data-ea-manager-block="true"]{
      display:none !important;
    }
    .ea-listings-topbar{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
      flex-wrap:wrap;
      margin-bottom:14px;
    }
    .ea-listings-copy{
      color:#bdbdbd;
      font-size:14px;
      line-height:1.55;
      max-width:760px;
    }
    @media (max-width: 1200px){
      .ea-review-hero-grid,.ea-review-lanes{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @media (max-width: 760px){
      .ea-review-hero-grid,.ea-review-lanes,.ea-review-actions{grid-template-columns:1fr}
    }
  `;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function num(value) {
    const n = Number(String(value ?? "").replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function money(value) {
    const n = num(value);
    return n > 0 ? `$${n.toLocaleString()}` : "Price pending";
  }

  function insertStyle() {
    if (document.getElementById("ea-bundle-d-style")) return;
    const style = document.createElement("style");
    style.id = "ea-bundle-d-style";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function bindSectionButton(btn, sectionId) {
    if (!btn || btn.dataset.eaBound === "true") return;
    btn.dataset.eaBound = "true";
    btn.addEventListener("click", () => {
      if (typeof window.showSection === "function") {
        window.showSection(sectionId);
        return;
      }
      document.querySelectorAll(".dashboard-section").forEach((section) => {
        section.style.display = section.id === sectionId ? "block" : "none";
      });
      document.querySelectorAll(".nav-btn").forEach((node) => {
        node.classList.toggle("active", node === btn);
      });
    });
  }

  function ensureNavButtons() {
    const nav = document.querySelector(".sidebar-nav");
    if (!nav) return;

    const current = Array.from(nav.querySelectorAll(".nav-btn"));
    const labels = {
      overview: "Overview",
      profile: "Setup",
      extension: "Tools",
      tools: "Analytics",
      compliance: "Compliance",
      affiliate: "Partners",
      billing: "Billing"
    };

    current.forEach((btn) => {
      const id = btn.getAttribute("data-section");
      if (labels[id]) btn.textContent = labels[id];
    });

    let listingsBtn = nav.querySelector('[data-section="listings"]');
    if (!listingsBtn) {
      listingsBtn = document.createElement("button");
      listingsBtn.className = "nav-btn ea-nav-inserted";
      listingsBtn.setAttribute("data-section", "listings");
      listingsBtn.textContent = "Listings";
      nav.insertBefore(listingsBtn, nav.querySelector('[data-section="tools"]'));
    }

    let reviewBtn = nav.querySelector('[data-section="review-center"]');
    if (!reviewBtn) {
      reviewBtn = document.createElement("button");
      reviewBtn.className = "nav-btn ea-nav-inserted";
      reviewBtn.setAttribute("data-section", "review-center");
      reviewBtn.textContent = "Review Center";
      nav.insertBefore(reviewBtn, nav.querySelector('[data-section="tools"]'));
    }

    bindSectionButton(listingsBtn, "listings");
    bindSectionButton(reviewBtn, "review-center");
  }

  function ensureSections() {
    const mainInner = document.querySelector(".main-inner");
    if (!mainInner) return {};

    let listings = document.getElementById("listings");
    if (!listings) {
      listings = document.createElement("section");
      listings.id = "listings";
      listings.className = "dashboard-section";
      mainInner.appendChild(listings);
    }

    let review = document.getElementById("review-center");
    if (!review) {
      review = document.createElement("section");
      review.id = "review-center";
      review.className = "dashboard-section";
      mainInner.appendChild(review);
    }

    return { listings, review };
  }

  function moveListingsSurface() {
    const { listings } = ensureSections();
    const listingsCard = document.getElementById("overviewListingsCard");
    if (!listings || !listingsCard) return;

    if (!listings.querySelector(".ea-listings-hero")) {
      const hero = document.createElement("div");
      hero.className = "ea-listings-hero";
      hero.innerHTML = `
        <div class="ea-listings-topbar">
          <div>
            <div class="module-group-label">Listings Workspace</div>
            <h2 style="margin-top:6px;">Portfolio listings and client posts</h2>
          </div>
          <div class="ea-lane-badge">Operator Surface</div>
        </div>
        <div class="ea-listings-copy">
          This is now the dedicated place for vehicle cards, portfolio inspection, quick filtering, and direct review entry.
          It should feel like the daily post workspace, not a secondary block buried in overview.
        </div>
      `;
      listings.appendChild(hero);
    }

    if (!listings.contains(listingsCard)) {
      listings.appendChild(listingsCard);
    }
  }

  function getRows() {
    const summaryRows = Array.isArray(window.dashboardSummary?.recent_listings)
      ? window.dashboardSummary.recent_listings
      : [];
    const registryRows = Object.values(window.ElevateDashboard?.state?.get?.("listingRegistry", {}) || {});
    const rows = registryRows.length ? registryRows : summaryRows;

    return rows.map((row, idx) => {
      const title = clean(
        row.title ||
        [row.year, row.make, row.model, row.trim].filter(Boolean).join(" ") ||
        `Listing ${idx + 1}`
      );
      const lifecycle = clean(row.lifecycle_status || row.review_bucket || "").toLowerCase();
      const status = clean(row.status || "active").toLowerCase();
      const views = num(row.views_count ?? row.views);
      const messages = num(row.messages_count ?? row.messages);
      const price = num(row.price);
      const rawPrice = num(row.raw_price);
      const unresolvedPrice = !(price > 0) && !(rawPrice > 0);
      const likelySold = Boolean(row.likely_sold) || /review_delete|removedvehicles|removed/.test(lifecycle);
      const stale = Boolean(row.weak) || /stale/.test(status) || /stale/.test(lifecycle);
      const priceWatch = /price/.test(lifecycle) || /price/.test(clean(row.recommended_action || "")) || Boolean(row.price_review_priority > 0 && row.needs_action);
      const reviewNew = /review_new|newvehicles/.test(lifecycle);
      return {
        id: clean(row.id || row.identity_key || row.marketplace_listing_id || row.vin || row.stock_number || title),
        title,
        subtitle: clean([row.stock_number || row.vin, row.body_style, row.exterior_color].filter(Boolean).join(" • ")),
        source_url: clean(row.source_url || ""),
        image_url: clean(row.image_url || ""),
        views,
        messages,
        price,
        rawPrice,
        unresolvedPrice,
        priceLabel: price > 0 ? money(price) : (rawPrice > 0 ? money(rawPrice) : "Price pending"),
        likelySold,
        stale,
        priceWatch,
        reviewNew,
        recommended_action: clean(row.recommended_action || "Review"),
        pricing_insight: clean(row.pricing_insight || ""),
        health_label: clean(row.health_label || ""),
        age_days: num(row.age_days),
        lifecycle_status: lifecycle,
        status
      };
    });
  }

  function reviewCard(row, actionLabel) {
    return `
      <div class="ea-review-item">
        <div>
          <div class="ea-review-item-title">${row.title}</div>
          <div class="ea-review-item-sub">${row.subtitle || "Tracked listing"}</div>
        </div>
        <div class="ea-review-item-sub">
          <strong class="${row.unresolvedPrice ? "ea-price-pending" : ""}">${row.priceLabel}</strong>
          · Views ${row.views} · Messages ${row.messages}
        </div>
        <div class="ea-review-reason">
          ${row.recommended_action || "Review now."}
          ${row.pricing_insight ? `<br><br><em>${row.pricing_insight}</em>` : ""}
          ${row.unresolvedPrice ? `<br><br><strong>Data note:</strong> Canonical price is still unresolved for this row. The UI should not present $0 as truth.` : ""}
        </div>
        <div class="ea-review-actions">
          <button class="action-btn" type="button" data-ea-open="listings">${actionLabel}</button>
          <button class="action-btn" type="button" data-ea-source="${row.source_url}">Open Source</button>
        </div>
      </div>
    `;
  }

  function bindInlineActions(root) {
    root.querySelectorAll('[data-ea-open]').forEach((btn) => {
      if (btn.dataset.eaInlineBound === "true") return;
      btn.dataset.eaInlineBound = "true";
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-ea-open");
        const navBtn = document.querySelector(`.nav-btn[data-section="${target}"]`);
        navBtn?.click();
      });
    });

    root.querySelectorAll('[data-ea-source]').forEach((btn) => {
      if (btn.dataset.eaSourceBound === "true") return;
      btn.dataset.eaSourceBound = "true";
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-ea-source");
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      });
    });
  }

  function renderReviewCenter() {
    const { review } = ensureSections();
    if (!review) return;
    const rows = getRows();

    const sold = rows.filter((row) => row.likelySold).slice(0, 12);
    const price = rows.filter((row) => row.priceWatch).slice(0, 12);
    const stale = rows.filter((row) => row.stale && !row.likelySold).slice(0, 12);
    const reviewNew = rows.filter((row) => row.reviewNew).slice(0, 12);

    review.innerHTML = `
      <div class="ea-review-shell">
        <div class="ea-review-hero">
          <div class="section-head">
            <div>
              <div class="module-group-label">Review Center</div>
              <h2 style="margin-top:6px;">Triage sold, stale, price, and new-review pressure</h2>
              <div class="subtext">This should operate as a true triage engine. The lanes below give each review class a dedicated home instead of burying everything inside filtered cards.</div>
            </div>
          </div>
          <div class="ea-review-hero-grid">
            <div class="ea-review-mini">
              <div class="mini-label">Likely Sold / Removed</div>
              <strong>${sold.length}</strong>
              <div class="subtext">Rows flagged for sold or removed review.</div>
            </div>
            <div class="ea-review-mini">
              <div class="mini-label">Price Watch</div>
              <strong>${price.length}</strong>
              <div class="subtext">Rows that need pricing review or re-check.</div>
            </div>
            <div class="ea-review-mini">
              <div class="mini-label">Stale / Weak</div>
              <strong>${stale.length}</strong>
              <div class="subtext">Rows that likely need refresh, repost, or cleanup.</div>
            </div>
            <div class="ea-review-mini">
              <div class="mini-label">Review New</div>
              <strong>${reviewNew.length}</strong>
              <div class="subtext">Rows entering the review pipeline as new items.</div>
            </div>
          </div>
        </div>

        <div class="ea-review-lanes">
          <div class="ea-review-lane">
            <div class="ea-review-lane-head">
              <h3>Likely Sold / Removed</h3>
              <span class="ea-lane-badge">${sold.length}</span>
            </div>
            <div class="ea-review-lane-list">
              ${sold.length ? sold.map((row) => reviewCard(row, "Review status")).join("") : `<div class="ea-review-item"><div class="ea-review-item-sub">No sold or removed rows right now.</div></div>`}
            </div>
          </div>

          <div class="ea-review-lane">
            <div class="ea-review-lane-head">
              <h3>Price Watch</h3>
              <span class="ea-lane-badge">${price.length}</span>
            </div>
            <div class="ea-review-lane-list">
              ${price.length ? price.map((row) => reviewCard(row, "Review price")).join("") : `<div class="ea-review-item"><div class="ea-review-item-sub">No price-review rows right now.</div></div>`}
            </div>
          </div>

          <div class="ea-review-lane">
            <div class="ea-review-lane-head">
              <h3>Stale / Needs Refresh</h3>
              <span class="ea-lane-badge">${stale.length}</span>
            </div>
            <div class="ea-review-lane-list">
              ${stale.length ? stale.map((row) => reviewCard(row, "Open in listings")).join("") : `<div class="ea-review-item"><div class="ea-review-item-sub">No stale or weak rows right now.</div></div>`}
            </div>
          </div>

          <div class="ea-review-lane">
            <div class="ea-review-lane-head">
              <h3>Review New</h3>
              <span class="ea-lane-badge">${reviewNew.length}</span>
            </div>
            <div class="ea-review-lane-list">
              ${reviewNew.length ? reviewNew.map((row) => reviewCard(row, "Validate listing")).join("") : `<div class="ea-review-item"><div class="ea-review-item-sub">No new-review rows right now.</div></div>`}
            </div>
          </div>
        </div>
      </div>
    `;

    bindInlineActions(review);
  }

  function cleanOverviewPriority() {
    const overview = document.getElementById("overview");
    if (!overview) return;
    overview.classList.add("ea-overview-soft-hide");

    Array.from(overview.querySelectorAll(".card, .sidebar-card")).forEach((node) => {
      const text = clean(node.textContent || "");
      if (/manager oversight|team dealer command center|primary dealership team|manager \/ team/i.test(text)) {
        node.setAttribute("data-ea-manager-block", "true");
      }
    });
  }

  function renderListingsHeaderHints() {
    const listingsCard = document.getElementById("overviewListingsCard");
    if (!listingsCard || listingsCard.dataset.eaBundleDHeader === "true") return;
    listingsCard.dataset.eaBundleDHeader = "true";

    const head = listingsCard.querySelector(".section-head > div");
    if (head) {
      const note = document.createElement("div");
      note.className = "subtext";
      note.style.marginTop = "6px";
      note.textContent = "Dedicated listings workspace: inspect client posts, filter the portfolio, and send review items into Review Center.";
      head.appendChild(note);
    }
  }

  function boot() {
    insertStyle();
    ensureNavButtons();
    ensureSections();
    moveListingsSurface();
    renderReviewCenter();
    cleanOverviewPriority();
    renderListingsHeaderHints();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("load", () => {
    boot();
    setTimeout(boot, 900);
    setTimeout(boot, 2400);
  });

  window.addEventListener("elevate:tracking-refreshed", boot);
  window.addEventListener("elevate:sync-refreshed", boot);
})();
