
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
  "listing_card_opened",
  "listing_view_sync",
  "listing_view_sync_v2"
]);



async function resolveListingId(payload) {
  const directId = clean(payload.listing_id || payload.listingId || "");
  if (directId) return directId;
  const marketplaceId = clean(payload.metadata?.marketplace_listing_id || payload.marketplace_listing_id || "");
  const sourceUrl = clean(payload.metadata?.source_url || payload.source_url || "");
  const email = normalizeEmail(payload.email || "");
  if (marketplaceId) {
    let query = supabase.from("user_listings").select("id").eq("marketplace_listing_id", marketplaceId).limit(1).maybeSingle();
    if (email) query = query.ilike("email", email);
    const { data } = await query;
    if (data?.id) return data.id;
  }
  if (sourceUrl) {
    let query = supabase.from("user_listings").select("id").eq("source_url", sourceUrl).limit(1).maybeSingle();
    if (email) query = query.ilike("email", email);
    const { data } = await query;
    if (data?.id) return data.id;
  }
  return "";
}

async function bumpListingMetric(listingId, updates) {
  if (!listingId) return;

  const payload = { ...updates, updated_at: nowIso() };
  if ("last_seen_at" in updates) payload.last_seen_at = nowIso();

  try {
    await supabase.from("user_listings").update(payload).eq("id", listingId);
  } catch (error) {
    console.warn("user_listings metric bump warning:", error);
  }

  try {
    await supabase.from("listings").update(payload).eq("id", listingId);
  } catch (error) {
    console.warn("legacy listings metric bump warning:", error);
  }
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
    payload.listing_id = payload.listing_id || await resolveListingId({ ...body, ...payload });

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

    if (payload.listing_id) {
      if (payload.action === "listing_viewed" || payload.action === "listing_card_opened") {
        try {
          const { data: row } = await supabase.from("user_listings").select("views_count").eq("id", payload.listing_id).maybeSingle();
          const nextViews = Number(row?.views_count || 0) + 1;
          await bumpListingMetric(payload.listing_id, { views_count: nextViews, last_seen_at: nowIso() });
        } catch (metricError) {
          console.warn("listing view metric warning:", metricError);
        }
      }

      if (payload.action === "listing_message") {
        try {
          const { data: row } = await supabase.from("user_listings").select("messages_count").eq("id", payload.listing_id).maybeSingle();
          const nextMessages = Number(row?.messages_count || 0) + 1;
          await bumpListingMetric(payload.listing_id, { messages_count: nextMessages, last_seen_at: nowIso() });
        } catch (metricError) {
          console.warn("listing message metric warning:", metricError);
        }
      }

      if (payload.action === "listing_view_sync" || payload.action === "listing_view_sync_v2") {
        try {
          const incomingViews = Number(payload.metadata?.views_count ?? payload.metadata?.views ?? body.views_count ?? body.views ?? 0);
          const { data: row } = await supabase.from("user_listings").select("views_count").eq("id", payload.listing_id).maybeSingle();
          const nextViews = Math.max(Number(row?.views_count || 0), incomingViews);
          await bumpListingMetric(payload.listing_id, { views_count: nextViews, last_seen_at: nowIso() });
        } catch (metricError) {
          console.warn("listing view sync metric warning:", metricError);
        }
      }
    }

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error("log-usage fatal error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}
