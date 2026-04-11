import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>Nabad AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00D4FF" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Nabad AI" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 100%; height: 100%; overflow: hidden; background: #E8F4FF; }
          
          #nabad-header::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: env(safe-area-inset-top);
  background: #E8F4FF;
  z-index: 9999;
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
      <script
        dangerouslySetInnerHTML={{
          __html: `window.NABAD_API = '/api/chat';`
        }}
      />
      <script src="/widget.js?v=3" defer></script>
      <script dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js');
            });
          }
        `
      }} />
    </>
  );
}
