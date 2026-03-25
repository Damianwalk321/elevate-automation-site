import { createClient } from "@supabase/supabase-js";

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

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStatus(value) {
  const status = clean(value).toLowerCase();
  if (["sold", "deleted", "inactive", "failed", "stale"].includes(status)) return status;
  if (["posted", "active", "live"].includes(status)) return "active";
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
  return [
    clean(row.year || "").toUpperCase(),
    clean(row.make || "").toUpperCase(),
    clean(row.model || "").toUpperCase(),
    String(row.price || "").replace(/[^\d]/g, ""),
    String(row.mileage || row.kilometers || row.km || "").replace(/[^\d]/g, "")
  ].filter(Boolean).join("|");
}

function normalizeListingRow(row = {}, source = "user_listings") {
  const reviewBucket = normalizeReviewBucket(row.review_bucket);
  return {
    ...row,
    source_table: source,
    identity_key: listingIdentityKey(row),
    status: normalizeStatus(row.status),
    lifecycle_status: normalizeLifecycleStatus(row.lifecycle_status, reviewBucket),
    review_bucket: reviewBucket,
    price: safeNumber(row.price, 0),
    mileage: safeNumber(row.mileage || row.kilometers || row.km, 0),
    views_count: safeNumber(row.views_count, 0),
    messages_count: safeNumber(row.messages_count, 0),
    posted_at: row.posted_at || row.created_at || null,
    updated_at: row.updated_at || row.created_at || null
  };
}

function preferListingRow(current, incoming) {
  if (!current) return incoming;

  const currentTs = new Date(current.updated_at || current.posted_at || current.created_at || 0).getTime();
  const incomingTs = new Date(incoming.updated_at || incoming.posted_at || incoming.created_at || 0).getTime();

  const currentScore =
    (current.source_table === "user_listings" ? 1000 : 0) +
    (clean(current.image_url) ? 100 : 0) +
    (clean(current.marketplace_listing_id) ? 50 : 0) +
    currentTs / 1000000000000;

  const incomingScore =
    (incoming.source_table === "user_listings" ? 1000 : 0) +
    (clean(incoming.image_url) ? 100 : 0) +
    (clean(incoming.marketplace_listing_id) ? 50 : 0) +
    incomingTs / 1000000000000;

  return incomingScore >= currentScore ? { ...current, ...incoming } : { ...incoming, ...current };
}

async function resolveUser({ userId, email }) {
  if (userId) {
    const { data, error } = await supabase.from("users").select("id,email").eq("id", userId).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (email) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  return null;
}


function calculateHealthScore(row = {}) {
  const views = safeNumber(row.views_count, 0);
  const messages = safeNumber(row.messages_count, 0);
  const postedAt = row.posted_at || row.created_at || row.updated_at || null;
  const ageDays = postedAt ? Math.max(0, Math.floor((Date.now() - new Date(postedAt).getTime()) / 86400000)) : 0;
  const lifecycle = clean(row.lifecycle_status || '').toLowerCase();
  const status = clean(row.status || '').toLowerCase();
  let score = 50 + Math.min(views, 50) + Math.min(messages * 12, 60) - Math.min(ageDays * 2, 35);
  if (["stale", "review_delete", "review_price_update", "review_new"].includes(lifecycle)) score -= 25;
  if (["sold", "deleted", "inactive"].includes(status)) score -= 20;
  if (views >= 10 && messages === 0) score -= 10;
  score = Math.max(0, Math.min(100, score));
  let label = 'Healthy';
  if (score >= 85) label = 'High Performer';
  else if (score >= 60) label = 'Healthy';
  else if (score >= 35) label = 'Watch';
  else if (score >= 15) label = 'Weak';
  else label = 'Needs Action';
  return { score, label, age_days: ageDays };
}

function recommendListingAction(row = {}) {
  const views = safeNumber(row.views_count, 0);
  const messages = safeNumber(row.messages_count, 0);
  const postedAt = row.posted_at || row.created_at || row.updated_at || null;
  const ageDays = postedAt ? Math.max(0, Math.floor((Date.now() - new Date(postedAt).getTime()) / 86400000)) : 0;
  const lifecycle = clean(row.lifecycle_status || '').toLowerCase();
  const status = clean(row.status || '').toLowerCase();
  if (lifecycle === 'review_price_update') return 'Review price';
  if (lifecycle === 'review_delete' || status === 'stale') return 'Check if sold or stale';
  if (lifecycle === 'review_new') return 'Review new listing';
  if (views >= 15 && messages === 0) return 'Refresh title/photos';
  if (ageDays >= 7 && views < 5) return 'Promote now';
  if (messages >= 3) return 'Keep live';
  return 'Monitor performance';
}

function sortRows(rows, sort) {
  const items = [...rows];

  if (sort === "price_high") return items.sort((a, b) => safeNumber(b.price) - safeNumber(a.price));
  if (sort === "price_low") return items.sort((a, b) => safeNumber(a.price) - safeNumber(b.price));

  if (sort === "popular") {
    return items.sort((a, b) => {
      const scoreA = safeNumber(a.messages_count) * 1000 + safeNumber(a.views_count) * 10 + new Date(a.posted_at || a.created_at || 0).getTime() / 100000000;
      const scoreB = safeNumber(b.messages_count) * 1000 + safeNumber(b.views_count) * 10 + new Date(b.posted_at || b.created_at || 0).getTime() / 100000000;
      return scoreB - scoreA;
    });
  }

  return items.sort((a, b) => new Date(b.posted_at || b.created_at || 0).getTime() - new Date(a.posted_at || a.created_at || 0).getTime());
}

async function fetchTableRows(tableName, finalUserId, finalEmail) {
  const rows = [];
  const seen = new Set();

  async function runQuery(mode) {
    let query = supabase.from(tableName).select('*');
    if (mode === 'user' && finalUserId) query = query.eq('user_id', finalUserId);
    if (mode === 'email' && finalEmail) query = query.ilike('email', finalEmail);
    const { data, error } = await query;
    if (error) throw error;
    for (const row of Array.isArray(data) ? data : []) {
      const key = clean(row?.id || '') || `${clean(row?.marketplace_listing_id || '')}|${clean(row?.posted_at || row?.created_at || '')}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }

  if (finalUserId) await runQuery('user');
  if (finalEmail) await runQuery('email');
  return rows;
}

function matchesFilter(row, { status, lifecycleStatus, reviewBucket, search, preset }) {
  const normalizedStatus = normalizeStatus(row.status);
  const normalizedLifecycle = normalizeLifecycleStatus(row.lifecycle_status, row.review_bucket);
  const normalizedBucket = normalizeReviewBucket(row.review_bucket);

  if (status) {
    if (status === "review") {
      if (!["review_delete", "review_price_update", "review_new"].includes(normalizedLifecycle)) return false;
    } else if (normalizedStatus !== status) {
      return false;
    }
  }

  if (lifecycleStatus && normalizedLifecycle !== lifecycleStatus) return false;
  if (reviewBucket && normalizedBucket !== reviewBucket) return false;

  if (preset) {
    if (preset === "review" && !["review_delete", "review_price_update", "review_new"].includes(normalizedLifecycle)) return false;
    if (preset === "stale" && !(normalizedStatus === "stale" || normalizedLifecycle === "stale" || normalizedLifecycle === "review_delete")) return false;
    if (preset === "price" && normalizedLifecycle !== "review_price_update" && normalizedBucket !== "pricechanges") return false;
    if (preset === "new" && normalizedLifecycle !== "review_new" && normalizedBucket !== "newvehicles") return false;
    if (preset === "active" && ["sold", "deleted", "inactive", "stale"].includes(normalizedStatus)) return false;
    const health = calculateHealthScore(row);
    if (preset === "weak" && !["Weak", "Needs Action"].includes(health.label)) return false;
    if (preset === "needs_action" && health.label !== "Needs Action" && !["review_delete","review_price_update","review_new"].includes(normalizedLifecycle)) return false;
  }

  if (search) {
    const haystack = [
      row.title,
      row.make,
      row.model,
      row.trim,
      row.vin,
      row.stock_number,
      row.body_style,
      row.vehicle_type,
      row.exterior_color,
      row.fuel_type,
      row.location,
      row.lifecycle_status,
      row.review_bucket,
      row.source_url
    ].map((v) => clean(v).toLowerCase()).join(" ");

    if (!haystack.includes(search)) return false;
  }

  return true;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userId = clean(req.query?.userId || req.query?.user_id || "");
    const email = normalizeEmail(req.query?.email || "");
    const status = clean(req.query?.status || "").toLowerCase();
    const preset = clean(req.query?.preset || "").toLowerCase();
    const lifecycleStatus = clean(req.query?.lifecycle_status || req.query?.lifecycleStatus || "").toLowerCase();
    const reviewBucket = normalizeReviewBucket(req.query?.review_bucket || req.query?.reviewBucket || "");
    const search = clean(req.query?.search || "").toLowerCase();
    const sort = clean(req.query?.sort || "newest").toLowerCase();
    const limit = Math.min(Math.max(Number(req.query?.limit || 100), 1), 250);

    const user = await resolveUser({ userId, email });
    const finalUserId = clean(user?.id || userId || "");
    const finalEmail = normalizeEmail(user?.email || email || "");

    if (!finalUserId && !finalEmail) {
      return res.status(400).json({ error: "Missing userId or email" });
    }

    const [userListingRows, legacyListingRows] = await Promise.all([
      fetchTableRows("user_listings", finalUserId, finalEmail),
      fetchTableRows("listings", finalUserId, finalEmail)
    ]);

    const map = new Map();
    for (const row of userListingRows) {
      const normalized = normalizeListingRow(row, "user_listings");
      map.set(normalized.identity_key, preferListingRow(map.get(normalized.identity_key), normalized));
    }
    for (const row of legacyListingRows) {
      const normalized = normalizeListingRow(row, "listings");
      map.set(normalized.identity_key, preferListingRow(map.get(normalized.identity_key), normalized));
    }

    let rows = [...map.values()].map((row) => {
      const health = calculateHealthScore(row);
      return {
        ...row,
        health_score: health.score,
        health_label: health.label,
        age_days: health.age_days,
        recommended_action: recommendListingAction(row)
      };
    }).filter((row) => matchesFilter(row, { status, lifecycleStatus, reviewBucket, search, preset }));
    rows = sortRows(rows, sort).slice(0, limit);

    return res.status(200).json({
      success: true,
      data: rows,
      meta: {
        total: rows.length,
        limit,
        sources: {
          user_listings: userListingRows.length,
          listings: legacyListingRows.length,
          merged: map.size
        }
      }
    });
  } catch (error) {
    console.error("get-user-listings fatal error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}
