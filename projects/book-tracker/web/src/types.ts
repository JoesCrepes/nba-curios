export type EditionFormat = 'audiobook' | 'ebook' | 'physical' | 'other'
export type ReadStatus = 'want_to_read' | 'reading' | 'read' | 'on_hold' | 'dnf'
export type BookFormat = 'audiobook' | 'ebook'

export interface Author {
  id: number
  name: string
}

export interface Edition {
  id: number
  book_id: number
  format: EditionFormat
  isbn_10: string | null
  isbn_13: string | null
  asin: string | null
  audio_seconds: number | null
  publisher: string | null
  release_date: string | null
  narrators: string | null
}

export interface UserBook {
  id: number
  book_id: number
  status: ReadStatus
  preferred_format: 'audiobook' | 'ebook' | 'physical' | null
  rating: number | null
  review: string | null
  notes: string | null
  started_at: string | null
  finished_at: string | null
  added_at: string
  updated_at: string
}

export interface Book {
  id: number
  hardcover_id: number | null
  title: string
  subtitle: string | null
  description: string | null
  cover_image_url: string | null
  release_date: string | null
  pages: number | null
  series_name: string | null
  series_position: number | null
  compilation: number
  authors: Author[]
  editions: Edition[]
  userBook: UserBook | null
}

export interface Library {
  id: number
  name: string
  library_key: string
  website_id: number | null
  is_active: number
  account_label?: string
  last_synced_at?: string | null
}

export interface AvailabilityResult {
  libraryId: number
  libraryName: string
  found: boolean
  overdriveTitleId?: string
  isOwned?: boolean
  isAvailable?: boolean
  ownedCopies?: number | null
  availableCopies?: number | null
  holdsCount?: number | null
  estimatedWaitDays?: number | null
  error?: string
}

export interface AvailabilityCheck {
  id: number
  book_id: number
  edition_format: BookFormat
  library_id: number
  library_name: string
  overdrive_title_id: string | null
  is_owned: number
  is_available: number
  owned_copies: number | null
  available_copies: number | null
  holds_count: number | null
  estimated_wait_days: number | null
  checked_at: string
}
