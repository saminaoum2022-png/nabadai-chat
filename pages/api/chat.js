import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const ALLOWED_ORIGINS = [
  'https://nabadai.com',
  'https://www.nabadai.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
];

const ALLOWED_VERCEL_PREFIXES = ['nabadai'];

function isAllowedOrigin(origin = '') {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return ALLOWED_VERCEL_PREFIXES.some(p => host.startsWith(p) && host.endsWith('.vercel.app'));
  } catch { return false; }
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT = { windowMs: 60_000, maxRequests: 20 };
function isRateLimited(ip = '') {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_LIMIT.windowMs) { rateLimitMap.set(ip, { count: 1, start: now }); return false; }
  if (entry.count >= RATE_LIMIT.maxRequests) return true;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return false;
}

const SHOW_IMAGE_DEBUG = false;
const FOUNDER_MEMORY_TABLE = 'founder_memory';
let _pdfParse = null;
let _mammoth = null;
let _xlsx = null;

function normalizeMemoryKey(raw = '') {
  return String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9:_\-\.]/g, '')
    .slice(0, 120);
}

function inferStageFromText(text = '') {
  const t = text.toLowerCase();
  if (/\b(idea|pre-launch|prelaunch|still figuring|validation)\b/.test(t)) return 'idea';
  if (/\b(just started|new business|first clients|first sales|early stage)\b/.test(t)) return 'early';
  if (/\b(growing|scale|scaling|expanding|team)\b/.test(t)) return 'growing';
  if (/\b(established|mature|multi-?country|enterprise)\b/.test(t)) return 'scaling';
  return '';
}

function inferBottleneckFromText(text = '') {
  const t = text.toLowerCase();
  if (/\b(no clients|not enough clients|lead|traffic|acquisition)\b/.test(t)) return 'acquisition';
  if (/\b(conversion|closing|sales|offer not converting)\b/.test(t)) return 'conversion';
  if (/\b(cash flow|profit|margin|pricing)\b/.test(t)) return 'unit_economics';
  if (/\b(team|hiring|operations|delivery)\b/.test(t)) return 'operations';
  if (/\b(positioning|brand|messaging|differentiation)\b/.test(t)) return 'positioning';
  return '';
}

function mergeStringList(existing = [], incoming = [], max = 10) {
  const out = [];
  const push = (value = '') => {
    const clean = cleanText(String(value || ''), 180);
    if (!clean) return;
    const exists = out.some(v => v.toLowerCase() === clean.toLowerCase());
    if (!exists) out.push(clean);
  };
  (Array.isArray(existing) ? existing : []).forEach(push);
  (Array.isArray(incoming) ? incoming : []).forEach(push);
  return out.slice(-max);
}

function inferLearningSignals(userMessage = '', detectedInfo = null, userLanguage = 'en') {
  const text = cleanText(userMessage, 1500);
  const lower = text.toLowerCase();
  const goals = [];
  const constraints = [];
  const preferences = [];

  const goalRegexes = [
    /\b(i want to|my goal is to|i need to|help me)\s+([^.!?\n]{8,140})/gi,
    /\b(reach|hit|grow to|scale to)\s+([^.!?\n]{3,120})/gi
  ];
  goalRegexes.forEach((rx) => {
    let match;
    while ((match = rx.exec(text)) !== null) {
      const snippet = cleanText(`${match[1]} ${match[2]}`, 140);
      if (snippet) goals.push(snippet);
    }
  });

  if (/\b(low budget|no budget|tight budget|limited budget|small budget)\b/i.test(lower)) {
    constraints.push('budget is limited');
  }
  if (/\b(quick|fast|asap|urgent|immediately)\b/i.test(lower)) {
    constraints.push('needs speed');
  }
  if (/\b(legal|regulation|compliance|license|paperwork|law)\b/i.test(lower)) {
    constraints.push('needs legal-safe guidance');
  }
  if (/\b(solo|alone|one person|just me|small team)\b/i.test(lower)) {
    constraints.push('small team capacity');
  }

  if (/\b(step by step|steps|roadmap|plan)\b/i.test(lower)) preferences.push('prefers step-by-step plans');
  if (/\b(short|brief|concise)\b/i.test(lower)) preferences.push('prefers concise answers');
  if (/\b(detailed|deep dive|in detail)\b/i.test(lower)) preferences.push('prefers detailed answers');
  if (/\b(no fluff|direct|straight to the point)\b/i.test(lower)) preferences.push('prefers direct tone');

  const structured = detectedInfo && typeof detectedInfo === 'object' ? detectedInfo : {};

  return {
    language: userLanguage === 'ar' ? 'ar' : 'en',
    goals: mergeStringList([], goals, 8),
    constraints: mergeStringList([], constraints, 8),
    preferences: mergeStringList([], preferences, 8),
    knownFields: mergeStringList([], Object.entries(structured)
      .filter(([, v]) => typeof v === 'string' && v.trim())
      .map(([k, v]) => `${k}: ${v}`), 12)
  };
}

function mergeFounderMemory(current = {}, payload = {}) {
  const next = { ...(current || {}) };
  const profile = cleanText(payload.userProfile || '', 700);
  const conversationText = cleanText(payload.conversationText || '', 1200);
  const detectedInfo = payload.detectedInfo && typeof payload.detectedInfo === 'object'
    ? payload.detectedInfo
    : {};
  const learnSignals = payload.learnSignals && typeof payload.learnSignals === 'object'
    ? payload.learnSignals
    : {};

  if (profile) next.profile = profile;
  Object.entries(detectedInfo).forEach(([k, v]) => {
    if (v && typeof v === 'string') {
      if (!next.facts || typeof next.facts !== 'object') next.facts = {};
      next.facts[k] = cleanText(v, 240);
    }
  });

  const country = detectCountryFromContext(`${profile} ${conversationText}`);
  if (country) next.country = country;
  const industry = detectIndustryFromContext(`${profile} ${conversationText}`);
  if (industry && industry !== 'general') next.industry = industry;

  const stage = inferStageFromText(`${profile} ${conversationText}`);
  if (stage) next.stage = stage;
  const bottleneck = inferBottleneckFromText(`${profile} ${conversationText}`);
  if (bottleneck) next.bottleneck = bottleneck;

  if (!next.learning || typeof next.learning !== 'object') next.learning = {};
  if (learnSignals.language) next.learning.language = cleanText(learnSignals.language, 8);
  if (Array.isArray(learnSignals.goals)) {
    next.learning.goals = mergeStringList(next.learning.goals, learnSignals.goals, 12);
  }
  if (Array.isArray(learnSignals.constraints)) {
    next.learning.constraints = mergeStringList(next.learning.constraints, learnSignals.constraints, 12);
  }
  if (Array.isArray(learnSignals.preferences)) {
    next.learning.preferences = mergeStringList(next.learning.preferences, learnSignals.preferences, 12);
  }
  if (Array.isArray(learnSignals.knownFields)) {
    next.learning.knownFields = mergeStringList(next.learning.knownFields, learnSignals.knownFields, 18);
  }
  next.learning.updatedAt = new Date().toISOString();

  next.updatedAt = new Date().toISOString();
  return next;
}

function memoryToProfileString(memory = {}) {
  const parts = [];
  if (memory.profile) parts.push(memory.profile);
  if (memory.country) parts.push(`Country: ${memory.country}`);
  if (memory.industry) parts.push(`Industry: ${memory.industry}`);
  if (memory.stage) parts.push(`Stage: ${memory.stage}`);
  if (memory.bottleneck) parts.push(`Bottleneck: ${memory.bottleneck}`);
  if (memory.learning?.goals?.length) parts.push(`Goals: ${memory.learning.goals.slice(0, 3).join('; ')}`);
  if (memory.learning?.constraints?.length) parts.push(`Constraints: ${memory.learning.constraints.slice(0, 3).join('; ')}`);
  if (memory.learning?.preferences?.length) parts.push(`Preferences: ${memory.learning.preferences.slice(0, 3).join('; ')}`);
  if (memory.facts && typeof memory.facts === 'object') {
    Object.entries(memory.facts).forEach(([k, v]) => {
      if (v) parts.push(`${k}: ${v}`);
    });
  }
  if (Array.isArray(memory.savedInsights) && memory.savedInsights.length) {
    const recent = memory.savedInsights
      .slice(-3)
      .map((item) => cleanText(item?.text || '', 180))
      .filter(Boolean);
    if (recent.length) parts.push(`Saved insights: ${recent.join(' ; ')}`);
  }
  return cleanText(parts.join(' | '), 950);
}

function normalizeMemoryField(raw = '') {
  const f = cleanText(raw, 80).toLowerCase();
  if (!f) return '';
  if (/\b(country|market|operating country|which country)\b/.test(f)) return 'country';
  if (/\b(location|city|where i am|where i'm based|where i am based|based in|from)\b/.test(f)) return 'location';
  if (/\b(industry|sector|niche|business type)\b/.test(f)) return 'industry';
  if (/\b(stage|business stage)\b/.test(f)) return 'stage';
  if (/\b(bottleneck|blocker|biggest block|constraint)\b/.test(f)) return 'bottleneck';
  if (/\b(name|business name|company name|brand name)\b/.test(f)) return 'businessName';
  if (/\b(offer|what i sell|product|service)\b/.test(f)) return 'whatYouSell';
  if (/\b(revenue|income|sales)\b/.test(f)) return 'revenue';
  if (/\b(challenge|problem|pain)\b/.test(f)) return 'biggestChallenge';
  if (/\b(customer|audience|target)\b/.test(f)) return 'targetCustomer';
  if (/\b(idea|vision)\b/.test(f)) return 'ideaSummary';
  if (/\b(progress|status|current progress)\b/.test(f)) return 'currentProgress';
  if (/\b(skill|strength|expertise)\b/.test(f)) return 'skills';
  if (/\b(preference|style|tone)\b/.test(f)) return 'preference';
  if (/\b(time|availability|time commitment)\b/.test(f)) return 'timeCommitment';
  return '';
}

function parseMemoryCommand(userMessage = '', replyTo = null) {
  const text = cleanText(userMessage, 1200);
  const lower = text.toLowerCase();
  if (!text) return null;

  // Only save when user is explicit about memory intent.
  const hasExplicitMemoryTarget = /\b(memory|remember this)\b/i.test(text);
  const trailingSaveMatch = hasExplicitMemoryTarget
    ? text.match(/^(.+?)\s+(?:then\s+)?(?:remember|save|store|add)\s+this(?:\s+to\s+memory)?$/i)
    : null;
  if (trailingSaveMatch) {
    const note = cleanText(trailingSaveMatch[1] || '', 420);
    if (note) return { type: 'save_note', note };
  }

  const saveMatch = hasExplicitMemoryTarget
    ? text.match(/\b(?:remember|save|store|add)\b(?:\s+this)?(?:\s+to\s+memory)?\s*[:\-]?\s*(.*)$/i)
    : null;
  if (saveMatch && /\b(?:remember|save|store|add)\b/.test(lower)) {
    const payload = cleanText(saveMatch[1] || '', 400);
    const note = payload || cleanText(replyTo?.snippet || '', 240);
    if (note) return { type: 'save_note', note };
  }

  const setMatch = text.match(/\b(?:update|set|change)\s+my\s+(.{2,60}?)\s+(?:to|as|is)\s+(.+)$/i);
  if (setMatch) {
    const field = normalizeMemoryField(setMatch[1] || '');
    const value = cleanText(setMatch[2] || '', 240);
    if (field && value) return { type: 'set_field', field, value };
  }

  const forgetMatch = text.match(/\b(?:forget|delete|remove|clear)\s+(?:my\s+)?(.{2,80}?)(?:\s+from\s+memory|\s+memory)?$/i);
  if (forgetMatch && !/\b(all|everything)\b/i.test(forgetMatch[1] || '')) {
    const field = normalizeMemoryField(forgetMatch[1] || '');
    if (field) return { type: 'delete_field', field };
    const phrase = cleanText(forgetMatch[1] || '', 180);
    if (phrase && /\bthis\b/i.test(phrase)) {
      const note = cleanText(replyTo?.snippet || '', 240);
      if (note) return { type: 'delete_note', note };
    }
  }

  if (/\b(forget|clear|delete|remove)\s+(all|everything)\b.*\bmemory\b/i.test(lower)) {
    return { type: 'clear_notes_only' };
  }

  return null;
}

function applyMemoryCommand(currentMemory = {}, command = null, userProfile = '') {
  const next = mergeFounderMemory(currentMemory || {}, {
    userProfile: cleanText(userProfile || '', 700),
    conversationText: ''
  });
  if (!command || typeof command !== 'object') {
    return { memory: next, changed: false, reply: '<p>No memory action detected.</p>' };
  }

  const ensureFacts = () => {
    if (!next.facts || typeof next.facts !== 'object') next.facts = {};
  };
  const removeFactKey = (key = '') => {
    if (!next.facts || typeof next.facts !== 'object') return;
    delete next.facts[key];
    if (Object.keys(next.facts).length === 0) delete next.facts;
  };

  if (command.type === 'save_note') {
    const note = cleanText(command.note || '', 420);
    if (!note) return { memory: next, changed: false, reply: '<p>I could not find what to save. Reply to a message and say “save this to memory”.</p>' };
    if (!Array.isArray(next.savedInsights)) next.savedInsights = [];
    next.savedInsights.push({ id: makeMemoryItemId(), text: note, savedAt: new Date().toISOString(), source: 'manual-chat' });
    next.savedInsights = next.savedInsights.slice(-180);
    if (!next.learning || typeof next.learning !== 'object') next.learning = {};
    next.learning.knownFields = mergeStringList(next.learning.knownFields, [`manual_note: ${note}`], 18);
    return { memory: next, changed: true, reply: `<p>Saved to memory: <strong>${escapeHtml(note)}</strong>.</p>` };
  }

  if (command.type === 'set_field') {
    const field = command.field;
    const value = cleanText(command.value || '', 240);
    if (!field || !value) return { memory: next, changed: false, reply: '<p>I need both a field and value. Example: “update my country to UAE”.</p>' };
    if (field === 'country') {
      next.country = detectCountryFromContext(value) || value.toUpperCase();
    } else if (field === 'industry') {
      const inferred = detectIndustryFromContext(value);
      next.industry = inferred !== 'general' ? inferred : value;
    } else if (field === 'stage') {
      next.stage = inferStageFromText(value) || value;
    } else if (field === 'bottleneck') {
      next.bottleneck = inferBottleneckFromText(value) || value;
    } else {
      ensureFacts();
      next.facts[field] = value;
    }
    return { memory: next, changed: true, reply: `<p>Updated memory: <strong>${escapeHtml(field)}</strong> = <strong>${escapeHtml(value)}</strong>.</p>` };
  }

  if (command.type === 'delete_field') {
    const field = command.field;
    if (!field) return { memory: next, changed: false, reply: '<p>I could not identify which memory field to remove.</p>' };
    if (field === 'country') delete next.country;
    else if (field === 'industry') delete next.industry;
    else if (field === 'stage') delete next.stage;
    else if (field === 'bottleneck') delete next.bottleneck;
    else removeFactKey(field);
    return { memory: next, changed: true, reply: `<p>Removed <strong>${escapeHtml(field)}</strong> from memory.</p>` };
  }

  if (command.type === 'delete_note') {
    const note = cleanText(command.note || '', 240);
    if (!note || !Array.isArray(next.savedInsights)) {
      return { memory: next, changed: false, reply: '<p>I could not find that saved memory note to remove.</p>' };
    }
    const before = next.savedInsights.length;
    next.savedInsights = next.savedInsights.filter((item) => !cleanText(item?.text || '', 240).includes(note));
    if (!next.savedInsights.length) delete next.savedInsights;
    return {
      memory: next,
      changed: before !== (next.savedInsights?.length || 0),
      reply: before !== (next.savedInsights?.length || 0)
        ? '<p>Removed that saved note from memory.</p>'
        : '<p>I could not find that saved note in memory.</p>'
    };
  }

  if (command.type === 'clear_notes_only') {
    delete next.savedInsights;
    return { memory: next, changed: true, reply: '<p>Cleared saved notes. Core profile memory is still intact.</p>' };
  }

  return { memory: next, changed: false, reply: '<p>No memory action detected.</p>' };
}

async function loadFounderMemory(memoryKey = '') {
  if (!supabase || !memoryKey) return null;
  try {
    const { data, error } = await supabase
      .from(FOUNDER_MEMORY_TABLE)
      .select('memory')
      .eq('memory_key', memoryKey)
      .maybeSingle();
    if (error) {
      console.error('[MEMORY LOAD ERROR]', error.message);
      return null;
    }
    return data?.memory && typeof data.memory === 'object' ? data.memory : null;
  } catch (err) {
    console.error('[MEMORY LOAD ERROR]', err?.message);
    return null;
  }
}

async function saveFounderMemory(memoryKey = '', memory = null) {
  if (!supabase || !memoryKey || !memory) return;
  try {
    const payload = {
      memory_key: memoryKey,
      memory,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase
      .from(FOUNDER_MEMORY_TABLE)
      .upsert(payload, { onConflict: 'memory_key' });
    if (error) console.error('[MEMORY SAVE ERROR]', error.message);
  } catch (err) {
    console.error('[MEMORY SAVE ERROR]', err?.message);
  }
}

// ── Text Utilities ────────────────────────────────────────────────────────────
function getMessageText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textPart = content.find(p => p.type === 'text');
    return textPart ? textPart.text : '';
  }
  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    return '';
  }
  return '';
}
function cleanText(val = '', maxLen = 300) {
  if (typeof val !== 'string') return '';
  return val.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function makeMemoryItemId() {
  return randomBytes(6).toString('hex');
}
function parseDataUrl(dataUrl = '') {
  const raw = String(dataUrl || '');
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  try {
    return {
      mime: (match[1] || '').toLowerCase(),
      buffer: Buffer.from(match[2], 'base64')
    };
  } catch {
    return null;
  }
}
async function parseAttachmentPayload(attachment = null) {
  if (!attachment || typeof attachment !== 'object') return null;
  const kind = cleanText(attachment.kind || '', 20).toLowerCase();
  const name = cleanText(attachment.name || 'attachment', 160);
  const type = cleanText(attachment.type || '', 120).toLowerCase();
  const text = cleanText(attachment.text || '', 12000);
  const dataUrl = String(attachment.dataUrl || '');

  if (kind === 'text' && text) {
    return {
      kind,
      name,
      type,
      summaryText: cleanText(text, 1200),
      parsedText: text.slice(0, 10000),
      imageDataUrl: ''
    };
  }

  if (kind === 'image' && dataUrl.startsWith('data:image/')) {
    return {
      kind,
      name,
      type,
      summaryText: `User attached an image named "${name}".`,
      parsedText: '',
      imageDataUrl: dataUrl
    };
  }

  if (kind !== 'document' || !dataUrl) return null;
  const parsed = parseDataUrl(dataUrl);
  if (!parsed || !parsed.buffer?.length) {
    return { kind, name, type, summaryText: `User attached ${name}.`, parsedText: '', imageDataUrl: '' };
  }

  const ext = (name.split('.').pop() || '').toLowerCase();
  const mime = parsed.mime || type;
  let parsedText = '';

  try {
    if (ext === 'pdf' || mime.includes('pdf')) {
      if (!_pdfParse) _pdfParse = (await import('pdf-parse')).default;
      const out = await _pdfParse(parsed.buffer);
      parsedText = cleanText(out?.text || '', 12000);
    } else if (ext === 'docx' || mime.includes('wordprocessingml')) {
      if (!_mammoth) _mammoth = (await import('mammoth')).default;
      const out = await _mammoth.extractRawText({ buffer: parsed.buffer });
      parsedText = cleanText(out?.value || '', 12000);
    } else if (ext === 'xlsx' || ext === 'xls' || mime.includes('spreadsheetml') || mime.includes('excel')) {
      if (!_xlsx) _xlsx = await import('xlsx');
      const wb = _xlsx.read(parsed.buffer, { type: 'buffer' });
      const sheetNames = wb?.SheetNames || [];
      parsedText = sheetNames.slice(0, 4).map((sheet) => {
        const ws = wb.Sheets[sheet];
        const csv = _xlsx.utils.sheet_to_csv(ws || {}, { blankrows: false });
        return `Sheet: ${sheet}\n${cleanText(csv, 2500)}`;
      }).join('\n\n');
      parsedText = cleanText(parsedText, 12000);
    }
  } catch (err) {
    console.error('[ATTACHMENT PARSE ERROR]', err?.message);
  }

  return {
    kind,
    name,
    type,
    summaryText: parsedText
      ? `User attached ${name}. Key extracted text is available below.`
      : `User attached ${name}, but text extraction was limited.`,
    parsedText: parsedText || '',
    imageDataUrl: ''
  };
}
function isValidEmail(value = '') {
  const v = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}
function detectPrimaryLanguage(text = '') {
  const sample = String(text || '');
  const arabicCount = (sample.match(/[\u0600-\u06FF]/g) || []).length;
  const latinCount = (sample.match(/[A-Za-z]/g) || []).length;
  if (arabicCount > latinCount * 1.2) return 'ar';
  if (latinCount > arabicCount * 1.2) return 'en';
  return 'en';
}
function normalizeRecoveryCode(value = '') {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}
function generateRecoveryCode() {
  return randomBytes(4).toString('hex').toUpperCase();
}
function recoveryCodeHash(code = '') {
  const pepper = process.env.NABAD_RECOVERY_PEPPER || process.env.OPENAI_API_KEY || 'nabad';
  return createHash('sha256').update(`${normalizeRecoveryCode(code)}:${pepper}`).digest('hex');
}
function sanitizePromptText(text = '') {
  return text.replace(/[<>{}|\\^`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 900);
}
function escapeHtml(str = '') {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function decodeMaybe(text = '') {
  try { return decodeURIComponent(text); } catch { return text; }
}
function tryParseJsonBlock(text = '') {
  try {
    const match = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const raw = match[1] !== undefined ? match[1] : match[0];
    return JSON.parse(raw.trim());
  } catch (e) { console.error('[JSON PARSE ERROR]', e?.message); return null; }
}
function normalizeList(val) {
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  if (typeof val === 'string') return val.split(/\n|,/).map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  return [];
}
function isValidHttpUrl(str = '') {
  try { const u = new URL(str); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}
function normalizeUrlCandidate(raw = '') {
  const input = cleanText(String(raw || ''), 500)
    .replace(/[)\],.;:!?]+$/g, '')
    .trim();
  if (!input) return '';

  if (isValidHttpUrl(input)) return input;
  if (/^www\./i.test(input)) {
    const prefixed = `https://${input}`;
    return isValidHttpUrl(prefixed) ? prefixed : '';
  }
  if (/^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+([\/?#][^\s]*)?$/i.test(input) && !/\s/.test(input)) {
    const prefixed = `https://${input}`;
    return isValidHttpUrl(prefixed) ? prefixed : '';
  }
  return '';
}
function extractFirstUrl(text = '') {
  const source = String(text || '');
  const http = source.match(/https?:\/\/[^\s"'>)]+/i);
  if (http?.[0]) return normalizeUrlCandidate(http[0]);
  const www = source.match(/\bwww\.[^\s"'>)]+/i);
  if (www?.[0]) return normalizeUrlCandidate(www[0]);
  const bare = source.match(/\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+(?:\/[^\s"'>)]*)?/i);
  return bare?.[0] ? normalizeUrlCandidate(bare[0]) : '';
}
function extractRecentUrlFromMessages(messages = []) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const msg = list[i];
    if (!msg || msg.role !== 'user') continue;
    const found = extractFirstUrl(getMessageText(msg.content));
    if (found) return found;
  }
  return '';
}

// ── Fetch Helpers ─────────────────────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeout = 20000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  try { return await fetch(url, { ...options, signal: ctrl.signal }); }
  finally { clearTimeout(id); }
}
async function readJsonSafe(response, timeoutMs = 8000) {
  const text = await Promise.race([
    response.text(),
    new Promise((_, rej) => setTimeout(() => rej(new Error('JSON read timeout')), timeoutMs))
  ]);
  try { return JSON.parse(text); } catch { return null; }
}

function shouldUseLiveResearch(text = '') {
  const t = cleanText(text, 1200).toLowerCase();
  if (!t) return false;
  const freshness = /\b(latest|today|current|recent|this week|this month|2026|breaking|news|update)\b/.test(t);
  const factualDomain = /\b(price|pricing|stock|market cap|rate|tax rate|law|regulation|policy|deadline|release date|launch date|election|score|bitcoin|btc|eth|openai|model)\b/.test(t);
  if (factualDomain && freshness) return true;
  if (/\b(price|pricing|stock|market cap|rate|tax rate|law|regulation|policy|deadline|release date|launch date|election|score)\b/.test(t)) return true;
  if (/\b(search|look up|google|online|web|internet|source|sources)\b/.test(t)) return true;
  return false;
}

function shouldUseLiveResearchByMode(text = '', mode = 'auto') {
  const normalizedMode = cleanText(mode, 24).toLowerCase();
  if (normalizedMode !== 'on_demand') return shouldUseLiveResearch(text);
  const t = cleanText(text, 1200).toLowerCase();
  if (!t) return false;
  if (/\b(search|look up|google|online|web|internet|source|sources|latest|current|today|news|update)\b/.test(t)) return true;
  return false;
}

function computeDynamicMaxTokens(userText = '', base = 700) {
  const t = cleanText(userText, 1200).toLowerCase();
  if (!t) return Math.min(base, 620);
  const likelyShortAnswer =
    t.length < 90 ||
    /\b(what is|who is|when is|price|latest|quick|brief|in short|one line)\b/.test(t);
  if (likelyShortAnswer) return Math.min(base, 560);
  const likelyLongAnswer =
    /\b(step by step|detailed|full plan|roadmap|strategy|framework|business plan)\b/.test(t);
  if (likelyLongAnswer) return Math.max(base, 780);
  return Math.min(base, 660);
}

function normalizeLiveSource(item = {}) {
  const title = cleanText(item.title || item.name || '', 180);
  const url = cleanText(item.url || item.link || '', 700);
  if (!title || !isValidHttpUrl(url)) return null;
  const snippet = cleanText(item.snippet || item.content || item.description || '', 260);
  const source = cleanText(item.source || item.site || '', 80);
  const publishedAt = cleanText(item.publishedAt || item.date || item.published_date || '', 50);
  return { title, url, snippet, source, publishedAt };
}

async function searchWithSerper(query = '') {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];
  const response = await fetchWithTimeout('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: cleanText(query, 500),
      num: 6,
      gl: cleanText(process.env.NABAD_SEARCH_GL || 'ae', 5),
      hl: cleanText(process.env.NABAD_SEARCH_HL || 'en', 5)
    })
  }, 12000);
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Serper error ${response.status}: ${err.slice(0, 120)}`);
  }
  const data = await readJsonSafe(response);
  const organic = Array.isArray(data?.organic) ? data.organic : [];
  return organic.map((o) => normalizeLiveSource({
    title: o?.title,
    url: o?.link,
    snippet: o?.snippet,
    source: o?.source,
    publishedAt: o?.date
  })).filter(Boolean);
}

async function searchWithTavily(query = '') {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  const response = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query: cleanText(query, 500),
      search_depth: 'advanced',
      include_answer: false,
      include_raw_content: false,
      max_results: 6
    })
  }, 12000);
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Tavily error ${response.status}: ${err.slice(0, 120)}`);
  }
  const data = await readJsonSafe(response);
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map((r) => normalizeLiveSource({
    title: r?.title,
    url: r?.url,
    snippet: r?.content,
    source: r?.source,
    publishedAt: r?.published_date
  })).filter(Boolean);
}

async function searchWithSerpApi(query = '') {
  const apiKey = process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY || '';
  if (!apiKey) return [];
  const params = new URLSearchParams({
    engine: 'google',
    q: cleanText(query, 500),
    num: '6',
    api_key: apiKey,
    gl: cleanText(process.env.NABAD_SEARCH_GL || 'ae', 5),
    hl: cleanText(process.env.NABAD_SEARCH_HL || 'en', 5)
  });
  const response = await fetchWithTimeout(`https://serpapi.com/search.json?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  }, 12000);
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`SerpApi error ${response.status}: ${err.slice(0, 120)}`);
  }
  const data = await readJsonSafe(response);
  const organic = Array.isArray(data?.organic_results) ? data.organic_results : [];
  return organic.map((o) => normalizeLiveSource({
    title: o?.title,
    url: o?.link,
    snippet: o?.snippet,
    source: o?.source,
    publishedAt: o?.date || o?.rich_snippet?.top?.extensions?.[0] || ''
  })).filter(Boolean);
}

async function runLiveResearch(userMessage = '', messages = [], userProfile = '') {
  const queryParts = [
    cleanText(userMessage, 280),
    cleanText(userProfile, 200),
    ...messages
      .filter((m) => m.role === 'user')
      .slice(-2)
      .map((m) => cleanText(getMessageText(m.content), 140))
      .filter(Boolean)
  ].filter(Boolean);
  const query = cleanText(queryParts.join(' | '), 500);
  if (!query) return { used: false, provider: '', sources: [] };

  let sources = [];
  let provider = '';
  try {
    sources = await searchWithSerper(query);
    provider = sources.length ? 'serper' : provider;
  } catch (err) {
    console.error('[LIVE RESEARCH] serper failed:', err?.message);
  }
  if (!sources.length) {
    try {
      sources = await searchWithSerpApi(query);
      provider = sources.length ? 'serpapi' : provider;
    } catch (err) {
      console.error('[LIVE RESEARCH] serpapi failed:', err?.message);
    }
  }
  if (!sources.length) {
    try {
      sources = await searchWithTavily(query);
      provider = sources.length ? 'tavily' : provider;
    } catch (err) {
      console.error('[LIVE RESEARCH] tavily failed:', err?.message);
    }
  }

  const dedup = [];
  const seen = new Set();
  sources.forEach((s) => {
    const key = String(s?.url || '').toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    dedup.push(s);
  });

  return {
    used: dedup.length > 0,
    provider,
    sources: dedup.slice(0, 4)
  };
}

function buildLiveResearchContext(live = null) {
  if (!live || !Array.isArray(live.sources) || !live.sources.length) return '';
  const lines = live.sources.map((s, i) => {
    const datePart = s.publishedAt ? ` | Date: ${s.publishedAt}` : '';
    const sourcePart = s.source ? ` | Source: ${s.source}` : '';
    return `[${i + 1}] ${s.title}${sourcePart}${datePart}\nURL: ${s.url}\nSnippet: ${s.snippet || 'n/a'}`;
  });
  return `Live web research (fresh sources, prioritize these for current facts):\n${lines.join('\n\n')}`;
}

function buildLiveSourcesHtml(live = null) {
  if (!live || !Array.isArray(live.sources) || !live.sources.length) return '';
  const items = live.sources.map((s, i) => {
    const date = s.publishedAt ? ` <span style="color:#64748b">(${escapeHtml(s.publishedAt)})</span>` : '';
    return `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title || `Source ${i + 1}`)}</a>${date}</li>`;
  }).join('');
  return `<div data-nabad-card="live-sources" style="margin-top:10px;background:#f8fafc;border:1px solid rgba(37,99,235,.12);border-radius:10px;padding:10px 12px"><div style="font-size:11px;color:#64748b;margin-bottom:6px">Live sources checked</div><ul style="margin:0;padding-left:18px;line-height:1.5">${items}</ul></div>`;
}
function buildWebsiteCheckedHtml(url = '', content = '') {
  if (!url || !content) return '';
  const checkedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const evidenceSize = cleanText(content, 8000).length;
  return `<div data-nabad-card="website-checked" style="margin-top:10px;background:#f0f9ff;border:1px solid rgba(14,116,144,.22);border-radius:10px;padding:10px 12px">
    <div style="font-size:11px;color:#0f766e;font-weight:700;margin-bottom:4px">Live website checked</div>
    <div style="font-size:12px;color:#334155">URL: <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></div>
    <div style="font-size:11px;color:#64748b;margin-top:3px">Checked at: ${escapeHtml(checkedAt)} UTC · Evidence size: ${evidenceSize} chars</div>
  </div>`;
}

// ── Website Audit ─────────────────────────────────────────────────────────────
async function fetchWebsiteAuditContent(url = '') {
  if (!isValidHttpUrl(url)) return '';
  const trimmed = cleanText(url, 500);
  const encoded = encodeURIComponent(trimmed);
  const attempts = [
    `https://r.jina.ai/${trimmed}`,
    `https://r.jina.ai/http://${trimmed.replace(/^https?:\/\//i, '')}`,
    `https://r.jina.ai/https://${trimmed.replace(/^https?:\/\//i, '')}`,
    `https://r.jina.ai/${encoded}`
  ];
  try {
    for (const target of attempts) {
      const res = await fetchWithTimeout(target, {
        headers: { Accept: 'text/plain', 'User-Agent': 'NabadBot/1.0' }
      }, 12000);
      if (!res.ok) continue;
      const text = await res.text();
      if (cleanText(text, 1200).length > 180) return text.slice(0, 4200);
    }
    return '';
  } catch { return ''; }
}

// ── Ideogram 2.0 Integration ──────────────────────────────────────────────────
async function generateWithIdeogram(prompt = '', imageType = 'image') {
  const apiKey = process.env.IDEOGRAM_API_KEY;
  if (!apiKey) throw new Error('IDEOGRAM_API_KEY not set');
  const cleanPrompt = sanitizePromptText(prompt).slice(0, 900);
  const textCritical = imageType === 'logo' || /\b(wordmark|exact text|brand text|logo text|spelling|typography|text)\b/i.test(cleanPrompt);
  const response = await fetchWithTimeout('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      image_request: {
        prompt: cleanPrompt,
        model: 'V_2',
        magic_prompt_option: textCritical ? 'OFF' : 'AUTO',
        style_type: 'DESIGN',
        aspect_ratio: 'ASPECT_1_1'
      }
    })
  }, 30000);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ideogram API error: ${response.status} — ${errText.slice(0, 100)}`);
  }
  const data = await readJsonSafe(response);
  const imageUrl = data?.data?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL returned from Ideogram');
  return imageUrl;
}

async function generateWithOpenAIImage(prompt = '', imageType = 'image') {
  const cleanPrompt = sanitizePromptText(prompt).slice(0, 900);
  const model = cleanText(process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1', 80);
  const size = imageType === 'banner' ? '1536x1024' : '1024x1024';
  const response = await openai.images.generate({
    model,
    prompt: cleanPrompt,
    size
  });
  const item = response?.data?.[0] || null;
  const url = item?.url && /^https?:\/\//i.test(item.url) ? item.url : '';
  if (url) return url;
  const b64 = item?.b64_json || item?.b64;
  if (typeof b64 === 'string' && b64.length > 120) {
    return `data:image/png;base64,${b64}`;
  }
  throw new Error('No image URL returned from OpenAI image generation');
}

async function generateWithGeminiImage(prompt = '', imageType = 'image') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const model = cleanText(process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image', 80);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const cleanPrompt = sanitizePromptText(prompt).slice(0, 900);
  const aspectRatio = imageType === 'banner' ? '3:2' : '1:1';

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: cleanPrompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio }
      }
    })
  }, 35000);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} — ${errText.slice(0, 140)}`);
  }

  const data = await readJsonSafe(response);
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p) => p?.inlineData?.data || p?.inline_data?.data) || null;
  const b64 = imgPart?.inlineData?.data || imgPart?.inline_data?.data || '';
  const mime = imgPart?.inlineData?.mimeType || imgPart?.inline_data?.mime_type || 'image/png';
  if (typeof b64 === 'string' && b64.length > 100) {
    return `data:${mime};base64,${b64}`;
  }
  throw new Error('No image bytes returned from Gemini');
}

async function generateWithGeminiText(chatMessages = [], opts = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  const preferredModel = cleanText(process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash-lite', 80);
  const modelCandidates = Array.from(new Set([
    preferredModel,
    'gemini-2.5-flash-lite'
  ])).filter(Boolean);
  const temperature = Number.isFinite(Number(opts?.temperature)) ? Number(opts.temperature) : 0.8;
  const maxTokens = Number.isFinite(Number(opts?.maxTokens)) ? Number(opts.maxTokens) : 700;

  const messages = Array.isArray(chatMessages) ? chatMessages : [];
  const systemMsg = messages.find((m) => m.role === 'system');

  const rawTurns = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const text = cleanText(getMessageText(m.content), 12000);
      return { role, text };
    })
    .filter((t) => t.text);

  // Merge adjacent turns with the same role to keep Gemini dialogue valid/stable.
  const mergedTurns = [];
  for (const turn of rawTurns) {
    const prev = mergedTurns[mergedTurns.length - 1];
    if (prev && prev.role === turn.role) {
      prev.text += `\n\n${turn.text}`;
    } else {
      mergedTurns.push({ ...turn });
    }
  }

  const geminiContents = mergedTurns.slice(-18).map((t) => ({
    role: t.role,
    parts: [{ text: t.text.slice(0, 16000) }]
  }));
  if (!geminiContents.length) {
    geminiContents.push({ role: 'user', parts: [{ text: 'Continue the conversation naturally.' }] });
  }

  let lastErr = null;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  for (const model of modelCandidates) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...(systemMsg?.content
            ? { systemInstruction: { parts: [{ text: String(systemMsg.content).slice(0, 26000) }] } }
            : {}),
          contents: geminiContents,
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens
          }
        })
      }, 35000);

      if (!response.ok) {
        const errText = await response.text();
        lastErr = new Error(`Gemini text API error: ${response.status} — ${errText.slice(0, 140)}`);
        const retryable = response.status === 429 || response.status === 503;
        if (retryable && attempt < 2) {
          await sleep(700 * attempt);
          continue;
        }
        break;
      }

      const data = await readJsonSafe(response);
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts
        .map((p) => (typeof p?.text === 'string' ? p.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim();
      if (text) return text;
      lastErr = new Error('No text returned from Gemini');
      break;
    }
  }
  throw lastErr || new Error('Gemini text unavailable');
}

async function generateWithGroqText(chatMessages = [], opts = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');
  const model = cleanText(process.env.GROQ_TEXT_MODEL || 'llama-3.3-70b-versatile', 120);
  const temperature = Number.isFinite(Number(opts?.temperature)) ? Number(opts.temperature) : 0.8;
  const maxTokens = Number.isFinite(Number(opts?.maxTokens)) ? Number(opts.maxTokens) : 700;

  const messages = (Array.isArray(chatMessages) ? chatMessages : [])
    .map((m) => {
      const role = ['system', 'user', 'assistant'].includes(m?.role) ? m.role : 'user';
      const content = role === 'system'
        ? String(m?.content || '')
        : cleanText(getMessageText(m?.content), 12000);
      return { role, content };
    })
    .filter((m) => m.content);

  if (!messages.length) throw new Error('No conversation payload for Groq');

  const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  }, 35000);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error: ${response.status} — ${errText.slice(0, 180)}`);
  }
  const data = await readJsonSafe(response);
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('No text returned from Groq');
  return text;
}

function extractImageUrlFromPayload(payload = null) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const candidates = [
    p?.data?.[0]?.url,
    p?.data?.[0]?.image_url,
    p?.data?.[0]?.imageUrl,
    p?.images?.[0]?.url,
    p?.images?.[0]?.image_url,
    p?.images?.[0]?.imageUrl,
    p?.output?.[0]?.url,
    p?.output?.[0]?.image_url,
    p?.output?.[0]?.imageUrl,
    p?.result?.url,
    p?.result?.image_url,
    p?.result?.imageUrl,
    p?.url,
    p?.image_url,
    p?.imageUrl,
    Array.isArray(p?.data) && typeof p.data[0] === 'string' ? p.data[0] : '',
    Array.isArray(p?.images) && typeof p.images[0] === 'string' ? p.images[0] : '',
    Array.isArray(p?.output) && typeof p.output[0] === 'string' ? p.output[0] : ''
  ];
  const directUrl = candidates.find((v) => typeof v === 'string' && /^https?:\/\//i.test(v)) || '';
  if (directUrl) return directUrl;

  const base64Candidates = [
    p?.data?.[0]?.b64_json,
    p?.images?.[0]?.b64_json,
    p?.output?.[0]?.b64_json,
    p?.result?.b64_json,
    p?.b64_json,
    p?.image_base64,
    p?.imageBase64
  ];
  const b64 = base64Candidates.find((v) => typeof v === 'string' && v.length > 120) || '';
  if (b64) return `data:image/png;base64,${b64}`;

  const textBlob = typeof p?.text === 'string'
    ? p.text
    : typeof p?.message === 'string'
      ? p.message
      : typeof p?.result === 'string'
        ? p.result
        : '';
  if (textBlob) {
    const m = textBlob.match(/https?:\/\/[^\s"'<>]+/i);
    if (m) return m[0];
  }
  return '';
}

async function generateWithGenspark(prompt = '', imageType = 'image') {
  const apiKey = process.env.GENSPARK_API_KEY;
  if (!apiKey) throw new Error('GENSPARK_API_KEY not set');

  const rawUrl = cleanText(process.env.GENSPARK_IMAGE_API_URL || '', 300) || 'https://api.genspark.ai/v1/images/generations';
  const trimmed = rawUrl.replace(/\/+$/, '').replace(/\.+$/, '');
  const candidateUrls = [];
  const addUrl = (u = '') => {
    const clean = cleanText(u, 300).replace(/\/+$/, '');
    if (!clean || !/^https?:\/\//i.test(clean)) return;
    if (!candidateUrls.includes(clean)) candidateUrls.push(clean);
  };

  if (/^https?:\/\/www\.genspark\.ai\/?$/i.test(trimmed)) {
    addUrl('https://www.genspark.ai/api/v1/images/generations');
    addUrl('https://www.genspark.ai/v1/images/generations');
  } else if (/^https?:\/\/api\.genspark\.ai\/?$/i.test(trimmed)) {
    addUrl('https://api.genspark.ai/v1/images/generations');
    addUrl('https://www.genspark.ai/api/v1/images/generations');
    addUrl('https://www.genspark.ai/v1/images/generations');
  } else if (/^https?:\/\/api\.genspark\.ai\/v\d+\/?$/i.test(trimmed)) {
    addUrl(`${trimmed}/images/generations`);
    addUrl(trimmed.replace(/^https?:\/\/api\.genspark\.ai/i, 'https://www.genspark.ai/api') + '/images/generations');
  } else {
    addUrl(trimmed);
  }
  const cleanPrompt = sanitizePromptText(prompt).slice(0, 900);
  const model = cleanText(process.env.GENSPARK_IMAGE_MODEL || '', 80);
  const styleByType = {
    logo: 'logo',
    icon: 'icon',
    banner: 'design',
    illustration: 'illustration',
    mockup: 'mockup',
    image: 'design'
  };

  const body = {
    prompt: cleanPrompt,
    size: '1024x1024',
    n: 1,
    ...(model ? { model } : {}),
    ...(styleByType[imageType] ? { style: styleByType[imageType] } : {})
  };

  const send = async (targetUrl = '') => {
    return fetchWithTimeout(targetUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }, 30000);
  };

  let response = null;
  let lastErr = null;
  for (const targetUrl of candidateUrls) {
    try {
      console.log('[GENSPARK DEBUG] trying url:', targetUrl);
      const resp = await send(targetUrl);
      if (resp.ok) {
        response = resp;
        break;
      }
      const errText = await resp.text();
      const msg = `Genspark API error: ${resp.status} — ${errText.slice(0, 140)}`;
      console.error('[GENSPARK DEBUG] non-200:', msg);
      if (resp.status === 404 || resp.status === 405) {
        lastErr = new Error(msg);
        continue;
      }
      throw new Error(msg);
    } catch (err) {
      const causeCode = err?.cause?.code || '';
      const causeName = err?.cause?.name || '';
      lastErr = new Error(`Genspark network error: ${causeCode || causeName || err?.message || 'fetch failed'}`);
    }
  }
  if (!response) throw (lastErr || new Error('Genspark API error: endpoint unavailable'));

  const rawText = await response.text();
  let data = null;
  try { data = JSON.parse(rawText); } catch {}
  const imageUrl = extractImageUrlFromPayload(data);
  if (!imageUrl) {
    const urlInText = (rawText.match(/https?:\/\/[^\s"'<>]+/i) || [])[0] || '';
    if (urlInText) return urlInText;
    const topKeys = data && typeof data === 'object' ? Object.keys(data).slice(0, 12).join(',') : 'non-json';
    console.error('[GENSPARK DEBUG] response keys:', topKeys);
    console.error('[GENSPARK DEBUG] response sample:', String(rawText || '').slice(0, 260));
    throw new Error('No image URL returned from Genspark');
  }
  if (/^https?:\/\/www\.genspark\.ai\/?$/i.test(imageUrl.replace(/\.+$/, ''))) {
    throw new Error('Invalid image URL returned from Genspark (homepage URL)');
  }
  return imageUrl;
}

async function generateWithReplicate(prompt = '', imageType = 'image') {
  const apiToken = cleanText(process.env.REPLICATE_API_TOKEN || '', 260);
  if (!apiToken) throw new Error('REPLICATE_API_TOKEN not set');

  const model = cleanText(process.env.REPLICATE_IMAGE_MODEL || 'black-forest-labs/flux-schnell', 120);
  const [owner, name] = model.split('/');
  if (!owner || !name) {
    throw new Error('REPLICATE_IMAGE_MODEL must be in owner/name format');
  }

  const cleanPrompt = sanitizePromptText(prompt).slice(0, 900);
  const aspect_ratio = imageType === 'banner' ? '3:2' : '1:1';
  const createResp = await fetchWithTimeout(`https://api.replicate.com/v1/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=8'
    },
    body: JSON.stringify({
      input: {
        prompt: cleanPrompt,
        aspect_ratio,
        output_format: 'jpg'
      }
    })
  }, 35000);

  const createText = await createResp.text();
  let prediction = null;
  try { prediction = JSON.parse(createText); } catch {}
  if (!createResp.ok) {
    throw new Error(`Replicate API error: ${createResp.status} — ${createText.slice(0, 160)}`);
  }
  if (!prediction || typeof prediction !== 'object') {
    throw new Error('Replicate returned invalid response');
  }

  const extractOutputUrl = (p = {}) => {
    const output = p?.output;
    if (typeof output === 'string' && /^https?:\/\//i.test(output)) return output;
    if (Array.isArray(output)) {
      const found = output.find((v) => typeof v === 'string' && /^https?:\/\//i.test(v));
      if (found) return found;
    }
    const direct = p?.urls?.image || p?.image || p?.url;
    if (typeof direct === 'string' && /^https?:\/\//i.test(direct)) return direct;
    return '';
  };

  let imageUrl = extractOutputUrl(prediction);
  let status = cleanText(prediction?.status || '', 30).toLowerCase();
  const pollUrl = cleanText(prediction?.urls?.get || '', 400);

  if (!imageUrl && pollUrl && status && !['succeeded', 'failed', 'canceled'].includes(status)) {
    for (let i = 0; i < 8; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const pollResp = await fetchWithTimeout(pollUrl, {
        headers: { Authorization: `Bearer ${apiToken}` }
      }, 20000);
      const pollText = await pollResp.text();
      let polled = null;
      try { polled = JSON.parse(pollText); } catch {}
      if (!pollResp.ok) {
        throw new Error(`Replicate polling error: ${pollResp.status} — ${pollText.slice(0, 140)}`);
      }
      imageUrl = extractOutputUrl(polled || {});
      status = cleanText(polled?.status || '', 30).toLowerCase();
      if (imageUrl) break;
      if (status === 'failed' || status === 'canceled') {
        const err = cleanText(polled?.error || '', 160);
        throw new Error(err ? `Replicate generation failed: ${err}` : `Replicate generation ${status}`);
      }
    }
  }

  if (!imageUrl) {
    throw new Error('No image URL returned from Replicate');
  }
  return imageUrl;
}

async function generateImageWithProviderChain(imagePrompt = '', imageType = 'image', options = {}) {
  const preferredOverride = cleanText(options?.preferred || '', 24).toLowerCase();
  const preferred = preferredOverride || cleanText(process.env.NABAD_IMAGE_PROVIDER || 'auto', 24).toLowerCase();
  const forcedMode = cleanText(process.env.NABAD_IMAGE_MODE || 'balanced', 24).toLowerCase();
  const allowOpenAI = options?.allowOpenAI !== false;
  const providers = [];
  const hasOpenAIImage = !!process.env.OPENAI_API_KEY && allowOpenAI;
  const hasGeminiImage = !!process.env.GEMINI_API_KEY;
  const hasGenspark = !!process.env.GENSPARK_API_KEY;
  const hasIdeogram = !!process.env.IDEOGRAM_API_KEY;
  const hasReplicate = !!process.env.REPLICATE_API_TOKEN;
  const isFastMode = /\b(fast|quick|draft|free mode)\b/i.test(imagePrompt) || forcedMode === 'fast';
  const isTextCritical = imageType === 'logo' || /\b(wordmark|exact text|spelling|typography|text)\b/i.test(imagePrompt);

  if (preferred === 'openai') {
    if (hasOpenAIImage) providers.push('openai');
    if (hasGeminiImage) providers.push('gemini');
    if (hasIdeogram) providers.push('ideogram');
    if (hasReplicate) providers.push('replicate');
    providers.push('pollinations');
  } else if (preferred === 'gemini' || preferred === 'nanobanana' || preferred === 'nano-banana' || preferred === 'nano_banana' || preferred === 'nano banana') {
    if (hasGeminiImage) providers.push('gemini');
    if (hasOpenAIImage) providers.push('openai');
    if (hasIdeogram) providers.push('ideogram');
    if (hasReplicate) providers.push('replicate');
    providers.push('pollinations');
  } else if (preferred === 'replicate') {
    if (hasReplicate) providers.push('replicate');
    if (hasOpenAIImage) providers.push('openai');
    if (hasGeminiImage) providers.push('gemini');
    if (hasIdeogram) providers.push('ideogram');
    providers.push('pollinations');
  } else if (preferred === 'ideogram') {
    if (hasIdeogram) providers.push('ideogram');
    if (hasGeminiImage) providers.push('gemini');
    if (hasOpenAIImage) providers.push('openai');
    if (hasReplicate) providers.push('replicate');
    providers.push('pollinations');
  } else if (preferred === 'genspark') {
    if (hasGenspark) providers.push('genspark');
    if (hasOpenAIImage) providers.push('openai');
    if (hasIdeogram) providers.push('ideogram');
    if (hasReplicate) providers.push('replicate');
    providers.push('pollinations');
  } else if (preferred === 'pollinations') {
    providers.push('pollinations');
    if (hasReplicate) providers.push('replicate');
    if (hasGeminiImage) providers.push('gemini');
    if (hasOpenAIImage) providers.push('openai');
    if (hasIdeogram) providers.push('ideogram');
    if (hasGenspark) providers.push('genspark');
  } else if (isFastMode) {
    providers.push('pollinations');
    if (hasReplicate) providers.push('replicate');
    if (hasGeminiImage) providers.push('gemini');
    if (hasOpenAIImage) providers.push('openai');
    if (hasIdeogram) providers.push('ideogram');
    if (hasGenspark && forcedMode === 'genspark') providers.push('genspark');
  } else if (isTextCritical) {
    if (hasGeminiImage) providers.push('gemini');
    if (hasOpenAIImage) providers.push('openai');
    if (hasReplicate) providers.push('replicate');
    if (hasIdeogram) providers.push('ideogram');
    providers.push('pollinations');
    if (hasGenspark && forcedMode === 'genspark') providers.push('genspark');
  } else {
    if (hasGeminiImage) providers.push('gemini');
    if (hasOpenAIImage) providers.push('openai');
    if (hasReplicate) providers.push('replicate');
    providers.push('pollinations');
    if (hasIdeogram) providers.push('ideogram');
    if (hasGenspark && forcedMode === 'genspark') providers.push('genspark');
  }
  console.log('[IMAGE ROUTER]', JSON.stringify({
    preferred,
    forcedMode,
    imageType,
    hasGeminiImage,
    hasOpenAIImage,
    hasIdeogram,
    hasGenspark,
    hasReplicate,
    providers
  }));

  let lastError = null;
  for (const provider of providers) {
    try {
      if (provider === 'gemini') {
        const url = await generateWithGeminiImage(imagePrompt, imageType);
        console.log('[IMAGE PROVIDER USED]', provider);
        return { provider: 'gemini', url };
      }
      if (provider === 'openai') {
        const url = await generateWithOpenAIImage(imagePrompt, imageType);
        console.log('[IMAGE PROVIDER USED]', provider);
        return { provider: 'openai', url };
      }
      if (provider === 'genspark') {
        const url = await generateWithGenspark(imagePrompt, imageType);
        console.log('[IMAGE PROVIDER USED]', provider);
        return { provider, url };
      }
      if (provider === 'replicate') {
        const url = await generateWithReplicate(imagePrompt, imageType);
        console.log('[IMAGE PROVIDER USED]', provider);
        return { provider, url };
      }
      if (provider === 'ideogram') {
        const url = await generateWithIdeogram(imagePrompt, imageType);
        console.log('[IMAGE PROVIDER USED]', provider);
        return { provider, url };
      }
      const seed = Math.floor(Math.random() * 999999);
      const url = buildPollinationsUrl(imagePrompt, { seed, model: 'flux' });
      console.log('[IMAGE PROVIDER USED]', 'pollinations');
      return { provider: 'pollinations', url };
    } catch (err) {
      lastError = err;
      console.error(`[IMAGE PROVIDER ERROR] ${provider}:`, err?.message);
    }
  }
  throw lastError || new Error('No image provider available');
}

function isImageQualityComplaint(text = '') {
  return /\b(fix\s*(the\s*)?text|text\s*(is\s*)?(wrong|broken|off|bad|blurry)|wrong\s*text|fix\s*(the\s*)?spelling|spelling\s*(is\s*)?wrong)\b/i.test(text)
    || /\b(bad\s*(quality|image|photo|result)|not\s*good|looks\s*(bad|terrible|wrong|off)|better\s*quality|higher\s*quality|sharper|cleaner)\b/i.test(text)
    || /\b(upgrade\s*(the\s*)?image|use\s*(ideogram|premium|better\s*(model|ai|generator))|switch\s*to\s*(ideogram|premium))\b/i.test(text)
    || /\b(change\s*(the\s*)?(font|typography|text\s*style)|different\s*font|new\s*font|better\s*text|text\s*generation)\b/i.test(text)
    || /\b(didn['']?t|didnt|dont|don['']?t)\s*like\s*(the\s*)?(text|font|logo|image|result|design)\b/i.test(text);
}

function isPremiumImageConfirmation(text = '') {
  return /\b(use\s*(ideogram|premium|better)|yes\s*(ideogram|premium|upgrade|better)|switch\s*to\s*(ideogram|premium)|upgrade\s*image|yes\s*upgrade|go\s*premium|use\s*premium|better\s*text|text\s*generation|fix\s*text)\b/i.test(text);
}

function isDirectPremiumTextRequest(text = '') {
  return /\b(better\s*text|fix\s*text|text\s*generation|spelling|exact\s*text|correct\s*text)\b/i.test(text);
}

function buildPremiumUpgradeOffer(lastPrompt = '') {
  return `<div class="nabad-image-choice-card">
  <div style="font-size:17px;font-weight:800;margin-bottom:6px">Want a sharper result?</div>
  <p style="font-size:13px;color:#475569;margin:0 0 10px 0;line-height:1.5">Premium mode uses higher-quality image generation and text-accurate rendering for logos.</p>
  <div class="nabad-image-choice-grid" style="margin-bottom:12px">
    <div class="nabad-image-choice-col">
      <div style="font-size:10px;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.08em">Current</div>
      <strong style="font-size:13px">Pollinations</strong>
      <div style="font-size:11px;color:#64748b;margin-top:2px">Free · fast</div>
      <div style="font-size:11px;color:#b45309;margin-top:2px">Text can be inaccurate</div>
    </div>
    <div class="nabad-image-choice-col">
      <div style="font-size:10px;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.08em">Premium</div>
      <strong style="font-size:13px">Nabad Premium</strong>
      <div style="font-size:11px;color:#64748b;margin-top:2px">Sharper quality</div>
      <div style="font-size:11px;color:#047857;margin-top:2px">Accurate text rendering</div>
    </div>
  </div>
  <div style="display:flex;gap:8px;justify-content:flex-start;flex-wrap:wrap">
    <button data-nabad-action="image-free">Regenerate Free</button>
    <button data-nabad-action="image-premium">Use Ideogram</button>
  </div>
</div>`;
}

function buildPremiumImageReply(imageUrl = '', prompt = '', imageType = 'image') {
  const labels = {
    logo: '🎨 Your logo — rendered in Premium mode',
    banner: '🖼️ Banner — rendered in Premium mode',
    icon: '✨ Icon — rendered in Premium mode',
    illustration: '🎭 Illustration — rendered in Premium mode',
    mockup: '📦 Mockup — rendered in Premium mode',
    image: '🖼️ Image — rendered in Premium mode'
  };
  const label = labels[imageType] || labels.image;
  return `<p><strong>${label}</strong> <span style="font-size:11px;opacity:.6;background:rgba(168,85,247,.2);padding:2px 8px;border-radius:99px;color:#a855f7">✨ Premium</span></p>
<div class="nabad-image-wrap">
  <img src="${imageUrl}" alt="Generated image" class="nabad-gen-image" loading="lazy" />
  <p class="nabad-image-caption">Generated by Nabad</p>
</div>`;
}

// ── Image Utilities ───────────────────────────────────────────────────────────
function isStockPhotoRequest(text = '') {
  return /\b(stock\s*photo|stock\s*image|real\s*(photo|picture|image)|actual\s*(photo|picture|image)|photograph of|photo of a real)\b/i.test(text);
}
function isImageRequest(text = '') {
  const t = String(text || '');
  return /\b(generate|create|make|draw|design|build|produce|show)\b.{0,40}\b(image|photo|picture|logo|icon|illustration|banner|visual|graphic|mockup)\b/i.test(t)
    || /\b(image|photo|picture|logo|icon|illustration|banner|visual|graphic|mockup)\b.{0,30}\b(generate|create|make|draw|design|for me|please)\b/i.test(t)
    || /\b(logo|brandmark|wordmark|icon)\b.{0,40}\b(for|of|for my|for our)\b/i.test(t)
    || /\b(i need|we need|help me with)\b.{0,40}\b(logo|brand identity|brand mark|icon)\b/i.test(t)
    || /\b(generate|create|make)\b.{0,30}\b(version|style)\b/i.test(t);
}
function isRegenerationRequest(text = '') {
  return /\b(regenerate|redo|try again|another version|different version|new version)\b.{0,30}\b(image|logo|picture|visual|photo|banner|icon)\b/i.test(text)
    || /\b(regenerate|redo|new one|try again)\b$/i.test(text);
}
function isImageModificationRequest(text = '') {
  return /\b(change|update|modify|make it|make the|adjust|tweak|alter)\b.{0,40}\b(image|logo|picture|visual|banner|icon|color|colour|style|background|font|text|typography)\b/i.test(text)
    || /\b(different|new)\b.{0,20}\b(font|style|color|colour|background)\b/i.test(text);
}

function isAttachmentImageAnalysisRequest(text = '') {
  const t = String(text || '');
  if (!t) return false;
  const asksAnalysis = /\b(analy[sz]e|analysis|assess|evaluate|review|feedback|opinion|what do you think|describe|what is in|what's in|read this|inspect)\b/i.test(t);
  const asksGeneration = /\b(generate|create|make|design|draw|build|produce|regenerate|redo|new version)\b/i.test(t);
  const asksEdit = isImageModificationRequest(t);
  return asksAnalysis && !asksGeneration && !asksEdit;
}
function hasImageStyleSignal(text = '') {
  const t = String(text || '').toLowerCase();
  return /\b(simple|minimal|clean|creative|artistic|bold|realistic|photoreal|cinematic|3d|flat|vector|modern|luxury|playful|futuristic)\b/.test(t);
}
function imageChoiceRecentlyShown(messages = [], lookback = 4) {
  return messages.slice(-lookback).some(m =>
    m.role === 'assistant' &&
    /data-nabad-card="image-choice"|choose the visual direction/i.test(getMessageText(m.content))
  );
}
function shouldAskImageStyleChoice(text = '', messages = []) {
  if (!isImageRequest(text)) return false;
  if (isRegenerationRequest(text) || isImageModificationRequest(text)) return false;
  if (hasImageStyleSignal(text)) return false;
  if (imageChoiceRecentlyShown(messages)) return false;
  return true;
}
function buildImageStyleChoiceCard() {
  return `<div data-nabad-card="image-choice" class="nabad-image-choice-card">
  <div style="font-size:17px;font-weight:800;margin-bottom:6px">Choose the visual direction</div>
  <p style="font-size:13px;color:#475569;margin:0 0 10px 0;line-height:1.5">Pick one style and I’ll generate based on it.</p>
  <div style="display:flex;gap:8px;justify-content:flex-start;flex-wrap:wrap">
    <button data-nabad-action="image-style-simple">Simple</button>
    <button data-nabad-action="image-style-creative">Creative</button>
    <button data-nabad-action="image-style-realistic">Realistic</button>
    <button data-nabad-action="image-style-logo">Logo</button>
  </div>
</div>`;
}
function normalizeImagePrompt(text = '') {
  return text.replace(/[^\w\s,.\-()!?'":@#&]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 900);
}
function detectImageType(text = '') {
  const t = text.toLowerCase();
  if (/\b(logo|brand\s*mark|wordmark)\b/.test(t)) return 'logo';
  if (/\b(banner|cover|header)\b/.test(t)) return 'banner';
  if (/\b(icon|favicon)\b/.test(t)) return 'icon';
  if (/\b(illustration|drawing|art)\b/.test(t)) return 'illustration';
  if (/\b(mockup|product shot)\b/.test(t)) return 'mockup';
  return 'image';
}
function enrichImagePrompt(rawPrompt = '', type = 'image') {
  const base = sanitizePromptText(rawPrompt);
  const suffixes = {
    logo: ', clean vector logo, minimal, professional, white background, sharp edges, keep exact brand text only, do not invent words, no random letters',
    banner: ', wide format banner, professional design, vibrant colors',
    icon: ', flat icon design, simple, clean, scalable',
    illustration: ', digital illustration, detailed, vibrant',
    mockup: ', product mockup, realistic, studio lighting',
    image: ', high quality, detailed, professional'
  };
  return base + (suffixes[type] || suffixes.image);
}
function buildPollinationsUrl(prompt = '', options = {}) {
  const { width = 1024, height = 1024, seed, model = 'flux', nologo = true } = options;
  const encoded = encodeURIComponent(normalizeImagePrompt(prompt));
  let url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=${model}`;
  if (nologo) url += '&nologo=true';
  if (seed !== undefined) url += `&seed=${seed}`;
  return url;
}
function extractLastImageMeta(messages = [], lookback = 15) {
  for (let i = messages.length - 1; i >= Math.max(0, messages.length - lookback); i--) {
    const text = getMessageText(messages[i].content);
    const urlMatch = text.match(/https?:\/\/image\.pollinations\.ai\/prompt\/([^\s"'<&]+)/);
    if (urlMatch) return {
      url: urlMatch[0],
      prompt: decodeMaybe(urlMatch[1].split('?')[0] || ''),
      source: 'pollinations'
    };
    const ideogramMatch = text.match(/https?:\/\/(?:img\.)?ideogram\.ai\/[^\s"'<]+/);
    if (ideogramMatch) return { url: ideogramMatch[0], prompt: '', source: 'ideogram' };
    const gensparkMatch = text.match(/https?:\/\/[^\s"'<]*genspark[^\s"'<]*/i);
    if (gensparkMatch) return { url: gensparkMatch[0], prompt: '', source: 'genspark' };
  }
  return null;
}
function conversationRecentlyHadImage(messages = [], lookback = 10) {
  return messages.slice(-lookback).some(m => {
    const text = getMessageText(m.content);
    return /image\.pollinations\.ai|ideogram\.ai|img\.ideogram\.ai|genspark/i.test(text);
  });
}
function imageContextActive(messages = [], lookback = 10) {
  if (conversationRecentlyHadImage(messages, lookback)) return true;
  return messages.slice(-lookback).some((m) => {
    const text = getMessageText(m.content).toLowerCase();
    return /data-nabad-card="image-choice"|choose the visual direction|your logo is ready|generated by nabad|logo|mockup|image|visual direction|creative artistic/.test(text);
  });
}
function isImageContinuationRequest(text = '', messages = []) {
  const t = String(text || '').toLowerCase();
  const asksGenerate = /\b(generate|create|make|design|draw|regenerate|redo)\b/.test(t);
  const hasVisualTarget = /\b(image|photo|picture|logo|icon|illustration|banner|visual|graphic|mockup)\b/.test(t);
  const refersPreviousVisual = /\b(it|this|that|same one|again|another|new version|variation)\b/.test(t);
  if (!asksGenerate) return false;
  if (imageContextActive(messages) && hasVisualTarget) return true;
  if (imageContextActive(messages) && refersPreviousVisual && /\b(regenerate|redo|recreate|another|new version|variation)\b/.test(t)) return true;
  if (/\bfor (it|this|that)\b/.test(t) && /\b(name is|brand name|company name|its name|his name)\b/.test(t)) return true;
  if (/\bbrand|branding|identity|visual\b/.test(t) && /\bname is|called\b/.test(t)) return true;
  return false;
}
function shouldGenerateImage(text = '', messages = []) {
  const t = String(text || '').toLowerCase();
  const structuredCardIntent =
    isPricingTableRequest(t) ||
    isOfferCardRequest(t) ||
    isActionPlanRequest(t) ||
    isPositioningMatrixRequest(t);
  const explicitVisualRequest =
    /\b(generate|create|make|design|draw|build|produce|regenerate|redo)\b/.test(t) &&
    /\b(image|photo|picture|logo image|mockup|illustration|banner|visual|graphic|icon)\b/.test(t);
  if (structuredCardIntent && !explicitVisualRequest) return false;

  if (isImageRequest(text)) return true;
  if (isImageContinuationRequest(text, messages)) return true;
  if (/\bgenerate\b/i.test(text) && imageContextActive(messages)) return true;
  if (isRegenerationRequest(text) && conversationRecentlyHadImage(messages)) return true;
  if (isImageModificationRequest(text) && conversationRecentlyHadImage(messages)) return true;
  return false;
}
function buildStockPhotoHtml(prompt = '') {
  const kw = encodeURIComponent(prompt.replace(/stock\s*(photo|image)/gi, '').replace(/real\s*(photo|picture|image)/gi, '').trim().slice(0, 80));
  const unsplashUrl = `https://source.unsplash.com/1024x768/?${kw}`;
  return `<div class="nabad-image-wrap"><img src="${unsplashUrl}" alt="${escapeHtml(prompt.slice(0, 80))}" class="nabad-gen-image" loading="lazy" /><p class="nabad-image-caption">Stock photo</p></div>`;
}

function extractBrandHintFromMessages(messages = []) {
  const list = Array.isArray(messages) ? messages : [];
  const userMessages = list
    .filter((m) => m?.role === 'user')
    .map((m) => cleanText(getMessageText(m.content), 300))
    .filter(Boolean);

  for (let i = userMessages.length - 1; i >= Math.max(0, userMessages.length - 8); i--) {
    const t = userMessages[i];
    const match =
      t.match(/\b(?:brand name is|project name is|name is|called)\s+([a-zA-Z0-9][a-zA-Z0-9\s\-_]{1,40})\b/i) ||
      t.match(/\bfor\s+([a-zA-Z0-9][a-zA-Z0-9\s\-_]{1,32})\s*(?:logo|brand|wordmark)\b/i);
    if (match?.[1]) return cleanText(match[1], 42);
  }

  const joined = userMessages.slice(-8).join(' ').toLowerCase();
  if (/\bnabadai\b/.test(joined)) return 'NabadAI';
  if (/\bnabad\b/.test(joined)) return 'Nabad';
  return '';
}

function enforceLogoTextAnchor(promptText = '', userText = '', messages = []) {
  const request = cleanText(userText, 500);
  const prompt = cleanText(promptText, 900) || request;
  const imageType = detectImageType(`${prompt} ${request}`);
  if (imageType !== 'logo') return prompt;

  const explicit =
    request.match(/\b(?:brand name is|project name is|name is|called)\s+([a-zA-Z0-9][a-zA-Z0-9\s\-_]{1,40})\b/i) ||
    request.match(/"([^"]{2,40})"/);
  const brand = cleanText(explicit?.[1] || extractBrandHintFromMessages(messages) || 'NabadAI', 42);
  const hasTextAnchor = /\b(exact\s*(brand|logo|wordmark)?\s*text|logo text|wordmark text|brand text)\b/i.test(prompt);
  return hasTextAnchor
    ? prompt
    : cleanText(`${prompt}, exact logo text: ${brand}, no other words`, 900);
}

async function buildImagePromptWithOpenAI(userText = '', messages = [], openaiClient, preferredProvider = 'gemini', allowOpenAI = false) {
  const brandHint = extractBrandHintFromMessages(messages) || 'NabadAI';
  try {
    const historyContext = messages
      .filter((m) => m?.role === 'user')
      .slice(-4)
      .map((m) => `user: ${getMessageText(m.content).slice(0, 220)}`)
      .join('\n');
    const result = await runTaskWithProviderFallback([
      {
        role: 'system',
        content: `You are an expert AI image prompt writer. Write one vivid image prompt (max 90 words).
Rules:
- Never invent brand names or words.
- If the request is for a logo and brand text is missing, use this fallback brand text exactly: ${brandHint}
- Return prompt text only.`
      },
      { role: 'user', content: `Recent user context:\n${historyContext}\n\nUser request: ${userText}\n\nWrite the final image prompt:` }
    ], openaiClient, preferredProvider, {
      maxTokens: 180,
      temperature: 0.8,
      returnMeta: true,
      allowOpenAI
    });
    const modelPrompt = String(result?.text || '').trim() || userText;
    return enforceLogoTextAnchor(modelPrompt, userText, messages);
  } catch {
    return enforceLogoTextAnchor(userText, userText, messages);
  }
}
async function buildImageEditPromptFromAttachment(userText = '', imageDataUrl = '', messages = [], openaiClient, allowOpenAI = false) {
  if (!allowOpenAI) return userText;
  try {
    const historyContext = messages.slice(-4).map(m => `${m.role}: ${getMessageText(m.content).slice(0, 200)}`).join('\n');
    const resp = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert image-edit prompt writer. Use the attached image and user instruction to write one clear generation prompt (max 120 words) that keeps identity and applies requested changes.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Conversation:\n${historyContext}\n\nUser edit request: ${userText}\n\nWrite the edited image prompt:` },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]
        }
      ],
      max_tokens: 200,
      temperature: 0.6
    });
    return resp.choices?.[0]?.message?.content?.trim() || userText;
  } catch {
    return userText;
  }
}
function buildGeneratedImageHtml(imageUrl = '', provider = 'pollinations') {
  return `<div class="nabad-image-wrap">
    <img src="${imageUrl}" alt="Generated image" class="nabad-gen-image" loading="lazy" />
    <p class="nabad-image-caption">Generated by Nabad</p>
  </div>`;
}
function buildImageReplyHtml(imageUrl = '', promptText = '', imageType = 'image', provider = 'pollinations') {
  const labels = { logo: '🎨 Your logo is ready', banner: '🖼️ Banner created', icon: '✨ Icon generated', illustration: '🎭 Illustration ready', mockup: '📦 Mockup generated', image: '🖼️ Image generated' };
  const label = labels[imageType] || labels.image;
  return `<p><strong>${label}</strong></p>${buildGeneratedImageHtml(imageUrl, provider)}`;
}

// ── Business Mode & Personality ───────────────────────────────────────────────
function detectBusinessMode(text = '', messages = []) {
  const t = (text + ' ' + messages.slice(-3).map(m => getMessageText(m.content)).join(' ')).toLowerCase();
  if (/\b(logo|brand|visual|design|color|font|identity)\b/.test(t)) return { id: 'branding', label: 'Brand Strategist', temperature: 0.88, maxTokens: 650, instruction: '' };
  if (/\b(ad|campaign|post|content|social|instagram|tiktok|linkedin|email|seo)\b/.test(t)) return { id: 'marketing', label: 'Marketing Expert', temperature: 0.85, maxTokens: 700, instruction: '' };
  if (/\b(revenue|growth|scale|customer|acquisition|funnel|conversion|sales)\b/.test(t)) return { id: 'growth', label: 'Growth Strategist', temperature: 0.82, maxTokens: 700, instruction: '' };
  if (/\b(offer|package|product|service|upsell|bundle|subscription|pricing)\b/.test(t)) return { id: 'offer', label: 'Offer Architect', temperature: 0.80, maxTokens: 650, instruction: '' };
  return { id: 'advisor', label: 'Business Advisor', temperature: 0.82, maxTokens: 700, instruction: '' };
}

const PERSONALITY_CONFIGS = {
  strategist: {
    id: 'strategist',
    label: '🧠 Strategist',
    temperature: 0.78,
    maxTokens: 750,
    instruction: `You are a sharp strategic thinker who has built and advised real businesses.
VOICE: Precise, confident, framework-driven — but human. Not a McKinsey deck.
Use emojis sparingly: 1-2 per reply max, only where they sharpen a point 🎯
LENGTH: Max 150 words. Lead with one sharp strategic insight.
Use structured points only when presenting a framework or comparison.
Never open with a heading. Open with a sentence that reframes how they see the problem.
Close with either "Strategic move:" or one concise follow-up only when it truly unlocks a better decision.`
  },
  growth: {
    id: 'growth',
    label: '📈 Growth',
    temperature: 0.85,
    maxTokens: 700,
    instruction: `You are obsessed with one thing: growth that actually moves the needle.
VOICE: Energetic, metric-minded, zero tolerance for vanity plays.
Use emojis where they add momentum: 📈 🚀 💡 — max 2 per reply
LENGTH: Max 120 words. Lead with the single biggest growth lever available to them.
Max 3 bullet points — each must explain WHY it works, not just WHAT it is.
Never recommend a tactic without connecting it to revenue or retention.
Close with "Growth move:" and ask a question only if one missing metric blocks the recommendation.`
  },
  branding: {
    id: 'branding',
    label: '🎨 Branding',
    temperature: 0.88,
    maxTokens: 650,
    instruction: `You see brands the way a great designer sees negative space — it's what you don't say that matters.
VOICE: Creative, emotionally intelligent, visual. You speak in feelings and images.
Use emojis that evoke mood and identity: 🎨 ✨ 💫 — max 2 per reply
LENGTH: Max 100 words. No bullet lists unless directly comparing brand options.
Make them FEEL the brand direction, not just understand it intellectually.
Use vivid, specific language. "Bold" means nothing. "Walks into a room before you do" means something.
Close with a clear brand provocation or next move. Ask a question only when needed for direction.`
  },
  offer: {
    id: 'offer',
    label: '💰 Offer',
    temperature: 0.80,
    maxTokens: 650,
    instruction: `You think like a world-class offer architect — every word in an offer either builds value or destroys it.
VOICE: Persuasive, commercially sharp, direct. You talk about money without flinching.
Use emojis that signal value and urgency: 💰 🔥 ✅ — max 2 per reply
LENGTH: Max 130 words. Lead with the value gap — what they're leaving on the table right now.
Use bullet points only for listing deliverables or value stack items.
Always anchor price to transformation, never to time or cost.
Close with "Offer move:" and only ask one question if a critical pricing variable is unknown.`
  },
  creative: {
    id: 'creative',
    label: '🎭 Creative',
    temperature: 0.92,
    maxTokens: 700,
    instruction: `You are the person in the room who says the thing nobody else will say.
VOICE: Bold, unexpected, slightly provocative. You think in metaphors and reversals.
Use emojis that feel artistic and surprising: 🎭 🌀 ⚡ 🔮 — max 2 per reply
LENGTH: Max 90 words. No bullet points. Ever. Flowing sentences only.
Your job is to completely reframe how they see the problem.
Say the opposite of what they expect. Make it memorable.
Close with a memorable statement or one sharp optional question — never a generic filler question.`
  },
  straight_talk: {
    id: 'straight_talk',
    label: '⚡ Straight Talk',
    temperature: 0.75,
    maxTokens: 600,
    instruction: `Brutally direct. Zero fluff. No lists. No headings.
MAX 60 words — hard limit. Not a suggestion. A hard limit.
Blunt doesn't mean boring — think Gordon Ramsay, not a parking ticket ⚡
Say the uncomfortable truth they already know but haven't admitted yet.
One emoji max — only if it punches harder than words alone.
End with one sharp question only when useful, otherwise end with a blunt next move.`
  },
  auto: {
    id: 'auto',
    label: '✨ Auto',
    temperature: 0.82,
    maxTokens: 700,
    instruction: `You are a real founder who has built and scaled businesses — sharp, warm, direct.
VOICE: Like a smart friend giving real advice over coffee. Has opinions. Uses humour when it fits.
Use emojis naturally the way a founder would in a DM — 1-3 per reply, where they add punch not decoration 🔥
LENGTH: Match the complexity of the question:
- Simple question → max 3 sentences, no lists
- Advice request → 1 punchy opener + max 3 points + optional single question
- Complex strategy → max 150 words, one heading max
Never open with a heading. Always open with a sentence that makes them want to keep reading.
Never use: "Absolutely" / "Great question" / "Of course" / "Certainly" / "Sure!" / "Happy to help"
End with either "Next move:" or one concise question only if needed to proceed. 🚀`
  }
};

const WAR_ROOM_CONFIG = {
  temperature: 0.88,
  maxTokens: 900,
  instruction: `You are running a War Room — a high-stakes decision analysis session.
The user is facing a significant business decision or crossroads.
You will present exactly 3 perspectives followed by a verdict.

FORMAT YOUR RESPONSE EXACTLY LIKE THIS — no deviation:

<div data-nabad-card="warroom">
<h3>⚔️ War Room</h3>

<div class="nabad-warroom-voice" data-voice="skeptic">
<div class="nabad-warroom-voice-label">🔴 The Skeptic</div>
<div class="nabad-warroom-voice-content">[Skeptic's argument — 2-3 sentences, finds the real risks and holes]</div>
</div>

<div class="nabad-warroom-voice" data-voice="optimist">
<div class="nabad-warroom-voice-label">🟢 The Optimist</div>
<div class="nabad-warroom-voice-content">[Optimist's argument — 2-3 sentences, finds the real opportunity and upside]</div>
</div>

<div class="nabad-warroom-voice" data-voice="realist">
<div class="nabad-warroom-voice-label">🟡 The Realist</div>
<div class="nabad-warroom-voice-content">[Realist's argument — 2-3 sentences, what will actually happen based on the numbers and context]</div>
</div>

<div class="nabad-warroom-verdict">
<div class="nabad-warroom-verdict-label">⚡ Nabad's Verdict</div>
<div class="nabad-warroom-verdict-content">[1-2 sentences — the single clearest move based on the user's specific situation and profile]</div>
</div>
</div>

RULES:
- Each voice must disagree with at least one other
- The Skeptic must find a real risk, not a fake one
- The Realist must reference the user's actual situation from their profile
- The Verdict must take a clear side — no "it depends"
- Never break the HTML format`
};

function getPersonalityConfig(id = 'auto') {
  return PERSONALITY_CONFIGS[id] || PERSONALITY_CONFIGS.auto;
}
function detectToneOverride(text = '') {
  const t = text.toLowerCase();
  if (/\b(be\s+direct|straight\s+talk|no\s+fluff|be\s+blunt|just\s+tell\s+me)\b/.test(t)) return 'straight_talk';
  if (/\b(think\s+creatively|be\s+creative|outside\s+the\s+box|bold\s+ideas)\b/.test(t)) return 'creative';
  if (/\b(growth|scale|grow\s+faster|acquisition)\b/.test(t)) return 'growth';
  return null;
}
function resolveActivePersonality(selectedPersonality = 'auto', lastUserMessage = '') {
  const override = detectToneOverride(lastUserMessage);
  if (override) return { personalityId: override, source: 'tone-override', overridePersonality: override };
  if (selectedPersonality && selectedPersonality !== 'auto') return { personalityId: selectedPersonality, source: 'user-selected' };
  return { personalityId: 'auto', source: 'auto' };
}

// ── Positioning ───────────────────────────────────────────────────────────────
function isPositioningQuestion(text = '') {
  return /\b(what (are|is) (you|nabad)|who (are|is) (you|nabad)|tell me about (yourself|nabad)|what can (you|nabad) do|how (are you|is nabad) different|compare (you|nabad)|vs (chatgpt|gpt|claude|gemini)|better than)\b/i.test(text);
}
const POSITIONING_REPLY = `<p><strong>NabadAI isn't a chatbot. It's your business co-founder.</strong></p><p>While other AI tools answer questions, Nabad builds your strategy. It knows your market, challenges your assumptions, and helps you move — not just think.</p><ul><li>🎯 <strong>Business-first</strong> — every response is filtered through a founder lens</li><li>⚡ <strong>Opinionated</strong> — Nabad tells you what it actually thinks, not what sounds safe</li><li>🧠 <strong>Context-aware</strong> — remembers your business details across the conversation</li><li>🛠️ <strong>Action-oriented</strong> — ends with moves, not maybes</li></ul><p>Think less "AI assistant" and more "co-founder who's done this before." 🚀</p>`;

// ── Proactive Intelligence ────────────────────────────────────────────────────
function buildProactiveIntelligence(messages = [], lastUserMessage = '') {
  const msgCount = messages.filter(m => m.role === 'user').length;
  if (msgCount < 2) return '';
  const allText = messages.map(m => getMessageText(m.content).toLowerCase()).join(' ');
  const insights = [];
  if (/social media|instagram|tiktok|content/.test(allText) && !/paid|ads|sponsor/.test(allText)) insights.push('Consider whether paid amplification would accelerate what organic content is building.');
  if (/freelan|agency|service/.test(allText) && !/retainer|recurring/.test(allText)) insights.push('Retainer-based pricing could stabilize cash flow vs. project-based work.');
  if (/product|launch|mvp/.test(allText) && !/waitlist|pre.?launch|pre.?sell/.test(allText)) insights.push('A pre-launch waitlist could validate demand before full investment.');
  return insights.length ? `\n\nProactive intelligence (weave into reply naturally, never list verbatim): ${insights.join(' | ')}` : '';
}

function buildMemoryContext(messages = [], userProfile = '', storedMemory = {}) {
  const facts = [];

  // ── Pull from structured userProfile string first ──
  if (userProfile) {
    const profilePairs = userProfile.split('|').map(s => s.trim()).filter(Boolean);
    profilePairs.forEach(pair => {
      if (pair.length > 3) facts.push(pair);
    });
  }

  // ── Also scan conversation for anything not already in profile ──
  const userMsgs = messages.filter(m => m.role === 'user')
    .map(m => getMessageText(m.content).toLowerCase());
  const combined = userMsgs.join(' ');
  const profileLower = userProfile.toLowerCase();

  const industryMatch = combined.match(
    /\b(agency|restaurant|cafe|gym|clinic|salon|ecommerce|saas|consulting|coaching|retail)\b/
  );
  if (industryMatch && !profileLower.includes(industryMatch[1])) {
    facts.push(`Industry detected: ${industryMatch[1]}`);
  }

  const revenueMatch = combined.match(
    /\$[\d,]+\s*(\/month|per month|monthly|\/mo)?|\b[\d,]+\s*(aed|sar|egp|usd|gbp|eur)\b/i
  );
  if (revenueMatch && !profileLower.includes(revenueMatch[0].toLowerCase())) {
    facts.push(`Revenue mentioned: ${revenueMatch[0]}`);
  }

  const clientMatch = combined.match(/(\d+)\s*(clients?|customers?|accounts?)/i);
  if (clientMatch && !profileLower.includes(clientMatch[0].toLowerCase())) {
    facts.push(`Clients: ${clientMatch[0]}`);
  }

  const goalMatch = combined.match(
    /\b(scale|grow|reach|hit|achieve)\b.{0,40}\b(\$[\d,]+|[\d,]+k|10k|20k|50k|100k)\b/i
  );
  if (goalMatch && !profileLower.includes(goalMatch[0].toLowerCase())) {
    facts.push(`Goal: ${goalMatch[0]}`);
  }

  const learning = storedMemory?.learning && typeof storedMemory.learning === 'object'
    ? storedMemory.learning
    : {};
  if (Array.isArray(learning.goals) && learning.goals.length) {
    facts.push(`Persistent goals: ${learning.goals.slice(0, 3).join(' | ')}`);
  }
  if (Array.isArray(learning.constraints) && learning.constraints.length) {
    facts.push(`Known constraints: ${learning.constraints.slice(0, 3).join(' | ')}`);
  }
  if (Array.isArray(learning.preferences) && learning.preferences.length) {
    facts.push(`Communication preferences: ${learning.preferences.slice(0, 3).join(' | ')}`);
  }
  if (Array.isArray(learning.knownFields) && learning.knownFields.length) {
    facts.push(`Remembered details: ${learning.knownFields.slice(0, 4).join(' | ')}`);
  }

  if (!facts.length) return '';

  return `\n\nWhat Nabad knows about this founder (use this naturally — reference it when relevant, never recite it as a list, never ask for info already here):\n${facts.join('\n')}`;
}

function extractRecentAssistantQuestions(messages = [], lookback = 10) {
  const seen = new Set();
  const out = [];
  const recent = messages.filter((m) => m.role === 'assistant').slice(-lookback);
  for (const m of recent) {
    const text = cleanText(getMessageText(m.content), 1200);
    if (!text) continue;
    const matches = text.match(/[^?]{8,180}\?/g) || [];
    for (const raw of matches) {
      const q = cleanText(raw, 180);
      if (!q) continue;
      if (!/\b(who|what|why|how|which|where|when|would|could|should|are|is|do|does|can)\b/i.test(q)) continue;
      const key = q.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(q);
      if (out.length >= 4) return out;
    }
  }
  return out;
}

function buildQuestionGuardContext(messages = []) {
  const recentQs = extractRecentAssistantQuestions(messages, 10);
  if (!recentQs.length) return '';
  return `\n\nRecent assistant questions already asked (do NOT repeat these, do NOT paraphrase them with same meaning):\n- ${recentQs.join('\n- ')}`;
}

// ── Location Detection ────────────────────────────────────────────────────────
function extractLocationFromMessages(messages = []) {
  const text = messages.map(m => getMessageText(m.content)).join(' ');
  const patterns = [
    /\b(based in|located in|from|in|i'm in|we're in)\s+([A-Za-z\s]{2,30}(?:UAE|KSA|UK|US|USA|Egypt|Jordan|Kuwait|Bahrain|Oman|Qatar|Saudi|Dubai|Abu Dhabi|Riyadh|Cairo|London|New York|Lagos))/i,
    /\b(Dubai|Abu Dhabi|Sharjah|Riyadh|Jeddah|Cairo|Amman|Kuwait City|Manama|Muscat|Doha|London|New York|Lagos|Nairobi|Karachi|Lahore)\b/i
  ];
  for (const p of patterns) { const m = text.match(p); if (m) return m[2] || m[1] || m[0]; }
  return '';
}
function buildLocationContext(location = '') {
  if (!location) return '';
  const loc = location.toLowerCase();
  const contexts = {
    dubai: 'Dubai/UAE context: VAT 5%, free zones available, strong expat market, high competition in services, Arabic & English markets.',
    'abu dhabi': 'Abu Dhabi/UAE context: Government-heavy economy, strong B2G opportunities, VAT 5%, Emiratization policies relevant for hiring.',
    riyadh: 'Saudi Arabia context: VAT 15%, Vision 2030 driving new sectors, large youth population, social media penetration is very high.',
    cairo: 'Egypt context: Price-sensitive market, USD-based pricing can be premium, strong freelance economy, Arabic content performs well.',
    london: 'UK context: VAT 20%, competitive market, strong startup ecosystem, IR35 regulations if hiring contractors.',
    lagos: 'Nigeria context: Naira volatility, USD pricing preferred by many businesses, large youth market, mobile-first consumers.'
  };
  for (const [key, ctx] of Object.entries(contexts)) {
    if (loc.includes(key)) return `\n\nLocation context: ${ctx}`;
  }
  return `\n\nLocation context: User is based in ${location}. Tailor advice to local market conditions where relevant.`;
}
function hasBusinessContext(text = '') {
  return /\b(business|startup|agency|product|service|client|revenue|launch|idea|offer|brand|market|customer|pricing|scale|grow)\b/i.test(text);
}
function isLegalComplianceRequest(text = '') {
  return /\b(legal|law|regulation|regulations|license|licence|permit|permits|compliance|contract|contracts|tax|vat|corporate tax|labor law|employment law|paperwork|documents|visa|residency|incorporat|register company|trade license|gdpr|data privacy|terms and conditions|privacy policy)\b/i.test(text);
}
function shouldShowLegalChecklistCard(text = '') {
  const t = String(text || '').toLowerCase();
  const legalTopic = isLegalComplianceRequest(t);
  if (!legalTopic) return false;
  const explicitChecklistIntent = /\b(checklist|starter pack|required docs|required documents|which papers|what papers|requirements|steps|step by step|what do i need to file|how to register|how to incorporate|legal setup|company setup)\b/.test(t);
  return explicitChecklistIntent;
}
function detectIndustryFromContext(text = '') {
  const t = text.toLowerCase();
  if (/\b(ecommerce|shopify|online store|d2c|retail)\b/.test(t)) return 'ecommerce';
  if (/\b(saas|software|app|platform)\b/.test(t)) return 'saas';
  if (/\b(agency|marketing agency|creative agency|consulting|freelance)\b/.test(t)) return 'services';
  if (/\b(restaurant|cafe|food|f&b)\b/.test(t)) return 'food';
  if (/\b(clinic|medical|health|pharmacy)\b/.test(t)) return 'healthcare';
  if (/\b(fintech|finance|payments|banking|lending|insurance)\b/.test(t)) return 'fintech';
  if (/\b(real estate|property|brokerage)\b/.test(t)) return 'real_estate';
  if (/\b(manufacturing|factory|industrial)\b/.test(t)) return 'manufacturing';
  return 'general';
}
function detectCountryFromContext(text = '') {
  const t = text.toLowerCase();
  if (/\b(uae|united arab emirates|dubai|abu dhabi|sharjah)\b/.test(t)) return 'UAE';
  if (/\b(saudi|ksa|riyadh|jeddah)\b/.test(t)) return 'KSA';
  if (/\b(uk|united kingdom|england|london)\b/.test(t)) return 'UK';
  if (/\b(us|usa|united states|america|new york|california|texas)\b/.test(t)) return 'US';
  if (/\b(egypt|cairo|alexandria)\b/.test(t)) return 'Egypt';
  return '';
}
function buildLegalChecklistCard(country = '', industry = 'general') {
  const escCountry = escapeHtml(country || 'your country');
  const escIndustry = escapeHtml(industry.replace('_', ' '));
  const countryMap = {
    UAE: [
      'Trade license / mainland or free-zone registration',
      'Corporate tax registration and VAT registration if threshold is met',
      'Ultimate Beneficial Owner (UBO) declaration where required',
      'Employment contracts aligned with UAE labor law and payroll setup',
      'Data/privacy and website terms (especially for e-commerce and SaaS)'
    ],
    KSA: [
      'Commercial registration and MISA / relevant authority setup when applicable',
      'ZATCA tax registration (VAT / e-invoicing obligations)',
      'Municipality and sector permits based on activity',
      'Saudi labor law compliant contracts and HR policies',
      'Consumer protection and e-commerce compliance where applicable'
    ],
    UK: [
      'Company incorporation and Companies House filings',
      'HMRC registrations (Corporation Tax, VAT if threshold is met, PAYE)',
      'Sector-specific authorizations if regulated activity is involved',
      'Employment contracts, right-to-work checks, and HR compliance',
      'Data protection obligations (UK GDPR), privacy policy and cookie handling'
    ],
    US: [
      'State incorporation/formation and EIN setup',
      'Federal/state/local tax registrations and sales tax where applicable',
      'Business licenses and city/county permits based on activity',
      'Employment documentation and worker classification compliance',
      'Privacy policy, terms, and sector rules (state/federal depending on model)'
    ],
    Egypt: [
      'Commercial registration and tax card setup',
      'VAT and corporate tax registration where applicable',
      'Activity-specific permits from relevant ministries/authorities',
      'Labor law-compliant contracts and social insurance enrollment',
      'Consumer protection and digital compliance for online businesses'
    ]
  };
  const industryMap = {
    ecommerce: [
      'Returns/refunds policy and consumer protection terms',
      'Payment gateway compliance, invoicing, and product liability checks'
    ],
    saas: [
      'SaaS terms, SLA, data processing terms, and privacy policy',
      'IP ownership, licensing terms, and cybersecurity controls'
    ],
    services: [
      'Master service agreement (MSA), statement of work template, payment terms',
      'Liability caps, dispute resolution, and cancellation clauses'
    ],
    food: [
      'Health/safety approvals and food handling permits',
      'Supplier compliance, labeling and hygiene obligations'
    ],
    healthcare: [
      'Healthcare authority licensing and practitioner credentials',
      'Medical data privacy and consent workflows'
    ],
    fintech: [
      'Financial services licensing perimeter check',
      'AML/KYC obligations and payment compliance requirements'
    ],
    real_estate: [
      'Brokerage/developer licensing rules and escrow requirements',
      'Advertising and contract disclosure obligations'
    ],
    manufacturing: [
      'Factory/industrial permits and safety compliance',
      'Import/export, standards certification and product conformity rules'
    ],
    general: [
      'Founder agreement and ownership structure documentation',
      'Basic contract stack: client terms, vendor terms, and privacy/website terms'
    ]
  };
  const countryItems = (countryMap[country] || countryMap.UK).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const industryItems = (industryMap[industry] || industryMap.general).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  return `<div data-nabad-card="legal" style="background:linear-gradient(180deg,#f7faff 0%,#eef6ff 100%);border-radius:16px;padding:18px;color:#0f172a;margin:8px 0;border:1px solid rgba(37,99,235,.14)">
  <h3 style="margin:0 0 10px;font-size:17px">Legal Starter Pack</h3>
  <p style="margin:0 0 10px;font-size:13px;opacity:.88"><strong>Country:</strong> ${escCountry} · <strong>Industry:</strong> ${escIndustry}</p>
  <div style="background:#fff;border:1px solid rgba(37,99,235,.12);border-radius:12px;padding:12px;margin-bottom:10px">
    <div style="font-size:11px;text-transform:uppercase;color:#64748b;margin-bottom:6px">Core setup checklist</div>
    <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6">${countryItems}</ul>
  </div>
  <div style="background:#fff;border:1px solid rgba(37,99,235,.12);border-radius:12px;padding:12px;margin-bottom:10px">
    <div style="font-size:11px;text-transform:uppercase;color:#64748b;margin-bottom:6px">Industry-specific checks</div>
    <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6">${industryItems}</ul>
  </div>
  <p style="margin:0;font-size:12px;color:#64748b">This is strategic guidance, not legal advice. For filing or legal risk decisions, confirm with a licensed local lawyer/accountant.</p>
</div>`;
}
function shouldGateIdeaGeneration(text = '', messages = [], userProfile = '') {
  const asksForIdeas = /\b(give me ideas|share ideas|suggest ideas|brainstorm|brainstorming|what should i build|what business should i start|what should i do next|give me options|suggest\b)\b/i.test(text);
  if (!asksForIdeas) return false;
  const recentlyAskedAnchor = messages.slice(-8).some((m) =>
    m.role === 'assistant' &&
    /quick anchor before i generate ideas|who is your exact first customer|what are you actually selling first|what result do you want in the next 90 days/i.test(getMessageText(m.content))
  );
  if (recentlyAskedAnchor) return false;
  const contextBlob = `${messages.slice(-8).map(m => getMessageText(m.content)).join(' ')} ${userProfile}`.toLowerCase();
  const hasAudience = /\b(customer|audience|client|target|niche)\b/.test(contextBlob);
  const hasOffer = /\b(product|service|offer|package|saas|agency|store)\b/.test(contextBlob);
  const hasGoal = /\b(revenue|sales|grow|scale|launch|conversion|profit)\b/.test(contextBlob);
  return [hasAudience, hasOffer, hasGoal].filter(Boolean).length < 2;
}
function buildIdeaGateQuestion(text = '', userProfile = '') {
  const t = `${text} ${userProfile}`.toLowerCase();
  const hasAudience = /\b(founder|owners?|restaurants?|brands?|agencies?|parents?|students?|freelancers?|b2b|b2c|customer|client)\b/.test(t);
  const hasOffer = /\b(offer|service|product|subscription|course|agency|software|app|tool|consulting)\b/.test(t);
  const hasGoal = /\b(revenue|sales|clients?|leads?|launch|scale|grow|profit|mrr|arr)\b/.test(t);

  if (!hasAudience) {
    return `<p>To avoid random ideas, give me one target user first. <strong>Who exactly is your first customer?</strong></p>`;
  }
  if (!hasOffer) {
    return `<p>One anchor before ideas: <strong>what is the first offer you want to sell?</strong></p>`;
  }
  if (!hasGoal) {
    return `<p>One anchor before ideas: <strong>what 90-day result do you want most?</strong></p>`;
  }
  return `<p>Give me one line with your customer and your 90-day goal, then I’ll generate sharp ideas.</p>`;
}

function isWebsiteReviewRequest(text = '') {
  const t = String(text || '').toLowerCase();
  return (
    /\b(review|audit|analy[sz]e|assess|check|evaluate|opinion|feedback)\b/.test(t)
      && /\b(url|website|site|landing page|landing|webpage|link)\b/.test(t)
  ) || /\b(check|review|audit|analy[sz]e)\s+(https?:\/\/|www\.|[a-z0-9][a-z0-9-]*\.[a-z]{2,})/i.test(t);
}
function wantsStructuredCardFormat(text = '') {
  const t = String(text || '').toLowerCase();
  return /\b(card|scorecard|table|matrix|checklist|roadmap|step.?by.?step|template|formatted|format as|pricing|price card)\b/.test(t);
}
function hasRichBusinessContext(messages = []) {
  const userMsgs = messages.filter(m => m.role === 'user').map(m => getMessageText(m.content).toLowerCase());
  const combined = userMsgs.join(' ');
  const checks = [
    /\b(agency|startup|business|product|service|brand)\b/.test(combined),
    /\b(client|customer|revenue|\$|income|pay)\b/.test(combined),
    /\b(problem|struggle|challenge|stuck|issue)\b/.test(combined)
  ];
  return checks.filter(Boolean).length >= 2;
}
function locationAlreadyAsked(messages = []) {
  return messages.some(m => m.role === 'assistant' && /where are you based|what city|which country|your location|what market are you in/i.test(getMessageText(m.content)));
}
function pricingCurrencyAlreadyAsked(messages = []) {
  return messages.some((m) => {
    if (m.role !== 'assistant') return false;
    const t = getMessageText(m.content).toLowerCase();
    return t.includes('preferred currency') || t.includes('aed/usd/sar');
  });
}

// ── Business Snapshot ─────────────────────────────────────────────────────────
function snapshotAlreadyOffered(messages = []) {
  return messages.some(m => m.role === 'assistant' && /business snapshot/i.test(getMessageText(m.content)));
}
function shouldOfferSnapshot(messages = []) {
  const userMsgs = messages.filter(m => m.role === 'user');
  if (userMsgs.length < 3) return false;
  if (snapshotAlreadyOffered(messages)) return false;
  return hasRichBusinessContext(messages);
}

async function generateBusinessSnapshot(messages = [], location = '', openaiClient, userProfile = '', preferredProvider = 'gemini', allowOpenAI = false) {
  const context = messages.filter(m => m.role === 'user').map(m => getMessageText(m.content)).join('\n');
  const profileContext = userProfile ? `User onboarding profile:\n${userProfile}\n\n` : '';
  const prompt = `${profileContext}Based on this business conversation, create a concise Business Snapshot JSON with these exact fields:
{
  "businessType": "one-line description",
  "stage": "idea/early/growing/scaling",
  "biggestOpportunity": "specific, actionable opportunity in 2-3 sentences",
  "keyRisk": "the most critical risk to address in 2-3 sentences",
  "boldRecommendation": "one bold, specific recommendation in 2-3 sentences",
  "quickWins": ["win1", "win2", "win3"],
  "metrics": {"current": "current state", "target": "realistic 90-day target"}
}
Context: ${context.slice(0, 2000)}
Location: ${location || 'not specified'}`;

  const result = await runTaskWithProviderFallback([
    { role: 'system', content: 'Return only valid JSON. No markdown.' },
    { role: 'user', content: prompt }
  ], openaiClient, preferredProvider, {
    maxTokens: 600,
    temperature: 0.7,
    returnMeta: true,
    allowOpenAI
  });
  return tryParseJsonBlock(String(result?.text || '')) || {};
}

function buildSnapshotCard(data = {}, location = '') {
  const esc = escapeHtml;
  const quickWins = normalizeList(data.quickWins || []).slice(0, 3).map(w => `<li>${esc(w)}</li>`).join('');
  return `<div data-nabad-card="snapshot" style="background:linear-gradient(180deg,#f7faff 0%,#eef6ff 100%);border-radius:16px;padding:24px;color:#0f172a;margin:8px 0;font-family:inherit;border:1px solid rgba(37,99,235,.14)">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <span style="font-size:24px">📊</span>
    <div><strong style="font-size:16px">Business Snapshot</strong>${location ? `<br><span style="font-size:11px;color:#64748b">📍 ${esc(location)}</span>` : ''}</div>
  </div>
  <div style="background:#fff;border:1px solid rgba(37,99,235,.12);border-radius:10px;padding:14px;margin-bottom:10px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px">Biggest Opportunity</div>
    <div style="font-size:14px;line-height:1.5">${esc(data.biggestOpportunity || 'Analysing your opportunity...')}</div>
  </div>
  <div style="background:rgba(255,100,100,.12);border-radius:10px;padding:14px;margin-bottom:10px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px">Key Risk</div>
    <div style="font-size:14px;line-height:1.5">${esc(data.keyRisk || 'Risk analysis in progress...')}</div>
  </div>
  <div style="background:rgba(100,255,150,.12);border-radius:10px;padding:14px;margin-bottom:10px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px">Bold Recommendation</div>
    <div style="font-size:14px;line-height:1.5">${esc(data.boldRecommendation || 'Generating recommendation...')}</div>
  </div>
  ${quickWins ? `<div style="margin-top:10px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:8px">Quick Wins</div><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8">${quickWins}</ul></div>` : ''}
  ${data.metrics ? `<div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style="background:#fff;border:1px solid rgba(37,99,235,.12);border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:#64748b;margin-bottom:4px">NOW</div><div style="font-size:13px">${esc(data.metrics.current || '')}</div></div><div style="background:#eff6ff;border:1px solid rgba(37,99,235,.16);border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:#64748b;margin-bottom:4px">90-DAY TARGET</div><div style="font-size:13px">${esc(data.metrics.target || '')}</div></div></div>` : ''}
</div>`;
}

// ── Nabad Score ───────────────────────────────────────────────────────────────
function isIdeaScoringRequest(text = '') {
  const t = String(text || '').toLowerCase();
  return /\b(nabad score|score card|scorecard)\b/.test(t)
    || /\b(score|rate|rating|rank|grade)\b.{0,40}\b(idea|concept|business|startup)\b/.test(t)
    || /\b(give me|show me|create|build)\b.{0,40}\b(score|rating|score card|scorecard)\b/.test(t);
}
async function generateNabadScore(messages = [], openaiClient, preferredProvider = 'gemini', allowOpenAI = false) {
  const context = messages.filter(m => m.role === 'user').map(m => getMessageText(m.content)).join('\n');
  const prompt = `Analyse this business idea and return a JSON Nabad Score:
{
  "ideaSummary": "one-line summary of the business idea",
  "scores": {
    "marketDemand": {"score": 75, "comment": "explanation"},
    "differentiation": {"score": 68, "comment": "explanation"},
    "monetization": {"score": 80, "comment": "explanation"},
    "executionDifficulty": {"score": 55, "comment": "lower is easier"},
    "timing": {"score": 72, "comment": "explanation"}
  },
  "overallScore": 70,
  "verdict": "one bold sentence verdict",
  "topStrength": "biggest strength",
  "biggestRisk": "biggest risk",
  "recommendation": "what to do next"
}
Context: ${context.slice(0, 2000)}`;
  const result = await runTaskWithProviderFallback([
    { role: 'system', content: 'Return only valid JSON. No markdown.' },
    { role: 'user', content: prompt }
  ], openaiClient, preferredProvider, {
    maxTokens: 700,
    temperature: 0.7,
    returnMeta: true,
    allowOpenAI
  });
  return tryParseJsonBlock(String(result?.text || '')) || {};
}
function buildScoreCard(data = {}) {
  const esc = escapeHtml;
  const scores = data.scores || {};
  const scoreItems = [
    { key: 'marketDemand', label: 'Market Demand', icon: '📊' },
    { key: 'differentiation', label: 'Differentiation', icon: '🎯' },
    { key: 'monetization', label: 'Monetization', icon: '💰' },
    { key: 'executionDifficulty', label: 'Execution Ease', icon: '⚙️' },
    { key: 'timing', label: 'Timing', icon: '⏱️' }
  ].filter(item => scores[item.key]);
  const overall = data.overallScore || 0;
  const scoreColor = overall >= 75 ? '#2ecc71' : overall >= 55 ? '#f39c12' : '#e74c3c';
  const bars = scoreItems.map(item => {
    const s = scores[item.key]; const pct = Math.min(100, Math.max(0, s.score || 0));
    return `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:13px">${item.icon} ${esc(item.label)}</span>
        <span style="font-size:13px;font-weight:700;color:${pct>=70?'#2ecc71':pct>=50?'#f39c12':'#e74c3c'}">${pct}</span>
      </div>
      <div style="background:rgba(37,99,235,.12);border-radius:99px;height:6px;overflow:hidden">
        <div data-score="${pct}" style="height:100%;border-radius:99px;background:${pct>=70?'#2ecc71':pct>=50?'#f39c12':'#e74c3c'};width:${pct}%"></div>
      </div>
      ${s.comment ? `<div style="font-size:11px;color:#64748b;margin-top:3px">${esc(s.comment)}</div>` : ''}
    </div>`;
  }).join('');
  return `<div data-nabad-card="score" style="background:linear-gradient(180deg,#f7faff 0%,#eef6ff 100%);border-radius:16px;padding:24px;color:#0f172a;margin:8px 0;font-family:inherit;border:1px solid rgba(37,99,235,.14)">
  <div style="text-align:center;margin-bottom:20px">
    <div style="font-size:48px;font-weight:800;color:${scoreColor}">${overall}</div>
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#64748b">Nabad Score</div>
    ${data.ideaSummary ? `<div style="font-size:13px;color:#64748b;margin-top:6px;font-style:italic">${esc(data.ideaSummary)}</div>` : ''}
  </div>
  ${bars}
  ${data.verdict ? `<div style="background:#fff;border:1px solid rgba(37,99,235,.12);border-radius:10px;padding:12px;margin-top:16px;font-size:14px;font-weight:600;text-align:center">${esc(data.verdict)}</div>` : ''}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
    ${data.topStrength ? `<div style="background:#ecfdf3;border:1px solid rgba(34,197,94,.2);border-radius:8px;padding:10px"><div style="font-size:10px;color:#64748b;margin-bottom:4px">💪 TOP STRENGTH</div><div style="font-size:12px">${esc(data.topStrength)}</div></div>` : ''}
    ${data.biggestRisk ? `<div style="background:#fff7ed;border:1px solid rgba(249,115,22,.2);border-radius:8px;padding:10px"><div style="font-size:10px;color:#64748b;margin-bottom:4px">⚠️ BIGGEST RISK</div><div style="font-size:12px">${esc(data.biggestRisk)}</div></div>` : ''}
  </div>
  ${data.recommendation ? `<div style="margin-top:12px;padding:12px;background:#eff6ff;border-radius:8px;border-left:3px solid #2563eb"><div style="font-size:11px;color:#64748b;margin-bottom:4px">🚀 NEXT MOVE</div><div style="font-size:13px">${esc(data.recommendation)}</div></div>` : ''}
</div>`;
}

// ── Pricing Table ─────────────────────────────────────────────────────────────
function isPricingTableRequest(text = '') {
  return /\b(pricing table|price table|pricing card|price card|pricing plan|pricing tier|tier(ed)? pricing|package price|service price|how much (should|do|to) (i |we )?charge|price my (service|offer|package|product))\b/i.test(text)
    || /\b(create|build|show|give|make|design)\b.{0,30}\b(pricing|price plan|packages?)\b/i.test(text);
}
function pricingCardAnchorPromptRecently(messages = [], lookback = 8) {
  return messages.slice(-lookback).some((m) => {
    if (m.role !== 'assistant') return false;
    const text = getMessageText(m.content).toLowerCase();
    return text.includes('i can build a premium pricing card') && text.includes('i need 3 anchors');
  });
}
function hasPricingAnchorContext(messages = [], lastUserMessage = '') {
  const userMessages = (Array.isArray(messages) ? messages : [])
    .filter((m) => m.role === 'user')
    .map((m) => getMessageText(m.content));
  const recentUserText = `${userMessages.slice(-3).join(' ')} ${lastUserMessage}`.toLowerCase();
  const hasOffer = /\b(offer|service|package|product|subscription|consulting|agency|saas|chatbot|assistant|app|tool)\b/.test(recentUserText);
  const hasAudience = /\b(client|customer|audience|target|founder|startup|brand|business|team|company|enterprise)\b/.test(recentUserText);
  const hasOutcome = /\b(outcome|result|goal|benefit|solve|improve|grow|conversion|sales|trust|leads|efficiency|save time|save money|support|assist|help|provide|provides|deliv(?:er|ers|ery)|service|automation|reduce cost|increase|boost|daily|weekly|faster|clarity)\b/.test(recentUserText);
  const commaSegments = String(lastUserMessage || '')
    .split(',')
    .map((s) => cleanText(s, 120).toLowerCase())
    .filter(Boolean);
  const hasThreeAnchorLine = commaSegments.length >= 3;
  return (hasOffer && hasAudience && hasOutcome) || (hasThreeAnchorLine && hasOffer && hasAudience);
}
function hasEnoughPricingContext(messages = [], userProfile = '', lastUserMessage = '') {
  const userMessages = (Array.isArray(messages) ? messages : [])
    .filter((m) => m.role === 'user')
    .map((m) => getMessageText(m.content));
  const recentUserText = userMessages.slice(-3).join(' ').toLowerCase();
  const profileText = `${userProfile} ${lastUserMessage}`.toLowerCase();

  const hasOffer = /\b(offer|service|package|product|subscription|consulting|agency|saas|design|branding|marketing)\b/.test(recentUserText) ||
    /\b(offer|service|package|product|subscription)\b/.test(profileText);
  const hasAudience = /\b(client|customer|audience|target|founder|startup|brand|business)\b/.test(recentUserText);
  const hasDeliverables = /\b(include|includes|deliverable|feature|what you get|scope|support|review|strategy|logo|kit|guide)\b/.test(recentUserText);
  const hasPriceSignal = /\b(aed|usd|sar|egp|price|pricing|per month|per year|\/month|\/year|\$\s*\d|\d+\s*(aed|usd|sar|egp))\b/.test(`${recentUserText} ${lastUserMessage.toLowerCase()}`);

  return hasOffer && (hasPriceSignal || hasPricingAnchorContext(messages, lastUserMessage)) && (hasAudience || hasDeliverables);
}
function hasPlaceholderText(value = '') {
  const t = cleanText(String(value || ''), 240);
  if (!t) return true;
  return /\b(feature\s*\d+|deliverable\s*\d+|bonus\s*\d+|lorem ipsum|tbd|n\/a)\b/i.test(t);
}
function isPricingDataUsable(data = {}) {
  const tiers = Array.isArray(data?.tiers) ? data.tiers : [];
  if (tiers.length < 2) return false;
  for (const tier of tiers) {
    const name = cleanText(tier?.name || '', 80);
    const price = cleanText(String(tier?.price || ''), 80);
    const features = normalizeList(tier?.features || []);
    if (!name || !price || !features.length) return false;
    if (hasPlaceholderText(name) || hasPlaceholderText(tier?.description || '')) return false;
    if (features.some((f) => hasPlaceholderText(f))) return false;
  }
  return true;
}
function pickCurrencyFromLocation(location = '') {
  const loc = String(location || '').toLowerCase();
  if (/\b(uae|dubai|abu dhabi|sharjah)\b/.test(loc)) return 'AED';
  if (/\b(ksa|saudi|riyadh|jeddah)\b/.test(loc)) return 'SAR';
  if (/\b(egypt|cairo|alexandria)\b/.test(loc)) return 'EGP';
  if (/\b(uk|london|united kingdom)\b/.test(loc)) return 'GBP';
  if (/\b(us|usa|united states|new york|california)\b/.test(loc)) return 'USD';
  return 'USD';
}

function buildFallbackPricingData(messages = [], lastUserMessage = '', location = '', userProfile = '') {
  const userMsgs = (Array.isArray(messages) ? messages : [])
    .filter((m) => m.role === 'user')
    .map((m) => cleanText(getMessageText(m.content), 260));
  const candidateLine =
    [cleanText(lastUserMessage, 260), ...userMsgs.slice(-3).reverse()]
      .find((t) => t && t.split(',').length >= 3) || '';

  const parts = candidateLine.split(',').map((p) => cleanText(p, 90)).filter(Boolean);
  const offerSeed = parts[0] || 'NabadAI Service';
  const audienceSeed = parts[1] || 'Founders and business teams';
  const outcomeSeed = parts[2] || 'Save time and improve strategic decisions';
  const currency = pickCurrencyFromLocation(location || userProfile);

  return {
    title: `${offerSeed} Pricing`,
    subtitle: `Built for ${audienceSeed}`,
    currency,
    tiers: [
      {
        name: 'Starter',
        price: currency === 'AED' ? '299' : '99',
        period: 'month',
        description: 'Fast launch and core support',
        features: [
          `Core support for ${audienceSeed}`,
          `${outcomeSeed} with weekly guidance`,
          'Priority chat support'
        ],
        cta: 'Get Started',
        highlighted: false
      },
      {
        name: 'Growth',
        price: currency === 'AED' ? '799' : '249',
        period: 'month',
        description: 'Best for teams scaling execution',
        features: [
          'Everything in Starter',
          'Advanced strategy and offer optimization',
          'Bi-weekly review and action plan'
        ],
        cta: 'Most Popular',
        highlighted: true
      },
      {
        name: 'Scale',
        price: currency === 'AED' ? '1499' : '499',
        period: 'month',
        description: 'Full strategic partnership layer',
        features: [
          'Everything in Growth',
          'Custom workflows and decision support',
          'Founder-level priority response'
        ],
        cta: "Let's Scale",
        highlighted: false
      }
    ]
  };
}

async function generatePricingTable(messages = [], location = '', openaiClient, preferredProvider = 'gemini', debugTrace = null, allowOpenAI = false) {
  const context = messages.filter(m => m.role === 'user').map(m => getMessageText(m.content)).join('\n');
  const prompt = `Create a professional pricing table JSON for this business:
{
  "title": "Service Pricing",
  "subtitle": "Choose the plan that fits your needs",
  "currency": "USD",
  "tiers": [
    {"name": "Starter", "price": "500", "period": "month", "description": "Perfect for getting started", "features": ["Feature 1", "Feature 2", "Feature 3"], "cta": "Get Started", "highlighted": false},
    {"name": "Growth", "price": "1200", "period": "month", "description": "For growing businesses", "features": ["Everything in Starter", "Feature 4", "Feature 5", "Feature 6"], "cta": "Most Popular", "highlighted": true},
    {"name": "Scale", "price": "2500", "period": "month", "description": "Full-service solution", "features": ["Everything in Growth", "Feature 7", "Feature 8", "Feature 9", "Feature 10"], "cta": "Let's Scale", "highlighted": false}
  ]
}
Rules:
- Never use placeholders like "Feature 1", "Feature 2", or generic filler.
- Every feature must be concrete and specific to the business context.
- If context is weak, infer cautiously but keep items realistic and useful.
Use realistic pricing for their market. Location: ${location || 'not specified'}. Context: ${context.slice(0, 1500)}`;
  const result = await runTaskWithProviderFallback([
    { role: 'system', content: 'Return only valid JSON for pricing card data. No markdown, no explanations.' },
    { role: 'user', content: prompt }
  ], openaiClient, preferredProvider, {
    temperature: 0.6,
    maxTokens: 900,
    returnMeta: true,
    allowOpenAI
  });
  if (debugTrace && typeof debugTrace === 'object') {
    debugTrace.pricingTable = result?.provider || preferredProvider;
  }
  return tryParseJsonBlock(String(result?.text || '')) || {};
}
function buildPricingTableCard(data = {}) {
  const esc = escapeHtml;
  const tiers = Array.isArray(data.tiers) ? data.tiers : [];
  const currency = data.currency || 'USD';
  const symbols = { USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SAR: 'SAR ', EGP: 'EGP ' };
  const sym = symbols[currency] || '$';
  const tierHtml = tiers.map((tier, idx) => {
    const features = normalizeList(tier.features || []).map(f => `<tr><td data-pricing-feature style="padding:6px 0;font-size:13px;border-bottom:1px solid rgba(37,99,235,.1)">✓ ${esc(f)}</td></tr>`).join('');
    return `<div data-pricing-tier="${idx}" style="flex:1;min-width:200px;background:${tier.highlighted ? 'linear-gradient(180deg,#eff6ff,#e0f2fe)' : '#fff'};border-radius:12px;padding:20px;border:${tier.highlighted ? '2px solid #2563eb' : '1px solid rgba(37,99,235,.12)'};position:relative">
      ${tier.highlighted ? '<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#2563eb;color:#fff;font-size:11px;font-weight:700;padding:3px 14px;border-radius:99px;white-space:nowrap">⭐ POPULAR</div>' : ''}
      <div data-pricing-name style="font-size:15px;font-weight:700;margin-bottom:4px">${esc(tier.name || '')}</div>
      <div style="margin:10px 0"><span data-pricing-price style="font-size:28px;font-weight:800">${sym}${esc(String(tier.price || ''))}</span><span data-pricing-period style="font-size:12px;color:#64748b">/${tier.period || 'mo'}</span></div>
      <div data-pricing-desc style="font-size:12px;color:#64748b;margin-bottom:12px">${esc(tier.description || '')}</div>
      <table style="width:100%;border-collapse:collapse"><tbody>${features}</tbody></table>
      <div style="margin-top:14px;text-align:center"><span data-pricing-cta style="display:inline-block;background:${tier.highlighted ? 'linear-gradient(135deg,#2563eb,#06b6d4)' : '#eff6ff'};color:${tier.highlighted ? '#fff' : '#1e3a8a'};padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;border:${tier.highlighted ? 'none' : '1px solid rgba(37,99,235,.2)'}">${esc(tier.cta || 'Choose Plan')}</span></div>
    </div>`;
  }).join('');
  return `<div data-nabad-card="pricing" style="background:linear-gradient(180deg,#f7faff 0%,#eef6ff 100%);border-radius:16px;padding:24px;color:#0f172a;margin:8px 0;font-family:inherit;border:1px solid rgba(37,99,235,.14)">
  <div style="text-align:center;margin-bottom:20px">
    <div data-pricing-title style="font-size:20px;font-weight:700">${esc(data.title || 'Pricing Plans')}</div>
    ${data.subtitle ? `<div data-pricing-subtitle style="font-size:13px;color:#64748b;margin-top:4px">${esc(data.subtitle)}</div>` : ''}
  </div>
  <div data-pricing-grid style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">${tierHtml}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;justify-content:center">
    <button data-nabad-action="pricing-edit">Edit table</button>
    <button data-nabad-action="pricing-export-docx">Export Word</button>
    <button data-nabad-action="pricing-export-pdf">Export PDF</button>
    <button data-nabad-action="pricing-export-csv">Export Excel</button>
  </div>
</div>`;
}

// ── Offer Card ────────────────────────────────────────────────────────────────
function isOfferCardRequest(text = '') {
  return /\b(offer card|build (me )?(an? )?offer|create (an? )?offer|design (an? )?offer|make (an? )?offer card|structure (my |the |this |it )?(as )?(a |an )?(full )?offer)\b/i.test(text)
    || /\b(flagship (offer|package|product)|signature (offer|package|service)|premium (offer|package))\b.{0,30}\b(card|build|create|design)\b/i.test(text)
    || /\b(build|create|design|make)\b.{0,30}\b(flagship|signature|premium)\b.{0,30}\b(offer|package|service)\b/i.test(text);
}

async function generateOfferCard(messages = [], location = '', openaiClient, userProfile = '', preferredProvider = 'gemini', allowOpenAI = false) {
  const context = messages.filter(m => m.role === 'user').map(m => getMessageText(m.content)).join('\n');
  const profileContext = userProfile ? `User onboarding profile:\n${userProfile}\n\n` : '';
  const prompt = `${profileContext}You MUST return valid JSON only. No explanation. No markdown wrapping. No code blocks. No backticks. Just the raw JSON object with real values filled in based on the business context below.

Return ONLY this JSON structure:
{
  "offerName": "The Offer Name",
  "tagline": "Compelling one-line value proposition",
  "price": "3500",
  "currency": "USD",
  "period": "one-time",
  "duration": "90 days",
  "targetClient": "Who this is for",
  "transformation": "The main transformation or outcome the client gets",
  "inclusions": ["Deliverable 1", "Deliverable 2", "Deliverable 3", "Deliverable 4", "Deliverable 5"],
  "bonuses": ["Bonus 1", "Bonus 2"],
  "guarantee": "30-day satisfaction guarantee",
  "urgency": "Only 3 spots available this month",
  "tags": ["Tag1", "Tag2", "Tag3"]
}

Business context: ${context.slice(0, 1500)}
Location: ${location || 'not specified'}`;

  const result = await runTaskWithProviderFallback([
    { role: 'system', content: 'You are a JSON generator. Return only valid JSON. No markdown. No explanation. No code blocks. No backticks.' },
    { role: 'user', content: prompt }
  ], openaiClient, preferredProvider, {
    maxTokens: 800,
    temperature: 0.7,
    returnMeta: true,
    allowOpenAI
  });

  const raw = String(result?.text || '').trim();
  const parsed = tryParseJsonBlock(raw);

  if (!parsed || !parsed.offerName) {
    return {
      offerName: '90-Day Brand Transformation',
      tagline: 'From invisible to irresistible — in 90 days',
      price: '3500',
      currency: 'USD',
      period: 'one-time',
      duration: '90 days',
      targetClient: 'Founders and businesses ready to invest in their brand',
      transformation: 'A complete brand identity that attracts premium clients and commands higher prices',
      inclusions: [
        'Brand strategy and positioning document',
        'Full visual identity — logo, colours, typography',
        'Brand messaging and tone of voice guide',
        'Social media templates (12 designs)',
        '60-minute brand review call'
      ],
      bonuses: ['Brand launch checklist', '30-day content calendar'],
      guarantee: '100% satisfaction — revisions until you love it',
      urgency: 'Only 3 spots available this month',
      tags: ['Branding', 'Strategy', 'Premium']
    };
  }
  return parsed;
}

function buildOfferCard(data = {}) {
  const esc = escapeHtml;
  const symbols = { USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SAR: 'SAR ', EGP: 'EGP ' };
  const sym = symbols[data.currency || 'USD'] || '$';
  const inclusions = normalizeList(data.inclusions || []).map(i => `<li style="padding:5px 0;font-size:13px;border-bottom:1px solid rgba(37,99,235,.1)">✅ ${esc(i)}</li>`).join('');
  const bonuses = normalizeList(data.bonuses || []).map(b => `<li style="padding:5px 0;font-size:13px">🎁 ${esc(b)}</li>`).join('');
  const tags = normalizeList(data.tags || []).map(t => `<span style="background:#eff6ff;border:1px solid rgba(37,99,235,.16);padding:3px 10px;border-radius:99px;font-size:11px">${esc(t)}</span>`).join(' ');
  return `<div data-nabad-card="offer" style="background:linear-gradient(180deg,#f7faff 0%,#eef6ff 100%);border-radius:16px;padding:24px;color:#0f172a;margin:8px 0;font-family:inherit;border:1px solid rgba(37,99,235,.14)">
  <div style="text-align:center;margin-bottom:16px">
    ${tags ? `<div style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:5px;justify-content:center">${tags}</div>` : ''}
    <div style="font-size:22px;font-weight:800;line-height:1.2">${esc(data.offerName || 'Your Offer')}</div>
    ${data.tagline ? `<div style="font-size:13px;color:#64748b;margin-top:6px;font-style:italic">${esc(data.tagline)}</div>` : ''}
    ${data.targetClient ? `<div style="font-size:12px;margin-top:6px;padding:4px 12px;background:#eff6ff;border:1px solid rgba(37,99,235,.16);border-radius:99px;display:inline-block">👤 ${esc(data.targetClient)}</div>` : ''}
  </div>
  <div style="background:#fff;border-radius:12px;padding:16px;text-align:center;margin-bottom:16px;border:1px solid rgba(37,99,235,.14)">
    <div style="font-size:40px;font-weight:800;color:#2563eb">${sym}${esc(String(data.price || ''))}</div>
    <div style="font-size:12px;color:#64748b">${esc(data.period || '')}${data.duration ? ` · ${esc(data.duration)}` : ''}</div>
    ${data.transformation ? `<div style="font-size:13px;margin-top:8px;color:#334155">🎯 ${esc(data.transformation)}</div>` : ''}
  </div>
  ${inclusions ? `<div style="margin-bottom:12px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:8px">What's Included</div><ul style="margin:0;padding:0;list-style:none">${inclusions}</ul></div>` : ''}
  ${bonuses ? `<div style="margin-bottom:12px;background:#ecfeff;border:1px solid rgba(6,182,212,.2);border-radius:10px;padding:12px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:6px">Bonuses</div><ul style="margin:0;padding:0;list-style:none">${bonuses}</ul></div>` : ''}
  ${data.guarantee ? `<div style="font-size:12px;color:#64748b;text-align:center;margin-top:8px">🛡️ ${esc(data.guarantee)}</div>` : ''}
  ${data.urgency ? `<div style="margin-top:12px;background:#fff7ed;border:1px solid rgba(249,115,22,.2);border-radius:8px;padding:10px;text-align:center;font-size:12px;font-weight:600;color:#9a3412">⚡ ${esc(data.urgency)}</div>` : ''}
</div>`;
}

// ── Positioning Matrix ────────────────────────────────────────────────────────
function isPositioningMatrixRequest(text = '') {
  return /\b(positioning matrix|competitive matrix|position (me|us|my brand)|compare (me|us) to|vs\b.{0,50}\b(competitor|agency|freelancer|brand)|market position|where do (i|we) sit|differentiat(e|ion) map)\b/i.test(text)
    || /\b(show|create|build|make|generate)\b.{0,30}\b(positioning|competitive|market|matrix)\b/i.test(text);
}
async function generatePositioningMatrix(messages = [], location = '', openaiClient, preferredProvider = 'gemini', allowOpenAI = false) {
  const context = messages.filter(m => m.role === 'user').map(m => getMessageText(m.content)).join('\n');
  const prompt = `Create a positioning matrix JSON for this business:
{
  "title": "Market Positioning Map",
  "xAxis": {"label": "Price", "low": "Low Cost", "high": "Premium"},
  "yAxis": {"label": "Specialization", "low": "Generalist", "high": "Specialist"},
  "entities": [
    {"name": "You", "x": 75, "y": 80, "quadrant": "sweet-spot", "description": "Your position"},
    {"name": "Competitor A", "x": 30, "y": 40, "quadrant": "avoid", "description": "Their position"},
    {"name": "Competitor B", "x": 70, "y": 30, "quadrant": "differentiate", "description": "Their position"},
    {"name": "Competitor C", "x": 25, "y": 75, "quadrant": "niche", "description": "Their position"}
  ],
  "insight": "Strategic insight about your positioning",
  "recommendation": "What to do to strengthen your position"
}
Context: ${context.slice(0, 1500)}`;
  const result = await runTaskWithProviderFallback([
    { role: 'system', content: 'Return only valid JSON. No markdown.' },
    { role: 'user', content: prompt }
  ], openaiClient, preferredProvider, {
    maxTokens: 700,
    temperature: 0.75,
    returnMeta: true,
    allowOpenAI
  });
  return tryParseJsonBlock(String(result?.text || '')) || {};
}
function buildPositioningMatrixCard(data = {}) {
  const esc = escapeHtml;
  const entities = Array.isArray(data.entities) ? data.entities : [];
  const quadrantColors = { 'sweet-spot': '#2ecc71', 'differentiate': '#3498db', 'niche': '#f39c12', 'avoid': '#e74c3c' };
  const quadrantLabels = { 'sweet-spot': 'Sweet Spot', 'differentiate': 'Differentiate', 'niche': 'Niche', 'avoid': 'Crowded' };
  const entityDots = entities.map(e => {
    const color = quadrantColors[e.quadrant] || '#95a5a6';
    const isYou = e.name === 'You';
    return `<div style="position:absolute;left:${e.x}%;top:${100 - e.y}%;transform:translate(-50%,-50%);z-index:2">
      <div style="width:${isYou ? 16 : 12}px;height:${isYou ? 16 : 12}px;border-radius:50%;background:${color};border:${isYou ? '3px solid #fff' : '2px solid rgba(255,255,255,.6)'};box-shadow:0 0 ${isYou ? 10 : 6}px ${color}"></div>
      <div style="position:absolute;top:${isYou ? -22 : -20}px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:${isYou ? 12 : 11}px;font-weight:${isYou ? 700 : 500};color:${color}">${esc(e.name)}</div>
    </div>`;
  }).join('');
  const legendItems = Object.entries(quadrantColors).map(([key, color]) =>
    `<div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:50%;background:${color}"></div><span style="font-size:11px;opacity:.8">${quadrantLabels[key]}</span></div>`
  ).join('');
  return `<div data-nabad-card="matrix" style="background:linear-gradient(180deg,#f7faff 0%,#eef6ff 100%);border-radius:16px;padding:24px;color:#0f172a;margin:8px 0;font-family:inherit;border:1px solid rgba(37,99,235,.14)">
  <div style="text-align:center;margin-bottom:16px"><div style="font-size:18px;font-weight:700">${esc(data.title || 'Positioning Matrix')}</div></div>
  <div style="position:relative;width:100%;padding-top:100%;max-width:320px;margin:0 auto">
    <div style="position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:2px">
      ${['niche', 'sweet-spot', 'avoid', 'differentiate'].map((q) =>
        `<div data-quadrant="${q}" style="background:${quadrantColors[q]}18;border-radius:8px;border:1px solid ${quadrantColors[q]}30"></div>`
      ).join('')}
    </div>
    <div style="position:absolute;inset:0">${entityDots}</div>
    ${data.xAxis ? `<div style="position:absolute;bottom:-20px;left:0;right:0;display:flex;justify-content:space-between;font-size:10px;color:#64748b"><span>${esc(data.xAxis.low||'')}</span><span style="font-weight:600">${esc(data.xAxis.label||'')}</span><span>${esc(data.xAxis.high||'')}</span></div>` : ''}
    ${data.yAxis ? `<div style="position:absolute;top:0;bottom:0;left:-45px;display:flex;flex-direction:column;justify-content:space-between;font-size:10px;color:#64748b;text-align:right;width:40px"><span>${esc(data.yAxis.high||'')}</span><span style="font-weight:600;transform:rotate(-90deg)">${esc(data.yAxis.label||'')}</span><span>${esc(data.yAxis.low||'')}</span></div>` : ''}
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:30px">${legendItems}</div>
  ${data.insight ? `<div style="margin-top:14px;background:#fff;border:1px solid rgba(37,99,235,.12);border-radius:10px;padding:12px"><div style="font-size:11px;color:#64748b;margin-bottom:4px">💡 INSIGHT</div><div style="font-size:13px">${esc(data.insight)}</div></div>` : ''}
  ${data.recommendation ? `<div style="margin-top:10px;background:#eff6ff;border-radius:10px;padding:12px;border-left:3px solid #2563eb"><div style="font-size:11px;color:#64748b;margin-bottom:4px">🎯 RECOMMENDATION</div><div style="font-size:13px">${esc(data.recommendation)}</div></div>` : ''}
</div>`;
}

// ── 30-Day Action Plan ────────────────────────────────────────────────────────
function isActionPlanRequest(text = '') {
  return /\b(30.?day|thirty.?day)\b.{0,30}\b(plan|action|roadmap|strategy)\b/i.test(text)
    || /\b(action plan|roadmap|step.?by.?step plan|weekly plan|monthly plan)\b/i.test(text)
    || /\b(what (should|do) i do (next|first|now)|next steps|where (do i|to) start)\b.{0,30}\b(plan|roadmap|steps)\b/i.test(text);
}
async function generateActionPlan(messages = [], location = '', openaiClient, preferredProvider = 'gemini', allowOpenAI = false) {
  const context = messages.filter(m => m.role === 'user').map(m => getMessageText(m.content)).join('\n');
  const prompt = `Create a 30-day action plan JSON for this business goal:
{
  "title": "30-Day Action Plan",
  "goal": "The main goal to achieve",
  "weeks": [
    {"weekNumber": 1, "theme": "Week theme/focus", "icon": "🎯", "actions": [
      {"day": "Day 1-2", "action": "Specific action", "priority": "high"},
      {"day": "Day 3-4", "action": "Specific action", "priority": "medium"},
      {"day": "Day 5-7", "action": "Specific action", "priority": "high"}
    ]},
    {"weekNumber": 2, "theme": "Week 2 theme", "icon": "📈", "actions": [
      {"day": "Day 8-9", "action": "Specific action", "priority": "high"},
      {"day": "Day 10-11", "action": "Specific action", "priority": "medium"},
      {"day": "Day 12-14", "action": "Specific action", "priority": "high"}
    ]},
    {"weekNumber": 3, "theme": "Week 3 theme", "icon": "🚀", "actions": [
      {"day": "Day 15-17", "action": "Specific action", "priority": "high"},
      {"day": "Day 18-19", "action": "Specific action", "priority": "medium"},
      {"day": "Day 20-21", "action": "Specific action", "priority": "high"}
    ]},
    {"weekNumber": 4, "theme": "Week 4 theme", "icon": "🏆", "actions": [
      {"day": "Day 22-24", "action": "Specific action", "priority": "high"},
      {"day": "Day 25-27", "action": "Specific action", "priority": "medium"},
      {"day": "Day 28-30", "action": "Specific action", "priority": "high"}
    ]}
  ],
  "successMetric": "How to measure success at day 30",
  "keyResources": ["Resource 1", "Resource 2"]
}
Context: ${context.slice(0, 1500)}. Location: ${location || 'not specified'}.`;
  const result = await runTaskWithProviderFallback([
    { role: 'system', content: 'Return only valid JSON. No markdown.' },
    { role: 'user', content: prompt }
  ], openaiClient, preferredProvider, {
    maxTokens: 900,
    temperature: 0.75,
    returnMeta: true,
    allowOpenAI
  });
  return tryParseJsonBlock(String(result?.text || '')) || {};
}
function buildActionPlanCard(data = {}) {
  const esc = escapeHtml;
  const weeks = Array.isArray(data.weeks) ? data.weeks : [];
  const weekColors = ['#6c5ce7', '#00b894', '#e17055', '#fdcb6e'];
  const weekHtml = weeks.map((week, i) => {
    const color = weekColors[i % weekColors.length];
    const actions = Array.isArray(week.actions) ? week.actions.map(a =>
      `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid rgba(37,99,235,.1);align-items:flex-start">
        <span style="background:${a.priority === 'high' ? 'rgba(249,115,22,.16)' : 'rgba(37,99,235,.08)'};color:${a.priority === 'high' ? '#9a3412' : '#475569'};font-size:10px;padding:2px 6px;border-radius:4px;white-space:nowrap;margin-top:2px">${esc(a.day || '')}</span>
        <span style="font-size:13px;line-height:1.4">${esc(a.action || '')}</span>
      </div>`
    ).join('') : '';
    return `<div style="background:#fff;border:1px solid rgba(37,99,235,.12);border-radius:12px;padding:14px;border-left:3px solid ${color}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:20px">${esc(week.icon || '📅')}</span>
        <div><div style="font-size:11px;color:#64748b">WEEK ${week.weekNumber}</div><div style="font-size:14px;font-weight:600;color:${color}">${esc(week.theme || '')}</div></div>
      </div>
      ${actions}
    </div>`;
  }).join('');
  return `<div data-nabad-card="action-plan" style="background:linear-gradient(180deg,#f7faff 0%,#eef6ff 100%);border-radius:16px;padding:24px;color:#0f172a;margin:8px 0;font-family:inherit;border:1px solid rgba(37,99,235,.14)">
  <div style="text-align:center;margin-bottom:20px">
    <div style="font-size:20px;font-weight:700">${esc(data.title || '30-Day Action Plan')}</div>
    ${data.goal ? `<div style="font-size:13px;color:#64748b;margin-top:6px">🎯 Goal: ${esc(data.goal)}</div>` : ''}
  </div>
  <div style="display:flex;flex-direction:column;gap:10px">${weekHtml}</div>
  ${data.successMetric ? `<div style="margin-top:16px;background:#ecfeff;border-radius:10px;padding:12px;border:1px solid rgba(6,182,212,.2)"><div style="font-size:11px;color:#64748b;margin-bottom:4px">🏆 SUCCESS METRIC</div><div style="font-size:13px">${esc(data.successMetric)}</div></div>` : ''}
</div>`;
}

// ── HTML reply enforcer ───────────────────────────────────────────────────────
function ensureHtmlReply(text = '') {
  const raw = String(text || '')
    .replace(/^\s*data-nabad-[^\n]*$/gmi, '')
    .replace(/onerror="[^"]*"/gi, '')
    .trim();
  if (!raw) return '<p>I hit a snag. Try rephrasing your question.</p>';
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
  return '<p>' + raw.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
}
function repairTruncatedReply(text = '') {
  let out = String(text || '').trim();
  if (!out) return out;
  const plain = out.replace(/<[^>]+>/g, '').trim();
  if (/[,:;\-–—]\s*$/.test(plain)) out += ' …';
  return out;
}

function limitEmojiUsage(text = '', maxEmojis = 2) {
  if (!text || maxEmojis < 0) return String(text || '');
  let seen = 0;
  return String(text).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, (m) => {
    seen += 1;
    return seen <= maxEmojis ? m : '';
  });
}

function truncateWords(text = '', maxWords = 140) {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  const words = raw.split(/\s+/);
  if (words.length <= maxWords) return raw;
  const clipped = words.slice(0, maxWords).join(' ').trim();
  const lastPunct = Math.max(clipped.lastIndexOf('.'), clipped.lastIndexOf('!'), clipped.lastIndexOf('?'));
  if (lastPunct > Math.floor(clipped.length * 0.55)) {
    return clipped.slice(0, lastPunct + 1).trim();
  }
  return `${clipped.replace(/[,:;\-–—]+$/, '').trim()}.`;
}

function truncateBySentences(text = '', maxSentences = 4) {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  const sentences = raw.match(/[^.!?]+[.!?]?/g) || [raw];
  const clipped = sentences
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, Math.max(1, maxSentences))
    .join(' ')
    .trim();
  return clipped.replace(/\s+(?=[.,!?])/g, '');
}

function isDetailedReplyRequest(userMessage = '') {
  const t = cleanText(userMessage, 600).toLowerCase();
  if (!t) return false;
  return /\b(detailed|in detail|full plan|step by step|roadmap|framework|deep dive|comprehensive|full strategy|break it down)\b/.test(t);
}

function enforcePersonalityVoice(text = '', personalityId = 'auto', userMessage = '') {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  const normalized = /<[a-z][\s\S]*>/i.test(raw)
    ? raw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    : raw;
  const detailed = isDetailedReplyRequest(userMessage);
  const shortUserPrompt = cleanText(userMessage, 300).split(/\s+/).filter(Boolean).length <= 12;

  const styleByPersonality = {
    strategist: { maxWords: 420, maxEmojis: 2 },
    growth: { maxWords: 420, maxEmojis: 2 },
    branding: { maxWords: 420, maxEmojis: 2 },
    offer: { maxWords: 420, maxEmojis: 2 },
    creative: { maxWords: 380, maxEmojis: 2 },
    straight_talk: { maxWords: 220, maxEmojis: 1 },
    auto: { maxWords: 420, maxEmojis: 2 }
  };
  const base = styleByPersonality[personalityId] || styleByPersonality.auto;
  let maxWords = base.maxWords + (detailed ? 80 : 0) - (shortUserPrompt && !detailed ? 0 : 0);
  if (maxWords < 28) maxWords = 28;

  let out = limitEmojiUsage(normalized, base.maxEmojis);
  out = truncateWords(out, maxWords);
  out = out
    .replace(/\s+([.!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (personalityId === 'creative' || personalityId === 'straight_talk') {
    out = out.replace(/^[\s>*-]+/gm, '');
    out = out.replace(/^\s*(?:[-*•]|\d+\.)\s+/gm, '');
  }
  return out.trim();
}

// ── YES-intent router helper ──────────────────────────────────────────────────
const YES_PATTERN = /^(yes|yeah|sure|go ahead|do it|ok|okay|yep|please|yea|sounds good|let's go|let's do it|do that|go for it)[\s!.]*$/i;

function getLastOffer(msgs = []) {
  const assistantMsgs = msgs
    .filter(m => m.role === 'assistant')
    .map(m => getMessageText(m.content).toLowerCase());
  const last = assistantMsgs[assistantMsgs.length - 1] || '';
  if (/offer card|structure (this|it|your offer|the offer) as (a |an )?(full )?offer|present it.{0,30}offer card/i.test(last)) return 'offer';
  if (/business snapshot/i.test(last)) return 'snapshot';
  if (/30.?day action plan|action plan/i.test(last)) return 'action-plan';
  if (/nabad score|score (this|your|the) idea/i.test(last)) return 'score';
  if (/pricing table/i.test(last)) return 'pricing';
  if (/positioning matrix/i.test(last)) return 'matrix';
  if (/use premium|ideogram|sharper result|want a sharper/i.test(last)) return 'premium-image';
  return null;
}

function upgradeCardRecentlyShown(messages = [], lookback = 4) {
  return messages.slice(-lookback).some(m =>
    m.role === 'assistant' &&
    /use premium.*ideogram|want a sharper result|ideogram 2\.0/i.test(getMessageText(m.content))
  );
}

async function runTaskWithProviderFallback(taskMessages = [], openaiClient = null, preferredProvider = 'openai', opts = {}) {
  const messages = Array.isArray(taskMessages) ? taskMessages : [];
  const temperature = Number.isFinite(Number(opts?.temperature)) ? Number(opts.temperature) : 0;
  const maxTokens = Number.isFinite(Number(opts?.maxTokens)) ? Number(opts.maxTokens) : 180;
  const returnMeta = opts?.returnMeta === true;
  const allowOpenAI = opts?.allowOpenAI !== false;
  const normalized = cleanText(preferredProvider || 'openai', 24).toLowerCase();
  const order = normalized === 'gemini'
    ? ['gemini', 'groq', 'openai']
    : normalized === 'groq'
      ? ['groq', 'gemini', 'openai']
      : ['openai', 'gemini', 'groq'];

  let lastErr = null;
  for (const provider of order) {
    try {
      if (provider === 'openai') {
        if (!allowOpenAI) continue;
        if (!openaiClient) continue;
        const completion = await openaiClient.chat.completions.create({
          model: 'gpt-4o',
          temperature,
          max_tokens: maxTokens,
          messages
        });
        const text = String(completion?.choices?.[0]?.message?.content || '').trim();
        if (text) return returnMeta ? { text, provider: 'openai' } : text;
        throw new Error('No text returned from OpenAI');
      }
      if (provider === 'gemini') {
        if (!process.env.GEMINI_API_KEY) continue;
        const text = await generateWithGeminiText(messages, { temperature, maxTokens });
        if (text) return returnMeta ? { text, provider: 'gemini' } : text;
        throw new Error('No text returned from Gemini');
      }
      if (provider === 'groq') {
        if (!process.env.GROQ_API_KEY) continue;
        const text = await generateWithGroqText(messages, { temperature, maxTokens });
        if (text) return returnMeta ? { text, provider: 'groq' } : text;
        throw new Error('No text returned from Groq');
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('No provider available for task');
}

async function withSoftTimeout(taskPromise, ms = 1200, fallbackValue = null) {
  let timer = null;
  try {
    return await Promise.race([
      taskPromise,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(fallbackValue), Math.max(200, Number(ms) || 1200));
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function quickClassifyPersonality(userMessage = '', currentPersonality = 'auto') {
  const t = cleanText(userMessage, 500).toLowerCase();
  if (!t) return { id: 'auto', confidence: 0.35, reason: 'quick-empty' };
  if (/\b(price|pricing|package|offer|subscription|tier|monetiz)\b/.test(t)) {
    return { id: 'offer', confidence: 0.78, reason: 'quick-offer' };
  }
  if (/\b(logo|brand|naming|identity|positioning statement|tagline)\b/.test(t)) {
    return { id: 'branding', confidence: 0.78, reason: 'quick-branding' };
  }
  if (/\b(growth|lead|conversion|traffic|funnel|campaign|ads|retention)\b/.test(t)) {
    return { id: 'growth', confidence: 0.76, reason: 'quick-growth' };
  }
  if (/\b(strategy|roadmap|market|pivot|moat|competition|plan)\b/.test(t)) {
    return { id: 'strategist', confidence: 0.74, reason: 'quick-strategy' };
  }
  if (/\b(blunt|brutal|straight|reality check|be direct)\b/.test(t)) {
    return { id: 'straight_talk', confidence: 0.82, reason: 'quick-straight' };
  }
  if (/\b(creative|concept|crazy idea|visual direction|brainstorm)\b/.test(t)) {
    return { id: 'creative', confidence: 0.72, reason: 'quick-creative' };
  }
  return { id: currentPersonality === 'auto' ? 'auto' : currentPersonality, confidence: 0.42, reason: 'quick-fallback' };
}

async function detectMeaningfulInfo(userMessage, openai, preferredProvider = 'openai', debugTrace = null, allowOpenAI = false) {
  const lite = detectMeaningfulInfoLite(userMessage);
  const mergeDetected = (primary = {}, fallback = {}) => {
    const out = {};
    [fallback, primary].forEach((src) => {
      if (!src || typeof src !== 'object') return;
      Object.entries(src).forEach(([k, v]) => {
        if (typeof v !== 'string') return;
        const cleaned = cleanText(v, 240);
        if (!cleaned) return;
        out[k] = cleaned;
      });
    });
    return out;
  };

  try {
    // Step 1 — quick yes/no check
    const checkMessages = [
      {
        role: 'system',
        content: `You are a classifier. Reply only "yes" or "no". Does this message contain ANY of the following about the user: their name, business name, location, city, country, what they sell, revenue, income, challenge, problem, skill, idea, industry, team size, pricing, or anything personal about their work or life situation? Be generous — if in doubt say "yes". Message: "${userMessage}"`
      }
    ];
    const checkResult = await runTaskWithProviderFallback(checkMessages, openai, preferredProvider, {
      temperature: 0,
      maxTokens: 8,
      returnMeta: true,
      allowOpenAI
    });
    const answer = String(checkResult?.text || '').trim().toLowerCase();
    const providersUsed = [];
    if (checkResult?.provider) providersUsed.push(checkResult.provider);
    console.log('[NABAD DEBUG] Step1 answer:', answer);
    const looksYes = /^y(es)?\b/.test(answer) || /\byes\b/.test(answer);
    if (!looksYes) {
      if (debugTrace && typeof debugTrace === 'object') {
        debugTrace.detectMeaningfulInfo = checkResult?.provider || preferredProvider;
      }
      return Object.keys(lite).length ? lite : null;
    }

    // Step 2 — extract the actual data
    const extractMessages = [
        {
          role: 'system',
          content: `You are a smart data extractor. Extract any personal or business information from the user message into a JSON object.

Rules:
- "I live in X" or "I'm in X" or "I'm based in X" = location
- "I run X" or "I have X business" = businessName
- "I sell X" or "I offer X" = whatYouSell
- "I make X per month" or "revenue is X" = revenue
- "I'm good at X" or "my skill is X" = skills
- "my problem is X" or "I struggle with X" = biggestChallenge
- "I want to start X" or "my idea is X" = ideaSummary
- Be GENEROUS — extract anything meaningful even if phrased casually

Available fields: businessName, location, whatYouSell, revenue, biggestChallenge, targetCustomer, ideaSummary, currentProgress, biggestBlock, skills, industry, preference, timeCommitment

Return ONLY a JSON object. If truly nothing found return {}.`
        },
        {
          role: 'user',
          content: userMessage
        }
      ];
    const extractResult = await runTaskWithProviderFallback(extractMessages, openai, preferredProvider, {
      temperature: 0,
      maxTokens: 300,
      returnMeta: true,
      allowOpenAI
    });
    const raw = String(extractResult?.text || '{}');
    if (extractResult?.provider) providersUsed.push(extractResult.provider);
    if (debugTrace && typeof debugTrace === 'object') {
      const uniq = Array.from(new Set(providersUsed.filter(Boolean)));
      debugTrace.detectMeaningfulInfo = uniq.join('->') || preferredProvider;
    }
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return Object.keys(lite).length ? lite : null;

    const parsed = JSON.parse(match[0]);
    console.log('[NABAD DEBUG] Step2 parsed:', JSON.stringify(parsed));
    const merged = mergeDetected(parsed, lite);
    if (!merged || Object.keys(merged).length === 0) return null;
    return merged;

  } catch (err) {
    console.error('[NABAD] detectMeaningfulInfo error:', err?.message);
    console.error('[NABAD] detectMeaningfulInfo full error:', JSON.stringify(err));
    return Object.keys(lite).length ? lite : null;
  }
}

function detectMeaningfulInfoLite(userMessage = '') {
  const text = cleanText(userMessage || '', 1200);
  const t = text.toLowerCase();
  if (!t) return {};

  const out = {};
  const set = (key, value, max = 240) => {
    const cleaned = cleanText(value || '', max);
    if (!cleaned) return;
    out[key] = cleaned;
  };

  const short = t.length <= 36;
  const directCountry = detectCountryFromContext(t);
  if (directCountry && short) set('location', directCountry, 80);

  const locMatch = text.match(/\b(?:i(?:\s*am|'m)?\s*(?:in|from)|we(?:'re| are)?\s*(?:in|from)|based in|located in)\s+([a-zA-Z][a-zA-Z\s\-]{1,60})\b/i);
  if (locMatch) set('location', locMatch[1], 80);

  const nameMatch = text.match(/\b(?:name(?:\s+is|\s*s)?|called)\s+([a-zA-Z0-9][a-zA-Z0-9\s\-_]{1,70})\b/i);
  if (nameMatch) set('businessName', nameMatch[1], 100);

  const sellMatch = text.match(/\b(?:i|we)\s+(?:sell|offer|provide)\s+([^.,\n]{2,120})/i);
  if (sellMatch) set('whatYouSell', sellMatch[1], 160);

  const revenueMatch = text.match(/\b(?:revenue|income|make|making)\s*(?:is|around|about|=)?\s*([$€£]?\s?\d[\d,.\skKmM]*)/i);
  if (revenueMatch) set('revenue', revenueMatch[1], 80);

  const challengeMatch = text.match(/\b(?:challenge|problem|struggle|stuck(?: with)?|biggest block(?:er)?)\s*(?:is|:)?\s*([^.\n]{3,140})/i);
  if (challengeMatch) set('biggestChallenge', challengeMatch[1], 180);

  const ideaMatch = text.match(/\b(?:idea|startup idea|business idea)\s*(?:is|:)?\s*([^.\n]{3,180})/i);
  if (ideaMatch) set('ideaSummary', ideaMatch[1], 200);

  const skillMatch = text.match(/\b(?:i(?:'m| am)?\s+good at|my skill(?:s)?(?:\s+is|\s+are)?|i can)\s+([^.\n]{2,120})/i);
  if (skillMatch) set('skills', skillMatch[1], 140);

  return out;
}

async function detectWarRoom(userMessage, recentMessages, userProfile, openai, preferredProvider = 'gemini', debugTrace = null, allowOpenAI = false) {
  const quick = cleanText(userMessage || '', 400).toLowerCase();
  const likelyWarRoom =
    /\b(should i|x or y|option a|option b|which one|tradeoff|dilemma|high[-\s]?stakes|big decision|shut down|co-founder conflict|fire someone|invest|funding decision|multiple perspectives|debate)\b/.test(quick);
  if (!likelyWarRoom) {
    if (debugTrace && typeof debugTrace === 'object') debugTrace.warRoom = 'skipped';
    return false;
  }

  try {
    const context = recentMessages.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n');
    const checkResult = await runTaskWithProviderFallback([
      {
        role: 'system',
        content: `You are a classifier. Reply only "yes" or "no".

Should this message trigger a War Room (multi-perspective debate)?

ONLY say "yes" if the user is CLEARLY:
- Weighing two specific options against each other ("should I do X or Y")
- Facing a major irreversible decision (shutting down, big investment, co-founder conflict, firing someone)
- Explicitly asking for multiple perspectives or opinions
- Describing a serious dilemma with real stakes and consequences

Say "no" for:
- General business questions or advice requests
- Marketing, growth, branding, or offer questions
- Casual messages or greetings
- Any message that is just asking for help or ideas
- Personality trigger messages like "how do I get more clients"

Be STRICT. Default to "no" unless it is unmistakably a high-stakes decision with two sides.

User message: "${userMessage}"`
      }
    ], openai, preferredProvider, {
      temperature: 0,
      maxTokens: 8,
      returnMeta: true,
      allowOpenAI
    });
    if (debugTrace && typeof debugTrace === 'object') {
      debugTrace.warRoom = checkResult?.provider || preferredProvider;
    }
    const answer = String(checkResult?.text || '').trim().toLowerCase();
    return answer === 'yes';
  } catch {
    if (debugTrace && typeof debugTrace === 'object') {
      debugTrace.warRoom = 'failed';
    }
    return false;
  }
}

// ── Personality Classifier ────────────────────────────────────────────────────
async function classifyPersonality(userMessage = '', currentPersonality = 'auto', recentMessages = [], openaiClient, preferredProvider = 'openai', debugTrace = null, allowOpenAI = false) {
  const fallback = { id: 'auto', confidence: 0.35, reason: 'fallback' };
  try {
    const recent = recentMessages
      .filter(m => m?.role === 'user')
      .slice(-2)
      .map(m => cleanText(getMessageText(m.content), 220))
      .filter(Boolean)
      .join(' || ');

    const taskMessages = [
      {
        role: 'system',
        content: `Classify the user's intent for personality routing.
Return ONLY strict JSON:
{"personality":"strategist|growth|branding|offer|creative|straight_talk|auto","confidence":0.0-1.0,"reason":"short"}

Rules:
- Use "auto" when mixed, vague, emotional, greeting, or not strong enough.
- Do NOT switch on one keyword alone.
- Confidence must represent switching confidence, not topic confidence.
- Set confidence >= 0.85 only if intent is explicit and specific.
- If uncertain, choose auto with <= 0.45 confidence.

Personality definitions:
- strategist: strategy, positioning, market choices, pivots, long-term decisions
- growth: leads, marketing, sales pipeline, conversion, traction
- branding: brand identity, naming, messaging, perception
- offer: pricing, packaging, value proposition, monetization mechanics
- creative: unconventional concepts, novel campaign/product angles
- straight_talk: direct reality-check asked by user, strong frustration requiring blunt mode

Current mode: ${currentPersonality}
Recent user context: "${recent || 'none'}"
Current user message: "${cleanText(userMessage, 500)}"`
      }
    ];
    const classifyResult = await runTaskWithProviderFallback(taskMessages, openaiClient, preferredProvider, {
      temperature: 0,
      maxTokens: 80,
      returnMeta: true,
      allowOpenAI
    });
    const raw = String(classifyResult?.text || '');
    if (debugTrace && typeof debugTrace === 'object') {
      debugTrace.classifyPersonality = classifyResult?.provider || preferredProvider;
    }
    const parsed = tryParseJsonBlock(raw) || {};
    const valid = ['strategist', 'growth', 'branding', 'offer', 'creative', 'straight_talk', 'auto'];
    const id = valid.includes(parsed.personality) ? parsed.personality : 'auto';
    let confidence = Number(parsed.confidence);
    if (!Number.isFinite(confidence)) confidence = id === 'auto' ? 0.35 : 0.55;
    confidence = Math.max(0, Math.min(1, confidence));
    const reason = cleanText(parsed.reason || 'model', 60) || 'model';

    const msg = cleanText(userMessage, 220).toLowerCase();
    const shortMessage = msg.split(/\s+/).filter(Boolean).length <= 4;
    const emotional = /\b(stuck|lost|confused|overwhelmed|scared|worried|anxious|frustrated|tired|burnout|hopeless)\b/i.test(msg);
    if (shortMessage && id !== 'auto') confidence = Math.min(confidence, 0.52);
    if (emotional && id !== 'straight_talk') confidence = Math.min(confidence, 0.42);

    return { id, confidence, reason };
  } catch {
    return fallback;
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Invalid JSON body' }); }

  const memoryKey = normalizeMemoryKey(body?.memoryKey || '');
  const storedFounderMemory = await loadFounderMemory(memoryKey);
  const claimEmail = cleanText(body?.claimEmail || '', 180).toLowerCase();
  const claimName = cleanText(body?.claimName || '', 120);
  const restoreEmail = cleanText(body?.restoreEmail || '', 180).toLowerCase();
  const restoreCode = normalizeRecoveryCode(body?.restoreCode || '');
  const memoryAction = cleanText(body?.memoryAction || '', 32).toLowerCase();
  const memoryField = cleanText(body?.memoryField || '', 80);
  const memoryValue = cleanText(body?.memoryValue || '', 260);
  const memoryInsightId = cleanText(body?.memoryInsightId || '', 40);
  const memoryInsightText = cleanText(body?.memoryInsightText || '', 420);
  const memoryInsightIndex = Number.isFinite(Number(body?.memoryInsightIndex)) ? Number(body.memoryInsightIndex) : -1;
  const saveInsight = body?.saveInsight === true;
  const insightText = cleanText(body?.insightText || '', 2000);
  const replyTo = body?.replyTo && typeof body.replyTo === 'object'
    ? {
        id: cleanText(body.replyTo.id || '', 60),
        role: body.replyTo.role === 'assistant' ? 'assistant' : 'user',
        snippet: cleanText(body.replyTo.snippet || '', 240)
      }
    : null;
  const imageProvider = cleanText(body?.imageProvider || '', 24).toLowerCase();
  const liveResearchModeRaw = cleanText(body?.liveResearchMode || 'auto', 24).toLowerCase();
  const liveResearchMode = liveResearchModeRaw === 'on_demand' ? 'on_demand' : 'auto';
  const allowOpenAIFallback = body?.allowOpenAIFallback === true || cleanText(process.env.NABAD_ALLOW_OPENAI_FALLBACK || 'false', 6).toLowerCase() === 'true';
  const attachment = body?.attachment && typeof body.attachment === 'object' ? body.attachment : null;
  const providerTrace = {
    mainText: '',
    detectMeaningfulInfo: '',
    classifyPersonality: '',
    warRoom: '',
    pricingTable: '',
    scoreCard: '',
    offerCard: '',
    positioningMatrix: '',
    actionPlan: '',
    imagePrompt: '',
    imageGeneration: ''
  };

  if (memoryAction) {
    if (!memoryKey) return res.status(400).json({ error: 'Missing memoryKey.' });
    const profileText = cleanText(body?.userProfile || '', 700);
    const baseMemory = mergeFounderMemory(storedFounderMemory || {}, {
      userProfile: profileText,
      conversationText: ''
    });

    if (memoryAction === 'get') {
      return res.status(200).json({ ok: true, memory: storedFounderMemory || baseMemory });
    }

    if (memoryAction === 'update_field') {
      const field = normalizeMemoryField(memoryField);
      const value = cleanText(memoryValue, 240);
      if (!field || !value) return res.status(400).json({ error: 'Field and value are required.' });
      const { memory, changed, reply } = applyMemoryCommand(storedFounderMemory || {}, { type: 'set_field', field, value }, profileText);
      if (changed) await saveFounderMemory(memoryKey, memory);
      return res.status(200).json({ ok: true, changed, reply, memory });
    }

    if (memoryAction === 'delete_field') {
      const field = normalizeMemoryField(memoryField);
      if (!field) return res.status(400).json({ error: 'Field is required.' });
      const { memory, changed, reply } = applyMemoryCommand(storedFounderMemory || {}, { type: 'delete_field', field }, profileText);
      if (changed) await saveFounderMemory(memoryKey, memory);
      return res.status(200).json({ ok: true, changed, reply, memory });
    }

    if (memoryAction === 'add_insight') {
      if (!memoryInsightText) return res.status(400).json({ error: 'Insight text is required.' });
      if (!Array.isArray(baseMemory.savedInsights)) baseMemory.savedInsights = [];
      baseMemory.savedInsights.push({
        id: makeMemoryItemId(),
        text: memoryInsightText,
        savedAt: new Date().toISOString(),
        source: 'manual-ui'
      });
      baseMemory.savedInsights = baseMemory.savedInsights.slice(-180);
      await saveFounderMemory(memoryKey, baseMemory);
      return res.status(200).json({ ok: true, changed: true, memory: baseMemory });
    }

    if (memoryAction === 'delete_insight') {
      if (!Array.isArray(baseMemory.savedInsights) || !baseMemory.savedInsights.length) {
        return res.status(200).json({ ok: true, changed: false, memory: baseMemory });
      }
      const before = baseMemory.savedInsights.length;
      if (memoryInsightId) {
        baseMemory.savedInsights = baseMemory.savedInsights.filter((it) => cleanText(it?.id || '', 40) !== memoryInsightId);
      } else if (memoryInsightIndex >= 0) {
        baseMemory.savedInsights = baseMemory.savedInsights.filter((_, idx) => idx !== memoryInsightIndex);
      } else {
        return res.status(400).json({ error: 'Provide memoryInsightId or memoryInsightIndex.' });
      }
      if (!baseMemory.savedInsights.length) delete baseMemory.savedInsights;
      const changed = before !== (baseMemory.savedInsights?.length || 0);
      if (changed) await saveFounderMemory(memoryKey, baseMemory);
      return res.status(200).json({ ok: true, changed, memory: baseMemory });
    }

    return res.status(400).json({ error: 'Unsupported memory action.' });
  }

  if (saveInsight) {
    if (!memoryKey) return res.status(400).json({ error: 'Missing memoryKey for saving insight.' });
    if (!insightText) return res.status(400).json({ error: 'Insight text is empty.' });
    const merged = mergeFounderMemory(storedFounderMemory || {}, {
      userProfile: cleanText(body?.userProfile || '', 700),
      conversationText: ''
    });
    if (!Array.isArray(merged.savedInsights)) merged.savedInsights = [];
    merged.savedInsights.push({
      id: makeMemoryItemId(),
      text: insightText,
      savedAt: new Date().toISOString(),
      source: 'assistant-like-button'
    });
    merged.savedInsights = merged.savedInsights.slice(-120);
    await saveFounderMemory(memoryKey, merged);
    return res.status(200).json({ ok: true, saved: true });
  }

  if (claimEmail || claimName) {
    if (!memoryKey) return res.status(400).json({ error: 'Missing memoryKey for account claim.' });
    if (!claimEmail) return res.status(400).json({ error: 'Email is required to claim account.' });
    if (!isValidEmail(claimEmail)) return res.status(400).json({ error: 'Please provide a valid email address.' });
    const recoveryCode = generateRecoveryCode();

    const merged = mergeFounderMemory(storedFounderMemory || {}, {
      userProfile: cleanText(body?.userProfile || '', 700),
      conversationText: ''
    });
    merged.account = {
      ...(storedFounderMemory?.account && typeof storedFounderMemory.account === 'object'
        ? storedFounderMemory.account
        : {}),
      email: claimEmail,
      name: claimName || (storedFounderMemory?.account?.name || ''),
      recoveryCodeHash: recoveryCodeHash(recoveryCode),
      claimedAt: new Date().toISOString()
    };

    await saveFounderMemory(memoryKey, merged);
    return res.status(200).json({
      ok: true,
      claimed: true,
      recoveryCode,
      reply: `Account claimed as ${claimEmail}.`
    });
  }

  if (restoreEmail || restoreCode) {
    if (!restoreEmail || !restoreCode) {
      return res.status(400).json({ error: 'Email and recovery code are required for restore.' });
    }
    if (!isValidEmail(restoreEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (!supabase) {
      return res.status(500).json({ error: 'Memory storage is not configured yet.' });
    }

    try {
      const { data, error } = await supabase
        .from(FOUNDER_MEMORY_TABLE)
        .select('memory_key,memory,updated_at')
        .order('updated_at', { ascending: false })
        .limit(250);

      if (error) {
        console.error('[MEMORY RESTORE ERROR]', error.message);
        return res.status(500).json({ error: 'Could not restore memory right now.' });
      }

      const expectedHash = recoveryCodeHash(restoreCode);
      const match = (data || []).find((row) => {
        const rowEmail = String(row?.memory?.account?.email || '').toLowerCase();
        if (rowEmail !== restoreEmail) return false;
        const hash = row?.memory?.account?.recoveryCodeHash || '';
        return hash && hash === expectedHash;
      });

      if (!match) {
        return res.status(401).json({ error: 'Invalid email or recovery code.' });
      }

      return res.status(200).json({
        ok: true,
        restored: true,
        memoryKey: match.memory_key,
        memory: match.memory || {},
        account: {
          email: restoreEmail,
          name: cleanText(match?.memory?.account?.name || '', 100)
        }
      });
    } catch (err) {
      console.error('[MEMORY RESTORE ERROR]', err?.message);
      return res.status(500).json({ error: 'Could not restore memory right now.' });
    }
  }

  const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
  const messages = rawMessages.slice(-50).map(m => ({
    role: ['user', 'assistant', 'system'].includes(m.role) ? m.role : 'user',
    content: typeof m.content === 'string' ? m.content.slice(0, 4000) : m.content
  }));
  let parsedAttachment = null;
  try {
    parsedAttachment = await parseAttachmentPayload(attachment);
  } catch (attachmentErr) {
    console.error('[ATTACHMENT PARSE ERROR]', attachmentErr?.message);
    parsedAttachment = null;
  }

  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
  let lastUserMessage = cleanText(lastUserMsg ? getMessageText(lastUserMsg.content) : '', 1200);
  if (!lastUserMessage && parsedAttachment?.summaryText) {
    lastUserMessage = cleanText(parsedAttachment.summaryText, 1200);
  }
  if (!lastUserMessage && parsedAttachment) {
    lastUserMessage = cleanText(`Please analyze this attached ${parsedAttachment.kind || 'file'}.`, 1200);
  }
  if (!lastUserMessage) return res.status(400).json({ error: 'Empty message' });
  if (parsedAttachment?.summaryText) {
    lastUserMessage = cleanText(`${lastUserMessage}\n${parsedAttachment.summaryText}`, 1700);
  }
  const userLanguage = detectPrimaryLanguage(lastUserMessage);

  const isEmotional = /\b(stuck|lost|confused|don't know|dont know|overwhelmed|scared|worried|anxious|frustrated|tired|burnout|give up|hopeless|stressed)\b/i.test(lastUserMessage);
  const selectedPersonality = ['strategist', 'growth', 'branding', 'offer', 'creative', 'straight_talk', 'auto'].includes(body?.personality)
    ? body.personality : 'auto';

  const incomingUserProfile = cleanText(body?.userProfile || '', 500);
  const storedProfile = memoryToProfileString(storedFounderMemory || {});
  const userProfile = cleanText([incomingUserProfile, storedProfile].filter(Boolean).join(' | '), 950);

  const detectedLocation =
    extractLocationFromMessages(messages) ||
    storedFounderMemory?.country ||
    storedFounderMemory?.location ||
    '';
  const profileHasLocation = userProfile
    ? /\b(in|from|based in|located in|city|country)\b/i.test(userProfile)
    : false;
  const fullConversationText = `${messages.map(m => getMessageText(m.content)).join(' ')} ${lastUserMessage} ${parsedAttachment?.summaryText || ''}`;

  const baseLearningSignals = inferLearningSignals(lastUserMessage, null, userLanguage);
  const persistFounderMemory = async (detectedInfo = null, learningSignals = null) => {
    if (!memoryKey) return;
    const merged = mergeFounderMemory(storedFounderMemory || {}, {
      userProfile: incomingUserProfile,
      detectedInfo,
      learnSignals: learningSignals || baseLearningSignals,
      conversationText: fullConversationText
    });
    await saveFounderMemory(memoryKey, merged);
  };
  const respond = async (payload, { persist = true, detectedInfo = null, learningSignals = null } = {}) => {
    if (persist) {
      try {
        await persistFounderMemory(detectedInfo, learningSignals);
      } catch (persistErr) {
        console.error('[MEMORY PERSIST ERROR]', persistErr?.message);
      }
    }
    return res.status(200).json(payload);
  };

  // ── Manual memory commands from chat ──
  const memoryCommand = parseMemoryCommand(lastUserMessage, replyTo);
  if (memoryCommand) {
    if (!memoryKey) {
      return res.status(200).json({
        reply: '<p>I can do that, but memory is not initialized on this device yet.</p>',
        detectedPersonality: 'auto'
      });
    }
    const { memory: patchedMemory, changed, reply } = applyMemoryCommand(storedFounderMemory || {}, memoryCommand, incomingUserProfile);
    if (changed) {
      await saveFounderMemory(memoryKey, patchedMemory);
    }
    return res.status(200).json({
      reply,
      detectedPersonality: 'auto',
      memoryAction: {
        type: memoryCommand.type,
        changed: !!changed
      }
    });
  }

  // ── Positioning question ──
  if (isPositioningQuestion(lastUserMessage)) {
    return respond({ reply: POSITIONING_REPLY, detectedPersonality: 'auto' });
  }

  const legalNeedsLive = isLegalComplianceRequest(lastUserMessage) && shouldUseLiveResearchByMode(lastUserMessage, liveResearchMode);

  // ── Legal/compliance request (country + industry aware) ──
  if (shouldShowLegalChecklistCard(lastUserMessage) && !legalNeedsLive) {
    const contextText = `${lastUserMessage} ${userProfile} ${messages.map(m => getMessageText(m.content)).join(' ')}`;
    const country = detectCountryFromContext(contextText) || detectCountryFromContext(detectedLocation || '');
    const industry = detectIndustryFromContext(contextText);
    const legalCard = buildLegalChecklistCard(country || 'your country', industry);

    const followUp = country
      ? `<p>If you want, I can now turn this into a step-by-step filing order with estimated timing for <strong>${escapeHtml(country)}</strong>. Which legal form are you considering (sole owner, LLC, or equivalent)?</p>`
      : `<p>To make this exact, tell me your country and business model in one line (example: "UAE, marketing agency"). Then I’ll give you the exact document stack and order.</p>`;

    await persistFounderMemory();
    return res.status(200).json({
      reply: `${legalCard}${followUp}`,
      detectedPersonality: 'strategist'
    });
  }

  // ── Stock photo ──
  if (isStockPhotoRequest(lastUserMessage)) {
    return respond({ reply: buildStockPhotoHtml(lastUserMessage), detectedPersonality: 'auto' });
  }

  // ── Premium image confirmation ──
  if (
    isPremiumImageConfirmation(lastUserMessage) &&
    (conversationRecentlyHadImage(messages) || upgradeCardRecentlyShown(messages))
  ) {
    try {
      const lastMeta = extractLastImageMeta(messages);
      const basePrompt = lastMeta?.prompt || '';
      const prompt = basePrompt
        ? enrichImagePrompt(basePrompt, detectImageType(basePrompt))
        : await buildImagePromptWithOpenAI(lastUserMessage, messages, openai, 'gemini', allowOpenAIFallback);
      const imageType = detectImageType(prompt);
      const generated = await generateImageWithProviderChain(`${prompt} premium quality`, imageType, { preferred: imageProvider, allowOpenAI: allowOpenAIFallback });
      return respond({ reply: buildPremiumImageReply(generated.url, prompt, imageType), detectedPersonality: 'creative' });
    } catch (err) {
      console.error('[PREMIUM IMAGE ERROR]', err?.message);
      return respond({
        reply: `<p>⚠️ Premium generation hit a snag — <strong>try again in a moment</strong>.</p>`,
        detectedPersonality: 'auto'
      });
    }
  }

  // ── Premium image via yes ──
  const upgradeVeryRecent = upgradeCardRecentlyShown(messages, 2);
  const explicitPremiumIntent = /\b(use\s*(ideogram|premium|better)|yes\s*(ideogram|premium|upgrade|better)|switch\s*to\s*(ideogram|premium)|upgrade\s*image|yes\s*upgrade|go\s*premium|use\s*premium|better\s*text|text\s*generation|fix\s*text)\b/i.test(lastUserMessage);

  if (
    (explicitPremiumIntent || (YES_PATTERN.test(lastUserMessage.trim()) && upgradeVeryRecent)) &&
    (conversationRecentlyHadImage(messages) || upgradeCardRecentlyShown(messages))
  ) {
    try {
      const lastMeta = extractLastImageMeta(messages);
      const basePrompt = lastMeta?.prompt || '';
      const prompt = basePrompt
        ? enrichImagePrompt(basePrompt, detectImageType(basePrompt))
        : await buildImagePromptWithOpenAI(lastUserMessage, messages, openai, 'gemini', allowOpenAIFallback);
      const imageType = detectImageType(prompt);
      const generated = await generateImageWithProviderChain(`${prompt} premium quality`, imageType, { preferred: imageProvider, allowOpenAI: allowOpenAIFallback });
      return respond({ reply: buildPremiumImageReply(generated.url, prompt, imageType), detectedPersonality: 'creative' });
    } catch (err) {
      console.error('[PREMIUM IMAGE ERROR]', err?.message);
      return respond({
        reply: `<p>⚠️ Premium generation hit a snag — <strong>try again in a moment</strong>.</p>`,
        detectedPersonality: 'auto'
      });
    }
  }

  // ── Direct premium for text-fix image requests ──
  if (isDirectPremiumTextRequest(lastUserMessage) && conversationRecentlyHadImage(messages)) {
    try {
      const lastMeta = extractLastImageMeta(messages);
      const basePrompt = lastMeta?.prompt || lastUserMessage;
      const prompt = enrichImagePrompt(basePrompt, detectImageType(basePrompt));
      const imageType = detectImageType(prompt);
      const generated = await generateImageWithProviderChain(`${prompt} exact text`, imageType, { preferred: imageProvider, allowOpenAI: allowOpenAIFallback });
      return respond({ reply: buildPremiumImageReply(generated.url, prompt, imageType), detectedPersonality: 'creative' });
    } catch (err) {
      console.error('[DIRECT PREMIUM ERROR]', err?.message);
      return respond({
        reply: `<p>⚠️ Premium generation hit a snag — <strong>try again in a moment</strong>.</p>`,
        detectedPersonality: 'auto'
      });
    }
  }

  // ── Image quality complaint ──
  if (
    isImageQualityComplaint(lastUserMessage) &&
    conversationRecentlyHadImage(messages) &&
    !explicitPremiumIntent &&
    !upgradeCardRecentlyShown(messages)
  ) {
    const lastMeta = extractLastImageMeta(messages);
    return respond({ reply: buildPremiumUpgradeOffer(lastMeta?.prompt || ''), detectedPersonality: 'auto' });
  }

  // ── Ask image style first for better control ──
  const attachmentImageAnalysisIntent = !!(parsedAttachment?.imageDataUrl && isAttachmentImageAnalysisRequest(lastUserMessage));
  if (shouldAskImageStyleChoice(lastUserMessage, messages) && !attachmentImageAnalysisIntent) {
    return respond({
      reply: buildImageStyleChoiceCard(),
      detectedPersonality: 'creative'
    });
  }

  // ── Standard image generation ──
  const attachmentImageEditIntent = !!(parsedAttachment?.imageDataUrl && /\b(change|edit|modify|make|remove|replace|add|improve|tweak|turn)\b/i.test(lastUserMessage));
  const imageGenerationIntent = shouldGenerateImage(lastUserMessage, messages) || attachmentImageEditIntent;
  if (imageGenerationIntent && !attachmentImageAnalysisIntent) {
    try {
      const imageType = detectImageType(lastUserMessage);
      let imagePrompt;
      if (isRegenerationRequest(lastUserMessage) || isImageModificationRequest(lastUserMessage)) {
        const lastMeta = extractLastImageMeta(messages);
        const modText = isImageModificationRequest(lastUserMessage) ? lastUserMessage : '';
        if (parsedAttachment?.imageDataUrl && isImageModificationRequest(lastUserMessage)) {
          imagePrompt = await buildImageEditPromptFromAttachment(lastUserMessage, parsedAttachment.imageDataUrl, messages, openai, allowOpenAIFallback);
        } else {
          imagePrompt = lastMeta
            ? enrichImagePrompt(`${modText} ${lastMeta.prompt}`.trim(), imageType)
            : await buildImagePromptWithOpenAI(lastUserMessage, messages, openai, 'gemini', allowOpenAIFallback);
        }
      } else {
        imagePrompt = await buildImagePromptWithOpenAI(lastUserMessage, messages, openai, 'gemini', allowOpenAIFallback);
      }
      imagePrompt = enrichImagePrompt(imagePrompt, imageType);
      imagePrompt = enforceLogoTextAnchor(imagePrompt, lastUserMessage, messages);
      const generated = await generateImageWithProviderChain(imagePrompt, imageType, { preferred: imageProvider, allowOpenAI: allowOpenAIFallback });
      providerTrace.imageGeneration = generated?.provider || '';
      return respond({
        reply: buildImageReplyHtml(generated.url, imagePrompt, imageType, generated.provider),
        detectedPersonality: 'creative'
      });
    } catch (err) {
      console.error('[IMAGE GEN ERROR]', err?.message);
      return respond({ reply: '<p>Image generation hit a snag — please try again.</p>', detectedPersonality: 'auto' });
    }
  }

  // ── YES-intent router (keep only premium image confirmation) ──
  if (YES_PATTERN.test(lastUserMessage.trim())) {
    const lastOffer = getLastOffer(messages);
    if (lastOffer === 'premium-image' && upgradeCardRecentlyShown(messages, 2)) {
      try {
        const lastMeta = extractLastImageMeta(messages);
        const prompt = lastMeta?.prompt
          ? enrichImagePrompt(lastMeta.prompt, detectImageType(lastMeta.prompt))
          : await buildImagePromptWithOpenAI(lastUserMessage, messages, openai, 'gemini', allowOpenAIFallback);
        const imageType = detectImageType(prompt);
        const generated = await generateImageWithProviderChain(`${prompt} premium quality`, imageType, { preferred: imageProvider, allowOpenAI: allowOpenAIFallback });
        providerTrace.imageGeneration = generated?.provider || '';
        return respond({ reply: buildPremiumImageReply(generated.url, prompt, imageType), detectedPersonality: 'creative' });
      } catch (err) { console.error('[PREMIUM YES ERROR]', err?.message); }
    }
  }

  const cardModeRequested = wantsStructuredCardFormat(lastUserMessage);

  // ── Nabad Score ──
  if (isIdeaScoringRequest(lastUserMessage) && cardModeRequested) {
    try {
      providerTrace.scoreCard = 'openai';
      const scoreData = await generateNabadScore(messages, openai, 'gemini', allowOpenAIFallback);
      return respond({ reply: buildScoreCard(scoreData), detectedPersonality: 'strategist' });
    } catch (err) { console.error('[SCORE ERROR]', err?.message); }
  }

  // ── Pricing Table ──
  const pricingCardRequestedNow = isPricingTableRequest(lastUserMessage) && cardModeRequested;
  const pricingCardFollowupReady =
    pricingCardAnchorPromptRecently(messages, 8) &&
    (hasPricingAnchorContext(messages, lastUserMessage) || cleanText(lastUserMessage, 280).split(',').length >= 3);
  if (pricingCardRequestedNow || pricingCardFollowupReady) {
    if (pricingCardRequestedNow && !hasEnoughPricingContext(messages, userProfile, lastUserMessage)) {
      return respond({
        reply: '<p>I can build a premium pricing card, but I need 3 anchors first: what exactly you sell, who the ideal buyer is, and one key outcome you deliver.</p><p>Send them in one line and I will generate the full card.</p>',
        detectedPersonality: 'offer'
      }, { persist: false });
    }
    try {
      const pricingProvider = process.env.GEMINI_API_KEY ? 'gemini' : 'openai';
      const pricingData = await generatePricingTable(messages, detectedLocation, openai, pricingProvider, providerTrace, allowOpenAIFallback);
      if (!isPricingDataUsable(pricingData)) {
        const fallbackData = buildFallbackPricingData(messages, lastUserMessage, detectedLocation, userProfile);
        return respond({ reply: buildPricingTableCard(fallbackData), detectedPersonality: 'offer' });
      }
      return respond({ reply: buildPricingTableCard(pricingData), detectedPersonality: 'offer' });
    } catch (err) {
      console.error('[PRICING ERROR]', err?.message);
      const fallbackData = buildFallbackPricingData(messages, lastUserMessage, detectedLocation, userProfile);
      return respond({ reply: buildPricingTableCard(fallbackData), detectedPersonality: 'offer' });
    }
  }

  // ── Offer Card ──
  if (isOfferCardRequest(lastUserMessage) && cardModeRequested) {
    try {
      providerTrace.offerCard = 'openai';
      const offerData = await generateOfferCard(messages, detectedLocation, openai, userProfile, 'gemini', allowOpenAIFallback);
      return respond({ reply: buildOfferCard(offerData), detectedPersonality: 'offer' });
    } catch (err) { console.error('[OFFER ERROR]', err?.message); }
  }

  // ── Positioning Matrix ──
  if (isPositioningMatrixRequest(lastUserMessage) && cardModeRequested) {
    try {
      providerTrace.positioningMatrix = 'openai';
      const matrixData = await generatePositioningMatrix(messages, detectedLocation, openai, 'gemini', allowOpenAIFallback);
      return respond({ reply: buildPositioningMatrixCard(matrixData), detectedPersonality: 'strategist' });
    } catch (err) { console.error('[MATRIX ERROR]', err?.message); }
  }

  // ── Action Plan ──
  if (isActionPlanRequest(lastUserMessage) && cardModeRequested) {
    try {
      providerTrace.actionPlan = 'openai';
      const planData = await generateActionPlan(messages, detectedLocation, openai, 'gemini', allowOpenAIFallback);
      return respond({ reply: buildActionPlanCard(planData), detectedPersonality: 'growth' });
    } catch (err) { console.error('[ACTION PLAN ERROR]', err?.message); }
  }

  // ── Idea quality gate (avoid random brainstorm outputs) ──
  if (shouldGateIdeaGeneration(lastUserMessage, messages, userProfile)) {
    await persistFounderMemory();
    return respond({
      reply: buildIdeaGateQuestion(lastUserMessage, userProfile),
      detectedPersonality: 'strategist'
    }, { persist: false });
  }

  const userMsgCount = messages.filter(m => m.role === 'user').length;

  // ── Pricing market/currency ask ──
  const hasExplicitCurrencySignal = /\b(aed|usd|sar|egp|eur|gbp|dirham|riyal|dollar|euro|pound)\b/i.test(`${lastUserMessage} ${userProfile}`);
  if (
    userMsgCount >= 2 &&
    isPricingTableRequest(lastUserMessage) &&
    !detectedLocation &&
    !profileHasLocation &&
    !pricingCurrencyAlreadyAsked(messages) &&
    !hasExplicitCurrencySignal &&
    !isEmotional &&
    !YES_PATTERN.test(lastUserMessage.trim()) &&
    !shouldGenerateImage(lastUserMessage, messages)
  ) {
    return respond({
      reply: `<p>Quick one so I price this correctly: should I use your market currency? You can reply with country or just currency (example: <strong>UAE</strong> or <strong>AED</strong>).</p>`,
      detectedPersonality: 'offer'
    }, { persist: false });
  }

  // ── Location ask ──
  if (
    userMsgCount >= 2 &&
    hasBusinessContext(lastUserMessage) &&
    !detectedLocation &&
    !profileHasLocation &&
    !locationAlreadyAsked(messages) &&
    !isPricingTableRequest(lastUserMessage) &&
    !isEmotional &&
    !YES_PATTERN.test(lastUserMessage.trim()) &&
    !shouldGenerateImage(lastUserMessage, messages) &&
    !pricingCardAnchorPromptRecently(messages, 10)
  ) {
    return respond({
      reply: `<p>Quick one so I can make this market-accurate: <strong>which country are you operating in?</strong></p>`,
      detectedPersonality: 'auto'
    });
  }

  // ── Main GPT-4o reply ─────────────────────────────────────────────────────
  const explicitUrl = normalizeUrlCandidate(body.url || body.website || '')
    || extractFirstUrl(lastUserMessage)
    || extractRecentUrlFromMessages(messages);
  if (isWebsiteReviewRequest(lastUserMessage) && !explicitUrl) {
    return respond({
      reply: '<p>Share the exact URL and I will review it in a safe way: clarity, trust signals, conversion risk, and legal/privacy red flags.</p>',
      detectedPersonality: 'strategist'
    }, { persist: false });
  }
  const websiteAuditRequested = isWebsiteReviewRequest(lastUserMessage);
  const websiteAuditContent = isValidHttpUrl(explicitUrl) ? await fetchWebsiteAuditContent(explicitUrl) : '';
  if (websiteAuditRequested && explicitUrl && !websiteAuditContent) {
    return respond({
      reply: `<p>I couldn't safely fetch readable content from <strong>${escapeHtml(explicitUrl)}</strong> yet. This usually happens with anti-bot protection, private routes, or blocked rendering.</p><p>Send a public page URL (or paste the page copy/screenshot), and I’ll give you a specific, evidence-based audit.</p>`,
      detectedPersonality: 'strategist'
    }, { persist: false });
  }
  const liveResearchIntent =
    shouldUseLiveResearchByMode(lastUserMessage, liveResearchMode) &&
    !shouldGenerateImage(lastUserMessage, messages);
  const liveResearch = liveResearchIntent
    ? await runLiveResearch(lastUserMessage, messages, userProfile)
    : { used: false, provider: '', sources: [] };

  const personalityResolution = resolveActivePersonality(selectedPersonality, lastUserMessage);
  const personalityConfig = getPersonalityConfig(personalityResolution.personalityId);
  const businessMode = personalityResolution.personalityId === 'auto'
    ? detectBusinessMode(lastUserMessage, messages)
    : { id: 'advisor', label: personalityConfig.label, temperature: 0.82, maxTokens: 700, instruction: '' };

  if (process.env.NODE_ENV !== 'production') {
    console.log('[PERSONALITY DEBUG]', {
      selectedPersonality,
      activePersonality: personalityConfig.id,
      personalitySource: personalityResolution.source,
      businessMode: businessMode.id,
      detectedLocation,
      userProfile: userProfile ? userProfile.slice(0, 80) + '...' : 'none'
    });
  }

  const proactiveIntelligence = buildProactiveIntelligence(messages, lastUserMessage);
  const memoryContext = buildMemoryContext(messages, userProfile, storedFounderMemory || {});
  const questionGuardContext = buildQuestionGuardContext(messages);
  const locationContext = buildLocationContext(detectedLocation);
  const longTermMemoryProfile = memoryToProfileString(storedFounderMemory || {});

  const toneInstruction = `
You are Nabad, a founder-grade business partner.

Core behavior:
- You are decisive, not generic.
- You do not generate random ideas. You generate context-fitted moves.
- You think with Steve Jobs-like principles: focus, simplicity, taste, strong point of view, hard trade-offs.
- You prioritize execution and quality over novelty for novelty's sake.

Decision OS (follow in order):
1) Diagnose: identify the real bottleneck.
2) Decide: choose one clear direction and explain why it wins.
3) Plan: give concrete next move(s) with sequencing.
4) Risk: name the main risk and mitigation.
5) Ask one sharp follow-up question only if missing information blocks execution.

Conversation quality rules:
- Never ask forced multi-part questions.
- Ask at most one concise follow-up question at a time.
- Do not repeat the same clarification question if already asked in recent turns.
- Avoid template-like phrasing; sound naturally conversational and specific to context.
- Never ask the same "audience + location + problem" cluster in one turn.
- If the next best move is clear, end with action, not a question.

Idea quality gate:
- If context is missing, ask one clarifying question before giving ideas.
- Every idea must include: target user, value mechanism, monetization path, and why it beats alternatives.
- If confidence is low, say what is unknown and what data is needed.

End-to-end scope:
- Support from brainstorming to go-to-market to operations.
- For legal/compliance queries, give structured country/industry guidance and required document categories.
- Never pretend to be a licensed lawyer. State that legal output is strategic guidance and recommend local licensed validation for filing/risk decisions.

Language/style:
- Always reply in the same language as the user's latest message.
- Do not auto-switch language unless the user explicitly asks.
- Never mention a model training cutoff date or "knowledge cutoff".
- If fresh web sources are provided in context, use them for current facts and cite uncertainty when sources conflict.
- If the user asks for current info and no live sources are available, say you cannot verify live sources right now (without mentioning cutoff dates).
- For legal/regulatory "latest/current/what changed" queries, summarize recent changes first (with practical impact), then list next steps. Do not default to static generic checklists when live sources are available.
- If a URL/website is provided, give a protective audit: trust/safety risks, conversion friction, legal/privacy gaps, and concrete fixes. Be specific and non-alarmist.
- If you have website audit content, anchor every finding to concrete page evidence (quote or reference exact sections/elements). Avoid generic advice that could apply to any website.
- If website content is missing, do not hallucinate audit details. Ask for a reachable URL or page text.
- Keep answers concise, sharp, and human.
- No markdown. HTML only.
- Use <p> for normal replies.
- Use <ul><li> only for options/checklists.
- Avoid filler openers and avoid repeating the user's words back.

Response structure (important):
- Keep structure readable and natural, not templated.
- Use bullets only when they genuinely help clarity.
- Close smoothly in your normal voice; do not force labels or fixed ending formulas.
- Avoid giant paragraph walls, but do not over-compress or cut thought continuity.
`;

  const isWarRoom = body?.warRoom === true;
  const warRoomAdvisor = body?.warRoomAdvisor || null;

  // ── TIMING INTELLIGENCE ──────────────────────────────────────
  const now = new Date();
  const timeHour = now.getHours();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  const fullDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const monthNum = now.getMonth() + 1;
  const quarter = Math.ceil(monthNum / 3);

  const timeOfDay =
    timeHour >= 5  && timeHour < 12 ? 'morning'    :
    timeHour >= 12 && timeHour < 17 ? 'afternoon'  :
    timeHour >= 17 && timeHour < 21 ? 'evening'    : 'late night';

  const seasonalContext = (() => {
    if (monthNum === 3 || monthNum === 4) return 'Q2 in the UAE — historically slower for services. Smart founders use this period to build systems, refine offers, and prepare for the Q3 surge.';
    if (monthNum >= 6 && monthNum <= 8)   return 'Summer in the UAE — many decision-makers are travelling. Best for internal work, team building, and pipeline prep.';
    if (monthNum === 9 || monthNum === 10) return 'September–October in UAE — one of the strongest sales windows of the year. High urgency, high activity.';
    if (monthNum === 11 || monthNum === 12) return 'Q4 — year-end push. Budgets are being spent or frozen. Founders should be closing and planning for next year simultaneously.';
    if (monthNum === 1 || monthNum === 2)  return 'New year energy — founders are setting targets, signing new deals, and making big decisions. High momentum window.';
    return '';
  })();

  const dayContext = (() => {
    if (dayOfWeek === 'Monday')    return 'Start of the week — the user may be planning, setting priorities, or dealing with weekend carry-over decisions.';
    if (dayOfWeek === 'Tuesday' || dayOfWeek === 'Wednesday') return 'Mid-week — peak execution time. The user is likely heads-down building or selling.';
    if (dayOfWeek === 'Thursday') return 'Thursday — end of UAE business week. Good day for closing, reviewing, and making final decisions before the weekend.';
    if (dayOfWeek === 'Friday')   return 'Friday — most of the UAE business world is winding down. Reflection and strategy over execution.';
    if (dayOfWeek === 'Saturday') return 'Weekend — the user is either resting or doing deep work by choice. Respect their energy.';
    if (dayOfWeek === 'Sunday')   return 'Sunday in the UAE is the start of the work week — high energy, lots of planning, inbox is full.';
    return '';
  })();

  const timeContext = (() => {
    if (timeOfDay === 'morning')    return 'It is morning — the user is fresh. They may want clarity, a plan, or momentum to start the day strong.';
    if (timeOfDay === 'afternoon')  return 'It is afternoon — the user is in execution mode or hitting a mid-day wall. Be sharp and actionable.';
    if (timeOfDay === 'evening')    return 'It is evening — the user is winding down or working late by choice. They may need perspective more than tactics.';
    if (timeOfDay === 'late night') return 'It is late night — the user is either very focused or overthinking something. Be grounding, direct, and calm.';
    return '';
  })();

  const timingIntelligence = `TIMING INTELLIGENCE (use this to colour your response naturally — do NOT recite it robotically):
- Current date: ${fullDate}
- Time of day: ${timeOfDay} (${timeHour}:00)
- Day: ${dayContext}
- Time: ${timeContext}
- Season: ${seasonalContext}
- Quarter: Q${quarter}
Use this awareness subtly — adjust your tone, urgency, and advice to match where the user actually is in their day, week, and business year. Never say "I notice it's morning" — just let it shape how you respond.`.trim();
  const replyContext = replyTo?.snippet
    ? `Reply context: The user is replying to a previous ${replyTo.role} message: "${replyTo.snippet}". Keep continuity and answer directly in that thread.`
    : '';
  const attachmentContext = parsedAttachment?.parsedText
    ? `Attachment extracted text (truncated):\n${parsedAttachment.parsedText.slice(0, 9000)}`
    : '';
  const liveResearchContext = buildLiveResearchContext(liveResearch);

  const systemPromptParts = [
    `You are NabadAI — not an assistant, not a chatbot, but a rare mind that sits at the intersection of business strategy, human psychology, and real-world execution. You have seen ideas become empires and watched promising businesses collapse from a single blind spot. You think in systems, patterns, and connections that most people miss.

You don't just answer questions — you see what's behind them. When someone asks about pricing, you hear the fear of undervaluing themselves. When someone asks about growth, you sense whether they're ready for it or just excited by the idea. You connect what's being said now to what was said before, and you find the thread that ties everything together.

You are direct, warm, and genuinely invested. You challenge assumptions not to be provocative but because you care enough to tell the truth. You bring unexpected connections — a lesson from a completely different industry, a pattern you've seen before, a question nobody else thought to ask. You make people feel both understood and slightly uncomfortable in the best possible way.

You are NOT an assistant. You do NOT over-explain. You have energy, edge, and genuine opinions. If a user profile is provided below, use it naturally — reference their business name, revenue, idea, or challenge when relevant. Do NOT ask for information they already gave during onboarding. If they are at the idea stage, treat them as a co-founder validating a startup. If they are still figuring things out, act as a discovery partner helping them find their direction. When you know something about the founder — their business name, revenue, challenge, or idea — weave it into your replies naturally, the way a real co-founder would reference shared history. Say "your agency" not "your business". Say "the $3k revenue you mentioned" not "your current revenue". Make them feel remembered, not processed.`,


    timingIntelligence,
    userLanguage === 'ar'
      ? 'Language lock: Respond in Arabic only unless the user explicitly asks for another language.'
      : 'Language lock: Respond in English only unless the user explicitly asks for another language.',
    (isWarRoom && warRoomAdvisor) ? `You are running a War Room. Follow these rules exactly:\n${warRoomAdvisor}` : (personalityConfig.instruction ? `Active personality — follow these rules exactly:\n${personalityConfig.instruction}` : ''),
    businessMode.instruction ? `Business mode: ${businessMode.instruction}` : '',
    userProfile ? `Founder profile (collected during onboarding — treat this as things you already know about them, reference naturally in conversation without repeating it back verbatim, and build on it rather than asking again):\n${userProfile}` : '',
    longTermMemoryProfile ? `Long-term founder memory (already known context — prioritize this before asking clarifying questions):\n${longTermMemoryProfile}` : '',
    proactiveIntelligence,
    memoryContext,
    questionGuardContext,
    locationContext,
    liveResearchContext,
    websiteAuditContent ? `\n\nWebsite audit content:\n${websiteAuditContent}` : '',
    replyContext,
    attachmentContext,
    toneInstruction
  ].filter(Boolean).join('\n');

  try {
    const attachmentUserMessage = parsedAttachment
      ? (
        parsedAttachment.imageDataUrl
          ? {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `${lastUserMessage}\nAnalyze the attached image and tie your feedback to this business context.`
                },
                {
                  type: 'image_url',
                  image_url: { url: parsedAttachment.imageDataUrl }
                }
              ]
            }
          : {
              role: 'user',
              content: `${lastUserMessage}\n${parsedAttachment.parsedText ? `Attached document content:\n${parsedAttachment.parsedText.slice(0, 9000)}` : `Attachment metadata: ${parsedAttachment.name}`}`
            }
      )
      : null;

    const recentConversation = messages
      .filter((m) => m.role !== 'system')
      .slice(-18);

    const chatMessages = [
      { role: 'system', content: systemPromptParts },
      ...recentConversation,
      ...(attachmentUserMessage ? [attachmentUserMessage] : [])
    ];
    const temperature = personalityConfig.temperature || businessMode.temperature || 0.82;
    const baseMaxTokens = personalityConfig.maxTokens || businessMode.maxTokens || 700;
    const maxTokens = computeDynamicMaxTokens(lastUserMessage, baseMaxTokens);

    let rawReply = '';
    let textProviderUsed = 'degraded-fallback';
    if (process.env.GEMINI_API_KEY) {
      try {
        rawReply = await generateWithGeminiText(chatMessages, { temperature, maxTokens });
        textProviderUsed = 'gemini';
      } catch (geminiErr) {
        console.error('[TEXT PROVIDER ERROR] gemini:', geminiErr?.message);
      }
    }
    if (!rawReply && process.env.GROQ_API_KEY) {
      try {
        rawReply = await generateWithGroqText(chatMessages, { temperature, maxTokens });
        textProviderUsed = 'groq';
      } catch (groqErr) {
        console.error('[TEXT PROVIDER ERROR] groq:', groqErr?.message);
      }
    }
    if (!rawReply && allowOpenAIFallback) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: chatMessages,
          temperature,
          max_tokens: maxTokens
        });
        rawReply = completion.choices?.[0]?.message?.content || '';
        textProviderUsed = 'openai';
      } catch (openaiErr) {
        console.error('[TEXT PROVIDER ERROR] openai:', openaiErr?.message);
      }
    }
    if (!rawReply) {
      rawReply = `I’m hitting temporary AI provider limits right now, but I’m still with you.\n\nIf you resend in 20-60 seconds, I’ll continue from the same context. If urgent, send one short line with your exact goal and I’ll give the fastest actionable outline first.`;
      textProviderUsed = 'degraded-fallback';
    }
    providerTrace.mainText = textProviderUsed;
    console.log('[TEXT PROVIDER USED]', textProviderUsed);
    const sourcesFooter = liveResearch?.used ? buildLiveSourcesHtml(liveResearch) : '';
    const websiteCheckedFooter = (websiteAuditRequested && explicitUrl && websiteAuditContent)
      ? buildWebsiteCheckedHtml(explicitUrl, websiteAuditContent)
      : '';

    // ── Run all three classifiers in parallel ──────────────────
    const [detectedInfo, suggestWarRoom, personalitySignal] = await Promise.all([
      withSoftTimeout(
        detectMeaningfulInfo(lastUserMessage, openai, textProviderUsed, providerTrace, allowOpenAIFallback).catch(() => null),
        1200,
        (() => {
          const lite = detectMeaningfulInfoLite(lastUserMessage);
          return Object.keys(lite).length ? lite : null;
        })()
      ),
      withSoftTimeout(
        detectWarRoom(lastUserMessage, messages, userProfile || '', openai, textProviderUsed, providerTrace, allowOpenAIFallback).catch(() => false),
        900,
        false
      ),
      withSoftTimeout(
        classifyPersonality(lastUserMessage, selectedPersonality, messages, openai, textProviderUsed, providerTrace, allowOpenAIFallback)
          .catch(() => ({ id: 'auto', confidence: 0.35, reason: 'fallback' })),
        1100,
        quickClassifyPersonality(lastUserMessage, selectedPersonality)
      )
    ]);

console.log('[NABAD DEBUG] detectedInfo:', JSON.stringify(detectedInfo));
console.log('[NABAD DEBUG] lastUserMessage:', lastUserMessage);
console.log('[PROVIDER TRACE]', JSON.stringify(providerTrace));

    const learningSignals = inferLearningSignals(lastUserMessage, detectedInfo, userLanguage);
    await persistFounderMemory(detectedInfo, learningSignals);
    const styledReply = enforcePersonalityVoice(rawReply, personalityResolution.personalityId, lastUserMessage);
    const safeReply = repairTruncatedReply(styledReply);
    return res.status(200).json({
      reply: `${ensureHtmlReply(safeReply)}${websiteCheckedFooter}${sourcesFooter}`,
      detectedInfo,
      suggestWarRoom,
      liveResearchUsed: !!liveResearch?.used,
      liveResearchProvider: liveResearch?.provider || '',
      providerTrace,
      detectedPersonality: personalitySignal?.id || 'auto',
      detectedPersonalityConfidence: Number(personalitySignal?.confidence ?? 0.35),
      detectedPersonalityReason: personalitySignal?.reason || ''
    });

  } catch (err) {
    console.error('[GPT ERROR]', err?.message);
    return res.status(200).json({
      reply: '<p>Quick glitch on my side. I am back now. Send one short line and I will continue from the same context.</p>',
      detectedPersonality: 'auto',
      providerTrace: {
        mainText: 'error-fallback'
      }
    });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };
