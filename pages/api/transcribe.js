import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '10mb'
  }
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    for (const part of parts) {
      if (part.includes('name="audio"')) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const filenameMatch = part.match(/filename="([^"]+)"/);
        if (filenameMatch) filename = filenameMatch[1];
        const binaryData = part.slice(headerEnd + 4, part.lastIndexOf('\r\n'));
        audioBuffer = Buffer.from(binaryData, 'binary');
        break;
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: 'No audio data' });
    }

    const mimeType = filename.includes('mp4') ? 'audio/mp4' : 'audio/webm';
    const audioFile = new File([audioBuffer], filename, { type: mimeType });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'text'
    });

    return res.status(200).json({ text: transcription });
  } catch (err) {
    console.error('[TRANSCRIBE ERROR]', err?.message);
    return res.status(500).json({ error: 'Transcription failed', detail: err?.message });
  }
}
