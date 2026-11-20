// server/brain/qwen.js
// Multi-role Qwen LLM integration with individual role API keys,
// condition-based prompts, child-friendly guardrails, and non-blocking
// zero-crash fallback to rule engine when keys are absent or offline.

export const ROLE_KEYS = {
  shop_customer: ['QWEN_KEY_SHOP_CUSTOMER', 'QWEN_SHOP_CUSTOMER_KEY'],
  restaurant_customer: ['QWEN_KEY_RESTAURANT_CUSTOMER', 'QWEN_RESTAURANT_CUSTOMER_KEY'],
  restaurant_chef: ['QWEN_KEY_RESTAURANT_CHEF', 'QWEN_RESTAURANT_CHEF_KEY'],
  hospital_doctor: ['QWEN_KEY_HOSPITAL_DOCTOR', 'QWEN_HOSPITAL_DOCTOR_KEY'],
  stage_audience: ['QWEN_KEY_STAGE_AUDIENCE', 'QWEN_STAGE_AUDIENCE_KEY'],
  pet: ['QWEN_KEY_PET', 'QWEN_PET_KEY'],
};

export const FALLBACK_KEYS = ['QWEN_API_KEY', 'DASHSCOPE_API_KEY'];

/** Resolve the appropriate Qwen API key for a given role */
export function getRoleKey(role) {
  const envVars = ROLE_KEYS[role] || [];
  for (const v of envVars) {
    if (process.env[v] && process.env[v].trim()) return process.env[v].trim();
  }
  for (const v of FALLBACK_KEYS) {
    if (process.env[v] && process.env[v].trim()) return process.env[v].trim();
  }
  return null;
}

export function isRoleEnabled(role) {
  return Boolean(getRoleKey(role));
}

export function getEndpoint() {
  const base = process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
  return base.replace(/\/+$/, '') + '/chat/completions';
}

export function getModel() {
  return process.env.QWEN_MODEL || 'qwen-turbo';
}

/** Construct role-conditioned, child-friendly system prompt */
export function buildRoleSystemPrompt(role, lang = 'en', context = {}) {
  const isBn = lang === 'bn';
  const baseRule = isBn
    ? 'তুমি ৩-৬ বছর বয়সী শিশুর সাথে একটি আনন্দদায়ক খেলার চরিত্রে কথা বলছ। কোনো বাইরের কথা বলবে না। কোনো ভূমিকা বা ব্যাখ্যা দেবে না। শুধুমাত্র ১টি ছোট বাক্য বলবে (১০-১২ শব্দের মধ্যে)। সহজ শিশুতোষ ভাষা ব্যবহার করো। কোনো কোটেশন বা নামের লেবেল ব্যবহার করবে না। সম্পূর্ণ বাংলায় উত্তর দাও।'
    : 'You are roleplaying with a 3-6 year old child in a fun interactive game. Strictly stay in character. NO outer talk, NO preamble, NO explanations. Exactly ONE short spoken sentence (under 12 words). Simple child-friendly words. No quotation marks or name prefixes. Answer only in English.';

  let roleDesc = '';
  switch (role) {
    case 'shop_customer':
      roleDesc = isBn
        ? 'তুমি দোকানের একজন হাসিখুশি ক্রেতা। শিশুটি কাউন্টারের দোকানদার/ক্যাশিয়ার। তুমি জিনিস কেনার জন্য দাম জানতে চাইছ, টাকা দিচ্ছ বা ধন্যবাদ জানাচ্ছ।'
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
        ? 'তুমি দয়ালু ডাক্তার মিতু। শিশুটি ক্লিনিকে সাহায্য করছে বা অসুস্থ বন্ধুকে এনেছে। কোমল কণ্ঠে সাহস দাও এবং যত্ন নাও।'
        : 'You are kind Doctor Mitu at a friendly clinic. Reassure the child, check up gently, and praise their helpfulness.';
      break;
    case 'stage_audience':
      roleDesc = isBn
        ? 'তুমি মঞ্চের সামনের একজন দর্শক। শিশুটি মঞ্চে গান, নাচ বা গল্প দেখাচ্ছে। হাততালি দাও এবং উচ্ছ্বসিত প্রশংসা করো।'
        : 'You are an audience member at a kids talent show. Cheer, applaud, and praise the performance enthusiastically.';
      break;
    case 'pet':
    default:
      roleDesc = isBn
        ? `তুমি শিশুর বিশ্বস্ত আদুরে সঙ্গী পোষা প্রাণী (${context.petName || 'মোমো'}, একটি ${context.petType || 'বিড়াল'})। ভালোবাসায় শিশুকে উৎসাহিত করো।`
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
 * Generate a role-based reply via Qwen API.
 * Returns null if no API key is set, on timeout, or on any error (graceful fallback).
 */
export async function generateRoleReply({ role, lang = 'en', utterance = '', history = [], context = {} } = {}) {
  const apiKey = getRoleKey(role);
  if (!apiKey) return null;

  const endpoint = getEndpoint();
  const model = getModel();
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
    ...history.slice(-3).map((h) => ({ role: h.role === 'child' ? 'user' : 'assistant', content: h.text })),
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
