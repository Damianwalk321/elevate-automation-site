import { createClient } from "@supabase/supabase-js";
import { buildCanonicalAccessState, inferPostingLimitFromPlan, normalizePlanLabel, normalizeStatusValue } from "./_shared/account-access.js";
import { getVerifiedRequestUser, getTrustedIdentity } from "./_shared/auth.js";
import { clean, normalizeEmail, safeNumber } from "./_shared/listing-normalize.js";
import { CANONICAL_LISTINGS_TABLE, CANONICAL_PROFILE_TABLE, LEGACY_LISTINGS_TABLES, canonicalIdentityMeta, buildCanonicalProfileSnapshot, profileSetupFields } from "../_shared/canonical-state.js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUSINESS_TIMEZONE = "America/Edmonton";

function buildRequestId(req) {
  return clean(req.headers['x-request-id'] || '') || `summary_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProvince(value) {
  const raw = clean(value).toUpperCase();
  if (!raw) return "";
  if (raw === "ALBERTA" || raw.startsWith("AB")) return "AB";
  if (raw === "BRITISH COLUMBIA" || raw.startsWith("BC")) return "BC";
  return raw;
}

function normalizeComplianceMode(value, province = "") {
  const raw = clean(value).toUpperCase();
  if (!raw || raw === "STRICT") return normalizeProvince(province);
  if (raw === "ALBERTA" || raw.startsWith("AB")) return "AB";
  if (raw === "BRITISH COLUMBIA" || raw.startsWith("BC")) return "BC";
  return raw;
}

function dayKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

async function resolveUser({ userId, email }) {
  if (userId) {
    const { data } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
    if (data) return data;
  }
  if (email) {
    const { data } = await supabase.from("users").select("*").ilike("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data) return data;
  }
  return null;
}

async function getSubscription(userId, email) {
  if (userId) {
    const { data } = await supabase.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data) return data;
  }
  if (email) {
    const { data } = await supabase.from("subscriptions").select("*").ilike("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data) return data;
  }
  return null;
}

async function getProfileRow(userId, email) {
  if (userId) {
    const { data } = await supabase.from(CANONICAL_PROFILE_TABLE).select("*").eq("id", userId).maybeSingle();
    if (data) return data;
  }
  if (email) {
    const { data } = await supabase.from(CANONICAL_PROFILE_TABLE).select("*").ilike("email", email).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (data) return data;
  }
  return null;
}

async function getPostingUsageRow(userId, email) {
  const today = dayKey();
  if (userId) {
    const { data } = await supabase.from("posting_usage").select("*").eq("user_id", userId).eq("date_key", today).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (data) return data;
  }
  if (email) {
    const { data } = await supabase.from("posting_usage").select("*").ilike("email", email).eq("date_key", today).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (data) return data;
  }
  return null;
}

function buildSetupStatus(profileSnapshot = {}) {
  const checks = profileSetupFields(profileSnapshot);
  const completion = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  return {
    profile_complete: completion === total,
    profile_completion_score: total ? completion / total : 0,
    ...checks,
  };
}

function buildDiagnostics({ requestId, identity, user = null, profile = null, subscription = null, postingUsage = null, phase = 'read' }) {
  return {
    request_id: requestId,
    endpoint: 'api/get-dashboard-summary-canonical',
    phase,
    identity_source: identity?.identity_source || 'unknown',
    matched_by: identity?.matched_by || 'unknown',
    resolved_user_id: clean(user?.id || identity?.id || ''),
    resolved_email: normalizeEmail(user?.email || identity?.email || ''),
    matched_profile: Boolean(profile),
    matched_subscription: Boolean(subscription),
    matched_posting_usage: Boolean(postingUsage),
    summary_source: 'canonical',
    timestamp: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  const requestId = buildRequestId(req);
  res.setHeader("x-request-id", requestId);

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
      diagnostics: { request_id: requestId, endpoint: 'api/get-dashboard-summary-canonical', method: req.method }
    });
  }

  try {
    const verifiedUser = await getVerifiedRequestUser(req);
    const trustedIdentity = getTrustedIdentity({ verifiedUser, query: req.query || {} });
    const identity = canonicalIdentityMeta({
      verifiedUser,
      trustedIdentity,
      requestedId: req.query?.userId || req.query?.user_id || "",
      requestedEmail: req.query?.email || "",
    });

    const requestUserId = clean(identity.id || "");
    const requestEmail = normalizeEmail(identity.email || "");
    const user = await resolveUser({ userId: requestUserId, email: requestEmail });
    const finalUserId = clean(user?.id || requestUserId || "");
    const finalEmail = normalizeEmail(user?.email || requestEmail || "");

    if (!finalUserId && !finalEmail) {
      return res.status(400).json({
        error: "Missing userId or email",
        diagnostics: buildDiagnostics({ requestId, identity, phase: 'missing_identity' })
      });
    }

    const [subscriptionRow, postingUsageRow, profileRow] = await Promise.all([
      getSubscription(finalUserId, finalEmail),
      getPostingUsageRow(finalUserId, finalEmail),
      getProfileRow(finalUserId, finalEmail),
    ]);

    const snapshotCache = subscriptionRow?.account_snapshot && typeof subscriptionRow.account_snapshot === "object" ? subscriptionRow.account_snapshot : {};
    const planValue = clean(subscriptionRow?.plan_type || subscriptionRow?.plan_name || subscriptionRow?.plan || user?.plan || snapshotCache.plan || "Founder Beta");
    const canonicalPlan = normalizePlanLabel(planValue);
    const postingLimit = safeNumber(subscriptionRow?.daily_posting_limit ?? subscriptionRow?.posting_limit, inferPostingLimitFromPlan(canonicalPlan));
    const postsToday = safeNumber(postingUsageRow?.posts_today ?? postingUsageRow?.posts_used ?? postingUsageRow?.used_today, 0);
    const rawStatus = clean(subscriptionRow?.status || subscriptionRow?.subscription_status || user?.subscription_status || user?.status || "inactive");
    const accessState = buildCanonicalAccessState({
      plan: canonicalPlan,
      status: normalizeStatusValue(rawStatus, canonicalPlan ? "active" : "inactive"),
      postsToday,
      postingLimit,
      email: finalEmail,
      stripeCustomerId: clean(subscriptionRow?.stripe_customer_id || user?.stripe_customer_id || snapshotCache.stripe_customer_id || ""),
      currentPeriodEnd: subscriptionRow?.current_period_end || null,
      cancelAtPeriodEnd: Boolean(subscriptionRow?.cancel_at_period_end),
    });

    const profileSnapshot = buildCanonicalProfileSnapshot(user || { id: finalUserId, email: finalEmail }, profileRow || {});
    profileSnapshot.province = normalizeProvince(profileSnapshot.province);
    profileSnapshot.compliance_mode = normalizeComplianceMode(profileSnapshot.compliance_mode, profileSnapshot.province);
    const setupStatus = buildSetupStatus(profileSnapshot);

    return res.status(200).json({
      success: true,
      data: {
        identity_source: identity.identity_source,
        matched_by: identity.matched_by,
        canonical_profile_table: CANONICAL_PROFILE_TABLE,
        canonical_listings_table: CANONICAL_LISTINGS_TABLE,
        legacy_listings_tables: LEGACY_LISTINGS_TABLES,
        posts_today: postsToday,
        posts_remaining: safeNumber(accessState.posts_remaining, 0),
        daily_limit: postingLimit,
        effective_posting_limit: safeNumber(accessState.posting_limit, postingLimit),
        can_post: Boolean(accessState.can_post),
        account_snapshot: {
          user_id: finalUserId,
          email: finalEmail,
          plan: accessState.plan,
          status: accessState.status,
          active: Boolean(accessState.active),
          access_granted: Boolean(accessState.access_granted),
          posting_limit: safeNumber(accessState.posting_limit, postingLimit),
          posts_today: postsToday,
          posts_remaining: safeNumber(accessState.posts_remaining, 0),
          current_period_end: subscriptionRow?.current_period_end || null,
          trial_end: subscriptionRow?.trial_end || null,
          inventory_url: profileSnapshot.inventory_url,
          dealer_website: profileSnapshot.dealer_website,
          scanner_type: profileSnapshot.scanner_type,
          listing_location: profileSnapshot.listing_location,
          compliance_mode: profileSnapshot.compliance_mode,
          snapshot_cache_only: true,
          canonical_source: "api/get-dashboard-summary-canonical"
        },
        profile_snapshot: profileSnapshot,
        setup_status: setupStatus,
        plan_access: {
          plan_label: accessState.plan,
          is_pro: Boolean(accessState.is_pro),
          posting_limit: safeNumber(accessState.posting_limit, postingLimit),
          posts_today: postsToday,
          posts_remaining: safeNumber(accessState.posts_remaining, 0),
          status: accessState.status,
          active: Boolean(accessState.active),
          access_granted: Boolean(accessState.access_granted),
          can_post: Boolean(accessState.can_post),
          billing: accessState.billing || {},
          extension: accessState.extension || {}
        },
        diagnostics: buildDiagnostics({
          requestId,
          identity,
          user,
          profile: profileRow,
          subscription: subscriptionRow,
          postingUsage: postingUsageRow,
          phase: 'read'
        })
      }
    });
  } catch (error) {
    console.error("[get-dashboard-summary-canonical] fatal error:", error);
    return res.status(500).json({
      error: error?.message || "Internal server error",
      diagnostics: { request_id: requestId, endpoint: 'api/get-dashboard-summary-canonical', phase: 'fatal', timestamp: new Date().toISOString() }
    });
  }
}
