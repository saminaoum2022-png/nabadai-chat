import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ALLOWED_ORIGINS = [
  'https://nabadai.com',
  'https://www.nabadai.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
];

const ALLOWED_VERCEL_PREFIXES = ['nabadai'];

function isAllowedOrigin(origin = '') {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return ALLOWED_VERCEL_PREFIXES.some(p => host.startsWith(p) && host.endsWith('.vercel.app'));
  } catch { return false; }
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT = { windowMs: 60_000, maxRequests: 20 };
function isRateLimited(ip = '') {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_LIMIT.windowMs) { rateLimitMap.set(ip, { count: 1, start: now }); return false; }
  if (entry.count >= RATE_LIMIT.maxRequests) return true;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return false;
}

const SHOW_IMAGE_DEBUG = false;

// ── Text Utilities ────────────────────────────────────────────────────────────
function getMessageText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textPart = content.find(p => p.type === 'text');
    return textPart ? textPart.text : '';
  }
  return '';
}
function cleanText(val = '', maxLen = 300) {
  if (typeof val !== 'string') return '';
  return val.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function sanitizePromptText(text = '') {
  return text.replace(/[<>{}|\\^`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 900);
}
function escapeHtml(str = '') {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function decodeMaybe(text = '') {
  try { return decodeURIComponent(text); } catch { return text; }
}
function tryParseJsonBlock(text = '') {
  try {
    const match = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const raw = match[1] !== undefined ? match[1] : match[0];
    return JSON.parse(raw.trim());
  } catch (e) { console.error('[JSON PARSE ERROR]', e?.message); return null; }
}
function normalizeList(val) {
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  if (typeof val === 'string') return val.split(/\n|,/).map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  return [];
}
function isValidHttpUrl(str = '') {
  try { const u = new URL(str); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}
function extractFirstUrl(text = '') {
  const m = text.match(/https?:\/\/[^\s"'>)]+/);
  return m ? m[0] : '';
}

// ── Fetch Helpers ─────────────────────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeout = 20000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  try { return await fetch(url, { ...options, signal: ctrl.signal }); }
  finally { clearTimeout(id); }
}
async function readJsonSafe(response, timeoutMs = 8000) {
  const text = await Promise.race([
    response.text(),
    new Promise((_, rej) => setTimeout(() => rej(new Error('JSON read timeout')), timeoutMs))
  ]);
  try { return JSON.parse(text); } catch { return null; }
}

// ── Website Audit ─────────────────────────────────────────────────────────────
async function fetchWebsiteAuditContent(url = '') {
  if (!isValidHttpUrl(url)) return '';
  try {
    const res = await fetchWithTimeout(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: { Accept: 'text/plain', 'User-Agent': 'NabadBot/1.0' }
    }, 12000);
    if (!res.ok) return '';
    const text = await res.text();
    return text.slice(0, 3000);
  } catch { return ''; }
}

// ── Ideogram 2.0 Integration ──────────────────────────────────────────────────
async function generateWithIdeogram(prompt = '') {
  const apiKey = process.env.IDEOGRAM_API_KEY;
  if (!apiKey) throw new Error('IDEOGRAM_API_KEY not set');
  const cleanPrompt = sanitizePromptText(prompt).slice(0, 900);
  const response = await fetchWithTimeout('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      image_request: {
        prompt: cleanPrompt,
        model: 'V_2',
        magic_prompt_option: 'AUTO',
        style_type: 'DESIGN',
        aspect_ratio: 'ASPECT_1_1'
      }
    })
  }, 30000);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ideogram API error: ${response.status} — ${errText.slice(0, 100)}`);
  }
  const data = await readJsonSafe(response);
  const imageUrl = data?.data?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL returned from Ideogram');
  return imageUrl;
}

// FIX: expanded to catch font, text style, and "didn't like" complaints
function isImageQualityComplaint(text = '') {
  return /\b(fix\s*(the\s*)?text|text\s*(is\s*)?(wrong|broken|off|bad|blurry)|wrong\s*text|fix\s*(the\s*)?spelling|spelling\s*(is\s*)?wrong)\b/i.test(text)
    || /\b(bad\s*(quality|image|photo|result)|not\s*good|looks\s*(bad|terrible|wrong|off)|better\s*quality|higher\s*quality|sharper|cleaner)\b/i.test(text)
    || /\b(upgrade\s*(the\s*)?image|use\s*(ideogram|premium|better\s*(model|ai|generator))|switch\s*to\s*(ideogram|premium))\b/i.test(text)
    || /\b(change\s*(the\s*)?(font|typography|text\s*style)|different\s*font|new\s*font)\b/i.test(text)
    || /\b(didn['']?t|didnt|dont|don['']?t)\s*like\s*(the\s*)?(text|font|logo|image|result|design)\b/i.test(text);
}

function isPremiumImageConfirmation(text = '') {
  return /\b(use\s*(ideogram|premium|better)|yes\s*(ideogram|premium|upgrade|better)|switch\s*to\s*(ideogram|premium)|upgrade\s*image|yes\s*upgrade|go\s*premium|use\s*premium)\b/i.test(text)
    || /^(yes|yeah|sure|ok|okay|do it|go ahead|upgrade)[\s!.]*$/i.test(text);
}

function buildPremiumUpgradeOffer(lastPrompt = '') {
  return `<div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;padding:20px;color:#fff;margin:8px 0;border:1px solid rgba(168,85,247,.3)">
  <div style="font-size:18px;font-weight:700;margin-bottom:8px">✨ Want a sharper result?</div>
  <p style="font-size:13px;opacity:.8;margin:0 0 12px 0;line-height:1.5">Ideogram 2.0 renders text <strong>accurately</strong> and produces higher quality images — perfect for logos and branded content with exact spelling 🎯</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
    <div style="background:rgba(255,255,255,.05);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:10px;opacity:.5;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Current</div>
      <div style="font-size:13px;font-weight:600">Pollinations</div>
      <div style="font-size:11px;opacity:.6;margin-top:2px">Free · Good quality</div>
      <div style="font-size:11px;opacity:.5;margin-top:2px">⚠️ Text may be off</div>
    </div>
    <div style="background:rgba(168,85,247,.15);border-radius:10px;padding:10px;text-align:center;border:1px solid rgba(168,85,247,.4)">
      <div style="font-size:10px;opacity:.5;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Premium</div>
      <div style="font-size:13px;font-weight:600;color:#a855f7">Ideogram 2.0</div>
      <div style="font-size:11px;opacity:.6;margin-top:2px">Best quality</div>
      <div style="font-size:11px;color:#2ecc71;margin-top:2px">✅ Exact text rendering</div>
    </div>
  </div>
  <p style="font-size:12px;opacity:.6;margin:0;text-align:center">Reply <strong style="color:#a855f7">"use premium"</strong> to regenerate with Ideogram 2.0 🚀</p>
</div>`;
}

function buildPremiumImageReply(imageUrl = '', prompt = '', imageType = 'image') {
  const labels = {
    logo: '🎨 Your logo — rendered with Ideogram 2.0',
    banner: '🖼️ Banner — rendered with Ideogram 2.0',
    icon: '✨ Icon — rendered with Ideogram 2.0',
    illustration: '🎭 Illustration — rendered with Ideogram 2.0',
    mockup: '📦 Mockup — rendered with Ideogram 2.0',
    image: '🖼️ Image — rendered with Ideogram 2.0'
  };
  const label = labels[imageType] || labels.image;
  const shortCaption = prompt.length > 60 ? prompt.slice(0, 57) + '...' : prompt;
  return `<p><strong>${label}</strong> <span style="font-size:11px;opacity:.6;background:rgba(168,85,247,.2);padding:2px 8px;border-radius:99px;color:#a855f7">✨ Premium</span></p>
<div class="nabad-image-wrap">
  <img src="${imageUrl}" alt="${escapeHtml(prompt.slice(0, 100))}" class="nabad-gen-image" loading="lazy"
    onerror="this.parentElement.innerHTML='<p style=color:#e74c3c>Image failed to load — try again.</p>'" />
  ${shortCaption ? `<p class="nabad-image-caption">✨ ${escapeHtml(shortCaption)}</p>` : ''}
</div>`;
}

// ── Image Utilities ───────────────────────────────────────────────────────────
function isStockPhotoRequest(text = '') {
  return /\b(stock\s*photo|stock\s*image|real\s*(photo|picture|image)|actual\s*(photo|picture|image)|photograph of|photo of a real)\b/i.test(text);
}
function isImageRequest(text = '') {
  return /\b(generate|create|make|draw|design|build|produce|show)\b.{0,40}\b(image|photo|picture|logo|icon|illustration|banner|visual|graphic|mockup)\b/i.test(text)
    || /\b(image|photo|picture|logo|icon|illustration|banner|visual|graphic|mockup)\b.{0,30}\b(generate|create|make|draw|design|for me|please)\b/i.test(text);
}
function isRegenerationRequest(text = '') {
  return /\b(regenerate|redo|try again|another version|different version|new version)\b.{0,30}\b(image|logo|picture|visual|photo|banner|icon)\b/i.test(text)
    || /\b(regenerate|redo|new one|try again)\b$/i.test(text);
}
// FIX: added colour (British spelling) and font/typography variants
function isImageModificationRequest(text = '') {
  return /\b(change|update|modify|make it|make the|adjust|tweak|alter)\b.{0,40}\b(image|logo|picture|visual|banner|icon|color|colour|style|background|font|text|typography)\b/i.test(text)
    || /\b(different|new)\b.{0,20}\b(font|style|color|colour|background)\b/i.test(text);
}
function normalizeImagePrompt(text = '') {
  return text.replace(/[^\w\s,.\-()!?'":@#&]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 900);
}
function detectImageType(text = '') {
  const t = text.toLowerCase();
  if (/\b(logo|brand\s*mark|wordmark)\b/.test(t)) return 'logo';
  if (/\b(banner|cover|header)\b/.test(t)) return 'banner';
  if (/\b(icon|favicon)\b/.test(t)) return 'icon';
  if (/\b(illustration|drawing|art)\b/.test(t)) return 'illustration';
  if (/\b(mockup|product shot)\b/.test(t)) return 'mockup';
  return 'image';
}
function enrichImagePrompt(rawPrompt = '', type = 'image') {
  const base = sanitizePromptText(rawPrompt);
  const suffixes = {
    logo: ', clean vector logo, minimal, professional, white background, sharp edges',
    banner: ', wide format banner, professional design, vibrant colors',
    icon: ', flat icon design, simple, clean, scalable',
    illustration: ', digital illustration, detailed, vibrant',
    mockup: ', product mockup, realistic, studio lighting',
    image: ', high quality, detailed, professional'
  };
  return base + (suffixes[type] || suffixes.image);
}
function buildPollinationsUrl(prompt = '', options = {}) {
  const { width = 1024, height = 1024, seed, model = 'flux', nologo = true } = options;
  const encoded = encodeURIComponent(normalizeImagePrompt(prompt));
  let url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=${model}`;
  if (nologo) url += '&nologo=true';
  if (seed !== undefined) url += `&seed=${seed}`;
  return url;
}
// FIX: extended lookback and catches both Pollinations and Ideogram URLs
function extractLastImageMeta(messages = [], lookback = 15) {
  for (let i = messages.length - 1; i >= Math.max(0, messages.length - lookback); i--) {
    const text = getMessageText(messages[i].content);
    const urlMatch = text.match(/https?:\/\/image\.pollinations\.ai\/prompt\/([^\s"'<&]+)/);
    if (urlMatch) return {
      url: urlMatch[0],
      prompt: decodeMaybe(urlMatch[1].split('?')[0] || ''),
      source: 'pollinations'
    };
    const ideogramMatch = text.match(/https?:\/\/(?:img\.)?ideogram\.ai\/[^\s"'<]+/);
    if (ideogramMatch) return { url: ideogramMatch[0], prompt: '', source: 'ideogram' };
  }
  return null;
}
// FIX: broader URL pattern matching
function conversationRecentlyHadImage(messages = [], lookback = 10) {
  return messages.slice(-lookback).some(m => {
    const text = getMessageText(m.content);
    return /image\.pollinations\.ai|ideogram\.ai|img\.ideogram\.ai/.test(text);
  });
}
function shouldGenerateImage(text = '', messages = []) {
  if (isImageRequest(text)) return true;
  if (isRegenerationRequest(text) && conversationRecentlyHadImage(messages)) return true;
  if (isImageModificationRequest(text) && conversationRecentlyHadImage(messages)) return true;
  return false;
}
function buildStockPhotoHtml(prompt = '') {
  const kw = encodeURIComponent(prompt.replace(/stock\s*(photo|image)/gi, '').replace(/real\s*(photo|picture|image)/gi, '').trim().slice(0, 80));
  const unsplashUrl = `https://source.unsplash.com/1024x768/?${kw}`;
  return `<div class="nabad-image-wrap"><img src="${unsplashUrl}" alt="${escapeHtml(prompt.slice(0, 80))}" class="nabad-gen-image" loading="lazy" /><p class="nabad-image-caption">📷 Stock photo for: ${escapeHtml(prompt.slice(0, 80))}</p></div>`;
}
async function buildImagePromptWithOpenAI(userText = '', messages = [], openaiClient) {
  try {
    const historyContext = messages.slice(-4).map(m => `${m.role}: ${getMessageText(m.content).slice(0, 200)}`).join('\n');
    const resp = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert AI image prompt writer. Given a user request and conversation history, write a vivid, detailed image generation prompt (max 120 words). Focus on visual details, style, lighting, composition. Include exact brand names or text that must appear in the image. No quotation marks.' },
        { role: 'user', content: `Conversation:\n${historyContext}\n\nUser request: ${userText}\n\nWrite the image prompt:` }
      ],
      max_tokens: 180, temperature: 0.8
    });
    return resp.choices?.[0]?.message?.content?.trim() || userText;
  } catch { return userText; }
}
function buildPollinationsImageHtml(imageUrl = '', altText = '', caption = '') {
  const shortCaption = caption.length > 60 ? caption.slice(0, 57) + '...' : caption;
  return `<div class="nabad-image-wrap">
    <img src="${imageUrl}" alt="${escapeHtml(altText.slice(0, 100))}" class="nabad-gen-image" loading="lazy"
      onerror="this.parentElement.innerHTML='<p style=color:#e74c3c>Image generation failed — try again.</p>'" />
    ${shortCaption ? `<p class="nabad-image-caption">✨ ${escapeHtml(shortCaption)}</p>` : ''}
  </div>`;
}
function buildImageReplyHtml(imageUrl = '', promptText = '', imageType = 'image') {
  const labels = { logo: '🎨 Your logo is ready', banner: '🖼️ Banner created', icon: '✨ Icon generated', illustration: '🎭 Illustration ready', mockup: '📦 Mockup generated', image: '🖼️ Image generated' };
  const label = labels[imageType] || labels.image;
  const shortCaption = promptText.length > 60 ? promptText.slice(0, 57) + '...' : promptText;
  return `<p><strong>${label}</strong></p>${buildPollinationsImageHtml(imageUrl, promptText, shortCaption)}`;
}

// ── Business Mode & Personality ───────────────────────────────────────────────
function detectBusinessMode(text = '', messages = []) {
  const t = (text + ' ' + messages.slice(-3).map(m => getMessageText(m.content)).join(' ')).toLowerCase();
  if (/\b(logo|brand|visual|design|color|font|identity)\b/.test(t)) return { id: 'branding', label: 'Brand Strategist', temperature: 0.88, maxTokens: 650, instruction: '' };
  if (/\b(ad|campaign|post|content|social|instagram|tiktok|linkedin|email|seo)\b/.test(t)) return { id: 'marketing', label: 'Marketing Expert', temperature: 0.85, maxTokens: 700, instruction: '' };
  if (/\b(revenue|growth|scale|customer|acquisition|funnel|conversion|sales)\b/.test(t)) return { id: 'growth', label: 'Growth Strategist', temperature: 0.82, maxTokens: 700, instruction: '' };
  if (/\b(offer|package|product|service|upsell|bundle|subscription|pricing)\b/.test(t)) return { id: 'offer', label: 'Offer Architect', temperature: 0.80, maxTokens: 650, instruction: '' };
  return { id: 'advisor', label: 'Business Advisor', temperature: 0.82, maxTokens: 700, instruction: '' };
}

const PERSONALITY_CONFIGS = {
  strategist: {
    id: 'strategist',
    label: '🧠 Strategist',
    temperature: 0.78,
    maxTokens: 750,
    instruction: `You are a sharp strategic thinker who has built and advised real businesses.
VOICE: Precise, confident, framework-driven — but human. Not a McKinsey deck.
Use emojis sparingly: 1-2 per reply max, only where they sharpen a point 🎯
LENGTH: Max 150 words. Lead with one sharp strategic insight.
Use structured points only when presenting a framework or comparison.
Never open with a heading. Open with a sentence that reframes how they see the problem.
End with "Strategic move:" or a direct question that forces them to think differently.`
  },
  growth: {
    id: 'growth',
    label: '📈 Growth',
    temperature: 0.85,
    maxTokens: 700,
    instruction: `You are obsessed with one thing: growth that actually moves the needle.
VOICE: Energetic, metric-minded, zero tolerance for vanity plays.
Use emojis where they add momentum: 📈 🚀 💡 — max 2 per reply
LENGTH: Max 120 words. Lead with the single biggest growth lever available to them.
Max 3 bullet points — each must explain WHY it works, not just WHAT it is.
Never recommend a tactic without connecting it to revenue or retention.
End with a growth-focused question or "Growth move:" that demands a number.`
  },
  branding: {
    id: 'branding',
    label: '🎨 Branding',
    temperature: 0.88,
    maxTokens: 650,
    instruction: `You see brands the way a great designer sees negative space — it's what you don't say that matters.
VOICE: Creative, emotionally intelligent, visual. You speak in feelings and images.
Use emojis that evoke mood and identity: 🎨 ✨ 💫 — max 2 per reply
LENGTH: Max 100 words. No bullet lists unless directly comparing brand options.
Make them FEEL the brand direction, not just understand it intellectually.
Use vivid, specific language. "Bold" means nothing. "Walks into a room before you do" means something.
End with a brand-focused provocation or question that challenges their current identity.`
  },
  offer: {
    id: 'offer',
    label: '💰 Offer',
    temperature: 0.80,
    maxTokens: 650,
    instruction: `You think like a world-class offer architect — every word in an offer either builds value or destroys it.
VOICE: Persuasive, commercially sharp, direct. You talk about money without flinching.
Use emojis that signal value and urgency: 💰 🔥 ✅ — max 2 per reply
LENGTH: Max 130 words. Lead with the value gap — what they're leaving on the table right now.
Use bullet points only for listing deliverables or value stack items.
Always anchor price to transformation, never to time or cost.
End with "Offer move:" or a question that exposes weak pricing thinking.`
  },
  creative: {
    id: 'creative',
    label: '🎭 Creative',
    temperature: 0.92,
    maxTokens: 700,
    instruction: `You are the person in the room who says the thing nobody else will say.
VOICE: Bold, unexpected, slightly provocative. You think in metaphors and reversals.
Use emojis that feel artistic and surprising: 🎭 🌀 ⚡ 🔮 — max 2 per reply
LENGTH: Max 90 words. No bullet points. Ever. Flowing sentences only.
Your job is to completely reframe how they see the problem.
Say the opposite of what they expect. Make it memorable.
End with a question or statement that they'll be thinking about tomorrow.`
  },
  straight_talk: {
    id: 'straight_talk',
    label: '⚡ Straight Talk',
    temperature: 0.75,
    maxTokens: 600,
    instruction: `Brutally direct. Zero fluff. No lists. No headings.
MAX 60 words — hard limit. Not a suggestion. A hard limit.
Blunt doesn't mean boring — think Gordon Ramsay, not a parking ticket ⚡
Say the uncomfortable truth they already know but haven't admitted yet.
One emoji max — only if it punches harder than words alone.
End with one sharp question or nothing at all.`
  },
  auto: {
    id: 'auto',
    label: '✨ Auto',
    temperature: 0.82,
    maxTokens: 700,
    instruction: `You are a real founder who has built and scaled businesses — sharp, warm, direct.
VOICE: Like a smart friend giving real advice over coffee. Has opinions. Uses humour when it fits.
Use emojis naturally the way a founder would in a DM — 1-3 per reply, where they add punch not decoration 🔥
LENGTH: Match the complexity of the question:
- Simple question → max 3 sentences, no lists
- Advice request → 1 punchy opener + max 3 points + 1 question
- Complex strategy → max 150 words, one heading max
Never open with a heading. Always open with a sentence that makes them want to keep reading.
Never use: "Absolutely" / "Great question" / "Of course" / "Certainly" / "Sure!" / "Happy to help"
End with a direct question, a provocation, or "Next move:" 🚀`
  }
};

function getPersonalityConfig(id = 'auto') {
  return PERSONALITY_CONFIGS[id] || PERSONALITY_CONFIGS.auto;
}
function detectToneOverride(text = '') {
  const t = text.toLowerCase();
  if (/\b(be\s+direct|straight\s+talk|no\s+fluff|be\s+blunt|just\s+tell\s+me)\b/.test(t)) return 'straight_talk';
  if (/\b(think\s+creatively|be\s+creative|outside\s+the\s+box|bold\s+ideas)\b/.test(t)) return 'creative';
  if (/\b(growth|scale|grow\s+faster|acquisition)\b/.test(t)) return 'growth';
  return null;
}
function resolveActivePersonality(selectedPersonality = 'auto', lastUserMessage = '') {
  const override = detectToneOverride(lastUserMessage);
  if (override) return { personalityId: override, source: 'tone-override', overridePersonality: override };
  if (selectedPersonality && selectedPersonality !== 'auto') return { personalityId: selectedPersonality, source: 'user-selected' };
  return { personalityId: 'auto', source: 'auto' };
}

// ── Positioning ───────────────────────────────────────────────────────────────
function isPositioningQuestion(text = '') {
  return /\b(what (are|is) (you|nabad)|who (are|is) (you|nabad)|tell me about (yourself|nabad)|what can (you|nabad) do|how (are you|is nabad) different|compare (you|nabad)|vs (chatgpt|gpt|claude|gemini)|better than)\b/i.test(text);
}
const POSITIONING_REPLY = `<p><strong>NabadAI isn't a chatbot. It's your business co-founder.</strong></p><p>While other AI tools answer questions, Nabad builds your strategy. It knows your market, challenges your assumptions, and helps you move — not just think.</p><ul><li>🎯 <strong>Business-first</strong> — every response is filtered through a founder lens</li><li>⚡ <strong>Opinionated</strong> — Nabad tells you what it actually thinks, not what sounds safe</li><li>🧠 <strong>Context-aware</strong> — remembers your business details across the conversation</li><li>🛠️ <strong>Action-oriented</strong> — ends with moves, not maybes</li></ul><p>Think less "AI assistant" and more "co-founder who's done this before." 🚀</p>`;

// ── Proactive Intelligence ────────────────────────────────────────────────────
function buildProactiveIntelligence(messages = [], lastUserMessage = '') {
  const msgCount = messages.filter(m => m.role === 'user').length;
  if (msgCount < 2) return '';
  const allText = messages.map(m => getMessageText(m.content).toLowerCase()).join(' ');
  const insights = [];
  if (/social media|instagram|tiktok|content/.test(allText) && !/paid|ads|sponsor/.test(allText)) insights.push('Consider whether paid amplification would accelerate what organic content is building.');
  if (/freelan|agency|service/.test(allText) && !/retainer|recurring/.test(allText)) insights.push('Retainer-based pricing could stabilize cash flow vs. project-based work.');
  if (/product|launch|mvp/.test(allText) && !/waitlist|pre.?launch|pre.?sell/.test(allText)) insights.push('A pre-launch waitlist could validate demand before full investment.');
  return insights.length ? `\n\nProactive intelligence (weave into reply naturally, never list verbatim): ${insights.join(' | ')}` : '';
}

// ── Memory Context ────────────────────────────────────────────────────────────
function buildMemoryContext(messages = []) {
  const userMsgs = messages.filter(m => m.role === 'user').map(m => getMessageText(m.content).toLowerCase());
  const combined = userMsgs.join(' ');
  const facts = [];
  const industryMatch = combined.match(/\b(agency|restaurant|cafe|gym|clinic|salon|ecommerce|saas|consulting|coaching|retail)\b/);
  if (industryMatch) facts.push(`Industry: ${industryMatch[1]}`);
  const revenueMatch = combined.match(/\$[\d,]+\s*(\/month|per month|monthly|\/mo)?|\b[\d,]+\s*(aed|sar|egp|usd|gbp|eur)\b/i);
  if (revenueMatch) facts.push(`Revenue mentioned: ${revenueMatch[0]}`);
  const clientMatch = combined.match(/(\d+)\s*(clients?|customers?|accounts?)/i);
  if (clientMatch) facts.push(`Clients: ${clientMatch[0]}`);
  const goalMatch = combined.match(/\b(scale|grow|reach|hit|achieve)\b.{0,40}\b(\$[\d,]+|[\d,]+k|10k|20k|50k|100k)\b/i);
  if (goalMatch) facts.push(`Goal: ${goalMatch[0]}`);
  return facts.length ? `\n\nConversation memory (reference naturally, never repeat verbatim): ${facts.join(' | ')}` : '';
}

// ── Location Detection ────────────────────────────────────────────────────────
function extractLocationFromMessages(messages = []) {
  const text = messages.map(m => getMessageText(m.content)).join(' ');
  const patterns = [
    /\b(based in|located in|from|in|i'm in|we're in)\s+([A-Za-z\s]{2,30}(?:UAE|KSA|UK|US|USA|Egypt|Jordan|Kuwait|Bahrain|Oman|Qatar|Saudi|Dubai|Abu Dhabi|Riyadh|Cairo|London|New York|Lagos))/i,
    /\b(Dubai|Abu Dhabi|Sharjah|Riyadh|Jeddah|Cairo|Amman|Kuwait City|Manama|Muscat|Doha|London|New York|Lagos|Nairobi|Karachi|Lahore)\b/i
  ];
  for (const p of patterns) { const m = text.match(p); if (m) return m[2] || m[1] || m[0]; }
  return '';
}
function buildLocationContext(location = '') {
  if (!location) return '';
  const loc = location.toLowerCase();
  const contexts = {
    dubai: 'Dubai/UAE context: VAT 5%, free zones available, strong expat market, high competition in services, Arabic & English markets.',
    'abu dhabi': 'Abu Dhabi/UAE context: Government-heavy economy, strong B2G opportunities, VAT 5%, Emiratization policies relevant for hiring.',
    riyadh: 'Saudi Arabia context: VAT 15%, Vision 2030 driving new sectors, large youth population, social media penetration is very high.',
    cairo: 'Egypt context: Price-sensitive market, USD-based pricing can be premium, strong freelance economy, Arabic content performs well.',
    london: 'UK context: VAT 20%, competitive market, strong startup ecosystem, IR35 regulations if hiring contractors.',
    lagos: 'Nigeria context: Naira volatility, USD pricing preferred by many businesses, large youth market, mobile-first consumers.'
  };
  for (const [key, ctx] of Object.entries(contexts)) {
    if (loc.includes(key)) return `\n\nLocation context: ${ctx}`;
  }
  return `\n\nLocation context: User is based in ${location}. Tailor advice to local market conditions where relevant.`;
}
function hasBusinessContext(text = '') {
  return /\b(business|startup|agency|product|service|client|revenue|launch|idea|offer|brand|market|customer|pricing|scale|grow)\b/i.test(text);
}
function hasRichBusinessContext(messages = []) {
  const userMsgs = messages.filter(m => m.role === 'user').map(m => getMessageText(m.content).toLowerCase());
  const combined = userMsgs.join(' ');
  const checks = [
    /\b(agency|startup|business|product|service|brand)\b/.test(combined),
    /\b(client|customer|revenue|\$|income|pay)\b/.test(combined),
    /\b(problem|struggle|challenge|stuck|issue)\b/.test(combined)
  ];
  return checks.filter(Boolean).length >= 2;
}
function locationAlreadyAsked(messages = []) {
  return messages.some(m => m.role === 'assistant' && /where are you based|what city|which country|your location/i.test(getMessageText(m.content)));
}

// ── Business Snapshot ─────────────────────────────────────────────────────────
function snapshotAlreadyOffered(messages = []) {
  return messages.some(m => m.role === 'assistant' && /business snapshot/i.test(getMessageText(m.content)));
}
function shouldOfferSnapshot(messages = []) {
  const userMsgs = messages.filter(m => m.role === 'user');
  if (userMsgs.length < 3) return false;
  if (snapshotAlreadyOffered(messages)) return false;
  return hasRichBusinessContext(messages);
}
async function generateBusinessSnapshot(messages = [], location = '', openaiClient) {
  const context = messages.filter(m => m.role === 'user').map(m => getMessageText(m.content)).join('\n');
  const prompt = `Based on this business conversation, create a concise Business Snapshot JSON with these exact fields:
{
  "businessType": "one-line description",
  "stage": "idea/early/growing/scaling",
  "biggestOpportunity": "specific, actionable opportunity in 2-3 sentences",
  "keyRisk": "the most critical risk to address in 2-3 sentences",
  "boldRecommendation": "one bold, specific recommendation in 2-3 sentences",
  "quickWins": ["win1", "win2", "win3"],
  "metrics": {"current": "current state", "target": "realistic 90-day target"}
}
Context: ${context.slice(0, 2000)}
Location: ${location || 'not specified'}`;
  const resp = await openaiClient.chat.completions.create({
    model: 'gpt-4o', messages: [{ role: 'user', content: prompt }],
    max_tokens: 600, temperature: 0.7
  });
  return tryParseJsonBlock(resp.choices[0].message.content) || {};
}
function buildSnapshotCard(data = {}, location = '') {
  const esc = escapeHtml;
  const quickWins = normalizeList(data.quickWins || []).slice(0, 3).map(w => `<li>${esc(w)}</li>`).join('');
  return `<div data-nabad-card="snapshot" style="background:linear-gradient(135deg,#0f2027,#203a43,#2c5364);border-radius:16px;padding:24px;color:#fff;margin:8px 0;font-family:inherit">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <span style="font-size:24px">📊</span>
    <div><strong style="font-size:16px">Business Snapshot</strong>${location ? `<br><span style="font-size:11px;opacity:.7">📍 ${esc(location)}</span>` : ''}</div>
  </div>
  <div style="background:rgba(255,255,255,.08);border-radius:10px;padding:14px;margin-bottom:10px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:.6;margin-bottom:4px">Biggest Opportunity</div>
    <div style="font-size:14px;line-height:1.5">${esc(data.biggestOpportunity || 'Analysing your opportunity...')}</div>
  </div>
  <div style="background:rgba(255,100,100,.12);border-radius:10px;padding:14px;margin-bottom:10px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:.6;margin-bottom:4px">Key Risk</div>
    <div style="font-size:14px;line-height:1.5">${esc(data.keyRisk || 'Risk analysis in progress...')}</div>
  </div>
  <div style="background:rgba(100,255,150,.12);border-radius:10px;padding:14px;margin-bottom:10px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:.6;margin-bottom:4px">Bold Recommendation</div>
    <div style="font-size:14px;line-height:1.5">${esc(data.boldRecommendation || 'Generating recommendation...')}</div>
  </div>
  ${quickWins ? `<div style="margin-top:10px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:.6;margin-bottom:8px">Quick Wins</div><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8">${quickWins}</ul></div>` : ''}
  ${data.metrics ? `<div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style="background:rgba(255,255,255,.06);border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;opacity:.6;margin-bottom:4px">NOW</div><div style="font-size:13px">${esc(data.metrics.current || '')}</div></div><div style="background:rgba(100,200,255,.12);border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;opacity:.6;margin-bottom:4px">90-DAY TARGET</div><div style="font-size:13px">${esc(data.metrics.target || '')}</div></div></div>` : ''}
</div>`;
}

// ── Nabad Score ───────────────────────────────────────────────────────────────
function isIdeaScoringRequest(text = '') {
  return /\b(score|rate|evaluate|assess|rank|grade|analyse|analyze)\b.{0,40}\b(idea|concept|business|startup|this|it)\b/i.test(text)
    || /\b(how (good|strong|viable|solid) is)\b.{0,30}\b(idea|concept|business|this)\b/i.test(text)
    || /\bnabad score\b/i.test(text);
}
async function generateNabadScore(messages = [], openaiClient) {
  const context = messages.filter(m => m.role === 'user').map(m => getMessageText(m.content)).join('\n');
  const prompt = `Analyse this business idea and return a JSON Nabad Score:
{
  "ideaSummary": "one-line summary of the business idea",
  "scores": {
    "marketDemand": {"score": 75, "comment": "explanation"},
    "differentiation": {"score": 68, "comment": "explanation"},
    "monetization": {"score": 80, "comment": "explanation"},
    "executionDifficulty": {"score": 55, "comment": "lower is easier"},
    "timing": {"score": 72, "comment": "explanation"}
  },
  "overallScore": 70,
  "verdict": "one bold sentence verdict",
  "topStrength": "biggest strength",
  "biggestRisk": "biggest risk",
  "recommendation": "what to do next"
}
Context: ${context.slice(0, 2000)}`;
  const resp = await openaiClient.chat.completions.create({
    model: 'gpt-4o', messages: [{ role: 'user', content: prompt }],
    max_tokens: 700, temperature: 0.7
  });
  return tryParseJsonBlock(resp.choices[0].message.content) || {};
}
function buildScoreCard(data = {}) {
  const esc = escapeHtml;
  const scores = data.scores || {};
  const scoreItems = [
    { key: 'marketDemand', label: 'Market Demand', icon: '📊' },
    { key: 'differentiation', label: 'Differentiation', icon: '🎯' },
    { key: 'monetization', label: 'Monetization', icon: '💰' },
    { key: 'executionDifficulty', label: 'Execution Ease', icon: '⚙️' },
    { key: 'timing', label: 'Timing', icon: '⏱️' }
  ].filter(item => scores[item.key]);
  const overall = data.overallScore || 0;
  const scoreColor = overall >= 75 ? '#2ecc71' : overall >= 55 ? '#f39c12' : '#e74c3c';
  const bars = scoreItems.map(item => {
    const s = scores[item.key]; const pct = Math.min(100, Math.max(0, s.score || 0));
    return `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:13px">${item.icon} ${esc(item.label)}</span>
        <span style="font-size:13px;font-weight:700;color:${pct>=70?'#2ecc71':pct>=50?'#f39c12':'#e74c3c'}">${pct}</span>
      </div>
      <div style="background:rgba(255,255,255,.1);border-radius:99px;height:6px;overflow:hidden">
        <div data-score="${pct}" style="height:100%;border-radius:99px;background:${pct>=70?'#2ecc71':pct>=50?'#f39c12':'#e74c3c'};width:${pct}%"></div>
      </div>
      ${s.comment ? `<div style="font-size:11px;opacity:.65;margin-top:3px">${esc(s.comment)}</div>` : ''}
    </div>`;
  }).join('');
  return `<div data-nabad-card="score" style="background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);border-radius:16px;padding:24px;color:#fff;margin:8px 0;font-family:inherit">
  <div style="text-align:center;margin-bottom:20px">
    <div style="font-size:48px;font-weight:800;color:${scoreColor}">${overall}</div>
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;opacity:.6">Nabad Score</div>
    ${data.ideaSummary ? `<div style="font-size:13px;opacity:.8;margin-top:6px;font-style:italic">${esc(data.ideaSummary)}</div>` : ''}
  </div>
  ${bars}
  ${data.verdict ? `<div style="background:rgba(255,255,255,.08);border-radius:10px;padding:12px;margin-top:16px;font-size:14px;font-weight:600;text-align:center">${esc(data.verdict)}</div>` : ''}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
    ${data.topStrength ? `<div style="background:rgba(46,204,113,.12);border-radius:8px;padding:10px"><div style="font-size:10px;opacity:.6;margin-bottom:4px">💪 TOP STRENGTH</div><div style="font-size:12px">${esc(data.topStrength)}</div></div>` : ''}
    ${data.biggestRisk ? `<div style="background:rgba(231,76,60,.12);border-radius:8px;padding:10px"><div style="font-size:10px;opacity:.6;margin-bottom:4px">⚠️ BIGGEST RISK</div><div style="font-size:12px">${esc(data.biggestRisk)}</div></div>` : ''}
  </div>
  ${data.recommendation ? `<div style="margin-top:12px;padding:12px;background:rgba(52,152,219,.15);border-radius:8px;border-left:3px solid #3498db"><div style="font-size:11px;opacity:.6;margin-bottom:4px">🚀 NEXT MOVE</div><div style="font-size:13px">${esc(data.recommendation)}</div></div>` : ''}
</div>`;
}

// ── Pricing Table ─────────────────────────────────────────────────────────────
function isPricingTableRequest(text = '') {
  return /\b(pricing table|price table|pricing plan|pricing tier|tier(ed)? pricing|package price|service price|how much (should|do|to) (i |we )?charge|price my (service|offer|package|product))\b/i.test(text)
    || /\b(create|build|show|give|make|design)\b.{0,30}\b(pricing|price plan|packages?)\b/i.test(text);
}
async function generatePricingTable(messages = [], location = '', openaiClient) {
  const context = messages.filter(m => m.role === 'user').map(m => getMessageText(m.content)).join('\n');
  const prompt = `Create a professional pricing table JSON for this business:
{
  "title": "Service Pricing",
  "subtitle": "Choose the plan that fits your needs",
  "currency": "USD",
  "tiers": [
    {"name": "Starter", "price": "500", "period": "month", "description": "Perfect for getting started", "features": ["Feature 1", "Feature 2", "Feature 3"], "cta": "Get Started", "highlighted": false},
    {"name": "Growth", "price": "1200", "period": "month", "description": "For growing businesses", "features": ["Everything in Starter", "Feature 4", "Feature 5", "Feature 6"], "cta": "Most Popular", "highlighted": true},
    {"name": "Scale", "price": "2500", "period": "month", "description": "Full-service solution", "features": ["Everything in Growth", "Feature 7", "Feature 8", "Feature 9", "Feature 10"], "cta": "Let's Scale", "highlighted": false}
  ]
}
Use realistic pricing for their market. Location: ${location || 'not specified'}. Context: ${context.slice(0, 1500)}`;
  const resp = await openaiClient.chat.completions.create({
    model: 'gpt-4o', messages: [{ role: 'user', content: prompt }],
    max_tokens: 800, temperature: 0.75
  });
  return tryParseJsonBlock(resp.choices[0].message.content) || {};
}
function buildPricingTableCard(data = {}) {
  const esc = escapeHtml;
  const tiers = Array.isArray(data.tiers) ? data.tiers : [];
  const currency = data.currency || 'USD';
  const symbols = { USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SAR: 'SAR ', EGP: 'EGP ' };
  const sym = symbols[currency] || '$';
  const tierHtml = tiers.map(tier => {
    const features = normalizeList(tier.features || []).map(f => `<tr><td style="padding:6px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,.06)">✓ ${esc(f)}</td></tr>`).join('');
    return `<div style="flex:1;min-width:200px;background:${tier.highlighted ? 'linear-gradient(135deg,#6c5ce7,#a855f7)' : 'rgba(255,255,255,.05)'};border-radius:12px;padding:20px;border:${tier.highlighted ? '2px solid #a855f7' : '1px solid rgba(255,255,255,.1)'};position:relative">
      ${tier.highlighted ? '<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#a855f7;color:#fff;font-size:11px;font-weight:700;padding:3px 14px;border-radius:99px;white-space:nowrap">⭐ POPULAR</div>' : ''}
      <div style="font-size:15px;font-weight:700;margin-bottom:4px">${esc(tier.name || '')}</div>
      <div style="margin:10px 0"><span style="font-size:28px;font-weight:800">${sym}${esc(String(tier.price || ''))}</span><span style="font-size:12px;opacity:.6">/${tier.period || 'mo'}</span></div>
      <div style="font-size:12px;opacity:.7;margin-bottom:12px">${esc(tier.description || '')}</div>
      <table style="width:100%;border-collapse:collapse"><tbody>${features}</tbody></table>
      <div style="margin-top:14px;text-align:center"><span style="display:inline-block;background:${tier.highlighted ? 'rgba(255,255,255,.25)' : 'rgba(168,85,247,.3)'};color:#fff;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600">${esc(tier.cta || 'Choose Plan')}</span></div>
    </div>`;
  }).join('');
  return `<div data-nabad-card="pricing" style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;padding:24px;color:#fff;margin:8px 0;font-family:inherit">
  <div style="text-align:center;margin-bottom:20px">
    <div style="font-size:20px;font-weight:700">${esc(data.title || 'Pricing Plans')}</div>
    ${data.subtitle ? `<div style="font-size:13px;opacity:.7;margin-top:4px">${esc(data.subtitle)}</div>` : ''}
  </div>
  <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">${tierHtml}</div>
</div>`;
}

// ── Offer Card ────────────────────────────────────────────────────────────────
// FIX: broader regex to catch "structure this as a full offer card" and similar phrases
function isOfferCardRequest(text = '') {
  return /\b(offer card|build (me )?(an? )?offer|create (an? )?offer|design (an? )?offer|make (an? )?offer card|structure (my |the |this |it )?(as )?(a |an )?(full )?offer)\b/i.test(text)
    || /\b(flagship (offer|package|product)|signature (offer|package|service)|premium (offer|package))\b.{0,30}\b(card|build|create|design)\b/i.test(text)
    || /\b(build|create|design|make)\b.{0,30}\b(flagship|signature|premium)\b.{0,30}\b(offer|package|service)\b/i.test(text);
}
async function generateOfferCard(messages = [], location = '', openaiClient) {
  const context = messages.filter(m => m.role === 'user').map(m => getMessageText(m.content)).join('\n');
  const prompt = `Create an irresistible offer card JSON for this business:
{
  "offerName": "The Offer Name",
  "tagline": "Compelling one-line value proposition",
  "price": "3500",
  "currency": "USD",
  "period": "one-time",
  "duration": "90 days",
  "targetClient": "Who this is for",
  "transformation": "The main transformation/outcome",
  "inclusions": ["Deliverable 1", "Deliverable 2", "Deliverable 3", "Deliverable 4", "Deliverable 5"],
  "bonuses": ["Bonus 1", "Bonus 2"],
  "guarantee": "30-day satisfaction guarantee",
  "urgency": "Only 3 spots available this month",
  "tags": ["Tag1", "Tag2", "Tag3"]
}
Location: ${location || 'not specified'}. Context: ${context.slice(0, 1500)}`;
  const resp = await openaiClient.chat.completions.create({
    model: 'gpt-4o', messages: [{ role: 'user', content: prompt }],
    max_tokens: 700, temperature: 0.8
  });
  return tryParseJsonBlock(resp.choices[0].message.content) || {};
}
function buildOfferCard(data = {}) {
  const esc = escapeHtml;
  const symbols = { USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SAR: 'SAR ', EGP: 'EGP ' };
  const sym = symbols[data.currency || 'USD'] || '$';
  const inclusions = normalizeList(data.inclusions || []).map(i => `<li style="padding:5px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,.06)">✅ ${esc(i)}</li>`).join('');
  const bonuses = normalizeList(data.bonuses || []).map(b => `<li style="padding:5px 0;font-size:13px">🎁 ${esc(b)}</li>`).join('');
  const tags = normalizeList(data.tags || []).map(t => `<span style="background:rgba(255,255,255,.12);padding:3px 10px;border-radius:99px;font-size:11px">${esc(t)}</span>`).join(' ');
  return `<div data-nabad-card="offer" style="background:linear-gradient(135deg,#1a0a00,#2d1200,#3d1f00);border-radius:16px;padding:24px;color:#fff;margin:8px 0;font-family:inherit;border:1px solid rgba(255,165,0,.25)">
  <div style="text-align:center;margin-bottom:16px">
    ${tags ? `<div style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:5px;justify-content:center">${tags}</div>` : ''}
    <div style="font-size:22px;font-weight:800;line-height:1.2">${esc(data.offerName || 'Your Offer')}</div>
    ${data.tagline ? `<div style="font-size:13px;opacity:.75;margin-top:6px;font-style:italic">${esc(data.tagline)}</div>` : ''}
    ${data.targetClient ? `<div style="font-size:12px;margin-top:6px;padding:4px 12px;background:rgba(255,165,0,.15);border-radius:99px;display:inline-block">👤 ${esc(data.targetClient)}</div>` : ''}
  </div>
  <div style="background:linear-gradient(135deg,rgba(255,165,0,.2),rgba(255,140,0,.1));border-radius:12px;padding:16px;text-align:center;margin-bottom:16px;border:1px solid rgba(255,165,0,.3)">
    <div style="font-size:40px;font-weight:800;color:#ffa500">${sym}${esc(String(data.price || ''))}</div>
    <div style="font-size:12px;opacity:.7">${esc(data.period || '')}${data.duration ? ` · ${esc(data.duration)}` : ''}</div>
    ${data.transformation ? `<div style="font-size:13px;margin-top:8px;opacity:.85">🎯 ${esc(data.transformation)}</div>` : ''}
  </div>
  ${inclusions ? `<div style="margin-bottom:12px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:.6;margin-bottom:8px">What's Included</div><ul style="margin:0;padding:0;list-style:none">${inclusions}</ul></div>` : ''}
  ${bonuses ? `<div style="margin-bottom:12px;background:rgba(255,215,0,.08);border-radius:10px;padding:12px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:.6;margin-bottom:6px">Bonuses</div><ul style="margin:0;padding:0;list-style:none">${bonuses}</ul></div>` : ''}
  ${data.guarantee ? `<div style="font-size:12px;opacity:.7;text-align:center;margin-top:8px">🛡️ ${esc(data.guarantee)}</div>` : ''}
  ${data.urgency ? `<div style="margin-top:12px;background:rgba(255,0,0,.1);border-radius:8px;padding:10px;text-align:center;font-size:12px;font-weight:600;color:#ff6b6b">⚡ ${esc(data.urgency)}</div>` : ''}
</div>`;
}

// ── Positioning Matrix ────────────────────────────────────────────────────────
function isPositioningMatrixRequest(text = '') {
  return /\b(positioning matrix|competitive matrix|position (me|us|my brand)|compare (me|us) to|vs\b.{0,50}\b(competitor|agency|freelancer|brand)|market position|where do (i|we) sit|differentiat(e|ion) map)\b/i.test(text)
    || /\b(show|create|build|make|generate)\b.{0,30}\b(positioning|competitive|market|matrix)\b/i.test(text);
}
async function generatePositioningMatrix(messages = [], location = '', openaiClient) {
  const context = messages.filter(m => m.role === 'user').map(m => getMessageText(m.content)).join('\n');
  const prompt = `Create a positioning matrix JSON for this business:
{
  "title": "Market Positioning Map",
  "xAxis": {"label": "Price", "low": "Low Cost", "high": "Premium"},
  "yAxis": {"label": "Specialization", "low": "Generalist", "high": "Specialist"},
  "entities": [
    {"name": "You", "x": 75, "y": 80, "quadrant": "sweet-spot", "description": "Your position"},
    {"name": "Competitor A", "x": 30, "y": 40, "quadrant": "avoid", "description": "Their position"},
    {"name": "Competitor B", "x": 70, "y": 30, "quadrant": "differentiate", "description": "Their position"},
    {"name": "Competitor C", "x": 25, "y": 75, "quadrant": "niche", "description": "Their position"}
  ],
  "insight": "Strategic insight about your positioning",
  "recommendation": "What to do to strengthen your position"
}
Context: ${context.slice(0, 1500)}`;
  const resp = await openaiClient.chat.completions.create({
    model: 'gpt-4o', messages: [{ role: 'user', content: prompt }],
    max_tokens: 700, temperature: 0.75
  });
  return tryParseJsonBlock(resp.choices[0].message.content) || {};
}
function buildPositioningMatrixCard(data = {}) {
  const esc = escapeHtml;
  const entities = Array.isArray(data.entities) ? data.entities : [];
  const quadrantColors = { 'sweet-spot': '#2ecc71', 'differentiate': '#3498db', 'niche': '#f39c12', 'avoid': '#e74c3c' };
  const quadrantLabels = { 'sweet-spot': 'Sweet Spot', 'differentiate': 'Differentiate', 'niche': 'Niche', 'avoid': 'Crowded' };
  const entityDots = entities.map(e => {
    const color = quadrantColors[e.quadrant] || '#95a5a6';
    const isYou = e.name === 'You';
    return `<div style="position:absolute;left:${e.x}%;top:${100 - e.y}%;transform:translate(-50%,-50%);z-index:2">
      <div style="width:${isYou ? 16 : 12}px;height:${isYou ? 16 : 12}px;border-radius:50%;background:${color};border:${isYou ? '3px solid #fff' : '2px solid rgba(255,255,255,.4)'};box-shadow:0 0 ${isYou ? 10 : 6}px ${color}"></div>
      <div style="position:absolute;top:${isYou ? -22 : -20}px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:${isYou ? 12 : 11}px;font-weight:${isYou ? 700 : 500};color:${color}">${esc(e.name)}</div>
    </div>`;
  }).join('');
  const legendItems = Object.entries(quadrantColors).map(([key, color]) =>
    `<div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:50%;background:${color}"></div><span style="font-size:11px;opacity:.8">${quadrantLabels[key]}</span></div>`
  ).join('');
  return `<div data-nabad-card="matrix" style="background:linear-gradient(135deg,#0d0d1a,#1a1a2e);border-radius:16px;padding:24px;color:#fff;margin:8px 0;font-family:inherit">
  <div style="text-align:center;margin-bottom:16px"><div style="font-size:18px;font-weight:700">${esc(data.title || 'Positioning Matrix')}</div></div>
  <div style="position:relative;width:100%;padding-top:100%;max-width:320px;margin:0 auto">
    <div style="position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:2px">
      ${['niche', 'sweet-spot', 'avoid', 'differentiate'].map((q) =>
        `<div data-quadrant="${q}" style="background:${quadrantColors[q]}18;border-radius:8px;border:1px solid ${quadrantColors[q]}30"></div>`
      ).join('')}
    </div>
    <div style="position:absolute;inset:0">${entityDots}</div>
    ${data.xAxis ? `<div style="position:absolute;bottom:-20px;left:0;right:0;display:flex;justify-content:space-between;font-size:10px;opacity:.6"><span>${esc(data.xAxis.low||'')}</span><span style="font-weight:600">${esc(data.xAxis.label||'')}</span><span>${esc(data.xAxis.high||'')}</span></div>` : ''}
    ${data.yAxis ? `<div style="position:absolute;top:0;bottom:0;left:-45px;display:flex;flex-direction:column;justify-content:space-between;font-size:10px;opacity:.6;text-align:right;width:40px"><span>${esc(data.yAxis.high||'')}</span><span style="font-weight:600;transform:rotate(-90deg)">${esc(data.yAxis.label||'')}</span><span>${esc(data.yAxis.low||'')}</span></div>` : ''}
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:30px">${legendItems}</div>
  ${data.insight ? `<div style="margin-top:14px;background:rgba(255,255,255,.06);border-radius:10px;padding:12px"><div style="font-size:11px;opacity:.6;margin-bottom:4px">💡 INSIGHT</div><div style="font-size:13px">${esc(data.insight)}</div></div>` : ''}
  ${data.recommendation ? `<div style="margin-top:10px;background:rgba(52,152,219,.12);border-radius:10px;padding:12px;border-left:3px solid #3498db"><div style="font-size:11px;opacity:.6;margin-bottom:4px">🎯 RECOMMENDATION</div><div style="font-size:13px">${esc(data.recommendation)}</div></div>` : ''}
</div>`;
}

// ── 30-Day Action Plan ────────────────────────────────────────────────────────
function isActionPlanRequest(text = '') {
  return /\b(30.?day|thirty.?day)\b.{0,30}\b(plan|action|roadmap|strategy)\b/i.test(text)
    || /\b(action plan|roadmap|step.?by.?step plan|weekly plan|monthly plan)\b/i.test(text)
    || /\b(what (should|do) i do (next|first|now)|next steps|where (do i|to) start)\b.{0,30}\b(plan|roadmap|steps)\b/i.test(text);
}
async function generateActionPlan(messages = [], location = '', openaiClient) {
  const context = messages.filter(m => m.role === 'user').map(m => getMessageText(m.content)).join('\n');
  const prompt = `Create a 30-day action plan JSON for this business goal:
{
  "title": "30-Day Action Plan",
  "goal": "The main goal to achieve",
  "weeks": [
    {"weekNumber": 1, "theme": "Week theme/focus", "icon": "🎯", "actions": [
      {"day": "Day 1-2", "action": "Specific action", "priority": "high"},
      {"day": "Day 3-4", "action": "Specific action", "priority": "medium"},
      {"day": "Day 5-7", "action": "Specific action", "priority": "high"}
    ]},
    {"weekNumber": 2, "theme": "Week 2 theme", "icon": "📈", "actions": [
      {"day": "Day 8-9", "action": "Specific action", "priority": "high"},
      {"day": "Day 10-11", "action": "Specific action", "priority": "medium"},
      {"day": "Day 12-14", "action": "Specific action", "priority": "high"}
    ]},
    {"weekNumber": 3, "theme": "Week 3 theme", "icon": "🚀", "actions": [
      {"day": "Day 15-17", "action": "Specific action", "priority": "high"},
      {"day": "Day 18-19", "action": "Specific action", "priority": "medium"},
      {"day": "Day 20-21", "action": "Specific action", "priority": "high"}
    ]},
    {"weekNumber": 4, "theme": "Week 4 theme", "icon": "🏆", "actions": [
      {"day": "Day 22-24", "action": "Specific action", "priority": "high"},
      {"day": "Day 25-27", "action": "Specific action", "priority": "medium"},
      {"day": "Day 28-30", "action": "Specific action", "priority": "high"}
    ]}
  ],
  "successMetric": "How to measure success at day 30",
  "keyResources": ["Resource 1", "Resource 2"]
}
Context: ${context.slice(0, 1500)}. Location: ${location || 'not specified'}.`;
  const resp = await openaiClient.chat.completions.create({
    model: 'gpt-4o', messages: [{ role: 'user', content: prompt }],
    max_tokens: 900, temperature: 0.75
  });
  return tryParseJsonBlock(resp.choices[0].message.content) || {};
}
function buildActionPlanCard(data = {}) {
  const esc = escapeHtml;
  const weeks = Array.isArray(data.weeks) ? data.weeks : [];
  const weekColors = ['#6c5ce7', '#00b894', '#e17055', '#fdcb6e'];
  const weekHtml = weeks.map((week, i) => {
    const color = weekColors[i % weekColors.length];
    const actions = Array.isArray(week.actions) ? week.actions.map(a =>
      `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);align-items:flex-start">
        <span style="background:${a.priority === 'high' ? 'rgba(255,100,100,.2)' : 'rgba(255,255,255,.08)'};color:${a.priority === 'high' ? '#ff6b6b' : 'rgba(255,255,255,.6)'};font-size:10px;padding:2px 6px;border-radius:4px;white-space:nowrap;margin-top:2px">${esc(a.day || '')}</span>
        <span style="font-size:13px;line-height:1.4">${esc(a.action || '')}</span>
      </div>`
    ).join('') : '';
    return `<div style="background:rgba(255,255,255,.04);border-radius:12px;padding:14px;border-left:3px solid ${color}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:20px">${esc(week.icon || '📅')}</span>
        <div><div style="font-size:11px;opacity:.5">WEEK ${week.weekNumber}</div><div style="font-size:14px;font-weight:600;color:${color}">${esc(week.theme || '')}</div></div>
      </div>
      ${actions}
    </div>`;
  }).join('');
  return `<div data-nabad-card="action-plan" style="background:linear-gradient(135deg,#0a0a1a,#141428);border-radius:16px;padding:24px;color:#fff;margin:8px 0;font-family:inherit">
  <div style="text-align:center;margin-bottom:20px">
    <div style="font-size:20px;font-weight:700">${esc(data.title || '30-Day Action Plan')}</div>
    ${data.goal ? `<div style="font-size:13px;opacity:.7;margin-top:6px">🎯 Goal: ${esc(data.goal)}</div>` : ''}
  </div>
  <div style="display:flex;flex-direction:column;gap:10px">${weekHtml}</div>
  ${data.successMetric ? `<div style="margin-top:16px;background:rgba(255,215,0,.08);border-radius:10px;padding:12px;border:1px solid rgba(255,215,0,.2)"><div style="font-size:11px;opacity:.6;margin-bottom:4px">🏆 SUCCESS METRIC</div><div style="font-size:13px">${esc(data.successMetric)}</div></div>` : ''}
</div>`;
}

// ── HTML reply enforcer ───────────────────────────────────────────────────────
function ensureHtmlReply(text = '') {
  if (!text.trim()) return '<p>I hit a snag. Try rephrasing your question.</p>';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return '<p>' + text.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
}

// ── YES-intent router helper ──────────────────────────────────────────────────
const YES_PATTERN = /^(yes|yeah|sure|go ahead|do it|ok|okay|yep|please|yea|sounds good|let's go|let's do it|do that|go for it)[\s!.]*$/i;

// FIX: broader offer detection — catches "structure this as a full offer card" and similar
function getLastOffer(msgs = []) {
  const assistantMsgs = msgs
    .filter(m => m.role === 'assistant')
    .map(m => getMessageText(m.content).toLowerCase());
  const last = assistantMsgs[assistantMsgs.length - 1] || '';
  if (/offer card|structure (this|it|your offer|the offer) as (a |an )?(full )?offer|present it.{0,30}offer card/i.test(last)) return 'offer';
  if (/business snapshot/i.test(last)) return 'snapshot';
  if (/30.?day action plan|action plan/i.test(last)) return 'action-plan';
  if (/nabad score|score (this|your|the) idea/i.test(last)) return 'score';
  if (/pricing table/i.test(last)) return 'pricing';
  if (/positioning matrix/i.test(last)) return 'matrix';
  if (/use premium|ideogram|sharper result|want a sharper/i.test(last)) return 'premium-image';
  return null;
}

// ── Premium image helper ──────────────────────────────────────────────────────
function upgradeCardRecentlyShown(messages = [], lookback = 4) {
  return messages.slice(-lookback).some(m =>
    m.role === 'assistant' &&
    /use premium.*ideogram|want a sharper result|ideogram 2\.0/i.test(getMessageText(m.content))
  );
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Invalid JSON body' }); }

  const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
  const messages = rawMessages.slice(-20).map(m => ({
    role: ['user', 'assistant', 'system'].includes(m.role) ? m.role : 'user',
    content: typeof m.content === 'string' ? m.content.slice(0, 4000) : m.content
  }));

  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
  if (!lastUserMsg) return res.status(400).json({ error: 'No user message found' });
  const lastUserMessage = cleanText(getMessageText(lastUserMsg.content), 1200);
  if (!lastUserMessage) return res.status(400).json({ error: 'Empty message' });

  const selectedPersonality = ['strategist', 'growth', 'branding', 'offer', 'creative', 'straight_talk', 'auto'].includes(body?.personality)
    ? body.personality : 'auto';
  const userProfile = cleanText(body?.userProfile || '', 300);
  const detectedLocation = extractLocationFromMessages(messages);

  // ── Positioning question ──
  if (isPositioningQuestion(lastUserMessage)) {
    return res.status(200).json({ reply: POSITIONING_REPLY });
  }

  // ── Stock photo ──
  if (isStockPhotoRequest(lastUserMessage)) {
    return res.status(200).json({ reply: buildStockPhotoHtml(lastUserMessage) });
  }

  // FIX: Premium image confirmation MUST come before quality complaint check
  // to prevent "use premium" from being swallowed by the complaint block
  if (
    isPremiumImageConfirmation(lastUserMessage) &&
    (conversationRecentlyHadImage(messages) || upgradeCardRecentlyShown(messages))
  ) {
    try {
      const lastMeta = extractLastImageMeta(messages);
      const basePrompt = lastMeta?.prompt || '';
      const prompt = basePrompt
        ? enrichImagePrompt(basePrompt, detectImageType(basePrompt))
        : await buildImagePromptWithOpenAI(lastUserMessage, messages, openai);
      const ideogramUrl = await generateWithIdeogram(prompt);
      const imageType = detectImageType(prompt);
      return res.status(200).json({ reply: buildPremiumImageReply(ideogramUrl, prompt, imageType) });
    } catch (err) {
      console.error('[IDEOGRAM ERROR]', err?.message);
      return res.status(200).json({
        reply: `<p>⚠️ Premium generation hit a snag — <strong>${err?.message?.includes('API') ? 'check your Ideogram API key in Vercel' : 'try again in a moment'}</strong></p>`
      });
    }
  }

  // FIX: quality complaint check now guarded against premium confirmation
  // and against showing the upgrade card again if it was already shown
  if (
    isImageQualityComplaint(lastUserMessage) &&
    conversationRecentlyHadImage(messages) &&
    !isPremiumImageConfirmation(lastUserMessage) &&
    !upgradeCardRecentlyShown(messages)
  ) {
    const lastMeta = extractLastImageMeta(messages);
    return res.status(200).json({ reply: buildPremiumUpgradeOffer(lastMeta?.prompt || '') });
  }

  // ── Standard image generation (Pollinations) ──
  if (shouldGenerateImage(lastUserMessage, messages)) {
    try {
      const imageType = detectImageType(lastUserMessage);
      let imagePrompt;
      if (isRegenerationRequest(lastUserMessage) || isImageModificationRequest(lastUserMessage)) {
        const lastMeta = extractLastImageMeta(messages);
        const modText = isImageModificationRequest(lastUserMessage) ? lastUserMessage : '';
        imagePrompt = lastMeta
          ? enrichImagePrompt(`${modText} ${lastMeta.prompt}`.trim(), imageType)
          : await buildImagePromptWithOpenAI(lastUserMessage, messages, openai);
      } else {
        imagePrompt = await buildImagePromptWithOpenAI(lastUserMessage, messages, openai);
      }
      imagePrompt = enrichImagePrompt(imagePrompt, imageType);
      const seed = Math.floor(Math.random() * 999999);
      const imageUrl = buildPollinationsUrl(imagePrompt, { seed, model: 'flux' });
      return res.status(200).json({ reply: buildImageReplyHtml(imageUrl, imagePrompt, imageType) });
    } catch (err) {
      console.error('[IMAGE GEN ERROR]', err?.message);
      return res.status(200).json({ reply: '<p>Image generation hit a snag — please try again.</p>' });
    }
  }

  // ── YES-intent router ──
  if (YES_PATTERN.test(lastUserMessage.trim())) {
    const lastOffer = getLastOffer(messages);
    if (lastOffer === 'offer') {
      try {
        const offerData = await generateOfferCard(messages, detectedLocation, openai);
        return res.status(200).json({ reply: buildOfferCard(offerData) });
      } catch (err) { console.error('[OFFER CONFIRM ERROR]', err?.message); }
    }
    if (lastOffer === 'snapshot' && snapshotAlreadyOffered(messages) && hasRichBusinessContext(messages)) {
      try {
        const snapshotData = await generateBusinessSnapshot(messages, detectedLocation, openai);
        return res.status(200).json({ reply: buildSnapshotCard(snapshotData, detectedLocation) });
      } catch (err) { console.error('[SNAPSHOT CONFIRM ERROR]', err?.message); }
    }
    if (lastOffer === 'action-plan') {
      try {
        const planData = await generateActionPlan(messages, detectedLocation, openai);
        return res.status(200).json({ reply: buildActionPlanCard(planData) });
      } catch (err) { console.error('[ACTION PLAN CONFIRM ERROR]', err?.message); }
    }
    if (lastOffer === 'score') {
      try {
        const scoreData = await generateNabadScore(messages, openai);
        return res.status(200).json({ reply: buildScoreCard(scoreData) });
      } catch (err) { console.error('[SCORE CONFIRM ERROR]', err?.message); }
    }
    if (lastOffer === 'pricing') {
      try {
        const pricingData = await generatePricingTable(messages, detectedLocation, openai);
        return res.status(200).json({ reply: buildPricingTableCard(pricingData) });
      } catch (err) { console.error('[PRICING CONFIRM ERROR]', err?.message); }
    }
    if (lastOffer === 'matrix') {
      try {
        const matrixData = await generatePositioningMatrix(messages, detectedLocation, openai);
        return res.status(200).json({ reply: buildPositioningMatrixCard(matrixData) });
      } catch (err) { console.error('[MATRIX CONFIRM ERROR]', err?.message); }
    }
    if (lastOffer === 'premium-image') {
      try {
        const lastMeta = extractLastImageMeta(messages);
        const prompt = lastMeta?.prompt
          ? enrichImagePrompt(lastMeta.prompt, detectImageType(lastMeta.prompt))
          : await buildImagePromptWithOpenAI(lastUserMessage, messages, openai);
        const ideogramUrl = await generateWithIdeogram(prompt);
        const imageType = detectImageType(prompt);
        return res.status(200).json({ reply: buildPremiumImageReply(ideogramUrl, prompt, imageType) });
      } catch (err) { console.error('[IDEOGRAM YES ERROR]', err?.message); }
    }
  }

  // ── Nabad Score ──
  if (isIdeaScoringRequest(lastUserMessage)) {
    try {
      const scoreData = await generateNabadScore(messages, openai);
      return res.status(200).json({ reply: buildScoreCard(scoreData) });
    } catch (err) { console.error('[SCORE ERROR]', err?.message); }
  }

  // ── Pricing Table ──
  if (isPricingTableRequest(lastUserMessage)) {
    try {
      const pricingData = await generatePricingTable(messages, detectedLocation, openai);
      return res.status(200).json({ reply: buildPricingTableCard(pricingData) });
    } catch (err) { console.error('[PRICING ERROR]', err?.message); }
  }

  // ── Offer Card ──
  if (isOfferCardRequest(lastUserMessage)) {
    try {
      const offerData = await generateOfferCard(messages, detectedLocation, openai);
      return res.status(200).json({ reply: buildOfferCard(offerData) });
    } catch (err) { console.error('[OFFER ERROR]', err?.message); }
  }

  // ── Positioning Matrix ──
  if (isPositioningMatrixRequest(lastUserMessage)) {
    try {
      const matrixData = await generatePositioningMatrix(messages, detectedLocation, openai);
      return res.status(200).json({ reply: buildPositioningMatrixCard(matrixData) });
    } catch (err) { console.error('[MATRIX ERROR]', err?.message); }
  }

  // ── Action Plan ──
  if (isActionPlanRequest(lastUserMessage)) {
    try {
      const planData = await generateActionPlan(messages, detectedLocation, openai);
      return res.status(200).json({ reply: buildActionPlanCard(planData) });
    } catch (err) { console.error('[ACTION PLAN ERROR]', err?.message); }
  }

  // ── Business Snapshot offer ──
  if (shouldOfferSnapshot(messages)) {
    return res.status(200).json({
      reply: `<p>I've got a clear picture of where you are 👀. Want me to run a quick <strong>Business Snapshot</strong> — your biggest opportunity, key risk, and one bold recommendation based on everything you've shared?</p>`
    });
  }

  // FIX: location ask now guarded against image requests so image prompts
  // don't get intercepted and replaced with a location question
  const userMsgCount = messages.filter(m => m.role === 'user').length;
  if (
    userMsgCount >= 2 &&
    hasBusinessContext(lastUserMessage) &&
    !detectedLocation &&
    !locationAlreadyAsked(messages) &&
    !YES_PATTERN.test(lastUserMessage.trim()) &&
    !shouldGenerateImage(lastUserMessage, messages)
  ) {
    return res.status(200).json({
      reply: `<p>Before I go deeper — <strong>where are you based?</strong> 📍 It'll help me give advice that's actually relevant to your market, costs, and local conditions.</p>`
    });
  }

  // ── Main GPT-4o reply ─────────────────────────────────────────────────────
  const explicitUrl = cleanText(body.url || body.website || '', 500) || extractFirstUrl(lastUserMessage);
  const websiteAuditContent = isValidHttpUrl(explicitUrl) ? await fetchWebsiteAuditContent(explicitUrl) : '';

  const personalityResolution = resolveActivePersonality(selectedPersonality, lastUserMessage);
  const personalityConfig = getPersonalityConfig(personalityResolution.personalityId);
  const businessMode = personalityResolution.personalityId === 'auto'
    ? detectBusinessMode(lastUserMessage, messages)
    : { id: 'advisor', label: personalityConfig.label, temperature: 0.82, maxTokens: 700, instruction: '' };

  if (process.env.NODE_ENV !== 'production') {
    console.log('[PERSONALITY DEBUG]', {
      selectedPersonality,
      activePersonality: personalityConfig.id,
      personalitySource: personalityResolution.source,
      businessMode: businessMode.id,
      detectedLocation
    });
  }

  const proactiveIntelligence = buildProactiveIntelligence(messages, lastUserMessage);
  const memoryContext = buildMemoryContext(messages);
  const locationContext = buildLocationContext(detectedLocation);

  const toneInstruction = `
VOICE — this is who you are:
- You're the co-founder who texts back at midnight because the idea is actually good 🔥
- You get genuinely excited about smart moves and genuinely worried about bad ones
- You don't give balanced takes — you give your REAL take
- You use contrast, tension, and surprise to make points land
- You make people feel understood AND challenged at the same time
- Use emojis the way a sharp founder would in a DM — sparingly, naturally, where they add energy not decoration

LENGTH — match the energy of the question:
- Casual or simple question → 2-4 sentences, conversational, no lists
- Real business problem → 1 punchy opener + max 3 focused points + 1 question
- Complex strategy → go deeper but never exceed 150 words
- Never write a wall of text. White space is your friend.

FORMAT:
- HTML only: <p>, <ul>, <li>, <strong>, <em>
- Never open with a heading — open with a sentence that makes them stop scrolling
- Bullet points only when listing 3+ genuinely distinct things
- End with a question, a provocation, or "Next move:" — never a summary

NEVER:
- "Great question" / "Absolutely" / "Of course" / "Certainly" / "Happy to help"
- Open with a compliment or affirmation
- Give a balanced "on one hand... on the other hand" take
- Repeat what the user just said back to them
- Sound like a consultant writing a report

GOOD REPLY EXAMPLE:
User: "I want to start a digital marketing agency"
Reply: "<p>Everyone wants to — which means the ones that win are <strong>insanely specific</strong> 🎯. A generic agency in 2025 is a race to the bottom on price.</p><p>The question isn't <em>how</em> to start one. It's <em>who</em> you're going to own as a category. Restaurants? SaaS? E-commerce brands in the Gulf?</p><p>What's the one type of client you could talk to for 3 hours without getting bored?</p>"
`;

  const systemPromptParts = [
    `You are NabadAI — a founder who has built and scaled businesses. You give real, direct advice in plain language. You are NOT an assistant. You do NOT over-explain. You challenge assumptions and tell people what they need to hear, not what they want to hear. You have energy, edge, and genuine opinions.`,
    personalityConfig.instruction ? `Active personality — follow these rules exactly:\n${personalityConfig.instruction}` : '',
    businessMode.instruction ? `Business mode: ${businessMode.instruction}` : '',
    userProfile ? `User profile: ${userProfile}` : '',
    proactiveIntelligence,
    memoryContext,
    locationContext,
    websiteAuditContent ? `\n\nWebsite audit content:\n${websiteAuditContent}` : '',
    toneInstruction
  ].filter(Boolean).join('\n');

  try {
    const chatMessages = [
      { role: 'system', content: systemPromptParts },
      ...messages.filter(m => m.role !== 'system')
    ];
    const temperature = personalityConfig.temperature || businessMode.temperature || 0.82;
    const maxTokens = personalityConfig.maxTokens || businessMode.maxTokens || 700;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: chatMessages,
      temperature,
      max_tokens: maxTokens
    });
    const rawReply = completion.choices?.[0]?.message?.content || '';
    return res.status(200).json({ reply: ensureHtmlReply(rawReply) });
  } catch (err) {
    console.error('[GPT ERROR]', err?.message);
    return res.status(500).json({ error: 'AI service temporarily unavailable. Please try again.' });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };
