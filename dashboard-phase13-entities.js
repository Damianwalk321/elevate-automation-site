(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.phase13entities) return;

  function clean(v) {
    return String(v || "").replace(/\s+/g, " ").trim();
  }

  function slug(v, fallback = "entity") {
    const s = clean(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s || fallback;
  }

  function pick(...values) {
    for (const v of values) {
      const c = clean(v);
      if (c) return c;
    }
    return "";
  }

  function text(id) {
    return clean(document.getElementById(id)?.textContent || "");
  }

  function deepGet(obj, path) {
    const parts = String(path || "").split(".");
    let ref = obj;
    for (const part of parts) {
      if (!ref || ref[part] === undefined) return "";
      ref = ref[part];
    }
    return ref;
  }

  function readValues(paths = []) {
    const profile = NS.state?.get?.("profile", {}) || {};
    const session = NS.state?.get?.("session", {}) || {};
    const user = window.currentUser || NS.state?.get?.("user", {}) || {};
    const summary = window.dashboardSummaryV2 || NS.summaryV2 || NS.state?.get?.("summary_v2", {}) || {};

    for (const path of paths) {
      const value = pick(
        deepGet(profile, path),
        deepGet(session, path),
        deepGet(user, path),
        deepGet(summary, path)
      );
      if (value) return value;
    }
    return "";
  }

  function currentEntities() {
    const plan = pick(readValues(["plan_name", "plan", "subscription.plan"]), text("billingPlanName"), text("currentPlanName"), "Starter");
    const email = pick(
      readValues(["email", "user.email", "account.email"]),
      clean(document.querySelector(".user-email")?.textContent || ""),
      "operator@local"
    );
    const fullName = pick(
      readValues(["full_name", "name", "user.name", "account.name"]),
      clean(document.querySelector(".user-name")?.textContent || ""),
      email.split("@")[0]
    );
    const firstName = clean(fullName.split(" ")[0] || "Operator");

    const dealershipName = pick(
      readValues(["dealership_name", "dealer_name", "company_name", "company", "business_name"]),
      text("dealerName"),
      text("companyName"),
      "Primary Dealership"
    );

    const role = pick(
      readValues(["role", "user.role", "membership.role"]),
      /manager|admin|owner/i.test(fullName) ? "manager" : "",
      "operator"
    );

    const accountId = slug(pick(readValues(["account_id", "user.id", "id"]), email), "account");
    const dealershipId = slug(pick(readValues(["dealership_id", "dealer_id", "company_id"]), dealershipName), "dealership");
    const teamId = `${dealershipId}-team`;
    const memberId = slug(pick(readValues(["user_id", "user.id", "id"]), email), "member");

    const summary = window.dashboardSummaryV2 || NS.summaryV2 || NS.state?.get?.("summary_v2", {}) || {};
    const readiness = pick(summary.readiness_state, "warning");
    const syncConfidence = pick(summary.sync_confidence, "local");
    const feedState = pick(summary.listing_feed_state, "unknown");

    const entities = {
      version: "entities-v1",
      captured_at: new Date().toISOString(),
      account: {
        id: accountId,
        name: `${firstName} Account`,
        email,
        plan_name: plan,
        readiness_state: readiness,
        sync_confidence: syncConfidence
      },
      dealership: {
        id: dealershipId,
        account_id: accountId,
        name: dealershipName,
        health_basis: pick(summary.upgrade_pressure, "low"),
        listing_feed_state: feedState
      },
      team: {
        id: teamId,
        dealership_id: dealershipId,
        name: `${dealershipName} Team`,
        member_count: 1,
        visibility_mode: "single-operator-seeded"
      },
      members: [
        {
          id: memberId,
          account_id: accountId,
          dealership_id: dealershipId,
          team_id: teamId,
          email,
          name: fullName,
          role,
          status: "active"
        }
      ],
      memberships: [
        {
          id: `${teamId}-${memberId}`,
          team_id: teamId,
          member_id: memberId,
          role,
          status: "active"
        }
      ]
    };

    return entities;
  }

  function persistEntities(entities) {
    NS.entitiesV1 = entities;
    window.dashboardEntitiesV1 = entities;

    if (NS.state?.set) {
      try {
        NS.state.set("entities_v1", entities, { silent: true, skipPersist: false });
      } catch {}
    }

    NS.events?.dispatchEvent?.(new CustomEvent("entities:v1", { detail: entities }));
    window.dispatchEvent(new CustomEvent("elevate:entities-v1", { detail: entities }));
  }

  function addEntitySignal(entities) {
    const target =
      document.getElementById("phase8ManagerCompact") ||
      document.getElementById("phase11DealershipCard") ||
      document.getElementById("phase9CommercialCard");

    if (!target) return;

    let signal = target.querySelector(".phase13-entity-pill");
    if (!signal) {
      signal = document.createElement("div");
      signal.className = "phase13-entity-pill";
      signal.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "min-height:24px",
        "padding:0 9px",
        "border-radius:999px",
        "font-size:10px",
        "font-weight:700",
        "letter-spacing:.03em",
        "border:1px solid rgba(212,175,55,0.18)",
        "background:rgba(212,175,55,0.08)",
        "color:#f3ddb0",
        "width:fit-content",
        "margin-top:8px"
      ].join(";");

      const copyTarget =
        target.querySelector(".copy") ||
        target.querySelector(".phase8-copy") ||
        target.querySelector(".subtext");

      if (copyTarget) {
        copyTarget.insertAdjacentElement("afterend", signal);
      } else {
        target.insertAdjacentElement("afterbegin", signal);
      }
    }

    signal.textContent = `Entities V1 • ${entities.account.plan_name} • ${entities.members[0].role} • ${entities.dealership.name}`;
  }

  function run() {
    const entities = currentEntities();
    persistEntities(entities);
    addEntitySignal(entities);
  }

  function boot() {
    run();
    setTimeout(run, 250);
    setTimeout(run, 900);
    setTimeout(run, 1800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("elevate:summary-v2", () => setTimeout(run, 120));
  window.addEventListener("elevate:sync-refreshed", () => setTimeout(run, 120));
  NS.events?.addEventListener?.("state:set", () => setTimeout(run, 120));

  NS.modules = NS.modules || {};
  NS.modules.phase13entities = true;
})();