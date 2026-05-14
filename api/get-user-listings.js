import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { requireVerifiedUser } from "./_shared/auth.js";
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

function buildMarketplaceUrl(row = {}) {
  const direct = clean(row.marketplace_url || row.platform_listing_url || row.posted_url || "");
  if (/^https?:\/\//i.test(direct)) return direct;
  const id = clean(row.marketplace_listing_id || "").replace(/[^0-9]/g, "");
  return id ? `https://www.facebook.com/marketplace/item/${id}` : "";
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
  const priceReview = Boolean(row.price_review_required) || !row.price_resolved;
  const missingImage = !clean(row.image_url || "");
  const staleLike = status === "stale" || lifecycle === "stale" || lifecycle === "review_delete" || reviewBucket === "removedvehicles";
  const likelySold = lifecycle === "review_delete" || reviewBucket === "removedvehicles";
  const activeLike = !["sold", "deleted", "inactive"].includes(status) && lifecycle !== "review_delete";
  const highViewsNoMessages = activeLike && views >= 20 && messages === 0;
  const promoteNow = activeLike && views >= 20 && messages >= 1;
  const lowPerformance = activeLike && ageDays >= 7 && views < 5 && messages === 0;
  const weak = staleLike || lowPerformance;
  const needsAction = weak || highViewsNoMessages || lifecycle === "review_price_update" || reviewBucket === "pricechanges" || priceReview || missingImage;

  let recommendedAction = "Keep live";
  if (priceReview) recommendedAction = "Resolve price source";
  else if (missingImage) recommendedAction = "Sync listing image";
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
    missing_image: missingImage,
    recommended_action: recommendedAction,
    predicted_score: Math.max(0, Math.min(100, Math.round(50 + Math.min(views, 25) + Math.min(messages * 18, 36) - Math.min(ageDays * 3, 24) - (priceReview ? 15 : 0)))),
    predicted_label: priceReview ? "Data Incomplete" : "Likely Performer",
    pricing_insight: priceReview ? "Price source is unresolved. Do not trust displayed price yet." : highViewsNoMessages ? "Price may be limiting message conversion." : messages >= 2 ? "Pricing appears competitive." : "Pricing signal still developing.",
    content_feedback: missingImage ? "Image is missing from listing truth." : "Listing structure looks strong.",
    popularity_score: messages * 1000 + views * 10 + (postedTs / 100000000)
  };
}

function stripVinPrefix(value) {
  return clean(value || "").replace(/^VIN:/i, "").toUpperCase();
}

function listingIdentityKey(row) {
  const vin = stripVinPrefix(row.vin || row.id || "");
  if (vin && /^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin)) return `VIN:${vin}`;
  const stock = clean(row.stock_number || "").toUpperCase();
  if (stock) return `STOCK:${stock}`;
  const marketplace = clean(row.marketplace_listing_id || "").toUpperCase();
  if (marketplace) return `MARKETPLACE:${marketplace}`;
  const source = clean(row.source_url || "").toLowerCase();
  if (source) return `URL:${source}`;
  const id = clean(row.id || "");
  if (id) return `ID:${id}`;
  return [clean(row.year), clean(row.make), clean(row.model), String(row.price || ""), String(row.mileage || "")].filter(Boolean).join("|");
}

function normalizeListingRow(row = {}, source = "user_listings") {
  const canonical = extractCanonicalPriceMileage(row);
  const marketplaceUrl = buildMarketplaceUrl(row);
  const normalized = {
    ...row,
    id: clean(row.id || ""),
    source_table: source,
    status: normalizeStatus(row.status),
    lifecycle_status: normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket),
    review_bucket: normalizeReviewBucket(row.review_bucket),
    identity_key: listingIdentityKey({ ...row, price: canonical.price, mileage: canonical.mileage }),
    title: clean(row.title || `${clean(row.year)} ${clean(row.make)} ${clean(row.model)} ${clean(row.trim)}`.trim()),
    posted_at: row.posted_at || row.created_at || null,
    updated_at: row.updated_at || row.created_at || null,
    last_seen_at: row.last_seen_at || row.updated_at || row.created_at || null,
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
    price_review_required: canonical.price_review_required,
    display_price_text: canonical.display_price_text,
    display_mileage_text: canonical.display_mileage_text,
    marketplace_url: marketplaceUrl,
    body_style: clean(row.body_style || ""),
    make: clean(row.make || ""),
    model: clean(row.model || ""),
    trim: clean(row.trim || ""),
    vin: stripVinPrefix(row.vin || row.id || ""),
    stock_number: clean(row.stock_number || ""),
    image_url: clean(row.image_url || "")
  };
  return { ...normalized, ...buildListingIntelligence(normalized) };
}

function preferListingRow(current, incoming) {
  if (!current) return incoming;
  const currentScore =
    (current.source_table === "user_listings" ? 1000 : 0) +
    (clean(current.image_url) ? 90 : 0) +
    (current.price_resolved ? 120 : 0) +
    (current.mileage_resolved ? 40 : 0) +
    (clean(current.marketplace_url) ? 70 : 0) +
    safeNumber(current.views_count) + safeNumber(current.messages_count) * 10;
  const incomingScore =
    (incoming.source_table === "user_listings" ? 1000 : 0) +
    (clean(incoming.image_url) ? 90 : 0) +
    (incoming.price_resolved ? 120 : 0) +
    (incoming.mileage_resolved ? 40 : 0) +
    (clean(incoming.marketplace_url) ? 70 : 0) +
    safeNumber(incoming.views_count) + safeNumber(incoming.messages_count) * 10;
  const base = incomingScore >= currentScore ? { ...current, ...incoming } : { ...incoming, ...current };
  return {
    ...base,
    image_url: clean(base.image_url || current.image_url || incoming.image_url || ""),
    marketplace_url: clean(base.marketplace_url || current.marketplace_url || incoming.marketplace_url || ""),
    source_url: clean(base.source_url || current.source_url || incoming.source_url || ""),
    vin: stripVinPrefix(base.vin || current.vin || incoming.vin || ""),
    stock_number: clean(base.stock_number || current.stock_number || incoming.stock_number || "")
  };
}

function makeRequestId() {
  try { return randomUUID(); } catch { return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`; }
}

async function fetchTableRows(tableName, userId = "", email = "") {
  const byKey = new Map();
  const queries = [];
  if (userId) queries.push(supabase.from(tableName).select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(300));
  if (email) queries.push(supabase.from(tableName).select("*").eq("email", email).order("updated_at", { ascending: false }).limit(300));

  const results = await Promise.allSettled(queries);
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { data } = result.value || {};
    for (const row of Array.isArray(data) ? data : []) {
      const normalizedKey = listingIdentityKey(row) || clean(row?.id || "") || `${clean(row?.marketplace_listing_id || "")}|${clean(row?.posted_at || row?.created_at || "")}`;
      if (!normalizedKey) continue;
      byKey.set(normalizedKey, preferListingRow(byKey.get(normalizedKey), row));
    }
  }
  return [...byKey.values()];
}

function matchesFilter(row, { status, lifecycleStatus, reviewBucket, search, preset }) {
  const normalizedStatus = normalizeStatus(row.status);
  const normalizedLifecycle = normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket);
  const normalizedBucket = normalizeReviewBucket(row.review_bucket);
  if (status) {
    if (status === "review") {
      if (!["review_delete", "review_price_update", "review_new"].includes(normalizedLifecycle) && !row.needs_action) return false;
    } else if (normalizedStatus !== status) return false;
  }
  if (lifecycleStatus && normalizedLifecycle !== lifecycleStatus) return false;
  if (reviewBucket && normalizedBucket !== reviewBucket) return false;
  if (preset === "price" && !row.price_review_required && normalizedLifecycle !== "review_price_update" && normalizedBucket !== "pricechanges") return false;
  if (preset === "unresolved_price" && row.price_resolved) return false;
  if (preset === "missing_image" && clean(row.image_url)) return false;
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
    const verifiedUser = await requireVerifiedUser(req, res);
    if (!verifiedUser) return;

    const userId = clean(verifiedUser.id || "");
    const email = normalizeEmail(verifiedUser.email || "");
    if (!userId && !email) return res.status(401).json({ error: "Unauthorized", request_id: requestId });

    const status = clean(req.query?.status || "").toLowerCase();
    const preset = clean(req.query?.preset || "").toLowerCase();
    const lifecycleStatus = clean(req.query?.lifecycle_status || req.query?.lifecycleStatus || "").toLowerCase();
    const reviewBucket = normalizeReviewBucket(req.query?.review_bucket || req.query?.reviewBucket || "");
    const search = clean(req.query?.search || "").toLowerCase();
    const sort = clean(req.query?.sort || "newest").toLowerCase();
    const limit = Math.min(Math.max(Number(req.query?.limit || 100), 1), 300);
    const offset = Math.max(Number(req.query?.offset || 0), 0);

    const [userRows, legacyRows] = await Promise.all([
      fetchTableRows("user_listings", userId, email),
      fetchTableRows("listings", userId, email)
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

    const filteredRows = sortRows([...mergedMap.values()].filter((row) => matchesFilter(row, { status, lifecycleStatus, reviewBucket, search, preset })), sort);
    const totalFiltered = filteredRows.length;
    const pagedRows = filteredRows.slice(offset, offset + limit);

    return res.status(200).json({
      success: true,
      request_id: requestId,
      data: pagedRows,
      meta: {
        total: totalFiltered,
        returned_count: pagedRows.length,
        unresolved_price_count: filteredRows.filter((row) => !row.price_resolved).length,
        missing_image_count: filteredRows.filter((row) => !clean(row.image_url)).length,
        limit,
        offset,
        has_more: offset + pagedRows.length < totalFiltered,
        auth_mode: "verified_bearer_owner_scoped",
        owner_scope: { user_id: userId, email },
        sources: { user_listings: userRows.length, listings: legacyRows.length, merged: mergedMap.size }
      }
    });
  } catch (error) {
    console.error("get-user-listings fatal error:", error);
    return res.status(500).json({ error: error.message || "Internal server error", request_id: requestId });
  }
}
