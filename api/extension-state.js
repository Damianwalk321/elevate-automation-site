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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function clean(value) {
  return String(value || "").trim();
}

function getSubscriptionEmail(row) {
  return normalizeEmail(
    row?.email ||
    row?.customer_email ||
    row?.metadata?.email ||
    ""
  );
}

function getSubscriptionStatus(row) {
  return clean(
    row?.status ||
    row?.subscription_status ||
    row?.metadata?.status ||
    "inactive"
  );
}

function getPlanName(row) {
  return clean(
    row?.plan_name ||
    row?.plan ||
    row?.metadata?.plan_name ||
    row?.metadata?.plan ||
    "Founder Beta"
  );
}

function getLicenseKey(row) {
  return clean(
    row?.license_key ||
    row?.metadata?.license_key ||
    row?.metadata?.key ||
    ""
  );
}

function getPostingLimit(row) {
  const raw =
    row?.post_limit ??
    row?.posting_limit ??
    row?.daily_post_limit ??
    row?.metadata?.post_limit ??
    row?.metadata?.posting_limit ??
    row?.metadata?.daily_post_limit;

  const parsed = Number(raw);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  const plan = getPlanName(row).toLowerCase();

  if (plan.includes("pro")) return 25;
  if (plan.includes("dealer")) return 100;
  return 5;
}

function hasAccess(row) {
  if (!row) return false;

  const status = getSubscriptionStatus(row).toLowerCase();

  return (
    row?.access === true ||
    row?.active === true ||
    status === "active" ||
    status === "trialing" ||
    status === "paid"
  );
}

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

async function findSubscriptionByEmail(email) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  const normalizedEmail = normalizeEmail(email);

  return (
    data?.find((row) => getSubscriptionEmail(row) === normalizedEmail) || null
  );
}

async function findProfileByUserOrEmail(userId, email) {
  if (userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) return data;
  }

  if (email) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", normalizeEmail(email))
      .maybeSingle();

    if (!error && data) return data;
  }

  return null;
}

async function findPostingUsage(email) {
  const today = getTodayDateString();

  const { data, error } = await supabase
    .from("posting_usage")
    .select("*")
    .eq("email", normalizeEmail(email))
    .eq("date", today)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data || null;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const email = normalizeEmail(req.query?.email || "");
    const userId = clean(req.query?.user_id || "");

    if (!email && !userId) {
      return res.status(400).json({
        error: "Missing email or user_id"
      });
    }

    let subscription = null;
    let resolvedEmail = email;

    if (email) {
      subscription = await findSubscriptionByEmail(email);
    }

    if (!subscription && userId) {
      const profileFromUser = await findProfileByUserOrEmail(userId, email);
      if (profileFromUser?.email) {
        resolvedEmail = normalizeEmail(profileFromUser.email);
        subscription = await findSubscriptionByEmail(resolvedEmail);
      }
    }

    if (!subscription) {
      const profileOnly = await findProfileByUserOrEmail(userId, resolvedEmail);

      return res.status(200).json({
        access: false,
        active: false,
        status: "inactive",
        plan: "Founder Beta",
        plan_name: "Founder Beta",
        email: resolvedEmail || normalizeEmail(profileOnly?.email || ""),
        user_id: clean(userId || profileOnly?.id || ""),
        license_key: "",
        posting_limit: 0,
        posts_today: 0,
        posts_remaining: 0,
        dealer_site: clean(profileOnly?.dealer_website || ""),
        inventory_url: clean(profileOnly?.inventory_url || ""),
        scanner_type: clean(profileOnly?.scanner_type || ""),
        profile: profileOnly || {}
      });
    }

    const finalEmail = resolvedEmail || getSubscriptionEmail(subscription);
    const finalUserId = clean(
      userId ||
      subscription?.user_id ||
      subscription?.affiliate_id ||
      ""
    );

    const profile = await findProfileByUserOrEmail(finalUserId, finalEmail);
    const postingUsage = finalEmail ? await findPostingUsage(finalEmail) : null;

    const access = hasAccess(subscription);
    const plan = getPlanName(subscription);
    const postingLimit = access ? getPostingLimit(subscription) : 0;
    const postsToday = Number(postingUsage?.posts || postingUsage?.posts_today || 0);
    const postsRemaining = Math.max(postingLimit - postsToday, 0);

    return res.status(200).json({
      access,
      active: access,
      status: getSubscriptionStatus(subscription),
      plan,
      plan_name: plan,
      email: finalEmail,
      user_id: clean(finalUserId || profile?.id || ""),
      license_key: getLicenseKey(subscription),
      posting_limit: postingLimit,
      posts_today: postsToday,
      posts_remaining: postsRemaining,
      dealer_site: clean(profile?.dealer_website || ""),
      inventory_url: clean(profile?.inventory_url || ""),
      scanner_type: clean(profile?.scanner_type || ""),
      profile: profile || {}
    });
  } catch (error) {
    console.error("extension-state fatal error:", error);

    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}