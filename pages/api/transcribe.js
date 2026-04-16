import OpenAI from 'openai';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const file = new File([buffer], 'voice-note.webm', { type: 'audio/webm' });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1'
    });

    return res.status(200).json({ text: transcription.text });
  } catch (err) {
    console.error('[TRANSCRIBE ERROR]', err?.message);
    return res.status(500).json({ error: 'Transcription failed' });
  }
}
