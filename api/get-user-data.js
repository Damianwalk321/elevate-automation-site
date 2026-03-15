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

function getSubscriptionEmail(subscriptionRow) {
  return normalizeEmail(subscriptionRow?.metadata?.email);
}

function getPlanName(subscriptionRow) {
  return (
    subscriptionRow?.plan_name ||
    subscriptionRow?.metadata?.plan_name ||
    subscriptionRow?.metadata?.plan ||
    "Founder Beta"
  );
}

function getLicenseKey(subscriptionRow) {
  return (
    subscriptionRow?.license_key ||
    subscriptionRow?.metadata?.license_key ||
    subscriptionRow?.metadata?.key ||
    ""
  );
}

function getStatus(subscriptionRow) {
  return (
    subscriptionRow?.status ||
    subscriptionRow?.subscription_status ||
    subscriptionRow?.metadata?.status ||
    "active"
  );
}

function hasAccess(subscriptionRow) {
  if (!subscriptionRow) return false;

  const status = String(getStatus(subscriptionRow)).toLowerCase();

  return (
    subscriptionRow?.access === true ||
    subscriptionRow?.active === true ||
    status === "active" ||
    status === "trialing" ||
    status === "paid"
  );
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

    const normalizedEmail = normalizeEmail(email);

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("*");

    if (subscriptionError) {
      console.error("get-user-data subscription fetch error:", subscriptionError);
      return res.status(500).json({
        error: subscriptionError.message
      });
    }

    const subscription =
      subscriptions?.find((row) => getSubscriptionEmail(row) === normalizedEmail) || null;

    if (!subscription) {
      return res.status(200).json({
        access: false,
        active: false,
        status: "inactive",
        plan_name: "Founder Beta",
        license_key: "",
        referral_code: "",
        user_id: null
      });
    }

    let referralCode = "";

    const { data: affiliates, error: affiliateError } = await supabase
      .from("affiliates")
      .select("*");

    if (affiliateError) {
      console.error("Referral lookup error:", affiliateError);
    } else {
      const matchedAffiliate =
        affiliates?.find((row) => normalizeEmail(row?.email) === normalizedEmail) || null;

      referralCode =
        matchedAffiliate?.referral_code ||
        matchedAffiliate?.code ||
        "";
    }

    return res.status(200).json({
      access: hasAccess(subscription),
      active: hasAccess(subscription),
      status: getStatus(subscription),
      plan_name: getPlanName(subscription),
      license_key: getLicenseKey(subscription),
      referral_code: referralCode,
      user_id: subscription?.user_id || subscription?.affiliate_id || null
    });
  } catch (error) {
    console.error("get-user-data fatal error:", error);

    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}