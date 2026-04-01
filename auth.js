import { supabase } from '../lib/supabase.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS).end();
  }

  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ authenticated: false, error: 'No token' });
  }

  const token = authHeader.slice(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ authenticated: false, error: 'Invalid or expired token' });
    }

    const email = user.email?.toLowerCase();

    // Load profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    // Load subscription
    const { data: userRow } = await supabase
      .from('users')
      .select('id, plan, stripe_customer_id, stripe_subscription_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    let subscription = null;
    if (userRow) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('subscription_status, plan_type, daily_posting_limit, is_active, trial_end')
        .eq('user_id', userRow.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      subscription = sub;
    }

    return res.status(200).json({
      authenticated: true,
      user: {
        id: user.id,
        email,
      },
      profile: profile || null,
      subscription: subscription || { subscription_status: 'none', is_active: false },
      stripeCustomerId: userRow?.stripe_customer_id || null,
    });
  } catch (err) {
    console.error('[auth] Error:', err.message);
    return res.status(500).json({ authenticated: false, error: err.message });
  }
}
