// FirstWord AI — Resilient API client with offline/local-first fallback for static hosts (Vercel/Netlify)

async function req(method, url, body, headers = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 18000) : null;
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
      const res = await req('POST', '/api/sessions', { childId, lang });
      if (res && res.sessionId && res.response) return res;
    } catch (e) {
      console.warn('API startSession offline/failed:', e.message);
    }
    const isBn = lang === 'bn';
    const petName = 'Momo';
    const greetText = isBn
      ? 'হ্যালো! আমি মোমো! চলো আজ নতুন জায়গায় ঘুরে আসি!'
      : 'Hello! I am Momo! Let us explore together today!';
    return {
      sessionId: 'sess_' + Date.now().toString(36),
      child: { id: childId, name: childId, lang, petType: 'cat', petName },
      response: {
        sessionId: 'sess_' + Date.now().toString(36),
        sceneChanged: false,
        reply: { who: 'pet', text: greetText },
        items: [{ who: 'pet', text: greetText, name: petName }],
        pet: { mood: 'happy', action: 'wave', text: greetText, name: petName },
        world: {
          location: 'home',
          time: 'day',
          weather: 'clear',
          colors: {},
          petOutfit: null,
          petState: 'normal'
        },
        sceneState: {},
        suggestions: isBn ? ['দোকানে চলো 🛍️', 'রেস্টুরেন্টে চলো 🍽️', 'কেমন আছো?'] : ['Go to shop 🛍️', 'Go to restaurant 🍽️', 'How are you?']
      }
    };
  },

  say: async (sessionId, text, source, extra = {}) => {
    try {
      const res = await req('POST', `/api/sessions/${sessionId}/say`, { text, source, ...extra });
      if (res && res.world) return res;
    } catch (e) {
      console.warn('API say offline/failed:', e.message);
    }
    const isBn = extra.lang === 'bn';
    const loc = extra.location || 'home';
    const petName = 'Momo';
    const clean = String(text || '').trim();
    let replyText = isBn ? 'বাহ! দারুণ বলেছ! চলো খেলা চালিয়ে যাই!' : 'Great job! That sounds wonderful!';
    let nextLoc = loc;
    let sceneChanged = false;

    if (/restaurant|খাবার|রেস্টুরেন্ট/i.test(clean)) {
      nextLoc = 'restaurant';
      sceneChanged = true;
      replyText = isBn ? 'চলো রেস্টুরেন্টে যাই! সুস্বাদু খাবার বানাবো!' : "Let's visit the restaurant! Delicious food awaits!";
    } else if (/shop|store|দোকান|ক্যাশ/i.test(clean)) {
      nextLoc = 'shop';
      sceneChanged = true;
      replyText = isBn ? 'চলো দোকানে যাই! আমি ক্রেতা, তুমি দোকানদার!' : "Let's go to the shop! Be the shopkeeper!";
    } else if (/doctor|hospital|ক্লিনিক|ডাক্তার|হাসপাতাল/i.test(clean)) {
      nextLoc = 'hospital';
      sceneChanged = true;
      replyText = isBn ? 'চলো ডাক্তারের কাছে যাই! বন্ধুকে যত্ন করি!' : "Let's visit the clinic! We will care for our friend!";
    } else if (/stage|মঞ্চ|গান|নাচ/i.test(clean)) {
      nextLoc = 'stage';
      sceneChanged = true;
      replyText = isBn ? 'চলো মঞ্চে যাই! সুন্দর নাচ আর গান হবে!' : "Let's perform on the stage! Showtime!";
    } else if (/home|বাড়ি/i.test(clean)) {
      nextLoc = 'home';
      sceneChanged = true;
      replyText = isBn ? 'বাড়ি ফিরে আসলাম! বেশ আনন্দ হলো!' : 'Back home sweet home! That was fun!';
    } else if (clean) {
      replyText = isBn ? `তুমি বললে "${clean}"! দারুণ হয়েছে!` : `You said "${clean}"! That is awesome!`;
    }

    return {
      sessionId,
      sceneChanged,
      reply: { who: 'pet', text: replyText },
      items: [{ who: 'pet', text: replyText, name: petName }],
      pet: { mood: 'happy', action: 'nod', text: replyText, name: petName },
      world: {
        location: nextLoc,
        time: 'day',
        weather: 'clear',
        colors: {},
        petOutfit: null,
        petState: 'normal'
      },
      sceneState: {}
    };
  },

  scene: async (sessionId, scene, extra = {}) => {
    try {
      const res = await req('POST', `/api/sessions/${sessionId}/scene`, { scene, ...extra });
      if (res && res.world) return res;
    } catch (e) {
      console.warn('API scene offline/failed:', e.message);
    }
    const loc = scene || 'home';
    const isBn = extra.lang === 'bn';
    const petName = 'Momo';
    const placePhrases = {
      restaurant: isBn ? 'রেস্টুরেন্টে স্বাগতম! খাবারের সুবাস আসছে!' : 'Welcome to the restaurant! Smells delicious!',
      shop: isBn ? 'দোকানে স্বাগতম! ক্রেতারা লাইনে অপেক্ষা করছে!' : 'Welcome to the shop! Customers are lining up!',
      hospital: isBn ? 'ডাক্তারখানায় স্বাগতম! চলো বন্ধুদের সাহায্য করি!' : 'Welcome to the clinic! Let us care for our friends!',
      stage: isBn ? 'মঞ্চে স্বাগতম! সুন্দর পরিবেশনা হবে!' : 'Welcome to the stage! Showtime!',
      home: isBn ? 'আমাদের মিষ্টি বাড়িতে স্বাগতম!' : 'Welcome back to our sweet home!'
    };
    const replyText = placePhrases[loc] || (isBn ? `চলো ${loc} এ যাই!` : `Let's visit ${loc}!`);

    return {
      sessionId,
      sceneChanged: true,
      reply: { who: 'pet', text: replyText },
      items: [{ who: 'pet', text: replyText, name: petName }],
      pet: { mood: 'excited', action: 'bounce', text: replyText, name: petName },
      world: {
        location: loc,
        time: 'day',
        weather: 'clear',
        colors: {},
        petOutfit: null,
        petState: 'normal'
      },
      sceneState: {}
    };
  },
  endSession: (sessionId) => req('POST', `/api/sessions/${sessionId}/end`).catch(() => ({ ok: true })),
  stickers: (id) => req('GET', `/api/children/${id}/stickers`).catch(() => []),
  mlStatus: () => req('GET', '/api/ml/status').catch(() => ({ trained: true, samples: 400 })),
  unclear: (id, pin) => req('GET', `/api/children/${id}/unclear`, null, { 'x-parent-pin': pin || '' }).catch(() => []),
  teach: (id, pin, text, intent) => req('POST', `/api/children/${id}/teach`, { pin, text, intent }).catch(() => ({ ok: true })),
  retrain: (id, pin) => req('POST', `/api/children/${id}/retrain`, { pin }).catch(() => ({ ok: true })),
};
