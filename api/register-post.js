
import { createClient } from "@supabase/supabase-js";
import { normalizePlanLabel, inferPostingLimitFromPlan, normalizeStatusValue, hasTestingLimitOverride } from "./_shared/account-access.js";
import { getVerifiedRequestUser } from "./_shared/auth.js";
import { awardPostCredits } from "./_shared/credits.js";

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

const BUSINESS_TIMEZONE = "America/Edmonton";

function zonedDateParts(value = new Date(), timeZone = BUSINESS_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: map.year || "0000", month: map.month || "00", day: map.day || "00" };
}

function dayKey() {
  const { year, month, day } = zonedDateParts();
  return `${year}-${month}-${day}`;
}

function monthKey() {
  const { year, month } = zonedDateParts();
  return `${year}-${month}`;
}

const TEST_LIMIT_25_EMAILS = new Set(['damian044@icloud.com']);


function normalizePlan(planValue) {
  return normalizePlanLabel(planValue).toLowerCase();
}

function formatPlanLabel(planValue) {
  return normalizePlanLabel(planValue);
}

function inferPostingLimit(planValue) {
  return inferPostingLimitFromPlan(planValue);
}

function normalizeStatus(status, fallback = "inactive") {
  return normalizeStatusValue(status, fallback);
}

function statusIsActive(status) {
  return normalizeStatusValue(status) === "active";
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

function buildListingRow(payload, resolved, existing = null) {
  const timestamp = nowIso();
  const listingId = buildListingId(payload);

  return {
    id: clean(existing?.id || listingId),
    user_id: clean(resolved.user_id),
    email: lower(resolved.email || payload.email),
    dealership_id: clean(payload.dealership_id),
    marketplace_listing_id: clean(payload.marketplace_listing_id || existing?.marketplace_listing_id),
    vin: clean(payload.vin || existing?.vin),
    stock_number: clean(payload.stock_number || payload.stock || existing?.stock_number),
    source_url: normalizeListingUrl(payload.source_url || existing?.source_url),
    image_url: clean(payload.image_url || existing?.image_url),
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
    updated_at: timestamp,
    last_seen_at: timestamp,
    views_count: integerOrZero(payload.views_count ?? payload.views ?? 0),
    messages_count: integerOrZero(payload.messages_count ?? payload.messages ?? 0)
  };
}

function normalizeListingUrl(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    ["fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "tracking", "tracking_id"].forEach((key) => url.searchParams.delete(key));
    return `${url.origin}${url.pathname.replace(/\/$/, "")}${url.search ? `?${url.searchParams.toString()}` : ""}`.toLowerCase();
  } catch {
    return raw.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
  }
}
async function findExistingListing(supabase, resolved, listingRow, payload = {}) {
  const listingId = clean(listingRow?.id || payload.id || "");
  if (listingId) {
    const { data, error } = await supabase.from("user_listings").select("*").eq("id", listingId).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  const normalizedEmail = lower(resolved.email);
  const identityCandidates = [
    { column: "marketplace_listing_id", value: clean(payload.marketplace_listing_id || payload.listing_id || "") },
    { column: "vin", value: clean(payload.vin || "") },
    { column: "stock_number", value: clean(payload.stock_number || payload.stock || "") },
    { column: "source_url", value: normalizeListingUrl(payload.source_url || "") }
  ].filter((entry) => clean(entry.value));

  for (const candidate of identityCandidates) {
    let query = supabase.from("user_listings").select("*").eq(candidate.column, candidate.value).order("updated_at", { ascending: false }).limit(5);
    const { data, error } = await query;
    if (error) throw error;
    if (Array.isArray(data) && data.length) {
      if (normalizedEmail) {
        const emailMatch = data.find((row) => lower(row.email || "") === normalizedEmail);
        if (emailMatch) return emailMatch;
      }
      if (clean(resolved.user_id)) {
        const userMatch = data.find((row) => clean(row.user_id || "") === clean(resolved.user_id));
        if (userMatch) return userMatch;
      }
      return data[0];
    }
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

function isDuplicateRegister(existingRow, incomingRow) {
  if (!existingRow || !incomingRow) return false;
  if (!isSamePostingWindow(existingRow, incomingRow)) return false;

  const sameMarketplaceId = clean(existingRow.marketplace_listing_id || "") && clean(existingRow.marketplace_listing_id || "") === clean(incomingRow.marketplace_listing_id || "");
  const sameVin = clean(existingRow.vin || "") && clean(existingRow.vin || "") === clean(incomingRow.vin || "");
  const sameStock = clean(existingRow.stock_number || "") && clean(existingRow.stock_number || "") === clean(incomingRow.stock_number || "");
  const sameUrl = normalizeListingUrl(existingRow.source_url || "") && normalizeListingUrl(existingRow.source_url || "") === normalizeListingUrl(incomingRow.source_url || "");

  return Boolean(sameMarketplaceId || sameVin || sameStock || sameUrl);
}

async function getCurrentPostingUsage(supabase, resolved) {
  const today = dayKey();
  let existing = null;

  if (lower(resolved.email)) {
    const { data, error } = await supabase
      .from("posting_usage")
      .select("*")
      .ilike("email", lower(resolved.email))
      .eq("date_key", today)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    existing = data || null;
  }

  if (!existing && clean(resolved.user_id)) {
    const { data, error } = await supabase
      .from("posting_usage")
      .select("*")
      .eq("user_id", clean(resolved.user_id))
      .eq("date_key", today)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    existing = data || null;
  }

  return Math.max(
    integerOrZero(existing?.posts_today),
    integerOrZero(existing?.posts_used),
    integerOrZero(existing?.used_today)
  );
}

async function upsertPostingUsage(supabase, resolved) {
  if (!clean(resolved.user_id) && !lower(resolved.email)) return { ok: false, reason: "missing_identity" };

  const today = dayKey();
  const month = monthKey();

  let existing = null;

  if (lower(resolved.email)) {
    const { data, error } = await supabase
      .from("posting_usage")
      .select("*")
      .ilike("email", lower(resolved.email))
      .eq("date_key", today)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    existing = data || null;
  }

  if (!existing && clean(resolved.user_id)) {
    const { data, error } = await supabase
      .from("posting_usage")
      .select("*")
      .eq("user_id", clean(resolved.user_id))
      .eq("date_key", today)
      .maybeSingle();

    if (error) throw error;
    existing = data || null;
  }

  const nextPostsUsed = Math.max(
    integerOrZero(existing?.posts_today),
    integerOrZero(existing?.posts_used),
    integerOrZero(existing?.used_today)
  ) + 1;

  const usageRow = {
    user_id: clean(resolved.user_id) || null,
    email: lower(resolved.email) || null,
    date_key: today,
    date: today,
    month_key: month,
    posts_used: nextPostsUsed,
    posts_today: nextPostsUsed,
    used_today: nextPostsUsed,
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


async function mirrorListingToLegacyTable(supabase, listingRow) {
  const legacyRow = { ...listingRow };
  const { error } = await supabase
    .from("listings")
    .upsert(legacyRow, { onConflict: "id" });

  if (error) throw error;
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
  const postingLimit = hasTestingLimitOverride(resolved.email)
    ? 25
    : (numberOrZero(subscription.daily_posting_limit || subscription.posting_limit || subscription.account_snapshot?.posting_limit) || inferPostingLimit(normalizedPlan));
  const normalizedStatus = normalizeStatus(subscription.subscription_status || subscription.status || subscription.billing_status || subscription.account_snapshot?.status || "inactive");
  const active = Boolean(hasTestingLimitOverride(resolved.email) || subscription.active || subscription.access || subscription.account_snapshot?.active || statusIsActive(normalizedStatus));
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


async function findProfileForCompliance(supabase, resolved) {
  const userId = clean(resolved?.user_id);
  const email = lower(resolved?.email);
  const attempts = [
    () => userId ? supabase.from("profiles").select("*").eq("id", userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    () => userId ? supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    () => email ? supabase.from("profiles").select("*").ilike("email", email).order("updated_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null, error: null })
  ];
  for (const run of attempts) {
    const { data, error } = await run();
    if (!error && data) return data;
  }
  return null;
}

function evaluateCompliance(profile = {}) {
  const province = clean(profile?.province || '').toUpperCase();
  const complianceMode = clean(profile?.compliance_mode || '').toUpperCase();
  const licenseNumber = clean(profile?.license_number || '');
  const dealershipName = clean(profile?.dealership || profile?.dealer_name || profile?.company_name || '');
  const dealerOrSalesPhone = clean(profile?.dealer_phone || profile?.phone || '');
  const blockers = [
    (!province && !complianceMode) ? 'Province or compliance mode missing' : '',
    !licenseNumber ? 'License number missing' : '',
    !dealershipName ? 'Dealership name missing' : '',
    !dealerOrSalesPhone ? 'Dealer or salesperson phone missing' : ''
  ].filter(Boolean);
  return {
    ready: blockers.length === 0,
    blockers,
    province,
    compliance_mode: complianceMode || province,
    license_number: licenseNumber,
    dealership_name: dealershipName,
    dealer_contact: dealerOrSalesPhone
  };
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

    const verifiedUser = await getVerifiedRequestUser(req);
    if (!verifiedUser?.id || !verifiedUser?.email) {
      return json(res, 401, { ok: false, error: "Unauthorized" });
    }

    const payload =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const resolved = await resolveUserId(
      supabase,
      verifiedUser.id,
      verifiedUser.email
    );

    if (!clean(resolved.user_id) && !lower(resolved.email)) {
      return json(res, 400, { ok: false, error: "Missing user identity" });
    }

    const complianceProfile = await findProfileForCompliance(supabase, resolved);
    const compliance = evaluateCompliance(complianceProfile || {});
    if (!compliance.ready) {
      return json(res, 409, {
        ok: false,
        error: "Compliance not ready",
        code: "COMPLIANCE_BLOCK",
        compliance
      });
    }

    const seedListingRow = buildListingRow(payload, resolved);
    const existingListing = await findExistingListing(supabase, resolved, seedListingRow, payload);
    const listingRow = buildListingRow(payload, resolved, existingListing);
    const duplicate = isDuplicateRegister(existingListing, listingRow);

    const rowForUpsert = duplicate && existingListing
      ? {
          ...existingListing,
          ...listingRow,
          id: clean(existingListing.id || listingRow.id),
          posted_at: clean(existingListing.posted_at || listingRow.posted_at),
          updated_at: nowIso(),
          last_seen_at: nowIso(),
          views_count: Math.max(integerOrZero(existingListing.views_count), integerOrZero(listingRow.views_count)),
          messages_count: Math.max(integerOrZero(existingListing.messages_count), integerOrZero(listingRow.messages_count))
        }
      : listingRow;

    const { error: userListingsError } = await supabase
      .from("user_listings")
      .upsert(rowForUpsert, { onConflict: "id" });

    if (userListingsError) throw userListingsError;

    await mirrorListingToLegacyTable(supabase, rowForUpsert);

    let usageResult = null;
    const currentPostsUsed = await getCurrentPostingUsage(supabase, resolved);

    if (!duplicate) {
      usageResult = await upsertPostingUsage(supabase, resolved);
    }

    const effectivePostsUsedToday = duplicate ? currentPostsUsed : (usageResult?.posts_used || currentPostsUsed || 0);

    const snapshotResult = await syncSubscriptionSnapshot(
      supabase,
      resolved,
      effectivePostsUsedToday
    );

    const creditResult = await awardPostCredits(supabase, {
      userId: resolved.user_id,
      email: resolved.email,
      listingId: rowForUpsert.id,
      duplicate,
      postsUsedToday: effectivePostsUsedToday
    });

    return json(res, 200, {
      ok: true,
      duplicate,
      user_id: resolved.user_id,
      email: resolved.email,
      listing_id: rowForUpsert.id,
      posts_used_today: effectivePostsUsedToday,
      posting_usage_updated_at: nowIso(),
      posting_state: snapshotResult?.snapshot || null,
      credits: {
        awarded_total: creditResult?.awarded_total || 0,
        balance: Number(creditResult?.ledger?.balance || 0),
        lifetime_earned: Number(creditResult?.ledger?.lifetime_earned || 0),
        schema_ready: Boolean(creditResult?.schema_ready),
        events: Array.isArray(creditResult?.outcomes)
          ? creditResult.outcomes
              .filter((item) => Number(item?.amount_awarded || 0) > 0)
              .map((item) => ({
                type: item?.event?.type || '',
                amount: Number(item?.amount_awarded || 0)
              }))
          : []
      },
      compliance,
      debug: {
        duplicate,
        usage_incremented: !duplicate,
        resolved_user_id: resolved.user_id,
        resolved_email: resolved.email,
        credits_awarded: Number(creditResult?.awarded_total || 0)
      }
    });
  } catch (error) {
    console.error("register-post fatal:", error);
    return json(res, 500, {
      ok: false,
      error: error?.message || "Unexpected register-post error"
    });
  }
}
