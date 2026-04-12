
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase42cleanup) return;

  const HIDE_SELECTORS = [
    "#bundleIMemoryShell",
    "#bundleIMemoryHero",
    "#bundleIMasterQueue",
    "#bundleITimeline",
    "#phase3OverviewSegment",
    "#phase4OverviewSegment",
    ".phase3-toolbar",
    ".phase4-toolbar",
    ".phase3-segment",
    ".phase4-segment",
    ".phase3-section-tag",
    ".phase4-tag"
  ];

  const WORKFLOW_PATTERNS = [
    /workflow state should survive refresh/i,
    /recent workflow history/i,
    /persistent workflow actions/i,
    /unified task queue/i,
    /master queue/i,
    /operator timeline/i,
    /workflow memory/i
  ];

  function addStyle() {
    if (document.getElementById("ea-phase42-cleanup-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase42-cleanup-style";
    style.textContent = `
      #bundleIMemoryShell,
      #bundleIMemoryHero,
      #bundleIMasterQueue,
      #bundleITimeline,
      .phase3-toolbar,
      .phase4-toolbar,
      #phase3OverviewSegment,
      #phase4OverviewSegment { display: none !important; }

      #overview .phase3-overview-shell,
      #overview .phase4-shell { gap: 16px !important; }

      #overview .phase3-overview-group[data-group="secondary"],
      #overview .phase4-group[data-group="secondary"] { opacity: 1 !important; }

      #overview .phase3-collapse:not(.open) .phase3-collapse-body,
      #overview .phase4-collapse:not(.open) .phase4-collapse-body { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  function matchesWorkflowCard(el) {
    if (!el) return false;
    const txt = String(el.textContent || "").replace(/\s+/g, " ").trim();
    return WORKFLOW_PATTERNS.some((rx) => rx.test(txt));
  }

  function hideNode(el) {
    if (!el || el.dataset.eaPhase42Hidden === "true") return;
    el.dataset.eaPhase42Hidden = "true";
    el.style.display = "none";
  }

  function cleanupOverview() {
    addStyle();

    HIDE_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach(hideNode);
    });

    const overview = document.getElementById("overview");
    if (!overview) return;

    overview.querySelectorAll(".card, .i-memory-card, .i-memory-hero, .phase3-collapse, .phase4-collapse, div").forEach((node) => {
      if (matchesWorkflowCard(node)) hideNode(node);
    });

    // collapse secondary detail by default
    overview.querySelectorAll(".phase3-collapse.open, .phase4-collapse.open").forEach((node) => {
      node.classList.remove("open");
      const sub = node.querySelector(".subtext");
      if (sub) sub.textContent = "Expand";
    });

    // Ensure core content order remains command -> strip -> priority -> listings -> secondary
    const listings = overview.querySelector("#overviewListingsCard");
    const priority = overview.querySelector("#overviewPriorityGrid");
    const performance = overview.querySelector("#overviewPerformanceGrid");
    const account = overview.querySelector("#overviewAccountGrid");
    const upgrade = overview.querySelector("#overviewUpgradeCard");

    const coreGroup = overview.querySelector('.phase3-overview-group[data-group="core"], .phase4-group[data-group="core"]');
    const listingsGroup = overview.querySelector('.phase3-overview-group[data-group="listings"], .phase4-group[data-group="listings"]');
    const secondaryGroup = overview.querySelector('.phase3-overview-group[data-group="secondary"], .phase4-group[data-group="secondary"]');

    if (coreGroup && priority && performance) {
      if (!coreGroup.contains(priority)) coreGroup.appendChild(priority);
      if (!coreGroup.contains(performance)) coreGroup.appendChild(performance);
    }
    if (listingsGroup && listings && !listingsGroup.contains(listings)) {
      listingsGroup.appendChild(listings);
    }
    if (secondaryGroup) {
      if (account && !secondaryGroup.contains(account)) secondaryGroup.appendChild(account);
      if (upgrade && !secondaryGroup.contains(upgrade)) secondaryGroup.appendChild(upgrade);
    }
  }

  function boot() {
    cleanupOverview();
    setTimeout(cleanupOverview, 400);
    setTimeout(cleanupOverview, 1200);
    setTimeout(cleanupOverview, 2600);

    const observer = new MutationObserver(() => cleanupOverview());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 12000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  NS.modules = NS.modules || {};
  NS.modules.phase42cleanup = true;
})();
