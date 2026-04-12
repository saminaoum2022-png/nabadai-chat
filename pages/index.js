import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';

const PERSONALITIES = [
  'Strategist',
  'Growth Expert',
  'Brand Builder',
  'Offer Architect',
  'Creative Challenger',
  'Straight Talk',
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
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    let autoOpenTimer = null;
    let pollTimer = null;

    const hideSplashTimer = window.setTimeout(() => {
      setShowSplash(false);
    }, 1150);

    const registerServiceWorker = () => {
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    };

    if (document.readyState === 'complete') {
      registerServiceWorker();
    } else {
      window.addEventListener('load', registerServiceWorker, { once: true });
    }

    const openWidget = () => {
      const launcher = document.getElementById('nabad-launcher');
      if (launcher) {
        launcher.click();
        return true;
      }
      return false;
    };

    const autoOpenMobileWidget = () => {
      if (typeof window === 'undefined') return;
      if (window.innerWidth >= 768) return;

      let tries = 0;
      pollTimer = window.setInterval(() => {
        tries += 1;

        if (openWidget()) {
          window.clearInterval(pollTimer);
          pollTimer = null;
          return;
        }

        if (tries >= 50) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
      }, 120);
    };

    autoOpenTimer = window.setTimeout(() => {
      autoOpenMobileWidget();
    }, 1300);

    return () => {
      window.clearTimeout(hideSplashTimer);
      if (autoOpenTimer) window.clearTimeout(autoOpenTimer);
      if (pollTimer) window.clearInterval(pollTimer);
      window.removeEventListener('load', registerServiceWorker);
    };
  }, []);

  const handleOpenWidget = () => {
    const launcher = document.getElementById('nabad-launcher');
    if (launcher) {
      launcher.click();
      return;
    }

    window.setTimeout(() => {
      const retryLauncher = document.getElementById('nabad-launcher');
      if (retryLauncher) retryLauncher.click();
    }, 300);
  };

  return (
    <>
      <Head>
        <title>NabadAi</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta
          name="description"
          content="NabadAi is your business-focused AI for strategy, growth, branding, offers, and creative direction."
        />
        <meta name="theme-color" content="#f7f8fc" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="NabadAi" />
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="manifest" href="/manifest.json" />
      </Head>

      <Script id="nabad-widget-config" strategy="beforeInteractive">
        {`
          window.NABAD_API = '/api/chat';
          window.NABAD_WIDGET_CONFIG = {
            apiUrl: '/api/chat',
            title: 'NabadAi',
            subtitle: 'Business AI'
          };
        `}
      </Script>

      <Script
        id="nabad-widget-script"
        src="/widget.js?v=10"
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
                {FEATURE_POINTS.map((item) => (
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
                  {PERSONALITIES.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className="nabad-chip"
                      onClick={handleOpenWidget}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="nabad-cta"
                  onClick={handleOpenWidget}
                >
                  Open Nabad
                </button>
              </div>
            </aside>
          </div>
        </section>

        <section id="nabad-mobile-shell" aria-label="Open Nabad on mobile">
          <div className="nabad-mobile-card">
            <img src="/logo.png" alt="NabadAi" className="nabad-mobile-logo" />
            <h2>NabadAi</h2>
            <p>
              Your business AI for strategy, branding, growth, and offer ideas.
            </p>
            <button type="button" className="nabad-cta" onClick={handleOpenWidget}>
              Open chat
            </button>
          </div>
        </section>

        {showSplash && (
          <div id="nabad-splash" aria-hidden="true">
            <img src="/logo.png" alt="NabadAi" />
          </div>
        )}
      </main>

      <style jsx global>{`
        html,
        body,
        #__next {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100%;
          overflow-x: hidden;
          background: #f7f8fc;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
            'Segoe UI', sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        body {
          color: #0f172a;
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        a {
          color: inherit;
        }

        #nabad-page {
          position: relative;
          min-height: 100dvh;
          overflow: hidden;
          background:
            radial-gradient(circle at top left, rgba(125, 211, 252, 0.18), transparent 26%),
            radial-gradient(circle at top right, rgba(196, 181, 253, 0.22), transparent 26%),
            linear-gradient(180deg, #f8fbff 0%, #f7f8fc 100%);
        }

        #nabad-page-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 18% 20%, rgba(59, 130, 246, 0.08), transparent 20%),
            radial-gradient(circle at 82% 16%, rgba(14, 165, 233, 0.10), transparent 18%),
            radial-gradient(circle at 50% 85%, rgba(99, 102, 241, 0.08), transparent 18%);
        }

        #nabad-splash {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f7f8fc;
        }

        #nabad-splash img {
          width: 94px;
          height: 94px;
          object-fit: contain;
          animation: nabadLogoGlow 1.25s ease-in-out infinite alternate;
          filter: drop-shadow(0 10px 28px rgba(37, 99, 235, 0.18));
        }

        @keyframes nabadLogoGlow {
          0% {
            transform: scale(0.98);
            filter: drop-shadow(0 8px 24px rgba(37, 99, 235, 0.12));
          }
          100% {
            transform: scale(1.03);
            filter: drop-shadow(0 10px 32px rgba(34, 211, 238, 0.26));
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
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.8);
          box-shadow:
            0 20px 60px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        #nabad-desktop-copy,
        #nabad-desktop-side {
          min-width: 0;
        }

        .nabad-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          padding: 9px 14px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.15);
          color: #334155;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.02em;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
        }

        #nabad-desktop-copy h1 {
          margin: 0 0 16px;
          font-size: clamp(40px, 5vw, 62px);
          line-height: 0.96;
          letter-spacing: -0.04em;
          color: #020617;
          max-width: 640px;
        }

        .nabad-lead,
        .nabad-sublead {
          max-width: 700px;
          font-size: 20px;
          line-height: 1.65;
          color: #475569;
          margin: 0 0 16px;
        }

        .nabad-sublead {
          margin-bottom: 28px;
        }

        .nabad-feature-list {
          display: grid;
          gap: 16px;
        }

        .nabad-feature-card,
        .nabad-side-card {
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(255, 255, 255, 0.92);
          box-shadow: 0 12px 34px rgba(15, 23, 42, 0.06);
        }

        .nabad-feature-card {
          padding: 18px 20px;
        }

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
          color: #5b6473;
          font-size: 18px;
          line-height: 1.55;
        }

        .nabad-side-card {
          height: 100%;
          padding: 24px;
        }

        .nabad-side-card h3 {
          margin: 0 0 14px;
          font-size: 22px;
          line-height: 1.2;
          color: #0f172a;
        }

        .nabad-side-card p {
          margin: 0 0 14px;
          color: #5b6473;
          font-size: 17px;
          line-height: 1.6;
        }

        .nabad-side-small {
          color: #64748b;
        }

        .nabad-chip-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 20px 0 22px;
        }

        .nabad-chip {
          appearance: none;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: linear-gradient(180deg, #ffffff 0%, #f7f8ff 100%);
          color: #334155;
          border-radius: 999px;
          padding: 11px 16px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05);
        }

        .nabad-chip:hover {
          transform: translateY(-1px);
          border-color: rgba(59, 130, 246, 0.22);
          box-shadow: 0 12px 26px rgba(37, 99, 235, 0.10);
        }

        .nabad-cta {
          appearance: none;
          border: none;
          border-radius: 999px;
          padding: 14px 18px;
          min-height: 48px;
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 45%, #06b6d4 100%);
          color: #fff;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.01em;
          cursor: pointer;
          box-shadow:
            0 12px 30px rgba(37, 99, 235, 0.22),
            0 0 18px rgba(34, 211, 238, 0.12);
          transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
        }

        .nabad-cta:hover {
          transform: translateY(-1px);
          filter: saturate(1.05);
          box-shadow:
            0 18px 36px rgba(37, 99, 235, 0.25),
            0 0 22px rgba(34, 211, 238, 0.15);
        }

        #nabad-mobile-shell {
          display: none;
          position: relative;
          z-index: 1;
          min-height: 100dvh;
          padding: max(22px, env(safe-area-inset-top)) 18px
            max(24px, env(safe-area-inset-bottom));
          align-items: center;
          justify-content: center;
        }

        .nabad-mobile-card {
          width: 100%;
          max-width: 420px;
          padding: 28px 22px;
          text-align: center;
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.84);
          border: 1px solid rgba(255, 255, 255, 0.88);
          box-shadow:
            0 18px 46px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .nabad-mobile-logo {
          width: 68px;
          height: 68px;
          object-fit: contain;
          margin-bottom: 14px;
          filter: drop-shadow(0 10px 22px rgba(37, 99, 235, 0.14));
        }

        .nabad-mobile-card h2 {
          margin: 0 0 10px;
          font-size: 28px;
          line-height: 1.05;
          letter-spacing: -0.03em;
          color: #020617;
        }

        .nabad-mobile-card p {
          margin: 0 0 18px;
          color: #5b6473;
          line-height: 1.6;
          font-size: 16px;
        }

        /* Force widget above the landing page */
        #nabad-widget-root {
          z-index: 2147483000 !important;
        }

        #nabad-launcher,
        #nabad-panel {
          z-index: 2147483001 !important;
        }

        @media (max-width: 767px) {
          #nabad-desktop-hero {
            display: none;
          }

          #nabad-mobile-shell {
            display: flex;
          }
        }

        @media (min-width: 768px) {
          #nabad-mobile-shell {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
