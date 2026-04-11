export default async function handler(req, res) {
  const { messages, urlContent } = req.body;

  const systemPrompt = `You are Nabad, an expert AI business consultant...
${urlContent ? `\n\nThe user has shared a website for audit. Here is its content:\n${urlContent}\n\nAnalyze it and provide a detailed audit covering: design, messaging, CTA, SEO basics, mobile experience, and trust signals.` : ''}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'system', content: systemPrompt }, ...messages]
    })
  });

  const data = await response.json();
  res.status(200).json({ reply: data.choices[0].message.content });
}
