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

function normalizeProvince(value) {
  const raw = clean(value).toUpperCase();
  if (!raw) return "";
  if (raw === "ALBERTA" || raw.startsWith("AB")) return "AB";
  if (raw === "BRITISH COLUMBIA" || raw.startsWith("BC")) return "BC";
  return raw;
}
function normalizeComplianceMode(value, province = "") {
  const raw = clean(value).toUpperCase();
  if (!raw || raw === "STRICT") return normalizeProvince(province);
  if (raw === "ALBERTA" || raw.startsWith("AB")) return "AB";
  if (raw === "BRITISH COLUMBIA" || raw.startsWith("BC")) return "BC";
  return raw;
}
function parseJsonBody(body) {
  if (!body) return {};
  if (typeof body === "object") return body;
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}
function buildCompletion(data = {}) {
  const checks = {
    full_name: Boolean(clean(data.full_name || data.salesperson_name)),
    dealership: Boolean(clean(data.dealership || data.dealer_name || data.company_name)),
    province: Boolean(clean(data.province)),
    compliance_mode: Boolean(clean(data.compliance_mode)),
    inventory_url: Boolean(clean(data.inventory_url)),
    listing_location: Boolean(clean(data.listing_location || data.city))
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
  return {
    ready: completedFields.length === total,
    score: total ? completedFields.length / total : 0,
    percent: total ? Math.round((completedFields.length / total) * 100) : 0,
    completed_fields: completedFields,
    missing_fields: missingFields,
    blockers,
    recommended_next_step: blockers[0] || "Profile is ready.",
    checks
  };
}
function sendJson(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.json(body);
}
async function findProfileRow(supabase, { userId = "", email = "" } = {}) {
  const id = clean(userId);
  const normalizedEmail = lower(email);
  const attempts = [
    () => id ? supabase.from("profiles").select("*").eq("id", id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    () => id ? supabase.from("profiles").select("*").eq("user_id", id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    () => normalizedEmail ? supabase.from("profiles").select("*").ilike("email", normalizedEmail).order("updated_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null, error: null })
  ];
  for (const run of attempts) {
    const { data, error } = await run();
    if (!error && data) return data;
  }
  return null;
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
      const profile = await findProfileRow(supabase, {
        userId: verifiedUser.id,
        email: verifiedUser.email
      });

      return sendJson(res, 200, {
        ok: true,
        data: profile || null,
        meta: { completion: buildCompletion(profile || {}) }
      });
    }

    if (req.method === "POST") {
      const body = parseJsonBody(req.body);
      const nowIso = new Date().toISOString();

      const normalizedProvince = normalizeProvince(body.province);
      const payload = {
        id: clean(verifiedUser.id),
        email: lower(verifiedUser.email),
        full_name: clean(body.full_name) || null,
        dealership: clean(body.dealership || body.dealer_name || body.company_name) || null,
        city: clean(body.city) || null,
        province: normalizedProvince || null,
        phone: clean(body.phone) || null,
        license_number: clean(body.license_number) || null,
        listing_location: clean(body.listing_location || body.city) || null,
        dealer_phone: clean(body.dealer_phone) || null,
        dealer_email: lower(body.dealer_email) || null,
        compliance_mode: normalizeComplianceMode(body.compliance_mode, normalizedProvince) || null,
        dealer_website: normalizeUrl(body.dealer_website) || null,
        inventory_url: normalizeUrl(body.inventory_url) || null,
        scanner_type: clean(body.scanner_type) || null,
        updated_at: nowIso
      };

      const existingProfile = await findProfileRow(supabase, {
        userId: verifiedUser.id,
        email: verifiedUser.email
      });

      let writeQuery;
      if (existingProfile?.id) {
        writeQuery = supabase.from("profiles").update(payload).eq("id", existingProfile.id).select().single();
      } else if (existingProfile?.user_id) {
        writeQuery = supabase.from("profiles").update({ ...payload, user_id: verifiedUser.id }).eq("user_id", verifiedUser.id).select().single();
      } else {
        writeQuery = supabase
          .from("profiles")
          .upsert({ ...payload, user_id: verifiedUser.id, created_at: nowIso }, { onConflict: "id" })
          .select()
          .single();
      }

      const { data: result, error: writeError } = await writeQuery;
      if (writeError) {
        console.error("profile save error:", writeError);
        return sendJson(res, 500, { error: "Failed to save profile", detail: writeError.message });
      }

      return sendJson(res, 200, {
        ok: true,
        data: result || { ...existingProfile, ...payload, user_id: verifiedUser.id },
        meta: { completion: buildCompletion(result || payload) }
      });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error("profile fatal error:", error);
    return sendJson(res, 500, { error: "Unexpected profile error", detail: error?.message || String(error) });
  }
}
