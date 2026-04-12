(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase56overviewpromote) return;

  function injectStyle() {
    if (document.getElementById("ea-phase56-overview-promote-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase56-overview-promote-style";
    style.textContent = `
      #overviewListingsCard {
        display: block !important;
        margin-top: 16px !important;
      }
      #overviewListingsCard .section-head h2::before {
        content: "Recent Listings";
      }
      #overviewListingsCard .section-head h2 {
        font-size: 0 !important;
      }
      #overviewListingsCard .section-head h2::before {
        font-size: 28px;
        line-height: 1.1;
      }
    `;
    document.head.appendChild(style);
  }

  function promoteListings() {
    injectStyle();

    const overview = document.getElementById("overview");
    const listingsCard = document.getElementById("overviewListingsCard");
    if (!overview || !listingsCard) return;

    listingsCard.hidden = false;
    listingsCard.style.display = "block";

    const priorityGrid = document.getElementById("overviewPriorityGrid");
    const performanceGrid = document.getElementById("overviewPerformanceGrid");
    const commandGrid = overview.querySelector(".command-center-grid");
    const operatorStrip = overview.querySelector(".operator-strip");
    const topInsertAnchor = priorityGrid || performanceGrid || operatorStrip || commandGrid;

    const currentParent = listingsCard.parentElement;
    if (topInsertAnchor && currentParent) {
      if (topInsertAnchor.nextElementSibling !== listingsCard) {
        topInsertAnchor.insertAdjacentElement("afterend", listingsCard);
      }
    }

    const dataStatus = document.getElementById("listingDataStatus");
    if (dataStatus && !String(dataStatus.textContent || "").trim()) {
      dataStatus.textContent = "Recent listings promoted higher in the overview.";
    }
  }

  function boot() {
    promoteListings()
    setTimeout(promoteListings, 250)
    setTimeout(promoteListings, 900)
    setTimeout(promoteListings, 1800)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:sync-refreshed", () => setTimeout(promoteListings, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(promoteListings, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase56overviewpromote = true;
})();
