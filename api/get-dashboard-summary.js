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

async function resolveUser({ userId, email }) {
  if (userId) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email,plan,subscription_status,stripe_customer_id,stripe_subscription_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (email) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email,plan,subscription_status,stripe_customer_id,stripe_subscription_id")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
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
  return ["active", "trialing", "paid", "founder", "beta", "checkout_pending"].includes(status);
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
    const status = clean(row.status || "posted").toLowerCase();
    const lifecycleStatus = clean(row.lifecycle_status || "").toLowerCase();
    const reviewBucket = clean(row.review_bucket || "").toLowerCase();

    if (postedTime >= todayStart) postsToday += 1;
    if (postedTime >= monthStart) postsThisMonth += 1;

    if (!["sold", "deleted", "inactive"].includes(status)) activeListings += 1;

    totalViews += safeNumber(row.views_count, 0);
    totalMessages += safeNumber(row.messages_count, 0);

    if (lifecycleStatus === "stale") staleListings += 1;
    if (lifecycleStatus === "review_delete" || reviewBucket === "removedvehicles") reviewDeleteCount += 1;
    if (lifecycleStatus === "review_price_update" || reviewBucket === "pricechanges") reviewPriceChangeCount += 1;
    if (lifecycleStatus === "review_new" || reviewBucket === "newvehicles") reviewNewCount += 1;
  }

  const topListing = [...rows]
    .sort((a, b) => {
      const scoreA =
        (safeNumber(a.messages_count, 0) * 1000) +
        (safeNumber(a.views_count, 0) * 10) +
        (new Date(a.posted_at || 0).getTime() / 100000000);

      const scoreB =
        (safeNumber(b.messages_count, 0) * 1000) +
        (safeNumber(b.views_count, 0) * 10) +
        (new Date(b.posted_at || 0).getTime() / 100000000);

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

    let listingQuery = supabase.from("user_listings").select("*");
    if (finalUserId) {
      listingQuery = listingQuery.eq("user_id", finalUserId);
    } else {
      listingQuery = listingQuery.eq("email", finalEmail);
    }

    const [
      listingsResult,
      subscriptionResult,
      postingLimitResult,
      postingUsageResult,
      profileResult
    ] = await Promise.all([
      listingQuery.order("posted_at", { ascending: false }),
      supabase.from("subscriptions").select("*").eq("email", finalEmail).maybeSingle(),
      supabase.from("posting_limits").select("*").eq("email", finalEmail).maybeSingle(),
      supabase.from("posting_usage").select("*").eq("email", finalEmail).maybeSingle(),
      supabase.from("profiles").select("*").eq("id", finalUserId).maybeSingle()
    ]);

    if (listingsResult.error) {
      console.error("get-dashboard-summary listings error:", listingsResult.error);
      return res.status(500).json({ error: listingsResult.error.message });
    }

    const rows = Array.isArray(listingsResult.data) ? listingsResult.data : [];
    const subscriptionRow = subscriptionResult.data || null;
    const postingLimitRow = postingLimitResult.data || null;
    const postingUsageRow = postingUsageResult.data || null;
    const profileRow = profileResult.data || null;

    const computed = buildComputedSummary(rows);
    const snapshot = subscriptionRow?.account_snapshot && typeof subscriptionRow.account_snapshot === "object"
      ? subscriptionRow.account_snapshot
      : {};

    const effectivePlan = clean(
      subscriptionRow?.plan_name ||
      subscriptionRow?.plan ||
      user?.plan ||
      ""
    ) || "No Plan Yet";

    const effectiveStatus = clean(
      subscriptionRow?.status ||
      subscriptionRow?.subscription_status ||
      user?.subscription_status ||
      "inactive"
    ).toLowerCase();

    const dailyLimit = safeNumber(
      snapshot.posting_limit ??
      postingLimitRow?.daily_limit ??
      subscriptionRow?.daily_posting_limit,
      0
    );

    const usageToday = safeNumber(
      snapshot.posts_today ??
      postingUsageRow?.posts_today ??
      postingUsageRow?.used_today,
      computed.posts_today
    );

    const postsRemaining = Math.max(
      safeNumber(snapshot.posts_remaining, dailyLimit - usageToday),
      0
    );

    const inventoryUrl = clean(profileRow?.inventory_url || "");
    const salespersonName = clean(profileRow?.full_name || profileRow?.salesperson_name || "");
    const dealershipName = clean(profileRow?.dealership || profileRow?.dealer_name || "");
    const province = clean(profileRow?.province || profileRow?.compliance_mode || "");

    const recentListings = rows.slice(0, 5).map((row) => ({
      id: row.id,
      title: row.title,
      image_url: row.image_url || "",
      price: safeNumber(row.price, 0),
      mileage: safeNumber(row.mileage, 0),
      status: row.status || "posted",
      lifecycle_status: row.lifecycle_status || "",
      posted_at: row.posted_at || row.created_at,
      views_count: safeNumber(row.views_count, 0),
      messages_count: safeNumber(row.messages_count, 0)
    }));

    return res.status(200).json({
      success: true,
      data: {
        posts_today: safeNumber(snapshot.posts_today, computed.posts_today),
        posts_this_month: safeNumber(snapshot.posts_this_month, computed.posts_this_month),
        active_listings: safeNumber(snapshot.active_listings, computed.active_listings),
        stale_listings: safeNumber(snapshot.stale_listings, computed.stale_listings),
        total_views: safeNumber(snapshot.total_views, computed.total_views),
        total_messages: safeNumber(snapshot.total_messages, computed.total_messages),
        review_delete_count: safeNumber(snapshot.review_delete_count, computed.review_delete_count),
        review_price_change_count: safeNumber(snapshot.review_price_change_count, computed.review_price_change_count),
        review_new_count: safeNumber(snapshot.review_new_count, computed.review_new_count),
        review_queue_count: safeNumber(snapshot.review_queue_count, computed.review_queue_count),
        queue_count: safeNumber(snapshot.queue_count, 0),
        lifecycle_updated_at: clean(snapshot.lifecycle_updated_at || ""),
        top_listing_title: clean(snapshot.top_listing_title || computed.top_listing_title || "None yet"),
        total_listings: computed.total_listings,
        recent_listings: recentListings,
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
        setup_status: {
          profile_complete: Boolean(salespersonName && inventoryUrl),
          inventory_url_present: Boolean(inventoryUrl),
          salesperson_name_present: Boolean(salespersonName),
          dealership_name_present: Boolean(dealershipName),
          compliance_mode_present: Boolean(province),
          inventory_url: inventoryUrl,
          salesperson_name: salespersonName,
          dealership_name: dealershipName,
          compliance_mode: province
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
