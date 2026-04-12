(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase12summary) return;

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

  function getPlanName() {
    const candidates = [
      text("billingPlanName"),
      text("currentPlanName"),
      text("accountPlanName"),
      text("subscriptionPlanName"),
      text("planName")
    ].filter(Boolean);
    return candidates[0] || "Starter";
  }

  function deriveCap(plan) {
    return /pro/i.test(plan) ? 25 : 5;
  }

  function currentSummary() {
    const plan = getPlanName();
    const cap = deriveCap(plan);
    const postsUsedRaw = text("commandPostsUsed");
    const postsUsed = n(postsUsedRaw);

    const summary = {
      version: "summary-v2",
      captured_at: new Date().toISOString(),
      plan_name: plan,
      posting_cap: cap,
      posts_used: postsUsed,
      posts_used_display: postsUsedRaw || `${postsUsed} / ${cap}`,
      posts_remaining: n(text("kpiPostsRemaining")),
      active_listings: n(text("kpiActiveListings")),
      weak_listings: n(text("kpiWeakListings")),
      needs_action: n(text("kpiNeedsAction")),
      queued_vehicles: n(text("kpiQueuedVehicles")),
      total_views: n(text("kpiViews")),
      total_messages: n(text("kpiMessages")),
      setup_progress_pct: n(text("commandSetupProgress")),
      sync_confidence: readSyncConfidence(),
      listing_rows_overview: document.querySelectorAll("#recentListingsGrid .listing-card").length,
      listing_rows_top: document.querySelectorAll("#topListings .top-list-item").length,
      manager_card_live: Boolean(document.getElementById("phase8ManagerCompact")),
      commercial_card_live: Boolean(document.getElementById("phase9CommercialCard")),
      moat_card_live: Boolean(document.getElementById("phase10MoatCard"))
    };

    summary.readiness_state =
      summary.setup_progress_pct >= 100 ? "ready" :
      summary.setup_progress_pct >= 70 ? "warning" : "blocked";

    summary.usage_pct = Math.min(100, Math.round((summary.posts_used / Math.max(summary.posting_cap, 1)) * 100));

    summary.upgrade_pressure =
      summary.posts_remaining <= 1 || (summary.queued_vehicles > 0 && summary.posts_remaining <= 2) || summary.usage_pct >= 80
        ? "high"
        : summary.posts_remaining <= 3 || summary.usage_pct >= 60
          ? "moderate"
          : "low";

    summary.listing_feed_state =
      summary.listing_rows_overview > 0 ? "overview_live"
      : summary.listing_rows_top > 0 ? "top_feed_only"
      : "no_rows";

    return summary;
  }

  function readSyncConfidence() {
    const stateSync = NS.state?.get?.("sync", {}) || {};
    const fromState = clean(stateSync.confidence || "");
    if (fromState) return fromState;

    const status = clean(document.getElementById("listingDataStatus")?.textContent || "");
    if (/overview listings are live/i.test(status)) return "tracked";
    if (/synced from/i.test(status)) return "synced";
    if (/catching up/i.test(status)) return "partial";
    return "local";
  }

  function persistSummary(summary) {
    NS.summaryV2 = summary;
    window.dashboardSummaryV2 = summary;

    if (NS.state?.set) {
      try {
        NS.state.set("summary_v2", summary, { silent: true, skipPersist: false });
      } catch {}
    }

    NS.events?.dispatchEvent?.(new CustomEvent("summary:v2", { detail: summary }));
    window.dispatchEvent(new CustomEvent("elevate:summary-v2", { detail: summary }));
  }

  function normalizeStatusCopy(summary) {
    const gridStatus = document.getElementById("listingGridStatus");
    if (gridStatus) {
      if (summary.listing_feed_state === "overview_live") {
        gridStatus.textContent = `${summary.listing_rows_overview} overview card${summary.listing_rows_overview === 1 ? "" : "s"} live. ${summary.total_views} views and ${summary.total_messages} messages currently tracked.`;
      } else if (summary.listing_feed_state === "top_feed_only") {
        gridStatus.textContent = `Overview cards are still thin, but ${summary.listing_rows_top} tracked listing card${summary.listing_rows_top === 1 ? "" : "s"} exist in Most Popular.`;
      } else {
        gridStatus.textContent = "No listing cards are currently painted in overview.";
      }
    }

    const dataStatus = document.getElementById("listingDataStatus");
    if (dataStatus) {
      if (summary.listing_feed_state === "overview_live") {
        dataStatus.textContent = "Listing intelligence, attribution, and the summary contract are live on overview cards.";
      } else if (summary.listing_feed_state === "top_feed_only") {
        dataStatus.textContent = "Tracked listing data exists elsewhere on the page; overview grid is still catching up.";
      } else {
        dataStatus.textContent = "No tracked overview cards yet.";
      }
    }
  }

  function addContractSignal(summary) {
    const nextMove = document.getElementById("phase11NextMove");
    if (!nextMove) return;
    if (nextMove.querySelector(".phase12-contract-pill")) return;

    const pill = document.createElement("div");
    pill.className = "phase12-contract-pill";
    pill.textContent = `Summary V2 • ${summary.readiness_state} • ${summary.sync_confidence}`;
    pill.style.cssText = [
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
      "width:fit-content"
    ].join(";");
    nextMove.insertBefore(pill, nextMove.firstChild);
  }

  function run() {
    const summary = currentSummary();
    persistSummary(summary);
    normalizeStatusCopy(summary);
    addContractSignal(summary);
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

  window.addEventListener("elevate:sync-refreshed", () => setTimeout(run, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(run, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase12summary = true;
})();