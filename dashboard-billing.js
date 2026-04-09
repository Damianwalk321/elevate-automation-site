
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.billing) return;

  const CSS = `
    .i-billing-shell{display:grid;gap:16px}
    .i-billing-card,.i-billing-hero{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .i-billing-grid{display:grid;grid-template-columns:1.4fr repeat(3,minmax(0,1fr));gap:12px}
    .i-b-title{font-size:28px;line-height:1.05;margin:0 0 8px}.i-b-copy{color:#d6d6d6;line-height:1.55;font-size:14px}
    .i-b-list{display:grid;gap:10px;margin-top:12px}
    .i-b-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .i-b-meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    .i-action-controls{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .i-mini-btn{appearance:none;border:1px solid rgba(255,255,255,.08);background:#1a1a1a;color:#f2f2f2;border-radius:10px;padding:8px 10px;cursor:pointer;font-size:12px}
    .i-pill{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.08);background:#171717}
    .i-pill.done{color:#9de8a8;border-color:rgba(157,232,168,.22)} .i-pill.in_progress{color:#f3ddb0;border-color:rgba(212,175,55,.22)}
    .i-pill.blocked{color:#ffb4b4;border-color:rgba(255,180,180,.22)} .i-pill.snoozed{color:#c8c8ff;border-color:rgba(200,200,255,.20)}
    @media (max-width:1200px){.i-billing-grid{grid-template-columns:1fr 1fr}}
    @media (max-width:760px){.i-billing-grid{grid-template-columns:1fr}.i-b-title{font-size:24px}}
  `;
  function ensureStyle(){ if(document.getElementById('bundle-i-billing-style')) return; const s=document.createElement('style'); s.id='bundle-i-billing-style'; s.textContent=CSS; document.head.appendChild(s); }
  function txt(id){ return String(document.getElementById(id)?.textContent || '').replace(/\s+/g,' ').trim(); }
  function num(v){ const m=String(v||'').replace(/,/g,'').match(/-?\d+(\.\d+)?/); return m?Number(m[0]):0; }
  function pill(status){ return `<span class="i-pill ${status || 'open'}">${(status || 'open').replace('_',' ')}</span>`; }
  function controls(id, title){
    const action = NS.workflowMemory?.getAction(id, { title, section:'billing' }) || { status:'open' };
    return `<div data-workflow-id="${id}" data-workflow-title="${title}" data-workflow-section="billing">
      <div style="display:grid;gap:10px;justify-items:end;">${pill(action.status)}
        <div class="i-action-controls">
          <button class="i-mini-btn" type="button" data-workflow-set="in_progress">Start</button>
          <button class="i-mini-btn" type="button" data-workflow-set="done">Done</button>
          <button class="i-mini-btn" type="button" data-workflow-set="snoozed">Snooze</button>
          <button class="i-mini-btn" type="button" data-workflow-set="blocked">Blocked</button>
          <button class="action-btn" type="button" data-i-billing="portal">Open portal</button>
        </div>
      </div>
    </div>`;
  }
  function buildModel(){
    const plan=txt('planNameBilling') || txt('overviewPlanChip') || 'Founder Beta';
    const status=txt('subscriptionStatusBilling') || 'Unknown';
    const remaining=num(txt('kpiPostsRemaining'));
    const weak=num(txt('kpiWeakListings'));
    const activeRefs=num(txt('affiliateActiveReferrals'));
    let bottleneck='Execution leverage';
    let unlock='Higher throughput and stronger revenue surfaces.';
    if(remaining===0){ bottleneck='Daily posting limit'; unlock='More posting capacity and less rhythm friction.'; }
    else if(weak>0){ bottleneck='Listing intervention'; unlock='Deeper rescue and prioritization workflow.'; }
    else if(activeRefs>0){ bottleneck='Partner monetization scale'; unlock='More leverage around recurring revenue motion.'; }
    return {plan,status,bottleneck,unlock};
  }
  function render(){
    const section=document.getElementById('billing'); if(!section || !NS.workflowMemory) return; ensureStyle(); const m=buildModel();
    let shell=document.getElementById('bundleIBillingShell'); if(!shell){ shell=document.createElement('div'); shell.id='bundleIBillingShell'; shell.className='i-billing-shell'; section.prepend(shell); }
    let hero=document.getElementById('bundleIBillingHero'); if(!hero){ hero=document.createElement('div'); hero.id='bundleIBillingHero'; hero.className='i-billing-hero'; shell.appendChild(hero); }
    hero.innerHTML=`<div class="i-billing-grid"><div class="i-billing-card"><div class="g-eyebrow">Commercial Memory</div><h2 class="i-b-title">Upgrade decisions should persist like real operating work.</h2><div class="i-b-copy">Bundle I lets upgrade review become a tracked workflow instead of a one-time page visit.</div></div><div class="i-billing-card"><div class="stat-label">Plan</div><div class="stat-value" style="font-size:24px">${m.plan}</div><div class="stat-sub">Current commercial position.</div></div><div class="i-billing-card"><div class="stat-label">Bottleneck</div><div class="stat-value" style="font-size:24px">${m.bottleneck}</div><div class="stat-sub">Why an upgrade would become logical.</div></div><div class="i-billing-card"><div class="stat-label">Unlock</div><div class="stat-value" style="font-size:24px">Leverage</div><div class="stat-sub">${m.unlock}</div></div></div>`;
    let queue=document.getElementById('bundleIBillingQueue'); if(!queue){ queue=document.createElement('div'); queue.id='bundleIBillingQueue'; queue.className='i-billing-card'; shell.appendChild(queue); }
    queue.innerHTML=`<div class="section-head"><div><div class="g-eyebrow">Commercial Workflow</div><h2 style="margin-top:6px;">Tracked upgrade review</h2><div class="subtext">Treat upgrade review like workflow: start it, complete it, snooze it, or block it with durable state.</div></div></div><div class="i-b-list"><div class="i-b-item"><div><strong>Review current bottleneck and unlock path</strong><div class="i-b-meta">Current bottleneck: ${m.bottleneck}. Unlock path: ${m.unlock}</div></div>${controls('billing.review_upgrade_logic','Review upgrade logic')}</div></div>`;
    NS.workflowMemory.wireButtons(queue);
    queue.querySelectorAll('[data-i-billing]').forEach(btn=>{
      if(btn.dataset.boundI==='true') return; btn.dataset.boundI='true';
      btn.addEventListener('click',()=>document.getElementById('openBillingPortalBtn')?.click());
    });
    Array.from(section.children).forEach(el=>{ if(el!==shell && !shell.contains(el)) shell.appendChild(el); });
  }
  NS.billing={ renderBundleI: render };
  NS.modules = NS.modules || {}; NS.modules.billing = true;
  const boot=()=>{ render(); setTimeout(render,1200); setTimeout(render,3200); };
  window.addEventListener('elevate:workflow-updated', ()=>render());
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
