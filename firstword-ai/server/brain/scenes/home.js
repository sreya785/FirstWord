// Home scene (default) + kitchen mini-scene + generic places (park, beach, ...).
import * as W from '../world.js';
import * as L from '../lexicon.js';
import { find, pick } from '../normalize.js';
import { createReply } from '../reply.js';

const PLACE_LINES = {
  en: {
    home: 'Home sweet home! What should we do here? We can cook, play, or go somewhere new.',
    park: 'The park! Fresh air! Do you want to go on the slide, fly a kite, or look for birds?',
    beach: 'The beach! I can hear the waves. Should we build a sandcastle or look for shells?',
    space: 'We are in space! Everything floats! Look, there is the moon. What do you see?',
    garden: 'A garden full of flowers! Butterflies everywhere! Which flower is your favorite?',
    school: 'School! Who is the teacher today — you, me, or the owl?',
    forest: 'The forest is so quiet... shh! I hear an owl. What do you hear?',
    castle: 'A castle in the clouds! Should we be the king and queen, or the brave knights?',
    farm: 'The farm! Moo! Cluck cluck! Which animal should we feed first?',
    city: 'The big city! So many cars and rickshaws! Where should we go — the mall, the park, or a restaurant?',
    underwater: 'Blub blub! We are under the sea! A fish just winked at me. What do you see?',
    mountain: 'The mountain top! We can see so far! What can you see from up here?',
    zoo: 'The zoo! Lions, elephants, monkeys! Which animal should we visit first?',
    kitchen: 'The kitchen! Let us cook! Chef, what are we making today?',
    party: 'A party! Balloons, music, cake! Who is the party for?',
    snow: 'Brrr, snowy land! Should we build a snowman or have a snowball fight?',
    pirate: 'Ahoy! We are on a pirate ship! Arrr! Captain, where is the treasure?',
  },
  bn: {
    home: 'বাড়ি! এখানে কী করব? আমরা রান্না করতে পারি, খেলতে পারি, বা নতুন কোথাও যেতে পারি।',
    park: 'পার্ক! কী সুন্দর বাতাস! স্লাইডে চড়বে, ঘুড়ি ওড়াবে, নাকি পাখি দেখবে?',
    beach: 'সমুদ্র! ঢেউয়ের শব্দ শুনছ? বালুর দুর্গ বানাব, নাকি ঝিনুক খুঁজব?',
    space: 'আমরা মহাকাশে! সব ভাসছে! ওই যে চাঁদ। তুমি কী দেখছ?',
    garden: 'ফুলে ভরা বাগান! প্রজাপতি উড়ছে! কোন ফুল তোমার প্রিয়?',
    school: 'স্কুল! আজ টিচার কে — তুমি, আমি, নাকি পেঁচা?',
    forest: 'বনটা কত শান্ত... শশশ! পেঁচার ডাক শুনছি। তুমি কী শুনছ?',
    castle: 'মেঘের প্রাসাদ! আমরা রাজা-রানি হব, নাকি সাহসী নাইট?',
    farm: 'খামার! হাম্বা! কক কক! কোন প্রাণীকে আগে খাওয়াব?',
    city: 'বড় শহর! কত গাড়ি আর রিকশা! কোথায় যাব — মল, পার্ক, নাকি রেস্টুরেন্ট?',
    underwater: 'ভুড়ভুড়! আমরা সমুদ্রের নিচে! একটা মাছ আমাকে চোখ টিপল। তুমি কী দেখছ?',
    mountain: 'পাহাড়ের চূড়া! কত দূর দেখা যায়! তুমি কী দেখছ?',
    zoo: 'চিড়িয়াখানা! সিংহ, হাতি, বানর! কাকে আগে দেখব?',
    kitchen: 'রান্নাঘর! চলো রান্না করি! শেফ, আজ কী বানাব?',
    party: 'পার্টি! বেলুন, গান, কেক! পার্টিটা কার জন্য?',
    snow: 'ব্রররর, বরফের দেশ! তুষারমানব বানাব, নাকি বরফ ছোড়াছুড়ি?',
    pirate: 'আহোই! আমরা জলদস্যু জাহাজে! আরর! ক্যাপ্টেন, গুপ্তধন কোথায়?',
  },
};

export function enterPlace(session, ctx, location) {
  const { lang } = ctx;
  const r = createReply(`enter_${location}`);
  session.sceneState = { place: location, cooked: [], fed: [] };
  if (location === 'space') W.setOutfit(session.world, 'astronaut');
  else if (location === 'kitchen') W.setOutfit(session.world, 'chef');
  else if (location === 'party') W.setOutfit(session.world, 'party');
  else if (location === 'pirate') W.setOutfit(session.world, 'pirate');
  else if (location === 'castle') W.setOutfit(session.world, 'crown');
  else W.setOutfit(session.world, null);
  if (location === 'farm') for (const k of ['cow', 'chicken', 'goat']) W.addCharacter(session.world, k, { line: '' });
  if (location === 'zoo') for (const k of ['lion', 'elephant', 'monkey']) W.addCharacter(session.world, k, { line: '' });
  if (location === 'underwater') for (const k of ['fish', 'octopus']) W.addObject(session.world, k, {});
  if (location === 'beach') { W.addObject(session.world, 'shell', { x: 30, y: 85, size: 'small' }); W.addObject(session.world, 'sandcastle', { x: 70, y: 80 }); }
  if (location === 'park') { W.addObject(session.world, 'slide', { x: 75, y: 72 }); W.addObject(session.world, 'tree', { x: 15, y: 70, size: 'big' }); }
  if (location === 'space') { W.addObject(session.world, 'moon', { x: 80, y: 12, size: 'big' }); W.addObject(session.world, 'rocket', { x: 20, y: 70 }); }
  if (location === 'school') { W.addCharacter(session.world, 'owl', { line: '' }); W.addObject(session.world, 'book', { x: 60, y: 76 }); }
  if (location === 'kitchen') { W.addObject(session.world, 'table', { x: 50, y: 76 }); }
  const line = (PLACE_LINES[lang] || PLACE_LINES.en)[location] || PLACE_LINES.en.home;
  r.pet(line, location === 'home' ? 'happy' : 'excited', 'bounce');
  return r;
}

export function handle(session, n, ctx) {
  const { lang } = ctx;
  const s = n.norm;
  const st = session.sceneState || {};
  const place = session.world.location;
  const r = createReply('place');

  // Kitchen cooking
  if (place === 'kitchen') {
    const foods = find.foods(n);
    if (foods.length) {
      const f = foods[0];
      st.cooked = st.cooked || [];
      st.cooked.push(f.key);
      W.addObject(session.world, f.key, { x: 35 + st.cooked.length * 10, y: 64 });
      r.event('sparkle');
      const fname = lang === 'bn' ? L.FOODS[f.key].bn[0] : f.word;
      const steps = lang === 'bn'
        ? [`${fname}! দারুণ। প্রথমে কী লাগবে?`, `${fname} রান্না হচ্ছে! নাড়ো নাড়ো! এরপর কী দেব?`, `${fname} তৈরি! কাকে খাওয়াব?`]
        : [`${fname.charAt(0).toUpperCase() + fname.slice(1)}! Yummy. What do we need first?`, `${fname.charAt(0).toUpperCase() + fname.slice(1)} is cooking! Stir, stir! What should we add next?`, `${fname.charAt(0).toUpperCase() + fname.slice(1)} is ready! Who should we share it with?`];
      r.pet(steps[Math.min(st.cooked.length - 1, 2)], 'excited', 'bounce');
      r.skill('giving_instructions', 'world_building');
      return r;
    }
    if (/\b(stir|mix|cut|chop|pour|add|salt|sugar|oil|water|boil|fry|bake|oven|hot|careful)\b/.test(s)) {
      r.pet(lang === 'bn' ? pick(['নাড়ছি! সাবধানে, গরম! এরপর?', 'আচ্ছা, শেফ! হয়ে গেছে। তারপর?']) : pick(['Stirring! Careful, it is hot! What next, chef?', 'Yes, chef! Done. And then?', 'Sizzle sizzle! It smells so good. What do we add now?']), 'happy');
      r.skill('giving_instructions');
      return r;
    }
  }

  // Farm / zoo feeding & animals
  if ((place === 'farm' || place === 'zoo') && /\b(feed|food|eat|give|milk|pet|touch|see|visit|look at)\b/.test(s)) {
    const animals = find.objects(n).filter((o) => L.OBJECTS[o.key].character);
    if (animals.length) {
      const a = animals[0];
      const ch = W.addCharacter(session.world, a.key, { line: lang === 'bn' ? 'ইয়াম ইয়াম! ধন্যবাদ!' : (L.OBJECTS[a.key].line || 'Yum yum! Thank you!') });
      if (ch) r.char(a.key, ch.name, ch.emoji, lang === 'bn' ? 'ইয়াম ইয়াম! ধন্যবাদ!' : (L.OBJECTS[a.key].line || 'Yum yum! Thank you!'));
      r.pet(lang === 'bn' ? `${a.word} খুব খুশি! এরপর কাকে?` : `The ${a.word} is so happy! Who is next?`, 'happy', 'bounce');
      r.skill('helping_others', 'requesting');
      return r;
    }
  }

  // Beach: sandcastle / shells / swim
  if (place === 'beach' && /\b(sandcastle|sand castle|build .* sand|shell|shells|swim|swimming|wave|waves|splash)\b/.test(s)) {
    if (/\bsand/.test(s)) { W.addObject(session.world, 'sandcastle', { x: 40 + Math.random() * 20, y: 78, size: 'big' }); r.event('sparkle'); }
    if (/\bshell/.test(s)) W.addObject(session.world, 'shell', { x: 20 + Math.random() * 60, y: 85, size: 'small' });
    r.pet(/\bswim|splash|wave/.test(s)
      ? (lang === 'bn' ? 'ঝপাং! পানি কী মজার! সাবধানে, বড় ঢেউ!' : 'Splash! The water is so fun! Careful, big wave coming!')
      : (lang === 'bn' ? 'দেখো আমরা কী বানালাম! এটাকে কী নাম দেবে?' : 'Look what we made! What should we call it?'), 'excited', 'jump');
    r.skill('world_building');
    return r;
  }

  // Park: slide / swing / kite
  if (place === 'park' && /\b(slide|swing|kite|run|race|catch)\b/.test(s)) {
    if (/\bkite/.test(s)) W.addObject(session.world, 'kite', { x: 60, y: 20 });
    r.pet(lang === 'bn' ? pick(['হুউউ! আবার!', 'দৌড়! তুমি জিতে গেলে! আবার খেলি?']) : pick(['Wheee! Again, again!', 'Ready, set, go! You won! Should we play again?', 'Up, up, up goes the kite! Hold the string tight!']), 'excited', 'jump');
    r.skill('giving_instructions');
    return r;
  }

  // Space: look around
  if (place === 'space' && /\b(see|look|float|moon|star|planet|alien|earth|land)\b/.test(s)) {
    const objs = find.objects(n);
    if (objs.length) W.addObject(session.world, objs[0].key, {});
    r.pet(lang === 'bn' ? 'ওয়াও! মহাকাশ কত বড়! এরপর কোথায় যাব?' : 'Whoa! Space is so big! I feel like I am floating... where should we fly next?', 'surprised', 'bounce');
    r.skill('describing');
    return r;
  }
  return null;
}
