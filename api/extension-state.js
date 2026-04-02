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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS).end();
  }

  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Accept Bearer token or ?email= param
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
    // 1. Load profile from single source of truth
    let profileQuery = supabase.from('profiles').select('*');
    profileQuery = authUid
      ? profileQuery.eq('id', authUid)
      : profileQuery.ilike('email', email);
    const { data: profile } = await profileQuery.maybeSingle();

    // 2. Load subscription state
    let subQuery = supabase
      .from('subscriptions')
      .select('subscription_status, plan_type, daily_posting_limit, bridge_access, access_active, is_active, trial_end, current_period_end')
      .order('created_at', { ascending: false })
      .limit(1);
    subQuery = authUid
      ? subQuery.eq('user_id', authUid)
      : subQuery.ilike('email', email);
    const { data: subscription } = await subQuery.maybeSingle();

    // 3. Load today's posting usage
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    let usageQuery = supabase
      .from('posting_usage')
      .select('posts_today, date_key')
      .eq('date_key', today);
    usageQuery = authUid
      ? usageQuery.eq('user_id', authUid)
      : usageQuery.ilike('email', email);
    const { data: usage } = await usageQuery.maybeSingle();

    // 4. Determine access
    const forcedAccess = ACCESS_OVERRIDE_EMAILS.has(normalizeEmail(email));
    const isActive =
      forcedAccess ||
      subscription?.is_active ||
      subscription?.access_active ||
      subscription?.bridge_access ||
      subscription?.subscription_status === 'active' ||
      subscription?.subscription_status === 'trialing';

    const dailyLimit = forcedAccess ? 25 : (subscription?.daily_posting_limit || 5);
    const postsToday = usage?.posts_today || 0;
    const canPost = isActive && postsToday < dailyLimit;

    return res.status(200).json({
      success: true,
      profile: profile || null,
      subscription: {
        status: forcedAccess ? 'active' : (subscription?.subscription_status || 'none'),
        plan: forcedAccess ? 'Pro' : (subscription?.plan_type || 'Beta'),
        isActive,
        dailyLimit,
        postsToday,
        postsRemaining: Math.max(0, dailyLimit - postsToday),
        canPost,
        trialEnd: subscription?.trial_end || null,
        periodEnd: subscription?.current_period_end || null,
      },
    });
  } catch (err) {
    console.error('[extension-state] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
