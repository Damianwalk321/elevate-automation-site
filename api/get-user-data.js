import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: "Missing email"
      });
    }

    // Get subscription record
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (subError) {
      console.error("Subscription lookup error:", subError);
    }

    // Get referral code
    const { data: referral, error: refError } = await supabase
      .from("affiliates")
      .select("referral_code")
      .eq("email", email)
      .maybeSingle();

    if (refError) {
      console.error("Referral lookup error:", refError);
    }

    const active = subscription?.status === "active";

    return res.status(200).json({
      access: active,
      plan_name: subscription?.plan_name || "Founder Beta",
      status: subscription?.status || "inactive",
      license_key: subscription?.license_key || null,
      referral_code: referral?.referral_code || null
    });

  } catch (error) {
    console.error("get-user-data error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}