const ALLOWED_ORIGINS = [
  'https://nabadai.com',
  'https://www.nabadai.com',
  'https://nabadai-chat.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const GEMINI_TEXT_MODELS = ['gemini-2.5-flash', 'gemini-3-flash-preview'];

function setCors(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function cleanText(value, maxLength = 300) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizePromptText(value, maxLength = 1200) {
  return String(value || '')
    .replace(/[<>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function isStockPhotoRequest(text = '') {
  return /(stock photo|stock photos|free stock|unsplash|pexels|reference photos|reference images|inspiration images|free photos)/i.test(
    text
  );
}

function isImageRequest(text = '') {
  return /(generate|create|make|show|draw|design|image|photo|picture|visual|logo|poster|banner|flyer|mockup|render|illustration|ad|advert|campaign|cover)/i.test(
    text
  );
}

function isRegenerationRequest(text = '') {
  return /(again|one more|another|regenerate|generate more|different version|variation|try again|another one)/i.test(
    text
  );
}

function conversationRecentlyHadImage(messages = []) {
  return messages.slice(-12).some((m) => {
    const content = typeof m?.content === 'string' ? m.content : '';

    return (
      /<img\s/i.test(content) ||
      /img\s+src=/i.test(content) ||
      /image\.pollinations\.ai\/prompt\//i.test(content) ||
      /Generated image/i.test(content)
    );
  });
}

function getLatestExplicitImageRequest(messages = []) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.role === 'user' && typeof m.content === 'string' && isImageRequest(m.content)) {
      return sanitizePromptText(m.content, 500);
    }
  }
  return '';
}

function shouldGenerateImage(messages = [], lastUserMessage = '') {
  if (!lastUserMessage) return false;
  if (isStockPhotoRequest(lastUserMessage)) return false;

  if (isImageRequest(lastUserMessage)) return true;

  if (
    isRegenerationRequest(lastUserMessage) &&
    (conversationRecentlyHadImage(messages) || !!getLatestExplicitImageRequest(messages))
  ) {
    return true;
  }

  return false;
}

async function buildImagePromptWithGemini(messages, geminiApiKey) {
  const recentConversation = messages
    .slice(-8)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

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
              {
                role: 'system',
                content:
                  'Turn the conversation into one strong English prompt for an AI image generator. Return only the final prompt text. No markdown. No HTML. No explanations. If the user asks for another version, vary the angle, composition, lighting, colors, mood, background, and framing so the result feels clearly different but still relevant.'
              },
              {
                role: 'user',
                content: recentConversation
              }
            ],
            temperature: 0.9,
            max_tokens: 180
          })
        },
        30000
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        lastError = new Error(data?.error?.message || `Gemini prompt generation failed for ${model}.`);
        continue;
      }

      const prompt = sanitizePromptText(data?.choices?.[0]?.message?.content || '', 500);

      if (prompt) return prompt;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Gemini prompt generation failed.');
}

function buildPollinationsImageHtml(prompt) {
  const cleanPrompt = sanitizePromptText(prompt, 500);
  const encodedPrompt = encodeURIComponent(cleanPrompt);

  return `<img src="https://image.pollinations.ai/prompt/${encodedPrompt}" alt="Generated image">`;
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ reply: 'Method not allowed.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ reply: 'Server is missing OpenAI configuration.' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const inputMessages = Array.isArray(body.messages) ? body.messages : [];
    const rawUrl = typeof body.url === 'string' ? body.url.trim() : '';
    const rawProfile = body.profile && typeof body.profile === 'object' ? body.profile : null;

    const messages = inputMessages
      .filter(
        (m) =>
          m &&
          typeof m === 'object' &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string'
      )
      .slice(-20)
      .map((m) => ({
        role: m.role,
        content: sanitizePromptText(m.content, 4000)
      }))
      .filter((m) => m.content.length > 0);

    const profile = rawProfile
      ? {
          name: cleanText(rawProfile.name, 80),
          company: cleanText(rawProfile.company, 120),
          industry: cleanText(rawProfile.industry, 80),
          location: cleanText(rawProfile.location, 120)
        }
      : null;

    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    if (shouldGenerateImage(messages, lastUserMessage)) {
      const basePrompt =
        getLatestExplicitImageRequest(messages) ||
        sanitizePromptText(lastUserMessage, 500) ||
        'A premium professional business visual';

      try {
        let finalPrompt = basePrompt;

        if (process.env.GEMINI_API_KEY) {
          const improvedPrompt = await buildImagePromptWithGemini(
            messages,
            process.env.GEMINI_API_KEY
          );
          if (improvedPrompt) finalPrompt = improvedPrompt;
        }

        return res.status(200).json({
          reply: buildPollinationsImageHtml(finalPrompt)
        });
      } catch {
        return res.status(200).json({
          reply: buildPollinationsImageHtml(basePrompt)
        });
      }
    }

    let systemPrompt = `You are Nabad, a global AI business startup consultant for NabadAi — a premium AI-powered digital services agency.

Your mission: Help entrepreneurs worldwide turn ideas into successful businesses.

${
  profile && (profile.name || profile.company || profile.industry || profile.location)
    ? `USER PROFILE:
- Name: ${profile.name || 'Unknown'}
- Company: ${profile.company || 'Unknown'}
- Industry: ${profile.industry || 'Unknown'}
- Location: ${profile.location || 'Unknown'}
Use this context to personalize every response from the first message.`
    : 'No profile provided — ask for their name, business, and location early.'
}

CORE STRENGTHS:
- Always personalize answers to their specific business
- Give step-by-step roadmaps, not walls of text
- Challenge bad ideas honestly like a real advisor
- Know when to say "for this you need a lawyer/accountant"
- Confident, sharp, premium consultant tone
- Tailor advice to their country's regulations, costs, and market

FORMATTING RULES — CRITICAL, always follow:
- NEVER use markdown: no **, no ##, no *, no ---, no backticks
- ALWAYS use HTML tags only
- Use <b>text</b> for bold and titles
- Use <ul><li>item</li></ul> for bullet points
- Use <br><br> between sections
- Responses must render as HTML, not plain text
- Never output <script>, <iframe>, inline event handlers, javascript: links, or unsafe HTML

EMOJIS:
- Use business emojis naturally (📊 💡 🚀 📋 🎯 💼 📈 🔍 ✅)
- NO smiley faces

PROACTIVE TIPS:
- Every 5 messages, naturally add a quick industry insight or actionable tip relevant to their business
- Keep it short, 1-2 lines, prefixed with 💡

STOCK PHOTOS:
If the user asks for free stock photos, free image sources, inspiration images, photo references, or visual references, return exactly 2 clickable HTML links and nothing else before them:

<a href="https://unsplash.com/s/photos/[keyword]" target="_blank" rel="noopener noreferrer">🖼 Search [keyword] on Unsplash</a><br>
<a href="https://www.pexels.com/search/[keyword]/" target="_blank" rel="noopener noreferrer">🖼 Search [keyword] on Pexels</a>

Rules:
- Replace [keyword] with a short relevant English search phrase
- Always make both links clickable
- Do not use markdown
- Do not wrap links in code blocks
- Do not return plain text URLs unless the user specifically asks for plain URLs

IMAGE REQUESTS:
If the user asks for an image, logo concept, poster, banner, mockup, branding visual, or product photo idea, respond helpfully and naturally.
Do not manually invent image URLs.
Do not output HTML image tags.
The backend may generate images separately.

VISUAL FOLLOW-UP:
- If the user is discussing visuals, branding, products, ads, or packaging and an image would help, you may naturally ask:
"🖼 Would you like me to generate an image for that?"
- If they ask for free stock sources instead, provide the stock-photo links format above

BRAND KIT:
When discussing branding, logo, or business identity naturally suggest:
"🎨 Want to build your brand identity? Try our free Brand Kit! [BRANDKIT_CTA]"

You are helpful, action-oriented, and premium.`;

    if (rawUrl) {
      if (isValidHttpUrl(rawUrl)) {
        try {
          const auditUrl = new URL(rawUrl).toString();
          const jinaRes = await fetchWithTimeout(`https://r.jina.ai/${auditUrl}`, {}, 15000);

          if (jinaRes.ok) {
            const content = await jinaRes.text();
            systemPrompt += `\n\nWebsite audit requested for: ${auditUrl}\nContent:\n${sanitizePromptText(content, 3000)}`;
          } else {
            systemPrompt += `\n\nCould not fetch ${auditUrl}. Inform the user politely.`;
          }
        } catch {
          systemPrompt += `\n\nCould not fetch the provided website. Inform the user politely.`;
        }
      } else {
        systemPrompt += `\n\nThe user provided an invalid or unsupported URL. Explain that only full http/https website links are supported.`;
      }
    }

    const openaiResponse = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: 800,
          temperature: 0.7
        })
      },
      30000
    );

    const data = await openaiResponse.json().catch(() => ({}));

    if (!openaiResponse.ok) {
      const errorMessage =
        data?.error?.message ||
        'The AI service is temporarily unavailable. Please try again.';
      return res.status(openaiResponse.status).json({ reply: errorMessage });
    }

    const reply = data?.choices?.[0]?.message?.content;

    if (!reply || typeof reply !== 'string') {
      return res
        .status(502)
        .json({ reply: 'I could not generate a valid response. Please try again.' });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({
      reply: 'Something went wrong on the server. Please try again.'
    });
  }
}
