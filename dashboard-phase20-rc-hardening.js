(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase20rchardening) return;

  function clean(v) { return String(v || "").replace(/\s+/g, " ").trim(); }

  function collect() {
    return {
      version: "rc-hardening-v1",
      captured_at: new Date().toISOString(),
      overview_present: Boolean(document.getElementById("overview")),
      listings_present: Boolean(document.getElementById("overviewListingsCard")),
      manager_present: Boolean(document.getElementById("phase17TeamCommandCard") || document.getElementById("phase8ManagerCompact")),
      commercial_present: Boolean(document.getElementById("phase9CommercialCard")),
      moat_present: Boolean(document.getElementById("phase10MoatCard")),
      summary_present: Boolean(window.dashboardSummaryV2 || NS.summaryV2 || NS.state?.get?.("summary_v2")),
      entities_present: Boolean(window.dashboardEntitiesV1 || NS.entitiesV1 || NS.state?.get?.("entities_v1")),
      registry_present: Boolean(window.dashboardRegistryAuthorityV1 || NS.registryAuthorityV1 || NS.state?.get?.("registry_authority_v1")),
      attribution_present: Boolean(window.dashboardAttributionV2 || NS.attributionV2 || NS.state?.get?.("attribution_v2")),
      optimization_present: Boolean(window.dashboardOptimizationV2 || NS.optimizationV2 || NS.state?.get?.("optimization_v2")),
      team_command_present: Boolean(window.dashboardTeamCommandV2 || NS.teamCommandV2 || NS.state?.get?.("team_command_v2")),
      commercial_v2_present: Boolean(window.dashboardCommercialV2 || NS.commercialV2 || NS.state?.get?.("commercial_v2")),
      language_compression_present: Boolean(window.dashboardLanguageCompressionV1 || NS.languageCompressionV1 || NS.state?.get?.("language_compression_v1"))
    };
  }

  function persist(payload) {
    NS.rcHardeningV1 = payload;
    window.dashboardRcHardeningV1 = payload;
    if (NS.state?.set) {
      try { NS.state.set("rc_hardening_v1", payload, { silent: true, skipPersist: false }); } catch {}
    }
    NS.events?.dispatchEvent?.(new CustomEvent("rc-hardening:v1", { detail: payload }));
    window.dispatchEvent(new CustomEvent("elevate:rc-hardening-v1", { detail: payload }));
  }

  function addSignal(payload) {
    const target = document.getElementById("phase17TeamCommandCard") || document.getElementById("phase10MoatCard");
    if (!target) return;

    let signal = target.querySelector(".phase20-rc-pill");
    if (!signal) {
      signal = document.createElement("div");
      signal.className = "phase20-rc-pill";
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

    const checks = [
      payload.summary_present,
      payload.entities_present,
      payload.registry_present,
      payload.attribution_present,
      payload.optimization_present,
      payload.team_command_present,
      payload.commercial_v2_present
    ].filter(Boolean).length;

    signal.textContent = `RC Hardening V1 • ${checks}/7 core layers present • ${payload.overview_present && payload.listings_present ? "stable shell" : "review shell"}`;
  }

  function suppressEarlyNoise() {
    if (document.getElementById("ea-phase20-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase20-style";
    style.textContent = `
      #bundleIMasterQueue,
      #bundleIMemoryShell,
      #bundleIMemoryHero,
      #bundleITimeline {
        display:none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function run() {
    suppressEarlyNoise();
    const payload = collect();
    persist(payload);
    addSignal(payload);
  }

  function boot() {
    run(); setTimeout(run, 250); setTimeout(run, 900); setTimeout(run, 1800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  window.addEventListener("elevate:team-command-v2", () => setTimeout(run, 120));
  window.addEventListener("elevate:commercial-v2", () => setTimeout(run, 120));
  window.addEventListener("elevate:optimization-v2", () => setTimeout(run, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(run, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase20rchardening = true;
})();