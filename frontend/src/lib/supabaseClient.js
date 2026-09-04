import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null