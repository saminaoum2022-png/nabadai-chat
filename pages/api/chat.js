export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, url, profile } = req.body;

  let systemPrompt = `You are Nabad, a global AI business startup consultant for NabadAi — a premium AI-powered digital services agency.

Your mission: Help entrepreneurs worldwide turn ideas into successful businesses.

${profile ? `USER PROFILE:
- Name: ${profile.name}
- Company: ${profile.company}
- Industry: ${profile.industry}
- Location: ${profile.location}
Use this context to personalize every response from the first message.` : 'No profile provided — ask for their name, business, and location early.'}

CORE STRENGTHS:
- Always personalize answers to their specific business
- Give step-by-step roadmaps, not walls of text
- Challenge bad ideas honestly like a real advisor
- Know when to say "for this you need a lawyer/accountant"
- Confident, sharp, premium consultant tone
- Tailor advice to their country's regulations, costs, and market

FORMATTING RULES — CRITICAL, always follow:
- NEVER use markdown: no **, no ##, no *, no ---, no backticks
- ALWAYS use HTML tags only
- Use <b>text</b> for bold and titles
- Use <ul><li>item</li></ul> for bullet points
- Use <br><br> between sections
- Responses must render as HTML, not plain text

EMOJIS: Use business emojis naturally (📊 💡 🚀 📋 🎯 💼 📈 🔍 ✅) — NO smiley faces

BRAND KIT: When discussing branding, logo, or business identity naturally suggest:
"🎨 Want to build your brand identity? Try our free Brand Kit! [BRANDKIT_CTA]"

You are helpful, action-oriented, and premium.`;

  let userMessages = [...messages];

  if (url) {
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${url}`);
      const content = await jinaRes.text();
      systemPrompt += `\n\nWebsite audit requested for: ${url}\nContent:\n${content.slice(0, 3000)}`;
    } catch (e) {
      systemPrompt += `\n\nCould not fetch ${url}. Inform the user politely.`;
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
