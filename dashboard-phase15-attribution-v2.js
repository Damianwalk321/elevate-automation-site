(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase15attributionv2) return;

  function clean(v) {
    return String(v || "").replace(/\s+/g, " ").trim();
  }

  function n(v) {
    const m = String(v || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  function textFrom(root, selector) {
    return clean(root?.querySelector(selector)?.textContent || "");
  }

  function collectCards() {
    return Array.from(document.querySelectorAll("#recentListingsGrid .listing-card")).map((card, idx) => ({
      id: clean(card.getAttribute("data-listing-id") || `overview_${idx + 1}`),
      title: textFrom(card, ".listing-title") || `Listing ${idx + 1}`,
      status_line: textFrom(card, ".status-line"),
      price: textFrom(card, ".listing-price"),
      views: n(textFrom(card, ".metric-pill:nth-child(1) .metric-pill-value")),
      messages: n(textFrom(card, ".metric-pill:nth-child(2) .metric-pill-value"))
    }));
  }

  function classify(card, authorityItem = {}) {
    const observed = clean(authorityItem.observed_state || "");
    const inferred = clean(authorityItem.inferred_state || "");
    const lifecycle = clean(authorityItem.lifecycle_confidence || "low");
    const sync = clean(authorityItem.sync_confidence || authorityItem.sync_source || "local");

    let transition = "stable";
    let why = `${card.title} is currently stable with no dominant change event.`;
    let source = "observed";

    if (card.messages >= 2) {
      transition = "message-lift";
      why = `${card.title} is showing active response. Message count is the strongest visible reason for the current state.`;
      source = "observed";
    } else if (card.views >= 20 && card.messages === 0) {
      transition = "conversion-leak";
      why = `${card.title} is getting attention without replies. The current flag is based on a views-to-messages mismatch rather than a direct reply event.`;
      source = "inferred";
    } else if (card.views >= 8 && card.messages <= 1) {
      transition = "watch";
      why = `${card.title} has enough visibility to matter, but not enough response to confirm healthy conversion yet.`;
      source = "observed+inferred";
    } else if (observed === "removed") {
      transition = "removed";
      why = `${card.title} is no longer being treated as an active live listing.`;
      source = "observed";
    } else if (/price/i.test(card.status_line) || inferred === "conversion-risk") {
      transition = "price-review";
      why = `${card.title} is leaning toward pricing or positioning review based on current visible state.`;
      source = "observed+inferred";
    }

    return {
      id: card.id,
      title: card.title,
      transition,
      why,
      source,
      observed_state: observed || "listed",
      inferred_state: inferred || "stable",
      lifecycle_confidence: lifecycle,
      sync_confidence: sync
    };
  }

  function buildAttributionV2() {
    const authority = window.dashboardRegistryAuthorityV1 || NS.registryAuthorityV1 || NS.state?.get?.("registry_authority_v1", {}) || {};
    const items = Array.isArray(authority.items) ? authority.items : [];
    const byId = Object.fromEntries(items.map(item => [clean(item.id), item]));

    const cards = collectCards();
    const transitions = cards.map(card => classify(card, byId[clean(card.id)] || {}));

    const summary = {
      version: "attribution-v2",
      captured_at: new Date().toISOString(),
      card_count: transitions.length,
      observed_count: transitions.filter(x => x.source === "observed").length,
      inferred_count: transitions.filter(x => x.source === "inferred").length,
      mixed_count: transitions.filter(x => x.source === "observed+inferred").length,
      transitions
    };

    return summary;
  }

  function persist(summary) {
    NS.attributionV2 = summary;
    window.dashboardAttributionV2 = summary;

    if (NS.state?.set) {
      try {
        NS.state.set("attribution_v2", summary, { silent: true, skipPersist: false });
      } catch {}
    }

    NS.events?.dispatchEvent?.(new CustomEvent("attribution:v2", { detail: summary }));
    window.dispatchEvent(new CustomEvent("elevate:attribution-v2", { detail: summary }));
  }

  function addSignal(summary) {
    const target =
      document.getElementById("overviewListingsCard") ||
      document.getElementById("phase10MoatCard");

    if (!target) return;

    let signal = target.querySelector(".phase15-attribution-pill");
    if (!signal) {
      signal = document.createElement("div");
      signal.className = "phase15-attribution-pill";
      signal.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "min-height:24px",
        "padding:0 9px",
        "border-radius:999px",
        "font-size:10px",
        "font-weight:700",
        "letter-spacing:.03em",
        "border:1px solid rgba(212,175,55,0.18)",
        "background:rgba(212,175,55,0.08)",
        "color:#f3ddb0",
        "width:fit-content",
        "margin-top:8px"
      ].join(";");

      const anchor =
        target.querySelector(".phase14-authority-pill") ||
        target.querySelector(".section-head") ||
        target.firstElementChild;

      if (anchor) anchor.insertAdjacentElement("afterend", signal);
      else target.insertAdjacentElement("afterbegin", signal);
    }

    signal.textContent = `Attribution V2 • ${summary.card_count} cards • ${summary.observed_count} observed • ${summary.inferred_count} inferred`;
  }

  function updateStatus(summary) {
    const dataStatus = document.getElementById("listingDataStatus");
    if (!dataStatus) return;
    if (summary.card_count > 0) {
      dataStatus.textContent = `Listing intelligence, attribution, registry authority, and transition reasoning are live on overview cards.`;
    }
  }

  function run() {
    const summary = buildAttributionV2();
    persist(summary);
    addSignal(summary);
    updateStatus(summary);
  }

  function boot() {
    run();
    setTimeout(run, 250);
    setTimeout(run, 900);
    setTimeout(run, 1800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:registry-authority-v1", () => setTimeout(run, 120));
  window.addEventListener("elevate:summary-v2", () => setTimeout(run, 120));
  window.addEventListener("elevate:sync-refreshed", () => setTimeout(run, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(run, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase15attributionv2 = true;
})();