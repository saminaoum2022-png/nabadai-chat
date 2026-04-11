(function () {
  const LOGO = 'https://nabadai-chat.vercel.app/logo.png';
  const BRANDKIT_URL = 'https://nabadai-brandkit-ft995hk2l-nabadais-projects.vercel.app';

  const style = document.createElement('style');
  style.textContent = `
    #nabad-widget * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
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
      width: 370px; height: 600px; border-radius: 20px;
      background: #f7f8fc; border: 1px solid rgba(0,212,255,0.2);
      box-shadow: 0 8px 40px rgba(0,0,0,0.14), 0 0 20px rgba(0,212,255,0.08);
      display: none; flex-direction: column; overflow: hidden;
      animation: nabadSlideUp 0.3s ease;
    }
    @keyframes nabadSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* HEADER */
    #nabad-header {
      padding: calc(14px + env(safe-area-inset-top)) 20px 14px 20px; border-bottom: 1px solid rgba(0,212,255,0.15);
      display: flex; align-items: center; gap: 10px;
      background: linear-gradient(135deg, #E8F4FF, #E0F7FF);
    }
    
    #nabad-header::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: env(safe-area-inset-top);
  background: #E8F4FF;
  z-index: 9999;
}

    #nabad-header img { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; }
    #nabad-header .dot {
      width: 8px; height: 8px; border-radius: 50%; background: #2D4EE8;
      box-shadow: 0 0 8px rgba(45,78,232,0.6); animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    #nabad-header span { color: #1a1a1a; font-weight: 700; font-size: 15px; }

    /* AVATAR */
    #nabad-avatar {
      margin-left: auto; width: 34px; height: 34px; border-radius: 50%;
      background: linear-gradient(135deg, #2D4EE8, #00D4FF);
      display: none; align-items: center; justify-content: center;
      color: #fff; font-size: 12px; font-weight: 700; cursor: pointer;
      position: relative; flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(45,78,232,0.3);
      transition: transform 0.2s;
    }
    #nabad-avatar:hover { transform: scale(1.08); }
    #nabad-signin-btn {
      margin-left: auto; background: linear-gradient(135deg, #2D4EE8, #00D4FF);
      border: none; border-radius: 8px; padding: 6px 12px; color: #fff;
      font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;
    }
    #nabad-signin-btn:hover { opacity: 0.85; }

    /* PREMIUM DROPDOWN */
    #nabad-avatar-dropdown {
      position: absolute; top: 42px; right: 0;
      background: #ffffff;
      border: 1px solid rgba(0,212,255,0.15);
      border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,212,255,0.05);
      width: 220px; display: none; flex-direction: column;
      z-index: 99999; overflow: hidden;
      animation: dropdownFade 0.2s ease;
    }
    @keyframes dropdownFade {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    #nabad-avatar-dropdown.open { display: flex; }
    #nabad-dropdown-profile {
      padding: 14px 16px; background: linear-gradient(135deg, #E8F4FF, #E0F7FF);
      border-bottom: 1px solid rgba(0,212,255,0.15);
    }
    #nabad-dropdown-profile .profile-name { font-weight: 700; font-size: 14px; color: #1a1a1a; }
    #nabad-dropdown-profile .profile-company { font-size: 12px; color: #00A8CC; margin-top: 2px; }
    #nabad-dropdown-profile .profile-location { font-size: 11px; color: #888; margin-top: 2px; }
    .nabad-dropdown-item {
      padding: 11px 16px; font-size: 13px; color: #bbb;
      cursor: not-allowed; display: flex; align-items: center; gap: 10px;
      transition: background 0.15s;
      border-bottom: 1px solid rgba(0,0,0,0.04);
    }
    .nabad-dropdown-item:last-child { border-bottom: none; }
    .nabad-dropdown-item .soon {
      margin-left: auto; font-size: 10px; background: #f5f5f5;
      border-radius: 4px; padding: 2px 6px; color: #bbb; font-weight: 500;
    }
    .nabad-dropdown-signout {
      padding: 11px 16px; font-size: 13px; color: #ff4d4d;
      cursor: pointer; display: flex; align-items: center; gap: 10px;
      transition: background 0.15s;
    }
    .nabad-dropdown-signout:hover { background: #fff5f5; }

    /* MESSAGES */
    #nabad-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
      background: #f7f8fc;
    }
    
#nabad-messages img {
  width: 100%;
  max-width: 100%;
  border-radius: 12px;
  margin-top: 12px; 
  margin-bottom: 8px; 
  display: block;
}

#nabad-messages img.loading {
  height: 220px;
  background: linear-gradient(135deg, #f0f4ff, #e8f7ff);
  animation: nabadBorderGlow 3s linear infinite;
  filter: blur(0px);
}

    #nabad-messages::-webkit-scrollbar { width: 4px; }
    #nabad-messages::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.3); border-radius: 4px; }
    .nabad-msg {
      max-width: 85%; padding: 11px 15px; border-radius: 14px;
      font-size: 15px; line-height: 1.65;
    }
    .nabad-msg.bot {
      background: #ffffff; color: #1a1a1a;
      align-self: flex-start;
      box-shadow: 0 2px 12px rgba(0,0,0,0.07);
      border: 1px solid rgba(0,212,255,0.12);
      border-bottom-left-radius: 4px;
    }
    .nabad-msg.bot ul { padding-left: 18px; margin: 6px 0; }
    .nabad-msg.bot li { margin-bottom: 4px; }
    .nabad-msg.user {
      background: linear-gradient(135deg, #2D4EE8, #00D4FF);
      color: #ffffff; align-self: flex-end;
      box-shadow: 0 2px 12px rgba(45,78,232,0.25);
      border-bottom-right-radius: 4px;
    }
    .nabad-typing { display: flex; gap: 4px; align-items: center; padding: 12px 15px;
      background: #ffffff; border-radius: 14px; border-bottom-left-radius: 4px;
      align-self: flex-start; box-shadow: 0 2px 12px rgba(0,0,0,0.07);
      border: 1px solid rgba(0,212,255,0.12);
    }
    .nabad-typing span {
      width: 6px; height: 6px; border-radius: 50%;
      background: linear-gradient(135deg, #2D4EE8, #00D4FF);
      animation: nabadBounce 1.2s infinite;
    }
    .nabad-typing span:nth-child(2) { animation-delay: 0.2s; }
    .nabad-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes nabadBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
    @keyframes nabadBorderGlow {
  0%   { box-shadow: 4px 0 16px rgba(0,212,255,0.7), -4px 0 16px rgba(45,78,232,0.4); }
  25%  { box-shadow: 0 4px 16px rgba(45,78,232,0.7), 0 -4px 16px rgba(0,212,255,0.4); }
  50%  { box-shadow: -4px 0 16px rgba(0,212,255,0.7), 4px 0 16px rgba(45,78,232,0.4); }
  75%  { box-shadow: 0 -4px 16px rgba(45,78,232,0.7), 0 4px 16px rgba(0,212,255,0.4); }
  100% { box-shadow: 4px 0 16px rgba(0,212,255,0.7), -4px 0 16px rgba(45,78,232,0.4); }
}


    /* BRAND KIT BUTTON */
    .nabad-brandkit-btn {
      margin-top: 8px; display: inline-block;
      background: linear-gradient(135deg, #2D4EE8, #00D4FF);
      color: #fff; border: none; border-radius: 10px;
      padding: 10px 16px; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: opacity 0.2s; align-self: flex-start;
    }
    .nabad-brandkit-btn:hover { opacity: 0.85; }

    /* SAVE BANNER */
    #nabad-save-banner {
      margin: 0 12px; padding: 10px 14px;
      background: linear-gradient(135deg, #E8F4FF, #E0F7FF);
      border-radius: 10px; font-size: 13px; color: #1a1a1a;
      display: flex; align-items: center; justify-content: space-between;
      border: 1px solid rgba(0,212,255,0.25);
    }
    #nabad-save-banner button {
      background: none; border: none; color: #999;
      cursor: pointer; font-size: 16px; line-height: 1; margin-left: 8px;
    }

    /* LEAD / PROFILE FORM */
    #nabad-lead {
      padding: calc(24px + env(safe-area-inset-top)) 20px 24px 20px; display: flex; flex-direction: column; gap: 12px;
      background: #f7f8fc; overflow-y: auto;
    }
    #nabad-lead h3 { font-size: 16px; font-weight: 700; color: #1a1a1a; margin: 0 0 4px; }
    #nabad-lead p { color: #666; font-size: 13px; margin: 0 0 8px; }
    #nabad-lead input, #nabad-lead select {
      background: #ffffff; border: 1px solid rgba(0,212,255,0.25);
      border-radius: 10px; padding: 11px 14px; color: #1a1a1a; font-size: 14px;
      outline: none; transition: border-color 0.3s; width: 100%;
      font-family: inherit;
    }
    #nabad-lead input:focus, #nabad-lead select:focus { border-color: rgba(0,212,255,0.6); }
    #nabad-lead select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%23999' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; }
    .nabad-lead-divider { display: flex; align-items: center; gap: 10px; color: #bbb; font-size: 12px; }
    .nabad-lead-divider::before, .nabad-lead-divider::after { content: ''; flex: 1; height: 1px; background: rgba(0,212,255,0.15); }
    #nabad-start {
      background: linear-gradient(135deg, #2D4EE8, #00D4FF); color: #ffffff; border: none;
      border-radius: 10px; padding: 12px; font-weight: 700;
      font-size: 14px; cursor: pointer; transition: opacity 0.2s; font-family: inherit;
    }
    #nabad-start:hover { opacity: 0.85; }
    #nabad-guest {
      background: none; border: 1px solid rgba(0,212,255,0.25);
      border-radius: 10px; padding: 11px; font-weight: 600;
      font-size: 13px; cursor: pointer; color: #666; transition: all 0.2s; font-family: inherit;
    }
    #nabad-guest:hover { border-color: rgba(0,212,255,0.5); color: #2D4EE8; }

    /* FOOTER */
    #nabad-footer {
      padding: 12px 16px; border-top: 1px solid rgba(0,212,255,0.1);
      display: none; gap: 8px; align-items: center; background: #ffffff;
    }
    #nabad-input {
      flex: 1; background: #f7f8fc; border: 1px solid rgba(0,212,255,0.2);
      border-radius: 10px; padding: 10px 14px; color: #1a1a1a; font-size: 14px;
      outline: none; resize: none; transition: border-color 0.3s; font-family: inherit;
    }
    #nabad-input:focus {
  border-color: rgba(0,212,255,0.6);
  animation: nabadBorderGlow 3s linear infinite;
}

    #nabad-send {
      width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
      background: linear-gradient(135deg, #2D4EE8, #00D4FF);
      border: none; cursor: pointer; display: flex;
      align-items: center; justify-content: center; transition: opacity 0.2s;
    }
    #nabad-send:hover { opacity: 0.85; }
    #nabad-send svg { width: 16px; height: 16px; fill: #fff; }
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
        <button id="nabad-signin-btn">Create Profile</button>
        <div id="nabad-avatar">
          <span id="nabad-avatar-initials">?</span>
          <div id="nabad-avatar-dropdown">
            <div id="nabad-dropdown-profile">
              <div class="profile-name" id="dd-name"></div>
              <div class="profile-company" id="dd-company"></div>
              <div class="profile-location" id="dd-location"></div>
            </div>
            <div class="nabad-dropdown-item">👤 My Profile <span class="soon">Soon</span></div>
            <div class="nabad-dropdown-item">🏢 Business Settings <span class="soon">Soon</span></div>
            <div class="nabad-dropdown-item">💬 Chat History <span class="soon">Soon</span></div>
            <div class="nabad-dropdown-item" id="nabad-new-chat">🔄 New Conversation</div>
            <div class="nabad-dropdown-signout" id="nabad-signout">🚪 Sign Out</div>
          </div>
        </div>
      </div>

      <div id="nabad-lead">
        <h3>👋 Welcome to Nabad</h3>
        <p>Your AI business consultant. Create a profile for personalized advice and saved memory.</p>
        <input id="nabad-name" type="text" placeholder="Your full name" />
        <input id="nabad-company" type="text" placeholder="Company / Business name" />
        <select id="nabad-industry">
          <option value="" disabled selected>Select your industry</option>
          <option>Technology</option>
          <option>Retail & E-commerce</option>
          <option>Food & Beverage</option>
          <option>Fashion & Apparel</option>
          <option>Professional Services</option>
          <option>Health & Wellness</option>
          <option>Real Estate</option>
          <option>Education</option>
          <option>Finance</option>
          <option>Other</option>
        </select>
        <input id="nabad-location" type="text" placeholder="Your country / city" />
        <button id="nabad-start">Create Profile & Start →</button>
        <div class="nabad-lead-divider">or</div>
        <button id="nabad-guest">Continue as Guest</button>
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

  // Elements
  const bubble = document.getElementById('nabad-bubble');
  const win = document.getElementById('nabad-window');
  const messages = document.getElementById('nabad-messages');
  const footer = document.getElementById('nabad-footer');
  const lead = document.getElementById('nabad-lead');
  const input = document.getElementById('nabad-input');
  const send = document.getElementById('nabad-send');
  const startBtn = document.getElementById('nabad-start');
  const guestBtn = document.getElementById('nabad-guest');
  const avatar = document.getElementById('nabad-avatar');
  const avatarInitials = document.getElementById('nabad-avatar-initials');
  const avatarDropdown = document.getElementById('nabad-avatar-dropdown');
  const signinBtn = document.getElementById('nabad-signin-btn');
  const signoutBtn = document.getElementById('nabad-signout');

  let isGuest = false;
  let botMessageCount = 0;
  let saveBannerShown = false;
  let isOpen = false;
  let profile = null;

  // Storage helpers
  function saveHistory(h) {
    if (!isGuest) localStorage.setItem('nabad_history', JSON.stringify(h));
    else sessionStorage.setItem('nabad_history_session', JSON.stringify(h));
  }
  function loadHistory() {
    if (!isGuest) return JSON.parse(localStorage.getItem('nabad_history') || '[]');
    return JSON.parse(sessionStorage.getItem('nabad_history_session') || '[]');
  }

  let history = [];

  // Check returning user
  const savedProfile = localStorage.getItem('nabad_profile');
  if (savedProfile) {
    profile = JSON.parse(savedProfile);
    history = loadHistory();
    showAvatar(profile);
    lead.style.display = 'none';
    messages.style.display = 'flex';
    footer.style.display = 'flex';
    history.forEach(m => renderMessage(m.role === 'assistant' ? 'bot' : 'user', m.content, false));
    if (history.length === 0) {
      addMessage('bot', `Welcome back, <b>${profile.name}</b>! 🚀 Ready to continue building <b>${profile.company}</b>?`);
    }
  }

  function showAvatar(p) {
    const initials = p.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    avatarInitials.textContent = initials;
    avatar.style.display = 'flex';
    signinBtn.style.display = 'none';
    document.getElementById('dd-name').textContent = p.name;
    document.getElementById('dd-company').textContent = p.company;
    document.getElementById('dd-location').textContent = `📍 ${p.location}`;
  }

  // Avatar dropdown
  avatar.addEventListener('click', (e) => {
    e.stopPropagation();
    avatarDropdown.classList.toggle('open');
  });
  document.addEventListener('click', () => avatarDropdown.classList.remove('open'));

  // Sign out
  signoutBtn.addEventListener('click', () => {
    localStorage.removeItem('nabad_profile');
    localStorage.removeItem('nabad_history');
    location.reload();
  });

  // Show profile form when clicking Create Profile
signinBtn.addEventListener('click', () => {
  messages.style.display = 'none';
  footer.style.display = 'none';
  lead.style.display = 'flex';
});

   // New conversation
  document.getElementById('nabad-new-chat').addEventListener('click', () => {
    history = [];
    saveHistory([]);
    messages.innerHTML = '';
    addMessage('bot', `What would you like to work on today, <b>${profile.name}</b>? 🚀`);
    avatarDropdown.classList.remove('open');
  });
  
  // Bubble toggle
  bubble.addEventListener('click', () => {
    isOpen = !isOpen;
    win.style.display = isOpen ? 'flex' : 'none';
  });

  // Create profile
  startBtn.addEventListener('click', () => {
    const name = document.getElementById('nabad-name').value.trim();
    const company = document.getElementById('nabad-company').value.trim();
    const industry = document.getElementById('nabad-industry').value;
    const location = document.getElementById('nabad-location').value.trim();
    if (!name || !company || !industry || !location) {
      alert('Please fill in all fields to create your profile.');
      return;
    }
    profile = { name, company, industry, location };
    isGuest = false;
    localStorage.setItem('nabad_profile', JSON.stringify(profile));
    history = [];
    showAvatar(profile);
    lead.style.display = 'none';
    messages.style.display = 'flex';
    footer.style.display = 'flex';
    addMessage('bot', `Profile created! Welcome, <b>${name}</b>! 🚀<br>I'm Nabad, your AI business consultant. I see you're in <b>${industry}</b> based in <b>${location}</b>. What are you working on?`);
  });

  // Guest mode
  guestBtn.addEventListener('click', () => {
    isGuest = true;
    profile = null;
    lead.style.display = 'none';
    messages.style.display = 'flex';
    footer.style.display = 'flex';
    history = [];
    addMessage('bot', `Welcome! 👋 I'm Nabad, your AI business consultant. I'm here to help you start and grow your business. Where are you based and what are you working on?`);
  });

  function renderMessage(role, text, save = true) {
    const hasBrandKit = text.includes('[BRANDKIT_CTA]');
    const cleanText = text.replace('[BRANDKIT_CTA]', '').trim();

    const div = document.createElement('div');
    div.className = `nabad-msg ${role}`;
    div.innerHTML = cleanText;

// Handle image loading state
const imgs = div.querySelectorAll('img');
imgs.forEach(img => {
  img.classList.add('loading');
  img.onload = () => img.classList.remove('loading');
  img.onerror = () => {
    img.classList.remove('loading');
    img.style.display = 'none';
  };
});

    messages.appendChild(div);

    if (hasBrandKit) {
      const btn = document.createElement('button');
      btn.className = 'nabad-brandkit-btn';
      btn.textContent = '🎨 Launch Brand Kit →';
      btn.addEventListener('click', () => window.open(BRANDKIT_URL, '_blank'));
      messages.appendChild(btn);
    }

    messages.scrollTop = messages.scrollHeight;

    if (save) {
      history.push({ role: role === 'bot' ? 'assistant' : 'user', content: text });
      saveHistory(history);
    }

    if (role === 'bot') {
      botMessageCount++;
      if (botMessageCount >= 3 && !saveBannerShown && isGuest) showSaveBanner();
    }
  }

  function addMessage(role, text) { renderMessage(role, text, true); }

  function showSaveBanner() {
    saveBannerShown = true;
    const banner = document.createElement('div');
    banner.id = 'nabad-save-banner';
    banner.innerHTML = `<span>💾 Save your conversation — <b>Create free profile</b></span><button id="nabad-dismiss-banner">✕</button>`;
    messages.appendChild(banner);
    messages.scrollTop = messages.scrollHeight;
    document.getElementById('nabad-dismiss-banner').addEventListener('click', () => banner.remove());
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'nabad-typing';
    div.id = 'nabad-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function removeTyping() {
    const t = document.getElementById('nabad-typing');
    if (t) t.remove();
  }

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
        body: JSON.stringify({ messages: history, url: url || undefined, profile: profile || undefined })
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
