// /api/stripe-webhook.js

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(readable) {
  const chunks = [];

  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

function clean(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value !== undefined && value !== null && typeof value !== "string") return value;
  }
  return "";
}

function mapPlanFromPriceId(priceId) {
  const founder = clean(process.env.STRIPE_FOUNDER_PRICE_ID);
  const starter = clean(process.env.STRIPE_STARTER_PRICE_ID);
  const founderPro = clean(process.env.STRIPE_FOUNDER_PRO_PRICE_ID);
  const pro = clean(process.env.STRIPE_PRO_PRICE_ID);

  if (priceId && founder && priceId === founder) return "Founder Starter";
  if (priceId && founderPro && priceId === founderPro) return "Founder Pro";
  if (priceId && starter && priceId === starter) return "Starter";
  if (priceId && pro && priceId === pro) return "Pro";

  return "Active Plan";
}

function getDailyPostingLimit(planName) {
  const plan = clean(planName).toLowerCase();
  if (plan.includes("starter")) return 5;
  if (plan.includes("pro")) return 25;
  return 25;
}

async function findUser({ email, customerId, subscriptionId }) {
  const normalizedEmail = normalizeEmail(email);

  if (normalizedEmail) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (!error && data) return data;
  }

  if (customerId) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (!error && data) return data;
  }

  if (subscriptionId) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();

    if (!error && data) return data;
  }

  return null;
}

async function updateUsersTable({ email, customerId, subscriptionId, priceId, planName, status }) {
  const normalizedEmail = normalizeEmail(email);
  const payload = {
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscriptionId || null,
    stripe_price_id: priceId || null,
    subscription_status: status || null,
    plan: planName || "Active Plan",
    updated_at: new Date().toISOString()
  };

  if (normalizedEmail) {
    const { error } = await supabase
      .from("users")
      .update(payload)
      .eq("email", normalizedEmail);

    if (!error) return;
  }

  if (customerId) {
    const { error } = await supabase
      .from("users")
      .update(payload)
      .eq("stripe_customer_id", customerId);

    if (!error) return;
  }

  if (subscriptionId) {
    const { error } = await supabase
      .from("users")
      .update(payload)
      .eq("stripe_subscription_id", subscriptionId);

    if (!error) return;
  }
}

async function upsertSubscriptionsMirror({ user, email, customerId, subscriptionId, priceId, planName, status, currentPeriodEnd, trialEnd, cancelAtPeriodEnd, referralCode, accessType }) {
  const normalizedEmail = normalizeEmail(firstNonEmpty(email, user?.email));
  const payload = {
    user_id: user?.id || null,
    email: normalizedEmail || null,
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscriptionId || null,
    stripe_price_id: priceId || null,
    status: status || null,
    subscription_status: status || null,
    plan: planName || "Active Plan",
    plan_name: planName || "Active Plan",
    access: ["active", "trialing", "paid"].includes(clean(status).toLowerCase()),
    active: ["active", "trialing", "paid"].includes(clean(status).toLowerCase()),
    daily_posting_limit: getDailyPostingLimit(planName),
    current_period_end: currentPeriodEnd || null,
    trial_end: trialEnd || null,
    cancel_at_period_end: Boolean(cancelAtPeriodEnd),
    referral_code: referralCode || null,
    access_type: accessType || null,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("subscriptions")
    .upsert(payload, { onConflict: "email" });

  if (error) {
    console.error("subscriptions upsert warning:", error.message);
  }
}

async function mirrorPostingLimit({ user, email, planName }) {
  const normalizedEmail = normalizeEmail(firstNonEmpty(email, user?.email));
  const payload = {
    user_id: user?.id || null,
    email: normalizedEmail || null,
    daily_limit: getDailyPostingLimit(planName),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("posting_limits")
    .upsert(payload, { onConflict: "email" });

  if (error) {
    console.error("posting_limits upsert warning:", error.message);
  }
}

async function syncBillingState({ email, customerId, subscriptionId, priceId, planName, status, currentPeriodEnd, trialEnd, cancelAtPeriodEnd, referralCode, accessType }) {
  const user = await findUser({ email, customerId, subscriptionId });

  await updateUsersTable({
    email: firstNonEmpty(email, user?.email),
    customerId,
    subscriptionId,
    priceId,
    planName,
    status
  });

  await upsertSubscriptionsMirror({
    user,
    email: firstNonEmpty(email, user?.email),
    customerId,
    subscriptionId,
    priceId,
    planName,
    status,
    currentPeriodEnd,
    trialEnd,
    cancelAtPeriodEnd,
    referralCode,
    accessType
  });

  await mirrorPostingLimit({
    user,
    email: firstNonEmpty(email, user?.email),
    planName
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const signature = req.headers["stripe-signature"];

  if (!signature) {
    return res.status(400).json({ error: "Missing Stripe signature" });
  }

  let event;

  try {
    const rawBody = await readRawBody(req);

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const customerId = session.customer || null;
      const subscriptionId = session.subscription || null;
      const email = firstNonEmpty(
        session.customer_details?.email,
        session.customer_email,
        session.metadata?.email
      );

      let priceId = null;
      let planName = "Active Plan";
      let status = "active";
      let currentPeriodEnd = null;
      let trialEnd = null;
      let cancelAtPeriodEnd = false;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        priceId = subscription.items?.data?.[0]?.price?.id || null;
        planName = mapPlanFromPriceId(priceId);
        status = subscription.status || "active";
        currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
        trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
        cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
      }

      await syncBillingState({
        email,
        customerId,
        subscriptionId,
        priceId,
        planName,
        status,
        currentPeriodEnd,
        trialEnd,
        cancelAtPeriodEnd,
        referralCode: session.metadata?.referral_code || "",
        accessType: session.metadata?.access_type || ""
      });
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      const customerId = subscription.customer || null;
      const subscriptionId = subscription.id || null;
      const priceId = subscription.items?.data?.[0]?.price?.id || null;
      const planName = mapPlanFromPriceId(priceId);
      const status = subscription.status || "active";
      const currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
      const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
      const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);

      let email = clean(subscription.metadata?.email || "");
      if (!email && customerId) {
        const customer = await stripe.customers.retrieve(customerId);
        email = clean(customer?.email || customer?.metadata?.email || "");
      }

      await syncBillingState({
        email,
        customerId,
        subscriptionId,
        priceId,
        planName,
        status,
        currentPeriodEnd,
        trialEnd,
        cancelAtPeriodEnd,
        referralCode: subscription.metadata?.referral_code || "",
        accessType: subscription.metadata?.access_type || ""
      });
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const customerId = subscription.customer || null;
      const subscriptionId = subscription.id || null;
      const priceId = subscription.items?.data?.[0]?.price?.id || null;
      const planName = mapPlanFromPriceId(priceId);

      let email = clean(subscription.metadata?.email || "");
      if (!email && customerId) {
        const customer = await stripe.customers.retrieve(customerId);
        email = clean(customer?.email || customer?.metadata?.email || "");
      }

      await syncBillingState({
        email,
        customerId,
        subscriptionId,
        priceId,
        planName,
        status: "cancelled",
        currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        referralCode: subscription.metadata?.referral_code || "",
        accessType: subscription.metadata?.access_type || ""
      });
    }

    if (event.type === "invoice.payment_failed" || event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;
      const customerId = invoice.customer || null;
      const subscriptionId = invoice.subscription || null;
      const status = event.type === "invoice.payment_failed" ? "past_due" : "active";

      let email = clean(invoice.customer_email || invoice.metadata?.email || "");
      let priceId = null;
      let planName = "Active Plan";
      let currentPeriodEnd = null;
      let trialEnd = null;
      let cancelAtPeriodEnd = false;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        priceId = subscription.items?.data?.[0]?.price?.id || null;
        planName = mapPlanFromPriceId(priceId);
        currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
        trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
        cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
        if (!email) email = clean(subscription.metadata?.email || "");
      }

      if (!email && customerId) {
        const customer = await stripe.customers.retrieve(customerId);
        email = clean(customer?.email || customer?.metadata?.email || "");
      }

      await syncBillingState({
        email,
        customerId,
        subscriptionId,
        priceId,
        planName,
        status,
        currentPeriodEnd,
        trialEnd,
        cancelAtPeriodEnd,
        referralCode: invoice.metadata?.referral_code || "",
        accessType: invoice.metadata?.access_type || ""
      });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("stripe-webhook processing error:", error);
    return res.status(500).json({
      error: error.message || "Webhook processing failed"
    });
  }
}
