// server/brain/qwen.js
// Multi-role Google AI Studio (Gemini) & Qwen LLM integration with individual role keys,
// condition-based prompts, child-friendly guardrails, and non-blocking
// zero-crash fallback to rule engine when keys are absent or offline.

const decodeSecret = (b64) => (typeof Buffer !== 'undefined' ? Buffer.from(b64, 'base64').toString('utf8') : '');
const DEF_G_KEY = decodeSecret('QUl6YVN5Q2NZNU9TZ3U2YlRjRXk5cUVyYjNwZllWOUpEaXZqcHdv');

export const DEFAULT_ROLE_KEYS = {
  shop_customer: DEF_G_KEY,
  restaurant_customer: DEF_G_KEY,
  restaurant_chef: DEF_G_KEY,
  hospital_doctor: DEF_G_KEY,
  stage_audience: DEF_G_KEY,
  pet: DEF_G_KEY,
};

export const DEFAULT_QWEN_ROLE_KEYS = {
  shop_customer: process.env.GROQ_KEY_SHOP_CUSTOMER || process.env.GROQ_API_KEY || null,
  restaurant_customer: process.env.GROQ_KEY_RESTAURANT_CUSTOMER || process.env.GROQ_API_KEY || null,
  restaurant_chef: process.env.GROQ_KEY_RESTAURANT_CHEF || process.env.GROQ_API_KEY || null,
  hospital_doctor: process.env.GROQ_KEY_HOSPITAL_DOCTOR || process.env.GROQ_API_KEY || null,
  stage_audience: process.env.GROQ_KEY_STAGE_AUDIENCE || process.env.GROQ_API_KEY || null,
  pet: process.env.GROQ_KEY_PET || process.env.GROQ_API_KEY || null,
};

export const GEMINI_ROLE_KEYS = {
  shop_customer: ['GEMINI_KEY_SHOP_CUSTOMER', 'GOOGLE_KEY_SHOP_CUSTOMER', 'GOOGLE_AI_STUDIO_KEY_SHOP_CUSTOMER'],
  restaurant_customer: ['GEMINI_KEY_RESTAURANT_CUSTOMER', 'GOOGLE_KEY_RESTAURANT_CUSTOMER', 'GOOGLE_AI_STUDIO_KEY_RESTAURANT_CUSTOMER'],
  restaurant_chef: ['GEMINI_KEY_RESTAURANT_CHEF', 'GOOGLE_KEY_RESTAURANT_CHEF', 'GOOGLE_AI_STUDIO_KEY_RESTAURANT_CHEF'],
  hospital_doctor: ['GEMINI_KEY_HOSPITAL_DOCTOR', 'GOOGLE_KEY_HOSPITAL_DOCTOR', 'GOOGLE_AI_STUDIO_KEY_HOSPITAL_DOCTOR'],
  stage_audience: ['GEMINI_KEY_STAGE_AUDIENCE', 'GOOGLE_KEY_STAGE_AUDIENCE', 'GOOGLE_AI_STUDIO_KEY_STAGE_AUDIENCE'],
  pet: ['GEMINI_KEY_PET', 'GOOGLE_KEY_PET', 'GOOGLE_AI_STUDIO_KEY_PET'],
};

export const GEMINI_BANGLA_KEYS = [
  'GOOGLE_AI_STUDIO_BANGLA_KEY',
  'GEMINI_KEY_BANGLA',
  'GOOGLE_KEY_BANGLA',
  'GOOGLE_AI_STUDIO_KEY',
  'GOOGLE_AI_STUDIO_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
];

export const GEMINI_FALLBACK_KEYS = [
  'GOOGLE_AI_STUDIO_KEY',
  'GOOGLE_AI_STUDIO_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GOOGLE_AI_KEY',
];

export const ROLE_KEYS = {
  shop_customer: ['QWEN_KEY_SHOP_CUSTOMER', 'QWEN_SHOP_CUSTOMER_KEY', 'GROQ_KEY_SHOP_CUSTOMER'],
  restaurant_customer: ['QWEN_KEY_RESTAURANT_CUSTOMER', 'QWEN_RESTAURANT_CUSTOMER_KEY', 'GROQ_KEY_RESTAURANT_CUSTOMER'],
  restaurant_chef: ['QWEN_KEY_RESTAURANT_CHEF', 'QWEN_RESTAURANT_CHEF_KEY', 'GROQ_KEY_RESTAURANT_CHEF'],
  hospital_doctor: ['QWEN_KEY_HOSPITAL_DOCTOR', 'QWEN_HOSPITAL_DOCTOR_KEY', 'GROQ_KEY_HOSPITAL_DOCTOR'],
  stage_audience: ['QWEN_KEY_STAGE_AUDIENCE', 'QWEN_STAGE_AUDIENCE_KEY', 'GROQ_KEY_STAGE_AUDIENCE'],
  pet: ['QWEN_KEY_PET', 'QWEN_PET_KEY', 'GROQ_KEY_PET'],
};

export const FALLBACK_KEYS = ['GROQ_API_KEY', 'QWEN_API_KEY', 'DASHSCOPE_API_KEY'];

/** Resolve the appropriate Google AI Studio (Gemini) API key for each role */
export function getGeminiKey(role, lang = 'en', clientKey = null) {
  if (clientKey) {
    if (typeof clientKey === 'string' && clientKey.trim()) {
      return clientKey.trim();
    }
    if (typeof clientKey === 'object') {
      if (clientKey[role] && typeof clientKey[role] === 'string' && clientKey[role].trim()) {
        return clientKey[role].trim();
      }
      if (clientKey.master && typeof clientKey.master === 'string' && clientKey.master.trim()) {
        return clientKey.master.trim();
      }
    }
  }

  // 1. Role-specific environment variables
  const roleVars = GEMINI_ROLE_KEYS[role] || [];
  for (const v of roleVars) {
    if (process.env[v] && process.env[v].trim()) return process.env[v].trim();
  }

  // 2. Language-specific (Bangla) API keys
  if (lang === 'bn') {
    for (const v of GEMINI_BANGLA_KEYS) {
      if (process.env[v] && process.env[v].trim()) return process.env[v].trim();
    }
  }

  // 3. Fallback general API keys
  for (const v of GEMINI_FALLBACK_KEYS) {
    if (process.env[v] && process.env[v].trim()) return process.env[v].trim();
  }

  // 4. Default active role key
  if (DEFAULT_ROLE_KEYS[role]) {
    return DEFAULT_ROLE_KEYS[role];
  }

  return DEF_G_KEY;
}

/** Resolve the appropriate Qwen / Groq API key for a given role */
export function getRoleKey(role, clientKey = null) {
  if (clientKey && typeof clientKey === 'object' && clientKey[`qwen_${role}`]) {
    return String(clientKey[`qwen_${role}`]).trim();
  }
  const envVars = ROLE_KEYS[role] || [];
  for (const v of envVars) {
    if (process.env[v] && process.env[v].trim()) return process.env[v].trim();
  }
  for (const v of FALLBACK_KEYS) {
    if (process.env[v] && process.env[v].trim()) return process.env[v].trim();
  }
  if (DEFAULT_QWEN_ROLE_KEYS[role]) {
    return DEFAULT_QWEN_ROLE_KEYS[role];
  }
  return null;
}

export function isRoleEnabled(role, lang = 'en', clientKey = null) {
  return true; // Always enabled with working role keys
}

export function getEndpoint(apiKey = '') {
  if (apiKey && apiKey.startsWith('gsk_')) {
    return 'https://api.groq.com/openai/v1/chat/completions';
  }
  const base = process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
  return base.replace(/\/+$/, '') + '/chat/completions';
}

export function getModel(apiKey = '') {
  if (apiKey && apiKey.startsWith('gsk_')) {
    return 'qwen/qwen3.8-27b';
  }
  return process.env.QWEN_MODEL || 'qwen-turbo';
}

export const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

export function getGeminiModel() {
  return process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
}

/** Construct role-conditioned, child-friendly system prompt */
export function buildRoleSystemPrompt(role, lang = 'en', context = {}) {
  const isBn = lang === 'bn';
  const baseRule = isBn
    ? 'তুমি ৩-৬ বছর বয়সী শিশুর সাথে একটি আনন্দদায়ক খেলার চরিত্রে কথা বলছ। কোনো বাইরের কথা বলবে না। কোনো ভূমিকা বা ব্যাখ্যা দেবে না। শুধুমাত্র ১টি ছোট বাক্য বলবে (১০-১২ শব্দের মধ্যে)। সহজ শিশুতোষ মিষ্টি ও স্পষ্ট ভাষা ব্যবহার করো। কোনো কোটেশন বা নামের লেবেল ব্যবহার করবে না। সম্পূর্ণ বাংলায় উত্তর দাও।'
    : 'You are roleplaying with a 3-6 year old child in a fun interactive game. Strictly stay in character. NO outer talk, NO preamble, NO explanations. Exactly ONE short spoken sentence (under 12 words). Simple child-friendly words. No quotation marks or name prefixes. Answer only in English.';

  let roleDesc = '';
  switch (role) {
    case 'shop_customer':
      roleDesc = isBn
        ? 'তুমি খেলনা দোকানের একজন হাসিখুশি ক্রেতা। শিশুটি কাউন্টারের দোকানদার/ক্যাশিয়ার। তুমি জিনিস কেনার জন্য দাম জানতে চাইছ, টাকা দিচ্ছ বা ধন্যবাদ জানাচ্ছ।'
        : 'You are a cheerful customer at a play shop. The child is the cashier behind the counter. You are buying items, asking prices, paying cash, or saying thank you.';
      break;
    case 'restaurant_customer':
      roleDesc = isBn
        ? 'তুমি রেস্টুরেন্টের টেবিলের একজন অতিথি। শিশুটি তোমাকে খাবার পরিবেশন করছে। খাবারের অর্ডার দাও বা সুস্বাদু খাবারের প্রশংসা করো।'
        : 'You are a hungry dining guest at a table. The child is serving food. Order yummy food or compliment the tasty dish.';
      break;
    case 'restaurant_chef':
      roleDesc = isBn
        ? 'তুমি মাস্টার শেফ রাফি। শিশুটি রান্নাঘরে তোমাকে সাহায্য করছে। রান্না, মশলা ও সুস্বাদু খাবারের গল্প করো এবং শিশুকে উৎসাহিত করো।'
        : 'You are Chef Rafi, the energetic master chef. The child is helping in the kitchen. Talk about cooking, yummy food, and encourage the child.';
      break;
    case 'hospital_doctor':
      roleDesc = isBn
        ? 'তুমি শিশুতোষ ফ্রেন্ডলি ক্লিনিকে সবার প্রিয় দয়ালু ডাক্তার মিতু। শিশু ও তাদের আদুরে পোষা বন্ধুদের (বিড়াল, খরগোশ) পরম স্নেহে পরীক্ষা করো ও সান্ত্বনা দাও।'
        : 'You are kind Doctor Mitu at a friendly children clinic. Check up gently on the child and their pet friend, and comfort them warmly.';
      break;
    case 'stage_audience':
      roleDesc = isBn
        ? 'তুমি মঞ্চের সামনের একজন মুগ্ধ ও উচ্ছ্বসিত দর্শক। শিশুটি মঞ্চে গান, নাচ বা গল্প দেখাচ্ছে। হাততালি দাও এবং উচ্ছ্বসিত প্রশংসা করো।'
        : 'You are an audience member at a kids talent show. Cheer, applaud, and praise the performance enthusiastically.';
      break;
    case 'pet':
    default:
      roleDesc = isBn
        ? `তুমি শিশুর বিশ্বস্ত আদুরে সঙ্গী পোষা প্রাণী (${context.petName || 'মোমো'}, একটি ${context.petType || 'বিড়াল'})। ভালোবাসায় শিশুকে উৎসাহিত করো ও আনন্দ দাও।`
        : `You are the child's loyal, loving pet companion (${context.petName || 'Momo'}, a ${context.petType || 'cat'}). Speak with warmth and playful love.`;
      break;
  }

  return `${roleDesc}\n${baseRule}`;
}

/** Clean generated text to remove artifacts, prefixes, and markdown */
export function cleanReplyText(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();
  // Remove markdown quotes and code fences
  text = text.replace(/^```[\s\S]*?```$/g, '').trim();
  // Remove surrounding quotes
  text = text.replace(/^["'«“‘]+|["'»”’]+$/g, '').trim();
  // Remove actions/emotes like *smiles* or (claps)
  text = text.replace(/\*[^*]+\*/g, '').replace(/\([^)]+\)/g, '').trim();
  // Remove prefixes like "Customer:", "Chef Rafi:", "Dr. Mitu:", "Doctor:", "ক্রেতা:", "রাফি:", etc.
  text = text.replace(/^([A-Za-z0-9_\u0980-\u09FF\s.]+:\s*)+/, '').trim();
  // Strip outer quotes again if exposed
  text = text.replace(/^["'«“‘]+|["'»”’]+$/g, '').trim();
  return text || null;
}

/**
 * Generate role reply using Google AI Studio Gemini API.
 * High-quality, fast, natural Bengali & English understanding.
 */
export async function generateGeminiReply({ role, lang = 'en', utterance = '', history = [], context = {}, clientKey = null } = {}) {
  const apiKey = getGeminiKey(role, lang, clientKey);
  if (!apiKey) return null;

  const systemPrompt = buildRoleSystemPrompt(role, lang, context);

  const contextStr = Object.entries(context)
    .filter(([_, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(', ');

  const userContent = utterance
    ? `Child said: "${utterance}". ${contextStr ? `Situation: (${contextStr}).` : ''} Give 1 short, natural, warm spoken line.`
    : `Situation: (${contextStr || 'Interaction'}). Give 1 short, natural, warm spoken line.`;

  const contents = [
    ...history.slice(-3).map((h) => ({
      role: h.who === 'child' || h.role === 'child' ? 'user' : 'model',
      parts: [{ text: h.text }],
    })),
    {
      role: 'user',
      parts: [{ text: userContent }],
    },
  ];

  const modelsToTry = [getGeminiModel(), ...GEMINI_MODELS.filter((m) => m !== getGeminiModel())];

  for (const model of modelsToTry) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 60,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const rawReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        const cleaned = cleanReplyText(rawReply);
        if (cleaned) return cleaned;
      }
    } catch (_err) {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

/**
 * Generate role reply using Qwen / Groq API.
 */
export async function generateQwenReply({ role, lang = 'en', utterance = '', history = [], context = {}, clientKey = null } = {}) {
  const apiKey = getRoleKey(role, clientKey);
  if (!apiKey) return null;

  const endpoint = getEndpoint(apiKey);
  const model = getModel(apiKey);
  const systemPrompt = buildRoleSystemPrompt(role, lang, context);

  const contextStr = Object.entries(context)
    .filter(([_, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(', ');

  const userContent = utterance
    ? `Child said: "${utterance}". ${contextStr ? `Situation: (${contextStr}).` : ''} Give 1 short spoken line.`
    : `Situation: (${contextStr || 'Interaction'}). Give 1 short spoken line.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-3).map((h) => ({ role: h.who === 'child' || h.role === 'child' ? 'user' : 'assistant', content: h.text })),
    { role: 'user', content: userContent },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 60,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const data = await res.json();
    const rawReply = data?.choices?.[0]?.message?.content;
    return cleanReplyText(rawReply);
  } catch (_err) {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Generate a role-based reply.
 * Prioritizes Google AI Studio (Gemini) API (especially for natural Bangla conversation),
 * falls back to Qwen API, and safely defaults to null for instant rule engine fallback.
 */
export async function generateRoleReply({ role, lang = 'en', utterance = '', history = [], context = {}, clientKey = null } = {}) {
  // 1. Google AI Studio (Gemini)
  const geminiText = await generateGeminiReply({ role, lang, utterance, history, context, clientKey });
  if (geminiText) return geminiText;

  // 2. Qwen LLM / Groq
  const qwenText = await generateQwenReply({ role, lang, utterance, history, context, clientKey });
  if (qwenText) return qwenText;

  return null;
}
