
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.analytics) return;

  const CSS = `
    .i-analytics-shell{display:grid;gap:16px}
    .i-analytics-card,.i-analytics-hero{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .i-analytics-hero-grid{display:grid;grid-template-columns:1.4fr repeat(3,minmax(0,1fr));gap:12px}
    .i-a-title{font-size:28px;line-height:1.05;margin:0 0 8px}.i-a-copy{color:#d6d6d6;line-height:1.55;font-size:14px}
    .i-a-list{display:grid;gap:10px;margin-top:12px}
    .i-a-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .i-a-meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    .i-action-controls{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .i-mini-btn{appearance:none;border:1px solid rgba(255,255,255,.08);background:#1a1a1a;color:#f2f2f2;border-radius:10px;padding:8px 10px;cursor:pointer;font-size:12px}
    .i-pill{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.08);background:#171717}
    .i-pill.done{color:#9de8a8;border-color:rgba(157,232,168,.22)} .i-pill.in_progress{color:#f3ddb0;border-color:rgba(212,175,55,.22)}
    .i-pill.blocked{color:#ffb4b4;border-color:rgba(255,180,180,.22)} .i-pill.snoozed{color:#c8c8ff;border-color:rgba(200,200,255,.20)}
    .i-collapse{border:1px solid rgba(212,175,55,.10);border-radius:16px;overflow:hidden;background:#111}
    .i-collapse-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;background:rgba(255,255,255,.02)}
    .i-collapse-body{display:none;padding:16px;border-top:1px solid rgba(212,175,55,.08)} .i-collapse.open .i-collapse-body{display:block}
    @media (max-width:1200px){.i-analytics-hero-grid{grid-template-columns:1fr 1fr}}
    @media (max-width:760px){.i-analytics-hero-grid{grid-template-columns:1fr}.i-a-title{font-size:24px}}
  `;
  function ensureStyle(){ if(document.getElementById('bundle-i-analytics-style')) return; const s=document.createElement('style'); s.id='bundle-i-analytics-style'; s.textContent=CSS; document.head.appendChild(s); }
  function txt(id){ return String(document.getElementById(id)?.textContent || '').replace(/\s+/g,' ').trim(); }
  function num(v){ const m=String(v||'').replace(/,/g,'').match(/-?\d+(\.\d+)?/); return m?Number(m[0]):0; }
  function pill(status){ return `<span class="i-pill ${status || 'open'}">${(status || 'open').replace('_',' ')}</span>`; }
  function controls(id, title, section, openSection, focusId){
    const action = NS.workflowMemory?.getAction(id, { title, section }) || { status:'open' };
    return `<div data-workflow-id="${id}" data-workflow-title="${title}" data-workflow-section="${section}">
      <div style="display:grid;gap:10px;justify-items:end;">${pill(action.status)}
        <div class="i-action-controls">
          <button class="i-mini-btn" type="button" data-workflow-set="in_progress">Start</button>
          <button class="i-mini-btn" type="button" data-workflow-set="done">Done</button>
          <button class="i-mini-btn" type="button" data-workflow-set="snoozed">Snooze</button>
          <button class="i-mini-btn" type="button" data-workflow-set="blocked">Blocked</button>
          <button class="action-btn" type="button" data-open-section="${openSection}" data-focus-field="${focusId || ''}">Open</button>
        </div>
      </div>
    </div>`;
  }
  function buildActions(){
    const weak=num(txt('kpiWeakListings'));
    const needs=num(txt('kpiNeedsAction'));
    const capacity=num(txt('kpiPostsRemaining'));
    const views=num(txt('kpiViews'));
    const messages=num(txt('kpiMessages'));
    const actions=[];
    if(needs>0) actions.push({id:'analytics.resolve_intervention', title:`Resolve ${needs} intervention item${needs===1?'':'s'}`, copy:'Close the highest-risk listing items first to keep your pipeline clean.', section:'tools', focus:'listingSearchInput'});
    if(weak>0) actions.push({id:'analytics.rescue_weak', title:`Rescue ${weak} weak performer${weak===1?'':'s'}`, copy:'Review price, copy, and media on listings that are losing leverage.', section:'tools', focus:'listingSearchInput'});
    if(views>0 && messages===0) actions.push({id:'analytics.review_conversion', title:'Review conversion gap', copy:'Traction exists, but messages are weak. Adjust CTA, pricing, or positioning.', section:'overview', focus:'listingSearchInput'});
    if(capacity>0) actions.push({id:'analytics.use_capacity', title:`Use ${capacity} remaining post slot${capacity===1?'':'s'}`, copy:'Unused daily capacity is still idle leverage.', section:'extension', focus:null});
    if(!actions.length) actions.push({id:'analytics.push_output', title:'System stable — push output', copy:'Analytics is quiet. Use queue and live posting rhythm to keep compounding.', section:'extension', focus:null});
    return actions.slice(0,5);
  }
  function render(){
    const section=document.getElementById('tools'); if(!section || !NS.workflowMemory) return; ensureStyle();
    let shell=document.getElementById('bundleIAnalyticsShell'); if(!shell){ shell=document.createElement('div'); shell.id='bundleIAnalyticsShell'; shell.className='i-analytics-shell'; section.prepend(shell); }
    const actions=buildActions();
    let hero=document.getElementById('bundleIAnalyticsHero'); if(!hero){ hero=document.createElement('div'); hero.id='bundleIAnalyticsHero'; hero.className='i-analytics-hero'; shell.appendChild(hero); }
    hero.innerHTML=`<div class="i-analytics-hero-grid"><div class="i-analytics-card"><div class="g-eyebrow">Completion Loop</div><h2 class="i-a-title">Analytics actions now persist and build a real execution record.</h2><div class="i-a-copy">Use workflow statuses on listing actions so rescue, review, and capacity tasks survive refresh and return with context.</div></div><div class="i-analytics-card"><div class="stat-label">Weak Listings</div><div class="stat-value" style="font-size:24px">${txt('kpiWeakListings') || '0'}</div><div class="stat-sub">Listings that need intervention.</div></div><div class="i-analytics-card"><div class="stat-label">Needs Action</div><div class="stat-value" style="font-size:24px">${txt('kpiNeedsAction') || '0'}</div><div class="stat-sub">Current pressure already in the system.</div></div><div class="i-analytics-card"><div class="stat-label">Remaining Capacity</div><div class="stat-value" style="font-size:24px">${txt('kpiPostsRemaining') || '0'}</div><div class="stat-sub">Still available to deploy today.</div></div></div>`;
    let queue=document.getElementById('bundleIAnalyticsQueue'); if(!queue){ queue=document.createElement('div'); queue.id='bundleIAnalyticsQueue'; queue.className='i-analytics-card'; shell.appendChild(queue); }
    queue.innerHTML=`<div class="section-head"><div><div class="g-eyebrow">Listing Workflow Queue</div><h2 style="margin-top:6px;">Persistent listing actions</h2><div class="subtext">Mark listing work in progress, complete it, snooze it, or block it with state that survives return visits.</div></div></div><div class="i-a-list">${actions.map(item=>`<div class="i-a-item"><div><strong>${item.title}</strong><div class="i-a-meta">${item.copy}</div></div>${controls(item.id,item.title,item.section,item.section,item.focus)}</div>`).join('')}</div>`;
    NS.workflowMemory.wireButtons(queue);
    queue.querySelectorAll('[data-open-section]').forEach(btn=>{
      if(btn.dataset.boundI==='true') return; btn.dataset.boundI='true';
      btn.addEventListener('click',()=>{
        const sectionId=btn.getAttribute('data-open-section'); const focusId=btn.getAttribute('data-focus-field');
        if(typeof window.showSection==='function') window.showSection(sectionId);
        if(focusId) setTimeout(()=>document.getElementById(focusId)?.scrollIntoView({behavior:'smooth', block:'center'}),220);
      });
    });

    const lower=Array.from(section.children).filter(el=>el!==shell && !shell.contains(el));
    let collapse=document.getElementById('bundleIAnalyticsSecondary');
    if(!collapse){ collapse=document.createElement('div'); collapse.id='bundleIAnalyticsSecondary'; collapse.className='i-collapse'; collapse.innerHTML=`<div class="i-collapse-head"><div><div class="g-eyebrow">Quiet Mode</div><strong>Charts, scorecards, and supporting diagnostics</strong></div><div class="subtext" id="bundleIAnalyticsState">Expand</div></div><div class="i-collapse-body"></div>`; shell.appendChild(collapse); collapse.querySelector('.i-collapse-head').addEventListener('click',()=>{ collapse.classList.toggle('open'); const t=collapse.querySelector('#bundleIAnalyticsState'); if(t) t.textContent=collapse.classList.contains('open')?'Collapse':'Expand';}); }
    const body=collapse.querySelector('.i-collapse-body'); lower.forEach(el=>{ if(body && !body.contains(el)) body.appendChild(el); });
  }
  NS.analytics={ renderBundleI: render };
  NS.modules = NS.modules || {}; NS.modules.analytics = true;
  const boot=()=>{ render(); setTimeout(render,1200); setTimeout(render,3200); };
  window.addEventListener('elevate:workflow-updated', ()=>render());
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
