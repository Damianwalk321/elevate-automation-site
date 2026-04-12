(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase52hotfix) return;

  function injectStyle() {
    if (document.getElementById("ea-phase52-hotfix-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase52-hotfix-style";
    style.textContent = `
      #overviewListingsCard { display: block !important; }
      #recentListingsGrid { display: grid !important; }
    `;
    document.head.appendChild(style);
  }

  function restoreListings() {
    const overview = document.getElementById("overview");
    const listingsCard = document.getElementById("overviewListingsCard");
    const grid = document.getElementById("recentListingsGrid");
    if (!overview || !listingsCard) return;

    listingsCard.hidden = false;
    listingsCard.style.display = "block";
    listingsCard.removeAttribute("data-ea-phase42-hidden");

    if (grid) {
      grid.hidden = false;
      grid.style.display = "grid";
    }

    const priorityGrid = document.getElementById("overviewPriorityGrid");
    const performanceGrid = document.getElementById("overviewPerformanceGrid");
    const secondaryGroup =
      overview.querySelector('.phase3-overview-group[data-group="secondary"]') ||
      overview.querySelector('.phase4-group[data-group="secondary"]');

    const listGroup =
      overview.querySelector('.phase3-overview-group[data-group="listings"]') ||
      overview.querySelector('.phase4-group[data-group="listings"]');

    if (secondaryGroup && secondaryGroup.contains(listingsCard)) {
      if (performanceGrid?.parentElement) {
        performanceGrid.insertAdjacentElement("afterend", listingsCard);
      } else if (priorityGrid?.parentElement) {
        priorityGrid.insertAdjacentElement("afterend", listingsCard);
      } else {
        overview.appendChild(listingsCard);
      }
      return;
    }

    if (listGroup && !listGroup.contains(listingsCard)) {
      listGroup.appendChild(listingsCard);
    } else if (!listGroup && priorityGrid?.parentElement && listingsCard.previousElementSibling !== priorityGrid) {
      priorityGrid.insertAdjacentElement("afterend", listingsCard);
    }
  }

  function boot() {
    injectStyle();
    restoreListings();
    setTimeout(restoreListings, 250);
    setTimeout(restoreListings, 900);
    setTimeout(restoreListings, 1800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:sync-refreshed", () => setTimeout(restoreListings, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(restoreListings, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase52hotfix = true;
})();
