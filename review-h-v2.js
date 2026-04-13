
document.addEventListener('click', async (e)=>{
  const btn = e.target.closest('[data-action]');
  if(!btn) return;

  await fetch('/api/review-listing-action',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      action:btn.dataset.action,
      id:btn.dataset.id
    })
  });
});
