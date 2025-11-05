import type { Game, ForecastScenario } from '../types';

/**
 * Generate forecast scenarios for an in-progress season
 */
export function generateForecasts(games: Game[], totalGames: number = 82): ForecastScenario[] {
  const gamesPlayed = games.length;
  const remainingGames = totalGames - gamesPlayed;

  if (remainingGames <= 0) {
    return [];
  }

  const currentWins = games[gamesPlayed - 1]?.wins || 0;
  const currentWinPct = currentWins / gamesPlayed;

  const scenarios: ForecastScenario[] = [];

  // Scenario 1: Current pace (linear extrapolation)
  const linearWins = Math.round(currentWinPct * totalGames);
  scenarios.push({
    name: 'Current Pace',
    projectedWins: linearWins,
    projectedRecord: `${linearWins}-${totalGames - linearWins}`,
    games: generateProjectedGames(currentWins, gamesPlayed, linearWins, totalGames)
  });

  // Scenario 2: Strong finish (75% win rate)
  const strongFinishWins = currentWins + Math.round(remainingGames * 0.75);
  scenarios.push({
    name: 'Strong Finish (75%)',
    projectedWins: strongFinishWins,
    projectedRecord: `${strongFinishWins}-${totalGames - strongFinishWins}`,
    games: generateProjectedGames(currentWins, gamesPlayed, strongFinishWins, totalGames)
  });

  // Scenario 3: Weak finish (50% win rate)
  const weakFinishWins = currentWins + Math.round(remainingGames * 0.50);
  scenarios.push({
    name: 'Average Finish (50%)',
    projectedWins: weakFinishWins,
    projectedRecord: `${weakFinishWins}-${totalGames - weakFinishWins}`,
    games: generateProjectedGames(currentWins, gamesPlayed, weakFinishWins, totalGames)
  });

  // Scenario 4: Win out
  const winOutWins = currentWins + remainingGames;
  scenarios.push({
    name: 'Win Out',
    projectedWins: winOutWins,
    projectedRecord: `${winOutWins}-${totalGames - winOutWins}`,
    games: generateProjectedGames(currentWins, gamesPlayed, winOutWins, totalGames)
  });

  return scenarios;
}

function generateProjectedGames(
  startWins: number,
  startGame: number,
  endWins: number,
  totalGames: number
): Array<{ game_num: number; wins: number; isProjected: true }> {
  const projectedGames = [];
  const remainingGames = totalGames - startGame;
  const winsToAdd = endWins - startWins;

  for (let i = 1; i <= remainingGames; i++) {
    const gameNum = startGame + i;
    const winsAtThisPoint = startWins + Math.round((i / remainingGames) * winsToAdd);
    projectedGames.push({
      game_num: gameNum,
      wins: winsAtThisPoint,
      isProjected: true as const
    });
  }

  return projectedGames;
}
