(() => {
  if (window.__ELEVATE_BUNDLE_C_OVERVIEW__) return;
  window.__ELEVATE_BUNDLE_C_OVERVIEW__ = true;

  // Bundle C is intentionally limited to overview-only behaviour.
  // It must never inject Execution Hub scripts. Execution Hub is owned only by
  // dashboard-section-governor.js to prevent renderer conflicts and blank screens.

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

  function setupStatus(id) {
    const el = document.getElementById(id);
    if (!el) return { ok: false, tone: 'pending', text: 'Missing' };
    const value = clean(el.textContent).toLowerCase();
    const ok = el.classList.contains('good') || value.includes('ready') || value.includes('saved') || value.includes('active') || value.includes('configured') || value.includes('complete');
    return { ok, tone: ok ? 'ready' : (value.includes('inactive') || value.includes('blocked') ? 'blocked' : 'pending'), text: ok ? 'Ready' : 'Missing' };
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

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildModel() {
    const checks = getChecks();
    const completeCount = checks.filter((c) => c.ok).length;
    const totalCount = checks.length || 1;
    const queueCount = parseIntegerLoose(text('kpiQueuedVehicles'));
    const reviewQueue = parseIntegerLoose(text('kpiReviewQueue'));
    const activeListings = parseIntegerLoose(text('kpiActiveListings'));
    const postsUsedRaw = text('commandPostsUsed');
    const postsUsed = parseIntegerLoose(postsUsedRaw.split('/')[0] || postsUsedRaw);
    const setupPercentRaw = text('commandSetupProgress') || text('setupReadinessPercent') || text('commandSetupChip');
    const setupMatch = setupPercentRaw.match(/(\d{1,3})/);
    const setupPercent = setupMatch ? Math.max(0, Math.min(100, Number(setupMatch[1]))) : Math.round((completeCount / totalCount) * 100);
    const accessActive = checks.find((c) => c.label === 'Access active')?.ok;

    let stateLabel = 'Setup Incomplete';
    let title = 'Complete setup to unlock first-post value.';
    let copy = 'Finish the required setup fields so the system can route you into inventory and posting.';
    let primaryLabel = 'Complete Setup';
    let primaryAction = 'profile';

    if (completeCount === totalCount && !accessActive) {
      stateLabel = 'Access Blocked';
      title = 'Refresh access before posting.';
      copy = 'Your setup is saved, but account access is not active yet.';
      primaryLabel = 'Refresh Access';
      primaryAction = 'refresh_access';
    } else if (completeCount === totalCount && accessActive && queueCount === 0 && postsUsed === 0 && activeListings === 0) {
      stateLabel = 'Queue First Vehicle';
      title = 'Queue your first vehicle.';
      copy = 'Setup is ready. Move into inventory and prepare the first vehicle for Marketplace.';
      primaryLabel = 'Open Inventory';
      primaryAction = 'open_inventory';
    } else if (completeCount === totalCount && accessActive && queueCount > 0 && postsUsed === 0 && activeListings === 0) {
      stateLabel = 'Ready For First Post';
      title = 'Post your first vehicle.';
      copy = 'Your first vehicle is queued. Open the posting workflow and finish the first live post.';
      primaryLabel = 'Post First Vehicle';
      primaryAction = 'extension';
    } else if (postsUsed > 0 || activeListings > 0) {
      stateLabel = reviewQueue > 0 ? 'Live · Needs Action' : 'Activated';
      title = reviewQueue > 0 ? 'You are live. Clear the next priority.' : 'System live. Keep output moving.';
      copy = reviewQueue > 0 ? 'First-post value is unlocked. Review the next action queue item to keep output clean.' : 'Activation is complete. Stay inside posting, listings, and review workflow.';
      primaryLabel = reviewQueue > 0 ? 'Open Analytics' : 'Open Tools';
      primaryAction = reviewQueue > 0 ? 'tools' : 'extension';
    }

    return { checks, completeCount, totalCount, setupPercent, stateLabel, title, copy, primaryLabel, primaryAction };
  }

  function runPrimaryAction(action) {
    if (action === 'refresh_access') return document.getElementById('refreshAccessBtn')?.click();
    if (action === 'open_inventory') return document.getElementById('openInventoryBtn')?.click();
    if (typeof window.showSection === 'function') {
      if (action === 'profile') window.showSection('profile');
      if (action === 'extension') window.showSection('extension');
      if (action === 'tools') window.showSection('tools');
    }
  }

  function renderTakeover() {
    const overview = document.getElementById('overview');
    const commandCenter = overview?.querySelector('.command-center-grid');
    if (!overview || !commandCenter) return;
    const model = buildModel();
    let shell = document.getElementById('bundleCTakeover');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'bundleCTakeover';
      shell.className = 'bundle-c-takeover';
      overview.insertBefore(shell, commandCenter);
    }

    const systemItems = [
      { label: 'Setup', value: `${model.completeCount}/${model.totalCount} Complete`, tone: model.completeCount === model.totalCount ? 'ready' : 'warn' },
      { label: 'Readiness', value: `${model.setupPercent}% Ready`, tone: model.setupPercent >= 90 ? 'ready' : 'warn' }
    ];

    shell.innerHTML = `<div class="bundle-c-card"><div class="bundle-c-head"><div><div class="phase3-section-tag">Activation Control</div><h2>${escapeHtml(model.title)}</h2><p class="subtext">${escapeHtml(model.copy)}</p></div><div class="bundle-c-badge"><div class="bundle-c-badge-label">${escapeHtml(model.stateLabel)}</div><div class="bundle-c-badge-value">${escapeHtml(model.setupPercent)}% Ready</div></div></div><div class="bundle-c-system-row">${systemItems.map((item) => `<div class="bundle-c-pill ${item.tone}"><div class="mini">${escapeHtml(item.label)}</div><strong>${escapeHtml(item.value)}</strong></div>`).join('')}</div><div class="bundle-c-primary"><div><div class="stat-label">Next Best Move</div><div class="bundle-c-primary-label">${escapeHtml(model.primaryLabel)}</div><div class="subtext">${escapeHtml(model.copy)}</div></div><div class="bundle-c-primary-actions"><button id="bundleCPrimaryBtn" class="btn-primary" type="button">${escapeHtml(model.primaryLabel)}</button></div></div></div>`;

    document.getElementById('bundleCPrimaryBtn')?.addEventListener('click', () => runPrimaryAction(model.primaryAction));
  }

  function render() {
    document.getElementById('overview')?.classList.add('bundle-c-live');
    renderTakeover();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
  window.addEventListener('elevate:summary-ready', () => setTimeout(render, 100));
})();
