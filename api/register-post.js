import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { email, vehicle } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    // get subscription
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("email", email)
      .single();

    if (!subscription) {
      return res.status(403).json({ error: "No subscription found" });
    }

    const postingLimit = subscription.post_limit || 5;

    // today's date
    const today = new Date().toISOString().split("T")[0];

    // check usage
    const { data: usage } = await supabase
      .from("posting_usage")
      .select("*")
      .eq("email", email)
      .eq("date", today)
      .single();

    let postsToday = usage?.posts || 0;

    if (postsToday >= postingLimit) {
      return res.status(403).json({
        error: "Daily posting limit reached",
        postsToday,
        postingLimit
      });
    }

    postsToday++;

    if (usage) {

      await supabase
        .from("posting_usage")
        .update({
          posts: postsToday
        })
        .eq("id", usage.id);

    } else {

      await supabase
        .from("posting_usage")
        .insert({
          email,
          posts: 1,
          date: today
        });

    }

    // optional logging
    await supabase
      .from("post_logs")
      .insert({
        email,
        vehicle_title: vehicle?.title || "",
        price: vehicle?.price || "",
        created_at: new Date().toISOString()
      });

    return res.json({
      success: true,
      postsToday,
      postingLimit,
      remaining: postingLimit - postsToday
    });

  } catch (error) {

    console.error("register-post error", error);

    return res.status(500).json({
      error: "Server error"
    });

  }
}