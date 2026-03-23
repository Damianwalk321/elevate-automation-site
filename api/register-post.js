import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function clean(value) {
  return String(value || "").trim();
}

function sendJson(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.json(body);
}

export default async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return sendJson(res, 500, { error: "Missing env" });
    }

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const user_id = clean(body.user_id);
    const vehicle_id = clean(body.vehicle_id);
    const title = clean(body.title);
    const price = Number(body.price || 0);
    const location = clean(body.location);
    const created_at = new Date().toISOString();

    if (!user_id || !vehicle_id) {
      return sendJson(res, 400, {
        error: "Missing user_id or vehicle_id"
      });
    }

    // -------------------------
    // WRITE TO listings (existing)
    // -------------------------
    const { error: listingsError } = await supabase
      .from("listings")
      .upsert({
        user_id,
        vehicle_id,
        title,
        price,
        location,
        status: "active",
        updated_at: created_at
      });

    if (listingsError) {
      console.error("listings write error:", listingsError);
    }

    // -------------------------
    // WRITE TO user_listings (NEW - DASHBOARD FIX)
    // -------------------------
    const { error: userListingsError } = await supabase
      .from("user_listings")
      .upsert({
        user_id,
        vehicle_id,
        title,
        price,
        location,
        status: "active",
        updated_at: created_at
      });

    if (userListingsError) {
      console.error("user_listings write error:", userListingsError);
    }

    return sendJson(res, 200, {
      ok: true,
      message: "Post registered",
      vehicle_id
    });
  } catch (error) {
    console.error("register-post fatal:", error);
    return sendJson(res, 500, {
      error: "Unexpected error",
      detail: error?.message || String(error)
    });
  }
}
