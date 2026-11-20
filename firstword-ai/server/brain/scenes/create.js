// "Create your own world" scene: open-ended building. Most building commands are handled
// by global intents in index.js; this module handles entering, special combos and chit-chat with characters.
import * as W from '../world.js';
import { find, pick } from '../normalize.js';
import { createReply } from '../reply.js';
import { say } from '../pet.js';

export function enter(session, ctx) {
  const { lang } = ctx;
  const r = createReply('enter_create');
  session.sceneState = { builds: 0, lastObject: null, lastCharacter: null };
  r.pet(lang === 'bn'
    ? 'এটা আমাদের নিজের জগৎ! এখানে তুমি যা বলবে, তাই হবে। প্রথমে কী বানাব?'
    : 'This is OUR world! Whatever you say, we can make it happen. What should we build first?', 'excited', 'bounce');
  r.suggest(lang === 'bn' ? 'সমুদ্রের পাশে একটা বাড়ি' : 'A house beside the sea', lang === 'bn' ? 'একটা ড্রাগন আসুক' : 'A dragon comes to visit');
  return r;
}

export function handle(session, n, ctx) {
  const { lang, pet } = ctx;
  const s = n.norm;
  const r = createReply('create');
  const st = session.sceneState;

  // Birthday party for the pet
  if (/\b(birthday|party)\b/.test(s) && /\b(for you|your|you)\b/.test(s)) {
    W.setLocation(session.world, 'party', lang);
    W.addObject(session.world, 'cake', { x: 50, y: 62, size: 'big' });
    W.addObject(session.world, 'balloons', { x: 20, y: 25 });
    W.addObject(session.world, 'balloons', { x: 80, y: 22 });
    W.addObject(session.world, 'gift', { x: 30, y: 74 });
    W.setOutfit(session.world, 'party');
    r.event('confetti');
    r.pet(lang === 'bn'
      ? `আমার জন্য পার্টি?! ওয়াও! এটা সবচেয়ে সুন্দর উপহার! কাকে কাকে দাওয়াত দেব?`
      : `A birthday party for ME?! Oh wow! This is the best surprise ever! Who should we invite?`, 'love', 'jump');
    r.skill('world_building', 'helping_others');
    r.suggest(lang === 'bn' ? 'ড্রাগনকে দাওয়াত দিই' : 'Invite the dragon', lang === 'bn' ? 'চলো গান গাই' : 'Let us sing');
    session.lastObjectKey = 'cake';
    return r;
  }

  // Blow candles / happy birthday
  if (/\b(happy birthday|blow|candles|make a wish)\b/.test(s)) {
    r.event('sparkle');
    r.pet(lang === 'bn' ? 'ফুউউ! ইচ্ছা করেছি: তোমার সাথে চিরকাল খেলা!' : 'Fwooo! I made a wish: to play with you forever!', 'love', 'bounce');
    r.skill('world_building');
    return r;
  }

  // Name the world / something
  const nameM = /\b(name|call) (it|this|the world|our world|him|her|them) ([\p{L}' ]+)/u.exec(s);
  if (nameM) {
    const name = nameM[3].trim();
    if (nameM[2].includes('world') || nameM[2] === 'it' || nameM[2] === 'this') {
      W.setCustomLabel(session.world, name.charAt(0).toUpperCase() + name.slice(1));
      r.pet(lang === 'bn' ? `${name}! কী সুন্দর নাম!` : `${name.charAt(0).toUpperCase() + name.slice(1)}! What a wonderful name for our world!`, 'proud');
    } else {
      const ch = session.world.characters[session.world.characters.length - 1];
      if (ch) ch.name = name;
      r.pet(lang === 'bn' ? `এখন থেকে ওর নাম ${name}!` : `From now on, its name is ${name}! Hello, ${name}!`, 'happy');
    }
    r.skill('world_building');
    return r;
  }

  // "Who lives there" / "what happens next" answers (storytelling in the world)
  if (n.tokens.length >= 6 && !/\b(make|build|add|put|create|bring|want)\b/.test(s)) {
    const nouns = find.objects(n).concat(find.characters(n));
    const topic = nouns[0]?.word;
    r.pet(topic
      ? (lang === 'bn' ? `${topic}! দারুণ গল্প হচ্ছে। তারপর কী হলো?` : `${topic.charAt(0).toUpperCase() + topic.slice(1)}! Our story is getting so good. And then what happened?`)
      : (lang === 'bn' ? 'ওয়াও, তুমি অনেক কিছু বললে! আর তারপর?' : 'Wow, that is a big idea! And then?'), 'excited');
    r.skill('storytelling', 'world_building');
    return r;
  }
  return null;
}

export function silencePhrase(session, ctx) {
  return pick(ctx.lang === 'bn' ? ['একটা বাড়ি বানাও', 'একটা ড্রাগন আসুক', 'রাত করো'] : ['Make a house', 'A dragon comes to visit', 'Make it night']);
}
