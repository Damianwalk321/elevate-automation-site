import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

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

  if (["founder beta", "founder", "beta"].includes(normalizedPlanType)) return "founder_pro";
  if (["founder starter", "founder-starter", "founder_starter"].includes(normalizedPlanType)) return "founder_starter";
  if (["founder pro", "founder-pro", "founder_pro"].includes(normalizedPlanType)) return "founder_pro";
  if (normalizedPlanType === "starter") return "starter";
  if (normalizedPlanType === "pro") return "pro";
  if (!normalizedPlanType && (normalizedAccessType === "founder" || normalizedUserType === "founder")) return "founder_pro";
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

  // Founder starter
  if (
    normalizedPlanType === "founder_starter" ||
    normalizedPlanType === "founder-starter"
  ) {
    return {
      planName: "Founder Starter",
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

    const email = normalizeEmail(body.email || "");
    const userId = clean(body.userId || body.user_id || body.id || "");
    const planType = clean(body.planType || "");
    const userType = clean(body.userType || "");
    const accessType = clean(body.accessType || "");
    const referralCode = clean(body.referralCode || "");

    if (!email) {
      return json(res, 400, { error: "Missing email" });
    }

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
        referral_code: referralCode
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
          referral_code: referralCode
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
