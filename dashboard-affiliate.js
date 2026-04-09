
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  NS.modules = NS.modules || {};
  const STYLE_ID = "ea-bundle-e-affiliate-style";

  function qs(selector, root = document) { return root.querySelector(selector); }
  function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function text(id) { return clean(document.getElementById(id)?.textContent || ""); }
  function numberFromText(value) {
    const cleaned = clean(value).replace(/,/g, "");
    const match = cleaned.match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }
  function moneyFromText(value) {
    const cleaned = clean(value).replace(/,/g, "");
    const match = cleaned.match(/\$?\s*(-?\d+(\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }
  function formatMoney(value) {
    const n = Number(value || 0);
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  }
  function formatCount(value) {
    return Number(value || 0).toLocaleString();
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ea-p-shell{display:grid;gap:18px;margin-bottom:20px}
      .ea-p-card{background:
        radial-gradient(circle at top right, rgba(212,175,55,0.10), transparent 28%),
        linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.006)),
        var(--panel);
        border:1px solid rgba(212,175,55,0.14);
        border-radius:18px;
        padding:20px;
        box-shadow:var(--shadow)}
      .ea-p-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}
      .ea-p-tag{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.20);color:var(--gold-soft);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
      .ea-p-title{font-size:28px;line-height:1.05;margin:8px 0 8px}
      .ea-p-sub{color:var(--muted);font-size:14px;line-height:1.55}
      .ea-p-badge{display:inline-flex;align-items:center;min-height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(212,175,55,0.20);background:rgba(212,175,55,0.10);color:var(--gold-soft);font-size:12px;font-weight:700}
      .ea-p-grid{display:grid;grid-template-columns:1.3fr .9fr;gap:16px}
      .ea-p-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .ea-p-kpi{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:14px}
      .ea-p-kpi-label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:8px}
      .ea-p-kpi-value{font-size:24px;font-weight:800;line-height:1.05}
      .ea-p-kpi-sub{margin-top:8px;color:var(--muted);font-size:12px;line-height:1.45}
      .ea-p-action-list{display:grid;gap:10px;margin-top:14px}
      .ea-p-action-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px 16px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,0.06)}
      .ea-p-rank{min-width:34px;height:34px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.18);color:var(--gold-soft);font-weight:700;font-size:13px}
      .ea-p-action-item .title{font-size:15px;font-weight:700;line-height:1.25;margin-bottom:6px}
      .ea-p-action-item .copy{font-size:13px;line-height:1.5;color:var(--muted)}
      .ea-p-chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
      .ea-p-chip{display:inline-flex;align-items:center;min-height:30px;padding:0 10px;border-radius:999px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.06);color:#efefef;font-size:11px;font-weight:700}
      .ea-p-side-list{display:grid;gap:10px}
      .ea-p-side-item{padding:12px 14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,0.06)}
      .ea-p-side-item strong{display:block;font-size:13px;margin-bottom:5px}
      .ea-p-side-item span{display:block;font-size:12px;color:var(--muted);line-height:1.45}
      .ea-p-demote{opacity:.96}
      @media (max-width:1180px){
        .ea-p-grid,.ea-p-kpis{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function buildPartnerActions() {
    const invited = numberFromText(text("affiliateInvitedCount"));
    const signed = numberFromText(text("affiliateSignedUpCount"));
    const paying = numberFromText(text("affiliatePayingCount"));
    const churned = numberFromText(text("affiliateChurnedCount"));
    const activeReferrals = numberFromText(text("affiliateActiveReferrals"));
    const totalReferrals = numberFromText(text("affiliateTotalReferrals"));
    const pending = moneyFromText(text("affiliatePendingPayout"));
    const commission = moneyFromText(text("affiliateCommissionEarned"));
    const est = moneyFromText(text("affiliateEstimatedMRR"));

    const actions = [];

    if (signed > paying) {
      actions.push({
        title: `Follow up with ${formatCount(signed - paying)} inactive signups`,
        copy: "These signups are the closest conversion opportunity. Improve payment activation before seeking more top-of-funnel volume.",
        chips: ["Revenue", "Conversion"]
      });
    }
    if (invited <= signed) {
      actions.push({
        title: "Increase top-of-funnel partner outreach",
        copy: "Invite more qualified salespeople and dealership managers so the funnel has enough volume to compound recurring payouts.",
        chips: ["Growth", "Outreach"]
      });
    }
    if (paying > 0 && activeReferrals < paying) {
      actions.push({
        title: "Stabilize paying referral retention",
        copy: "Some paying users may not be fully active. Follow up on usage and first-win adoption to protect recurring revenue.",
        chips: ["Retention", "Recurring"]
      });
    }
    if (churned > 0) {
      actions.push({
        title: `Re-activate ${formatCount(churned)} churned referrals`,
        copy: "A reactivation DM is usually lower-cost than net-new acquisition. Recover old revenue before over-expanding outbound.",
        chips: ["Reactivation", "Revenue Recovery"]
      });
    }
    if (pending > 0 || commission > 0 || est > 0) {
      actions.push({
        title: "Lean into manager-level partner outreach",
        copy: "Dealership managers and team leads can unlock multi-user referrals faster than one-off rep outreach.",
        chips: ["Managers", "Scale"]
      });
    }

    if (!actions.length) {
      actions.push({
        title: "Start with one clean partner funnel",
        copy: "Invite one qualified salesperson, send one direct pitch, and create the first live referral conversion path before expanding the surface area.",
        chips: ["Baseline", "First Revenue Signal"]
      });
    }

    return actions.slice(0, 5);
  }

  function buildPartnerInsights() {
    const invited = numberFromText(text("affiliateInvitedCount"));
    const signed = numberFromText(text("affiliateSignedUpCount"));
    const paying = numberFromText(text("affiliatePayingCount"));
    const churned = numberFromText(text("affiliateChurnedCount"));
    const est = moneyFromText(text("affiliateEstimatedMRR"));
    const pending = moneyFromText(text("affiliatePendingPayout"));

    const conversion = invited > 0 ? Math.round((signed / invited) * 100) : 0;
    const paidConv = signed > 0 ? Math.round((paying / signed) * 100) : 0;

    return [
      {
        title: conversion > 0 ? `Invite → signup conversion ${conversion}%` : "Top-of-funnel is still thin",
        copy: conversion > 0
          ? "This shows how efficiently outreach is turning into account creation."
          : "No meaningful invite-to-signup signal yet. Start with direct outreach and referrals."
      },
      {
        title: paidConv > 0 ? `Signup → paid conversion ${paidConv}%` : "Paid conversion not proven yet",
        copy: paidConv > 0
          ? "The next revenue bottleneck is usually improving first-win activation after signup."
          : "The current data suggests signups are not yet reliably becoming recurring revenue."
      },
      {
        title: est > 0 ? `Projected monthly recurring ${formatMoney(est)}` : "Recurring projection still forming",
        copy: est > 0
          ? "Use this as the north-star revenue number for partner growth."
          : "MRR will become meaningful after a few referrals convert and stay active."
      },
      {
        title: pending > 0 || churned > 0 ? "Payout and retention need operator attention" : "Retention pressure is currently low",
        copy: pending > 0 || churned > 0
          ? "Pending payout and churn should be managed like a real revenue system, not a passive referral page."
          : "Keep building quality referrals before over-optimizing payout management."
      }
    ];
  }

  function ensureShell() {
    const section = document.getElementById("affiliate");
    if (!section) return null;
    let shell = document.getElementById("partnerRevenueShell");
    if (!shell) {
      shell = document.createElement("div");
      shell.id = "partnerRevenueShell";
      shell.className = "ea-p-shell";
      section.insertBefore(shell, section.firstElementChild);
    }
    return shell;
  }

  function render() {
    injectStyles();
    const shell = ensureShell();
    if (!shell) return;

    const commission = moneyFromText(text("affiliateCommissionEarned"));
    const pending = moneyFromText(text("affiliatePendingPayout"));
    const active = numberFromText(text("affiliateActiveReferrals"));
    const mrr = moneyFromText(text("affiliateEstimatedMRR"));
    const actions = buildPartnerActions();
    const insights = buildPartnerInsights();

    shell.innerHTML = `
      <div class="ea-p-card">
        <div class="ea-p-head">
          <div>
            <div class="ea-p-tag">Bundle E · Partners Revenue Mode</div>
            <div class="ea-p-title">Turn referrals into recurring revenue workflow.</div>
            <div class="ea-p-sub">This section should show who to target, what script to use, where conversion is leaking, and how to grow payouts — not just display referral counts.</div>
          </div>
          <div class="ea-p-badge">${active > 0 || mrr > 0 ? "Revenue Mode Live" : "Revenue Signal Building"}</div>
        </div>

        <div class="ea-p-grid">
          <div>
            <div class="ea-p-kpis">
              <div class="ea-p-kpi">
                <div class="ea-p-kpi-label">Projected Monthly Recurring</div>
                <div class="ea-p-kpi-value">${formatMoney(mrr)}</div>
                <div class="ea-p-kpi-sub">Recurring revenue potential from current partner activity.</div>
              </div>
              <div class="ea-p-kpi">
                <div class="ea-p-kpi-label">Active Paying Referrals</div>
                <div class="ea-p-kpi-value">${formatCount(active)}</div>
                <div class="ea-p-kpi-sub">Current live referral base generating recurring signal.</div>
              </div>
              <div class="ea-p-kpi">
                <div class="ea-p-kpi-label">Commission Earned</div>
                <div class="ea-p-kpi-value">${formatMoney(commission)}</div>
                <div class="ea-p-kpi-sub">Total commission produced so far.</div>
              </div>
              <div class="ea-p-kpi">
                <div class="ea-p-kpi-label">Pending Payout</div>
                <div class="ea-p-kpi-value">${formatMoney(pending)}</div>
                <div class="ea-p-kpi-sub">Expected short-term payout opportunity.</div>
              </div>
            </div>

            <div class="ea-p-action-list">
              ${actions.map((item, idx) => `
                <div class="ea-p-action-item">
                  <div class="ea-p-rank">${idx + 1}</div>
                  <div style="flex:1;">
                    <div class="title">${item.title}</div>
                    <div class="copy">${item.copy}</div>
                    <div class="ea-p-chip-row">
                      ${(item.chips || []).map((chip) => `<span class="ea-p-chip">${chip}</span>`).join("")}
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>

          <div class="ea-p-side-list">
            ${insights.map((item) => `
              <div class="ea-p-side-item">
                <strong>${item.title}</strong>
                <span>${item.copy}</span>
              </div>
            `).join("")}
            <div class="ea-p-side-item">
              <strong>Best next outreach angle</strong>
              <span>Push dealership managers and team leads first when possible. They can unlock more recurring seats than one-off rep conversations.</span>
            </div>
          </div>
        </div>
      </div>
    `;

    demoteCards();
  }

  function demoteCards() {
    qsa('#affiliate > .grid-4 .card, #affiliate > .grid-2 .card').forEach((card) => {
      if (!card.dataset.bundleEDemoted) {
        card.dataset.bundleEDemoted = "true";
        card.classList.add("ea-p-demote");
      }
    });
  }

  function mount() {
    render();
    setTimeout(render, 700);
    setTimeout(render, 2200);
  }

  NS.affiliate = { mount, render };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
  if (NS.events instanceof EventTarget) {
    NS.events.addEventListener("state:set", () => setTimeout(render, 120));
  }
  NS.modules.affiliate = true;
})();
