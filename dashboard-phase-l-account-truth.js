
(() => {
  if (window.__ELEVATE_PHASE_L_ACCOUNT_TRUTH__) return;
  window.__ELEVATE_PHASE_L_ACCOUNT_TRUTH__ = true;

  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  const STYLE_ID = "ea-phase-l-style";

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function num(value, fallback = 0) {
    const match = String(value || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    const parsed = match ? Number(match[0]) : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function money(value) {
    const n = Number(value || 0);
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0
    }).format(Number.isFinite(n) ? n : 0);
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ea-l-truth-card{
        margin-top:20px;
        border:1px solid rgba(212,175,55,0.14);
        border-radius:18px;
        padding:18px;
        background:linear-gradient(180deg, rgba(212,175,55,0.06), rgba(255,255,255,0.02));
      }
      .ea-l-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;
        margin-top:14px;
      }
      .ea-l-cell{
        background:#171717;
        border:1px solid rgba(255,255,255,0.06);
        border-radius:14px;
        padding:14px;
      }
      .ea-l-label{
        font-size:11px;
        text-transform:uppercase;
        letter-spacing:.12em;
        color:#d4af37;
        font-weight:700;
        margin-bottom:8px;
      }
      .ea-l-value{
        font-size:22px;
        line-height:1.08;
        font-weight:800;
        color:#f5f5f5;
      }
      .ea-l-sub{
        margin-top:8px;
        font-size:13px;
        color:#a9a9a9;
        line-height:1.5;
      }
      @media (max-width:1100px){
        .ea-l-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
      }
      @media (max-width:760px){
        .ea-l-grid{grid-template-columns:1fr;}
      }
    `;
    document.head.appendChild(style);
  }

  function getSummary() {
    try {
      return NS.state?.get ? (NS.state.get("summary", {}) || {}) : {};
    } catch {
      return {};
    }
  }

  function derivePlanTruth() {
    const summary = getSummary();
    const candidates = [
      summary.plan_name,
      summary.plan,
      summary.subscription_plan,
      summary.plan_type,
      summary.normalized_plan,
      document.getElementById("planNameBilling")?.textContent,
      document.getElementById("extensionPlan")?.textContent,
      document.getElementById("overviewPlanChip")?.textContent
    ].map(clean).filter(Boolean);

    const haystack = candidates.join(" ").toLowerCase();

    if (haystack.includes("pro")) {
      return {
        planKey: "pro",
        planName: "Pro",
        dailyLimit: 25,
        monthlyPrice: 79
      };
    }

    return {
      planKey: "starter",
      planName: "Starter",
      dailyLimit: 5,
      monthlyPrice: 49
    };
  }

  function deriveAccessTruth(planTruth) {
    const summary = getSummary();
    const checkoutSuccess = new URLSearchParams(window.location.search).get("checkout") === "success";

    const statusCandidates = [
      summary.subscription_status,
      summary.status,
      summary.access_status,
      summary.account_status,
      document.getElementById("subscriptionStatusBilling")?.textContent,
      document.getElementById("overviewAccessChip")?.textContent,
      document.getElementById("accessBadgeBilling")?.textContent
    ].map(clean).filter(Boolean);

    const statusHaystack = statusCandidates.join(" ").toLowerCase();

    let accessState = "active";
    if (statusHaystack.includes("cancel")) accessState = "cancelled";
    else if (statusHaystack.includes("past due")) accessState = "past_due";
    else if (statusHaystack.includes("trial") || checkoutSuccess) accessState = "trial_active";
    else if (statusHaystack.includes("inactive")) accessState = "inactive";

    const trialEndsAt = "2026-04-20T00:00:00Z";

    let postsUsed = num(summary.posts_used_today, NaN);
    if (!Number.isFinite(postsUsed)) postsUsed = num(summary.posts_used, NaN);
    if (!Number.isFinite(postsUsed)) postsUsed = num(document.getElementById("extensionPostsUsed")?.textContent || "", 0);
    if (!Number.isFinite(postsUsed)) postsUsed = 0;

    let postsRemaining = num(summary.posts_remaining_today, NaN);
    if (!Number.isFinite(postsRemaining)) postsRemaining = planTruth.dailyLimit - postsUsed;
    postsRemaining = Math.max(0, Math.min(planTruth.dailyLimit, postsRemaining));

    return {
      accessState,
      trialEndsAt,
      postsUsed,
      postsRemaining
    };
  }

  function buildAccountTruth() {
    const planTruth = derivePlanTruth();
    const accessTruth = deriveAccessTruth(planTruth);

    return {
      plan_key: planTruth.planKey,
      plan_name: planTruth.planName,
      daily_limit: planTruth.dailyLimit,
      monthly_price: planTruth.monthlyPrice,
      access_state: accessTruth.accessState,
      trial_ends_at: accessTruth.trialEndsAt,
      posts_used_today: accessTruth.postsUsed,
      posts_remaining_today: accessTruth.postsRemaining,
      upgraded_at: new Date().toISOString(),
      source: "phase_l_account_truth"
    };
  }

  function publishTruth(truth) {
    NS.accountTruth = truth;
    NS.modules = NS.modules || {};
    NS.modules.accountTruth = true;

    try {
      NS.state?.set?.("accountTruth", truth, { silent: true });
    } catch (error) {
      console.error("[Phase L] Could not persist account truth to dashboard state:", error);
    }

    try {
      NS.events?.dispatchEvent?.(new CustomEvent("accountTruth:updated", { detail: truth }));
    } catch {}

    try {
      window.dispatchEvent(new CustomEvent("elevate:account-truth", { detail: truth }));
    } catch {}
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  }

  function applyTruthToDom(truth) {
    setText("overviewPlanChip", truth.plan_name);
    setText("extensionPlan", truth.plan_name);
    setText("planNameBilling", truth.plan_name);

    setText("extensionPostLimit", `${truth.daily_limit} posts/day`);
    setText("snapshotPostsRemaining", `${truth.posts_remaining_today}`);
    setText("kpiPostsRemaining", `${truth.posts_remaining_today}`);

    const commandPostsUsed = document.getElementById("commandPostsUsed");
    if (commandPostsUsed) {
      commandPostsUsed.textContent = `${truth.posts_used_today} / ${truth.daily_limit}`;
    }

    const extensionRemainingPosts = document.getElementById("extensionRemainingPosts");
    if (extensionRemainingPosts) {
      extensionRemainingPosts.textContent = `${truth.posts_remaining_today}`;
    }

    const extensionPostsUsed = document.getElementById("extensionPostsUsed");
    if (extensionPostsUsed) {
      extensionPostsUsed.textContent = `${truth.posts_used_today}`;
    }

    const accessBadge = document.getElementById("accessBadgeBilling");
    if (accessBadge) {
      accessBadge.textContent = truth.access_state === "trial_active" ? "Trial Active" : "Active";
      accessBadge.className = "badge active";
    }

    const subscriptionStatus = document.getElementById("subscriptionStatusBilling");
    if (subscriptionStatus) {
      subscriptionStatus.textContent = truth.access_state === "trial_active" ? "Trial Active" : "Active";
    }

    const overviewAccessChip = document.getElementById("overviewAccessChip");
    if (overviewAccessChip) {
      overviewAccessChip.textContent = truth.access_state === "trial_active" ? "Trial Active" : "Active Access";
    }

    const accountStatusBilling = document.getElementById("accountStatusBilling");
    if (accountStatusBilling) {
      accountStatusBilling.textContent =
        truth.access_state === "trial_active"
          ? `Trial active through Apr 20, 2026 • ${truth.plan_name} • ${truth.daily_limit} posts/day`
          : `${truth.plan_name} active • ${truth.daily_limit} posts/day`;
    }
  }

  function injectCanonicalTruthCard(truth) {
    const billing = document.getElementById("billing");
    if (!billing) return;

    let card = document.getElementById("eaPhaseLCanonicalTruthCard");
    if (!card) {
      card = document.createElement("div");
      card.id = "eaPhaseLCanonicalTruthCard";
      card.className = "ea-l-truth-card";
      billing.appendChild(card);
    }

    card.innerHTML = `
      <div class="section-head">
        <div>
          <div class="ea-l-label">Canonical Account Truth</div>
          <h2 style="margin-top:6px;">One source should drive UI, billing copy, and daily limits.</h2>
          <div class="subtext">Phase L publishes a shared account truth object into the dashboard namespace and state layer.</div>
        </div>
      </div>

      <div class="ea-l-grid">
        <div class="ea-l-cell">
          <div class="ea-l-label">Plan Key</div>
          <div class="ea-l-value">${truth.plan_key}</div>
          <div class="ea-l-sub">Machine-facing normalized plan key.</div>
        </div>
        <div class="ea-l-cell">
          <div class="ea-l-label">Visible Plan</div>
          <div class="ea-l-value">${truth.plan_name}</div>
          <div class="ea-l-sub">Commercial truth shown to the user.</div>
        </div>
        <div class="ea-l-cell">
          <div class="ea-l-label">Daily Limit</div>
          <div class="ea-l-value">${truth.daily_limit}</div>
          <div class="ea-l-sub">Starter = 5/day • Pro = 25/day.</div>
        </div>
        <div class="ea-l-cell">
          <div class="ea-l-label">Expected Monthly</div>
          <div class="ea-l-value">${money(truth.monthly_price)}</div>
          <div class="ea-l-sub">Current recurring expectation for this plan tier.</div>
        </div>
      </div>

      <div class="ea-l-grid">
        <div class="ea-l-cell">
          <div class="ea-l-label">Access State</div>
          <div class="ea-l-value">${truth.access_state}</div>
          <div class="ea-l-sub">Current account/billing posture.</div>
        </div>
        <div class="ea-l-cell">
          <div class="ea-l-label">Posts Used</div>
          <div class="ea-l-value">${truth.posts_used_today}</div>
          <div class="ea-l-sub">Current consumed daily output.</div>
        </div>
        <div class="ea-l-cell">
          <div class="ea-l-label">Posts Remaining</div>
          <div class="ea-l-value">${truth.posts_remaining_today}</div>
          <div class="ea-l-sub">Remaining capacity under canonical truth.</div>
        </div>
        <div class="ea-l-cell">
          <div class="ea-l-label">Trial Ends</div>
          <div class="ea-l-value">Apr 20</div>
          <div class="ea-l-sub">${truth.trial_ends_at}</div>
        </div>
      </div>
    `;
  }

  function hookStateUpdates() {
    if (!NS.state || NS.__PHASE_L_STATE_HOOKED__) return;
    NS.__PHASE_L_STATE_HOOKED__ = true;

    const originalSet = NS.state.set?.bind(NS.state);
    const originalMerge = NS.state.merge?.bind(NS.state);

    if (originalSet) {
      NS.state.set = function(path, value, options) {
        const result = originalSet(path, value, options);
        if (String(path || "").startsWith("summary") || String(path || "").startsWith("user") || String(path || "").startsWith("profile")) {
          queueMicrotask(run);
        }
        return result;
      };
    }

    if (originalMerge) {
      NS.state.merge = function(path, value, options) {
        const result = originalMerge(path, value, options);
        if (String(path || "").startsWith("summary") || String(path || "").startsWith("user") || String(path || "").startsWith("profile")) {
          queueMicrotask(run);
        }
        return result;
      };
    }
  }

  function run() {
    installStyles();
    const truth = buildAccountTruth();
    publishTruth(truth);
    applyTruthToDom(truth);
    injectCanonicalTruthCard(truth);
  }

  hookStateUpdates();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  setTimeout(run, 800);
  setTimeout(run, 2200);
  setTimeout(run, 4200);
})();
