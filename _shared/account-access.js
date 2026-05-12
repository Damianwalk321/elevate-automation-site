
function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

const FORCE_PRO_EMAILS = new Set(["damian044@icloud.com"]);

export function normalizePlanLabel(value) {
  const raw = clean(value).toLowerCase();
  if (!raw || raw === "no plan") return "Founder Beta";
  if (raw.includes("founder") && raw.includes("pro")) return "Founder Pro";
  if (raw.includes("founder") && raw.includes("starter")) return "Founder Beta";
  if (raw.includes("founder") || raw.includes("beta")) return "Founder Beta";
  if (raw.includes("pro")) return "Pro";
  if (raw.includes("starter")) return "Starter";
  return clean(value) || "Founder Beta";
}

export function inferPostingLimitFromPlan(value) {
  const raw = normalizePlanLabel(value).toLowerCase();
  if ((raw.includes("founder") && raw.includes("pro")) || raw === "pro" || (!raw.includes("founder") && raw.includes("pro"))) return 25;
  return 5;
}

export function normalizeStatusValue(value, fallback = "inactive") {
  const status = clean(value).toLowerCase();
  if (!status) return fallback;
  if (["active", "trialing", "paid", "checkout_pending"].includes(status)) return "active";
  if (["canceled", "cancelled", "unpaid", "past_due", "expired", "suspended", "inactive"].includes(status)) return "inactive";
  return status;
}

export function isForcedProEmail(email = "") {
  return FORCE_PRO_EMAILS.has(normalizeEmail(email));
}

export function resolveAccountAccess({
  plan,
  status,
  postsToday = 0,
  postingLimit,
  creditExtraPosts = 0,
  email = "",
  stripeCustomerId = "",
  currentPeriodEnd = null,
  cancelAtPeriodEnd = false,
  minimumVersion = "",
  latestVersion = "",
  extensionVersion = ""
} = {}) {
  const normalizedEmail = normalizeEmail(email);
  const forcedPro = isForcedProEmail(normalizedEmail);
  const normalizedPlan = forcedPro ? "Pro" : normalizePlanLabel(plan);
  const normalizedStatus = forcedPro ? "active" : normalizeStatusValue(status, "inactive");
  const derivedPlanLimit = inferPostingLimitFromPlan(normalizedPlan);
  const requestedLimit = Number(postingLimit);
  const baseLimit = forcedPro
    ? Math.max(25, Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 0)
    : (Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : derivedPlanLimit);
  const extraPostingLimit = Math.max(0, Number(creditExtraPosts) || 0);
  const finalLimit = baseLimit + extraPostingLimit;
  const used = Math.max(0, Number(postsToday) || 0);
  const remaining = Math.max(0, finalLimit - used);
  const active = forcedPro ? true : normalizedStatus === "active";
  const versionRequired = Boolean(minimumVersion) && Boolean(extensionVersion) && String(extensionVersion).localeCompare(String(minimumVersion), undefined, { numeric: true, sensitivity: 'base' }) < 0;
  return {
    plan: normalizedPlan,
    plan_label: normalizedPlan,
    canonical_source: forcedPro ? "forced_founder_access" : "shared_account_access",
    email: normalizedEmail,
    is_pro: true === forcedPro ? true : normalizedPlan.toLowerCase().includes("pro"),
    status: normalizedStatus,
    base_posting_limit: baseLimit,
    extra_posting_limit: extraPostingLimit,
    posting_limit: finalLimit,
    posts_today: used,
    posts_remaining: remaining,
    access_granted: active,
    can_post: active && remaining > 0 && !versionRequired,
    active,
    forced_pro: forcedPro,
    billing: {
      needs_checkout: forcedPro ? false : (!active && !clean(stripeCustomerId)),
      can_access_portal: forcedPro ? true : Boolean(clean(stripeCustomerId)),
      current_period_end: currentPeriodEnd || null,
      cancel_at_period_end: Boolean(cancelAtPeriodEnd)
    },
    extension: {
      update_required: versionRequired,
      minimum_version: minimumVersion || "",
      latest_version: latestVersion || minimumVersion || ""
    }
  };
}

export function buildCanonicalAccessState(args = {}) {
  return resolveAccountAccess(args);
}
