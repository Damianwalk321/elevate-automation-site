(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase41cleanup) return;

  const CSS = `
    #bundleIMemoryShell,
    .phase4-toolbar,
    .phase3-toolbar {
      display: none !important;
    }

    .phase4-hidden,
    .phase3-hidden {
      display: initial !important;
    }

    #overview .phase4-overview-group,
    #overview .phase3-overview-group,
    #overview .phase4-group {
      display: grid !important;
      gap: 16px;
    }

    #overview .phase4-collapse,
    #overview .phase3-collapse {
      margin-top: 0;
    }

    #overview .phase4-collapse:not(.open) .phase4-collapse-body,
    #overview .phase3-collapse:not(.open) .phase3-collapse-body {
      display: none !important;
    }
  `;

  function injectStyles() {
    if (document.getElementById("ea-phase41-cleanup-styles")) return;
    const style = document.createElement("style");
    style.id = "ea-phase41-cleanup-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function removeWorkflowMemory() {
    document.querySelectorAll("#bundleIMemoryShell").forEach((el) => el.remove());
  }

  function removeOverviewToolbars() {
    document.querySelectorAll(".phase4-toolbar, .phase3-toolbar").forEach((el) => el.remove());
  }

  function normalizeOverviewVisibility() {
    const overview = document.getElementById("overview");
    if (!overview) return;

    overview.querySelectorAll(".phase4-hidden, .phase3-hidden").forEach((el) => {
      el.classList.remove("phase4-hidden", "phase3-hidden");
      el.style.display = "";
    });

    overview.querySelectorAll(".phase4-overview-group, .phase3-overview-group, .phase4-group").forEach((el) => {
      el.style.display = "grid";
    });

    overview.querySelectorAll(".phase4-collapse, .phase3-collapse").forEach((el) => {
      el.classList.remove("open");
      const sub = el.querySelector(".subtext");
      if (sub) sub.textContent = "Expand";
    });
  }

  function cleanOverview() {
    injectStyles();
    removeWorkflowMemory();
    removeOverviewToolbars();
    normalizeOverviewVisibility();
  }

  function boot() {
    cleanOverview();
    setTimeout(cleanOverview, 800);
    setTimeout(cleanOverview, 2200);
  }

  window.addEventListener("elevate:workflow-updated", cleanOverview);
  window.addEventListener("load", cleanOverview);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  NS.phase41cleanup = { cleanOverview };
  NS.modules = NS.modules || {};
  NS.modules.phase41cleanup = true;
})();
