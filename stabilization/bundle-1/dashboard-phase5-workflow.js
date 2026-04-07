(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase5workflow) return;

  const CSS = `
    .salesos-shell { display:grid; gap:16px; margin-bottom:16px; }
    .salesos-bar { display:grid; grid-template-columns: 1.15fr 1fr; gap:16px; }
    .salesos-card { background:#121212; border:1px solid rgba(212,175,55,0.12); border-radius:18px; padding:18px; box-shadow:0 10px 30px rgba(0,0,0,0.28); }
    .salesos-eyebrow { color:#d4af37; font-size:12px; font-weight:700; letter-spacing:1.3px; text-transform:uppercase; margin-bottom:8px; }
    .salesos-title { font-size:24px; font-weight:700; line-height:1.1; margin-bottom:8px; }
    .salesos-sub { color:#b8b8b8; font-size:14px; line-height:1.55; }
    .salesos-chip-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
    .salesos-chip { display:inline-flex; align-items:center; min-height:34px; padding:0 12px; border-radius:999px; background:rgba(212,175,55,0.10); border:1px solid rgba(212,175,55,0.16); color:#f3ddb0; font-size:12px; font-weight:700; }
    .salesos-controls { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
    .salesos-select { background:#171717; color:#f5f5f5; border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:12px 14px; font-size:14px; min-width:160px; }
    .salesos-grid { display:grid; grid-template-columns: 1.35fr 0.95fr; gap:16px; }
    .salesos-queue { display:grid; gap:12px; }
    .salesos-task { background:#161616; border:1px solid rgba(255,255,255,0.06); border-radius:16px; padding:14px; display:grid; gap:10px; }
    .salesos-task-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .salesos-task-title { font-size:15px; font-weight:700; line-height:1.35; }
    .salesos-task-meta { color:#a7a7a7; font-size:12px; line-height:1.4; }
    .salesos-priority { display:inline-flex; align-items:center; padding:6px 10px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; border:1px solid rgba(255,255,255,0.08); }
    .salesos-priority.do_now { background:rgba(212,175,55,0.14); color:#f3ddb0; border-color:rgba(212,175,55,0.2); }
    .salesos-priority.do_today { background:rgba(255,255,255,0.06); color:#ececec; }
    .salesos-priority.watch { background:rgba(56,122,255,0.12); color:#cfe0ff; border-color:rgba(56,122,255,0.18); }
    .salesos-priority.low { background:rgba(120,120,120,0.14); color:#d7d7d7; }
    .salesos-task-copy { color:#ececec; font-size:13px; line-height:1.55; }
    .salesos-task-actions { display:flex; gap:8px; flex-wrap:wrap; }
    .salesos-btn { appearance:none; border:1px solid rgba(255,255,255,0.08); background:#1a1a1a; color:#f2f2f2; border-radius:12px; padding:10px 12px; cursor:pointer; font-size:13px; }
    .salesos-btn.primary { background:#d4af37; color:#0b0b0b; border:none; font-weight:700; }
    .salesos-side-list { display:grid; gap:10px; }
    .salesos-side-item { background:#171717; border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:12px; }
    .salesos-empty { padding:18px; border-radius:16px; border:1px dashed rgba(212,175,55,0.18); color:#a9a9a9; background:#111; text-align:center; }
    @media (max-width: 1180px) {
      .salesos-bar, .salesos-grid { grid-template-columns: 1fr; }
    }
  `;

  function n(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function formatPriority(priority) {
    const normalized = clean(priority).toLowerCase();
    if (normalized === 'do_now') return { key: 'do_now', label: 'Do Now' };
    if (normalized === 'do_today') return { key: 'do_today', label: 'Do Today' };
    if (normalized === 'watch') return { key: 'watch', label: 'Watch' };
    return { key: 'low', label: 'Low' };
  }

  function inferRole(summary = {}) {
    if (summary.manager_access) return 'manager';
    if ((summary.affiliate || {}).referral_code) return 'hybrid';
    return 'salesperson';
  }

  function buildWorkflowTasks(summary = {}) {
    const tasks = [];
    const actionDetails = summary.action_center_details || {};
    const revenue = summary.revenue_intelligence || {};
    const setup = summary.setup_status || {};

    const todayItems = Array.isArray(actionDetails.today) ? actionDetails.today : [];
    todayItems.forEach((item, index) => {
      tasks.push({
        id: clean(item.id || `today_${index}`),
        title: clean(item.title || item.label || 'Priority task'),
        copy: clean(item.copy || item.description || item.reason || 'Review this task.'),
        priority: 'do_now',
        source: 'action_center',
        action: clean(item.action || ''),
        section: 'overview'
      });
    });

    const stale = n(summary.stale_listings);
    if (stale > 0) {
      tasks.push({
        id: 'stale_refresh',
        title: `${stale} stale listing${stale === 1 ? '' : 's'} need refresh`,
        copy: 'Move stale inventory into the first recovery pass so visibility and repost flow do not lag.',
        priority: stale >= 10 ? 'do_now' : 'do_today',
        source: 'listing_health',
        action: 'stale',
        section: 'overview'
      });
    }

    const reviewQueue = n(summary.review_queue_count);
    if (reviewQueue > 0) {
      tasks.push({
        id: 'review_queue',
        title: `${reviewQueue} listing${reviewQueue === 1 ? '' : 's'} waiting for review`,
        copy: 'Clear review friction first so the queue does not slow the operating loop.',
        priority: reviewQueue >= 10 ? 'do_now' : 'do_today',
        source: 'review_queue',
        action: 'review',
        section: 'overview'
      });
    }

    const setupGaps = Array.isArray(setup.setup_gaps) ? setup.setup_gaps.filter(Boolean) : [];
    if (setupGaps.length) {
      tasks.push({
        id: 'setup_gap',
        title: 'Setup gaps are still open',
        copy: `Finish: ${setupGaps.slice(0, 3).join(', ')}${setupGaps.length > 3 ? '...' : ''}`,
        priority: 'do_today',
        source: 'setup',
        action: 'profile',
        section: 'profile'
      });
    }

    const weak = n(summary.weak_listings);
    if (weak > 0) {
      tasks.push({
        id: 'weak_listings',
        title: `${weak} weak listing${weak === 1 ? '' : 's'} need stronger copy or media`,
        copy: 'Use weak-listing review to tighten titles, pricing signal, and visual quality.',
        priority: weak >= 8 ? 'do_today' : 'watch',
        source: 'listing_health',
        action: 'weak',
        section: 'tools'
      });
    }

    const postsRemaining = n(summary.account_snapshot?.posts_remaining);
    const queueCount = n(summary.queue_count);
    if (postsRemaining > 0 && queueCount > 0) {
      tasks.push({
        id: 'post_queue',
        title: `Use remaining capacity: ${postsRemaining} post${postsRemaining === 1 ? '' : 's'} left`,
        copy: `There ${queueCount === 1 ? 'is' : 'are'} ${queueCount} queued vehicle${queueCount === 1 ? '' : 's'} ready to move now.`,
        priority: 'do_now',
        source: 'output',
        action: 'queue',
        section: 'extension'
      });
    }

    if (n(revenue.refresh_candidates) > 0) {
      tasks.push({
        id: 'refresh_candidates',
        title: `${n(revenue.refresh_candidates)} refresh candidate${n(revenue.refresh_candidates) === 1 ? '' : 's'}`,
        copy: 'Treat refresh candidates as revenue recovery, not just maintenance.',
        priority: 'watch',
        source: 'revenue',
        action: 'refresh',
        section: 'tools'
      });
    }

    const deduped = new Map();
    tasks.forEach((task) => {
      if (!deduped.has(task.id)) deduped.set(task.id, task);
    });

    const rank = { do_now: 4, do_today: 3, watch: 2, low: 1 };
    return Array.from(deduped.values()).sort((left, right) => (rank[right.priority] || 0) - (rank[left.priority] || 0));
  }

  function filterTasks(tasks, mode) {
    if (mode === 'today') return tasks.filter((task) => ['do_now', 'do_today'].includes(task.priority));
    if (mode === 'revenue_leaks') return tasks.filter((task) => ['stale_refresh', 'weak_listings', 'refresh_candidates', 'review_queue'].includes(task.id) || task.source === 'revenue');
    if (mode === 'review') return tasks.filter((task) => task.action === 'review' || task.id === 'review_queue');
    if (mode === 'setup') return tasks.filter((task) => task.section === 'profile');
    if (mode === 'queue') return tasks.filter((task) => task.action === 'queue');
    return tasks;
  }

  function ensureMount() {
    const overview = document.getElementById('overview');
    if (!overview) return null;

    let mount = document.getElementById('salesosMount');
    if (mount) return mount;

    mount = document.createElement('div');
    mount.id = 'salesosMount';
    const commandGrid = overview.querySelector('.command-center-grid');
    if (commandGrid) {
      commandGrid.insertAdjacentElement('afterend', mount);
    } else {
      overview.prepend(mount);
    }
    return mount;
  }

  function renderSalesOS({ reason = 'manual' } = {}) {
    if (NS.flags?.disablePhase5) return;

    const mount = ensureMount();
    if (!mount) return;

    NS.ui?.injectStyleOnce?.('elevate-dashboard-phase5-workflow', CSS);

    const summary = window.dashboardSummary || {};
    const storedMode = NS.state?.get?.('workflow.mode', 'today') || 'today';
    const storedRole = NS.state?.get?.('workflow.role', '') || '';
    const mode = storedMode || 'today';
    const role = storedRole || inferRole(summary);
    const tasks = buildWorkflowTasks(summary);
    const filtered = filterTasks(tasks, mode);

    const access = clean(window.currentNormalizedSession?.subscription?.plan || summary.account_snapshot?.plan || 'Founder Beta');
    const reviewQueue = n(summary.review_queue_count);
    const stale = n(summary.stale_listings);
    const queue = n(summary.queue_count);
    const weak = n(summary.weak_listings);
    const revenueAttention = reviewQueue + stale + weak + n(summary.needs_action_count);

    mount.innerHTML = `
      <div class="salesos-shell">
        <div class="salesos-bar">
          <div class="salesos-card">
            <div class="salesos-eyebrow">Sales OS</div>
            <div class="salesos-title">Unified Task Queue</div>
            <div class="salesos-sub">Run the next highest-leverage move from one operator surface instead of hunting across cards.</div>
            <div class="salesos-chip-row">
              <span class="salesos-chip">Role: ${role}</span>
              <span class="salesos-chip">Mode: ${mode.replaceAll('_', ' ')}</span>
              <span class="salesos-chip">Plan: ${access}</span>
              <span class="salesos-chip">Reason: ${clean(reason || 'render')}</span>
            </div>
          </div>
          <div class="salesos-card">
            <div class="salesos-eyebrow">Operating Modes</div>
            <div class="salesos-controls">
              <select id="salesosModeSelect" class="salesos-select">
                <option value="today"${mode === 'today' ? ' selected' : ''}>Today</option>
                <option value="revenue_leaks"${mode === 'revenue_leaks' ? ' selected' : ''}>Revenue Leaks</option>
                <option value="review"${mode === 'review' ? ' selected' : ''}>Review Queue</option>
                <option value="queue"${mode === 'queue' ? ' selected' : ''}>Queue</option>
                <option value="setup"${mode === 'setup' ? ' selected' : ''}>Setup</option>
                <option value="all"${mode === 'all' ? ' selected' : ''}>All</option>
              </select>
              <select id="salesosRoleSelect" class="salesos-select">
                <option value="salesperson"${role === 'salesperson' ? ' selected' : ''}>Salesperson View</option>
                <option value="manager"${role === 'manager' ? ' selected' : ''}>Manager View</option>
                <option value="hybrid"${role === 'hybrid' ? ' selected' : ''}>Hybrid View</option>
              </select>
            </div>
            <div class="salesos-chip-row">
              <span class="salesos-chip">Review: ${reviewQueue}</span>
              <span class="salesos-chip">Stale: ${stale}</span>
              <span class="salesos-chip">Queue: ${queue}</span>
              <span class="salesos-chip">Revenue Attention: ${revenueAttention}</span>
            </div>
          </div>
        </div>

        <div class="salesos-grid">
          <div class="salesos-card">
            <div class="salesos-eyebrow">Task Queue</div>
            <div class="salesos-queue" id="salesosTaskQueue">
              ${filtered.length ? filtered.map((task) => {
                const priority = formatPriority(task.priority);
                return `
                  <div class="salesos-task">
                    <div class="salesos-task-head">
                      <div>
                        <div class="salesos-task-title">${task.title}</div>
                        <div class="salesos-task-meta">${task.source.replaceAll('_', ' ')} • section: ${task.section}</div>
                      </div>
                      <span class="salesos-priority ${priority.key}">${priority.label}</span>
                    </div>
                    <div class="salesos-task-copy">${task.copy}</div>
                    <div class="salesos-task-actions">
                      <button class="salesos-btn primary" type="button" data-salesos-open="${task.section}">Open ${task.section}</button>
                      <button class="salesos-btn" type="button" data-salesos-focus="${task.action || task.section}">Focus</button>
                    </div>
                  </div>
                `;
              }).join('') : '<div class="salesos-empty">No tasks in this mode yet.</div>'}
            </div>
          </div>

          <div class="salesos-card">
            <div class="salesos-eyebrow">Role Surface</div>
            <div class="salesos-side-list">
              <div class="salesos-side-item"><strong>Salesperson</strong><br><span class="salesos-sub">Execution, queue movement, listing review, and output speed.</span></div>
              <div class="salesos-side-item"><strong>Manager</strong><br><span class="salesos-sub">Review pressure, team visibility, revenue leaks, and inventory health.</span></div>
              <div class="salesos-side-item"><strong>Hybrid</strong><br><span class="salesos-sub">Sales workflow plus affiliate / growth activity on the same surface.</span></div>
              <div class="salesos-side-item"><strong>Why this matters</strong><br><span class="salesos-sub">This layer turns the dashboard into a task-driven operator surface instead of a static card wall.</span></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const modeSelect = document.getElementById('salesosModeSelect');
    if (modeSelect) {
      modeSelect.addEventListener('change', () => {
        NS.state?.set?.('workflow.mode', modeSelect.value);
        renderSalesOS({ reason: 'mode_change' });
      }, { once: true });
    }

    const roleSelect = document.getElementById('salesosRoleSelect');
    if (roleSelect) {
      roleSelect.addEventListener('change', () => {
        NS.state?.set?.('workflow.role', roleSelect.value);
        renderSalesOS({ reason: 'role_change' });
      }, { once: true });
    }

    mount.querySelectorAll('[data-salesos-open]').forEach((button) => {
      button.addEventListener('click', () => {
        const section = button.getAttribute('data-salesos-open') || 'overview';
        if (typeof window.showSection === 'function') {
          window.showSection(section);
        }
      }, { once: true });
    });

    mount.querySelectorAll('[data-salesos-focus]').forEach((button) => {
      button.addEventListener('click', () => {
        const focusLabel = clean(button.getAttribute('data-salesos-focus') || 'task');
        const status = document.getElementById('bootStatus');
        if (status) status.textContent = `Sales OS focus: ${focusLabel}`;
      }, { once: true });
    });
  }

  NS.phase5workflow = { renderSalesOS, buildWorkflowTasks };
  NS.modules = NS.modules || {};
  NS.modules.phase5workflow = true;
})();
