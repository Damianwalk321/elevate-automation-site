(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.overview) return;

  const CSS = `
    .ea-cc-shell{display:grid;gap:18px}
    .ea-cc-hero{display:grid;gap:8px;margin-bottom:4px}
    .ea-cc-title{font-size:34px;line-height:1.06;font-weight:800;letter-spacing:-.03em}
    .ea-cc-sub{font-size:14px;line-height:1.55;color:var(--muted)}
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
    @media (max-width: 700px){.ea-cc-title{font-size:28px}.ea-cc-stats,.ea-cc-secondary{grid-template-columns:1fr}.ea-cc-action{align-items:flex-start;flex-direction:column}.ea-cc-btn{width:100%}}
  `;

  function injectStyle() {
    if (document.getElementById('elevate-command-centre-shell-v1')) return;
    const style = document.createElement('style');
    style.id = 'elevate-command-centre-shell-v1';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function num(value) {
    const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function text(id) {
    return clean(document.getElementById(id)?.textContent || '');
  }

  function bodyText() {
    return clean(document.body?.innerText || '');
  }

  function setupPercent() {
    const direct = num(text('setupProgressValue'));
    if (direct) return Math.max(0, Math.min(100, direct));
    const match = bodyText().match(/setup\s*(\d{1,3})%/i);
    return match ? Math.max(0, Math.min(100, Number(match[1]))) : 0;
  }

  function complianceLabel() {
    const body = bodyText();
    const match = body.match(/\b(AB\/BC|AB|BC)\b/);
    return match ? match[1] : 'Needs Review';
  }

  function accessLabel() {
    const ready = document.body?.getAttribute('data-dashboard-ready');
    return ready === 'true' ? 'Active' : 'Needs Attention';
  }

  function metrics() {
    const active = num(text('kpiActiveListings'));
    const review = num(text('kpiReviewQueue'));
    const needsAction = num(text('kpiNeedsAction'));
    const weak = num(text('kpiWeakListings'));
    const setup = setupPercent();
    const firstPostDone = active > 0;
    const activationMode = setup < 100 || !firstPostDone;
    return {
      access: accessLabel(),
      setup,
      active,
      review,
      needsAction,
      weak,
      firstPostDone,
      activationMode,
      compliance: complianceLabel()
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
      if (m.setup < 100) {
        return {
          eyebrow: 'Activation Priority',
          title: 'Complete setup before pushing your first post',
          copy: 'Finish the core setup items first so the operator workspace is ready for clean posting, review, and compliance handling.',
          note: `Setup progress is currently ${m.setup}%. Once setup and first post are complete, this area should shift into live operating priorities.`
        };
      }
      return {
        eyebrow: 'Activation Priority',
        title: 'Queue and publish the first clean listing',
        copy: 'The next best move is to run one vehicle through the full flow so the Command Centre can shift from activation into operator mode.',
        note: 'Use this stage to confirm tools access, compliance readiness, and one successful posting cycle.'
      };
    }

    if (m.needsAction > 0) {
      return {
        eyebrow: 'Current Priority',
        title: `Review ${m.needsAction} listing${m.needsAction === 1 ? '' : 's'} needing action`,
        copy: 'Clear the immediate action queue before adding more execution pressure. Keep the machine clean first, then move volume.',
        note: `There ${m.needsAction === 1 ? 'is' : 'are'} ${m.needsAction} active item${m.needsAction === 1 ? '' : 's'} waiting for attention.`
      };
    }

    if (m.review > 0) {
      return {
        eyebrow: 'Current Priority',
        title: `Work through the ${m.review}-item review queue`,
        copy: 'Use the review queue as the next operator move so listings stay controlled and clean as activity scales.',
        note: 'This area should always show the single highest-leverage move, not a mixed dashboard dump.'
      };
    }

    return {
      eyebrow: 'Current Priority',
      title: 'Maintain posting rhythm and keep review clean',
      copy: 'Core setup is out of the way. The Command Centre should now stay focused on execution, review, and compliance quality.',
      note: 'When no immediate pressure exists, this area should still reinforce the clean next move.'
    };
  }

  function pressurePoints(m) {
    if (m.activationMode) {
      return [
        { title: 'Setup Progress', copy: `${m.setup}% complete. Finish the missing setup items before relying on this as a full operator surface.` },
        { title: 'First Post Status', copy: m.firstPostDone ? 'First posting milestone is complete.' : 'No successful first post is recorded yet.' },
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
    return `
      <div class="ea-cc-shell">
        <div class="ea-cc-hero">
          <div class="ea-cc-title">Command Centre</div>
          <div class="ea-cc-sub">Your operator view for setup, posting, review, and compliance.</div>
        </div>

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

  NS.overview = { renderCommandCentre };
  NS.modules = NS.modules || {};
  NS.modules.overview = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();