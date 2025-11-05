export interface Game {
  game_num: number;
  date: string;
  matchup: string;
  wl: 'W' | 'L';
  wins: number;
  losses: number;
  pts_for: number;
  pts_against: number | null;
  win_pct: number;
}

export interface SeasonData {
  team: string;
  season: string;
  label: string;
  description: string;
  is_current: boolean;
  fetched_at: string;
  games: Game[];
  final_record: string;
}

export interface ForecastScenario {
  name: string;
  projectedWins: number;
  projectedRecord: string;
  games: Array<{
    game_num: number;
    wins: number;
    isProjected: true;
  }>;
}
