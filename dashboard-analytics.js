
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  NS.modules = NS.modules || {};

  const STYLE_ID = "ea-bundle-e-analytics-style";

  function qs(selector, root = document) { return root.querySelector(selector); }
  function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function text(id) { return clean(document.getElementById(id)?.textContent || ""); }
  function numberFromText(value) {
    const cleaned = clean(value).replace(/,/g, "");
    const match = cleaned.match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }
  function moneyFromText(value) {
    const cleaned = clean(value).replace(/,/g, "");
    const match = cleaned.match(/\$?\s*(-?\d+(\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }
  function formatMoney(value) {
    const n = Number(value || 0);
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  function formatCount(value) {
    return Number(value || 0).toLocaleString();
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ea-e-shell{display:grid;gap:18px;margin-bottom:20px}
      .ea-e-card{background:
        radial-gradient(circle at top right, rgba(212,175,55,0.10), transparent 28%),
        linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.006)),
        var(--panel);
        border:1px solid rgba(212,175,55,0.14);
        border-radius:18px;
        padding:20px;
        box-shadow:var(--shadow)}
      .ea-e-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}
      .ea-e-tag{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.20);color:var(--gold-soft);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
      .ea-e-title{font-size:28px;line-height:1.05;margin:8px 0 8px}
      .ea-e-sub{color:var(--muted);font-size:14px;line-height:1.55}
      .ea-e-badge{display:inline-flex;align-items:center;min-height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(212,175,55,0.20);background:rgba(212,175,55,0.10);color:var(--gold-soft);font-size:12px;font-weight:700}
      .ea-e-top-grid{display:grid;grid-template-columns:1.45fr .95fr;gap:16px}
      .ea-e-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .ea-e-kpi{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:14px}
      .ea-e-kpi-label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:8px}
      .ea-e-kpi-value{font-size:24px;font-weight:800;line-height:1.05}
      .ea-e-kpi-sub{margin-top:8px;color:var(--muted);font-size:12px;line-height:1.45}
      .ea-e-action-list{display:grid;gap:10px;margin-top:14px}
      .ea-e-action-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px 16px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,0.06)}
      .ea-e-action-item .meta{display:grid;gap:6px}
      .ea-e-action-item .title{font-size:15px;font-weight:700;line-height:1.25}
      .ea-e-action-item .copy{font-size:13px;line-height:1.5;color:var(--muted)}
      .ea-e-rank{min-width:34px;height:34px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.18);color:var(--gold-soft);font-weight:700;font-size:13px}
      .ea-e-chip-row{display:flex;gap:8px;flex-wrap:wrap}
      .ea-e-chip{display:inline-flex;align-items:center;min-height:30px;padding:0 10px;border-radius:999px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.06);color:#efefef;font-size:11px;font-weight:700}
      .ea-e-side-list{display:grid;gap:10px}
      .ea-e-side-item{padding:12px 14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,0.06)}
      .ea-e-side-item strong{display:block;font-size:13px;margin-bottom:5px}
      .ea-e-side-item span{display:block;font-size:12px;color:var(--muted);line-height:1.45}
      .ea-e-demote{opacity:.95}
      @media (max-width: 1180px){
        .ea-e-top-grid,.ea-e-kpi-grid{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function getListings() {
    const stateListings = Array.isArray(NS.state?.get?.("listings")) ? NS.state.get("listings") : [];
    if (stateListings.length) return stateListings;
    return [];
  }

  function buildActionQueue() {
    const views = numberFromText(text("kpiViews") || text("analyticsTimeSavedToday"));
    const messages = numberFromText(text("kpiMessages"));
    const weak = numberFromText(text("kpiWeakListings"));
    const review = numberFromText(text("kpiReviewQueue"));
    const needsAction = numberFromText(text("kpiNeedsAction"));
    const postsRemaining = numberFromText(text("kpiPostsRemaining") || text("extensionRemainingPosts"));
    const active = numberFromText(text("kpiActiveListings"));
    const stale = numberFromText(text("extensionStaleListings"));
    const queue = numberFromText(text("kpiQueuedVehicles"));
    const timeSaved = numberFromText(text("analyticsTimeSavedToday"));

    const actions = [];
    if (needsAction > 0) {
      actions.push({
        title: `Clear ${formatCount(needsAction)} listings needing action`,
        copy: "These units are already flagged as requiring intervention. Clean these first because they are the closest revenue leaks.",
        chips: ["Do Now", "Revenue Leak", "Operator"]
      });
    }
    if (review > 0) {
      actions.push({
        title: `Review ${formatCount(review)} queued or flagged listings`,
        copy: "Listings in review are blocking cleaner output. Validate them before adding more listing volume.",
        chips: ["Do Today", "Review Queue"]
      });
    }
    if (weak > 0) {
      actions.push({
        title: `Refresh ${formatCount(weak)} weak performers`,
        copy: "Weak listings need price, copy, photo, or repost intervention. Treat this as upside recovery rather than passive reporting.",
        chips: ["Opportunity", "Weak Performer"]
      });
    }
    if (stale > 0) {
      actions.push({
        title: `Verify ${formatCount(stale)} stale listings`,
        copy: "Older units likely need reposting, status review, or sold verification to prevent wasted attention.",
        chips: ["Opportunity", "Likely Sold"]
      });
    }
    if (postsRemaining > 0 && queue > 0) {
      actions.push({
        title: `Use remaining daily capacity`,
        copy: `You still have posting capacity and ${formatCount(queue)} vehicles queued. Convert idle capacity into more live inventory exposure today.`,
        chips: ["Leverage", "Capacity"]
      });
    }
    if (active > 0 && views > 0 && messages === 0) {
      actions.push({
        title: "Traction without response detected",
        copy: "Listings are generating views without message conversion. Review pricing, opening hook, and CTA language.",
        chips: ["Conversion", "Price Review"]
      });
    }
    if (timeSaved > 0) {
      actions.push({
        title: "Redeploy saved operator time",
        copy: "Use reclaimed time for higher-value work: more queue prep, more follow-up, or more partner outreach.",
        chips: ["Leverage", "Time Saved"]
      });
    }

    if (!actions.length) {
      actions.push({
        title: "Build the next revenue signal",
        copy: "Post more inventory, generate traction, and let the dashboard produce stronger action guidance from real activity.",
        chips: ["Baseline", "Noisy Signal Low"]
      });
    }

    return actions.slice(0, 5);
  }

  function buildInsightList() {
    const postsRemaining = numberFromText(text("kpiPostsRemaining") || text("extensionRemainingPosts"));
    const queue = numberFromText(text("kpiQueuedVehicles"));
    const weak = numberFromText(text("kpiWeakListings"));
    const active = numberFromText(text("kpiActiveListings"));
    const messages = numberFromText(text("kpiMessages"));
    const views = numberFromText(text("kpiViews"));

    const insights = [];

    insights.push({
      title: postsRemaining > 0 ? "Unused capacity exists" : "Daily capacity is tight",
      copy: postsRemaining > 0
        ? `There are still ${formatCount(postsRemaining)} posting slots available today.`
        : "Posting limit is close to fully used. Focus on quality intervention and response handling."
    });

    insights.push({
      title: queue > 0 ? "Inventory is ready to move" : "Queue needs to be built",
      copy: queue > 0
        ? `${formatCount(queue)} vehicles are already queued, which supports immediate output.`
        : "No vehicles are ready right now. Queue quality inventory before seeking more analytics depth."
    });

    insights.push({
      title: weak > 0 ? "Underperformance is visible" : "Weak performer count is low",
      copy: weak > 0
        ? `${formatCount(weak)} listings need copy, pricing, repost, or media review.`
        : "No major weak-performer cluster is currently visible from the tracked dashboard signals."
    });

    insights.push({
      title: views > 0 ? "Market attention is active" : "Attention signal is still thin",
      copy: views > 0
        ? `${formatCount(views)} tracked views across ${formatCount(active)} active listings.`
        : "More live posts are needed before the market signal becomes reliable."
    });

    insights.push({
      title: messages > 0 ? "Conversation signal exists" : "Response conversion needs work",
      copy: messages > 0
        ? `${formatCount(messages)} buyer conversations are already in the system.`
        : "Views without conversations usually point to offer, CTA, or pricing friction."
    });

    return insights.slice(0, 4);
  }

  function ensureHeader() {
    const section = document.getElementById("tools");
    if (!section) return null;
    let shell = document.getElementById("analyticsRevenueShell");
    if (!shell) {
      shell = document.createElement("div");
      shell.id = "analyticsRevenueShell";
      shell.className = "ea-e-shell";
      section.insertBefore(shell, section.firstElementChild);
    }
    return shell;
  }

  function render() {
    injectStyles();
    const shell = ensureHeader();
    if (!shell) return;

    const weak = numberFromText(text("kpiWeakListings"));
    const review = numberFromText(text("kpiReviewQueue"));
    const capacity = numberFromText(text("kpiPostsRemaining") || text("extensionRemainingPosts"));
    const value = moneyFromText(text("analyticsEstimatedValue"));
    const efficiency = numberFromText(text("analyticsEfficiencyScore"));
    const actions = buildActionQueue();
    const insights = buildInsightList();

    shell.innerHTML = `
      <div class="ea-e-card">
        <div class="ea-e-head">
          <div>
            <div class="ea-e-tag">Bundle E · Analytics Revenue Mode</div>
            <div class="ea-e-title">Turn listing data into business action.</div>
            <div class="ea-e-sub">This surface should tell the operator where the upside is, where the leak is, and what to do next — not just report metrics.</div>
          </div>
          <div class="ea-e-badge">${weak > 0 || review > 0 ? "Action Queue Live" : "Signal Building"}</div>
        </div>

        <div class="ea-e-top-grid">
          <div>
            <div class="ea-e-kpi-grid">
              <div class="ea-e-kpi">
                <div class="ea-e-kpi-label">Best Next Move</div>
                <div class="ea-e-kpi-value">${weak > 0 ? "Review Weak" : review > 0 ? "Clear Review" : capacity > 0 ? "Use Capacity" : "Build Signal"}</div>
                <div class="ea-e-kpi-sub">${actions[0]?.copy || "No clear action yet."}</div>
              </div>
              <div class="ea-e-kpi">
                <div class="ea-e-kpi-label">Revenue Attention</div>
                <div class="ea-e-kpi-value">${formatCount(Math.max(weak, review))}</div>
                <div class="ea-e-kpi-sub">Listings or queues needing intervention now.</div>
              </div>
              <div class="ea-e-kpi">
                <div class="ea-e-kpi-label">Remaining Capacity</div>
                <div class="ea-e-kpi-value">${formatCount(capacity)}</div>
                <div class="ea-e-kpi-sub">Unused posting output still available today.</div>
              </div>
              <div class="ea-e-kpi">
                <div class="ea-e-kpi-label">Estimated Value</div>
                <div class="ea-e-kpi-value">${formatMoney(value)}</div>
                <div class="ea-e-kpi-sub">Current time-saved leverage estimate.</div>
              </div>
            </div>

            <div class="ea-e-action-list">
              ${actions.map((item, idx) => `
                <div class="ea-e-action-item">
                  <div class="ea-e-rank">${idx + 1}</div>
                  <div class="meta" style="flex:1;">
                    <div class="title">${item.title}</div>
                    <div class="copy">${item.copy}</div>
                    <div class="ea-e-chip-row">
                      ${(item.chips || []).map((chip) => `<span class="ea-e-chip">${chip}</span>`).join("")}
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>

          <div class="ea-e-side-list">
            ${insights.map((item) => `
              <div class="ea-e-side-item">
                <strong>${item.title}</strong>
                <span>${item.copy}</span>
              </div>
            `).join("")}
            <div class="ea-e-side-item">
              <strong>Execution efficiency</strong>
              <span>${formatCount(efficiency)}% of visible capacity is currently being converted into tracked output.</span>
            </div>
          </div>
        </div>
      </div>
    `;

    demoteMetrics();
  }

  function demoteMetrics() {
    const cards = qsa('#tools > .grid-3 .card, #tools > .grid-2 .card');
    cards.forEach((card) => {
      if (!card.dataset.bundleEDemoted) {
        card.dataset.bundleEDemoted = "true";
        card.classList.add("ea-e-demote");
      }
    });
  }

  function mount() {
    render();
    setTimeout(render, 700);
    setTimeout(render, 2200);
  }

  NS.analytics = { mount, render };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
  if (NS.events instanceof EventTarget) {
    NS.events.addEventListener("state:set", () => setTimeout(render, 120));
  }
  NS.modules.analytics = true;
})();
