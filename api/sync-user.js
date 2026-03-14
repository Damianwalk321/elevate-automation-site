// /api/sync-user.js

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateReferralCode(email) {
  const clean = (email || "user")
    .split("@")[0]
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 12);

  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${clean}${rand}`;
}

async function generateUniqueReferralCode(email) {
  let code = generateReferralCode(email);
  let attempts = 0;

  while (attempts < 10) {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return code;
    }

    code = generateReferralCode(email);
    attempts += 1;
  }

  throw new Error("Could not generate a unique referral code.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { auth_user_id, email, full_name } = req.body;

    if (!auth_user_id || !email) {
      return res.status(400).json({ error: "Missing auth_user_id or email" });
    }

    const { data: existingUser, error: existingError } = await supabase
      .from("users")
      .select("id, auth_user_id, email, referral_code")
      .eq("auth_user_id", auth_user_id)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({ error: existingError.message });
    }

    if (existingUser) {
      const updatePayload = {
        email,
        name: full_name || email.split("@")[0]
      };

      if (!existingUser.referral_code) {
        updatePayload.referral_code = await generateUniqueReferralCode(email);
      }

      const { error: updateError } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("auth_user_id", auth_user_id);

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      return res.status(200).json({
        success: true,
        action: "updated",
        referral_code: updatePayload.referral_code || existingUser.referral_code || null
      });
    }

    const referralCode = await generateUniqueReferralCode(email);

    const { error: insertError } = await supabase
      .from("users")
      .insert([
        {
          auth_user_id,
          email,
          name: full_name || email.split("@")[0],
          plan: "Beta",
          subscription_status: "active",
          referral_code: referralCode,
          referral_count: 0,
          unlocked_invites: 1,
          used_invites: 0,
          founder_pricing_locked: true
        }
      ]);

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    return res.status(200).json({
      success: true,
      action: "inserted",
      referral_code: referralCode
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
