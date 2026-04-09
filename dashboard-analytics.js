
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.analytics) return;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
  function text(id) {
    return clean(document.getElementById(id)?.textContent || "");
  }
  function num(id) {
    const m = text(id).match(/-?\d[\d,]*/);
    return m ? Number(m[0].replace(/,/g, "")) : 0;
  }
  function showSection(name) {
    try { if (typeof window.showSection === "function") window.showSection(name); } catch {}
  }

  function injectStyles() {
    const css = `
      .ea-analytics-top{
        display:grid; gap:16px; margin-bottom:20px;
      }
      .ea-analytics-hero{
        border:1px solid rgba(212,175,55,0.18); border-radius:18px; background:
          radial-gradient(circle at top right, rgba(212,175,55,0.10), transparent 26%),
          linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.008)), #121212;
        padding:20px;
      }
      .ea-analytics-hero-grid{
        display:grid; grid-template-columns:1.25fr .95fr; gap:16px;
      }
      .ea-analytics-prompt-list{display:grid; gap:10px;}
      .ea-analytics-prompt{
        border:1px solid rgba(255,255,255,0.05); background:#151515; border-radius:14px; padding:14px;
      }
      .ea-analytics-prompt .k{font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#d4af37; font-weight:700; margin-bottom:6px;}
      .ea-analytics-prompt strong{display:block; margin-bottom:4px;}
      .ea-analytics-prompt span{font-size:13px; color:#b8b8b8; line-height:1.5;}
      @media (max-width: 980px){ .ea-analytics-hero-grid{grid-template-columns:1fr;} }
    `;
    NS.ui?.injectStyleOnce?.("ea-analytics-bundle-e", css);
  }

  function buildModel() {
    const postsRemaining = num("kpiPostsRemaining");
    const reviewQueue = num("kpiReviewQueue");
    const weakListings = num("kpiWeakListings");
    const needsAction = num("kpiNeedsAction");
    const activeListings = num("kpiActiveListings");
    const views = num("kpiViews");
    const messages = num("kpiMessages");
    const timeSaved = num("analyticsTimeSavedWeek") || num("analyticsTimeSavedToday");
    const revenueAttention = Math.max(reviewQueue + needsAction, weakListings);
    const efficiency = num("analyticsEfficiencyScore");
    const opportunities = [];

    if (postsRemaining > 0) opportunities.push({ bucket: "Capacity", title: `You still have ${postsRemaining} posting slot${postsRemaining === 1 ? "" : "s"} available`, copy: "Queue more vehicles and use available capacity before the day ends.", action: "Open Overview" });
    if (weakListings > 0) opportunities.push({ bucket: "Do Now", title: `Weak listing pressure: ${weakListings}`, copy: "Review copy, pricing, and media on underperforming units first.", action: "Review Listings" });
    if (reviewQueue > 0) opportunities.push({ bucket: "Review", title: `${reviewQueue} listing${reviewQueue === 1 ? "" : "s"} need validation`, copy: "Clear review items before they create stale or low-confidence output.", action: "Open Overview" });
    if (messages < Math.max(1, Math.floor(views / 20)) && views > 0) opportunities.push({ bucket: "Revenue Move", title: "Views are not converting into enough messages", copy: "Tighten CTA, pricing, and copy on listings with traction but weak response.", action: "Open Overview" });
    if (!opportunities.length) opportunities.push({ bucket: "Watch", title: "No urgent analytics fires", copy: "Stay focused on posting rhythm, review quality, and partner growth.", action: "Stay In Flow" });

    let bestMove = opportunities[0];
    let leak = weakListings > 0 ? "Weak listing quality is the biggest current leak." : reviewQueue > 0 ? "Review queue is slowing operator flow." : "No major leak detected.";
    let upside = postsRemaining > 0 ? "Unused posting capacity is the clearest upside right now." : activeListings > 0 ? "Improve low performers before expanding volume." : "First live output is still the biggest upside unlock.";

    return { postsRemaining, reviewQueue, weakListings, needsAction, activeListings, views, messages, timeSaved, revenueAttention, efficiency, opportunities, bestMove, leak, upside };
  }

  function render() {
    injectStyles();
    const section = document.getElementById("tools");
    if (!section) return;
    const model = buildModel();

    let mount = document.getElementById("eaAnalyticsTop");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "eaAnalyticsTop";
      mount.className = "ea-analytics-top";
      section.insertBefore(mount, section.firstElementChild);
    }

    mount.innerHTML = `
      <div class="ea-analytics-hero">
        <div class="section-head">
          <div>
            <div class="module-group-label">Decision Engine</div>
            <h2 style="margin-top:6px;">Use analytics to decide what move creates leverage.</h2>
            <div class="subtext">Metrics matter only when they lead to a revenue move, cleanup move, or capacity move.</div>
          </div>
        </div>
        <div class="ea-analytics-hero-grid">
          <div class="ea-analytics-prompt-list">
            <div class="ea-analytics-prompt">
              <div class="k">Best Next Move</div>
              <strong>${model.bestMove.title}</strong>
              <span>${model.bestMove.copy}</span>
            </div>
            <div class="ea-analytics-prompt">
              <div class="k">Biggest Leak</div>
              <strong>${model.leak}</strong>
              <span>Weak performers, review backlog, and underused capacity are the three current pressure points.</span>
            </div>
          </div>
          <div class="ea-analytics-prompt-list">
            <div class="ea-analytics-prompt">
              <div class="k">Revenue Attention</div>
              <strong>${model.revenueAttention}</strong>
              <span>Listings that likely need intervention, refresh, or human review.</span>
            </div>
            <div class="ea-analytics-prompt">
              <div class="k">Best Upside</div>
              <strong>${model.upside}</strong>
              <span>${model.postsRemaining > 0 ? "You still have execution room available." : "The next gain likely comes from improving quality, not raw volume."}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-head">
          <div>
            <div class="module-group-label">Priority Opportunity Queue</div>
            <h2 style="margin-top:6px;">What analytics says to do next.</h2>
            <div class="subtext">This ranks capacity, weak listing quality, and conversion friction into a business-action feed.</div>
          </div>
        </div>
        <div class="action-center-list">
          ${model.opportunities.slice(0, 5).map((item, idx) => `
            <div class="action-center-item">
              <div class="action-center-item-head">
                <div>
                  <div class="action-center-item-title">${idx + 1}. ${item.title}</div>
                  <div class="action-center-item-meta">${item.bucket}</div>
                </div>
                <span class="badge ${item.bucket === "Revenue Move" || item.bucket === "Capacity" ? "active" : item.bucket === "Watch" ? "warn" : "inactive"}">${item.bucket}</span>
              </div>
              <div class="action-center-item-copy">${item.copy}</div>
              <div class="action-center-item-actions">
                <button class="action-btn ea-analytics-action" type="button" data-idx="${idx}">${item.action}</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    mount.querySelectorAll(".ea-analytics-action").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = model.opportunities[Number(btn.dataset.idx)];
        if (!item) return;
        if (/overview|review/i.test(item.action)) showSection("overview");
      });
    });
  }

  function boot() {
    render();
    setTimeout(render, 1200);
    setTimeout(render, 3200);
  }

  NS.analytics = { mount() { render(); return true; }, render };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  NS.modules = NS.modules || {};
  NS.modules.analytics = true;
})();
