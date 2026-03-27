
import { createClient } from "@supabase/supabase-js";
import { resolveAccountAccess } from "./_shared/account-access.js";
import { getVerifiedRequestUser } from "./_shared/auth.js";
import { getCreditSummary, listRecentCreditEvents, formatCreditEventLabel, getCreditEconomyState } from "./_shared/credits.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUSINESS_TIMEZONE = "America/Edmonton";
const FORCE_25_EMAILS = new Set(["damian044@icloud.com"]);

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
function zonedParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { year: map.year || "0000", month: map.month || "00", day: map.day || "00" };
}
function dayKey(value = new Date()) {
  const { year, month, day } = zonedParts(value);
  return `${year}-${month}-${day}`;
}
function monthKey(value = new Date()) {
  const { year, month } = zonedParts(value);
  return `${year}-${month}`;
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
  return [clean(row.year), clean(row.make), clean(row.model), String(row.price||""), String(row.mileage||"")].filter(Boolean).join("|");
}
function toPriceBand(price) {
  const n = safeNumber(price, 0);
  if (!n) return "Unknown";
  if (n < 15000) return "Under $15k";
  if (n < 25000) return "$15k–$25k";
  if (n < 40000) return "$25k–$40k";
  return "$40k+";
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
  const staleLike = status === 'stale' || lifecycle === 'stale' || lifecycle === 'review_delete' || reviewBucket === 'removedvehicles';
  const likelySold = lifecycle === 'review_delete' || reviewBucket === 'removedvehicles';
  const activeLike = !['sold', 'deleted', 'inactive'].includes(status) && lifecycle !== 'review_delete';
  const highViewsNoMessages = activeLike && views >= 20 && messages === 0;
  const promoteNow = activeLike && views >= 20 && messages >= 1;
  const lowPerformance = activeLike && ageDays >= 7 && views < 5 && messages === 0;
  const weak = staleLike || lowPerformance;
  const needsAction = staleLike || lowPerformance || highViewsNoMessages || lifecycle === 'review_price_update' || reviewBucket === 'pricechanges';
  const repostToday = activeLike && ageDays >= 3 && views === 0;

  let healthScore = 100;
  healthScore -= Math.min(ageDays * 2, 30);
  healthScore += Math.min(messages * 16, 40);
  healthScore += Math.min(views, 20);
  if (staleLike) healthScore -= 35;
  if (lowPerformance) healthScore -= 20;
  if (highViewsNoMessages) healthScore -= 12;
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  let healthLabel = 'Healthy';
  if (promoteNow) healthLabel = 'High Performer';
  else if (needsAction) healthLabel = 'Needs Action';
  else if (weak) healthLabel = 'Weak';

  let recommendedAction = 'Keep live';
  if (likelySold) recommendedAction = 'Check if sold or stale';
  else if (lifecycle === 'review_price_update' || reviewBucket === 'pricechanges' || highViewsNoMessages) recommendedAction = 'Review price';
  else if (lifecycle === 'review_new' || reviewBucket === 'newvehicles') recommendedAction = 'Review new listing';
  else if (repostToday) recommendedAction = 'Repost today';
  else if (lowPerformance) recommendedAction = 'Refresh title/photos';
  else if (promoteNow) recommendedAction = 'Promote now';

  let predictedScore = 50;
  predictedScore += Math.min(views, 25);
  predictedScore += Math.min(messages * 18, 36);
  predictedScore -= Math.min(ageDays * 3, 24);
  if (highViewsNoMessages) predictedScore -= 8;
  if (weak) predictedScore -= 20;
  predictedScore = Math.max(0, Math.min(100, Math.round(predictedScore)));

  let predictedLabel = 'Uncertain';
  if (predictedScore >= 75) predictedLabel = 'High Performer';
  else if (predictedScore >= 55) predictedLabel = 'Likely Performer';
  else if (predictedScore < 35) predictedLabel = 'Low Probability';

  const pricingInsight = highViewsNoMessages
    ? 'Price may be limiting message conversion.'
    : messages >= 2
      ? 'Pricing appears competitive.'
      : views === 0 && ageDays >= 3
        ? 'Listing may need stronger value or visibility.'
        : 'Pricing signal still developing.';

  let contentScore = 60;
  if (clean(row.title).length >= 18) contentScore += 10;
  if (clean(row.stock_number)) contentScore += 5;
  if (clean(row.vin)) contentScore += 5;
  if (clean(row.exterior_color)) contentScore += 5;
  if (clean(row.body_style)) contentScore += 5;
  if (clean(row.fuel_type)) contentScore += 5;
  if (ageDays >= 7 && views < 5) contentScore -= 10;
  contentScore = Math.max(0, Math.min(100, Math.round(contentScore)));
  const contentFeedback = contentScore >= 80
    ? 'Listing structure looks strong.'
    : contentScore >= 65
      ? 'Content is workable but could be tightened.'
      : 'Listing likely needs a stronger title and better detail signals.';

  const imageCount = safeNumber(row.image_count || row.photo_count || row.media_count || 0, 0);
  let postPriority = 35;
  if (!postedValue) postPriority += 28;
  if (lifecycle === 'review_new' || reviewBucket === 'newvehicles') postPriority += 24;
  if (views === 0 && messages === 0 && ageDays <= 2) postPriority += 12;
  if (imageCount >= 8) postPriority += 6;
  if (!clean(row.body_style)) postPriority -= 4;
  postPriority = Math.max(0, Math.min(100, Math.round(postPriority)));

  let refreshPriority = 10;
  if (staleLike) refreshPriority += 45;
  if (lowPerformance) refreshPriority += 22;
  if (ageDays >= 7 && views < 8) refreshPriority += 14;
  if (messages > 0) refreshPriority -= 10;
  refreshPriority = Math.max(0, Math.min(100, Math.round(refreshPriority)));

  let priceReviewPriority = 8;
  if (highViewsNoMessages || lifecycle === 'review_price_update' || reviewBucket === 'pricechanges') priceReviewPriority += 52;
  if (views >= 10 && messages === 0) priceReviewPriority += 12;
  priceReviewPriority = Math.max(0, Math.min(100, Math.round(priceReviewPriority)));

  let opportunityScore = Math.round((predictedScore * 0.45) + (healthScore * 0.2) + Math.min(views, 30) + Math.min(messages * 15, 30));
  if (staleLike) opportunityScore -= 18;
  if (highViewsNoMessages) opportunityScore -= 10;
  opportunityScore = Math.max(0, Math.min(100, opportunityScore));

  let actionBucket = 'low_priority';
  if (priceReviewPriority >= 60 || refreshPriority >= 60 || lifecycle.startsWith('review')) actionBucket = 'do_now';
  else if (postPriority >= 60 || promoteNow || needsAction) actionBucket = 'do_today';
  else if (weak || opportunityScore >= 60) actionBucket = 'watch';

  return {
    age_days: ageDays,
    likely_sold: likelySold,
    promote_now: promoteNow,
    low_performance: lowPerformance,
    repost_today: repostToday,
    weak,
    needs_action: needsAction,
    health_score: healthScore,
    health_label: healthLabel,
    recommended_action: recommendedAction,
    predicted_score: predictedScore,
    predicted_label: predictedLabel,
    pricing_insight: pricingInsight,
    content_score: contentScore,
    content_feedback: contentFeedback,
    popularity_score: messages * 1000 + views * 10 + (postedTs / 100000000),
    post_priority: postPriority,
    refresh_priority: refreshPriority,
    price_review_priority: priceReviewPriority,
    opportunity_score: opportunityScore,
    action_bucket: actionBucket,
    action_bucket_label: actionBucket === 'do_now' ? 'Do Now' : actionBucket === 'do_today' ? 'Do Today' : actionBucket === 'watch' ? 'Watch' : 'Low Priority'
  };
}
function normalizeListingRow(row = {}, source = 'user_listings') {
  const normalized = {
    ...row,
    id: clean(row.id || ''),
    source_table: source,
    status: normalizeStatus(row.status),
    lifecycle_status: normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket),
    review_bucket: normalizeReviewBucket(row.review_bucket),
    identity_key: listingIdentityKey(row),
    title: clean(row.title || ''),
    posted_at: row.posted_at || row.created_at || null,
    updated_at: row.updated_at || row.created_at || null,
    views_count: safeNumber(row.views_count, 0),
    messages_count: safeNumber(row.messages_count, 0),
    price: safeNumber(row.price, 0),
    mileage: safeNumber(row.mileage || row.kilometers || row.km, 0),
    body_style: clean(row.body_style || ''),
    make: clean(row.make || ''),
    model: clean(row.model || ''),
    trim: clean(row.trim || '')
  };
  return { ...normalized, ...buildListingIntelligence(normalized) };
}
function preferListingRow(current, incoming) {
  if (!current) return incoming;
  const currentScore = (current.source_table === 'user_listings' ? 1000 : 0) + safeNumber(current.views_count) + safeNumber(current.messages_count) * 10 + new Date(current.updated_at || current.posted_at || 0).getTime() / 1000000000000;
  const incomingScore = (incoming.source_table === 'user_listings' ? 1000 : 0) + safeNumber(incoming.views_count) + safeNumber(incoming.messages_count) * 10 + new Date(incoming.updated_at || incoming.posted_at || 0).getTime() / 1000000000000;
  return incomingScore >= currentScore ? { ...current, ...incoming } : { ...incoming, ...current };
}
function mergeListingRows(userRows, legacyRows) {
  const map = new Map();
  for (const row of userRows) {
    const normalized = normalizeListingRow(row, 'user_listings');
    map.set(normalized.identity_key, preferListingRow(map.get(normalized.identity_key), normalized));
  }
  for (const row of legacyRows) {
    const normalized = normalizeListingRow(row, 'listings');
    map.set(normalized.identity_key, preferListingRow(map.get(normalized.identity_key), normalized));
  }
  return [...map.values()].sort((a, b) => new Date(b.posted_at || b.updated_at || 0).getTime() - new Date(a.posted_at || a.updated_at || 0).getTime());
}
async function resolveUser({ userId, email }) {
  if (userId) {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  if (email) {
    const { data, error } = await supabase.from('users').select('*').ilike('email', email).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
}
async function getSubscription(userId, email) {
  if (userId) {
    const { data, error } = await supabase.from('subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  if (email) {
    const { data, error } = await supabase.from('subscriptions').select('*').ilike('email', email).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
}
async function getProfileRow(userId, email) {
  if (userId) {
    const direct = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!direct.error && direct.data) return direct.data;
    const userLinked = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    if (!userLinked.error && userLinked.data) return userLinked.data;
  }
  if (email) {
    const byEmail = await supabase.from('profiles').select('*').ilike('email', email).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (!byEmail.error && byEmail.data) return byEmail.data;
  }
  return null;
}
async function getPostingUsageRow(userId, email) {
  const today = dayKey();
  if (userId) {
    const { data, error } = await supabase.from('posting_usage').select('*').eq('user_id', userId).eq('date_key', today).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  if (email) {
    const { data, error } = await supabase.from('posting_usage').select('*').ilike('email', email).eq('date_key', today).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
}
async function getTableListingRows(tableName, userId, email) {
  const rows = [];
  const seen = new Set();
  async function run(mode) {
    let query = supabase.from(tableName).select('*').order('posted_at', { ascending: false });
    if (mode === 'user' && userId) query = query.eq('user_id', userId);
    if (mode === 'email' && email) query = query.ilike('email', email);
    const { data, error } = await query;
    if (error) throw error;
    for (const row of (Array.isArray(data) ? data : [])) {
      const key = clean(row?.id || '') || `${clean(row?.marketplace_listing_id || '')}|${clean(row?.posted_at || row?.created_at || '')}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  if (userId) await run('user');
  if (email) await run('email');
  return rows;
}
async function getListingRows(userId, email) {
  const [userRows, legacyRows] = await Promise.all([
    getTableListingRows('user_listings', userId, email),
    getTableListingRows('listings', userId, email)
  ]);
  return mergeListingRows(userRows, legacyRows);
}

function estimatePlanMonthlyRevenue(planValue) {
  const plan = normalizePlan(planValue);
  if (!plan) return 39;
  if (plan.includes('founder') && plan.includes('pro')) return 79;
  if (plan === 'pro' || (!plan.includes('founder') && plan.includes('pro'))) return 79;
  return 39;
}
async function getAffiliateSummary({ referralCode, email }) {
  const code = clean(referralCode || '');
  const ownerEmail = normalizeEmail(email || '');
  const base = {
    referral_code: code,
    partner_type: 'Founding Partner',
    direct_commission_percent: 20,
    second_level_override_percent: 5,
    payout_status: 'Manual founder-stage payouts',
    total_referrals: 0,
    active_referrals: 0,
    invited_referrals: 0,
    signed_up_referrals: 0,
    paying_referrals: 0,
    churned_referrals: 0,
    commission_earned: 0,
    estimated_mrr_commission: 0,
    pending_payout: 0,
    paid_out_all_time: 0,
    recent_referrals: [],
    recommended_actions: [
      'Invite sales managers and top Marketplace posters first.',
      'Share your referral link in one direct DM and one story this week.'
    ]
  };
  if (!code) return base;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('id,user_id,email,plan,plan_name,plan_type,status,active,created_at,current_period_end,cancel_at_period_end,referral_code,account_snapshot')
    .ilike('referral_code', code)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;

  const rows = (Array.isArray(data) ? data : []).filter((row) => normalizeEmail(row?.email) !== ownerEmail);
  let active = 0;
  let paying = 0;
  let churned = 0;
  let estimatedMrr = 0;
  const recent = [];

  for (const row of rows) {
    const snapshot = row?.account_snapshot && typeof row.account_snapshot === 'object' ? row.account_snapshot : {};
    const plan = clean(row?.plan_type || row?.plan_name || row?.plan || snapshot.plan || 'Starter');
    const isActive = Boolean(row?.active === true || snapshot.active === true || isActiveStatus(row?.status || snapshot.status));
    const estimatedCommission = isActive ? estimatePlanMonthlyRevenue(plan) * 0.20 : 0;
    if (isActive) {
      active += 1;
      paying += 1;
      estimatedMrr += estimatedCommission;
    } else {
      churned += 1;
    }
    recent.push({
      name: clean(snapshot.full_name || row?.email || '').split('@')[0],
      email: normalizeEmail(row?.email || ''),
      plan,
      status: isActive ? 'paying' : 'signed_up',
      created_at: row?.created_at || '',
      estimated_commission: Math.round(estimatedCommission * 100) / 100
    });
  }

  const recommended = [];
  if (!rows.length) recommended.push('Start with 10 direct outreach messages to salespeople or managers this week.');
  if (rows.length > active) recommended.push(`Follow up with ${rows.length - active} inactive referral${rows.length - active === 1 ? '' : 's'}.`);
  if (active) recommended.push('Ask active partners for one dealership or manager introduction.');
  if (active >= 3) recommended.push('Highlight recurring commission in your outreach to attract stronger partners.');

  return {
    ...base,
    total_referrals: rows.length,
    active_referrals: active,
    invited_referrals: rows.length,
    signed_up_referrals: rows.length,
    paying_referrals: paying,
    churned_referrals: churned,
    commission_earned: 0,
    estimated_mrr_commission: Math.round(estimatedMrr * 100) / 100,
    pending_payout: Math.round(estimatedMrr * 100) / 100,
    recent_referrals: recent.slice(0, 8),
    recommended_actions: recommended.length ? recommended : base.recommended_actions
  };
}

function pickActionType(row = {}) {
  const lifecycle = normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket);
  if (row.promote_now) return "promote_now";
  if (row.needs_action && (row.pricing_insight || "").toLowerCase().includes("price")) return "needs_price_review";
  if (lifecycle === "review_delete" || normalizeReviewBucket(row.review_bucket) === "removedvehicles") return "dismissed";
  if (lifecycle === "review_price_update" || normalizeReviewBucket(row.review_bucket) === "pricechanges") return "needs_price_review";
  if (row.weak || row.low_performance || row.repost_today) return "relisted";
  return "approved";
}
function buildActionCenterDetails(rows = []) {
  const normalizeUrl = (value) => {
    const raw = clean(value);
    if (!raw) return "";
    try {
      const url = new URL(raw);
      ["fbclid","ref","utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach((key) => url.searchParams.delete(key));
      return url.toString();
    } catch { return raw; }
  };
  const unique = new Map();
  rows.forEach((row) => {
    const key =
      clean(row.marketplace_listing_id || row.listing_id || row.vin || row.stock_number) ||
      normalizeUrl(row.source_url) ||
      clean(row.id);
    if (!key) return;
    const current = unique.get(key);
    if (!current || safeNumber(row.popularity_score) > safeNumber(current.popularity_score) || safeNumber(row.updated_at) > safeNumber(current.updated_at)) {
      unique.set(key, row);
    }
  });
  const list = Array.from(unique.values()).map((row) => {
    const lifecycle = normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket);
    const reason = row.recommended_action || (
      row.promote_now ? "High traction with upside." :
      row.weak ? "Low traction or stale risk detected." :
      lifecycle === "review_delete" ? "Listing missing from latest scan." :
      lifecycle === "review_price_update" ? "Price movement needs review." :
      lifecycle === "review_new" ? "New listing needs validation." :
      row.repost_today ? "Listing should be reposted today." :
      row.likely_sold ? "This unit may already be sold." :
      "Needs operator review."
    );
    return {
      id: row.id,
      title: clean(row.title || "Listing"),
      subtitle: clean([row.make, row.model, row.stock_number || row.vin].filter(Boolean).join(" • ")),
      status: normalizeStatus(row.status),
      lifecycle_status: lifecycle,
      views_count: safeNumber(row.views_count),
      messages_count: safeNumber(row.messages_count),
      price: safeNumber(row.price),
      recommended_action: clean(row.recommended_action || "Review now"),
      reason,
      source_url: row.source_url || "",
      action_type: pickActionType(row),
      priority: row.promote_now ? "opportunity" : ((row.weak || row.needs_action || lifecycle.startsWith("review")) ? "attention" : "today")
    };
  });
  const needs_attention = list.filter((item) => ["review_delete","review_price_update","review_new"].includes(item.lifecycle_status) || ["stale","weak"].includes(item.status) || /review|refresh|stale|missing|price/i.test(item.reason)).slice(0, 6);
  const opportunities = list.filter((item) => item.action_type === "promote_now" || /promote|strong|opportunity/i.test(item.reason) || (item.views_count >= 20 && item.messages_count === 0)).slice(0, 6);
  const today = list.filter((item) => item.priority === "today" || item.action_type === "relisted").slice(0, 6);
  return { today, needs_attention, opportunities };
}

function buildSetupStatus(user, profileRow) {
  const inventoryUrl = clean(profileRow?.inventory_url || profileRow?.inventory_link || '');
  const salespersonName = clean(
    profileRow?.full_name ||
    profileRow?.salesperson_name ||
    `${clean(user?.first_name)} ${clean(user?.last_name)}`.trim()
  );
  const dealershipName = clean(
    profileRow?.dealership ||
    profileRow?.dealer_name ||
    profileRow?.company_name ||
    user?.company ||
    ''
  );
  const complianceMode = clean(profileRow?.compliance_mode || profileRow?.province || '');
  const website = clean(profileRow?.dealer_website || profileRow?.website || '');
  const scannerType = clean(profileRow?.scanner_type || profileRow?.scanner || '');
  const listingLocation = clean(profileRow?.listing_location || profileRow?.city || '');
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
    checks.salesperson_name_present ? '' : 'salesperson name missing',
    checks.dealership_name_present ? '' : 'dealership missing',
    checks.inventory_url_present ? '' : 'inventory URL missing',
    checks.compliance_mode_present ? '' : 'compliance mode missing',
    checks.dealer_website_present ? '' : 'dealer website missing',
    checks.scanner_type_present ? '' : 'scanner type missing',
    checks.listing_location_present ? '' : 'listing location missing'
  ].filter(Boolean);
  return {
    profile_complete: completion === total,
    profile_completion_score: total ? completion / total : 0,
    inventory_url: inventoryUrl,
    salesperson_name: salespersonName,
    dealership_name: dealershipName,
    compliance_mode: complianceMode,
    dealer_website: website,
    scanner_type: scannerType,
    listing_location: listingLocation,
    setup_gaps: setupGaps,
    ...checks
  };
}

function buildProfileSnapshot(user = {}, profileRow = {}, snapshot = {}) {
  const merged = { ...(snapshot || {}), ...(profileRow || {}) };
  const fullName = clean(
    merged.full_name ||
    merged.salesperson_name ||
    `${clean(user?.first_name)} ${clean(user?.last_name)}`.trim()
  );
  const dealership = clean(
    merged.dealership ||
    merged.dealer_name ||
    merged.company_name ||
    user?.company ||
    ''
  );
  const province = clean(merged.province || '');
  return {
    full_name: fullName,
    salesperson_name: fullName,
    dealership,
    dealer_name: dealership,
    city: clean(merged.city || ''),
    province,
    phone: clean(merged.phone || ''),
    license_number: clean(merged.license_number || ''),
    listing_location: clean(merged.listing_location || merged.city || ''),
    dealer_phone: clean(merged.dealer_phone || ''),
    dealer_email: clean(merged.dealer_email || merged.email || ''),
    compliance_mode: clean(merged.compliance_mode || province || ''),
    dealer_website: clean(merged.dealer_website || merged.website || ''),
    inventory_url: clean(merged.inventory_url || merged.inventory_link || ''),
    scanner_type: clean(merged.scanner_type || merged.scanner || ''),
    software_license_key: clean(merged.software_license_key || merged.license_key || ''),
    profile_updated_at: merged.updated_at || merged.created_at || null
  };
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
    top_listing_title: 'None yet',
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
    if (!['sold', 'deleted', 'inactive', 'stale'].includes(status) && lifecycle !== 'review_delete') summary.active_listings += 1;
    summary.total_views += safeNumber(row.views_count, 0);
    summary.total_messages += safeNumber(row.messages_count, 0);
    if (status === 'stale' || lifecycle === 'stale' || lifecycle === 'review_delete' || bucket === 'removedvehicles') summary.stale_listings += 1;
    if (lifecycle === 'review_delete' || bucket === 'removedvehicles') summary.review_delete_count += 1;
    if (lifecycle === 'review_price_update' || bucket === 'pricechanges') summary.review_price_change_count += 1;
    if (lifecycle === 'review_new' || bucket === 'newvehicles') summary.review_new_count += 1;
    if (row.weak) summary.weak_listings += 1;
    if (row.needs_action) summary.needs_action_count += 1;
    if (row.repost_today) summary.action_center.repost_today += 1;
    if (['review_delete', 'review_price_update', 'review_new'].includes(lifecycle) || ['removedvehicles', 'pricechanges', 'newvehicles'].includes(bucket)) summary.action_center.review_today += 1;
    if (row.promote_now) summary.action_center.promote_today += 1;
    if (row.likely_sold) summary.action_center.likely_sold += 1;
    if (row.low_performance) summary.action_center.low_performance += 1;
  }
  const top = [...rows].sort((a,b) => safeNumber(b.popularity_score) - safeNumber(a.popularity_score))[0] || null;
  summary.top_listing_title = clean(top?.title || 'None yet');
  summary.review_queue_count = summary.review_delete_count + summary.review_price_change_count + summary.review_new_count;
  summary.weak_rate = summary.total_listings ? Number(((summary.weak_listings/summary.total_listings)*100).toFixed(1)) : 0;
  summary.stale_rate = summary.total_listings ? Number(((summary.stale_listings/summary.total_listings)*100).toFixed(1)) : 0;
  return summary;
}
function buildAlerts(summary) {
  const alerts = [];
  if (summary.posts_today === 0) alerts.push({ severity: 'warning', code: 'NO_POSTS', title: 'No posts yet today', message: 'Posting activity has not started for the current business day.' });
  if (summary.action_center.repost_today > 0) alerts.push({ severity: 'warning', code: 'REPOST', title: 'Listings need reposting', message: `${summary.action_center.repost_today} listing${summary.action_center.repost_today === 1 ? '' : 's'} should be reposted today.` });
  if (summary.action_center.review_today > 0) alerts.push({ severity: 'warning', code: 'REVIEW', title: 'Review queue needs attention', message: `${summary.action_center.review_today} listing${summary.action_center.review_today === 1 ? '' : 's'} are waiting for review.` });
  if (summary.action_center.promote_today > 0) alerts.push({ severity: 'success', code: 'PROMOTE', title: 'Strong promotion candidates', message: `${summary.action_center.promote_today} listing${summary.action_center.promote_today === 1 ? '' : 's'} are outperforming and should be promoted.` });
  if (summary.total_views >= 20 && summary.total_messages === 0) alerts.push({ severity: 'warning', code: 'LOW_CONVERSION', title: 'Views are not converting', message: 'View volume is showing up without message traction. Review price and listing quality.' });
  if (summary.weak_listings > 0) alerts.push({ severity: 'danger', code: 'WEAK', title: 'Weak listings detected', message: `${summary.weak_listings} weak listing${summary.weak_listings === 1 ? '' : 's'} need attention.` });
  return alerts;
}
function buildScorecards(summary, rows) {
  const last7 = rows.filter((row) => {
    const ts = new Date(row.posted_at || row.created_at || 0).getTime();
    return ts && ts >= (Date.now() - 7 * 86400000);
  });
  const previous7 = rows.filter((row) => {
    const ts = new Date(row.posted_at || row.created_at || 0).getTime();
    return ts && ts < (Date.now() - 7 * 86400000) && ts >= (Date.now() - 14 * 86400000);
  });
  const views7 = last7.reduce((sum, row) => sum + safeNumber(row.views_count, 0), 0);
  const msg7 = last7.reduce((sum, row) => sum + safeNumber(row.messages_count, 0), 0);
  const prevViews7 = previous7.reduce((sum, row) => sum + safeNumber(row.views_count, 0), 0);
  const prevMsg7 = previous7.reduce((sum, row) => sum + safeNumber(row.messages_count, 0), 0);
  const dailyCompletion = summary.active_listings ? Math.round(Math.min(100, ((summary.posts_today + summary.action_center.review_today + summary.action_center.promote_today) / Math.max(summary.active_listings, 1)) * 100)) : (summary.posts_today ? 100 : 0);
  return {
    daily: {
      posts_today: summary.posts_today,
      views_today_est: Math.round(summary.total_views / 7),
      messages_today_est: Math.round(summary.total_messages / 7),
      weak_listings: summary.weak_listings,
      completion_score: dailyCompletion
    },
    weekly: {
      views_7d: views7,
      messages_7d: msg7,
      views_delta: views7 - prevViews7,
      messages_delta: msg7 - prevMsg7,
      activity_delta: last7.length - previous7.length
    }
  };
}
function buildSegmentPerformance(rows) {
  const bucket = new Map();
  for (const row of rows) {
    const candidates = [
      { group: 'make', key: clean(row.make || 'Unknown') || 'Unknown' },
      { group: 'body_style', key: clean(row.body_style || 'Unknown') || 'Unknown' },
      { group: 'price_band', key: toPriceBand(row.price) }
    ];
    for (const item of candidates) {
      const mapKey = `${item.group}:${item.key}`;
      const entry = bucket.get(mapKey) || { group: item.group, key: item.key, listings: 0, views: 0, messages: 0, weak: 0 };
      entry.listings += 1;
      entry.views += safeNumber(row.views_count, 0);
      entry.messages += safeNumber(row.messages_count, 0);
      if (row.weak) entry.weak += 1;
      bucket.set(mapKey, entry);
    }
  }
  const values = [...bucket.values()].map((item) => ({ ...item, conversion_rate: item.views ? Number(((item.messages / item.views) * 100).toFixed(1)) : 0 }));
  return {
    top_segments: values.sort((a,b) => (b.messages * 1000 + b.views * 10 + b.listings) - (a.messages * 1000 + a.views * 10 + a.listings)).slice(0, 6),
    weak_segments: values.sort((a,b) => (b.weak - a.weak) || (a.conversion_rate - b.conversion_rate)).slice(0, 6),
    opportunities: values.filter((item) => item.views >= 10 && item.messages === 0).slice(0, 6)
  };
}
function buildManagerRecommendations(summary, segmentIntel) {
  const recommendations = [];
  if (summary.action_center.review_today > 0) recommendations.push(`Review ${summary.action_center.review_today} listing${summary.action_center.review_today === 1 ? '' : 's'} currently in queue.`);
  if (summary.action_center.promote_today > 0) recommendations.push(`Promote ${summary.action_center.promote_today} high-performing listing${summary.action_center.promote_today === 1 ? '' : 's'} to maximize traction.`);
  if (summary.action_center.repost_today > 0) recommendations.push(`Repost ${summary.action_center.repost_today} low-visibility listing${summary.action_center.repost_today === 1 ? '' : 's'} today.`);
  if (summary.weak_listings > 0) recommendations.push(`Refresh content or pricing on ${summary.weak_listings} weak listing${summary.weak_listings === 1 ? '' : 's'}.`);
  const weakSeg = segmentIntel.weak_segments?.[0];
  if (weakSeg) recommendations.push(`Watch ${weakSeg.key} (${weakSeg.group.replace('_',' ')}) — this segment has the highest weak-listing concentration.`);
  return recommendations.length ? recommendations : ['Portfolio looks healthy today. Keep strong listings live and monitor momentum.'];
}


function buildPlanAccess(accessState = {}) {
  const planLabel = clean(accessState.plan || 'Founder Beta') || 'Founder Beta';
  const normalized = planLabel.toLowerCase();
  const isPro = normalized.includes('pro');
  const isFounder = normalized.includes('founder') || normalized.includes('beta');
  return {
    plan_label: planLabel,
    plan_key: isPro ? (isFounder ? 'founder_pro' : 'pro') : (isFounder ? 'founder_beta' : 'starter'),
    is_pro: isPro,
    is_founder: isFounder,
    posting_limit: safeNumber(accessState.posting_limit, isPro ? 25 : 5),
    advanced_analytics: isPro,
    revenue_intelligence: isPro,
    advanced_action_center: isPro,
    premium_tools: isPro,
    crm: isPro,
    automation: isPro,
    mass_sms: isPro,
    scheduler: isPro,
    market_intelligence: isPro,
    ai_content: isPro || isFounder,
    founder_badge: isFounder,
    upgrade_target: isPro ? 'Maintain Pro Momentum' : (isFounder ? 'Founder Pro' : 'Pro')
  };
}

function buildMonetizationLayer({ planAccess = {}, accessState = {}, queueCount = 0, needsActionCount = 0, reviewQueueCount = 0, staleListings = 0, postsRemaining = 0, usageToday = 0, totalViews = 0, totalMessages = 0 } = {}) {
  const lockedModules = [
    {
      key: 'revenue_intelligence',
      title: 'Revenue Intelligence',
      placement: 'analytics',
      required_plan: 'Pro',
      unlocked: Boolean(planAccess.revenue_intelligence),
      teaser: 'See deeper priority scoring, opportunity estimates, and price-review pressure.',
      reason: 'Unlock deeper monetization signals and stronger operator guidance.'
    },
    {
      key: 'crm',
      title: 'CRM',
      placement: 'tools',
      required_plan: 'Pro',
      unlocked: Boolean(planAccess.crm),
      teaser: 'Track lead memory, follow-up stages, and customer movement in one place.',
      reason: 'Keep pipeline follow-up attached to inventory activity.'
    },
    {
      key: 'automation',
      title: 'Automation',
      placement: 'tools',
      required_plan: 'Pro',
      unlocked: Boolean(planAccess.automation),
      teaser: 'Automate reminders, stale listing actions, and follow-up execution.',
      reason: 'Remove manual admin work from the daily workflow.'
    },
    {
      key: 'mass_sms',
      title: 'Mass SMS',
      placement: 'tools',
      required_plan: 'Pro',
      unlocked: Boolean(planAccess.mass_sms),
      teaser: 'Push inventory, appointment, and reactivation campaigns to your audience fast.',
      reason: 'Scale outbound volume without leaving the platform.'
    },
    {
      key: 'scheduler',
      title: 'Scheduler',
      placement: 'tools',
      required_plan: 'Pro',
      unlocked: Boolean(planAccess.scheduler),
      teaser: 'Control bookings, timing windows, and workflow cadence from one place.',
      reason: 'Keep scheduling and execution in the same operating layer.'
    },
    {
      key: 'market_intelligence',
      title: 'Market Intelligence',
      placement: 'tools',
      required_plan: 'Pro',
      unlocked: Boolean(planAccess.market_intelligence),
      teaser: 'See stronger pricing, listing priority, and inventory feedback loops.',
      reason: 'Turn platform data into market-aware action recommendations.'
    }
  ];

  const upgradeReasons = [];
  if (!planAccess.is_pro && postsRemaining <= 1 && queueCount >= 3) upgradeReasons.push(`You have ${queueCount} queued vehicles with only ${postsRemaining} post${postsRemaining === 1 ? '' : 's'} left today.`);
  if (!planAccess.is_pro && needsActionCount >= 3) upgradeReasons.push(`There are ${needsActionCount} listings needing action that would benefit from deeper prioritization.`);
  if (!planAccess.is_pro && reviewQueueCount >= 2) upgradeReasons.push(`You have ${reviewQueueCount} items in review queue where stronger workflow controls would help.`);
  if (!planAccess.is_pro && staleListings >= 2) upgradeReasons.push(`There are ${staleListings} stale listings that could use automation and deeper intelligence.`);
  if (!planAccess.is_pro && totalViews >= 25 && totalMessages <= 1) upgradeReasons.push('Traffic is building, but conversion pressure suggests pricing and workflow leverage could help.');
  if (!upgradeReasons.length) {
    upgradeReasons.push(planAccess.is_pro
      ? 'Pro access is active. Keep leaning into advanced tools and deeper analytics.'
      : 'Upgrade when you want more capacity, stronger analytics, and premium workflow tools.');
  }

  const upgradePrompts = [];
  if (!planAccess.is_pro && postsRemaining <= 1) {
    upgradePrompts.push({
      id: 'posting_limit',
      placement: 'overview',
      tone: 'high',
      title: 'Increase Daily Output',
      copy: `You are near today's posting ceiling. ${planAccess.upgrade_target} unlocks 25 posts/day and more room to work the queue.`,
      cta_label: `Unlock ${planAccess.upgrade_target}`,
      trigger: 'posting_limit'
    });
  }
  if (!planAccess.is_pro && (needsActionCount >= 2 || reviewQueueCount >= 2 || staleListings >= 2)) {
    upgradePrompts.push({
      id: 'analytics_depth',
      placement: 'analytics',
      tone: 'medium',
      title: 'Unlock Deeper Opportunity Signals',
      copy: 'Advanced analytics adds stronger priority scoring, opportunity pressure, and clearer next actions.',
      cta_label: `See ${planAccess.upgrade_target}`,
      trigger: 'analytics_depth'
    });
  }
  if (!planAccess.is_pro) {
    upgradePrompts.push({
      id: 'premium_tools',
      placement: 'tools',
      tone: 'medium',
      title: 'Premium Tools Expand the Workflow',
      copy: 'CRM, Automation, Mass SMS, Scheduler, and Market Intelligence stay visible so you can grow into them when ready.',
      cta_label: `Upgrade to ${planAccess.upgrade_target}`,
      trigger: 'premium_tools'
    });
  }

  const premiumPreview = {
    headline: planAccess.is_pro ? 'Pro Access Is Live' : `${planAccess.upgrade_target} unlocks deeper leverage`,
    subheadline: planAccess.is_pro
      ? 'Keep leaning into the advanced layer: richer analytics, stronger actioning, and premium workflow tools.'
      : 'Upgrade to move from basic visibility into deeper operator guidance, stronger analytics, and premium tools.',
    bullets: planAccess.is_pro
      ? [
          '25 posts/day capacity',
          'Deeper revenue and opportunity analytics',
          'Premium tools as they roll out inside the dashboard'
        ]
      : [
          '25 posts/day instead of 5',
          'Advanced analytics and revenue intelligence',
          'CRM, Automation, Mass SMS, Scheduler, and Market Intelligence visibility'
        ],
    cta_label: planAccess.is_pro ? 'Open Billing & Access' : `Upgrade to ${planAccess.upgrade_target}`,
    cta_target: 'billing'
  };

  return { lockedModules, upgradeReasons, upgradePrompts, premiumPreview };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const verifiedUser = await getVerifiedRequestUser(req);
    const requestUserId = clean(verifiedUser?.id || req.query?.userId || req.query?.user_id || '');
    const requestEmail = normalizeEmail(verifiedUser?.email || req.query?.email || '');
    const user = await resolveUser({ userId: requestUserId, email: requestEmail });
    const finalUserId = clean(user?.id || requestUserId || '');
    const finalEmail = normalizeEmail(user?.email || requestEmail || '');
    if (!finalUserId && !finalEmail) return res.status(400).json({ error: 'Missing userId or email' });

    const [subscriptionRow, postingUsageRow, profileRow, rows] = await Promise.all([
      getSubscription(finalUserId, finalEmail),
      getPostingUsageRow(finalUserId, finalEmail),
      getProfileRow(finalUserId, finalEmail),
      getListingRows(finalUserId, finalEmail)
    ]);
    const computed = buildComputedSummary(rows);
    const snapshot = subscriptionRow?.account_snapshot && typeof subscriptionRow.account_snapshot === 'object' ? subscriptionRow.account_snapshot : {};
    const planValue = clean(subscriptionRow?.plan_type || subscriptionRow?.plan_name || subscriptionRow?.plan || user?.plan || user?.user_type || 'Founder Beta');
    const forcedAccess = hasTestingLimitOverride(finalEmail);
    const configuredLimit = safeNumber(snapshot.posting_limit ?? subscriptionRow?.daily_posting_limit ?? subscriptionRow?.posting_limit ?? inferPostingLimitFromPlan(planValue), inferPostingLimitFromPlan(planValue));
    const dailyLimit = forcedAccess ? 25 : configuredLimit;
    const usageToday = Math.max(safeNumber(postingUsageRow?.posts_today ?? postingUsageRow?.posts_used ?? postingUsageRow?.used_today, 0), safeNumber(snapshot.posts_today ?? snapshot.posts_used_today, 0), safeNumber(computed.posts_today, 0));
    const postsRemainingBase = Math.max(dailyLimit - usageToday, 0);
    const accessGranted = Boolean(forcedAccess || snapshot.access_granted === true || snapshot.active === true || subscriptionRow?.active === true || isActiveStatus(subscriptionRow?.status) || (clean(planValue) && dailyLimit > 0));
    const effectiveStatus = accessGranted ? 'active' : clean(subscriptionRow?.status || snapshot.status || 'inactive').toLowerCase();
    const profileSnapshot = buildProfileSnapshot(user, profileRow, snapshot);
    const setupStatus = buildSetupStatus(user, profileSnapshot);
    const creditEconomy = await getCreditEconomyState(supabase, { userId: finalUserId, email: finalEmail, dateKey: today });
    const creditsSummary = creditEconomy.summary || await getCreditSummary(supabase, { userId: finalUserId, email: finalEmail });
    const recentCreditEventsRaw = await listRecentCreditEvents(supabase, { userId: finalUserId, email: finalEmail, limit: 6 });
    const recentCreditEvents = recentCreditEventsRaw.map((event) => ({
      type: event.type,
      label: formatCreditEventLabel(event.type),
      amount: safeNumber(event.amount, 0),
      created_at: event.created_at,
      meta: event.meta || {},
      dedupe_key: event.dedupe_key || ''
    }));
    const segmentIntel = buildSegmentPerformance(rows);
    const alerts = buildAlerts({ ...computed, total_views: computed.total_views, total_messages: computed.total_messages });
    const scorecards = buildScorecards(computed, rows);
    const referralCode = clean(snapshot.referral_code || subscriptionRow?.referral_code || user?.referral_code || '');
    const affiliate = await getAffiliateSummary({ referralCode, email: finalEmail });
    const managerAccess = Boolean(snapshot.organization_role === 'admin' || snapshot.organization_role === 'manager' || snapshot.team_access === true || clean(snapshot.plan_type).toLowerCase() === 'team' || clean(snapshot.plan_type).toLowerCase() === 'dealership');
    const managerSummary = {
      live_inventory: computed.active_listings,
      avg_views_per_live: computed.active_listings ? Number((computed.total_views / computed.active_listings).toFixed(1)) : 0,
      avg_messages_per_live: computed.active_listings ? Number((computed.total_messages / computed.active_listings).toFixed(1)) : 0,
      view_to_message_rate: computed.total_views ? Number(((computed.total_messages / computed.total_views) * 100).toFixed(1)) : 0,
      stale_rate: computed.total_listings ? Number(((computed.stale_listings / computed.total_listings) * 100).toFixed(1)) : 0,
      weak_rate: computed.total_listings ? Number(((computed.weak_listings / computed.total_listings) * 100).toFixed(1)) : 0,
      weak_listings: computed.weak_listings,
      needs_action: computed.needs_action_count
    };
    const creditExtraPostsToday = safeNumber(creditEconomy?.extra_posts_unlocked_today, 0);
    const accessState = resolveAccountAccess({
      plan: planValue,
      status: effectiveStatus,
      postsToday: usageToday,
      postingLimit: dailyLimit,
      creditExtraPosts: creditExtraPostsToday,
      email: finalEmail,
      stripeCustomerId: snapshot.stripe_customer_id || subscriptionRow?.stripe_customer_id || '',
      currentPeriodEnd: subscriptionRow?.current_period_end || snapshot.current_period_end || null,
      cancelAtPeriodEnd: Boolean(subscriptionRow?.cancel_at_period_end || snapshot.cancel_at_period_end),
      minimumVersion: snapshot.minimum_version || '',
      latestVersion: snapshot.latest_version || '',
      extensionVersion: snapshot.extension_version || ''
    });
    const postsRemaining = Math.max(safeNumber(accessState.posting_limit, dailyLimit) - usageToday, 0);
    const activationSteps = {
      profile_complete: Boolean(setupStatus.profile_complete),
      compliance_ready: Boolean(setupStatus.compliance_mode_present),
      extension_connected: accessState.active,
      first_post: usageToday > 0,
      first_sync: rows.length > 0,
      first_message: computed.total_messages > 0,
      review_center_used: computed.review_queue_count > 0 || computed.needs_action_count > 0
    };
    const activationCompleted = Object.values(activationSteps).filter(Boolean).length;
    const activationTotal = Object.keys(activationSteps).length;
    const setupBlockers = [];
    if (!setupStatus.inventory_url_present) setupBlockers.push('Add inventory URL');
    if (!setupStatus.salesperson_name_present) setupBlockers.push('Complete salesperson profile');
    if (!setupStatus.dealership_name_present) setupBlockers.push('Add dealership name');
    if (!setupStatus.compliance_mode_present) setupBlockers.push('Set compliance mode');
    if (!accessState.active) setupBlockers.push('Fix access or billing');
    const nextBestActions = [
      computed.review_queue_count > 0 ? `Review ${computed.review_queue_count} listing${computed.review_queue_count === 1 ? '' : 's'} in queue.` : '',
      computed.needs_action_count > 0 ? `Work ${computed.needs_action_count} listing${computed.needs_action_count === 1 ? '' : 's'} marked needs action.` : '',
      usageToday === 0 ? 'Get the first post live today to trigger your first win.' : '',
      !setupStatus.profile_complete ? 'Finish setup fields so the extension can post with cleaner output.' : ''
    ].filter(Boolean).slice(0, 4);
    const listingActionSummary = {
      do_now: rows.filter((row) => safeNumber(row.price_review_priority, 0) >= 60 || safeNumber(row.refresh_priority, 0) >= 60 || String(row.action_bucket || '') === 'do_now').length,
      do_today: rows.filter((row) => String(row.action_bucket || '') === 'do_today').length,
      watch: rows.filter((row) => String(row.action_bucket || '') === 'watch').length,
      low_priority: rows.filter((row) => !String(row.action_bucket || '') || String(row.action_bucket || '') === 'low_priority').length
    };
    const opportunitySignals = [
      computed.action_center.promote_today > 0 ? `${computed.action_center.promote_today} strong listing${computed.action_center.promote_today === 1 ? '' : 's'} are ready to promote.` : '',
      computed.action_center.repost_today > 0 ? `${computed.action_center.repost_today} listing${computed.action_center.repost_today === 1 ? '' : 's'} should be refreshed today.` : '',
      computed.total_views > 0 && computed.total_messages === 0 ? 'Views are coming in without messages. Review pricing and copy.' : '',
      computed.weak_listings > 0 ? `${computed.weak_listings} weak listing${computed.weak_listings === 1 ? '' : 's'} are dragging portfolio quality.` : ''
    ].filter(Boolean);
    const growthActions = {
      invite_teammate: 'I am using Elevate to post inventory faster and keep listings cleaner. Want me to send you the dashboard invite?',
      invite_manager: 'We are using Elevate to speed up Marketplace posting and surface which listings need attention. Want the dealership view?',
      affiliate_pitch_short: 'Elevate helps reps post faster, clean up weak listings, and see where opportunity is sitting inside inventory.',
      affiliate_pitch_operator: 'This is not just a posting tool. It is an operator dashboard for listings, compliance, and daily action priorities.',
      dealer_invite_pitch: 'If your team is posting inventory manually, Elevate gives them speed on day one and gives managers cleaner visibility.'
    };
    const revenueIntelligence = {
      time_saved_today_minutes: usageToday * 18,
      time_saved_week_minutes: Math.max(safeNumber(scorecards?.weekly?.posts_7d, usageToday) * 18, usageToday * 18),
      missed_opportunity_estimate: computed.needs_action_count + computed.weak_listings,
      weak_conversion_listings: computed.weak_listings,
      refresh_candidates: computed.action_center.repost_today,
      price_review_candidates: computed.review_price_change_count
    };
    const actionCenterDetails = buildActionCenterDetails(rows);
    const planAccess = buildPlanAccess(accessState);
    const monetization = buildMonetizationLayer({
      planAccess,
      accessState,
      queueCount: safeNumber(snapshot.queue_count, 0),
      needsActionCount: computed.needs_action_count,
      reviewQueueCount: computed.review_queue_count,
      staleListings: computed.stale_listings,
      postsRemaining,
      usageToday,
      totalViews: computed.total_views,
      totalMessages: computed.total_messages
    });

    const recentListings = rows.slice(0, 12).map((row) => ({
      id: row.id,
      title: row.title,
      image_url: row.image_url || '',
      price: safeNumber(row.price, 0),
      mileage: safeNumber(row.mileage, 0),
      status: row.status || 'active',
      lifecycle_status: row.lifecycle_status || '',
      posted_at: row.posted_at || row.created_at,
      views_count: safeNumber(row.views_count, 0),
      messages_count: safeNumber(row.messages_count, 0),
      review_bucket: row.review_bucket || '',
      source_url: row.source_url || '',
      stock_number: row.stock_number || '',
      vin: row.vin || '',
      body_style: row.body_style || '',
      exterior_color: row.exterior_color || '',
      fuel_type: row.fuel_type || '',
      make: row.make || '',
      model: row.model || '',
      trim: row.trim || '',
      health_score: safeNumber(row.health_score, 0),
      health_label: row.health_label || '',
      age_days: safeNumber(row.age_days, 0),
      recommended_action: row.recommended_action || '',
      predicted_score: safeNumber(row.predicted_score, 0),
      predicted_label: row.predicted_label || '',
      pricing_insight: row.pricing_insight || '',
      content_score: safeNumber(row.content_score, 0),
      content_feedback: row.content_feedback || '',
      popularity_score: safeNumber(row.popularity_score, 0),
      weak: Boolean(row.weak),
      needs_action: Boolean(row.needs_action),
      promote_now: Boolean(row.promote_now),
      likely_sold: Boolean(row.likely_sold),
      post_priority: safeNumber(row.post_priority, 0),
      refresh_priority: safeNumber(row.refresh_priority, 0),
      price_review_priority: safeNumber(row.price_review_priority, 0),
      opportunity_score: safeNumber(row.opportunity_score, 0),
      action_bucket: row.action_bucket || 'low_priority',
      action_bucket_label: row.action_bucket_label || 'Low Priority'
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
        queue_count: safeNumber(snapshot.queue_count, 0),
        lifecycle_updated_at: clean(snapshot.lifecycle_updated_at || ''),
        top_listing_title: clean(computed.top_listing_title || 'None yet'),
        total_listings: computed.total_listings,
        recent_listings: recentListings,
        daily_limit: dailyLimit,
        extra_posts_unlocked_today: creditExtraPostsToday,
        effective_posting_limit: safeNumber(accessState.posting_limit, dailyLimit),
        posts_remaining: postsRemaining,
        can_post: Boolean(accessState.can_post),
        alerts,
        scorecards,
        intelligence: segmentIntel,
        affiliate,
        daily_ops_queues: computed.action_center,
        manager_access: managerAccess,
        manager_summary: managerSummary,
        segment_performance: segmentIntel.top_segments,
        manager_recommendations: buildManagerRecommendations(computed, segmentIntel),
        ingest_debug: {
          posting_usage_row_found: Boolean(postingUsageRow),
          posting_usage_row_id: clean(postingUsageRow?.id || ''),
          posting_usage_updated_at: clean(postingUsageRow?.updated_at || postingUsageRow?.created_at || ''),
          posting_usage_email: clean(postingUsageRow?.email || ''),
          posting_usage_user_id: clean(postingUsageRow?.user_id || ''),
          posting_usage_date_key: clean(postingUsageRow?.date_key || postingUsageRow?.date || ''),
          listing_rows_found: rows.length,
          subscription_snapshot_posts_today: safeNumber(snapshot.posts_today ?? snapshot.posts_used_today, 0),
          usage_today_row: safeNumber(postingUsageRow?.posts_today ?? postingUsageRow?.posts_used ?? postingUsageRow?.used_today, 0),
          usage_today_computed: safeNumber(computed.posts_today, 0),
          testing_limit_override: forcedAccess
        },
        listing_data_state: {
          direct_rows_found: rows.length,
          preview_rows_found: recentListings.length,
          snapshot_active_listings: safeNumber(snapshot.active_listings ?? computed.active_listings, 0),
          lifecycle_updated_at: clean(snapshot.lifecycle_updated_at || ''),
          sources: {
            user_listings: userListingRows.length,
            listings: legacyListingRows.length,
            merged: rows.length
          }
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
          base_posting_limit: safeNumber(accessState.base_posting_limit, dailyLimit),
          extra_posting_limit: safeNumber(accessState.extra_posting_limit, 0),
          posts_used_today: usageToday,
          posts_today: usageToday,
          posts_remaining: postsRemaining,
          can_post: Boolean(accessState.can_post),
          billing: accessState.billing,
          current_period_end: subscriptionRow?.current_period_end || null,
          trial_end: subscriptionRow?.trial_end || null,
          cancel_at_period_end: Boolean(subscriptionRow?.cancel_at_period_end),
          ...profileSnapshot
        },
        profile_snapshot: profileSnapshot,
        roi_snapshot: {
          estimated_minutes_saved_today: usageToday * 18,
          estimated_minutes_saved_week: Math.max(safeNumber(scorecards?.weekly?.posts_7d, usageToday) * 18, usageToday * 18),
          estimated_manual_posts_avoided: usageToday,
          estimated_value_saved: Number((((usageToday * 18) / 60) * 30).toFixed(2))
        },
        credits: {
          balance: safeNumber(creditsSummary.balance, 0),
          lifetime_earned: safeNumber(creditsSummary.lifetime_earned, 0),
          lifetime_spent: safeNumber(creditsSummary.lifetime_spent, 0),
          recent_earned: safeNumber(creditsSummary.recent_earned, 0),
          updated_at: creditsSummary.updated_at || null,
          schema_ready: Boolean(creditsSummary.schema_ready),
          extra_posts_unlocked_today: creditExtraPostsToday,
          actions: Array.isArray(creditEconomy?.actions) ? creditEconomy.actions : [],
          recent_events: recentCreditEvents
        },
        activation: {
          score: Math.round((activationCompleted / Math.max(activationTotal, 1)) * 100),
          percent: Math.round((activationCompleted / Math.max(activationTotal, 1)) * 100),
          completed_steps: activationCompleted,
          total_steps: activationTotal,
          steps: activationSteps,
          first_win_complete: activationSteps.first_post && activationSteps.first_sync,
          blocked_by: setupBlockers,
          next_best_actions: nextBestActions
        },
        first_win: {
          has_first_post: usageToday > 0,
          has_first_sync: rows.length > 0,
          has_first_message: computed.total_messages > 0,
          milestone_text: usageToday > 0 ? 'First posting motion is live. Keep stacking inventory and review actions.' : 'Post your first vehicle to unlock immediate day-one value.'
        },
        growth_actions: growthActions,
        setup_blockers: setupBlockers,
        setup_recommendations: nextBestActions,
        revenue_intelligence: revenueIntelligence,
        listing_action_summary: listingActionSummary,
        opportunity_signals: opportunitySignals,
        plan_access: planAccess,
        locked_modules: monetization.lockedModules,
        upgrade_reasons: monetization.upgradeReasons,
        upgrade_prompts: monetization.upgradePrompts,
        premium_preview: monetization.premiumPreview,
        priority_actions: actionCenterDetails,
        setup_status: setupStatus,
        data_integrity: {
          listing_rows_merged: rows.length,
          listing_sources: rows.reduce((acc, row) => { const k = clean(row.source_table || 'unknown'); acc[k] = safeNumber(acc[k], 0) + 1; return acc; }, {}),
          posting_usage_source: postingUsageRow ? 'posting_usage' : 'computed_from_listings',
          summary_source: 'merged_listings_plus_posting_usage'
        }
      }
    });
  } catch (error) {
    console.error('get-dashboard-summary fatal error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
