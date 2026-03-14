// /api/get-user-data.js

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function pickBestUserRow(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  // Prefer rows already linked to auth_user_id
  const linkedRow = rows.find((row) => row.auth_user_id);
  if (linkedRow) return linkedRow;

  // Otherwise just return the first row
  return rows[0];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, auth_user_id } = req.body || {};

    if (!email && !auth_user_id) {
      return res.status(400).json({ error: "Missing email or auth_user_id" });
    }

    let rows = [];
    let queryError = null;

    if (auth_user_id) {
      const result = await supabase
        .from("users")
        .select(`
          id,
          auth_user_id,
          email,
          name,
          plan,
          subscription_status,
          referral_code,
          referral_count,
          unlocked_invites,
          used_invites,
          founder_pricing_locked,
          stripe_customer_id,
          stripe_subscription_id,
          stripe_price_id
        `)
        .eq("auth_user_id", auth_user_id);

      rows = result.data || [];
      queryError = result.error;
    }

    if ((!rows || rows.length === 0) && email) {
      const normalizedEmail = String(email).trim().toLowerCase();

      const result = await supabase
        .from("users")
        .select(`
          id,
          auth_user_id,
          email,
          name,
          plan,
          subscription_status,
          referral_code,
          referral_count,
          unlocked_invites,
          used_invites,
          founder_pricing_locked,
          stripe_customer_id,
          stripe_subscription_id,
          stripe_price_id
        `)
        .eq("email", normalizedEmail);

      rows = result.data || [];
      queryError = result.error;
    }

    if (queryError) {
      return res.status(500).json({ error: queryError.message });
    }

    const user = pickBestUserRow(rows);

    if (!user) {
      return res.status(404).json({ error: "User row not found" });
    }

    return res.status(200).json(user);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

