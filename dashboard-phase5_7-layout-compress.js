(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase57layoutcompress) return;

  function injectStyle() {
    if (document.getElementById("ea-phase57-layout-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase57-layout-style";
    style.textContent = `
      #overview .command-primary {
        padding: 18px !important;
      }
      #overview .command-title-row h2,
      #overview .command-primary h2 {
        font-size: 24px !important;
        line-height: 1.05 !important;
        margin-bottom: 8px !important;
      }
      #overview .command-primary p,
      #overview .command-primary .subtext {
        font-size: 13px !important;
        line-height: 1.4 !important;
      }
      #overview .command-meta-grid,
      #overview .command-meta-strip,
      #overview .operator-strip {
        gap: 10px !important;
      }
      #overview .command-meta-card,
      #overview .mini-stat,
      #overview .status-chip,
      #overview .stat-chip {
        min-height: 0 !important;
        padding: 10px 12px !important;
      }
      #overview .mini-stat .stat-value,
      #overview .command-meta-value {
        font-size: 18px !important;
      }
      #overview #phase5NextMove,
      #overview .phase5-next-move {
        padding: 12px 14px !important;
        gap: 8px !important;
        margin-top: 10px !important;
        margin-bottom: 10px !important;
      }
      #overview .phase5-next-move-title {
        font-size: 18px !important;
      }
      #overview .phase5-next-move-copy {
        font-size: 13px !important;
        line-height: 1.4 !important;
      }
      #overview .phase5-signal-row {
        grid-template-columns: repeat(3, minmax(0,1fr)) !important;
        gap: 8px !important;
      }
      #overview .phase5-signal {
        padding: 8px 10px !important;
      }
      #overview .phase5-signal strong {
        font-size: 15px !important;
        margin-bottom: 4px !important;
      }
      #overview .phase5-signal span {
        font-size: 11px !important;
      }
      #overviewListingsCard {
        display: block !important;
        margin-top: 12px !important;
      }
      #overviewListingsCard .section-head {
        margin-bottom: 10px !important;
      }
      #overview #recentListingsGrid {
        gap: 12px !important;
      }
      #overview .listing-card {
        border-radius: 14px !important;
      }
      #overview .listing-media {
        height: 150px !important;
      }
      #overview .listing-content {
        padding: 12px !important;
        gap: 8px !important;
      }
      #overview .listing-title {
        font-size: 16px !important;
      }
      #overview .listing-price {
        font-size: 18px !important;
      }
      #overview .listing-actions .action-btn {
        padding: 10px 10px !important;
      }
      @media (max-width: 1020px) {
        #overview .phase5-signal-row {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function promoteAndCompress() {
    injectStyle();

    const overview = document.getElementById("overview");
    const listingsCard = document.getElementById("overviewListingsCard");
    const nextMove = document.getElementById("phase5NextMove") || overview?.querySelector(".phase5-next-move");
    const priorityGrid = document.getElementById("overviewPriorityGrid");
    const performanceGrid = document.getElementById("overviewPerformanceGrid");
    const accountRow = Array.from(overview?.children || []).find((el) => {
      const txt = String(el.textContent || "");
      return /Account Snapshot & Setup Readiness/i.test(txt);
    });

    if (!overview || !listingsCard) return;

    listingsCard.hidden = false;
    listingsCard.style.display = "block";

    const anchor = nextMove || priorityGrid || performanceGrid || accountRow;
    if (anchor && anchor.nextElementSibling !== listingsCard) {
      anchor.insertAdjacentElement("afterend", listingsCard);
    }

    const dataStatus = document.getElementById("listingDataStatus");
    if (dataStatus && !String(dataStatus.textContent || "").trim()) {
      dataStatus.textContent = "Recent listings promoted into the top overview layout.";
    }
  }

  function boot() {
    promoteAndCompress();
    setTimeout(promoteAndCompress, 250);
    setTimeout(promoteAndCompress, 900);
    setTimeout(promoteAndCompress, 1800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:sync-refreshed", () => setTimeout(promoteAndCompress, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(promoteAndCompress, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase57layoutcompress = true;
})();
