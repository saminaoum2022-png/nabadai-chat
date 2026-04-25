function cleanText(value = '', max = 4000) {
  return String(value || '').trim().slice(0, max);
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb'
    }
  }
};

function parseDataUrl(dataUrl = '') {
  const input = cleanText(dataUrl, 20_000_000);
  const match = input.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = String(match[1] || 'image/png').toLowerCase();
  const base64 = String(match[2] || '');
  return {
    mimeType,
    buffer: Buffer.from(base64, 'base64')
  };
}

async function fetchSourceFromPayload(payload = {}) {
  const imageBase64 = cleanText(payload.imageBase64 || payload.image || '', 20_000_000);
  const imageUrl = cleanText(payload.imageUrl || payload.url || '', 4000);

  if (imageBase64) {
    const parsed = parseDataUrl(imageBase64);
    if (parsed) return parsed;
    return {
      mimeType: 'image/png',
      buffer: Buffer.from(imageBase64, 'base64')
    };
  }

  if (!imageUrl) throw new Error('No image payload provided');
  const sourceResp = await fetch(imageUrl);
  if (!sourceResp.ok) {
    throw new Error(`Could not fetch source image (${sourceResp.status})`);
  }
  const mimeType = String(sourceResp.headers.get('content-type') || 'image/png').split(';')[0].trim();
  const arrayBuffer = await sourceResp.arrayBuffer();
  return {
    mimeType: mimeType || 'image/png',
    buffer: Buffer.from(arrayBuffer)
  };
}

async function callRmbgModel({ imageBuffer, mimeType, apiKey }) {
  const endpoints = [
    'https://router.huggingface.co/hf-inference/models/briaai/RMBG-2.0',
    'https://api-inference.huggingface.co/models/briaai/RMBG-2.0'
  ];

  let lastError = null;
  for (const endpoint of endpoints) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'image/png',
          'Content-Type': mimeType || 'image/png'
        },
        body: imageBuffer
      });

      const responseType = String(response.headers.get('content-type') || '').toLowerCase();
      const raw = await response.arrayBuffer();
      const out = Buffer.from(raw);
      const asText = out.toString('utf8');
      const hasJsonError = responseType.includes('application/json');
      if (response.ok && !hasJsonError && out.length) return out;

      let detail = asText;
      try {
        const parsed = JSON.parse(asText || '{}');
        detail = parsed?.error || parsed?.message || asText;
      } catch {}
      lastError = new Error(`Hugging Face RMBG error (${response.status}): ${String(detail).slice(0, 260)}`);

      const retryable = response.status === 429 || response.status === 503 || /loading|temporarily|overloaded/i.test(String(detail || ''));
      if (!retryable || attempt >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
    }
  }
  throw lastError || new Error('RMBG returned empty output');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'HUGGINGFACE_API_KEY is not configured' });
    }

    const { mimeType, buffer } = await fetchSourceFromPayload(req.body || {});
    if (!buffer || !buffer.length) {
      return res.status(400).json({ error: 'Invalid image payload' });
    }

    const outputPng = await callRmbgModel({
      imageBuffer: buffer,
      mimeType,
      apiKey
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(outputPng);
  } catch (err) {
    console.error('[REMOVE BG ERROR]', err?.message || err);
    return res.status(500).json({
      error: 'Remove background failed',
      detail: String(err?.message || err).slice(0, 300)
    });
  }
}
