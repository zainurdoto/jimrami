import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL

const supabasePublishableKey =
  import.meta.env
    .VITE_SUPABASE_PUBLISHABLE_KEY

export const cloudConfigured =
  Boolean(
    supabaseUrl &&
    supabasePublishableKey
  )

export const supabase:
  SupabaseClient | null =
  cloudConfigured
    ? createClient(
        supabaseUrl,
        supabasePublishableKey
      )
    : null

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Cloud sync is not configured.'
    )
  }

  return supabase
}