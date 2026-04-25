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
      'ul','ol','li','a','br','img','span','div','table','button',
      'thead','tbody','tr','th','td'
    ],
    ALLOWED_ATTR: [
      'href','src','alt','target','rel','class','style',
      'data-nabad-card','data-nabad-brief',
      'data-score','data-quadrant','data-nabad-action',
      'data-pricing-grid','data-pricing-tier','data-pricing-title','data-pricing-subtitle',
      'data-pricing-name','data-pricing-price','data-pricing-period','data-pricing-desc',
      'data-pricing-feature','data-pricing-cta'
    ]
  };

  function sanitizeHtml(html) {
    if (window.DOMPurify && window.DOMPurify.sanitize) {
      return window.DOMPurify.sanitize(html, PURIFY_CONFIG);
    }
    return `<p>${escapeHtml(String(html))}</p>`;
  }

  function cleanText(value = '', maxLen = 300) {
    return String(value || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLen);
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
  const INLINE_MODE = Boolean(CONFIG.inlineDesktop || CONFIG.mountSelector);

  const STORAGE_KEYS = {
    messages:    `${CONFIG.storageNamespace}:messages`,
    personality: `${CONFIG.storageNamespace}:personality`,
    imageProvider: `${CONFIG.storageNamespace}:imageProvider`,
    liveResearchMode: `${CONFIG.storageNamespace}:liveResearchMode`,
    userProfile: `${CONFIG.storageNamespace}:userProfile`,
    onboarded:   `${CONFIG.storageNamespace}:onboarded`,
    memoryKey:   `${CONFIG.storageNamespace}:memoryKey`,
    accountClaim:`${CONFIG.storageNamespace}:accountClaim`,
    autoDetect:  `${CONFIG.storageNamespace}:autoDetect`,
    dailyFocusDate: `${CONFIG.storageNamespace}:dailyFocusDate`,
    notificationsEnabled: `${CONFIG.storageNamespace}:notificationsEnabled`
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

  const PERSONALITY_LOGOS = {
    strategist: '/logo-strategist.png',
    growth: '/logo-growth.png',
    branding: '/logo-branding.png',
    offer: '/logo-offer.png',
    creative: '/logo-creative.png',
    straight_talk: '/logo-straight-talk.png',
    auto: '/logo.png'
  };

  const ONBOARDING_PATHS = [
    {
      id: 'existing',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
      title: 'I have a business',
      desc: 'Help me grow, fix problems, and scale it'
    },
    {
      id: 'idea',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>`,
      title: 'I have an idea',
      desc: 'Help me validate and build it from scratch'
    },
    {
      id: 'figuring',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
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
  const ACTION_CHIPS_BY_PERSONALITY = {
    strategist: [
      'Build a 90-day roadmap for my business',
      'Create a competitor gap matrix for my market',
      'Score this idea and give me one next move',
      'Turn my concept into a go-to-market plan'
    ],
    growth: [
      'Build me a weekly growth experiment plan',
      'Diagnose my funnel and fix weak conversion points',
      'Create a channel strategy by budget',
      'Give me KPI targets for the next 30 days'
    ],
    branding: [
      'Write my brand positioning statement',
      'Create a messaging guide and tone of voice',
      'Audit my website trust signals and clarity',
      'Define my ICP and value proposition'
    ],
    offer: [
      'Build a pricing card for my offer',
      'Design a Good-Better-Best package stack',
      'Create objection handling for this offer',
      'Build a profitable offer structure with margins'
    ],
    creative: [
      'Generate 3 logo directions for my brand',
      'Create ad visual concepts for this campaign',
      'Rewrite my headline in 10 bold ways',
      'Design a brand style direction board'
    ],
    straight_talk: [
      'Tell me the real bottleneck in my business',
      'What should I stop doing immediately?',
      'Give me the fastest path to first revenue',
      'Give me a blunt action plan for this week'
    ],
    auto: [
      'Guide me to the best next move for my business',
      'Build my pricing card from this offer idea',
      'Analyze my website and tell me what to fix first',
      'Generate a logo concept for my brand'
    ]
  };

  const SETTINGS_ICONS = {
    auto: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3"/><path d="M12 18v3"/><path d="M4.93 4.93l2.12 2.12"/><path d="M16.95 16.95l2.12 2.12"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="M4.93 19.07l2.12-2.12"/><path d="M16.95 7.05l2.12-2.12"/><circle cx="12" cy="12" r="3.5"/></svg>`,
    newChat: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>`,
    memory: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v10"/><path d="M7 12h10"/><rect x="3" y="3" width="18" height="18" rx="4"/></svg>`,
    profile: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>`,
    notifications: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"/><path d="M9 17a3 3 0 0 0 6 0"/></svg>`,
    account: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></svg>`,
    editor: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 20h8"/><path d="M9 8h6"/><path d="M8 12h8"/></svg>`,
    warRoom: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.7 5.47 6.03.88-4.36 4.25 1.03 6.01L12 16.9 6.6 19.61l1.03-6.01L3.27 9.35l6.03-.88L12 3z"/></svg>`,
    reset: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 10v7"/><path d="M14 10v7"/></svg>`
  };

  // ── STATE ────────────────────────────────────────────────────
  const state = {
    open: false,
    sending: false,
    warRoom: false,
    messages: loadMessages(),
    personality: loadPersonality() || 'auto',
    personalityChosen: !!loadPersonality(),
    autoDetectMode: loadAutoDetect(),
    imageProvider: loadImageProvider(),
    liveResearchMode: loadLiveResearchMode(),
    onboarded: loadOnboarded(),
    userProfile: loadUserProfile(),
    claimedAccount: loadAccountClaim(),
    onboardingPath: null,
    onboardingAnswers: {},
    briefShown: false,
    dailyFocusDate: loadDailyFocusDate(),
    voiceMode: false,
    pushSubscription: null,
    personalityBuffer: null,
    personalityCount: 0,
    personalityScore: 0,
    pendingAttachment: null,
    lastImageAttachment: null,
    temporaryCreativeLock: false,
    replyTo: null,
    notificationsEnabled: loadNotificationsEnabled(),
    typingLabels: null,
    quickActionsPinned: false,
    campaignRefineAction: null,
    campaignEditBubble: null,
    campaignEditorContext: null
  };

  const refs = {
    root: null, launcher: null, panel: null,
    header: null,
    messages: null, input: null, send: null,
    attach: null, fileInput: null, attachmentChip: null, replyBar: null,
    quickActions: null,
    badge: null, typing: null,
    lightbox: null, lightboxImg: null,
    lightboxSave: null, lightboxOpen: null, lightboxClose: null
  };

  let currentLightboxSrc = '';
  async function downloadImageFromUrl(url, filename = 'nabad-generated-image.png') {
    if (!url) return;
    try {
      const r = await fetch(url);
      const b = await r.blob();
      const u = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = u;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 1500);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  // ── STORAGE ──────────────────────────────────────────────────
  function loadMessages() {
    try {
      const raw    = localStorage.getItem(STORAGE_KEYS.messages);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed
            .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
            .map((m) => ({
              id: cleanText(m.id || '', 48) || `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              role: m.role,
              content: typeof m.content === 'string' ? m.content : cleanText(String(m.content || ''), 6000),
              replyTo: m.replyTo && typeof m.replyTo === 'object'
                ? {
                    id: cleanText(m.replyTo.id || '', 48),
                    role: m.replyTo.role === 'assistant' ? 'assistant' : 'user',
                    snippet: cleanText(m.replyTo.snippet || '', 220)
                  }
                : null
            }))
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

  function loadAutoDetect() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.autoDetect);
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      const saved = loadPersonality();
      return !saved || saved === 'auto';
    } catch {
      return true;
    }
  }

  function loadImageProvider() {
    try {
      const raw = (localStorage.getItem(STORAGE_KEYS.imageProvider) || '').toLowerCase().trim();
      if (raw === 'nanobanana') return 'gemini';
      const valid = ['auto', 'openai', 'gemini', 'ideogram', 'pollinations', 'replicate', 'huggingface'];
      return valid.includes(raw) ? raw : 'gemini';
    } catch {
      return 'gemini';
    }
  }

  function savePersonality(value) {
    try {
      if (!value) { localStorage.removeItem(STORAGE_KEYS.personality); return; }
      localStorage.setItem(STORAGE_KEYS.personality, value);
    } catch {}
  }

  function saveAutoDetect(value = true) {
    try { localStorage.setItem(STORAGE_KEYS.autoDetect, String(Boolean(value))); }
    catch {}
  }

  function saveImageProvider(value = 'auto') {
    try {
      const v = String(value || 'auto').toLowerCase();
      localStorage.setItem(STORAGE_KEYS.imageProvider, v);
    } catch {}
  }

  function loadLiveResearchMode() {
    try {
      const raw = (localStorage.getItem(STORAGE_KEYS.liveResearchMode) || '').toLowerCase().trim();
      return raw === 'on_demand' ? 'on_demand' : 'auto';
    } catch {
      return 'auto';
    }
  }

  function saveLiveResearchMode(value = 'auto') {
    try {
      const mode = String(value || 'auto').toLowerCase();
      localStorage.setItem(STORAGE_KEYS.liveResearchMode, mode === 'on_demand' ? 'on_demand' : 'auto');
    } catch {}
  }

  function loadNotificationsEnabled() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.notificationsEnabled);
      if (raw === null) return false;
      return raw === 'true';
    } catch {
      return false;
    }
  }

  function saveNotificationsEnabled(value = false) {
    try { localStorage.setItem(STORAGE_KEYS.notificationsEnabled, String(Boolean(value))); }
    catch {}
  }

  function isPushSupported() {
    return typeof window !== 'undefined'
      && 'Notification' in window
      && 'serviceWorker' in navigator
      && 'PushManager' in window;
  }

  function notificationStatusText() {
    if (!isPushSupported()) return 'Notifications are not supported in this browser.';
    if (Notification.permission === 'denied') return 'Blocked in browser settings.';
    if (state.notificationsEnabled) return 'Daily brief and important updates are enabled.';
    return 'Get daily brief reminders and key updates.';
  }

  function urlBase64ToUint8Array(base64String = '') {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
    return output;
  }

  async function ensureServiceWorkerRegistration() {
    if (!('serviceWorker' in navigator)) throw new Error('Service Worker not supported');
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return navigator.serviceWorker.register('/sw.js');
  }

  async function enableNotifications() {
    if (!isPushSupported()) return false;
    const vapidPublicKey = String(CONFIG.vapidPublicKey || window.NABAD_VAPID_PUBLIC_KEY || '').trim();
    if (!vapidPublicKey) {
      alert('Notifications are not configured yet. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY on Vercel first.');
      return false;
    }

    try {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        state.notificationsEnabled = false;
        saveNotificationsEnabled(false);
        return false;
      }

      const reg = await ensureServiceWorkerRegistration();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
      }

      const welcomeMessages = [
        { title: 'Nabad is live', body: 'I am here — one click away whenever you need a sharp move.' },
        { title: 'NabadAI is ready', body: 'Your business co-founder is online. Tap to continue building.' },
        { title: 'Notifications enabled', body: 'You will get timely Nabad nudges when it matters most.' }
      ];
      const selectedMsg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

      const notifyRes = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub,
          saveOnly: false,
          title: selectedMsg.title,
          body: selectedMsg.body
        })
      });
      const notifyJson = await notifyRes.json().catch(() => ({}));
      if (!notifyRes.ok || !notifyJson?.saved) {
        throw new Error(
          cleanText(
            notifyJson?.detail || notifyJson?.error || 'Could not save notification subscription',
            220
          ) || 'Could not save notification subscription'
        );
      }

      state.pushSubscription = sub;
      state.notificationsEnabled = true;
      saveNotificationsEnabled(true);
      return true;
    } catch (err) {
      console.error('[NABAD] Notification enable failed:', err);
      if (err?.message) {
        alert(`Could not enable notifications: ${err.message}`);
      }
      state.notificationsEnabled = false;
      saveNotificationsEnabled(false);
      return false;
    }
  }

  async function disableNotifications() {
    if (!isPushSupported()) {
      state.notificationsEnabled = false;
      saveNotificationsEnabled(false);
      return false;
    }
    try {
      const reg = await ensureServiceWorkerRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      state.pushSubscription = null;
      state.notificationsEnabled = false;
      saveNotificationsEnabled(false);
      return false;
    } catch (err) {
      console.error('[NABAD] Notification disable failed:', err);
      state.notificationsEnabled = false;
      saveNotificationsEnabled(false);
      return false;
    }
  }

  async function syncNotificationState() {
    if (!isPushSupported()) {
      state.notificationsEnabled = false;
      saveNotificationsEnabled(false);
      return;
    }
    try {
      const reg = await ensureServiceWorkerRegistration();
      const sub = await reg.pushManager.getSubscription();
      state.pushSubscription = sub || null;
      const enabled = loadNotificationsEnabled() && Notification.permission === 'granted' && !!sub;
      state.notificationsEnabled = !!enabled;
      saveNotificationsEnabled(!!enabled);
    } catch {
      state.notificationsEnabled = false;
      saveNotificationsEnabled(false);
    }
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

  function loadAccountClaim() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.accountClaim);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return null;
      const email = cleanText(parsed.email || '', 180);
      const name = cleanText(parsed.name || '', 100);
      if (!email) return null;
      return {
        email: email.toLowerCase(),
        name,
        claimedAt: cleanText(parsed.claimedAt || '', 64)
      };
    } catch {
      return null;
    }
  }

  function saveAccountClaim(claim = null) {
    try {
      if (!claim || !claim.email) {
        localStorage.removeItem(STORAGE_KEYS.accountClaim);
        return;
      }
      localStorage.setItem(STORAGE_KEYS.accountClaim, JSON.stringify({
        email: String(claim.email).toLowerCase(),
        name: cleanText(claim.name || '', 100),
        claimedAt: cleanText(claim.claimedAt || new Date().toISOString(), 64)
      }));
    } catch {}
  }

  function getMemoryKey() {
    try {
      const existing = localStorage.getItem(STORAGE_KEYS.memoryKey);
      if (existing) return existing;
      const created = (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : `nabad_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(STORAGE_KEYS.memoryKey, created);
      return created;
    } catch {
      return `nabad_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  function getTodayKey() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function loadDailyFocusDate() {
    try { return localStorage.getItem(STORAGE_KEYS.dailyFocusDate) || ''; }
    catch { return ''; }
  }

  function saveDailyFocusDate(value = '') {
    try {
      if (!value) {
        localStorage.removeItem(STORAGE_KEYS.dailyFocusDate);
        return;
      }
      localStorage.setItem(STORAGE_KEYS.dailyFocusDate, value);
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

  let __editorRuntimePromise = null;
  async function getEditorRuntime() {
    if (!__editorRuntimePromise) {
      __editorRuntimePromise = import('/editor/editor.js')
        .then((mod) => mod.createNabadEditorRuntime());
    }
    return __editorRuntimePromise;
  }

  function getSelectedPersonalityMeta() {
    return (
      PERSONALITIES.find(p => p.id === state.personality) ||
      PERSONALITIES[PERSONALITIES.length - 1]
    );
  }

  function makeMessageId() {
    return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function toPlainText(value = '') {
    return String(value || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isLikelyLiveResearchQuery(text = '') {
    const t = toPlainText(text).toLowerCase();
    if (!t) return false;
    if (/\b(latest|today|current|recent|right now|this week|this month|2026|breaking|news|update)\b/.test(t)) return true;
    if (/\b(price|pricing|stock|market cap|rate|tax rate|law|regulation|policy|deadline|release date|launch date|election|score)\b/.test(t)) return true;
    if (/\b(search|look up|google|online|web|internet|source)\b/.test(t)) return true;
    return false;
  }

  function getTypingLabelsForText(text = '') {
    if (isLikelyLiveResearchQuery(text)) {
      return [
        'Checking live sources...',
        'Scanning trusted websites...',
        'Connecting live insights...'
      ];
    }
    return TYPING_LABELS;
  }

  function shouldNabadReact(userText = '', assistantText = '') {
    const u = toPlainText(userText).toLowerCase();
    const a = toPlainText(assistantText).toLowerCase();
    if (!u || !a) return false;

    const genericQuery = /\b(weather|temperature|time|date|repeat|again|translate|spell|who are you|what is this|hello|hi|thanks|thank you)\b/.test(u)
      || /^(\?|what|who|when|where|why|how|can you|could you)\b/.test(u);
    if (genericQuery) return false;

    const negativeAssistant = /\b(can't|cannot|not possible|unable|i don't|do not|won't|error|failed|hit a snag|not recommend)\b/.test(a);
    if (negativeAssistant) return false;

    const positiveAssistant = /\b(exactly|perfect|great|love|strong|smart|good move|right move|well done|nice|spot on|excellent|bold)\b/.test(a)
      || /\b(ممتاز|رائع|فكرة قوية|قرار ذكي)\b/.test(a);
    const userCommitment = /\b(i will|i'll|let's|lets|done|i decided|we should|my name is|my current location is|brand name is|the name of my brand is)\b/.test(u);
    const strategicIntent = /\b(focus|position|pricing|offer|brand|launch|users?|customers?|revenue|growth|market|icp|strategy|plan|validate|build|ship|mvp|sales)\b/.test(u);

    if (!userCommitment && !strategicIntent) return false;
    if (!positiveAssistant && !userCommitment) return false;
    return true;
  }

  function applyNabadReactionToLastUserBubble(userText = '', assistantText = '') {
    if (!shouldNabadReact(userText, assistantText) || !refs.messages) return;
    const userMsgs = refs.messages.querySelectorAll('.nabad-msg.user');
    if (!userMsgs.length) return;
    const lastUserMsg = userMsgs[userMsgs.length - 1];
    const bubble = lastUserMsg.querySelector('.nabad-bubble');
    if (!bubble) return;
    if (bubble.querySelector('.nabad-user-reaction-floating')) return;

    const badge = document.createElement('div');
    badge.className = 'nabad-user-reaction-floating';
    badge.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="nabad-heart-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#22d3ee"/>
            <stop offset="55%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#2563eb"/>
          </linearGradient>
        </defs>
        <path d="M12 20.4C11.5 20.1 4.2 15.8 2.7 10.5C1.7 6.9 4.2 4 7.5 4c1.8 0 3.3.8 4.5 2.3C13.2 4.8 14.7 4 16.5 4c3.3 0 5.8 2.9 4.8 6.5c-1.5 5.3-8.8 9.6-9.3 9.9z" fill="url(#nabad-heart-grad)"/>
      </svg>
    `;
    bubble.appendChild(badge);
  }

  function buildReplyLabel(role = 'assistant') {
    return role === 'assistant' ? 'Replying to Nabad' : 'Replying to your message';
  }

  function renderReplyBar() {
    if (!refs.replyBar) return;
    const target = state.replyTo;
    if (!target) {
      refs.replyBar.classList.remove('show');
      refs.replyBar.innerHTML = '';
      syncComposerTop();
      return;
    }
    refs.replyBar.innerHTML = `
      <div class="reply-meta">
        <div class="reply-label">${escapeHtml(buildReplyLabel(target.role))}</div>
        <div class="reply-snippet">${escapeHtml(target.snippet || '')}</div>
      </div>
      <button type="button" class="reply-cancel" aria-label="Cancel reply">✕</button>
    `;
    refs.replyBar.classList.add('show');
    refs.replyBar.querySelector('.reply-cancel')?.addEventListener('click', clearReplyTarget);
    syncComposerTop();
  }

  function clearReplyTarget() {
    state.replyTo = null;
    renderReplyBar();
  }

  function setReplyTarget(target = null) {
    if (!target || !target.id) {
      clearReplyTarget();
      return;
    }
    state.replyTo = {
      id: cleanText(target.id || '', 48),
      role: target.role === 'assistant' ? 'assistant' : 'user',
      snippet: cleanText(target.snippet || '', 220)
    };
    renderReplyBar();
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
    if (p.country)          parts.push(`Country: ${p.country}`);
    if (p.industry)         parts.push(`Industry: ${p.industry}`);
    if (p.stage)            parts.push(`Stage: ${p.stage}`);
    if (p.mainGoal)         parts.push(`Main goal: ${p.mainGoal}`);
    return parts.join(' | ');
  }

  function detectPreferredVoiceLanguage() {
    const recentUserText = state.messages
      .filter((m) => m.role === 'user')
      .slice(-3)
      .map((m) => String(m.content || '').replace(/<[^>]+>/g, ' '))
      .join(' ');
    const hasArabic = /[\u0600-\u06FF]/.test(recentUserText);
    const hasLatin = /[A-Za-z]/.test(recentUserText);
    if (hasArabic && !hasLatin) return 'ar';
    if (hasLatin && !hasArabic) return 'en';
    return 'en';
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
    renderQuickActions();
  }

  function getQuickActionPersonality() {
    if (state.autoDetectMode && state.personality === 'auto') return 'auto';
    return state.personality || 'auto';
  }

  function shouldCollapseQuickActions() {
    // Keep quick actions visible so users always see capability prompts.
    // Auto-collapsing caused confusion during campaign and creative flows.
    return false;
  }

  function renderQuickActions() {
    if (!refs.quickActions) return;
    if (!state.onboarded) {
      refs.quickActions.classList.add('hidden');
      refs.quickActions.innerHTML = '';
      return;
    }

    const personality = getQuickActionPersonality();
    const chips = ACTION_CHIPS_BY_PERSONALITY[personality] || ACTION_CHIPS_BY_PERSONALITY.auto;

    if (shouldCollapseQuickActions()) {
      refs.quickActions.classList.remove('hidden');
      refs.quickActions.innerHTML = `
        <button type="button" class="nabad-action-chip primary" data-nabad-quick-action="reopen">✨ Actions</button>
      `;
      return;
    }

    const visibleChips = chips.slice(0, 4).map((text) => (
      `<button type="button" class="nabad-action-chip" data-nabad-quick-action="prompt" data-prompt="${escapeHtml(text)}">${escapeHtml(text)}</button>`
    )).join('');
    refs.quickActions.classList.remove('hidden');
    refs.quickActions.innerHTML = `
      ${visibleChips}
      <button type="button" class="nabad-action-chip primary" data-nabad-quick-action="collapse">Hide</button>
    `;
  }

  function shouldForceCreativeForImage(text = '', attachment = null) {
    const t = String(text || '').toLowerCase();
    const asksGeneration =
      /\b(generate|create|make|design|draw|build|produce|regenerate|redo)\b/.test(t) &&
      /\b(image|photo|picture|logo|icon|illustration|banner|visual|graphic|mockup)\b/.test(t);
    const asksImageByNoun =
      /\b(logo|mockup|brand mark|wordmark|icon)\b/.test(t) &&
      /\b(generate|create|make|design|draw|build|produce|regenerate|redo|for me|please|another|new version)\b/.test(t);
    const attachedImageEdit =
      !!(attachment && attachment.kind === 'image' && /\b(edit|change|modify|remove|replace|add|improve|tweak)\b/.test(t));
    return asksGeneration || asksImageByNoun || attachedImageEdit;
  }

  function isImageGenerationIntent(text = '', attachment = null) {
    const t = String(text || '').toLowerCase();
    if (!t) return false;
    if (shouldForceCreativeForImage(text, attachment)) return true;
    if (/\b(generate|create|make|design|draw|build|produce|regenerate|redo)\b/.test(t) && /\b(image|photo|picture|logo|icon|illustration|banner|visual|graphic|mockup)\b/.test(t)) return true;
    return false;
  }

  function forceCreativeModeForImage() {
    if (state.personality === 'creative' && state.autoDetectMode === false) return;
    const prev = state.personality;
    state.personality = 'creative';
    state.autoDetectMode = false;
    state.personalityChosen = true;
    state.personalityBuffer = null;
    state.personalityCount = 0;
    state.personalityScore = 0;
    savePersonality('creative');
    saveAutoDetect(false);
    updatePersonalityBadge();
    setInputPlaceholder();
    applyPersonalityColor('creative', prev !== 'creative');
  }

  // ── [PC-1] APPLY PERSONALITY COLOR ───────────────────────────
  function applyPersonalityColor(id, announce = false) {
  const c = PERSONALITY_COLORS[id] || PERSONALITY_COLORS.auto;
  const logoSrc = PERSONALITY_LOGOS[id] || PERSONALITY_LOGOS.auto;

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
    document.documentElement.style.setProperty(
      '--nabad-logo-thinking-strong',
      `rgba(${r},${g},${b},0.6)`
    );
    document.documentElement.style.setProperty(
      '--nabad-logo-thinking-soft',
      `rgba(${r},${g},${b},0.15)`
    );
    logo.style.transition = 'border-color 0.6s ease';
    logo.style.borderColor = c.pulse;
  }
  const logoImg = document.querySelector('#nabad-logo img');
  if (logoImg && logoImg.getAttribute('src') !== logoSrc) {
    logoImg.setAttribute('src', logoSrc);
    logoImg.onerror = () => {
      logoImg.onerror = null;
      logoImg.setAttribute('src', PERSONALITY_LOGOS.auto);
    };
  }
  if (announce && logo) {
    logo.classList.remove('nabad-logo-shift');
    void logo.offsetWidth;
    logo.classList.add('nabad-logo-shift');
    logo.addEventListener('animationend', () => {
      logo.classList.remove('nabad-logo-shift');
    }, { once: true });
  }

  // 2. Update bubble left border color via CSS variable
  document.documentElement.style.setProperty('--nabad-personality-color', c.border);

        // 3. Mode pill — in chat feed on personality switch
    if (announce) {
      showPersonalityPill(id);
    }
  }

function showPersonalityPill(id) {
  if (id === 'auto') return;
  const c = PERSONALITY_COLORS[id];
  if (!c) return;

  const hex = c.pulse.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const pill = document.createElement('div');
  pill.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'margin:4px auto 8px',
    'width:fit-content',
    `background:rgba(${r},${g},${b},0.10)`,
    `border:1px solid rgba(${r},${g},${b},0.20)`,
    'border-radius:999px',
    'padding:5px 14px',
    `color:${c.pulse}`,
    'font-size:12px',
    'font-weight:700',
    'letter-spacing:0.2px',
    'opacity:0',
    'transform:translateY(6px)',
    'transition:opacity 0.35s ease, transform 0.35s ease',
    'pointer-events:none'
  ].join(';');

  pill.textContent = c.label;
  refs.messages.appendChild(pill);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      pill.style.opacity = '1';
      pill.style.transform = 'translateY(0)';
    });
  });

  scrollToBottom();
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
      :root {
        --nabad-font-display: "Sora", "Manrope", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        --nabad-font-body: "Manrope", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        --nabad-panel-bg: #f5f9ff;
        --nabad-panel-border: rgba(37,99,235,0.12);
        --nabad-primary-text: #071427;
        --nabad-muted-text: #485e7a;
      }

      #nabad-widget-root,
      #nabad-widget-root * {
        box-sizing: border-box;
        font-family: var(--nabad-font-body);
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

      #nabad-widget-root.nabad-inline-app {
        position: relative;
        inset: auto;
        right: auto;
        bottom: auto;
        width: 100%;
        height: 100%;
        padding: 0;
        z-index: auto;
        pointer-events: auto;
      }

      #nabad-widget-root.nabad-inline-app #nabad-launcher {
        display: none !important;
      }

      #nabad-widget-root.nabad-inline-app #nabad-close {
        display: none !important;
      }

      #nabad-widget-root.nabad-inline-app #nabad-panel {
        position: relative;
        right: auto;
        bottom: auto;
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        border-radius: 20px;
        display: flex;
        box-shadow: 0 22px 60px rgba(9,20,40,0.16);
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
        background: var(--nabad-panel-bg);
        border: 1px solid var(--nabad-panel-border);
        border-radius: 24px;
        box-shadow: 0 24px 80px rgba(9,20,40,0.2);
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
        background: var(--nabad-panel-bg);
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
        overflow: visible;
        transition: box-shadow 0.6s ease, border-color 0.6s ease;
      }

      #nabad-logo img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        border-radius: 999px;
      }

      #nabad-logo.nabad-logo-shift img {
        animation: nabadLogoSwitch 880ms cubic-bezier(0.16, 0.9, 0.2, 1) both;
        transform-origin: 50% 50%;
        will-change: transform, filter;
      }

      @keyframes nabadLogoSwitch {
        0% {
          transform: rotate(0deg) scale(0.94);
          filter: saturate(0.95);
        }
        30% {
          transform: rotate(210deg) scale(1.08);
          filter: saturate(1.12);
        }
        64% {
          transform: rotate(330deg) scale(1.03);
          filter: saturate(1.1);
        }
        100% {
          transform: rotate(360deg) scale(1);
          filter: saturate(1);
        }
      }

      @keyframes nabadBreath {
  0%   { box-shadow: 0 0 0 0px var(--nabad-logo-pulse-color, rgba(37,99,235,0.35)); }
  50%  { box-shadow: 0 0 0 6px var(--nabad-logo-pulse-color, rgba(37,99,235,0.10)); }
  100% { box-shadow: 0 0 0 0px var(--nabad-logo-pulse-color, rgba(37,99,235,0.35)); }
}

      #nabad-title-wrap { min-width: 0; }

      #nabad-title {
        color: var(--nabad-primary-text);
        font-family: var(--nabad-font-display);
        font-size: 18px;
        font-weight: 800;
        line-height: 1.1;
      }

      #nabad-subtitle {
        color: var(--nabad-muted-text);
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
        color: #2563eb;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 18px rgba(15,23,42,0.07);
      }

      .nabad-icon-btn:hover { background: #fff; }

      .nabad-icon-btn svg,
      #nabad-attach svg,
      #nabad-mic svg,
      #nabad-settings-back svg,
      .nabad-settings-row-icon svg,
      .nabad-path-icon svg,
      .nabad-speaker-btn svg,
      .nabad-memory-btn svg,
      .nabad-copy-btn svg {
        stroke: #2563eb !important;
        color: #2563eb !important;
      }

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
        overscroll-behavior-x: none;
        overscroll-behavior-y: contain;
      }

      .nabad-msg {
        display: flex;
        margin-bottom: 12px;
        position: relative;
      }

      .nabad-msg.user  { justify-content: flex-end; margin-bottom: 20px; }
      .nabad-msg.bot {
        justify-content: flex-start;
        animation: nabadBotAppear 0.35s ease-out both;
      }

      .nabad-user-reaction-floating {
        position: absolute;
        left: 9px;
        bottom: -13px;
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.74), rgba(255,255,255,0.36));
        border: 1px solid rgba(147,197,253,0.35);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        box-shadow:
          0 6px 18px rgba(15,23,42,0.18),
          0 0 0 1px rgba(255,255,255,0.16) inset;
        pointer-events: none;
        transform-origin: left bottom;
        animation: nabadReactionIn 300ms cubic-bezier(.2,.8,.2,1) both;
      }

      .nabad-user-reaction-floating svg {
        width: 14px;
        height: 14px;
        filter: drop-shadow(0 0 8px rgba(56,189,248,0.38));
      }

      @keyframes nabadReactionIn {
        0% {
          opacity: 0;
          transform: translateY(4px) scale(0.85);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
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
        touch-action: pan-y;
      }

      .nabad-msg.user .nabad-bubble {
        position: relative;
        overflow: visible;
        background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
        color: #fff;
        border-bottom-right-radius: 6px;
        box-shadow: 0 14px 34px rgba(37,99,235,0.16);
      }

      .nabad-user-attachment {
        margin-top: 8px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.28);
        background: rgba(255,255,255,0.14);
        overflow: hidden;
      }

      .nabad-user-attachment img {
        margin: 0;
        border-radius: 0;
        box-shadow: none;
        max-height: 180px;
        object-fit: cover;
      }

      .nabad-user-attachment-file {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 11px;
      }

      .nabad-user-attachment-file svg {
        flex-shrink: 0;
        stroke: #fff !important;
      }

      .nabad-user-attachment-file .meta {
        min-width: 0;
      }

      .nabad-user-attachment-file .name {
        font-size: 12px;
        font-weight: 700;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .nabad-user-attachment-file .sub {
        font-size: 11px;
        color: rgba(255,255,255,0.82);
      }

      .nabad-reply-quote {
        margin-bottom: 8px;
        padding: 7px 9px;
        border-radius: 10px;
        border-left: 3px solid rgba(255,255,255,0.85);
        background: rgba(255,255,255,0.14);
      }

      .nabad-msg.bot .nabad-reply-quote {
        border-left-color: #2563eb;
        background: #eff6ff;
      }

      .nabad-reply-quote .label {
        display: block;
        font-size: 10px;
        font-weight: 800;
        opacity: 0.9;
        margin-bottom: 2px;
      }

      .nabad-reply-quote .snippet {
        display: block;
        font-size: 12px;
        line-height: 1.35;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .nabad-reply-indicator {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: linear-gradient(135deg, #2563eb, #06b6d4);
        color: #fff;
        margin-bottom: 6px;
      }

      .nabad-reply-indicator svg {
        width: 11px;
        height: 11px;
        stroke: #fff !important;
      }

      .nabad-swipe-armed {
        box-shadow: 0 0 0 2px rgba(37,99,235,0.18), 0 14px 34px rgba(37,99,235,0.12) !important;
      }

      .nabad-msg.bot .nabad-bubble {
        background: rgba(255,255,255,0.96);
        color: #0f172a;
        border: 1px solid rgba(15,23,42,0.06);
        border-left: 3px solid var(--nabad-personality-color, #06b6d4);
        border-top-left-radius: 6px;
        border-bottom-left-radius: 6px;
        box-shadow: 0 10px 28px rgba(15,23,42,0.06);
        transition: border-color 0.6s ease, transform 0.18s ease, box-shadow 0.22s ease;
      }

      @media (min-width: 641px) {
        .nabad-msg.bot .nabad-bubble:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 34px rgba(15,23,42,0.09);
        }
      }

      .nabad-msg.bot .nabad-bubble.nabad-reply-pop {
        animation: nabadReplyPop 0.28s ease-out both;
      }

      @keyframes nabadReplyPop {
        0% { transform: translateY(6px) scale(0.985); opacity: 0.78; }
        100% { transform: translateY(0) scale(1); opacity: 1; }
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

      .nabad-msg.bot .nabad-bubble .nabad-collapse-content {
        position: relative;
        max-height: 230px;
        overflow: hidden;
        transition: max-height 0.24s ease;
      }

      .nabad-msg.bot .nabad-bubble .nabad-collapse-content::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 52px;
        background: linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.98));
        pointer-events: none;
      }

      .nabad-msg.bot .nabad-bubble.nabad-expanded .nabad-collapse-content {
        max-height: 2400px;
      }

      .nabad-msg.bot .nabad-bubble.nabad-expanded .nabad-collapse-content::after {
        display: none;
      }

      .nabad-load-more-btn {
        margin-top: 8px;
        border: 1px solid rgba(37,99,235,0.22);
        background: rgba(37,99,235,0.08);
        color: #1d4ed8;
        border-radius: 999px;
        padding: 5px 12px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.01em;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .nabad-load-more-btn:hover {
        background: rgba(37,99,235,0.14);
        border-color: rgba(37,99,235,0.35);
      }

      .nabad-bubble a {
        color: #2563eb;
        font-weight: 700;
        text-decoration: none;
      }

      .nabad-bubble a:hover { text-decoration: underline; }

      .nabad-bubble [data-nabad-card] {
        border-radius: 18px !important;
        box-shadow: 0 10px 26px rgba(15,23,42,0.07);
        overflow: hidden;
        transition: transform 0.2s ease, box-shadow 0.22s ease;
      }

      @media (min-width: 641px) {
        .nabad-bubble [data-nabad-card]:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 30px rgba(15,23,42,0.1);
        }
      }

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

      #nabad-intro {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-height: 100%;
        background: linear-gradient(180deg, #f7fbff 0%, #f2f8ff 100%);
        padding: 24px 16px 28px;
      }

      #nabad-intro-title {
        font-size: 26px;
        font-weight: 900;
        color: #0f172a;
        text-align: center;
        letter-spacing: -0.5px;
        margin-bottom: 8px;
        line-height: 1.25;
        font-family: var(--nabad-font-display);
      }

      #nabad-intro-subtitle {
        font-size: 13px;
        color: #64748b;
        text-align: center;
        max-width: 320px;
        line-height: 1.6;
        margin-bottom: 26px;
      }

      #nabad-intro-feature-list {
        width: 100%;
        max-width: 340px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 24px;
      }

      .nabad-intro-feature {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #fff;
        border: 1px solid rgba(15,23,42,0.06);
        border-radius: 14px;
        padding: 12px 14px;
        box-shadow: 0 3px 12px rgba(15,23,42,0.05);
      }

      .nabad-intro-feature-title {
        font-size: 13px;
        font-weight: 800;
        color: #0f172a;
      }

      .nabad-intro-feature-sub {
        font-size: 11px;
        color: #64748b;
        margin-top: 1px;
      }

      #nabad-intro-footnote {
        margin-top: 12px;
        font-size: 11px;
        color: #94a3b8;
        text-align: center;
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

      #nabad-typing-label {
        font-size: 12px;
        color: #64748b;
        letter-spacing: 0.01em;
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
        display: flex;
        flex-direction: column;
        padding: 12px 14px 14px;
        padding-bottom: max(14px, env(safe-area-inset-bottom));
        border-top: 1px solid rgba(15,23,42,0.06);
        background: linear-gradient(180deg, rgba(255,255,255,0.97) 0%, #f8fbff 100%);
        width: 100%;
        overflow: visible;
      }
      #nabad-quick-actions {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        scrollbar-width: thin;
        padding: 0 2px 6px;
        margin-bottom: 6px;
      }
      #nabad-quick-actions.hidden {
        display: none;
      }
      #nabad-quick-actions::-webkit-scrollbar {
        height: 6px;
      }
      #nabad-quick-actions::-webkit-scrollbar-thumb {
        background: rgba(37,99,235,.24);
        border-radius: 999px;
      }
      .nabad-action-chip {
        border: 1px solid rgba(37,99,235,.18);
        background: rgba(255,255,255,.95);
        color: #1e3a8a;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
        padding: 7px 11px;
        cursor: pointer;
        box-shadow: 0 6px 16px rgba(37,99,235,.08);
      }
      .nabad-action-chip.primary {
        color: #fff;
        border-color: transparent;
        background: linear-gradient(135deg,#2563eb,#06b6d4);
      }
      .nabad-inline-image-wrap {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 6px;
      }
      .nabad-inline-image-save {
        align-self: flex-start;
        border: 1px solid rgba(37,99,235,.2);
        background: rgba(255,255,255,.96);
        color: #1e3a8a;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }

      #nabad-composer-top {
        display: none;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 8px;
      }

      #nabad-composer-top.show {
        display: flex;
      }

      #nabad-reply-bar {
        display: none;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        border: 1px solid rgba(37,99,235,0.18);
        background: #eef6ff;
        border-radius: 10px;
        padding: 7px 8px;
        min-height: 34px;
      }

      #nabad-reply-bar.show {
        display: flex;
      }

      #nabad-reply-bar .reply-meta { min-width: 0; }
      #nabad-reply-bar .reply-label {
        font-size: 12px;
        font-weight: 800;
        color: #1e3a8a;
      }
      #nabad-reply-bar .reply-snippet {
        font-size: 11px;
        color: #334155;
        margin-top: 1px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #nabad-reply-bar .reply-cancel {
        border: none;
        background: transparent;
        color: #2563eb;
        cursor: pointer;
        font-weight: 800;
        font-size: 14px;
      }

      #nabad-input-row {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        width: 100%;
        overflow: visible;
      }

      #nabad-attach {
        width: 44px;
        height: 44px;
        border: none;
        border-radius: 16px;
        cursor: pointer;
        background: rgba(37,99,235,0.08);
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.2s ease;
      }

      #nabad-attach:hover {
        background: rgba(37,99,235,0.14);
      }

      #nabad-input {
        flex: 1;
        min-width: 0;
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

      #nabad-send:active,
      #nabad-attach:active,
      #nabad-mic:active,
      #nabad-send.nabad-press,
      #nabad-attach.nabad-press,
      #nabad-mic.nabad-press {
        transform: translateY(1px) scale(0.96);
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
        background: linear-gradient(180deg, #f7faff 0%, #ffffff 100%);
        border: 1px solid rgba(37,99,235,0.14);
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
        color: #1d4ed8;
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
        background: rgba(37,99,235,0.08);
        color: #1e40af;
        border-color: rgba(37,99,235,0.16);
      }

      .nabad-offer-divider {
        height: 1px;
        background: rgba(15,23,42,0.06);
        margin: 12px 0;
      }

      .nabad-bubble [data-nabad-card="matrix"] {
        background: linear-gradient(180deg, #f7faff 0%, #ffffff 100%);
        border: 1px solid rgba(37,99,235,0.14);
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
        background: rgba(37,99,235,0.06);
        border: 1px solid rgba(37,99,235,0.14);
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 13px;
        color: #1e3a8a;
        line-height: 1.5;
        margin-top: 12px;
      }

      .nabad-bubble [data-nabad-card="action-plan"] {
        background: linear-gradient(180deg, #f7faff 0%, #ffffff 100%);
        border: 1px solid rgba(37,99,235,0.14);
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
          background: linear-gradient(180deg, #f6faff 0%, #f4f9ff 100%);
        }

        #nabad-header {
          padding: max(12px, env(safe-area-inset-top)) 12px 10px;
          border-bottom-color: rgba(37,99,235,0.12);
        }

        #nabad-messages {
          flex: 1;
          min-height: 0;
          padding: 10px 10px 16px;
          -webkit-overflow-scrolling: touch;
        }

        #nabad-input-wrap {
          padding: 10px 10px max(12px, env(safe-area-inset-bottom));
          border-top-color: rgba(15,23,42,0.08);
        }

        #nabad-launcher {
          position: fixed;
          right: 14px;
          bottom: 14px;
          width: 60px;
          height: 60px;
        }

        #nabad-title { font-size: 17px; }
        #nabad-subtitle { font-size: 11px; }
        #nabad-logo {
          width: 38px;
          height: 38px;
        }
        .nabad-icon-btn {
          width: 34px;
          height: 34px;
          border-radius: 10px;
        }

        .nabad-msg { margin-bottom: 10px; }
        .nabad-bubble {
          max-width: 95%;
          padding: 12px 13px;
          font-size: 14px;
          line-height: 1.5;
          border-radius: 16px;
        }

        #nabad-input-row { gap: 8px; }
        #nabad-input {
          min-height: 46px;
          font-size: 15px;
          border-radius: 14px;
          padding: 11px 13px;
        }
        #nabad-send,
        #nabad-attach,
        #nabad-mic {
          width: 42px;
          height: 42px;
          border-radius: 14px;
        }

        #nabad-onboarding {
          padding: 6px 0 12px;
        }
        #nabad-onboarding h3 {
          font-size: 19px;
          margin-bottom: 6px;
        }
        #nabad-onboarding p {
          font-size: 13px;
          margin-bottom: 12px;
        }
        .nabad-path-card,
        .nabad-personality-card {
          border-radius: 16px;
          padding: 13px;
        }
        .nabad-path-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
        }
        .nabad-path-title {
          font-size: 14px;
        }
        .nabad-path-desc,
        .nabad-personality-desc {
          font-size: 12px;
          line-height: 1.4;
        }

        #nabad-intro {
          padding: max(16px, env(safe-area-inset-top)) 12px max(16px, env(safe-area-inset-bottom));
        }
        #nabad-intro-logo-wrap {
          width: 74px !important;
          height: 74px !important;
          margin-bottom: 20px !important;
        }
        #nabad-intro-logo-img {
          width: 74px !important;
          height: 74px !important;
        }
        #nabad-intro-title {
          font-size: 23px;
          margin-bottom: 6px;
        }
        #nabad-intro-subtitle {
          margin-bottom: 18px;
          font-size: 12px;
          line-height: 1.55;
          max-width: 300px;
        }
        #nabad-intro-feature-list {
          margin-bottom: 18px;
          gap: 8px;
        }
        .nabad-intro-feature {
          padding: 10px 12px;
          border-radius: 12px;
        }
        .nabad-intro-feature-title {
          font-size: 12px;
        }
        .nabad-intro-feature-sub {
          font-size: 10px;
        }
        #nabad-intro-start {
          max-width: 340px !important;
          padding: 14px !important;
          border-radius: 14px !important;
          font-size: 15px !important;
        }
        #nabad-intro-footnote {
          margin-top: 10px;
          font-size: 10px;
        }

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
        50%  { box-shadow: 0 0 0 9px rgba(37,99,235,0.15); }
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
        0%   { box-shadow: 0 0 0 0px var(--nabad-logo-thinking-strong, rgba(37,99,235,0.6)); }
        50%  { box-shadow: 0 0 0 10px var(--nabad-logo-thinking-soft, rgba(37,99,235,0.15)); }
        100% { box-shadow: 0 0 0 0px var(--nabad-logo-thinking-strong, rgba(37,99,235,0.6)); }
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

      #nabad-attachment-chip {
        display: none;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        border: 1px solid rgba(37,99,235,0.18);
        background: #f8fbff;
        border-radius: 12px;
        padding: 8px 10px;
      }

      #nabad-attachment-chip.show {
        display: flex;
      }

      #nabad-attachment-chip .nabad-attachment-label {
        flex: 1;
        min-width: 0;
        font-size: 12px;
        color: #1e3a8a;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #nabad-attachment-chip .nabad-attachment-preview {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        overflow: hidden;
        flex-shrink: 0;
        border: 1px solid rgba(37,99,235,0.12);
        background: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #nabad-attachment-chip .nabad-attachment-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      #nabad-attachment-chip .nabad-attachment-preview svg {
        width: 14px;
        height: 14px;
      }

      #nabad-attachment-chip .nabad-attachment-clear {
        flex-shrink: 0;
        border: none;
        background: transparent;
        color: #2563eb;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
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

      .nabad-copy-btn {
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
      .nabad-copy-btn:hover {
        background: rgba(37,99,235,0.12);
        border-color: rgba(37,99,235,0.3);
      }

      .nabad-bubble button[data-nabad-action] {
        font-family: inherit;
      }

      .nabad-image-choice-card {
        background: linear-gradient(180deg, #f7faff 0%, #eef6ff 100%);
        border: 1px solid rgba(37,99,235,0.16);
        border-radius: 16px;
        padding: 14px;
        margin: 8px 0;
        color: #0f172a;
      }

      .nabad-image-choice-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .nabad-image-choice-col {
        background: #fff;
        border: 1px solid rgba(37,99,235,0.12);
        border-radius: 12px;
        padding: 10px;
      }

      .nabad-image-choice-col strong {
        color: #1e3a8a;
      }

      .nabad-bubble button[data-nabad-action] {
        border: 1px solid rgba(37,99,235,0.2) !important;
        background: #fff !important;
        color: #1e3a8a !important;
        border-radius: 10px !important;
        padding: 8px 12px !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        transition: transform 0.16s ease, box-shadow 0.18s ease, background 0.18s ease !important;
      }

      .nabad-bubble button[data-nabad-action]:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 16px rgba(37,99,235,0.12);
        background: #f8fbff !important;
      }

      .nabad-bubble button[data-nabad-action="image-premium"] {
        background: linear-gradient(135deg, #2563eb, #06b6d4) !important;
        border-color: transparent !important;
        color: #fff !important;
      }

      .nabad-quick-choices {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 2px;
        margin-top: 8px;
      }

      .nabad-campaign-editor {
        margin-top: 10px;
        padding: 12px;
        background: linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%);
        border: 1px solid rgba(37,99,235,0.14);
        border-radius: 12px;
      }
      .nabad-campaign-editor.hidden {
        display: none;
      }
      .nabad-campaign-editor-title {
        font-size: 12px;
        font-weight: 800;
        color: #1e3a8a;
        margin-bottom: 8px;
      }
      .nabad-campaign-editor-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .nabad-campaign-editor-input {
        width: 100%;
        border: 1px solid rgba(37,99,235,0.2);
        border-radius: 10px;
        padding: 9px 10px;
        font-size: 12px;
        color: #0f172a;
        background: #fff;
        outline: none;
      }
      .nabad-campaign-editor-input:focus {
        border-color: rgba(37,99,235,0.4);
        box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
      }
      .nabad-campaign-editor-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 8px;
      }
      .nabad-campaign-editor-btn {
        border: 1px solid rgba(37,99,235,0.2);
        background: #fff;
        color: #1e3a8a;
        border-radius: 10px;
        padding: 8px 11px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .nabad-campaign-editor-btn.primary {
        background: linear-gradient(135deg, #2563eb, #06b6d4);
        border-color: transparent;
        color: #fff;
      }

      .nabad-campaign-template-stage {
        position: relative;
        width: 100%;
        border-radius: 16px;
        overflow: hidden;
        margin-top: 6px;
        box-shadow: 0 8px 18px rgba(15,23,42,0.18);
      }
      .nabad-campaign-template-bg {
        display: block;
        width: 100%;
        height: auto;
      }
      .nabad-campaign-template-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .nabad-campaign-template-text {
        position: absolute;
        pointer-events: auto;
        color: #fff;
        text-shadow: 0 2px 12px rgba(0,0,0,0.4);
        border-radius: 8px;
        padding: 4px 6px;
        line-height: 1.15;
        max-width: 84%;
        outline: none;
        user-select: text;
      }
      .nabad-campaign-template-text[data-field="headline"] {
        top: 9%;
        left: 8%;
        font-size: clamp(20px, 4.2vw, 44px);
        font-weight: 800;
      }
      .nabad-campaign-template-text[data-field="subline"] {
        bottom: 16%;
        left: 8%;
        font-size: clamp(12px, 1.9vw, 20px);
        font-weight: 600;
        opacity: 0.96;
      }
      .nabad-campaign-template-text[data-field="cta"] {
        bottom: 10%;
        right: 8%;
        left: auto;
        max-width: 42%;
        font-size: clamp(11px, 1.6vw, 18px);
        font-weight: 800;
        background: rgba(37,99,235,0.88);
        border: 1px solid rgba(255,255,255,0.45);
        box-shadow: 0 6px 14px rgba(0,0,0,0.2);
      }
      .nabad-campaign-template-logo {
        position: absolute;
        top: 8%;
        right: 8%;
        width: 14%;
        min-width: 54px;
        max-width: 120px;
        height: auto;
        object-fit: contain;
        filter: drop-shadow(0 3px 8px rgba(0,0,0,0.35));
        display: none;
        pointer-events: auto;
      }
      .nabad-campaign-template-stage.editing .nabad-campaign-template-text {
        background: rgba(15,23,42,0.25);
        outline: 1px dashed rgba(255,255,255,0.7);
      }
      .nabad-campaign-template-hint {
        margin-top: 8px;
        font-size: 11px;
        font-weight: 700;
        color: #1e3a8a;
        background: rgba(219,234,254,0.72);
        border: 1px solid rgba(37,99,235,0.18);
        border-radius: 10px;
        padding: 6px 10px;
      }
      .nabad-campaign-preview-card {
        background: linear-gradient(180deg,#f7faff 0%,#eef6ff 100%);
        border: 1px solid rgba(37,99,235,0.14);
        border-radius: 14px;
        padding: 12px;
        margin-top: 8px;
      }
      .nabad-campaign-preview-title {
        font-size: 16px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 8px;
      }
      .nabad-campaign-preview-row {
        font-size: 13px;
        color: #1e293b;
        margin-bottom: 6px;
      }
      .nabad-editor-shell {
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 10px 10px 12px;
        background: #eef3fb;
      }
      .nabad-editor-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        background: #ffffff;
        border: 1px solid rgba(37,99,235,0.16);
        border-radius: 12px;
        padding: 8px 10px;
      }
      .nabad-editor-top-left,
      .nabad-editor-top-right {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .nabad-editor-top-right {
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .nabad-editor-title {
        font-size: 14px;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: .01em;
      }
      .nabad-editor-divider {
        width: 1px;
        height: 22px;
        background: rgba(148,163,184,0.45);
      }
      .nabad-editor-btn {
        border: 1px solid rgba(37,99,235,0.2);
        background: #fff;
        color: #1e3a8a;
        border-radius: 10px;
        padding: 7px 10px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .nabad-editor-btn.with-icon {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .nabad-editor-btn .nabad-btn-icon {
        width: 14px;
        height: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 14px;
      }
      .nabad-editor-btn .nabad-btn-icon svg {
        width: 14px;
        height: 14px;
        display: block;
      }
      .nabad-editor-btn.primary {
        background: linear-gradient(135deg,#2563eb,#06b6d4);
        border-color: transparent;
        color: #fff;
      }
      .nabad-editor-select {
        height: 32px;
        border: 1px solid rgba(37,99,235,0.2);
        border-radius: 10px;
        padding: 0 8px;
        background: #fff;
        color: #1e3a8a;
        font-size: 12px;
        font-weight: 700;
      }
      .nabad-editor-custom-size {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .nabad-editor-custom-size[hidden] {
        display: none !important;
      }
      .nabad-editor-custom-size input {
        width: 80px;
        height: 32px;
        border: 1px solid rgba(37,99,235,0.2);
        border-radius: 10px;
        padding: 0 8px;
        background: #fff;
        color: #1e3a8a;
        font-size: 12px;
        font-weight: 700;
      }
      .nabad-editor-custom-size .sep {
        font-size: 12px;
        font-weight: 800;
        color: #1e3a8a;
      }
      .nabad-editor-workspace {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: 260px minmax(0, 1fr);
        gap: 0;
      }
      .nabad-editor-panel {
        background: #fff;
        border: 1px solid rgba(37,99,235,0.12);
        border-radius: 12px;
        padding: 10px;
        overflow: auto;
      }
      .nabad-editor-panel h4 {
        margin: 0 0 8px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: #2563eb;
      }
      .nabad-editor-layer-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .nabad-editor-layer-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        border: 1px solid rgba(37,99,235,0.16);
        border-radius: 10px;
        padding: 6px 8px;
        font-size: 12px;
        color: #1e293b;
      }
      .nabad-editor-layer-item .left {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .nabad-editor-panel .add-grid {
        margin-top: 12px;
        display: grid;
        grid-template-columns: 1fr;
        gap: 7px;
      }
      .nabad-editor-sidebar-section {
        padding-top: 0;
      }
      .nabad-editor-sidebar-section.with-divider {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #e2e8f0;
      }
      .nabad-editor-sidebar-section h4 {
        margin: 0 0 8px;
      }
      .nabad-editor-sidebar-section .add-grid {
        margin-top: 0;
      }
      .nabad-editor-sidebar-section .add-grid .nabad-editor-btn {
        width: 100%;
        box-sizing: border-box;
        border: none;
        border-left: 3px solid transparent;
        background: transparent;
        box-shadow: none;
        color: #0f172a;
        border-radius: 8px;
        padding: 8px 12px;
        text-align: left;
        font-weight: 700;
        transition: all 0.15s ease;
      }
      .nabad-editor-sidebar-section .add-grid .nabad-editor-btn:hover,
      .nabad-editor-sidebar-section .add-grid .nabad-editor-btn:focus-visible {
        border-left-color: #2563eb;
        background: #eff6ff;
        color: #2563eb;
        outline: none;
      }
      .nabad-editor-sidebar-section .add-grid .nabad-editor-btn:active,
      .nabad-editor-sidebar-section .add-grid .nabad-editor-btn.active {
        border-left-color: #2563eb;
        background: #2563eb;
        color: #ffffff;
      }
      .nabad-editor-sidebar-section .add-grid .nabad-editor-btn svg {
        stroke: currentColor;
        fill: currentColor;
      }
      .nabad-editor-action-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .nabad-editor-action-overlay[hidden] {
        display: none !important;
      }
      .nabad-editor-action-popup {
        background: #fff;
        border-radius: 16px;
        padding: 24px;
        min-width: 300px;
        max-width: 420px;
        width: 100%;
        box-sizing: border-box;
        box-shadow: 0 22px 60px rgba(2,6,23,0.28);
      }
      .nabad-editor-action-popup h4 {
        margin: 0 0 8px;
        font-size: 18px;
        color: #0f172a;
        letter-spacing: .01em;
      }
      .nabad-editor-action-popup p {
        margin: 0;
        font-size: 14px;
        line-height: 1.45;
        color: #475569;
      }
      .nabad-editor-stage {
        min-height: 320px;
        border: 0;
        border-radius: 0;
        overflow: hidden;
        background: transparent;
        position: relative;
        display: block;
        margin: 0;
        padding: 0;
      }
      .nabad-editor-canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
      #nabad-workspace {
        width: 100%;
        height: 100%;
        background: #e8edf3;
        background-image: radial-gradient(circle, #c5cdd8 1px, transparent 1px);
        background-size: 24px 24px;
        position: relative;
        overflow: hidden;
        margin: 0;
        padding: 0;
        user-select: none;
        -webkit-user-select: none;
        -webkit-user-drag: none;
        cursor: grab;
      }
      #nabad-canvas-viewport {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
        margin: 0;
        padding: 0;
        user-select: none;
        -webkit-user-select: none;
        -webkit-user-drag: none;
        cursor: inherit;
      }
      #nabad-workspace.nabad-panning,
      #nabad-workspace.nabad-panning #nabad-canvas-viewport {
        cursor: grabbing;
      }
      #nabad-canvas-stage {
        position: absolute;
        inset: 0;
        transform-origin: 0 0;
        user-select: none;
      }
      #nabad-canvas-stage:active {
        cursor: grabbing;
      }
      #nabad-campaign-card {
        position: absolute;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 10px 28px rgba(15,23,42,0.18);
        border: 1px solid rgba(255,255,255,0.62);
        background: #fff;
        z-index: 3;
      }
      #nabad-card-handle {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 12;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.4);
        background: rgba(15,23,42,0.42);
        color: #fff;
        font-size: 13px;
        font-weight: 700;
        cursor: move;
      }
      #nabad-zoom-controls {
        position: absolute;
        right: 24px;
        bottom: 24px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        z-index: 220;
      }
      #nabad-zoom-controls button {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        border: none;
        background: #fff;
        color: #0f172a;
        font-size: 16px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.10);
        transition: all .15s ease;
      }
      #nabad-zoom-controls button:hover {
        background: #eff6ff;
        color: #2563eb;
      }
      .nabad-editor-workspace-glow {
        position: absolute;
        inset: 0;
        z-index: 25;
        pointer-events: none;
        opacity: 0;
        transition: opacity .2s ease;
        backdrop-filter: blur(10px) saturate(1.12);
        -webkit-backdrop-filter: blur(10px) saturate(1.12);
        background:
          radial-gradient(ellipse at 18% 20%, rgba(56,189,248,0.26), transparent 52%),
          radial-gradient(ellipse at 82% 72%, rgba(37,99,235,0.3), transparent 56%),
          linear-gradient(180deg, rgba(8,47,73,0.28), rgba(15,23,42,0.34));
      }
      .nabad-editor-workspace-glow.show {
        opacity: 1;
      }
      .nabad-editor-workspace-glow .glow-center {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        border-radius: 999px;
        width: min(78vw, 860px);
        height: min(78vw, 860px);
        background: radial-gradient(circle, rgba(191,219,254,0.42) 0%, rgba(56,189,248,0.28) 32%, rgba(15,23,42,0) 72%);
        box-shadow: 0 0 70px rgba(56,189,248,0.34), 0 0 140px rgba(37,99,235,0.26);
        filter: blur(12px);
        animation: nabadWorkspaceGlowPulse 1s ease-in-out infinite;
      }
      .nabad-editor-workspace-glow .glow-label {
        display: none;
      }
      .nabad-editor-workspace-glow.mode-rewrite .glow-center {
        background: radial-gradient(circle, rgba(221,214,254,0.45) 0%, rgba(167,139,250,0.28) 34%, rgba(15,23,42,0) 74%);
        box-shadow: 0 0 70px rgba(167,139,250,0.34), 0 0 140px rgba(139,92,246,0.26);
      }
      .nabad-editor-workspace-glow.mode-removebg .glow-center {
        background: radial-gradient(circle, rgba(186,230,253,0.45) 0%, rgba(56,189,248,0.3) 36%, rgba(15,23,42,0) 74%);
        box-shadow: 0 0 70px rgba(56,189,248,0.36), 0 0 140px rgba(14,165,233,0.26);
      }
      .nabad-editor-new-project {
        position: absolute;
        inset: 0;
        z-index: 40;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(15,23,42,0.42);
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
      }
      .nabad-editor-new-project.show {
        display: flex;
      }
      .nabad-editor-new-project-card {
        width: min(92vw, 520px);
        background: #fff;
        border: 1px solid rgba(37,99,235,0.16);
        border-radius: 14px;
        box-shadow: 0 18px 36px rgba(15,23,42,0.2);
        padding: 14px;
      }
      .nabad-editor-new-project-title {
        font-size: 15px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 4px;
      }
      .nabad-editor-new-project-sub {
        font-size: 12px;
        color: #334155;
        margin-bottom: 10px;
      }
      .nabad-editor-new-project-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .nabad-editor-new-project-btn {
        border: 1px solid rgba(37,99,235,0.18);
        background: #fff;
        color: #1e3a8a;
        border-radius: 10px;
        padding: 10px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .nabad-editor-new-project-btn.active {
        background: linear-gradient(135deg,#2563eb,#06b6d4);
        color: #fff;
        border-color: transparent;
      }
      .nabad-editor-new-project-custom {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
      }
      .nabad-editor-new-project-custom input {
        width: 100px;
        height: 32px;
        border: 1px solid rgba(37,99,235,0.2);
        border-radius: 10px;
        padding: 0 8px;
        font-size: 12px;
        font-weight: 700;
        color: #1e3a8a;
      }
      .nabad-editor-new-project-actions {
        margin-top: 12px;
        display: flex;
        justify-content: flex-end;
      }
      @keyframes nabadWorkspaceGlowPulse {
        0%, 100% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.68; }
        50% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
      }
      .nabad-editor-inspector {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .nabad-editor-inspector[hidden] {
        display: none !important;
      }
      .nabad-editor-selected {
        font-size: 12px;
        font-weight: 800;
        color: #1e3a8a;
      }
      .nabad-editor-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 11px;
        color: #334155;
      }
      .nabad-editor-field input,
      .nabad-editor-field select {
        height: 30px;
        border: 1px solid rgba(37,99,235,0.2);
        border-radius: 8px;
        padding: 0 8px;
        font-size: 12px;
        color: #1e3a8a;
        font-weight: 700;
        background: #fff;
      }
      .nabad-editor-two-col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .nabad-editor-inline-actions {
        display: inline-flex;
        gap: 6px;
      }
      .nabad-editor-inline-actions button {
        min-width: 34px;
      }
      .nabad-editor-contextbar {
        background: #fff;
        border: 1px solid rgba(37,99,235,0.16);
        border-radius: 12px;
        padding: 8px;
        box-shadow: 0 -4px 16px rgba(15,23,42,0.08);
      }
      .nabad-editor-context-title {
        font-size: 11px;
        font-weight: 800;
        color: #1e3a8a;
        margin-bottom: 6px;
      }
      .nabad-editor-context-row {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }
      .nabad-editor-inline-label {
        font-size: 11px;
        color: #334155;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .nabad-editor-contextbar input[type="range"] {
        min-width: 110px;
      }
      @media (max-width: 1100px) {
        .nabad-editor-workspace {
          grid-template-columns: 1fr;
        }
        .nabad-editor-panel.left {
          order: 2;
        }
        .nabad-editor-stage {
          order: 1;
          min-height: 0;
          height: min(56vh, 420px);
          max-height: calc(100dvh - 260px);
        }
      }
      @media (max-width: 700px) {
        .nabad-editor-shell {
          padding: 6px;
          gap: 8px;
        }
        .nabad-editor-topbar {
          position: sticky;
          top: 0;
          z-index: 20;
          flex-wrap: wrap;
          align-items: stretch;
        }
        .nabad-editor-top-left,
        .nabad-editor-top-right {
          width: 100%;
        }
        .nabad-editor-top-left {
          justify-content: flex-start;
        }
        .nabad-editor-top-right {
          justify-content: flex-start;
          gap: 6px;
        }
        .nabad-editor-top-right .nabad-editor-select {
          flex: 1 1 180px;
          max-width: 100%;
        }
        .nabad-editor-top-left .nabad-editor-title {
          font-size: 13px;
        }
        .nabad-editor-panel.left,
        .nabad-editor-panel.right {
          max-height: min(34vh, 320px);
        }
        .nabad-editor-context-row {
          flex-wrap: nowrap;
          overflow-x: auto;
          white-space: nowrap;
          -webkit-overflow-scrolling: touch;
        }
        .nabad-editor-context-row .nabad-editor-btn,
        .nabad-editor-context-row input,
        .nabad-editor-context-row select {
          flex: 0 0 auto;
        }
        .nabad-editor-stage {
          height: min(48vh, 320px);
          max-height: calc(100dvh - 280px);
        }
      }
      .nabad-editor-shell.external-sidebar-mode .nabad-editor-workspace {
        grid-template-columns: 1fr;
        gap: 0;
      }
      .nabad-editor-shell.external-sidebar-mode .nabad-editor-panel.left,
      .nabad-editor-shell.external-sidebar-mode .nabad-editor-panel.right {
        display: none;
      }
      .nabad-editor-stage-busy {
        box-shadow: 0 0 0 1px rgba(37,99,235,0.2), 0 0 24px rgba(37,99,235,0.16);
      }
      .nabad-ai-sheet {
        position: absolute;
        left: 50%;
        top: 50%;
        bottom: auto;
        transform: translate(-50%, -50%) scale(0.96);
        width: min(90%, 520px);
        max-height: 40vh;
        z-index: 60;
        opacity: 0;
        transition: transform .22s ease, opacity .22s ease;
        pointer-events: none;
      }
      .nabad-ai-sheet.show {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }
      .nabad-ai-sheet-content {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        border-radius: 12px;
        padding: 10px 14px;
        background: rgba(255,255,255,0.92);
        border: 1px solid rgba(37,99,235,0.2);
        box-shadow: 0 10px 24px rgba(15,23,42,0.14);
      }
      .nabad-ai-sheet-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #2563eb;
        box-shadow: 0 0 12px rgba(37,99,235,0.75);
        animation: nabadEditorBusyDot 0.95s ease-in-out infinite;
      }
      #nabad-ai-sheet-text {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.2px;
        color: #1e3a8a;
      }
      .nabad-ai-sheet.mode-rewrite .nabad-ai-sheet-dot {
        background: #7c3aed;
        box-shadow: 0 0 14px rgba(124,58,237,0.85);
      }
      .nabad-ai-sheet.mode-regenerate .nabad-ai-sheet-dot {
        background: #06b6d4;
        box-shadow: 0 0 14px rgba(6,182,212,0.85);
      }
      .nabad-ai-sheet.mode-removebg .nabad-ai-sheet-dot {
        background: #0ea5e9;
        box-shadow: 0 0 14px rgba(14,165,233,0.85);
      }
      @keyframes nabadEditorBusyDot {
        0%, 100% { transform: scale(0.72); opacity: 0.5; }
        50% { transform: scale(1.22); opacity: 1; }
      }
      
      /* ── Settings Page ── */
#nabad-settings-page {
  position: absolute;
  inset: 0;
  background: #F7F9FC;
  z-index: 100;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 24px;
  overflow: hidden;
}

#nabad-settings-page.open {
  transform: translateX(0);
}

#nabad-settings-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 14px;
  background: #F7F9FC;
  border-bottom: 1px solid rgba(37,99,235,0.08);
  flex-shrink: 0;
}

#nabad-settings-back {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 12px;
  background: rgba(255,255,255,0.85);
  color: #2563eb;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(15,23,42,0.07);
  flex-shrink: 0;
}

#nabad-settings-back:hover { background: #fff; }

#nabad-settings-title {
  font-size: 17px;
  font-weight: 800;
  color: #0f172a;
}

#nabad-settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  -webkit-overflow-scrolling: touch;
}

.nabad-settings-section-label {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #94a3b8;
  margin-bottom: 10px;
}

.nabad-settings-card {
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  border-radius: 16px;
  border: 1px solid rgba(37,99,235,0.08);
  box-shadow: 0 8px 22px rgba(15,23,42,0.06);
  overflow: hidden;
}

.nabad-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 16px;
  gap: 12px;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}

.nabad-settings-row:hover {
  background: rgba(37,99,235,0.03);
  transform: translateX(1px);
}

.nabad-settings-row + .nabad-settings-row {
  border-top: 1px solid rgba(15,23,42,0.05);
}

.nabad-settings-row-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.nabad-settings-row-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(37,99,235,0.08);
}

.nabad-settings-row-icon svg {
  width: 18px;
  height: 18px;
  display: block;
}

.nabad-settings-row-icon.red {
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
}

.nabad-settings-row-label {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.nabad-settings-row-desc {
  font-size: 12px;
  color: #64748b;
  margin-top: 1px;
}

.nabad-settings-row-label.danger { color: #ef4444; }
.nabad-settings-row-arrow {
  color: #cbd5e1;
  font-size: 18px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
}

/* ── Auto-detect toggle ── */
.nabad-toggle-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  gap: 12px;
}

.nabad-toggle-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.nabad-toggle {
  position: relative;
  width: 46px;
  height: 26px;
  flex-shrink: 0;
}

.nabad-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.nabad-toggle-slider {
  position: absolute;
  inset: 0;
  background: #e2e8f0;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.25s ease;
}

.nabad-toggle-slider::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  transition: transform 0.25s ease;
}

.nabad-toggle input:checked + .nabad-toggle-slider {
  background: linear-gradient(135deg, #2563eb, #06b6d4);
}

.nabad-toggle input:checked + .nabad-toggle-slider::before {
  transform: translateX(20px);
}

/* ── Personality grid inside settings ── */
#nabad-settings-personality-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 16px 16px;
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              padding 0.3s ease,
              opacity 0.3s ease;
  opacity: 0;
}

#nabad-settings-personality-grid.visible {
  max-height: 700px;
  padding: 0 16px 16px;
  opacity: 1;
}

.nabad-settings-personality-chip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(37,99,235,0.10);
  background: rgba(255,255,255,0.98);
  cursor: pointer;
  transition: all 0.18s ease;
  box-shadow: 0 2px 8px rgba(15,23,42,0.04);
}

.nabad-settings-personality-chip:hover {
  border-color: rgba(37,99,235,0.25);
  background: #f8faff;
}

.nabad-settings-personality-chip.active {
  border-color: rgba(37,99,235,0.4);
  background: linear-gradient(135deg, #eff6ff, #f8faff);
  box-shadow: 0 4px 14px rgba(37,99,235,0.10);
}

.nabad-settings-personality-chip .chip-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nabad-settings-personality-chip .chip-text { flex: 1; min-width: 0; }

.nabad-settings-personality-chip .chip-name {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.nabad-settings-personality-chip .chip-desc {
  font-size: 11px;
  color: #64748b;
  margin-top: 1px;
}

.nabad-settings-personality-chip .chip-check {
  font-size: 16px;
  color: #2563eb;
  opacity: 0;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
}

.nabad-settings-personality-chip.active .chip-check { opacity: 1; }

@media (max-width: 640px) {
  #nabad-settings-page { border-radius: 0; }
}
      
    `;
    document.head.appendChild(style);
  }

  // ── SHELL ────────────────────────────────────────────────────
  function buildShell() {
    const root = document.createElement('div');
    root.id = 'nabad-widget-root';
    if (INLINE_MODE) root.classList.add('nabad-inline-app');

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
            <button class="nabad-icon-btn" id="nabad-new-chat" type="button" title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="9" cy="7" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="11" cy="17" r="1.8"/></svg>
            </button>
            <button class="nabad-icon-btn nabad-desktop-only" id="nabad-close" type="button" title="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div id="nabad-messages" aria-live="polite" aria-label="Chat messages"></div>

        <div id="nabad-typing">
          <div class="inner">
            <span class="nabad-dots"><span></span><span></span><span></span></span>
            <span id="nabad-typing-label">Nabad is thinking...</span>
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
          <div id="nabad-composer-top" aria-live="polite">
            <div id="nabad-attachment-chip"></div>
            <div id="nabad-reply-bar"></div>
          </div>
          <div id="nabad-quick-actions"></div>
          <div id="nabad-input-row">
            <button id="nabad-attach" type="button" aria-label="Attach file">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.44 11.05l-8.49 8.49a5 5 0 0 1-7.07-7.07l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95L9.76 18.5a2 2 0 0 1-2.83-2.83l8.13-8.13"/>
              </svg>
            </button>
            <textarea id="nabad-input" rows="1" placeholder="Ask Nabad anything..." enterkeyhint="send" autocomplete="off" autocorrect="on" autocapitalize="sentences" spellcheck="true"></textarea>
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
          <input id="nabad-file-input" type="file" hidden tabindex="-1" aria-hidden="true" accept="image/*,.pdf,.txt,.md,.json,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx" />
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

    const mountEl = INLINE_MODE && typeof CONFIG.mountSelector === 'string'
      ? document.querySelector(CONFIG.mountSelector)
      : null;
    (mountEl || document.body).appendChild(root);

    refs.root          = root;
    refs.launcher      = root.querySelector('#nabad-launcher');
    refs.panel         = root.querySelector('#nabad-panel');
    refs.header        = root.querySelector('#nabad-header');
    refs.messages      = root.querySelector('#nabad-messages');
    refs.input         = root.querySelector('#nabad-input');
    refs.send          = root.querySelector('#nabad-send');
    refs.attach        = root.querySelector('#nabad-attach');
    refs.fileInput     = root.querySelector('#nabad-file-input');
    refs.attachmentChip = root.querySelector('#nabad-attachment-chip');
    refs.replyBar      = root.querySelector('#nabad-reply-bar');
    refs.quickActions  = root.querySelector('#nabad-quick-actions');
    refs.badge         = root.querySelector('#nabad-selected-personality');
    refs.typing        = root.querySelector('#nabad-typing');
    refs.lightbox      = root.querySelector('#nabad-lightbox');
    refs.lightboxImg   = root.querySelector('#nabad-lightbox-img');
    refs.lightboxSave  = root.querySelector('#nabad-lightbox-save');
    refs.lightboxOpen  = root.querySelector('#nabad-lightbox-open');
    refs.lightboxClose = root.querySelector('#nabad-lightbox-close');

    bindEvents(root);
    updatePersonalityBadge();
    renderReplyBar();
    setInputPlaceholder();
    applyPersonalityColor(state.personality, false);
    renderInitialState();
  }

  // ── EVENTS ───────────────────────────────────────────────────
  function bindEvents(root) {
    root.querySelector('#nabad-new-chat').addEventListener('click', openSettingsPage);
    root.querySelector('#nabad-close').addEventListener('click', () => toggleWidget(false));
    root.querySelector('#nabad-send').addEventListener('click', sendMessage);
    bindTapFeedback(root.querySelector('#nabad-send'));
    if (refs.attach) {
      bindTapFeedback(refs.attach);
      refs.attach.addEventListener('click', () => refs.fileInput?.click());
    }
    if (refs.fileInput) {
      refs.fileInput.addEventListener('change', handleAttachmentSelected);
    }

    const mic = root.querySelector('#nabad-mic');
    if (mic) {
      bindTapFeedback(mic);
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
    refs.quickActions?.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('[data-nabad-quick-action]');
      if (!btn || !refs.input) return;
      const action = btn.getAttribute('data-nabad-quick-action');
      if (action === 'reopen') {
        state.quickActionsPinned = true;
        renderQuickActions();
        return;
      }
      if (action === 'collapse') {
        state.quickActionsPinned = false;
        renderQuickActions();
        return;
      }
      if (action === 'prompt') {
        const prompt = cleanText(btn.getAttribute('data-prompt') || '', 300);
        if (!prompt) return;
        refs.input.value = prompt;
        autoGrowTextarea();
        refs.input.focus();
      }
    });

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
      await downloadImageFromUrl(currentLightboxSrc, 'nabad-generated-image.png');
    });

    refs.lightboxOpen.addEventListener('click', () => {
      if (!currentLightboxSrc) return;
      window.open(currentLightboxSrc, '_blank', 'noopener,noreferrer');
    });

    window.addEventListener('beforeunload', releaseScrollLock);
  }

  function bindTapFeedback(el) {
    if (!el) return;
    const press = () => el.classList.add('nabad-press');
    const release = () => el.classList.remove('nabad-press');
    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', release);
    el.addEventListener('mouseleave', release);
    el.addEventListener('touchstart', press, { passive: true });
    el.addEventListener('touchend', release, { passive: true });
    el.addEventListener('touchcancel', release, { passive: true });
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
    if (INLINE_MODE) {
      state.open = true;
      refs.panel.classList.add('open');
      refs.panel.setAttribute('aria-hidden', 'false');
      refs.root.classList.add('nabad-open');
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
      }, 0);
      return;
    }
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
      }, 400);
    } else {
      releaseScrollLock();
    }
  }

  function setActivePersonality(id = 'auto', { announce = false } = {}) {
    const allowed = new Set([
      'strategist', 'growth', 'branding', 'offer', 'creative', 'straight_talk', 'auto'
    ]);
    const nextId = allowed.has(id) ? id : 'auto';
    const prevId = state.personality;

    state.personality = nextId;
    state.autoDetectMode = nextId === 'auto';
    state.personalityChosen = true;
    state.onboarded = true;
    state.personalityBuffer = null;
    state.personalityCount = 0;
    state.personalityScore = 0;

    savePersonality(nextId);
    saveAutoDetect(state.autoDetectMode);
    saveOnboarded(true);
    updatePersonalityBadge();
    setInputPlaceholder();
    applyPersonalityColor(nextId, announce && prevId !== nextId);

    if (!state.messages.length && refs.messages) {
      refs.messages.innerHTML = '';
      renderMessage('assistant', getPersonalityGreeting(nextId), false);
      scrollToBottom();
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
    if (state.messages.length) return false;
    return state.dailyFocusDate !== getTodayKey();
  }

  async function showMorningBrief() {
    state.briefShown = true;
    state.dailyFocusDate = getTodayKey();
    saveDailyFocusDate(state.dailyFocusDate);

    refs.messages.innerHTML = `
      <div id="nabad-morning-brief">
        <div class="nabad-brief-hero">
          <div class="nabad-brief-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <div class="nabad-brief-title">☀️ Daily Focus</div>
          <div class="nabad-brief-subtitle">Building today’s focus brief...</div>
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
              content: `Generate a daily focus brief for this founder. Return ONLY valid JSON, no markdown, no explanation:
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
          memoryKey: getMemoryKey(),
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
            <div class="nabad-brief-title">☀️ Daily Focus</div>
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
    state.messages.forEach(m => renderMessage(m.role, m.content, false, m));
    scrollToBottom();
  }

function renderOnboardingIntro() {
  document.getElementById('nabad-input-wrap').style.display = 'none';
  document.getElementById('nabad-header').style.display = 'none';
  refs.messages.style.overflow = 'auto';

  const pulseColors = [
    { r: 37,  g: 99,  b: 235 },
    { r: 22,  g: 163, b: 74  },
    { r: 147, g: 51,  b: 234 },
    { r: 234, g: 88,  b: 12  },
    { r: 219, g: 39,  b: 119 },
    { r: 220, g: 38,  b: 38  },
    { r: 6,   g: 182, b: 212 }
  ];
  let colorIndex = 0;

  document.getElementById('nabad-intro-pulse-style')?.remove();
  const pulseStyle = document.createElement('style');
  pulseStyle.id = 'nabad-intro-pulse-style';
  document.head.appendChild(pulseStyle);

  refs.messages.innerHTML = `
    <div id="nabad-intro">

      <div id="nabad-intro-logo-wrap" style="position:relative;width:82px;height:82px;margin-bottom:28px;display:flex;align-items:center;justify-content:center;">
        <img id="nabad-intro-logo-img" src="/logo.png" alt="Nabad" style="width:82px;height:82px;border-radius:50%;object-fit:cover;position:relative;z-index:1;transition:transform 0.1s ease-out;"/>
      </div>

      <div id="nabad-intro-title">Your business,<br/>finally has a co-founder.</div>
      <div id="nabad-intro-subtitle">Nabad thinks, adapts, and learns — built for people serious about building something real.</div>

      <div id="nabad-intro-feature-list">
        <div class="nabad-intro-feature">
          <span style="font-size:20px;">🧠</span>
          <div>
            <div class="nabad-intro-feature-title">Adapts to your business mode</div>
            <div class="nabad-intro-feature-sub">Strategy, growth, branding & more</div>
          </div>
        </div>
        <div class="nabad-intro-feature">
          <span style="font-size:20px;">🎙️</span>
          <div>
            <div class="nabad-intro-feature-title">Talk, don't type</div>
            <div class="nabad-intro-feature-sub">Voice-first, hands-free business thinking</div>
          </div>
        </div>
        <div class="nabad-intro-feature">
          <span style="font-size:20px;">⚡</span>
          <div>
            <div class="nabad-intro-feature-title">Instant answers, real actions</div>
            <div class="nabad-intro-feature-sub">Not just chat — a thinking partner</div>
          </div>
        </div>
      </div>

      <button id="nabad-intro-start" style="width:100%;max-width:320px;padding:16px;background:linear-gradient(135deg,#2563eb,#06b6d4);color:#fff;font-size:16px;font-weight:800;border:none;border-radius:16px;cursor:pointer;box-shadow:0 8px 28px rgba(37,99,235,0.25);transition:transform 0.15s,box-shadow 0.15s;">
        Let's build something →
      </button>
      <div id="nabad-intro-footnote">No credit card · No setup · Just start</div>
    </div>
  `;

  // ── PULSE BLOCK ──
  function lerpColor(a, b, t) {
    return {
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t)
    };
  }

  let lerpProgress = 0;
  let animFrame;

  function animatePulse() {
    if (!document.getElementById('nabad-intro-logo-wrap')) return;
    lerpProgress += 0.006;
    if (lerpProgress >= 1) {
      lerpProgress = 0;
      colorIndex = (colorIndex + 1) % pulseColors.length;
    }
    const c = lerpColor(
      pulseColors[colorIndex],
      pulseColors[(colorIndex + 1) % pulseColors.length],
      lerpProgress
    );

    // Scale in/out synced with ring
    const logoImg = document.getElementById('nabad-intro-logo-img');
    if (logoImg) {
      const scale = 1 + 0.045 * Math.sin(lerpProgress * Math.PI);
      logoImg.style.transform = `scale(${scale})`;
    }

    pulseStyle.textContent = `
      @keyframes nabadIntroPulse {
        0%   { box-shadow: 0 0 0 0px  rgba(${c.r},${c.g},${c.b},0.55); }
        60%  { box-shadow: 0 0 0 18px rgba(${c.r},${c.g},${c.b},0.0);  }
        100% { box-shadow: 0 0 0 0px  rgba(${c.r},${c.g},${c.b},0.0);  }
      }
      #nabad-intro-logo-wrap {
        animation: nabadIntroPulse 1.4s ease-out infinite;
        border-radius: 50%;
      }
    `;
    animFrame = requestAnimationFrame(animatePulse);
  }
  animatePulse();
  // ── END PULSE BLOCK ──

  // ── Button interactions ──
  const startBtn = document.getElementById('nabad-intro-start');
  if (startBtn) {
    startBtn.addEventListener('mouseenter', () => {
      startBtn.style.transform = 'translateY(-2px)';
      startBtn.style.boxShadow = '0 12px 32px rgba(37,99,235,0.35)';
    });
    startBtn.addEventListener('mouseleave', () => {
      startBtn.style.transform = 'translateY(0)';
      startBtn.style.boxShadow = '0 8px 28px rgba(37,99,235,0.25)';
    });
    startBtn.addEventListener('click', () => {
      cancelAnimationFrame(animFrame);
      document.getElementById('nabad-intro-pulse-style')?.remove();
      refs.messages.style.background = '';
      document.getElementById('nabad-header').style.display = 'flex';
      startChatFromIntro();
    });
  }

  scrollToBottom();
}

function startChatFromIntro() {
  state.personality       = 'auto';
  state.autoDetectMode    = true;
  state.personalityChosen = true;
  state.onboarded         = true;
  state.personalityBuffer = null;
  state.personalityCount  = 0;
  state.personalityScore  = 0;
  savePersonality('auto');
  saveAutoDetect(true);
  saveOnboarded();
  updatePersonalityBadge();
  setInputPlaceholder();
  applyPersonalityColor('auto', false);
  document.getElementById('nabad-input-wrap').style.display = 'flex';
  refs.messages.innerHTML = '';
  renderMessage('assistant', `<p>Tell me what you want to build, or tap one:</p>
    <div class="nabad-quick-choices">
      <button data-nabad-action="onboard-business">I have a business</button>
      <button data-nabad-action="onboard-idea">I have an idea</button>
      <button data-nabad-action="onboard-figuring">I’m figuring it out</button>
    </div>`, false);
  setTimeout(() => { refs.input.focus(); scrollToBottom(); }, 50);
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
      finishOnboarding();
    });

    refs.messages.querySelector('#nabad-ob-back').addEventListener('click', () => {
      renderOnboardingScreen1();
    });

    refs.messages.querySelector('#nabad-ob-skip').addEventListener('click', () => {
      state.userProfile = { path: state.onboardingPath };
      saveUserProfile(state.userProfile);
      finishOnboarding();
    });

    scrollToBottom();
  }

function finishOnboarding() {
  state.personality       = 'auto';
  state.autoDetectMode    = true;
  state.personalityChosen = true;
  state.onboarded         = true;
  state.personalityBuffer = null;
  state.personalityCount  = 0;
  state.personalityScore  = 0;
  savePersonality('auto');
  saveAutoDetect(true);
  saveOnboarded();
  updatePersonalityBadge();
  setInputPlaceholder();
  applyPersonalityColor('auto', false);
  document.getElementById('nabad-input-wrap').style.display = 'flex';
  refs.messages.innerHTML = '';
  renderMessage('assistant', getPersonalityGreeting('auto'), false);
  setTimeout(() => { refs.input.focus(); scrollToBottom(); }, 50);
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
        state.autoDetectMode    = state.personality === 'auto';
        state.personalityChosen = true;
        state.onboarded         = true;
        state.personalityBuffer = null;
        state.personalityCount  = 0;
        state.personalityScore  = 0;
        savePersonality(state.personality);
        saveAutoDetect(state.autoDetectMode);
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

  function clearPlaceholderTimer(placeholder) {
    if (!placeholder) return;
    const id = placeholder.dataset.intervalId;
    if (id) clearInterval(Number(id));
  }

  function markdownToHtml(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  function normalizeAssistantContent(content = '') {
    return String(content || '')
      .replace(/^\s*data-nabad-[^\n]*$/gmi, '')
      .replace(/onerror="[^"]*"/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  const LONG_REPLY_CHAR_LIMIT = 780;
  const LONG_REPLY_LINE_LIMIT = 10;

  function shouldCollapseAssistantReply(rawContent = '', bubble = null) {
    if (!bubble) return false;
    if (
      bubble.querySelector('[data-nabad-card], table, img, .nabad-inline-image-wrap, .nabad-img-placeholder, pre, code, blockquote')
    ) {
      return false;
    }
    const plain = cleanText(toPlainText(rawContent), 12000);
    if (!plain) return false;
    const lines = plain.split(/\n+/).filter(Boolean).length;
    return plain.length >= LONG_REPLY_CHAR_LIMIT || lines >= LONG_REPLY_LINE_LIMIT;
  }

  function attachAssistantLoadMore(bubble, contentWrap, rawContent = '') {
    if (!bubble || !contentWrap) return;
    if (!shouldCollapseAssistantReply(rawContent, bubble)) return;

    bubble.classList.add('nabad-has-load-more');
    contentWrap.classList.add('nabad-collapse-content');
    contentWrap.dataset.expanded = 'false';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'nabad-load-more-btn';
    toggleBtn.textContent = 'Load more';
    toggleBtn.setAttribute('aria-expanded', 'false');

    toggleBtn.addEventListener('click', () => {
      const expanded = bubble.classList.toggle('nabad-expanded');
      contentWrap.dataset.expanded = expanded ? 'true' : 'false';
      toggleBtn.textContent = expanded ? 'Show less' : 'Load more';
      toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if (!expanded) {
        requestAnimationFrame(() => {
          const top = bubble.getBoundingClientRect().top + window.scrollY - 84;
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        });
      }
    });

    bubble.appendChild(toggleBtn);
  }

  function formatSize(bytes = 0) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  function renderUserAttachmentHtml(attachment = null) {
    if (!attachment) return '';
    if (attachment.kind === 'image' && attachment.dataUrl) {
      return `<div class="nabad-user-attachment"><img src="${attachment.dataUrl}" alt="${escapeHtml(attachment.name || 'attachment')}" /></div>`;
    }
    return `<div class="nabad-user-attachment">
      <div class="nabad-user-attachment-file">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <div class="meta">
          <div class="name">${escapeHtml(attachment.name || 'Attachment')}</div>
          <div class="sub">${escapeHtml(attachment.sizeLabel || '')}${attachment.type ? ` · ${escapeHtml(attachment.type)}` : ''}</div>
        </div>
      </div>
    </div>`;
  }

  function clearPendingAttachment() {
    state.pendingAttachment = null;
    if (refs.attachmentChip) {
      refs.attachmentChip.classList.remove('show');
      refs.attachmentChip.innerHTML = '';
    }
    syncComposerTop();
    if (refs.fileInput) refs.fileInput.value = '';
  }

  function renderAttachmentChip() {
    if (!refs.attachmentChip) return;
    const file = state.pendingAttachment;
    if (!file) {
      refs.attachmentChip.classList.remove('show');
      refs.attachmentChip.innerHTML = '';
      syncComposerTop();
      return;
    }
    const previewHtml = file.kind === 'image' && file.dataUrl
      ? `<span class="nabad-attachment-preview"><img src="${file.dataUrl}" alt="${escapeHtml(file.name || 'attachment preview')}" /></span>`
      : `<span class="nabad-attachment-preview"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>`;
    refs.attachmentChip.innerHTML = `
      ${previewHtml}
      <span class="nabad-attachment-label">Attached: ${escapeHtml(file.name)} ${file.sizeLabel ? `(${escapeHtml(file.sizeLabel)})` : ''}</span>
      <button type="button" class="nabad-attachment-clear">Remove</button>
    `;
    refs.attachmentChip.classList.add('show');
    refs.attachmentChip.querySelector('.nabad-attachment-clear')?.addEventListener('click', clearPendingAttachment);
    syncComposerTop();
  }

  function syncComposerTop() {
    const top = document.getElementById('nabad-composer-top');
    if (!top) return;
    const hasAttachment = !!(refs.attachmentChip && refs.attachmentChip.classList.contains('show'));
    const hasReply = !!(refs.replyBar && refs.replyBar.classList.contains('show'));
    top.classList.toggle('show', hasAttachment || hasReply);
  }

  async function handleAttachmentSelected(e) {
    const file = e?.target?.files?.[0];
    if (!file) return;

    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      renderMessage('assistant', '<p>⚠️ Keep files under 2MB for fast analysis. Please upload a smaller file.</p>');
      clearPendingAttachment();
      return;
    }

    const entry = {
      name: file.name || 'attachment',
      type: file.type || '',
      size: file.size || 0,
      sizeLabel: formatSize(file.size || 0)
    };

    try {
      if (/^image\//i.test(file.type)) {
        entry.kind = 'image';
        entry.dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result || ''));
          fr.onerror = reject;
          fr.readAsDataURL(file);
        });
        state.lastImageAttachment = {
          ...entry,
          dataUrl: String(entry.dataUrl || '')
        };
      } else if (/text|json|csv|markdown|md/i.test(file.type) || /\.(txt|md|json|csv)$/i.test(file.name || '')) {
        entry.kind = 'text';
        const raw = await file.text();
        entry.text = cleanText(raw, 4200);
      } else {
        entry.kind = 'document';
        entry.dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result || ''));
          fr.onerror = reject;
          fr.readAsDataURL(file);
        });
      }
    } catch {
      renderMessage('assistant', '<p>⚠️ Could not read that file. Please try another one.</p>');
      clearPendingAttachment();
      return;
    }

    if (state.campaignRefineAction === 'logo-template') {
      if (entry.kind !== 'image') {
        state.campaignRefineAction = null;
        state.campaignEditBubble = null;
        renderMessage('assistant', '<p>Please upload an image file for logo replacement.</p>');
        if (refs.fileInput) refs.fileInput.value = '';
        return;
      }
      const targetBubble = state.campaignEditBubble;
      state.campaignRefineAction = null;
      state.campaignEditBubble = null;
      const stage = ensureCampaignTemplateStage(targetBubble);
      if (stage) {
        applyLogoToCampaignStage(stage, String(entry.dataUrl || ''));
        stage.classList.add('editing');
      } else {
        await sendMessage({
          forcedText: 'Campaign refine logo: replace with uploaded logo',
          forcedAttachment: entry
        });
      }
      if (refs.fileInput) refs.fileInput.value = '';
      return;
    }

    state.pendingAttachment = entry;
    renderAttachmentChip();
  }

  function extractReplyFromContent(content = null, fallback = null) {
    if (content && typeof content === 'object' && !Array.isArray(content) && content.replyTo) {
      return content.replyTo;
    }
    if (fallback && typeof fallback === 'object' && fallback.replyTo) {
      return fallback.replyTo;
    }
    return null;
  }

  function bindReplyGesture(msgEl, bubble, role, content, id) {
    // Swipe-to-reply caused layout jumps on touch devices; keep a stable button UX there.
    if ('ontouchstart' in window) return;
    const snippet = cleanText(toPlainText(content), 180);
    if (!snippet) return;
    const target = { id, role, snippet };
    let touchStartX = 0;
    let touchStartY = 0;
    let swipeDx = 0;
    let swiping = false;
    let swipeArmed = false;
    let axisLock = '';

    bubble.addEventListener('touchstart', (e) => {
      const targetEl = e.target;
      if (targetEl && targetEl.closest && targetEl.closest('button,a,img,input,textarea')) return;
      const t = e.touches?.[0];
      if (!t) return;
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      swipeDx = 0;
      swiping = false;
      swipeArmed = false;
      axisLock = '';
      bubble.style.transition = '';
    }, { passive: true });

    bubble.addEventListener('touchmove', (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (!axisLock) {
        if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
        axisLock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (axisLock === 'y') {
        return;
      }
      if (dx >= 0) {
        bubble.style.transform = 'translateX(0px)';
        bubble.classList.remove('nabad-swipe-armed');
        swipeDx = 0;
        swipeArmed = false;
        return;
      }
      e.preventDefault();
      if (Math.abs(dx) < 8) return;
      swiping = true;
      swipeDx = dx;
      const max = 60;
      const damped = Math.max(-max, dx * 0.5);
      bubble.style.transform = `translateX(${damped}px)`;
      bubble.classList.toggle('nabad-swipe-armed', Math.abs(damped) >= 30);
      swipeArmed = Math.abs(damped) >= 30;
    }, { passive: false });

    bubble.addEventListener('touchend', (e) => {
      if (swiping) {
        bubble.style.transition = 'transform 180ms ease, box-shadow 180ms ease';
        bubble.style.transform = 'translateX(0px)';
        bubble.classList.remove('nabad-swipe-armed');
        if (swipeArmed || swipeDx < -46) {
          setReplyTarget(target);
          if (navigator.vibrate) navigator.vibrate(8);
        }
        setTimeout(() => { bubble.style.transition = ''; }, 200);
        swiping = false;
        swipeArmed = false;
        axisLock = '';
        return;
      }
      axisLock = '';
    }, { passive: true });
  }

  function buildReplyActionButton(target = null) {
    if (!target || !target.id) return null;
    const btn = document.createElement('button');
    btn.className = 'nabad-copy-btn';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17l-5-5 5-5"/><path d="M20 19v-2a5 5 0 0 0-5-5H4"/></svg>`;
    btn.title = 'Reply to this message';
    btn.addEventListener('click', () => setReplyTarget(target));
    return btn;
  }

  // ── RENDER MESSAGE ────────────────────────────────────────────
  function renderMessage(role, content, persist = true, meta = null) {
    const isUser = role === 'user';
    const messageId = cleanText((meta && meta.id) || '', 48) || makeMessageId();
    const replyTo = extractReplyFromContent(content, meta);
    const msg    = document.createElement('div');
    msg.className = `nabad-msg ${isUser ? 'user' : 'bot'}`;
    msg.dataset.msgId = messageId;

    const bubble = document.createElement('div');
    bubble.className = 'nabad-bubble';

    const replyQuoteHtml = replyTo
      ? `<span class="nabad-reply-indicator" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17l-5-5 5-5"/><path d="M20 19v-2a5 5 0 0 0-5-5H4"/></svg></span><div class="nabad-reply-quote"><span class="label">${escapeHtml(buildReplyLabel(replyTo.role || 'assistant'))}</span><span class="snippet">${escapeHtml(replyTo.snippet || '')}</span></div>`
      : '';

    if (isUser) {
      if (content && typeof content === 'object' && !Array.isArray(content)) {
        const userText = escapeHtml(String(content.text || '')).replace(/\n/g, '<br>');
        const attachmentHtml = renderUserAttachmentHtml(content.attachment || null);
        bubble.innerHTML = `${replyQuoteHtml}${userText ? `<p>${userText}</p>` : ''}${attachmentHtml}`;
      } else {
        bubble.innerHTML = `${replyQuoteHtml}<p>${escapeHtml(String(content || '')).replace(/\n/g, '<br>')}</p>`;
      }
    } else {
      bubble.innerHTML = sanitizeHtml(
        `${replyQuoteHtml}${markdownToHtml(normalizeAssistantContent(String(content || '<p>Sorry — I could not generate a response.</p>')))}`
      );

      const assistantContentWrap = document.createElement('div');
      assistantContentWrap.className = 'nabad-assistant-content';
      while (bubble.firstChild) assistantContentWrap.appendChild(bubble.firstChild);
      bubble.appendChild(assistantContentWrap);

      bubble.classList.add('nabad-reply-pop');
      bubble.addEventListener('animationend', () => {
        bubble.classList.remove('nabad-reply-pop');
      }, { once: true });
    }

    msg.appendChild(bubble);
    refs.messages.appendChild(msg);
    bindReplyGesture(msg, bubble, role, content && typeof content === 'object' ? content.text || '' : content, messageId);

    const replyTarget = {
      id: messageId,
      role: isUser ? 'user' : 'assistant',
      snippet: cleanText(toPlainText(content && typeof content === 'object' ? content.text || '' : content), 180)
    };

    if (!isUser) {
      processAssistantBubble(bubble);
      const contentWrap = bubble.querySelector('.nabad-assistant-content');
      attachAssistantLoadMore(bubble, contentWrap, content);

      // ── Speaker button ──
      const speakerBtn = document.createElement('button');
      speakerBtn.className = 'nabad-speaker-btn';
      speakerBtn.innerHTML = SPEAKER_ICON_SVG;
      speakerBtn.title = 'Tap to hear this reply';
      speakerBtn.addEventListener('click', () => {
        const browserSpeaking = ('speechSynthesis' in window) && window.speechSynthesis.speaking;
        if ((currentAudio && !currentAudio.paused) || browserSpeaking) {
          stopCurrentSpeech();
          resetSpeakerButton(speakerBtn);
        } else {
          speakReply(content, speakerBtn);
        }
      });

      const copyBtn = document.createElement('button');
      copyBtn.className = 'nabad-copy-btn';
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      copyBtn.title = 'Copy message';
      copyBtn.addEventListener('click', async () => {
        const rawText = toPlainText(content).slice(0, 6000);
        if (!rawText) return;
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(rawText);
          } else {
            const ta = document.createElement('textarea');
            ta.value = rawText;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            ta.remove();
          }
          copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
          copyBtn.title = 'Copied';
          setTimeout(() => {
            copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
            copyBtn.title = 'Copy message';
          }, 1200);
        } catch {}
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
          const clean = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
          const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              saveInsight: true,
              insightText: clean,
              memoryKey: getMemoryKey(),
              userProfile: buildProfileSummary()
            })
          });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);

          const insights = JSON.parse(localStorage.getItem('nabad_insights') || '[]');
          insights.push({ text: clean, date: new Date().toLocaleDateString() });
          localStorage.setItem('nabad_insights', JSON.stringify(insights.slice(-40)));

          memoryBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
          memoryBtn.dataset.saved = 'true';
          memoryBtn.title = 'Saved to memory!';

        } catch {
  memoryBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`;
}
      });

      const btnRow = document.createElement('div');
      btnRow.className = 'nabad-btn-row';
      btnRow.appendChild(speakerBtn);
      const replyBtn = buildReplyActionButton(replyTarget);
      if (replyBtn) btnRow.appendChild(replyBtn);
      btnRow.appendChild(copyBtn);
      btnRow.appendChild(memoryBtn);
      bubble.appendChild(btnRow);
    }

    if (persist) {
      if (isUser && content && typeof content === 'object' && !Array.isArray(content)) {
        const persisted = [String(content.text || '').trim(), content.attachment ? `[Attached ${content.attachment.kind || 'file'}: ${content.attachment.name || 'attachment'}]` : '']
          .filter(Boolean)
          .join('\n');
        state.messages.push({ id: messageId, role, content: persisted, replyTo: replyTo || null });
      } else {
        state.messages.push({ id: messageId, role, content, replyTo: replyTo || null });
      }
      saveMessages();
    }

    renderQuickActions();
    scrollToBottom();
    return bubble;
  }

  function togglePricingCardEdit(cardEl, triggerBtn = null) {
    if (!cardEl) return;
    const isEditing = cardEl.dataset.pricingEditMode === 'true';
    const fields = cardEl.querySelectorAll('[data-pricing-title],[data-pricing-subtitle],[data-pricing-name],[data-pricing-price],[data-pricing-period],[data-pricing-desc],[data-pricing-feature],[data-pricing-cta]');
    fields.forEach((el) => {
      if (isEditing) {
        el.removeAttribute('contenteditable');
        el.style.outline = '';
        el.style.background = '';
      } else {
        el.setAttribute('contenteditable', 'true');
        el.style.outline = '1px dashed rgba(37,99,235,.45)';
        el.style.background = 'rgba(255,255,255,.72)';
      }
    });
    cardEl.dataset.pricingEditMode = isEditing ? 'false' : 'true';
    if (triggerBtn) {
      triggerBtn.textContent = isEditing ? 'Edit table' : 'Done editing';
      triggerBtn.style.background = isEditing ? '' : 'linear-gradient(135deg,#2563eb,#06b6d4)';
      triggerBtn.style.color = isEditing ? '' : '#fff';
      triggerBtn.style.borderColor = isEditing ? '' : 'transparent';
    }
  }

  function extractPricingRows(cardEl) {
    if (!cardEl) return [];
    const rows = [];
    const tiers = Array.from(cardEl.querySelectorAll('[data-pricing-tier]'));
    tiers.forEach((tierEl) => {
      const name = cleanText(tierEl.querySelector('[data-pricing-name]')?.textContent || '', 120);
      const rawPrice = cleanText(tierEl.querySelector('[data-pricing-price]')?.textContent || '', 120);
      const period = cleanText(tierEl.querySelector('[data-pricing-period]')?.textContent || '', 80);
      const desc = cleanText(tierEl.querySelector('[data-pricing-desc]')?.textContent || '', 180);
      const cta = cleanText(tierEl.querySelector('[data-pricing-cta]')?.textContent || '', 120);
      const features = Array.from(tierEl.querySelectorAll('[data-pricing-feature]'))
        .map((el) => cleanText((el.textContent || '').replace(/^✓\s*/, ''), 180))
        .filter(Boolean);
      if (!name) return;
      rows.push({ name, rawPrice, period, desc, cta, features });
    });
    return rows;
  }

  function exportPricingCardCsv(cardEl) {
    const title = cleanText(cardEl?.querySelector('[data-pricing-title]')?.textContent || 'Pricing Table', 120);
    const rows = extractPricingRows(cardEl);
    if (!rows.length) {
      alert('No pricing tiers found to export.');
      return;
    }
    const csvRows = [['Plan', 'Price', 'Period', 'Description', 'CTA', 'Features']];
    rows.forEach((r) => {
      csvRows.push([r.name, r.rawPrice, r.period, r.desc, r.cta, r.features.join(' | ')]);
    });
    const escapeCsv = (val = '') => {
      const s = String(val ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = csvRows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pricing-table'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportPricingCardWord(cardEl) {
    if (!cardEl) return;
    const title = cleanText(cardEl.querySelector('[data-pricing-title]')?.textContent || 'Pricing Table', 120);
    const rows = extractPricingRows(cardEl);
    if (!rows.length) {
      alert('No pricing tiers found to export.');
      return;
    }
    const rowHtml = rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.rawPrice)}</td>
        <td>${escapeHtml(r.period)}</td>
        <td>${escapeHtml(r.desc)}</td>
        <td>${escapeHtml(r.features.join(', '))}</td>
      </tr>
    `).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
      <style>
        body{font-family:Calibri,Arial,sans-serif;color:#0f172a;padding:24px}
        h1{font-size:22px;margin:0 0 10px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #cbd5e1;padding:8px 10px;font-size:12px;vertical-align:top}
        th{background:#eff6ff;text-align:left}
      </style>
    </head><body>
      <h1>${escapeHtml(title)}</h1>
      <table>
        <thead><tr><th>Plan</th><th>Price</th><th>Period</th><th>Description</th><th>Features</th></tr></thead>
        <tbody>${rowHtml}</tbody>
      </table>
    </body></html>`;
    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pricing-table'}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportPricingCardPdf(cardEl) {
    if (!cardEl) return;
    const title = cleanText(cardEl.querySelector('[data-pricing-title]')?.textContent || 'Pricing Table', 120);
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
    <style>
      body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#f8fbff;margin:0;padding:24px;color:#0f172a}
      .wrap{max-width:980px;margin:0 auto}
      [data-nabad-card="pricing"]{background:linear-gradient(180deg,#f7faff 0%,#eef6ff 100%);border-radius:16px;padding:24px;border:1px solid rgba(37,99,235,.14)}
      [data-pricing-grid]{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
      [data-pricing-tier]{flex:1;min-width:200px;background:#fff;border-radius:12px;padding:20px;border:1px solid rgba(37,99,235,.12);position:relative}
      table{width:100%;border-collapse:collapse} td{padding:6px 0;font-size:13px;border-bottom:1px solid rgba(37,99,235,.1)}
      button{display:none!important}
      @media print{body{padding:0;background:#fff}.wrap{max-width:none}}
    </style></head><body><div class="wrap">${cardEl.outerHTML}</div></body></html>`;
    let win = null;
    try {
      win = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=900');
    } catch {
      win = null;
    }
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 300);
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '-9999px';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);
    const frameDoc = iframe.contentWindow?.document;
    if (!frameDoc || !iframe.contentWindow) {
      iframe.remove();
      alert('Could not open print preview. Try allowing popups for this site.');
      return;
    }
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 1500);
    }, 250);
  }

  function getOrCreateCampaignEditor(bubble) {
    if (!bubble) return null;
    const actionRow = bubble.querySelector('button[data-nabad-action="campaign-refine-text"]')?.closest('div');
    if (!actionRow) return null;
    let editor = bubble.querySelector('.nabad-campaign-editor');
    if (editor) return editor;

    editor = document.createElement('div');
    editor.className = 'nabad-campaign-editor hidden';
    editor.innerHTML = `
      <div class="nabad-campaign-editor-title">Campaign Quick Editor</div>
      <div class="nabad-campaign-editor-grid">
        <input class="nabad-campaign-editor-input" data-campaign-field="headline" placeholder="Headline (e.g. Protect your music today)" />
        <input class="nabad-campaign-editor-input" data-campaign-field="subline" placeholder="Subline (e.g. Create safely with built-in copyright)" />
        <input class="nabad-campaign-editor-input" data-campaign-field="cta" placeholder="CTA (e.g. Start now)" />
        <input class="nabad-campaign-editor-input" data-campaign-field="background" placeholder="Background direction (e.g. warm studio with neon accent)" />
      </div>
      <div class="nabad-campaign-editor-actions">
        <button type="button" class="nabad-campaign-editor-btn primary" data-campaign-apply="text">Apply text + CTA</button>
        <button type="button" class="nabad-campaign-editor-btn" data-campaign-apply="background">Apply background</button>
        <button type="button" class="nabad-campaign-editor-btn" data-campaign-apply="close">Close</button>
      </div>
    `;

    actionRow.insertAdjacentElement('afterend', editor);
    return editor;
  }

  function openCampaignEditor(bubble, focusField = '') {
    const editor = getOrCreateCampaignEditor(bubble);
    if (!editor) return;
    editor.classList.remove('hidden');
    const fieldEl = focusField ? editor.querySelector(`[data-campaign-field="${focusField}"]`) : null;
    (fieldEl || editor.querySelector('[data-campaign-field="headline"]'))?.focus();
  }

  function closeCampaignEditor(bubble) {
    const editor = bubble?.querySelector('.nabad-campaign-editor');
    if (!editor) return;
    editor.classList.add('hidden');
  }

  function bindCampaignEditorEvents(bubble) {
    if (!bubble) return;
    const editor = getOrCreateCampaignEditor(bubble);
    if (!editor || editor.dataset.bound === 'true') return;
    editor.dataset.bound = 'true';

    editor.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('[data-campaign-apply]');
      if (!btn) return;
      const type = btn.getAttribute('data-campaign-apply') || '';
      if (type === 'close') {
        closeCampaignEditor(bubble);
        return;
      }

      const headline = cleanText(editor.querySelector('[data-campaign-field="headline"]')?.value || '', 180);
      const subline = cleanText(editor.querySelector('[data-campaign-field="subline"]')?.value || '', 180);
      const cta = cleanText(editor.querySelector('[data-campaign-field="cta"]')?.value || '', 120);
      const background = cleanText(editor.querySelector('[data-campaign-field="background"]')?.value || '', 220);

      if (type === 'text') {
        if (!headline && !subline && !cta) {
          alert('Add at least one text field (headline, subline, or CTA).');
          return;
        }
        const stage = ensureCampaignTemplateStage(bubble);
        if (stage) {
          const h = stage.querySelector('.nabad-campaign-template-text[data-field="headline"]');
          const s = stage.querySelector('.nabad-campaign-template-text[data-field="subline"]');
          const c = stage.querySelector('.nabad-campaign-template-text[data-field="cta"]');
          if (headline && h) h.textContent = headline;
          if (subline && s) s.textContent = subline;
          if (cta && c) c.textContent = cta;
          stage.classList.add('editing');
          closeCampaignEditor(bubble);
          return;
        }
        const cmd = `Campaign refine text: headline=${headline || '-'}; subline=${subline || '-'}; cta=${cta || '-'}`;
        sendMessage({ forcedText: cmd });
        closeCampaignEditor(bubble);
        return;
      }

      if (type === 'background') {
        if (!background) {
          alert('Add a background direction first.');
          return;
        }
        const cmd = `Campaign refine background: ${background}`;
        sendMessage({ forcedText: cmd });
        closeCampaignEditor(bubble);
      }
    });
  }

  function buildCampaignPreviewCard(data = {}) {
    const payload = encodeURIComponent(JSON.stringify({
      headline: cleanText(data.headline || '', 180),
      subtext: cleanText(data.subtext || '', 220),
      ctaText: cleanText(data.ctaText || '', 120),
      imagePrompt: cleanText(data.imagePrompt || '', 1200),
      objective: cleanText(data.objective || '', 200),
      audience: cleanText(data.audience || '', 180),
      offer: cleanText(data.offer || '', 220),
      tone: cleanText(data.tone || '', 90),
      visualStyle: cleanText(data.visualStyle || '', 140),
      platform: cleanText(data.platform || '', 80),
      format: cleanText(data.format || '', 80),
      typography: {
        fontFamily: cleanText(data?.typography?.fontFamily || '', 48),
        headlineSize: Number(data?.typography?.headlineSize || 0) || 0,
        subtextSize: Number(data?.typography?.subtextSize || 0) || 0,
        ctaSize: Number(data?.typography?.ctaSize || 0) || 0
      }
    }));
    return `<div class="nabad-campaign-preview-card" data-nabad-card="campaign-preview" data-campaign-payload="${payload}">
      <div class="nabad-campaign-preview-title">Campaign Draft</div>
      <div class="nabad-campaign-preview-row"><strong>Headline:</strong> ${escapeHtml(cleanText(data.headline || '', 180) || '—')}</div>
      <div class="nabad-campaign-preview-row"><strong>Subtext:</strong> ${escapeHtml(cleanText(data.subtext || '', 220) || '—')}</div>
      <div class="nabad-campaign-preview-row"><strong>CTA:</strong> ${escapeHtml(cleanText(data.ctaText || '', 120) || '—')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button data-nabad-action="campaign-open-editor">Open Editor</button>
      </div>
    </div>`;
  }

  function loadFabricJsIfNeeded() {
    return getEditorRuntime().then((runtime) => runtime.loadFabricJsIfNeeded());
  }

  async function loadBackgroundRemovalIfNeeded() {
    const runtime = await getEditorRuntime();
    return runtime.loadBackgroundRemovalIfNeeded();
  }

  async function fetchCampaignEditorImage(promptText = '') {
    const runtime = await getEditorRuntime();
    const result = await runtime.fetchCampaignEditorImage({
      apiUrl: CONFIG.apiUrl,
      promptText: cleanText(promptText, 1200),
      imageProvider: state.imageProvider || 'auto',
      memoryKey: getMemoryKey()
    });
    return {
      url: String(result?.url || ''),
      provider: cleanText(result?.provider || '', 32)
    };
  }

  async function fetchCampaignRewriteCopy(context = {}) {
    const runtime = await getEditorRuntime();
    const data = await runtime.fetchCampaignRewriteCopy({
      apiUrl: CONFIG.apiUrl,
      memoryKey: getMemoryKey(),
      copyContext: {
        headline: cleanText(context.headline || '', 220),
        subtext: cleanText(context.subtext || '', 260),
        ctaText: cleanText(context.ctaText || '', 120),
        objective: cleanText(context.objective || '', 200),
        audience: cleanText(context.audience || '', 180),
        offer: cleanText(context.offer || '', 220),
        tone: cleanText(context.tone || '', 90),
        visualStyle: cleanText(context.visualStyle || '', 140),
        platform: cleanText(context.platform || '', 80),
        format: cleanText(context.format || '', 50),
        rewriteHint: cleanText(context.rewriteHint || '', 220)
      }
    });
    return {
      headline: cleanText(data?.headline || '', 220),
      subtext: cleanText(data?.subtext || '', 260),
      ctaText: cleanText(data?.ctaText || '', 120)
    };
  }

  function hideChatForEditorMode() {
    try {
      window.dispatchEvent(new CustomEvent('nabad:editor-mode', { detail: { open: true } }));
    } catch {}
    if (refs.header) refs.header.style.display = 'none';
    const inputWrap = document.getElementById('nabad-input-wrap');
    if (inputWrap) inputWrap.style.display = 'none';
    getEditorRuntime().then((runtime) => runtime.hideChatForEditorMode(refs)).catch(() => {});
  }

  function restoreChatAfterEditorMode() {
    try {
      window.dispatchEvent(new CustomEvent('nabad:editor-mode', { detail: { open: false } }));
    } catch {}
    if (refs.header) refs.header.style.display = '';
    const inputWrap = document.getElementById('nabad-input-wrap');
    if (inputWrap) inputWrap.style.display = 'flex';
    renderInitialState();
    scrollToBottom();
    getEditorRuntime().then((runtime) =>
      runtime.restoreChatAfterEditorMode(refs, { renderInitialState, scrollToBottom })
    ).catch(() => {});
  }

  function makeRoundedRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function openCampaignCanvasEditorFromData(campaignData = {}) {
    const prompt = cleanText(campaignData.imagePrompt || '', 1200);
    const startBlank = !!campaignData.editorStartBlank;
    const isNewProjectFlow = !!campaignData.editorNeedsNewProject;
    if (!prompt && !startBlank) {
      renderMessage('assistant', '<p>Campaign prompt is missing. Please ask Nabad to generate the campaign draft again.</p>');
      return;
    }

    try {
      hideChatForEditorMode();
      refs.messages.innerHTML = `
        <div class="nabad-editor-shell">
          <div class="nabad-editor-topbar">
            <div class="nabad-editor-top-left">
              <button type="button" class="nabad-editor-btn with-icon" id="nabad-editor-back">
                <span class="nabad-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                </span>
                <span>Back</span>
              </button>
              <div class="nabad-editor-title">Nabad Editor</div>
            </div>
            <div class="nabad-editor-top-right">
              <button type="button" class="nabad-editor-btn with-icon" id="nabad-editor-undo">
                <span class="nabad-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 14l-5-5 5-5"/>
                    <path d="M20 20v-2a9 9 0 0 0-9-9H4"/>
                  </svg>
                </span>
                <span>Undo</span>
              </button>
              <button type="button" class="nabad-editor-btn with-icon" id="nabad-editor-redo">
                <span class="nabad-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15 14l5-5-5-5"/>
                    <path d="M4 20v-2a9 9 0 0 1 9-9h7"/>
                  </svg>
                </span>
                <span>Redo</span>
              </button>
              <select id="nabad-editor-save-size" class="nabad-editor-select" title="Save size">
                <option value="square">Square 1080×1080</option>
                <option value="story">Story 1080×1920</option>
                <option value="landscape" selected>Landscape 1920×1080</option>
                <option value="custom">Custom</option>
              </select>
              <div class="nabad-editor-custom-size" id="nabad-editor-custom-size" hidden>
                <input id="nabad-editor-custom-w" type="number" min="240" max="4096" step="1" value="1920" title="Custom width" />
                <span class="sep">×</span>
                <input id="nabad-editor-custom-h" type="number" min="240" max="4096" step="1" value="1080" title="Custom height" />
              </div>
              <button type="button" class="nabad-editor-btn with-icon" id="nabad-editor-merge">
                <span class="nabad-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 7h12M6 12h12M6 17h12"/>
                  </svg>
                </span>
                <span>Merge Layers</span>
              </button>
              <button type="button" class="nabad-editor-btn primary with-icon" id="nabad-editor-save">
                <span class="nabad-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <path d="M7 10l5 5 5-5"/>
                    <path d="M12 15V3"/>
                  </svg>
                </span>
                <span>Export</span>
              </button>
            </div>
          </div>

          <div class="nabad-editor-workspace">
            <aside class="nabad-editor-panel left">
              <section class="nabad-editor-sidebar-section">
                <h4>LAYERS</h4>
                <div class="nabad-editor-layer-list">
                  <label class="nabad-editor-layer-item"><span class="left"><input type="checkbox" id="nabad-layer-headline" checked /> 👁 Headline text</span></label>
                  <label class="nabad-editor-layer-item"><span class="left"><input type="checkbox" id="nabad-layer-subtext" checked /> 👁 Subtext</span></label>
                  <label class="nabad-editor-layer-item"><span class="left"><input type="checkbox" id="nabad-layer-cta" checked /> 👁 CTA button</span></label>
                  <label class="nabad-editor-layer-item"><span class="left"><input type="checkbox" id="nabad-layer-logo" checked /> 👁 Logo</span></label>
                  <label class="nabad-editor-layer-item"><span class="left"><input type="checkbox" id="nabad-layer-background" checked /> 👁 Background image</span></label>
                </div>
              </section>
              <section class="nabad-editor-sidebar-section with-divider">
                <h4>ADD</h4>
                <div class="add-grid">
                  <button type="button" class="nabad-editor-btn" id="nabad-side-add-text">+ Text</button>
                  <button type="button" class="nabad-editor-btn" id="nabad-side-add-image">+ Image</button>
                  <button type="button" class="nabad-editor-btn" id="nabad-side-add-shape">+ Shape</button>
                  <button type="button" class="nabad-editor-btn" id="nabad-side-add-logo">+ Logo</button>
                </div>
              </section>
              <section class="nabad-editor-sidebar-section with-divider">
                <h4>TOOLS</h4>
                <div class="add-grid">
                  <button type="button" class="nabad-editor-btn" id="nabad-sidebar-fill-bg">Fill Background</button>
                  <button type="button" class="nabad-editor-btn" id="nabad-sidebar-crop">Crop</button>
                  <button type="button" class="nabad-editor-btn" id="nabad-sidebar-eraser">Eraser</button>
                </div>
              </section>
              <section class="nabad-editor-sidebar-section with-divider">
                <h4>AI</h4>
                <div class="add-grid">
                  <button type="button" class="nabad-editor-btn" id="nabad-sidebar-remove-bg">Remove Background</button>
                  <button type="button" class="nabad-editor-btn" id="nabad-sidebar-detect-objects">Detect Objects</button>
                  <button type="button" class="nabad-editor-btn" id="nabad-sidebar-remove-text">Remove Text</button>
                  <button type="button" class="nabad-editor-btn" id="nabad-sidebar-rewrite-copy">Rewrite Copy</button>
                  <button type="button" class="nabad-editor-btn" id="nabad-sidebar-swap-bg">Swap Background</button>
                </div>
              </section>
            </aside>

            <div class="nabad-editor-stage">
              <div id="nabad-workspace">
                <div id="nabad-canvas-viewport">
                  <div id="nabad-canvas-stage">
                    <div id="nabad-campaign-card">
                      <button type="button" id="nabad-card-handle" title="Move card">⠿</button>
                      <canvas id="nabad-editor-canvas" class="nabad-editor-canvas"></canvas>
                    </div>
                  </div>
                </div>
                <div id="nabad-zoom-controls">
                  <button type="button" id="nabad-zoom-in" title="Zoom in">+</button>
                  <button type="button" id="nabad-zoom-out" title="Zoom out">−</button>
                  <button type="button" id="nabad-zoom-reset" title="Reset view">⌂</button>
                </div>
                <div id="nabad-workspace-glow" class="nabad-editor-workspace-glow" hidden>
                  <div class="glow-center"></div>
                  <div id="nabad-workspace-glow-text" class="glow-label">Nabad is generating...</div>
                </div>
                <div id="nabad-new-project-gate" class="nabad-editor-new-project ${startBlank && campaignData.editorNeedsNewProject ? 'show' : ''}">
                  <div class="nabad-editor-new-project-card">
                    <div class="nabad-editor-new-project-title">Create New Project</div>
                    <div class="nabad-editor-new-project-sub">Choose your working ratio to start an empty canvas.</div>
                    <div class="nabad-editor-new-project-grid" id="nabad-new-project-ratios">
                      <button type="button" class="nabad-editor-new-project-btn active" data-ratio="landscape">Landscape 1920×1080</button>
                      <button type="button" class="nabad-editor-new-project-btn" data-ratio="story">Story 1080×1920</button>
                      <button type="button" class="nabad-editor-new-project-btn" data-ratio="square">Square 1080×1080</button>
                      <button type="button" class="nabad-editor-new-project-btn" data-ratio="custom">Custom</button>
                    </div>
                    <div id="nabad-new-project-custom" class="nabad-editor-new-project-custom" hidden>
                      <input id="nabad-new-project-custom-w" type="number" min="240" max="4096" step="1" value="1920" />
                      <span>×</span>
                      <input id="nabad-new-project-custom-h" type="number" min="240" max="4096" step="1" value="1080" />
                    </div>
                    <div class="nabad-editor-new-project-actions">
                      <button type="button" class="nabad-editor-btn primary" id="nabad-new-project-create">Create Project</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="nabad-editor-contextbar" id="nabad-editor-contextbar" hidden>
            <div class="nabad-editor-context-title" id="nabad-selected-label">SELECTED: None</div>
            <div class="nabad-editor-context-row" id="nabad-context-text-tools" hidden>
              <select id="nabad-editor-font-family" class="nabad-editor-select">
                <option value="Inter">Inter</option>
                <option value="Poppins">Poppins</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Playfair Display">Playfair Display</option>
                <option value="Merriweather">Merriweather</option>
              </select>
              <input id="nabad-editor-text-size" type="range" min="10" max="160" step="1" value="34" />
              <input id="nabad-editor-text-color" type="color" value="#ffffff" />
              <button type="button" class="nabad-editor-btn" id="nabad-text-bold">B</button>
              <button type="button" class="nabad-editor-btn" id="nabad-text-italic">I</button>
              <button type="button" class="nabad-editor-btn" id="nabad-text-underline">U</button>
            </div>
            <div class="nabad-editor-context-row" id="nabad-context-common-tools">
              <label class="nabad-editor-inline-label">Opacity
                <input id="nabad-editor-opacity" type="range" min="0" max="100" step="1" value="100" />
              </label>
              <button type="button" class="nabad-editor-btn" id="nabad-editor-delete">Delete</button>
              <button type="button" class="nabad-editor-btn" id="nabad-editor-duplicate">Duplicate</button>
              <button type="button" class="nabad-editor-btn" id="nabad-editor-bring-front">Bring Forward</button>
              <button type="button" class="nabad-editor-btn" id="nabad-editor-send-back">Send Back</button>
            </div>
          </div>

          <div id="nabad-editor-action-overlay" class="nabad-editor-action-overlay" hidden>
            <div id="nabad-editor-action-popup" class="nabad-editor-action-popup" role="dialog" aria-modal="true" aria-labelledby="nabad-editor-action-title">
              <h4 id="nabad-editor-action-title">Editor action</h4>
              <p id="nabad-editor-action-copy">Working on your selected action.</p>
            </div>
          </div>
          <div id="nabad-ai-sheet" class="nabad-ai-sheet" aria-live="polite" hidden>
            <div class="nabad-ai-sheet-content">
              <span class="nabad-ai-sheet-dot"></span>
              <span id="nabad-ai-sheet-text">Nabad is working...</span>
            </div>
          </div>

          <input id="nabad-pos-x" type="number" step="1" hidden />
          <input id="nabad-pos-y" type="number" step="1" hidden />
          <input id="nabad-size-w" type="number" step="1" hidden />
          <input id="nabad-size-h" type="number" step="1" hidden />

          <input id="nabad-editor-object-file" type="file" accept="image/*" hidden />
          <input id="nabad-editor-logo-file" type="file" accept="image/*" hidden />
          <input id="nabad-editor-bg-file" type="file" accept="image/*" hidden />
          <input id="nabad-editor-bg-color-input" type="color" value="#ffffff" hidden />
        </div>
      `;

      const backBtn = document.getElementById('nabad-editor-back');
      const undoBtn = document.getElementById('nabad-editor-undo');
      const redoBtn = document.getElementById('nabad-editor-redo');
      const deleteBtn = document.getElementById('nabad-editor-delete');
      const duplicateBtn = document.getElementById('nabad-editor-duplicate');
      const bringFrontBtn = document.getElementById('nabad-editor-bring-front');
      const sendBackBtn = document.getElementById('nabad-editor-send-back');
      const mergeBtn = document.getElementById('nabad-editor-merge');
      const saveBtn = document.getElementById('nabad-editor-save');
      const saveSizeSelect = document.getElementById('nabad-editor-save-size');
      const saveSizeCustomWrap = document.getElementById('nabad-editor-custom-size');
      const customSizeWInput = document.getElementById('nabad-editor-custom-w');
      const customSizeHInput = document.getElementById('nabad-editor-custom-h');
      const zoomInBtn = document.getElementById('nabad-zoom-in');
      const zoomOutBtn = document.getElementById('nabad-zoom-out');
      const zoomResetBtn = document.getElementById('nabad-zoom-reset');
      const contextBar = document.getElementById('nabad-editor-contextbar');
      const contextTextTools = document.getElementById('nabad-context-text-tools');
      const selectedLabel = document.getElementById('nabad-selected-label');
      const posXInput = document.getElementById('nabad-pos-x');
      const posYInput = document.getElementById('nabad-pos-y');
      const sizeWInput = document.getElementById('nabad-size-w');
      const sizeHInput = document.getElementById('nabad-size-h');
      const opacityInput = document.getElementById('nabad-editor-opacity');
      const textBoldBtn = document.getElementById('nabad-text-bold');
      const textItalicBtn = document.getElementById('nabad-text-italic');
      const textUnderlineBtn = document.getElementById('nabad-text-underline');
      const sideAddTextBtn = document.getElementById('nabad-side-add-text');
      const sideAddImageBtn = document.getElementById('nabad-side-add-image');
      const sideAddShapeBtn = document.getElementById('nabad-side-add-shape');
      const sideAddLogoBtn = document.getElementById('nabad-side-add-logo');
      const sidebarFillBgBtn = document.getElementById('nabad-sidebar-fill-bg');
      const sidebarCropBtn = document.getElementById('nabad-sidebar-crop');
      const sidebarEraserBtn = document.getElementById('nabad-sidebar-eraser');
      const sidebarRemoveBgBtn = document.getElementById('nabad-sidebar-remove-bg');
      const sidebarDetectObjectsBtn = document.getElementById('nabad-sidebar-detect-objects');
      const sidebarRemoveTextBtn = document.getElementById('nabad-sidebar-remove-text');
      const sidebarRewriteCopyBtn = document.getElementById('nabad-sidebar-rewrite-copy');
      const sidebarSwapBgBtn = document.getElementById('nabad-sidebar-swap-bg');
      // Legacy action aliases kept only so older handlers still work after bottom-tab removal.
      const addTextBtn = sideAddTextBtn;
      const addImageBtn = sideAddImageBtn;
      const addShapeBtn = sideAddShapeBtn;
      const addLogoBtn = sideAddLogoBtn;
      const fillBgColorBtn = sidebarFillBgBtn;
      const cropSelectedImageBtn = sidebarCropBtn;
      const cropCanvasBtn = sidebarCropBtn;
      const removeBgBtn = sidebarRemoveBgBtn;
      const setBgBtn = null;
      const rewriteBtn = sidebarRewriteCopyBtn;
      const regenerateBtn = sidebarSwapBgBtn;
      const paletteBtn = null;
      const detectObjectsBtn = sidebarDetectObjectsBtn;
      const detectTextBtn = sidebarRemoveTextBtn;
      const layerHeadline = document.getElementById('nabad-layer-headline');
      const layerSubtext = document.getElementById('nabad-layer-subtext');
      const layerCta = document.getElementById('nabad-layer-cta');
      const layerLogo = document.getElementById('nabad-layer-logo');
      const layerBackground = document.getElementById('nabad-layer-background');
      const bgFile = document.getElementById('nabad-editor-bg-file');
      const bgColorInput = document.getElementById('nabad-editor-bg-color-input');
      const objectFile = document.getElementById('nabad-editor-object-file');
      const logoFile = document.getElementById('nabad-editor-logo-file');
      const fontFamilySelect = document.getElementById('nabad-editor-font-family');
      const textSizeRange = document.getElementById('nabad-editor-text-size');
      const textColor = document.getElementById('nabad-editor-text-color');
      const stageEl = refs.messages.querySelector('.nabad-editor-stage');
      const workspaceEl = document.getElementById('nabad-workspace');
      const workspaceGlowEl = document.getElementById('nabad-workspace-glow');
      const workspaceGlowTextEl = document.getElementById('nabad-workspace-glow-text');
      const newProjectGateEl = document.getElementById('nabad-new-project-gate');
      const newProjectRatiosWrap = document.getElementById('nabad-new-project-ratios');
      const newProjectCustomWrap = document.getElementById('nabad-new-project-custom');
      const newProjectCustomW = document.getElementById('nabad-new-project-custom-w');
      const newProjectCustomH = document.getElementById('nabad-new-project-custom-h');
      const newProjectCreateBtn = document.getElementById('nabad-new-project-create');
      const viewportEl = document.getElementById('nabad-canvas-viewport');
      const stageSurfaceEl = document.getElementById('nabad-canvas-stage');
      const campaignCardEl = document.getElementById('nabad-campaign-card');
      const cardHandleEl = document.getElementById('nabad-card-handle');
      const aiSheetEl = document.getElementById('nabad-ai-sheet');
      const aiSheetTextEl = document.getElementById('nabad-ai-sheet-text');
      const actionOverlayEl = document.getElementById('nabad-editor-action-overlay');
      const actionPopupEl = document.getElementById('nabad-editor-action-popup');
      const actionTitleEl = document.getElementById('nabad-editor-action-title');
      const actionCopyEl = document.getElementById('nabad-editor-action-copy');
      const canvasEl = document.getElementById('nabad-editor-canvas');
      let resizeObserver = null;
      let fitCanvasToStage = null;
      const showEditorBusy = (label = 'Nabad is working...', mode = '') => {
        if (!aiSheetEl) return;
        aiSheetEl.classList.remove('mode-rewrite', 'mode-regenerate', 'mode-removebg');
        workspaceGlowEl?.classList?.remove('mode-rewrite', 'mode-regenerate', 'mode-removebg');
        if (mode === 'rewrite') aiSheetEl.classList.add('mode-rewrite');
        if (mode === 'regenerate') aiSheetEl.classList.add('mode-regenerate');
        if (mode === 'removebg') aiSheetEl.classList.add('mode-removebg');
        if (mode === 'rewrite') workspaceGlowEl?.classList?.add('mode-rewrite');
        if (mode === 'regenerate') workspaceGlowEl?.classList?.add('mode-regenerate');
        if (mode === 'removebg') workspaceGlowEl?.classList?.add('mode-removebg');
        if (aiSheetTextEl) aiSheetTextEl.textContent = cleanText(label, 80) || 'Nabad is working...';
        if (workspaceGlowTextEl) workspaceGlowTextEl.textContent = cleanText(label, 80) || 'Nabad is working...';
        aiSheetEl.hidden = false;
        aiSheetEl.classList.add('show');
        if (workspaceGlowEl) {
          workspaceGlowEl.hidden = false;
          workspaceGlowEl.classList.add('show');
        }
        stageEl.classList.add('nabad-editor-stage-busy');
      };
      const hideEditorBusy = () => {
        if (!aiSheetEl) return;
        aiSheetEl.classList.remove('show', 'mode-rewrite', 'mode-regenerate', 'mode-removebg');
        workspaceGlowEl?.classList?.remove('show', 'mode-rewrite', 'mode-regenerate', 'mode-removebg');
        window.setTimeout(() => {
          if (!aiSheetEl.classList.contains('show')) aiSheetEl.hidden = true;
          if (workspaceGlowEl && !workspaceGlowEl.classList.contains('show')) workspaceGlowEl.hidden = true;
        }, 260);
        stageEl?.classList?.remove('nabad-editor-stage-busy');
      };
      const hideActionOverlay = () => {
        if (!actionOverlayEl) return;
        actionOverlayEl.hidden = true;
      };
      const showActionOverlay = (label = '') => {
        if (!actionOverlayEl) return;
        const cleanLabel = cleanText(label || 'Editor action', 70) || 'Editor action';
        if (actionTitleEl) actionTitleEl.textContent = cleanLabel;
        if (actionCopyEl) actionCopyEl.textContent = 'Use this popup to confirm or review this editor action.';
        actionOverlayEl.hidden = false;
      };
      actionOverlayEl?.addEventListener('click', (e) => {
        if (e.target === actionOverlayEl) hideActionOverlay();
      });
      actionPopupEl?.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      const overlayEscHandler = (e) => {
        if (e.key === 'Escape' && actionOverlayEl && !actionOverlayEl.hidden) {
          e.preventDefault();
          hideActionOverlay();
        }
      };
      document.addEventListener('keydown', overlayEscHandler);

      backBtn?.addEventListener('click', () => {
        try { cleanupWorkspaceListeners(); } catch {}
        if (fitCanvasToStage) {
          try { window.removeEventListener('resize', fitCanvasToStage); } catch {}
        }
        if (resizeObserver) {
          try { resizeObserver.disconnect(); } catch {}
          resizeObserver = null;
        }
        if (state.campaignEditorContext?.keyHandler) {
          document.removeEventListener('keydown', state.campaignEditorContext.keyHandler);
        }
        document.removeEventListener('keydown', overlayEscHandler);
        try { state.campaignEditorContext?.canvas?.dispose?.(); } catch {}
        state.campaignEditorContext = null;
        try { delete window.__NABAD_EDITOR_DO__; } catch {}
        restoreChatAfterEditorMode();
      });

      await loadFabricJsIfNeeded();
      let image = { url: '', provider: 'blank' };
      const makeBlankBackground = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          grad.addColorStop(0, '#0b2342');
          grad.addColorStop(0.5, '#102f55');
          grad.addColorStop(1, '#0a1d35');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'rgba(56,189,248,0.12)';
          ctx.beginPath();
          ctx.arc(canvas.width * 0.22, canvas.height * 0.34, 190, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(37,99,235,0.08)';
          ctx.beginPath();
          ctx.arc(canvas.width * 0.74, canvas.height * 0.68, 240, 0, Math.PI * 2);
          ctx.fill();
        }
        return canvas.toDataURL('image/png');
      };
      const makeSolidBackground = (hex = '#ffffff', width = 1920, height = 1080) => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(240, Number(width || 1920));
        canvas.height = Math.max(240, Number(height || 1080));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = toHexColor(hex || '#ffffff');
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        return canvas.toDataURL('image/png');
      };
      const makeWhiteBackground = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        return canvas.toDataURL('image/png');
      };
      const applyBlankProjectState = async () => {
        try {
          await setBackgroundFromUrl(makeWhiteBackground(), false);
          setBackgroundLockState(true);
          if (headlineObj) headlineObj.set({ text: '', visible: false });
          if (subtextObj) subtextObj.set({ text: '', visible: false });
          if (ctaObj) ctaObj.set({ text: '', visible: false });
          if (ctaBg) ctaBg.set({ visible: false });
          if (brandMarkObj) brandMarkObj.set({ text: '', visible: false });
          layerHeadline && (layerHeadline.checked = false);
          layerSubtext && (layerSubtext.checked = false);
          layerCta && (layerCta.checked = false);
          layerLogo && (layerLogo.checked = false);
          layerBackground && (layerBackground.checked = true);
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          updateControlFromActive();
        } catch (err) {
          console.error('[NABAD] apply blank project state error:', err);
        }
      };
      if (prompt) {
        showEditorBusy('Generating campaign visual...', 'regenerate');
        image = await fetchCampaignEditorImage(prompt);
      } else {
        image.url = isNewProjectFlow ? makeWhiteBackground() : makeBlankBackground();
      }

      if (!document.getElementById('nabad-editor-fonts')) {
        const fontLink = document.createElement('link');
        fontLink.id = 'nabad-editor-fonts';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Merriweather:wght@400;700&family=Montserrat:wght@500;700;800&family=Playfair+Display:wght@600;700&family=Poppins:wght@500;700;800&display=swap';
        document.head.appendChild(fontLink);
      }

      const typography = campaignData?.typography && typeof campaignData.typography === 'object'
        ? campaignData.typography
        : {};
      const allowedFonts = ['Inter', 'Poppins', 'Montserrat', 'Playfair Display', 'Merriweather'];
      const defaultFont = allowedFonts.includes(cleanText(typography.fontFamily || '', 40))
        ? cleanText(typography.fontFamily || '', 40)
        : 'Inter';

      const stageWidth = 1200;
      const fallbackHeight = 675;
      const fabricCanvas = new window.fabric.Canvas(canvasEl, {
        // Disable marquee/drag multi-select to prevent the "always selecting" glitch.
        // Users can still click objects to select/edit them.
        selection: false,
        preserveObjectStacking: true
      });
      fabricCanvas.setWidth(stageWidth);
      fabricCanvas.setHeight(fallbackHeight);
      // Editor eraser mode (for edge cleanup after background removal).
      let eraserMode = false;
      let eraserBrushPx = 24;
      let eraserIsDrawing = false;
      let eraserApplying = false;
      let eraserPoints = [];
      let eraserPreview = null;
      let eraserTargetObj = null;
      const isImageObject = (obj) => !!obj && obj.type === 'image';
      const canEraseImageObject = (obj) => isImageObject(obj) && obj !== backgroundObj;
      const setEraserMode = (enabled) => {
        eraserMode = !!enabled;
        eraserIsDrawing = false;
        eraserPoints = [];
        if (eraserPreview) {
          try { fabricCanvas.remove(eraserPreview); } catch {}
          eraserPreview = null;
        }
        fabricCanvas.defaultCursor = eraserMode ? 'crosshair' : 'default';
        fabricCanvas.hoverCursor = eraserMode ? 'crosshair' : 'move';
        fabricCanvas.moveCursor = eraserMode ? 'crosshair' : 'move';
        if (sidebarEraserBtn) {
          sidebarEraserBtn.classList.toggle('active', eraserMode);
          sidebarEraserBtn.textContent = eraserMode ? 'Eraser (On)' : 'Eraser';
        }
        fabricCanvas.requestRenderAll();
      };
      const getImageSourcePointFromCanvasPoint = (imgObj, canvasPoint) => {
        if (!imgObj || !canvasPoint) return null;
        const local = imgObj.toLocalPoint(
          new window.fabric.Point(Number(canvasPoint.x || 0), Number(canvasPoint.y || 0)),
          'left',
          'top'
        );
        const lw = Number(local?.x || 0);
        const lh = Number(local?.y || 0);
        const ow = Math.max(1, Number(imgObj.width || 1));
        const oh = Math.max(1, Number(imgObj.height || 1));
        if (lw < 0 || lh < 0 || lw > ow || lh > oh) return null;
        return {
          x: Number(imgObj.cropX || 0) + lw,
          y: Number(imgObj.cropY || 0) + lh
        };
      };
      const applyEraserStrokeToImage = async (imgObj, points, brushSizeCanvas = 24) => {
        if (!imgObj || !Array.isArray(points) || points.length < 2) return;
        const element = imgObj._element;
        if (!element) return;
        const srcW = Math.max(
          1,
          Number(element.naturalWidth || element.videoWidth || element.width || (Number(imgObj.cropX || 0) + Number(imgObj.width || 1)))
        );
        const srcH = Math.max(
          1,
          Number(element.naturalHeight || element.videoHeight || element.height || (Number(imgObj.cropY || 0) + Number(imgObj.height || 1)))
        );
        const drawCanvas = document.createElement('canvas');
        drawCanvas.width = srcW;
        drawCanvas.height = srcH;
        const drawCtx = drawCanvas.getContext('2d');
        if (!drawCtx) return;
        drawCtx.drawImage(element, 0, 0, srcW, srcH);
        const renderedW = Math.max(1, Number(imgObj.getScaledWidth?.() || imgObj.width || 1));
        const renderedH = Math.max(1, Number(imgObj.getScaledHeight?.() || imgObj.height || 1));
        const baseW = Math.max(1, Number(imgObj.width || 1));
        const baseH = Math.max(1, Number(imgObj.height || 1));
        const sx = renderedW / baseW;
        const sy = renderedH / baseH;
        const avgScale = Math.max(0.05, (sx + sy) / 2);
        const brushSrc = Math.max(1, Number(brushSizeCanvas || 24) / avgScale);
        drawCtx.globalCompositeOperation = 'destination-out';
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
        drawCtx.strokeStyle = 'rgba(0,0,0,1)';
        drawCtx.lineWidth = brushSrc;
        let started = false;
        points.forEach((pt) => {
          const mapped = getImageSourcePointFromCanvasPoint(imgObj, pt);
          if (!mapped) return;
          if (!started) {
            drawCtx.beginPath();
            drawCtx.moveTo(mapped.x, mapped.y);
            started = true;
          } else {
            drawCtx.lineTo(mapped.x, mapped.y);
          }
        });
        if (started) drawCtx.stroke();
        drawCtx.globalCompositeOperation = 'source-over';
        const nextSrc = drawCanvas.toDataURL('image/png');
        const prevState = {
          left: Number(imgObj.left || 0),
          top: Number(imgObj.top || 0),
          scaleX: Number(imgObj.scaleX || 1),
          scaleY: Number(imgObj.scaleY || 1),
          angle: Number(imgObj.angle || 0),
          originX: imgObj.originX || 'left',
          originY: imgObj.originY || 'top',
          flipX: !!imgObj.flipX,
          flipY: !!imgObj.flipY,
          opacity: Number(imgObj.opacity ?? 1),
          selectable: imgObj.selectable !== false,
          evented: imgObj.evented !== false,
          cropX: Number(imgObj.cropX || 0),
          cropY: Number(imgObj.cropY || 0),
          width: Number(imgObj.width || 1),
          height: Number(imgObj.height || 1)
        };
        await new Promise((resolve, reject) => {
          if (typeof imgObj.setSrc !== 'function') return reject(new Error('setSrc unavailable'));
          imgObj.setSrc(nextSrc, () => {
            try {
              imgObj.set(prevState);
              imgObj.setCoords();
              fabricCanvas.setActiveObject(imgObj);
              fabricCanvas.requestRenderAll();
              resolve();
            } catch (err) {
              reject(err);
            }
          }, { crossOrigin: 'anonymous' });
        });
      };
      // Extra safety: empty clicks should clear active object cleanly (outside eraser drawing).
      fabricCanvas.on('mouse:down', (evt) => {
        if (eraserMode) {
          if (eraserApplying) return;
          const pointer = fabricCanvas.getPointer(evt.e);
          const selected = fabricCanvas.getActiveObject();
          const target = canEraseImageObject(selected)
            ? selected
            : (canEraseImageObject(evt?.target) ? evt.target : null);
          if (!target) return;
          eraserTargetObj = target;
          eraserIsDrawing = true;
          eraserPoints = [{ x: Number(pointer?.x || 0), y: Number(pointer?.y || 0) }];
          if (eraserPreview) {
            try { fabricCanvas.remove(eraserPreview); } catch {}
          }
          eraserPreview = new window.fabric.Polyline(eraserPoints.slice(), {
            fill: '',
            stroke: 'rgba(239,68,68,0.75)',
            strokeWidth: eraserBrushPx,
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
            selectable: false,
            evented: false,
            excludeFromExport: true
          });
          fabricCanvas.add(eraserPreview);
          eraserPreview.bringToFront();
          evt?.e?.preventDefault?.();
          return;
        }
        if (!evt?.target) {
          fabricCanvas.discardActiveObject();
          fabricCanvas.requestRenderAll();
        }
      });
      fabricCanvas.on('mouse:move', (evt) => {
        if (!eraserMode || !eraserIsDrawing || !eraserPreview) return;
        const pointer = fabricCanvas.getPointer(evt.e);
        eraserPoints.push({ x: Number(pointer?.x || 0), y: Number(pointer?.y || 0) });
        eraserPreview.set({ points: eraserPoints.slice() });
        eraserPreview.setCoords();
        fabricCanvas.requestRenderAll();
        evt?.e?.preventDefault?.();
      });
      fabricCanvas.on('mouse:up', async (evt) => {
        if (!eraserMode || !eraserIsDrawing) return;
        eraserIsDrawing = false;
        if (eraserPreview) {
          try { fabricCanvas.remove(eraserPreview); } catch {}
          eraserPreview = null;
        }
        const points = eraserPoints.slice();
        eraserPoints = [];
        if (!eraserTargetObj || points.length < 2 || eraserApplying) return;
        eraserApplying = true;
        try {
          await applyEraserStrokeToImage(eraserTargetObj, points, eraserBrushPx);
          pushHistory();
        } catch (err) {
          console.error('[NABAD] eraser apply error:', err);
          alert('Eraser could not apply on this image. Try again.');
        } finally {
          eraserApplying = false;
          evt?.e?.preventDefault?.();
        }
      });

      let backgroundObj = null;
      let backgroundLocked = true;

      const fitBackground = (imgObj) => {
        if (!imgObj) return;
        const cw = fabricCanvas.getWidth();
        const ch = fabricCanvas.getHeight();
        const iw = imgObj.width || cw;
        const ih = imgObj.height || ch;
        const scale = Math.max(cw / iw, ch / ih);
        const scaledW = iw * scale;
        const scaledH = ih * scale;
        imgObj.set({
          left: (cw - scaledW) / 2,
          top: (ch - scaledH) / 2,
          scaleX: scale,
          scaleY: scale,
          selectable: !backgroundLocked,
          evented: !backgroundLocked,
          hasControls: !backgroundLocked,
          hasBorders: !backgroundLocked,
          lockRotation: backgroundLocked
        });
      };

      const setBackgroundLockState = (locked = true) => {
        backgroundLocked = !!locked;
        if (backgroundObj) {
          backgroundObj.set({
            selectable: !backgroundLocked,
            evented: !backgroundLocked,
            hasControls: !backgroundLocked,
            hasBorders: !backgroundLocked,
            lockRotation: backgroundLocked
          });
          if (backgroundLocked && fabricCanvas.getActiveObject() === backgroundObj) {
            fabricCanvas.discardActiveObject();
          }
        }
        fabricCanvas.renderAll();
      };

      const setBackgroundFromUrl = (src, keepTransform = true) => new Promise((resolve, reject) => {
        window.fabric.Image.fromURL(src, (img) => {
          if (!img) return reject(new Error('Failed to load background image.'));
          img.set({
            originX: 'left',
            originY: 'top'
          });
          if (backgroundObj && keepTransform) {
            img.set({
              left: backgroundObj.left,
              top: backgroundObj.top,
              scaleX: backgroundObj.scaleX,
              scaleY: backgroundObj.scaleY,
              angle: backgroundObj.angle || 0
            });
          } else {
            fitBackground(img);
          }
          if (backgroundObj) {
            fabricCanvas.remove(backgroundObj);
          }
          backgroundObj = img;
          backgroundObj.set('nabadRole', 'background');
          fabricCanvas.insertAt(backgroundObj, 0, false);
          setBackgroundLockState(backgroundLocked);
          backgroundObj.sendToBack();
          fabricCanvas.renderAll();
          resolve();
        }, { crossOrigin: 'anonymous' });
      });

      await setBackgroundFromUrl(image.url);

      let headlineObj = new window.fabric.IText(cleanText(campaignData.headline || (isNewProjectFlow ? '' : 'Your headline'), 180), {
        left: fabricCanvas.getWidth() * 0.08,
        top: fabricCanvas.getHeight() * 0.11,
        fontSize: Number(typography.headlineSize || 0) || Math.max(26, Math.round(fabricCanvas.getWidth() * 0.055)),
        fill: '#ffffff',
        fontWeight: 800,
        fontFamily: defaultFont,
        shadow: 'rgba(0,0,0,0.35) 0 2px 10px',
        editable: true
      });
      headlineObj.set('nabadRole', 'headline');

      let subtextObj = new window.fabric.IText(cleanText(campaignData.subtext || (isNewProjectFlow ? '' : 'Your subtext'), 220), {
        left: fabricCanvas.getWidth() * 0.08,
        top: fabricCanvas.getHeight() * 0.73,
        fontSize: Number(typography.subtextSize || 0) || Math.max(16, Math.round(fabricCanvas.getWidth() * 0.025)),
        fill: '#ffffff',
        fontWeight: 600,
        fontFamily: defaultFont,
        shadow: 'rgba(0,0,0,0.35) 0 2px 10px',
        editable: true
      });
      subtextObj.set('nabadRole', 'subtext');

      let ctaObj = new window.fabric.IText(cleanText(campaignData.ctaText || (isNewProjectFlow ? '' : 'Start now'), 120), {
        left: fabricCanvas.getWidth() * 0.66,
        top: fabricCanvas.getHeight() * 0.78,
        fontSize: Number(typography.ctaSize || 0) || Math.max(14, Math.round(fabricCanvas.getWidth() * 0.022)),
        fill: '#ffffff',
        fontWeight: 800,
        fontFamily: defaultFont,
        editable: true
      });
      ctaObj.isCtaText = true;
      ctaObj.set('nabadRole', 'cta');

      let brandMarkObj = new window.fabric.IText(isNewProjectFlow ? '' : 'nabadai.com', {
        left: fabricCanvas.getWidth() * 0.79,
        top: fabricCanvas.getHeight() * 0.04,
        fontSize: Math.max(11, Math.round(fabricCanvas.getWidth() * 0.015)),
        fill: 'rgba(255,255,255,0.86)',
        fontWeight: 600,
        fontFamily: defaultFont,
        editable: true
      });
      brandMarkObj.set('nabadRole', 'brand');

      let ctaBg = new window.fabric.Rect({
        left: ctaObj.left - 14,
        top: ctaObj.top - 8,
        width: Math.max(140, (ctaObj.width || 120) + 28),
        height: Math.max(44, (ctaObj.height || 24) + 16),
        rx: 14,
        ry: 14,
        fill: '#2563eb',
        stroke: 'rgba(255,255,255,0.30)',
        strokeWidth: 1.2,
        selectable: false,
        evented: false
      });
      ctaBg.set('nabadRole', 'ctaBg');

      const syncCtaBackground = () => {
        const padX = 14;
        const padY = 8;
        ctaBg.set({
          left: (ctaObj.left || 0) - padX,
          top: (ctaObj.top || 0) - padY,
          width: Math.max(120, (ctaObj.width || 90) + padX * 2),
          height: Math.max(36, (ctaObj.height || 18) + padY * 2)
        });
        ctaBg.setCoords();
        ctaObj.setCoords();
      };

      const applyCtaStyle = (styleName = 'solid') => {
        const s = String(styleName || 'solid');
        const ctaFill = toHexColor(String(ctaBg.fill || '#2563eb'));
        if (s === 'outline') {
          ctaBg.set({ fill: 'rgba(15,23,42,0.02)', stroke: ctaFill, strokeWidth: 2, rx: 12, ry: 12, opacity: 1 });
          ctaObj.set({ fill: ctaFill });
        } else if (s === 'pill') {
          ctaBg.set({ fill: ctaFill, stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1, rx: 22, ry: 22, opacity: 1 });
          ctaObj.set({ fill: '#ffffff' });
        } else if (s === 'glass') {
          ctaBg.set({ fill: 'rgba(255,255,255,0.18)', stroke: 'rgba(255,255,255,0.58)', strokeWidth: 1.4, rx: 16, ry: 16, opacity: 1 });
          ctaObj.set({ fill: '#ffffff' });
        } else {
          ctaBg.set({ fill: ctaFill, stroke: 'rgba(255,255,255,0.30)', strokeWidth: 1.2, rx: 14, ry: 14, opacity: 1 });
          ctaObj.set({ fill: '#ffffff' });
        }
        fabricCanvas.renderAll();
      };

      const attachCtaListeners = () => {
        if (!ctaObj) return;
        ctaObj.off('moving', syncCtaBackground);
        ctaObj.off('scaling', syncCtaBackground);
        ctaObj.off('modified', syncCtaBackground);
        ctaObj.off('changed');
        ctaObj.on('moving', syncCtaBackground);
        ctaObj.on('scaling', syncCtaBackground);
        ctaObj.on('modified', syncCtaBackground);
        ctaObj.on('changed', () => {
          syncCtaBackground();
          fabricCanvas.renderAll();
        });
      };
      attachCtaListeners();

      fabricCanvas.add(ctaBg, headlineObj, subtextObj, ctaObj, brandMarkObj);
      if (isNewProjectFlow) {
        headlineObj.set({ visible: false });
        subtextObj.set({ visible: false });
        ctaObj.set({ visible: false });
        ctaBg.set({ visible: false });
        brandMarkObj.set({ visible: false });
      }
      syncCtaBackground();
      applyCtaStyle('solid');
      fabricCanvas.setActiveObject(headlineObj);
      fabricCanvas.renderAll();

      const getByRole = (role = '') => fabricCanvas.getObjects().find((obj) => cleanText(obj?.nabadRole || '', 24) === role);
      const refreshCoreRefs = () => {
        headlineObj = getByRole('headline') || headlineObj;
        subtextObj = getByRole('subtext') || subtextObj;
        ctaObj = getByRole('cta') || ctaObj;
        ctaBg = getByRole('ctaBg') || ctaBg;
        brandMarkObj = getByRole('brand') || brandMarkObj;
        backgroundObj = getByRole('background') || backgroundObj;
        if (backgroundObj) {
          backgroundObj.set({
            selectable: !backgroundLocked,
            evented: !backgroundLocked,
            hasControls: !backgroundLocked,
            hasBorders: !backgroundLocked
          });
          backgroundObj.sendToBack();
        }
        attachCtaListeners();
        syncCtaBackground();
      };

      let undoStack = [];
      let redoStack = [];
      let historyMuted = true;
      const updateHistoryButtons = () => {
        if (undoBtn) undoBtn.disabled = undoStack.length <= 1;
        if (redoBtn) redoBtn.disabled = redoStack.length === 0;
      };
      const snapshotEditorState = () => JSON.stringify(fabricCanvas.toJSON(['nabadRole', 'isCtaText']));
      const pushHistory = () => {
        if (historyMuted) return;
        const snap = snapshotEditorState();
        if (undoStack[undoStack.length - 1] === snap) return;
        undoStack.push(snap);
        if (undoStack.length > 60) undoStack.shift();
        redoStack = [];
        updateHistoryButtons();
      };
      const restoreSnapshot = async (snap) => {
        if (!snap) return;
        historyMuted = true;
        await new Promise((resolve) => {
          fabricCanvas.loadFromJSON(JSON.parse(snap), () => {
            fabricCanvas.renderAll();
            resolve();
          });
        });
        refreshCoreRefs();
        historyMuted = false;
        updateControlFromActive();
      };

      const isTextLikeObject = (obj) => !!obj && (
        obj.type === 'i-text' ||
        obj.type === 'textbox' ||
        obj.type === 'text'
      );

      const getTextTargetLabel = (obj) => {
        if (!obj || !isTextLikeObject(obj)) return 'No text selected';
        if (obj === headlineObj) return 'Headline';
        if (obj === subtextObj) return 'Subtext';
        if (obj === ctaObj) return 'CTA';
        if (obj === brandMarkObj) return 'Brand mark';
        return 'Text object';
      };

      const getObjectLabel = (obj) => {
        if (!obj) return 'None';
        if (obj === headlineObj) return 'Headline';
        if (obj === subtextObj) return 'Subtext';
        if (obj === ctaObj || obj === ctaBg) return 'CTA Button';
        if (obj === brandMarkObj) return 'Logo';
        if (obj === backgroundObj) return 'Background image';
        return (obj.type || 'Object').replace('-', ' ');
      };

      const updateLayerVisibilityControls = () => {
        const layerState = {
          headline: !!(headlineObj && headlineObj.visible !== false),
          subtext: !!(subtextObj && subtextObj.visible !== false),
          cta: !!(ctaObj && ctaObj.visible !== false),
          logo: !!(brandMarkObj && brandMarkObj.visible !== false),
          background: !!(backgroundObj && backgroundObj.visible !== false)
        };
        if (layerHeadline) layerHeadline.checked = layerState.headline;
        if (layerSubtext) layerSubtext.checked = layerState.subtext;
        if (layerCta) layerCta.checked = layerState.cta;
        if (layerLogo) layerLogo.checked = layerState.logo;
        if (layerBackground) layerBackground.checked = layerState.background;
        try {
          window.dispatchEvent(new CustomEvent('nabad:editor-layers', { detail: layerState }));
        } catch {}
      };

      const setInspectorEnabled = (enabled = false, isText = false) => {
        if (fontFamilySelect) fontFamilySelect.disabled = !enabled || !isText;
        if (textSizeRange) textSizeRange.disabled = !enabled || !isText;
        if (textColor) textColor.disabled = !enabled || !isText;
        if (textBoldBtn) textBoldBtn.disabled = !enabled || !isText;
        if (textItalicBtn) textItalicBtn.disabled = !enabled || !isText;
        if (textUnderlineBtn) textUnderlineBtn.disabled = !enabled || !isText;
        if (posXInput) posXInput.disabled = !enabled;
        if (posYInput) posYInput.disabled = !enabled;
        if (sizeWInput) sizeWInput.disabled = !enabled;
        if (sizeHInput) sizeHInput.disabled = !enabled;
        if (opacityInput) opacityInput.disabled = !enabled;
        if (deleteBtn) deleteBtn.disabled = !enabled;
      };

      const updateControlFromActive = () => {
        const obj = fabricCanvas.getActiveObject();
        const isText = isTextLikeObject(obj);
        if (selectedLabel) {
          selectedLabel.textContent = `SELECTED: ${getObjectLabel(obj)}`;
        }
        if (contextBar) contextBar.hidden = !obj;
        if (contextTextTools) contextTextTools.hidden = !isText;
        setInspectorEnabled(!!obj, isText);
        if (!obj) {
          updateLayerVisibilityControls();
          try {
            window.dispatchEvent(new CustomEvent('nabad:editor-selection', {
              detail: { hasSelection: false }
            }));
          } catch {}
          return;
        }
        if (isText) {
          fontFamilySelect.value = allowedFonts.includes(String(obj.fontFamily || '')) ? String(obj.fontFamily) : defaultFont;
          textColor.value = toHexColor(String(obj.fill || '#ffffff'));
          textSizeRange.value = String(Math.round(obj.fontSize || 34));
          textBoldBtn.classList.toggle('primary', String(obj.fontWeight || 'normal') !== 'normal');
          textItalicBtn.classList.toggle('primary', String(obj.fontStyle || 'normal') === 'italic');
          textUnderlineBtn.classList.toggle('primary', !!obj.underline);
        }
        const left = Number(obj.left || 0);
        const top = Number(obj.top || 0);
        const width = Number((obj.getScaledWidth && obj.getScaledWidth()) || obj.width || 0);
        const height = Number((obj.getScaledHeight && obj.getScaledHeight()) || obj.height || 0);
        if (posXInput) posXInput.value = String(Math.round(left));
        if (posYInput) posYInput.value = String(Math.round(top));
        if (sizeWInput) sizeWInput.value = String(Math.round(width));
        if (sizeHInput) sizeHInput.value = String(Math.round(height));
        if (opacityInput) opacityInput.value = String(Math.round((Number(obj.opacity ?? 1)) * 100));
        updateLayerVisibilityControls();
        try {
          window.dispatchEvent(new CustomEvent('nabad:editor-selection', {
            detail: {
              hasSelection: true,
              label: getObjectLabel(obj),
              isText,
              fontFamily: isText ? String(obj.fontFamily || defaultFont) : defaultFont,
              fontSize: isText ? Math.round(Number(obj.fontSize || 34)) : Math.round(Number(obj.fontSize || 0)),
              color: isText ? toHexColor(String(obj.fill || '#ffffff')) : '#ffffff',
              bold: isText ? String(obj.fontWeight || 'normal') !== 'normal' : false,
              italic: isText ? String(obj.fontStyle || 'normal') === 'italic' : false,
              underline: isText ? !!obj.underline : false,
              x: Math.round(Number(obj.left || 0)),
              y: Math.round(Number(obj.top || 0)),
              w: Math.round(Number((obj.getScaledWidth && obj.getScaledWidth()) || obj.width || 0)),
              h: Math.round(Number((obj.getScaledHeight && obj.getScaledHeight()) || obj.height || 0)),
              opacity: Math.round((Number(obj.opacity ?? 1)) * 100)
            }
          }));
        } catch {}
      };

      fabricCanvas.on('selection:created', updateControlFromActive);
      fabricCanvas.on('selection:updated', updateControlFromActive);
      fabricCanvas.on('selection:cleared', updateControlFromActive);
      fabricCanvas.on('mouse:down', (ev) => {
        if (!ev.target) {
          closeToolTab();
          updateControlFromActive();
        }
      });
      fabricCanvas.on('object:added', pushHistory);
      fabricCanvas.on('object:modified', pushHistory);
      fabricCanvas.on('object:removed', pushHistory);
      fabricCanvas.on('text:changed', pushHistory);

      fontFamilySelect?.addEventListener('change', () => {
        const obj = fabricCanvas.getActiveObject();
        if (!obj || !('fontFamily' in obj)) return;
        obj.set('fontFamily', cleanText(fontFamilySelect.value || defaultFont, 48) || defaultFont);
        fabricCanvas.renderAll();
      });

      textSizeRange?.addEventListener('input', () => {
        const obj = fabricCanvas.getActiveObject();
        if (!isTextLikeObject(obj)) return;
        obj.set('fontSize', Number(textSizeRange.value || 34));
        if (obj === ctaObj) syncCtaBackground();
        fabricCanvas.renderAll();
      });

      textColor?.addEventListener('input', () => {
        const obj = fabricCanvas.getActiveObject();
        if (!isTextLikeObject(obj) || !('fill' in obj)) return;
        obj.set('fill', textColor.value || '#ffffff');
        fabricCanvas.renderAll();
      });

      textBoldBtn?.addEventListener('click', () => {
        const obj = fabricCanvas.getActiveObject();
        if (!isTextLikeObject(obj)) return;
        const next = String(obj.fontWeight || 'normal') === 'normal' ? '700' : 'normal';
        obj.set('fontWeight', next);
        fabricCanvas.renderAll();
        updateControlFromActive();
      });
      textItalicBtn?.addEventListener('click', () => {
        const obj = fabricCanvas.getActiveObject();
        if (!isTextLikeObject(obj)) return;
        obj.set('fontStyle', String(obj.fontStyle || 'normal') === 'italic' ? 'normal' : 'italic');
        fabricCanvas.renderAll();
        updateControlFromActive();
      });
      textUnderlineBtn?.addEventListener('click', () => {
        const obj = fabricCanvas.getActiveObject();
        if (!isTextLikeObject(obj)) return;
        obj.set('underline', !obj.underline);
        fabricCanvas.renderAll();
        updateControlFromActive();
      });

      const applyPositionAndSize = () => {
        const obj = fabricCanvas.getActiveObject();
        if (!obj) return;
        const nextX = Number(posXInput?.value || obj.left || 0);
        const nextY = Number(posYInput?.value || obj.top || 0);
        const nextW = Math.max(1, Number(sizeWInput?.value || (obj.getScaledWidth?.() || obj.width || 1)));
        const nextH = Math.max(1, Number(sizeHInput?.value || (obj.getScaledHeight?.() || obj.height || 1)));
        obj.set({ left: nextX, top: nextY });
        if (isTextLikeObject(obj)) {
          const currentW = Math.max(1, Number(obj.width || nextW));
          obj.set({ scaleX: 1, scaleY: 1, width: Math.max(20, nextW) });
          if (Math.abs(currentW - nextW) > 2 && ctaObj && obj === ctaObj) syncCtaBackground();
        } else {
          const baseW = Math.max(1, Number(obj.width || 1));
          const baseH = Math.max(1, Number(obj.height || 1));
          obj.set({ scaleX: nextW / baseW, scaleY: nextH / baseH });
        }
        if (obj === ctaObj) syncCtaBackground();
        fabricCanvas.renderAll();
      };
      posXInput?.addEventListener('change', applyPositionAndSize);
      posYInput?.addEventListener('change', applyPositionAndSize);
      sizeWInput?.addEventListener('change', applyPositionAndSize);
      sizeHInput?.addEventListener('change', applyPositionAndSize);
      opacityInput?.addEventListener('input', () => {
        const obj = fabricCanvas.getActiveObject();
        if (!obj) return;
        obj.set('opacity', Math.max(0, Math.min(1, Number(opacityInput.value || 100) / 100)));
        fabricCanvas.renderAll();
      });

      bgFile?.addEventListener('change', () => {
        const file = bgFile.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            await setBackgroundFromUrl(String(reader.result || ''), false);
          } catch {
            alert('Could not replace background image.');
          }
        };
        reader.readAsDataURL(file);
      });

      const addShape = (shape = 'rect') => {
        const cw = fabricCanvas.getWidth();
        const ch = fabricCanvas.getHeight();
        const centerX = cw * 0.5;
        const centerY = ch * 0.5;
        let obj = null;
        if (shape === 'circle') {
          obj = new window.fabric.Circle({
            left: centerX - 42,
            top: centerY - 42,
            radius: 42,
            fill: 'rgba(56,189,248,0.26)',
            stroke: '#38bdf8',
            strokeWidth: 1.5
          });
        } else if (shape === 'line') {
          obj = new window.fabric.Line([centerX - 90, centerY, centerX + 90, centerY], {
            stroke: '#38bdf8',
            strokeWidth: 3
          });
        } else if (shape === 'star') {
          const outer = 48;
          const inner = 22;
          const points = [];
          for (let i = 0; i < 10; i += 1) {
            const radius = i % 2 === 0 ? outer : inner;
            const angle = (Math.PI / 5) * i - Math.PI / 2;
            points.push({
              x: centerX + radius * Math.cos(angle),
              y: centerY + radius * Math.sin(angle)
            });
          }
          obj = new window.fabric.Polygon(points, {
            fill: 'rgba(14,165,233,0.28)',
            stroke: '#0ea5e9',
            strokeWidth: 1.5
          });
        } else if (shape === 'blob') {
          obj = new window.fabric.Ellipse({
            left: centerX - 100,
            top: centerY - 52,
            rx: 100,
            ry: 52,
            angle: -12,
            fill: 'rgba(59,130,246,0.20)',
            stroke: 'rgba(56,189,248,0.72)',
            strokeWidth: 1.2
          });
        } else {
          obj = new window.fabric.Rect({
            left: centerX - 68,
            top: centerY - 38,
            width: 136,
            height: 76,
            rx: 12,
            ry: 12,
            fill: 'rgba(56,189,248,0.20)',
            stroke: '#38bdf8',
            strokeWidth: 1.5
          });
        }
        if (!obj) return;
        fabricCanvas.add(obj);
        obj.bringToFront();
        brandMarkObj.bringToFront();
        ctaBg.bringToFront();
        ctaObj.bringToFront();
        fabricCanvas.setActiveObject(obj);
        fabricCanvas.renderAll();
      };

      const addImageObjectFromSource = (src = '') => new Promise((resolve, reject) => {
        window.fabric.Image.fromURL(src, (img) => {
          if (!img) return reject(new Error('Could not add image object.'));
          const cw = fabricCanvas.getWidth();
          const ch = fabricCanvas.getHeight();
          const iw = img.width || 1;
          const ih = img.height || 1;
          const maxW = cw * 0.42;
          const maxH = ch * 0.42;
          const scale = Math.min(maxW / iw, maxH / ih, 1);
          img.set({
            left: cw * 0.5 - (iw * scale) * 0.5,
            top: ch * 0.5 - (ih * scale) * 0.5,
            scaleX: scale,
            scaleY: scale,
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true
          });
          fabricCanvas.add(img);
          brandMarkObj.bringToFront();
          ctaBg.bringToFront();
          ctaObj.bringToFront();
          fabricCanvas.setActiveObject(img);
          fabricCanvas.renderAll();
          resolve(img);
        }, { crossOrigin: 'anonymous' });
      });

      const setSelectedAsBackground = async () => {
        const obj = fabricCanvas.getActiveObject();
        if (!obj || obj.type !== 'image') {
          alert('Select an image object first.');
          return;
        }
        const src = typeof obj.getSrc === 'function' ? obj.getSrc() : (obj._element?.src || '');
        if (!src) {
          alert('Selected image source is not available.');
          return;
        }
        await setBackgroundFromUrl(src, false);
        try { fabricCanvas.remove(obj); } catch {}
        setBackgroundLockState(true);
        fabricCanvas.renderAll();
      };

      const removeSelectedImageBackground = async () => {
        const obj = fabricCanvas.getActiveObject();
        if (!obj || obj.type !== 'image') {
          alert('Select an image object first, then run background remover.');
          return;
        }
        const src = typeof obj.getSrc === 'function' ? obj.getSrc() : (obj._element?.src || '');
        if (!src) {
          alert('Could not read selected image source.');
          return;
        }

        const requestServerRemoveBg = async (source = '') => {
          const payload = source.startsWith('data:')
            ? { imageBase64: source }
            : { imageUrl: source };
          const resp = await fetch('/api/remove-bg', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!resp.ok) {
            let msg = `Background remover failed (${resp.status})`;
            try {
              const err = await resp.json();
              if (err?.detail) msg = `${msg}: ${err.detail}`;
              else if (err?.error) msg = `${msg}: ${err.error}`;
            } catch {}
            throw new Error(msg);
          }
          const blob = await resp.blob();
          if (!blob || !blob.size) throw new Error('No output image received from /api/remove-bg');
          return URL.createObjectURL(blob);
        };

        if (removeBgBtn) removeBgBtn.disabled = true;
        showEditorBusy('Removing background...', 'removebg');
        try {
          const url = await requestServerRemoveBg(src);
          const prev = {
            left: Number(obj.left || 0),
            top: Number(obj.top || 0),
            scaleX: Number(obj.scaleX || 1),
            scaleY: Number(obj.scaleY || 1),
            angle: Number(obj.angle || 0),
            originX: obj.originX || 'left',
            originY: obj.originY || 'top',
            flipX: !!obj.flipX,
            flipY: !!obj.flipY,
            opacity: Number(obj.opacity ?? 1),
            selectable: obj.selectable !== false,
            evented: obj.evented !== false
          };
          await new Promise((resolve, reject) => {
            if (typeof obj.setSrc !== 'function') return reject(new Error('setSrc unavailable'));
            obj.setSrc(url, () => {
              try {
                obj.set(prev);
                obj.setCoords();
                fabricCanvas.setActiveObject(obj);
                fabricCanvas.renderAll();
                resolve();
              } catch (err) {
                reject(err);
              }
            }, { crossOrigin: 'anonymous' });
          }).catch(async () => {
            await addImageObjectFromSource(url);
          });
          setTimeout(() => URL.revokeObjectURL(url), 30_000);
        } catch (err) {
          console.error('[NABAD] remove background error:', err);
          alert('Background remover failed on this image. Try another image or run again.');
        } finally {
          if (removeBgBtn) removeBgBtn.disabled = false;
          hideEditorBusy();
        }
      };

      const deleteSelectedObject = () => {
        const obj = fabricCanvas.getActiveObject();
        if (!obj) return;
        if (obj === backgroundObj) {
          alert('Background is protected. Use "Replace background" or unlock to move it.');
          return;
        }
        if (obj === ctaObj || obj === ctaBg) {
          fabricCanvas.remove(ctaObj);
          fabricCanvas.remove(ctaBg);
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          return;
        }
        fabricCanvas.remove(obj);
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
      };

      const duplicateSelectedObject = () => {
        const obj = fabricCanvas.getActiveObject();
        if (!obj || obj === backgroundObj) return;
        obj.clone((cloned) => {
          if (!cloned) return;
          cloned.set({
            left: Number(obj.left || 0) + 18,
            top: Number(obj.top || 0) + 18
          });
          cloned.setCoords();
          fabricCanvas.add(cloned);
          fabricCanvas.setActiveObject(cloned);
          if (obj === ctaObj) {
            cloned.set('nabadRole', 'cta');
          }
          fabricCanvas.renderAll();
        }, ['nabadRole', 'isCtaText']);
      };

      const bringSelectedForward = () => {
        const obj = fabricCanvas.getActiveObject();
        if (!obj || obj === backgroundObj) return;
        obj.bringForward?.();
        ctaBg?.bringForward?.();
        if (obj === ctaObj) ctaObj.bringForward?.();
        brandMarkObj?.bringToFront?.();
        fabricCanvas.renderAll();
      };

      const sendSelectedBack = () => {
        const obj = fabricCanvas.getActiveObject();
        if (!obj || obj === backgroundObj) return;
        obj.sendBackwards?.();
        backgroundObj?.sendToBack?.();
        fabricCanvas.renderAll();
      };

      deleteBtn?.addEventListener('click', deleteSelectedObject);
      duplicateBtn?.addEventListener('click', duplicateSelectedObject);
      bringFrontBtn?.addEventListener('click', bringSelectedForward);
      sendBackBtn?.addEventListener('click', sendSelectedBack);

      const addTextAction = () => {
        const text = new window.fabric.IText('New text', {
          left: fabricCanvas.getWidth() * 0.35,
          top: fabricCanvas.getHeight() * 0.45,
          fontSize: 34,
          fill: '#ffffff',
          fontWeight: 700,
          fontFamily: defaultFont,
          editable: true,
          shadow: 'rgba(0,0,0,0.28) 0 2px 8px'
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        fabricCanvas.renderAll();
      };
      const addImageAction = () => objectFile?.click();
      const addLogoAction = () => logoFile?.click();
      const addShapeAction = () => {
        const choice = cleanText(window.prompt('Shape type: rect / circle / line / star / blob', 'rect') || 'rect', 20).toLowerCase();
        const allowed = ['rect', 'circle', 'line', 'star', 'blob'];
        addShape(allowed.includes(choice) ? choice : 'rect');
      };
      const fillBgAction = () => bgColorInput?.click();

      const cropSelectedImageAction = () => {
        const obj = fabricCanvas.getActiveObject();
        if (!obj || obj.type !== 'image' || obj === backgroundObj) {
          alert('Select an uploaded image object first.');
          return;
        }
        const cropInput = window.prompt(
          'Crop selected image in percentages:\nleft,top,width,height\nExample: 10,10,80,80',
          '10,10,80,80'
        );
        if (cropInput === null) return;
        const parts = String(cropInput || '')
          .split(',')
          .map((v) => Number(v.trim()))
          .filter((v) => Number.isFinite(v));
        if (parts.length !== 4) {
          alert('Please enter 4 numbers: left,top,width,height');
          return;
        }
        const [leftPctRaw, topPctRaw, widthPctRaw, heightPctRaw] = parts;
        const leftPct = Math.max(0, Math.min(95, leftPctRaw));
        const topPct = Math.max(0, Math.min(95, topPctRaw));
        const widthPct = Math.max(1, Math.min(100 - leftPct, widthPctRaw));
        const heightPct = Math.max(1, Math.min(100 - topPct, heightPctRaw));
        const sourceW = Math.max(1, Number(obj._element?.naturalWidth || obj._element?.width || obj.width || 1));
        const sourceH = Math.max(1, Number(obj._element?.naturalHeight || obj._element?.height || obj.height || 1));
        const cropX = Math.round((leftPct / 100) * sourceW);
        const cropY = Math.round((topPct / 100) * sourceH);
        const cropW = Math.max(1, Math.round((widthPct / 100) * sourceW));
        const cropH = Math.max(1, Math.round((heightPct / 100) * sourceH));
        const displayW = Math.max(1, Number(obj.getScaledWidth?.() || (obj.width || 1)));
        const displayH = Math.max(1, Number(obj.getScaledHeight?.() || (obj.height || 1)));
        obj.set({
          cropX,
          cropY,
          width: cropW,
          height: cropH,
          scaleX: displayW / cropW,
          scaleY: displayH / cropH
        });
        obj.setCoords();
        fabricCanvas.renderAll();
      };

      const cropCanvasAction = () => {
        const cw = Math.max(1, Math.round(Number(fabricCanvas.getWidth() || 1)));
        const ch = Math.max(1, Math.round(Number(fabricCanvas.getHeight() || 1)));
        const cropInput = window.prompt(
          'Crop canvas in pixels:\nx,y,width,height\nExample: 0,0,1080,1080',
          `0,0,${cw},${ch}`
        );
        if (cropInput === null) return;
        const parts = String(cropInput || '')
          .split(',')
          .map((v) => Number(v.trim()))
          .filter((v) => Number.isFinite(v));
        if (parts.length !== 4) {
          alert('Please enter 4 numbers: x,y,width,height');
          return;
        }
        let [x, y, w, h] = parts.map((n) => Math.round(n));
        x = Math.max(0, Math.min(cw - 1, x));
        y = Math.max(0, Math.min(ch - 1, y));
        w = Math.max(80, Math.min(cw - x, w));
        h = Math.max(80, Math.min(ch - y, h));
        const objects = fabricCanvas.getObjects();
        objects.forEach((obj) => {
          obj.set({
            left: Number(obj.left || 0) - x,
            top: Number(obj.top || 0) - y
          });
          obj.setCoords();
        });
        fabricCanvas.setWidth(w);
        fabricCanvas.setHeight(h);
        if (campaignCardEl) {
          campaignCardEl.style.width = `${w}px`;
          campaignCardEl.style.height = `${h}px`;
        }
        currentAspect = Math.max(0.1, w / Math.max(1, h));
        selectedSizePreset = 'custom';
        if (saveSizeSelect) saveSizeSelect.value = 'custom';
        if (customSizeWInput) customSizeWInput.value = String(w);
        if (customSizeHInput) customSizeHInput.value = String(h);
        if (saveSizeCustomWrap) saveSizeCustomWrap.hidden = false;
        syncCtaBackground();
        fitWorkspaceToViewport();
        fabricCanvas.renderAll();
      };

      const cropAction = () => {
        const obj = fabricCanvas.getActiveObject();
        if (obj && obj.type === 'image' && obj !== backgroundObj) {
          cropSelectedImageAction();
          return;
        }
        cropCanvasAction();
      };
      const eraserAction = () => {
        if (eraserMode) {
          setEraserMode(false);
          return;
        }
        const selected = fabricCanvas.getActiveObject();
        if (!canEraseImageObject(selected)) {
          alert('Select an image object first, then click Eraser.');
          return;
        }
        const nextSize = window.prompt('Eraser size in px (6-120)', String(eraserBrushPx));
        if (nextSize !== null) {
          const parsed = Number(nextSize);
          if (Number.isFinite(parsed)) eraserBrushPx = Math.max(6, Math.min(120, Math.round(parsed)));
        }
        setEraserMode(true);
      };

      sideAddTextBtn?.addEventListener('click', addTextAction);
      sideAddImageBtn?.addEventListener('click', addImageAction);
      sideAddLogoBtn?.addEventListener('click', addLogoAction);
      sideAddShapeBtn?.addEventListener('click', addShapeAction);
      sidebarFillBgBtn?.addEventListener('click', fillBgAction);
      sidebarCropBtn?.addEventListener('click', cropAction);
      sidebarEraserBtn?.addEventListener('click', eraserAction);

      bgColorInput?.addEventListener('change', async () => {
        const color = toHexColor(String(bgColorInput?.value || '#ffffff'));
        const fillUrl = makeSolidBackground(color, fabricCanvas.getWidth(), fabricCanvas.getHeight());
        try {
          await setBackgroundFromUrl(fillUrl, false);
          setBackgroundLockState(true);
          if (layerBackground) layerBackground.checked = true;
          fabricCanvas.renderAll();
        } catch (err) {
          console.error('[NABAD] fill background color error:', err);
          alert('Could not fill background color. Please try again.');
        }
      });

      const toggleLayer = (obj, checked) => {
        if (!obj) return;
        obj.set('visible', !!checked);
      };
      layerHeadline?.addEventListener('change', () => {
        toggleLayer(headlineObj, !!layerHeadline.checked);
        fabricCanvas.renderAll();
      });
      layerSubtext?.addEventListener('change', () => {
        toggleLayer(subtextObj, !!layerSubtext.checked);
        fabricCanvas.renderAll();
      });
      layerCta?.addEventListener('change', () => {
        toggleLayer(ctaObj, !!layerCta.checked);
        toggleLayer(ctaBg, !!layerCta.checked);
        fabricCanvas.renderAll();
      });
      layerLogo?.addEventListener('change', () => {
        toggleLayer(brandMarkObj, !!layerLogo.checked);
        fabricCanvas.renderAll();
      });
      layerBackground?.addEventListener('change', () => {
        toggleLayer(backgroundObj, !!layerBackground.checked);
        fabricCanvas.renderAll();
      });

      undoBtn?.addEventListener('click', async () => {
        if (undoStack.length <= 1) return;
        const current = undoStack.pop();
        if (current) redoStack.push(current);
        const prev = undoStack[undoStack.length - 1];
        await restoreSnapshot(prev);
        updateHistoryButtons();
      });
      redoBtn?.addEventListener('click', async () => {
        if (!redoStack.length) return;
        const snap = redoStack.pop();
        if (!snap) return;
        undoStack.push(snap);
        await restoreSnapshot(snap);
        updateHistoryButtons();
      });

      objectFile?.addEventListener('change', () => {
        const file = objectFile.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            await addImageObjectFromSource(String(reader.result || ''));
          } catch {
            alert('Could not add image object.');
          }
        };
        reader.readAsDataURL(file);
      });
      logoFile?.addEventListener('change', () => {
        const file = logoFile.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const logoObj = await addImageObjectFromSource(String(reader.result || ''));
            if (logoObj) {
              logoObj.set('nabadRole', 'brand');
              logoObj.set({ left: fabricCanvas.getWidth() * 0.78, top: fabricCanvas.getHeight() * 0.05 });
              if (brandMarkObj && brandMarkObj !== logoObj) {
                fabricCanvas.remove(brandMarkObj);
              }
              brandMarkObj = logoObj;
              fabricCanvas.renderAll();
              updateLayerVisibilityControls();
            }
          } catch {
            alert('Could not add logo image.');
          }
        };
        reader.readAsDataURL(file);
      });

      regenerateBtn?.addEventListener('click', async () => {
        const promptValue = window.prompt('Swap Background: optional hint (style, mood, colors)', '');
        if (promptValue === null) return;
        const tweak = cleanText(promptValue || '', 220);
        if (!tweak || tweak.length < 2) return;

        const previousLabel = regenerateBtn.textContent;
        regenerateBtn.disabled = true;
        regenerateBtn.textContent = 'Regenerating...';
        showEditorBusy('Regenerating image...', 'regenerate');
        try {
          const basePrompt = cleanText(campaignData.imagePrompt || prompt, 1200);
          const variantPrompt = cleanText(
            `${basePrompt} Create a distinctly different composition and scene from previous version. ${tweak ? `Extra direction: ${tweak}.` : ''}`,
            1300
          );
          const nextImage = await fetchCampaignEditorImage(variantPrompt);
          await setBackgroundFromUrl(nextImage.url, false);
          backgroundObj?.sendToBack?.();
          fabricCanvas.renderAll();
        } catch (err) {
          console.error('[NABAD] editor regenerate image error:', err);
          alert('Could not regenerate image right now. Please try again.');
        } finally {
          regenerateBtn.disabled = false;
          regenerateBtn.textContent = previousLabel || 'Regenerate image';
          hideEditorBusy();
        }
      });

      rewriteBtn?.addEventListener('click', async () => {
        const previousLabel = rewriteBtn.textContent;
        rewriteBtn.disabled = true;
        rewriteBtn.textContent = 'Rewriting...';
        showEditorBusy('Rewriting campaign text...', 'rewrite');
        try {
          const rewriteHint = cleanText(window.prompt('Rewrite Copy: optional angle (urgent, premium, playful, etc.)', '') || '', 220);
          const rewritten = await fetchCampaignRewriteCopy({
            headline: cleanText(headlineObj.text || '', 220),
            subtext: cleanText(subtextObj.text || '', 260),
            ctaText: cleanText(ctaObj.text || '', 120),
            objective: cleanText(campaignData.objective || '', 200),
            audience: cleanText(campaignData.audience || '', 180),
            offer: cleanText(campaignData.offer || '', 220),
            tone: cleanText(campaignData.tone || '', 90),
            visualStyle: cleanText(campaignData.visualStyle || '', 140),
            platform: cleanText(campaignData.platform || '', 80),
            format: cleanText(campaignData.format || '', 50),
            rewriteHint
          });
          if (rewritten.headline) headlineObj.set('text', rewritten.headline);
          if (rewritten.subtext) subtextObj.set('text', rewritten.subtext);
          if (rewritten.ctaText) ctaObj.set('text', rewritten.ctaText);
          syncCtaBackground();
          fabricCanvas.renderAll();
        } catch (err) {
          console.error('[NABAD] editor rewrite copy error:', err);
          alert('Could not rewrite copy right now. Please try again.');
        } finally {
          rewriteBtn.disabled = false;
          rewriteBtn.textContent = previousLabel || 'Rewrite copy';
          hideEditorBusy();
        }
      });

      const keyHandler = (e) => {
        if (e.key === 'Escape' && eraserMode) {
          e.preventDefault();
          setEraserMode(false);
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const active = fabricCanvas.getActiveObject();
          if (active && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
            e.preventDefault();
            deleteSelectedObject();
          }
        }
      };
      document.addEventListener('keydown', keyHandler);

      removeBgBtn?.addEventListener('click', async () => {
        await removeSelectedImageBackground();
      });
      setBgBtn?.addEventListener('click', async () => {
        await setSelectedAsBackground();
      });

      paletteBtn?.addEventListener('click', () => {
        const palette = cleanText(window.prompt('Color palette: ocean / sunset / mono / neon', 'ocean') || 'ocean', 20).toLowerCase();
        const palettes = {
          ocean: { title: '#ffffff', sub: '#e0f2fe', cta: '#0ea5e9', brand: '#bae6fd' },
          sunset: { title: '#fff7ed', sub: '#fed7aa', cta: '#f97316', brand: '#fdba74' },
          mono: { title: '#f8fafc', sub: '#d1d5db', cta: '#334155', brand: '#cbd5e1' },
          neon: { title: '#fef9ff', sub: '#f0abfc', cta: '#d946ef', brand: '#e879f9' }
        };
        const p = palettes[palette] || palettes.ocean;
        headlineObj?.set('fill', p.title);
        subtextObj?.set('fill', p.sub);
        brandMarkObj?.set('fill', p.brand);
        ctaBg?.set('fill', p.cta);
        applyCtaStyle('solid');
        fabricCanvas.renderAll();
      });

      const getBackgroundSource = () => {
        if (!backgroundObj) return '';
        if (typeof backgroundObj.getSrc === 'function') return String(backgroundObj.getSrc() || '');
        return String(backgroundObj._element?.src || '');
      };

      const loadScriptOnce = (id, src) => new Promise((resolve, reject) => {
        const existing = document.getElementById(id);
        if (existing) return resolve();
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
      });

      const loadCocoSsd = async () => {
        await loadScriptOnce('nabad-tfjs', 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js');
        await loadScriptOnce('nabad-coco-ssd', 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
        if (!window.cocoSsd || !window.cocoSsd.load) {
          throw new Error('COCO-SSD failed to load');
        }
        return window.cocoSsd.load();
      };

      const loadTesseract = async () => {
        await loadScriptOnce('nabad-tesseract', 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
        if (!window.Tesseract || !window.Tesseract.recognize) {
          throw new Error('Tesseract failed to load');
        }
        return window.Tesseract;
      };

      detectObjectsBtn?.addEventListener('click', async () => {
        try {
          const src = getBackgroundSource();
          if (!src) return alert('Background image not found.');
          showEditorBusy('Detecting objects...', 'regenerate');
          const model = await loadCocoSsd();
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = src;
          });
          const detections = await model.detect(img);
          if (!Array.isArray(detections) || !detections.length) {
            alert('No clear objects detected in this image.');
            return;
          }
          const cw = fabricCanvas.getWidth();
          const ch = fabricCanvas.getHeight();
          const rx = cw / Math.max(1, img.naturalWidth || img.width || cw);
          const ry = ch / Math.max(1, img.naturalHeight || img.height || ch);
          detections.slice(0, 12).forEach((d) => {
            const [x, y, w, h] = d.bbox || [];
            if (!w || !h) return;
            const rect = new window.fabric.Rect({
              left: x * rx,
              top: y * ry,
              width: Math.max(12, w * rx),
              height: Math.max(12, h * ry),
              fill: 'rgba(14,165,233,0.12)',
              stroke: '#0ea5e9',
              strokeWidth: 1.5
            });
            const tag = new window.fabric.IText(cleanText(String(d.class || 'object'), 24), {
              left: x * rx + 6,
              top: y * ry - 18,
              fontSize: 14,
              fill: '#0f172a',
              fontWeight: 700,
              fontFamily: defaultFont
            });
            fabricCanvas.add(rect, tag);
          });
          fabricCanvas.renderAll();
        } catch (err) {
          console.error('[NABAD] detect objects error:', err);
          alert('Object detection unavailable in this browser right now.');
        } finally {
          hideEditorBusy();
        }
      });

      detectTextBtn?.addEventListener('click', async () => {
        try {
          const src = getBackgroundSource();
          if (!src) return alert('Background image not found.');
          showEditorBusy('Detecting text...', 'rewrite');
          const Tesseract = await loadTesseract();
          const result = await Tesseract.recognize(src, 'eng');
          const words = result?.data?.words || [];
          if (!words.length) {
            alert('No readable text detected.');
            return;
          }
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = src;
          });
          const cw = fabricCanvas.getWidth();
          const ch = fabricCanvas.getHeight();
          const rx = cw / Math.max(1, img.naturalWidth || img.width || cw);
          const ry = ch / Math.max(1, img.naturalHeight || img.height || ch);
          words.slice(0, 16).forEach((w) => {
            const text = cleanText(String(w.text || ''), 80);
            if (!text) return;
            const bbox = w.bbox || {};
            const left = Number(bbox.x0 || 0) * rx;
            const top = Number(bbox.y0 || 0) * ry;
            const boxW = Math.max(40, Number((bbox.x1 || 0) - (bbox.x0 || 0)) * rx);
            const boxH = Math.max(18, Number((bbox.y1 || 0) - (bbox.y0 || 0)) * ry);
            const txt = new window.fabric.IText(text, {
              left,
              top,
              width: boxW,
              fontSize: Math.max(14, Math.round(boxH * 0.8)),
              fill: '#ffffff',
              fontWeight: 700,
              fontFamily: defaultFont,
              shadow: 'rgba(0,0,0,0.35) 0 2px 6px'
            });
            fabricCanvas.add(txt);
          });
          fabricCanvas.renderAll();
          alert('Text regions added as editable layers.');
        } catch (err) {
          console.error('[NABAD] detect text error:', err);
          alert('Text detection unavailable in this browser right now.');
        } finally {
          hideEditorBusy();
        }
      });

      let currentAspect = 16 / 9;
      let selectedSizePreset = 'landscape';
      let customSize = {
        w: Math.max(240, Number(customSizeWInput?.value || 1920)),
        h: Math.max(240, Number(customSizeHInput?.value || 1080))
      };
      const clampCustomSize = () => {
        customSize.w = Math.max(240, Math.min(4096, Number(customSizeWInput?.value || customSize.w || 1920)));
        customSize.h = Math.max(240, Math.min(4096, Number(customSizeHInput?.value || customSize.h || 1080)));
        if (customSizeWInput) customSizeWInput.value = String(Math.round(customSize.w));
        if (customSizeHInput) customSizeHInput.value = String(Math.round(customSize.h));
      };
      const getExportSizeFromPreset = (preset = selectedSizePreset) => {
        const next = String(preset || 'landscape').toLowerCase();
        if (next === 'square') return { w: 1080, h: 1080 };
        if (next === 'story') return { w: 1080, h: 1920 };
        if (next === 'custom') {
          clampCustomSize();
          return { w: Math.round(customSize.w), h: Math.round(customSize.h) };
        }
        return { w: 1920, h: 1080 };
      };
      const resizeCanvasPreservingLayout = (nextW, nextH) => {
        const prevW = Math.max(1, Number(fabricCanvas.getWidth() || nextW || 1));
        const prevH = Math.max(1, Number(fabricCanvas.getHeight() || nextH || 1));
        const width = Math.max(220, Number(nextW || prevW));
        const height = Math.max(140, Number(nextH || prevH));
        const sx = width / prevW;
        const sy = height / prevH;
        const objects = fabricCanvas.getObjects();
        objects.forEach((obj) => {
          if (!obj || obj === backgroundObj) return;
          obj.set({
            left: Number(obj.left || 0) * sx,
            top: Number(obj.top || 0) * sy,
            scaleX: Number(obj.scaleX || 1) * sx,
            scaleY: Number(obj.scaleY || 1) * sy
          });
          obj.setCoords();
        });
        fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        fabricCanvas.setWidth(width);
        fabricCanvas.setHeight(height);
        if (backgroundObj) fitBackground(backgroundObj);
        syncCtaBackground();
        fabricCanvas.renderAll();
        updateControlFromActive();
      };
      fitCanvasToStage = () => {};

      let stageScale = 1;
      let stageOffsetX = 0;
      let stageOffsetY = 0;
      let cardOffsetX = 0;
      let cardOffsetY = 0;
      let hasUserPannedOrZoomed = false;
      const applyStageTransform = () => {
        if (!stageSurfaceEl) return;
        stageSurfaceEl.style.transform = `translate(${Math.round(stageOffsetX)}px, ${Math.round(stageOffsetY)}px) scale(${stageScale.toFixed(3)})`;
      };
      const applyCardTransform = () => {
        if (!campaignCardEl) return;
        campaignCardEl.style.left = `${Math.round(cardOffsetX)}px`;
        campaignCardEl.style.top = `${Math.round(cardOffsetY)}px`;
      };
      const centerCardInViewport = () => {
        if (!viewportEl || !campaignCardEl) return;
        const vw = viewportEl.clientWidth || 800;
        const vh = viewportEl.clientHeight || 560;
        const cardW = Math.max(1, Number(fabricCanvas.getWidth() || campaignCardEl.offsetWidth || 1));
        const cardH = Math.max(1, Number(fabricCanvas.getHeight() || campaignCardEl.offsetHeight || 1));
        cardOffsetX = Math.max(0, (vw - cardW) / 2);
        cardOffsetY = Math.max(0, (vh - cardH) / 2);
        applyCardTransform();
      };
      const fitWorkspaceToViewport = () => {
        if (!viewportEl || !campaignCardEl) return;
        const vw = Math.max(320, viewportEl.clientWidth || 320);
        const vh = Math.max(220, viewportEl.clientHeight || 220);
        const cardW = Math.max(1, Number(fabricCanvas.getWidth() || campaignCardEl.offsetWidth || 1));
        const cardH = Math.max(1, Number(fabricCanvas.getHeight() || campaignCardEl.offsetHeight || 1));
        const fitScale = Math.min(1, Math.max(0.2, Math.min((vw - 24) / cardW, (vh - 24) / cardH)));
        stageScale = fitScale;
        stageOffsetX = 0;
        stageOffsetY = 0;
        centerCardInViewport();
        applyStageTransform();
      };
      const resetWorkspaceView = () => {
        hasUserPannedOrZoomed = false;
        stageScale = 1;
        stageOffsetX = 0;
        stageOffsetY = 0;
        applyStageTransform();
        centerCardInViewport();
      };

      const applyResizePreset = (preset = 'landscape') => {
        const next = String(preset || 'landscape').toLowerCase();
        selectedSizePreset = ['square', 'story', 'landscape', 'custom'].includes(next) ? next : 'landscape';
        if (saveSizeSelect && saveSizeSelect.value !== selectedSizePreset) saveSizeSelect.value = selectedSizePreset;
        if (selectedSizePreset === 'custom') clampCustomSize();
        const exportSize = getExportSizeFromPreset(selectedSizePreset);
        currentAspect = Math.max(0.1, exportSize.w / Math.max(1, exportSize.h));
        if (saveSizeCustomWrap) saveSizeCustomWrap.hidden = selectedSizePreset !== 'custom';
        resizeCanvasPreservingLayout(exportSize.w, exportSize.h);
        if (campaignCardEl) {
          campaignCardEl.style.width = `${exportSize.w}px`;
          campaignCardEl.style.height = `${exportSize.h}px`;
        }
        fitWorkspaceToViewport();
      };

      saveSizeSelect?.addEventListener('change', () => {
        const preset = cleanText(saveSizeSelect.value || 'landscape', 20).toLowerCase();
        applyResizePreset(preset);
      });
      customSizeWInput?.addEventListener('input', () => {
        if (selectedSizePreset !== 'custom') return;
        clampCustomSize();
        applyResizePreset('custom');
      });
      customSizeHInput?.addEventListener('input', () => {
        if (selectedSizePreset !== 'custom') return;
        clampCustomSize();
        applyResizePreset('custom');
      });
      let selectedNewProjectRatio = 'landscape';
      const setNewProjectRatio = (nextRatio = 'landscape') => {
        selectedNewProjectRatio = ['landscape', 'story', 'square', 'custom'].includes(nextRatio) ? nextRatio : 'landscape';
        const ratioButtons = Array.from(newProjectRatiosWrap?.querySelectorAll?.('.nabad-editor-new-project-btn') || []);
        ratioButtons.forEach((btn) => {
          btn.classList.toggle('active', btn.getAttribute('data-ratio') === selectedNewProjectRatio);
        });
        if (newProjectCustomWrap) newProjectCustomWrap.hidden = selectedNewProjectRatio !== 'custom';
      };
      if (newProjectRatiosWrap) {
        newProjectRatiosWrap.addEventListener('click', (e) => {
          const btn = e.target?.closest?.('.nabad-editor-new-project-btn');
          if (!btn) return;
          setNewProjectRatio(cleanText(btn.getAttribute('data-ratio') || '', 20).toLowerCase());
        });
      }
      setNewProjectRatio('landscape');
      newProjectCreateBtn?.addEventListener('click', () => {
        if (selectedNewProjectRatio === 'custom') {
          const w = Math.max(240, Math.min(4096, Number(newProjectCustomW?.value || 1920)));
          const h = Math.max(240, Math.min(4096, Number(newProjectCustomH?.value || 1080)));
          if (customSizeWInput) customSizeWInput.value = String(Math.round(w));
          if (customSizeHInput) customSizeHInput.value = String(Math.round(h));
        }
        applyResizePreset(selectedNewProjectRatio);
        applyBlankProjectState();
        if (newProjectGateEl) {
          newProjectGateEl.classList.remove('show');
          window.setTimeout(() => { newProjectGateEl.hidden = true; }, 180);
        }
      });
      const onWindowResizeEditor = () => {
        if (!hasUserPannedOrZoomed) {
          fitWorkspaceToViewport();
          return;
        }
        applyStageTransform();
        applyCardTransform();
      };
      window.addEventListener('resize', onWindowResizeEditor);
      zoomInBtn?.addEventListener('click', () => {
        stageScale = Math.min(3, stageScale + 0.1);
        hasUserPannedOrZoomed = true;
        applyStageTransform();
      });
      zoomOutBtn?.addEventListener('click', () => {
        stageScale = Math.max(0.2, stageScale - 0.1);
        hasUserPannedOrZoomed = true;
        applyStageTransform();
      });
      zoomResetBtn?.addEventListener('click', () => {
        fitWorkspaceToViewport();
      });

      let isPanningStage = false;
      let isPinchingStage = false;
      let panStartX = 0;
      let panStartY = 0;
      let pinchStartDistance = 0;
      let pinchStartScale = 1;
      const getTouchDistance = (touchA, touchB) => {
        if (!touchA || !touchB) return 0;
        const dx = Number(touchA.clientX || 0) - Number(touchB.clientX || 0);
        const dy = Number(touchA.clientY || 0) - Number(touchB.clientY || 0);
        return Math.sqrt(dx * dx + dy * dy);
      };
      const onViewportMouseDown = (e) => {
        if (eraserMode) return;
        if (e.button !== 0) return;
        const target = e.target;
        if (!target) return;
        const isEmptyWorkspaceTarget =
          target === viewportEl ||
          target === workspaceEl ||
          target === stageEl ||
          target?.id === 'nabad-canvas-viewport' ||
          target?.id === 'nabad-workspace' ||
          target?.id === 'nabad-canvas-stage';
        if (!isEmptyWorkspaceTarget) return;
        if (target.closest('#nabad-campaign-card') || target.closest('#nabad-zoom-controls')) return;
        e.preventDefault();
        e.stopPropagation();
        isPinchingStage = false;
        isPanningStage = true;
        panStartX = e.clientX - stageOffsetX;
        panStartY = e.clientY - stageOffsetY;
        workspaceEl?.classList.add('nabad-panning');
      };
      const onViewportTouchStart = (e) => {
        if (eraserMode) return;
        if (e.touches?.length >= 2) {
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          pinchStartDistance = getTouchDistance(t1, t2);
          pinchStartScale = stageScale;
          isPinchingStage = pinchStartDistance > 0;
          isPanningStage = false;
          if (isPinchingStage) e.preventDefault();
          return;
        }
        const touch = e.touches?.[0];
        if (!touch) return;
        const target = e.target;
        if (target?.closest?.('#nabad-campaign-card') || target?.closest?.('#nabad-zoom-controls')) return;
        e.preventDefault();
        e.stopPropagation();
        isPinchingStage = false;
        isPanningStage = true;
        panStartX = touch.clientX - stageOffsetX;
        panStartY = touch.clientY - stageOffsetY;
        workspaceEl?.classList.add('nabad-panning');
      };
      const onViewportWheel = (e) => {
        e.preventDefault();
        stageScale = Math.min(3, Math.max(0.2, stageScale + (e.deltaY > 0 ? -0.1 : 0.1)));
        hasUserPannedOrZoomed = true;
        applyStageTransform();
      };
      if (viewportEl) {
        viewportEl.addEventListener('mousedown', onViewportMouseDown);
        viewportEl.addEventListener('touchstart', onViewportTouchStart, { passive: false });
        viewportEl.addEventListener('wheel', onViewportWheel, { passive: false });
        viewportEl.addEventListener('dragstart', (e) => e.preventDefault());
      }
      const onWindowMouseMoveStage = (e) => {
        if (!isPanningStage) return;
        stageOffsetX = e.clientX - panStartX;
        stageOffsetY = e.clientY - panStartY;
        hasUserPannedOrZoomed = true;
        applyStageTransform();
      };
      const onWindowTouchMoveStage = (e) => {
        if (isPinchingStage) {
          if (!e.touches || e.touches.length < 2) return;
          const nextDistance = getTouchDistance(e.touches[0], e.touches[1]);
          if (!pinchStartDistance || !nextDistance) return;
          const ratio = nextDistance / pinchStartDistance;
          stageScale = Math.min(3, Math.max(0.2, pinchStartScale * ratio));
          hasUserPannedOrZoomed = true;
          applyStageTransform();
          e.preventDefault();
          return;
        }
        if (!isPanningStage) return;
        const touch = e.touches?.[0];
        if (!touch) return;
        stageOffsetX = touch.clientX - panStartX;
        stageOffsetY = touch.clientY - panStartY;
        hasUserPannedOrZoomed = true;
        applyStageTransform();
        e.preventDefault();
      };
      const onWindowMouseUpStage = () => {
        isPanningStage = false;
        isPinchingStage = false;
        workspaceEl?.classList.remove('nabad-panning');
      };
      const onWindowTouchEndStage = (e) => {
        if (isPinchingStage && e.touches?.length >= 2) {
          pinchStartDistance = getTouchDistance(e.touches[0], e.touches[1]);
          pinchStartScale = stageScale;
          return;
        }
        isPinchingStage = false;
        if (!e.touches || !e.touches.length) {
          isPanningStage = false;
          workspaceEl?.classList.remove('nabad-panning');
        }
      };
      window.addEventListener('mousemove', onWindowMouseMoveStage);
      window.addEventListener('touchmove', onWindowTouchMoveStage, { passive: false });
      window.addEventListener('mouseup', onWindowMouseUpStage);
      window.addEventListener('touchend', onWindowTouchEndStage);
      window.addEventListener('touchcancel', onWindowTouchEndStage);

      let isDraggingCard = false;
      let cardStartX = 0;
      let cardStartY = 0;
      const canStartCardDrag = (e) => {
        if (eraserMode) return false;
        const target = e.target;
        if (!target) return false;
        if (target.closest('#nabad-card-handle') || target.closest('#nabad-zoom-controls') || target.closest('.nabad-editor-topbar')) return false;
        if (fabricCanvas?.isEditing?.()) return false;
        try {
          const fabricTarget = fabricCanvas?.findTarget?.(e, false);
          if (fabricTarget) return false;
        } catch {}
        return !!target.closest('#nabad-campaign-card');
      };
      const startCardDrag = (clientX, clientY) => {
        isDraggingCard = true;
        cardStartX = clientX - cardOffsetX;
        cardStartY = clientY - cardOffsetY;
      };
      const onCardHandleMouseDown = (e) => {
        startCardDrag(e.clientX, e.clientY);
        e.preventDefault();
        e.stopPropagation();
      };
      const onCardHandleTouchStart = (e) => {
        const touch = e.touches?.[0];
        if (!touch) return;
        startCardDrag(touch.clientX, touch.clientY);
        e.preventDefault();
        e.stopPropagation();
      };
      const onCardSurfaceMouseDown = (e) => {
        if (!canStartCardDrag(e)) return;
        startCardDrag(e.clientX, e.clientY);
        e.preventDefault();
        e.stopPropagation();
      };
      const onCardSurfaceTouchStart = (e) => {
        const touch = e.touches?.[0];
        if (!touch) return;
        if (!canStartCardDrag(e)) return;
        startCardDrag(touch.clientX, touch.clientY);
        e.preventDefault();
        e.stopPropagation();
      };
      cardHandleEl?.addEventListener('mousedown', onCardHandleMouseDown);
      cardHandleEl?.addEventListener('touchstart', onCardHandleTouchStart, { passive: false });
      campaignCardEl?.addEventListener('mousedown', onCardSurfaceMouseDown);
      campaignCardEl?.addEventListener('touchstart', onCardSurfaceTouchStart, { passive: false });
      const onWindowMouseMoveCard = (e) => {
        if (!isDraggingCard) return;
        cardOffsetX = e.clientX - cardStartX;
        cardOffsetY = e.clientY - cardStartY;
        hasUserPannedOrZoomed = true;
        applyCardTransform();
      };
      const onWindowTouchMoveCard = (e) => {
        if (!isDraggingCard) return;
        const touch = e.touches?.[0];
        if (!touch) return;
        cardOffsetX = touch.clientX - cardStartX;
        cardOffsetY = touch.clientY - cardStartY;
        hasUserPannedOrZoomed = true;
        applyCardTransform();
      };
      const onWindowMouseUpCard = () => { isDraggingCard = false; };
      window.addEventListener('mousemove', onWindowMouseMoveCard);
      window.addEventListener('touchmove', onWindowTouchMoveCard, { passive: false });
      window.addEventListener('mouseup', onWindowMouseUpCard);
      window.addEventListener('touchend', onWindowMouseUpCard);
      window.addEventListener('touchcancel', onWindowMouseUpCard);

      const cleanupWorkspaceListeners = () => {
        window.removeEventListener('resize', onWindowResizeEditor);
        viewportEl?.removeEventListener('mousedown', onViewportMouseDown);
        viewportEl?.removeEventListener('touchstart', onViewportTouchStart);
        viewportEl?.removeEventListener('wheel', onViewportWheel);
        window.removeEventListener('mousemove', onWindowMouseMoveStage);
        window.removeEventListener('touchmove', onWindowTouchMoveStage);
        window.removeEventListener('mouseup', onWindowMouseUpStage);
        window.removeEventListener('touchend', onWindowTouchEndStage);
        window.removeEventListener('touchcancel', onWindowTouchEndStage);
        cardHandleEl?.removeEventListener('mousedown', onCardHandleMouseDown);
        cardHandleEl?.removeEventListener('touchstart', onCardHandleTouchStart);
        campaignCardEl?.removeEventListener('mousedown', onCardSurfaceMouseDown);
        campaignCardEl?.removeEventListener('touchstart', onCardSurfaceTouchStart);
        window.removeEventListener('mousemove', onWindowMouseMoveCard);
        window.removeEventListener('touchmove', onWindowTouchMoveCard);
        window.removeEventListener('mouseup', onWindowMouseUpCard);
        window.removeEventListener('touchend', onWindowMouseUpCard);
        window.removeEventListener('touchcancel', onWindowMouseUpCard);
      };

      const exportCanvasAtSize = async (width, height) => {
        const srcW = Math.max(1, fabricCanvas.getWidth());
        const srcH = Math.max(1, fabricCanvas.getHeight());
        const rx = width / srcW;
        const ry = height / srcH;
        const off = document.createElement('canvas');
        off.width = width;
        off.height = height;
        const staticCanvas = new window.fabric.StaticCanvas(off, {
          width,
          height,
          backgroundColor: 'transparent'
        });
        const clones = await Promise.all(fabricCanvas.getObjects().map((obj) => new Promise((resolve) => {
          obj.clone((cloned) => resolve(cloned), ['nabadRole', 'isCtaText']);
        })));
        clones.forEach((clone) => {
          if (!clone) return;
          clone.set({
            left: Number(clone.left || 0) * rx,
            top: Number(clone.top || 0) * ry,
            scaleX: Number(clone.scaleX || 1) * rx,
            scaleY: Number(clone.scaleY || 1) * ry
          });
          clone.setCoords();
          staticCanvas.add(clone);
        });
        staticCanvas.renderAll();
        const dataUrl = staticCanvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 3
        });
        staticCanvas.dispose();
        return dataUrl;
      };

      mergeBtn?.addEventListener('click', async () => {
        try {
          const mergeConfirmed = window.confirm('Merge visible layers into one background image? You can still undo.');
          if (!mergeConfirmed) return;
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          const mergedDataUrl = fabricCanvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 1
          });
          await setBackgroundFromUrl(mergedDataUrl, false);
          const allObjects = fabricCanvas.getObjects().slice();
          allObjects.forEach((obj) => {
            if (!obj || obj === backgroundObj) return;
            fabricCanvas.remove(obj);
          });
          headlineObj = null;
          subtextObj = null;
          ctaObj = null;
          ctaBg = null;
          brandMarkObj = null;
          layerHeadline && (layerHeadline.checked = false);
          layerSubtext && (layerSubtext.checked = false);
          layerCta && (layerCta.checked = false);
          layerLogo && (layerLogo.checked = false);
          layerBackground && (layerBackground.checked = true);
          fabricCanvas.renderAll();
          pushHistory();
          updateControlFromActive();
        } catch {
          alert('Could not merge layers. Please try again.');
        }
      });

      saveBtn?.addEventListener('click', async () => {
        try {
          fabricCanvas.discardActiveObject();
          fabricCanvas.renderAll();
          const preset = cleanText(saveSizeSelect?.value || selectedSizePreset || 'landscape', 20).toLowerCase();
          const size = getExportSizeFromPreset(preset);
          const dataUrl = await exportCanvasAtSize(size.w, size.h);
          await downloadImageFromUrl(dataUrl, 'nabad-campaign-editor.png');
        } catch {
          alert('Could not export image. Please try again.');
        }
      });

      const runExternalEditorAction = async (action = '', payload = {}) => {
        const key = cleanText(action, 40).toLowerCase();
        if (!key) return false;
        if (key === 'undo') {
          undoBtn?.click();
          return true;
        }
        if (key === 'redo') {
          redoBtn?.click();
          return true;
        }
        if (key === 'save') {
          saveBtn?.click();
          return true;
        }
        if (key === 'upload') {
          addImageBtn?.click();
          return true;
        }
        if (key === 'back_chat') {
          backBtn?.click();
          return true;
        }
        if (key === 'open_settings') {
          backBtn?.click();
          setTimeout(() => openSettingsPage(), 120);
          return true;
        }
        if (key === 'set_layer_action') {
          const nextAction = cleanText(payload?.value || '', 40);
          if (!nextAction) return false;
          if (nextAction === 'add-image-object') addImageBtn?.click();
          else if (nextAction === 'remove-bg') removeBgBtn?.click();
          else if (nextAction === 'set-background') setBgBtn?.click();
          else if (nextAction === 'bring-front') {
            const obj = fabricCanvas.getActiveObject();
            if (obj) {
              obj.bringToFront();
              brandMarkObj?.bringToFront?.();
              ctaBg?.bringToFront?.();
              ctaObj?.bringToFront?.();
              fabricCanvas.renderAll();
            }
          } else if (nextAction === 'send-back') {
            const obj = fabricCanvas.getActiveObject();
            if (obj) {
              obj.sendBackwards();
              backgroundObj?.sendToBack?.();
              fabricCanvas.renderAll();
            }
          }
          return true;
        }
        if (key === 'set_layer_visibility') {
          const layer = cleanText(payload?.layer || '', 20).toLowerCase();
          const visible = payload?.visible !== false;
          if (layer === 'headline' && headlineObj) headlineObj.set('visible', visible);
          if (layer === 'subtext' && subtextObj) subtextObj.set('visible', visible);
          if (layer === 'cta') {
            ctaObj?.set('visible', visible);
            ctaBg?.set('visible', visible);
          }
          if (layer === 'logo' && brandMarkObj) brandMarkObj.set('visible', visible);
          if (layer === 'background' && backgroundObj) backgroundObj.set('visible', visible);
          fabricCanvas.renderAll();
          updateLayerVisibilityControls();
          return true;
        }
        if (key === 'editor_add') {
          const type = cleanText(payload?.type || '', 20).toLowerCase();
          if (type === 'text') addTextBtn?.click();
          else if (type === 'image') addImageBtn?.click();
          else if (type === 'logo') addLogoBtn?.click();
          else if (type === 'shape') addShapeBtn?.click();
          else return false;
          return true;
        }
        if (key === 'delete_selected') {
          deleteBtn?.click();
          return true;
        }
        if (key === 'set_save_size') {
          const size = cleanText(payload?.size || '', 20).toLowerCase();
          if (saveSizeSelect && ['square', 'story', 'landscape', 'custom'].includes(size)) {
            if (size === 'custom') {
              if (payload && Number(payload.width) > 0 && customSizeWInput) {
                customSizeWInput.value = String(Math.max(240, Math.min(4096, Math.round(Number(payload.width)))));
              }
              if (payload && Number(payload.height) > 0 && customSizeHInput) {
                customSizeHInput.value = String(Math.max(240, Math.min(4096, Math.round(Number(payload.height)))));
              }
            }
            applyResizePreset(size);
          }
          return true;
        }
        if (key === 'run_ai_action') {
          const ai = cleanText(payload?.type || '', 30).toLowerCase();
          if (ai === 'rewrite') rewriteBtn?.click();
          else if (ai === 'swap_bg') regenerateBtn?.click();
          else if (ai === 'palette') paletteBtn?.click();
          else if (ai === 'detect_objects') detectObjectsBtn?.click();
          else if (ai === 'detect_text') detectTextBtn?.click();
          else if (ai === 'remove_bg') removeBgBtn?.click();
          else if (ai === 'set_bg') setBgBtn?.click();
          else return false;
          return true;
        }
        if (key === 'set_selected_style') {
          const obj = fabricCanvas.getActiveObject();
          if (!obj) return false;
          const isText = isTextLikeObject(obj);
          const has = (prop) => Object.prototype.hasOwnProperty.call(payload || {}, prop);
          if (isText) {
            if (has('fontFamily')) obj.set('fontFamily', cleanText(payload.fontFamily, 48));
            if (has('fontSize')) obj.set('fontSize', Math.max(8, Number(payload.fontSize)));
            if (has('color')) obj.set('fill', cleanText(payload.color, 20));
            if (has('bold')) obj.set('fontWeight', payload.bold ? '700' : 'normal');
            if (has('italic')) obj.set('fontStyle', payload.italic ? 'italic' : 'normal');
            if (has('underline')) obj.set('underline', !!payload.underline);
          }
          const x = Number(payload.x);
          const y = Number(payload.y);
          const w = Number(payload.w);
          const h = Number(payload.h);
          const opacity = Number(payload.opacity);
          if (has('x') && Number.isFinite(x)) obj.set('left', x);
          if (has('y') && Number.isFinite(y)) obj.set('top', y);
          if (has('opacity') && Number.isFinite(opacity)) obj.set('opacity', Math.max(0, Math.min(1, opacity / 100)));
          if (has('w') && has('h') && Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 && !isText) {
            const baseW = Math.max(1, Number(obj.width || 1));
            const baseH = Math.max(1, Number(obj.height || 1));
            obj.set({ scaleX: w / baseW, scaleY: h / baseH });
          }
          if (obj === ctaObj) syncCtaBackground();
          fabricCanvas.renderAll();
          updateControlFromActive();
          return true;
        }
        return false;
      };
      window.__NABAD_EDITOR_DO__ = runExternalEditorAction;

      state.campaignEditorContext = {
        canvas: fabricCanvas,
        payload: campaignData,
        imageUrl: image.url,
        background: backgroundObj,
        keyHandler,
        runExternalEditorAction
      };

      if (fontFamilySelect) fontFamilySelect.value = defaultFont;
      if (textSizeRange) textSizeRange.value = String(Math.round(headlineObj.fontSize || 58));
      applyResizePreset(cleanText(saveSizeSelect?.value || 'landscape', 20).toLowerCase());
      setBackgroundLockState(true);
      historyMuted = false;
      undoStack = [snapshotEditorState()];
      redoStack = [];
      updateHistoryButtons();
      updateLayerVisibilityControls();
      updateControlFromActive();
      hideEditorBusy();
    } catch (err) {
      console.error('[NABAD] campaign editor error:', err);
      try { cleanupWorkspaceListeners(); } catch {}
      if (fitCanvasToStage) {
        try { window.removeEventListener('resize', fitCanvasToStage); } catch {}
      }
      if (resizeObserver) {
        try { resizeObserver.disconnect(); } catch {}
      }
      if (state.campaignEditorContext?.keyHandler) {
        document.removeEventListener('keydown', state.campaignEditorContext.keyHandler);
      }
      try { delete window.__NABAD_EDITOR_DO__; } catch {}
      restoreChatAfterEditorMode();
      renderMessage('assistant', '<p>⚠️ Could not open campaign editor right now. Please try again.</p>');
      hideEditorBusy();
    }
  }

  function toHexColor(color = '#ffffff') {
    const value = String(color || '').trim();
    if (!value) return '#ffffff';
    if (value.startsWith('#')) {
      if (value.length === 4) {
        return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
      }
      return value.toLowerCase();
    }
    const m = value.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!m) return '#ffffff';
    const to2 = (n) => Number(n).toString(16).padStart(2, '0');
    return `#${to2(m[1])}${to2(m[2])}${to2(m[3])}`.toLowerCase();
  }

  function campaignBubbleHasActions(bubble) {
    return !!bubble?.querySelector?.('button[data-nabad-action="campaign-refine-text"]');
  }

  function ensureCampaignTemplateStage(bubble) {
    if (!bubble || !campaignBubbleHasActions(bubble)) return null;
    const existing = bubble.querySelector('.nabad-campaign-template-stage');
    if (existing) return existing;
    getEditorRuntime().then((runtime) =>
      runtime.ensureCampaignTemplateStage(bubble, { escapeHtml })
    ).catch(() => {});
    return bubble.querySelector('.nabad-campaign-template-stage');
  }

  function focusCampaignTextField(stage, field = 'headline') {
    if (!stage) return;
    const el = stage.querySelector(`.nabad-campaign-template-text[data-field="${field}"]`)
      || stage.querySelector('.nabad-campaign-template-text[data-field="headline"]');
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    getEditorRuntime().then((runtime) =>
      runtime.focusCampaignTextField(stage, field)
    ).catch(() => {});
  }

  function applyLogoToCampaignStage(stage, imageDataUrl = '') {
    if (!stage || !imageDataUrl) return;
    const logo = stage.querySelector('.nabad-campaign-template-logo');
    if (!logo) return;
    logo.src = imageDataUrl;
    logo.style.display = 'block';
    getEditorRuntime().then((runtime) =>
      runtime.applyLogoToCampaignStage(stage, imageDataUrl)
    ).catch(() => {});
  }

  async function downloadCampaignTemplateImage(stage) {
    if (!stage) return false;
    const bg = stage.querySelector('.nabad-campaign-template-bg');
    if (!bg?.src) return false;

    try {
      const canvas = document.createElement('canvas');
      const width = bg.naturalWidth || 1600;
      const height = bg.naturalHeight || Math.round(width * 0.56);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      const loadImage = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

      const bgImg = await loadImage(bg.src);
      ctx.drawImage(bgImg, 0, 0, width, height);

      const drawText = (field, opts = {}) => {
        const el = stage.querySelector(`.nabad-campaign-template-text[data-field="${field}"]`);
        if (!el) return;
        const stageRect = stage.getBoundingClientRect();
        const rect = el.getBoundingClientRect();
        const x = ((rect.left - stageRect.left) / stageRect.width) * width;
        const y = ((rect.top - stageRect.top) / stageRect.height) * height;
        const fontPx = Math.max(18, ((parseFloat(getComputedStyle(el).fontSize) || 16) / stageRect.height) * height);
        const text = cleanText(el.textContent || '', 180);
        if (!text) return;
        ctx.save();
        ctx.font = `${opts.weight || 800} ${fontPx}px Inter, Arial, sans-serif`;
        ctx.textBaseline = 'top';
        if (opts.cta) {
          const padX = Math.max(14, fontPx * 0.6);
          const padY = Math.max(8, fontPx * 0.35);
          const tw = ctx.measureText(text).width;
          const bw = tw + padX * 2;
          const bh = fontPx + padY * 1.7;
          ctx.fillStyle = 'rgba(37,99,235,0.9)';
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = Math.max(1, fontPx * 0.05);
          const r = Math.max(10, fontPx * 0.45);
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + bw, y, x + bw, y + bh, r);
          ctx.arcTo(x + bw, y + bh, x, y + bh, r);
          ctx.arcTo(x, y + bh, x, y, r);
          ctx.arcTo(x, y, x + bw, y, r);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.fillText(text, x + padX, y + padY);
        } else {
          ctx.shadowColor = 'rgba(0,0,0,0.45)';
          ctx.shadowBlur = fontPx * 0.5;
          ctx.fillStyle = opts.color || '#ffffff';
          ctx.fillText(text, x, y);
        }
        ctx.restore();
      };

      drawText('headline', { weight: 800, color: '#ffffff' });
      drawText('subline', { weight: 600, color: '#ffffff' });
      drawText('cta', { cta: true, weight: 800 });

      const logoEl = stage.querySelector('.nabad-campaign-template-logo');
      if (logoEl?.src && logoEl.style.display !== 'none') {
        try {
          const logoImg = await loadImage(logoEl.src);
          const stageRect = stage.getBoundingClientRect();
          const lr = logoEl.getBoundingClientRect();
          const lx = ((lr.left - stageRect.left) / stageRect.width) * width;
          const ly = ((lr.top - stageRect.top) / stageRect.height) * height;
          const lw = (lr.width / stageRect.width) * width;
          const lh = (lr.height / stageRect.height) * height;
          ctx.drawImage(logoImg, lx, ly, lw, lh);
        } catch {}
      }

      const out = canvas.toDataURL('image/png');
      await downloadImageFromUrl(out, 'nabad-campaign-edited.png');
      return true;
    } catch {
      return false;
    }
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
    bubble.querySelectorAll('img.nabad-gen-image').forEach(img => {
      const src = img.src || '';
      const prompt = img.alt || '';
      if (!src) return;

      const placeholder = createImagePlaceholder();
      img.replaceWith(placeholder);

      const realImg = new Image();
      realImg.onload = () => {
        realImg.className = 'nabad-bubble-img';
        realImg.style.cssText = 'display:block;width:100%;max-width:100%;border-radius:16px;margin-top:6px;cursor:zoom-in;';
        realImg.alt   = prompt || 'Generated image';
        realImg.title = 'Click to enlarge';
        realImg.addEventListener('click', () => openImageLightbox(src));
        const wrap = document.createElement('div');
        wrap.className = 'nabad-inline-image-wrap';
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'nabad-inline-image-save';
        saveBtn.textContent = 'Save image';
        saveBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const stage = bubble.querySelector('.nabad-campaign-template-stage');
          if (stage) {
            const exported = await downloadCampaignTemplateImage(stage);
            if (exported) return;
          }
          downloadImageFromUrl(src, 'nabad-generated-image.png');
        });
        wrap.appendChild(realImg);
        wrap.appendChild(saveBtn);
        clearPlaceholderTimer(placeholder);
        placeholder.replaceWith(wrap);
        if (campaignBubbleHasActions(bubble)) {
          ensureCampaignTemplateStage(bubble);
          bindCampaignEditorEvents(bubble);
        }
        scrollToBottom();
      };
      realImg.onerror = () => {
        const errMsg = document.createElement('p');
        errMsg.style.cssText = 'color:#ef4444;font-size:13px;margin:6px 0;';
        errMsg.textContent = '⚠️ Image could not be loaded.';
        clearPlaceholderTimer(placeholder);
        placeholder.replaceWith(errMsg);
      };
      realImg.src = src;
    });

    // Regular images — add lightbox click
    bubble.querySelectorAll('img:not(.nabad-gen-image)').forEach(img => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => openImageLightbox(img.src));
    });

    // Open links in new tab
    bubble.querySelectorAll('a[href]').forEach(a => {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });

    // Action buttons inside assistant cards
    bubble.querySelectorAll('button[data-nabad-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-nabad-action') || '';
        if (!refs.input) return;
        if (action === 'image-premium') {
          refs.input.value = 'use premium';
        } else if (action === 'image-free') {
          refs.input.value = 'regenerate image';
        } else if (action === 'image-style-simple') {
          refs.input.value = 'Generate a simple minimal clean logo image version';
        } else if (action === 'image-style-creative') {
          refs.input.value = 'Generate a creative artistic bold logo image version';
        } else if (action === 'image-style-realistic') {
          refs.input.value = 'Generate a realistic photoreal logo image version';
        } else if (action === 'image-style-logo') {
          refs.input.value = 'Generate a modern professional logo image version';
        } else if (action === 'campaign-logo-generated') {
          refs.input.value = 'Campaign logo choice: use generated logo';
        } else if (action === 'campaign-logo-upload') {
          refs.input.value = 'Campaign logo choice: use uploaded logo';
          autoGrowTextarea();
          refs.fileInput?.click();
          return;
        } else if (action === 'campaign-logo-none') {
          refs.input.value = 'Campaign logo choice: proceed without logo';
        } else if (action === 'campaign-logo-generate-first') {
          refs.input.value = 'Campaign logo choice: create logo first';
        } else if (action === 'campaign-brief-confirm') {
          refs.input.value = 'Confirm this campaign brief and generate the final ad visual now';
        } else if (action === 'campaign-brief-edit') {
          refs.input.value = 'Edit campaign brief: ';
          autoGrowTextarea();
          refs.input.focus();
          return;
        } else if (action === 'campaign-open-editor') {
          const card = btn.closest('[data-nabad-card="campaign-preview"]');
          const raw = card?.getAttribute('data-campaign-payload') || '';
          let payload = null;
          try { payload = raw ? JSON.parse(decodeURIComponent(raw)) : null; } catch {}
          if (!payload?.imagePrompt) {
            renderMessage('assistant', '<p>⚠️ Campaign payload missing. Please generate campaign draft again.</p>');
            return;
          }
          openCampaignCanvasEditorFromData(payload);
          return;
        } else if (action === 'campaign-refine-text') {
          const stage = ensureCampaignTemplateStage(bubble);
          if (stage) {
            stage.classList.add('editing');
            focusCampaignTextField(stage, 'headline');
          } else {
            openCampaignEditor(bubble, 'headline');
            bindCampaignEditorEvents(bubble);
          }
          return;
        } else if (action === 'campaign-refine-logo') {
          const stage = ensureCampaignTemplateStage(bubble);
          if (stage) stage.classList.add('editing');
          state.campaignEditBubble = bubble;
          state.campaignRefineAction = 'logo-template';
          refs.fileInput?.click();
          return;
        } else if (action === 'campaign-refine-background') {
          const stage = ensureCampaignTemplateStage(bubble);
          if (stage) {
            stage.classList.add('editing');
            openCampaignEditor(bubble, 'background');
            bindCampaignEditorEvents(bubble);
          } else {
            openCampaignEditor(bubble, 'background');
            bindCampaignEditorEvents(bubble);
          }
          return;
        } else if (action === 'campaign-refine-regenerate') {
          sendMessage({ forcedText: 'Regenerate this campaign visual with same layout but improved composition' });
          return;
        } else if (action === 'pricing-edit') {
          const cardEl = btn.closest('[data-nabad-card="pricing"]');
          togglePricingCardEdit(cardEl, btn);
          return;
        } else if (action === 'pricing-export-pdf') {
          const cardEl = btn.closest('[data-nabad-card="pricing"]');
          exportPricingCardPdf(cardEl);
          return;
        } else if (action === 'pricing-export-csv') {
          const cardEl = btn.closest('[data-nabad-card="pricing"]');
          exportPricingCardCsv(cardEl);
          return;
        } else if (action === 'pricing-export-docx') {
          const cardEl = btn.closest('[data-nabad-card="pricing"]');
          exportPricingCardWord(cardEl);
          return;
        } else if (action === 'onboard-business' || action === 'onboard-idea' || action === 'onboard-figuring') {
          const path = action.replace('onboard-', '');
          state.userProfile = { ...state.userProfile, path };
          saveUserProfile(state.userProfile);
          const prompts = {
            business: 'Perfect. Tell me your business in one line and your biggest challenge right now.',
            idea: 'Great. Tell me your idea in one sentence and who would pay for it first.',
            figuring: 'Nice. Tell me your skills and what kind of business you want to build.'
          };
          renderMessage('assistant', `<p>${prompts[path] || prompts.business}</p>`);
          return;
        } else {
          return;
        }
        if (
          action.startsWith('image-style-') &&
          state.lastImageAttachment &&
          state.lastImageAttachment.kind === 'image' &&
          state.lastImageAttachment.dataUrl
        ) {
          state.pendingAttachment = { ...state.lastImageAttachment };
          renderAttachmentChip();
        }
        autoGrowTextarea();
        setTimeout(() => sendMessage(), 80);
      });
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
    const typingLabel = document.getElementById('nabad-typing-label');
    const labels = (Array.isArray(state.typingLabels) && state.typingLabels.length)
      ? state.typingLabels
      : TYPING_LABELS;
    if (typingLabelTimer) {
      clearInterval(typingLabelTimer);
      typingLabelTimer = null;
    }
    if (typingLabel) typingLabel.textContent = labels[0];
    if (on) {
      scrollToBottom();
      let idx = 0;
      typingLabelTimer = setInterval(() => {
        idx = (idx + 1) % labels.length;
        if (typingLabel) typingLabel.textContent = labels[idx];
      }, 1400);
    } else {
      state.typingLabels = null;
    }
  }

  // ── SEND MESSAGE ──────────────────────────────────────────────
  async function sendMessage(options = {}) {
    if (state.sending) return;
    const forcedText = typeof options.forcedText === 'string' ? options.forcedText.trim() : '';
    const forcedAttachment = options.forcedAttachment || null;
    const forcedReplyTo = options.forcedReplyTo || null;

    const text = forcedText || (refs.input.value || '').trim();
    const attachment = forcedAttachment || state.pendingAttachment;
    const replyTo = forcedReplyTo || state.replyTo;
    if (!text && !attachment) return;

    if (shouldForceCreativeForImage(text, attachment)) {
      if (state.autoDetectMode) {
        const prev = state.personality;
        if (prev !== 'creative') {
          state.personality = 'creative';
          state.personalityBuffer = null;
          state.personalityCount = 0;
          state.personalityScore = 0;
          setInputPlaceholder();
          updatePersonalityBadge();
          applyPersonalityColor('creative', true);
        }
      } else {
        forceCreativeModeForImage();
      }
    }

    if (!forcedText && !forcedAttachment && !forcedReplyTo) {
      refs.input.value = '';
      refs.input.style.height = 'auto';
      _lastScrollHeight = 0;
      clearPendingAttachment();
      clearReplyTarget();
    } else {
      if (forcedAttachment) {
        clearPendingAttachment();
      }
      if (forcedReplyTo) {
        clearReplyTarget();
      }
    }
    state.sending = true;
    refs.send.disabled = true;

    renderMessage('user', { text, attachment, replyTo });

    // Logo "thinking" animation
    const logo = document.getElementById('nabad-logo');
    if (logo) logo.classList.add('thinking');

    state.typingLabels = getTypingLabelsForText(text);
    showTyping(true);

    // Hide warroom suggestion if visible
    const wrSug = document.getElementById('nabad-warroom-suggestion');
    if (wrSug) { wrSug.classList.remove('show'); }

    try {
      const profile  = buildProfileSummary();
      const history  = state.messages.slice(-50).map(m => ({ role: m.role, content: m.content }));
      let contentForApi = text;

      if (attachment) {
        const generationIntent = isImageGenerationIntent(text, attachment);
        const attachmentPrompt = generationIntent
          ? `${text ? `${text}\n\n` : ''}A file was attached by the user (${attachment.name}). Use it as a visual reference for generation or editing. Keep brand continuity with what is visible in this attachment.`
          : `${text ? `${text}\n\n` : ''}A file was attached by the user (${attachment.name}). Analyze it deeply. If this attachment is unrelated to the current business context, say that clearly and briefly.`;

        if (attachment.kind === 'image' && attachment.dataUrl) {
          contentForApi = [
            { type: 'text', text: attachmentPrompt },
            { type: 'image_url', image_url: { url: attachment.dataUrl } }
          ];
        } else if (attachment.kind === 'text' && attachment.text) {
          contentForApi = `${attachmentPrompt}\n\nAttachment text:\n${attachment.text}`;
        } else {
          contentForApi = `${attachmentPrompt}\n\nAttachment metadata: type=${attachment.type || 'unknown'}, size=${attachment.sizeLabel || 'unknown'}.`;
        }
      }

      const outboundMessages = attachment
        ? [...history.slice(0, -1), { role: 'user', content: contentForApi }]
        : history;
      const attachmentPayload = attachment
        ? {
            kind: attachment.kind || 'document',
            name: cleanText(attachment.name || 'attachment', 140),
            type: cleanText(attachment.type || '', 120),
            sizeLabel: cleanText(attachment.sizeLabel || '', 24),
            dataUrl: attachment.kind === 'image' || attachment.kind === 'document' ? String(attachment.dataUrl || '') : '',
            text: attachment.kind === 'text' ? String(attachment.text || '') : ''
          }
        : null;

      const resp = await fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages:    outboundMessages,
          personality: state.autoDetectMode ? 'auto' : state.personality,
          imageProvider: state.imageProvider || 'auto',
          liveResearchMode: state.liveResearchMode || 'auto',
          userProfile: profile,
          memoryKey: getMemoryKey(),
          attachment: attachmentPayload,
          replyTo: replyTo || null
        })
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      showTyping(false);
      if (logo) logo.classList.remove('thinking');

      const reply = data.reply || '<p>Sorry — no response received.</p>';
      let renderedReply = reply;
      if (data.campaignRequest && data.campaignData && typeof data.campaignData === 'object') {
        renderedReply = `${reply}${buildCampaignPreviewCard(data.campaignData)}`;
      }
      renderMessage('assistant', renderedReply);
      applyNabadReactionToLastUserBubble(text, renderedReply);

      // ── Handle detectedInfo ──
if (data.detectedInfo && typeof data.detectedInfo === 'object') {
  const info = data.detectedInfo;
  let profileUpdated = false;
  const changedInfo = {};

  const fieldsToCapture = [
    'businessName', 'location', 'whatYouSell', 'revenue',
    'biggestChallenge', 'targetCustomer', 'ideaSummary',
    'currentProgress', 'biggestBlock', 'skills',
    'problems', 'preference', 'timeCommitment', 'industry'
  ];

  fieldsToCapture.forEach(field => {
    const incoming = cleanText(String(info[field] || ''), 240);
    if (!incoming) return;
    const current = cleanText(String(state.userProfile[field] || ''), 240);
    if (!current || current.toLowerCase() !== incoming.toLowerCase()) {
      state.userProfile[field] = incoming;
      changedInfo[field] = incoming;
      profileUpdated = true;
    }
  });

  if (profileUpdated) {
    saveUserProfile(state.userProfile);
    showProfileUpdateToast(changedInfo);
  }
}

      // ── Handle suggestWarRoom ──
      if (data.suggestWarRoom) {
        showWarRoomSuggestion(data.suggestWarRoom);
      }

      // ── Smarter personality switching (confidence + stickiness) ──
      if (state.autoDetectMode) {
        const detected = String(data.detectedPersonality || 'auto');
        const confidence = Math.max(
          0,
          Math.min(1, Number(data.detectedPersonalityConfidence ?? (detected === 'auto' ? 0.35 : 0.55)))
        );
        const userMsgCount = state.messages.filter((m) => m.role === 'user').length;

        if (detected === 'auto' || confidence < 0.45) {
          state.personalityScore = Math.max(0, state.personalityScore - 0.3);
        } else {
          if (detected === state.personalityBuffer) {
            state.personalityCount += 1;
            state.personalityScore += confidence;
          } else {
            state.personalityBuffer = detected;
            state.personalityCount = 1;
            state.personalityScore = confidence;
          }

          const threshold = state.personality === 'auto' ? 0.72 : 0.95;
          const canStrongSwitch = confidence >= 0.74 && userMsgCount >= 1;
          const canStickySwitch =
            userMsgCount >= 1 &&
            state.personalityCount >= 1 &&
            state.personalityScore >= threshold;

          if ((canStrongSwitch || canStickySwitch) && detected !== state.personality) {
            const prevPersonality = state.personality;
            state.personality = detected;
            state.personalityCount = 0;
            state.personalityBuffer = null;
            state.personalityScore = 0;
            setInputPlaceholder();
            updatePersonalityBadge();
            applyPersonalityColor(detected, prevPersonality !== detected);
          }
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
  state.typingLabels = null;
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
            memoryKey: getMemoryKey(),
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
    clearReplyTarget();
    document.getElementById('nabad-input-wrap').style.display = 'flex';
    refs.messages.innerHTML = '';
    updatePersonalityBadge();
    if (!state.messages.length) {
      renderMessage('assistant', getPersonalityGreeting(state.personality), false);
    } else {
      state.messages.slice(-50).forEach(m => renderMessage(m.role, m.content, false, m));
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
      clearReplyTarget();
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
        state.autoDetectMode    = newId === 'auto';
        state.personalityChosen = true;
        state.personalityBuffer = null;
        state.personalityCount  = 0;
        state.personalityScore  = 0;
        savePersonality(newId);
        saveAutoDetect(state.autoDetectMode);
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

  // ── SETTINGS PAGE ─────────────────────────────────────────────
function openNabadEditorFromMenu() {
  const editorPayload = {
    headline: '',
    subtext: '',
    ctaText: '',
    editorStartBlank: true,
    editorNeedsNewProject: true,
    imagePrompt: '',
    platform: 'social',
    format: '16:9',
    typography: {
      fontFamily: 'Inter',
      headlineSize: 58,
      subtextSize: 26,
      ctaSize: 22
    }
  };
  openCampaignCanvasEditorFromData(editorPayload);
}

function openSettingsPage() {
  // Remove old dropdown if it exists
  const oldPopup = document.getElementById('nabad-options-popup');
  if (oldPopup) oldPopup.remove();

  // Remove existing settings page if open
  const existing = document.getElementById('nabad-settings-page');
  if (existing) {
    existing.classList.remove('open');
    setTimeout(() => existing.remove(), 350);
    return;
  }

  const isAutoDetect = state.autoDetectMode;

  const page = document.createElement('div');
  page.id = 'nabad-settings-page';
  page.innerHTML = `
    <div id="nabad-settings-header">
      <button id="nabad-settings-back" type="button" aria-label="Back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div id="nabad-settings-title">Settings</div>
    </div>

    <div id="nabad-settings-body">

      <!-- AI MODE SECTION -->
      <div>
        <div class="nabad-settings-section-label">AI Mode</div>
        <div class="nabad-settings-card">

          <!-- Auto-detect toggle -->
          <div class="nabad-toggle-wrap">
            <div class="nabad-toggle-left">
              <div class="nabad-settings-row-icon">${SETTINGS_ICONS.auto}</div>
              <div>
                <div class="nabad-settings-row-label">Auto-detect mode</div>
                <div class="nabad-settings-row-desc">Nabad switches personality based on your conversation</div>
              </div>
            </div>
            <label class="nabad-toggle">
              <input type="checkbox" id="nabad-auto-toggle" ${isAutoDetect ? 'checked' : ''} />
              <span class="nabad-toggle-slider"></span>
            </label>
          </div>

          <!-- Personality grid (hidden when auto is ON) -->
          <div id="nabad-settings-personality-grid" class="${!isAutoDetect ? 'visible' : ''}">
            ${PERSONALITIES.filter(p => p.id !== 'auto').map(p => `
              <div class="nabad-settings-personality-chip ${state.personality === p.id ? 'active' : ''}"
                data-personality="${p.id}">
                <div class="chip-icon">${p.icon}</div>
                <div class="chip-text">
                  <div class="chip-name">${escapeHtml(p.title)}</div>
                  <div class="chip-desc">${escapeHtml(p.desc)}</div>
                </div>
                <div class="chip-check">✓</div>
              </div>
            `).join('')}
          </div>

          <div class="nabad-settings-row" style="margin-top:10px;">
            <div class="nabad-settings-row-left">
              <div class="nabad-settings-row-icon">${SETTINGS_ICONS.auto}</div>
              <div>
                <div class="nabad-settings-row-label">Image Engine</div>
                <div class="nabad-settings-row-desc">Choose how Nabad generates images</div>
              </div>
            </div>
            <select id="nabad-image-provider-select" style="border:1px solid rgba(37,99,235,0.16);border-radius:10px;padding:7px 10px;background:#fff;color:#0f172a;font-size:12px;font-weight:700;">
              <option value="auto" ${state.imageProvider === 'auto' ? 'selected' : ''}>Let Nabad choose</option>
              <option value="openai" ${state.imageProvider === 'openai' ? 'selected' : ''}>OpenAI</option>
              <option value="gemini" ${state.imageProvider === 'gemini' ? 'selected' : ''}>Gemini</option>
              <option value="ideogram" ${state.imageProvider === 'ideogram' ? 'selected' : ''}>Ideogram</option>
              <option value="replicate" ${state.imageProvider === 'replicate' ? 'selected' : ''}>Replicate</option>
              <option value="pollinations" ${state.imageProvider === 'pollinations' ? 'selected' : ''}>Pollinations</option>
              <option value="huggingface" ${state.imageProvider === 'huggingface' ? 'selected' : ''}>Hugging Face</option>
            </select>
          </div>

          <div class="nabad-toggle-wrap" style="margin-top:10px;">
            <div class="nabad-toggle-left">
              <div class="nabad-settings-row-icon">${SETTINGS_ICONS.auto}</div>
              <div>
                <div class="nabad-settings-row-label">Live Research</div>
                <div class="nabad-settings-row-desc">Auto = smarter web checks. Off = only when you ask explicitly.</div>
              </div>
            </div>
            <label class="nabad-toggle">
              <input type="checkbox" id="nabad-live-research-toggle" ${state.liveResearchMode !== 'on_demand' ? 'checked' : ''} />
              <span class="nabad-toggle-slider"></span>
            </label>
          </div>

        </div>
      </div>

      <!-- CHAT SECTION -->
      <div>
        <div class="nabad-settings-section-label">Chat</div>
        <div class="nabad-settings-card">
          <div class="nabad-toggle-wrap" style="padding:12px 14px;">
            <div class="nabad-toggle-left">
              <div class="nabad-settings-row-icon">${SETTINGS_ICONS.notifications}</div>
              <div>
                <div class="nabad-settings-row-label">Notifications</div>
                <div class="nabad-settings-row-desc" id="nabad-notifications-status">${escapeHtml(notificationStatusText())}</div>
              </div>
            </div>
            <label class="nabad-toggle">
              <input type="checkbox" id="nabad-notifications-toggle" ${state.notificationsEnabled ? 'checked' : ''} />
              <span class="nabad-toggle-slider"></span>
            </label>
          </div>
          <div class="nabad-settings-row" id="nabad-set-new-chat">
            <div class="nabad-settings-row-left">
              <div class="nabad-settings-row-icon">${SETTINGS_ICONS.newChat}</div>
              <div>
                <div class="nabad-settings-row-label">New Chat</div>
                <div class="nabad-settings-row-desc">Start fresh conversation</div>
              </div>
            </div>
            <span class="nabad-settings-row-arrow">›</span>
          </div>
          <div class="nabad-settings-row" id="nabad-set-memory">
            <div class="nabad-settings-row-left">
              <div class="nabad-settings-row-icon">${SETTINGS_ICONS.memory}</div>
              <div>
                <div class="nabad-settings-row-label">My Memory</div>
                <div class="nabad-settings-row-desc">View everything Nabad knows about you</div>
              </div>
            </div>
            <span class="nabad-settings-row-arrow">›</span>
          </div>
          <div class="nabad-settings-row" id="nabad-set-profile">
            <div class="nabad-settings-row-left">
              <div class="nabad-settings-row-icon">${SETTINGS_ICONS.profile}</div>
              <div>
                <div class="nabad-settings-row-label">Business Profile</div>
                <div class="nabad-settings-row-desc">Edit country, industry, stage, and main goal</div>
              </div>
            </div>
            <span class="nabad-settings-row-arrow">›</span>
          </div>
          <div class="nabad-settings-row" id="nabad-set-account">
            <div class="nabad-settings-row-left">
              <div class="nabad-settings-row-icon">${SETTINGS_ICONS.account}</div>
              <div>
                <div class="nabad-settings-row-label">Account</div>
                <div class="nabad-settings-row-desc">${
                  state.claimedAccount?.email
                    ? `Claimed as ${escapeHtml(state.claimedAccount.email)}`
                    : 'Claim your memory with email'
                }</div>
              </div>
            </div>
            <span class="nabad-settings-row-arrow">›</span>
          </div>
          <div class="nabad-settings-row" id="nabad-set-warroom">
            <div class="nabad-settings-row-left">
              <div class="nabad-settings-row-icon">${SETTINGS_ICONS.warRoom}</div>
              <div>
                <div class="nabad-settings-row-label">War Room</div>
                <div class="nabad-settings-row-desc">3 expert perspectives on one problem</div>
              </div>
            </div>
            <span class="nabad-settings-row-arrow">›</span>
          </div>
          <div class="nabad-settings-row" id="nabad-set-editor">
            <div class="nabad-settings-row-left">
              <div class="nabad-settings-row-icon">${SETTINGS_ICONS.editor}</div>
              <div>
                <div class="nabad-settings-row-label">Nabad Editor</div>
                <div class="nabad-settings-row-desc">Open visual editor directly</div>
              </div>
            </div>
            <span class="nabad-settings-row-arrow">›</span>
          </div>
        </div>
      </div>

      <!-- DANGER SECTION -->
      <div>
        <div class="nabad-settings-section-label">Danger Zone</div>
        <div class="nabad-settings-card">
          <div class="nabad-settings-row" id="nabad-set-reset">
            <div class="nabad-settings-row-left">
              <div class="nabad-settings-row-icon red">${SETTINGS_ICONS.reset}</div>
              <div>
                <div class="nabad-settings-row-label danger">Reset Everything</div>
                <div class="nabad-settings-row-desc">Clear all messages, memory, and profile</div>
              </div>
            </div>
            <span class="nabad-settings-row-arrow">›</span>
          </div>
        </div>
      </div>

    </div>
  `;

  refs.panel.appendChild(page);

  // Slide in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { page.classList.add('open'); });
  });

  // ── Close / back ──
  function closeSettings() {
    page.classList.remove('open');
    setTimeout(() => page.remove(), 350);
  }

  page.querySelector('#nabad-settings-back').addEventListener('click', closeSettings);

  // ── Auto-detect toggle ──
  const autoToggle = page.querySelector('#nabad-auto-toggle');
  const personalityGrid = page.querySelector('#nabad-settings-personality-grid');
  const imageProviderSelect = page.querySelector('#nabad-image-provider-select');
  const liveResearchToggle = page.querySelector('#nabad-live-research-toggle');
  const notificationsToggle = page.querySelector('#nabad-notifications-toggle');
  const notificationsStatus = page.querySelector('#nabad-notifications-status');

  if (notificationsStatus) {
    notificationsStatus.textContent = notificationStatusText();
  }
  if (notificationsToggle) {
    notificationsToggle.checked = Boolean(state.notificationsEnabled);
    if (!isPushSupported()) {
      notificationsToggle.disabled = true;
    }
    notificationsToggle.addEventListener('change', async () => {
      notificationsToggle.disabled = true;
      let enabled = false;
      if (notificationsToggle.checked) {
        enabled = await enableNotifications();
      } else {
        enabled = await disableNotifications();
      }
      notificationsToggle.checked = Boolean(enabled);
      notificationsToggle.disabled = !isPushSupported();
      if (notificationsStatus) notificationsStatus.textContent = notificationStatusText();
    });
  }

  if (imageProviderSelect) {
    imageProviderSelect.addEventListener('change', () => {
      const next = (imageProviderSelect.value || 'auto').toLowerCase();
      state.imageProvider = ['auto', 'openai', 'gemini', 'ideogram', 'pollinations', 'replicate', 'huggingface'].includes(next) ? next : 'auto';
      saveImageProvider(state.imageProvider);
    });
  }

  if (liveResearchToggle) {
    liveResearchToggle.checked = state.liveResearchMode !== 'on_demand';
    liveResearchToggle.addEventListener('change', () => {
      state.liveResearchMode = liveResearchToggle.checked ? 'auto' : 'on_demand';
      saveLiveResearchMode(state.liveResearchMode);
    });
  }

  autoToggle.addEventListener('change', () => {
    const isAuto = autoToggle.checked;
    if (isAuto) {
      personalityGrid.classList.remove('visible');
      state.autoDetectMode    = true;
      state.personality       = 'auto';
      state.personalityBuffer = null;
      state.personalityCount  = 0;
      state.personalityScore  = 0;
      savePersonality('auto');
      saveAutoDetect(true);
      setInputPlaceholder();
      applyPersonalityColor('auto', false);
    } else {
      state.autoDetectMode = false;
      saveAutoDetect(false);
      if (state.personality === 'auto') {
        state.personality = 'strategist';
      }
      personalityGrid.classList.add('visible');
    }
  });

  // ── Personality chip selection ──
  page.querySelectorAll('.nabad-settings-personality-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const newId = chip.getAttribute('data-personality');
      page.querySelectorAll('.nabad-settings-personality-chip')
        .forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const prev = state.personality;
      state.personality       = newId;
      state.autoDetectMode    = false;
      state.personalityChosen = true;
      state.personalityBuffer = null;
      state.personalityCount  = 0;
      state.personalityScore  = 0;
      savePersonality(newId);
      saveAutoDetect(false);
      setInputPlaceholder();
      updatePersonalityBadge();
      applyPersonalityColor(newId, prev !== newId);
    });
  });

  // ── Chat actions ──
  page.querySelector('#nabad-set-new-chat').addEventListener('click', () => {
    closeSettings(); setTimeout(() => newChat(), 360);
  });
  page.querySelector('#nabad-set-memory').addEventListener('click', () => {
    closeSettings(); setTimeout(() => showMemoryScreen(), 360);
  });
  page.querySelector('#nabad-set-profile').addEventListener('click', () => {
    closeSettings(); setTimeout(() => showProfileEditorScreen(), 360);
  });
  page.querySelector('#nabad-set-account').addEventListener('click', () => {
    closeSettings(); setTimeout(() => showAccountClaimScreen(), 360);
  });
  page.querySelector('#nabad-set-warroom').addEventListener('click', () => {
    closeSettings(); setTimeout(() => openWarRoom(''), 360);
  });
  page.querySelector('#nabad-set-editor').addEventListener('click', () => {
    closeSettings(); setTimeout(() => openNabadEditorFromMenu(), 360);
  });

  // ── Reset ──
  page.querySelector('#nabad-set-reset').addEventListener('click', () => {
    closeSettings();
    setTimeout(() => {
      confirmAction('Reset everything? This will clear all messages, memory, and your profile.', () => {
        disableNotifications();
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        localStorage.removeItem('nabad_insights');
        state.messages          = [];
        state.personality       = 'auto';
        state.autoDetectMode    = true;
        state.imageProvider     = 'auto';
        state.personalityChosen = false;
        state.onboarded         = false;
        state.userProfile       = {};
        state.claimedAccount    = null;
        state.briefShown        = false;
        state.personalityBuffer = null;
        state.personalityCount  = 0;
        state.personalityScore  = 0;
        state.notificationsEnabled = false;
        state.pushSubscription = null;
        refs.messages.innerHTML = '';
        document.getElementById('nabad-input-wrap').style.display = 'flex';
        updatePersonalityBadge();
        applyPersonalityColor('auto', false);
        setInputPlaceholder();
        renderOnboardingIntro();
      });
    }, 360);
  });
}

  // ── PROFILE SCREEN ────────────────────────────────────────────
  function showProfileEditorScreen() {
    document.getElementById('nabad-input-wrap').style.display = 'none';
    const profile = state.userProfile || {};

    refs.messages.innerHTML = `
      <div id="nabad-onboarding">
        <h3>Business Profile</h3>
        <p>Keep this updated so Nabad gives sharper plans, legal guidance, and market context.</p>

        <div class="nabad-questions-form">
          <div class="nabad-question-field">
            <label class="nabad-question-label">Business / Project Name</label>
            <input class="nabad-question-input" id="nabad-profile-business" placeholder="e.g. NabadAi Studio" value="${escapeHtml(profile.businessName || '')}" />
          </div>
          <div class="nabad-question-field">
            <label class="nabad-question-label">Country</label>
            <input class="nabad-question-input" id="nabad-profile-country" placeholder="e.g. UAE, Saudi Arabia, USA" value="${escapeHtml(profile.country || '')}" />
          </div>
          <div class="nabad-question-field">
            <label class="nabad-question-label">Industry</label>
            <input class="nabad-question-input" id="nabad-profile-industry" placeholder="e.g. Marketing agency, SaaS, eCommerce" value="${escapeHtml(profile.industry || '')}" />
          </div>
          <div class="nabad-question-field">
            <label class="nabad-question-label">Stage</label>
            <input class="nabad-question-input" id="nabad-profile-stage" placeholder="e.g. Idea, early revenue, scaling" value="${escapeHtml(profile.stage || '')}" />
          </div>
          <div class="nabad-question-field">
            <label class="nabad-question-label">Main Goal (next 90 days)</label>
            <input class="nabad-question-input" id="nabad-profile-goal" placeholder="e.g. Reach $10k MRR / Launch MVP / Expand to KSA" value="${escapeHtml(profile.mainGoal || '')}" />
          </div>
        </div>

        <button class="nabad-ob-btn" id="nabad-profile-save" type="button">Save Profile</button>
        <button class="nabad-ob-back" id="nabad-profile-back" type="button">← Back to chat</button>
      </div>
    `;

    refs.messages.querySelector('#nabad-profile-back')
      .addEventListener('click', backToChat);

    refs.messages.querySelector('#nabad-profile-save')
      .addEventListener('click', () => {
        const nextProfile = {
          ...state.userProfile,
          businessName: (refs.messages.querySelector('#nabad-profile-business')?.value || '').trim(),
          country:      (refs.messages.querySelector('#nabad-profile-country')?.value || '').trim(),
          industry:     (refs.messages.querySelector('#nabad-profile-industry')?.value || '').trim(),
          stage:        (refs.messages.querySelector('#nabad-profile-stage')?.value || '').trim(),
          mainGoal:     (refs.messages.querySelector('#nabad-profile-goal')?.value || '').trim()
        };

        Object.keys(nextProfile).forEach((k) => {
          if (typeof nextProfile[k] === 'string' && !nextProfile[k].trim()) delete nextProfile[k];
        });

        state.userProfile = nextProfile;
        saveUserProfile(state.userProfile);
        renderMessage('assistant', '<p>✅ Profile updated. I will use this context in every answer.</p>');
        backToChat();
      });

    scrollToBottom();
  }

  // ── ACCOUNT CLAIM SCREEN ─────────────────────────────────────
  function showAccountClaimScreen() {
    document.getElementById('nabad-input-wrap').style.display = 'none';
    const account = state.claimedAccount || {};
    const claimedText = account.email
      ? `<p style="margin-top:0;color:#0f766e;font-size:13px;background:#ecfeff;border:1px solid rgba(6,182,212,0.25);padding:10px 12px;border-radius:12px;">Currently claimed as <strong>${escapeHtml(account.email)}</strong>.</p>`
      : '';

    refs.messages.innerHTML = `
      <div id="nabad-onboarding">
        <h3>Account & Restore</h3>
        <p>Link this memory to your email so you can keep your business context safely tied to you.</p>
        ${claimedText}

        <div class="nabad-questions-form">
          <div class="nabad-question-field">
            <label class="nabad-question-label">Your Name (optional)</label>
            <input class="nabad-question-input" id="nabad-claim-name" placeholder="e.g. Samy" value="${escapeHtml(account.name || '')}" />
          </div>
          <div class="nabad-question-field">
            <label class="nabad-question-label">Email</label>
            <input class="nabad-question-input" id="nabad-claim-email" placeholder="you@company.com" value="${escapeHtml(account.email || '')}" />
          </div>
          <div class="nabad-question-field">
            <label class="nabad-question-label">Recovery Code (for new devices)</label>
            <input class="nabad-question-input" id="nabad-restore-code" placeholder="e.g. 9A4F2C7D" value="" />
          </div>
        </div>

        <button class="nabad-ob-btn" id="nabad-claim-save" type="button">${account.email ? 'Update Email Claim' : 'Claim This Device'}</button>
        <button class="nabad-ob-back" id="nabad-restore-device" type="button">Restore Existing Memory</button>
        <button class="nabad-ob-back" id="nabad-claim-back" type="button">← Back to chat</button>
      </div>
    `;

    refs.messages.querySelector('#nabad-claim-back')
      .addEventListener('click', backToChat);

    refs.messages.querySelector('#nabad-claim-save')
      .addEventListener('click', async () => {
        const name = (refs.messages.querySelector('#nabad-claim-name')?.value || '').trim();
        const email = (refs.messages.querySelector('#nabad-claim-email')?.value || '').trim().toLowerCase();
        if (!email) {
          alert('Please enter your email.');
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          alert('Please enter a valid email.');
          return;
        }

        const btn = refs.messages.querySelector('#nabad-claim-save');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
          const resp = await fetch(CONFIG.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              claimName: name,
              claimEmail: email,
              memoryKey: getMemoryKey(),
              userProfile: buildProfileSummary()
            })
          });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);

          state.claimedAccount = {
            email,
            name,
            claimedAt: new Date().toISOString()
          };
          saveAccountClaim(state.claimedAccount);
          const recoveryCode = String(data?.recoveryCode || '');

          if (recoveryCode) {
            alert(`Your recovery code is: ${recoveryCode}\n\nSave this code. You will need email + this code to restore Nabad on another device.`);
          }
          renderMessage('assistant', `<p>✅ Account claimed as <strong>${escapeHtml(email)}</strong>. Your memory is now linked.</p>`);
          backToChat();
        } catch (err) {
          alert(err?.message || 'Could not save claim right now. Please try again.');
          btn.disabled = false;
          btn.textContent = account.email ? 'Update Claim' : 'Claim Account';
        }
      });

    refs.messages.querySelector('#nabad-restore-device')
      .addEventListener('click', async () => {
        const email = (refs.messages.querySelector('#nabad-claim-email')?.value || '').trim().toLowerCase();
        const code = (refs.messages.querySelector('#nabad-restore-code')?.value || '').trim().toUpperCase();
        if (!email) {
          alert('Enter your claimed email first.');
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          alert('Please enter a valid email.');
          return;
        }
        if (!code) {
          alert('Enter your recovery code.');
          return;
        }

        const btn = refs.messages.querySelector('#nabad-restore-device');
        btn.disabled = true;
        btn.textContent = 'Restoring...';

        try {
          const resp = await fetch(CONFIG.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restoreEmail: email,
              restoreCode: code
            })
          });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);

          if (data?.memoryKey) {
            localStorage.setItem(STORAGE_KEYS.memoryKey, data.memoryKey);
          }
          state.claimedAccount = {
            email,
            name: cleanText(data?.account?.name || account.name || '', 100),
            claimedAt: new Date().toISOString()
          };
          saveAccountClaim(state.claimedAccount);

          if (data?.memory?.country) state.userProfile.country = data.memory.country;
          if (data?.memory?.industry) state.userProfile.industry = data.memory.industry;
          if (data?.memory?.stage) state.userProfile.stage = data.memory.stage;
          if (data?.memory?.bottleneck) state.userProfile.bottleneck = data.memory.bottleneck;
          const restoredFacts = data?.memory?.facts && typeof data.memory.facts === 'object' ? data.memory.facts : {};
          ['businessName', 'location', 'whatYouSell', 'revenue', 'biggestChallenge', 'targetCustomer', 'ideaSummary', 'currentProgress', 'skills', 'preference', 'timeCommitment']
            .forEach((k) => {
              if (restoredFacts[k]) state.userProfile[k] = cleanText(String(restoredFacts[k] || ''), 240);
            });
          saveUserProfile(state.userProfile);

          renderMessage('assistant', '<p>✅ Memory restored on this device. Nabad remembers your context now.</p>');
          backToChat();
        } catch (err) {
          alert(err?.message || 'Could not restore memory. Check email/code and try again.');
          btn.disabled = false;
          btn.textContent = 'Restore Existing Memory';
        }
      });

    scrollToBottom();
  }

  // ── MEMORY SCREEN ─────────────────────────────────────────────
  function formatMemoryFieldLabel(field = '') {
    const map = {
      country: 'Country',
      location: 'Location',
      industry: 'Industry',
      stage: 'Stage',
      bottleneck: 'Main Bottleneck',
      businessName: 'Business Name',
      whatYouSell: 'What You Sell',
      revenue: 'Revenue',
      biggestChallenge: 'Biggest Challenge',
      targetCustomer: 'Target Customer',
      ideaSummary: 'Idea Summary',
      currentProgress: 'Current Progress',
      skills: 'Skills',
      preference: 'Preference',
      timeCommitment: 'Availability'
    };
    return map[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
  }

  function formatMemoryDate(input = '') {
    const dt = new Date(input || '');
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  async function callMemoryApi(action = '', payload = {}) {
    const resp = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memoryAction: action,
        memoryKey: getMemoryKey(),
        userProfile: buildProfileSummary(),
        ...payload
      })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
    return data;
  }

  function buildCoreMemoryItems(memory = {}, profile = {}) {
    const out = [];
    const push = (field, value, source = 'memory') => {
      const clean = cleanText(String(value || ''), 240);
      if (!clean) return;
      out.push({ field, value: clean, source, label: formatMemoryFieldLabel(field) });
    };

    push('country', memory.country || profile.country, memory.country ? 'memory' : 'profile');
    push('industry', memory.industry || profile.industry, memory.industry ? 'memory' : 'profile');
    push('stage', memory.stage || profile.stage, memory.stage ? 'memory' : 'profile');
    push('bottleneck', memory.bottleneck || profile.bottleneck, memory.bottleneck ? 'memory' : 'profile');

    const facts = memory.facts && typeof memory.facts === 'object' ? memory.facts : {};
    const orderedFields = [
      'businessName', 'location', 'whatYouSell', 'revenue', 'biggestChallenge',
      'targetCustomer', 'ideaSummary', 'currentProgress', 'skills', 'preference', 'timeCommitment'
    ];
    orderedFields.forEach((field) => {
      push(field, facts[field] || profile[field], facts[field] ? 'facts' : 'profile');
    });

    const seen = new Set();
    return out.filter((item) => {
      if (seen.has(item.field)) return false;
      seen.add(item.field);
      return true;
    });
  }

  function mapCoreFieldToProfileKey(field = '') {
    const allowed = new Set([
      'country', 'industry', 'stage', 'bottleneck', 'businessName', 'location', 'whatYouSell',
      'revenue', 'biggestChallenge', 'targetCustomer', 'ideaSummary', 'currentProgress',
      'skills', 'preference', 'timeCommitment'
    ]);
    return allowed.has(field) ? field : '';
  }

  function buildRecentMemoryItems(memory = {}) {
    const out = [];
    const learning = memory.learning && typeof memory.learning === 'object' ? memory.learning : {};
    const addList = (items = [], type = '') => {
      (Array.isArray(items) ? items : []).slice(-10).forEach((item) => {
        const text = cleanText(String(item || ''), 220);
        if (!text) return;
        out.push({ type, text });
      });
    };
    addList(learning.goals, 'Goal');
    addList(learning.constraints, 'Constraint');
    addList(learning.preferences, 'Preference');
    addList(learning.knownFields, 'Signal');
    return out.slice(-24).reverse();
  }

  async function showMemoryScreen(startTab = 'core') {
    document.getElementById('nabad-input-wrap').style.display = 'none';
    const account = state.claimedAccount || null;
    let localInsights = JSON.parse(localStorage.getItem('nabad_insights') || '[]');
    let memory = {};

    const mergeProfileFromMemory = (m = {}) => {
      const facts = m.facts && typeof m.facts === 'object' ? m.facts : {};
      const nextProfile = { ...state.userProfile };
      if (m.country) nextProfile.country = m.country;
      if (m.industry) nextProfile.industry = m.industry;
      if (m.stage) nextProfile.stage = m.stage;
      if (m.bottleneck) nextProfile.bottleneck = m.bottleneck;
      ['businessName', 'location', 'whatYouSell', 'revenue', 'biggestChallenge', 'targetCustomer', 'ideaSummary', 'currentProgress', 'skills', 'preference', 'timeCommitment']
        .forEach((k) => {
          if (facts[k]) nextProfile[k] = facts[k];
        });
      state.userProfile = nextProfile;
      saveUserProfile(nextProfile);
    };

    try {
      const data = await callMemoryApi('get');
      memory = data?.memory && typeof data.memory === 'object' ? data.memory : {};
      mergeProfileFromMemory(memory);
    } catch {}

    const renderTab = (tab = 'core') => {
      const coreItems = buildCoreMemoryItems(memory, state.userProfile || {});
      const recentItems = buildRecentMemoryItems(memory);
      const vaultItems = Array.isArray(memory.savedInsights) ? memory.savedInsights.slice().reverse() : [];

      const coreHtml = coreItems.length
        ? coreItems.map((item) => `
            <div style="padding:10px 12px;margin-bottom:8px;background:#f8faff;border:1px solid rgba(37,99,235,0.10);border-radius:12px;">
              <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
                <div>
                  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#2563eb;">${escapeHtml(item.label)}</div>
                    <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:${item.source === 'profile' ? 'rgba(16,185,129,.12)' : 'rgba(37,99,235,.10)'};color:${item.source === 'profile' ? '#047857' : '#1d4ed8'}">${item.source === 'profile' ? 'Profile' : 'Memory'}</span>
                  </div>
                  <div style="font-size:13px;color:#1e293b;margin-top:3px;line-height:1.45;">${escapeHtml(item.value)}</div>
                </div>
                <div style="display:flex;gap:6px;">
                  <button type="button" data-core-edit="${escapeHtml(item.field)}" style="border:1px solid rgba(37,99,235,.20);background:#fff;color:#1e3a8a;border-radius:8px;padding:5px 8px;font-size:11px;font-weight:700;cursor:pointer;">Edit</button>
                  <button type="button" data-core-del="${escapeHtml(item.field)}" style="border:1px solid rgba(239,68,68,.25);background:#fff;color:#b91c1c;border-radius:8px;padding:5px 8px;font-size:11px;font-weight:700;cursor:pointer;">Delete</button>
                </div>
              </div>
            </div>
          `).join('')
        : `<p style="color:#94a3b8;font-size:13px;text-align:center;padding:10px 0;">No core memory yet. Keep chatting and ask Nabad to remember key facts.</p>`;

      const recentHtml = recentItems.length
        ? recentItems.map((item) => `
            <div style="padding:9px 12px;margin-bottom:7px;background:#fff;border:1px solid rgba(148,163,184,.18);border-radius:10px;">
              <div style="font-size:11px;color:#64748b;font-weight:700;letter-spacing:.03em;text-transform:uppercase;">${escapeHtml(item.type)}</div>
              <div style="font-size:13px;color:#334155;line-height:1.4;margin-top:3px;">${escapeHtml(item.text)}</div>
            </div>
          `).join('')
        : `<p style="color:#94a3b8;font-size:13px;text-align:center;padding:10px 0;">No recent signals yet.</p>`;

      const vaultHtml = vaultItems.length
        ? vaultItems.map((item, idx) => `
            <div style="padding:10px 12px;margin-bottom:8px;background:#f0fdf4;border:1px solid rgba(34,197,94,.18);border-radius:12px;">
              <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
                <div style="font-size:13px;color:#14532d;line-height:1.45;">${escapeHtml(cleanText(item?.text || '', 420))}</div>
                <button type="button" data-vault-del-id="${escapeHtml(cleanText(item?.id || '', 40))}" data-vault-del-index="${idx}" style="border:1px solid rgba(239,68,68,.22);background:#fff;color:#b91c1c;border-radius:8px;padding:5px 8px;font-size:11px;font-weight:700;cursor:pointer;">Delete</button>
              </div>
              <div style="font-size:11px;color:#16a34a;margin-top:6px;">${escapeHtml(formatMemoryDate(item?.savedAt || ''))}</div>
            </div>
          `).join('')
        : (
          localInsights.length
            ? `<p style="color:#64748b;font-size:13px;text-align:center;padding:10px 0;">No cloud vault notes yet. You still have ${localInsights.length} local note(s) on this browser.</p>`
            : `<p style="color:#94a3b8;font-size:13px;text-align:center;padding:10px 0;">No vault notes yet.<br>Use the save button or say “save this to memory”.</p>`
        );

      refs.messages.innerHTML = `
        <div id="nabad-onboarding">
          <h3>Your Memory</h3>
          <p>Organized into Core, Recent, and Vault for clean long-term memory.</p>

          ${account?.email ? `
            <div style="margin-bottom:12px;padding:9px 12px;background:#ecfeff;border-radius:10px;border:1px solid rgba(6,182,212,.22);font-size:12px;color:#0f766e;">
              Linked email: <strong>${escapeHtml(account.email)}</strong>${account.name ? ` (${escapeHtml(account.name)})` : ''}
            </div>
          ` : ''}

          <div style="display:flex;gap:8px;margin:0 0 12px;flex-wrap:wrap;">
            <button type="button" data-memory-tab="core" class="nabad-memory-tab ${tab === 'core' ? 'active' : ''}">Core</button>
            <button type="button" data-memory-tab="recent" class="nabad-memory-tab ${tab === 'recent' ? 'active' : ''}">Recent</button>
            <button type="button" data-memory-tab="vault" class="nabad-memory-tab ${tab === 'vault' ? 'active' : ''}">Vault</button>
          </div>

          <style>
            .nabad-memory-tab{border:1px solid rgba(37,99,235,.2);background:#fff;color:#1e3a8a;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer}
            .nabad-memory-tab.active{background:linear-gradient(135deg,#2563eb,#06b6d4);border-color:transparent;color:#fff}
          </style>

          ${tab === 'core' ? coreHtml : ''}
          ${tab === 'recent' ? recentHtml : ''}
          ${tab === 'vault' ? `
            <div style="display:flex;gap:8px;margin-bottom:10px;">
              <button class="nabad-ob-btn" id="nabad-vault-add" type="button" style="margin:0;flex:1;">Add Vault Note</button>
              ${localInsights.length ? `<button class="nabad-ob-back" id="nabad-vault-sync-local" type="button" style="margin:0;flex:1;">Sync Local Notes</button>` : ''}
            </div>
            ${vaultHtml}
          ` : ''}

          <button class="nabad-ob-back" id="nabad-memory-back" type="button" style="margin-top:16px">← Back to chat</button>
        </div>
      `;

      refs.messages.querySelectorAll('[data-memory-tab]').forEach((btn) => {
        btn.addEventListener('click', () => renderTab(btn.getAttribute('data-memory-tab') || 'core'));
      });

      refs.messages.querySelectorAll('[data-core-edit]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const field = cleanText(btn.getAttribute('data-core-edit') || '', 80);
          const profileKey = mapCoreFieldToProfileKey(field);
          const current = coreItems.find((item) => item.field === field)?.value || '';
          const value = window.prompt(`Update ${formatMemoryFieldLabel(field)}`, current);
          const nextVal = cleanText(value || '', 240);
          if (!nextVal || nextVal === current) return;
          try {
            const data = await callMemoryApi('update_field', { memoryField: field, memoryValue: nextVal });
            memory = data?.memory && typeof data.memory === 'object' ? data.memory : memory;
            if (profileKey) {
              state.userProfile = { ...state.userProfile, [profileKey]: nextVal };
              saveUserProfile(state.userProfile);
            }
            mergeProfileFromMemory(memory);
            renderTab('core');
          } catch (err) {
            alert(err?.message || 'Could not update memory right now.');
          }
        });
      });

      refs.messages.querySelectorAll('[data-core-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const field = cleanText(btn.getAttribute('data-core-del') || '', 80);
          const profileKey = mapCoreFieldToProfileKey(field);
          confirmAction(`Delete "${formatMemoryFieldLabel(field)}" from memory?`, async () => {
            try {
              const data = await callMemoryApi('delete_field', { memoryField: field });
              memory = data?.memory && typeof data.memory === 'object' ? data.memory : memory;
              if (profileKey && state.userProfile && Object.prototype.hasOwnProperty.call(state.userProfile, profileKey)) {
                const nextProfile = { ...state.userProfile };
                delete nextProfile[profileKey];
                state.userProfile = nextProfile;
                saveUserProfile(nextProfile);
              }
              mergeProfileFromMemory(memory);
              renderTab('core');
            } catch (err) {
              alert(err?.message || 'Could not delete memory field.');
            }
          });
        });
      });

      refs.messages.querySelectorAll('[data-vault-del-id],[data-vault-del-index]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const insightId = cleanText(btn.getAttribute('data-vault-del-id') || '', 40);
          const idx = Number(btn.getAttribute('data-vault-del-index') || '-1');
          confirmAction('Delete this vault note?', async () => {
            try {
              if (insightId) {
                const data = await callMemoryApi('delete_insight', { memoryInsightId: insightId });
                memory = data?.memory && typeof data.memory === 'object' ? data.memory : memory;
              } else if (idx >= 0) {
                localInsights = localInsights.filter((_, i) => i !== (localInsights.length - 1 - idx));
                localStorage.setItem('nabad_insights', JSON.stringify(localInsights.slice(-40)));
              }
              renderTab('vault');
            } catch (err) {
              alert(err?.message || 'Could not delete this note.');
            }
          });
        });
      });

      refs.messages.querySelector('#nabad-vault-add')?.addEventListener('click', async () => {
        const note = window.prompt('Add a memory note');
        const clean = cleanText(note || '', 420);
        if (!clean) return;
        try {
          const data = await callMemoryApi('add_insight', { memoryInsightText: clean });
          memory = data?.memory && typeof data.memory === 'object' ? data.memory : memory;
          renderTab('vault');
        } catch (err) {
          alert(err?.message || 'Could not save vault note.');
        }
      });

      refs.messages.querySelector('#nabad-vault-sync-local')?.addEventListener('click', async () => {
        if (!localInsights.length) return;
        try {
          for (const item of localInsights.slice(-20)) {
            const txt = cleanText(String(item?.text || ''), 420);
            if (!txt) continue;
            await callMemoryApi('add_insight', { memoryInsightText: txt });
          }
          localInsights = [];
          localStorage.setItem('nabad_insights', JSON.stringify([]));
          const data = await callMemoryApi('get');
          memory = data?.memory && typeof data.memory === 'object' ? data.memory : memory;
          renderTab('vault');
        } catch (err) {
          alert(err?.message || 'Could not sync local notes.');
        }
      });

      refs.messages.querySelector('#nabad-memory-back')
        ?.addEventListener('click', backToChat);

      scrollToBottom();
    };

    renderTab(startTab);
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
  const SPEAKER_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  let currentAudio  = null;
  let currentUtterance = null;
  let mediaRecorder = null;
  let audioChunks   = [];
  let voiceTimer    = null;
  let voiceSeconds  = 0;
  let typingLabelTimer = null;

  const TYPING_LABELS = [
    'Nabad is thinking...',
    'Connecting ideas...',
    'Sharpening your next move...'
  ];

  function resetSpeakerButton(btn) {
    if (!btn) return;
    btn.innerHTML = SPEAKER_ICON_SVG;
    btn.classList.remove('playing');
  }

  function stopCurrentSpeech() {
    if (currentAudio && !currentAudio.paused) {
      currentAudio.pause();
    }
    currentAudio = null;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    currentUtterance = null;
  }

  function speakReplyWithBrowserTTS(text, btn) {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      return false;
    }

    stopCurrentSpeech();
    const utter = new SpeechSynthesisUtterance(String(text || '').slice(0, 1800));
    const preferred = detectPreferredVoiceLanguage() === 'ar' ? 'ar' : 'en';
    utter.lang = preferred === 'ar' ? 'ar-SA' : 'en-US';
    utter.rate = 1;
    utter.pitch = 1;

    const voices = window.speechSynthesis.getVoices?.() || [];
    const match = voices.find((v) => String(v.lang || '').toLowerCase().startsWith(preferred));
    if (match) utter.voice = match;

    btn.innerHTML = `
      <div class="nabad-wave-anim">
        <span></span><span></span><span></span><span></span><span></span>
      </div> Stop`;
    btn.classList.add('playing');

    utter.onend = () => {
      currentUtterance = null;
      resetSpeakerButton(btn);
    };
    utter.onerror = () => {
      currentUtterance = null;
      resetSpeakerButton(btn);
    };

    currentUtterance = utter;
    window.speechSynthesis.speak(utter);
    return true;
  }

  async function speakReply(text, btn) {
  if (!text) return;
  const clean = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 3000);
  if (!clean) return;

  // Show loading state
  btn.innerHTML = `<span class="nabad-loading-dots"><span></span><span></span><span></span></span>`;
  btn.classList.add('playing');

  try {
    const resp = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: clean,
        language: detectPreferredVoiceLanguage()
      })
    });

    if (!resp.ok) throw new Error(`TTS failed (${resp.status})`);

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

    const playPromise = currentAudio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      await playPromise;
    }

    currentAudio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      resetSpeakerButton(btn);
    };

    currentAudio.onerror = () => {
      currentAudio = null;
      resetSpeakerButton(btn);
    };

  } catch (err) {
    console.error('[NABAD] TTS error:', err);
    const playBlocked = String(err?.message || '').toLowerCase().includes('play');
    if (playBlocked) {
      renderMessage('assistant', '<p>🔊 Tap the speaker again to allow audio playback in this browser tab.</p>');
    }
    const fallbackOk = speakReplyWithBrowserTTS(clean, btn);
    if (!fallbackOk) {
      resetSpeakerButton(btn);
      renderMessage('assistant', '<p>🔊 Voice playback is unavailable in this browser right now.</p>');
    }
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
    formData.append('language', detectPreferredVoiceLanguage());

    const resp = await fetch('/api/transcribe', { method: 'POST', body: formData });
    if (!resp.ok) {
      let serverError = '';
      try {
        const errData = await resp.json();
        serverError = errData?.error || errData?.detail || '';
      } catch {}
      throw new Error(serverError || `Transcription failed (${resp.status})`);
    }
    const data = await resp.json();
    const transcript = (data.text || '').trim();

    // ── Remove transcribing bubble ──
    tempMsg.remove();

    if (transcript && refs.input) {
      refs.input.value = transcript;
      autoGrowTextarea();
      refs.input.focus();
      // sendMessage() will handle restoring send button in its finally block
      setTimeout(() => sendMessage(), 160);
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
    if (INLINE_MODE) return;
    if (refs.launcher) {
      refs.launcher.addEventListener('click', () => toggleWidget(true));
    }
  }

  // ── INIT ─────────────────────────────────────────────────────
  loadDOMPurify(() => {
    injectStyles();
    buildShell();
    syncNotificationState();
    bindLauncherClick();
    if (INLINE_MODE) toggleWidget(true);

    // Public API used by landing and embeds.
    window.__NABAD_OPEN_WIDGET__ = () => toggleWidget(true);
    window.__NABAD_SET_PERSONALITY__ = (id) => setActivePersonality(String(id || 'auto'));
    window.__NABAD_SET_IMAGE_PROVIDER__ = (provider) => {
      const next = String(provider || 'auto').toLowerCase();
      const normalized = next === 'nanobanana' ? 'gemini' : next;
      state.imageProvider = ['auto', 'openai', 'gemini', 'ideogram', 'pollinations', 'replicate', 'huggingface'].includes(normalized) ? normalized : 'auto';
      saveImageProvider(state.imageProvider);
    };
    window.__NABAD_NEW_CHAT__ = () => newChat();
    window.__NABAD_OPEN_SETTINGS__ = () => openSettingsPage();
    window.__NABAD_OPEN_MEMORY__ = () => showMemoryScreen();
    window.__NABAD_OPEN_PROFILE__ = () => showProfileEditorScreen();
    window.__NABAD_OPEN_ACCOUNT__ = () => showAccountClaimScreen();
    window.__NABAD_BACK_TO_CHAT__ = () => backToChat();
    window.__NABAD_OPEN_WITH_PERSONALITY__ = (id) => {
      setActivePersonality(String(id || 'auto'), { announce: true });
      toggleWidget(true);
    };

    if (window.__NABAD_PENDING_PERSONALITY__) {
      setActivePersonality(String(window.__NABAD_PENDING_PERSONALITY__), { announce: true });
    }
  });

})();
