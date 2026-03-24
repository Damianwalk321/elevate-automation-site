import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dayKeyNow() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function dayStartIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function isActiveStatus(value) {
  const status = clean(value).toLowerCase();
  return ["active", "trialing", "paid", "checkout_pending"].includes(status);
}

function normalizePlan(value) {
  return clean(value).toLowerCase();
}

function inferPostingLimitFromPlan(planValue) {
  const plan = normalizePlan(planValue);
  if (!plan) return 5;
  if (plan.includes("founder") && plan.includes("pro")) return 25;
  if (plan === "pro" || (!plan.includes("founder") && plan.includes("pro"))) return 25;
  return 5;
}

function normalizeStatus(value) {
  const status = clean(value).toLowerCase();
  if (["sold", "deleted", "inactive", "failed", "stale"].includes(status)) return status;
  if (["posted", "active", "live"].includes(status)) return "active";
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

function normalizeLifecycleStatus(value, reviewBucket = "") {
  const status = clean(value).toLowerCase();
  const review = normalizeReviewBucket(reviewBucket);
  if (status) return status;
  if (review === "removedvehicles") return "review_delete";
  if (review === "pricechanges") return "review_price_update";
  if (review === "newvehicles") return "review_new";
  return "active";
}

function listingIdentityKey(row) {
  const marketplace = clean(row.marketplace_listing_id || "").toUpperCase();
  if (marketplace) return `MARKETPLACE:${marketplace}`;

  const vin = clean(row.vin || "").toUpperCase();
  if (vin) return `VIN:${vin}`;

  const stock = clean(row.stock_number || "").toUpperCase();
  if (stock) return `STOCK:${stock}`;

  const source = clean(row.source_url || "").toLowerCase();
  if (source) return `URL:${source}`;

  const id = clean(row.id || "");
  if (id) return `ID:${id}`;

  return [
    clean(row.year || "").toUpperCase(),
    clean(row.make || "").toUpperCase(),
    clean(row.model || "").toUpperCase(),
    String(row.price || "").replace(/[^\d]/g, ""),
    String(row.mileage || row.kilometers || row.km || "").replace(/[^\d]/g, "")
  ].filter(Boolean).join("|");
}

function normalizeListingRow(row = {}, source = "user_listings") {
  const normalizedStatus = normalizeStatus(row.status);
  const normalizedReviewBucket = normalizeReviewBucket(row.review_bucket);
  const normalizedLifecycleStatus = normalizeLifecycleStatus(row.lifecycle_status, normalizedReviewBucket);

  return {
    ...row,
    id: clean(row.id || ""),
    source_table: source,
    status: normalizedStatus,
    lifecycle_status: normalizedLifecycleStatus,
    review_bucket: normalizedReviewBucket,
    identity_key: listingIdentityKey(row),
    title: clean(row.title || ""),
    posted_at: row.posted_at || row.created_at || null,
    updated_at: row.updated_at || row.created_at || null,
    views_count: safeNumber(row.views_count, 0),
    messages_count: safeNumber(row.messages_count, 0),
    price: safeNumber(row.price, 0),
    mileage: safeNumber(row.mileage || row.kilometers || row.km, 0)
  };
}

function preferListingRow(current, incoming) {
  if (!current) return incoming;

  const currentTs = new Date(current.updated_at || current.posted_at || current.created_at || 0).getTime();
  const incomingTs = new Date(incoming.updated_at || incoming.posted_at || incoming.created_at || 0).getTime();

  const currentScore =
    (current.source_table === "user_listings" ? 1000 : 0) +
    (clean(current.image_url) ? 120 : 0) +
    (clean(current.marketplace_listing_id) ? 60 : 0) +
    (clean(current.vin) ? 40 : 0) +
    (clean(current.stock_number) ? 30 : 0) +
    (clean(current.lifecycle_status) ? 20 : 0) +
    (clean(current.review_bucket) ? 20 : 0) +
    currentTs / 1000000000000;

  const incomingScore =
    (incoming.source_table === "user_listings" ? 1000 : 0) +
    (clean(incoming.image_url) ? 120 : 0) +
    (clean(incoming.marketplace_listing_id) ? 60 : 0) +
    (clean(incoming.vin) ? 40 : 0) +
    (clean(incoming.stock_number) ? 30 : 0) +
    (clean(incoming.lifecycle_status) ? 20 : 0) +
    (clean(incoming.review_bucket) ? 20 : 0) +
    incomingTs / 1000000000000;

  return incomingScore >= currentScore ? { ...current, ...incoming } : { ...incoming, ...current };
}

function mergeListingRows(userListingRows, legacyListingRows) {
  const map = new Map();

  for (const row of userListingRows) {
    const normalized = normalizeListingRow(row, "user_listings");
    map.set(normalized.identity_key, preferListingRow(map.get(normalized.identity_key), normalized));
  }

  for (const row of legacyListingRows) {
    const normalized = normalizeListingRow(row, "listings");
    map.set(normalized.identity_key, preferListingRow(map.get(normalized.identity_key), normalized));
  }

  return [...map.values()].sort((a, b) => {
    return new Date(b.posted_at || b.updated_at || 0).getTime() - new Date(a.posted_at || a.updated_at || 0).getTime();
  });
}

function buildComputedSummary(rows) {
  const todayStart = new Date(dayStartIso()).getTime();
  const monthStart = new Date(monthStartIso()).getTime();

  let postsToday = 0;
  let postsThisMonth = 0;
  let activeListings = 0;
  let totalViews = 0;
  let totalMessages = 0;
  let staleListings = 0;
  let reviewDeleteCount = 0;
  let reviewPriceChangeCount = 0;
  let reviewNewCount = 0;

  for (const row of rows) {
    const postedTime = new Date(row.posted_at || row.created_at || 0).getTime();
    const status = normalizeStatus(row.status);
    const lifecycleStatus = normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket);
    const reviewBucket = normalizeReviewBucket(row.review_bucket);

    if (postedTime >= todayStart) postsToday += 1;
    if (postedTime >= monthStart) postsThisMonth += 1;
    if (!["sold", "deleted", "inactive"].includes(status)) activeListings += 1;

    totalViews += safeNumber(row.views_count, 0);
    totalMessages += safeNumber(row.messages_count, 0);

    if (status === "stale" || lifecycleStatus === "stale") staleListings += 1;
    if (lifecycleStatus === "review_delete" || reviewBucket === "removedvehicles") reviewDeleteCount += 1;
    if (lifecycleStatus === "review_price_update" || reviewBucket === "pricechanges") reviewPriceChangeCount += 1;
    if (lifecycleStatus === "review_new" || reviewBucket === "newvehicles") reviewNewCount += 1;
  }

  const topListing = [...rows].sort((a, b) => {
    const scoreA =
      safeNumber(a.messages_count, 0) * 1000 +
      safeNumber(a.views_count, 0) * 10 +
      new Date(a.posted_at || a.created_at || 0).getTime() / 100000000;

    const scoreB =
      safeNumber(b.messages_count, 0) * 1000 +
      safeNumber(b.views_count, 0) * 10 +
      new Date(b.posted_at || b.created_at || 0).getTime() / 100000000;

    return scoreB - scoreA;
  })[0] || null;

  return {
    posts_today: postsToday,
    posts_this_month: postsThisMonth,
    active_listings: activeListings,
    stale_listings: staleListings,
    total_views: totalViews,
    total_messages: totalMessages,
    review_delete_count: reviewDeleteCount,
    review_price_change_count: reviewPriceChangeCount,
    review_new_count: reviewNewCount,
    review_queue_count: reviewDeleteCount + reviewPriceChangeCount + reviewNewCount,
    top_listing_title: topListing?.title || "None yet",
    total_listings: rows.length
  };
}

async function resolveUser({ userId, email }) {
  if (userId) {
    const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (email) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function getSubscription(finalUserId, finalEmail) {
  if (finalUserId) {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", finalUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (finalEmail) {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .ilike("email", finalEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function getPostingLimitRow(planType) {
  const normalizedPlan = normalizePlan(planType);
  if (!normalizedPlan) return null;

  const { data: allRows, error } = await supabase.from("posting_limits").select("*");
  if (error) throw error;

  const rows = (Array.isArray(allRows) ? allRows : []).filter((row) => clean(row?.plan_type) && !clean(row?.email) && !clean(row?.user_id));
  return (
    rows.find((row) => normalizePlan(row.plan_type) === normalizedPlan) ||
    rows.find((row) => normalizedPlan.includes(normalizePlan(row.plan_type))) ||
    rows.find((row) => normalizePlan(row.plan_type).includes(normalizedPlan)) ||
    null
  );
}

async function getPostingUsageRow(finalUserId, finalEmail) {
  const todayKey = dayKeyNow();

  if (finalUserId) {
    const { data, error } = await supabase
      .from("posting_usage")
      .select("*")
      .eq("user_id", finalUserId)
      .eq("date_key", todayKey)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (finalEmail) {
    const { data, error } = await supabase
      .from("posting_usage")
      .select("*")
      .ilike("email", finalEmail)
      .eq("date_key", todayKey)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (finalUserId) {
    const { data, error } = await supabase
      .from("posting_usage")
      .select("*")
      .eq("user_id", finalUserId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function getProfileRow(finalUserId, finalEmail) {
  if (finalUserId) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", finalUserId).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (finalEmail) {
    const { data, error } = await supabase.from("profiles").select("*").ilike("email", finalEmail).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function getTableListingRows(tableName, finalUserId, finalEmail) {
  let query = supabase.from(tableName).select("*").order("posted_at", { ascending: false });

  if (finalUserId) query = query.eq("user_id", finalUserId);
  else if (finalEmail) query = query.ilike("email", finalEmail);

  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function getListingRows(finalUserId, finalEmail) {
  const [userListingRows, legacyListingRows] = await Promise.all([
    getTableListingRows("user_listings", finalUserId, finalEmail),
    getTableListingRows("listings", finalUserId, finalEmail)
  ]);

  return mergeListingRows(userListingRows, legacyListingRows);
}

function buildSetupStatus(user, profileRow) {
  const inventoryUrl = clean(profileRow?.inventory_url || "");
  const salespersonName = clean(profileRow?.full_name || profileRow?.salesperson_name || `${clean(user?.first_name)} ${clean(user?.last_name)}`.trim());
  const dealershipName = clean(profileRow?.dealership || profileRow?.dealer_name || user?.company || "");
  const complianceMode = clean(profileRow?.compliance_mode || "");

  const checks = {
    inventory_url_present: Boolean(inventoryUrl),
    salesperson_name_present: Boolean(salespersonName),
    dealership_name_present: Boolean(dealershipName),
    compliance_mode_present: Boolean(complianceMode)
  };

  const completionCount = Object.values(checks).filter(Boolean).length;
  return {
    profile_complete: completionCount === 4,
    profile_completion_score: completionCount / 4,
    inventory_url: inventoryUrl,
    salesperson_name: salespersonName,
    dealership_name: dealershipName,
    compliance_mode: complianceMode,
    ...checks
  };
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userId = clean(req.query?.userId || req.query?.user_id || "");
    const email = normalizeEmail(req.query?.email || "");

    const user = await resolveUser({ userId, email });
    const finalUserId = clean(user?.id || userId || "");
    const finalEmail = normalizeEmail(user?.email || email || "");

    if (!finalUserId && !finalEmail) {
      return res.status(400).json({ error: "Missing userId or email" });
    }

    const [subscriptionRow, postingUsageRow, profileRow, rows] = await Promise.all([
      getSubscription(finalUserId, finalEmail),
      getPostingUsageRow(finalUserId, finalEmail),
      getProfileRow(finalUserId, finalEmail),
      getListingRows(finalUserId, finalEmail)
    ]);

    const planValue = clean(
      subscriptionRow?.plan_type ||
      subscriptionRow?.plan_name ||
      subscriptionRow?.plan ||
      user?.plan ||
      user?.user_type ||
      ""
    );

    const postingLimitRow = await getPostingLimitRow(planValue);
    const computed = buildComputedSummary(rows);

    const snapshot =
      subscriptionRow?.account_snapshot && typeof subscriptionRow.account_snapshot === "object"
        ? subscriptionRow.account_snapshot
        : {};

    const effectivePlan = planValue || "No Plan Yet";
    const effectiveStatus = clean(
      subscriptionRow?.subscription_status ||
      subscriptionRow?.billing_status ||
      subscriptionRow?.status ||
      user?.subscription_status ||
      user?.status ||
      "inactive"
    ).toLowerCase();

    const dailyLimit = safeNumber(
      postingLimitRow?.daily_limit ??
      postingLimitRow?.posting_limit ??
      snapshot.posting_limit ??
      subscriptionRow?.daily_posting_limit ??
      subscriptionRow?.posting_limit ??
      inferPostingLimitFromPlan(effectivePlan),
      inferPostingLimitFromPlan(effectivePlan)
    );

    const usageToday = safeNumber(
      postingUsageRow?.posts_today ??
      postingUsageRow?.posts_used ??
      postingUsageRow?.used_today ??
      snapshot.posts_today ??
      snapshot.posts_used_today ??
      computed.posts_today,
      computed.posts_today
    );

    const postsRemaining = Math.max(safeNumber(snapshot.posts_remaining, dailyLimit - usageToday), 0);
    const setupStatus = buildSetupStatus(user, profileRow);

    const recentListings = rows.slice(0, 5).map((row) => ({
      id: row.id,
      title: row.title,
      image_url: row.image_url || "",
      price: safeNumber(row.price, 0),
      mileage: safeNumber(row.mileage, 0),
      status: row.status || "active",
      lifecycle_status: row.lifecycle_status || "",
      posted_at: row.posted_at || row.created_at,
      views_count: safeNumber(row.views_count, 0),
      messages_count: safeNumber(row.messages_count, 0),
      review_bucket: row.review_bucket || ""
    }));

    return res.status(200).json({
      success: true,
      data: {
        posts_today: usageToday,
        posts_this_month: computed.posts_this_month,
        active_listings: computed.active_listings,
        stale_listings: computed.stale_listings,
        total_views: computed.total_views,
        total_messages: computed.total_messages,
        review_delete_count: computed.review_delete_count,
        review_price_change_count: computed.review_price_change_count,
        review_new_count: computed.review_new_count,
        review_queue_count: computed.review_queue_count,
        queue_count: safeNumber(snapshot.queue_count, 0),
        lifecycle_updated_at: clean(snapshot.lifecycle_updated_at || ""),
        top_listing_title: clean(computed.top_listing_title || "None yet"),
        total_listings: computed.total_listings,
        recent_listings: recentListings,
        ingest_debug: {
          posting_usage_row_found: Boolean(postingUsageRow),
          posting_usage_updated_at: clean(postingUsageRow?.updated_at || postingUsageRow?.created_at || ""),
          listing_rows_found: rows.length,
          subscription_snapshot_posts_today: safeNumber(snapshot.posts_today ?? snapshot.posts_used_today, 0),
          usage_today_row: safeNumber(postingUsageRow?.posts_today ?? postingUsageRow?.posts_used ?? postingUsageRow?.used_today, 0)
        },
        account_snapshot: {
          ...(snapshot || {}),
          user_id: finalUserId,
          email: finalEmail,
          plan: effectivePlan,
          status: effectiveStatus,
          active: isActiveStatus(effectiveStatus),
          stripe_customer_id: clean(subscriptionRow?.stripe_customer_id || user?.stripe_customer_id || ""),
          stripe_subscription_id: clean(subscriptionRow?.stripe_subscription_id || user?.stripe_subscription_id || ""),
          posting_limit: dailyLimit,
          posts_used_today: usageToday,
          posts_today: usageToday,
          posts_remaining: postsRemaining,
          current_period_end: subscriptionRow?.current_period_end || null,
          trial_end: subscriptionRow?.trial_end || null,
          cancel_at_period_end: Boolean(subscriptionRow?.cancel_at_period_end)
        },
        setup_status: setupStatus,
        data_integrity: {
          listing_rows_merged: rows.length,
          listing_sources: rows.reduce((acc, row) => {
            const key = clean(row.source_table || "unknown");
            acc[key] = safeNumber(acc[key], 0) + 1;
            return acc;
          }, {}),
          posting_usage_source: postingUsageRow ? "posting_usage" : "computed_from_listings",
          summary_source: "merged_listings_plus_posting_usage"
        }
      }
    });
  } catch (error) {
    console.error("get-dashboard-summary fatal error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}
