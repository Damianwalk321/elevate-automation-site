
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { getVerifiedRequestUser, getTrustedIdentity, isDashboardClient } from "./_shared/auth.js";
import { clean, normalizeEmail } from "./_shared/listing-normalize.js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function makeRequestId() {
  try { return randomUUID(); } catch { return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`; }
}

function normalizeReviewBucket(value) {
  const bucket = clean(value).toLowerCase().replace(/[\s_-]+/g, "");
  if (!bucket) return "";
  if (["removedvehicles", "removed", "reviewdelete"].includes(bucket)) return "removedvehicles";
  if (["pricechanges", "pricechange", "reviewpriceupdate"].includes(bucket)) return "pricechanges";
  if (["newvehicles", "new", "reviewnew"].includes(bucket)) return "newvehicles";
  return bucket;
}

function resolveActionPatch(action, payload = {}) {
  const base = { updated_at: new Date().toISOString() };
  switch (action) {
    case "mark_sold":
      return { ...base, status: "sold", lifecycle_status: "sold", review_bucket: "" };
    case "mark_removed":
      return { ...base, status: "deleted", lifecycle_status: "review_delete", review_bucket: "removedvehicles" };
    case "mark_stale":
      return { ...base, status: "stale", lifecycle_status: "stale" };
    case "send_to_price_review":
      return { ...base, lifecycle_status: "review_price_update", review_bucket: "pricechanges" };
    case "mark_price_updated":
      return {
        ...base,
        lifecycle_status: "active",
        review_bucket: "",
        ...(payload.price !== undefined ? { price: payload.price, current_price: payload.price } : {})
      };
    case "keep_live":
      return { ...base, status: "active", lifecycle_status: "active", review_bucket: "" };
    case "approve_new":
      return { ...base, status: "active", lifecycle_status: "active", review_bucket: "" };
    default:
      return null;
  }
}

async function updateByIdentity(table, identity = {}, patch = {}, userId = "", email = "") {
  const attempts = [];
  if (clean(identity.id)) attempts.push((q) => q.eq("id", clean(identity.id)));
  if (clean(identity.marketplace_listing_id)) attempts.push((q) => q.eq("marketplace_listing_id", clean(identity.marketplace_listing_id)));
  if (clean(identity.vin)) attempts.push((q) => q.eq("vin", clean(identity.vin)));
  if (clean(identity.stock_number)) attempts.push((q) => q.eq("stock_number", clean(identity.stock_number)));
  if (clean(identity.source_url)) attempts.push((q) => q.eq("source_url", clean(identity.source_url)));

  let updatedCount = 0;
  for (const applyIdentity of attempts) {
    let query = supabase.from(table).update(patch).select("id");
    query = applyIdentity(query);
    if (userId) query = query.eq("user_id", userId);
    else if (email) query = query.ilike("email", email);
    const { data, error } = await query;
    if (!error && Array.isArray(data) && data.length) updatedCount += data.length;
  }
  return updatedCount;
}

export default async function handler(req, res) {
  const requestId = makeRequestId();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("x-request-id", requestId);

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed", request_id: requestId });

  try {
    const verifiedUser = await getVerifiedRequestUser(req);
    const trusted = getTrustedIdentity({ verifiedUser, body: req.body || {}, query: req.query || {} });
    const dashboardClient = isDashboardClient(req);

    const userId = clean(trusted.id || req.body?.userId || req.body?.user_id || "");
    const email = normalizeEmail(trusted.email || req.body?.email || "");
    if (dashboardClient && !verifiedUser && !(userId || email)) {
      return res.status(401).json({ error: "Unauthorized", requires_auth: true, request_id: requestId });
    }

    const action = clean(req.body?.action || "").toLowerCase();
    const patch = resolveActionPatch(action, req.body || {});
    if (!patch) return res.status(400).json({ error: "Unknown action", request_id: requestId });

    const identity = {
      id: clean(req.body?.id || ""),
      marketplace_listing_id: clean(req.body?.marketplace_listing_id || ""),
      vin: clean(req.body?.vin || ""),
      stock_number: clean(req.body?.stock_number || ""),
      source_url: clean(req.body?.source_url || "")
    };
    if (!Object.values(identity).some(Boolean)) {
      return res.status(400).json({ error: "Missing listing identity", request_id: requestId });
    }

    if ("review_bucket" in patch) patch.review_bucket = normalizeReviewBucket(patch.review_bucket);

    const [userListingsUpdated, listingsUpdated] = await Promise.all([
      updateByIdentity("user_listings", identity, patch, userId, email),
      updateByIdentity("listings", identity, patch, userId, email)
    ]);

    return res.status(200).json({
      success: true,
      request_id: requestId,
      action,
      updated_rows: {
        user_listings: userListingsUpdated,
        listings: listingsUpdated,
        total: userListingsUpdated + listingsUpdated
      },
      applied_patch: patch
    });
  } catch (error) {
    console.error("review-listing-action fatal error:", error);
    return res.status(500).json({ error: error.message || "Internal server error", request_id: requestId });
  }
}
