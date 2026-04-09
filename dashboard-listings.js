
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

  function getAttrText(card, labelRegex) {
    const chips = Array.from(card.querySelectorAll(".spec-chip, .metric-pill"));
    const hit = chips.find((el) => labelRegex.test(clean(el.textContent)));
    return hit ? clean(hit.textContent) : "";
  }

  function parseListingCard(card, idx) {
    const title = clean(card.querySelector(".listing-title")?.textContent || `Listing ${idx + 1}`);
    const price = clean(card.querySelector(".listing-price")?.textContent || "");
    const image = card.querySelector("img")?.getAttribute("src") || "";
    const blob = clean(card.textContent || "");

    const views = numberFromText(
      getAttrText(card, /view/i) ||
      (blob.match(/views?\s*:?\s*([\d,]+)/i) || [])[1] ||
      0
    );
    const messages = numberFromText(
      getAttrText(card, /message/i) ||
      (blob.match(/messages?\s*:?\s*([\d,]+)/i) || [])[1] ||
      0
    );

    const priceAttention = /price/i.test(blob) || /change/i.test(blob);
    const staleFlag = /stale/i.test(blob);
    const soldFlag = /sold/i.test(blob);

    return {
      id: clean(card.dataset.listingId || ""),
      title,
      price,
      views,
      messages,
      image_url: image,
      source: "recent_listings_grid",
      status: soldFlag ? "sold" : "active",
      stale_candidate: staleFlag,
      price_attention_flag: priceAttention
    };
  }

  function readListingCardsFromDOM() {
    return Array.from(document.querySelectorAll("#recentListingsGrid .listing-card")).map(parseListingCard);
  }

  function readSummaryFallback() {
    const summary = window.dashboardSummary || {};
    const activeListings = Number(summary.active_listings || 0);
    const totalViews = Number(summary.views || 0);
    const totalMessages = Number(summary.messages || 0);
    if (!activeListings) return [];

    const avgViews = Math.round(totalViews / Math.max(activeListings, 1));
    const avgMessages = Math.round(totalMessages / Math.max(activeListings, 1));

    return Array.from({ length: Math.min(activeListings, 5) }).map((_, i) => ({
      id: `summary_listing_${i + 1}`,
      title: `Tracked Listing ${i + 1}`,
      price: "",
      views: avgViews,
      messages: avgMessages,
      source: "summary_fallback",
      status: "active",
      confidence: "low"
    }));
  }

  function inferHealth(item) {
    const views = Number(item.views || 0);
    const messages = Number(item.messages || 0);
    const status = clean(item.status).toLowerCase();
    const staleCandidate = Boolean(item.stale_candidate);
    const priceAttention = Boolean(item.price_attention_flag || (item.previous_price && item.previous_price !== item.current_price));

    if (status.includes("sold")) return "sold";
    if (messages >= 5) return "message_leader";
    if (views >= 30 && messages === 0) return "high_views_low_messages";
    if (views >= 20 && messages <= 1) return "weak_conversion";
    if (views >= 12 && messages >= 2) return "high_interest";
    if (views >= 8 && messages >= 1) return "fresh_traction";
    if (staleCandidate) return "needs_refresh";
    if (priceAttention) return "price_attention";
    if (views === 0 && messages === 0) return "low_signal";
    return "active";
  }

  function inferConfidence(item) {
    if (item.source === "recent_listings_grid") return "medium";
    if (item.source === "summary_fallback") return "low";
    return "low";
  }

  function rebuildRegistry() {
    if (!NS.state?.upsertListing) return null;

    let items = readListingCardsFromDOM();
    if (!items.length) items = readSummaryFallback();

    items.forEach((item, idx) => {
      const next = { ...item };
      if (!next.id) {
        next.id = NS.state.canonicalListingId({
          title: next.title,
          price: next.price,
          image_url: next.image_url
        });
      }
      next.health_state = inferHealth(next);
      next.confidence = next.confidence || inferConfidence(next);
      NS.state.upsertListing(next, { silent: true });
    });

    NS.state.rebuildFilteredListings();
    return buildAnalyticsFromRegistry();
  }

  function byViews(a, b) { return Number(b.views || 0) - Number(a.views || 0); }
  function byMessages(a, b) { return Number(b.messages || 0) - Number(a.messages || 0); }

  function buildAnalyticsFromRegistry() {
    const listings = Object.values(NS.state?.get?.("listingRegistry", {}) || {});
    const messageLeaders = [...listings].filter((x) => Number(x.messages || 0) > 0).sort(byMessages).slice(0, 5);
    const viewLeaders = [...listings].filter((x) => Number(x.views || 0) > 0).sort(byViews).slice(0, 5);
    const highInterest = listings.filter((x) => x.health_state === "high_interest").sort(byMessages).slice(0, 5);
    const highViewsLowMessages = listings.filter((x) => x.health_state === "high_views_low_messages").sort(byViews).slice(0, 5);
    const weakConversion = listings.filter((x) => x.health_state === "weak_conversion").sort(byViews).slice(0, 5);
    const freshTraction = listings.filter((x) => x.health_state === "fresh_traction").sort(byViews).slice(0, 5);
    const needsRefresh = listings.filter((x) => x.health_state === "needs_refresh").sort(byViews).slice(0, 5);
    const priceAttention = listings.filter((x) => x.health_state === "price_attention").sort(byViews).slice(0, 5);

    const totalViews = listings.reduce((sum, x) => sum + Number(x.views || 0), 0);
    const totalMessages = listings.reduce((sum, x) => sum + Number(x.messages || 0), 0);
    const lowConfidenceCount = listings.filter((x) => x.confidence === "low").length;

    const actionQueue = [];

    if (highViewsLowMessages.length) {
      const item = highViewsLowMessages[0];
      actionQueue.push({
        id: "b2_high_views_low_messages",
        title: `${item.title} has attention but weak conversion`,
        copy: `${Number(item.views || 0)} tracked views and ${Number(item.messages || 0)} messages. Review price, CTA, and image quality first.`,
        tone: "revenue",
        section: "overview",
        focus: "listingSearchInput",
        reason: "High views with no buyer conversation."
      });
    }

    if (messageLeaders.length) {
      const item = messageLeaders[0];
      actionQueue.push({
        id: "b2_message_leader",
        title: `${item.title} is a current message leader`,
        copy: `${Number(item.messages || 0)} tracked messages. Promote or repost what is already converting.`,
        tone: "growth",
        section: "overview",
        focus: "listingSearchInput",
        reason: "Best current buyer response in the tracked set."
      });
    }

    if (weakConversion.length) {
      const item = weakConversion[0];
      actionQueue.push({
        id: "b2_weak_conversion",
        title: `${item.title} is a weak converter`,
        copy: `${Number(item.views || 0)} views with only ${Number(item.messages || 0)} message(s). Adjust positioning before letting it sit.`,
        tone: "cleanup",
        section: "tools",
        focus: "listingSearchInput",
        reason: "Enough attention to matter, not enough response to leave unchanged."
      });
    }

    if (needsRefresh.length) {
      const item = needsRefresh[0];
      actionQueue.push({
        id: "b2_refresh_candidate",
        title: `${item.title} is a refresh candidate`,
        copy: `Visibility is cooling. Refresh the post, title, or media before traction decays further.`,
        tone: "cleanup",
        section: "overview",
        focus: "listingSearchInput",
        reason: "Stale candidate signal is active."
      });
    }

    if (priceAttention.length) {
      const item = priceAttention[0];
      actionQueue.push({
        id: "b2_price_attention",
        title: `${item.title} needs price attention`,
        copy: `Recent pricing signal detected. Review whether traction improved or dropped after price movement.`,
        tone: "revenue",
        section: "overview",
        focus: "listingSearchInput",
        reason: "Price-related state change is present."
      });
    }

    if (!actionQueue.length) {
      actionQueue.push({
        id: "b2_tracking_quiet",
        title: "Listing tracking is live",
        copy: "As more listing-level events accumulate, this queue will sharpen into stronger business recommendations.",
        tone: "growth",
        section: "tools",
        focus: null,
        reason: "Foundation is active, signal depth is still building."
      });
    }

    const payload = {
      tracking_summary: {
        total_listings: listings.length,
        tracked_views: totalViews,
        tracked_messages: totalMessages,
        message_leaders_count: messageLeaders.length,
        view_leaders_count: viewLeaders.length,
        high_interest_count: highInterest.length,
        high_views_low_messages_count: highViewsLowMessages.length,
        weak_conversion_count: weakConversion.length,
        fresh_traction_count: freshTraction.length,
        needs_refresh_count: needsRefresh.length,
        price_attention_count: priceAttention.length,
        low_confidence_count: lowConfidenceCount,
        refreshed_at: new Date().toISOString()
      },
      action_queue: actionQueue,
      leaders: {
        message_leaders: messageLeaders,
        view_leaders: viewLeaders,
        high_interest: highInterest,
        high_views_low_messages: highViewsLowMessages,
        weak_conversion: weakConversion,
        fresh_traction: freshTraction,
        needs_refresh: needsRefresh,
        price_attention: priceAttention
      }
    };

    NS.state?.setAnalytics?.(payload, { silent: false });
    NS.state?.set?.("tracking.last_rebuild_at", payload.tracking_summary.refreshed_at, { silent: true });
    NS.state?.set?.("tracking.source", "bundle_b_registry_hardening", { silent: true });

    window.dispatchEvent(new CustomEvent("elevate:tracking-refreshed"));
    return payload;
  }

  function bindRefresh() {
    const btn = document.getElementById("refreshListingsBtn");
    if (!btn || btn.dataset.bundleBBound === "true") return;
    btn.dataset.bundleBBound = "true";
    btn.addEventListener("click", () => rebuildRegistry());
  }

  function boot() {
    rebuildRegistry();
    bindRefresh();
    setTimeout(rebuildRegistry, 1200);
    setTimeout(rebuildRegistry, 3200);
  }

  NS.listings = { rebuildRegistry, buildAnalyticsFromRegistry };

  NS.modules = NS.modules || {};
  NS.modules.listings = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
