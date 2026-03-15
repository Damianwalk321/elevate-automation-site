import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {

  try {

    const { email } = req.query

    if (!email) {
      return res.status(400).json({ error: "Missing email" })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const { data: subscriptions } = await supabase
      .from("subscriptions")
      .select("*")

    const subscription = subscriptions?.find(
      s => (s.metadata?.email || "").toLowerCase() === normalizedEmail
    )

    if (!subscription) {
      return res.status(200).json({
        access: false
      })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle()

    const { data: limit } = await supabase
      .from("posting_limits")
      .select("*")
      .eq("plan", subscription.plan_name || "Founder Beta")
      .maybeSingle()

    const { data: usage } = await supabase
      .from("posting_usage")
      .select("*")
      .eq("user_id", subscription.user_id)
      .maybeSingle()

    return res.status(200).json({

      access: true,

      plan: subscription.plan_name || "Founder Beta",

      license_key: subscription.license_key || "",

      profile: profile || {},

      dealer_site: profile?.dealer_website || "",

      inventory_url: profile?.inventory_url || "",

      scanner_type: profile?.scanner_type || "",

      posting_limit: limit?.daily_limit || 5,

      posts_today: usage?.posts_today || 0

    })

  } catch (err) {

    return res.status(500).json({
      error: err.message
    })

  }

}