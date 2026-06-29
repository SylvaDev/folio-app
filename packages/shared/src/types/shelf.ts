export interface Shelf {
  id: string
  user_id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  is_system: boolean   // TBR, Reading, Read, DNF are system shelves
  book_count: number
  created_at: string
  updated_at: string
}

export interface ShelfBook {
  id: string
  shelf_id: string
  user_book_id: string
  added_at: string
}
