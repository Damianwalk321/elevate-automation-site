import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {

  try {

    const { email } = req.query

    if (!email) {
      return res.status(400).json({
        error: "Missing email"
      })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // find subscription where metadata.email = email

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("*")
      .filter("metadata->>email", "eq", normalizedEmail)
      .maybeSingle()

    if (error) {
      return res.status(500).json({
        error: error.message
      })
    }

    if (!subscription) {
      return res.status(200).json({
        access: false
      })
    }

    return res.status(200).json({

      access: true,

      status: subscription.status || "active",

      plan_name: subscription.plan_name || "Founder",

      license_key: subscription.license_key || "",

      referral_code: subscription.referral_code || "",

      user_id: subscription.user_id || null

    })

  } catch (err) {

    return res.status(500).json({
      error: err.message
    })

  }

}