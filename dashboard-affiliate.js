
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.affiliate) return;

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function text(id) { return clean(document.getElementById(id)?.textContent || ""); }
  function num(id) {
    const m = text(id).match(/-?\d[\d,]*/);
    return m ? Number(m[0].replace(/,/g, "")) : 0;
  }
  function showSection(name) { try { if (typeof window.showSection === "function") window.showSection(name); } catch {} }

  function injectStyles() {
    const css = `
      .ea-affiliate-top{display:grid; gap:16px; margin-bottom:20px;}
      .ea-affiliate-hero{
        border:1px solid rgba(212,175,55,0.18); border-radius:18px; background:
          radial-gradient(circle at top right, rgba(212,175,55,0.10), transparent 26%),
          linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.008)), #121212;
        padding:20px;
      }
      .ea-affiliate-grid{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px;}
      .ea-affiliate-box{border:1px solid rgba(255,255,255,0.05); background:#151515; border-radius:14px; padding:14px;}
      .ea-affiliate-box .k{font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#d4af37; font-weight:700; margin-bottom:6px;}
      .ea-affiliate-box strong{display:block; margin-bottom:4px;}
      .ea-affiliate-box span{font-size:13px; color:#b8b8b8; line-height:1.5;}
      @media (max-width: 960px){ .ea-affiliate-grid{grid-template-columns:1fr;} }
    `;
    NS.ui?.injectStyleOnce?.("ea-affiliate-bundle-e", css);
  }

  function buildModel() {
    const commissionEarned = num("affiliateCommissionEarned");
    const pending = num("affiliatePendingPayout");
    const total = num("affiliateTotalReferrals");
    const active = num("affiliateActiveReferrals") || num("affiliatePayingCount");
    const invited = num("affiliateInvitedCount");
    const signedUp = num("affiliateSignedUpCount");
    const churned = num("affiliateChurnedCount");
    const projected = active * 39 * 0.2;
    const actions = [];

    if (invited > signedUp) actions.push({ bucket: "Conversion", title: "Follow up with invited partners who have not signed up", copy: "Your invite-to-signup gap is still open. Push the short pitch and reactivation script first.", action: "Open Partner Scripts" });
    if (signedUp > active) actions.push({ bucket: "Revenue Move", title: "Convert signups into paying partners", copy: "You already have signup intent. Move those users from interest into recurring revenue.", action: "Open Recommended Actions" });
    if (active > 0) actions.push({ bucket: "Growth Move", title: "Recruit one more manager-level partner", copy: "Manager or dealership-level partners can multiply recurring adoption faster than individual reps.", action: "Open Partner Scripts" });
    if (active > 0 && churned > 0) actions.push({ bucket: "Retention", title: "Re-engage churned partner users", copy: "Lost partners are a revenue leak. Bring back the highest-fit ones first.", action: "Open Recent Referrals" });
    if (!actions.length) actions.push({ bucket: "Start", title: "Begin the partner flywheel", copy: "Get referral invitations and script usage moving so the recurring revenue loop can start.", action: "Open Partner Scripts" });

    const takeaway =
      active === 0 && signedUp > 0 ? "Your funnel has interest but low paid conversion." :
      active > 0 && churned > 0 ? "You have live recurring revenue, but retention needs attention." :
      active > 0 ? "You have a live recurring base. The next move is growing partner quality and volume." :
      "Top-of-funnel partner growth is the next monetization unlock.";

    return { commissionEarned, pending, total, active, invited, signedUp, churned, projected, actions, takeaway };
  }

  function render() {
    injectStyles();
    const section = document.getElementById("affiliate");
    if (!section) return;
    const model = buildModel();

    let mount = document.getElementById("eaAffiliateTop");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "eaAffiliateTop";
      mount.className = "ea-affiliate-top";
      section.insertBefore(mount, section.firstElementChild);
    }

    mount.innerHTML = `
      <div class="ea-affiliate-hero">
        <div class="section-head">
          <div>
            <div class="module-group-label">Revenue Workspace</div>
            <h2 style="margin-top:6px;">Turn partner activity into recurring revenue.</h2>
            <div class="subtext">This page should tell you where the next recurring dollar comes from — not just show referral stats.</div>
          </div>
        </div>
        <div class="ea-affiliate-grid">
          <div class="ea-affiliate-box">
            <div class="k">Projected Monthly Recurring</div>
            <strong>$${model.projected.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
            <span>${model.active} paying partner account${model.active === 1 ? "" : "s"} currently drive the main recurring base.</span>
          </div>
          <div class="ea-affiliate-box">
            <div class="k">Best Next Partner Move</div>
            <strong>${model.actions[0].title}</strong>
            <span>${model.actions[0].copy}</span>
          </div>
          <div class="ea-affiliate-box">
            <div class="k">Revenue Takeaway</div>
            <strong>${model.takeaway}</strong>
            <span>Use manager-level outreach, follow-up scripts, and reactivation to compound the partner loop.</span>
          </div>
          <div class="ea-affiliate-box">
            <div class="k">Payout Pressure</div>
            <strong>$${model.pending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pending</strong>
            <span>Payouts grow fastest when signups convert into active payers and churn stays low.</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-head">
          <div>
            <div class="module-group-label">Partner Action Queue</div>
            <h2 style="margin-top:6px;">What to do to grow recurring payouts.</h2>
            <div class="subtext">This ranks conversion, retention, and expansion moves instead of leaving partner growth as static data.</div>
          </div>
        </div>
        <div class="action-center-list">
          ${model.actions.slice(0, 5).map((item, idx) => `
            <div class="action-center-item">
              <div class="action-center-item-head">
                <div>
                  <div class="action-center-item-title">${idx + 1}. ${item.title}</div>
                  <div class="action-center-item-meta">${item.bucket}</div>
                </div>
                <span class="badge ${item.bucket === "Revenue Move" || item.bucket === "Growth Move" ? "active" : item.bucket === "Retention" ? "warn" : "inactive"}">${item.bucket}</span>
              </div>
              <div class="action-center-item-copy">${item.copy}</div>
              <div class="action-center-item-actions">
                <button class="action-btn ea-affiliate-action" type="button" data-idx="${idx}">${item.action}</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    mount.querySelectorAll(".ea-affiliate-action").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = model.actions[Number(btn.dataset.idx)];
        if (!item) return;
        if (/recent/i.test(item.action)) {
          document.getElementById("affiliateRecentReferrals")?.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          document.getElementById("affiliateRecommendedActions")?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  }

  function boot() {
    render();
    setTimeout(render, 1200);
    setTimeout(render, 3200);
  }

  NS.affiliate = { mount() { render(); return true; }, render };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  NS.modules = NS.modules || {};
  NS.modules.affiliate = true;
})();
