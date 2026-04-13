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

function scorePriceKey(key = "") {
  const k = clean(key).toLowerCase();
  if (!k) return 0;
  let score = 0;
  if (/^(price|list_price|sale_price|asking_price|vehicle_price|internet_price|our_price|advertised_price|current_price|final_price|selling_price|msrp)$/.test(k)) score += 100;
  if (/price|msrp|sale|internet|asking|selling|advertised|cash/.test(k)) score += 25;
  if (/mileage|kilometers|km|odometer|distance/.test(k)) score -= 100;
  return score;
}

function collectNumericCandidates(row = {}) {
  return Object.entries(row)
    .map(([key, value]) => ({ key, value: safeNumber(value, 0), score: scorePriceKey(key) }))
    .filter((item) => item.value > 0);
}

function pickBestAlternatePrice(row = {}, excludeKeys = [], mileageValue = 0) {
  const excluded = new Set(excludeKeys.map((key) => clean(key).toLowerCase()));
  const candidates = collectNumericCandidates(row)
    .filter((item) => !excluded.has(clean(item.key).toLowerCase()))
    .filter((item) => looksLikePrice(item.value))
    .filter((item) => !mileageValue || item.value !== mileageValue)
    .sort((a, b) => (b.score - a.score) || (b.value - a.value));

  return candidates[0] || null;
}

export function extractCanonicalPriceMileage(row = {}) {
  const priceKeys = [
    "price", "list_price", "sale_price", "asking_price", "vehicle_price", "internet_price",
    "our_price", "advertised_price", "current_price", "final_price", "selling_price", "msrp",
    "display_price", "price_value", "price_amount", "dealer_price", "cash_price"
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

  if (price && mileage && price === mileage) {
    warnings.push("price_equals_mileage");
  }

  if (price && !looksLikePrice(price) && looksLikeMileage(price)) {
    warnings.push("price_looked_like_mileage");
    const alt = pickBestAlternatePrice(row, [rawPrice.key, ...mileageKeys], mileage);
    if (alt) {
      price = alt.value;
      priceSource = alt.key;
      warnings.push("price_recovered_from_alt_field");
    }
  }

  if ((!price || !looksLikePrice(price)) && looksLikePrice(safeNumber(row.msrp, 0))) {
    price = safeNumber(row.msrp, 0);
    priceSource = "msrp";
    warnings.push("price_defaulted_to_msrp");
  }

  if ((!mileage || !looksLikeMileage(mileage)) && looksLikeMileage(safeNumber(row.odometer, 0))) {
    mileage = safeNumber(row.odometer, 0);
    mileageSource = "odometer";
    warnings.push("mileage_defaulted_to_odometer");
  }

  if (price && mileage && price === mileage) {
    const alt = pickBestAlternatePrice(row, [priceSource, ...mileageKeys], mileage);
    if (alt) {
      price = alt.value;
      priceSource = alt.key;
      warnings.push("price_recovered_after_duplicate_match");
    } else {
      price = 0;
      warnings.push("price_unresolved_due_to_duplicate_mileage");
    }
  }

  if (price && !looksLikePrice(price)) {
    const alt = pickBestAlternatePrice(row, [priceSource, ...mileageKeys], mileage);
    if (alt) {
      price = alt.value;
      priceSource = alt.key;
      warnings.push("price_recovered_after_invalid_range");
    } else {
      price = 0;
      warnings.push("price_unresolved_invalid_range");
    }
  }

  if (!price) {
    warnings.push("price_unresolved_missing");
  }

  return {
    price,
    mileage,
    raw_price: safeNumber(rawPrice.value, 0),
    raw_mileage: safeNumber(rawMileage.value, 0),
    price_source: priceSource,
    mileage_source: mileageSource,
    price_warning: warnings.join("|")
  };
}
