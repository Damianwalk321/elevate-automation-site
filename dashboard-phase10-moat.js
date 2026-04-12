(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase10moat) return;

  function injectStyle() {
    if (document.getElementById("ea-phase10-moat-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase10-moat-style";
    style.textContent = `
      #phase10MoatCard {
        display: block;
        margin-top: 12px;
        border: 1px solid rgba(212,175,55,0.14);
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(212,175,55,0.06), rgba(255,255,255,0.02));
        padding: 14px;
      }
      #phase10MoatCard .head {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 10px;
        margin-bottom: 10px;
      }
      #phase10MoatCard .eyebrow {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: var(--gold-soft);
      }
      #phase10MoatCard .title {
        font-size: 20px;
        line-height: 1.1;
        font-weight: 800;
        margin-top: 4px;
      }
      #phase10MoatCard .copy {
        font-size: 12px;
        line-height: 1.4;
        color: var(--muted);
        max-width: 760px;
      }
      #phase10MoatCard .grid {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 10px;
        margin-top: 12px;
      }
      #phase10MoatCard .panel {
        border-radius: 10px;
        padding: 10px;
        background: rgba(255,255,255,0.025);
        border: 1px solid rgba(255,255,255,0.04);
      }
      #phase10MoatCard .panel-title {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .05em;
        text-transform: uppercase;
        color: var(--gold-soft);
        margin-bottom: 8px;
      }
      #phase10MoatCard .item-list {
        display: grid;
        gap: 8px;
      }
      #phase10MoatCard .item {
        border-radius: 9px;
        padding: 8px 9px;
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.04);
      }
      #phase10MoatCard .item strong {
        display: block;
        font-size: 12px;
        margin-bottom: 3px;
      }
      #phase10MoatCard .item span {
        font-size: 11px;
        line-height: 1.35;
        color: var(--muted);
      }
      #phase10MoatCard .stat-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0,1fr));
        gap: 8px;
        margin-top: 10px;
      }
      #phase10MoatCard .stat {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 10px;
        padding: 10px;
      }
      #phase10MoatCard .stat strong {
        display: block;
        font-size: 16px;
        line-height: 1;
        margin-bottom: 5px;
      }
      #phase10MoatCard .stat span {
        font-size: 11px;
        line-height: 1.35;
        color: var(--muted);
      }
      @media (max-width: 980px) {
        #phase10MoatCard .grid,
        #phase10MoatCard .stat-row {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function n(v) {
    const m = String(v || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  function text(id) {
    return String(document.getElementById(id)?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function summary() {
    const active = n(text("kpiActiveListings"));
    const views = n(text("kpiViews"));
    const messages = n(text("kpiMessages"));
    const weak = n(text("kpiWeakListings"));
    const needsAction = n(text("kpiNeedsAction"));
    return { active, views, messages, weak, needsAction };
  }

  function getOverviewCards() {
    return Array.from(document.querySelectorAll("#recentListingsGrid .listing-card")).slice(0, 6).map((card) => {
      const title = textFrom(card, ".listing-title");
      const price = textFrom(card, ".listing-price");
      const statusLine = textFrom(card, ".status-line");
      const views = n(textFrom(card, ".metric-pill:nth-child(1) .metric-pill-value"));
      const messages = n(textFrom(card, ".metric-pill:nth-child(2) .metric-pill-value"));
      const color = textFrom(card, ".spec-chip:nth-child(2) .spec-chip-value");
      const fuel = textFrom(card, ".spec-chip:nth-child(3) .spec-chip-value");
      return { title, price, statusLine, views, messages, color, fuel };
    });
  }

  function textFrom(root, selector) {
    return String(root?.querySelector(selector)?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function buildOptimization(items, s) {
    const suggestions = [];

    const highViewsLowMessages = items.find((x) => x.views >= 15 && x.messages === 0);
    if (highViewsLowMessages) {
      suggestions.push({
        title: "Price / CTA optimization signal",
        copy: `${highViewsLowMessages.title} is drawing views without replies. Rework price framing or first-line CTA before adding more exposure.`
      });
    }

    const lowSignal = items.find((x) => x.views <= 3 && x.messages === 0);
    if (lowSignal) {
      suggestions.push({
        title: "Title / hook upgrade opportunity",
        copy: `${lowSignal.title} has weak early signal. A stronger title angle or benefit-led hook is the most likely first lever.`
      });
    }

    const noColor = items.find((x) => /not set/i.test(x.color || ""));
    if (noColor) {
      suggestions.push({
        title: "Media / detail completeness gap",
        copy: `${noColor.title} is missing strong descriptive detail. Complete color/media fields so the listing feels more premium and searchable.`
      });
    }

    if (s.weak > 0) {
      suggestions.push({
        title: "Benchmark-style intervention queue",
        copy: `${s.weak} weak listing${s.weak === 1 ? "" : "s"} are in the current state. That is where optimization effort should be concentrated first.`
      });
    }

    if (!suggestions.length) {
      suggestions.push({
        title: "Optimization state is stable",
        copy: "No dominant pricing, title, or media weakness is overwhelming the current dashboard view. Keep monitoring for clearer divergence."
      });
    }

    return suggestions.slice(0, 4);
  }

  function buildWhyItMatters(items, s) {
    const points = [];

    points.push({
      title: "Smarter than generic posting",
      copy: "The dashboard is now translating listing state into optimization suggestions, not just showing raw cards and counts."
    });

    if (items.length) {
      points.push({
        title: "Visible listing-specific guidance",
        copy: `${items.length} overview card${items.length === 1 ? "" : "s"} currently support recommendation logic around price, title, or media strength.`
      });
    }

    points.push({
      title: "Moat signal",
      copy: "As recommendation quality improves, this becomes harder for a basic posting tool to replicate because the value is in interpretation, not just publishing."
    });

    if (s.views > 0 || s.messages > 0) {
      points.push({
        title: "Optimization backed by traction",
        copy: `${s.views} views and ${s.messages} messages currently tracked means recommendations are anchored to live activity, not only static listing data.`
      });
    }

    return points.slice(0, 4);
  }

  function renderMoatCard() {
    injectStyle();

    const overview = document.getElementById("overview");
    if (!overview) return;

    const existing = document.getElementById("phase10MoatCard");
    if (existing) existing.remove();

    const s = summary();
    const items = getOverviewCards();
    const optimizations = buildOptimization(items, s);
    const reasons = buildWhyItMatters(items, s);

    const moatStrength =
      items.length >= 3 && (s.views > 0 || s.messages > 0) ? "Building" :
      items.length >= 1 ? "Early" : "Foundational";

    const card = document.createElement("section");
    card.id = "phase10MoatCard";
    card.innerHTML = `
      <div class="head">
        <div>
          <div class="eyebrow">Strategic Moat Layer</div>
          <div class="title">Optimization Intelligence & Benchmark Signals</div>
          <div class="copy">This first moat layer turns live listing state into pricing, title, media, and benchmark-style guidance so the platform feels meaningfully smarter than a generic posting tool.</div>
        </div>
      </div>

      <div class="stat-row">
        <div class="stat"><strong>${moatStrength}</strong><span>Current moat strength based on visible listing intelligence and live activity context</span></div>
        <div class="stat"><strong>${items.length}</strong><span>Overview cards currently supporting optimization suggestions</span></div>
        <div class="stat"><strong>${s.weak}</strong><span>Weak listings currently available for targeted optimization intervention</span></div>
      </div>

      <div class="grid">
        <div class="panel">
          <div class="panel-title">Optimization Suggestions</div>
          <div class="item-list">
            ${optimizations.map(item => `
              <div class="item">
                <strong>${item.title}</strong>
                <span>${item.copy}</span>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">Why This Matters</div>
          <div class="item-list">
            ${reasons.map(item => `
              <div class="item">
                <strong>${item.title}</strong>
                <span>${item.copy}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;

    const commercial = document.getElementById("phase9CommercialCard");
    const anchor = commercial || overview.lastElementChild;
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else overview.appendChild(card);
  }

  function boot() {
    renderMoatCard();
    setTimeout(renderMoatCard, 300);
    setTimeout(renderMoatCard, 1000);
    setTimeout(renderMoatCard, 2200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:sync-refreshed", () => setTimeout(renderMoatCard, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(renderMoatCard, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase10moat = true;
})();
