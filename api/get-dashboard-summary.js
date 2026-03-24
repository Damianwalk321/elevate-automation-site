
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

function monthKeyNow() {
  return new Date().toISOString().slice(0, 7);
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
  return [
    "active",
    "trialing",
    "paid",
    "checkout_pending"
  ].includes(status);
}

function normalizePlan(value) {
  return clean(value).toLowerCase();
}

function inferPostingLimitFromPlan(planValue) {
  const plan = normalizePlan(planValue);

  if (!plan) return 5;
  if (plan.includes("founder")) return 25;
  if (plan.includes("beta")) return 25;
  if (plan.includes("pro")) return 25;

  return 5;
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
    if (lifecycleStatus === "review_delete" || reviewBucket === "removedvehicles") {
      reviewDeleteCount += 1;
    }
    if (lifecycleStatus === "review_price_update" || reviewBucket === "pricechanges") {
      reviewPriceChangeCount += 1;
    }
    if (lifecycleStatus === "review_new" || reviewBucket === "newvehicles") {
      reviewNewCount += 1;
    }
  }

  const topListing = [...rows]
    .sort((a, b) => {
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
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

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

  const { data: allRows, error } = await supabase
    .from("posting_limits")
    .select("*");

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

  return null;
}

async function getProfileRow(finalUserId, finalEmail) {
  if (finalUserId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", finalUserId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  if (finalEmail) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .ilike("email", finalEmail)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function getListingRows(finalUserId, finalEmail) {
  // 1) try user_listings by user_id
  if (finalUserId) {
    const { data, error } = await supabase
      .from("user_listings")
      .select("*")
      .eq("user_id", finalUserId)
      .order("posted_at", { ascending: false });

    if (error) throw error;
    if (Array.isArray(data) && data.length) return data;
  }

  // 2) fallback user_listings by email
  if (finalEmail) {
    const { data, error } = await supabase
      .from("user_listings")
      .select("*")
      .ilike("email", finalEmail)
      .order("posted_at", { ascending: false });

    if (error) throw error;
    if (Array.isArray(data) && data.length) return data;
  }

  // 3) fallback listings by user_id
  if (finalUserId) {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("user_id", finalUserId)
      .order("posted_at", { ascending: false });

    if (error) throw error;
    if (Array.isArray(data) && data.length) return data;
  }

  // 4) fallback listings by email
  if (finalEmail) {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .ilike("email", finalEmail)
      .order("posted_at", { ascending: false });

    if (error) throw error;
    if (Array.isArray(data) && data.length) return data;
  }

  return [];
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
      subscriptionRow?.account_snapshot &&
      typeof subscriptionRow.account_snapshot === "object"
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
      snapshot.posting_limit ??
        postingLimitRow?.daily_limit ??
        subscriptionRow?.daily_posting_limit ??
        inferPostingLimitFromPlan(effectivePlan),
      inferPostingLimitFromPlan(effectivePlan)
    );

    const usageToday = safeNumber(
      snapshot.posts_today ??
        postingUsageRow?.posts_used ??
        postingUsageRow?.used_today ??
        computed.posts_today,
      computed.posts_today
    );

    const postsRemaining = Math.max(
      safeNumber(snapshot.posts_remaining, dailyLimit - usageToday),
      0
    );

    const inventoryUrl = clean(profileRow?.inventory_url || "");
    const salespersonName = clean(
      profileRow?.full_name ||
      profileRow?.salesperson_name ||
      `${clean(user?.first_name)} ${clean(user?.last_name)}`.trim()
    );
    const dealershipName = clean(
      profileRow?.dealership ||
      profileRow?.dealer_name ||
      user?.company ||
      ""
    );
    const complianceMode = clean(profileRow?.compliance_mode || "");
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
        review_price_change_count: safeNumber(
          snapshot.review_price_change_count,
          computed.review_price_change_count
        ),
        review_new_count: safeNumber(snapshot.review_new_count, computed.review_new_count),
        review_queue_count: safeNumber(snapshot.review_queue_count, computed.review_queue_count),
        queue_count: safeNumber(snapshot.queue_count, 0),
        lifecycle_updated_at: clean(snapshot.lifecycle_updated_at || ""),
        top_listing_title: clean(
          snapshot.top_listing_title || computed.top_listing_title || "None yet"
        ),
        total_listings: computed.total_listings,
        recent_listings: recentListings,
        account_snapshot: {
          ...(snapshot || {}),
          user_id: finalUserId,
          email: finalEmail,
          plan: effectivePlan,
          status: effectiveStatus,
          active: isActiveStatus(effectiveStatus),
          stripe_customer_id: clean(
            subscriptionRow?.stripe_customer_id || user?.stripe_customer_id || ""
          ),
          stripe_subscription_id: clean(
            subscriptionRow?.stripe_subscription_id || user?.stripe_subscription_id || ""
          ),
          posting_limit: dailyLimit,
          posts_used_today: usageToday,
          posts_today: usageToday,
          posts_remaining: postsRemaining,
          current_period_end: subscriptionRow?.current_period_end || null,
          trial_end: subscriptionRow?.trial_end || null,
          cancel_at_period_end: Boolean(subscriptionRow?.cancel_at_period_end)
        },
        setup_status: {
          profile_complete: Boolean(
            salespersonName &&
            dealershipName &&
            complianceMode &&
            inventoryUrl
          ),
          inventory_url_present: Boolean(inventoryUrl),
          salesperson_name_present: Boolean(salespersonName),
          dealership_name_present: Boolean(dealershipName),
          compliance_mode_present: Boolean(complianceMode),
          inventory_url: inventoryUrl,
          salesperson_name: salespersonName,
          dealership_name: dealershipName,
          compliance_mode: complianceMode
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
