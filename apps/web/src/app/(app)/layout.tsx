import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect('/login')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // First-run gate: every user must pick a username before using the app.
  if (!profile?.username) redirect('/onboarding/username')

  // Evaluate beta access server-side so the badge state is consistent on first paint
  const { hasBetaAccess } = await import('@/lib/beta')
  const betaActive = hasBetaAccess(user.id, profile.beta_access ?? false)

  return (
    <AppShell user={user} profile={profile} betaActive={betaActive}>
      {children}
    </AppShell>
  )
}
