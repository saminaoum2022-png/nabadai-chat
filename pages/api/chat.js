import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ALLOWED_ORIGINS = [
  'https://nabadai.com',
  'https://www.nabadai.com',
  'https://nabadai-chat.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const GEMINI_TEXT_MODELS = [
  'gemini-2.5-flash',
  'gemini-3-flash-preview'
];

const SHOW_IMAGE_DEBUG = false; // set to true only when testing

function isAllowedOrigin(origin = '') {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();

    if (ALLOWED_ORIGINS.includes(origin)) return true;
    if (hostname === 'nabadai.com' || hostname.endsWith('.nabadai.com')) return true;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;

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

function getMessageText(content) {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
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
  try {
    return decodeURIComponent(text);
  } catch {
    return text || '';
  }
}

function tryParseJsonBlock(text = '') {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeList(arr = []) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => sanitizePromptText(String(item || ''), 120))
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 10);
}

function isValidHttpUrl(value = '') {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url, options = {}, timeout = 20000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(id);
  }
}

function extractFirstUrl(text = '') {
  const match = String(text || '').match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0] : '';
}

function isStockPhotoRequest(text = '') {
  return /\b(stock photo|stock photos|free stock|free photos|free images|inspiration images|reference images|photo references|image references|unsplash|pexels)\b/i.test(
    text
  );
}

function isImageRequest(text = '') {
  return /\b(generate|create|make|show|draw|design|render)\b.*\b(image|photo|picture|visual|logo|poster|banner|flyer|mockup|illustration|ad|advert|campaign|cover)\b|\b(image|photo|picture|visual|logo|poster|banner|flyer|mockup|illustration|ad|advert|campaign|cover)\b/i.test(
    text
  );
}

function isRegenerationRequest(text = '') {
  return /\b(one more|again|another one|another version|new version|regenerate|redo|retry|same again|same one|variation|variant)\b/i.test(
    text
  );
}

function isImageModificationRequest(text = '') {
  return /\b(same|this|that|it)\b.*\b(darker|lighter|brighter|premium|luxury|luxurious|closer|zoom|angle|background|color|colour|lighting|reflection|shadow|gold|silver|bigger|smaller|more|minimal|cleaner|simpler|richer|warmer|cooler|with|without)\b/i.test(
    text
  );
}

function cleanImageIntentPrefix(text = '') {
  return String(text || '')
    .replace(
      /^\s*(please\s+)?(generate|create|make|show|draw|design|render)\s+(me\s+)?(an?\s+)?(image|photo|picture|visual|logo|poster|banner|flyer|mockup|illustration|ad|advert|campaign|cover)\s*(of|for)?\s*/i,
      ''
    )
    .trim();
}

function unwrapPromptText(text = '') {
  let value = String(text || '').trim();

  const pollinationsUrlMatch = value.match(/image\.pollinations\.ai\/prompt\/([^"'\s<]+)/i);
  if (pollinationsUrlMatch?.[1]) {
    return decodeMaybe(pollinationsUrlMatch[1]);
  }

  value = value.replace(/<img[\s\S]*?>/gi, ' ').trim();
  return value;
}

function normalizeImagePrompt(text = '') {
  return sanitizePromptText(unwrapPromptText(text), 1400)
    .replace(/\s+/g, ' ')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
}

function extractLastImageMeta(messages = []) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const content = typeof messages[i]?.content === 'string' ? messages[i].content : '';
    if (!content) continue;

    const briefMatch = content.match(/data-nabad-brief="([^"]+)"/i);
    const promptMatch = content.match(/data-nabad-prompt="([^"]+)"/i);
    const sourceMatch = content.match(/data-nabad-source="([^"]+)"/i);
    const modelMatch = content.match(/data-nabad-model="([^"]+)"/i);
    const urlPromptMatch = content.match(/image\.pollinations\.ai\/prompt\/([^"'\s<]+)/i);

    if (
      briefMatch ||
      promptMatch ||
      urlPromptMatch ||
      /img\s+src=/i.test(content) ||
      /Generated image/i.test(content)
    ) {
      const prompt = decodeMaybe(promptMatch?.[1] || urlPromptMatch?.[1] || '');
      const brief = decodeMaybe(briefMatch?.[1] || prompt || '');

      return {
        prompt,
        brief,
        source: decodeMaybe(sourceMatch?.[1] || ''),
        model: decodeMaybe(modelMatch?.[1] || '')
      };
    }
  }

  return null;
}

function conversationRecentlyHadImage(messages = []) {
  return messages.slice(-12).some((m) => {
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

  if (/dark/.test(lower)) changes.push('darker mood with deeper shadows');
  if (/light|bright/.test(lower)) changes.push('cleaner brighter studio lighting');
  if (/premium|luxury|luxurious/.test(lower)) {
    changes.push('more premium luxurious finish and materials');
  }
  if (/closer|close-up|zoom/.test(lower)) changes.push('closer crop and tighter framing');
  if (/angle|side|top|perspective/.test(lower)) changes.push('different camera angle');
  if (/minimal|clean/.test(lower)) changes.push('cleaner more minimal composition');
  if (/gold/.test(lower)) changes.push('richer gold accents');
  if (/silver/.test(lower)) changes.push('refined silver accents');
  if (/without\b/.test(lower)) {
    changes.push('remove any optional extra elements the user rejected');
  }

  const variationInstruction = isRegenerationRequest(lastUserMessage)
    ? 'Create a new variation of the same exact concept. Keep the same main subject, same background family, same business purpose, and same premium style. Only vary camera angle, crop, reflections, or small details.'
    : 'Keep the same core concept and stay very close to the original request.';

  const prompt = `${baseConcept}. ${variationInstruction} ${
    changes.length ? `Change only: ${changes.join(', ')}. ` : ''
  }Single clear concept, no unrelated props, no extra objects, no people unless specifically requested, no concept drift, highly faithful to the user request.`;

  return normalizeImagePrompt(prompt);
}

async function buildImagePromptWithGemini(messages = [], geminiApiKey = '') {
  const lastUserMessage =
    [...messages].reverse().find((m) => m?.role === 'user' && typeof m?.content === 'string')
      ?.content || '';

  const previous = extractLastImageMeta(messages);
  const explicitRequest =
    getLatestExplicitImageRequest(messages) ||
    normalizeImagePrompt(cleanImageIntentPrefix(lastUserMessage));

  const conversation = messages
    .slice(-10)
    .map((m) => {
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
- If the user says "again", "one more", "another version", or similar, preserve the same subject, same concept, same background family, same style, and same purpose. Only vary camera angle, crop, reflections, lighting nuance, or small details.
- Use one clear concept only.
- Be concrete about subject count, material, color, background, composition, lighting, mood, camera angle, and product placement.
- Use positive precise constraints such as "single bottle alone on a matte black studio background".
- If text should appear inside the image, preserve exact quoted text.
- Avoid generic filler and avoid multiple competing ideas.
- For product shots, prefer centered hero composition unless the user requests something else.
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

      const data = await response.json();
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

function buildPollinationsImageHtml(prompt, meta = {}) {
  const finalPrompt = normalizeImagePrompt(prompt);
  const safePrompt = encodeURIComponent(finalPrompt);
  const encodedBrief = encodeURIComponent(meta.lockedBrief || finalPrompt);
  const encodedSource = encodeURIComponent(meta.source || 'fallback');
  const encodedModel = encodeURIComponent(meta.model || 'none');
  const encodedPrompt = encodeURIComponent(finalPrompt);

  return `<img src="https://image.pollinations.ai/prompt/${safePrompt}" alt="Generated image" data-nabad-brief="${encodedBrief}" data-nabad-source="${encodedSource}" data-nabad-model="${encodedModel}" data-nabad-prompt="${encodedPrompt}">`;
}

function buildImageReplyHtml(prompt, meta = {}) {
  const debugHtml = SHOW_IMAGE_DEBUG
    ? `<div style="font-size:12px;color:#667;margin-bottom:8px;"><b>Debug:</b> source=${escapeHtml(
        meta.source || 'fallback'
      )} | model=${escapeHtml(
        meta.model || 'none'
      )}</div><div style="font-size:12px;color:#667;margin-bottom:10px;"><b>Prompt:</b> ${escapeHtml(
        prompt
      )}</div>`
    : '';

  return `${debugHtml}${buildPollinationsImageHtml(prompt, meta)}`;
}

function detectBusinessMode(text = '', messages = []) {
  const fullText = `${text} ${messages
    .slice(-6)
    .map((m) => m?.content || '')
    .join(' ')}`.toLowerCase();

  if (/\b(brand|branding|logo|identity|visual identity|packaging|name|slogan|tagline|rebrand|positioning)\b/.test(fullText)) {
    return {
      id: 'branding',
      label: 'Branding',
      temperature: 0.82,
      maxTokens: 520,
      instruction: `
CURRENT MODE: BRANDING
Focus on brand clarity, positioning, naming, identity, perception, premium feel, memorability, and commercial distinctiveness.
Do not give generic brand advice. Suggest angles that make the brand easier to remember and easier to sell.
`
    };
  }

  if (/\b(grow|growth|marketing|sales|funnel|lead|leads|ads|advertising|campaign|seo|content|social media|conversion|traffic|reach|audience)\b/.test(fullText)) {
    return {
      id: 'growth',
      label: 'Growth',
      temperature: 0.84,
      maxTokens: 540,
      instruction: `
CURRENT MODE: GROWTH
Focus on customer acquisition, channel strategy, conversion, messaging, demand generation, and scalable growth opportunities.
Prefer practical growth moves over theory.
`
    };
  }

  if (/\b(offer|service package|package|pricing|proposal|upsell|bundle|retainer|productized|value proposition|what should i sell|monetize|monetise)\b/.test(fullText)) {
    return {
      id: 'offer',
      label: 'Offer',
      temperature: 0.83,
      maxTokens: 520,
      instruction: `
CURRENT MODE: OFFER
Focus on designing strong offers, pricing logic, perceived value, packaging, outcomes, differentiation, and ease of purchase.
Make the offer more compelling and easier to say yes to.
`
    };
  }

  if (/\b(idea|ideas|brainstorm|creative|unique|different|unusual|out of the box|innovative|concept|concepts)\b/.test(fullText)) {
    return {
      id: 'creative',
      label: 'Creative Ideas',
      temperature: 0.9,
      maxTokens: 560,
      instruction: `
CURRENT MODE: CREATIVE IDEAS
Think expansively but commercially. Suggest fresh, original, monetizable angles. Avoid generic brainstorming.
Every answer should include at least one stronger-than-obvious idea.
`
    };
  }

  if (/\b(strategy|strategic|launch|business plan|roadmap|niche|market|audience|target market|business model|position|positioning|plan|direction|start a business|startup|start up)\b/.test(fullText)) {
    return {
      id: 'strategy',
      label: 'Strategy',
      temperature: 0.8,
      maxTokens: 540,
      instruction: `
CURRENT MODE: STRATEGY
Focus on choosing the right market, angle, business model, positioning, sequencing, and strategic path.
Prefer sharp recommendations over vague checklists.
`
    };
  }

  return {
    id: 'advisor',
    label: 'Business Advisor',
    temperature: 0.82,
    maxTokens: 520,
    instruction: `
CURRENT MODE: BUSINESS ADVISOR
Act like a commercially smart founder advisor. Be practical, strategic, and creative.
`
  };
}

function ensureHtmlReply(reply = '') {
  const text = cleanText(reply, 8000);

  if (!text) {
    return '<p>Sorry — I could not generate a useful response right now.</p>';
  }

  if (/<(p|ul|ol|li|br|a|h3|h4|strong|b|em|i)\b/i.test(text)) {
    return text;
  }

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return `<p>${escapeHtml(text)}</p>`;
  }

  const bulletish = lines.filter((line) => /^[-•*]|\d+\./.test(line));

  if (bulletish.length >= 2) {
    const nonBullets = lines.filter((line) => !/^[-•*]|\d+\./.test(line));
    const bullets = lines
      .filter((line) => /^[-•*]|\d+\./.test(line))
      .map((line) => line.replace(/^[-•*]\s*|\d+\.\s*/, '').trim())
      .filter(Boolean);

    return [
      ...nonBullets.slice(0, 2).map((p) => `<p>${escapeHtml(p)}</p>`),
      `<ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
    ].join('');
  }

  if (text.length > 350) {
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

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

    return chunks.map((chunk) => `<p>${escapeHtml(chunk)}</p>`).join('');
  }

  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
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
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ reply: 'Method not allowed' });
  }

  try {
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {};

    const rawMessages = Array.isArray(body.messages)
      ? body.messages
      : body.message
      ? [{ role: 'user', content: body.message }]
      : [];

    const messages = rawMessages
      .slice(-20)
      .map((m) => {
        const role = m?.role === 'assistant' ? 'assistant' : 'user';
        const content = cleanText(getMessageText(m?.content), 4000);
        return { role, content };
      })
      .filter((m) => m.content);

    const profile = body.profile || {};
    const profileText = [
      profile.name ? `Name: ${cleanText(profile.name, 120)}` : '',
      profile.business ? `Business: ${cleanText(profile.business, 180)}` : '',
      profile.industry ? `Industry: ${cleanText(profile.industry, 180)}` : '',
      profile.goal ? `Goal: ${cleanText(profile.goal, 300)}` : '',
      profile.targetAudience ? `Target audience: ${cleanText(profile.targetAudience, 220)}` : '',
      profile.tone ? `Preferred tone: ${cleanText(profile.tone, 120)}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    if (!lastUserMessage) {
      return res.status(400).json({ reply: 'No message provided.' });
    }

    if (isStockPhotoRequest(lastUserMessage)) {
      const keyword = buildStockKeyword(lastUserMessage);
      return res.status(200).json({
        reply: buildStockPhotoHtml(keyword)
      });
    }

    if (shouldGenerateImage(messages, lastUserMessage)) {
      const previous = extractLastImageMeta(messages);
      const fallbackPrompt = buildStrictFallbackPrompt(lastUserMessage, messages);

      let finalPrompt = fallbackPrompt;
      let lockedBrief =
        normalizeImagePrompt(
          previous?.brief ||
            getLatestExplicitImageRequest(messages) ||
            cleanImageIntentPrefix(lastUserMessage)
        ) || fallbackPrompt;

      let promptSource = 'fallback';
      let promptModel = 'none';
      let mustKeep = [];
      let canVary = [];

      try {
        if (process.env.GEMINI_API_KEY) {
          const geminiResult = await buildImagePromptWithGemini(
            messages,
            process.env.GEMINI_API_KEY
          );

          if (geminiResult?.prompt) {
            finalPrompt = geminiResult.prompt;
            lockedBrief = geminiResult.lockedBrief || lockedBrief || finalPrompt;
            promptSource = geminiResult.source || 'gemini';
            promptModel = geminiResult.model || 'unknown';
            mustKeep = geminiResult.mustKeep || [];
            canVary = geminiResult.canVary || [];
          }
        }
      } catch (err) {
        console.error('[IMAGE PROMPT ERROR]', err?.message || err);
      }

      finalPrompt = normalizeImagePrompt(finalPrompt || fallbackPrompt);
      lockedBrief = normalizeImagePrompt(lockedBrief || finalPrompt);

      console.log('[IMAGE DEBUG]', {
        lastUserMessage,
        promptSource,
        promptModel,
        lockedBrief,
        finalPrompt,
        mustKeep,
        canVary
      });

      return res.status(200).json({
        reply: buildImageReplyHtml(finalPrompt, {
          lockedBrief,
          source: promptSource,
          model: promptModel
        })
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        reply: 'Missing OPENAI_API_KEY on the server.'
      });
    }

    const explicitUrl =
      cleanText(body.url || body.website || '', 500) || extractFirstUrl(lastUserMessage);

    const websiteAuditContent = isValidHttpUrl(explicitUrl)
      ? await fetchWebsiteAuditContent(explicitUrl)
      : '';

    const businessMode = detectBusinessMode(lastUserMessage, messages);

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
- If the user asks about a business idea, also think about brand, pricing, offer, audience, and go-to-market
- Speak like a founder advisor, not a school teacher
- Prefer a point of view over neutral waffle

MODE GUIDANCE:
${businessMode.instruction}

SPECIAL RULE FOR BROAD BUSINESS QUESTIONS:
When the user asks something broad like "I want to start a business" or "give me ideas":
1. Give a point of view
2. Give 2 to 4 strong directions or options
3. Recommend one best path
4. Add one fresh angle the user may not have considered

STOCK PHOTOS:
If the user asks for free stock photos, free image sources, inspiration images, or photo references, return exactly 2 clickable HTML links and nothing else before them:
<a href="https://unsplash.com/s/photos/[keyword]" target="_blank" rel="noopener noreferrer">🖼 Search [keyword] on Unsplash</a><br>
<a href="https://www.pexels.com/search/[keyword]/" target="_blank" rel="noopener noreferrer">🖼 Search [keyword] on Pexels</a>
Rules:
- Replace [keyword] with a short relevant English phrase
- Always make both links clickable
- No markdown, no code fences, no plain-text URLs unless requested

IMAGE REQUESTS:
If the user asks for an image, logo, poster, banner, flyer, mockup, product visual, branding visual, ad visual, or another version of an image, respond naturally if needed, but do NOT output raw image HTML, do NOT invent image URLs, and do NOT output Pollinations links manually. The backend handles image generation.
If the user says "one more", "again", or "same but darker", understand that they want a variation of the same concept, not a new concept.

BUSINESS BEHAVIOR:
- Always try to improve the user's idea, not just answer it
- Always think: what is the smarter version of this idea?
- Always think: how can this be more differentiated, more profitable, more premium, or easier to sell?
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
        ...messages.map((m) => ({
          role: m.role,
          content: m.content
        }))
      ],
      max_tokens: businessMode.maxTokens,
      temperature: businessMode.temperature
    });

    const rawReply =
      completion?.choices?.[0]?.message?.content ||
      '<p>Sorry — I could not generate a response right now.</p>';

    const reply = ensureHtmlReply(rawReply);

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('[CHAT API ERROR]', error);

    return res.status(500).json({
      reply:
        '<p>Sorry — something went wrong on my side. Please try again in a moment.</p>'
    });
  }
}
