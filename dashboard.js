(() => {
  if (window.__ELEVATE_DASHBOARD_PHASE4_LOADER__) {
    console.warn("[Elevate Dashboard] Phase 4 loader already initialized.");
    return;
  }
  window.__ELEVATE_DASHBOARD_PHASE4_LOADER__ = true;

  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  NS.version = "phase4-loader-v7";
  NS.modules = NS.modules || {};
  NS.events = NS.events || new EventTarget();

  const MODULES = [
    "/dashboard-state.js?v=20260406p12a",
    "/dashboard-ui.js?v=20260406p12a",
    "/dashboard-api.js?v=20260406p12a",
    "/dashboard-overview.js?v=20260406p12a",
    "/dashboard-listings.js?v=20260406p12a",
    "/dashboard-profile.js?v=20260406p12a",
    "/dashboard-tools.js?v=20260406p12a",
    "/dashboard-analytics.js?v=20260406p12a",
    "/dashboard-affiliate.js?v=20260406p12a",
    "/dashboard-billing.js?v=20260406p12a",
    "/dashboard-legacy.js?v=20260406p12a",
    "/dashboard-phase4-boot.js?v=20260406p12a",
    "/dashboard-bootstrap.js?v=20260406p12a"
  ];

  let compatBootTriggered = false;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function installLateDOMContentLoadedCompat() {
    if (window.__ELEVATE_LATE_DOMCONTENTLOADED_COMPAT__) return;
    window.__ELEVATE_LATE_DOMCONTENTLOADED_COMPAT__ = true;

    const originalAddEventListener = document.addEventListener.bind(document);

    document.addEventListener = function (type, listener, options) {
      if (
        type === "DOMContentLoaded" &&
        typeof listener === "function" &&
        document.readyState !== "loading"
      ) {
        try {
          queueMicrotask(() => {
            try {
              listener.call(document, new Event("DOMContentLoaded"));
            } catch (error) {
              console.error("[Elevate Dashboard] Late DOMContentLoaded listener failed:", error);
            }
          });
        } catch (error) {
          setTimeout(() => {
            try {
              listener.call(document, new Event("DOMContentLoaded"));
            } catch (innerError) {
              console.error("[Elevate Dashboard] Late DOMContentLoaded listener failed:", innerError);
            }
          }, 0);
        }

        if (options && typeof options === "object" && options.once) {
          return;
        }
      }

      return originalAddEventListener(type, listener, options);
    };
  }

  function userLooksHydrated() {
    const emailText = clean(document.querySelector(".user-email")?.textContent || "");
    return Boolean(
      window.currentUser?.id ||
      (emailText && !/loading/i.test(emailText))
    );
  }

  function kickLegacyBoot(reason) {
    if (compatBootTriggered) return;
    compatBootTriggered = true;
    console.warn("[Elevate Dashboard] Triggering compatibility boot:", reason);
    try {
      document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true, cancelable: true }));
    } catch (error) {
      console.error("[Elevate Dashboard] Compatibility boot failed:", error);
    }
  }

  function installControlledBootKick() {
    if (window.__ELEVATE_CONTROLLED_BOOT_KICK__) return;
    window.__ELEVATE_CONTROLLED_BOOT_KICK__ = true;

    const checks = [50, 300, 1000, 2500];
    checks.forEach((ms) => {
      setTimeout(() => {
        if (!userLooksHydrated()) {
          kickLegacyBoot(`post-module-check-${ms}ms`);
        }
      }, ms);
    });
  }

  function ensureSectionVisible(section) {
    if (!section) return;
    section.style.display = "block";
    section.classList.remove("dashboard-section-hidden", "phase3-hidden");
    section.hidden = false;
  }

  function revealOverviewNodes() {
    const overview = document.getElementById("overview");
    ensureSectionVisible(overview);

    document.querySelectorAll(".phase3-hidden").forEach((node) => {
      node.classList.remove("phase3-hidden");
      if (node.style && node.style.display === "none") node.style.display = "";
    });

    document.querySelectorAll(".phase3-overview-group, .phase3-overview-shell, .command-center-grid, .operator-strip, #recentListingsGrid, .card, .grid-2, .grid-4").forEach((node) => {
      if (!node) return;
      if (node.style && node.style.display === "none") node.style.display = "";
      node.hidden = false;
    });

    const mainTitle = document.getElementById("dashboardPageTitle");
    if (mainTitle && /founder beta dashboard/i.test(clean(mainTitle.textContent || ""))) {
      mainTitle.textContent = "Elevate Operator Console";
    }

    if (typeof window.showSection === "function") {
      try { window.showSection("overview"); } catch {}
    }

    const bootStatus = document.getElementById("bootStatus");
    if (bootStatus && /loading|booting|preparing/i.test(clean(bootStatus.textContent || ""))) {
      bootStatus.textContent = "Dashboard layout recovered.";
    }

    document.body.setAttribute("data-ea-layout-recovered", "true");
  }

  function pageLooksBlank() {
    const overview = document.getElementById("overview");
    const listingsGrid = document.getElementById("recentListingsGrid");
    const cards = overview ? overview.querySelectorAll(".card, .listing-card, .mini-stat, .command-primary").length : 0;
    const listingsChildren = listingsGrid ? listingsGrid.children.length : 0;
    const emailText = clean(document.querySelector(".user-email")?.textContent || "");
    return Boolean(
      emailText &&
      !/loading/i.test(emailText) &&
      overview &&
      cards > 0 &&
      listingsChildren >= 0 &&
      (overview.style.display === "none" || overview.classList.contains("phase3-hidden") || document.querySelector(".phase3-hidden"))
    );
  }

  function installLayoutRecovery() {
    if (window.__ELEVATE_LAYOUT_RECOVERY__) return;
    window.__ELEVATE_LAYOUT_RECOVERY__ = true;

    const run = () => {
      if (pageLooksBlank()) {
        console.warn("[Elevate Dashboard] Running layout recovery.");
        revealOverviewNodes();
      }
    };

    [1800, 3200, 5000, 7500].forEach((ms) => setTimeout(run, ms));

    const observer = new MutationObserver(() => {
      if (pageLooksBlank()) run();
    });

    const target = document.body || document.documentElement;
    if (target) {
      observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
      setTimeout(() => observer.disconnect(), 12000);
    }
  }

  function loadScriptSequentially(index = 0) {
    if (index >= MODULES.length) return Promise.resolve();

    const src = MODULES[index];
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((s) => s.src && s.src.includes(src.split("?")[0]));
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    }).then(() => loadScriptSequentially(index + 1));
  }

  installLateDOMContentLoadedCompat();

  loadScriptSequentially()
    .then(() => {
      installControlledBootKick();
      installLayoutRecovery();
    })
    .catch((error) => {
      console.error("[Elevate Dashboard] Phase 4 loader error:", error);
      const status = document.getElementById("bootStatus");
      if (status) {
        status.textContent = `Phase 4 loader failed: ${error.message || "Unknown error"}`;
      }
    });
})();
