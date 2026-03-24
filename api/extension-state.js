export default async function handler(req, res) {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ ok: false, error: "Missing email" });
    }

    // ---- MOCK / FETCH USER (replace with DB if needed) ----
    // You likely already fetch this — keep your existing DB logic here
    const user = {
      email,
      plan: "founder_beta",
      status: "active"
    };

    // ---- PLAN NORMALIZATION ----
    const rawPlan = (user.plan || "").toLowerCase().replace(/[\s\-]/g, "_");

    let normalized_plan = "starter";
    let posting_limit = 5;

    if (rawPlan.includes("founder_pro") || rawPlan === "pro") {
      normalized_plan = "founder_pro";
      posting_limit = 25;
    } else if (rawPlan.includes("founder_beta")) {
      normalized_plan = "founder_beta";
      posting_limit = 5;
    } else if (rawPlan === "starter") {
      normalized_plan = "starter";
      posting_limit = 5;
    }

    const normalized_status = user.status === "active" ? "active" : "inactive";

    // ---- FETCH USAGE (DB or fallback) ----
    let posts_today = 0;

    // replace with real DB query if exists
    // posts_today = await getTodayUsage(email)

    const posts_remaining = Math.max(posting_limit - posts_today, 0);

    return res.status(200).json({
      ok: true,
      account: {
        email,
        plan: normalized_plan,
        status: normalized_status,
        access_granted: normalized_status === "active"
      },
      posting: {
        posts_today,
        posts_remaining,
        posting_limit
      }
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
