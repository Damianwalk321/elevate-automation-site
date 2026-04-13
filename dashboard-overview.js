
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.overview) return;

  const CSS = `
    .ea-ov-shell{display:grid;gap:16px}
    .ea-ov-toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px}
    .ea-ov-tag{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:rgba(212,175,55,0.10);border:1px solid rgba(212,175,55,0.16);color:#f3ddb0;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
    .ea-ov-segment{display:inline-flex;gap:8px;background:#111;border:1px solid rgba(212,175,55,0.12);border-radius:999px;padding:6px}
    .ea-ov-segment button{appearance:none;border:none;background:transparent;color:#d8d8d8;padding:10px 14px;border-radius:999px;cursor:pointer;font-weight:700;font-size:13px}
    .ea-ov-segment button.active{background:rgba(212,175,55,0.15);color:#f3ddb0}
    .ea-ov-group{display:grid;gap:16px}
    .ea-ov-hidden{display:none !important}
    .ea-ov-collapse{border:1px solid rgba(212,175,55,0.10);border-radius:16px;overflow:hidden;background:#111}
    .ea-ov-collapse-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;background:rgba(255,255,255,0.02)}
    .ea-ov-collapse-body{display:none;padding:16px;border-top:1px solid rgba(212,175,55,0.08)}
    .ea-ov-collapse.open .ea-ov-collapse-body{display:block}
    .ea-ov-mini{display:grid;gap:10px}
    .ea-ov-mini-row{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:12px 14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .ea-ov-mini-row strong{display:block;margin-bottom:4px}
    .ea-ov-mini-meta{font-size:13px;color:#a9a9a9;line-height:1.5}
    .ea-ov-pill{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.08);background:#171717}
    .ea-ov-pill.done{color:#9de8a8;border-color:rgba(157,232,168,.22)}
    .ea-ov-pill.in_progress{color:#f3ddb0;border-color:rgba(212,175,55,.22)}
    .ea-ov-pill.blocked{color:#ffb4b4;border-color:rgba(255,180,180,.22)}
    .ea-ov-pill.snoozed{color:#c8c8ff;border-color:rgba(200,200,255,.20)}
    .ea-ov-pill.open{color:#f2f2f2}
    .ea-ov-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .ea-ov-mini-btn{appearance:none;border:1px solid rgba(255,255,255,.08);background:#1a1a1a;color:#f2f2f2;border-radius:10px;padding:8px 10px;cursor:pointer;font-size:12px}
    .ea-ov-mini-btn:hover{border-color:rgba(212,175,55,.22);background:#212121}
    .ea-ov-context-muted{opacity:.94}
    .ea-ov-context-muted .section-head h2,.ea-ov-context-muted h2{font-size:20px}
  `;

  function ensureStyle() {
    if (NS.ui?.injectStyleOnce) return NS.ui.injectStyleOnce('elevate-dashboard-overview-bundle-a', CSS);
    if (document.getElementById('elevate-dashboard-overview-bundle-a')) return;
    const style = document.createElement('style');
    style.id = 'elevate-dashboard-overview-bundle-a';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function initWorkflowMemory() {
    if (NS.workflowMemory) return NS.workflowMemory;
    const key = 'elevate.workflow.memory.v2';
    const seed = { dayKey: todayKey(), actions: {}, events: [] };

    function load() {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || 'null');
        return raw && typeof raw === 'object' ? { ...seed, ...raw } : { ...seed };
      } catch { return { ...seed }; }
    }

    let state = load();

    function save() {
      try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
    }

    function normalize() {
      const now = Date.now();
      if (state.dayKey !== todayKey()) state.dayKey = todayKey();
      Object.keys(state.actions || {}).forEach((id) => {
        const item = state.actions[id];
        if (item?.status === 'snoozed' && item.snoozeUntil && item.snoozeUntil <= now) {
          item.status = 'open';
          item.snoozeUntil = null;
        }
      });
      save();
    }

    function recordEvent(type, payload = {}) {
      const entry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        at: new Date().toISOString(),
        type,
        ...payload
      };
      state.events = [entry, ...(state.events || [])].slice(0, 80);
      save();
      return entry;
    }

    function setStatus(id, status, meta = {}) {
      normalize();
      const current = state.actions[id] || { id, status: 'open', createdAt: new Date().toISOString() };
      state.actions[id] = {
        ...current,
        ...meta,
        status,
        updatedAt: new Date().toISOString(),
        snoozeUntil: status === 'snoozed' ? Date.now() + ((meta.snoozeHours || 24) * 3600 * 1000) : null
      };
      recordEvent('action_status_changed', { actionId: id, title: state.actions[id].title || id, section: state.actions[id].section || 'overview', status });
      save();
      return state.actions[id];
    }

    function getAction(id, fallback = {}) {
      normalize();
      return state.actions[id] || { id, status: 'open', ...fallback };
    }

    function getSummary() {
      normalize();
      const values = Object.values(state.actions || {});
      return {
        done: values.filter((x) => x.status === 'done').length,
        open: values.filter((x) => !x.status || x.status === 'open').length,
        in_progress: values.filter((x) => x.status === 'in_progress').length,
        blocked: values.filter((x) => x.status === 'blocked').length,
        snoozed: values.filter((x) => x.status === 'snoozed').length
      };
    }

    function getEvents(limit = 6) {
      normalize();
      return (state.events || []).slice(0, limit);
    }

    function wireButtons(root = document) {
      root.querySelectorAll('[data-ea-workflow-id]').forEach((wrap) => {
        const id = wrap.getAttribute('data-ea-workflow-id');
        const title = wrap.getAttribute('data-ea-workflow-title') || id;
        const section = wrap.getAttribute('data-ea-workflow-section') || 'overview';
        wrap.querySelectorAll('[data-ea-workflow-set]').forEach((btn) => {
          if (btn.dataset.boundEaWorkflow === 'true') return;
          btn.dataset.boundEaWorkflow = 'true';
          btn.addEventListener('click', () => {
            setStatus(id, btn.getAttribute('data-ea-workflow-set'), { title, section });
            window.dispatchEvent(new CustomEvent('elevate:workflow-updated', { detail: { id } }));
          });
        });
      });
    }

    NS.workflowMemory = { setStatus, getAction, getSummary, getEvents, wireButtons, normalize };
    return NS.workflowMemory;
  }

  function statusBadge(status) {
    const safe = String(status || 'open');
    return `<span class="ea-ov-pill ${safe}">${safe.replace('_',' ')}</span>`;
  }

  function masterActions() {
    return [
      { id: 'posting.review_readiness', title: 'Review posting readiness', copy: 'Verify access, compliance, queue, and posting capacity before pushing volume.', section: 'extension' },
      { id: 'listing.resolve_intervention', title: 'Resolve listing intervention items', copy: 'Clean up weak, stale, or flagged listings before adding more execution pressure.', section: 'tools', focus: 'listingSearchInput' },
      { id: 'partner.follow_up', title: 'Run one partner follow-up', copy: 'Move one user toward paid, reactivation, or a manager introduction.', section: 'affiliate' },
      { id: 'billing.review_upgrade_logic', title: 'Review workflow bottleneck', copy: 'Upgrades should follow real friction and real leverage.', section: 'billing' }
    ];
  }

  function buildOperatorMemoryCard() {
    initWorkflowMemory();
    const summary = NS.workflowMemory.getSummary();
    const events = NS.workflowMemory.getEvents(5);
    const actions = masterActions();

    return `
      <div class="card ea-ov-context-muted" id="eaOverviewMemoryCard">
        <div class="section-head">
          <div>
            <div class="ea-ov-tag">Operator Memory</div>
            <h2 style="margin-top:6px;">Action state now has durable memory</h2>
            <div class="subtext">Workflow decisions stay visible across refresh and day-to-day return without taking over the overview.</div>
          </div>
          <span class="badge warn">${summary.done} done today</span>
        </div>

        <div class="grid-4" style="margin-bottom:14px;">
          <div class="sidebar-card"><div class="sidebar-card-label">Done</div><div class="sidebar-card-value">${summary.done}</div></div>
          <div class="sidebar-card"><div class="sidebar-card-label">Open</div><div class="sidebar-card-value">${summary.open + summary.in_progress}</div></div>
          <div class="sidebar-card"><div class="sidebar-card-label">Snoozed</div><div class="sidebar-card-value">${summary.snoozed}</div></div>
          <div class="sidebar-card"><div class="sidebar-card-label">Blocked</div><div class="sidebar-card-value">${summary.blocked}</div></div>
        </div>

        <div class="ea-ov-collapse" id="eaOverviewMemoryCollapse">
          <div class="ea-ov-collapse-head">
            <div>
              <div class="ea-ov-tag">Action Queue</div>
              <strong>Persistent workflow controls</strong>
            </div>
            <div class="subtext">Expand</div>
          </div>
          <div class="ea-ov-collapse-body">
            <div class="ea-ov-mini" style="margin-bottom:14px;">
              ${actions.map((item) => {
                const action = NS.workflowMemory.getAction(item.id, { title: item.title, section: item.section });
                return `
                  <div class="ea-ov-mini-row">
                    <div>
                      <strong>${item.title}</strong>
                      <div class="ea-ov-mini-meta">${item.copy}</div>
                    </div>
                    <div data-ea-workflow-id="${item.id}" data-ea-workflow-title="${item.title}" data-ea-workflow-section="${item.section}">
                      <div style="display:grid;gap:10px;justify-items:end;">
                        ${statusBadge(action.status)}
                        <div class="ea-ov-actions">
                          <button class="ea-ov-mini-btn" type="button" data-ea-workflow-set="in_progress">Start</button>
                          <button class="ea-ov-mini-btn" type="button" data-ea-workflow-set="done">Done</button>
                          <button class="ea-ov-mini-btn" type="button" data-ea-workflow-set="snoozed">Snooze</button>
                          <button class="ea-ov-mini-btn" type="button" data-ea-workflow-set="blocked">Blocked</button>
                          <button class="action-btn" type="button" data-open-section="${item.section}" data-focus-field="${item.focus || ''}">Open</button>
                        </div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <div class="ea-ov-mini">
              ${events.length ? events.map((event) => `
                <div class="ea-ov-mini-row">
                  <div>
                    <strong>${event.title || event.actionId || event.type}</strong>
                    <div class="ea-ov-mini-meta">${String(event.status || event.type || '').replace(/_/g, ' ')} · ${event.section || 'system'}</div>
                  </div>
                  <div class="ea-ov-mini-meta">${new Date(event.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
                </div>
              `).join('') : `<div class="ea-ov-mini-row"><div><strong>No workflow history yet</strong><div class="ea-ov-mini-meta">Use the action buttons and the timeline will begin filling in.</div></div></div>`}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindOpenButtons(root = document) {
    root.querySelectorAll('[data-open-section]').forEach((button) => {
      if (button.dataset.boundEaOpen === 'true') return;
      button.dataset.boundEaOpen = 'true';
      button.addEventListener('click', () => {
        const section = button.getAttribute('data-open-section');
        const focusId = button.getAttribute('data-focus-field');
        if (typeof window.showSection === 'function') window.showSection(section);
        if (focusId) setTimeout(() => document.getElementById(focusId)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 220);
      });
    });
  }

  function applyOverviewHierarchy() {
    const overview = document.getElementById('overview');
    if (!overview) return;
    ensureStyle();

    const commandGrid = overview.querySelector('.command-center-grid');
    const operatorStrip = overview.querySelector('.operator-strip');
    const priorityGrid = document.getElementById('overviewPriorityGrid');
    const kpiGrid = document.getElementById('overviewPerformanceGrid');
    const listingsCard = document.getElementById('overviewListingsCard');
    const accountGrid = document.getElementById('overviewAccountGrid');
    const upgradeCard = document.getElementById('overviewUpgradeCard');
    if (!commandGrid || !operatorStrip || !priorityGrid || !listingsCard || !accountGrid || !upgradeCard) return;

    let shell = document.getElementById('eaOverviewShell');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'eaOverviewShell';
      shell.className = 'ea-ov-shell';
      shell.innerHTML = `
        <div class="ea-ov-toolbar">
          <div><span class="ea-ov-tag">Operator Focus</span></div>
          <div class="ea-ov-segment" id="eaOverviewSegment">
            <button type="button" data-mode="core" class="active">Core</button>
            <button type="button" data-mode="listings">Listings</button>
            <button type="button" data-mode="context">Context</button>
            <button type="button" data-mode="all">All</button>
          </div>
        </div>
      `;
      overview.prepend(shell);
    }

    let core = document.getElementById('eaOverviewCore');
    if (!core) { core = document.createElement('div'); core.id = 'eaOverviewCore'; core.className = 'ea-ov-group'; shell.appendChild(core); }
    let listings = document.getElementById('eaOverviewListings');
    if (!listings) { listings = document.createElement('div'); listings.id = 'eaOverviewListings'; listings.className = 'ea-ov-group'; shell.appendChild(listings); }
    let context = document.getElementById('eaOverviewContext');
    if (!context) { context = document.createElement('div'); context.id = 'eaOverviewContext'; context.className = 'ea-ov-group ea-ov-context-muted'; shell.appendChild(context); }

    [commandGrid, operatorStrip, priorityGrid, kpiGrid].filter(Boolean).forEach((node) => core.appendChild(node));
    listings.appendChild(listingsCard);

    let contextWrap = document.getElementById('eaOverviewContextWrap');
    if (!contextWrap) {
      contextWrap = document.createElement('div');
      contextWrap.id = 'eaOverviewContextWrap';
      context.appendChild(contextWrap);
    }
    contextWrap.innerHTML = '';
    contextWrap.appendChild(accountGrid);
    contextWrap.appendChild(upgradeCard);

    let memoryMount = document.getElementById('eaOverviewMemoryMount');
    if (!memoryMount) {
      memoryMount = document.createElement('div');
      memoryMount.id = 'eaOverviewMemoryMount';
      context.appendChild(memoryMount);
    }
    memoryMount.innerHTML = buildOperatorMemoryCard();

    const collapse = document.getElementById('eaOverviewMemoryCollapse');
    if (collapse && collapse.dataset.boundEaCollapse !== 'true') {
      collapse.dataset.boundEaCollapse = 'true';
      const head = collapse.querySelector('.ea-ov-collapse-head');
      head?.addEventListener('click', () => {
        collapse.classList.toggle('open');
        const sub = collapse.querySelector('.subtext');
        if (sub) sub.textContent = collapse.classList.contains('open') ? 'Collapse' : 'Expand';
      });
    }

    const segment = document.getElementById('eaOverviewSegment');
    if (segment && segment.dataset.boundEaSegment !== 'true') {
      segment.dataset.boundEaSegment = 'true';
      const buttons = Array.from(segment.querySelectorAll('button'));
      const groups = { core: [core], listings: [listings], context: [context], all: [core, listings, context] };
      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          buttons.forEach((btn) => btn.classList.toggle('active', btn === button));
          [core, listings, context].forEach((group) => group.classList.add('ea-ov-hidden'));
          (groups[button.dataset.mode] || groups.all).forEach((group) => group.classList.remove('ea-ov-hidden'));
        });
      });
    }

    NS.workflowMemory?.wireButtons(document.getElementById('eaOverviewMemoryMount') || overview);
    bindOpenButtons(overview);
  }

  function renderBundleA() {
    initWorkflowMemory();
    applyOverviewHierarchy();
  }

  NS.overview = { applyOverviewHierarchy, renderBundleA, initWorkflowMemory };
  NS.modules = NS.modules || {};
  NS.modules.overview = true;

  const boot = () => {
    renderBundleA();
    setTimeout(renderBundleA, 1200);
    setTimeout(renderBundleA, 3200);
  };

  window.addEventListener('elevate:workflow-updated', () => renderBundleA());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
