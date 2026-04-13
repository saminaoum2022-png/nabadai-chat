// ─────────────────────────────────────────────────────────────
//  NabadAI Widget  —  Corrected & Enhanced Version
//  Fixes applied (see review for full details):
//   [FIX-1]  XSS — DOMPurify sanitization on assistant innerHTML
//   [FIX-2]  Duplicate class attr on close button
//   [FIX-3]  Body scroll lock cleanup on beforeunload
//   [FIX-4]  API payload built before message is pushed to state
//   [FIX-5]  window.confirm() replaced with inline modal
//   [FIX-6]  img onload/onerror → addEventListener + { once:true }
//   [FIX-7]  autoGrowTextarea reflow optimisation
//   [FIX-8]  Redundant double innerHTML='' removed
//   [FIX-9]  aria-live added to messages container
//   [FIX-10] Safety comment on getPersonalityGreeting()
//   [FIX-11] scrollToBottom guard when widget is closed
// ─────────────────────────────────────────────────────────────

(() => {
  if (window.__NABAD_WIDGET_LOADED__) return;
  window.__NABAD_WIDGET_LOADED__ = true;

  // ── [FIX-1] Load DOMPurify once, then boot the widget ──────
  // We load DOMPurify from jsDelivr so we can safely sanitize
  // all assistant HTML before injecting it into the DOM.
  // If DOMPurify is already present on the page we skip loading.
  function loadDOMPurify(cb) {
    if (window.DOMPurify) { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/dompurify@3.3.3/dist/purify.min.js';
    s.crossOrigin = 'anonymous';
    s.onload  = cb;
    s.onerror = () => {
      // If CDN fails we continue without it but log a clear warning.
      // sanitizeHtml() below will fall back to text-only rendering.
      console.warn('[NABAD] DOMPurify failed to load — assistant HTML will be text-only.');
      cb();
    };
    document.head.appendChild(s);
  }

  // ── Allowed tags / attrs for assistant messages ─────────────
  const PURIFY_CONFIG = {
    ALLOWED_TAGS: [
      'p','b','i','strong','em','h3','h4',
      'ul','ol','li','a','br','img','span'
    ],
    ALLOWED_ATTR: ['href','src','alt','target','rel','class']
  };

  // Safe wrapper — degrades to escaped text if DOMPurify absent
  function sanitizeHtml(html) {
    if (window.DOMPurify && window.DOMPurify.sanitize) {
      return window.DOMPurify.sanitize(html, PURIFY_CONFIG);
    }
    // Fallback: render as escaped plain text inside a <p>
    return `<p>${escapeHtml(String(html))}</p>`;
  }

  // ── CONFIG ───────────────────────────────────────────────────
  const CONFIG = {
    apiUrl: '/api/chat',
    title: 'NabadAi',
    subtitle: 'Business AI',
    launcherLabel: 'Ask Nabad',
    storageNamespace: 'nabad_widget_v5',
    zIndex: 2147483000,
    ...window.NABAD_WIDGET_CONFIG
  };

  const STORAGE_KEYS = {
    messages:    `${CONFIG.storageNamespace}:messages`,
    personality: `${CONFIG.storageNamespace}:personality`
  };

  const PERSONALITIES = [
    { id: 'strategist',   icon: '🧠', title: 'Strategist',          desc: 'Clear direction, positioning, and smart business decisions' },
    { id: 'growth',       icon: '📈', title: 'Growth Expert',        desc: 'Customer acquisition, conversion, and growth ideas' },
    { id: 'branding',     icon: '🎨', title: 'Brand Builder',        desc: 'Branding, naming, identity, and premium positioning' },
    { id: 'offer',        icon: '💼', title: 'Offer Architect',      desc: 'Offers, pricing, packages, and monetization' },
    { id: 'creative',     icon: '⚡', title: 'Creative Challenger',  desc: 'Bold, original, out-of-the-box business thinking' },
    { id: 'straight_talk',icon: '🎯', title: 'Straight Talk',        desc: 'Honest, direct, no-fluff business advice' },
    { id: 'auto',         icon: '✨', title: 'Let Nabad choose',     desc: 'Automatically adapt based on your goal' }
  ];

  // ── STATE ────────────────────────────────────────────────────
  const state = {
    open: false,
    sending: false,
    messages: loadMessages(),
    personality: loadPersonality() || 'auto',
    personalityChosen: !!loadPersonality()
  };

  const refs = {
    root: null, launcher: null, panel: null,
    messages: null, input: null, send: null,
    badge: null, typing: null,
    lightbox: null, lightboxImg: null,
    lightboxSave: null, lightboxOpen: null, lightboxClose: null
  };

  let currentLightboxSrc = '';

  // ── STORAGE ──────────────────────────────────────────────────
  function loadMessages() {
    try {
      const raw    = localStorage.getItem(STORAGE_KEYS.messages);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter(
            m => m &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string'
          )
        : [];
    } catch { return []; }
  }

  function saveMessages() {
    try {
      localStorage.setItem(
        STORAGE_KEYS.messages,
        JSON.stringify(state.messages.slice(-20))
      );
    } catch {}
  }

  function loadPersonality() {
    try { return localStorage.getItem(STORAGE_KEYS.personality) || ''; }
    catch { return ''; }
  }

  function savePersonality(value) {
    try {
      if (!value) { localStorage.removeItem(STORAGE_KEYS.personality); return; }
      localStorage.setItem(STORAGE_KEYS.personality, value);
    } catch {}
  }

  // ── UTILS ────────────────────────────────────────────────────
  function escapeHtml(text = '') {
    return String(text)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  function getSelectedPersonalityMeta() {
    return (
      PERSONALITIES.find(p => p.id === state.personality) ||
      PERSONALITIES[PERSONALITIES.length - 1]
    );
  }

  // ── [FIX-10] This function produces hardcoded static HTML only.
  //    No user input must ever be interpolated here directly.
  function getPersonalityGreeting(id = 'auto') {
    switch (id) {
      case 'strategist':
        return `<h3>🧠 Strategist mode selected</h3><p>I'll help you make sharper business decisions, choose the right direction, and avoid weak moves.</p><p><b>What are you working on?</b></p>`;
      case 'growth':
        return `<h3>📈 Growth Expert mode selected</h3><p>I'll focus on traction, marketing, leads, conversion, and practical growth opportunities.</p><p><b>What are you working on?</b></p>`;
      case 'branding':
        return `<h3>🎨 Brand Builder mode selected</h3><p>I'll focus on identity, positioning, perception, naming, and premium brand thinking.</p><p><b>What are you working on?</b></p>`;
      case 'offer':
        return `<h3>💼 Offer Architect mode selected</h3><p>I'll help you shape stronger offers, pricing, packaging, and monetization.</p><p><b>What are you working on?</b></p>`;
      case 'creative':
        return `<h3>⚡ Creative Challenger mode selected</h3><p>I'll push for fresher, bolder, more differentiated business ideas.</p><p><b>What are you working on?</b></p>`;
      case 'straight_talk':
        return `<h3>🎯 Straight Talk mode selected</h3><p>I'll give direct, no-fluff, commercially honest advice.</p><p><b>What are you working on?</b></p>`;
      case 'auto':
      default:
        return `<h3>✨ Nabad will adapt to you</h3><p>I'll adjust my style based on your goal and give business-focused advice.</p><p><b>What are you working on?</b></p>`;
    }
  }

  function setInputPlaceholder() {
    if (!refs.input) return;
    const map = {
      strategist:   'Ask for strategy, positioning, launch ideas...',
      growth:       'Ask about leads, growth, marketing, conversion...',
      branding:     'Ask about naming, identity, brand direction...',
      offer:        'Ask about offers, pricing, packages, monetization...',
      creative:     'Ask for bold ideas or fresh angles...',
      straight_talk:'Ask for direct business advice...',
      auto:         'Ask Nabad anything...'
    };
    refs.input.placeholder = map[state.personality] || 'Ask Nabad anything...';
  }

  // ── [FIX-5] Inline confirm modal (replaces window.confirm) ───
  function confirmAction(message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      `position:fixed`,
      `inset:0`,
      `background:rgba(0,0,0,0.52)`,
      `z-index:${CONFIG.zIndex + 30}`,
      `display:flex`,
      `align-items:center`,
      `justify-content:center`,
      `padding:20px`,
      `font-family:Inter,ui-sans-serif,system-ui,sans-serif`
    ].join(';');

    overlay.innerHTML = `
      <div style="
        background:#fff;border-radius:18px;padding:26px 24px;
        max-width:320px;width:100%;
        box-shadow:0 20px 60px rgba(15,23,42,0.22);
      ">
        <p style="margin:0 0 20px;font-size:15px;color:#0f172a;line-height:1.5">
          ${escapeHtml(message)}
        </p>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="_nabad_cancel" style="
            padding:9px 18px;border-radius:11px;border:1px solid #e2e8f0;
            background:#fff;cursor:pointer;font-size:14px;font-weight:700;color:#475569
          ">Cancel</button>
          <button id="_nabad_ok" style="
            padding:9px 18px;border-radius:11px;border:none;
            background:linear-gradient(135deg,#2563eb,#06b6d4);
            color:#fff;cursor:pointer;font-size:14px;font-weight:700
          ">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#_nabad_ok').onclick = () => {
      overlay.remove();
      onConfirm();
    };
    overlay.querySelector('#_nabad_cancel').onclick = () => overlay.remove();

    // Dismiss on backdrop click
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });

    // Dismiss on Escape
    const escHandler = e => {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);
  }

  // ── STYLES ───────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('nabad-widget-styles')) return;
    const style = document.createElement('style');
    style.id = 'nabad-widget-styles';
    style.textContent = `
      #nabad-widget-root,
      #nabad-widget-root * {
        box-sizing: border-box;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system,
          BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      #nabad-widget-root {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: ${CONFIG.zIndex};
        pointer-events: none;
      }

      #nabad-launcher,
      #nabad-panel,
      #nabad-lightbox {
        pointer-events: auto;
      }

      #nabad-launcher {
        width: 64px;
        height: 64px;
        border: none;
        border-radius: 999px;
        cursor: pointer;
        background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
        color: #fff;
        box-shadow:
          0 10px 24px rgba(37,99,235,0.18),
          0 0 18px rgba(6,182,212,0.12);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 800;
        transition: transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
        animation: nabadAiryIdle 4.6s ease-in-out infinite;
      }

      #nabad-launcher:hover {
        transform: translateY(-1px) scale(1.01);
        box-shadow:
          0 12px 30px rgba(37,99,235,0.22),
          0 0 22px rgba(6,182,212,0.16);
      }

      #nabad-widget-root.nabad-open #nabad-launcher {
        opacity: 0;
        pointer-events: none;
        transform: scale(0.92);
      }

      @keyframes nabadAiryIdle {
        0%,100% {
          box-shadow:
            0 10px 24px rgba(37,99,235,0.18),
            0 0 18px rgba(6,182,212,0.10);
        }
        50% {
          box-shadow:
            0 12px 28px rgba(37,99,235,0.20),
            0 0 24px rgba(6,182,212,0.14);
        }
      }

      #nabad-panel {
        position: absolute;
        right: 0;
        bottom: 80px;
        width: min(420px, calc(100vw - 24px));
        height: min(760px, calc(100vh - 110px));
        background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
        border: 1px solid rgba(37,99,235,0.10);
        border-radius: 24px;
        box-shadow: 0 24px 80px rgba(15,23,42,0.18);
        overflow: hidden;
        display: none;
        flex-direction: column;
        backdrop-filter: blur(10px);
      }

      #nabad-panel.open { display: flex; }

      #nabad-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        background: linear-gradient(
          180deg,
          rgba(226,240,255,0.96) 0%,
          rgba(240,249,255,0.95) 100%
        );
        border-bottom: 1px solid rgba(37,99,235,0.08);
      }

      #nabad-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }

      #nabad-logo {
        width: 42px;
        height: 42px;
        border-radius: 999px;
        background: radial-gradient(
          circle at 30% 30%,
          #67e8f9 0%,
          #2563eb 45%,
          #1e3a8a 100%
        );
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 900;
        font-size: 14px;
        box-shadow: inset 0 0 0 2px rgba(255,255,255,0.35);
      }

      #nabad-title-wrap { min-width: 0; }

      #nabad-title {
        color: #0f172a;
        font-size: 18px;
        font-weight: 800;
        line-height: 1.1;
      }

      #nabad-subtitle {
        color: #475569;
        font-size: 12px;
        margin-top: 2px;
      }

      #nabad-header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .nabad-icon-btn {
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        background: rgba(255,255,255,0.85);
        color: #1e3a8a;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 18px rgba(15,23,42,0.07);
      }

      .nabad-icon-btn:hover { background: #fff; }

      #nabad-selected-personality {
        display: none;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 10px 14px 0;
        padding: 10px 12px;
        border-radius: 14px;
        background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
        border: 1px solid rgba(37,99,235,0.10);
        color: #1e3a8a;
        box-shadow: 0 6px 20px rgba(37,99,235,0.05);
      }

      #nabad-selected-personality.show { display: flex; }

      #nabad-selected-personality .label {
        font-size: 13px;
        font-weight: 800;
      }

      #nabad-selected-personality .change {
        border: none;
        background: transparent;
        color: #2563eb;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        padding: 0;
      }

      /* [FIX-9] aria-live is set in HTML; no extra CSS needed */
      #nabad-messages {
        flex: 1;
        overflow-y: auto;
        padding: 14px;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
      }

      .nabad-msg {
        display: flex;
        margin-bottom: 12px;
      }

      .nabad-msg.user  { justify-content: flex-end; }
      .nabad-msg.bot   { justify-content: flex-start; }

      .nabad-bubble {
        max-width: 88%;
        border-radius: 18px;
        padding: 14px 15px;
        line-height: 1.55;
        font-size: 15px;
        word-break: break-word;
        overflow-wrap: anywhere;
      }

      .nabad-msg.user .nabad-bubble {
        background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
        color: #fff;
        border-bottom-right-radius: 6px;
        box-shadow: 0 14px 34px rgba(37,99,235,0.16);
      }

      .nabad-msg.bot .nabad-bubble {
        background: rgba(255,255,255,0.96);
        color: #0f172a;
        border: 1px solid rgba(15,23,42,0.06);
        border-bottom-left-radius: 6px;
        box-shadow: 0 10px 28px rgba(15,23,42,0.06);
      }

      .nabad-bubble h3,
      .nabad-bubble h4 {
        margin: 0 0 8px;
        line-height: 1.25;
        color: #0f172a;
      }

      .nabad-bubble h3 { font-size: 17px; }
      .nabad-bubble h4 { font-size: 15px; }

      .nabad-bubble p { margin: 0 0 10px; }

      .nabad-bubble p:last-child,
      .nabad-bubble ul:last-child,
      .nabad-bubble ol:last-child { margin-bottom: 0; }

      .nabad-bubble ul,
      .nabad-bubble ol {
        margin: 0 0 10px 18px;
        padding: 0;
      }

      .nabad-bubble li { margin: 0 0 6px; }

      .nabad-bubble a {
        color: #2563eb;
        font-weight: 700;
        text-decoration: none;
      }

      .nabad-bubble a:hover { text-decoration: underline; }

      .nabad-bubble img {
        display: block;
        width: 100%;
        max-width: 100%;
        border-radius: 16px;
        margin-top: 6px;
        cursor: zoom-in;
        background: #f1f5f9;
        box-shadow: 0 10px 28px rgba(15,23,42,0.10);
      }

      .nabad-bubble img.loading {
        animation: nabadGlow 1.1s ease-in-out infinite alternate;
      }

      @keyframes nabadGlow {
        0% {
          box-shadow: 0 0 0 rgba(37,99,235,0.0), 0 10px 30px rgba(15,23,42,0.10);
          opacity: 0.88;
        }
        100% {
          box-shadow: 0 0 22px rgba(6,182,212,0.42), 0 12px 34px rgba(37,99,235,0.18);
          opacity: 1;
        }
      }

      #nabad-onboarding {
        padding: 4px 2px 10px;
      }

      #nabad-onboarding h3 {
        margin: 0 0 6px;
        font-size: 20px;
        line-height: 1.2;
        color: #0f172a;
      }

      #nabad-onboarding p {
        margin: 0 0 14px;
        color: #475569;
        font-size: 14px;
        line-height: 1.45;
      }

      .nabad-personality-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .nabad-personality-card {
        width: 100%;
        text-align: left;
        border: 1px solid rgba(37,99,235,0.12);
        background: rgba(255,255,255,0.98);
        border-radius: 18px;
        padding: 14px;
        cursor: pointer;
        transition: all 0.18s ease;
        box-shadow: 0 6px 18px rgba(15,23,42,0.05);
      }

      .nabad-personality-card:hover {
        transform: translateY(-1px);
        border-color: rgba(37,99,235,0.26);
        box-shadow: 0 10px 24px rgba(37,99,235,0.08);
      }

      .nabad-personality-card.active {
        border-color: rgba(37,99,235,0.45);
        background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
        box-shadow:
          0 10px 24px rgba(37,99,235,0.08),
          0 0 18px rgba(6,182,212,0.08);
      }

      .nabad-personality-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 800;
        font-size: 15px;
        color: #0f172a;
        margin-bottom: 6px;
      }

      .nabad-personality-title .icon { font-size: 18px; }

      .nabad-personality-desc {
        color: #475569;
        font-size: 13px;
        line-height: 1.45;
      }

      #nabad-typing {
        display: none;
        padding: 0 14px 10px;
      }

      #nabad-typing.show { display: block; }

      #nabad-typing .inner {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: #fff;
        border: 1px solid rgba(15,23,42,0.06);
        border-radius: 14px;
        padding: 10px 12px;
        box-shadow: 0 8px 24px rgba(15,23,42,0.06);
        color: #475569;
        font-size: 13px;
        font-weight: 700;
      }

      .nabad-dots { display: inline-flex; gap: 4px; }

      .nabad-dots span {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: #60a5fa;
        animation: nabadDots 1.2s infinite ease-in-out;
      }

      .nabad-dots span:nth-child(2) { animation-delay: 0.15s; }
      .nabad-dots span:nth-child(3) { animation-delay: 0.30s; }

      @keyframes nabadDots {
        0%,80%,100% { transform: translateY(0);    opacity: 0.35; }
        40%          { transform: translateY(-4px); opacity: 1;    }
      }

      @keyframes siriIdleGlow {
        0%   { box-shadow: inset 0 1px 2px rgba(15,23,42,0.03), 0 0 6px rgba(6,182,212,0.3),  0 0 12px rgba(37,99,235,0.15); }
        50%  { box-shadow: inset 0 1px 2px rgba(15,23,42,0.03), 0 0 10px rgba(37,99,235,0.35), 0 0 18px rgba(6,182,212,0.2);  }
        100% { box-shadow: inset 0 1px 2px rgba(15,23,42,0.03), 0 0 6px rgba(6,182,212,0.3),  0 0 12px rgba(37,99,235,0.15); }
      }

      @keyframes siriFocusGlow {
        0%   { box-shadow: inset 0 1px 2px rgba(15,23,42,0.03), 0 0 10px rgba(6,182,212,0.7),  0 0 24px rgba(37,99,235,0.4),  0 0 40px rgba(6,182,212,0.2);  }
        50%  { box-shadow: inset 0 1px 2px rgba(15,23,42,0.03), 0 0 14px rgba(37,99,235,0.8), 0 0 28px rgba(6,182,212,0.5), 0 0 48px rgba(37,99,235,0.25); }
        100% { box-shadow: inset 0 1px 2px rgba(15,23,42,0.03), 0 0 10px rgba(6,182,212,0.7),  0 0 24px rgba(37,99,235,0.4),  0 0 40px rgba(6,182,212,0.2);  }
      }

      #nabad-input-wrap {
        padding: 12px 14px 14px;
        padding-bottom: max(14px, env(safe-area-inset-bottom));
        border-top: 1px solid rgba(15,23,42,0.06);
        background: linear-gradient(180deg, rgba(255,255,255,0.97) 0%, #f8fbff 100%);
        width: 100%;
        overflow: visible;
      }

      #nabad-input-row {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        width: 100%;
        overflow: visible;
      }

      #nabad-input {
        flex: 1;
        resize: none;
        border: 1px solid rgba(37,99,235,0.14);
        border-radius: 16px;
        padding: 10px 14px;
        min-height: 44px;
        max-height: 150px;
        font-size: 16px;
        color: #0f172a;
        outline: none;
        background: rgba(255,255,255,0.98);
        box-shadow:
          inset 0 1px 2px rgba(15,23,42,0.03),
          0 0 8px rgba(6,182,212,0.25),
          0 0 16px rgba(37,99,235,0.15);
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        animation: siriIdleGlow 3s ease-in-out infinite;
      }

      #nabad-input:focus {
        border-color: rgba(37,99,235,0.30);
        animation: siriFocusGlow 1.5s ease-in-out infinite;
      }

      #nabad-send {
        width: 44px;
        height: 44px;
        border: none;
        border-radius: 16px;
        cursor: pointer;
        background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
        color: #fff;
        font-size: 18px;
        font-weight: 900;
        box-shadow:
          0 8px 20px rgba(37,99,235,0.14),
          0 0 14px rgba(6,182,212,0.08);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      #nabad-send:hover {
        transform: translateY(-1px);
        box-shadow:
          0 10px 24px rgba(37,99,235,0.16),
          0 0 16px rgba(6,182,212,0.10);
      }

      #nabad-send:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      #nabad-lightbox {
        position: fixed;
        inset: 0;
        background: rgba(8,12,24,0.88);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: ${CONFIG.zIndex + 20};
        padding: 20px;
      }

      #nabad-lightbox.open { display: flex; }

      #nabad-lightbox-inner {
        width: min(92vw, 920px);
        max-height: 92vh;
        background: #0f172a;
        border-radius: 20px;
        padding: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.45);
        border: 1px solid rgba(255,255,255,0.08);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      #nabad-lightbox-close {
        align-self: flex-end;
        border: none;
        background: transparent;
        color: #fff;
        cursor: pointer;
        font-size: 28px;
        line-height: 1;
      }

      #nabad-lightbox-img-wrap {
        width: 100%;
        max-height: 72vh;
        overflow: auto;
        border-radius: 16px;
        background: #111827;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #nabad-lightbox-img {
        max-width: 100%;
        max-height: 72vh;
        display: block;
      }

      #nabad-lightbox-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .nabad-lightbox-btn {
        border: none;
        border-radius: 12px;
        padding: 11px 14px;
        font-weight: 800;
        cursor: pointer;
        font-size: 14px;
      }

      .nabad-lightbox-btn.primary {
        background: linear-gradient(135deg, #00d4ff, #2d4ee8);
        color: #fff;
      }

      .nabad-lightbox-btn.secondary {
        background: rgba(255,255,255,0.08);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.12);
      }

      @media (max-width: 640px) {
        #nabad-widget-root {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100svh;
          height: 100dvh;
          padding: 0;
        }

        #nabad-input-wrap,
        #nabad-input-row { overflow: visible !important; }

        #nabad-close { display: none !important; }

        #nabad-panel {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100svh;
          height: 100dvh;
          max-width: 100vw;
          max-height: 100dvh;
          border-radius: 0;
          box-shadow: none;
          border: none;
          overflow: hidden;
        }

        #nabad-header {
          padding-top: max(14px, env(safe-area-inset-top));
        }

        #nabad-messages {
          flex: 1;
          min-height: 0;
          padding-bottom: 18px;
          -webkit-overflow-scrolling: touch;
        }

        #nabad-input-wrap {
          padding-bottom: max(14px, env(safe-area-inset-bottom));
        }

        #nabad-launcher {
          position: fixed;
          right: 14px;
          bottom: 14px;
          width: 60px;
          height: 60px;
        }

        .nabad-bubble { max-width: 92%; }
      }

      @media (min-width: 641px) {
        #nabad-input-wrap {
          padding-left: 16px;
          padding-right: 16px;
          margin-bottom: 4px;
        }

        #nabad-input {
          margin: 2px;
          padding: 10px 14px !important;
          min-height: 44px !important;
        }

        #nabad-send {
          width: 44px !important;
          height: 44px !important;
        }
      }
      
     /* ── IMAGE LOADING PLACEHOLDER ─────────────────────────── */
.nabad-img-placeholder {
  width: 280px;
  height: 280px;
  border-radius: 16px;
  background: linear-gradient(135deg, #f0f4ff 0%, #f5f5ff 100%);
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 14px 3px rgba(120,130,200,0.18),
              0 0 32px 6px rgba(120,130,200,0.09);
  animation: nabadGlowPulse 2s ease-in-out infinite;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: 8px 0;
}
.nabad-img-placeholder::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.6) 50%,
    transparent 100%
  );
  animation: nabadShimmer 1.8s ease-in-out infinite;
  transform: translateX(-100%);
}
.nabad-img-placeholder-countdown {
  font-size: 28px;
  font-weight: 700;
  color: #8892c8;
  letter-spacing: -1px;
  line-height: 1;
}
.nabad-img-placeholder-text {
  font-size: 12px;
  font-weight: 500;
  color: #9aa0c8;
  letter-spacing: 0.3px;
}
@keyframes nabadGlowPulse {
  0%, 100% { box-shadow: 0 0 14px 3px rgba(120,130,200,0.18),
                          0 0 32px 6px rgba(120,130,200,0.09); }
  50%       { box-shadow: 0 0 22px 6px rgba(120,130,200,0.28),
                          0 0 48px 12px rgba(120,130,200,0.15); }
}
@keyframes nabadShimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

    `;
    document.head.appendChild(style);
  }

  // ── SHELL ────────────────────────────────────────────────────
  function buildShell() {
    const root = document.createElement('div');
    root.id = 'nabad-widget-root';

    root.innerHTML = `
      <button id="nabad-launcher" type="button" aria-label="${escapeHtml(CONFIG.launcherLabel)}">✦</button>

      <div id="nabad-panel" aria-hidden="true">
        <div id="nabad-header">
          <div id="nabad-header-left">
            <div id="nabad-logo">N</div>
            <div id="nabad-title-wrap">
              <div id="nabad-title">${escapeHtml(CONFIG.title)}</div>
              <div id="nabad-subtitle">${escapeHtml(CONFIG.subtitle)}</div>
            </div>
          </div>
          <div id="nabad-header-actions">
            <button class="nabad-icon-btn" id="nabad-new-chat" type="button" title="New chat">⟳</button>
            <!-- [FIX-2] Merged both class values into one attribute -->
            <button class="nabad-icon-btn nabad-desktop-only" id="nabad-close" type="button" title="Close">×</button>
          </div>
        </div>

        <div id="nabad-selected-personality">
          <div class="label"></div>
          <button class="change" id="nabad-change-personality" type="button">Change</button>
        </div>

        <!-- [FIX-9] aria-live="polite" announces new bot messages to screen readers -->
        <div id="nabad-messages" aria-live="polite" aria-label="Chat messages"></div>

        <div id="nabad-typing">
          <div class="inner">
            <span>Nabad is thinking</span>
            <span class="nabad-dots"><span></span><span></span><span></span></span>
          </div>
        </div>

        <div id="nabad-input-wrap">
          <div id="nabad-input-row">
            <textarea id="nabad-input" rows="1" placeholder="Ask Nabad anything..."></textarea>
            <button id="nabad-send" type="button" aria-label="Send">➜</button>
          </div>
        </div>
      </div>

      <div id="nabad-lightbox">
        <div id="nabad-lightbox-inner">
          <button id="nabad-lightbox-close" aria-label="Close image preview">×</button>
          <div id="nabad-lightbox-img-wrap">
            <img id="nabad-lightbox-img" src="" alt="Preview">
          </div>
          <div id="nabad-lightbox-actions">
            <button class="nabad-lightbox-btn primary" id="nabad-lightbox-save" type="button">Save image</button>
            <button class="nabad-lightbox-btn secondary" id="nabad-lightbox-open" type="button">Open full image</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    refs.root         = root;
    refs.launcher     = root.querySelector('#nabad-launcher');
    refs.panel        = root.querySelector('#nabad-panel');
    refs.messages     = root.querySelector('#nabad-messages');
    refs.input        = root.querySelector('#nabad-input');
    refs.send         = root.querySelector('#nabad-send');
    refs.badge        = root.querySelector('#nabad-selected-personality');
    refs.typing       = root.querySelector('#nabad-typing');
    refs.lightbox     = root.querySelector('#nabad-lightbox');
    refs.lightboxImg  = root.querySelector('#nabad-lightbox-img');
    refs.lightboxSave = root.querySelector('#nabad-lightbox-save');
    refs.lightboxOpen = root.querySelector('#nabad-lightbox-open');
    refs.lightboxClose= root.querySelector('#nabad-lightbox-close');

    bindEvents(root);
    updatePersonalityBadge();
    setInputPlaceholder();
    renderInitialState();
  }

  // ── EVENTS ───────────────────────────────────────────────────
  function bindEvents(root) {
    refs.launcher.addEventListener('click', () => toggleWidget(true));
    root.querySelector('#nabad-close').addEventListener('click', () => toggleWidget(false));
    root.querySelector('#nabad-send').addEventListener('click', sendMessage);
    root.querySelector('#nabad-new-chat').addEventListener('click', startNewChat);
    root.querySelector('#nabad-change-personality').addEventListener('click', changePersonalityFlow);

    refs.input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    refs.input.addEventListener('input', autoGrowTextarea);

    refs.lightboxClose.addEventListener('click', closeImageLightbox);
    refs.lightbox.addEventListener('click', e => {
      if (e.target === refs.lightbox) closeImageLightbox();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && refs.lightbox.classList.contains('open')) {
        closeImageLightbox();
      }
    });

    refs.lightboxSave.addEventListener('click', async () => {
      if (!currentLightboxSrc) return;
      try {
        const r = await fetch(currentLightboxSrc);
        const b = await r.blob();
        const u = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href     = u;
        a.download = 'nabad-generated-image.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 1500);
      } catch {
        window.open(currentLightboxSrc, '_blank', 'noopener,noreferrer');
      }
    });

    refs.lightboxOpen.addEventListener('click', () => {
      if (!currentLightboxSrc) return;
      window.open(currentLightboxSrc, '_blank', 'noopener,noreferrer');
    });

    // ── [FIX-3] Release body scroll lock if user navigates away
    //    while the widget is open, preventing a permanent lock.
    window.addEventListener('beforeunload', releaseScrollLock);
  }

  // ── [FIX-7] Cached scroll height to avoid redundant reflows ─
  let _lastScrollHeight = 0;
  function autoGrowTextarea() {
    if (!refs.input) return;
    if (refs.input.scrollHeight === _lastScrollHeight) return;
    _lastScrollHeight = refs.input.scrollHeight;
    refs.input.style.height = 'auto';
    refs.input.style.height = `${Math.min(refs.input.scrollHeight, 150)}px`;
  }

  // ── SCROLL LOCK HELPERS ──────────────────────────────────────
  function applyScrollLock() {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow   = 'hidden';
    document.body.style.touchAction = 'none';
  }

  function releaseScrollLock() {
    document.documentElement.style.overflow = '';
    document.body.style.overflow   = '';
    document.body.style.touchAction = '';
  }

  // ── TOGGLE ───────────────────────────────────────────────────
  function toggleWidget(force) {
    state.open = typeof force === 'boolean' ? force : !state.open;

    refs.panel.classList.toggle('open', state.open);
    refs.panel.setAttribute('aria-hidden', state.open ? 'false' : 'true');
    refs.root.classList.toggle('nabad-open', state.open);

    if (state.open) {
      applyScrollLock();
      setTimeout(() => {
        if (!state.personalityChosen && !state.messages.length) {
          renderPersonalityOnboarding();
          scrollToBottom();
          return;
        }
        scrollToBottom();
        if (refs.input) refs.input.focus();
      }, 40);
    } else {
      releaseScrollLock();
    }
  }

  // ── PERSONALITY BADGE ────────────────────────────────────────
  function updatePersonalityBadge() {
    if (!refs.badge) return;
    if (!state.personalityChosen) { refs.badge.classList.remove('show'); return; }
    const meta = getSelectedPersonalityMeta();
    refs.badge.querySelector('.label').innerHTML =
      `${escapeHtml(meta.icon)} ${escapeHtml(meta.title)}`;
    refs.badge.classList.add('show');
  }

  // ── RENDER INITIAL STATE ─────────────────────────────────────
  function renderInitialState() {
    refs.messages.innerHTML = '';

    if (!state.personalityChosen && !state.messages.length) {
      renderPersonalityOnboarding();
      return;
    }

    updatePersonalityBadge();

    if (!state.messages.length) {
      renderMessage('assistant', getPersonalityGreeting(state.personality), false);
      return;
    }

    // [FIX-8] Removed the redundant second innerHTML='' that was here
    state.messages.forEach(m => renderMessage(m.role, m.content, false));
    scrollToBottom();
  }

  // ── ONBOARDING ───────────────────────────────────────────────
  function renderPersonalityOnboarding() {
    refs.messages.innerHTML = `
      <div id="nabad-onboarding">
        <h3>Choose your Nabad AI personality</h3>
        <p>Pick how you want Nabad to think and respond.</p>
        <div class="nabad-personality-grid">
          ${PERSONALITIES.map(p => `
            <button
              class="nabad-personality-card ${state.personality === p.id ? 'active' : ''}"
              data-personality="${p.id}"
              type="button"
            >
              <div class="nabad-personality-title">
                <span class="icon">${p.icon}</span>
                <span>${escapeHtml(p.title)}</span>
              </div>
              <div class="nabad-personality-desc">${escapeHtml(p.desc)}</div>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    refs.messages.querySelectorAll('.nabad-personality-card').forEach(btn => {
      btn.addEventListener('click', () => {
        state.personality      = btn.getAttribute('data-personality') || 'auto';
        state.personalityChosen = true;
        savePersonality(state.personality);
        updatePersonalityBadge();
        setInputPlaceholder();
        refs.messages.innerHTML = '';
        renderMessage('assistant', getPersonalityGreeting(state.personality), false);
        setTimeout(() => { refs.input.focus(); scrollToBottom(); }, 50);
      });
    });

    scrollToBottom();
  }

// ── IMAGE LOADING PLACEHOLDER ────────────────────────────────
  const IMAGE_LOADING_TEXTS = [
    '✦ Crafting your image...',
    '✦ Building the visual...',
    '✦ Adding finishing touches...',
    '✦ Almost ready...'
  ];

  function createImagePlaceholder() {
    const wrap = document.createElement('div');
    wrap.className = 'nabad-img-placeholder';

    const countdown = document.createElement('div');
    countdown.className = 'nabad-img-placeholder-countdown';
    countdown.textContent = '30';

    const text = document.createElement('div');
    text.className = 'nabad-img-placeholder-text';
    text.textContent = '✦ Crafting your image...';

    let seconds = 30;
    let textIndex = 0;
    const interval = setInterval(() => {
      seconds -= 1;

      if (seconds > 0) {
        countdown.textContent = String(seconds);
      }

      if (seconds % 6 === 0 && seconds > 0) {
        textIndex = (textIndex + 1) % IMAGE_LOADING_TEXTS.length;
        text.textContent = IMAGE_LOADING_TEXTS[textIndex];
      }

      if (seconds <= 0) {
        countdown.textContent = '⏳';
        text.textContent = 'Taking longer than usual, almost there...';
        clearInterval(interval);
        wrap.dataset.intervalId = '';
      }
    }, 1000);

    wrap.dataset.intervalId = String(interval);
    wrap.appendChild(countdown);
    wrap.appendChild(text);
    return wrap;
  }

  function removePlaceholder(placeholder) {
    if (!placeholder) return;
    const id = placeholder.dataset.intervalId;
    if (id) clearInterval(Number(id));
    placeholder.remove();
  }

  // ── RENDER MESSAGE ───────────────────────────────────────────
  function renderMessage(role, content, persist = true) {
    const isUser = role === 'user';
    const msg    = document.createElement('div');
    msg.className = `nabad-msg ${isUser ? 'user' : 'bot'}`;

    const bubble = document.createElement('div');
    bubble.className = 'nabad-bubble';

    if (isUser) {
      // User content: always escaped — never raw HTML
      bubble.innerHTML = `<p>${escapeHtml(String(content || '')).replace(/\n/g, '<br>')}</p>`;
    } else {
      // [FIX-1] Assistant content sanitized through DOMPurify before injection
      bubble.innerHTML = sanitizeHtml(
        String(content || '<p>Sorry — I could not generate a response.</p>')
      );
    }

    msg.appendChild(bubble);
    refs.messages.appendChild(msg);

    if (!isUser) processAssistantBubble(bubble);

    if (persist) {
      state.messages.push({ role: isUser ? 'user' : 'assistant', content: String(content || '') });
      state.messages = state.messages.slice(-20);
      saveMessages();
    }

    scrollToBottom();
  }

  // ── PROCESS ASSISTANT BUBBLE ─────────────────────────────────
  function processAssistantBubble(bubble) {
    bubble.querySelectorAll('a').forEach(a => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });

    bubble.querySelectorAll('img').forEach((img, i) => {
      const MIN_GLOW_MS = 900;
      const start       = Date.now();
      const originalSrc = img.getAttribute('src') || '';

      if (/image\.pollinations\.ai/i.test(originalSrc)) {
        const sep      = originalSrc.includes('?') ? '&' : '?';
        const freshSrc = `${originalSrc}${sep}cb=${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`;
        img.setAttribute('src', freshSrc);
      }

      // ── Show glowing placeholder while image loads ──
      const placeholder = createImagePlaceholder();
      img.style.opacity = '0';
      img.style.transition = 'opacity 0.5s ease';
      img.parentNode.insertBefore(placeholder, img);

      img.addEventListener('load', () => {
        const elapsed = Date.now() - start;
        setTimeout(() => {
          removePlaceholder(placeholder);
          img.classList.remove('loading');
          img.style.opacity = '1';
        }, Math.max(0, MIN_GLOW_MS - elapsed));
      }, { once: true });

      img.addEventListener('error', () => {
        removePlaceholder(placeholder);
        img.classList.remove('loading');
        img.style.opacity = '1';
        img.style.display = 'none';
      }, { once: true });

      if (img.complete) {
        img.naturalWidth > 0
          ? img.dispatchEvent(new Event('load'))
          : img.dispatchEvent(new Event('error'));
      }

      img.addEventListener('click', () => {
        const src = img.currentSrc || img.src || img.getAttribute('src');
        if (src) openImageLightbox(src, img.alt || 'Generated image');
      });
    });
  }

  // ── LIGHTBOX ─────────────────────────────────────────────────
  function openImageLightbox(src, alt = 'Generated image') {
    currentLightboxSrc   = src;
    refs.lightboxImg.src = src;
    refs.lightboxImg.alt = alt;
    refs.lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeImageLightbox() {
    refs.lightbox.classList.remove('open');
    refs.lightboxImg.src = '';
    currentLightboxSrc   = '';
    if (!state.open) releaseScrollLock();
  }

  // ── TYPING INDICATOR ─────────────────────────────────────────
  function showTyping(show) {
    refs.typing.classList.toggle('show', !!show);
    refs.send.disabled = !!show;
    scrollToBottom();
  }

  // ── [FIX-11] Guard: skip scroll if widget is closed ─────────
  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (!refs.messages || !state.open) return;
      refs.messages.scrollTop = refs.messages.scrollHeight;
    });
  }

  // ── NEW CHAT ─────────────────────────────────────────────────
  function startNewChat() {
    // [FIX-5] Replaced window.confirm with inline modal
    if (state.messages.length) {
      confirmAction(
        'Start a new chat? Your current conversation will be cleared.',
        _doStartNewChat
      );
    } else {
      _doStartNewChat();
    }
  }

  function _doStartNewChat() {
    state.messages      = [];
    saveMessages();
    refs.messages.innerHTML = '';
    if (!state.personalityChosen) {
      renderPersonalityOnboarding();
    } else {
      renderMessage('assistant', getPersonalityGreeting(state.personality), false);
    }
  }

  // ── CHANGE PERSONALITY ───────────────────────────────────────
  function changePersonalityFlow() {
    // [FIX-5] Replaced window.confirm with inline modal
    if (state.messages.length) {
      confirmAction(
        'Change personality and start a fresh chat? This will clear the current conversation.',
        _doChangePersonality
      );
    } else {
      _doChangePersonality();
    }
  }

  function _doChangePersonality() {
    state.messages       = [];
    saveMessages();
    state.personality    = 'auto';
    state.personalityChosen = false;
    savePersonality('');
    updatePersonalityBadge();
    setInputPlaceholder();
    refs.messages.innerHTML = '';
    renderPersonalityOnboarding();
  }

  // ── SEND MESSAGE ─────────────────────────────────────────────
  async function sendMessage() {
    if (state.sending) return;

    const text = (refs.input.value || '').trim();
    if (!text) return;

    if (!state.personalityChosen) {
      state.personality       = 'auto';
      state.personalityChosen = true;
      savePersonality(state.personality);
      updatePersonalityBadge();
      setInputPlaceholder();
      refs.messages.innerHTML = '';
    }

    state.sending = true;

    // [FIX-4 CORRECTED] Include the current message as the last item
    // so OpenAI always receives the full context including what the
    // user just typed — without this the AI replies to old history only
    const historySnapshot = [
      ...state.messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      { role: 'user', content: text }
    ];

    // Now render + persist the user message in the UI
    renderMessage('user', text, true);

    refs.input.value        = '';
    refs.input.style.height = 'auto';
    _lastScrollHeight       = 0; // reset grow cache after clear
    showTyping(true);

    try {
      const payload = {
        messages:    historySnapshot,  // full history including current message
        personality: state.personality,
        profile: {}
      };

      const response = await fetch(CONFIG.apiUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data?.reply || 'Request failed');

      renderMessage(
        'assistant',
        data?.reply || '<p>Sorry — I could not generate a response right now.</p>',
        true
      );
    } catch (err) {
      renderMessage(
        'assistant',
        `<h3>Sorry — something went wrong</h3><p>Please try again in a moment.</p>`,
        true
      );
      console.error('[NABAD WIDGET ERROR]', err);
    } finally {
      state.sending = false;
      showTyping(false);
      refs.input.focus();
    }
  }

  // ── INIT ─────────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildShell();
    // [FIX-12] Expose public API so index.js can open/close the widget
    // reliably without clicking a hidden launcher button
    window.__NABAD_OPEN_WIDGET__  = () => toggleWidget(true);
    window.__NABAD_CLOSE_WIDGET__ = () => toggleWidget(false);
  }

  // Load DOMPurify first, then boot everything
  loadDOMPurify(() => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  });

})();
