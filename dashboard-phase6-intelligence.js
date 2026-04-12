(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase6intelligence) return;

  function injectStyle() {
    if (document.getElementById("ea-phase6-intelligence-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase6-intelligence-style";
    style.textContent = `
      #recentListingsGrid .ea-intel-row {
        display: grid;
        gap: 6px;
        margin: 0 0 10px;
      }
      #recentListingsGrid .ea-intel-pill {
        display: inline-flex;
        align-items: center;
        min-height: 26px;
        padding: 0 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        border: 1px solid rgba(212,175,55,0.18);
        background: rgba(212,175,55,0.08);
        color: #f3ddb0;
        width: fit-content;
      }
      #recentListingsGrid .ea-intel-copy {
        font-size: 12px;
        line-height: 1.45;
        color: var(--muted);
      }
      #recentListingsGrid .ea-empty-diagnostics {
        display: grid;
        gap: 8px;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255,255,255,0.06);
        font-size: 12px;
        color: var(--muted);
      }
      #recentListingsGrid .ea-empty-diagnostics strong {
        color: var(--text);
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

  function textFrom(el, selector) {
    return clean(el?.querySelector(selector)?.textContent || "");
  }

  function getTopListingsCount() {
    return document.querySelectorAll("#topListings .top-list-item").length;
  }

  function getSummaryStats() {
    const views = n(document.getElementById("kpiViews")?.textContent || 0);
    const messages = n(document.getElementById("kpiMessages")?.textContent || 0);
    const active = n(document.getElementById("kpiActiveListings")?.textContent || 0);
    const weak = n(document.getElementById("kpiWeakListings")?.textContent || 0);
    const needsAction = n(document.getElementById("kpiNeedsAction")?.textContent || 0);
    return { views, messages, active, weak, needsAction };
  }

  function classifyCard(card) {
    const title = textFrom(card, ".listing-title");
    const views = n(textFrom(card, ".metric-pill:nth-child(1) .metric-pill-value"));
    const messages = n(textFrom(card, ".metric-pill:nth-child(2) .metric-pill-value"));
    const priceText = textFrom(card, ".listing-price");
    const price = n(priceText);
    const note = clean(card.textContent || "");

    if (messages >= 2) {
      return {
        label: "High Interest",
        copy: `${title} is already pulling conversation. Keep it visible and avoid unnecessary changes while momentum is active.`
      };
    }

    if (views >= 20 && messages === 0) {
      return {
        label: "Pricing / CTA Review",
        copy: `${title} has attention without response. Review price framing, first-line copy, and image strength before posting more volume.`
      };
    }

    if (views >= 8 && messages <= 1) {
      return {
        label: "Watch Conversion",
        copy: `${title} is getting enough attention to matter, but not enough response to feel healthy yet.`
      };
    }

    if (price > 0 && /tracked/i.test(note)) {
      return {
        label: "Tracked Listing",
        copy: `${title} is being tracked, but there is not enough signal yet to call it strong or weak. Let it gather more traction.`
      };
    }

    return {
      label: "Low Signal",
      copy: `${title} has limited visible engagement right now. Keep it live, then review again after more exposure.`
    };
  }

  function applyCardIntelligence() {
    const cards = Array.from(document.querySelectorAll("#recentListingsGrid .listing-card"));
    cards.forEach((card) => {
      if (card.dataset.eaPhase6Decorated === "true") return;
      card.dataset.eaPhase6Decorated = "true";

      const content = card.querySelector(".listing-content");
      const metrics = card.querySelector(".listing-metrics");
      if (!content || !metrics) return;

      const intel = classifyCard(card);
      const row = document.createElement("div");
      row.className = "ea-intel-row";
      row.innerHTML = `
        <div class="ea-intel-pill">${intel.label}</div>
        <div class="ea-intel-copy">${intel.copy}</div>
      `;
      metrics.insertAdjacentElement("beforebegin", row);
    });
  }

  function hardenEmptyState() {
    const grid = document.getElementById("recentListingsGrid");
    if (!grid) return;
    const empty = grid.querySelector(".listing-empty");
    if (!empty) return;
    if (grid.querySelector(".ea-empty-diagnostics")) return;

    const topCount = getTopListingsCount();
    const stats = getSummaryStats();

    const diag = document.createElement("div");
    diag.className = "ea-empty-diagnostics";
    diag.innerHTML = `
      <div><strong>Why this can happen:</strong> the overview grid and the tracked listing panels do not always hydrate at the same moment.</div>
      <div><strong>Tracked elsewhere:</strong> ${topCount} card${topCount === 1 ? "" : "s"} detected in Most Popular.</div>
      <div><strong>Summary state:</strong> ${stats.active} active, ${stats.views} views, ${stats.messages} messages, ${stats.weak} weak, ${stats.needsAction} need action.</div>
      <div><strong>Operator move:</strong> use Analytics / Most Popular to inspect tracked listings while the overview feed catches up.</div>
    `;
    empty.appendChild(diag);
  }

  function updateDiagnostics() {
    const grid = document.getElementById("recentListingsGrid");
    const cards = grid ? grid.querySelectorAll(".listing-card").length : 0;
    const topCount = getTopListingsCount();
    const stats = getSummaryStats();

    const gridStatus = document.getElementById("listingGridStatus");
    if (gridStatus) {
      if (cards > 0) {
        gridStatus.textContent = `${cards} overview card${cards === 1 ? "" : "s"} live. ${stats.views} views and ${stats.messages} messages currently tracked.`;
      } else if (topCount > 0) {
        gridStatus.textContent = `Overview cards are still thin, but ${topCount} tracked listing card${topCount === 1 ? "" : "s"} exist in Most Popular.`;
      } else {
        gridStatus.textContent = `No listing cards are currently painted in overview.`;
      }
    }

    const dataStatus = document.getElementById("listingDataStatus");
    if (dataStatus) {
      if (cards > 0) {
        dataStatus.textContent = `Listing intelligence is live on overview cards.`;
      } else if (topCount > 0) {
        dataStatus.textContent = `Tracked listing data exists elsewhere on the page; overview grid is still catching up.`;
      } else {
        dataStatus.textContent = `No tracked overview cards yet.`;
      }
    }
  }

  function run() {
    injectStyle();
    applyCardIntelligence();
    hardenEmptyState();
    updateDiagnostics();
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
  NS.modules.phase6intelligence = true;
})();
