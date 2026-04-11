(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.analytics) return;

  const CSS = `
    .f-analytics-shell{display:grid;gap:16px}
    .f-analytics-card,.f-analytics-hero{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .f-analytics-hero-grid{display:grid;grid-template-columns:1.4fr repeat(4,minmax(0,1fr));gap:12px}
    .f-a-title{font-size:28px;line-height:1.05;margin:0 0 8px}.f-a-copy{color:#d6d6d6;line-height:1.55;font-size:14px}
    .f-a-list{display:grid;gap:10px;margin-top:12px}
    .f-a-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .f-a-meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    .f-sync-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .f-mini{font-size:12px;color:#b8b8b8;line-height:1.5}
    .f-pill{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.08);background:#171717}
    .f-pill.synced{color:#9de8a8;border-color:rgba(157,232,168,.22)}
    .f-pill.tracked{color:#f3ddb0;border-color:rgba(212,175,55,.22)}
    .f-pill.estimated{color:#ffcfad;border-color:rgba(255,207,173,.22)}
    @media (max-width:1200px){.f-analytics-hero-grid,.f-sync-grid{grid-template-columns:1fr 1fr}}
    @media (max-width:760px){.f-analytics-hero-grid,.f-sync-grid{grid-template-columns:1fr}.f-a-title{font-size:24px}}
  `;
  function ensureStyle(){ if(document.getElementById('package-f-analytics-style')) return; const s=document.createElement('style'); s.id='package-f-analytics-style'; s.textContent=CSS; document.head.appendChild(s); }
  function state(path, fallback){ return NS.state?.get?.(path, fallback); }
  function open(section, focusId){ try{ if(typeof window.showSection==='function') window.showSection(section);}catch{} if(focusId) setTimeout(()=>document.getElementById(focusId)?.scrollIntoView({behavior:'smooth', block:'center'}),220); }
  function renderBlock(title, items){
    return `<div class="f-analytics-card"><div class="stat-label">${title}</div><div class="f-mini">${
      items.length ? items.slice(0,3).map(item => `${item.title||'Listing'} · ${item.health_state||item.status||'active'} · ${item.confidence||item.sync_confidence||'local'}`).join("<br>")
      : "No listings in this bucket yet."
    }</div></div>`;
  }

  function render() {
    const section = document.getElementById('tools');
    if (!section || !NS.state) return;
    ensureStyle();

    const analytics = state("analytics", {}) || {};
    const tracking = analytics.tracking_summary || {};
    const sync = state("sync", {}) || {};
    const actions = Array.isArray(analytics.action_queue) ? analytics.action_queue : [];

    let shell = document.getElementById('packageFAnalyticsShell');
    if (!shell) { shell = document.createElement('div'); shell.id='packageFAnalyticsShell'; shell.className='f-analytics-shell'; section.prepend(shell); }

    let hero = document.getElementById('packageFAnalyticsHero');
    if (!hero) { hero = document.createElement('div'); hero.id='packageFAnalyticsHero'; hero.className='f-analytics-hero'; shell.appendChild(hero); }
    hero.innerHTML = `<div class="f-analytics-hero-grid">
      <div class="f-analytics-card">
        <div class="g-eyebrow">Unified Sync</div>
        <h2 class="f-a-title">Analytics now prefers synced history over local inference.</h2>
        <div class="f-a-copy">When remote listing payloads and event history are present, the dashboard should treat those as the primary source of truth and use DOM-assisted signal only as fallback.</div>
      </div>
      <div class="f-analytics-card"><div class="stat-label">Sync Source</div><div class="stat-value" style="font-size:24px">${tracking.sync_source||sync.source||'local_only'}</div><div class="stat-sub">Current ingestion owner.</div></div>
      <div class="f-analytics-card"><div class="stat-label">Confidence</div><div class="stat-value" style="font-size:24px">${tracking.sync_confidence||sync.confidence||'local'}</div><div class="stat-sub">Truth quality of this session.</div></div>
      <div class="f-analytics-card"><div class="stat-label">Remote Listings</div><div class="stat-value" style="font-size:24px">${tracking.sync_remote_listing_count||sync.remote_listing_count||0}</div><div class="stat-sub">Listings ingested from remote payloads.</div></div>
      <div class="f-analytics-card"><div class="stat-label">Remote Events</div><div class="stat-value" style="font-size:24px">${tracking.sync_remote_event_count||sync.remote_event_count||0}</div><div class="stat-sub">Event rows ingested from remote payloads.</div></div>
    </div>`;

    let syncCard = document.getElementById('packageFAnalyticsSync');
    if (!syncCard) { syncCard = document.createElement('div'); syncCard.id='packageFAnalyticsSync'; syncCard.className='f-analytics-card'; shell.appendChild(syncCard); }
    const confidenceClass = String(sync.confidence||'').toLowerCase().includes('sync') ? 'synced' : (String(sync.confidence||'').toLowerCase().includes('track') ? 'tracked' : 'estimated');
    syncCard.innerHTML = `<div class="section-head"><div><div class="g-eyebrow">Sync Integrity</div><h2 style="margin-top:6px;">Current truth state</h2><div class="subtext">Use this as the trust layer for registry counts, lifecycle buckets, and recommendation confidence.</div></div></div>
      <div class="f-sync-grid">
        <div class="f-analytics-card"><div class="stat-label">Last Ingest</div><div class="f-mini">${sync.last_ingest_at||"Not synced yet."}</div></div>
        <div class="f-analytics-card"><div class="stat-label">Last Reconcile</div><div class="f-mini">${sync.last_reconcile_at||"Not reconciled yet."}</div></div>
        <div class="f-analytics-card"><div class="stat-label">Issues</div><div class="f-mini">${(sync.issues||[]).length ? (sync.issues||[]).join("<br>") : "No active sync issues reported."}</div></div>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
        <span class="f-pill ${confidenceClass}">${sync.confidence||'local'}</span>
        <span class="f-pill tracked">listing_seen: ${tracking.listing_seen_events||0}</span>
        <span class="f-pill tracked">view_update: ${tracking.view_update_events||0}</span>
        <span class="f-pill tracked">message_update: ${tracking.message_update_events||0}</span>
        <span class="f-pill tracked">price_changed: ${tracking.price_changed_events||0}</span>
      </div>`;

    let queue = document.getElementById('packageFAnalyticsQueue');
    if (!queue) { queue = document.createElement('div'); queue.id='packageFAnalyticsQueue'; queue.className='f-analytics-card'; shell.appendChild(queue); }
    queue.innerHTML = `<div class="section-head"><div><div class="g-eyebrow">Decision Queue</div><h2 style="margin-top:6px;">Truth-aware analytics actions</h2><div class="subtext">These recommendations now distinguish synced history from local fallback.</div></div></div>
      <div class="f-a-list">${actions.map((item, idx) => `
        <div class="f-a-item">
          <div><strong>${idx+1}. ${item.title}</strong><div class="f-a-meta">${item.copy || ""}<br><br><em>${item.reason || ""}</em></div></div>
          <div style="display:grid;gap:10px;justify-items:end;">
            <span class="g-pill ${item.tone||'growth'}">${item.tone==='revenue'?'Revenue':item.tone==='cleanup'?'Cleanup':'Growth'}</span>
            <button class="action-btn" type="button" data-f-open="${item.section||'tools'}" data-f-focus="${item.focus||''}">Open</button>
          </div>
        </div>`).join("")}</div>`;
    queue.querySelectorAll('[data-f-open]').forEach(btn => {
      if (btn.dataset.boundF === 'true') return;
      btn.dataset.boundF = 'true';
      btn.addEventListener('click', () => open(btn.getAttribute('data-f-open'), btn.getAttribute('data-f-focus')));
    });

    let leaders = document.getElementById('packageFAnalyticsLeaders');
    if (!leaders) { leaders = document.createElement('div'); leaders.id='packageFAnalyticsLeaders'; leaders.className='f-analytics-card'; shell.appendChild(leaders); }
    leaders.innerHTML = `<div class="section-head"><div><div class="g-eyebrow">Registry Leaders</div><h2 style="margin-top:6px;">Synced and fallback intelligence buckets</h2><div class="subtext">These groups should become more authoritative as live event ingestion increases.</div></div></div>
      <div class="f-sync-grid">
        ${renderBlock("Message Leaders", analytics.leaders?.message_leaders || [])}
        ${renderBlock("View Leaders", analytics.leaders?.view_leaders || [])}
        ${renderBlock("Fresh Traction", analytics.leaders?.fresh_traction || [])}
        ${renderBlock("Price Attention", analytics.leaders?.price_attention || [])}
        ${renderBlock("Needs Refresh", analytics.leaders?.needs_refresh || [])}
        ${renderBlock("Recovered", analytics.leaders?.recovered || [])}
      </div>`;
  }

  NS.analytics = { renderPackageF: render };
  NS.modules = NS.modules || {};
  NS.modules.analytics = true;

  const boot = () => { render(); setTimeout(render, 1200); setTimeout(render, 3200); };
  window.addEventListener('elevate:tracking-refreshed', () => render());
  window.addEventListener('elevate:sync-refreshed', () => render());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();