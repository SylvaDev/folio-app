import { createClient } from '@/lib/supabase/server'
import { FeedClient } from './FeedClient'

export const metadata = { title: 'Feed' }

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <FeedClient viewerId={user?.id ?? null} />
}
