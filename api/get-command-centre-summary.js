import { createClient } from "@supabase/supabase-js";
import { getVerifiedRequestUser, getTrustedIdentity } from "./_shared/auth.js";
import { clean, normalizeEmail, safeNumber } from "./_shared/listing-normalize.js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUSINESS_TIMEZONE = "America/Edmonton";

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

function normalizeStatus(value) {
  const status = clean(value).toLowerCase();
  if (["sold", "deleted", "inactive", "failed", "stale"].includes(status)) return status;
  if (["posted", "active", "live", "approved", "relisted", "promote_now"].includes(status)) return "active";
  return status || "active";
}

function normalizeReviewBucket(value) {
  const bucket = clean(value).toLowerCase().replace(/[\s_-]+/g, "");
  if (!bucket) return "";
  if (["removedvehicles", "removed", "reviewdelete"].includes(bucket)) return "removedvehicles";
  if (["pricechanges", "pricechange", "reviewpriceupdate"].includes(bucket)) return "pricechanges";
  if (["newvehicles", "new", "reviewnew"].includes(bucket)) return "newvehicles";
  return bucket;
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

async function getProfileRow(userId, email) {
  if (userId) {
    let result = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (result.data) return result.data;
    result = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
    if (result.data) return result.data;
  }
  if (email) {
    const { data } = await supabase.from("profiles").select("*").ilike("email", email).order("updated_at", { ascending: false }).limit(1).maybeSingle();
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

async function getListingCounts(userId, email) {
  const counts = {
    active_listings: 0,
    review_queue_count: 0,
    needs_action_count: 0,
    weak_listings: 0,
    queue_count: 0,
    stale_review: 0,
    total_listings: 0,
    last_successful_post_at: null
  };

  async function load(tableName) {
    let query = supabase.from(tableName).select("status,lifecycle_status,review_bucket,posted_at,created_at,updated_at").order("posted_at", { ascending: false }).limit(500);
    if (userId) query = query.eq("user_id", userId);
    else if (email) query = query.ilike("email", email);
    const { data } = await query;
    return Array.isArray(data) ? data : [];
  }

  const rows = [...await load("user_listings"), ...await load("listings")];
  counts.total_listings = rows.length;

  for (const row of rows) {
    const status = normalizeStatus(row.status);
    const bucket = normalizeReviewBucket(row.review_bucket);
    const lifecycle = clean(row.lifecycle_status).toLowerCase();
    const activeLike = !["sold", "deleted", "inactive", "stale"].includes(status) && lifecycle !== "review_delete";
    if (activeLike) counts.active_listings += 1;
    if (bucket === "removedvehicles" || lifecycle === "review_delete") counts.stale_review += 1;
    if (bucket === "newvehicles") counts.queue_count += 1;
    if (bucket || lifecycle.startsWith("review")) counts.review_queue_count += 1;
    if (bucket === "pricechanges" || lifecycle === "review_price_update") counts.needs_action_count += 1;
    if (status === "stale" || bucket === "removedvehicles") counts.weak_listings += 1;
    if (!counts.last_successful_post_at) counts.last_successful_post_at = row.posted_at || row.created_at || row.updated_at || null;
  }

  return counts;
}

function buildSetupStatus(user, profileRow) {
  const inventoryUrl = clean(profileRow?.inventory_url || "");
  const salespersonName = clean(profileRow?.full_name || profileRow?.salesperson_name || `${clean(user?.first_name)} ${clean(user?.last_name)}`.trim());
  const dealershipName = clean(profileRow?.dealership || profileRow?.dealer_name || profileRow?.company_name || user?.company || "");
  const complianceMode = normalizeComplianceMode(profileRow?.compliance_mode, profileRow?.province);
  const website = clean(profileRow?.dealer_website || profileRow?.website || "");
  const scannerType = clean(profileRow?.scanner_type || profileRow?.scanner || "");
  const listingLocation = clean(profileRow?.listing_location || profileRow?.city || "");
  const checks = {
    inventory_url_present: Boolean(inventoryUrl),
    salesperson_name_present: Boolean(salespersonName),
    dealership_name_present: Boolean(dealershipName),
    compliance_mode_present: Boolean(complianceMode),
    dealer_website_present: Boolean(website),
    scanner_type_present: Boolean(scannerType),
    listing_location_present: Boolean(listingLocation)
  };
  const completion = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  return {
    profile_complete: completion === total,
    profile_completion_score: total ? completion / total : 0,
    first_post_complete: false,
    ...checks
  };
}

async function persistOperatorMode(userId) {
  if (!userId) return;
  await supabase.from("users").update({
    dashboard_mode: "operator",
    dashboard_mode_locked: true,
    operator_qualified_at: new Date().toISOString()
  }).eq("id", userId);
}

function resolveDashboardMode(user, setupStatus, counts) {
  const override = clean(user?.dashboard_mode_override || "").toLowerCase();
  if (override === "activation" || override === "operator") {
    return { dashboard_mode: override, dashboard_mode_locked: Boolean(user?.dashboard_mode_locked), operator_qualified: override === "operator", should_lock_operator: false };
  }
  if (Boolean(user?.dashboard_mode_locked) && clean(user?.dashboard_mode).toLowerCase() === "operator") {
    return { dashboard_mode: "operator", dashboard_mode_locked: true, operator_qualified: true, should_lock_operator: false };
  }
  const firstPostComplete = safeNumber(counts.total_listings, 0) > 0;
  setupStatus.first_post_complete = firstPostComplete;
  const qualifies = Boolean(setupStatus.profile_complete && setupStatus.compliance_mode_present && firstPostComplete);
  if (qualifies) {
    return { dashboard_mode: "operator", dashboard_mode_locked: true, operator_qualified: true, should_lock_operator: true };
  }
  return { dashboard_mode: "activation", dashboard_mode_locked: Boolean(user?.dashboard_mode_locked), operator_qualified: false, should_lock_operator: false };
}

function resolvePrimaryCommand(mode, counts, postsRemaining, canPost, setupStatus, activationScore) {
  if (mode !== "operator") {
    if (!setupStatus.profile_complete) return { type: "finish_profile", title: "Complete your operator profile", message: "Finish the required setup fields so the workspace can leave activation and move into operator mode.", primary_action: "open_setup", secondary_action: "open_compliance" };
    if (!setupStatus.compliance_mode_present) return { type: "finish_compliance", title: "Complete compliance setup", message: "Set the correct compliance mode before running a full live posting cycle.", primary_action: "open_compliance", secondary_action: "open_setup" };
    return { type: "first_post", title: "Run the first clean posting cycle", message: `Activation is ${activationScore}% complete. Push the first clean vehicle through the flow to lock this account into operator mode.`, primary_action: "open_tools", secondary_action: "open_setup" };
  }
  if (counts.stale_review > 0) return { type: "review_stale", title: `Review ${counts.stale_review} stale or removed listing${counts.stale_review === 1 ? "" : "s"}`, message: "Clean up stale inventory first so the machine stays accurate before you add more volume.", primary_action: "open_review_queue", secondary_action: "open_analytics" };
  if (counts.needs_action_count > 0) return { type: "needs_action", title: `Resolve ${counts.needs_action_count} listing${counts.needs_action_count === 1 ? "" : "s"} needing action`, message: "Clear the active action queue before adding fresh posting pressure.", primary_action: "open_review_queue", secondary_action: "open_analytics" };
  if (!canPost) return { type: "restore_posting", title: "Restore posting readiness", message: "Operator mode is active, but posting is not currently clear. Review access and session state before pushing more listings.", primary_action: "refresh_sync", secondary_action: "open_tools" };
  if (counts.queue_count > 0 && postsRemaining > 0) return { type: "post_queue", title: `Push ${Math.min(counts.queue_count, postsRemaining)} queued vehicle${Math.min(counts.queue_count, postsRemaining) === 1 ? "" : "s"} next`, message: `You currently have ${counts.queue_count} queued unit${counts.queue_count === 1 ? "" : "s"} and ${postsRemaining} posting slot${postsRemaining === 1 ? "" : "s"} remaining today.`, primary_action: "open_tools", secondary_action: "open_analytics" };
  if (postsRemaining > 0) return { type: "queue_next", title: "Queue the next best unit", message: `There are still ${postsRemaining} posting slot${postsRemaining === 1 ? "" : "s"} remaining today. Keep output moving while the machine is clean.`, primary_action: "open_tools", secondary_action: "open_analytics" };
  return { type: "hold_quality", title: "Maintain listing quality and operator rhythm", message: "The account is live, the machine is stable, and most current capacity is used. Stay focused on review quality and listing health.", primary_action: "open_analytics", secondary_action: "open_compliance" };
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const verifiedUser = await getVerifiedRequestUser(req);
    const trustedIdentity = getTrustedIdentity({ verifiedUser, query: req.query || {} });
    const requestUserId = clean(trustedIdentity?.id || req.query?.userId || req.query?.user_id || "");
    const requestEmail = normalizeEmail(trustedIdentity?.email || req.query?.email || "");
    const user = await resolveUser({ userId: requestUserId, email: requestEmail });
    const finalUserId = clean(user?.id || requestUserId || "");
    const finalEmail = normalizeEmail(user?.email || requestEmail || "");
    if (!finalUserId && !finalEmail) return res.status(400).json({ error: "Missing userId or email" });

    const [profileRow, postingUsageRow, counts] = await Promise.all([
      getProfileRow(finalUserId, finalEmail),
      getPostingUsageRow(finalUserId, finalEmail),
      getListingCounts(finalUserId, finalEmail)
    ]);

    const setupStatus = buildSetupStatus(user || {}, profileRow || {});
    const activationScore = Math.round((Number(setupStatus.profile_completion_score || 0)) * 100);
    const dailyLimit = clean(user?.plan).toLowerCase().includes("pro") ? 25 : 5;
    const postsToday = safeNumber(postingUsageRow?.posts_today ?? postingUsageRow?.posts_used ?? postingUsageRow?.used_today, 0);
    const postsRemaining = Math.max(dailyLimit - postsToday, 0);
    const canPost = postsRemaining > 0;
    const modeState = resolveDashboardMode(user || {}, setupStatus, counts);
    if (modeState.should_lock_operator && finalUserId) await persistOperatorMode(finalUserId);
    const primaryCommand = resolvePrimaryCommand(modeState.dashboard_mode, counts, postsRemaining, canPost, setupStatus, activationScore);

    return res.status(200).json({
      success: true,
      data: {
        dashboard_mode: modeState.dashboard_mode,
        dashboard_mode_locked: modeState.dashboard_mode_locked,
        operator_qualified: modeState.operator_qualified,
        activation_complete: Boolean(setupStatus.profile_complete && setupStatus.compliance_mode_present && setupStatus.first_post_complete),
        activation_score: activationScore,
        setup_status: setupStatus,
        command_center: {
          primary_command: primaryCommand,
          kpis: {
            active_listings: counts.active_listings,
            posted_today: postsToday,
            remaining_today: postsRemaining,
            in_review: counts.review_queue_count,
            needs_action: counts.needs_action_count,
            at_risk: counts.weak_listings
          },
          work_queues: {
            ready_to_post: counts.queue_count,
            review_queue: counts.review_queue_count,
            compliance_blocked: setupStatus.compliance_mode_present ? 0 : 1,
            failed_posts: 0,
            stale_review: counts.stale_review
          },
          machine_health: {
            extension_connected: true,
            session_valid: true,
            last_successful_post_at: counts.last_successful_post_at,
            queue_healthy: true,
            duplicate_protection: true,
            compliance_engine: true,
            last_sync_at: new Date().toISOString()
          },
          performance_snapshot: {
            posted_7d: counts.total_listings,
            active_trend: counts.active_listings,
            review_trend: counts.review_queue_count,
            action_trend: counts.needs_action_count
          },
          quick_actions: modeState.dashboard_mode === "operator"
            ? ["open_tools", "open_analytics", "open_review_queue", "open_compliance", "refresh_sync"]
            : ["open_setup", "open_compliance", "open_tools", "refresh_sync"]
        }
      }
    });
  } catch (error) {
    console.error("[get-command-centre-summary] failed:", error);
    return res.status(500).json({ success: false, error: error?.message || "Command centre summary failed" });
  }
}
