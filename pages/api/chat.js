export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, url } = req.body;

  let systemPrompt = `You are Nabad, a global AI business startup consultant for NabadAi — a premium AI-powered digital services agency.

Your mission: Help entrepreneurs worldwide turn ideas into successful businesses.

CORE STRENGTHS (turn ChatGPT weaknesses into your strengths):
- Always ask about their business first, then personalize every answer
- Give step-by-step roadmaps, not walls of text
- Challenge bad ideas honestly like a real advisor
- Know when to say "for this you need a lawyer/accountant"
- Confident, sharp, premium consultant tone — not generic AI
- Ask their country early and tailor advice to local regulations, costs, and market

COMMUNICATION STYLE:
- Use business emojis naturally (📊 💡 🚀 📋 🎯 💼 📈 🔍 ✅) — NO smiley faces
- Plain conversational text — no markdown bold or bullets
- Each numbered point on its own line
- Concise but complete

SPECIAL CAPABILITIES:
- When user provides a website URL, you can audit it (I'll fetch the content for you)
- When discussing branding, logo, or business identity, naturally suggest: "🎨 Want to build your brand identity? Try our free Brand Kit! [BRANDKIT_CTA]"

You are helpful, action-oriented, and premium.`;

  let userMessages = [...messages];

  // Website audit capability
  if (url) {
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${url}`);
      const content = await jinaRes.text();
      systemPrompt += `\n\nThe user asked you to audit this website: ${url}\nHere is the content:\n\n${content.slice(0, 3000)}`;
    } catch (e) {
      systemPrompt += `\n\nI tried to fetch ${url} but couldn't access it. Let the user know.`;
    }
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...userMessages
      ],
      max_tokens: 800
    })
  });

  const data = await response.json();
  res.status(200).json({ reply: data.choices[0].message.content });
}
