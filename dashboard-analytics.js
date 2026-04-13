
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.analyticsG) return;

  function role(){
    return (window.dashboardSummary?.manager_access) ? 'manager' : 'operator';
  }

  function mountRoot(){
    const tools = document.getElementById('tools');
    if(!tools) return null;
    let root = document.getElementById('eaRootG');
    if(!root){
      root = document.createElement('div');
      root.id = 'eaRootG';
      tools.prepend(root);
    }
    return root;
  }

  function operatorView(){
    return `
      <section>
        <h2>Operator Console</h2>
        <div id="eaKPIs"></div>
      </section>

      <section>
        <h3>Client Posts</h3>
        <div id="eaPosts"></div>
      </section>

      <section id="eaReview">
        <h3>Review Center</h3>
        <div id="eaReviewCols"></div>
      </section>
    `;
  }

  function managerView(){
    return `
      <section>
        <h2>Manager Console</h2>
        <div>Manager-only surface</div>
      </section>
    `;
  }

  function render(){
    const root = mountRoot();
    if(!root) return;

    if(role()==='operator'){
      root.innerHTML = operatorView();
    } else {
      root.innerHTML = managerView();
    }
  }

  NS.modules = NS.modules || {};
  NS.modules.analyticsG = true;

  window.addEventListener('load', render);
})();
