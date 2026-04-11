import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../hooks/useWebSocket'
import logo from '../assets/Intute.png'

const LIVE_THRESHOLD_MS = 15_000

const useMaybeWebSocket = (machineId) => {
  const result = useWebSocket(machineId ?? '__none__')
  return machineId ? result : { connected: false, lastDataAt: null }
}

const Header = ({ machineId, machineName, backBtn = false }) => {
  const { user, logout } = useAuth()
  const { connected, lastDataAt } = useMaybeWebSocket(machineId)
  const navigate = useNavigate()

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const isLive = connected && lastDataAt != null && (now - lastDataAt) < LIVE_THRESHOLD_MS

  const fmt = (d) => ({
    now:  d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  })
  const [clock, setClock] = useState(() => fmt(new Date()))
  useEffect(() => {
    const id = setInterval(() => setClock(fmt(new Date())), 1000)
    return () => clearInterval(id)
  }, [])

  const showMachineZone = Boolean(machineId)
  const secondsSinceData = lastDataAt != null ? Math.floor((now - lastDataAt) / 1000) : null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600&display=swap');

        .hdr-root {
          --hdr-h: 70px;
          --accent:  #38bdf8;
          --accent2: #818cf8;
          --green:   #34d399;
          --amber:   #fbbf24;
          --red:     #f87171;
          --surface: rgba(255,255,255,0.035);
          --border:  rgba(255,255,255,0.08);
          --text-hi: #f1f5f9;
          --text-lo: rgba(241,245,249,0.22);
          font-family: 'Outfit', sans-serif;
          position: sticky;
          top: 0;
          z-index: 200;
          flex-shrink: 0;
        }

        .hdr-shell {
          height: var(--hdr-h);
          background: linear-gradient(105deg, #050c1a 0%, #06101f 45%, #080e1c 100%);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: stretch;
          position: relative;
          overflow: hidden;
        }

        .hdr-topline {
          position: absolute;
          top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(56,189,248,0.6) 30%,
            rgba(129,140,248,0.5) 70%,
            transparent 100%);
        }
        .hdr-glow-left {
          position: absolute;
          left: -80px; top: -40px;
          width: 320px; height: 160px;
          background: radial-gradient(ellipse, rgba(56,189,248,0.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .hdr-glow-right {
          position: absolute;
          right: 60px; bottom: -40px;
          width: 220px; height: 140px;
          background: radial-gradient(ellipse, rgba(129,140,248,0.1) 0%, transparent 70%);
          pointer-events: none;
        }
        .hdr-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        .hdr-inner {
          width: 100%;
          display: flex;
          align-items: center;
          padding: 0 24px;
          position: relative;
          z-index: 1;
          gap: 0;
          min-width: 0;
        }

        /* ── Back button ── */
        .hdr-back-btn {
          display: flex; align-items: center; gap: 6px;
          background: none; border: none; cursor: pointer;
          color: var(--text-lo); font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; padding: 0 16px 0 0; margin-right: 0;
          border-right: 1px solid var(--border); height: 100%;
          transition: color 0.15s; flex-shrink: 0;
          white-space: nowrap;
        }
        .hdr-back-btn:hover { color: var(--accent); }
        .hdr-back-btn svg { width: 14px; height: 14px; transition: transform 0.15s; }
        .hdr-back-btn:hover svg { transform: translateX(-2px); }

        /* ── Logo ── */
        .hdr-logo-zone {
          display: flex; align-items: center; gap: 12px; cursor: pointer;
          padding: 0 20px; border-right: 1px solid var(--border); height: 100%;
          flex-shrink: 0; transition: opacity 0.2s;
          min-width: 0;
        }
        .hdr-logo-zone:hover { opacity: 0.8; }
        .hdr-logo-ring {
          width: 58px; height: 58px; border-radius: 14px; padding: 2px;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          flex-shrink: 0; box-shadow: 0 0 18px rgba(56,189,248,0.25); overflow: visible;
        }
        .hdr-logo-inner {
          width: 100%; height: 100%; border-radius: 12px; background: #0a1628;
          display: flex; align-items: center; justify-content: center; overflow: visible;
        }
        .hdr-logo-img { width: 180px; height: 180px; object-fit: contain; }
        .hdr-logo-fallback {
          font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; color: var(--accent);
        }
        .hdr-brand { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .hdr-brand-name {
          font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 800;
          color: var(--text-hi); letter-spacing: -0.02em; line-height: 1;
          white-space: nowrap;
        }
        .hdr-brand-tag {
          font-family: 'DM Mono', monospace; font-size: 9px; font-weight: 500;
          color: var(--accent); letter-spacing: 0.18em; text-transform: uppercase;
          line-height: 1; opacity: 0.75; white-space: nowrap;
        }

        /* ── Machine zone ── */
        .hdr-machine-zone {
          display: flex; align-items: center; gap: 16px; padding: 0 20px; flex-shrink: 0;
          min-width: 0;
        }
        .hdr-machine-name {
          font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700;
          color: var(--text-hi); letter-spacing: -0.01em; line-height: 1; display: block;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;
        }
        .hdr-machine-id {
          font-family: 'DM Mono', monospace; font-size: 9px; color: var(--text-lo);
          letter-spacing: 0.12em; text-transform: uppercase;
          line-height: 1; margin-top: 4px; display: block;
        }

        /* ── Status pill ── */
        .hdr-status {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 6px 12px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          transition: all 0.3s;
          flex-shrink: 0;
        }
        .hdr-status-row {
          display: flex; align-items: center; gap: 8px;
        }
        .hdr-status.live {
          background: rgba(52,211,153,0.1);
          border: 1px solid rgba(52,211,153,0.3);
          color: var(--green);
          box-shadow: 0 0 12px rgba(52,211,153,0.08);
        }
        .hdr-status.connecting {
          background: rgba(251,191,36,0.08);
          border: 1px solid rgba(251,191,36,0.25);
          color: var(--amber);
        }
        .hdr-status.offline {
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.25);
          color: var(--red);
        }
        .hdr-status-sublabel {
          font-family: 'DM Mono', monospace;
          font-size: 8px; font-weight: 500; opacity: 0.7;
          letter-spacing: 0.08em; line-height: 1;
          text-transform: lowercase;
        }
        .hdr-pulse-wrap { position: relative; width: 8px; height: 8px; flex-shrink: 0; }
        .hdr-pulse-ring {
          position: absolute; inset: 0; border-radius: 50%;
          animation: hdr-ping 1.8s ease-out infinite;
        }
        .hdr-pulse-core { position: absolute; inset: 1px; border-radius: 50%; }
        @keyframes hdr-ping {
          0%   { transform: scale(1); opacity: 0.7; }
          75%  { transform: scale(2.8); opacity: 0; }
          100% { transform: scale(2.8); opacity: 0; }
        }

        .hdr-spacer { flex: 1; min-width: 0; }

        /* ── Metrics strip ── */
        .hdr-metrics {
          display: flex; align-items: center;
          border: 1px solid var(--border); border-radius: 12px;
          overflow: hidden; background: var(--surface); flex-shrink: 0;
        }
        .hdr-metric {
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          padding: 10px 16px; border-right: 1px solid var(--border);
        }
        .hdr-metric:last-child { border-right: none; }
        .hdr-metric-val {
          font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 500;
          line-height: 1; letter-spacing: 0.04em;
        }
        .hdr-metric-lbl {
          font-size: 9px; font-weight: 600; color: var(--text-lo);
          letter-spacing: 0.12em; text-transform: uppercase; line-height: 1;
        }

        /* ── Right zone ── */
        .hdr-right {
          display: flex; align-items: center; gap: 10px;
          padding-left: 20px; border-left: 1px solid var(--border);
          height: 100%; flex-shrink: 0;
        }
        .hdr-avatar {
          width: 34px; height: 34px; border-radius: 9px;
          background: linear-gradient(135deg, #1e40af, #7c3aed);
          border: 1px solid rgba(124,58,237,0.4);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 800; color: #fff;
          flex-shrink: 0; box-shadow: 0 0 12px rgba(124,58,237,0.2);
        }
        .hdr-user-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .hdr-user-name { font-size: 12px; font-weight: 600; color: var(--text-hi); line-height: 1; white-space: nowrap; }
        .hdr-user-role {
          font-family: 'DM Mono', monospace; font-size: 9px; color: var(--text-lo);
          letter-spacing: 0.1em; text-transform: uppercase; line-height: 1;
        }
        .hdr-logout {
          display: flex; align-items: center; gap: 6px;
          background: none; border: 1px solid var(--border); cursor: pointer;
          color: var(--text-lo); font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
          padding: 8px 12px; border-radius: 9px; transition: all 0.18s;
          white-space: nowrap; flex-shrink: 0;
        }
        .hdr-logout:hover {
          border-color: rgba(248,113,113,0.5); color: var(--red); background: rgba(248,113,113,0.06);
        }
        .hdr-logout svg { width: 13px; height: 13px; opacity: 0.7; transition: transform 0.2s; }
        .hdr-logout:hover svg { transform: translateX(2px); opacity: 1; }
        .hdr-logout-text { display: inline; }

        .hdr-sub-bar {
          height: 2px;
          background: linear-gradient(90deg,
            transparent 0%, rgba(56,189,248,0.4) 20%,
            rgba(129,140,248,0.4) 80%, transparent 100%);
        }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .hdr-metrics { display: none; }
        }

        @media (max-width: 768px) {
          .hdr-root { --hdr-h: 60px; }
          .hdr-machine-zone { display: none; }
          .hdr-inner { padding: 0 16px; }
          .hdr-logo-zone { padding: 0 14px; gap: 10px; }
          .hdr-logo-ring { width: 46px; height: 46px; border-radius: 11px; }
          .hdr-logo-img { width: 140px; height: 140px; }
          .hdr-brand-name { font-size: 13px; }
          .hdr-right { padding-left: 14px; gap: 8px; }
          .hdr-logout { padding: 7px 10px; }
        }

        @media (max-width: 640px) {
          .hdr-user-info { display: none; }
          .hdr-brand-tag { display: none; }
          .hdr-logout-text { display: none; }
          .hdr-logout { padding: 8px; border-radius: 8px; }
          .hdr-logout svg { width: 15px; height: 15px; opacity: 1; }
          .hdr-back-btn span { display: none; }
          .hdr-back-btn { padding: 0 12px 0 0; }
        }

        @media (max-width: 400px) {
          .hdr-logo-zone { padding: 0 10px; gap: 8px; }
          .hdr-logo-ring { width: 38px; height: 38px; border-radius: 9px; }
          .hdr-brand-name { font-size: 12px; }
          .hdr-inner { padding: 0 10px; }
          .hdr-right { padding-left: 10px; }
        }
      `}</style>

      <div className="hdr-root">
        <div className="hdr-shell">
          <div className="hdr-topline" />
          <div className="hdr-grid" />
          <div className="hdr-glow-left" />
          <div className="hdr-glow-right" />

          <div className="hdr-inner">

            {/* ── Back button (LiveView only) ── */}
            {backBtn && (
              <button className="hdr-back-btn" onClick={() => navigate('/')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span>Back</span>
              </button>
            )}

            {/* ── Logo ── */}
            <div className="hdr-logo-zone" onClick={() => navigate('/')}>
              <div className="hdr-logo-ring">
                <div className="hdr-logo-inner">
                  <img
                    src={logo}
                    alt="Intute"
                    className="hdr-logo-img"
                    onError={e => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextSibling.style.display = 'block'
                    }}
                  />
                  <span className="hdr-logo-fallback" style={{ display: 'none' }}>I</span>
                </div>
              </div>
              <div className="hdr-brand">
                <span className="hdr-brand-name">PLC Monitor</span>
                <span className="hdr-brand-tag">Intute · Industrial</span>
              </div>
            </div>

            {/* ── Machine zone (LiveView only) ── */}
            {showMachineZone && (
              <div className="hdr-machine-zone">
                <div style={{ minWidth: 0 }}>
                  <span className="hdr-machine-name">{machineName || machineId}</span>
                  <span className="hdr-machine-id">uid: {machineId}</span>
                </div>

                {!connected ? (
                  <div className="hdr-status connecting">
                    <div className="hdr-status-row">
                      <span className="hdr-pulse-wrap">
                        <span className="hdr-pulse-core" style={{ background: 'var(--amber)' }} />
                      </span>
                      Connecting
                    </div>
                  </div>
                ) : isLive ? (
                  <div className="hdr-status live">
                    <div className="hdr-status-row">
                      <span className="hdr-pulse-wrap">
                        <span className="hdr-pulse-ring" style={{ background: 'var(--green)' }} />
                        <span className="hdr-pulse-core" style={{ background: 'var(--green)' }} />
                      </span>
                      Live
                    </div>
                    {secondsSinceData != null && (
                      <span className="hdr-status-sublabel">{secondsSinceData}s ago</span>
                    )}
                  </div>
                ) : (
                  <div className="hdr-status offline">
                    <div className="hdr-status-row">
                      <span className="hdr-pulse-wrap">
                        <span className="hdr-pulse-core" style={{ background: 'var(--red)' }} />
                      </span>
                      Offline
                    </div>
                    {secondsSinceData != null && (
                      <span className="hdr-status-sublabel">{secondsSinceData}s ago</span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="hdr-spacer" />

            {/* ── Metrics strip ── */}
            <div className="hdr-metrics">
              <div className="hdr-metric">
                <span className="hdr-metric-val" style={{ color: 'var(--accent)' }}>{clock.now}</span>
                <span className="hdr-metric-lbl">System Time</span>
              </div>
              <div className="hdr-metric">
                <span className="hdr-metric-val" style={{ color: 'var(--accent2)' }}>{clock.date}</span>
                <span className="hdr-metric-lbl">Session Date</span>
              </div>
              {showMachineZone && (
                <div className="hdr-metric">
                  <span className="hdr-metric-val" style={{ color: isLive ? 'var(--green)' : connected ? 'var(--red)' : 'var(--amber)' }}>
                    {isLive ? 'ONLINE' : connected ? 'OFFLINE' : 'STANDBY'}
                  </span>
                  <span className="hdr-metric-lbl">Node Status</span>
                </div>
              )}
            </div>

            {/* ── User + logout ── */}
            <div className="hdr-right">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="hdr-avatar">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="hdr-user-info">
                  <span className="hdr-user-name">{user?.name || 'Operator'}</span>
                  <span className="hdr-user-role">Operator</span>
                </div>
              </div>
              <button className="hdr-logout" onClick={logout}>
                <span className="hdr-logout-text">Sign out</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>

          </div>
        </div>
        <div className="hdr-sub-bar" />
      </div>
    </>
  )
}

export default Header