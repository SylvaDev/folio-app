import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'
import { PublicTopBar } from './PublicTopBar'

/**
 * Public profiles must work for both authenticated and unauthenticated visitors:
 *   - Logged-in users see the full AppShell (sidebar nav) so they stay oriented.
 *   - Logged-out users see a slim public top bar with a sign-up CTA — never
 *     stranded without navigation.
 *
 * Auth check happens once here so child pages don't re-query.
 */
export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  // If env vars aren't configured (preview/marketing builds), render public-only
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <>
        <PublicTopBar />
        <main className="min-h-screen bg-cream/30">{children}</main>
      </>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Unauthenticated viewers — public chrome
  if (!user) {
    return (
      <>
        <PublicTopBar />
        <main className="min-h-screen bg-cream/30">{children}</main>
      </>
    )
  }

  // Authenticated viewers — full app chrome
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, subscription, username')
    .eq('id', user.id)
    .single()

  return <AppShell user={user} profile={profile}>{children}</AppShell>
}
