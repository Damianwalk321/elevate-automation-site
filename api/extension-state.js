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
    if (req.method !== "GET") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const { user_id, email } = req.query;

    if (!user_id && !email) {
      return res.status(400).json({
        error: "Missing user_id or email"
      });
    }

    let normalizedEmail = email ? String(email).trim().toLowerCase() : null;
    let resolvedUserId = user_id ? String(user_id).trim() : null;

    if (resolvedUserId && !normalizedEmail) {
      const { data: userProfileById, error: profileByIdError } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("id", resolvedUserId)
        .maybeSingle();

      if (profileByIdError) {
        return res.status(500).json({
          error: profileByIdError.message
        });
      }

      normalizedEmail = userProfileById?.email || null;
    }

    if (normalizedEmail && !resolvedUserId) {
      const { data: userProfileByEmail, error: profileByEmailError } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (profileByEmailError) {
        return res.status(500).json({
          error: profileByEmailError.message
        });
      }

      resolvedUserId = userProfileByEmail?.id || null;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .or(
        resolvedUserId
          ? `id.eq.${resolvedUserId},email.eq.${normalizedEmail || ""}`
          : `email.eq.${normalizedEmail || ""}`
      )
      .maybeSingle();

    if (profileError) {
      return res.status(500).json({
        error: profileError.message
      });
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("email", normalizedEmail || profile?.email || "")
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

    const { dateKey, monthKey } = getTodayKeys();
    const limits = getPlanLimits(subscription);

    let usage = null;

    if (resolvedUserId && (normalizedEmail || profile?.email)) {
      const { data: usageRow, error: usageError } = await supabase
        .from("posting_usage")
        .select("*")
        .eq("user_id", resolvedUserId)
        .eq("date_key", dateKey)
        .maybeSingle();

      if (usageError) {
        return res.status(500).json({
          error: usageError.message
        });
      }

      usage = usageRow;
    }

    const postsUsedToday = Number(usage?.posts_used || 0);
    const dailyLimit = Number(limits.daily_post_limit || 0);
    const monthlyLimit = Number(limits.monthly_post_limit || 0);

    const dailyRemaining =
      dailyLimit > 0 ? Math.max(dailyLimit - postsUsedToday, 0) : null;

    return res.status(200).json({
      access: Boolean(active),
      user_id: resolvedUserId || profile?.id || null,
      email: normalizedEmail || profile?.email || null,

      subscription: {
        plan_name: subscription?.plan_name || subscription?.plan || "Founder Beta",
        status: subscription?.status || subscription?.subscription_status || "inactive",
        license_key: subscription?.license_key || null
      },

      limits: {
        date_key: dateKey,
        month_key: monthKey,
        daily_post_limit: dailyLimit,
        monthly_post_limit: monthlyLimit,
        posts_used_today: postsUsedToday,
        posts_remaining_today: dailyRemaining
      },

      profile: {
        full_name: profile?.full_name || "",
        dealership: profile?.dealership || "",
        city: profile?.city || "",
        province: profile?.province || "",
        phone: profile?.phone || "",
        license_number: profile?.license_number || "",
        listing_location: profile?.listing_location || "",
        dealer_phone: profile?.dealer_phone || "",
        dealer_email: profile?.dealer_email || "",
        compliance_mode: profile?.compliance_mode || ""
      }
    });
  } catch (error) {
    console.error("extension-state error:", error);

    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}