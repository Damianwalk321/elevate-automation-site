const DEFAULT_REWARDS = Object.freeze({
  post_success: 2,
  first_post_bonus: 15,
  first_sync_bonus: 10,
  activation_bonus: 20,
  first_message_bonus: 12,
  referred_signup_bonus: 25,
  referred_activation_bonus: 40
});

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function safeJsonMeta(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return {};
  }
}

function isMissingRelationError(error) {
  const message = clean(error?.message || "").toLowerCase();
  return (
    error?.code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("column")
  );
}

async function maybeSelectSingle(queryBuilder) {
  const { data, error } = await queryBuilder.maybeSingle();
  if (error && !isMissingRelationError(error)) throw error;
  return error ? null : data || null;
}

export async function ensureUserCreditLedger(supabase, { userId = "", email = "" } = {}) {
  const normalizedUserId = clean(userId);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedUserId && !normalizedEmail) {
    return { ok: false, reason: "missing_identity", balance: 0, lifetime_earned: 0, lifetime_spent: 0, schema_ready: false };
  }

  let existing = null;
  if (normalizedUserId) {
    existing = await maybeSelectSingle(
      supabase.from("user_credits").select("*").eq("user_id", normalizedUserId)
    );
  }
  if (!existing && normalizedEmail) {
    existing = await maybeSelectSingle(
      supabase.from("user_credits").select("*").ilike("email", normalizedEmail).order("updated_at", { ascending: false }).limit(1)
    );
  }

  const timestamp = nowIso();
  const baseRow = {
    user_id: normalizedUserId || null,
    email: normalizedEmail || null,
    balance: safeNumber(existing?.balance, 0),
    lifetime_earned: safeNumber(existing?.lifetime_earned, 0),
    lifetime_spent: safeNumber(existing?.lifetime_spent, 0),
    updated_at: timestamp
  };

  if (!existing) {
    const { data, error } = await supabase
      .from("user_credits")
      .insert(baseRow)
      .select("*")
      .maybeSingle();
    if (error) {
      if (isMissingRelationError(error)) {
        return { ...baseRow, ok: false, reason: "schema_not_ready", schema_ready: false };
      }
      throw error;
    }
    return { ...(data || baseRow), ok: true, schema_ready: true };
  }

  const patch = {};
  if (!clean(existing.user_id) && normalizedUserId) patch.user_id = normalizedUserId;
  if (!normalizeEmail(existing.email) && normalizedEmail) patch.email = normalizedEmail;
  if (!Object.keys(patch).length) {
    return { ...existing, ok: true, schema_ready: true };
  }

  patch.updated_at = timestamp;
  const { data, error } = await supabase
    .from("user_credits")
    .update(patch)
    .eq("id", existing.id)
    .select("*")
    .maybeSingle();
  if (error) {
    if (isMissingRelationError(error)) {
      return { ...existing, ok: false, reason: "schema_not_ready", schema_ready: false };
    }
    throw error;
  }
  return { ...(data || { ...existing, ...patch }), ok: true, schema_ready: true };
}

export async function addCredits(supabase, {
  userId = "",
  email = "",
  amount = 0,
  type = "manual",
  meta = {},
  dedupeKey = "",
  allowDuplicate = false
} = {}) {
  const normalizedUserId = clean(userId);
  const normalizedEmail = normalizeEmail(email);
  const creditAmount = safeNumber(amount, 0);
  const eventType = clean(type).toLowerCase() || "manual";
  const eventDedupeKey = clean(dedupeKey);

  if (!normalizedUserId && !normalizedEmail) {
    return { ok: false, reason: "missing_identity", amount_awarded: 0, duplicate: false, schema_ready: false };
  }
  if (!creditAmount) {
    const ledger = await ensureUserCreditLedger(supabase, { userId: normalizedUserId, email: normalizedEmail });
    return { ok: true, amount_awarded: 0, duplicate: false, ledger, schema_ready: Boolean(ledger?.schema_ready) };
  }

  const ledger = await ensureUserCreditLedger(supabase, { userId: normalizedUserId, email: normalizedEmail });
  if (!ledger?.schema_ready) {
    return { ok: false, reason: ledger?.reason || "schema_not_ready", amount_awarded: 0, duplicate: false, ledger, schema_ready: false };
  }

  if (!allowDuplicate && eventDedupeKey) {
    const existingEvent = await maybeSelectSingle(
      supabase
        .from("credit_events")
        .select("id,amount,type,dedupe_key,created_at")
        .eq("user_id", clean(ledger.user_id || normalizedUserId))
        .eq("type", eventType)
        .eq("dedupe_key", eventDedupeKey)
    );
    if (existingEvent) {
      return {
        ok: true,
        duplicate: true,
        amount_awarded: 0,
        ledger,
        schema_ready: true,
        existing_event: existingEvent
      };
    }
  }

  const timestamp = nowIso();
  const nextBalance = safeNumber(ledger.balance, 0) + creditAmount;
  const nextLifetimeEarned = safeNumber(ledger.lifetime_earned, 0) + Math.max(creditAmount, 0);
  const metaPayload = safeJsonMeta(meta);

  const { data: insertedEvent, error: eventError } = await supabase
    .from("credit_events")
    .insert({
      user_id: clean(ledger.user_id || normalizedUserId) || null,
      email: normalizeEmail(ledger.email || normalizedEmail) || null,
      type: eventType,
      amount: creditAmount,
      meta: metaPayload,
      dedupe_key: eventDedupeKey || null,
      created_at: timestamp,
      updated_at: timestamp
    })
    .select("*")
    .maybeSingle();

  if (eventError) {
    if (isMissingRelationError(eventError)) {
      return { ok: false, reason: "schema_not_ready", amount_awarded: 0, duplicate: false, ledger, schema_ready: false };
    }
    throw eventError;
  }

  const { data: updatedLedger, error: ledgerError } = await supabase
    .from("user_credits")
    .update({
      balance: nextBalance,
      lifetime_earned: nextLifetimeEarned,
      updated_at: timestamp
    })
    .eq("id", ledger.id)
    .select("*")
    .maybeSingle();
  if (ledgerError) throw ledgerError;

  return {
    ok: true,
    duplicate: false,
    amount_awarded: creditAmount,
    event: insertedEvent || null,
    ledger: updatedLedger || { ...ledger, balance: nextBalance, lifetime_earned: nextLifetimeEarned, updated_at: timestamp },
    schema_ready: true
  };
}

export async function getCreditSummary(supabase, { userId = "", email = "" } = {}) {
  const ledger = await ensureUserCreditLedger(supabase, { userId, email });
  if (!ledger?.schema_ready) {
    return {
      balance: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
      recent_earned: 0,
      schema_ready: false,
      reason: ledger?.reason || "schema_not_ready"
    };
  }

  const { data: recentEvents, error } = await supabase
    .from("credit_events")
    .select("amount,created_at")
    .eq("user_id", clean(ledger.user_id || userId))
    .order("created_at", { ascending: false })
    .limit(25);
  if (error && !isMissingRelationError(error)) throw error;

  const recentEarned = (Array.isArray(recentEvents) ? recentEvents : []).reduce((sum, row) => {
    return sum + Math.max(safeNumber(row?.amount, 0), 0);
  }, 0);

  return {
    balance: safeNumber(ledger.balance, 0),
    lifetime_earned: safeNumber(ledger.lifetime_earned, 0),
    lifetime_spent: safeNumber(ledger.lifetime_spent, 0),
    recent_earned: recentEarned,
    updated_at: ledger.updated_at || null,
    schema_ready: true
  };
}

export async function listRecentCreditEvents(supabase, { userId = "", email = "", limit = 8 } = {}) {
  const normalizedUserId = clean(userId);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedUserId && !normalizedEmail) return [];

  let query = supabase
    .from("credit_events")
    .select("type,amount,meta,created_at,dedupe_key")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(safeNumber(limit, 8), 20)));

  if (normalizedUserId) query = query.eq("user_id", normalizedUserId);
  else query = query.ilike("email", normalizedEmail);

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }

  return (Array.isArray(data) ? data : []).map((row) => ({
    type: clean(row.type).toLowerCase(),
    amount: safeNumber(row.amount, 0),
    meta: safeJsonMeta(row.meta),
    created_at: row.created_at || null,
    dedupe_key: clean(row.dedupe_key)
  }));
}

export function formatCreditEventLabel(type = "") {
  const normalized = clean(type).toLowerCase();
  switch (normalized) {
    case "post_success": return "Post published";
    case "first_post_bonus": return "First post bonus";
    case "first_sync_bonus": return "First sync bonus";
    case "activation_bonus": return "Activation bonus";
    case "first_message_bonus": return "First message bonus";
    case "referred_signup_bonus": return "Referral signup";
    case "referred_activation_bonus": return "Referral activation";
    default: return normalized ? normalized.replace(/_/g, " ") : "Credit event";
  }
}

export function getCreditEconomyState() {
  return {
    rewards: { ...DEFAULT_REWARDS },
    schema: {
      ledger_table: "user_credits",
      events_table: "credit_events"
    }
  };
}

export async function awardPostCredits(supabase, { userId = "", email = "", listingId = "", duplicate = false, postsUsedToday = 0 } = {}) {
  const normalizedListingId = clean(listingId);
  const outcomes = [];
  if (duplicate) {
    const ledger = await ensureUserCreditLedger(supabase, { userId, email });
    return { awarded_total: 0, outcomes, ledger, schema_ready: Boolean(ledger?.schema_ready) };
  }

  outcomes.push(await addCredits(supabase, {
    userId,
    email,
    amount: DEFAULT_REWARDS.post_success,
    type: "post_success",
    dedupeKey: normalizedListingId ? `post_success:${normalizedListingId}` : "",
    meta: { listing_id: normalizedListingId, source: "register-post" }
  }));

  if (safeNumber(postsUsedToday, 0) === 1) {
    outcomes.push(await addCredits(supabase, {
      userId,
      email,
      amount: DEFAULT_REWARDS.first_post_bonus,
      type: "first_post_bonus",
      dedupeKey: "first_post_bonus",
      meta: { source: "register-post", milestone: "first_post" }
    }));
  }

  const awardedTotal = outcomes.reduce((sum, result) => sum + safeNumber(result?.amount_awarded, 0), 0);
  const finalLedger = outcomes.slice().reverse().find((result) => result?.ledger)?.ledger || await ensureUserCreditLedger(supabase, { userId, email });
  return { awarded_total: awardedTotal, outcomes, ledger: finalLedger, schema_ready: Boolean(finalLedger?.schema_ready) };
}

export async function awardLifecycleCredits(supabase, { userId = "", email = "", syncedListings = 0, totalMessages = 0, postsToday = 0 } = {}) {
  const outcomes = [];

  if (safeNumber(syncedListings, 0) > 0) {
    outcomes.push(await addCredits(supabase, {
      userId,
      email,
      amount: DEFAULT_REWARDS.first_sync_bonus,
      type: "first_sync_bonus",
      dedupeKey: "first_sync_bonus",
      meta: { source: "sync-lifecycle", synced_listings: safeNumber(syncedListings, 0) }
    }));
  }

  if (safeNumber(postsToday, 0) > 0 && safeNumber(syncedListings, 0) > 0) {
    outcomes.push(await addCredits(supabase, {
      userId,
      email,
      amount: DEFAULT_REWARDS.activation_bonus,
      type: "activation_bonus",
      dedupeKey: "activation_bonus",
      meta: { source: "sync-lifecycle", milestone: "first_win" }
    }));
  }

  if (safeNumber(totalMessages, 0) > 0) {
    outcomes.push(await addCredits(supabase, {
      userId,
      email,
      amount: DEFAULT_REWARDS.first_message_bonus,
      type: "first_message_bonus",
      dedupeKey: "first_message_bonus",
      meta: { source: "sync-lifecycle", total_messages: safeNumber(totalMessages, 0) }
    }));
  }

  const awardedTotal = outcomes.reduce((sum, result) => sum + safeNumber(result?.amount_awarded, 0), 0);
  const ledger = outcomes.slice().reverse().find((result) => result?.ledger)?.ledger || await ensureUserCreditLedger(supabase, { userId, email });
  return { awarded_total: awardedTotal, outcomes, ledger, schema_ready: Boolean(ledger?.schema_ready) };
}
