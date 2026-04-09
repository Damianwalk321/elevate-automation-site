
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.listings) return;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function numberFromText(value) {
    const m = String(value || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  function inferHealth(item) {
    const views = Number(item.views || 0);
    const messages = Number(item.messages || 0);
    const status = clean(item.status).toLowerCase();
    if (status.includes("sold")) return "sold";
    if (messages >= 3) return "high_interest";
    if (views >= 20 && messages === 0) return "high_views_low_messages";
    if (views >= 10 && messages <= 1) return "weak_conversion";
    if (views === 0 && messages === 0) return "low_signal";
    return "active";
  }

  function readListingCardsFromDOM() {
    const cards = Array.from(document.querySelectorAll("#recentListingsGrid .listing-card"));
    return cards.map((card, idx) => {
      const title = clean(card.querySelector(".listing-title")?.textContent || `Listing ${idx + 1}`);
      const price = clean(card.querySelector(".listing-price")?.textContent || "");
      const specs = Array.from(card.querySelectorAll(".spec-chip, .metric-pill")).map((el) => clean(el.textContent));
      const textBlob = clean(card.textContent || "");
      const views = numberFromText(specs.find((s) => /view/i.test(s)) || (textBlob.match(/views?\s*:?\s*([\d,]+)/i) || [])[1] || 0);
      const messages = numberFromText(specs.find((s) => /message/i.test(s)) || (textBlob.match(/messages?\s*:?\s*([\d,]+)/i) || [])[1] || 0);
      const image = card.querySelector("img")?.getAttribute("src") || "";
      return {
        id: clean(card.dataset.listingId || title || `listing_${idx}`),
        title,
        price,
        views,
        messages,
        image_url: image,
        source: "recent_listings_grid",
        status: "active"
      };
    });
  }

  function readSummaryFallback() {
    const summary = window.dashboardSummary || {};
    const activeListings = Number(summary.active_listings || 0);
    const totalViews = Number(summary.views || 0);
    const totalMessages = Number(summary.messages || 0);
    const items = [];
    if (!activeListings) return items;
    const avgViews = Math.round(totalViews / Math.max(activeListings, 1));
    const avgMessages = Math.round(totalMessages / Math.max(activeListings, 1));
    for (let i = 0; i < Math.min(activeListings, 5); i += 1) {
      items.push({
        id: `summary_listing_${i + 1}`,
        title: `Tracked Listing ${i + 1}`,
        price: "",
        views: avgViews,
        messages: avgMessages,
        source: "summary_fallback",
        status: "active"
      });
    }
    return items;
  }

  function buildAnalyticsFromRegistry() {
    const listings = Object.values(NS.state?.get?.("listingRegistry", {}) || {});
    const sortedByViews = [...listings].sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
    const sortedByMessages = [...listings].sort((a, b) => Number(b.messages || 0) - Number(a.messages || 0));
    const highInterest = listings.filter((item) => Number(item.messages || 0) >= 3);
    const highViewsLowMessages = listings.filter((item) => Number(item.views || 0) >= 20 && Number(item.messages || 0) === 0);
    const weakConversion = listings.filter((item) => Number(item.views || 0) >= 10 && Number(item.messages || 0) <= 1);

    const trackedViews = listings.reduce((sum, item) => sum + Number(item.views || 0), 0);
    const trackedMessages = listings.reduce((sum, item) => sum + Number(item.messages || 0), 0);

    const actionQueue = [];
    if (highViewsLowMessages.length) {
      actionQueue.push({
        id: "high_views_low_messages",
        title: `${highViewsLowMessages.length} listing${highViewsLowMessages.length === 1 ? "" : "s"} have traction without conversion`,
        copy: "Views are landing, but messages are not. Review title, price, CTA, and media.",
        tone: "revenue",
        section: "tools",
        focus: "listingSearchInput"
      });
    }
    if (weakConversion.length) {
      actionQueue.push({
        id: "weak_conversion",
        title: `${weakConversion.length} listing${weakConversion.length === 1 ? "" : "s"} are weak converters`,
        copy: "These units have enough attention to matter, but not enough responses to justify staying unchanged.",
        tone: "cleanup",
        section: "tools",
        focus: "listingSearchInput"
      });
    }
    if (highInterest.length) {
      actionQueue.push({
        id: "high_interest",
        title: `${highInterest.length} listing${highInterest.length === 1 ? "" : "s"} are current message leaders`,
        copy: "Push the strongest current performers first. Promote, repost, or keep them in front of buyers.",
        tone: "growth",
        section: "overview",
        focus: "listingSearchInput"
      });
    }
    if (!actionQueue.length) {
      actionQueue.push({
        id: "tracking_foundation_quiet",
        title: "Tracking foundation is live",
        copy: "As listing-level view and message data grows, this queue will become more precise and more valuable.",
        tone: "growth",
        section: "tools",
        focus: null
      });
    }

    const payload = {
      tracking_summary: {
        total_listings: listings.length,
        tracked_views: trackedViews,
        tracked_messages: trackedMessages,
        high_interest_count: highInterest.length,
        high_views_low_messages_count: highViewsLowMessages.length,
        weak_conversion_count: weakConversion.length,
        message_leaders_count: sortedByMessages.filter((item) => Number(item.messages || 0) > 0).length,
        view_leaders_count: sortedByViews.filter((item) => Number(item.views || 0) > 0).length,
        stale_candidates_count: listings.filter((item) => clean(item.health_state).toLowerCase().includes("stale")).length,
        refreshed_at: new Date().toISOString()
      },
      action_queue: actionQueue,
      leaders: {
        message_leaders: sortedByMessages.slice(0, 5),
        view_leaders: sortedByViews.slice(0, 5),
        high_interest: highInterest.slice(0, 5),
        high_views_low_messages: highViewsLowMessages.slice(0, 5),
        weak_conversion: weakConversion.slice(0, 5)
      }
    };
    NS.state?.setAnalytics?.(payload, { silent: false });
    NS.state?.set?.("tracking.last_rebuild_at", payload.tracking_summary.refreshed_at, { silent: true });
    NS.state?.set?.("tracking.source", "bundle_a_foundation", { silent: true, skipPersist: false });
    return payload;
  }

  function rebuildRegistry() {
    if (!NS.state?.upsertListing) return;
    let items = readListingCardsFromDOM();
    if (!items.length) items = readSummaryFallback();
    items.forEach((item, idx) => {
      const next = { ...item };
      next.health_state = inferHealth(next);
      if (!next.id) next.id = `${next.title || "listing"}_${idx + 1}`;
      NS.state.upsertListing(next, { silent: true });
    });
    NS.state?.rebuildFilteredListings?.();
    return buildAnalyticsFromRegistry();
  }

  function bindRefresh() {
    const btn = document.getElementById("refreshListingsBtn");
    if (!btn || btn.dataset.bundleABound === "true") return;
    btn.dataset.bundleABound = "true";
    btn.addEventListener("click", () => {
      rebuildRegistry();
      window.dispatchEvent(new CustomEvent("elevate:tracking-refreshed"));
    });
  }

  function boot() {
    rebuildRegistry();
    bindRefresh();
    setTimeout(rebuildRegistry, 1200);
    setTimeout(rebuildRegistry, 3200);
  }

  NS.listings = {
    rebuildRegistry,
    buildAnalyticsFromRegistry
  };

  NS.modules = NS.modules || {};
  NS.modules.listings = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
