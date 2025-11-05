import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { SeasonData, ForecastScenario } from '../types';
import './TrajectoryChart.css';

interface SeasonDataWithKey extends SeasonData {
  key: string;
}

interface TrajectoryChartProps {
  seasons: SeasonDataWithKey[];
  forecasts: Map<string, ForecastScenario[]>;
}

const TEAM_COLORS: Record<string, string> = {
  'GSW': '#FFC72C',  // Warriors gold
  'CHI': '#CE1141',  // Bulls red
  'OKC': '#007AC1',  // Thunder blue
};

const FORECAST_COLORS = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];

export default function TrajectoryChart({ seasons, forecasts }: TrajectoryChartProps) {
  // Combine all data into a unified chart format
  const chartData = generateChartData(seasons, forecasts);

  if (seasons.length === 0) {
    return (
      <div className="chart-container">
        <div className="empty-state">
          Select at least one season to view trajectories
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h3>Season Win Trajectories</h3>
      <ResponsiveContainer width="100%" height={500}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="game"
            stroke="#888"
            label={{ value: 'Game Number', position: 'insideBottom', offset: -10, fill: '#888' }}
          />
          <YAxis
            stroke="#888"
            label={{ value: 'Cumulative Wins', angle: -90, position: 'insideLeft', fill: '#888' }}
            domain={[0, 82]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff'
            }}
            labelStyle={{ color: '#888' }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />

          {/* Render actual season lines */}
          {seasons.map(season => (
            <Line
              key={season.key}
              type="monotone"
              dataKey={season.key}
              name={season.label}
              stroke={TEAM_COLORS[season.team] || '#888'}
              strokeWidth={3}
              dot={false}
              connectNulls
            />
          ))}

          {/* Render forecast lines */}
          {Array.from(forecasts.entries()).map(([seasonKey, scenarioList]) => {
            return scenarioList.map((scenario, scenarioIdx) => (
              <Line
                key={`${seasonKey}-forecast-${scenarioIdx}`}
                type="monotone"
                dataKey={`${seasonKey}-forecast-${scenarioIdx}`}
                name={`${scenario.name}`}
                stroke={FORECAST_COLORS[scenarioIdx % FORECAST_COLORS.length]}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls
              />
            ));
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Forecast legend */}
      {forecasts.size > 0 && (
        <div className="forecast-info">
          <h4>Forecast Scenarios</h4>
          <p>Dotted lines show projected trajectories for in-progress seasons based on different finish scenarios.</p>
        </div>
      )}
    </div>
  );
}

function generateChartData(seasons: SeasonDataWithKey[], forecasts: Map<string, ForecastScenario[]>) {
  const data: Record<string, any>[] = [];

  // Create data points for all 82 games
  for (let game = 1; game <= 82; game++) {
    const point: Record<string, any> = { game };

    // Add actual data for each season
    seasons.forEach(season => {
      const gameData = season.games.find(g => g.game_num === game);
      if (gameData) {
        point[season.key] = gameData.wins;
      }
    });

    // Add forecast data
    forecasts.forEach((scenarioList, seasonKey) => {
      scenarioList.forEach((scenario, idx) => {
        const forecastGame = scenario.games.find(g => g.game_num === game);
        if (forecastGame) {
          point[`${seasonKey}-forecast-${idx}`] = forecastGame.wins;
        }
      });
    });

    data.push(point);
  }

  return data;
}
