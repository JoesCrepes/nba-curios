/**
 * Natural language query parser for NBA stat questions.
 * Keyword/regex based — no LLM required.
 * Mirrors the logic in projects/nba-stat-queries/query.py.
 */

import type { PlayerSeason } from '../types'

// ─── Stat definitions ────────────────────────────────────────────────────────

export type StatKey =
  | '2P_PCT' | 'FG_PCT' | 'FG3_PCT' | 'FT_PCT'
  | 'PTS' | 'AST' | 'REB' | 'OREB' | 'DREB'
  | 'STL' | 'BLK' | 'TOV'

export interface StatDef {
  key: StatKey
  label: string
  /** Column on PlayerSeason used for the main value */
  getValue: (p: PlayerSeason) => number
  /** Column used for min-attempts filter (null = no filter) */
  getAttempts: ((p: PlayerSeason) => number) | null
  defaultMinAttempts: number
  /** True = lowest value is "best" (e.g. turnovers) */
  ascendingIsBest: boolean
  /** True = show as percentage */
  isPercent: boolean
  /** Extra columns to show alongside the main stat */
  extraCols: Array<{ label: string; getValue: (p: PlayerSeason) => number; isInt?: boolean }>
}

export const STAT_DEFS: Record<StatKey, StatDef> = {
  '2P_PCT': {
    key: '2P_PCT',
    label: 'Two-Point FG%',
    getValue: (p) => p.two_pct,
    getAttempts: (p) => p.two_pa,
    defaultMinAttempts: 200,
    ascendingIsBest: false,
    isPercent: true,
    extraCols: [
      { label: '2PM', getValue: (p) => p.two_pm, isInt: true },
      { label: '2PA', getValue: (p) => p.two_pa, isInt: true },
    ],
  },
  'FG_PCT': {
    key: 'FG_PCT',
    label: 'Field Goal %',
    getValue: (p) => p.fg_pct,
    getAttempts: (p) => p.fga,
    defaultMinAttempts: 300,
    ascendingIsBest: false,
    isPercent: true,
    extraCols: [
      { label: 'FGM', getValue: (p) => p.fgm, isInt: true },
      { label: 'FGA', getValue: (p) => p.fga, isInt: true },
    ],
  },
  'FG3_PCT': {
    key: 'FG3_PCT',
    label: 'Three-Point FG%',
    getValue: (p) => p.fg3_pct,
    getAttempts: (p) => p.fg3a,
    defaultMinAttempts: 100,
    ascendingIsBest: false,
    isPercent: true,
    extraCols: [
      { label: '3PM', getValue: (p) => p.fg3m, isInt: true },
      { label: '3PA', getValue: (p) => p.fg3a, isInt: true },
    ],
  },
  'FT_PCT': {
    key: 'FT_PCT',
    label: 'Free Throw %',
    getValue: (p) => p.ft_pct,
    getAttempts: (p) => p.fta,
    defaultMinAttempts: 100,
    ascendingIsBest: false,
    isPercent: true,
    extraCols: [
      { label: 'FTM', getValue: (p) => p.ftm, isInt: true },
      { label: 'FTA', getValue: (p) => p.fta, isInt: true },
    ],
  },
  'PTS': {
    key: 'PTS',
    label: 'Points / Game',
    getValue: (p) => p.pts / p.gp,
    getAttempts: null,
    defaultMinAttempts: 0,
    ascendingIsBest: false,
    isPercent: false,
    extraCols: [{ label: 'Total', getValue: (p) => p.pts, isInt: true }],
  },
  'AST': {
    key: 'AST',
    label: 'Assists / Game',
    getValue: (p) => p.ast / p.gp,
    getAttempts: null,
    defaultMinAttempts: 0,
    ascendingIsBest: false,
    isPercent: false,
    extraCols: [{ label: 'Total', getValue: (p) => p.ast, isInt: true }],
  },
  'REB': {
    key: 'REB',
    label: 'Rebounds / Game',
    getValue: (p) => p.reb / p.gp,
    getAttempts: null,
    defaultMinAttempts: 0,
    ascendingIsBest: false,
    isPercent: false,
    extraCols: [{ label: 'Total', getValue: (p) => p.reb, isInt: true }],
  },
  'OREB': {
    key: 'OREB',
    label: 'Off. Rebounds / Game',
    getValue: (p) => p.oreb / p.gp,
    getAttempts: null,
    defaultMinAttempts: 0,
    ascendingIsBest: false,
    isPercent: false,
    extraCols: [{ label: 'Total', getValue: (p) => p.oreb, isInt: true }],
  },
  'DREB': {
    key: 'DREB',
    label: 'Def. Rebounds / Game',
    getValue: (p) => p.dreb / p.gp,
    getAttempts: null,
    defaultMinAttempts: 0,
    ascendingIsBest: false,
    isPercent: false,
    extraCols: [{ label: 'Total', getValue: (p) => p.dreb, isInt: true }],
  },
  'STL': {
    key: 'STL',
    label: 'Steals / Game',
    getValue: (p) => p.stl / p.gp,
    getAttempts: null,
    defaultMinAttempts: 0,
    ascendingIsBest: false,
    isPercent: false,
    extraCols: [{ label: 'Total', getValue: (p) => p.stl, isInt: true }],
  },
  'BLK': {
    key: 'BLK',
    label: 'Blocks / Game',
    getValue: (p) => p.blk / p.gp,
    getAttempts: null,
    defaultMinAttempts: 0,
    ascendingIsBest: false,
    isPercent: false,
    extraCols: [{ label: 'Total', getValue: (p) => p.blk, isInt: true }],
  },
  'TOV': {
    key: 'TOV',
    label: 'Turnovers / Game',
    getValue: (p) => p.tov / p.gp,
    getAttempts: null,
    defaultMinAttempts: 0,
    ascendingIsBest: true,
    isPercent: false,
    extraCols: [{ label: 'Total', getValue: (p) => p.tov, isInt: true }],
  },
}

// ─── Position mapping ─────────────────────────────────────────────────────────

/** NBA API position codes in the data */
export const POSITION_CODES: Record<string, string[]> = {
  guard:   ['G', 'G-F', 'F-G'],
  forward: ['F', 'F-G', 'G-F', 'F-C', 'C-F'],
  center:  ['C', 'C-F', 'F-C'],
}

export type PositionFilter = 'all' | 'guard' | 'forward' | 'center'

// ─── Parsed query result ──────────────────────────────────────────────────────

export interface ParsedQuery {
  statKey: StatKey
  ascending: boolean       // false = highest first
  position: PositionFilter
  season: string | null    // null = all seasons
}

// ─── Pattern tables ───────────────────────────────────────────────────────────

const STAT_PATTERNS: Array<[RegExp, StatKey]> = [
  [/two.?point|2.?pt?%?|\b2p\b|2-point/i,           '2P_PCT'],
  [/three.?point|3.?pt?%?|\b3p\b|3-point|triples?|arc/i, 'FG3_PCT'],
  [/free.?throw|ft%?|\bfta?\b|charity|from the line/i,   'FT_PCT'],
  [/field.?goal|fg%?|\bfgm?\b|shooting%/i,               'FG_PCT'],
  [/\bpoints?\b|\bscoring\b|\bppg\b/i,                   'PTS'],
  [/\bassists?\b|\bdimes?\b|\bapg\b|playmaking/i,         'AST'],
  [/offensive.?reb|\boreb\b/i,                            'OREB'],
  [/defensive.?reb|\bdreb\b/i,                            'DREB'],
  [/\brebounds?\b|\bboards?\b|\brpg\b/i,                  'REB'],
  [/\bsteals?\b|\bspg\b/i,                                'STL'],
  [/\bblocks?\b|\bbpg\b|rejections?/i,                    'BLK'],
  [/\bturnovers?\b|\btov\b/i,                             'TOV'],
]

const DESCENDING_PATTERN = /highest|best|most|top|greatest|leader|record|most ever/i
const ASCENDING_PATTERN  = /lowest|worst|fewest|least|minimum/i

const POSITION_PATTERNS: Array<[RegExp, PositionFilter]> = [
  [/point.?guard|\bpg\b/i,          'guard'],
  [/shooting.?guard|\bsg\b/i,       'guard'],
  [/small.?forward|\bsf\b/i,        'forward'],
  [/power.?forward|\bpf\b/i,        'forward'],
  [/\bcenters?\b|\bpivots?\b|\bbig.?men?\b|\bbigs?\b/i, 'center'],
  [/\bguards?\b|\bwings?\b/i,       'guard'],
  [/\bforwards?\b/i,                'forward'],
]

const SEASON_PATTERNS: Array<[RegExp, string]> = [
  [/this season|current season|2024.?25/i,  '2024-25'],
  [/last season|2023.?24/i,                  '2023-24'],
  [/2022.?23/i,                              '2022-23'],
  [/2021.?22/i,                              '2021-22'],
  [/2020.?21/i,                              '2020-21'],
  [/2019.?20/i,                              '2019-20'],
  [/2018.?19/i,                              '2018-19'],
  [/2017.?18/i,                              '2017-18'],
  [/2016.?17/i,                              '2016-17'],
  [/2015.?16/i,                              '2015-16'],
  [/2014.?15/i,                              '2014-15'],
  [/2013.?14/i,                              '2013-14'],
  [/2012.?13/i,                              '2012-13'],
]

// ─── Main parse function ──────────────────────────────────────────────────────

export function parseQuery(query: string): ParsedQuery {
  const q = query.trim()

  // Stat
  let statKey: StatKey = '2P_PCT'
  for (const [pattern, key] of STAT_PATTERNS) {
    if (pattern.test(q)) {
      statKey = key
      break
    }
  }

  // Sort direction
  const statDef = STAT_DEFS[statKey]
  let ascending = statDef.ascendingIsBest
  if (DESCENDING_PATTERN.test(q)) ascending = false
  if (ASCENDING_PATTERN.test(q))  ascending = true

  // Position
  let position: PositionFilter = 'all'
  for (const [pattern, pos] of POSITION_PATTERNS) {
    if (pattern.test(q)) {
      position = pos
      break
    }
  }

  // Season
  let season: string | null = null
  for (const [pattern, s] of SEASON_PATTERNS) {
    if (pattern.test(q)) {
      season = s
      break
    }
  }

  return { statKey, ascending, position, season }
}

// ─── Filter + sort ────────────────────────────────────────────────────────────

export function applyQuery(
  data: PlayerSeason[],
  parsed: ParsedQuery,
  minAttempts: number,
  seasonOverride: string | null,
): PlayerSeason[] {
  const def = STAT_DEFS[parsed.statKey]
  const effectiveSeason = seasonOverride ?? parsed.season
  const positionCodes = parsed.position === 'all' ? null : POSITION_CODES[parsed.position]

  let rows = data

  // Season filter
  if (effectiveSeason) {
    rows = rows.filter((p) => p.season === effectiveSeason)
  }

  // Position filter
  if (positionCodes) {
    rows = rows.filter((p) => positionCodes.includes(p.pos))
  }

  // Min attempts filter
  if (def.getAttempts && minAttempts > 0) {
    rows = rows.filter((p) => def.getAttempts!(p) >= minAttempts)
  }

  // Remove invalid values (zero-division, NaN, etc.)
  rows = rows.filter((p) => {
    const v = def.getValue(p)
    return isFinite(v) && !isNaN(v) && v > 0
  })

  // Sort
  rows = [...rows].sort((a, b) => {
    const va = def.getValue(a)
    const vb = def.getValue(b)
    return parsed.ascending ? va - vb : vb - va
  })

  return rows
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function fmtStat(value: number, isPercent: boolean): string {
  if (isPercent) return (value * 100).toFixed(1) + '%'
  return value.toFixed(1)
}

export function describeQuery(parsed: ParsedQuery, minAttempts: number, seasonOverride: string | null): string {
  const def = STAT_DEFS[parsed.statKey]
  const direction = parsed.ascending ? 'Lowest' : 'Highest'
  const pos = parsed.position === 'all' ? 'all positions' : parsed.position + 's'
  const season = (seasonOverride ?? parsed.season) ?? 'all seasons (1996-97 → present)'
  const minStr = minAttempts > 0 ? ` · min ${minAttempts} attempts` : ''
  return `${direction} ${def.label} · ${pos} · ${season}${minStr}`
}
