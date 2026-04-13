
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { getVerifiedRequestUser, getTrustedIdentity, isDashboardClient } from "./_shared/auth.js";
import {
  clean,
  normalizeEmail,
  safeNumber,
  extractCanonicalPriceMileage
} from "./_shared/listing-normalize.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
  const needsAction = weak || highViewsNoMessages || lifecycle === "review_price_update" || reviewBucket === "pricechanges" || !row.price_resolved;

  let recommendedAction = "Keep live";
  if (!row.price_resolved) recommendedAction = "Resolve price source";
  else if (likelySold) recommendedAction = "Check if sold or stale";
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
    predicted_score: Math.max(0, Math.min(100, Math.round(50 + Math.min(views, 25) + Math.min(messages * 18, 36) - Math.min(ageDays * 3, 24) - (!row.price_resolved ? 15 : 0)))),
    predicted_label: !row.price_resolved ? "Data Incomplete" : "Likely Performer",
    pricing_insight: !row.price_resolved ? "Price source is unresolved. Do not trust displayed price yet." : highViewsNoMessages ? "Price may be limiting message conversion." : messages >= 2 ? "Pricing appears competitive." : "Pricing signal still developing.",
    content_feedback: "Listing structure looks strong.",
    popularity_score: messages * 1000 + views * 10 + (postedTs / 100000000)
  };
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
    price_resolved: canonical.price_resolved,
    mileage_resolved: canonical.mileage_resolved,
    display_price_text: canonical.display_price_text,
    body_style: clean(row.body_style || ""),
    make: clean(row.make || ""),
    model: clean(row.model || ""),
    trim: clean(row.trim || "")
  };
  return { ...normalized, ...buildListingIntelligence(normalized) };
}

function preferListingRow(current, incoming) {
  if (!current) return incoming;
  const currentScore = (current.source_table === "user_listings" ? 1000 : 0) + safeNumber(current.views_count) + safeNumber(current.messages_count) * 10 + (current.price_resolved ? 100 : 0);
  const incomingScore = (incoming.source_table === "user_listings" ? 1000 : 0) + safeNumber(incoming.views_count) + safeNumber(incoming.messages_count) * 10 + (incoming.price_resolved ? 100 : 0);
  return incomingScore >= currentScore ? { ...current, ...incoming } : { ...incoming, ...current };
}

function makeRequestId() {
  try { return randomUUID(); } catch { return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`; }
}

async function resolveIdentityCandidates({ userId, email }) {
  const userIds = Array.from(new Set([clean(userId)].filter(Boolean)));
  const emails = Array.from(new Set([normalizeEmail(email)].filter(Boolean)));
  return {
    primary_user_id: userIds[0] || "",
    primary_email: emails[0] || "",
    user_ids: userIds,
    emails
  };
}

async function fetchTableRows(tableName, userIds = [], emails = []) {
  const rows = [];
  const seen = new Set();

  for (const userId of userIds) {
    const { data } = await supabase.from(tableName).select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(300);
    for (const row of (Array.isArray(data) ? data : [])) {
      const key = clean(row?.id || "") || `${clean(row?.marketplace_listing_id || "")}|${clean(row?.posted_at || row?.created_at || "")}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }

  for (const email of emails) {
    const { data } = await supabase.from(tableName).select("*").ilike("email", email).order("updated_at", { ascending: false }).limit(300);
    for (const row of (Array.isArray(data) ? data : [])) {
      const key = clean(row?.id || "") || `${clean(row?.marketplace_listing_id || "")}|${clean(row?.posted_at || row?.created_at || "")}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }

  return rows;
}

function matchesFilter(row, { status, lifecycleStatus, reviewBucket, search, preset }) {
  const normalizedStatus = normalizeStatus(row.status);
  const normalizedLifecycle = normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket);
  const normalizedBucket = normalizeReviewBucket(row.review_bucket);
  if (status) {
    if (status === "review") {
      if (!["review_delete", "review_price_update", "review_new"].includes(normalizedLifecycle)) return false;
    } else if (normalizedStatus !== status) return false;
  }
  if (lifecycleStatus && normalizedLifecycle !== lifecycleStatus) return false;
  if (reviewBucket && normalizedBucket !== reviewBucket) return false;
  if (preset === "price" && normalizedLifecycle !== "review_price_update" && normalizedBucket !== "pricechanges") return false;
  if (preset === "unresolved_price" && row.price_resolved) return false;
  if (search) {
    const haystack = [row.title, row.make, row.model, row.trim, row.vin, row.stock_number, row.body_style, row.price_source, row.mileage_source].map((v) => clean(v).toLowerCase()).join(" ");
    if (!haystack.includes(search)) return false;
  }
  return true;
}

function sortRows(rows, sort) {
  const items = [...rows];
  if (sort === "price_high") return items.sort((a, b) => safeNumber(b.price) - safeNumber(a.price));
  if (sort === "price_low") return items.sort((a, b) => safeNumber(a.price) - safeNumber(b.price));
  if (sort === "popular") return items.sort((a, b) => safeNumber(b.popularity_score) - safeNumber(a.popularity_score));
  return items.sort((a, b) => new Date(b.posted_at || b.updated_at || 0).getTime() - new Date(a.posted_at || a.updated_at || 0).getTime());
}

export default async function handler(req, res) {
  const requestId = makeRequestId();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("x-request-id", requestId);

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed", request_id: requestId });

  try {
    const verifiedUser = await getVerifiedRequestUser(req);
    const trusted = getTrustedIdentity({ verifiedUser, body: req.body || {}, query: req.query || {} });
    const dashboardClient = isDashboardClient(req);

    const userId = clean(trusted.id || req.query?.userId || req.query?.user_id || "");
    const email = normalizeEmail(trusted.email || req.query?.email || "");

    if (dashboardClient && !verifiedUser && !(userId || email)) {
      return res.status(401).json({ error: "Unauthorized", requires_auth: true, request_id: requestId });
    }

    const status = clean(req.query?.status || "").toLowerCase();
    const preset = clean(req.query?.preset || "").toLowerCase();
    const lifecycleStatus = clean(req.query?.lifecycle_status || req.query?.lifecycleStatus || "").toLowerCase();
    const reviewBucket = normalizeReviewBucket(req.query?.review_bucket || req.query?.reviewBucket || "");
    const search = clean(req.query?.search || "").toLowerCase();
    const sort = clean(req.query?.sort || "newest").toLowerCase();
    const limit = Math.min(Math.max(Number(req.query?.limit || 100), 1), 300);

    const identity = await resolveIdentityCandidates({ userId, email });
    const [userRows, legacyRows] = await Promise.all([
      fetchTableRows("user_listings", identity.user_ids, identity.emails),
      fetchTableRows("listings", identity.user_ids, identity.emails)
    ]);

    const mergedMap = new Map();
    for (const row of userRows) {
      const normalized = normalizeListingRow(row, "user_listings");
      mergedMap.set(normalized.identity_key, preferListingRow(mergedMap.get(normalized.identity_key), normalized));
    }
    for (const row of legacyRows) {
      const normalized = normalizeListingRow(row, "listings");
      mergedMap.set(normalized.identity_key, preferListingRow(mergedMap.get(normalized.identity_key), normalized));
    }

    let rows = [...mergedMap.values()].filter((row) => matchesFilter(row, { status, lifecycleStatus, reviewBucket, search, preset }));
    rows = sortRows(rows, sort).slice(0, limit);

    return res.status(200).json({
      success: true,
      request_id: requestId,
      data: rows,
      meta: {
        total: rows.length,
        unresolved_price_count: rows.filter((row) => !row.price_resolved).length,
        limit,
        auth_mode: verifiedUser ? "verified_bearer" : (dashboardClient ? "dashboard_identity_fallback" : "query_identity"),
        sources: { user_listings: userRows.length, listings: legacyRows.length, merged: mergedMap.size }
      }
    });
  } catch (error) {
    console.error("get-user-listings fatal error:", error);
    return res.status(500).json({ error: error.message || "Internal server error", request_id: requestId });
  }
}
