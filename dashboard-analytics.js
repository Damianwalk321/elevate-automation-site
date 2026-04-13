
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.analytics) return;

  const CSS = `
    .ea-analytics-shell{display:grid;gap:16px;margin-bottom:20px}
    .ea-analytics-card,.ea-analytics-hero{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .ea-analytics-hero-grid{display:grid;grid-template-columns:1.4fr repeat(4,minmax(0,1fr));gap:12px}
    .ea-a-title{font-size:28px;line-height:1.05;margin:0 0 8px}
    .ea-a-copy{color:#d6d6d6;line-height:1.55;font-size:14px}
    .ea-a-list{display:grid;gap:10px;margin-top:12px}
    .ea-a-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .ea-a-meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    .ea-sync-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .ea-mini{font-size:12px;color:#b8b8b8;line-height:1.5}
    .ea-pill{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.08);background:#171717}
    .ea-pill.synced{color:#9de8a8;border-color:rgba(157,232,168,.22)}
    .ea-pill.tracked{color:#f3ddb0;border-color:rgba(212,175,55,.22)}
    .ea-pill.estimated{color:#ffcfad;border-color:rgba(255,207,173,.22)}
    .ea-pill.critical{color:#ffb4b4;border-color:rgba(255,180,180,.22)}
    .ea-tabbar{display:flex;gap:8px;flex-wrap:wrap}
    .ea-tabbar button{appearance:none;border:1px solid rgba(255,255,255,.08);background:#171717;color:#efefef;border-radius:999px;padding:10px 14px;cursor:pointer;font-weight:700;font-size:13px}
    .ea-tabbar button.active{background:rgba(212,175,55,.15);color:#f3ddb0;border-color:rgba(212,175,55,.24)}
    .ea-tab-panel{display:none}
    .ea-tab-panel.active{display:block}
    .ea-post-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
    .ea-post-card{background:linear-gradient(180deg,rgba(255,255,255,.01),rgba(255,255,255,0));border:1px solid rgba(212,175,55,.12);border-radius:16px;overflow:hidden}
    .ea-post-media{height:150px;background:#171717;border-bottom:1px solid rgba(255,255,255,.05)}
    .ea-post-media img{width:100%;height:100%;object-fit:cover;display:block}
    .ea-post-content{padding:14px;display:grid;gap:10px}
    .ea-post-title{font-size:16px;font-weight:700;line-height:1.35}
    .ea-post-sub{font-size:12px;color:#a9a9a9;line-height:1.45}
    .ea-post-price{font-size:22px;font-weight:800;color:#f3ddb0}
    .ea-post-price.unresolved{color:#ffcfad}
    .ea-post-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .ea-post-kpi{border:1px solid rgba(255,255,255,.06);background:#171717;border-radius:12px;padding:10px}
    .ea-post-kpi strong{display:block;font-size:14px}
    .ea-post-kpi span{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#d4af37;margin-bottom:4px}
    .ea-post-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .ea-review-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
    .ea-review-col{display:grid;gap:10px;align-content:start}
    .ea-review-col-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
    .ea-review-item{background:#151515;border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:14px;display:grid;gap:10px}
    .ea-review-reason{font-size:12px;line-height:1.5;color:#cfcfcf;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:10px;padding:10px}
    .ea-empty{padding:20px;border-radius:14px;border:1px dashed rgba(212,175,55,.16);color:#9d9d9d;text-align:center}
    @media (max-width:1200px){.ea-analytics-hero-grid,.ea-sync-grid,.ea-review-columns{grid-template-columns:1fr 1fr}.ea-post-grid{grid-template-columns:1fr 1fr}}
    @media (max-width:760px){.ea-analytics-hero-grid,.ea-sync-grid,.ea-review-columns,.ea-post-grid,.ea-post-kpis,.ea-post-actions{grid-template-columns:1fr}.ea-a-title{font-size:24px}}
  `;

  function ensureStyle(){
    if(document.getElementById('ea-analytics-bundle-e-style')) return;
    const s=document.createElement('style');
    s.id='ea-analytics-bundle-e-style';
    s.textContent=CSS;
    document.head.appendChild(s);
  }

  function get(path, fallback){ return NS.state?.get?.(path, fallback); }
  function num(value){ const n = Number(value); return Number.isFinite(n) ? n : 0; }
  function clean(value){ return String(value || '').replace(/\s+/g,' ').trim(); }
  function displayPrice(item){
    if (item.display_price_text) return item.display_price_text;
    const n = num(item.price);
    return n ? `$${n.toLocaleString()}` : 'Price pending';
  }
  function open(section, focusId){
    try{ if(typeof window.showSection==='function') window.showSection(section); }catch{}
    if(focusId) setTimeout(()=>document.getElementById(focusId)?.scrollIntoView({behavior:'smooth', block:'center'}),220);
  }

  function getListings(){
    const summaryRows = Array.isArray(window.dashboardSummary?.recent_listings) ? window.dashboardSummary.recent_listings : [];
    const registryRows = Object.values(get('listingRegistry', {}) || {});
    const source = registryRows.length ? registryRows : summaryRows;
    return source.map((row) => {
      const views = num(row.views_count ?? row.views);
      const messages = num(row.messages_count ?? row.messages);
      const price = num(row.price);
      const lifecycle = clean(row.lifecycle_status || row.review_bucket || '');
      const recommended = clean(row.recommended_action || '');
      const likelySold = Boolean(row.likely_sold) || /review_delete|removedvehicles/i.test(lifecycle);
      const stale = Boolean(row.weak) || /stale/i.test(clean(row.status || lifecycle));
      const priceReview = /price/i.test(lifecycle) || /price/i.test(recommended) || !Boolean(row.price_resolved ?? true);
      return {
        id: clean(row.id || row.identity_key || row.marketplace_listing_id || row.vin || row.stock_number || row.title),
        identity_key: clean(row.identity_key || ''),
        title: clean(row.title || `${clean(row.year)} ${clean(row.make)} ${clean(row.model)}` || 'Listing'),
        subtitle: clean([row.stock_number || row.vin, row.make, row.model, row.trim].filter(Boolean).join(' • ')),
        image_url: clean(row.image_url || ''),
        price,
        price_resolved: Boolean(row.price_resolved ?? true),
        display_price_text: clean(row.display_price_text || ''),
        views,
        messages,
        health_score: num(row.health_score),
        opportunity_score: num(row.opportunity_score),
        price_review_priority: num(row.price_review_priority),
        refresh_priority: num(row.refresh_priority),
        recommended_action: recommended || 'Review',
        pricing_insight: clean(row.pricing_insight || ''),
        content_feedback: clean(row.content_feedback || ''),
        lifecycle_status: lifecycle,
        status: clean(row.status || 'active'),
        source_url: clean(row.source_url || ''),
        likely_sold: likelySold,
        stale,
        price_review: priceReview,
        action_bucket: clean(row.action_bucket || ''),
        posted_at: row.posted_at || row.updated_at || '',
        body_style: clean(row.body_style || ''),
        fuel_type: clean(row.fuel_type || ''),
        exterior_color: clean(row.exterior_color || ''),
        vin: clean(row.vin || ''),
        stock_number: clean(row.stock_number || '')
      };
    });
  }

  function topLists(listings){
    const byOpportunity = [...listings].sort((a,b) => (b.opportunity_score - a.opportunity_score) || (b.messages - a.messages) || (b.views - a.views));
    return {
      posts: byOpportunity.slice(0, 12),
      soldStale: listings.filter((x) => x.likely_sold || x.stale).sort((a,b) => (Number(b.likely_sold) - Number(a.likely_sold)) || (b.refresh_priority - a.refresh_priority)).slice(0, 12),
      priceWatch: listings.filter((x) => x.price_review).sort((a,b) => (b.price_review_priority - a.price_review_priority) || (b.views - a.views)).slice(0, 12)
    };
  }

  function postCard(item){
    const badge = !item.price_resolved ? 'Price Pending' : item.likely_sold ? 'Likely Sold' : item.price_review ? 'Price Watch' : item.stale ? 'Needs Refresh' : (item.status || 'Active');
    const badgeClass = !item.price_resolved ? 'estimated' : item.likely_sold ? 'critical' : (item.price_review ? 'tracked' : (item.stale ? 'estimated' : 'synced'));
    return `
      <div class="ea-post-card">
        <div class="ea-post-media">${item.image_url ? `<img src="${item.image_url}" alt="">` : ''}</div>
        <div class="ea-post-content">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div>
              <div class="ea-post-title">${item.title}</div>
              <div class="ea-post-sub">${item.subtitle || 'Tracked listing'}</div>
            </div>
            <span class="ea-pill ${badgeClass}">${badge}</span>
          </div>
          <div class="ea-post-price ${item.price_resolved ? '' : 'unresolved'}">${displayPrice(item)}</div>
          <div class="ea-post-kpis">
            <div class="ea-post-kpi"><span>Views</span><strong>${item.views}</strong></div>
            <div class="ea-post-kpi"><span>Messages</span><strong>${item.messages}</strong></div>
            <div class="ea-post-kpi"><span>Health</span><strong>${item.health_score || '—'}</strong></div>
          </div>
          <div class="ea-review-reason">${item.recommended_action}${item.pricing_insight ? `<br><br><em>${item.pricing_insight}</em>` : ''}</div>
          <div class="ea-post-actions">
            <button class="action-btn" type="button" data-ea-open="tools" data-ea-focus="listingSearchInput">Review</button>
            <button class="action-btn" type="button" data-ea-source="${item.source_url}">Open Source</button>
          </div>
        </div>
      </div>
    `;
  }

  function reviewItem(item, actionLabel){
    const badge = !item.price_resolved ? 'Price unresolved' : item.likely_sold ? 'Likely sold' : item.price_review ? 'Price review' : 'Stale / review';
    const badgeClass = !item.price_resolved ? 'estimated' : item.likely_sold ? 'critical' : (item.price_review ? 'tracked' : 'estimated');
    return `
      <div class="ea-review-item" data-review-item='${JSON.stringify({
        id:item.id, identity_key:item.identity_key, vin:item.vin, stock_number:item.stock_number, source_url:item.source_url, title:item.title
      }).replace(/'/g,"&#39;")}'>
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div>
            <strong>${item.title}</strong>
            <div class="ea-a-meta">${item.subtitle || 'Tracked listing'}</div>
          </div>
          <span class="ea-pill ${badgeClass}">${badge}</span>
        </div>
        <div class="ea-a-meta">Views ${item.views} · Messages ${item.messages} · Price ${displayPrice(item)}</div>
        <div class="ea-review-reason">${item.recommended_action}${item.pricing_insight ? `<br><br><em>${item.pricing_insight}</em>` : ''}</div>
        <div class="ea-post-actions">
          <button class="action-btn" type="button" data-ea-open="tools" data-ea-focus="listingSearchInput">${actionLabel}</button>
          <button class="action-btn" type="button" data-ea-source="${item.source_url}">Open Source</button>
        </div>
      </div>
    `;
  }

  function renderBlock(title, items){
    return `<div class="ea-analytics-card"><div class="stat-label">${title}</div><div class="ea-mini">${
      items.length ? items.slice(0,3).map(item => `${item.title || 'Listing'} · ${item.health_state || item.status || 'active'} · ${item.confidence || item.sync_confidence || 'local'}`).join('<br>')
      : 'No listings in this bucket yet.'
    }</div></div>`;
  }

  function bindButtons(root){
    root.querySelectorAll('[data-ea-open]').forEach((btn) => {
      if (btn.dataset.boundEaOpen === 'true') return;
      btn.dataset.boundEaOpen = 'true';
      btn.addEventListener('click', () => open(btn.getAttribute('data-ea-open'), btn.getAttribute('data-ea-focus')));
    });
    root.querySelectorAll('[data-ea-source]').forEach((btn) => {
      if (btn.dataset.boundEaSource === 'true') return;
      btn.dataset.boundEaSource = 'true';
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-ea-source');
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      });
    });
    root.querySelectorAll('[data-ea-tab]').forEach((btn) => {
      if (btn.dataset.boundEaTab === 'true') return;
      btn.dataset.boundEaTab = 'true';
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-ea-tab');
        root.querySelectorAll('[data-ea-tab]').forEach((node) => node.classList.toggle('active', node === btn));
        root.querySelectorAll('.ea-tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === target));
      });
    });
  }

  function render() {
    const section = document.getElementById('tools');
    if (!section || !NS.state) return;
    ensureStyle();

    const analytics = get('analytics', {}) || {};
    const tracking = analytics.tracking_summary || {};
    const sync = get('sync', {}) || {};
    const actions = Array.isArray(analytics.action_queue) ? analytics.action_queue : [];
    const listings = getListings();
    const lists = topLists(listings);

    let shell = document.getElementById('eaAnalyticsShell');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'eaAnalyticsShell';
      shell.className = 'ea-analytics-shell';
      section.prepend(shell);
    }

    let hero = document.getElementById('eaAnalyticsHero');
    if (!hero) { hero = document.createElement('div'); hero.id='eaAnalyticsHero'; hero.className='ea-analytics-hero'; shell.appendChild(hero); }
    hero.innerHTML = `<div class="ea-analytics-hero-grid">
      <div class="ea-analytics-card">
        <div class="g-eyebrow">Unified Sync</div>
        <h2 class="ea-a-title">Analytics now keeps both the portfolio view and the client-post workspace in one place.</h2>
        <div class="ea-a-copy">Bundle E adds explicit unresolved-price visibility and prepares persistent review actions so the operator can trust which rows are solid and which still need intervention.</div>
      </div>
      <div class="ea-analytics-card"><div class="stat-label">Sync Source</div><div class="stat-value" style="font-size:24px">${tracking.sync_source || sync.source || 'local_only'}</div><div class="stat-sub">Current ingestion owner.</div></div>
      <div class="ea-analytics-card"><div class="stat-label">Confidence</div><div class="stat-value" style="font-size:24px">${tracking.sync_confidence || sync.confidence || 'local'}</div><div class="stat-sub">Truth quality of this session.</div></div>
      <div class="ea-analytics-card"><div class="stat-label">Client Posts</div><div class="stat-value" style="font-size:24px">${listings.length}</div><div class="stat-sub">Listings visible in the analytics workspace.</div></div>
      <div class="ea-analytics-card"><div class="stat-label">Price Pending</div><div class="stat-value" style="font-size:24px">${listings.filter((x)=>!x.price_resolved).length}</div><div class="stat-sub">Rows with unresolved canonical price.</div></div>
    </div>`;

    let syncCard = document.getElementById('eaAnalyticsSync');
    if (!syncCard) { syncCard = document.createElement('div'); syncCard.id='eaAnalyticsSync'; syncCard.className='ea-analytics-card'; shell.appendChild(syncCard); }
    const confidenceClass = String(sync.confidence || '').toLowerCase().includes('sync') ? 'synced' : (String(sync.confidence || '').toLowerCase().includes('track') ? 'tracked' : 'estimated');
    syncCard.innerHTML = `<div class="section-head">
        <div>
          <div class="g-eyebrow">Sync Integrity</div>
          <h2 style="margin-top:6px;">Current truth state</h2>
          <div class="subtext">Use this as the trust layer for registry counts, lifecycle buckets, review pressure, and vehicle-level visibility.</div>
        </div>
        <div class="ea-tabbar">
          <button class="active" type="button" data-ea-tab="eaAnalyticsTabOverview">Analytics Overview</button>
          <button type="button" data-ea-tab="eaAnalyticsTabPosts">Client Posts</button>
          <button type="button" data-ea-tab="eaAnalyticsTabReview">Review Workspace</button>
        </div>
      </div>
      <div class="ea-sync-grid" style="margin-bottom:12px;">
        <div class="ea-analytics-card"><div class="stat-label">Last Ingest</div><div class="ea-mini">${sync.last_ingest_at || 'Not synced yet.'}</div></div>
        <div class="ea-analytics-card"><div class="stat-label">Last Reconcile</div><div class="ea-mini">${sync.last_reconcile_at || 'Not reconciled yet.'}</div></div>
        <div class="ea-analytics-card"><div class="stat-label">Issues</div><div class="ea-mini">${(sync.issues || []).length ? (sync.issues || []).join('<br>') : 'No active sync issues reported.'}</div></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span class="ea-pill ${confidenceClass}">${sync.confidence || 'local'}</span>
        <span class="ea-pill tracked">listing_seen: ${tracking.listing_seen_events || 0}</span>
        <span class="ea-pill tracked">view_update: ${tracking.view_update_events || 0}</span>
        <span class="ea-pill tracked">message_update: ${tracking.message_update_events || 0}</span>
        <span class="ea-pill tracked">price_changed: ${tracking.price_changed_events || 0}</span>
      </div>`;

    let tabs = document.getElementById('eaAnalyticsTabs');
    if (!tabs) { tabs = document.createElement('div'); tabs.id='eaAnalyticsTabs'; tabs.className='ea-analytics-card'; shell.appendChild(tabs); }
    tabs.innerHTML = `
      <div id="eaAnalyticsTabOverview" class="ea-tab-panel active">
        <div class="section-head">
          <div>
            <div class="g-eyebrow">Decision Queue</div>
            <h2 style="margin-top:6px;">Truth-aware analytics actions</h2>
            <div class="subtext">Recommendations distinguish synced history from local fallback and stay connected to actual client posts.</div>
          </div>
        </div>
        <div class="ea-a-list">
          ${actions.length ? actions.map((item, idx) => `
            <div class="ea-a-item">
              <div><strong>${idx + 1}. ${item.title}</strong><div class="ea-a-meta">${item.copy || ''}<br><br><em>${item.reason || ''}</em></div></div>
              <div style="display:grid;gap:10px;justify-items:end;">
                <span class="g-pill ${item.tone || 'growth'}">${item.tone === 'revenue' ? 'Revenue' : item.tone === 'cleanup' ? 'Cleanup' : 'Growth'}</span>
                <button class="action-btn" type="button" data-ea-open="${item.section || 'tools'}" data-ea-focus="${item.focus || ''}">Open</button>
              </div>
            </div>
          `).join('') : `<div class="ea-empty">No analytics actions yet.</div>`}
        </div>
        <div class="ea-sync-grid" style="margin-top:16px;">
          ${renderBlock('Message Leaders', analytics.leaders?.message_leaders || [])}
          ${renderBlock('View Leaders', analytics.leaders?.view_leaders || [])}
          ${renderBlock('Fresh Traction', analytics.leaders?.fresh_traction || [])}
          ${renderBlock('Price Attention', analytics.leaders?.price_attention || [])}
          ${renderBlock('Needs Refresh', analytics.leaders?.needs_refresh || [])}
          ${renderBlock('Recovered', analytics.leaders?.recovered || [])}
        </div>
      </div>

      <div id="eaAnalyticsTabPosts" class="ea-tab-panel">
        <div class="section-head">
          <div>
            <div class="g-eyebrow">Client Posts</div>
            <h2 style="margin-top:6px;">Vehicle-level post visibility inside analytics</h2>
            <div class="subtext">This gives the client a direct post/listing surface inside analytics instead of charts alone.</div>
          </div>
        </div>
        <div class="ea-post-grid">
          ${lists.posts.length ? lists.posts.map(postCard).join('') : `<div class="ea-empty">No client posts are available yet.</div>`}
        </div>
      </div>

      <div id="eaAnalyticsTabReview" class="ea-tab-panel">
        <div class="section-head">
          <div>
            <div class="g-eyebrow">Review Workspace</div>
            <h2 style="margin-top:6px;">Sold, stale, and price-watch review lanes</h2>
            <div class="subtext">Bundle E keeps these lanes visible while wiring durable review actions through the API layer.</div>
          </div>
        </div>
        <div class="ea-review-columns">
          <div class="ea-review-col">
            <div class="ea-review-col-head"><h3>Likely Sold / Stale</h3><span class="ea-pill critical">${lists.soldStale.length}</span></div>
            ${lists.soldStale.length ? lists.soldStale.map((item) => reviewItem(item, 'Review Status')).join('') : `<div class="ea-empty">No sold or stale items right now.</div>`}
          </div>
          <div class="ea-review-col">
            <div class="ea-review-col-head"><h3>Price Watch</h3><span class="ea-pill tracked">${lists.priceWatch.length}</span></div>
            ${lists.priceWatch.length ? lists.priceWatch.map((item) => reviewItem(item, 'Review Price')).join('') : `<div class="ea-empty">No price-watch items right now.</div>`}
          </div>
          <div class="ea-review-col">
            <div class="ea-review-col-head"><h3>Operator Notes</h3><span class="ea-pill estimated">Workspace</span></div>
            <div class="ea-review-item">
              <strong>Why this matters</strong>
              <div class="ea-review-reason">Unresolved price, stale items, and likely sold rows now live in the same operator review workspace. The next step is persisting those decisions cleanly.</div>
            </div>
            <div class="ea-review-item">
              <strong>Next hardening target</strong>
              <div class="ea-review-reason">Move these lanes into a more durable lifecycle state machine with explicit resolved outcomes, timestamps, and stronger persistence after refresh.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    bindButtons(shell);
  }

  NS.analytics = { renderBundleAAnalytics: render };
  NS.modules = NS.modules || {};
  NS.modules.analytics = true;

  const boot = () => { render(); setTimeout(render, 1200); setTimeout(render, 3200); };
  window.addEventListener('elevate:tracking-refreshed', () => render());
  window.addEventListener('elevate:sync-refreshed', () => render());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
