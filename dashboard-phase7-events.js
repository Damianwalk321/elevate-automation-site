(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase7events) return;

  function injectStyle() {
    if (document.getElementById("ea-phase7-events-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase7-events-style";
    style.textContent = `
      #recentListingsGrid .ea-attr-box {
        display: grid;
        gap: 6px;
        margin: 0 0 10px;
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
      }
      #recentListingsGrid .ea-attr-head {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      #recentListingsGrid .ea-attr-pill {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: 0 9px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .03em;
        border: 1px solid rgba(212,175,55,0.18);
        background: rgba(212,175,55,0.08);
        color: #f3ddb0;
      }
      #recentListingsGrid .ea-attr-copy {
        font-size: 12px;
        line-height: 1.45;
        color: var(--muted);
      }
      #recentListingsGrid .ea-attr-meta {
        font-size: 11px;
        color: var(--muted);
      }
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

  function getCardNumbers(card) {
    const pills = Array.from(card.querySelectorAll(".metric-pill-value")).map((el) => n(el.textContent));
    return {
      views: pills[0] || 0,
      messages: pills[1] || 0
    };
  }

  function inferAttribution(card) {
    const title = clean(card.querySelector(".listing-title")?.textContent || "Listing");
    const price = clean(card.querySelector(".listing-price")?.textContent || "");
    const statusLine = clean(card.querySelector(".status-line")?.textContent || "");
    const numbers = getCardNumbers(card);
    const topCards = document.querySelectorAll("#topListings .top-list-item").length;

    let source = "Observed";
    let event = "Stable";
    let reason = `${title} is currently being tracked with no strong change signal yet.`;

    if (numbers.messages >= 2) {
      event = "Message Lift";
      reason = `${title} has active conversation volume. This status is backed by observed message count, not just inference.`;
    } else if (numbers.views >= 20 && numbers.messages === 0) {
      source = "Inferred";
      event = "Conversion Leak";
      reason = `${title} is getting attention without response. This is an inferred recommendation from views vs messages, not a direct platform event.`;
    } else if (numbers.views >= 8 && numbers.messages <= 1) {
      source = "Inferred";
      event = "Watch";
      reason = `${title} has enough attention to matter, but not enough response to call it healthy yet.`;
    } else if (/price/i.test(statusLine)) {
      source = "Observed + Inferred";
      event = "Price Review";
      reason = `${title} is being flagged for price-related review based on visible listing state and recommendation logic.`;
    } else if (topCards > 0) {
      source = "Observed";
      event = "Tracked";
      reason = `${title} is present in the tracked dashboard feed. The recommendation layer is using visible card data rather than a backend event log only.`;
    }

    return { source, event, reason, price };
  }

  function decorateCards() {
    const cards = Array.from(document.querySelectorAll("#recentListingsGrid .listing-card"));
    cards.forEach((card) => {
      const old = card.querySelector(".ea-attr-box");
      if (old) old.remove();

      const metrics = card.querySelector(".listing-metrics");
      if (!metrics) return;

      const info = inferAttribution(card);
      const box = document.createElement("div");
      box.className = "ea-attr-box";
      box.innerHTML = `
        <div class="ea-attr-head">
          <span class="ea-attr-pill">${info.event}</span>
          <span class="ea-attr-pill">${info.source}</span>
        </div>
        <div class="ea-attr-copy">${info.reason}</div>
        <div class="ea-attr-meta">Attribution: ${info.source} • Event state: ${info.event}${info.price ? ` • Price visible: ${info.price}` : ""}</div>
      `;
      metrics.insertAdjacentElement("beforebegin", box);
    });
  }

  function updateStatus() {
    const cards = document.querySelectorAll("#recentListingsGrid .listing-card").length;
    const topCards = document.querySelectorAll("#topListings .top-list-item").length;
    const gridStatus = document.getElementById("listingGridStatus");
    const dataStatus = document.getElementById("listingDataStatus");

    if (gridStatus) {
      if (cards > 0) {
        gridStatus.textContent = `${cards} overview card${cards === 1 ? "" : "s"} now include event attribution and observed vs inferred reasoning.`;
      } else if (topCards > 0) {
        gridStatus.textContent = `Tracked listings exist in Most Popular, but overview cards are still thin. Attribution will appear here once cards hydrate.`;
      }
    }

    if (dataStatus) {
      if (cards > 0) dataStatus.textContent = "Event attribution layer is live on overview cards.";
    }
  }

  function run() {
    injectStyle();
    decorateCards();
    updateStatus();
  }

  function boot() {
    run();
    setTimeout(run, 300);
    setTimeout(run, 1000);
    setTimeout(run, 2200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:sync-refreshed", () => setTimeout(run, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(run, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase7events = true;
})();
