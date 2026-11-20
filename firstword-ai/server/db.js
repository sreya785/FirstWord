// Tiny JSON-file database (no native dependencies). Good for a demo / single-family install.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { computeSessionScore } from './dashboard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export function getDataDir() {
  if (process.env.VERCEL) return '/tmp';
  return process.env.DATA_DIR || path.join(__dirname, '..', 'data');
}
export function getDbFile() {
  return path.join(getDataDir(), 'db.json');
}

let db = { children: [], sessions: [] };
let saveTimer = null;

export function saveLiveSession(sessionId, data) {
  try {
    const dir = getDataDir();
    const f = path.join(dir, `sess_${sessionId}.json`);
    fs.writeFileSync(f, JSON.stringify(data));
  } catch (e) {
    console.error('saveLiveSession failed:', e.message);
  }
}

export function loadLiveSession(sessionId) {
  try {
    const dir = getDataDir();
    const f = path.join(dir, `sess_${sessionId}.json`);
    if (fs.existsSync(f)) {
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    }
  } catch (e) {
    console.error('loadLiveSession failed:', e.message);
  }
  return null;
}

export function flushSync() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      const file = getDbFile();
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
      fs.renameSync(tmp, file);
    } catch (e) {
      console.error('db flushSync failed:', e.message);
    }
  }
}

export function load() {
  if (saveTimer) flushSync();
  try {
    const dataDir = getDataDir();
    const dbFile = getDbFile();
    fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(dbFile) && process.env.VERCEL) {
      const seedFile = path.join(__dirname, '..', 'data', 'db.json');
      if (fs.existsSync(seedFile)) {
        try { fs.copyFileSync(seedFile, dbFile); } catch {}
      }
    }
    if (fs.existsSync(dbFile)) db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    else db = { children: [], sessions: [] };
    db.children ||= [];
    db.sessions ||= [];
    if (db.children.length === 0) {
      db.children.push({
        id: 'sreya',
        name: 'sreya',
        age: 4,
        lang: 'bn',
        petType: 'cat',
        petName: 'Momo',
        created: 1774000000000,
        settings: { storeTranscripts: true, dailyLimitMinutes: 20 },
        stickers: ['apple', 'star']
      });
    }
  } catch (e) {
    console.error('Could not load db.json, starting fresh:', e.message);
    db = { children: [{ id: 'sreya', name: 'sreya', age: 4, lang: 'bn', petType: 'cat', petName: 'Momo', created: 1774000000000, settings: { storeTranscripts: true, dailyLimitMinutes: 20 }, stickers: ['apple', 'star'] }], sessions: [] };
  }
  return db;
}

export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const file = getDbFile();
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
      fs.renameSync(tmp, file);
    } catch (e) {
      console.error('db save failed:', e.message);
    }
  }, 150);
}

export const id = () => crypto.randomBytes(6).toString('hex');

export function hashPin(pin, salt = crypto.randomBytes(8).toString('hex')) {
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return { salt, hash };
}
export function verifyPin(child, pin) {
  if (!child.pinHash) return true;
  const { hash } = hashPin(pin || '', child.pinSalt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(child.pinHash));
}

// ---- children ----
const newlyCreatedIds = new Set();
const BULK_TEST_NAMES = new Set(['tisha', 't', 'apikid', 'previewcheck']);

export function listChildren() {
  load();
  const previewChild = db.children.find((c) => c.id === '61a1b268f77a' || c.name.toLowerCase() === 'sreya');
  const results = [];
  if (previewChild) {
    results.push({ ...publicChild(previewChild), isPreview: true });
  }
  for (const c of db.children) {
    if (previewChild && c.id === previewChild.id) continue;
    const normName = String(c.name || '').trim().toLowerCase();
    // Exclude legacy bulk automated test duplicates unless created in this session
    if (newlyCreatedIds.has(c.id) || !BULK_TEST_NAMES.has(normName)) {
      results.push(publicChild(c));
    }
  }
  return results;
}
export function getChild(cid) {
  return db.children.find((c) => c.id === cid) || null;
}
export function publicChild(c) {
  if (!c) return null;
  const { pinHash, pinSalt, ...rest } = c;
  return { ...rest, hasPin: Boolean(pinHash) };
}
export function createChild({ name, age, lang, petType, petName, pin }) {
  const c = {
    id: id(),
    name: String(name || 'Friend').slice(0, 30),
    age: Number(age) || null,
    lang: lang === 'bn' ? 'bn' : 'en',
    petType: ['cat', 'bunny', 'dino'].includes(petType) ? petType : 'cat',
    petName: String(petName || '').slice(0, 20) || null,
    createdAt: new Date().toISOString(),
    settings: { storeTranscripts: true, autoListen: true },
    level: 2,
  };
  if (pin) Object.assign(c, (({ salt, hash }) => ({ pinSalt: salt, pinHash: hash }))(hashPin(pin)));
  db.children.push(c);
  newlyCreatedIds.add(c.id);
  save();
  return c;
}
export function updateChild(cid, patch) {
  const c = getChild(cid);
  if (!c) return null;
  if (patch.lang) c.lang = patch.lang === 'bn' ? 'bn' : 'en';
  if (patch.petName !== undefined) c.petName = String(patch.petName || '').slice(0, 20) || null;
  if (patch.petType && ['cat', 'bunny', 'dino'].includes(patch.petType)) c.petType = patch.petType;
  if (patch.name) c.name = String(patch.name).slice(0, 30);
  if (patch.settings) c.settings = { ...c.settings, ...patch.settings };
  if (patch.level) c.level = patch.level;
  if (patch.pin !== undefined) {
    if (patch.pin) { const { salt, hash } = hashPin(patch.pin); c.pinSalt = salt; c.pinHash = hash; } else { delete c.pinSalt; delete c.pinHash; }
  }
  save();
  return c;
}
export function deleteChild(cid) {
  db.children = db.children.filter((c) => c.id !== cid);
  db.sessions = db.sessions.filter((s) => s.childId !== cid);
  save();
}
export function deleteChildData(cid) {
  db.sessions = db.sessions.filter((s) => s.childId !== cid);
  const c = getChild(cid);
  if (c) { c.stickers = []; c.progress = undefined; }
  save();
}

// ---- sessions (persisted summaries) ----
export function createSessionRecord(child) {
  const s = {
    id: id(),
    childId: child.id,
    lang: child.lang,
    startedAt: new Date().toISOString(),
    endedAt: null,
    scenes: ['home'],
    utterances: 0,
    words: 0,
    silences: 0,
    questions: 0,
    skills: {},
    intents: {},
    vocab: {},
    turns: [],
    maxWords: 0,
  };
  db.sessions.push(s);
  save();
  return s;
}
export function getSessionRecord(sid) {
  return db.sessions.find((s) => s.id === sid) || null;
}
export function recordTurn(rec, child, { text, source, response, metrics }) {
  const store = child.settings?.storeTranscripts !== false;
  if (source === 'silence') rec.silences++;
  else if (metrics && metrics.wordCount > 0) {
    rec.utterances++;
    rec.words += metrics.wordCount;
    rec.maxWords = Math.max(rec.maxWords, metrics.wordCount);
    if (metrics.isQuestion) rec.questions++;
    for (const w of tokenize(text)) rec.vocab[w] = (rec.vocab[w] || 0) + 1;
  }
  for (const sk of response.skills || []) rec.skills[sk] = (rec.skills[sk] || 0) + 1;
  rec.intents[response.intent] = (rec.intents[response.intent] || 0) + 1;
  const sceneKey = response.scene === 'home' ? response.world.location : response.scene;
  if (!rec.scenes.includes(sceneKey)) rec.scenes.push(sceneKey);
  rec.turns.push({
    t: new Date().toISOString(),
    child: store ? text : (source === 'silence' ? '' : `[${metrics?.wordCount || 0} words]`),
    source,
    pet: store ? response.pet.text : '',
    intent: response.intent,
    scene: sceneKey,
    words: metrics?.wordCount || 0,
    skills: response.skills || [],
    curriculum: response.curriculum ? {
      id: response.curriculum.id,
      targetWords: response.curriculum.targetWords || [],
      followUpQuestion: response.curriculum.followUpQuestion || null,
    } : null,
    ml: response.ml ? { intent: response.ml.intent, conf: response.ml.conf } : undefined,
    lowConf: Boolean(response.intent === 'fallback' || (response.ml && response.intent.startsWith('ml_') && response.ml.conf < 0.75)),
  });
  if (rec.turns.length > 400) rec.turns.shift();
  rec.level = response.level;
  if (response.level) child.level = response.level;
  save();
}
export function endSessionRecord(rec) {
  rec.endedAt = new Date().toISOString();
  if (!rec.score && (rec.utterances || 0) >= 5) {
    rec.score = computeSessionScore(rec, rec.level || 2);
  }
  save();
}
export function sessionsForChild(cid) {
  return db.sessions.filter((s) => s.childId === cid);
}

const STOP = new Set(['the', 'a', 'an', 'i', 'to', 'is', 'it', 'and', 'of', 'in', 'on', 'my', 'me', 'we', 'you', 'this', 'that', 'let', 'lets', 'us', 'please', 'want', 'go', 'do', 'not', 'can', 'at', 'for', 'be', 'am', 'are', 'he', 'she', 'they', 'with', 'so', 'up', 'now', 'yes', 'no', 'okay', 'ok', 'um', 'uh', 'আমি', 'তুমি', 'চাই', 'না', 'হ্যাঁ', 'এটা', 'ওটা', 'আর', 'একটা', 'চলো', 'যাই', 'করো', 'দাও', 'কি', 'কী', 'আমার', 'তোমার']);
export function tokenize(text) {
  return String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).filter((w) => w && w.length > 1 && !STOP.has(w));
}
