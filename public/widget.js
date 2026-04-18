// ─────────────────────────────────────────────────────────────
//  NabadAI Widget  —  Full Updated Version
//  Previous fixes: [FIX-1] through [FIX-12]
//  Tier 1: [T1-1] [T1-4] [T1-8] [T1-10]
//  Tier 2: [T2-2] Business Snapshot  [T2-7] Nabad Score
//  Tier 3: [T3-6] Pricing Table  [T3-6b] Offer Card
//          [T3-6c] Positioning Matrix  [T3-6d] 30-Day Action Plan
//  NEW: [OB-1] 3-screen onboarding flow
//  NEW: [PC-1] Personality color system with auto-detection
// ─────────────────────────────────────────────────────────────

(() => {
  if (window.__NABAD_WIDGET_LOADED__) return;
  window.__NABAD_WIDGET_LOADED__ = true;

  function loadDOMPurify(cb) {
    if (window.DOMPurify) { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/dompurify@3.3.3/dist/purify.min.js';
    s.crossOrigin = 'anonymous';
    s.onload  = cb;
    s.onerror = () => {
      console.warn('[NABAD] DOMPurify failed to load — assistant HTML will be text-only.');
      cb();
    };
    document.head.appendChild(s);
  }

  const PURIFY_CONFIG = {
    ALLOWED_TAGS: [
      'p','b','i','strong','em','h3','h4',
      'ul','ol','li','a','br','img','span','div','table',
      'thead','tbody','tr','th','td'
    ],
    ALLOWED_ATTR: [
      'href','src','alt','target','rel','class','style',
      'data-nabad-card','data-nabad-brief','data-nabad-source',
      'data-nabad-model','data-nabad-prompt',
      'data-score','data-quadrant'
    ]
  };

  function sanitizeHtml(html) {
    if (window.DOMPurify && window.DOMPurify.sanitize) {
      return window.DOMPurify.sanitize(html, PURIFY_CONFIG);
    }
    return `<p>${escapeHtml(String(html))}</p>`;
  }

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
    personality: `${CONFIG.storageNamespace}:personality`,
    userProfile: `${CONFIG.storageNamespace}:userProfile`,
    onboarded:   `${CONFIG.storageNamespace}:onboarded`
  };

  const PERSONALITIES = [
    { id: 'strategist',    icon: `<div class="nabad-path-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/></svg></div>`,    title: 'Strategist',         desc: 'Clear direction, positioning, and smart business decisions' },
    { id: 'growth',        icon: `<div class="nabad-path-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>`,        title: 'Growth Expert',       desc: 'Customer acquisition, conversion, and growth ideas' },
    { id: 'branding',      icon: `<div class="nabad-path-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/></svg></div>`,      title: 'Brand Builder',       desc: 'Branding, naming, identity, and premium positioning' },
    { id: 'offer',         icon: `<div class="nabad-path-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg></div>`,         title: 'Offer Architect',     desc: 'Offers, pricing, packages, and monetization' },
    { id: 'creative',      icon: `<div class="nabad-path-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>`,      title: 'Creative Challenger', desc: 'Bold, original, out-of-the-box business thinking' },
    { id: 'straight_talk', icon: `<div class="nabad-path-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></div>`, title: 'Straight Talk',       desc: 'Honest, direct, no-fluff business advice' },
    { id: 'auto',          icon: `<div class="nabad-path-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>`,          title: 'Let Nabad choose',    desc: 'Automatically adapt based on your goal' }
  ];

  // ── [PC-1] PERSONALITY COLOR MAP ─────────────────────────────
  const PERSONALITY_COLORS = {
    strategist:    { pulse: '#2563eb', border: '#2563eb', label: '🧠 Strategist'    },
    growth:        { pulse: '#16a34a', border: '#16a34a', label: '📈 Growth'        },
    branding:      { pulse: '#9333ea', border: '#9333ea', label: '🎨 Branding'      },
    offer:         { pulse: '#ea580c', border: '#ea580c', label: '💰 Offer'         },
    creative:      { pulse: '#db2777', border: '#db2777', label: '✨ Creative'      },
    straight_talk: { pulse: '#dc2626', border: '#dc2626', label: '⚡ Straight Talk' },
    auto:          { pulse: '#06b6d4', border: '#06b6d4', label: '🌀 Auto'          }
  };

  const ONBOARDING_PATHS = [
    {
      id: 'existing',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
      title: 'I have a business',
      desc: 'Help me grow, fix problems, and scale it'
    },
    {
      id: 'idea',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>`,
      title: 'I have an idea',
      desc: 'Help me validate and build it from scratch'
    },
    {
      id: 'figuring',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
      title: "I'm still figuring it out",
      desc: 'Help me find the right direction for me'
    }
  ];

  const ONBOARDING_QUESTIONS = {
    existing: [
      { key: 'businessName',    label: "What's your business called?",              placeholder: 'e.g. Apex Studio' },
      { key: 'whatYouSell',     label: 'What do you sell and who buys it?',          placeholder: 'e.g. Social media management for restaurants' },
      { key: 'revenue',         label: "What's your monthly revenue roughly?",       placeholder: 'e.g. $3,000/month or just starting' },
      { key: 'biggestChallenge',label: "What's your biggest challenge right now?",   placeholder: 'e.g. Getting more clients, retention, pricing...' }
    ],
    idea: [
      { key: 'ideaSummary',     label: 'Describe your idea in one sentence',         placeholder: 'e.g. A subscription box for specialty coffee' },
      { key: 'targetCustomer',  label: 'Who would pay for this?',                    placeholder: 'e.g. Coffee lovers aged 25-40 in the UAE' },
      { key: 'currentProgress', label: 'Have you made any money from it yet?',       placeholder: 'e.g. No, just started / Made $500 testing it' },
      { key: 'biggestBlock',    label: "What's stopping you from launching?",        placeholder: "e.g. Not sure if there's demand, need funding..." }
    ],
    figuring: [
      { key: 'skills',          label: "What are you good at?",                      placeholder: 'e.g. Design, sales, cooking, coding...' },
      { key: 'problems',        label: 'What problems do you notice around you?',    placeholder: 'e.g. People waste money on bad marketing' },
      { key: 'preference',      label: 'Product or service business?',               placeholder: 'e.g. Service — I like working with people' },
      { key: 'timeCommitment',  label: 'How much time can you commit per week?',     placeholder: 'e.g. 10 hours, full time, evenings only' }
    ]
  };

  // ── STATE ────────────────────────────────────────────────────
  const state = {
    open: false,
    sending: false,
    warRoom: false,
    messages: loadMessages(),
    personality: loadPersonality() || 'auto',
    personalityChosen: !!loadPersonality(),
    onboarded: loadOnboarded(),
    userProfile: loadUserProfile(),
    onboardingPath: null,
    onboardingAnswers: {},
    briefShown: false,
    voiceMode: false,
    pushSubscription: null,
    personalityBuffer: null,
    personalityCount: 0
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
        JSON.stringify(state.messages.slice(-50))
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

  function loadOnboarded() {
    try { return localStorage.getItem(STORAGE_KEYS.onboarded) === 'true'; }
    catch { return false; }
  }

  function saveOnboarded(value = true) {
    try { localStorage.setItem(STORAGE_KEYS.onboarded, String(value)); }
    catch {}
  }

  function loadUserProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.userProfile);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  function saveUserProfile(profile = {}) {
    try {
      localStorage.setItem(STORAGE_KEYS.userProfile, JSON.stringify(profile));
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

  function getPersonalityGreeting(id = 'auto') {
    const profile = state.userProfile || {};
    const name = profile.businessName || profile.ideaSummary || '';
    const nameStr = name ? ` — I can see you're working on <strong>${escapeHtml(name)}</strong>` : '';

    switch (id) {
      case 'strategist':
        return `<h3>🧠 Strategist mode</h3><p>Sharp decisions, clear direction, no wasted moves${nameStr}. Let's think big picture.</p><p><b>What are you working on?</b></p>`;
      case 'growth':
        return `<h3>📈 Growth Expert mode</h3><p>Traction, leads, conversion — let's find what moves the needle${nameStr}.</p><p><b>What are you working on?</b></p>`;
      case 'branding':
        return `<h3>🎨 Brand Builder mode</h3><p>Identity, positioning, how the world sees you${nameStr}. Let's build something memorable.</p><p><b>What are you working on?</b></p>`;
      case 'offer':
        return `<h3>💼 Offer Architect mode</h3><p>Packaging, pricing, monetization${nameStr}. Let's turn what you do into something people can't say no to.</p><p><b>What are you working on?</b></p>`;
      case 'creative':
        return `<h3>⚡ Creative Challenger mode</h3><p>Fresh angles, bold ideas, unexpected thinking${nameStr}. Let's break the obvious.</p><p><b>What are you working on?</b></p>`;
      case 'straight_talk':
        return `<h3>🎯 Straight Talk mode</h3><p>No fluff. No padding. Just what you need to hear${nameStr}.</p><p><b>What's the situation?</b></p>`;
      case 'auto':
      default:
        return `<h3>✨ Nabad is ready</h3><p>I'll adapt to what you need${nameStr}. Ask me anything about your business.</p><p><b>What's on your mind?</b></p>`;
    }
  }

  function buildProfileSummary() {
    const p = state.userProfile || {};
    const parts = [];
    if (p.path)             parts.push(`User type: ${p.path}`);
    if (p.businessName)     parts.push(`Business: ${p.businessName}`);
    if (p.whatYouSell)      parts.push(`What they sell: ${p.whatYouSell}`);
    if (p.revenue)          parts.push(`Revenue: ${p.revenue}`);
    if (p.biggestChallenge) parts.push(`Challenge: ${p.biggestChallenge}`);
    if (p.ideaSummary)      parts.push(`Idea: ${p.ideaSummary}`);
    if (p.targetCustomer)   parts.push(`Target customer: ${p.targetCustomer}`);
    if (p.currentProgress)  parts.push(`Progress: ${p.currentProgress}`);
    if (p.biggestBlock)     parts.push(`Blocker: ${p.biggestBlock}`);
    if (p.skills)           parts.push(`Skills: ${p.skills}`);
    if (p.problems)         parts.push(`Problems noticed: ${p.problems}`);
    if (p.preference)       parts.push(`Preference: ${p.preference}`);
    if (p.timeCommitment)   parts.push(`Time available: ${p.timeCommitment}`);
    return parts.join(' | ');
  }

  function setInputPlaceholder() {
    if (!refs.input) return;
    const map = {
      strategist:    'Ask for strategy, positioning, launch ideas...',
      growth:        'Ask about leads, growth, marketing, conversion...',
      branding:      'Ask about naming, identity, brand direction...',
      offer:         'Ask about offers, pricing, packages, monetization...',
      creative:      'Ask for bold ideas or fresh angles...',
      straight_talk: 'Ask for direct business advice...',
      auto:          'Ask Nabad anything...'
    };
    refs.input.placeholder = map[state.personality] || 'Ask Nabad anything...';
  }

  // ── [PC-1] APPLY PERSONALITY COLOR ───────────────────────────
  function applyPersonalityColor(id, announce = false) {
  const c = PERSONALITY_COLORS[id] || PERSONALITY_COLORS.auto;

  // 1. Update logo pulse color via CSS variable (works WITH the animation)
  const logo = document.getElementById('nabad-logo');
  if (logo) {
    // Convert hex to rgba for the two opacity levels the animation needs
    const hex = c.pulse.replace('#', '');
    const r = parseInt(hex.substring(0,2), 16);
    const g = parseInt(hex.substring(2,4), 16);
    const b = parseInt(hex.substring(4,6), 16);
    document.documentElement.style.setProperty(
      '--nabad-logo-pulse-color',
      `rgba(${r},${g},${b},0.35)`
    );
    logo.style.transition = 'border-color 0.6s ease';
    logo.style.borderColor = c.pulse;
  }

  // 2. Update bubble left border color via CSS variable
  document.documentElement.style.setProperty('--nabad-personality-color', c.border);

    // 3. Mode pill — only show on actual personality switch
    if (announce) {
      let pill = document.getElementById('nabad-mode-pill');
      if (!pill) {
        pill = document.createElement('div');
        pill.id = 'nabad-mode-pill';
        pill.style.cssText = [
          'font-size:11px',
          'font-weight:600',
          'margin-top:2px',
          'opacity:0',
          'transition:opacity 0.3s ease',
          'letter-spacing:0.2px'
        ].join(';');
        const titleWrap = document.getElementById('nabad-title-wrap');
        if (titleWrap && titleWrap.parentNode) {
          titleWrap.parentNode.insertBefore(pill, titleWrap.nextSibling);
        }
      }
      pill.style.color = c.pulse;
      pill.textContent = c.label;
      pill.style.opacity = '0';

      // Fade in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { pill.style.opacity = '1'; });
      });

      // Stay visible 3 seconds then fade out
      clearTimeout(pill._hideTimer);
      pill._hideTimer = setTimeout(() => {
        pill.style.opacity = '0';
      }, 3300);
    }
  }

  function confirmAction(message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      `position:fixed`, `inset:0`, `background:rgba(0,0,0,0.52)`,
      `z-index:${CONFIG.zIndex + 30}`, `display:flex`,
      `align-items:center`, `justify-content:center`, `padding:20px`,
      `font-family:Inter,ui-sans-serif,system-ui,sans-serif`
    ].join(';');

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:18px;padding:26px 24px;max-width:320px;width:100%;box-shadow:0 20px 60px rgba(15,23,42,0.22);">
        <p style="margin:0 0 20px;font-size:15px;color:#0f172a;line-height:1.5">${escapeHtml(message)}</p>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="_nabad_cancel" style="padding:9px 18px;border-radius:11px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;font-size:14px;font-weight:700;color:#475569">Cancel</button>
          <button id="_nabad_ok" style="padding:9px 18px;border-radius:11px;border:none;background:linear-gradient(135deg,#2563eb,#06b6d4);color:#fff;cursor:pointer;font-size:14px;font-weight:700">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector('#_nabad_ok').onclick     = () => { overlay.remove(); onConfirm(); };
    overlay.querySelector('#_nabad_cancel').onclick = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

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
        0%,100% { box-shadow: 0 10px 24px rgba(37,99,235,0.18), 0 0 18px rgba(6,182,212,0.10); }
        50%      { box-shadow: 0 12px 28px rgba(37,99,235,0.20), 0 0 24px rgba(6,182,212,0.14); }
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
        background: linear-gradient(180deg, rgba(226,240,255,0.96) 0%, rgba(240,249,255,0.95) 100%);
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
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 0 0 rgba(37,99,235,0.4);
        animation: nabadBreath 2.5s ease-in-out infinite;
        overflow: hidden;
        transition: box-shadow 0.6s ease, border-color 0.6s ease;
      }

      #nabad-logo img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        border-radius: 999px;
      }

      @keyframes nabadBreath {
  0%   { box-shadow: 0 0 0 0px var(--nabad-logo-pulse-color, rgba(37,99,235,0.35)); }
  50%  { box-shadow: 0 0 0 7px var(--nabad-logo-pulse-color, rgba(37,99,235,0.10)); }
  100% { box-shadow: 0 0 0 0px var(--nabad-logo-pulse-color, rgba(37,99,235,0.35)); }
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

      #nabad-mode-pill {
        font-size: 11px;
        font-weight: 600;
        margin-top: 2px;
        opacity: 0;
        transition: opacity 0.3s ease;
        letter-spacing: 0.2px;
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
      .nabad-msg.bot {
        justify-content: flex-start;
        animation: nabadBotAppear 0.35s ease-out both;
      }

      @keyframes nabadBotAppear {
        0%   { opacity: 0; transform: translateY(10px); }
        100% { opacity: 1; transform: translateY(0); }
      }

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
        border-left: 3px solid var(--nabad-personality-color, #06b6d4);
        border-top-left-radius: 6px;
        border-bottom-left-radius: 6px;
        box-shadow: 0 10px 28px rgba(15,23,42,0.06);
        transition: border-color 0.6s ease;
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
        0%   { box-shadow: 0 0 0 rgba(37,99,235,0.0), 0 10px 30px rgba(15,23,42,0.10); opacity: 0.88; }
        100% { box-shadow: 0 0 22px rgba(6,182,212,0.42), 0 12px 34px rgba(37,99,235,0.18); opacity: 1; }
      }

      /* ── [OB-1] ONBOARDING SCREENS ───────────────────────── */
      #nabad-onboarding { padding: 4px 2px 10px; }

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

      .nabad-path-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
        margin-top: 4px;
      }

      .nabad-path-card {
        width: 100%;
        text-align: left;
        border: 1px solid rgba(37,99,235,0.12);
        background: rgba(255,255,255,0.98);
        border-radius: 18px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.18s ease;
        box-shadow: 0 6px 18px rgba(15,23,42,0.05);
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .nabad-path-card:hover {
        transform: translateY(-1px);
        border-color: rgba(37,99,235,0.26);
        box-shadow: 0 10px 24px rgba(37,99,235,0.08);
      }

      .nabad-path-icon {
        font-size: 28px;
        flex-shrink: 0;
        width: 48px;
        height: 48px;
        border-radius: 14px;
        background: linear-gradient(135deg, #eff6ff, #dbeafe);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .nabad-path-text { flex: 1; min-width: 0; }

      .nabad-path-title {
        font-size: 15px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 3px;
      }

      .nabad-path-desc {
        font-size: 13px;
        color: #475569;
        line-height: 1.4;
      }

      .nabad-path-arrow {
        font-size: 18px;
        color: #94a3b8;
        flex-shrink: 0;
      }

      .nabad-questions-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 4px;
      }

      .nabad-question-field {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .nabad-question-label {
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
      }

      .nabad-question-input {
        width: 100%;
        border: 1px solid rgba(37,99,235,0.16);
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 14px;
        color: #0f172a;
        background: rgba(255,255,255,0.98);
        outline: none;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        font-family: inherit;
      }

      .nabad-question-input:focus {
        border-color: rgba(37,99,235,0.35);
        box-shadow: 0 0 0 3px rgba(37,99,235,0.08);
      }

      .nabad-question-input::placeholder { color: #94a3b8; }

      .nabad-ob-btn {
        width: 100%;
        padding: 13px;
        border: none;
        border-radius: 14px;
        background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
        color: #fff;
        font-size: 15px;
        font-weight: 800;
        cursor: pointer;
        margin-top: 4px;
        box-shadow: 0 8px 20px rgba(37,99,235,0.18);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }

      .nabad-ob-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 24px rgba(37,99,235,0.22);
      }

      .nabad-ob-back {
        background: transparent;
        border: 1px solid rgba(37,99,235,0.14);
        color: #2563eb;
        font-size: 13px;
        font-weight: 700;
        padding: 9px;
        border-radius: 12px;
        cursor: pointer;
        margin-top: 4px;
        width: 100%;
        font-family: inherit;
      }

      .nabad-ob-skip {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 600;
        padding: 6px;
        cursor: pointer;
        width: 100%;
        font-family: inherit;
        margin-top: 2px;
      }

      .nabad-ob-skip:hover { color: #64748b; }

      .nabad-ob-progress {
        display: flex;
        justify-content: center;
        gap: 6px;
        margin-bottom: 16px;
      }

      .nabad-ob-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #e2e8f0;
        transition: background 0.2s ease, width 0.2s ease;
      }

      .nabad-ob-dot.active {
        background: linear-gradient(135deg, #2563eb, #06b6d4);
        width: 20px;
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
        box-shadow: 0 10px 24px rgba(37,99,235,0.08), 0 0 18px rgba(6,182,212,0.08);
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
          0 0 8px rgba(37,99,235,0.12),
          0 0 16px rgba(6,182,212,0.08);
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      #nabad-input:focus {
        border-color: rgba(37,99,235,0.30);
        box-shadow:
          inset 0 1px 2px rgba(15,23,42,0.03),
          0 0 10px rgba(37,99,235,0.22),
          0 0 22px rgba(6,182,212,0.14);
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
        box-shadow: 0 8px 20px rgba(37,99,235,0.14), 0 0 14px rgba(6,182,212,0.08);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      #nabad-send:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 24px rgba(37,99,235,0.16), 0 0 16px rgba(6,182,212,0.10);
      }

      #nabad-send:disabled { opacity: 0.55; cursor: not-allowed; }

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

      .nabad-img-placeholder {
        width: 280px;
        height: 280px;
        border-radius: 16px;
        background: linear-gradient(135deg, #f0f4ff 0%, #f5f5ff 100%);
        position: relative;
        overflow: hidden;
        box-shadow: 0 0 14px 3px rgba(120,130,200,0.18), 0 0 32px 6px rgba(120,130,200,0.09);
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
        background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%);
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
        0%, 100% { box-shadow: 0 0 14px 3px rgba(120,130,200,0.18), 0 0 32px 6px rgba(120,130,200,0.09); }
        50%       { box-shadow: 0 0 22px 6px rgba(120,130,200,0.28), 0 0 48px 12px rgba(120,130,200,0.15); }
      }

      @keyframes nabadShimmer {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(200%); }
      }

      .nabad-bubble [data-nabad-card="snapshot"] {
        background: linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%);
        border: 1px solid rgba(37,99,235,0.12);
        border-radius: 18px;
        padding: 18px 16px;
        margin: -4px 0;
      }

      .nabad-bubble [data-nabad-card="snapshot"] h3 {
        font-size: 17px;
        font-weight: 800;
        color: #0f172a;
        margin: 0 0 10px;
      }

      .nabad-bubble [data-nabad-card="snapshot"] ul {
        margin: 10px 0;
        padding: 0;
        list-style: none;
      }

      .nabad-bubble [data-nabad-card="snapshot"] li {
        padding: 9px 12px;
        margin-bottom: 8px;
        background: rgba(255,255,255,0.9);
        border-radius: 12px;
        border: 1px solid rgba(15,23,42,0.06);
        font-size: 14px;
        line-height: 1.5;
        box-shadow: 0 4px 12px rgba(15,23,42,0.04);
      }

      .nabad-bubble [data-nabad-card="snapshot"] > p {
        font-size: 14px;
        color: #334155;
        margin: 8px 0;
        line-height: 1.55;
      }

      .nabad-bubble [data-nabad-card="score"] {
        background: linear-gradient(180deg, #fafafa 0%, #ffffff 100%);
        border: 1px solid rgba(37,99,235,0.10);
        border-radius: 18px;
        padding: 18px 16px;
        margin: -4px 0;
      }

      .nabad-bubble [data-nabad-card="score"] h3 {
        font-size: 17px;
        font-weight: 800;
        color: #0f172a;
        margin: 0 0 6px;
      }

      .nabad-bubble [data-nabad-card="score"] ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .nabad-bubble [data-nabad-card="score"] li {
        padding: 8px 12px;
        margin-bottom: 7px;
        background: rgba(255,255,255,0.9);
        border-radius: 12px;
        border: 1px solid rgba(15,23,42,0.06);
        font-size: 14px;
        line-height: 1.5;
        box-shadow: 0 4px 12px rgba(15,23,42,0.04);
      }

      .nabad-score-bar-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      .nabad-score-bar-label {
        font-size: 13px;
        font-weight: 700;
        color: #334155;
        min-width: 130px;
        flex-shrink: 0;
      }

      .nabad-score-bar-track {
        flex: 1;
        height: 8px;
        border-radius: 999px;
        background: #e2e8f0;
        overflow: hidden;
      }

      .nabad-score-bar-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #2563eb, #06b6d4);
        width: 0%;
        transition: width 0.9s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .nabad-score-bar-value {
        font-size: 13px;
        font-weight: 800;
        color: #2563eb;
        min-width: 32px;
        text-align: right;
      }

      .nabad-bubble [data-nabad-card="pricing"] {
        background: linear-gradient(180deg, #f8faff 0%, #ffffff 100%);
        border: 1px solid rgba(37,99,235,0.12);
        border-radius: 18px;
        padding: 18px 16px;
        margin: -4px 0;
        overflow-x: auto;
      }

      .nabad-bubble [data-nabad-card="pricing"] h3 {
        font-size: 17px;
        font-weight: 800;
        color: #0f172a;
        margin: 0 0 14px;
      }

      .nabad-pricing-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }

      .nabad-pricing-table th {
        background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
        color: #fff;
        font-weight: 800;
        padding: 10px 12px;
        text-align: left;
        font-size: 13px;
      }

      .nabad-pricing-table th:first-child { border-radius: 10px 0 0 0; }
      .nabad-pricing-table th:last-child  { border-radius: 0 10px 0 0; }

      .nabad-pricing-table td {
        padding: 10px 12px;
        border-bottom: 1px solid rgba(15,23,42,0.06);
        color: #334155;
        vertical-align: top;
        line-height: 1.45;
      }

      .nabad-pricing-table tr:last-child td { border-bottom: none; }

      .nabad-pricing-table tr:nth-child(even) td {
        background: rgba(37,99,235,0.03);
      }

      .nabad-pricing-table .price-cell {
        font-weight: 800;
        color: #2563eb;
        white-space: nowrap;
      }

      .nabad-pricing-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 800;
        background: linear-gradient(135deg, #2563eb, #06b6d4);
        color: #fff;
        margin-left: 6px;
        vertical-align: middle;
      }

      .nabad-pricing-note {
        font-size: 12px;
        color: #64748b;
        margin-top: 10px;
        line-height: 1.5;
        font-style: italic;
      }

      .nabad-bubble [data-nabad-card="offer"] {
        background: linear-gradient(180deg, #fffbf0 0%, #ffffff 100%);
        border: 1px solid rgba(234,179,8,0.22);
        border-radius: 18px;
        padding: 18px 16px;
        margin: -4px 0;
      }

      .nabad-bubble [data-nabad-card="offer"] h3 {
        font-size: 17px;
        font-weight: 800;
        color: #0f172a;
        margin: 0 0 12px;
      }

      .nabad-offer-section { margin-bottom: 14px; }

      .nabad-offer-section-title {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #92400e;
        margin-bottom: 6px;
      }

      .nabad-offer-price-block {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 10px;
      }

      .nabad-offer-price {
        font-size: 32px;
        font-weight: 900;
        color: #0f172a;
        line-height: 1;
      }

      .nabad-offer-price-sub {
        font-size: 14px;
        color: #64748b;
        font-weight: 600;
      }

      .nabad-offer-tag {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
        margin: 2px 4px 2px 0;
        background: rgba(37,99,235,0.08);
        color: #1e40af;
        border: 1px solid rgba(37,99,235,0.14);
      }

      .nabad-offer-tag.warning {
        background: rgba(234,179,8,0.10);
        color: #92400e;
        border-color: rgba(234,179,8,0.22);
      }

      .nabad-offer-divider {
        height: 1px;
        background: rgba(15,23,42,0.06);
        margin: 12px 0;
      }

      .nabad-bubble [data-nabad-card="matrix"] {
        background: linear-gradient(180deg, #fdf4ff 0%, #ffffff 100%);
        border: 1px solid rgba(139,92,246,0.15);
        border-radius: 18px;
        padding: 18px 16px;
        margin: -4px 0;
      }

      .nabad-bubble [data-nabad-card="matrix"] h3 {
        font-size: 17px;
        font-weight: 800;
        color: #0f172a;
        margin: 0 0 14px;
      }

      .nabad-matrix-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        gap: 8px;
        margin-bottom: 14px;
      }

      .nabad-matrix-cell {
        border-radius: 14px;
        padding: 14px 12px;
        font-size: 13px;
        line-height: 1.45;
        border: 1px solid transparent;
        position: relative;
      }

      .nabad-matrix-cell-label {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.7px;
        margin-bottom: 6px;
      }

      .nabad-matrix-cell-content {
        font-size: 13px;
        color: #334155;
        line-height: 1.45;
      }

      .nabad-matrix-cell[data-quadrant="q1"] {
        background: linear-gradient(135deg, #f0fdf4, #dcfce7);
        border-color: rgba(34,197,94,0.20);
      }
      .nabad-matrix-cell[data-quadrant="q1"] .nabad-matrix-cell-label { color: #15803d; }

      .nabad-matrix-cell[data-quadrant="q2"] {
        background: linear-gradient(135deg, #eff6ff, #dbeafe);
        border-color: rgba(37,99,235,0.18);
      }
      .nabad-matrix-cell[data-quadrant="q2"] .nabad-matrix-cell-label { color: #1d4ed8; }

      .nabad-matrix-cell[data-quadrant="q3"] {
        background: linear-gradient(135deg, #fefce8, #fef9c3);
        border-color: rgba(234,179,8,0.20);
      }
      .nabad-matrix-cell[data-quadrant="q3"] .nabad-matrix-cell-label { color: #a16207; }

      .nabad-matrix-cell[data-quadrant="q4"] {
        background: linear-gradient(135deg, #fff1f2, #ffe4e6);
        border-color: rgba(239,68,68,0.18);
      }
      .nabad-matrix-cell[data-quadrant="q4"] .nabad-matrix-cell-label { color: #b91c1c; }

      .nabad-matrix-axes {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #94a3b8;
        font-weight: 700;
        margin-top: 6px;
      }

      .nabad-matrix-recommendation {
        background: rgba(139,92,246,0.06);
        border: 1px solid rgba(139,92,246,0.14);
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 13px;
        color: #4c1d95;
        line-height: 1.5;
        margin-top: 12px;
      }

      .nabad-bubble [data-nabad-card="action-plan"] {
        background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);
        border: 1px solid rgba(34,197,94,0.15);
        border-radius: 18px;
        padding: 18px 16px;
        margin: -4px 0;
      }

      .nabad-bubble [data-nabad-card="action-plan"] h3 {
        font-size: 17px;
        font-weight: 800;
        color: #0f172a;
        margin: 0 0 14px;
      }

      .nabad-action-week { margin-bottom: 14px; }

      .nabad-action-week-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }

      .nabad-action-week-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 4px 12px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
        background: linear-gradient(135deg, #2563eb, #06b6d4);
        color: #fff;
        white-space: nowrap;
      }

      .nabad-action-week-title {
        font-size: 14px;
        font-weight: 800;
        color: #0f172a;
      }

      .nabad-action-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 9px 12px;
        margin-bottom: 6px;
        background: rgba(255,255,255,0.9);
        border-radius: 12px;
        border: 1px solid rgba(15,23,42,0.06);
        font-size: 13px;
        color: #334155;
        line-height: 1.45;
        box-shadow: 0 2px 8px rgba(15,23,42,0.03);
      }

      .nabad-action-item-icon {
        font-size: 15px;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .nabad-action-divider {
        height: 1px;
        background: rgba(15,23,42,0.06);
        margin: 10px 0;
      }

      .nabad-action-goal {
        background: rgba(34,197,94,0.08);
        border: 1px solid rgba(34,197,94,0.18);
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 13px;
        font-weight: 700;
        color: #14532d;
        line-height: 1.5;
        margin-top: 12px;
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

        .nabad-bubble [data-nabad-card="snapshot"],
        .nabad-bubble [data-nabad-card="score"],
        .nabad-bubble [data-nabad-card="pricing"],
        .nabad-bubble [data-nabad-card="offer"],
        .nabad-bubble [data-nabad-card="matrix"],
        .nabad-bubble [data-nabad-card="action-plan"] {
          padding: 14px 12px;
        }

        .nabad-matrix-grid {
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .nabad-matrix-cell { padding: 10px 8px; }
        .nabad-pricing-table { font-size: 12px; }
        .nabad-pricing-table th,
        .nabad-pricing-table td { padding: 8px 8px; }
        .nabad-score-bar-label { min-width: 100px; font-size: 12px; }
        .nabad-offer-price { font-size: 26px; }
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

      @media (prefers-reduced-motion: reduce) {
        #nabad-launcher,
        #nabad-input,
        .nabad-score-bar-fill,
        .nabad-img-placeholder,
        .nabad-img-placeholder::before,
        .nabad-dots span,
        .nabad-bubble img.loading {
          animation: none !important;
          transition: none !important;
        }
        .nabad-score-bar-fill { width: var(--nabad-score-target, 0%) !important; }
      }

      /* ── Nabad Detected Effect ── */
      .nabad-detected-flash {
        animation: nabadFlash 0.6s ease-in-out 2;
      }

      @keyframes nabadFlash {
        0%   { box-shadow: 0 0 0 0px rgba(37,99,235,0.0); }
        50%  { box-shadow: 0 0 0 6px rgba(37,99,235,0.35); }
        100% { box-shadow: 0 0 0 0px rgba(37,99,235,0.0); }
      }

      #nabad-logo.nabad-logo-pulse {
        animation: nabadStrongPulse 0.5s ease-in-out 2;
      }

      @keyframes nabadStrongPulse {
        0%   { box-shadow: 0 0 0 0px rgba(37,99,235,0.6); }
        50%  { box-shadow: 0 0 0 12px rgba(37,99,235,0.15); }
        100% { box-shadow: 0 0 0 0px rgba(37,99,235,0.6); }
      }

      .nabad-detected-pill {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 7px 16px;
        background: linear-gradient(135deg, #2563eb, #06b6d4);
        color: #fff;
        font-size: 13px;
        font-weight: 800;
        border-radius: 999px;
        margin: 0 auto 6px;
        width: fit-content;
        opacity: 0;
        transform: translateY(6px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        pointer-events: none;
      }

      .nabad-detected-pill.show {
        opacity: 1;
        transform: translateY(0);
      }

      #nabad-logo.thinking {
        animation: nabadThinking 0.8s ease-in-out infinite;
      }

      @keyframes nabadThinking {
        0%   { box-shadow: 0 0 0 0px rgba(37,99,235,0.6); }
        50%  { box-shadow: 0 0 0 14px rgba(37,99,235,0.15); }
        100% { box-shadow: 0 0 0 0px rgba(37,99,235,0.6); }
      }

      /* ── Options Popup ── */
      .nabad-options-popup {
        position: absolute;
        top: 58px;
        right: 14px;
        background: #fff;
        border: 1px solid rgba(37,99,235,0.12);
        border-radius: 16px;
        box-shadow: 0 12px 40px rgba(15,23,42,0.14);
        overflow: hidden;
        z-index: 999;
        min-width: 180px;
        opacity: 0;
        transform: translateY(-6px);
        transition: opacity 0.2s ease, transform 0.2s ease;
        pointer-events: none;
      }

      .nabad-options-popup.show {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      .nabad-options-btn {
        width: 100%;
        padding: 13px 16px;
        border: none;
        background: transparent;
        text-align: left;
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: inherit;
        transition: background 0.15s ease;
      }

      .nabad-options-btn:hover {
        background: rgba(37,99,235,0.05);
      }

      .nabad-options-btn.danger {
        color: #ef4444;
      }

      .nabad-options-divider {
        height: 1px;
        background: rgba(15,23,42,0.06);
        margin: 0;
      }

      /* ── War Room Suggestion Banner ── */
      #nabad-warroom-suggestion {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: linear-gradient(135deg, #1e3a8a, #0e7490);
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        border-top: 1px solid rgba(255,255,255,0.10);
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        pointer-events: none;
        flex-wrap: nowrap;
        min-height: 42px;
        box-sizing: border-box;
      }
      #nabad-warroom-suggestion.show {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }
      #nabad-warroom-suggestion span {
        flex: 1;
        line-height: 1.3;
        font-size: 11px;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #nabad-warroom-suggestion button {
        background: rgba(255,255,255,0.18);
        border: 1px solid rgba(255,255,255,0.25);
        color: #fff;
        border-radius: 8px;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        white-space: nowrap;
        flex-shrink: 0;
        transition: background 0.15s ease;
      }
      #nabad-warroom-suggestion button:hover {
        background: rgba(255,255,255,0.28);
      }
      #nabad-warroom-suggestion #nabad-warroom-dismiss {
        padding: 4px 6px;
        background: transparent;
        border-color: transparent;
        font-size: 13px;
        flex-shrink: 0;
      }

      /* ── War Room Screen ── */
      #nabad-warroom-screen {
        padding: 8px 4px 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .nabad-wr-header {
        text-align: center;
        padding: 12px 0 4px;
      }
      .nabad-wr-icon {
        font-size: 32px;
        margin-bottom: 6px;
      }
      .nabad-wr-header h3 {
        font-size: 20px;
        font-weight: 800;
        color: #0f172a;
        margin: 0 0 6px;
      }
      .nabad-wr-header p {
        font-size: 13px;
        color: #64748b;
        margin: 0;
        line-height: 1.5;
      }
      .nabad-wr-situation {
        font-size: 13px !important;
        font-style: italic;
        color: #2563eb !important;
        background: rgba(37,99,235,0.06);
        border-radius: 10px;
        padding: 8px 12px;
        margin-top: 6px !important;
      }
      .nabad-wr-input-block {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .nabad-wr-input-block textarea {
        width: 100%;
        border: 1px solid rgba(37,99,235,0.18);
        border-radius: 14px;
        padding: 12px 14px;
        font-size: 14px;
        font-family: inherit;
        color: #0f172a;
        resize: none;
        outline: none;
        background: rgba(255,255,255,0.98);
        box-shadow: 0 0 8px rgba(37,99,235,0.08);
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        box-sizing: border-box;
      }
      .nabad-wr-input-block textarea:focus {
        border-color: rgba(37,99,235,0.35);
        box-shadow: 0 0 12px rgba(37,99,235,0.16);
      }
      #nabad-wr-advisors {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .nabad-wr-card {
        background: rgba(255,255,255,0.98);
        border: 1px solid rgba(37,99,235,0.10);
        border-radius: 18px;
        padding: 16px;
        box-shadow: 0 4px 18px rgba(15,23,42,0.07);
        animation: nabadBotAppear 0.35s ease-out both;
      }
      .nabad-wr-card-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 12px;
      }
      .nabad-wr-card-icon {
        font-size: 24px;
        flex-shrink: 0;
        margin-top: 2px;
      }
      .nabad-wr-card-name {
        font-size: 14px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 2px;
      }
      .nabad-wr-card-desc {
        font-size: 12px;
        color: #94a3b8;
        font-weight: 500;
      }
      .nabad-wr-card-reply {
        font-size: 14px;
        color: #334155;
        line-height: 1.6;
        padding-top: 4px;
        border-top: 1px solid rgba(15,23,42,0.06);
      }
      .nabad-wr-card-reply p {
        margin: 0 0 8px;
      }
      .nabad-wr-card-reply p:last-child {
        margin-bottom: 0;
      }

      /* ── Morning Brief ── */
      #nabad-morning-brief {
        padding: 0 0 24px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        animation: nabadBotAppear 0.4s ease-out both;
      }
      .nabad-brief-hero {
        background: linear-gradient(160deg, #0f172a 0%, #1e3a5f 55%, #0e7490 100%);
        border-radius: 0 0 28px 28px;
        padding: 28px 20px 24px;
        text-align: center;
        position: relative;
        overflow: hidden;
      }
      .nabad-brief-hero::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at 60% 40%, rgba(37,99,235,0.3) 0%, transparent 65%);
        pointer-events: none;
      }
      .nabad-brief-date {
        font-size: 11px;
        color: rgba(255,255,255,0.5);
        text-transform: uppercase;
        letter-spacing: 1.5px;
        margin-bottom: 8px;
      }
      .nabad-brief-title {
        font-size: 24px;
        font-weight: 900;
        color: #fff;
        margin-bottom: 8px;
        letter-spacing: -0.3px;
      }
      .nabad-brief-subtitle {
        font-size: 13px;
        color: rgba(255,255,255,0.6);
      }
      .nabad-brief-greeting {
        font-size: 14px;
        color: rgba(255,255,255,0.85);
        line-height: 1.5;
        margin-top: 6px;
      }
      .nabad-brief-loading {
        text-align: center;
        padding: 24px;
      }
      .nabad-brief-card {
        margin: 0 14px;
        background: #fff;
        border-radius: 18px;
        padding: 16px;
        box-shadow: 0 4px 18px rgba(15,23,42,0.08);
        border: 1px solid rgba(15,23,42,0.06);
      }
      .nabad-brief-card-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #94a3b8;
        margin-bottom: 8px;
      }
      .nabad-brief-card-text {
        font-size: 14px;
        color: #1e293b;
        line-height: 1.6;
        font-weight: 500;
      }
      .nabad-brief-focus { border-left: 3px solid #2563eb; }
      .nabad-brief-pulse { border-left: 3px solid #f59e0b; }
      .nabad-brief-question {
        border-left: 3px solid #10b981;
        background: linear-gradient(135deg, #f0fdf4, #fff);
      }
      .nabad-brief-q-text {
        font-style: italic;
        font-size: 15px;
        font-weight: 700;
        color: #0f172a;
      }
      .nabad-brief-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 0 14px;
        margin-top: 4px;
      }

      /* ── Voice Note ── */
      #nabad-mic {
        width: 44px;
        height: 44px;
        border: none;
        border-radius: 16px;
        cursor: pointer;
        background: rgba(37,99,235,0.08);
        color: #2563eb;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }
      #nabad-mic:hover {
        background: rgba(37,99,235,0.14);
      }
      #nabad-mic.recording {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: #fff;
        animation: nabadMicPulse 1s ease-in-out infinite;
      }
      @keyframes nabadMicPulse {
        0%, 100% { box-shadow: 0 0 0 0px rgba(239,68,68,0.4); }
        50%       { box-shadow: 0 0 0 8px rgba(239,68,68,0.0); }
      }
      #nabad-voice-status {
        display: none;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: rgba(239,68,68,0.06);
        border-top: 1px solid rgba(239,68,68,0.10);
        font-size: 12px;
        font-weight: 700;
        color: #ef4444;
      }
      #nabad-voice-status.show { display: flex; }
      .nabad-voice-timer {
        font-size: 12px;
        font-weight: 800;
        color: #ef4444;
        min-width: 32px;
      }
      .nabad-voice-wave {
        display: flex;
        gap: 3px;
        align-items: center;
      }
      .nabad-voice-wave span {
        width: 3px;
        border-radius: 99px;
        background: #ef4444;
        animation: nabadWave 0.8s ease-in-out infinite;
      }
      .nabad-voice-wave span:nth-child(1) { height: 8px;  animation-delay: 0.0s; }
      .nabad-voice-wave span:nth-child(2) { height: 14px; animation-delay: 0.1s; }
      .nabad-voice-wave span:nth-child(3) { height: 10px; animation-delay: 0.2s; }
      .nabad-voice-wave span:nth-child(4) { height: 16px; animation-delay: 0.3s; }
      .nabad-voice-wave span:nth-child(5) { height: 8px;  animation-delay: 0.4s; }
      @keyframes nabadWave {
        0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
        50%       { transform: scaleY(1.2); opacity: 1;   }
      }

      /* ── Speaker Button ── */
      .nabad-speaker-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 8px;
        padding: 4px 10px;
        border: 1px solid rgba(37,99,235,0.15);
        border-radius: 20px;
        background: rgba(37,99,235,0.05);
        color: #2563eb;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s ease;
        gap: 5px;
      }
      .nabad-speaker-btn:hover {
        background: rgba(37,99,235,0.12);
        border-color: rgba(37,99,235,0.3);
      }
      .nabad-speaker-btn.playing {
        background: rgba(37,99,235,0.12);
        border-color: rgba(37,99,235,0.3);
        color: #1d4ed8;
      }
      .nabad-wave-anim {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        height: 14px;
      }
      .nabad-wave-anim span {
        display: block;
        width: 3px;
        border-radius: 99px;
        background: #2563eb;
        animation: nabadSpeakerWave 0.8s ease-in-out infinite;
      }
      
      .nabad-msg.user .nabad-wave-anim span {
  background: rgba(255, 255, 255, 0.85);
}
      
      .nabad-wave-anim span:nth-child(1) { height: 4px;  animation-delay: 0.0s; }
      .nabad-wave-anim span:nth-child(2) { height: 10px; animation-delay: 0.1s; }
      .nabad-wave-anim span:nth-child(3) { height: 14px; animation-delay: 0.2s; }
      .nabad-wave-anim span:nth-child(4) { height: 10px; animation-delay: 0.3s; }
      .nabad-wave-anim span:nth-child(5) { height: 4px;  animation-delay: 0.4s; }
      @keyframes nabadSpeakerWave {
        0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
        50%       { transform: scaleY(1.2); opacity: 1;   }
      }

      /* ── Speaker loading dots ── */
      .nabad-loading-dots {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        height: 14px;
      }
      .nabad-loading-dots span {
        display: block;
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: #2563eb;
        animation: nabadDotPulse 1s ease-in-out infinite;
      }
      .nabad-loading-dots span:nth-child(1) { animation-delay: 0.0s; }
      .nabad-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
      .nabad-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes nabadDotPulse {
        0%, 100% { transform: scale(0.6); opacity: 0.4; }
        50%       { transform: scale(1.4); opacity: 1; }
      }

      /* ── Button row ── */
      .nabad-btn-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      /* ── Memory button ── */
      .nabad-memory-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 8px;
        padding: 4px 10px;
        border: 1px solid rgba(37,99,235,0.15);
        border-radius: 20px;
        background: rgba(37,99,235,0.05);
        color: #2563eb;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s ease;
        gap: 5px;
      }
      .nabad-memory-btn:hover {
        background: rgba(37,99,235,0.12);
        border-color: rgba(37,99,235,0.3);
      }
      .nabad-memory-btn[data-saved="true"] {
        border-color: rgba(34,197,94,0.3);
        background: rgba(34,197,94,0.08);
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
            <div id="nabad-logo"><img src="/logo.png" alt="Nabad" /></div>
            <div id="nabad-title-wrap">
              <div id="nabad-title">${escapeHtml(CONFIG.title)}</div>
              <div id="nabad-subtitle">${escapeHtml(CONFIG.subtitle)}</div>
            </div>
          </div>
          <div id="nabad-header-actions">
            <button class="nabad-icon-btn" id="nabad-new-chat" type="button" title="Options">⊙</button>
            <button class="nabad-icon-btn nabad-desktop-only" id="nabad-close" type="button" title="Close">×</button>
          </div>
        </div>

        <div id="nabad-messages" aria-live="polite" aria-label="Chat messages"></div>

        <div id="nabad-typing">
          <div class="inner">
            <span class="nabad-dots"><span></span><span></span><span></span></span>
          </div>
        </div>

        <div id="nabad-voice-status">
          <div class="nabad-voice-wave">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <span>Recording...</span>
          <span class="nabad-voice-timer" id="nabad-voice-timer">0:00</span>
          <span style="margin-left:auto;font-size:11px;opacity:0.7">Tap again to send</span>
        </div>

        <div id="nabad-input-wrap">
          <div id="nabad-input-row">
            <textarea id="nabad-input" rows="1" placeholder="Ask Nabad anything..."></textarea>
            <button id="nabad-mic" type="button" aria-label="Voice note">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3"/>
                <path d="M5 10a7 7 0 0 0 14 0"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
                <line x1="8" y1="22" x2="16" y2="22"/>
              </svg>
            </button>
            <button id="nabad-send" type="button" aria-label="Send">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
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

    refs.root          = root;
    refs.launcher      = root.querySelector('#nabad-launcher');
    refs.panel         = root.querySelector('#nabad-panel');
    refs.messages      = root.querySelector('#nabad-messages');
    refs.input         = root.querySelector('#nabad-input');
    refs.send          = root.querySelector('#nabad-send');
    refs.badge         = root.querySelector('#nabad-selected-personality');
    refs.typing        = root.querySelector('#nabad-typing');
    refs.lightbox      = root.querySelector('#nabad-lightbox');
    refs.lightboxImg   = root.querySelector('#nabad-lightbox-img');
    refs.lightboxSave  = root.querySelector('#nabad-lightbox-save');
    refs.lightboxOpen  = root.querySelector('#nabad-lightbox-open');
    refs.lightboxClose = root.querySelector('#nabad-lightbox-close');

    bindEvents(root);
    updatePersonalityBadge();
    setInputPlaceholder();
    applyPersonalityColor(state.personality, false);
    renderInitialState();
  }

  // ── EVENTS ───────────────────────────────────────────────────
  function bindEvents(root) {
    root.querySelector('#nabad-new-chat').addEventListener('click', showOptionsPopup);
    root.querySelector('#nabad-close').addEventListener('click', () => toggleWidget(false));
    root.querySelector('#nabad-send').addEventListener('click', sendMessage);

    const mic = root.querySelector('#nabad-mic');
    if (mic) {
      mic.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          stopVoiceRecording();
        } else {
          startVoiceRecording();
        }
      });
    }

    refs.input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
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
        a.href = u; a.download = 'nabad-generated-image.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 1500);
      } catch {
        window.open(currentLightboxSrc, '_blank', 'noopener,noreferrer');
      }
    });

    refs.lightboxOpen.addEventListener('click', () => {
      if (!currentLightboxSrc) return;
      window.open(currentLightboxSrc, '_blank', 'noopener,noreferrer');
    });

    window.addEventListener('beforeunload', releaseScrollLock);
  }

  let _lastScrollHeight = 0;
  function autoGrowTextarea() {
    if (!refs.input) return;
    if (refs.input.scrollHeight === _lastScrollHeight) return;
    _lastScrollHeight = refs.input.scrollHeight;
    refs.input.style.height = 'auto';
    refs.input.style.height = `${Math.min(refs.input.scrollHeight, 150)}px`;
  }

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

  function toggleWidget(force) {
    state.open = typeof force === 'boolean' ? force : !state.open;
    refs.panel.classList.toggle('open', state.open);
    refs.panel.setAttribute('aria-hidden', state.open ? 'false' : 'true');
    refs.root.classList.toggle('nabad-open', state.open);

    if (state.open) {
      applyScrollLock();
      setTimeout(() => {
        if (!state.onboarded && !state.messages.length) {
          renderOnboardingIntro();
          scrollToBottom();
          return;
        }
        if (shouldShowMorningBrief()) {
          showMorningBrief();
          return;
        }
        scrollToBottom();
        if (refs.input) refs.input.focus();
      }, 40);
    } else {
      releaseScrollLock();
    }
  }

  function updatePersonalityBadge() {
    if (!refs.badge) return;
    if (!state.personalityChosen) { refs.badge.classList.remove('show'); return; }
    const meta = getSelectedPersonalityMeta();
    refs.badge.querySelector('.label').innerHTML =
      `${escapeHtml(meta.icon)} ${escapeHtml(meta.title)}`;
    refs.badge.classList.add('show');
  }

  function shouldShowMorningBrief() {
    return !state.briefShown;
  }

  async function showMorningBrief() {
    state.briefShown = true;

    refs.messages.innerHTML = `
      <div id="nabad-morning-brief">
        <div class="nabad-brief-hero">
          <div class="nabad-brief-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <div class="nabad-brief-title">☀️ Good morning</div>
          <div class="nabad-brief-subtitle">Getting your brief ready...</div>
        </div>
        <div class="nabad-brief-loading">
          <span class="nabad-dots"><span></span><span></span><span></span></span>
        </div>
      </div>
    `;
    scrollToBottom();

    try {
      const profile = buildProfileSummary();
      const lastMessages = state.messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');
      const hour = new Date().getHours();
      const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const month = new Date().getMonth() + 1;
      const quarter = Math.ceil(month / 3);

      const seasonHint =
        month === 3 || month === 4 ? 'Q2 UAE — slower season, good for building systems' :
        month >= 6 && month <= 8   ? 'UAE summer — decision makers travelling, internal work season' :
        month === 9 || month === 10 ? 'September–October UAE — strongest sales window of the year' :
        month === 11 || month === 12 ? 'Q4 — year end push, budgets being spent or frozen' :
        'New year energy — high momentum window';

      const resp = await fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Generate a morning brief for this founder. Return ONLY valid JSON, no markdown, no explanation:
{
  "greeting": "personal one-line greeting using their name or business if known",
  "focus": "their single most important focus for today based on their profile and last conversation — 2 sentences max",
  "pulse": "one market or timing insight relevant to their business and current season — 2 sentences max",
  "question": "one powerful question that will make them think differently today — max 15 words"
}

Founder profile: ${profile}
Last conversation: ${lastMessages}
Today: ${day}, Q${quarter}
Season context: ${seasonHint}
Time: ${hour}:00`
            }
          ],
          personality: 'auto',
          userProfile: profile,
          morningBrief: true
        })
      });

      const data = await resp.json().catch(() => ({}));
      let brief = null;

      try {
        const raw = data?.reply || '';
        const stripped = raw.replace(/<[^>]+>/g, '').trim();
        const match = stripped.match(/\{[\s\S]*\}/);
        if (match) brief = JSON.parse(match[0]);
      } catch { brief = null; }

      refs.messages.innerHTML = `
        <div id="nabad-morning-brief">
          <div class="nabad-brief-hero">
            <div class="nabad-brief-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <div class="nabad-brief-title">☀️ Morning Brief</div>
            <div class="nabad-brief-greeting">${escapeHtml(brief?.greeting || "Good morning — here's your focus for today.")}</div>
          </div>

          <div class="nabad-brief-card nabad-brief-focus">
            <div class="nabad-brief-card-label">📍 Your Focus Today</div>
            <div class="nabad-brief-card-text">${escapeHtml(brief?.focus || 'Start with the one thing that moves the needle most.')}</div>
          </div>

          <div class="nabad-brief-card nabad-brief-pulse">
            <div class="nabad-brief-card-label">⚡ Market Pulse</div>
            <div class="nabad-brief-card-text">${escapeHtml(brief?.pulse || 'Q2 is a window — use it to build, not just chase.')}</div>
          </div>

          <div class="nabad-brief-card nabad-brief-question">
            <div class="nabad-brief-card-label">🎯 One Question</div>
            <div class="nabad-brief-card-text nabad-brief-q-text">"${escapeHtml(brief?.question || 'What is the one thing that makes this week a win?')}"</div>
          </div>

          <div class="nabad-brief-actions">
            <button class="nabad-ob-btn" id="nabad-brief-chat" type="button">💬 Let's talk about it</button>
            <button class="nabad-ob-back" id="nabad-brief-skip" type="button">Go to chat →</button>
          </div>
        </div>
      `;

      refs.messages.querySelector('#nabad-brief-chat').addEventListener('click', () => {
        const q = brief?.question || '';
        backToChat();
        if (q) {
          refs.input.value = q;
          refs.input.focus();
        }
      });

      refs.messages.querySelector('#nabad-brief-skip').addEventListener('click', backToChat);
      scrollToBottom();

    } catch {
      backToChat();
    }
  }

  function renderInitialState() {
    refs.messages.innerHTML = '';
    // NEW
if (!state.onboarded && !state.messages.length) {
  renderOnboardingIntro();
  return;
}
    if (!state.personalityChosen && !state.messages.length) {
      renderPersonalityScreen();
      return;
    }
    if (shouldShowMorningBrief()) {
      showMorningBrief();
      return;
    }
    updatePersonalityBadge();
    if (!state.messages.length) {
      renderMessage('assistant', getPersonalityGreeting(state.personality), false);
      return;
    }
    state.messages.forEach(m => renderMessage(m.role, m.content, false));
    scrollToBottom();
  }

function renderOnboardingIntro() {
  document.getElementById('nabad-input-wrap').style.display = 'none';

  refs.messages.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;min-height:100%;background:linear-gradient(160deg,#0a0f1e 0%,#0d1f3c 60%,#0a0f1e 100%);padding:32px 20px 24px;box-sizing:border-box;">

      <!-- Pulsing Logo -->
      <div style="width:78px;height:78px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#06b6d4);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 0 rgba(37,99,235,0.5);animation:nabadBreath 2.4s ease-in-out infinite;margin-bottom:24px;flex-shrink:0;">
        <img src="/logo.png" alt="Nabad" style="width:58px;height:58px;border-radius:50%;object-fit:cover;" />
      </div>

      <!-- Headline -->
      <div style="font-size:26px;font-weight:900;color:#fff;text-align:center;letter-spacing:-0.5px;margin-bottom:8px;line-height:1.2;">Your business,<br/>finally has a co-founder.</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.5);text-align:center;max-width:260px;line-height:1.6;margin-bottom:32px;">Nabad thinks, adapts, and learns — built for people who are serious about building something real.</div>

      <!-- Feature rows -->
      <div style="display:flex;flex-direction:column;gap:14px;width:100%;max-width:320px;margin-bottom:32px;">

        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:42px;height:42px;border-radius:12px;background:rgba(37,99,235,0.15);border:1px solid rgba(37,99,235,0.25);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🧠</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:2px;">Auto-detects your intent</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;">Switches between 7 advisor personalities based on what you need</div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:42px;height:42px;border-radius:12px;background:rgba(6,182,212,0.15);border:1px solid rgba(6,182,212,0.25);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">⚔️</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:2px;">War Room</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;">3 expert advisors debate your toughest decisions simultaneously</div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:42px;height:42px;border-radius:12px;background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.25);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">💾</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:2px;">Remembers everything</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;">Your business, goals, and challenges — saved and used in every reply</div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:42px;height:42px;border-radius:12px;background:rgba(234,179,8,0.15);border:1px solid rgba(234,179,8,0.25);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🌅</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:2px;">Morning Brief</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;">Start every day with a personalised AI briefing built around your context</div>
          </div>
        </div>

      </div>

      <!-- CTA -->
      <button id="nabad-intro-start" style="width:100%;max-width:300px;padding:16px;background:linear-gradient(135deg,#2563eb,#06b6d4);color:#fff;font-size:16px;font-weight:800;border:none;border-radius:16px;cursor:pointer;letter-spacing:0.2px;box-shadow:0 8px 28px rgba(37,99,235,0.35);transition:transform 0.15s ease,box-shadow 0.15s ease;">
        Let's build something →
      </button>

      <div style="margin-top:14px;font-size:11px;color:rgba(255,255,255,0.25);text-align:center;">No credit card · No setup · Just start</div>

    </div>
  `;

  // Button interaction
  const startBtn = document.getElementById('nabad-intro-start');
  if (startBtn) {
    startBtn.addEventListener('mouseenter', () => {
      startBtn.style.transform = 'translateY(-2px)';
      startBtn.style.boxShadow = '0 12px 32px rgba(37,99,235,0.45)';
    });
    startBtn.addEventListener('mouseleave', () => {
      startBtn.style.transform = 'translateY(0)';
      startBtn.style.boxShadow = '0 8px 28px rgba(37,99,235,0.35)';
    });
    startBtn.addEventListener('click', () => {
      renderOnboardingScreen1();
    });
  }

  scrollToBottom();
}

  function renderOnboardingScreen1() {
    document.getElementById('nabad-input-wrap').style.display = 'none';

    refs.messages.innerHTML = `
      <div id="nabad-onboarding">
        <div class="nabad-ob-progress">
          <div class="nabad-ob-dot active"></div>
          <div class="nabad-ob-dot"></div>
          <div class="nabad-ob-dot"></div>
        </div>
        <h3>Welcome to Nabad 👋</h3>
        <p>Where are you at right now?</p>
        <div class="nabad-path-grid">
          ${ONBOARDING_PATHS.map(p => `
            <button class="nabad-path-card" data-path="${p.id}" type="button">
              <div class="nabad-path-icon">${p.icon}</div>
              <div class="nabad-path-text">
                <div class="nabad-path-title">${escapeHtml(p.title)}</div>
                <div class="nabad-path-desc">${escapeHtml(p.desc)}</div>
              </div>
              <div class="nabad-path-arrow">›</div>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    refs.messages.querySelectorAll('.nabad-path-card').forEach(btn => {
      btn.addEventListener('click', () => {
        state.onboardingPath = btn.getAttribute('data-path');
        state.onboardingAnswers = { path: state.onboardingPath };
        renderOnboardingScreen2();
      });
    });

    scrollToBottom();
  }

  function renderOnboardingScreen2() {
    document.getElementById('nabad-input-wrap').style.display = 'none';
    const questions = ONBOARDING_QUESTIONS[state.onboardingPath] || ONBOARDING_QUESTIONS.existing;
    const pathMeta  = ONBOARDING_PATHS.find(p => p.id === state.onboardingPath);

    refs.messages.innerHTML = `
      <div id="nabad-onboarding">
        <div class="nabad-ob-progress">
          <div class="nabad-ob-dot"></div>
          <div class="nabad-ob-dot active"></div>
          <div class="nabad-ob-dot"></div>
        </div>
        <h3>${pathMeta?.icon || ''} Tell me about yourself</h3>
        <p>Just a few quick questions so Nabad can give you advice that actually fits your situation.</p>
        <div class="nabad-questions-form">
          ${questions.map(q => `
            <div class="nabad-question-field">
              <label class="nabad-question-label">${escapeHtml(q.label)}</label>
              <input
                class="nabad-question-input"
                type="text"
                data-key="${escapeHtml(q.key)}"
                placeholder="${escapeHtml(q.placeholder)}"
                autocomplete="off"
              />
            </div>
          `).join('')}
          <button class="nabad-ob-btn" id="nabad-ob-next" type="button">Continue →</button>
          <button class="nabad-ob-back" id="nabad-ob-back" type="button">← Go back</button>
          <button class="nabad-ob-skip" id="nabad-ob-skip" type="button">Skip for now</button>
        </div>
      </div>
    `;

    refs.messages.querySelector('#nabad-ob-next').addEventListener('click', () => {
      const inputs = refs.messages.querySelectorAll('.nabad-question-input');
      inputs.forEach(input => {
        const key = input.getAttribute('data-key');
        const val = input.value.trim();
        if (key && val) state.onboardingAnswers[key] = val;
      });
      state.userProfile = { ...state.onboardingAnswers };
      saveUserProfile(state.userProfile);
      triggerNabadDetected(null);
      renderOnboardingScreen3();
    });

    refs.messages.querySelector('#nabad-ob-back').addEventListener('click', () => {
      renderOnboardingScreen1();
    });

    refs.messages.querySelector('#nabad-ob-skip').addEventListener('click', () => {
      state.userProfile = { path: state.onboardingPath };
      saveUserProfile(state.userProfile);
      renderOnboardingScreen3();
    });

    scrollToBottom();
  }

  function renderPersonalityScreen() {
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
                ${p.icon}
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
        state.personality       = btn.getAttribute('data-personality') || 'auto';
        state.personalityChosen = true;
        state.onboarded         = true;
        savePersonality(state.personality);
        saveOnboarded();
        updatePersonalityBadge();
        setInputPlaceholder();
        applyPersonalityColor(state.personality, false);
        refs.messages.innerHTML = '';
        renderMessage('assistant', getPersonalityGreeting(state.personality), false);
        setTimeout(() => { refs.input.focus(); scrollToBottom(); }, 50);
      });
    });

    scrollToBottom();
  }

  function renderOnboardingScreen3() {
    document.getElementById('nabad-input-wrap').style.display = 'none';
    refs.messages.innerHTML = `
      <div id="nabad-onboarding">
        <div class="nabad-ob-progress">
          <div class="nabad-ob-dot"></div>
          <div class="nabad-ob-dot"></div>
          <div class="nabad-ob-dot active"></div>
        </div>
        <h3>How should Nabad advise you?</h3>
        <p>Pick the style that fits you best. You can always change it later.</p>
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
        state.personality       = btn.getAttribute('data-personality') || 'auto';
        state.personalityChosen = true;
        state.onboarded         = true;
        savePersonality(state.personality);
        saveOnboarded();
        updatePersonalityBadge();
        setInputPlaceholder();
        applyPersonalityColor(state.personality, false);
        refs.messages.innerHTML = '';
        renderMessage('assistant', getPersonalityGreeting(state.personality), false);
        setTimeout(() => { refs.input.focus(); scrollToBottom(); }, 50);
      });
    });

    scrollToBottom();
  }

  // ── IMAGE LOADING PLACEHOLDER ─────────────────────────────────
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
      if (seconds > 0) countdown.textContent = String(seconds);
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

  function markdownToHtml(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  // ── RENDER MESSAGE ────────────────────────────────────────────
  function renderMessage(role, content, persist = true) {
    document.getElementById('nabad-input-wrap').style.display = 'flex';
    const isUser = role === 'user';
    const msg    = document.createElement('div');
    msg.className = `nabad-msg ${isUser ? 'user' : 'bot'}`;

    const bubble = document.createElement('div');
    bubble.className = 'nabad-bubble';

    if (isUser) {
      bubble.innerHTML = `<p>${escapeHtml(String(content || '')).replace(/\n/g, '<br>')}</p>`;
    } else {
      bubble.innerHTML = sanitizeHtml(
        markdownToHtml(String(content || '<p>Sorry — I could not generate a response.</p>'))
      );
    }

    msg.appendChild(bubble);
    refs.messages.appendChild(msg);

    if (!isUser) {
      processAssistantBubble(bubble);

      // ── Speaker button ──
      const speakerBtn = document.createElement('button');
      speakerBtn.className = 'nabad-speaker-btn';
      speakerBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
      speakerBtn.title = 'Tap to hear this reply';
      speakerBtn.addEventListener('click', () => {
        if (currentAudio && !currentAudio.paused) {
          currentAudio.pause();
          currentAudio = null;
          speakerBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
          speakerBtn.classList.remove('playing');
        } else {
          speakReply(content, speakerBtn);
        }
      });

      // ── Save to memory button ──
      const memoryBtn = document.createElement('button');
      memoryBtn.className = 'nabad-memory-btn';
      memoryBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`;
      memoryBtn.title = 'Save this insight to memory';
      memoryBtn.addEventListener('click', async () => {
        if (memoryBtn.dataset.saved === 'true') return;
        memoryBtn.innerHTML = `<span class="nabad-loading-dots"><span></span><span></span><span></span></span>`;

        try {
          const clean = content.replace(/<[^>]+>/g, '').trim().slice(0, 500);
          const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'user', content: `Summarize this advice in maximum 8 words, no punctuation at the end:\n\n${clean}` }
              ],
              personality: 'auto'
            })
          });
          const data = await resp.json();
          const summary = (data.reply || '').replace(/<[^>]+>/g, '').trim().slice(0, 80);

          if (summary) {
            const insights = JSON.parse(localStorage.getItem('nabad_insights') || '[]');
            insights.push({ text: summary, date: new Date().toLocaleDateString() });
            localStorage.setItem('nabad_insights', JSON.stringify(insights.slice(-20)));
          }

          memoryBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
          memoryBtn.dataset.saved = 'true';
          memoryBtn.title = 'Saved to memory!';

        } catch {
  memoryBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`;
}
      });

      const btnRow = document.createElement('div');
      btnRow.className = 'nabad-btn-row';
      btnRow.appendChild(speakerBtn);
      btnRow.appendChild(memoryBtn);
      bubble.appendChild(btnRow);
    }

    if (persist) {
      state.messages.push({ role, content });
      saveMessages();
    }

    scrollToBottom();
    return bubble;
  }

  // ── PROCESS ASSISTANT BUBBLE (cards, images, score bars) ─────
  function processAssistantBubble(bubble) {
    // Score bars
    bubble.querySelectorAll('.nabad-score-bar-fill').forEach(bar => {
      const target = parseFloat(bar.dataset.score || '0');
      bar.style.setProperty('--nabad-score-target', `${target}%`);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { bar.style.width = `${target}%`; });
      });
    });

    // Image placeholders
    bubble.querySelectorAll('img[data-nabad-source]').forEach(img => {
      const src    = img.getAttribute('data-nabad-source') || img.src;
      const model  = img.getAttribute('data-nabad-model')  || 'pollinations';
      const prompt = img.getAttribute('data-nabad-prompt') || '';

      const placeholder = createImagePlaceholder();
      img.replaceWith(placeholder);

      const realImg = new Image();
      realImg.onload = () => {
        realImg.className = 'nabad-bubble-img';
        realImg.style.cssText = 'display:block;width:100%;max-width:100%;border-radius:16px;margin-top:6px;cursor:zoom-in;';
        realImg.alt   = prompt || 'Generated image';
        realImg.title = 'Click to enlarge';
        realImg.addEventListener('click', () => openImageLightbox(src));
        removePlaceholder(placeholder);
        placeholder.replaceWith(realImg);
        scrollToBottom();
      };
      realImg.onerror = () => {
        const errMsg = document.createElement('p');
        errMsg.style.cssText = 'color:#ef4444;font-size:13px;margin:6px 0;';
        errMsg.textContent = '⚠️ Image could not be loaded.';
        removePlaceholder(placeholder);
        placeholder.replaceWith(errMsg);
      };
      realImg.src = src;
    });

    // Regular images — add lightbox click
    bubble.querySelectorAll('img:not([data-nabad-source])').forEach(img => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => openImageLightbox(img.src));
    });

    // Open links in new tab
    bubble.querySelectorAll('a[href]').forEach(a => {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });
  }

  // ── IMAGE LIGHTBOX ────────────────────────────────────────────
  function openImageLightbox(src) {
    if (!src) return;
    currentLightboxSrc = src;
    refs.lightboxImg.src = src;
    refs.lightbox.classList.add('open');
    applyScrollLock();
  }

  function closeImageLightbox() {
    refs.lightbox.classList.remove('open');
    refs.lightboxImg.src = '';
    currentLightboxSrc = '';
    if (state.open) applyScrollLock();
    else releaseScrollLock();
  }

  // ── SCROLL ───────────────────────────────────────────────────
  function scrollToBottom() {
    if (!refs.messages) return;
    requestAnimationFrame(() => {
      refs.messages.scrollTop = refs.messages.scrollHeight;
    });
  }

  // ── SHOW TYPING ───────────────────────────────────────────────
  function showTyping(on) {
    refs.typing.classList.toggle('show', on);
    if (on) scrollToBottom();
  }

  // ── SEND MESSAGE ──────────────────────────────────────────────
  async function sendMessage() {
    if (state.sending) return;
    const text = (refs.input.value || '').trim();
    if (!text) return;

    refs.input.value = '';
    refs.input.style.height = 'auto';
    _lastScrollHeight = 0;
    state.sending = true;
    refs.send.disabled = true;

    renderMessage('user', text);

    // Logo "thinking" animation
    const logo = document.getElementById('nabad-logo');
    if (logo) logo.classList.add('thinking');

    showTyping(true);

    // Hide warroom suggestion if visible
    const wrSug = document.getElementById('nabad-warroom-suggestion');
    if (wrSug) { wrSug.classList.remove('show'); }

    try {
      const profile  = buildProfileSummary();
      const history  = state.messages.slice(-50).map(m => ({ role: m.role, content: m.content }));

      const resp = await fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages:    history,
          personality: state.personality,
          userProfile: profile
        })
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      showTyping(false);
      if (logo) logo.classList.remove('thinking');

      const reply = data.reply || '<p>Sorry — no response received.</p>';
      renderMessage('assistant', reply);

      // ── Handle detectedInfo ──
if (data.detectedInfo && typeof data.detectedInfo === 'object') {
  const info = data.detectedInfo;
  let profileUpdated = false;

  const fieldsToCapture = [
    'businessName', 'location', 'whatYouSell', 'revenue',
    'biggestChallenge', 'targetCustomer', 'ideaSummary',
    'currentProgress', 'biggestBlock', 'skills',
    'problems', 'preference', 'timeCommitment', 'industry'
  ];

  fieldsToCapture.forEach(field => {
    if (info[field] && !state.userProfile[field]) {
      state.userProfile[field] = info[field];
      profileUpdated = true;
    }
  });

  if (profileUpdated) {
    saveUserProfile(state.userProfile);
    showProfileUpdateToast(info);
  }
}

      // ── Handle suggestWarRoom ──
      if (data.suggestWarRoom) {
        showWarRoomSuggestion(data.suggestWarRoom);
      }

      // ── [PC-1] Handle detectedPersonality (2-message rule) ──
      if (data.detectedPersonality && data.detectedPersonality !== 'auto') {
        const detected = data.detectedPersonality;
        if (detected === state.personalityBuffer) {
          state.personalityCount += 1;
        } else {
          state.personalityBuffer = detected;
          state.personalityCount  = 1;
        }

        if (state.personalityCount >= 2 && detected !== state.personality) {
          const prevPersonality = state.personality;
          state.personality      = detected;
          state.personalityCount = 0;
          state.personalityBuffer = null;
          savePersonality(state.personality);
          setInputPlaceholder();
          updatePersonalityBadge();
          applyPersonalityColor(detected, prevPersonality !== 'auto');
        }
      }

    } catch (err) {
      showTyping(false);
      if (logo) logo.classList.remove('thinking');
      console.error('[NABAD] sendMessage error:', err);
      renderMessage('assistant', '<p>⚠️ Something went wrong. Please try again.</p>');
    } finally {
  state.sending = false;
  refs.send.disabled = false;
  refs.send.style.opacity = '1';
  refs.send.style.cursor = 'pointer';
  const micBtn = document.getElementById('nabad-mic');
  if (micBtn) {
    micBtn.disabled = false;
    micBtn.style.opacity = '1';
    micBtn.style.cursor = 'pointer';
  }
  refs.input.focus();
 }
}
  // ── WAR ROOM SUGGESTION BANNER ────────────────────────────────
  function showWarRoomSuggestion(situation) {
    let banner = document.getElementById('nabad-warroom-suggestion');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'nabad-warroom-suggestion';
      banner.innerHTML = `
        <span id="nabad-warroom-text"></span>
        <button id="nabad-warroom-open" type="button">Open War Room</button>
        <button id="nabad-warroom-dismiss" type="button">✕</button>
      `;
      refs.typing.after(banner);
      banner.querySelector('#nabad-warroom-open').addEventListener('click', () => {
        banner.classList.remove('show');
        openWarRoom(situation);
      });
      banner.querySelector('#nabad-warroom-dismiss').addEventListener('click', () => {
        banner.classList.remove('show');
      });
    }
    banner.querySelector('#nabad-warroom-text').textContent =
      `⚔️ This looks strategic — open the War Room?`;
    setTimeout(() => banner.classList.add('show'), 100);
    setTimeout(() => banner.classList.remove('show'), 8000);
  }

  // ── WAR ROOM ─────────────────────────────────────────────────
  async function openWarRoom(prefillSituation = '') {
    state.warRoom = true;
    document.getElementById('nabad-input-wrap').style.display = 'none';

    refs.messages.innerHTML = `
      <div id="nabad-warroom-screen">
        <div class="nabad-wr-header">
          <div class="nabad-wr-icon">⚔️</div>
          <h3>War Room</h3>
          <p>Bring your toughest business challenge.<br>Get 3 expert perspectives simultaneously.</p>
          ${prefillSituation ? `<p class="nabad-wr-situation">"${escapeHtml(prefillSituation)}"</p>` : ''}
        </div>
        <div class="nabad-wr-input-block">
          <textarea id="nabad-wr-input" rows="3" placeholder="Describe the situation, decision, or problem you're facing...">${escapeHtml(prefillSituation)}</textarea>
          <button class="nabad-ob-btn" id="nabad-wr-go" type="button">⚔️ Launch War Room</button>
          <button class="nabad-ob-back" id="nabad-wr-back" type="button">← Back to chat</button>
        </div>
        <div id="nabad-wr-advisors"></div>
      </div>
    `;

    refs.messages.querySelector('#nabad-wr-back').addEventListener('click', backToChat);
    refs.messages.querySelector('#nabad-wr-go').addEventListener('click', async () => {
      const situation = (refs.messages.querySelector('#nabad-wr-input').value || '').trim();
      if (!situation) return;
      await runWarRoom(situation);
    });

    // Auto-launch if situation already provided
    if (prefillSituation.trim()) {
      await runWarRoom(prefillSituation.trim());
    }

    scrollToBottom();
  }

  const WAR_ROOM_ADVISORS = [
    { id: 'strategist',    icon: '🧠', name: 'The Strategist',    desc: 'Long-term positioning & decisions' },
    { id: 'growth',        icon: '📈', name: 'The Growth Hacker',  desc: 'Fast traction & momentum'          },
    { id: 'straight_talk', icon: '🎯', name: 'The Straight Talker', desc: 'Brutal honesty & reality check'   }
  ];

  async function runWarRoom(situation) {
    const advisorsEl = document.getElementById('nabad-wr-advisors');
    if (!advisorsEl) return;

    advisorsEl.innerHTML = WAR_ROOM_ADVISORS.map(a => `
      <div class="nabad-wr-card" id="nabad-wr-card-${a.id}">
        <div class="nabad-wr-card-header">
          <div class="nabad-wr-card-icon">${a.icon}</div>
          <div>
            <div class="nabad-wr-card-name">${escapeHtml(a.name)}</div>
            <div class="nabad-wr-card-desc">${escapeHtml(a.desc)}</div>
          </div>
        </div>
        <div class="nabad-wr-card-reply">
          <span class="nabad-dots"><span></span><span></span><span></span></span>
        </div>
      </div>
    `).join('');

    scrollToBottom();

    const profile = buildProfileSummary();

    await Promise.all(WAR_ROOM_ADVISORS.map(async advisor => {
      try {
        const resp = await fetch(CONFIG.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: situation }],
            personality: advisor.id,
            userProfile: profile,
            warRoom: true
          })
        });
        const data = await resp.json();
        const card = document.getElementById(`nabad-wr-card-${advisor.id}`);
        if (card) {
          card.querySelector('.nabad-wr-card-reply').innerHTML =
            sanitizeHtml(markdownToHtml(data.reply || 'No response.'));
        }
      } catch {
        const card = document.getElementById(`nabad-wr-card-${advisor.id}`);
        if (card) {
          card.querySelector('.nabad-wr-card-reply').textContent = '⚠️ Could not get a response.';
        }
      }
      scrollToBottom();
    }));
  }

  // ── BACK TO CHAT ─────────────────────────────────────────────
  function backToChat() {
    state.warRoom = false;
    document.getElementById('nabad-input-wrap').style.display = 'flex';
    refs.messages.innerHTML = '';
    updatePersonalityBadge();
    if (!state.messages.length) {
      renderMessage('assistant', getPersonalityGreeting(state.personality), false);
    } else {
      state.messages.slice(-50).forEach(m => renderMessage(m.role, m.content, false));
    }
    scrollToBottom();
    refs.input.focus();
  }

  // ── NEW CHAT ──────────────────────────────────────────────────
  function newChat() {
    confirmAction('Start a new conversation? This will clear the current chat.', () => {
      state.messages      = [];
      state.briefShown    = false;
      state.warRoom       = false;
      saveMessages();
      refs.messages.innerHTML = '';
      document.getElementById('nabad-input-wrap').style.display = 'flex';
      renderMessage('assistant', getPersonalityGreeting(state.personality), false);
      scrollToBottom();
      refs.input.focus();
    });
  }

  // ── CHANGE PERSONALITY ────────────────────────────────────────
  function changePersonality() {
    document.getElementById('nabad-input-wrap').style.display = 'none';
    refs.messages.innerHTML = `
      <div id="nabad-onboarding">
        <h3>Switch your advisor</h3>
        <p>Pick how you want Nabad to think and respond.</p>
        <div class="nabad-personality-grid">
          ${PERSONALITIES.map(p => `
            <button
              class="nabad-personality-card ${state.personality === p.id ? 'active' : ''}"
              data-personality="${p.id}"
              type="button"
            >
              <div class="nabad-personality-title">
                ${p.icon}
                <span>${escapeHtml(p.title)}</span>
              </div>
              <div class="nabad-personality-desc">${escapeHtml(p.desc)}</div>
            </button>
          `).join('')}
        </div>
        <button class="nabad-ob-back" id="nabad-change-back" type="button" style="margin-top:12px">← Back to chat</button>
      </div>
    `;

    refs.messages.querySelectorAll('.nabad-personality-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const newId = btn.getAttribute('data-personality') || 'auto';
        const prev  = state.personality;
        state.personality       = newId;
        state.personalityChosen = true;
        state.personalityBuffer = null;
        state.personalityCount  = 0;
        savePersonality(newId);
        updatePersonalityBadge();
        setInputPlaceholder();
        applyPersonalityColor(newId, prev !== newId);
        backToChat();
      });
    });

    refs.messages.querySelector('#nabad-change-back')
      .addEventListener('click', backToChat);

    scrollToBottom();
  }

  // ── OPTIONS POPUP ─────────────────────────────────────────────
  function showOptionsPopup() {
    let popup = document.getElementById('nabad-options-popup');
    if (popup) { popup.classList.toggle('show'); return; }

    popup = document.createElement('div');
    popup.id = 'nabad-options-popup';
    popup.className = 'nabad-options-popup';
    popup.innerHTML = `
      <button class="nabad-options-btn" id="nabad-opt-new"      type="button">💬 New Chat</button>
      <button class="nabad-options-btn" id="nabad-opt-persona"  type="button">🧠 Change Advisor</button>
      <button class="nabad-options-btn" id="nabad-opt-memory"   type="button">📚 My Memory</button>
      <button class="nabad-options-btn" id="nabad-opt-warroom"  type="button">⚔️ War Room</button>
      <div class="nabad-options-divider"></div>
      <button class="nabad-options-btn danger" id="nabad-opt-reset" type="button">🗑️ Reset Everything</button>
    `;

    refs.panel.appendChild(popup);

    popup.querySelector('#nabad-opt-new').addEventListener('click', () => {
      popup.classList.remove('show'); newChat();
    });
    popup.querySelector('#nabad-opt-persona').addEventListener('click', () => {
      popup.classList.remove('show'); changePersonality();
    });
    popup.querySelector('#nabad-opt-memory').addEventListener('click', () => {
      popup.classList.remove('show'); showMemoryScreen();
    });
    popup.querySelector('#nabad-opt-warroom').addEventListener('click', () => {
      popup.classList.remove('show'); openWarRoom('');
    });
    popup.querySelector('#nabad-opt-reset').addEventListener('click', () => {
      popup.classList.remove('show');
      confirmAction('Reset everything? This will clear all messages, memory, and your profile.', () => {
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        localStorage.removeItem('nabad_insights');
        state.messages          = [];
        state.personality       = 'auto';
        state.personalityChosen = false;
        state.onboarded         = false;
        state.userProfile       = {};
        state.briefShown        = false;
        state.personalityBuffer = null;
        state.personalityCount  = 0;
        refs.messages.innerHTML = '';
        document.getElementById('nabad-input-wrap').style.display = 'flex';
        updatePersonalityBadge();
        applyPersonalityColor('auto', false);
        setInputPlaceholder();
        renderOnboardingScreen1();
      });
    });

    // Close popup when clicking outside
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!popup.contains(e.target) && e.target.id !== 'nabad-new-chat') {
          popup.classList.remove('show');
          document.removeEventListener('click', handler);
        }
      });
    }, 50);

    popup.classList.add('show');
  }

  // ── MEMORY SCREEN ─────────────────────────────────────────────
  function showMemoryScreen() {
    document.getElementById('nabad-input-wrap').style.display = 'none';
    const insights = JSON.parse(localStorage.getItem('nabad_insights') || '[]');
    const profile  = state.userProfile || {};

    refs.messages.innerHTML = `
      <div id="nabad-onboarding">
        <h3>📚 Your Memory</h3>
        <p>Everything Nabad remembers about you.</p>

        ${Object.keys(profile).length ? `
          <div style="margin-bottom:16px;">
            <div class="nabad-brief-card-label" style="margin-bottom:8px;">👤 Your Profile</div>
            ${Object.entries(profile)
              .filter(([k]) => k !== 'path')
              .map(([k, v]) => `
                <div style="padding:8px 12px;margin-bottom:6px;background:#f8faff;border-radius:10px;border:1px solid rgba(37,99,235,0.08);font-size:13px;color:#334155;">
                  <strong style="color:#0f172a;text-transform:capitalize">${escapeHtml(k.replace(/([A-Z])/g, ' $1'))}:</strong>
                  ${escapeHtml(String(v))}
                </div>
              `).join('')}
          </div>
        ` : ''}

        ${insights.length ? `
          <div>
            <div class="nabad-brief-card-label" style="margin-bottom:8px;">💡 Saved Insights (${insights.length})</div>
            ${insights.slice().reverse().map((ins, i) => `
              <div style="padding:8px 12px;margin-bottom:6px;background:#f0fdf4;border-radius:10px;border:1px solid rgba(34,197,94,0.12);font-size:13px;color:#14532d;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <span>✓ ${escapeHtml(ins.text)}</span>
                <span style="font-size:11px;color:#86efac;white-space:nowrap;margin-top:1px">${escapeHtml(ins.date || '')}</span>
              </div>
            `).join('')}
          </div>
        ` : `<p style="color:#94a3b8;font-size:13px;text-align:center;padding:16px 0;">No saved insights yet.<br>Tap the 👍 button on any response to save it.</p>`}

        <button class="nabad-ob-back" id="nabad-memory-back" type="button" style="margin-top:16px">← Back to chat</button>
      </div>
    `;

    refs.messages.querySelector('#nabad-memory-back')
      .addEventListener('click', backToChat);

    scrollToBottom();
  }

  // ── TRIGGER NABAD DETECTED ANIMATION ─────────────────────────
  function triggerNabadDetected(personalityId) {
    const logo = document.getElementById('nabad-logo');
    if (!logo) return;
    logo.classList.remove('nabad-logo-pulse');
    void logo.offsetWidth; // reflow
    logo.classList.add('nabad-logo-pulse');
    logo.addEventListener('animationend', () => {
      logo.classList.remove('nabad-logo-pulse');
    }, { once: true });
  }

  // ── SPEECH SYNTHESIS / VOICE ──────────────────────────────────
  let currentAudio  = null;
  let mediaRecorder = null;
  let audioChunks   = [];
  let voiceTimer    = null;
  let voiceSeconds  = 0;

  async function speakReply(text, btn) {
  if (!text) return;
  const clean = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!clean) return;

  // Show loading state
  btn.innerHTML = `<span class="nabad-loading-dots"><span></span><span></span><span></span></span>`;
  btn.classList.add('playing');

  try {
    const resp = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean })
    });

    if (!resp.ok) throw new Error('TTS failed');

    const blob = await resp.blob();
    const url  = URL.createObjectURL(blob);

    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    currentAudio = new Audio(url);

    // Show wave animation while playing
    btn.innerHTML = `
      <div class="nabad-wave-anim">
        <span></span><span></span><span></span><span></span><span></span>
      </div> Stop`;

    currentAudio.play();

    currentAudio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
      btn.classList.remove('playing');
    };

    currentAudio.onerror = () => {
      currentAudio = null;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
      btn.classList.remove('playing');
    };

  } catch (err) {
    console.error('[NABAD] TTS error:', err);
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
    btn.classList.remove('playing');
  }
}

  async function startVoiceRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Voice recording is not supported in your browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks  = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        await transcribeAudio(blob);
      };

      mediaRecorder.start(200);

      const micBtn = document.getElementById('nabad-mic');
      if (micBtn) micBtn.classList.add('recording');
      document.getElementById('nabad-voice-status')?.classList.add('show');

      voiceSeconds = 0;
      const timerEl = document.getElementById('nabad-voice-timer');
      voiceTimer = setInterval(() => {
        voiceSeconds++;
        const m = Math.floor(voiceSeconds / 60);
        const s = String(voiceSeconds % 60).padStart(2, '0');
        if (timerEl) timerEl.textContent = `${m}:${s}`;
        if (voiceSeconds >= 60) stopVoiceRecording();
      }, 1000);

    } catch (err) {
      console.error('[NABAD] Microphone error:', err);
      alert('Could not access microphone. Please check your permissions.');
    }
  }

  function stopVoiceRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    clearInterval(voiceTimer);
    voiceTimer = null;

    const micBtn = document.getElementById('nabad-mic');
    if (micBtn) micBtn.classList.remove('recording');
    document.getElementById('nabad-voice-status')?.classList.remove('show');
  }

  async function transcribeAudio(blob) {
  // ── Lock mic only during transcription ──
  const micBtn = document.getElementById('nabad-mic');
  if (micBtn) {
    micBtn.disabled = true;
    micBtn.style.opacity = '0.4';
    micBtn.style.cursor = 'not-allowed';
  }

  // ── Show transcribing bubble immediately ──
  const tempMsg = document.createElement('div');
  tempMsg.className = 'nabad-msg user';
  tempMsg.innerHTML = `
    <div class="nabad-bubble" id="nabad-transcribing-bubble">
      <div style="display:flex;align-items:center;gap:8px;color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;">
        <div class="nabad-wave-anim">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <span>Transcribing...</span>
      </div>
    </div>
  `;
  refs.messages.appendChild(tempMsg);
  scrollToBottom();

  try {
    const formData = new FormData();
    formData.append('audio', blob, 'voice.webm');

    const resp = await fetch('/api/transcribe', { method: 'POST', body: formData });
    const data = await resp.json();
    const transcript = (data.text || '').trim();

    // ── Remove transcribing bubble ──
    tempMsg.remove();

    if (transcript && refs.input) {
      refs.input.value = transcript;
      autoGrowTextarea();
      refs.input.focus();
      // sendMessage() will handle restoring send button in its finally block
      setTimeout(() => sendMessage(), 300);
    } else {
      // No transcript — restore mic manually
      if (micBtn) {
        micBtn.disabled = false;
        micBtn.style.opacity = '1';
        micBtn.style.cursor = 'pointer';
      }
    }

  } catch (err) {
    console.error('[NABAD] Transcription error:', err);
    tempMsg.remove();
    // Restore mic on error
    if (micBtn) {
      micBtn.disabled = false;
      micBtn.style.opacity = '1';
      micBtn.style.cursor = 'pointer';
    }
  }
}

// ── PROFILE UPDATE TOAST ──────────────────────────────────────
function showProfileUpdateToast(info) {
  const FIELD_LABELS = {
    businessName:     'your business name',
    location:         'your location',
    whatYouSell:      'what you sell',
    revenue:          'your revenue',
    biggestChallenge: 'your challenge',
    targetCustomer:   'your target customer',
    ideaSummary:      'your idea',
    currentProgress:  'your progress',
    biggestBlock:     'your blocker',
    skills:           'your skills',
    problems:         'problems you notice',
    preference:       'your preference',
    timeCommitment:   'your availability',
    industry:         'your industry'
  };

  const learned = Object.keys(info)
    .filter(k => FIELD_LABELS[k] && info[k])
    .map(k => FIELD_LABELS[k]);

  if (!learned.length) return;

  const label = learned.length === 1
    ? `📌 Nabad noted ${learned[0]}`
    : `📌 Nabad noted ${learned.slice(0, 2).join(' & ')}`;

  // Remove existing toast if any
  const existing = document.getElementById('nabad-profile-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'nabad-profile-toast';
  toast.style.cssText = [
    'position:absolute',
    'bottom:80px',
    'left:50%',
    'transform:translateX(-50%) translateY(10px)',
    `background:linear-gradient(135deg,${PERSONALITY_COLORS[state.personality]?.pulse || '#0f172a'},${PERSONALITY_COLORS[state.personality]?.border || '#1e3a5f'})`,
    'color:#fff',
    'font-size:12px',
    'font-weight:700',
    'padding:8px 16px',
    'border-radius:999px',
    'box-shadow:0 4px 18px rgba(0,0,0,0.22)',
    'opacity:0',
    'transition:opacity 0.3s ease,transform 0.3s ease',
    'pointer-events:none',
    'z-index:9999',
    'white-space:nowrap',
    'display:flex',
    'align-items:center',
    'gap:6px'
  ].join(';');

  toast.innerHTML = `
    <span>${label}</span>
    <span style="opacity:0.6;font-size:11px;font-weight:500">→ Memory</span>
  `;

  refs.panel.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
  });

  // Fade out after 4 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// ── SEND STATE MANAGER ─────────────────────────────────────────
function setSendState(stateLabel) {
  const sendBtn = refs.send;
  const micBtn  = document.getElementById('nabad-mic');

  const states = {
    idle: {
      sendDisabled: false, sendOpacity: '1',   sendCursor: 'pointer',     sendTitle: 'Send',
      micDisabled:  false, micOpacity:  '1',   micCursor:  'pointer'
    },
    transcribing: {
      sendDisabled: true,  sendOpacity: '0.4', sendCursor: 'not-allowed', sendTitle: 'Transcribing voice…',
      micDisabled:  true,  micOpacity:  '0.4', micCursor:  'not-allowed'
    },
    thinking: {
      sendDisabled: true,  sendOpacity: '0.4', sendCursor: 'not-allowed', sendTitle: 'Nabad is thinking…',
      micDisabled:  true,  micOpacity:  '0.4', micCursor:  'not-allowed'
    },
    speaking: {
      sendDisabled: true,  sendOpacity: '0.4', sendCursor: 'not-allowed', sendTitle: 'Nabad is speaking…',
      micDisabled:  true,  micOpacity:  '0.4', micCursor:  'not-allowed'
    }
  };

  const s = states[stateLabel] || states.idle;

  if (sendBtn) {
    sendBtn.disabled      = s.sendDisabled;
    sendBtn.style.opacity = s.sendOpacity;
    sendBtn.style.cursor  = s.sendCursor;
    sendBtn.title         = s.sendTitle;
  }
  if (micBtn) {
    micBtn.disabled      = s.micDisabled;
    micBtn.style.opacity = s.micOpacity;
    micBtn.style.cursor  = s.micCursor;
  }
}

  // ── LAUNCHER CLICK ────────────────────────────────────────────
  function bindLauncherClick() {
    if (refs.launcher) {
      refs.launcher.addEventListener('click', () => toggleWidget(true));
    }
  }

  // ── INIT ─────────────────────────────────────────────────────
  loadDOMPurify(() => {
    injectStyles();
    buildShell();
    bindLauncherClick();
  });

})();
