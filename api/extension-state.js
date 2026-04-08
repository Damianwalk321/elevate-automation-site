import { supabase } from '../lib/supabase.js';

const ACCESS_OVERRIDE_EMAILS = new Set(['damian044@icloud.com']);

function clean(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function resolveActiveState(subscription = {}, forcedAccess = false) {
  return Boolean(
    forcedAccess ||
    subscription?.is_active ||
    subscription?.access_active ||
    subscription?.bridge_access ||
    subscription?.subscription_status === 'active' ||
    subscription?.subscription_status === 'trialing'
  );
}

async function resolveIdentity(authUid, email) {
  const normalizedEmail = normalizeEmail(email);
  const candidateIds = new Set([clean(authUid)].filter(Boolean));

  let userRow = null;

  if (authUid) {
    const { data } = await supabase
      .from('users')
      .select('id,auth_user_id,email,created_at')
      .eq('auth_user_id', authUid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      userRow = data;
      if (clean(data.id)) candidateIds.add(clean(data.id));
      if (clean(data.auth_user_id)) candidateIds.add(clean(data.auth_user_id));
      if (normalizeEmail(data.email)) email = data.email;
    }
  }

  if (!userRow && normalizedEmail) {
    const { data } = await supabase
      .from('users')
      .select('id,auth_user_id,email,created_at')
      .ilike('email', normalizedEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      userRow = data;
      if (clean(data.id)) candidateIds.add(clean(data.id));
      if (clean(data.auth_user_id)) candidateIds.add(clean(data.auth_user_id));
      if (normalizeEmail(data.email)) email = data.email;
    }
  }

  return {
    userRow,
    normalizedEmail: normalizeEmail(email),
    candidateIds: Array.from(candidateIds)
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS).end();
  }

  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let authUid = null;
  let email = normalizeEmail(req.query.email);

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      authUid = user.id;
      email = normalizeEmail(user.email);
    }
  }

  if (!email && !authUid) {
    return res.status(400).json({ error: 'No identity provided' });
  }

  try {
    const identity = await resolveIdentity(authUid, email);
    const normalizedEmail = identity.normalizedEmail;
    const candidateIds = identity.candidateIds;
    const internalUserId = clean(identity.userRow?.id || '');

    let profile = null;
    if (authUid) {
      const { data } = await supabase.from('profiles').select('*').eq('id', authUid).maybeSingle();
      profile = data || null;
    }
    if (!profile && normalizedEmail) {
      const { data } = await supabase.from('profiles').select('*').ilike('email', normalizedEmail).maybeSingle();
      profile = data || null;
    }

    let subscription = null;
    if (internalUserId) {
      const { data } = await supabase
        .from('subscriptions')
        .select('subscription_status, plan_type, daily_posting_limit, bridge_access, access_active, is_active, trial_end, current_period_end, software_license_key, license_key, created_at')
        .eq('user_id', internalUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      subscription = data || null;
    }
    if (!subscription && candidateIds.length) {
      const { data } = await supabase
        .from('subscriptions')
        .select('subscription_status, plan_type, daily_posting_limit, bridge_access, access_active, is_active, trial_end, current_period_end, software_license_key, license_key, created_at')
        .in('user_id', candidateIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      subscription = data || null;
    }
    if (!subscription && normalizedEmail) {
      const { data } = await supabase
        .from('subscriptions')
        .select('subscription_status, plan_type, daily_posting_limit, bridge_access, access_active, is_active, trial_end, current_period_end, software_license_key, license_key, created_at')
        .ilike('email', normalizedEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      subscription = data || null;
    }

    const today = new Date().toISOString().slice(0, 10);
    let usage = null;
    if (internalUserId) {
      const { data } = await supabase
        .from('posting_usage')
        .select('posts_today, posts_used, used_today, date_key')
        .eq('date_key', today)
        .eq('user_id', internalUserId)
        .maybeSingle();
      usage = data || null;
    }
    if (!usage && candidateIds.length) {
      const { data } = await supabase
        .from('posting_usage')
        .select('posts_today, posts_used, used_today, date_key')
        .eq('date_key', today)
        .in('user_id', candidateIds)
        .maybeSingle();
      usage = data || null;
    }
    if (!usage && normalizedEmail) {
      const { data } = await supabase
        .from('posting_usage')
        .select('posts_today, posts_used, used_today, date_key')
        .eq('date_key', today)
        .ilike('email', normalizedEmail)
        .maybeSingle();
      usage = data || null;
    }

    const forcedAccess = ACCESS_OVERRIDE_EMAILS.has(normalizedEmail);
    const active = resolveActiveState(subscription || {}, forcedAccess);
    const normalizedStatus = forcedAccess ? 'active' : clean(subscription?.subscription_status || 'none');
    const normalizedPlan = forcedAccess ? 'Pro' : clean(subscription?.plan_type || 'Beta');
    const postingLimit = forcedAccess ? 25 : Number(subscription?.daily_posting_limit || 5);
    const postsToday = Number(usage?.posts_today ?? usage?.posts_used ?? usage?.used_today ?? 0) || 0;
    const postsRemaining = Math.max(0, postingLimit - postsToday);
    const canPost = active && postsToday < postingLimit;
    const licenseKey = clean(subscription?.software_license_key || subscription?.license_key || profile?.software_license_key || '');

    return res.status(200).json({
      success: true,
      profile: profile || null,
      dealership: {
        name: clean(profile?.dealership || ''),
        dealer_name: clean(profile?.dealership || ''),
        inventory_url: clean(profile?.inventory_url || ''),
        website: clean(profile?.dealer_website || ''),
        province: clean(profile?.province || ''),
        scanner_type: clean(profile?.scanner_type || '')
      },
      identity: {
        auth_user_id: clean(authUid || ''),
        internal_user_id: internalUserId,
        email: normalizedEmail,
        candidate_user_ids: candidateIds
      },
      subscription: {
        status: normalizedStatus,
        normalized_status: normalizedStatus,
        plan: normalizedPlan,
        normalized_plan: normalizedPlan,

        active,
        isActive: active,
        access_granted: active,
        accessGranted: active,
        bridge_access: Boolean(subscription?.bridge_access || false),

        posting_limit: postingLimit,
        daily_posting_limit: postingLimit,
        daily_limit: postingLimit,
        dailyLimit: postingLimit,

        posts_today: postsToday,
        postsToday: postsToday,
        posts_remaining: postsRemaining,
        postsRemaining: postsRemaining,
        can_post: canPost,
        canPost: canPost,

        trial_end: subscription?.trial_end || null,
        current_period_end: subscription?.current_period_end || null,
        license_key: licenseKey,
        software_license_key: licenseKey
      }
    });
  } catch (err) {
    console.error('[extension-state] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
