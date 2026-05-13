(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.executionHubP3) return;

  const MODULE_META = {
    reactivation_engine: {
      valueTitle: 'Lead Revival',
      valueCopy: 'Turn older leads back into active conversations, appointment opportunities, and second-life deal flow.',
      bullets: [
        'Segment old leads and push targeted campaigns fast.',
        'Convert dormant pipeline into fresh reply volume.',
        'Use the data you already own instead of always chasing new leads.'
      ]
    },
    pipeline_engine: {
      valueTitle: 'Pipeline Control',
      valueCopy: 'Bring deal stage, ownership, urgency, and task pressure into one cleaner operator workflow.',
      bullets: [
        'Track stage progression and ownership cleanly.',
        'Reduce mental load from scattered notes and inboxes.',
        'Make active pipeline movement visible.'
      ]
    },
    follow_up_engine: {
      valueTitle: 'Persistence Layer',
      valueCopy: 'Automate enough follow-up pressure to keep more warm opportunities alive without constant manual chasing.',
      bullets: [
        'Timed reminders and no-response nudges.',
        'Appointment prompts and stalled-deal recovery.',
        'Less opportunity leakage from inconsistent follow-up.'
      ]
    },
    content_engine: {
      valueTitle: 'Content Throughput',
      valueCopy: 'Generate more platform-ready sales content without adding more manual writing friction to the operator.',
      bullets: [
        'Descriptions, captions, hooks, and prompts.',
        'Faster content output from the same listing flow.',
        'Cleaner speed-to-posting across channels.'
      ]
    },
    distribution_hub: {
      valueTitle: 'Reach Expansion',
      valueCopy: 'Stretch the same listing effort across more surfaces and generate more exposure from the same inventory.',
      bullets: [
        'Marketplace plus future distribution surfaces.',
        'Less duplicate manual posting work.',
        'More reach from the same execution motion.'
      ]
    },
    market_intelligence: {
      valueTitle: 'Decision Intelligence',
      valueCopy: 'Use stale risk, pricing pressure, and performance signals to guide stronger posting decisions.',
      bullets: [
        'See stale-risk and pricing pressure sooner.',
        'Improve refresh, title, and pricing decisions.',
        'Turn analytics into operator action.'
      ]
    }
  };

  const CSS = `
    .xhp3-plan-row{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;margin-bottom:14px}
    .xhp3-plan-balance{font-size:40px;line-height:1;font-weight:800;color:#f3ddb0;margin-bottom:6px}
    .xhp3-plan-stat-stack{display:grid;gap:8px;text-align:right;font-size:14px;color:#a9a9a9}
    .xhp3-plan-stat-stack strong{color:#f5f5f5;font-size:18px;margin-right:6px}
    .xhp3-plan-callout,.xhp3-upgrade-copy{background:#171717;border:1px solid rgba(255,255,255,.05);border-radius:14px;padding:14px 16px;color:#d9d9d9;line-height:1.55}
    .xhp3-plan-chip-row,.xhp3-credit-pills{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
    .xhp3-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}
    .xhp3-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.9fr);gap:18px;margin-top:18px}
    .xhp3-card{background:linear-gradient(180deg, rgba(255,255,255,.018), rgba(255,255,255,.006));border:1px solid rgba(212,175,55,.12);border-radius:18px;padding:18px}
    .xhp3-list{display:grid;gap:10px}
    .xhp3-item{background:#161616;border:1px solid rgba(255,255,255,.05);border-radius:14px;padding:14px}
    .xhp3-item-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}
    .xhp3-item-title{font-size:14px;font-weight:700;line-height:1.35}
    .xhp3-item-copy{font-size:13px;color:#a9a9a9;line-height:1.55}
    .xhp3-preview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}
    .xhp3-metric{background:#171717;border:1px solid rgba(255,255,255,.05);border-radius:16px;padding:16px}
    .xhp3-metric .value{font-size:26px;font-weight:700;line-height:1.05;margin-top:8px}
    .xhp3-empty{padding:20px;border-radius:16px;border:1px dashed rgba(212,175,55,.18);background:#111;color:#a9a9a9;text-align:center}
    .xhp3-hide-legacy{display:none !important}
    @media (max-width:1200px){.xhp3-grid{grid-template-columns:1fr}}
    @media (max-width:760px){.xhp3-actions,.xhp3-preview-grid{grid-template-columns:1fr}.xhp3-plan-row{display:grid;text-align:left}.xhp3-plan-stat-stack{text-align:left}}
  `;

  function ensureStyle() {
    if (document.getElementById('execution-hub-p3-style')) return;
    const s = document.createElement('style');
    s.id = 'execution-hub-p3-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function num(value) { const n = Number(String(value || '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; }
  function money(value) { const n = Number(value || 0); return Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : '$0'; }
  function escapeHtml(value) { return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function badge(value) {
    const normalized = clean(value).toLowerCase();
    let cls = 'warn';
    if (/ready|active|connected|live|synced|healthy|yes/.test(normalized)) cls = 'good';
    if (/blocked|missing|disconnected|not ready|error|locked/.test(normalized)) cls = 'blocked';
    return `<span class="xh-badge ${cls}">${escapeHtml(value || 'Unknown')}</span>`;
  }

  function getSummary() { return window.dashboardSummary || {}; }
  function getListings() {
    if (Array.isArray(window.dashboardListings) && window.dashboardListings.length) return window.dashboardListings;
    if (Array.isArray(getSummary().recent_listings) && getSummary().recent_listings.length) return getSummary().recent_listings;
    return [];
  }
  function getPlan() {
    const s = getSummary();
    const account = s.account_snapshot || {};
    const access = s.plan_access || {};
    const sub = (window.currentNormalizedSession && window.currentNormalizedSession.subscription) || {};
    const planLabel = clean(access.plan_label || sub.plan || account.plan || 'Founder Beta') || 'Founder Beta';
    const postingLimit = Math.max(num(access.posting_limit || sub.posting_limit || sub.daily_posting_limit || account.posting_limit || account.base_posting_limit), 5);
    const usedToday = Math.max(num(sub.posts_today || account.posts_today || account.posts_used_today || s.posts_today), 0);
    const remaining = Math.max(num(sub.posts_remaining || account.posts_remaining), Math.max(postingLimit - usedToday, 0));
    const isPro = Boolean(access.is_pro) || /pro/i.test(planLabel);
    const upgradeTarget = clean(access.upgrade_target || (isPro ? 'Pro' : /founder/i.test(planLabel) ? 'Founder Pro' : 'Pro'));
    return { planLabel, postingLimit, usedToday, remaining, isPro, upgradeTarget };
  }
  function getCredits() {
    const s = getSummary();
    const credits = s.credits || s.credit_snapshot || s.user_credits || {};
    return { balance: num(credits.balance || credits.current_balance || credits.credits_balance), earned: num(credits.lifetime_earned || credits.earned), spent: num(credits.lifetime_spent || credits.spent) };
  }
  function getUpgradePrompt() {
    const prompts = Array.isArray(getSummary().upgrade_prompts) ? getSummary().upgrade_prompts : [];
    return prompts.find((item) => clean(item.placement || 'tools') === 'tools') || null;
  }
  function getLockedModules() { return Array.isArray(getSummary().locked_modules) ? getSummary().locked_modules : []; }
  function getModuleKey() { return clean(localStorage.getItem('ea_execution_module_v2') || 'vehicle_poster') || 'vehicle_poster'; }
  function findModuleLock(moduleKey) {
    const map = {
      reactivation_engine: ['reactivation', 'sms'],
      pipeline_engine: ['crm', 'pipeline'],
      follow_up_engine: ['follow'],
      content_engine: ['content', 'ai'],
      distribution_hub: ['distribution', 'groups'],
      market_intelligence: ['market', 'intelligence']
    };
    const needles = map[moduleKey] || [];
    return getLockedModules().find((item) => needles.some((needle) => clean(item.title || '').toLowerCase().includes(needle))) || null;
  }

  function bindAction(btn) {
    if (!btn || btn.dataset.boundXhp3 === 'true') return;
    btn.dataset.boundXhp3 = 'true';
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-xhp3-action');
      if (action === 'billing' && typeof window.showSection === 'function') window.showSection('billing', { scroll: false });
      if (action === 'partners' && typeof window.showSection === 'function') window.showSection('partners', { scroll: false });
      if (action === 'vehicle' && typeof window.showSection === 'function') {
        localStorage.setItem('ea_execution_module_v2', 'vehicle_poster');
        window.dispatchEvent(new Event('elevate:tracking-refreshed'));
      }
    });
  }

  function renderPlanCard() {
    const host = document.querySelector('#executionHubV2Shell .xh-side-stack');
    if (!host) return;
    let card = host.querySelector('#executionHubPlanCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'executionHubPlanCard';
      card.className = 'xh-side-card';
      host.appendChild(card);
    }
    const plan = getPlan();
    const credits = getCredits();
    const prompt = getUpgradePrompt();
    card.innerHTML = `
      <div class="xh-eyebrow">Plan & Access</div>
      <div class="xhp3-plan-row">
        <div>
          <div class="xhp3-plan-balance">${escapeHtml(plan.planLabel)}</div>
          <div class="subtext">Execution capacity, credits, and upgrade leverage on the active account.</div>
        </div>
        <div class="xhp3-plan-stat-stack">
          <div><strong>${plan.postingLimit}</strong> daily capacity</div>
          <div><strong>${plan.usedToday}</strong> used today</div>
          <div><strong>${plan.remaining}</strong> remaining</div>
        </div>
      </div>
      <div class="xhp3-plan-chip-row"><span class="xh-pill">${plan.isPro ? 'Pro Access Active' : `${escapeHtml(plan.upgradeTarget)} path`}</span><span class="xh-pill">${credits.balance} credits</span></div>
      <div class="xhp3-plan-callout">${escapeHtml(clean((prompt && prompt.copy) || (plan.isPro ? 'The current plan already unlocks expanded execution capacity.' : `${plan.planLabel} currently includes the live poster. ${plan.upgradeTarget} is where more execution leverage will unlock.`)))}</div>
      <div class="xhp3-actions">
        <button class="action-btn" type="button" data-xhp3-action="billing">Open Plan & Access</button>
        <button class="action-btn" type="button" data-xhp3-action="partners">Partner Network</button>
      </div>
    `;
    card.querySelectorAll('[data-xhp3-action]').forEach(bindAction);
  }

  function renderVehiclePosterEnhancements() {
    if (getModuleKey() !== 'vehicle_poster') return;
    const shell = document.querySelector('#executionHubV2Shell .xh-workspace-shell');
    if (!shell || shell.querySelector('#executionHubP3Vehicle')) return;
    const listings = getListings().slice().sort((a,b) => new Date(b.posted_at || b.created_at || 0) - new Date(a.posted_at || a.created_at || 0)).slice(0,4);
    const locked = getLockedModules().filter((item) => !item.unlocked).slice(0,3);
    const plan = getPlan();
    const credits = getCredits();
    const wrap = document.createElement('div');
    wrap.id = 'executionHubP3Vehicle';
    wrap.className = 'xhp3-grid';
    wrap.innerHTML = `
      <div class="xhp3-card">
        <div class="section-head"><div><h3 style="font-size:22px;margin-bottom:8px;">Recent Post Results</h3><div class="subtext">Vehicle Poster should show recent output, not just static controls.</div></div></div>
        ${listings.length ? `<div class="xhp3-list">${listings.map((row, index) => {
          const title = clean(row.title || [row.year, row.make, row.model].filter(Boolean).join(' ') || `Listing ${index + 1}`);
          const subtitle = clean([row.stock_number || row.vin, row.location, row.status || row.lifecycle_status].filter(Boolean).join(' • ')) || 'Tracked listing';
          return `<div class="xhp3-item"><div class="xhp3-item-head"><div class="xhp3-item-title">${escapeHtml(title)}</div>${badge(money(row.price || 0))}</div><div class="xhp3-item-copy">${escapeHtml(subtitle)}</div></div>`;
        }).join('')}</div>` : `<div class="xhp3-empty">No recent post results are flowing in yet.</div>`}
      </div>
      <div class="xhp3-card">
        <div class="section-head"><div><h3 style="font-size:22px;margin-bottom:8px;">Revenue & Unlock Layer</h3><div class="subtext">Execution Hub should show how usage, credits, and unlocks turn into retained value.</div></div></div>
        <div class="xhp3-upgrade-copy">${escapeHtml(`${plan.planLabel} is currently carrying ${plan.usedToday}/${plan.postingLimit} daily posting capacity. ${plan.remaining} units remain today.`)}</div>
        <div class="xhp3-credit-pills"><span class="xh-pill">${credits.balance} credits</span><span class="xh-pill">${credits.earned} earned</span><span class="xh-pill">${credits.spent} spent</span></div>
        ${locked.length ? `<div class="xhp3-list" style="margin-top:14px;">${locked.map((item) => `<div class="xhp3-item"><div class="xhp3-item-head"><div class="xhp3-item-title">${escapeHtml(item.title || 'Premium module')}</div>${badge('Locked')}</div><div class="xhp3-item-copy">${escapeHtml(clean(item.teaser || item.reason || 'Premium execution layer'))}</div></div>`).join('')}</div>` : `<div class="xhp3-upgrade-copy" style="margin-top:14px;">No premium module blockers are currently surfacing from the live summary snapshot.</div>`}
        <div class="xhp3-actions"><button class="action-btn" type="button" data-xhp3-action="billing">Open Plan & Access</button></div>
      </div>
    `;
    shell.appendChild(wrap);
    wrap.querySelectorAll('[data-xhp3-action]').forEach(bindAction);
  }

  function renderPreviewEnhancement() {
    const key = getModuleKey();
    if (key === 'vehicle_poster') return;
    const shell = document.querySelector('#executionHubV2Shell .xh-workspace-shell');
    if (!shell) return;
    const layout = shell.querySelector('.xh-preview-layout');
    if (!layout || layout.dataset.xhp3Applied === 'true') return;
    layout.dataset.xhp3Applied = 'true';
    const meta = MODULE_META[key];
    if (!meta) return;
    const plan = getPlan();
    const lock = findModuleLock(key);
    const prompt = getUpgradePrompt();
    const status = lock ? `Locked • ${plan.upgradeTarget}` : 'Planned';
    const unlockCopy = lock ? clean(lock.teaser || lock.reason || `${meta.valueTitle} is positioned as a higher-leverage execution layer.`) : clean((prompt && prompt.copy) || `${meta.valueTitle} is part of the broader execution stack planned around the live Vehicle Poster.`);
    layout.innerHTML = `
      <div class="xhp3-card">
        <div class="section-head"><div><h3 style="font-size:22px;margin-bottom:8px;">Module Preview</h3><div class="subtext">This is a premium preview of a planned execution layer inside the broader Elevate stack.</div></div></div>
        <div class="xhp3-upgrade-copy" style="margin-bottom:14px;">${escapeHtml(meta.valueCopy)}</div>
        <div class="xhp3-list">${meta.bullets.map((item) => `<div class="xhp3-item"><div class="xhp3-item-copy">${escapeHtml(item)}</div></div>`).join('')}</div>
        <div class="xhp3-preview-grid">
          <div class="xhp3-metric"><div class="xh-eyebrow">Commercial Role</div><div class="value">${escapeHtml(meta.valueTitle)}</div><div class="subtext">How this module expands operator value.</div></div>
          <div class="xhp3-metric"><div class="xh-eyebrow">Unlock Path</div><div class="value">${escapeHtml(lock ? plan.upgradeTarget : 'Roadmap')}</div><div class="subtext">How this layer will be positioned commercially.</div></div>
        </div>
      </div>
      <div class="xhp3-card">
        <div class="xhp3-metric"><div class="xh-eyebrow">Why It Matters</div><div class="value">Execution Leverage</div><div class="subtext">${escapeHtml(unlockCopy)}</div></div>
        <div class="xhp3-credit-pills"><span class="xh-pill">${escapeHtml(plan.planLabel)}</span><span class="xh-pill">${escapeHtml(status)}</span></div>
        <div class="xhp3-actions"><button class="action-btn" type="button" data-xhp3-action="vehicle">Return to Vehicle Poster</button><button class="action-btn" type="button" data-xhp3-action="billing">Open Plan & Access</button></div>
      </div>
    `;
    layout.querySelectorAll('[data-xhp3-action]').forEach(bindAction);
  }

  function relabelExecutionHub() {
    const extensionSection = document.getElementById('extension');
    if (extensionSection) {
      const primaryHeader = extensionSection.querySelector('h1');
      if (primaryHeader) primaryHeader.textContent = 'Execution Hub';
      const headerBlock = extensionSection.querySelector('.main-header');
      if (headerBlock) {
        const sub = headerBlock.querySelector('.subtext');
        if (sub) sub.textContent = 'Live execution surface for Vehicle Poster, posting readiness, monetization leverage, and future platform modules.';
      }
    }

    const buttons = Array.from(document.querySelectorAll('.sidebar-nav .nav-btn'));
    const labels = {
      overview: { label: 'Command Centre', detail: 'Overview' },
      tools: { label: 'Execution Hub', detail: 'Vehicle Poster, execution' },
      analytics: { label: 'Intelligence Centre', detail: 'Listings, review, performance' },
      compliance: { label: 'Compliance', detail: 'AB/BC readiness, disclosures' },
      partners: { label: 'Partner Network', detail: 'Affiliates, referrals, growth' },
      setup: { label: 'Activation', detail: 'Profile, dealer, activation' },
      billing: { label: 'Plan & Access', detail: 'Plan, access, usage' }
    };

    buttons.forEach((btn) => {
      const key = clean(btn.dataset.eaNavKey || btn.dataset.section || btn.getAttribute('data-section'));
      const item = labels[key];
      if (!item) return;
      const label = btn.querySelector('.ea-nav-label');
      const detail = btn.querySelector('.ea-nav-detail');
      if (label) label.textContent = item.label;
      if (detail) detail.textContent = item.detail;
      btn.setAttribute('aria-label', item.label);
    });
  }

  function hideLegacyBottomCards() {
    const section = document.getElementById('extension');
    if (!section) return;
    const cards = Array.from(section.querySelectorAll('.card'));
    cards.forEach((card) => {
      if (card.closest('#executionHubV2Shell')) return;
      const text = clean(card.textContent || '').toLowerCase();
      const shouldHide = /review queue|stale listings|scanner type|dealer website|inventory url|listing location|compliance mode|download extension|open marketplace|open inventory url|refresh extension state|view setup steps|posts used today|review pressure|backlog remaining|platform stack|tool unlock path|workflow engine/.test(text);
      if (shouldHide) card.classList.add('xhp3-hide-legacy');
    });
  }

  function enhance() {
    ensureStyle();
    relabelExecutionHub();
    renderPlanCard();
    renderVehiclePosterEnhancements();
    renderPreviewEnhancement();
    hideLegacyBottomCards();
  }

  NS.modules = NS.modules || {};
  NS.modules.executionHubP3 = true;
  window.addEventListener('load', enhance);
  window.addEventListener('elevate:tracking-refreshed', () => setTimeout(enhance, 50));
  window.addEventListener('elevate:summary-ready', () => setTimeout(enhance, 50));
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(enhance, 50), { once: true });
  } else {
    setTimeout(enhance, 50);
  }
})();
