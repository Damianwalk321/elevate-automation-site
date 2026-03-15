import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env: SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const PLAN_LIMITS = {
  starter: {
    daily_posts: 5,
    monthly_posts: 150
  },
  pro: {
    daily_posts: 25,
    monthly_posts: 1000
  },
  founder: {
    daily_posts: 25,
    monthly_posts: 1000
  },
  beta: {
    daily_posts: 5,
    monthly_posts: 25
  }
};

function normalizePlan(planName) {
  const raw = String(planName || "").trim().toLowerCase();

  if (raw.includes("pro")) return "pro";
  if (raw.includes("starter")) return "starter";
  if (raw.includes("founder")) return "founder";
  if (raw.includes("beta")) return "beta";

  return "starter";
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: "Missing email"
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (subError) {
      console.error("Subscription lookup error:", subError);
      return res.status(500).json({
        error: subError.message
      });
    }

    const { data: affiliate, error: affiliateError } = await supabase
      .from("affiliates")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (affiliateError) {
      console.error("Referral lookup error:", affiliateError);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
    }

    const active =
      subscription?.status === "active" ||
      subscription?.subscription_status === "active" ||
      subscription?.active === true ||
      subscription?.access === true;

    const resolvedPlanName =
      subscription?.plan_name ||
      subscription?.plan ||
      "Founder Beta";

    const normalizedPlan = normalizePlan(resolvedPlanName);
    const limits = PLAN_LIMITS[normalizedPlan] || PLAN_LIMITS.starter;

    return res.status(200).json({
      access: Boolean(active),
      active: Boolean(active),
      email: normalizedEmail,

      plan_name: resolvedPlanName,
      normalized_plan: normalizedPlan,
      status: subscription?.status || subscription?.subscription_status || "inactive",

      platform_license_key: subscription?.license_key || null,
      referral_code: affiliate?.referral_code || affiliate?.code || null,

      posting_limits: {
        daily_posts: limits.daily_posts,
        monthly_posts: limits.monthly_posts
      },

      profile: profile
        ? {
            full_name: profile.full_name || "",
            dealership: profile.dealership || "",
            city: profile.city || "",
            province: profile.province || "",
            phone: profile.phone || "",
            license_number: profile.license_number || "",
            listing_location: profile.listing_location || "",
            dealer_phone: profile.dealer_phone || "",
            dealer_email: profile.dealer_email || "",
            compliance_mode: profile.compliance_mode || ""
          }
        : null
    });
  } catch (error) {
    console.error("get-user-data fatal error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}