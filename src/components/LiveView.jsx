import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuth } from '../context/AuthContext'
import { getMachine, sendCommand } from '../services/machineService'
import { toast } from 'react-toastify'
import Header from './Header'
import api from '../services/api'

/* ─────────────────────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────────────────────── */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg-base:      #050810;
      --bg-surface:   #090d17;
      --bg-raised:    #0d1322;
      --bg-card:      #101828;
      --border-dim:   rgba(255,255,255,0.08);
      --border-mid:   rgba(255,255,255,0.13);
      --border-bright:rgba(255,255,255,0.22);
      --text-primary:   #f0f4ff;
      --text-secondary: rgba(210,220,255,0.75);
      --text-muted:     rgba(180,195,240,0.55);
      --accent-blue:   #60a5fa;
      --accent-cyan:   #22d3ee;
      --accent-violet: #a78bfa;
      --accent-green:  #34d399;
      --accent-amber:  #fbbf24;
      --accent-red:    #f87171;
      --font-display: 'Space Grotesk', sans-serif;
      --font-mono:    'Space Mono', monospace;
      --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px;
      --transition: 200ms cubic-bezier(0.4,0,0.2,1);
    }

    @keyframes pulse-ring {
      0%   { transform: scale(1);   opacity: 0.6; }
      70%  { transform: scale(2.4); opacity: 0; }
      100% { transform: scale(2.4); opacity: 0; }
    }
    @keyframes sweep-in {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes slide-right { from { width: 0; } }
    @keyframes blink-dot {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.25; }
    }
    @keyframes scan-line {
      0%   { top: 0%; }
      100% { top: 100%; }
    }

    ::-webkit-scrollbar { width: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 99px; }

    .lv-root {
      min-height: 100vh;
      background: var(--bg-base);
      color: var(--text-primary);
      font-family: var(--font-display);
      display: flex; flex-direction: column;
      position: relative; overflow-x: hidden;
    }
    .lv-root::before {
      content: '';
      position: fixed; inset: 0;
      background-image:
        linear-gradient(rgba(59,130,246,0.045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(59,130,246,0.045) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none; z-index: 0;
    }
    .lv-root::after {
      content: '';
      position: fixed; top: -20%; left: 50%; transform: translateX(-50%);
      width: 60vw; height: 50vh;
      background: radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 70%);
      pointer-events: none; z-index: 0;
    }
  `}</style>
)

/* ─────────────────────────────────────────────────────────
   ATOMS
───────────────────────────────────────────────────────── */
const LiveDot = ({ active, color = '#34d399', size = 8 }) => (
  <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
    {active && (
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: color, animation: 'pulse-ring 1.6s ease-out infinite',
      }} />
    )}
    <span style={{
      width: size, height: size, borderRadius: '50%',
      background: active ? color : 'rgba(255,255,255,0.2)',
      display: 'block', position: 'relative', zIndex: 1,
    }} />
  </span>
)

const Chip = ({ label, color, bg, icon }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', padding: '5px 11px',
    borderRadius: 99, background: bg, color,
    border: `1px solid ${color}45`,
  }}>
    {icon}{label}
  </span>
)

const Section = ({ title, children, delay = 0 }) => (
  <section style={{ animation: `sweep-in 0.5s ease ${delay}s both`, position: 'relative', zIndex: 1 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
      <div style={{
        width: 3, height: 16, borderRadius: 99,
        background: 'linear-gradient(180deg, #60a5fa, #a78bfa)', flexShrink: 0,
      }} />
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
        color: 'rgba(180,200,255,0.7)', textTransform: 'uppercase',
      }}>
        {title}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
    </div>
    {children}
  </section>
)

/* ─────────────────────────────────────────────────────────
   STAT CARD
───────────────────────────────────────────────────────── */
const StatCard = ({ label, value, unit, accent = '#60a5fa', mono = false, alert }) => {
  const hasValue = value !== null && value !== undefined
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${alert ? accent + '50' : 'rgba(255,255,255,0.09)'}`,
        borderRadius: 14, padding: '16px 18px',
        display: 'flex', flexDirection: 'column', gap: 10,
        position: 'relative', overflow: 'hidden',
        transition: 'border-color var(--transition), transform var(--transition)',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = accent + '60'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = alert ? accent + '50' : 'rgba(255,255,255,0.09)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${accent}00, ${accent}90, ${accent}00)`,
        opacity: hasValue ? 1 : 0.25,
      }} />
      <div style={{
        position: 'absolute', bottom: -24, right: -16, width: 80, height: 80,
        borderRadius: '50%', background: accent,
        filter: 'blur(32px)', opacity: 0.09, pointerEvents: 'none',
      }} />
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.13em',
        color: 'rgba(180,200,255,0.65)', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{
          fontSize: 22, fontWeight: 700, lineHeight: 1,
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
          color: hasValue ? accent : 'rgba(255,255,255,0.18)',
          letterSpacing: mono ? '0.06em' : '-0.01em',
          textShadow: hasValue ? `0 0 20px ${accent}50` : 'none',
        }}>
          {hasValue ? value : '—'}
        </span>
        {unit && hasValue && (
          <span style={{ fontSize: 12, color: 'rgba(180,200,255,0.55)', fontWeight: 600 }}>{unit}</span>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   BOOL CARD
───────────────────────────────────────────────────────── */
const BoolCard = ({ label, value, trueColor = '#34d399', falseColor = 'rgba(255,255,255,0.25)' }) => {
  const isTrue = value === true
  const color  = value == null ? 'rgba(255,255,255,0.22)' : isTrue ? trueColor : falseColor
  const label2 = value == null ? '—' : isTrue ? 'Active' : 'Inactive'
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${isTrue ? color + '40' : 'rgba(255,255,255,0.09)'}`,
      borderRadius: 14, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'all var(--transition)',
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.13em',
        color: 'rgba(180,200,255,0.65)', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LiveDot active={isTrue} color={color} size={9} />
          <span style={{
            fontSize: 12, fontWeight: 800, letterSpacing: '0.1em',
            textTransform: 'uppercase', color,
            textShadow: isTrue ? `0 0 12px ${color}60` : 'none',
          }}>
            {label2}
          </span>
        </div>
        <div style={{
          width: 34, height: 18, borderRadius: 99,
          background: isTrue ? color + '28' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${isTrue ? color + '70' : 'rgba(255,255,255,0.12)'}`,
          position: 'relative', transition: 'all var(--transition)',
        }}>
          <div style={{
            position: 'absolute', top: 2, left: isTrue ? 16 : 2,
            width: 12, height: 12, borderRadius: '50%',
            background: isTrue ? color : 'rgba(255,255,255,0.28)',
            transition: 'all var(--transition)',
            boxShadow: isTrue ? `0 0 6px ${color}80` : 'none',
          }} />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   COUNTER BAR
───────────────────────────────────────────────────────── */
const CounterBar = ({ label, value, max = 9999, color = '#a78bfa' }) => {
  const pct = max > 0 ? Math.min(((value ?? 0) / max) * 100, 100) : 0
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 14, padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.13em',
          color: 'rgba(180,200,255,0.65)', textTransform: 'uppercase',
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color, lineHeight: 1, textShadow: `0 0 16px ${color}50`,
        }}>
          {value ?? '—'}
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          width: `${pct}%`,
          animation: 'slide-right 1s ease both',
          boxShadow: `0 0 10px ${color}70`,
        }} />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   COMMAND BUTTON
───────────────────────────────────────────────────────── */
const CmdBtn = ({ label, icon, onClick, disabled, variant = 'neutral' }) => {
  const themes = {
    success: {
      idle:  { bg: 'rgba(52,211,153,0.09)',  border: 'rgba(52,211,153,0.35)',  color: '#34d399' },
      hover: { bg: 'rgba(52,211,153,0.18)' },
    },
    danger: {
      idle:  { bg: 'rgba(248,113,113,0.09)', border: 'rgba(248,113,113,0.35)', color: '#f87171' },
      hover: { bg: 'rgba(248,113,113,0.18)' },
    },
    neutral: {
      idle:  { bg: 'rgba(96,165,250,0.09)',  border: 'rgba(96,165,250,0.35)',  color: '#60a5fa' },
      hover: { bg: 'rgba(96,165,250,0.18)' },
    },
  }
  const t = themes[variant]
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '11px 22px', borderRadius: 10,
        background: t.idle.bg, border: `1px solid ${t.idle.border}`,
        color: t.idle.color,
        fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)',
        letterSpacing: '0.07em', textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.32 : 1,
        transition: 'all var(--transition)',
        textShadow: `0 0 12px ${t.idle.color}50`,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = t.hover.bg }}
      onMouseLeave={e => { e.currentTarget.style.background = t.idle.bg }}
    >
      <span style={{ fontSize: 15 }}>{icon}</span>
      {label}
    </button>
  )
}

/* ─────────────────────────────────────────────────────────
   UPTIME DISPLAY
───────────────────────────────────────────────────────── */
const UptimeDisplay = ({ ms }) => {
  if (ms == null) return (
    <span style={{ color: 'rgba(160,180,230,0.45)', fontFamily: 'var(--font-mono)', fontSize: 20 }}>—</span>
  )
  const s   = Math.floor(ms / 1000)
  const h   = Math.floor(s / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700,
      color: '#34d399', letterSpacing: '0.06em',
      textShadow: '0 0 18px rgba(52,211,153,0.45)',
    }}>
      {String(h).padStart(2, '0')}
      <span style={{ color: 'rgba(52,211,153,0.45)', margin: '0 2px' }}>:</span>
      {String(m).padStart(2, '0')}
      <span style={{ color: 'rgba(52,211,153,0.45)', margin: '0 2px' }}>:</span>
      {String(sec).padStart(2, '0')}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────
   MACHINE STATUS BADGE
───────────────────────────────────────────────────────── */
const MachineStatusBadge = ({ status }) => {
  const map = {
    'RUNNING':     { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  label: 'Running'   },
    'STOPPED':     { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Stopped'   },
    'IDLE':        { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  label: 'Idle'      },
    'FAULT':       { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Fault'     },
    'POWER OFF':   { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  label: 'Power Off' },
  }
  const s = map[status] || { color: 'rgba(200,215,255,0.4)', bg: 'rgba(255,255,255,0.06)', label: status || '—' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', padding: '6px 14px',
      borderRadius: 99, background: s.bg, color: s.color,
      border: `1px solid ${s.color}45`,
    }}>
      <LiveDot active={status === 'RUNNING'} color={s.color} size={6} />
      {s.label}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────
   ALERT BANNER
───────────────────────────────────────────────────────── */
const AlertBanner = ({ color, bg, border, icon, children }) => (
  <div style={{
    background: bg, border: `1px solid ${border}`,
    borderRadius: 10, padding: '12px 18px',
    fontSize: 13, color,
    display: 'flex', alignItems: 'center', gap: 10,
    fontWeight: 600, letterSpacing: '0.01em',
  }}>
    <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
    {children}
  </div>
)

/* ─────────────────────────────────────────────────────────
   MACHINE HERO
───────────────────────────────────────────────────────── */
const MachineHero = ({ machine, machineId, decoded, displayStatus }) => (
  <div style={{
    background: 'var(--bg-surface)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    padding: '18px 32px',
    position: 'relative', zIndex: 1, overflow: 'hidden',
  }}>
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: '35%',
      background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.04))',
      pointerEvents: 'none',
    }} />

    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>

      {/* Machine icon */}
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(96,165,250,0.18), rgba(167,139,250,0.18))',
          border: '1px solid rgba(96,165,250,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>⚙</div>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.9), transparent)',
          animation: 'scan-line 2s linear infinite',
        }} />
      </div>

      {/* Name + ID */}
      <div>
        <p style={{
          fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em',
          color: '#f0f4ff', lineHeight: 1.2,
        }}>
          {machine?.name || machineId}
        </p>
        <p style={{
          fontSize: 11, color: 'rgba(160,185,240,0.65)',
          fontWeight: 600, letterSpacing: '0.09em',
          textTransform: 'uppercase', marginTop: 4,
        }}>
          {machine?.mode || 'PLC Controller'} &nbsp;·&nbsp; ID: {machineId}
        </p>
      </div>

      <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.09)', flexShrink: 0 }} />

      {/* Hero stat pills */}
      {[
        { label: 'CAN State',    val: decoded?.canState  || '—',      color: '#60a5fa', mono: false },
        { label: 'Node ID',      val: decoded?.canNodeId ?? '—',      color: 'rgba(210,220,255,0.85)', mono: true },
        { label: 'Status Word',  val: decoded?.statusWord != null
            ? `0x${Number(decoded.statusWord).toString(16).toUpperCase().padStart(4,'0')}`
            : '—',
          color: '#a78bfa', mono: true },
        { label: 'State',        val: decoded?.statusWordText || '—', color: '#22d3ee', mono: false },
        { label: 'Mode',         val: decoded?.modeDisplayText || '—', color: '#fbbf24', mono: false },
      ].map(({ label, val, color, mono }) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
            color: 'rgba(160,185,240,0.55)', textTransform: 'uppercase',
          }}>
            {label}
          </span>
          <span style={{
            fontSize: 14, fontWeight: 700, color,
            fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
            textShadow: `0 0 14px ${color}50`,
          }}>
            {val}
          </span>
        </div>
      ))}

      <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.09)', flexShrink: 0 }} />

      {/* Status chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <MachineStatusBadge status={displayStatus} />

        <Chip
          label={decoded?.alarmStatus === 'ACTIVE' ? 'Alarm Active' : 'No Alarm'}
          color={decoded?.alarmStatus === 'ACTIVE' ? '#f87171' : '#34d399'}
          bg={decoded?.alarmStatus === 'ACTIVE' ? 'rgba(248,113,113,0.12)' : 'rgba(52,211,153,0.08)'}
          icon={<LiveDot active={decoded?.alarmStatus === 'ACTIVE'} color={decoded?.alarmStatus === 'ACTIVE' ? '#f87171' : '#34d399'} size={6} />}
        />

        {decoded?.warningActive && (
          <Chip
            label="Warning"
            color="#fbbf24"
            bg="rgba(251,191,36,0.12)"
            icon={<LiveDot active color="#fbbf24" size={6} />}
          />
        )}
      </div>
    </div>
  </div>
)

/* ─────────────────────────────────────────────────────────
   NORMALIZE DB STATUS → DISPLAY BADGE STATUS
───────────────────────────────────────────────────────── */
const normalizeDbStatus = (raw) => {
  switch ((raw || '').toLowerCase()) {
    case 'running':     return 'RUNNING'
    case 'operational': return 'RUNNING'
    case 'stopped':     return 'STOPPED'
    case 'idle':        return 'IDLE'
    case 'fault':       return 'FAULT'
    case 'error':       return 'FAULT'
    case 'power off':   return 'POWER OFF'
    default:            return 'STOPPED'
  }
}

/* ─────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────── */
const LiveView = () => {
  const { machineId }                     = useParams()
  const navigate                          = useNavigate()
  const { logout }                        = useAuth()

  // wsDbStatus is null until the first machine_status WS event fires
  const { telemetry, decoded, connected, dbStatus: wsDbStatus } = useWebSocket(machineId)

  const [machine,          setMachine]          = useState(null)
  const [sending,          setSending]          = useState(false)
  const [cmdSent,          setCmdSent]          = useState(null)
  // Seeded once from HTTP on mount so the badge is correct before any WS event arrives.
  // Also updated by the fallback poll after a command.
  const [initialStatus,    setInitialStatus]    = useState(null)
  // Optimistic status — set immediately on command click to bridge the WS gap.
  // Cleared the moment WS fires a machine_status event.
  const [optimisticStatus, setOptimisticStatus] = useState(null)

  // Priority chain: WS event > optimistic > HTTP seed
  const dbStatus = wsDbStatus ?? optimisticStatus ?? initialStatus

  // Clear optimistic the moment WS takes over — prevents stale optimistic value
  // from lingering after a WS machine_status event arrives.
  useEffect(() => {
    if (wsDbStatus !== null) {
      setOptimisticStatus(null)
    }
  }, [wsDbStatus])

  useEffect(() => {
    getMachine(machineId)
      .then(res => setMachine(res.data.data))
      .catch(() => {})

    // One-time HTTP seed — NOT polling. WebSocket takes over after this.
    api.get(`/dashboard/machine/${machineId}`)
      .then(res => setInitialStatus(res.data.data?.status ?? null))
      .catch(() => {})
  }, [machineId])

  const handleCommand = async (cmd) => {
    setSending(true)
    setCmdSent(cmd)

    // ① Optimistic update — immediately reflect the expected new state so the
    //    buttons respond without waiting for the WS machine_status broadcast.
    const expectedStatus = cmd === 'start' ? 'running' : 'stopped'
    setOptimisticStatus(expectedStatus)

    try {
      await sendCommand(
        machineId,
        cmd,
        {},
        decoded?.siteId || telemetry?.siteId || 'site_01',
        decoded?.lineId || telemetry?.lineId || 'line_01',
      )
      toast.success(`Command [${cmd}] dispatched`)

      // ③ Fallback poll — fires only if WS hasn't updated wsDbStatus yet.
      //    If WS fires first, wsDbStatus wins and this write to initialStatus
      //    has no effect on dbStatus (WS ?? optimistic ?? initialStatus).
      setTimeout(async () => {
        try {
          const res = await api.get(`/dashboard/machine/${machineId}`)
          const polledStatus = res.data.data?.status ?? null
          setInitialStatus(polledStatus)
        } catch { /* silent — WS is the source of truth */ }
      }, 2500)

    } catch {
      toast.error(`Failed to send [${cmd}]`)
      // ② Roll back optimistic update on failure so the UI doesn't lie.
      setOptimisticStatus(null)
    } finally {
      setSending(false)
      setTimeout(() => setCmdSent(null), 2500)
    }
  }

  // isRunning is driven by the resolved dbStatus (WS > optimistic > HTTP seed)
  const isRunning = ['running', 'operational'].includes((dbStatus || '').toLowerCase())

  // Badge status shown in Remote Control panel
  const displayStatus = dbStatus ? normalizeDbStatus(dbStatus) : null

  return (
    <div className="lv-root">
      <GlobalStyles />

      <Header
        machineId={machineId}
        machineName={machine?.name}
        machineStatus={displayStatus}
        backBtn
      />

      <MachineHero machine={machine} machineId={machineId} decoded={decoded} displayStatus={displayStatus} />

      {/* Alert banners */}
      {(!connected || decoded?.faultActive || decoded?.warningActive) && (
        <div style={{
          padding: '10px 32px', display: 'flex', flexDirection: 'column', gap: 8,
          position: 'relative', zIndex: 1,
        }}>
          {!connected && (
            <AlertBanner color="#fbbf24" bg="rgba(251,191,36,0.07)" border="rgba(251,191,36,0.28)" icon="⚠">
              WebSocket reconnecting — displaying last known telemetry
            </AlertBanner>
          )}
          {decoded?.faultActive && (
            <AlertBanner color="#f87171" bg="rgba(248,113,113,0.07)" border="rgba(248,113,113,0.28)" icon="✕">
              Fault active — {decoded.errorText} &nbsp;
              <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: '#fca5a5' }}>
                ({decoded.errorCode})
              </code>
            </AlertBanner>
          )}
          {decoded?.warningActive && (
            <AlertBanner color="#fbbf24" bg="rgba(251,191,36,0.05)" border="rgba(251,191,36,0.2)" icon="△">
              Warning active — check system logs for details
            </AlertBanner>
          )}
        </div>
      )}

      {/* Main body */}
      <main style={{
        flex: 1, overflowY: 'auto',
        padding: '28px 32px 64px',
        display: 'flex', flexDirection: 'column', gap: 36,
        position: 'relative', zIndex: 1,
      }}>

        {/* ── Remote Control ── */}
        <Section title="Remote Control" delay={0}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 16, padding: '20px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

              <CmdBtn
                label="Start" icon="▶" variant="success"
                disabled={sending || isRunning}
                onClick={() => handleCommand('start')}
              />
              <CmdBtn
                label="Stop" icon="■" variant="danger"
                disabled={sending || !isRunning}
                onClick={() => handleCommand('stop')}
              />
              {sending && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 6 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: '50%', background: '#60a5fa',
                      animation: `blink-dot 1s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                  <span style={{ fontSize: 12, color: '#93c5fd', fontWeight: 700 }}>Sending…</span>
                </div>
              )}

              {cmdSent && !sending && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6, animation: 'sweep-in 0.2s ease' }}>
                  <span style={{ fontSize: 13, color: '#34d399' }}>✓</span>
                  <span style={{ fontSize: 12, color: '#34d399', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    [{cmdSent}] dispatched
                  </span>
                </div>
              )}
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '18px 0' }} />

            {/* Current machine status row — sourced from resolved dbStatus */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, color: 'rgba(180,200,255,0.55)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Machine status
                </span>
                <MachineStatusBadge status={displayStatus} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, color: 'rgba(180,200,255,0.55)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Drive state
                </span>
                <span style={{ fontSize: 13, color: '#22d3ee', fontWeight: 600 }}>
                  {decoded?.statusWordText || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, color: 'rgba(180,200,255,0.55)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Fault
                </span>
                <span style={{ fontSize: 13, color: decoded?.faultActive ? '#f87171' : '#34d399', fontWeight: 600 }}>
                  {decoded?.errorText || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, color: 'rgba(180,200,255,0.55)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Site / Line
                </span>
                <span style={{ fontSize: 13, color: 'rgba(200,215,255,0.7)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {decoded?.siteId || '—'} / {decoded?.lineId || '—'}
                </span>
              </div>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '14px 0 0' }} />
            <p style={{
              marginTop: 14,
              fontSize: 12, color: 'rgba(180,200,255,0.55)',
              fontWeight: 500, lineHeight: 1.7,
            }}>
              Commands are dispatched directly to the PLC via the CAN bus interface.
              Ensure safety conditions are met before issuing control signals.
            </p>
          </div>
        </Section>

        {/* ── CAN Bus Telemetry ── */}
        <Section title="CAN Bus Telemetry" delay={0.06}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
            <StatCard label="CAN State"    value={decoded?.canState}     accent="#60a5fa" />
            <StatCard label="Node ID"      value={decoded?.canNodeId}    accent="#a78bfa" mono />
            <StatCard label="Status Word"  value={decoded?.statusWord != null
              ? `0x${Number(decoded.statusWord).toString(16).toUpperCase().padStart(4,'0')}`
              : null}
              accent="#a78bfa" mono />
            <StatCard label="Drive State"  value={decoded?.statusWordText} accent="#22d3ee" />
            <StatCard label="Error"        value={decoded?.errorText}
              accent={decoded?.faultActive ? '#f87171' : '#34d399'}
              alert={decoded?.faultActive} />
            <StatCard label="Status Flags" value={decoded?.statusFlags}   accent="rgba(200,215,255,0.65)" mono />
            <StatCard label="Current"      value={decoded?.currentActual} unit="A" accent="#22d3ee" />
            <StatCard label="Mode"         value={decoded?.modeDisplayText} accent="#fbbf24" />

            {/* Uptime card */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(52,211,153,0.25)',
              borderRadius: 14, padding: '16px 18px',
              display: 'flex', flexDirection: 'column', gap: 10,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: 'linear-gradient(90deg, #34d39900, #34d39990, #34d39900)',
              }} />
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.13em',
                color: 'rgba(180,200,255,0.65)', textTransform: 'uppercase',
              }}>
                Device Uptime
              </span>
              <UptimeDisplay ms={decoded?.deviceUptimeMs} />
            </div>
          </div>
        </Section>

        {/* ── Status Flags ── */}
        <Section title="Status Flags" delay={0.12}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            <BoolCard label="Operation Enabled" value={decoded?.operationEnabled} trueColor="#34d399" falseColor="rgba(200,215,255,0.28)" />
            <BoolCard label="Fault Active"      value={decoded?.faultActive}      trueColor="#f87171" falseColor="#34d399" />
            <BoolCard label="Warning Active"    value={decoded?.warningActive}    trueColor="#fbbf24" falseColor="#34d399" />
            <BoolCard label="Remote Active"     value={decoded?.remoteActive}     trueColor="#60a5fa" falseColor="rgba(200,215,255,0.28)" />
          </div>
        </Section>

        {/* ── Counters ── */}
        <Section title="Message Counters" delay={0.18}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            <CounterBar label="RPDO RX Counter"      value={decoded?.rpdoRxCounter}      color="#a78bfa" max={9999} />
            <CounterBar label="Telemetry TX Counter" value={decoded?.telemetryTxCounter} color="#f472b6" max={9999} />
          </div>
        </Section>

        {/* ── Footer timestamp ── */}
        {(decoded?.ts || decoded?.timestamp) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            animation: 'sweep-in 0.4s ease 0.24s both',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: '#34d399',
              animation: 'blink-dot 2s ease-in-out infinite',
              boxShadow: '0 0 8px rgba(52,211,153,0.6)',
            }} />
            <span style={{
              fontSize: 11,
              color: 'rgba(160,185,240,0.60)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
            }}>
              Last telemetry: {new Date(decoded?.ts || decoded?.timestamp).toLocaleString()}
            </span>
          </div>
        )}
      </main>
    </div>
  )
}

export default LiveView