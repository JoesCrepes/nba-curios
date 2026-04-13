import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { PlayerSeason } from '../types'
import {
  parseQuery, applyQuery, fmtStat, describeQuery,
  STAT_DEFS, type StatKey, type PositionFilter,
} from '../utils/queryParser'
import {
  ALL_SEASONS, CURRENT_SEASON,
  loadSeason, loadSeasonsConcurrent,
  getAllCached,
} from '../utils/seasonLoader'
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
  { value: '',            label: 'All time' },
  ...ALL_SEASONS.map((s) => ({ value: s, label: s })),
]

type SortState = { col: string; dir: 'asc' | 'desc' }

// ─── Load state ───────────────────────────────────────────────────────────────

interface LoadState {
  loaded: Set<string>   // seasons in cache
  loading: Set<string>  // in-flight
  errors: Set<string>   // failed
  allTimeStarted: boolean
}

const emptyLoadState = (): LoadState => ({
  loaded: new Set(), loading: new Set(), errors: new Set(), allTimeStarted: false,
})

export default function TwoPointPct() {
  // ── Query state ─────────────────────────────────────────────────────────────
  const [queryText,       setQueryText]       = useState('')
  const [positionOverride, setPositionOverride] = useState<PositionFilter | null>(null)
  const [seasonOverride,  setSeasonOverride]  = useState<string>(CURRENT_SEASON)
  const [minAttempts,     setMinAttempts]     = useState<number | ''>('')
  const [tableSort,       setTableSort]       = useState<SortState | null>(null)

  // ── Load state ──────────────────────────────────────────────────────────────
  const [loadState, setLoadState] = useState<LoadState>(emptyLoadState)

  // Track whether the "all time" load has been kicked off this session
  const allTimeRef = useRef(false)

  // ── Derived ─────────────────────────────────────────────────────────────────
  const parsed          = useMemo(() => parseQuery(queryText), [queryText])
  const effectivePosition: PositionFilter = positionOverride ?? parsed.position
  const effectiveSeason = seasonOverride  // '' = all time
  const effectiveMin    = minAttempts !== '' ? minAttempts : STAT_DEFS[parsed.statKey].defaultMinAttempts
  const def             = STAT_DEFS[parsed.statKey]

  // ── Helpers to mutate load state ─────────────────────────────────────────────
  const markLoading = useCallback((season: string) => {
    setLoadState((s) => {
      const loading = new Set(s.loading); loading.add(season)
      return { ...s, loading }
    })
  }, [])

  const markDone = useCallback((season: string, ok: boolean) => {
    setLoadState((s) => {
      const loading = new Set(s.loading); loading.delete(season)
      const loaded  = new Set(s.loaded)
      const errors  = new Set(s.errors)
      if (ok) loaded.add(season); else errors.add(season)
      return { ...s, loading, loaded, errors }
    })
  }, [])

  // ── Initial load: always kick off the current season ─────────────────────────
  useEffect(() => {
    markLoading(CURRENT_SEASON)
    loadSeason(CURRENT_SEASON)
      .then(() => markDone(CURRENT_SEASON, true))
      .catch(() => markDone(CURRENT_SEASON, false))
  }, [markLoading, markDone])

  // ── Season dropdown change ────────────────────────────────────────────────────
  useEffect(() => {
    if (effectiveSeason === '' || loadState.loaded.has(effectiveSeason)) return
    markLoading(effectiveSeason)
    loadSeason(effectiveSeason)
      .then(() => markDone(effectiveSeason, true))
      .catch(() => markDone(effectiveSeason, false))
  }, [effectiveSeason, loadState.loaded, markLoading, markDone])

  // ── "All time" progressive load ───────────────────────────────────────────────
  const startAllTime = useCallback(() => {
    if (allTimeRef.current) return
    allTimeRef.current = true
    setLoadState((s) => ({ ...s, allTimeStarted: true }))

    // Mark everything not yet loaded as "loading" immediately for UI
    setLoadState((s) => {
      const loading = new Set(s.loading)
      ALL_SEASONS.forEach((season) => { if (!s.loaded.has(season)) loading.add(season) })
      return { ...s, loading }
    })

    loadSeasonsConcurrent(
      ALL_SEASONS,
      (season, ok) => markDone(season, ok),
      3, // max concurrent requests
    )
  }, [markDone])

  // ── Flatten all cached data for querying ──────────────────────────────────────
  // Re-runs whenever loadState.loaded changes (i.e. a new season arrives)
  const allData = useMemo(() => {
    if (effectiveSeason !== '') {
      // Specific season: just that one
      return (loadState.loaded.has(effectiveSeason) ? getAllCached().filter(p => p.season === effectiveSeason) : [])
    }
    return getAllCached()
  }, [effectiveSeason, loadState.loaded])

  // ── Filter + rank ─────────────────────────────────────────────────────────────
  const results = useMemo(
    () => applyQuery(allData, { ...parsed, position: effectivePosition }, effectiveMin, effectiveSeason || null),
    [allData, parsed, effectivePosition, effectiveMin, effectiveSeason],
  )

  const displayRows = useMemo(() => {
    if (!tableSort) return results.slice(0, 50)
    return [...results].sort((a, b) => {
      const va = tableSort.col === 'stat' ? def.getValue(a) : a.gp
      const vb = tableSort.col === 'stat' ? def.getValue(b) : b.gp
      return tableSort.dir === 'asc' ? va - vb : vb - va
    }).slice(0, 50)
  }, [results, tableSort, def])

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleExample = (ex: string) => {
    setQueryText(ex)
    setPositionOverride(null)
    setTableSort(null)
  }

  const handlePositionClick = (pos: PositionFilter) => {
    setPositionOverride(pos === effectivePosition && positionOverride !== null ? null : pos)
    setTableSort(null)
  }

  const handleSeasonChange = (val: string) => {
    setSeasonOverride(val)
    setTableSort(null)
    if (val === '' && !allTimeRef.current) startAllTime()
  }

  const interpretation = describeQuery(
    { ...parsed, position: effectivePosition },
    effectiveMin,
    effectiveSeason || null,
  )

  // ── Progress indicators ───────────────────────────────────────────────────────
  const loadedCount  = loadState.loaded.size
  const loadingCount = loadState.loading.size
  const errorCount   = loadState.errors.size
  const isAllTime    = effectiveSeason === ''
  const isComplete   = isAllTime ? loadedCount === ALL_SEASONS.length : loadState.loaded.has(effectiveSeason)
  const isLoading    = loadingCount > 0

  return (
    <div className="tool-page">
      <nav className="tool-nav">
        <Link to="/" className="back-link">← NBA Curios</Link>
      </nav>

      <header className="tool-header">
        <h1>Two-Point % Explorer</h1>
        <p className="tool-subtitle">Find the best single-season shooters across NBA history</p>
      </header>

      {/* Query input */}
      <div className="query-section">
        <div className="query-input-wrap">
          <input
            className="query-input"
            type="text"
            value={queryText}
            onChange={(e) => { setQueryText(e.target.value); setPositionOverride(null); setTableSort(null) }}
            placeholder={'Ask a question\u2026 e.g. \u201chighest two-point percentage center ever\u201d'}
            spellCheck={false}
          />
          {queryText && (
            <button className="query-clear" onClick={() => setQueryText('')} aria-label="Clear">×</button>
          )}
        </div>
        <div className="example-pills">
          {EXAMPLE_QUERIES.map((ex) => (
            <button key={ex} className="example-pill" onClick={() => handleExample(ex)}>{ex}</button>
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
              >{label}</button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">Season</label>
          <select
            className="season-select"
            value={seasonOverride}
            onChange={(e) => handleSeasonChange(e.target.value)}
          >
            {SEASON_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {!loadState.allTimeStarted && seasonOverride !== '' && (
            <button className="all-time-btn" onClick={() => { setSeasonOverride(''); startAllTime() }}>
              Load all time →
            </button>
          )}
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
              setMinAttempts(e.target.value === '' ? '' : parseInt(e.target.value, 10))
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

      {/* Progress bar for all-time loads */}
      {isAllTime && loadState.allTimeStarted && !isComplete && (
        <div className="progress-bar-wrap">
          <div
            className="progress-bar-fill"
            style={{ width: `${(loadedCount / ALL_SEASONS.length) * 100}%` }}
          />
          <span className="progress-label">
            {isLoading
              ? `Loading seasons\u2026 ${loadedCount} / ${ALL_SEASONS.length}`
              : `${loadedCount} seasons loaded${errorCount > 0 ? ` (${errorCount} failed)` : ''}`}
          </span>
        </div>
      )}

      {/* Results */}
      <ResultsArea
        rows={displayRows}
        total={results.length}
        statKey={parsed.statKey}
        isLoading={!isComplete && isLoading}
        isIncomplete={isAllTime && !isComplete}
        loadedCount={loadedCount}
        totalSeasons={ALL_SEASONS.length}
        onLoadAllTime={loadState.allTimeStarted ? undefined : startAllTime}
        tableSort={tableSort}
        onSort={(col) => setTableSort((prev) =>
          prev?.col === col
            ? { col, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
            : { col, dir: 'desc' }
        )}
        errorSeason={
          !isAllTime && loadState.errors.has(seasonOverride) ? seasonOverride : null
        }
      />
    </div>
  )
}

// ─── ResultsArea ──────────────────────────────────────────────────────────────

interface ResultsAreaProps {
  rows: PlayerSeason[]
  total: number
  statKey: StatKey
  isLoading: boolean
  isIncomplete: boolean
  loadedCount: number
  totalSeasons: number
  onLoadAllTime?: () => void
  tableSort: SortState | null
  onSort: (col: string) => void
  errorSeason: string | null
}

function ResultsArea({
  rows, total, statKey, isLoading, isIncomplete,
  loadedCount, totalSeasons, onLoadAllTime,
  tableSort, onSort, errorSeason,
}: ResultsAreaProps) {
  const def = STAT_DEFS[statKey]

  if (errorSeason) {
    return (
      <div className="state-empty">
        <p className="state-empty-title">Could not load {errorSeason}</p>
        <p className="state-empty-body">
          The NBA API was unreachable. Try reloading, or select a different season.
        </p>
      </div>
    )
  }

  if (rows.length === 0 && isLoading) {
    return <div className="state-msg">Loading season data…</div>
  }

  if (rows.length === 0 && !isLoading && loadedCount === 0) {
    return (
      <div className="state-empty">
        <p className="state-empty-title">Could not load season data</p>
        <p className="state-empty-body">The NBA API may be temporarily unavailable. Try reloading the page.</p>
      </div>
    )
  }

  return (
    <div className="results">
      <div className="results-meta">
        <span className="results-count">
          {total.toLocaleString()} seasons matched · showing top {rows.length}
          {isIncomplete && (
            <span className="results-incomplete">
              {' '}· {loadedCount}/{totalSeasons} seasons loaded
              {onLoadAllTime && (
                <button className="load-all-inline" onClick={onLoadAllTime}>load all →</button>
              )}
            </span>
          )}
        </span>
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
                {def.label}<SortArrow col="stat" sort={tableSort} />
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
                <td className="col-stat highlight">{fmtStat(def.getValue(row), def.isPercent)}</td>
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
  if (!sort || sort.col !== col) return <span className="sort-arrow sort-arrow--inactive">\u2195</span>
  return <span className="sort-arrow">{sort.dir === 'desc' ? '\u2193' : '\u2191'}</span>
}
