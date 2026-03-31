import { createClient } from "@supabase/supabase-js";
import { requireVerifiedDashboardUser, getTrustedIdentity } from "./_shared/auth.js";

const PROFILE_TABLE = "profiles";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.send(JSON.stringify(body));
}

function parseBody(req) {
  try {
    if (!req.body) return {};
    if (typeof req.body === "string") return JSON.parse(req.body || "{}");
    if (typeof req.body === "object") return req.body;
    return {};
  } catch (error) {
    return { __parse_error: error?.message || "Invalid JSON body" };
  }
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase server environment variables");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function isMissingColumnError(error) {
  const message = clean(error?.message || "");
  return error?.code === "42703" || (/column/i.test(message) && /does not exist/i.test(message));
}

function isMissingRelationError(error) {
  const message = clean(error?.message || "");
  return error?.code === "42P01" || (/relation/i.test(message) && /does not exist/i.test(message));
}

function extractMissingName(error) {
  const message = clean(error?.message || "");
  const patterns = [
    /column\s+"([^"]+)"\s+does\s+not\s+exist/i,
    /column\s+'([^']+)'\s+does\s+not\s+exist/i,
    /column\s+([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i,
    /relation\s+"([^"]+)"\s+does\s+not\s+exist/i,
    /relation\s+'([^']+)'\s+does\s+not\s+exist/i
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return "";
}

function removeUndefined(payload = {}) {
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function removeNulls(payload = {}) {
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== null && value !== undefined) out[key] = value;
  }
  return out;
}

function buildProfilePayload(body = {}, identity = {}) {
  const nowIso = new Date().toISOString();
  const payload = {
    id: clean(identity.id || body.id || body.user_id || body.auth_user_id || "") || null,
    user_id: clean(identity.id || body.user_id || body.id || "") || null,
    email: normalizeEmail(identity.email || body.email || body.dealer_email || "") || null,
    full_name: clean(body.full_name || body.fullName || body.name || "") || null,
    dealership: clean(body.dealership || body.dealer_name || body.dealership_name || body.company || "") || null,
    city: clean(body.city || "") || null,
    province: clean(body.province || "") || null,
    phone: clean(body.phone || "") || null,
    license_number: clean(body.license_number || body.licenseNumber || "") || null,
    listing_location: clean(body.listing_location || body.location || body.default_listing_location || body.city || "") || null,
    dealer_phone: clean(body.dealer_phone || body.dealerPhone || "") || null,
    dealer_email: normalizeEmail(body.dealer_email || "") || normalizeEmail(identity.email || "") || null,
    compliance_mode: clean(body.compliance_mode || body.complianceMode || "") || null,
    dealer_website: clean(body.dealer_website || body.dealership_website || body.dealerWebsite || "") || null,
    inventory_url: clean(body.inventory_url || body.inventoryUrl || "") || null,
    scanner_type: clean(body.scanner_type || body.scannerType || "") || null,
    updated_at: nowIso
  };

  if (!payload.id && payload.user_id) payload.id = payload.user_id;
  if (!payload.user_id && payload.id) payload.user_id = payload.id;
  if (!payload.dealer_phone && payload.phone) payload.dealer_phone = payload.phone;
  if (!payload.listing_location && payload.city) payload.listing_location = payload.city;

  return removeUndefined(payload);
}

async function safeMaybeSingle(queryPromise) {
  try {
    const { data, error } = await queryPromise;
    if (error) return { data: null, error };
    return { data: data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

async function findUserRow(supabase, { userId = "", email = "" } = {}) {
  const cleanedUserId = clean(userId);
  const normalizedEmail = normalizeEmail(email);

  if (cleanedUserId) {
    const byId = await safeMaybeSingle(supabase.from("users").select("*").eq("id", cleanedUserId).maybeSingle());
    if (byId.data) return byId.data;
  }

  if (normalizedEmail) {
    const byEmail = await safeMaybeSingle(
      supabase.from("users").select("*").ilike("email", normalizedEmail).order("updated_at", { ascending: false }).limit(1).maybeSingle()
    );
    if (byEmail.data) return byEmail.data;
  }

  return null;
}

async function findProfileRow(supabase, { userId = "", email = "" } = {}) {
  const cleanedUserId = clean(userId);
  const normalizedEmail = normalizeEmail(email);

  const attempts = [
    () => cleanedUserId ? safeMaybeSingle(supabase.from(PROFILE_TABLE).select("*").eq("id", cleanedUserId).maybeSingle()) : Promise.resolve({ data: null, error: null }),
    () => cleanedUserId ? safeMaybeSingle(supabase.from(PROFILE_TABLE).select("*").eq("user_id", cleanedUserId).maybeSingle()) : Promise.resolve({ data: null, error: null }),
    () => normalizedEmail ? safeMaybeSingle(supabase.from(PROFILE_TABLE).select("*").ilike("email", normalizedEmail).order("updated_at", { ascending: false }).limit(1).maybeSingle()) : Promise.resolve({ data: null, error: null }),
    () => normalizedEmail ? safeMaybeSingle(supabase.from(PROFILE_TABLE).select("*").ilike("dealer_email", normalizedEmail).order("updated_at", { ascending: false }).limit(1).maybeSingle()) : Promise.resolve({ data: null, error: null })
  ];

  for (const run of attempts) {
    const result = await run();
    if (result.data) return result.data;
    if (result.error && !isMissingRelationError(result.error) && !isMissingColumnError(result.error)) {
      console.error(`[profile] ${PROFILE_TABLE} lookup warning:`, result.error);
    }
  }

  return null;
}

function mergeProfileResponse(profileRow = null, userRow = null, identity = {}) {
  const merged = {
    ...(userRow?.profile_snapshot && typeof userRow.profile_snapshot === "object" ? userRow.profile_snapshot : {}),
    ...(profileRow && typeof profileRow === "object" ? profileRow : {})
  };

  if (!clean(merged.id) && clean(identity.id)) merged.id = clean(identity.id);
  if (!clean(merged.user_id) && clean(identity.id)) merged.user_id = clean(identity.id);
  if (!normalizeEmail(merged.email) && normalizeEmail(identity.email)) merged.email = normalizeEmail(identity.email);
  if (!normalizeEmail(merged.dealer_email) && normalizeEmail(identity.email)) merged.dealer_email = normalizeEmail(identity.email);
  if (!clean(merged.dealer_phone) && clean(merged.phone)) merged.dealer_phone = clean(merged.phone);
  if (!clean(merged.listing_location) && clean(merged.city)) merged.listing_location = clean(merged.city);
  return merged;
}

async function mutateUsersTable(supabase, payload, userRow = null) {
  let current = removeNulls({
    id: clean(payload.id || userRow?.id || "") || null,
    email: normalizeEmail(payload.email || userRow?.email || "") || null,
    full_name: clean(payload.full_name || userRow?.full_name || "") || null,
    updated_at: payload.updated_at || new Date().toISOString()
  });

  if (!current.id && !current.email) return null;

  for (let attempts = 0; attempts < 8; attempts += 1) {
    const response = current.id
      ? await supabase.from("users").upsert(current, { onConflict: "id" }).select("*").maybeSingle()
      : await supabase.from("users").upsert(current, { onConflict: "email" }).select("*").maybeSingle();

    if (!response.error) return response.data || current;
    if (!isMissingColumnError(response.error)) {
      console.error("[profile] users sync warning:", response.error);
      return null;
    }

    const missingColumn = extractMissingName(response.error);
    if (!missingColumn || !(missingColumn in current)) {
      console.error("[profile] users sync warning:", response.error);
      return null;
    }
    delete current[missingColumn];
  }

  return null;
}

async function upsertProfile(supabase, payload, existingRow = null) {
  let current = removeUndefined({ ...payload });

  for (let attempts = 0; attempts < 12; attempts += 1) {
    let response;
    if (existingRow?.id) {
      response = await supabase.from(PROFILE_TABLE).update(removeNulls(current)).eq("id", existingRow.id).select("*").maybeSingle();
    } else if (clean(existingRow?.user_id)) {
      response = await supabase.from(PROFILE_TABLE).update(removeNulls(current)).eq("user_id", clean(existingRow.user_id)).select("*").maybeSingle();
    } else if (normalizeEmail(existingRow?.email)) {
      response = await supabase.from(PROFILE_TABLE).update(removeNulls(current)).ilike("email", normalizeEmail(existingRow.email)).select("*").limit(1).maybeSingle();
    } else if (current.id) {
      response = await supabase.from(PROFILE_TABLE).upsert(removeNulls(current), { onConflict: "id" }).select("*").maybeSingle();
    } else if (current.user_id) {
      response = await supabase.from(PROFILE_TABLE).upsert(removeNulls(current), { onConflict: "user_id" }).select("*").maybeSingle();
    } else if (current.email) {
      response = await supabase.from(PROFILE_TABLE).upsert(removeNulls(current), { onConflict: "email" }).select("*").maybeSingle();
    } else {
      response = await supabase.from(PROFILE_TABLE).insert(removeNulls(current)).select("*").maybeSingle();
    }

    if (!response.error) return response.data || current;
    if (isMissingRelationError(response.error)) return null;
    if (!isMissingColumnError(response.error)) throw response.error;

    const missingColumn = extractMissingName(response.error);
    if (!missingColumn || !(missingColumn in current)) throw response.error;
    delete current[missingColumn];
  }

  throw new Error(`Profile mutation exhausted retry budget for ${PROFILE_TABLE}`);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204);
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.end();
  }

  if (!["GET", "POST"].includes(req.method)) {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const verifiedUser = await requireVerifiedDashboardUser(req, res);
    if (req.headers?.["x-elevate-client"] && !verifiedUser && String(req.headers["x-elevate-client"]).toLowerCase() === "dashboard") {
      return;
    }

    const body = req.method === "POST" ? parseBody(req) : {};
    if (body.__parse_error) {
      return json(res, 400, { ok: false, error: body.__parse_error });
    }

    const identity = getTrustedIdentity({ verifiedUser, body, query: req.query || {} });
    const userId = clean(identity.id || req.query?.id || req.query?.user_id || body.id || body.user_id || "");
    const email = normalizeEmail(identity.email || req.query?.email || body.email || body.dealer_email || "");

    if (!userId && !email) {
      return json(res, 400, { ok: false, error: "Missing user identity" });
    }

    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const [profileRow, userRow] = await Promise.all([
        findProfileRow(supabase, { userId, email }),
        findUserRow(supabase, { userId, email })
      ]);

      const merged = mergeProfileResponse(profileRow, userRow, { id: userId, email });
      return json(res, 200, {
        ok: true,
        data: merged,
        profile: merged,
        source: profileRow ? PROFILE_TABLE : (userRow ? "users" : "empty")
      });
    }

    const payload = buildProfilePayload(body, { id: userId, email });

    if (!payload.full_name) return json(res, 400, { ok: false, error: "Full name is required" });
    if (!payload.dealership) return json(res, 400, { ok: false, error: "Dealership is required" });
    if (!payload.city) return json(res, 400, { ok: false, error: "City is required" });

    const existingUser = await findUserRow(supabase, { userId, email });
    const existingProfile = await findProfileRow(supabase, { userId, email });
    await mutateUsersTable(supabase, payload, existingUser);
    await upsertProfile(supabase, payload, existingProfile);

    const [savedProfile, savedUser] = await Promise.all([
      findProfileRow(supabase, { userId, email }),
      findUserRow(supabase, { userId, email })
    ]);

    const merged = mergeProfileResponse(savedProfile || payload, savedUser, { id: userId, email });
    return json(res, 200, {
      ok: true,
      data: merged,
      profile: merged,
      source: savedProfile ? PROFILE_TABLE : "users"
    });
  } catch (error) {
    console.error("[profile] fatal error:", error);
    return json(res, 500, {
      ok: false,
      error: error?.message || "Failed to process profile request"
    });
  }
}
