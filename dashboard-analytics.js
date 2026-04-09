
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.analytics) return;

  const CSS = `
    .a-track-shell{display:grid;gap:16px;margin-bottom:20px}
    .a-track-hero,.a-track-card{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .a-track-hero-grid{display:grid;grid-template-columns:1.45fr repeat(3,minmax(0,1fr));gap:12px}
    .a-track-title{font-size:28px;line-height:1.05;margin:0 0 8px}
    .a-track-copy{color:#d6d6d6;line-height:1.55;font-size:14px}
    .a-track-value{font-size:28px;line-height:1;font-weight:800;color:#f3ddb0;margin-bottom:8px}
    .a-track-list{display:grid;gap:10px}
    .a-track-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .a-track-item strong{display:block;margin-bottom:6px}
    .a-track-meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    .a-track-actions{display:grid;gap:10px;justify-items:end}
    .a-pill{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.08);background:#171717}
    .a-pill.revenue{color:#f3ddb0;border-color:rgba(212,175,55,.22)}
    .a-pill.growth{color:#9de8a8;border-color:rgba(157,232,168,.22)}
    .a-pill.cleanup{color:#cfd8ff;border-color:rgba(207,216,255,.2)}
    .a-track-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .a-track-row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .a-track-row .muted{color:#a9a9a9;font-size:12px}
    .a-track-empty{padding:18px;border-radius:16px;border:1px dashed rgba(212,175,55,.18);color:#a9a9a9;background:#111;text-align:center}
    @media (max-width:1200px){.a-track-hero-grid,.a-track-grid{grid-template-columns:1fr 1fr}}
    @media (max-width:760px){.a-track-hero-grid,.a-track-grid{grid-template-columns:1fr}.a-track-title{font-size:24px}}
  `;

  function ensureStyle() {
    if (document.getElementById("bundle-a-analytics-style")) return;
    const s = document.createElement("style");
    s.id = "bundle-a-analytics-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function text(id) {
    return String(document.getElementById(id)?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function openSection(sectionId, focusId) {
    try {
      if (typeof window.showSection === "function") window.showSection(sectionId);
    } catch {}
    if (focusId) {
      setTimeout(() => document.getElementById(focusId)?.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
    }
  }

  function renderLeaders(list = [], kind = "views") {
    if (!list.length) return `<div class="a-track-empty">No ${kind} leaders tracked yet.</div>`;
    return list.map((item, idx) => `
      <div class="a-track-row">
        <div>
          <strong>${idx + 1}. ${item.title || "Untitled listing"}</strong>
          <div class="muted">${item.price || "No price"} • ${item.health_state || "unknown"}</div>
        </div>
        <div style="text-align:right">
          <div>${kind === "messages" ? Number(item.messages || 0) : Number(item.views || 0)}</div>
          <div class="muted">${kind === "messages" ? "messages" : "views"}</div>
        </div>
      </div>
    `).join("");
  }

  function render() {
    const section = document.getElementById("tools");
    if (!section || !NS.state?.get) return;
    ensureStyle();

    const analytics = NS.state.get("analytics", {});
    const summary = analytics.tracking_summary || {};
    const leaders = analytics.leaders || {};
    const actionQueue = Array.isArray(analytics.action_queue) ? analytics.action_queue : [];

    let shell = document.getElementById("bundleATrackingShell");
    if (!shell) {
      shell = document.createElement("div");
      shell.id = "bundleATrackingShell";
      shell.className = "a-track-shell";
      section.prepend(shell);
    }

    let hero = document.getElementById("bundleATrackingHero");
    if (!hero) {
      hero = document.createElement("div");
      hero.id = "bundleATrackingHero";
      hero.className = "a-track-hero";
      shell.appendChild(hero);
    }

    hero.innerHTML = `
      <div class="a-track-hero-grid">
        <div class="a-track-card">
          <div class="g-eyebrow">Tracking Foundation</div>
          <h2 class="a-track-title">Analytics now starts from listing-level view and message truth.</h2>
          <div class="a-track-copy">This bundle creates the foundation for real listing intelligence: tracked views, tracked messages, listing registry groundwork, and action-led analytics based on those signals.</div>
        </div>
        <div class="a-track-card">
          <div class="stat-label">Tracked Listings</div>
          <div class="a-track-value">${summary.total_listings || 0}</div>
          <div class="stat-sub">Listings currently represented in the local registry.</div>
        </div>
        <div class="a-track-card">
          <div class="stat-label">Tracked Views</div>
          <div class="a-track-value">${summary.tracked_views || 0}</div>
          <div class="stat-sub">Current visible view signal in tracked listings.</div>
        </div>
        <div class="a-track-card">
          <div class="stat-label">Tracked Messages</div>
          <div class="a-track-value">${summary.tracked_messages || 0}</div>
          <div class="stat-sub">Current visible message signal in tracked listings.</div>
        </div>
      </div>
    `;

    let actionCard = document.getElementById("bundleATrackingQueue");
    if (!actionCard) {
      actionCard = document.createElement("div");
      actionCard.id = "bundleATrackingQueue";
      actionCard.className = "a-track-card";
      shell.appendChild(actionCard);
    }

    actionCard.innerHTML = `
      <div class="section-head">
        <div>
          <div class="g-eyebrow">Analytics Reform V1</div>
          <h2 style="margin-top:6px;">Action queue from tracked signals</h2>
          <div class="subtext">This queue is now based on tracked listing patterns like traction without conversion, weak conversion, and message leaders.</div>
        </div>
      </div>
      <div class="a-track-list">
        ${actionQueue.length ? actionQueue.map((item, idx) => `
          <div class="a-track-item">
            <div>
              <strong>${idx + 1}. ${item.title}</strong>
              <div class="a-track-meta">${item.copy}</div>
            </div>
            <div class="a-track-actions">
              <span class="a-pill ${item.tone || "growth"}">${item.tone || "growth"}</span>
              <button class="action-btn" type="button" data-a-track-open="${item.section || "tools"}" data-a-track-focus="${item.focus || ""}">Open</button>
            </div>
          </div>
        `).join("") : `<div class="a-track-empty">Action queue will populate as tracked signals grow.</div>`}
      </div>
    `;

    actionCard.querySelectorAll("[data-a-track-open]").forEach((button) => {
      if (button.dataset.boundA === "true") return;
      button.dataset.boundA = "true";
      button.addEventListener("click", () => {
        openSection(button.getAttribute("data-a-track-open"), button.getAttribute("data-a-track-focus"));
      });
    });

    let leadersCard = document.getElementById("bundleATrackingLeaders");
    if (!leadersCard) {
      leadersCard = document.createElement("div");
      leadersCard.id = "bundleATrackingLeaders";
      leadersCard.className = "a-track-grid";
      shell.appendChild(leadersCard);
    }

    leadersCard.innerHTML = `
      <div class="a-track-card">
        <div class="section-head">
          <div>
            <div class="g-eyebrow">Message Leaders</div>
            <h2 style="margin-top:6px;">Listings with strongest reply signal</h2>
          </div>
        </div>
        <div class="a-track-list">${renderLeaders(leaders.message_leaders || [], "messages")}</div>
      </div>
      <div class="a-track-card">
        <div class="section-head">
          <div>
            <div class="g-eyebrow">View Leaders</div>
            <h2 style="margin-top:6px;">Listings with strongest reach signal</h2>
          </div>
        </div>
        <div class="a-track-list">${renderLeaders(leaders.view_leaders || [], "views")}</div>
      </div>
    `;
  }

  NS.analytics = {
    renderBundleA: render
  };

  NS.modules = NS.modules || {};
  NS.modules.analytics = true;

  const boot = () => {
    render();
    setTimeout(render, 1200);
    setTimeout(render, 3200);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  if (NS.events && !NS.__bundleATrackingStateListener) {
    NS.__bundleATrackingStateListener = true;
    NS.events.addEventListener("state:set", (event) => {
      const path = String(event?.detail?.path || "");
      if (path.startsWith("analytics") || path.startsWith("listingRegistry")) {
        render();
      }
    });
  }

  window.addEventListener("elevate:tracking-refreshed", render);
})();
