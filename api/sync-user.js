import { createClient } from "@supabase/supabase-js";
import { getVerifiedRequestUser } from "./_shared/auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function clean(value) { return String(value || "").trim(); }
function normalizeEmail(value) { return clean(value).toLowerCase(); }
function normalizeReferralSource(value) { return clean(value).toLowerCase() || "direct"; }

async function safeUsersUpdateByIdOrEmail(basePayload, referralPayload, id, email) {
  const payloadWithReferral = { ...basePayload, ...referralPayload };
  const payloadBaseOnly = { ...basePayload };
  const tryUpdate = async (payload) => {
    if (id) {
      const { error } = await supabase.from("users").update(payload).eq("id", id);
      if (!error) return null;
      return error;
    }
    if (email) {
      const { error } = await supabase.from("users").update(payload).eq("email", email);
      if (!error) return null;
      return error;
    }
    return null;
  };
  let error = await tryUpdate(payloadWithReferral);
  if (error && /column/i.test(error.message || "")) error = await tryUpdate(payloadBaseOnly);
  return error;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const verifiedUser = await getVerifiedRequestUser(req);
    if (!verifiedUser?.id || !verifiedUser?.email) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const id = clean(verifiedUser.id);
    const email = normalizeEmail(verifiedUser.email);
    const fullName = clean(body.full_name || body.fullName || verifiedUser.user_metadata?.full_name || "");
    const referralCode = clean(body.referral_code || body.referralCode || "");
    const referralSource = normalizeReferralSource(body.referral_source || body.referralSource || "");
    const nowIso = new Date().toISOString();

    const { data: existingUser } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
    const lockedReferralCode = clean(existingUser?.referral_code || "");
    const lockedReferralSource = clean(existingUser?.referral_source || "");
    const referralPayload = {
      ...(lockedReferralCode ? {} : { referral_code: referralCode || null }),
      ...(lockedReferralSource ? {} : { referral_source: referralSource || null })
    };

    if (existingUser) {
      const updateError = await safeUsersUpdateByIdOrEmail({ email, full_name: fullName || existingUser.full_name || null, updated_at: nowIso }, referralPayload, id, email);
      if (updateError) {
        console.error("sync-user users update error:", updateError);
        return res.status(200).json({ ok: false, skipped: true, reason: "Users update failed", detail: updateError.message });
      }
    } else {
      let insertError = null;
      const withReferral = { id, email, full_name: fullName || null, updated_at: nowIso, ...referralPayload };
      const withoutReferral = { id, email, full_name: fullName || null, updated_at: nowIso };
      ({ error: insertError } = await supabase.from("users").upsert(withReferral, { onConflict: "id" }));
      if (insertError && /column/i.test(insertError.message || "")) {
        ({ error: insertError } = await supabase.from("users").upsert(withoutReferral, { onConflict: "id" }));
      }
      if (insertError) {
        console.error("sync-user users upsert error:", insertError);
        return res.status(200).json({ ok: false, skipped: true, reason: "Users upsert failed", detail: insertError.message });
      }
    }

    const { data: existingProfile } = await supabase.from("profiles").select("id,email,full_name,updated_at").eq("id", id).maybeSingle();
    if (!existingProfile) {
      await supabase.from("profiles").upsert({ id, email, full_name: fullName || null, updated_at: nowIso }, { onConflict: "id" });
    }

    return res.status(200).json({ ok: true, id, email });
  } catch (error) {
    console.error("sync-user fatal:", error);
    return res.status(500).json({ ok: false, error: error.message || "Unexpected sync-user error" });
  }
}
