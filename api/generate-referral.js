import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateCode(name) {
  const clean = name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `${clean}${random}`;
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, name } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {

    const referralCode = generateCode(name);

    const { data, error } = await supabase
      .from("users")
      .update({ referral_code: referralCode })
      .eq("email", email);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      referral_code: referralCode
    });

  } catch (err) {

    return res.status(500).json({
      error: err.message
    });

  }

}
