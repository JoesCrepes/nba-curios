/**
 * Season data loader — module-level cache + concurrent fetch helpers.
 *
 * The cache lives outside of React state so it persists across renders and
 * SPA navigation without re-fetching.  React components read it by tracking
 * a version counter that increments whenever a new season lands.
 */

import type { PlayerSeason } from '../types'

// ─── Season list ──────────────────────────────────────────────────────────────

/** All seasons with reliable stats data, newest first. */
export const ALL_SEASONS: string[] = (() => {
  const out: string[] = []
  for (let y = 2024; y >= 1996; y--) out.push(`${y}-${String(y + 1).slice(-2)}`)
  return out
})()

export const CURRENT_SEASON = ALL_SEASONS[0]  // '2024-25'

// ─── Module-level cache ───────────────────────────────────────────────────────

const dataCache = new Map<string, PlayerSeason[]>()
const inFlight  = new Map<string, Promise<PlayerSeason[]>>()

export function getCached(season: string): PlayerSeason[] | undefined {
  return dataCache.get(season)
}

export function getAllCached(): PlayerSeason[] {
  const rows: PlayerSeason[] = []
  for (const r of dataCache.values()) rows.push(...r)
  return rows
}

export function cachedSeasonCount(): number {
  return dataCache.size
}

// ─── Single season fetch ──────────────────────────────────────────────────────

export async function loadSeason(season: string): Promise<PlayerSeason[]> {
  if (dataCache.has(season)) return dataCache.get(season)!
  if (inFlight.has(season))  return inFlight.get(season)!

  const promise = fetch(`/api/season/${season}`)
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as PlayerSeason[]
      dataCache.set(season, data)
      inFlight.delete(season)
      return data
    })
    .catch((err) => {
      inFlight.delete(season)
      throw err
    })

  inFlight.set(season, promise)
  return promise
}

// ─── Concurrent batch loader ──────────────────────────────────────────────────

/**
 * Load `seasons` with at most `concurrency` in-flight requests at a time.
 * `onSeasonLoaded` is called after each season resolves (or errors).
 * Already-cached seasons are skipped.
 */
export async function loadSeasonsConcurrent(
  seasons: string[],
  onSeasonLoaded: (season: string, ok: boolean) => void,
  concurrency = 3,
): Promise<void> {
  const queue = seasons.filter((s) => !dataCache.has(s))
  if (queue.length === 0) return

  const iter = queue[Symbol.iterator]()

  async function worker(): Promise<void> {
    for (const season of iter) {
      try {
        await loadSeason(season)
        onSeasonLoaded(season, true)
      } catch {
        onSeasonLoaded(season, false)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, worker),
  )
}
