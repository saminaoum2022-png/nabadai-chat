(() => {
  if (window.__NABAD_WIDGET_LOADED__) return;
  window.__NABAD_WIDGET_LOADED__ = true;

  // ── DOMPurify Loader ──────────────────────────────────────────────────────
  function loadDOMPurify(cb) {
    if (window.DOMPurify) { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/dompurify@3.3.3/dist/purify.min.js';
    s.crossOrigin = 'anonymous';
    s.onload = cb;
    s.onerror = () => { console.warn('[NABAD] DOMPurify failed to load — HTML will be text-only.'); cb(); };
    document.head.appendChild(s);
  }

  const PURIFY_CONFIG = {
    ALLOWED_TAGS: [
      'p','b','i','strong','em','h3','h4','ul','ol','li','a','br','img',
      'span','div','table','thead','tbody','tr','th','td'
    ],
    ALLOWED_ATTR: [
      'href','src','alt','target','rel','class','style',
      'data-nabad-card','data-nabad-brief','data-nabad-source',
      'data-nabad-model','data-nabad-prompt','data-score','data-quadrant'
    ]
  };

  function sanitizeHtml(html) {
    if (window.DOMPurify && window.DOMPurify.sanitize) return window.DOMPurify.sanitize(html, PURIFY_CONFIG);
    return `<p>${escapeHtml(String(html))}</p>`;
  }

  function escapeHtml(str = '') {
    return str
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  // ── Config ────────────────────────────────────────────────────────────────
  const CONFIG = {
    apiUrl: '/api/chat',
    title: 'NabadAi',
    subtitle: 'Business AI',
    launcherLabel: 'Ask Nabad',
    storageNamespace: 'nabad_widget_v5',
    zIndex: 2147483000,
    ...(window.NABAD_WIDGET_CONFIG || {})
  };

  const STORAGE_KEYS = {
    messages:    `${CONFIG.storageNamespace}:messages`,
    personality: `${CONFIG.storageNamespace}:personality`,
    userProfile: `${CONFIG.storageNamespace}:userProfile`,
    onboarded:   `${CONFIG.storageNamespace}:onboarded`
  };

  // ── Personalities ─────────────────────────────────────────────────────────
  const PERSONALITIES = [
    { id:'strategist',    icon:'🧠', title:'Strategist',         desc:'Clear direction, positioning, and smart business decisions' },
    { id:'growth',        icon:'📈', title:'Growth Expert',       desc:'Customer acquisition, conversion, and growth ideas' },
    { id:'branding',      icon:'🎨', title:'Brand Builder',       desc:'Branding, naming, identity, and premium positioning' },
    { id:'offer',         icon:'💼', title:'Offer Architect',     desc:'Offers, pricing, packages, and monetization' },
    { id:'creative',      icon:'⚡', title:'Creative Challenger', desc:'Bold, original, out-of-the-box business thinking' },
    { id:'straight_talk', icon:'🎯', title:'Straight Talk',       desc:'Honest, direct, no-fluff business advice' },
    { id:'auto',          icon:'✨', title:'Let Nabad choose',    desc:'Automatically adapt based on your goal' }
  ];

  // ── Onboarding Data ───────────────────────────────────────────────────────
  const ONBOARDING_PATHS = [
    { id:'existing', icon:'🚀', title:'I have a business',         desc:'Help me grow, fix problems, and scale it' },
    { id:'idea',     icon:'💡', title:'I have an idea',            desc:'Help me validate and build it from scratch' },
    { id:'figuring', icon:'🔍', title:"I'm still figuring it out", desc:'Help me find the right direction for me' }
  ];

  const ONBOARDING_QUESTIONS = {
    existing: [
      { key:'businessName',     label:"What's your business called?",            placeholder:'e.g. Apex Studio' },
      { key:'whatYouSell',      label:'What do you sell and who buys it?',        placeholder:'e.g. Social media management for restaurants' },
      { key:'revenue',          label:"What's your monthly revenue roughly?",     placeholder:'e.g. $3,000/month or just starting' },
      { key:'biggestChallenge', label:"What's your biggest challenge right now?", placeholder:'e.g. Getting more clients, retention, pricing...' }
    ],
    idea: [
      { key:'ideaSummary',     label:'Describe your idea in one sentence',    placeholder:'e.g. A subscription box for specialty coffee' },
      { key:'targetCustomer',  label:'Who would pay for this?',               placeholder:'e.g. Coffee lovers aged 25-40 in the UAE' },
      { key:'currentProgress', label:'Have you made any money from it yet?',  placeholder:'e.g. No / Made $500 testing it' },
      { key:'biggestBlock',    label:"What's stopping you from launching?",   placeholder:"e.g. Not sure if there's demand..." }
    ],
    figuring: [
      { key:'skills',         label:'What are you good at?',                   placeholder:'e.g. Design, sales, cooking, coding...' },
      { key:'problems',       label:'What problems do you notice around you?',  placeholder:'e.g. People waste money on bad marketing' },
      { key:'preference',     label:'Product or service business?',            placeholder:'e.g. Service — I like working with people' },
      { key:'timeCommitment', label:'How much time can you commit per week?',   placeholder:'e.g. 10 hours, full time, evenings only' }
    ]
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const state = {
    open: false,
    sending: false,
    messages: [],
    personality: 'auto',
    onboarded: false,
    userProfile: {},
    onboardingPath: null,
    onboardingAnswers: {}
  };

  const refs = {
    root:null, launcher:null, panel:null, messages:null, onboarding:null,
    input:null, send:null, badge:null, typing:null,
    lightbox:null, lightboxImg:null, lightboxSave:null, lightboxOpen:null, lightboxClose:null
  };

  let currentLightboxSrc = '';

  // ── Storage Helpers ───────────────────────────────────────────────────────
  function loadMessages() {
    try {
      const r = localStorage.getItem(STORAGE_KEYS.messages);
      const p = r ? JSON.parse(r) : [];
      return Array.isArray(p)
        ? p.filter(m => m && (m.role==='user'||m.role==='assistant') && typeof m.content==='string')
        : [];
    } catch { return []; }
  }
  function saveMessages() {
    try { localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(state.messages.slice(-20))); } catch {}
  }
  function loadPersonality() {
    try { return localStorage.getItem(STORAGE_KEYS.personality) || 'auto'; } catch { return 'auto'; }
  }
  function savePersonality(v) {
    try {
      if (!v) { localStorage.removeItem(STORAGE_KEYS.personality); return; }
      localStorage.setItem(STORAGE_KEYS.personality, v);
    } catch {}
  }
  function loadOnboarded() {
    try { return localStorage.getItem(STORAGE_KEYS.onboarded) === 'true'; } catch { return false; }
  }
  function saveOnboarded() {
    try { localStorage.setItem(STORAGE_KEYS.onboarded, 'true'); } catch {}
  }
  function loadUserProfile() {
    try {
      const r = localStorage.getItem(STORAGE_KEYS.userProfile);
      return r ? JSON.parse(r) : {};
    } catch { return {}; }
  }
  function saveUserProfile(p = {}) {
    try { localStorage.setItem(STORAGE_KEYS.userProfile, JSON.stringify(p)); } catch {}
  }
  function clearAllStorage() {
    try {
      localStorage.removeItem(STORAGE_KEYS.messages);
      localStorage.removeItem(STORAGE_KEYS.personality);
      localStorage.removeItem(STORAGE_KEYS.userProfile);
      localStorage.removeItem(STORAGE_KEYS.onboarded);
    } catch {}
  }

  // ── Profile Summary Builder ───────────────────────────────────────────────
  function buildProfileSummary() {
    const p = state.userProfile || {};
    const path = state.onboardingPath || p.path || '';
    const parts = [];
    if (path === 'existing') {
      if (p.businessName)     parts.push(`Business: ${p.businessName}`);
      if (p.whatYouSell)      parts.push(`Sells: ${p.whatYouSell}`);
      if (p.revenue)          parts.push(`Revenue: ${p.revenue}`);
      if (p.biggestChallenge) parts.push(`Challenge: ${p.biggestChallenge}`);
    } else if (path === 'idea') {
      if (p.ideaSummary)     parts.push(`Idea: ${p.ideaSummary}`);
      if (p.targetCustomer)  parts.push(`Target customer: ${p.targetCustomer}`);
      if (p.currentProgress) parts.push(`Progress: ${p.currentProgress}`);
      if (p.biggestBlock)    parts.push(`Blocker: ${p.biggestBlock}`);
    } else if (path === 'figuring') {
      if (p.skills)         parts.push(`Skills: ${p.skills}`);
      if (p.problems)       parts.push(`Noticed problems: ${p.problems}`);
      if (p.preference)     parts.push(`Preference: ${p.preference}`);
      if (p.timeCommitment) parts.push(`Time available: ${p.timeCommitment}`);
    }
    if (p.location) parts.push(`Location: ${p.location}`);
    return parts.join(' | ');
  }

  // ── Greeting Generator ────────────────────────────────────────────────────
  function buildGreeting() {
    const p = state.userProfile || {};
    const path = p.path || state.onboardingPath || '';
    if (path === 'existing' && p.businessName) {
      return `<p>Good to have you here 👊 Let's talk about <strong>${escapeHtml(p.businessName)}</strong> — what's the most pressing thing on your plate right now?</p>`;
    }
    if (path === 'idea' && p.ideaSummary) {
      const short = p.ideaSummary.length > 50 ? p.ideaSummary.slice(0,50)+'...' : p.ideaSummary;
      return `<p>Love the ambition 🚀 "<strong>${escapeHtml(short)}</strong>" has potential — the question is whether the market agrees. What do you want to figure out first?</p>`;
    }
    if (path === 'figuring') {
      return `<p>Most people skip this step and jump straight to building — so you're already ahead 🔍 Tell me what's pulling your attention most right now.</p>`;
    }
    return `<p><strong>Hey, I'm Nabad.</strong> Your business co-founder — direct, opinionated, and actually useful 🔥 What are you working on?</p>`;
  }

  // ── Inject Styles ─────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('nabad-widget-styles')) return;
    const s = document.createElement('style');
    s.id = 'nabad-widget-styles';
    s.textContent = `
      /* ── Reset ── */
      #nabad-root *, #nabad-root *::before, #nabad-root *::after {
        box-sizing: border-box; margin: 0; padding: 0;
      }

      /* ── Launcher ── */
      #nabad-launcher {
        position: fixed; bottom: 24px; right: 24px;
        width: 58px; height: 58px; border-radius: 50%;
        background: linear-gradient(135deg, #6c5ce7, #a855f7);
        border: none; cursor: pointer;
        box-shadow: 0 4px 24px rgba(108,92,231,.55);
        display: flex; align-items: center; justify-content: center;
        z-index: ${CONFIG.zIndex}; font-size: 26px;
        transition: transform .2s, box-shadow .2s;
      }
      #nabad-launcher:hover { transform: scale(1.09); box-shadow: 0 6px 30px rgba(108,92,231,.7); }
      #nabad-launcher.open  { background: linear-gradient(135deg,#e74c3c,#c0392b); }

      /* ── Panel ── */
      #nabad-panel {
        position: fixed; bottom: 92px; right: 24px;
        width: 390px; max-width: calc(100vw - 32px);
        height: 640px; max-height: calc(100vh - 112px);
        background: #0f0f1a; border-radius: 22px;
        border: 1px solid rgba(255,255,255,.08);
        box-shadow: 0 24px 70px rgba(0,0,0,.65);
        display: flex; flex-direction: column; overflow: hidden;
        z-index: ${CONFIG.zIndex};
        opacity: 0; pointer-events: none;
        transform: translateY(18px) scale(.97);
        transition: opacity .25s, transform .25s;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      #nabad-panel.open { opacity: 1; pointer-events: all; transform: translateY(0) scale(1); }

      /* ── Header ── */
      #nabad-header {
        padding: 14px 16px;
        display: flex; align-items: center; justify-content: space-between;
        border-bottom: 1px solid rgba(255,255,255,.07);
        background: linear-gradient(135deg,rgba(108,92,231,.18),rgba(168,85,247,.1));
        flex-shrink: 0;
      }
      #nabad-header-left { display: flex; align-items: center; gap: 10px; }
      #nabad-avatar {
        width: 38px; height: 38px; border-radius: 50%;
        background: linear-gradient(135deg,#6c5ce7,#a855f7);
        display: flex; align-items: center; justify-content: center; font-size: 20px;
        flex-shrink: 0;
      }
      #nabad-title   { font-size: 15px; font-weight: 700; color: #fff; }
      #nabad-subtitle{ font-size: 11px; color: rgba(255,255,255,.5); margin-top: 1px; }
      #nabad-header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
      .nabad-hbtn {
        background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.1);
        color: rgba(255,255,255,.7); border-radius: 8px; padding: 5px 10px;
        font-size: 11px; cursor: pointer; transition: background .15s; white-space: nowrap;
      }
      .nabad-hbtn:hover { background: rgba(255,255,255,.14); color: #fff; }
      #nabad-close-btn {
        background: none; border: none; color: rgba(255,255,255,.5);
        cursor: pointer; font-size: 20px; line-height: 1; padding: 2px 4px;
        transition: color .15s; flex-shrink: 0;
      }
      #nabad-close-btn:hover { color: #fff; }

      /* ── Personality Badge ── */
      #nabad-personality-badge {
        padding: 6px 14px;
        background: rgba(108,92,231,.1);
        border-bottom: 1px solid rgba(255,255,255,.05);
        font-size: 11px; color: rgba(255,255,255,.5);
        display: flex; align-items: center; gap: 6px; flex-shrink: 0;
      }
      #nabad-personality-badge span { color: rgba(255,255,255,.85); font-weight: 600; }

      /* ── Messages ── */
      #nabad-messages {
        flex: 1; overflow-y: auto; padding: 16px 14px;
        display: flex; flex-direction: column; gap: 12px;
        scroll-behavior: smooth;
      }
      #nabad-messages::-webkit-scrollbar { width: 4px; }
      #nabad-messages::-webkit-scrollbar-track { background: transparent; }
      #nabad-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 2px; }

      /* ── Bubbles ── */
      .nabad-bubble {
        max-width: 90%; padding: 11px 14px; border-radius: 16px;
        font-size: 13.5px; line-height: 1.55; word-break: break-word;
        animation: nabad-pop .2s ease;
      }
      @keyframes nabad-pop {
        from { opacity: 0; transform: translateY(7px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .nabad-bubble.user {
        align-self: flex-end;
        background: linear-gradient(135deg,#6c5ce7,#a855f7);
        color: #fff; border-bottom-right-radius: 4px;
      }
      .nabad-bubble.assistant {
        align-self: flex-start;
        background: rgba(255,255,255,.06); color: rgba(255,255,255,.92);
        border-bottom-left-radius: 4px; border: 1px solid rgba(255,255,255,.08);
      }
      .nabad-bubble.assistant p  { margin: 0 0 8px; }
      .nabad-bubble.assistant p:last-child { margin-bottom: 0; }
      .nabad-bubble.assistant ul,
      .nabad-bubble.assistant ol { padding-left: 18px; margin: 6px 0; }
      .nabad-bubble.assistant li { margin-bottom: 4px; }
      .nabad-bubble.assistant strong { color: #fff; }
      .nabad-bubble.assistant em    { color: rgba(255,255,255,.75); }
      .nabad-bubble.assistant h3    { font-size: 14px; margin-bottom: 6px; color: #fff; }
      .nabad-bubble.assistant h4    { font-size: 13px; margin-bottom: 4px; color: rgba(255,255,255,.85); }
      .nabad-bubble.assistant a     { color: #a855f7; text-decoration: none; }
      .nabad-bubble.assistant a:hover { text-decoration: underline; }
      .nabad-bubble.assistant table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
      .nabad-bubble.assistant th,
      .nabad-bubble.assistant td   { padding: 6px 8px; border: 1px solid rgba(255,255,255,.1); text-align: left; }
      .nabad-bubble.assistant th   { background: rgba(255,255,255,.06); color: #fff; }

      /* ── Images ── */
      .nabad-image-wrap { margin: 6px 0; border-radius: 12px; overflow: hidden; }
      .nabad-gen-image  {
        width: 100%; display: block; border-radius: 12px; cursor: pointer;
        transition: opacity .2s; border: 1px solid rgba(255,255,255,.08);
      }
      .nabad-gen-image:hover  { opacity: .88; }
      .nabad-image-caption    { font-size: 11px; color: rgba(255,255,255,.4); margin-top: 5px; }
      .nabad-image-placeholder{
        width: 100%; min-height: 200px;
        background: rgba(255,255,255,.04); border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        color: rgba(255,255,255,.3); font-size: 13px;
        border: 1px dashed rgba(255,255,255,.1);
      }

      /* ── Typing ── */
      #nabad-typing {
        display: none; align-items: center; gap: 4px;
        padding: 10px 14px; align-self: flex-start;
        background: rgba(255,255,255,.06); border-radius: 16px;
        border: 1px solid rgba(255,255,255,.08); border-bottom-left-radius: 4px;
        margin: 0 14px 4px;
      }
      #nabad-typing.show { display: flex; }
      #nabad-typing span {
        width: 7px; height: 7px; border-radius: 50%;
        background: rgba(168,85,247,.8); display: inline-block;
        animation: nabad-bounce 1.2s infinite;
      }
      #nabad-typing span:nth-child(2) { animation-delay: .2s; }
      #nabad-typing span:nth-child(3) { animation-delay: .4s; }
      @keyframes nabad-bounce {
        0%,60%,100% { transform: translateY(0); }
        30%          { transform: translateY(-5px); }
      }

      /* ── Input Area ── */
      #nabad-input-area {
        padding: 12px 14px; border-top: 1px solid rgba(255,255,255,.07);
        display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0;
        background: #0f0f1a;
      }
      #nabad-input {
        flex: 1; background: rgba(255,255,255,.07);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 12px; padding: 10px 13px; color: #fff;
        font-size: 13.5px; resize: none; outline: none;
        font-family: inherit; line-height: 1.45;
        max-height: 120px; min-height: 42px; transition: border-color .15s;
      }
      #nabad-input::placeholder { color: rgba(255,255,255,.28); }
      #nabad-input:focus { border-color: rgba(108,92,231,.65); }
      #nabad-send {
        width: 42px; height: 42px; border-radius: 11px; flex-shrink: 0;
        background: linear-gradient(135deg,#6c5ce7,#a855f7);
        border: none; cursor: pointer; color: #fff; font-size: 18px;
        display: flex; align-items: center; justify-content: center;
        transition: opacity .15s, transform .15s;
      }
      #nabad-send:disabled     { opacity: .4; cursor: not-allowed; transform: none !important; }
      #nabad-send:not(:disabled):hover { opacity: .9; transform: scale(1.05); }

      /* ── Onboarding Panel ── */
      #nabad-onboarding {
        flex: 1; overflow-y: auto; padding: 20px 16px 16px;
        display: none; flex-direction: column; gap: 12px;
      }
      #nabad-onboarding::-webkit-scrollbar { width: 4px; }
      #nabad-onboarding::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 2px; }

      /* Progress dots */
      .nabad-ob-progress { display: flex; gap: 6px; justify-content: center; margin-bottom: 2px; }
      .nabad-ob-dot {
        width: 30px; height: 4px; border-radius: 2px;
        background: rgba(255,255,255,.12); transition: background .3s;
      }
      .nabad-ob-dot.active { background: linear-gradient(90deg,#6c5ce7,#a855f7); }

      .nabad-ob-title { font-size: 18px; font-weight: 700; color: #fff; text-align: center; }
      .nabad-ob-sub   { font-size: 12px; color: rgba(255,255,255,.45); text-align: center; line-height: 1.5; }

      /* Path cards */
      .nabad-path-card {
        background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
        border-radius: 14px; padding: 14px 16px; cursor: pointer;
        display: flex; align-items: center; gap: 14px;
        transition: all .2s; text-align: left;
      }
      .nabad-path-card:hover    { background: rgba(108,92,231,.18); border-color: rgba(108,92,231,.45); transform: translateY(-1px); }
      .nabad-path-card.selected { background: rgba(108,92,231,.25); border-color: #6c5ce7; }
      .nabad-path-icon  { font-size: 28px; flex-shrink: 0; }
      .nabad-path-title { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 3px; }
      .nabad-path-desc  { font-size: 12px; color: rgba(255,255,255,.5); line-height: 1.4; }

      /* Form fields */
      .nabad-ob-field { display: flex; flex-direction: column; gap: 5px; }
      .nabad-ob-label { font-size: 12px; color: rgba(255,255,255,.6); font-weight: 500; }
      .nabad-ob-input {
        width: 100%; background: rgba(255,255,255,.07);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 10px; padding: 10px 12px; color: #fff;
        font-size: 13px; outline: none; font-family: inherit;
        transition: border-color .15s;
      }
      .nabad-ob-input::placeholder { color: rgba(255,255,255,.28); }
      .nabad-ob-input:focus { border-color: rgba(108,92,231,.65); }

      /* Buttons */
      .nabad-ob-btn {
        width: 100%; padding: 13px; border-radius: 12px; border: none;
        cursor: pointer; background: linear-gradient(135deg,#6c5ce7,#a855f7);
        color: #fff; font-size: 14px; font-weight: 600;
        transition: opacity .15s, transform .15s; margin-top: 4px;
      }
      .nabad-ob-btn:hover     { opacity: .9; transform: translateY(-1px); }
      .nabad-ob-btn:disabled  { opacity: .4; cursor: not-allowed; transform: none !important; }
      .nabad-ob-skip {
        background: none; border: none; color: rgba(255,255,255,.3);
        font-size: 12px; cursor: pointer; text-align: center;
        padding: 4px; transition: color .15s; width: 100%;
      }
      .nabad-ob-skip:hover { color: rgba(255,255,255,.6); }

      /* Personality grid */
      .nabad-personality-grid { display: flex; flex-direction: column; gap: 8px; }
      .nabad-p-card {
        background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
        border-radius: 12px; padding: 12px 14px; cursor: pointer;
        display: flex; align-items: center; gap: 12px; transition: all .2s;
      }
      .nabad-p-card:hover    { background: rgba(108,92,231,.18); border-color: rgba(108,92,231,.45); }
      .nabad-p-card.selected { background: rgba(108,92,231,.25); border-color: #6c5ce7; }
      .nabad-p-icon  { font-size: 22px; flex-shrink: 0; }
      .nabad-p-title { font-size: 13px; font-weight: 600; color: #fff; }
      .nabad-p-desc  { font-size: 11px; color: rgba(255,255,255,.5); margin-top: 2px; line-height: 1.4; }

      /* ── Card Styles ── */
      [data-nabad-card] { margin: 4px 0; overflow: hidden; }
      [data-nabad-card] img { max-width: 100%; border-radius: 8px; }

      /* Score bar animation base */
      [data-score] { transition: width .8s ease; }

      /* ── Lightbox ── */
      #nabad-lightbox {
        position: fixed; inset: 0; background: rgba(0,0,0,.93);
        z-index: ${CONFIG.zIndex + 10};
        display: none; flex-direction: column;
        align-items: center; justify-content: center; gap: 18px;
        padding: 20px;
      }
      #nabad-lightbox.open { display: flex; }
      #nabad-lightbox-img  {
        max-width: 94vw; max-height: 76vh;
        border-radius: 14px; object-fit: contain;
        box-shadow: 0 10px 60px rgba(0,0,0,.5);
      }
      #nabad-lightbox-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
      .nabad-lb-btn {
        padding: 10px 22px; border-radius: 10px; border: none; cursor: pointer;
        font-size: 13px; font-weight: 600; transition: opacity .15s;
      }
      .nabad-lb-btn:hover { opacity: .83; }
      #nabad-lb-save  { background: linear-gradient(135deg,#6c5ce7,#a855f7); color: #fff; }
      #nabad-lb-open  { background: rgba(255,255,255,.14); color: #fff; }
      #nabad-lb-close { background: rgba(255,255,255,.07); color: rgba(255,255,255,.7); }

      /* ── Confirm Modal ── */
      .nabad-modal-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.72);
        z-index: ${CONFIG.zIndex + 5};
        display: flex; align-items: center; justify-content: center; padding: 20px;
      }
      .nabad-modal {
        background: #1a1a2e; border-radius: 18px; padding: 26px;
        max-width: 320px; width: 100%; border: 1px solid rgba(255,255,255,.1);
        box-shadow: 0 10px 50px rgba(0,0,0,.5);
      }
      .nabad-modal h3 { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 8px; }
      .nabad-modal p  { font-size: 13px; color: rgba(255,255,255,.6); margin-bottom: 22px; line-height: 1.5; }
      .nabad-modal-actions { display: flex; gap: 10px; }
      .nabad-modal-btn {
        flex: 1; padding: 11px; border-radius: 10px; border: none;
        cursor: pointer; font-size: 13px; font-weight: 600; transition: opacity .15s;
      }
      .nabad-modal-btn.confirm { background: linear-gradient(135deg,#6c5ce7,#a855f7); color: #fff; }
      .nabad-modal-btn.cancel  { background: rgba(255,255,255,.08); color: rgba(255,255,255,.7); }
      .nabad-modal-btn:hover   { opacity: .85; }

      /* ── Responsive ── */
      @media (max-width: 440px) {
        #nabad-panel {
          right: 0; bottom: 0; width: 100vw; max-width: 100vw;
          height: 100dvh; max-height: 100dvh; border-radius: 0;
        }
        #nabad-launcher { bottom: 16px; right: 16px; }
      }
      @media (prefers-reduced-motion: reduce) {
        #nabad-panel, .nabad-bubble, #nabad-launcher { transition: none !important; animation: none !important; }
      }
    `;
    document.head.appendChild(s);
  }

  // ── Shell Builder ─────────────────────────────────────────────────────────
  function buildShell() {
    const root = document.createElement('div');
    root.id = 'nabad-root';
    root.innerHTML = `
      <button id="nabad-launcher" aria-label="Open Nabad AI">🔥</button>

      <div id="nabad-panel" role="dialog" aria-label="NabadAI Chat">

        <div id="nabad-header">
          <div id="nabad-header-left">
            <div id="nabad-avatar">🔥</div>
            <div>
              <div id="nabad-title">${escapeHtml(CONFIG.title)}</div>
              <div id="nabad-subtitle">${escapeHtml(CONFIG.subtitle)}</div>
            </div>
          </div>
          <div id="nabad-header-right">
            <button class="nabad-hbtn" id="nabad-new-chat-btn">New Chat</button>
            <button class="nabad-hbtn" id="nabad-change-personality-btn">Advisor</button>
            <button id="nabad-close-btn" aria-label="Close">✕</button>
          </div>
        </div>

        <div id="nabad-personality-badge">
          Advisor: <span id="nabad-badge-text">✨ Auto</span>
        </div>

        <div id="nabad-messages"></div>
        <div id="nabad-onboarding"></div>

        <div id="nabad-typing">
          <span></span><span></span><span></span>
        </div>

        <div id="nabad-input-area">
          <textarea
            id="nabad-input"
            placeholder="Ask Nabad anything..."
            rows="1"
            aria-label="Message input"
          ></textarea>
          <button id="nabad-send" aria-label="Send">➤</button>
        </div>
      </div>

      <div id="nabad-lightbox">
        <img id="nabad-lightbox-img" src="" alt="Full size preview" />
        <div id="nabad-lightbox-actions">
          <button class="nabad-lb-btn" id="nabad-lb-save">⬇ Save</button>
          <button class="nabad-lb-btn" id="nabad-lb-open">↗ Open</button>
          <button class="nabad-lb-btn" id="nabad-lb-close">✕ Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    refs.root          = root;
    refs.launcher      = root.querySelector('#nabad-launcher');
    refs.panel         = root.querySelector('#nabad-panel');
    refs.messages      = root.querySelector('#nabad-messages');
    refs.onboarding    = root.querySelector('#nabad-onboarding');
    refs.input         = root.querySelector('#nabad-input');
    refs.send          = root.querySelector('#nabad-send');
    refs.badge         = root.querySelector('#nabad-badge-text');
    refs.typing        = root.querySelector('#nabad-typing');
    refs.lightbox      = root.querySelector('#nabad-lightbox');
    refs.lightboxImg   = root.querySelector('#nabad-lightbox-img');
    refs.lightboxSave  = root.querySelector('#nabad-lb-save');
    refs.lightboxOpen  = root.querySelector('#nabad-lb-open');
    refs.lightboxClose = root.querySelector('#nabad-lb-close');

    // Init state from storage
    state.messages    = loadMessages();
    state.personality = loadPersonality();
    state.onboarded   = loadOnboarded();
    state.userProfile = loadUserProfile();
    state.onboardingPath = state.userProfile?.path || null;

    bindEvents();
    updatePersonalityBadge();

    if (state.onboarded) {
      renderInitialState();
    } else {
      showOnboarding();
    }
  }
  // ── Event Binding ─────────────────────────────────────────────────────────
  function bindEvents() {
    // Launcher
    refs.launcher.addEventListener('click', () => toggleWidget());

    // Close button
    refs.panel.querySelector('#nabad-close-btn').addEventListener('click', () => toggleWidget(false));

    // Send button
    refs.send.addEventListener('click', sendMessage);

    // Enter to send
    refs.input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    // Auto-grow textarea
    refs.input.addEventListener('input', () => {
      refs.input.style.height = 'auto';
      refs.input.style.height = Math.min(refs.input.scrollHeight, 120) + 'px';
    });

    // New Chat
    refs.panel.querySelector('#nabad-new-chat-btn').addEventListener('click', () => {
      confirmAction(
        'Start a new chat?',
        'Your current conversation and profile will be cleared. You\'ll go through onboarding again.',
        () => {
          clearAllStorage();
          state.messages        = [];
          state.onboarded       = false;
          state.userProfile     = {};
          state.onboardingPath  = null;
          state.onboardingAnswers = {};
          state.personality     = 'auto';
          refs.messages.innerHTML = '';
          showOnboarding();
        }
      );
    });

    // Change Advisor
    refs.panel.querySelector('#nabad-change-personality-btn').addEventListener('click', () => {
      showPersonalityScreenInline();
    });

    // Lightbox controls
    refs.lightboxSave.addEventListener('click', () => {
      if (!currentLightboxSrc) return;
      const a = document.createElement('a');
      a.href = currentLightboxSrc;
      a.download = 'nabad-image.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
    refs.lightboxOpen.addEventListener('click', () => {
      if (currentLightboxSrc) window.open(currentLightboxSrc, '_blank');
    });
    refs.lightboxClose.addEventListener('click', closeImageLightbox);
    refs.lightbox.addEventListener('click', e => {
      if (e.target === refs.lightbox) closeImageLightbox();
    });

    // Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (refs.lightbox.classList.contains('open')) closeImageLightbox();
        else if (state.open) toggleWidget(false);
      }
    });
  }

  // ── Toggle Widget ─────────────────────────────────────────────────────────
  function toggleWidget(force) {
    state.open = force !== undefined ? force : !state.open;
    refs.panel.classList.toggle('open', state.open);
    refs.launcher.classList.toggle('open', state.open);
    if (state.open) {
      document.body.style.overflow = 'hidden';
      scrollToBottom();
      setTimeout(() => {
        if (!refs.input.disabled) refs.input.focus();
      }, 260);
    } else {
      document.body.style.overflow = '';
    }
  }

  // ── Personality Badge ─────────────────────────────────────────────────────
  function updatePersonalityBadge() {
    const p = PERSONALITIES.find(x => x.id === state.personality) || PERSONALITIES.find(x => x.id === 'auto');
    if (refs.badge) refs.badge.textContent = `${p.icon} ${p.title}`;
  }

  // ── Initial State (returning user) ────────────────────────────────────────
  function renderInitialState() {
    refs.onboarding.style.display = 'none';
    refs.messages.style.display   = 'flex';
    refs.messages.style.flexDirection = 'column';
    refs.input.disabled = false;
    refs.send.disabled  = false;

    if (state.messages.length === 0) {
      renderMessage('assistant', buildGreeting(), true);
    } else {
      state.messages.forEach(m => renderMessage(m.role, m.content, false));
    }
    scrollToBottom();
  }

  // ── ONBOARDING SCREEN 1 — Path Selection ─────────────────────────────────
  function showOnboarding() {
    refs.messages.style.display   = 'none';
    refs.onboarding.style.display = 'flex';
    refs.onboarding.style.flexDirection = 'column';
    refs.input.disabled = true;
    refs.send.disabled  = true;

    refs.onboarding.innerHTML = `
      <div class="nabad-ob-progress">
        <div class="nabad-ob-dot active"></div>
        <div class="nabad-ob-dot"></div>
        <div class="nabad-ob-dot"></div>
      </div>
      <div class="nabad-ob-title">Hey 👋 Welcome to Nabad</div>
      <div class="nabad-ob-sub">Your business co-founder — direct, opinionated, and actually useful.<br>Let's personalise your experience first.</div>
      <div class="nabad-ob-sub" style="font-size:13px;color:rgba(255,255,255,.65);margin-top:2px;font-weight:500">Where are you at right now?</div>

      ${ONBOARDING_PATHS.map(p => `
        <div class="nabad-path-card" data-path="${p.id}">
          <div class="nabad-path-icon">${p.icon}</div>
          <div>
            <div class="nabad-path-title">${escapeHtml(p.title)}</div>
            <div class="nabad-path-desc">${escapeHtml(p.desc)}</div>
          </div>
        </div>
      `).join('')}

      <button class="nabad-ob-skip" id="nabad-ob-skip1">Skip onboarding — just start chatting →</button>
    `;

    refs.onboarding.querySelectorAll('.nabad-path-card').forEach(card => {
      card.addEventListener('click', () => {
        refs.onboarding.querySelectorAll('.nabad-path-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.onboardingPath = card.dataset.path;
        setTimeout(() => showOnboardingScreen2(), 180);
      });
    });

    refs.onboarding.querySelector('#nabad-ob-skip1').addEventListener('click', () => {
      state.onboardingPath = null;
      showPersonalityScreen();
    });
  }

  // ── ONBOARDING SCREEN 2 — Profile Questions ───────────────────────────────
  function showOnboardingScreen2() {
    const path      = state.onboardingPath;
    const questions = ONBOARDING_QUESTIONS[path] || [];

    refs.onboarding.innerHTML = `
      <div class="nabad-ob-progress">
        <div class="nabad-ob-dot active"></div>
        <div class="nabad-ob-dot active"></div>
        <div class="nabad-ob-dot"></div>
      </div>
      <div class="nabad-ob-title">Tell me a bit more</div>
      <div class="nabad-ob-sub">So Nabad gives you advice that's actually relevant — not generic MBA fluff.</div>

      ${questions.map((q, i) => `
        <div class="nabad-ob-field">
          <label class="nabad-ob-label">${escapeHtml(q.label)}</label>
          <input
            class="nabad-ob-input"
            data-key="${q.key}"
            placeholder="${escapeHtml(q.placeholder)}"
            type="text"
            autocomplete="off"
            ${i === 0 ? 'autofocus' : ''}
          />
        </div>
      `).join('')}

      <div class="nabad-ob-field">
        <label class="nabad-ob-label">What city or country are you based in? 📍</label>
        <input
          class="nabad-ob-input"
          data-key="location"
          placeholder="e.g. Dubai, London, Lagos, New York..."
          type="text"
          autocomplete="off"
        />
      </div>

      <button class="nabad-ob-btn" id="nabad-ob-next2">Continue →</button>
      <button class="nabad-ob-skip" id="nabad-ob-back2">← Back</button>
      <button class="nabad-ob-skip" id="nabad-ob-skip2">Skip these questions →</button>
    `;

    // Enter key moves forward
    refs.onboarding.querySelectorAll('.nabad-ob-input').forEach((input, idx, all) => {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (idx < all.length - 1) {
            all[idx + 1].focus();
          } else {
            refs.onboarding.querySelector('#nabad-ob-next2').click();
          }
        }
      });
    });

    // Continue
    refs.onboarding.querySelector('#nabad-ob-next2').addEventListener('click', () => {
      const answers = { path: state.onboardingPath };
      refs.onboarding.querySelectorAll('.nabad-ob-input').forEach(input => {
        const val = input.value.trim();
        if (val) answers[input.dataset.key] = val;
      });
      state.onboardingAnswers = answers;
      state.userProfile       = answers;
      saveUserProfile(answers);
      showPersonalityScreen();
    });

    // Back
    refs.onboarding.querySelector('#nabad-ob-back2').addEventListener('click', () => showOnboarding());

    // Skip
    refs.onboarding.querySelector('#nabad-ob-skip2').addEventListener('click', () => {
      const partial = { path: state.onboardingPath };
      state.userProfile = partial;
      saveUserProfile(partial);
      showPersonalityScreen();
    });

    // Focus first input
    setTimeout(() => {
      const first = refs.onboarding.querySelector('.nabad-ob-input');
      if (first) first.focus();
    }, 80);
  }

  // ── ONBOARDING SCREEN 3 — Personality Selection ───────────────────────────
  function showPersonalityScreen() {
    refs.onboarding.innerHTML = `
      <div class="nabad-ob-progress">
        <div class="nabad-ob-dot active"></div>
        <div class="nabad-ob-dot active"></div>
        <div class="nabad-ob-dot active"></div>
      </div>
      <div class="nabad-ob-title">Pick your advisor style</div>
      <div class="nabad-ob-sub">How do you want Nabad to talk to you?<br>You can change this anytime from the header.</div>

      <div class="nabad-personality-grid">
        ${PERSONALITIES.map(p => `
          <div class="nabad-p-card ${state.personality === p.id ? 'selected' : ''}" data-pid="${p.id}">
            <div class="nabad-p-icon">${p.icon}</div>
            <div>
              <div class="nabad-p-title">${escapeHtml(p.title)}</div>
              <div class="nabad-p-desc">${escapeHtml(p.desc)}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <button class="nabad-ob-btn" id="nabad-ob-finish" style="margin-top:6px">Let's go 🚀</button>
      <button class="nabad-ob-skip" id="nabad-ob-back3">← Back</button>
    `;

    let selectedPid = state.personality || 'auto';

    refs.onboarding.querySelectorAll('.nabad-p-card').forEach(card => {
      card.addEventListener('click', () => {
        refs.onboarding.querySelectorAll('.nabad-p-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedPid = card.dataset.pid;
      });
    });

    refs.onboarding.querySelector('#nabad-ob-finish').addEventListener('click', () => {
      state.personality = selectedPid;
      state.onboarded   = true;
      savePersonality(selectedPid);
      saveOnboarded();
      updatePersonalityBadge();
      finishOnboarding();
    });

    refs.onboarding.querySelector('#nabad-ob-back3').addEventListener('click', () => {
      if (state.onboardingPath) showOnboardingScreen2();
      else showOnboarding();
    });
  }

  // ── Finish Onboarding → Enter Chat ────────────────────────────────────────
  function finishOnboarding() {
    refs.onboarding.style.display = 'none';
    refs.messages.style.display   = 'flex';
    refs.messages.style.flexDirection = 'column';
    refs.input.disabled = false;
    refs.send.disabled  = false;
    refs.messages.innerHTML = '';
    renderMessage('assistant', buildGreeting(), true);
    setTimeout(() => refs.input.focus(), 100);
  }

  // ── Change Advisor Inline (from header) ───────────────────────────────────
  function showPersonalityScreenInline() {
    refs.messages.style.display   = 'none';
    refs.onboarding.style.display = 'flex';
    refs.onboarding.style.flexDirection = 'column';
    refs.input.disabled = true;
    refs.send.disabled  = true;

    refs.onboarding.innerHTML = `
      <div class="nabad-ob-title" style="margin-bottom:4px">Switch advisor style</div>
      <div class="nabad-ob-sub">Your conversation history is kept. Only the advisor changes.</div>

      <div class="nabad-personality-grid" style="margin-top:8px">
        ${PERSONALITIES.map(p => `
          <div class="nabad-p-card ${state.personality === p.id ? 'selected' : ''}" data-pid="${p.id}">
            <div class="nabad-p-icon">${p.icon}</div>
            <div>
              <div class="nabad-p-title">${escapeHtml(p.title)}</div>
              <div class="nabad-p-desc">${escapeHtml(p.desc)}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <button class="nabad-ob-btn" id="nabad-p-confirm" style="margin-top:10px">Apply →</button>
      <button class="nabad-ob-skip" id="nabad-p-cancel">Cancel</button>
    `;

    let selectedPid = state.personality;

    refs.onboarding.querySelectorAll('.nabad-p-card').forEach(card => {
      card.addEventListener('click', () => {
        refs.onboarding.querySelectorAll('.nabad-p-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedPid = card.dataset.pid;
      });
    });

    function returnToChat() {
      refs.onboarding.style.display = 'none';
      refs.messages.style.display   = 'flex';
      refs.messages.style.flexDirection = 'column';
      refs.input.disabled = false;
      refs.send.disabled  = false;
      setTimeout(() => refs.input.focus(), 100);
    }

    refs.onboarding.querySelector('#nabad-p-confirm').addEventListener('click', () => {
      state.personality = selectedPid;
      savePersonality(selectedPid);
      updatePersonalityBadge();
      returnToChat();
    });

    refs.onboarding.querySelector('#nabad-p-cancel').addEventListener('click', returnToChat);
  }

  // ── Render Message ────────────────────────────────────────────────────────
  function renderMessage(role, content, persist = true) {
    const bubble = document.createElement('div');
    bubble.className = `nabad-bubble ${role}`;

    if (role === 'assistant') {
      bubble.innerHTML = sanitizeHtml(content);
      processAssistantBubble(bubble);
    } else {
      bubble.textContent = content;
    }

    refs.messages.appendChild(bubble);
    scrollToBottom();

    if (persist) {
      state.messages.push({ role, content });
      saveMessages();
    }
  }

  // ── Process Assistant Bubble ──────────────────────────────────────────────
  function processAssistantBubble(bubble) {
    // Open all links in new tab safely
    bubble.querySelectorAll('a[href]').forEach(a => {
      a.target = '_blank';
      a.rel    = 'noopener noreferrer';
    });

    // Handle generated images
    bubble.querySelectorAll('img.nabad-gen-image').forEach(img => {
      // Cache-bust Pollinations URLs so the browser always fetches fresh
      if (img.src.includes('pollinations.ai') && !img.src.includes('_cb=')) {
        const sep = img.src.includes('?') ? '&' : '?';
        img.src = img.src + sep + '_cb=' + Date.now();
      }

      // Loading placeholder
      const wrap = img.closest('.nabad-image-wrap');
      if (wrap && !img.complete) {
        wrap.style.minHeight  = '200px';
        wrap.style.background = 'rgba(255,255,255,.04)';
        wrap.style.borderRadius = '12px';
        wrap.style.display    = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.justifyContent = 'center';
        img.addEventListener('load',  () => {
          wrap.style.minHeight  = '';
          wrap.style.background = '';
          wrap.style.display    = '';
          wrap.style.alignItems = '';
          wrap.style.justifyContent = '';
        });
        img.addEventListener('error', () => {
          wrap.innerHTML = `<div class="nabad-image-placeholder">⚠️ Image failed to load — try again</div>`;
        });
      }

      // Click to open lightbox
      img.style.cursor = 'pointer';
      img.addEventListener('click', () => openImageLightbox(img.src, img.alt || ''));
    });

    // Enhance cards (score bars, pricing highlights)
    enhanceCards(bubble);
  }

  // ── Card Enhancements ─────────────────────────────────────────────────────
  function enhanceCards(bubble) {
    // Animate score progress bars
    bubble.querySelectorAll('[data-score]').forEach(bar => {
      const pct = Math.min(100, Math.max(0, parseInt(bar.dataset.score, 10) || 0));
      bar.style.width = '0%';
      requestAnimationFrame(() => {
        setTimeout(() => {
          bar.style.transition = 'width 0.85s cubic-bezier(.4,0,.2,1)';
          bar.style.width      = pct + '%';
        }, 120);
      });
    });

    // Highlight popular pricing tier
    bubble.querySelectorAll('[data-nabad-card="pricing"]').forEach(card => {
      card.querySelectorAll('[style*="linear-gradient(135deg,#6c5ce7"]').forEach(tier => {
        tier.style.boxShadow = '0 0 24px rgba(168,85,247,.35)';
      });
    });

    // Animate quadrant dots in positioning matrix
    bubble.querySelectorAll('[data-nabad-card="matrix"] [style*="border-radius:50%"]').forEach((dot, i) => {
      dot.style.opacity   = '0';
      dot.style.transform = 'scale(0)';
      setTimeout(() => {
        dot.style.transition = 'opacity .4s ease, transform .4s ease';
        dot.style.opacity    = '1';
        dot.style.transform  = 'scale(1)';
      }, 150 + i * 80);
    });
  }

  // ── Lightbox ──────────────────────────────────────────────────────────────
  function openImageLightbox(src, alt) {
    currentLightboxSrc    = src;
    refs.lightboxImg.src  = src;
    refs.lightboxImg.alt  = alt || '';
    refs.lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeImageLightbox() {
    refs.lightbox.classList.remove('open');
    refs.lightboxImg.src = '';
    currentLightboxSrc   = '';
    if (!state.open) document.body.style.overflow = '';
  }

  // ── Typing Indicator ──────────────────────────────────────────────────────
  function showTyping(show) {
    refs.typing.classList.toggle('show', !!show);
    refs.send.disabled = !!show;
    if (show) scrollToBottom();
  }

  // ── Scroll to Bottom ──────────────────────────────────────────────────────
  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (refs.messages && state.open) {
        refs.messages.scrollTop = refs.messages.scrollHeight;
      }
    });
  }

  // ── Confirm Modal ─────────────────────────────────────────────────────────
  function confirmAction(title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'nabad-modal-overlay';
    overlay.innerHTML = `
      <div class="nabad-modal">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div class="nabad-modal-actions">
          <button class="nabad-modal-btn cancel">Cancel</button>
          <button class="nabad-modal-btn confirm">Yes, continue</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.cancel').addEventListener('click',  () => overlay.remove());
    overlay.querySelector('.confirm').addEventListener('click', () => { overlay.remove(); onConfirm(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  // ── Send Message ──────────────────────────────────────────────────────────
  async function sendMessage() {
    if (state.sending) return;
    const text = (refs.input.value || '').trim();
    if (!text) return;

    state.sending = true;

    const history = [
      ...state.messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: text }
    ];

    renderMessage('user', text, true);
    refs.input.value       = '';
    refs.input.style.height = 'auto';
    showTyping(true);

    try {
      const profileSummary = buildProfileSummary();
      const payload = {
        messages:    history,
        personality: state.personality,
        userProfile: profileSummary
      };

      const resp = await fetch(CONFIG.apiUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) throw new Error(data?.reply || data?.error || `HTTP ${resp.status}`);

      const reply = data?.reply || '<p>Sorry — I could not generate a response. Please try again.</p>';
      renderMessage('assistant', reply, true);

    } catch (err) {
      console.error('[NABAD WIDGET ERROR]', err);
      renderMessage('assistant',
        `<p>⚠️ Something went wrong — <strong>${
          err.message?.includes('Failed to fetch')
            ? 'check your internet connection'
            : 'please try again in a moment'
        }</strong></p>`,
        true
      );
    } finally {
      state.sending = false;
      showTyping(false);
      setTimeout(() => refs.input.focus(), 50);
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildShell();
    window.__NABAD_OPEN_WIDGET__  = () => toggleWidget(true);
    window.__NABAD_CLOSE_WIDGET__ = () => toggleWidget(false);
  }

  loadDOMPurify(() => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  });

})();
