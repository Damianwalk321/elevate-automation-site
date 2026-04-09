
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.analytics) return;
  const CSS = `
    .d-analytics-shell{display:grid;gap:16px}
    .d-analytics-card,.d-analytics-hero{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .d-analytics-hero-grid{display:grid;grid-template-columns:1.4fr repeat(4,minmax(0,1fr));gap:12px}
    .d-a-title{font-size:28px;line-height:1.05;margin:0 0 8px}.d-a-copy{color:#d6d6d6;line-height:1.55;font-size:14px}
    .d-a-list{display:grid;gap:10px;margin-top:12px}
    .d-a-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .d-a-meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    .d-sync-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .d-mini{font-size:12px;color:#b8b8b8;line-height:1.5}
    .d-pill{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.08);background:#171717}
    .d-pill.synced{color:#9de8a8;border-color:rgba(157,232,168,.22)}
    .d-pill.tracked{color:#f3ddb0;border-color:rgba(212,175,55,.22)}
    .d-pill.estimated{color:#ffcfad;border-color:rgba(255,207,173,.22)}
    .d-collapse{border:1px solid rgba(212,175,55,.10);border-radius:16px;overflow:hidden;background:#111}
    .d-collapse-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;background:rgba(255,255,255,.02)}
    .d-collapse-body{display:none;padding:16px;border-top:1px solid rgba(212,175,55,.08)} .d-collapse.open .d-collapse-body{display:block}
    @media (max-width:1200px){.d-analytics-hero-grid,.d-sync-grid{grid-template-columns:1fr 1fr}}
    @media (max-width:760px){.d-analytics-hero-grid,.d-sync-grid{grid-template-columns:1fr}.d-a-title{font-size:24px}}
  `;
  function ensureStyle(){ if(document.getElementById('bundle-d-analytics-style')) return; const s=document.createElement('style'); s.id='bundle-d-analytics-style'; s.textContent=CSS; document.head.appendChild(s); }
  function state(path, fallback){ return NS.state?.get?.(path, fallback); }
  function open(section, focusId){ try{ if(typeof window.showSection==='function') window.showSection(section);}catch{} if(focusId) setTimeout(()=>document.getElementById(focusId)?.scrollIntoView({behavior:'smooth', block:'center'}),220); }
  function buildActions(){
    const analytics=state("analytics",{}) || {}, tracking=analytics.tracking_summary || {}, queue=Array.isArray(analytics.action_queue)?analytics.action_queue:[], sync=state("sync",{}) || {};
    const actions=queue.map(item=>({...item, reason:item.reason || "Derived from current listing signal."}));
    if((sync.issues||[]).length) actions.unshift({id:"sync_issue",title:"Sync truth is degraded",copy:(sync.issues||[]).slice(0,2).join(" "),tone:"cleanup",section:"tools",focus:"listingSearchInput",reason:"Remote payload quality is incomplete."});
    if((tracking.sync_remote_event_count||0)>0 && (tracking.fresh_traction_count||0)>0) actions.unshift({id:"fresh_remote_signal",title:`${tracking.fresh_traction_count} listing${tracking.fresh_traction_count===1?"":"s"} have remote fresh traction`,copy:"These are backed by synced event history, not only local snapshot inference.",tone:"growth",section:"overview",focus:"listingSearchInput",reason:"Remote event ingestion confirms recent message activity."});
    return actions.slice(0,6);
  }
  function renderLeaders(leaders={}){
    const blocks=[["Message Leaders", leaders.message_leaders||[]],["View Leaders", leaders.view_leaders||[]],["Fresh Traction", leaders.fresh_traction||[]],["Price Attention", leaders.price_attention||[]],["Needs Refresh", leaders.needs_refresh||[]],["Recovered", leaders.recovered||[]]];
    return blocks.map(([label,items])=>`<div class="d-analytics-card"><div class="stat-label">${label}</div><div class="d-mini">${items.length ? items.slice(0,3).map(item => `${item.title||"Listing"} · ${item.health_state||item.status||"active"} · ${item.confidence||item.sync_confidence||"local"}`).join("<br>") : "No listings in this bucket yet."}</div></div>`).join("");
  }
  function render(){
    const section=document.getElementById('tools'); if(!section || !NS.state) return; ensureStyle();
    const analytics=state("analytics",{}) || {}, tracking=analytics.tracking_summary || {}, sync=state("sync",{}) || {}, actions=buildActions();
    let shell=document.getElementById('bundleDAnalyticsShell'); if(!shell){ shell=document.createElement('div'); shell.id='bundleDAnalyticsShell'; shell.className='d-analytics-shell'; section.prepend(shell); }
    let hero=document.getElementById('bundleDAnalyticsHero'); if(!hero){ hero=document.createElement('div'); hero.id='bundleDAnalyticsHero'; hero.className='d-analytics-hero'; shell.appendChild(hero); }
    hero.innerHTML=`<div class="d-analytics-hero-grid"><div class="d-analytics-card"><div class="g-eyebrow">Sync Truth</div><h2 class="d-a-title">Analytics now distinguishes synced truth from local fallback.</h2><div class="d-a-copy">This layer prefers remote listing payloads and event history when available, then falls back to DOM-assisted local tracking only when sync is missing.</div></div><div class="d-analytics-card"><div class="stat-label">Sync Source</div><div class="stat-value" style="font-size:24px">${tracking.sync_source||sync.source||'local_only'}</div><div class="stat-sub">Current ingestion owner.</div></div><div class="d-analytics-card"><div class="stat-label">Confidence</div><div class="stat-value" style="font-size:24px">${tracking.sync_confidence||sync.confidence||'local'}</div><div class="stat-sub">Truth quality of current session.</div></div><div class="d-analytics-card"><div class="stat-label">Remote Listings</div><div class="stat-value" style="font-size:24px">${tracking.sync_remote_listing_count||sync.remote_listing_count||0}</div><div class="stat-sub">Listings ingested from synced payloads.</div></div><div class="d-analytics-card"><div class="stat-label">Remote Events</div><div class="stat-value" style="font-size:24px">${tracking.sync_remote_event_count||sync.remote_event_count||0}</div><div class="stat-sub">Events ingested from synced payloads.</div></div></div>`;
    let syncCard=document.getElementById('bundleDAnalyticsSync'); if(!syncCard){ syncCard=document.createElement('div'); syncCard.id='bundleDAnalyticsSync'; syncCard.className='d-analytics-card'; shell.appendChild(syncCard); }
    const confidenceClass=String(sync.confidence||"").toLowerCase().includes('sync') ? 'synced' : (String(sync.confidence||"").toLowerCase().includes('track') ? 'tracked' : 'estimated');
    syncCard.innerHTML=`<div class="section-head"><div><div class="g-eyebrow">Sync Integrity</div><h2 style="margin-top:6px;">Current truth state</h2><div class="subtext">The goal is to move from local inference to synced listing history without breaking the live operator flow.</div></div></div><div class="d-sync-grid"><div class="d-analytics-card"><div class="stat-label">Last Ingest</div><div class="d-mini">${sync.last_ingest_at||"Not synced yet."}</div></div><div class="d-analytics-card"><div class="stat-label">Last Reconcile</div><div class="d-mini">${sync.last_reconcile_at||"Not reconciled yet."}</div></div><div class="d-analytics-card"><div class="stat-label">Issues</div><div class="d-mini">${(sync.issues||[]).length ? (sync.issues||[]).join("<br>") : "No active sync issues reported."}</div></div></div><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;"><span class="d-pill ${confidenceClass}">${sync.confidence||'local'}</span><span class="d-pill tracked">listing_seen: ${tracking.listing_seen_events||0}</span><span class="d-pill tracked">view_update: ${tracking.view_update_events||0}</span><span class="d-pill tracked">message_update: ${tracking.message_update_events||0}</span><span class="d-pill tracked">price_changed: ${tracking.price_changed_events||0}</span></div>`;
    let queue=document.getElementById('bundleDAnalyticsQueue'); if(!queue){ queue=document.createElement('div'); queue.id='bundleDAnalyticsQueue'; queue.className='d-analytics-card'; shell.appendChild(queue); }
    queue.innerHTML=`<div class="section-head"><div><div class="g-eyebrow">Decision Queue</div><h2 style="margin-top:6px;">Truth-aware analytics actions</h2><div class="subtext">These recommendations now tell you whether they are backed by synced history or only by local fallback.</div></div></div><div class="d-a-list">${actions.map((item,idx)=>`<div class="d-a-item"><div><strong>${idx+1}. ${item.title}</strong><div class="d-a-meta">${item.copy}<br><br><em>${item.reason||""}</em></div></div><div style="display:grid;gap:10px;justify-items:end;"><span class="g-pill ${item.tone||'growth'}">${item.tone==='revenue'?'Revenue':item.tone==='cleanup'?'Cleanup':'Growth'}</span><button class="action-btn" type="button" data-d-open="${item.section||'tools'}" data-d-focus="${item.focus||''}">Open</button></div></div>`).join("")}</div>`;
    queue.querySelectorAll('[data-d-open]').forEach(btn=>{ if(btn.dataset.boundD==='true') return; btn.dataset.boundD='true'; btn.addEventListener('click',()=>open(btn.getAttribute('data-d-open'), btn.getAttribute('data-d-focus'))); });
    let leadersCard=document.getElementById('bundleDAnalyticsLeaders'); if(!leadersCard){ leadersCard=document.createElement('div'); leadersCard.id='bundleDAnalyticsLeaders'; leadersCard.className='d-analytics-card'; shell.appendChild(leadersCard); }
    leadersCard.innerHTML=`<div class="section-head"><div><div class="g-eyebrow">Registry Leaders</div><h2 style="margin-top:6px;">Synced and local intelligence buckets</h2><div class="subtext">These groups should become more authoritative as backend event ingestion increases.</div></div></div><div class="d-sync-grid">${renderLeaders(analytics.leaders||{})}</div>`;
    const lower=Array.from(section.children).filter(el=>el!==shell && !shell.contains(el));
    let collapse=document.getElementById('bundleDAnalyticsSecondary'); if(!collapse){ collapse=document.createElement('div'); collapse.id='bundleDAnalyticsSecondary'; collapse.className='d-collapse'; collapse.innerHTML=`<div class="d-collapse-head"><div><div class="g-eyebrow">Quiet Mode</div><strong>Charts, scorecards, and supporting diagnostics</strong></div><div class="subtext" id="bundleDAnalyticsState">Expand</div></div><div class="d-collapse-body"></div>`; shell.appendChild(collapse); collapse.querySelector('.d-collapse-head').addEventListener('click',()=>{ collapse.classList.toggle('open'); const t=collapse.querySelector('#bundleDAnalyticsState'); if(t) t.textContent=collapse.classList.contains('open')?'Collapse':'Expand';}); }
    const body=collapse.querySelector('.d-collapse-body'); lower.forEach(el=>{ if(body && !body.contains(el)) body.appendChild(el); });
  }
  NS.analytics={ renderBundleD: render };
  NS.modules = NS.modules || {}; NS.modules.analytics = true;
  const boot=()=>{ render(); setTimeout(render,1200); setTimeout(render,3200); };
  window.addEventListener('elevate:tracking-refreshed', ()=>render());
  window.addEventListener('elevate:sync-refreshed', ()=>render());
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
