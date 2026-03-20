module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    return res.status(200).json({
      ok: true,
      message: "Billing route live"
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unknown server error"
    });
  }
};
