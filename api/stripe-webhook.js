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

function mapPlanFromPriceId(priceId) {
  const founderStarter = "price_1TAIiQFjHUUVl5XclBkphvUF";
  const founderPro = "price_1TAIipFjHUUVl5XcRhx3sAvv";
  const starter = "price_1TAIjWFjHUUVl5XciikHcOks";
  const pro = "price_1T98thFjHUUVl5XcPZfqa4wx";

  if (priceId === founderStarter) return "Founder Starter";
  if (priceId === founderPro) return "Founder Pro";
  if (priceId === starter) return "Starter";
  if (priceId === pro) return "Pro";

  return "Active Plan";
}

async function updateUserByEmail(email, payload) {
  if (!email) return;

  const normalizedEmail = String(email).trim().toLowerCase();

  const { error } = await supabase
    .from("users")
    .update(payload)
    .eq("email", normalizedEmail);

  if (error) {
    throw new Error(error.message);
  }
}

async function updateUserByCustomerId(customerId, payload) {
  if (!customerId) return;

  const { error } = await supabase
    .from("users")
    .update(payload)
    .eq("stripe_customer_id", customerId);

  if (error) {
    throw new Error(error.message);
  }
}

async function updateUserBySubscriptionId(subscriptionId, payload) {
  if (!subscriptionId) return;

  const { error } = await supabase
    .from("users")
    .update(payload)
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    throw new Error(error.message);
  }
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
      const email =
        session.customer_details?.email ||
        session.customer_email ||
        session.metadata?.email ||
        null;

      let priceId = null;
      let planName = "Active Plan";

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        priceId = subscription.items?.data?.[0]?.price?.id || null;
        planName = mapPlanFromPriceId(priceId);
      }

      await updateUserByEmail(email, {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId,
        subscription_status: "active",
        plan: planName
      });
    }

    if (event.type === "customer.subscription.created") {
      const subscription = event.data.object;

      const customerId = subscription.customer || null;
      const subscriptionId = subscription.id || null;
      const priceId = subscription.items?.data?.[0]?.price?.id || null;
      const planName = mapPlanFromPriceId(priceId);
      const status = subscription.status || "active";

      await updateUserByCustomerId(customerId, {
        stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId,
        subscription_status: status,
        plan: planName
      });
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;

      const customerId = subscription.customer || null;
      const subscriptionId = subscription.id || null;
      const priceId = subscription.items?.data?.[0]?.price?.id || null;
      const planName = mapPlanFromPriceId(priceId);
      const status = subscription.status || "active";

      await updateUserByCustomerId(customerId, {
        stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId,
        subscription_status: status,
        plan: planName
      });

      await updateUserBySubscriptionId(subscriptionId, {
        stripe_price_id: priceId,
        subscription_status: status,
        plan: planName
      });
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;

      const subscriptionId = subscription.id || null;
      const customerId = subscription.customer || null;

      await updateUserBySubscriptionId(subscriptionId, {
        subscription_status: "cancelled"
      });

      await updateUserByCustomerId(customerId, {
        subscription_status: "cancelled"
      });
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;

      const customerId = invoice.customer || null;
      const subscriptionId = invoice.subscription || null;

      await updateUserBySubscriptionId(subscriptionId, {
        subscription_status: "past_due"
      });

      await updateUserByCustomerId(customerId, {
        subscription_status: "past_due"
      });
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;

      const customerId = invoice.customer || null;
      const subscriptionId = invoice.subscription || null;

      await updateUserBySubscriptionId(subscriptionId, {
        subscription_status: "active"
      });

      await updateUserByCustomerId(customerId, {
        subscription_status: "active"
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

