(() => {
  if (window.__ELEVATE_DASHBOARD_SCRIPT_LOADED__) {
    console.warn('[Elevate Dashboard] Script already loaded; skipping duplicate initialization.');
    return;
  }
  window.__ELEVATE_DASHBOARD_SCRIPT_LOADED__ = true;

  const state = {
    bootStages: [],
    supabaseClient: null,
    currentUser: null,
    currentProfile: null,
    currentAccountData: null,
    currentNormalizedSession: null,
    dashboardSummary: null,
    dashboardListings: [],
    filteredListings: [],
    listingQuickFilter: 'all',
    currentListingDetail: null
  };

  const EXTENSION_DOWNLOAD_URL = '/downloads/elevate-automation-extension.zip';
  const EXTENSION_FALLBACK_URL = 'https://github.com/Damianwalk321/elevate-automation-vehicle-poster/archive/refs/heads/Dev.zip';

  document.addEventListener('DOMContentLoaded', boot);

  async function boot() {
    try {
      setBootStatus('Booting dashboard...');

      if (!window.supabase?.createClient) {
        setBootStatus('Supabase library missing.');
        return;
      }

      state.supabaseClient =
        window.supabaseClient ||
        window.supabase.createClient(window.__ELEVATE_SUPABASE_URL, window.__ELEVATE_SUPABASE_ANON_KEY);

      if (!state.supabaseClient) {
        setBootStatus('Supabase client unavailable.');
        return;
      }

      bindDashboardUI();
      pushBootStage('Session', 'Checking login session...');

      const { data: { session }, error } = await state.supabaseClient.auth.getSession();
      if (error) throw error;
      if (!session?.user) {
        redirectToLogin();
        return;
      }

      state.currentUser = session.user;
      renderUserBasics(session.user);

      pushBootStage('User', 'Syncing account record...');
      await syncUserIfNeeded(session.user);

      pushBootStage('Profile', 'Loading saved dealer profile...');
      await loadProfile(session.user.id);

      pushBootStage('Workspace', 'Loading extension state, metrics, and listings...');
      await refreshDashboardState(true);

      pushBootStage('Extension', 'Pushing live profile sync to extension...');
      await pushExtensionProfileSync();

      showSection('overview');
      setBootStatus('Dashboard ready.');
    } catch (error) {
      console.error('Dashboard boot failed:', error);
      setBootStatus(`Dashboard failed to load: ${error.message || 'Unknown error'}`);
    }
  }

  function bindDashboardUI() {
    document.querySelectorAll('[data-section]').forEach((button) => {
      button.addEventListener('click', () => showSection(button.getAttribute('data-section') || 'overview'));
    });

    onClick('saveProfileBtn', onSaveProfilePressed);
    onClick('logoutBtn', signOutUser);
    onClick('refreshAccessBtn', async () => {
      await refreshDashboardState(true);
      await pushExtensionProfileSync();
    });
    onClick('refreshExtensionStateBtn', async () => {
      await loadAccountData(state.currentUser, true);
      await pushExtensionProfileSync();
      setStatus('extensionActionStatus', 'Extension state refreshed.');
    });
    onClick('downloadExtensionBtn', async () => {
      const url = await resolveExtensionDownloadUrl();
      window.open(url, '_blank');
      setStatus('extensionActionStatus', 'Opening extension download...');
    });
    onClick('openMarketplaceBtn', () => window.open('https://www.facebook.com/marketplace/create/vehicle', '_blank'));
    onClick('openInventoryBtn', () => {
      const inventoryUrl = clean(getFieldValue('inventory_url') || state.currentProfile?.inventory_url || state.currentNormalizedSession?.dealership?.inventory_url);
      if (!inventoryUrl) {
        setStatus('extensionActionStatus', 'No inventory URL saved yet.');
        return;
      }
      window.open(normalizeUrlInput(inventoryUrl), '_blank');
      setStatus('extensionActionStatus', 'Opening inventory URL...');
    });
    onClick('copySetupStepsBtn', async () => {
      try {
        await navigator.clipboard.writeText(buildSetupStepsText());
        setStatus('extensionActionStatus', 'Setup steps copied.');
      } catch (error) {
        console.error(error);
        setStatus('extensionActionStatus', 'Could not copy setup steps.');
      }
    });
    onClick('refreshBillingBtn', async () => {
      await loadAccountData(state.currentUser, true);
      setStatus('accountStatusBilling', 'Billing data refreshed.');
    });
    onClick('openBillingPortalBtn', async () => {
      try {
        setStatus('accountStatusBilling', 'Opening billing portal...');
        const response = await apiFetch('/api/create-billing-portal-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: state.currentUser?.id || '', email: state.currentUser?.email || '' })
        });
        const parsed = await response.text();
        let data = {};
        try { data = JSON.parse(parsed || '{}'); } catch {
          throw new Error('Server error (non-JSON response)');
        }
        if (!response.ok) throw new Error(data.error || 'Could not open billing portal.');
        if (data.redirectToCheckout) {
          setStatus('accountStatusBilling', data.message || 'No active billing profile yet.');
          return;
        }
        if (!data.url) throw new Error('Billing portal URL missing.');
        window.location.href = data.url;
      } catch (error) {
        console.error(error);
        setStatus('accountStatusBilling', error.message || 'Could not open billing portal.');
      }
    });
    onClick('refreshListingsBtn', async () => {
      setStatus('listingGridStatus', 'Refreshing listings...');
      await loadListingDashboardData(true);
      setStatus('listingGridStatus', 'Listings refreshed.');
    });

    const listingSortSelect = document.getElementById('listingSortSelect');
    if (listingSortSelect) listingSortSelect.addEventListener('change', applyListingFiltersAndRender);
    const listingSearchInput = document.getElementById('listingSearchInput');
    if (listingSearchInput) listingSearchInput.addEventListener('input', applyListingFiltersAndRender);

    document.querySelectorAll('[data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        state.listingQuickFilter = clean(button.getAttribute('data-filter') || 'all').toLowerCase() || 'all';
        document.querySelectorAll('[data-filter]').forEach((other) => other.classList.toggle('active', other === button));
        applyListingFiltersAndRender();
      });
    });

    window.addEventListener('resize', debounce(() => drawActivityChart(buildChartSeries()), 150));
  }

  async function refreshDashboardState(forceFresh = false) {
    await loadAccountData(state.currentUser, forceFresh);
    await loadListingDashboardData(forceFresh);
  }

  async function getAuthAccessToken() {
    try {
      const { data, error } = await state.supabaseClient.auth.getSession();
      if (error) return '';
      return data?.session?.access_token || '';
    } catch {
      return '';
    }
  }

  async function apiFetch(url, options = {}) {
    const headers = { ...(options.headers || {}), 'x-elevate-client': 'dashboard' };
    const token = await getAuthAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  }

  async function syncUserIfNeeded(user) {
    try {
      const response = await apiFetch('/api/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, email: user.email || '' })
      });
      if (!response.ok) console.warn('syncUserIfNeeded non-200:', response.status);
    } catch (error) {
      console.warn('syncUserIfNeeded warning:', error);
    }
  }

  async function loadProfile(userId) {
    try {
      setStatus('profileStatus', 'Loading profile...');
      const response = await apiFetch(`/api/profile?id=${encodeURIComponent(userId)}${state.currentUser?.email ? `&email=${encodeURIComponent(state.currentUser.email)}` : ''}`, {
        method: 'GET',
        cache: 'no-store'
      });
      const text = await response.text();
      const result = safeJson(text);
      const profile = result?.data || result?.profile || null;
      state.currentProfile = profile || {};
      populateProfileForm(state.currentProfile);
      renderProfileSummary(state.currentProfile);
      populateComplianceSummary(state.currentProfile);
      setStatus('profileStatus', profile ? 'Profile loaded.' : 'No profile loaded yet.');
    } catch (error) {
      console.error('loadProfile error:', error);
      state.currentProfile = {};
      renderProfileSummary(state.currentProfile);
      setStatus('profileStatus', 'Failed to load profile.');
    }
  }

  async function submitProfileSave(user) {
    const payload = {
      id: user.id,
      email: user.email || '',
      full_name: getFieldValue('full_name'),
      dealership: getFieldValue('dealership'),
      city: getFieldValue('city'),
      province: getFieldValue('province'),
      phone: getFieldValue('phone'),
      license_number: getFieldValue('license_number'),
      listing_location: getFieldValue('listing_location'),
      dealer_phone: getFieldValue('dealer_phone'),
      dealer_email: getFieldValue('dealer_email'),
      compliance_mode: getFieldValue('compliance_mode'),
      dealer_website: normalizeUrlInput(getFieldValue('dealer_website')),
      inventory_url: normalizeUrlInput(getFieldValue('inventory_url')),
      scanner_type: getFieldValue('scanner_type')
    };

    const response = await apiFetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    const result = safeJson(text);
    if (!response.ok || result?.ok === false) {
      throw new Error(result?.detail || result?.error || result?.message || 'Unknown error');
    }

    state.currentProfile = result?.data || result?.profile || payload;
    populateProfileForm(state.currentProfile);
    renderProfileSummary(state.currentProfile);
    populateComplianceSummary(state.currentProfile);
  }

  async function onSaveProfilePressed() {
    try {
      if (!state.currentUser) {
        setStatus('profileStatus', 'No authenticated user found.');
        return;
      }
      setStatus('profileStatus', 'Saving profile...');
      await submitProfileSave(state.currentUser);
      await loadAccountData(state.currentUser, true);
      await pushExtensionProfileSync();
      setStatus('profileStatus', 'Profile saved successfully.');
    } catch (error) {
      console.error('onSaveProfilePressed error:', error);
      setStatus('profileStatus', `Save failed: ${error.message || 'Unknown error'}`);
    }
  }

  async function loadAccountData(user, forceFresh = false) {
    if (!user) return;
    try {
      setStatus('accountStatusBilling', 'Loading account data...');
      setStatus('extensionActionStatus', 'Loading extension state...');

      const url = new URL('/api/extension-state', window.location.origin);
      url.searchParams.set('email', user.email || '');
      if (window.location.hostname) url.searchParams.set('hostname', window.location.hostname);
      if (forceFresh) url.searchParams.set('_ts', String(Date.now()));

      const response = await fetch(url.toString(), { cache: 'no-store' });
      const text = await response.text();
      const result = safeJson(text);

      state.currentAccountData = result || null;
      state.currentNormalizedSession = normalizeExtensionStateResponse(result, user, state.currentProfile);

      renderAccessState(state.currentNormalizedSession);
      renderExtensionControl(state.currentNormalizedSession, state.currentProfile);
      updateSetupStates(state.currentProfile, state.currentNormalizedSession);
      renderSetupWorkspace(state.currentProfile, state.currentNormalizedSession);
      renderComplianceWorkspace(state.currentProfile, state.currentNormalizedSession);
      renderToolsWorkspace(state.currentProfile, state.currentNormalizedSession);
      renderBillingSection();

      setStatus('accountStatusBilling', 'Account data loaded.');
      setStatus('extensionActionStatus', 'Extension state loaded.');
    } catch (error) {
      console.error('loadAccountData error:', error);
      state.currentNormalizedSession = buildFallbackSessionFromLocalState();
      renderAccessState(state.currentNormalizedSession);
      renderExtensionControl(state.currentNormalizedSession, state.currentProfile);
      updateSetupStates(state.currentProfile, state.currentNormalizedSession);
      renderSetupWorkspace(state.currentProfile, state.currentNormalizedSession);
      renderComplianceWorkspace(state.currentProfile, state.currentNormalizedSession);
      renderToolsWorkspace(state.currentProfile, state.currentNormalizedSession);
      renderBillingSection();
      setStatus('accountStatusBilling', 'Failed to load extension-state. Using local fallback.');
      setStatus('extensionActionStatus', 'Extension state unavailable. Using local fallback.');
    }
  }

  async function loadListingDashboardData(forceFresh = false) {
    try {
      state.dashboardSummary = await fetchDashboardSummary(forceFresh);
      const rawListings = await fetchUserListings(forceFresh);
      state.dashboardListings = Array.isArray(rawListings) ? rawListings.map(normalizeListingRecord).filter(Boolean) : [];
      state.dashboardSummary = mergeSummaryWithListings(state.dashboardSummary || {}, state.dashboardListings);
      state.filteredListings = [...state.dashboardListings];
      renderDashboardAnalytics();
      renderSetupSnapshot();
      applyListingFiltersAndRender();
    } catch (error) {
      console.error('loadListingDashboardData error:', error);
      state.dashboardListings = [];
      state.dashboardSummary = mergeSummaryWithListings({}, []);
      state.filteredListings = [];
      renderDashboardAnalytics();
      renderSetupSnapshot();
      applyListingFiltersAndRender();
    }
  }

  async function fetchDashboardSummary(forceFresh = false) {
    if (!state.currentUser?.id) return {};
    try {
      const url = new URL('/api/get-dashboard-summary', window.location.origin);
      url.searchParams.set('userId', state.currentUser.id);
      if (state.currentUser.email) url.searchParams.set('email', state.currentUser.email);
      if (forceFresh) url.searchParams.set('_ts', String(Date.now()));
      const response = await apiFetch(url.toString(), { method: 'GET', cache: 'no-store' });
      if (!response.ok) return {};
      const text = await response.text();
      const result = safeJson(text);
      return result?.data || result || {};
    } catch (error) {
      console.warn('fetchDashboardSummary fallback:', error);
      return {};
    }
  }

  async function fetchUserListings(forceFresh = false) {
    if (!state.currentUser?.id) return [];
    try {
      const url = new URL('/api/get-user-listings', window.location.origin);
      url.searchParams.set('userId', state.currentUser.id);
      if (state.currentUser.email) url.searchParams.set('email', state.currentUser.email);
      url.searchParams.set('limit', '250');
      if (forceFresh) url.searchParams.set('_ts', String(Date.now()));
      const response = await apiFetch(url.toString(), { method: 'GET', cache: 'no-store' });
      if (!response.ok) return [];
      const text = await response.text();
      const result = safeJson(text);
      const rows = result?.data || result?.listings || result || [];
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      console.warn('fetchUserListings fallback:', error);
      return [];
    }
  }

  function normalizeListingRecord(row) {
    if (!row || typeof row !== 'object') return null;
    const postedAt = row.posted_at || row.created_at || row.timestamp || new Date().toISOString();
    const views = numberOrZero(row.views_count ?? row.views ?? 0);
    const messages = numberOrZero(row.messages_count ?? row.messages ?? 0);
    const price = numberOrZero(row.price);
    const mileage = numberOrZero(row.mileage || row.kilometers || row.km);
    const title = clean(row.title || buildVehicleTitle(row) || 'Vehicle Listing');
    const imageUrl = clean(row.image_url || row.cover_photo || row.coverImage || row.photo || row.photos?.[0]) || placeholderVehicleImage(title);
    const status = clean(row.status || 'posted').toLowerCase();
    const lifecycleStatus = clean(row.lifecycle_status || row.review_status || '').toLowerCase();
    return {
      id: clean(row.id || row.marketplace_listing_id || row.source_url || cryptoRandomFallback()),
      vin: clean(row.vin || ''),
      stock_number: clean(row.stock_number || row.stockNumber || ''),
      source_url: clean(row.source_url || row.sourceUrl || ''),
      image_url: imageUrl,
      year: numberOrZero(row.year),
      make: clean(row.make || ''),
      model: clean(row.model || ''),
      trim: clean(row.trim || ''),
      body_style: clean(row.body_style || row.bodyStyle || ''),
      exterior_color: clean(row.exterior_color || row.exteriorColor || row.color || ''),
      fuel_type: clean(row.fuel_type || row.fuelType || ''),
      mileage,
      price,
      title,
      status,
      lifecycle_status: lifecycleStatus,
      review_bucket: clean(row.review_bucket || ''),
      posted_at: postedAt,
      created_at: row.created_at || postedAt,
      updated_at: row.updated_at || postedAt,
      views_count: views,
      messages_count: messages,
      popularity_score: (messages * 1000) + (views * 10) + getTimestamp(postedAt) / 100000000
    };
  }

  function buildDashboardSummaryFromListings(listings) {
    const now = new Date();
    const todayKey = toDateKey(now);
    let postsToday = 0;
    let postsMonth = 0;
    let activeListings = 0;
    let totalViews = 0;
    let totalMessages = 0;
    let staleListings = 0;
    let reviewDeleteCount = 0;
    let reviewPriceChangeCount = 0;
    let reviewNewCount = 0;
    for (const item of listings) {
      const itemDate = new Date(item.posted_at);
      if (!Number.isNaN(itemDate.getTime())) {
        if (toDateKey(itemDate) === todayKey) postsToday += 1;
        if (itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear()) postsMonth += 1;
      }
      if (!['sold', 'deleted', 'inactive'].includes(item.status)) activeListings += 1;
      totalViews += numberOrZero(item.views_count);
      totalMessages += numberOrZero(item.messages_count);
      if (item.lifecycle_status === 'stale') staleListings += 1;
      if (item.lifecycle_status === 'review_delete' || item.review_bucket === 'removedVehicles') reviewDeleteCount += 1;
      if (item.lifecycle_status === 'review_price_update' || item.review_bucket === 'priceChanges') reviewPriceChangeCount += 1;
      if (item.lifecycle_status === 'review_new' || item.review_bucket === 'newVehicles') reviewNewCount += 1;
    }
    const topListing = [...listings].sort((a, b) => b.popularity_score - a.popularity_score)[0] || null;
    return {
      posts_today: postsToday,
      posts_this_month: postsMonth,
      active_listings: activeListings,
      total_views: totalViews,
      total_messages: totalMessages,
      stale_listings: staleListings,
      review_delete_count: reviewDeleteCount,
      review_price_change_count: reviewPriceChangeCount,
      review_new_count: reviewNewCount,
      review_queue_count: reviewDeleteCount + reviewPriceChangeCount + reviewNewCount,
      queue_count: 0,
      top_listing_title: topListing?.title || 'None yet',
      account_snapshot: {},
      setup_status: {}
    };
  }

  function mergeSummaryWithListings(summary, listings) {
    const computed = buildDashboardSummaryFromListings(listings);
    return {
      posts_today: numberOrZero(summary.posts_today ?? computed.posts_today),
      posts_this_month: numberOrZero(summary.posts_this_month ?? computed.posts_this_month),
      active_listings: numberOrZero(summary.active_listings ?? computed.active_listings),
      total_views: numberOrZero(summary.total_views ?? computed.total_views),
      total_messages: numberOrZero(summary.total_messages ?? computed.total_messages),
      stale_listings: numberOrZero(summary.stale_listings ?? computed.stale_listings),
      review_delete_count: numberOrZero(summary.review_delete_count ?? computed.review_delete_count),
      review_price_change_count: numberOrZero(summary.review_price_change_count ?? computed.review_price_change_count),
      review_new_count: numberOrZero(summary.review_new_count ?? computed.review_new_count),
      review_queue_count: numberOrZero(summary.review_queue_count ?? computed.review_queue_count),
      queue_count: numberOrZero(summary.queue_count ?? computed.queue_count),
      lifecycle_updated_at: clean(summary.lifecycle_updated_at || ''),
      top_listing_title: clean(summary.top_listing_title || computed.top_listing_title || 'None yet'),
      account_snapshot: summary.account_snapshot || {},
      setup_status: summary.setup_status || {},
      affiliate: summary.affiliate || {},
      credits: summary.credits || {},
      roi_snapshot: summary.roi_snapshot || {},
      alerts: Array.isArray(summary.alerts) ? summary.alerts : []
    };
  }

  function renderDashboardAnalytics() {
    const summary = state.dashboardSummary || {};
    setTextByIdForAll('kpiActiveListings', String(numberOrZero(summary.active_listings)));
    setTextByIdForAll('kpiViews', String(numberOrZero(summary.total_views)));
    setTextByIdForAll('kpiMessages', String(numberOrZero(summary.total_messages)));
    setTextByIdForAll('kpiReviewQueue', String(numberOrZero(summary.review_queue_count)));
    setTextByIdForAll('kpiStaleListings', String(numberOrZero(summary.stale_listings)));
    setTextByIdForAll('kpiPriceChanges', String(numberOrZero(summary.review_price_change_count)));
    setTextByIdForAll('kpiQueuedVehicles', String(numberOrZero(summary.queue_count)));
    setTextByIdForAll('kpiReviewNew', String(numberOrZero(summary.review_new_count)));
    setTextByIdForAll('kpiReviewDelete', String(numberOrZero(summary.review_delete_count)));

    const postsToday = numberOrZero(summary.posts_today);
    const postingLimit = numberOrZero(state.currentNormalizedSession?.subscription?.posting_limit || summary.account_snapshot?.posting_limit || 0);
    const postsRemaining = Math.max(0, numberOrZero(state.currentNormalizedSession?.subscription?.posts_remaining ?? (postingLimit - postsToday)));
    const timeSavedToday = numberOrZero(summary.roi_snapshot?.estimated_minutes_saved_today || (postsToday * 18));

    setTextByIdForAll('kpiPostsRemaining', String(postsRemaining));
    setTextByIdForAll('overviewTimeSavedToday', `${timeSavedToday} min`);
    setTextByIdForAll('analyticsTimeSavedToday', `${timeSavedToday} min`);
    setTextByIdForAll('analyticsTimeSavedWeek', `${numberOrZero(summary.roi_snapshot?.estimated_minutes_saved_week || (timeSavedToday * 4))} min`);
    setTextByIdForAll('analyticsEstimatedValue', formatCurrency(numberOrZero(summary.roi_snapshot?.estimated_value_saved || (timeSavedToday / 2))));
    setTextByIdForAll('analyticsEfficiencyScore', `${postingLimit > 0 ? Math.min(100, Math.round((postsToday / postingLimit) * 100)) : 0}%`);

    renderTopListings(state.dashboardListings);
    renderRecentActivity(state.dashboardListings);
    renderOverviewOperatorPanel();
    renderAffiliateCenter();
    renderIntelligencePanels();
    renderScorecards();
    drawActivityChart(buildChartSeries());
  }

  function renderOverviewOperatorPanel() {
    const summary = state.dashboardSummary || {};
    const postsToday = numberOrZero(summary.posts_today);
    const postingLimit = numberOrZero(state.currentNormalizedSession?.subscription?.posting_limit || summary.account_snapshot?.posting_limit || 0);
    const postsRemaining = Math.max(0, numberOrZero(state.currentNormalizedSession?.subscription?.posts_remaining ?? (postingLimit - postsToday)));
    const readyQueue = numberOrZero(summary.queue_count);
    const reviewQueue = numberOrZero(summary.review_queue_count);
    const staleListings = numberOrZero(summary.stale_listings);
    const weakListings = numberOrZero(summary.weak_listings);
    const needsAction = numberOrZero(summary.needs_action_count);
    const accessActive = Boolean(state.currentNormalizedSession?.subscription?.active);

    setTextByIdForAll('overviewPlanChip', clean(state.currentNormalizedSession?.subscription?.plan || 'Founder Beta'));
    setTextByIdForAll('overviewAccessChip', accessActive ? 'Active Access' : 'Access Needs Attention');
    setTextByIdForAll('commandPostsUsed', `${postsToday} / ${postingLimit}`);
    setTextByIdForAll('commandReadyQueue', String(readyQueue));
    setTextByIdForAll('commandRevenueAttention', String(reviewQueue + staleListings + weakListings + needsAction));
    setTextByIdForAll('snapshotPostsRemaining', String(postsRemaining));
    setTextByIdForAll('snapshotQueuedVehicles', String(readyQueue));
    setTextByIdForAll('snapshotProfileComplete', profileLooksComplete(state.currentProfile) ? 'Ready' : 'Needs setup');

    const sub = document.getElementById('commandCenterSubtext');
    if (sub) {
      sub.textContent = accessActive
        ? `You have ${postsRemaining} post${postsRemaining === 1 ? '' : 's'} left today with ${readyQueue} vehicle${readyQueue === 1 ? '' : 's'} in queue.`
        : 'Access needs attention before posting.';
    }

    const blockers = document.getElementById('overviewBlockers');
    if (blockers) {
      blockers.innerHTML = `
        <strong>Posts:</strong> ${postsToday}/${postingLimit} &nbsp;•&nbsp;
        <strong>Remaining:</strong> ${postsRemaining} &nbsp;•&nbsp;
        <strong>Review Queue:</strong> ${reviewQueue} &nbsp;•&nbsp;
        <strong>Stale:</strong> ${staleListings}
      `;
    }

    const actionList = document.getElementById('overviewActionList');
    if (actionList) {
      actionList.innerHTML = `
        <div class="overview-action-item">${reviewQueue > 0 ? `${reviewQueue} listing(s) need review.` : 'No urgent review queue.'}</div>
        <div class="overview-action-item">${staleListings > 0 ? `${staleListings} listing(s) are stale and need refresh.` : 'No stale listing pressure right now.'}</div>
        <div class="overview-action-item">${profileLooksComplete(state.currentProfile) ? 'Profile and compliance data are present.' : 'Finish dealer/compliance setup before pushing scale.'}</div>
      `;
    }
  }

  function renderAffiliateCenter() {
    const affiliate = state.dashboardSummary?.affiliate || {};
    setTextByIdForAll('referralCode', clean(affiliate.referral_code || 'Not assigned yet'));
    setTextByIdForAll('referralCodeAffiliate', clean(affiliate.referral_code || 'Not assigned yet'));
    setTextByIdForAll('affiliatePartnerType', clean(affiliate.partner_type || 'Founding Partner'));
    setTextByIdForAll('affiliateDirectCommission', `${numberOrZero(affiliate.direct_commission_percent || 20)}% recurring`);
    setTextByIdForAll('affiliateTierOverride', `${numberOrZero(affiliate.second_level_override_percent || 5)}% second level`);
    setTextByIdForAll('affiliatePayoutStatus', clean(affiliate.payout_status || 'Manual founder-stage payouts'));
    setTextByIdForAll('affiliateCommissionEarned', formatCurrency(numberOrZero(affiliate.commission_earned)));
    setTextByIdForAll('affiliatePendingPayout', formatCurrency(numberOrZero(affiliate.pending_payout)));
    setTextByIdForAll('affiliateTotalReferrals', String(numberOrZero(affiliate.total_referrals)));
    setTextByIdForAll('affiliateActiveReferrals', String(numberOrZero(affiliate.active_referrals)));
    setTextByIdForAll('affiliateEstimatedMRR', formatCurrency(numberOrZero(affiliate.estimated_mrr_commission)));
    setTextByIdForAll('affiliatePaidOutAllTime', formatCurrency(numberOrZero(affiliate.paid_out_all_time)));
  }

  function renderIntelligencePanels() {
    const alertsWrap = document.getElementById('alertsPanel');
    if (alertsWrap) {
      const alerts = Array.isArray(state.dashboardSummary?.alerts) ? state.dashboardSummary.alerts : [];
      alertsWrap.innerHTML = alerts.length ? alerts.map((a) => `<div>${escapeHtml(a.title || a.message || 'Alert')}</div>`).join('') : '<div>No active alerts right now.</div>';
    }
    const oppWrap = document.getElementById('opportunitiesPanel');
    if (oppWrap) oppWrap.innerHTML = `<div><strong>Top Listing:</strong> ${escapeHtml(clean(state.dashboardSummary?.top_listing_title || 'None yet'))}</div>`;
    const intelWrap = document.getElementById('intelligencePanel');
    if (intelWrap) intelWrap.innerHTML = `<div><strong>Active Listings:</strong> ${numberOrZero(state.dashboardSummary?.active_listings)}</div><div><strong>Total Views:</strong> ${numberOrZero(state.dashboardSummary?.total_views)}</div>`;
  }

  function renderScorecards() {
    const daily = document.getElementById('dailyScorecardPanel');
    if (daily) daily.innerHTML = `<div><strong>Posts Today:</strong> ${numberOrZero(state.dashboardSummary?.posts_today)}</div><div><strong>Views:</strong> ${numberOrZero(state.dashboardSummary?.total_views)}</div><div><strong>Messages:</strong> ${numberOrZero(state.dashboardSummary?.total_messages)}</div>`;
    const weekly = document.getElementById('weeklyScorecardPanel');
    if (weekly) weekly.innerHTML = `<div><strong>Top Listing:</strong> ${escapeHtml(clean(state.dashboardSummary?.top_listing_title || 'None yet'))}</div><div><strong>Review Queue:</strong> ${numberOrZero(state.dashboardSummary?.review_queue_count)}</div>`;
  }

  function applyListingFiltersAndRender() {
    const searchTerm = clean((document.getElementById('listingSearchInput')?.value || '').toLowerCase());
    const sortMode = clean(document.getElementById('listingSortSelect')?.value || 'popular');
    let rows = [...state.dashboardListings];

    if (state.listingQuickFilter !== 'all') {
      rows = rows.filter((item) => {
        const lifecycle = clean(item.lifecycle_status).toLowerCase();
        const bucket = clean(item.review_bucket).toLowerCase();
        if (state.listingQuickFilter === 'review') return ['review_delete', 'review_price_update', 'review_new'].includes(lifecycle);
        if (state.listingQuickFilter === 'stale') return lifecycle === 'stale';
        if (state.listingQuickFilter === 'price') return lifecycle === 'review_price_update' || bucket === 'pricechanges';
        if (state.listingQuickFilter === 'new') return lifecycle === 'review_new' || bucket === 'newvehicles';
        if (state.listingQuickFilter === 'active') return !['sold', 'deleted', 'inactive'].includes(item.status);
        return true;
      });
    }

    if (searchTerm) {
      rows = rows.filter((item) => [item.title, item.make, item.model, item.trim, item.vin, item.stock_number].join(' ').toLowerCase().includes(searchTerm));
    }

    rows.sort((a, b) => {
      if (sortMode === 'newest') return getTimestamp(b.posted_at) - getTimestamp(a.posted_at);
      if (sortMode === 'price_high') return numberOrZero(b.price) - numberOrZero(a.price);
      if (sortMode === 'price_low') return numberOrZero(a.price) - numberOrZero(b.price);
      return numberOrZero(b.popularity_score) - numberOrZero(a.popularity_score);
    });

    state.filteredListings = rows;
    renderListingsGrid(rows);
  }

  function renderListingsGrid(listings) {
    const grid = document.getElementById('recentListingsGrid');
    if (!grid) return;
    if (!Array.isArray(listings) || !listings.length) {
      grid.innerHTML = '<div class="listing-empty">No listings available yet.</div>';
      return;
    }
    grid.innerHTML = listings.map((item) => `
      <article class="listing-card">
        <div class="listing-media">
          <img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='${escapeHtml(placeholderVehicleImage(item.title))}'" />
          <div class="listing-badge">${renderBadgeHtml(item.status, item.lifecycle_status)}</div>
        </div>
        <div class="listing-content">
          <div>
            <div class="listing-title">${escapeHtml(item.title)}</div>
            <div class="listing-sub">${escapeHtml(buildListingSubtitle(item))}</div>
          </div>
          <div class="listing-price">${formatCurrency(item.price)}</div>
          <div class="listing-metrics">
            <div class="metric-pill"><div class="metric-pill-label">Views</div><div class="metric-pill-value">${numberOrZero(item.views_count)}</div></div>
            <div class="metric-pill"><div class="metric-pill-label">Messages</div><div class="metric-pill-value">${numberOrZero(item.messages_count)}</div></div>
            <div class="metric-pill"><div class="metric-pill-label">Posted</div><div class="metric-pill-value">${formatShortDate(item.posted_at)}</div></div>
          </div>
          <div class="listing-actions">
            <button class="action-btn" type="button" onclick="openListingDetailModal('${escapeJs(item.id)}')">Inspect</button>
            <button class="action-btn" type="button" onclick="markListingAction('${escapeJs(item.id)}','approved')">Approve</button>
            <button class="action-btn" type="button" onclick="markListingSold('${escapeJs(item.id)}')">Mark Sold</button>
            <button class="action-btn" type="button" onclick="copyVehicleSummary('${escapeJs(item.id)}')">Copy Summary</button>
          </div>
        </div>
      </article>
    `).join('');
  }

  function renderTopListings(listings) {
    const wrap = document.getElementById('topListings');
    if (!wrap) return;
    const ranked = [...listings].sort((a, b) => numberOrZero(b.popularity_score) - numberOrZero(a.popularity_score)).slice(0, 4);
    if (!ranked.length) {
      wrap.innerHTML = '<div class="listing-empty">No listings yet.</div>';
      return;
    }
    wrap.innerHTML = ranked.map((item, index) => `
      <div class="top-list-item">
        <div class="top-rank">${index + 1}</div>
        <div class="top-thumb"><img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" /></div>
        <div class="top-info"><div class="top-title">${escapeHtml(item.title)}</div><div class="top-sub">${escapeHtml(formatCurrency(item.price))}</div></div>
        <div class="top-metrics"><div>👁 ${numberOrZero(item.views_count)}</div><div>💬 ${numberOrZero(item.messages_count)}</div></div>
      </div>
    `).join('');
  }

  function renderRecentActivity(listings) {
    const wrap = document.getElementById('recentActivityFeed');
    if (!wrap) return;
    const rows = [...listings].sort((a, b) => getTimestamp(b.posted_at) - getTimestamp(a.posted_at)).slice(0, 6);
    wrap.innerHTML = rows.length
      ? rows.map((item) => `<div class="activity-item"><div><div class="activity-item-title">${escapeHtml(item.title)}</div><div class="activity-item-sub">${escapeHtml(item.lifecycle_status || item.status || 'posted')}</div></div><div class="activity-item-time">${escapeHtml(formatRelativeOrDate(item.posted_at))}</div></div>`).join('')
      : '<div class="listing-empty">No activity yet.</div>';
  }

  function buildChartSeries() {
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push({ key: toDateKey(d), label: d.toLocaleDateString(undefined, { weekday: 'short' }), posts: 0, views: 0 });
    }
    const map = new Map(days.map((d) => [d.key, d]));
    for (const item of state.dashboardListings) {
      const key = toDateKey(item.posted_at);
      const bucket = map.get(key);
      if (!bucket) continue;
      bucket.posts += 1;
      bucket.views += numberOrZero(item.views_count);
    }
    const labelsWrap = document.getElementById('graphXLabels');
    if (labelsWrap) labelsWrap.innerHTML = days.map((d) => `<div>${escapeHtml(d.label)}</div>`).join('');
    return days;
  }

  function drawActivityChart(series) {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(300, Math.floor(rect.width));
    const height = Math.max(180, Math.floor(rect.height));
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!Array.isArray(series) || !series.length) return;
    const padding = { top: 18, right: 18, bottom: 18, left: 18 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maxPosts = Math.max(1, ...series.map((d) => numberOrZero(d.posts)));
    const maxViews = Math.max(1, ...series.map((d) => numberOrZero(d.views)));
    const maxValue = Math.max(maxPosts, maxViews);
    const xStep = chartWidth / Math.max(1, series.length - 1);
    const pointsPosts = series.map((d, index) => ({ x: padding.left + (index * xStep), y: padding.top + chartHeight - ((numberOrZero(d.posts) / maxValue) * chartHeight) }));
    const pointsViews = series.map((d, index) => ({ x: padding.left + (index * xStep), y: padding.top + chartHeight - ((numberOrZero(d.views) / maxValue) * chartHeight) }));
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(212, 175, 55, 0.10)';
    ctx.beginPath();
    ctx.moveTo(pointsViews[0].x, padding.top + chartHeight);
    pointsViews.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pointsViews[pointsViews.length - 1].x, padding.top + chartHeight);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(243, 221, 176, 0.78)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    pointsViews.forEach((p, index) => { if (index === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.stroke();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.beginPath();
    pointsPosts.forEach((p, index) => { if (index === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.stroke();
  }

  async function pushExtensionProfileSync() {
    try {
      const payload = {
        profile: state.currentProfile || {},
        session: state.currentNormalizedSession || buildFallbackSessionFromLocalState()
      };
      window.postMessage({ type: 'ELEVATE_PROFILE_SYNC', payload }, '*');
      setStatus('extensionActionStatus', 'Dealer profile sync pushed to extension.');
    } catch (error) {
      console.error(error);
      setStatus('extensionActionStatus', 'Failed to push profile sync.');
    }
  }

  function showSection(sectionId) {
    document.querySelectorAll('.dashboard-section').forEach((section) => {
      section.style.display = section.id === sectionId ? 'block' : 'none';
    });
    document.querySelectorAll('[data-section]').forEach((button) => {
      button.classList.toggle('active', button.getAttribute('data-section') === sectionId);
    });
    const pageTitle = document.getElementById('dashboardPageTitle');
    if (pageTitle) {
      pageTitle.textContent = ({ overview: 'Elevate Operator Console', profile: 'Setup', extension: 'Tools', compliance: 'Compliance', affiliate: 'Partners', billing: 'Billing', tools: 'Analytics' }[sectionId] || 'Dashboard');
    }
  }

  function renderUserBasics(user) {
    setTextForAll('.user-email', user.email || '');
    setTextForAll('.user-id', user.id || '');
    const welcomeText = document.getElementById('welcomeText');
    if (welcomeText) welcomeText.textContent = `Welcome, ${user.email || 'Operator'}`;
  }

  function renderProfileSummary(profile) {
    const summaryEl = document.getElementById('profileSummary');
    if (!summaryEl) return;
    const p = profile || {};
    summaryEl.innerHTML = `
      <div><strong>Name:</strong> ${escapeHtml(p.full_name || 'Not set')}</div>
      <div><strong>Dealership:</strong> ${escapeHtml(p.dealership || 'Not set')}</div>
      <div><strong>City:</strong> ${escapeHtml(p.city || 'Not set')}</div>
      <div><strong>Province:</strong> ${escapeHtml(p.province || 'Not set')}</div>
      <div><strong>Phone:</strong> ${escapeHtml(p.phone || 'Not set')}</div>
      <div><strong>Compliance License Number:</strong> ${escapeHtml(p.license_number || 'Not set')}</div>
      <div><strong>Default Listing Location:</strong> ${escapeHtml(p.listing_location || 'Not set')}</div>
      <div><strong>Dealer Website:</strong> ${escapeHtml(p.dealer_website || 'Not set')}</div>
      <div><strong>Inventory URL:</strong> ${escapeHtml(p.inventory_url || 'Not set')}</div>
      <div><strong>Scanner Type:</strong> ${escapeHtml(p.scanner_type || 'Not set')}</div>
    `;
  }

  function populateComplianceSummary(profile) {
    const p = profile || {};
    setTextByIdForAll('complianceProvinceDisplay', p.province || 'Not set');
    setTextByIdForAll('complianceModeDisplay', p.compliance_mode || p.province || 'Not set');
    setTextByIdForAll('complianceLicenseDisplay', p.license_number || 'Not set');
    setTextByIdForAll('complianceDealerContactDisplay', [p.dealer_phone || p.phone || '', p.dealer_email || ''].filter(Boolean).join(' • ') || 'Not set');
  }

  function renderAccessState(session) {
    const subscription = getCanonicalSubscriptionState(session);
    setTextByIdForAll('accessBadgeBilling', subscription.active ? 'Active Access' : 'Inactive Access');
    setTextByIdForAll('planNameBilling', subscription.plan || 'Founder Beta');
    setTextByIdForAll('subscriptionStatusBilling', subscription.status || 'inactive');
    document.querySelectorAll('#accessBadgeBilling').forEach((el) => {
      el.classList.remove('active', 'inactive', 'warn');
      el.classList.add(subscription.active ? 'active' : 'inactive');
    });
  }

  function renderExtensionControl(session, profile) {
    const subscription = getCanonicalSubscriptionState(session);
    const p = profile || {};
    setTextByIdForAll('extensionRemainingPosts', String(numberOrZero(subscription.posts_remaining)));
    setTextByIdForAll('extensionScannerType', p.scanner_type || 'Not set');
    setTextByIdForAll('extensionDealerWebsite', p.dealer_website || 'Not set');
    setTextByIdForAll('extensionInventoryUrl', p.inventory_url || 'Not set');
    setTextByIdForAll('extensionListingLocation', p.listing_location || 'Not set');
    setTextByIdForAll('extensionComplianceMode', p.compliance_mode || p.province || 'Not set');
    setTextByIdForAll('extensionPlan', subscription.plan || 'Founder Beta');
    setTextByIdForAll('extensionPostsUsed', String(numberOrZero(subscription.posts_today)));
    setTextByIdForAll('extensionPostLimit', String(numberOrZero(subscription.posting_limit)));
    setTextByIdForAll('extensionAccessState', subscription.active ? 'Active Access' : 'Inactive Access');
  }

  function updateSetupStates(profile, session) {
    const subscription = getCanonicalSubscriptionState(session);
    const p = profile || {};
    setSetupState('setupDealerWebsite', Boolean(p.dealer_website));
    setSetupState('setupInventoryUrl', Boolean(p.inventory_url));
    setSetupState('setupScannerType', Boolean(p.scanner_type));
    setSetupState('setupListingLocation', Boolean(p.listing_location));
    setSetupState('setupComplianceMode', Boolean(p.compliance_mode || p.province));
    setSetupState('setupAccess', Boolean(subscription.active));
    setSetupState('extSetupDealerWebsite', Boolean(p.dealer_website));
    setSetupState('extSetupInventoryUrl', Boolean(p.inventory_url));
    setSetupState('extSetupScannerType', Boolean(p.scanner_type));
    setSetupState('extSetupListingLocation', Boolean(p.listing_location));
    setSetupState('extSetupComplianceMode', Boolean(p.compliance_mode || p.province));
    setSetupState('extSetupAccess', Boolean(subscription.active));
  }

  function renderSetupWorkspace(profile) {
    const p = profile || {};
    const readyCount = [p.full_name, p.dealership, p.dealer_website, p.inventory_url, p.scanner_type, p.listing_location, p.compliance_mode || p.province].filter(Boolean).length;
    const percent = Math.round((readyCount / 7) * 100);
    setTextByIdForAll('setupReadinessPercent', `${percent}%`);
    setTextByIdForAll('setupReadinessSummary', `${readyCount}/7 setup checkpoints are ready.`);
    const blockers = [];
    if (!p.dealer_website) blockers.push('Dealer website missing');
    if (!p.inventory_url) blockers.push('Inventory URL missing');
    if (!p.scanner_type) blockers.push('Scanner type missing');
    if (!(p.compliance_mode || p.province)) blockers.push('Compliance mode missing');
    const blockersEl = document.getElementById('setupBlockersList');
    if (blockersEl) blockersEl.innerHTML = blockers.length ? blockers.map((b) => `<div>• ${escapeHtml(b)}</div>`).join('') : '<div>No setup blockers remain.</div>';
    const nextEl = document.getElementById('setupNextStepPanel');
    if (nextEl) nextEl.innerHTML = blockers.length ? `<div><strong>Next step:</strong> ${escapeHtml(blockers[0])}</div>` : '<div><strong>Setup complete.</strong> Move into Tools and Analytics.</div>';
  }

  function renderComplianceWorkspace(profile) {
    const p = profile || {};
    const blockers = [];
    if (!(p.province || p.compliance_mode)) blockers.push('Province or compliance mode missing');
    if (!p.license_number) blockers.push('License number missing');
    if (!p.dealership) blockers.push('Dealership name missing');
    const statusEl = document.getElementById('complianceStatusPanel');
    if (statusEl) statusEl.innerHTML = blockers.length ? `<div class="status-line warn"><strong>Not ready to publish.</strong> ${escapeHtml(blockers.join(' • '))}</div>` : '<div class="status-line success"><strong>Compliance ready.</strong> Profile data is present for dealer footer and province output.</div>';
    const footerEl = document.getElementById('complianceFooterPreview');
    if (footerEl) footerEl.textContent = buildComplianceFooterPreview(p);
    const descEl = document.getElementById('complianceDescriptionPreview');
    if (descEl) descEl.textContent = (p.compliance_mode || p.province || '').toUpperCase().startsWith('AB') ? 'AB / Alberta output ready.' : ((p.compliance_mode || p.province || '').toUpperCase().startsWith('BC') ? 'BC output ready.' : 'Select a compliance mode to preview output.');
    const blockerEl = document.getElementById('complianceBlockersList');
    if (blockerEl) blockerEl.innerHTML = blockers.length ? blockers.map((b) => `<div>• ${escapeHtml(b)}</div>`).join('') : '<div>• Province logic present</div><div>• License field present</div><div>• Dealer contact block available</div>';
  }

  function renderToolsWorkspace(profile, session) {
    const subscription = getCanonicalSubscriptionState(session);
    const p = profile || {};
    const blockers = [];
    if (!subscription.active) blockers.push('Access inactive');
    if (!p.inventory_url) blockers.push('Inventory URL missing');
    if (!p.scanner_type) blockers.push('Scanner type missing');
    if (!(p.compliance_mode || p.province)) blockers.push('Compliance mode missing');
    const statusEl = document.getElementById('toolsSystemStatusPanel');
    if (statusEl) statusEl.innerHTML = blockers.length ? `<div><strong>Ready to Post:</strong> No</div><div class="subtext">${escapeHtml(blockers.join(' • '))}</div>` : '<div><strong>Ready to Post:</strong> Yes</div><div class="subtext">Routing, compliance, and access checks are present for beta operation.</div>';
    const nextEl = document.getElementById('toolsNextStepPanel');
    if (nextEl) nextEl.innerHTML = blockers.length ? `<div><strong>Next step:</strong> ${escapeHtml(blockers[0])}</div>` : '<div><strong>Next step:</strong> Open inventory or Marketplace and run the posting flow.</div>';
  }

  function renderBillingSection() {
    const subscription = getCanonicalSubscriptionState(state.currentNormalizedSession);
    setTextByIdForAll('licenseKeyDisplay', clean(subscription.license_key || 'Auto-assignment pending'));
    setTextByIdForAll('licenseKeyDisplayBilling', clean(subscription.license_key || 'Auto-assignment pending'));
  }

  async function signOutUser() {
    try {
      await state.supabaseClient.auth.signOut();
      redirectToLogin();
    } catch (error) {
      console.error('signOutUser error:', error);
    }
  }

  function redirectToLogin() {
    window.location.href = '/login.html';
  }

  async function markListingSold(listingId) {
    await markListingAction(listingId, 'sold');
  }

  async function markListingAction(listingId, status) {
    try {
      await apiFetch('/api/update-listing-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, status, userId: state.currentUser?.id || '', email: state.currentUser?.email || '' })
      });
    } catch (error) {
      console.warn('markListingAction warning:', error);
    }
    await loadListingDashboardData(true);
  }

  function copyVehicleSummary(listingId) {
    const row = state.dashboardListings.find((item) => String(item.id) === String(listingId));
    if (!row) return;
    const text = [row.title, `Price: ${formatCurrency(row.price)}`, `Mileage: ${formatMileage(row.mileage)}`, `VIN: ${row.vin || 'Not set'}`, `Stock: ${row.stock_number || 'Not set'}`, `Posted: ${formatShortDate(row.posted_at)}`].join('\n');
    navigator.clipboard.writeText(text).then(() => setStatus('listingGridStatus', 'Vehicle summary copied.')).catch(() => setStatus('listingGridStatus', 'Could not copy vehicle summary.'));
  }

  async function trackListingView() { setStatus('listingGridStatus', 'Manual view logging has been disabled in this hotfix build.'); }
  async function trackListingMessage() { setStatus('listingGridStatus', 'Manual message logging has been disabled in this hotfix build.'); }
  async function syncListingTraction() { setStatus('listingGridStatus', 'Traction sync is disabled in this hotfix build.'); }
  function openListingSource(listingId, sourceUrl) { if (sourceUrl) window.open(sourceUrl, '_blank'); else setStatus('listingGridStatus', `Listing ${listingId} has no source URL.`); }

  function openListingDetailModal(listingId) {
    const item = state.dashboardListings.find((row) => String(row.id) === String(listingId));
    if (!item) return;
    state.currentListingDetail = item;
    const modal = document.getElementById('listingDetailModal');
    const title = document.getElementById('listingDetailTitle');
    const subtitle = document.getElementById('listingDetailSubtitle');
    const body = document.getElementById('listingDetailBody');
    if (!modal || !title || !subtitle || !body) return;
    title.textContent = buildVehicleTitle(item);
    subtitle.textContent = `${item.lifecycle_status || item.status || 'posted'} • ${formatCurrency(item.price)}`;
    body.innerHTML = `
      <div><strong>Views:</strong> ${numberOrZero(item.views_count)}</div>
      <div><strong>Messages:</strong> ${numberOrZero(item.messages_count)}</div>
      <div><strong>Mileage:</strong> ${escapeHtml(formatMileage(item.mileage))}</div>
      <div><strong>VIN:</strong> ${escapeHtml(item.vin || 'Not set')}</div>
      <div><strong>Stock:</strong> ${escapeHtml(item.stock_number || 'Not set')}</div>
      <div><strong>Lifecycle:</strong> ${escapeHtml(item.lifecycle_status || item.status || 'posted')}</div>
    `;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function buildFallbackSessionFromLocalState() {
    const email = clean(state.currentUser?.email || '');
    const forceTestingAccess = email.toLowerCase() === 'damian044@icloud.com';
    return {
      user: { id: state.currentUser?.id || '', email },
      subscription: {
        active: forceTestingAccess,
        access_granted: forceTestingAccess,
        status: forceTestingAccess ? 'active' : 'inactive',
        plan: 'Founder Beta',
        posting_limit: forceTestingAccess ? 25 : 5,
        posts_today: 0,
        posts_remaining: forceTestingAccess ? 25 : 5,
        license_key: clean(state.currentProfile?.software_license_key || '')
      },
      dealership: {
        name: clean(state.currentProfile?.dealership || ''),
        inventory_url: clean(state.currentProfile?.inventory_url || ''),
        website: clean(state.currentProfile?.dealer_website || '')
      },
      profile: { ...(state.currentProfile || {}) }
    };
  }

  function normalizeExtensionStateResponse(result, user, profile) {
    const raw = result?.session ? result.session : (result || {});
    const subscription = raw.subscription || {};
    return {
      user: { id: user?.id || '', email: user?.email || '' },
      subscription: {
        active: Boolean(subscription.active || clean(subscription.status).toLowerCase() === 'active' || clean(subscription.status).toLowerCase() === 'trialing'),
        access_granted: Boolean(subscription.access_granted || subscription.active || clean(subscription.status).toLowerCase() === 'active'),
        status: clean(subscription.normalized_status || subscription.status || 'inactive') || 'inactive',
        plan: clean(subscription.normalized_plan || subscription.plan || subscription.plan_name || 'Founder Beta') || 'Founder Beta',
        posting_limit: numberOrZero(subscription.posting_limit || subscription.daily_posting_limit || 5),
        posts_today: numberOrZero(subscription.posts_today),
        posts_remaining: numberOrZero(subscription.posts_remaining ?? Math.max(numberOrZero(subscription.posting_limit || 5) - numberOrZero(subscription.posts_today), 0)),
        license_key: clean(subscription.license_key || subscription.software_license_key || '')
      },
      dealership: {
        name: clean(raw.dealership?.name || raw.dealership?.dealer_name || profile?.dealership || ''),
        inventory_url: clean(raw.dealership?.inventory_url || profile?.inventory_url || ''),
        website: clean(raw.dealership?.website || profile?.dealer_website || ''),
        province: clean(raw.dealership?.province || profile?.province || ''),
        scanner_type: clean(raw.dealership?.scanner_type || profile?.scanner_type || '')
      },
      profile: { ...(profile || {}), ...(raw.profile || {}) }
    };
  }

  function getCanonicalSubscriptionState(session) {
    const sub = session?.subscription || buildFallbackSessionFromLocalState().subscription;
    return {
      active: Boolean(sub.active || sub.access_granted),
      status: clean(sub.status || 'inactive'),
      plan: clean(sub.plan || 'Founder Beta'),
      posting_limit: numberOrZero(sub.posting_limit || 5),
      posts_today: numberOrZero(sub.posts_today),
      posts_remaining: numberOrZero(sub.posts_remaining ?? Math.max(numberOrZero(sub.posting_limit || 5) - numberOrZero(sub.posts_today), 0)),
      license_key: clean(sub.license_key || '')
    };
  }

  function profileLooksComplete(profile) {
    const p = profile || {};
    return Boolean(p.full_name && p.dealership && p.inventory_url && (p.compliance_mode || p.province));
  }

  function populateProfileForm(profile) {
    const p = profile || {};
    setFieldValue('full_name', p.full_name || '');
    setFieldValue('dealership', p.dealership || '');
    setFieldValue('city', p.city || '');
    setFieldValue('province', p.province || '');
    setFieldValue('phone', p.phone || '');
    setFieldValue('license_number', p.license_number || '');
    setFieldValue('listing_location', p.listing_location || '');
    setFieldValue('dealer_phone', p.dealer_phone || '');
    setFieldValue('dealer_email', p.dealer_email || '');
    setFieldValue('compliance_mode', p.compliance_mode || '');
    setFieldValue('dealer_website', p.dealer_website || '');
    setFieldValue('inventory_url', p.inventory_url || '');
    setFieldValue('scanner_type', p.scanner_type || '');
    setFieldValue('software_license_key', p.software_license_key || '');
  }

  function buildSetupStepsText() {
    const p = state.currentProfile || {};
    const sub = getCanonicalSubscriptionState(state.currentNormalizedSession);
    return [
      'Elevate Automation Setup',
      '',
      `Access: ${sub.active ? 'Active' : 'Inactive'}`,
      `Plan: ${sub.plan || 'Founder Beta'}`,
      `Dealer Website: ${p.dealer_website || 'Not set'}`,
      `Inventory URL: ${p.inventory_url || 'Not set'}`,
      `Scanner Type: ${p.scanner_type || 'Not set'}`,
      `Listing Location: ${p.listing_location || 'Not set'}`,
      `Compliance Mode: ${p.compliance_mode || p.province || 'Not set'}`,
      '',
      'Steps:',
      '1. Install or reload the Elevate Automation extension.',
      '2. Refresh extension access in the dashboard.',
      '3. Open your saved inventory URL.',
      '4. Run scan and queue a vehicle.',
      '5. Open Facebook Marketplace vehicle creation.',
      '6. Load next queued vehicle and run autofill.'
    ].join('\n');
  }

  function buildComplianceFooterPreview(profile) {
    const p = profile || {};
    const lines = [];
    if (p.dealership) lines.push(p.dealership);
    if (p.listing_location) lines.push(p.listing_location);
    if (p.dealer_phone || p.phone) lines.push(p.dealer_phone || p.phone);
    if (p.dealer_email) lines.push(p.dealer_email);
    if ((p.compliance_mode || p.province || '').toUpperCase().startsWith('AB')) lines.push('AMVIC Licensed Business. Pricing plus taxes and fees as applicable.');
    if ((p.compliance_mode || p.province || '').toUpperCase().startsWith('BC')) lines.push('Licensed dealer. Pricing and documentation subject to BC dealer requirements.');
    return lines.filter(Boolean).join('\n') || 'Dealer footer preview will appear here once setup is complete.';
  }

  function renderSetupSnapshot() {
    const summary = state.dashboardSummary || {};
    setTextByIdForAll('snapshotLifecycleUpdatedAt', clean(summary.lifecycle_updated_at || '—'));
  }

  function resolveExtensionDownloadUrl() {
    return Promise.resolve(EXTENSION_DOWNLOAD_URL || EXTENSION_FALLBACK_URL);
  }

  function onClick(id, handler) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', async (event) => {
      event.preventDefault();
      await handler(event);
    });
  }

  function setSetupState(id, ready) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = ready ? 'Ready' : 'Needs Setup';
    el.classList.remove('good', 'warn');
    el.classList.add(ready ? 'good' : 'warn');
  }

  function setBootStatus(text) {
    const el = document.getElementById('bootStatus');
    if (el) el.textContent = text || '';
  }

  function pushBootStage(stage, detail) {
    state.bootStages.push(`${stage}: ${detail}`);
    state.bootStages = state.bootStages.slice(-5);
    setBootStatus(state.bootStages.join('  |  '));
  }

  function setStatus(id, text) {
    document.querySelectorAll(`#${id}`).forEach((el) => { el.textContent = text || ''; });
  }

  function setTextForAll(selector, text) {
    document.querySelectorAll(selector).forEach((el) => { el.textContent = text || ''; });
  }

  function setTextByIdForAll(id, text) {
    document.querySelectorAll(`#${id}`).forEach((el) => { el.textContent = text || ''; });
  }

  function getFieldValue(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  function normalizeUrlInput(value) {
    const raw = clean(value);
    if (!raw) return '';
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  }

  function safeJson(text) {
    try { return JSON.parse(text || '{}'); } catch { return {}; }
  }

  function formatCurrency(value) {
    const n = numberOrZero(value);
    if (!n) return '$0';
    try {
      return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
    } catch {
      return `$${n.toLocaleString()}`;
    }
  }

  function formatMileage(value) {
    const n = numberOrZero(value);
    return n ? `${n.toLocaleString()} km` : 'Not set';
  }

  function buildVehicleTitle(item) {
    return [item.year || '', item.make || '', item.model || '', item.trim || ''].filter(Boolean).join(' ').trim() || 'Vehicle Listing';
  }

  function buildListingSubtitle(item) {
    return [item.stock_number ? `Stock ${item.stock_number}` : '', item.vin ? `VIN ${item.vin}` : '', item.body_style || '', item.lifecycle_status || ''].filter(Boolean).join(' • ') || 'Vehicle details';
  }

  function renderBadgeHtml(status, lifecycleStatus = '') {
    if (lifecycleStatus === 'stale') return '<span class="badge warn">Stale</span>';
    if (lifecycleStatus === 'review_delete') return '<span class="badge warn">Review Delete</span>';
    if (lifecycleStatus === 'review_price_update') return '<span class="badge warn">Review Price</span>';
    if (lifecycleStatus === 'review_new') return '<span class="badge active">Review New</span>';
    const normalized = clean(status || 'posted').toLowerCase();
    if (normalized === 'sold') return '<span class="badge sold">Sold</span>';
    if (['inactive', 'failed', 'deleted'].includes(normalized)) return `<span class="badge inactive">${escapeHtml(normalized)}</span>`;
    return `<span class="badge active">${escapeHtml(normalized === 'posted' ? 'Posted' : 'Active')}</span>`;
  }

  function formatShortDate(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function formatRelativeOrDate(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    const diffMs = Date.now() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatShortDate(value);
  }

  function toDateKey(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getTimestamp(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function numberOrZero(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function placeholderVehicleImage(label) {
    return `https://placehold.co/800x500/111111/d4af37?text=${encodeURIComponent(clean(label || 'Vehicle'))}`;
  }

  function escapeHtml(str) {
    return String(str || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function escapeJs(str) {
    return String(str || '').replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('"', '\\"');
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function debounce(fn, wait = 150) {
    let timeout = null;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  }

  function cryptoRandomFallback() {
    try { return crypto.randomUUID(); } catch { return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
  }

  window.showSection = showSection;
  window.markListingSold = markListingSold;
  window.markListingAction = markListingAction;
  window.copyVehicleSummary = copyVehicleSummary;
  window.trackListingView = trackListingView;
  window.trackListingMessage = trackListingMessage;
  window.syncListingTraction = syncListingTraction;
  window.openListingSource = openListingSource;
  window.openListingDetailModal = openListingDetailModal;
})();
