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
    let userRow = null;

    const { data: existingByAuth, error: existingByAuthError } = await supabase
      .from('users')
      .select('id, auth_user_id, email')
      .eq('auth_user_id', authUid)
      .maybeSingle();

    if (existingByAuthError) {
      console.error('[sync-user] users auth lookup error:', existingByAuthError.message);
    }

    if (existingByAuth) {
      const { data: updatedUser, error: updateByAuthError } = await supabase
        .from('users')
        .update({
          email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingByAuth.id)
        .select('id, auth_user_id, email')
        .maybeSingle();

      if (updateByAuthError) {
        console.error('[sync-user] users update-by-auth error:', updateByAuthError.message);
      } else {
        userRow = updatedUser;
      }
    }

    if (!userRow && email) {
      const { data: existingByEmail, error: existingByEmailError } = await supabase
        .from('users')
        .select('id, auth_user_id, email')
        .eq('email', email)
        .maybeSingle();

      if (existingByEmailError) {
        console.error('[sync-user] users email lookup error:', existingByEmailError.message);
      }

      if (existingByEmail) {
        const { data: updatedUser, error: updateByEmailError } = await supabase
          .from('users')
          .update({
            auth_user_id: authUid,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingByEmail.id)
          .select('id, auth_user_id, email')
          .maybeSingle();

        if (updateByEmailError) {
          console.error('[sync-user] users update-by-email error:', updateByEmailError.message);
        } else {
          userRow = updatedUser;
        }
      }
    }

    if (!userRow) {
      const { data: insertedUser, error: insertUserError } = await supabase
        .from('users')
        .insert({
          auth_user_id: authUid,
          email,
          updated_at: new Date().toISOString(),
        })
        .select('id, auth_user_id, email')
        .maybeSingle();

      if (insertUserError) {
        console.error('[sync-user] users insert error:', insertUserError.message);
      } else {
        userRow = insertedUser;
      }
    }

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

    if (userRow) {
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userRow.id)
        .maybeSingle();

      if (!existingSub) {
        const { error: subError } = await supabase.from('subscriptions').insert({
          user_id: userRow.id,
          email,
          subscription_status: 'none',
          is_active: false,
        });

        if (subError && subError.code !== '23505') {
          console.error('[sync-user] subscription insert error:', subError.message);
        }
      }
    }

    return res.status(200).json({ success: true, userId: authUid, linkedUserId: userRow?.id || null });
  } catch (err) {
    console.error('[sync-user] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
