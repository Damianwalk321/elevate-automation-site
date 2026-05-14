(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.analyticsG) return;

  const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
  const num = (v) => { const n = Number(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const dayKey = (value) => {
    const d = value ? new Date(value) : new Date();
    if (!Number.isFinite(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };
  const fmtShort = (key) => {
    const d = new Date(`${key}T00:00:00`);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : key;
  };

  const CSS = `
    .ea-analytics-shell{display:grid;gap:18px}.ea-analytics-toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.ea-analytics-segment{display:inline-flex;gap:8px;background:#111;border:1px solid rgba(212,175,55,.12);border-radius:999px;padding:6px}.ea-analytics-segment button{appearance:none;border:none;background:transparent;color:#d8d8d8;padding:10px 14px;border-radius:999px;cursor:pointer;font-weight:700;font-size:13px}.ea-analytics-segment button.active{background:rgba(212,175,55,.15);color:#f3ddb0}.ea-analytics-pane{display:grid;gap:18px}.ea-analytics-pane.hidden{display:none!important}.ea-analytics-listing-toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px}.ea-analytics-listing-toolbar .toolbar{margin:0}.ea-analytics-note{padding:14px 16px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05);color:#d1d1d1;line-height:1.55}.ea-review-single-card{padding:0!important;background:transparent!important;border:none!important;box-shadow:none!important}
    .perf-shell{display:grid;gap:16px}.perf-kpi-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.perf-kpi{background:#151515;border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:14px}.perf-kpi strong{display:block;font-size:25px;line-height:1.08}.perf-kpi span{display:block;color:#a9a9a9;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.7px;margin-top:7px}.perf-kpi.gold{border-color:rgba(212,175,55,.32);background:rgba(212,175,55,.075)}.perf-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.65fr);gap:14px}.perf-card{background:#121212;border:1px solid rgba(212,175,55,.12);border-radius:20px;padding:16px}.perf-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.perf-title{font-size:18px;font-weight:900}.perf-copy{color:#a9a9a9;font-size:13px;line-height:1.45;margin-top:4px}.perf-chart-wrap{height:260px;width:100%;overflow:hidden}.perf-chart{width:100%;height:100%;display:block}.perf-axis{stroke:rgba(255,255,255,.12);stroke-width:1}.perf-line{fill:none;stroke:#d4af37;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.perf-line.secondary{stroke:rgba(255,255,255,.56);stroke-width:2}.perf-area{fill:rgba(212,175,55,.1)}.perf-dot{fill:#d4af37}.perf-bars rect{fill:rgba(212,175,55,.62)}.perf-legend{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;color:#a9a9a9;font-size:12px}.perf-legend b{color:#f3ddb0}.perf-insights{display:grid;gap:10px}.perf-insight{background:#171717;border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:13px}.perf-insight strong{display:block;font-size:14px}.perf-insight span{display:block;color:#a9a9a9;font-size:12px;line-height:1.45;margin-top:5px}.perf-quality{display:flex;gap:10px;flex-wrap:wrap}.perf-quality-chip{display:inline-flex;align-items:center;min-height:30px;padding:0 10px;border-radius:999px;background:#171717;border:1px solid rgba(255,255,255,.07);color:#d8d8d8;font-size:12px;font-weight:800}.perf-quality-chip.gold{color:#f3ddb0;border-color:rgba(212,175,55,.24);background:rgba(212,175,55,.08)}
    @media(max-width:1180px){.perf-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.perf-grid{grid-template-columns:1fr}}@media(max-width:720px){.perf-kpi-grid{grid-template-columns:1fr}.perf-chart-wrap{height:220px}}
  `;

  function injectStyle(){ if (document.getElementById('ea-analytics-workspace-style')) return; const style=document.createElement('style'); style.id='ea-analytics-workspace-style'; style.textContent=CSS; document.head.appendChild(style); }
  function role(){ return (window.dashboardSummary?.manager_access) ? 'manager' : 'operator'; }
  function ensureAnalyticsSection(){ const mainInner=document.querySelector('.main-inner'); if(!mainInner) return null; let section=document.getElementById('analytics'); if(!section){ section=document.createElement('section'); section.id='analytics'; section.className='dashboard-section'; mainInner.appendChild(section); } return section; }
  function mountRoot(){ const section=ensureAnalyticsSection(); if(!section) return null; let root=document.getElementById('eaRootG'); if(!root){ root=document.createElement('div'); root.id='eaRootG'; section.appendChild(root); } else if(!section.contains(root)) section.appendChild(root); return root; }

  function allListings(){ return Object.values(NS.state?.get?.('listingRegistry', {}) || {}); }
  function statusLower(item){ return clean(item.status).toLowerCase(); }
  function lifecycleLower(item){ return clean(item.lifecycle_status).toLowerCase(); }
  function bucketLower(item){ return clean(item.review_bucket).toLowerCase(); }
  function isRemoved(item){ return ['sold','deleted','inactive','failed','removed'].includes(statusLower(item)) || lifecycleLower(item)==='review_delete' || bucketLower(item)==='removedvehicles'; }
  function isActive(item){ return !isRemoved(item); }
  function isPriceReview(item){ return !!item.price_review_required || lifecycleLower(item)==='review_price_update' || bucketLower(item)==='pricechanges' || !!clean(item.price_warning); }
  function isMissingData(item){ return !!item.missing_image || !clean(item.image_url) || !clean(item.vin) || !clean(item.stock_number) || !clean(item.marketplace_url) || item.price_resolved===false; }
  function postedAt(item){ return item.posted_at || item.created_at || item.updated_at || item.last_seen_at || null; }

  function lastNDays(nDays=30){ const out=[]; const now=new Date(); for(let i=nDays-1;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); out.push(d.toISOString().slice(0,10)); } return out; }

  function buildSeries(rows, days){
    const postsByDay = Object.fromEntries(days.map(d => [d, 0]));
    const reviewByDay = Object.fromEntries(days.map(d => [d, 0]));
    rows.forEach((item) => {
      const key = dayKey(postedAt(item));
      if (key && postsByDay[key] !== undefined) postsByDay[key] += 1;
      if ((isRemoved(item) || isPriceReview(item) || isMissingData(item)) && key && reviewByDay[key] !== undefined) reviewByDay[key] += 1;
    });
    let running = 0;
    const activeLine = days.map((d) => {
      running += postsByDay[d] || 0;
      return { date:d, value: Math.min(running, rows.filter(isActive).length || running) };
    });
    const posts = days.map((d) => ({ date:d, value: postsByDay[d] || 0 }));
    const review = days.map((d) => ({ date:d, value: reviewByDay[d] || 0 }));
    return { activeLine, posts, review };
  }

  function buildModel(){
    const rows = allListings();
    const active = rows.filter(isActive);
    const reviews = rows.filter((item)=> isRemoved(item) || isPriceReview(item) || isMissingData(item) || !!item.needs_action || !!item.weak);
    const days = lastNDays(30);
    const series = buildSeries(rows, days);
    const postedThisWeek = rows.filter((item)=> { const ts=new Date(postedAt(item)||0).getTime(); return Number.isFinite(ts) && Date.now()-ts <= 7*86400000; }).length;
    const avgDaysLive = active.length ? Math.round(active.reduce((sum,item)=> { const ts=new Date(postedAt(item)||Date.now()).getTime(); return sum + Math.max(0,(Date.now()-ts)/86400000); },0)/active.length) : 0;
    const missingData = rows.filter(isMissingData).length;
    const priceReviews = rows.filter(isPriceReview).length;
    const inventoryMissing = rows.filter(isRemoved).length;
    const sync = NS.state?.get?.('sync', {}) || {};
    return { rows, active, reviews, series, postedThisWeek, avgDaysLive, missingData, priceReviews, inventoryMissing, sync };
  }

  function points(data, w, h, pad){
    const max = Math.max(1, ...data.map(d=>num(d.value)));
    return data.map((d,i)=> {
      const x = pad + (data.length<=1 ? 0 : i*((w-pad*2)/(data.length-1)));
      const y = h-pad - (num(d.value)/max)*(h-pad*2);
      return { ...d, x, y };
    });
  }

  function lineChart(id, title, copy, data, secondary){
    const w=720,h=260,p=28;
    const pts=points(data,w,h,p);
    const path=pts.map((pt,i)=>`${i?'L':'M'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
    const area=`M${p},${h-p} ${path.replace(/^M/,'L')} L${w-p},${h-p} Z`;
    const secPts=secondary ? points(secondary,w,h,p) : [];
    const secPath=secPts.map((pt,i)=>`${i?'L':'M'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
    const last=pts[pts.length-1] || { value:0 };
    return `<div class="perf-card"><div class="perf-card-head"><div><div class="perf-title">${title}</div><div class="perf-copy">${copy}</div></div><div class="perf-quality-chip gold">${last.value} now</div></div><div class="perf-chart-wrap"><svg class="perf-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}"><line class="perf-axis" x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}"/><line class="perf-axis" x1="${p}" y1="${p}" x2="${p}" y2="${h-p}"/><path class="perf-area" d="${area}"/><path class="perf-line" d="${path}"/>${secPath ? `<path class="perf-line secondary" d="${secPath}"/>` : ''}${pts.filter((_,i)=>i%7===0||i===pts.length-1).map(pt=>`<circle class="perf-dot" cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3"/>`).join('')}</svg></div><div class="perf-legend"><span><b>${fmtShort(data[0]?.date||'')}</b> start</span><span><b>${fmtShort(data[data.length-1]?.date||'')}</b> today</span>${secondary ? '<span>Secondary line: review pressure</span>' : ''}</div></div>`;
  }

  function barChart(title, copy, data){
    const w=720,h=220,p=28;
    const max=Math.max(1,...data.map(d=>num(d.value)));
    const bw=(w-p*2)/data.length;
    return `<div class="perf-card"><div class="perf-card-head"><div><div class="perf-title">${title}</div><div class="perf-copy">${copy}</div></div></div><div class="perf-chart-wrap" style="height:220px"><svg class="perf-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}"><line class="perf-axis" x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}"/><g class="perf-bars">${data.map((d,i)=>{ const bh=(num(d.value)/max)*(h-p*2); const x=p+i*bw+2; const y=h-p-bh; return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(2,bw-4).toFixed(1)}" height="${bh.toFixed(1)}" rx="3"/>`; }).join('')}</g></svg></div><div class="perf-legend"><span><b>${data.reduce((s,d)=>s+num(d.value),0)}</b> posts in visible window</span><span>Derived from posted/created timestamps</span></div></div>`;
  }

  function insightCards(model){
    const pressure = model.reviews.length;
    const active = model.active.length;
    const dataMaturity = model.rows.length ? 'Operational data live' : 'Waiting for Supabase rows';
    const items = [
      ['Output', active ? `${active} active listings are live in the portfolio.` : 'No active listings are currently loaded.'],
      ['Review Pressure', pressure ? `${pressure} rows need operator review before scaling output.` : 'No review backlog is currently loaded.'],
      ['Data Quality', model.missingData ? `${model.missingData} rows need image, VIN/stock, URL, or price cleanup.` : 'Core listing data is clean enough for V1 reporting.'],
      ['Data Maturity', `${dataMaturity}. Trend accuracy improves as scanner/posting events accumulate daily.`]
    ];
    return `<div class="perf-insights">${items.map(([a,b])=>`<div class="perf-insight"><strong>${a}</strong><span>${b}</span></div>`).join('')}</div>`;
  }

  function performanceHtml(){
    const m = buildModel();
    const kpis = [
      ['Active Listings', m.active.length, 'Current live portfolio count', 'gold'],
      ['Posted This Week', m.postedThisWeek, 'Listings posted in the last 7 days', ''],
      ['Review Queue', m.reviews.length, 'Rows requiring operator action', 'gold'],
      ['Inventory Missing', m.inventoryMissing, 'Likely stale/sold checks', ''],
      ['Price Reviews', m.priceReviews, 'Price or mileage truth issues', ''],
      ['Avg Days Live', m.avgDaysLive, 'Average age of active portfolio', '']
    ];
    return `<div class="perf-shell"><div class="perf-kpi-grid">${kpis.map(([label,value,copy,tone])=>`<div class="perf-kpi ${tone}"><strong>${value}</strong><span>${label}</span><div class="perf-copy">${copy}</div></div>`).join('')}</div><div class="perf-grid"><div>${lineChart('active-trend','Active Listings Over Time','Automatic trend derived from Supabase listing timestamps. This becomes more accurate as daily scanning continues.',m.series.activeLine,m.series.review)}</div><div>${insightCards(m)}</div></div><div class="perf-grid"><div>${barChart('Posts By Day','Daily posting output from available posted/created timestamps.',m.series.posts)}</div><div class="perf-card"><div class="perf-title">Data Quality</div><div class="perf-copy">Performance is calculated from existing Supabase listing truth. No manual capture required.</div><div class="perf-quality" style="margin-top:14px"><span class="perf-quality-chip gold">${m.rows.length} total rows</span><span class="perf-quality-chip">${m.active.length} active</span><span class="perf-quality-chip">${m.reviews.length} review</span><span class="perf-quality-chip">${m.sync?.confidence || 'synced'}</span></div></div></div></div>`;
  }

  function renderPerformance(){ const mount=document.getElementById('performanceMount'); if(mount) mount.innerHTML = performanceHtml(); }

  function operatorView(){
    return `<section id="analyticsWorkspace" class="card ea-analytics-shell"><div class="ea-analytics-toolbar"><div><div class="module-group-label">Analytics Workspace</div><h2 style="margin-top:6px;">Intelligence Centre</h2><div class="subtext">Performance, active listings, and operator review are consolidated into one operating area.</div></div><div class="ea-analytics-segment" id="analyticsSegmentControl"><button type="button" data-pane="performance" class="active">Performance</button><button type="button" data-pane="listings">Listings</button><button type="button" data-pane="review">Review</button></div></div><div id="analyticsPanePerformance" class="ea-analytics-pane"><div id="performanceMount"><div class="ea-analytics-note">Loading performance intelligence from Supabase truth...</div></div></div><div id="analyticsPaneListings" class="ea-analytics-pane hidden"><div class="card"><div class="ea-analytics-listing-toolbar"><div><h3>Active vehicle listings</h3><div id="analyticsListingsStatus" class="subtext">Active portfolio rows only. Review/stale rows live in Review.</div></div><div class="toolbar" style="gap:12px; flex-wrap:wrap;"><div id="analyticsListingQuickFilters" style="display:flex; gap:8px; flex-wrap:wrap;"><button class="action-btn active" type="button" data-filter="all">All</button><button class="action-btn" type="button" data-filter="active">Active</button><button class="action-btn" type="button" data-filter="review">Review</button><button class="action-btn" type="button" data-filter="weak">Weak</button><button class="action-btn" type="button" data-filter="needs_action">Needs Action</button><button class="action-btn" type="button" data-filter="likely_sold">Inventory Missing</button></div><select id="analyticsListingSortSelect"><option value="popular">Sort: Most Popular</option><option value="newest">Sort: Newest</option><option value="price_high">Sort: Price High → Low</option><option value="price_low">Sort: Price Low → High</option></select><input id="analyticsListingSearchInput" type="text" placeholder="Search make, model, VIN, stock..." /></div></div><div id="analyticsListingsGrid"><div class="listing-empty">No portfolio rows loaded yet.</div></div><div id="analyticsListingsGridStatus" class="status-line"></div></div></div><div id="analyticsPaneReview" class="ea-analytics-pane hidden"><div class="ea-review-single-card"><div id="analyticsReviewQueue"><div class="listing-empty">No review items yet.</div></div></div><div id="analyticsNeedsActionQueue" style="display:none"></div><div id="analyticsPriceWatchQueue" style="display:none"></div></div></section>`;
  }

  function managerView(){ return `<section id="analyticsWorkspace" class="card ea-analytics-shell"><div class="module-group-label">Manager Console</div><h2 style="margin-top:6px;">Analytics workspace</h2><div class="ea-analytics-note">Manager-specific analytics can be layered here later. The operator workspace is now the primary listings and review surface.</div></section>`; }

  function bindSegment(){ const control=document.getElementById('analyticsSegmentControl'); if(!control||control.dataset.bound==='true') return; control.dataset.bound='true'; const panes={performance:document.getElementById('analyticsPanePerformance'),listings:document.getElementById('analyticsPaneListings'),review:document.getElementById('analyticsPaneReview')}; Array.from(control.querySelectorAll('button')).forEach((button)=>button.addEventListener('click',()=>{ const pane=button.getAttribute('data-pane')||'performance'; Array.from(control.querySelectorAll('button')).forEach((btn)=>btn.classList.toggle('active',btn===button)); Object.values(panes).forEach((node)=>node?.classList.add('hidden')); panes[pane]?.classList.remove('hidden'); if(pane==='performance') renderPerformance(); })); }

  function render(){ const root=mountRoot(); if(!root) return; injectStyle(); root.innerHTML = role()==='operator' ? operatorView() : managerView(); bindSegment(); renderPerformance(); window.dispatchEvent(new CustomEvent('elevate:analytics-workspace-mounted')); setTimeout(renderPerformance, 900); setTimeout(renderPerformance, 2400); }

  NS.modules = NS.modules || {}; NS.modules.analyticsG = true; NS.analyticsWorkspace = { render, renderPerformance };
  window.addEventListener('load', render);
  window.addEventListener('elevate:tracking-refreshed', renderPerformance);
  window.addEventListener('elevate:analytics-workspace-mounted', () => setTimeout(renderPerformance, 300));
  window.addEventListener('elevate:sync-refreshed', renderPerformance);
})();