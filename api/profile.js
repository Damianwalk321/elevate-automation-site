import { createClient } from "@supabase/supabase-js";
import { getVerifiedRequestUser, getTrustedIdentity } from "./_shared/auth.js";

function clean(value) {
  return String(value || "").trim();
}
function lower(value) {
  return clean(value).toLowerCase();
}
function normalizeUrl(value) {
  const raw = clean(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
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
function parseBody(body) {
  if (!body) return {};
  if (typeof body === "object") return body;
  try { return JSON.parse(body); } catch { return {}; }
}
function sendJson(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.json(body);
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

async function findProfileRow(supabase, { userId = "", email = "" } = {}) {
  const cleanUserId = clean(userId);
  const normalizedEmail = lower(email);
  const attempts = [
    async () => cleanUserId ? await supabase.from("profiles").select("*").eq("id", cleanUserId).maybeSingle() : { data: null, error: null },
    async () => cleanUserId ? await supabase.from("profiles").select("*").eq("user_id", cleanUserId).maybeSingle() : { data: null, error: null },
    async () => normalizedEmail ? await supabase.from("profiles").select("*").ilike("email", normalizedEmail).order("updated_at", { ascending: false }).limit(1).maybeSingle() : { data: null, error: null }
  ];
  for (const run of attempts) {
    const result = await run();
    if (!result.error && result.data) return result.data;
  }
  return null;
}

export default async function handler(req, res) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return sendJson(res, 500, { ok: false, error: "Missing Supabase env variables" });
    }

    const verifiedUser = await getVerifiedRequestUser(req);
    const trustedIdentity = getTrustedIdentity({
      verifiedUser,
      body: parseBody(req.body),
      query: req.query || {}
    });

    if (!trustedIdentity?.id && !trustedIdentity?.email) {
      return sendJson(res, 401, { ok: false, error: "Unauthorized" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (req.method === "GET") {
      const profile = await findProfileRow(supabase, {
        userId: trustedIdentity.id || req.query?.id || req.query?.user_id || "",
        email: trustedIdentity.email || req.query?.email || ""
      });

      return sendJson(res, 200, {
        ok: true,
        data: profile || null,
        meta: { completion: buildCompletion(profile || {}) }
      });
    }

    if (req.method === "POST") {
      const body = parseBody(req.body);
      const nowIso = new Date().toISOString();
      const normalizedProvince = normalizeProvince(body.province);
      const normalizedEmail = lower(trustedIdentity.email || body.email);

      const payload = {
        id: clean(trustedIdentity.id || body.id) || null,
        user_id: clean(trustedIdentity.id || body.user_id || body.id) || null,
        email: normalizedEmail || null,
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

      if (!payload.email) {
        return sendJson(res, 400, { ok: false, error: "Missing email" });
      }

      const existingProfile = await findProfileRow(supabase, {
        userId: payload.user_id,
        email: payload.email
      });

      let data = null;
      let error = null;

      if (existingProfile?.id) {
        ({ data, error } = await supabase
          .from("profiles")
          .update(payload)
          .eq("id", existingProfile.id)
          .select()
          .maybeSingle());
      } else if (existingProfile?.user_id) {
        ({ data, error } = await supabase
          .from("profiles")
          .update(payload)
          .eq("user_id", existingProfile.user_id)
          .select()
          .maybeSingle());
      } else {
        ({ data, error } = await supabase
          .from("profiles")
          .upsert({ ...payload, created_at: nowIso }, { onConflict: "email" })
          .select()
          .maybeSingle());
      }

      if (error) {
        return sendJson(res, 200, {
          ok: false,
          error: "Failed to save profile",
          detail: error.message
        });
      }

      const saved = data || { ...(existingProfile || {}), ...payload };
      return sendJson(res, 200, {
        ok: true,
        data: saved,
        meta: { completion: buildCompletion(saved) }
      });
    }

    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    return sendJson(res, 200, {
      ok: false,
      error: "Unexpected profile error",
      detail: error?.message || String(error)
    });
  }
}
