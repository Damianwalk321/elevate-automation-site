(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase9commercial) return;

  function injectStyle() {
    if (document.getElementById("ea-phase9-commercial-style")) return;
    const style = document.createElement("style");
    style.id = "ea-phase9-commercial-style";
    style.textContent = `
      #phase9CommercialCard {
        display: block;
        margin-top: 12px;
        border: 1px solid rgba(212,175,55,0.14);
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(212,175,55,0.06), rgba(255,255,255,0.02));
        padding: 14px;
      }
      #phase9CommercialCard .head {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 10px;
        margin-bottom: 10px;
      }
      #phase9CommercialCard .eyebrow {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: var(--gold-soft);
      }
      #phase9CommercialCard .title {
        font-size: 20px;
        line-height: 1.1;
        font-weight: 800;
        margin-top: 4px;
      }
      #phase9CommercialCard .copy {
        font-size: 12px;
        line-height: 1.4;
        color: var(--muted);
        max-width: 760px;
      }
      #phase9CommercialCard .grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0,1fr));
        gap: 8px;
        margin-top: 10px;
      }
      #phase9CommercialCard .stat {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 10px;
        padding: 10px;
      }
      #phase9CommercialCard .stat strong {
        display: block;
        font-size: 16px;
        line-height: 1;
        margin-bottom: 5px;
      }
      #phase9CommercialCard .stat span {
        font-size: 11px;
        line-height: 1.35;
        color: var(--muted);
      }
      #phase9CommercialCard .actions {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 10px;
        margin-top: 12px;
      }
      #phase9CommercialCard .panel {
        border-radius: 10px;
        padding: 10px;
        background: rgba(255,255,255,0.025);
        border: 1px solid rgba(255,255,255,0.04);
      }
      #phase9CommercialCard .panel-title {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .05em;
        text-transform: uppercase;
        color: var(--gold-soft);
        margin-bottom: 8px;
      }
      #phase9CommercialCard .item-list {
        display: grid;
        gap: 8px;
      }
      #phase9CommercialCard .item {
        border-radius: 9px;
        padding: 8px 9px;
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.04);
      }
      #phase9CommercialCard .item strong {
        display: block;
        font-size: 12px;
        margin-bottom: 3px;
      }
      #phase9CommercialCard .item span {
        font-size: 11px;
        line-height: 1.35;
        color: var(--muted);
      }
      @media (max-width: 1100px) {
        #phase9CommercialCard .grid,
        #phase9CommercialCard .actions {
          grid-template-columns: 1fr 1fr;
        }
      }
      @media (max-width: 760px) {
        #phase9CommercialCard .grid,
        #phase9CommercialCard .actions {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function n(v) {
    const m = String(v || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  function text(id) {
    return String(document.getElementById(id)?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function getPlanName() {
    const candidates = [
      text("billingPlanName"),
      text("currentPlanName"),
      text("accountPlanName"),
      text("subscriptionPlanName"),
      text("planName")
    ].filter(Boolean);
    return candidates[0] || "Starter";
  }

  function getCommercialState() {
    const remaining = n(text("kpiPostsRemaining"));
    const queued = n(text("kpiQueuedVehicles"));
    const weak = n(text("kpiWeakListings"));
    const needsAction = n(text("kpiNeedsAction"));
    const active = n(text("kpiActiveListings"));
    const messages = n(text("kpiMessages"));
    const postsUsedRaw = text("commandPostsUsed");
    const used = n(postsUsedRaw);
    const plan = getPlanName();

    const cap = /pro/i.test(plan) ? 25 : 5;
    const usagePct = Math.min(100, Math.round((used / Math.max(cap, 1)) * 100));
    const upgradePressure =
      remaining <= 1 || (queued > 0 && remaining <= 2) || usagePct >= 80 ? "High" :
      remaining <= 3 || usagePct >= 60 ? "Moderate" : "Low";

    const partnerPotential =
      messages >= 3 || active >= 4 ? "Good" :
      active >= 2 ? "Building" : "Early";

    return { remaining, queued, weak, needsAction, active, messages, used, cap, usagePct, upgradePressure, partnerPotential, plan };
  }

  function buildPrompts(state) {
    const prompts = [];
    if (state.upgradePressure === "High") {
      prompts.push({
        title: "Upgrade pressure is building",
        copy: `${state.plan} is approaching usable output limits. If posting demand continues, a higher plan or dealership expansion path should be surfaced.`
      });
    }
    if (state.queued > 0 && state.remaining > 0) {
      prompts.push({
        title: "Posting capacity still has monetizable value",
        copy: `${state.queued} queued units with ${state.remaining} posts remaining means the system still has near-term execution capacity to monetize.`
      });
    }
    if (state.messages >= 2) {
      prompts.push({
        title: "Partner/referral angle is becoming more credible",
        copy: `Tracked engagement is strong enough to support referral, teammate invite, or dealership expansion prompts.`
      });
    }
    if (state.weak > 0 || state.needsAction > 0) {
      prompts.push({
        title: "Protect revenue before scaling plan pressure",
        copy: `${state.weak} weak and ${state.needsAction} need-action listings suggest cleanup should happen before aggressively pushing upgrades.`
      });
    }
    if (!prompts.length) {
      prompts.push({
        title: "Commercial state is stable",
        copy: "No urgent commercial trigger is dominating right now. Maintain usage clarity and keep partner expansion available but secondary."
      });
    }
    return prompts.slice(0, 3);
  }

  function buildExpansionItems(state) {
    return [
      {
        title: "Plan usage",
        copy: `${state.used}/${state.cap} daily capacity used • ${state.usagePct}% of current plan envelope.`
      },
      {
        title: "Dealership expansion",
        copy: state.active >= 4
          ? "Inventory volume is strong enough to justify a dealership/team conversation."
          : "Dealer/team expansion is still early, but the prompt can remain visible."
      },
      {
        title: "Partner / referral",
        copy: state.partnerPotential === "Good"
          ? "Current traction supports partner or referral prompts."
          : "Referral economics should stay visible but not dominate the page yet."
      }
    ];
  }

  function renderCommercialCard() {
    injectStyle();

    const overview = document.getElementById("overview");
    if (!overview) return;

    const existing = document.getElementById("phase9CommercialCard");
    if (existing) existing.remove();

    const state = getCommercialState();
    const prompts = buildPrompts(state);
    const expansion = buildExpansionItems(state);

    const card = document.createElement("section");
    card.id = "phase9CommercialCard";
    card.innerHTML = `
      <div class="head">
        <div>
          <div class="eyebrow">Commercial Growth Layer</div>
          <div class="title">Plan, Upgrade & Expansion Signals</div>
          <div class="copy">This commercial layer turns current operator and dealership activity into monetization signals so upgrade pressure, partner value, and dealership expansion prompts feel native to the dashboard rather than bolted on.</div>
        </div>
      </div>

      <div class="grid">
        <div class="stat"><strong>${state.plan}</strong><span>Current plan basis for usage, limits, and expansion prompts</span></div>
        <div class="stat"><strong>${state.usagePct}%</strong><span>Daily plan usage based on current output and posting cap</span></div>
        <div class="stat"><strong>${state.upgradePressure}</strong><span>Upgrade pressure based on queue, remaining capacity, and usage level</span></div>
        <div class="stat"><strong>${state.partnerPotential}</strong><span>Partner / referral potential based on active inventory and current traction</span></div>
      </div>

      <div class="actions">
        <div class="panel">
          <div class="panel-title">Commercial Action Prompts</div>
          <div class="item-list">
            ${prompts.map(item => `
              <div class="item">
                <strong>${item.title}</strong>
                <span>${item.copy}</span>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="panel">
          <div class="panel-title">Expansion Snapshot</div>
          <div class="item-list">
            ${expansion.map(item => `
              <div class="item">
                <strong>${item.title}</strong>
                <span>${item.copy}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;

    const managerCard = document.getElementById("phase8ManagerCompact");
    const listingsCard = document.getElementById("overviewListingsCard");
    const anchor = managerCard || listingsCard || overview.lastElementChild;
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else overview.appendChild(card);
  }

  function boot() {
    renderCommercialCard();
    setTimeout(renderCommercialCard, 300);
    setTimeout(renderCommercialCard, 1000);
    setTimeout(renderCommercialCard, 2200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:sync-refreshed", () => setTimeout(renderCommercialCard, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(renderCommercialCard, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase9commercial = true;
})();
