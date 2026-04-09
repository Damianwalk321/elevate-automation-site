
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.affiliate) return;

  const CSS = `
    .h-partner-shell{display:grid;gap:16px}
    .h-partner-card{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .h-p-list{display:grid;gap:10px}
    .h-p-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .h-p-item strong{display:block;margin-bottom:6px}
    .h-p-meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    .h-p-right{display:grid;gap:10px;justify-items:end}
    .h-p-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .h-mini-btn{appearance:none;border:1px solid rgba(255,255,255,.08);background:#1a1a1a;color:#f2f2f2;border-radius:10px;padding:8px 10px;cursor:pointer;font-size:12px}
    @media (max-width:760px){.h-p-item{grid-template-columns:1fr}.h-p-right{justify-items:start}.h-p-actions{justify-content:flex-start}}
  `;
  function ensureStyle(){ if(document.getElementById('bundle-h-partner-style')) return; const s=document.createElement('style'); s.id='bundle-h-partner-style'; s.textContent=CSS; document.head.appendChild(s); }
  function txt(id){ return String(document.getElementById(id)?.textContent || '').replace(/\s+/g,' ').trim(); }
  function num(v){ const m=String(v || '').replace(/,/g,'').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : 0; }
  function buildTasks(){
    const invited=num(txt('affiliateInvitedCount'));
    const signed=num(txt('affiliateSignedUpCount'));
    const paying=num(txt('affiliatePayingCount'));
    const churned=num(txt('affiliateChurnedCount'));
    const active=num(txt('affiliateActiveReferrals'));
    const tasks=[];
    if(invited>signed) tasks.push({id:'partner-follow-up-invites', title:`Follow up ${invited-signed} invited lead${invited-signed===1?'':'s'}`, copy:'Send the DM, log the outreach, and move the next lead into view.', action:{section:'affiliate', clickId:'copyAffiliateDMBtn'}});
    if(signed>paying) tasks.push({id:'partner-convert-to-paid', title:`Convert ${signed-paying} signup${signed-paying===1?'':'s'} to paid`, copy:'Push the short pitch or manager pitch, then mark the conversion attempt complete.', action:{section:'affiliate', clickId:'copyAffiliatePitchBtn'}});
    if(churned>0) tasks.push({id:'partner-reactivate-churn', title:`Re-engage ${churned} churned partner${churned===1?'':'s'}`, copy:'Run a reactivation touch, then defer or complete based on response.', action:{section:'affiliate', clickId:'copyAffiliatePostBtn'}});
    if(active===0) tasks.push({id:'partner-first-paying', title:'Activate first paying referral', copy:'Use the referral link or pitch and log the outreach when it is sent.', action:{section:'affiliate', clickId:'copyReferralLinkBtn'}});
    if(!tasks.length) tasks.push({id:'partner-stable', title:'Partner queue is stable', copy:'Push manager outreach or improve follow-up quality on the next lead.', action:{section:'affiliate', clickId:'copyAffiliatePitchBtn'}});
    return tasks;
  }
  function go(action={}) {
    if(action.clickId) document.getElementById(action.clickId)?.click();
    if(action.section && typeof window.showSection==='function'){ try{ window.showSection(action.section);}catch{} }
  }
  function render(){
    const section=document.getElementById('affiliate'); if(!section) return; ensureStyle();
    const workflow=NS.workflow;
    const tasks=buildTasks();
    if(workflow?.mergeTasks) workflow.mergeTasks(tasks.map((t,idx)=>({...t, section:'affiliate', tone: idx < 2 ? 'revenue' : 'growth', rank:100+idx})));
    const live = workflow?.top('affiliate', 4) || [];
    let shell=document.getElementById('bundleHPartnerShell');
    if(!shell){ shell=document.createElement('div'); shell.id='bundleHPartnerShell'; shell.className='h-partner-shell'; section.prepend(shell); }
    shell.innerHTML=`
      <div class="h-partner-card">
        <div class="section-head">
          <div>
            <div class="h-eyebrow">Partner Workflow</div>
            <h2 style="margin-top:6px;">Turn referral intent into a completion loop.</h2>
            <div class="subtext">The partner desk now supports follow-up, completion, deferral, and cleaner next-step progression.</div>
          </div>
        </div>
        <div class="h-p-list">
          ${live.map((task,idx)=>`<div class="h-p-item"><div><strong>${idx+1}. ${task.title}</strong><div class="h-p-meta">${task.copy}</div></div><div class="h-p-right"><span class="h-pill ${task.tone || 'growth'}">${(task.status||'pending').replace('_',' ')}</span><div class="h-p-actions"><button class="h-mini-btn" type="button" data-h-go="${task.id}">Start</button><button class="h-mini-btn" type="button" data-h-done="${task.id}">Done</button><button class="h-mini-btn" type="button" data-h-snooze="${task.id}">Snooze</button></div></div></div>`).join('')}
        </div>
      </div>
    `;
    shell.querySelectorAll('[data-h-go]').forEach(btn=>btn.addEventListener('click',()=>{
      const task=(workflow?.activeTasks?.()||[]).find(t=>t.id===btn.getAttribute('data-h-go'));
      if(task){ workflow.setStatus(task.id,'in_progress'); go(task.action || {}); }
    }));
    shell.querySelectorAll('[data-h-done]').forEach(btn=>btn.addEventListener('click',()=>{ workflow?.setStatus?.(btn.getAttribute('data-h-done'),'done'); render(); }));
    shell.querySelectorAll('[data-h-snooze]').forEach(btn=>btn.addEventListener('click',()=>{ workflow?.snooze?.(btn.getAttribute('data-h-snooze')); render(); }));
  }
  const boot=()=>{ render(); setTimeout(render,1200); setTimeout(render,3200); };
  document.addEventListener('bundle-h:workflow-updated', () => setTimeout(render, 0));
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
  NS.affiliate={ renderBundleH: render };
  NS.modules = NS.modules || {}; NS.modules.affiliate = true;
})();
