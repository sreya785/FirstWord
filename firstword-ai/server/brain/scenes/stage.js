// Stage show / public speaking scene.
import * as W from '../world.js';
import { find, pick } from '../normalize.js';
import { createReply } from '../reply.js';
import * as qwen from '../qwen.js';

const AUDIENCE = ['rabbit', 'elephant', 'owl', 'monkey'];

export function enter(session, ctx) {
  const { lang, pet } = ctx;
  const r = createReply('enter_stage');
  session.sceneState = { stage: 'prep', type: null, lines: 0, topic: null, encouraged: 0 };
  for (const a of AUDIENCE) W.addCharacter(session.world, a, { line: '', role: 'audience' });
  W.addObject(session.world, 'microphone', { x: 50, y: 60 });
  r.pet(lang === 'bn'
    ? 'ইয়ে, একটা শো! আজ তুমি কী করবে — গল্প, গান, নাকি অন্য কিছু? তুমি ঠিক করো!'
    : 'Yay, a show! Everyone came to listen. What will you perform today — a story, a song, or something else? You decide!', 'excited', 'bounce');
  r.pet(lang === 'bn' ? 'চাইলে আমি আগে যেতে পারি।' : 'And if you want, I can go first.', 'happy');
  return r;
}

const REACTIONS = {
  en: ['The audience claps!', 'Ooooh! says the audience.', 'The bunny giggles.', 'The elephant trumpets happily!', 'Everyone leans in to listen.', 'The owl nods wisely.'],
  bn: ['দর্শকরা হাততালি দিল!', 'ওওও! বলল দর্শকরা।', 'খরগোশটা খিলখিল করে হাসল।', 'হাতিটা খুশিতে ডাক দিল!', 'সবাই মন দিয়ে শুনছে।', 'পেঁচাটা মাথা নাড়ল।'],
};
const PROMPTS = {
  en: ['And then what happened?', 'Tell them more!', 'What happened next?', 'Who else was there?', 'How did it end?', 'What did the {x} do then?', 'Why did that happen?', 'What did everyone say?'],
  bn: ['তারপর কী হলো?', 'ওদের আরও বলো!', 'এরপর কী হলো?', 'আর কে ছিল সেখানে?', 'শেষে কী হলো?', '{x} তারপর কী করল?', 'কেন এমন হলো?'],
};

export async function handle(session, n, ctx) {
  const { lang, pet } = ctx;
  const st = session.sceneState;
  const s = n.norm;
  const r = createReply('stage');

  // Shy / scared / don't want to
  if (/\b(scared|shy|nervous|do not want|dont want|not now|i can not|i cannot|too many people|afraid)\b/.test(s)) {
    st.encouraged++;
    session.world.spotlight = false;
    r.pet(lang === 'bn'
      ? 'ঠিক আছে। একদম তাড়া নেই। আমরা একসাথে বসে আগে তারা দেখতে পারি। অথবা আমি আগে যাই?'
      : 'That is completely okay. No rush at all. We can sit together and watch the stars first. Or I can go first — want to hear my silly song?', 'love');
    r.skill('expressing_feelings');
    r.setPending({ type: 'pet_goes_first' });
    r.suggest(lang === 'bn' ? 'তুমি আগে যাও' : 'You go first', lang === 'bn' ? 'একসাথে বসি' : 'Let us sit together');
    return r;
  }
  if (/\b(you go first|you first|you perform|you sing|you tell|show me first|you do it)\b/.test(s)) return petPerforms(session, ctx, r);

  // Introduce the pet
  if (/\b(introduce|this is my|meet my|my friend|my pet|say hello everyone|say hi to everyone)\b/.test(s)) {
    st.stage = 'performing'; st.lines++;
    session.world.spotlight = true;
    r.pet(lang === 'bn'
      ? `হ্যালো সবাই! আমি ${pet.name}, আর এ আমার সেরা বন্ধু ${ctx.child}! (মাথা নোয়াল)`
      : `Hello, everyone! I am ${pet.name}, and this is my best friend ${ctx.child}! (bows)`, 'proud', 'bow');
    r.event('applause');
    r.pet(lang === 'bn' ? 'তুমি আমার পরিচয় দিলে! এবার তোমার পালা। কী বলবে?' : 'You introduced me! Now it is your turn. What will you tell them?', 'excited');
    r.skill('role_play', 'greeting_politeness');
    return r;
  }

  // The end
  if (/\b(the end|that is all|finished|i am done|thank you everyone|thank you all|bye everyone|end of story|that is the end|all done)\b/.test(s)) {
    if (st.stage === 'performing') {
      st.stage = 'finished';
      session.world.spotlight = false;
      r.event('confetti', 'applause');
      const praise = lang === 'bn'
        ? `ব্রাভো! তুমি সবার সামনে ${st.lines} বার কথা বললে! দর্শকরা দাঁড়িয়ে হাততালি দিচ্ছে!`
        : `Bravo! You spoke in front of everyone — ${st.lines} whole turns! The audience is standing up and clapping!`;
      r.pet(praise, 'proud', 'jump');
      r.pet(lang === 'bn' ? 'আরেকটা শো করবে, নাকি অন্য কোথাও যাব?' : 'Do you want to do another show, or go somewhere else?', 'happy');
      r.skill('storytelling');
      r.suggest(lang === 'bn' ? 'আরেকটা গল্প' : 'Another story', lang === 'bn' ? 'চলো বাড়ি যাই' : 'Let us go home');
      return r;
    }
  }

  // Deciding what to perform
  const storyStart = /\b(story|once upon a time|tell you about|i will tell|today i will|i am going to tell|long ago|one day)\b/.test(s);
  const songStart = /\b(song|sing|singing|la la)\b/.test(s);
  const danceStart = /\b(dance|dancing)\b/.test(s);
  const jokeStart = /\b(joke|funny)\b/.test(s);
  const describeStart = /\b(describe|tell you about my|talk about|show you)\b/.test(s);
  // Child jumps straight into the content ("Once upon a time...") or a long utterance: start performing silently
  const directStart = st.stage !== 'performing' && (/\b(once upon a time|one day|long ago|la la|there was)\b/.test(s) || n.tokens.length >= 7) && !/\b(i will|i am going to|today i|about)\b/.test(s);
  if (directStart) {
    st.type = st.type || (songStart ? 'song' : 'story'); st.stage = 'performing'; st.lines = 0;
    session.world.spotlight = true;
    r.event('spotlight');
  }
  if (!directStart && (st.stage !== 'performing' || (st.lines > 0 && (storyStart && /\b(now|another|new|different|change)\b/.test(s))))) {
    if (storyStart || songStart || danceStart || jokeStart || describeStart || st.stage === 'prep') {
      const type = songStart ? 'song' : danceStart ? 'dance' : jokeStart ? 'joke' : describeStart ? 'talk' : 'story';
      const topicM = /\babout ((a |an |the |my )?[\p{L}' ]+)/u.exec(s);
      st.type = type; st.stage = 'performing'; st.lines++;
      st.topic = topicM ? topicM[1].trim() : (find.objects(n)[0] ? `a ${find.objects(n)[0].word}` : null);
      session.world.spotlight = true;
      r.event('spotlight');
      const intro = {
        story: lang === 'bn' ? `দারুণ! ${st.topic ? st.topic + ' নিয়ে ' : ''}একটা গল্প! মঞ্চ তোমার। আমি এখানেই আছি।` : `Wonderful! A story${st.topic ? ' about ' + st.topic : ''}! The stage is yours. I am right here beside you.`,
        song: lang === 'bn' ? 'একটা গান! সবাই শুনছে। শুরু করো যখন চাও।' : 'A song! Everyone is listening. Start whenever you are ready — I will sway along.',
        dance: lang === 'bn' ? 'নাচ! আমি ছন্দ দিচ্ছি: তা-ধিন-ধিন! বলো তুমি কী নাচছ!' : 'A dance! I will clap the beat: ta-dhin-dhin! Tell us what dance you are doing!',
        joke: lang === 'bn' ? 'একটা কৌতুক! আমি হাসার জন্য তৈরি।' : 'A joke! I am ready to laugh. Go ahead!',
        talk: lang === 'bn' ? 'তুমি সবাইকে বলবে! শুনছি।' : 'You will tell everyone about it! We are all ears.',
      }[type];
      r.pet(intro, 'excited', 'bounce');
      if (st.lines === 1 && ctx.level >= 3) r.pet(lang === 'bn' ? 'শুরু করো: "এক দেশে ছিল..."' : 'You could start with "Once upon a time..."', 'happy');
      r.skill('storytelling', 'giving_instructions');
      r.suggest(lang === 'bn' ? 'এক দেশে ছিল...' : 'Once upon a time...', lang === 'bn' ? 'শেষ!' : 'The end!');
      return r;
    }
  }

  // Performing: every utterance is part of the show
  if (st.stage === 'performing') {
    st.lines++;
    const words = n.tokens.length;
    const nouns = find.objects(n).concat(find.characters(n));
    const topic = nouns[0]?.word || st.topic || (lang === 'bn' ? 'গল্পটা' : 'the story');
    if (words >= 4 || st.lines % 2 === 0) r.event('applause_soft');

    const clientKey = session?.clientKey || ctx?.clientKey || null;
    if (qwen.isRoleEnabled('stage_audience', lang, clientKey)) {
      const aiAudience = await qwen.generateRoleReply({
        role: 'stage_audience',
        lang,
        utterance: n.raw,
        clientKey,
        context: { topic, type: st.type, lines: st.lines },
      });
      if (aiAudience) {
        const audChar = AUDIENCE[st.lines % AUDIENCE.length];
        const audName = lang === 'bn' ? 'দর্শক' : 'Audience';
        r.char('audience', audName, '👏', aiAudience, { key: audChar });
      }
    }

    const reaction = pick(REACTIONS[lang] || REACTIONS.en);
    const plist = PROMPTS[lang] || PROMPTS.en;
    let prompt = (st.lines <= 2 ? plist[st.lines % 2 === 0 ? 2 : 0] : pick(plist.slice(1))).replace('{x}', topic);
    if (ctx.level <= 2) prompt = lang === 'bn' ? 'তারপর?' : 'And then?';
    if (words >= 10) r.pet(lang === 'bn' ? `ওয়াও! ${reaction} ${prompt}` : `Wow, that was a big part! ${reaction} ${prompt}`, 'excited', 'bounce');
    else r.pet(`${reaction} ${prompt}`, 'happy');
    r.skill('storytelling');
    if (st.lines >= 4 && st.lines % 4 === 0) r.pet(lang === 'bn' ? 'চাইলে বলতে পারো "শেষ!"' : 'Whenever you like, you can say "The end!"', 'happy');
    return r;
  }
  return null;
}

function petPerforms(session, ctx, r) {
  const { lang, pet } = ctx;
  const st = session.sceneState;
  session.world.spotlight = true;
  r.event('spotlight');
  r.pet(lang === 'bn'
    ? `আচ্ছা, আমি আগে! (গলা পরিষ্কার) এক দেশে ছিল এক ছোট্ট ${pet.name}, যে বড় একটা রংধনু খুঁজতে চাইত... শেষ! হি হি, ছোট্ট গল্প।`
    : `Okay, me first! (clears throat) Once upon a time, a little ${pet.name} wanted to find the biggest rainbow in the world. It walked and walked... and found it right above its best friend! The end! Hee hee, that was a tiny story.`, 'silly', 'bow');
  r.event('applause');
  r.pet(lang === 'bn' ? 'দেখলে? ছোট্ট হলেও চলে। তুমি চাইলে এবার তোমার পালা — তাড়া নেই।' : 'See? Even a tiny story counts. Your turn whenever you want — no rush at all.', 'love');
  st.stage = 'prep';
  r.setPending(null);
  return r;
}

export function onPending(session, pending, yes, ctx) {
  if (pending.type === 'pet_goes_first' && yes) return petPerforms(session, ctx, createReply('stage_pet_first'));
  return null;
}

export function silencePhrase(session, ctx) {
  const st = session.sceneState;
  if (st.stage === 'performing') return ctx.lang === 'bn' ? 'তারপর...' : 'And then...';
  return ctx.lang === 'bn' ? 'আজ আমি একটা গল্প বলব' : 'Today I will tell you a story';
}
