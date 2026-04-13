(() => {
  if (window.__ELEVATE_BUNDLE_B_PHASE22__) return;
  window.__ELEVATE_BUNDLE_B_PHASE22__ = true;

  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  NS.modules = NS.modules || {};

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function num(value, fallback = 0) {
    if (value === null || value === undefined || value === "") return fallback;
    const normalized = typeof value === "string" ? value.replace(/[,$]/g, "").trim() : value;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : fallback;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatCurrency(value) {
    const n = num(value, 0);
    if (!n) return "$0";
    try {
      return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0
      }).format(n);
    } catch {
      return `$${n.toLocaleString()}`;
    }
  }

  function formatMileage(value) {
    const n = num(value, 0);
    if (!n) return "Not set";
    return `${n.toLocaleString()} km`;
  }

  function fieldCandidates(row, keys = []) {
    return keys
      .map((key) => row?.[key])
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
      .map((value) => num(value, NaN))
      .filter((value) => Number.isFinite(value) && value > 0);
  }

  function chooseMileage(row) {
    const mileageCandidates = fieldCandidates(row, [
      "mileage",
      "kilometers",
      "km",
      "odometer",
      "odometer_km",
      "vehicle_km",
      "kms"
    ]);
    return mileageCandidates[0] || 0;
  }

  function choosePrice(row) {
    const mileage = chooseMileage(row);
    const primaryCandidates = fieldCandidates(row, [
      "current_price",
      "listed_price",
      "list_price",
      "asking_price",
      "sale_price",
      "advertised_price",
      "vehicle_price",
      "marketplace_price",
      "price_amount",
      "cash_price",
      "internet_price",
      "our_price",
      "currentPrice",
      "listedPrice",
      "askingPrice",
      "salePrice",
      "advertisedPrice",
      "vehiclePrice",
      "price"
    ]);

    if (!primaryCandidates.length) return 0;

    const distinct = [...new Set(primaryCandidates)];

    const nonMileage = distinct.filter((candidate) => !mileage || candidate !== mileage);
    const likelyPrice = nonMileage.find((candidate) => candidate >= 1000 && candidate <= 250000);
    if (likelyPrice) return likelyPrice;

    const fallbackLikelyPrice = distinct.find((candidate) => candidate >= 1000 && candidate <= 250000);
    if (fallbackLikelyPrice) return fallbackLikelyPrice;

    return distinct[0] || 0;
  }

  function normalizeListingLike(row = {}) {
    const price = choosePrice(row);
    const mileage = chooseMileage(row);
    return {
      ...row,
      price,
      mileage,
      price_debug_source:
        clean(row.current_price) ? "current_price" :
        clean(row.listed_price) ? "listed_price" :
        clean(row.list_price) ? "list_price" :
        clean(row.asking_price) ? "asking_price" :
        clean(row.sale_price) ? "sale_price" :
        clean(row.advertised_price) ? "advertised_price" :
        clean(row.vehicle_price) ? "vehicle_price" :
        clean(row.marketplace_price) ? "marketplace_price" :
        clean(row.price_amount) ? "price_amount" :
        "price",
      mileage_debug_source:
        clean(row.mileage) ? "mileage" :
        clean(row.kilometers) ? "kilometers" :
        clean(row.km) ? "km" :
        clean(row.odometer) ? "odometer" :
        clean(row.odometer_km) ? "odometer_km" :
        "unknown"
    };
  }

  function patchApiPayload(url, payload) {
    try {
      if (!payload || typeof payload !== "object") return payload;

      if (url.includes("/api/get-user-listings")) {
        if (Array.isArray(payload.data)) {
          payload.data = payload.data.map(normalizeListingLike);
        } else if (Array.isArray(payload.listings)) {
          payload.listings = payload.listings.map(normalizeListingLike);
        }
        return payload;
      }

      if (url.includes("/api/get-dashboard-summary")) {
        if (payload.data && Array.isArray(payload.data.recent_listings)) {
          payload.data.recent_listings = payload.data.recent_listings.map(normalizeListingLike);
        }
        if (payload.data && Array.isArray(payload.data.recent_activity)) {
          payload.data.recent_activity = payload.data.recent_activity.map(normalizeListingLike);
        }
        return payload;
      }

      return payload;
    } catch (error) {
      console.warn("[Bundle B] API payload patch warning:", error);
      return payload;
    }
  }

  function installFetchPatch() {
    if (window.__ELEVATE_BUNDLE_B_FETCH_PATCHED__) return;
    window.__ELEVATE_BUNDLE_B_FETCH_PATCHED__ = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async function patchedFetch(input, init) {
      const response = await originalFetch(input, init);
      try {
        const url = typeof input === "string" ? input : (input?.url || "");
        if (!url.includes("/api/get-user-listings") && !url.includes("/api/get-dashboard-summary")) {
          return response;
        }

        const cloned = response.clone();
        const text = await cloned.text();
        const json = JSON.parse(text || "{}");
        const patched = patchApiPayload(url, json);
        const body = JSON.stringify(patched);

        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      } catch {
        return response;
      }
    };
  }

  function injectStyles() {
    if (document.getElementById("bundle-b-phase22-styles")) return;
    const style = document.createElement("style");
    style.id = "bundle-b-phase22-styles";
    style.textContent = `
      .ea-b-collapsible {
        border: 1px solid rgba(212,175,55,0.10);
        border-radius: 16px;
        overflow: hidden;
        background: #111;
      }
      .ea-b-collapsible-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        cursor: pointer;
        background: rgba(255,255,255,0.02);
      }
      .ea-b-collapsible-head strong {
        font-size: 14px;
      }
      .ea-b-collapsible-body {
        display: none;
        padding: 16px;
        border-top: 1px solid rgba(212,175,55,0.08);
      }
      .ea-b-collapsible.open .ea-b-collapsible-body {
        display: block;
      }

      #overview .phase4-toolbar,
      #overview .phase3-toolbar,
      #overview .phase3-overview-shell > .i-memory-shell {
        display: none !important;
      }

      #overview .command-center-grid {
        margin-bottom: 14px !important;
      }

      #overview .operator-strip {
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        gap: 10px !important;
        margin-bottom: 14px !important;
      }

      #overview .mini-stat {
        min-height: 102px !important;
        padding: 14px !important;
      }

      #overview .mini-stat .stat-value {
        font-size: 22px !important;
      }

      #overview .mini-stat .stat-sub {
        font-size: 11px !important;
      }

      #overview .card,
      #overview .command-primary,
      #overview .command-side-card {
        border-radius: 14px !important;
      }

      #overview .command-primary {
        padding: 20px !important;
      }

      #overview .command-title-row h2 {
        font-size: 28px !important;
      }

      #overview .command-side-card[data-bundle-b-context="collapsed"],
      #overview [data-bundle-b-moved="true"] {
        display: none !important;
      }

      #overview .overview-action-item {
        padding: 12px 14px !important;
      }

      #overview .overview-action-grid .action-btn {
        padding: 12px 12px !important;
        font-size: 13px !important;
      }

      #overview .grid-2,
      #overview .grid-4 {
        gap: 14px !important;
        margin-bottom: 14px !important;
      }

      #overview .upgrade-card {
        margin-bottom: 14px !important;
      }

      .ea-b-listings-shell {
        display: grid;
        gap: 14px;
      }

      .ea-b-listings-toolbar {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 10px;
        align-items: center;
        margin-bottom: 10px;
      }

      .ea-b-listings-toolbar-left,
      .ea-b-listings-toolbar-right {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }

      .ea-b-listings-toolbar .action-btn,
      .ea-b-listings-toolbar select,
      .ea-b-listings-toolbar input,
      .ea-b-listings-toolbar .mini-btn {
        min-height: 40px;
      }

      .ea-b-listings-toolbar .action-btn {
        padding: 10px 12px !important;
        font-size: 13px !important;
      }

      .ea-b-listings-toolbar select,
      .ea-b-listings-toolbar input {
        background: #1a1a1a;
        color: #f5f5f5;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 13px;
      }

      .ea-b-view-toggle {
        display: inline-flex;
        gap: 6px;
        background: #111;
        border: 1px solid rgba(212,175,55,0.12);
        border-radius: 999px;
        padding: 5px;
      }

      .ea-b-view-toggle button {
        appearance: none;
        border: none;
        background: transparent;
        color: #d8d8d8;
        padding: 8px 12px;
        border-radius: 999px;
        cursor: pointer;
        font-weight: 700;
        font-size: 12px;
      }

      .ea-b-view-toggle button.active {
        background: rgba(212,175,55,0.15);
        color: #f3ddb0;
      }

      .ea-b-review-board {
        display: grid;
        gap: 12px;
      }

      .ea-b-review-lanes {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }

      .ea-b-review-lane {
        border: 1px solid rgba(212,175,55,0.12);
        border-radius: 16px;
        padding: 14px;
        background: linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0.006));
        min-height: 100%;
      }

      .ea-b-review-lane h3 {
        margin: 0 0 8px;
        font-size: 15px;
      }

      .ea-b-review-count {
        color: #f3ddb0;
        font-size: 24px;
        font-weight: 800;
        line-height: 1;
        margin-bottom: 8px;
      }

      .ea-b-review-item {
        padding: 10px 0;
        border-top: 1px solid rgba(255,255,255,0.06);
      }

      .ea-b-review-item:first-child {
        border-top: none;
        padding-top: 0;
      }

      .ea-b-review-item strong {
        display: block;
        margin-bottom: 4px;
        font-size: 13px;
      }

      .ea-b-review-item .meta {
        color: #a9a9a9;
        font-size: 12px;
        line-height: 1.45;
      }

      .listing-card {
        border-radius: 16px !important;
      }

      .listing-content {
        gap: 10px !important;
        padding: 14px !important;
      }

      .listing-price {
        font-size: 22px !important;
      }

      .listing-sub {
        font-size: 12px !important;
      }

      .listing-note {
        font-size: 12px !important;
        line-height: 1.45 !important;
      }

      .listing-specs,
      .listing-metrics {
        gap: 8px !important;
      }

      .spec-chip,
      .metric-pill {
        padding: 9px !important;
        border-radius: 10px !important;
      }

      .listing-actions {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 8px !important;
      }

      .listing-actions .action-btn {
        padding: 10px 10px !important;
        font-size: 12px !important;
      }

      #recentListingsGrid.ea-b-compact {
        display: grid;
        grid-template-columns: 1fr !important;
        gap: 10px !important;
      }

      #recentListingsGrid.ea-b-compact .listing-card {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 0;
        overflow: hidden;
      }

      #recentListingsGrid.ea-b-compact .listing-media {
        height: 100% !important;
        min-height: 110px;
        border-bottom: none !important;
        border-right: 1px solid rgba(255,255,255,0.05);
      }

      #recentListingsGrid.ea-b-compact .listing-content {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.9fr) auto;
        gap: 12px !important;
        align-items: start;
      }

      #recentListingsGrid.ea-b-compact .listing-price {
        font-size: 18px !important;
        margin-bottom: 4px;
      }

      #recentListingsGrid.ea-b-compact .listing-specs,
      #recentListingsGrid.ea-b-compact .listing-note:nth-of-type(2) {
        display: none !important;
      }

      #recentListingsGrid.ea-b-compact .listing-metrics {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }

      #recentListingsGrid.ea-b-compact .listing-actions {
        grid-template-columns: 1fr !important;
        align-self: stretch;
      }

      #recentListingsGrid.ea-b-compact .listing-actions .action-btn:nth-child(n+4) {
        display: none !important;
      }

      #recentListingsGrid.ea-b-compact .listing-note:first-of-type {
        margin: 0 !important;
      }

      @media (max-width: 1280px) {
        .ea-b-review-lanes {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .ea-b-listings-toolbar {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 760px) {
        #overview .operator-strip {
          grid-template-columns: 1fr !important;
        }
        .ea-b-review-lanes {
          grid-template-columns: 1fr;
        }
        #recentListingsGrid.ea-b-compact .listing-card,
        #recentListingsGrid.ea-b-compact .listing-content {
          grid-template-columns: 1fr !important;
        }
        #recentListingsGrid.ea-b-compact .listing-media {
          min-height: 150px;
          border-right: none;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function applyOverviewCompression() {
    const overview = document.getElementById("overview");
    if (!overview) return;

    const accountGrid = document.getElementById("overviewAccountGrid");
    const upgradeCard = document.getElementById("overviewUpgradeCard");
    const priorityGrid = document.getElementById("overviewPriorityGrid");

    let contextWrap = document.getElementById("bundleBContextWrap");
    if (!contextWrap) {
      contextWrap = document.createElement("div");
      contextWrap.id = "bundleBContextWrap";
      contextWrap.className = "ea-b-collapsible";
      contextWrap.innerHTML = `
        <div class="ea-b-collapsible-head">
          <div>
            <strong>Context, Setup & Expansion</strong>
            <div class="subtext">Secondary detail moved below the operator flow.</div>
          </div>
          <div class="subtext">Expand</div>
        </div>
        <div class="ea-b-collapsible-body"></div>
      `;
      const insertionPoint = priorityGrid?.nextElementSibling || overview.lastElementChild;
      if (insertionPoint) insertionPoint.insertAdjacentElement("afterend", contextWrap);
      else overview.appendChild(contextWrap);

      const head = contextWrap.querySelector(".ea-b-collapsible-head");
      head?.addEventListener("click", () => {
        contextWrap.classList.toggle("open");
        const sub = contextWrap.querySelector(".ea-b-collapsible-head .subtext:last-child");
        if (sub) sub.textContent = contextWrap.classList.contains("open") ? "Collapse" : "Expand";
      });
    }

    const body = contextWrap.querySelector(".ea-b-collapsible-body");
    [accountGrid, upgradeCard].filter(Boolean).forEach((el) => {
      if (el && body && el.parentElement !== body) body.appendChild(el);
    });
  }

  function ensureListingsToolbar() {
    const listingsCard = document.getElementById("overviewListingsCard");
    if (!listingsCard) return;

    const sectionHead = listingsCard.querySelector(".section-head");
    const quickFilters = document.getElementById("listingQuickFilters");
    const sortSelect = document.getElementById("listingSortSelect");
    const searchInput = document.getElementById("listingSearchInput");
    const refreshBtn = document.getElementById("refreshListingsBtn");
    const grid = document.getElementById("recentListingsGrid");

    if (!quickFilters || !sortSelect || !searchInput || !grid) return;

    let toolbar = document.getElementById("bundleBListingsToolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = "bundleBListingsToolbar";
      toolbar.className = "ea-b-listings-toolbar";
      toolbar.innerHTML = `
        <div class="ea-b-listings-toolbar-left"></div>
        <div class="ea-b-listings-toolbar-center"></div>
        <div class="ea-b-listings-toolbar-right"></div>
      `;
      sectionHead?.insertAdjacentElement("afterend", toolbar);
    }

    const left = toolbar.querySelector(".ea-b-listings-toolbar-left");
    const center = toolbar.querySelector(".ea-b-listings-toolbar-center");
    const right = toolbar.querySelector(".ea-b-listings-toolbar-right");

    if (left && quickFilters.parentElement !== left) left.appendChild(quickFilters);
    if (center && searchInput.parentElement !== center) center.appendChild(searchInput);

    if (right) {
      if (sortSelect.parentElement !== right) right.appendChild(sortSelect);
      if (refreshBtn && refreshBtn.parentElement !== right) right.appendChild(refreshBtn);

      let viewToggle = document.getElementById("bundleBViewToggle");
      if (!viewToggle) {
        viewToggle = document.createElement("div");
        viewToggle.id = "bundleBViewToggle";
        viewToggle.className = "ea-b-view-toggle";
        viewToggle.innerHTML = `
          <button type="button" data-view="card" class="active">Card</button>
          <button type="button" data-view="compact">Compact</button>
        `;
        right.appendChild(viewToggle);

        viewToggle.querySelectorAll("button").forEach((btn) => {
          btn.addEventListener("click", () => {
            viewToggle.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
            const compact = btn.getAttribute("data-view") === "compact";
            grid.classList.toggle("ea-b-compact", compact);
            try { localStorage.setItem("ea_bundle_b_listing_view", compact ? "compact" : "card"); } catch {}
          });
        });

        const saved = (() => {
          try { return localStorage.getItem("ea_bundle_b_listing_view") || "card"; } catch { return "card"; }
        })();
        const compact = saved === "compact";
        grid.classList.toggle("ea-b-compact", compact);
        viewToggle.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.getAttribute("data-view") === saved));
      }
    }

    listingsCard.classList.add("ea-b-listings-shell");
  }

  function cardDataFromDom(card) {
    const title = clean(card.querySelector(".listing-title")?.textContent || "");
    const priceText = clean(card.querySelector(".listing-price")?.textContent || "");
    const subtitle = clean(card.querySelector(".listing-sub")?.textContent || "");
    const statusLine = clean(card.querySelector(".status-line")?.textContent || "");
    const notes = Array.from(card.querySelectorAll(".listing-note")).map((el) => clean(el.textContent || ""));
    const metricValues = Array.from(card.querySelectorAll(".metric-pill-value")).map((el) => clean(el.textContent || ""));
    return {
      title,
      priceText,
      subtitle,
      statusLine,
      notes,
      metricValues
    };
  }

  function classifyReviewLane(cardData) {
    const blob = [cardData.subtitle, cardData.statusLine, ...cardData.notes].join(" ").toLowerCase();
    if (/review price|price/i.test(blob)) return "price";
    if (/sold|review delete|stale|removed/i.test(blob)) return "stale";
    if (/review new|new/i.test(blob)) return "new";
    return "attention";
  }

  function ensureReviewWorkspace() {
    const listingsCard = document.getElementById("overviewListingsCard");
    const grid = document.getElementById("recentListingsGrid");
    if (!listingsCard || !grid) return;

    let wrap = document.getElementById("bundleBReviewWorkspace");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "bundleBReviewWorkspace";
      wrap.className = "ea-b-review-board";
      wrap.innerHTML = `
        <div class="section-head">
          <div>
            <h2>Review Workspace</h2>
            <div class="subtext">A faster place to see sold/stale, price-watch, and new-review pressure without reading every card in full.</div>
          </div>
        </div>
        <div class="ea-b-review-lanes">
          <div class="ea-b-review-lane" data-lane="attention"><h3>Needs Attention</h3><div class="ea-b-review-count">0</div><div class="ea-b-review-items"></div></div>
          <div class="ea-b-review-lane" data-lane="stale"><h3>Likely Sold / Stale</h3><div class="ea-b-review-count">0</div><div class="ea-b-review-items"></div></div>
          <div class="ea-b-review-lane" data-lane="price"><h3>Price Watch</h3><div class="ea-b-review-count">0</div><div class="ea-b-review-items"></div></div>
          <div class="ea-b-review-lane" data-lane="new"><h3>New / Needs Review</h3><div class="ea-b-review-count">0</div><div class="ea-b-review-items"></div></div>
        </div>
      `;
      const toolbar = document.getElementById("bundleBListingsToolbar");
      if (toolbar) toolbar.insertAdjacentElement("afterend", wrap);
      else listingsCard.prepend(wrap);
    }

    const lanes = {
      attention: [],
      stale: [],
      price: [],
      new: []
    };

    Array.from(grid.querySelectorAll(".listing-card")).slice(0, 24).forEach((card) => {
      const data = cardDataFromDom(card);
      const lane = classifyReviewLane(data);
      lanes[lane].push(data);
    });

    wrap.querySelectorAll(".ea-b-review-lane").forEach((laneEl) => {
      const lane = laneEl.getAttribute("data-lane");
      const items = lanes[lane] || [];
      const countEl = laneEl.querySelector(".ea-b-review-count");
      const itemsEl = laneEl.querySelector(".ea-b-review-items");
      if (countEl) countEl.textContent = String(items.length);
      if (itemsEl) {
        itemsEl.innerHTML = items.length
          ? items.slice(0, 3).map((item) => `
              <div class="ea-b-review-item">
                <strong>${escapeHtml(item.title || "Listing")}</strong>
                <div class="meta">${escapeHtml(item.priceText || "")} • ${escapeHtml(item.statusLine || item.subtitle || "")}</div>
              </div>
            `).join("")
          : `<div class="ea-b-review-item"><div class="meta">No items in this lane right now.</div></div>`;
      }
    });
  }

  function postRenderFixPriceAndDensity() {
    const grid = document.getElementById("recentListingsGrid");
    if (!grid) return;

    Array.from(grid.querySelectorAll(".listing-card")).forEach((card) => {
      const priceEl = card.querySelector(".listing-price");
      const mileageChip = Array.from(card.querySelectorAll(".spec-chip")).find((chip) =>
        /mileage/i.test(clean(chip.querySelector(".spec-chip-label")?.textContent || ""))
      );
      const mileageValue = clean(mileageChip?.querySelector(".spec-chip-value")?.textContent || "");
      const priceText = clean(priceEl?.textContent || "");

      if (priceEl && mileageValue && priceText && priceText.replace(/\$/g, "").replace(/,/g, "") === mileageValue.replace(/km/ig, "").replace(/,/g, "").trim()) {
        priceEl.textContent = "Price needs review";
        priceEl.style.color = "var(--danger, #ffb4b4)";
      }

      const notes = Array.from(card.querySelectorAll(".listing-note"));
      if (notes.length > 1) {
        notes[1].style.display = grid.classList.contains("ea-b-compact") ? "none" : "";
      }

      const actions = Array.from(card.querySelectorAll(".listing-actions .action-btn"));
      actions.forEach((btn, index) => {
        if (!grid.classList.contains("ea-b-compact")) return;
        btn.style.display = index < 3 ? "" : "none";
      });
    });
  }

  function runUiPass() {
    injectStyles();
    applyOverviewCompression();
    ensureListingsToolbar();
    ensureReviewWorkspace();
    postRenderFixPriceAndDensity();
  }

  function installObservers() {
    if (window.__ELEVATE_BUNDLE_B_OBSERVERS__) return;
    window.__ELEVATE_BUNDLE_B_OBSERVERS__ = true;

    const observer = new MutationObserver(() => runUiPass());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  installFetchPatch();

  const boot = () => {
    runUiPass();
    installObservers();
    setTimeout(runUiPass, 900);
    setTimeout(runUiPass, 2200);
    setTimeout(runUiPass, 4200);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  NS.modules.bundle_b_phase22 = true;
})();
