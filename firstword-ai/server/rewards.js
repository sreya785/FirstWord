// Stickers: collectible rewards that can only be gained, never lost. No scores, no failure.
export const STICKERS = {
  first_words: { emoji: '🗣️', en: 'First words', bn: 'প্রথম কথা', hint_en: 'Said something to the pet', hint_bn: 'বন্ধুকে কিছু বলেছে' },
  chatterbox: { emoji: '💬', en: 'Chatterbox', bn: 'কথার ঝুড়ি', hint_en: 'Said 20 things', hint_bn: '২০টা কথা বলেছে' },
  long_sentence: { emoji: '📏', en: 'Long sentence', bn: 'লম্বা বাক্য', hint_en: 'Said a sentence with 6+ words', hint_bn: '৬+ শব্দের বাক্য বলেছে' },
  question_asker: { emoji: '❓', en: 'Curious mind', bn: 'কৌতূহলী', hint_en: 'Asked a question', hint_bn: 'একটা প্রশ্ন করেছে' },
  builder: { emoji: '🏗️', en: 'Builder', bn: 'নির্মাতা', hint_en: 'Made something appear', hint_bn: 'কিছু বানিয়েছে' },
  painter: { emoji: '🎨', en: 'Painter', bn: 'রংবাজ', hint_en: 'Changed a colour', hint_bn: 'রং বদলেছে' },
  weather_wizard: { emoji: '🌦️', en: 'Weather wizard', bn: 'আবহাওয়া জাদুকর', hint_en: 'Changed the weather or time', hint_bn: 'আবহাওয়া বা সময় বদলেছে' },
  friend_maker: { emoji: '🤝', en: 'Friend maker', bn: 'বন্ধু বানানো', hint_en: 'Met a new character', hint_bn: 'নতুন চরিত্রের সাথে পরিচয়' },
  zoo_keeper: { emoji: '🐾', en: 'Animal friend', bn: 'প্রাণীবন্ধু', hint_en: 'Met 5 different animals', hint_bn: '৫টা ভিন্ন প্রাণীর সাথে দেখা' },
  foodie: { emoji: '🍕', en: 'Foodie', bn: 'ভোজনরসিক', hint_en: 'Ordered food in the restaurant', hint_bn: 'রেস্টুরেন্টে খাবার অর্ডার' },
  shopper: { emoji: '🛍️', en: 'Smart shopper', bn: 'চালাক ক্রেতা', hint_en: 'Bought something in the shop', hint_bn: 'দোকানে কিছু কিনেছে' },
  price_checker: { emoji: '🏷️', en: 'Price checker', bn: 'দাম জিজ্ঞাসু', hint_en: 'Asked how much something costs', hint_bn: 'দাম জিজ্ঞেস করেছে' },
  brave_patient: { emoji: '🩹', en: 'Brave visitor', bn: 'সাহসী', hint_en: 'Visited the doctor', hint_bn: 'ডাক্তারের কাছে গেছে' },
  healer: { emoji: '💖', en: 'Kind healer', bn: 'দয়ালু', hint_en: 'Helped the pet feel better', hint_bn: 'বন্ধুকে সুস্থ করতে সাহায্য' },
  rescuer: { emoji: '🦸', en: 'Rescuer', bn: 'উদ্ধারকারী', hint_en: 'Solved an emergency', hint_bn: 'একটা বিপদ সামলেছে' },
  caller: { emoji: '📞', en: 'Help caller', bn: 'সাহায্য ডাকা', hint_en: 'Called someone for help', hint_bn: 'সাহায্যের জন্য কাউকে ডেকেছে' },
  star: { emoji: '⭐', en: 'Star performer', bn: 'তারকা', hint_en: 'Performed on stage', hint_bn: 'মঞ্চে পারফর্ম করেছে' },
  superstar: { emoji: '🌟', en: 'Superstar', bn: 'সুপারস্টার', hint_en: 'Finished a whole show', hint_bn: 'পুরো শো শেষ করেছে' },
  pretend_player: { emoji: '🎭', en: 'Pretend player', bn: 'সাজার খেলা', hint_en: 'Played a role', hint_bn: 'ভূমিকায় অভিনয় করেছে' },
  party_animal: { emoji: '🎉', en: 'Party time', bn: 'পার্টি', hint_en: 'Celebrated with confetti', hint_bn: 'কনফেত্তি দিয়ে উদযাপন' },
  kind_heart: { emoji: '🫶', en: 'Kind heart', bn: 'দয়ালু মন', hint_en: 'Said something kind', hint_bn: 'সুন্দর কিছু বলেছে' },
  explorer: { emoji: '🧭', en: 'Explorer', bn: 'অভিযাত্রী', hint_en: 'Visited 3 different places', hint_bn: '৩টা ভিন্ন জায়গায় গেছে' },
  world_traveller: { emoji: '🌍', en: 'World traveller', bn: 'বিশ্বভ্রমণকারী', hint_en: 'Visited 8 different places', hint_bn: '৮টা ভিন্ন জায়গায় গেছে' },
  bilingual: { emoji: '🗺️', en: 'Two languages', bn: 'দুই ভাষা', hint_en: 'Played in both Bangla and English', hint_bn: 'বাংলা ও ইংরেজি দুটোতেই খেলেছে' },
  comeback: { emoji: '🔁', en: 'Came back', bn: 'ফিরে এসেছে', hint_en: 'Played on 3 different days', hint_bn: '৩ দিন খেলেছে' },
};

const ANIMALS = new Set(['cat', 'dog', 'bird', 'owl', 'whale', 'octopus', 'turtle', 'elephant', 'lion', 'tiger', 'monkey', 'rabbit', 'cow', 'goat', 'horse', 'duck', 'chicken', 'frog', 'penguin', 'bear', 'fox', 'deer', 'giraffe', 'snake', 'crocodile', 'dinosaur', 'dragon', 'unicorn', 'fish', 'butterfly', 'bee']);

/**
 * Decide which stickers a turn unlocks. `progress` is persisted on the child record.
 * Returns an array of { id, emoji, label, hint } for NEW stickers only.
 */
export function checkRewards(child, response, rec, { text, source } = {}) {
  const lang = child.lang === 'bn' ? 'bn' : 'en';
  child.stickers = child.stickers || [];
  child.progress = child.progress || { animals: [], places: [], langs: [], days: [], utterances: 0 };
  const P = child.progress;
  const have = new Set(child.stickers.map((s) => s.id));
  const unlocked = [];
  const give = (id) => { if (!STICKERS[id] || have.has(id)) return; have.add(id); child.stickers.push({ id, at: new Date().toISOString() }); unlocked.push(id); };

  const m = response.metrics || {};
  const intent = response.intent || '';
  const events = response.events || [];
  const scene = response.scene;
  const loc = response.world?.location;
  const today = new Date().toISOString().slice(0, 10);
  if (!P.days.includes(today)) P.days.push(today);
  if (!P.langs.includes(lang)) P.langs.push(lang);
  if (loc && !P.places.includes(loc)) P.places.push(loc);
  for (const c of response.world?.characters || []) if (ANIMALS.has(c.key) && !P.animals.includes(c.key)) P.animals.push(c.key);

  if (m.wordCount > 0 && source !== 'silence') { P.utterances++; give('first_words'); }
  if (P.utterances >= 20) give('chatterbox');
  if (m.wordCount >= 6) give('long_sentence');
  if (m.isQuestion) give('question_asker');
  if (intent === 'build' || intent.startsWith('transform_')) give('builder');
  if (intent === 'color') give('painter');
  if (intent === 'weather' || intent === 'time') give('weather_wizard');
  if ((response.world?.characters || []).some((c) => c.isNew && c.role !== 'audience' && !['waiter', 'shopkeeper', 'doctor'].includes(c.key))) give('friend_maker');
  if (P.animals.length >= 5) give('zoo_keeper');
  if (scene === 'restaurant' && intent === 'restaurant' && (response.skills || []).includes('requesting')) give('foodie');
  if (scene === 'shop' && (response.skills || []).includes('requesting') && /\b(buy|take|cart|bought|paid)\b/i.test(response.pet?.text || '')) give('shopper');
  if (scene === 'shop' && /how much|price|দাম|কত টাকা/i.test(text || '')) give('price_checker');
  if (scene === 'hospital') give('brave_patient');
  if (events.includes('heal')) give('healer');
  if (scene === 'emergency' && events.includes('phone')) give('caller');
  if (scene === 'emergency' && (events.includes('confetti') || events.includes('hearts')) && /\b(solved|safe|better|found|thank you|rescued|hooray)\b|ঠিক|পেয়েছি|ধন্যবাদ/i.test(response.pet?.text || '')) give('rescuer');
  if (scene === 'stage' && (events.includes('applause') || events.includes('applause_soft'))) give('star');
  if (scene === 'stage' && events.includes('confetti')) give('superstar');
  if (intent === 'role_assign' || intent === 'in_role') give('pretend_player');
  if (events.includes('confetti')) give('party_animal');
  if ((response.skills || []).includes('helping_others') || intent === 'ml_praise' || /\b(i love you|best friend|good job)\b|ভালোবাসি|সেরা বন্ধু/i.test(text || '')) give('kind_heart');
  if (P.places.length >= 3) give('explorer');
  if (P.places.length >= 8) give('world_traveller');
  if (P.langs.length >= 2) give('bilingual');
  if (P.days.length >= 3) give('comeback');

  return unlocked.map((id) => ({ id, emoji: STICKERS[id].emoji, label: STICKERS[id][lang], hint: STICKERS[id][`hint_${lang}`] }));
}

export function stickerList(child) {
  const lang = child.lang === 'bn' ? 'bn' : 'en';
  const have = new Map((child.stickers || []).map((s) => [s.id, s.at]));
  return Object.entries(STICKERS).map(([id, s]) => ({ id, emoji: s.emoji, label: s[lang], hint: s[`hint_${lang}`], unlocked: have.has(id), at: have.get(id) || null }));
}
