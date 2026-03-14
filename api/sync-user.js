// /api/sync-user.js

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function generateReferralCode(email) {
  const clean = normalizeEmail(email)
    .split("@")[0]
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 12);

  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${clean}${rand}`;
}

async function generateUniqueReferralCode(email) {
  let attempts = 0;

  while (attempts < 20) {
    const code = generateReferralCode(email);

    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();

    if (error) {
      throw new Error(`Referral lookup failed: ${error.message}`);
    }

    if (!data) {
      return code;
    }

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
      return res.status(400).json({
        error: "Missing auth_user_id or email"
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const displayName = (full_name || normalizedEmail.split("@")[0] || "User").trim();

    // 1) Look for exact auth-linked row first
    const { data: authMatch, error: authMatchError } = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", auth_user_id)
      .maybeSingle();

    if (authMatchError) {
      throw new Error(`Auth match lookup failed: ${authMatchError.message}`);
    }

    if (authMatch) {
      const updatePayload = {
        email: normalizedEmail,
        name: displayName
      };

      if (!authMatch.referral_code) {
        updatePayload.referral_code = await generateUniqueReferralCode(normalizedEmail);
      }

      const { error: updateError } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("id", authMatch.id);

      if (updateError) {
        throw new Error(`Updating auth-linked row failed: ${updateError.message}`);
      }

      return res.status(200).json({
        success: true,
        action: "updated_auth_linked_row",
        user_id: authMatch.id
      });
    }

    // 2) Find rows by email
    const { data: emailRows, error: emailRowsError } = await supabase
      .from("users")
      .select("*")
      .eq("email", normalizedEmail);

    if (emailRowsError) {
      throw new Error(`Email lookup failed: ${emailRowsError.message}`);
    }

    if (emailRows && emailRows.length > 0) {
      // Prefer a row without auth_user_id so we can safely claim it
      const unclaimedRow = emailRows.find((row) => !row.auth_user_id);
      const alreadyClaimedRow = emailRows.find((row) => row.auth_user_id === auth_user_id);
      const bestRow = alreadyClaimedRow || unclaimedRow || emailRows[0];

      const updatePayload = {
        email: normalizedEmail,
        name: displayName
      };

      // Only attach auth_user_id if row is unclaimed or already belongs to this auth user
      if (!bestRow.auth_user_id || bestRow.auth_user_id === auth_user_id) {
        updatePayload.auth_user_id = auth_user_id;
      }

      if (!bestRow.referral_code) {
        updatePayload.referral_code = await generateUniqueReferralCode(normalizedEmail);
      }

      const { error: claimError } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("id", bestRow.id);

      if (claimError) {
        throw new Error(`Claiming existing email row failed: ${claimError.message}`);
      }

      return res.status(200).json({
        success: true,
        action: "claimed_or_updated_email_row",
        user_id: bestRow.id
      });
    }

    // 3) Insert fresh row
    const referralCode = await generateUniqueReferralCode(normalizedEmail);

    const { data: insertedRows, error: insertError } = await supabase
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
      ])
      .select();

    if (insertError) {
      throw new Error(`Inserting new user row failed: ${insertError.message}`);
    }

    return res.status(200).json({
      success: true,
      action: "inserted_new_user",
      user_id: insertedRows?.[0]?.id || null
    });
  } catch (err) {
    console.error("sync-user error:", err);
    return res.status(500).json({
      error: err.message || "sync-user failed"
    });
  }
}
