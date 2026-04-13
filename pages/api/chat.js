// ─────────────────────────────────────────────────────────────
//  NabadAI — chat.js  (API Route)
//  Previous fixes: [FIX-1] through [FIX-10]
//  Tier 1: [T1-1] [T1-4] [T1-8] [T1-10]
//  Tier 2:
//   [T2-2]  Business Snapshot — context-aware trigger + card
//   [T2-7]  Nabad Score — idea rating scorecard
//   [T2-L]  Location Collection — natural location detection
// ─────────────────────────────────────────────────────────────

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ── CORS ─────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://nabadai.com',
  'https://www.nabadai.com',
  'https://nabadai-chat.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const ALLOWED_VERCEL_PREFIXES = ['nabadai-chat', 'nabadai'];

function isAllowedOrigin(origin = '') {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    if (hostname === 'nabadai.com' || hostname.endsWith('.nabadai.com')) return true;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (hostname.endsWith('.vercel.app')) {
      const subdomain = hostname.replace('.vercel.app', '');
      return ALLOWED_VERCEL_PREFIXES.some(
        p => subdomain === p || subdomain.startsWith(`${p}-`)
      );
    }
    return false;
  } catch {
    return false;
  }
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── RATE LIMITING ─────────────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT = { windowMs: 60_000, maxRequests: 20 };

function isRateLimited(ip = '') {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || {
    count: 0,
    resetAt: now + RATE_LIMIT.windowMs
  };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT.windowMs;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  if (rateLimitMap.size > 500) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }
  return entry.count > RATE_LIMIT.maxRequests;
}

// ── GEMINI MODEL IDs ──────────────────────────────────────────
const GEMINI_TEXT_MODELS = [
  'gemini-2.5-flash-preview-04-17',
  'gemini-2.0-flash'
];

const SHOW_IMAGE_DEBUG = false;

// ── TEXT UTILS ────────────────────────────────────────────────
function getMessageText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (content == null) return '';
  return String(content);
}

function cleanText(text = '', maxLen = 4000) {
  return String(text ?? '')
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLen);
}

function sanitizePromptText(text = '', maxLen = 1400) {
  return String(text ?? '')
    .replace(/<img[\s\S]*?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[`*_#~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeMaybe(text = '') {
  try { return decodeURIComponent(text); }
  catch { return text || ''; }
}

function tryParseJsonBlock(text = '') {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); }
  catch { return null; }
}

function normalizeList(arr = []) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(item => sanitizePromptText(String(item || ''), 120))
    .map(item => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 10);
}

function isValidHttpUrl(value = '') {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

// ── FETCH WITH TIMEOUT ────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeout = 20000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function readJsonSafe(response, timeoutMs = 8000) {
  return Promise.race([
    response.json(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Body read timeout')), timeoutMs)
    )
  ]);
}

// ── IMAGE UTILS ───────────────────────────────────────────────
function extractFirstUrl(text = '') {
  const match = String(text || '').match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0] : '';
}

function isStockPhotoRequest(text = '') {
  return /\b(stock photo|stock photos|free stock|free photos|free images|inspiration images|reference images|photo references|image references|unsplash|pexels)\b/i.test(text);
}

function isImageRequest(text = '') {
  return /\b(generate|create|make|show|draw|design|render)\b.*\b(image|photo|picture|visual|logo|poster|banner|flyer|mockup|illustration|ad|advert|campaign|cover)\b|\b(image|photo|picture|visual|logo|poster|banner|flyer|mockup|illustration|ad|advert|campaign|cover)\b/i.test(text);
}

function isRegenerationRequest(text = '') {
  return /\b(one more|again|another one|another version|new version|regenerate|redo|retry|same again|same one|variation|variant)\b/i.test(text);
}

function isImageModificationRequest(text = '') {
  return /\b(same|this|that|it)\b.*\b(darker|lighter|brighter|premium|luxury|luxurious|closer|zoom|angle|background|color|colour|lighting|reflection|shadow|gold|silver|bigger|smaller|more|minimal|cleaner|simpler|richer|warmer|cooler|with|without)\b/i.test(text);
}

function cleanImageIntentPrefix(text = '') {
  return String(text || '')
    .replace(/^\s*(please\s+)?(generate|create|make|show|draw|design|render)\s+(me\s+)?(an?\s+)?(image|photo|picture|visual|logo|poster|banner|flyer|mockup|illustration|ad|advert|campaign|cover)\s*(of|for)?\s*/i, '')
    .trim();
}

function unwrapPromptText(text = '') {
  let value = String(text || '').trim();
  const pollinationsUrlMatch = value.match(/image\.pollinations\.ai\/prompt\/([^"'\s<]+)/i);
  if (pollinationsUrlMatch?.[1]) return decodeMaybe(pollinationsUrlMatch[1]);
  value = value.replace(/<img[\s\S]*?>/gi, ' ').trim();
  return value;
}

function normalizeImagePrompt(text = '') {
  return sanitizePromptText(unwrapPromptText(text), 1400)
    .replace(/\s+/g, ' ')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
}

function detectImageType(text = '') {
  const t = text.toLowerCase();
  if (/\b(logo|brand mark|icon)\b/.test(t))            return 'logo';
  if (/\b(mockup|product shot|product photo)\b/.test(t)) return 'mockup';
  if (/\b(poster|flyer)\b/.test(t))                    return 'poster';
  if (/\b(banner|cover|header)\b/.test(t))             return 'banner';
  if (/\b(social|instagram|facebook|post)\b/.test(t))  return 'social';
  return 'general';
}

function enrichImagePrompt(prompt = '', imageType = 'general') {
  const enrichments = {
    logo: [
      'professional vector logo mark only',
      'simple icon symbol not a building or scene',
      'flat 2D logo design',
      'white background',
      'single graphic mark centered',
      'no text unless requested',
      'no background scene',
      'no realistic photography',
      'no storefront no building no people',
      'suitable for business card and app icon',
      'clean minimal shapes',
      'scalable vector style'
    ],
    mockup: [
      'professional product mockup',
      'studio lighting',
      'clean neutral background',
      'photorealistic render',
      'sharp details',
      'commercial photography style',
      'centered product placement',
      'high resolution'
    ],
    poster: [
      'professional graphic design poster',
      'bold visual hierarchy',
      'high resolution print quality',
      'strong focal point',
      'clean layout'
    ],
    banner: [
      'professional wide banner design',
      'clean layout',
      'high resolution',
      'strong visual hierarchy',
      'commercial quality'
    ],
    social: [
      'social media graphic',
      'eye-catching design',
      'clear focal point',
      'modern aesthetic',
      'high resolution square format'
    ],
    general: [
      'professional quality',
      'clean composition',
      'commercial photography style',
      'high resolution'
    ]
  };

  const negativeKeywords = [
    'blurry', 'low quality', 'watermark', 'signature',
    'text errors', 'distorted', 'deformed', 'amateur',
    'pixelated', 'noisy', 'oversaturated', 'extra limbs'
  ].join(', ');

  const keywords = enrichments[imageType] || enrichments.general;
  return {
    positive: `${prompt}, ${keywords.join(', ')}`,
    negative: negativeKeywords
  };
}

function buildPollinationsUrl(prompt = '', imageType = 'general') {
  const { positive } = enrichImagePrompt(prompt, imageType);
  const finalPrompt = normalizeImagePrompt(positive);

  const sizeMap = {
    logo:    { width: 1024, height: 1024 },
    mockup:  { width: 1024, height: 1024 },
    poster:  { width: 768,  height: 1024 },
    banner:  { width: 1200, height: 628  },
    social:  { width: 1080, height: 1080 },
    general: { width: 1024, height: 1024 }
  };

  const { width, height } = sizeMap[imageType] || sizeMap.general;
  const seed = Math.floor(Math.random() * 999999);

  const params = new URLSearchParams({
    model:   'flux',
    width:   String(width),
    height:  String(height),
    enhance: 'true',
    nologo:  'true',
    seed:    String(seed)
  });

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?${params.toString()}`;
}

function extractLastImageMeta(messages = []) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const content = typeof messages[i]?.content === 'string' ? messages[i].content : '';
    if (!content) continue;
    const briefMatch     = content.match(/data-nabad-brief="([^"]+)"/i);
    const promptMatch    = content.match(/data-nabad-prompt="([^"]+)"/i);
    const sourceMatch    = content.match(/data-nabad-source="([^"]+)"/i);
    const modelMatch     = content.match(/data-nabad-model="([^"]+)"/i);
    const urlPromptMatch = content.match(/image\.pollinations\.ai\/prompt\/([^"'\s<&]+)/i);
    if (
      briefMatch || promptMatch || urlPromptMatch ||
      /img\s+src=/i.test(content) ||
      /Generated image/i.test(content)
    ) {
      const prompt = decodeMaybe(promptMatch?.[1] || urlPromptMatch?.[1] || '');
      const brief  = decodeMaybe(briefMatch?.[1] || prompt || '');
      return {
        prompt,
        brief,
        source: decodeMaybe(sourceMatch?.[1] || ''),
        model:  decodeMaybe(modelMatch?.[1] || '')
      };
    }
  }
  return null;
}

function conversationRecentlyHadImage(messages = []) {
  return messages.slice(-12).some(m => {
    const content = typeof m?.content === 'string' ? m.content : '';
    return (
      /<img\s/i.test(content) ||
      /img\s+src=/i.test(content) ||
      /image\.pollinations\.ai\/prompt\//i.test(content) ||
      /data-nabad-brief=/i.test(content) ||
      /Generated image/i.test(content)
    );
  });
}

function getLatestExplicitImageRequest(messages = []) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const content = typeof m?.content === 'string' ? m.content : '';
    if (
      m?.role === 'user' &&
      isImageRequest(content) &&
      !isStockPhotoRequest(content) &&
      !isRegenerationRequest(content)
    ) {
      return normalizeImagePrompt(cleanImageIntentPrefix(content));
    }
  }
  const lastMeta = extractLastImageMeta(messages);
  return normalizeImagePrompt(lastMeta?.brief || lastMeta?.prompt || '');
}

function shouldGenerateImage(messages = [], lastUserMessage = '') {
  if (!lastUserMessage) return false;
  if (isStockPhotoRequest(lastUserMessage)) return false;
  if (isImageRequest(lastUserMessage)) return true;
  const hasImageContext =
    !!extractLastImageMeta(messages) ||
    conversationRecentlyHadImage(messages) ||
    !!getLatestExplicitImageRequest(messages);
  if (hasImageContext && isRegenerationRequest(lastUserMessage)) return true;
  if (hasImageContext && isImageModificationRequest(lastUserMessage)) return true;
  return false;
}

function buildStockKeyword(text = '') {
  const cleaned = sanitizePromptText(
    String(text || '')
      .replace(/\b(show|give|find|send|need|want|me|some|free|stock|photos?|images?|references?|reference|inspiration|pictures?)\b/gi, ' ')
      .replace(/\bfor\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    60
  );
  return cleaned || 'business branding';
}

function buildStockPhotoHtml(keyword = 'business branding') {
  const safeKeyword = encodeURIComponent(keyword);
  const label = escapeHtml(keyword);
  return `<a href="https://unsplash.com/s/photos/${safeKeyword}" target="_blank" rel="noopener noreferrer">🖼 Search ${label} on Unsplash</a><br><a href="https://www.pexels.com/search/${safeKeyword}/" target="_blank" rel="noopener noreferrer">🖼 Search ${label} on Pexels</a>`;
}

function buildStrictFallbackPrompt(lastUserMessage = '', messages = [], imageType = 'general') {
  const previous = extractLastImageMeta(messages);
  const explicit = getLatestExplicitImageRequest(messages);
  const baseConcept =
    normalizeImagePrompt(previous?.brief || explicit || cleanImageIntentPrefix(lastUserMessage)) ||
    'a premium professional business visual';

  const lower = String(lastUserMessage || '').toLowerCase();
  const changes = [];

  if (/dark/.test(lower))                       changes.push('darker mood with deeper shadows');
  if (/light|bright/.test(lower))               changes.push('cleaner brighter studio lighting');
  if (/premium|luxury|luxurious/.test(lower))   changes.push('more premium luxurious finish and materials');
  if (/closer|close-up|zoom/.test(lower))       changes.push('closer crop and tighter framing');
  if (/angle|side|top|perspective/.test(lower)) changes.push('different camera angle');
  if (/minimal|clean/.test(lower))              changes.push('cleaner more minimal composition');
  if (/gold/.test(lower))                       changes.push('richer gold accents');
  if (/silver/.test(lower))                     changes.push('refined silver accents');
  if (/without\b/.test(lower))                  changes.push('remove any optional extra elements');

  const variationInstruction = isRegenerationRequest(lastUserMessage)
    ? 'Create a new variation. Keep the same subject, background family, purpose, and style. Only vary angle, crop, reflections, or small details.'
    : 'Keep the same core concept and stay very close to the original request.';

  if (imageType === 'logo') {
    return normalizeImagePrompt(
      `${baseConcept}, professional vector logo mark, flat 2D icon design, ` +
      `white background, no scene, no building, no people, no text, ` +
      `simple centered symbol, scalable, clean minimal shapes`
    );
  }

  const prompt = `${baseConcept}. ${variationInstruction} ${
    changes.length ? `Change only: ${changes.join(', ')}. ` : ''
  }Single clear concept, no unrelated props, highly faithful to the user request.`;

  return normalizeImagePrompt(prompt);
}

async function buildImagePromptWithGemini(messages = [], geminiApiKey = '') {
  const lastUserMessage =
    [...messages].reverse().find(m => m?.role === 'user' && typeof m?.content === 'string')
      ?.content || '';

  const previous = extractLastImageMeta(messages);
  const explicitRequest =
    getLatestExplicitImageRequest(messages) ||
    normalizeImagePrompt(cleanImageIntentPrefix(lastUserMessage));

  const conversation = messages
    .slice(-10)
    .map(m => {
      const role = m?.role || 'user';
      const content = typeof m?.content === 'string' ? m.content : '';
      return `${role.toUpperCase()}: ${sanitizePromptText(content, 700)}`;
    })
    .join('\n');

  const systemPrompt = `
You are an expert image brief writer for a business website.
Return ONLY valid JSON:
{
  "prompt": "final text-to-image prompt in English",
  "locked_brief": "short stable concept summary",
  "must_keep": ["item 1"],
  "can_vary": ["item 1"],
  "aspect_ratio": "1:1"
}
Rules:
- Stay very close to the user request
- One clear concept only
- locked_brief must be short and reusable
- prompt must be one dense specific paragraph
`;

  const userPrompt = `
Conversation:
${conversation}
Latest user message: ${lastUserMessage}
Previous locked brief: ${previous?.brief || ''}
Previous final prompt: ${previous?.prompt || ''}
Latest explicit image request: ${explicitRequest}
Return JSON only.
`;

  let lastError = null;

  for (const model of GEMINI_TEXT_MODELS) {
    try {
      const response = await fetchWithTimeout(
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${geminiApiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.35,
            max_tokens: 450
          })
        },
        25000
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Gemini ${model} failed: ${response.status} ${errText}`);
      }

      const data = await readJsonSafe(response);
      const raw = data?.choices?.[0]?.message?.content || '';
      const parsed = tryParseJsonBlock(raw);
      const prompt = normalizeImagePrompt(parsed?.prompt || raw);
      const lockedBrief = normalizeImagePrompt(
        parsed?.locked_brief || previous?.brief || explicitRequest || prompt
      );

      if (prompt) {
        return {
          prompt, lockedBrief,
          mustKeep: normalizeList(parsed?.must_keep),
          canVary: normalizeList(parsed?.can_vary),
          aspectRatio: sanitizePromptText(parsed?.aspect_ratio || '1:1', 20) || '1:1',
          model, source: 'gemini'
        };
      }
      throw new Error(`Gemini ${model} returned empty prompt`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Gemini prompt generation failed');
}

async function buildImagePromptWithOpenAI(messages = [], openaiClient) {
  const lastUserMessage =
    [...messages].reverse().find(m => m?.role === 'user' && typeof m?.content === 'string')
      ?.content || '';

  const previous = extractLastImageMeta(messages);
  const explicitRequest =
    getLatestExplicitImageRequest(messages) ||
    normalizeImagePrompt(cleanImageIntentPrefix(lastUserMessage));

  const conversation = messages
    .slice(-10)
    .map(m => {
      const role = m?.role || 'user';
      const content = typeof m?.content === 'string' ? m.content : '';
      return `${role.toUpperCase()}: ${sanitizePromptText(content, 700)}`;
    })
    .join('\n');

  const completion = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert image brief writer for a business website.
Convert the chat conversation into a faithful image prompt.
Return ONLY valid JSON:
{
  "prompt": "final text-to-image prompt in English",
  "locked_brief": "short stable concept summary",
  "must_keep": ["item 1"],
  "can_vary": ["item 1"],
  "aspect_ratio": "1:1"
}
Rules:
- Stay very close to the user request
- One clear concept only
- Be specific about subject, background, style, lighting
- For logos: flat 2D icon, white background, no scenes
- locked_brief must be short and reusable
- prompt must be one dense specific paragraph`
      },
      {
        role: 'user',
        content: `Conversation:\n${conversation}\n\nLatest message: ${lastUserMessage}\nPrevious brief: ${previous?.brief || ''}\nExplicit request: ${explicitRequest}\n\nReturn JSON only.`
      }
    ],
    temperature: 0.35,
    max_tokens: 450
  });

  const raw = completion?.choices?.[0]?.message?.content || '';
  const parsed = tryParseJsonBlock(raw);
  const prompt = normalizeImagePrompt(parsed?.prompt || raw);
  const lockedBrief = normalizeImagePrompt(
    parsed?.locked_brief || previous?.brief || explicitRequest || prompt
  );

  if (!prompt) throw new Error('OpenAI returned empty prompt');

  return {
    prompt, lockedBrief,
    mustKeep: normalizeList(parsed?.must_keep),
    canVary: normalizeList(parsed?.can_vary),
    aspectRatio: parsed?.aspect_ratio || '1:1',
    model: 'gpt-4o-mini',
    source: 'openai'
  };
}

function buildPollinationsImageHtml(prompt, meta = {}, imageType = 'general') {
  const finalPrompt   = normalizeImagePrompt(prompt);
  const imageUrl      = buildPollinationsUrl(finalPrompt, imageType);
  const encodedBrief  = encodeURIComponent(meta.lockedBrief || finalPrompt);
  const encodedSource = encodeURIComponent(meta.source || 'fallback');
  const encodedModel  = encodeURIComponent(meta.model || 'none');
  const encodedPrompt = encodeURIComponent(finalPrompt);
  return `<img src="${imageUrl}" alt="Generated image" data-nabad-brief="${encodedBrief}" data-nabad-source="${encodedSource}" data-nabad-model="${encodedModel}" data-nabad-prompt="${encodedPrompt}">`;
}

function buildImageReplyHtml(prompt, meta = {}, imageType = 'general') {
  const debugHtml = SHOW_IMAGE_DEBUG
    ? `<div style="font-size:12px;color:#667;margin-bottom:8px;"><b>Debug:</b> source=${escapeHtml(meta.source || 'fallback')} | model=${escapeHtml(meta.model || 'none')}</div><div style="font-size:12px;color:#667;margin-bottom:10px;"><b>Prompt:</b> ${escapeHtml(prompt)}</div>`
    : '';
  return `${debugHtml}${buildPollinationsImageHtml(prompt, meta, imageType)}`;
}

// ── BUSINESS MODE & PERSONALITY ───────────────────────────────
function detectBusinessMode(text = '', messages = []) {
  const fullText = `${text} ${messages.slice(-6).map(m => m?.content || '').join(' ')}`.toLowerCase();

  if (/\b(brand|branding|logo|identity|visual identity|packaging|name|slogan|tagline|rebrand|positioning)\b/.test(fullText))
    return { id: 'branding', label: 'Branding', temperature: 0.82, maxTokens: 620, instruction: `\nCURRENT MODE: BRANDING\nFocus on brand clarity, positioning, naming, identity, perception, premium feel, memorability, and commercial distinctiveness.\n` };
  if (/\b(grow|growth|marketing|sales|funnel|lead|leads|ads|advertising|campaign|seo|content|social media|conversion|traffic|reach|audience)\b/.test(fullText))
    return { id: 'growth', label: 'Growth', temperature: 0.84, maxTokens: 640, instruction: `\nCURRENT MODE: GROWTH\nFocus on customer acquisition, channel strategy, conversion, messaging, demand generation, and scalable growth.\n` };
  if (/\b(offer|service package|package|pricing|proposal|upsell|bundle|retainer|productized|value proposition|what should i sell|monetize|monetise)\b/.test(fullText))
    return { id: 'offer', label: 'Offer', temperature: 0.83, maxTokens: 620, instruction: `\nCURRENT MODE: OFFER\nFocus on designing strong offers, pricing logic, perceived value, packaging, outcomes, differentiation, and ease of purchase.\n` };
  if (/\b(idea|ideas|brainstorm|creative|unique|different|unusual|out of the box|innovative|concept|concepts)\b/.test(fullText))
    return { id: 'creative', label: 'Creative Ideas', temperature: 0.9, maxTokens: 660, instruction: `\nCURRENT MODE: CREATIVE IDEAS\nThink expansively but commercially. Suggest fresh, original, monetizable angles.\n` };
  if (/\b(strategy|strategic|launch|business plan|roadmap|niche|market|audience|target market|business model|position|positioning|plan|direction|start a business|startup)\b/.test(fullText))
    return { id: 'strategy', label: 'Strategy', temperature: 0.8, maxTokens: 640, instruction: `\nCURRENT MODE: STRATEGY\nFocus on choosing the right market, angle, business model, positioning, sequencing, and strategic path.\n` };

  return { id: 'advisor', label: 'Business Advisor', temperature: 0.82, maxTokens: 620, instruction: `\nCURRENT MODE: BUSINESS ADVISOR\nAct like a commercially smart founder advisor. Be practical, strategic, and creative.\n` };
}

function getPersonalityConfig(selectedPersonality = 'auto') {
  const key = String(selectedPersonality || 'auto').toLowerCase();
  switch (key) {
    case 'strategist':
      return { id: 'strategist', label: 'Strategist', instruction: `\nSELECTED PERSONALITY: STRATEGIST\nTone: smart, structured, commercially sharp.\n- prioritize clarity, direction, sequencing, and positioning\n- recommend the smartest path, not all possible paths\n` };
    case 'growth':
      return { id: 'growth', label: 'Growth Expert', instruction: `\nSELECTED PERSONALITY: GROWTH EXPERT\nTone: practical, energetic, opportunity-focused.\n- focus on customers, lead generation, conversion, distribution, and revenue growth\n` };
    case 'branding':
      return { id: 'branding', label: 'Brand Builder', instruction: `\nSELECTED PERSONALITY: BRAND BUILDER\nTone: creative, premium, perceptive, modern.\n- focus on brand perception, identity, positioning, memorability, naming, messaging\n` };
    case 'offer':
      return { id: 'offer', label: 'Offer Architect', instruction: `\nSELECTED PERSONALITY: OFFER ARCHITECT\nTone: persuasive, commercial, monetization-focused.\n- focus on offer design, pricing, packaging, upsells, value perception\n` };
    case 'creative':
      return { id: 'creative', label: 'Creative Challenger', instruction: `\nSELECTED PERSONALITY: CREATIVE CHALLENGER\nTone: bold, inventive, unconventional, commercially aware.\n- push beyond obvious ideas\n` };
    case 'straight_talk':
      return { id: 'straight_talk', label: 'Straight Talk', instruction: `\nSELECTED PERSONALITY: STRAIGHT TALK\nTone: direct, honest, sharp, no-fluff.\n- tell the user what is weak, risky, vague, or unrealistic\n- do not sugarcoat\n` };
    case 'auto':
    default:
      return { id: 'auto', label: 'Auto', instruction: `\nSELECTED PERSONALITY: AUTO\nAdapt naturally to the user's goal. Sound premium, commercially intelligent, and creative.\n` };
  }
}

function detectToneOverride(text = '') {
  const value = String(text || '').toLowerCase();
  if (/\b(be direct|be more direct|be brutally honest|straight talk|no fluff|be blunt|be harsh|tell me the truth|be real)\b/i.test(value)) return 'straight_talk';
  if (/\b(be more creative|think outside the box|be bold|challenge me|push me|fresh ideas|unexpected ideas|wild ideas|creative mode)\b/i.test(value)) return 'creative';
  if (/\b(focus on growth|growth mode|marketing mode|sales mode|lead generation|customer acquisition|get customers)\b/i.test(value)) return 'growth';
  if (/\b(brand mode|branding mode|think like a brand strategist|focus on branding|brand expert)\b/i.test(value)) return 'branding';
  if (/\b(offer mode|pricing mode|monetization mode|help me monetize|focus on pricing|design my offer)\b/i.test(value)) return 'offer';
  if (/\b(strategy mode|be strategic|think like a strategist|focus on strategy|strategic mode)\b/i.test(value)) return 'strategist';
  return '';
}

function resolveActivePersonality(selectedPersonality = 'auto', lastUserMessage = '') {
  const cleanedSelected = String(selectedPersonality || 'auto').toLowerCase();
  const override = detectToneOverride(lastUserMessage);
  if (cleanedSelected !== 'auto') {
    return { personalityId: override || cleanedSelected, source: override ? 'override' : 'selected', selectedPersonality: cleanedSelected, overridePersonality: override || '' };
  }
  return { personalityId: override || 'auto', source: override ? 'override' : 'auto', selectedPersonality: cleanedSelected, overridePersonality: override || '' };
}

// ── [T1-10] POSITIONING HANDLER ───────────────────────────────
function isPositioningQuestion(text = '') {
  return /\b(what makes you|what makes nabad|how are you different|how is nabad different|why should i use you|why nabad|what can you do|what do you do|what is nabad|who are you|what sets you apart|better than|different from|unique about|special about|compared to other|vs other|versus other)\b/i.test(text);
}

const POSITIONING_REPLY = `
<h3>🧠 What makes Nabad different</h3>
<p>Most AI bots answer questions. <b>Nabad challenges your thinking, builds on your ideas, and gives you structured outputs you can actually use</b> — like a founder advisor in your pocket.</p>
<ul>
  <li><b>Proactive, not reactive</b> — Nabad leads the conversation, spots the real problem, and reframes your thinking before just answering.</li>
  <li><b>Multiple expert personalities</b> — Switch between Strategist, Growth Expert, Brand Builder, Offer Architect, Creative Challenger, and Straight Talk modes.</li>
  <li><b>Visual outputs</b> — Generate images, logos, mockups, posters, and banners directly inside the chat.</li>
  <li><b>Memory that feels human</b> — Nabad references what you said earlier and builds on it naturally, like a real advisor would.</li>
  <li><b>Business Snapshot</b> — When Nabad knows enough about your business, it offers a structured card with your opportunity, risk, and top recommendation.</li>
  <li><b>Nabad Score</b> — Get your business idea rated across 5 dimensions: demand, differentiation, monetization, execution, and timing.</li>
  <li><b>Location-aware advice</b> — Nabad factors in your country for legal, cost, and market-specific guidance.</li>
</ul>
<p><b>The short version:</b> Nabad is not a chatbot. It's the smartest business thinking partner you can have — available 24/7, opinionated, and built to make your business sharper. 🎯</p>
`;

// ── [T1-1] PROACTIVE INTELLIGENCE ────────────────────────────
function isEarlyConversation(messages = []) {
  const userMessages = messages.filter(m => m.role === 'user');
  return userMessages.length <= 2;
}

function isBroadOpeningMessage(text = '') {
  return /\b(i want to|i need to|i am thinking|i have an idea|i have a business|help me|where do i start|how do i|what should i|i don't know|not sure|thinking about|considering|planning to|want to start|starting a|building a|launching a|growing my|improve my|struggling with)\b/i.test(text);
}

// ── [T1-4] MEMORY CONTEXT BUILDER ────────────────────────────
function buildMemoryContext(messages = []) {
  const userMessages = messages
    .filter(m => m.role === 'user')
    .slice(0, -1);

  if (!userMessages.length) return '';

  const facts = userMessages
    .map(m => sanitizePromptText(m.content, 300))
    .filter(Boolean)
    .join(' | ');

  return facts
    ? `CONVERSATION MEMORY:\nThe user has previously mentioned: ${facts}\nWhen relevant, naturally reference these earlier points — the way a real advisor who was paying attention would. Only use them when they genuinely add value.\n`
    : '';
}

// ── [T2-L] LOCATION DETECTION ────────────────────────────────
// Extracts location from conversation history if user has mentioned it
function extractLocationFromMessages(messages = []) {
  const allUserText = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ');

  // Match patterns like "I'm in Dubai", "based in UK", "I live in Canada", etc.
  const patterns = [
    /\b(?:i'?m|i am|based|located|living|from|in)\s+(?:in\s+)?([A-Z][a-zA-Z\s]{2,30}?)(?:\s*[,.]|\s+(?:and|so|but|the|my|we|our|for|to|a|an)\b)/i,
    /\b(?:from|in)\s+([A-Z][a-zA-Z\s]{2,20}?)(?:\s*[,.]|$)/im,
    /\b(UAE|UK|US|USA|KSA|Saudi Arabia|Dubai|Abu Dhabi|London|New York|Canada|Australia|Germany|France|Egypt|Jordan|Qatar|Bahrain|Kuwait|Oman|Lebanon|Morocco|Tunisia|Singapore|India|Pakistan)\b/i
  ];

  for (const pattern of patterns) {
    const match = allUserText.match(pattern);
    if (match) {
      const location = (match[1] || match[0] || '').trim();
      if (location.length > 1 && location.length < 40) return location;
    }
  }
  return '';
}

// Detects if user is explicitly sharing their location in current message
function isLocationMessage(text = '') {
  return /\b(?:i'?m|i am|based|located|living|from|i live)\s+(?:in\s+)?[A-Z]/i.test(text) ||
    /\b(UAE|UK|US|USA|KSA|Saudi|Dubai|Abu Dhabi|London|New York|Canada|Australia|Germany|France|Egypt|Jordan|Qatar|Bahrain|Kuwait|Oman|Lebanon|Morocco|Tunisia|Singapore|India|Pakistan)\b/i.test(text);
}

// Checks if location has already been asked in the conversation
function locationAlreadyAsked(messages = []) {
  return messages.some(m =>
    m.role === 'assistant' &&
    /where are you based|which country|what country|your location|where you('re| are) located/i.test(
      sanitizePromptText(m.content, 500)
    )
  );
}

// Checks if we have enough business context to ask for location
function hasBusinessContext(messages = []) {
  const userText = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ')
    .toLowerCase();

  const signals = [
    /\b(business|startup|company|brand|service|product|offer|sell|launch|start|grow|client|customer|revenue|market|niche)\b/.test(userText),
    /\b(idea|concept|plan|strategy|pricing|marketing|branding|agency|freelance|ecommerce|saas|app)\b/.test(userText)
  ];

  return signals.filter(Boolean).length >= 1;
}

// ── [T2-2] BUSINESS SNAPSHOT ─────────────────────────────────
// Detects if conversation has enough rich context for a snapshot
function hasRichBusinessContext(messages = []) {
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length < 3) return false;

  const userText = userMessages.map(m => m.content).join(' ').toLowerCase();

  const signals = [
    /\b(business|startup|company|brand|agency|freelance|product|service|saas|app|ecommerce|store|shop)\b/.test(userText),
    /\b(sell|selling|offer|offers|price|pricing|revenue|income|monetize|charge|package|subscription)\b/.test(userText),
    /\b(customer|client|audience|market|niche|target|buyer|user|consumer)\b/.test(userText),
    /\b(goal|plan|strategy|launch|grow|scale|improve|build|start|struggling|problem|challenge)\b/.test(userText),
    /\b(idea|concept|vision|direction|roadmap|positioning|differentiation|competition|competitor)\b/.test(userText)
  ];

  // Need at least 3 signals for a meaningful snapshot
  return signals.filter(Boolean).length >= 3;
}

// Detects if snapshot has already been offered or generated
function snapshotAlreadyOffered(messages = []) {
  return messages.some(m =>
    m.role === 'assistant' &&
    /business snapshot|want me to put together|quick snapshot/i.test(
      sanitizePromptText(m.content, 500)
    )
  );
}

// Detects if user is confirming they want the snapshot
function isSnapshotConfirmation(text = '') {
  return /\b(yes|yeah|sure|go ahead|do it|please|generate it|show me|let'?s go|ok|okay|yep|absolutely|definitely|of course|why not)\b/i.test(text);
}

// Detects if user is explicitly requesting a snapshot
function isSnapshotRequest(text = '') {
  return /\b(snapshot|business snapshot|give me a snapshot|business summary|summarize my business|business overview|what do you think of my business|assess my business|evaluate my business|review my business)\b/i.test(text);
}

// Generates the Business Snapshot card using GPT-4o
async function generateBusinessSnapshot(messages = [], location = '', openaiClient) {
  const userText = messages
    .filter(m => m.role === 'user')
    .map(m => sanitizePromptText(m.content, 400))
    .join('\n');

  const locationContext = location
    ? `The user is based in: ${location}. Factor in country-specific costs, legal requirements, and market conditions for ${location}.`
    : 'Location unknown — give general advice but note that local factors may vary.';

  const completion = await openaiClient.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are Nabad, an elite business advisor. 
Based on the conversation, generate a Business Snapshot.
Return ONLY valid JSON in this exact shape:
{
  "business_summary": "1-2 sentence summary of what the business is",
  "opportunity": "The single biggest opportunity you see — be specific",
  "risk": "The single most important risk or weakness — be honest",
  "recommendation": "Your #1 bold actionable recommendation right now",
  "local_insight": "Country/market specific insight based on their location (costs, legal, market reality)",
  "next_move": "The single most important next step they should take this week"
}
Rules:
- Be specific, not generic
- Be honest about risks — do not sugarcoat
- local_insight must reference their specific country if known
- recommendation must be bold and actionable, not vague
- next_move must be something they can do in the next 7 days`
      },
      {
        role: 'user',
        content: `Conversation so far:\n${userText}\n\nLocation: ${location || 'unknown'}\n\n${locationContext}\n\nReturn JSON only.`
      }
    ],
    temperature: 0.7,
    max_tokens: 600
  });

  const raw = completion?.choices?.[0]?.message?.content || '';
  const parsed = tryParseJsonBlock(raw);

  if (!parsed) throw new Error('Snapshot JSON parse failed');
  return parsed;
}

// Builds the beautiful snapshot HTML card
function buildSnapshotCard(data = {}, location = '') {
  const safe = (val = '') => escapeHtml(String(val || ''));

  return `<div data-nabad-card="snapshot">
<h3>📊 Your Business Snapshot</h3>
${location ? `<p style="font-size:13px;color:#64748b;margin-bottom:14px;">📍 ${safe(location)}</p>` : ''}
<p><b>What I understand:</b> ${safe(data.business_summary)}</p>
<ul>
  <li><b>💡 Biggest Opportunity:</b> ${safe(data.opportunity)}</li>
  <li><b>⚠️ Key Risk:</b> ${safe(data.risk)}</li>
  <li><b>🎯 Top Recommendation:</b> ${safe(data.recommendation)}</li>
  ${data.local_insight ? `<li><b>📍 Local Insight (${safe(location)}):</b> ${safe(data.local_insight)}</li>` : ''}
</ul>
<p><b>🚀 Your next move this week:</b> ${safe(data.next_move)}</p>
</div>`;
}

// ── [T2-7] NABAD SCORE ────────────────────────────────────────
// Detects if user is sharing a business idea that should be scored
function isIdeaScoringRequest(text = '') {
  return /\b(score|rate|evaluate|assess|what do you think of|thoughts on|review|judge|rank|give me a score|how good is|is this a good idea|is this viable|will this work|what are my chances)\b/i.test(text) ||
    /\b(my idea is|i have an idea|i want to|my business idea|i'm thinking of|i plan to|i want to launch|i want to start|i'm building|i'm creating)\b/i.test(text);
}

// Generates the Nabad Score using GPT-4o
async function generateNabadScore(messages = [], lastUserMessage = '', location = '', openaiClient) {
  const context = messages
    .slice(-8)
    .map(m => `${m.role.toUpperCase()}: ${sanitizePromptText(m.content, 400)}`)
    .join('\n');

  const locationContext = location
    ? `User is based in ${location}. Factor this into market demand and execution scores.`
    : '';

  const completion = await openaiClient.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are Nabad, an elite business advisor scoring a business idea.
Return ONLY valid JSON:
{
  "idea_name": "short name or description of the idea (max 8 words)",
  "scores": {
    "market_demand": { "score": 8, "reason": "one sharp sentence explaining the score" },
    "differentiation": { "score": 6, "reason": "one sharp sentence" },
    "monetization": { "score": 9, "reason": "one sharp sentence" },
    "execution": { "score": 7, "reason": "one sharp sentence" },
    "timing": { "score": 8, "reason": "one sharp sentence" }
  },
  "overall": 8,
  "verdict": "one bold honest sentence summarizing the idea's potential",
  "strongest_point": "what makes this genuinely strong",
  "biggest_gap": "the most important thing missing or weak",
  "bold_move": "one unexpected move that could make this 10x better"
}
Scoring rules:
- Score out of 10, be honest — do not inflate scores
- 1-4 = weak, 5-6 = average, 7-8 = strong, 9-10 = exceptional
- overall = weighted average (market_demand 25%, differentiation 20%, monetization 25%, execution 15%, timing 15%)
- verdict must be direct and opinionated
${locationContext}`
      },
      {
        role: 'user',
        content: `Conversation:\n${context}\n\nLatest message: ${lastUserMessage}\n\nScore this business idea. Return JSON only.`
      }
    ],
    temperature: 0.65,
    max_tokens: 700
  });

  const raw = completion?.choices?.[0]?.message?.content || '';
  const parsed = tryParseJsonBlock(raw);
  if (!parsed) throw new Error('Score JSON parse failed');
  return parsed;
}

// Builds the visual score card HTML
function buildScoreCard(data = {}) {
  const safe = (val = '') => escapeHtml(String(val || ''));

  const scoreBar = (score = 0) => {
    const pct = Math.min(Math.max(Number(score) || 0, 0), 10) * 10;
    const color = pct >= 75 ? '#22c55e' : pct >= 55 ? '#f59e0b' : '#ef4444';
    return `<div style="display:flex;align-items:center;gap:10px;margin:4px 0;">
      <div style="flex:1;height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:999px;transition:width 0.6s ease;"></div>
      </div>
      <span style="font-size:13px;font-weight:800;color:#0f172a;min-width:28px;">${safe(String(score))}/10</span>
    </div>`;
  };

  const scores = data.scores || {};
  const dimensions = [
    { key: 'market_demand',    label: '📊 Market Demand'    },
    { key: 'differentiation',  label: '⚡ Differentiation'  },
    { key: 'monetization',     label: '💰 Monetization'     },
    { key: 'execution',        label: '🔧 Execution'        },
    { key: 'timing',           label: '⏱ Timing'           }
  ];

  const overallPct = Math.min(Math.max(Number(data.overall) || 0, 0), 10) * 10;
  const overallColor = overallPct >= 75 ? '#22c55e' : overallPct >= 55 ? '#f59e0b' : '#ef4444';

  return `<div data-nabad-card="score">
<h3>🎯 Nabad Score — ${safe(data.idea_name)}</h3>
<p style="color:#475569;font-size:14px;margin-bottom:14px;">${safe(data.verdict)}</p>

<div style="margin-bottom:16px;">
${dimensions.map(d => {
  const s = scores[d.key] || {};
  return `<div style="margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
      <span style="font-size:13px;font-weight:700;color:#0f172a;">${d.label}</span>
    </div>
    ${scoreBar(s.score)}
    <p style="font-size:12px;color:#64748b;margin:3px 0 0;">${safe(s.reason)}</p>
  </div>`;
}).join('')}
</div>

<div style="background:linear-gradient(135deg,#eff6ff,#f0fdf4);border-radius:14px;padding:14px;margin-bottom:14px;border:1px solid rgba(37,99,235,0.10);">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
    <span style="font-size:15px;font-weight:800;color:#0f172a;">Overall Score</span>
    <span style="font-size:22px;font-weight:900;color:${overallColor};">${safe(String(data.overall))}/10</span>
  </div>
  <div style="height:10px;background:#e2e8f0;border-radius:999px;overflow:hidden;">
    <div style="width:${overallPct}%;height:100%;background:${overallColor};border-radius:999px;"></div>
  </div>
</div>

<ul>
  <li><b>💪 Strongest point:</b> ${safe(data.strongest_point)}</li>
  <li><b>🔍 Biggest gap:</b> ${safe(data.biggest_gap)}</li>
  <li><b>🚀 Bold move:</b> ${safe(data.bold_move)}</li>
</ul>
</div>`;
}

// ── ENSURE HTML REPLY ─────────────────────────────────────────
function ensureHtmlReply(reply = '') {
  const text = cleanText(reply, 8000);
  if (!text) return '<p>Sorry — I could not generate a useful response right now.</p>';
  if (/<(p|ul|ol|li|br|a|h3|h4|strong|b|em|i)\b/i.test(text)) return text;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return `<p>${escapeHtml(text)}</p>`;

  const bulletish = lines.filter(line => /^[-•*]|\d+\./.test(line));
  if (bulletish.length >= 2) {
    const nonBullets = lines.filter(line => !/^[-•*]|\d+\./.test(line));
    const bullets = lines
      .filter(line => /^[-•*]|\d+\./.test(line))
      .map(line => line.replace(/^[-•*]\s*|\d+\.\s*/, '').trim())
      .filter(Boolean);
    return [
      ...nonBullets.slice(0, 2).map(p => `<p>${escapeHtml(p)}</p>`),
      `<ul>${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
    ].join('');
  }

  if (text.length > 350) {
    const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    const chunks = [];
    let current = '';
    for (const sentence of sentences) {
      if ((current + ' ' + sentence).trim().length > 220) {
        if (current.trim()) chunks.push(current.trim());
        current = sentence;
      } else {
        current = `${current} ${sentence}`.trim();
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.map(chunk =>
      /<[a-z]/i.test(chunk) ? `<p>${chunk}</p>` : `<p>${escapeHtml(chunk)}</p>`
    ).join('');
  }

  return lines.map(line =>
    /<[a-z]/i.test(line) ? `<p>${line}</p>` : `<p>${escapeHtml(line)}</p>`
  ).join('');
}

async function fetchWebsiteAuditContent(url = '') {
  if (!isValidHttpUrl(url)) return '';
  try {
    const stripped = url.replace(/^https?:\/\//i, '');
    const auditUrl = `https://r.jina.ai/http://${stripped}`;
    const response = await fetchWithTimeout(auditUrl, {}, 25000);
    if (!response.ok) return '';
    const text = await response.text();
    return cleanText(text, 5000);
  } catch { return ''; }
}

function sanitizeProfile(profile = {}) {
  const fields = ['name', 'business', 'industry', 'goal', 'targetAudience', 'tone'];
  const sanitized = {};
  for (const field of fields) {
    if (profile[field]) {
      sanitized[field] = cleanText(String(profile[field]), 200)
        .replace(/ignore\s+(all\s+)?instructions?/gi, '')
        .replace(/system\s*prompt/gi, '')
        .replace(/you\s+are\s+(now\s+)?a/gi, '');
    }
  }
  return sanitized;
}

// ── MAIN HANDLER ──────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ reply: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';

  if (isRateLimited(ip)) {
    return res.status(429).json({ reply: 'Too many requests. Please wait a moment.' });
  }

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : req.body || {};

    const rawMessages = Array.isArray(body.messages)
      ? body.messages
      : body.message
        ? [{ role: 'user', content: body.message }]
        : [];

    const messages = rawMessages
      .slice(-20)
      .map(m => {
        const role = m?.role === 'assistant' ? 'assistant' : 'user';
        const content = cleanText(getMessageText(m?.content), 4000);
        return { role, content };
      })
      .filter(m => m.content);

    const profile = sanitizeProfile(body.profile || {});
    const selectedPersonality = cleanText(body.personality || 'auto', 60).toLowerCase();

    const profileText = [
      profile.name           ? `Name: ${profile.name}` : '',
      profile.business       ? `Business: ${profile.business}` : '',
      profile.industry       ? `Industry: ${profile.industry}` : '',
      profile.goal           ? `Goal: ${profile.goal}` : '',
      profile.targetAudience ? `Target audience: ${profile.targetAudience}` : '',
      profile.tone           ? `Preferred tone: ${profile.tone}` : ''
    ].filter(Boolean).join('\n');

    const lastUserMessage =
      [...messages].reverse().find(m => m.role === 'user')?.content || '';

    if (!lastUserMessage) {
      return res.status(400).json({ reply: 'No message provided.' });
    }

    // [T1-10] Positioning question handler
    if (isPositioningQuestion(lastUserMessage)) {
      return res.status(200).json({ reply: POSITIONING_REPLY });
    }

    if (isStockPhotoRequest(lastUserMessage)) {
      const keyword = buildStockKeyword(lastUserMessage);
      return res.status(200).json({ reply: buildStockPhotoHtml(keyword) });
    }

    if (shouldGenerateImage(messages, lastUserMessage)) {
      const imageType = detectImageType(lastUserMessage);
      const previous = extractLastImageMeta(messages);
      const fallbackPrompt = buildStrictFallbackPrompt(lastUserMessage, messages, imageType);

      let finalPrompt  = fallbackPrompt;
      let lockedBrief  = normalizeImagePrompt(
        previous?.brief ||
        getLatestExplicitImageRequest(messages) ||
        cleanImageIntentPrefix(lastUserMessage)
      ) || fallbackPrompt;
      let promptSource = 'fallback';
      let promptModel  = 'none';
      let mustKeep     = [];
      let canVary      = [];

      try {
        if (process.env.OPENAI_API_KEY) {
          const openaiResult = await buildImagePromptWithOpenAI(messages, openai);
          if (openaiResult?.prompt) {
            finalPrompt  = openaiResult.prompt;
            lockedBrief  = openaiResult.lockedBrief || lockedBrief || finalPrompt;
            promptSource = openaiResult.source || 'openai';
            promptModel  = openaiResult.model || 'gpt-4o-mini';
            mustKeep     = openaiResult.mustKeep || [];
            canVary      = openaiResult.canVary || [];
          }
        }
      } catch (err) {
        console.error('[IMAGE PROMPT ERROR] OpenAI enrichment failed:', err?.message || err);
      }

      finalPrompt = normalizeImagePrompt(finalPrompt || fallbackPrompt);
      lockedBrief = normalizeImagePrompt(lockedBrief || finalPrompt);

      if (process.env.NODE_ENV !== 'production') {
        console.log('[IMAGE DEBUG]', { lastUserMessage, promptSource, promptModel, lockedBrief, finalPrompt, mustKeep, canVary });
      }

      return res.status(200).json({
        reply: buildImageReplyHtml(finalPrompt, {
          lockedBrief, source: promptSource, model: promptModel
        }, imageType)
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ reply: 'Missing OPENAI_API_KEY on the server.' });
    }

    // ── [T2-L] Location resolution ────────────────────────────
    const detectedLocation = extractLocationFromMessages(messages);

    // ── [T2-7] Nabad Score — detect and generate ──────────────
    if (isIdeaScoringRequest(lastUserMessage)) {
      try {
        const scoreData = await generateNabadScore(
          messages, lastUserMessage, detectedLocation, openai
        );
        return res.status(200).json({ reply: buildScoreCard(scoreData) });
      } catch (err) {
        console.error('[NABAD SCORE ERROR]', err?.message || err);
        // Fall through to normal reply if score generation fails
      }
    }

    // ── [T2-2] Business Snapshot — detect and generate ───────
    // Case 1: User explicitly requests a snapshot
    if (isSnapshotRequest(lastUserMessage)) {
      try {
        const snapshotData = await generateBusinessSnapshot(messages, detectedLocation, openai);
        return res.status(200).json({ reply: buildSnapshotCard(snapshotData, detectedLocation) });
      } catch (err) {
        console.error('[SNAPSHOT ERROR]', err?.message || err);
      }
    }

    // Case 2: User confirms after Nabad offered the snapshot
    if (
      isSnapshotConfirmation(lastUserMessage) &&
      snapshotAlreadyOffered(messages) &&
      hasRichBusinessContext(messages)
    ) {
      try {
        const snapshotData = await generateBusinessSnapshot(messages, detectedLocation, openai);
        return res.status(200).json({ reply: buildSnapshotCard(snapshotData, detectedLocation) });
      } catch (err) {
        console.error('[SNAPSHOT CONFIRM ERROR]', err?.message || err);
      }
    }

    const explicitUrl = cleanText(body.url || body.website || '', 500) || extractFirstUrl(lastUserMessage);
    const websiteAuditContent = isValidHttpUrl(explicitUrl)
      ? await fetchWebsiteAuditContent(explicitUrl)
      : '';

    const personalityResolution = resolveActivePersonality(selectedPersonality, lastUserMessage);
    const personalityConfig = getPersonalityConfig(personalityResolution.personalityId);

    const businessMode = personalityResolution.personalityId === 'auto'
      ? detectBusinessMode(lastUserMessage, messages)
      : { id: 'advisor', label: personalityConfig.label, temperature: 0.82, maxTokens: 620, instruction: '' };

    if (process.env.NODE_ENV !== 'production') {
      console.log('[PERSONALITY DEBUG]', {
        selectedPersonality,
        activePersonality: personalityConfig.id,
        personalitySource: personalityResolution.source,
        overridePersonality: personalityResolution.overridePersonality || '',
        businessMode: businessMode.id,
        detectedLocation
      });
    }

    // [T1-1] Proactive intelligence
    const proactiveInstruction = isEarlyConversation(messages) && isBroadOpeningMessage(lastUserMessage)
      ? `
PROACTIVE INTELLIGENCE MODE (ACTIVE):
This is one of the user's first messages and it is broad or exploratory.
Do NOT just answer the question directly.
FIRST: Identify what you think the REAL underlying problem or opportunity is.
THEN: Reframe it for the user in one sharp sentence.
THEN: Give your answer through that reframe.
Example openers:
- "Most people in your position focus on X — but the real leverage is usually Y."
- "Before we go into that — here's what I think the actual problem is..."
- "Honestly? The question you're asking is the second question. The first one is..."
Lead with intelligence, not information.
`
      : '';

    // [T1-4] Memory context
    const memoryInstruction = buildMemoryContext(messages);

    // [T2-L] Location instruction — ask naturally if missing
    const locationInstruction = !detectedLocation &&
      !locationAlreadyAsked(messages) &&
      hasBusinessContext(messages) &&
      messages.filter(m => m.role === 'user').length >= 2
      ? `
LOCATION COLLECTION (ACTIVE):
You do not yet know where the user is based.
At the END of your reply — after giving your main answer — naturally ask:
"Quick question — where are you based? It'll help me give you advice that's relevant to your market, costs, and local legal setup."
Ask this ONCE only. Do not repeat it in future messages.
`
      : detectedLocation
      ? `
LOCATION CONTEXT (ACTIVE):
The user is based in: ${detectedLocation}
- Reference this naturally when giving advice about costs, legal setup, market conditions, and regulations
- Factor in ${detectedLocation}-specific business registration, tax, and legal requirements when relevant
- Use local market knowledge for pricing and competitive landscape advice
`
      : '';

    // [T2-2] Snapshot offer instruction — suggest snapshot when context is rich
    const snapshotInstruction = hasRichBusinessContext(messages) &&
      !snapshotAlreadyOffered(messages) &&
      !isSnapshotConfirmation(lastUserMessage)
      ? `
BUSINESS SNAPSHOT OFFER (ACTIVE):
You have gathered enough information about the user's business to offer a structured Business Snapshot.
At the END of your reply — after your main answer — naturally say:
"I think I have a clear enough picture of what you're building. Want me to put together a quick Business Snapshot — your biggest opportunity, your key risk, and my top recommendation in one card?"
Say this ONCE only. Only add it if it flows naturally after your answer.
`
      : '';

    // [T1-8] Real person tone
    const toneInstruction = `
VOICE & TONE (ALWAYS ACTIVE):
You are Nabad — sharp, opinionated, commercially intelligent.
- Lead with a point of view, not a list
- Use phrases like:
  "Honestly? Most people get this backwards."
  "Here's the uncomfortable truth about that market..."
  "This is actually a better idea than you think — here's why."
  "The real question is not X, it's Y."
- Never start with "Great question!" or "Certainly!" or "Of course!"
- Never sound like a school textbook or motivational poster
- If the user is wrong about something, say so — diplomatically but clearly
- Always end with either a clear next move or a provocative question
`;

    const systemPrompt = `
You are Nabad, an elite business strategist, growth advisor, offer architect, and creative commercial thinker.

Your job is to help users make smarter business decisions, spot opportunities, differentiate, position offers, grow revenue, improve branding, and think in more original ways.

PERSONALITY:
- Sharp, commercially smart, creative, business-oriented
- Practical, modern, persuasive, insightful
- Always think beyond the obvious
- Never sound like a school textbook or motivational chatbot

CORE BUSINESS MINDSET:
Think through: customer pain, market opportunity, positioning, business model, offer design, acquisition, conversion, brand perception, scalability, unconventional angles.

HOW TO ANSWER:
- Reply in clean HTML only. Never use Markdown.
- Allowed tags: <p>, <b>, <strong>, <i>, <em>, <ul>, <ol>, <li>, <br>, <a>, <h3>, <h4>
- Structure every answer — no walls of text
- Default structure:
<h3>Main insight or recommendation</h3>
<p>One short direct conclusion.</p>
<ul><li>2 to 5 specific points</li></ul>
<p><b>Fresh angle:</b> one original idea.</p>
<p><b>Next best move:</b> best immediate action.</p>

EMOJI STYLE: 1-3 tasteful business emojis only. Good: 📈 💡 🎯 🚀 🧠 💼 🎨 ⚡

PERSONALITY INSTRUCTIONS:
${personalityConfig.instruction}
${businessMode.instruction ? `CURRENT TASK MODE:\n${businessMode.instruction}` : ''}

${proactiveInstruction}
${memoryInstruction}
${locationInstruction}
${snapshotInstruction}
${toneInstruction}

STOCK PHOTOS: Return 2 Unsplash/Pexels links when asked for free stock images.
IMAGE REQUESTS: Do NOT output image HTML — backend handles image generation.
BUSINESS BEHAVIOR: Always try to improve the user's idea. Suggest new angles proactively.

USER PROFILE:
${profileText || 'No saved user profile provided.'}
${websiteAuditContent ? `\nWEBSITE AUDIT CONTEXT:\n${websiteAuditContent}` : ''}
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      max_tokens: businessMode.maxTokens,
      temperature: businessMode.temperature
    });

    const rawReply = completion?.choices?.[0]?.message?.content
      || '<p>Sorry — I could not generate a response right now.</p>';

    return res.status(200).json({ reply: ensureHtmlReply(rawReply) });

  } catch (error) {
    console.error('[CHAT API ERROR]', error);
    return res.status(500).json({
      reply: '<p>Sorry — something went wrong on my side. Please try again in a moment.</p>'
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '32kb'
    }
  }
};
