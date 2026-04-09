(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.affiliate) return;

  const CSS = `
    .g-partner-shell{display:grid;gap:16px}
    .g-partner-hero,.g-partner-card{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .g-partner-grid{display:grid;grid-template-columns:1.35fr repeat(3,minmax(0,1fr));gap:12px}
    .g-p-title{font-size:28px;line-height:1.05;margin:0 0 8px}.g-p-copy{color:#d6d6d6;line-height:1.55;font-size:14px}
    .g-p-metric{font-size:28px;line-height:1;font-weight:800;color:#f3ddb0;margin-bottom:8px}
    .g-p-list{display:grid;gap:10px;margin-top:12px}
    .g-p-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .g-p-item strong{display:block;margin-bottom:6px}.g-p-item .meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    .g-p-collapse{border:1px solid rgba(212,175,55,.10);border-radius:16px;overflow:hidden;background:#111}
    .g-p-collapse-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;background:rgba(255,255,255,.02)}
    .g-p-collapse-body{display:none;padding:16px;border-top:1px solid rgba(212,175,55,.08)}.g-p-collapse.open .g-p-collapse-body{display:block}
    @media (max-width:1200px){.g-partner-grid{grid-template-columns:1fr 1fr}}
    @media (max-width:760px){.g-partner-grid{grid-template-columns:1fr}.g-p-title{font-size:24px}}
  `;
  const txt=(id)=>String(document.getElementById(id)?.textContent || '').replace(/\s+/g,' ').trim();
  const num=(v)=>{const m=String(v || '').replace(/,/g,'').match(/-?\d+(\.\d+)?/); return m?Number(m[0]):0;};
  function ensureStyle(){ if(document.getElementById('bundle-g-partner-style')) return; const s=document.createElement('style'); s.id='bundle-g-partner-style'; s.textContent=CSS; document.head.appendChild(s); }
  function build(){
    const mrr=num(txt('affiliateEstimatedMRR'));
    const pending=num(txt('affiliatePendingPayout'));
    const active=num(txt('affiliateActiveReferrals'));
    const total=num(txt('affiliateTotalReferrals'));
    const invited=num(txt('affiliateInvitedCount'));
    const signed=num(txt('affiliateSignedUpCount'));
    const paying=num(txt('affiliatePayingCount'));
    const churned=num(txt('affiliateChurnedCount'));
    const actions=[];
    if(invited>signed) actions.push({tone:'growth', title:`Follow up ${invited-signed} invited lead${invited-signed===1?'':'s'}`, copy:'The top funnel is heavier than conversion. Push invite-to-signup follow-up next.', action:'copyAffiliateDMBtn', label:'Open DM script'});
    if(signed>paying) actions.push({tone:'revenue', title:`Convert ${signed-paying} signup${signed-paying===1?'':'s'} into paid users`, copy:'Your best recurring revenue unlock is improving signup-to-paid conversion.', action:'copyAffiliatePitchBtn', label:'Open pitch'});
    if(churned>0) actions.push({tone:'cleanup', title:`Re-engage ${churned} churned partner${churned===1?'':'s'}`, copy:'Retention recovery is a faster revenue win than cold acquisition.', action:'copyAffiliatePostBtn', label:'Open reactivation post'});
    if(active===0) actions.push({tone:'growth', title:'Activate first paying referral', copy:'Start with a manager or one strong rep who can become a recurring partner source.', action:'copyReferralLinkBtn', label:'Copy referral link'});
    if(!actions.length) actions.push({tone:'growth', title:'Partner engine is stable — push manager outreach', copy:'The next growth move is manager-level distribution, not scattered individual outreach.', action:'copyAffiliatePitchBtn', label:'Open manager pitch'});
    return {mrr,pending,active,total,actions:actions.slice(0,5)};
  }
  function render(){
    const section=document.getElementById('affiliate'); if(!section) return; ensureStyle(); const m=build();
    let shell=document.getElementById('bundleGPartnerShell'); if(!shell){ shell=document.createElement('div'); shell.id='bundleGPartnerShell'; shell.className='g-partner-shell'; section.prepend(shell); }
    let hero=document.getElementById('bundleGPartnerHero'); if(!hero){ hero=document.createElement('div'); hero.id='bundleGPartnerHero'; hero.className='g-partner-hero'; shell.appendChild(hero); }
    hero.innerHTML=`<div class="g-partner-grid"><div class="g-partner-card"><div class="g-eyebrow">Revenue Workspace</div><h2 class="g-p-title">Grow recurring revenue, not just referral counts.</h2><div class="g-p-copy">Partners should feel like a clean revenue desk: projected recurring, next payout leverage, funnel friction, and the next best growth move.</div></div><div class="g-partner-card"><div class="g-kicker">Projected MRR</div><div class="g-p-metric">${m.mrr}</div><div class="g-sub">Recurring partner revenue currently visible.</div></div><div class="g-partner-card"><div class="g-kicker">Pending Payout</div><div class="g-p-metric">${m.pending}</div><div class="g-sub">Projected payout value already in motion.</div></div><div class="g-partner-card"><div class="g-kicker">Active Paying</div><div class="g-p-metric">${m.active}</div><div class="g-sub">Current paying referral relationships.</div></div></div>`;
    let queue=document.getElementById('bundleGPartnerQueue'); if(!queue){ queue=document.createElement('div'); queue.id='bundleGPartnerQueue'; queue.className='g-partner-card'; shell.appendChild(queue); }
    queue.innerHTML=`<div class="section-head"><div><div class="g-eyebrow">Partner Action Queue</div><h2 style="margin-top:6px;">What increases recurring revenue next</h2><div class="subtext">This section is now centered on monetization actions, not passive referral stats.</div></div></div><div class="g-p-list">${m.actions.map((item,idx)=>`<div class="g-p-item"><div><strong>${idx+1}. ${item.title}</strong><div class="meta">${item.copy}</div></div><div style="display:grid;gap:10px;justify-items:end;"><span class="g-pill ${item.tone}">${item.tone==='revenue'?'Revenue':item.tone==='growth'?'Growth':'Cleanup'}</span><button class="action-btn" type="button" data-p-action="${item.action}">${item.label}</button></div></div>`).join('')}</div>`;
    queue.querySelectorAll('[data-p-action]').forEach(btn=>btn.addEventListener('click',()=>document.getElementById(btn.getAttribute('data-p-action'))?.click()));
    const lower=Array.from(section.children).filter(el=>el!==shell && !shell.contains(el));
    let collapse=document.getElementById('bundleGPartnerSecondary'); if(!collapse){ collapse=document.createElement('div'); collapse.id='bundleGPartnerSecondary'; collapse.className='g-p-collapse'; collapse.innerHTML=`<div class="g-p-collapse-head"><div><div class="g-eyebrow">Quiet Mode</div><strong>Referral stats, scripts, and supporting detail</strong></div><div class="subtext" id="bundleGPartnerState">Expand</div></div><div class="g-p-collapse-body"></div>`; shell.appendChild(collapse); collapse.querySelector('.g-p-collapse-head').addEventListener('click',()=>{ collapse.classList.toggle('open'); const t=collapse.querySelector('#bundleGPartnerState'); if(t) t.textContent=collapse.classList.contains('open')?'Collapse':'Expand';}); }
    const body=collapse.querySelector('.g-p-collapse-body'); lower.forEach(el=>{ if(body && !body.contains(el)) body.appendChild(el); });
  }
  NS.affiliate={ renderBundleG: render };
  NS.modules = NS.modules || {}; NS.modules.affiliate = true;
  const boot=()=>{ render(); setTimeout(render,1200); setTimeout(render,3200); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
