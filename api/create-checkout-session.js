const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(body));
}

function getSiteUrl(req) {
  return (
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`
  );
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

    const stripe = new Stripe(stripeSecretKey);
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const email = body.email || null;
    const userId = body.userId || body.id || null;

    if (!email && !userId) {
      return json(res, 400, { error: "Missing email or userId" });
    }

    let stripeCustomerId = null;
    let matchedUser = null;

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
        stripeCustomerId = userById.stripe_customer_id || null;
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
        stripeCustomerId = userByEmail.stripe_customer_id || null;
      }
    }

    // 3) Fallback: subscriptions by user_id only
    if (!stripeCustomerId && matchedUser?.id) {
      const { data: subscription, error: subscriptionError } = await supabase
        .from("subscriptions")
        .select("user_id, stripe_customer_id, status, plan, updated_at")
        .eq("user_id", matchedUser.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscriptionError) {
        console.error("[billing-portal] subscriptions by user_id lookup failed:", subscriptionError);
      }

      if (subscription?.stripe_customer_id) {
        stripeCustomerId = subscription.stripe_customer_id;
      }
    }

    if (!stripeCustomerId) {
      return json(res, 404, {
        error: "No Stripe customer found for this account",
        debug: {
          userId: userId || null,
          email: email || null,
          matchedUserId: matchedUser?.id || null
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
