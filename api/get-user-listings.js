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

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sortRows(rows, sort) {
  const items = [...rows];

  if (sort === "price_high") {
    return items.sort((a, b) => safeNumber(b.price) - safeNumber(a.price));
  }

  if (sort === "price_low") {
    return items.sort((a, b) => safeNumber(a.price) - safeNumber(b.price));
  }

  if (sort === "popular") {
    return items.sort((a, b) => {
      const scoreA =
        (safeNumber(a.messages_count) * 1000) +
        (safeNumber(a.views_count) * 10) +
        (new Date(a.posted_at || 0).getTime() / 100000000);

      const scoreB =
        (safeNumber(b.messages_count) * 1000) +
        (safeNumber(b.views_count) * 10) +
        (new Date(b.posted_at || 0).getTime() / 100000000);

      return scoreB - scoreA;
    });
  }

  return items.sort((a, b) => {
    return new Date(b.posted_at || b.created_at || 0).getTime() -
      new Date(a.posted_at || a.created_at || 0).getTime();
  });
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
    const search = clean(req.query?.search || "").toLowerCase();
    const sort = clean(req.query?.sort || "newest").toLowerCase();
    const limit = Math.min(Math.max(Number(req.query?.limit || 100), 1), 250);

    const user = await resolveUser({ userId, email });
    const finalUserId = clean(user?.id || userId || "");
    const finalEmail = normalizeEmail(user?.email || email || "");

    if (!finalUserId && !finalEmail) {
      return res.status(400).json({ error: "Missing userId or email" });
    }

    let query = supabase.from("listings").select("*");

    if (finalUserId) {
      query = query.eq("user_id", finalUserId);
    } else {
      query = query.eq("email", finalEmail);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      console.error("get-user-listings error:", error);
      return res.status(500).json({ error: error.message });
    }

    let rows = Array.isArray(data) ? data : [];

    if (search) {
      rows = rows.filter((row) => {
        const haystack = [
          row.title,
          row.make,
          row.model,
          row.trim,
          row.vin,
          row.stock_number,
          row.body_style,
          row.vehicle_type
        ]
          .map((v) => clean(v).toLowerCase())
          .join(" ");

        return haystack.includes(search);
      });
    }

    rows = sortRows(rows, sort);

    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error("get-user-listings fatal error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}
