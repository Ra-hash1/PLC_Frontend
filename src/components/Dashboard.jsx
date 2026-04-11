import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Header from './Header'
import FooterFixed from './FooterFixed'
import api from '../services/api'

const PAGE_SIZE = 10

const COLUMNS = [
  { key: 'index',      label: '#',         sortable: false },
  { key: 'name',       label: 'Machine',   sortable: true  },
  { key: 'machine_id', label: 'Node ID',   sortable: true  },
  { key: 'line_id',    label: 'Line',      sortable: true  },
  { key: 'status',     label: 'Status',    sortable: true  },
  { key: 'updated',    label: 'Last Seen', sortable: false },
  { key: 'action',     label: '',          sortable: false },
]

const FILTERS = [
  { value: 'ALL',         label: 'All'         },
  { value: 'OPERATIONAL', label: 'Operational' },
  { value: 'IDLE',        label: 'Idle'        },
  { value: 'FAULT',       label: 'Fault'       },
]

const PulseDot = ({ active, color }) => (
  <span style={{ position: 'relative', display: 'inline-flex', width: 9, height: 9, flexShrink: 0 }}>
    {active && (
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: color, opacity: 0.45,
        animation: 'ping 1.4s cubic-bezier(0,0,.2,1) infinite',
      }} />
    )}
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'block' }} />
  </span>
)

const STATUS_MAP = {
  OPERATIONAL: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.25)',  pulse: true  },
  RUNNING:     { color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.25)',  pulse: true  },
  IDLE:        { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.22)',  pulse: false },
  FAULT:       { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.22)', pulse: false },
}

const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status?.toUpperCase()] ?? {
    color: 'rgba(255,255,255,0.38)', bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.1)', pulse: false,
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 12px', borderRadius: 99,
      background: s.bg, border: `1px solid ${s.border}`,
      fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', color: s.color,
      whiteSpace: 'nowrap',
    }}>
      <PulseDot active={s.pulse} color={s.color} />
      {status ?? 'UNKNOWN'}
    </span>
  )
}

const SortIcon = ({ dir }) => (
  <span style={{ fontSize: 11, opacity: dir ? 0.85 : 0.3, marginLeft: 4 }}>
    {dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : '↕'}
  </span>
)

const fmtDate = (ts) => {
  if (!ts) return '—'
  const d = new Date(ts)
  return isNaN(d) ? '—' : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

/* ── Compact Site Card ── */
const SiteCard = ({ site, onSelect }) => (
  <button
    onClick={() => onSelect(site)}
    className="site-card"
    style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: '14px 16px',
      cursor: 'pointer',
      textAlign: 'left',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      transition: 'all 0.2s ease',
      width: '100%',
    }}
  >
    <div style={{
      width: 34, height: 34, borderRadius: 9, flexShrink: 0,
      background: 'rgba(96,165,250,0.1)',
      border: '1px solid rgba(96,165,250,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 15,
    }}>
      🏭
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color: '#f1f5f9',
        letterSpacing: '-0.01em', whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {site}
      </div>
      <div style={{
        fontSize: 11, color: 'rgba(255,255,255,0.35)',
        fontFamily: '"DM Mono", monospace',
        letterSpacing: '0.04em', marginTop: 2,
      }}>
        Click to load →
      </div>
    </div>
  </button>
)

export default function Dashboard() {
  const navigate = useNavigate()
  useAuth()

  const [sites,          setSites]          = useState([])
  const [selectedSite,   setSelectedSite]   = useState('')
  const [sitesLoading,   setSitesLoading]   = useState(true)

  const [machines,   setMachines]   = useState([])
  const [loading,    setLoading]    = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState('')

  const [searchRaw, setSearchRaw] = useState('')
  const [query,     setQuery]     = useState('')
  const [filter,    setFilter]    = useState('ALL')
  const [sort,      setSort]      = useState({ col: null, dir: 'asc' })
  const [page,      setPage]      = useState(1)

  // Holds the 30s polling interval so we can clear it on unmount / site change
  const refreshIntervalRef = useRef(null)

  useEffect(() => {
    const fetchSites = async () => {
      setSitesLoading(true)
      try {
        const res = await api.get('/dashboard/sites')
        setSites(res.data.data || [])
      } catch {
        setError('Failed to load sites.')
      } finally {
        setSitesLoading(false)
      }
    }
    fetchSites()
  }, [])

  const fetchMachines = useCallback(async (siteId, isRefresh = false) => {
    if (!siteId) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const res = await api.get(`/dashboard/sites/${siteId}/overview`)
      setMachines(res.data.data || [])
      setPage(1)
    } catch {
      setError('Failed to load machines for this site.')
      setMachines([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial fetch when site is selected
  useEffect(() => {
    if (selectedSite) fetchMachines(selectedSite)
    else setMachines([])
  }, [selectedSite, fetchMachines])

  // Auto-poll every 30s — silent background refresh so badges stay current
  // without requiring a manual refresh click
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
      refreshIntervalRef.current = null
    }

    if (!selectedSite) return

    refreshIntervalRef.current = setInterval(() => {
      fetchMachines(selectedSite, true)
    }, 30_000)

    return () => {
      clearInterval(refreshIntervalRef.current)
      refreshIntervalRef.current = null
    }
  }, [selectedSite, fetchMachines])

  useEffect(() => {
    const t = setTimeout(() => { setQuery(searchRaw.trim().toLowerCase()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchRaw])

  useEffect(() => { setPage(1) }, [filter])

  const filtered = useMemo(() => {
    let list = machines
    if (filter !== 'ALL') list = list.filter(m => m.status === filter)
    if (query) list = list.filter(m =>
      [m.machine_id, m.name, m.line_id, m.site_id, m.status]
        .some(v => typeof v === 'string' && v.toLowerCase().includes(query))
    )
    return list
  }, [machines, filter, query])

  const sorted = useMemo(() => {
    if (!sort.col) return filtered
    return [...filtered].sort((a, b) => {
      let av, bv
      switch (sort.col) {
        case 'name':       av = a.name;       bv = b.name;       break
        case 'machine_id': av = a.machine_id; bv = b.machine_id; break
        case 'line_id':    av = a.line_id;    bv = b.line_id;    break
        case 'status':     av = a.status;     bv = b.status;     break
        default: return 0
      }
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated  = useMemo(() => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [sorted, page])

  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  const toggleSort = (col) => {
    setSort(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'asc' }
    )
  }

  const thBase = (col) => ({
    padding: '13px 20px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: sort.col === col ? '#60a5fa' : 'rgba(255,255,255,0.55)',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    whiteSpace: 'nowrap',
    cursor: COLUMNS.find(c => c.key === col)?.sortable ? 'pointer' : 'default',
    userSelect: 'none',
    transition: 'color .15s',
  })

  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
    .reduce((acc, n, idx, arr) => {
      if (idx > 0 && n - arr[idx - 1] > 1) acc.push('…')
      acc.push(n)
      return acc
    }, [])

  const stats = useMemo(() => ({
    total:       machines.length,
    operational: machines.filter(m => ['OPERATIONAL','RUNNING'].includes(m.status?.toUpperCase())).length,
    idle:        machines.filter(m => m.status?.toUpperCase() === 'IDLE').length,
    fault:       machines.filter(m => m.status?.toUpperCase() === 'FAULT').length,
  }), [machines])

  const handleSiteSelect = (site) => {
    setSelectedSite(site)
    setFilter('ALL')
    setSearchRaw('')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#070d1a',
      color: '#fff',
      fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');

        @keyframes ping {
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatA {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50%       { transform: translateY(-10px) rotate(2deg); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }

        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }

        .mrow { transition: background .12s; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .mrow:last-child { border-bottom: none; }
        .mrow:hover { background: rgba(96,165,250,0.05) !important; }
        .mrow:hover .row-name { color: #60a5fa !important; }
        .mrow:hover .row-arrow { color: rgba(96,165,250,0.7) !important; }

        .fpill { transition: all .15s; }
        .fpill:hover { border-color: rgba(96,165,250,0.3) !important; color: rgba(255,255,255,0.65) !important; }

        .th-s:hover { color: rgba(255,255,255,0.9) !important; }

        .pg-btn { transition: background .12s; }
        .pg-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12) !important; }

        .ref-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12) !important; }

        input[type="text"]:focus { outline: none; border-color: rgba(96,165,250,0.45) !important; }
        input::placeholder { color: rgba(255,255,255,0.4); }

        .stat-card { transition: border-color .15s, background .15s; }
        .stat-card:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.2) !important; }

        .site-card:hover {
          background: rgba(96,165,250,0.07) !important;
          border-color: rgba(96,165,250,0.3) !important;
          transform: translateY(-1px);
        }
      `}</style>

      <Header />

      <main style={{ flex: 1, padding: '40px 60px 60px', animation: 'fadeIn .4s ease both' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', width: '100%' }}>

          {/* ── Top bar ── */}
          <div style={{
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between', flexWrap: 'wrap',
            gap: 20, marginBottom: 40,
          }}>
            <div>
              <h1 style={{
                fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em',
                margin: 0, color: '#f1f5f9',
                fontFamily: '"Syne", sans-serif',
              }}>
                Machine Dashboard
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>
                Monitor and control your industrial machines in real-time
              </p>
            </div>

            {selectedSite && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Auto-refresh indicator */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 10,
                  background: 'rgba(52,211,153,0.06)',
                  border: '1px solid rgba(52,211,153,0.18)',
                  fontSize: 12, fontWeight: 600,
                  color: refreshing ? '#34d399' : 'rgba(52,211,153,0.55)',
                  letterSpacing: '0.04em',
                  transition: 'color 0.3s',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: refreshing ? '#34d399' : 'rgba(52,211,153,0.4)',
                    display: 'inline-block',
                    boxShadow: refreshing ? '0 0 6px #34d399' : 'none',
                    transition: 'all 0.3s',
                  }} />
                  {refreshing ? 'Refreshing…' : 'Auto-refresh 30s'}
                </div>

                <button
                  onClick={() => setSelectedSite('')}
                  className="ref-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '10px 16px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', letterSpacing: '0.04em',
                    transition: 'background .12s',
                  }}
                >
                  ← Sites
                </button>
                <button
                  className="ref-btn"
                  onClick={() => fetchMachines(selectedSite, true)}
                  disabled={loading || refreshing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '10px 18px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: refreshing ? '#60a5fa' : 'rgba(255,255,255,0.75)',
                    fontSize: 13, fontWeight: 600,
                    cursor: loading || refreshing ? 'not-allowed' : 'pointer',
                    opacity: loading || refreshing ? 0.6 : 1,
                    letterSpacing: '0.04em', transition: 'background .12s',
                  }}
                >
                  <span style={{
                    display: 'inline-block', fontSize: 15,
                    animation: refreshing ? 'spin .7s linear infinite' : 'none',
                  }}>↺</span>
                  Refresh
                </button>
              </div>
            )}
          </div>

          {/* ── EMPTY STATE: hero + site cards ── */}
          {!selectedSite && !sitesLoading && (
            <div style={{ animation: 'fadeInUp 0.5s ease both' }}>

              <div style={{
                position: 'relative',
                background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,16,32,0.95) 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20,
                padding: '32px 40px',
                overflow: 'hidden',
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 40,
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: 'linear-gradient(rgba(96,165,250,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.04) 1px, transparent 1px)',
                  backgroundSize: '48px 48px',
                  pointerEvents: 'none',
                }} />

                <div style={{
                  position: 'absolute', top: -50, left: -50,
                  width: 240, height: 240,
                  background: 'radial-gradient(circle, rgba(96,165,250,0.1) 0%, transparent 65%)',
                  pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'absolute', bottom: -60, right: 60,
                  width: 320, height: 240,
                  background: 'radial-gradient(circle, rgba(129,140,248,0.08) 0%, transparent 65%)',
                  pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: 108, height: 108,
                    borderRadius: '50%',
                    border: '1px solid rgba(96,165,250,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                    animation: 'floatA 6s ease-in-out infinite',
                  }}>
                    <div style={{
                      width: 80, height: 80,
                      borderRadius: '50%',
                      border: '1px solid rgba(96,165,250,0.35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(96,165,250,0.05)',
                    }}>
                      <div style={{
                        width: 52, height: 52,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(96,165,250,0.2), rgba(129,140,248,0.2))',
                        border: '1px solid rgba(96,165,250,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22,
                        boxShadow: '0 0 20px rgba(96,165,250,0.15)',
                      }}>
                        🏭
                      </div>
                    </div>

                    {[0, 90, 180, 270].map((deg) => (
                      <div key={deg} style={{
                        position: 'absolute',
                        width: 6, height: 6,
                        borderRadius: '50%',
                        background: '#60a5fa',
                        boxShadow: '0 0 6px rgba(96,165,250,0.8)',
                        top: '50%', left: '50%',
                        transform: `rotate(${deg}deg) translateX(52px) translateY(-50%)`,
                        animation: 'pulse-slow 2s ease-in-out infinite',
                        animationDelay: `${deg / 90 * 0.5}s`,
                      }} />
                    ))}
                  </div>
                </div>

                <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '4px 11px', borderRadius: 99,
                    background: 'rgba(96,165,250,0.1)',
                    border: '1px solid rgba(96,165,250,0.25)',
                    fontSize: 10, fontWeight: 700,
                    color: '#60a5fa', letterSpacing: '0.12em',
                    textTransform: 'uppercase', marginBottom: 12,
                    fontFamily: '"DM Mono", monospace',
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: '#60a5fa', boxShadow: '0 0 6px #60a5fa',
                      animation: 'pulse-slow 1.5s ease-in-out infinite',
                    }} />
                    Industrial PLC Monitor
                  </div>

                  <h2 style={{
                    fontSize: 24, fontWeight: 800,
                    fontFamily: '"Syne", sans-serif',
                    letterSpacing: '-0.03em',
                    color: '#f1f5f9',
                    margin: '0 0 8px',
                    lineHeight: 1.2,
                  }}>
                    Select a site to{' '}
                    <span style={{
                      background: 'linear-gradient(90deg, #60a5fa, #a78bfa)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}>
                      begin monitoring
                    </span>
                  </h2>

                  <p style={{
                    fontSize: 13, color: 'rgba(255,255,255,0.45)',
                    margin: '0 0 18px', lineHeight: 1.6, maxWidth: 400,
                  }}>
                    Choose a production site below to view real-time machine telemetry, status, and CAN bus data.
                  </p>

                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {[
                      { icon: '⚡', label: 'Real-time telemetry' },
                      { icon: '🔧', label: 'Remote control'      },
                      { icon: '📊', label: 'CAN bus monitoring'  },
                      { icon: '🔔', label: 'Fault detection'     },
                    ].map(f => (
                      <div key={f.label} style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', borderRadius: 99,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: 11, fontWeight: 600,
                        color: 'rgba(255,255,255,0.5)',
                      }}>
                        <span style={{ fontSize: 11 }}>{f.icon}</span>
                        {f.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {sites.length > 0 && (
                <div>
                  <p style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
                    color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase',
                    marginBottom: 10,
                    fontFamily: '"DM Mono", monospace',
                  }}>
                    Available sites — {sites.length} location{sites.length !== 1 ? 's' : ''}
                  </p>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 10,
                  }}>
                    {sites.map((site, i) => (
                      <div key={site} style={{ animation: `fadeInUp 0.4s ease ${i * 0.06}s both` }}>
                        <SiteCard site={site} onSelect={handleSiteSelect} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sitesLoading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{
                      height: 64, borderRadius: 12,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      animation: 'pulse-slow 1.5s ease-in-out infinite',
                      animationDelay: `${i * 0.15}s`,
                    }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SITE SELECTED: stats + table ── */}
          {selectedSite && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 24, animation: 'fadeIn .3s ease both',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 14px', borderRadius: 99,
                  background: 'rgba(96,165,250,0.1)',
                  border: '1px solid rgba(96,165,250,0.25)',
                  fontSize: 13, fontWeight: 600, color: '#60a5fa',
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
                  {selectedSite}
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                  {loading ? 'Loading machines…' : `${machines.length} machine${machines.length !== 1 ? 's' : ''} found`}
                </span>
              </div>

              {error && (
                <div style={{
                  marginBottom: 14, padding: '12px 16px',
                  background: 'rgba(248,113,113,0.07)',
                  border: '1px solid rgba(248,113,113,0.2)',
                  borderRadius: 12, fontSize: 14, color: '#f87171',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span>⚠</span> {error}
                </div>
              )}

              {!loading && machines.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
                  {[
                    { label: 'Total',       value: stats.total,       color: '#60a5fa', icon: '⚙' },
                    { label: 'Operational', value: stats.operational, color: '#4ade80', icon: '✓' },
                    { label: 'Idle',        value: stats.idle,        color: '#fbbf24', icon: '◷' },
                    { label: 'Fault',       value: stats.fault,       color: '#f87171', icon: '⚠' },
                  ].map(card => (
                    <div key={card.label} className="stat-card" style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 14, padding: '18px 22px',
                      display: 'flex', alignItems: 'center', gap: 16,
                    }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                        background: `${card.color}18`, border: `1px solid ${card.color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, color: card.color,
                      }}>
                        {card.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: card.color, lineHeight: 1 }}>{card.value}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{card.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 380 }}>
                  <span style={{
                    position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 15, color: 'rgba(255,255,255,0.45)', pointerEvents: 'none',
                  }}>⌕</span>
                  <input
                    type="text"
                    value={searchRaw}
                    onChange={e => setSearchRaw(e.target.value)}
                    placeholder="Search machines…"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10, padding: '10px 14px 10px 36px',
                      fontSize: 14, color: '#fff', transition: 'border-color .15s',
                    }}
                  />
                </div>

                <div style={{
                  display: 'flex', gap: 5,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12, padding: 5,
                }}>
                  {FILTERS.map(f => (
                    <button key={f.value} className="fpill" onClick={() => setFilter(f.value)} style={{
                      fontSize: 13, fontWeight: 600, letterSpacing: '0.05em',
                      padding: '7px 18px', borderRadius: 9,
                      border: filter === f.value ? '1px solid rgba(96,165,250,0.35)' : '1px solid transparent',
                      background: filter === f.value ? 'rgba(96,165,250,0.12)' : 'transparent',
                      color: filter === f.value ? '#60a5fa' : 'rgba(255,255,255,0.65)',
                      cursor: 'pointer',
                    }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
                {sorted.length} machine{sorted.length !== 1 ? 's' : ''}
                {(filter !== 'ALL' || query) ? ` (filtered from ${machines.length})` : ''}
              </p>

              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16, overflow: 'hidden',
              }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                        {COLUMNS.map(col => (
                          <th key={col.key} className={col.sortable ? 'th-s' : ''} style={thBase(col.key)} onClick={() => col.sortable && toggleSort(col.key)}>
                            {col.label}
                            {col.sortable && <SortIcon dir={sort.col === col.key ? sort.dir : null} />}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={COLUMNS.length} style={{ padding: '64px', textAlign: 'center' }}>
                            <div style={{
                              width: 28, height: 28, margin: '0 auto 12px',
                              border: '2px solid rgba(96,165,250,0.2)',
                              borderTopColor: '#60a5fa', borderRadius: '50%',
                              animation: 'spin .75s linear infinite',
                            }} />
                            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Loading machines…</p>
                          </td>
                        </tr>
                      ) : paginated.length === 0 ? (
                        <tr>
                          <td colSpan={COLUMNS.length} style={{ padding: '48px', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>
                            No machines found for this site.
                          </td>
                        </tr>
                      ) : paginated.map((m, idx) => (
                        <tr key={m.machine_id} className="mrow" onClick={() => navigate(`/machine/${m.machine_id}`)} style={{ background: 'transparent' }}>
                          <td style={{ padding: '17px 20px', color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                            {(page - 1) * PAGE_SIZE + idx + 1}
                          </td>
                          <td style={{ padding: '17px 20px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                              }}>⚙</div>
                              <span className="row-name" style={{ fontWeight: 600, fontSize: 14, color: '#fff', transition: 'color .12s', whiteSpace: 'nowrap' }}>
                                {m.name ?? m.machine_id}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '17px 20px', fontFamily: '"DM Mono","JetBrains Mono",monospace', fontSize: 13, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.6)' }}>
                            {m.machine_id}
                          </td>
                          <td style={{ padding: '17px 20px', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                            {m.line_id ?? '—'}
                          </td>
                          <td style={{ padding: '17px 20px' }}>
                            <StatusBadge status={m.status} />
                          </td>
                          <td style={{ padding: '17px 20px', fontFamily: '"DM Mono","JetBrains Mono",monospace', fontSize: 12, letterSpacing: '0.03em', color: 'rgba(255,255,255,0.4)' }}>
                            {fmtDate(m.last_updated)}
                          </td>
                          <td style={{ padding: '17px 20px', textAlign: 'right' }}>
                            <span className="row-arrow" style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)', transition: 'color .12s' }}>→</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 18px',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                  }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} machines
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <button className="pg-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{
                        padding: '6px 14px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        color: page === 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.8)',
                        fontSize: 12, fontWeight: 600, cursor: page === 1 ? 'not-allowed' : 'pointer',
                      }}>← Prev</button>
                      {pageNums.map((n, i) =>
                        n === '…' ? (
                          <span key={`e${i}`} style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', padding: '0 2px' }}>…</span>
                        ) : (
                          <button key={n} className="pg-btn" onClick={() => setPage(n)} style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: page === n ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
                            border: page === n ? '1px solid rgba(96,165,250,0.35)' : '1px solid rgba(255,255,255,0.08)',
                            color: page === n ? '#60a5fa' : 'rgba(255,255,255,0.75)',
                            fontSize: 12, fontWeight: page === n ? 700 : 500, cursor: 'pointer',
                          }}>{n}</button>
                        )
                      )}
                      <button className="pg-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{
                        padding: '6px 14px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        color: page === totalPages ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.8)',
                        fontSize: 12, fontWeight: 600, cursor: page === totalPages ? 'not-allowed' : 'pointer',
                      }}>Next →</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{sorted.length} machine{sorted.length !== 1 ? 's' : ''}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Click any row to open live view</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <FooterFixed />
    </div>
  )
}