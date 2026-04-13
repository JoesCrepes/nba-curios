/** One player's stats for one season, as stored in player_seasons.json */
export interface PlayerSeason {
  id: number
  name: string
  season: string
  team: string
  pos: string
  gp: number
  // Shooting totals (for min-attempts filtering)
  fgm: number
  fga: number
  fg_pct: number
  fg3m: number
  fg3a: number
  fg3_pct: number
  ftm: number
  fta: number
  ft_pct: number
  // Two-point derived totals
  two_pm: number
  two_pa: number
  two_pct: number
  // Counting stat totals (divide by gp for per-game display)
  oreb: number
  dreb: number
  reb: number
  ast: number
  stl: number
  blk: number
  pts: number
  tov: number
}

export interface DataFile {
  meta: {
    fetched_at: string | null
    seasons_covered: string[]
    total_rows: number
    note?: string
  }
  data: PlayerSeason[]
}
