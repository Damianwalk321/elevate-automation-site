(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.executionHubHardReplace) return;

  const MODULES = [
    {
      key: 'vehicle_poster',
      label: 'Vehicle Poster',
      status: 'Live Now',
      eyebrow: 'Live Execution Tool',
      title: 'Vehicle Poster',
      subtitle: 'Run posting, inventory handoff, extension actions, and publish readiness from one execution surface.'
    },
    {
      key: 'reactivation_engine',
      label: 'Reactivation Engine',
      status: 'Planned',
      eyebrow: 'Preview Module',
      title: 'Reactivation Engine',
      subtitle: 'Revive old leads, trigger new conversations, and push dormant pipeline back into motion.',
      bullets: [
        'Target segmented lead lists with broadcast campaigns.',
        'Trigger replies, callback requests, and appointment intent.',
        'Use old opportunities as a new revenue source instead of letting them die.'
      ]
    },
    {
      key: 'pipeline_engine',
      label: 'Pipeline Engine',
      status: 'Planned',
      eyebrow: 'Preview Module',
      title: 'Pipeline Engine',
      subtitle: 'Control deal movement, ownership, and lead stage pressure from one operator workspace.',
      bullets: [
        'Track lead stage, ownership, notes, and urgency.',
        'Give operators a cleaner sales workflow than scattered inboxes.',
        'Turn follow-up pressure into visible pipeline control.'
      ]
    },
    {
      key: 'follow_up_engine',
      label: 'Follow-Up Engine',
      status: 'Planned',
      eyebrow: 'Preview Module',
      title: 'Follow-Up Engine',
      subtitle: 'Automate persistence so warm opportunities do not die from manual drop-off.',
      bullets: [
        'Timed reminders, follow-up sequences, and no-response nudges.',
        'Appointment prompts and deal-stall recovery.',
        'Fewer missed opportunities from inconsistent follow-up.'
      ]
    },
    {
      key: 'content_engine',
      label: 'Content Engine',
      status: 'Planned',
      eyebrow: 'Preview Module',
      title: 'Content Engine',
      subtitle: 'Generate platform-ready inventory and sales content faster with less manual writing.',
      bullets: [
        'Vehicle descriptions, captions, hooks, and content prompts.',
        'Cleaner speed-to-posting for social and listing copy.',
        'More content output without adding more friction.'
      ]
    },
    {
      key: 'distribution_hub',
      label: 'Distribution Hub',
      status: 'Planned',
      eyebrow: 'Preview Module',
      title: 'Distribution Hub',
      subtitle: 'Expand beyond one posting surface and push distribution across more channels.',
      bullets: [
        'Marketplace, groups, and future multi-platform distribution.',
        'Reduce manual duplication across channels.',
        'Create more reach from the same inventory movement.'
      ]
    },
    {
      key: 'market_intelligence',
      label: 'Market Intelligence',
      status: 'Planned',
      eyebrow: 'Preview Module',
      title: 'Market Intelligence',
      subtitle: 'See stale risk, pricing pressure, and listing performance before output drops.',
      bullets: [
        'Pricing pressure and stale-risk visibility.',
        'Performance signals to guide title, price, and refresh decisions.',
        'Operator insight that compounds into better posting decisions.'
      ]
    }
  ];

  const CSS = `
    .xhr-shell{display:grid;gap:16px;margin-bottom:18px}
    .xhr-band,.xhr-card,.xhr-panel{background:#121212;border:1px solid rgba(212,175,55,.14);border-radius:22px;box-shadow:0 10px 30px rgba(0,0,0,.28)}
    .xhr-band{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.82fr);gap:16px;align-items:end;padding:18px 20px}
    .xhr-band h2{font-size:28px;line-height:1.05;margin-bottom:6px}
    .xhr-copy{color:#a9a9a9;line-height:1.55}
    .xhr-eyebrow{color:#d4af37;font-size:12px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;margin-bottom:10px}
    .xhr-select-wrap{display:grid;gap:8px}
    .xhr-select-row{display:flex;gap:12px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
    .xhr-select,.xhr-select-wrap select{appearance:none;background:#1a1a1a;color:#f5f5f5;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px;font-size:14px;outline:none;min-width:280px}
    .xhr-status{display:inline-flex;align-items:center;min-height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(212,175,55,.22);background:rgba(212,175,55,.1);color:#f3ddb0;font-size:12px;font-weight:700}
    .xhr-hero{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(320px,.9fr);gap:16px}
    .xhr-card{padding:20px}
    .xhr-title{font-size:30px;line-height:1.06;margin-bottom:8px}
    .xhr-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:16px}
    .xhr-note{font-size:13px;color:#a9a9a9}
    .xhr-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .xhr-kpi{background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0));border:1px solid rgba(212,175,55,.12);border-radius:18px;padding:16px;min-height:116px}
    .xhr-kpi-label{font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#d4af37;font-weight:800;margin-bottom:10px}
    .xhr-kpi-value{font-size:26px;font-weight:700;line-height:1.05}
    .xhr-kpi-sub{margin-top:8px;font-size:13px;color:#a9a9a9;line-height:1.45}
    .xhr-panel{padding:18px}
    .xhr-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:14px}
    .xhr-head h3{font-size:26px;line-height:1.08;margin-bottom:6px}
    .xhr-grid{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(320px,.95fr);gap:16px}
    .xhr-subgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .xhr-list{display:grid;gap:10px}
    .xhr-row{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.05)}
    .xhr-row:last-child{border-bottom:none;padding-bottom:0}
    .xhr-label{font-size:14px;font-weight:700;color:#f4f4f4}
    .xhr-value{font-size:14px;color:#f3ddb0;text-align:right;line-height:1.45;word-break:break-word}
    .xhr-readiness{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .xhr-readiness-card,.xhr-item,.xhr-preview-metric{background:#171717;border:1px solid rgba(255,255,255,.05);border-radius:14px;padding:14px}
    .xhr-readiness-value{font-size:18px;font-weight:700;line-height:1.1;margin-top:8px}
    .xhr-readiness-sub,.xhr-item-copy{margin-top:8px;color:#a9a9a9;font-size:12px;line-height:1.45}
    .xhr-item-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}
    .xhr-item-title{font-size:14px;font-weight:700;line-height:1.35}
    .xhr-badge{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:800;border:1px solid rgba(255,255,255,.08);background:#171717}
    .xhr-badge.good{color:#9de8a8;border-color:rgba(157,232,168,.22)}
    .xhr-badge.warn{color:#f3ddb0;border-color:rgba(212,175,55,.22)}
    .xhr-badge.blocked{color:#ffb4b4;border-color:rgba(255,180,180,.22)}
    .xhr-preview{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.78fr);gap:16px}
    .xhr-preview-metric .value{font-size:24px;font-weight:700;line-height:1.05;margin-top:8px}
    .execution-hub-hard-hide{display:none !important}
    @media (max-width:1200px){.xhr-band,.xhr-hero,.xhr-grid,.xhr-preview{grid-template-columns:1fr}}
    @media (max-width:760px){.xhr-kpis,.xhr-subgrid,.xhr-readiness{grid-template-columns:1fr}.xhr-actions{display:grid}}
  `;

  function ensureStyle() {
    if (document.getElementById('execution-hub-hard-replace-style')) return;
    const style = document.createElement('style');
    style.id = 'execution-hub-hard-replace-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function txt(id) { return clean(document.getElementById(id)?.textContent || ''); }
  function num(value) { const n = Number(String(value || '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; }
  function escapeHtml(value) { return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function badge(value) {
    const normalized = clean(value).toLowerCase();
    let cls = 'warn';
    if (/ready|active|connected|live|synced|healthy|yes/.test(normalized)) cls = 'good';
    if (/blocked|missing|disconnected|not ready|error|locked/.test(normalized)) cls = 'blocked';
    return `<span class="xhr-badge ${cls}">${escapeHtml(value || 'Unknown')}</span>`;
  }

  function getSelectedModule() { return clean(localStorage.getItem('ea_execution_module_v2') || 'vehicle_poster') || 'vehicle_poster'; }
  function setSelectedModule(key) { try { localStorage.setItem('ea_execution_module_v2', key); } catch {} }
  function getModule(key) { return MODULES.find((m) => m.key === key) || MODULES[0]; }
  function getDownloadUrl() { return '/downloads/elevate-automation-extension.zip'; }

  function getState() {
    const reviewQueue = txt('extensionReviewQueue') || txt('reviewQueueCount') || '0';
    const staleListings = txt('staleQueueCount') || txt('staleListingsCount') || txt('staleReviewCount') || '0';
    const scannerType = txt('extensionScannerType') || 'Loading';
    const dealerWebsite = txt('extensionDealerWebsite') || 'Loading';
    const inventoryUrl = txt('extensionInventoryUrl') || 'Loading';
    const listingLocation = txt('extensionListingLocation') || 'Loading';
    const complianceMode = txt('extensionComplianceMode') || 'Unset';
    const accessState = txt('extensionAccessState') || 'Unknown';
    const remainingPosts = txt('extensionRemainingPosts') || '0';
    const sessionTruth = txt('sessionTruthBadge') || accessState;
    const marketplaceBridge = txt('extensionMarketplaceBridge') || (/active|ready/i.test(accessState) ? 'Ready' : 'Review');
    const dealerConnection = clean(dealerWebsite).toLowerCase() !== 'loading' && clean(dealerWebsite) ? 'Connected' : 'Review';
    const setupCompletion = [dealerWebsite, inventoryUrl, listingLocation, complianceMode].filter((value) => clean(value) && !/loading|unset/i.test(value)).length;
    return {
      reviewQueue, staleListings, scannerType, dealerWebsite, inventoryUrl, listingLocation, complianceMode,
      accessState, remainingPosts, sessionTruth, marketplaceBridge, dealerConnection, setupCompletion: `${setupCompletion}/4`,
      reviewQueueNum: num(reviewQueue), staleListingsNum: num(staleListings), remainingPostsNum: num(remainingPosts)
    };
  }

  function getCommand(state) {
    if (/loading|unknown/i.test(state.accessState)) return { title:'Refresh extension state', copy:'Pull the latest access, connection, and runtime truth before attempting more execution.', actionLabel:'Refresh Extension State', actionKey:'refresh_extension_state' };
    if (/blocked|inactive|disconnected|expired/i.test(clean(state.accessState).toLowerCase())) return { title:'Reconnect extension before posting', copy:'Extension access is not currently healthy. Reconnect the execution layer before opening Marketplace.', actionLabel:'Download Extension', actionKey:'download_extension' };
    if (/loading|unset/i.test(clean(state.dealerWebsite).toLowerCase()) || /loading|unset/i.test(clean(state.inventoryUrl).toLowerCase()) || /loading|unset/i.test(clean(state.listingLocation).toLowerCase())) return { title:'Complete setup before opening Marketplace', copy:'Dealer and inventory truth are still incomplete. Finish the setup path so posting does not run blind.', actionLabel:'View Setup Steps', actionKey:'view_setup_steps' };
    if (state.reviewQueueNum >= 20) return { title:'Review queue pressure is building', copy:'The queue is already carrying live pressure. Clear or inspect the queue before adding more output.', actionLabel:'Open Inventory URL', actionKey:'open_inventory_url' };
    if (state.remainingPostsNum <= 0) return { title:'Posting capacity used for today', copy:'Daily execution capacity is fully used. Hold new output until posting capacity resets or plan access changes.', actionLabel:'Plan & Access', actionKey:'open_plan_access' };
    return { title:'Post next vehicle', copy:'Execution conditions look strong enough to move the next unit. Open Marketplace and keep the posting engine moving.', actionLabel:'Open Marketplace', actionKey:'open_marketplace' };
  }

  function getKpis(state) {
    return [
      { label:'Posting Ready', value:/active|ready|connected/i.test(clean(state.accessState)) ? 'Ready' : 'Review', sub:'Can the live poster be used right now?' },
      { label:'Access Active', value:state.accessState, sub:'Current extension and access state.' },
      { label:'Queue Ready', value:state.reviewQueue, sub:'Units already carrying review pressure.' },
      { label:'Remaining Today', value:state.remainingPosts, sub:'Posting capacity still available today.' }
    ];
  }

  function getReadiness(state) {
    return [
      { label:'Compliance Ready', value:state.complianceMode, sub:'Current publish rule profile.' },
      { label:'Dealer Connected', value:state.dealerConnection, sub:'Dealer website and inventory routing.' },
      { label:'Marketplace Bridge', value:state.marketplaceBridge, sub:'Marketplace readiness state.' },
      { label:'Setup Completion', value:state.setupCompletion, sub:'Dealer and posting setup coverage.' }
    ];
  }

  function getBlockers(state) {
    const items = [];
    if (/blocked|inactive|disconnected|expired|unknown/i.test(clean(state.accessState).toLowerCase())) items.push({ title:'Extension access needs review', copy:'Extension or access truth is not fully healthy. Refresh or reconnect before pushing new output.', badge:'Blocked', action:'Refresh Extension State', actionKey:'refresh_extension_state' });
    if (/loading|unset/i.test(clean(state.dealerWebsite).toLowerCase())) items.push({ title:'Dealer website not confirmed', copy:'Dealer website is still missing or unresolved inside the execution stack.', badge:'Review', action:'View Setup Steps', actionKey:'view_setup_steps' });
    if (/loading|unset/i.test(clean(state.inventoryUrl).toLowerCase())) items.push({ title:'Inventory URL not loaded', copy:'Inventory source routing should be confirmed before posting from the dashboard.', badge:'Review', action:'Open Inventory URL', actionKey:'open_inventory_url' });
    if (/loading|unset/i.test(clean(state.listingLocation).toLowerCase())) items.push({ title:'Listing location missing', copy:'Listing location should be confirmed to keep posting detail clean and compliant.', badge:'Review', action:'View Setup Steps', actionKey:'view_setup_steps' });
    if (!items.length) items.push({ title:'Execution stack looks clean', copy:'No major blockers are currently surfacing. The live Vehicle Poster can stay in motion.', badge:'Ready', action:'Open Marketplace', actionKey:'open_marketplace' });
    return items.slice(0, 4);
  }

  function getActivity(state) {
    return [
      { title:'Extension state synced', copy:`Current access state reads ${state.accessState || 'Unknown'}.`, time:'Live' },
      { title:'Queue pressure snapshot', copy:`${state.reviewQueue || '0'} units currently sit in the review queue.`, time:'Live' },
      { title:'Dealer routing snapshot', copy:clean(state.dealerWebsite) && !/loading/i.test(state.dealerWebsite) ? state.dealerWebsite : 'Dealer website still loading or missing.', time:'Live' },
      { title:'Compliance mode', copy:`Current compliance mode is ${state.complianceMode || 'Unset'}.`, time:'Live' }
    ];
  }

  function renderPreview(module) {
    return `
      <div class="xhr-panel">
        <div class="xhr-head">
          <div>
            <div class="xhr-eyebrow">${escapeHtml(module.eyebrow)}</div>
            <h3>${escapeHtml(module.title)}</h3>
            <div class="xhr-copy">${escapeHtml(module.subtitle)}</div>
          </div>
          <div class="xhr-status">${escapeHtml(module.status)}</div>
        </div>
        <div class="xhr-preview">
          <div class="xhr-panel">
            <div class="xhr-eyebrow">Module Preview</div>
            <div class="xhr-list">${(module.bullets || []).map((item) => `<div class="xhr-item"><div class="xhr-item-copy">${escapeHtml(item)}</div></div>`).join('')}</div>
          </div>
          <div class="xhr-panel">
            <div class="xhr-preview-metric">
              <div class="xhr-eyebrow">Commercial Value</div>
              <div class="value">Execution Leverage</div>
              <div class="xhr-item-copy">This module is positioned to expand client value beyond the live Vehicle Poster workflow.</div>
            </div>
            <div class="xhr-actions"><button class="action-btn" type="button" data-xhr-action="switch_vehicle_poster">Return to Vehicle Poster</button></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderVehiclePoster(module, state) {
    const readiness = getReadiness(state);
    const blockers = getBlockers(state);
    const activity = getActivity(state);
    return `
      <div class="xhr-panel">
        <div class="xhr-head">
          <div>
            <div class="xhr-eyebrow">${escapeHtml(module.eyebrow)}</div>
            <h3>${escapeHtml(module.title)}</h3>
            <div class="xhr-copy">${escapeHtml(module.subtitle)}</div>
          </div>
          <div class="xhr-status">${escapeHtml(module.status)}</div>
        </div>
        <div class="xhr-grid">
          <div class="xhr-panel">
            <div class="xhr-eyebrow">Posting State</div>
            <div class="xhr-list">
              <div class="xhr-row"><div class="xhr-label">Review Queue</div><div class="xhr-value">${escapeHtml(state.reviewQueue)}</div></div>
              <div class="xhr-row"><div class="xhr-label">Stale Listings</div><div class="xhr-value">${escapeHtml(state.staleListings)}</div></div>
              <div class="xhr-row"><div class="xhr-label">Scanner Type</div><div class="xhr-value">${escapeHtml(state.scannerType)}</div></div>
              <div class="xhr-row"><div class="xhr-label">Dealer Website</div><div class="xhr-value">${escapeHtml(state.dealerWebsite)}</div></div>
              <div class="xhr-row"><div class="xhr-label">Inventory URL</div><div class="xhr-value">${escapeHtml(state.inventoryUrl)}</div></div>
              <div class="xhr-row"><div class="xhr-label">Listing Location</div><div class="xhr-value">${escapeHtml(state.listingLocation)}</div></div>
              <div class="xhr-row"><div class="xhr-label">Compliance Mode</div><div class="xhr-value">${escapeHtml(state.complianceMode)}</div></div>
            </div>
          </div>
          <div class="xhr-panel">
            <div class="xhr-eyebrow">Primary Actions</div>
            <div class="xhr-subgrid">
              <button class="action-btn" type="button" data-xhr-action="download_extension">Download Extension</button>
              <button class="action-btn" type="button" data-xhr-action="open_marketplace">Open Marketplace</button>
              <button class="action-btn" type="button" data-xhr-action="open_inventory_url">Open Inventory URL</button>
              <button class="action-btn" type="button" data-xhr-action="refresh_extension_state">Refresh Extension State</button>
              <button class="action-btn" type="button" data-xhr-action="view_setup_steps">View Setup Steps</button>
              <button class="action-btn" type="button" data-xhr-action="open_plan_access">Plan & Access</button>
            </div>
          </div>
        </div>
        <div class="xhr-panel" style="margin-top:16px;">
          <div class="xhr-eyebrow">Execution Readiness</div>
          <div class="xhr-readiness">${readiness.map((item) => `<div class="xhr-readiness-card"><div class="xhr-eyebrow">${escapeHtml(item.label)}</div><div class="xhr-readiness-value">${escapeHtml(item.value)}</div><div class="xhr-readiness-sub">${escapeHtml(item.sub)}</div></div>`).join('')}</div>
        </div>
        <div class="xhr-grid" style="margin-top:16px;">
          <div class="xhr-panel">
            <div class="xhr-eyebrow">Active Blockers</div>
            <div class="xhr-list">${blockers.map((item) => `<div class="xhr-item"><div class="xhr-item-head"><div class="xhr-item-title">${escapeHtml(item.title)}</div>${badge(item.badge)}</div><div class="xhr-item-copy">${escapeHtml(item.copy)}</div><div style="margin-top:12px;"><button class="action-btn" type="button" data-xhr-action="${escapeHtml(item.actionKey)}">${escapeHtml(item.action)}</button></div></div>`).join('')}</div>
          </div>
          <div class="xhr-panel">
            <div class="xhr-eyebrow">Recent Execution Activity</div>
            <div class="xhr-list">${activity.map((item) => `<div class="xhr-item"><div class="xhr-item-head"><div class="xhr-item-title">${escapeHtml(item.title)}</div><div class="xhr-badge warn">${escapeHtml(item.time)}</div></div><div class="xhr-item-copy">${escapeHtml(item.copy)}</div></div>`).join('')}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderShell() {
    const section = document.getElementById('extension');
    if (!section) return;
    const state = getState();
    const module = getModule(getSelectedModule());
    const command = getCommand(state);
    const kpis = getKpis(state);
    let shell = document.getElementById('executionHubHardReplaceShell');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'executionHubHardReplaceShell';
      shell.className = 'xhr-shell';
      const old = document.getElementById('executionHubV2Shell');
      if (old) old.after(shell); else section.appendChild(shell);
    }

    shell.innerHTML = `
      <div class="xhr-band">
        <div>
          <div class="xhr-eyebrow">Execution Module</div>
          <h2>Execution Hub</h2>
          <div class="xhr-copy">Select the execution layer you want to view. Vehicle Poster remains the live flagship tool.</div>
        </div>
        <div class="xhr-select-wrap">
          <label for="executionHubHardModuleSelect" class="xhr-eyebrow" style="margin-bottom:0;">Execution Module</label>
          <div class="xhr-select-row">
            <select id="executionHubHardModuleSelect" class="xhr-select">${MODULES.map((item) => `<option value="${escapeHtml(item.key)}" ${item.key === module.key ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select>
            <div class="xhr-status">${escapeHtml(module.status)}</div>
          </div>
        </div>
      </div>
      <div class="xhr-hero">
        <div class="xhr-card">
          <div class="xhr-eyebrow">Execution Command</div>
          <div class="xhr-title">${escapeHtml(command.title)}</div>
          <div class="xhr-copy">${escapeHtml(command.copy)}</div>
          <div class="xhr-actions">
            <button class="btn-primary" type="button" data-xhr-action="${escapeHtml(command.actionKey)}">${escapeHtml(command.actionLabel)}</button>
            <button class="action-btn" type="button" data-xhr-action="view_setup_steps">View Setup Steps</button>
            <div class="xhr-note">Get to the live Vehicle Poster controls faster and reduce duplicated operator noise.</div>
          </div>
        </div>
        <div class="xhr-card">
          <div class="xhr-eyebrow">Execution Status</div>
          <div class="xhr-kpis">${kpis.map((item) => `<div class="xhr-kpi"><div class="xhr-kpi-label">${escapeHtml(item.label)}</div><div class="xhr-kpi-value">${escapeHtml(item.value)}</div><div class="xhr-kpi-sub">${escapeHtml(item.sub)}</div></div>`).join('')}</div>
        </div>
      </div>
      ${module.key === 'vehicle_poster' ? renderVehiclePoster(module, state) : renderPreview(module)}
    `;

    const h1 = section.querySelector('.main-header h1') || section.querySelector('h1');
    if (h1) h1.textContent = 'Execution Hub';
    const sub = section.querySelector('.main-header .subtext');
    if (sub) sub.textContent = 'Live execution surface for Vehicle Poster, posting readiness, and future platform modules.';

    Array.from(section.children).forEach((child) => {
      if (child.classList?.contains('main-header')) return;
      if (child.id === 'executionHubHardReplaceShell') return;
      child.classList.add('execution-hub-hard-hide');
    });

    bindActions(shell);
  }

  function triggerAction(action) {
    if (action === 'download_extension') { window.open(getDownloadUrl(), '_blank', 'noopener,noreferrer'); return; }
    if (action === 'open_marketplace') { document.getElementById('openMarketplaceBtn')?.click(); return; }
    if (action === 'open_inventory_url') { document.getElementById('openInventoryBtn')?.click(); return; }
    if (action === 'refresh_extension_state') { document.getElementById('refreshAccessBtn')?.click(); return; }
    if (action === 'view_setup_steps') { if (typeof window.showSection === 'function') window.showSection('setup', { scroll:false }); return; }
    if (action === 'open_plan_access') { if (typeof window.showSection === 'function') window.showSection('billing', { scroll:false }); return; }
    if (action === 'switch_vehicle_poster') { setSelectedModule('vehicle_poster'); renderShell(); }
  }

  function bindActions(root) {
    root.querySelectorAll('[data-xhr-action]').forEach((btn) => {
      if (btn.dataset.boundXhr === 'true') return;
      btn.dataset.boundXhr = 'true';
      btn.addEventListener('click', () => triggerAction(btn.getAttribute('data-xhr-action')));
    });
    const select = root.querySelector('#executionHubHardModuleSelect');
    if (select && select.dataset.boundXhrSelect !== 'true') {
      select.dataset.boundXhrSelect = 'true';
      select.addEventListener('change', () => { setSelectedModule(select.value || 'vehicle_poster'); renderShell(); });
    }
  }

  function relabelNav() {
    const labels = {
      overview: ['Command Centre', 'Overview'],
      tools: ['Execution Hub', 'Vehicle Poster, execution'],
      analytics: ['Intelligence Centre', 'Listings, review, performance'],
      compliance: ['Compliance', 'AB/BC readiness, disclosures'],
      partners: ['Partner Network', 'Affiliates, referrals, growth'],
      setup: ['Activation', 'Profile, dealer, activation'],
      billing: ['Plan & Access', 'Plan, access, usage']
    };
    document.querySelectorAll('.sidebar-nav .nav-btn').forEach((btn) => {
      const key = clean(btn.dataset.eaNavKey || btn.dataset.section || btn.getAttribute('data-section'));
      const item = labels[key];
      if (!item) return;
      const label = btn.querySelector('.ea-nav-label');
      const detail = btn.querySelector('.ea-nav-detail');
      if (label) label.textContent = item[0];
      if (detail) detail.textContent = item[1];
      btn.setAttribute('aria-label', item[0]);
    });
  }

  function enhance() {
    ensureStyle();
    relabelNav();
    renderShell();
  }

  NS.modules = NS.modules || {};
  NS.modules.executionHubHardReplace = true;
  window.addEventListener('load', () => setTimeout(enhance, 100));
  window.addEventListener('elevate:tracking-refreshed', () => setTimeout(enhance, 100));
  window.addEventListener('elevate:summary-ready', () => setTimeout(enhance, 100));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(enhance, 100), { once:true }); else setTimeout(enhance, 100);
})();
