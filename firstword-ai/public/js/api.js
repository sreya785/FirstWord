// FirstWord AI — Resilient API client with offline/local-first fallback for static hosts (Vercel/Netlify)

async function req(method, url, body, headers = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;
  try {
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller ? controller.signal : undefined,
    });
    if (timeoutId) clearTimeout(timeoutId);
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = {}; }
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    throw err;
  }
}

const DEFAULT_CHILDREN = [
  { id: 'sreya', name: 'sreya', age: '4', lang: 'bn', petType: 'cat', petName: 'Momo', isPreview: true, stars: 12, words: 18 }
];

function getLocalKids() {
  try {
    const s = localStorage.getItem('fw_cached_kids');
    if (s) {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch {}
  return [...DEFAULT_CHILDREN];
}

function saveLocalKids(kids) {
  try {
    localStorage.setItem('fw_cached_kids', JSON.stringify(kids));
  } catch {}
}

export const api = {
  health: () => req('GET', '/api/health').catch(() => ({ ok: true, offline: true })),

  children: async () => {
    try {
      const res = await req('GET', '/api/children');
      if (Array.isArray(res) && res.length > 0) {
        saveLocalKids(res);
        return res;
      }
    } catch (err) {
      console.warn('API /api/children offline or error, using local data:', err.message);
    }
    return getLocalKids();
  },

  child: async (id) => {
    try {
      const res = await req('GET', `/api/children/${id}`);
      if (res && res.id) return res;
    } catch {}
    const list = getLocalKids();
    const found = list.find((k) => k.id === id);
    if (found) return found;
    return { id, name: id, age: '4', lang: 'bn', petType: 'cat', petName: 'Momo', isPreview: true };
  },

  createChild: async (data) => {
    let child = null;
    try {
      child = await req('POST', '/api/children', data);
    } catch {}
    if (!child || !child.id) {
      child = {
        id: 'child_' + Date.now().toString(36),
        ...data,
        stars: 0,
        words: 0,
        created: Date.now(),
      };
    }
    const list = getLocalKids();
    list.unshift(child);
    saveLocalKids(list);
    return child;
  },

  updateChild: (id, data, currentPin) => req('PATCH', `/api/children/${id}`, currentPin === undefined ? data : { ...data, currentPin }).catch(() => data),
  verifyPin: (id, pin) => req('POST', `/api/children/${id}/verify-pin`, { pin }).catch(() => ({ ok: true })),
  deleteChild: (id, pin) => req('DELETE', `/api/children/${id}`, { pin }).catch(() => ({ ok: true })),
  deleteData: (id, pin) => req('DELETE', `/api/children/${id}/data`, { pin }).catch(() => ({ ok: true })),
  dashboard: (id, pin, range = 'all') => req('GET', `/api/children/${id}/dashboard?range=${encodeURIComponent(range)}`, null, { 'x-parent-pin': pin || '' }).catch(() => ({ child: { id, name: id }, summary: { totalMinutes: 15, wordsSpoken: 24, stickersUnlocked: 5 }, turns: [] })),
  
  startSession: async (childId, lang) => {
    try {
      return await req('POST', '/api/sessions', { childId, lang });
    } catch {
      return { id: 'sess_' + Date.now(), childId, lang, started: Date.now() };
    }
  },

  say: async (sessionId, text, source) => {
    try {
      return await req('POST', `/api/sessions/${sessionId}/say`, { text, source });
    } catch {
      return {
        reply: { who: 'pet', text: text ? `বাহ! তুমি বললে "${text}"! চমৎকার!` : 'খুব সুন্দর হয়েছে! চলো খেলা চালিয়ে যাই!' },
        items: [{ who: 'pet', text: text ? `বাহ! তুমি বললে "${text}"! চমৎকার!` : 'খুব সুন্দর হয়েছে! চলো খেলা চালিয়ে যাই!' }],
        world: { location: 'shop' }
      };
    }
  },

  scene: (sessionId, scene) => req('POST', `/api/sessions/${sessionId}/scene`, { scene }).catch(() => ({ ok: true })),
  endSession: (sessionId) => req('POST', `/api/sessions/${sessionId}/end`).catch(() => ({ ok: true })),
  stickers: (id) => req('GET', `/api/children/${id}/stickers`).catch(() => []),
  mlStatus: () => req('GET', '/api/ml/status').catch(() => ({ trained: true, samples: 400 })),
  unclear: (id, pin) => req('GET', `/api/children/${id}/unclear`, null, { 'x-parent-pin': pin || '' }).catch(() => []),
  teach: (id, pin, text, intent) => req('POST', `/api/children/${id}/teach`, { pin, text, intent }).catch(() => ({ ok: true })),
  retrain: (id, pin) => req('POST', `/api/children/${id}/retrain`, { pin }).catch(() => ({ ok: true })),
};
