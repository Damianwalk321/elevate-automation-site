import { getPublicOfferConfig } from "../_shared/offer-config.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  res.status(200).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(getPublicOfferConfig()));
}
