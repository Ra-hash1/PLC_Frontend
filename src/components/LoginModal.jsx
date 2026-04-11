import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'
import { Eye, EyeOff, ArrowRight, ChevronLeft, Mail, Lock } from 'lucide-react'
import logo from '../assets/Intute.png'

/* ─── Floating Label Input ─── */
function FloatingInput({ type, value, onChange, label, icon: Icon, id, showToggle, onToggle, showPassword, disabled }) {
  const [focused, setFocused] = useState(false)
  const active = focused || value.length > 0

  return (
    <div style={{ position: 'relative', marginBottom: '16px' }}>

      {/* Left icon */}
      <span style={{
        position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
        color: active ? 'rgba(56,189,248,0.7)' : 'rgba(241,245,249,0.2)',
        pointerEvents: 'none', display: 'flex', alignItems: 'center',
        transition: 'color 0.2s',
      }}>
        <Icon size={15} strokeWidth={1.8} />
      </span>

      {/* Floating label */}
      <label htmlFor={id} style={{
        position: 'absolute',
        left: '42px',
        top: active ? '8px' : '50%',
        transform: active ? 'translateY(0)' : 'translateY(-50%)',
        fontSize: active ? '9px' : '13px',
        fontWeight: active ? 600 : 400,
        color: active ? '#38bdf8' : 'rgba(241,245,249,0.3)',
        letterSpacing: active ? '0.1em' : '0',
        textTransform: active ? 'uppercase' : 'none',
        transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
        pointerEvents: 'none',
        zIndex: 2,
      }}>
        {label}
      </label>

      {/* Input */}
      <input
        id={id}
        type={showToggle ? (showPassword ? 'text' : 'password') : type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required
        disabled={disabled}
        autoComplete={id === 'email' ? 'username' : 'current-password'}
        style={{
          width: '100%',
          height: '56px',
          paddingLeft: '42px',
          paddingRight: showToggle ? '44px' : '14px',
          paddingTop: active ? '20px' : '0',
          paddingBottom: active ? '6px' : '0',
          background: focused ? 'rgba(56,189,248,0.04)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${focused ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.09)'}`,
          borderRadius: '12px',
          fontSize: '13px',
          color: '#f1f5f9',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s, background 0.2s',
          fontFamily: 'inherit',
          opacity: disabled ? 0.5 : 1,
        }}
      />

      {/* Check mark for email */}
      {value.length > 0 && !showToggle && (
        <span style={{
          position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
          color: '#34d399', fontSize: '13px',
        }}>✓</span>
      )}

      {/* Password toggle */}
      {showToggle && (
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(241,245,249,0.25)', display: 'flex', alignItems: 'center',
            padding: '4px', transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#38bdf8'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(241,245,249,0.25)'}
        >
          {showPassword ? <EyeOff size={15} strokeWidth={1.8} /> : <Eye size={15} strokeWidth={1.8} />}
        </button>
      )}
    </div>
  )
}

/* ─── Main Component ─── */
const LoginModal = () => {
  const { login }  = useAuth()
  const navigate   = useNavigate()

  const [view, setView]                 = useState('landing')
  const [form, setForm]                 = useState({ email: '', password: '' })
  const [loading, setLoading]           = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.email, form.password)
      toast.success('Welcome back!')
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const goToForm = () => setView('form')
  const goBack   = () => {
    if (loading) return
    setView('landing')
    setForm({ email: '', password: '' })
    setShowPassword(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@300;400;500;600&display=swap');

        .lm-root {
          --accent:    #38bdf8;
          --accent2:   #818cf8;
          --green:     #34d399;
          --border:    rgba(255,255,255,0.08);
          --border-hi: rgba(255,255,255,0.12);
          --surface:   rgba(255,255,255,0.04);
          --text-hi:   #f1f5f9;
          --text-md:   rgba(241,245,249,0.45);
          --text-lo:   rgba(241,245,249,0.22);
          min-height: 100vh;
          background: #07090f;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* ── Grid background ── */
        .lm-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
          background-size: 36px 36px;
          pointer-events: none;
        }

        /* ── Glow orbs ── */
        .lm-orb1 {
          position: absolute; top: -100px; left: -80px;
          width: 400px; height: 400px; border-radius: 50%;
          background: radial-gradient(circle, rgba(56,189,248,0.09) 0%, transparent 70%);
          pointer-events: none;
        }
        .lm-orb2 {
          position: absolute; bottom: -80px; right: -60px;
          width: 320px; height: 320px; border-radius: 50%;
          background: radial-gradient(circle, rgba(129,140,248,0.07) 0%, transparent 70%);
          pointer-events: none;
        }

        /* ════════════════════════════
           LANDING VIEW
        ════════════════════════════ */
        .lm-landing {
          position: relative; z-index: 2;
          display: flex; flex-direction: column;
          align-items: center; text-align: center;
          padding: 0 32px; max-width: 540px; width: 100%;
        }

        .lm-logo-wrap { margin-bottom: 40px; position: relative; }

        .lm-logo-pulse {
          position: absolute; inset: -14px; border-radius: 28px;
          border: 1px solid rgba(56,189,248,0.14);
          animation: lm-pulse 3s ease-in-out infinite;
        }
        @keyframes lm-pulse {
          0%,100% { opacity: 0.4; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.05); }
        }

        .lm-logo-ring {
          width: 80px; height: 80px; border-radius: 20px;
          background: rgba(56,189,248,0.08);
          border: 1px solid rgba(56,189,248,0.2);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; position: relative;
        }
        .lm-logo-img      { width: 64px; height: 64px; object-fit: contain; }
        .lm-logo-fallback {
          font-family: 'Syne', sans-serif;
          font-size: 30px; font-weight: 800; color: var(--accent);
        }

        .lm-main-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(40px, 8vw, 64px);
          font-weight: 800; color: var(--text-hi);
          letter-spacing: -0.03em; line-height: 1.05;
          margin-bottom: 12px;
        }
        .lm-main-title span { color: var(--accent); }

        .lm-shimmer {
          height: 1px; width: 100px;
          background: linear-gradient(90deg, transparent, var(--accent), transparent);
          background-size: 200% 100%;
          animation: lm-shim 2.5s ease-in-out infinite;
          margin: 0 auto 12px;
        }
        @keyframes lm-shim {
          0%,100% { background-position: -200% center; opacity: 0.4; }
          50%      { background-position:  200% center; opacity: 1;   }
        }

        .lm-subtitle {
          font-size: 11px; letter-spacing: 0.2em;
          text-transform: uppercase; color: var(--text-lo);
          margin-bottom: 44px;
        }

        .lm-cta {
          background: var(--accent); border: none; border-radius: 14px;
          padding: 16px 48px;
          font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 600;
          color: #04101a; cursor: pointer;
          display: inline-flex; align-items: center; gap: 10px;
          transition: background 0.2s, transform 0.2s;
        }
        .lm-cta:hover  { background: #7dd3fc; transform: translateY(-2px); }
        .lm-cta:active { transform: translateY(0); }
        .lm-cta-arrow  { transition: transform 0.25s; display: flex; align-items: center; }
        .lm-cta:hover .lm-cta-arrow { transform: translateX(4px); }

        .lm-dots { display: flex; gap: 7px; align-items: center; margin-top: 44px; }
        .lm-dot  { height: 6px; border-radius: 3px; background: var(--accent); }

        /* ════════════════════════════
           FORM VIEW
        ════════════════════════════ */
        .lm-card {
          position: relative; z-index: 2;
          width: 440px; max-width: calc(100vw - 32px);
          background: rgba(12,17,30,0.97);
          border: 1px solid var(--border-hi);
          border-radius: 24px; overflow: hidden;
        }

        .lm-topbar { height: 2px; background: var(--accent); }

        .lm-card-body { padding: 36px 40px 40px; }

        .lm-card-header {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 28px;
        }

        .lm-back {
          background: none; border: none; cursor: pointer;
          color: var(--text-lo); font-family: 'Inter', sans-serif;
          font-size: 13px; font-weight: 500;
          display: flex; align-items: center; gap: 4px;
          transition: color 0.2s; padding: 0;
        }
        .lm-back:hover          { color: var(--accent); }
        .lm-back:disabled       { opacity: 0.4; cursor: not-allowed; }

        .lm-mini-logo {
          width: 36px; height: 36px; border-radius: 9px;
          background: rgba(56,189,248,0.08);
          border: 1px solid rgba(56,189,248,0.18);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .lm-mini-logo img     { width: 28px; height: 28px; object-fit: contain; }
        .lm-mini-fallback {
          font-family: 'Syne', sans-serif;
          font-size: 14px; font-weight: 800; color: var(--accent);
        }

        .lm-status {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 12px;
          background: rgba(52,211,153,0.06);
          border: 1px solid rgba(52,211,153,0.12);
          border-radius: 8px; margin-bottom: 20px;
        }
        .lm-sdot  { width: 5px; height: 5px; border-radius: 50%; background: var(--green); flex-shrink: 0; }
        .lm-stext { font-size: 11px; color: var(--text-lo); }

        .lm-heading {
          font-family: 'Syne', sans-serif;
          font-size: 22px; font-weight: 800;
          color: var(--text-hi); letter-spacing: -0.02em;
          margin-bottom: 5px;
        }
        .lm-subheading { font-size: 12px; color: var(--text-lo); margin-bottom: 24px; }

        .lm-submit {
          width: 100%; margin-top: 8px; padding: 14px;
          background: var(--accent); border: none; border-radius: 12px;
          font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600;
          color: #04101a; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: background 0.2s, transform 0.15s;
        }
        .lm-submit:hover:not(:disabled)  { background: #7dd3fc; transform: translateY(-1px); }
        .lm-submit:active:not(:disabled) { transform: translateY(0); }
        .lm-submit:disabled              { opacity: 0.55; cursor: not-allowed; }
        .lm-submit-arrow { transition: transform 0.2s; display: flex; align-items: center; }
        .lm-submit:hover:not(:disabled) .lm-submit-arrow { transform: translateX(3px); }

        .lm-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(4,16,26,0.3);
          border-top-color: #04101a; border-radius: 50%;
          animation: lm-spin 0.7s linear infinite; flex-shrink: 0;
        }
        @keyframes lm-spin { to { transform: rotate(360deg); } }

        .lm-card-foot {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 40px 16px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .lm-foot-text { font-size: 10px; color: var(--text-lo); letter-spacing: 0.05em; }
        .lm-foot-link {
          font-size: 11px; font-weight: 600; color: var(--accent);
          text-decoration: none; transition: opacity 0.15s;
        }
        .lm-foot-link:hover { opacity: 0.7; }

        /* ── Shared fade-in ── */
        .lm-fade-in {
          animation: lm-fi 0.45s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        @keyframes lm-fi {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 480px) {
          .lm-card-body { padding: 28px 24px 32px; }
          .lm-card-foot { padding: 12px 24px 16px; }
          .lm-main-title { font-size: 36px; }
        }
      `}</style>

      <div className="lm-root">
        <div className="lm-grid" />
        <div className="lm-orb1" />
        <div className="lm-orb2" />

        {/* ══════════════ LANDING ══════════════ */}
        {view === 'landing' && (
          <div className="lm-landing lm-fade-in">

            <div className="lm-logo-wrap">
              <div className="lm-logo-pulse" />
              <div className="lm-logo-ring">
                <img
                  src={logo}
                  alt="Intute"
                  className="lm-logo-img"
                  onError={e => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextSibling.style.display = 'block'
                  }}
                />
                <span className="lm-logo-fallback" style={{ display: 'none' }}>I</span>
              </div>
            </div>

            <h1 className="lm-main-title">
              PLC<br /><span>Monitor</span>
            </h1>
            <div className="lm-shimmer" />
            <p className="lm-subtitle">Powered by Intute.ai</p>

            <button className="lm-cta" onClick={goToForm}>
              Get Started
              <span className="lm-cta-arrow">
                <ArrowRight size={17} strokeWidth={2.5} />
              </span>
            </button>

            <div className="lm-dots">
              <div className="lm-dot" style={{ width: 24, opacity: 0.85 }} />
              <div className="lm-dot" style={{ width: 6,  opacity: 0.2  }} />
              <div className="lm-dot" style={{ width: 6,  opacity: 0.2  }} />
              <div className="lm-dot" style={{ width: 6,  opacity: 0.2  }} />
              <div className="lm-dot" style={{ width: 6,  opacity: 0.2  }} />
            </div>
          </div>
        )}

        {/* ══════════════ FORM ══════════════ */}
        {view === 'form' && (
          <div className="lm-card lm-fade-in">
            <div className="lm-topbar" />

            <div className="lm-card-body">

              {/* Header row */}
              <div className="lm-card-header">
                <button className="lm-back" onClick={goBack} disabled={loading}>
                  <ChevronLeft size={14} strokeWidth={2.5} />
                  Back
                </button>
                <div className="lm-mini-logo">
                  <img
                    src={logo}
                    alt="Intute"
                    onError={e => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextSibling.style.display = 'block'
                    }}
                  />
                  <span className="lm-mini-fallback" style={{ display: 'none' }}>I</span>
                </div>
              </div>

              {/* Status pill */}
              <div className="lm-status">
                <div className="lm-sdot" />
                <span className="lm-stext">All systems operational</span>
              </div>

              <p className="lm-heading">Welcome back</p>
              <p className="lm-subheading">Sign in to continue to your workspace</p>

              <form onSubmit={handleSubmit}>
                <FloatingInput
                  id="email"
                  type="email"
                  label="Email address"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  icon={Mail}
                  disabled={loading}
                />

                <FloatingInput
                  id="password"
                  type="password"
                  label="Password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  icon={Lock}
                  showToggle
                  showPassword={showPassword}
                  onToggle={() => setShowPassword(v => !v)}
                  disabled={loading}
                />

                <button type="submit" className="lm-submit" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="lm-spinner" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <span className="lm-submit-arrow">
                        <ArrowRight size={15} strokeWidth={2.5} />
                      </span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="lm-card-foot">
              <span className="lm-foot-text">Secured by</span>
              <a
                href="https://www.intute.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="lm-foot-link"
              >
                Intute.ai
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default LoginModal