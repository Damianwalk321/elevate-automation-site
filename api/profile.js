import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {

  if (req.method === 'POST') {

    const {
      id,
      email,
      full_name,
      dealership,
      city,
      province,
      phone,
      license_number,
      listing_location
    } = req.body

    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id,
        email,
        full_name,
        dealership,
        city,
        province,
        phone,
        license_number,
        listing_location
      })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true, data })
  }

  if (req.method === 'GET') {

    const { id } = req.query

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ data })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
