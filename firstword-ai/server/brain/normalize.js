// Text normalization + entity finding for the brain.
import * as L from './lexicon.js';

const CONTRACTIONS = [
  [/let's|lets|let us/g, 'lets'],
  [/i'm|i am/g, 'i am'],
  [/i'd/g, 'i would'],
  [/i'll/g, 'i will'],
  [/you're/g, 'you are'],
  [/we're/g, 'we are'],
  [/it's/g, 'it is'],
  [/that's/g, 'that is'],
  [/what's/g, 'what is'],
  [/where's/g, 'where is'],
  [/don't|dont/g, 'do not'],
  [/doesn't/g, 'does not'],
  [/didn't/g, 'did not'],
  [/can't|cannot/g, 'can not'],
  [/won't/g, 'will not'],
  [/wanna/g, 'want to'],
  [/gonna/g, 'going to'],
  [/gimme/g, 'give me'],
  [/pls|plz/g, 'please'],
  [/ok\b/g, 'okay'],
];

export function hasBangla(text) {
  return /[\u0980-\u09FF]/.test(text || '');
}

/** Produce { raw, norm, tokens, isBangla } where norm is lowercase English-ish text. */
export function normalize(raw) {
  const text = String(raw || '').trim();
  const isBangla = hasBangla(text);
  let s = text.toLowerCase();

  if (isBangla) {
    // Bangla punctuation
    s = s.replace(/।/g, ' . ');
    // Bangla digits -> ASCII so "table ২" reads like "table 2"
    s = s.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
    // Replace key Bangla phrases with English intent words (longest first), respecting word boundaries
    for (const [bn, en] of BN_PHRASES_SORTED) {
      if (s.includes(bn.trim())) s = s.replace(bnWordRegex(bn.trim(), 'gu'), (m, pre) => `${pre}${en} `);
    }
  }

  s = s.replace(/[’‘`]/g, "'");
  for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
  s = s.replace(/[^\p{L}\p{M}\p{N}\s?'-]/gu, ' ').replace(/\s+/g, ' ').trim();
  let tokens = s.split(' ').filter(Boolean);
  let corrected = null;
  if (spellFixer && !isBangla) {
    const fixed = spellFixer(tokens);
    if (fixed) {
      corrected = tokens.map((t, i) => (fixed[i] !== t ? { from: t, to: fixed[i] } : null)).filter(Boolean);
      tokens = fixed;
      s = tokens.join(' ');
    }
  }
  return { raw: text, norm: s, tokens, isBangla, hasQuestionMark: /\?/.test(text), corrected };
}

// Optional token-level spelling fixer (installed by the ML module). Receives the token list,
// returns a corrected copy or null when nothing changed.
let spellFixer = null;
export function setSpellFixer(fn) { spellFixer = fn; }

/** Escape regex special chars */
function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Bangla has no \b support in JS regex, so we build boundary-aware patterns by hand.
// A word may carry a common suffix (case markers / classifiers): রেস্টুরেন্টে, ব্যাগটা, বন্ধুর ...
const BN_SUFFIX = '(?:টাকে|টার|গুলো|গুলি|েতে|ের|টা|টি|তে|কে|ে|র)?';
const BN_BOUNDARY_BEFORE = '(^|[\\s,।?!.\u201c\u201d"\'])';
const BN_BOUNDARY_AFTER = '(?=$|[\\s,।?!.\u201c\u201d"\'])';
const bnCache = new Map();
export function bnWordRegex(word, flags = 'u') {
  const key = `${word}|${flags}`;
  if (bnCache.has(key)) return bnCache.get(key);
  const re = new RegExp(`${BN_BOUNDARY_BEFORE}${esc(word)}${BN_SUFFIX}${BN_BOUNDARY_AFTER}`, flags);
  bnCache.set(key, re);
  return re;
}
const BN_PHRASES_SORTED = [...L.BN_PHRASES].sort((a, b) => b[0].trim().length - a[0].trim().length);

const matcherCache = new Map();
function buildMatchers(table, name) {
  if (matcherCache.has(name)) return matcherCache.get(name);
  const list = [];
  for (const [key, entry] of Object.entries(table)) {
    for (const w of entry.en || []) list.push({ key, word: w, re: new RegExp(`(^|[^\\p{L}])${esc(w)}(s|es)?(?=$|[^\\p{L}])`, 'u'), len: w.length, bn: false });
    for (const w of entry.bn || []) list.push({ key, word: w, re: bnWordRegex(w), len: w.length, bn: true });
  }
  // longest words first so "ice cream" beats "cream", "chocolate cake" beats "cake"
  list.sort((a, b) => b.len - a.len);
  matcherCache.set(name, list);
  return list;
}

/**
 * Find all entries of a lexicon table mentioned in the utterance.
 * Returns [{ key, word, index }] ordered by position in the text. De-duplicated by key.
 * Overlapping matches are suppressed (longest match wins).
 */
export function findAll(table, name, n) {
  const matchers = buildMatchers(table, name);
  const found = [];
  const taken = []; // [start,end) ranges already consumed
  for (const m of matchers) {
    if (m.bn && !n.isBangla) continue;
    const match = m.re.exec(n.norm);
    if (!match) continue;
    let start = match.index;
    if (match[1]) start += match[1].length;
    const end = start + m.word.length;
    const overlaps = taken.some((r) => start < r.end && end > r.start);
    if (overlaps) continue;
    taken.push({ start, end });
    if (!found.some((f) => f.key === m.key)) found.push({ key: m.key, word: m.word, index: start, matchedWord: match[0].trim() });
  }
  found.sort((a, b) => a.index - b.index);
  return found;
}

export function findFirst(table, name, n) {
  return findAll(table, name, n)[0] || null;
}

export const find = {
  locations: (n) => findAll(L.LOCATIONS, 'locations', n),
  foods: (n) => findAll(L.FOODS, 'foods', n),
  colors: (n) => findAll(L.COLORS, 'colors', n),
  shopItems: (n) => findAll(L.SHOP_ITEMS, 'shopItems', n),
  objects: (n) => findAll(L.OBJECTS, 'objects', n),
  characters: (n) => findAll(L.CHARACTERS, 'characters', n),
  roles: (n) => findAll(L.ROLES, 'roles', n),
  symptoms: (n) => findAll(L.SYMPTOMS, 'symptoms', n),
  feelings: (n) => findAll(L.FEELINGS, 'feelings', n),
  weather: (n) => findAll(L.WEATHER, 'weather', n),
  times: (n) => findAll(L.TIMES, 'times', n),
  sizes: (n) => findAll(L.SIZE_WORDS, 'sizes', n),
};

export function hasAny(n, words) {
  const s = ` ${n.norm} `;
  return words.some((w) => s.includes(` ${w} `) || (w.includes(' ') && s.includes(w)));
}

export function matches(n, re) {
  return re.test(n.norm);
}

/** Extract a quantity mentioned near an object word, defaults to 1 */
export function quantity(n) {
  for (const t of n.tokens) {
    if (L.NUMBER_WORDS[t] !== undefined && !['a', 'an'].includes(t)) return Math.min(L.NUMBER_WORDS[t], 10);
  }
  if (n.isBangla) {
    for (const [w, v] of Object.entries(L.NUMBER_WORDS)) if (/[\u0980-\u09FF]/.test(w) && bnWordRegex(w).test(n.norm)) return Math.min(v, 10);
  }
  if (/\b(many|lots|lot|loads|plenty|hundreds)\b/.test(n.norm)) return 5;
  return 1;
}

export function isQuestion(n) {
  return n.hasQuestionMark || /^(what|where|who|when|why|how|can|could|do|does|did|is|are|will|would|should|may|which|have|has)\b/.test(n.norm) || /\b(what|where|who|why|how|which)\b/.test(n.norm) && n.tokens.length <= 7;
}

export function isNegative(n) {
  return /^(no|nope|nah|not|never)\b/.test(n.norm) || /\b(do not want|do not like|does not|did not|not that|not this|no more|i do not|instead|actually|change my|change it|change the order|something else|different|never mind|cancel)\b/.test(n.norm);
}

export function isAffirmative(n) {
  return /^(yes|yeah|yep|yup|okay|ok|sure|of course|yes please|alright|fine|good|please|absolutely|definitely|i do|yes i do)\b/.test(n.norm) && n.tokens.length <= 5;
}

export function politeness(n) {
  return { please: /\bplease\b/.test(n.norm), thanks: /\b(thank you|thanks|thank)\b/.test(n.norm), sorry: /\bsorry\b/.test(n.norm) };
}

export function pick(arr, seed) {
  if (!arr || !arr.length) return '';
  if (seed !== undefined) return arr[Math.abs(seed) % arr.length];
  return arr[Math.floor(Math.random() * arr.length)];
}

export function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function articleFor(word) {
  if (!word) return '';
  if (/s$/.test(word) && !/ss$/.test(word)) return 'some';
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

export function withArticle(word) {
  const a = articleFor(word);
  return `${a} ${word}`;
}
