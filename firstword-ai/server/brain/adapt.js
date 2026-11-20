// Adaptive layer: measures how the child communicates and adjusts support.
import { isQuestion, isNegative, politeness } from './normalize.js';

export const SKILLS = {
  requesting: { label: 'Asking for things', bn: 'কিছু চাওয়া' },
  asking_questions: { label: 'Asking questions', bn: 'প্রশ্ন করা' },
  describing: { label: 'Describing', bn: 'বর্ণনা করা' },
  expressing_preference: { label: 'Expressing likes & dislikes', bn: 'পছন্দ-অপছন্দ বলা' },
  changing_mind: { label: 'Changing their mind politely', bn: 'মত বদলানো' },
  giving_instructions: { label: 'Giving instructions', bn: 'নির্দেশ দেওয়া' },
  helping_others: { label: 'Helping & reassuring', bn: 'সাহায্য করা' },
  storytelling: { label: 'Storytelling & longer talk', bn: 'গল্প বলা' },
  greeting_politeness: { label: 'Greetings & politeness', bn: 'শুভেচ্ছা ও ভদ্রতা' },
  role_play: { label: 'Role play', bn: 'ভূমিকা পালন' },
  world_building: { label: 'Imagining & creating', bn: 'কল্পনা ও সৃষ্টি' },
  expressing_feelings: { label: 'Talking about feelings', bn: 'অনুভূতি প্রকাশ' },
  answering: { label: 'Answering questions', bn: 'প্রশ্নের উত্তর দেওয়া' },
};

/** Basic metrics for one utterance */
export function measure(n) {
  const words = n.tokens.filter((t) => t !== '?' && t !== '.');
  const wordCount = n.isBangla ? n.raw.trim().split(/\s+/).filter(Boolean).length : words.length;
  const p = politeness(n);
  return {
    wordCount,
    uniqueWords: new Set(words).size,
    isQuestion: isQuestion(n),
    isNegative: isNegative(n),
    polite: p.please || p.thanks || p.sorry,
    hasStoryMarker: /\b(once upon a time|one day|and then|after that|suddenly|the end|long ago)\b/.test(n.norm),
    hasBecause: /\b(because|so that|that is why)\b/.test(n.norm),
    hasDescriptor: /\b(big|small|red|blue|green|yellow|pink|purple|orange|black|white|tall|short|soft|hard|hot|cold|sweet|spicy|fast|slow|happy|sad|beautiful|pretty|ugly|old|new|long|round|loud|quiet|shiny|fluffy)\b/.test(n.norm),
  };
}

/** Estimate the child's current expressive level from recent utterances (1..4) */
export function estimateLevel(recentMetrics) {
  const m = recentMetrics.filter((x) => x && x.wordCount > 0).slice(-12);
  if (!m.length) return 2;
  const avg = m.reduce((a, b) => a + b.wordCount, 0) / m.length;
  const max = Math.max(...m.map((x) => x.wordCount));
  if (avg <= 1.6 && max <= 3) return 1; // single words
  if (avg <= 3.5) return 2; // short phrases
  if (avg <= 7) return 3; // sentences
  return 4; // storyteller
}

export const LEVEL_LABELS = {
  1: { en: 'single words', bn: 'একটি শব্দ' },
  2: { en: 'short phrases', bn: 'ছোট বাক্যাংশ' },
  3: { en: 'full sentences', bn: 'পূর্ণ বাক্য' },
  4: { en: 'longer stories', bn: 'লম্বা গল্প' },
};

/** Quick-phrase suggestions by scene and level (en/bn). */
const SUGG = {
  en: {
    home: {
      1: ['Play', 'Restaurant', 'Shop', 'Dance', 'Outside'],
      2: ['Let us play', 'Go to the shop', 'Make a dragon', 'I want to cook', 'Dance with me'],
      3: ['Let us go to the restaurant', 'Make the room blue', 'Can you tell me a story?', 'I want to build a house by the sea', 'Now you are the shopkeeper'],
    },
    restaurant: {
      1: ['Rice', 'Chicken', 'Noodles', 'Juice', 'Cake'],
      2: ['I want rice', 'Chicken please', 'No, noodles', 'What do you want?', 'Where is my juice?'],
      3: ['I want rice and chicken, please', 'Actually, I want noodles instead', 'What would you like to eat?', 'Excuse me, my drink is missing', 'Can we sit by the window?'],
    },
    shop: {
      1: ['Bag', 'Ball', 'Red', 'Blue one', 'How much?'],
      2: ['I want the red bag', 'How much is it?', 'Show me blue one', 'Another one please', 'I will buy it'],
      3: ['I want the red bag, please', 'How much is this one?', 'Can I see the blue one?', 'No, I do not like this. Show me another one', 'I want to buy a gift for my friend'],
    },
    hospital: {
      1: ['Stomach', 'Head hurts', 'Help', 'Medicine', 'Better?'],
      2: ['Stomach ache', 'My pet is sick', 'Can you help?', 'Since yesterday', 'What now?'],
      3: ['My pet has a stomachache', 'It is not feeling well since yesterday', 'Can you help my pet, please?', 'It ate too much cake', 'What should we do now?'],
    },
    stage: {
      1: ['Story', 'Song', 'Cat', 'The end', 'Clap'],
      2: ['I will tell a story', 'This is my pet', 'Once upon a time', 'And then...', 'The end!'],
      3: ['Today I will tell you a story about a cat', 'Let me introduce my friend', 'Once upon a time there was a dragon', 'And then something funny happened', 'Thank you, everyone!'],
    },
    emergency: {
      1: ['Help', 'Call', 'Wait', 'Ladder', 'Hospital'],
      2: ['I will help', 'Do not worry', 'Call mom', 'Wait here', 'Go to hospital'],
      3: ['Do not worry, I will help you', 'We need to call someone', 'Wait here, I will find help', 'Let us go to the hospital', 'Let us look for a ladder'],
    },
    create: {
      1: ['House', 'Dragon', 'Tree', 'Rain', 'Night'],
      2: ['Make a house', 'A dragon comes', 'Make it night', 'Add flowers', 'We are astronauts'],
      3: ['Let us build a house beside the sea', 'Make a school for animals', 'Now we are astronauts', 'I want a dragon to come and visit us', 'You are the shopkeeper and I am the customer'],
    },
    generic: {
      1: ['Yes', 'No', 'More', 'Again', 'Home'],
      2: ['Go home', 'Make it blue', 'Let us play', 'I am happy', 'Tell a story'],
      3: ['Let us go home', 'Make the sky purple', 'What do you like to do?', 'I want to go somewhere new', 'Tell me a story'],
    },
  },
  bn: {
    home: {
      1: ['খেলি', 'রেস্টুরেন্ট', 'দোকান', 'নাচ', 'বাইরে'],
      2: ['চলো খেলি', 'দোকানে যাই', 'একটা ড্রাগন বানাও', 'আমি রান্না করতে চাই', 'আমার সাথে নাচো'],
      3: ['চলো রেস্টুরেন্টে যাই', 'ঘরটা নীল করো', 'আমাকে একটা গল্প বলবে?', 'আমি সমুদ্রের পাশে একটা বাড়ি বানাতে চাই', 'এখন তুমি দোকানদার'],
    },
    restaurant: {
      1: ['ভাত', 'মুরগি', 'নুডলস', 'জুস', 'কেক'],
      2: ['আমি ভাত চাই', 'মুরগি দাও', 'না, নুডলস', 'তুমি কী চাও?', 'আমার জুস কোথায়?'],
      3: ['আমি ভাত আর মুরগি চাই', 'আসলে আমি নুডলস চাই', 'তুমি কী খেতে চাও?', 'আমার জুস আসেনি', 'জানালার পাশে বসি?'],
    },
    shop: {
      1: ['ব্যাগ', 'বল', 'লাল', 'নীলটা', 'কত দাম?'],
      2: ['আমি লাল ব্যাগ চাই', 'দাম কত?', 'নীলটা দেখাও', 'আরেকটা দেখাও', 'আমি কিনব'],
      3: ['আমি লাল ব্যাগটা চাই', 'এটার দাম কত?', 'নীলটা দেখাবেন?', 'না, এটা পছন্দ না। আরেকটা দেখান', 'আমি আমার বন্ধুর জন্য উপহার কিনতে চাই'],
    },
    hospital: {
      1: ['পেট', 'মাথা ব্যথা', 'সাহায্য', 'ওষুধ', 'ভালো?'],
      2: ['পেট ব্যথা', 'আমার বন্ধু অসুস্থ', 'সাহায্য করবেন?', 'কাল থেকে', 'এখন কী?'],
      3: ['আমার বন্ধুর পেট ব্যথা', 'কাল থেকে ওর ভালো লাগছে না', 'আমার বন্ধুকে সাহায্য করবেন?', 'ও অনেক কেক খেয়েছে', 'এখন আমরা কী করব?'],
    },
    stage: {
      1: ['গল্প', 'গান', 'বিড়াল', 'শেষ', 'হাততালি'],
      2: ['আমি গল্প বলব', 'এটা আমার বন্ধু', 'এক দেশে ছিল', 'তারপর...', 'শেষ!'],
      3: ['আজ আমি একটা বিড়ালের গল্প বলব', 'আমার বন্ধুর পরিচয় দিই', 'এক দেশে ছিল এক ড্রাগন', 'তারপর মজার একটা ঘটনা ঘটল', 'ধন্যবাদ সবাইকে!'],
    },
    emergency: {
      1: ['সাহায্য', 'ফোন', 'অপেক্ষা', 'মই', 'হাসপাতাল'],
      2: ['আমি সাহায্য করব', 'চিন্তা করো না', 'মাকে ফোন করি', 'এখানে থাকো', 'হাসপাতালে যাই'],
      3: ['চিন্তা করো না, আমি সাহায্য করব', 'আমাদের কাউকে ফোন করতে হবে', 'এখানে থাকো, আমি সাহায্য খুঁজে আনি', 'চলো হাসপাতালে যাই', 'চলো একটা মই খুঁজি'],
    },
    create: {
      1: ['বাড়ি', 'ড্রাগন', 'গাছ', 'বৃষ্টি', 'রাত'],
      2: ['একটা বাড়ি বানাও', 'একটা ড্রাগন আসুক', 'রাত করো', 'ফুল যোগ করো', 'আমরা মহাকাশচারী'],
      3: ['চলো সমুদ্রের পাশে একটা বাড়ি বানাই', 'পশুদের জন্য একটা স্কুল বানাও', 'এখন আমরা মহাকাশচারী', 'আমি চাই একটা ড্রাগন আমাদের দেখতে আসুক', 'তুমি দোকানদার আর আমি কাস্টমার'],
    },
    generic: {
      1: ['হ্যাঁ', 'না', 'আরও', 'আবার', 'বাড়ি'],
      2: ['বাড়ি যাই', 'নীল করো', 'চলো খেলি', 'আমি খুশি', 'গল্প বলো'],
      3: ['চলো বাড়ি যাই', 'আকাশটা বেগুনি করো', 'তুমি কী করতে পছন্দ করো?', 'আমি নতুন কোথাও যেতে চাই', 'আমাকে একটা গল্প বলো'],
    },
  },
};

export function suggestions(lang, scene, level, extra = []) {
  const lvl = Math.min(3, Math.max(1, level));
  const table = SUGG[lang] || SUGG.en;
  const base = (table[scene] || table.generic)[lvl] || table.generic[lvl];
  const out = [...extra, ...base].filter((v, i, a) => v && a.indexOf(v) === i);
  return out.slice(0, 5);
}

/** A fuller sentence that models what the child might have meant (gentle expansion). */
export function expand(lang, scene, n, entities) {
  const w = (lang === 'bn');
  const first = entities?.[0];
  if (!first) return null;
  const name = w ? first.word : first.key.replace(/_/g, ' ');
  switch (scene) {
    case 'restaurant': return w ? `আমি ${name} চাই, প্লিজ।` : `I want ${name}, please.`;
    case 'shop': return w ? `আমি ${name}টা দেখতে চাই।` : `Can I see the ${name}, please?`;
    case 'hospital': return w ? `আমার বন্ধুর ${name}।` : `My pet has a ${name}.`;
    default: return w ? `আমি একটা ${name} চাই।` : `I want a ${name}.`;
  }
}
