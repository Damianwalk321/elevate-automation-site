import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { referral_code, new_user_email } = req.body;

  if (!referral_code || !new_user_email) {
    return res.status(400).json({
      error: "Missing referral code or email"
    });
  }

  try {

    // find referrer
    const { data: referrer, error: referrerError } = await supabase
      .from("users")
      .select("*")
      .eq("referral_code", referral_code)
      .single();

    if (referrerError || !referrer) {
      return res.status(404).json({
        error: "Referral code not found"
      });
    }

    // store referral record
    const { error: insertError } = await supabase
      .from("referrals")
      .insert([
        {
          referrer_id: referrer.id,
          referred_email: new_user_email
        }
      ]);

    if (insertError) {
      return res.status(500).json({
        error: insertError.message
      });
    }

    // increment referral count
    const { error: updateError } = await supabase
      .from("users")
      .update({
        referral_count: referrer.referral_count + 1
      })
      .eq("id", referrer.id);

    if (updateError) {
      return res.status(500).json({
        error: updateError.message
      });
    }

    return res.status(200).json({
      success: true
    });

  } catch (err) {

    return res.status(500).json({
      error: err.message
    });

  }

}
