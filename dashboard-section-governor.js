(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.sectionGovernor) return;

  NS.modules = NS.modules || {};
  NS.sectionClaims = NS.sectionClaims || {};
  NS.sectionClaims.tools = 'execution_hub_native';
  NS.modules.tools = true;
  NS.modules.executionHubP3 = true;
  NS.modules.executionHubCleanup = true;
  NS.modules.executionHubHardReplace = true;
  NS.modules.executionHubFinalGovernor = true;

  const MODULES = [
    { key: 'vehicle_poster', label: 'Vehicle Poster', status: 'Live Now', title: 'Vehicle Poster', subtitle: 'Inventory-to-Marketplace execution for sales professionals. Clean handoff, controlled posting, and extension readiness from one command surface.' },
    { key: 'reactivation_engine', label: 'Reactivation Engine', status: 'Planned', title: 'Reactivation Engine', subtitle: 'Revive old leads, trigger conversations, and push dormant pipeline back into motion.' },
    { key: 'pipeline_engine', label: 'Pipeline Engine', status: 'Planned', title: 'Pipeline Engine', subtitle: 'Control deal movement, ownership, and lead stage pressure.' },
    { key: 'follow_up_engine', label: 'Follow-Up Engine', status: 'Planned', title: 'Follow-Up Engine', subtitle: 'Automate persistence so warm opportunities do not die from manual drop-off.' },
    { key: 'content_engine', label: 'Content Engine', status: 'Planned', title: 'Content Engine', subtitle: 'Generate platform-ready inventory and sales content faster.' },
    { key: 'distribution_hub', label: 'Distribution Hub', status: 'Planned', title: 'Distribution Hub', subtitle: 'Expand beyond one posting surface and push distribution across more channels.' },
    { key: 'market_intelligence', label: 'Market Intelligence', status: 'Analytics Only', title: 'Market Intelligence', subtitle: 'Analytics belongs inside Intelligence Centre, not the execution surface.' }
  ];

  const NAV_LABELS = {
    overview: ['Command Centre', 'Overview'],
    tools: ['Execution Hub', 'Vehicle Poster, execution'],
    analytics: ['Intelligence Centre', 'Listings, review, performance'],
    compliance: ['Compliance', 'AB/BC readiness, disclosures'],
    partners: ['Partner Network', 'Affiliates, referrals, growth'],
    setup: ['Activation', 'Profile, dealer, activation'],
    billing: ['Plan & Access', 'Plan, access, usage']
  };

  function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
  function escapeHtml(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function num(value) { const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(parsed) ? parsed : 0; }
  function isReal(value) { const v = clean(value); return Boolean(v) && !/^(loading\.?|unknown|undefined|null|unset|missing|review)$/i.test(v); }

  function first(...values) {
    for (const value of values) {
      const v = clean(value);
      if (isReal(v)) return v;
    }
    return '';
  }

  function getSummary() {
    const summary = window.dashboardSummary?.data ? window.dashboardSummary.data : window.dashboardSummary;
    return summary && typeof summary === 'object' ? summary : {};
  }

  function getProfile(summary) {
    return { ...(summary.account_snapshot || {}), ...(summary.profile_snapshot || {}), ...(summary.profile || {}) };
  }

  function hostFromUrl(url, fallback) {
    const value = clean(url || fallback);
    if (!isReal(value)) return 'Inventory Source';
    try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return value; }
  }

  function routeFromUrl(url) {
    const value = clean(url);
    if (!isReal(value)) return 'Inventory route not connected';
    try { const parsed = new URL(value); return `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, ''); }
    catch { return value.length > 84 ? `${value.slice(0, 84)}...` : value; }
  }

  function getState() {
    const s = getSummary();
    const profile = getProfile(s);
    const setup = s.setup_status || {};
    const account = s.account_snapshot || {};
    const plan = s.plan_access || {};
    const command = s.command_center || {};
    const kpis = command.kpis || {};
    const queues = command.work_queues || {};

    const dealerWebsite = first(profile.dealer_website, profile.dealerWebsite, profile.website, s.dealer_website, s.dealerWebsite, document.getElementById('extensionDealerWebsite')?.textContent);
    const inventoryUrl = first(profile.inventory_url, profile.inventoryUrl, s.inventory_url, s.inventoryUrl, setup.inventory_url, document.getElementById('extensionInventoryUrl')?.textContent);
    const scannerType = first(profile.scanner_type, profile.scannerType, s.scanner_type, s.scannerType, setup.scanner_type, setup.scanner_type_present ? 'vehicle-cards' : '', document.getElementById('extensionScannerType')?.textContent) || 'Review';
    const listingLocation = first(profile.listing_location, profile.listingLocation, profile.city && profile.province ? `${profile.city}, ${profile.province}` : '', s.listing_location, s.listingLocation, document.getElementById('extensionListingLocation')?.textContent) || 'Location missing';
    const complianceMode = first(profile.compliance_mode, profile.complianceMode, profile.province, s.compliance_mode, s.complianceMode, setup.compliance_mode, setup.compliance_mode_present ? 'Configured' : '', document.getElementById('extensionComplianceMode')?.textContent) || 'Unset';
    const accessState = first(account.access_granted || s.can_post ? 'Active' : '', account.status, s.access_state, profile.access_state, document.getElementById('extensionAccessState')?.textContent) || 'Inactive';

    const remaining = num(s.posts_remaining ?? kpis.remaining_today ?? plan.posts_remaining ?? document.getElementById('extensionRemainingPosts')?.textContent ?? 0);
    const reviewQueue = num(s.review_queue_count ?? kpis.in_review ?? queues.review_queue ?? document.getElementById('extensionReviewQueue')?.textContent ?? 0);
    const staleListings = num(s.review_delete_count ?? queues.stale_review ?? s.stale_listings_count ?? document.getElementById('staleQueueCount')?.textContent ?? 0);

    const accessReady = /active|ready|connected|live/i.test(accessState);
    const setupReady = [dealerWebsite, inventoryUrl, listingLocation, complianceMode].filter(isReal).length;
    const marketplaceBridge = first(s.marketplace_bridge, document.getElementById('extensionMarketplaceBridge')?.textContent, accessReady ? 'Ready' : 'Review');

    let commandTitle = 'Sync execution state';
    let commandCopy = 'Pull the latest access, dealer, inventory, and compliance truth before posting.';
    let commandAction = 'refresh_extension_state';
    let commandLabel = 'Sync State';

    if (!accessReady) {
      commandTitle = 'Install or reconnect the extension';
      commandCopy = 'The live poster needs a healthy extension connection before Marketplace execution.';
      commandAction = 'install_extension';
      commandLabel = 'Install Extension';
    } else if (setupReady < 4) {
      commandTitle = 'Complete activation before posting';
      commandCopy = 'Dealer source, inventory route, listing location, and compliance region must be clean before execution.';
      commandAction = 'view_setup_steps';
      commandLabel = 'Activation';
    } else if (remaining <= 0) {
      commandTitle = 'Posting capacity is used today';
      commandCopy = 'Daily posting capacity is consumed. Review Plan & Access before pushing more output.';
      commandAction = 'open_plan_access';
      commandLabel = 'Plan & Access';
    } else {
      commandTitle = 'Ready to execute';
      commandCopy = 'Source, access, and compliance state are in position. Open Marketplace and move the next vehicle.';
      commandAction = 'open_marketplace';
      commandLabel = 'Open Marketplace';
    }

    return {
      dealerWebsite,
      inventoryUrl,
      scannerType,
      listingLocation,
      complianceMode,
      accessState,
      remaining: String(remaining),
      reviewQueue: String(reviewQueue),
      staleListings: String(staleListings),
      accessReady,
      setupReady,
      marketplaceBridge,
      sourceHost: hostFromUrl(inventoryUrl, dealerWebsite),
      sourceRoute: routeFromUrl(inventoryUrl),
      commandTitle,
      commandCopy,
      commandAction,
      commandLabel
    };
  }

  function ensureStyle() {
    if (document.getElementById('dashboard-section-governor-style')) return;
    const style = document.createElement('style');
    style.id = 'dashboard-section-governor-style';
    style.textContent = `
      #extension > :not(#executionHubNativeShell){display:none!important;}
      #executionHubNativeShell{display:grid;gap:16px;margin-bottom:22px;}
      .ehn-card,.ehn-panel{background:#121212;border:1px solid rgba(212,175,55,.14);border-radius:22px;box-shadow:0 10px 30px rgba(0,0,0,.28);padding:18px}.ehn-grid{display:grid;grid-template-columns:minmax(0,1.18fr) minmax(340px,.82fr);gap:16px}.ehn-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ehn-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ehn-title{font-size:30px;line-height:1.05;margin:0 0 8px}.ehn-copy{color:#a9a9a9;line-height:1.55}.ehn-eyebrow{color:#d4af37;font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;margin-bottom:10px}.ehn-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}.ehn-status,.ehn-pill{display:inline-flex;align-items:center;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(212,175,55,.22);background:rgba(212,175,55,.1);color:#f3ddb0;font-size:12px;font-weight:800}.ehn-kpi{background:#171717;border:1px solid rgba(255,255,255,.05);border-radius:16px;padding:15px}.ehn-kpi-value{font-size:22px;font-weight:800;line-height:1.08;word-break:break-word}.ehn-kpi-sub{font-size:12px;color:#a9a9a9;line-height:1.45;margin-top:7px}.ehn-source{background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,0));border:1px solid rgba(212,175,55,.12);border-radius:18px;padding:16px;margin-bottom:14px}.ehn-source-title{font-size:24px;font-weight:900;margin-bottom:8px}.ehn-route{font-size:13px;color:#f3ddb0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ehn-pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ehn-command-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}.ehn-command-actions button,.ehn-actions button{min-height:50px}.ehn-details{margin-top:16px;border-top:1px solid rgba(255,255,255,.06);padding-top:14px}.ehn-details summary{cursor:pointer;color:#f3ddb0;font-size:13px;font-weight:900;letter-spacing:.5px;text-transform:uppercase}.ehn-row{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.05)}.ehn-row:last-child{border-bottom:none}.ehn-label{font-weight:800}.ehn-value{text-align:right;color:#f3ddb0;word-break:break-word;line-height:1.45}.ehn-modal-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:22px}.ehn-modal{width:min(720px,96vw);max-height:90vh;overflow:auto;background:#101010;border:1px solid rgba(212,175,55,.22);border-radius:24px;box-shadow:0 24px 80px rgba(0,0,0,.6);padding:22px}.ehn-step{background:#171717;border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:14px;margin-top:10px;line-height:1.45}@media(max-width:1100px){.ehn-grid{grid-template-columns:1fr}}@media(max-width:720px){.ehn-two,.ehn-actions{grid-template-columns:1fr}.ehn-command-actions{display:grid}}
    `;
    document.head.appendChild(style);
  }

  function applyNavLabels() {
    document.querySelectorAll('.sidebar-nav .nav-btn').forEach((btn) => {
      const key = clean(btn.dataset.eaNavKey || btn.dataset.section || btn.getAttribute('data-section'));
      const meta = NAV_LABELS[key];
      if (!meta) return;
      const label = btn.querySelector('.ea-nav-label');
      const detail = btn.querySelector('.ea-nav-detail');
      if (label) label.textContent = meta[0];
      if (detail) detail.textContent = meta[1];
      btn.setAttribute('aria-label', meta[0]);
    });
  }

  function renderExecutionHubNative() {
    const section = document.getElementById('extension');
    if (!section) return;
    ensureStyle();
    applyNavLabels();

    const state = getState();
    let shell = document.getElementById('executionHubNativeShell');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'executionHubNativeShell';
      section.prepend(shell);
    }

    shell.innerHTML = `
      <div class="ehn-card"><div class="ehn-head"><div><div class="ehn-eyebrow">Execution Module</div><h2 class="ehn-title">Execution Hub</h2><div class="ehn-copy">Vehicle Poster is the live execution surface. Analytics stay inside Intelligence Centre.</div></div><div class="ehn-status">Vehicle Poster · Live Now</div></div></div>
      <div class="ehn-grid"><div class="ehn-card"><div class="ehn-eyebrow">Execution Command</div><h2 class="ehn-title">${escapeHtml(state.commandTitle)}</h2><div class="ehn-copy">${escapeHtml(state.commandCopy)}</div><div class="ehn-command-actions"><button class="btn-primary" type="button" data-ehn-action="${escapeHtml(state.commandAction)}">${escapeHtml(state.commandLabel)}</button><button class="action-btn" type="button" data-ehn-action="install_extension">Install Extension</button></div></div><div class="ehn-card"><div class="ehn-eyebrow">Execution Status</div><div class="ehn-two"><div class="ehn-kpi"><div class="ehn-eyebrow">Poster Status</div><div class="ehn-kpi-value">${state.accessReady ? 'Ready' : 'Review'}</div><div class="ehn-kpi-sub">Can the poster be used right now?</div></div><div class="ehn-kpi"><div class="ehn-eyebrow">Access State</div><div class="ehn-kpi-value">${escapeHtml(state.accessState)}</div><div class="ehn-kpi-sub">Current account/extension truth.</div></div><div class="ehn-kpi"><div class="ehn-eyebrow">Compliance Region</div><div class="ehn-kpi-value">${escapeHtml(state.complianceMode)}</div><div class="ehn-kpi-sub">Active publish rule profile.</div></div><div class="ehn-kpi"><div class="ehn-eyebrow">Remaining Today</div><div class="ehn-kpi-value">${escapeHtml(state.remaining)}</div><div class="ehn-kpi-sub">Posting capacity available today.</div></div></div></div></div>
      <div class="ehn-grid"><div class="ehn-panel"><div class="ehn-eyebrow">Inventory Source</div><div class="ehn-source"><div class="ehn-source-title">${escapeHtml(state.sourceHost)}</div><div class="ehn-route" title="${escapeHtml(state.inventoryUrl)}">${escapeHtml(state.sourceRoute)}</div><div class="ehn-pills"><span class="ehn-pill">${isReal(state.dealerWebsite) ? 'Connected' : 'Review'}</span><span class="ehn-pill">${escapeHtml(state.listingLocation)}</span><span class="ehn-pill">${escapeHtml(state.complianceMode)}</span></div></div><div class="ehn-command-actions" style="margin-top:0;"><button class="action-btn" type="button" data-ehn-action="open_inventory_url">Open Source</button><button class="action-btn" type="button" data-ehn-action="copy_inventory_url">Copy URL</button><button class="action-btn" type="button" data-ehn-action="view_setup_steps">Change Source</button></div><details class="ehn-details"><summary>Advanced Diagnostics</summary><div style="margin-top:12px;"><div class="ehn-row"><div class="ehn-label">Inventory Detection</div><div class="ehn-value">${escapeHtml(state.scannerType)}</div></div><div class="ehn-row"><div class="ehn-label">Dealer Source</div><div class="ehn-value">${escapeHtml(state.dealerWebsite || 'Review')}</div></div><div class="ehn-row"><div class="ehn-label">Raw Inventory Route</div><div class="ehn-value">${escapeHtml(state.inventoryUrl || 'Review')}</div></div><div class="ehn-row"><div class="ehn-label">Marketplace Bridge</div><div class="ehn-value">${escapeHtml(state.marketplaceBridge)}</div></div></div></details></div><div class="ehn-panel"><div class="ehn-eyebrow">Primary Actions</div><div class="ehn-actions"><button class="action-btn" type="button" data-ehn-action="install_extension">Install Extension</button><button class="action-btn" type="button" data-ehn-action="open_marketplace">Open Marketplace</button><button class="action-btn" type="button" data-ehn-action="open_inventory_url">Open Source</button><button class="action-btn" type="button" data-ehn-action="refresh_extension_state">Sync State</button><button class="action-btn" type="button" data-ehn-action="view_setup_steps">Activation</button><button class="action-btn" type="button" data-ehn-action="open_plan_access">Plan & Access</button></div><div class="ehn-copy" style="margin-top:14px;font-size:13px;">Install Extension opens guided instructions: download, unzip, Chrome Extensions, Developer Mode, Load Unpacked, then Sync State.</div></div></div>
    `;
    bindActions(shell);
  }

  function getDownloadUrl() { return `/downloads/elevate-automation-extension.zip?v=${Date.now()}`; }

  function showInstallModal() {
    document.getElementById('ehnInstallModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'ehnInstallModal';
    modal.className = 'ehn-modal-backdrop';
    modal.innerHTML = `<div class="ehn-modal"><div class="ehn-head"><div><div class="ehn-eyebrow">Vehicle Poster Extension</div><h2 class="ehn-title">Install the latest extension build</h2><div class="ehn-copy">Keep this overlay open while installing.</div></div><button class="action-btn" type="button" data-ehn-action="close_modal">Close</button></div><div class="ehn-step"><strong>1. Download the latest build.</strong><br>Use the button below.</div><div class="ehn-step"><strong>2. Unzip the file.</strong><br>Move the extracted folder somewhere permanent.</div><div class="ehn-step"><strong>3. Open Chrome Extensions.</strong><br>Open the Chrome extensions page.</div><div class="ehn-step"><strong>4. Turn on Developer Mode.</strong><br>Use the top-right toggle.</div><div class="ehn-step"><strong>5. Load Unpacked.</strong><br>Select the folder containing manifest.json.</div><div class="ehn-step"><strong>6. Return here and Sync State.</strong></div><div class="ehn-command-actions"><button class="btn-primary" type="button" data-ehn-action="download_extension">Download Latest Build</button><button class="action-btn" type="button" data-ehn-action="refresh_extension_state">Sync State</button></div></div>`;
    document.body.appendChild(modal);
    bindActions(modal);
  }

  function runAction(action) {
    const state = getState();
    if (action === 'install_extension') return showInstallModal();
    if (action === 'download_extension') return window.open(getDownloadUrl(), '_blank', 'noopener,noreferrer');
    if (action === 'close_modal') return document.getElementById('ehnInstallModal')?.remove();
    if (action === 'open_marketplace') return document.getElementById('openMarketplaceBtn')?.click() || window.open('https://www.facebook.com/marketplace/create/vehicle','_blank','noopener,noreferrer');
    if (action === 'open_inventory_url') return document.getElementById('openInventoryBtn')?.click() || (state.inventoryUrl ? window.open(state.inventoryUrl,'_blank','noopener,noreferrer') : null);
    if (action === 'copy_inventory_url') return navigator.clipboard?.writeText?.(state.inventoryUrl || '');
    if (action === 'refresh_extension_state') return (document.getElementById('refreshExtensionStateBtn') || document.getElementById('refreshAccessBtn'))?.click() || renderExecutionHubNative();
    if (action === 'view_setup_steps') return window.showSection?.('profile');
    if (action === 'open_plan_access') return window.showSection?.('billing');
  }

  function bindActions(root) {
    root.querySelectorAll('[data-ehn-action]').forEach((btn) => {
      if (btn.dataset.ehnBound === 'true') return;
      btn.dataset.ehnBound = 'true';
      btn.addEventListener('click', () => runAction(btn.getAttribute('data-ehn-action')));
    });
  }

  function boot() {
    ensureStyle();
    applyNavLabels();
    renderExecutionHubNative();
  }

  window.addEventListener('elevate:summary-ready', () => setTimeout(renderExecutionHubNative, 80));
  window.addEventListener('elevate:tracking-refreshed', () => setTimeout(renderExecutionHubNative, 80));
  window.addEventListener('elevate:workflow-updated', () => setTimeout(renderExecutionHubNative, 80));

  NS.sectionGovernor = { applyNavLabels, renderExecutionHubNative };
  NS.modules.sectionGovernor = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
