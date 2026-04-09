
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.overview) return;

  const CSS = `
    :root {
      --accent: #d4af37;
      --panel-soft: #141414;
      --panel-deep: #101010;
      --text-soft: #d6d6d6;
    }
    .phase4-shell { display:grid; gap:16px; }
    .phase4-toolbar { display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:8px; }
    .phase4-segment { display:inline-flex; gap:8px; background:#111; border:1px solid rgba(212,175,55,0.12); border-radius:999px; padding:6px; }
    .phase4-segment button { appearance:none; border:none; background:transparent; color:#d8d8d8; padding:10px 14px; border-radius:999px; cursor:pointer; font-weight:700; font-size:13px; }
    .phase4-segment button.active { background:rgba(212,175,55,0.15); color:#f3ddb0; }
    .phase4-group { display:grid; gap:16px; }
    .phase4-hidden { display:none !important; }
    .phase4-tag { display:inline-flex; align-items:center; padding:6px 10px; border-radius:999px; background:rgba(212,175,55,0.10); border:1px solid rgba(212,175,55,0.16); color:#f3ddb0; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; }
    .phase4-collapse { border:1px solid rgba(212,175,55,0.10); border-radius:16px; overflow:hidden; background:#111; }
    .phase4-collapse-head { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:14px 16px; cursor:pointer; background:rgba(255,255,255,0.02); }
    .phase4-collapse-body { display:none; padding:16px; border-top:1px solid rgba(212,175,55,0.08); }
    .phase4-collapse.open .phase4-collapse-body { display:block; }

    .i-memory-shell{display:grid;gap:16px;margin-bottom:16px}
    .i-memory-hero,.i-memory-card{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .i-memory-hero-grid{display:grid;grid-template-columns:1.4fr repeat(4,minmax(0,1fr));gap:12px}
    .i-memory-title{font-size:28px;line-height:1.05;margin:0 0 8px}
    .i-memory-copy{color:#d6d6d6;line-height:1.55;font-size:14px}
    .i-memory-metric{font-size:28px;line-height:1;font-weight:800;color:#f3ddb0;margin-bottom:8px}
    .i-queue-list,.i-timeline-list{display:grid;gap:10px;margin-top:12px}
    .i-queue-item,.i-timeline-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .i-queue-item strong,.i-timeline-item strong{display:block;margin-bottom:6px}
    .i-queue-meta,.i-timeline-meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    .i-action-controls{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .i-mini-btn{appearance:none;border:1px solid rgba(255,255,255,.08);background:#1a1a1a;color:#f2f2f2;border-radius:10px;padding:8px 10px;cursor:pointer;font-size:12px}
    .i-mini-btn:hover{border-color:rgba(212,175,55,.22);background:#212121}
    .i-pill{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.08);background:#171717}
    .i-pill.done{color:#9de8a8;border-color:rgba(157,232,168,.22)}
    .i-pill.in_progress{color:#f3ddb0;border-color:rgba(212,175,55,.22)}
    .i-pill.blocked{color:#ffb4b4;border-color:rgba(255,180,180,.22)}
    .i-pill.snoozed{color:#c8c8ff;border-color:rgba(200,200,255,.20)}
    .i-pill.open{color:#f2f2f2}
    .i-quiet{opacity:.92}
    @media (max-width:1280px){.i-memory-hero-grid{grid-template-columns:1fr 1fr}}
    @media (max-width:760px){.i-memory-hero-grid{grid-template-columns:1fr}.i-memory-title{font-size:24px}}
  `;

  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function num(value) {
    const m = String(value || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }
  function txt(id) { return clean(document.getElementById(id)?.textContent || ''); }
  function ensureStyle() { NS.ui?.injectStyleOnce ? NS.ui.injectStyleOnce('elevate-dashboard-bundle-i-overview', CSS) : null; }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function initWorkflowMemory() {
    if (NS.workflowMemory) return NS.workflowMemory;
    const key = 'elevate.workflow.memory.v1';
    const defaultState = { dayKey: todayKey(), actions: {}, events: [] };

    function load() {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        return parsed && typeof parsed === 'object' ? { ...defaultState, ...parsed } : { ...defaultState };
      } catch {
        return { ...defaultState };
      }
    }

    let state = load();

    function save() {
      try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
    }

    function normalize() {
      const now = Date.now();
      if (state.dayKey !== todayKey()) state.dayKey = todayKey();
      Object.keys(state.actions || {}).forEach((id) => {
        const action = state.actions[id];
        if (action?.status === 'snoozed' && action.snoozeUntil && action.snoozeUntil <= now) {
          action.status = 'open';
          action.snoozeUntil = null;
        }
      });
      save();
    }

    function pushEvent(type, payload = {}) {
      const entry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        at: new Date().toISOString(),
        dayKey: todayKey(),
        type,
        ...payload
      };
      state.events = [entry, ...(state.events || [])].slice(0, 120);
      save();
      return entry;
    }

    function setAction(id, patch = {}) {
      normalize();
      const current = state.actions[id] || { id, status: 'open', createdAt: new Date().toISOString() };
      state.actions[id] = { ...current, ...patch, updatedAt: new Date().toISOString() };
      save();
      return state.actions[id];
    }

    function setStatus(id, status, meta = {}) {
      const action = setAction(id, {
        title: meta.title || state.actions[id]?.title || id,
        section: meta.section || state.actions[id]?.section || 'overview',
        reason: meta.reason || state.actions[id]?.reason || '',
        status,
        snoozeUntil: status === 'snoozed' ? Date.now() + ((meta.snoozeHours || 24) * 3600 * 1000) : null
      });
      pushEvent('action_status_changed', {
        actionId: id,
        title: action.title,
        status,
        section: action.section
      });
      return action;
    }

    function getAction(id, fallback = {}) {
      normalize();
      return state.actions[id] || { id, status: 'open', ...fallback };
    }

    function getEvents(limit = 12) {
      normalize();
      return (state.events || []).slice(0, limit);
    }

    function getTodaySummary() {
      normalize();
      const actions = Object.values(state.actions || {});
      return {
        done: actions.filter(a => a.status === 'done').length,
        open: actions.filter(a => !a.status || a.status === 'open').length,
        in_progress: actions.filter(a => a.status === 'in_progress').length,
        blocked: actions.filter(a => a.status === 'blocked').length,
        snoozed: actions.filter(a => a.status === 'snoozed').length
      };
    }

    function wireButtons(root = document) {
      root.querySelectorAll('[data-workflow-id]').forEach((wrap) => {
        const id = wrap.getAttribute('data-workflow-id');
        const title = wrap.getAttribute('data-workflow-title') || id;
        const section = wrap.getAttribute('data-workflow-section') || 'overview';
        wrap.querySelectorAll('[data-workflow-set]').forEach((btn) => {
          if (btn.dataset.boundI === 'true') return;
          btn.dataset.boundI = 'true';
          btn.addEventListener('click', () => {
            const next = btn.getAttribute('data-workflow-set');
            setStatus(id, next, { title, section });
            window.dispatchEvent(new CustomEvent('elevate:workflow-updated', { detail: { id, status: next } }));
          });
        });
      });
    }

    NS.workflowMemory = { normalize, pushEvent, setAction, setStatus, getAction, getEvents, getTodaySummary, wireButtons };
    return NS.workflowMemory;
  }

  function statusBadge(status) {
    return `<span class="i-pill ${status || 'open'}">${(status || 'open').replace('_',' ')}</span>`;
  }

  function actionControls(id, title, section, extraLabel, extraSection, extraFocus) {
    const action = NS.workflowMemory.getAction(id, { title, section });
    return `
      <div data-workflow-id="${id}" data-workflow-title="${title}" data-workflow-section="${section}">
        <div style="display:grid;gap:10px;justify-items:end;">
          ${statusBadge(action.status)}
          <div class="i-action-controls">
            <button class="i-mini-btn" type="button" data-workflow-set="in_progress">Start</button>
            <button class="i-mini-btn" type="button" data-workflow-set="done">Done</button>
            <button class="i-mini-btn" type="button" data-workflow-set="snoozed">Snooze</button>
            <button class="i-mini-btn" type="button" data-workflow-set="blocked">Blocked</button>
            ${extraLabel ? `<button class="action-btn" type="button" data-open-section="${extraSection || section}" data-focus-field="${extraFocus || ''}">${extraLabel}</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function buildMasterActions() {
    return [
      {
        id: 'posting.review_readiness',
        title: 'Review posting readiness',
        copy: 'Verify access, compliance, queue, and posting capacity before pushing volume.',
        section: 'extension',
        focus: null
      },
      {
        id: 'listing.resolve_intervention',
        title: 'Resolve listing intervention items',
        copy: 'Clean up weak, stale, or flagged listings before adding more execution pressure.',
        section: 'tools',
        focus: 'listingSearchInput'
      },
      {
        id: 'partner.follow_up',
        title: 'Run one partner follow-up sequence',
        copy: 'The next partner touch should move one user toward paid or reactivation.',
        section: 'affiliate',
        focus: null
      },
      {
        id: 'billing.review_upgrade_logic',
        title: 'Review workflow bottleneck',
        copy: 'Commercial upgrades should follow real friction and real leverage.',
        section: 'billing',
        focus: null
      }
    ];
  }

  function applyOverviewHierarchy() {
    const overview = document.getElementById("overview");
    if (!overview || overview.dataset.phase4HierarchyBuilt === "true") return;
    overview.dataset.phase4HierarchyBuilt = "true";

    ensureStyle();
    const commandGrid = overview.querySelector(".command-center-grid");
    const operatorStrip = overview.querySelector(".operator-strip");
    const overviewChildren = Array.from(overview.children);
    const actionGrid = overviewChildren.find((el) => el.classList?.contains("grid-2"));
    const upgradeCard = overview.querySelector(".upgrade-card");
    const kpiGrid = overviewChildren.find((el) => el.classList?.contains("grid-4"));
    const listingsCard = Array.from(overview.querySelectorAll(".card")).find((card) => card.querySelector("#recentListingsGrid"));
    const bottomGrid = Array.from(overview.querySelectorAll(".grid-2")).find((grid) => grid.querySelector("#snapshotSetupSummary") || grid.querySelector("#setupReadinessSummary"));

    const shell = document.createElement("div");
    shell.className = "phase4-shell";
    shell.innerHTML = `
      <div class="phase4-toolbar">
        <div><span class="phase4-tag">Operator Focus</span></div>
        <div class="phase4-segment" id="phase4OverviewSegment">
          <button type="button" data-mode="core" class="active">Core</button>
          <button type="button" data-mode="listings">Listings</button>
          <button type="button" data-mode="secondary">Secondary</button>
          <button type="button" data-mode="all">All</button>
        </div>
      </div>
    `;

    const core = document.createElement("div");
    core.className = "phase4-group";
    core.dataset.group = "core";

    const listings = document.createElement("div");
    listings.className = "phase4-group";
    listings.dataset.group = "listings";

    const secondary = document.createElement("div");
    secondary.className = "phase4-group i-quiet";
    secondary.dataset.group = "secondary";

    overview.prepend(shell);
    shell.appendChild(core);
    shell.appendChild(listings);
    shell.appendChild(secondary);

    [commandGrid, operatorStrip, actionGrid, kpiGrid].filter(Boolean).forEach((el) => core.appendChild(el));
    [listingsCard].filter(Boolean).forEach((el) => listings.appendChild(el));
    if (upgradeCard) secondary.appendChild(upgradeCard);

    if (bottomGrid) {
      const collapse = document.createElement("div");
      collapse.className = "phase4-collapse";
      collapse.innerHTML = `
        <div class="phase4-collapse-head">
          <div>
            <div class="phase4-tag">Secondary Detail</div>
            <strong>Account Snapshot & Setup Readiness</strong>
          </div>
          <div class="subtext">Expand</div>
        </div>
        <div class="phase4-collapse-body"></div>
      `;
      collapse.querySelector(".phase4-collapse-body").appendChild(bottomGrid);
      collapse.querySelector(".phase4-collapse-head").addEventListener("click", () => {
        collapse.classList.toggle("open");
        const sub = collapse.querySelector(".subtext");
        if (sub) sub.textContent = collapse.classList.contains("open") ? "Collapse" : "Expand";
      });
      secondary.appendChild(collapse);
    }

    const segment = shell.querySelector("#phase4OverviewSegment");
    if (segment) {
      const buttons = Array.from(segment.querySelectorAll("button"));
      const groups = { core: [core], listings: [listings], secondary: [secondary], all: [core, listings, secondary] };
      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          buttons.forEach((b) => b.classList.toggle("active", b === button));
          [core, listings, secondary].forEach((group) => group.classList.add("phase4-hidden"));
          (groups[button.dataset.mode || "all"] || groups.all).forEach((group) => group.classList.remove("phase4-hidden"));
        });
      });
    }
  }

  function renderBundleI() {
    initWorkflowMemory();
    const overview = document.getElementById('overview');
    if (!overview) return;

    let shell = document.getElementById('bundleIMemoryShell');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'bundleIMemoryShell';
      shell.className = 'i-memory-shell';
      overview.prepend(shell);
    }

    const summary = NS.workflowMemory.getTodaySummary();
    const events = NS.workflowMemory.getEvents(6);
    const actions = buildMasterActions();

    let hero = document.getElementById('bundleIMemoryHero');
    if (!hero) {
      hero = document.createElement('div');
      hero.id = 'bundleIMemoryHero';
      hero.className = 'i-memory-hero';
      shell.appendChild(hero);
    }
    hero.innerHTML = `
      <div class="i-memory-hero-grid">
        <div class="i-memory-card">
          <div class="phase4-tag">Real System Memory</div>
          <h2 class="i-memory-title">Workflow state should survive refresh, section changes, and daily return.</h2>
          <div class="i-memory-copy">Bundle I turns action state into durable memory with statuses, recent events, and a visible daily record of completed work.</div>
        </div>
        <div class="i-memory-card"><div class="stat-label">Done Today</div><div class="i-memory-metric">${summary.done}</div><div class="stat-sub">Actions completed and logged.</div></div>
        <div class="i-memory-card"><div class="stat-label">Open</div><div class="i-memory-metric">${summary.open + summary.in_progress}</div><div class="stat-sub">Still active or in motion.</div></div>
        <div class="i-memory-card"><div class="stat-label">Snoozed</div><div class="i-memory-metric">${summary.snoozed}</div><div class="stat-sub">Will return when delay expires.</div></div>
        <div class="i-memory-card"><div class="stat-label">Blocked</div><div class="i-memory-metric">${summary.blocked}</div><div class="stat-sub">Needs another dependency cleared.</div></div>
      </div>
    `;

    let queue = document.getElementById('bundleIMasterQueue');
    if (!queue) {
      queue = document.createElement('div');
      queue.id = 'bundleIMasterQueue';
      queue.className = 'i-memory-card';
      shell.appendChild(queue);
    }
    queue.innerHTML = `
      <div class="section-head">
        <div>
          <div class="phase4-tag">Master Queue</div>
          <h2 style="margin-top:6px;">Persistent workflow actions</h2>
          <div class="subtext">These actions now hold state across refresh and can be marked in progress, done, snoozed, or blocked.</div>
        </div>
      </div>
      <div class="i-queue-list">
        ${actions.map((item) => `
          <div class="i-queue-item">
            <div>
              <strong>${item.title}</strong>
              <div class="i-queue-meta">${item.copy}</div>
            </div>
            ${actionControls(item.id, item.title, item.section, 'Open', item.section, item.focus)}
          </div>
        `).join('')}
      </div>
    `;

    let timeline = document.getElementById('bundleITimeline');
    if (!timeline) {
      timeline = document.createElement('div');
      timeline.id = 'bundleITimeline';
      timeline.className = 'i-memory-card';
      shell.appendChild(timeline);
    }
    timeline.innerHTML = `
      <div class="section-head">
        <div>
          <div class="phase4-tag">Operator Timeline</div>
          <h2 style="margin-top:6px;">Recent workflow history</h2>
          <div class="subtext">A visible event log makes the OS feel durable and trustworthy.</div>
        </div>
      </div>
      <div class="i-timeline-list">
        ${events.length ? events.map((event) => `
          <div class="i-timeline-item">
            <div>
              <strong>${event.title || event.actionId || event.type}</strong>
              <div class="i-timeline-meta">${(event.status || event.type || '').replace(/_/g,' ')} · ${event.section || 'system'}</div>
            </div>
            <div class="i-timeline-meta">${new Date(event.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
          </div>
        `).join('') : `<div class="i-timeline-item"><div><strong>No workflow history yet</strong><div class="i-timeline-meta">Start or complete an action and it will appear here.</div></div></div>`}
      </div>
    `;

    NS.workflowMemory.wireButtons(shell);
    shell.querySelectorAll('[data-open-section]').forEach((button) => {
      if (button.dataset.boundOpenI === 'true') return;
      button.dataset.boundOpenI = 'true';
      button.addEventListener('click', () => {
        const section = button.getAttribute('data-open-section');
        const focusId = button.getAttribute('data-focus-field');
        if (typeof window.showSection === 'function') window.showSection(section);
        if (focusId) {
          setTimeout(() => document.getElementById(focusId)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 220);
        }
      });
    });
  }

  NS.overview = { applyOverviewHierarchy, renderBundleI, initWorkflowMemory };
  NS.modules = NS.modules || {};
  NS.modules.overview = true;

  const boot = () => {
    applyOverviewHierarchy();
    renderBundleI();
    setTimeout(() => { applyOverviewHierarchy(); renderBundleI(); }, 1200);
    setTimeout(() => { applyOverviewHierarchy(); renderBundleI(); }, 3200);
  };

  window.addEventListener('elevate:workflow-updated', () => renderBundleI());

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
