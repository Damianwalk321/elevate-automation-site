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
  // Basic CORS / headers safety
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method === "GET") {
      return await handleGet(req, res);
    }

    if (req.method === "POST") {
      return await handlePost(req, res);
    }

    return res.status(405).json({
      error: "Method not allowed"
    });
  } catch (error) {
    console.error("api/profile unexpected error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}

async function handleGet(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({
      error: "Missing required query param: id"
    });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      email,
      full_name,
      dealership,
      city,
      province,
      phone,
      license_number,
      listing_location,
      dealer_phone,
      dealer_email,
      compliance_mode,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("api/profile GET error:", error);
    return res.status(500).json({
      error: error.message
    });
  }

  return res.status(200).json({
    data: data || null
  });
}

async function handlePost(req, res) {
  const {
    id,
    email = "",
    full_name = "",
    dealership = "",
    city = "",
    province = "",
    phone = "",
    license_number = "",
    listing_location = "",
    dealer_phone = "",
    dealer_email = "",
    compliance_mode = ""
  } = req.body || {};

  if (!id) {
    return res.status(400).json({
      error: "Missing required field: id"
    });
  }

  const cleanPayload = {
    id: String(id).trim(),
    email: String(email || "").trim(),
    full_name: String(full_name || "").trim(),
    dealership: String(dealership || "").trim(),
    city: String(city || "").trim(),
    province: String(province || "").trim(),
    phone: String(phone || "").trim(),
    license_number: String(license_number || "").trim(),
    listing_location: String(listing_location || "").trim(),
    dealer_phone: String(dealer_phone || "").trim(),
    dealer_email: String(dealer_email || "").trim(),
    compliance_mode: String(compliance_mode || "").trim(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(cleanPayload, {
      onConflict: "id"
    })
    .select(`
      id,
      email,
      full_name,
      dealership,
      city,
      province,
      phone,
      license_number,
      listing_location,
      dealer_phone,
      dealer_email,
      compliance_mode,
      created_at,
      updated_at
    `)
    .single();

  if (error) {
    console.error("api/profile POST error:", error);
    return res.status(500).json({
      error: error.message
    });
  }

  return res.status(200).json({
    success: true,
    data
  });
}