import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_ANON_KEY || "";

function clean(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

export function isDashboardClient(req) {
  return clean(req?.headers?.["x-elevate-client"] || req?.headers?.["X-ELEVATE-CLIENT"] || "").toLowerCase() === "dashboard";
}

export async function getVerifiedRequestUser(req) {
  try {
    const authHeader = clean(req.headers?.authorization || "");
    if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
    const token = authHeader.slice(7).trim();
    if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export async function requireVerifiedDashboardUser(req, res) {
  const verifiedUser = await getVerifiedRequestUser(req);
  if (isDashboardClient(req) && !verifiedUser) {
    res.status(401).setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({ error: "Unauthorized", requires_auth: true }));
    return null;
  }
  return verifiedUser;
}

export async function requireVerifiedUser(req, res) {
  const verifiedUser = await getVerifiedRequestUser(req);
  if (!verifiedUser) {
    res.status(401).setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({ error: "Unauthorized", requires_auth: true }));
    return null;
  }
  return verifiedUser;
}

export function getTrustedIdentity({ verifiedUser = null, body = {}, query = {} } = {}) {
  const bodyId = clean(body.id || body.user_id || body.auth_user_id || query.id || query.user_id);
  const bodyEmail = normalizeEmail(body.email || query.email);
  if (verifiedUser?.id || verifiedUser?.email) {
    return {
      id: clean(verifiedUser.id || bodyId),
      email: normalizeEmail(verifiedUser.email || bodyEmail),
      verified: true
    };
  }
  return {
    id: bodyId,
    email: bodyEmail,
    verified: false
  };
}

export function requireTrustedIdentity({ verifiedUser = null, body = {}, query = {} } = {}) {
  const trusted = getTrustedIdentity({ verifiedUser, body, query });
  if (!trusted.verified) return null;
  return trusted;
}
