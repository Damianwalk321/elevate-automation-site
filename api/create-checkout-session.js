import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "http://localhost:3000";

const FOUNDER_CUTOFF = new Date("2026-04-02T06:00:00Z");
const FOUNDER_TRIAL_END = Math.floor(FOUNDER_CUTOFF.getTime() / 1000);

function clean(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function normalizePlanName(planType, accessType) {
  const key = clean(planType || accessType).toLowerCase();
  if (key === "founder_starter") return "Founder Starter";
  if (key === "founder_pro") return "Founder Pro";
  if (key === "starter") return "Starter";
  if (key === "pro") return "Pro";
  if (key === "founder") return "Founder Starter";
  return "Starter";
}

function getPlanConfig({ requestedPlanType, requestedAccessType }) {
  const founderOpen = new Date() < FOUNDER_CUTOFF;
  const key = clean(requestedPlanType || requestedAccessType).toLowerCase();

  const founderStarter = {
    planType: "founder_starter",
    planName: "Founder Starter",
    accessType: "founder",
    priceId: clean(process.env.STRIPE_FOUNDER_PRICE_ID),
    dailyPostingLimit: 5,
    founderEligible: true
  };

  const founderPro = {
    planType: "founder_pro",
    planName: "Founder Pro",
    accessType: "founder",
    priceId: clean(process.env.STRIPE_FOUNDER_PRO_PRICE_ID),
    dailyPostingLimit: 25,
    founderEligible: true
  };

  const starter = {
    planType: "starter",
    planName: "Starter",
    accessType: "standard",
    priceId: clean(process.env.STRIPE_STARTER_PRICE_ID),
    dailyPostingLimit: 5,
    founderEligible: false
  };

  const pro = {
    planType: "pro",
    planName: "Pro",
    accessType: "standard",
    priceId: clean(process.env.STRIPE_PRO_PRICE_ID),
    dailyPostingLimit: 25,
    founderEligible: false
  };

  if (key === "founder_pro" && founderOpen && founderPro.priceId) return founderPro;
  if ((key === "founder_starter" || key === "founder") && founderOpen && founderStarter.priceId) return founderStarter;
  if (key === "pro" && pro.priceId) return pro;
  if (key === "starter" && starter.priceId) return starter;

  if (founderOpen && founderStarter.priceId) return founderStarter;
  if (starter.priceId) return starter;
  if (founderStarter.priceId) return founderStarter;

  return {
    planType: founderOpen ? "founder_starter" : "starter",
    planName: founderOpen ? "Founder Starter" : "Starter",
    accessType: founderOpen ? "founder" : "standard",
    priceId: "",
    dailyPostingLimit: founderOpen ? 5 : 5,
    founderEligible: founderOpen
  };
}

async function upsertPendingMirrors({ userId, email, customerId, config, referralCode }) {
  const nowIso = new Date().toISOString();
  const normalizedEmail = normalizeEmail(email);

  const subscriptionPayload = {
    user_id: userId || null,
    email: normalizedEmail || null,
    stripe_customer_id: customerId || null,
    status: "checkout_pending",
    subscription_status: "checkout_pending",
    plan: config.planName,
    plan_name: config.planName,
    access_type: config.accessType,
    active: false,
    access: false,
    daily_posting_limit: config.dailyPostingLimit,
    referral_code: clean(referralCode),
    updated_at: nowIso
  };

  const postingLimitPayload = {
    user_id: userId || null,
    email: normalizedEmail || null,
    daily_limit: config.dailyPostingLimit,
    updated_at: nowIso
  };

  const subResult = await supabase
    .from("subscriptions")
    .upsert(subscriptionPayload, { onConflict: "email" });

  if (subResult.error) {
    console.error("create-checkout-session subscriptions upsert warning:", subResult.error.message);
  }

  const postingResult = await supabase
    .from("posting_limits")
    .upsert(postingLimitPayload, { onConflict: "email" });

  if (postingResult.error) {
    console.error("create-checkout-session posting_limits upsert warning:", postingResult.error.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY env variable" });
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Missing Supabase server env variables" });
    }

    const {
      email,
      referralCode = "",
      planType = "",
      userType = "",
      accessType = ""
    } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const normalizedEmail = normalizeEmail(email);
    const config = getPlanConfig({ requestedPlanType: planType, requestedAccessType: accessType });

    if (!config.priceId) {
      return res.status(500).json({ error: `Missing Stripe price ID for ${config.planName}` });
    }

    const { data: existingUser, error: userLookupError } = await supabase
      .from("users")
      .select("id, email, stripe_customer_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (userLookupError) {
      return res.status(500).json({ error: userLookupError.message });
    }

    let customerId = existingUser?.stripe_customer_id || null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: normalizedEmail,
        metadata: {
          email: normalizedEmail,
          plan_type: config.planType,
          access_type: config.accessType
        }
      });

      customerId = customer.id;

      if (existingUser?.id) {
        const { error: customerUpdateError } = await supabase
          .from("users")
          .update({
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingUser.id);

        if (customerUpdateError) {
          return res.status(500).json({ error: customerUpdateError.message });
        }
      }
    }

    await upsertPendingMirrors({
      userId: existingUser?.id || null,
      email: normalizedEmail,
      customerId,
      config,
      referralCode
    });

    const successUrl = `${SITE_URL}/dashboard.html?checkout=success`;
    const cancelUrl = `${SITE_URL}/index.html?checkout=cancelled`;

    const subscriptionData = {
      metadata: {
        email: normalizedEmail,
        referral_code: clean(referralCode),
        requested_plan_type: clean(planType),
        requested_user_type: clean(userType),
        requested_access_type: clean(accessType),
        plan_type: config.planType,
        plan_name: config.planName,
        access_type: config.accessType,
        daily_posting_limit: String(config.dailyPostingLimit)
      }
    };

    if (config.founderEligible) {
      subscriptionData.trial_end = FOUNDER_TRIAL_END;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: existingUser?.id || undefined,
      customer: customerId,
      customer_email: customerId ? undefined : normalizedEmail,
      line_items: [
        {
          price: config.priceId,
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        email: normalizedEmail,
        referral_code: clean(referralCode),
        requested_plan_type: clean(planType),
        requested_user_type: clean(userType),
        requested_access_type: clean(accessType),
        plan_type: config.planType,
        plan_name: config.planName,
        access_type: config.accessType,
        daily_posting_limit: String(config.dailyPostingLimit)
      },
      subscription_data: subscriptionData,
      custom_text: {
        submit: {
          message: `You are subscribing to ${normalizePlanName(config.planType, config.accessType)}.`
        }
      }
    });

    return res.status(200).json({
      url: session.url,
      plan_name: config.planName,
      access_type: config.accessType
    });
  } catch (error) {
    console.error("create-checkout-session error:", error);
    return res.status(500).json({
      error: error.message || "Could not create checkout session"
    });
  }
}
