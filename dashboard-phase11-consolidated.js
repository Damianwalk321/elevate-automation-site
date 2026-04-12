(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase11consolidated) return;

  function clean(v) { return String(v || "").replace(/\s+/g, " ").trim(); }
  function n(v) { const m = String(v || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : 0; }
  function text(id) { return clean(document.getElementById(id)?.textContent || ""); }
  function textFrom(root, selector) { return clean(root?.querySelector(selector)?.textContent || ""); }

  function injectStyle() {
    if (document.getElementById("ea-phase11-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase11-style";
    style.textContent = `
      #bundleIMasterQueue,#bundleIMemoryShell,#bundleIMemoryHero,#bundleITimeline,#phase3OverviewSegment,#phase4OverviewSegment,.phase3-toolbar,.phase4-toolbar,.phase3-segment,.phase4-segment,.phase3-section-tag,.phase4-tag,[data-role-switcher],.role-switcher,.mode-switcher,.overview-mode-toggle,.segment-toggle{display:none!important;}
      #overview .command-primary{padding:16px!important;}#overview .command-title-row h2,#overview .command-primary h2{font-size:22px!important;line-height:1.05!important;margin-bottom:6px!important;}#overview .command-primary p,#overview .command-primary .subtext{font-size:13px!important;line-height:1.35!important;}#overview .operator-strip,#overview .command-meta-grid,#phase11NextMove .signal-row{gap:8px!important;}#overview .mini-stat,#overview .command-meta-card,#overview .status-chip,#overview .stat-chip{min-height:0!important;padding:8px 10px!important;}#overview .mini-stat .stat-value,#overview .command-meta-value{font-size:16px!important;}
      #phase11NextMove{margin-top:8px;margin-bottom:10px;border:1px solid rgba(212,175,55,0.18);background:linear-gradient(180deg,rgba(212,175,55,0.08),rgba(255,255,255,0.01));border-radius:14px;padding:10px 12px;display:grid;gap:6px;}#phase11NextMove .label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gold-soft);}#phase11NextMove .head{display:flex;justify-content:space-between;align-items:start;gap:10px;}#phase11NextMove .title{font-size:17px;line-height:1.1;font-weight:800;}#phase11NextMove .copy{font-size:12px;line-height:1.35;color:var(--muted);}#phase11NextMove .signal-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}#phase11NextMove .signal{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:8px 10px;}#phase11NextMove .signal strong{display:block;font-size:15px;line-height:1;margin-bottom:4px;}#phase11NextMove .signal span{font-size:10px;color:var(--muted);}
      #overviewListingsCard{display:block!important;margin-top:10px!important;}#overview #recentListingsGrid{display:grid!important;gap:10px!important;}#overview .listing-card{display:grid!important;}#overview .listing-media{height:135px!important;}#overview .listing-content{padding:10px!important;gap:6px!important;}
      .phase11-card{display:block;margin-top:12px;border:1px solid rgba(212,175,55,0.14);border-radius:14px;background:linear-gradient(180deg,rgba(212,175,55,0.06),rgba(255,255,255,0.02));padding:12px;}.phase11-card .eyebrow{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gold-soft);}.phase11-card .title{font-size:18px;line-height:1.1;font-weight:800;margin-top:4px;}.phase11-card .copy{font-size:12px;line-height:1.4;color:var(--muted);max-width:760px;}.phase11-card .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px;}.phase11-card .stat{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:10px;}.phase11-card .stat strong{display:block;font-size:16px;line-height:1;margin-bottom:5px;}.phase11-card .stat span{font-size:11px;line-height:1.35;color:var(--muted);}.phase11-card .items{display:grid;gap:8px;margin-top:10px;}.phase11-card .item{border-radius:9px;padding:8px 9px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);}.phase11-card .item strong{display:block;font-size:12px;margin-bottom:3px;}.phase11-card .item span{font-size:11px;line-height:1.35;color:var(--muted);}
      @media (max-width:980px){#phase11NextMove .signal-row,.phase11-card .grid{grid-template-columns:1fr;}}
    `;
    document.head.appendChild(style);
  }

  function removeNoise() {
    const patterns = [/unified task queue/i,/workflow state should survive refresh/i,/recent workflow history/i,/persistent workflow actions/i,/operator timeline/i];
    const overview = document.getElementById("overview");
    if (!overview) return;
    overview.querySelectorAll(".card,.phase3-collapse,.phase4-collapse,section,div").forEach((node) => {
      const txt = clean(node.textContent || "");
      if (txt && patterns.some((rx) => rx.test(txt))) node.style.display = "none";
    });
  }

  function computeNextMove() {
    const s = {setupPct:n(text("commandSetupProgress")),remaining:n(text("kpiPostsRemaining")),queued:n(text("kpiQueuedVehicles")),weak:n(text("kpiWeakListings")),needsAction:n(text("kpiNeedsAction")),active:n(text("kpiActiveListings")),views:n(text("kpiViews")),messages:n(text("kpiMessages")),usedRaw:text("commandPostsUsed")};
    if (s.setupPct < 100) return {title:"Complete setup blockers first.",copy:"Your cleanest leverage is removing setup gaps so posting, sync, and compliance behave more predictably.",cta:"Complete Setup",section:"profile",signals:[{v:`${s.setupPct}%`,l:"Readiness"},{v:`${s.remaining}`,l:"Posts remaining"},{v:`${s.queued}`,l:"Queued now"}]};
    if (s.needsAction > 0 || s.weak > 0) return {title:"Clear intervention listings.",copy:"Fix the listings already losing leverage before adding more posting pressure.",cta:"Review Listings",focus:"listingSearchInput",signals:[{v:`${s.needsAction}`,l:"Need action"},{v:`${s.weak}`,l:"Weak listings"},{v:`${s.messages}`,l:"Messages tracked"}]};
    if (s.queued > 0 && s.remaining > 0) return {title:"Push queued inventory now.",copy:"You have ready units and clean posting capacity available right now.",cta:"Open Tools",section:"tools",signals:[{v:`${s.queued}`,l:"Ready queue"},{v:`${s.remaining}`,l:"Posts remaining"},{v:s.usedRaw||"0 / 0",l:"Used today"}]};
    return {title:"Monitor traction and keep the queue warm.",copy:"Nothing urgent is breaking right now. Stay on output, keep readiness clean, and watch what deserves the next push.",cta:"Open Analytics",section:"analytics",signals:[{v:`${s.active}`,l:"Active listings"},{v:`${s.views}`,l:"Views tracked"},{v:`${s.messages}`,l:"Messages tracked"}]};
  }

  function renderNextMove() {
    const actionList = document.getElementById("overviewActionList");
    if (!actionList) return;
    document.getElementById("phase11NextMove")?.remove();
    const move = computeNextMove();
    const wrap = document.createElement("div");
    wrap.id = "phase11NextMove";
    wrap.innerHTML = `<div class="label">Primary next move</div><div class="head"><div><div class="title">${move.title}</div><div class="copy">${move.copy}</div></div><button class="mini-btn" type="button">${move.cta}</button></div><div class="signal-row">${move.signals.map(item => `<div class="signal"><strong>${item.v}</strong><span>${item.l}</span></div>`).join("")}</div>`;
    actionList.insertAdjacentElement("beforebegin", wrap);
    wrap.querySelector("button")?.addEventListener("click", () => {
      if (move.section && typeof window.showSection === "function") window.showSection(move.section);
      if (move.focus) setTimeout(() => document.getElementById(move.focus)?.focus(), 200);
    });
  }

  function ensureListings() {
    const overview = document.getElementById("overview");
    const card = document.getElementById("overviewListingsCard");
    const grid = document.getElementById("recentListingsGrid");
    if (!overview || !card) return;
    card.hidden = false; card.style.display = "block";
    if (grid) { grid.hidden = false; grid.style.display = "grid"; }
    const anchor = document.getElementById("phase11NextMove") || document.getElementById("overviewPriorityGrid") || overview.querySelector(".operator-strip");
    if (anchor && anchor.nextElementSibling !== card) anchor.insertAdjacentElement("afterend", card);
    if (grid && !grid.querySelector(".listing-card")) {
      const top = Array.from(document.querySelectorAll("#topListings .top-list-item")).slice(0, 4);
      if (top.length) {
        grid.innerHTML = top.map((row, idx) => {
          const title = textFrom(row, ".top-title") || `Listing ${idx+1}`;
          const sub = textFrom(row, ".top-sub");
          const metrics = clean(row.querySelector(".top-metrics")?.textContent || "");
          const img = row.querySelector("img")?.getAttribute("src") || `https://placehold.co/800x500/111111/d4af37?text=${encodeURIComponent(title)}`;
          return `<article class="listing-card"><div class="listing-media"><img src="${img}" alt="${title}" loading="lazy" /><div class="listing-badge"><span class="badge active">Active</span></div></div><div class="listing-content"><div><div class="listing-title">${title}</div><div class="listing-sub">${sub || "Tracked listing"}</div></div><div class="listing-price">${sub || "$0"}</div><div class="status-line">Tracked • Inspect</div><div class="listing-metrics"><div class="metric-pill"><div class="metric-pill-label">Views</div><div class="metric-pill-value">${n((metrics.match(/👁\s*([\d,]+)/)||[])[1]||0)}</div></div><div class="metric-pill"><div class="metric-pill-label">Messages</div><div class="metric-pill-value">${n((metrics.match(/💬\s*([\d,]+)/)||[])[1]||0)}</div></div><div class="metric-pill"><div class="metric-pill-label">Source</div><div class="metric-pill-value">Tracked</div></div></div><div class="listing-actions"><button class="action-btn" type="button">Inspect</button></div></div></article>`;
        }).join("");
      } else {
        grid.innerHTML = `<div class="listing-empty">No listings loaded yet. As posts get registered, vehicle cards will appear here.</div>`;
      }
    }
  }

  function renderCompactCard(id, eyebrow, title, copy, stats, items, anchorId) {
    document.getElementById(id)?.remove();
    const anchor = document.getElementById(anchorId);
    if (!anchor) return;
    const card = document.createElement("section");
    card.id = id; card.className = "phase11-card";
    card.innerHTML = `<div class="eyebrow">${eyebrow}</div><div class="title">${title}</div><div class="copy">${copy}</div><div class="grid">${stats.map(s => `<div class="stat"><strong>${s.v}</strong><span>${s.l}</span></div>`).join("")}</div><div class="items">${items.map(i => `<div class="item"><strong>${i.t}</strong><span>${i.c}</span></div>`).join("")}</div>`;
    anchor.insertAdjacentElement("afterend", card);
  }

  function renderBusinessLayers() {
    const s = {active:n(text("kpiActiveListings")),views:n(text("kpiViews")),messages:n(text("kpiMessages")),weak:n(text("kpiWeakListings")),needsAction:n(text("kpiNeedsAction")),queued:n(text("kpiQueuedVehicles")),remaining:n(text("kpiPostsRemaining")),setupPct:n(text("commandSetupProgress")),plan:clean(text("billingPlanName") || text("currentPlanName") || "Starter"),used:n(text("commandPostsUsed"))};
    const teamActive = Math.max(1, Math.min(6, Math.ceil((s.active || 1) / 2)));
    const healthScore = Math.max(44, Math.min(93, 100 - (s.weak * 4 + s.needsAction * 5 + (s.setupPct < 100 ? 8 : 0))));
    const readinessRisk = s.setupPct < 100 ? "Open" : "Clear";
    const outputPressure = s.remaining <= 1 ? "High" : s.remaining <= 3 ? "Moderate" : "Controlled";
    renderCompactCard("phase11DealershipCard","Dealership Summary","Manager Oversight","Compact dealership-level visibility built on current operator data.",[{v:teamActive,l:"Active team contributors inferred"},{v:healthScore,l:"Dealership health score"},{v:readinessRisk,l:"Readiness risk"},{v:outputPressure,l:"Output pressure"}],[{t:"Manager priority",c:s.setupPct < 100 ? `Setup is ${s.setupPct}% complete. Close readiness blockers before scaling output.` : "No major readiness blocker is dominating right now."},{t:"Intervention inventory",c:`${s.needsAction} need action and ${s.weak} weak listings are reducing output quality.`}],"overviewListingsCard");
    const cap = /pro/i.test(s.plan) ? 25 : 5;
    const usagePct = Math.min(100, Math.round((s.used / Math.max(cap,1)) * 100));
    const upgradePressure = s.remaining <= 1 || usagePct >= 80 ? "High" : s.remaining <= 3 || usagePct >= 60 ? "Moderate" : "Low";
    const partnerPotential = s.messages >= 3 || s.active >= 4 ? "Good" : s.active >= 2 ? "Building" : "Early";
    renderCompactCard("phase11CommercialCard","Commercial Growth Layer","Plan, Upgrade & Expansion Signals","Commercial signals built from current operator and dealership activity.",[{v:s.plan,l:"Current plan"},{v:`${usagePct}%`,l:"Usage percentage"},{v:upgradePressure,l:"Upgrade pressure"},{v:partnerPotential,l:"Partner / referral potential"}],[{t:"Upgrade pressure",c:upgradePressure === "High" ? "Current plan is approaching usable output limits." : "No urgent upgrade trigger is dominating right now."},{t:"Expansion snapshot",c:s.active >= 4 ? "Inventory volume is strong enough to justify a dealership/team conversation." : "Expansion can stay visible but secondary."}],"phase11DealershipCard");
    const moatStrength = s.active >= 3 && (s.views > 0 || s.messages > 0) ? "Building" : s.active >= 1 ? "Early" : "Foundational";
    renderCompactCard("phase11MoatCard","Strategic Moat Layer","Optimization Intelligence & Benchmark Signals","Visible intelligence that makes the platform feel smarter than generic posting tools.",[{v:moatStrength,l:"Current moat strength"},{v:s.active,l:"Listings supporting optimization"},{v:s.weak,l:"Weak listings for intervention"},{v:s.messages,l:"Tracked message context"}],[{t:"Optimization suggestion",c:s.weak > 0 ? `${s.weak} weak listing${s.weak === 1 ? "" : "s"} should be prioritized for title, price, or media improvement.` : "No dominant optimization gap is overwhelming the current view."},{t:"Why it matters",c:`${s.views} views and ${s.messages} messages currently tracked means recommendations are anchored to live activity, not only static listing data.`}],"phase11CommercialCard");
  }

  function run() {
    injectStyle();
    removeNoise();
    renderNextMove();
    ensureListings();
    renderBusinessLayers();
  }

  function boot() { run(); setTimeout(run, 250); setTimeout(run, 900); setTimeout(run, 1800); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
  window.addEventListener("elevate:sync-refreshed", () => setTimeout(run, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(run, 120));
  NS.modules = NS.modules || {}; NS.modules.phase11consolidated = true;
})();
