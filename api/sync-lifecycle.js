import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function clean(value) {
  return String(value || "").trim();
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toIso(value) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function normalizeKey(value) {
  return clean(value).slice(0, 255);
}

function normalizeListingRow(row, fallbackUserId, fallbackEmail) {
  if (!row || typeof row !== "object") return null;

  const id = normalizeKey(
    row.id ||
    row.marketplace_listing_id ||
    row.source_url ||
    row.sourceUrl ||
    row.vin ||
    row.stock_number ||
    row.stockNumber
  );

  if (!id) return null;

  return {
    id,
    user_id: clean(row.user_id || fallbackUserId),
    email: clean(row.email || fallbackEmail).toLowerCase(),
    dealership_id: clean(row.dealership_id || ""),
    vin: clean(row.vin || "").toUpperCase(),
    stock_number: clean(row.stock_number || row.stockNumber || ""),
    source_url: clean(row.source_url || row.sourceUrl || ""),
    image_url: clean(row.image_url || row.cover_photo || row.coverPhotoUrl || row.photo || ""),
    year: numberOrZero(row.year),
    make: clean(row.make || ""),
    model: clean(row.model || ""),
    trim: clean(row.trim || ""),
    vehicle_type: clean(row.vehicle_type || row.vehicleType || ""),
    body_style: clean(row.body_style || row.bodyStyle || ""),
    exterior_color: clean(row.exterior_color || row.exteriorColor || row.color || ""),
    fuel_type: clean(row.fuel_type || row.fuelType || ""),
    mileage: numberOrZero(row.mileage || row.kilometers || row.km),
    price: numberOrZero(row.price),
    title: clean(row.title || ""),
    status: clean(row.status || "posted").toLowerCase(),
    lifecycle_status: clean(row.lifecycle_status || "").toLowerCase(),
    review_bucket: clean(row.review_bucket || ""),
    posted_at: toIso(row.posted_at || row.created_at || row.timestamp),
    views_count: numberOrZero(row.views_count ?? row.views),
    messages_count: numberOrZero(row.messages_count ?? row.messages),
    updated_at: new Date().toISOString()
  };
}

function buildSummaryPayload(body, partialSync = false) {
  const readMetric = (value) => {
    if (partialSync && value == null) return null;
    return numberOrZero(value);
  };

  return {
    posts_today: readMetric(body.posts_today),
    posting_limit: readMetric(body.posting_limit),
    posts_remaining: readMetric(body.posts_remaining),
    queue_count: readMetric(body.queue_count),
    active_listings: readMetric(body.active_listings),
    total_views: readMetric(body.total_views),
    total_messages: readMetric(body.total_messages),
    stale_listings: readMetric(body.stale_listings),
    review_queue_count: readMetric(body.review_queue_count),
    review_new_count: readMetric(body.review_new_count),
    review_delete_count: readMetric(body.review_delete_count),
    review_price_change_count: readMetric(body.review_price_change_count),
    posts_this_month: readMetric(body.posts_this_month),
    lifecycle_updated_at: toIso(body.lifecycle_updated_at || new Date().toISOString())
  };
}

function mergeAccountSnapshot(existing, nextSummary, partialSync = false) {
  const prev = existing && typeof existing === "object" ? existing : {};
  const pick = (field, fallback = 0) => {
    if (!partialSync) return nextSummary[field];
    return nextSummary[field] == null ? numberOrZero(prev[field] ?? fallback) : nextSummary[field];
  };

  return {
    ...prev,
    queue_count: pick("queue_count"),
    active_listings: pick("active_listings"),
    total_views: pick("total_views"),
    total_messages: pick("total_messages"),
    stale_listings: pick("stale_listings"),
    review_queue_count: pick("review_queue_count"),
    review_new_count: pick("review_new_count"),
    review_delete_count: pick("review_delete_count"),
    review_price_change_count: pick("review_price_change_count"),
    posts_today: pick("posts_today"),
    posts_this_month: pick("posts_this_month"),
    posting_limit: pick("posting_limit"),
    posts_remaining: pick("posts_remaining"),
    lifecycle_updated_at: nextSummary.lifecycle_updated_at || prev.lifecycle_updated_at || new Date().toISOString(),
    top_listing_title: clean(
      (partialSync && !clean(nextSummary.top_listing_title))
        ? (prev.top_listing_title || "None yet")
        : (nextSummary.top_listing_title || prev.top_listing_title || "None yet")
    )
  };
}

function computeTopListingTitle(listings) {
  const best = [...(Array.isArray(listings) ? listings : [])]
    .sort((a, b) => {
      const scoreA =
        (numberOrZero(a.messages_count) * 1000) +
        (numberOrZero(a.views_count) * 10) +
        (new Date(a.posted_at || 0).getTime() / 100000000);

      const scoreB =
        (numberOrZero(b.messages_count) * 1000) +
        (numberOrZero(b.views_count) * 10) +
        (new Date(b.posted_at || 0).getTime() / 100000000);

      return scoreB - scoreA;
    })[0] || null;

  return clean(best?.title || "None yet");
}

function mergeListingRow(existing, incoming) {
  const prev = existing && typeof existing === "object" ? existing : {};
  const next = incoming && typeof incoming === "object" ? incoming : {};

  return {
    ...prev,
    ...next,
    id: normalizeKey(next.id || prev.id),
    user_id: clean(next.user_id || prev.user_id),
    email: clean(next.email || prev.email).toLowerCase(),
    dealership_id: clean(next.dealership_id || prev.dealership_id || ""),
    vin: clean(next.vin || prev.vin || "").toUpperCase(),
    stock_number: clean(next.stock_number || prev.stock_number || ""),
    source_url: clean(next.source_url || prev.source_url || ""),
    image_url: clean(next.image_url || prev.image_url || ""),
    year: numberOrZero(next.year || prev.year),
    make: clean(next.make || prev.make || ""),
    model: clean(next.model || prev.model || ""),
    trim: clean(next.trim || prev.trim || ""),
    vehicle_type: clean(next.vehicle_type || prev.vehicle_type || ""),
    body_style: clean(next.body_style || prev.body_style || ""),
    exterior_color: clean(next.exterior_color || prev.exterior_color || ""),
    fuel_type: clean(next.fuel_type || prev.fuel_type || ""),
    mileage: numberOrZero(next.mileage || prev.mileage),
    price: numberOrZero(next.price || prev.price),
    title: clean(next.title || prev.title || ""),
    status: clean(next.status || prev.status || "posted").toLowerCase(),
    lifecycle_status: clean(next.lifecycle_status || prev.lifecycle_status || "").toLowerCase(),
    review_bucket: clean(next.review_bucket || prev.review_bucket || ""),
    posted_at: toIso(next.posted_at || prev.posted_at || new Date().toISOString()),
    views_count:
      next.views_count != null && numberOrZero(next.views_count) > 0
        ? numberOrZero(next.views_count)
        : numberOrZero(prev.views_count),
    messages_count:
      next.messages_count != null && numberOrZero(next.messages_count) > 0
        ? numberOrZero(next.messages_count)
        : numberOrZero(prev.messages_count),
    updated_at: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const userId = clean(body.user_id || body.userId || body.id);
    const email = clean(body.email).toLowerCase();
    const dealershipId = clean(body.dealership_id || body.dealershipId || "");
    const partialSync = Boolean(body.partial_sync || clean(body.sync_reason || "") === "post_commit");

    if (!userId || !email) {
      return res.status(400).json({
        ok: false,
        error: "Missing user_id or email"
      });
    }

    const incomingListingRows = Array.isArray(body.listings)
      ? body.listings
          .map((row) => normalizeListingRow(row, userId, email))
          .filter(Boolean)
      : [];

    const summary = {
      ...buildSummaryPayload(body, partialSync),
      top_listing_title: computeTopListingTitle(incomingListingRows)
    };

    const { data: existingSub, error: subLookupError } = await supabase
      .from("subscriptions")
      .select("user_id,email,account_snapshot")
      .eq("email", email)
      .maybeSingle();

    if (subLookupError) {
      console.error("sync-lifecycle subscription lookup error:", subLookupError);
      return res.status(500).json({
        ok: false,
        error: "Subscription lookup failed",
        detail: subLookupError.message
      });
    }

    const nextAccountSnapshot = mergeAccountSnapshot(
      existingSub?.account_snapshot,
      summary,
      partialSync
    );

    const { error: subUpsertError } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          email,
          account_snapshot: nextAccountSnapshot,
          updated_at: new Date().toISOString()
        },
        { onConflict: "email" }
      );

    if (subUpsertError) {
      console.error("sync-lifecycle subscription upsert error:", subUpsertError);
      return res.status(500).json({
        ok: false,
        error: "Subscription update failed",
        detail: subUpsertError.message
      });
    }

    let listingsUpserted = 0;

    if (incomingListingRows.length) {
      const listingIds = incomingListingRows.map((row) => row.id).filter(Boolean);

      let existingRowsById = {};

      if (listingIds.length) {
        const { data: existingRows, error: existingRowsError } = await supabase
          .from("user_listings")
          .select("*")
          .in("id", listingIds);

        if (existingRowsError) {
          console.error("sync-lifecycle existing listing lookup error:", existingRowsError);
          return res.status(500).json({
            ok: false,
            error: "Existing listing lookup failed",
            detail: existingRowsError.message
          });
        }

        existingRowsById = Object.fromEntries(
          (Array.isArray(existingRows) ? existingRows : []).map((row) => [clean(row.id), row])
        );
      }

      const payload = incomingListingRows.map((row) =>
        mergeListingRow(existingRowsById[clean(row.id)], {
          ...row,
          user_id: userId,
          email,
          dealership_id: row.dealership_id || dealershipId || ""
        })
      );

      const { error: userListingsUpsertError } = await supabase
        .from("user_listings")
        .upsert(payload, { onConflict: "id" });

      if (userListingsUpsertError) {
        console.error("sync-lifecycle user_listings upsert error:", userListingsUpsertError);
        return res.status(500).json({
          ok: false,
          error: "user_listings upsert failed",
          detail: userListingsUpsertError.message
        });
      }

      const { error: listingsMirrorError } = await supabase
        .from("listings")
        .upsert(payload, { onConflict: "id" });

      if (listingsMirrorError) {
        console.error("sync-lifecycle listings mirror upsert error:", listingsMirrorError);
      }

      listingsUpserted = payload.length;
    }

    return res.status(200).json({
      ok: true,
      user_id: userId,
      email,
      summary,
      listings_upserted: listingsUpserted
    });
  } catch (error) {
    console.error("sync-lifecycle fatal error:", error);
    return res.status(500).json({
      ok: false,
      error: "Unexpected sync-lifecycle error",
      detail: error.message || "Unknown error"
    });
  }
}
