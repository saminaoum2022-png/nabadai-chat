// ─────────────────────────────────────────────────────────────
//  NabadAI — chat.js  (API Route)
//  Fixes applied:
//   [FIX-1]  CORS wildcard tightened to named Vercel prefixes
//   [FIX-2]  Per-IP rate limiting added
//   [FIX-3]  console.log gated behind NODE_ENV check
//   [FIX-4]  readJsonSafe() helper with body-read timeout
//   [FIX-5]  Pollinations URL now passes model=flux, enhance=true, size params
//   [FIX-6]  businessMode suppressed when explicit personality is chosen
//   [FIX-7]  ensureHtmlReply fallback no longer double-escapes HTML
//   [FIX-8]  Non-existent Gemini model replaced with correct model IDs
//   [FIX-9]  Profile fields sanitized against prompt injection
//   [FIX-10] Request body size capped at 32kb
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

// [FIX-1] Only allow YOUR own Vercel deployment prefixes
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

// ── [FIX-2] RATE LIMITING ─────────────────────────────────────
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

  // Prune stale entries to prevent memory leak
  if (rateLimitMap.size > 500) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }

  return entry.count > RATE_LIMIT.maxRequests;
}

// ── [FIX-8] CORRECT GEMINI MODEL IDs ─────────────────────────
const GEMINI_TEXT_MODELS = [
  'gemini-2.5-flash-preview-04-17',  // latest stable
  'gemini-2.0-flash'                 // reliable fallback
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

// ── [FIX-4] FETCH WITH TIMEOUT + SAFE BODY READ ──────────────
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

// ── [FIX-5] DETECT IMAGE TYPE FOR CORRECT DIMENSIONS ─────────
function detectImageType(text = '') {
  const t = text.toLowerCase();
  if (/\b(logo|brand mark|icon)\b/.test(t))   return 'logo';
  if (/\b(mockup|product shot|product photo)\b/.test(t)) return 'mockup';
  if (/\b(poster|flyer)\b/.test(t))            return 'poster';
  if (/\b(banner|cover|header)\b/.test(t))     return 'banner';
  if (/\b(social|instagram|facebook|post)\b/.test(t)) return 'social';
  return 'general';
}

// [FIX-5] Enriched prompt builder — type-aware quality keywords
function enrichImagePrompt(prompt = '', imageType = 'general') {
  const enrichments = {
    logo: [
      'professional vector logo design',
      'clean minimalist style',
      'transparent background',
      'flat design',
      'suitable for business branding',
      'high contrast sharp edges',
      'centered composition',
      'no extra clutter',
      'scalable icon mark'
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

// [FIX-5] Build Pollinations URL with full quality params
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

    const briefMatch  = content.match(/data-nabad-brief="([^"]+)"/i);
    const promptMatch = content.match(/data-nabad-prompt="([^"]+)"/i);
    const sourceMatch = content.match(/data-nabad-source="([^"]+)"/i);
    const modelMatch  = content.match(/data-nabad-model="([^"]+)"/i);
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

function buildStrictFallbackPrompt(lastUserMessage = '', messages = []) {
  const previous = extractLastImageMeta(messages);
  const explicit = getLatestExplicitImageRequest(messages);
  const baseConcept =
    normalizeImagePrompt(previous?.brief || explicit || cleanImageIntentPrefix(lastUserMessage)) ||
    'a premium professional business visual';

  const lower = String(lastUserMessage || '').toLowerCase();
  const changes = [];

  if (/dark/.test(lower))                      changes.push('darker mood with deeper shadows');
  if (/light|bright/.test(lower))              changes.push('cleaner brighter studio lighting');
  if (/premium|luxury|luxurious/.test(lower))  changes.push('more premium luxurious finish and materials');
  if (/closer|close-up|zoom/.test(lower))      changes.push('closer crop and tighter framing');
  if (/angle|side|top|perspective/.test(lower))changes.push('different camera angle');
  if (/minimal|clean/.test(lower))             changes.push('cleaner more minimal composition');
  if (/gold/.test(lower))                      changes.push('richer gold accents');
  if (/silver/.test(lower))                    changes.push('refined silver accents');
  if (/without\b/.test(lower))                 changes.push('remove any optional extra elements');

  const variationInstruction = isRegenerationRequest(lastUserMessage)
    ? 'Create a new variation. Keep the same subject, background family, purpose, and style. Only vary angle, crop, reflections, or small details.'
    : 'Keep the same core concept and stay very close to the original request.';

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
Your job is to convert a chat conversation into an extremely faithful image prompt.

Return ONLY valid JSON in this exact shape:
{
  "prompt": "final text-to-image prompt in English",
  "locked_brief": "short stable concept summary for future regenerate requests",
  "must_keep": ["item 1", "item 2"],
  "can_vary": ["item 1", "item 2"],
  "aspect_ratio": "1:1"
}

Rules:
- Keep the image VERY close to the user's request.
- Do NOT invent a different concept, product, scene, or style unless the user explicitly asks.
- If the user says "again", "one more", "another version", preserve the same subject, concept, background, style, and purpose. Only vary camera angle, crop, reflections, or small details.
- Use one clear concept only.
- Be concrete about subject count, material, color, background, composition, lighting, mood, camera angle, and product placement.
- Use positive precise constraints.
- If text should appear inside the image, preserve exact quoted text.
- Avoid generic filler and competing ideas.
- "locked_brief" must remain stable and reusable.
- "prompt" should be one dense paragraph, specific and production-oriented.
`;

  const userPrompt = `
Conversation:
${conversation}

Latest user message:
${lastUserMessage}

Previous locked brief:
${previous?.brief || ''}

Previous final prompt:
${previous?.prompt || ''}

Latest explicit image request:
${explicitRequest}

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

      // [FIX-4] Use safe body reader with timeout
      const data = await readJsonSafe(response);
      const raw = data?.choices?.[0]?.message?.content || '';
      const parsed = tryParseJsonBlock(raw);

      const prompt = normalizeImagePrompt(parsed?.prompt || raw);
      const lockedBrief = normalizeImagePrompt(
        parsed?.locked_brief || previous?.brief || explicitRequest || prompt
      );

      if (prompt) {
        return {
          prompt,
          lockedBrief,
          mustKeep: normalizeList(parsed?.must_keep),
          canVary: normalizeList(parsed?.can_vary),
          aspectRatio: sanitizePromptText(parsed?.aspect_ratio || '1:1', 20) || '1:1',
          model,
          source: 'gemini'
        };
      }

      throw new Error(`Gemini ${model} returned empty prompt`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Gemini prompt generation failed');
}

// [FIX-5] Updated to use buildPollinationsUrl with quality params
function buildPollinationsImageHtml(prompt, meta = {}, imageType = 'general') {
  const finalPrompt    = normalizeImagePrompt(prompt);
  const imageUrl       = buildPollinationsUrl(finalPrompt, imageType);
  const encodedBrief   = encodeURIComponent(meta.lockedBrief || finalPrompt);
  const encodedSource  = encodeURIComponent(meta.source || 'fallback');
  const encodedModel   = encodeURIComponent(meta.model || 'none');
  const encodedPrompt  = encodeURIComponent(finalPrompt);

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

  if (/\b(brand|branding|logo|identity|visual identity|packaging|name|slogan|tagline|rebrand|positioning)\b/.test(fullText)) {
    return { id: 'branding', label: 'Branding', temperature: 0.82, maxTokens: 520, instruction: `\nCURRENT MODE: BRANDING\nFocus on brand clarity, positioning, naming, identity, perception, premium feel, memorability, and commercial distinctiveness.\nDo not give generic brand advice. Suggest angles that make the brand easier to remember and easier to sell.\n` };
  }
  if (/\b(grow|growth|marketing|sales|funnel|lead|leads|ads|advertising|campaign|seo|content|social media|conversion|traffic|reach|audience)\b/.test(fullText)) {
    return { id: 'growth', label: 'Growth', temperature: 0.84, maxTokens: 540, instruction: `\nCURRENT MODE: GROWTH\nFocus on customer acquisition, channel strategy, conversion, messaging, demand generation, and scalable growth.\nPrefer practical growth moves over theory.\n` };
  }
  if (/\b(offer|service package|package|pricing|proposal|upsell|bundle|retainer|productized|value proposition|what should i sell|monetize|monetise)\b/.test(fullText)) {
    return { id: 'offer', label: 'Offer', temperature: 0.83, maxTokens: 520, instruction: `\nCURRENT MODE: OFFER\nFocus on designing strong offers, pricing logic, perceived value, packaging, outcomes, differentiation, and ease of purchase.\n` };
  }
  if (/\b(idea|ideas|brainstorm|creative|unique|different|unusual|out of the box|innovative|concept|concepts)\b/.test(fullText)) {
    return { id: 'creative', label: 'Creative Ideas', temperature: 0.9, maxTokens: 560, instruction: `\nCURRENT MODE: CREATIVE IDEAS\nThink expansively but commercially. Suggest fresh, original, monetizable angles. Avoid generic brainstorming.\n` };
  }
  if (/\b(strategy|strategic|launch|business plan|roadmap|niche|market|audience|target market|business model|position|positioning|plan|direction|start a business|startup)\b/.test(fullText)) {
    return { id: 'strategy', label: 'Strategy', temperature: 0.8, maxTokens: 540, instruction: `\nCURRENT MODE: STRATEGY\nFocus on choosing the right market, angle, business model, positioning, sequencing, and strategic path.\nPrefer sharp recommendations over vague checklists.\n` };
  }

  return { id: 'advisor', label: 'Business Advisor', temperature: 0.82, maxTokens: 520, instruction: `\nCURRENT MODE: BUSINESS ADVISOR\nAct like a commercially smart founder advisor. Be practical, strategic, and creative.\n` };
}

function getPersonalityConfig(selectedPersonality = 'auto') {
  const key = String(selectedPersonality || 'auto').toLowerCase();
  switch (key) {
    case 'strategist':
      return { id: 'strategist', label: 'Strategist', instruction: `\nSELECTED PERSONALITY: STRATEGIST\nTone: smart, structured, commercially sharp.\nBehavior:\n- prioritize clarity, direction, sequencing, and positioning\n- recommend the smartest path, not all possible paths\n- think like a founder strategist\n- avoid fluffy motivation\n` };
    case 'growth':
      return { id: 'growth', label: 'Growth Expert', instruction: `\nSELECTED PERSONALITY: GROWTH EXPERT\nTone: practical, energetic, opportunity-focused.\nBehavior:\n- focus on customers, lead generation, conversion, distribution, and revenue growth\n- prioritize traction, acquisition, and marketing leverage\n` };
    case 'branding':
      return { id: 'branding', label: 'Brand Builder', instruction: `\nSELECTED PERSONALITY: BRAND BUILDER\nTone: creative, premium, perceptive, modern.\nBehavior:\n- focus on brand perception, identity, positioning, memorability, naming, messaging, and premium feel\n` };
    case 'offer':
      return { id: 'offer', label: 'Offer Architect', instruction: `\nSELECTED PERSONALITY: OFFER ARCHITECT\nTone: persuasive, commercial, monetization-focused.\nBehavior:\n- focus on offer design, pricing, packaging, upsells, value perception, and ease of purchase\n` };
    case 'creative':
      return { id: 'creative', label: 'Creative Challenger', instruction: `\nSELECTED PERSONALITY: CREATIVE CHALLENGER\nTone: bold, inventive, unconventional, commercially aware.\nBehavior:\n- push beyond obvious ideas\n- suggest unexpected but practical business angles\n` };
    case 'straight_talk':
      return { id: 'straight_talk', label: 'Straight Talk', instruction: `\nSELECTED PERSONALITY: STRAIGHT TALK\nTone: direct, honest, sharp, no-fluff.\nBehavior:\n- tell the user what is weak, risky, vague, or unrealistic\n- do not sugarcoat\n- be concise and commercially grounded\n` };
    case 'auto':
    default:
      return { id: 'auto', label: 'Auto', instruction: `\nSELECTED PERSONALITY: AUTO\nAdapt naturally to the user's goal.\nStill sound premium, commercially intelligent, and creative.\n` };
  }
}

function detectToneOverride(text = '') {
  const value = String(text || '').toLowerCase();
  if (/\b(be direct|be more direct|be brutally honest|be honest|straight talk|no fluff|stop being soft|be blunt|be harsh|tell me the truth|be real)\b/i.test(value)) return 'straight_talk';
  if (/\b(be more creative|think outside the box|out of the box|be bold|challenge me|push me|fresh ideas|unexpected ideas|wild ideas|bolder ideas|creative mode)\b/i.test(value)) return 'creative';
  if (/\b(focus on growth|growth mode|marketing mode|sales mode|lead generation|customer acquisition|get customers|focus on conversion|acquisition strategy)\b/i.test(value)) return 'growth';
  if (/\b(brand mode|branding mode|think like a brand strategist|focus on branding|premium brand thinking|naming and branding|brand expert)\b/i.test(value)) return 'branding';
  if (/\b(offer mode|pricing mode|monetization mode|help me monetize|focus on pricing|design my offer|package this|improve my offer)\b/i.test(value)) return 'offer';
  if (/\b(strategy mode|be strategic|think like a strategist|focus on strategy|high level strategy|strategic mode)\b/i.test(value)) return 'strategist';
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

// ── [FIX-7] ensureHtmlReply — no double-escaping ──────────────
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
    // [FIX-7] Only escape chunks that contain no HTML
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

// ── [FIX-9] PROFILE SANITIZER ─────────────────────────────────
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

  // [FIX-2] Rate limit check
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

    // [FIX-9] Sanitize profile before use
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

    if (isStockPhotoRequest(lastUserMessage)) {
      const keyword = buildStockKeyword(lastUserMessage);
      return res.status(200).json({ reply: buildStockPhotoHtml(keyword) });
    }

    if (shouldGenerateImage(messages, lastUserMessage)) {
      const imageType = detectImageType(lastUserMessage);
      const previous = extractLastImageMeta(messages);
      const fallbackPrompt = buildStrictFallbackPrompt(lastUserMessage, messages);

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
        if (process.env.GEMINI_API_KEY) {
          const geminiResult = await buildImagePromptWithGemini(messages, process.env.GEMINI_API_KEY);
          if (geminiResult?.prompt) {
            finalPrompt  = geminiResult.prompt;
            lockedBrief  = geminiResult.lockedBrief || lockedBrief || finalPrompt;
            promptSource = geminiResult.source || 'gemini';
            promptModel  = geminiResult.model || 'unknown';
            mustKeep     = geminiResult.mustKeep || [];
            canVary      = geminiResult.canVary || [];
          }
        }
      } catch (err) {
        console.error('[IMAGE PROMPT ERROR]', err?.message || err);
      }

      finalPrompt = normalizeImagePrompt(finalPrompt || fallbackPrompt);
      lockedBrief = normalizeImagePrompt(lockedBrief || finalPrompt);

      // [FIX-3] Debug logs only in development
      if (process.env.NODE_ENV !== 'production') {
        console.log('[IMAGE DEBUG]', {
          lastUserMessage, promptSource, promptModel,
          lockedBrief, finalPrompt, mustKeep, canVary
        });
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

    const explicitUrl = cleanText(body.url || body.website || '', 500) || extractFirstUrl(lastUserMessage);
    const websiteAuditContent = isValidHttpUrl(explicitUrl)
      ? await fetchWebsiteAuditContent(explicitUrl)
      : '';

    const personalityResolution = resolveActivePersonality(selectedPersonality, lastUserMessage);
    const personalityConfig = getPersonalityConfig(personalityResolution.personalityId);

    // [FIX-6] Only inject businessMode when personality is auto
    const businessMode = personalityResolution.personalityId === 'auto'
      ? detectBusinessMode(lastUserMessage, messages)
      : { id: 'advisor', label: personalityConfig.label, temperature: 0.82, maxTokens: 520, instruction: '' };

    // [FIX-3] Debug logs only in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PERSONALITY DEBUG]', {
        selectedPersonality,
        activePersonality: personalityConfig.id,
        personalitySource: personalityResolution.source,
        overridePersonality: personalityResolution.overridePersonality || '',
        businessMode: businessMode.id
      });
    }

    const systemPrompt = `
You are Nabad, an elite business strategist, growth advisor, offer architect, and creative commercial thinker.

Your job is NOT to sound like a generic assistant.
Your job is to help users make smarter business decisions, spot opportunities, differentiate, position offers, grow revenue, improve branding, and think in more original ways.

PERSONALITY:
- Sharp, commercially smart, creative, business-oriented
- Practical, modern, persuasive, insightful
- Always think beyond the obvious
- Always look for leverage, differentiation, monetization, positioning, and growth
- Never sound like a school textbook or motivational chatbot
- Never give bland generic advice if a stronger angle can be given

CORE BUSINESS MINDSET:
For business questions, think through:
- customer pain/problem
- market opportunity
- positioning
- business model / revenue path
- offer design
- acquisition / distribution
- conversion potential
- brand perception
- scalability
- smart unconventional angles

HOW TO ANSWER:
- Reply in clean HTML only
- Never use Markdown
- Allowed tags: <p>, <b>, <strong>, <i>, <em>, <ul>, <ol>, <li>, <br>, <a>, <h3>, <h4>
- Never return one huge wall of text
- Every answer must be visually structured and easy to scan
- Prefer this structure by default:

<h3>Main insight or recommendation</h3>
<p>One short direct conclusion.</p>
<ul>
  <li>2 to 5 specific points</li>
</ul>
<p><b>Fresh angle:</b> one more original or unexpected idea.</p>
<p><b>Next best move:</b> the best immediate action to take.</p>

STYLE RULES:
- Be concise but high-value
- Focus on commercial usefulness
- Add at least one fresh thought, overlooked angle, or stronger idea whenever relevant
- If the user is vague, do NOT give a basic generic checklist only
- Suggest promising directions and recommend one
- Speak like a founder advisor, not a school teacher
- Prefer a point of view over neutral waffle

EMOJI STYLE:
- You may use 1 to 3 tasteful business-relevant emojis when helpful
- Good examples: 📈 💡 🎯 🚀 🧠 💼 🎨 ⚡
- Do not overuse emojis

MODE GUIDANCE:
SELECTED PERSONALITY PREFERENCE:
- User selected: ${personalityResolution.selectedPersonality}
- Active personality for this reply: ${personalityConfig.label}
- Personality source: ${personalityResolution.source}
${personalityResolution.overridePersonality ? `- Temporary override: ${personalityResolution.overridePersonality}` : ''}

PERSONALITY INSTRUCTIONS:
${personalityConfig.instruction}

${businessMode.instruction ? `CURRENT TASK MODE:\n${businessMode.instruction}` : ''}

SPECIAL RULE FOR BROAD BUSINESS QUESTIONS:
When the user asks something broad like "I want to start a business" or "give me ideas":
1. Give a point of view
2. Give 2 to 4 strong directions or options
3. Recommend one best path
4. Add one fresh angle the user may not have considered

STOCK PHOTOS:
If the user asks for free stock photos, free image sources, or photo references, return exactly 2 clickable HTML links:
<a href="https://unsplash.com/s/photos/[keyword]" target="_blank" rel="noopener noreferrer">🖼 Search [keyword] on Unsplash</a><br>
<a href="https://www.pexels.com/search/[keyword]/" target="_blank" rel="noopener noreferrer">🖼 Search [keyword] on Pexels</a>

IMAGE REQUESTS:
If the user asks for an image, logo, poster, banner, flyer, mockup, or another version of an image, respond naturally if needed but do NOT output raw image HTML or Pollinations URLs manually. The backend handles image generation.

BUSINESS BEHAVIOR:
- Always try to improve the user's idea, not just answer it
- Suggest new angles proactively when useful
- If visuals would help, you may say:
<p>🖼 Would you like me to generate a visual for this idea?</p>

USER PROFILE:
${profileText || 'No saved user profile provided.'}

${websiteAuditContent ? `WEBSITE AUDIT CONTEXT:\n${websiteAuditContent}` : ''}
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

// ── [FIX-10] Cap request body size ───────────────────────────
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '32kb'
    }
  }
};
