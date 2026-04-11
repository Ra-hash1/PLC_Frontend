const FooterFixed = () => (
  <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600&display=swap');

      .ftr-root {
        --accent:  #38bdf8;
        --accent2: #818cf8;
        --border:  rgba(255,255,255,0.08);
        --text-lo: rgba(241,245,249,0.32);
        font-family: 'Outfit', sans-serif;
        flex-shrink: 0;
      }

      .ftr-sub-bar {
        height: 2px;
        background: linear-gradient(90deg,
          transparent 0%,
          rgba(56,189,248,0.4) 20%,
          rgba(129,140,248,0.4) 80%,
          transparent 100%);
      }

      .ftr-shell {
        height: 44px;
        background: linear-gradient(105deg, #050c1a 0%, #06101f 45%, #080e1c 100%);
        border-top: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }

      .ftr-grid {
        position: absolute; inset: 0;
        background-image:
          linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
        background-size: 40px 40px;
        pointer-events: none;
      }
      .ftr-glow-left {
        position: absolute;
        left: -80px; bottom: -20px;
        width: 260px; height: 80px;
        background: radial-gradient(ellipse, rgba(56,189,248,0.08) 0%, transparent 70%);
        pointer-events: none;
      }
      .ftr-glow-right {
        position: absolute;
        right: 60px; top: -20px;
        width: 180px; height: 80px;
        background: radial-gradient(ellipse, rgba(129,140,248,0.07) 0%, transparent 70%);
        pointer-events: none;
      }

      .ftr-secured {
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: 'Outfit', sans-serif;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-lo);
        letter-spacing: 0.04em;
        position: relative;
        z-index: 1;
      }

      .ftr-secured svg {
        width: 14px;
        height: 14px;
        opacity: 0.45;
        flex-shrink: 0;
      }

      .ftr-secured-link {
        font-family: 'Syne', sans-serif;
        font-size: 15px;
        font-weight: 800;
        background: linear-gradient(90deg, var(--accent), var(--accent2));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        text-decoration: none;
        letter-spacing: 0.02em;
        transition: opacity 0.15s;
      }
      .ftr-secured-link:hover { opacity: 0.75; }

      @media (max-width: 480px) {
        .ftr-secured { font-size: 12px; gap: 6px; }
        .ftr-secured-link { font-size: 13px; }
        .ftr-secured svg { width: 12px; height: 12px; }
      }
    `}</style>

    <div className="ftr-root">
      <div className="ftr-sub-bar" />
      <div className="ftr-shell">
        <div className="ftr-grid" />
        <div className="ftr-glow-left" />
        <div className="ftr-glow-right" />

        <div className="ftr-secured">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Secured by
          <a href="https://www.intute.in/" target="_blank" rel="noopener noreferrer" className="ftr-secured-link">
            Intute.ai
          </a>
        </div>
      </div>
    </div>
  </>
)

export default FooterFixed