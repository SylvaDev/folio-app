export type SubscriptionTier = 'free' | 'pro' | 'book_club'

export interface Profile {
  id: string              // matches auth.users.id
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  reading_goal: number | null    // books per year
  subscription: SubscriptionTier
  subscription_ends_at: string | null
  goodreads_imported: boolean
  onboarding_complete: boolean
  preferred_genres: string[]
  mood_tracking: boolean
  created_at: string
  updated_at: string
}
