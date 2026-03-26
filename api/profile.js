import { createClient } from "@supabase/supabase-js";
import { getVerifiedRequestUser } from "./_shared/auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function clean(value) {
  return String(value || "").trim();
}
function lower(value) {
  return clean(value).toLowerCase();
}
function normalizeUrl(value) {
  const v = clean(value);
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}
function buildCompletion(data = {}) {
  const checks = {
    full_name: Boolean(clean(data.full_name || data.salesperson_name)),
    dealership: Boolean(clean(data.dealership || data.dealer_name)),
    province: Boolean(clean(data.province)),
    compliance_mode: Boolean(clean(data.compliance_mode)),
    inventory_url: Boolean(clean(data.inventory_url)),
    listing_location: Boolean(clean(data.listing_location))
  };
  const total = Object.keys(checks).length;
  const completedFields = Object.entries(checks).filter(([, value]) => Boolean(value)).map(([key]) => key);
  const missingFields = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
  const blockers = missingFields.map((key) => {
    if (key === "full_name") return "Add your salesperson name.";
    if (key === "dealership") return "Add your dealership or company name.";
    if (key === "province") return "Select your province.";
    if (key === "compliance_mode") return "Choose your compliance mode.";
    if (key === "inventory_url") return "Save your inventory URL.";
    if (key === "listing_location") return "Set your default listing location.";
    return `Complete ${key}.`;
  });
  const recommendedNextStep = blockers[0] || "Profile is ready.";
  return {
    ready: completedFields.length === total,
    score: total ? completedFields.length / total : 0,
    percent: total ? Math.round((completedFields.length / total) * 100) : 0,
    completed_fields: completedFields,
    missing_fields: missingFields,
    blockers,
    recommended_next_step: recommendedNextStep,
    checks
  };
}
function sendJson(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.json(body);
}

export default async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return sendJson(res, 500, { error: "Missing server env" });
    }
    const verifiedUser = await getVerifiedRequestUser(req);
    if (!verifiedUser?.id || !verifiedUser?.email) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (req.method === "GET") {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", verifiedUser.id).maybeSingle();
      if (error) {
        console.error("profile GET error:", error);
        return sendJson(res, 500, { error: "Failed to load profile", detail: error.message });
      }
      return sendJson(res, 200, { ok: true, data: data || null, meta: { completion: buildCompletion(data || {}) } });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const nowIso = new Date().toISOString();
      const payload = {
        id: clean(verifiedUser.id),
        email: lower(verifiedUser.email),
        full_name: clean(body.full_name) || null,
        dealership: clean(body.dealership) || null,
        city: clean(body.city) || null,
        province: clean(body.province) || null,
        phone: clean(body.phone) || null,
        license_number: clean(body.license_number) || null,
        listing_location: clean(body.listing_location) || null,
        dealer_phone: clean(body.dealer_phone) || null,
        dealer_email: lower(body.dealer_email) || null,
        compliance_mode: clean(body.compliance_mode || "strict") || "strict",
        dealer_website: normalizeUrl(body.dealer_website) || null,
        inventory_url: normalizeUrl(body.inventory_url) || null,
        scanner_type: clean(body.scanner_type) || null,
        updated_at: nowIso
      };

      const { data: existingProfile, error: lookupError } = await supabase.from("profiles").select("id, created_at").eq("id", payload.id).maybeSingle();
      if (lookupError) {
        console.error("profile lookup error:", lookupError);
        return sendJson(res, 500, { error: "Failed to lookup profile", detail: lookupError.message });
      }

      let result;
      let writeError;
      if (existingProfile) {
        ({ data: result, error: writeError } = await supabase.from("profiles").update(payload).eq("id", payload.id).select().single());
      } else {
        ({ data: result, error: writeError } = await supabase.from("profiles").insert({ ...payload, created_at: nowIso }).select().single());
      }
      if (writeError) {
        console.error("profile save error:", writeError);
        return sendJson(res, 500, { error: "Failed to save profile", detail: writeError.message });
      }
      return sendJson(res, 200, { ok: true, data: result, meta: { completion: buildCompletion(result || payload) } });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error("profile fatal error:", error);
    return sendJson(res, 500, { error: "Unexpected profile error", detail: error?.message || String(error) });
  }
}
