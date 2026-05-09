import { resolveAccountAccess, inferPostingLimitFromPlan, normalizePlanLabel } from "./account-access.js";
import { CANONICAL_PROFILE_TABLE, buildCanonicalProfileSnapshot } from "./canonical-state.js";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

export const CANONICAL_ACCOUNT_TABLE = "users";
export const CANONICAL_ACCESS_TABLE = "subscriptions";
export const LEGACY_ACCOUNT_TABLES = [];

export function buildCanonicalUserUpsert(authUser = {}) {
  const email = normalizeEmail(authUser.email || "");
  const fullName = clean(authUser.user_metadata?.full_name || authUser.user_metadata?.name || "");
  return {
    auth_user_id: clean(authUser.id || ""),
    email,
    full_name: fullName || null,
    name: fullName || null,
    updated_at: new Date().toISOString(),
  };
}

export function buildCanonicalAccessSnapshot({ authUser = {}, userRow = {}, subscriptionRow = {}, profileRow = {} } = {}) {
  const email = normalizeEmail(authUser.email || userRow.email || subscriptionRow.email || profileRow.email || "");
  const authUserId = clean(authUser.id || userRow.auth_user_id || "");
  const userId = clean(userRow.id || "");
  const profileSnapshot = buildCanonicalProfileSnapshot(
    {
      id: authUserId,
      email,
      first_name: clean(userRow.first_name || ""),
      last_name: clean(userRow.last_name || ""),
      full_name: clean(userRow.full_name || userRow.name || ""),
      company: clean(userRow.company || ""),
      phone: clean(userRow.phone || ""),
      province: clean(userRow.province || ""),
    },
    profileRow || {}
  );

  const plan = normalizePlanLabel(subscriptionRow.plan_type || subscriptionRow.plan_name || subscriptionRow.plan || userRow.plan || "Founder Beta");
  const status = clean(subscriptionRow.subscription_status || subscriptionRow.status || userRow.subscription_status || userRow.status || "inactive") || "inactive";
  const postingLimit = Number(subscriptionRow.daily_posting_limit || subscriptionRow.posting_limit || inferPostingLimitFromPlan(plan)) || inferPostingLimitFromPlan(plan);
  const active = Boolean(subscriptionRow.active || subscriptionRow.access || subscriptionRow.access_active || subscriptionRow.is_active);
  const accessState = resolveAccountAccess({
    plan,
    status: active ? "active" : status,
    postsToday: 0,
    postingLimit,
    email,
    stripeCustomerId: clean(subscriptionRow.stripe_customer_id || userRow.stripe_customer_id || ""),
    currentPeriodEnd: subscriptionRow.current_period_end || null,
    cancelAtPeriodEnd: Boolean(subscriptionRow.cancel_at_period_end),
  });

  return {
    auth_user_id: authUserId,
    user_id: userId,
    email,
    plan: accessState.plan,
    status: accessState.status,
    active: accessState.active,
    access_granted: accessState.access_granted,
    posting_limit: accessState.posting_limit,
    posts_today: 0,
    posts_remaining: accessState.posting_limit,
    stripe_customer_id: clean(subscriptionRow.stripe_customer_id || userRow.stripe_customer_id || ""),
    stripe_subscription_id: clean(subscriptionRow.stripe_subscription_id || userRow.stripe_subscription_id || ""),
    canonical_account_table: CANONICAL_ACCOUNT_TABLE,
    canonical_access_table: CANONICAL_ACCESS_TABLE,
    canonical_profile_table: CANONICAL_PROFILE_TABLE,
    profile_completion_source: CANONICAL_PROFILE_TABLE,
    ...profileSnapshot,
  };
}

async function maybeSingle(query) {
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function resolveCanonicalAccountState(supabase, { authUserId = "", userId = "", email = "" } = {}) {
  const canonicalEmail = normalizeEmail(email);
  const canonicalAuthUserId = clean(authUserId || "");
  const canonicalUserId = clean(userId || "");

  let userRow = null;
  if (canonicalUserId) userRow = await maybeSingle(supabase.from(CANONICAL_ACCOUNT_TABLE).select("*").eq("id", canonicalUserId));
  if (!userRow && canonicalAuthUserId) userRow = await maybeSingle(supabase.from(CANONICAL_ACCOUNT_TABLE).select("*").eq("auth_user_id", canonicalAuthUserId));
  if (!userRow && canonicalEmail) userRow = await maybeSingle(supabase.from(CANONICAL_ACCOUNT_TABLE).select("*").ilike("email", canonicalEmail).order("created_at", { ascending: false }).limit(1));

  let profileRow = null;
  const profileId = canonicalAuthUserId || clean(userRow?.auth_user_id || "") || canonicalUserId;
  if (profileId) profileRow = await maybeSingle(supabase.from(CANONICAL_PROFILE_TABLE).select("*").eq("id", profileId));
  if (!profileRow && canonicalEmail) profileRow = await maybeSingle(supabase.from(CANONICAL_PROFILE_TABLE).select("*").ilike("email", canonicalEmail).order("updated_at", { ascending: false }).limit(1));

  let subscriptionRow = null;
  if (clean(userRow?.id || "")) subscriptionRow = await maybeSingle(supabase.from(CANONICAL_ACCESS_TABLE).select("*").eq("user_id", userRow.id).order("created_at", { ascending: false }).limit(1));
  if (!subscriptionRow && canonicalEmail) subscriptionRow = await maybeSingle(supabase.from(CANONICAL_ACCESS_TABLE).select("*").ilike("email", canonicalEmail).order("created_at", { ascending: false }).limit(1));

  const snapshot = buildCanonicalAccessSnapshot({ userRow, subscriptionRow, profileRow, authUser: { id: canonicalAuthUserId, email: canonicalEmail } });
  return {
    user: userRow,
    profile: profileRow,
    subscription: subscriptionRow,
    snapshot,
    canonical_tables: {
      account: CANONICAL_ACCOUNT_TABLE,
      access: CANONICAL_ACCESS_TABLE,
      profile: CANONICAL_PROFILE_TABLE,
    }
  };
}

export async function ensureCanonicalAccountState(supabase, { authUser } = {}) {
  const payload = buildCanonicalUserUpsert(authUser);
  const authUserId = clean(payload.auth_user_id || "");
  const email = normalizeEmail(payload.email || "");
  if (!authUserId || !email) throw new Error("Missing auth user identity for canonical sync");

  let userRow = await maybeSingle(supabase.from(CANONICAL_ACCOUNT_TABLE).select("*").eq("auth_user_id", authUserId));
  if (!userRow) userRow = await maybeSingle(supabase.from(CANONICAL_ACCOUNT_TABLE).select("*").ilike("email", email).order("created_at", { ascending: false }).limit(1));

  if (userRow) {
    const { data, error } = await supabase
      .from(CANONICAL_ACCOUNT_TABLE)
      .update({ ...payload, auth_user_id: authUserId, email })
      .eq("id", userRow.id)
      .select("*")
      .single();
    if (error) throw error;
    userRow = data;
  } else {
    const { data, error } = await supabase
      .from(CANONICAL_ACCOUNT_TABLE)
      .insert({ ...payload, auth_user_id: authUserId, email })
      .select("*")
      .single();
    if (error) throw error;
    userRow = data;
  }

  let profileRow = await maybeSingle(supabase.from(CANONICAL_PROFILE_TABLE).select("*").eq("id", authUserId));
  if (!profileRow) {
    const { data, error } = await supabase
      .from(CANONICAL_PROFILE_TABLE)
      .upsert({ id: authUserId, email, updated_at: new Date().toISOString() }, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw error;
    profileRow = data;
  }

  let subscriptionRow = await maybeSingle(supabase.from(CANONICAL_ACCESS_TABLE).select("*").eq("user_id", userRow.id).order("created_at", { ascending: false }).limit(1));
  const snapshot = buildCanonicalAccessSnapshot({ authUser, userRow, subscriptionRow, profileRow });

  if (subscriptionRow) {
    const { data, error } = await supabase
      .from(CANONICAL_ACCESS_TABLE)
      .update({
        email,
        account_snapshot: snapshot,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionRow.id)
      .select("*")
      .single();
    if (error) throw error;
    subscriptionRow = data;
  } else {
    const { data, error } = await supabase
      .from(CANONICAL_ACCESS_TABLE)
      .insert({
        user_id: userRow.id,
        email,
        subscription_status: "none",
        is_active: false,
        active: false,
        access: false,
        access_active: false,
        daily_posting_limit: inferPostingLimitFromPlan(snapshot.plan),
        posting_limit: inferPostingLimitFromPlan(snapshot.plan),
        account_snapshot: snapshot,
      })
      .select("*")
      .single();
    if (error) throw error;
    subscriptionRow = data;
  }

  return {
    user: userRow,
    profile: profileRow,
    subscription: subscriptionRow,
    snapshot: buildCanonicalAccessSnapshot({ authUser, userRow, subscriptionRow, profileRow }),
    canonical_tables: {
      account: CANONICAL_ACCOUNT_TABLE,
      access: CANONICAL_ACCESS_TABLE,
      profile: CANONICAL_PROFILE_TABLE,
    }
  };
}
