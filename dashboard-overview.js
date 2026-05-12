(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.overview) return;

  const CSS = `
    .ea-cc-shell{display:grid;gap:18px}
    .ea-cc-card{background:linear-gradient(180deg,rgba(255,255,255,.022),rgba(255,255,255,0));border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:var(--shadow)}
    .ea-cc-card-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:1.25px;color:var(--gold);font-weight:800;margin-bottom:12px}
    .ea-cc-header{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(340px,.85fr);gap:18px;align-items:stretch}
    .ea-cc-title{font-size:30px;line-height:1.02;font-weight:900;color:var(--text);margin:0 0 10px}
    .ea-cc-subtitle{font-size:14px;line-height:1.65;color:var(--muted);margin:0}
    .ea-cc-head-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
    .ea-cc-chip{display:inline-flex;align-items:center;gap:8px;padding:9px 12px;border-radius:999px;background:#161616;border:1px solid rgba(255,255,255,.07);font-size:12px;font-weight:700;color:#f1f1f1}
    .ea-cc-chip.is-good{border-color:rgba(212,175,55,.18)}
    .ea-cc-chip.is-warn{border-color:rgba(255,255,255,.12);color:#ffd97a}
    .ea-cc-chip.is-bad{border-color:rgba(255,255,255,.12);color:#ffb2b2}
    .ea-cc-chip-dot{width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.9}
    .ea-cc-head-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .ea-cc-head-stat{padding:16px;border-radius:16px;background:#141414;border:1px solid rgba(255,255,255,.06)}
    .ea-cc-head-stat-label{font-size:11px;text-transform:uppercase;letter-spacing:1.15px;color:var(--gold);font-weight:800}
    .ea-cc-head-stat-value{margin-top:8px;font-size:24px;line-height:1.05;font-weight:900;color:var(--text)}
    .ea-cc-head-stat-copy{margin-top:8px;font-size:12px;line-height:1.5;color:var(--muted)}
    .ea-cc-primary{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);gap:18px;align-items:stretch}
    .ea-cc-primary-title{font-size:21px;line-height:1.15;font-weight:900;color:var(--text);margin:0 0 12px}
    .ea-cc-primary-copy{font-size:14px;line-height:1.7;color:#d8d8d8;margin:0 0 18px}
    .ea-cc-note{padding:14px 16px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.06);font-size:13px;line-height:1.6;color:#d8d8d8}
    .ea-cc-cta-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
    .ea-cc-btn{appearance:none;border:1px solid rgba(255,255,255,.08);background:#191919;color:#f3f3f3;border-radius:12px;padding:11px 14px;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap}
    .ea-cc-btn:hover{border-color:rgba(212,175,55,.22);background:#202020}
    .ea-cc-btn.is-primary{background:#d4af37;color:#111;border-color:#d4af37}
    .ea-cc-btn.is-primary:hover{filter:brightness(.98)}
    .ea-cc-targets{display:grid;gap:12px}
    .ea-cc-target-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;border-radius:14px;background:#141414;border:1px solid rgba(255,255,255,.06)}
    .ea-cc-target-row strong{display:block;font-size:14px;line-height:1.3;color:var(--text)}
    .ea-cc-target-row span{display:block;margin-top:4px;font-size:12px;line-height:1.5;color:var(--muted)}
    .ea-cc-target-value{font-size:20px;line-height:1;font-weight:900;color:var(--text)}
    .ea-cc-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px}
    .ea-cc-kpi{padding:16px;border-radius:16px;background:#141414;border:1px solid rgba(255,255,255,.06)}
    .ea-cc-kpi-label{font-size:11px;text-transform:uppercase;letter-spacing:1.15px;color:var(--gold);font-weight:800}
    .ea-cc-kpi-value{margin-top:8px;font-size:24px;line-height:1.02;font-weight:900;color:var(--text)}
    .ea-cc-kpi-copy{margin-top:8px;font-size:12px;line-height:1.5;color:var(--muted)}
    .ea-cc-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);gap:18px;align-items:start}
    .ea-cc-list{display:grid;gap:12px}
    .ea-cc-queue-row,.ea-cc-event-row,.ea-cc-warning-row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px 16px;border-radius:14px;background:#141414;border:1px solid rgba(255,255,255,.06)}
    .ea-cc-queue-copy strong,.ea-cc-event-copy strong,.ea-cc-warning-copy strong{display:block;font-size:14px;line-height:1.35;color:var(--text)}
    .ea-cc-queue-copy span,.ea-cc-event-copy span,.ea-cc-warning-copy span{display:block;margin-top:5px;font-size:12px;line-height:1.55;color:var(--muted)}
    .ea-cc-queue-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .ea-cc-pill{display:inline-flex;align-items:center;justify-content:center;min-width:38px;padding:8px 10px;border-radius:999px;background:#191919;border:1px solid rgba(255,255,255,.07);font-size:12px;font-weight:900;color:#f1f1f1}
    .ea-cc-health{display:grid;gap:12px}
    .ea-cc-health-badges{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .ea-cc-health-badge{padding:14px;border-radius:14px;background:#141414;border:1px solid rgba(255,255,255,.06)}
    .ea-cc-health-badge strong{display:flex;align-items:center;gap:8px;font-size:13px;line-height:1.3;color:var(--text)}
    .ea-cc-health-badge span{display:block;margin-top:6px;font-size:12px;line-height:1.5;color:var(--muted)}
    .ea-cc-warning-list{display:grid;gap:10px}
    .ea-cc-warning-row{border-color:rgba(212,175,55,.16)}
    .ea-cc-warning-empty,.ea-cc-empty{padding:14px 16px;border-radius:14px;background:#141414;border:1px solid rgba(255,255,255,.06);font-size:13px;line-height:1.6;color:var(--muted)}
    @media (max-width: 1220px){.ea-cc-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.ea-cc-header,.ea-cc-primary,.ea-cc-grid{grid-template-columns:1fr}}
    @media (max-width: 760px){.ea-cc-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.ea-cc-head-stats,.ea-cc-health-badges{grid-template-columns:1fr}.ea-cc-queue-row,.ea-cc-event-row,.ea-cc-warning-row,.ea-cc-target-row{flex-direction:column}.ea-cc-queue-actions{justify-content:flex-start}.ea-cc-btn{width:100%}}
  `;

  function injectStyle() {
    if (document.getElementById('elevate-command-centre-bundle4')) return;
    const style = document.createElement('style');
    style.id = 'elevate-command-centre-bundle4';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function num(value) {
    const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function summaryData() {
    const data = window.dashboardSummary || NS.state?.get?.('summary_v2', {}) || {};
    return data?.data || data || {};
  }

  function updateOverviewHeader(mode) {
    const heading = document.querySelector('.main-header h1');
    const welcome = document.getElementById('welcomeText');
    if (heading) heading.textContent = mode === 'operator' ? 'Operator Command Centre' : 'Activation Command Centre';
    if (welcome) {
      welcome.textContent = mode === 'operator'
        ? 'Run the machine. Protect the machine. Increase output.'
        : 'Complete setup, get live, and unlock operator mode.';
    }
  }

  function provinceFromSummary(data) {
    const candidates = [
      data?.profile_snapshot?.compliance_mode,
      data?.profile_snapshot?.province,
      data?.account_snapshot?.compliance_mode,
      data?.account_snapshot?.province
    ].map(clean).filter(Boolean);
    const direct = candidates.find((value) => /^(AB|BC|ALBERTA|BRITISH COLUMBIA)$/i.test(value));
    if (!direct) return 'Needs Review';
    if (/ALBERTA/i.test(direct)) return 'AB';
    if (/BRITISH COLUMBIA/i.test(direct)) return 'BC';
    return direct.toUpperCase();
  }

  function buildWarnings(data) {
    const setup = data.setup_status || {};
    const warnings = [];
    if (!setup.compliance_mode_present) {
      warnings.push({ title: 'Compliance profile incomplete', copy: 'Set the correct province/compliance mode before trusting fully automated posting.' });
    }
    if (!setup.dealer_website_present) {
      warnings.push({ title: 'Dealer website missing', copy: 'Dealer website is still missing from the setup profile.' });
    }
    if (!setup.listing_location_present) {
      warnings.push({ title: 'Listing location missing', copy: 'Listing location is not set in the current profile.' });
    }
    if (!setup.scanner_type_present) {
      warnings.push({ title: 'Scanner type missing', copy: 'Scanner type should be set so operator readiness remains stable.' });
    }
    return warnings.slice(0, 4);
  }

  function buildRecentOutcomes(data) {
    const events = [];
    const recentListings = Array.isArray(data.recent_listings) ? data.recent_listings : [];
    const details = data.action_center_details || {};
    const detailItems = [
      ...(Array.isArray(details.needs_attention) ? details.needs_attention : []),
      ...(Array.isArray(details.opportunities) ? details.opportunities : []),
      ...(Array.isArray(details.today) ? details.today : [])
    ];

    recentListings.slice(0, 4).forEach((item) => {
      const title = clean(item.title || 'Listing');
      const status = clean(item.lifecycle_status || item.status || 'active');
      const copy = item.price_resolved === false
        ? 'Price needs review before this row should be trusted.'
        : `${num(item.views_count)} views • ${num(item.messages_count)} messages`;
      events.push({ title, copy, pill: status.replace(/_/g, ' ') || 'live' });
    });

    detailItems.slice(0, 3).forEach((item) => {
      events.push({
        title: clean(item.title || 'Action item'),
        copy: clean(item.reason || item.recommended_action || 'Operator review recorded.'),
        pill: clean(item.priority || item.action_type || 'review').replace(/_/g, ' ')
      });
    });

    return events.slice(0, 6);
  }

  function buildTargets(m) {
    return [
      {
        label: 'Posts used today',
        copy: m.postingLimit > 0 ? `${m.postedToday} of ${m.postingLimit} posting slots used.` : `${m.postedToday} posts used today.`,
        value: `${m.postedToday}/${m.postingLimit || 0}`
      },
      {
        label: 'Review pressure',
        copy: `${m.review + m.needsAction} total review and action items currently open.`,
        value: String(m.review + m.needsAction)
      },
      {
        label: 'Backlog remaining',
        copy: `${m.staleReview + m.complianceBlocked} stale/compliance blockers still need attention.`,
        value: String(m.staleReview + m.complianceBlocked)
      }
    ];
  }

  function buildActionQueue(m) {
    const items = [
      {
        key: 'compliance_blocked',
        title: 'Compliance blocked',
        count: m.complianceBlocked,
        copy: 'Listings blocked by missing compliance readiness or publish requirements.',
        primary: { label: 'Open Compliance', section: 'compliance' },
        secondary: { label: 'Refresh', action: 'refresh-access' }
      },
      {
        key: 'stale_review',
        title: 'Stale / removed review',
        count: m.staleReview,
        copy: 'Listings flagged as stale or removed and ready for operator review.',
        primary: { label: 'Open Analytics', section: 'analytics' },
        secondary: { label: 'Open Tools', section: 'tools' }
      },
      {
        key: 'review_queue',
        title: 'Review queue',
        count: m.review,
        copy: 'Listings currently waiting in the review queue.',
        primary: { label: 'Open Analytics', section: 'analytics' },
        secondary: { label: 'Refresh', action: 'refresh-access' }
      },
      {
        key: 'needs_action',
        title: 'Needs action',
        count: m.needsAction,
        copy: 'Listings with price, content, or lifecycle issues needing operator action.',
        primary: { label: 'Open Analytics', section: 'analytics' },
        secondary: { label: 'Open Compliance', section: 'compliance' }
      },
      {
        key: 'queue_ready',
        title: 'Queue ready',
        count: m.queue,
        copy: 'Vehicles ready for the next posting cycle.',
        primary: { label: 'Open Tools', section: 'tools' },
        secondary: { label: 'Open Analytics', section: 'analytics' }
      }
    ];

    return items.filter((item) => item.count > 0).slice(0, 5);
  }

  function buildHealth(m, data) {
    const account = data.account_snapshot || {};
    return [
      {
        title: 'Posting ready',
        state: m.canPost ? 'Ready' : 'Blocked',
        stateClass: m.canPost ? 'is-good' : 'is-bad',
        copy: m.canPost ? 'Posting flow is currently clear.' : 'Posting flow needs attention before pushing more volume.'
      },
      {
        title: 'Session state',
        state: account.access_granted ? 'Valid' : 'Check',
        stateClass: account.access_granted ? 'is-good' : 'is-warn',
        copy: account.access_granted ? 'Workspace access is active.' : 'Workspace access should be refreshed.'
      },
      {
        title: 'Compliance engine',
        state: m.complianceBlocked > 0 ? 'Warning' : 'Active',
        stateClass: m.complianceBlocked > 0 ? 'is-warn' : 'is-good',
        copy: m.complianceBlocked > 0 ? 'Compliance blockers are currently present.' : 'No active compliance blockers detected.'
      },
      {
        title: 'Queue health',
        state: m.queue > 0 || m.review > 0 ? 'Live' : 'Quiet',
        stateClass: m.queue > 0 || m.review > 0 ? 'is-good' : 'is-warn',
        copy: m.queue > 0 || m.review > 0 ? 'Queue and review surfaces are active.' : 'No major queue activity currently detected.'
      },
      {
        title: 'Last successful post',
        state: m.lastOutcomeLabel,
        stateClass: 'is-good',
        copy: m.lastOutcomeCopy
      },
      {
        title: 'Plan capacity',
        state: `${m.remainingToday} left`,
        stateClass: m.remainingToday > 0 ? 'is-good' : 'is-warn',
        copy: m.postingLimit > 0 ? `${m.postedToday} of ${m.postingLimit} used today.` : 'Current plan limit not available.'
      }
    ];
  }

  function metrics() {
    const data = summaryData();
    const mode = clean(data.dashboard_mode || 'activation').toLowerCase() === 'operator' ? 'operator' : 'activation';
    const command = data.command_center || {};
    const kpis = command.kpis || {};
    const queues = command.work_queues || {};
    const setup = data.setup_status || {};
    const recentListings = Array.isArray(data.recent_listings) ? data.recent_listings : [];
    const latestListing = recentListings[0] || null;

    return {
      data,
      mode,
      access: data.account_snapshot?.access_granted ? 'Active' : (data.account_snapshot?.status || 'Needs Attention'),
      plan: clean(data.plan_access?.plan_label || data.account_snapshot?.plan || 'Founder Beta'),
      operatorName: clean(data.profile_snapshot?.salesperson_name || data.profile_snapshot?.full_name || 'Operator'),
      dealership: clean(data.profile_snapshot?.dealership || data.profile_snapshot?.dealer_name || 'Elevate Workspace'),
      setupScore: num(data.activation_score),
      active: num(kpis.active_listings ?? data.active_listings),
      postedToday: num(kpis.posted_today ?? data.posts_today),
      remainingToday: num(kpis.remaining_today ?? data.posts_remaining),
      review: num(kpis.in_review ?? data.review_queue_count),
      needsAction: num(kpis.needs_action ?? data.needs_action_count),
      atRisk: num(kpis.at_risk ?? data.weak_listings),
      queue: num(queues.ready_to_post ?? data.queue_count),
      staleReview: num(queues.stale_review ?? data.review_delete_count),
      complianceBlocked: num(queues.compliance_blocked ?? 0),
      postingLimit: num(data.effective_posting_limit ?? data.daily_limit),
      canPost: Boolean(data.can_post),
      compliance: provinceFromSummary(data),
      profileComplete: Boolean(setup.profile_complete),
      firstPostComplete: Boolean(setup.first_post_complete),
      primaryCommand: command.primary_command || null,
      warnings: buildWarnings(data),
      recentOutcomes: buildRecentOutcomes(data),
      lastOutcomeLabel: latestListing ? 'Recorded' : 'No data',
      lastOutcomeCopy: latestListing
        ? `${clean(latestListing.title || 'Listing')} • ${num(latestListing.views_count)} views • ${num(latestListing.messages_count)} messages`
        : 'No recent listing outcome available yet.'
    };
  }

  function renderHeader(m) {
    return `
      <div class="ea-cc-header">
        <div class="ea-cc-card">
          <div class="ea-cc-card-eyebrow">Command Header</div>
          <h2 class="ea-cc-title">${m.operatorName}</h2>
          <p class="ea-cc-subtitle">${m.dealership} • ${m.mode === 'operator' ? 'Operator mode active' : 'Activation mode active'}</p>
          <div class="ea-cc-head-meta">
            <span class="ea-cc-chip is-good"><span class="ea-cc-chip-dot"></span>${m.plan}</span>
            <span class="ea-cc-chip ${m.canPost ? 'is-good' : 'is-bad'}"><span class="ea-cc-chip-dot"></span>${m.canPost ? 'Posting Ready' : 'Posting Blocked'}</span>
            <span class="ea-cc-chip ${m.access === 'Active' ? 'is-good' : 'is-warn'}"><span class="ea-cc-chip-dot"></span>${m.access}</span>
            <span class="ea-cc-chip ${m.compliance === 'Needs Review' ? 'is-warn' : 'is-good'}"><span class="ea-cc-chip-dot"></span>${m.compliance}</span>
          </div>
        </div>
        <div class="ea-cc-head-stats">
          <div class="ea-cc-head-stat">
            <div class="ea-cc-head-stat-label">Posts Remaining</div>
            <div class="ea-cc-head-stat-value">${m.remainingToday}</div>
            <div class="ea-cc-head-stat-copy">${m.postingLimit > 0 ? `${m.postedToday} of ${m.postingLimit} used today.` : 'Current plan usage.'}</div>
          </div>
          <div class="ea-cc-head-stat">
            <div class="ea-cc-head-stat-label">Current Priority Load</div>
            <div class="ea-cc-head-stat-value">${m.review + m.needsAction}</div>
            <div class="ea-cc-head-stat-copy">Review plus action items currently open.</div>
          </div>
          <div class="ea-cc-head-stat">
            <div class="ea-cc-head-stat-label">Queue Ready</div>
            <div class="ea-cc-head-stat-value">${m.queue}</div>
            <div class="ea-cc-head-stat-copy">Units prepared for the next posting cycle.</div>
          </div>
          <div class="ea-cc-head-stat">
            <div class="ea-cc-head-stat-label">Stale / Removed</div>
            <div class="ea-cc-head-stat-value">${m.staleReview}</div>
            <div class="ea-cc-head-stat-copy">Listings flagged for stale or removed review.</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPrimary(m) {
    const pc = m.primaryCommand || {
      title: m.mode === 'operator' ? 'Maintain listing quality and operator rhythm' : 'Complete setup and run the first clean posting cycle',
      message: m.mode === 'operator'
        ? 'The account is live and operator mode is active. Stay focused on review quality and listing health.'
        : 'Finish the activation items and publish the first clean vehicle so the dashboard can lock into operator mode.',
      primary_action: 'open_tools',
      secondary_action: 'open_analytics'
    };

    const targets = buildTargets(m);

    return `
      <div class="ea-cc-primary">
        <div class="ea-cc-card">
          <div class="ea-cc-card-eyebrow">Primary Command</div>
          <h3 class="ea-cc-primary-title">${clean(pc.title)}</h3>
          <p class="ea-cc-primary-copy">${clean(pc.message)}</p>
          <div class="ea-cc-note">Primary action: ${clean(pc.primary_action || 'open_tools')} • Secondary action: ${clean(pc.secondary_action || 'open_analytics')}</div>
          <div class="ea-cc-cta-row">
            <button class="ea-cc-btn is-primary" type="button" ${mapActionAttr(pc.primary_action, true)}>Execute Primary</button>
            <button class="ea-cc-btn" type="button" ${mapActionAttr(pc.secondary_action, false)}>Open Secondary</button>
          </div>
        </div>
        <div class="ea-cc-card">
          <div class="ea-cc-card-eyebrow">Today’s Target</div>
          <div class="ea-cc-targets">
            ${targets.map((item) => `
              <div class="ea-cc-target-row">
                <div>
                  <strong>${item.label}</strong>
                  <span>${item.copy}</span>
                </div>
                <div class="ea-cc-target-value">${item.value}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function renderKpis(m) {
    const items = [
      { label: 'Active Listings', value: m.active, copy: 'Current live portfolio count.' },
      { label: 'In Review', value: m.review, copy: 'Listings currently waiting in review.' },
      { label: 'Needs Action', value: m.needsAction, copy: 'Listings requiring operator action.' },
      { label: 'Queued', value: m.queue, copy: 'Units ready for the next posting cycle.' },
      { label: 'Posted Today', value: m.postedToday, copy: 'Units pushed today.' },
      { label: 'Remaining Today', value: m.remainingToday, copy: 'Posting capacity still available.' }
    ];

    return `
      <div class="ea-cc-kpis">
        ${items.map((item) => `
          <div class="ea-cc-kpi">
            <div class="ea-cc-kpi-label">${item.label}</div>
            <div class="ea-cc-kpi-value">${item.value}</div>
            <div class="ea-cc-kpi-copy">${item.copy}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderActionQueue(m) {
    const items = buildActionQueue(m);
    return `
      <div class="ea-cc-card">
        <div class="ea-cc-card-eyebrow">Action Queue</div>
        <div class="ea-cc-list">
          ${items.length ? items.map((item) => `
            <div class="ea-cc-queue-row">
              <div class="ea-cc-queue-copy">
                <strong>${item.title}</strong>
                <span>${item.copy}</span>
              </div>
              <div class="ea-cc-queue-actions">
                <span class="ea-cc-pill">${item.count}</span>
                <button class="ea-cc-btn is-primary" type="button" ${item.primary.section ? `data-open-section="${item.primary.section}"` : ''} ${item.primary.action ? `data-ea-action="${item.primary.action}"` : ''}>${item.primary.label}</button>
                <button class="ea-cc-btn" type="button" ${item.secondary.section ? `data-open-section="${item.secondary.section}"` : ''} ${item.secondary.action ? `data-ea-action="${item.secondary.action}"` : ''}>${item.secondary.label}</button>
              </div>
            </div>
          `).join('') : `<div class="ea-cc-empty">No active queue pressure right now. The machine is currently clean.</div>`}
        </div>
      </div>
    `;
  }

  function renderHealthAndWarnings(m) {
    const health = buildHealth(m, m.data);
    return `
      <div class="ea-cc-card">
        <div class="ea-cc-card-eyebrow">Machine Health</div>
        <div class="ea-cc-health">
          <div class="ea-cc-health-badges">
            ${health.map((item) => `
              <div class="ea-cc-health-badge">
                <strong class="${item.stateClass}"><span class="ea-cc-chip-dot"></span>${item.title}: ${item.state}</strong>
                <span>${item.copy}</span>
              </div>
            `).join('')}
          </div>
          <div>
            <div class="ea-cc-card-eyebrow" style="margin-top:6px">Operator Warnings</div>
            <div class="ea-cc-warning-list">
              ${m.warnings.length ? m.warnings.map((item) => `
                <div class="ea-cc-warning-row">
                  <div class="ea-cc-warning-copy">
                    <strong>${item.title}</strong>
                    <span>${item.copy}</span>
                  </div>
                </div>
              `).join('') : `<div class="ea-cc-warning-empty">No operator warnings are currently forcing attention.</div>`}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderOutcomes(m) {
    return `
      <div class="ea-cc-card">
        <div class="ea-cc-card-eyebrow">Recent Outcomes</div>
        <div class="ea-cc-list">
          ${m.recentOutcomes.length ? m.recentOutcomes.map((item) => `
            <div class="ea-cc-event-row">
              <div class="ea-cc-event-copy">
                <strong>${item.title}</strong>
                <span>${item.copy}</span>
              </div>
              <span class="ea-cc-pill">${item.pill}</span>
            </div>
          `).join('') : `<div class="ea-cc-empty">No recent outcomes available yet.</div>`}
        </div>
      </div>
    `;
  }

  function mapActionAttr(action, isPrimary) {
    const cleanAction = clean(action || '').toLowerCase();
    const routeMap = {
      open_tools: 'tools',
      post_next: 'tools',
      open_analytics: 'analytics',
      open_review_queue: 'analytics',
      open_compliance: 'compliance',
      open_setup: 'setup'
    };
    if (cleanAction === 'refresh_sync' || cleanAction === 'refresh-access') {
      return 'data-ea-action="refresh-access"';
    }
    const section = routeMap[cleanAction] || (isPrimary ? 'tools' : 'analytics');
    return `data-open-section="${section}"`;
  }

  function renderShell() {
    const m = metrics();
    updateOverviewHeader(m.mode);
    return `
      <div class="ea-cc-shell" data-command-centre-mode="${m.mode}">
        ${renderHeader(m)}
        ${renderPrimary(m)}
        ${renderKpis(m)}
        <div class="ea-cc-grid">
          ${renderActionQueue(m)}
          ${renderHealthAndWarnings(m)}
        </div>
        ${renderOutcomes(m)}
      </div>
    `;
  }

  function bindButtons(root) {
    root.querySelectorAll('[data-open-section]').forEach((button) => {
      if (button.dataset.eaBound === 'true') return;
      button.dataset.eaBound = 'true';
      button.addEventListener('click', () => {
        const section = button.getAttribute('data-open-section');
        if (typeof window.showSection === 'function') window.showSection(section, { scroll: false });
      });
    });

    root.querySelectorAll('[data-ea-action="refresh-access"]').forEach((button) => {
      if (button.dataset.eaBound === 'true') return;
      button.dataset.eaBound = 'true';
      button.addEventListener('click', async () => {
        try {
          await NS.api?.refreshAccess?.();
        } catch {}
      });
    });
  }

  function renderCommandCentre() {
    const overview = document.getElementById('overview');
    if (!overview) return;
    injectStyle();
    overview.innerHTML = renderShell();
    bindButtons(overview);
  }

  function boot() {
    renderCommandCentre();
    setTimeout(renderCommandCentre, 900);
    setTimeout(renderCommandCentre, 2400);
  }

  window.addEventListener('elevate:summary-ready', renderCommandCentre);
  window.addEventListener('elevate:auth-ready', renderCommandCentre);
  window.addEventListener('elevate:account-truth', renderCommandCentre);

  NS.overview = { renderCommandCentre, metrics };
  NS.modules = NS.modules || {};
  NS.modules.overview = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();