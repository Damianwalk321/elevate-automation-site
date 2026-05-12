(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.overview) return;

  const CSS = `
    .ea-cc-shell{display:grid;gap:18px}
    .ea-cc-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
    .ea-cc-stat{background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0));border:1px solid var(--line);border-radius:18px;padding:22px;box-shadow:var(--shadow);min-height:164px}
    .ea-cc-stat-label{font-size:12px;text-transform:uppercase;letter-spacing:1.3px;color:var(--gold);font-weight:800}
    .ea-cc-stat-value{margin-top:10px;font-size:28px;line-height:1.08;font-weight:800;color:var(--text)}
    .ea-cc-stat-copy{margin-top:10px;font-size:14px;line-height:1.55;color:var(--muted)}
    .ea-cc-main{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(320px,.95fr) minmax(320px,.92fr);gap:18px;align-items:stretch}
    .ea-cc-card{background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0));border:1px solid var(--line);border-radius:18px;padding:22px;box-shadow:var(--shadow);min-height:100%}
    .ea-cc-card-eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:1.3px;color:var(--gold);font-weight:800;margin-bottom:12px}
    .ea-cc-priority-title{font-size:18px;line-height:1.22;font-weight:800;color:var(--text);margin-bottom:10px}
    .ea-cc-priority-copy{font-size:15px;line-height:1.65;color:#d5d5d5;margin-bottom:18px}
    .ea-cc-note{padding:14px 16px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.06);font-size:14px;line-height:1.6;color:#dcdcdc}
    .ea-cc-list{display:grid;gap:12px}
    .ea-cc-item{padding:14px 16px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.06)}
    .ea-cc-item-title{font-size:15px;line-height:1.35;font-weight:700;color:var(--text);margin-bottom:6px}
    .ea-cc-item-copy{font-size:13px;line-height:1.55;color:var(--muted)}
    .ea-cc-actions{display:grid;gap:12px}
    .ea-cc-action{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.06)}
    .ea-cc-action-copy strong{display:block;font-size:15px;line-height:1.3;margin-bottom:5px}
    .ea-cc-action-copy span{display:block;font-size:13px;line-height:1.5;color:var(--muted)}
    .ea-cc-btn{appearance:none;border:1px solid rgba(255,255,255,.08);background:#1a1a1a;color:#f2f2f2;border-radius:12px;padding:11px 14px;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap}
    .ea-cc-btn:hover{border-color:rgba(212,175,55,.22);background:#212121}
    .ea-cc-secondary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
    .ea-cc-mini{background:#141414;border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:16px}
    .ea-cc-mini-label{font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:var(--gold);font-weight:800;margin-bottom:8px}
    .ea-cc-mini-value{font-size:20px;line-height:1.1;font-weight:800}
    .ea-cc-mini-copy{margin-top:8px;font-size:13px;line-height:1.5;color:var(--muted)}
    @media (max-width: 1180px){.ea-cc-main{grid-template-columns:1fr}.ea-cc-stats,.ea-cc-secondary{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media (max-width: 700px){.ea-cc-stats,.ea-cc-secondary{grid-template-columns:1fr}.ea-cc-action{align-items:flex-start;flex-direction:column}.ea-cc-btn{width:100%}}
  `;

  function injectStyle() {
    if (document.getElementById('elevate-command-centre-bundle3')) return;
    const style = document.createElement('style');
    style.id = 'elevate-command-centre-bundle3';
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
    if (heading) {
      heading.textContent = mode === 'operator' ? 'Operator Command Centre' : 'Activation Command Centre';
    }
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

  function metrics() {
    const data = summaryData();
    const mode = clean(data.dashboard_mode || 'activation').toLowerCase() === 'operator' ? 'operator' : 'activation';
    const command = data.command_center || {};
    const kpis = command.kpis || {};
    const queues = command.work_queues || {};
    const setup = data.setup_status || {};

    return {
      mode,
      access: data.account_snapshot?.access_granted ? 'Active' : (data.account_snapshot?.status || 'Needs Attention'),
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
      canPost: Boolean(data.can_post),
      compliance: provinceFromSummary(data),
      profileComplete: Boolean(setup.profile_complete),
      firstPostComplete: Boolean(setup.first_post_complete),
      primaryCommand: command.primary_command || null
    };
  }

  function activationStatCards(m) {
    return [
      { label: 'Access', value: m.access, copy: 'Current workspace and session state.' },
      { label: 'Setup', value: `${m.setupScore}%`, copy: 'Progress toward activation completion.' },
      { label: 'First Post', value: m.firstPostComplete ? 'Complete' : 'Not Started', copy: 'First clean posting milestone.' },
      { label: 'Compliance', value: m.compliance, copy: 'Current publishing rule profile.' }
    ];
  }

  function operatorStatCards(m) {
    return [
      { label: 'Active Listings', value: String(m.active), copy: 'Current live portfolio count.' },
      { label: 'Posted Today', value: String(m.postedToday), copy: 'Units posted in the current business day.' },
      { label: 'Remaining Today', value: String(m.remainingToday), copy: 'Posting capacity still available today.' },
      { label: 'In Review', value: String(m.review), copy: 'Items currently waiting in review.' }
    ];
  }

  function pressurePoints(m) {
    if (m.mode !== 'operator') {
      return [
        { title: 'Setup', copy: `Activation is currently ${m.setupScore}% complete.` },
        { title: 'Compliance', copy: `Current publish profile is ${m.compliance}.` },
        { title: 'First Live Cycle', copy: m.firstPostComplete ? 'First clean posting cycle is complete.' : 'First clean posting cycle still needs to happen.' }
      ];
    }
    return [
      { title: 'Review Queue', copy: `${m.review} item${m.review === 1 ? '' : 's'} currently waiting in review.` },
      { title: 'Needs Action', copy: `${m.needsAction} listing${m.needsAction === 1 ? '' : 's'} currently require action.` },
      { title: 'At Risk', copy: `${m.atRisk} listing${m.atRisk === 1 ? '' : 's'} currently sit in a weak or at-risk state.` }
    ];
  }

  function quickActions(m) {
    if (m.mode !== 'operator') {
      return [
        { title: 'Open Setup', copy: 'Complete profile and activation items.', section: 'setup' },
        { title: 'Open Compliance', copy: 'Review publish rule profile.', section: 'compliance' },
        { title: 'Open Tools', copy: 'Access posting and queue tools.', section: 'tools' },
        { title: 'Refresh Access', copy: 'Recheck workspace and session state.', action: 'refresh-access' }
      ];
    }
    return [
      { title: 'Open Tools', copy: 'Work queue, posting, and extension flow.', section: 'tools' },
      { title: 'Open Analytics', copy: 'View listings, review, and performance.', section: 'analytics' },
      { title: 'Open Compliance', copy: 'Review publish profile and disclosures.', section: 'compliance' },
      { title: 'Refresh Access', copy: 'Recheck workspace and session state.', action: 'refresh-access' }
    ];
  }

  function secondaryStrip(m) {
    if (m.mode !== 'operator') {
      return [
        { label: 'Active', value: String(m.active), copy: 'Live portfolio count.' },
        { label: 'Review', value: String(m.review), copy: 'Items waiting in review.' },
        { label: 'Needs Action', value: String(m.needsAction), copy: 'Listings requiring action.' },
        { label: 'At Risk', value: String(m.atRisk), copy: 'Listings needing stronger attention.' }
      ];
    }
    return [
      { label: 'Queue Ready', value: String(m.queue), copy: 'Units prepared for next posting work.' },
      { label: 'Stale Review', value: String(m.staleReview), copy: 'Listings needing stale/remove review.' },
      { label: 'Compliance Blocked', value: String(m.complianceBlocked), copy: 'Items blocked on publish compliance.' },
      { label: 'Can Post', value: m.canPost ? 'Ready' : 'Blocked', copy: 'Current posting flow readiness.' }
    ];
  }

  function buildPriority(m) {
    const fallback = m.mode === 'operator'
      ? {
          eyebrow: 'Current Priority',
          title: 'Maintain listing quality and operator rhythm',
          copy: 'The account is live and operator mode is active. Stay focused on review quality and listing health.',
          note: 'Operator mode should now remain the default state for this account.'
        }
      : {
          eyebrow: 'Activation Priority',
          title: 'Complete setup and run the first clean posting cycle',
          copy: 'Finish the activation items and publish the first clean vehicle so the dashboard can lock into operator mode.',
          note: 'Activation mode should end once the operator qualification conditions are met.'
        };

    const pc = m.primaryCommand;
    if (!pc) return fallback;

    return {
      eyebrow: m.mode === 'operator' ? 'Current Priority' : 'Activation Priority',
      title: clean(pc.title || fallback.title),
      copy: clean(pc.message || fallback.copy),
      note: `Primary action: ${clean(pc.primary_action || 'open_tools')} • Secondary action: ${clean(pc.secondary_action || 'open_analytics')}`
    };
  }

  function renderShell() {
    const m = metrics();
    const priority = buildPriority(m);
    updateOverviewHeader(m.mode);
    const statCards = m.mode === 'operator' ? operatorStatCards(m) : activationStatCards(m);

    return `
      <div class="ea-cc-shell" data-command-centre-mode="${m.mode}">
        <div class="ea-cc-stats">
          ${statCards.map((card) => `
            <div class="ea-cc-stat">
              <div class="ea-cc-stat-label">${card.label}</div>
              <div class="ea-cc-stat-value">${card.value}</div>
              <div class="ea-cc-stat-copy">${card.copy}</div>
            </div>
          `).join('')}
        </div>

        <div class="ea-cc-main">
          <div class="ea-cc-card">
            <div class="ea-cc-card-eyebrow">${priority.eyebrow}</div>
            <div class="ea-cc-priority-title">${priority.title}</div>
            <div class="ea-cc-priority-copy">${priority.copy}</div>
            <div class="ea-cc-note">${priority.note}</div>
          </div>

          <div class="ea-cc-card">
            <div class="ea-cc-card-eyebrow">Pressure Points</div>
            <div class="ea-cc-list">
              ${pressurePoints(m).map((item) => `
                <div class="ea-cc-item">
                  <div class="ea-cc-item-title">${item.title}</div>
                  <div class="ea-cc-item-copy">${item.copy}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="ea-cc-card">
            <div class="ea-cc-card-eyebrow">Quick Actions</div>
            <div class="ea-cc-actions">
              ${quickActions(m).map((item) => `
                <div class="ea-cc-action">
                  <div class="ea-cc-action-copy">
                    <strong>${item.title}</strong>
                    <span>${item.copy}</span>
                  </div>
                  <button class="ea-cc-btn" type="button" ${item.section ? `data-open-section="${item.section}"` : ''} ${item.action ? `data-ea-action="${item.action}"` : ''}>Open</button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="ea-cc-secondary">
          ${secondaryStrip(m).map((item) => `
            <div class="ea-cc-mini">
              <div class="ea-cc-mini-label">${item.label}</div>
              <div class="ea-cc-mini-value">${item.value}</div>
              <div class="ea-cc-mini-copy">${item.copy}</div>
            </div>
          `).join('')}
        </div>
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