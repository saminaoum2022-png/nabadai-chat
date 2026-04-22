export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'No text provided' });

  // OpenAI TTS intentionally disabled. Frontend falls back to browser speech synthesis.
  return res.status(501).json({
    error: 'Server TTS disabled',
    fallback: 'browser-speech-synthesis'
  });
}
