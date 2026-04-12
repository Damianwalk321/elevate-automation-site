(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase8manager) return;

  function injectStyle() {
    if (document.getElementById("ea-phase8-manager-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase8-manager-style";
    style.textContent = `
      #phase8ManagerCard {
        display: block;
        margin-top: 12px;
        border: 1px solid rgba(212,175,55,0.16);
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(212,175,55,0.06), rgba(255,255,255,0.02));
        padding: 16px;
      }
      #phase8ManagerCard .phase8-head {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 12px;
        margin-bottom: 12px;
      }
      #phase8ManagerCard .phase8-label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: var(--gold-soft);
      }
      #phase8ManagerCard .phase8-title {
        font-size: 24px;
        line-height: 1.08;
        font-weight: 800;
        margin-top: 6px;
      }
      #phase8ManagerCard .phase8-copy {
        font-size: 13px;
        color: var(--muted);
        line-height: 1.45;
        max-width: 760px;
      }
      #phase8ManagerCard .phase8-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0,1fr));
        gap: 10px;
        margin-top: 12px;
      }
      #phase8ManagerCard .phase8-stat {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 12px;
        padding: 12px;
      }
      #phase8ManagerCard .phase8-stat strong {
        display: block;
        font-size: 18px;
        line-height: 1;
        margin-bottom: 6px;
      }
      #phase8ManagerCard .phase8-stat span {
        font-size: 12px;
        color: var(--muted);
        line-height: 1.35;
      }
      #phase8ManagerCard .phase8-actions {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 12px;
        margin-top: 14px;
      }
      #phase8ManagerCard .phase8-panel {
        background: rgba(255,255,255,0.025);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 12px;
        padding: 12px;
      }
      #phase8ManagerCard .phase8-panel-title {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: .05em;
        text-transform: uppercase;
        color: var(--gold-soft);
        margin-bottom: 8px;
      }
      #phase8ManagerCard .phase8-list {
        display: grid;
        gap: 8px;
      }
      #phase8ManagerCard .phase8-list-item {
        border-radius: 10px;
        background: rgba(255,255,255,0.025);
        padding: 10px 11px;
        border: 1px solid rgba(255,255,255,0.04);
      }
      #phase8ManagerCard .phase8-list-item strong {
        display: block;
        font-size: 13px;
        margin-bottom: 4px;
      }
      #phase8ManagerCard .phase8-list-item span {
        font-size: 12px;
        color: var(--muted);
        line-height: 1.4;
      }
      @media (max-width: 1100px) {
        #phase8ManagerCard .phase8-grid,
        #phase8ManagerCard .phase8-actions {
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
    const queued = n(text("kpiQueuedVehicles"));
    const remaining = n(text("kpiPostsRemaining"));
    const setupPct = n(text("commandSetupProgress"));
    return { active, views, messages, weak, needsAction, queued, remaining, setupPct };
  }

  function buildManagerInsights() {
    const s = summary();
    const teamActive = Math.max(1, Math.min(8, Math.ceil((s.active || 1) / 2)));
    const readinessRisk = s.setupPct < 100 ? 1 : 0;
    const healthScore = Math.max(42, Math.min(94, 100 - (s.weak * 4 + s.needsAction * 5 + readinessRisk * 8)));
    const outputPressure = s.remaining <= 1 ? "High" : s.remaining <= 3 ? "Moderate" : "Controlled";

    const prompts = [];
    if (s.setupPct < 100) {
      prompts.push({
        title: "Close readiness gaps before scaling reps",
        copy: `Setup is ${s.setupPct}% complete. Manager priority is removing the current blocker before expanding posting volume.`
      });
    }
    if (s.needsAction > 0 || s.weak > 0) {
      prompts.push({
        title: "Coach intervention inventory first",
        copy: `${s.needsAction} need action and ${s.weak} weak listings are currently dragging quality. Review those before pushing more output.`
      });
    }
    if (s.queued > 0 && s.remaining > 0) {
      prompts.push({
        title: "There is ready inventory with posting capacity",
        copy: `${s.queued} queued unit${s.queued === 1 ? "" : "s"} and ${s.remaining} post${s.remaining === 1 ? "" : "s"} remaining means a manager can push for clean execution today.`
      });
    }
    if (!prompts.length) {
      prompts.push({
        title: "Team state is stable",
        copy: "No major readiness or inventory intervention issue is dominating right now. Maintain output quality and keep monitoring listing performance."
      });
    }

    const teamRows = [
      {
        name: "Sales Lead",
        copy: `${Math.max(1, Math.ceil(s.active / 2))} active listing${Math.max(1, Math.ceil(s.active / 2)) === 1 ? "" : "s"} under watch • readiness ${Math.max(70, s.setupPct)}%`
      },
      {
        name: "Posting Rep",
        copy: `${Math.max(0, s.remaining)} post${s.remaining === 1 ? "" : "s"} remaining • queue ${s.queued}`
      },
      {
        name: "Inventory Health",
        copy: `${s.weak} weak • ${s.needsAction} need action • output pressure ${outputPressure}`
      }
    ];

    return {
      teamActive,
      healthScore,
      readinessRisk: readinessRisk ? "Open" : "Clear",
      outputPressure,
      prompts,
      teamRows
    };
  }

  function renderManagerCard() {
    injectStyle();
    const overview = document.getElementById("overview");
    if (!overview) return;

    const existing = document.getElementById("phase8ManagerCard");
    if (existing) existing.remove();

    const info = buildManagerInsights();
    const card = document.createElement("section");
    card.id = "phase8ManagerCard";
    card.innerHTML = `
      <div class="phase8-head">
        <div>
          <div class="phase8-label">Manager / Team Layer</div>
          <div class="phase8-title">Dealership Health & Team Oversight</div>
          <div class="phase8-copy">This manager view translates current operator data into dealership-level signals so a sales manager can spot readiness gaps, output pressure, and intervention inventory without digging through the whole dashboard.</div>
        </div>
      </div>

      <div class="phase8-grid">
        <div class="phase8-stat"><strong>${info.teamActive}</strong><span>Active team contributors inferred from current operator inventory volume</span></div>
        <div class="phase8-stat"><strong>${info.healthScore}</strong><span>Dealership health score based on readiness, weak listings, and action backlog</span></div>
        <div class="phase8-stat"><strong>${info.readinessRisk}</strong><span>Manager readiness risk state across current setup and posting flow</span></div>
        <div class="phase8-stat"><strong>${info.outputPressure}</strong><span>Current posting pressure based on queue, remaining capacity, and intervention load</span></div>
      </div>

      <div class="phase8-actions">
        <div class="phase8-panel">
          <div class="phase8-panel-title">Manager Action Prompts</div>
          <div class="phase8-list">
            ${info.prompts.map(item => `
              <div class="phase8-list-item">
                <strong>${item.title}</strong>
                <span>${item.copy}</span>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="phase8-panel">
          <div class="phase8-panel-title">Rep / Team Snapshot</div>
          <div class="phase8-list">
            ${info.teamRows.map(item => `
              <div class="phase8-list-item">
                <strong>${item.name}</strong>
                <span>${item.copy}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;

    const listingsCard = document.getElementById("overviewListingsCard");
    const nextMove = document.getElementById("phase5NextMove") || overview.querySelector(".phase5-next-move");
    const anchor = listingsCard || nextMove || overview.firstElementChild;
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else overview.appendChild(card);

    const dataStatus = document.getElementById("listingDataStatus");
    if (dataStatus && !String(dataStatus.textContent || "").trim()) {
      dataStatus.textContent = "Manager layer is live for dealership-level oversight.";
    }
  }

  function boot() {
    renderManagerCard();
    setTimeout(renderManagerCard, 300);
    setTimeout(renderManagerCard, 1000);
    setTimeout(renderManagerCard, 2200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:sync-refreshed", () => setTimeout(renderManagerCard, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(renderManagerCard, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase8manager = true;
})();
