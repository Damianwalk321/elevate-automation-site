// api/sync-user.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing env: SUPABASE_URL");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function clean(value) {
  return String(value || "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const id = clean(body.id);
    const email = clean(body.email).toLowerCase();

    if (!id || !email) {
      // make this non-fatal to avoid poisoning dashboard/extension boot
      return res.status(200).json({
        ok: false,
        skipped: true,
        reason: "Missing id or email"
      });
    }

    // 1) ensure users row exists
    const { error: userUpsertError } = await supabase
      .from("users")
      .upsert(
        [
          {
            id,
            email,
            updated_at: new Date().toISOString()
          }
        ],
        {
          onConflict: "id"
        }
      );

    if (userUpsertError) {
      console.error("sync-user users upsert error:", userUpsertError);
      return res.status(200).json({
        ok: false,
        skipped: true,
        reason: "Users upsert failed",
        detail: userUpsertError.message
      });
    }

    // 2) ensure profile row exists
    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id,email")
      .eq("id", id)
      .maybeSingle();

    if (profileLookupError) {
      console.error("sync-user profile lookup error:", profileLookupError);
      return res.status(200).json({
        ok: false,
        skipped: true,
        reason: "Profile lookup failed",
        detail: profileLookupError.message
      });
    }

    if (!existingProfile) {
      const { error: profileInsertError } = await supabase
        .from("profiles")
        .insert([
          {
            id,
            email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]);

      if (profileInsertError) {
        console.error("sync-user profile insert error:", profileInsertError);
        return res.status(200).json({
          ok: false,
          skipped: true,
          reason: "Profile insert failed",
          detail: profileInsertError.message
        });
      }
    } else if (!existingProfile.email) {
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          email,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (profileUpdateError) {
        console.error("sync-user profile update error:", profileUpdateError);
        return res.status(200).json({
          ok: false,
          skipped: true,
          reason: "Profile update failed",
          detail: profileUpdateError.message
        });
      }
    }

    return res.status(200).json({
      ok: true,
      id,
      email
    });
  } catch (error) {
    console.error("sync-user fatal error:", error);
    return res.status(200).json({
      ok: false,
      skipped: true,
      reason: "Unexpected sync-user error",
      detail: error.message || "Unknown error"
    });
  }
}
