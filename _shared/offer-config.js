function clean(value) {
  return String(value || "").trim();
}

function getBooleanEnv(name, fallback = false) {
  const value = clean(process.env[name]);
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function getNumberEnv(name, fallback) {
  const raw = clean(process.env[name]);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getOfferConfig() {
  const trialDays = getNumberEnv("PUBLIC_TRIAL_DAYS", 7);
  const starterPrice = getNumberEnv("PUBLIC_STARTER_PRICE", 49);
  const proPrice = getNumberEnv("PUBLIC_PRO_PRICE", 79);
  const starterPostCap = getNumberEnv("PUBLIC_STARTER_POST_CAP", 5);
  const proPostCap = getNumberEnv("PUBLIC_PRO_POST_CAP", 25);
  const publicTrialEnabled = getBooleanEnv("PUBLIC_TRIAL_ENABLED", true);

  return {
    publicTrialEnabled,
    trialDays,
    pricing: {
      starter: {
        planType: "starter",
        title: "Starter",
        priceMonthly: starterPrice,
        postCapDaily: starterPostCap,
        checkoutButtonLabel: publicTrialEnabled ? "Start Starter Trial" : "Start Starter",
        priceIdEnvKey: "STRIPE_STARTER_PRICE_ID"
      },
      pro: {
        planType: "pro",
        title: "Pro",
        priceMonthly: proPrice,
        postCapDaily: proPostCap,
        checkoutButtonLabel: publicTrialEnabled ? "Start Pro Trial" : "Start Pro",
        priceIdEnvKey: "STRIPE_PRO_PRICE_ID"
      }
    }
  };
}

export function getPublicOfferConfig() {
  const config = getOfferConfig();
  const { publicTrialEnabled, trialDays, pricing } = config;

  return {
    publicTrialEnabled,
    trialDays,
    pricing: {
      starter: {
        title: pricing.starter.title,
        priceMonthly: pricing.starter.priceMonthly,
        postCapDaily: pricing.starter.postCapDaily,
        checkoutButtonLabel: pricing.starter.checkoutButtonLabel
      },
      pro: {
        title: pricing.pro.title,
        priceMonthly: pricing.pro.priceMonthly,
        postCapDaily: pricing.pro.postCapDaily,
        checkoutButtonLabel: pricing.pro.checkoutButtonLabel
      }
    }
  };
}

export function getPlanConfig(planType, accessType = "", userType = "") {
  const config = getOfferConfig();
  const normalizedPlanType = clean(planType).toLowerCase();
  const normalizedAccessType = clean(accessType).toLowerCase();
  const normalizedUserType = clean(userType).toLowerCase();

  const founderStarterPriceId = clean(process.env.STRIPE_FOUNDER_PRICE_ID);
  const founderProPriceId = clean(process.env.STRIPE_FOUNDER_PRO_PRICE_ID);
  const starterPriceId = clean(process.env.STRIPE_STARTER_PRICE_ID);
  const proPriceId = clean(process.env.STRIPE_PRO_PRICE_ID);

  if (
    ["founder_beta", "founder-beta", "founder_starter", "founder-starter"].includes(normalizedPlanType)
  ) {
    return {
      planName: "Founder Beta",
      lookupKey: "STRIPE_FOUNDER_PRICE_ID",
      priceId: founderStarterPriceId,
      trialDays: 0
    };
  }

  if (["founder_pro", "founder-pro"].includes(normalizedPlanType)) {
    return {
      planName: "Founder Pro",
      lookupKey: "STRIPE_FOUNDER_PRO_PRICE_ID",
      priceId: founderProPriceId,
      trialDays: 0
    };
  }

  if (
    normalizedPlanType === "starter" ||
    (!normalizedPlanType && normalizedAccessType !== "founder" && normalizedUserType !== "founder")
  ) {
    return {
      planName: config.pricing.starter.title,
      lookupKey: config.pricing.starter.priceIdEnvKey,
      priceId: starterPriceId,
      trialDays: config.publicTrialEnabled ? config.trialDays : 0
    };
  }

  if (normalizedPlanType === "pro") {
    return {
      planName: config.pricing.pro.title,
      lookupKey: config.pricing.pro.priceIdEnvKey,
      priceId: proPriceId,
      trialDays: config.publicTrialEnabled ? config.trialDays : 0
    };
  }

  return null;
}
