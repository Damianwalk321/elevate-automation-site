(() => {
  if (window.__ELEVATE_BUNDLE_C_OVERVIEW__) return;
  window.__ELEVATE_BUNDLE_C_OVERVIEW__ = true;

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function text(id) {
    return clean(document.getElementById(id)?.textContent || '');
  }

  function parseIntegerLoose(value) {
    const match = String(value || '').replace(/,/g, '').match(/-?\d+/);
    return match ? Number(match[0]) : 0;
  }

  function parseSetupPercent() {
    const raw = text('commandSetupProgress') || text('setupReadinessPercent') || text('commandSetupChip');
    const match = raw.match(/(\d{1,3})/);
    return match ? Math.max(0, Math.min(100, Number(match[1]))) : 0;
  }

  function setupStatus(id) {
    const el = document.getElementById(id);
    if (!el) return { ok: false, tone: 'pending', text: 'Missing' };
    const value = clean(el.textContent).toLowerCase();
    const ok =
      el.classList.contains('good') ||
      value.includes('ready') ||
      value.includes('saved') ||
      value.includes('active') ||
      value.includes('configured') ||
      value.includes('complete');
    return {
      ok,
      tone: ok ? 'ready' : (value.includes('inactive') || value.includes('blocked') ? 'blocked' : 'pending'),
      text: ok ? 'Ready' : 'Missing'
    };
  }

  function getChecks() {
    return [
      { label: 'Dealer website', id: 'setupDealerWebsite' },
      { label: 'Inventory URL', id: 'setupInventoryUrl' },
      { label: 'Scanner selected', id: 'setupScannerType' },
      { label: 'Listing location', id: 'setupListingLocation' },
      { label: 'Compliance mode', id: 'setupComplianceMode' },
      { label: 'Access active', id: 'setupAccess' }
    ].map((item) => ({ ...item, ...setupStatus(item.id) }));
  }

  function buildModel() {
    const checks = getChecks();
    const completeCount = checks.filter((c) => c.ok).length;
    const totalCount = checks.length;
    const setupPercent = parseSetupPercent() || Math.round((completeCount / totalCount) * 100);
    const queueCount = parseIntegerLoose(text('kpiQueuedVehicles'));
    const reviewQueue = parseIntegerLoose(text('kpiReviewQueue'));
    const activeListings = parseIntegerLoose(text('kpiActiveListings'));
    const postsUsedRaw = text('commandPostsUsed');
    const postsUsed = parseIntegerLoose(postsUsedRaw.split('/')[0] || postsUsedRaw);
    const credits = text('commandCreditsBalance') || text('kpiCreditsBalance') || '0';
    const accessActive = checks.find((c) => c.label === 'Access active')?.ok;

    let state = 'setup_incomplete';
    let stateLabel = 'Setup Incomplete';
    let title = 'Complete setup to unlock first-post value.';
    let copy = 'Finish the required setup fields so the system can route you into inventory and posting.';
    let primaryLabel = 'Complete Setup';
    let primaryAction = 'profile';
    let secondaryLabel = 'See Walkthrough';

    if (completeCount === totalCount && !accessActive) {
      state = 'access_blocked';
      stateLabel = 'Access Blocked';
      title = 'Refresh access before posting.';
      copy = 'Your setup is saved, but account access is not active yet.';
      primaryLabel = 'Refresh Access';
      primaryAction = 'refresh_access';
    } else if (completeCount === totalCount && accessActive && queueCount === 0 && postsUsed === 0 && activeListings === 0) {
      state = 'queue_first_vehicle';
      stateLabel = 'Queue First Vehicle';
      title = 'Queue your first vehicle.';
      copy = 'Setup is ready. Move into inventory and prepare the first vehicle for Marketplace.';
      primaryLabel = 'Open Inventory';
      primaryAction = 'open_inventory';
    } else if (completeCount === totalCount && accessActive && queueCount > 0 && postsUsed === 0 && activeListings === 0) {
      state = 'ready_for_first_post';
      stateLabel = 'Ready For First Post';
      title = 'Post your first vehicle.';
      copy = 'Your first vehicle is queued. Open the posting workflow and finish the first live post.';
      primaryLabel = 'Post First Vehicle';
      primaryAction = 'extension';
    } else if (postsUsed > 0 || activeListings > 0) {
      state = reviewQueue > 0 ? 'activated_needs_action' : 'activated';
      stateLabel = reviewQueue > 0 ? 'Live · Needs Action' : 'Activated';
      title = reviewQueue > 0 ? 'You are live. Clear the next priority.' : 'System live. Keep output moving.';
      copy = reviewQueue > 0
        ? 'First-post value is unlocked. Review the next action queue item to keep output clean.'
        : 'Activation is complete. Stay inside posting, listings, and review workflow.';
      primaryLabel = reviewQueue > 0 ? 'Open Analytics' : 'Open Tools';
      primaryAction = reviewQueue > 0 ? 'tools' : 'extension';
      secondaryLabel = 'Review Listings';
    }

    return {
      checks,
      completeCount,
      totalCount,
      setupPercent,
      queueCount,
      reviewQueue,
      activeListings,
      postsUsed,
      credits,
      accessActive,
      state,
      stateLabel,
      title,
      copy,
      primaryLabel,
      primaryAction,
      secondaryLabel
    };
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderTakeover(model) {
    const overview = document.getElementById('overview');
    const commandCenter = overview?.querySelector('.command-center-grid');
    if (!overview || !commandCenter) return;

    let shell = document.getElementById('bundleCTakeover');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'bundleCTakeover';
      shell.className = 'bundle-c-takeover';
      overview.insertBefore(shell, commandCenter);
    }

    const systemItems = [
      {
        label: 'Setup',
        value: `${model.completeCount}/${model.totalCount} Complete`,
        tone: model.completeCount === model.totalCount ? 'ready' : 'warn'
      },
      {
        label: 'Access',
        value: model.accessActive ? 'Active' : 'Needs Refresh',
        tone: model.accessActive ? 'ready' : 'blocked'
      },
      {
        label: 'Queue',
        value: model.queueCount > 0 ? `${model.queueCount} Ready` : 'No Vehicle Queued',
        tone: model.queueCount > 0 ? 'ready' : 'warn'
      },
      {
        label: 'Compliance',
        value: model.completeCount >= 5 ? 'Configured' : 'Needs Setup',
        tone: model.completeCount >= 5 ? 'ready' : 'warn'
      },
      {
        label: 'Posting',
        value:
          model.state === 'ready_for_first_post' ? 'Ready For First Post' :
          model.state === 'activated' || model.state === 'activated_needs_action' ? 'Live' : 'Not Ready',
        tone:
          model.state === 'ready_for_first_post' || model.state === 'activated' || model.state === 'activated_needs_action'
            ? 'ready'
            : 'warn'
      }
    ];

    const momentum = [
      ['Complete core setup', '+10'],
      ['Finish first post', '+15'],
      ['Queue 3 vehicles', '+10'],
      ['Refer one user', '+25'],
      ['Current balance', escapeHtml(model.credits)]
    ];

    const walkthrough = [
      ['1', 'Save setup', 'Dealer website, inventory URL, scanner, location, and compliance mode.'],
      ['2', 'Open tools', 'Confirm extension access and system readiness.'],
      ['3', 'Open inventory', 'Route into inventory and queue the first vehicle.'],
      ['4', 'Open Marketplace', 'Review autofill and verify compliance output.'],
      ['5', 'Publish first post', 'Complete the first live listing and unlock live dashboard value.']
    ];

    shell.innerHTML = `
      <div class="bundle-c-card">
        <div class="bundle-c-head">
          <div>
            <div class="phase3-section-tag">Activation Control</div>
            <h2>${escapeHtml(model.title)}</h2>
            <p class="subtext">${escapeHtml(model.copy)}</p>
          </div>
          <div class="bundle-c-badge">
            <div class="bundle-c-badge-label">${escapeHtml(model.stateLabel)}</div>
            <div class="bundle-c-badge-value">${escapeHtml(model.setupPercent)}% Ready</div>
          </div>
        </div>

        <div class="bundle-c-system-row">
          ${systemItems.map((item) => `
            <div class="bundle-c-pill ${item.tone}">
              <div class="mini">${escapeHtml(item.label)}</div>
              <strong>${escapeHtml(item.value)}</strong>
            </div>
          `).join('')}
        </div>

        <div class="bundle-c-primary">
          <div>
            <div class="stat-label">Next Best Move</div>
            <div class="bundle-c-primary-label">${escapeHtml(model.primaryLabel)}</div>
            <div class="subtext">${escapeHtml(model.copy)}</div>
          </div>
          <div class="bundle-c-primary-actions">
            <button id="bundleCPrimaryBtn" class="btn-primary" type="button">${escapeHtml(model.primaryLabel)}</button>
            <button id="bundleCSecondaryBtn" class="action-btn" type="button">${escapeHtml(model.secondaryLabel)}</button>
          </div>
        </div>

        <div class="bundle-c-bottom">
          <div class="bundle-c-panel">
            <div class="stat-label">Readiness</div>
            <div class="bundle-c-checklist">
              ${model.checks.map((item) => `
                <div class="bundle-c-check-row">
                  <strong>${escapeHtml(item.label)}</strong>
                  <span class="bundle-c-check-status ${item.tone}">${escapeHtml(item.text)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="bundle-c-panel">
            <div class="stat-label">Momentum</div>
            <div class="bundle-c-muted-note">${model.state === 'activated' || model.state === 'activated_needs_action'
              ? 'Activation is complete. Keep posting and referrals moving to build credits.'
              : 'Credits should follow progress. Complete setup, queue a vehicle, and finish your first post.'}</div>
            <div class="bundle-c-momentum" style="margin-top:12px;">
              ${momentum.map(([label, value]) => `
                <div class="bundle-c-momentum-row">
                  <span>${escapeHtml(label)}</span>
                  <strong>${value}</strong>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-head">
          <div>
            <div class="phase3-section-tag">First Post Sprint</div>
            <h3>First-post path</h3>
          </div>
        </div>
        <div class="bundle-c-walkthrough">
          ${walkthrough.map(([n, title, copy]) => `
            <div class="bundle-c-step">
              <div class="bundle-c-step-num">${n}</div>
              <h4>${escapeHtml(title)}</h4>
              <p>${escapeHtml(copy)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('bundleCPrimaryBtn')?.addEventListener('click', () => runPrimaryAction(model.primaryAction));
    document.getElementById('bundleCSecondaryBtn')?.addEventListener('click', () => {
      if (model.secondaryLabel === 'Review Listings') {
        document.getElementById('overviewListingsCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      shell.querySelector('.bundle-c-walkthrough')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function runPrimaryAction(action) {
    if (action === 'refresh_access') {
      document.getElementById('refreshAccessBtn')?.click();
      return;
    }
    if (action === 'open_inventory') {
      document.getElementById('openInventoryBtn')?.click();
      return;
    }
    if (typeof window.showSection === 'function') {
      if (action === 'profile') window.showSection('profile');
      if (action === 'extension') window.showSection('extension');
      if (action === 'tools') window.showSection('tools');
    }
  }

  function applyHierarchy() {
    const overview = document.getElementById('overview');
    if (!overview) return;
    overview.classList.add('bundle-c-live');
  }

  function render() {
    const overview = document.getElementById('overview');
    if (!overview) return;
    applyHierarchy();
    const model = buildModel();
    renderTakeover(model);
  }

  function boot() {
    render();
    setTimeout(render, 700);
    setTimeout(render, 1800);
    setTimeout(render, 3200);
    setTimeout(render, 5200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
