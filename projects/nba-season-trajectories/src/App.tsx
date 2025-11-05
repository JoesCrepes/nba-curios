import { useState, useEffect } from 'react';
import type { SeasonData, ForecastScenario } from './types';
import { generateForecasts } from './utils/forecast';
import TrajectoryChart from './components/TrajectoryChart';
import SeasonSelector from './components/SeasonSelector';
import './App.css';

// Add key property to SeasonData for tracking
interface SeasonDataWithKey extends SeasonData {
  key: string;
}

function App() {
  const [availableSeasons, setAvailableSeasons] = useState<SeasonDataWithKey[]>([]);
  const [selectedSeasons, setSelectedSeasons] = useState<Set<string>>(new Set());
  const [forecasts, setForecasts] = useState<Map<string, ForecastScenario[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // Load all available season data files
  useEffect(() => {
    const loadSeasons = async () => {
      try {
        // List of data files to load (based on config)
        const seasonFiles = [
          { file: 'gsw-201516.json', key: 'gsw-201516' },
          { file: 'chi-199596.json', key: 'chi-199596' },
          { file: 'okc-201213.json', key: 'okc-201213' },
          { file: 'okc-202526.json', key: 'okc-202526' },
        ];

        const loadedSeasons = await Promise.all(
          seasonFiles.map(async ({ file, key }) => {
            const response = await fetch(`/data/${file}`);
            const data: SeasonData = await response.json();
            return { ...data, key };
          })
        );

        setAvailableSeasons(loadedSeasons);

        // Auto-select all seasons initially
        const initialSelection = new Set(loadedSeasons.map(s => s.key));
        setSelectedSeasons(initialSelection);

        // Generate forecasts for current seasons
        const forecastMap = new Map<string, ForecastScenario[]>();
        loadedSeasons.forEach(season => {
          if (season.is_current && season.games.length < 82) {
            forecastMap.set(season.key, generateForecasts(season.games));
          }
        });
        setForecasts(forecastMap);

        setLoading(false);
      } catch (error) {
        console.error('Error loading season data:', error);
        setLoading(false);
      }
    };

    loadSeasons();
  }, []);

  const toggleSeason = (key: string) => {
    setSelectedSeasons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const selectedSeasonData = availableSeasons.filter(s =>
    selectedSeasons.has(s.key)
  );

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading season data...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>NBA Season Trajectories</h1>
        <p className="subtitle">
          Comparing win progression across historic and current seasons
        </p>
      </header>

      <main className="main">
        <SeasonSelector
          seasons={availableSeasons}
          selected={selectedSeasons}
          onToggle={toggleSeason}
        />

        <TrajectoryChart
          seasons={selectedSeasonData}
          forecasts={forecasts}
        />

        <div className="info">
          <h3>About</h3>
          <p>
            This visualization tracks cumulative wins across the season for notable NBA teams.
            For current seasons, dotted lines show projected trajectories based on different
            finish scenarios.
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
