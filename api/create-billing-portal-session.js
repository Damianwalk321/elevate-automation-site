const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!stripeSecretKey) {
      return json(res, 500, { error: "Missing STRIPE_SECRET_KEY" });
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return json(res, 500, { error: "Missing Supabase environment variables" });
    }

    const body = parseBody(req);
    if (body.__parse_error) {
      return json(res, 400, { error: body.__parse_error });
    }

    const email = normalizeEmail(body.email || "");
    const userId = clean(body.userId || body.user_id || body.id || "");

    if (!email && !userId) {
      return json(res, 400, { error: "Missing email or userId" });
    }

    const stripe = new Stripe(stripeSecretKey);
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    let stripeCustomerId = "";
    let matchedUser = null;
    let matchedSubscription = null;

    // 1) Primary lookup: users by id
    if (userId) {
      const { data: userById, error: userByIdError } = await supabase
        .from("users")
        .select("id, email, stripe_customer_id")
        .eq("id", userId)
        .maybeSingle();

      if (userByIdError) {
        console.error("[billing-portal] users by id lookup failed:", userByIdError);
      }

      if (userById) {
        matchedUser = userById;
        stripeCustomerId = clean(userById.stripe_customer_id || "");
      }
    }

    // 2) Secondary lookup: users by email
    if (!stripeCustomerId && email) {
      const { data: userByEmail, error: userByEmailError } = await supabase
        .from("users")
        .select("id, email, stripe_customer_id")
        .eq("email", email)
        .maybeSingle();

      if (userByEmailError) {
        console.error("[billing-portal] users by email lookup failed:", userByEmailError);
      }

      if (userByEmail) {
        matchedUser = userByEmail;
        stripeCustomerId = clean(userByEmail.stripe_customer_id || "");
      }
    }

    // 3) Fallback: subscriptions by user_id
    if (!stripeCustomerId && matchedUser?.id) {
      const { data: subscriptionByUserId, error: subscriptionByUserIdError } = await supabase
        .from("subscriptions")
        .select("user_id, email, stripe_customer_id, status, plan, updated_at")
        .eq("user_id", matchedUser.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscriptionByUserIdError) {
        console.error("[billing-portal] subscriptions by user_id lookup failed:", subscriptionByUserIdError);
      }

      if (subscriptionByUserId) {
        matchedSubscription = subscriptionByUserId;
        stripeCustomerId = clean(subscriptionByUserId.stripe_customer_id || "");
      }
    }

    // 4) Fallback: subscriptions by raw userId if user row not found
    if (!stripeCustomerId && userId) {
      const { data: subscriptionByRawUserId, error: subscriptionByRawUserIdError } = await supabase
        .from("subscriptions")
        .select("user_id, email, stripe_customer_id, status, plan, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscriptionByRawUserIdError) {
        console.error("[billing-portal] subscriptions by raw user_id lookup failed:", subscriptionByRawUserIdError);
      }

      if (subscriptionByRawUserId) {
        matchedSubscription = subscriptionByRawUserId;
        stripeCustomerId = clean(subscriptionByRawUserId.stripe_customer_id || "");
      }
    }

    // 5) Fallback: subscriptions by email
    if (!stripeCustomerId && email) {
      const { data: subscriptionByEmail, error: subscriptionByEmailError } = await supabase
        .from("subscriptions")
        .select("user_id, email, stripe_customer_id, status, plan, updated_at")
        .eq("email", email)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscriptionByEmailError) {
        console.error("[billing-portal] subscriptions by email lookup failed:", subscriptionByEmailError);
      }

      if (subscriptionByEmail) {
        matchedSubscription = subscriptionByEmail;
        stripeCustomerId = clean(subscriptionByEmail.stripe_customer_id || "");
      }
    }

    if (!stripeCustomerId) {
      return json(res, 404, {
        error: "No Stripe customer found for this account",
        debug: {
          userId: userId || null,
          email: email || null,
          matchedUserId: matchedUser?.id || null,
          matchedSubscriptionUserId: matchedSubscription?.user_id || null,
          matchedSubscriptionEmail: matchedSubscription?.email || null
        }
      });
    }

    // Optional validation: make sure customer exists in Stripe before creating portal session
    try {
      await stripe.customers.retrieve(stripeCustomerId);
    } catch (stripeLookupError) {
      console.error("[billing-portal] stripe customer lookup failed:", stripeLookupError);
      return json(res, 404, {
        error: "Stripe customer record not found",
        debug: {
          stripeCustomerId
        }
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${getSiteUrl(req)}/dashboard.html`
    });

    return json(res, 200, { url: session.url });
  } catch (error) {
    console.error("[billing-portal] fatal error:", error);

    return json(res, 500, {
      error: error?.message || "Failed to create billing portal session"
    });
  }
};
