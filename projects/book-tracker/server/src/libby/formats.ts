export type BookFormat = 'audiobook' | 'ebook'

// OverDrive format ids, as seen across Libby/OverDrive reference clients
// (odmpy, libby-calibre-plugin). Not exhaustive -- add ids here if a title
// shows a format that classifyFormatId() can't place.
const AUDIOBOOK_FORMAT_IDS = new Set(['audiobook-overdrive', 'audiobook-mp3'])
const EBOOK_FORMAT_IDS = new Set([
  'ebook-overdrive',
  'ebook-epub-adobe',
  'ebook-epub-open',
  'ebook-pdf-adobe',
  'ebook-pdf-open',
  'ebook-kindle',
  'ebook-kobo',
])

export function classifyFormatId(formatId: string): BookFormat | 'other' {
  if (AUDIOBOOK_FORMAT_IDS.has(formatId)) return 'audiobook'
  if (EBOOK_FORMAT_IDS.has(formatId)) return 'ebook'
  return 'other'
}

export function formatQueryParam(format: BookFormat): string {
  return format === 'audiobook' ? 'audiobook-overdrive' : 'ebook-overdrive'
}

export function hasFormat(formats: { id: string }[] | undefined, wanted: BookFormat): boolean {
  return (formats ?? []).some((f) => classifyFormatId(f.id) === wanted)
}
