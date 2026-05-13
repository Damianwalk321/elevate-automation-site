(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.executionHubDataBridge) return;

  const BRIDGE_VERSION = '20260513b1';

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function first(...values) {
    for (const value of values) {
      const cleaned = clean(value);
      if (cleaned && !/^(loading\.?|unknown|undefined|null|unset|missing)$/i.test(cleaned)) return cleaned;
    }
    return '';
  }

  function num(value, fallback = 0) {
    const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return false;
    const next = clean(value);
    if (!next) return false;
    if (clean(el.textContent) === next) return false;
    el.textContent = next;
    el.dataset.eaBridgeVersion = BRIDGE_VERSION;
    return true;
  }

  function ensureHiddenValue(id, value) {
    const section = document.getElementById('extension') || document.body;
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('span');
      el.id = id;
      el.style.display = 'none';
      el.dataset.eaBridgeCreated = 'true';
      section.appendChild(el);
    }
    return setText(id, value);
  }

  function readSummary() {
    const summary = window.dashboardSummary?.data ? window.dashboardSummary.data : window.dashboardSummary;
    return summary && typeof summary === 'object' ? summary : {};
  }

  function readProfile(summary) {
    return {
      ...(summary.account_snapshot || {}),
      ...(summary.profile_snapshot || {}),
      ...(summary.profile || {})
    };
  }

  function applyBridge(source = 'manual') {
    const summary = readSummary();
    const profile = readProfile(summary);
    const setup = summary.setup_status || {};
    const plan = summary.plan_access || {};
    const account = summary.account_snapshot || {};
    const command = summary.command_center || {};
    const kpis = command.kpis || {};
    const queues = command.work_queues || {};

    if (!Object.keys(summary).length && !Object.keys(profile).length) return false;

    let changed = false;

    const accessState = first(
      account.access_granted || summary.can_post ? 'Active' : '',
      account.status,
      summary.access_state,
      profile.access_state,
      'Inactive'
    );

    const dealerWebsite = first(
      profile.dealer_website,
      profile.dealerWebsite,
      profile.website,
      summary.dealer_website,
      summary.dealerWebsite
    );

    const inventoryUrl = first(
      profile.inventory_url,
      profile.inventoryUrl,
      summary.inventory_url,
      summary.inventoryUrl,
      setup.inventory_url
    );

    const scannerType = first(
      profile.scanner_type,
      profile.scannerType,
      summary.scanner_type,
      summary.scannerType,
      setup.scanner_type,
      setup.scanner_type_present ? 'vehicle-cards' : ''
    );

    const listingLocation = first(
      profile.listing_location,
      profile.listingLocation,
      profile.city && profile.province ? `${profile.city}, ${profile.province}` : '',
      summary.listing_location,
      summary.listingLocation
    );

    const complianceMode = first(
      profile.compliance_mode,
      profile.complianceMode,
      profile.province,
      summary.compliance_mode,
      summary.complianceMode,
      setup.compliance_mode,
      setup.compliance_mode_present ? 'Configured' : ''
    );

    const remainingPosts = String(num(summary.posts_remaining ?? kpis.remaining_today ?? summary.daily_limit ?? 0));
    const dailyLimit = String(num(summary.effective_posting_limit ?? summary.daily_limit ?? plan.daily_limit ?? 0));
    const postsUsed = String(num(summary.posts_today ?? kpis.posted_today ?? 0));
    const reviewQueue = String(num(summary.review_queue_count ?? kpis.in_review ?? queues.review_queue ?? 0));
    const staleListings = String(num(summary.review_delete_count ?? queues.stale_review ?? summary.stale_listings_count ?? 0));
    const queuedVehicles = String(num(summary.queue_count ?? queues.ready_to_post ?? 0));

    changed = ensureHiddenValue('extensionAccessState', accessState) || changed;
    changed = ensureHiddenValue('extensionPlan', first(plan.plan_label, account.plan, summary.plan, 'Founder Beta')) || changed;
    changed = ensureHiddenValue('extensionPostsUsed', postsUsed) || changed;
    changed = ensureHiddenValue('extensionRemainingPosts', remainingPosts) || changed;
    changed = ensureHiddenValue('extensionPostLimit', dailyLimit) || changed;
    changed = ensureHiddenValue('extensionReviewQueue', reviewQueue) || changed;
    changed = ensureHiddenValue('extensionStaleListings', staleListings) || changed;
    changed = ensureHiddenValue('staleQueueCount', staleListings) || changed;
    changed = ensureHiddenValue('extensionScannerType', scannerType || 'Review') || changed;
    changed = ensureHiddenValue('extensionDealerWebsite', dealerWebsite || 'Review') || changed;
    changed = ensureHiddenValue('extensionInventoryUrl', inventoryUrl || 'Review') || changed;
    changed = ensureHiddenValue('extensionListingLocation', listingLocation || 'Review') || changed;
    changed = ensureHiddenValue('extensionComplianceMode', complianceMode || 'Unset') || changed;
    changed = ensureHiddenValue('extensionMarketplaceBridge', accessState === 'Active' ? 'Ready' : 'Review') || changed;
    changed = ensureHiddenValue('extensionQueuedVehicles', queuedVehicles) || changed;

    changed = setText('kpiQueuedVehicles', queuedVehicles) || changed;
    changed = setText('kpiReviewQueue', reviewQueue) || changed;
    changed = setText('kpiPostsRemaining', remainingPosts) || changed;
    changed = setText('commandReadyQueue', queuedVehicles) || changed;
    changed = setText('commandPostsUsed', `${postsUsed}/${dailyLimit}`) || changed;

    if (changed) {
      try {
        window.dispatchEvent(new CustomEvent('elevate:tracking-refreshed', { detail: { source, bridge: BRIDGE_VERSION } }));
      } catch {}
    }

    return changed;
  }

  function schedule(source) {
    applyBridge(source);
    setTimeout(() => applyBridge(`${source}:250ms`), 250);
    setTimeout(() => applyBridge(`${source}:900ms`), 900);
  }

  window.addEventListener('elevate:summary-ready', () => schedule('summary-ready'));
  window.addEventListener('elevate:account-truth', () => schedule('account-truth'));
  window.addEventListener('elevate:auth-ready', () => schedule('auth-ready'));
  window.addEventListener('elevate:tracking-refreshed', () => setTimeout(() => applyBridge('tracking-refreshed'), 50));

  schedule('boot');
  setTimeout(() => schedule('boot-late'), 1800);
  setTimeout(() => schedule('boot-final'), 4200);

  NS.modules = NS.modules || {};
  NS.modules.executionHubDataBridge = true;
})();
