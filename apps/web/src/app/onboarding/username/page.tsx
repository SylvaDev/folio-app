import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UsernameOnboarding } from './UsernameOnboarding'

export const metadata = { title: 'Choose your username' }

function suggestFromName(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name || email?.split('@')[0] || '').trim().toLowerCase()
  return source
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
}

export default async function UsernameOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', user.id)
    .single()

  // If they already have one, send them to the app.
  if (profile?.username) redirect('/library')

  const suggestion = suggestFromName(profile?.display_name, user.email)

  return <UsernameOnboarding initialSuggestion={suggestion} displayName={profile?.display_name ?? null} />
}
