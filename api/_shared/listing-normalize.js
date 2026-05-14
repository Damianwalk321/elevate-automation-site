
export function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

export function safeNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const normalized = raw
    .replace(/[$,]/g, "")
    .replace(/\b(?:cad|usd|km|kilometers?|miles?|mi)\b/gi, "")
    .replace(/[^\d.-]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function firstPresent(row = {}, keys = []) {
  for (const key of keys) {
    if (!(key in row)) continue;
    const value = row[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && !clean(value)) continue;
    return { key, value };
  }
  return { key: "", value: null };
}

export function looksLikeMileage(n) {
  return Number.isFinite(n) && n >= 1000 && n <= 1500000;
}

export function looksLikePrice(n) {
  return Number.isFinite(n) && n >= 500 && n <= 250000;
}

export function looksLikeNormalRetailPrice(n) {
  return Number.isFinite(n) && n >= 500 && n <= 150000;
}

export function looksLikeSuspiciousRetailPrice(n) {
  return Number.isFinite(n) && n > 150000 && n <= 250000;
}

function buildCandidatePool(row = {}, keys = []) {
  const candidates = [];
  for (const key of keys) {
    if (!(key in row)) continue;
    const value = row[key];
    const n = safeNumber(value, 0);
    if (!n) continue;
    candidates.push({ key, value, number: n });
  }
  return candidates;
}

function buildHeuristicCandidates(row = {}) {
  const candidates = [];
  for (const [key, value] of Object.entries(row || {})) {
    const normalizedKey = clean(key).toLowerCase();
    const raw = typeof value === "string" ? value : "";
    const number = safeNumber(value, 0);
    if (!number) continue;

    const priceishKey = /(^|_)(price|msrp|sale|asking|internet|our|advertised|selling|payment|amount|cost|value)(_|$)/i.test(normalizedKey);
    const mileageishKey = /(^|_)(mileage|kilometers|km|odometer|distance)(_|$)/i.test(normalizedKey);

    if (priceishKey && !mileageishKey) {
      candidates.push({ key, value, number, heuristic: "priceish_key" });
      continue;
    }

    if (raw && /[$]\s*\d/.test(raw) && looksLikePrice(number)) {
      candidates.push({ key, value, number, heuristic: "currency_string" });
    }
  }
  return candidates;
}

function candidateScore(candidate = {}) {
  const key = clean(candidate.key).toLowerCase();
  let score = candidate.heuristic ? 100 : 0;
  if (/sale_price|asking_price|internet_price|our_price|advertised_price|current_price|selling_price|final_price/i.test(key)) score += 40;
  if (/msrp/i.test(key)) score += 20;
  if (looksLikeNormalRetailPrice(candidate.number)) score += 25;
  if (looksLikeSuspiciousRetailPrice(candidate.number)) score -= 80;
  return score;
}

function pickBestPriceCandidate(candidates = [], exclude = new Set()) {
  const filtered = candidates.filter((candidate) => {
    if (!looksLikePrice(candidate.number)) return false;
    if (exclude.has(candidate.number)) return false;
    return true;
  });

  filtered.sort((a, b) => candidateScore(b) - candidateScore(a));
  return filtered[0] || null;
}

export function extractCanonicalPriceMileage(row = {}) {
  const priceKeys = [
    "price", "list_price", "sale_price", "asking_price", "vehicle_price", "internet_price",
    "our_price", "advertised_price", "current_price", "final_price", "selling_price", "msrp"
  ];
  const mileageKeys = [
    "mileage", "kilometers", "km", "odometer", "odometer_value", "distance", "distance_km"
  ];

  const rawPrice = firstPresent(row, priceKeys);
  const rawMileage = firstPresent(row, mileageKeys);

  let price = safeNumber(rawPrice.value, 0);
  let mileage = safeNumber(rawMileage.value, 0);
  let priceSource = rawPrice.key || "";
  let mileageSource = rawMileage.key || "";
  const warnings = [];

  const directCandidates = buildCandidatePool(row, priceKeys);
  const heuristicCandidates = buildHeuristicCandidates(row);
  const fullCandidatePool = [...directCandidates, ...heuristicCandidates];

  if (!mileage && looksLikeMileage(safeNumber(row.odometer, 0))) {
    mileage = safeNumber(row.odometer, 0);
    mileageSource = "odometer";
    warnings.push("mileage_defaulted_to_odometer");
  }

  if (!mileage && looksLikeMileage(price) && looksLikeSuspiciousRetailPrice(price)) {
    mileage = price;
    mileageSource = priceSource || "price";
    warnings.push("price_value_promoted_to_mileage_candidate");
  }

  if (price && mileage && price === mileage) {
    warnings.push("price_equals_mileage");
    const replacement = pickBestPriceCandidate(fullCandidatePool, new Set([mileage]));
    if (replacement && replacement.number !== mileage) {
      price = replacement.number;
      priceSource = replacement.key;
      warnings.push("price_recovered_after_duplicate");
    } else {
      price = 0;
      priceSource = "";
      warnings.push("price_unresolved_duplicate_mileage");
    }
  }

  if (price && looksLikeSuspiciousRetailPrice(price) && (!mileage || mileage === price)) {
    warnings.push("price_suspicious_retail_range");
    const replacement = pickBestPriceCandidate(fullCandidatePool, new Set([price, mileage]));
    if (replacement && looksLikeNormalRetailPrice(replacement.number)) {
      price = replacement.number;
      priceSource = replacement.key;
      warnings.push("price_recovered_from_alt_field");
    } else if (looksLikeMileage(price)) {
      if (!mileage) {
        mileage = price;
        mileageSource = priceSource || "price";
      }
      price = 0;
      priceSource = "";
      warnings.push("price_unresolved_likely_mileage");
    }
  }

  if (price && !looksLikePrice(price) && looksLikeMileage(price)) {
    warnings.push("price_looked_like_mileage");
    const replacement = pickBestPriceCandidate(fullCandidatePool, new Set([mileage, price]));
    if (replacement) {
      price = replacement.number;
      priceSource = replacement.key;
      warnings.push("price_recovered_after_out_of_range");
    } else {
      if (!mileage) {
        mileage = price;
        mileageSource = priceSource || "price";
      }
      price = 0;
      priceSource = "";
      warnings.push("price_unresolved_out_of_range");
    }
  }

  if ((!price || !looksLikePrice(price)) && looksLikeNormalRetailPrice(safeNumber(row.msrp, 0))) {
    price = safeNumber(row.msrp, 0);
    priceSource = "msrp";
    warnings.push("price_defaulted_to_msrp");
  }

  const priceResolved = looksLikePrice(price) && !looksLikeSuspiciousRetailPrice(price);
  const mileageResolved = looksLikeMileage(mileage);
  const displayPriceText = priceResolved ? `$${Number(price).toLocaleString()}` : "Price needs review";
  const displayMileageText = mileageResolved ? `${Number(mileage).toLocaleString()} km` : "Mileage pending";

  return {
    price: priceResolved ? price : 0,
    mileage: mileageResolved ? mileage : 0,
    raw_price: safeNumber(rawPrice.value, 0),
    raw_mileage: safeNumber(rawMileage.value, 0),
    price_source: priceSource,
    mileage_source: mileageSource,
    price_warning: Array.from(new Set(warnings)).join("|"),
    price_resolved: priceResolved,
    mileage_resolved: mileageResolved,
    display_price_text: displayPriceText,
    display_mileage_text: displayMileageText,
    price_review_required: !priceResolved || warnings.some((warning) => /price_|duplicate|suspicious/i.test(warning))
  };
}
