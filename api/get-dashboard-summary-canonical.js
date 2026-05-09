import legacySummaryHandler from "./get-dashboard-summary.js";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function n(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeProfileSnapshot(profile = {}, account = {}) {
  return {
    ...profile,
    full_name: clean(profile.full_name || account.full_name || account.salesperson_name || ""),
    dealership: clean(profile.dealership || account.dealership || account.dealer_name || ""),
    inventory_url: clean(profile.inventory_url || account.inventory_url || ""),
    dealer_website: clean(profile.dealer_website || account.dealer_website || ""),
    scanner_type: clean(profile.scanner_type || account.scanner_type || ""),
    listing_location: clean(profile.listing_location || account.listing_location || ""),
    compliance_mode: clean(profile.compliance_mode || account.compliance_mode || ""),
  };
}

function buildSetupStatus(profile = {}, setup = {}) {
  return {
    ...setup,
    salesperson_name_present: Boolean(clean(setup.salesperson_name_present ? "1" : profile.full_name)),
    dealership_name_present: Boolean(clean(setup.dealership_name_present ? "1" : profile.dealership)),
    inventory_url_present: Boolean(clean(setup.inventory_url_present ? "1" : profile.inventory_url)),
    compliance_mode_present: Boolean(clean(setup.compliance_mode_present ? "1" : profile.compliance_mode)),
    dealer_website_present: Boolean(clean(setup.dealer_website_present ? "1" : profile.dealer_website)),
    scanner_type_present: Boolean(clean(setup.scanner_type_present ? "1" : profile.scanner_type)),
    listing_location_present: Boolean(clean(setup.listing_location_present ? "1" : profile.listing_location)),
  };
}

async function runLegacy(req) {
  let statusCode = 200;
  let payload = null;

  const mockRes = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      payload = body;
      return this;
    }
  };

  await legacySummaryHandler(req, mockRes);
  return { statusCode, payload, headers: mockRes.headers || {} };
}

export default async function handler(req, res) {
  const legacy = await runLegacy(req);
  Object.entries(legacy.headers || {}).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader("Content-Type", "application/json");

  if (legacy.statusCode >= 400 || !legacy.payload?.data) {
    return res.status(legacy.statusCode || 500).json(legacy.payload || { error: "Legacy summary failed" });
  }

  const source = legacy.payload.data || {};
  const account = source.account_snapshot || {};
  const planAccess = source.plan_access || {};
  const rawProfile = source.profile_snapshot || {};
  const profile = normalizeProfileSnapshot(rawProfile, account);
  const setup = buildSetupStatus(profile, source.setup_status || {});

  return res.status(200).json({
    success: true,
    data: {
      identity_source: clean(source.identity_source || "legacy_wrapped"),
      matched_by: clean(source.matched_by || "legacy_wrapped"),
      canonical_profile_table: clean(source.canonical_profile_table || "profiles"),
      canonical_listings_table: clean(source.canonical_listings_table || "user_listings"),
      legacy_listings_tables: Array.isArray(source.legacy_listings_tables) ? source.legacy_listings_tables : ["listings"],
      posts_today: n(source.posts_today, 0),
      posts_remaining: n(source.posts_remaining, 0),
      daily_limit: n(source.daily_limit, n(planAccess.posting_limit, 5)),
      effective_posting_limit: n(source.effective_posting_limit, n(planAccess.posting_limit, 5)),
      can_post: Boolean(source.can_post),
      account_snapshot: {
        ...account,
        canonical_source: "api/get-dashboard-summary-canonical",
        snapshot_cache_only: true,
        inventory_url: profile.inventory_url,
        dealer_website: profile.dealer_website,
        scanner_type: profile.scanner_type,
        listing_location: profile.listing_location,
        compliance_mode: profile.compliance_mode,
      },
      profile_snapshot: profile,
      setup_status: setup,
      plan_access: {
        ...planAccess,
        plan_label: clean(planAccess.plan_label || account.plan || "Founder Beta"),
        posting_limit: n(planAccess.posting_limit, source.effective_posting_limit || source.daily_limit || 5),
        posts_today: n(planAccess.posts_today, source.posts_today || 0),
        posts_remaining: n(planAccess.posts_remaining, source.posts_remaining || 0),
        active: Boolean(planAccess.active ?? account.active),
        access_granted: Boolean(planAccess.access_granted ?? account.access_granted),
        can_post: Boolean(planAccess.can_post ?? source.can_post),
      }
    }
  });
}
