// backend/lib/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js'

let client = null

export function getSupabaseAdmin() {
  if (client) return client

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY

  if (!url || !key) {
    throw new Error('SUPABASE_URL and/or SUPABASE_SECRET_KEY not set.')
  }

  client = createClient(url, key)
  return client
}