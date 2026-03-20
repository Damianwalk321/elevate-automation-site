import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

function hasEnv(name) {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const env = {
    SUPABASE_URL: hasEnv("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
    STRIPE_SECRET_KEY: hasEnv("STRIPE_SECRET_KEY"),
    STRIPE_WEBHOOK_SECRET: hasEnv("STRIPE_WEBHOOK_SECRET"),
    STRIPE_FOUNDER_PRICE_ID: hasEnv("STRIPE_FOUNDER_PRICE_ID"),
    STRIPE_STARTER_PRICE_ID: hasEnv("STRIPE_STARTER_PRICE_ID"),
    STRIPE_FOUNDER_PRO_PRICE_ID: hasEnv("STRIPE_FOUNDER_PRO_PRICE_ID"),
    STRIPE_PRO_PRICE_ID: hasEnv("STRIPE_PRO_PRICE_ID"),
    SITE_URL: hasEnv("SITE_URL") || hasEnv("NEXT_PUBLIC_SITE_URL")
  };

  const checks = {
    stripe_client: false,
    supabase_query: false
  };

  try {
    if (env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      await stripe.balance.retrieve();
      checks.stripe_client = true;
    }
  } catch (error) {
    checks.stripe_error = error.message;
  }

  try {
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const result = await supabase.from("users").select("id", { count: "exact", head: true });
      if (!result.error) {
        checks.supabase_query = true;
      } else {
        checks.supabase_error = result.error.message;
      }
    }
  } catch (error) {
    checks.supabase_error = error.message;
  }

  const ok = Object.values(env).filter(Boolean).length >= 5 && checks.supabase_query;

  return res.status(ok ? 200 : 500).json({ ok, env, checks });
}
