import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function integerOrZero(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.json(body);
}

function normalizePlan(planValue) {
  return lower(planValue);
}

function inferPostingLimit(planValue) {
  const plan = normalizePlan(planValue);
  if (!plan) return 5;
  if (plan.includes("founder")) return 25;
  if (plan.includes("beta")) return 25;
  if (plan.includes("pro")) return 25;
  return 5;
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

function nowIso() {
  return new Date().toISOString();
}

function dayKey() {
  return nowIso().slice(0, 10);
}

function monthKey() {
  return nowIso().slice(0, 7);
}

async function resolveUserId(supabase, userId, email) {
  const cleanedUserId = clean(userId);
  const cleanedEmail = lower(email);

  if (cleanedUserId) {
    const { data, error } = await supabase.from("users").select("id,email").eq("id", cleanedUserId).maybeSingle();
    if (error) throw error;
    if (data?.id) {
      return { user_id: data.id, email: lower(data.email || cleanedEmail) };
    }
  }

  if (cleanedEmail) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email")
      .ilike("email", cleanedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) {
      return { user_id: data.id, email: lower(data.email || cleanedEmail) };
    }
  }

  return { user_id: cleanedUserId, email: cleanedEmail };
}

function buildIdentityCandidates(row) {
  const candidates = [];
  const id = clean(row.id || "");
  const marketplace = clean(row.marketplace_listing_id || "");
  const vin = clean(row.vin || "");
  const stock = clean(row.stock_number || "");
  const source = clean(row.source_url || "");

  if (id) candidates.push({ column: "id", value: id });
  if (marketplace) candidates.push({ column: "marketplace_listing_id", value: marketplace });
  if (vin) candidates.push({ column: "vin", value: vin });
  if (stock) candidates.push({ column: "stock_number", value: stock });
  if (source) candidates.push({ column: "source_url", value: source });

  return candidates;
}

function buildListingId(row) {
  return (
    clean(row.id) ||
    clean(row.marketplace_listing_id) ||
    clean(row.vin) ||
    clean(row.stock_number) ||
    clean(row.source_url) ||
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

function buildListingRow(row, resolved, existing = null) {
  const reviewBucket = normalizeReviewBucket(row.review_bucket || existing?.review_bucket || "");
  const lifecycleStatus = normalizeLifecycleStatus(row.lifecycle_status || existing?.lifecycle_status || "", reviewBucket);

  return {
    id: clean(existing?.id || row.id || buildListingId(row)),
    user_id: clean(resolved.user_id),
    email: lower(row.email || existing?.email || resolved.email),
    dealership_id: clean(row.dealership_id || existing?.dealership_id),
    marketplace_listing_id: clean(row.marketplace_listing_id || existing?.marketplace_listing_id),
    vin: clean(row.vin || existing?.vin),
    stock_number: clean(row.stock_number || existing?.stock_number),
    source_url: clean(row.source_url || existing?.source_url),
    image_url: clean(row.image_url || existing?.image_url),
    year: integerOrZero(row.year || existing?.year),
    make: clean(row.make || existing?.make),
    model: clean(row.model || existing?.model),
    trim: clean(row.trim || existing?.trim),
    vehicle_type: clean(row.vehicle_type || existing?.vehicle_type),
    body_style: clean(row.body_style || existing?.body_style),
    exterior_color: clean(row.exterior_color || existing?.exterior_color),
    fuel_type: clean(row.fuel_type || existing?.fuel_type),
    mileage: integerOrZero(row.mileage || existing?.mileage),
    price: numberOrZero(row.price || existing?.price),
    title: clean(row.title || existing?.title) || [row.year || existing?.year, row.make || existing?.make, row.model || existing?.model, row.trim || existing?.trim].map(clean).filter(Boolean).join(" "),
    location: clean(row.location || existing?.location),
    status: clean(row.status || existing?.status || "active") || "active",
    lifecycle_status: lifecycleStatus,
    review_bucket: reviewBucket,
    views_count: integerOrZero(row.views_count ?? existing?.views_count),
    messages_count: integerOrZero(row.messages_count ?? existing?.messages_count),
    posted_at: clean(row.posted_at || existing?.posted_at) || nowIso(),
    updated_at: nowIso(),
    last_seen_at: nowIso()
  };
}

async function findExistingListing(supabase, resolved, row) {
  const candidates = buildIdentityCandidates(row);

  for (const candidate of candidates) {
    let query = supabase.from("user_listings").select("*").eq(candidate.column, candidate.value).limit(1);
    if (clean(resolved.user_id)) query = query.eq("user_id", clean(resolved.user_id));
    else if (lower(resolved.email)) query = query.ilike("email", lower(resolved.email));

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function upsertPostingUsageFromPayload(supabase, resolved, payload) {
  if (!clean(resolved.user_id) && !lower(resolved.email)) return;

  const postsToday = integerOrZero(payload.posts_today || payload.posts_used_today);
  if (postsToday <= 0) return;

  const today = dayKey();
  const month = monthKey();

  let existing = null;
  if (clean(resolved.user_id)) {
    const { data, error } = await supabase.from("posting_usage").select("*").eq("user_id", clean(resolved.user_id)).eq("date_key", today).maybeSingle();
    if (error) throw error;
    existing = data || null;
  }

  const usageRow = {
    user_id: clean(resolved.user_id) || null,
    email: lower(resolved.email) || null,
    date_key: today,
    month_key: month,
    posts_used: postsToday,
    updated_at: nowIso()
  };

  if (existing?.id) {
    const { error } = await supabase.from("posting_usage").update(usageRow).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("posting_usage").insert(usageRow);
    if (error) throw error;
  }
}

async function syncSubscriptionSnapshot(supabase, resolved, payload) {
  if (!clean(resolved.user_id)) return;

  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", clean(resolved.user_id))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!subscription) return;

  const postingLimit = inferPostingLimit(subscription.plan_type || subscription.plan_name || subscription.plan);
  const postsUsedToday = integerOrZero(payload.posts_today || payload.posts_used_today);
  const nextSnapshot = {
    ...(subscription.account_snapshot && typeof subscription.account_snapshot === "object" ? subscription.account_snapshot : {}),
    user_id: clean(resolved.user_id),
    email: lower(resolved.email),
    plan: clean(subscription.plan_type || subscription.plan_name || subscription.plan),
    status: clean(subscription.subscription_status || subscription.billing_status || "active"),
    active: true,
    posting_limit: postingLimit,
    posts_used_today: postsUsedToday,
    posts_today: postsUsedToday,
    posts_remaining: Math.max(postingLimit - postsUsedToday, 0),
    active_listings: integerOrZero(payload.active_listings),
    stale_listings: integerOrZero(payload.stale_listings),
    total_views: integerOrZero(payload.total_views),
    total_messages: integerOrZero(payload.total_messages),
    review_delete_count: integerOrZero(payload.review_delete_count),
    review_price_change_count: integerOrZero(payload.review_price_change_count),
    review_new_count: integerOrZero(payload.review_new_count),
    review_queue_count: integerOrZero(payload.review_queue_count),
    queue_count: integerOrZero(payload.queue_count),
    lifecycle_updated_at: clean(payload.lifecycle_updated_at || nowIso()),
    top_listing_title: clean(payload.top_listing_title)
  };

  const { error: updateError } = await supabase.from("subscriptions").update({ account_snapshot: nextSnapshot }).eq("user_id", clean(resolved.user_id));
  if (updateError) throw updateError;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(res, 500, { ok: false, error: "Missing Supabase env" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const resolved = await resolveUserId(supabase, payload.user_id, payload.email);
    if (!clean(resolved.user_id) && !lower(resolved.email)) {
      return json(res, 400, { ok: false, error: "Missing user identity" });
    }

    const listingRows = Array.isArray(payload.listings) ? payload.listings : [];
    let synced = 0;

    for (const rawRow of listingRows) {
      const existing = await findExistingListing(supabase, resolved, rawRow);
      const row = buildListingRow(rawRow, resolved, existing);

      const { error: userListingsError } = await supabase.from("user_listings").upsert(row, { onConflict: "id" });
      if (userListingsError) throw userListingsError;

      try {
        await supabase.from("listings").upsert(row, { onConflict: "id" });
      } catch (legacyMirrorError) {
        console.warn("sync-lifecycle legacy mirror warning:", legacyMirrorError);
      }

      synced += 1;
    }

    const shouldSyncPostingUsage = payload?.authoritative_posting_usage === true || (!payload?.partial_sync && payload?.sync_reason !== "post_commit");
    if (shouldSyncPostingUsage) {
      await upsertPostingUsageFromPayload(supabase, resolved, payload);
      await syncSubscriptionSnapshot(supabase, resolved, payload);
    }

    return json(res, 200, {
      ok: true,
      user_id: resolved.user_id,
      email: resolved.email,
      synced_listings: synced,
      posting_usage_synced: shouldSyncPostingUsage
    });
  } catch (error) {
    console.error("sync-lifecycle fatal:", error);
    return json(res, 500, {
      ok: false,
      error: error?.message || "Unexpected sync-lifecycle error"
    });
  }
}
