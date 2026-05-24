(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.sideNavRestore20260524) return;
  NS.modules = NS.modules || {};

  const navItems = [
    { id: 'overview', icon: '⌘', title: 'Command Centre', sub: 'Overview' },
    { id: 'extension', icon: '⌁', title: 'Execution Hub', sub: 'Vehicle Poster, execution' },
    { id: 'tools', icon: '▥', title: 'Intelligence Centre', sub: 'Listings, review, performance' },
    { id: 'compliance', icon: '◈', title: 'Compliance', sub: 'AB/BC readiness, disclosures' },
    { id: 'affiliate', icon: '∞', title: 'Partner Network', sub: 'Affiliates, referrals, growth' },
    { id: 'profile', icon: '⚙', title: 'Activation', sub: 'Profile, dealer, activation' },
    { id: 'billing', icon: '▭', title: 'Plan & Access', sub: 'Plan, access, usage' }
  ];

  const css = `
    .sidebar{width:286px!important;background:#0e0e0e!important;border-right:1px solid rgba(212,175,55,.12)!important;padding:20px 18px!important;gap:16px!important;overflow-y:auto!important}.ea-side-brand{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:start;padding:2px 0 18px;border-bottom:1px solid rgba(212,175,55,.12)}.ea-side-logo{width:44px;height:44px;border:1px solid rgba(212,175,55,.35);border-radius:15px;display:grid;place-items:center;color:#d4af37;background:rgba(212,175,55,.05);font-weight:900}.ea-side-eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#d4af37;font-weight:900}.ea-side-title{font-size:21px;line-height:1.08;font-weight:900;margin-top:4px}.ea-side-sub{font-size:13px;line-height:1.45;color:#aaa;margin-top:10px}.ea-operator-card{position:relative;padding:15px 16px;border-radius:17px;border:1px solid rgba(212,175,55,.14);background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006));display:grid;gap:6px}.ea-operator-card::after{content:'';position:absolute;right:14px;top:14px;width:10px;height:10px;border-radius:999px;background:#69d36f;box-shadow:0 0 14px rgba(105,211,111,.45)}.ea-operator-label{font-size:12px;color:#d4af37;text-transform:uppercase;letter-spacing:.15em;font-weight:900}.ea-operator-value{font-size:17px;font-weight:900}.ea-operator-sub{font-size:12px;color:#aaa;word-break:break-word}.sidebar-nav{gap:10px!important}.nav-btn.ea-nav-btn{display:grid!important;grid-template-columns:28px 1fr!important;gap:12px!important;align-items:center!important;padding:13px 15px!important;border-radius:17px!important;background:#121212!important;border:1px solid rgba(255,255,255,.065)!important;color:#f4f4f4!important;text-align:left!important;min-height:66px!important}.nav-btn.ea-nav-btn:hover{border-color:rgba(212,175,55,.28)!important;background:#171717!important}.nav-btn.ea-nav-btn.active{border-color:rgba(212,175,55,.62)!important;background:linear-gradient(135deg,rgba(212,175,55,.18),rgba(212,175,55,.055))!important}.ea-nav-icon{width:22px;color:#aaa;font-weight:900;text-align:center}.nav-btn.ea-nav-btn.active .ea-nav-icon{color:#d4af37}.ea-nav-title{font-size:15px;font-weight:900;line-height:1.1}.ea-nav-sub{display:block;margin-top:6px;color:#aaa;font-size:11.5px;line-height:1.2}.sidebar-actions{margin-top:auto!important;border:1px solid rgba(212,175,55,.12)!important;border-radius:17px!important;padding:14px!important;background:#141414!important}.sidebar-actions .btn-secondary{font-size:13px!important;padding:11px 12px!important}.sidebar-actions .btn-danger{font-size:13px!important;padding:11px 12px!important}
  `;

  function injectStyle() {
    let style = document.getElementById('ea-side-nav-restore-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ea-side-nav-restore-style';
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  function activeSection() {
    const visible = Array.from(document.querySelectorAll('.dashboard-section')).find((section) => {
      const style = window.getComputedStyle(section);
      return style.display !== 'none';
    });
    return visible?.id || 'overview';
  }

  function syncActive(id) {
    document.querySelectorAll('.sidebar .nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.section === id));
  }

  function show(id) {
    if (typeof window.showSection === 'function') window.showSection(id);
    else {
      document.querySelectorAll('.dashboard-section').forEach((section) => { section.style.display = section.id === id ? 'block' : 'none'; });
    }
    syncActive(id);
  }

  function restoreSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || sidebar.dataset.eaSideNavRestored === 'true') return;

    const email = document.querySelector('.user-email')?.textContent || 'Loading...';
    sidebar.innerHTML = `
      <div class="ea-side-brand">
        <div class="ea-side-logo">⌂</div>
        <div>
          <div class="ea-side-eyebrow">Elevate Automation</div>
          <div class="ea-side-title">Elevate Operator Console</div>
          <div class="ea-side-sub">Sales automation command center</div>
        </div>
      </div>
      <div class="ea-operator-card">
        <div class="ea-operator-label">Operator</div>
        <div class="ea-operator-value">Loading...</div>
        <div class="ea-operator-sub user-email">${email}</div>
      </div>
      <nav class="sidebar-nav">
        ${navItems.map((item) => `<button class="nav-btn ea-nav-btn" type="button" data-section="${item.id}"><span class="ea-nav-icon">${item.icon}</span><span><span class="ea-nav-title">${item.title}</span><span class="ea-nav-sub">${item.sub}</span></span></button>`).join('')}
      </nav>
      <div class="sidebar-actions">
        <button id="refreshAccessBtn" class="btn-secondary" type="button">Refresh Access</button>
        <button id="logoutBtn" class="btn-danger" type="button">Logout</button>
      </div>
    `;
    sidebar.dataset.eaSideNavRestored = 'true';
    sidebar.querySelectorAll('.nav-btn').forEach((btn) => btn.addEventListener('click', () => show(btn.dataset.section || 'overview')));
    sidebar.querySelector('#refreshAccessBtn')?.addEventListener('click', () => {
      if (typeof window.refreshDashboardData === 'function') window.refreshDashboardData();
      else window.location.reload();
    });
    sidebar.querySelector('#logoutBtn')?.addEventListener('click', async () => {
      try { await window.supabaseClient?.auth?.signOut?.(); } catch {}
      try { await window.supabase?.auth?.signOut?.(); } catch {}
      window.location.href = '/login.html';
    });
    syncActive(activeSection());
  }

  function boot() {
    injectStyle();
    restoreSidebar();
    setTimeout(() => syncActive(activeSection()), 500);
    setTimeout(() => syncActive(activeSection()), 1800);
  }

  NS.modules.sideNavRestore20260524 = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
