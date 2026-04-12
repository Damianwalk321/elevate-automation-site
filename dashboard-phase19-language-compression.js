(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase19languagecompression) return;

  function clean(v) { return String(v || "").replace(/\s+/g, " ").trim(); }

  function replaceText(selector, replacer) {
    document.querySelectorAll(selector).forEach((node) => {
      const txt = clean(node.textContent || "");
      if (!txt) return;
      const next = replacer(txt);
      if (next && next !== txt) node.textContent = next;
    });
  }

  function compressCopy() {
    replaceText("#listingDataStatus", (txt) =>
      txt
        .replace(/Listing intelligence, attribution, registry authority, transition reasoning, and optimization ranking are live on overview cards\./i, "Overview listing intelligence is live.")
        .replace(/Listing intelligence, attribution, registry authority, and transition reasoning are live on overview cards\./i, "Overview listing intelligence is live.")
        .replace(/Listing intelligence, attribution, and the summary contract are live on overview cards\./i, "Overview listing intelligence is live.")
    );

    replaceText("#listingGridStatus", (txt) =>
      txt
        .replace(/overview cards are still thin, but/i, "Overview is still light, but")
        .replace(/currently tracked/i, "tracked")
    );

    replaceText("#phase17TeamCommandCard .copy", (txt) =>
      txt.replace(/This command layer turns the new entity model into manager-facing execution visibility: rep output, readiness posture, dealer intervention queue, and next actions\./i,
                  "Manager view for rep output, readiness, dealer intervention, and next actions.")
    );

    replaceText("#phase9CommercialCard .copy", (txt) =>
      txt.replace(/This commercial layer turns current operator and dealership activity into monetization signals so upgrade pressure, partner value, and dealership expansion prompts feel native to the dashboard\./i,
                  "Commercial signals for upgrades, referrals, and expansion.")
    );

    replaceText("#phase10MoatCard .copy", (txt) =>
      txt.replace(/This moat layer turns live listing state into pricing, title, media, and benchmark-style guidance so the platform feels meaningfully smarter than a generic posting tool\./i,
                  "Optimization guidance for price, title, media, and benchmark signals.")
    );
  }

  function tightenSpacing() {
    if (document.getElementById("ea-phase19-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase19-style";
    style.textContent = `
      #phase17TeamCommandCard,
      #phase9CommercialCard,
      #phase10MoatCard {
        margin-top: 10px !important;
      }
      #phase17TeamCommandCard .copy,
      #phase9CommercialCard .copy,
      #phase10MoatCard .copy {
        max-width: 640px !important;
      }
      #phase17TeamCommandCard .item span,
      #phase9CommercialCard .item span,
      #phase10MoatCard .item span {
        line-height: 1.3 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function persist() {
    const payload = {
      version: "language-compression-v1",
      captured_at: new Date().toISOString(),
      applied: true
    };
    NS.languageCompressionV1 = payload;
    window.dashboardLanguageCompressionV1 = payload;
    if (NS.state?.set) {
      try { NS.state.set("language_compression_v1", payload, { silent: true, skipPersist: false }); } catch {}
    }
  }

  function run() {
    compressCopy();
    tightenSpacing();
    persist();
  }

  function boot() {
    run(); setTimeout(run, 250); setTimeout(run, 900); setTimeout(run, 1800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  window.addEventListener("elevate:commercial-v2", () => setTimeout(run, 120));
  window.addEventListener("elevate:team-command-v2", () => setTimeout(run, 120));
  window.addEventListener("elevate:optimization-v2", () => setTimeout(run, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(run, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase19languagecompression = true;
})();