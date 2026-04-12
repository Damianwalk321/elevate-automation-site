(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase8rcontainment) return;

  function injectStyle() {
    if (document.getElementById("ea-phase8r-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase8r-style";
    style.textContent = `
      /* remove reintroduced top clutter */
      #bundleIMasterQueue,
      #bundleIMemoryShell,
      #bundleIMemoryHero,
      #bundleITimeline,
      #phase3OverviewSegment,
      #phase4OverviewSegment,
      .phase3-toolbar,
      .phase4-toolbar,
      .phase3-segment,
      .phase4-segment,
      .phase3-section-tag,
      .phase4-tag,
      [data-role-switcher],
      .role-switcher,
      .mode-switcher,
      .overview-mode-toggle,
      .segment-toggle {
        display: none !important;
      }

      #phase8ManagerCompact {
        display: block;
        margin-top: 10px;
        border: 1px solid rgba(212,175,55,0.14);
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(212,175,55,0.05), rgba(255,255,255,0.015));
        padding: 12px;
      }
      #phase8ManagerCompact .head {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 10px;
        margin-bottom: 10px;
      }
      #phase8ManagerCompact .eyebrow {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: var(--gold-soft);
      }
      #phase8ManagerCompact .title {
        font-size: 18px;
        line-height: 1.1;
        font-weight: 800;
        margin-top: 4px;
      }
      #phase8ManagerCompact .copy {
        font-size: 12px;
        line-height: 1.4;
        color: var(--muted);
        max-width: 720px;
      }
      #phase8ManagerCompact .grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0,1fr));
        gap: 8px;
        margin-top: 10px;
      }
      #phase8ManagerCompact .stat {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 10px;
        padding: 10px;
      }
      #phase8ManagerCompact .stat strong {
        display: block;
        font-size: 16px;
        line-height: 1;
        margin-bottom: 5px;
      }
      #phase8ManagerCompact .stat span {
        font-size: 11px;
        line-height: 1.35;
        color: var(--muted);
      }
      #phase8ManagerCompact .prompt-list {
        display: grid;
        gap: 8px;
        margin-top: 10px;
      }
      #phase8ManagerCompact .prompt {
        border-radius: 10px;
        padding: 9px 10px;
        background: rgba(255,255,255,0.025);
        border: 1px solid rgba(255,255,255,0.04);
      }
      #phase8ManagerCompact .prompt strong {
        display: block;
        font-size: 12px;
        margin-bottom: 3px;
      }
      #phase8ManagerCompact .prompt span {
        font-size: 11px;
        line-height: 1.35;
        color: var(--muted);
      }
      @media (max-width: 1100px) {
        #phase8ManagerCompact .grid { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 760px) {
        #phase8ManagerCompact .grid { grid-template-columns: 1fr; }
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
    const queued = n(text("kpiQueuedVehicles"));
    const remaining = n(text("kpiPostsRemaining"));
    const setupPct = n(text("commandSetupProgress"));
    return { active, views, messages, weak, needsAction, queued, remaining, setupPct };
  }

  function buildInsights() {
    const s = summary();
    const teamActive = Math.max(1, Math.min(6, Math.ceil((s.active || 1) / 2)));
    const healthScore = Math.max(44, Math.min(93, 100 - (s.weak * 4 + s.needsAction * 5 + (s.setupPct < 100 ? 8 : 0))));
    const readinessRisk = s.setupPct < 100 ? "Open" : "Clear";
    const outputPressure = s.remaining <= 1 ? "High" : s.remaining <= 3 ? "Moderate" : "Controlled";

    const prompts = [];
    if (s.setupPct < 100) {
      prompts.push({
        title: "Manager priority: close readiness blockers",
        copy: `Setup is ${s.setupPct}% complete. Clear the blocker before pushing broader team posting activity.`
      });
    }
    if (s.needsAction > 0 || s.weak > 0) {
      prompts.push({
        title: "Intervention inventory needs coaching",
        copy: `${s.needsAction} need action and ${s.weak} weak listings are reducing output quality.`
      });
    }
    if (s.queued > 0 && s.remaining > 0) {
      prompts.push({
        title: "Ready inventory can be pushed today",
        copy: `${s.queued} queued with ${s.remaining} posts remaining means there is clean capacity available now.`
      });
    }
    if (!prompts.length) {
      prompts.push({
        title: "Dealership state is stable",
        copy: "No major readiness or inventory issue is dominating the current operator view."
      });
    }

    return { teamActive, healthScore, readinessRisk, outputPressure, prompts };
  }

  function removeLegacyManagerSurface() {
    document.querySelectorAll("#phase8ManagerCard").forEach((el) => el.remove());
  }

  function removeWorkflowNoise() {
    const patterns = [
      /unified task queue/i,
      /workflow state should survive refresh/i,
      /recent workflow history/i,
      /persistent workflow actions/i,
      /operator timeline/i,
      /core\s*\/\s*listings\s*\/\s*secondary/i,
    ];

    const overview = document.getElementById("overview");
    if (!overview) return;

    overview.querySelectorAll(".card, .phase3-collapse, .phase4-collapse, div, section").forEach((node) => {
      const txt = String(node.textContent || "").replace(/\s+/g, " ").trim();
      if (!txt) return;
      if (patterns.some((rx) => rx.test(txt))) {
        node.style.display = "none";
      }
    });
  }

  function renderCompactManagerCard() {
    injectStyle();
    removeLegacyManagerSurface();
    removeWorkflowNoise();

    const overview = document.getElementById("overview");
    if (!overview) return;

    const existing = document.getElementById("phase8ManagerCompact");
    if (existing) existing.remove();

    const info = buildInsights();

    const card = document.createElement("section");
    card.id = "phase8ManagerCompact";
    card.innerHTML = `
      <div class="head">
        <div>
          <div class="eyebrow">Dealership Summary</div>
          <div class="title">Manager Oversight</div>
          <div class="copy">Compact dealership-level visibility built on current operator data. This keeps the operator homepage primary while still giving a manager a fast read on health and intervention needs.</div>
        </div>
      </div>
      <div class="grid">
        <div class="stat"><strong>${info.teamActive}</strong><span>Active team contributors inferred</span></div>
        <div class="stat"><strong>${info.healthScore}</strong><span>Dealership health score</span></div>
        <div class="stat"><strong>${info.readinessRisk}</strong><span>Readiness risk</span></div>
        <div class="stat"><strong>${info.outputPressure}</strong><span>Output pressure</span></div>
      </div>
      <div class="prompt-list">
        ${info.prompts.map(item => `
          <div class="prompt">
            <strong>${item.title}</strong>
            <span>${item.copy}</span>
          </div>
        `).join("")}
      </div>
    `;

    const listingsCard = document.getElementById("overviewListingsCard");
    const nextMove = document.getElementById("phase5NextMove") || overview.querySelector(".phase5-next-move");
    const anchor = listingsCard || nextMove || overview.firstElementChild;
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else overview.appendChild(card);
  }

  function boot() {
    renderCompactManagerCard();
    setTimeout(renderCompactManagerCard, 300);
    setTimeout(renderCompactManagerCard, 1000);
    setTimeout(renderCompactManagerCard, 2200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:sync-refreshed", () => setTimeout(renderCompactManagerCard, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(renderCompactManagerCard, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase8rcontainment = true;
})();
