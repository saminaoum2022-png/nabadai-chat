import OpenAI from 'openai';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: { bodyParser: false }
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const form = formidable({ keepExtensions: true });
    const [, files] = await form.parse(req);
    const file = files.audio?.[0];
    if (!file) return res.status(400).json({ error: 'No audio file received' });

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(file.filepath),
      model: 'whisper-1',
      language: 'en'
    });

    return res.status(200).json({ text: transcription.text });
  } catch (err) {
    console.error('[TRANSCRIBE ERROR]', err?.message);
    return res.status(500).json({ error: 'Transcription failed' });
  }
}
