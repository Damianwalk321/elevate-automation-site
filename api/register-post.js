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
  if (!status) return "posted";
  return status;
}

function nowIso() {
  return new Date().toISOString();
}

function buildTitle(payload) {
  const explicit = clean(payload.title || "");
  if (explicit) return explicit;

  return [
    payload.year ? String(payload.year) : "",
    clean(payload.make || ""),
    clean(payload.model || ""),
    clean(payload.trim || "")
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || "Vehicle Listing";
}

async function resolveUserByEmailOrId({ userId, email }) {
  let query = supabase.from("users").select("id,email");

  if (userId) {
    const { data, error } = await query.eq("id", userId).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (email) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  return null;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const userId = clean(body.userId || body.user_id || "");
    const email = normalizeEmail(body.email || "");
    const dealershipId = clean(body.dealerId || body.dealership_id || "");
    const sourceUrl = clean(body.sourceUrl || body.source_url || "");
    const vin = clean(body.vin || "");
    const stockNumber = clean(body.stockNumber || body.stock_number || "");
    const marketplaceListingId = clean(body.marketplaceListingId || body.marketplace_listing_id || "");

    const user = await resolveUserByEmailOrId({ userId, email });
    const finalUserId = clean(user?.id || userId || "");
    const finalEmail = normalizeEmail(user?.email || email || "");

    if (!finalUserId && !finalEmail) {
      return res.status(400).json({
        error: "Missing userId or email"
      });
    }

    const payload = {
      user_id: finalUserId || null,
      email: finalEmail || "",
      dealership_id: dealershipId || null,
      vin,
      stock_number: stockNumber,
      source_url: sourceUrl,
      marketplace_listing_id: marketplaceListingId,
      year: safeNumber(body.year, null),
      make: clean(body.make || ""),
      model: clean(body.model || ""),
      trim: clean(body.trim || ""),
      vehicle_type: clean(body.vehicleType || body.vehicle_type || ""),
      body_style: clean(body.bodyStyle || body.body_style || ""),
      exterior_color: clean(body.exteriorColor || body.exterior_color || body.color || ""),
      fuel_type: clean(body.fuelType || body.fuel_type || ""),
      mileage: safeNumber(body.mileage, 0),
      price: safeNumber(body.price, 0),
      title: buildTitle(body),
      image_url: clean(
        body.imageUrl ||
        body.image_url ||
        body.cover_photo ||
        body.coverImage ||
        ""
      ),
      status: normalizeStatus(body.status || "posted"),
      posted_at: clean(body.postedAt || body.posted_at || "") || nowIso(),
      last_seen_at: nowIso(),
      updated_at: nowIso()
    };

    const duplicateChecks = [];

    if (payload.source_url) duplicateChecks.push({ field: "source_url", value: payload.source_url });
    if (payload.vin) duplicateChecks.push({ field: "vin", value: payload.vin });
    if (payload.marketplace_listing_id) duplicateChecks.push({ field: "marketplace_listing_id", value: payload.marketplace_listing_id });

    let existingListing = null;

    for (const check of duplicateChecks) {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq(check.field, check.value)
        .eq("user_id", finalUserId || null)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("register-post duplicate lookup error:", error);
      }

      if (data) {
        existingListing = data;
        break;
      }
    }

    let savedListing = null;

    if (existingListing) {
      const updatePayload = {
        ...payload,
        created_at: undefined
      };

      const { data, error } = await supabase
        .from("listings")
        .update(updatePayload)
        .eq("id", existingListing.id)
        .select("*")
        .single();

      if (error) {
        console.error("register-post update error:", error);
        return res.status(500).json({ error: error.message });
      }

      savedListing = data;
    } else {
      const insertPayload = {
        ...payload,
        created_at: nowIso(),
        views_count: safeNumber(body.views_count ?? body.views, 0),
        messages_count: safeNumber(body.messages_count ?? body.messages, 0)
      };

      const { data, error } = await supabase
        .from("listings")
        .insert([insertPayload])
        .select("*")
        .single();

      if (error) {
        console.error("register-post insert error:", error);
        return res.status(500).json({ error: error.message });
      }

      savedListing = data;
    }

    try {
      await supabase.from("usage_logs").insert([
        {
          user_id: finalUserId || null,
          email: finalEmail || "",
          action: existingListing ? "post_updated" : "post_created",
          listing_id: savedListing.id,
          metadata: {
            vin: payload.vin || "",
            stock_number: payload.stock_number || "",
            source_url: payload.source_url || "",
            title: payload.title || "",
            status: payload.status || "posted"
          },
          created_at: nowIso()
        }
      ]);
    } catch (logError) {
      console.warn("usage_logs insert warning:", logError);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let postsToday = 0;
    if (finalUserId) {
      const { count } = await supabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", finalUserId)
        .gte("posted_at", todayStart.toISOString());

      postsToday = count || 0;
    }

    return res.status(200).json({
      success: true,
      data: savedListing,
      meta: {
        updated_existing: Boolean(existingListing),
        posts_today: postsToday
      }
    });
  } catch (error) {
    console.error("register-post fatal error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}
