export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '10mb'
  }
};

function cleanText(value = '', max = 6000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

async function readJsonSafe(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function transcribeWithGemini(audioBuffer, mimeType = 'audio/webm', preferredLanguage = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const model = process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-2.5-flash-lite';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const b64 = audioBuffer.toString('base64');
  const languageHint = preferredLanguage === 'ar' ? 'Arabic' : preferredLanguage === 'en' ? 'English' : 'same language as speaker';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `Transcribe this audio exactly in ${languageHint}. Return plain text only, no translation, no explanation, no punctuation changes unless clearly spoken.`
            },
            {
              inlineData: {
                mimeType,
                data: b64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 600
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini transcription error: ${response.status} — ${errText.slice(0, 180)}`);
  }

  const data = await readJsonSafe(response);
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('\n')
    .trim();
  return cleanText(text, 4000);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) return res.status(400).json({ error: 'No boundary' });

    const boundary = boundaryMatch[1];
    const parts = buffer.toString('binary').split(`--${boundary}`);

    let audioBuffer = null;
    let filename = 'voice.webm';
    let preferredLanguage = '';

    for (const part of parts) {
      if (part.includes('name="audio"')) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const filenameMatch = part.match(/filename="([^"]+)"/);
        if (filenameMatch) filename = filenameMatch[1];
        const binaryData = part.slice(headerEnd + 4, part.lastIndexOf('\r\n'));
        audioBuffer = Buffer.from(binaryData, 'binary');
      }
      if (part.includes('name="language"')) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const textValue = part.slice(headerEnd + 4, part.lastIndexOf('\r\n')).trim().toLowerCase();
        if (textValue === 'en' || textValue === 'ar') preferredLanguage = textValue;
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: 'No audio data' });
    }

    const mimeType = filename.includes('mp4') ? 'audio/mp4' : 'audio/webm';
    const transcript = await transcribeWithGemini(audioBuffer, mimeType, preferredLanguage);
    return res.status(200).json({ text: transcript });
  } catch (err) {
    console.error('[TRANSCRIBE ERROR]', err?.message);
    return res.status(500).json({ error: 'Transcription failed', detail: err?.message });
  }
}
