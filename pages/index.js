import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>Nabad AI</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f7f8fc" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Nabad AI" />
        <link rel="apple-touch-icon" href="/logo.png" />

        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          html, body, #__next {
            width: 100%;
            min-height: 100%;
          }

          html, body {
            overflow-x: hidden;
            overflow-y: auto;
            background: linear-gradient(180deg, #eef7ff 0%, #f8fbff 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }

          body {
            position: relative;
          }

          #nabad-page-bg {
            position: fixed;
            inset: 0;
            background:
              radial-gradient(circle at 20% 20%, rgba(0, 212, 255, 0.08), transparent 28%),
              radial-gradient(circle at 80% 75%, rgba(45, 78, 232, 0.06), transparent 25%),
              linear-gradient(180deg, #eef7ff 0%, #f8fbff 100%);
            z-index: 0;
          }

          #nabad-splash {
            position: fixed;
            inset: 0;
            background: #f7f8fc;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            transition: opacity 0.45s ease;
          }

          #nabad-splash img {
            width: 120px;
            height: 120px;
            object-fit: contain;
            animation: nabadLogoGlow 1.5s ease-in-out infinite alternate;
          }

          @keyframes nabadLogoGlow {
            from {
              filter:
                drop-shadow(0 0 8px rgba(0,212,255,0.35))
                drop-shadow(0 0 18px rgba(0,212,255,0.18));
            }
            to {
              filter:
                drop-shadow(0 0 24px rgba(0,212,255,0.8))
                drop-shadow(0 0 42px rgba(0,212,255,0.35))
                drop-shadow(0 0 60px rgba(45,78,232,0.18));
            }
          }

          #nabad-desktop-hero {
            position: relative;
            z-index: 1;
            min-height: 100vh;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 40px;
          }

          #nabad-desktop-hero-inner {
            width: min(980px, 100%);
            background: rgba(255,255,255,0.72);
            border: 1px solid rgba(37, 99, 235, 0.08);
            border-radius: 28px;
            box-shadow: 0 24px 80px rgba(15, 23, 42, 0.10);
            backdrop-filter: blur(10px);
            padding: 42px;
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            gap: 32px;
          }

          #nabad-desktop-copy h1 {
            font-size: 42px;
            line-height: 1.05;
            color: #0f172a;
            margin-bottom: 14px;
            font-weight: 800;
            letter-spacing: -0.03em;
          }

          #nabad-desktop-copy p {
            font-size: 17px;
            line-height: 1.65;
            color: #475569;
            margin-bottom: 16px;
          }

          #nabad-desktop-points {
            display: grid;
            gap: 12px;
            margin-top: 20px;
          }

          .nabad-point {
            background: rgba(255,255,255,0.82);
            border: 1px solid rgba(37, 99, 235, 0.08);
            border-radius: 18px;
            padding: 16px 18px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
          }

          .nabad-point-title {
            font-size: 15px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 6px;
          }

          .nabad-point-text {
            font-size: 14px;
            line-height: 1.55;
            color: #64748b;
          }

          #nabad-desktop-card {
            background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
            border: 1px solid rgba(37, 99, 235, 0.08);
            border-radius: 24px;
            padding: 26px;
            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.07);
          }

          #nabad-desktop-card h3 {
            font-size: 20px;
            color: #0f172a;
            margin-bottom: 10px;
          }

          #nabad-desktop-card p {
            font-size: 14px;
            line-height: 1.6;
            color: #64748b;
            margin-bottom: 12px;
          }

          .nabad-chip-row {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 18px;
          }

          .nabad-chip {
            padding: 10px 12px;
            border-radius: 999px;
            background: rgba(37, 99, 235, 0.08);
            color: #1e3a8a;
            font-size: 13px;
            font-weight: 700;
          }

          @media (min-width: 768px) {
            #nabad-desktop-hero {
              display: flex;
            }
          }
        `}</style>
      </Head>

      <div id="nabad-page-bg" />

      <div id="nabad-splash">
        <img src="/logo.png" alt="Nabad AI" />
      </div>

      <main id="nabad-desktop-hero">
        <div id="nabad-desktop-hero-inner">
          <div id="nabad-desktop-copy">
            <h1>Nabad AI for smarter business thinking</h1>
            <p>
              Strategy, branding, offers, growth, and creative ideas — all in one
              business-focused AI experience.
            </p>
            <p>
              On mobile, Nabad opens directly into chat. On desktop, you can launch it
              from the glowing button in the corner.
            </p>

            <div id="nabad-desktop-points">
              <div className="nabad-point">
                <div className="nabad-point-title">🧠 Strategy</div>
                <div className="nabad-point-text">
                  Sharper positioning, clearer business direction, smarter decisions.
                </div>
              </div>

              <div className="nabad-point">
                <div className="nabad-point-title">🎨 Branding</div>
                <div className="nabad-point-text">
                  Naming, identity, premium direction, and stronger market perception.
                </div>
              </div>

              <div className="nabad-point">
                <div className="nabad-point-title">📈 Growth</div>
                <div className="nabad-point-text">
                  Offers, acquisition ideas, conversion thinking, and monetization.
                </div>
              </div>
            </div>
          </div>

          <div id="nabad-desktop-card">
            <h3>Start with a personality</h3>
            <p>
              Choose how you want Nabad to think: strategist, growth expert, brand
              builder, offer architect, creative challenger, or straight talk.
            </p>
            <p>
              The mobile experience opens directly into the assistant after the splash.
            </p>

            <div className="nabad-chip-row">
              <span className="nabad-chip">Strategist</span>
              <span className="nabad-chip">Growth Expert</span>
              <span className="nabad-chip">Brand Builder</span>
              <span className="nabad-chip">Offer Architect</span>
              <span className="nabad-chip">Creative Challenger</span>
              <span className="nabad-chip">Straight Talk</span>
            </div>
          </div>
        </div>
      </main>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.NABAD_WIDGET_CONFIG = {
              apiUrl: '/api/chat',
              title: 'NabadAi',
              subtitle: 'Business AI'
            };
          `
        }}
      />

      <script src="/widget.js?v=8" defer></script>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function () {
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function () {});
                });
              }

              function hideSplash() {
                var splash = document.getElementById('nabad-splash');
                if (!splash) return;

                splash.style.opacity = '0';
                setTimeout(function () {
                  if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
                }, 450);
              }

              function autoOpenMobileWidget() {
                if (window.innerWidth >= 768) return;

                var tries = 0;
                var timer = setInterval(function () {
                  var launcher = document.getElementById('nabad-launcher');
                  var panel = document.getElementById('nabad-panel');

                  if (panel && panel.classList.contains('open')) {
                    clearInterval(timer);
                    return;
                  }

                  if (launcher) {
                    launcher.click();
                    clearInterval(timer);
                    return;
                  }

                  tries += 1;
                  if (tries > 40) clearInterval(timer);
                }, 120);
              }

              window.addEventListener('load', function () {
                setTimeout(function () {
                  hideSplash();
                  autoOpenMobileWidget();
                }, 1100);
              });
            })();
          `
        }}
      />
    </>
  );
}
