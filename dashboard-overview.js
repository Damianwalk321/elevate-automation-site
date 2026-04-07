(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.overview) return;

  const CSS = `
    :root {
      --accent: #d4af37;
      --panel-soft: #141414;
      --panel-deep: #101010;
      --text-soft: #d6d6d6;
    }
    .phase4-shell { display:grid; gap:16px; }
    .phase4-toolbar { display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:8px; }
    .phase4-segment { display:inline-flex; gap:8px; background:#111; border:1px solid rgba(212,175,55,0.12); border-radius:999px; padding:6px; }
    .phase4-segment button { appearance:none; border:none; background:transparent; color:#d8d8d8; padding:10px 14px; border-radius:999px; cursor:pointer; font-weight:700; font-size:13px; }
    .phase4-segment button.active { background:rgba(212,175,55,0.15); color:#f3ddb0; }
    .phase4-group { display:grid; gap:16px; }
    .phase4-hidden { display:none !important; }
    .phase4-tag { display:inline-flex; align-items:center; padding:6px 10px; border-radius:999px; background:rgba(212,175,55,0.10); border:1px solid rgba(212,175,55,0.16); color:#f3ddb0; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; }
    .phase4-collapse { border:1px solid rgba(212,175,55,0.10); border-radius:16px; overflow:hidden; background:#111; }
    .phase4-collapse-head { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:14px 16px; cursor:pointer; background:rgba(255,255,255,0.02); }
    .phase4-collapse-body { display:none; padding:16px; border-top:1px solid rgba(212,175,55,0.08); }
    .phase4-collapse.open .phase4-collapse-body { display:block; }
  `;

  function applyOverviewHierarchy() {
    const { qs } = NS.ui || {};
    const overview = qs ? qs("#overview") : document.getElementById("overview");
    if (!overview || overview.dataset.phase4HierarchyBuilt === "true") return;
    overview.dataset.phase4HierarchyBuilt = "true";

    NS.ui.injectStyleOnce("elevate-dashboard-phase4-overview", CSS);

    const commandGrid = overview.querySelector(".command-center-grid");
    const operatorStrip = overview.querySelector(".operator-strip");
    const overviewChildren = Array.from(overview.children);
    const actionGrid = overviewChildren.find((el) => el.classList?.contains("grid-2"));
    const upgradeCard = overview.querySelector(".upgrade-card");
    const kpiGrid = overviewChildren.find((el) => el.classList?.contains("grid-4"));
    const listingsCard = Array.from(overview.querySelectorAll(".card")).find((card) => card.querySelector("#recentListingsGrid"));
    const bottomGrid = Array.from(overview.querySelectorAll(".grid-2")).find((grid) => grid.querySelector("#snapshotSetupSummary") || grid.querySelector("#setupReadinessSummary"));

    const shell = document.createElement("div");
    shell.className = "phase4-shell";
    shell.innerHTML = `
      <div class="phase4-toolbar">
        <div><span class="phase4-tag">Operator Focus</span></div>
        <div class="phase4-segment" id="phase4OverviewSegment">
          <button type="button" data-mode="core" class="active">Core</button>
          <button type="button" data-mode="listings">Listings</button>
          <button type="button" data-mode="secondary">Secondary</button>
          <button type="button" data-mode="all">All</button>
        </div>
      </div>
    `;

    const core = document.createElement("div");
    core.className = "phase4-group";
    core.dataset.group = "core";

    const listings = document.createElement("div");
    listings.className = "phase4-group";
    listings.dataset.group = "listings";

    const secondary = document.createElement("div");
    secondary.className = "phase4-group";
    secondary.dataset.group = "secondary";

    overview.prepend(shell);
    shell.appendChild(core);
    shell.appendChild(listings);
    shell.appendChild(secondary);

    [commandGrid, operatorStrip, actionGrid, kpiGrid].filter(Boolean).forEach((el) => core.appendChild(el));
    [listingsCard].filter(Boolean).forEach((el) => listings.appendChild(el));
    if (upgradeCard) secondary.appendChild(upgradeCard);

    if (bottomGrid) {
      const collapse = document.createElement("div");
      collapse.className = "phase4-collapse open";
      collapse.innerHTML = `
        <div class="phase4-collapse-head">
          <div>
            <div class="phase4-tag">Secondary Detail</div>
            <strong>Account Snapshot & Setup Readiness</strong>
          </div>
          <div class="subtext">Collapse</div>
        </div>
        <div class="phase4-collapse-body"></div>
      `;
      collapse.querySelector(".phase4-collapse-body").appendChild(bottomGrid);
      collapse.querySelector(".phase4-collapse-head").addEventListener("click", () => {
        collapse.classList.toggle("open");
        const sub = collapse.querySelector(".subtext");
        if (sub) sub.textContent = collapse.classList.contains("open") ? "Collapse" : "Expand";
      });
      secondary.appendChild(collapse);
    }

    const segment = shell.querySelector("#phase4OverviewSegment");
    if (segment) {
      const buttons = Array.from(segment.querySelectorAll("button"));
      const groups = { core: [core], listings: [listings], secondary: [secondary], all: [core, listings, secondary] };
      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          buttons.forEach((b) => b.classList.toggle("active", b === button));
          [core, listings, secondary].forEach((group) => group.classList.add("phase4-hidden"));
          (groups[button.dataset.mode || "all"] || groups.all).forEach((group) => group.classList.remove("phase4-hidden"));
        });
      });
    }
  }

  NS.overview = { applyOverviewHierarchy };
  NS.modules = NS.modules || {};
  NS.modules.overview = true;
})();
