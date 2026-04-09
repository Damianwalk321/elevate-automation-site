
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.affiliate) return;

  const CSS = `
    .i-partner-shell{display:grid;gap:16px}
    .i-partner-card,.i-partner-hero{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .i-partner-grid{display:grid;grid-template-columns:1.4fr repeat(3,minmax(0,1fr));gap:12px}
    .i-p-title{font-size:28px;line-height:1.05;margin:0 0 8px}.i-p-copy{color:#d6d6d6;line-height:1.55;font-size:14px}
    .i-p-list{display:grid;gap:10px;margin-top:12px}
    .i-p-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .i-p-meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    .i-action-controls{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .i-mini-btn{appearance:none;border:1px solid rgba(255,255,255,.08);background:#1a1a1a;color:#f2f2f2;border-radius:10px;padding:8px 10px;cursor:pointer;font-size:12px}
    .i-pill{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.08);background:#171717}
    .i-pill.done{color:#9de8a8;border-color:rgba(157,232,168,.22)} .i-pill.in_progress{color:#f3ddb0;border-color:rgba(212,175,55,.22)}
    .i-pill.blocked{color:#ffb4b4;border-color:rgba(255,180,180,.22)} .i-pill.snoozed{color:#c8c8ff;border-color:rgba(200,200,255,.20)}
    .i-collapse{border:1px solid rgba(212,175,55,.10);border-radius:16px;overflow:hidden;background:#111}
    .i-collapse-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;background:rgba(255,255,255,.02)}
    .i-collapse-body{display:none;padding:16px;border-top:1px solid rgba(212,175,55,.08)} .i-collapse.open .i-collapse-body{display:block}
    @media (max-width:1200px){.i-partner-grid{grid-template-columns:1fr 1fr}}
    @media (max-width:760px){.i-partner-grid{grid-template-columns:1fr}.i-p-title{font-size:24px}}
  `;
  function ensureStyle(){ if(document.getElementById('bundle-i-partner-style')) return; const s=document.createElement('style'); s.id='bundle-i-partner-style'; s.textContent=CSS; document.head.appendChild(s); }
  function txt(id){ return String(document.getElementById(id)?.textContent || '').replace(/\s+/g,' ').trim(); }
  function num(v){ const m=String(v||'').replace(/,/g,'').match(/-?\d+(\.\d+)?/); return m?Number(m[0]):0; }
  function pill(status){ return `<span class="i-pill ${status || 'open'}">${(status || 'open').replace('_',' ')}</span>`; }
  function controls(id, title, section, actionBtn){
    const action = NS.workflowMemory?.getAction(id, { title, section }) || { status:'open' };
    return `<div data-workflow-id="${id}" data-workflow-title="${title}" data-workflow-section="${section}">
      <div style="display:grid;gap:10px;justify-items:end;">${pill(action.status)}
        <div class="i-action-controls">
          <button class="i-mini-btn" type="button" data-workflow-set="in_progress">Start</button>
          <button class="i-mini-btn" type="button" data-workflow-set="done">Done</button>
          <button class="i-mini-btn" type="button" data-workflow-set="snoozed">Snooze</button>
          <button class="i-mini-btn" type="button" data-workflow-set="blocked">Blocked</button>
          <button class="action-btn" type="button" data-i-click="${actionBtn || ''}">Open</button>
        </div>
      </div>
    </div>`;
  }
  function buildActions(){
    const invited=num(txt('affiliateInvitedCount'));
    const signed=num(txt('affiliateSignedUpCount'));
    const paying=num(txt('affiliatePayingCount'));
    const churned=num(txt('affiliateChurnedCount'));
    const items=[];
    if(invited>signed) items.push({id:'partner.followup.invited', title:`Follow up ${invited-signed} invited lead${invited-signed===1?'':'s'}`, copy:'Push invite-to-signup conversion before more top-funnel acquisition.', button:'copyAffiliateDMBtn'});
    if(signed>paying) items.push({id:'partner.convert.signup_paid', title:`Convert ${signed-paying} signup${signed-paying===1?'':'s'} into paid`, copy:'The next recurring revenue unlock is better signup-to-paid movement.', button:'copyAffiliatePitchBtn'});
    if(churned>0) items.push({id:'partner.reactivate.churned', title:`Re-engage ${churned} churned partner${churned===1?'':'s'}`, copy:'Reactivation is often a faster revenue win than cold acquisition.', button:'copyAffiliatePostBtn'});
    if(!items.length) items.push({id:'partner.manager.outreach', title:'Run manager-level partner outreach', copy:'The next growth move is concentrated, higher-leverage referral distribution.', button:'copyAffiliatePitchBtn'});
    return items.slice(0,5);
  }
  function render(){
    const section=document.getElementById('affiliate'); if(!section || !NS.workflowMemory) return; ensureStyle();
    let shell=document.getElementById('bundleIPartnerShell'); if(!shell){ shell=document.createElement('div'); shell.id='bundleIPartnerShell'; shell.className='i-partner-shell'; section.prepend(shell); }
    const actions=buildActions();
    let hero=document.getElementById('bundleIPartnerHero'); if(!hero){ hero=document.createElement('div'); hero.id='bundleIPartnerHero'; hero.className='i-partner-hero'; shell.appendChild(hero); }
    hero.innerHTML=`<div class="i-partner-grid"><div class="i-partner-card"><div class="g-eyebrow">Partner Memory</div><h2 class="i-p-title">Partner follow-up should persist like real pipeline work.</h2><div class="i-p-copy">Bundle I gives partner actions durable states so follow-up, conversion, and reactivation work does not disappear between visits.</div></div><div class="i-partner-card"><div class="stat-label">Projected MRR</div><div class="stat-value" style="font-size:24px">${txt('affiliateEstimatedMRR') || '0'}</div><div class="stat-sub">Recurring potential already visible.</div></div><div class="i-partner-card"><div class="stat-label">Pending Payout</div><div class="stat-value" style="font-size:24px">${txt('affiliatePendingPayout') || '0'}</div><div class="stat-sub">Revenue currently moving.</div></div><div class="i-partner-card"><div class="stat-label">Active Paying</div><div class="stat-value" style="font-size:24px">${txt('affiliateActiveReferrals') || '0'}</div><div class="stat-sub">Current monetized partner base.</div></div></div>`;
    let queue=document.getElementById('bundleIPartnerQueue'); if(!queue){ queue=document.createElement('div'); queue.id='bundleIPartnerQueue'; queue.className='i-partner-card'; shell.appendChild(queue); }
    queue.innerHTML=`<div class="section-head"><div><div class="g-eyebrow">Partner Workflow Queue</div><h2 style="margin-top:6px;">Persistent partner actions</h2><div class="subtext">Track follow-up, conversion, and reactivation work with durable statuses instead of one-time prompts.</div></div></div><div class="i-p-list">${actions.map(item=>`<div class="i-p-item"><div><strong>${item.title}</strong><div class="i-p-meta">${item.copy}</div></div>${controls(item.id,item.title,'affiliate',item.button)}</div>`).join('')}</div>`;
    NS.workflowMemory.wireButtons(queue);
    queue.querySelectorAll('[data-i-click]').forEach(btn=>{
      if(btn.dataset.boundI==='true') return; btn.dataset.boundI='true';
      btn.addEventListener('click',()=>document.getElementById(btn.getAttribute('data-i-click'))?.click());
    });

    const lower=Array.from(section.children).filter(el=>el!==shell && !shell.contains(el));
    let collapse=document.getElementById('bundleIPartnerSecondary');
    if(!collapse){ collapse=document.createElement('div'); collapse.id='bundleIPartnerSecondary'; collapse.className='i-collapse'; collapse.innerHTML=`<div class="i-collapse-head"><div><div class="g-eyebrow">Quiet Mode</div><strong>Referral stats, scripts, and supporting detail</strong></div><div class="subtext" id="bundleIPartnerState">Expand</div></div><div class="i-collapse-body"></div>`; shell.appendChild(collapse); collapse.querySelector('.i-collapse-head').addEventListener('click',()=>{ collapse.classList.toggle('open'); const t=collapse.querySelector('#bundleIPartnerState'); if(t) t.textContent=collapse.classList.contains('open')?'Collapse':'Expand';}); }
    const body=collapse.querySelector('.i-collapse-body'); lower.forEach(el=>{ if(body && !body.contains(el)) body.appendChild(el); });
  }
  NS.affiliate={ renderBundleI: render };
  NS.modules = NS.modules || {}; NS.modules.affiliate = true;
  const boot=()=>{ render(); setTimeout(render,1200); setTimeout(render,3200); };
  window.addEventListener('elevate:workflow-updated', ()=>render());
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
