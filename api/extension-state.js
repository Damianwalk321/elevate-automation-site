

import { createClient } from "@supabase/supabase-js";
import { resolveAccountAccess } from "./_shared/account-access.js";
import { getVerifiedRequestUser } from "./_shared/auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_MINIMUM_VERSION = process.env.EXTENSION_MINIMUM_VERSION || "7.6.0";
const DEFAULT_LATEST_VERSION = process.env.EXTENSION_LATEST_VERSION || DEFAULT_MINIMUM_VERSION;
const TEST_LIMIT_25_EMAILS = new Set(['damian044@icloud.com']);
const BUSINESS_TIMEZONE = "America/Edmonton";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function zonedDateParts(value = new Date(), timeZone = BUSINESS_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: map.year || "0000", month: map.month || "00", day: map.day || "00" };
}

function businessDayKey(value = new Date()) {
  const { year, month, day } = zonedDateParts(value);
  return `${year}-${month}-${day}`;
}

function safeHostname(input) {
  try {
    return new URL(input).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return clean(input)
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .toLowerCase();
  }
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value !== undefined && value !== null && typeof value !== "string") return value;
  }
  return "";
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizePlanLabel(value) {
  const raw = clean(value).toLowerCase();
  if (!raw || raw === "no plan") return "Founder Beta";
  if (raw.includes("founder") && raw.includes("pro")) return "Founder Pro";
  if (raw.includes("founder") && raw.includes("starter")) return "Founder Beta";
  if (raw.includes("founder") || raw.includes("beta")) return "Founder Beta";
  if (raw.includes("pro")) return "Pro";
  if (raw.includes("starter")) return "Starter";
  return clean(value) || "Founder Beta";
}

function inferPostingLimitFromPlan(value) {
  const raw = normalizePlanLabel(value).toLowerCase();
  if ((raw.includes("founder") && raw.includes("pro")) || raw === "pro" || (!raw.includes("founder") && raw.includes("pro"))) return 25;
  return 5;
}

function hasTestingLimitOverride(email) {
  return TEST_LIMIT_25_EMAILS.has(normalizeEmail(email));
}

function normalizeStatusValue(value, fallback = "inactive") {
  const status = clean(value).toLowerCase();
  if (!status) return fallback;
  if (["active", "trialing", "paid", "checkout_pending"].includes(status)) return "active";
  if (["canceled", "cancelled", "unpaid", "past_due", "expired", "suspended", "inactive"].includes(status)) return "inactive";
  return status;
}


function normalizeProvince(value) {
  const raw = clean(value).toUpperCase();
  if (!raw) return "";
  if (raw === "ALBERTA" || raw.startsWith("AB")) return "AB";
  if (raw === "BRITISH COLUMBIA" || raw.startsWith("BC")) return "BC";
  return raw;
}

function normalizeComplianceMode(value, province = "") {
  const raw = clean(value).toUpperCase();
  if (!raw || raw === "STRICT") return normalizeProvince(province);
  if (raw === "ALBERTA" || raw.startsWith("AB")) return "AB";
  if (raw === "BRITISH COLUMBIA" || raw.startsWith("BC")) return "BC";
  return raw;
}

function buildComplianceState(profile = {}, dealership = {}) {
  const province = normalizeProvince(profile?.province || dealership?.province || profile?.compliance_mode || '');
  const complianceMode = normalizeComplianceMode(profile?.compliance_mode || '', province);
  const dealershipName = clean(dealership?.name || profile?.dealership || '');
  const licenseNumber = clean(profile?.license_number || '');
  const dealerContact = clean(profile?.dealer_phone || profile?.phone || '');
  const blockers = [
    (!province && !complianceMode) ? 'Province or compliance mode missing' : '',
    !licenseNumber ? 'License number missing' : '',
    !dealershipName ? 'Dealership name missing' : '',
    !dealerContact ? 'Dealer or salesperson phone missing' : ''
  ].filter(Boolean);
  return {
    ready: blockers.length === 0,
    province,
    compliance_mode: complianceMode,
    license_number: licenseNumber,
    dealer_contact: dealerContact,
    blockers
  };
}

function isActiveStatus(value) {
  return normalizeStatusValue(value) === "active";
}

function dealershipMatchesHostname(dealership, hostname) {
  if (!dealership || !hostname) return false;

  const websiteHost = safeHostname(dealership.website || "");
  const inventoryHost = safeHostname(dealership.inventory_url || "");

  return (
    (websiteHost &&
      (hostname === websiteHost ||
        hostname.endsWith(`.${websiteHost}`) ||
        websiteHost.endsWith(`.${hostname}`))) ||
    (inventoryHost &&
      (hostname === inventoryHost ||
        hostname.endsWith(`.${inventoryHost}`) ||
        inventoryHost.endsWith(`.${hostname}`)))
  );
}

async function getTodayListingPostedCount(supabase, userId, email) {
  const dayKey = businessDayKey();
  const finalEmail = normalizeEmail(email);
  const finalUserId = clean(userId);

  async function fetchRows(tableName) {
    const rows = [];
    const seen = new Set();

    async function runQuery(mode) {
      let query = supabase.from(tableName).select('id,posted_at,created_at,email,user_id');
      if (mode === 'user' && finalUserId) query = query.eq('user_id', finalUserId);
      if (mode === 'email' && finalEmail) query = query.ilike('email', finalEmail);
      const { data, error } = await query;
      if (error) return;
      for (const row of Array.isArray(data) ? data : []) {
        const key = clean(row?.id || '') || `${clean(row?.email || '')}|${clean(row?.posted_at || row?.created_at || '')}`;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
      }
    }

    if (finalUserId) await runQuery('user');
    if (finalEmail) await runQuery('email');
    return rows;
  }

  const [userRows, legacyRows] = await Promise.all([fetchRows('user_listings'), fetchRows('listings')]);
  const seen = new Set();
  let count = 0;
  for (const row of [...userRows, ...legacyRows]) {
    const key = clean(row?.id || '') || `${clean(row?.posted_at || row?.created_at || '')}`;
    if (!key || seen.has(key)) continue;
    const postedAt = row?.posted_at || row?.created_at;
    if (businessDayKey(postedAt) !== dayKey) continue;
    seen.add(key);
    count += 1;
  }
  return count;
}

function buildProfilePayload(user, userProfileRow, legacyProfileRow, dealership) {
  const source = userProfileRow || legacyProfileRow || {};

  const city = clean(
    source?.city ||
      dealership?.city ||
      ""
  );

  const province = clean(
    source?.province ||
      source?.compliance_mode ||
      dealership?.province ||
      ""
  );

  return {
    id: clean(source?.id || ""),
    email: normalizeEmail(
      source?.email ||
        user?.email ||
        ""
    ),
    full_name: clean(
      source?.full_name ||
        source?.salesperson_name ||
        user?.full_name ||
        ""
    ),
    phone: clean(
      source?.phone ||
        user?.phone ||
        ""
    ),
    license_number: clean(source?.license_number || ""),
    listing_location: clean(
      source?.listing_location ||
        source?.location ||
        (city && province ? `${city}, ${province}` : city)
    ),
    dealer_phone: clean(source?.dealer_phone || ""),
    dealer_email: clean(
      source?.dealer_email ||
        user?.email ||
        ""
    ),
    compliance_mode: clean(
      source?.compliance_mode ||
        province ||
        ""
    ),
    city,
    province
  };
}

function buildSubscriptionPayload(
  subscriptionRow,
  postingLimitRow,
  postingUsageRow,
  licenseRow,
  licenseKeyRow,
  legacyProfileRow
) {
  const rawPlan = firstNonEmpty(
    subscriptionRow?.plan_type,
    subscriptionRow?.plan_name,
    subscriptionRow?.plan,
    licenseRow?.plan,
    licenseKeyRow?.plan,
    ""
  );

  const rawStatus = firstNonEmpty(
    subscriptionRow?.status,
    subscriptionRow?.subscription_status,
    subscriptionRow?.billing_status,
    licenseRow?.status,
    licenseKeyRow?.status,
    ""
  );

  const configuredPostingLimit = Number(
    firstNonEmpty(
      postingLimitRow?.daily_limit,
      postingLimitRow?.posting_limit,
      subscriptionRow?.daily_posting_limit,
      subscriptionRow?.posting_limit,
      subscriptionRow?.account_snapshot?.posting_limit,
      0
    )
  ) || 0;

  const postsToday = Number(
    firstNonEmpty(
      postingUsageRow?.posts_today,
      postingUsageRow?.posts_used,
      postingUsageRow?.used_today,
      subscriptionRow?.account_snapshot?.posts_today,
      0
    )
  ) || 0;

  const licenseKey = clean(
    firstNonEmpty(
      licenseKeyRow?.license_key,
      licenseRow?.license_key,
      subscriptionRow?.license_key,
      ""
    )
  );

  const explicitPositive =
    normalizeBoolean(subscriptionRow?.active) ||
    normalizeBoolean(subscriptionRow?.access) ||
    normalizeBoolean(subscriptionRow?.access_active) ||
    normalizeBoolean(subscriptionRow?.is_active) ||
    normalizeBoolean(subscriptionRow?.account_snapshot?.active) ||
    normalizeBoolean(licenseRow?.active) ||
    normalizeBoolean(licenseRow?.access) ||
    normalizeBoolean(licenseKeyRow?.active) ||
    normalizeBoolean(licenseKeyRow?.assigned);

  const explicitNegative = ["canceled", "cancelled", "unpaid", "past_due", "expired", "suspended", "inactive"].includes(clean(rawStatus).toLowerCase());
  const hasProfileSetup = Boolean(
    legacyProfileRow?.dealer_website ||
      legacyProfileRow?.inventory_url ||
      legacyProfileRow?.dealership
  );
  const bridgeEligible = normalizeBoolean(subscriptionRow?.bridge_access) || normalizeBoolean(legacyProfileRow?.bridge_access);
  const bridgeActive = !explicitNegative && bridgeEligible && hasProfileSetup;
  const access = resolveAccountAccess({
    email: subscriptionRow?.email || licenseRow?.email || licenseKeyRow?.email || '',
    rawPlan,
    rawStatus,
    explicitPostingLimit: configuredPostingLimit,
    explicitPostsToday: postsToday,
    explicitActiveFlags: [explicitPositive, bridgeActive],
    explicitInactiveFlags: [explicitNegative],
    explicitAccessGranted: normalizeBoolean(subscriptionRow?.account_snapshot?.access_granted)
  });
  const billingSource = subscriptionRow ? "subscriptions" : (licenseRow || licenseKeyRow ? "license" : "bridge");

  return {
    id: clean(subscriptionRow?.id || ""),
    plan: access.plan,
    normalized_plan: access.normalized_plan,
    status: access.status,
    normalized_status: access.normalized_status,
    active: access.active,
    access_granted: access.access_granted,
    posting_limit: access.posting_limit,
    daily_posting_limit: access.daily_posting_limit,
    posts_today: access.posts_today,
    posts_remaining: access.posts_remaining,
    billing: access.billing,
    can_post: access.can_post,
    current_period_end: clean(subscriptionRow?.current_period_end || ""),
    trial_end: clean(subscriptionRow?.trial_end || ""),
    cancel_at_period_end: normalizeBoolean(subscriptionRow?.cancel_at_period_end),
    billing_source: billingSource,
    license_key: licenseKey,
    testing_limit_override: Boolean(access.testing_limit_override)
  };
}

function buildScannerConfigPayload(scannerConfig, dealership, legacyProfile) {
  const legacyScanner = clean(
    legacyProfile?.scanner_type ||
      legacyProfile?.dealer_scanner_type ||
      dealership?.scanner_type ||
      "generic"
  );

  return {
    id: clean(scannerConfig?.id || ""),
    scanner_type: clean(
      scannerConfig?.scanner_type ||
        legacyScanner ||
        "generic"
    ),
    card_selectors: Array.isArray(scannerConfig?.card_selectors) ? scannerConfig.card_selectors : [],
    title_selectors: Array.isArray(scannerConfig?.title_selectors) ? scannerConfig.title_selectors : [],
    price_selectors: Array.isArray(scannerConfig?.price_selectors) ? scannerConfig.price_selectors : [],
    mileage_selectors: Array.isArray(scannerConfig?.mileage_selectors) ? scannerConfig.mileage_selectors : [],
    image_selectors: Array.isArray(scannerConfig?.image_selectors) ? scannerConfig.image_selectors : [],
    link_selectors: Array.isArray(scannerConfig?.link_selectors) ? scannerConfig.link_selectors : [],
    stock_selectors: Array.isArray(scannerConfig?.stock_selectors) ? scannerConfig.stock_selectors : [],
    vin_selectors: Array.isArray(scannerConfig?.vin_selectors) ? scannerConfig.vin_selectors : [],
    field_map: scannerConfig?.field_map || {},
    pagination_rules: scannerConfig?.pagination_rules || {}
  };
}

function buildFallbackOrganization(user, legacyProfile) {
  return {
    id: `solo-${user.id}`,
    name: clean(
      legacyProfile?.dealership ||
        legacyProfile?.dealer_name ||
        legacyProfile?.company_name ||
        user?.full_name ||
        user?.email ||
        "Solo Account"
    ),
    owner_user_id: user.id,
    membership_role: "owner"
  };
}

function buildFallbackDealership(user, legacyProfile) {
  const website = clean(
    legacyProfile?.dealer_website ||
      legacyProfile?.dealer_site ||
      legacyProfile?.website ||
      ""
  );

  const inventoryUrl = clean(
    legacyProfile?.inventory_url ||
      legacyProfile?.inventoryUrl ||
      ""
  );

  return {
    id: website ? `dealer-${safeHostname(website)}` : `dealer-${user.id}`,
    organization_id: `solo-${user.id}`,
    name: clean(
      legacyProfile?.dealership ||
        legacyProfile?.dealer_name ||
        "Primary Dealership"
    ),
    website,
    inventory_url: inventoryUrl,
    province: clean(
      legacyProfile?.province ||
        legacyProfile?.compliance_mode ||
        ""
    ),
    city: clean(legacyProfile?.city || ""),
    timezone: "America/Edmonton",
    scanner_type: clean(
      legacyProfile?.scanner_type ||
        legacyProfile?.dealer_scanner_type ||
        "generic"
    ),
    active: true
  };
}


function compareVersions(a, b) {
  const pa = String(a || "0.0.0").split(".").map((x) => Number(x) || 0);
  const pb = String(b || "0.0.0").split(".").map((x) => Number(x) || 0);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i += 1) {
    const av = pa[i] || 0;
    const bv = pb[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }

  return 0;
}

function buildAllowedDealerHosts(dealership) {
  const hosts = [safeHostname(dealership?.website || ""), safeHostname(dealership?.inventory_url || "")].filter(Boolean);
  return Array.from(new Set(hosts));
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ ok: false, error: "Missing Supabase env" });
    }

    const email = normalizeEmail(req.query?.email || "");
    const hostname = safeHostname(req.query?.hostname || "");
    const pageUrl = clean(req.query?.pageUrl || "");
    const clientVersion = clean(req.query?.clientVersion || "");

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Missing email"
      });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    if (userError) {
      return res.status(500).json({
        ok: false,
        error: `Users lookup failed: ${userError.message}`
      });
    }

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "User not found"
      });
    }

    const [
      membershipsResult,
      legacyProfileResult,
      subscriptionResult,
      postingUsageResult,
      licenseResult,
      licenseKeyResult
    ] = await Promise.all([
      supabase
        .from("organization_members")
        .select(`
          *,
          organizations (*),
          dealerships (*)
        `)
        .eq("user_id", user.id),
      supabase
        .from("profiles")
        .select("*")
        .or(`id.eq.${user.id},user_id.eq.${user.id},email.eq.${email}`)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("*")
        .or(`user_id.eq.${user.id},email.eq.${email}`)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("posting_usage")
        .select("*")
        .or(`user_id.eq.${user.id},email.eq.${email}`)
        .eq("date_key", businessDayKey())
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("licenses")
        .select("*")
        .or(`user_id.eq.${user.id},email.eq.${email}`)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("license_keys")
        .select("*")
        .or(`user_id.eq.${user.id},email.eq.${email}`)
        .limit(1)
        .maybeSingle()
    ]);

    if (membershipsResult.error) {
      return res.status(500).json({
        ok: false,
        error: `Organization memberships lookup failed: ${membershipsResult.error.message}`
      });
    }

    const legacyProfile = legacyProfileResult.data || null;
    const userProfile = userProfileResult.data || null;
    const subscriptionRow = subscriptionResult.data || null;
    const postingUsageRow = postingUsageResult.data || null;
    const licenseRow = licenseResult.data || null;
    const licenseKeyRow = licenseKeyResult.data || null;

    const normalizedPlanType = clean(
      firstNonEmpty(
        subscriptionRow?.plan_type,
        subscriptionRow?.plan_name,
        subscriptionRow?.plan,
        licenseRow?.plan,
        licenseKeyRow?.plan,
        ""
      )
    );

    let postingLimitRow = null;
    if (normalizedPlanType) {
      const { data: postingLimitRows } = await supabase
        .from("posting_limits")
        .select("*")
        .ilike("plan_type", normalizedPlanType);
      const configRows = Array.isArray(postingLimitRows) ? postingLimitRows.filter((row) => clean(row?.plan_type) && !clean(row?.email) && !clean(row?.user_id)) : [];
      postingLimitRow = configRows[0] || null;
    }

    const membershipList = Array.isArray(membershipsResult.data) ? membershipsResult.data : [];

    let selectedMembership =
      membershipList.find((m) => dealershipMatchesHostname(m?.dealerships, hostname)) ||
      membershipList.find((m) => m?.is_primary) ||
      membershipList[0] ||
      null;

    let organization = selectedMembership?.organizations || null;
    let dealership = selectedMembership?.dealerships || null;

    if (!organization) {
      const { data: ownedOrganization } = await supabase
        .from("organizations")
        .select("*")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (ownedOrganization) {
        organization = ownedOrganization;

        const { data: ownedDealerships } = await supabase
          .from("dealerships")
          .select("*")
          .eq("organization_id", ownedOrganization.id)
          .eq("active", true);

        const ownedList = Array.isArray(ownedDealerships) ? ownedDealerships : [];
        dealership =
          ownedList.find((d) => dealershipMatchesHostname(d, hostname)) ||
          ownedList[0] ||
          null;
      }
    }

    if (!organization) {
      organization = buildFallbackOrganization(user, legacyProfile || {});
    }

    if (!dealership) {
      dealership = buildFallbackDealership(user, legacyProfile || {});
    }

    let scannerConfig = null;
    if (dealership?.id && !String(dealership.id).startsWith("dealer-")) {
      const { data } = await supabase
        .from("scanner_configs")
        .select("*")
        .eq("dealership_id", dealership.id)
        .eq("active", true)
        .maybeSingle();

      scannerConfig = data || null;
    }

    const profile = buildProfilePayload(user, userProfile, legacyProfile, dealership || {});
    const compliance = buildComplianceState(profile, dealership || {});
    const subscription = buildSubscriptionPayload(
      subscriptionRow,
      postingLimitRow,
      postingUsageRow,
      licenseRow,
      licenseKeyRow,
      legacyProfile
    );

    const listingUsageToday = await getTodayListingPostedCount(supabase, user.id, email);
    subscription.posts_today = Math.max(Number(subscription.posts_today || 0), Number(listingUsageToday || 0));
    const subscriptionAccess = resolveAccountAccess({
      email,
      rawPlan: subscription.plan,
      rawStatus: subscription.status,
      explicitPostingLimit: subscription.posting_limit || subscription.daily_posting_limit || 0,
      explicitPostsToday: subscription.posts_today,
      explicitActiveFlags: [subscription.active],
      explicitAccessGranted: subscription.access_granted === true
    });
    Object.assign(subscription, subscriptionAccess, { billing: subscriptionAccess.billing, can_post: subscriptionAccess.can_post });
    const scannerConfigPayload = buildScannerConfigPayload(scannerConfig, dealership || {}, legacyProfile || {});
    const allowedDealerHosts = buildAllowedDealerHosts(dealership || {});
    const minimumVersion = DEFAULT_MINIMUM_VERSION;
    const latestVersion = DEFAULT_LATEST_VERSION;
    const updateRequired = clientVersion ? compareVersions(clientVersion, minimumVersion) < 0 : false;
    const setupReady = Boolean(
      clean(profile?.full_name || "") &&
      clean(
        dealership?.inventory_url ||
          legacyProfile?.inventory_url ||
          userProfile?.inventory_url ||
          ""
      )
    );
    const hardNegativeStatuses = ["canceled", "cancelled", "unpaid", "past_due", "expired", "suspended"];
    const normalizedSubscriptionStatus = clean(subscription?.status || "").toLowerCase();

    if (!subscription.active && setupReady && !hardNegativeStatuses.includes(normalizedSubscriptionStatus)) {
      const bridgedAccess = resolveAccountAccess({
        email,
        rawPlan: subscription.plan || "Founder Beta",
        rawStatus: subscription.status || 'active',
        explicitPostingLimit: subscription.posting_limit || subscription.daily_posting_limit || 0,
        explicitPostsToday: subscription.posts_today || 0,
        explicitActiveFlags: [true],
        allowSetupBridge: true
      });
      Object.assign(subscription, bridgedAccess, { billing: bridgedAccess.billing, can_post: bridgedAccess.can_post });
    }

    subscription.minimum_version = minimumVersion;
    subscription.latest_version = latestVersion;
    subscription.update_required = updateRequired;
    subscription.allowed_dealer_hosts = allowedDealerHosts;
    subscription.access_granted = Boolean(subscription.active);
    subscription.can_post = Boolean(subscription.can_post && compliance.ready);

    const session = {
      user: {
        id: user.id,
        email: normalizeEmail(user.email || ""),
        full_name: clean(user.full_name || ""),
        phone: clean(user.phone || ""),
        active: user.active !== false
      },
      organization: {
        id: clean(organization.id || ""),
        name: clean(organization.name || ""),
        owner_user_id: clean(organization.owner_user_id || user.id),
        membership_role: clean(selectedMembership?.role || organization.membership_role || "owner")
      },
      dealership: {
        id: clean(dealership.id || ""),
        organization_id: clean(dealership.organization_id || organization.id),
        name: clean(dealership.name || ""),
        website: clean(dealership.website || ""),
        inventory_url: clean(dealership.inventory_url || ""),
        province: clean(dealership.province || ""),
        city: clean(dealership.city || ""),
        timezone: clean(dealership.timezone || "America/Edmonton"),
        scanner_type: clean(dealership.scanner_type || scannerConfigPayload.scanner_type || "generic"),
        active: dealership.active !== false
      },
      profile,
      compliance,
      subscription: { ...(subscription || {}), plan_access: { is_pro: Boolean(subscription?.posting_limit >= 25 || String(subscription?.plan || subscription?.plan_name || "").toLowerCase().includes("pro")), posting_limit: Number(subscription?.posting_limit || 0), plan_label: clean(subscription?.plan || subscription?.plan_name || "Founder Beta") || "Founder Beta" } },
      scanner_config: scannerConfigPayload,
      meta: {
        requested_hostname: hostname,
        requested_page_url: pageUrl,
        mode: membershipList.length ? "multi_tenant" : "solo_bridge",
        setup_ready: setupReady,
        compliance_ready: compliance.ready,
        posting_blockers: compliance.ready ? [] : compliance.blockers,
        billing_active: Boolean(subscription?.active),
        minimum_version: minimumVersion,
        latest_version: latestVersion,
        update_required: updateRequired,
        allowed_dealer_hosts: allowedDealerHosts
      },
      minimum_version: minimumVersion,
      latest_version: latestVersion,
      update_required: updateRequired
    };

    return res.status(200).json({
      ok: true,
      session
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Internal server error"
    });
  }
}
