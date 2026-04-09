
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.tools) return;

  const CSS = `
    .i-tools-shell{display:grid;gap:16px;margin-bottom:16px}
    .i-tools-card{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .i-tools-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .i-step-list{display:grid;gap:10px;margin-top:12px}
    .i-step-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .i-step-meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    .i-action-controls{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .i-mini-btn{appearance:none;border:1px solid rgba(255,255,255,.08);background:#1a1a1a;color:#f2f2f2;border-radius:10px;padding:8px 10px;cursor:pointer;font-size:12px}
    .i-pill{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.08);background:#171717}
    .i-pill.done{color:#9de8a8;border-color:rgba(157,232,168,.22)} .i-pill.in_progress{color:#f3ddb0;border-color:rgba(212,175,55,.22)}
    .i-pill.blocked{color:#ffb4b4;border-color:rgba(255,180,180,.22)} .i-pill.snoozed{color:#c8c8ff;border-color:rgba(200,200,255,.20)}
    .g-tools-collapse{border:1px solid rgba(212,175,55,.10);border-radius:16px;overflow:hidden;background:#111;margin-top:16px}
    .g-tools-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;background:rgba(255,255,255,.02)}
    .g-tools-body{display:none;padding:16px;border-top:1px solid rgba(212,175,55,.08)}
    .g-tools-collapse.open .g-tools-body{display:block}
    @media (max-width:1100px){.i-tools-grid{grid-template-columns:1fr 1fr}}
    @media (max-width:760px){.i-tools-grid{grid-template-columns:1fr}}
  `;
  function ensureStyle(){ if(document.getElementById('bundle-i-tools-style')) return; const s=document.createElement('style'); s.id='bundle-i-tools-style'; s.textContent=CSS; document.head.appendChild(s); }
  function txt(id){ return String(document.getElementById(id)?.textContent || '').replace(/\s+/g,' ').trim(); }
  function pill(status){ return `<span class="i-pill ${status || 'open'}">${(status || 'open').replace('_',' ')}</span>`; }
  function controls(id, title, section, openLabel, openAction){
    const action = NS.workflowMemory?.getAction(id, { title, section }) || { status:'open' };
    return `<div data-workflow-id="${id}" data-workflow-title="${title}" data-workflow-section="${section}">
      <div style="display:grid;gap:10px;justify-items:end;">${pill(action.status)}
        <div class="i-action-controls">
          <button class="i-mini-btn" type="button" data-workflow-set="in_progress">Start</button>
          <button class="i-mini-btn" type="button" data-workflow-set="done">Done</button>
          <button class="i-mini-btn" type="button" data-workflow-set="snoozed">Snooze</button>
          <button class="i-mini-btn" type="button" data-workflow-set="blocked">Blocked</button>
          ${openLabel ? `<button class="action-btn" type="button" data-i-open="${openAction || ''}">${openLabel}</button>` : ''}
        </div>
      </div>
    </div>`;
  }
  function render(){
    const section=document.getElementById('extension'); if(!section || !NS.workflowMemory) return; ensureStyle();
    let shell=document.getElementById('bundleIToolsShell');
    if(!shell){ shell=document.createElement('div'); shell.id='bundleIToolsShell'; shell.className='i-tools-shell'; section.prepend(shell); }
    let card=document.getElementById('bundleIToolsWorkflow');
    if(!card){ card=document.createElement('div'); card.id='bundleIToolsWorkflow'; card.className='i-tools-card'; shell.appendChild(card); }
    card.innerHTML = `
      <div class="section-head">
        <div>
          <div class="g-eyebrow">Workflow Engine</div>
          <h2 style="margin-top:6px;">Posting workflow with durable state</h2>
          <div class="subtext">Use start, done, snooze, and blocked states to carry posting work across refresh and section changes.</div>
        </div>
      </div>
      <div class="i-tools-grid">
        <div class="i-tools-card"><div class="stat-label">Access</div><div class="stat-value" style="font-size:24px">${txt('extensionAccessState') || 'Unknown'}</div><div class="stat-sub">Current session and plan truth.</div></div>
        <div class="i-tools-card"><div class="stat-label">Queue</div><div class="stat-value" style="font-size:24px">${txt('extensionReviewQueue') || '0'}</div><div class="stat-sub">Workflow pressure already in the system.</div></div>
        <div class="i-tools-card"><div class="stat-label">Posts Remaining</div><div class="stat-value" style="font-size:24px">${txt('extensionRemainingPosts') || '0'}</div><div class="stat-sub">Daily capacity still available.</div></div>
        <div class="i-tools-card"><div class="stat-label">Compliance</div><div class="stat-value" style="font-size:24px">${txt('extensionComplianceMode') || 'Unset'}</div><div class="stat-sub">Current publish rule profile.</div></div>
      </div>
      <div class="i-step-list">
        <div class="i-step-item"><div><strong>1. Review posting readiness</strong><div class="i-step-meta">Confirm access, queue, capacity, and compliance before moving volume.</div></div>${controls('posting.review_readiness','Review posting readiness','extension','Refresh access','refresh_access')}</div>
        <div class="i-step-item"><div><strong>2. Queue vehicle</strong><div class="i-step-meta">Open inventory and prepare the next live unit for posting.</div></div>${controls('posting.queue_vehicle','Queue vehicle','extension','Open inventory','open_inventory')}</div>
        <div class="i-step-item"><div><strong>3. Open Marketplace</strong><div class="i-step-meta">Move into Marketplace only after queue and compliance look clean.</div></div>${controls('posting.open_marketplace','Open Marketplace','extension','Open Marketplace','open_marketplace')}</div>
        <div class="i-step-item"><div><strong>4. Register result</strong><div class="i-step-meta">Mark the workflow complete after the live post is actually pushed.</div></div>${controls('posting.register_result','Register posting result','extension',null,null)}</div>
      </div>
    `;
    NS.workflowMemory.wireButtons(card);
    card.querySelectorAll('[data-i-open]').forEach(btn=>{
      if(btn.dataset.boundI==='true') return;
      btn.dataset.boundI='true';
      btn.addEventListener('click',()=>{
        const action=btn.getAttribute('data-i-open');
        if(action==='refresh_access') document.getElementById('refreshAccessBtn')?.click();
        if(action==='open_inventory') document.getElementById('openInventoryBtn')?.click();
        if(action==='open_marketplace') document.getElementById('openMarketplaceBtn')?.click();
      });
    });

    const modulesCard=Array.from(section.querySelectorAll('.card')).find(card => /platform stack/i.test(card.querySelector('h2')?.textContent || ''));
    const upgradeCard=Array.from(section.querySelectorAll('.card')).find(card => /tool unlock path/i.test(card.querySelector('h2')?.textContent || ''));
    if(modulesCard || upgradeCard){
      let collapse=document.getElementById('bundleGToolsSecondary');
      if(!collapse){ collapse=document.createElement('div'); collapse.id='bundleGToolsSecondary'; collapse.className='g-tools-collapse'; collapse.innerHTML=`<div class="g-tools-head"><div><div class="g-eyebrow">Quiet Mode</div><strong>Modules, premium detail, and lower-priority tool context</strong></div><div class="subtext" id="bundleGToolsState">Expand</div></div><div class="g-tools-body"></div>`; section.appendChild(collapse); collapse.querySelector('.g-tools-head').addEventListener('click',()=>{ collapse.classList.toggle('open'); const t=collapse.querySelector('#bundleGToolsState'); if(t) t.textContent=collapse.classList.contains('open')?'Collapse':'Expand';}); }
      const body=collapse.querySelector('.g-tools-body');
      [upgradeCard, modulesCard].filter(Boolean).forEach(el=>{ if(body && !body.contains(el)) body.appendChild(el); });
    }
  }
  NS.tools={ renderBundleI: render };
  NS.modules = NS.modules || {}; NS.modules.tools = true;
  const boot=()=>{ render(); setTimeout(render,1200); setTimeout(render,3200); };
  window.addEventListener('elevate:workflow-updated', ()=>render());
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
