
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

function normalizeStatus(status, fallback = "inactive") {
  const value = clean(status).toLowerCase();
  if (!value) return fallback;
  if (["active", "trialing", "paid", "checkout_pending"].includes(value)) return "active";
  if (["canceled", "cancelled", "unpaid", "past_due", "expired", "suspended", "inactive"].includes(value)) return "inactive";
  return value;
}

function statusIsActive(status) {
  return normalizeStatus(status) === "active";
}

function normalizePlanName(planName) {
  const plan = clean(planName).toLowerCase();
  if (!plan || plan === "active plan") return "Founder Beta";
  if (plan.includes("founder") && plan.includes("pro")) return "Founder Pro";
  if (plan.includes("founder") && plan.includes("starter")) return "Founder Beta";
  if (plan.includes("founder") || plan.includes("beta")) return "Founder Beta";
  if (plan.includes("starter")) return "Starter";
  if (plan.includes("pro")) return "Pro";
  return clean(planName) || "Founder Beta";
}

function getDailyPostingLimit(planName, status) {
  if (!statusIsActive(status)) return 0;
  const plan = normalizePlanName(planName).toLowerCase();
  if (plan.includes("founder") && plan.includes("pro")) return 25;
  if (plan === "pro" || (!plan.includes("founder") && plan.includes("pro"))) return 25;
  return 5;
}

function mapPlanFromPriceId(priceId) {
  const founder = clean(process.env.STRIPE_FOUNDER_PRICE_ID);
  const starter = clean(process.env.STRIPE_STARTER_PRICE_ID);
  const founderPro = clean(process.env.STRIPE_FOUNDER_PRO_PRICE_ID);
  const pro = clean(process.env.STRIPE_PRO_PRICE_ID);

  if (priceId && founder && priceId === founder) return "Founder Beta";
  if (priceId && founderPro && priceId === founderPro) return "Founder Pro";
  if (priceId && starter && priceId === starter) return "Starter";
  if (priceId && pro && priceId === pro) return "Pro";
  return "Active Plan";
}

async function findUser({ email, customerId, subscriptionId, userId }) {
  const normalizedEmail = normalizeEmail(email);

  if (clean(userId)) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email")
      .eq("id", clean(userId))
      .maybeSingle();
    if (!error && data) return data;
  }

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

async function updateUsersTable({ userId, email, customerId, subscriptionId, priceId, planName, status }) {
  const normalizedEmail = normalizeEmail(email);
  const payload = {
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscriptionId || null,
    stripe_price_id: priceId || null,
    subscription_status: status || null,
    plan: planName || "Active Plan",
    updated_at: new Date().toISOString()
  };

  if (clean(userId)) {
    const { error } = await supabase.from("users").update(payload).eq("id", clean(userId));
    if (!error) return;
  }

  if (normalizedEmail) {
    const { error } = await supabase.from("users").update(payload).eq("email", normalizedEmail);
    if (!error) return;
  }

  if (customerId) {
    const { error } = await supabase.from("users").update(payload).eq("stripe_customer_id", customerId);
    if (!error) return;
  }

  if (subscriptionId) {
    const { error } = await supabase.from("users").update(payload).eq("stripe_subscription_id", subscriptionId);
    if (!error) return;
  }
}


async function getExistingSubscriptionByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .ilike("email", normalizedEmail)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("existing subscription lookup warning:", error.message);
    return null;
  }
  return data || null;
}

async function upsertSubscriptionsMirror({ user, email, customerId, subscriptionId, priceId, planName, status, currentPeriodEnd, trialEnd, cancelAtPeriodEnd, referralCode, referralSource, accessType }) {
  const normalizedEmail = normalizeEmail(firstNonEmpty(email, user?.email));
  const existing = await getExistingSubscriptionByEmail(normalizedEmail);
  const existingSnapshot = existing?.account_snapshot && typeof existing.account_snapshot === "object" ? existing.account_snapshot : {};
  const lockedReferralCode = clean(existing?.referral_code || existingSnapshot.referral_code || "");
  const lockedReferralSource = clean(existingSnapshot.referral_source || "");
  const finalReferralCode = clean(lockedReferralCode || referralCode || "");
  const finalReferralSource = clean(lockedReferralSource || referralSource || "");
  const payload = {
    user_id: user?.id || null,
    email: normalizedEmail || null,
    stripe_customer_id: customerId || null,
    stripe_subscription_id: subscriptionId || null,
    stripe_price_id: priceId || null,
    status: status || null,
    subscription_status: status || null,
    plan: normalizePlanName(planName),
    plan_name: normalizePlanName(planName),
    plan_type: normalizePlanName(planName),
    access: statusIsActive(status),
    active: statusIsActive(status),
    daily_posting_limit: getDailyPostingLimit(planName, status),
    current_period_end: currentPeriodEnd || null,
    trial_end: trialEnd || null,
    cancel_at_period_end: Boolean(cancelAtPeriodEnd),
    referral_code: finalReferralCode || null,
    access_type: clean(accessType) || null,
    account_snapshot: {
      user_id: user?.id || null,
      email: normalizedEmail || null,
      plan: normalizePlanName(planName),
      normalized_plan: normalizePlanName(planName),
      status: normalizeStatus(status, "inactive"),
      normalized_status: normalizeStatus(status, "inactive"),
      active: statusIsActive(status),
      access_granted: statusIsActive(status),
      posting_limit: getDailyPostingLimit(planName, status),
      posts_today: 0,
      posts_remaining: getDailyPostingLimit(planName, status),
      current_period_end: currentPeriodEnd || null,
      trial_end: trialEnd || null,
      cancel_at_period_end: Boolean(cancelAtPeriodEnd),
      referral_code: finalReferralCode || null,
      referral_source: finalReferralSource || null
    },
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("subscriptions")
    .upsert(payload, { onConflict: "email" });

  if (error) {
    console.error("subscriptions upsert warning:", error.message);
  }
}

async function syncBillingState({ userId, email, customerId, subscriptionId, priceId, planName, status, currentPeriodEnd, trialEnd, cancelAtPeriodEnd, referralCode, referralSource, accessType }) {
  const user = await findUser({ email, customerId, subscriptionId, userId });

  await updateUsersTable({
    userId: firstNonEmpty(user?.id, userId),
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
    referralSource,
    accessType
  });
}

async function getCustomerEmail(customerId) {
  if (!customerId) return "";
  const customer = await stripe.customers.retrieve(customerId);
  return clean(customer?.email || customer?.metadata?.email || "");
}

async function hydrateFromSubscription(subscriptionId) {
  if (!subscriptionId) {
    return {
      priceId: null,
      planName: "Active Plan",
      status: "active",
      currentPeriodEnd: null,
      trialEnd: null,
      cancelAtPeriodEnd: false,
      metadata: {}
    };
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items?.data?.[0]?.price?.id || null;

  return {
    priceId,
    planName: clean(subscription.metadata?.plan_name) || mapPlanFromPriceId(priceId),
    status: subscription.status || "active",
    currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    metadata: subscription.metadata || {}
  };
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
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("Webhook signature verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const customerId = session.customer || null;
      const subscriptionId = session.subscription || null;
      const userId = clean(session.client_reference_id || "");
      const email = firstNonEmpty(
        session.customer_details?.email,
        session.customer_email,
        session.metadata?.email
      );

      const hydrated = await hydrateFromSubscription(subscriptionId);

      await syncBillingState({
        userId,
        email,
        customerId,
        subscriptionId,
        priceId: hydrated.priceId,
        planName: clean(session.metadata?.plan_name) || hydrated.planName,
        status: hydrated.status,
        currentPeriodEnd: hydrated.currentPeriodEnd,
        trialEnd: hydrated.trialEnd,
        cancelAtPeriodEnd: hydrated.cancelAtPeriodEnd,
        referralCode: session.metadata?.referral_code || hydrated.metadata?.referral_code || "",
        referralSource: session.metadata?.referral_source || hydrated.metadata?.referral_source || "",
        accessType: session.metadata?.access_type || hydrated.metadata?.access_type || ""
      });
    }

    if (["customer.subscription.created", "customer.subscription.updated"].includes(event.type)) {
      const subscription = event.data.object;
      const customerId = subscription.customer || null;
      const subscriptionId = subscription.id || null;
      const priceId = subscription.items?.data?.[0]?.price?.id || null;
      const planName = clean(subscription.metadata?.plan_name) || mapPlanFromPriceId(priceId);
      const status = subscription.status || "active";
      let email = clean(subscription.metadata?.email || "");
      if (!email && customerId) email = await getCustomerEmail(customerId);

      await syncBillingState({
        email,
        customerId,
        subscriptionId,
        priceId,
        planName,
        status,
        currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        referralCode: subscription.metadata?.referral_code || "",
        referralSource: subscription.metadata?.referral_source || "",
        accessType: subscription.metadata?.access_type || ""
      });
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const customerId = subscription.customer || null;
      const subscriptionId = subscription.id || null;
      const priceId = subscription.items?.data?.[0]?.price?.id || null;
      const planName = clean(subscription.metadata?.plan_name) || mapPlanFromPriceId(priceId);
      let email = clean(subscription.metadata?.email || "");
      if (!email && customerId) email = await getCustomerEmail(customerId);

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
        referralSource: subscription.metadata?.referral_source || "",
        accessType: subscription.metadata?.access_type || ""
      });
    }

    if (["invoice.payment_failed", "invoice.payment_succeeded", "invoice.paid"].includes(event.type)) {
      const invoice = event.data.object;
      const customerId = invoice.customer || null;
      const subscriptionId = invoice.subscription || null;
      const invoiceStatus = event.type === "invoice.payment_failed" ? "past_due" : "active";
      let email = clean(invoice.customer_email || invoice.metadata?.email || "");

      const hydrated = await hydrateFromSubscription(subscriptionId);
      if (!email && customerId) email = await getCustomerEmail(customerId);

      await syncBillingState({
        email,
        customerId,
        subscriptionId,
        priceId: hydrated.priceId,
        planName: hydrated.planName,
        status: invoiceStatus,
        currentPeriodEnd: hydrated.currentPeriodEnd,
        trialEnd: hydrated.trialEnd,
        cancelAtPeriodEnd: hydrated.cancelAtPeriodEnd,
        referralCode: invoice.metadata?.referral_code || hydrated.metadata?.referral_code || "",
        accessType: invoice.metadata?.access_type || hydrated.metadata?.access_type || ""
      });
    }

    return res.status(200).json({ received: true, event_type: event.type });
  } catch (error) {
    console.error("stripe-webhook processing error:", error);
    return res.status(500).json({
      error: error.message || "Webhook processing failed"
    });
  }
}
