// FirstWord AI server — Express + JSON store + rule-based pet brain. No paid APIs.
import express from 'express';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';
import * as brain from './brain/index.js';
import { buildDashboard } from './dashboard.js';
import * as ollama from './brain/ollama.js';
import * as ml from './brain/ml/index.js';
import { checkRewards, stickerList } from './rewards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));

// Memory cache for natural TTS audio stream
const ttsAudioCache = new Map();

// CORS & Vercel serverless prefix normalization
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-parent-pin, x-gemini-key, x-role-keys');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  if (!req.url.startsWith('/api') && (req.url.startsWith('/children') || req.url.startsWith('/sessions') || req.url.startsWith('/health') || req.url.startsWith('/ml') || req.url.startsWith('/tts'))) {
    req.url = '/api' + req.url;
  }
  next();
});

// Natural Audio Stream (Google TTS proxy with zero-delay memory cache)
// Provides authentic, natural Bangla and English speech on any browser/device without requiring offline voice packs.
app.get('/api/tts', (req, res) => {
  const q = String(req.query.q || req.query.text || '').trim();
  const tl = String(req.query.tl || req.query.lang || 'bn').trim();

  if (!q) {
    return res.status(400).send('Missing text parameter');
  }

  // Clean prompt text: strip markdown, stage directions, and parenthesized emotes
  const cleanText = q.replace(/\(.*?\)/g, '').replace(/\*.*?\*/g, '').trim();
  if (!cleanText) {
    return res.status(400).send('Empty text');
  }

  const cacheKey = `${tl}:${cleanText}`;
  if (ttsAudioCache.has(cacheKey)) {
    const cached = ttsAudioCache.get(cacheKey);
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': cached.length,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=604800',
    });
    return res.end(cached);
  }

  const targetUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${encodeURIComponent(tl)}&client=tw-ob`;

  const proxyReq = https.get(
    targetUrl,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
    },
    (proxyRes) => {
      if (proxyRes.statusCode !== 200) {
        return res.status(proxyRes.statusCode || 500).send('TTS upstream error');
      }
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=604800',
      });
      const chunks = [];
      proxyRes.on('data', (c) => {
        chunks.push(c);
        res.write(c);
      });
      proxyRes.on('end', () => {
        res.end();
        if (chunks.length > 0) {
          const buf = Buffer.concat(chunks);
          if (ttsAudioCache.size > 300) {
            const firstKey = ttsAudioCache.keys().next().value;
            ttsAudioCache.delete(firstKey);
          }
          ttsAudioCache.set(cacheKey, buf);
        }
      });
    }
  );

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).send(err.message);
    }
  });
});

// Live sessions (world state) kept in memory with serverless auto-reconstitution
const live = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 6;
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of live) if (now - s.lastActive > SESSION_TTL_MS) live.delete(id);
}, 60_000).unref();

db.load();

function resolveChild(childId, body = {}) {
  let child = childId ? db.getChild(childId) : null;
  if (!child) {
    const list = db.listChildren();
    if (list.length > 0) child = list.find((c) => c.id === childId) || list[0];
  }
  if (!child) {
    child = db.createChild({
      name: body.name || 'sreya',
      age: body.age || 4,
      lang: body.lang || 'en',
      petType: body.petType || 'cat',
      petName: body.petName || 'Momo'
    });
  }
  return child;
}

function resolveSession(sessionId, childId, body = {}) {
  let s = live.get(sessionId);
  if (!s) {
    const saved = db.loadLiveSession ? db.loadLiveSession(sessionId) : null;
    if (saved && saved.state) {
      s = {
        id: sessionId,
        childId: saved.childId,
        child: saved.child,
        state: saved.state,
        rec: saved.rec,
        clientKey: saved.clientKey || null,
        lastActive: Date.now(),
      };
      live.set(sessionId, s);
      return s;
    }

    const child = resolveChild(childId || body.childId, body);
    const lang = body.lang || child.lang || 'en';
    const state = brain.newSession(child, lang);
    if (body.location) {
      state.world.location = body.location;
    }
    const rec = db.createSessionRecord ? db.createSessionRecord(child) : { id: sessionId, turns: [] };
    s = { id: sessionId, childId: child.id, child, state, rec, lastActive: Date.now() };
    live.set(sessionId, s);
    if (db.saveLiveSession) db.saveLiveSession(sessionId, s);
  }
  return s;
}

const requirePin = (req, res, next) => {
  const child = db.getChild(req.params.id);
  if (!child) return res.status(404).json({ error: 'Child not found' });
  const pin = req.body?.pin ?? req.query.pin ?? req.get('x-parent-pin');
  if (!db.verifyPin(child, pin)) return res.status(403).json({ error: 'Wrong PIN' });
  req.child = child;
  next();
};

app.get('/api/health', async (_req, res) => {
  const st = ml.status();
  res.json({ ok: true, name: 'FirstWord AI', llm: ollama.enabled() ? (await ollama.check() ? 'ollama-connected' : 'ollama-unreachable') : 'rule-engine-only', model: st.ready ? { trainedAt: st.trainedAt, examples: st.meta?.examples, accuracy: st.meta?.testAccuracy } : null });
});

// ---- children ----
app.get('/api/children', (_req, res) => res.json(db.listChildren()));
app.post('/api/children', (req, res) => {
  const { name, age, lang, petType, petName, pin } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
  if (pin && !/^\d{4}$/.test(String(pin))) return res.status(400).json({ error: 'PIN must be 4 digits' });
  res.json(db.publicChild(db.createChild({ name: String(name).trim(), age, lang, petType, petName, pin })));
});
app.get('/api/children/:id', (req, res) => {
  const c = db.getChild(req.params.id);
  if (!c) return res.status(404).json({ error: 'Child not found' });
  res.json(db.publicChild(c));
});
app.patch('/api/children/:id', (req, res) => {
  const c = db.getChild(req.params.id);
  if (!c) return res.status(404).json({ error: 'Child not found' });
  const patch = { ...req.body };
  // Changing PIN or privacy settings requires the current PIN
  const sensitive = patch.pin !== undefined || (patch.settings && 'storeTranscripts' in patch.settings);
  if (sensitive && !db.verifyPin(c, patch.currentPin)) return res.status(403).json({ error: 'Wrong PIN' });
  const updated = db.updateChild(c.id, patch);
  for (const s of live.values()) if (s.childId === c.id) s.child = updated;
  res.json(db.publicChild(updated));
});
app.post('/api/children/:id/verify-pin', requirePin, (req, res) => res.json({ ok: true }));
app.delete('/api/children/:id', requirePin, (req, res) => { db.deleteChild(req.params.id); res.json({ ok: true }); });
app.delete('/api/children/:id/data', requirePin, (req, res) => { db.deleteChildData(req.params.id); res.json({ ok: true }); });
app.get('/api/children/:id/dashboard', requirePin, (req, res) => {
  const pin = req.body?.pin ?? req.query.pin ?? req.get('x-parent-pin');
  const hasPin = Boolean(req.child.pinHash);
  const pinVerified = hasPin && db.verifyPin(req.child, pin);
  const range = req.query.range || 'all';
  res.json(buildDashboard(req.child, { pinVerified, range }));
});
app.get('/api/children/:id/export', requirePin, (req, res) => {
  res.setHeader('content-disposition', `attachment; filename="firstword-${req.child.name}.json"`);
  res.json({ child: db.publicChild(req.child), sessions: db.sessionsForChild(req.child.id) });
});

// ---- stickers (collectibles) ----
app.get('/api/children/:id/stickers', (req, res) => {
  const c = db.getChild(req.params.id);
  if (!c) return res.status(404).json({ error: 'Child not found' });
  res.json(stickerList(c));
});

// ---- trainable intent model ----
app.get('/api/ml/status', (_req, res) => res.json(ml.status()));
app.post('/api/children/:id/teach', requirePin, async (req, res) => {
  const { text, intent } = req.body || {};
  try {
    const result = await ml.teach({ text, intent, lang: req.child.lang });
    res.json({ ok: result.ok, log: result.log, meta: result.meta });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/children/:id/retrain', requirePin, async (_req, res) => {
  const result = await ml.retrain();
  res.json({ ok: result.ok, log: result.log, meta: result.meta });
});
app.get('/api/children/:id/unclear', requirePin, (req, res) => {
  // Recent utterances the pet was unsure about — candidates for teaching
  const sessions = db.sessionsForChild(req.child.id);
  const turns = sessions.flatMap((s) => s.turns).filter((t) => t.child && t.source !== 'silence' && !t.child.startsWith('[') && (t.intent === 'fallback' || t.intent === 'llm' || (t.intent || '').startsWith('ml_') || t.lowConf));
  const seen = new Set();
  const out = [];
  for (const t of turns.reverse()) { const k = t.child.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push({ text: t.child, intent: t.intent, pet: t.pet, t: t.t, ml: t.ml || null }); if (out.length >= 30) break; }
  res.json(out);
});

// ---- sessions ----
app.post('/api/sessions', (req, res) => {
  const child = resolveChild(req.body?.childId, req.body);
  if (req.body?.lang) db.updateChild(child.id, { lang: req.body.lang });
  const lang = child.lang;
  const returning = db.sessionsForChild(child.id).length > 0;
  let clientKey = req.headers['x-gemini-key'] || req.headers['x-google-api-key'] || req.body?.apiKey || null;
  let roleKeys = req.body?.roleKeys || null;
  if (!roleKeys && req.headers['x-role-keys']) {
    try { roleKeys = JSON.parse(req.headers['x-role-keys']); } catch {}
  }
  if (roleKeys && typeof roleKeys === 'object') {
    clientKey = typeof clientKey === 'string' ? { master: clientKey, ...roleKeys } : roleKeys;
  }
  const state = brain.newSession(child, lang);
  if (clientKey) state.clientKey = clientKey;
  const rec = db.createSessionRecord ? db.createSessionRecord(child) : { id: 'sess_' + Date.now(), turns: [] };
  const s = { id: rec.id, childId: child.id, child, state, rec, clientKey, lastActive: Date.now() };
  live.set(s.id, s);
  if (db.saveLiveSession) db.saveLiveSession(s.id, s);
  const greeting = brain.greet(state, child, lang, returning);
  greeting.stickerCount = (child.stickers || []).length;
  greeting.rewards = [];
  res.json({ sessionId: s.id, child: db.publicChild(child), response: greeting });
});

app.post('/api/sessions/:id/say', async (req, res) => {
  const s = resolveSession(req.params.id, req.body?.childId, req.body);
  const text = String(req.body?.text || '').slice(0, 500);
  const source = ['voice', 'button', 'typed', 'silence'].includes(req.body?.source) ? req.body.source : 'typed';
  if (source !== 'silence' && !text.trim()) return res.status(400).json({ error: 'Nothing heard' });
  let clientKey = req.headers['x-gemini-key'] || req.headers['x-google-api-key'] || req.body?.apiKey || s.clientKey || null;
  let roleKeys = req.body?.roleKeys || null;
  if (!roleKeys && req.headers['x-role-keys']) {
    try { roleKeys = JSON.parse(req.headers['x-role-keys']); } catch {}
  }
  if (roleKeys && typeof roleKeys === 'object') {
    clientKey = typeof clientKey === 'string' ? { master: clientKey, ...roleKeys } : { ...(s.clientKey || {}), ...roleKeys };
  }
  if (clientKey) { s.clientKey = clientKey; if (s.state) s.state.clientKey = clientKey; }
  s.lastActive = Date.now();
  try {
    const response = await brain.processTurn(s.state, s.child, { text, source, clientKey: s.clientKey });
    if (db.recordTurn && s.rec) db.recordTurn(s.rec, s.child, { text, source, response, metrics: response.metrics });
    response.rewards = checkRewards(s.child, response, s.rec, { text, source });
    response.stickerCount = (s.child.stickers || []).length;
    if (response.rewards.length) db.save();
    if (db.saveLiveSession) db.saveLiveSession(s.id, s);
    res.json(response);
  } catch (e) {
    console.error('brain error:', e);
    res.status(500).json({ error: 'The pet got confused. Please try again.' });
  }
});

// Buttons for children who prefer tapping: jump straight to an activity
app.post('/api/sessions/:id/scene', async (req, res) => {
  const s = resolveSession(req.params.id, req.body?.childId, req.body);
  const scene = String(req.body?.scene || 'home');
  let clientKey = req.headers['x-gemini-key'] || req.headers['x-google-api-key'] || req.body?.apiKey || s.clientKey || null;
  let roleKeys = req.body?.roleKeys || null;
  if (!roleKeys && req.headers['x-role-keys']) {
    try { roleKeys = JSON.parse(req.headers['x-role-keys']); } catch {}
  }
  if (roleKeys && typeof roleKeys === 'object') {
    clientKey = typeof clientKey === 'string' ? { master: clientKey, ...roleKeys } : { ...(s.clientKey || {}), ...roleKeys };
  }
  if (clientKey) { s.clientKey = clientKey; if (s.state) s.state.clientKey = clientKey; }
  const phrases = {
    en: { home: 'let us go home', restaurant: 'let us go to the restaurant', shop: 'let us go to the shop', hospital: 'let us go to the hospital', stage: 'let us go to the stage', emergency: 'help my pet', create: 'let us create our own world', park: 'let us go to the park', beach: 'let us go to the beach', space: 'let us go to space' },
    bn: { home: 'চলো বাড়ি যাই', restaurant: 'চলো রেস্টুরেন্টে যাই', shop: 'চলো দোকানে যাই', hospital: 'চলো হাসপাতালে যাই', stage: 'চলো মঞ্চে যাই', emergency: 'বন্ধুকে সাহায্য করি', create: 'চলো নিজের জগৎ বানাই', park: 'চলো পার্কে যাই', beach: 'চলো সমুদ্রে যাই', space: 'চলো মহাকাশে যাই' },
  };
  const text = (phrases[s.child.lang] || phrases.en)[scene] || phrases.en.home;
  s.lastActive = Date.now();
  const response = await brain.processTurn(s.state, s.child, { text, source: 'button', clientKey: s.clientKey });
  if (db.recordTurn && s.rec) db.recordTurn(s.rec, s.child, { text, source: 'button', response, metrics: response.metrics });
  response.rewards = checkRewards(s.child, response, s.rec, { text, source: 'button' });
  response.stickerCount = (s.child.stickers || []).length;
  if (response.rewards.length) db.save();
  if (db.saveLiveSession) db.saveLiveSession(s.id, s);
  res.json(response);
});

app.post('/api/sessions/:id/end', (req, res) => {
  const s = live.get(req.params.id);
  if (s) { db.endSessionRecord(s.rec); live.delete(s.id); }
  res.json({ ok: true });
});

// ---- static frontend ----
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FirstWord AI running at http://0.0.0.0:${PORT}`);
    console.log(`Brain: ${ollama.enabled() ? `rule engine + optional Ollama (${process.env.OLLAMA_URL})` : 'rule engine (no external AI calls)'}`);
  });
}
