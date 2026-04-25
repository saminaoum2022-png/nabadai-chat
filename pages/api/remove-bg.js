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
  const endpoint = 'https://api-inference.huggingface.co/models/briaai/RMBG-2.0';
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
  if (!response.ok || responseType.includes('application/json')) {
    const text = await response.text();
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.error || parsed?.message || text;
    } catch {}
    throw new Error(`Hugging Face RMBG error (${response.status}): ${String(detail).slice(0, 260)}`);
  }

  const out = Buffer.from(await response.arrayBuffer());
  if (!out.length) throw new Error('RMBG returned empty output');
  return out;
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
