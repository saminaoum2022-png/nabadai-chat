// ─────────────────────────────────────────────────────────────
//  NabadAI — index.js (Next.js Page)
//  Fixes applied:
//   [FIX-1]  Mobile shell removed — widget auto-opens on mobile
//   [FIX-2]  Auto-open uses public widget API instead of hidden launcher click
//   [FIX-3]  Service worker update check added on every revisit
//   [FIX-4]  Auto-open uses retry interval not a single guess
//   [FIX-5]  Splash fade-out animation before unmount
//   [FIX-6]  Dead window.NABAD_API variable removed
//   [FIX-7]  Open Graph and Twitter meta tags added
//   [FIX-8]  PERSONALITIES labels sourced from single array
//   [FIX-9]  Chip buttons have descriptive aria-label
// ─────────────────────────────────────────────────────────────

import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';

// [FIX-8] Single source of truth for personality labels
const PERSONALITIES = [
  { id: 'strategist', label: 'Strategist' },
  { id: 'growth', label: 'Growth Expert' },
  { id: 'branding', label: 'Brand Builder' },
  { id: 'offer', label: 'Offer Architect' },
  { id: 'creative', label: 'Creative Challenger' },
  { id: 'straight_talk', label: 'Straight Talk' },
];

const FEATURE_POINTS = [
  {
    title: 'Strategy',
    text: 'Sharper positioning, clearer business direction, smarter decisions.',
    emoji: '🧠',
  },
  {
    title: 'Branding',
    text: 'Naming, identity, premium direction, and stronger market perception.',
    emoji: '🎨',
  },
  {
    title: 'Growth',
    text: 'Offers, acquisition ideas, conversion thinking, and monetization.',
    emoji: '📈',
  },
];

export default function Home() {
  const [showSplash, setShowSplash]     = useState(true);
  const [splashHiding, setSplashHiding] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    const keepWebsiteMode = new URLSearchParams(window.location.search).get('website') === '1';
    if (isDesktop && !keepWebsiteMode) {
      window.location.replace('/app');
    }
  }, []);

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    let splashClosed = false;
    let failSafeTimer = null;
    const hideSplash = () => {
      if (splashClosed) return;
      splashClosed = true;
      setSplashHiding(true);
      window.setTimeout(() => setShowSplash(false), 380);
    };

    // Desktop keeps timed splash; mobile waits for chat open to avoid blue flash
    let fadeTimer = null;
    let removeTimer = null;
    if (!isMobile) {
      fadeTimer = window.setTimeout(() => setSplashHiding(true), 1200);
      removeTimer = window.setTimeout(() => setShowSplash(false), 1650);
    } else {
      // Never block forever if widget fails for any reason
      failSafeTimer = window.setTimeout(() => hideSplash(), 5200);
    }

    // [FIX-3] Register SW with immediate update check
    const registerServiceWorker = () => {
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.register('/sw.js').then(reg => {
        reg.update();
      }).catch(() => {});
    };

    if (document.readyState === 'complete') {
      registerServiceWorker();
    } else {
      window.addEventListener('load', registerServiceWorker, { once: true });
    }

    // [FIX-2] Open widget via public API exposed by widget.js
    const openWidget = () => {
      if (window.__NABAD_OPEN_WIDGET__) {
        window.__NABAD_OPEN_WIDGET__();
        if (isMobile) hideSplash();
        return true;
      }
      const launcher = document.getElementById('nabad-launcher');
      if (launcher) {
        launcher.click();
        if (isMobile) hideSplash();
        return true;
      }
      return false;
    };

    // [FIX-4] Auto-open after splash finishes — retry until widget is ready
    let autoOpenTimer = null;
    let pollTimer     = null;

    autoOpenTimer = window.setTimeout(() => {
      if (!openWidget()) {
        let attempts = 0;
        pollTimer = window.setInterval(() => {
          attempts++;
          if (openWidget() || attempts > 60) {
            window.clearInterval(pollTimer);
          }
        }, 100);
      }
    }, 1800);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
      window.clearTimeout(failSafeTimer);
      window.clearTimeout(autoOpenTimer);
      window.clearInterval(pollTimer);
    };
  }, []);

  // [FIX-2] Manual open for desktop chips and CTA button
  const handleOpenWidget = (personalityId = 'auto') => {
    window.__NABAD_PENDING_PERSONALITY__ = personalityId;
    if (window.__NABAD_SET_PERSONALITY__) {
      window.__NABAD_SET_PERSONALITY__(personalityId);
    }
    if (window.__NABAD_OPEN_WIDGET__) {
      window.__NABAD_OPEN_WIDGET__();
      return;
    }
    const launcher = document.getElementById('nabad-launcher');
    if (launcher) { launcher.click(); return; }
  };

  return (
    <>
      <Head>
        <title>NabadAi</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="description" content="NabadAi is your business-focused AI for strategy, growth, branding, offers, and creative direction." />
        <meta name="theme-color" content="#f7f8fc" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="NabadAi" />
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo-icon.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* [FIX-7] Open Graph & Twitter meta tags */}
        <meta property="og:title" content="NabadAi — Business AI" />
        <meta property="og:description" content="Strategy, branding, growth, offers and creative direction — all in one AI." />
        <meta property="og:image" content="https://nabadai.com/og-image.png" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://nabadai.com" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="NabadAi — Business AI" />
        <meta name="twitter:description" content="Your business-focused AI assistant." />
        <meta name="twitter:image" content="https://nabadai.com/og-image.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=Sora:wght@600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <Script id="nabad-widget-config" strategy="beforeInteractive">
        {`
          window.NABAD_WIDGET_CONFIG = {
            apiUrl: '/api/chat',
            title: 'NabadAi',
            subtitle: 'Business AI',
            vapidPublicKey: '${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''}'
          };
        `}
      </Script>

      <Script
        id="nabad-widget-script"
        src="/widget.js?v=69"
        strategy="afterInteractive"
      />

      <main id="nabad-page">
        <div id="nabad-page-bg" />

        <section id="nabad-desktop-hero" aria-label="NabadAi landing">
          <div id="nabad-desktop-hero-inner">
            <div id="nabad-desktop-copy">
              <div className="nabad-eyebrow">NabadAi</div>
              <h1>Nabad AI for smarter business thinking</h1>
              <p className="nabad-lead">
                Strategy, branding, offers, growth, and creative ideas — all in
                one business-focused AI experience.
              </p>
              <p className="nabad-sublead">
                On mobile, Nabad opens directly into chat. On desktop, launch it
                from the glowing button in the corner.
              </p>

              <div className="nabad-feature-list">
                {FEATURE_POINTS.map(item => (
                  <div className="nabad-feature-card" key={item.title}>
                    <div className="nabad-feature-title">
                      <span>{item.emoji}</span>
                      <strong>{item.title}</strong>
                    </div>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside id="nabad-desktop-side">
              <div className="nabad-side-card">
                <h3>Start with a personality</h3>
                <p>
                  Choose how you want Nabad to think: strategist, growth
                  expert, brand builder, offer architect, creative challenger,
                  or straight talk.
                </p>
                <p className="nabad-side-small">
                  The mobile experience opens directly into the assistant after
                  the splash. On desktop, click the launcher to begin.
                </p>

                <div className="nabad-chip-grid">
                  {/* [FIX-9] Descriptive aria-label on each chip */}
                  {PERSONALITIES.map(item => (
                    <button
                      type="button"
                      key={item.id}
                      className="nabad-chip"
                      aria-label={`Open Nabad as ${item.label}`}
                      onClick={() => handleOpenWidget(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <button type="button" className="nabad-cta" onClick={() => handleOpenWidget('auto')}>
                  Open Nabad
                </button>
              </div>
            </aside>
          </div>
        </section>

        {/* [FIX-5] Fade-out class applied before unmount */}
        {showSplash && (
          <div
            id="nabad-splash"
            className={splashHiding ? 'hiding' : ''}
            aria-hidden="true"
          >
            <img src="/logo.png" alt="NabadAi" />
          </div>
        )}
      </main>

      <style jsx global>{`
        html, body, #__next {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100%;
          overflow-x: hidden;
          background: #f4f8ff;
          font-family: "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        :root {
          --nabad-text: #091428;
          --nabad-muted: #4f6178;
          --nabad-surface: rgba(255,255,255,0.82);
          --nabad-stroke: rgba(255,255,255,0.9);
          --nabad-shadow: 0 20px 60px rgba(9,20,40,0.09);
          --nabad-brand-a: #2563eb;
          --nabad-brand-b: #06b6d4;
        }

        * { box-sizing: border-box; }
        body { color: var(--nabad-text); }

        button, input, textarea, select { font: inherit; }
        a { color: inherit; }

        #nabad-page {
          position: relative;
          min-height: 100dvh;
          overflow: hidden;
          background:
            radial-gradient(circle at 10% 14%, rgba(56,189,248,0.22), transparent 24%),
            radial-gradient(circle at 85% 18%, rgba(37,99,235,0.18), transparent 24%),
            radial-gradient(circle at 50% 100%, rgba(14,165,233,0.14), transparent 32%),
            linear-gradient(180deg, #f8fbff 0%, #f2f7ff 100%);
        }

        #nabad-page-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 18% 20%, rgba(59,130,246,0.08), transparent 20%),
            radial-gradient(circle at 82% 16%, rgba(14,165,233,0.10), transparent 18%),
            radial-gradient(circle at 50% 85%, rgba(99,102,241,0.08), transparent 18%);
        }

        /* [FIX-5] Splash with fade transition */
        #nabad-splash {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f7f8fc;
          opacity: 1;
          transition: opacity 0.4s ease;
        }

        #nabad-splash.hiding {
          opacity: 0;
          pointer-events: none;
        }

        #nabad-splash img {
          width: 94px;
          height: 94px;
          object-fit: contain;
          animation: nabadLogoGlow 1.25s ease-in-out infinite alternate;
          filter: drop-shadow(0 10px 28px rgba(37,99,235,0.18));
        }

        @keyframes nabadLogoGlow {
          0% {
            transform: scale(0.98);
            filter: drop-shadow(0 8px 24px rgba(37,99,235,0.12));
          }
          100% {
            transform: scale(1.03);
            filter: drop-shadow(0 10px 32px rgba(34,211,238,0.26));
          }
        }

        #nabad-desktop-hero {
          position: relative;
          z-index: 1;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 22px;
        }

        #nabad-desktop-hero-inner {
          width: min(1120px, 100%);
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(320px, 420px);
          gap: 28px;
          align-items: stretch;
          padding: 28px;
          border-radius: 34px;
          background: var(--nabad-surface);
          border: 1px solid var(--nabad-stroke);
          box-shadow: var(--nabad-shadow), inset 0 1px 0 rgba(255,255,255,0.75);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        #nabad-desktop-copy, #nabad-desktop-side { min-width: 0; }

        .nabad-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          padding: 9px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(148,163,184,0.15);
          color: #334155;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.02em;
          box-shadow: 0 8px 24px rgba(15,23,42,0.05);
        }

        #nabad-desktop-copy h1 {
          margin: 0 0 16px;
          font-family: "Sora", "Manrope", sans-serif;
          font-size: clamp(40px, 5vw, 62px);
          line-height: 0.96;
          letter-spacing: -0.04em;
          color: #020617;
          max-width: 640px;
        }

        .nabad-lead, .nabad-sublead {
          max-width: 700px;
          font-size: 19px;
          line-height: 1.6;
          color: var(--nabad-muted);
          margin: 0 0 16px;
        }

        .nabad-sublead { margin-bottom: 28px; }

        .nabad-feature-list { display: grid; gap: 16px; }

        .nabad-feature-card, .nabad-side-card {
          border-radius: 24px;
          background: rgba(255,255,255,0.88);
          border: 1px solid rgba(255,255,255,0.92);
          box-shadow: 0 12px 34px rgba(15,23,42,0.06);
        }

        .nabad-feature-card { padding: 18px 20px; }

        .nabad-feature-title {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
          color: #0f172a;
          font-size: 24px;
        }

        .nabad-feature-card p {
          margin: 0;
          color: var(--nabad-muted);
          font-size: 17px;
          line-height: 1.52;
        }

        .nabad-side-card { height: 100%; padding: 24px; }

        .nabad-side-card h3 {
          margin: 0 0 14px;
          font-size: 22px;
          line-height: 1.2;
          color: #0f172a;
        }

        .nabad-side-card p {
          margin: 0 0 14px;
          color: var(--nabad-muted);
          font-size: 16px;
          line-height: 1.6;
        }

        .nabad-side-small { color: #64748b; }

        .nabad-chip-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 20px 0 22px;
        }

        .nabad-chip {
          appearance: none;
          border: 1px solid rgba(226,232,240,0.95);
          background: linear-gradient(180deg, #ffffff 0%, #f7f8ff 100%);
          color: #334155;
          border-radius: 999px;
          padding: 11px 16px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          box-shadow: 0 8px 22px rgba(9,20,40,0.06);
        }

        .nabad-chip:hover {
          transform: translateY(-1px);
          border-color: rgba(59,130,246,0.22);
          box-shadow: 0 12px 26px rgba(37,99,235,0.10);
        }

        .nabad-cta {
          appearance: none;
          border: none;
          border-radius: 999px;
          padding: 14px 18px;
          min-height: 48px;
          background: linear-gradient(135deg, var(--nabad-brand-a) 0%, #1d4ed8 40%, var(--nabad-brand-b) 100%);
          color: #fff;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.01em;
          cursor: pointer;
          box-shadow:
            0 12px 30px rgba(37,99,235,0.22),
            0 0 18px rgba(34,211,238,0.12);
          transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
        }

        .nabad-cta:hover {
          transform: translateY(-1px);
          filter: saturate(1.05);
          box-shadow:
            0 18px 36px rgba(37,99,235,0.25),
            0 0 22px rgba(34,211,238,0.15);
        }

        #nabad-widget-root { z-index: 2147483000 !important; }
        #nabad-launcher, #nabad-panel { z-index: 2147483001 !important; }

        /* Responsive layout */
        @media (max-width: 767px) {
          #nabad-desktop-hero { display: none; }
          #nabad-launcher { display: none !important; }
        }
      `}</style>
    </>
  );
}
