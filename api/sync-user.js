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
    // Resolve or create the users row without tripping unique constraints on email/auth_user_id.
    let userRow = null;

    const { data: byAuthUser, error: byAuthError } = await supabase
      .from('users')
      .select('id, auth_user_id, email')
      .eq('auth_user_id', authUid)
      .maybeSingle();

    if (byAuthError) {
      console.error('[sync-user] users lookup by auth_user_id error:', byAuthError.message);
    }

    if (byAuthUser) {
      userRow = byAuthUser;

      const { error: updateByAuthError } = await supabase
        .from('users')
        .update({
          email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', byAuthUser.id);

      if (updateByAuthError) {
        console.error('[sync-user] users update-by-auth error:', updateByAuthError.message);
      }
    } else if (email) {
      const { data: byEmailUser, error: byEmailError } = await supabase
        .from('users')
        .select('id, auth_user_id, email')
        .eq('email', email)
        .maybeSingle();

      if (byEmailError) {
        console.error('[sync-user] users lookup by email error:', byEmailError.message);
      }

      if (byEmailUser) {
        userRow = byEmailUser;

        const { error: updateByEmailError } = await supabase
          .from('users')
          .update({
            auth_user_id: authUid,
            email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', byEmailUser.id);

        if (updateByEmailError) {
          console.error('[sync-user] users update-by-email error:', updateByEmailError.message);
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
        .single();

      if (insertUserError) {
        console.error('[sync-user] users insert error:', insertUserError.message);
      } else {
        userRow = insertedUser;
      }
    }

    if (!userRow) {
      const { data: fallbackUser, error: fallbackUserError } = await supabase
        .from('users')
        .select('id, auth_user_id, email')
        .or(`auth_user_id.eq.${authUid}${email ? `,email.eq.${email}` : ''}`)
        .maybeSingle();

      if (fallbackUserError) {
        console.error('[sync-user] users fallback lookup error:', fallbackUserError.message);
      } else {
        userRow = fallbackUser;
      }
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
    let existingSub = null;
    if (userRow?.id) {
      const { data: subRow, error: subError } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userRow.id)
        .maybeSingle();

      if (subError) {
        console.error('[sync-user] subscriptions lookup error:', subError.message);
      } else {
        existingSub = subRow;
      }
    }

    if (userRow?.id && !existingSub) {
      const { error: insertSubError } = await supabase.from('subscriptions').insert({
        user_id: userRow.id,
        email,
        subscription_status: 'none',
        is_active: false,
      });

      if (insertSubError && insertSubError.code !== '23505') {
        console.error('[sync-user] subscriptions insert error:', insertSubError.message);
      }
    }

    return res.status(200).json({ success: true, userId: authUid });
  } catch (err) {
    console.error('[sync-user] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
