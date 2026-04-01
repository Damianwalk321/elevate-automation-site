import { supabase } from '../lib/supabase.js';
import { randomUUID } from 'node:crypto';

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

  // ── Resolve identity ─────────────────────────────────────────────────────
  // Accept either a Bearer token (auth UID lookup) or a plain email param
  // for backwards-compat with the extension which still passes ?email=
  let authUid = null;
  let email = null;

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      authUid = user.id;
      email = user.email;
    }
  }

  // Fallback: email from query or body
  const requestedId = req.query.id || req.body?.id || req.body?.user_id || null;
  if (!email) {
    email = req.query.email || req.body?.email;
  }

  if (!email && !authUid) {
    return res.status(400).json({ error: 'No identity provided' });
  }

  // ── Normalize email casing (damian044 vs Damian044) ──────────────────────
  if (email) email = email.toLowerCase();

  // ── GET: load profile ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    let query = supabase
      .from('profiles')
      .select('*');

    if (authUid) {
      query = query.eq('id', authUid);
    } else if (requestedId) {
      query = query.eq('id', requestedId);
    } else {
      query = query.ilike('email', email);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('[profile GET] Supabase error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(200).json({ profile: null });
    }

    return res.status(200).json({ profile: data });
  }

  // ── POST: save profile ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body || {};

    // Build the update payload — only include fields that were actually sent
    const allowed = [
      'full_name', 'phone', 'dealership', 'city', 'province',
      'dealer_phone', 'dealer_email', 'dealer_website', 'inventory_url',
      'scanner_type', 'listing_location', 'license_number', 'compliance_mode',
      // Phase 1 new fields
      'booking_link', 'instagram_handle', 'primary_cta', 'dealership_website',
      'default_seller_name', 'trades_welcome', 'financing_cta',
      'delivery_available', 'carfax_mention', 'active_disclaimer', 'logo_url',
    ];

    const updates = {};
    for (const field of allowed) {
      if (field in body) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.updated_at = new Date().toISOString();

    // Determine the lookup key — prefer auth UID, fallback to email
    let upsertData;
    if (authUid) {
      upsertData = { id: authUid, email: email || body.email?.toLowerCase(), ...updates };
    } else {
      // We need the profile's UUID to upsert correctly
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle();

      if (existing) {
        upsertData = { id: existing.id, email, ...updates };
      } else {
        // First-time save with no auth UID — create with a new UUID
        const { data: userRow } = await supabase
          .from('users')
          .select('auth_user_id')
          .ilike('email', email)
          .maybeSingle();

        const profileId = userRow?.auth_user_id || requestedId || randomUUID();
        upsertData = { id: profileId, email, ...updates };
      }
    }

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
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
