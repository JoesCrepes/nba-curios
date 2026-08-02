export interface HardcoverAuthor {
  id: number
  name: string
}

export interface HardcoverEdition {
  id: number
  edition_format: string | null
  reading_format_id: number | null
  isbn_10: string | null
  isbn_13: string | null
  asin: string | null
  audio_seconds: number | null
  release_date: string | null
  publisher: { name: string } | null
  contributions: { author: HardcoverAuthor | null }[] | null
}

export interface HardcoverBook {
  id: number
  title: string
  subtitle: string | null
  description: string | null
  release_date: string | null
  pages: number | null
  compilation: boolean | null
  image: { url: string } | null
  contributions: { author: HardcoverAuthor | null }[] | null
  editions: HardcoverEdition[] | null
}
