(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase16optimizationv2) return;

  function clean(v) {
    return String(v || "").replace(/\s+/g, " ").trim();
  }

  function n(v) {
    const m = String(v || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  function textFrom(root, selector) {
    return clean(root?.querySelector(selector)?.textContent || "");
  }

  function cardData() {
    return Array.from(document.querySelectorAll("#recentListingsGrid .listing-card")).map((card, idx) => ({
      id: clean(card.getAttribute("data-listing-id") || `overview_${idx + 1}`),
      title: textFrom(card, ".listing-title") || `Listing ${idx + 1}`,
      price: textFrom(card, ".listing-price"),
      status_line: textFrom(card, ".status-line"),
      color: textFrom(card, ".spec-chip:nth-child(2) .spec-chip-value"),
      fuel: textFrom(card, ".spec-chip:nth-child(3) .spec-chip-value"),
      views: n(textFrom(card, ".metric-pill:nth-child(1) .metric-pill-value")),
      messages: n(textFrom(card, ".metric-pill:nth-child(2) .metric-pill-value"))
    }));
  }

  function scoreTitle(card) {
    const t = clean(card.title);
    let score = 70;
    if (t.length < 12) score -= 20;
    if (t.length > 42) score -= 10;
    if (!/\d{4}/.test(t)) score -= 12;
    if (!/[A-Za-z]/.test(t)) score -= 20;
    if (/listing|vehicle/i.test(t)) score -= 10;
    return Math.max(0, Math.min(100, score));
  }

  function scoreMediaDetail(card) {
    let score = 72;
    if (!card.color || /not set/i.test(card.color)) score -= 22;
    if (!card.fuel || /not set/i.test(card.fuel)) score -= 14;
    if (!card.price || /^\$?0$/.test(card.price)) score -= 18;
    return Math.max(0, Math.min(100, score));
  }

  function scorePricingAttention(card) {
    if (card.views >= 20 && card.messages === 0) return 90;
    if (card.views >= 8 && card.messages <= 1) return 72;
    if (card.messages >= 2) return 40;
    if (card.views <= 3 && card.messages === 0) return 55;
    return 50;
  }

  function bestNextOptimization(card) {
    const titleScore = scoreTitle(card);
    const mediaScore = scoreMediaDetail(card);
    const pricingScore = scorePricingAttention(card);

    if (pricingScore >= 80) {
      return {
        action: "Review price framing and CTA",
        reason: `${card.title} is pulling views without reply depth. Pricing/CTA is the highest-likelihood next lever.`
      };
    }
    if (mediaScore <= 58) {
      return {
        action: "Improve detail completeness",
        reason: `${card.title} is missing enough listing detail that the presentation likely feels weaker than it should.`
      };
    }
    if (titleScore <= 58) {
      return {
        action: "Upgrade title / hook",
        reason: `${card.title} could be framed more sharply to win attention faster and improve click-through quality.`
      };
    }
    return {
      action: "Hold and monitor",
      reason: `${card.title} does not have one obvious dominant optimization need right now.`
    };
  }

  function buildOptimizationV2() {
    const cards = cardData();
    const ranked = cards.map(card => {
      const title_score = scoreTitle(card);
      const media_score = scoreMediaDetail(card);
      const pricing_attention_score = scorePricingAttention(card);
      const next = bestNextOptimization(card);

      const priority_score = Math.round(
        (100 - title_score) * 0.25 +
        (100 - media_score) * 0.30 +
        pricing_attention_score * 0.45
      );

      return {
        id: card.id,
        title: card.title,
        title_score,
        media_score,
        pricing_attention_score,
        priority_score,
        best_next_action: next.action,
        why: next.reason
      };
    }).sort((a, b) => b.priority_score - a.priority_score);

    return {
      version: "optimization-v2",
      captured_at: new Date().toISOString(),
      ranked_count: ranked.length,
      top_priority: ranked[0] || null,
      items: ranked
    };
  }

  function persist(summary) {
    NS.optimizationV2 = summary;
    window.dashboardOptimizationV2 = summary;

    if (NS.state?.set) {
      try {
        NS.state.set("optimization_v2", summary, { silent: true, skipPersist: false });
      } catch {}
    }

    NS.events?.dispatchEvent?.(new CustomEvent("optimization:v2", { detail: summary }));
    window.dispatchEvent(new CustomEvent("elevate:optimization-v2", { detail: summary }));
  }

  function addSignal(summary) {
    const target =
      document.getElementById("phase10MoatCard") ||
      document.getElementById("overviewListingsCard");

    if (!target) return;

    let signal = target.querySelector(".phase16-optimization-pill");
    if (!signal) {
      signal = document.createElement("div");
      signal.className = "phase16-optimization-pill";
      signal.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "min-height:24px",
        "padding:0 9px",
        "border-radius:999px",
        "font-size:10px",
        "font-weight:700",
        "letter-spacing:.03em",
        "border:1px solid rgba(212,175,55,0.18)",
        "background:rgba(212,175,55,0.08)",
        "color:#f3ddb0",
        "width:fit-content",
        "margin-top:8px"
      ].join(";");

      const anchor =
        target.querySelector(".phase15-attribution-pill") ||
        target.querySelector(".phase14-authority-pill") ||
        target.querySelector(".copy") ||
        target.firstElementChild;

      if (anchor) anchor.insertAdjacentElement("afterend", signal);
      else target.insertAdjacentElement("afterbegin", signal);
    }

    const top = summary.top_priority;
    signal.textContent = top
      ? `Optimization V2 • ${summary.ranked_count} ranked • Top: ${top.best_next_action}`
      : `Optimization V2 • No ranked listings yet`;
  }

  function updateStatus(summary) {
    const dataStatus = document.getElementById("listingDataStatus");
    if (!dataStatus) return;
    if (summary.ranked_count > 0) {
      dataStatus.textContent = `Listing intelligence, attribution, registry authority, transition reasoning, and optimization ranking are live on overview cards.`;
    }
  }

  function run() {
    const summary = buildOptimizationV2();
    persist(summary);
    addSignal(summary);
    updateStatus(summary);
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

  window.addEventListener("elevate:attribution-v2", () => setTimeout(run, 120));
  window.addEventListener("elevate:registry-authority-v1", () => setTimeout(run, 120));
  window.addEventListener("elevate:summary-v2", () => setTimeout(run, 120));
  window.addEventListener("elevate:sync-refreshed", () => setTimeout(run, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(run, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase16optimizationv2 = true;
})();