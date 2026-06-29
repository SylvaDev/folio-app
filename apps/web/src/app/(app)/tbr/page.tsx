import { createClient } from '@/lib/supabase/server'
import { TBRClient } from './TBRClient'

export const metadata = { title: 'TBR Queue' }

export default async function TBRPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: userBooks } = await supabase
    .from('user_books')
    .select('*, book:books(*)')
    .eq('user_id', user!.id)
    .eq('status', 'tbr')
    .order('priority', { ascending: false })
    .order('date_added', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription')
    .eq('id', user!.id)
    .single()

  const subscription = (profile?.subscription ?? 'free') as 'free' | 'pro' | 'book_club'

  return <TBRClient initialBooks={userBooks ?? []} subscription={subscription} />
}
