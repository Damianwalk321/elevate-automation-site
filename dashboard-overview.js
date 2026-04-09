(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.overview) return;

  const CSS = `
    .g-shell{display:grid;gap:16px}
    .g-command-rail{display:grid;grid-template-columns:1.5fr repeat(4,minmax(0,1fr));gap:12px}
    .g-card,.g-hero{border:1px solid rgba(212,175,55,.14);border-radius:16px;padding:16px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006));box-shadow:0 10px 30px rgba(0,0,0,.22)}
    .g-hero{background:radial-gradient(circle at top right,rgba(212,175,55,.12),transparent 28%),linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,.006))}
    .g-eyebrow{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:rgba(212,175,55,.1);border:1px solid rgba(212,175,55,.16);color:#f3ddb0;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px}
    .g-title{font-size:28px;line-height:1.05;margin:0 0 8px}
    .g-copy{color:#d6d6d6;font-size:14px;line-height:1.55}
    .g-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
    .g-kicker{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#d4af37;font-weight:700;margin-bottom:10px}
    .g-metric{font-size:28px;line-height:1;font-weight:800;color:#f3ddb0;margin-bottom:8px}
    .g-sub{color:#a9a9a9;font-size:12px;line-height:1.45}
    .g-queue{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .g-list{display:grid;gap:10px;margin-top:12px}
    .g-item{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .g-item strong{display:block;font-size:15px;margin-bottom:6px}
    .g-item .meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    .g-pill{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.08);background:#171717;color:#f4f4f4}
    .g-pill.revenue{color:#f3ddb0;border-color:rgba(212,175,55,.16);background:rgba(212,175,55,.1)}
    .g-pill.blocked{color:#ffb4b4;border-color:rgba(255,180,180,.16);background:rgba(120,20,20,.18)}
    .g-pill.cleanup{color:#d6d6d6;border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.05)}
    .g-pill.growth{color:#9de8a8;border-color:rgba(157,232,168,.16);background:rgba(46,125,50,.14)}
    .g-collapse{border:1px solid rgba(212,175,55,.1);border-radius:16px;overflow:hidden;background:#111}
    .g-collapse-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;background:rgba(255,255,255,.02)}
    .g-collapse-body{display:none;padding:16px;border-top:1px solid rgba(212,175,55,.08)}
    .g-collapse.open .g-collapse-body{display:block}
    @media (max-width:1280px){.g-command-rail{grid-template-columns:1fr 1fr}.g-hero{grid-column:1/-1}}
    @media (max-width:760px){.g-command-rail{grid-template-columns:1fr}.g-title{font-size:24px}}
  `;

  const txt = (id) => String(document.getElementById(id)?.textContent || '').replace(/\s+/g, ' ').trim();
  const num = (v) => { const m = String(v || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : 0; };
  const ready = (v) => /ready|good|saved|active|configured/i.test(String(v || ''));
  function open(section, focusId) {
    try { if (typeof window.showSection === 'function') window.showSection(section); } catch {}
    if (focusId) setTimeout(() => { const el = document.getElementById(focusId); if (el) { el.scrollIntoView({behavior:'smooth', block:'center'}); try { el.focus(); } catch {} } }, 220);
  }
  function ensureStyle() {
    if (document.getElementById('bundle-g-overview-style')) return;
    const style = document.createElement('style'); style.id = 'bundle-g-overview-style'; style.textContent = CSS; document.head.appendChild(style);
  }
  function model() {
    const postsRemaining = num(txt('kpiPostsRemaining'));
    const queued = num(txt('kpiQueuedVehicles'));
    const review = num(txt('kpiReviewQueue'));
    const needsAction = num(txt('kpiNeedsAction'));
    const weak = num(txt('kpiWeakListings'));
    const referrals = num(txt('affiliateActiveReferrals'));
    const views = num(txt('kpiViews'));
    const messages = num(txt('kpiMessages'));
    const checks = [
      ['Dealer website', txt('setupDealerWebsite'), 'dealer_website'],
      ['Inventory URL', txt('setupInventoryUrl'), 'inventory_url'],
      ['Scanner', txt('setupScannerType'), 'scanner_type'],
      ['Listing location', txt('setupListingLocation'), 'listing_location'],
      ['Compliance mode', txt('setupComplianceMode'), 'compliance_mode'],
      ['Access', txt('setupAccess'), null]
    ];
    const missing = checks.filter(([,v]) => !ready(v));
    let primary = { title:'Keep execution moving.', copy:'Open the next highest-leverage move and keep the operating rhythm clean.', section:'extension', focus:null, label:'Open Tools' };
    const queue = [];
    if (missing.length) {
      const [label,,focus] = missing[0];
      primary = { title:'Close the blocking setup gap.', copy:`${label} is still incomplete. Finish the blocking field and bring the posting system fully online.`, section: label === 'Access' ? 'extension' : 'profile', focus, label: label === 'Access' ? 'Refresh Access' : 'Fix Setup' };
      queue.push({ kind:'blocked', title:`Fix ${label}`, copy:'This is directly blocking cleaner posting readiness.', action:primary });
    } else if (queued <= 0) {
      primary = { title:'Queue the next vehicle.', copy:'Your core setup is ready. Move into inventory and queue the next vehicle for Marketplace.', section:'extension', focus:null, label:'Open Inventory' };
      queue.push({ kind:'cleanup', title:'Queue next vehicle', copy:'No ready queue is available right now.', action:primary });
    } else if (postsRemaining > 0) {
      primary = { title:'Use today’s remaining capacity.', copy:`${postsRemaining} posting slot${postsRemaining===1?'':'s'} remain. Convert queue into live output while the system is ready.`, section:'extension', focus:null, label:'Open Marketplace' };
      queue.push({ kind:'growth', title:'Use remaining post capacity', copy:'Unused capacity is idle leverage.', action:primary });
    }
    if (needsAction > 0) queue.push({ kind:'revenue', title:`Clear ${needsAction} intervention item${needsAction===1?'':'s'}`, copy:'Resolve listings needing action before more volume is added.', action:{ label:'Review listings', section:'overview', focus:'listingSearchInput' } });
    if (review > 0) queue.push({ kind:'cleanup', title:`Work ${review} review item${review===1?'':'s'}`, copy:'Review queue items are waiting for validation or cleanup.', action:{ label:'Open listings', section:'overview', focus:'listingSearchInput' } });
    if (weak > 0) queue.push({ kind:'revenue', title:`Rescue ${weak} weak performer${weak===1?'':'s'}`, copy:'Underperforming listings need copy, pricing, or media intervention.', action:{ label:'Open Analytics', section:'tools', focus:null } });
    if (views > 0 && messages === 0) queue.push({ kind:'revenue', title:'Traction without conversion', copy:'Views are landing, but messages are not. Review CTA, copy, and pricing.', action:{ label:'Open Analytics', section:'tools', focus:null } });
    if (referrals === 0) queue.push({ kind:'growth', title:'Activate first paying partner', copy:'Partner revenue is still at zero. Start a small referral loop and build recurring income.', action:{ label:'Open Partners', section:'affiliate', focus:null } });
    if (!queue.length) queue.push({ kind:'growth', title:'System stable — stay in output mode', copy:'Use postings, listing review, and partner outreach to keep momentum compounding.', action:{ label:'Open Tools', section:'extension', focus:null } });
    return { postsRemaining, blockerCount: missing.length, revenueAttention: needsAction + weak, referrals, primary, queue: queue.slice(0, 6) };
  }
  function render() {
    const overview = document.getElementById('overview');
    if (!overview) return;
    ensureStyle();
    const commandGrid = overview.querySelector('.command-center-grid');
    const operatorStrip = document.getElementById('overviewOperatorStrip');
    const priorityGrid = document.getElementById('overviewPriorityGrid');
    const performanceGrid = document.getElementById('overviewPerformanceGrid');
    const listingsCard = document.getElementById('overviewListingsCard');
    const accountGrid = document.getElementById('overviewAccountGrid');
    const upgradeCard = document.getElementById('overviewUpgradeCard');
    if (!commandGrid || !operatorStrip || !priorityGrid || !listingsCard) return;

    let shell = document.getElementById('bundleGOverviewShell');
    if (!shell) { shell = document.createElement('div'); shell.id = 'bundleGOverviewShell'; shell.className = 'g-shell'; overview.prepend(shell); }
    const m = model();

    let rail = document.getElementById('bundleGCommandRail');
    if (!rail) { rail = document.createElement('div'); rail.id = 'bundleGCommandRail'; rail.className = 'g-command-rail'; shell.appendChild(rail); }
    rail.innerHTML = `
      <div class="g-hero">
        <div class="g-eyebrow">Revenue OS</div>
        <h2 class="g-title">${m.primary.title}</h2>
        <div class="g-copy">${m.primary.copy}</div>
        <div class="g-actions">
          <button id="bundleGPrimaryBtn" class="btn-primary" type="button">${m.primary.label}</button>
          <button id="bundleGQueueBtn" class="action-btn" type="button">Open Action Center</button>
        </div>
      </div>
      <div class="g-card"><div class="g-kicker">Blockers</div><div class="g-metric">${m.blockerCount}</div><div class="g-sub">Setup, access, or readiness gaps still slowing output.</div></div>
      <div class="g-card"><div class="g-kicker">Post Capacity</div><div class="g-metric">${m.postsRemaining}</div><div class="g-sub">Remaining live posting capacity for today.</div></div>
      <div class="g-card"><div class="g-kicker">Revenue Attention</div><div class="g-metric">${m.revenueAttention}</div><div class="g-sub">Listings needing intervention, review, or rescue.</div></div>
      <div class="g-card"><div class="g-kicker">Recurring Revenue</div><div class="g-metric">${m.referrals}</div><div class="g-sub">Active paying partner relationships in motion.</div></div>`;
    document.getElementById('bundleGPrimaryBtn')?.addEventListener('click', () => open(m.primary.section, m.primary.focus));
    document.getElementById('bundleGQueueBtn')?.addEventListener('click', () => document.getElementById('bundleGMasterQueue')?.scrollIntoView({behavior:'smooth', block:'start'}));

    let queueCard = document.getElementById('bundleGMasterQueue');
    if (!queueCard) { queueCard = document.createElement('div'); queueCard.id = 'bundleGMasterQueue'; queueCard.className = 'g-queue'; shell.appendChild(queueCard); }
    queueCard.innerHTML = `<div class="section-head"><div><div class="g-eyebrow">Unified Action Center</div><h2 style="margin-top:6px;">What matters now</h2><div class="subtext">One ranked execution queue across setup, output, revenue, cleanup, and growth.</div></div></div><div class="g-list">${m.queue.map((item, idx) => `<div class="g-item"><div><strong>${idx+1}. ${item.title}</strong><div class="meta">${item.copy}</div></div><div style="display:grid;gap:10px;justify-items:end;"><span class="g-pill ${item.kind}">${item.kind === 'blocked' ? 'Blocked' : item.kind === 'revenue' ? 'Revenue' : item.kind === 'growth' ? 'Growth' : 'Cleanup'}</span><button class="action-btn" type="button" data-g-action="${idx}">${item.action.label}</button></div></div>`).join('')}</div>`;
    queueCard.querySelectorAll('[data-g-action]').forEach((btn) => btn.addEventListener('click', () => { const item = m.queue[Number(btn.getAttribute('data-g-action'))]; if (item) open(item.action.section, item.action.focus); }));

    [commandGrid, operatorStrip, priorityGrid, performanceGrid].filter(Boolean).forEach((el) => { if (!shell.contains(el)) shell.appendChild(el); });
    let collapse = document.getElementById('bundleGSecondaryCollapse');
    if (!collapse) {
      collapse = document.createElement('div');
      collapse.id = 'bundleGSecondaryCollapse';
      collapse.className = 'g-collapse open';
      collapse.innerHTML = `<div class="g-collapse-head"><div><div class="g-eyebrow">Quiet Mode</div><strong>Secondary detail and account context</strong></div><div class="subtext" id="bundleGSecondaryState">Collapse</div></div><div class="g-collapse-body"></div>`;
      shell.appendChild(collapse);
      collapse.querySelector('.g-collapse-head').addEventListener('click', () => { collapse.classList.toggle('open'); const state = collapse.querySelector('#bundleGSecondaryState'); if (state) state.textContent = collapse.classList.contains('open') ? 'Collapse' : 'Expand'; });
    }
    const body = collapse.querySelector('.g-collapse-body');
    [accountGrid, upgradeCard].filter(Boolean).forEach((el) => { if (body && !body.contains(el)) body.appendChild(el); });
    if (!shell.contains(listingsCard)) shell.appendChild(listingsCard);
  }

  NS.overview = { renderBundleG: render };
  NS.modules = NS.modules || {};
  NS.modules.overview = true;
  const boot = () => { render(); setTimeout(render, 1200); setTimeout(render, 3200); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
