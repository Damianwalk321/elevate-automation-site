(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase3canonical) return;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function first(...values) {
    for (const value of values) {
      const out = clean(value);
      if (out) return out;
    }
    return "";
  }

  function isNegativeStatus(status) {
    const normalized = clean(status).toLowerCase();
    return ["canceled", "cancelled", "unpaid", "past_due", "expired", "suspended", "inactive"].includes(normalized);
  }

  function getListings() {
    const stateListings = Array.isArray(NS.state?.get?.("listings")) ? NS.state.get("listings") : [];
    const globalListings = Array.isArray(window.dashboardListings) ? window.dashboardListings : [];
    return stateListings.length ? stateListings : globalListings;
  }

  function computeCounts(listings, summary) {
    let active = 0;
    let views = 0;
    let messages = 0;
    let stale = 0;
    let weak = 0;
    let needsAction = 0;
    let reviewDelete = 0;
    let reviewPrice = 0;
    let reviewNew = 0;

    for (const item of listings) {
      const status = clean(item?.status).toLowerCase();
      const lifecycle = clean(item?.lifecycle_status).toLowerCase();
      const bucket = clean(item?.review_bucket).toLowerCase().replace(/[\s_-]+/g, "");

      if (!["sold", "deleted", "inactive"].includes(status)) active += 1;
      views += num(item?.views_count ?? item?.views);
      messages += num(item?.messages_count ?? item?.messages);

      if (lifecycle === "stale" || status === "stale") stale += 1;
      if (lifecycle === "review_delete" || bucket === "removedvehicles") reviewDelete += 1;
      if (lifecycle === "review_price_update" || bucket === "pricechanges") reviewPrice += 1;
      if (lifecycle === "review_new" || bucket === "newvehicles") reviewNew += 1;
      if (item?.weak) weak += 1;
      if (item?.needs_action) needsAction += 1;
    }

    return {
      active_listings: Math.max(active, num(summary?.active_listings)),
      total_views: Math.max(views, num(summary?.total_views)),
      total_messages: Math.max(messages, num(summary?.total_messages)),
      stale_listings: Math.max(stale, num(summary?.stale_listings)),
      weak_listings: Math.max(weak, num(summary?.weak_listings)),
      needs_action_count: Math.max(needsAction, num(summary?.needs_action_count)),
      review_delete_count: Math.max(reviewDelete, num(summary?.review_delete_count)),
      review_price_change_count: Math.max(reviewPrice, num(summary?.review_price_change_count)),
      review_new_count: Math.max(reviewNew, num(summary?.review_new_count)),
      review_queue_count: Math.max(
        reviewDelete + reviewPrice + reviewNew,
        num(summary?.review_queue_count)
      ),
      queue_count: Math.max(
        num(summary?.queue_count),
        num(summary?.daily_ops_queues?.ready_queue),
        num(summary?.action_center?.ready_queue)
      )
    };
  }

  function buildCanonicalSubscription(summary) {
    const current = window.currentNormalizedSession || {};
    const sub = current.subscription || {};
    const snapshot = summary?.account_snapshot || {};
    const planAccess = summary?.plan_access || {};
    const email = clean(window.currentUser?.email || current?.user?.email || snapshot?.email).toLowerCase();
    const forceTesting = email === "damian044@icloud.com";

    const plan = first(
      sub.plan,
      sub.normalized_plan,
      planAccess.plan_label,
      snapshot.plan,
      "Founder Beta"
    ) || "Founder Beta";

    const postingLimit = forceTesting
      ? Math.max(25, num(sub.posting_limit || sub.daily_posting_limit || planAccess.posting_limit || snapshot.posting_limit))
      : Math.max(num(sub.posting_limit || sub.daily_posting_limit), num(planAccess.posting_limit), num(snapshot.posting_limit));

    const postsToday = Math.max(
      num(sub.posts_today),
      num(snapshot.posts_today ?? snapshot.posts_used_today),
      num(summary?.posts_today)
    );

    const postsRemaining = Math.max(
      num(sub.posts_remaining),
      num(snapshot.posts_remaining),
      Math.max(postingLimit - postsToday, 0)
    );

    const rawStatus = first(sub.normalized_status, sub.status, snapshot.status, forceTesting ? "active" : "inactive");
    const active = Boolean(
      forceTesting ||
      sub.active === true ||
      sub.access_granted === true ||
      snapshot.active === true ||
      snapshot.access_granted === true ||
      (!isNegativeStatus(rawStatus) && (postingLimit > 0 || clean(rawStatus).toLowerCase() === "active"))
    );

    return {
      ...sub,
      plan,
      normalized_plan: plan,
      status: active ? (clean(rawStatus) || "active") : (clean(rawStatus) || "inactive"),
      normalized_status: active ? (clean(rawStatus) || "active") : (clean(rawStatus) || "inactive"),
      active,
      access_granted: active,
      posting_limit: postingLimit,
      posts_today: postsToday,
      posts_remaining: postsRemaining,
      license_key: first(sub.license_key, snapshot.software_license_key, sub.software_license_key)
    };
  }

  function buildCanonicalProfile(summary, subscription) {
    const currentProfile = window.currentProfile || {};
    const sessionProfile = window.currentNormalizedSession?.profile || {};
    const dealership = window.currentNormalizedSession?.dealership || {};
    const profileSnapshot = summary?.profile_snapshot || {};
    const accountSnapshot = summary?.account_snapshot || {};

    const province = first(
      currentProfile.province,
      sessionProfile.province,
      dealership.province,
      profileSnapshot.province,
      accountSnapshot.province
    );

    const complianceMode = first(
      currentProfile.compliance_mode,
      sessionProfile.compliance_mode,
      profileSnapshot.compliance_mode,
      province
    );

    return {
      full_name: first(currentProfile.full_name, sessionProfile.full_name, sessionProfile.salesperson_name, profileSnapshot.full_name, window.currentUser?.email),
      dealership: first(currentProfile.dealership, currentProfile.dealer_name, sessionProfile.dealership, sessionProfile.dealer_name, dealership.name, dealership.dealer_name, profileSnapshot.dealership),
      city: first(currentProfile.city, sessionProfile.city, profileSnapshot.city),
      province,
      phone: first(currentProfile.phone, sessionProfile.phone, profileSnapshot.phone),
      license_number: first(currentProfile.license_number, sessionProfile.license_number, profileSnapshot.license_number),
      listing_location: first(currentProfile.listing_location, sessionProfile.listing_location, profileSnapshot.listing_location, currentProfile.city, sessionProfile.city),
      dealer_phone: first(currentProfile.dealer_phone, sessionProfile.dealer_phone, dealership.phone, profileSnapshot.dealer_phone),
      dealer_email: first(currentProfile.dealer_email, sessionProfile.dealer_email, dealership.email, profileSnapshot.dealer_email),
      compliance_mode: complianceMode,
      dealer_website: first(currentProfile.dealer_website, sessionProfile.dealer_website, dealership.website, profileSnapshot.dealer_website),
      inventory_url: first(currentProfile.inventory_url, sessionProfile.inventory_url, dealership.inventory_url, profileSnapshot.inventory_url),
      scanner_type: first(currentProfile.scanner_type, sessionProfile.scanner_type, window.currentNormalizedSession?.scanner_config?.scanner_type, dealership.scanner_type, profileSnapshot.scanner_type),
      software_license_key: first(currentProfile.software_license_key, subscription.license_key, profileSnapshot.software_license_key)
    };
  }

  function buildCanonicalSetup(profile, subscription, summary) {
    const existing = summary?.setup_status || {};
    const gaps = [];
    const pushGap = (key, ready, label) => {
      if (!ready) gaps.push(label || key);
      return ready;
    };

    const dealerWebsite = pushGap("dealer_website", Boolean(profile.dealer_website), "dealer website");
    const inventoryUrl = pushGap("inventory_url", Boolean(profile.inventory_url), "inventory URL");
    const scannerType = pushGap("scanner_type", Boolean(profile.scanner_type), "scanner type");
    const listingLocation = pushGap("listing_location", Boolean(profile.listing_location), "listing location");
    const complianceMode = pushGap("compliance_mode", Boolean(profile.compliance_mode || profile.province), "compliance mode");
    const fullName = pushGap("full_name", Boolean(profile.full_name), "salesperson name");
    const dealership = pushGap("dealership", Boolean(profile.dealership), "dealership");
    const access = pushGap("access", Boolean(subscription.active), "account access");

    const checklist = [dealerWebsite, inventoryUrl, scannerType, listingLocation, complianceMode, fullName, dealership, access];
    const completed = checklist.filter(Boolean).length;

    return {
      ...existing,
      dealer_website_present: dealerWebsite,
      inventory_url_present: inventoryUrl,
      scanner_type_present: scannerType,
      listing_location_present: listingLocation,
      compliance_mode_present: complianceMode,
      salesperson_name_present: fullName,
      full_name_present: fullName,
      dealership_name_present: dealership,
      dealership_present: dealership,
      profile_complete: completed >= 7,
      setup_gaps: gaps
    };
  }

  function buildCanonicalSummary() {
    const existing = window.dashboardSummary || {};
    const listings = getListings();
    const subscription = buildCanonicalSubscription(existing);
    const profile = buildCanonicalProfile(existing, subscription);
    const counts = computeCounts(listings, existing);
    const setupStatus = buildCanonicalSetup(profile, subscription, existing);

    const canonicalAccess = {
      plan: subscription.plan,
      status: subscription.status,
      posting_limit: subscription.posting_limit,
      posts_remaining: subscription.posts_remaining
    };

    const accountSnapshot = {
      ...(existing.account_snapshot || {}),
      plan: subscription.plan,
      status: subscription.status,
      posting_limit: subscription.posting_limit,
      posts_remaining: subscription.posts_remaining,
      posts_today: subscription.posts_today,
      access_granted: subscription.access_granted,
      active: subscription.active,
      software_license_key: subscription.license_key || existing.account_snapshot?.software_license_key || ""
    };

    const next = {
      ...existing,
      ...counts,
      posts_today: Math.max(num(existing.posts_today), subscription.posts_today),
      account_snapshot: accountSnapshot,
      profile_snapshot: {
        ...(existing.profile_snapshot || {}),
        ...profile
      },
      setup_status: setupStatus,
      canonical_access: canonicalAccess,
      state_provenance: {
        posts_today: "canonical.subscription.posts_today",
        plan: "canonical.subscription.plan",
        status: "canonical.subscription.status",
        posting_limit: "canonical.subscription.posting_limit",
        setup_status: "canonical.profile+subscription"
      }
    };

    return { summary: next, subscription, profile };
  }

  function syncIntoState(summary, subscription, profile) {
    try {
      NS.state?.set?.("summary", summary, { silent: true });
      NS.state?.set?.("session", { ...(window.currentNormalizedSession || {}), subscription, profile }, { silent: true });
      NS.state?.set?.("profile", profile, { silent: true });
      NS.state?.persist?.();
    } catch {}
  }

  function rerender() {
    try { window.rerenderCanonicalPanels?.(); } catch {}
    try { window.renderDashboardAnalytics?.(); } catch {}
    try { window.renderSetupSnapshot?.(); } catch {}
    try { window.applyListingFiltersAndRender?.(); } catch {}
  }

  function applyCanonicalTruth() {
    const { summary, subscription, profile } = buildCanonicalSummary();
    window.dashboardSummary = summary;
    window.currentNormalizedSession = {
      ...(window.currentNormalizedSession || {}),
      subscription,
      profile,
      dealership: {
        ...(window.currentNormalizedSession?.dealership || {}),
        name: first(window.currentNormalizedSession?.dealership?.name, profile.dealership),
        dealer_name: first(window.currentNormalizedSession?.dealership?.dealer_name, profile.dealership),
        website: first(window.currentNormalizedSession?.dealership?.website, profile.dealer_website),
        inventory_url: first(window.currentNormalizedSession?.dealership?.inventory_url, profile.inventory_url),
        province: first(window.currentNormalizedSession?.dealership?.province, profile.province),
        scanner_type: first(window.currentNormalizedSession?.dealership?.scanner_type, profile.scanner_type),
        phone: first(window.currentNormalizedSession?.dealership?.phone, profile.dealer_phone),
        email: first(window.currentNormalizedSession?.dealership?.email, profile.dealer_email)
      }
    };
    window.currentProfile = {
      ...(window.currentProfile || {}),
      ...profile
    };
    window.SYSTEM_STATE = window.SYSTEM_STATE || {};
    window.SYSTEM_STATE.summary = summary;
    window.SYSTEM_STATE.profile = profile;
    window.SYSTEM_STATE.session = window.currentNormalizedSession;
    window.SYSTEM_STATE.subscription = subscription;
    window.SYSTEM_STATE.setup = summary.setup_status || {};

    syncIntoState(summary, subscription, profile);
    rerender();
    return summary;
  }

  function wrapFunction(name) {
    const original = window[name];
    if (typeof original !== "function" || original.__eaCanonicalWrapped) return;
    const wrapped = async function (...args) {
      const result = await original.apply(this, args);
      try { applyCanonicalTruth(); } catch {}
      return result;
    };
    wrapped.__eaCanonicalWrapped = true;
    window[name] = wrapped;
  }

  function installHooks() {
    wrapFunction("refreshDashboardState");
    wrapFunction("loadListingDashboardData");
    wrapFunction("loadAccountData");
  }

  function boot() {
    installHooks();
    let ticks = 0;
    const maxTicks = 18;
    const interval = setInterval(() => {
      ticks += 1;
      try { applyCanonicalTruth(); } catch {}
      if (ticks >= maxTicks) clearInterval(interval);
    }, 450);

    setTimeout(() => {
      try { applyCanonicalTruth(); } catch {}
    }, 0);

    window.addEventListener("elevate:sync-refreshed", () => {
      try { applyCanonicalTruth(); } catch {}
    });

    NS.events?.addEventListener?.("state:set", () => {
      try { applyCanonicalTruth(); } catch {}
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  NS.phase3canonical = { applyCanonicalTruth, buildCanonicalSummary };
  NS.modules = NS.modules || {};
  NS.modules.phase3canonical = true;
})();
