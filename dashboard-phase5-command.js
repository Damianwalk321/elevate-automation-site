(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase5command) return;

  const CSS = `
    #overview .command-primary.phase5-command-upgraded {
      padding: 22px;
    }
    #overview .phase5-next-move {
      margin-top: 14px;
      margin-bottom: 14px;
      border: 1px solid rgba(212,175,55,0.18);
      background: linear-gradient(180deg, rgba(212,175,55,0.08), rgba(255,255,255,0.01));
      border-radius: 16px;
      padding: 16px 18px;
      display: grid;
      gap: 12px;
    }
    #overview .phase5-next-move-top {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: start;
    }
    #overview .phase5-next-move-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--gold-soft);
    }
    #overview .phase5-next-move-title {
      font-size: 22px;
      line-height: 1.1;
      font-weight: 800;
      margin-top: 6px;
    }
    #overview .phase5-next-move-copy {
      color: var(--muted);
      line-height: 1.55;
      font-size: 14px;
    }
    #overview .phase5-signal-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0,1fr));
      gap: 10px;
    }
    #overview .phase5-signal {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 12px;
    }
    #overview .phase5-signal strong {
      display: block;
      font-size: 18px;
      line-height: 1;
      margin-bottom: 6px;
      color: var(--text);
    }
    #overview .phase5-signal span {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.4;
    }
    #overview #overviewActionList.phase5-secondary-actions {
      margin-top: 0;
    }
    #overview #overviewActionList.phase5-secondary-actions .overview-action-item {
      padding: 12px 14px;
    }
    #overview .phase5-secondary-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 2px;
      margin-bottom: 8px;
    }
    #overview .phase5-secondary-heading strong {
      font-size: 13px;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: var(--gold-soft);
    }
    #overview #overviewPriorityGrid.phase5-priority-grid {
      grid-template-columns: 1.15fr 0.85fr;
      gap: 16px;
    }
    #overview #overviewAccountGrid.phase5-context-grid {
      opacity: 0.96;
    }
    @media (max-width: 1020px) {
      #overview .phase5-signal-row,
      #overview #overviewPriorityGrid.phase5-priority-grid {
        grid-template-columns: 1fr;
      }
      #overview .phase5-next-move-top {
        flex-direction: column;
      }
    }
  `;

  function injectStyle() {
    if (document.getElementById("elevate-phase5-command-style")) return;
    const style = document.createElement("style");
    style.id = "elevate-phase5-command-style";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function text(id) {
    return clean(document.getElementById(id)?.textContent || "");
  }

  function numFromText(value) {
    const m = String(value || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  function computePrimaryMove() {
    const reviewQueue = numFromText(text("kpiReviewQueue"));
    const needsAction = numFromText(text("kpiNeedsAction"));
    const queued = numFromText(text("kpiQueuedVehicles"));
    const remaining = numFromText(text("kpiPostsRemaining"));
    const setupPct = numFromText(text("commandSetupProgress"));
    const weak = numFromText(text("kpiWeakListings"));

    if (setupPct < 100) {
      return {
        label: "Primary next move",
        title: "Finish setup blockers first.",
        copy: "Your cleanest leverage is removing the setup gaps that can weaken posting quality, compliance, or sync reliability.",
        ctaText: "Complete Setup",
        ctaSection: "profile",
        signals: [
          { value: `${setupPct}%`, label: "Readiness" },
          { value: `${remaining}`, label: "Posts remaining" },
          { value: `${queued}`, label: "Queued now" }
        ]
      };
    }

    if (reviewQueue > 0 || needsAction > 0 || weak > 0) {
      return {
        label: "Primary next move",
        title: "Clear intervention listings.",
        copy: "Resolve the listings already losing leverage before adding more posting pressure. This protects conversion and keeps the account cleaner.",
        ctaText: "Review Listings",
        ctaSection: null,
        ctaFocus: "listingSearchInput",
        signals: [
          { value: `${reviewQueue}`, label: "Review queue" },
          { value: `${needsAction}`, label: "Needs action" },
          { value: `${weak}`, label: "Weak listings" }
        ]
      };
    }

    if (queued > 0 && remaining > 0) {
      return {
        label: "Primary next move",
        title: "Push queued inventory now.",
        copy: "You have posting capacity and ready vehicles available. Use the remaining capacity while the queue is already prepared.",
        ctaText: "Open Tools",
        ctaSection: "extension",
        signals: [
          { value: `${queued}`, label: "Ready queue" },
          { value: `${remaining}`, label: "Posts remaining" },
          { value: text("commandPostsUsed") || "0 / 0", label: "Used today" }
        ]
      };
    }

    if (remaining <= 0) {
      return {
        label: "Primary next move",
        title: "Protect the account and monitor traction.",
        copy: "Daily capacity is exhausted. Use the rest of the session for review work, follow-up, and pricing or title cleanup.",
        ctaText: "Open Analytics",
        ctaSection: "tools",
        signals: [
          { value: `${remaining}`, label: "Posts remaining" },
          { value: `${needsAction}`, label: "Needs action" },
          { value: `${reviewQueue}`, label: "Review queue" }
        ]
      };
    }

    return {
      label: "Primary next move",
      title: "Monitor traction and keep the queue warm.",
      copy: "Nothing urgent is breaking right now. Stay on output, keep readiness clean, and watch which listings deserve the next push.",
      ctaText: "Open Analytics",
      ctaSection: "tools",
      signals: [
        { value: `${queued}`, label: "Ready queue" },
        { value: `${remaining}`, label: "Posts remaining" },
        { value: `${needsAction}`, label: "Needs action" }
      ]
    };
  }

  function buildPrimaryMoveCard(move) {
    return `
      <div id="phase5NextMove" class="phase5-next-move">
        <div class="phase5-next-move-top">
          <div>
            <div class="phase5-next-move-label">${move.label}</div>
            <div class="phase5-next-move-title">${move.title}</div>
          </div>
          <button id="phase5NextMoveBtn" class="mini-btn" type="button">${move.ctaText}</button>
        </div>
        <div class="phase5-next-move-copy">${move.copy}</div>
        <div class="phase5-signal-row">
          ${move.signals.map((item) => `
            <div class="phase5-signal">
              <strong>${item.value}</strong>
              <span>${item.label}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function render() {
    injectStyle();
    const overview = document.getElementById("overview");
    const commandPrimary = overview?.querySelector(".command-primary");
    const actionList = document.getElementById("overviewActionList");
    const priorityGrid = document.getElementById("overviewPriorityGrid");
    const accountGrid = document.getElementById("overviewAccountGrid");
    if (!overview || !commandPrimary || !actionList) return;

    commandPrimary.classList.add("phase5-command-upgraded");
    priorityGrid?.classList.add("phase5-priority-grid");
    accountGrid?.classList.add("phase5-context-grid");

    const oldCard = document.getElementById("phase5NextMove");
    if (oldCard) oldCard.remove();
    const oldHeading = document.getElementById("phase5SecondaryHeading");
    if (oldHeading) oldHeading.remove();

    const move = computePrimaryMove();
    actionList.insertAdjacentHTML("beforebegin", buildPrimaryMoveCard(move));
    actionList.insertAdjacentHTML("beforebegin", `
      <div id="phase5SecondaryHeading" class="phase5-secondary-heading">
        <strong>Secondary priorities</strong>
        <span class="subtext">Keep the next-best actions visible without overwhelming the page.</span>
      </div>
    `);
    actionList.classList.add("phase5-secondary-actions");

    const button = document.getElementById("phase5NextMoveBtn");
    if (button && !button.dataset.boundPhase5) {
      button.dataset.boundPhase5 = "true";
      button.addEventListener("click", () => {
        if (move.ctaSection && typeof window.showSection === "function") {
          window.showSection(move.ctaSection);
        }
        if (move.ctaFocus) {
          setTimeout(() => document.getElementById(move.ctaFocus)?.focus(), 220);
        }
      });
    }

    const blockers = document.getElementById("overviewBlockers");
    if (blockers) {
      const current = clean(blockers.textContent || "");
      if (current) {
        blockers.innerHTML = current
          .replace(/Posts:/i, "<strong>Output:</strong>")
          .replace(/Remaining:/i, "<strong>Remaining:</strong>")
          .replace(/Ready Queue:/i, "<strong>Queue:</strong>");
      }
    }
  }

  function boot() {
    render();
    setTimeout(render, 700);
    setTimeout(render, 1800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:sync-refreshed", () => setTimeout(render, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(render, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase5command = true;
})();