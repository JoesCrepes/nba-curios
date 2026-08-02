import type { AvailabilityCheck, AvailabilityResult, Book, BookFormat, Library, ReadStatus, UserBook } from './types'

const BASE = '/api'

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...opts.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  search: (q: string) => request<{ results: Book[] }>(`/search?q=${encodeURIComponent(q)}`),

  getBook: (id: number) => request<{ book: Book }>(`/books/${id}`),
  resyncBook: (id: number) => request<{ book: Book }>(`/books/${id}/resync`, { method: 'POST' }),

  listUserBooks: (status?: ReadStatus) => request<{ books: Book[] }>(`/user-books${status ? `?status=${status}` : ''}`),
  upsertUserBook: (bookId: number, data: Partial<UserBook>) =>
    request<{ book: Book }>(`/user-books/${bookId}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeUserBook: (bookId: number) => request<void>(`/user-books/${bookId}`, { method: 'DELETE' }),

  listLibraries: () => request<{ libraries: Library[] }>('/libraries'),
  linkLibrary: (code: string) => request<{ libraries: Library[] }>('/libraries/link', { method: 'POST', body: JSON.stringify({ code }) }),
  resyncLibrary: (id: number) => request<{ ok: boolean; stillLinked: boolean }>(`/libraries/${id}/resync`, { method: 'POST' }),
  removeLibrary: (id: number) => request<void>(`/libraries/${id}`, { method: 'DELETE' }),

  checkAvailability: (bookId: number, format: BookFormat, libraryIds?: number[]) =>
    request<{ results: AvailabilityResult[] }>(`/books/${bookId}/availability`, {
      method: 'POST',
      body: JSON.stringify({ format, libraryIds }),
    }),
  getAvailability: (bookId: number) => request<{ checks: AvailabilityCheck[] }>(`/books/${bookId}/availability`),
}
