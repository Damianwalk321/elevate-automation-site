(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.analytics) return;

  const CSS = `
    :root{
      --ea-radius-xl:20px;
      --ea-radius-lg:16px;
      --ea-radius-md:12px;
      --ea-surface-0:#090909;
      --ea-surface-1:#101010;
      --ea-surface-2:#141414;
      --ea-surface-3:#181818;
      --ea-line-soft:rgba(212,175,55,.10);
      --ea-line-med:rgba(212,175,55,.18);
      --ea-line-strong:rgba(212,175,55,.28);
      --ea-text-0:#f5f5f5;
      --ea-text-1:#d7d7d7;
      --ea-text-2:#a7a7a7;
      --ea-gold:#d4af37;
      --ea-gold-soft:#f3ddb0;
      --ea-shadow-soft:0 16px 36px rgba(0,0,0,.30);
      --ea-shadow-card:0 20px 44px rgba(0,0,0,.36);
    }

    body{
      background:
        radial-gradient(circle at top right, rgba(212,175,55,.07), transparent 18%),
        linear-gradient(180deg,#090909 0%,#0c0c0c 100%);
    }

    .sidebar{
      background:
        linear-gradient(180deg, rgba(255,255,255,.015), rgba(255,255,255,0)),
        #0f0f0f !important;
      padding:22px 16px !important;
      gap:14px !important;
    }
    .brand-title{font-size:18px !important; line-height:1.12 !important;}
    .brand-subtitle{font-size:13px !important; color:var(--ea-text-2) !important; max-width:32ch;}
    .sidebar-card,.card,.mini-stat,.tool-tile,.listing-card,.command-side-card,.command-meta-card{
      border-radius:var(--ea-radius-xl) !important;
      border-color:var(--ea-line-soft) !important;
      box-shadow:var(--ea-shadow-soft);
    }
    .nav-btn,.action-btn,.btn-primary,.btn-secondary,.btn-danger{
      border-radius:14px !important;
      transition:transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;
    }
    .nav-btn:hover,.action-btn:hover,.btn-primary:hover,.btn-secondary:hover,.btn-danger:hover{ transform:translateY(-1px); }
    .nav-btn.active{
      border-color:var(--ea-line-strong) !important;
      background:
        linear-gradient(135deg, rgba(212,175,55,.18), rgba(212,175,55,.05)),
        #171717 !important;
    }

    .main{padding:24px 24px 40px !important;}
    .main-header{
      position:sticky; top:0; z-index:15;
      background:linear-gradient(180deg, rgba(10,10,10,.96), rgba(10,10,10,.82) 78%, rgba(10,10,10,0));
      backdrop-filter:blur(8px);
      padding-bottom:14px !important;
      margin-bottom:18px !important;
    }
    .main-header h1{font-size:28px !important; letter-spacing:-.02em;}
    .subtext{color:var(--ea-text-2) !important;}
    .module-group-label,.stat-label,.sidebar-card-label{font-size:11px !important; letter-spacing:.14em !important;}

    #overview .command-center-grid{gap:16px !important; margin-bottom:16px !important;}
    #overview .command-primary{
      padding:20px !important;
      background:
        radial-gradient(circle at top right, rgba(212,175,55,.12), transparent 24%),
        linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.01)),
        #141414 !important;
    }
    #overview .command-title-row h2{font-size:27px !important; line-height:1.04 !important; max-width:500px !important;}
    #overview .command-meta-card{
      padding:14px !important;
      background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.012)) !important;
    }
    #overview .command-meta-value{font-size:24px !important;}
    #overview .overview-chip{min-height:34px !important; font-size:12px !important;}
    #overview .overview-action-item{padding:13px 15px !important; border-radius:14px !important;}
    #overview .operator-strip{grid-template-columns:repeat(4,minmax(0,1fr)) !important; gap:12px !important; margin-bottom:16px !important;}
    #overview .mini-stat{min-height:116px !important; padding:16px !important;}
    #overview .mini-stat .stat-value{font-size:23px !important;}
    #overview .mini-stat .stat-sub{font-size:12px !important; line-height:1.4 !important;}
    #overview .listing-grid{gap:14px !important;}
    #overview .listing-card{
      background:
        linear-gradient(180deg, rgba(255,255,255,.018), rgba(255,255,255,.008)),
        #141414 !important;
      transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease;
    }
    #overview .listing-card:hover{
      transform:translateY(-2px);
      border-color:var(--ea-line-med) !important;
      box-shadow:var(--ea-shadow-card);
    }
    #overview .listing-media{height:180px !important;}
    #overview .listing-content{padding:14px !important; gap:10px !important;}
    #overview .listing-title{font-size:17px !important; line-height:1.28 !important;}
    #overview .listing-sub{font-size:12px !important;}
    #overview .listing-price{font-size:22px !important;}
    #overview .listing-specs,#overview .listing-metrics{grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:8px !important;}
    #overview .spec-chip,#overview .metric-pill{
      padding:8px 9px !important;
      border-radius:12px !important;
      background:rgba(255,255,255,.025) !important;
    }
    #overview .spec-chip-label,#overview .metric-pill-label{font-size:10px !important; letter-spacing:.10em !important;}
    #overview .spec-chip-value,#overview .metric-pill-value{font-size:12px !important;}
    #overview .listing-actions .action-btn{padding:11px 12px !important; font-size:12px !important;}
    #overview .listing-actions .action-btn:first-child{
      background:rgba(212,175,55,.15) !important;
      border-color:rgba(212,175,55,.28) !important;
      color:var(--ea-gold-soft) !important;
      font-weight:700 !important;
    }

    #extension .card,#tools .card,#affiliate .card,#billing .card,#compliance .card{
      background:linear-gradient(180deg, rgba(255,255,255,.016), rgba(255,255,255,.008)) !important;
    }

    .ea-hide{display:none !important;}
    .ea-remove{display:none !important;}
    .ea-quiet{opacity:.82;}
    .ea-collapsible{overflow:hidden; transition:max-height .18s ease, opacity .18s ease;}
    .ea-toggle{
      appearance:none; border:1px solid rgba(212,175,55,.18); background:#151515; color:#efefef;
      border-radius:999px; padding:10px 14px; cursor:pointer; font-weight:700; font-size:12px;
    }

    .ea-operator-shell{display:grid;gap:16px;margin-bottom:20px}
    .ea-analytics-card,.ea-analytics-hero{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .ea-analytics-hero-grid{display:grid;grid-template-columns:1.45fr repeat(4,minmax(0,1fr));gap:12px}
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
    .ea-pill.neutral{color:#d8d8d8;border-color:rgba(255,255,255,.12)}

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

    .ea-review-surface{display:grid;gap:16px;margin-bottom:20px}
    .ea-review-surface .ea-analytics-card{
      background:
        radial-gradient(circle at top right, rgba(212,175,55,.10), transparent 26%),
        linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006));
    }
    .ea-review-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
    .ea-review-kpi{background:#121212;border:1px solid rgba(212,175,55,.10);border-radius:14px;padding:14px}
    .ea-review-kpi strong{display:block;font-size:24px;line-height:1;margin-top:6px}
    .ea-review-kpi span{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#d4af37}
    .ea-review-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
    .ea-review-col{display:grid;gap:10px;align-content:start}
    .ea-review-col-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
    .ea-review-item{background:#151515;border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:14px;display:grid;gap:10px}
    .ea-review-reason{font-size:12px;line-height:1.5;color:#cfcfcf;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:10px;padding:10px}
    .ea-empty{padding:20px;border-radius:14px;border:1px dashed rgba(212,175,55,.16);color:#9d9d9d;text-align:center}

    @media (max-width:1200px){
      .ea-analytics-hero-grid,.ea-sync-grid,.ea-review-columns,.ea-review-kpis{grid-template-columns:1fr 1fr}
      .ea-post-grid{grid-template-columns:1fr 1fr}
    }
    @media (max-width:920px){
      .main-header{position:static;background:transparent;backdrop-filter:none}
    }
    @media (max-width:760px){
      .ea-analytics-hero-grid,.ea-sync-grid,.ea-review-columns,.ea-post-grid,.ea-post-kpis,.ea-post-actions,.ea-review-kpis{grid-template-columns:1fr}
      .ea-a-title{font-size:24px}
    }
  `;

  function ensureStyle(){
    if(document.getElementById('ea-analytics-bundle-f-style')) return;
    const s=document.createElement('style');
    s.id='ea-analytics-bundle-f-style';
    s.textContent=CSS;
    document.head.appendChild(s);
  }

  function get(path, fallback){ return NS.state?.get?.(path, fallback); }
  function num(value){ const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
  function clean(value){ return String(value || '').replace(/\s+/g,' ').trim(); }
  function displayPrice(item){
    if (item.display_price_text) return item.display_price_text;
    const value = num(item.price);
    return value ? `$${value.toLocaleString()}` : 'Price pending';
  }
  function open(section, focusId){
    try{ if(typeof window.showSection==='function') window.showSection(section); }catch{}
    if(focusId) setTimeout(()=>document.getElementById(focusId)?.scrollIntoView({behavior:'smooth', block:'center'}),220);
  }
  function isManagerView(){
    return Boolean(window.dashboardSummary?.manager_access);
  }
  function setText(selector, value){
    const el = document.querySelector(selector);
    if (el && value) el.textContent = value;
  }

  function compressGlobalCopy(){
    setText('.brand-subtitle', 'Premium posting, review, analytics, and compliance control.');
    setText('#dashboardPageTitle', 'Operator Console');
    setText('#welcomeText', 'Your posts, review queue, and next actions.');
    setText('#commandCenterSubtext', 'Focus on the next highest-value move.');
    setText('#overviewBlockers', 'Review the queue, clear blockers, and move the next listing.');
    setText('#listingDataStatus', 'Client posts and review-ready rows.');
    setText('#listingGridStatus', 'Filter by status and work the next listing.');
    setText('#commandSetupSummary', 'Complete the essentials required to post cleanly.');
    setText('#setupReadinessSummary', 'Complete the essentials required to post cleanly.');
    setText('#toolsNextStepPanel', 'Keep setup clean, then post.');
    setText('#snapshotSetupSummary', 'Account, setup, and compliance should stay complete.');
    setText('#overviewPlanChip', 'Plan');
    setText('#overviewAccessChip', 'Access');
    setText('#commandSetupChip', 'Setup');

    document.querySelectorAll('.section-head .subtext, .card > p, .tool-tile p, .stat-sub').forEach((el) => {
      const t = clean(el.textContent);
      if (!t) return;
      if (t.length > 75) el.textContent = `${t.slice(0, 69).trim()}…`;
    });

    const buttonMap = new Map([
      ['Open Tools', 'Tools'],
      ['Open Analytics', 'Analytics'],
      ['Review Listings', 'Review'],
      ['Finish Setup', 'Setup'],
      ['Refresh Listings', 'Refresh'],
      ['Open Review Center', 'Review Center'],
      ['Open Overview Grid', 'Overview'],
      ['Back to Client Posts', 'Client Posts'],
      ['View Upgrade Path', 'Upgrade'],
      ['See Upgrade Levers', 'Upgrade'],
      ['Use Credits', 'Credits'],
      ['Compare Access', 'Compare'],
      ['Open Billing Portal', 'Billing Portal'],
      ['View Setup Steps', 'Setup Steps'],
      ['Refresh Extension State', 'Refresh State']
    ]);
    document.querySelectorAll('button, a').forEach((el) => {
      const t = clean(el.textContent);
      if (buttonMap.has(t)) el.textContent = buttonMap.get(t);
    });
  }

  function createReviewNavIfMissing(){
    if (document.querySelector('.sidebar-nav [data-section="review_center"]')) return;
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;

    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.type = 'button';
    btn.dataset.section = 'review_center';
    btn.textContent = 'Review Center';

    const toolsBtn = nav.querySelector('[data-section="tools"]');
    if (toolsBtn) toolsBtn.insertAdjacentElement('afterend', btn);
    else nav.appendChild(btn);

    btn.addEventListener('click', () => {
      open('tools');
      setTimeout(() => {
        document.getElementById('eaReviewSurface')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 180);
    });
  }

  function hardSplitOperatorSurface(){
    if (isManagerView()) return;

    // absolute removal of manager/dealership leakage
    const leakagePatterns = [
      /manager oversight/i,
      /primary dealership/i,
      /dealership health/i,
      /team command/i,
      /manager summary/i,
      /primary dealership team/i
    ];

    document.querySelectorAll('.card, .sidebar-card, .tool-tile, .mini-stat, .list-block, .status-line').forEach((node) => {
      const text = clean(node.textContent || '');
      if (leakagePatterns.some((p) => p.test(text))) node.classList.add('ea-remove');
    });
    document.querySelectorAll('[id*="manager"], [class*="manager"], [data-role="manager"]').forEach((el) => el.classList.add('ea-remove'));

    // keep only 4 core operator stats
    const operatorStrip = document.getElementById('overviewOperatorStrip');
    if (operatorStrip) {
      Array.from(operatorStrip.children || []).forEach((node, idx) => {
        if (idx > 3) node.classList.add('ea-remove');
      });
    }

    // remove extra overview/admin surfaces
    [
      '#overviewUpgradeCard',
      '#overviewPriorityGrid',
      '#overviewAccountGrid .card:first-child',
      '#revenueIntelligencePanel'
    ].forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => el.classList.add('ea-remove'));
    });

    // make account details quiet/collapsed
    const accountGrid = document.getElementById('overviewAccountGrid');
    if (accountGrid && !document.getElementById('eaDetailsToggleF')) {
      const head = document.createElement('div');
      head.style.display = 'flex';
      head.style.justifyContent = 'space-between';
      head.style.alignItems = 'center';
      head.style.gap = '12px';
      head.style.marginBottom = '12px';
      head.innerHTML = `<div class="subtext">Secondary account details</div><button id="eaDetailsToggleF" class="ea-toggle" type="button">Show details</button>`;
      accountGrid.parentNode.insertBefore(head, accountGrid);
      accountGrid.classList.add('ea-collapsible', 'ea-hide');

      const btn = head.querySelector('#eaDetailsToggleF');
      btn.addEventListener('click', () => {
        const hidden = accountGrid.classList.toggle('ea-hide');
        btn.textContent = hidden ? 'Show details' : 'Hide details';
      });
    }

    // tools/admin wording cleanup
    document.querySelectorAll('#extension .card h2, #extension .card .subtext, #tools .card h2, #tools .card .subtext').forEach((node) => {
      let text = clean(node.textContent || '');
      text = text
        .replace(/system status/gi, 'Status')
        .replace(/platform modules/gi, 'Tools')
        .replace(/module state/gi, 'Tool state')
        .replace(/operator workspace/gi, 'Workspace');
      node.textContent = text;
    });
  }

  function applyOperatorShell(){
    if (document.body.dataset.eaOperatorShellF === 'true') return;
    ensureStyle();
    compressGlobalCopy();
    createReviewNavIfMissing();
    hardSplitOperatorSurface();
    document.body.dataset.eaOperatorShellF = 'true';
  }

  function getListings(){
    const summaryRows = Array.isArray(window.dashboardSummary?.recent_listings) ? window.dashboardSummary.recent_listings : [];
    const registryRows = Object.values(get('listingRegistry', {}) || {});
    const sourceRows = registryRows.length ? registryRows : summaryRows;
    return sourceRows.map((row) => {
      const views = num(row.views_count ?? row.views);
      const messages = num(row.messages_count ?? row.messages);
      const price = num(row.price);
      const lifecycle = clean(row.lifecycle_status || row.review_bucket || '');
      const recommended = clean(row.recommended_action || '');
      const likelySold = Boolean(row.likely_sold) || /review_delete|removedvehicles/i.test(lifecycle);
      const stale = Boolean(row.weak) || /stale/i.test(clean(row.status || lifecycle));
      const priceReview = /price/i.test(lifecycle) || /price/i.test(recommended) || !Boolean(row.price_resolved ?? true);

      let stateLabel = 'Active';
      if (!row.price_resolved) stateLabel = 'Price Pending';
      else if (likelySold) stateLabel = 'Likely Sold';
      else if (priceReview) stateLabel = 'Price Watch';
      else if (stale) stateLabel = 'Needs Refresh';

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
        health_score: num(row.health_score ?? row.predicted_score),
        opportunity_score: num(row.opportunity_score),
        price_review_priority: num(row.price_review_priority),
        refresh_priority: num(row.refresh_priority),
        recommended_action: recommended || 'Review',
        pricing_insight: clean(row.pricing_insight || ''),
        lifecycle_status: lifecycle,
        status: clean(row.status || 'active'),
        state_label: stateLabel,
        source_url: clean(row.source_url || ''),
        likely_sold: likelySold,
        stale,
        price_review: priceReview,
        action_bucket: clean(row.action_bucket || ''),
        posted_at: row.posted_at || row.updated_at || '',
        vin: clean(row.vin || ''),
        stock_number: clean(row.stock_number || '')
      };
    });
  }

  function topLists(listings){
    const byOpportunity = [...listings].sort((a,b) => (b.opportunity_score - a.opportunity_score) || (b.messages - a.messages) || (b.views - a.views));
    const needsAttention = listings
      .filter((x) => !x.price_resolved || x.price_review || x.stale || x.likely_sold)
      .sort((a,b) => (Number(!a.price_resolved) - Number(!b.price_resolved)) || (b.price_review_priority - a.price_review_priority));

    return {
      posts: byOpportunity.slice(0, 12),
      soldStale: listings.filter((x) => x.likely_sold || x.stale).sort((a,b) => (Number(b.likely_sold) - Number(a.likely_sold)) || (b.refresh_priority - a.refresh_priority)).slice(0, 12),
      priceWatch: listings.filter((x) => x.price_review).sort((a,b) => (b.price_review_priority - a.price_review_priority) || (b.views - a.views)).slice(0, 12),
      needsAttention: needsAttention.slice(0, 12),
      healthy: listings.filter((x) => !x.likely_sold && !x.stale && !x.price_review && x.price_resolved).sort((a,b) => (b.messages - a.messages) || (b.views - a.views)).slice(0, 12)
    };
  }

  function postCard(item){
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
            <span class="ea-pill ${badgeClass}">${item.state_label}</span>
          </div>
          <div class="ea-post-price ${item.price_resolved ? '' : 'unresolved'}">${displayPrice(item)}</div>
          <div class="ea-post-kpis">
            <div class="ea-post-kpi"><span>Views</span><strong>${item.views}</strong></div>
            <div class="ea-post-kpi"><span>Messages</span><strong>${item.messages}</strong></div>
            <div class="ea-post-kpi"><span>State</span><strong>${item.state_label}</strong></div>
          </div>
          <div class="ea-review-reason">${item.recommended_action}${item.pricing_insight ? `<br><br><em>${item.pricing_insight}</em>` : ''}</div>
          <div class="ea-post-actions">
            <button class="action-btn" type="button" data-ea-scroll-review="true">Review</button>
            <button class="action-btn" type="button" data-ea-source="${item.source_url}">Open Source</button>
          </div>
        </div>
      </div>
    `;
  }

  function reviewItem(item, actionLabel){
    const badgeClass = !item.price_resolved ? 'estimated' : item.likely_sold ? 'critical' : (item.price_review ? 'tracked' : 'estimated');
    const encoded = JSON.stringify({
      id:item.id,
      identity_key:item.identity_key,
      vin:item.vin,
      stock_number:item.stock_number,
      source_url:item.source_url,
      title:item.title,
      price:item.price
    }).replace(/'/g,"&#39;");
    return `
      <div class="ea-review-item" data-review-item='${encoded}'>
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div>
            <strong>${item.title}</strong>
            <div class="ea-a-meta">${item.subtitle || 'Tracked listing'}</div>
          </div>
          <span class="ea-pill ${badgeClass}">${item.state_label}</span>
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
      items.length ? items.slice(0,3).map(item => `${item.title || 'Listing'} · ${item.state_label || item.status || 'active'}`).join('<br>')
      : 'No listings in this lane yet.'
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
    root.querySelectorAll('[data-ea-scroll-review]').forEach((btn) => {
      if (btn.dataset.boundEaScrollReview === 'true') return;
      btn.dataset.boundEaScrollReview = 'true';
      btn.addEventListener('click', () => {
        document.getElementById('eaReviewSurface')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function renderOperatorSurface(section, listings, lists, analytics, tracking, sync){
    let shell = document.getElementById('eaOperatorShell');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'eaOperatorShell';
      shell.className = 'ea-operator-shell';
      section.prepend(shell);
    }

    const actions = Array.isArray(analytics.action_queue) ? analytics.action_queue : [];

    shell.innerHTML = `
      <div class="ea-analytics-hero">
        <div class="ea-analytics-hero-grid">
          <div class="ea-analytics-card">
            <div class="module-group-label">Operator View</div>
            <h2 class="ea-a-title">Your posts, your review queue, and the next actions — without manager or dealership noise.</h2>
            <div class="ea-a-copy">Bundle F treats the operator view as its own render shape instead of cleaning a mixed surface after the fact.</div>
          </div>
          <div class="ea-analytics-card"><div class="stat-label">Client Posts</div><div class="stat-value" style="font-size:24px">${listings.length}</div><div class="stat-sub">Visible now</div></div>
          <div class="ea-analytics-card"><div class="stat-label">Review Queue</div><div class="stat-value" style="font-size:24px">${lists.needsAttention.length}</div><div class="stat-sub">Needs action</div></div>
          <div class="ea-analytics-card"><div class="stat-label">Price Watch</div><div class="stat-value" style="font-size:24px">${lists.priceWatch.length}</div><div class="stat-sub">Review price</div></div>
          <div class="ea-analytics-card"><div class="stat-label">Sync</div><div class="stat-value" style="font-size:24px">${tracking.sync_confidence || sync.confidence || 'local'}</div><div class="stat-sub">Current truth level</div></div>
        </div>
      </div>

      <div class="ea-analytics-card">
        <div class="section-head">
          <div>
            <div class="module-group-label">Client Posts</div>
            <h2 style="margin-top:6px;">Vehicle cards first</h2>
            <div class="subtext">The fastest way to scan what is live and what needs review.</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="action-btn" type="button" data-ea-scroll-review="true">Review Center</button>
            <button class="action-btn" type="button" data-ea-open="overview" data-ea-focus="listingSearchInput">Overview</button>
          </div>
        </div>
        <div class="ea-post-grid">
          ${lists.posts.length ? lists.posts.map(postCard).join('') : `<div class="ea-empty">No client posts are available yet.</div>`}
        </div>
      </div>

      <div id="eaReviewSurface" class="ea-review-surface">
        <div class="ea-analytics-card">
          <div class="section-head">
            <div>
              <div class="module-group-label">Review Center</div>
              <h2 style="margin-top:6px;">Dedicated review surface</h2>
              <div class="subtext">Make the decision, persist it, move on.</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="action-btn" type="button" data-ea-open="overview" data-ea-focus="listingSearchInput">Overview</button>
              <button class="action-btn" type="button" data-ea-open="tools" data-ea-focus="">Top</button>
            </div>
          </div>
          <div class="ea-review-kpis">
            <div class="ea-review-kpi"><span>Needs Action</span><strong>${lists.needsAttention.length}</strong></div>
            <div class="ea-review-kpi"><span>Price Watch</span><strong>${lists.priceWatch.length}</strong></div>
            <div class="ea-review-kpi"><span>Sold / Stale</span><strong>${lists.soldStale.length}</strong></div>
            <div class="ea-review-kpi"><span>Healthy</span><strong>${lists.healthy.length}</strong></div>
          </div>
          <div class="ea-review-columns">
            <div class="ea-review-col">
              <div class="ea-review-col-head"><h3>Needs Action</h3><span class="ea-pill neutral">${lists.needsAttention.length}</span></div>
              ${lists.needsAttention.length ? lists.needsAttention.map((item) => reviewItem(item, 'Review')).join('') : `<div class="ea-empty">No needs-action items right now.</div>`}
            </div>
            <div class="ea-review-col">
              <div class="ea-review-col-head"><h3>Price Watch</h3><span class="ea-pill tracked">${lists.priceWatch.length}</span></div>
              ${lists.priceWatch.length ? lists.priceWatch.map((item) => reviewItem(item, 'Price')).join('') : `<div class="ea-empty">No price-watch items right now.</div>`}
            </div>
            <div class="ea-review-col">
              <div class="ea-review-col-head"><h3>Sold / Stale</h3><span class="ea-pill critical">${lists.soldStale.length}</span></div>
              ${lists.soldStale.length ? lists.soldStale.map((item) => reviewItem(item, 'Status')).join('') : `<div class="ea-empty">No sold or stale items right now.</div>`}
            </div>
          </div>
        </div>
      </div>

      <div class="ea-analytics-card">
        <div class="section-head">
          <div>
            <div class="module-group-label">Analytics</div>
            <h2 style="margin-top:6px;">Signals worth acting on</h2>
            <div class="subtext">Only the higher-signal blocks stay visible here.</div>
          </div>
        </div>
        <div class="ea-a-list">
          ${actions.length ? actions.slice(0,4).map((item, idx) => `
            <div class="ea-a-item">
              <div><strong>${idx + 1}. ${item.title}</strong><div class="ea-a-meta">${item.copy || ''}</div></div>
              <div style="display:grid;gap:10px;justify-items:end;">
                <span class="ea-pill ${item.tone === 'revenue' ? 'critical' : item.tone === 'cleanup' ? 'estimated' : 'tracked'}">${item.tone === 'revenue' ? 'Revenue' : item.tone === 'cleanup' ? 'Fix' : 'Growth'}</span>
                <button class="action-btn" type="button" data-ea-open="${item.section || 'tools'}" data-ea-focus="${item.focus || ''}">Open</button>
              </div>
            </div>
          `).join('') : `<div class="ea-empty">No analytics actions yet.</div>`}
        </div>
        <div class="ea-sync-grid" style="margin-top:16px;">
          ${renderBlock('Fresh traction', analytics.leaders?.fresh_traction || [])}
          ${renderBlock('Price attention', analytics.leaders?.price_attention || [])}
          ${renderBlock('Needs refresh', analytics.leaders?.needs_refresh || [])}
        </div>
      </div>
    `;
    bindButtons(shell);
  }

  function renderManagerSurface(section, listings, lists, analytics, tracking, sync){
    // Minimal fallback to preserve functionality if a manager account appears.
    let shell = document.getElementById('eaOperatorShell');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'eaOperatorShell';
      shell.className = 'ea-operator-shell';
      section.prepend(shell);
    }
    shell.innerHTML = `
      <div class="ea-analytics-hero">
        <div class="ea-analytics-hero-grid">
          <div class="ea-analytics-card">
            <div class="module-group-label">Manager View</div>
            <h2 class="ea-a-title">Manager workspace stays separate from the operator-focused surface.</h2>
            <div class="ea-a-copy">Bundle F preserves a lightweight manager fallback while prioritizing the operator render path.</div>
          </div>
          <div class="ea-analytics-card"><div class="stat-label">Tracked Listings</div><div class="stat-value" style="font-size:24px">${listings.length}</div><div class="stat-sub">Visible now</div></div>
          <div class="ea-analytics-card"><div class="stat-label">Review Queue</div><div class="stat-value" style="font-size:24px">${lists.needsAttention.length}</div><div class="stat-sub">Needs action</div></div>
          <div class="ea-analytics-card"><div class="stat-label">Sync</div><div class="stat-value" style="font-size:24px">${tracking.sync_confidence || sync.confidence || 'local'}</div><div class="stat-sub">Current truth level</div></div>
          <div class="ea-analytics-card"><div class="stat-label">Insights</div><div class="stat-value" style="font-size:24px">${(analytics.action_queue || []).length}</div><div class="stat-sub">Action items</div></div>
        </div>
      </div>
    `;
  }

  function render() {
    const section = document.getElementById('tools');
    if (!section || !NS.state) return;

    applyOperatorShell();

    const analytics = get('analytics', {}) || {};
    const tracking = analytics.tracking_summary || {};
    const sync = get('sync', {}) || {};
    const listings = getListings();
    const lists = topLists(listings);

    if (isManagerView()) renderManagerSurface(section, listings, lists, analytics, tracking, sync);
    else renderOperatorSurface(section, listings, lists, analytics, tracking, sync);

    applyOperatorShell();
  }

  NS.analytics = { renderBundleFAnalytics: render, applyOperatorShell };
  NS.modules = NS.modules || {};
  NS.modules.analytics = true;

  const boot = () => { render(); setTimeout(render, 1200); setTimeout(render, 3200); };
  window.addEventListener('elevate:tracking-refreshed', () => render());
  window.addEventListener('elevate:sync-refreshed', () => render());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
