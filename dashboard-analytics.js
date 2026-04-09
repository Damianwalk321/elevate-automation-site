
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.analytics) return;

  const CSS = `
    .c-analytics-shell{display:grid;gap:16px}
    .c-analytics-card,.c-analytics-hero{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .c-analytics-hero-grid{display:grid;grid-template-columns:1.5fr repeat(4,minmax(0,1fr));gap:12px}
    .c-a-title{font-size:28px;line-height:1.05;margin:0 0 8px}
    .c-a-copy{color:#d6d6d6;line-height:1.55;font-size:14px}
    .c-a-list{display:grid;gap:10px;margin-top:12px}
    .c-a-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .c-a-meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    .c-a-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .c-a-sublist{display:grid;gap:10px}
    .c-a-subitem{padding:12px;border-radius:12px;background:#171717;border:1px solid rgba(255,255,255,.05)}
    .c-a-mini{font-size:12px;color:#b8b8b8;line-height:1.5;margin-top:4px}
    .c-pill{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.08);background:#171717}
    .c-pill.revenue{color:#f3ddb0;border-color:rgba(212,175,55,.22)}
    .c-pill.growth{color:#9de8a8;border-color:rgba(157,232,168,.22)}
    .c-pill.cleanup{color:#cfd7ff;border-color:rgba(180,190,255,.22)}
    .c-collapse{border:1px solid rgba(212,175,55,.10);border-radius:16px;overflow:hidden;background:#111}
    .c-collapse-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;background:rgba(255,255,255,.02)}
    .c-collapse-body{display:none;padding:16px;border-top:1px solid rgba(212,175,55,.08)}
    .c-collapse.open .c-collapse-body{display:block}
    @media (max-width:1200px){.c-analytics-hero-grid,.c-a-grid{grid-template-columns:1fr 1fr}}
    @media (max-width:760px){.c-analytics-hero-grid,.c-a-grid{grid-template-columns:1fr}.c-a-title{font-size:24px}}
  `;

  function ensureStyle(){ if(document.getElementById('bundle-c-analytics-style')) return; const s=document.createElement('style'); s.id='bundle-c-analytics-style'; s.textContent=CSS; document.head.appendChild(s); }
  function openSection(section, focusId){
    if(typeof window.showSection==='function') window.showSection(section);
    if(focusId) setTimeout(()=>document.getElementById(focusId)?.scrollIntoView({behavior:'smooth', block:'center'}),220);
  }
  function analytics(){ return NS.state?.get?.('analytics', {}) || {}; }
  function summary(){ return analytics().tracking_summary || {}; }

  function itemRow(item, meta) {
    return `<div class="c-a-subitem"><strong>${item.title || item.id || "Listing"}</strong><div class="c-a-mini">${meta}</div></div>`;
  }

  function render() {
    const section = document.getElementById('tools');
    if(!section || !NS.state) return;
    ensureStyle();

    const data = analytics();
    const s = summary();
    const q = Array.isArray(data.action_queue) ? data.action_queue : [];
    const leaders = data.leaders || {};

    let shell = document.getElementById('bundleCAnalyticsShell');
    if(!shell){ shell=document.createElement('div'); shell.id='bundleCAnalyticsShell'; shell.className='c-analytics-shell'; section.prepend(shell); }

    let hero = document.getElementById('bundleCAnalyticsHero');
    if(!hero){ hero=document.createElement('div'); hero.id='bundleCAnalyticsHero'; hero.className='c-analytics-hero'; shell.appendChild(hero); }
    hero.innerHTML = `
      <div class="c-analytics-hero-grid">
        <div class="c-analytics-card">
          <div class="g-eyebrow">Event Tracking + Lifecycle</div>
          <h2 class="c-a-title">Analytics now has event memory, not just listing snapshots.</h2>
          <div class="c-a-copy">Bundle C promotes listing history into view/message deltas, lifecycle transitions, price-change awareness, cooling-off detection, and recovery tracking.</div>
        </div>
        <div class="c-analytics-card"><div class="stat-label">Fresh Traction</div><div class="stat-value" style="font-size:24px">${s.fresh_traction_count || 0}</div><div class="stat-sub">Listings with recent message momentum.</div></div>
        <div class="c-analytics-card"><div class="stat-label">Needs Refresh</div><div class="stat-value" style="font-size:24px">${s.needs_refresh_count || 0}</div><div class="stat-sub">Listings that are cooling off.</div></div>
        <div class="c-analytics-card"><div class="stat-label">Price Attention</div><div class="stat-value" style="font-size:24px">${s.price_attention_count || 0}</div><div class="stat-sub">Listings with price-change review needed.</div></div>
        <div class="c-analytics-card"><div class="stat-label">Event Updates</div><div class="stat-value" style="font-size:24px">${(s.view_update_events || 0) + (s.message_update_events || 0)}</div><div class="stat-sub">Tracked view/message update events.</div></div>
      </div>
    `;

    let queue = document.getElementById('bundleCAnalyticsQueue');
    if(!queue){ queue=document.createElement('div'); queue.id='bundleCAnalyticsQueue'; queue.className='c-analytics-card'; shell.appendChild(queue); }
    queue.innerHTML = `
      <div class="section-head">
        <div>
          <div class="g-eyebrow">Action Queue V3</div>
          <h2 style="margin-top:6px;">Lifecycle-driven listing actions</h2>
          <div class="subtext">The queue now explains what changed, what cooled off, and what deserves rescue or promotion.</div>
        </div>
      </div>
      <div class="c-a-list">
        ${q.length ? q.map((item, idx)=>`
          <div class="c-a-item">
            <div>
              <strong>${idx+1}. ${item.title}</strong>
              <div class="c-a-meta">${item.copy}</div>
            </div>
            <div style="display:grid;gap:10px;justify-items:end;">
              <span class="c-pill ${item.tone || 'growth'}">${item.tone || 'growth'}</span>
              <button class="action-btn" type="button" data-c-open="${item.section || 'tools'}" data-c-focus="${item.focus || ''}">Open</button>
            </div>
          </div>
        `).join('') : `<div class="listing-empty">No lifecycle-driven actions yet.</div>`}
      </div>
    `;
    queue.querySelectorAll('[data-c-open]').forEach((btn)=>{
      if(btn.dataset.boundC==='true') return; btn.dataset.boundC='true';
      btn.addEventListener('click',()=>openSection(btn.getAttribute('data-c-open'), btn.getAttribute('data-c-focus') || ''));
    });

    let board = document.getElementById('bundleCAnalyticsBoard');
    if(!board){ board=document.createElement('div'); board.id='bundleCAnalyticsBoard'; board.className='c-a-grid'; shell.appendChild(board); }
    board.innerHTML = `
      <div class="c-analytics-card">
        <div class="section-head"><div><div class="g-eyebrow">Top Movers</div><h2 style="margin-top:6px;">Fresh traction and recovered listings</h2></div></div>
        <div class="c-a-sublist">
          ${(leaders.fresh_traction || []).slice(0,5).map((item)=>itemRow(item, `Recent message lift • ${item.messages || 0} messages • ${item.confidence || 'tracked'} signal`)).join('') || '<div class="listing-empty">No fresh-traction listings yet.</div>'}
          ${(leaders.recovered || []).slice(0,3).map((item)=>itemRow(item, `Recovered after intervention • ${item.messages || 0} messages now`)).join('')}
        </div>
      </div>
      <div class="c-analytics-card">
        <div class="section-head"><div><div class="g-eyebrow">Leaks + Cooling</div><h2 style="margin-top:6px;">Conversion leaks, cooling off, and pricing pressure</h2></div></div>
        <div class="c-a-sublist">
          ${(leaders.high_views_low_messages || []).slice(0,3).map((item)=>itemRow(item, `${item.views || 0} views • 0 messages or near-zero conversion`)).join('')}
          ${(leaders.cooling_off || []).slice(0,3).map((item)=>itemRow(item, `Cooling off • last meaningful traction is fading`)).join('')}
          ${(leaders.price_attention || []).slice(0,3).map((item)=>itemRow(item, `Price changed • review whether traction improved`)).join('')}
          ${(!(leaders.high_views_low_messages || []).length && !(leaders.cooling_off || []).length && !(leaders.price_attention || []).length) ? '<div class="listing-empty">No major leak signals yet.</div>' : ''}
        </div>
      </div>
    `;

    const lower=Array.from(section.children).filter(el=>el!==shell && !shell.contains(el));
    let collapse=document.getElementById('bundleCAnalyticsSecondary');
    if(!collapse){
      collapse=document.createElement('div');
      collapse.id='bundleCAnalyticsSecondary';
      collapse.className='c-collapse';
      collapse.innerHTML=`<div class="c-collapse-head"><div><div class="g-eyebrow">Quiet Mode</div><strong>Charts, scorecards, and supporting diagnostics</strong></div><div class="subtext" id="bundleCAnalyticsState">Expand</div></div><div class="c-collapse-body"></div>`;
      shell.appendChild(collapse);
      collapse.querySelector('.c-collapse-head').addEventListener('click',()=>{
        collapse.classList.toggle('open');
        const t=collapse.querySelector('#bundleCAnalyticsState');
        if(t) t.textContent=collapse.classList.contains('open')?'Collapse':'Expand';
      });
    }
    const body=collapse.querySelector('.c-collapse-body');
    lower.forEach(el=>{ if(body && !body.contains(el)) body.appendChild(el); });
  }

  NS.analytics = { renderBundleC: render };
  NS.modules = NS.modules || {};
  NS.modules.analytics = true;
  const boot=()=>{ render(); setTimeout(render,1200); setTimeout(render,3200); };
  window.addEventListener('elevate:tracking-refreshed', ()=>render());
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
