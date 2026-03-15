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

function getTodayKeys() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  return {
    dateKey: `${yyyy}-${mm}-${dd}`,
    monthKey: `${yyyy}-${mm}`
  };
}

function getPlanLimits(subscription) {
  const explicitDaily = Number(subscription?.daily_post_limit || 0);
  const explicitMonthly = Number(subscription?.monthly_post_limit || 0);

  if (explicitDaily > 0 || explicitMonthly > 0) {
    return {
      daily_post_limit: explicitDaily || 0,
      monthly_post_limit: explicitMonthly || 0
    };
  }

  const planName = String(
    subscription?.plan_name ||
    subscription?.plan ||
    "Founder Beta"
  ).toLowerCase();

  if (planName.includes("starter")) {
    return {
      daily_post_limit: 5,
      monthly_post_limit: 150
    };
  }

  if (planName.includes("pro")) {
    return {
      daily_post_limit: 25,
      monthly_post_limit: 750
    };
  }

  return {
    daily_post_limit: 5,
    monthly_post_limit: 150
  };
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const body = req.body || {};
    const userId = body.user_id ? String(body.user_id).trim() : "";
    const email = body.email ? String(body.email).trim().toLowerCase() : "";
    const vehicleId = body.vehicle_id ? String(body.vehicle_id).trim() : "";
    const postPlatform = body.platform ? String(body.platform).trim() : "marketplace";

    if (!userId || !email) {
      return res.status(400).json({
        error: "Missing user_id or email"
      });
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (subscriptionError) {
      return res.status(500).json({
        error: subscriptionError.message
      });
    }

    const active =
      subscription?.status === "active" ||
      subscription?.subscription_status === "active" ||
      subscription?.access === true ||
      subscription?.active === true;

    if (!active) {
      return res.status(403).json({
        error: "Access inactive"
      });
    }

    const limits = getPlanLimits(subscription);
    const { dateKey, monthKey } = getTodayKeys();

    const { data: existingRow, error: existingError } = await supabase
      .from("posting_usage")
      .select("*")
      .eq("user_id", userId)
      .eq("date_key", dateKey)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({
        error: existingError.message
      });
    }

    const currentUsed = Number(existingRow?.posts_used || 0);
    const dailyLimit = Number(limits.daily_post_limit || 0);

    if (dailyLimit > 0 && currentUsed >= dailyLimit) {
      return res.status(403).json({
        error: "Daily posting limit reached",
        limits: {
          daily_post_limit: dailyLimit,
          posts_used_today: currentUsed,
          posts_remaining_today: 0
        }
      });
    }

    const nextUsed = currentUsed + 1;

    const { data: savedUsage, error: saveError } = await supabase
      .from("posting_usage")
      .upsert(
        {
          user_id: userId,
          email,
          date_key: dateKey,
          month_key: monthKey,
          posts_used: nextUsed,
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id,date_key" }
      )
      .select("*")
      .single();

    if (saveError) {
      return res.status(500).json({
        error: saveError.message
      });
    }

    return res.status(200).json({
      success: true,
      platform: postPlatform,
      vehicle_id: vehicleId || null,
      limits: {
        daily_post_limit: dailyLimit,
        posts_used_today: savedUsage.posts_used,
        posts_remaining_today:
          dailyLimit > 0 ? Math.max(dailyLimit - savedUsage.posts_used, 0) : null
      }
    });
  } catch (error) {
    console.error("register-post error:", error);

    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}