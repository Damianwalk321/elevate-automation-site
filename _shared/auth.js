import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://teixblbxkoershwgqpym.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLIC_ANON_KEY ||
  "sb_publishable_low3Lfh2rAsN-kqBlwHF2Q_Kc6OhQLB";

function clean(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

export function isDashboardClient(req) {
  return clean(req?.headers?.["x-elevate-client"] || req?.headers?.["X-ELEVATE-CLIENT"] || "").toLowerCase() === "dashboard";
}

function getServerVerificationClient(token) {
  if (!token || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function getVerifiedRequestUser(req) {
  try {
    const authHeader = clean(req.headers?.authorization || "");
    if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
    const token = authHeader.slice(7).trim();
    const client = getServerVerificationClient(token);
    if (!client) return null;
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) {
      console.warn("[shared-auth] bearer verification failed:", error?.message || "no user");
      return null;
    }
    return data.user;
  } catch (error) {
    console.warn("[shared-auth] bearer verification exception:", error?.message || error);
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
