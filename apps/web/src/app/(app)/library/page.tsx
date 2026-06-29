import { createClient } from '@/lib/supabase/server'
import { LibraryClient } from './LibraryClient'

export const metadata = { title: 'My Library' }

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: userBooks } = await supabase
    .from('user_books')
    .select(`
      *,
      book:books(*)
    `)
    .eq('user_id', user!.id)
    .order('date_added', { ascending: false })

  const { data: stats } = await supabase
    .from('user_reading_stats')
    .select('*')
    .eq('user_id', user!.id)
    .single()

  return <LibraryClient initialBooks={userBooks ?? []} stats={stats} />
}
