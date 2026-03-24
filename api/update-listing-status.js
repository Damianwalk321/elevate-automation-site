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

function allowedStatus(value) {
  const status = clean(value).toLowerCase();
  const allowed = ["posted", "active", "stale", "sold", "deleted", "inactive", "failed"];
  return allowed.includes(status) ? status : null;
}

function nowIso() {
  return new Date().toISOString();
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

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const listingId = clean(body.listingId || body.listing_id || "");
    const userId = clean(body.userId || body.user_id || "");
    const email = normalizeEmail(body.email || "");
    const nextStatus = allowedStatus(body.status);

    if (!listingId) {
      return res.status(400).json({ error: "Missing listingId" });
    }

    if (!nextStatus) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const user = await resolveUser({ userId, email });
    const finalUserId = clean(user?.id || userId || "");
    const finalEmail = normalizeEmail(user?.email || email || "");

    let query = supabase
      .from("user_listings")
      .update({
        status: nextStatus,
        updated_at: nowIso(),
        last_seen_at: nowIso()
      })
      .eq("id", listingId);

    if (finalUserId) {
      query = query.eq("user_id", finalUserId);
    } else if (finalEmail) {
      query = query.eq("email", finalEmail);
    }

    const { data, error } = await query.select("*").single();

    if (error) {
      console.error("update-listing-status error:", error);
      return res.status(500).json({ error: error.message });
    }

    try {
      let legacyQuery = supabase
        .from("listings")
        .update({ status: nextStatus, updated_at: nowIso(), last_seen_at: nowIso() })
        .eq("id", listingId);
      if (finalUserId) legacyQuery = legacyQuery.eq("user_id", finalUserId);
      else if (finalEmail) legacyQuery = legacyQuery.eq("email", finalEmail);
      await legacyQuery;
    } catch (legacyError) {
      console.warn("legacy listings mirror update warning:", legacyError);
    }

    try {
      await supabase.from("usage_logs").insert([
        {
          user_id: finalUserId || null,
          email: finalEmail || "",
          action: "listing_status_updated",
          listing_id: listingId,
          metadata: {
            status: nextStatus
          },
          created_at: nowIso()
        }
      ]);
    } catch (logError) {
      console.warn("usage_logs insert warning:", logError);
    }

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error("update-listing-status fatal error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}
