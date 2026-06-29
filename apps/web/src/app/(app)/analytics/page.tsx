import { createClient } from '@/lib/supabase/server'
import { AnalyticsClient } from './AnalyticsClient'

export const metadata = { title: 'Analytics' }

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: userBooks }, { data: sessions }, { data: stats }] = await Promise.all([
    supabase
      .from('user_books')
      .select('*, book:books(title, authors, page_count, genres, first_publish_year)')
      .eq('user_id', user!.id),

    supabase
      .from('reading_sessions')
      .select('*')
      .eq('user_id', user!.id)
      .order('session_date', { ascending: false }),

    supabase
      .from('user_reading_stats')
      .select('*')
      .eq('user_id', user!.id)
      .single(),
  ])

  return (
    <AnalyticsClient
      userBooks={userBooks ?? []}
      sessions={sessions ?? []}
      stats={stats}
    />
  )
}
