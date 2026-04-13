
import { createClient } from "@supabase/supabase-js";
import { resolveAccountAccess } from "./_shared/account-access.js";
import { getVerifiedRequestUser, getTrustedIdentity } from "./_shared/auth.js";
import { getCreditSummary, listRecentCreditEvents, formatCreditEventLabel, getCreditEconomyState } from "./_shared/credits.js";
import { clean, normalizeEmail, safeNumber, extractCanonicalPriceMileage } from "./_shared/listing-normalize.js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUSINESS_TIMEZONE = "America/Edmonton";
const FORCE_25_EMAILS = new Set(["damian044@icloud.com"]);

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
function inferPostingLimitFromPlan(planValue) {
  const plan = clean(planValue).toLowerCase();
  if (!plan) return 5;
  if (plan.includes("pro")) return 25;
  return 5;
}
function isActiveStatus(value) {
  const status = clean(value).toLowerCase();
  return ["active", "trialing", "paid", "checkout_pending"].includes(status);
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
function normalizeLifecycleStatus(value, reviewBucket = "") {
  const status = clean(value).toLowerCase();
  const review = normalizeReviewBucket(reviewBucket);
  if (status) return status;
  if (review === "removedvehicles") return "review_delete";
  if (review === "pricechanges") return "review_price_update";
  if (review === "newvehicles") return "review_new";
  return "active";
}
function dayKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function monthKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIMEZONE, year: "numeric", month: "2-digit" }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}`;
}
function hasTestingLimitOverride(email) {
  return FORCE_25_EMAILS.has(normalizeEmail(email));
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
  return [clean(row.year), clean(row.make), clean(row.model), String(row.price || ""), String(row.mileage || "")].filter(Boolean).join("|");
}

function buildListingIntelligence(row = {}) {
  const postedValue = row.posted_at || row.created_at || row.updated_at || null;
  const postedTs = postedValue ? new Date(postedValue).getTime() : 0;
  const ageDays = postedTs > 0 ? Math.max(0, Math.floor((Date.now() - postedTs) / 86400000)) : 0;
  const views = safeNumber(row.views_count, 0);
  const messages = safeNumber(row.messages_count, 0);
  const status = normalizeStatus(row.status);
  const lifecycle = normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket);
  const reviewBucket = normalizeReviewBucket(row.review_bucket);
  const staleLike = status === "stale" || lifecycle === "stale" || lifecycle === "review_delete" || reviewBucket === "removedvehicles";
  const likelySold = lifecycle === "review_delete" || reviewBucket === "removedvehicles";
  const activeLike = !["sold", "deleted", "inactive"].includes(status) && lifecycle !== "review_delete";
  const highViewsNoMessages = activeLike && views >= 20 && messages === 0;
  const promoteNow = activeLike && views >= 20 && messages >= 1;
  const lowPerformance = activeLike && ageDays >= 7 && views < 5 && messages === 0;
  const weak = staleLike || lowPerformance;
  const needsAction = weak || highViewsNoMessages || lifecycle === "review_price_update" || reviewBucket === "pricechanges";
  let recommendedAction = "Keep live";
  if (likelySold) recommendedAction = "Check if sold or stale";
  else if (lifecycle === "review_price_update" || reviewBucket === "pricechanges" || highViewsNoMessages) recommendedAction = "Review price";
  else if (lifecycle === "review_new" || reviewBucket === "newvehicles") recommendedAction = "Review new listing";
  else if (lowPerformance) recommendedAction = "Refresh title/photos";
  else if (promoteNow) recommendedAction = "Promote now";
  return {
    age_days: ageDays,
    likely_sold: likelySold,
    promote_now: promoteNow,
    weak,
    needs_action: needsAction,
    recommended_action: recommendedAction,
    health_label: promoteNow ? "High Performer" : needsAction ? "Needs Action" : weak ? "Weak" : "Healthy",
    predicted_score: Math.max(0, Math.min(100, 50 + Math.min(views, 25) + Math.min(messages * 18, 36) - Math.min(ageDays * 3, 24))),
    predicted_label: "Likely Performer",
    pricing_insight: highViewsNoMessages ? "Price may be limiting message conversion." : messages >= 2 ? "Pricing appears competitive." : "Pricing signal still developing.",
    content_score: 75,
    content_feedback: "Listing structure looks strong.",
    popularity_score: messages * 1000 + views * 10 + (postedTs / 100000000),
    post_priority: promoteNow ? 80 : 45,
    refresh_priority: weak ? 75 : 20,
    price_review_priority: (lifecycle === "review_price_update" || reviewBucket === "pricechanges" || highViewsNoMessages) ? 80 : 15,
    opportunity_score: Math.max(0, Math.min(100, 50 + Math.min(views, 30) + Math.min(messages * 15, 30))),
    action_bucket: (lifecycle.startsWith("review") || weak) ? "do_now" : promoteNow ? "do_today" : "watch",
    action_bucket_label: (lifecycle.startsWith("review") || weak) ? "Do Now" : promoteNow ? "Do Today" : "Watch"
  };
}
function normalizeListingRow(row = {}, source = "user_listings") {
  const canonical = extractCanonicalPriceMileage(row);
  const normalized = {
    ...row,
    id: clean(row.id || ""),
    source_table: source,
    status: normalizeStatus(row.status),
    lifecycle_status: normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket),
    review_bucket: normalizeReviewBucket(row.review_bucket),
    identity_key: listingIdentityKey({ ...row, price: canonical.price, mileage: canonical.mileage }),
    title: clean(row.title || ""),
    posted_at: row.posted_at || row.created_at || null,
    updated_at: row.updated_at || row.created_at || null,
    views_count: safeNumber(row.views_count, 0),
    messages_count: safeNumber(row.messages_count, 0),
    price: canonical.price,
    mileage: canonical.mileage,
    raw_price: canonical.raw_price,
    raw_mileage: canonical.raw_mileage,
    price_source: canonical.price_source,
    mileage_source: canonical.mileage_source,
    price_warning: canonical.price_warning,
    body_style: clean(row.body_style || ""),
    make: clean(row.make || ""),
    model: clean(row.model || ""),
    trim: clean(row.trim || "")
  };
  return { ...normalized, ...buildListingIntelligence(normalized) };
}
function preferListingRow(current, incoming) {
  if (!current) return incoming;
  const currentScore = (current.source_table === "user_listings" ? 1000 : 0) + safeNumber(current.views_count) + safeNumber(current.messages_count) * 10;
  const incomingScore = (incoming.source_table === "user_listings" ? 1000 : 0) + safeNumber(incoming.views_count) + safeNumber(incoming.messages_count) * 10;
  return incomingScore >= currentScore ? { ...current, ...incoming } : { ...incoming, ...current };
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
async function getTableListingRows(tableName, userId, email) {
  const rows = [];
  const seen = new Set();
  async function run(mode) {
    let query = supabase.from(tableName).select("*").order("posted_at", { ascending: false });
    if (mode === "user" && userId) query = query.eq("user_id", userId);
    if (mode === "email" && email) query = query.ilike("email", email);
    const { data } = await query;
    for (const row of (Array.isArray(data) ? data : [])) {
      const key = clean(row?.id || "") || `${clean(row?.marketplace_listing_id || "")}|${clean(row?.posted_at || row?.created_at || "")}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  if (userId) await run("user");
  if (email) await run("email");
  return rows;
}
async function getListingRows(userId, email) {
  const [userRows, legacyRows] = await Promise.all([
    getTableListingRows("user_listings", userId, email),
    getTableListingRows("listings", userId, email)
  ]);
  const map = new Map();
  for (const row of userRows) {
    const normalized = normalizeListingRow(row, "user_listings");
    map.set(normalized.identity_key, preferListingRow(map.get(normalized.identity_key), normalized));
  }
  for (const row of legacyRows) {
    const normalized = normalizeListingRow(row, "listings");
    map.set(normalized.identity_key, preferListingRow(map.get(normalized.identity_key), normalized));
  }
  return [...map.values()].sort((a, b) => new Date(b.posted_at || b.updated_at || 0).getTime() - new Date(a.posted_at || a.updated_at || 0).getTime());
}

function buildComputedSummary(rows = []) {
  const today = dayKey();
  const month = monthKey();
  const summary = {
    posts_today: 0,
    posts_this_month: 0,
    active_listings: 0,
    stale_listings: 0,
    total_views: 0,
    total_messages: 0,
    review_delete_count: 0,
    review_price_change_count: 0,
    review_new_count: 0,
    weak_listings: 0,
    needs_action_count: 0,
    queue_count: 0,
    top_listing_title: "None yet",
    total_listings: rows.length,
    action_center: { repost_today: 0, review_today: 0, promote_today: 0, likely_sold: 0, low_performance: 0 }
  };
  for (const row of rows) {
    const rowDay = dayKey(row.posted_at || row.created_at || row.updated_at || Date.now());
    const rowMonth = monthKey(row.posted_at || row.created_at || row.updated_at || Date.now());
    const status = normalizeStatus(row.status);
    const lifecycle = normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket);
    const bucket = normalizeReviewBucket(row.review_bucket);
    if (rowDay === today) summary.posts_today += 1;
    if (rowMonth === month) summary.posts_this_month += 1;
    if (!["sold", "deleted", "inactive", "stale"].includes(status) && lifecycle !== "review_delete") summary.active_listings += 1;
    summary.total_views += safeNumber(row.views_count, 0);
    summary.total_messages += safeNumber(row.messages_count, 0);
    if (status === "stale" || lifecycle === "stale" || lifecycle === "review_delete" || bucket === "removedvehicles") summary.stale_listings += 1;
    if (lifecycle === "review_delete" || bucket === "removedvehicles") summary.review_delete_count += 1;
    if (lifecycle === "review_price_update" || bucket === "pricechanges") summary.review_price_change_count += 1;
    if (lifecycle === "review_new" || bucket === "newvehicles") summary.review_new_count += 1;
    if (row.weak) summary.weak_listings += 1;
    if (row.needs_action) summary.needs_action_count += 1;
    if (row.likely_sold) summary.action_center.likely_sold += 1;
    if (row.promote_now) summary.action_center.promote_today += 1;
  }
  const top = [...rows].sort((a,b) => safeNumber(b.popularity_score) - safeNumber(a.popularity_score))[0] || null;
  summary.top_listing_title = clean(top?.title || "None yet");
  summary.review_queue_count = summary.review_delete_count + summary.review_price_change_count + summary.review_new_count;
  return summary;
}
function buildProfileSnapshot(user = {}, profileRow = {}, snapshot = {}) {
  const merged = { ...(snapshot || {}), ...(profileRow || {}) };
  const fullName = clean(merged.full_name || merged.salesperson_name || `${clean(user?.first_name)} ${clean(user?.last_name)}`.trim());
  const dealership = clean(merged.dealership || merged.dealer_name || merged.company_name || user?.company || "");
  const province = normalizeProvince(merged.province || "");
  return {
    full_name: fullName,
    salesperson_name: fullName,
    dealership,
    dealer_name: dealership,
    city: clean(merged.city || ""),
    province,
    phone: clean(merged.phone || ""),
    license_number: clean(merged.license_number || ""),
    listing_location: clean(merged.listing_location || merged.city || ""),
    dealer_phone: clean(merged.dealer_phone || ""),
    dealer_email: clean(merged.dealer_email || merged.email || ""),
    compliance_mode: normalizeComplianceMode(merged.compliance_mode, province),
    dealer_website: clean(merged.dealer_website || merged.website || ""),
    inventory_url: clean(merged.inventory_url || merged.inventory_link || ""),
    scanner_type: clean(merged.scanner_type || merged.scanner || ""),
    software_license_key: clean(merged.software_license_key || merged.license_key || "")
  };
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
  const setupGaps = [
    checks.salesperson_name_present ? "" : "salesperson name missing",
    checks.dealership_name_present ? "" : "dealership missing",
    checks.inventory_url_present ? "" : "inventory URL missing",
    checks.compliance_mode_present ? "" : "compliance mode missing",
    checks.dealer_website_present ? "" : "dealer website missing",
    checks.scanner_type_present ? "" : "scanner type missing",
    checks.listing_location_present ? "" : "listing location missing"
  ].filter(Boolean);
  return {
    profile_complete: completion === total,
    profile_completion_score: total ? completion / total : 0,
    setup_gaps: setupGaps,
    ...checks
  };
}
function buildActionCenterDetails(rows = []) {
  const list = rows.slice(0, 12).map((row) => ({
    id: row.id,
    title: clean(row.title || "Listing"),
    subtitle: clean([row.make, row.model, row.stock_number || row.vin].filter(Boolean).join(" • ")),
    status: normalizeStatus(row.status),
    lifecycle_status: normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket),
    views_count: safeNumber(row.views_count),
    messages_count: safeNumber(row.messages_count),
    price: safeNumber(row.price),
    recommended_action: clean(row.recommended_action || "Review now"),
    reason: clean(row.recommended_action || "Needs operator review."),
    source_url: row.source_url || "",
    action_type: row.promote_now ? "promote_now" : /price/i.test(clean(row.recommended_action)) ? "needs_price_review" : row.weak ? "relisted" : "approved",
    priority: row.promote_now ? "opportunity" : (row.weak || row.needs_action ? "attention" : "today")
  }));
  return {
    today: list.filter((x) => x.priority === "today").slice(0, 6),
    needs_attention: list.filter((x) => x.priority === "attention").slice(0, 6),
    opportunities: list.filter((x) => x.priority === "opportunity").slice(0, 6)
  };
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

    const [subscriptionRow, postingUsageRow, profileRow, rows] = await Promise.all([
      getSubscription(finalUserId, finalEmail),
      getPostingUsageRow(finalUserId, finalEmail),
      getProfileRow(finalUserId, finalEmail),
      getListingRows(finalUserId, finalEmail)
    ]);

    const computed = buildComputedSummary(rows);
    const snapshot = subscriptionRow?.account_snapshot && typeof subscriptionRow.account_snapshot === "object" ? subscriptionRow.account_snapshot : {};
    const forcedAccess = hasTestingLimitOverride(finalEmail);
    const planValue = forcedAccess ? "Pro" : clean(subscriptionRow?.plan_type || subscriptionRow?.plan_name || subscriptionRow?.plan || user?.plan || "Founder Beta");
    const dailyLimit = forcedAccess ? 25 : safeNumber(snapshot.posting_limit ?? subscriptionRow?.daily_posting_limit ?? subscriptionRow?.posting_limit ?? inferPostingLimitFromPlan(planValue), inferPostingLimitFromPlan(planValue));
    const usageToday = Math.max(safeNumber(postingUsageRow?.posts_today ?? postingUsageRow?.posts_used ?? postingUsageRow?.used_today, 0), safeNumber(snapshot.posts_today ?? snapshot.posts_used_today, 0), safeNumber(computed.posts_today, 0));
    const accessGranted = Boolean(forcedAccess || snapshot.access_granted === true || snapshot.active === true || subscriptionRow?.active === true || isActiveStatus(subscriptionRow?.status) || (clean(planValue) && dailyLimit > 0));
    const effectiveStatus = accessGranted ? "active" : clean(subscriptionRow?.status || snapshot.status || "inactive").toLowerCase();
    const accessState = resolveAccountAccess({
      plan: planValue,
      status: effectiveStatus,
      postsToday: usageToday,
      postingLimit: dailyLimit,
      creditExtraPosts: 0,
      email: finalEmail,
      stripeCustomerId: snapshot.stripe_customer_id || subscriptionRow?.stripe_customer_id || ""
    });
    const postsRemaining = Math.max(safeNumber(accessState.posting_limit, dailyLimit) - usageToday, 0);

    const profileSnapshot = buildProfileSnapshot(user, profileRow, snapshot);
    const setupStatus = buildSetupStatus(user, profileSnapshot);
    const today = dayKey(new Date());
    const creditEconomy = await getCreditEconomyState(supabase, { userId: finalUserId, email: finalEmail, dateKey: today });
    const creditsSummary = creditEconomy.summary || await getCreditSummary(supabase, { userId: finalUserId, email: finalEmail });
    const recentCreditEventsRaw = await listRecentCreditEvents(supabase, { userId: finalUserId, email: finalEmail, limit: 6 });
    const recentCreditEvents = recentCreditEventsRaw.map((event) => ({
      type: event.type,
      label: formatCreditEventLabel(event.type),
      amount: safeNumber(event.amount, 0),
      created_at: event.created_at,
      meta: event.meta || {}
    }));

    const actionCenterDetails = buildActionCenterDetails(rows);
    const recentListings = rows.slice(0, 12).map((row) => ({
      id: row.id,
      title: row.title,
      image_url: row.image_url || "",
      price: safeNumber(row.price, 0),
      mileage: safeNumber(row.mileage, 0),
      raw_price: safeNumber(row.raw_price, 0),
      raw_mileage: safeNumber(row.raw_mileage, 0),
      price_source: row.price_source || "",
      mileage_source: row.mileage_source || "",
      price_warning: row.price_warning || "",
      status: row.status || "active",
      lifecycle_status: row.lifecycle_status || "",
      posted_at: row.posted_at || row.created_at,
      views_count: safeNumber(row.views_count, 0),
      messages_count: safeNumber(row.messages_count, 0),
      review_bucket: row.review_bucket || "",
      source_url: row.source_url || "",
      stock_number: row.stock_number || "",
      vin: row.vin || "",
      body_style: row.body_style || "",
      exterior_color: row.exterior_color || "",
      fuel_type: row.fuel_type || "",
      make: row.make || "",
      model: row.model || "",
      trim: row.trim || "",
      health_label: row.health_label || "",
      age_days: safeNumber(row.age_days, 0),
      recommended_action: row.recommended_action || "",
      predicted_score: safeNumber(row.predicted_score, 0),
      predicted_label: row.predicted_label || "",
      pricing_insight: row.pricing_insight || "",
      content_score: safeNumber(row.content_score, 0),
      content_feedback: row.content_feedback || "",
      popularity_score: safeNumber(row.popularity_score, 0),
      weak: Boolean(row.weak),
      needs_action: Boolean(row.needs_action),
      promote_now: Boolean(row.promote_now),
      likely_sold: Boolean(row.likely_sold),
      post_priority: safeNumber(row.post_priority, 0),
      refresh_priority: safeNumber(row.refresh_priority, 0),
      price_review_priority: safeNumber(row.price_review_priority, 0),
      opportunity_score: safeNumber(row.opportunity_score, 0),
      action_bucket: row.action_bucket || "watch",
      action_bucket_label: row.action_bucket_label || "Watch"
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
        weak_listings: computed.weak_listings,
        needs_action_count: computed.needs_action_count,
        action_center: computed.action_center,
        action_center_details: actionCenterDetails,
        queue_count: computed.queue_count,
        lifecycle_updated_at: clean(snapshot.lifecycle_updated_at || ""),
        top_listing_title: clean(computed.top_listing_title || "None yet"),
        total_listings: computed.total_listings,
        recent_listings: recentListings,
        daily_limit: dailyLimit,
        effective_posting_limit: safeNumber(accessState.posting_limit, dailyLimit),
        posts_remaining: postsRemaining,
        can_post: Boolean(accessState.can_post),
        listing_data_state: {
          direct_rows_found: rows.length,
          preview_rows_found: recentListings.length,
          sources: { user_listings: rows.filter((r) => r.source_table === "user_listings").length, listings: rows.filter((r) => r.source_table === "listings").length, merged: rows.length }
        },
        account_snapshot: {
          ...(snapshot || {}),
          user_id: finalUserId,
          email: finalEmail,
          plan: accessState.plan,
          status: effectiveStatus,
          active: accessGranted,
          access_granted: accessGranted,
          posting_limit: safeNumber(accessState.posting_limit, dailyLimit),
          posts_today: usageToday,
          posts_remaining: postsRemaining,
          ...profileSnapshot
        },
        profile_snapshot: profileSnapshot,
        setup_status: setupStatus,
        credits: {
          balance: safeNumber(creditsSummary.balance, 0),
          lifetime_earned: safeNumber(creditsSummary.lifetime_earned, 0),
          lifetime_spent: safeNumber(creditsSummary.lifetime_spent, 0),
          recent_events: recentCreditEvents
        },
        plan_access: {
          plan_label: accessState.plan,
          is_pro: clean(accessState.plan).toLowerCase().includes("pro"),
          posting_limit: safeNumber(accessState.posting_limit, dailyLimit),
          upgrade_target: clean(accessState.plan).toLowerCase().includes("pro") ? "Maintain Pro Momentum" : "Founder Pro"
        },
        premium_preview: {
          headline: "Premium Preview",
          subheadline: "Upgrade prompts stay secondary until the operator workflow is clean.",
          bullets: ["25 posts/day on Pro", "Deeper analytics", "Premium workflow tools"],
          cta_label: "Open Billing & Access",
          cta_target: "billing"
        },
        upgrade_prompts: [],
        upgrade_reasons: [],
        manager_access: false,
        manager_summary: {},
        manager_recommendations: [],
        segment_performance: [],
        daily_ops_queues: computed.action_center,
        roi_snapshot: {
          estimated_minutes_saved_today: usageToday * 18,
          estimated_minutes_saved_week: usageToday * 18,
          estimated_value_saved: Number((((usageToday * 18) / 60) * 30).toFixed(2))
        }
      }
    });
  } catch (error) {
    console.error("get-dashboard-summary fatal error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
