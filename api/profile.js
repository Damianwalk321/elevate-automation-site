import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env: SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method === "GET") {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({
          error: "Missing id"
        });
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("PROFILE GET ERROR:", error);
        return res.status(500).json({
          error: error.message
        });
      }

      return res.status(200).json({
        data: data || null
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};

      const payload = {
        id: body.id ? String(body.id).trim() : null,
        email: body.email ? String(body.email).trim().toLowerCase() : "",
        full_name: body.full_name ? String(body.full_name).trim() : "",
        dealership: body.dealership ? String(body.dealership).trim() : "",
        city: body.city ? String(body.city).trim() : "",
        province: body.province ? String(body.province).trim() : "",
        phone: body.phone ? String(body.phone).trim() : "",
        license_number: body.license_number ? String(body.license_number).trim() : "",
        listing_location: body.listing_location ? String(body.listing_location).trim() : "",
        dealer_phone: body.dealer_phone ? String(body.dealer_phone).trim() : "",
        dealer_email: body.dealer_email ? String(body.dealer_email).trim() : "",
        compliance_mode: body.compliance_mode ? String(body.compliance_mode).trim() : "",
        updated_at: new Date().toISOString()
      };

      if (!payload.id) {
        return res.status(400).json({
          error: "Missing required field: id"
        });
      }

      console.log("PROFILE SAVE PAYLOAD:", payload);

      const { data, error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();

      if (error) {
        console.error("PROFILE POST ERROR:", error);
        return res.status(500).json({
          error: error.message,
          details: error.details || null,
          hint: error.hint || null,
          code: error.code || null
        });
      }

      return res.status(200).json({
        success: true,
        data
      });
    }

    return res.status(405).json({
      error: "Method not allowed"
    });
  } catch (error) {
    console.error("PROFILE ROUTE FATAL ERROR:", error);

    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}