
(() => {
  if (window.__ELEVATE_PHASE23_BUNDLE_C__) return;
  window.__ELEVATE_PHASE23_BUNDLE_C__ = true;

  const CSS = `
    #overview .phase3-toolbar,
    #overview .phase4-toolbar,
    #bundleIMemoryShell {
      display: none !important;
    }

    .ea-manager-nav-btn {
      width: 100%;
      text-align: left;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.06);
      background: #151515;
      color: #f3f3f3;
      cursor: pointer;
      font-size: 14px;
    }

    .ea-section-hidden {
      display: none !important;
    }

    .ea-compact-toggle {
      display: inline-flex;
      gap: 8px;
      margin-left: 8px;
    }

    .ea-compact-toggle button {
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.08);
      background: #1a1a1a;
      color: #f2f2f2;
      cursor: pointer;
      font-size: 13px;
    }

    .ea-compact-toggle button.active {
      border-color: rgba(212,175,55,0.45);
      background: rgba(212,175,55,0.10);
      color: #f3ddb0;
    }

    #recentListingsGrid.ea-compact-mode {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    #recentListingsGrid.ea-compact-mode .listing-card {
      display: grid;
      grid-template-columns: 170px 1fr;
      overflow: hidden;
    }

    #recentListingsGrid.ea-compact-mode .listing-media {
      height: 100%;
      min-height: 140px;
      border-bottom: none;
      border-right: 1px solid rgba(255,255,255,0.05);
    }

    #recentListingsGrid.ea-compact-mode .listing-content {
      padding: 12px 14px;
      gap: 8px;
    }

    #recentListingsGrid.ea-compact-mode .listing-price {
      font-size: 20px;
    }

    #recentListingsGrid.ea-compact-mode .listing-note {
      display: none !important;
    }

    #recentListingsGrid.ea-compact-mode .listing-actions {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    #recentListingsGrid.ea-compact-mode .listing-actions .action-btn:nth-child(n+4) {
      display: none;
    }

    .ea-review-workspace {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin: 0 0 14px;
    }

    .ea-review-card {
      background: #151515;
      border: 1px solid rgba(212,175,55,0.12);
      border-radius: 14px;
      padding: 14px;
    }

    .ea-review-card h3 {
      font-size: 15px;
      margin-bottom: 8px;
    }

    .ea-review-copy {
      color: #bdbdbd;
      font-size: 13px;
      line-height: 1.5;
    }

    .ea-secondary-collapsed #overviewUpgradeCard,
    .ea-secondary-collapsed #overviewAccountGrid {
      display: none !important;
    }

    @media (max-width: 960px) {
      .ea-review-workspace {
        grid-template-columns: 1fr;
      }
      #recentListingsGrid.ea-compact-mode .listing-card {
        grid-template-columns: 1fr;
      }
      #recentListingsGrid.ea-compact-mode .listing-media {
        min-height: 170px;
        border-right: none;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
    }
  `;

  function injectStyle() {
    if (document.getElementById("ea-phase23-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase23-style";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function ensureCompactToggle() {
    const toolbar = document.querySelector("#overviewListingsCard .toolbar");
    const grid = document.getElementById("recentListingsGrid");
    if (!toolbar || !grid || document.getElementById("eaCompactToggle")) return;

    const wrap = document.createElement("div");
    wrap.className = "ea-compact-toggle";
    wrap.id = "eaCompactToggle";
    wrap.innerHTML = `
      <button type="button" data-mode="card" class="active">Card</button>
      <button type="button" data-mode="compact">Compact</button>
    `;
    toolbar.appendChild(wrap);

    const applyMode = (mode) => {
      grid.classList.toggle("ea-compact-mode", mode === "compact");
      wrap.querySelectorAll("button").forEach((btn) => btn.classList.toggle("active", btn.getAttribute("data-mode") === mode));
      try { localStorage.setItem("ea_listing_view_mode", mode); } catch {}
    };

    wrap.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => applyMode(btn.getAttribute("data-mode") || "card"));
    });

    let saved = "card";
    try { saved = localStorage.getItem("ea_listing_view_mode") || "card"; } catch {}
    applyMode(saved);
  }

  function ensureReviewWorkspace() {
    const listingsCard = document.getElementById("overviewListingsCard");
    if (!listingsCard || document.getElementById("eaReviewWorkspace")) return;
    const host = document.createElement("div");
    host.id = "eaReviewWorkspace";
    host.className = "ea-review-workspace";
    host.innerHTML = `
      <div class="ea-review-card">
        <h3>Likely Sold / Removed</h3>
        <div id="eaReviewSold" class="ea-review-copy">Waiting for listing review data...</div>
      </div>
      <div class="ea-review-card">
        <h3>Price Watch</h3>
        <div id="eaReviewPrice" class="ea-review-copy">Waiting for price-review signals...</div>
      </div>
      <div class="ea-review-card">
        <h3>Stale / Needs Refresh</h3>
        <div id="eaReviewStale" class="ea-review-copy">Waiting for stale-listing signals...</div>
      </div>
    `;
    const sectionHead = listingsCard.querySelector(".section-head");
    if (sectionHead) sectionHead.insertAdjacentElement("afterend", host);
  }

  function renderReviewWorkspace() {
    const summary = window.dashboardSummary || {};
    const soldEl = document.getElementById("eaReviewSold");
    const priceEl = document.getElementById("eaReviewPrice");
    const staleEl = document.getElementById("eaReviewStale");
    if (soldEl) soldEl.textContent = `${Number(summary.review_delete_count || 0)} items need sold/removed review.`;
    if (priceEl) priceEl.textContent = `${Number(summary.review_price_change_count || 0)} items currently sit in price-watch review.`;
    if (staleEl) staleEl.textContent = `${Number(summary.stale_listings || 0)} stale listings and ${Number(summary.weak_listings || 0)} weak listings need refresh attention.`;
  }

  function demoteSecondaryOverview() {
    const overview = document.getElementById("overview");
    if (!overview) return;
    overview.classList.add("ea-secondary-collapsed");
    const primaryDealershipBlocks = Array.from(overview.querySelectorAll(".card, .sidebar-card")).filter((el) => /Primary Dealership Team|Plan, Upgrade & Expansion Signals/i.test(el.textContent || ""));
    primaryDealershipBlocks.forEach((el) => el.classList.add("ea-section-hidden"));
  }

  function createManagerSection() {
    const managerBlock = document.getElementById("managerInsightsSection");
    const mainInner = document.querySelector(".main-inner");
    const nav = document.querySelector(".sidebar-nav");
    if (!managerBlock || !mainInner || !nav) return;
    let section = document.getElementById("manager");
    if (!section) {
      section = document.createElement("section");
      section.id = "manager";
      section.className = "dashboard-section";
      mainInner.appendChild(section);

      const btn = document.createElement("button");
      btn.className = "ea-manager-nav-btn";
      btn.setAttribute("data-section", "manager");
      btn.textContent = "Manager / Team";
      nav.insertBefore(btn, nav.querySelector('[data-section="billing"]') || null);
      btn.addEventListener("click", () => window.showSection && window.showSection("manager"));
    }
    if (!section.contains(managerBlock)) {
      section.appendChild(managerBlock);
    }
  }

  function patchFetchDiagnostics() {
    if (window.__EA_PHASE23_FETCH_PATCHED__) return;
    window.__EA_PHASE23_FETCH_PATCHED__ = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        const url = String(args[0] && args[0].url ? args[0].url : args[0] || "");
        if (!/\/api\/(get-user-listings|get-dashboard-summary)/.test(url)) return response;
        const clone = response.clone();
        const text = await clone.text();
        const data = JSON.parse(text || "{}");
        const fixRow = (row) => {
          if (!row || typeof row !== "object") return row;
          const price = Number(row.price || 0);
          const mileage = Number(row.mileage || row.kilometers || row.km || row.raw_mileage || 0);
          if (price && mileage && price === mileage) row.price_warning = `${row.price_warning || ""}|frontend_detected_duplicate_price_mileage`;
          return row;
        };
        if (Array.isArray(data?.data)) data.data = data.data.map(fixRow);
        if (Array.isArray(data?.data?.recent_listings)) data.data.recent_listings = data.data.recent_listings.map(fixRow);
      } catch {}
      return response;
    };
  }

  function boot() {
    injectStyle();
    patchFetchDiagnostics();
    ensureCompactToggle();
    ensureReviewWorkspace();
    renderReviewWorkspace();
    demoteSecondaryOverview();
    createManagerSection();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
  window.addEventListener("load", () => {
    boot();
    setTimeout(() => {
      ensureCompactToggle();
      ensureReviewWorkspace();
      renderReviewWorkspace();
      demoteSecondaryOverview();
      createManagerSection();
    }, 1000);
  });
})();
