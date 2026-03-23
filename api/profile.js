
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function clean(value) {
  return String(value || "").trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function sendJson(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.json(body);
}

export default async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return sendJson(res, 500, {
        error: "Missing server env",
        detail: {
          hasSupabaseUrl: !!SUPABASE_URL,
          hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY
        }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (req.method === "GET") {
      const id = clean(req.query?.id);

      if (!id) {
        return sendJson(res, 400, { error: "Missing profile id" });
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("profile GET error:", error);
        return sendJson(res, 500, {
          error: "Failed to load profile",
          detail: error.message
        });
      }

      return sendJson(res, 200, {
        ok: true,
        data: data || null
      });
    }

    if (req.method === "POST") {
      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body || "{}")
          : (req.body || {});

      const nowIso = new Date().toISOString();

      const id = clean(body.id);
      const email = lower(body.email);
      const full_name = clean(body.full_name);
      const dealership = clean(body.dealership);
      const city = clean(body.city);
      const province = clean(body.province);
      const phone = clean(body.phone);
      const license_number = clean(body.license_number);
      const listing_location = clean(body.listing_location);
      const dealer_phone = clean(body.dealer_phone);
      const dealer_email = lower(body.dealer_email);
      const compliance_mode = clean(body.compliance_mode || "strict");
      const dealer_website = clean(body.dealer_website);
      const inventory_url = clean(body.inventory_url);
      const scanner_type = clean(body.scanner_type);

      if (!id) {
        return sendJson(res, 400, { error: "Missing profile id" });
      }

      if (!email) {
        return sendJson(res, 400, { error: "Missing email" });
      }

      const payload = {
        id,
        email,
        full_name: full_name || null,
        dealership: dealership || null,
        city: city || null,
        province: province || null,
        phone: phone || null,
        license_number: license_number || null,
        listing_location: listing_location || null,
        dealer_phone: dealer_phone || null,
        dealer_email: dealer_email || null,
        compliance_mode: compliance_mode || "strict",
        dealer_website: dealer_website || null,
        inventory_url: inventory_url || null,
        scanner_type: scanner_type || null,
        updated_at: nowIso
      };

      const { data: existingProfile, error: lookupError } = await supabase
        .from("profiles")
        .select("id, created_at")
        .eq("id", id)
        .maybeSingle();

      if (lookupError) {
        console.error("profile lookup error:", lookupError);
        return sendJson(res, 500, {
          error: "Failed to lookup profile",
          detail: lookupError.message
        });
      }

      let result;
      let writeError;

      if (existingProfile) {
        ({ data: result, error: writeError } = await supabase
          .from("profiles")
          .update(payload)
          .eq("id", id)
          .select()
          .single());
      } else {
        ({ data: result, error: writeError } = await supabase
          .from("profiles")
          .insert({
            ...payload,
            created_at: nowIso
          })
          .select()
          .single());
      }

      if (writeError) {
        console.error("profile save error:", writeError);
        return sendJson(res, 500, {
          error: "Failed to save profile",
          detail: writeError.message
        });
      }

      return sendJson(res, 200, {
        ok: true,
        data: result
      });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error("profile fatal error:", error);
    return sendJson(res, 500, {
      error: "Unexpected profile error",
      detail: error?.message || String(error)
    });
  }
}
