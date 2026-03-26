import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { requireVerifiedDashboardUser, getTrustedIdentity } from "./_shared/auth.js";

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

function normalizeStatus(value) {
  return clean(value).toLowerCase();
}

function statusMeansSubscriptionExists(status) {
  return ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"].includes(normalizeStatus(status));
}

function normalizePlanRequest(planType, accessType, userType) {
  const normalizedPlanType = clean(planType).toLowerCase();
  const normalizedAccessType = clean(accessType).toLowerCase();
  const normalizedUserType = clean(userType).toLowerCase();

  if (["founder beta", "founder-beta", "founder_beta", "founder", "beta", "beta founder", "founder starter", "founder-starter", "founder_starter"].includes(normalizedPlanType)) {
    return "founder_beta";
  }
  if (["founder pro", "founder-pro", "founder_pro"].includes(normalizedPlanType)) return "founder_pro";
  if (normalizedPlanType === "starter") return "starter";
  if (normalizedPlanType === "pro") return "pro";
  if (!normalizedPlanType && (normalizedAccessType === "founder" || normalizedUserType === "founder")) return "founder_beta";
  return normalizedPlanType;
}

function checkoutContextFromPlan(planName, explicitPlanType = "") {
  const normalizedPlanType = normalizePlanRequest(explicitPlanType, "", "");
  if (normalizedPlanType) {
    if (normalizedPlanType === "founder_pro") {
      return { planType: "founder_pro", accessType: "founder", userType: "founder" };
    }
    if (normalizedPlanType === "pro") {
      return { planType: "pro", accessType: "public", userType: "sales" };
    }
    if (normalizedPlanType === "starter") {
      return { planType: "starter", accessType: "public", userType: "sales" };
    }
    return { planType: "founder_beta", accessType: "founder", userType: "founder" };
  }

  const value = clean(planName).toLowerCase();
  if (value.includes("founder") && value.includes("pro")) {
    return { planType: "founder_pro", accessType: "founder", userType: "founder" };
  }
  if (value === "pro" || (!value.includes("founder") && value.includes("pro"))) {
    return { planType: "pro", accessType: "public", userType: "sales" };
  }
  if (value === "starter" || (!value.includes("founder") && value.includes("starter"))) {
    return { planType: "starter", accessType: "public", userType: "sales" };
  }
  return { planType: "founder_beta", accessType: "founder", userType: "founder" };
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

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

async function findCustomerIdInSupabase({ email, userId }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return "";

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
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

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
        console.error("[billing-portal] users update by email warning:", error.message);
      }
    }
  } catch (error) {
    console.error("[billing-portal] supabase mirror warning:", error);
  }
}

async function findSubscriptionMirror({ email, userId }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const normalizedEmail = normalizeEmail(email);
  const cleanedUserId = clean(userId);

  try {
    let query = supabase
      .from("subscriptions")
      .select("stripe_customer_id,stripe_subscription_id,email,user_id,status,subscription_status,plan,plan_name,plan_type,access_type")
      .order("updated_at", { ascending: false })
      .limit(1);

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

async function findUserBillingState({ email, userId }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const normalizedEmail = normalizeEmail(email);
  const cleanedUserId = clean(userId);

  try {
    let query = supabase
      .from("users")
      .select("id,email,stripe_customer_id,stripe_subscription_id,subscription_status,plan")
      .limit(1);

    if (cleanedUserId && normalizedEmail) {
      query = query.or(`id.eq.${cleanedUserId},email.eq.${normalizedEmail}`);
    } else if (cleanedUserId) {
      query = query.eq("id", cleanedUserId);
    } else if (normalizedEmail) {
      query = query.eq("email", normalizedEmail);
    } else {
      return null;
    }

    const { data, error } = await query.maybeSingle();
    if (!error && data) return data;
  } catch (error) {
    console.error("[billing-portal] user billing lookup warning:", error);
  }

  return null;
}

async function resolveCustomer({ email, userId }) {
  const normalizedEmail = normalizeEmail(email);
  const cleanedUserId = clean(userId);

  if (!normalizedEmail && !cleanedUserId) {
    return null;
  }

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

      if (cleanedUserId && !nextMetadata.user_id) nextMetadata.user_id = cleanedUserId;
      if (normalizedEmail && !nextMetadata.email) nextMetadata.email = normalizedEmail;

      let finalCustomer = customer;
      if (JSON.stringify(nextMetadata) !== JSON.stringify(customer.metadata || {})) {
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

async function customerHasManageableSubscription(customerId, mirrorState = null, userState = null) {
  if (!customerId) return false;

  if (clean(mirrorState?.stripe_subscription_id) && statusMeansSubscriptionExists(mirrorState?.subscription_status || mirrorState?.status)) {
    return true;
  }

  if (clean(userState?.stripe_subscription_id) && statusMeansSubscriptionExists(userState?.subscription_status)) {
    return true;
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10
    });

    return Boolean(
      subscriptions?.data?.some((subscription) => {
        const status = normalizeStatus(subscription?.status);
        return statusMeansSubscriptionExists(status);
      })
    );
  } catch (error) {
    console.error("[billing-portal] subscription list warning:", error);
    return false;
  }
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

    const verifiedUser = await requireVerifiedDashboardUser(req, res);
    if (req.headers?.["x-elevate-client"] && !verifiedUser && String(req.headers["x-elevate-client"]).toLowerCase() === "dashboard") {
      return;
    }
    const identity = getTrustedIdentity({ verifiedUser, body });

    const email = normalizeEmail(identity.email || body.email || "");
    const userId = clean(identity.id || body.userId || body.user_id || body.id || "");
    const returnPath = clean(body.returnPath || "/dashboard.html");
    const siteUrl = getSiteUrl(req);

    const userState = await findUserBillingState({ email, userId });
    const subscriptionMirror = await findSubscriptionMirror({ email, userId });
    const checkoutContext = checkoutContextFromPlan(
      body.planType || subscriptionMirror?.plan || subscriptionMirror?.plan_name || subscriptionMirror?.plan_type || userState?.plan || "Founder Beta",
      body.planType || ""
    );

    const customer = await resolveCustomer({ email, userId });

    if (!customer?.id) {
      return json(res, 200, {
        redirectToCheckout: true,
        message: "Billing profile not active yet. Start checkout first.",
        checkoutContext
      });
    }

    const hasSubscription = await customerHasManageableSubscription(customer.id, subscriptionMirror, userState);
    if (!hasSubscription) {
      await mirrorCustomerToSupabase({
        email,
        userId,
        stripeCustomerId: customer.id
      });

      return json(res, 200, {
        redirectToCheckout: true,
        message: "Stripe customer found, but no active plan is attached yet. Start checkout to activate billing.",
        checkoutContext
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
