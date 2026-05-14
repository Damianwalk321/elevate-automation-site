(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.analyticsG) return;

  const CSS = `
    .ea-analytics-shell{display:grid;gap:18px}
    .ea-analytics-toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}
    .ea-analytics-segment{display:inline-flex;gap:8px;background:#111;border:1px solid rgba(212,175,55,.12);border-radius:999px;padding:6px}
    .ea-analytics-segment button{appearance:none;border:none;background:transparent;color:#d8d8d8;padding:10px 14px;border-radius:999px;cursor:pointer;font-weight:700;font-size:13px}
    .ea-analytics-segment button.active{background:rgba(212,175,55,.15);color:#f3ddb0}
    .ea-analytics-pane{display:grid;gap:18px}
    .ea-analytics-pane.hidden{display:none !important}
    .ea-analytics-listing-toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
    .ea-analytics-listing-toolbar .toolbar{margin:0}
    .ea-analytics-note{padding:14px 16px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05);color:#d1d1d1;line-height:1.55}
    .ea-review-single-card{padding:0!important;background:transparent!important;border:none!important;box-shadow:none!important}
  `;

  function injectStyle(){
    if (document.getElementById('ea-analytics-workspace-style')) return;
    const style = document.createElement('style');
    style.id = 'ea-analytics-workspace-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function role(){ return (window.dashboardSummary?.manager_access) ? 'manager' : 'operator'; }

  function ensureAnalyticsSection(){
    const mainInner = document.querySelector('.main-inner');
    if (!mainInner) return null;
    let analyticsSection = document.getElementById('analytics');
    if (!analyticsSection) {
      analyticsSection = document.createElement('section');
      analyticsSection.id = 'analytics';
      analyticsSection.className = 'dashboard-section';
      mainInner.appendChild(analyticsSection);
    }
    return analyticsSection;
  }

  function mountRoot(){
    const analyticsSection = ensureAnalyticsSection();
    if(!analyticsSection) return null;
    let root = document.getElementById('eaRootG');
    if(!root){
      root = document.createElement('div');
      root.id = 'eaRootG';
      analyticsSection.appendChild(root);
    } else if (!analyticsSection.contains(root)) {
      analyticsSection.appendChild(root);
    }
    return root;
  }

  function operatorView(){
    return `
      <section id="analyticsWorkspace" class="card ea-analytics-shell">
        <div class="ea-analytics-toolbar">
          <div>
            <div class="module-group-label">Analytics Workspace</div>
            <h2 style="margin-top:6px;">Intelligence Centre</h2>
            <div class="subtext">Performance, active listings, and operator review are consolidated into one operating area.</div>
          </div>
          <div class="ea-analytics-segment" id="analyticsSegmentControl">
            <button type="button" data-pane="performance" class="active">Performance</button>
            <button type="button" data-pane="listings">Listings</button>
            <button type="button" data-pane="review">Review</button>
          </div>
        </div>

        <div id="analyticsPanePerformance" class="ea-analytics-pane">
          <div class="ea-analytics-note">Performance intelligence will sit here next: active listing trend, posts by day, review pressure, and data-quality signals from Supabase truth.</div>
        </div>

        <div id="analyticsPaneListings" class="ea-analytics-pane hidden">
          <div class="card">
            <div class="ea-analytics-listing-toolbar">
              <div>
                <h3>Active vehicle listings</h3>
                <div id="analyticsListingsStatus" class="subtext">Active portfolio rows only. Review/stale rows live in Review.</div>
              </div>
              <div class="toolbar" style="gap:12px; flex-wrap:wrap;">
                <div id="analyticsListingQuickFilters" style="display:flex; gap:8px; flex-wrap:wrap;">
                  <button class="action-btn active" type="button" data-filter="all">All</button>
                  <button class="action-btn" type="button" data-filter="active">Active</button>
                  <button class="action-btn" type="button" data-filter="review">Review</button>
                  <button class="action-btn" type="button" data-filter="weak">Weak</button>
                  <button class="action-btn" type="button" data-filter="needs_action">Needs Action</button>
                  <button class="action-btn" type="button" data-filter="likely_sold">Inventory Missing</button>
                </div>
                <select id="analyticsListingSortSelect">
                  <option value="popular">Sort: Most Popular</option>
                  <option value="newest">Sort: Newest</option>
                  <option value="price_high">Sort: Price High → Low</option>
                  <option value="price_low">Sort: Price Low → High</option>
                </select>
                <input id="analyticsListingSearchInput" type="text" placeholder="Search make, model, VIN, stock..." />
              </div>
            </div>
            <div id="analyticsListingsGrid"><div class="listing-empty">No portfolio rows loaded yet.</div></div>
            <div id="analyticsListingsGridStatus" class="status-line"></div>
          </div>
        </div>

        <div id="analyticsPaneReview" class="ea-analytics-pane hidden">
          <div class="ea-review-single-card">
            <div id="analyticsReviewQueue"><div class="listing-empty">No review items yet.</div></div>
          </div>
          <div id="analyticsNeedsActionQueue" style="display:none"></div>
          <div id="analyticsPriceWatchQueue" style="display:none"></div>
        </div>
      </section>
    `;
  }

  function managerView(){
    return `
      <section id="analyticsWorkspace" class="card ea-analytics-shell">
        <div class="module-group-label">Manager Console</div>
        <h2 style="margin-top:6px;">Analytics workspace</h2>
        <div class="ea-analytics-note">Manager-specific analytics can be layered here later. The operator workspace is now the primary listings and review surface.</div>
      </section>
    `;
  }

  function bindSegment(){
    const control = document.getElementById('analyticsSegmentControl');
    if (!control || control.dataset.bound === 'true') return;
    control.dataset.bound = 'true';
    const panes = {
      performance: document.getElementById('analyticsPanePerformance'),
      listings: document.getElementById('analyticsPaneListings'),
      review: document.getElementById('analyticsPaneReview')
    };
    const buttons = Array.from(control.querySelectorAll('button'));
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const pane = button.getAttribute('data-pane') || 'performance';
        buttons.forEach((btn) => btn.classList.toggle('active', btn === button));
        Object.values(panes).forEach((node) => node?.classList.add('hidden'));
        panes[pane]?.classList.remove('hidden');
      });
    });
  }

  function render(){
    const root = mountRoot();
    if(!root) return;
    injectStyle();
    root.innerHTML = role() === 'operator' ? operatorView() : managerView();
    bindSegment();
    window.dispatchEvent(new CustomEvent('elevate:analytics-workspace-mounted'));
  }

  NS.modules = NS.modules || {};
  NS.modules.analyticsG = true;
  NS.analyticsWorkspace = { render };

  window.addEventListener('load', render);
  window.addEventListener('elevate:tracking-refreshed', render);
})();