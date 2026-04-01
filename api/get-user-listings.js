import { createClient } from "@supabase/supabase-js";
import { getVerifiedRequestUser } from "./_shared/auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function normalizeEmail(value) { return clean(value).toLowerCase(); }
function safeNumber(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function normalizeStatus(value) { const status = clean(value).toLowerCase(); if (["sold","deleted","inactive","failed","stale"].includes(status)) return status; if (["posted","active","live","approved","relisted","promote_now"].includes(status)) return "active"; return status || "active"; }
function normalizeReviewBucket(value) { const bucket = clean(value).toLowerCase().replace(/[\s_-]+/g, ""); if (!bucket) return ""; if (["removedvehicles","removed","reviewdelete"].includes(bucket)) return "removedvehicles"; if (["pricechanges","pricechange","reviewpriceupdate"].includes(bucket)) return "pricechanges"; if (["newvehicles","new","reviewnew"].includes(bucket)) return "newvehicles"; return bucket; }
function normalizeLifecycleStatus(value, reviewBucket = "") { const status = clean(value).toLowerCase(); const review = normalizeReviewBucket(reviewBucket); if (status) return status; if (review === "removedvehicles") return "review_delete"; if (review === "pricechanges") return "review_price_update"; if (review === "newvehicles") return "review_new"; return "active"; }
function listingIdentityKey(row) { const marketplace = clean(row.marketplace_listing_id || "").toUpperCase(); if (marketplace) return `MARKETPLACE:${marketplace}`; const vin = clean(row.vin || "").toUpperCase(); if (vin) return `VIN:${vin}`; const stock = clean(row.stock_number || "").toUpperCase(); if (stock) return `STOCK:${stock}`; const source = clean(row.source_url || "").toLowerCase(); if (source) return `URL:${source}`; const id = clean(row.id || ""); if (id) return `ID:${id}`; return [clean(row.year), clean(row.make), clean(row.model), String(row.price || ""), String(row.mileage || "")].filter(Boolean).join("|"); }
function buildListingIntelligence(row = {}) { const postedValue = row.posted_at || row.created_at || row.updated_at || null; const postedTs = postedValue ? new Date(postedValue).getTime() : 0; const ageDays = postedTs > 0 ? Math.max(0, Math.floor((Date.now() - postedTs) / 86400000)) : 0; const views = safeNumber(row.views_count, 0); const messages = safeNumber(row.messages_count, 0); const status = normalizeStatus(row.status); const lifecycle = normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket); const reviewBucket = normalizeReviewBucket(row.review_bucket); const staleLike = status === "stale" || lifecycle === "stale" || lifecycle === "review_delete" || reviewBucket === "removedvehicles"; const likelySold = lifecycle === "review_delete" || reviewBucket === "removedvehicles"; const activeLike = !["sold","deleted","inactive"].includes(status) && lifecycle !== "review_delete"; const highViewsNoMessages = activeLike && views >= 20 && messages === 0; const promoteNow = activeLike && views >= 20 && messages >= 1; const lowPerformance = activeLike && ageDays >= 7 && views < 5 && messages === 0; const weak = staleLike || lowPerformance; const needsAction = weak || highViewsNoMessages || lifecycle === "review_price_update" || reviewBucket === "pricechanges"; let recommendedAction = "Keep live"; if (likelySold) recommendedAction = "Check if sold or stale"; else if (lifecycle === "review_price_update" || reviewBucket === "pricechanges" || highViewsNoMessages) recommendedAction = "Review price"; else if (lifecycle === "review_new" || reviewBucket === "newvehicles") recommendedAction = "Review new listing"; else if (lowPerformance) recommendedAction = "Refresh title/photos"; else if (promoteNow) recommendedAction = "Promote now"; let predictedScore = 50; predictedScore += Math.min(views, 25); predictedScore += Math.min(messages * 18, 36); predictedScore -= Math.min(ageDays * 3, 24); if (highViewsNoMessages) predictedScore -= 8; if (weak) predictedScore -= 20; predictedScore = Math.max(0, Math.min(100, Math.round(predictedScore))); let contentScore = 60; if (clean(row.title).length >= 18) contentScore += 10; if (clean(row.stock_number)) contentScore += 5; if (clean(row.vin)) contentScore += 5; if (clean(row.exterior_color)) contentScore += 5; if (clean(row.body_style)) contentScore += 5; if (clean(row.fuel_type)) contentScore += 5; if (ageDays >= 7 && views < 5) contentScore -= 10; contentScore = Math.max(0, Math.min(100, Math.round(contentScore))); let postPriority = 35; if (!postedValue) postPriority += 28; if (lifecycle === "review_new" || reviewBucket === "newvehicles") postPriority += 24; if (views === 0 && messages === 0 && ageDays <= 2) postPriority += 12; postPriority = Math.max(0, Math.min(100, Math.round(postPriority))); let refreshPriority = 10; if (staleLike) refreshPriority += 45; if (lowPerformance) refreshPriority += 22; if (ageDays >= 7 && views < 8) refreshPriority += 14; if (messages > 0) refreshPriority -= 10; refreshPriority = Math.max(0, Math.min(100, Math.round(refreshPriority))); let priceReviewPriority = 8; if (highViewsNoMessages || lifecycle === "review_price_update" || reviewBucket === "pricechanges") priceReviewPriority += 52; if (views >= 10 && messages === 0) priceReviewPriority += 12; priceReviewPriority = Math.max(0, Math.min(100, Math.round(priceReviewPriority))); let opportunityScore = Math.round((predictedScore * 0.45) + Math.min(views, 30) + Math.min(messages * 15, 30)); if (staleLike) opportunityScore -= 18; if (highViewsNoMessages) opportunityScore -= 10; opportunityScore = Math.max(0, Math.min(100, opportunityScore)); let actionBucket = "low_priority"; if (priceReviewPriority >= 60 || refreshPriority >= 60 || lifecycle.startsWith("review")) actionBucket = "do_now"; else if (postPriority >= 60 || promoteNow || needsAction) actionBucket = "do_today"; else if (weak || opportunityScore >= 60) actionBucket = "watch"; return { age_days: ageDays, likely_sold: likelySold, promote_now: promoteNow, weak, needs_action: needsAction, recommended_action: recommendedAction, predicted_score: predictedScore, predicted_label: predictedScore >= 75 ? "High Performer" : predictedScore >= 55 ? "Likely Performer" : predictedScore < 35 ? "Low Probability" : "Uncertain", pricing_insight: highViewsNoMessages ? "Price may be limiting message conversion." : messages >= 2 ? "Pricing appears competitive." : "Pricing signal still developing.", content_score: contentScore, content_feedback: contentScore >= 80 ? "Listing structure looks strong." : contentScore >= 65 ? "Content is workable but could be tightened." : "Listing likely needs a stronger title and better detail signals.", popularity_score: messages * 1000 + views * 10 + (postedTs / 100000000), post_priority: postPriority, refresh_priority: refreshPriority, price_review_priority: priceReviewPriority, opportunity_score: opportunityScore, action_bucket: actionBucket, action_bucket_label: actionBucket === "do_now" ? "Do Now" : actionBucket === "do_today" ? "Do Today" : actionBucket === "watch" ? "Watch" : "Low Priority" }; }
function normalizeListingRow(row = {}, source = "user_listings") { const normalized = { ...row, id: clean(row.id || ""), source_table: source, status: normalizeStatus(row.status), lifecycle_status: normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket), review_bucket: normalizeReviewBucket(row.review_bucket), identity_key: listingIdentityKey(row), title: clean(row.title || ""), posted_at: row.posted_at || row.created_at || null, updated_at: row.updated_at || row.created_at || null, views_count: safeNumber(row.views_count, 0), messages_count: safeNumber(row.messages_count, 0), price: safeNumber(row.price, 0), mileage: safeNumber(row.mileage || row.kilometers || row.km, 0), body_style: clean(row.body_style || ""), make: clean(row.make || ""), model: clean(row.model || ""), trim: clean(row.trim || "") }; return { ...normalized, ...buildListingIntelligence(normalized) }; }
function preferListingRow(current, incoming) { if (!current) return incoming; const currentScore = (current.source_table === "user_listings" ? 1000 : 0) + safeNumber(current.views_count) + safeNumber(current.messages_count) * 10 + new Date(current.updated_at || current.posted_at || 0).getTime() / 1000000000000; const incomingScore = (incoming.source_table === "user_listings" ? 1000 : 0) + safeNumber(incoming.views_count) + safeNumber(incoming.messages_count) * 10 + new Date(incoming.updated_at || incoming.posted_at || 0).getTime() / 1000000000000; return incomingScore >= currentScore ? { ...current, ...incoming } : { ...incoming, ...current }; }
async function resolveIdentityCandidates({ userId, email, authUid = "" }) {
  const userIds = new Set([clean(userId), clean(authUid)].filter(Boolean));
  const emails = new Set([normalizeEmail(email)].filter(Boolean));
  const matchedUsers = [];

  async function collectFromQuery(queryBuilder) {
    const { data, error } = await queryBuilder;
    if (error) throw error;
    for (const row of (Array.isArray(data) ? data : [])) {
      matchedUsers.push(row);
      if (clean(row?.id)) userIds.add(clean(row.id));
      if (clean(row?.auth_user_id)) userIds.add(clean(row.auth_user_id));
      if (normalizeEmail(row?.email)) emails.add(normalizeEmail(row.email));
    }
  }

  if (clean(userId) || clean(authUid)) {
    const ids = Array.from(new Set([clean(userId), clean(authUid)].filter(Boolean)));
    await collectFromQuery(
      supabase
        .from("users")
        .select("id,auth_user_id,email,created_at")
        .or(ids.map((id) => `id.eq.${id},auth_user_id.eq.${id}`).join(","))
        .order("created_at", { ascending: false })
        .limit(20)
    );
  }

  if (normalizeEmail(email)) {
    await collectFromQuery(
      supabase
        .from("users")
        .select("id,auth_user_id,email,created_at")
        .ilike("email", normalizeEmail(email))
        .order("created_at", { ascending: false })
        .limit(20)
    );
  }

  const primary = matchedUsers[0] || null;
  return {
    primary_user_id: clean(primary?.id || userId || authUid || ""),
    primary_email: normalizeEmail(primary?.email || email || ""),
    user_ids: Array.from(userIds),
    emails: Array.from(emails)
  };
}

async function fetchTableRows(tableName, userIds = [], emails = []) {
  const rows = [];
  const seen = new Set();

  async function pushRows(query) {
    const { data, error } = await query;
    if (error) throw error;
    for (const row of (Array.isArray(data) ? data : [])) {
      const key = clean(row?.id || "") || `${clean(row?.marketplace_listing_id || "")}|${clean(row?.posted_at || row?.created_at || "")}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }

  if (Array.isArray(userIds) && userIds.length) {
    await pushRows(
      supabase
        .from(tableName)
        .select("*")
        .in("user_id", userIds)
        .order("updated_at", { ascending: false })
        .limit(300)
    );
  }

  for (const email of (Array.isArray(emails) ? emails : []).filter(Boolean)) {
    await pushRows(
      supabase
        .from(tableName)
        .select("*")
        .ilike("email", email)
        .order("updated_at", { ascending: false })
        .limit(300)
    );
  }

  return rows;
}

async function backfillListingIdentity(tableName, rows = [], canonicalUserId = "", canonicalEmail = "") {
  const targetUserId = clean(canonicalUserId);
  const targetEmail = normalizeEmail(canonicalEmail);
  if (!targetUserId && !targetEmail) return { updated: 0 };

  let updated = 0;
  for (const row of rows) {
    const rowId = clean(row?.id || "");
    if (!rowId) continue;
    const nextUserId = targetUserId || clean(row?.user_id || "");
    const nextEmail = targetEmail || normalizeEmail(row?.email || "");
    const userMismatch = nextUserId && clean(row?.user_id || "") !== nextUserId;
    const emailMismatch = nextEmail && normalizeEmail(row?.email || "") !== nextEmail;
    if (!userMismatch && !emailMismatch) continue;

    const payload = {
      user_id: nextUserId || null,
      email: nextEmail || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from(tableName).update(payload).eq("id", rowId);
    if (!error) updated += 1;
  }
  return { updated };
}
function matchesFilter(row, { status, lifecycleStatus, reviewBucket, search, preset }) { const normalizedStatus = normalizeStatus(row.status); const normalizedLifecycle = normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket); const normalizedBucket = normalizeReviewBucket(row.review_bucket); if (status) { if (status === "review") { if (!["review_delete", "review_price_update", "review_new"].includes(normalizedLifecycle)) return false; } else if (normalizedStatus !== status) return false; } if (lifecycleStatus && normalizedLifecycle !== lifecycleStatus) return false; if (reviewBucket && normalizedBucket !== reviewBucket) return false; if (preset) { if (preset === "review" && !["review_delete", "review_price_update", "review_new"].includes(normalizedLifecycle)) return false; if (preset === "stale" && !(normalizedStatus === "stale" || normalizedLifecycle === "stale" || normalizedLifecycle === "review_delete")) return false; if (preset === "price" && normalizedLifecycle !== "review_price_update" && normalizedBucket !== "pricechanges") return false; if (preset === "new" && normalizedLifecycle !== "review_new" && normalizedBucket !== "newvehicles") return false; if (preset === "active" && ["sold", "deleted", "inactive", "stale"].includes(normalizedStatus)) return false; if (preset === "promote" && !row.promote_now) return false; if (preset === "likely_sold" && !row.likely_sold) return false; if (preset === "weak" && !row.weak) return false; if (preset === "needs_action" && !row.needs_action) return false; } if (search) { const haystack = [row.title, row.make, row.model, row.trim, row.vin, row.stock_number, row.body_style, row.vehicle_type, row.exterior_color, row.fuel_type, row.location, row.lifecycle_status, row.review_bucket, row.source_url, row.predicted_label, row.recommended_action, row.pricing_insight].map((value) => clean(value).toLowerCase()).join(" "); if (!haystack.includes(search)) return false; } return true; }
function sortRows(rows, sort) { const items = [...rows]; if (sort === "price_high") return items.sort((a, b) => safeNumber(b.price) - safeNumber(a.price)); if (sort === "price_low") return items.sort((a, b) => safeNumber(a.price) - safeNumber(b.price)); if (sort === "popular") return items.sort((a, b) => safeNumber(b.popularity_score) - safeNumber(a.popularity_score)); if (sort === "predicted") return items.sort((a, b) => safeNumber(b.predicted_score) - safeNumber(a.predicted_score)); return items.sort((a, b) => new Date(b.posted_at || b.updated_at || 0).getTime() - new Date(a.posted_at || a.updated_at || 0).getTime()); }

export default async function handler(req, res) { res.setHeader("Content-Type", "application/json"); if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" }); try { const verifiedUser = await getVerifiedRequestUser(req); if (!verifiedUser?.id || !verifiedUser?.email) return res.status(401).json({ error: "Unauthorized" }); const userId = clean(verifiedUser.id || req.query?.userId || req.query?.user_id || ""); const email = normalizeEmail(verifiedUser.email || req.query?.email || ""); const status = clean(req.query?.status || "").toLowerCase(); const preset = clean(req.query?.preset || "").toLowerCase(); const lifecycleStatus = clean(req.query?.lifecycle_status || req.query?.lifecycleStatus || "").toLowerCase(); const reviewBucket = normalizeReviewBucket(req.query?.review_bucket || req.query?.reviewBucket || ""); const search = clean(req.query?.search || "").toLowerCase(); const sort = clean(req.query?.sort || "newest").toLowerCase(); const limit = Math.min(Math.max(Number(req.query?.limit || 100), 1), 300); const identity = await resolveIdentityCandidates({ userId, email, authUid: clean(verifiedUser.id || "") }); const finalUserId = clean(identity.primary_user_id || userId || ""); const finalEmail = normalizeEmail(identity.primary_email || email || ""); if (!finalUserId && !finalEmail) return res.status(400).json({ error: "Missing userId or email" }); const [userRows, legacyRows] = await Promise.all([fetchTableRows("user_listings", identity.user_ids, identity.emails), fetchTableRows("listings", identity.user_ids, identity.emails)]); const [userBackfill, legacyBackfill] = await Promise.all([backfillListingIdentity("user_listings", userRows, finalUserId, finalEmail), backfillListingIdentity("listings", legacyRows, finalUserId, finalEmail)]); const mergedMap = new Map(); for (const row of userRows) { const normalized = normalizeListingRow(row, "user_listings"); mergedMap.set(normalized.identity_key, preferListingRow(mergedMap.get(normalized.identity_key), normalized)); } for (const row of legacyRows) { const normalized = normalizeListingRow(row, "listings"); mergedMap.set(normalized.identity_key, preferListingRow(mergedMap.get(normalized.identity_key), normalized)); } let rows = [...mergedMap.values()].filter((row) => matchesFilter(row, { status, lifecycleStatus, reviewBucket, search, preset })); rows = sortRows(rows, sort).slice(0, limit); return res.status(200).json({ success: true, data: rows, meta: { total: rows.length, limit, identity: { primary_user_id: finalUserId, primary_email: finalEmail, user_ids_considered: identity.user_ids.length, emails_considered: identity.emails.length }, sources: { user_listings: userRows.length, listings: legacyRows.length, merged: mergedMap.size }, backfill: { user_listings_updated: userBackfill.updated, listings_updated: legacyBackfill.updated } } }); } catch (error) { console.error("get-user-listings fatal error:", error); return res.status(500).json({ error: error.message || "Internal server error" }); } }
function matchesFilter(row, { status, lifecycleStatus, reviewBucket, search, preset }) { const normalizedStatus = normalizeStatus(row.status); const normalizedLifecycle = normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket); const normalizedBucket = normalizeReviewBucket(row.review_bucket); if (status) { if (status === "review") { if (!["review_delete", "review_price_update", "review_new"].includes(normalizedLifecycle)) return false; } else if (normalizedStatus !== status) return false; } if (lifecycleStatus && normalizedLifecycle !== lifecycleStatus) return false; if (reviewBucket && normalizedBucket !== reviewBucket) return false; if (preset) { if (preset === "review" && !["review_delete", "review_price_update", "review_new"].includes(normalizedLifecycle)) return false; if (preset === "stale" && !(normalizedStatus === "stale" || normalizedLifecycle === "stale" || normalizedLifecycle === "review_delete")) return false; if (preset === "price" && normalizedLifecycle !== "review_price_update" && normalizedBucket !== "pricechanges") return false; if (preset === "new" && normalizedLifecycle !== "review_new" && normalizedBucket !== "newvehicles") return false; if (preset === "active" && ["sold", "deleted", "inactive", "stale"].includes(normalizedStatus)) return false; if (preset === "promote" && !row.promote_now) return false; if (preset === "likely_sold" && !row.likely_sold) return false; if (preset === "weak" && !row.weak) return false; if (preset === "needs_action" && !row.needs_action) return false; } if (search) { const haystack = [row.title, row.make, row.model, row.trim, row.vin, row.stock_number, row.body_style, row.vehicle_type, row.exterior_color, row.fuel_type, row.location, row.lifecycle_status, row.review_bucket, row.source_url, row.predicted_label, row.recommended_action, row.pricing_insight].map((value) => clean(value).toLowerCase()).join(" "); if (!haystack.includes(search)) return false; } return true; }
function sortRows(rows, sort) { const items = [...rows]; if (sort === "price_high") return items.sort((a, b) => safeNumber(b.price) - safeNumber(a.price)); if (sort === "price_low") return items.sort((a, b) => safeNumber(a.price) - safeNumber(b.price)); if (sort === "popular") return items.sort((a, b) => safeNumber(b.popularity_score) - safeNumber(a.popularity_score)); if (sort === "predicted") return items.sort((a, b) => safeNumber(b.predicted_score) - safeNumber(a.predicted_score)); return items.sort((a, b) => new Date(b.posted_at || b.updated_at || 0).getTime() - new Date(a.posted_at || a.updated_at || 0).getTime()); }

export default async function handler(req, res) { res.setHeader("Content-Type", "application/json"); if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" }); try { const verifiedUser = await getVerifiedRequestUser(req); if (!verifiedUser?.id || !verifiedUser?.email) return res.status(401).json({ error: "Unauthorized" }); const userId = clean(verifiedUser.id || req.query?.userId || req.query?.user_id || ""); const email = normalizeEmail(verifiedUser.email || req.query?.email || ""); const status = clean(req.query?.status || "").toLowerCase(); const preset = clean(req.query?.preset || "").toLowerCase(); const lifecycleStatus = clean(req.query?.lifecycle_status || req.query?.lifecycleStatus || "").toLowerCase(); const reviewBucket = normalizeReviewBucket(req.query?.review_bucket || req.query?.reviewBucket || ""); const search = clean(req.query?.search || "").toLowerCase(); const sort = clean(req.query?.sort || "newest").toLowerCase(); const limit = Math.min(Math.max(Number(req.query?.limit || 100), 1), 300); const identity = await resolveIdentityCandidates({ userId, email, authUid: clean(verifiedUser.id || "") }); const finalUserId = clean(identity.primary_user_id || userId || ""); const finalEmail = normalizeEmail(identity.primary_email || email || ""); if (!finalUserId && !finalEmail) return res.status(400).json({ error: "Missing userId or email" }); const [userRows, legacyRows] = await Promise.all([fetchTableRows("user_listings", identity.user_ids, identity.emails), fetchTableRows("listings", identity.user_ids, identity.emails)]); const mergedMap = new Map(); for (const row of userRows) { const normalized = normalizeListingRow(row, "user_listings"); mergedMap.set(normalized.identity_key, preferListingRow(mergedMap.get(normalized.identity_key), normalized)); } for (const row of legacyRows) { const normalized = normalizeListingRow(row, "listings"); mergedMap.set(normalized.identity_key, preferListingRow(mergedMap.get(normalized.identity_key), normalized)); } let rows = [...mergedMap.values()].filter((row) => matchesFilter(row, { status, lifecycleStatus, reviewBucket, search, preset })); rows = sortRows(rows, sort).slice(0, limit); return res.status(200).json({ success: true, data: rows, meta: { total: rows.length, limit, identity: { primary_user_id: finalUserId, primary_email: finalEmail, user_ids_considered: identity.user_ids.length, emails_considered: identity.emails.length }, sources: { user_listings: userRows.length, listings: legacyRows.length, merged: mergedMap.size } } }); } catch (error) { console.error("get-user-listings fatal error:", error); return res.status(500).json({ error: error.message || "Internal server error" }); } }

