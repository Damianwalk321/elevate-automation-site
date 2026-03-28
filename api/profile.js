import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    // 🔒 HARD GUARD — prevents silent crashes
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({
        ok: false,
        error: 'Missing Supabase environment variables',
        detail: {
          hasUrl: !!SUPABASE_URL,
          hasKey: !!SUPABASE_KEY
        }
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    if (req.method === 'POST') {
      const body = req.body || {}

      const {
        email,
        full_name,
        dealership,
        city,
        province,
        phone,
        license_number,
        default_location,
        dealer_phone,
        dealer_email,
        compliance_mode,
        dealer_website,
        inventory_url,
        scanner_type
      } = body

      if (!email) {
        return res.status(400).json({
          ok: false,
          error: 'Email is required'
        })
      }

      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            email,
            full_name,
            dealership,
            city,
            province,
            phone,
            license_number,
            default_location,
            dealer_phone,
            dealer_email,
            compliance_mode,
            dealer_website,
            inventory_url,
            scanner_type,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'email' }
        )
        .select()

      if (error) {
        return res.status(500).json({
          ok: false,
          error: 'Supabase upsert failed',
          detail: error.message
        })
      }

      return res.status(200).json({
        ok: true,
        profile: data?.[0] || null
      })
    }

    if (req.method === 'GET') {
      const email = req.query.email

      if (!email) {
        return res.status(400).json({
          ok: false,
          error: 'Email required'
        })
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single()

      if (error) {
        return res.status(200).json({
          ok: true,
          profile: null
        })
      }

      return res.status(200).json({
        ok: true,
        profile: data
      })
    }

    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    })

  } catch (err) {
    console.error('PROFILE API CRASH:', err)

    return res.status(500).json({
      ok: false,
      error: 'Server crash',
      detail: err.message
    })
  }
}
