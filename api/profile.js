import { supabase } from '../lib/supabase.js';
import { requireVerifiedDashboardUser, getTrustedIdentity, requireVerifiedUser } from './_shared/auth.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-elevate-client',
};

function clean(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function pickAllowedUpdates(body = {}) {
  const allowed = [
    'full_name', 'phone', 'dealership', 'city', 'province',
    'dealer_phone', 'dealer_email', 'dealer_website', 'inventory_url',
    'scanner_type', 'listing_location', 'license_number', 'compliance_mode',
    'booking_link', 'instagram_handle', 'primary_cta', 'dealership_website',
    'default_seller_name', 'trades_welcome', 'financing_cta',
    'delivery_available', 'carfax_mention', 'active_disclaimer', 'logo_url',
  ];

  const updates = {};
  for (const field of allowed) {
    if (field in body) updates[field] = body[field];
  }
  return updates;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS).end();
  }

  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const verifiedUser = req.method === 'POST'
      ? await requireVerifiedUser(req, res)
      : await requireVerifiedDashboardUser(req, res);

    if ((req.method === 'POST' || clean(req.headers['x-elevate-client']).toLowerCase() === 'dashboard') && !verifiedUser) {
      return;
    }

    const trusted = getTrustedIdentity({
      verifiedUser,
      body: req.body || {},
      query: req.query || {}
    });

    const authUid = clean(trusted.id || '');
    const email = normalizeEmail(trusted.email || '');
    const requestedId = clean(req.query.id || req.body?.id || req.body?.user_id || '');

    if (req.method === 'GET') {
      let query = supabase.from('profiles').select('*');

      if (authUid) {
        query = query.eq('id', authUid);
      } else if (requestedId) {
        query = query.eq('id', requestedId);
      } else if (email) {
        query = query.ilike('email', email);
      } else {
        return res.status(400).json({ error: 'No identity provided' });
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('[profile GET] Supabase error:', error.message);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ profile: data || null });
    }

    const updates = pickAllowedUpdates(req.body || {});
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    if (!authUid) {
      return res.status(401).json({ error: 'Unauthorized', requires_auth: true });
    }

    updates.updated_at = new Date().toISOString();

    const upsertData = {
      id: authUid,
      email,
      ...updates,
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(upsertData, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('[profile POST] Supabase error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[profile POST] Saved profile for ${email || authUid} at ${data.updated_at}`);
    return res.status(200).json({ success: true, profile: data });
  } catch (error) {
    console.error('[profile] fatal error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
