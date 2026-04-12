(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase57rlayoutonly) return;

  function injectStyle() {
    if (document.getElementById("ea-phase57r-layout-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase57r-layout-style";
    style.textContent = `
      #overview .command-primary {
        padding: 16px !important;
      }
      #overview .command-title-row h2,
      #overview .command-primary h2 {
        font-size: 22px !important;
        line-height: 1.05 !important;
        margin-bottom: 6px !important;
      }
      #overview .command-primary p,
      #overview .command-primary .subtext {
        font-size: 13px !important;
        line-height: 1.35 !important;
      }

      #overview .operator-strip,
      #overview .command-meta-grid,
      #overview .phase5-signal-row {
        gap: 8px !important;
      }

      #overview .mini-stat,
      #overview .command-meta-card,
      #overview .phase5-signal,
      #overview .status-chip,
      #overview .stat-chip {
        min-height: 0 !important;
        padding: 8px 10px !important;
      }

      #overview .mini-stat .stat-value,
      #overview .command-meta-value,
      #overview .phase5-signal strong {
        font-size: 16px !important;
      }

      #overview .phase5-next-move,
      #overview #phase5NextMove {
        padding: 10px 12px !important;
        gap: 6px !important;
        margin-top: 8px !important;
        margin-bottom: 10px !important;
      }

      #overview .phase5-next-move-title {
        font-size: 17px !important;
      }

      #overview .phase5-next-move-copy {
        font-size: 12px !important;
        line-height: 1.35 !important;
      }

      #overview .phase5-signal span {
        font-size: 10px !important;
      }

      #overviewListingsCard {
        display: block !important;
        margin-top: 10px !important;
      }

      #overviewListingsCard .section-head {
        margin-bottom: 8px !important;
      }

      #overview #recentListingsGrid {
        gap: 10px !important;
      }

      #overview .listing-media {
        height: 135px !important;
      }

      #overview .listing-content {
        padding: 10px !important;
        gap: 6px !important;
      }

      #overview .listing-title {
        font-size: 15px !important;
      }

      #overview .listing-price {
        font-size: 17px !important;
      }

      #overview .listing-actions .action-btn {
        padding: 8px 10px !important;
      }

      @media (max-width: 1020px) {
        #overview .phase5-signal-row {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function compressAndPromote() {
    injectStyle();

    const overview = document.getElementById("overview");
    const listingsCard = document.getElementById("overviewListingsCard");
    if (!overview || !listingsCard) return;

    listingsCard.hidden = false;
    listingsCard.style.display = "block";

    const nextMove = document.getElementById("phase5NextMove") || overview.querySelector(".phase5-next-move");
    const priorityGrid = document.getElementById("overviewPriorityGrid");
    const performanceGrid = document.getElementById("overviewPerformanceGrid");
    const fallbackAnchor = priorityGrid || performanceGrid || overview.querySelector(".operator-strip") || overview.querySelector(".command-center-grid");
    const anchor = nextMove || fallbackAnchor;

    if (anchor && anchor.nextElementSibling !== listingsCard) {
      anchor.insertAdjacentElement("afterend", listingsCard);
    }

    const dataStatus = document.getElementById("listingDataStatus");
    if (dataStatus && !String(dataStatus.textContent || "").trim()) {
      dataStatus.textContent = "Recent listings elevated into the primary overview viewport.";
    }
  }

  function boot() {
    compressAndPromote();
    setTimeout(compressAndPromote, 250);
    setTimeout(compressAndPromote, 900);
    setTimeout(compressAndPromote, 1800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:sync-refreshed", () => setTimeout(compressAndPromote, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(compressAndPromote, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase57rlayoutonly = true;
})();
