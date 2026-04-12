(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase11rsafeconsolidation) return;

  function clean(v) {
    return String(v || "").replace(/\s+/g, " ").trim();
  }

  function injectStyle() {
    if (document.getElementById("ea-phase11r-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase11r-style";
    style.textContent = `
      /* keep known clutter suppressed without touching core layout modules */
      [data-role-switcher],
      .role-switcher,
      .mode-switcher,
      .overview-mode-toggle,
      .segment-toggle,
      #phase3OverviewSegment,
      #phase4OverviewSegment,
      .phase3-toolbar,
      .phase4-toolbar {
        display: none !important;
      }

      /* light consistency pass only */
      #overviewListingsCard .section-head {
        margin-bottom: 8px !important;
      }
      #phase8ManagerCompact,
      #phase9CommercialCard,
      #phase10MoatCard {
        margin-top: 12px !important;
      }
    `;
    document.head.appendChild(style);
  }

  function removeKnownNoise() {
    const overview = document.getElementById("overview");
    if (!overview) return;

    const patterns = [
      /unified task queue/i,
      /workflow state should survive refresh/i,
      /recent workflow history/i,
      /persistent workflow actions/i,
      /operator timeline/i
    ];

    overview.querySelectorAll(".card, .phase3-collapse, .phase4-collapse, div, section").forEach((node) => {
      const txt = clean(node.textContent || "");
      if (!txt) return;
      if (patterns.some((rx) => rx.test(txt))) {
        node.style.display = "none";
      }
    });
  }

  function normalizeStatusCopy() {
    const gridStatus = document.getElementById("listingGridStatus");
    const dataStatus = document.getElementById("listingDataStatus");

    if (gridStatus) {
      const txt = clean(gridStatus.textContent || "");
      if (/hydrated from/i.test(txt)) {
        gridStatus.textContent = txt.replace(/hydrated from/gi, "synced from");
      }
    }

    if (dataStatus) {
      const txt = clean(dataStatus.textContent || "");
      if (txt && /overview listings synced from/i.test(txt)) return;
      if (!txt && document.querySelectorAll("#recentListingsGrid .listing-card").length > 0) {
        dataStatus.textContent = "Overview listings are live and tracked.";
      }
    }
  }

  function keepBusinessCardsOrdered() {
    const overview = document.getElementById("overview");
    const listings = document.getElementById("overviewListingsCard");
    const manager = document.getElementById("phase8ManagerCompact");
    const commercial = document.getElementById("phase9CommercialCard");
    const moat = document.getElementById("phase10MoatCard");
    if (!overview || !listings) return;

    if (manager && listings.nextElementSibling !== manager) {
      listings.insertAdjacentElement("afterend", manager);
    }
    if (commercial && manager && manager.nextElementSibling !== commercial) {
      manager.insertAdjacentElement("afterend", commercial);
    }
    if (moat && commercial && commercial.nextElementSibling !== moat) {
      commercial.insertAdjacentElement("afterend", moat);
    }
  }

  function run() {
    injectStyle();
    removeKnownNoise();
    normalizeStatusCopy();
    keepBusinessCardsOrdered();
  }

  function boot() {
    run();
    setTimeout(run, 250);
    setTimeout(run, 900);
    setTimeout(run, 1800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:sync-refreshed", () => setTimeout(run, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(run, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase11rsafeconsolidation = true;
})();