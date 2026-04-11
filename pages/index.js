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
            overflow: hidden; background: #E8F4FF;
            padding-top: env(safe-area-inset-top);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }

          /* SPLASH */
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
            width: 120px; height: 120px;
            object-fit: contain;
            animation: nabadGlow 1.5s ease-in-out infinite alternate;
          }
          @keyframes nabadGlow {
            from { filter: drop-shadow(0 0 8px rgba(0,212,255,0.4)) drop-shadow(0 0 16px rgba(0,212,255,0.2)); }
            to   { filter: drop-shadow(0 0 24px rgba(0,212,255,0.9)) drop-shadow(0 0 48px rgba(0,212,255,0.5)) drop-shadow(0 0 64px rgba(45,78,232,0.3)); }
          }

          /* MOBILE — fullscreen */
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
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

          /* INPUT GLOW — PWA only */
          @media (display-mode: standalone), (display-mode: fullscreen) {
            #nabad-input {
              box-shadow: 0 0 4px rgba(0,212,255,0.15) !important;
              transition: box-shadow 0.3s ease !important;
            }
            #nabad-input:focus {
              box-shadow: 0 0 8px rgba(0,212,255,0.25), 0 0 16px rgba(0,212,255,0.15) !important;
              outline: none !important;
            }
          }

          /* MOBILE PADDING */
          @media (max-width: 767px) {
            #nabad-messages {
              padding-left: 12px !important;
              padding-right: 12px !important;
            }
            #nabad-footer {
              padding-bottom: calc(12px + env(safe-area-inset-bottom)) !important;
              padding-left: 12px !important;
              padding-right: 12px !important;
            }
          }

          /* DESKTOP SIDEBAR */
          #nabad-desktop-layout { display: none; }

          @media (min-width: 768px) {
            #nabad-desktop-layout {
              display: flex;
              position: fixed;
              top: 0; left: 0; right: 0; bottom: 0;
              background: #E8F4FF;
              z-index: 1;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            #nabad-sidebar {
              width: 260px;
              min-width: 260px;
              height: 100%;
              background: linear-gradient(180deg, #dceeff 0%, #E8F4FF 100%);
              border-right: 1px solid rgba(0,212,255,0.2);
              display: flex;
              flex-direction: column;
              padding: 24px 16px;
              gap: 12px;
            }
            #nabad-sidebar-logo {
              display: flex;
              align-items: center;
              gap: 10px;
              padding-bottom: 16px;
              border-bottom: 1px solid rgba(0,212,255,0.15);
            }
            #nabad-sidebar-logo img {
              width: 36px; height: 36px;
              object-fit: contain;
              filter: drop-shadow(0 0 6px rgba(0,212,255,0.5));
            }
            #nabad-sidebar-logo span {
              font-size: 16px;
              font-weight: 700;
              color: #1a1a1a;
            }
            #nabad-new-chat {
              display: flex;
              align-items: center;
              gap: 8px;
              background: linear-gradient(135deg, #2D4EE8, #00D4FF);
              color: #fff;
              border: none;
              border-radius: 10px;
              padding: 10px 14px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: opacity 0.2s;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              width: 100%;
            }
            #nabad-new-chat:hover { opacity: 0.85; }
            #nabad-sidebar-profile {
              margin-top: auto;
              padding-top: 16px;
              border-top: 1px solid rgba(0,212,255,0.15);
              display: flex;
              align-items: center;
              gap: 10px;
            }
            #nabad-sidebar-profile-avatar {
              width: 34px; height: 34px;
              border-radius: 50%;
              background: linear-gradient(135deg, #2D4EE8, #00D4FF);
              display: flex; align-items: center; justify-content: center;
              color: #fff; font-size: 14px; font-weight: 700;
              box-shadow: 0 0 8px rgba(0,212,255,0.3);
            }
            #nabad-sidebar-profile-info { display: flex; flex-direction: column; }
            #nabad-sidebar-profile-name { font-size: 13px; font-weight: 600; color: #1a1a1a; }
            #nabad-sidebar-profile-role { font-size: 11px; color: #888; }
            #nabad-chat-area {
              flex: 1;
              height: 100%;
              position: relative;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            #nabad-window {
              position: absolute !important;
              top: 0 !important; left: 0 !important;
              right: 0 !important; bottom: 0 !important;
              width: 100% !important; height: 100% !important;
            }
          }
        `}</style>
      </Head>

      <div id="nabad-splash">
        <img src="/logo.png" alt="Nabad AI" />
      </div>

      <div id="nabad-desktop-layout">
        <div id="nabad-sidebar">
          <div id="nabad-sidebar-logo">
            <img src="/logo.png" alt="Nabad" />
            <span>NabadAi</span>
          </div>
          <button id="nabad-new-chat">➕ New Conversation</button>
          <div id="nabad-sidebar-profile">
            <div id="nabad-sidebar-profile-avatar">N</div>
            <div id="nabad-sidebar-profile-info">
              <div id="nabad-sidebar-profile-name">Guest</div>
              <div id="nabad-sidebar-profile-role">AI Business Consultant</div>
            </div>
          </div>
        </div>
        <div id="nabad-chat-area"></div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `window.NABAD_API = '/api/chat';` }} />
      <script src="/widget.js?v=4" defer></script>
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

            const isDesktop = window.innerWidth >= 768;
            if (isDesktop) {
              const chatArea = document.getElementById('nabad-chat-area');
              const nabadWindow = document.getElementById('nabad-window');
              if (chatArea && nabadWindow) chatArea.appendChild(nabadWindow);
            }

            document.getElementById('nabad-new-chat')?.addEventListener('click', () => {
              const messages = document.getElementById('nabad-messages');
              const lead = document.getElementById('nabad-lead');
              if (messages) { messages.innerHTML = ''; messages.style.display = 'none'; }
              if (lead) lead.style.display = 'flex';
            });
          });
        `
      }} />
    </>
  );
}
