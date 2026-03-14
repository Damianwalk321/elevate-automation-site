// /api/get-user-data.js

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data, error } = await supabase
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
      .eq("email", normalizedEmail)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

