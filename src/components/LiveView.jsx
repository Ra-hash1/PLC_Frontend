import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuth } from '../context/AuthContext'
import { getMachine, sendCommand } from '../services/machineService'
import { toast } from 'react-toastify'
import Header from './Header'
import api from '../services/api'
import { STATUS_WORD_BITS } from '../utils/telemetryDecoder'

// ─── Constants ────────────────────────────────────────────────────────────────
const API_STALE_MS = 2 * 60 * 1000   // 2 min → POWER OFF
const pad2 = (n) => String(Math.floor(n)).padStart(2, '0')

const formatUptime = (ms) => {
  if (!ms || ms <= 0) return null
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  if (h > 0) return `${h}h ${pad2(m)}m`
  if (m > 0) return `${m}m ${pad2(s)}s`
  return `${s}s`
}

/* ─────────────────────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────────────────────── */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      /* ── Backgrounds — clearly separated layers ── */
      --bg-base:      #02060f;
      --bg-surface:   #060c1a;
      --bg-card:      #0b1528;
      --bg-card-hi:   #101e36;
      --bg-inset:     #060d1c;

      /* ── Borders — blue-tinted for depth ── */
      --border-dim:    rgba(80,110,200,0.18);
      --border-mid:    rgba(80,110,200,0.30);
      --border-bright: rgba(96,165,250,0.55);

      /* ── Text ── */
      --text-primary:   #eef2ff;
      --text-secondary: rgba(190,210,255,0.80);
      --text-muted:     rgba(140,165,230,0.55);

      /* ── Accents ── */
      --accent-blue:   #60a5fa;
      --accent-cyan:   #22d3ee;
      --accent-violet: #a78bfa;
      --accent-green:  #34d399;
      --accent-amber:  #fbbf24;
      --accent-red:    #f87171;

      --font-display: 'Space Grotesk', sans-serif;
      --font-mono:    'Space Mono', monospace;
      --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px;
      --transition: 180ms cubic-bezier(0.4,0,0.2,1);
    }

    @keyframes pulse-ring {
      0%   { transform: scale(1);   opacity: 0.7; }
      70%  { transform: scale(2.6); opacity: 0; }
      100% { transform: scale(2.6); opacity: 0; }
    }
    @keyframes sweep-in {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes slide-right { from { width: 0; } }
    @keyframes blink-dot {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.2; }
    }
    @keyframes scan-line {
      0%   { top: 0%; }
      100% { top: 100%; }
    }
    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes glow-pulse {
      0%, 100% { opacity: 0.5; }
      50%       { opacity: 1; }
    }

    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
    ::-webkit-scrollbar-thumb { background: rgba(96,130,220,0.25); border-radius: 99px; }

    /* ── ROOT ── */
    .lv-root {
      min-height: 100vh;
      background: var(--bg-base);
      color: var(--text-primary);
      font-family: var(--font-display);
      display: flex; flex-direction: column;
      position: relative; overflow-x: hidden;
    }
    /* Dot-grid overlay */
    .lv-root::before {
      content: '';
      position: fixed; inset: 0;
      background-image: radial-gradient(rgba(80,120,255,0.12) 1px, transparent 1px);
      background-size: 28px 28px;
      pointer-events: none; z-index: 0;
    }
    /* Central ambient glow */
    .lv-root::after {
      content: '';
      position: fixed; top: -10%; left: 50%; transform: translateX(-50%);
      width: 70vw; height: 55vh;
      background: radial-gradient(ellipse, rgba(59,100,246,0.13) 0%, rgba(120,60,250,0.06) 50%, transparent 75%);
      pointer-events: none; z-index: 0;
    }

    /* ── HERO ── */
    .lv-hero {
      background: linear-gradient(180deg, #0a1428 0%, #070f1e 100%);
      border-bottom: 1px solid rgba(80,110,200,0.30);
      padding: 20px 32px;
      position: relative; z-index: 1; overflow: hidden;
      box-shadow: 0 1px 0 rgba(96,165,250,0.08);
    }
    .lv-hero::after {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(96,165,250,0.5) 40%, rgba(167,139,250,0.4) 70%, transparent);
    }
    .lv-hero-inner {
      display: flex; align-items: center; gap: 22px; flex-wrap: wrap;
    }
    .lv-hero-divider {
      width: 1px; height: 44px;
      background: linear-gradient(180deg, transparent, rgba(96,130,220,0.35), transparent);
      flex-shrink: 0;
    }

    /* ── MAIN ── */
    .lv-main {
      flex: 1; overflow-y: auto;
      padding: 28px 32px 72px;
      display: flex; flex-direction: column; gap: 28px;
      position: relative; z-index: 1;
    }

    /* ── ALERT ZONE ── */
    .lv-alert-zone {
      padding: 10px 32px;
      display: flex; flex-direction: column; gap: 8px;
      position: relative; z-index: 1;
    }

    /* ── CONTROL CARD ── */
    .lv-control-card {
      background: var(--bg-card);
      border: 1px solid var(--border-dim);
      border-radius: 18px; padding: 22px 26px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .lv-cmd-row {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    }
    .lv-status-row {
      display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
    }

    /* ── GRIDS ── */
    .lv-stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
      gap: 12px;
    }
    .lv-bool-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
    .lv-count-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }

    /* ── LAYOUT GRIDS ── */
    /* Equal 2-col: Runtime/Production, Flags/Counters */
    .lv-twin-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      align-items: stretch;
    }
    .lv-twin-grid > * { min-width: 0; }
    /* Cards inside twin-grid fill the row height */
    .lv-twin-grid .lv-clock-card,
    .lv-twin-grid .lv-production-card { height: 100%; }

    /* 3:2 split: Telemetry left, Diagnostics right */
    .lv-panel-grid {
      display: grid;
      grid-template-columns: 3fr 2fr;
      gap: 24px;
      align-items: start;
    }
    .lv-panel-grid > * { min-width: 0; }

    /* Vertical divider in control row */
    .lv-vdivider { display: block; }

    /* Compact batch cutter row */
    .lv-cutter-compact {
      display: flex; gap: 8px; width: 100%;
    }
    .lv-cutter-compact-btn {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 10px 14px; border-radius: 10px;
      border: 1px solid var(--border-dim);
      background: var(--bg-inset);
      cursor: pointer; font-family: var(--font-display);
      font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      transition: all var(--transition);
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.20);
    }
    .lv-cutter-compact-btn:hover {
      border-color: var(--border-mid);
      background: var(--bg-card);
    }

    /* ── DRIVE SELECTOR GRID ── */
    .lv-drives-grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 8px;
    }
    @media (max-width: 700px) {
      .lv-drives-grid { grid-template-columns: repeat(4, 1fr); gap: 6px; }
    }
    .lv-drive-chip {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 8px;
      padding: 14px 8px 12px;
      border-radius: 12px;
      border: 1px solid var(--border-dim);
      background: var(--bg-card);
      position: relative; overflow: hidden;
      cursor: pointer;
      transition: all var(--transition);
      box-shadow: 0 2px 10px rgba(0,0,0,0.22);
      min-width: 0;
    }
    .lv-drive-chip:hover {
      border-color: rgba(96,165,250,0.40);
      background: var(--bg-card-hi);
      transform: translateY(-2px);
      box-shadow: 0 4px 18px rgba(96,165,250,0.10);
    }
    .lv-drive-chip.active {
      border-color: rgba(96,165,250,0.60);
      background: linear-gradient(160deg, rgba(96,165,250,0.14), rgba(96,165,250,0.05));
      box-shadow: 0 0 0 1px rgba(96,165,250,0.22), 0 4px 20px rgba(96,165,250,0.16);
    }
    /* Thin coloured top-bar that doubles as a status indicator */
    .lv-drive-chip::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 2px;
      border-radius: 12px 12px 0 0;
      background: var(--chip-accent, transparent);
      transition: background var(--transition);
    }

    /* ── DRIVE SUMMARY PANEL ── */
    .lv-drive-summary {
      margin-top: 14px;
      background: var(--bg-card);
      border: 1px solid var(--border-dim);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.28);
      animation: fade-in-up 0.25s ease;
    }
    .lv-drive-summary-hdr {
      display: flex; align-items: center; justify-content: space-between; gap: 14px;
      padding: 13px 18px;
      border-bottom: 1px solid rgba(80,110,200,0.12);
      background: linear-gradient(90deg, rgba(96,165,250,0.06), transparent 55%);
      flex-wrap: wrap;
    }
    .lv-drive-summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border-top: 1px solid rgba(80,110,200,0.10);
    }
    .lv-mini-stat {
      padding: 14px 16px;
      display: flex; flex-direction: column; gap: 7px;
      position: relative; min-width: 0;
    }
    .lv-mini-stat + .lv-mini-stat {
      border-left: 1px solid rgba(80,110,200,0.10);
    }
    .lv-mini-stat-label {
      font-size: 9px; font-weight: 700; letter-spacing: 0.15em;
      color: rgba(140,165,230,0.55); text-transform: uppercase;
    }
    .lv-mini-stat-value {
      font-size: 13px; font-weight: 700;
      color: var(--text-primary);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .lv-drive-flags {
      display: flex; gap: 5px; flex-wrap: wrap; padding: 10px 18px;
      border-top: 1px solid rgba(80,110,200,0.10);
      background: rgba(80,110,200,0.03);
    }
    .lv-flag-pill {
      font-size: 8px; font-weight: 800; letter-spacing: 0.08em;
      padding: 3px 7px; border-radius: 5px;
      text-transform: uppercase;
    }

    @media (max-width: 600px) {
      /* 3-col → 1-col on narrow screens */
      .lv-drive-summary-grid { grid-template-columns: 1fr !important; }
      .lv-mini-stat + .lv-mini-stat {
        border-left: none;
        border-top: 1px solid rgba(80,110,200,0.10);
      }
    }

    /* ── PRODUCTION ── */
    .lv-production-card {
      background: var(--bg-card);
      border: 1px solid var(--border-dim);
      border-radius: 18px; padding: 22px 26px;
      display: flex; align-items: center; justify-content: space-between; gap: 20px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04);
      position: relative; overflow: hidden;
    }
    .lv-production-card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, transparent, rgba(96,165,250,0.7) 30%, rgba(167,139,250,0.6) 70%, transparent);
    }

    /* ── RUNTIME CLOCK ── */
    .lv-clock-card {
      background: var(--bg-card);
      border: 1px solid var(--border-dim);
      border-radius: 18px; padding: 22px 26px;
      display: flex; align-items: center; justify-content: space-between; gap: 20px;
      flex-wrap: wrap;
      box-shadow: 0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04);
      position: relative; overflow: hidden;
    }
    .lv-clock-card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, transparent, rgba(52,211,153,0.70) 40%, rgba(34,211,238,0.50) 70%, transparent);
    }
    .lv-clock-seg { display: flex; flex-direction: column; align-items: center; gap: 5px; }
    .lv-clock-box {
      background: var(--bg-inset);
      border-radius: 10px;
      border: 1px solid rgba(52,211,153,0.22);
      padding: 8px 14px;
      box-shadow: 0 0 16px rgba(52,211,153,0.08), inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .lv-clock-digit {
      font-family: var(--font-mono); font-size: 30px; font-weight: 700;
      color: #34d399;
      letter-spacing: 0.06em;
      text-shadow: 0 0 20px rgba(52,211,153,0.55);
    }
    .lv-clock-unit {
      font-size: 9px; font-weight: 700; letter-spacing: 0.18em;
      color: rgba(52,211,153,0.55); text-transform: uppercase;
    }
    .lv-clock-colon {
      font-family: var(--font-mono); font-size: 26px; font-weight: 700;
      color: rgba(52,211,153,0.30); margin-bottom: 16px; flex-shrink: 0;
    }

    /* ── BATCH CUTTER ── */
    .lv-cutter-btn {
      flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 20px 16px;
      border-radius: 16px;
      border: 1px solid var(--border-dim);
      background: var(--bg-inset);
      cursor: pointer;
      transition: all var(--transition);
      color: var(--text-muted); font-weight: 700; font-size: 14px;
      font-family: var(--font-display);
      box-shadow: 0 2px 12px rgba(0,0,0,0.25);
    }
    .lv-cutter-btn:hover {
      border-color: var(--border-mid);
      background: var(--bg-card);
      transform: translateY(-1px);
    }

    /* ── DIAG TABLE ── */
    .lv-diag-table { width: 100%; }
    .lv-diag-row {
      display: flex; justify-content: space-between; align-items: center;
    }
    /* Non-striped: separator between rows */
    .lv-diag-table:not(.striped) .lv-diag-row {
      padding: 12px 0;
    }
    .lv-diag-table:not(.striped) .lv-diag-row + .lv-diag-row {
      border-top: 1px solid rgba(80,110,200,0.14);
    }
    .lv-diag-label {
      font-size: 12px; color: var(--text-muted); flex: 1; font-weight: 500;
    }
    .lv-diag-value {
      font-size: 12px; font-weight: 700; color: var(--text-primary);
      text-align: right; flex: 1; font-family: var(--font-display);
    }

    /* ── ALARM CARD ── */
    .lv-alarm-card {
      background: linear-gradient(135deg, rgba(248,113,113,0.08), rgba(248,113,113,0.04));
      border: 1px solid rgba(248,113,113,0.40);
      border-radius: 18px; padding: 20px 22px;
      animation: fade-in-up 0.3s ease;
      box-shadow: 0 0 24px rgba(248,113,113,0.08);
    }

    /* ──────────────────────────────────────
       RESPONSIVE
    ────────────────────────────────────── */
    @media (max-width: 900px) {
      .lv-main         { padding: 20px 20px 60px; gap: 24px; }
      .lv-hero         { padding: 16px 20px; }
      .lv-alert-zone   { padding: 8px 20px; }
      .lv-control-card { padding: 18px 20px; }
      /* Collapse telemetry+diag side-by-side at tablet */
      .lv-panel-grid   { grid-template-columns: 1fr; }
    }

    @media (max-width: 640px) {
      .lv-main { padding: 16px 14px 52px; gap: 20px; }
      .lv-hero { padding: 14px; }
      .lv-alert-zone { padding: 8px 14px; }

      .lv-hero-inner { gap: 12px; }
      .lv-hero-icon  { display: none; }
      .lv-hero-name  { font-size: 15px !important; }
      .lv-hero-divider { display: none; }
      .lv-hero-stat-pills { gap: 10px !important; }

      .lv-stat-grid  { grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .lv-bool-grid  { grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .lv-count-grid { grid-template-columns: 1fr; gap: 8px; }

      /* Collapse both twin-grid instances */
      .lv-twin-grid  { grid-template-columns: 1fr; gap: 12px; }

      .lv-control-card { padding: 14px 16px; }
      .lv-cmd-row  { gap: 8px; }
      .lv-cmd-btn-full { flex: 1; justify-content: center !important; }
      .lv-status-row { gap: 12px; }
      .lv-alert-text { font-size: 12px !important; padding: 10px 12px !important; }

      .lv-clock-digit { font-size: 22px !important; }
      .lv-clock-box   { padding: 6px 10px !important; }

      /* Hide the vertical divider inside control card on mobile */
      .lv-vdivider { display: none; }
    }

    @media (max-width: 400px) {
      .lv-main { padding: 12px 10px 44px; gap: 16px; }
      .lv-stat-grid  { grid-template-columns: repeat(2, 1fr); gap: 6px; }
      .lv-bool-grid  { grid-template-columns: 1fr 1fr; gap: 6px; }
      .lv-hero { padding: 12px; }
      .lv-alert-zone { padding: 6px 10px; }
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
    whiteSpace: 'nowrap',
  }}>
    {icon}{label}
  </span>
)

const Section = ({ title, children, delay = 0 }) => (
  <section style={{ animation: `sweep-in 0.5s ease ${delay}s both`, position: 'relative', zIndex: 1 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
      <div style={{
        width: 4, height: 18, borderRadius: 99,
        background: 'linear-gradient(180deg, #60a5fa, #a78bfa)',
        boxShadow: '0 0 10px rgba(96,165,250,0.45)',
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
        color: 'rgba(200,220,255,0.85)', textTransform: 'uppercase',
      }}>
        {title}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(80,110,200,0.25), transparent)' }} />
    </div>
    {children}
  </section>
)

const StatCard = ({ label, value, unit, accent = '#60a5fa', mono = false, alert }) => {
  const hasValue = value !== null && value !== undefined && value !== '--'
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${alert ? accent + '55' : 'var(--border-dim)'}`,
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
        position: 'relative', overflow: 'hidden',
        transition: 'border-color var(--transition), transform var(--transition), box-shadow var(--transition)',
        cursor: 'default',
        boxShadow: alert ? `0 0 0 1px ${accent}20, 0 4px 16px rgba(0,0,0,0.30)` : '0 4px 16px rgba(0,0,0,0.28)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = accent + '70'
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `0 6px 22px rgba(0,0,0,0.38), 0 0 0 1px ${accent}25`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = alert ? accent + '55' : 'var(--border-dim)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = alert ? `0 0 0 1px ${accent}20, 0 4px 16px rgba(0,0,0,0.30)` : '0 4px 16px rgba(0,0,0,0.28)'
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${accent}00, ${accent}cc, ${accent}00)`,
        opacity: hasValue ? 1 : 0.20,
      }} />
      <div style={{
        position: 'absolute', bottom: -20, right: -12, width: 90, height: 90,
        borderRadius: '50%', background: accent,
        filter: 'blur(36px)', opacity: hasValue ? 0.18 : 0.06, pointerEvents: 'none',
      }} />
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
        color: 'rgba(190,210,255,0.70)', textTransform: 'uppercase', lineHeight: 1.3,
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{
          fontSize: 22, fontWeight: 700, lineHeight: 1,
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
          color: hasValue ? accent : 'rgba(255,255,255,0.20)',
          letterSpacing: mono ? '0.06em' : '-0.01em',
          textShadow: hasValue ? `0 0 22px ${accent}60` : 'none',
        }}>
          {hasValue ? value : '—'}
        </span>
        {unit && hasValue && (
          <span style={{ fontSize: 11, color: 'rgba(190,210,255,0.60)', fontWeight: 600 }}>{unit}</span>
        )}
      </div>
    </div>
  )
}

const BoolCard = ({ label, value, trueColor = '#34d399', falseColor = 'rgba(255,255,255,0.25)' }) => {
  const isTrue = value === true
  const color  = value == null ? 'rgba(255,255,255,0.22)' : isTrue ? trueColor : falseColor
  const label2 = value == null ? '—' : isTrue ? 'Active' : 'Inactive'
  return (
    <div style={{
      background: isTrue ? `linear-gradient(160deg, ${trueColor}0d, var(--bg-card) 70%)` : 'var(--bg-card)',
      border: `1px solid ${isTrue ? color + '55' : 'var(--border-dim)'}`,
      borderRadius: 14, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'all var(--transition)',
      boxShadow: isTrue ? `0 0 0 1px ${color}18, 0 4px 16px rgba(0,0,0,0.28)` : '0 4px 16px rgba(0,0,0,0.28)',
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.13em',
        color: 'rgba(180,200,255,0.65)', textTransform: 'uppercase', lineHeight: 1.3,
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LiveDot active={isTrue} color={color} size={9} />
          <span style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
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
          position: 'relative', transition: 'all var(--transition)', flexShrink: 0,
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

const CounterBar = ({ label, value, max = 9999, color = '#a78bfa' }) => {
  const pct = max > 0 ? Math.min(((value ?? 0) / max) * 100, 100) : 0
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-dim)',
      borderRadius: 14, padding: '16px 18px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          color: 'rgba(190,210,255,0.70)', textTransform: 'uppercase',
        }}>{label}</span>
        <span style={{
          fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color, lineHeight: 1, textShadow: `0 0 20px ${color}60`,
        }}>{value ?? '—'}</span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: 'rgba(80,110,200,0.12)', overflow: 'hidden' }}>
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

const CmdBtn = ({ label, icon, onClick, disabled, variant = 'neutral', fullWidthOnMobile = false }) => {
  const themes = {
    success: {
      idle:  { bg: 'rgba(52,211,153,0.13)',  border: 'rgba(52,211,153,0.45)',  color: '#34d399' },
      hover: { bg: 'rgba(52,211,153,0.24)' },
    },
    danger: {
      idle:  { bg: 'rgba(248,113,113,0.13)', border: 'rgba(248,113,113,0.45)', color: '#f87171' },
      hover: { bg: 'rgba(248,113,113,0.24)' },
    },
    neutral: {
      idle:  { bg: 'rgba(96,165,250,0.13)',  border: 'rgba(96,165,250,0.45)',  color: '#60a5fa' },
      hover: { bg: 'rgba(96,165,250,0.24)' },
    },
  }
  const t = themes[variant]
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={fullWidthOnMobile ? 'lv-cmd-btn-full' : ''}
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
        textShadow: `0 0 14px ${t.idle.color}55`,
        boxShadow: `0 2px 14px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)`,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = t.hover.bg }}
      onMouseLeave={e => { e.currentTarget.style.background = t.idle.bg }}
    >
      <span style={{ fontSize: 15 }}>{icon}</span>
      {label}
    </button>
  )
}

const MachineStatusBadge = ({ status }) => {
  const map = {
    'RUNNING':   { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  label: 'Running'   },
    'STOPPED':   { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Stopped'   },
    'IDLE':      { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  label: 'Idle'      },
    'FAULT':     { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Fault'     },
    'POWER OFF': { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  label: 'Power Off' },
  }
  const s = map[status] || { color: 'rgba(200,215,255,0.4)', bg: 'rgba(255,255,255,0.06)', label: status || '—' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', padding: '6px 12px',
      borderRadius: 99, background: s.bg, color: s.color,
      border: `1px solid ${s.color}45`, whiteSpace: 'nowrap',
    }}>
      <LiveDot active={status === 'RUNNING'} color={s.color} size={6} />
      {s.label}
    </span>
  )
}

const AlertBanner = ({ color, bg, border, icon, children }) => (
  <div className="lv-alert-text" style={{
    background: bg, border: `1px solid ${border}`,
    borderRadius: 10, padding: '12px 16px',
    fontSize: 13, color,
    display: 'flex', alignItems: 'flex-start', gap: 10,
    fontWeight: 600, letterSpacing: '0.01em', lineHeight: 1.5,
  }}>
    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>
    <span>{children}</span>
  </div>
)

/* ─────────────────────────────────────────────────────────
   MACHINE HERO
───────────────────────────────────────────────────────── */
const MachineHero = ({ machine, machineId, decoded, selectedDrive, apiStatus, batchCutterState, alarmDrives, networkOk }) => {
  const statusMap = {
    'RUNNING':   { color: '#34d399', label: 'Running'   },
    'STOPPED':   { color: '#f87171', label: 'Stopped'   },
    'POWER OFF': { color: '#fbbf24', label: 'Power Off' },
  }
  const st       = statusMap[apiStatus] || { color: 'rgba(200,215,255,0.4)', label: apiStatus || '—' }
  const alarmColor = (decoded?.alarmStatus === 'ACTIVE' || alarmDrives.length > 0) ? '#f87171' : '#34d399'

  return (
    <div className="lv-hero">
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: '35%',
        background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.04))',
        pointerEvents: 'none',
      }} />

      <div className="lv-hero-inner">
        <div className="lv-hero-icon" style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(96,165,250,0.22), rgba(167,139,250,0.22))',
            border: '1px solid rgba(96,165,250,0.50)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            boxShadow: '0 0 20px rgba(96,165,250,0.18), inset 0 1px 0 rgba(255,255,255,0.10)',
          }}>⚙</div>
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.9), transparent)',
            animation: 'scan-line 2s linear infinite',
          }} />
        </div>

        <div style={{ minWidth: 0 }}>
          <p className="lv-hero-name" style={{
            fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em',
            color: '#f0f4ff', lineHeight: 1.2, margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220,
          }}>
            {machine?.name || machineId}
          </p>
          <p style={{
            fontSize: 10, color: 'rgba(160,185,240,0.65)',
            fontWeight: 600, letterSpacing: '0.09em',
            textTransform: 'uppercase', margin: '4px 0 0',
          }}>
            {machine?.mode || 'PLC Controller'} · ID: {machineId}
          </p>
        </div>

        <div className="lv-hero-divider" />

        {/* Status pills */}
        <div className="lv-hero-stat-pills" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'CAN State',   val: decoded?.canState || '—',          color: '#60a5fa', mono: false },
            { label: 'Node ID',     val: decoded?.canNodeId ?? '—',         color: 'rgba(210,220,255,0.85)', mono: true },
            { label: 'Status Word', val: decoded?.statusWord != null
                ? `0x${Number(decoded.statusWord).toString(16).toUpperCase().padStart(4,'0')}`
                : '—',
              color: '#a78bfa', mono: true },
            { label: 'Drive State', val: (selectedDrive?.statusWordText ?? decoded?.statusWordText) || '—', color: '#22d3ee', mono: false },
            { label: 'Mode',        val: (selectedDrive?.modeDisplayText ?? decoded?.modeDisplayText) || '—', color: '#fbbf24', mono: false },
          ].map(({ label, val, color, mono }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
                color: 'rgba(160,185,240,0.55)', textTransform: 'uppercase',
              }}>{label}</span>
              <span style={{
                fontSize: 13, fontWeight: 700, color,
                fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
                textShadow: `0 0 14px ${color}50`, whiteSpace: 'nowrap',
              }}>{val}</span>
            </div>
          ))}
        </div>

        <div className="lv-hero-divider" />

        {/* Chips row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <MachineStatusBadge status={apiStatus} />

          <Chip
            label={networkOk ? 'Online' : 'Offline'}
            color={networkOk ? '#34d399' : '#fbbf24'}
            bg={networkOk ? 'rgba(52,211,153,0.08)' : 'rgba(251,191,36,0.10)'}
            icon={<LiveDot active={networkOk} color={networkOk ? '#34d399' : '#fbbf24'} size={6} />}
          />

          <Chip
            label={alarmDrives.length > 0 ? `${alarmDrives.length} Drive Fault${alarmDrives.length > 1 ? 's' : ''}` : 'No Alarm'}
            color={alarmColor}
            bg={alarmDrives.length > 0 ? 'rgba(248,113,113,0.12)' : 'rgba(52,211,153,0.08)'}
            icon={<LiveDot active={alarmDrives.length > 0} color={alarmColor} size={6} />}
          />

          <Chip
            label={`Cutter ${batchCutterState}`}
            color={batchCutterState === 'ON' ? '#22d3ee' : 'rgba(180,200,255,0.55)'}
            bg={batchCutterState === 'ON' ? 'rgba(34,211,238,0.10)' : 'rgba(255,255,255,0.05)'}
            icon="✂"
          />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   NORMALIZE DB STATUS → 3-state
───────────────────────────────────────────────────────── */
const computeApiStatus = (rawStatus, lastSeenAt, now) => {
  if (!lastSeenAt) return 'POWER OFF'
  const age = now - new Date(lastSeenAt).getTime()
  if (age > API_STALE_MS) return 'POWER OFF'
  if ((rawStatus || '').toUpperCase() === 'RUNNING') return 'RUNNING'
  return 'STOPPED'
}

/* ─────────────────────────────────────────────────────────
   RUNTIME CLOCK
───────────────────────────────────────────────────────── */
const RuntimeClock = ({ runtimeSeconds, isRunning, label = 'Session Runtime', storedSub }) => {
  const h = Math.floor(runtimeSeconds / 3600)
  const m = Math.floor((runtimeSeconds % 3600) / 60)
  const s = runtimeSeconds % 60
  return (
    <div className="lv-clock-card">
      <div>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          color: 'rgba(190,210,255,0.70)', textTransform: 'uppercase', marginBottom: 14,
        }}>{label}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="lv-clock-seg">
            <div className="lv-clock-box"><span className="lv-clock-digit">{pad2(h)}</span></div>
            <span className="lv-clock-unit">HR</span>
          </div>
          <span className="lv-clock-colon">:</span>
          <div className="lv-clock-seg">
            <div className="lv-clock-box"><span className="lv-clock-digit">{pad2(m)}</span></div>
            <span className="lv-clock-unit">MIN</span>
          </div>
          <span className="lv-clock-colon">:</span>
          <div className="lv-clock-seg">
            <div className="lv-clock-box"><span className="lv-clock-digit">{pad2(s)}</span></div>
            <span className="lv-clock-unit">SEC</span>
          </div>
        </div>
        {storedSub && (
          <p style={{ marginTop: 10, fontSize: 10, color: 'rgba(160,180,230,0.5)', fontFamily: 'var(--font-mono)' }}>
            {storedSub}
          </p>
        )}
      </div>
      {isRunning && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
          textTransform: 'uppercase', padding: '6px 12px',
          borderRadius: 99,
          background: 'rgba(52,211,153,0.10)', color: '#34d399',
          border: '1px solid rgba(52,211,153,0.40)',
        }}>
          <LiveDot active color="#34d399" size={6} />
          LIVE
        </span>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   PRODUCTION COUNTER — reads real cycle_count from PLC
───────────────────────────────────────────────────────── */
const ProductionCard = ({ sessionPouches, totalPouches, pouchCounter, productionRatePpm }) => {
  const hasData = pouchCounter !== null && pouchCounter !== undefined

  const fmtNum = (n) => {
    if (n == null) return '—'
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(2)}K`
    return String(Math.floor(n))
  }

  return (
    <div className="lv-production-card">
      <div style={{ flex: 1 }}>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          color: 'rgba(190,210,255,0.70)', textTransform: 'uppercase', marginBottom: 6,
        }}>Session Production</p>

        {hasData ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                fontSize: 40, fontWeight: 800, color: '#f0f4ff',
                lineHeight: 1, letterSpacing: '-0.02em',
              }}>{fmtNum(sessionPouches)}</span>
              <span style={{ fontSize: 14, color: 'rgba(210,220,255,0.65)', fontWeight: 600 }}>pouches</span>
            </div>
            <p style={{
              marginTop: 8, fontSize: 10, color: 'rgba(160,180,230,0.5)',
              fontFamily: 'var(--font-mono)',
            }}>
              All-time: {fmtNum(totalPouches)} · Rate: {productionRatePpm != null ? `${productionRatePpm} ppm` : '—'}
            </p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={{
                fontSize: 40, fontWeight: 800, color: 'rgba(180,200,255,0.25)',
                lineHeight: 1, letterSpacing: '-0.02em',
              }}>—</span>
            </div>
            <p style={{
              marginTop: 8, fontSize: 10, color: 'rgba(160,180,230,0.35)',
              fontFamily: 'var(--font-mono)',
            }}>Awaiting PLC counter</p>
          </>
        )}
      </div>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 8,
        background: hasData ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hasData ? 'rgba(52,211,153,0.28)' : 'rgba(255,255,255,0.08)'}`,
        fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
        color: hasData ? 'rgba(52,211,153,0.85)' : 'rgba(160,180,230,0.35)',
        textTransform: 'uppercase', alignSelf: 'flex-end',
      }}>
        {hasData
          ? <><LiveDot active color="#34d399" size={5} />PLC Live</>
          : <>○ No Signal</>
        }
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   BATCH CUTTER TOGGLE
───────────────────────────────────────────────────────── */
const BatchCutterControl = ({ state, onChange, compact = false }) => {
  if (compact) {
    return (
      <div className="lv-cutter-compact">
        {['OFF', 'ON'].map((s) => {
          const active = state === s
          const accent = s === 'ON' ? '#22d3ee' : '#60a5fa'
          return (
            <button
              key={s}
              onClick={() => onChange(s)}
              className="lv-cutter-compact-btn"
              style={{
                borderColor: active ? accent + '65' : 'var(--border-dim)',
                background: active
                  ? (s === 'ON' ? 'rgba(34,211,238,0.14)' : 'rgba(96,165,250,0.13)')
                  : 'var(--bg-inset)',
                color: active ? accent : 'var(--text-muted)',
                boxShadow: active
                  ? `0 0 0 1px ${accent}20, 0 3px 14px ${accent}16`
                  : '0 2px 8px rgba(0,0,0,0.18)',
              }}
            >
              <span style={{
                fontSize: 15,
                filter: active ? `drop-shadow(0 0 5px ${accent}90)` : 'none',
              }}>
                {s === 'ON' ? '⚙' : '○'}
              </span>
              <span>Cutter {s}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {['OFF', 'ON'].map((s) => {
        const active = state === s
        const accent = s === 'ON' ? '#22d3ee' : 'rgba(180,200,255,0.55)'
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className="lv-cutter-btn"
            style={{
              borderColor: active ? accent + '70' : 'var(--border-dim)',
              backgroundColor: active
                ? (s === 'ON' ? 'rgba(34,211,238,0.14)' : 'rgba(96,165,250,0.12)')
                : 'var(--bg-inset)',
              color: active ? accent : 'var(--text-muted)',
              boxShadow: active
                ? `0 0 0 1px ${accent}22, 0 4px 20px ${accent}18`
                : '0 2px 12px rgba(0,0,0,0.20)',
            }}
          >
            <span style={{ fontSize: 22, filter: active ? `drop-shadow(0 0 6px ${accent}80)` : 'none' }}>
              {s === 'ON' ? '⚙' : '○'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' }}>
              Cutter {s}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   DRIVE SELECTOR  — 8-cell grid
───────────────────────────────────────────────────────── */
const DriveSelector = ({ servos, selectedId, onSelect, primaryServoId = null }) => {
  const hasData = servos.length > 0
  const drives  = hasData
    ? servos
    : Array.from({ length: 8 }, (_, i) => ({ servoId: i + 1 }))

  return (
    <div className="lv-drives-grid">
      {drives.map((servo) => {
        const id        = servo.servoId
        const active    = selectedId === id
        const isPrimary = hasData && primaryServoId !== null && id === primaryServoId

        const fault   = hasData && (servo.faultActive === true || (servo.errorCode ?? 0) !== 0)
        const running = hasData && servo.operationEnabled === true
        const stopped = hasData && !fault && !running

        // Colour used for status bar, badge, and number tint
        const sc = fault   ? '#f87171'
                 : running ? '#34d399'
                 : active  ? '#60a5fa'
                 : hasData ? 'rgba(180,200,255,0.30)'
                           : 'rgba(100,120,160,0.18)'

        const statusLabel = !hasData ? '—'
                          : fault    ? 'FAULT'
                          : running  ? 'RUN'
                          : 'STOP'

        return (
          <div
            key={`d-${id}`}
            className={`lv-drive-chip${active ? ' active' : ''}`}
            onClick={() => onSelect(id)}
            title={
              !hasData ? `Drive ${id}` :
              `Drive ${id} · ${fault ? servo.errorText : running ? 'Running' : 'Stopped'}${isPrimary ? ' · Fault priority' : ''}`
            }
            style={{
              '--chip-accent': fault   ? 'linear-gradient(90deg,#f8717100,#f87171,#f8717100)'
                             : running ? 'linear-gradient(90deg,#34d39900,#34d399,#34d39900)'
                             : active  ? 'linear-gradient(90deg,#60a5fa00,#60a5fa,#60a5fa00)'
                             : 'transparent',
              ...(fault && isPrimary && {
                boxShadow: '0 0 0 1px rgba(248,113,113,0.35), 0 4px 18px rgba(248,113,113,0.12)',
              }),
            }}
          >
            {/* Fault-priority dot (top-right) */}
            {isPrimary && fault && (
              <span style={{
                position: 'absolute', top: 5, right: 5,
                width: 7, height: 7, borderRadius: '50%',
                background: '#f87171',
                boxShadow: '0 0 6px rgba(248,113,113,0.9)',
                zIndex: 2,
              }} />
            )}

            {/* Drive number — the primary element */}
            <span style={{
              fontSize: 20, fontWeight: 800, lineHeight: 1,
              letterSpacing: '-0.02em',
              color: fault   ? '#f87171'
                   : running ? '#34d399'
                   : active  ? '#60a5fa'
                   : hasData ? 'rgba(210,225,255,0.75)'
                             : 'rgba(150,170,210,0.38)',
              textShadow: (fault || running || active) ? `0 0 18px ${sc}60` : 'none',
            }}>
              {id}
            </span>

            {/* Status badge */}
            <span style={{
              fontSize: 8, fontWeight: 800, letterSpacing: '0.07em',
              padding: '2px 7px', borderRadius: 5,
              background: hasData ? sc + '20' : 'rgba(80,110,200,0.06)',
              color:  hasData ? sc : 'rgba(120,145,195,0.25)',
              border: `1px solid ${hasData ? sc + '55' : 'rgba(80,110,200,0.12)'}`,
              boxShadow: fault ? `0 0 8px ${sc}35` : running ? `0 0 6px ${sc}25` : 'none',
            }}>
              {statusLabel}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   STATUS WORD BIT BREAKDOWN
   STATUS_WORD_BITS imported from telemetryDecoder.js
───────────────────────────────────────────────────────── */
const StatusWordBits = ({ statusWord }) => {
  // null means no data received yet — render a dash instead of all-zero pills
  if (statusWord == null) {
    return (
      <span style={{ fontSize: 12, color: 'rgba(140,165,230,0.38)', fontFamily: 'var(--font-mono)' }}>—</span>
    )
  }
  const sw = statusWord
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {STATUS_WORD_BITS.map(({ key, label, mask, color }) => {
        const active = !!(sw & mask)
        return (
          <span
            key={key}
            title={label}
            style={{
              fontSize: 8, fontWeight: 800, padding: '3px 7px',
              borderRadius: 5, letterSpacing: '0.07em',
              cursor: 'default',
              background: active ? color + '22' : 'rgba(80,110,200,0.06)',
              color:       active ? color       : 'rgba(120,145,195,0.28)',
              border: `1px solid ${active ? color + '55' : 'rgba(80,110,200,0.12)'}`,
              boxShadow: active ? `0 0 8px ${color}30` : 'none',
              transition: 'all 250ms ease',
            }}
          >
            {key}
          </span>
        )
      })}
      <span style={{
        fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
        color: 'rgba(140,165,230,0.40)', marginLeft: 4,
      }}>
        0x{Number(sw).toString(16).toUpperCase().padStart(4, '0')}
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   DRIVE SUMMARY PANEL  (appears below chips, selected drive)
───────────────────────────────────────────────────────── */
const DriveSummaryPanel = ({ drive, isPrimary = false }) => {
  if (!drive) return null

  const isRunning  = drive.machineStatus === 'RUNNING'
  const hasFault   = drive.faultActive || drive.alarmStatus === 'ACTIVE'
  const hasWarning = drive.warningActive

  const statusColor = hasFault ? '#f87171' : isRunning ? '#34d399' : 'rgba(190,210,255,0.40)'
  const statusLabel = hasFault ? 'FAULT' : isRunning ? 'RUNNING' : 'STOPPED'

  const flags = [
    { key: 'OP',  label: 'Op. Enabled', active: drive.operationEnabled, color: '#34d399' },
    { key: 'WRN', label: 'Warning',     active: drive.warningActive,    color: '#fbbf24' },
    { key: 'FLT', label: 'Fault',       active: drive.faultActive,      color: '#f87171' },
    { key: 'REM', label: 'Remote',      active: drive.remoteActive,     color: '#60a5fa' },
  ]

  const stats = [
    {
      label: 'Drive State',
      value: drive.statusWordText || '—',
      color: hasFault ? '#f87171' : isRunning ? '#34d399' : 'rgba(190,210,255,0.65)',
      mono: false,
    },
    {
      label: 'Mode',
      value: drive.modeDisplayText || '—',
      color: '#fbbf24',
      mono: false,
    },
    {
      label: 'Error',
      value: drive.errorCode === 0 ? 'No fault' : (drive.errorText || '—'),
      color: hasFault ? '#f87171' : '#34d399',
      mono: false,
    },
  ]

  return (
    <div className="lv-drive-summary">

      {/* Header strip */}
      <div className="lv-drive-summary-hdr">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${statusColor}22, ${statusColor}0a)`,
            border: `1px solid ${statusColor}45`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            boxShadow: `0 0 16px ${statusColor}20`,
            flexShrink: 0,
          }}>
            <span style={{ filter: `drop-shadow(0 0 5px ${statusColor}80)` }}>⚙</span>
          </div>
          <div>
            <p style={{
              fontSize: 13, fontWeight: 800, color: 'rgba(220,235,255,0.90)',
              margin: 0, letterSpacing: '-0.01em',
            }}>
              Drive {drive.servoId}
              <span style={{
                marginLeft: 10, fontSize: 10, fontWeight: 600,
                color: 'rgba(140,165,230,0.60)', letterSpacing: '0.04em',
              }}>
                {drive.modeDisplayText}
              </span>
            </p>
            <p style={{
              fontSize: 9, margin: '3px 0 0', color: 'rgba(140,165,230,0.50)',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
            }}>
              {drive.statusWord != null
                ? `SW: 0x${Number(drive.statusWord).toString(16).toUpperCase().padStart(4, '0')}`
                : 'SW: —'
              }
              {drive.errorCode !== 0 && (
                <span style={{ color: '#f87171', marginLeft: 10 }}>
                  ERR: 0x{Number(drive.errorCode).toString(16).toUpperCase()}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right side: primary badge + status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isPrimary && hasFault && (
            <span style={{
              fontSize: 8, fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', padding: '4px 8px',
              borderRadius: 99,
              background: 'rgba(248,113,113,0.12)', color: '#f87171',
              border: '1px solid rgba(248,113,113,0.38)',
              whiteSpace: 'nowrap',
            }}>
              ⚡ FAULT PRIORITY
            </span>
          )}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
            textTransform: 'uppercase', padding: '6px 12px',
            borderRadius: 99,
            background: statusColor + '18', color: statusColor,
            border: `1px solid ${statusColor}45`,
            boxShadow: `0 0 16px ${statusColor}18`,
          }}>
            <LiveDot active={isRunning} color={statusColor} size={6} />
            {statusLabel}
          </span>
        </div>
      </div>

      {/* 3-column stats: Drive State | Mode | Error */}
      <div className="lv-drive-summary-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {stats.map(({ label, value, color, mono }) => (
          <div key={label} className="lv-mini-stat">
            <span className="lv-mini-stat-label">{label}</span>
            <span
              className="lv-mini-stat-value"
              style={{
                color,
                fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
                fontSize: value.length > 14 ? 11 : 13,
                textShadow: `0 0 18px ${color}45`,
              }}
              title={value}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Status word bit breakdown — full width */}
      <div style={{
        padding: '12px 18px',
        borderTop: '1px solid rgba(80,110,200,0.10)',
        background: 'rgba(80,110,200,0.025)',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.15em',
          color: 'rgba(140,165,230,0.50)', textTransform: 'uppercase',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          Status Word
        </span>
        <StatusWordBits statusWord={drive.statusWord} />
      </div>

      {/* Flag pills strip */}
      <div className="lv-drive-flags">
        <span style={{
          fontSize: 9, fontWeight: 700, color: 'rgba(140,165,230,0.45)',
          letterSpacing: '0.12em', textTransform: 'uppercase',
          alignSelf: 'center', marginRight: 4,
        }}>Flags</span>
        {flags.map(({ key, label, active, color }) => (
          <span
            key={key}
            className="lv-flag-pill"
            title={label}
            style={{
              background: active ? color + '20' : 'rgba(80,110,200,0.06)',
              color:       active ? color       : 'rgba(120,145,195,0.30)',
              border: `1px solid ${active ? color + '55' : 'rgba(80,110,200,0.14)'}`,
              boxShadow: active ? `0 0 8px ${color}30` : 'none',
            }}
          >
            {key}
          </span>
        ))}
        {/* Divider + per-drive counter if available */}
        {(drive.rpdoRxCounter !== undefined || drive.telemetryTxCounter !== undefined) && (
          <>
            <span style={{ width: 1, height: 14, background: 'rgba(80,110,200,0.20)', alignSelf: 'center', margin: '0 6px', flexShrink: 0 }} />
            {drive.rpdoRxCounter !== undefined && (
              <span style={{ fontSize: 9, color: 'rgba(167,139,250,0.65)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                RPDO: {drive.rpdoRxCounter}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   DRIVE ALARMS
───────────────────────────────────────────────────────── */
const DriveAlarms = ({ alarmDrives }) => {
  if (!alarmDrives.length) return null
  return (
    <div className="lv-alarm-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>⚠</div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>
          {alarmDrives.length} Drive{alarmDrives.length > 1 ? 's' : ''} in Fault
        </span>
      </div>
      <div className="lv-diag-table">
        {alarmDrives.map((drive, i) => (
          <div key={`alarm-${drive.servoId}`} className="lv-diag-row">
            <span className="lv-diag-label">Drive {drive.servoId}</span>
            <span className="lv-diag-value" style={{ color: '#f87171' }}>{drive.errorText}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   DIAG VALUE — smart renderer for table cells
───────────────────────────────────────────────────────── */
const DiagValue = ({ value, color }) => {
  if (value === 'YES') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
      padding: '3px 9px', borderRadius: 99,
      background: 'rgba(52,211,153,0.14)', color: '#34d399',
      border: '1px solid rgba(52,211,153,0.32)',
      boxShadow: '0 0 8px rgba(52,211,153,0.18)',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
      YES
    </span>
  )
  if (value === 'NO') return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      padding: '3px 9px', borderRadius: 99,
      background: 'rgba(80,110,200,0.08)', color: 'rgba(180,200,255,0.28)',
      border: '1px solid rgba(80,110,200,0.14)',
    }}>NO</span>
  )
  if (value === 'ONLINE') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <LiveDot active color="#34d399" size={5} />
      <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399' }}>ONLINE</span>
    </span>
  )
  if (value === 'OFFLINE') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <LiveDot active={false} color="#fbbf24" size={5} />
      <span style={{ fontSize: 12, fontWeight: 700, color: color || '#fbbf24' }}>OFFLINE</span>
    </span>
  )
  return (
    <span className="lv-diag-value" style={color ? { color } : {}}>{value ?? '—'}</span>
  )
}

/* ─────────────────────────────────────────────────────────
   DIAG TABLE CARD
───────────────────────────────────────────────────────── */
const DiagCard = ({ rows }) => (
  <div style={{
    background: 'var(--bg-card)',
    border: '1px solid var(--border-dim)',
    borderRadius: 16, overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.28)',
  }}>
    <div className="lv-diag-table striped">
      {rows.map(({ label, value, color }, i) => (
        <div
          key={label}
          className="lv-diag-row"
          style={{
            background: i % 2 === 0 ? 'transparent' : 'rgba(80,110,200,0.06)',
            padding: '10px 20px',
            borderBottom: i < rows.length - 1 ? '1px solid rgba(80,110,200,0.10)' : 'none',
          }}
        >
          <span className="lv-diag-label">{label}</span>
          <DiagValue value={value} color={color} />
        </div>
      ))}
    </div>
  </div>
)

/* ─────────────────────────────────────────────────────────
   NO-DRIVES PANEL
   Replaces empty placeholder chips when servos[] is empty.
   Shows a CAN-bus quick-status summary so the space isn't wasted.
───────────────────────────────────────────────────────── */
const NoDrivesPanel = ({ canState, statusWordText, errorText, decoded }) => {
  const isOperational = (canState || '').toUpperCase() === 'OPERATIONAL'
  const cards = [
    {
      label: 'CAN State',
      value: canState || '—',
      color: isOperational ? '#34d399' : '#fbbf24',
    },
    {
      label: 'Drive State',
      value: statusWordText || '—',
      color: '#22d3ee',
    },
    {
      label: 'Error Code',
      value: errorText || '—',
      color: (errorText === 'No fault' || !errorText) ? '#34d399' : '#f87171',
    },
    {
      label: 'Status Word',
      value: `0x${Number(decoded?.statusWord ?? 0).toString(16).toUpperCase().padStart(4, '0')}`,
      color: '#a78bfa',
      mono: true,
    },
  ]

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-dim)',
      borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.28)',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 20px',
        background: 'linear-gradient(90deg, rgba(96,165,250,0.05), transparent 60%)',
        borderBottom: '1px solid rgba(80,110,200,0.12)',
      }}>
        <span style={{
          fontSize: 22, lineHeight: 1,
          color: 'rgba(180,200,255,0.30)',
          animation: 'glow-pulse 3s ease-in-out infinite',
        }}>⚙</span>
        <div>
          <p style={{
            fontSize: 12, fontWeight: 700, margin: 0,
            color: 'rgba(200,220,255,0.70)',
          }}>
            Awaiting drive telemetry
          </p>
          <p style={{
            fontSize: 10, margin: '3px 0 0',
            color: 'rgba(130,155,215,0.45)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
          }}>
            Connect the machine to see per-drive diagnostics
          </p>
        </div>

        {isOperational && (
          <div style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 99,
            background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.28)',
            flexShrink: 0,
          }}>
            <LiveDot active color="#34d399" size={6} />
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#34d399',
            }}>CAN Bus Active</span>
          </div>
        )}
      </div>

      {/* ── 4-column stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {cards.map(({ label, value, color, mono }, i) => (
          <div
            key={label}
            style={{
              padding: '14px 18px',
              display: 'flex', flexDirection: 'column', gap: 7,
              borderLeft: i > 0 ? '1px solid rgba(80,110,200,0.10)' : 'none',
              position: 'relative',
            }}
          >
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, ${color}00, ${color}55, ${color}00)`,
              opacity: 0.5,
            }} />
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.15em',
              color: 'rgba(140,165,230,0.50)', textTransform: 'uppercase',
            }}>
              {label}
            </span>
            <span style={{
              fontSize: 13, fontWeight: 700,
              fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
              color, letterSpacing: mono ? '0.06em' : '-0.01em',
              textShadow: `0 0 18px ${color}45`,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────── */
const LiveView = () => {
  const { machineId } = useParams()
  const { logout }    = useAuth()

  // ── Machine metadata (from API, gives us siteId / lineId) ──
  const [machine,  setMachine]  = useState(null)
  const [siteId,   setSiteId]   = useState('')
  const [lineId,   setLineId]   = useState('')

  // ── WebSocket (passes siteId/lineId once known) ──
  const { decoded, connected, servos, dbStatus, plcState } = useWebSocket(machineId, siteId, lineId)

  // ── API-polled machine status (3-state: RUNNING / STOPPED / POWER OFF) ──
  const [rawApiStatus, setRawApiStatus] = useState(null)
  const [lastSeenAt,   setLastSeenAt]   = useState(null)
  const [pollData,     setPollData]     = useState(null)   // full /dashboard/machine/:id response
  const [now,          setNow]          = useState(Date.now())

  // ── Command state ──
  const [sending,      setSending]      = useState(false)
  const [cmdSent,      setCmdSent]      = useState(null)

  // ── Batch Cutter ──
  const [batchCutterState, setBatchCutterState] = useState('OFF')

  // ── Drive selection ──
  const [selectedDriveId, setSelectedDriveId] = useState(1)

  // ── Derived status ────────────────────────────────────────────────────────
  const apiStatus = useMemo(
    () => computeApiStatus(rawApiStatus, lastSeenAt, now),
    [rawApiStatus, lastSeenAt, now],
  )
  // WS flag responds instantly; falls back to polled apiStatus if WS flag not yet received
  const isRunning = plcState?.actuallyRunning ?? (apiStatus === 'RUNNING')
  const networkOk   = !!lastSeenAt && (now - new Date(lastSeenAt).getTime()) <= API_STALE_MS

  // ── Selected drive data ───────────────────────────────────────────────────
  const selectedDrive = servos.find(s => s.servoId === selectedDriveId) ?? servos[0] ?? null
  const alarmDrives   = servos.filter(s => s.faultActive || s.warningActive || (s.errorCode && s.errorCode !== 0))

  const errorText        = selectedDrive?.errorText    ?? decoded?.errorText     ?? '--'
  const statusWordText   = selectedDrive?.statusWordText   ?? decoded?.statusWordText   ?? '--'
  const modeDisplayText  = selectedDrive?.modeDisplayText  ?? decoded?.modeDisplayText  ?? '--'
  const operationEnabled = selectedDrive?.operationEnabled ?? decoded?.operationEnabled  ?? false
  const warningActive    = selectedDrive?.warningActive    ?? decoded?.warningActive     ?? false
  const faultActive      = selectedDrive?.faultActive      ?? decoded?.faultActive       ?? false
  const remoteActive     = selectedDrive?.remoteActive     ?? decoded?.remoteActive      ?? false
  const canState         = decoded?.canState ?? '--'

  // Use persistent session counter from DB poll (replaces ephemeral device_uptime_ms)
  const runtimeSeconds = pollData?.sessionRuntimeSeconds ?? 0

  // ─────────────────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────────────────

  // 1-second ticker
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Fetch machine metadata (siteId, lineId, name, mode)
  useEffect(() => {
    getMachine(machineId)
      .then(res => {
        const data = res.data.data || res.data
        setMachine(data)
        if (data?.siteId) setSiteId(data.siteId)
        if (data?.lineId) setLineId(data.lineId)
      })
      .catch(() => {})
  }, [machineId])

  // Sync WS machine_status push → rawApiStatus for instant feedback
  // (complements the 3s API poll — no waiting for the next poll cycle)
  useEffect(() => {
    if (!dbStatus) return
    setRawApiStatus(dbStatus)
    setLastSeenAt(new Date().toISOString())
  }, [dbStatus])

  // Poll machine status every 3 seconds
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await api.get(`/dashboard/machine/${machineId}`)
        const data = res.data.data || res.data
        setRawApiStatus(data?.status ?? null)
        setLastSeenAt(data?.lastSeenAt ?? null)
        setPollData(data ?? null)
        // Pick up siteId/lineId if not yet known
        if (!siteId && data?.siteId) setSiteId(data.siteId)
        if (!lineId && data?.lineId) setLineId(data.lineId)
      } catch {
        // keep last known status on network blip
      }
    }
    fetchStatus()
    const t = setInterval(fetchStatus, 3000)
    return () => clearInterval(t)
  }, [machineId, siteId, lineId])

  // ─────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────

  const handleStart = async () => {
    setSending(true)
    setCmdSent('start')
    try {
      await sendCommand(machineId, 'start', { batchCutter: batchCutterState }, siteId, lineId)
      toast.success('Command [start] dispatched')
      setRawApiStatus('running')
    } catch {
      toast.error('Failed to send [start]')
    } finally {
      setSending(false)
      setTimeout(() => setCmdSent(null), 2500)
    }
  }

  const handleStop = async () => {
    setSending(true)
    setCmdSent('stop')
    try {
      await sendCommand(machineId, 'stop', {}, siteId, lineId)
      toast.success('Command [stop] dispatched')
      setRawApiStatus('stopped')
    } catch {
      toast.error('Failed to send [stop]')
    } finally {
      setSending(false)
      setTimeout(() => setCmdSent(null), 2500)
    }
  }

  const handleBatchCutterChange = async (state) => {
    setBatchCutterState(state)
    if (isRunning) {
      try {
        await sendCommand(machineId, 'setSpeed', { batchCutter: state }, siteId, lineId)
        toast.info(`Batch cutter set to ${state}`)
      } catch {
        toast.error('Failed to update batch cutter speed')
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  const anyAlert = !connected || faultActive || warningActive || alarmDrives.length > 0

  return (
    <div className="lv-root">
      <GlobalStyles />

      <Header
        machineId={machineId}
        machineName={machine?.name}
        machineStatus={apiStatus}
        backBtn
      />

      <MachineHero
        machine={machine}
        machineId={machineId}
        decoded={decoded}
        selectedDrive={selectedDrive}
        apiStatus={apiStatus}
        batchCutterState={batchCutterState}
        alarmDrives={alarmDrives}
        networkOk={networkOk}
      />

      {/* Alert banners */}
      {anyAlert && (
        <div className="lv-alert-zone">
          {!connected && (
            <AlertBanner color="#fbbf24" bg="rgba(251,191,36,0.07)" border="rgba(251,191,36,0.28)" icon="⚠">
              WebSocket reconnecting — displaying last known telemetry
            </AlertBanner>
          )}
          {alarmDrives.length > 0 && (
            <AlertBanner color="#f87171" bg="rgba(248,113,113,0.07)" border="rgba(248,113,113,0.28)" icon="✕">
              {alarmDrives.length} drive{alarmDrives.length > 1 ? 's' : ''} in fault —{' '}
              {alarmDrives.map(d => `D${d.servoId}: ${d.errorText}`).join(' · ')}
            </AlertBanner>
          )}
          {faultActive && alarmDrives.length === 0 && (
            <AlertBanner color="#f87171" bg="rgba(248,113,113,0.07)" border="rgba(248,113,113,0.28)" icon="✕">
              Fault active — {errorText}
            </AlertBanner>
          )}
          {warningActive && (
            <AlertBanner color="#fbbf24" bg="rgba(251,191,36,0.05)" border="rgba(251,191,36,0.2)" icon="△">
              Warning active — check system logs for details
            </AlertBanner>
          )}
        </div>
      )}

      <main className="lv-main">

        {/* ══ ROW 1: Session Overview — Runtime + Production side-by-side ══ */}
        <section style={{ animation: 'sweep-in 0.5s ease 0s both', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 4, height: 18, borderRadius: 99,
              background: 'linear-gradient(180deg, #34d399, #22d3ee)',
              boxShadow: '0 0 10px rgba(52,211,153,0.45)', flexShrink: 0,
            }} />
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
              color: 'rgba(200,220,255,0.85)', textTransform: 'uppercase',
            }}>
              Session Overview
            </span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(80,110,200,0.25), transparent)' }} />
          </div>
          <div className="lv-twin-grid">
            <RuntimeClock
              runtimeSeconds={runtimeSeconds}
              isRunning={isRunning}
              label="Session Runtime"
            />
            <ProductionCard
              sessionPouches={pollData?.sessionPouches    ?? null}
              totalPouches={pollData?.totalPouches         ?? null}
              pouchCounter={pollData?.pouchCounter         ?? null}
              productionRatePpm={pollData?.productionRatePpm ?? null}
            />
          </div>
        </section>

        {/* ══ ROW 2: Remote Control — buttons + batch cutter in one card ══ */}
        <Section title="Remote Control" delay={0.08}>
          <div className="lv-control-card">

            {/* Top: Start/Stop + vertical divider + Batch Cutter */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>

              {/* Left: command buttons */}
              <div className="lv-cmd-row" style={{ flex: '0 0 auto' }}>
                <CmdBtn
                  label="Start" icon="▶" variant="success"
                  disabled={sending || isRunning}
                  onClick={handleStart} fullWidthOnMobile
                />
                <CmdBtn
                  label="Stop" icon="■" variant="danger"
                  disabled={sending || !isRunning}
                  onClick={handleStop} fullWidthOnMobile
                />
                {sending && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, animation: 'sweep-in 0.2s ease' }}>
                    <span style={{ fontSize: 13, color: '#34d399' }}>✓</span>
                    <span style={{ fontSize: 12, color: '#34d399', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      [{cmdSent}] dispatched
                    </span>
                  </div>
                )}
              </div>

              {/* Vertical divider */}
              <div className="lv-vdivider" style={{
                width: 1, alignSelf: 'stretch', minHeight: 44,
                background: 'linear-gradient(180deg, transparent, rgba(80,110,200,0.32), transparent)',
                flexShrink: 0,
              }} />

              {/* Right: Batch Cutter inline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 210 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
                  color: 'rgba(190,210,255,0.70)', textTransform: 'uppercase',
                }}>
                  ✂ Batch Cutter
                </span>
                <BatchCutterControl state={batchCutterState} onChange={handleBatchCutterChange} compact />
              </div>
            </div>

            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(80,110,200,0.28), transparent)', margin: '18px 0' }} />

            {/* Status row */}
            <div className="lv-status-row">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(190,210,255,0.72)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Machine Status
                </span>
                <MachineStatusBadge status={apiStatus} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(190,210,255,0.72)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Drive State
                </span>
                <span style={{ fontSize: 13, color: '#22d3ee', fontWeight: 600 }}>{statusWordText}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(190,210,255,0.72)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Site / Line
                </span>
                <span style={{ fontSize: 13, color: 'rgba(200,215,255,0.7)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {siteId || decoded?.siteId || '—'} / {lineId || decoded?.lineId || '—'}
                </span>
              </div>
            </div>

            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(80,110,200,0.22), transparent)', margin: '14px 0 0' }} />
            <p style={{ marginTop: 12, fontSize: 12, color: 'rgba(180,200,255,0.45)', fontWeight: 500, lineHeight: 1.6 }}>
              Commands dispatched via CAN bus · Ensure safety conditions are met before issuing control signals
            </p>
          </div>
        </Section>

        {/* ══ Active Drive Alarms (conditional) ══ */}
        {alarmDrives.length > 0 && (
          <Section title="Active Drive Alarms" delay={0.12}>
            <DriveAlarms alarmDrives={alarmDrives} />
          </Section>
        )}

        {/* ══ Drive Selection ══ */}
        <Section title="Drive Selection" delay={0.14}>
          {/* Chips always visible — show real drives or 8 placeholders */}
          <DriveSelector
            servos={servos}
            selectedId={selectedDriveId}
            onSelect={setSelectedDriveId}
            primaryServoId={decoded?.primaryServoId ?? null}
          />
          {/* Drive detail panel — only when live servo data exists */}
          {servos.length > 0 && (
            <DriveSummaryPanel
              drive={selectedDrive}
              isPrimary={selectedDrive?.servoId != null && selectedDrive?.servoId === decoded?.primaryServoId}
            />
          )}
        </Section>

        {/* ══ ROW 3: CAN Bus Telemetry (left 60%) + Drive Diagnostics (right 40%) ══ */}
        <div className="lv-panel-grid">
          <Section title="CAN Bus Telemetry" delay={0.18}>
            <div className="lv-stat-grid">
              <StatCard label="CAN State"   value={canState}           accent="#60a5fa" />
              {decoded?.canNodeId != null && (
                <StatCard label="Node ID"   value={decoded.canNodeId}  accent="#a78bfa" mono />
              )}
              <StatCard label="Status Word"
                value={`0x${Number(decoded?.statusWord ?? 0).toString(16).toUpperCase().padStart(4,'0')}`}
                accent="#a78bfa" mono />
              <StatCard label="Drive State" value={statusWordText}     accent="#22d3ee" />
              <StatCard label="Error Code"  value={errorText}
                accent={faultActive ? '#f87171' : '#34d399'} alert={faultActive} />
              {modeDisplayText && modeDisplayText !== '—' && (
                <StatCard label="Mode"      value={modeDisplayText}    accent="#fbbf24" />
              )}
              <StatCard label="Network"     value={networkOk ? 'ONLINE' : 'OFFLINE'}
                accent={networkOk ? '#34d399' : '#fbbf24'} alert={!networkOk} />
              {decoded?.deviceUptimeMs != null && formatUptime(decoded.deviceUptimeMs) && (
                <StatCard label="Device Uptime" value={formatUptime(decoded.deviceUptimeMs)} accent="#22d3ee" />
              )}
            </div>
          </Section>

          <Section
            title={servos.length > 0 ? `Drive ${selectedDriveId} — Diagnostics` : 'System Diagnostics'}
            delay={0.22}
          >
            <DiagCard rows={[
              { label: 'Fault',        value: errorText,       color: faultActive      ? '#f87171' : undefined },
              { label: 'Mode',         value: modeDisplayText !== '—' ? modeDisplayText : null },
              { label: 'Network',      value: networkOk ? 'ONLINE' : 'OFFLINE' },
              { label: 'CAN State',    value: canState },
              { label: 'Op. Enabled',  value: operationEnabled ? 'YES' : 'NO' },
              { label: 'Warning',      value: warningActive    ? 'YES' : 'NO' },
              { label: 'Fault Active', value: faultActive      ? 'YES' : 'NO' },
              { label: 'Remote',       value: remoteActive     ? 'YES' : 'NO' },
              // PLC diagnostics from poll
              {
                label: 'Axis Error',
                value: (pollData?.axisErrorId === 0 || pollData?.axisErrorId == null)
                  ? 'No fault'
                  : `0x${pollData.axisErrorId.toString(16).toUpperCase()}`,
                color: pollData?.axisErrorId ? '#f87171' : undefined,
              },
              {
                label: 'Diag Word',
                value: pollData?.diagnosticWord != null
                  ? `0x${pollData.diagnosticWord.toString(16).toUpperCase().padStart(4, '0')}`
                  : '—',
              },
            ].filter(r => r.value != null)} />
          </Section>
        </div>

        {/* ══ ROW 4: Status Flags (left) + Message Counters (right) ══ */}
        <div className="lv-twin-grid" style={{ alignItems: 'start' }}>
          {/* ══ ROW 4 LEFT: PLC State Flags ══ */}
          <Section title="PLC State Flags" delay={0.26}>
            <div className="lv-bool-grid">
              <BoolCard
                label="Ready to Run"
                value={plcState?.readyToRun ?? null}
                trueColor="#34d399"
                falseColor="rgba(200,215,255,0.28)"
              />
              <BoolCard
                label="Running"
                value={plcState?.actuallyRunning ?? null}
                trueColor="#34d399"
                falseColor="rgba(200,215,255,0.28)"
              />
              <BoolCard
                label="Faulted"
                value={plcState?.faulted ?? null}
                trueColor="#f87171"
                falseColor="#34d399"
              />
              <BoolCard
                label="Stopping"
                value={plcState?.stopping ?? null}
                trueColor="#fbbf24"
                falseColor="rgba(200,215,255,0.28)"
              />
              <BoolCard
                label="Disabled"
                value={plcState?.disabled ?? null}
                trueColor="#fbbf24"
                falseColor="rgba(200,215,255,0.28)"
              />
              <BoolCard
                label="Remote Start"
                value={plcState?.remoteStartAllowed ?? null}
                trueColor="#60a5fa"
                falseColor="rgba(200,215,255,0.28)"
              />
            </div>
          </Section>

          <Section title="Message Counters" delay={0.30}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CounterBar label="RPDO RX Counter"      value={decoded?.rpdoRxCounter}      color="#a78bfa" max={9999} />
              <CounterBar label="Telemetry TX Counter" value={decoded?.telemetryTxCounter} color="#f472b6" max={9999} />
            </div>
          </Section>
        </div>

        {/* ══ Footer timestamp ══ */}
        {(decoded?.ts || decoded?.timestamp) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            animation: 'sweep-in 0.4s ease 0.34s both', flexWrap: 'wrap',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: '#34d399',
              animation: 'blink-dot 2s ease-in-out infinite',
              boxShadow: '0 0 8px rgba(52,211,153,0.6)', flexShrink: 0,
            }} />
            <span style={{
              fontSize: 11, color: 'rgba(160,185,240,0.55)',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
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
