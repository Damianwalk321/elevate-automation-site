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

async function resolveUser({ userId, email }) {
  if (userId) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email")
      .eq("id", userId)
      .maybeSingle();

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

function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function dayStartIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userId = clean(req.query?.userId || req.query?.user_id || "");
    const email = normalizeEmail(req.query?.email || "");

    const user = await resolveUser({ userId, email });
    const finalUserId = clean(user?.id || userId || "");
    const finalEmail = normalizeEmail(user?.email || email || "");

    if (!finalUserId && !finalEmail) {
      return res.status(400).json({ error: "Missing userId or email" });
    }

    let listingQuery = supabase.from("listings").select("*");

    if (finalUserId) {
      listingQuery = listingQuery.eq("user_id", finalUserId);
    } else {
      listingQuery = listingQuery.eq("email", finalEmail);
    }

    const { data: listings, error: listingsError } = await listingQuery.order("posted_at", { ascending: false });

    if (listingsError) {
      console.error("get-dashboard-summary listings error:", listingsError);
      return res.status(500).json({ error: listingsError.message });
    }

    const rows = Array.isArray(listings) ? listings : [];
    const todayStart = new Date(dayStartIso()).getTime();
    const monthStart = new Date(monthStartIso()).getTime();

    let postsToday = 0;
    let postsThisMonth = 0;
    let activeListings = 0;
    let totalViews = 0;
    let totalMessages = 0;
    let staleListings = 0;

    const staleCutoff = Date.now() - (14 * 24 * 60 * 60 * 1000);

    for (const row of rows) {
      const postedTime = new Date(row.posted_at || row.created_at || 0).getTime();
      const lastSeenTime = new Date(row.last_seen_at || row.updated_at || row.posted_at || 0).getTime();
      const status = clean(row.status || "posted").toLowerCase();

      if (postedTime >= todayStart) postsToday += 1;
      if (postedTime >= monthStart) postsThisMonth += 1;
      if (!["sold", "deleted", "inactive"].includes(status)) activeListings += 1;
      if (lastSeenTime && lastSeenTime < staleCutoff && status !== "sold") staleListings += 1;

      totalViews += safeNumber(row.views_count, 0);
      totalMessages += safeNumber(row.messages_count, 0);
    }

    const topListing = [...rows]
      .sort((a, b) => {
        const scoreA =
          (safeNumber(a.messages_count, 0) * 1000) +
          (safeNumber(a.views_count, 0) * 10) +
          (new Date(a.posted_at || 0).getTime() / 100000000);

        const scoreB =
          (safeNumber(b.messages_count, 0) * 1000) +
          (safeNumber(b.views_count, 0) * 10) +
          (new Date(b.posted_at || 0).getTime() / 100000000);

        return scoreB - scoreA;
      })[0] || null;

    const recentListings = rows.slice(0, 5).map((row) => ({
      id: row.id,
      title: row.title,
      image_url: row.image_url || "",
      price: safeNumber(row.price, 0),
      mileage: safeNumber(row.mileage, 0),
      status: row.status || "posted",
      posted_at: row.posted_at || row.created_at,
      views_count: safeNumber(row.views_count, 0),
      messages_count: safeNumber(row.messages_count, 0)
    }));

    return res.status(200).json({
      success: true,
      data: {
        posts_today: postsToday,
        posts_this_month: postsThisMonth,
        active_listings: activeListings,
        stale_listings: staleListings,
        total_views: totalViews,
        total_messages: totalMessages,
        top_listing_title: topListing?.title || "None yet",
        total_listings: rows.length,
        recent_listings: recentListings
      }
    });
  } catch (error) {
    console.error("get-dashboard-summary fatal error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}