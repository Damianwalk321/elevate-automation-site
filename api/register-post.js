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

function nowIso() {
  return new Date().toISOString();
}

function dayKey() {
  return nowIso().slice(0, 10);
}

function monthKey() {
  return nowIso().slice(0, 7);
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

async function resolveUserId(supabase, userId, email) {
  const cleanedUserId = clean(userId);
  const cleanedEmail = lower(email);

  if (cleanedUserId) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email,company")
      .eq("id", cleanedUserId)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) {
      return {
        user_id: data.id,
        email: lower(data.email || cleanedEmail),
        company: clean(data.company)
      };
    }
  }

  if (cleanedEmail) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email,company")
      .ilike("email", cleanedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) {
      return {
        user_id: data.id,
        email: lower(data.email || cleanedEmail),
        company: clean(data.company)
      };
    }
  }

  return {
    user_id: cleanedUserId,
    email: cleanedEmail,
    company: ""
  };
}

function buildListingId(payload) {
  return (
    clean(payload.marketplace_listing_id) ||
    clean(payload.vehicle_id) ||
    clean(payload.vin) ||
    clean(payload.stock_number) ||
    clean(payload.stock) ||
    `${Date.now()}`
  );
}

function buildTitle(payload) {
  return (
    clean(payload.title) ||
    [payload.year, payload.make, payload.model, payload.trim]
      .map(clean)
      .filter(Boolean)
      .join(" ")
  );
}

function buildListingRow(payload, resolved) {
  const timestamp = nowIso();
  const listingId = buildListingId(payload);

  return {
    id: listingId,
    user_id: clean(resolved.user_id),
    email: lower(payload.email || resolved.email),
    dealership_id: clean(payload.dealership_id),
    marketplace_listing_id: clean(payload.marketplace_listing_id),
    vin: clean(payload.vin),
    stock_number: clean(payload.stock_number || payload.stock),
    source_url: clean(payload.source_url),
    image_url: clean(payload.image_url),
    year: integerOrZero(payload.year),
    make: clean(payload.make),
    model: clean(payload.model),
    trim: clean(payload.trim),
    vehicle_type: clean(payload.vehicle_type),
    body_style: clean(payload.body_style),
    exterior_color: clean(payload.exterior_color),
    fuel_type: clean(payload.fuel_type),
    mileage: integerOrZero(payload.mileage),
    price: numberOrZero(payload.price),
    title: buildTitle(payload),
    location: clean(payload.location || payload.listing_location),
    status: clean(payload.status || "active") || "active",
    lifecycle_status: clean(payload.lifecycle_status || "active"),
    review_bucket: clean(payload.review_bucket),
    views_count: integerOrZero(payload.views_count),
    messages_count: integerOrZero(payload.messages_count),
    posted_at: clean(payload.posted_at) || timestamp,
    updated_at: timestamp
  };
}

async function upsertPostingUsage(supabase, resolved) {
  if (!clean(resolved.user_id) && !lower(resolved.email)) return { ok: false, reason: "missing_identity" };

  const today = dayKey();
  const month = monthKey();

  let existing = null;

  if (clean(resolved.user_id)) {
    const { data, error } = await supabase
      .from("posting_usage")
      .select("*")
      .eq("user_id", clean(resolved.user_id))
      .eq("date_key", today)
      .maybeSingle();

    if (error) throw error;
    existing = data || null;
  }

  if (!existing && lower(resolved.email)) {
    const { data, error } = await supabase
      .from("posting_usage")
      .select("*")
      .ilike("email", lower(resolved.email))
      .eq("date_key", today)
      .maybeSingle();

    if (error) throw error;
    existing = data || null;
  }

  const nextPostsUsed = integerOrZero(existing?.posts_used) + 1;

  const usageRow = {
    user_id: clean(resolved.user_id) || null,
    email: lower(resolved.email) || null,
    date_key: today,
    month_key: month,
    posts_used: nextPostsUsed,
    updated_at: nowIso()
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("posting_usage")
      .update(usageRow)
      .eq("id", existing.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("posting_usage")
      .insert(usageRow);

    if (error) throw error;
  }

  return { ok: true, posts_used: nextPostsUsed };
}

async function syncSubscriptionSnapshot(supabase, resolved, postsUsedToday) {
  if (!clean(resolved.user_id)) return { ok: false, reason: "missing_user_id" };

  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", clean(resolved.user_id))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subError) throw subError;
  if (!subscription) return { ok: false, reason: "no_subscription" };

  const postingLimit = inferPostingLimit(subscription.plan_type);
  const postsRemaining = Math.max(postingLimit - integerOrZero(postsUsedToday), 0);

  const nextSnapshot = {
    ...(subscription.account_snapshot && typeof subscription.account_snapshot === "object"
      ? subscription.account_snapshot
      : {}),
    user_id: clean(resolved.user_id),
    email: lower(resolved.email),
    plan: clean(subscription.plan_type),
    status: clean(subscription.subscription_status || subscription.billing_status || "active"),
    active: true,
    posting_limit: postingLimit,
    posts_used_today: integerOrZero(postsUsedToday),
    posts_today: integerOrZero(postsUsedToday),
    posts_remaining: postsRemaining
  };

  const { error } = await supabase
    .from("subscriptions")
    .update({
      account_snapshot: nextSnapshot
    })
    .eq("user_id", clean(resolved.user_id));

  if (error) throw error;

  return { ok: true, snapshot: nextSnapshot };
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

    const payload =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const resolved = await resolveUserId(
      supabase,
      payload.user_id,
      payload.email
    );

    if (!clean(resolved.user_id) && !lower(resolved.email)) {
      return json(res, 400, { ok: false, error: "Missing user identity" });
    }

    const listingRow = buildListingRow(payload, resolved);

    const { error: listingsError } = await supabase
      .from("listings")
      .upsert(listingRow, { onConflict: "id" });

    if (listingsError) throw listingsError;

    const { error: userListingsError } = await supabase
      .from("user_listings")
      .upsert(listingRow, { onConflict: "id" });

    if (userListingsError) throw userListingsError;

    const usageResult = await upsertPostingUsage(supabase, resolved);
    await syncSubscriptionSnapshot(supabase, resolved, usageResult.posts_used || 0);

    return json(res, 200, {
      ok: true,
      user_id: resolved.user_id,
      email: resolved.email,
      listing_id: listingRow.id,
      posts_used_today: usageResult.posts_used || 0
    });
  } catch (error) {
    console.error("register-post fatal:", error);
    return json(res, 500, {
      ok: false,
      error: error?.message || "Unexpected register-post error"
    });
  }
}