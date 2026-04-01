import { createClient } from "@supabase/supabase-js";
import { requireVerifiedDashboardUser, getTrustedIdentity } from "./_shared/auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function allowedStatus(value) {
  const status = clean(value).toLowerCase();
  const allowed = [
    "posted", "active", "stale", "sold", "deleted", "inactive", "failed",
    "approved", "dismissed", "actioned", "relisted", "archived",
    "needs_price_review", "needs_content_refresh", "needs_manager_review",
    "promote_now", "likely_sold"
  ];
  return allowed.includes(status) ? status : null;
}

function normalizeReviewBucket(value) {
  const bucket = clean(value).toLowerCase().replace(/[\s_-]+/g, "");
  if (!bucket) return "";
  if (["removedvehicles", "removed", "reviewdelete"].includes(bucket)) return "removedvehicles";
  if (["pricechanges", "pricechange", "reviewpriceupdate"].includes(bucket)) return "pricechanges";
  if (["newvehicles", "new", "reviewnew"].includes(bucket)) return "newvehicles";
  return bucket;
}

function allowedLifecycleStatus(value) {
  const lifecycle = clean(value).toLowerCase();
  const allowed = [
    "active", "stale", "review_delete", "review_price_update", "review_new",
    "sold", "deleted", "inactive", "failed", "approved", "dismissed",
    "actioned", "relisted", "archived", "needs_price_review",
    "needs_content_refresh", "needs_manager_review", "promote_now", "likely_sold"
  ];
  return allowed.includes(lifecycle) ? lifecycle : null;
}

function nowIso() {
  return new Date().toISOString();
}

async function resolveUser({ userId, email }) {
  if (userId) {
    const { data, error } = await supabase.from("users").select("id,email").or(`id.eq.${userId},auth_user_id.eq.${userId}`).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (email) {
    const { data, error } = await supabase.from("users").select("id,email").ilike("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function updateInTable(tableName, filters, payload) {
  let query = supabase.from(tableName).update(payload).eq("id", filters.listingId);
  if (filters.userId) query = query.eq("user_id", filters.userId);
  else if (filters.email) query = query.eq("email", filters.email);
  return query.select("*").maybeSingle();
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const verifiedUser = await requireVerifiedDashboardUser(req, res);
    if (req.headers?.["x-elevate-client"] && !verifiedUser && String(req.headers["x-elevate-client"]).toLowerCase() === "dashboard") {
      return;
    }
    const identity = getTrustedIdentity({ verifiedUser, body });

    const listingId = clean(body.listingId || body.listing_id || "");
    const listingIds = Array.isArray(body.listingIds || body.listing_ids)
      ? (body.listingIds || body.listing_ids).map((v) => clean(v)).filter(Boolean)
      : [];
    const userId = clean(identity.id || body.userId || body.user_id || "");
    const email = normalizeEmail(identity.email || body.email || "");
    const nextStatus = allowedStatus(body.status);
    const nextLifecycleStatus = allowedLifecycleStatus(body.lifecycle_status || body.lifecycleStatus || body.review_status || "");
    const nextReviewBucket = normalizeReviewBucket(body.review_bucket || body.reviewBucket || "");

    if (!listingId && !listingIds.length) return res.status(400).json({ error: "Missing listingId" });
    if (!nextStatus) return res.status(400).json({ error: "Invalid status" });

    const user = await resolveUser({ userId, email });
    const finalUserId = clean(user?.id || userId || "");
    const finalEmail = normalizeEmail(user?.email || email || "");

    const shouldClearReview = ["sold", "deleted", "inactive", "approved", "dismissed", "archived", "relisted"].includes(nextStatus);
    const updatePayload = {
      status: nextStatus,
      updated_at: nowIso(),
      last_seen_at: nowIso(),
      lifecycle_status: nextLifecycleStatus || (shouldClearReview ? "active" : undefined),
      review_bucket: shouldClearReview ? "" : (nextReviewBucket || undefined)
    };

    Object.keys(updatePayload).forEach((key) => updatePayload[key] === undefined && delete updatePayload[key]);

    const targetIds = listingIds.length ? listingIds : [listingId];
    let firstData = null;

    for (const targetId of targetIds) {
      const filters = { listingId: targetId, userId: finalUserId, email: finalEmail };
      const { data, error } = await updateInTable("user_listings", filters, updatePayload);
      if (error) {
        console.error("update-listing-status error:", error);
        return res.status(500).json({ error: error.message });
      }
      if (!firstData && data) firstData = data;

      try {
        await updateInTable("listings", filters, updatePayload);
      } catch (legacyError) {
        console.warn("legacy listings mirror update warning:", legacyError);
      }

      try {
        await supabase.from("usage_logs").insert([
          {
            user_id: finalUserId || null,
            email: finalEmail || "",
            action: "listing_status_updated",
            listing_id: targetId,
            metadata: {
              status: nextStatus,
              lifecycle_status: nextLifecycleStatus || null,
              review_bucket: shouldClearReview ? "" : nextReviewBucket
            },
            created_at: nowIso()
          }
        ]);
      } catch (logError) {
        console.warn("usage_logs insert warning:", logError);
      }
    }

    return res.status(200).json({ success: true, data: firstData, updated_count: targetIds.length });
  } catch (error) {
    console.error("update-listing-status fatal error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
