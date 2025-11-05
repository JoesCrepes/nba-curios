import type { SeasonData } from '../types';
import './SeasonSelector.css';

interface SeasonDataWithKey extends SeasonData {
  key: string;
}

interface SeasonSelectorProps {
  seasons: SeasonDataWithKey[];
  selected: Set<string>;
  onToggle: (key: string) => void;
}

const TEAM_COLORS: Record<string, string> = {
  'GSW': '#1D428A',  // Warriors blue
  'CHI': '#CE1141',  // Bulls red
  'OKC': '#007AC1',  // Thunder blue
};

export default function SeasonSelector({ seasons, selected, onToggle }: SeasonSelectorProps) {
  return (
    <div className="season-selector">
      <h3>Select Seasons to Compare</h3>
      <div className="season-grid">
        {seasons.map(season => (
          <button
            key={season.key}
            className={`season-button ${selected.has(season.key) ? 'active' : ''}`}
            onClick={() => onToggle(season.key)}
            style={{
              borderColor: selected.has(season.key) ? TEAM_COLORS[season.team] : '#333'
            }}
          >
            <div className="season-label">{season.label}</div>
            <div className="season-year">{season.season}</div>
            <div className="season-record">{season.final_record}</div>
            {season.is_current && <span className="live-badge">LIVE</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
