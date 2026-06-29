import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. Bypasses RLS entirely. Server-only.
 *
 * Use this **only** in trusted server contexts that need to perform
 * privileged writes — chiefly:
 *   - Stripe webhook handler (updating profiles.subscription)
 *   - Any future admin/back-office endpoints
 *
 * We intentionally don't pass a generated Database type. The admin client
 * writes across many tables (profiles, stripe_events, etc.) and gets used
 * for ad-hoc maintenance work. Strict schema typing here creates more
 * friction than safety — and the runtime is still protected by Postgres
 * constraints + the block_self_billing_writes trigger.
 *
 * Never import from a Client Component or expose its key. The
 * SUPABASE_SERVICE_ROLE_KEY env var is server-only (no NEXT_PUBLIC_ prefix).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDatabase = any

let _admin: SupabaseClient<AnyDatabase> | null = null

export function getAdminClient(): SupabaseClient<AnyDatabase> {
  if (_admin) return _admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase admin client missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  _admin = createClient<AnyDatabase>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  return _admin
}
