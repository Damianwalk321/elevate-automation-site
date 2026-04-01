import { supabase } from '../lib/supabase.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS).end();
  }

  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Resolve user from Bearer token
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const email = user.email?.toLowerCase();
  const authUid = user.id;

  try {
    // Upsert into users table
    const { error: userError } = await supabase
      .from('users')
      .upsert({
        auth_user_id: authUid,
        email,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'auth_user_id' });

    if (userError) {
      console.error('[sync-user] users upsert error:', userError.message);
    }

    // Ensure profile row exists (don't overwrite existing data)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authUid)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: authUid, email });

      if (profileError && profileError.code !== '23505') {
        console.error('[sync-user] profile insert error:', profileError.message);
      }
    }

    // Ensure subscription row exists
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', (await supabase.from('users').select('id').eq('auth_user_id', authUid).maybeSingle()).data?.id)
      .maybeSingle();

    // Load user's users.id
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUid)
      .maybeSingle();

    if (userRow && !existingSub) {
      await supabase.from('subscriptions').insert({
        user_id: userRow.id,
        email,
        subscription_status: 'none',
        is_active: false,
      });
    }

    return res.status(200).json({ success: true, userId: authUid });
  } catch (err) {
    console.error('[sync-user] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
