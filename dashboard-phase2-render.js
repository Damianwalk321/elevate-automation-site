(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase2render) return;

  let observer = null;
  let settleTimer = null;
  let revealTimer = null;
  let fallbackTimer = null;
  let frameA = 0;
  let frameB = 0;
  let ready = false;

  const STYLE_ID = "ea-phase2-render-style";
  const REVEAL_DELAY_MS = 220;
  const FALLBACK_REVEAL_MS = 2200;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body[data-ea-loader="loading"] .main-inner,
      body[data-dashboard-ready="false"] .main-inner,
      body[data-ea-layout="pending"] .main-inner {
        opacity: 0;
        transform: translateY(8px);
      }

      .main-inner {
        transition: opacity 180ms ease, transform 180ms ease;
        will-change: opacity, transform;
      }

      body[data-ea-layout="ready"] .main-inner,
      body[data-dashboard-ready="true"] .main-inner,
      body[data-dashboard-ready="timeout"] .main-inner,
      body[data-ea-loader="error"] .main-inner {
        opacity: 1;
        transform: none;
      }

      #bootStatus:empty {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  function setLayoutState(state) {
    try {
      document.body?.setAttribute("data-ea-layout", state);
    } catch {}
  }

  function clearObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function markReady(reason = "ready") {
    injectStyles();
    ready = true;
    clearTimeout(settleTimer);
    clearTimeout(revealTimer);
    clearTimeout(fallbackTimer);
    clearObserver();
    cancelAnimationFrame(frameA);
    cancelAnimationFrame(frameB);
    setLayoutState(reason === "error" ? "error" : "ready");
  }

  function applyOverviewHierarchyPass() {
    const overview = document.getElementById("overview");
    if (!overview || overview.dataset.eaPhase32Applied === "true") return false;

    const operatorStrip = document.getElementById("overviewOperatorStrip") || overview.querySelector(".operator-strip");
    const listingsCard = document.getElementById("overviewListingsCard");
    const priorityGrid = document.getElementById("overviewPriorityGrid");
    const performanceGrid = document.getElementById("overviewPerformanceGrid");
    const accountGrid = document.getElementById("overviewAccountGrid");
    const upgradeCard = document.getElementById("overviewUpgradeCard");

    if (!operatorStrip || !listingsCard || !priorityGrid || !accountGrid || !upgradeCard) return false;

    let flow = document.getElementById("overviewFlow");
    if (!flow) {
      flow = document.createElement("div");
      flow.id = "overviewFlow";
      flow.className = "phase32-flow";
      operatorStrip.insertAdjacentElement("afterend", flow);
    }

    let execution = document.getElementById("overviewExecutionZone");
    if (!execution) {
      execution = document.createElement("div");
      execution.id = "overviewExecutionZone";
      execution.className = "phase32-zone phase32-execution-zone";
      flow.appendChild(execution);
    }

    let intelligence = document.getElementById("overviewIntelligenceZone");
    if (!intelligence) {
      intelligence = document.createElement("div");
      intelligence.id = "overviewIntelligenceZone";
      intelligence.className = "phase32-zone phase32-intelligence-zone";
      flow.appendChild(intelligence);
    }

    let context = document.getElementById("overviewContextZone");
    if (!context) {
      context = document.createElement("div");
      context.id = "overviewContextZone";
      context.className = "phase32-zone phase32-context-zone";
      flow.appendChild(context);
    }

    execution.appendChild(listingsCard);
    intelligence.appendChild(priorityGrid);
    if (performanceGrid) intelligence.appendChild(performanceGrid);
    context.appendChild(accountGrid);
    context.appendChild(upgradeCard);

    listingsCard.setAttribute("data-phase32-promoted", "true");
    priorityGrid.setAttribute("data-phase32-priority", "true");
    upgradeCard.setAttribute("data-phase32-downgraded", "true");
    overview.dataset.eaPhase32Applied = "true";
    return true;
  }

  function applyToolsHierarchyPass() {
    const section = document.getElementById("extension");
    if (!section || section.dataset.eaPhase32Tools === "true") return false;

    const cards = Array.from(section.querySelectorAll(":scope > .grid-2 > .card, :scope > .card"));
    if (!cards.length) return false;

    cards.forEach((card) => {
      const title = String(card.querySelector("h2")?.textContent || "").toLowerCase();
      if (title.includes("posting readiness")) card.setAttribute("data-tools-zone", "control");
      else if (title.includes("module state mix")) card.setAttribute("data-tools-zone", "system");
      else if (title.includes("operator tools")) card.setAttribute("data-tools-zone", "control");
      else if (title.includes("extension setup status")) card.setAttribute("data-tools-zone", "system");
      else if (title.includes("platform stack")) card.setAttribute("data-tools-zone", "modules");
      else if (title.includes("tool unlock path")) card.setAttribute("data-tools-zone", "premium");
    });

    section.dataset.eaPhase32Tools = "true";
    return true;
  }

  function scheduleReveal(delay = REVEAL_DELAY_MS) {
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => markReady("ready"), delay);
  }

  function runLayoutPass() {
    if (ready) return;
    const overviewDone = applyOverviewHierarchyPass();
    const toolsDone = applyToolsHierarchyPass();

    if (overviewDone || toolsDone) {
      scheduleReveal();
    }
  }

  function queueLayoutPass() {
    if (ready) return;
    cancelAnimationFrame(frameA);
    cancelAnimationFrame(frameB);
    frameA = requestAnimationFrame(() => {
      frameB = requestAnimationFrame(runLayoutPass);
    });
  }

  function prepare() {
    injectStyles();
    if (ready) return;
    setLayoutState("pending");
    queueLayoutPass();
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => markReady("timeout"), FALLBACK_REVEAL_MS);
  }

  function watch() {
    if (ready) return;
    prepare();
    clearObserver();

    observer = new MutationObserver(() => {
      clearTimeout(settleTimer);
      queueLayoutPass();
      settleTimer = setTimeout(() => {
        if (!ready) scheduleReveal(160);
      }, 180);
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  NS.phase2render = {
    prepare,
    watch,
    markReady,
    queueLayoutPass
  };

  NS.modules = NS.modules || {};
  NS.modules.phase2render = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", prepare, { once: true });
  } else {
    prepare();
  }
})();
