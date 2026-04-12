(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase17teamcommandv2) return;

  function clean(v) {
    return String(v || "").replace(/\s+/g, " ").trim();
  }

  function n(v) {
    const m = String(v || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  function injectStyle() {
    if (document.getElementById("ea-phase17-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase17-style";
    style.textContent = `
      #phase17TeamCommandCard {
        display:block;
        margin-top:12px;
        border:1px solid rgba(212,175,55,0.14);
        border-radius:14px;
        background:linear-gradient(180deg, rgba(212,175,55,0.06), rgba(255,255,255,0.02));
        padding:14px;
      }
      #phase17TeamCommandCard .head {
        display:flex;
        justify-content:space-between;
        align-items:start;
        gap:10px;
        margin-bottom:10px;
      }
      #phase17TeamCommandCard .eyebrow {
        font-size:10px;
        font-weight:700;
        letter-spacing:.08em;
        text-transform:uppercase;
        color:var(--gold-soft);
      }
      #phase17TeamCommandCard .title {
        font-size:20px;
        line-height:1.1;
        font-weight:800;
        margin-top:4px;
      }
      #phase17TeamCommandCard .copy {
        font-size:12px;
        line-height:1.4;
        color:var(--muted);
        max-width:760px;
      }
      #phase17TeamCommandCard .grid {
        display:grid;
        grid-template-columns:repeat(4, minmax(0,1fr));
        gap:8px;
        margin-top:10px;
      }
      #phase17TeamCommandCard .stat {
        background:rgba(255,255,255,0.03);
        border:1px solid rgba(255,255,255,0.05);
        border-radius:10px;
        padding:10px;
      }
      #phase17TeamCommandCard .stat strong {
        display:block;
        font-size:16px;
        line-height:1;
        margin-bottom:5px;
      }
      #phase17TeamCommandCard .stat span {
        font-size:11px;
        line-height:1.35;
        color:var(--muted);
      }
      #phase17TeamCommandCard .content-grid {
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
        margin-top:10px;
      }
      #phase17TeamCommandCard .panel {
        border-radius:10px;
        padding:10px;
        background:rgba(255,255,255,0.025);
        border:1px solid rgba(255,255,255,0.04);
      }
      #phase17TeamCommandCard .panel-title {
        font-size:11px;
        font-weight:700;
        letter-spacing:.05em;
        text-transform:uppercase;
        color:var(--gold-soft);
        margin-bottom:8px;
      }
      #phase17TeamCommandCard .item-list {
        display:grid;
        gap:8px;
      }
      #phase17TeamCommandCard .item {
        border-radius:9px;
        padding:8px 9px;
        background:rgba(255,255,255,0.02);
        border:1px solid rgba(255,255,255,0.04);
      }
      #phase17TeamCommandCard .item strong {
        display:block;
        font-size:12px;
        margin-bottom:3px;
      }
      #phase17TeamCommandCard .item span {
        font-size:11px;
        line-height:1.35;
        color:var(--muted);
      }
      @media (max-width: 980px) {
        #phase17TeamCommandCard .grid,
        #phase17TeamCommandCard .content-grid {
          grid-template-columns:1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function text(id) {
    return clean(document.getElementById(id)?.textContent || "");
  }

  function getEntities() {
    return window.dashboardEntitiesV1 || NS.entitiesV1 || NS.state?.get?.("entities_v1", {}) || {};
  }

  function getSummary() {
    return window.dashboardSummaryV2 || NS.summaryV2 || NS.state?.get?.("summary_v2", {}) || {};
  }

  function getOptimization() {
    return window.dashboardOptimizationV2 || NS.optimizationV2 || NS.state?.get?.("optimization_v2", {}) || {};
  }

  function buildTeamCommand() {
    const entities = getEntities();
    const summary = getSummary();
    const optimization = getOptimization();

    const members = Array.isArray(entities.members) && entities.members.length
      ? entities.members
      : [{
          id: "seed-member",
          name: clean(document.querySelector(".user-email")?.textContent || "Operator"),
          role: "operator",
          status: "active"
        }];

    const teamName = clean(entities.team?.name || "Primary Team");
    const dealershipName = clean(entities.dealership?.name || "Primary Dealership");

    const activeListings = n(summary.active_listings || 0);
    const weakListings = n(summary.weak_listings || 0);
    const needsAction = n(summary.needs_action || 0);
    const queuedVehicles = n(summary.queued_vehicles || 0);
    const setupProgress = n(summary.setup_progress_pct || 0);
    const postsRemaining = n(summary.posts_remaining || 0);

    const adoptionScore = Math.max(35, Math.min(96,
      40 +
      Math.min(20, activeListings * 4) +
      (setupProgress >= 100 ? 18 : Math.round(setupProgress / 8)) -
      Math.min(18, weakListings * 3) -
      Math.min(12, needsAction * 2)
    ));

    const repRows = members.map((member, idx) => ({
      name: clean(member.name || `Rep ${idx + 1}`),
      role: clean(member.role || "operator"),
      output: idx === 0 ? Math.max(1, activeListings) : 0,
      readiness: idx === 0 ? `${Math.max(0, setupProgress)}%` : "Seeded",
      status: clean(member.status || "active")
    }));

    const topOpt = Array.isArray(optimization.items) && optimization.items.length ? optimization.items[0] : null;

    const managerActions = [];
    if (setupProgress < 100) {
      managerActions.push({
        title: "Finish rep readiness before scaling output",
        copy: `Current setup is ${setupProgress}% complete. Clean setup remains the fastest manager leverage point.`
      });
    }
    if (needsAction > 0 || weakListings > 0) {
      managerActions.push({
        title: "Coach intervention inventory first",
        copy: `${needsAction} need-action and ${weakListings} weak listing${weakListings === 1 ? "" : "s"} are currently reducing team efficiency.`
      });
    }
    if (queuedVehicles > 0 && postsRemaining > 0) {
      managerActions.push({
        title: "Push ready queue while capacity exists",
        copy: `${queuedVehicles} queued vehicle${queuedVehicles === 1 ? "" : "s"} with ${postsRemaining} posts remaining means the team can still execute today.`
      });
    }
    if (topOpt) {
      managerActions.push({
        title: "Top optimization action is now ranked",
        copy: `${topOpt.best_next_action} is currently the highest-priority improvement on the visible listing set.`
      });
    }
    if (!managerActions.length) {
      managerActions.push({
        title: "Team state is stable",
        copy: "No dominant team-level intervention is outweighing normal output right now."
      });
    }

    const interventionQueue = [];
    if (topOpt) {
      interventionQueue.push({
        title: topOpt.title || "Top listing priority",
        copy: `${topOpt.best_next_action} • Priority ${topOpt.priority_score}`
      });
    }
    if (needsAction > 0) {
      interventionQueue.push({
        title: "Listings needing immediate action",
        copy: `${needsAction} listing${needsAction === 1 ? "" : "s"} are currently flagged for direct manager/operator attention.`
      });
    }
    if (weakListings > 0) {
      interventionQueue.push({
        title: "Weak-conversion inventory",
        copy: `${weakListings} weak listing${weakListings === 1 ? "" : "s"} are reducing overall dealer-side performance.`
      });
    }
    if (!interventionQueue.length) {
      interventionQueue.push({
        title: "No heavy intervention queue",
        copy: "Nothing in the visible dashboard state is creating a dominant intervention backlog right now."
      });
    }

    return {
      team_name: teamName,
      dealership_name: dealershipName,
      member_count: members.length,
      adoption_score: adoptionScore,
      active_listings: activeListings,
      queued_vehicles: queuedVehicles,
      rep_rows: repRows,
      manager_actions: managerActions.slice(0, 3),
      intervention_queue: interventionQueue.slice(0, 3)
    };
  }

  function persist(command) {
    NS.teamCommandV2 = command;
    window.dashboardTeamCommandV2 = command;

    if (NS.state?.set) {
      try {
        NS.state.set("team_command_v2", command, { silent: true, skipPersist: false });
      } catch {}
    }

    NS.events?.dispatchEvent?.(new CustomEvent("team-command:v2", { detail: command }));
    window.dispatchEvent(new CustomEvent("elevate:team-command-v2", { detail: command }));
  }

  function render(command) {
    injectStyle();

    const old = document.getElementById("phase17TeamCommandCard");
    if (old) old.remove();

    const anchor =
      document.getElementById("phase11DealershipCard") ||
      document.getElementById("phase8ManagerCompact") ||
      document.getElementById("overviewListingsCard");

    if (!anchor) return;

    const card = document.createElement("section");
    card.id = "phase17TeamCommandCard";
    card.innerHTML = `
      <div class="head">
        <div>
          <div class="eyebrow">Team / Dealer Command Center V2</div>
          <div class="title">${command.dealership_name} • ${command.team_name}</div>
          <div class="copy">This command layer turns the new entity model into manager-facing execution visibility: rep output, readiness posture, dealer intervention queue, and next actions.</div>
        </div>
      </div>

      <div class="grid">
        <div class="stat"><strong>${command.member_count}</strong><span>Team members currently represented in the entity model</span></div>
        <div class="stat"><strong>${command.adoption_score}</strong><span>Adoption / activation score based on readiness, inventory health, and visible execution state</span></div>
        <div class="stat"><strong>${command.active_listings}</strong><span>Active listings currently attributed to the visible command surface</span></div>
        <div class="stat"><strong>${command.queued_vehicles}</strong><span>Queued vehicles available for team execution</span></div>
      </div>

      <div class="content-grid">
        <div class="panel">
          <div class="panel-title">Rep / Team Snapshot</div>
          <div class="item-list">
            ${command.rep_rows.map(rep => `
              <div class="item">
                <strong>${rep.name} • ${rep.role}</strong>
                <span>Output: ${rep.output} active • Readiness: ${rep.readiness} • Status: ${rep.status}</span>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">Manager Next Actions</div>
          <div class="item-list">
            ${command.manager_actions.map(item => `
              <div class="item">
                <strong>${item.title}</strong>
                <span>${item.copy}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      <div class="content-grid">
        <div class="panel">
          <div class="panel-title">Dealer Intervention Queue</div>
          <div class="item-list">
            ${command.intervention_queue.map(item => `
              <div class="item">
                <strong>${item.title}</strong>
                <span>${item.copy}</span>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">Command Layer Status</div>
          <div class="item-list">
            <div class="item">
              <strong>Entity-backed rendering is live</strong>
              <span>The manager surface is now reading from the Phase 13 entity layer instead of only inferred dashboard heuristics.</span>
            </div>
            <div class="item">
              <strong>Operator homepage stays primary</strong>
              <span>This card is intentionally secondary so dealership value grows without taking over the operator workflow.</span>
            </div>
          </div>
        </div>
      </div>
    `;

    anchor.insertAdjacentElement("afterend", card);
  }

  function run() {
    const command = buildTeamCommand();
    persist(command);
    render(command);
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

  window.addEventListener("elevate:entities-v1", () => setTimeout(run, 120));
  window.addEventListener("elevate:summary-v2", () => setTimeout(run, 120));
  window.addEventListener("elevate:optimization-v2", () => setTimeout(run, 120));
  window.addEventListener("elevate:sync-refreshed", () => setTimeout(run, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(run, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase17teamcommandv2 = true;
})();