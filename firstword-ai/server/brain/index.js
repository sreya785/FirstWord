// The brain: turns a child's words into pet replies and world changes.
import * as L from './lexicon.js';
import * as W from './world.js';
import * as I from './intents.js';
import { normalize, find, pick, cap, withArticle, isAffirmative } from './normalize.js';
import { say, petProfile } from './pet.js';
import { measure, estimateLevel, suggestions, expand } from './adapt.js';
import { createReply } from './reply.js';
import { roleOpening, inRole } from './roleplay.js';
import * as ollama from './ollama.js';
import * as ml from './ml/index.js';
import { questFor } from './quests.js';
import * as restaurant from './scenes/restaurant.js';
import * as shop from './scenes/shop.js';
import * as hospital from './scenes/hospital.js';
import * as stage from './scenes/stage.js';
import * as emergency from './scenes/emergency.js';
import * as create from './scenes/create.js';
import * as home from './scenes/home.js';
import { retrieve, detectWeakPoints } from '../curriculum/retriever.js';
import * as qwen from './qwen.js';

const SCENES = { restaurant, shop, hospital, stage, emergency, create, home };
const ACTIVITY_SCENES = ['restaurant', 'shop', 'hospital', 'stage', 'emergency', 'create'];

export function newSession(child, lang) {
  return {
    scene: 'home',
    world: W.newWorld('home', lang),
    sceneState: {},
    petMood: 'happy',
    pending: null,
    silences: 0,
    turnCount: 0,
    recentMetrics: [],
    history: [],
    lastObjectKey: null,
    lastProblem: null,
    scenesVisited: ['home'],
    intentsSeen: new Set(),
    lastMl: null,
  };
}

function ctxFor(session, child, lang) {
  const pet = petProfile(child.petType, child.petName, lang);
  const level = session.recentMetrics.length >= 3 ? estimateLevel(session.recentMetrics) : (child.level || 2);
  return { lang, pet, child: child.name, level, scene: session.scene, world: session.world, lastObjectKey: session.lastObjectKey };
}

/** First message of a session */
export function greet(session, child, lang, returning) {
  const ctx = ctxFor(session, child, lang);
  const r = createReply('greet');
  r.pet(say(lang, returning ? 'greet_back' : 'greet_first', { pet: ctx.pet.name, child: child.name }), 'excited', 'bounce');
  return finalize(session, child, ctx, r, null, null);
}

/** Main entry: process one child input */
export async function processTurn(session, child, { text, source }) {
  const lang = child.lang || 'en';
  const ctx = ctxFor(session, child, lang);
  session.turnCount++;
  W.clearNewFlags(session.world);
  W.clearCharacterLines(session.world);

  if (source === 'silence') {
    const r = silenceReply(session, ctx);
    return finalize(session, child, ctx, r, null, { wordCount: 0 });
  }

  const n = normalize(text);
  const metrics = measure(n);
  if (metrics.wordCount > 0) {
    session.recentMetrics.push(metrics);
    if (session.recentMetrics.length > 20) session.recentMetrics.shift();
    session.silences = 0;
  }
  ctx.level = session.recentMetrics.length >= 3 ? estimateLevel(session.recentMetrics) : (child.level || 2);
  session.history.push({ who: 'child', text: n.raw });

  let r = await route(session, child, ctx, n);
  if (!r) r = await fallback(session, child, ctx, n);
  if (metrics.polite) r.skill('greeting_politeness');
  if (metrics.isQuestion && !r.skills.includes('asking_questions') && n.tokens.length >= 2) r.skill('asking_questions');
  if (metrics.hasStoryMarker || metrics.wordCount >= 12) r.skill('storytelling');
  if (metrics.hasDescriptor && !r.skills.includes('describing') && metrics.wordCount >= 3) r.skill('describing');

  // Curriculum (c): at most ONE gentle follow-up question after a very short child answer at level 1 or 2.
  // Do not replace or change any scripted scene line, scene state, or Step 1 voice-required rule.
  // Never ask more than one question in a turn.
  if (ctx.level <= 2 && metrics.wordCount > 0 && metrics.wordCount <= 2 && !r.sceneChanged) {
    const hasQuestion = r.petText && r.petText.includes('?');
    const isWaitingForVoice = Boolean(session.sceneState?.waitingForVoice || session.sceneState?.stage === 'table_ready' || session.sceneState?.stage === 'customer_waiting');
    if (!hasQuestion && !isWaitingForVoice && !r.usedCurriculum?.followUpQuestion) {
      const weakPoints = detectWeakPoints(session, ctx.level);
      const retrieved = retrieve({ lang, scene: session.scene, level: ctx.level, weakPoints });
      const item = retrieved[0];
      const q = item?.followUpQuestions?.[0];
      if (q) {
        r.pet(q, 'thinking');
        r.usedCurriculum = {
          id: item.id,
          targetWords: item.targetWords,
          followUpQuestion: q,
        };
      }
    }
  }

  return finalize(session, child, ctx, r, n, metrics);
}

const NAV_CUE = /\b(go|goes|going|take|bring|visit|see|wanna|want to|lets|let us|come|head|travel|drive|walk|run|fly|ride|back)\b|(চল|যাই|যাব|যেতে|নিয়ে|ঘুরতে|দেখতে|ফিরে)/;
const NAV_INTENT = { go_restaurant: 'restaurant', go_shop: 'shop', go_hospital: 'hospital', go_stage: 'stage', go_emergency: 'emergency', go_create: 'create', go_home: 'home' };

async function route(session, child, ctx, n) {
  const { lang } = ctx;
  session.lastMl = null;

  // 0. Pending yes/no from the pet's last question
  if (session.pending) {
    const yn = I.detectYesNo(n);
    if (yn) {
      const yes = yn.type === 'affirm';
      const p = session.pending;
      session.pending = null;
      const handler = SCENES[session.scene];
      if (handler?.onPending) {
        const rr = handler.onPending(session, p, yes, ctx);
        if (rr) return rr;
      }
      if (p.type === 'go_to' && yes) return await changeScene(session, ctx, p.location, {});
      if (p.type === 'build' && yes) return doBuild(session, ctx, { type: 'build', items: p.items, placeLoc: null }, n);
      if (!yes) {
        const r = createReply('negate');
        r.pet(say(lang, 'negate'), 'happy');
        r.skill('changing_mind');
        return r;
      }
      const r = createReply('affirm');
      r.pet(say(lang, 'affirm'), 'happy');
      return r;
    }
  }

  // 0b. A party for the pet ("let us create a birthday party for you")
  if (/\b(birthday|party)\b/.test(n.norm) && /\b(for you|your birthday|for my pet|for momo|for bubu|for pip)\b/.test(n.norm)) {
    if (session.scene !== 'create') { session.scene = 'create'; session.sceneState = { builds: 0 }; if (!session.scenesVisited.includes('create')) session.scenesVisited.push('create'); }
    const pr = create.handle(session, n, ctx);
    if (pr) { pr.sceneChanged = true; return pr; }
  }

  // 0c. Talking to a character who is already in our world (create/home scenes)
  if (session.scene === 'create' || session.scene === 'home') {
    const talk0 = I.detectTalkTo(n, ctx);
    if (talk0) return talkTo(session, ctx, talk0, n);
  }

  // 1. Navigation
  const go = I.detectGoTo(n, ctx);
  if (go) {
    const role = I.detectRoleAssign(n, ctx);
    const r = await changeScene(session, ctx, go.location, { transform: go.transform, carry: { another: go.another } });
    if (role) await applyRoles(session, ctx, role, r, true);
    return r;
  }

  // 2. Role assignment (or stopping the role play)
  if (/\b(stop (the )?(game|playing|pretending)|be yourself|be normal|you are my friend again|you are (momo|bubu|pip) again|no more (roles|pretend)|game over|back to normal)\b/.test(n.norm) && session.world.roles.pet !== 'friend') {
    W.setRoles(session.world, { child: 'friend', pet: 'friend' });
    W.setOutfit(session.world, null);
    const r = createReply('role_reset');
    r.pet(lang === 'bn' ? `আচ্ছা! আমি আবার ${ctx.pet.name}, তোমার বন্ধু। কী করব এখন?` : `Okay! I am just ${ctx.pet.name} again, your friend. What should we do now?`, 'happy', 'bounce');
    r.skill('giving_instructions');
    return r;
  }
  const role = I.detectRoleAssign(n, ctx);
  if (role && !(session.scene === 'hospital' && role.pet === 'doctor' && !/\byou\b/.test(n.norm))) {
    const r = createReply('role_assign');
    await applyRoles(session, ctx, role, r, false);
    return r;
  }

  // 2b. Paraphrased travel requests ("wanna see a doctor person") — the trained model may route them before the
  //     scene handler swallows the sentence. Requires a movement cue, high confidence and a different destination.
  if (n.tokens.length >= 3 && NAV_CUE.test(n.norm) && !session.sceneState?.awaitingAnswer) {
    const g = ml.classify(n);
    if (g && NAV_INTENT[g.intent] && g.conf >= 0.72 && NAV_INTENT[g.intent] !== session.scene && NAV_INTENT[g.intent] !== session.world.location) {
      session.lastMl = g;
      const r = await changeScene(session, ctx, NAV_INTENT[g.intent], {});
      r.ml = g; r.intent = `ml_${g.intent}`;
      return r;
    }
  }

  // 3. Scene-specific handling
  const handler = SCENES[session.scene] || home;
  const sr = await handler.handle(session, n, ctx);
  if (sr && sr.goTo) {
    const r = await changeScene(session, ctx, sr.goTo, { carry: sr.carry });
    if (sr.prefix) { r.speech.unshift({ who: 'pet', text: sr.prefix }); r.petText = `${sr.prefix} ${r.petText}`; }
    return r;
  }
  if (sr) return sr;
  if (session.scene !== 'home' && session.scene !== 'create') {
    // Generic place handler also applies in these scenes (e.g. kitchen inside home scene)
  } else if (session.scene === 'home') {
    const hr = home.handle(session, n, ctx);
    if (hr) return hr;
  }

  // 4. Talking to a character in the world
  const talk = I.detectTalkTo(n, ctx);
  if (talk) return talkTo(session, ctx, talk, n);

  // 4b. When the pet plays a "giving" role, answer in role and make the thing appear
  const petRole = session.world.roles.pet;
  const roleCue = /\b(want|give|need|please|can i|buy|show|like|order|bring|cook|how much|price|pay|take|what|which|welcome|hello|help|sick|hurt|medicine|where|yes|no|okay|arr|roar|beep|meow|woof|moo)\b/.test(n.norm);
  if (petRole && petRole !== 'friend' && roleCue && !/\b(comes|come|visit|appear|arrive)\b/.test(n.norm)) {
    const text = inRole(lang, petRole, n, ctx, true);
    if (text) {
      const r = createReply('in_role');
      const ent = [...find.shopItems(n), ...find.foods(n), ...find.objects(n)][0];
      if (ent && /\b(want|give|need|please|can i|buy|show|like|order|bring|make|cook)\b/.test(n.norm)) {
        const colors = find.colors(n);
        W.addObject(session.world, ent.key, { color: colors[0] ? L.COLORS[colors[0].key].hex : null });
        session.lastObjectKey = ent.key;
        r.event('pop');
      }
      r.pet(text, 'happy', 'bounce');
      r.skill('role_play');
      if (/\b(want|give|need|can i|buy|order)\b/.test(n.norm)) r.skill('requesting');
      return r;
    }
  }

  // 5. Building / removing things
  const build = I.detectBuild(n, ctx);
  if (build?.type === 'remove') return doRemove(session, ctx, build);
  if (build) return doBuild(session, ctx, build, n);

  // 6. Colors / weather / time
  const col = I.detectColor(n, ctx);
  if (col) return doColor(session, ctx, col);
  const wt = I.detectWeatherTime(n, ctx);
  if (wt) return doWeatherTime(session, ctx, wt);

  // 7. Pet questions, greetings, feelings, support, actions
  const pq = I.detectPetQuestion(n, ctx);
  if (pq) return pq.type === 'action' ? doAction(session, ctx, pq, n) : petQuestion(session, ctx, pq, n);
  const gr = I.detectGreeting(n);
  if (gr) return greeting(session, ctx, gr);
  const fe = I.detectFeeling(n);
  if (fe) return feeling(session, ctx, fe);
  const su = I.detectSupport(n);
  if (su) return support(session, ctx, su);
  const ac = I.detectAction(n);
  if (ac) return doAction(session, ctx, ac, n);
  const yn = I.detectYesNo(n);
  if (yn) {
    const r = createReply(yn.type);
    if (yn.type === 'affirm') r.pet(lang === 'bn' ? 'হ্যাঁ! কী করব বলো?' : 'Yes! Okay! What should we do?', 'happy');
    else { r.pet(say(lang, 'negate'), 'happy'); r.skill('changing_mind'); }
    return r;
  }

  // 8. In-role response when the pet has a role
  if (session.world.roles.pet && session.world.roles.pet !== 'friend') {
    const text = inRole(lang, session.world.roles.pet, n, ctx);
    if (text) {
      const r = createReply('in_role');
      r.pet(text, 'happy');
      r.skill('role_play');
      return r;
    }
  }

  // 9. Trained intent model: the safety net for paraphrases the rules did not catch
  const guess = ml.classify(n);
  session.lastMl = guess;
  if (guess && guess.conf >= 0.55) {
    const r = await mlReply(session, ctx, guess, n);
    if (r) { r.ml = guess; return r; }
  }
  return null;
}

// ---------- Replies driven by the trained intent model ----------
async function mlReply(session, ctx, guess, n) {
  const { lang, pet } = ctx;
  const bn = lang === 'bn';
  const r = createReply(`ml_${guess.intent}`);
  const go = async (loc) => await changeScene(session, ctx, loc, {});
  const ask = (en, bnText, mood = 'happy', action = null, pending = null) => { r.pet(bn ? bnText : en, mood, action); if (pending) r.setPending(pending); return r; };
  switch (guess.intent) {
    case 'go_restaurant': return go('restaurant');
    case 'go_shop': return go('shop');
    case 'go_hospital': return go('hospital');
    case 'go_stage': return go('stage');
    case 'go_emergency': return go('emergency');
    case 'go_create': return go('create');
    case 'go_home': return go('home');
    case 'go_place': {
      const loc = find.locations(n)[0];
      if (loc) return go(loc.key);
      return ask('Ooh, a trip! Where should we go — the park, the beach, or space?', 'ওহ, ঘুরতে যাব! কোথায় যাই — পার্ক, সমুদ্র, না মহাকাশ?', 'excited', 'bounce');
    }
    case 'order_food':
      if (session.scene === 'restaurant') return ask('Yum! Tell me the name of the food you want.', 'ইয়াম! কোন খাবারটা চাও, নামটা বলো।', 'excited');
      return ask('Are you hungry? Shall we go to the restaurant?', 'খিদে পেয়েছে? চলো রেস্টুরেন্টে যাই?', 'excited', 'bounce', { type: 'go_to', location: 'restaurant' });
    case 'ask_price': case 'buy_item':
      if (session.scene === 'shop') return ask('Which one do you mean? Say the name of the thing you like.', 'কোনটা বলছ? যেটা ভালো লাগে তার নাম বলো।', 'thinking');
      return ask('Shopping? Shall we go to the shop?', 'কেনাকাটা? চলো দোকানে যাই?', 'excited', 'bounce', { type: 'go_to', location: 'shop' });
    case 'symptom':
      if (session.scene === 'hospital' || session.scene === 'emergency') return ask('Oh no. Tell the doctor exactly where it hurts.', 'ইশ। ডাক্তারকে বলো ঠিক কোথায় ব্যথা।', 'worried');
      return ask('Oh no, does something hurt? Shall we visit the doctor together?', 'ইশ, কোথাও ব্যথা? চলো একসাথে ডাক্তারের কাছে যাই?', 'worried', null, { type: 'go_to', location: 'hospital' });
    case 'call_help': {
      const who = find.characters(n)[0];
      if (session.scene === 'emergency' || session.scene === 'hospital') return ask(`Yes, let us call ${who ? who.word : 'someone'}! Say "ring ring" with me?`, `হ্যাঁ, চলো ${who ? who.word : 'কাউকে'} ডাকি! আমার সাথে বলো "রিং রিং"?`, 'relieved');
      return ask('You want to call for help? Good thinking. Is someone in trouble?', 'সাহায্য ডাকতে চাও? ভালো ভেবেছ। কেউ কি বিপদে?', 'thinking', null, { type: 'go_to', location: 'emergency' });
    }
    case 'perform':
      if (session.scene === 'stage') return ask('Yes! Go ahead, I am listening!', 'হ্যাঁ! শুরু করো, আমি শুনছি!', 'excited');
      return ask('A show?! Shall we go to the stage?', 'শো?! চলো মঞ্চে যাই?', 'excited', 'dance', { type: 'go_to', location: 'stage' });
    case 'build': {
      // "a big red car" has no verb, but the model is confident it is a build request and we know the thing: just build it.
      const forced = I.detectBuild(n, { ...ctx, forceBuild: true });
      if (forced && forced.type === 'build' && forced.items.length) { const br = doBuild(session, ctx, forced, n); br.intent = 'ml_build'; return br; }
      return ask('Ooh, I can make things appear! Say the name of a thing — like "a house" or "a dragon".', 'ওহ, আমি জিনিস হাজির করতে পারি! একটা জিনিসের নাম বলো — যেমন "একটা বাড়ি" বা "একটা ড্রাগন"।', 'excited', 'bounce');
    }
    case 'remove': return ask('Something should disappear? Tell me what, and poof!', 'কিছু সরাতে চাও? কোনটা বলো, আর পুফ!', 'thinking');
    case 'color': return ask('A new colour! Which one — red, blue, green, pink?', 'নতুন রং! কোনটা — লাল, নীল, সবুজ, গোলাপি?', 'excited');
    case 'weather': return ask('Change the weather? Say "rain", "snow" or "rainbow"!', 'আবহাওয়া বদলাবে? বলো "বৃষ্টি", "বরফ" বা "রংধনু"!', 'excited');
    case 'time': return ask('Day or night? Say "make it night" and watch!', 'দিন না রাত? বলো "রাত করো" আর দেখো!', 'excited');
    case 'role_assign': return ask('Pretend play! Who should I be — the doctor, the shopkeeper, a pirate?', 'সাজার খেলা! আমি কে হব — ডাক্তার, দোকানদার, নাকি জলদস্যু?', 'silly', 'wobble');
    case 'greet': return greeting(session, ctx, { kind: 'hello' });
    case 'bye': return greeting(session, ctx, { kind: 'bye' });
    case 'thanks': return greeting(session, ctx, { kind: 'thanks' });
    case 'affirm': return ask('Yes! Okay! What should we do?', 'হ্যাঁ! আচ্ছা! কী করব বলো?');
    case 'negate': { r.pet(say(lang, 'negate'), 'happy'); r.skill('changing_mind'); return r; }
    case 'feel_happy': return feeling(session, ctx, { feeling: 'happy' });
    case 'feel_sad': return feeling(session, ctx, { feeling: 'sad' });
    case 'feel_scared': return feeling(session, ctx, { feeling: 'scared' });
    case 'feel_angry': return feeling(session, ctx, { feeling: 'angry' });
    case 'feel_tired': return feeling(session, ctx, { feeling: 'tired' });
    case 'pet_question': {
      const likes = pet.likes || [];
      r.pet(bn ? `আমাকে জিজ্ঞেস করছ? আমি ${pet.name}! আমি ${likes[0] || 'খেলা'} ভালোবাসি। তুমি?` : `Me? I am ${pet.name}! I love ${likes[0] || 'playing'} and ${likes[1] || 'you'}. What about you?`, 'happy', 'bounce');
      r.skill('asking_questions');
      return r;
    }
    case 'praise': { r.pet(say(lang, 'praised', { child: ctx.child, pet: pet.name }), 'love', 'jump'); r.event('hearts'); r.skill('expressing_feelings'); return r; }
    case 'ask_help': return support(session, ctx, { kind: 'help_me' });
    default: return null; // chitchat → normal fallback
  }
}

// ---------- Scene changes ----------
async function changeScene(session, ctx, location, { transform = false, carry = {} } = {}) {
  const { lang } = ctx;
  const prevScene = session.scene;
  const scene = ACTIVITY_SCENES.includes(location) ? location : (prevScene === 'create' || transform ? 'create' : 'home');
  const worldLoc = location === 'emergency' ? 'park' : location === 'create' ? 'create' : location;

  W.setLocation(session.world, worldLoc, lang);
  if (location === 'emergency') session.world.label = lang === 'bn' ? 'বন্ধুকে সাহায্য করি' : 'Help My Pet';
  if (location !== 'space') W.setOutfit(session.world, null);
  session.scene = scene;
  session.pending = null;
  if (!session.scenesVisited.includes(scene === 'home' ? worldLoc : scene)) session.scenesVisited.push(scene === 'home' ? worldLoc : scene);
  if (scene !== 'create' || prevScene !== 'create') session.world.roles = { child: 'friend', pet: 'friend' };

  let r;
  if (scene === 'hospital') r = await hospital.enter(session, ctx, carry);
  else if (scene === 'create' && location === 'create') r = await create.enter(session, ctx);
  else if (scene === 'create') {
    r = createReply(`transform_${location}`);
    session.sceneState = session.sceneState || {};
    const label = L.LOCATIONS[location] ? (lang === 'bn' ? L.LOCATIONS[location].bnLabel : L.LOCATIONS[location].en[0]) : location;
    const pre = await home.enterPlace(session, ctx, location);
    r.pet(transform
      ? (lang === 'bn' ? `সুইশ! এখন এটা ${label}!` : `Swoosh! Now this place is ${withArticle(label)}!`)
      : (lang === 'bn' ? `চলো ${label}!` : `Off to the ${label}!`), 'excited', 'jump');
    for (const sp of pre.speech) r.speech.push(sp);
    r.petText += ' ' + pre.petText;
    r.event('sparkle');
    r.skill('world_building');
  } else if (SCENES[scene] && scene !== 'home') r = await SCENES[scene].enter(session, ctx, carry);
  else r = await home.enterPlace(session, ctx, worldLoc);

  if ((scene !== 'create' || location === 'create') && !['home', 'emergency', 'create'].includes(location)) {
    const label = lang === 'bn' ? (L.LOCATIONS[location]?.bnName || L.LOCATIONS[location]?.bnLabel || location) : (L.LOCATIONS[location]?.name || L.LOCATIONS[location]?.en?.[0] || location);
    const lead = say(lang, 'go_to', { x: label });
    r.speech.unshift({ who: 'pet', text: lead }); r.petText = `${lead} ${r.petText}`;
  }
  r.sceneChanged = true;
  r.skill('giving_instructions');
  return r;
}

async function applyRoles(session, ctx, role, r, afterSceneChange) {
  const { lang } = ctx;
  const roles = {};
  if (role.child) roles.child = role.child;
  if (role.pet) roles.pet = role.pet;
  W.setRoles(session.world, roles);
  const outfitMap = { astronaut: 'astronaut', chef: 'chef', waiter: 'chef', doctor: 'doctor', king: 'crown', queen: 'crown', prince: 'crown', princess: 'crown', pirate: 'pirate', captain: 'pirate', superhero: 'cape', police: 'police', firefighter: 'firefighter', teacher: 'glasses', wizard: 'wizard', fairy: 'wings' };
  if (role.pet && outfitMap[role.pet]) W.setOutfit(session.world, outfitMap[role.pet]);
  if (role.pet === role.child && role.pet === 'astronaut' && session.world.location !== 'space' && !afterSceneChange) {
    const rr = await changeScene(session, ctx, 'space', {});
    for (const sp of rr.speech) r.speech.push(sp);
    r.petText += ' ' + rr.petText;
    r.sceneChanged = true;
  }
  const roleName = (k) => lang === 'bn' ? (L.ROLES[k]?.bn?.[0] || k) : (L.ROLES[k]?.en?.[0] || k);
  if (!afterSceneChange) {
    if (role.child && role.pet && role.child === role.pet) r.pet(lang === 'bn' ? `ইয়ে! আমরা দুজনেই ${roleName(role.pet)}!` : `Yay! We are both ${roleName(role.pet)}s now!`, 'excited', 'bounce');
    else if (role.child && role.pet) r.pet(say(lang, 'role_set', { x: roleName(role.child), y: roleName(role.pet) }), 'excited', 'bounce');
    else if (role.pet) r.pet(say(lang, 'role_pet', { y: roleName(role.pet) }), 'excited', 'bounce');
    else r.pet(say(lang, 'role_child', { x: roleName(role.child) }), 'happy');
  }
  if (role.pet && role.pet !== 'friend' && !(afterSceneChange && role.pet === 'astronaut')) r.pet(roleOpening(lang, role.pet), 'happy');
  r.skill('role_play', 'giving_instructions');
  return r;
}

// ---------- Building ----------
function doBuild(session, ctx, build, n) {
  const { lang } = ctx;
  const r = createReply('build');
  if (build.placeLoc && build.placeLoc !== session.world.location) {
    const prevScene = session.scene;
    W.setLocation(session.world, build.placeLoc, lang);
    if (!['restaurant', 'shop', 'hospital', 'stage', 'emergency'].includes(session.scene)) session.scene = 'create';
    if (!session.scenesVisited.includes(build.placeLoc)) session.scenesVisited.push(build.placeLoc);
    const label = lang === 'bn' ? L.LOCATIONS[build.placeLoc].bnLabel : L.LOCATIONS[build.placeLoc].en[0];
    if (/\bfor animals\b/.test(n.norm)) r.pet(lang === 'bn' ? 'পশুদের জন্য স্কুল! কী দারুণ বুদ্ধি!' : 'A school for animals! What a wonderful idea!', 'excited');
    else r.pet(lang === 'bn' ? `${label}! চলো সেখানে বানাই।` : `By the ${label}! Let us build it there.`, 'excited');
    if (build.placeLoc === 'school') { W.addCharacter(session.world, 'owl', { line: lang === 'bn' ? 'হুট! আমি টিচার!' : 'Hoot! I will be the teacher!' }); W.addObject(session.world, 'school', { x: 50, y: 62, size: 'huge' }); }
    if (prevScene !== 'create' && session.scene === 'create') session.sceneState = { builds: 0 };
  }
  const names = [];
  const newChars = [];
  for (const item of build.items) {
    const qty = Math.min(item.qty || 1, 6);
    const isChar = item.kind === 'character';
    const nm = lang === 'bn' ? ((L.OBJECTS[item.key]?.bn?.[0]) || (L.CHARACTERS[item.key]?.bn?.[0]) || item.word) : item.word;
    if (isChar) {
      const entry = L.CHARACTERS[item.key] || L.OBJECTS[item.key];
      const line = lang === 'bn' ? (entry.bnLine || entry.line || '') : (entry.line || '');
      const ch = W.addCharacter(session.world, item.key, { role: item.role || item.key, line, name: nm });
      if (ch) { newChars.push(ch); if (line) r.char(item.key, ch.name, ch.emoji, line); }
      // extra copies as objects
      for (let i = 1; i < qty; i++) W.addObject(session.world, item.key, { size: item.size, color: item.color ? L.COLORS[item.color].hex : null });
      r.event('sparkle');
    } else {
      for (let i = 0; i < qty; i++) W.addObject(session.world, item.key, { size: item.size, color: item.color ? L.COLORS[item.color].hex : null, name: nm });
      r.event('pop');
    }
    const plural = (w) => (lang === 'bn' || /s$/.test(w)) ? w : (/(x|ch|sh)$/.test(w) ? `${w}es` : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`);
    names.push(qty > 1 ? `${qty} ${plural(nm)}` : (lang === 'bn' ? `একটা ${nm}` : withArticle(nm)));
    session.lastObjectKey = item.key;
  }
  const nameStr = names.length <= 1 ? names[0] : (lang === 'bn' ? `${names.slice(0, -1).join(', ')} আর ${names.slice(-1)}` : `${names.slice(0, -1).join(', ')} and ${names.slice(-1)}`);
  if (newChars.length && names.length === 1) {
    r.speech.unshift({ who: 'pet', text: say(lang, 'char_arrives', { x: newChars[0].name }) });
    r.petText = `${say(lang, 'char_arrives', { x: newChars[0].name })} ${r.petText}`;
    r.petMood = 'surprised'; r.petAction = 'jump';
  } else if (names.length) {
    r.pet(cap(names.length > 1 ? say(lang, 'built_many', { x: nameStr }) : say(lang, 'built', { x: nameStr })), 'excited', 'bounce');
    const st = session.sceneState || {};
    st.builds = (st.builds || 0) + 1;
    session.sceneState = st;
    if (st.builds % 2 === 1 || ctx.level >= 3) r.pet(say(lang, 'built_q', {}, st.builds), 'happy');
  }
  // special: "we are astronauts" style handled elsewhere; "house beside the sea" handled by placeLoc
  r.skill('world_building', 'giving_instructions');
  if (build.items.some((i) => i.color || i.size)) r.skill('describing');
  if (n.tokens.length <= 2 && ctx.level <= 2 && names.length) r.recast = lang === 'bn' ? `${nameStr} বানাও, প্লিজ।` : `Please make ${nameStr}.`;
  return r;
}

function doRemove(session, ctx, build) {
  const { lang } = ctx;
  const r = createReply('remove');
  let removed = 0;
  for (const k of build.items) removed += W.removeObjects(session.world, k);
  const nm = build.items.map((k) => L.OBJECTS[k]?.[lang === 'bn' ? 'bn' : 'en']?.[0] || k).join(', ');
  if (removed) { r.pet(say(lang, 'removed', { x: nm }), 'happy'); r.event('poof'); }
  else r.pet(say(lang, 'nothing_to_remove', { x: nm }), 'thinking');
  r.skill('giving_instructions', 'world_building');
  return r;
}

function doColor(session, ctx, col) {
  const { lang } = ctx;
  const r = createReply('color');
  const colorName = lang === 'bn' ? L.COLORS[col.color].bn[0] : col.color;
  if (col.target.startsWith('object:')) {
    const key = col.target.slice(7);
    let obj = [...session.world.objects].reverse().find((o) => o.key === key);
    const ch = session.world.characters.find((c) => c.key === key);
    if (obj) obj.color = L.COLORS[col.color].hex;
    else if (ch) ch.color = L.COLORS[col.color].hex;
    else obj = W.addObject(session.world, key, { color: L.COLORS[col.color].hex });
    session.world.version++;
    const nm = lang === 'bn' ? (L.OBJECTS[key]?.bn?.[0] || L.SHOP_ITEMS[key]?.bn?.[0] || key) : key;
    r.pet(say(lang, 'color_changed', { x: nm, y: colorName }), 'happy', 'bounce');
  } else {
    W.setColor(session.world, col.target, col.color);
    const tname = { room: lang === 'bn' ? 'ঘর' : 'room', sky: lang === 'bn' ? 'আকাশ' : 'sky', ground: lang === 'bn' ? 'মাটি' : 'ground' }[col.target] || col.target;
    r.pet(say(lang, 'color_changed', { x: tname, y: colorName }), 'happy', 'bounce');
  }
  r.event('swish');
  r.skill('giving_instructions', 'describing', 'world_building');
  return r;
}

function doWeatherTime(session, ctx, wt) {
  const { lang } = ctx;
  const r = createReply(wt.type);
  if (wt.type === 'weather') {
    W.setWeather(session.world, wt.weather);
    r.pet(say(lang, `weather_${wt.weather}`), wt.weather === 'rain' ? 'surprised' : 'excited', 'bounce');
    if (wt.weather === 'snow') r.setPending({ type: 'build', items: [{ key: 'snowman', kind: 'character', word: 'snowman', qty: 1 }] });
  } else {
    W.setTime(session.world, wt.time);
    r.pet(say(lang, `time_${wt.time}`), wt.time === 'night' ? 'sleepy' : 'happy');
  }
  r.skill('giving_instructions', 'world_building');
  return r;
}

// ---------- Talking to characters ----------
function talkTo(session, ctx, talk, n) {
  const { lang } = ctx;
  const r = createReply('talk_to');
  const ch = talk.character;
  const s = n.norm;
  const bn = lang === 'bn';
  let line;
  if (/\bdo you like ([\p{L}' ]+)/u.test(s)) { const x = /\bdo you like ([\p{L}' ]+)/u.exec(s)[1].replace(/\?$/, '').trim(); line = bn ? `${x}? হ্যাঁ, খুব পছন্দ! তুমি?` : `${cap(x)}? Oh yes, I love it! Do you?`; }
  else if (/\b(hello|hi|hey)\b/.test(s)) line = bn ? `হ্যালো ${ctx.child}! তোমার সাথে দেখা হয়ে ভালো লাগল!` : `Hello, ${ctx.child}! It is so nice to meet you!`;
  else if (/\b(play|come|join|want to)\b/.test(s)) line = bn ? 'হ্যাঁ! চলো খেলি! কী খেলব?' : 'Yes! Let us play! What game should we play?';
  else if (/\b(name)\b/.test(s)) line = bn ? `আমার নাম ${ch.name}। তোমার নাম কী?` : `My name is ${cap(ch.name)}. What is your name?`;
  else if (/\b(where|from)\b/.test(s)) line = bn ? 'আমি অনেক দূরের এক জায়গা থেকে এসেছি, যেখানে সব কিছু মজার!' : 'I come from far, far away, where everything is silly and fun!';
  else if (/\b(thank)\b/.test(s)) line = bn ? 'তোমাকেও ধন্যবাদ!' : 'You are welcome, friend!';
  else if (/\b(how are you|okay)\b/.test(s)) line = bn ? 'আমি খুব ভালো! তুমি?' : 'I am wonderful, thank you for asking! How are you?';
  else if (/\b(eat|food|hungry)\b/.test(s)) line = bn ? 'উমম! আমার প্রিয় খাবার... সবকিছু!' : 'Mmm! My favorite food is... everything!';
  else if (/\b(fly|ride)\b/.test(s)) line = bn ? 'উঠে পড়ো! হুউউ!' : 'Climb on! Wheee, here we go!';
  else line = bn ? pick(['হ্যাঁ! দারুণ বুদ্ধি!', 'হি হি! তারপর?', 'আচ্ছা! আর কী?']) : pick(['Yes! What a great idea!', 'Hee hee! And then?', 'Okay! What else?', 'Really? Tell me more!']);
  W.setCharacterLine(session.world, ch.key, line);
  r.char(ch.key, ch.name, ch.emoji, line);
  r.pet(bn ? pick(['তুমি নতুন বন্ধুর সাথে কথা বললে!', 'ও তোমাকে পছন্দ করেছে!']) : pick(['You talked to a new friend! That was brave.', `The ${ch.name} likes you!`, 'Nice! What should we ask next?']), 'proud');
  r.skill('greeting_politeness', 'asking_questions', 'role_play');
  return r;
}

// ---------- Pet questions, greetings, feelings, support, actions ----------
function petQuestion(session, ctx, pq, n) {
  const { lang, pet } = ctx;
  const r = createReply(`pet_q_${pq.kind}`);
  const vars = { pet: pet.name, child: ctx.child };
  switch (pq.kind) {
    case 'name': r.pet(say(lang, 'name', vars), 'happy', 'bounce'); break;
    case 'how_are_you': r.pet(say(lang, 'how_are_you', vars), 'happy'); break;
    case 'age': r.pet(say(lang, 'age', vars), 'happy'); break;
    case 'who_am_i': r.pet(say(lang, 'who_am_i', vars), 'love'); break;
    case 'what_doing': r.pet(say(lang, 'what_doing', vars), 'happy'); break;
    case 'love': r.pet(say(lang, 'love', vars), 'love', 'jump'); r.event('hearts'); break;
    case 'fav_color': r.pet(say(lang, 'fav_color', { x: lang === 'bn' ? L.COLORS[pet.color].bn[0] : pet.color }), 'happy'); break;
    case 'fav_food': r.pet(say(lang, 'fav_food', { x: pet.likes[0] }), 'love'); break;
    case 'likes': r.pet(say(lang, 'likes', { x: lang === 'bn' ? pet.likes.slice(0, 2).join(' আর ') : pet.likes.slice(0, 3).join(', ') }), 'happy'); break;
    case 'what_want': {
      const wish = pick(['go to the beach', 'build a castle', 'eat strawberry ice cream', 'see a dragon', 'dance with you']);
      r.pet(lang === 'bn' ? 'তুমি আমাকে জিজ্ঞেস করলে! আমি সমুদ্রে যেতে চাই। তুমি কী চাও?' : `You asked me! I would love to ${wish}. What do YOU want to do?`, 'love', 'bounce');
      break;
    }
    case 'like_x': {
      const x = pq.x;
      const dislike = pet.dislikes.some((d) => x.includes(d.split(' ')[0])) || /\b(thunder|bitter|medicine|spider|snake|dark)\b/.test(x);
      r.pet(say(lang, dislike ? 'like_no' : 'like_yes', { x }), dislike ? 'silly' : 'love');
      break;
    }
  }
  r.skill('asking_questions');
  return r;
}

function greeting(session, ctx, gr) {
  const { lang, pet } = ctx;
  const r = createReply(`greet_${gr.kind}`);
  const vars = { pet: pet.name, child: ctx.child };
  if (gr.kind === 'hello') r.pet(say(lang, 'hello', vars), 'excited', 'bounce');
  else if (gr.kind === 'bye') r.pet(say(lang, 'bye', vars), 'love', 'wave');
  else r.pet(say(lang, 'thanks', vars), 'love');
  r.skill('greeting_politeness');
  return r;
}

function feeling(session, ctx, fe) {
  const { lang } = ctx;
  const r = createReply(`feeling_${fe.feeling}`);
  const moods = { happy: 'excited', sad: 'love', angry: 'worried', scared: 'love', tired: 'sleepy', hungry: 'excited', sick: 'worried' };
  r.pet(say(lang, `feel_${fe.feeling}`, { child: ctx.child }), moods[fe.feeling] || 'happy');
  if (fe.feeling === 'hungry') r.setPending({ type: 'go_to', location: 'restaurant' });
  if (fe.feeling === 'sick') r.setPending({ type: 'go_to', location: 'hospital' });
  r.skill('expressing_feelings');
  return r;
}

function support(session, ctx, su) {
  const { lang } = ctx;
  const r = createReply(su.kind);
  r.pet(say(lang, su.kind, { child: ctx.child }), 'love');
  const sc = session.scene;
  const handler = SCENES[sc];
  if (handler?.silencePhrase) r.suggest(handler.silencePhrase(session, ctx));
  return r;
}

function doAction(session, ctx, ac, n) {
  const { lang, pet } = ctx;
  const r = createReply(`action_${ac.kind}`);
  const vars = { pet: pet.name, child: ctx.child };
  switch (ac.kind) {
    case 'dance': r.pet(say(lang, 'dance', vars), 'excited', 'dance'); r.event('music'); break;
    case 'jump': case 'hop': case 'bounce': r.pet(say(lang, 'jump', vars), 'excited', 'jump'); break;
    case 'fly': r.pet(say(lang, 'fly', vars), 'excited', 'fly'); break;
    case 'sing': r.pet(say(lang, 'sing', vars), 'silly', 'dance'); r.event('music'); break;
    case 'sleep': r.pet(say(lang, 'sleep', vars), 'sleepy', 'sleep'); W.setPetState(session.world, 'sleeping'); break;
    case 'wake': W.setPetState(session.world, 'normal'); r.pet(lang === 'bn' ? 'আমি জেগে গেছি! চলো খেলি!' : 'I am awake! Let us play!', 'excited', 'jump'); break;
    case 'hide': r.pet(say(lang, 'hide', vars), 'silly', 'hide'); W.addObject(session.world, 'tree', { x: 75, y: 70, size: 'huge' }); break;
    case 'found': r.pet(say(lang, 'found', vars), 'excited', 'jump'); r.event('confetti'); break;
    case 'story': {
      const topic = find.objects(n)[0]?.word || pick(['bunny', 'dragon', 'fish', 'kitten']);
      r.pet(say(lang, 'story_ask', { x: topic }), 'thinking');
      r.skill('storytelling');
      break;
    }
    case 'play': r.pet(say(lang, 'play', vars), 'excited', 'bounce'); break;
    case 'count': r.pet(lang === 'bn' ? 'এক, দুই, তিন... এবার তুমি! চার...?' : 'One, two, three... your turn! Four...?', 'happy'); break;
    case 'joke': r.pet(lang === 'bn' ? 'মাছ কেন স্কুলে যায়? কারণ ওরা দল বেঁধে থাকে! হি হি! তুমি একটা বলো!' : 'Why did the banana go to the doctor? Because it was not peeling well! Hee hee! Now you tell me one!', 'silly', 'bounce'); break;
    default: r.pet(say(lang, 'can_you', vars), 'excited', ac.kind === 'swim' ? 'bounce' : 'jump'); break;
  }
  if (ac.asked) r.skill('asking_questions');
  else r.skill('giving_instructions');
  return r;
}

// ---------- Silence ----------
function silenceReply(session, ctx) {
  const { lang } = ctx;
  session.silences++;
  const handler = SCENES[session.scene];
  if (handler?.silenceReply) return handler.silenceReply(session, ctx);
  const r = createReply('silence');
  const weakPoints = detectWeakPoints(session, ctx.level);
  const retrieved = retrieve({ lang, scene: session.scene, level: ctx.level, weakPoints });
  const topItem = retrieved[0];
  const phrase = (topItem && topItem.targetWords?.[0])
    ? topItem.targetWords[0]
    : (handler?.silencePhrase ? handler.silencePhrase(session, ctx) : (lang === 'bn' ? 'চলো খেলি' : 'Let us play'));
  const k = session.silences === 1 ? 'silence_1' : session.silences === 2 ? 'silence_2' : 'silence_3';
  r.pet(say(lang, k, { child: ctx.child, x: phrase }), session.silences >= 3 ? 'sleepy' : 'happy', session.silences >= 3 ? 'sway' : null);
  r.suggest(phrase);
  if (topItem) {
    r.usedCurriculum = {
      id: topItem.id,
      targetWords: topItem.targetWords,
      followUpQuestion: null,
    };
  }
  return r;
}

// ---------- Fallback ----------
async function fallback(session, child, ctx, n) {
  const { lang, pet } = ctx;
  const r = createReply('fallback');
  const nouns = [...find.objects(n), ...find.foods(n), ...find.characters(n), ...find.shopItems(n)];
  const topic = nouns[0]?.word;

  const weakPoints = detectWeakPoints(session, ctx.level);
  const retrieved = retrieve({ lang, scene: session.scene, level: ctx.level, weakPoints });

  // Qwen AI Pet companion fallback (if role key or master key provided)
  if (qwen.isRoleEnabled('pet')) {
    const qwenText = await qwen.generateRoleReply({
      role: 'pet',
      lang,
      utterance: n.raw,
      history: session.history,
      context: {
        petName: pet.name,
        petType: pet.type,
        childName: child.name,
        scene: session.scene,
        worldSummary: W.describeWorld(session.world),
      },
    });
    if (qwenText) {
      r.pet(qwenText, 'happy', 'bounce');
      r.intent = 'qwen_pet';
      if (retrieved[0]) {
        r.usedCurriculum = {
          id: retrieved[0].id,
          targetWords: retrieved[0].targetWords,
          followUpQuestion: retrieved[0].followUpQuestions?.[0] || null,
        };
      }
      return r;
    }
  }

  // Optional local LLM for richer chit-chat
  if (ollama.enabled()) {
    const text = await ollama.petReply({
      lang,
      petName: pet.name,
      childName: child.name,
      worldSummary: W.describeWorld(session.world),
      history: session.history,
      utterance: n.raw,
      curriculumItems: retrieved.slice(0, 3),
    });
    if (text) {
      r.pet(text, 'happy');
      r.intent = 'llm';
      if (retrieved[0]) {
        r.usedCurriculum = {
          id: retrieved[0].id,
          targetWords: retrieved[0].targetWords,
          followUpQuestion: retrieved[0].followUpQuestions?.[0] || null,
        };
      }
      return r;
    }
  }

  const item = retrieved[0];
  const question = item?.followUpQuestions?.[0];

  if (n.tokens.length >= 9) {
    r.pet(say(lang, 'fb_long', { x: topic || (lang === 'bn' ? 'শেষের অংশটা' : 'the last part') }), 'excited');
  } else if (n.hasQuestionMark || /^(what|why|how|where|who|when)\b/.test(n.norm)) {
    r.pet(say(lang, 'fb_question'), 'thinking');
  } else if (question && !r.petText.includes('?')) {
    const lead = topic
      ? (lang === 'bn' ? `ওহ, ${topic}!` : `Ooh, ${topic}!`)
      : (lang === 'bn' ? 'আমি শুনছি!' : 'I hear you!');
    r.pet(`${lead} ${question}`, 'thinking');
    r.usedCurriculum = {
      id: item.id,
      targetWords: item.targetWords,
      followUpQuestion: question,
    };
    if (ctx.level <= 2 && n.tokens.length <= 2) r.recast = expand(lang, session.scene, n, nouns);
    return r;
  } else if (topic) {
    r.pet(say(lang, 'fb_noun', { x: topic }), 'happy');
    if (ctx.level <= 2 && n.tokens.length <= 2) r.recast = expand(lang, session.scene, n, nouns);
  } else {
    r.pet(say(lang, 'fb_short'), 'happy');
  }

  if (item && !r.usedCurriculum) {
    r.usedCurriculum = {
      id: item.id,
      targetWords: item.targetWords,
      followUpQuestion: null,
    };
  }
  return r;
}

// ---------- Finalize ----------
function finalize(session, child, ctx, r, n, metrics) {
  const { lang } = ctx;
  if (!session.intentsSeen) session.intentsSeen = new Set();
  if (r.intent) session.intentsSeen.add(r.intent);
  if (r.pending !== undefined) session.pending = r.pending;
  if (r.petMood) session.petMood = r.petMood;
  if (session.world.petState === 'sick' && !r.petMood) session.petMood = 'sick';
  session.history.push({ who: 'pet', text: r.petText });
  if (session.history.length > 30) session.history.splice(0, session.history.length - 30);

  // Adaptive nudge: suggest a new situation when the child is doing well in the current one
  const st = session.sceneState || {};
  if (session.scene === 'restaurant' && st.orders?.length >= 4 && !st.nudged) {
    st.nudged = true;
    r.pet(say(lang, 'new_situation', { x: lang === 'bn' ? 'দোকানে' : 'shop' }), 'proud');
    session.pending = { type: 'go_to', location: 'shop' };
  }

  const sugg = suggestions(lang, session.scene === 'home' && session.world.location !== 'home' ? 'generic' : session.scene, ctx.level, r.extraSuggestions);
  return {
    pet: { text: r.petText, mood: r.petMood || session.petMood || 'happy', action: r.petAction || null, name: ctx.pet.name, type: ctx.pet.type },
    sceneState: session.sceneState || {},
    speech: r.speech,
    world: session.world,
    scene: session.scene,
    events: r.events,
    suggestions: sugg,
    recast: r.recast || null,
    intent: r.intent,
    skills: r.skills,
    metrics: metrics || null,
    level: ctx.level,
    sceneChanged: r.sceneChanged,
    heard: n ? n.raw : null,
    corrected: n?.corrected || null,
    ml: r.ml || session.lastMl || null,
    quest: questFor(session, ctx),
    curriculum: r.usedCurriculum || null,
  };
}
