import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { DATA } from './data.js'
import { SECOND_PHASE_DATA } from './dataSecondPhase.js'
import { FINAL_PHASE_DATA } from './dataFinalPhase.js'


// ── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { label: 'OC — Open Category', key: 'OC' },
  { label: 'BC-A', key: 'BC_A' }, { label: 'BC-B', key: 'BC_B' },
  { label: 'BC-C', key: 'BC_C' }, { label: 'BC-D', key: 'BC_D' },
  { label: 'BC-E', key: 'BC_E' }, { label: 'SC-I', key: 'SC_I' },
  { label: 'SC-II', key: 'SC_II' }, { label: 'SC-III', key: 'SC_III' },
  { label: 'ST', key: 'ST' }, { label: 'EWS', key: 'EWS' },
]

const CTYPE_LABEL = { PVT: 'Private', UNIV: 'University', GOV: 'Government', SF: 'Self Finance' }

const PHASES = [
  { key: 'first', label: 'First Phase', data: DATA },
  { key: 'second', label: 'Second Phase', data: SECOND_PHASE_DATA },
  { key: 'last', label: 'Last Phase', data: FINAL_PHASE_DATA },
]

const DATA_BY_PHASE = Object.fromEntries(PHASES.map(phase => [phase.key, phase.data]))

const DIST_NAMES = {
  HYD: 'Hyderabad', MDL: 'Medchal-Malkajgiri', RR: 'Rangareddy',
  WGL: 'Warangal Rural', HNK: 'Hanamkonda', KHM: 'Khammam',
  KGM: 'Bhadradri Kothagudem', SRP: 'Suryapet', MED: 'Medak',
  YBG: 'Yadadri Bhuvanagiri', PDL: 'Peddapalli', SRC: 'Rajanna Sircilla',
  MBN: 'Mahabubnagar', NPT: 'Nagarkurnool', NLG: 'Nalgonda',
  MHB: 'Mahabubabad', JTL: 'Jagtial', SRD: 'Sangareddy',
  WNP: 'Wanaparthy', KMR: 'Kamareddy', SDP: 'Siddipet',
  KRM: 'Karimnagar', NZB: 'Nizamabad',
}

const LOADING_STEPS = [
  'Scanning 942 college-branch combinations…',
  'Calculating admission chances…',
  'Building your counselling strategy…',
  'Almost ready…',
]

const ALL_DATA = PHASES.flatMap(phase => phase.data)
const ALL_DISTRICTS = [...new Set(ALL_DATA.map(r => r.dist))].sort()
const ALL_BRANCHES  = [...new Set(ALL_DATA.map(r => r.branch))].sort()

function getChance(closing, rank) {
  const d = closing - rank
  if (d >= 2000) return { cls: 'b-safe',   label: 'Good Chance' }
  if (d >= 500)  return { cls: 'b-border', label: 'Can Try' }
  return               { cls: 'b-tight',  label: 'Backup' }
}

const CHANCE_META = {
  canTry: { cls: 'b-tight', label: 'Can Try' },
  good: { cls: 'b-safe', label: 'Good Chance' },
  backup: { cls: 'b-border', label: 'Backup' },
}

function uniqueRows(rows) {
  const seen = new Set()
  return rows.filter(row => {
    const key = `${row.code}-${row.bcode}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const CAN_TRY_CEILING = 1000    // delta 0–999      → tight, risky
const GOOD_CEILING    = 15000   // delta 1000–14999  → comfortable
                                // delta 15000+      → very safe

function getCounsellingBuckets(rows) {
  // delta = closing − userRank, always >= 0 (ineligibles pre-filtered)
  // Lower delta = riskier, higher delta = safer

  const byDelta = [...rows].sort((a, b) => a.delta - b.delta)

  const canTry = byDelta
    .filter(r => r.delta < CAN_TRY_CEILING)
    .slice(0, 8)

  const canTryKeys = new Set(canTry.map(r => `${r.code}|${r.bcode}`))

  const good = byDelta
    .filter(r => r.delta >= CAN_TRY_CEILING && r.delta < GOOD_CEILING)
    .filter(r => !canTryKeys.has(`${r.code}|${r.bcode}`))
    .slice(0, 12)

  const goodKeys = new Set(good.map(r => `${r.code}|${r.bcode}`))

  const backup = byDelta
    .filter(r => r.delta >= GOOD_CEILING)
    .filter(r =>
      !canTryKeys.has(`${r.code}|${r.bcode}`) &&
      !goodKeys.has(`${r.code}|${r.bcode}`)
    )
    .slice(0, 12)

  return { canTry, good, backup }
}

// ── Loading Overlay ──────────────────────────────────────────────────────────
function LoadingOverlay({ step }) {
  const pct = Math.round(((step + 1) / LOADING_STEPS.length) * 100)
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-card">
        <div className="spinner-ring" aria-hidden="true"/>
        <p className="loading-text">{LOADING_STEPS[step]}</p>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }}/>
        </div>
        <p className="loading-pct">{pct}%</p>
      </div>
    </div>
  )
}

// ── Mobile Result Card ───────────────────────────────────────────────────────
function ResultCard({ row, rankNum, saved, onSave }) {
  const ch = row.chance || getChance(row.closing, rankNum)
  const distName = DIST_NAMES[row.dist] || row.dist
  const isGov = row.ctype === 'GOV' || row.ctype === 'UNIV'
  return (
    <div className={`result-card ${saved ? 'is-saved' : ''}`}>
      <div className="rc-top">
        <span className={`badge ${ch.cls}`}>{ch.label}</span>
        <div className="rc-right">
          <span className="rc-rank">{row.closing.toLocaleString('en-IN')}</span>
          <button
            className={`save-btn ${saved ? 'saved' : ''}`}
            onClick={onSave}
            aria-label={saved ? 'Remove from shortlist' : 'Save to shortlist'}
          >{saved ? '★' : '☆'}</button>
        </div>
      </div>
      <div className="rc-name">{row.name}</div>
      <div className="rc-branch">{row.branch}</div>
      <div className="rc-footer">
        <span>{distName}</span>
        <span className="rc-dot">·</span>
        <span className={`badge ${isGov ? 'b-gov' : 'b-pvt'}`}>{CTYPE_LABEL[row.ctype] || row.ctype}</span>
        <span className="rc-dot">·</span>
        <span>{row.bcode}</span>
      </div>
    </div>
  )
}

// ── Strategy Panel ───────────────────────────────────────────────────────────
function StrategyPanel({ canTry, good, backup }) {
  const cols = [
    { id: 'can-try', heading: 'Can Try', sub: 'choices 1–2', color: 'var(--red)', items: canTry.slice(0, 2), cardCls: 'sc-tight' },
    { id: 'good',    heading: 'Good Chance', sub: 'choices 3–5', color: 'var(--blue)', items: good.slice(0, 3), cardCls: 'sc-border' },
    { id: 'backup',  heading: 'Backup', sub: 'choices 6–8', color: 'var(--amber)', items: backup.slice(0, 3), cardCls: 'sc-safe' },
  ]
  return (
    <div className="strategy-panel">
      <h3 className="section-title">💡 Fill your 8 counselling choices</h3>
      <div className="strategy-cols">
        {cols.map(col => (
          <div key={col.id}>
            <div className="sc-col-label" style={{ color: col.color }}>
              {col.heading} <span className="sc-col-sub">({col.sub})</span>
            </div>
            {col.items.length === 0
              ? <p className="sc-empty">None in this range</p>
              : col.items.map((r, i) => (
                  <div key={i} className={`sc-card ${col.cardCls}`}>
                    <div className="sc-name">{r.name.split(' ').slice(0, 5).join(' ')}…</div>
                    <div className="sc-rank">{r.bcode} · {r.closing.toLocaleString('en-IN')}</div>
                  </div>
                ))
            }
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sticky Bar ───────────────────────────────────────────────────────────────
function StickyBar({ rankNum, colKey, searchQuery, onSearch, onEdit }) {
  const label = colKey.replace(/_/g, ' ')
  return (
    <div className="sticky-bar">
      <div className="sticky-meta">
        <span className="sticky-rank">#{rankNum.toLocaleString('en-IN')}</span>
        <span className="sticky-cat">{label}</span>
      </div>
      <div className="sticky-search-wrap">
        <span className="sticky-search-icon" aria-hidden="true">🔍</span>
        <input
          className="sticky-search-input"
          placeholder="Search college or branch…"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          aria-label="Search results"
        />
        {searchQuery && (
          <button className="sticky-clear" onClick={() => onSearch('')} aria-label="Clear search">✕</button>
        )}
      </div>
    </div>
  )
}

// ── Sort Th ──────────────────────────────────────────────────────────────────
function SortTh({ col, label, sortCol, sortAsc, onSort }) {
  const active = sortCol === col
  return (
    <th onClick={() => onSort(col)} aria-sort={active ? (sortAsc ? 'ascending' : 'descending') : 'none'}>
      {label}
      <span className="sort-arrow" aria-hidden="true">
        {active ? (sortAsc ? ' ↑' : ' ↓') : ' ↕'}
      </span>
    </th>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [rank,      setRank]      = useState('')
  const [category,  setCategory]  = useState('OC')
  const [gender,    setGender]    = useState('BOYS')
  const [phase,     setPhase]     = useState('first')
  const [district,  setDistrict]  = useState('')
  const [branch,    setBranch]    = useState('')
  const [ctype,     setCtype]     = useState('')
  const [showAdv,   setShowAdv]   = useState(false)
  const [searched,  setSearched]  = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadStep,  setLoadStep]  = useState(0)
  const [sortCol,   setSortCol]   = useState('closing')
  const [sortAsc,   setSortAsc]   = useState(true)
  const [shortlist, setShortlist] = useState(new Set())
  const [searchQ,   setSearchQ]   = useState('')
  const [showSticky,setShowSticky]= useState(false)

  const formRef    = useRef(null)
  const resultsRef = useRef(null)

  const colKey  = `${category}_${gender}`
  const rankNum = parseInt(rank, 10) || 0
  const phaseData = DATA_BY_PHASE[phase] || DATA
  const phaseLabel = PHASES.find(p => p.key === phase)?.label || 'First Phase'

  // Sticky bar visibility via IntersectionObserver
  useEffect(() => {
    if (!searched || !formRef.current) return
    const obs = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    )
    obs.observe(formRef.current)
    return () => obs.disconnect()
  }, [searched])

  // Cleanup print-mode after printing
  useEffect(() => {
    const handler = () => { document.body.removeAttribute('data-print-mode') }
    window.addEventListener('afterprint', handler)
    return () => window.removeEventListener('afterprint', handler)
  }, [])

  // Filter + search
  const results = useMemo(() => {
    if (!searched || !rankNum) return []
    const q = searchQ.toLowerCase()
    const matchingRows = phaseData.filter(row => {
      const closing = row[colKey]
      if (!closing) return false
      if (row.gender === 'GIRLS' && gender === 'BOYS') return false
      if (district && row.dist   !== district) return false
      if (branch   && row.branch !== branch)   return false
      if (ctype    && row.ctype  !== ctype)    return false
      if (q && !row.name.toLowerCase().includes(q) && !row.branch.toLowerCase().includes(q)) return false
      return true
    }).map(row => ({ ...row, closing: row[colKey], delta: row[colKey] - rankNum }))

    const buckets = getCounsellingBuckets(matchingRows)
    return [
      ...buckets.canTry.map(row => ({ ...row, chance: CHANCE_META.canTry, chanceGroup: 'canTry' })),
      ...buckets.good.map(row => ({ ...row, chance: CHANCE_META.good, chanceGroup: 'good' })),
      ...buckets.backup.map(row => ({ ...row, chance: CHANCE_META.backup, chanceGroup: 'backup' })),
    ]
  }, [searched, rankNum, colKey, gender, district, branch, ctype, searchQ, phaseData])

  const sorted = useMemo(() => (
    [...results].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol]
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ?  1 : -1
      return 0
    })
  ), [results, sortCol, sortAsc])

  const canTry = sorted.filter(r => r.chanceGroup === 'canTry')
  const good   = sorted.filter(r => r.chanceGroup === 'good')
  const backup = sorted.filter(r => r.chanceGroup === 'backup')
  useEffect(() => {
  if (searched && results.length === 0 && window.gtag) {
    window.gtag('event', 'no_results')
  }
}, [searched, results])

  const handleSearch = useCallback(e => {
    e.preventDefault()
    if (!rank) return
    // Start loading sequence
    setIsLoading(true)
    setLoadStep(0)
    let step = 0
    const stepDuration = 850
    const interval = setInterval(() => {
      step++
      if (step < LOADING_STEPS.length) {
        setLoadStep(step)
      } else {
        clearInterval(interval)
        setIsLoading(false)
        if (window.gtag) {
  window.gtag('event', 'college_search', {
    rank_range:
      Number(rank) < 10000 ? '0-10k' :
      Number(rank) < 25000 ? '10k-25k' :
      Number(rank) < 50000 ? '25k-50k' :
      Number(rank) < 100000 ? '50k-100k' :
      '100k+',

    category: category,
    gender: gender,
    phase: phase
  })
}
        setSearched(true)
        setSortCol('closing')
        setSortAsc(true)
        setSearchQ('')
        // Scroll to results
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      }
    }, stepDuration)
  }, [rank])

  const handleSort = useCallback(col => {
    setSortCol(prev => {
      if (prev === col) { setSortAsc(a => !a); return col }
      setSortAsc(true); return col
    })
  }, [])

  const toggleSave = useCallback(key => {
    setShortlist(prev => {
      const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
    })
  }, [])

  const printShortlist = useCallback(() => {
    document.body.setAttribute('data-print-mode', 'shortlist')
    window.print()
  }, [])

  const printAll = useCallback(() => {
    document.body.removeAttribute('data-print-mode')
    window.print()
  }, [])

  const copyList = useCallback(() => {
    const text = sorted.slice(0, 8)
      .map((r, i) => `${i + 1}. ${r.name} — ${r.branch} (${r.closing.toLocaleString('en-IN')})`)
      .join('\n')
    navigator.clipboard?.writeText(`TGEAPCET 2025 - ${phaseLabel} - Rank ${rankNum}, ${colKey}\n\n${text}`)
      .then(() => alert('Copied top 8 to clipboard!'))
  }, [sorted, rankNum, colKey, phaseLabel])

  const shareWhatsApp = useCallback(() => {
    const text = `TGEAPCET 2025 - ${phaseLabel} - My college list\nRank: ${rankNum.toLocaleString()}, ${colKey.replace(/_/g, ' ')}\n\n` +
      sorted.slice(0, 6).map((r, i) => `${i + 1}. ${r.name.split(' ').slice(0, 4).join(' ')} — ${r.bcode} (${r.closing.toLocaleString()})`).join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }, [sorted, rankNum, colKey, phaseLabel])

  const shortlistedRows = sorted.filter(r => shortlist.has(r.code + r.bcode))
  const catLabel = CATEGORIES.find(c => c.key === category)?.label || category

  return (
    <>
      {isLoading && <LoadingOverlay step={loadStep} />}
      {showSticky && searched && (
        <StickyBar
          rankNum={rankNum} colKey={colKey}
          searchQuery={searchQ} onSearch={setSearchQ}
        />
      )}

      {/* ── HERO ── */}
      <div className="hero">
        <div className="hero-inner">
          <div className="hero-badge">🎓 TGEAPCET 2025 · {phaseLabel} · Official Data</div>
          <h1 className="hero-title">Predict your best<br/>TGEAPCET colleges</h1>
          <p className="hero-sub">
            Get realistic admission chances based on<br/>
            rank, category, gender, and previous cutoffs.
          </p>

          {/* ── FORM ── */}
          <div className="search-card" ref={formRef}>
            <form onSubmit={handleSearch}>
              <div className="field rank-field">
                <label>Your TGEAPCET Rank</label>
                <input
                  type="number" min="1" max="200000"
                  placeholder="Enter your rank  e.g. 12500"
                  value={rank}
                  onChange={e => setRank(e.target.value)}
                  required autoFocus
                />
              </div>
              <div className="form-grid-2">
                <div className="field">
                  <label>Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Gender</label>
                  <select value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="BOYS">Male</option>
                    <option value="GIRLS">Female</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="field">
                  <label>Phase</label>
                  <select value={phase} onChange={e => setPhase(e.target.value)}>
                    {PHASES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Branch</label>
                  <select value={branch} onChange={e => setBranch(e.target.value)}>
                    <option value="">All branches</option>
                    {ALL_BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <button type="button" className="adv-toggle" onClick={() => setShowAdv(s => !s)}>
                {showAdv ? '▾' : '▸'} Advanced filters
              </button>

              {showAdv && (
                <div className="form-grid-2" style={{ marginBottom: 14 }}>
                  <div className="field">
                    <label>District</label>
                    <select value={district} onChange={e => setDistrict(e.target.value)}>
                      <option value="">All districts</option>
                      {ALL_DISTRICTS.map(d => <option key={d} value={d}>{DIST_NAMES[d] || d}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>College type</label>
                    <select value={ctype} onChange={e => setCtype(e.target.value)}>
                      <option value="">All types</option>
                      {Object.entries(CTYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <button type="submit" className="btn-search">
                Find My Colleges →
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── RESULTS ── */}
      <div className="container" ref={resultsRef}>
        {!searched && !isLoading && (
          <div className="empty">
            <span className="icon">🎓</span>
            <strong>Enter your rank and category above</strong>
            <p>We'll show every college you qualify for — with a ready-made counselling strategy.</p>
          </div>
        )}

        {searched && (
          <>
            {/* Stats — 25 | 50 | 25 */}
            <div className="stats-row">
              <div className="stat-card stat-sm">
                <div className="stat-label">Total found</div>
                <div className="stat-val">{sorted.length}</div>
              </div>
              <div className="stat-card stat-lg stat-highlight">
                <div className="stat-label stat-label-green">Good Chance</div>
                <div className="stat-val stat-val-xl">{good.length}</div>
                <div className="stat-hint">realistic colleges for this rank</div>
              </div>
              <div className="stat-card stat-sm">
                <div className="stat-label">Can Try</div>
                <div className="stat-val stat-amber">{canTry.length}</div>
              </div>
            </div>

            {/* Search bar (below stats, above strategy) */}
            <div className="inline-search-wrap">
              <span aria-hidden="true" className="inline-search-icon">🔍</span>
              <input
                className="inline-search"
                placeholder="Search college or branch name…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                aria-label="Search results"
              />
              {searchQ && (
                <button className="inline-search-clear" onClick={() => setSearchQ('')} aria-label="Clear">✕</button>
              )}
            </div>

            {/* Strategy */}
            {sorted.length > 0 && <StrategyPanel canTry={canTry} good={good} backup={backup} />}

            {/* Shortlist bar */}
            {shortlist.size > 0 && (
              <div className="shortlist-bar">
                <div className="shortlist-info">
                  <strong>Shortlist ({shortlist.size})</strong>
                  <div className="chip-list">
                    {shortlistedRows.slice(0, 5).map((r, i) => (
                      <span key={i} className="chip">
                        {r.code} · {r.bcode}
                        <button className="chip-remove" onClick={() => toggleSave(r.code + r.bcode)} aria-label="Remove">×</button>
                      </span>
                    ))}
                    {shortlist.size > 5 && <span className="chip">+{shortlist.size - 5} more</span>}
                  </div>
                </div>
                <button className="btn-white" onClick={printShortlist}>🖨 Print shortlist</button>
              </div>
            )}

            {sorted.length === 0 ? (
              <div className="empty">
                <span className="icon">😔</span>
                <strong>No results for rank {rankNum.toLocaleString('en-IN')}</strong>
                <p>Try removing filters or selecting a different category.</p>
              </div>
            ) : (
              <>
                <div className="results-header">
                  <p className="results-count">
                    {sorted.length} result{sorted.length !== 1 ? 's' : ''} · {phaseLabel} · {colKey.replace(/_/g, ' ')}
                  </p>
                  <div className="btn-row">
                    <button className="btn-sm" onClick={shareWhatsApp}>📱 WhatsApp</button>
                    <button className="btn-sm" onClick={copyList}>📋 Copy</button>
                    <button className="btn-sm" onClick={printAll}>🖨 Print all</button>
                  </div>
                </div>

                {/* Mobile cards */}
                <div className="cards-view">
                  {sorted.map((row, i) => {
                    const key = row.code + row.bcode
                    return (
                      <ResultCard
                        key={i} row={row} rankNum={rankNum}
                        saved={shortlist.has(key)}
                        onSave={() => toggleSave(key)}
                      />
                    )
                  })}
                </div>

                {/* Desktop table */}
                <div className="table-view table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <SortTh col="name"    label="College"      sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort} />
                        <SortTh col="branch"  label="Branch"       sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort} />
                        <SortTh col="dist"    label="District"     sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort} />
                        <th>Type</th>
                        <SortTh col="closing" label="Closing rank" sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort} />
                        <th>Chance</th>
                        <th>Save</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((row, i) => {
                        const ch  = row.chance || getChance(row.closing, rankNum)
                        const key = row.code + row.bcode
                        const saved = shortlist.has(key)
                        const isGov = row.ctype === 'GOV' || row.ctype === 'UNIV'
                        return (
                          <tr key={i} className={saved ? 'is-saved' : ''}>
                            <td>
                              <div className="td-name">{row.name}</div>
                              <div className="td-sub">{row.code} · {row.affil}</div>
                            </td>
                            <td>
                              <div className="td-branch">{row.branch}</div>
                              <div className="td-sub">{row.bcode}</div>
                            </td>
                            <td className="td-dist">{DIST_NAMES[row.dist] || row.dist}</td>
                            <td><span className={`badge ${isGov ? 'b-gov' : 'b-pvt'}`}>{CTYPE_LABEL[row.ctype] || row.ctype}</span></td>
                            <td className="td-rank">{row.closing.toLocaleString('en-IN')}</td>
                            <td><span className={`badge ${ch.cls}`}>{ch.label}</span></td>
                            <td>
                              <button
                                className={`save-btn ${saved ? 'saved' : ''}`}
                                onClick={() => toggleSave(key)}
                                aria-label={saved ? 'Remove' : 'Save'}
                              >{saved ? '★' : '☆'}</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="disclaimer">
                  Source: TGEAPCET 2025 Official Last Rank Statement - {phaseLabel}. This is entirely based on TGEAPCET official data. Actual seats may vary depending on seat availability, NCC, CAP, sports, and other applicable reservation or admission rules. As per G.O.Ms.No. 42, girls are also eligible for seats listed under boys category.
                </p>
              </>
            )}
          </>
        )}
      </div>

      <footer className="about-section">
        <div className="about-inner">
          <h2>About Us</h2>
          <p>Developed by Akshay with love for engineering students.</p>
          <p>Contact: <a href="mailto:akshay.salla2@gmail.com">akshay.salla2@gmail.com</a></p>
          <p className="about-disclaimer">
            Disclaimer: This website is entirely based on TGEAPCET official data. Actual seats may vary depending on seat availability, NCC, CAP, sports, and other applicable reservation or admission rules.
          </p>
        </div>
      </footer>
    </>
  )
}

