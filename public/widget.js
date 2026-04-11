(function () {
  const LOGO = 'https://nabadai-chat.vercel.app/logo.png';
  const BRANDKIT_URL = 'https://nabadai-brandkit-ft995hk2l-nabadais-projects.vercel.app';

  // Load DM Sans + Cairo fonts
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Cairo:wght@400;600;700&display=swap';
  document.head.appendChild(fontLink);

  const style = document.createElement('style');
  style.textContent = `
    #nabad-widget * { box-sizing: border-box; font-family: 'DM Sans', 'Cairo', sans-serif; }
    #nabad-bubble {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      width: 56px; height: 56px; border-radius: 50%;
      background: transparent; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s ease;
    }
    #nabad-bubble:hover { transform: scale(1.08); }
    #nabad-bubble img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; }
    #nabad-window {
      position: fixed; bottom: 90px; right: 24px; z-index: 9999;
      width: 360px; height: 580px; border-radius: 16px;
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
      background: #E0F7FF;
    }
    #nabad-header img { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
    #nabad-header .dot {
      width: 8px; height: 8px; border-radius: 50%; background: #2D4EE8;
      box-shadow: 0 0 8px rgba(45,78,232,0.6); animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    #nabad-header span { color: #1a1a1a; font-weight: 600; font-size: 15px; }
    #nabad-avatar {
      margin-left: auto; width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, #2D4EE8, #00D4FF);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 12px; font-weight: 700; cursor: pointer;
      position: relative; flex-shrink: 0;
    }
    #nabad-signin-btn {
      margin-left: auto; background: none; border: 1px solid rgba(0,212,255,0.4);
      border-radius: 8px; padding: 4px 10px; color: #2D4EE8;
      font-size: 12px; font-weight: 600; cursor: pointer;
    }
    #nabad-avatar-dropdown {
      position: absolute; top: 38px; right: 0; background: #fff;
      border: 1px solid rgba(0,212,255,0.2); border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.1); width: 180px;
      display: none; flex-direction: column; z-index: 99999; overflow: hidden;
    }
    #nabad-avatar-dropdown.open { display: flex; }
    .nabad-dropdown-item {
      padding: 10px 14px; font-size: 13px; color: #999;
      cursor: not-allowed; display: flex; align-items: center; gap: 8px;
      border-bottom: 1px solid rgba(0,212,255,0.08);
    }
    .nabad-dropdown-item:last-child { border-bottom: none; }
    .nabad-dropdown-item span.soon {
      margin-left: auto; font-size: 10px; background: #f0f0f0;
      border-radius: 4px; padding: 2px 5px; color: #aaa;
    }
    #nabad-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
      background: #f7f8fc;
    }
    #nabad-messages::-webkit-scrollbar { width: 4px; }
    #nabad-messages::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.3); border-radius: 4px; }
    .nabad-msg {
      max-width: 80%; padding: 10px 14px; border-radius: 12px;
      font-size: 16px; line-height: 1.6; white-space: pre-line;
    }
    .nabad-msg.bot {
      background: transparent; color: #1a1a1a;
      border: none; align-self: flex-start;
      box-shadow: none; padding-left: 4px;
    }
    .nabad-msg.user {
      background: #E0F7FF; color: #1a1a1a;
      border: none; align-self: flex-end;
      box-shadow: 0 2px 8px rgba(0,212,255,0.15);
    }
    .nabad-typing { display: flex; gap: 4px; align-items: center; padding: 10px 14px; }
    .nabad-typing span {
      width: 6px; height: 6px; border-radius: 50%;
      background: linear-gradient(135deg, #2D4EE8, #00D4FF);
      animation: nabadBounce 1.2s infinite;
    }
    .nabad-typing span:nth-child(2) { animation-delay: 0.2s; }
    .nabad-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes nabadBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
    .nabad-brandkit-btn {
      margin-top: 8px; display: inline-block;
      background: linear-gradient(135deg, #2D4EE8, #00D4FF);
      color: #fff; border: none; border-radius: 10px;
      padding: 10px 16px; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: opacity 0.2s;
    }
    .nabad-brandkit-btn:hover { opacity: 0.85; }
    #nabad-save-banner {
      margin: 0 12px; padding: 10px 14px; background: #E0F7FF;
      border-radius: 10px; font-size: 13px; color: #1a1a1a;
      display: flex; align-items: center; justify-content: space-between;
      border: 1px solid rgba(0,212,255,0.3);
    }
    #nabad-save-banner button {
      background: none; border: none; color: #999;
      cursor: pointer; font-size: 16px; line-height: 1;
    }
    #nabad-lead {
      padding: 20px; display: flex; flex-direction: column; gap: 12px;
      background: #f7f8fc;
    }
    #nabad-lead p { color: #444; font-size: 14px; margin: 0 0 4px; }
    #nabad-lead input {
      background: #ffffff; border: 1px solid rgba(0,212,255,0.2);
      border-radius: 10px; padding: 10px 14px; color: #1a1a1a; font-size: 14px;
      outline: none; transition: border-color 0.3s; font-family: 'DM Sans', sans-serif;
    }
    #nabad-lead input:focus { border-color: rgba(0,212,255,0.6); }
    #nabad-lead button {
      background: linear-gradient(135deg, #2D4EE8, #00D4FF); color: #ffffff; border: none;
      border-radius: 10px; padding: 11px; font-weight: 700;
      font-size: 14px; cursor: pointer; transition: opacity 0.2s;
      font-family: 'DM Sans', sans-serif;
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
      padding: 10px 14px; color: #1a1a1a; font-size: 14px;
      outline: none; resize: none; transition: border-color 0.3s;
      font-family: 'DM Sans', sans-serif;
    }
    #nabad-input:focus { border-color: rgba(0,212,255,0.6); }
    #nabad-send {
      width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
      background: linear-gradient(135deg, #2D4EE8, #00D4FF);
      border: none; cursor: pointer; display: flex;
      align-items: center; justify-content: center;
    }
    #nabad-send svg { width: 16px; height: 16px; fill: #fff; }

    /* Brand Kit Modal */
    #nabad-modal-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0,0,0,0.75); display: none;
      align-items: center; justify-content: center;
    }
    #nabad-modal-overlay.open { display: flex; }
    #nabad-modal {
      width: 90vw; max-width: 900px; height: 85vh;
      background: #fff; border-radius: 16px; overflow: hidden;
      display: flex; flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    #nabad-modal-header {
      padding: 14px 20px; background: #E0F7FF;
      border-bottom: 1px solid rgba(0,212,255,0.2);
      display: flex; align-items: center; justify-content: space-between;
    }
    #nabad-modal-header span { font-weight: 700; font-size: 15px; color: #1a1a1a; }
    #nabad-modal-close {
      background: none; border: none; font-size: 22px;
      cursor: pointer; color: #666; line-height: 1;
    }
    #nabad-modal iframe { flex: 1; border: none; width: 100%; height: 100%; }
  `;
  document.head.appendChild(style);

  const widget = document.createElement('div');
  widget.id = 'nabad-widget';
  widget.innerHTML = `
    <div id="nabad-bubble"><img src="${LOGO}" alt="Nabad" /></div>
    <div id="nabad-window">
      <div id="nabad-header">
        <img src="${LOGO}" alt="Nabad" />
        <div class="dot"></div>
        <span>Nabad</span>
        <button id="nabad-signin-btn">Sign In</button>
        <div id="nabad-avatar" style="display:none">
          <span id="nabad-avatar-initials">?</span>
          <div id="nabad-avatar-dropdown">
            <div class="nabad-dropdown-item">👤 My Profile <span class="soon">Soon</span></div>
            <div class="nabad-dropdown-item">🏢 Business Settings <span class="soon">Soon</span></div>
            <div class="nabad-dropdown-item">💬 Chat History <span class="soon">Soon</span></div>
            <div class="nabad-dropdown-item">🚪 Sign Out <span class="soon">Soon</span></div>
          </div>
        </div>
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

    <!-- Brand Kit Modal -->
    <div id="nabad-modal-overlay">
      <div id="nabad-modal">
        <div id="nabad-modal-header">
          <span>🎨 NabadAi Brand Kit</span>
          <button id="nabad-modal-close">✕</button>
        </div>
        <iframe src="" id="nabad-modal-iframe" loading="lazy"></iframe>
      </div>
    </div>
  `;
  document.body.appendChild(widget);

  // Elements
  const bubble = document.getElementById('nabad-bubble');
  const win = document.getElementById('nabad-window');
  const messages = document.getElementById('nabad-messages');
  const footer = document.getElementById('nabad-footer');
  const lead = document.getElementById('nabad-lead');
  const input = document.getElementById('nabad-input');
  const send = document.getElementById('nabad-send');
  const startBtn = document.getElementById('nabad-start');
  const avatar = document.getElementById('nabad-avatar');
  const avatarInitials = document.getElementById('nabad-avatar-initials');
  const avatarDropdown = document.getElementById('nabad-avatar-dropdown');
  const signinBtn = document.getElementById('nabad-signin-btn');
  const modalOverlay = document.getElementById('nabad-modal-overlay');
  const modalClose = document.getElementById('nabad-modal-close');
  const modalIframe = document.getElementById('nabad-modal-iframe');

  // Load from localStorage
  let history = JSON.parse(localStorage.getItem('nabad_history') || '[]');
  let userName = localStorage.getItem('nabad_user_name') || '';
  let botMessageCount = 0;
  let saveBannerShown = false;
  let isOpen = false;

  // If returning user, skip lead form
  if (userName) {
    showAvatar(userName);
    lead.style.display = 'none';
    messages.style.display = 'flex';
    footer.style.display = 'flex';
    history.forEach(m => renderMessage(m.role === 'assistant' ? 'bot' : 'user', m.content, false));
    if (history.length === 0) {
      addMessage('bot', `Welcome back, ${userName}! 👋 Ready to continue building your business?`);
    }
  }

  // Avatar
  function showAvatar(name) {
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    avatarInitials.textContent = initials;
    avatar.style.display = 'flex';
    signinBtn.style.display = 'none';
  }

  avatar.addEventListener('click', (e) => {
    e.stopPropagation();
    avatarDropdown.classList.toggle('open');
  });
  document.addEventListener('click', () => avatarDropdown.classList.remove('open'));

  // Bubble toggle
  bubble.addEventListener('click', () => {
    isOpen = !isOpen;
    win.style.display = isOpen ? 'flex' : 'none';
  });

  // Start conversation
  startBtn.addEventListener('click', () => {
    const name = document.getElementById('nabad-name').value.trim();
    const email = document.getElementById('nabad-email').value.trim();
    if (!name || !email) return;
    userName = name;
    localStorage.setItem('nabad_user_name', name);
    showAvatar(name);
    lead.style.display = 'none';
    messages.style.display = 'flex';
    footer.style.display = 'flex';
    addMessage('bot', `Welcome, ${name}! 🚀 I'm Nabad, your AI business consultant. Where in the world are you based, and what are you working on?`);
  });

  // Render message without saving to history (for restoring)
  function renderMessage(role, text, save = true) {
    const hasBrandKit = text.includes('[BRANDKIT_CTA]');
    const cleanText = text.replace('[BRANDKIT_CTA]', '').trim();

    const div = document.createElement('div');
    div.className = `nabad-msg ${role}`;
    div.textContent = cleanText;
    messages.appendChild(div);

    if (hasBrandKit) {
      const btn = document.createElement('button');
      btn.className = 'nabad-brandkit-btn';
      btn.textContent = '🎨 Launch Brand Kit →';
      btn.addEventListener('click', openBrandKit);
      messages.appendChild(btn);
    }

    messages.scrollTop = messages.scrollHeight;

    if (save) {
      history.push({ role: role === 'bot' ? 'assistant' : 'user', content: text });
      localStorage.setItem('nabad_history', JSON.stringify(history));
    }

    if (role === 'bot') {
      botMessageCount++;
      if (botMessageCount >= 3 && !saveBannerShown) showSaveBanner();
    }
  }

  function addMessage(role, text) {
    renderMessage(role, text, true);
  }

  function showSaveBanner() {
    saveBannerShown = true;
    const banner = document.createElement('div');
    banner.id = 'nabad-save-banner';
    banner.innerHTML = `<span>💾 Save your conversation — Sign in free</span><button id="nabad-dismiss-banner">✕</button>`;
    messages.appendChild(banner);
    messages.scrollTop = messages.scrollHeight;
    document.getElementById('nabad-dismiss-banner').addEventListener('click', () => banner.remove());
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

  // Detect URL in message for audit
  function extractUrl(text) {
    const match = text.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : null;
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMessage('user', text);
    showTyping();

    const url = extractUrl(text);

    try {
      const res = await fetch(window.NABAD_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, url: url || undefined })
      });
      const data = await res.json();
      removeTyping();
      addMessage('bot', data.reply);
    } catch (e) {
      removeTyping();
      addMessage('bot', 'Something went wrong. Please try again.');
    }
  }

  // Brand Kit Modal
  function openBrandKit() {
    modalIframe.src = BRANDKIT_URL;
    modalOverlay.classList.add('open');
  }
  modalClose.addEventListener('click', () => {
    modalOverlay.classList.remove('open');
    modalIframe.src = '';
  });
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove('open');
      modalIframe.src = '';
    }
  });

  send.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
})();
