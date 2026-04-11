(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase4readiness) return;

  const STYLE_ID = "ea-phase4-readiness-styles";
  const STYLE = `
    .ea-phase4-hidden { display: none !important; }
    .ea-readiness-badge {
      display:inline-flex; align-items:center; min-height:32px; padding:0 12px; border-radius:999px;
      font-size:12px; font-weight:700; letter-spacing:.04em; border:1px solid rgba(255,255,255,0.08);
      background:#171717; color:#f3ddb0;
    }
    .ea-readiness-badge.ready { color:#9de8a8; border-color:rgba(157,232,168,0.22); background:rgba(46,125,50,0.18); }
    .ea-readiness-badge.warning { color:#f3ddb0; border-color:rgba(212,175,55,0.22); background:rgba(212,175,55,0.12); }
    .ea-readiness-badge.blocked { color:#ffb4b4; border-color:rgba(255,180,180,0.22); background:rgba(183,28,28,0.18); }
    .ea-readiness-note { margin-top:10px; font-size:13px; line-height:1.55; color:var(--muted); }
    .ea-check--ready strong, .ea-check--ready .setup-state { color: var(--success) !important; }
    .ea-check--warning strong { color: var(--gold-soft) !important; }
    .ea-check--blocked strong, .ea-check--blocked .setup-state { color: var(--danger) !important; }
  `;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function getCanonicalSummary() {
    return window.__EA_CANONICAL_SUMMARY || window.dashboardSummary || {};
  }

  function removeOverviewClutter() {
    document.getElementById("bundleIMemoryShell")?.remove();

    const phase4Toolbar = document.querySelector("#overview .phase4-toolbar");
    if (phase4Toolbar) {
      phase4Toolbar.classList.add("ea-phase4-hidden");
    }

    const phase3Toolbar = document.querySelector("#overview .phase3-toolbar");
    if (phase3Toolbar) {
      phase3Toolbar.classList.add("ea-phase4-hidden");
    }

    const operatorFocusTag = document.querySelector("#overview .phase4-tag, #overview .phase3-section-tag");
    if (operatorFocusTag && /operator focus/i.test(clean(operatorFocusTag.textContent))) {
      operatorFocusTag.closest(".phase4-toolbar, .phase3-toolbar")?.classList.add("ea-phase4-hidden");
    }

    const cards = Array.from(document.querySelectorAll("#overview .card"));
    cards.forEach((card) => {
      const heading = clean(card.querySelector("h2, h3")?.textContent || "");
      if (/persistent workflow actions|recent workflow history/i.test(heading)) {
        card.remove();
      }
    });
  }

  function computeReadiness() {
    const summary = getCanonicalSummary();
    const setup = summary.setup_status || {};
    const subscription = (window.currentNormalizedSession || {}).subscription || {};
    const profile = window.currentProfile || {};
    const canonical = window.__EA_SYSTEM_STATE?.profile || profile || {};

    const checks = [
      {
        key: "access",
        label: "Access active",
        ready: Boolean(subscription.active || subscription.access_granted),
        required: true
      },
      {
        key: "dealer_website",
        label: "Dealer website saved",
        ready: Boolean(setup.dealer_website_present || canonical.dealer_website),
        required: true
      },
      {
        key: "inventory_url",
        label: "Inventory URL saved",
        ready: Boolean(setup.inventory_url_present || canonical.inventory_url),
        required: true
      },
      {
        key: "scanner_type",
        label: "Scanner type selected",
        ready: Boolean(setup.scanner_type_present || canonical.scanner_type),
        required: true
      },
      {
        key: "listing_location",
        label: "Listing location set",
        ready: Boolean(setup.listing_location_present || canonical.listing_location),
        required: true
      },
      {
        key: "compliance_mode",
        label: "Compliance mode configured",
        ready: Boolean(setup.compliance_mode_present || canonical.compliance_mode || canonical.province),
        required: true
      },
      {
        key: "license_number",
        label: "License number present",
        ready: Boolean(canonical.license_number),
        required: true
      }
    ];

    const requiredTotal = checks.filter((c) => c.required).length;
    const requiredReady = checks.filter((c) => c.required && c.ready).length;
    const missingRequired = checks.filter((c) => c.required && !c.ready);

    let state = "ready";
    if (missingRequired.length >= 2 || !checks[0].ready) state = "blocked";
    else if (missingRequired.length === 1) state = "warning";

    const percent = requiredTotal ? Math.round((requiredReady / requiredTotal) * 100) : 0;

    let title = "Ready to operate";
    let copy = "Core account, routing, and compliance requirements are in place.";
    if (state === "blocked") {
      title = "Publish blocked";
      copy = "Required setup is still missing. Clean posting and compliance flow should be blocked until these are fixed.";
    } else if (state === "warning") {
      title = "Ready with warning";
      copy = "Most core requirements are present, but one required checkpoint still needs attention.";
    }

    return { checks, state, percent, title, copy, missingRequired };
  }

  function setText(id, text) {
    document.querySelectorAll(`#${id}`).forEach((el) => { el.textContent = text; });
  }

  function applySetupSection() {
    const readiness = computeReadiness();
    const chip = document.getElementById("commandSetupChip");
    if (chip) {
      chip.textContent = readiness.state === "ready"
        ? `Ready ${readiness.percent}%`
        : readiness.state === "warning"
          ? `Warning ${readiness.percent}%`
          : `Blocked ${readiness.percent}%`;
    }

    const progress = document.getElementById("commandSetupProgress");
    if (progress) progress.textContent = `${readiness.percent}%`;

    const summary = document.getElementById("commandSetupSummary");
    if (summary) summary.textContent = readiness.copy;

    const checklist = document.getElementById("commandSetupChecklist");
    if (checklist) {
      checklist.innerHTML = readiness.checks.slice(0, 4).map((item) => {
        const cls = item.ready ? "ea-check--ready" : (readiness.state === "blocked" ? "ea-check--blocked" : "ea-check--warning");
        return `
          <div class="setup-check ${cls}">
            <span>${item.label}</span>
            <strong>${item.ready ? "Ready" : "Required"}</strong>
          </div>
        `;
      }).join("");
    }

    const setupReadinessPercent = document.getElementById("setupReadinessPercent");
    if (setupReadinessPercent) {
      setupReadinessPercent.textContent = readiness.state === "ready"
        ? "Ready"
        : readiness.state === "warning"
          ? "Warning"
          : "Blocked";
      setupReadinessPercent.classList.remove("active", "warn", "inactive");
      setupReadinessPercent.classList.add(
        readiness.state === "ready" ? "active" : readiness.state === "warning" ? "warn" : "inactive"
      );
    }

    const setupReadinessSummary = document.getElementById("setupReadinessSummary");
    if (setupReadinessSummary) {
      setupReadinessSummary.textContent = readiness.copy;
    }

    const setupNextStepPanel = document.getElementById("setupNextStepPanel");
    if (setupNextStepPanel) {
      const next = readiness.missingRequired[0];
      setupNextStepPanel.innerHTML = next
        ? `<strong>Next step:</strong> ${next.label}`
        : `<strong>Next step:</strong> Open Tools and verify live posting state.`;
    }

    const blockers = document.getElementById("setupBlockersList");
    if (blockers) {
      blockers.innerHTML = readiness.missingRequired.length
        ? readiness.missingRequired.map((item) => `<div>• ${item.label}</div>`).join("")
        : `<div>• No required setup blockers remain.</div>`;
    }

    const ids = {
      dealer_website: "setupDealerWebsite",
      inventory_url: "setupInventoryUrl",
      scanner_type: "setupScannerType",
      listing_location: "setupListingLocation",
      compliance_mode: "setupComplianceMode",
      access: "setupAccess"
    };

    readiness.checks.forEach((check) => {
      const id = ids[check.key];
      const extId = {
        setupDealerWebsite: "extSetupDealerWebsite",
        setupInventoryUrl: "extSetupInventoryUrl",
        setupScannerType: "extSetupScannerType",
        setupListingLocation: "extSetupListingLocation",
        setupComplianceMode: "extSetupComplianceMode",
        setupAccess: "extSetupAccess"
      }[id];

      [id, extId].forEach((targetId) => {
        if (!targetId) return;
        const el = document.getElementById(targetId);
        if (!el) return;
        el.textContent = check.ready ? "Ready" : "Required";
        el.classList.remove("good", "warn");
        el.classList.add(check.ready ? "good" : "warn");
      });
    });

    const complianceStatusPanel = document.getElementById("complianceStatusPanel");
    if (complianceStatusPanel) {
      complianceStatusPanel.innerHTML = readiness.state === "ready"
        ? `<div class="status-line"><strong>Compliance ready.</strong> Required profile and dealer fields are present for publish flow.</div>`
        : readiness.state === "warning"
          ? `<div class="status-line"><strong>Compliance warning.</strong> One required field still needs attention before clean publish flow.</div>`
          : `<div class="status-line"><strong>Publish blocked.</strong> Required compliance or dealer identity fields are still missing.</div>`;
    }

    const toolsNextStepPanel = document.getElementById("toolsNextStepPanel");
    if (toolsNextStepPanel) {
      toolsNextStepPanel.innerHTML = readiness.missingRequired.length
        ? `<strong>Next step:</strong> ${readiness.missingRequired[0].label}`
        : `<strong>Next step:</strong> Open inventory or Marketplace and run the posting flow.`;
    }

    const toolsSystemStatusPanel = document.getElementById("toolsSystemStatusPanel");
    if (toolsSystemStatusPanel) {
      const postsRemaining = num((window.currentNormalizedSession || {}).subscription?.posts_remaining);
      toolsSystemStatusPanel.innerHTML = `
        <div><strong>State:</strong> ${readiness.title}</div>
        <div class="ea-readiness-note">${readiness.copy}</div>
        <div class="ea-readiness-note">Posts remaining today: ${postsRemaining}</div>
      `;
    }
  }

  function run() {
    injectStyle();
    removeOverviewClutter();
    applySetupSection();
  }

  onReady(() => {
    run();
    window.addEventListener("elevate:canonical-summary-ready", run);
    window.addEventListener("elevate:sync-refreshed", run);
    NS.events?.addEventListener?.("state:set", () => {
      clearTimeout(window.__EA_PHASE4_READINESS_DEBOUNCE__);
      window.__EA_PHASE4_READINESS_DEBOUNCE__ = setTimeout(run, 60);
    });
    setTimeout(run, 400);
    setTimeout(run, 1200);
  });

  NS.modules = NS.modules || {};
  NS.modules.phase4readiness = true;
})();
