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

function clean(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

async function resolveCustomerId({ email, userId }) {
  const normalizedEmail = normalizeEmail(email);
  const cleanUserId = clean(userId);

  if (cleanUserId) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email,stripe_customer_id")
      .eq("id", cleanUserId)
      .maybeSingle();

    if (error) throw error;
    if (data?.stripe_customer_id) return { customerId: data.stripe_customer_id, source: "users.id" };
    if (data?.email && !email) {
      const subLookup = await resolveCustomerId({ email: data.email });
      if (subLookup?.customerId) return subLookup;
    }
  }

  if (normalizedEmail) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email,stripe_customer_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) throw error;
    if (data?.stripe_customer_id) return { customerId: data.stripe_customer_id, source: "users.email" };

    const { data: subscriptionRow, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id,email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (subscriptionError) throw subscriptionError;
    if (subscriptionRow?.stripe_customer_id) {
      return { customerId: subscriptionRow.stripe_customer_id, source: "subscriptions.email" };
    }
  }

  return { customerId: "", source: "none" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY env variable" });
    }

    const { email = "", userId = "" } = req.body || {};

    if (!email && !userId) {
      return res.status(400).json({ error: "Missing email or userId" });
    }

    const { customerId, source } = await resolveCustomerId({ email, userId });

    if (!customerId) {
      return res.status(400).json({
        error: "Billing portal is not available yet. Complete checkout first so a Stripe customer can be attached to this account.",
        source
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${SITE_URL}/dashboard.html`
    });

    return res.status(200).json({ url: session.url, source });
  } catch (error) {
    console.error("create-billing-portal-session error:", error);
    return res.status(500).json({
      error: error.message || "Could not create billing portal session"
    });
  }
}
