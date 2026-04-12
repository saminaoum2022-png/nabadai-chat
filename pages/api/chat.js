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

const SHOW_IMAGE_DEBUG = false; // turn true only for testing

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

function sanitizePromptText(text = '', maxLen = 1200) {
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
  if (/premium|luxury|luxurious/.test(lower))
    changes.push('more premium luxurious finish and materials');
  if (/closer|close-up|zoom/.test(lower)) changes.push('closer crop and tighter framing');
  if (/angle|side|top|perspective/.test(lower)) changes.push('different camera angle');
  if (/minimal|clean/.test(lower)) changes.push('cleaner more minimal composition');
  if (/gold/.test(lower)) changes.push('richer gold accents');
  if (/silver/.test(lower)) changes.push('refined silver accents');
  if (/without\b/.test(lower))
    changes.push('remove any optional extra elements the user rejected');

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
      )} | model=${escapeHtml(meta.model || 'none')}</div><div style="font-size:12px;color:#667;margin-bottom:10px;"><b>Prompt:</b> ${escapeHtml(
        prompt
      )}</div>`
    : '';

  return `${debugHtml}${buildPollinationsImageHtml(prompt, meta)}`;
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

    const systemPrompt = `
You are Nabad, a smart, practical business consultant and creative growth assistant.
You help users with business ideas, branding, marketing, strategy, offers, websites, and content.

GENERAL STYLE:
- Be clear, warm, practical, and confident.
- Give useful business advice, not vague theory.
- Keep answers concise but valuable.
- Ask a short follow-up question when helpful.
- Reply in clean HTML only.
- Never use Markdown.
- Allowed HTML tags: <p>, <b>, <strong>, <i>, <em>, <ul>, <ol>, <li>, <br>, <a>, <h3>, <h4>.
- Make links clickable with target="_blank" and rel="noopener noreferrer".
- Use emojis lightly and naturally.

FORMAT RULES:
- No Markdown
- No code fences
- No raw JSON unless the user explicitly asks
- Prefer short paragraphs and bullet lists
- If giving steps, use <ol> or <ul>

STOCK PHOTOS:
If the user asks for free stock photos, free image sources, inspiration images, or photo references, return exactly 2 clickable HTML links and nothing else before them:
<a href="https://unsplash.com/s/photos/[keyword]" target="_blank" rel="noopener noreferrer">🖼 Search [keyword] on Unsplash</a><br>
<a href="https://www.pexels.com/search/[keyword]/" target="_blank" rel="noopener noreferrer">🖼 Search [keyword] on Pexels</a>
Rules:
- Replace [keyword] with a short relevant English phrase
- Always make both links clickable
- No markdown, no code fences, no plain-text URLs unless requested

IMAGE REQUESTS:
If the user asks for an image, logo, poster, banner, flyer, mockup, product visual, branding visual, ad visual, or another version of an image, respond naturally and helpfully if needed, but do NOT generate raw HTML image tags, do NOT invent image URLs, and do NOT output Pollinations links manually. The backend handles image generation separately.
If the user asks for a modification like "same but darker" or "one more", understand that they want a variation of the same concept, not a completely new concept.

BUSINESS HELP:
- Focus on solving the user's real business problem.
- If they ask for strategy, provide action-oriented guidance.
- If they ask for branding or marketing advice, make it specific and commercially useful.
- If visuals would help, you may ask: <p>🖼 Would you like me to generate an image for that?</p>

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
      max_tokens: 800,
      temperature: 0.7
    });

    const reply =
      completion?.choices?.[0]?.message?.content ||
      '<p>Sorry — I could not generate a response right now.</p>';

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('[CHAT API ERROR]', error);

    return res.status(500).json({
      reply:
        '<p>Sorry — something went wrong on my side. Please try again in a moment.</p>'
    });
  }
}
