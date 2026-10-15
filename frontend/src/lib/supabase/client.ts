import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim()

function isValidSupabaseUrl(value: string | undefined): value is string {
  if (!value) return false

  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === 'localhost'
    )
  } catch {
    return false
  }
}

export const isSupabaseConfigured = Boolean(
  isValidSupabaseUrl(supabaseUrl) &&
  supabasePublishableKey &&
  !supabasePublishableKey.startsWith('replace-with-'),
)

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
