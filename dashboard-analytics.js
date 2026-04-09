
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.analytics) return;

  const CSS = `
    .b-analytics-shell{display:grid;gap:16px}
    .b-analytics-card,.b-analytics-hero{border:1px solid rgba(212,175,55,.12);border-radius:16px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))}
    .b-analytics-hero-grid{display:grid;grid-template-columns:1.4fr repeat(4,minmax(0,1fr));gap:12px}
    .b-a-title{font-size:28px;line-height:1.05;margin:0 0 8px}
    .b-a-copy{color:#d6d6d6;line-height:1.55;font-size:14px}
    .b-a-list{display:grid;gap:10px;margin-top:12px}
    .b-a-item{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#161616;border:1px solid rgba(255,255,255,.05)}
    .b-a-meta{color:#a9a9a9;font-size:13px;line-height:1.5}
    .b-a-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .b-leader{display:grid;gap:8px}
    .b-leader-item{display:flex;justify-content:space-between;gap:12px;padding:12px;border-radius:12px;background:#171717;border:1px solid rgba(255,255,255,.05)}
    .b-kicker{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#d4af37;font-weight:700;margin-bottom:6px}
    .b-value{font-size:26px;font-weight:800;line-height:1;color:#f3ddb0;margin-bottom:6px}
    .b-note{font-size:12px;color:#b8b8b8;line-height:1.45}
    .b-pill{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.08);background:#171717}
    .b-pill.revenue{color:#f3ddb0;border-color:rgba(212,175,55,.22)}
    .b-pill.growth{color:#9de8a8;border-color:rgba(157,232,168,.22)}
    .b-pill.cleanup{color:#d7d7d7;border-color:rgba(255,255,255,.16)}
    .b-pill.low{color:#ffccaa;border-color:rgba(255,204,170,.2)}
    .b-collapse{border:1px solid rgba(212,175,55,.10);border-radius:16px;overflow:hidden;background:#111}
    .b-collapse-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;background:rgba(255,255,255,.02)}
    .b-collapse-body{display:none;padding:16px;border-top:1px solid rgba(212,175,55,.08)}
    .b-collapse.open .b-collapse-body{display:block}
    @media (max-width:1280px){.b-analytics-hero-grid{grid-template-columns:1fr 1fr}.b-a-grid{grid-template-columns:1fr}}
    @media (max-width:760px){.b-analytics-hero-grid{grid-template-columns:1fr}.b-a-title{font-size:24px}}
  `;

  function ensureStyle() {
    if (document.getElementById("bundle-b-analytics-style")) return;
    const s = document.createElement("style");
    s.id = "bundle-b-analytics-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function openSection(sectionId, focusId) {
    if (typeof window.showSection === "function") window.showSection(sectionId);
    if (focusId) {
      setTimeout(() => document.getElementById(focusId)?.scrollIntoView({ behavior: "smooth", block: "center" }), 220);
    }
  }

  function analytics() {
    return NS.state?.get?.("analytics", {}) || {};
  }

  function summary() {
    return analytics().tracking_summary || {};
  }

  function leaders() {
    return analytics().leaders || {};
  }

  function renderLeaderList(items = [], valueKey = "messages", empty = "No tracked listings yet.") {
    if (!items.length) return `<div class="listing-empty">${empty}</div>`;
    return items.map((item, idx) => `
      <div class="b-leader-item">
        <div>
          <strong>${idx + 1}. ${item.title || "Tracked Listing"}</strong>
          <div class="b-note">${item.health_state || "active"} • confidence: ${item.confidence || "unknown"}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">${Number(item[valueKey] || 0)}</div>
          <div class="b-note">${valueKey.replace("_", " ")}</div>
        </div>
      </div>
    `).join("");
  }

  function renderActionQueue(items = []) {
    if (!items.length) {
      return `<div class="listing-empty">No analytics actions yet.</div>`;
    }
    return items.map((item, idx) => `
      <div class="b-a-item">
        <div>
          <strong>${idx + 1}. ${item.title}</strong>
          <div class="b-a-meta">${item.copy}</div>
          <div class="b-note" style="margin-top:8px">${item.reason || ""}</div>
        </div>
        <div style="display:grid;gap:10px;justify-items:end;">
          <span class="b-pill ${item.tone || "growth"}">${item.tone || "growth"}</span>
          <button class="action-btn" type="button" data-b-open="${item.section || "tools"}" data-b-focus="${item.focus || ""}">Open</button>
        </div>
      </div>
    `).join("");
  }

  function render() {
    const section = document.getElementById("tools");
    if (!section || !NS.state) return;
    ensureStyle();

    const s = summary();
    const l = leaders();
    const actions = analytics().action_queue || [];

    let shell = document.getElementById("bundleBAnalyticsShell");
    if (!shell) {
      shell = document.createElement("div");
      shell.id = "bundleBAnalyticsShell";
      shell.className = "b-analytics-shell";
      section.prepend(shell);
    }

    let hero = document.getElementById("bundleBAnalyticsHero");
    if (!hero) {
      hero = document.createElement("div");
      hero.id = "bundleBAnalyticsHero";
      hero.className = "b-analytics-hero";
      shell.appendChild(hero);
    }

    hero.innerHTML = `
      <div class="b-analytics-hero-grid">
        <div class="b-analytics-card">
          <div class="b-kicker">Analytics Reform V2</div>
          <h2 class="b-a-title">Turn tracked listing signal into clear business moves.</h2>
          <div class="b-a-copy">This layer upgrades analytics from “tracking exists” into stronger ranking, rescue, promotion, and pricing decisions.</div>
        </div>
        <div class="b-analytics-card">
          <div class="b-kicker">Tracked Views</div>
          <div class="b-value">${Number(s.tracked_views || 0)}</div>
          <div class="b-note">Current total tracked view signal.</div>
        </div>
        <div class="b-analytics-card">
          <div class="b-kicker">Tracked Messages</div>
          <div class="b-value">${Number(s.tracked_messages || 0)}</div>
          <div class="b-note">Current buyer-response signal.</div>
        </div>
        <div class="b-analytics-card">
          <div class="b-kicker">Conversion Leaks</div>
          <div class="b-value">${Number(s.high_views_low_messages_count || 0) + Number(s.weak_conversion_count || 0)}</div>
          <div class="b-note">Listings with attention but weak conversion.</div>
        </div>
        <div class="b-analytics-card">
          <div class="b-kicker">Low Confidence</div>
          <div class="b-value">${Number(s.low_confidence_count || 0)}</div>
          <div class="b-note">Listings still relying on fallback or weak signal.</div>
        </div>
      </div>
    `;

    let queue = document.getElementById("bundleBAnalyticsQueue");
    if (!queue) {
      queue = document.createElement("div");
      queue.id = "bundleBAnalyticsQueue";
      queue.className = "b-analytics-card";
      shell.appendChild(queue);
    }

    queue.innerHTML = `
      <div class="section-head">
        <div>
          <div class="b-kicker">Action Queue</div>
          <h2 style="margin-top:6px;">Best listing moves right now</h2>
          <div class="subtext">Sharper, more business-relevant actions driven by tracked listing states.</div>
        </div>
      </div>
      <div class="b-a-list">${renderActionQueue(actions)}</div>
    `;

    queue.querySelectorAll("[data-b-open]").forEach((btn) => {
      if (btn.dataset.boundB === "true") return;
      btn.dataset.boundB = "true";
      btn.addEventListener("click", () => openSection(btn.getAttribute("data-b-open"), btn.getAttribute("data-b-focus")));
    });

    let leaderGrid = document.getElementById("bundleBAnalyticsLeaders");
    if (!leaderGrid) {
      leaderGrid = document.createElement("div");
      leaderGrid.id = "bundleBAnalyticsLeaders";
      leaderGrid.className = "b-a-grid";
      shell.appendChild(leaderGrid);
    }

    leaderGrid.innerHTML = `
      <div class="b-analytics-card">
        <div class="section-head"><div><div class="b-kicker">Message Leaders</div><h2 style="margin-top:6px;">Who is actually converting</h2></div></div>
        <div class="b-leader">${renderLeaderList(l.message_leaders || [], "messages", "No message leaders yet.")}</div>
      </div>
      <div class="b-analytics-card">
        <div class="section-head"><div><div class="b-kicker">View Leaders</div><h2 style="margin-top:6px;">Who is getting attention</h2></div></div>
        <div class="b-leader">${renderLeaderList(l.view_leaders || [], "views", "No view leaders yet.")}</div>
      </div>
      <div class="b-analytics-card">
        <div class="section-head"><div><div class="b-kicker">Rescue Candidates</div><h2 style="margin-top:6px;">High views, weak conversion</h2></div></div>
        <div class="b-leader">${renderLeaderList(l.high_views_low_messages || [], "views", "No rescue candidates yet.")}</div>
      </div>
      <div class="b-analytics-card">
        <div class="section-head"><div><div class="b-kicker">Refresh + Price Attention</div><h2 style="margin-top:6px;">What to rework or reprice</h2></div></div>
        <div class="b-leader">
          ${renderLeaderList([...(l.needs_refresh || []), ...(l.price_attention || [])].slice(0,5), "views", "No refresh or pricing candidates yet.")}
        </div>
      </div>
    `;

    const lower = Array.from(section.children).filter((el) => el !== shell && !shell.contains(el));
    let collapse = document.getElementById("bundleBAnalyticsSecondary");
    if (!collapse) {
      collapse = document.createElement("div");
      collapse.id = "bundleBAnalyticsSecondary";
      collapse.className = "b-collapse";
      collapse.innerHTML = `
        <div class="b-collapse-head">
          <div><div class="b-kicker">Quiet Mode</div><strong>Charts, scorecards, and supporting diagnostics</strong></div>
          <div class="subtext" id="bundleBAnalyticsState">Expand</div>
        </div>
        <div class="b-collapse-body"></div>
      `;
      shell.appendChild(collapse);
      collapse.querySelector(".b-collapse-head").addEventListener("click", () => {
        collapse.classList.toggle("open");
        const t = collapse.querySelector("#bundleBAnalyticsState");
        if (t) t.textContent = collapse.classList.contains("open") ? "Collapse" : "Expand";
      });
    }
    const body = collapse.querySelector(".b-collapse-body");
    lower.forEach((el) => {
      if (body && !body.contains(el)) body.appendChild(el);
    });
  }

  NS.analytics = { renderBundleB: render };
  NS.modules = NS.modules || {};
  NS.modules.analytics = true;

  const boot = () => {
    render();
    setTimeout(render, 1200);
    setTimeout(render, 3200);
  };
  window.addEventListener("elevate:tracking-refreshed", render);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
