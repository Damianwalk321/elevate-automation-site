// /api/create-billing-portal-session.js

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: user, error } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!user?.stripe_customer_id) {
      return res.status(400).json({ error: "No Stripe customer found for this account." });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${SITE_URL}/dashboard.html`
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("create-billing-portal-session error:", error);
    return res.status(500).json({
      error: error.message || "Could not create billing portal session"
    });
  }
}
