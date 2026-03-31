import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('PROFILE API: Missing Supabase environment variables');
      return res.status(500).json({
        error: 'Missing Supabase environment variables'
      });
    }

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    if (req.method === 'GET') {
      const email =
        typeof req.query?.email === 'string'
          ? req.query.email.trim().toLowerCase()
          : '';

      if (!email) {
        return res.status(400).json({
          error: 'Missing email'
        });
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('PROFILE API GET ERROR:', error);
        return res.status(500).json({
          error: 'Failed to load profile',
          details: error.message
        });
      }

      return res.status(200).json({
        success: true,
        profile: data || null
      });
    }

    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : (req.body || {});

      const email =
        typeof body.email === 'string'
          ? body.email.trim().toLowerCase()
          : '';

      if (!email) {
        return res.status(400).json({
          error: 'Email is required'
        });
      }

      const payload = {
        email,
        full_name:
          typeof body.full_name === 'string' && body.full_name.trim()
            ? body.full_name.trim()
            : null,
        dealership:
          typeof body.dealership === 'string' && body.dealership.trim()
            ? body.dealership.trim()
            : null,
        city:
          typeof body.city === 'string' && body.city.trim()
            ? body.city.trim()
            : null,
        province:
          typeof body.province === 'string' && body.province.trim()
            ? body.province.trim()
            : null
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'email' })
        .select()
        .single();

      if (error) {
        console.error('PROFILE API POST ERROR:', error);
        return res.status(500).json({
          error: 'Failed to save profile',
          details: error.message
        });
      }

      return res.status(200).json({
        success: true,
        profile: data
      });
    }

    return res.status(405).json({
      error: 'Method not allowed'
    });
  } catch (err) {
    console.error('PROFILE API CRASH:', err);
    return res.status(500).json({
      error: 'Server crash',
      details: err?.message || 'Unknown error'
    });
  }
}
