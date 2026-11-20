// "Help my pet" scene. The pet has a small problem and the child helps.
// Safety rule: the pet is NEVER hurt, abandoned or punished because the child is silent.
import * as W from '../world.js';
import { find, pick } from '../normalize.js';
import { createReply } from '../reply.js';

const PROBLEMS = {
  kite: {
    setup: (w) => { W.addObject(w, 'tree', { x: 72, y: 72, size: 'huge' }); W.addObject(w, 'kite', { x: 74, y: 28 }); },
    intro: { en: 'Oh no! My kite flew up and got stuck in that big tree. I can not reach it! What should we do?', bn: 'ইশ! আমার ঘুড়িটা উড়ে গিয়ে ওই বড় গাছে আটকে গেছে। আমি নাগাল পাচ্ছি না! আমরা কী করব?' },
    solve: /\b(ladder|climb|shake|stick|long|pull|jump|giraffe|tall|reach|get it down|branch|throw|ask .* help|fly|bird|wind)\b/,
    solved: { en: 'We got the kite down! Look, it is flying again!', bn: 'ঘুড়িটা নামিয়ে ফেলেছি! দেখো, আবার উড়ছে!' },
    hint: { en: 'Let us look for a ladder', bn: 'চলো একটা মই খুঁজি' },
  },
  lost: {
    setup: (w) => { W.addObject(w, 'tree', { x: 15, y: 70 }); W.addObject(w, 'tree', { x: 85, y: 75 }); W.addObject(w, 'bench', { x: 60, y: 78 }); },
    intro: { en: 'Um... I think we walked too far. I do not know the way home from here. Can you help me?', bn: 'উম... মনে হয় আমরা অনেক দূরে চলে এসেছি। এখান থেকে বাড়ির পথ আমি চিনি না। তুমি সাহায্য করবে?' },
    solve: /\b(ask|directions|sign|map|follow|path|road|this way|that way|left|right|straight|remember|phone|call|police|look for|landmark|shop|find the way|i know the way|come with me)\b/,
    solved: { en: 'Yes! I can see our house now! You found the way!', bn: 'হ্যাঁ! আমাদের বাড়ি দেখা যাচ্ছে! তুমি পথ খুঁজে পেয়েছ!' },
    hint: { en: 'Let us ask someone for directions', bn: 'চলো কাউকে পথ জিজ্ঞেস করি' },
  },
  unwell: {
    setup: (w) => { W.addObject(w, 'bench', { x: 60, y: 78 }); W.setPetState(w, 'sick'); },
    intro: { en: 'Ohh... I feel a bit dizzy and my tummy hurts. I do not feel so good. What should we do?', bn: 'উফ... আমার মাথা একটু ঘুরছে আর পেটে ব্যথা। ভালো লাগছে না। আমরা কী করব?' },
    solve: /\b(hospital|doctor|medicine|water|rest|sit|lie down|call|mom|dad|ambulance|nurse|juice|take you)\b/,
    solved: { en: 'I feel a little better already, because you took care of me.', bn: 'তুমি যত্ন নিয়েছ বলে আমার একটু ভালো লাগছে।' },
    hint: { en: 'Let us go to the hospital', bn: 'চলো হাসপাতালে যাই' },
    symptom: 'stomachache',
  },
  lostfriend: {
    setup: (w) => { W.addObject(w, 'tree', { x: 20, y: 72, size: 'big' }); W.addObject(w, 'slide', { x: 80, y: 74 }); },
    intro: { en: 'I can not find my friend Tutu the duck anywhere! We were playing and now Tutu is gone. Will you help me look?', bn: 'আমার বন্ধু হাঁস টুটুকে কোথাও খুঁজে পাচ্ছি না! আমরা খেলছিলাম, আর এখন টুটু নেই। তুমি খুঁজতে সাহায্য করবে?' },
    solve: /\b(call|shout|tutu|name|look|behind|under|tree|slide|pond|water|search|find|ask|where|whistle|duck)\b/,
    solved: { en: 'Quack quack! There is Tutu, behind the slide! We found Tutu together!', bn: 'প্যাঁক প্যাঁক! ওই তো টুটু, স্লাইডের পেছনে! আমরা একসাথে টুটুকে পেয়েছি!' },
    hint: { en: 'Let us call Tutu\'s name', bn: 'চলো টুটুর নাম ধরে ডাকি' },
    reward: 'duck',
  },
  stuck: {
    setup: (w) => { W.addObject(w, 'present_box', { x: 55, y: 74, size: 'big' }); },
    intro: { en: 'Uh oh. The big box tipped over and my ball rolled under it. The box is too heavy for me alone! Can you help?', bn: 'ইশ। বড় বাক্সটা উল্টে গেছে আর আমার বলটা নিচে ঢুকে গেছে। বাক্সটা আমার একার জন্য খুব ভারী! সাহায্য করবে?' },
    solve: /\b(lift|push|pull|together|move|open|strong|one two three|count|help you|team|both|heavy|carry|roll)\b/,
    solved: { en: 'One, two, three... HEAVE! We moved the box together and got my ball back!', bn: 'এক, দুই, তিন... হেইয়ো! আমরা একসাথে বাক্সটা সরালাম আর আমার বল পেয়ে গেলাম!' },
    hint: { en: 'Let us lift it together', bn: 'চলো একসাথে তুলি' },
    reward: 'ball',
  },
};

export function enter(session, ctx) {
  const { lang } = ctx;
  const r = createReply('enter_emergency');
  const keys = Object.keys(PROBLEMS);
  const last = session.lastProblem;
  const key = pick(keys.filter((k) => k !== last));
  session.lastProblem = key;
  const p = PROBLEMS[key];
  session.sceneState = { problem: key, steps: 0, resolved: false, reassured: false, waiting: false, silences: 0 };
  p.setup(session.world);
  r.pet(p.intro[lang] || p.intro.en, key === 'unwell' ? 'sick' : 'worried', 'wobble');
  r.suggest(lang === 'bn' ? 'চিন্তা করো না, আমি সাহায্য করব' : 'Do not worry, I will help you', p.hint[lang] || p.hint.en);
  r.skill('helping_others');
  return r;
}

export function handle(session, n, ctx) {
  const { lang, pet } = ctx;
  const st = session.sceneState;
  const p = PROBLEMS[st.problem];
  const s = n.norm;
  const r = createReply('emergency');

  if (st.resolved) {
    if (/\b(again|another problem|more|new problem|one more)\b/.test(s)) {
      session.world.objects = []; session.world.characters = [];
      const e = enter(session, ctx);
      e.intent = 'emergency_again';
      return e;
    }
    return null; // let global intents handle (go home etc.)
  }

  // Reassurance
  if (/\b(do not worry|dont worry|it is okay|its okay|i will help|i am here|i help|no problem|i am coming|be brave|calm down|you are safe|we can do it|everything will be fine|i will save)\b/.test(s)) {
    st.reassured = true; st.steps++;
    r.pet(lang === 'bn'
      ? pick(['তুমি বললে চিন্তা করো না... আমার সাহস বেড়ে গেল! এখন কী করব?', 'ধন্যবাদ, বন্ধু। তুমি আছ বলে আমি ভয় পাচ্ছি না। কী করা যায়?'])
      : pick(['You said you will help me... I feel braver already! What should we do first?', 'Thank you, friend. With you here, I am not scared anymore. What is the plan?']), 'relieved', 'bounce');
    r.event('hearts');
    r.skill('helping_others', 'expressing_feelings');
    r.suggest(p.hint[lang] || p.hint.en, lang === 'bn' ? 'কাউকে ফোন করি' : 'We need to call someone');
    if (st.steps >= 3) return resolve(session, ctx, r);
    return r;
  }

  // Call someone
  if (/\b(call|phone|ring|999|dial|contact|tell (mom|dad|ammu|abbu|teacher|police))\b/.test(s)) {
    st.steps++;
    const whoM = /\b(mom|mum|ammu|dad|abbu|baba|police|teacher|grandma|grandpa|doctor|ambulance|friend|firefighter|uncle|aunt|aunty|tutu)\b/.exec(s);
    const who = whoM ? whoM[1] : 'helper';
    const map = { mom: 'mom', mum: 'mom', ammu: 'mom', dad: 'dad', abbu: 'dad', baba: 'dad', police: 'police', teacher: 'teacher', grandma: 'grandma', grandpa: 'grandpa', doctor: 'doctor', ambulance: 'doctor', friend: 'friend', firefighter: 'firefighter', uncle: 'dad', aunt: 'mom', aunty: 'mom', tutu: 'duck', helper: 'friend' };
    const ckey = map[who] || 'friend';
    W.addObject(session.world, 'phone', { x: 40, y: 62, size: 'small' });
    r.event('phone');
    r.pet(lang === 'bn' ? 'দারুণ বুদ্ধি! ক্রিং ক্রিং... হ্যালো?' : 'Great idea! Ring ring... ring ring... Hello?', 'thinking');
    const helperLine = lang === 'bn' ? 'হ্যালো! আমি আসছি! কী হয়েছে বলো তো?' : 'Hello! I am on my way! Tell me, what happened?';
    const helperNames = lang === 'bn'
      ? { mom: 'আম্মু', dad: 'আব্বু', police: 'পুলিশ আঙ্কেল', teacher: 'টিচার', grandma: 'নানু', grandpa: 'দাদু', doctor: 'ডাক্তার মিতু', friend: 'সাহায্যকারী করিম', firefighter: 'দমকলকর্মী রিনা', duck: 'টুটু' }
      : { mom: 'Mom', dad: 'Dad', police: 'Officer Hasan', teacher: 'Teacher', grandma: 'Grandma', grandpa: 'Grandpa', doctor: 'Dr. Mitu', friend: 'Helper Karim', firefighter: 'Firefighter Rina', duck: 'Tutu' };
    const ch = W.addCharacter(session.world, ckey, { line: helperLine, role: 'helper', name: helperNames[ckey] || ckey });
    if (ch) r.char(ckey, ch.name, ch.emoji, helperLine);
    r.pet(lang === 'bn' ? 'তুমি বুঝিয়ে বলো কী হয়েছে!' : 'You explain what happened — you are good at that!', 'relieved');
    st.helperCalled = ckey;
    r.skill('giving_instructions', 'requesting');
    return r;
  }

  // Explaining the problem to the helper (after a call)
  if (st.helperCalled && (/\b(kite|tree|stuck|lost|dizzy|sick|tummy|friend|duck|box|ball|heavy|hurt|way home|cannot find|can not find|please|help)\b/.test(s) || n.tokens.length >= 4)) {
    st.steps++;
    const ch = session.world.characters.find((c) => c.key === st.helperCalled);
    const line = lang === 'bn' ? 'বুঝেছি! তুমি খুব সুন্দর করে বললে। চলো একসাথে ঠিক করি!' : 'I understand! You explained it so well. Let us fix this together!';
    if (ch) { ch.line = line; r.char(ch.key, ch.name, ch.emoji, line); }
    r.skill('describing', 'answering');
    return resolve(session, ctx, r);
  }

  // Wait here, I'll find help
  if (/\b(wait here|stay here|wait|i will find help|i will get help|i will be back|i will come back|stay there|sit here)\b/.test(s)) {
    st.steps++; st.waiting = true;
    W.addObject(session.world, 'bench', { x: 60, y: 78 });
    r.pet(lang === 'bn' ? 'আচ্ছা, আমি এই বেঞ্চে নিরাপদে বসে থাকি। তাড়াতাড়ি এসো!' : 'Okay! I will sit right here on this bench, safe and sound. Come back soon!', 'relieved');
    r.event('child_leaves');
    const line = lang === 'bn' ? 'হ্যালো! তুমি আমাকে ডেকে আনলে? কী সাহায্য লাগবে?' : 'Hello! You came to find me? How can I help, little one?';
    const ch = W.addCharacter(session.world, 'friend', { name: lang === 'bn' ? 'পার্কের দারোয়ান' : 'Park helper Karim', line, role: 'helper' });
    if (ch) r.char('friend', ch.name, ch.emoji, line);
    st.helperCalled = 'friend';
    r.skill('giving_instructions', 'helping_others');
    return r;
  }

  // Go to hospital when unwell
  if (st.problem === 'unwell' && /\b(hospital|doctor|clinic)\b/.test(s)) {
    return { goTo: 'hospital', carry: { symptom: 'stomachache' }, prefix: lang === 'bn' ? 'হ্যাঁ, ডাক্তারের কাছে যাই। তুমি সাথে থাকলে ভয় লাগে না।' : 'Yes, let us go see the doctor. With you beside me, I am not scared.' };
  }

  // Problem-specific solution
  if (p.solve.test(s)) {
    st.steps++;
    if (st.problem === 'kite' && /\b(ladder|stairs)\b/.test(s)) W.addObject(session.world, 'ladder', { x: 66, y: 66, size: 'big' });
    if (st.problem === 'kite' && /\bgiraffe\b/.test(s)) W.addCharacter(session.world, 'giraffe', { line: lang === 'bn' ? 'আমি নিয়ে আসছি!' : 'I will get it for you!' });
    if (st.problem === 'unwell' && /\b(water|juice)\b/.test(s)) W.addObject(session.world, /\bjuice\b/.test(s) ? 'juice' : 'water', { x: 45, y: 64, size: 'small' });
    if (st.problem === 'lost' && /\b(map|phone)\b/.test(s)) W.addObject(session.world, /\bmap\b/.test(s) ? 'map' : 'phone', { x: 45, y: 64, size: 'small' });
    const encouragements = lang === 'bn'
      ? ['দারুণ বুদ্ধি! চলো করি...', 'হ্যাঁ! তুমি ভালো ভেবেছ। চেষ্টা করি...']
      : ['Great idea! Let us try it...', 'Yes! That is clever thinking. Here we go...', 'Okay, I trust you! Let us do it...'];
    r.pet(pick(encouragements), 'excited', 'bounce');
    r.skill('giving_instructions', 'helping_others');
    if (st.steps >= 2 || /\b(ladder|together|map|directions|call tutu|lift)\b/.test(s)) return resolve(session, ctx, r);
    r.pet(lang === 'bn' ? 'প্রায় হয়ে গেছে! আর কী করা যায়?' : 'Almost there! What else could we try?', 'thinking');
    return r;
  }

  // Any instruction-like utterance counts as effort
  if (/\b(lets|let us|we should|we need|go|get|take|bring|find|look|try|use|put|we can|you should|you can|first|then)\b/.test(s) && n.tokens.length >= 2) {
    st.steps++;
    r.pet(lang === 'bn' ? 'আচ্ছা, চেষ্টা করি! তুমি নেতৃত্ব দাও।' : 'Okay, let us try that! You lead the way.', 'relieved');
    r.skill('giving_instructions');
    if (st.steps >= 3) return resolve(session, ctx, r);
    r.pet(lang === 'bn' ? 'হুম, আর কী করা যায়?' : 'Hmm, what else could we do?', 'thinking');
    return r;
  }

  // Questions from the child
  if (/\b(what happened|are you okay|are you hurt|where|why|how|what is wrong|does it hurt)\b/.test(s)) {
    r.pet((p.intro[lang] || p.intro.en), 'worried');
    r.skill('asking_questions');
    return r;
  }
  return null;
}

function resolve(session, ctx, r) {
  const { lang } = ctx;
  const st = session.sceneState;
  const p = PROBLEMS[st.problem];
  st.resolved = true;
  W.setPetState(session.world, 'normal');
  if (st.problem === 'kite') { session.world.objects = session.world.objects.filter((o) => o.key !== 'kite'); W.addObject(session.world, 'kite', { x: 40, y: 20 }); }
  if (p.reward) W.addObject(session.world, p.reward, { x: 45, y: 70 });
  if (st.problem === 'lostfriend') W.addCharacter(session.world, 'duck', { name: 'Tutu', line: lang === 'bn' ? 'প্যাঁক! আমি এখানে!' : 'Quack! Here I am!' });
  r.event('confetti');
  r.pet(p.solved[lang] || p.solved.en, 'happy', 'jump');
  r.pet(lang === 'bn'
    ? 'আমরা পেরেছি! তুমি আমাকে সাহায্য করলে। তুমি দারুণ বন্ধু! এবার বাড়ি যাব, নাকি অন্য কিছু খেলব?'
    : 'We did it! You helped me when I needed it. You are a wonderful friend! Want to go home, or play something else?', 'love');
  r.skill('helping_others');
  r.suggest(lang === 'bn' ? 'আরেকটা সমস্যা' : 'Another problem!', lang === 'bn' ? 'চলো বাড়ি যাই' : 'Let us go home');
  return r;
}

export function silenceReply(session, ctx) {
  const { lang } = ctx;
  const st = session.sceneState;
  const p = PROBLEMS[st.problem];
  const r = createReply('silence');
  st.silences = (st.silences || 0) + 1;
  const phrase = lang === 'bn' ? 'চিন্তা করো না, আমি সাহায্য করব' : 'Do not worry, I will help you';
  if (st.silences === 1) r.pet(lang === 'bn' ? `আমি এখানে নিরাপদে আছি। সময় নাও। চাইলে বলতে পারো "${phrase}"।` : `I am safe right here. Take your time. If you like, you can say "${phrase}".`, 'relieved');
  else if (st.silences === 2) r.pet(lang === 'bn' ? 'আমরা একটু একসাথে বসতে পারি। অথবা একটা বোতাম চাপতে পারো।' : `We can also just sit together for a bit. Or you can tap a button. I am okay.`, 'happy');
  else r.pet(lang === 'bn' ? `তাড়া নেই। আমি এখানে আছি। আমরা পরেও চেষ্টা করতে পারি।` : `No hurry at all. I am okay here with you. We can try later, too.`, 'happy');
  r.suggest(phrase, p.hint[lang] || p.hint.en);
  return r;
}
