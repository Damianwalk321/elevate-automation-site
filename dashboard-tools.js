
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.tools) return;

  const STYLE_ID = "elevate-bundle-f-os-styles";

  function ui() { return NS.ui || {}; }
  function qsa(selector, root = document) {
    return ui().qsa ? ui().qsa(selector, root) : Array.from(root.querySelectorAll(selector));
  }
  function qs(selector, root = document) {
    return ui().qs ? ui().qs(selector, root) : root.querySelector(selector);
  }
  function clean(value) {
    return (ui().clean ? ui().clean(value) : String(value || "").replace(/\s+/g, " ").trim());
  }
  function text(id) {
    return clean(document.getElementById(id)?.textContent || "");
  }
  function num(id) {
    const m = text(id).match(/-?\d[\d,]*/);
    return m ? Number(m[0].replace(/,/g, "")) : 0;
  }
  function hasGoodState(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    const t = clean(el.textContent).toLowerCase();
    return el.classList.contains("good") || /ready|saved|active|configured|connected|complete|live|can publish/.test(t);
  }
  function hasBlockedState(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    const t = clean(el.textContent).toLowerCase();
    return el.classList.contains("bad") || /blocked|inactive|missing|pending|not ready|cannot publish/.test(t);
  }
  function currency(value) {
    const n = Number(value || 0);
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  function showSection(name) {
    try {
      if (typeof window.showSection === "function") window.showSection(name);
    } catch {}
  }
  function focusField(id) {
    const el = document.getElementById(id);
    if (!el) return;
    try { showSection("profile"); } catch {}
    setTimeout(() => {
      try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
      try { el.focus(); } catch {}
    }, 220);
  }
  function openInventory() {
    const url = document.getElementById("inventory_url")?.value || text("extensionInventoryUrl");
    if (url && /^https?:/i.test(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      focusField("inventory_url");
    }
  }
  function openMarketplace() {
    const btn = document.getElementById("openMarketplaceBtn");
    if (btn) btn.click();
    else window.open("https://www.facebook.com/marketplace/create/vehicle", "_blank", "noopener,noreferrer");
  }
  function refreshAccess() {
    const btn = document.getElementById("refreshAccessBtn") || document.getElementById("refreshExtensionStateBtn");
    if (btn) btn.click();
  }

  function injectStyles() {
    const css = `
      .ea-os-rail{
        display:grid; gap:14px; margin:0 0 18px;
      }
      .ea-os-rail-card{
        border:1px solid rgba(212,175,55,0.18);
        border-radius:18px;
        background:
          radial-gradient(circle at top right, rgba(212,175,55,0.10), transparent 26%),
          linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.008)),
          #121212;
        box-shadow: 0 10px 30px rgba(0,0,0,0.24);
        padding:18px;
      }
      .ea-os-rail-head{
        display:flex; justify-content:space-between; gap:14px; align-items:flex-start; flex-wrap:wrap;
        margin-bottom:14px;
      }
      .ea-os-rail-kpis{
        display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:10px;
      }
      .ea-os-kpi{
        border:1px solid rgba(255,255,255,0.06); border-radius:14px; background:#171717; padding:12px;
      }
      .ea-os-kpi .mini{font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#d4af37; font-weight:700; margin-bottom:6px;}
      .ea-os-kpi strong{font-size:20px; line-height:1.05;}
      .ea-os-primary-row{
        display:flex; justify-content:space-between; gap:14px; align-items:center; flex-wrap:wrap;
        border:1px solid rgba(212,175,55,0.16); background:#151515; border-radius:16px; padding:16px; margin-bottom:14px;
      }
      .ea-os-primary-copy .eyebrow{font-size:11px; letter-spacing:.10em; text-transform:uppercase; color:#d4af37; font-weight:700; margin-bottom:6px;}
      .ea-os-primary-copy .title{font-size:26px; font-weight:700; line-height:1.08; margin-bottom:6px;}
      .ea-os-primary-copy .sub{font-size:13px; color:#b8b8b8; line-height:1.5; max-width:720px;}
      .ea-os-actions{display:flex; gap:10px; flex-wrap:wrap;}
      .ea-os-pills{display:flex; gap:8px; flex-wrap:wrap;}
      .ea-os-pill{
        display:inline-flex; align-items:center; min-height:30px; padding:0 10px; border-radius:999px;
        font-size:11px; font-weight:700; letter-spacing:.05em; border:1px solid rgba(255,255,255,0.08); background:#171717; color:#f3f3f3;
      }
      .ea-os-pill.good{color:#9de8a8; border-color:rgba(157,232,168,0.22); background:rgba(46,125,50,0.15);}
      .ea-os-pill.warn{color:#f3ddb0; border-color:rgba(212,175,55,0.22); background:rgba(212,175,55,0.10);}
      .ea-os-pill.bad{color:#ffb4b4; border-color:rgba(255,180,180,0.20); background:rgba(120,20,20,0.18);}
      .ea-os-action-list{display:grid; gap:10px;}
      .ea-os-action-item{
        display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;
        border:1px solid rgba(255,255,255,0.05); background:#151515; border-radius:14px; padding:14px 16px;
      }
      .ea-os-action-item .meta{font-size:11px; color:#b8b8b8; text-transform:uppercase; letter-spacing:.08em; margin-bottom:6px;}
      .ea-os-action-item .title{font-weight:700; margin-bottom:4px;}
      .ea-os-action-item .copy{font-size:13px; color:#b8b8b8; line-height:1.5; max-width:760px;}
      .ea-os-action-item .right{display:grid; gap:8px; justify-items:end;}
      .ea-os-section-card{margin-bottom:18px;}
      .ea-os-grid-2{display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:16px;}
      .ea-os-note{font-size:13px; line-height:1.5; color:#cfcfcf;}
      @media (max-width: 1080px){
        .ea-os-rail-kpis, .ea-os-grid-2{grid-template-columns:1fr 1fr;}
      }
      @media (max-width: 760px){
        .ea-os-rail-kpis, .ea-os-grid-2{grid-template-columns:1fr;}
        .ea-os-primary-copy .title{font-size:22px;}
      }
    `;
    if (ui().injectStyleOnce) ui().injectStyleOnce(STYLE_ID, css);
    else if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = css;
      document.head.appendChild(style);
    }
  }

  function buildState() {
    const setupChecks = [
      { id: "setupDealerWebsite", label: "Dealer Website", field: "dealer_website" },
      { id: "setupInventoryUrl", label: "Inventory URL", field: "inventory_url" },
      { id: "setupScannerType", label: "Scanner Type", field: "scanner_type" },
      { id: "setupListingLocation", label: "Listing Location", field: "listing_location" },
      { id: "setupComplianceMode", label: "Compliance Mode", field: "compliance_mode" },
      { id: "setupAccess", label: "Access", field: null }
    ];
    const missingSetup = setupChecks.filter((item) => !hasGoodState(item.id));
    const postsRemaining = num("kpiPostsRemaining") || num("extensionRemainingPosts");
    const queueCount = num("kpiQueuedVehicles") || num("commandReadyQueue");
    const reviewQueue = num("kpiReviewQueue") || num("extensionReviewQueue");
    const needsAction = num("kpiNeedsAction");
    const weakListings = num("kpiWeakListings");
    const activeListings = num("kpiActiveListings");
    const credits = num("kpiCreditsBalance") || num("analyticsCreditsBalance") || num("commandCreditsBalance");
    const referralsPaying = num("affiliatePayingCount") || num("affiliateActiveReferrals");
    const referralInvited = num("affiliateInvitedCount");
    const accessActive = hasGoodState("setupAccess") || hasGoodState("extSetupAccess") || /active/i.test(text("overviewAccessChip")) || /active/i.test(text("extensionAccessState"));
    const complianceReady = hasGoodState("setupComplianceMode") && !!clean(document.getElementById("license_number")?.value || text("complianceLicenseDisplay"));
    const inventoryReady = hasGoodState("setupInventoryUrl");
    const scannerReady = hasGoodState("setupScannerType");
    const setupReady = missingSetup.length === 0;
    const canPost = accessActive && setupReady && complianceReady && inventoryReady && scannerReady;
    let primaryAction = { label: "Complete Setup", kind: "profile", reason: "Required setup fields are still missing before the platform can run cleanly." };
    if (!setupReady) {
      const first = missingSetup[0];
      primaryAction = {
        label: `Fix ${first.label}`,
        kind: "focus",
        field: first.field,
        reason: `The next highest-leverage move is to complete ${first.label.toLowerCase()}.`
      };
    } else if (!accessActive) {
      primaryAction = { label: "Refresh Access", kind: "refresh", reason: "Posting cannot move until account access is active." };
    } else if (!complianceReady) {
      primaryAction = { label: "Fix Compliance", kind: "focus", field: "license_number", reason: "Compliance still blocks clean publishing." };
    } else if (queueCount <= 0) {
      primaryAction = { label: "Open Inventory", kind: "inventory", reason: "Setup is ready. Queue the next vehicle to move into posting." };
    } else if (postsRemaining > 0) {
      primaryAction = { label: "Open Marketplace", kind: "marketplace", reason: "You have queue ready and capacity available. Push the next live post now." };
    } else {
      primaryAction = { label: "Review Revenue Queue", kind: "analytics", reason: "Posting capacity is used. Clear the next revenue or cleanup move." };
    }

    const actions = [];
    const push = (priority, bucket, title, copy, button, perform) => actions.push({ priority, bucket, title, copy, button, perform });
    if (!setupReady) {
      missingSetup.slice(0, 3).forEach((item, i) => {
        push(10 + i, "Do Now", `Complete ${item.label}`, `${item.label} is blocking cleaner system execution. Fix it before pushing deeper workflow.`, "Fix Now", () => item.field ? focusField(item.field) : showSection("profile"));
      });
    }
    if (setupReady && !accessActive) push(20, "Do Now", "Refresh account access", "Posting and extension state still look inactive. Refresh access before trying to post.", "Refresh Access", refreshAccess);
    if (setupReady && accessActive && !complianceReady) push(30, "Do Now", "Resolve compliance blocker", "Compliance configuration is not fully ready for publish. Fix the missing field before posting.", "Fix Compliance", () => focusField("license_number"));
    if (setupReady && accessActive && complianceReady && queueCount <= 0) push(40, "Do Today", "Queue the next vehicle", "Setup and access are ready. The next workflow move is getting a vehicle into queue.", "Open Inventory", openInventory);
    if (setupReady && accessActive && complianceReady && queueCount > 0 && postsRemaining > 0) push(50, "Revenue Move", "Push the next live post", `You still have ${postsRemaining} posting slots available. Use them while queue is ready.`, "Open Marketplace", openMarketplace);
    if (reviewQueue > 0) push(60, "Cleanup", "Review queue items", `${reviewQueue} listing${reviewQueue === 1 ? "" : "s"} need validation or operator review.`, "Open Analytics", () => showSection("tools"));
    if (needsAction > 0 || weakListings > 0) push(70, "Revenue Move", "Tighten weak listing output", `${Math.max(needsAction, weakListings)} listing${Math.max(needsAction, weakListings) === 1 ? "" : "s"} need intervention, stronger copy, or pricing attention.`, "Review Listings", () => showSection("overview"));
    if (referralInvited > 0 && referralsPaying === 0) push(80, "Growth Move", "Convert referral signups into payers", "The partner funnel has top-of-funnel activity but low paying conversion. Follow up with your signups.", "Open Partners", () => showSection("affiliate"));
    if (referralsPaying > 0) push(90, "Growth Move", "Recruit another paying referral", `You already have ${referralsPaying} paying referral${referralsPaying === 1 ? "" : "s"}. Push the next manager or rep partner for recurring growth.`, "Open Partners", () => showSection("affiliate"));
    if (!actions.length) push(999, "Watch", "System is in a stable operating state", "No immediate blockers detected. Stay inside posting, analytics, and partner growth rhythm.", "Open Overview", () => showSection("overview"));

    actions.sort((a, b) => a.priority - b.priority);
    return {
      setupReady, accessActive, complianceReady, inventoryReady, scannerReady, canPost,
      postsRemaining, queueCount, reviewQueue, needsAction, weakListings, activeListings, credits, referralsPaying,
      primaryAction, actions
    };
  }

  function performAction(kindObj) {
    if (typeof kindObj === "function") return kindObj();
    const action = kindObj?.kind || kindObj;
    if (action === "profile") return showSection("profile");
    if (action === "refresh") return refreshAccess();
    if (action === "inventory") return openInventory();
    if (action === "marketplace") return openMarketplace();
    if (action === "analytics") return showSection("tools");
    if (action === "affiliate") return showSection("affiliate");
    if (action === "focus") return focusField(kindObj.field);
  }

  function railPill(label, ok, warnText, badText) {
    const cls = ok === true ? "good" : ok === "warn" ? "warn" : "bad";
    const value = ok === true ? "Ready" : ok === "warn" ? (warnText || "Watch") : (badText || "Blocked");
    return `<div class="ea-os-pill ${cls}">${label}: ${value}</div>`;
  }

  function renderRail(state) {
    injectStyles();
    let rail = document.getElementById("eaCommandRail");
    if (!rail) {
      rail = document.createElement("div");
      rail.id = "eaCommandRail";
      rail.className = "ea-os-rail";
      const anchor = document.querySelector(".main-header");
      if (anchor) anchor.insertAdjacentElement("afterend", rail);
    }
    rail.innerHTML = `
      <div class="ea-os-rail-card">
        <div class="ea-os-rail-head">
          <div>
            <div class="module-group-label">Revenue OS</div>
            <h2 style="margin-top:6px; margin-bottom:8px;">Run one operating queue across the whole platform.</h2>
            <div class="subtext">Activation, posting, compliance, listings, and partner growth now roll up into one next-best-move rail.</div>
          </div>
          <div class="ea-os-pills">
            ${railPill("Setup", state.setupReady, "Almost", "Missing")}
            ${railPill("Access", state.accessActive, "Watch", "Inactive")}
            ${railPill("Compliance", state.complianceReady, "Watch", "Blocked")}
            ${railPill("Posting", state.canPost && state.queueCount > 0 && state.postsRemaining > 0, state.canPost ? "Queue Next" : "Watch", "Not Ready")}
          </div>
        </div>

        <div class="ea-os-primary-row">
          <div class="ea-os-primary-copy">
            <div class="eyebrow">Primary Move</div>
            <div class="title">${state.primaryAction.label}</div>
            <div class="sub">${state.primaryAction.reason}</div>
          </div>
          <div class="ea-os-actions">
            <button id="eaRailPrimaryBtn" class="btn-primary" type="button">${state.primaryAction.label}</button>
            <button id="eaRailOverviewBtn" class="action-btn" type="button">Open Overview</button>
            <button id="eaRailActionsBtn" class="action-btn" type="button">View Action Queue</button>
          </div>
        </div>

        <div class="ea-os-rail-kpis">
          <div class="ea-os-kpi"><div class="mini">Posts Remaining</div><strong>${state.postsRemaining}</strong></div>
          <div class="ea-os-kpi"><div class="mini">Queue Ready</div><strong>${state.queueCount}</strong></div>
          <div class="ea-os-kpi"><div class="mini">Needs Review</div><strong>${state.reviewQueue + state.needsAction}</strong></div>
          <div class="ea-os-kpi"><div class="mini">Paying Referrals</div><strong>${state.referralsPaying}</strong></div>
        </div>
      </div>
    `;
    document.getElementById("eaRailPrimaryBtn")?.addEventListener("click", () => performAction(state.primaryAction));
    document.getElementById("eaRailOverviewBtn")?.addEventListener("click", () => showSection("overview"));
    document.getElementById("eaRailActionsBtn")?.addEventListener("click", () => {
      showSection("overview");
      document.getElementById("eaMasterActionCenter")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function renderMasterActionCenter(state) {
    const overview = document.getElementById("overview");
    if (!overview) return;
    let wrap = document.getElementById("eaMasterActionCenter");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "eaMasterActionCenter";
      wrap.className = "card ea-os-section-card";
      const anchor = document.getElementById("overviewOperatorStrip") || overview.firstElementChild;
      if (anchor) anchor.insertAdjacentElement("afterend", wrap);
    }
    wrap.innerHTML = `
      <div class="section-head">
        <div>
          <div class="module-group-label">Unified Action Center</div>
          <h2 style="margin-top:6px;">One ranked queue for what matters now.</h2>
          <div class="subtext">This merges setup friction, posting readiness, listing revenue moves, and partner growth into one operator feed.</div>
        </div>
      </div>
      <div class="ea-os-grid-2" style="margin-bottom:14px;">
        <div class="ea-os-note"><strong style="color:#f3ddb0;">Top move:</strong> ${state.primaryAction.label}. ${state.primaryAction.reason}</div>
        <div class="ea-os-note"><strong style="color:#f3ddb0;">Operating mode:</strong> ${state.postsRemaining > 0 && state.queueCount > 0 ? "Post now" : state.reviewQueue > 0 || state.needsAction > 0 ? "Clean revenue queue" : !state.setupReady ? "Finish setup" : "Stabilize and grow"}.</div>
      </div>
      <div class="ea-os-action-list">
        ${state.actions.slice(0, 6).map((item, index) => `
          <div class="ea-os-action-item">
            <div>
              <div class="meta">${item.bucket} · Priority ${index + 1}</div>
              <div class="title">${item.title}</div>
              <div class="copy">${item.copy}</div>
            </div>
            <div class="right">
              <div class="ea-os-pill ${item.bucket === "Revenue Move" || item.bucket === "Growth Move" ? "good" : item.bucket === "Watch" ? "warn" : "bad"}">${item.bucket}</div>
              <button class="action-btn ea-os-action-trigger" type="button" data-action-index="${index}">${item.button}</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
    qsa(".ea-os-action-trigger", wrap).forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = state.actions[Number(btn.dataset.actionIndex)];
        if (item?.perform) item.perform();
      });
    });
  }

  function renderBillingNudge(state) {
    const billing = document.getElementById("billing");
    if (!billing) return;
    let card = document.getElementById("eaBillingNudge");
    if (!card) {
      card = document.createElement("div");
      card.id = "eaBillingNudge";
      card.className = "card ea-os-section-card";
      billing.appendChild(card);
    }
    const plan = text("planNameBilling") || text("overviewPlanChip") || "Current Plan";
    const trigger = state.postsRemaining <= 0 && state.queueCount > 0
      ? "You are hitting daily posting limits with queue still ready."
      : state.reviewQueue + state.needsAction > 3
      ? "Operator demand is growing and review pressure is rising."
      : "Keep plan decisions tied to real operator usage, not guesswork.";
    card.innerHTML = `
      <div class="section-head">
        <div>
          <div class="module-group-label">Workflow Conversion</div>
          <h2 style="margin-top:6px;">Upgrade should follow actual friction.</h2>
          <div class="subtext">Current plan: ${plan}. ${trigger}</div>
        </div>
      </div>
      <div class="ea-os-grid-2">
        <div class="ea-os-note"><strong style="color:#f3ddb0;">What unlocks next:</strong> more operating capacity, stronger follow-up systems, and deeper growth modules.</div>
        <div class="ea-os-note"><strong style="color:#f3ddb0;">When to act:</strong> upgrade when queue is consistently full, limits are binding, or the revenue queue is larger than manual bandwidth.</div>
      </div>
    `;
  }

  function bindJumpLinks() {
    qsa("[data-open-section]").forEach((btn) => {
      if (btn.dataset.eaJumpBound === "true") return;
      btn.dataset.eaJumpBound = "true";
      btn.addEventListener("click", () => {
        const section = btn.getAttribute("data-open-section");
        const field = btn.getAttribute("data-focus-field");
        if (section) showSection(section);
        if (field) focusField(field);
      });
    });
  }

  function render() {
    const state = buildState();
    renderRail(state);
    renderMasterActionCenter(state);
    renderBillingNudge(state);
    bindJumpLinks();
  }

  function boot() {
    render();
    setTimeout(render, 900);
    setTimeout(render, 2200);
    setInterval(render, 5000);
    NS.events?.addEventListener?.("state:set", render);
  }

  NS.tools = { mount() { render(); return true; }, render };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  NS.modules = NS.modules || {};
  NS.modules.tools = true;
})();
