(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  NS.modules = NS.modules || {};
  const VERSION = 'side-nav-restore-20260524h';

  const navItems = [
    { id: 'overview', icon: '⌘', title: 'Command Centre', sub: 'Overview' },
    { id: 'extension', icon: '⌁', title: 'Execution Hub', sub: 'Vehicle Poster, execution' },
    { id: 'tools', icon: '▥', title: 'Intelligence Centre', sub: 'Listings, review, performance' },
    { id: 'compliance', icon: '◈', title: 'Compliance', sub: 'AB/BC readiness, disclosures' },
    { id: 'affiliate', icon: '∞', title: 'Partner Network', sub: 'Affiliates, referrals, growth' },
    { id: 'profile', icon: '⚙', title: 'Activation', sub: 'Profile, dealer, activation' },
    { id: 'billing', icon: '▭', title: 'Plan & Access', sub: 'Plan, access, usage' }
  ];

  const css = `.sidebar{width:286px!important;background:#0e0e0e!important;border-right:1px solid rgba(212,175,55,.12)!important;padding:20px 18px!important;gap:16px!important;overflow-y:auto!important}.ea-side-brand{display:grid!important;grid-template-columns:44px 1fr!important;gap:12px!important;align-items:start!important;padding:2px 0 18px!important;border-bottom:1px solid rgba(212,175,55,.12)!important}.ea-side-logo{width:44px!important;height:44px!important;border:1px solid rgba(212,175,55,.35)!important;border-radius:15px!important;display:grid!important;place-items:center!important;color:#d4af37!important;background:rgba(212,175,55,.05)!important;font-weight:900!important}.ea-side-eyebrow{font-size:12px!important;letter-spacing:.18em!important;text-transform:uppercase!important;color:#d4af37!important;font-weight:900!important}.ea-side-title{font-size:21px!important;line-height:1.08!important;font-weight:900!important;margin-top:4px!important}.ea-side-sub{font-size:13px!important;line-height:1.45!important;color:#aaa!important;margin-top:10px!important}.ea-operator-card{position:relative!important;padding:15px 16px!important;border-radius:17px!important;border:1px solid rgba(212,175,55,.14)!important;background:#141414!important;display:grid!important;gap:6px!important}.ea-operator-card::after{content:''!important;position:absolute!important;right:14px!important;top:14px!important;width:10px!important;height:10px!important;border-radius:999px!important;background:#69d36f!important}.ea-operator-label{font-size:12px!important;color:#d4af37!important;text-transform:uppercase!important;letter-spacing:.15em!important;font-weight:900!important}.ea-operator-value{font-size:17px!important;font-weight:900!important}.ea-operator-sub{font-size:12px!important;color:#aaa!important;word-break:break-word!important}.sidebar-nav{display:flex!important;flex-direction:column!important;gap:10px!important}.nav-btn.ea-nav-btn{display:grid!important;grid-template-columns:28px 1fr!important;gap:12px!important;align-items:center!important;padding:13px 15px!important;border-radius:17px!important;background:#121212!important;border:1px solid rgba(255,255,255,.065)!important;color:#f4f4f4!important;text-align:left!important;min-height:66px!important;width:100%!important;cursor:pointer!important}.nav-btn.ea-nav-btn.active{border-color:rgba(212,175,55,.62)!important;background:linear-gradient(135deg,rgba(212,175,55,.18),rgba(212,175,55,.055))!important}.ea-nav-icon{width:22px!important;color:#aaa!important;font-weight:900!important;text-align:center!important}.nav-btn.ea-nav-btn.active .ea-nav-icon{color:#d4af37!important}.ea-nav-title{font-size:15px!important;font-weight:900!important;line-height:1.1!important}.ea-nav-sub{display:block!important;margin-top:6px!important;color:#aaa!important;font-size:11.5px!important;line-height:1.2!important}.sidebar-actions{margin-top:auto!important;border:1px solid rgba(212,175,55,.12)!important;border-radius:17px!important;padding:14px!important;background:#141414!important}.sidebar-actions .btn-secondary,.sidebar-actions .btn-danger{font-size:13px!important;padding:11px 12px!important;width:100%!important}`;

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
    const visible = Array.from(document.querySelectorAll('.dashboard-section')).find((section) => window.getComputedStyle(section).display !== 'none');
    return visible?.id || 'overview';
  }

  function syncActive(id) {
    document.querySelectorAll('.sidebar .nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.section === id));
  }

  function show(id) {
    if (typeof window.showSection === 'function') window.showSection(id);
    else document.querySelectorAll('.dashboard-section').forEach((section) => { section.style.display = section.id === id ? 'block' : 'none'; });
    syncActive(id);
  }

  function restoreSidebar(reason = 'run') {
    injectStyle();
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return false;
    if (sidebar.dataset.eaSideNavRestoredVersion === VERSION && sidebar.textContent.includes('Intelligence Centre')) {
      syncActive(activeSection());
      return true;
    }
    const email = document.querySelector('.user-email')?.textContent || 'Loading...';
    sidebar.innerHTML = `
      <div class="ea-side-brand"><div class="ea-side-logo">⌂</div><div><div class="ea-side-eyebrow">Elevate Automation</div><div class="ea-side-title">Elevate Operator Console</div><div class="ea-side-sub">Sales automation command center</div></div></div>
      <div class="ea-operator-card"><div class="ea-operator-label">Operator</div><div class="ea-operator-value">Loading...</div><div class="ea-operator-sub user-email">${email}</div></div>
      <nav class="sidebar-nav">${navItems.map((item) => `<button class="nav-btn ea-nav-btn" type="button" data-section="${item.id}"><span class="ea-nav-icon">${item.icon}</span><span><span class="ea-nav-title">${item.title}</span><span class="ea-nav-sub">${item.sub}</span></span></button>`).join('')}</nav>
      <div class="sidebar-actions"><button id="refreshAccessBtn" class="btn-secondary" type="button">Refresh Access</button><button id="logoutBtn" class="btn-danger" type="button">Logout</button></div>
    `;
    sidebar.dataset.eaSideNavRestored = 'true';
    sidebar.dataset.eaSideNavRestoredVersion = VERSION;
    sidebar.dataset.eaSideNavRestoreReason = reason;
    sidebar.querySelectorAll('.nav-btn').forEach((btn) => btn.addEventListener('click', () => show(btn.dataset.section || 'overview')));
    sidebar.querySelector('#refreshAccessBtn')?.addEventListener('click', () => { if (typeof window.refreshDashboardData === 'function') window.refreshDashboardData(); else location.reload(); });
    sidebar.querySelector('#logoutBtn')?.addEventListener('click', () => { location.href = '/login.html'; });
    syncActive(activeSection());
    return true;
  }

  function boot() {
    NS.modules.sideNavRestore20260524 = true;
    NS.modules.sideNavRestoreVersion = VERSION;
    restoreSidebar('boot');
    [100,350,800,1500,2500,4000,6500,9000].forEach((ms) => setTimeout(() => restoreSidebar(`retry-${ms}`), ms));
    window.addEventListener('elevate:summary-ready', () => setTimeout(() => restoreSidebar('summary-ready'), 50));
    window.addEventListener('elevate:auth-ready', () => setTimeout(() => restoreSidebar('auth-ready'), 50));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();