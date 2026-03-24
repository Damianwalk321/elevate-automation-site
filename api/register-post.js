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
  const plan = lower(planValue);
  if (!plan || plan === "no plan") return "founder beta";
  if (plan.includes("founder") && plan.includes("pro")) return "founder pro";
  if (plan.includes("founder") && plan.includes("starter")) return "founder starter";
  if (plan.includes("founder") || plan.includes("beta")) return "founder beta";
  if (plan.includes("pro")) return "pro";
  if (plan.includes("starter")) return "starter";
  return plan || "founder beta";
}

function formatPlanLabel(planValue) {
  const plan = normalizePlan(planValue);
  if (plan === "founder pro") return "Founder Pro";
  if (plan === "founder starter") return "Founder Starter";
  if (plan === "founder beta") return "Founder Beta";
  if (plan === "pro") return "Pro";
  return "Starter";
}

function inferPostingLimit(planValue) {
  const plan = normalizePlan(planValue);
  if (!plan) return 5;
  if (plan.includes("founder")) return 25;
  if (plan.includes("beta")) return 25;
  if (plan.includes("pro")) return 25;
  return 5;
}

function normalizeStatus(status, fallback = "inactive") {
  const value = lower(status);
  if (!value) return fallback;
  if (["active", "trialing", "paid", "checkout_pending"].includes(value)) return "active";
  if (["canceled", "cancelled", "unpaid", "past_due", "expired", "suspended", "inactive"].includes(value)) return "inactive";
  return value;
}

function statusIsActive(status) {
  return normalizeStatus(status) === "active";
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

function buildVehicleKey(payload = {}) {
  const vin = clean(payload.vin || "").toUpperCase();
  if (vin) return `VIN:${vin}`;

  const stock = clean(payload.stock_number || payload.stock || "").toUpperCase();
  if (stock) return `STOCK:${stock}`;

  return [
    clean(payload.year || "").toUpperCase(),
    clean(payload.make || "").toUpperCase(),
    clean(payload.model || "").toUpperCase(),
    String(payload.price || "").replace(/[^\d]/g, ""),
    String(payload.mileage || payload.kilometers || payload.km || "").replace(/[^\d]/g, "")
  ].filter(Boolean).join("|");
}

function buildListingId(payload) {
  return (
    clean(payload.marketplace_listing_id) ||
    clean(payload.vehicle_id) ||
    buildVehicleKey(payload) ||
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

async function findExistingListing(supabase, resolved, listingRow, payload = {}) {
  const listingId = clean(listingRow?.id || "");
  if (listingId) {
    const { data, error } = await supabase
      .from("user_listings")
      .select("*")
      .eq("id", listingId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  const marketplaceListingId = clean(payload.marketplace_listing_id || "");
  if (marketplaceListingId) {
    const { data, error } = await supabase
      .from("user_listings")
      .select("*")
      .eq("marketplace_listing_id", marketplaceListingId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  const vin = clean(payload.vin || "");
  if (vin && clean(resolved.user_id)) {
    const { data, error } = await supabase
      .from("user_listings")
      .select("*")
      .eq("user_id", clean(resolved.user_id))
      .eq("vin", vin)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  return null;
}

function isSamePostingWindow(existingRow, incomingRow) {
  if (!existingRow || !incomingRow) return false;

  const existingPosted = new Date(existingRow.posted_at || existingRow.updated_at || 0).getTime();
  const incomingPosted = new Date(incomingRow.posted_at || incomingRow.updated_at || 0).getTime();

  if (!existingPosted || !incomingPosted) return false;

  const sameDay =
    String(existingRow.posted_at || existingRow.updated_at || "").slice(0, 10) ===
    String(incomingRow.posted_at || incomingRow.updated_at || "").slice(0, 10);

  const withinWindow = Math.abs(incomingPosted - existingPosted) <= (1000 * 60 * 30);

  const existingStatus = lower(existingRow.status || existingRow.lifecycle_status || "");
  const incomingStatus = lower(incomingRow.status || incomingRow.lifecycle_status || "");

  return sameDay && withinWindow && existingStatus === incomingStatus;
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

  const normalizedPlan = normalizePlan(subscription.plan_type || subscription.plan_name || subscription.plan || subscription.account_snapshot?.plan);
  const formattedPlan = formatPlanLabel(normalizedPlan);
  const postingLimit = numberOrZero(subscription.daily_posting_limit || subscription.posting_limit || subscription.account_snapshot?.posting_limit) || inferPostingLimit(normalizedPlan);
  const normalizedStatus = normalizeStatus(subscription.subscription_status || subscription.status || subscription.billing_status || subscription.account_snapshot?.status || "inactive");
  const active = Boolean(subscription.active || subscription.access || subscription.account_snapshot?.active || statusIsActive(normalizedStatus));
  const postsRemaining = Math.max((active ? postingLimit : 0) - integerOrZero(postsUsedToday), 0);

  const nextSnapshot = {
    ...(subscription.account_snapshot && typeof subscription.account_snapshot === "object"
      ? subscription.account_snapshot
      : {}),
    user_id: clean(resolved.user_id),
    email: lower(resolved.email),
    plan: formattedPlan,
    normalized_plan: normalizedPlan,
    status: active ? "active" : normalizedStatus,
    normalized_status: active ? "active" : normalizedStatus,
    active,
    access_granted: active,
    posting_limit: active ? postingLimit : 0,
    posts_used_today: integerOrZero(postsUsedToday),
    posts_today: integerOrZero(postsUsedToday),
    posts_remaining: postsRemaining,
    current_period_end: subscription.current_period_end || null,
    trial_end: subscription.trial_end || null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end)
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
    const existingListing = await findExistingListing(supabase, resolved, listingRow, payload);
    const duplicate = isSamePostingWindow(existingListing, listingRow);

    const { error: userListingsError } = await supabase
      .from("user_listings")
      .upsert(listingRow, { onConflict: "id" });

    if (userListingsError) throw userListingsError;

    let usageResult = null;

    if (!duplicate) {
      usageResult = await upsertPostingUsage(supabase, resolved);
    } else {
      const today = dayKey();
      const usageLookup = clean(resolved.user_id)
        ? await supabase
            .from("posting_usage")
            .select("*")
            .eq("user_id", clean(resolved.user_id))
            .eq("date_key", today)
            .maybeSingle()
        : await supabase
            .from("posting_usage")
            .select("*")
            .ilike("email", lower(resolved.email))
            .eq("date_key", today)
            .maybeSingle();

      if (usageLookup.error) throw usageLookup.error;
      usageResult = { ok: true, posts_used: integerOrZero(usageLookup.data?.posts_used) };
    }

    const snapshotResult = await syncSubscriptionSnapshot(supabase, resolved, usageResult?.posts_used || 0);

    return json(res, 200, {
      ok: true,
      duplicate,
      user_id: resolved.user_id,
      email: resolved.email,
      listing_id: listingRow.id,
      posts_used_today: usageResult?.posts_used || 0,
      posting_state: snapshotResult?.snapshot || null
    });
  } catch (error) {
    console.error("register-post fatal:", error);
    return json(res, 500, {
      ok: false,
      error: error?.message || "Unexpected register-post error"
    });
  }
}
