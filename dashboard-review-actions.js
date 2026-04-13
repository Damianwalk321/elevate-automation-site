
(() => {
  if(window.__BUNDLE_G_REVIEW__) return;
  window.__BUNDLE_G_REVIEW__ = true;

  async function action(type, payload){
    await fetch('/api/review-listing-action',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:type,...payload})
    });
  }

  document.addEventListener('click', async (e)=>{
    const btn = e.target.closest('[data-g-action]');
    if(!btn) return;

    const type = btn.dataset.gAction;
    const id = btn.dataset.id;

    await action(type,{id});
  });
})();
