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

function buildSubscriptionPayload(subscription) {
  const status = clean(
    subscription?.status ||
    subscription?.subscription_status ||
    "inactive"
  ).toLowerCase();

  const postingLimit = Number(
    subscription?.posting_limit ??
    subscription?.daily_posting_limit ??
    25
  );

  const postsToday = Number(
    subscription?.posts_today ??
    subscription?.usage_today ??
    0
  );

  const postsRemaining = Math.max(postingLimit - postsToday, 0);

  return {
    id: subscription?.id || "",
    plan: clean(subscription?.plan || subscription?.plan_name || "Starter"),
    status,
    active: ["active", "trialing", "paid"].includes(status),
    posting_limit: postingLimit,
    posts_today: postsToday,
    posts_remaining: postsRemaining,
    stripe_customer_id: clean(subscription?.stripe_customer_id || ""),
    stripe_subscription_id: clean(subscription?.stripe_subscription_id || "")
  };
}

function buildProfilePayload(user, profileRow, legacyProfileRow, dealership) {
  const source = profileRow || legacyProfileRow || {};

  const province = clean(
    source?.province ||
    source?.compliance_mode ||
    dealership?.province ||
    ""
  );

  const city = clean(
    source?.city ||
    dealership?.city ||
    ""
  );

  return {
    id: source?.id || "",
    email: normalizeEmail(user?.email || source?.email || ""),
    full_name: clean(
      source?.full_name ||
      source?.salesperson_name ||
      user?.full_name ||
      ""
    ),
    phone: clean(source?.phone || user?.phone || ""),
    license_number: clean(source?.license_number || ""),
    listing_location: clean(
      source?.listing_location ||
      source?.location ||
      (city && province ? `${city}, ${province}` : city)
    ),
    dealer_phone: clean(source?.dealer_phone || ""),
    dealer_email: clean(source?.dealer_email || user?.email || ""),
    compliance_mode: province,
    city,
    province
  };
}

function buildScannerConfigPayload(scannerConfig, dealership) {
  return {
    id: scannerConfig?.id || "",
    scanner_type: clean(
      scannerConfig?.scanner_type ||
      dealership?.scanner_type ||
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

function dealershipMatchesHostname(dealership, hostname) {
  if (!dealership || !hostname) return false;

  const websiteHost = safeHostname(dealership.website || "");
  const inventoryHost = safeHostname(dealership.inventory_url || "");

  return (
    (websiteHost && (hostname === websiteHost || hostname.endsWith(`.${websiteHost}`) || websiteHost.endsWith(`.${hostname}`))) ||
    (inventoryHost && (hostname === inventoryHost || hostname.endsWith(`.${inventoryHost}`) || inventoryHost.endsWith(`.${hostname}`)))
  );
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

    const { data: memberships, error: membershipsError } = await supabase
      .from("organization_members")
      .select(`
        *,
        organizations (*),
        dealerships (*)
      `)
      .eq("user_id", user.id);

    if (membershipsError) {
      return res.status(500).json({
        ok: false,
        error: `Organization memberships lookup failed: ${membershipsError.message}`
      });
    }

    const membershipList = Array.isArray(memberships) ? memberships : [];

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

      organization = ownedOrganization || null;
    }

    if (!dealership && organization?.id) {
      const { data: dealerships } = await supabase
        .from("dealerships")
        .select("*")
        .eq("organization_id", organization.id)
        .eq("active", true);

      const dealershipList = Array.isArray(dealerships) ? dealerships : [];
      dealership =
        dealershipList.find((d) => dealershipMatchesHostname(d, hostname)) ||
        dealershipList[0] ||
        null;
    }

    if (!organization) {
      return res.status(404).json({
        ok: false,
        error: "No organization found for user"
      });
    }

    const { data: scannerConfig } = dealership?.id
      ? await supabase
          .from("scanner_configs")
          .select("*")
          .eq("dealership_id", dealership.id)
          .eq("active", true)
          .maybeSingle()
      : { data: null };

    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: legacyProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("organization_id", organization.id)
      .maybeSingle();

    const profile = buildProfilePayload(user, userProfile, legacyProfile, dealership || {});
    const subscriptionPayload = buildSubscriptionPayload(subscription || {});
    const scannerConfigPayload = buildScannerConfigPayload(scannerConfig || {}, dealership || {});

    const session = {
      user: {
        id: user.id,
        email: normalizeEmail(user.email || ""),
        full_name: clean(user.full_name || ""),
        phone: clean(user.phone || ""),
        active: user.active !== false
      },
      organization: {
        id: organization.id,
        name: clean(organization.name || ""),
        owner_user_id: organization.owner_user_id || "",
        membership_role: clean(selectedMembership?.role || "salesperson")
      },
      dealership: dealership
        ? {
            id: dealership.id,
            organization_id: dealership.organization_id,
            name: clean(dealership.name || ""),
            website: clean(dealership.website || ""),
            inventory_url: clean(dealership.inventory_url || ""),
            province: clean(dealership.province || ""),
            city: clean(dealership.city || ""),
            timezone: clean(dealership.timezone || "America/Edmonton"),
            scanner_type: clean(dealership.scanner_type || scannerConfigPayload.scanner_type || "generic"),
            active: dealership.active !== false
          }
        : null,
      profile,
      subscription: subscriptionPayload,
      scanner_config: scannerConfigPayload,
      meta: {
        requested_hostname: hostname,
        requested_page_url: pageUrl
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
