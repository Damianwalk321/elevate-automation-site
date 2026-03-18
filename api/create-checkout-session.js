// /api/create-checkout-session.js

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

const FOUNDER_PRICE_ID = process.env.STRIPE_FOUNDER_PRICE_ID;
const STARTER_PRICE_ID = process.env.STRIPE_STARTER_PRICE_ID;

// Use Alberta-friendly midnight switch if you want founder open through Apr 1 local time
const FOUNDER_CUTOFF = new Date("2026-04-02T06:00:00Z");
const FOUNDER_TRIAL_END = Math.floor(
  new Date("2026-04-02T06:00:00Z").getTime() / 1000
);

function normalizePlanName(planType, accessType) {
  if (planType === "founder_starter") return "Founder Starter";
  if (planType === "founder_pro") return "Founder Pro";
  if (planType === "starter") return "Starter";
  if (planType === "pro") return "Pro";

  if (accessType === "founder") return "Founder";
  if (accessType === "standard") return "Standard";

  return "Elevate Plan";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
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

    if (!FOUNDER_PRICE_ID) {
      return res.status(500).json({ error: "Missing STRIPE_FOUNDER_PRICE_ID env variable" });
    }

    if (!STARTER_PRICE_ID) {
      return res.status(500).json({ error: "Missing STRIPE_STARTER_PRICE_ID env variable" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const now = new Date();
    const founderWindowOpen = now < FOUNDER_CUTOFF;

    const selectedPriceId = founderWindowOpen
      ? FOUNDER_PRICE_ID
      : STARTER_PRICE_ID;

    const finalAccessType = founderWindowOpen ? "founder" : "standard";

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
          email: normalizedEmail
        }
      });

      customerId = customer.id;

      if (existingUser?.id) {
        const { error: customerUpdateError } = await supabase
          .from("users")
          .update({
            stripe_customer_id: customerId
          })
          .eq("id", existingUser.id);

        if (customerUpdateError) {
          return res.status(500).json({ error: customerUpdateError.message });
        }
      }
    }

    const successUrl = `${SITE_URL}/dashboard.html?checkout=success`;
    const cancelUrl = `${SITE_URL}/index.html?checkout=cancelled`;

    const subscriptionData = {
      metadata: {
        email: normalizedEmail,
        referral_code: referralCode || "",
        plan_type: planType || "",
        user_type: userType || "",
        access_type: finalAccessType
      }
    };

    if (founderWindowOpen) {
      subscriptionData.trial_end = FOUNDER_TRIAL_END;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      customer_email: customerId ? undefined : normalizedEmail,
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        email: normalizedEmail,
        referral_code: referralCode || "",
        plan_type: planType || "",
        user_type: userType || "",
        access_type: finalAccessType
      },
      subscription_data: subscriptionData,
      custom_text: {
        submit: {
          message: `You are subscribing to ${normalizePlanName(planType, finalAccessType)}.`
        }
      }
    });

    return res.status(200).json({
      url: session.url
    });
  } catch (error) {
    console.error("create-checkout-session error:", error);
    return res.status(500).json({
      error: error.message || "Could not create checkout session"
    });
  }
}
