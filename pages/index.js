import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>Nabad AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f7f8fc" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Nabad AI" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 100%; height: 100%;
            overflow: hidden; background: #f7f8fc;
            padding-top: env(safe-area-inset-top);
          }
          #nabad-splash {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: #f7f8fc;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            transition: opacity 0.5s ease;
          }
          #nabad-splash img {
            width: 100px; height: 100px;
            border-radius: 50%;
            animation: nabadGlow 1.5s ease-in-out infinite alternate;
          }
          @keyframes nabadGlow {
            from { box-shadow: 0 0 10px rgba(0,212,255,0.4), 0 0 20px rgba(0,212,255,0.2); }
            to   { box-shadow: 0 0 30px rgba(0,212,255,0.9), 0 0 60px rgba(0,212,255,0.5), 0 0 80px rgba(45,78,232,0.3); }
          }
          #nabad-window {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            right: 0 !important; bottom: 0 !important;
            width: 100% !important; height: 100% !important;
            border-radius: 0 !important;
            display: flex !important;
            box-shadow: none !important;
            border: none !important;
            background: #f7f8fc !important;
          }
          #nabad-bubble { display: none !important; }
          .nabad-msg.bot {
            max-width: 100% !important;
            width: 100% !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding-left: 4px !important;
            padding-right: 4px !important;
          }
        `}</style>
      </Head>

      <div id="nabad-splash">
        <img src="/logo.png" alt="Nabad AI" />
      </div>

      <script dangerouslySetInnerHTML={{ __html: `window.NABAD_API = '/api/chat';` }} />
      <script src="/widget.js?v=3" defer></script>
      <script dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js');
            });
          }
          window.addEventListener('load', () => {
            setTimeout(() => {
              const splash = document.getElementById('nabad-splash');
              if (splash) {
                splash.style.opacity = '0';
                setTimeout(() => splash.remove(), 500);
              }
            }, 2000);
          });
        `
      }} />
    </>
  );
}
