(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase53listingsshell) return;

  function injectStyle() {
    if (document.getElementById("ea-phase53-listings-shell-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase53-listings-shell-style";
    style.textContent = `
      #overviewListingsCard { display: block !important; }
      #recentListingsGrid { display: grid !important; }
      #recentListingsGrid .listing-empty {
        display: block !important;
        grid-column: 1 / -1;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureEmptyState(grid) {
    if (!grid) return;
    const hasCards = grid.querySelectorAll(".listing-card").length > 0;
    const existingEmpty = grid.querySelector(".listing-empty");

    if (!hasCards && !existingEmpty) {
      const empty = document.createElement("div");
      empty.className = "listing-empty";
      empty.textContent = "No listings loaded yet. As posts get registered, vehicle cards will appear here.";
      grid.appendChild(empty);
    }

    if (hasCards && existingEmpty) {
      existingEmpty.remove();
    }
  }

  function restoreListingsShell() {
    const overview = document.getElementById("overview");
    const card = document.getElementById("overviewListingsCard");
    const grid = document.getElementById("recentListingsGrid");
    if (!overview || !card) return;

    card.hidden = false;
    card.style.display = "block";
    card.removeAttribute("data-ea-phase42-hidden");

    if (grid) {
      grid.hidden = false;
      grid.style.display = "grid";
      ensureEmptyState(grid);
    }

    const status = document.getElementById("listingDataStatus");
    if (status && !String(status.textContent || "").trim()) {
      status.textContent = "Loading listing pipeline...";
    }

    const priorityGrid = document.getElementById("overviewPriorityGrid");
    const performanceGrid = document.getElementById("overviewPerformanceGrid");
    const listGroup =
      overview.querySelector('.phase3-overview-group[data-group="listings"]') ||
      overview.querySelector('.phase4-group[data-group="listings"]');

    if (listGroup) {
      if (!listGroup.contains(card)) listGroup.appendChild(card);
    } else if (performanceGrid?.parentElement) {
      performanceGrid.insertAdjacentElement("afterend", card);
    } else if (priorityGrid?.parentElement) {
      priorityGrid.insertAdjacentElement("afterend", card);
    }
  }

  function boot() {
    injectStyle();
    restoreListingsShell();
    setTimeout(restoreListingsShell, 250);
    setTimeout(restoreListingsShell, 900);
    setTimeout(restoreListingsShell, 1800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:sync-refreshed", () => setTimeout(restoreListingsShell, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(restoreListingsShell, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase53listingsshell = true;
})();
