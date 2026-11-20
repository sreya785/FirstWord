// Hospital / doctor scene: describing a problem, answering questions, asking for help.
import * as L from '../lexicon.js';
import * as W from '../world.js';
import { find, pick } from '../normalize.js';
import { createReply } from '../reply.js';
import * as qwen from '../qwen.js';

const DOC = { key: 'doctor', name: 'Dr. Mitu', bnName: 'ডাক্তার মিতু', emoji: '👩‍⚕️' };

async function docSay(r, text, lang, utterance = '', context = {}, clientKey = null) {
  let line = text;
  if (utterance && qwen.isRoleEnabled('hospital_doctor', lang, clientKey)) {
    const aiLine = await qwen.generateRoleReply({
      role: 'hospital_doctor',
      lang,
      utterance,
      clientKey,
      context: { doctor: 'Dr. Mitu', ...context },
    });
    if (aiLine) line = aiLine;
  }
  r.char(DOC.key, lang === 'bn' ? DOC.bnName : DOC.name, DOC.emoji, line);
}
function symLabel(key, lang) { const s = L.SYMPTOMS[key]; return s ? (lang === 'bn' ? s.bnLabel : s.label) : key; }

export async function enter(session, ctx, carry = {}) {
  const { lang, pet } = ctx;
  const r = createReply('enter_hospital');
  const symptom = carry.symptom || session.sceneState?.carrySymptom || null;
  session.sceneState = { symptom, severity: 2, stage: 'arrive', described: false, answers: 0, helped: 0, checkup: !symptom && Math.random() < 0.3 };
  W.addCharacter(session.world, 'doctor', { name: lang === 'bn' ? DOC.bnName : DOC.name, line: '' });
  W.addObject(session.world, 'bed', { x: 78, y: 70 });
  W.addObject(session.world, 'stethoscope', { x: 22, y: 60, size: 'small' });
  if (session.sceneState.checkup) {
    await docSay(r, lang === 'bn' ? 'হ্যালো! আজ কি চেক-আপের জন্য এসেছ? তোমার বন্ধু কেমন আছে?' : 'Hello! Are you here for a check-up today? How is your friend feeling?', lang);
    r.pet(lang === 'bn' ? 'আমি ভালো আছি, কিন্তু ডাক্তার আমাকে দেখবে! তুমি ডাক্তারকে বলো আমি কেমন আছি।' : 'I feel okay, but the doctor will check me! Can you tell the doctor how I am doing?', 'thinking');
  } else {
    W.setPetState(session.world, 'sick');
    await docSay(r, lang === 'bn' ? 'হ্যালো! আজ কী হয়েছে?' : 'Hello there! What brings you here today?', lang);
    r.pet(lang === 'bn' ? 'উফ্‌... আমার ভালো লাগছে না। ডাক্তারকে বলবে আমার কী হয়েছে?' : 'Ohh... I do not feel so good. Can you tell the doctor what is wrong with me?', 'sick', 'wobble');
    if (symptom) r.suggest(lang === 'bn' ? `আমার বন্ধুর ${symLabel(symptom, 'bn')}` : `My pet has ${symLabel(symptom, 'en')}`);
  }
  r.skill('helping_others');
  return r;
}

export async function handle(session, n, ctx) {
  const { lang, pet } = ctx;
  const st = session.sceneState;
  const s = n.norm;
  const syms = find.symptoms(n);
  const r = createReply('hospital');

  // Child describes the problem
  if (syms.length && !/\bwhat should\b/.test(s)) {
    const key = syms[0].key;
    const isNewSymptom = st.symptom !== key;
    st.symptom = key; st.described = true; st.stage = 'describe';
    if (st.checkup) { st.checkup = false; W.setPetState(session.world, 'sick'); }
    const followUps = lang === 'bn'
      ? [`বুঝলাম, ${symLabel(key, 'bn')}। কখন থেকে এমন হচ্ছে?`, `আচ্ছা, ${symLabel(key, 'bn')}। ও কি অন্যরকম কিছু খেয়েছে, নাকি পড়ে গিয়েছিল?`, `${symLabel(key, 'bn')}! আমাকে বলার জন্য ধন্যবাদ। ব্যথাটা কি অনেক, নাকি একটু?`]
      : [`I see, ${symLabel(key, 'en')}. Since when has your friend felt like this?`, `Okay, ${symLabel(key, 'en')}. Did your friend eat anything unusual, or have a fall?`, `${symLabel(key, 'en').charAt(0).toUpperCase() + symLabel(key, 'en').slice(1)}! Thank you for telling me. Is it hurting a lot, or just a little?`];
    await docSay(r, isNewSymptom ? pick(followUps) : (lang === 'bn' ? 'হ্যাঁ, বুঝেছি। চলো দেখি...' : 'Yes, I understand. Let me take a look...'), lang, n.raw || n.norm);
    st.awaitingAnswer = isNewSymptom;
    r.pet(lang === 'bn' ? 'তুমি খুব সুন্দর করে বুঝিয়ে বললে।' : (ctx.level <= 2 ? 'You told the doctor! Good job.' : 'You explained that so clearly. I feel safer already.'), 'relieved');
    r.skill('describing', 'helping_others');
    if (n.tokens.length <= 2 && ctx.level <= 2) r.recast = lang === 'bn' ? `আমার বন্ধুর ${symLabel(key, 'bn')}।` : `My pet has ${symLabel(key, 'en')}.`;
    if (!isNewSymptom) return treat(session, ctx, r);
    return r;
  }

  // Any spoken attempt upon arrival describes the problem and moves forward
  if (st.stage === 'arrive' && !syms.length && n.tokens.length >= 1 && !/\b(what should|go home)\b/.test(s)) {
    const key = st.symptom || 'tummy';
    st.symptom = key; st.described = true; st.stage = 'describe';
    if (st.checkup) { st.checkup = false; W.setPetState(session.world, 'sick'); }
    docSay(r, lang === 'bn' ? 'বুঝতে পেরেছি। আমাকে বলার জন্য ধন্যবাদ! চলো একটু পরীক্ষা করে দেখি।' : 'I see. Thank you for telling me! Let me examine your friend.', lang);
    r.pet(lang === 'bn' ? 'তুমি ডাক্তারকে বললে! এবার একটু পরীক্ষা করবে।' : 'You spoke to the doctor! Now the doctor will take a look.', 'relieved');
    r.skill('describing', 'helping_others');
    return treat(session, ctx, r);
  }

  // Ask for help
  if (/\b(can you help|please help|help my|help him|help her|help it|make .* better|fix|cure|treat|give medicine|medicine|check|look at|examine)\b/.test(s)) {
    st.helped++;
    if (!st.symptom) {
      docSay(r, lang === 'bn' ? 'অবশ্যই সাহায্য করব! আগে বলো, তোমার বন্ধুর কোথায় ব্যথা?' : 'Of course I will help! First, tell me — where does your friend feel bad?', lang);
      r.pet(lang === 'bn' ? 'আমার পেটে একটু ব্যথা... বলবে?' : 'My tummy feels funny... can you tell the doctor?', 'sick');
      r.skill('requesting', 'helping_others');
      r.suggest(lang === 'bn' ? 'আমার বন্ধুর পেট ব্যথা' : 'My pet has a stomachache');
      return r;
    }
    docSay(r, lang === 'bn' ? 'অবশ্যই! তুমি সাহায্য চাইলে, খুব ভালো করেছ।' : 'Of course! Asking for help is exactly the right thing to do.', lang);
    r.skill('requesting', 'helping_others');
    return treat(session, ctx, r);
  }

  // "What should we do now?"
  if (/\b(what should|what now|what do we do|what next|what can we do|what do i do|how to help|what to do)\b/.test(s)) {
    st.answers++;
    if (st.severity <= 0) {
      docSay(r, lang === 'bn' ? 'এখন বাড়ি গিয়ে বিশ্রাম, পানি আর ভালোবাসা! আবার খেলতে পারো।' : 'Now you can go home! Rest, water, and lots of love. Then you can play again.', lang);
      r.pet(lang === 'bn' ? 'চলো বাড়ি যাই!' : 'Let us go home! I feel great.', 'happy', 'bounce');
      r.suggest(lang === 'bn' ? 'চলো বাড়ি যাই' : 'Let us go home');
    } else {
      docSay(r, lang === 'bn' ? 'তোমার বন্ধুর দরকার বিশ্রাম, একটু পানি, আর তোমার যত্ন। চলো একসাথে ওর হাত ধরি।' : 'Your friend needs rest, a little water, and your care. Let us hold its paw together while I check.', lang);
      st.severity--;
      r.event('heal');
      r.pet(lang === 'bn' ? 'তুমি পাশে থাকলে ভালো লাগে।' : 'Having you here makes it so much easier.', 'relieved');
      if (st.severity <= 0) finishRecovery(session, ctx, r);
    }
    r.skill('asking_questions', 'helping_others');
    return r;
  }

  // Answering doctor's questions (since when / what happened / how much)
  if (/\b(yesterday|today|morning|night|since|two days|three days|last|ago|ate|eat|too much|fell|fall|a lot|little|very|hurts|long time|week|hour|after|before|playing|running|cake|candy|ice cream|cold water|rain)\b/.test(s) || (st.awaitingAnswer && n.tokens.length >= 2 && !/\b(make|build|create|add|put|bring|go|lets|let us|want|remove)\b/.test(s))) {
    st.answers++;
    st.awaitingAnswer = false;
    st.stage = 'treat';
    if (!st.symptom) st.symptom = 'sick';
    const ack = lang === 'bn'
      ? pick(['বলার জন্য ধন্যবাদ। এটা জানা দরকার ছিল।', 'আচ্ছা, বুঝলাম। তুমি ভালো খেয়াল রেখেছ।'])
      : pick(['Thank you for telling me. That is very helpful.', 'I see. You noticed a lot — that helps me a lot.', 'Good, now I understand better.']);
    docSay(r, ack, lang);
    r.skill('answering', 'describing');
    return treat(session, ctx, r);
  }

  if (/\b(better|okay now|feel good|all better|are you okay|are you better|how do you feel|feeling better)\b/.test(s)) {
    if (st.severity <= 0) r.pet(lang === 'bn' ? 'হ্যাঁ! আমি একদম সুস্থ। তোমার জন্য!' : 'Yes! I feel all better, thanks to you!', 'happy', 'jump');
    else r.pet(lang === 'bn' ? 'একটু ভালো। তুমি পাশে আছ বলে।' : 'A little better, because you are here. Can you ask the doctor to help?', 'relieved');
    r.skill('asking_questions');
    return r;
  }
  if (/\b(scared|afraid|do not be scared|dont worry|do not worry|it is okay|you are brave|brave|hold my hand)\b/.test(s)) {
    r.pet(lang === 'bn' ? 'তুমি পাশে থাকলে আমি সাহসী হয়ে যাই।' : 'When you are with me, I feel brave.', 'love');
    r.skill('helping_others');
    return r;
  }
  return null;
}

function treat(session, ctx, r) {
  const { lang } = ctx;
  const st = session.sceneState;
  st.severity--;
  r.event('heal');
  const treatments = {
    stomachache: lang === 'bn' ? 'একটু ওষুধ আর গরম পানি। পেট ঠিক হয়ে যাবে।' : 'Some tummy medicine and warm water. The tummy will feel calm soon.',
    headache: lang === 'bn' ? 'একটু বিশ্রাম আর ঠান্ডা পট্টি।' : 'A little rest and a cool cloth on the head.',
    fever: lang === 'bn' ? 'জ্বরের ওষুধ, পানি আর বিশ্রাম।' : 'Some fever medicine, lots of water, and rest.',
    cough: lang === 'bn' ? 'মধু দিয়ে গরম পানি আর সিরাপ।' : 'Warm water with honey, and some syrup.',
    hurt: lang === 'bn' ? 'একটা ব্যান্ডেজ আর একটু আদর।' : 'A soft bandage and a gentle pat.',
    dizzy: lang === 'bn' ? 'বসে একটু জুস খাও।' : 'Sit down and sip a little juice.',
    toothache: lang === 'bn' ? 'দাঁত পরিষ্কার আর একটু ওষুধ।' : 'A gentle tooth check and a little medicine.',
    earache: lang === 'bn' ? 'কানের ড্রপ।' : 'A few ear drops.',
    eye: lang === 'bn' ? 'চোখের ড্রপ আর চোখ বন্ধ করে বিশ্রাম।' : 'Some eye drops and resting with closed eyes.',
    sad: lang === 'bn' ? 'একটা বড় আলিঙ্গন!' : 'A big warm hug. That is the best medicine.',
    sick: lang === 'bn' ? 'একটু ওষুধ আর বিশ্রাম।' : 'Some medicine and rest.',
  };
  const t = treatments[st.symptom] || treatments.sick;
  if (st.symptom === 'hurt') W.setOutfit(session.world, 'bandage');
  W.addObject(session.world, 'medicine', { x: 60, y: 64, size: 'small' });
  r.char(DOC.key, lang === 'bn' ? DOC.bnName : DOC.name, DOC.emoji, lang === 'bn' ? `এই নাও: ${t}` : `Here we go: ${t}`);
  if (st.severity <= 0) finishRecovery(session, ctx, r);
  else r.pet(lang === 'bn' ? 'আহ... একটু ভালো লাগছে।' : (ctx.level <= 2 ? 'Ahh... a little better.' : 'Ahh... a little better already. Can you ask the doctor what we should do now?'), 'relieved');
  return r;
}

function finishRecovery(session, ctx, r) {
  const { lang } = ctx;
  session.sceneState.stage = 'better';
  W.setPetState(session.world, 'normal');
  r.event('confetti');
  r.pet(lang === 'bn' ? 'আমি একদম ভালো হয়ে গেছি! তুমি আমাকে সাহায্য করলে। ধন্যবাদ, বন্ধু!' : 'I feel so much better! You helped me get well. Thank you, my friend!', 'happy', 'jump');
  r.char(DOC.key, lang === 'bn' ? DOC.bnName : DOC.name, DOC.emoji, lang === 'bn' ? 'তুমি দারুণ সাহায্যকারী। পরের বার দেখা হবে!' : 'You were a wonderful helper. See you next time — hopefully just for a check-up!');
  r.skill('helping_others');
  r.suggest(lang === 'bn' ? 'চলো বাড়ি যাই' : 'Let us go home', lang === 'bn' ? 'চলো পার্কে যাই' : 'Let us go to the park');
}

export function silencePhrase(session, ctx) {
  const st = session.sceneState;
  if (!st.described) return ctx.lang === 'bn' ? 'আমার বন্ধুর পেট ব্যথা' : 'My pet has a stomachache';
  return ctx.lang === 'bn' ? 'আপনি কি সাহায্য করবেন?' : 'Can you help my pet?';
}
