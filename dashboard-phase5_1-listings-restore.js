(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase51listingsrestore) return;

  function injectStyle() {
    if (document.getElementById("ea-phase51-listings-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase51-listings-style";
    style.textContent = `
      #overviewListingsCard,
      #overviewListingsCard * {
        visibility: visible !important;
      }

      #overviewListingsCard {
        display: block !important;
        order: 40 !important;
      }

      #recentListingsGrid {
        display: grid !important;
      }

      #overview .phase3-overview-group[data-group="listings"],
      #overview .phase4-group[data-group="listings"] {
        display: grid !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureListingsPosition() {
    const overview = document.getElementById("overview");
    const listingsCard = document.getElementById("overviewListingsCard");
    if (!overview || !listingsCard) return;

    listingsCard.dataset.eaPhase51Protected = "true";
    listingsCard.style.display = "block";

    const priorityGrid = document.getElementById("overviewPriorityGrid");
    const performanceGrid = document.getElementById("overviewPerformanceGrid");
    const accountGrid = document.getElementById("overviewAccountGrid");
    const upgradeCard = document.getElementById("overviewUpgradeCard");

    const listGroup =
      overview.querySelector('.phase3-overview-group[data-group="listings"]') ||
      overview.querySelector('.phase4-group[data-group="listings"]');

    const secondaryGroup =
      overview.querySelector('.phase3-overview-group[data-group="secondary"]') ||
      overview.querySelector('.phase4-group[data-group="secondary"]');

    const coreGroup =
      overview.querySelector('.phase3-overview-group[data-group="core"]') ||
      overview.querySelector('.phase4-group[data-group="core"]');

    if (listGroup) {
      if (!listGroup.contains(listingsCard)) {
        listGroup.appendChild(listingsCard);
      }
    } else {
      if (priorityGrid?.parentElement) {
        priorityGrid.insertAdjacentElement("afterend", listingsCard);
      } else if (performanceGrid?.parentElement) {
        performanceGrid.insertAdjacentElement("afterend", listingsCard);
      } else if (coreGroup) {
        coreGroup.appendChild(listingsCard);
      } else {
        overview.appendChild(listingsCard);
      }
    }

    if (secondaryGroup) {
      if (accountGrid && !secondaryGroup.contains(accountGrid)) secondaryGroup.appendChild(accountGrid);
      if (upgradeCard && !secondaryGroup.contains(upgradeCard)) secondaryGroup.appendChild(upgradeCard);
    }

    const grid = document.getElementById("recentListingsGrid");
    if (grid) {
      grid.style.display = "grid";
    }
  }

  function unhideListingsIfNeeded() {
    const listingsCard = document.getElementById("overviewListingsCard");
    const recentListingsGrid = document.getElementById("recentListingsGrid");
    if (listingsCard) {
      listingsCard.style.display = "block";
      listingsCard.hidden = false;
    }
    if (recentListingsGrid) {
      recentListingsGrid.style.display = "grid";
      recentListingsGrid.hidden = false;
    }
  }

  function cleanupInterference() {
    const overview = document.getElementById("overview");
    const listingsCard = document.getElementById("overviewListingsCard");
    if (!overview || !listingsCard) return;

    overview.querySelectorAll("[data-ea-phase42-hidden='true']").forEach((node) => {
      if (node === listingsCard || node.contains(listingsCard) || listingsCard.contains(node)) {
        node.dataset.eaPhase42Hidden = "false";
        node.style.display = "";
      }
    });
  }

  function restore() {
    injectStyle();
    cleanupInterference();
    unhideListingsIfNeeded();
    ensureListingsPosition();
  }

  function boot() {
    restore();
    setTimeout(restore, 250);
    setTimeout(restore, 900);
    setTimeout(restore, 1800);
    setTimeout(restore, 3200);

    const observer = new MutationObserver(() => restore());
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    setTimeout(() => observer.disconnect(), 12000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:sync-refreshed", () => setTimeout(restore, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(restore, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase51listingsrestore = true;
})();
