(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.tools) return;

  const CSS = `
    .g-tools-collapse{border:1px solid rgba(212,175,55,.10);border-radius:16px;overflow:hidden;background:#111;margin-top:16px}
    .g-tools-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;background:rgba(255,255,255,.02)}
    .g-tools-body{display:none;padding:16px;border-top:1px solid rgba(212,175,55,.08)}
    .g-tools-collapse.open .g-tools-body{display:block}
  `;
  function ensureStyle(){ if(document.getElementById('bundle-g-tools-style')) return; const s=document.createElement('style'); s.id='bundle-g-tools-style'; s.textContent=CSS; document.head.appendChild(s); }
  function render(){
    const section=document.getElementById('extension'); if(!section) return; ensureStyle();
    const modulesCard=Array.from(section.querySelectorAll('.card')).find(card => /platform stack/i.test(card.querySelector('h2')?.textContent || ''));
    const upgradeCard=Array.from(section.querySelectorAll('.card')).find(card => /tool unlock path/i.test(card.querySelector('h2')?.textContent || ''));
    if(!modulesCard && !upgradeCard) return;
    let collapse=document.getElementById('bundleGToolsSecondary');
    if(!collapse){ collapse=document.createElement('div'); collapse.id='bundleGToolsSecondary'; collapse.className='g-tools-collapse'; collapse.innerHTML=`<div class="g-tools-head"><div><div class="g-eyebrow">Quiet Mode</div><strong>Modules, premium detail, and lower-priority tool context</strong></div><div class="subtext" id="bundleGToolsState">Expand</div></div><div class="g-tools-body"></div>`; section.appendChild(collapse); collapse.querySelector('.g-tools-head').addEventListener('click',()=>{ collapse.classList.toggle('open'); const t=collapse.querySelector('#bundleGToolsState'); if(t) t.textContent=collapse.classList.contains('open')?'Collapse':'Expand';}); }
    const body=collapse.querySelector('.g-tools-body');
    [upgradeCard, modulesCard].filter(Boolean).forEach(el=>{ if(body && !body.contains(el)) body.appendChild(el); });
  }
  NS.tools={ renderBundleG: render };
  NS.modules = NS.modules || {}; NS.modules.tools = true;
  const boot=()=>{ render(); setTimeout(render,1200); setTimeout(render,3200); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
