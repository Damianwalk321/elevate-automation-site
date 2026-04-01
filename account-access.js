import { supabase } from '../lib/supabase.js';

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

  const email = req.query.email?.toLowerCase();
  const licenseKey = req.query.license_key;

  if (!email && !licenseKey) {
    return res.status(400).json({ access: false, error: 'email or license_key required' });
  }

  try {
    // Check by license key first if provided
    if (licenseKey) {
      const { data: license } = await supabase
        .from('license_keys')
        .select('status, plan_type, expires_at')
        .eq('license_key', licenseKey)
        .maybeSingle();

      if (license && license.status === 'active') {
        const expired = license.expires_at && new Date(license.expires_at) < new Date();
        return res.status(200).json({
          access: !expired,
          plan: license.plan_type || 'starter',
          method: 'license_key',
        });
      }
    }

    // Check by email via subscriptions
    if (email) {
      const { data: userRow } = await supabase
        .from('users')
        .select('id, stripe_subscription_id')
        .ilike('email', email)
        .maybeSingle();

      if (!userRow) {
        return res.status(200).json({ access: false, reason: 'user_not_found' });
      }

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('subscription_status, plan_type, daily_posting_limit, is_active, bridge_access')
        .eq('user_id', userRow.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const hasAccess =
        sub?.is_active ||
        sub?.bridge_access ||
        sub?.subscription_status === 'active' ||
        sub?.subscription_status === 'trialing';

      return res.status(200).json({
        access: hasAccess || false,
        plan: sub?.plan_type || 'none',
        status: sub?.subscription_status || 'none',
        dailyLimit: sub?.daily_posting_limit || 5,
        method: 'subscription',
      });
    }

    return res.status(200).json({ access: false, reason: 'no_valid_identity' });
  } catch (err) {
    console.error('[account-access] Error:', err.message);
    return res.status(500).json({ access: false, error: err.message });
  }
}
