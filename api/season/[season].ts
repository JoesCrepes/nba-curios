/**
 * Vercel Edge Function — /api/season/[season]
 *
 * Proxies a single season's player stats from stats.nba.com and returns them
 * as a standardised PlayerSeason[] JSON array.
 *
 * Cache strategy:
 *   - Historical seasons (before the current one): s-maxage=31536000 (1 year)
 *   - Current season: s-maxage=3600, stale-while-revalidate=86400
 *
 * Because this is an Edge Function, requests originate from Vercel's globally
 * distributed edge PoPs rather than a single AWS Lambda region, which reduces
 * the chance of IP-based throttling by stats.nba.com.
 */

export const config = { runtime: 'edge' }

const CURRENT_SEASON = '2024-25'
const SEASON_RE = /^\d{4}-\d{2}$/

/** Headers that make the request look like a real browser visiting nba.com */
const NBA_HEADERS: Record<string, string> = {
  Host: 'stats.nba.com',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  Origin: 'https://www.nba.com',
  Referer: 'https://www.nba.com/',
  'Sec-Fetch-Site': 'same-site',
  'Sec-Fetch-Mode': 'cors',
  Connection: 'keep-alive',
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  })
}

function buildUrl(season: string): string {
  const p = new URLSearchParams({
    College: '', Conference: '', Country: '',
    DateFrom: '', DateTo: '', Division: '',
    DraftPick: '', DraftYear: '', GameScope: '', GameSegment: '',
    Height: '', LastNGames: '0', LeagueID: '00', Location: '',
    MeasureType: 'Base', Month: '0', OpponentTeamID: '0',
    Outcome: '', PORound: '', PaceAdjust: 'N',
    PerMode: 'Totals', Period: '0', PlayerExperience: '',
    PlayerPosition: '', PlusMinus: 'N', Rank: 'N',
    Season: season, SeasonSegment: '',
    SeasonType: 'Regular Season', ShotClockRange: '',
    StarterBench: '', TeamID: '', TwoWay: '',
    VsConference: '', VsDivision: '', Weight: '',
  })
  return `https://stats.nba.com/stats/leaguedashplayerstats?${p}`
}

interface PlayerSeason {
  id: number; name: string; season: string; team: string; pos: string; gp: number
  fgm: number; fga: number; fg_pct: number
  fg3m: number; fg3a: number; fg3_pct: number
  ftm: number; fta: number; ft_pct: number
  two_pm: number; two_pa: number; two_pct: number
  oreb: number; dreb: number; reb: number
  ast: number; stl: number; blk: number; pts: number; tov: number
}

function parseRows(headers: string[], rowSet: unknown[][]): PlayerSeason[] {
  const col = (name: string) => headers.indexOf(name)
  const num = (row: unknown[], name: string) => Number(row[col(name)] ?? 0)
  const str = (row: unknown[], name: string) => String(row[col(name)] ?? '')

  return rowSet.map((row) => {
    const fgm = num(row, 'FGM'), fga = num(row, 'FGA')
    const fg3m = num(row, 'FG3M'), fg3a = num(row, 'FG3A')
    const gp = Math.max(1, num(row, 'GP'))
    const two_pm = fgm - fg3m, two_pa = fga - fg3a
    return {
      id: num(row, 'PLAYER_ID'), name: str(row, 'PLAYER_NAME'),
      season: '', // filled in by caller
      team: str(row, 'TEAM_ABBREVIATION'), pos: str(row, 'PLAYER_POSITION'), gp,
      fgm, fga, fg_pct: num(row, 'FG_PCT'),
      fg3m, fg3a, fg3_pct: num(row, 'FG3_PCT'),
      ftm: num(row, 'FTM'), fta: num(row, 'FTA'), ft_pct: num(row, 'FT_PCT'),
      two_pm, two_pa,
      two_pct: two_pa > 0 ? Math.round((two_pm / two_pa) * 10000) / 10000 : 0,
      oreb: num(row, 'OREB'), dreb: num(row, 'DREB'), reb: num(row, 'REB'),
      ast: num(row, 'AST'), stl: num(row, 'STL'), blk: num(row, 'BLK'),
      pts: num(row, 'PTS'), tov: num(row, 'TOV'),
    }
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const season = new URL(req.url).pathname.split('/').pop() ?? ''
  if (!SEASON_RE.test(season)) {
    return json({ error: 'Invalid season. Use YYYY-YY format, e.g. 2023-24' }, 400)
  }

  let nbaRes: Response
  try {
    nbaRes = await fetch(buildUrl(season), { headers: NBA_HEADERS })
  } catch (err) {
    return json({ error: 'Could not reach stats.nba.com', detail: String(err) }, 502)
  }

  if (!nbaRes.ok) {
    return json({ error: `NBA API returned ${nbaRes.status}` }, 502)
  }

  let body: { resultSets?: Array<{ name: string; headers: string[]; rowSet: unknown[][] }> }
  try {
    body = await nbaRes.json()
  } catch {
    return json({ error: 'NBA API returned unparseable JSON' }, 502)
  }

  const resultSet = body.resultSets?.find((s) => s.name === 'LeagueDashPlayerStats')
  if (!resultSet) return json({ error: 'LeagueDashPlayerStats missing from response' }, 502)

  const players = parseRows(resultSet.headers, resultSet.rowSet)
  players.forEach((p) => { p.season = season })

  const isCurrentSeason = season === CURRENT_SEASON
  const maxAge = isCurrentSeason ? 3600 : 31536000
  const cacheHeader = `public, s-maxage=${maxAge}, stale-while-revalidate=86400`

  return json(players, 200, { 'Cache-Control': cacheHeader })
}
