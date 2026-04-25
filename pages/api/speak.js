function cleanText(value = '', max = 3500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function pcmToWavBuffer(pcmBuffer, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const wav = Buffer.alloc(44 + dataSize);

  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(wav, 44);

  return wav;
}

async function ttsWithGemini({ text, language }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const model = cleanText(process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts', 80);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const languageCode = language === 'ar' ? 'ar-XA' : 'en-US';
  const voiceName = language === 'ar'
    ? (process.env.GEMINI_TTS_VOICE_AR || 'Kore')
    : (process.env.GEMINI_TTS_VOICE_EN || 'Kore');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          languageCode,
          voiceConfig: { prebuiltVoiceConfig: { voiceName } }
        }
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini TTS error: ${response.status} — ${errText.slice(0, 220)}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const audioPart = parts.find((p) => p?.inlineData?.data);
  const b64Audio = audioPart?.inlineData?.data || '';
  if (!b64Audio) throw new Error('Gemini TTS returned no audio data');

  const pcmBuffer = Buffer.from(b64Audio, 'base64');
  return pcmToWavBuffer(pcmBuffer, 24000, 1, 16);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, language } = req.body || {};
    const clean = cleanText(text, 3500);
    if (!clean) return res.status(400).json({ error: 'No text provided' });

    const wavBuffer = await ttsWithGemini({
      text: clean,
      language: language === 'ar' ? 'ar' : 'en'
    });

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(wavBuffer);
  } catch (err) {
    console.error('[TTS ERROR]', err?.message || err);
    return res.status(500).json({
      error: 'TTS failed',
      detail: String(err?.message || err).slice(0, 300)
    });
  }
}
