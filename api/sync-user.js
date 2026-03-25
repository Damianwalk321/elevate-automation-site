import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function clean(value) {
  return String(value || "").trim();
}

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
  if (error && /column/i.test(error.message || "")) {
    error = await tryUpdate(payloadBaseOnly);
  }
  return error;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const id = clean(body.id || body.auth_user_id);
    const email = clean(body.email).toLowerCase();
    const fullName = clean(body.full_name || body.fullName || "");
    const referralCode = clean(body.referral_code || body.referralCode || "");
    const referralSource = clean(body.referral_source || body.referralSource || "");
    const nowIso = new Date().toISOString();

    if (!id || !email) {
      return res.status(200).json({
        ok: false,
        skipped: true,
        reason: "Missing id or email"
      });
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const lockedReferralCode = clean(existingUser?.referral_code || "");
    const lockedReferralSource = clean(existingUser?.referral_source || "");
    const referralPayload = {
      ...(lockedReferralCode ? {} : { referral_code: referralCode || null }),
      ...(lockedReferralSource ? {} : { referral_source: referralSource || null })
    };

    if (existingUser) {
      const updateError = await safeUsersUpdateByIdOrEmail(
        {
          email,
          full_name: fullName || existingUser.full_name || null,
          updated_at: nowIso
        },
        referralPayload,
        id,
        email
      );

      if (updateError) {
        console.error("sync-user users update error:", updateError);
        return res.status(200).json({
          ok: false,
          skipped: true,
          reason: "Users update failed",
          detail: updateError.message
        });
      }
    } else {
      let insertError = null;
      const withReferral = {
        id,
        email,
        full_name: fullName || null,
        updated_at: nowIso,
        ...referralPayload
      };
      const withoutReferral = {
        id,
        email,
        full_name: fullName || null,
        updated_at: nowIso
      };

      ({ error: insertError } = await supabase
        .from("users")
        .upsert(withReferral, { onConflict: "id" }));

      if (insertError && /column/i.test(insertError.message || "")) {
        ({ error: insertError } = await supabase
          .from("users")
          .upsert(withoutReferral, { onConflict: "id" }));
      }

      if (insertError) {
        console.error("sync-user users upsert error:", insertError);
        return res.status(200).json({
          ok: false,
          skipped: true,
          reason: "Users upsert failed",
          detail: insertError.message
        });
      }
    }

    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id,email,full_name")
      .eq("id", id)
      .maybeSingle();

    if (profileLookupError) {
      console.error("sync-user profile lookup error:", profileLookupError);
      return res.status(200).json({
        ok: false,
        skipped: true,
        reason: "Profile lookup failed",
        detail: profileLookupError.message
      });
    }

    if (!existingProfile) {
      const { error: profileInsertError } = await supabase
        .from("profiles")
        .insert({
          id,
          email,
          full_name: fullName || null,
          created_at: nowIso,
          updated_at: nowIso
        });

      if (profileInsertError) {
        console.error("sync-user profile insert error:", profileInsertError);
        return res.status(200).json({
          ok: false,
          skipped: true,
          reason: "Profile insert failed",
          detail: profileInsertError.message
        });
      }
    } else {
      const profileUpdatePayload = { updated_at: nowIso };
      if (!existingProfile.email) profileUpdatePayload.email = email;
      if (fullName && !existingProfile.full_name) profileUpdatePayload.full_name = fullName;

      if (Object.keys(profileUpdatePayload).length > 1) {
        const { error: profileUpdateError } = await supabase
          .from("profiles")
          .update(profileUpdatePayload)
          .eq("id", id);

        if (profileUpdateError) {
          console.error("sync-user profile update error:", profileUpdateError);
          return res.status(200).json({
            ok: false,
            skipped: true,
            reason: "Profile update failed",
            detail: profileUpdateError.message
          });
        }
      }
    }

    const { error: subscriptionUpsertError } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: id,
          email,
          updated_at: nowIso
        },
        { onConflict: "email" }
      );

    if (subscriptionUpsertError) {
      console.error("sync-user subscriptions upsert warning:", subscriptionUpsertError.message);
    }

    return res.status(200).json({ ok: true, id, email, full_name: fullName });
  } catch (error) {
    console.error("sync-user fatal error:", error);
    return res.status(200).json({
      ok: false,
      skipped: true,
      reason: "Unexpected sync-user error",
      detail: error.message || "Unknown error"
    });
  }
}
