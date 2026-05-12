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

  const MODE_KEY = 'elevate.command_centre.mode.v1';

  function injectStyle() {
    if (document.getElementById('elevate-command-centre-bundle1')) return;
    const style = document.createElement('style');
    style.id = 'elevate-command-centre-bundle1';
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

  function profileState() {
    return {
      user: NS.state?.get?.('user', {}) || {},
      profile: NS.state?.get?.('profile', {}) || {},
      session: NS.state?.get?.('session', {}) || {},
      summary: summaryData(),
      currentUser: window.currentUser || {},
      truth: NS.accountTruth || {}
    };
  }

  function persistedMode() {
    try {
      const mode = localStorage.getItem(MODE_KEY);
      return mode === 'operator' ? 'operator' : 'activation';
    } catch {
      return 'activation';
    }
  }

  function persistMode(mode) {
    try {
      localStorage.setItem(MODE_KEY, mode);
      NS.commandCentreMode = mode;
    } catch {}
  }

  function updateOverviewHeader(mode) {
    const heading = document.querySelector('.main-header h1');
    const welcome = document.getElementById('welcomeText');
    if (heading) heading.textContent = 'Command Centre';
    if (welcome) {
      welcome.textContent = mode === 'operator'
        ? 'Your operator view for posting, review, and compliance.'
        : 'Your operator view for setup, posting, review, and compliance.';
    }
  }

  function findProvince() {
    const s = profileState();
    const candidates = [
      s.profile.province,
      s.profile.province_code,
      s.profile.compliance_mode,
      s.profile.compliance_province,
      s.summary.profile_snapshot?.province,
      s.summary.profile_snapshot?.province_code,
      s.summary.profile_snapshot?.compliance_mode,
      s.summary.account_snapshot?.province,
      s.summary.account_snapshot?.province_code,
      s.truth.province,
      s.truth.province_code,
      s.session.province,
      s.currentUser.user_metadata?.province,
      s.currentUser.user_metadata?.province_code
    ].map(clean).filter(Boolean);

    const direct = candidates.find((value) => /^(AB|BC|AB\/BC|Alberta|British Columbia)$/i.test(value));
    if (direct) {
      if (/alberta/i.test(direct)) return 'AB';
      if (/british columbia/i.test(direct)) return 'BC';
      return direct.toUpperCase();
    }
    return 'Needs Review';
  }

  function accessLabel(data) {
    const account = data.account_snapshot || {};
    const ready = document.body?.getAttribute('data-dashboard-ready');
    if (account.access_granted === true) return 'Active';
    return ready === 'true' ? 'Active' : 'Needs Attention';
  }

  function activationSignals(base) {
    const accessReady = base.access === 'Active';
    const complianceReady = base.compliance !== 'Needs Review';
    const setupReady = base.setup >= 100 || base.activityCount > 0;
    const firstPostReady = base.firstPostDone;
    return {
      accessReady,
      complianceReady,
      setupReady,
      firstPostReady,
      shouldSwitchToOperator: accessReady && complianceReady && firstPostReady
    };
  }

  function resolveMode(signals) {
    const stored = persistedMode();
    if (stored === 'operator') return 'operator';
    if (signals.shouldSwitchToOperator) {
      persistMode('operator');
      return 'operator';
    }
    persistMode('activation');
    return 'activation';
  }

  function metrics() {
    const data = summaryData();
    const setupRaw = Math.round((Number(data.setup_status?.profile_completion_score || 0)) * 100);
    const active = num(data.active_listings);
    const review = num(data.review_queue_count);
    const needsAction = num(data.needs_action_count);
    const weak = num(data.weak_listings);
    const queue = num(data.queue_count);
    const activityCount = active + review + needsAction + weak + queue;
    const firstPostDone = active > 0 || review > 0 || needsAction > 0 || weak > 0;
    const setup = setupRaw || (activityCount > 0 ? 100 : 0);
    const base = {
      access: accessLabel(data),
      setup,
      active,
      review,
      needsAction,
      weak,
      queue,
      activityCount,
      firstPostDone,
      compliance: findProvince()
    };
    const signals = activationSignals(base);
    const mode = resolveMode(signals);
    return {
      ...base,
      ...signals,
      mode,
      activationMode: mode !== 'operator'
    };
  }

  function statCards(m) {
    if (m.activationMode) {
      return [
        { label: 'Access', value: m.access, copy: 'Current workspace and session state.' },
        { label: 'Setup', value: `${m.setup}%`, copy: 'Progress toward posting readiness.' },
        { label: 'First Post', value: m.firstPostDone ? 'Complete' : 'Not Started', copy: 'First posting milestone for this operator.' },
        { label: 'Compliance', value: m.compliance, copy: 'Current publishing rule profile.' }
      ];
    }
    return [
      { label: 'Active Listings', value: String(m.active), copy: 'Listings currently live in the portfolio.' },
      { label: 'Review', value: String(m.review), copy: 'Items waiting for review or intervention.' },
      { label: 'Needs Action', value: String(m.needsAction), copy: 'Listings needing operator attention.' },
      { label: 'Compliance', value: m.compliance, copy: 'Current publishing rule profile.' }
    ];
  }

  function currentPriority(m) {
    if (m.activationMode) {
      if (!m.accessReady) {
        return {
          eyebrow: 'Activation Priority',
          title: 'Stabilize workspace access first',
          copy: 'Make sure the operator workspace and current session are fully active before moving into posting work.',
          note: 'Activation mode should stay focused on real blockers only, starting with access when access is not ready.'
        };
      }
      if (!m.complianceReady) {
        return {
          eyebrow: 'Activation Priority',
          title: 'Complete compliance profile before first posting cycle',
          copy: 'Set the correct publishing rule profile so your first clean posting cycle is grounded to the right province and disclosures.',
          note: 'This should resolve before the system switches into operator mode.'
        };
      }
      if (m.setup < 100) {
        return {
          eyebrow: 'Activation Priority',
          title: 'Complete setup before pushing your first post',
          copy: 'Finish the core setup items first so the operator workspace is ready for clean posting, review, and compliance handling.',
          note: `Setup progress is currently ${m.setup}%. Once the first clean cycle is complete, this account should move into operator mode.`
        };
      }
      return {
        eyebrow: 'Activation Priority',
        title: 'Queue and publish the first clean listing',
        copy: 'The next best move is to run one vehicle through the full flow so the Command Centre can leave activation and lock into operator mode.',
        note: 'Bundle 1 should make this switch accurate and persistent once the first posting milestone is truly complete.'
      };
    }

    if (m.needsAction > 0) {
      return {
        eyebrow: 'Current Priority',
        title: `Review ${m.needsAction} listing${m.needsAction === 1 ? '' : 's'} needing action`,
        copy: 'Clear the immediate action queue before adding more execution pressure. Keep the machine clean first, then move volume.',
        note: 'Operator mode is now locked for this account and should not fall back into activation.'
      };
    }

    if (m.review > 0) {
      return {
        eyebrow: 'Current Priority',
        title: `Work through the ${m.review}-item review queue`,
        copy: 'Use the review queue as the next operator move so listings stay controlled and clean as activity scales.',
        note: 'Operator mode is now locked for this account and should not fall back into activation.'
      };
    }

    return {
      eyebrow: 'Current Priority',
      title: 'Maintain posting rhythm and keep review clean',
      copy: 'Core setup is complete. The Command Centre should now stay focused on execution, review, and compliance quality.',
      note: 'Operator mode is now locked for this account and should not fall back into activation.'
    };
  }

  function pressurePoints(m) {
    if (m.activationMode) {
      return [
        { title: 'Access', copy: m.accessReady ? 'Workspace access is active.' : 'Workspace access still needs attention before posting flow should be trusted.' },
        { title: 'Setup Progress', copy: `${m.setup}% complete. Finish the missing setup items before relying on this as a full operator surface.` },
        { title: 'Compliance Readiness', copy: `Current rule profile is ${m.compliance}. Confirm all required profile information is in place.` }
      ];
    }

    return [
      { title: 'Review Queue', copy: `${m.review} item${m.review === 1 ? '' : 's'} currently waiting in review.` },
      { title: 'Needs Action', copy: `${m.needsAction} listing${m.needsAction === 1 ? '' : 's'} currently require action.` },
      { title: 'Weak / At Risk', copy: `${m.weak} listing${m.weak === 1 ? '' : 's'} currently sitting in a weak or at-risk state.` }
    ];
  }

  function quickActions(m) {
    if (m.activationMode) {
      return [
        { title: 'Open Setup', copy: 'Complete profile and activation items.', section: 'setup' },
        { title: 'Open Compliance', copy: 'Review current publishing rule profile.', section: 'compliance' },
        { title: 'Open Tools', copy: 'Access posting, queue, and extension tools.', section: 'tools' },
        { title: 'Refresh Access', copy: 'Recheck workspace and session state.', action: 'refresh-access' }
      ];
    }
    return [
      { title: 'Open Analytics', copy: 'View listings, review, and performance.', section: 'analytics' },
      { title: 'Open Tools', copy: 'Work queue, posting, and extension flow.', section: 'tools' },
      { title: 'Open Compliance', copy: 'Review current publish profile and disclosures.', section: 'compliance' },
      { title: 'Refresh Access', copy: 'Recheck workspace and session state.', action: 'refresh-access' }
    ];
  }

  function secondaryStrip(m) {
    return [
      { label: 'Active', value: String(m.active), copy: 'Live portfolio count.' },
      { label: 'Review', value: String(m.review), copy: 'Items waiting in review.' },
      { label: 'Needs Action', value: String(m.needsAction), copy: 'Listings requiring action.' },
      { label: 'Weak / At Risk', value: String(m.weak), copy: 'Listings needing stronger attention.' }
    ];
  }

  function renderShell() {
    const m = metrics();
    const priority = currentPriority(m);
    updateOverviewHeader(m.mode);
    return `
      <div class="ea-cc-shell" data-command-centre-mode="${m.mode}">
        <div class="ea-cc-stats">
          ${statCards(m).map((card) => `
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

  NS.overview = { renderCommandCentre, metrics, persistedMode };
  NS.modules = NS.modules || {};
  NS.modules.overview = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();