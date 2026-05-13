
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.tools) return;

  const MODULES = [
    {
      key: 'vehicle_poster',
      label: 'Vehicle Poster',
      eyebrow: 'Live Execution Tool',
      title: 'Vehicle Poster',
      subtitle: 'Run posting, inventory handoff, extension actions, and publish readiness from one execution surface.',
      status: 'Live Now'
    },
    {
      key: 'reactivation_engine',
      label: 'Reactivation Engine',
      eyebrow: 'Preview Module',
      title: 'Reactivation Engine',
      subtitle: 'Revive old leads, trigger new conversations, and push dormant pipeline back into motion.',
      status: 'Planned',
      bullets: [
        'Target segmented lead lists with broadcast campaigns.',
        'Trigger replies, callback requests, and appointment intent.',
        'Use old opportunities as a new revenue source instead of letting them die.'
      ]
    },
    {
      key: 'pipeline_engine',
      label: 'Pipeline Engine',
      eyebrow: 'Preview Module',
      title: 'Pipeline Engine',
      subtitle: 'Control deal movement, ownership, and lead stage pressure from one operator workspace.',
      status: 'Planned',
      bullets: [
        'Track lead stage, ownership, notes, and urgency.',
        'Give operators a cleaner sales workflow than scattered inboxes.',
        'Turn follow-up pressure into visible pipeline control.'
      ]
    },
    {
      key: 'follow_up_engine',
      label: 'Follow-Up Engine',
      eyebrow: 'Preview Module',
      title: 'Follow-Up Engine',
      subtitle: 'Automate persistence so warm opportunities do not die from manual drop-off.',
      status: 'Planned',
      bullets: [
        'Timed reminders, follow-up sequences, and no-response nudges.',
        'Appointment prompts and deal-stall recovery.',
        'Fewer missed opportunities from inconsistent follow-up.'
      ]
    },
    {
      key: 'content_engine',
      label: 'Content Engine',
      eyebrow: 'Preview Module',
      title: 'Content Engine',
      subtitle: 'Generate platform-ready inventory and sales content faster with less manual writing.',
      status: 'Planned',
      bullets: [
        'Vehicle descriptions, captions, hooks, and content prompts.',
        'Cleaner speed-to-posting for social and listing copy.',
        'More content output without adding more friction.'
      ]
    },
    {
      key: 'distribution_hub',
      label: 'Distribution Hub',
      eyebrow: 'Preview Module',
      title: 'Distribution Hub',
      subtitle: 'Expand beyond one posting surface and push distribution across more channels.',
      status: 'Planned',
      bullets: [
        'Marketplace, groups, and future multi-platform distribution.',
        'Reduce manual duplication across channels.',
        'Create more reach from the same inventory movement.'
      ]
    },
    {
      key: 'market_intelligence',
      label: 'Market Intelligence',
      eyebrow: 'Preview Module',
      title: 'Market Intelligence',
      subtitle: 'See stale risk, pricing pressure, and listing performance before output drops.',
      status: 'Planned',
      bullets: [
        'Pricing pressure and stale-risk visibility.',
        'Performance signals to guide title, price, and refresh decisions.',
        'Operator insight that compounds into better posting decisions.'
      ]
    }
  ];

  const CSS = `
    .xh-shell{display:grid;gap:22px;margin-bottom:18px}
    .xh-hero-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(320px,.95fr);gap:18px;align-items:stretch}
    .xh-primary-card{padding:30px;background:radial-gradient(circle at top right, rgba(212,175,55,.12), transparent 28%),linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0)),#121212;border:1px solid rgba(212,175,55,.14);border-radius:22px;box-shadow:0 10px 30px rgba(0,0,0,.28)}
    .xh-side-stack{display:grid;gap:18px;align-content:start}
    .xh-side-card{background:#121212;border:1px solid rgba(212,175,55,.14);border-radius:22px;padding:22px;box-shadow:0 10px 30px rgba(0,0,0,.28)}
    .xh-eyebrow{color:#d4af37;font-size:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:10px}
    .xh-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:18px}
    .xh-title-row h2{font-size:34px;line-height:1.05;margin-bottom:8px;max-width:760px}
    .xh-metric-pills{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
    .xh-pill{display:inline-flex;align-items:center;min-height:38px;padding:0 14px;border-radius:999px;background:rgba(212,175,55,.12);color:#f3ddb0;border:1px solid rgba(212,175,55,.22);font-size:13px;font-weight:700;white-space:nowrap}
    .xh-meta-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:16px}
    .xh-meta-card{background:rgba(255,255,255,.03);border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:16px}
    .xh-meta-value{font-size:28px;font-weight:700;line-height:1.05;margin:8px 0 6px}
    .xh-command-list{display:grid;gap:10px;margin-top:10px;margin-bottom:14px}
    .xh-command-item{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:16px 18px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
    .xh-command-item .title{font-weight:700;margin-bottom:6px}
    .xh-command-item .sub{color:#a9a9a9;line-height:1.55;font-size:14px}
    .xh-mini-btn{appearance:none;border:1px solid rgba(212,175,55,.22);background:rgba(212,175,55,.1);color:#f3ddb0;border-radius:999px;padding:10px 14px;font-weight:700;cursor:pointer;white-space:nowrap}
    .xh-kpi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .xh-kpi-card{position:relative;overflow:hidden;background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0));border:1px solid rgba(212,175,55,.12);border-radius:18px;padding:18px;min-height:124px}
    .xh-kpi-card::after{content:'';position:absolute;inset:auto -36px -36px auto;width:100px;height:100px;border-radius:999px;background:radial-gradient(circle, rgba(212,175,55,.14), rgba(212,175,55,0));pointer-events:none}
    .xh-kpi-label{font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#d4af37;font-weight:800;margin-bottom:10px}
    .xh-kpi-value{font-size:28px;font-weight:700;line-height:1.05}
    .xh-kpi-sub{margin-top:8px;font-size:13px;color:#a9a9a9;line-height:1.45}
    .xh-module-card{background:#121212;border:1px solid rgba(212,175,55,.14);border-radius:22px;padding:22px;box-shadow:0 10px 30px rgba(0,0,0,.28)}
    .xh-module-select-row{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:16px}
    .xh-module-select-wrap{display:grid;gap:8px;min-width:280px}
    .xh-module-select-wrap label{font-size:12px;color:#d4af37;font-weight:800;letter-spacing:1.3px;text-transform:uppercase}
    .xh-module-select{appearance:none;background:#1a1a1a;color:#f5f5f5;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px;font-size:14px;outline:none;width:100%}
    .xh-module-status{display:inline-flex;align-items:center;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(212,175,55,.22);background:rgba(212,175,55,.1);color:#f3ddb0;font-size:12px;font-weight:700}
    .xh-workspace-shell{display:grid;gap:18px}
    .xh-workspace-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap}
    .xh-workspace-head h3{font-size:30px;line-height:1.08;margin-bottom:8px}
    .xh-workspace-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.95fr);gap:18px;align-items:start}
    .xh-state-card,.xh-action-card,.xh-blocker-card,.xh-activity-card,.xh-preview-card,.xh-quiet-card{background:linear-gradient(180deg, rgba(255,255,255,.018), rgba(255,255,255,.006));border:1px solid rgba(212,175,55,.12);border-radius:18px;padding:18px}
    .xh-state-list{display:grid;gap:10px}
    .xh-state-row{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.05)}
    .xh-state-row:last-child{border-bottom:none;padding-bottom:0}
    .xh-state-label{font-size:14px;font-weight:700;color:#f4f4f4}
    .xh-state-value{font-size:14px;color:#f3ddb0;text-align:right;line-height:1.45;word-break:break-word}
    .xh-action-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:10px}
    .xh-action-grid .action-btn,.xh-action-grid .btn-primary,.xh-action-grid .btn-secondary{width:100%;text-align:center;display:flex;justify-content:center;align-items:center;min-height:56px}
    .xh-readiness-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .xh-readiness-card{background:#171717;border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:14px}
    .xh-readiness-label{font-size:11px;text-transform:uppercase;letter-spacing:1.1px;color:#d4af37;font-weight:800;margin-bottom:8px}
    .xh-readiness-value{font-size:18px;font-weight:700;line-height:1.1}
    .xh-readiness-sub{margin-top:8px;color:#a9a9a9;font-size:12px;line-height:1.45}
    .xh-blocker-list,.xh-activity-list,.xh-preview-bullets{display:grid;gap:10px}
    .xh-blocker-item,.xh-activity-item,.xh-preview-item{background:#161616;border:1px solid rgba(255,255,255,.05);border-radius:14px;padding:14px}
    .xh-blocker-item-head,.xh-activity-item-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}
    .xh-blocker-title,.xh-activity-title{font-size:14px;font-weight:700;line-height:1.35}
    .xh-blocker-copy,.xh-activity-copy,.xh-preview-copy{font-size:13px;color:#a9a9a9;line-height:1.55}
    .xh-badge{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:800;border:1px solid rgba(255,255,255,.08);background:#171717}
    .xh-badge.good{color:#9de8a8;border-color:rgba(157,232,168,.22)}
    .xh-badge.warn{color:#f3ddb0;border-color:rgba(212,175,55,.22)}
    .xh-badge.blocked{color:#ffb4b4;border-color:rgba(255,180,180,.22)}
    .xh-preview-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.7fr);gap:18px}
    .xh-preview-metric{background:#171717;border:1px solid rgba(255,255,255,.05);border-radius:16px;padding:16px}
    .xh-preview-metric .value{font-size:26px;font-weight:700;line-height:1.05;margin-top:8px}
    .xh-quiet-collapse{border:1px solid rgba(212,175,55,.10);border-radius:18px;overflow:hidden;background:#111}
    .xh-quiet-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;background:rgba(255,255,255,.02)}
    .xh-quiet-body{display:none;padding:16px;border-top:1px solid rgba(212,175,55,.08)}
    .xh-quiet-collapse.open .xh-quiet-body{display:block}
    .xh-quiet-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    @media (max-width:1200px){.xh-hero-grid,.xh-workspace-grid,.xh-preview-layout{grid-template-columns:1fr}.xh-readiness-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media (max-width:760px){.xh-meta-grid,.xh-kpi-grid,.xh-action-grid,.xh-readiness-grid,.xh-quiet-grid{grid-template-columns:1fr}.xh-title-row h2,.xh-workspace-head h3{font-size:28px}}
  `;

  function ensureStyle(){
    if(document.getElementById('execution-hub-v2-style')) return;
    const s=document.createElement('style');
    s.id='execution-hub-v2-style';
    s.textContent=CSS;
    document.head.appendChild(s);
  }

  function clean(value){ return String(value || '').replace(/\s+/g,' ').trim(); }
  function txt(id){ return clean(document.getElementById(id)?.textContent || ''); }
  function num(value){ const parsed = Number(String(value || '').replace(/[^\d.-]/g,'')); return Number.isFinite(parsed) ? parsed : 0; }
  function escapeHtml(value){ return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  function statusBadge(value){
    const normalized = clean(value).toLowerCase();
    let cls = 'warn';
    if (/ready|active|connected|live|synced|healthy|yes/.test(normalized)) cls = 'good';
    if (/blocked|missing|disconnected|not ready|error/.test(normalized)) cls = 'blocked';
    return `<span class="xh-badge ${cls}">${escapeHtml(value || 'Unknown')}</span>`;
  }

  function getExtensionDownloadUrl(){
    return '/downloads/elevate-automation-extension.zip';
  }

  function getSelectedModule(){
    return clean(localStorage.getItem('ea_execution_module_v2') || 'vehicle_poster') || 'vehicle_poster';
  }

  function setSelectedModule(key){
    try { localStorage.setItem('ea_execution_module_v2', key); } catch {}
  }

  function getModuleByKey(key){
    return MODULES.find((item) => item.key === key) || MODULES[0];
  }

  function getVehiclePosterState(){
    const reviewQueue = txt('extensionReviewQueue') || txt('reviewQueueCount') || '0';
    const staleListings = txt('staleQueueCount') || txt('staleListingsCount') || txt('staleReviewCount') || '0';
    const scannerType = txt('extensionScannerType') || txt('scanner_type') || 'Loading';
    const dealerWebsite = txt('extensionDealerWebsite') || txt('dealer_website') || 'Loading';
    const inventoryUrl = txt('extensionInventoryUrl') || txt('inventory_url') || 'Loading';
    const listingLocation = txt('extensionListingLocation') || txt('listing_location') || 'Loading';
    const complianceMode = txt('extensionComplianceMode') || txt('compliance_mode') || 'Unset';
    const accessState = txt('extensionAccessState') || 'Unknown';
    const remainingPosts = txt('extensionRemainingPosts') || '0';
    const sessionTruth = txt('sessionTruthBadge') || accessState;
    const marketplaceBridge = txt('extensionMarketplaceBridge') || (accessState.toLowerCase().includes('active') ? 'Ready' : 'Review');
    const dealerConnection = clean(dealerWebsite).toLowerCase() !== 'loading' && clean(dealerWebsite) ? 'Connected' : 'Review';
    const setupCompletion = [dealerWebsite, inventoryUrl, listingLocation, complianceMode].filter((value) => clean(value) && !/loading|unset/i.test(value)).length;
    const reviewQueueNum = num(reviewQueue);
    const staleListingsNum = num(staleListings);
    const remainingPostsNum = num(remainingPosts);

    return {
      reviewQueue,
      staleListings,
      scannerType,
      dealerWebsite,
      inventoryUrl,
      listingLocation,
      complianceMode,
      accessState,
      remainingPosts,
      sessionTruth,
      marketplaceBridge,
      dealerConnection,
      setupCompletion: `${setupCompletion}/4`,
      reviewQueueNum,
      staleListingsNum,
      remainingPostsNum
    };
  }

  function getPrimaryCommand(state){
    if (/loading|unknown/i.test(state.accessState)) {
      return {
        title: 'Refresh extension state',
        copy: 'Pull the latest access, connection, and runtime truth before attempting more execution.',
        actionLabel: 'Refresh Extension State',
        actionKey: 'refresh_extension_state',
        impact: 'Execution truth',
        impactValue: 'Needs refresh',
        load: 'Live load',
        loadValue: `${state.reviewQueueNum} in queue`,
        risk: 'If ignored',
        riskValue: 'Blind execution risk'
      };
    }
    if (/blocked|inactive|disconnected|expired/i.test(clean(state.accessState).toLowerCase())) {
      return {
        title: 'Reconnect extension before posting',
        copy: 'Extension access is not currently healthy. Reconnect the execution layer before opening Marketplace.',
        actionLabel: 'Download Extension',
        actionKey: 'download_extension',
        impact: 'Access state',
        impactValue: state.accessState,
        load: 'Live load',
        loadValue: `${state.reviewQueueNum} in queue`,
        risk: 'If ignored',
        riskValue: 'Posting will stall'
      };
    }
    if (/loading|unset/i.test(clean(state.dealerWebsite).toLowerCase()) || /loading|unset/i.test(clean(state.inventoryUrl).toLowerCase()) || /loading|unset/i.test(clean(state.listingLocation).toLowerCase())) {
      return {
        title: 'Complete setup before opening Marketplace',
        copy: 'Dealer and inventory truth are still incomplete. Finish the setup path so posting does not run blind.',
        actionLabel: 'View Setup Steps',
        actionKey: 'view_setup_steps',
        impact: 'Setup completion',
        impactValue: state.setupCompletion,
        load: 'Compliance mode',
        loadValue: state.complianceMode,
        risk: 'If ignored',
        riskValue: 'Publish blockers stay live'
      };
    }
    if (state.reviewQueueNum >= 20) {
      return {
        title: 'Review queue pressure is building',
        copy: 'The queue is already carrying live pressure. Clear or inspect the queue before adding more output.',
        actionLabel: 'Open Inventory URL',
        actionKey: 'open_inventory_url',
        impact: 'Queue pressure',
        impactValue: `${state.reviewQueueNum} in review`,
        load: 'Stale load',
        loadValue: `${state.staleListingsNum} stale`,
        risk: 'If ignored',
        riskValue: 'Backlog compounds'
      };
    }
    if (state.remainingPostsNum <= 0) {
      return {
        title: 'Posting capacity used for today',
        copy: 'Daily execution capacity is fully used. Hold new output until posting capacity resets or plan access changes.',
        actionLabel: 'Refresh Extension State',
        actionKey: 'refresh_extension_state',
        impact: 'Remaining today',
        impactValue: state.remainingPosts,
        load: 'Queue pressure',
        loadValue: `${state.reviewQueueNum} in queue`,
        risk: 'If ignored',
        riskValue: 'Wasted execution cycles'
      };
    }
    return {
      title: 'Post next vehicle',
      copy: 'Execution conditions look strong enough to move the next unit. Open Marketplace and keep the posting engine moving.',
      actionLabel: 'Open Marketplace',
      actionKey: 'open_marketplace',
      impact: 'Remaining today',
      impactValue: state.remainingPosts,
      load: 'Queue pressure',
      loadValue: `${state.reviewQueueNum} in queue`,
      risk: 'If ignored',
      riskValue: 'Output slows'
    };
  }

  function getKpis(state){
    return [
      { label: 'Posting Ready', value: /active|ready|connected/i.test(clean(state.accessState)) ? 'Ready' : 'Review', sub: 'Can the live poster be used right now?' },
      { label: 'Access Active', value: state.accessState, sub: 'Current extension and access state.' },
      { label: 'Compliance Ready', value: state.complianceMode || 'Unset', sub: 'Current publish rule profile.' },
      { label: 'Queue Ready', value: state.reviewQueue, sub: 'Units already carrying review pressure.' },
      { label: 'Remaining Today', value: state.remainingPosts, sub: 'Posting capacity still available today.' },
      { label: 'Dealer Connected', value: state.dealerConnection, sub: 'Dealer and inventory connection health.' }
    ];
  }

  function getReadinessCards(state){
    return [
      { label: 'Extension Status', value: state.accessState, sub: 'Execution layer health.' },
      { label: 'Session Truth', value: state.sessionTruth, sub: 'Current dashboard/session state.' },
      { label: 'Dealer Connection', value: state.dealerConnection, sub: 'Dealer website and inventory routing.' },
      { label: 'Marketplace Bridge', value: state.marketplaceBridge, sub: 'Marketplace readiness state.' },
      { label: 'Publish Capacity', value: state.remainingPosts, sub: 'Available daily posting capacity.' },
      { label: 'Setup Completion', value: state.setupCompletion, sub: 'Dealer and posting setup coverage.' }
    ];
  }

  function getBlockers(state){
    const blockers = [];
    if (/blocked|inactive|disconnected|expired|unknown/i.test(clean(state.accessState).toLowerCase())) {
      blockers.push({ title: 'Extension access needs review', copy: 'Extension or access truth is not fully healthy. Refresh or reconnect before pushing new output.', badge: 'Blocked', action: 'Refresh Extension State', actionKey: 'refresh_extension_state' });
    }
    if (/loading|unset/i.test(clean(state.dealerWebsite).toLowerCase())) {
      blockers.push({ title: 'Dealer website not confirmed', copy: 'Dealer website is still missing or unresolved inside the execution stack.', badge: 'Review', action: 'View Setup Steps', actionKey: 'view_setup_steps' });
    }
    if (/loading|unset/i.test(clean(state.inventoryUrl).toLowerCase())) {
      blockers.push({ title: 'Inventory URL not loaded', copy: 'Inventory source routing should be confirmed before posting from the dashboard.', badge: 'Review', action: 'Open Inventory URL', actionKey: 'open_inventory_url' });
    }
    if (/loading|unset/i.test(clean(state.listingLocation).toLowerCase())) {
      blockers.push({ title: 'Listing location missing', copy: 'Listing location should be confirmed to keep posting detail clean and compliant.', badge: 'Review', action: 'View Setup Steps', actionKey: 'view_setup_steps' });
    }
    if (state.reviewQueueNum >= 20) {
      blockers.push({ title: 'Queue pressure is elevated', copy: 'Review queue load is high. Inspect active units before adding more throughput.', badge: 'Warn', action: 'Open Inventory URL', actionKey: 'open_inventory_url' });
    }
    if (!blockers.length) {
      blockers.push({ title: 'Execution stack looks clean', copy: 'No major blockers are currently surfacing. The live Vehicle Poster can stay in motion.', badge: 'Ready', action: 'Open Marketplace', actionKey: 'open_marketplace' });
    }
    return blockers.slice(0, 4);
  }

  function getActivityItems(state){
    return [
      { title: 'Extension state synced', copy: `Current access state reads ${state.accessState || 'Unknown'}.`, time: 'Live' },
      { title: 'Queue pressure snapshot', copy: `${state.reviewQueue || '0'} units currently sit in the review queue.`, time: 'Live' },
      { title: 'Dealer routing snapshot', copy: clean(state.dealerWebsite) && !/loading/i.test(state.dealerWebsite) ? state.dealerWebsite : 'Dealer website still loading or missing.', time: 'Live' },
      { title: 'Compliance mode', copy: `Current compliance mode is ${state.complianceMode || 'Unset'}.`, time: 'Live' }
    ];
  }

  function renderPrimaryCommand(command){
    return `
      <div class="xh-primary-card">
        <div class="xh-title-row">
          <div>
            <div class="xh-eyebrow">Execution Command</div>
            <h2>${escapeHtml(command.title)}</h2>
            <div class="subtext">${escapeHtml(command.copy)}</div>
          </div>
          <div class="xh-metric-pills">
            <span class="xh-pill">Execution Hub</span>
            <span class="xh-pill">Vehicle Poster Live</span>
          </div>
        </div>
        <div class="xh-meta-grid">
          <div class="xh-meta-card">
            <div class="stat-label">${escapeHtml(command.impact)}</div>
            <div class="xh-meta-value">${escapeHtml(command.impactValue)}</div>
            <div class="stat-sub">Primary live pressure.</div>
          </div>
          <div class="xh-meta-card">
            <div class="stat-label">${escapeHtml(command.load)}</div>
            <div class="xh-meta-value">${escapeHtml(command.loadValue)}</div>
            <div class="stat-sub">Current execution load.</div>
          </div>
          <div class="xh-meta-card">
            <div class="stat-label">${escapeHtml(command.risk)}</div>
            <div class="xh-meta-value">${escapeHtml(command.riskValue)}</div>
            <div class="stat-sub">What happens if the operator ignores this.</div>
          </div>
        </div>
        <div class="xh-command-list">
          <div class="xh-command-item">
            <div>
              <div class="title">Primary execution move</div>
              <div class="sub">Move the live posting stack forward from the highest-value action, not from scattered buttons.</div>
            </div>
            <button class="btn-primary" type="button" data-xh-action="${escapeHtml(command.actionKey)}">${escapeHtml(command.actionLabel)}</button>
          </div>
          <div class="xh-command-item">
            <div>
              <div class="title">Secondary control</div>
              <div class="sub">Keep setup and connection truth close so posting does not outrun the system state.</div>
            </div>
            <button class="xh-mini-btn" type="button" data-xh-action="view_setup_steps">View Setup Steps</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderKpis(kpis){
    return `
      <div class="xh-side-stack">
        <div class="xh-side-card">
          <div class="xh-eyebrow">Execution Status</div>
          <div class="xh-kpi-grid">
            ${kpis.map((item) => `
              <div class="xh-kpi-card">
                <div class="xh-kpi-label">${escapeHtml(item.label)}</div>
                <div class="xh-kpi-value">${escapeHtml(item.value)}</div>
                <div class="xh-kpi-sub">${escapeHtml(item.sub)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function renderVehiclePosterWorkspace(module, state){
    const readiness = getReadinessCards(state);
    const blockers = getBlockers(state);
    const activity = getActivityItems(state);
    return `
      <div class="xh-workspace-shell">
        <div class="xh-workspace-head">
          <div>
            <div class="xh-eyebrow">${escapeHtml(module.eyebrow)}</div>
            <h3>${escapeHtml(module.title)}</h3>
            <div class="subtext">${escapeHtml(module.subtitle)}</div>
          </div>
          <div class="xh-module-status">${escapeHtml(module.status)}</div>
        </div>

        <div class="xh-workspace-grid">
          <div class="xh-state-card">
            <div class="section-head">
              <div>
                <h3 style="font-size:22px;margin-bottom:8px;">Posting State</h3>
                <div class="subtext">Live operator truth for posting, routing, compliance, and extension readiness.</div>
              </div>
            </div>
            <div class="xh-state-list">
              <div class="xh-state-row"><div class="xh-state-label">Review Queue</div><div class="xh-state-value">${escapeHtml(state.reviewQueue)}</div></div>
              <div class="xh-state-row"><div class="xh-state-label">Stale Listings</div><div class="xh-state-value">${escapeHtml(state.staleListings)}</div></div>
              <div class="xh-state-row"><div class="xh-state-label">Scanner Type</div><div class="xh-state-value">${escapeHtml(state.scannerType)}</div></div>
              <div class="xh-state-row"><div class="xh-state-label">Dealer Website</div><div class="xh-state-value">${escapeHtml(state.dealerWebsite)}</div></div>
              <div class="xh-state-row"><div class="xh-state-label">Inventory URL</div><div class="xh-state-value">${escapeHtml(state.inventoryUrl)}</div></div>
              <div class="xh-state-row"><div class="xh-state-label">Listing Location</div><div class="xh-state-value">${escapeHtml(state.listingLocation)}</div></div>
              <div class="xh-state-row"><div class="xh-state-label">Compliance Mode</div><div class="xh-state-value">${escapeHtml(state.complianceMode)}</div></div>
            </div>
          </div>

          <div class="xh-action-card">
            <div class="section-head">
              <div>
                <h3 style="font-size:22px;margin-bottom:8px;">Primary Actions</h3>
                <div class="subtext">Keep the direct execution controls visible and close to the live posting state.</div>
              </div>
            </div>
            <div class="xh-action-grid">
              <button class="action-btn" type="button" data-xh-action="download_extension">Download Extension</button>
              <button class="action-btn" type="button" data-xh-action="open_marketplace">Open Marketplace</button>
              <button class="action-btn" type="button" data-xh-action="open_inventory_url">Open Inventory URL</button>
              <button class="action-btn" type="button" data-xh-action="refresh_extension_state">Refresh Extension State</button>
              <button class="action-btn" type="button" data-xh-action="view_setup_steps">View Setup Steps</button>
            </div>
          </div>
        </div>

        <div class="xh-state-card">
          <div class="section-head">
            <div>
              <h3 style="font-size:22px;margin-bottom:8px;">Execution Readiness</h3>
              <div class="subtext">The live posting stack should show connection, capacity, compliance, and setup truth in one place.</div>
            </div>
          </div>
          <div class="xh-readiness-grid">
            ${readiness.map((item) => `
              <div class="xh-readiness-card">
                <div class="xh-readiness-label">${escapeHtml(item.label)}</div>
                <div class="xh-readiness-value">${escapeHtml(item.value)}</div>
                <div class="xh-readiness-sub">${escapeHtml(item.sub)}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="xh-workspace-grid">
          <div class="xh-blocker-card">
            <div class="section-head">
              <div>
                <h3 style="font-size:22px;margin-bottom:8px;">Active Blockers</h3>
                <div class="subtext">Resolve friction before it compounds into lost output or broken posting flow.</div>
              </div>
            </div>
            <div class="xh-blocker-list">
              ${blockers.map((item) => `
                <div class="xh-blocker-item">
                  <div class="xh-blocker-item-head">
                    <div class="xh-blocker-title">${escapeHtml(item.title)}</div>
                    ${statusBadge(item.badge)}
                  </div>
                  <div class="xh-blocker-copy">${escapeHtml(item.copy)}</div>
                  <div style="margin-top:12px;"><button class="xh-mini-btn" type="button" data-xh-action="${escapeHtml(item.actionKey)}">${escapeHtml(item.action)}</button></div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="xh-activity-card">
            <div class="section-head">
              <div>
                <h3 style="font-size:22px;margin-bottom:8px;">Recent Execution Activity</h3>
                <div class="subtext">Keep the tool feeling live even before deeper event instrumentation is fully wired.</div>
              </div>
            </div>
            <div class="xh-activity-list">
              ${activity.map((item) => `
                <div class="xh-activity-item">
                  <div class="xh-activity-item-head">
                    <div class="xh-activity-title">${escapeHtml(item.title)}</div>
                    <div class="xh-badge warn">${escapeHtml(item.time)}</div>
                  </div>
                  <div class="xh-activity-copy">${escapeHtml(item.copy)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPreviewWorkspace(module){
    return `
      <div class="xh-workspace-shell">
        <div class="xh-workspace-head">
          <div>
            <div class="xh-eyebrow">${escapeHtml(module.eyebrow)}</div>
            <h3>${escapeHtml(module.title)}</h3>
            <div class="subtext">${escapeHtml(module.subtitle)}</div>
          </div>
          <div class="xh-module-status">${escapeHtml(module.status)}</div>
        </div>
        <div class="xh-preview-layout">
          <div class="xh-preview-card">
            <div class="section-head">
              <div>
                <h3 style="font-size:22px;margin-bottom:8px;">Module Preview</h3>
                <div class="subtext">This is a premium preview of a planned execution layer inside the broader Elevate stack.</div>
              </div>
            </div>
            <div class="xh-preview-bullets">
              ${(module.bullets || []).map((item) => `<div class="xh-preview-item"><div class="xh-preview-copy">${escapeHtml(item)}</div></div>`).join('')}
            </div>
          </div>
          <div class="xh-preview-card">
            <div class="xh-preview-metric">
              <div class="xh-eyebrow">Commercial Value</div>
              <div class="value">Execution Leverage</div>
              <div class="subtext">This module is positioned to expand client value beyond the live Vehicle Poster workflow.</div>
            </div>
            <div class="xh-action-grid" style="margin-top:16px;grid-template-columns:1fr;">
              <button class="action-btn" type="button" data-xh-action="switch_vehicle_poster">Return to Vehicle Poster</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderQuietMode(section){
    const candidates = Array.from(section.querySelectorAll('.card')).filter((card) => !card.closest('#executionHubV2Shell'));
    const legacy = candidates.filter((card) => {
      const text = clean(card.textContent || '').toLowerCase();
      return /platform stack|tool unlock path|workflow engine/.test(text);
    });
    if (!legacy.length) return '';
    const holder = document.createElement('div');
    legacy.forEach((card) => holder.appendChild(card));
    return `
      <div class="xh-quiet-collapse" id="executionHubQuietMode">
        <div class="xh-quiet-head">
          <div>
            <div class="xh-eyebrow">Quiet Mode</div>
            <strong>Secondary detail, lower-priority module context, and legacy tool information</strong>
          </div>
          <div class="subtext" id="executionHubQuietState">Expand</div>
        </div>
        <div class="xh-quiet-body">
          <div class="xh-quiet-grid">${holder.innerHTML}</div>
        </div>
      </div>
    `;
  }

  function renderModuleShell(module, state, quietMarkup){
    const workspaceMarkup = module.key === 'vehicle_poster'
      ? renderVehiclePosterWorkspace(module, state)
      : renderPreviewWorkspace(module);

    return `
      <div class="xh-module-card">
        <div class="xh-module-select-row">
          <div>
            <div class="xh-eyebrow">Execution Module</div>
            <div class="subtext">Select the execution layer you want to view. Vehicle Poster remains the live flagship tool.</div>
          </div>
          <div class="xh-module-select-wrap">
            <label for="executionHubModuleSelect">Execution Module</label>
            <select id="executionHubModuleSelect" class="xh-module-select">
              ${MODULES.map((item) => `<option value="${escapeHtml(item.key)}" ${item.key === module.key ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
            </select>
          </div>
        </div>
        ${workspaceMarkup}
      </div>
      ${quietMarkup || ''}
    `;
  }

  function bindQuietMode(shell){
    const collapse = shell.querySelector('#executionHubQuietMode');
    if (!collapse) return;
    const head = collapse.querySelector('.xh-quiet-head');
    if (!head || head.dataset.boundQuiet === 'true') return;
    head.dataset.boundQuiet = 'true';
    head.addEventListener('click', () => {
      collapse.classList.toggle('open');
      const state = collapse.querySelector('#executionHubQuietState');
      if (state) state.textContent = collapse.classList.contains('open') ? 'Collapse' : 'Expand';
    });
  }

  function triggerLegacyAction(action){
    if (action === 'download_extension') {
      window.open(getExtensionDownloadUrl(), '_blank', 'noopener,noreferrer');
      return;
    }
    if (action === 'open_marketplace') {
      document.getElementById('openMarketplaceBtn')?.click();
      return;
    }
    if (action === 'open_inventory_url') {
      document.getElementById('openInventoryBtn')?.click();
      return;
    }
    if (action === 'refresh_extension_state') {
      document.getElementById('refreshAccessBtn')?.click();
      return;
    }
    if (action === 'view_setup_steps') {
      if (typeof window.showSection === 'function') window.showSection('setup', { scroll: false });
      return;
    }
    if (action === 'switch_vehicle_poster') {
      setSelectedModule('vehicle_poster');
      render();
    }
  }

  function bindActions(shell){
    shell.querySelectorAll('[data-xh-action]').forEach((btn) => {
      if (btn.dataset.boundXhAction === 'true') return;
      btn.dataset.boundXhAction = 'true';
      btn.addEventListener('click', () => {
        triggerLegacyAction(btn.getAttribute('data-xh-action'));
      });
    });

    const select = shell.querySelector('#executionHubModuleSelect');
    if (select && select.dataset.boundXhSelect !== 'true') {
      select.dataset.boundXhSelect = 'true';
      select.addEventListener('change', () => {
        setSelectedModule(select.value || 'vehicle_poster');
        render();
      });
    }
  }

  function updateExecutionHubHeader(section){
    const header = section.querySelector('.main-header h1');
    if (header) header.textContent = 'Execution Hub';
    const sub = section.querySelector('.main-header .subtext');
    if (sub && (!clean(sub.textContent) || /tools|posting/i.test(clean(sub.textContent)))) {
      sub.textContent = 'Live execution surface for Vehicle Poster, posting readiness, and future platform modules.';
    }
  }

  function render(){
    const section = document.getElementById('extension');
    if(!section) return;
    ensureStyle();
    updateExecutionHubHeader(section);

    let shell = document.getElementById('executionHubV2Shell');
    if(!shell){
      shell = document.createElement('div');
      shell.id = 'executionHubV2Shell';
      shell.className = 'xh-shell';
      section.prepend(shell);
    }

    const state = getVehiclePosterState();
    const command = getPrimaryCommand(state);
    const kpis = getKpis(state);
    const selectedModule = getModuleByKey(getSelectedModule());
    const quietMarkup = renderQuietMode(section);

    shell.innerHTML = `
      <div class="xh-hero-grid">
        ${renderPrimaryCommand(command)}
        ${renderKpis(kpis)}
      </div>
      ${renderModuleShell(selectedModule, state, quietMarkup)}
    `;

    bindActions(shell);
    bindQuietMode(shell);
  }

  NS.tools = { renderBundleI: render, renderExecutionHubV2: render };
  NS.modules = NS.modules || {};
  NS.modules.tools = true;

  const boot = () => { render(); setTimeout(render, 1200); setTimeout(render, 3200); };
  window.addEventListener('elevate:workflow-updated', () => render());
  window.addEventListener('elevate:tracking-refreshed', () => render());
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
