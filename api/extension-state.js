// /api/extension-state.js
// Elevate Automation - Extension State API
// CORS-safe endpoint for extension/background requests

export default async function handler(req, res) {
  const allowedOrigins = [
    "https://elevate-automation-site.vercel.app",
    "https://www.sargenttoyota.ca",
    "https://sargenttoyota.ca"
  ];

  const origin = req.headers.origin || "";

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // safe enough for current extension/debug phase
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    const email = String(req.query?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Missing email"
      });
    }

    // =====================================================
    // TEMP / FALLBACK RESPONSE
    // Replace this block with your Supabase lookup if needed
    // =====================================================

    const fallbackProfile = {
      id: "local-debug-user",
      email,
      full_name: "Damian Walker",
      dealership: "Sean Sargent Toyota",
      city: "Grande Prairie",
      province: "Alberta",
      phone: "",
      license_number: "",
      listing_location: "Grande Prairie, Alberta",
      dealer_phone: "",
      dealer_email: email,
      compliance_mode: "Alberta",
      dealer_website: "https://www.sargenttoyota.ca",
      inventory_url: "https://www.sargenttoyota.ca/new-inventory/index.htm",
      scanner_type: "dealeron",
      software_license_key: "FOUNDER-BETA"
    };

    return res.status(200).json({
      ok: true,
      access: true,
      active: true,
      status: "active",
      plan: "Founder Beta",
      email,
      user_id: "local-debug-user",
      license_key: "FOUNDER-BETA",
      posting_limit: 25,
      posts_today: 0,
      posts_remaining: 25,
      dealer_site: "https://www.sargenttoyota.ca",
      inventory_url: "https://www.sargenttoyota.ca/new-inventory/index.htm",
      scanner_type: "dealeron",
      profile: fallbackProfile
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Internal server error"
    });
  }
}
