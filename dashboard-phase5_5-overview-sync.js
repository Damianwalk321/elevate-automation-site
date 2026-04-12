(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase55overviewsync) return;

  function injectStyle() {
    if (document.getElementById("ea-phase55-overview-sync-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase55-overview-sync-style";
    style.textContent = `
      #overviewListingsCard { display: block !important; }
      #recentListingsGrid { display: grid !important; }
      #recentListingsGrid .listing-card { display: grid !important; }
      #recentListingsGrid .listing-empty { grid-column: 1 / -1; }
    `;
    document.head.appendChild(style);
  }

  function clean(v) {
    return String(v || "").replace(/\s+/g, " ").trim();
  }

  function n(v) {
    const m = String(v || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
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
    const num = Number(value || 0);
    if (!num) return "$0";
    try {
      return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(num);
    } catch {
      return `$${num}`;
    }
  }

  function formatMileage(value) {
    const num = Number(value || 0);
    return num ? `${num.toLocaleString()} km` : "Not set";
  }

  function placeholderVehicleImage(label) {
    const text = encodeURIComponent(clean(label || "Vehicle"));
    return `https://placehold.co/800x500/111111/d4af37?text=${text}`;
  }

  function windowRows() {
    if (Array.isArray(window.filteredListings) && window.filteredListings.length) return window.filteredListings;
    if (Array.isArray(window.dashboardListings) && window.dashboardListings.length) return window.dashboardListings;
    return [];
  }

  function topRows() {
    return Array.from(document.querySelectorAll("#topListings .top-list-item")).map((row, idx) => {
      const title = clean(row.querySelector(".top-title")?.textContent || `Listing ${idx + 1}`);
      const sub = clean(row.querySelector(".top-sub")?.textContent || "");
      const metrics = clean(row.querySelector(".top-metrics")?.textContent || "");
      const img = row.querySelector("img")?.getAttribute("src") || "";
      const idMatch = clean(row.getAttribute("data-listing-id") || "");
      return {
        id: idMatch || `top_${idx + 1}`,
        title,
        price: n(sub),
        mileage: n((sub.match(/([\d,]+)\s*km/i) || [])[1] || 0),
        views_count: n((metrics.match(/👁\s*([\d,]+)/) || [])[1] || 0),
        messages_count: n((metrics.match(/💬\s*([\d,]+)/) || [])[1] || 0),
        image_url: img || placeholderVehicleImage(title),
        health_label: "Tracked",
        recommended_action: "Inspect",
        status: "active"
      };
    });
  }

  function cardHtml(item) {
    const image = clean(item.image_url || item.cover_photo || item.photo || "") || placeholderVehicleImage(item.title);
    const title = clean(item.title || [item.year, item.make, item.model, item.trim].filter(Boolean).join(" ")) || "Vehicle Listing";
    const price = formatCurrency(item.price || item.current_price || 0);
    const mileage = formatMileage(item.mileage || item.km || 0);
    const views = n(item.views_count || item.views || 0);
    const messages = n(item.messages_count || item.messages || 0);
    const color = clean(item.exterior_color || item.color || "Not set");
    const fuel = clean(item.fuel_type || "Not set");
    const health = clean(item.health_label || "Tracked");
    const action = clean(item.recommended_action || "Inspect");

    return `
      <article class="listing-card">
        <div class="listing-media">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" onerror="this.src='${escapeHtml(placeholderVehicleImage(title))}'" />
          <div class="listing-badge"><span class="badge active">Active</span></div>
        </div>
        <div class="listing-content">
          <div>
            <div class="listing-title">${escapeHtml(title)}</div>
            <div class="listing-sub">${escapeHtml(clean(item.stock_number ? `Stock ${item.stock_number}` : item.body_style || "Tracked listing"))}</div>
          </div>
          <div class="listing-price">${escapeHtml(price)}</div>
          <div class="status-line">${escapeHtml(health)} • ${escapeHtml(action)}</div>
          <div class="listing-specs">
            <div class="spec-chip">
              <div class="spec-chip-label">Mileage</div>
              <div class="spec-chip-value">${escapeHtml(mileage)}</div>
            </div>
            <div class="spec-chip">
              <div class="spec-chip-label">Color</div>
              <div class="spec-chip-value">${escapeHtml(color)}</div>
            </div>
            <div class="spec-chip">
              <div class="spec-chip-label">Fuel</div>
              <div class="spec-chip-value">${escapeHtml(fuel)}</div>
            </div>
          </div>
          <div class="listing-metrics">
            <div class="metric-pill">
              <div class="metric-pill-label">Views</div>
              <div class="metric-pill-value">${views}</div>
            </div>
            <div class="metric-pill">
              <div class="metric-pill-label">Messages</div>
              <div class="metric-pill-value">${messages}</div>
            </div>
            <div class="metric-pill">
              <div class="metric-pill-label">Source</div>
              <div class="metric-pill-value">Tracked</div>
            </div>
          </div>
          <div class="listing-actions">
            <button class="action-btn" type="button">Inspect</button>
          </div>
        </div>
      </article>
    `;
  }

  function syncOverviewGrid() {
    injectStyle();

    const card = document.getElementById("overviewListingsCard");
    const grid = document.getElementById("recentListingsGrid");
    if (!card || !grid) return;

    card.hidden = false;
    card.style.display = "block";
    grid.hidden = false;
    grid.style.display = "grid";

    const existing = grid.querySelectorAll(".listing-card").length;
    if (existing > 0) return;

    let rows = windowRows();
    let source = "dashboard arrays";

    if (!rows.length) {
      rows = topRows();
      source = "Most Popular";
    }

    if (!rows.length) return;

    grid.innerHTML = rows.slice(0, 6).map(cardHtml).join("");

    const status = document.getElementById("listingGridStatus");
    if (status) {
      status.textContent = `${Math.min(rows.length, 6)} overview card${Math.min(rows.length, 6) === 1 ? "" : "s"} hydrated from ${source}.`;
    }

    const dataStatus = document.getElementById("listingDataStatus");
    if (dataStatus) {
      dataStatus.textContent = `Overview listings synced from ${source}.`;
    }
  }

  function boot() {
    syncOverviewGrid();
    setTimeout(syncOverviewGrid, 250);
    setTimeout(syncOverviewGrid, 900);
    setTimeout(syncOverviewGrid, 1800);
    setTimeout(syncOverviewGrid, 3200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:sync-refreshed", () => setTimeout(syncOverviewGrid, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(syncOverviewGrid, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase55overviewsync = true;
})();
