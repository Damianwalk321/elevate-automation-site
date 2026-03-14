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
      priceId,
      email,
      referralCode = "",
      planType = "",
      userType = "",
      accessType = ""
    } = req.body || {};

    if (!priceId) {
      return res.status(400).json({ error: "Missing priceId" });
    }

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: existingUser, error: userLookupError } = await supabase
      .from("users")
      .select("id, email, stripe_customer_id, referral_code")
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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      customer_email: customerId ? undefined : normalizedEmail,
      line_items: [
        {
          price: priceId,
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
        access_type: accessType || ""
      },
      subscription_data: {
        metadata: {
          email: normalizedEmail,
          referral_code: referralCode || "",
          plan_type: planType || "",
          user_type: userType || "",
          access_type: accessType || ""
        }
      },
      custom_text: {
        submit: {
          message: `You are subscribing to ${normalizePlanName(planType, accessType)}.`
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
