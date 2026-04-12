(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase2render) return;

  let observer = null;
  let settleTimer = null;
  let fallbackTimer = null;
  let ready = false;

  const STYLE_ID = "ea-phase2-render-style";
  const FALLBACK_REVEAL_MS = 2600;

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
    try { document.body?.setAttribute("data-ea-layout", state); } catch {}
  }

  function clearObserver() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  }

  function markReady(reason = "ready") {
    injectStyles();
    ready = true;
    clearTimeout(settleTimer);
    clearTimeout(fallbackTimer);
    clearObserver();
    setLayoutState(reason === "error" ? "error" : "ready");
  }

  function hasMinimumShell() {
    const mainInner = document.querySelector(".main-inner");
    const overview = document.getElementById("overview");
    const sidebar = document.querySelector(".sidebar");
    return Boolean(mainInner && overview && sidebar);
  }

  function hasMeaningfulContent() {
    const welcomeText = String(document.getElementById("welcomeText")?.textContent || "");
    const userEmail = String(document.querySelector(".user-email")?.textContent || "");
    const listingsGrid = document.getElementById("recentListingsGrid");
    const activeSectionVisible = Array.from(document.querySelectorAll(".dashboard-section"))
      .some((section) => section.style.display === "block");
    const hasCards = Boolean(listingsGrid?.querySelector(".listing-card, .listing-empty"));
    const loadingCopy = /loading/i.test(welcomeText) || /loading/i.test(userEmail);
    return (activeSectionVisible || hasCards || !loadingCopy) && hasMinimumShell();
  }

  function queueReadyCheck() {
    if (ready) return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (hasMeaningfulContent()) {
        markReady("ready");
      }
    }, 180);
  }

  function prepare() {
    injectStyles();
    if (ready) return;
    setLayoutState("pending");
    queueReadyCheck();
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => markReady("timeout"), FALLBACK_REVEAL_MS);
  }

  function watch() {
    if (ready) return;
    prepare();
    clearObserver();
    observer = new MutationObserver(() => {
      queueReadyCheck();
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "data-dashboard-ready", "data-ea-loader"]
      });
    }
  }

  NS.phase2render = {
    prepare,
    watch,
    markReady,
    queueReadyCheck
  };

  NS.modules = NS.modules || {};
  NS.modules.phase2render = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", prepare, { once: true });
  } else {
    prepare();
  }
})();