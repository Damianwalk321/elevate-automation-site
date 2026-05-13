(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.overview) return;

  const STYLE_ID = 'elevate-operator-command-centre-v6';
  const CSS = `
    .ea-ops-shell{display:grid;gap:18px}
    .ea-ops-card{background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0));border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:var(--shadow)}
    .ea-ops-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:1.4px;color:var(--gold);font-weight:800;margin-bottom:14px}
    .ea-ops-header,.ea-ops-primary,.ea-ops-grid{display:grid;gap:18px}
    .ea-ops-header{grid-template-columns:minmax(0,1.18fr) minmax(360px,.82fr)}
    .ea-ops-primary{grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr)}
    .ea-ops-grid{grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr)}
    .ea-ops-title{margin:0 0 10px;font-size:30px;line-height:1.02;font-weight:900;color:var(--text)}
    .ea-ops-subtitle{margin:0;font-size:14px;line-height:1.65;color:var(--muted)}
    .ea-ops-chip-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
    .ea-ops-chip{display:inline-flex;align-items:center;gap:10px;min-height:38px;padding:0 14px;border-radius:999px;background:#151515;border:1px solid rgba(255,255,255,.07);font-size:12px;font-weight:800;color:#f0f0f0}
    .ea-ops-chip.plan-pro{background:rgba(212,175,55,.12);border-color:rgba(212,175,55,.26);color:#f5e3a1}
    .ea-ops-chip.plan-starter{background:rgba(76,139,245,.12);border-color:rgba(76,139,245,.26);color:#b9d4ff}
    .ea-ops-dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex:0 0 9px;background:#676767}
    .ea-ops-dot.good{background:#6CFF91;box-shadow:0 0 10px rgba(108,255,145,.32)}
    .ea-ops-dot.bad{background:#FF6B6B;box-shadow:0 0 10px rgba(255,107,107,.26)}
    .ea-ops-dot.warn{background:#FFD76A;box-shadow:0 0 10px rgba(255,215,106,.22)}
    .ea-ops-stat-grid,.ea-ops-health-grid,.ea-ops-kpis,.ea-ops-list,.ea-ops-targets,.ea-ops-primary-meta{display:grid;gap:12px}
    .ea-ops-stat-grid,.ea-ops-health-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    .ea-ops-kpis{grid-template-columns:repeat(6,minmax(0,1fr))}
    .ea-ops-primary-meta{grid-template-columns:repeat(3,minmax(0,1fr));margin:0 0 18px}
    .ea-ops-stat,.ea-ops-kpi,.ea-ops-health-item,.ea-ops-row,.ea-ops-warning,.ea-ops-empty,.ea-ops-meta-item{padding:14px 16px;border-radius:14px;background:#141414;border:1px solid rgba(255,255,255,.06)}
    .ea-ops-label{font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:var(--gold);font-weight:800}
    .ea-ops-value{margin-top:8px;font-size:24px;line-height:1.05;font-weight:900;color:var(--text)}
    .ea-ops-copy{margin-top:8px;font-size:12px;line-height:1.55;color:var(--muted)}
    .ea-ops-primary-title{margin:0 0 10px;font-size:24px;line-height:1.1;font-weight:900;color:var(--text)}
    .ea-ops-primary-copy{margin:0 0 14px;font-size:14px;line-height:1.7;color:#ddd}
    .ea-ops-primary-note{margin:0 0 18px;font-size:12px;line-height:1.55;color:var(--muted)}
    .ea-ops-meta-item strong{display:block;font-size:11px;text-transform:uppercase;letter-spacing:1.05px;color:var(--gold);font-weight:800}
    .ea-ops-meta-item span{display:block;margin-top:8px;font-size:14px;line-height:1.4;color:var(--text);font-weight:800}
    .ea-ops-btn-row{display:flex;flex-wrap:wrap;gap:10px}
    .ea-ops-btn{appearance:none;border:1px solid rgba(255,255,255,.08);background:#191919;color:#f2f2f2;border-radius:12px;padding:12px 14px;font-size:13px;font-weight:800;cursor:pointer;transition:.18s ease}
    .ea-ops-btn:hover{border-color:rgba(212,175,55,.22);background:#202020}
    .ea-ops-btn.is-primary{background:var(--gold);color:#111;border-color:var(--gold)}
    .ea-ops-target{display:flex;justify-content:space-between;gap:12px;align-items:center}
    .ea-ops-target strong,.ea-ops-row strong,.ea-ops-warning strong{display:block;font-size:14px;line-height:1.3;color:var(--text)}
    .ea-ops-target span,.ea-ops-row span,.ea-ops-warning span{display:block;margin-top:4px;font-size:12px;line-height:1.5;color:var(--muted)}
    .ea-ops-target-value{font-size:20px;font-weight:900;color:var(--text)}
    .ea-ops-queue{display:grid;grid-template-columns:minmax(0,1fr) 72px 164px 164px;gap:14px;align-items:center;min-height:108px}
    .ea-ops-queue-copy{display:grid;gap:4px;max-width:340px;align-content:center}
    .ea-ops-pill{display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:#171717;border:1px solid rgba(255,255,255,.08);font-size:13px;font-weight:900;color:#f1f1f1;justify-self:center;padding:0;line-height:1}
    .ea-ops-row-btn{width:100%;height:44px;display:flex;align-items:center;justify-content:center;text-align:center}
    .ea-ops-outcome{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
    .ea-ops-health-item{min-height:96px;display:grid;align-content:start;gap:8px}
    .ea-ops-health-head{display:flex;align-items:center;gap:8px;font-size:13px;line-height:1.35;color:var(--text);font-weight:800}
    .ea-ops-health-state{font-size:22px;line-height:1;font-weight:900;color:var(--text)}
    .ea-ops-health-sub{font-size:12px;line-height:1.35;color:var(--muted)}
    .ea-ops-empty{font-size:13px;line-height:1.6;color:var(--muted)}
    @media (max-width:1220px){.ea-ops-header,.ea-ops-primary,.ea-ops-grid{grid-template-columns:1fr}.ea-ops-kpis,.ea-ops-primary-meta{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media (max-width:860px){.ea-ops-stat-grid,.ea-ops-health-grid,.ea-ops-kpis,.ea-ops-primary-meta{grid-template-columns:1fr}.ea-ops-queue{grid-template-columns:1fr}.ea-ops-pill{justify-self:start}.ea-ops-row-btn{height:42px}.ea-ops-queue-copy{max-width:none}}
  `;

  const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
  const num = (v) => { const n = Number(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const titleCase = (v) => clean(v).replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
  const summaryData = () => { const d = window.dashboardSummary || NS.state?.get?.('summary_v2', {}) || {}; return d?.data || d || {}; };
  const injectStyle = () => { if (document.getElementById(STYLE_ID)) return; const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s); };
  const humanizeStatus = (v) => { const x = clean(v).toLowerCase(); if (!x) return 'Live'; if (x.includes('attention')) return 'Attention'; if (x.includes('review')) return 'Review'; if (x.includes('active')) return 'Live'; return titleCase(x); };

  function stateDot(value, warnMode = false) {
    if (warnMode) return 'warn';
    const x = clean(value).toLowerCase();
    if (x === 'ready' || x === 'valid' || x === 'recorded' || x === 'available') return 'good';
    if (x === 'blocked' || x === 'check' || x === 'used up') return 'bad';
    if (x === 'loaded') return 'warn';
    return 'good';
  }

  function updateOverviewHeader(mode) {
    const h = document.querySelector('.main-header h1');
    const w = document.getElementById('welcomeText');
    if (h) h.textContent = mode === 'operator' ? 'Operator Command Centre' : 'Activation Command Centre';
    if (w) w.textContent = '';
  }

  function resolveAction(action, fallbackSection) {
    const a = clean(action).toLowerCase();
    if (!a) return { type:'section', value:fallbackSection };
    if (a === 'refresh_sync' || a === 'refresh-access') return { type:'refresh', value:'refresh-access' };
    const map = { open_tools:'tools', post_next:'tools', open_analytics:'analytics', open_review_queue:'analytics', open_compliance:'compliance', open_setup:'setup' };
    return { type:'section', value:map[a] || fallbackSection };
  }

  function planStyle(plan) {
    const x = clean(plan).toLowerCase();
    if (x.includes('pro')) return 'plan-pro';
    return 'plan-starter';
  }

  function metrics() {
    const data = summaryData();
    const c = data.command_center || {};
    const k = c.kpis || {};
    const q = c.work_queues || {};
    const s = data.setup_status || {};
    const recent = Array.isArray(data.recent_listings) ? data.recent_listings : [];
    const latest = recent[0] || null;
    return {
      data,
      mode: clean(data.dashboard_mode).toLowerCase() === 'operator' ? 'operator' : 'activation',
      operatorName: clean(data.profile_snapshot?.salesperson_name || data.profile_snapshot?.full_name || 'Operator'),
      dealership: clean(data.profile_snapshot?.dealership || data.profile_snapshot?.dealer_name || 'Elevate Workspace'),
      plan: clean(data.plan_access?.plan_label || data.account_snapshot?.plan || 'Founder Beta'),
      accessGranted: Boolean(data.account_snapshot?.access_granted),
      accessLabel: Boolean(data.account_snapshot?.access_granted) ? 'Access Active' : titleCase(data.account_snapshot?.status || 'Needs Attention'),
      postingReady: Boolean(data.can_post),
      complianceReady: Boolean(s.compliance_mode_present),
      profileReady: Boolean(s.profile_complete),
      firstPostComplete: Boolean(s.first_post_complete),
      setupScore: num(data.activation_score),
      postingLimit: num(data.effective_posting_limit ?? data.daily_limit),
      active: num(k.active_listings ?? data.active_listings),
      postedToday: num(k.posted_today ?? data.posts_today),
      remainingToday: num(k.remaining_today ?? data.posts_remaining),
      review: num(k.in_review ?? data.review_queue_count),
      needsAction: num(k.needs_action ?? data.needs_action_count),
      atRisk: num(k.at_risk ?? data.weak_listings),
      queue: num(q.ready_to_post ?? data.queue_count),
      staleReview: num(q.stale_review ?? data.review_delete_count),
      complianceBlocked: Boolean(s.compliance_mode_present) ? 0 : 1,
      lastOutcomeLabel: latest ? 'Recorded' : 'No Data',
      lastOutcomeCopy: latest ? `${clean(latest.title || 'Listing')} • ${num(latest.views_count)} views • ${num(latest.messages_count)} messages` : 'No recent successful post recorded yet.'
    };
  }

  function buildWarnings(data) {
    const s = data.setup_status || {};
    const out = [];
    if (!s.compliance_mode_present) out.push(['Compliance mode missing','Set the correct province/compliance profile before trusting unattended posting.']);
    if (!s.dealer_website_present) out.push(['Dealer website missing','Dealer website is still missing from the profile surface.']);
    if (!s.listing_location_present) out.push(['Listing location missing','Listing location is not yet locked into the current workspace.']);
    if (!s.scanner_type_present) out.push(['Scanner type missing','Scanner type should be defined so readiness remains stable across sessions.']);
    return out.slice(0, 4);
  }

  function resolvePrimaryCommand(m) {
    if (m.complianceBlocked > 0) return {
      title:'Resolve compliance blockers before posting',
      message:'The machine is not safe to push until compliance readiness is restored.',
      note:'Why now: safe posting is blocked until compliance is complete.',
      meta:[['Impact','Posting blocked'],['Live load',`${m.review + m.needsAction} open items`],['If ignored','Trust drops before next cycle']],
      primary_action:'open_compliance', secondary_action:'refresh-access', primary_label:'Open Compliance', secondary_label:'Refresh'
    };
    if (m.review > 0) return {
      title:`Clear ${m.review} listings from review queue`,
      message:'Reduce review pressure before adding more output.',
      note:'Why now: review queue is the highest-priority live workload on the machine.',
      meta:[['Impact',`${m.review} in review`],['Live load',`${m.review + m.needsAction} total pressure`],['If ignored','Backlog continues building']],
      primary_action:'open_review_queue', secondary_action:'refresh-access', primary_label:'Open Analytics', secondary_label:'Refresh'
    };
    if (m.needsAction > 0) return {
      title:`Resolve ${m.needsAction} listings needing action`,
      message:'Listings need direct correction before the machine can be fully trusted.',
      note:'Why now: listings requiring action are affecting system trust and output quality.',
      meta:[['Impact',`${m.needsAction} affected`],['Live load',`${m.review + m.needsAction} total pressure`],['If ignored','Quality risk stays live']],
      primary_action:'open_analytics', secondary_action:'open_compliance', primary_label:'Open Analytics', secondary_label:'Open Compliance'
    };
    if (m.staleReview > 0) return {
      title:`Review ${m.staleReview} stale or removed listings`,
      message:'Clear stale inventory pressure so the machine stays accurate.',
      note:'Why now: stale inventory weakens operator trust and listing accuracy.',
      meta:[['Impact',`${m.staleReview} stale items`],['Live load','Inventory accuracy'],['If ignored','Old inventory stays live']],
      primary_action:'open_analytics', secondary_action:'open_tools', primary_label:'Open Analytics', secondary_label:'Open Tools'
    };
    if (m.queue > 0 && m.postingReady) return {
      title:`Run the next posting cycle for ${m.queue} queued vehicles`,
      message:'The machine is ready. Push the next cycle while maintaining listing quality.',
      note:'Why now: queue is prepared and the machine is currently safe to operate.',
      meta:[['Impact',`${m.queue} queued`],['Live load','Machine clear'],['If ignored','Output stays idle']],
      primary_action:'open_tools', secondary_action:'open_analytics', primary_label:'Open Tools', secondary_label:'Open Analytics'
    };
    return {
      title:'Machine is clear. Maintain operator rhythm.',
      message:'No major blockers are on the surface right now.',
      note:'Why now: machine trust is stable and no major live queue pressure is blocking output.',
      meta:[['Impact','No blockers'],['Live load',`${m.review + m.needsAction} open items`],['If ignored','Momentum slows']],
      primary_action:'open_tools', secondary_action:'open_analytics', primary_label:'Open Tools', secondary_label:'Open Analytics'
    };
  }

  function buildTargets(m) {
    return [
      ['Posts used today', m.postingLimit > 0 ? `${m.postedToday} of ${m.postingLimit} posting slots used.` : `${m.postedToday} posts used today.`, `${m.postedToday}/${m.postingLimit || 0}`],
      ['Review pressure', `${m.review + m.needsAction} open review and action items are currently on the surface.`, String(m.review + m.needsAction)],
      ['Backlog remaining', `${m.staleReview + m.complianceBlocked} stale or compliance blockers still need attention.`, String(m.staleReview + m.complianceBlocked)]
    ];
  }

  function buildQueue(m) {
    return [
      { title:'Compliance blocked', count:m.complianceBlocked, copy:'Posting is blocked by missing compliance readiness or required setup.', primary:['Open Compliance','open_compliance'], secondary:['Refresh','refresh-access'] },
      { title:'Review queue', count:m.review, copy:'Listings are waiting in review and need operator clearing.', primary:['Open Analytics','open_review_queue'], secondary:['Refresh','refresh-access'] },
      { title:'Needs action', count:m.needsAction, copy:'Listings have price, content, or lifecycle issues needing direct action.', primary:['Open Analytics','open_analytics'], secondary:['Open Compliance','open_compliance'] },
      { title:'Stale or removed review', count:m.staleReview, copy:'Listings flagged as stale or removed are waiting for operator review.', primary:['Open Analytics','open_analytics'], secondary:['Open Tools','open_tools'] },
      { title:'Queue ready', count:m.queue, copy:'Vehicles are ready for the next posting cycle.', primary:['Open Tools','open_tools'], secondary:['Open Analytics','open_analytics'] }
    ].filter((i) => i.count > 0).slice(0, 5);
  }

  function buildHealth(m) {
    return [
      { title:'Posting ready', value:m.postingReady ? 'Ready' : 'Blocked', sub:m.postingReady ? 'Safe to post' : 'Hold posting' },
      { title:'Session state', value:m.accessGranted ? 'Valid' : 'Check', sub:m.accessGranted ? 'Access active' : 'Refresh required' },
      { title:'Compliance engine', value:m.complianceReady ? 'Ready' : 'Blocked', sub:m.complianceReady ? 'Profile loaded' : 'Profile missing' },
      { title:'Queue pressure', value:m.review + m.needsAction > 0 ? 'Loaded' : (m.queue > 0 ? 'Ready' : 'Clear'), sub:m.review + m.needsAction > 0 ? `${m.review + m.needsAction} live items` : (m.queue > 0 ? `${m.queue} queued` : 'No pressure') },
      { title:'Last successful post', value:m.lastOutcomeLabel, sub:m.lastOutcomeLabel === 'Recorded' ? 'Recent result logged' : 'No recent result' },
      { title:'Plan capacity', value:m.remainingToday > 0 ? 'Available' : 'Used Up', sub:m.postingLimit > 0 ? `${m.postedToday}/${m.postingLimit} used` : 'Plan limit unknown' }
    ];
  }

  function buildOutcomes(data) {
    const recent = Array.isArray(data.recent_listings) ? data.recent_listings : [];
    return recent.slice(0, 4).map((i) => ({
      title: clean(i.title || 'Listing'),
      copy: i.price_resolved === false ? 'Price needs review before this listing should be trusted.' : `${num(i.views_count)} views • ${num(i.messages_count)} messages`,
      pill: humanizeStatus(i.lifecycle_status || i.status || 'live')
    }));
  }

  function actionAttrs(action, fallbackSection) {
    const resolved = resolveAction(action, fallbackSection);
    return resolved.type === 'refresh' ? `data-ea-action="refresh-access"` : `data-open-section="${resolved.value}"`;
  }

  function render() {
    const m = metrics();
    const warnings = buildWarnings(m.data);
    const primary = resolvePrimaryCommand(m);
    const queue = buildQueue(m);
    const health = buildHealth(m);
    const outcomes = buildOutcomes(m.data);
    updateOverviewHeader(m.mode);

    const header = `
      <div class="ea-ops-header">
        <div class="ea-ops-card">
          <div class="ea-ops-eyebrow">Operator</div>
          <h2 class="ea-ops-title">${m.operatorName}</h2>
          <p class="ea-ops-subtitle">${m.dealership} • ${m.mode === 'operator' ? 'Operator mode active' : 'Activation mode active'}</p>
          <div class="ea-ops-chip-row">
            <span class="ea-ops-chip ${planStyle(m.plan)}"><span class="ea-ops-dot"></span>${m.plan}</span>
            <span class="ea-ops-chip"><span class="ea-ops-dot ${m.postingReady ? 'good' : 'bad'}"></span>${m.postingReady ? 'Posting Ready' : 'Posting Blocked'}</span>
            <span class="ea-ops-chip"><span class="ea-ops-dot ${m.accessGranted ? 'good' : 'bad'}"></span>${m.accessLabel}</span>
            <span class="ea-ops-chip"><span class="ea-ops-dot ${m.complianceReady ? 'good' : 'bad'}"></span>${m.complianceReady ? 'Compliance Ready' : 'Compliance Blocked'}</span>
          </div>
        </div>
        <div class="ea-ops-stat-grid">
          <div class="ea-ops-stat"><div class="ea-ops-label">Posts Remaining</div><div class="ea-ops-value">${m.remainingToday}</div><div class="ea-ops-copy">${m.postingLimit > 0 ? `${m.postedToday} of ${m.postingLimit} used today.` : 'Current plan usage.'}</div></div>
          <div class="ea-ops-stat"><div class="ea-ops-label">Priority Load</div><div class="ea-ops-value">${m.review + m.needsAction}</div><div class="ea-ops-copy">Open review plus action items currently on the surface.</div></div>
          <div class="ea-ops-stat"><div class="ea-ops-label">Queue Ready</div><div class="ea-ops-value">${m.queue}</div><div class="ea-ops-copy">Vehicles prepared for the next posting cycle.</div></div>
          <div class="ea-ops-stat"><div class="ea-ops-label">Stale Review</div><div class="ea-ops-value">${m.staleReview}</div><div class="ea-ops-copy">Listings flagged for stale or removed review.</div></div>
        </div>
      </div>`;

    const primaryBlock = `
      <div class="ea-ops-primary">
        <div class="ea-ops-card">
          <div class="ea-ops-eyebrow">Primary Command</div>
          <h3 class="ea-ops-primary-title">${primary.title}</h3>
          <p class="ea-ops-primary-copy">${primary.message}</p>
          <p class="ea-ops-primary-note">${primary.note}</p>
          <div class="ea-ops-primary-meta">${primary.meta.map((item) => `<div class="ea-ops-meta-item"><strong>${item[0]}</strong><span>${item[1]}</span></div>`).join('')}</div>
          <div class="ea-ops-btn-row">
            <button class="ea-ops-btn is-primary" type="button" ${actionAttrs(primary.primary_action, 'tools')}>${primary.primary_label}</button>
            <button class="ea-ops-btn" type="button" ${actionAttrs(primary.secondary_action, 'analytics')}>${primary.secondary_label}</button>
          </div>
        </div>
        <div class="ea-ops-card">
          <div class="ea-ops-eyebrow">Today’s Target</div>
          <div class="ea-ops-targets">${buildTargets(m).map((i) => `<div class="ea-ops-target ea-ops-row"><div><strong>${i[0]}</strong><span>${i[1]}</span></div><div class="ea-ops-target-value">${i[2]}</div></div>`).join('')}</div>
        </div>
      </div>`;

    const kpis = `<div class="ea-ops-kpis">${[
      ['Active Listings',m.active,'Current live portfolio count.'],
      ['In Review',m.review,'Listings waiting in review.'],
      ['Needs Action',m.needsAction,'Listings requiring direct operator action.'],
      ['Queued',m.queue,'Vehicles ready for the next cycle.'],
      ['Posted Today',m.postedToday,'Units pushed today.'],
      ['Remaining Today',m.remainingToday,'Posting capacity still available.']
    ].map((i) => `<div class="ea-ops-kpi"><div class="ea-ops-label">${i[0]}</div><div class="ea-ops-value">${i[1]}</div><div class="ea-ops-copy">${i[2]}</div></div>`).join('')}</div>`;

    const actionQueue = `
      <div class="ea-ops-card">
        <div class="ea-ops-eyebrow">Action Queue</div>
        <div class="ea-ops-list">
          ${queue.length ? queue.map((i) => `<div class="ea-ops-queue ea-ops-row"><div class="ea-ops-queue-copy"><strong>${i.title}</strong><span>${i.copy}</span></div><div class="ea-ops-pill">${i.count}</div><button class="ea-ops-btn is-primary ea-ops-row-btn" type="button" ${actionAttrs(i.primary[1], 'analytics')}>${i.primary[0]}</button><button class="ea-ops-btn ea-ops-row-btn" type="button" ${actionAttrs(i.secondary[1], 'tools')}>${i.secondary[0]}</button></div>`).join('') : `<div class="ea-ops-empty">No active queue pressure right now. The machine is currently clear.</div>`}
        </div>
      </div>`;

    const healthBlock = `
      <div class="ea-ops-card">
        <div class="ea-ops-eyebrow">Machine Health</div>
        <div class="ea-ops-health-grid">${health.map((i) => `<div class="ea-ops-health-item"><div class="ea-ops-health-head"><span class="ea-ops-dot ${stateDot(i.value, i.title === 'Queue pressure' && i.value === 'Loaded')}"></span>${i.title}</div><div class="ea-ops-health-state">${i.value}</div><div class="ea-ops-health-sub">${i.sub}</div></div>`).join('')}</div>
        <div class="ea-ops-eyebrow" style="margin-top:16px">Warnings</div>
        <div class="ea-ops-list">${warnings.length ? warnings.map((i) => `<div class="ea-ops-warning"><strong>${i[0]}</strong><span>${i[1]}</span></div>`).join('') : `<div class="ea-ops-empty">No warnings are currently forcing attention.</div>`}</div>
      </div>`;

    const activation = `
      <div class="ea-ops-grid">
        <div class="ea-ops-card">
          <div class="ea-ops-eyebrow">Readiness</div>
          <div class="ea-ops-list">
            <div class="ea-ops-row"><div><strong>Profile</strong><span>Complete the required operator profile fields.</span></div><div class="ea-ops-target-value">${m.profileReady ? 'Ready' : 'Open'}</div></div>
            <div class="ea-ops-row"><div><strong>Compliance</strong><span>Set the correct province and compliance mode.</span></div><div class="ea-ops-target-value">${m.complianceReady ? 'Ready' : 'Open'}</div></div>
            <div class="ea-ops-row"><div><strong>First post</strong><span>Complete one clean posting cycle to qualify into operator mode.</span></div><div class="ea-ops-target-value">${m.firstPostComplete ? 'Done' : 'Pending'}</div></div>
            <div class="ea-ops-row"><div><strong>Activation score</strong><span>Current setup progress toward operator qualification.</span></div><div class="ea-ops-target-value">${m.setupScore}%</div></div>
          </div>
        </div>
        ${healthBlock}
      </div>`;

    const operator = `
      ${kpis}
      <div class="ea-ops-grid">${actionQueue}${healthBlock}</div>
      <div class="ea-ops-card"><div class="ea-ops-eyebrow">Recent Outcomes</div><div class="ea-ops-list">${outcomes.length ? outcomes.map((i) => `<div class="ea-ops-outcome ea-ops-row"><div><strong>${i.title}</strong><span>${i.copy}</span></div><div class="ea-ops-pill">${i.pill}</div></div>`).join('') : `<div class="ea-ops-empty">No recent outcomes are available yet.</div>`}</div></div>`;

    return `<div class="ea-ops-shell" data-command-centre-mode="${m.mode}">${header}${primaryBlock}${m.mode === 'operator' ? operator : activation}</div>`;
  }

  function goToSection(section) {
    if (!section) return;
    if (typeof window.showSection === 'function') {
      window.showSection(section, { scroll: false });
      return;
    }
    const target = document.getElementById(section);
    if (!target) return;
    document.querySelectorAll('.dashboard-section').forEach((el) => { el.style.display = 'none'; });
    target.style.display = 'block';
    target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function bind(root) {
    root.querySelectorAll('[data-open-section]').forEach((b) => {
      if (b.dataset.eaBound === 'true') return;
      b.dataset.eaBound = 'true';
      b.addEventListener('click', () => goToSection(b.getAttribute('data-open-section')));
    });
    root.querySelectorAll('[data-ea-action="refresh-access"]').forEach((b) => {
      if (b.dataset.eaBound === 'true') return;
      b.dataset.eaBound = 'true';
      b.addEventListener('click', async () => {
        try {
          if (typeof NS.api?.refreshAccess === 'function') await NS.api.refreshAccess();
          else if (typeof window.refreshAccess === 'function') await window.refreshAccess();
          else renderCommandCentre();
        } catch {}
      });
    });
  }

  function renderCommandCentre() {
    const overview = document.getElementById('overview');
    if (!overview) return;
    injectStyle();
    overview.innerHTML = render();
    bind(overview);
  }

  function boot() {
    renderCommandCentre();
    setTimeout(renderCommandCentre, 160);
  }

  window.addEventListener('elevate:summary-ready', renderCommandCentre);
  document.addEventListener('DOMContentLoaded', boot);
  NS.overview = { renderCommandCentre, goToSection };
  NS.modules = NS.modules || {};
  NS.modules.overview = true;
})();