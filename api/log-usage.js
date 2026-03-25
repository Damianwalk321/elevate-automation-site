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

function nowIso() {
  return new Date().toISOString();
}

const ALLOWED_ACTIONS = new Set([
  "autofill_started",
  "autofill_completed",
  "autofill_failed",
  "listing_copy_inserted",
  "photo_upload_started",
  "photo_upload_completed",
  "photo_upload_failed",
  "next_clicked",
  "post_clicked",
  "post_success",
  "post_failed",
  "queue_next_loaded",
  "post_created",
  "post_updated",
  "listing_status_updated",
  "listing_viewed",
  "listing_message",
  "listing_card_opened"
]);


async function incrementListingMetric(tableName, payload, fieldName) {
  const listingId = clean(payload.listing_id || payload.listingId || "");
  const email = normalizeEmail(payload.email || "");
  const sourceUrl = clean(payload.metadata?.source_url || "");

  let existing = null;
  if (listingId) {
    const { data, error } = await supabase.from(tableName).select("*").eq("id", listingId).maybeSingle();
    if (error && !String(error.message || "").includes("No rows")) throw error;
    existing = data || null;
  }

  if (!existing && sourceUrl) {
    const { data, error } = await supabase.from(tableName).select("*").eq("source_url", sourceUrl).limit(1).maybeSingle();
    if (error && !String(error.message || "").includes("No rows")) throw error;
    existing = data || null;
  }

  if (!existing && email) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .ilike("email", email)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error && !String(error.message || "").includes("No rows")) throw error;
    existing = data || null;
  }

  if (!existing) return null;

  const nextValue = Number(existing?.[fieldName] || 0) + 1;
  const { data, error } = await supabase
    .from(tableName)
    .update({ [fieldName]: nextValue, updated_at: nowIso(), last_seen_at: nowIso() })
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const payload = {
      user_id: clean(body.userId || body.user_id || "") || null,
      email: normalizeEmail(body.email || ""),
      action: clean(body.action || ""),
      listing_id: clean(body.listingId || body.listing_id || "") || null,
      metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {},
      created_at: nowIso()
    };

    if (!payload.user_id && !payload.email) {
      return res.status(400).json({ error: "Missing userId or email" });
    }

    if (!payload.action) {
      return res.status(400).json({ error: "Missing action" });
    }

    if (!ALLOWED_ACTIONS.has(payload.action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    const { data, error } = await supabase
      .from("usage_logs")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      console.error("log-usage error:", error);
      return res.status(500).json({ error: error.message });
    }

    let userListing = null;
    let legacyListing = null;
    if (["listing_viewed", "listing_card_opened"].includes(payload.action)) {
      userListing = await incrementListingMetric("user_listings", payload, "views_count");
      legacyListing = await incrementListingMetric("listings", payload, "views_count");
    }
    if (payload.action === "listing_message") {
      userListing = await incrementListingMetric("user_listings", payload, "messages_count");
      legacyListing = await incrementListingMetric("listings", payload, "messages_count");
    }

    return res.status(200).json({
      success: true,
      data,
      listing: userListing || legacyListing || null
    });
  } catch (error) {
    console.error("log-usage fatal error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}
