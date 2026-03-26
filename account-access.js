
function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

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

export function hasTestingLimitOverride(email) {
  return new Set(["damian044@icloud.com"]).has(normalizeEmail(email));
}

export function resolveAccountAccess({
  plan,
  status,
  postsToday = 0,
  postingLimit,
  email = "",
  stripeCustomerId = "",
  currentPeriodEnd = null,
  cancelAtPeriodEnd = false,
  minimumVersion = "",
  latestVersion = "",
  extensionVersion = ""
} = {}) {
  const normalizedPlan = normalizePlanLabel(plan);
  const normalizedStatus = normalizeStatusValue(status, "inactive");
  const baseLimit = Number.isFinite(Number(postingLimit)) && Number(postingLimit) > 0 ? Number(postingLimit) : inferPostingLimitFromPlan(normalizedPlan);
  const finalLimit = hasTestingLimitOverride(email) ? Math.max(25, baseLimit) : baseLimit;
  const used = Math.max(0, Number(postsToday) || 0);
  const remaining = Math.max(0, finalLimit - used);
  const active = normalizedStatus === "active";
  const versionRequired = Boolean(minimumVersion) && Boolean(extensionVersion) && String(extensionVersion).localeCompare(String(minimumVersion), undefined, { numeric: true, sensitivity: 'base' }) < 0;
  return {
    plan: normalizedPlan,
    status: normalizedStatus,
    posting_limit: finalLimit,
    posts_today: used,
    posts_remaining: remaining,
    can_post: active && remaining > 0 && !versionRequired,
    active,
    billing: {
      needs_checkout: !active && !clean(stripeCustomerId),
      can_access_portal: Boolean(clean(stripeCustomerId)),
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
