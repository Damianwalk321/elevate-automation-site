(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.billing) return;

  const CSS = `
    .g-billing-shell{display:grid;gap:16px}
    .g-billing-hero,.g-billing-card{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .g-billing-grid{display:grid;grid-template-columns:1.35fr repeat(3,minmax(0,1fr));gap:12px}
    .g-b-title{font-size:28px;line-height:1.05;margin:0 0 8px}.g-b-copy{color:#d6d6d6;line-height:1.55;font-size:14px}
    .g-b-metric{font-size:28px;line-height:1;font-weight:800;color:#f3ddb0;margin-bottom:8px}
    .g-b-list{display:grid;gap:10px;margin-top:12px}
    .g-b-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .g-b-item strong{display:block;margin-bottom:6px}.g-b-item .meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    @media (max-width:1200px){.g-billing-grid{grid-template-columns:1fr 1fr}}
    @media (max-width:760px){.g-billing-grid{grid-template-columns:1fr}.g-b-title{font-size:24px}}
  `;
  const txt=(id)=>String(document.getElementById(id)?.textContent || '').replace(/\s+/g,' ').trim();
  const num=(v)=>{const m=String(v || '').replace(/,/g,'').match(/-?\d+(\.\d+)?/); return m?Number(m[0]):0;};
  function ensureStyle(){ if(document.getElementById('bundle-g-billing-style')) return; const s=document.createElement('style'); s.id='bundle-g-billing-style'; s.textContent=CSS; document.head.appendChild(s); }
  function model(){
    const plan=txt('planNameBilling') || txt('overviewPlanChip') || 'Founder Beta';
    const status=txt('subscriptionStatusBilling') || 'Unknown';
    const remaining=num(txt('kpiPostsRemaining'));
    const weak=num(txt('kpiWeakListings'));
    const activeRefs=num(txt('affiliateActiveReferrals'));
    const messages=num(txt('kpiMessages'));
    let bottleneck='Execution capacity';
    let unlock='Higher posting limits and cleaner revenue workflow.';
    let reason='You are at the stage where more system leverage matters more than more explanation.';
    if(remaining===0){ bottleneck='Daily posting limit'; unlock='More daily throughput and cleaner momentum preservation.'; reason='You are hitting daily capacity. Upgrade timing becomes logical when the queue is healthy but output is capped.'; }
    else if(weak>0){ bottleneck='Listing rescue and intervention'; unlock='Deeper prioritization and premium growth surfaces.'; reason='You already have inventory signal. The next leverage layer is better intervention and operating clarity.'; }
    else if(activeRefs>0){ bottleneck='Partner monetization scale'; unlock='More revenue workflow and higher-value growth surfaces.'; reason='Partner traction is visible. Upgrading should follow recurring revenue momentum, not guesswork.'; }
    else if(messages>0){ bottleneck='Commercial throughput'; unlock='More execution capacity and tighter conversion workflow.'; reason='Buyer traction is real. The next upgrade should support throughput and follow-up leverage.'; }
    const items=[
      {tone:'growth', title:'Upgrade only when friction is real', copy:reason},
      {tone:'revenue', title:`Current bottleneck: ${bottleneck}`, copy:unlock},
      {tone:'cleanup', title:`Current plan: ${plan}`, copy:`Status: ${status}. Billing should feel like workflow logic, not a detached settings page.`}
    ];
    return {plan,status,bottleneck,unlock,items};
  }
  function render(){
    const section=document.getElementById('billing'); if(!section) return; ensureStyle(); const m=model();
    let shell=document.getElementById('bundleGBillingShell'); if(!shell){ shell=document.createElement('div'); shell.id='bundleGBillingShell'; shell.className='g-billing-shell'; section.prepend(shell); }
    let hero=document.getElementById('bundleGBillingHero'); if(!hero){ hero=document.createElement('div'); hero.id='bundleGBillingHero'; hero.className='g-billing-hero'; shell.appendChild(hero); }
    hero.innerHTML=`<div class="g-billing-grid"><div class="g-billing-card"><div class="g-eyebrow">Commercial Hardening</div><h2 class="g-b-title">Upgrade when workflow friction makes the case.</h2><div class="g-b-copy">Billing should explain why an upgrade matters right now, what unlocks immediately, and which bottleneck it actually removes.</div><div class="g-actions"><button id="bundleGBillingPortalBtn" class="btn-primary" type="button">Open Billing Portal</button><button id="bundleGBillingRefreshBtn" class="action-btn" type="button">Refresh Billing</button></div></div><div class="g-billing-card"><div class="g-kicker">Current Plan</div><div class="g-b-metric">${m.plan}</div><div class="g-sub">Your live commercial position.</div></div><div class="g-billing-card"><div class="g-kicker">Bottleneck</div><div class="g-b-metric">${m.bottleneck}</div><div class="g-sub">The main reason an upgrade would become logical.</div></div><div class="g-billing-card"><div class="g-kicker">Unlock</div><div class="g-b-metric">Leverage</div><div class="g-sub">${m.unlock}</div></div></div>`;
    document.getElementById('bundleGBillingPortalBtn')?.addEventListener('click',()=>document.getElementById('openBillingPortalBtn')?.click());
    document.getElementById('bundleGBillingRefreshBtn')?.addEventListener('click',()=>document.getElementById('refreshBillingBtn')?.click());
    let card=document.getElementById('bundleGBillingQueue'); if(!card){ card=document.createElement('div'); card.id='bundleGBillingQueue'; card.className='g-billing-card'; shell.appendChild(card); }
    card.innerHTML=`<div class="section-head"><div><div class="g-eyebrow">Upgrade Logic</div><h2 style="margin-top:6px;">Why upgrade would make sense</h2><div class="subtext">Fewer generic prompts. More product-native commercial logic.</div></div></div><div class="g-b-list">${m.items.map((item)=>`<div class="g-b-item"><div><strong>${item.title}</strong><div class="meta">${item.copy}</div></div><span class="g-pill ${item.tone}">${item.tone==='revenue'?'Revenue':item.tone==='growth'?'Growth':'Cleanup'}</span></div>`).join('')}</div>`;
    Array.from(section.children).forEach(el=>{ if(el!==shell && !shell.contains(el)) shell.appendChild(el); });
  }
  NS.billing={ renderBundleG: render };
  NS.modules = NS.modules || {}; NS.modules.billing = true;
  const boot=()=>{ render(); setTimeout(render,1200); setTimeout(render,3200); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
