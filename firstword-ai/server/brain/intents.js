// Global intent detection (works in every scene).
import * as L from './lexicon.js';
import { find, hasAny, quantity, isAffirmative, isNegative } from './normalize.js';

const MOVE_RE = /\b(go|goes|going|went|visit|visiting|take me|take us|bring me|travel|fly to|drive to|walk to|run to|swim to|head to|move to|back to|now we are in|now we are at|we are at|we are in|enter|get to|lets go|let us go|off to|i want to be in|i want to go|can we go|should we go|shall we go)\b/;
const LETS_RE = /\b(lets|let us|can we|shall we|should we|i want to|wanna|take me)\b/;
const STAY_VERBS = /\b(sit|eat|buy|make|build|play|sing|dance|cook|order|draw|paint|talk|ask|look|see|watch|read|write|pretend|be|call|wait|stay|help|find|look for|sleep|drink|color|colour)\b/;

export function detectGoTo(n, ctx) {
  const locs = find.locations(n);
  if (!locs.length) return null;
  // "turn this room into a garden", "make this a beach" -> transform
  if (/\b(turn|change|make|transform)\b.*\b(into|to|a|an)\b/.test(n.norm) && /\b(room|this|here|world|place|it|everything)\b/.test(n.norm)) {
    return { type: 'go_to', location: locs[locs.length - 1].key, transform: true };
  }
  const requestToSomeone = /^(can you|could you|please|will you|would you|doctor|hey|excuse me)\b/.test(n.norm) || /\b(doctor|nurse|please help)\b/.test(n.norm);
  const activityPhrase = locs.some((l) => (l.key === 'create' || (l.key === 'emergency' && ctx?.scene !== 'hospital' && ctx?.scene !== 'emergency' && !requestToSomeone)) && l.word.split(' ').length >= 2);
  if (activityPhrase) return { type: 'go_to', location: locs.find((l) => ['emergency', 'create'].includes(l.key)).key };
  const short = n.tokens.length <= 3 && !STAY_VERBS.test(n.norm);
  const move = MOVE_RE.test(n.norm) || (LETS_RE.test(n.norm) && !STAY_VERBS.test(n.norm));
  const nowWeAre = /\b(now we are|we are|lets be|lets pretend we are|pretend we are|we can be|i am an? )\b/.test(n.norm) && ['space', 'pirate'].includes(locs[0].key);
  const wantPlace = /\b(i want to (go|play|visit|do|see)|i would like to (go|play|visit)|lets do|lets play|lets try|play|do the|do a)\b/.test(n.norm) && ['restaurant', 'shop', 'hospital', 'stage', 'emergency', 'create', 'kitchen', 'party'].includes(locs[0].key) && !/\b(sit|eat|order|buy|like)\b/.test(n.norm);
  if (short || move || nowWeAre || wantPlace) {
    // prefer the location that follows "to"
    let chosen = locs[0];
    const m = /\b(to|into|at|in)\s+(the\s+|a\s+|an\s+)?(\S+(\s\S+)?)/.exec(n.norm);
    if (m) {
      const after = locs.find((l) => m[3].startsWith(l.word.split(' ')[0]));
      if (after) chosen = after;
    }
    const another = /\b(another|different|other|new)\b/.test(n.norm);
    return { type: 'go_to', location: chosen.key, another };
  }
  return null;
}

export function detectRoleAssign(n, ctx) {
  const roles = find.roles(n);
  if (!roles.length) return null;
  const s = n.norm;
  const out = { type: 'role_assign', child: null, pet: null };
  const roleAt = (idx) => roles.filter((r) => r.index >= idx).sort((a, b) => a.index - b.index)[0];

  // Both: "we are astronauts", "now we are pirates", "lets be pirates"
  if (/\b(now we are|we are|lets be|let us be|we can be|lets pretend we are|pretend we are|we will be|we become)\b/.test(s)) {
    const r = roles[0];
    out.child = r.key; out.pet = r.key;
    return out;
  }
  const youIdx = s.search(/\b(now you are|you are|you be|you will be|you play|you can be|pretend you are|can you be|you become|you should be|you turn into|be the|you are now)\b/);
  const meIdx = s.search(/\b(now i am|i am|i will be|i play|i can be|me the|i become|i want to be|let me be|i should be|i turn into|i am now|i will play)\b/);
  if (youIdx >= 0) {
    const r = roleAt(youIdx);
    if (r && (meIdx < 0 || youIdx < meIdx || r.index < meIdx)) out.pet = r.key;
  }
  if (meIdx >= 0) {
    const r = roleAt(meIdx);
    if (r && r.key !== out.pet) out.child = r.key;
    else if (r && roles.length > 1) out.child = roles.find((x) => x.key !== out.pet)?.key || null;
  }
  if (!out.child && !out.pet) return null;
  return out;
}

const BUILD_CUE = /\b(make|makes|build|create|add|put|bring|i want|i would like|i wish|can we have|lets have|there is|there are|there was|give me|draw|spawn|show me|appear|appears|comes|come|coming|came|visit us|visits|need|lets get|get a|get an|get some|plant|grow|summon|invite|a .* comes|i see|i want to see|let there be|we need|should have|can there be|put a|set up|decorate)\b/;
const REMOVE_CUE = /\b(remove|delete|take away|get rid of|no more|disappear|go away|erase|clear|bye bye|send .* away|throw away)\b/;

export function detectBuild(n, ctx) {
  const objs = find.objects(n);
  const chars = find.characters(n);
  const locs = find.locations(n);
  const all = [...objs.map((o) => ({ ...o, kind: L.OBJECTS[o.key].character ? 'character' : 'object' })), ...chars.map((c) => ({ ...c, kind: 'character' }))];
  if (!all.length) return null;

  // Drop entity words that are actually a location in a placement phrase ("beside the sea", "in the forest")
  const placeRe = /\b(beside|near|by|next to|in|on|at|inside|under|into|around|to)\s+(the\s+|a\s+|an\s+)?([\p{L}' ]+)/u;
  let placeLoc = null;
  const pm = placeRe.exec(n.norm);
  if (pm && locs.length) {
    const loc = locs.find((l) => pm[3].startsWith(l.word.split(' ')[0]));
    if (loc && loc.key !== ctx?.world?.location) placeLoc = loc.key;
  }
  // "a school for animals" -> location school + animal characters
  if (/\b(school|zoo|hospital|shop|restaurant|party|castle|farm)\b/.test(n.norm) && /\bfor\b/.test(n.norm) && locs.length) placeLoc = placeLoc || locs[0].key;

  const filtered = all.filter((e) => {
    if (!placeLoc) return true;
    const locEntry = L.LOCATIONS[placeLoc];
    return !(locEntry.en.includes(e.word) || locEntry.bn.includes(e.word));
  }).filter((e, i, arr) => arr.findIndex((x) => x.key === e.key) === i);

  const removing = REMOVE_CUE.test(n.norm);
  if (removing) return { type: 'remove', items: filtered.map((f) => f.key) };

  const short = n.tokens.length <= 4;
  const cue = BUILD_CUE.test(n.norm) || !!ctx?.forceBuild; // forceBuild: the trained model already decided this is a build request
  const inCreate = ctx?.scene === 'create';
  if (!(cue || (short && inCreate) || (short && n.tokens.length <= 2))) {
    if (!(/\bfor animals\b/.test(n.norm) || /\bfor\b/.test(n.norm) && placeLoc)) return null;
  }
  if (!filtered.length && !placeLoc) return null;

  const colors = find.colors(n);
  const sizes = find.sizes(n);
  const qty = quantity(n);
  const items = filtered.map((e) => ({ key: e.key, kind: e.kind, word: e.word, qty: filtered.length === 1 ? qty : 1, color: colors[0]?.key || null, size: sizes[0]?.key || null }));
  // "school for animals" => add a few animals
  if (/\b(for animals|animal school|animals)\b/.test(n.norm) && placeLoc === 'school') {
    for (const k of ['elephant', 'rabbit', 'monkey']) if (!items.some((i) => i.key === k)) items.push({ key: k, kind: 'character', word: k, qty: 1, color: null, size: null, role: 'student' });
  }
  return { type: 'build', items, placeLoc };
}

export function detectColor(n, ctx) {
  const colors = find.colors(n);
  if (!colors.length) return null;
  const s = n.norm;
  const cue = /\b(make|paint|turn|change|color|colour|become|want|should be|be|now|is)\b/.test(s) || n.tokens.length <= 3;
  if (!cue) return null;
  let target = 'room';
  if (/\b(sky|air|clouds)\b/.test(s)) target = 'sky';
  else if (/\b(ground|grass|floor|land|sand|earth)\b/.test(s)) target = 'ground';
  else if (/\b(room|wall|walls|house|everything|world|place|here|background)\b/.test(s)) target = ctx?.world?.location && !['home', 'restaurant', 'shop', 'hospital', 'stage', 'school', 'kitchen', 'party'].includes(ctx.world.location) ? 'sky' : 'room';
  else {
    const objs = find.objects(n);
    const items = find.shopItems(n);
    if (objs.length) target = `object:${objs[objs.length - 1].key}`;
    else if (items.length) target = `object:${items[items.length - 1].key}`;
    else if (/\b(it|this|that)\b/.test(s) && ctx?.lastObjectKey) target = `object:${ctx.lastObjectKey}`;
  }
  return { type: 'color', target, color: colors[colors.length - 1].key };
}

export function detectWeatherTime(n, ctx) {
  const w = find.weather(n);
  const t = find.times(n);
  const cue = /\b(make|let|want|turn|it is|its|now|should|can|please|become|start|stop|lets|time|outside|is)\b/.test(n.norm) || n.tokens.length <= 3;
  if (!cue) return null;
  // avoid clashes: "i am cold" is a feeling, "good night" is a greeting, "stars" are objects handled by build
  if (/\b(i am|i feel|good night|good morning|good day)\b/.test(n.norm)) return null;
  if (w.length && !find.foods(n).some((f) => f.key === 'orange')) {
    const key = w[0].key;
    if (key === 'clear' && /\b(no rain|stop|clear)\b/.test(n.norm)) return { type: 'weather', weather: 'clear' };
    if (key !== 'clear' || /\b(sunny|sun|sunshine|summer)\b/.test(n.norm)) return { type: 'weather', weather: key };
  }
  if (t.length) return { type: 'time', time: t[0].key };
  return null;
}

export function detectPetQuestion(n, ctx) {
  const s = n.norm;
  if (/\b(your name|who are you|what are you called|what is your name)\b/.test(s)) return { type: 'pet_q', kind: 'name' };
  if (/\bhow are you\b|\bare you (okay|ok|fine|happy|good|alright|well)\b|\bhow do you feel\b/.test(s)) return { type: 'pet_q', kind: 'how_are_you' };
  if (/\bhow old\b/.test(s)) return { type: 'pet_q', kind: 'age' };
  if (/\bwho am i\b/.test(s)) return { type: 'pet_q', kind: 'who_am_i' };
  if (/\bwhat are you doing\b/.test(s)) return { type: 'pet_q', kind: 'what_doing' };
  if (/\bi love you\b|\blove you\b/.test(s)) return { type: 'pet_q', kind: 'love' };
  if (/\bfavou?rite colou?r\b/.test(s)) return { type: 'pet_q', kind: 'fav_color' };
  if (/\bfavou?rite (food|snack|thing to eat|dish)\b|\bwhat do you (like|want|love) to eat\b|\bwhat do you want to eat\b/.test(s)) return { type: 'pet_q', kind: 'fav_food' };
  if (/\bwhat do you (like|love|enjoy)\b|\bwhat is your favou?rite\b|\bfavou?rite\b/.test(s)) return { type: 'pet_q', kind: 'likes' };
  if (/\bwhat do you want\b|\bwhat would you like\b|\bwhat do you need\b|\bwhat about you\b/.test(s)) return { type: 'pet_q', kind: 'what_want' };
  const like = /\bdo you (like|love|want|eat|enjoy)\s+(the\s+|a\s+|an\s+|some\s+)?([\p{L}' ]+)/u.exec(s);
  if (like) return { type: 'pet_q', kind: 'like_x', x: like[3].trim().replace(/\?$/, '') };
  const can = /\bcan you (dance|jump|fly|sing|swim|run|talk|cook|draw|read|count|hop|spin|roll)\b/.exec(s);
  if (can) return { type: 'action', kind: can[1], asked: true };
  return null;
}

export function detectGreeting(n) {
  const s = n.norm;
  if (/\b(bye|goodbye|bye bye|see you|good night|tata|ta ta)\b/.test(s)) return { type: 'greeting', kind: 'bye' };
  if (/\b(thank you|thanks|thank)\b/.test(s) && n.tokens.length <= 6) return { type: 'greeting', kind: 'thanks' };
  if (/^(hi|hello|hey|hiya|good morning|good afternoon|good evening|assalamu alaikum|salam|namaste|hello there)\b/.test(s) && n.tokens.length <= 5) return { type: 'greeting', kind: 'hello' };
  return null;
}

export function detectFeeling(n) {
  const f = find.feelings(n);
  if (!f.length) return null;
  const s = n.norm;
  if (/\b(i am|i feel|i am feeling|feeling|me|i was|i get)\b/.test(s) || n.tokens.length <= 3) {
    if (/\b(you|pet|he|she|it|my friend)\b/.test(s) && !/\bi am\b|\bi feel\b/.test(s)) return null;
    return { type: 'feeling', feeling: f[0].key };
  }
  return null;
}

export function detectSupport(n) {
  const s = n.norm;
  if (/\b(i do not know|do not know|dont know|not sure|no idea|i can not|i cannot|too hard|i do not understand|do not understand)\b/.test(s)) return { type: 'support', kind: 'dont_know' };
  if (/\b(what should i say|what can i say|help me|how do i|what do i do|what can i do|what can we do|what should we do|what now|what do we do|give me ideas|i need help)\b/.test(s)) return { type: 'support', kind: 'help_me' };
  return null;
}

export function detectAction(n) {
  const s = n.norm;
  if (/\b(dance|dancing|lets dance|nacho)\b/.test(s)) return { type: 'action', kind: 'dance' };
  if (/\b(jump|hop|bounce)\b/.test(s) && !/\bpuddle/.test(s)) return { type: 'action', kind: 'jump' };
  if (/\b(fly|flying)\b/.test(s) && !/\bfly to\b/.test(s)) return { type: 'action', kind: 'fly' };
  if (/\b(sing|song|sing a song|singing)\b/.test(s)) return { type: 'action', kind: 'sing' };
  if (/\b(sleep|nap|go to bed|sleepy time)\b/.test(s) && /\b(you|lets|go|time)\b/.test(s)) return { type: 'action', kind: 'sleep' };
  if (/\b(hide and seek|hide|lets hide)\b/.test(s)) return { type: 'action', kind: 'hide' };
  if (/\b(found you|i found you|there you are|got you|peekaboo|peek a boo)\b/.test(s)) return { type: 'action', kind: 'found' };
  if (/\b(tell me a story|tell a story|story please|read me|tell story|say a story)\b/.test(s) && !/\b(i will|i am going to|today i)\b/.test(s)) return { type: 'action', kind: 'story' };
  if (/\b(lets play|play with me|want to play|i want to play|play|khela)\b/.test(s) && n.tokens.length <= 5) return { type: 'action', kind: 'play' };
  if (/\b(wake up|get up)\b/.test(s)) return { type: 'action', kind: 'wake' };
  if (/\b(count|counting|lets count)\b/.test(s)) return { type: 'action', kind: 'count' };
  if (/\b(joke|funny|make me laugh)\b/.test(s)) return { type: 'action', kind: 'joke' };
  return null;
}

export function detectYesNo(n) {
  if (isAffirmative(n)) return { type: 'affirm' };
  if (/^(no|nope|nah|not now|no thanks|no thank you)\b/.test(n.norm) && n.tokens.length <= 4) return { type: 'negate' };
  return null;
}

/** Talk to a character: "say hi to the dragon", "ask the owl ...", "hello dragon", "dragon, do you like cake?" */
export function detectTalkTo(n, ctx) {
  const chars = ctx?.world?.characters || [];
  if (!chars.length) return null;
  const objs = find.objects(n);
  const people = find.characters(n);
  const mentioned = [...objs, ...people].map((e) => e.key);
  const target = chars.find((c) => mentioned.includes(c.key));
  if (!target) return null;
  const s = n.norm;
  if (/\b(say|tell|ask|hello|hi|hey|talk|speak|do you|can you|will you|would you|are you|what|where|who|how|why|please|come|lets|play|want|like|thank)\b/.test(s)) {
    return { type: 'talk_to', character: target, text: n };
  }
  return null;
}

export { isNegative, isAffirmative };
