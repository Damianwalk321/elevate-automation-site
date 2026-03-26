import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { requireVerifiedDashboardUser, getTrustedIdentity } from "./_shared/auth.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(body));
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function normalizeReferralSource(value) {
  const source = clean(value).toLowerCase().replace(/[^a-z0-9_:-]+/g, '_');
  if (!source) return '';
  if (["ref","referral","link","direct_link"].includes(source)) return 'link';
  if (["checkout","stripe","billing"].includes(source)) return 'checkout';
  if (["signup","auth","register"].includes(source)) return 'signup';
  if (["story","ig_story","facebook_story"].includes(source)) return 'story';
  if (["dm","message","direct_message"].includes(source)) return 'dm';
  return source;
}


function getSiteUrl(req) {
  return (
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`
  );
}

function parseBody(req) {
  try {
    if (!req.body) return {};
    if (typeof req.body === "string") return JSON.parse(req.body || "{}");
    if (typeof req.body === "object") return req.body;
    return {};
  } catch (error) {
    return { __parse_error: error?.message || "Invalid JSON body" };
  }
}

function normalizePlanRequest(planType, accessType, userType) {
  const normalizedPlanType = clean(planType).toLowerCase();
  const normalizedAccessType = clean(accessType).toLowerCase();
  const normalizedUserType = clean(userType).toLowerCase();

  if (["founder beta", "founder-beta", "founder_beta", "founder", "beta", "beta founder"].includes(normalizedPlanType)) return "founder_beta";
  if (["founder starter", "founder-starter", "founder_starter"].includes(normalizedPlanType)) return "founder_beta";
  if (["founder pro", "founder-pro", "founder_pro"].includes(normalizedPlanType)) return "founder_pro";
  if (normalizedPlanType === "starter") return "starter";
  if (normalizedPlanType === "pro") return "pro";
  if (!normalizedPlanType && (normalizedAccessType === "founder" || normalizedUserType === "founder")) return "founder_beta";
  return normalizedPlanType;
}

function getPlanConfig(planType, accessType, userType) {
  const normalizedPlanType = normalizePlanRequest(planType, accessType, userType);
  const normalizedAccessType = clean(accessType).toLowerCase();
  const normalizedUserType = clean(userType).toLowerCase();

  const founderStarterPriceId = clean(process.env.STRIPE_FOUNDER_PRICE_ID);
  const founderProPriceId = clean(process.env.STRIPE_FOUNDER_PRO_PRICE_ID);
  const starterPriceId = clean(process.env.STRIPE_STARTER_PRICE_ID);
  const proPriceId = clean(process.env.STRIPE_PRO_PRICE_ID);

  // Founder beta
  if (
    normalizedPlanType === "founder_beta" ||
    normalizedPlanType === "founder-beta" ||
    normalizedPlanType === "founder_starter" ||
    normalizedPlanType === "founder-starter"
  ) {
    return {
      planName: "Founder Beta",
      lookupKey: "STRIPE_FOUNDER_PRICE_ID",
      priceId: founderStarterPriceId,
      trialUntil: "2026-04-02T00:00:00Z"
    };
  }

  // Founder pro
  if (
    normalizedPlanType === "founder_pro" ||
    normalizedPlanType === "founder-pro"
  ) {
    return {
      planName: "Founder Pro",
      lookupKey: "STRIPE_FOUNDER_PRO_PRICE_ID",
      priceId: founderProPriceId,
      trialUntil: "2026-04-02T00:00:00Z"
    };
  }

  // Public starter
  if (
    normalizedPlanType === "starter" ||
    (normalizedPlanType === "" &&
      normalizedAccessType !== "founder" &&
      normalizedUserType !== "founder")
  ) {
    return {
      planName: "Starter",
      lookupKey: "STRIPE_STARTER_PRICE_ID",
      priceId: starterPriceId,
      trialUntil: null
    };
  }

  // Public pro
  if (normalizedPlanType === "pro") {
    return {
      planName: "Pro",
      lookupKey: "STRIPE_PRO_PRICE_ID",
      priceId: proPriceId,
      trialUntil: null
    };
  }

  return null;
}

function getTrialEndUnix(trialUntilIso) {
  if (!trialUntilIso) return null;
  const unix = Math.floor(new Date(trialUntilIso).getTime() / 1000);
  const now = Math.floor(Date.now() / 1000);

  if (!unix || Number.isNaN(unix) || unix <= now) return null;
  return unix;
}

async function findOrCreateCustomer({ stripeClient, email, userId }) {
  const normalizedEmail = normalizeEmail(email);

  const existing = await stripeClient.customers.list({
    email: normalizedEmail,
    limit: 1
  });

  if (existing?.data?.length) {
    const customer = existing.data[0];

    // Keep useful metadata in sync
    const nextMetadata = {
      ...(customer.metadata || {})
    };

    if (userId && !nextMetadata.user_id) {
      nextMetadata.user_id = clean(userId);
    }
    if (normalizedEmail && !nextMetadata.email) {
      nextMetadata.email = normalizedEmail;
    }

    if (
      JSON.stringify(nextMetadata) !== JSON.stringify(customer.metadata || {})
    ) {
      return await stripeClient.customers.update(customer.id, {
        metadata: nextMetadata
      });
    }

    return customer;
  }

  return await stripeClient.customers.create({
    email: normalizedEmail,
    metadata: {
      email: normalizedEmail,
      user_id: clean(userId || "")
    }
  });
}

async function mirrorCustomerToSupabase({ email, userId, stripeCustomerId }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const normalizedEmail = normalizeEmail(email);
  const cleanedUserId = clean(userId);

  const payload = {
    stripe_customer_id: stripeCustomerId,
    updated_at: new Date().toISOString()
  };

  try {
    if (cleanedUserId) {
      const { error } = await supabase
        .from("users")
        .update(payload)
        .eq("id", cleanedUserId);

      if (!error) return;
      console.error("[checkout] users update by id warning:", error.message);
    }

    if (normalizedEmail) {
      const { error } = await supabase
        .from("users")
        .update(payload)
        .eq("email", normalizedEmail);

      if (error) {
        console.error("[checkout] users update by email warning:", error.message);
      }
    }
  } catch (error) {
    console.error("[checkout] supabase mirror warning:", error);
  }
}


async function getLockedReferralFromSupabase({ email, userId }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return { referralCode: "", referralSource: "" };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const normalizedEmail = normalizeEmail(email);
  const cleanedUserId = clean(userId);

  const extract = (row) => {
    if (!row || typeof row !== "object") return { referralCode: "", referralSource: "" };
    const snapshot = row.account_snapshot && typeof row.account_snapshot === "object" ? row.account_snapshot : {};
    return {
      referralCode: clean(row.referral_code || snapshot.referral_code || ""),
      referralSource: clean(row.referral_source || snapshot.referral_source || "")
    };
  };

  const trySelect = async (table, filters) => {
    try {
      let query = supabase.from(table).select("*").limit(1);
      for (const [key, value] of filters) {
        if (!value) continue;
        query = key === "email" ? query.ilike("email", value) : query.eq(key, value);
      }
      const { data, error } = await query.maybeSingle();
      if (error) return null;
      return extract(data);
    } catch {
      return null;
    }
  };

  return (
    (cleanedUserId && (await trySelect("users", [["id", cleanedUserId]]))) ||
    (normalizedEmail && (await trySelect("users", [["email", normalizedEmail]]))) ||
    (cleanedUserId && (await trySelect("profiles", [["id", cleanedUserId]]))) ||
    (normalizedEmail && (await trySelect("profiles", [["email", normalizedEmail]]))) ||
    (normalizedEmail && (await trySelect("subscriptions", [["email", normalizedEmail]]))) ||
    { referralCode: "", referralSource: "" }
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return json(res, 500, { error: "Missing STRIPE_SECRET_KEY" });
    }

    const body = parseBody(req);
    if (body.__parse_error) {
      return json(res, 400, { error: body.__parse_error });
    }

    const verifiedUser = await requireVerifiedDashboardUser(req, res);
    if (req.headers?.["x-elevate-client"] && !verifiedUser && String(req.headers["x-elevate-client"]).toLowerCase() === "dashboard") {
      return;
    }
    const identity = getTrustedIdentity({ verifiedUser, body });

    const email = normalizeEmail(identity.email || body.email || "");
    const userId = clean(identity.id || body.userId || body.user_id || body.id || "");
    const planType = clean(body.planType || "");
    const userType = clean(body.userType || "");
    const accessType = clean(body.accessType || "");
    let referralCode = clean(body.referralCode || "");
    let referralSource = clean(body.referralSource || "");

    if (!email) {
      return json(res, 400, { error: "Missing email" });
    }

    const lockedReferral = await getLockedReferralFromSupabase({ email, userId });
    if (!referralCode) referralCode = clean(lockedReferral.referralCode || "");
    if (!referralSource) referralSource = clean(lockedReferral.referralSource || "");
    referralSource = normalizeReferralSource(referralSource);
    if (!referralSource && referralCode) referralSource = "checkout";
    const plan = getPlanConfig(planType, accessType, userType);

    if (!plan) {
      return json(res, 400, {
        error: "Invalid or unsupported plan type",
        debug: {
          planType,
          userType,
          accessType
        }
      });
    }

    if (!plan.priceId) {
      return json(res, 500, {
        error: `Missing ${plan.lookupKey}`
      });
    }

    const customer = await findOrCreateCustomer({
      stripeClient: stripe,
      email,
      userId
    });

    await mirrorCustomerToSupabase({
      email,
      userId,
      stripeCustomerId: customer.id
    });

    const siteUrl = getSiteUrl(req);
    const trialEnd = getTrialEndUnix(plan.trialUntil);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      customer_email: undefined,
      line_items: [
        {
          price: plan.priceId,
          quantity: 1
        }
      ],
      success_url: `${siteUrl}/dashboard.html?checkout=success`,
      cancel_url: `${siteUrl}/index.html?checkout=cancelled`,
      allow_promotion_codes: true,
      client_reference_id: userId || undefined,
      metadata: {
        email,
        user_id: userId || "",
        plan_name: plan.planName,
        plan_type: normalizePlanRequest(planType, accessType, userType),
        normalized_plan: normalizePlanRequest(planType, accessType, userType),
        user_type: userType,
        access_type: accessType,
        referral_code: referralCode,
        referral_source: referralSource
      },
      subscription_data: {
        metadata: {
          email,
          user_id: userId || "",
          plan_name: plan.planName,
          plan_type: normalizePlanRequest(planType, accessType, userType),
        normalized_plan: normalizePlanRequest(planType, accessType, userType),
          user_type: userType,
          access_type: accessType,
          referral_code: referralCode,
          referral_source: referralSource
        },
        ...(trialEnd ? { trial_end: trialEnd } : {})
      }
    });

    return json(res, 200, {
      url: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error("[checkout] fatal error:", error);

    return json(res, 500, {
      error: error?.message || "Failed to create checkout session"
    });
  }
}
