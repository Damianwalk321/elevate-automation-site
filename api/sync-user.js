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
  let attempts = 0;

  while (attempts < 10) {
    const code = generateReferralCode(email);

    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return code;

    attempts += 1;
  }

  throw new Error("Could not generate a unique referral code.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { auth_user_id, email, full_name } = req.body || {};

    if (!auth_user_id || !email) {
      return res.status(400).json({ error: "Missing auth_user_id or email" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const displayName = full_name || normalizedEmail.split("@")[0];

    // 1) Try linked row first
    const { data: linkedUser, error: linkedError } = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", auth_user_id)
      .maybeSingle();

    if (linkedError) {
      return res.status(500).json({ error: linkedError.message });
    }

    if (linkedUser) {
      const updatePayload = {
        email: normalizedEmail,
        name: displayName
      };

      if (!linkedUser.referral_code) {
        updatePayload.referral_code = await generateUniqueReferralCode(normalizedEmail);
      }

      const { error: updateError } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("id", linkedUser.id);

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      return res.status(200).json({
        success: true,
        action: "updated_linked_user"
      });
    }

    // 2) Try existing row by email
    const { data: emailMatches, error: emailError } = await supabase
      .from("users")
      .select("*")
      .eq("email", normalizedEmail)
      .order("id", { ascending: true });

    if (emailError) {
      return res.status(500).json({ error: emailError.message });
    }

    if (emailMatches && emailMatches.length > 0) {
      const bestMatch = emailMatches.find((row) => !row.auth_user_id) || emailMatches[0];

      const updatePayload = {
        auth_user_id,
        email: normalizedEmail,
        name: displayName
      };

      if (!bestMatch.referral_code) {
        updatePayload.referral_code = await generateUniqueReferralCode(normalizedEmail);
      }

      const { error: claimError } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("id", bestMatch.id);

      if (claimError) {
        return res.status(500).json({ error: claimError.message });
      }

      return res.status(200).json({
        success: true,
        action: "claimed_existing_email_row"
      });
    }

    // 3) Insert brand new row
    const referralCode = await generateUniqueReferralCode(normalizedEmail);

    const { error: insertError } = await supabase
      .from("users")
      .insert([
        {
          auth_user_id,
          email: normalizedEmail,
          name: displayName,
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
      action: "inserted_new_user"
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

