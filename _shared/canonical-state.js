function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

export const CANONICAL_PROFILE_TABLE = "profiles";
export const CANONICAL_LISTINGS_TABLE = "user_listings";
export const LEGACY_PROFILE_TABLES = ["user_profiles"];
export const LEGACY_LISTINGS_TABLES = ["listings"];

export function canonicalIdentityMeta({ verifiedUser = null, trustedIdentity = null, requestedId = "", requestedEmail = "" } = {}) {
  const verifiedId = clean(verifiedUser?.id || trustedIdentity?.id || "");
  const verifiedEmail = normalizeEmail(verifiedUser?.email || trustedIdentity?.email || "");
  const explicitId = clean(requestedId || "");
  const explicitEmail = normalizeEmail(requestedEmail || "");

  if (verifiedId) {
    return {
      id: verifiedId,
      email: verifiedEmail,
      identity_source: "verified_auth_uid",
      matched_by: "id",
    };
  }

  if (explicitId) {
    return {
      id: explicitId,
      email: verifiedEmail || explicitEmail,
      identity_source: "requested_id",
      matched_by: "id",
    };
  }

  if (verifiedEmail || explicitEmail) {
    return {
      id: "",
      email: verifiedEmail || explicitEmail,
      identity_source: verifiedEmail ? "verified_email" : "requested_email",
      matched_by: "email",
    };
  }

  return {
    id: "",
    email: "",
    identity_source: "missing",
    matched_by: "none",
  };
}

export function buildCanonicalProfileSnapshot(user = {}, profile = {}) {
  const fullName = clean(profile.full_name || user.full_name || `${clean(user.first_name)} ${clean(user.last_name)}`.trim());
  const dealership = clean(profile.dealership || profile.dealer_name || user.company || "");
  const province = clean(profile.province || user.province || "").toUpperCase();

  return {
    id: clean(profile.id || user.id || ""),
    email: normalizeEmail(profile.email || user.email || ""),
    full_name: fullName,
    phone: clean(profile.phone || user.phone || ""),
    dealership,
    city: clean(profile.city || ""),
    province,
    dealer_phone: clean(profile.dealer_phone || ""),
    dealer_email: normalizeEmail(profile.dealer_email || profile.email || user.email || ""),
    dealer_website: clean(profile.dealer_website || profile.dealership_website || ""),
    inventory_url: clean(profile.inventory_url || ""),
    scanner_type: clean(profile.scanner_type || ""),
    listing_location: clean(profile.listing_location || profile.city || ""),
    license_number: clean(profile.license_number || ""),
    compliance_mode: clean(profile.compliance_mode || province || ""),
    booking_link: clean(profile.booking_link || ""),
    instagram_handle: clean(profile.instagram_handle || ""),
    primary_cta: clean(profile.primary_cta || ""),
    default_seller_name: clean(profile.default_seller_name || fullName),
    trades_welcome: profile.trades_welcome ?? true,
    financing_cta: profile.financing_cta ?? true,
    delivery_available: profile.delivery_available ?? false,
    carfax_mention: profile.carfax_mention ?? true,
    active_disclaimer: clean(profile.active_disclaimer || ""),
    logo_url: clean(profile.logo_url || ""),
    canonical_table: CANONICAL_PROFILE_TABLE,
  };
}

export function profileSetupFields(snapshot = {}) {
  return {
    salesperson_name_present: Boolean(clean(snapshot.full_name || snapshot.default_seller_name || "")),
    dealership_name_present: Boolean(clean(snapshot.dealership || "")),
    inventory_url_present: Boolean(clean(snapshot.inventory_url || "")),
    compliance_mode_present: Boolean(clean(snapshot.compliance_mode || "")),
    dealer_website_present: Boolean(clean(snapshot.dealer_website || "")),
    scanner_type_present: Boolean(clean(snapshot.scanner_type || "")),
    listing_location_present: Boolean(clean(snapshot.listing_location || "")),
  };
}

export function canonicalListingIdentity(row = {}) {
  const marketplace = clean(row.marketplace_listing_id || "").toUpperCase();
  if (marketplace) return `MARKETPLACE:${marketplace}`;
  const vin = clean(row.vin || "").toUpperCase();
  if (vin) return `VIN:${vin}`;
  const stock = clean(row.stock_number || "").toUpperCase();
  if (stock) return `STOCK:${stock}`;
  const source = clean(row.source_url || "").toLowerCase();
  if (source) return `URL:${source}`;
  return clean(row.id || "");
}

export function canonicalListingMeta() {
  return {
    canonical_table: CANONICAL_LISTINGS_TABLE,
    legacy_tables: [...LEGACY_LISTINGS_TABLES],
  };
}
