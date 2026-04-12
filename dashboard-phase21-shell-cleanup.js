(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase21shell) return;

  const STYLE_ID = "ea-phase21-shell-cleanup";
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
  function injectStyle(css) {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
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
  function getListings() {
    if (Array.isArray(window.dashboardListings) && window.dashboardListings.length) return window.dashboardListings;
    const summaryRows = Array.isArray(window.dashboardSummary?.recent_listings) ? window.dashboardSummary.recent_listings : [];
    return summaryRows;
  }
  function getActionDetails() {
    return window.dashboardSummary?.action_center_details || {};
  }

  function ensureNavButtons() {
    const nav = document.querySelector(".sidebar-nav");
    if (!nav) return;
    if (!nav.querySelector(`[data-section="${SECTION_LISTINGS}"]`)) {
      const btn = document.createElement("button");
      btn.className = "nav-btn";
      btn.type = "button";
      btn.setAttribute("data-section", SECTION_LISTINGS);
      btn.textContent = "Listings";
      nav.insertBefore(btn, nav.querySelector('[data-section="tools"]') || null);
    }
    if (!nav.querySelector(`[data-section="${SECTION_REVIEW}"]`)) {
      const btn = document.createElement("button");
      btn.className = "nav-btn";
      btn.type = "button";
      btn.setAttribute("data-section", SECTION_REVIEW);
      btn.textContent = "Review Center";
      nav.insertBefore(btn, nav.querySelector('[data-section="tools"]') || null);
    }
  }

  function sectionShell(id, title, subtitle) {
    const section = document.createElement("section");
    section.id = id;
    section.className = "dashboard-section";
    section.innerHTML = `
      <div class="card phase21-hero">
        <div class="phase21-eyebrow">${title}</div>
        <h2>${title}</h2>
        <div class="subtext">${subtitle}</div>
      </div>
    `;
    return section;
  }

  function ensureSections() {
    const mainInner = document.querySelector(".main-inner");
    if (!mainInner) return;

    if (!document.getElementById(SECTION_LISTINGS)) {
      const listings = sectionShell("listings", "Listings", "View every client post in one place with real status, traction, and next actions.");
      listings.insertAdjacentHTML("beforeend", `
        <div class="phase21-toolbar card">
          <div class="phase21-toolbar-left">
            <button class="action-btn active" type="button" data-phase21-filter="all">All</button>
            <button class="action-btn" type="button" data-phase21-filter="active">Active</button>
            <button class="action-btn" type="button" data-phase21-filter="weak">Weak</button>
            <button class="action-btn" type="button" data-phase21-filter="needs_action">Needs Action</button>
            <button class="action-btn" type="button" data-phase21-filter="likely_sold">Likely Sold</button>
          </div>
          <div class="phase21-toolbar-right">
            <input id="phase21ListingsSearch" type="text" placeholder="Search make, model, VIN, stock..." />
          </div>
        </div>
        <div id="phase21ListingsGrid" class="listing-grid"></div>
      `);
      mainInner.appendChild(listings);
    }

    if (!document.getElementById(SECTION_REVIEW)) {
      const review = sectionShell("review_center", "Review Center", "Process stale, sold, price-change, and weak listings from one operator queue.");
      review.insertAdjacentHTML("beforeend", `
        <div class="grid-4 phase21-review-kpis">
          <div class="card"><div class="stat-label">Review Queue</div><div id="phase21ReviewQueue" class="stat-value">0</div></div>
          <div class="card"><div class="stat-label">Likely Sold</div><div id="phase21LikelySold" class="stat-value">0</div></div>
          <div class="card"><div class="stat-label">Weak Listings</div><div id="phase21Weak" class="stat-value">0</div></div>
          <div class="card"><div class="stat-label">Promote Now</div><div id="phase21Promote" class="stat-value">0</div></div>
        </div>
        <div class="grid-3">
          <div class="card"><div class="section-head"><h2>Needs Attention</h2></div><div id="phase21NeedsAttention" class="phase21-queue"></div></div>
          <div class="card"><div class="section-head"><h2>Today</h2></div><div id="phase21TodayQueue" class="phase21-queue"></div></div>
          <div class="card"><div class="section-head"><h2>Opportunities</h2></div><div id="phase21OpportunityQueue" class="phase21-queue"></div></div>
        </div>
      `);
      mainInner.appendChild(review);
    }
  }

  function patchOverview() {
    const overview = document.getElementById("overview");
    if (!overview || overview.dataset.phase21Patched === "true") return;
    overview.dataset.phase21Patched = "true";

    const commandTitle = overview.querySelector(".command-title-row h2");
    if (commandTitle && /complete setup/i.test(commandTitle.textContent || "")) {
      commandTitle.textContent = "Operator snapshot and next actions.";
    }
    const sub = document.getElementById("commandCenterSubtext");
    if (sub && /finish the required setup fields/i.test(sub.textContent || "")) {
      sub.textContent = "Use this as the command layer for setup gaps, queue readiness, listing pressure, and next moves.";
    }
    const blockers = document.getElementById("overviewBlockers");
    if (blockers && !overview.querySelector("#phase21OverviewJumpBar")) {
      const bar = document.createElement("div");
      bar.id = "phase21OverviewJumpBar";
      bar.className = "phase21-jumpbar";
      bar.innerHTML = `
        <button class="action-btn" type="button" data-phase21-open="${SECTION_LISTINGS}">Open Listings</button>
        <button class="action-btn" type="button" data-phase21-open="${SECTION_REVIEW}">Open Review Center</button>
        <button class="action-btn" type="button" data-phase21-open="profile">Open Setup</button>
      `;
      blockers.insertAdjacentElement("afterend", bar);
    }
  }

  function buildListingCard(item = {}) {
    const id = clean(item.id || "");
    const title = clean(item.title || [item.year, item.make, item.model, item.trim].filter(Boolean).join(" ")) || "Vehicle Listing";
    const badge = clean(item.lifecycle_status || item.status || "active");
    const image = clean(item.image_url || "");
    const subtitle = [
      clean(item.stock_number ? `Stock ${item.stock_number}` : ""),
      clean(item.vin ? `VIN ${item.vin}` : ""),
      clean(item.body_style || "")
    ].filter(Boolean).join(" • ") || "Vehicle details";

    return `
      <article class="listing-card phase21-listing-card">
        <div class="listing-media">
          ${image ? `<img src="${image}" alt="${title}" loading="lazy" />` : ""}
          <div class="listing-badge"><span class="badge warn">${badge.replace(/_/g, " ")}</span></div>
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
            <div class="metric-pill"><div class="metric-pill-label">Posted</div><div class="metric-pill-value">${formatShortDate(item.posted_at || item.updated_at)}</div></div>
          </div>
          <div class="listing-note phase21-note"><strong>Health:</strong> ${clean(item.health_label || "Healthy")} • <strong>Action:</strong> ${clean(item.recommended_action || "Keep live")}</div>
          <div class="listing-actions">
            <button class="action-btn" type="button" data-phase21-open-detail="${id}">Inspect</button>
            <button class="action-btn" type="button" data-phase21-status="${id}:approved">Approve</button>
            <button class="action-btn" type="button" data-phase21-status="${id}:sold">Mark Sold</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderListingsSection() {
    const grid = document.getElementById("phase21ListingsGrid");
    if (!grid) return;

    const search = clean(document.getElementById("phase21ListingsSearch")?.value || "").toLowerCase();
    const activeFilter = document.querySelector("[data-phase21-filter].active")?.getAttribute("data-phase21-filter") || "all";

    let rows = [...getListings()];
    if (activeFilter !== "all") {
      rows = rows.filter((item) => {
        if (activeFilter === "active") return !["sold", "deleted", "inactive", "stale"].includes(clean(item.status).toLowerCase()) && clean(item.lifecycle_status).toLowerCase() !== "review_delete";
        if (activeFilter === "weak") return Boolean(item.weak);
        if (activeFilter === "needs_action") return Boolean(item.needs_action);
        if (activeFilter === "likely_sold") return Boolean(item.likely_sold);
        return true;
      });
    }
    if (search) {
      rows = rows.filter((item) => [item.title, item.make, item.model, item.vin, item.stock_number].join(" ").toLowerCase().includes(search));
    }

    rows.sort((a, b) => n(b.popularity_score) - n(a.popularity_score));
    grid.innerHTML = rows.length ? rows.map(buildListingCard).join("") : `<div class="listing-empty">No listings match this filter yet.</div>`;
  }

  function queueHtml(items, emptyText) {
    if (!Array.isArray(items) || !items.length) return `<div class="listing-empty">${emptyText}</div>`;
    return items.slice(0, 8).map((item) => `
      <div class="phase21-queue-item">
        <div>
          <div class="phase21-queue-title">${clean(item.title || "Listing")}</div>
          <div class="phase21-queue-sub">${clean(item.reason || item.recommended_action || "")}</div>
        </div>
        <div class="phase21-queue-actions">
          <button class="action-btn" type="button" data-phase21-open-detail="${clean(item.id || "")}">Inspect</button>
        </div>
      </div>
    `).join("");
  }

  function renderReviewSection() {
    const details = getActionDetails();
    const summary = window.dashboardSummary || {};
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    };

    setText("phase21ReviewQueue", n(summary.review_queue_count));
    setText("phase21LikelySold", n(summary.action_center?.likely_sold || summary.stale_listings));
    setText("phase21Weak", n(summary.weak_listings));
    setText("phase21Promote", n(summary.action_center?.promote_today || 0));

    const needs = document.getElementById("phase21NeedsAttention");
    const today = document.getElementById("phase21TodayQueue");
    const opp = document.getElementById("phase21OpportunityQueue");
    if (needs) needs.innerHTML = queueHtml(details.needs_attention, "No critical items right now.");
    if (today) today.innerHTML = queueHtml(details.today, "No queued actions for today.");
    if (opp) opp.innerHTML = queueHtml(details.opportunities, "No promotion opportunities yet.");
  }

  function patchShowSection() {
    if (window.__EA_PHASE21_SHOWSECTION_PATCHED__) return;
    const original = typeof window.showSection === "function" ? window.showSection : null;
    if (!original) return;

    window.__EA_PHASE21_SHOWSECTION_PATCHED__ = true;
    window.showSection = function(sectionId) {
      original(sectionId);
      const titleMap = {
        listings: "Listings",
        review_center: "Review Center"
      };
      const pageTitle = document.getElementById("dashboardPageTitle");
      if (pageTitle && titleMap[sectionId]) pageTitle.textContent = titleMap[sectionId];
    };
  }

  function bindEvents() {
    if (document.body?.dataset.phase21Bound === "true") return;
    if (document.body) document.body.dataset.phase21Bound = "true";

    document.addEventListener("click", async (event) => {
      const open = event.target.closest("[data-phase21-open]");
      if (open) {
        const section = open.getAttribute("data-phase21-open");
        if (typeof window.showSection === "function") window.showSection(section);
        return;
      }

      const filter = event.target.closest("[data-phase21-filter]");
      if (filter) {
        qsa("[data-phase21-filter]").forEach((btn) => btn.classList.toggle("active", btn === filter));
        renderListingsSection();
        return;
      }

      const detail = event.target.closest("[data-phase21-open-detail]");
      if (detail) {
        const id = detail.getAttribute("data-phase21-open-detail");
        if (typeof window.openListingDetailModal === "function") window.openListingDetailModal(id);
        return;
      }

      const status = event.target.closest("[data-phase21-status]");
      if (status) {
        const raw = status.getAttribute("data-phase21-status") || "";
        const [id, next] = raw.split(":");
        if (!id || !next) return;
        if (next === "sold" && typeof window.markListingSold === "function") await window.markListingSold(id);
        else if (typeof window.markListingAction === "function") await window.markListingAction(id, next);
        setTimeout(() => {
          renderListingsSection();
          renderReviewSection();
        }, 250);
      }
    });

    const search = document.getElementById("phase21ListingsSearch");
    if (search && !search.dataset.phase21Bound) {
      search.dataset.phase21Bound = "true";
      search.addEventListener("input", () => renderListingsSection());
    }
  }

  function renderAll() {
    ensureNavButtons();
    ensureSections();
    patchOverview();
    patchShowSection();
    bindEvents();
    renderListingsSection();
    renderReviewSection();
  }

  injectStyle(`
    #overview .phase4-shell, #overview .phase3-overview-shell { gap: 14px; }
    #overview .phase4-group[data-group="secondary"], #overview .phase3-overview-group[data-group="secondary"] { opacity: .9; }
    .phase21-hero { margin-bottom: 16px; }
    .phase21-eyebrow { color: var(--gold); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 8px; }
    .phase21-toolbar { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
    .phase21-toolbar-left, .phase21-toolbar-right { display:flex; gap:8px; flex-wrap:wrap; }
    .phase21-toolbar input { min-width: 260px; background:#1a1a1a; color:#f5f5f5; border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:12px 14px; }
    .phase21-listing-card .phase21-note { color: var(--muted); font-size: 12px; line-height: 1.45; }
    .phase21-jumpbar { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:10px; margin-bottom: 18px; }
    .phase21-review-kpis { margin-bottom: 18px; }
    .phase21-queue { display:grid; gap:10px; }
    .phase21-queue-item { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; background:#161616; border:1px solid rgba(255,255,255,.06); border-radius:14px; padding:14px; }
    .phase21-queue-title { font-weight:700; margin-bottom:6px; }
    .phase21-queue-sub { color: var(--muted); font-size: 13px; line-height:1.45; }
    @media (max-width: 900px) {
      .phase21-jumpbar { grid-template-columns: 1fr; }
      .phase21-toolbar { flex-direction: column; align-items: stretch; }
      .phase21-toolbar input { min-width: 100%; width: 100%; }
    }
  `);

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
