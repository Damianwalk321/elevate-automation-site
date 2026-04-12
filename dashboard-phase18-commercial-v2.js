(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase18commercialv2) return;

  function clean(v) { return String(v || "").replace(/\s+/g, " ").trim(); }
  function n(v) {
    const m = String(v || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  function getSummary() {
    return window.dashboardSummaryV2 || NS.summaryV2 || NS.state?.get?.("summary_v2", {}) || {};
  }

  function getEntities() {
    return window.dashboardEntitiesV1 || NS.entitiesV1 || NS.state?.get?.("entities_v1", {}) || {};
  }

  function getTeam() {
    return window.dashboardTeamCommandV2 || NS.teamCommandV2 || NS.state?.get?.("team_command_v2", {}) || {};
  }

  function buildCommercialV2() {
    const s = getSummary();
    const e = getEntities();
    const t = getTeam();

    const plan = clean(s.plan_name || e.account?.plan_name || "Starter");
    const cap = n(s.posting_cap || (/pro/i.test(plan) ? 25 : 5));
    const used = n(s.posts_used || 0);
    const remaining = n(s.posts_remaining || 0);
    const queued = n(s.queued_vehicles || 0);
    const usagePct = Math.min(100, Math.round((used / Math.max(cap, 1)) * 100));
    const active = n(s.active_listings || 0);
    const messages = n(s.total_messages || 0);
    const weak = n(s.weak_listings || 0);
    const needsAction = n(s.needs_action || 0);
    const teamMembers = n(e.team?.member_count || t.member_count || (Array.isArray(e.members) ? e.members.length : 1) || 1);

    const upgradePressure =
      remaining <= 1 || (queued > 0 && remaining <= 2) || usagePct >= 85 ? "high" :
      remaining <= 3 || usagePct >= 65 ? "moderate" : "low";

    const expansionReadiness =
      active >= 4 || teamMembers > 1 ? "dealer-ready" :
      active >= 2 ? "team-seeding" : "early";

    const referralPotential =
      messages >= 3 ? "high" :
      messages >= 1 || active >= 3 ? "medium" : "low";

    const prompts = [];
    if (upgradePressure === "high") {
      prompts.push({
        title: "Upgrade threshold is now credible",
        copy: `${plan} is approaching its practical operating ceiling based on current capacity pressure and usage.`
      });
    }
    if (expansionReadiness === "dealer-ready") {
      prompts.push({
        title: "Dealership expansion prompt should surface",
        copy: `The current visible state is strong enough to justify a larger dealership/team expansion conversation.`
      });
    }
    if (referralPotential === "high" || referralPotential === "medium") {
      prompts.push({
        title: "Referral / partner logic is becoming commercially relevant",
        copy: `Current activity supports teammate invite, referral, or partner prompting without it feeling forced.`
      });
    }
    if (weak > 0 || needsAction > 0) {
      prompts.push({
        title: "Protect revenue before scaling monetization pressure",
        copy: `${weak} weak and ${needsAction} need-action listings suggest cleanup should happen before pushing too hard on upgrades.`
      });
    }
    if (!prompts.length) {
      prompts.push({
        title: "Commercial state is stable",
        copy: "No urgent monetization lever is dominating the current visible state."
      });
    }

    return {
      version: "commercial-v2",
      captured_at: new Date().toISOString(),
      plan_name: plan,
      posting_cap: cap,
      posts_used: used,
      usage_pct: usagePct,
      upgrade_pressure: upgradePressure,
      expansion_readiness: expansionReadiness,
      referral_potential: referralPotential,
      team_member_count: teamMembers,
      prompts: prompts.slice(0, 4)
    };
  }

  function persist(summary) {
    NS.commercialV2 = summary;
    window.dashboardCommercialV2 = summary;
    if (NS.state?.set) {
      try { NS.state.set("commercial_v2", summary, { silent: true, skipPersist: false }); } catch {}
    }
    NS.events?.dispatchEvent?.(new CustomEvent("commercial:v2", { detail: summary }));
    window.dispatchEvent(new CustomEvent("elevate:commercial-v2", { detail: summary }));
  }

  function addSignal(summary) {
    const target = document.getElementById("phase9CommercialCard") || document.getElementById("phase17TeamCommandCard");
    if (!target) return;

    let signal = target.querySelector(".phase18-commercial-pill");
    if (!signal) {
      signal = document.createElement("div");
      signal.className = "phase18-commercial-pill";
      signal.style.cssText = [
        "display:inline-flex","align-items:center","min-height:24px","padding:0 9px","border-radius:999px",
        "font-size:10px","font-weight:700","letter-spacing:.03em",
        "border:1px solid rgba(212,175,55,0.18)","background:rgba(212,175,55,0.08)","color:#f3ddb0",
        "width:fit-content","margin-top:8px"
      ].join(";");
      const anchor = target.querySelector(".copy") || target.firstElementChild;
      if (anchor) anchor.insertAdjacentElement("afterend", signal);
      else target.insertAdjacentElement("afterbegin", signal);
    }

    signal.textContent = `Commercial V2 • ${summary.upgrade_pressure} upgrade • ${summary.expansion_readiness} expansion • ${summary.referral_potential} referral`;
  }

  function run() {
    const summary = buildCommercialV2();
    persist(summary);
    addSignal(summary);
  }

  function boot() {
    run(); setTimeout(run, 250); setTimeout(run, 900); setTimeout(run, 1800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  window.addEventListener("elevate:summary-v2", () => setTimeout(run, 120));
  window.addEventListener("elevate:entities-v1", () => setTimeout(run, 120));
  window.addEventListener("elevate:team-command-v2", () => setTimeout(run, 120));
  window.addEventListener("elevate:sync-refreshed", () => setTimeout(run, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(run, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase18commercialv2 = true;
})();