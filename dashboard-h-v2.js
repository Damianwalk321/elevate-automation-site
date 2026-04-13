
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.bundleH_v2) return;

  function role(){
    return (window.dashboardSummary?.manager_access) ? 'manager' : 'operator';
  }

  function mount(){
    let root = document.getElementById('eaRootH');
    if(!root){
      root = document.createElement('div');
      root.id = 'eaRootH';
      document.body.prepend(root);
    }
    return root;
  }

  function vehicleCard(v){
    return `
      <div class="ea-card">
        <img src="${v.image || ''}" class="ea-img"/>
        <div class="ea-body">
          <div class="ea-price">$${v.price || '-'}</div>
          <div class="ea-title">${v.title || 'Vehicle'}</div>
          <div class="ea-meta">
            <span>${v.views || 0} views</span>
            <span>${v.messages || 0} msgs</span>
          </div>
          <div class="ea-state ${v.state || 'active'}">${v.state || 'Active'}</div>
        </div>
      </div>
    `;
  }

  function operatorUI(){
    return `
      <div class="ea-layout">
        <div class="ea-left">
          <h2>Inventory</h2>
          <div id="vehicleGrid" class="ea-grid"></div>
        </div>
        <div class="ea-right">
          <h3>Review Queue</h3>
          <div id="reviewQueue"></div>
        </div>
      </div>
    `;
  }

  function styles(){
    return `
      <style>
        .ea-layout{display:grid;grid-template-columns:2fr 1fr;gap:20px;padding:20px;}
        .ea-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;}
        .ea-card{border-radius:10px;overflow:hidden;border:1px solid #ddd;background:#fff}
        .ea-img{width:100%;height:140px;object-fit:cover}
        .ea-body{padding:10px}
        .ea-price{font-weight:bold;font-size:18px}
        .ea-title{font-size:14px;margin:4px 0}
        .ea-meta{font-size:12px;display:flex;justify-content:space-between}
        .ea-state{margin-top:6px;font-size:11px;padding:2px 6px;border-radius:6px;display:inline-block}
      </style>
    `;
  }

  function render(){
    const root = mount();
    root.innerHTML = styles() + operatorUI();
  }

  NS.modules = NS.modules || {};
  NS.modules.bundleH_v2 = true;

  window.addEventListener('load', render);
})();
