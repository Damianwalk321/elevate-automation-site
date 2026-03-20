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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (profileError) {
        console.error("PROFILE GET ERROR:", profileError);
        return res.status(500).json({
          error: profileError.message
        });
      }

      let softwareLicenseKey = "";

      if (profile?.email) {
        const { data: subscription, error: subscriptionError } = await supabase
          .from("subscriptions")
          .select("license_key")
          .eq("email", String(profile.email).trim().toLowerCase())
          .maybeSingle();

        if (!subscriptionError) {
          softwareLicenseKey = subscription?.license_key || "";
        }
      }

      return res.status(200).json({
        data: profile
          ? {
              ...profile,
              software_license_key: softwareLicenseKey
            }
          : null
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
        dealer_email: body.dealer_email ? String(body.dealer_email).trim().toLowerCase() : "",
        compliance_mode: body.compliance_mode ? String(body.compliance_mode).trim() : "",
        dealer_website: body.dealer_website ? String(body.dealer_website).trim() : "",
        inventory_url: body.inventory_url ? String(body.inventory_url).trim() : "",
        scanner_type: body.scanner_type ? String(body.scanner_type).trim() : "",
        updated_at: new Date().toISOString()
      };

      if (!payload.id) {
        return res.status(400).json({
          error: "Missing required field: id"
        });
      }

      const { data: savedProfile, error: saveError } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();

      if (saveError) {
        console.error("PROFILE POST ERROR:", saveError);
        return res.status(500).json({
          error: saveError.message,
          details: saveError.details || null,
          hint: saveError.hint || null,
          code: saveError.code || null
        });
      }

      let softwareLicenseKey = "";

      if (savedProfile?.email) {
        const { data: subscription, error: subscriptionError } = await supabase
          .from("subscriptions")
          .select("license_key")
          .eq("email", String(savedProfile.email).trim().toLowerCase())
          .maybeSingle();

        if (!subscriptionError) {
          softwareLicenseKey = subscription?.license_key || "";
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          ...savedProfile,
          software_license_key: softwareLicenseKey
        }
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
