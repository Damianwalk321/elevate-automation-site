(() => {
  if (window.__ELEVATE_BUNDLE_B_OVERVIEW__) return;
  window.__ELEVATE_BUNDLE_B_OVERVIEW__ = true;

  function clean(v){ return String(v || '').replace(/\s+/g, ' ').trim(); }

  function collapseBootStatus() {
    const boot = document.getElementById('bootStatus');
    if (!boot) return;
    const txt = clean(boot.textContent).toLowerCase();
    if (txt.includes('hydrated') || txt.includes('ready') || txt.includes('usable')) {
      boot.textContent = 'System ready';
      boot.style.opacity = '0.62';
    }
  }

  function promoteActivation() {
    const overview = document.getElementById('overview');
    const command = overview?.querySelector('.command-center-grid');
    const activation = document.getElementById('activationShell');
    const strip = document.getElementById('overviewOperatorStrip');
    if (!overview || !command || !activation || !strip) return;

    if (activation.previousElementSibling !== command) {
      command.insertAdjacentElement('afterend', activation);
    }

    const rightCards = overview.querySelectorAll('.command-side-stack .command-side-card');
    const creditsCard = rightCards[0];
    if (creditsCard) {
      const balance = clean(document.getElementById('commandCreditsBalance')?.textContent || '0');
      if (balance === '0' || balance === '$0' || balance === '$0.00') {
        creditsCard.style.opacity = '0.88';
      }
    }
  }

  function tightenCopy() {
    const status = document.getElementById('commandCenterSubtext');
    if (status && /loading/i.test(status.textContent)) {
      status.textContent = 'Work the next best move, then push inventory forward.';
    }
    const blockers = document.getElementById('overviewBlockers');
    if (blockers && /loading/i.test(blockers.textContent)) {
      blockers.textContent = 'Watch setup, queue, and listing health from one surface.';
    }
  }

  function run() {
    collapseBootStatus();
    promoteActivation();
    tightenCopy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  setTimeout(run, 900);
  setTimeout(run, 2400);
  setTimeout(run, 4200);
})();
