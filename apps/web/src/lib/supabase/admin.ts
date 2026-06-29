import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. Bypasses RLS entirely. Server-only.
 *
 * Use this **only** in trusted server contexts that need to perform
 * privileged writes — chiefly:
 *   - Stripe webhook handler (updating profiles.subscription)
 *   - Any future admin/back-office endpoints
 *
 * Never import from a Client Component or expose its key. The
 * SUPABASE_SERVICE_ROLE_KEY env var is server-only (no NEXT_PUBLIC_ prefix).
 */

let _admin: ReturnType<typeof createClient> | null = null

export function getAdminClient() {
  if (_admin) return _admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase admin client missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  _admin = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  return _admin
}
