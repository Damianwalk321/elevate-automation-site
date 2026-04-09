(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.analytics) return;

  const CSS = `
    .g-analytics-shell{display:grid;gap:16px}
    .g-analytics-hero,.g-analytics-card{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .g-analytics-hero-grid{display:grid;grid-template-columns:1.35fr repeat(3,minmax(0,1fr));gap:12px}
    .g-a-title{font-size:28px;line-height:1.05;margin:0 0 8px}.g-a-copy{color:#d6d6d6;line-height:1.55;font-size:14px}
    .g-a-metric{font-size:28px;line-height:1;font-weight:800;color:#f3ddb0;margin-bottom:8px}
    .g-a-list{display:grid;gap:10px;margin-top:12px}
    .g-a-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .g-a-item strong{display:block;margin-bottom:6px}.g-a-item .meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    .g-a-collapse{border:1px solid rgba(212,175,55,.10);border-radius:16px;overflow:hidden;background:#111}
    .g-a-collapse-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;background:rgba(255,255,255,.02)}
    .g-a-collapse-body{display:none;padding:16px;border-top:1px solid rgba(212,175,55,.08)}.g-a-collapse.open .g-a-collapse-body{display:block}
    @media (max-width:1200px){.g-analytics-hero-grid{grid-template-columns:1fr 1fr}}
    @media (max-width:760px){.g-analytics-hero-grid{grid-template-columns:1fr}.g-a-title{font-size:24px}}
  `;
  const txt = (id) => String(document.getElementById(id)?.textContent || '').replace(/\s+/g, ' ').trim();
  const num = (v) => { const m = String(v || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : 0; };
  function ensureStyle(){ if(document.getElementById('bundle-g-analytics-style')) return; const s=document.createElement('style'); s.id='bundle-g-analytics-style'; s.textContent=CSS; document.head.appendChild(s); }
  function open(section, focusId){ try{ if(typeof window.showSection==='function') window.showSection(section);}catch{} if(focusId) setTimeout(()=>document.getElementById(focusId)?.scrollIntoView({behavior:'smooth', block:'center'}),200); }
  function model(){
    const timeSaved = num(txt('analyticsTimeSavedToday'));
    const weekValue = num(txt('analyticsEstimatedValue'));
    const efficiency = num(txt('analyticsEfficiencyScore'));
    const weak = num(txt('kpiWeakListings'));
    const needsAction = num(txt('kpiNeedsAction'));
    const capacity = num(txt('kpiPostsRemaining'));
    const views = num(txt('kpiViews'));
    const messages = num(txt('kpiMessages'));
    const items=[];
    if(needsAction>0) items.push({tone:'revenue', title:`Resolve ${needsAction} intervention item${needsAction===1?'':'s'}`, copy:'Listings needing action are the highest-leverage cleanup before more volume is added.', action:{label:'Review listings', section:'overview', focus:'listingSearchInput'}});
    if(weak>0) items.push({tone:'revenue', title:`Rescue ${weak} weak performer${weak===1?'':'s'}`, copy:'Review pricing, copy, and media on underperforming listings.', action:{label:'Open listings', section:'overview', focus:'listingSearchInput'}});
    if(views>0 && messages===0) items.push({tone:'revenue', title:'Traction without conversion', copy:'Views are landing, but messages are not. Adjust CTA, copy, and pricing.', action:{label:'Open overview', section:'overview', focus:'listingSearchInput'}});
    if(capacity>0) items.push({tone:'growth', title:`Use ${capacity} remaining post slot${capacity===1?'':'s'}`, copy:'Unused capacity is idle leverage. Queue and post additional units.', action:{label:'Open tools', section:'extension', focus:null}});
    if(efficiency<50) items.push({tone:'cleanup', title:'Execution efficiency is still soft', copy:'Daily capacity is underused. Tighten queueing and posting rhythm.', action:{label:'Open tools', section:'extension', focus:null}});
    if(!items.length) items.push({tone:'growth', title:'System stable — push output', copy:'Analytics is quiet. Use queue, publishing, and partner growth to keep compounding.', action:{label:'Open tools', section:'extension', focus:null}});
    return {timeSaved, weekValue, efficiency, top:items.slice(0,5), biggestLeak: weak + needsAction, bestUpside: capacity};
  }
  function render(){
    const section=document.getElementById('tools'); if(!section) return; ensureStyle(); const m=model();
    let shell=document.getElementById('bundleGAnalyticsShell');
    if(!shell){ shell=document.createElement('div'); shell.id='bundleGAnalyticsShell'; shell.className='g-analytics-shell'; section.prepend(shell); }
    let hero=document.getElementById('bundleGAnalyticsHero');
    if(!hero){ hero=document.createElement('div'); hero.id='bundleGAnalyticsHero'; hero.className='g-analytics-hero'; shell.appendChild(hero); }
    hero.innerHTML=`<div class="g-analytics-hero-grid"><div class="g-analytics-card"><div class="g-eyebrow">Decision Engine</div><h2 class="g-a-title">Act on business leverage, not dashboard noise.</h2><div class="g-a-copy">Analytics should point to the next revenue move, the biggest leak, and the remaining capacity you still have today.</div></div><div class="g-analytics-card"><div class="g-kicker">Biggest Leak</div><div class="g-a-metric">${m.biggestLeak}</div><div class="g-sub">Listings needing rescue or intervention.</div></div><div class="g-analytics-card"><div class="g-kicker">Best Upside</div><div class="g-a-metric">${m.bestUpside}</div><div class="g-sub">Remaining post capacity still available today.</div></div><div class="g-analytics-card"><div class="g-kicker">Time Saved</div><div class="g-a-metric">${m.timeSaved}</div><div class="g-sub">Minutes reclaimed today through cleaner execution.</div></div></div>`;
    let queue=document.getElementById('bundleGAnalyticsQueue');
    if(!queue){ queue=document.createElement('div'); queue.id='bundleGAnalyticsQueue'; queue.className='g-analytics-card'; shell.appendChild(queue); }
    queue.innerHTML=`<div class="section-head"><div><div class="g-eyebrow">Action Queue</div><h2 style="margin-top:6px;">Analytics priorities</h2><div class="subtext">This section is now optimized around action, not passive scorecards.</div></div></div><div class="g-a-list">${m.top.map((item,idx)=>`<div class="g-a-item"><div><strong>${idx+1}. ${item.title}</strong><div class="meta">${item.copy}</div></div><div style="display:grid;gap:10px;justify-items:end;"><span class="g-pill ${item.tone}">${item.tone==='revenue'?'Revenue':item.tone==='growth'?'Growth':'Cleanup'}</span><button class="action-btn" type="button" data-a-action="${idx}">${item.action.label}</button></div></div>`).join('')}</div>`;
    queue.querySelectorAll('[data-a-action]').forEach(btn=>btn.addEventListener('click',()=>{const item=m.top[Number(btn.getAttribute('data-a-action'))]; if(item) open(item.action.section,item.action.focus);}));

    const graphShell=section.querySelector('.analytics-shell');
    const lowerGrids=Array.from(section.children).filter(el=>el!==shell && !shell.contains(el));
    let collapse=document.getElementById('bundleGAnalyticsSecondary');
    if(!collapse){ collapse=document.createElement('div'); collapse.id='bundleGAnalyticsSecondary'; collapse.className='g-a-collapse'; collapse.innerHTML=`<div class="g-a-collapse-head"><div><div class="g-eyebrow">Quiet Mode</div><strong>Charts, scorecards, and supporting diagnostics</strong></div><div class="subtext" id="bundleGAnalyticsState">Expand</div></div><div class="g-a-collapse-body"></div>`; shell.appendChild(collapse); collapse.querySelector('.g-a-collapse-head').addEventListener('click',()=>{ collapse.classList.toggle('open'); const t=collapse.querySelector('#bundleGAnalyticsState'); if(t) t.textContent=collapse.classList.contains('open')?'Collapse':'Expand';}); }
    const body=collapse.querySelector('.g-a-collapse-body');
    lowerGrids.forEach(el=>{ if(body && !body.contains(el)) body.appendChild(el); });
  }
  NS.analytics={ renderBundleG: render };
  NS.modules = NS.modules || {}; NS.modules.analytics = true;
  const boot=()=>{ render(); setTimeout(render,1200); setTimeout(render,3200); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
