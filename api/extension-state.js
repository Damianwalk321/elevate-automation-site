import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  return false;
}

function isActiveStatus(value) {
  const status = clean(value).toLowerCase();
  return ["active", "trialing", "paid", "founder", "beta"].includes(status);
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

function buildSubscriptionPayload(subscriptionRow, postingLimitRow, postingUsageRow, licenseRow, licenseKeyRow) {
  const rawStatus = firstNonEmpty(
    subscriptionRow?.status,
    subscriptionRow?.subscription_status,
    licenseRow?.status,
    licenseKeyRow?.status,
    "inactive"
  );

  const active =
    normalizeBoolean(subscriptionRow?.active) ||
    normalizeBoolean(subscriptionRow?.access_active) ||
    normalizeBoolean(licenseRow?.active) ||
    normalizeBoolean(licenseKeyRow?.active) ||
    isActiveStatus(rawStatus);

  const postingLimit = Number(
    firstNonEmpty(
      postingLimitRow?.daily_limit,
      postingLimitRow?.posting_limit,
      subscriptionRow?.posting_limit,
      subscriptionRow?.daily_posting_limit,
      25
    )
  ) || 25;

  const postsToday = Number(
    firstNonEmpty(
      postingUsageRow?.posts_today,
      postingUsageRow?.used_today,
      0
    )
  ) || 0;

  const postsRemaining = Math.max(postingLimit - postsToday, 0);

  return {
    id: clean(subscriptionRow?.id || ""),
    plan: clean(
      firstNonEmpty(
        subscriptionRow?.plan,
        subscriptionRow?.plan_name,
        licenseRow?.plan,
        "Founder Beta"
      )
    ),
    status: active ? "active" : clean(rawStatus || "inactive").toLowerCase(),
    active,
    posting_limit: postingLimit,
    posts_today: postsToday,
    posts_remaining: postsRemaining,
    stripe_customer_id: clean(subscriptionRow?.stripe_customer_id || ""),
    stripe_subscription_id: clean(subscriptionRow?.stripe_subscription_id || ""),
    license_key: clean(
      firstNonEmpty(
        licenseKeyRow?.license_key,
        licenseRow?.license_key,
        subscriptionRow?.license_key,
        ""
      )
    )
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
    const email = normalizeEmail(req.query?.email || "");
    const hostname = safeHostname(req.query?.hostname || "");
    const pageUrl = clean(req.query?.pageUrl || "");

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Missing email"
      });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
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
      userProfileResult,
      subscriptionResult,
      postingLimitResult,
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
        .eq("email", email)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("*")
        .or(`user_id.eq.${user.id},email.eq.${email}`)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("posting_limits")
        .select("*")
        .or(`user_id.eq.${user.id},email.eq.${email}`)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("posting_usage")
        .select("*")
        .or(`user_id.eq.${user.id},email.eq.${email}`)
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
    const postingLimitRow = postingLimitResult.data || null;
    const postingUsageRow = postingUsageResult.data || null;
    const licenseRow = licenseResult.data || null;
    const licenseKeyRow = licenseKeyResult.data || null;

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

    // Bridge mode for early solo users
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
    const subscription = buildSubscriptionPayload(
      subscriptionRow,
      postingLimitRow,
      postingUsageRow,
      licenseRow,
      licenseKeyRow
    );
    const scannerConfigPayload = buildScannerConfigPayload(scannerConfig, dealership || {}, legacyProfile || {});

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
      subscription,
      scanner_config: scannerConfigPayload,
      meta: {
        requested_hostname: hostname,
        requested_page_url: pageUrl,
        mode: membershipList.length ? "multi_tenant" : "solo_bridge"
      }
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
