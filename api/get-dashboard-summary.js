
import { createClient } from "@supabase/supabase-js";

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
    popularity_score: messages * 1000 + views * 10 + (postedTs / 100000000)
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
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  if (email) {
    const { data, error } = await supabase.from('profiles').select('*').ilike('email', email).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data;
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
async function getAffiliateSummary({ referralCode, referralSource, email }) {
  const code = clean(referralCode || '');
  const ownerSource = clean(referralSource || '');
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
  const sourceCounts = new Map();

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
    const source = clean(snapshot.referral_source || row?.referral_source || ownerSource || 'link');
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    recent.push({
      name: clean(snapshot.full_name || row?.email || '').split('@')[0],
      email: normalizeEmail(row?.email || ''),
      plan,
      status: isActive ? 'paying' : 'signed_up',
      created_at: row?.created_at || '',
      estimated_commission: Math.round(estimatedCommission * 100) / 100,
      source
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
function buildSetupStatus(user, profileRow) {
  const inventoryUrl = clean(profileRow?.inventory_url || '');
  const salespersonName = clean(profileRow?.full_name || `${clean(user?.first_name)} ${clean(user?.last_name)}`.trim());
  const dealershipName = clean(profileRow?.dealership || profileRow?.dealer_name || user?.company || '');
  const complianceMode = clean(profileRow?.compliance_mode || '');
  const checks = {
    inventory_url_present: Boolean(inventoryUrl),
    salesperson_name_present: Boolean(salespersonName),
    dealership_name_present: Boolean(dealershipName),
    compliance_mode_present: Boolean(complianceMode)
  };
  const completion = Object.values(checks).filter(Boolean).length;
  return { profile_complete: completion === 4, profile_completion_score: completion / 4, inventory_url: inventoryUrl, salesperson_name: salespersonName, dealership_name: dealershipName, compliance_mode: complianceMode, ...checks };
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

function buildFirstWin(summary) {
  const postsToday = safeNumber(summary.posts_today, 0);
  const totalViews = safeNumber(summary.total_views, 0);
  const totalMessages = safeNumber(summary.total_messages, 0);
  const activeListings = safeNumber(summary.active_listings, 0);
  const reviewToday = safeNumber(summary.action_center?.review_today, 0);
  const promoteToday = safeNumber(summary.action_center?.promote_today, 0);

  let stage = 'setup';
  let title = 'Start your first win';
  let message = 'Complete setup and publish your first listing so the platform can start generating traction.';
  let nextAction = 'Complete profile setup and post your first listing.';
  let momentum = 5;
  let show = true;

  if (postsToday > 0 || activeListings > 0) {
    stage = 'posted';
    title = 'You're live';
    message = `You have ${Math.max(postsToday, activeListings)} live posting signal${Math.max(postsToday, activeListings) === 1 ? '' : 's'} in the system. Keep momentum going.`;
    nextAction = totalViews > 0 ? 'Focus on converting views into your first message.' : 'Promote one live listing and open it to sync views.';
    momentum = 35;
  }

  if (totalViews > 0) {
    stage = 'views';
    title = 'Your listings are getting attention';
    message = `${totalViews} tracked view${totalViews === 1 ? '' : 's'} means buyers are seeing your inventory.`;
    nextAction = totalMessages > 0 ? 'Keep engaging and review what is already converting.' : 'Push one strong listing again to generate your first buyer message.';
    momentum = 65;
  }

  if (totalMessages > 0) {
    stage = 'message';
    title = 'You generated traction';
    message = `${totalMessages} buyer message${totalMessages === 1 ? '' : 's'} tracked so far. The engine is working.`;
    nextAction = reviewToday > 0 ? `Review ${reviewToday} listing${reviewToday === 1 ? '' : 's'} next.` : (promoteToday > 0 ? `Promote ${promoteToday} high-performing listing${promoteToday === 1 ? '' : 's'} next.` : 'Keep posting consistently and reinforce top-performing listings.');
    momentum = 100;
  }

  return {
    show,
    stage,
    title,
    message,
    next_action: nextAction,
    momentum_score: momentum,
    posts_today: postsToday,
    total_views: totalViews,
    total_messages: totalMessages
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
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const userId = clean(req.query?.userId || req.query?.user_id || '');
    const email = normalizeEmail(req.query?.email || '');
    const user = await resolveUser({ userId, email });
    const finalUserId = clean(user?.id || userId || '');
    const finalEmail = normalizeEmail(user?.email || email || '');
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
    const postsRemaining = Math.max(dailyLimit - usageToday, 0);
    const accessGranted = Boolean(forcedAccess || snapshot.access_granted === true || snapshot.active === true || subscriptionRow?.active === true || isActiveStatus(subscriptionRow?.status) || (clean(planValue) && dailyLimit > 0));
    const effectiveStatus = accessGranted ? 'active' : clean(subscriptionRow?.status || snapshot.status || 'inactive').toLowerCase();
    const setupStatus = buildSetupStatus(user, profileRow);
    const segmentIntel = buildSegmentPerformance(rows);
    const alerts = buildAlerts({ ...computed, total_views: computed.total_views, total_messages: computed.total_messages });
    const scorecards = buildScorecards(computed, rows);
    const referralCode = clean(snapshot.referral_code || subscriptionRow?.referral_code || user?.referral_code || '');
    const affiliate = await getAffiliateSummary({ referralCode, email: finalEmail });
    const firstWin = buildFirstWin({ ...computed, total_views: computed.total_views, total_messages: computed.total_messages });
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
      likely_sold: Boolean(row.likely_sold)
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
        queue_count: safeNumber(snapshot.queue_count, 0),
        lifecycle_updated_at: clean(snapshot.lifecycle_updated_at || ''),
        top_listing_title: clean(computed.top_listing_title || 'None yet'),
        total_listings: computed.total_listings,
        recent_listings: recentListings,
        daily_limit: dailyLimit,
        posts_remaining: postsRemaining,
        alerts,
        scorecards,
        intelligence: segmentIntel,
        affiliate,
        first_win: firstWin,
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
        account_snapshot: {
          ...(snapshot || {}),
          user_id: finalUserId,
          email: finalEmail,
          plan: planValue,
          status: effectiveStatus,
          active: accessGranted,
          access_granted: accessGranted,
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
