import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { PlayerSeason, DataFile } from '../types'
import {
  parseQuery,
  applyQuery,
  fmtStat,
  describeQuery,
  STAT_DEFS,
  type StatKey,
  type PositionFilter,
} from '../utils/queryParser'
import './TwoPointPct.css'

const EXAMPLE_QUERIES = [
  'highest two-point percentage ever',
  'best free throw shooter guard',
  'most points per game forward',
  'highest 3-point % 2015-16',
  'most assists per game this season',
  'fewest turnovers per game center',
]

const POSITION_OPTIONS: Array<{ value: PositionFilter; label: string }> = [
  { value: 'all',     label: 'All' },
  { value: 'guard',   label: 'Guard' },
  { value: 'forward', label: 'Forward' },
  { value: 'center',  label: 'Center' },
]

const SEASON_OPTIONS = [
  { value: '',        label: 'All seasons' },
  { value: '2024-25', label: '2024-25' },
  { value: '2023-24', label: '2023-24' },
  { value: '2022-23', label: '2022-23' },
  { value: '2021-22', label: '2021-22' },
  { value: '2020-21', label: '2020-21' },
  { value: '2019-20', label: '2019-20' },
  { value: '2018-19', label: '2018-19' },
  { value: '2017-18', label: '2017-18' },
  { value: '2016-17', label: '2016-17' },
  { value: '2015-16', label: '2015-16' },
  { value: '2014-15', label: '2014-15' },
  { value: '2013-14', label: '2013-14' },
  { value: '2012-13', label: '2012-13' },
  { value: '2011-12', label: '2011-12' },
  { value: '2010-11', label: '2010-11' },
  { value: '2009-10', label: '2009-10' },
  { value: '2008-09', label: '2008-09' },
  { value: '2007-08', label: '2007-08' },
  { value: '2006-07', label: '2006-07' },
  { value: '2005-06', label: '2005-06' },
  { value: '2004-05', label: '2004-05' },
  { value: '2003-04', label: '2003-04' },
  { value: '2002-03', label: '2002-03' },
  { value: '2001-02', label: '2001-02' },
  { value: '2000-01', label: '2000-01' },
  { value: '1999-00', label: '1999-00' },
  { value: '1998-99', label: '1998-99' },
  { value: '1997-98', label: '1997-98' },
  { value: '1996-97', label: '1996-97' },
]

type SortState = { col: string; dir: 'asc' | 'desc' }

export default function TwoPointPct() {
  // ── Data loading ────────────────────────────────────────────────────────────
  const [allData, setAllData] = useState<PlayerSeason[] | null>(null)
  const [dataStatus, setDataStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [meta, setMeta] = useState<DataFile['meta'] | null>(null)

  useEffect(() => {
    fetch('/data/player_seasons.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<DataFile>
      })
      .then((json) => {
        setMeta(json.meta)
        if (!json.data || json.data.length === 0) {
          setDataStatus('empty')
        } else {
          setAllData(json.data)
          setDataStatus('ready')
        }
      })
      .catch(() => setDataStatus('error'))
  }, [])

  // ── Query state ─────────────────────────────────────────────────────────────
  const [queryText, setQueryText] = useState('')
  const [positionOverride, setPositionOverride] = useState<PositionFilter | null>(null)
  const [seasonOverride, setSeasonOverride] = useState<string>('')
  const [minAttempts, setMinAttempts] = useState<number | ''>('')
  const [tableSort, setTableSort] = useState<SortState | null>(null)

  const parsed = useMemo(() => parseQuery(queryText), [queryText])

  // When the parsed position changes (from NL), sync the override pill
  const effectivePosition: PositionFilter = positionOverride ?? parsed.position

  const effectiveMin =
    minAttempts !== '' ? minAttempts : STAT_DEFS[parsed.statKey].defaultMinAttempts

  // ── Results ─────────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    if (!allData) return []
    return applyQuery(allData, { ...parsed, position: effectivePosition }, effectiveMin, seasonOverride || null)
  }, [allData, parsed, effectivePosition, effectiveMin, seasonOverride])

  // Table-level secondary sort (clicking headers)
  const displayRows = useMemo(() => {
    if (!tableSort) return results.slice(0, 50)
    const def = STAT_DEFS[parsed.statKey]
    return [...results].sort((a, b) => {
      let va: number, vb: number
      if (tableSort.col === 'stat') {
        va = def.getValue(a); vb = def.getValue(b)
      } else if (tableSort.col === 'gp') {
        va = a.gp; vb = b.gp
      } else {
        return 0
      }
      return tableSort.dir === 'asc' ? va - vb : vb - va
    }).slice(0, 50)
  }, [results, tableSort, parsed.statKey])

  const handleExample = useCallback((ex: string) => {
    setQueryText(ex)
    setPositionOverride(null)
    setSeasonOverride('')
    setMinAttempts('')
    setTableSort(null)
  }, [])

  const handlePositionClick = (pos: PositionFilter) => {
    setPositionOverride(pos === effectivePosition && positionOverride !== null ? null : pos)
    setTableSort(null)
  }

  const toggleSort = (col: string) => {
    setTableSort((prev) =>
      prev?.col === col
        ? { col, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { col, dir: 'desc' }
    )
  }

  const def = STAT_DEFS[parsed.statKey]
  const interpretation = describeQuery(
    { ...parsed, position: effectivePosition },
    effectiveMin,
    seasonOverride || null,
  )

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="tool-page">
      <nav className="tool-nav">
        <Link to="/" className="back-link">← NBA Curios</Link>
      </nav>

      <header className="tool-header">
        <h1>Two-Point % Explorer</h1>
        <p className="tool-subtitle">
          Find the best single-season shooters across the modern era
        </p>
      </header>

      {/* Query input */}
      <div className="query-section">
        <div className="query-input-wrap">
          <input
            className="query-input"
            type="text"
            value={queryText}
            onChange={(e) => {
              setQueryText(e.target.value)
              setPositionOverride(null)
              setTableSort(null)
            }}
            placeholder={'Ask a question\u2026 e.g. \u201chighest two-point percentage center ever\u201d'}
            spellCheck={false}
          />
          {queryText && (
            <button className="query-clear" onClick={() => setQueryText('')} aria-label="Clear">
              ×
            </button>
          )}
        </div>

        <div className="example-pills">
          {EXAMPLE_QUERIES.map((ex) => (
            <button key={ex} className="example-pill" onClick={() => handleExample(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <div className="control-group">
          <label className="control-label">Position</label>
          <div className="pill-group">
            {POSITION_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                className={`pill ${effectivePosition === value ? 'pill--active' : ''}`}
                onClick={() => handlePositionClick(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">Season</label>
          <select
            className="season-select"
            value={seasonOverride}
            onChange={(e) => { setSeasonOverride(e.target.value); setTableSort(null) }}
          >
            {SEASON_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">Min attempts</label>
          <input
            className="min-input"
            type="number"
            min={0}
            max={2000}
            value={minAttempts}
            placeholder={String(def.defaultMinAttempts)}
            onChange={(e) => {
              const v = e.target.value === '' ? '' : parseInt(e.target.value, 10)
              setMinAttempts(v)
              setTableSort(null)
            }}
          />
        </div>
      </div>

      {/* Interpretation */}
      {queryText && (
        <div className="interpretation">
          <span className="interp-label">Interpreting as:</span> {interpretation}
        </div>
      )}

      {/* Results */}
      <ResultsArea
        status={dataStatus}
        meta={meta}
        rows={displayRows}
        total={results.length}
        statKey={parsed.statKey}
        tableSort={tableSort}
        onSort={toggleSort}
      />
    </div>
  )
}

// ── ResultsArea ───────────────────────────────────────────────────────────────

interface ResultsAreaProps {
  status: 'loading' | 'ready' | 'empty' | 'error'
  meta: DataFile['meta'] | null
  rows: PlayerSeason[]
  total: number
  statKey: StatKey
  tableSort: SortState | null
  onSort: (col: string) => void
}

function ResultsArea({ status, meta, rows, total, statKey, tableSort, onSort }: ResultsAreaProps) {
  if (status === 'loading') {
    return <div className="state-msg">Loading data…</div>
  }

  if (status === 'error' || status === 'empty') {
    return (
      <div className="state-empty">
        <p className="state-empty-title">No data loaded yet</p>
        <p className="state-empty-body">
          Run the ETL script to populate player season data:
        </p>
        <pre className="code-block">
{`cd projects/nba-two-point-percentage/scripts
pip install -r requirements.txt
python fetch_data.py`}
        </pre>
        <p className="state-empty-body">
          This fetches all seasons from the NBA API and saves{' '}
          <code>public/data/player_seasons.json</code>.
          Commit the file and redeploy to go live.
        </p>
      </div>
    )
  }

  const def = STAT_DEFS[statKey]

  return (
    <div className="results">
      <div className="results-meta">
        {meta?.fetched_at && (
          <span className="results-freshness">
            Data: {meta.seasons_covered?.[0]} – {meta.seasons_covered?.at(-1)}
            {' · '}Updated {new Date(meta.fetched_at).toLocaleDateString()}
          </span>
        )}
        <span className="results-count">{total.toLocaleString()} seasons matched · showing top {rows.length}</span>
      </div>

      <div className="table-wrap">
        <table className="results-table">
          <thead>
            <tr>
              <th className="col-rank">#</th>
              <th className="col-name">Player</th>
              <th className="col-season">Season</th>
              <th className="col-pos">Pos</th>
              <th className="col-team">Team</th>
              <th
                className={`col-stat sortable ${tableSort?.col === 'stat' ? 'sorted' : ''}`}
                onClick={() => onSort('stat')}
              >
                {def.label}
                <SortArrow col="stat" sort={tableSort} />
              </th>
              {def.extraCols.map((ec) => (
                <th key={ec.label} className="col-extra">{ec.label}</th>
              ))}
              <th
                className={`col-gp sortable ${tableSort?.col === 'gp' ? 'sorted' : ''}`}
                onClick={() => onSort('gp')}
              >
                GP<SortArrow col="gp" sort={tableSort} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${row.id}-${row.season}`} className={i % 2 === 0 ? 'row-even' : ''}>
                <td className="col-rank">{i + 1}</td>
                <td className="col-name">{row.name}</td>
                <td className="col-season">{row.season}</td>
                <td className="col-pos">{row.pos}</td>
                <td className="col-team">{row.team}</td>
                <td className="col-stat highlight">
                  {fmtStat(def.getValue(row), def.isPercent)}
                </td>
                {def.extraCols.map((ec) => (
                  <td key={ec.label} className="col-extra">
                    {ec.isInt
                      ? Math.round(ec.getValue(row)).toLocaleString()
                      : ec.getValue(row).toFixed(1)}
                  </td>
                ))}
                <td className="col-gp">{row.gp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SortArrow({ col, sort }: { col: string; sort: SortState | null }) {
  if (!sort || sort.col !== col) return <span className="sort-arrow sort-arrow--inactive">↕</span>
  return <span className="sort-arrow">{sort.dir === 'desc' ? '↓' : '↑'}</span>
}
