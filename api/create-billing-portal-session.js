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

async function findCustomerIdInSupabase({ email, userId }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) return "";

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const normalizedEmail = normalizeEmail(email);
  const cleanedUserId = clean(userId);

  try {
    if (cleanedUserId) {
      const { data, error } = await supabase
        .from("users")
        .select("stripe_customer_id")
        .eq("id", cleanedUserId)
        .maybeSingle();

      if (!error && data?.stripe_customer_id) {
        return clean(data.stripe_customer_id);
      }
    }

    if (normalizedEmail) {
      const { data, error } = await supabase
        .from("users")
        .select("stripe_customer_id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (!error && data?.stripe_customer_id) {
        return clean(data.stripe_customer_id);
      }
    }
  } catch (error) {
    console.error("[billing-portal] supabase lookup warning:", error);
  }

  return "";
}

async function mirrorCustomerToSupabase({ email, userId, stripeCustomerId }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) return;

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
      console.error("[billing-portal] users update by id warning:", error.message);
    }

    if (normalizedEmail) {
      const { error } = await supabase
        .from("users")
        .update(payload)
        .eq("email", normalizedEmail);

      if (error) {
        console.error(
          "[billing-portal] users update by email warning:",
          error.message
        );
      }
    }
  } catch (error) {
    console.error("[billing-portal] supabase mirror warning:", error);
  }
}

async function findSubscriptionMirror({ email, userId }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) return null;

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const normalizedEmail = normalizeEmail(email);
  const cleanedUserId = clean(userId);

  try {
    let query = supabase.from("subscriptions").select("stripe_customer_id,stripe_subscription_id,email,user_id").order("updated_at", { ascending: false }).limit(1);
    if (cleanedUserId && normalizedEmail) {
      query = query.or(`user_id.eq.${cleanedUserId},email.eq.${normalizedEmail}`);
    } else if (cleanedUserId) {
      query = query.eq("user_id", cleanedUserId);
    } else if (normalizedEmail) {
      query = query.eq("email", normalizedEmail);
    } else {
      return null;
    }
    const { data, error } = await query.maybeSingle();
    if (!error && data) return data;
  } catch (error) {
    console.error("[billing-portal] subscription mirror lookup warning:", error);
  }

  return null;
}

async function resolveCustomer({ email, userId }) {
  const normalizedEmail = normalizeEmail(email);
  const cleanedUserId = clean(userId);

  if (!normalizedEmail && !cleanedUserId) {
    return null;
  }

  // 1) Prefer stored Stripe customer id in Supabase
  const storedCustomerId = await findCustomerIdInSupabase({
    email: normalizedEmail,
    userId: cleanedUserId
  });

  if (storedCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(storedCustomerId);
      if (customer && !customer.deleted) {
        return customer;
      }
    } catch (error) {
      console.error("[billing-portal] stored customer retrieve warning:", error);
    }
  }

  const subscriptionMirror = await findSubscriptionMirror({ email: normalizedEmail, userId: cleanedUserId });
  if (subscriptionMirror?.stripe_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(clean(subscriptionMirror.stripe_customer_id));
      if (customer && !customer.deleted) {
        return customer;
      }
    } catch (error) {
      console.error("[billing-portal] subscription mirror customer warning:", error);
    }
  }

  // 2) Fallback to Stripe email search
  if (normalizedEmail) {
    const existing = await stripe.customers.list({
      email: normalizedEmail,
      limit: 1
    });

    if (existing?.data?.length) {
      const customer = existing.data[0];

      const nextMetadata = {
        ...(customer.metadata || {})
      };

      if (cleanedUserId && !nextMetadata.user_id) {
        nextMetadata.user_id = cleanedUserId;
      }
      if (normalizedEmail && !nextMetadata.email) {
        nextMetadata.email = normalizedEmail;
      }

      let finalCustomer = customer;

      if (
        JSON.stringify(nextMetadata) !== JSON.stringify(customer.metadata || {})
      ) {
        finalCustomer = await stripe.customers.update(customer.id, {
          metadata: nextMetadata
        });
      }

      await mirrorCustomerToSupabase({
        email: normalizedEmail,
        userId: cleanedUserId,
        stripeCustomerId: finalCustomer.id
      });

      return finalCustomer;
    }
  }

  return null;
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
    const returnPath = clean(body.returnPath || "/dashboard.html");
    const siteUrl = getSiteUrl(req);

    const customer = await resolveCustomer({ email, userId });

    if (!customer?.id) {
      return json(res, 404, {
        error: "No Stripe customer found for this account"
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${siteUrl}${returnPath.startsWith("/") ? returnPath : `/${returnPath}`}`
    });

    return json(res, 200, {
      url: session.url
    });
  } catch (error) {
    console.error("[billing-portal] fatal error:", error);

    return json(res, 500, {
      error: error?.message || "Failed to create billing portal session"
    });
  }
}
