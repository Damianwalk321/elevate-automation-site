(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.executionHubFinalGovernor) return;
  const VERSION = '20260513c2';

  const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
  const text = (id, fb = '') => clean(document.getElementById(id)?.textContent || fb);
  const isReal = (v) => Boolean(clean(v)) && !/^(loading\.?|unknown|undefined|null|unset|missing|review)$/i.test(clean(v));
  const esc = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const n = (v) => { const x = Number(String(v ?? '').replace(/[^0-9.-]/g,'')); return Number.isFinite(x) ? x : 0; };

  function host(url, fallback) {
    const value = clean(url || fallback);
    if (!isReal(value)) return 'Inventory Source';
    try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return value; }
  }

  function route(url) {
    const value = clean(url);
    if (!isReal(value)) return 'Inventory route not connected';
    try { const u = new URL(value); return `${u.hostname}${u.pathname}`.replace(/\/$/, ''); }
    catch { return value.length > 80 ? `${value.slice(0, 80)}...` : value; }
  }

  function state() {
    const access = text('extensionAccessState', 'Unknown');
    const dealer = text('extensionDealerWebsite', '');
    const inventory = text('extensionInventoryUrl', '');
    const location = text('extensionListingLocation', '');
    const compliance = text('extensionComplianceMode', 'Unset');
    const scanner = text('extensionScannerType', 'Review');
    const remaining = text('extensionRemainingPosts', '0');
    const marketplace = text('extensionMarketplaceBridge', /active/i.test(access) ? 'Ready' : 'Review');
    const accessReady = /active|ready|connected|live/i.test(access);
    const setupReady = [dealer, inventory, location, compliance].filter(isReal).length;
    let title = 'Sync execution state', copy = 'Pull the latest access, dealer, inventory, and compliance truth before posting.', action = 'refresh_extension_state', label = 'Sync State';
    if (!accessReady) { title = 'Install or reconnect the extension'; copy = 'The live poster needs a healthy extension connection before Marketplace execution.'; action = 'install_extension'; label = 'Install Extension'; }
    else if (setupReady < 4) { title = 'Complete activation before posting'; copy = 'Dealer source, inventory route, listing location, and compliance region must be clean before execution.'; action = 'view_setup_steps'; label = 'Activation'; }
    else if (n(remaining) <= 0) { title = 'Posting capacity is used today'; copy = 'Daily posting capacity is consumed. Review Plan & Access before pushing more output.'; action = 'open_plan_access'; label = 'Plan & Access'; }
    else { title = 'Ready to execute'; copy = 'Source, access, and compliance state are in position. Open Marketplace and move the next vehicle.'; action = 'open_marketplace'; label = 'Open Marketplace'; }
    return { access, dealer, inventory, location, compliance, scanner, remaining, marketplace, accessReady, title, copy, action, label, host: host(inventory, dealer), route: route(inventory) };
  }

  function style() {
    if (document.getElementById('execution-hub-final-governor-style')) return;
    const s = document.createElement('style');
    s.id = 'execution-hub-final-governor-style';
    s.textContent = `
      #extension > :not(#executionHubFinalShell):not([data-ea-bridge-created="true"]){display:none!important;}
      #executionHubFinalShell{display:grid!important;gap:16px;margin-bottom:22px;}
      .ehf-card,.ehf-panel{background:#121212;border:1px solid rgba(212,175,55,.14);border-radius:22px;box-shadow:0 10px 30px rgba(0,0,0,.28);padding:18px}.ehf-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(340px,.8fr);gap:16px}.ehf-two,.ehf-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ehf-title{font-size:30px;line-height:1.05;margin:0 0 8px}.ehf-copy{color:#a9a9a9;line-height:1.55}.ehf-eyebrow{color:#d4af37;font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;margin-bottom:10px}.ehf-status{display:inline-flex;align-items:center;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(212,175,55,.22);background:rgba(212,175,55,.1);color:#f3ddb0;font-size:12px;font-weight:800}.ehf-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}.ehf-kpi{background:#171717;border:1px solid rgba(255,255,255,.05);border-radius:16px;padding:15px}.ehf-kpi-value{font-size:22px;font-weight:800;line-height:1.08;word-break:break-word}.ehf-kpi-sub{font-size:12px;color:#a9a9a9;line-height:1.45;margin-top:7px}.ehf-source{background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,0));border:1px solid rgba(212,175,55,.12);border-radius:18px;padding:16px;margin-bottom:14px}.ehf-source-title{font-size:24px;font-weight:900;margin-bottom:8px}.ehf-route{font-size:13px;color:#f3ddb0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ehf-pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ehf-pill{display:inline-flex;align-items:center;min-height:30px;padding:0 10px;border-radius:999px;border:1px solid rgba(212,175,55,.18);background:rgba(212,175,55,.08);color:#f3ddb0;font-size:12px;font-weight:800}.ehf-command-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}.ehf-command-actions button,.ehf-actions button{min-height:50px}.ehf-details{margin-top:16px;border-top:1px solid rgba(255,255,255,.06);padding-top:14px}.ehf-details summary{cursor:pointer;color:#f3ddb0;font-size:13px;font-weight:900;letter-spacing:.5px;text-transform:uppercase}.ehf-row{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.05)}.ehf-row:last-child{border-bottom:none}.ehf-label{font-weight:800}.ehf-value{text-align:right;color:#f3ddb0;word-break:break-word;line-height:1.45}.ehf-modal-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:22px}.ehf-modal{width:min(720px,96vw);max-height:90vh;overflow:auto;background:#101010;border:1px solid rgba(212,175,55,.22);border-radius:24px;box-shadow:0 24px 80px rgba(0,0,0,.6);padding:22px}.ehf-step{background:#171717;border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:14px;margin-top:10px;line-height:1.45}@media(max-width:1100px){.ehf-grid{grid-template-columns:1fr}}@media(max-width:720px){.ehf-two,.ehf-actions{grid-template-columns:1fr}.ehf-command-actions{display:grid}}
    `;
    document.head.appendChild(s);
  }

  function render() {
    const section = document.getElementById('extension');
    if (!section) return;
    style();
    const x = state();
    let shell = document.getElementById('executionHubFinalShell');
    if (!shell) { shell = document.createElement('div'); shell.id = 'executionHubFinalShell'; section.prepend(shell); }
    shell.innerHTML = `
      <div class="ehf-card"><div class="ehf-head"><div><div class="ehf-eyebrow">Execution Module</div><h2 class="ehf-title">Execution Hub</h2><div class="ehf-copy">Vehicle Poster is the live execution surface. Analytics stay inside Intelligence Centre.</div></div><div class="ehf-status">Vehicle Poster · Live Now</div></div></div>
      <div class="ehf-grid"><div class="ehf-card"><div class="ehf-eyebrow">Execution Command</div><h2 class="ehf-title">${esc(x.title)}</h2><div class="ehf-copy">${esc(x.copy)}</div><div class="ehf-command-actions"><button class="btn-primary" type="button" data-ehf-action="${esc(x.action)}">${esc(x.label)}</button><button class="action-btn" type="button" data-ehf-action="install_extension">Install Extension</button></div></div><div class="ehf-card"><div class="ehf-eyebrow">Execution Status</div><div class="ehf-two"><div class="ehf-kpi"><div class="ehf-eyebrow">Poster Status</div><div class="ehf-kpi-value">${x.accessReady ? 'Ready' : 'Review'}</div><div class="ehf-kpi-sub">Can the poster be used right now?</div></div><div class="ehf-kpi"><div class="ehf-eyebrow">Access State</div><div class="ehf-kpi-value">${esc(x.access)}</div><div class="ehf-kpi-sub">Current account/extension truth.</div></div><div class="ehf-kpi"><div class="ehf-eyebrow">Compliance Region</div><div class="ehf-kpi-value">${esc(x.compliance)}</div><div class="ehf-kpi-sub">Active publish rule profile.</div></div><div class="ehf-kpi"><div class="ehf-eyebrow">Remaining Today</div><div class="ehf-kpi-value">${esc(x.remaining)}</div><div class="ehf-kpi-sub">Posting capacity available today.</div></div></div></div></div>
      <div class="ehf-grid"><div class="ehf-panel"><div class="ehf-eyebrow">Inventory Source</div><div class="ehf-source"><div class="ehf-source-title">${esc(x.host)}</div><div class="ehf-route" title="${esc(x.inventory)}">${esc(x.route)}</div><div class="ehf-pills"><span class="ehf-pill">${isReal(x.dealer) ? 'Connected' : 'Review'}</span><span class="ehf-pill">${esc(x.location || 'Location missing')}</span><span class="ehf-pill">${esc(x.compliance || 'Unset')}</span></div></div><div class="ehf-command-actions" style="margin-top:0;"><button class="action-btn" type="button" data-ehf-action="open_inventory_url">Open Source</button><button class="action-btn" type="button" data-ehf-action="copy_inventory_url">Copy URL</button><button class="action-btn" type="button" data-ehf-action="view_setup_steps">Change Source</button></div><details class="ehf-details"><summary>Advanced Diagnostics</summary><div style="margin-top:12px;"><div class="ehf-row"><div class="ehf-label">Inventory Detection</div><div class="ehf-value">${esc(x.scanner)}</div></div><div class="ehf-row"><div class="ehf-label">Dealer Source</div><div class="ehf-value">${esc(x.dealer || 'Review')}</div></div><div class="ehf-row"><div class="ehf-label">Raw Inventory Route</div><div class="ehf-value">${esc(x.inventory || 'Review')}</div></div><div class="ehf-row"><div class="ehf-label">Marketplace Bridge</div><div class="ehf-value">${esc(x.marketplace)}</div></div></div></details></div><div class="ehf-panel"><div class="ehf-eyebrow">Primary Actions</div><div class="ehf-actions"><button class="action-btn" type="button" data-ehf-action="install_extension">Install Extension</button><button class="action-btn" type="button" data-ehf-action="open_marketplace">Open Marketplace</button><button class="action-btn" type="button" data-ehf-action="open_inventory_url">Open Source</button><button class="action-btn" type="button" data-ehf-action="refresh_extension_state">Sync State</button><button class="action-btn" type="button" data-ehf-action="view_setup_steps">Activation</button><button class="action-btn" type="button" data-ehf-action="open_plan_access">Plan & Access</button></div><div class="ehf-copy" style="margin-top:14px;font-size:13px;">Install Extension opens guided instructions: download, unzip, Chrome Extensions, Developer Mode, Load Unpacked, then Sync State.</div></div></div>`;
    bind(shell);
    section.dataset.executionHubGovernor = VERSION;
  }

  function modal() {
    document.getElementById('ehfInstallModal')?.remove();
    const m = document.createElement('div');
    m.id = 'ehfInstallModal';
    m.className = 'ehf-modal-backdrop';
    m.innerHTML = `<div class="ehf-modal"><div class="ehf-head"><div><div class="ehf-eyebrow">Vehicle Poster Extension</div><h2 class="ehf-title">Install the latest extension build</h2><div class="ehf-copy">Keep this overlay open while installing.</div></div><button class="action-btn" type="button" data-ehf-action="close_modal">Close</button></div><div class="ehf-step"><strong>1. Download the latest build.</strong><br>Use the button below.</div><div class="ehf-step"><strong>2. Unzip the file.</strong><br>Move the extracted folder somewhere permanent.</div><div class="ehf-step"><strong>3. Open Chrome Extensions.</strong><br>Go to the Chrome extensions page manually.</div><div class="ehf-step"><strong>4. Turn on Developer Mode.</strong><br>Use the top-right toggle.</div><div class="ehf-step"><strong>5. Load Unpacked.</strong><br>Select the folder containing manifest.json.</div><div class="ehf-step"><strong>6. Return here and Sync State.</strong></div><div class="ehf-command-actions"><button class="btn-primary" type="button" data-ehf-action="download_extension">Download Latest Build</button><button class="action-btn" type="button" data-ehf-action="refresh_extension_state">Sync State</button></div></div>`;
    document.body.appendChild(m); bind(m);
  }

  function run(action) {
    const x = state();
    if (action === 'install_extension') return modal();
    if (action === 'download_extension') return window.open(`/downloads/elevate-automation-extension.zip?v=${Date.now()}`, '_blank', 'noopener,noreferrer');
    if (action === 'close_modal') return document.getElementById('ehfInstallModal')?.remove();
    if (action === 'open_marketplace') return document.getElementById('openMarketplaceBtn')?.click();
    if (action === 'open_inventory_url') return document.getElementById('openInventoryBtn')?.click();
    if (action === 'copy_inventory_url') return navigator.clipboard?.writeText?.(x.inventory || '');
    if (action === 'refresh_extension_state') return (document.getElementById('refreshExtensionStateBtn') || document.getElementById('refreshAccessBtn'))?.click();
    if (action === 'view_setup_steps') return window.showSection?.('profile');
    if (action === 'open_plan_access') return window.showSection?.('billing');
  }

  function bind(root) {
    root.querySelectorAll('[data-ehf-action]').forEach((btn) => {
      if (btn.dataset.ehfBound === 'true') return;
      btn.dataset.ehfBound = 'true';
      btn.addEventListener('click', () => run(btn.getAttribute('data-ehf-action')));
    });
  }

  function boot() {
    render();
    const section = document.getElementById('extension');
    if (section) new MutationObserver(() => setTimeout(render, 20)).observe(section, { childList: true });
    window.addEventListener('elevate:summary-ready', () => setTimeout(render, 80));
    window.addEventListener('elevate:tracking-refreshed', () => setTimeout(render, 80));
    setInterval(render, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
  NS.modules = NS.modules || {};
  NS.modules.executionHubFinalGovernor = true;
})();
