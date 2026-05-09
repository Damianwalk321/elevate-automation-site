import { supabase } from '../lib/supabase.js';
import { requireVerifiedDashboardUser, getTrustedIdentity, requireVerifiedUser } from './_shared/auth.js';
import {
  CANONICAL_PROFILE_TABLE,
  LEGACY_PROFILE_TABLES,
  canonicalIdentityMeta,
  buildCanonicalProfileSnapshot,
  profileSetupFields,
} from '../_shared/canonical-state.js';

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

function buildProfileResponse({ verifiedUser = null, trustedIdentity = null, profile = null, requestedId = '', requestedEmail = '' } = {}) {
  const identity = canonicalIdentityMeta({
    verifiedUser,
    trustedIdentity,
    requestedId,
    requestedEmail,
  });

  const canonicalProfile = profile
    ? buildCanonicalProfileSnapshot({
        id: identity.id || verifiedUser?.id || '',
        email: identity.email || verifiedUser?.email || '',
      }, profile)
    : null;

  return {
    profile: canonicalProfile,
    canonical_profile_table: CANONICAL_PROFILE_TABLE,
    legacy_profile_tables: [...LEGACY_PROFILE_TABLES],
    identity_source: identity.identity_source,
    matched_by: identity.matched_by,
    setup_fields: canonicalProfile ? profileSetupFields(canonicalProfile) : null,
  };
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

    const requestedId = clean(req.query.id || req.body?.id || req.body?.user_id || '');
    const requestedEmail = normalizeEmail(req.query.email || req.body?.email || '');
    const identity = canonicalIdentityMeta({
      verifiedUser,
      trustedIdentity: trusted,
      requestedId,
      requestedEmail,
    });

    if (!identity.id && !identity.email) {
      return res.status(400).json({ error: 'No identity provided' });
    }

    if (req.method === 'GET') {
      let query = supabase.from(CANONICAL_PROFILE_TABLE).select('*');

      if (identity.matched_by === 'id' && identity.id) {
        query = query.eq('id', identity.id);
      } else {
        query = query.ilike('email', identity.email);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('[profile GET] Supabase error:', error.message);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(
        buildProfileResponse({
          verifiedUser,
          trustedIdentity: trusted,
          profile: data || null,
          requestedId,
          requestedEmail: identity.email,
        })
      );
    }

    const updates = pickAllowedUpdates(req.body || {});
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    if (!identity.id) {
      return res.status(401).json({ error: 'Unauthorized', requires_auth: true });
    }

    updates.updated_at = new Date().toISOString();

    const upsertData = {
      id: identity.id,
      email: identity.email,
      ...updates,
    };

    const { data, error } = await supabase
      .from(CANONICAL_PROFILE_TABLE)
      .upsert(upsertData, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('[profile POST] Supabase error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[profile POST] Saved canonical profile for ${identity.email || identity.id} at ${data.updated_at}`);
    return res.status(200).json({
      success: true,
      ...buildProfileResponse({
        verifiedUser,
        trustedIdentity: trusted,
        profile: data,
        requestedId,
        requestedEmail: identity.email,
      })
    });
  } catch (error) {
    console.error('[profile] fatal error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
