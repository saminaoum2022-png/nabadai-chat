(function () {
  const LOGO = 'https://nabadai-chat.vercel.app/logo.png';
  const style = document.createElement('style');
  style.textContent = `
    #nabad-widget * { box-sizing: border-box; font-family: 'Inter', sans-serif; }
    @keyframes nabadRotateGlow {
      0% { box-shadow: 0 0 20px rgba(0,212,255,0.6), 0 0 40px rgba(0,180,216,0.3); }
      50% { box-shadow: 0 0 30px rgba(0,180,216,0.6), 0 0 60px rgba(0,212,255,0.3); }
      100% { box-shadow: 0 0 20px rgba(0,212,255,0.6), 0 0 40px rgba(0,180,216,0.3); }
    }
    #nabad-bubble {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #00D4FF, #00B4D8);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      animation: nabadRotateGlow 2.5s ease-in-out infinite;
      transition: transform 0.2s ease;
    }
    #nabad-bubble:hover { transform: scale(1.08); }
    #nabad-bubble svg { width: 24px; height: 24px; fill: #ffffff; }
    #nabad-window {
      position: fixed; bottom: 90px; right: 24px; z-index: 9999;
      width: 360px; height: 540px; border-radius: 16px;
      background: #ffffff; border: 1px solid rgba(0,212,255,0.2);
      box-shadow: 0 8px 40px rgba(0,0,0,0.12), 0 0 20px rgba(0,212,255,0.08);
      display: none; flex-direction: column; overflow: hidden;
      animation: nabadSlideUp 0.3s ease;
    }
    @keyframes nabadSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    #nabad-header {
      padding: 14px 20px; border-bottom: 1px solid rgba(0,212,255,0.2);
      display: flex; align-items: center; gap: 10px;
      background: linear-gradient(135deg, #00D4FF, #00B4D8);
    }
    #nabad-header img {
      width: 28px; height: 28px; border-radius: 50%; object-fit: cover;
    }
    #nabad-header .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 0 8px rgba(255,255,255,0.8); animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    #nabad-header span { color: #ffffff; font-weight: 600; font-size: 15px; }
    #nabad-header small { color: rgba(255,255,255,0.8); font-size: 11px; margin-left: auto; }
    #nabad-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
      background: #f7f8fc;
    }
    #nabad-messages::-webkit-scrollbar { width: 4px; }
    #nabad-messages::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.3); border-radius: 4px; }
    .nabad-msg {
      max-width: 80%; padding: 10px 14px; border-radius: 12px;
      font-size: 13px; line-height: 1.6; white-space: pre-line;
    }
    .nabad-msg.bot {
      background: #ffffff; color: #1a1a1a;
      border: 1px solid rgba(0,212,255,0.15); align-self: flex-start;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .nabad-msg.user {
      background: linear-gradient(135deg, #00D4FF, #00B4D8); color: #ffffff;
      border: none; align-self: flex-end;
      box-shadow: 0 2px 12px rgba(0,212,255,0.3);
    }
    .nabad-typing { display: flex; gap: 4px; align-items: center; padding: 10px 14px; }
    .nabad-typing span {
      width: 6px; height: 6px; border-radius: 50%;
      background: linear-gradient(135deg, #00D4FF, #00B4D8);
      animation: nabadBounce 1.2s infinite;
    }
    .nabad-typing span:nth-child(2) { animation-delay: 0.2s; }
    .nabad-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes nabadBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
    #nabad-lead {
      padding: 20px; display: flex; flex-direction: column; gap: 12px;
      background: #f7f8fc;
    }
    #nabad-lead p { color: #444; font-size: 13px; margin: 0 0 4px; }
    #nabad-lead input {
      background: #ffffff; border: 1px solid rgba(0,212,255,0.2);
      border-radius: 10px; padding: 10px 14px; color: #1a1a1a; font-size: 13px;
      outline: none; transition: border-color 0.3s, box-shadow 0.3s;
    }
    #nabad-lead input:focus {
      border-color: rgba(0,212,255,0.7);
      animation: nabadInputGlow 2.5s ease-in-out infinite;
    }
    @keyframes nabadInputGlow {
      0% { box-shadow: 0 0 0 3px rgba(0,212,255,0.15), 0 0 20px rgba(0,212,255,0.3); }
      50% { box-shadow: 0 0 0 3px rgba(0,180,216,0.15), 0 0 20px rgba(0,180,216,0.3); }
      100% { box-shadow: 0 0 0 3px rgba(0,212,255,0.15), 0 0 20px rgba(0,212,255,0.3); }
    }
    #nabad-lead button {
      background: linear-gradient(135deg, #00D4FF, #00B4D8); color: #ffffff; border: none;
      border-radius: 10px; padding: 11px; font-weight: 700;
      font-size: 13px; cursor: pointer; transition: opacity 0.2s;
    }
    #nabad-lead button:hover { opacity: 0.85; }
    #nabad-footer {
      padding: 12px 16px; border-top: 1px solid rgba(0,212,255,0.1);
      display: none; gap: 8px; align-items: center;
      background: #ffffff;
    }
    #nabad-input {
      flex: 1; background: #f7f8fc;
      border: 1px solid rgba(0,212,255,0.2); border-radius: 10px;
      padding: 10px 14px; color: #1a1a1a; font-size: 13px;
      outline: none; resize: none; transition: border-color 0.3s;
    }
    #nabad-input:focus {
      border-color: rgba(0,212,255,0.7);
      animation: nabadInputGlow 2.5s ease-in-out infinite;
    }
    #nabad-send {
      background: linear-gradient(135deg, #00D4FF, #00B4D8); border: none; border-radius: 10px;
      width: 38px; height: 38px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: opacity 0.2s;
    }
    #nabad-send:hover { opacity: 0.85; }
    #nabad-send svg { width: 16px; height: 16px; fill: #ffffff; }
    @media(max-width:480px) {
      #nabad-window { width: calc(100vw - 32px); right: 16px; bottom: 80px; }
    }
  `;
  document.head.appendChild(style);

  const widget = document.createElement('div');
  widget.id = 'nabad-widget';
  widget.innerHTML = `
    <div id="nabad-bubble">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l4.93-1.37A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>
    </div>
    <div id="nabad-window">
      <div id="nabad-header">
        <img src="${LOGO}" alt="Nabad AI" />
        <span>Nabad AI</span>
        <div class="dot"></div>
        <small>NabadAi Assistant</small>
      </div>
      <div id="nabad-lead">
        <p>Before we begin, tell us a bit about yourself.</p>
        <input id="nabad-name" type="text" placeholder="Your name" />
        <input id="nabad-email" type="email" placeholder="Your email" />
        <button id="nabad-start">Start Conversation →</button>
      </div>
      <div id="nabad-messages" style="display:none"></div>
      <div id="nabad-footer">
        <textarea id="nabad-input" rows="1" placeholder="Ask Nabad anything..."></textarea>
        <button id="nabad-send">
          <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(widget);

  const bubble = document.getElementById('nabad-bubble');
  const win = document.getElementById('nabad-window');
  const messages = document.getElementById('nabad-messages');
  const footer = document.getElementById('nabad-footer');
  const lead = document.getElementById('nabad-lead');
  const input = document.getElementById('nabad-input');
  const send = document.getElementById('nabad-send');
  const startBtn = document.getElementById('nabad-start');

  let history = [];
  let isOpen = false;

  bubble.addEventListener('click', () => {
    isOpen = !isOpen;
    win.style.display = isOpen ? 'flex' : 'none';
  });

  startBtn.addEventListener('click', () => {
    const name = document.getElementById('nabad-name').value.trim();
    const email = document.getElementById('nabad-email').value.trim();
    if (!name || !email) return;
    lead.style.display = 'none';
    messages.style.display = 'flex';
    footer.style.display = 'flex';
    addMessage('bot', `Welcome, ${name}! I'm Nabad, your AI consultant. How can I help you today?`);
  });

  function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = `nabad-msg ${role}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    if (role !== 'typing') history.push({ role: role === 'bot' ? 'assistant' : 'user', content: text });
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'nabad-msg bot nabad-typing';
    div.id = 'nabad-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function removeTyping() {
    const t = document.getElementById('nabad-typing');
    if (t) t.remove();
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMessage('user', text);
    showTyping();
    try {
      const res = await fetch(window.NABAD_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });
      const data = await res.json();
      removeTyping();
      addMessage('bot', data.reply);
    } catch (e) {
      removeTyping();
      addMessage('bot', 'Something went wrong. Please try again.');
    }
  }

  send.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
})();
