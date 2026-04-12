(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase14registryauthority) return;

  function clean(v) {
    return String(v || "").replace(/\s+/g, " ").trim();
  }

  function n(v) {
    const m = String(v || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  function text(id) {
    return clean(document.getElementById(id)?.textContent || "");
  }

  function registryItems() {
    const fromState = NS.state?.get?.("listingRegistry", {}) || {};
    const values = Object.values(fromState || {});
    if (values.length) return values;

    return Array.from(document.querySelectorAll("#recentListingsGrid .listing-card")).map((card, idx) => ({
      id: clean(card.getAttribute("data-listing-id") || `overview_${idx + 1}`),
      title: clean(card.querySelector(".listing-title")?.textContent || `Listing ${idx + 1}`),
      status: "active",
      sync_confidence: "tracked",
      views_count: n(card.querySelector(".metric-pill:nth-child(1) .metric-pill-value")?.textContent || 0),
      messages_count: n(card.querySelector(".metric-pill:nth-child(2) .metric-pill-value")?.textContent || 0),
      current_price: clean(card.querySelector(".listing-price")?.textContent || ""),
      image_url: card.querySelector("img")?.getAttribute("src") || ""
    }));
  }

  function classifyItem(item) {
    const status = clean(item.status || "active").toLowerCase();
    const sync = clean(item.sync_confidence || item.confidence || "local").toLowerCase();
    const source = clean(item.sync_source || "local").toLowerCase();
    const views = n(item.views_count ?? item.views ?? 0);
    const messages = n(item.messages_count ?? item.messages ?? 0);

    const observed_state =
      status === "removed" ? "removed" :
      messages > 0 ? "engaged" :
      views > 0 ? "seen" :
      "listed";

    const inferred_state =
      status === "removed" ? "removed" :
      views >= 20 && messages === 0 ? "conversion-risk" :
      views >= 8 && messages <= 1 ? "watch" :
      messages >= 2 ? "high-interest" :
      "stable";

    const lifecycle_confidence =
      status === "removed" ? "high" :
      /synced|tracked/.test(sync) ? "medium" :
      "low";

    const registry_health =
      item.id && clean(item.title) && (clean(item.current_price || item.price) || item.image_url)
        ? "usable"
        : "thin";

    const authority_label =
      lifecycle_confidence === "high" ? "Authority Strong" :
      lifecycle_confidence === "medium" ? "Authority Building" :
      "Authority Thin";

    return {
      id: clean(item.id || ""),
      title: clean(item.title || ""),
      observed_state,
      inferred_state,
      lifecycle_confidence,
      registry_health,
      authority_label,
      sync_source: source || "local",
      sync_confidence: sync || "local"
    };
  }

  function buildAuthority() {
    const items = registryItems().map(classifyItem);
    const strong = items.filter((x) => x.lifecycle_confidence === "high").length;
    const building = items.filter((x) => x.lifecycle_confidence === "medium").length;
    const thin = items.filter((x) => x.registry_health === "thin").length;

    const authority = {
      version: "registry-authority-v1",
      captured_at: new Date().toISOString(),
      registry_count: items.length,
      strong_authority_count: strong,
      building_authority_count: building,
      thin_registry_count: thin,
      dominant_sync_confidence:
        strong > 0 ? "high" :
        building > 0 ? "medium" : "low",
      items
    };

    return authority;
  }

  function persistAuthority(authority) {
    NS.registryAuthorityV1 = authority;
    window.dashboardRegistryAuthorityV1 = authority;

    if (NS.state?.set) {
      try {
        NS.state.set("registry_authority_v1", authority, { silent: true, skipPersist: false });
      } catch {}
    }

    NS.events?.dispatchEvent?.(new CustomEvent("registry:authority-v1", { detail: authority }));
    window.dispatchEvent(new CustomEvent("elevate:registry-authority-v1", { detail: authority }));
  }

  function addAuthoritySignal(authority) {
    const target =
      document.getElementById("overviewListingsCard") ||
      document.getElementById("phase10MoatCard");

    if (!target) return;

    let signal = target.querySelector(".phase14-authority-pill");
    if (!signal) {
      signal = document.createElement("div");
      signal.className = "phase14-authority-pill";
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

      const head =
        target.querySelector(".section-head") ||
        target.querySelector(".copy") ||
        target.firstElementChild;

      if (head) {
        head.insertAdjacentElement("afterend", signal);
      } else {
        target.insertAdjacentElement("afterbegin", signal);
      }
    }

    signal.textContent = `Registry Authority V1 • ${authority.registry_count} listings • ${authority.dominant_sync_confidence}`;
  }

  function run() {
    const authority = buildAuthority();
    persistAuthority(authority);
    addAuthoritySignal(authority);
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

  window.addEventListener("elevate:entities-v1", () => setTimeout(run, 120));
  window.addEventListener("elevate:summary-v2", () => setTimeout(run, 120));
  window.addEventListener("elevate:sync-refreshed", () => setTimeout(run, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(run, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase14registryauthority = true;
})();