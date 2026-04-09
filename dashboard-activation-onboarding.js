(() => {
  if (window.__ELEVATE_BUNDLE_A_ACTIVATION__) return;
  window.__ELEVATE_BUNDLE_A_ACTIVATION__ = true;

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function text(id) {
    return clean(document.getElementById(id)?.textContent || '');
  }

  function parsePercent(value) {
    const m = clean(value).match(/(\d{1,3})/);
    return m ? Math.max(0, Math.min(100, Number(m[1]))) : 0;
  }

  function isGoodStatus(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    const txt = clean(el.textContent).toLowerCase();
    return el.classList.contains('good') || txt.includes('ready') || txt.includes('saved') || txt.includes('active') || txt.includes('configured');
  }

  function openSection(name) {
    try {
      if (typeof window.showSection === 'function') {
        window.showSection(name);
      }
    } catch {}
  }

  function focusField(id) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try { el.focus(); } catch {}
    }
  }

  function buildState() {
    const setupPercent = parsePercent(text('commandSetupProgress') || text('setupReadinessPercent') || text('commandSetupChip'));
    const postsRemaining = text('kpiPostsRemaining') || text('snapshotPostsRemaining') || '0';
    const credits = text('kpiCreditsBalance') || text('commandCreditsBalance') || '0';
    const queue = text('kpiQueuedVehicles') || '0';

    const checks = [
      { label: 'Dealer website saved', ok: isGoodStatus('setupDealerWebsite') || isGoodStatus('extSetupDealerWebsite') },
      { label: 'Inventory URL saved', ok: isGoodStatus('setupInventoryUrl') || isGoodStatus('extSetupInventoryUrl') },
      { label: 'Scanner selected', ok: isGoodStatus('setupScannerType') || isGoodStatus('extSetupScannerType') },
      { label: 'Listing location set', ok: isGoodStatus('setupListingLocation') || isGoodStatus('extSetupListingLocation') },
      { label: 'Compliance ready', ok: isGoodStatus('setupComplianceMode') || isGoodStatus('extSetupComplianceMode') },
      { label: 'Access active', ok: isGoodStatus('setupAccess') || isGoodStatus('extSetupAccess') }
    ];

    const completeCount = checks.filter(c => c.ok).length;
    const firstPostReady = completeCount >= 5;
    const nextAction =
      !checks[0].ok ? { label: 'Add dealer website', section: 'profile', focus: 'dealer_website' } :
      !checks[1].ok ? { label: 'Add inventory URL', section: 'profile', focus: 'inventory_url' } :
      !checks[2].ok ? { label: 'Choose scanner type', section: 'profile', focus: 'scanner_type' } :
      !checks[3].ok ? { label: 'Set listing location', section: 'profile', focus: 'listing_location' } :
      !checks[4].ok ? { label: 'Set compliance mode', section: 'profile', focus: 'compliance_mode' } :
      !checks[5].ok ? { label: 'Refresh account access', section: 'extension', focus: null } :
      { label: 'Post your first vehicle', section: 'extension', focus: null };

    return {
      setupPercent,
      postsRemaining,
      credits,
      queue,
      checks,
      completeCount,
      firstPostReady,
      nextAction
    };
  }

  function render() {
    const overview = document.getElementById('overview');
    const tools = document.getElementById('extension');
    if (!overview || !tools) return;

    const state = buildState();

    let shell = document.getElementById('activationShell');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'activationShell';
      shell.className = 'activation-shell';
      const anchor = document.querySelector('#overview .command-center-grid') || overview.firstElementChild;
      if (anchor) anchor.insertAdjacentElement('afterend', shell);
    }

    shell.innerHTML = `
      <div class="activation-grid">
        <div class="activation-card">
          <div class="activation-eyebrow">Activation Engine</div>
          <div class="activation-title-row">
            <div>
              <h2>Get to first post fast.</h2>
              <div class="activation-subtext">This flow is built to answer setup questions before they become support messages.</div>
            </div>
            <div class="activation-badge">${state.setupPercent}% Activated</div>
          </div>

          <div class="activation-progress">
            <div class="activation-progress-bar"><div class="activation-progress-fill" style="width:${state.setupPercent}%"></div></div>
            <div class="activation-meta">
              <div class="activation-meta-item">
                <div class="activation-meta-label">Setup Progress</div>
                <div class="activation-meta-value">${state.completeCount} / ${state.checks.length}</div>
              </div>
              <div class="activation-meta-item">
                <div class="activation-meta-label">Queue Ready</div>
                <div class="activation-meta-value">${state.queue}</div>
              </div>
              <div class="activation-meta-item activation-credit-card">
                <div class="activation-meta-label">Credits Available</div>
                <div class="activation-meta-value">${state.credits}</div>
              </div>
            </div>
          </div>

          <div class="activation-checklist">
            ${state.checks.map((item) => `
              <div class="activation-check ${item.ok ? 'good' : 'warn'}">
                <span>${item.label}</span>
                <strong>${item.ok ? 'Ready' : 'Pending'}</strong>
              </div>
            `).join('')}
          </div>

          <div class="activation-actions">
            <button id="activationPrimaryBtn" class="btn-primary" type="button">${state.nextAction.label}</button>
            <button id="activationWalkthroughBtn" class="action-btn" type="button">See first-post walkthrough</button>
            <button id="activationOpenToolsBtn" class="action-btn" type="button">Open posting tools</button>
            <button id="activationOpenSetupBtn" class="action-btn" type="button">Open setup</button>
          </div>
        </div>

        <div class="activation-card activation-credit-card">
          <div class="activation-eyebrow">Credits & Momentum</div>
          <div class="activation-title-row">
            <div>
              <h2>Earn value while activating.</h2>
              <div class="activation-subtext">Credits should reward real operator progress — not sit on screen without meaning.</div>
            </div>
            <div class="activation-badge">Live reward path</div>
          </div>
          <div class="activation-credit-list">
            <div class="activation-credit-item"><span>Complete core setup</span><span class="value">+10 credits</span></div>
            <div class="activation-credit-item"><span>Finish first post</span><span class="value">+15 credits</span></div>
            <div class="activation-credit-item"><span>Queue 3 vehicles</span><span class="value">+10 credits</span></div>
            <div class="activation-credit-item"><span>Refer one user</span><span class="value">+25 credits</span></div>
          </div>
          <div class="activation-inline-note" id="activationCreditPrompt">
            ${state.firstPostReady ? 'You are close to first-post value. Use the walkthrough, publish one listing, and unlock your first activation milestone.' : 'Finish the setup blockers first. Credits should follow real actions like setup completion, first post, and repeatable use.'}
          </div>
        </div>
      </div>

      <div class="activation-grid">
        <div class="activation-card">
          <div class="activation-eyebrow">First Post Sprint</div>
          <div class="activation-title-row">
            <div>
              <h2>How to get set up without asking 10,000 questions.</h2>
              <div class="activation-subtext">Simple, direct, operator-first walkthrough.</div>
            </div>
          </div>
          <div class="activation-steps">
            <div class="activation-step">
              <div class="activation-step-num">1</div>
              <div><h3>Save setup basics</h3><p>Dealer website, inventory URL, scanner type, listing location, and compliance mode must be saved first.</p></div>
            </div>
            <div class="activation-step">
              <div class="activation-step-num">2</div>
              <div><h3>Download and open the extension tools</h3><p>Use the Tools page to download the extension, refresh access, and confirm system state before posting.</p></div>
            </div>
            <div class="activation-step">
              <div class="activation-step-num">3</div>
              <div><h3>Open inventory and queue a vehicle</h3><p>Once the dealer routing is correct, open your inventory URL and prepare the first vehicle to send into Marketplace.</p></div>
            </div>
            <div class="activation-step">
              <div class="activation-step-num">4</div>
              <div><h3>Open Marketplace and verify autofill</h3><p>Review the autofill, confirm compliance output, and make sure the listing is clean before publishing.</p></div>
            </div>
            <div class="activation-step">
              <div class="activation-step-num">5</div>
              <div><h3>Publish first post and unlock baseline value</h3><p>Your dashboard becomes far more useful after the first live post because listings, signals, and operator feedback start flowing.</p></div>
            </div>
          </div>
          <div class="activation-inline-note">If setup is incomplete, the next-best-step button above should always be your first move.</div>
        </div>

        <div class="activation-help-grid">
          <div class="activation-help-card">
            <h3>Need setup help?</h3>
            <p>Open Setup and complete the missing required fields first. That solves most activation problems.</p>
            <button id="activationHelpSetupBtn" class="action-btn" type="button">Go to Setup</button>
          </div>
          <div class="activation-help-card">
            <h3>Need posting help?</h3>
            <p>Open Tools to refresh extension state, open inventory, and launch Marketplace from one panel.</p>
            <button id="activationHelpToolsBtn" class="action-btn" type="button">Open Tools</button>
          </div>
          <div class="activation-help-card">
            <h3>Need compliance help?</h3>
            <p>Use the Compliance panel to confirm publish readiness and fix missing province-specific requirements.</p>
            <button id="activationHelpComplianceBtn" class="action-btn" type="button">Open Compliance</button>
          </div>
        </div>
      </div>
    `;

    const primary = document.getElementById('activationPrimaryBtn');
    if (primary) primary.onclick = () => {
      openSection(state.nextAction.section);
      if (state.nextAction.focus) {
        setTimeout(() => focusField(state.nextAction.focus), 250);
      }
    };

    const walkthrough = document.getElementById('activationWalkthroughBtn');
    if (walkthrough) walkthrough.onclick = () => {
      const target = shell.querySelector('.activation-steps');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const toolsBtn = document.getElementById('activationOpenToolsBtn');
    if (toolsBtn) toolsBtn.onclick = () => openSection('extension');

    const setupBtn = document.getElementById('activationOpenSetupBtn');
    if (setupBtn) setupBtn.onclick = () => openSection('profile');

    const helpSetup = document.getElementById('activationHelpSetupBtn');
    if (helpSetup) helpSetup.onclick = () => openSection('profile');

    const helpTools = document.getElementById('activationHelpToolsBtn');
    if (helpTools) helpTools.onclick = () => openSection('extension');

    const helpCompliance = document.getElementById('activationHelpComplianceBtn');
    if (helpCompliance) helpCompliance.onclick = () => openSection('compliance');
  }

  function boot() {
    render();
    setTimeout(render, 1200);
    setTimeout(render, 3000);
    setTimeout(render, 5500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
