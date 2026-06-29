export interface BookClub {
  id: string
  name: string
  description: string | null
  owner_id: string
  cover_url: string | null
  is_public: boolean
  invite_code: string
  member_count: number
  created_at: string
  updated_at: string
}

export interface BookClubMember {
  club_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
  profile?: import('./user').Profile
}

export interface BookClubRead {
  id: string
  club_id: string
  book_id: string
  started_at: string | null
  ends_at: string | null
  status: 'upcoming' | 'active' | 'completed'
  discussion_prompt: string | null
}

export interface Discussion {
  id: string
  club_id: string
  club_read_id: string | null
  user_id: string
  content: string
  parent_id: string | null
  likes: number
  created_at: string
  updated_at: string
}
