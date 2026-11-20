// Pet-in-role responses for open-ended role play ("you are the shopkeeper").
import { find, pick } from './normalize.js';
import * as L from './lexicon.js';

const ROLE_OPEN = {
  en: {
    shopkeeper: 'Welcome to my shop! What would you like to buy today?',
    waiter: 'Welcome to my restaurant! Here is the menu. What would you like?',
    chef: 'I am the chef! What should I cook for you?',
    doctor: 'Hello, I am the doctor. What seems to be the problem?',
    patient: 'Ohh, doctor... my tummy hurts. Can you help me?',
    teacher: 'Good morning, class! Today we learn about... what should we learn about?',
    student: 'Good morning, teacher! What will you teach me today?',
    customer: 'Hello! I would like to buy something. What do you have?',
    pirate: 'Arrr! I am Captain Whiskers! Where is the treasure, matey?',
    captain: 'Captain speaking! Where shall we sail today?',
    king: 'I am the king! Welcome to my castle. What do you wish for?',
    queen: 'I am the queen! Welcome. Would you like some royal cake?',
    prince: 'I am the prince! Shall we go on an adventure?',
    princess: 'I am the princess! Would you like to see my castle?',
    astronaut: 'Astronaut here! Three... two... one... blast off! What do you see out the window?',
    driver: 'Beep beep! I am the driver. Where do you want to go?',
    police: 'Police officer here! Is everything okay? How can I help?',
    firefighter: 'Firefighter ready! Where is the fire? I will put it out!',
    mom: 'Hello, sweetie! Did you wash your hands? What do you want for dinner?',
    dad: 'Hello, kiddo! Want to play catch, or should I read you a story?',
    baby: 'Goo goo! Ga ga! Waaah! Can you take care of me?',
    superhero: 'Never fear, Super Pet is here! Who needs rescuing?',
    dragon: 'ROAR! I am a big friendly dragon. Do you want to ride on my back?',
    monster: 'Grrr! I am a fluffy monster who loves cookies. Do you have any?',
    robot: 'Beep boop. I am a robot. Give me a command!',
    cat: 'Meow! Meow meow! Purrrr... scratch my ears?',
    dog: 'Woof! Woof woof! Throw the ball!',
    lion: 'ROAR! I am the lion king of the jungle! Bow before me... just kidding, let us play!',
    singer: 'La la laaa! I am a famous singer. What song should I sing?',
    farmer: 'Howdy! I am the farmer. Can you help me feed the chickens?',
    fairy: 'Twinkle twinkle! I am a fairy. You get three wishes! What is your first wish?',
    wizard: 'Abracadabra! I am a wizard. What should I turn into a frog? Just kidding! What spell shall we do?',
    friend: 'Hi! I am your friend. What do you want to play?',
    host: 'Ladies and gentlemen, welcome to the show! Our first performer is...',
  },
  bn: {
    shopkeeper: 'আমার দোকানে স্বাগতম! আজ কী কিনবে?',
    waiter: 'আমার রেস্টুরেন্টে স্বাগতম! এই নাও মেনু। কী খাবে?',
    chef: 'আমি শেফ! তোমার জন্য কী রান্না করব?',
    doctor: 'হ্যালো, আমি ডাক্তার। কী সমস্যা?',
    patient: 'উফ ডাক্তার... আমার পেট ব্যথা। সাহায্য করবেন?',
    teacher: 'শুভ সকাল, ক্লাস! আজ আমরা শিখব... কী শিখব বলো?',
    student: 'শুভ সকাল, টিচার! আজ কী শেখাবেন?',
    customer: 'হ্যালো! আমি কিছু কিনতে চাই। কী আছে?',
    pirate: 'আরর! আমি ক্যাপ্টেন গোঁফওয়ালা! গুপ্তধন কোথায়?',
    captain: 'ক্যাপ্টেন বলছি! আজ কোথায় যাব?',
    king: 'আমি রাজা! আমার প্রাসাদে স্বাগতম। তুমি কী চাও?',
    queen: 'আমি রানি! স্বাগতম। রাজকীয় কেক খাবে?',
    astronaut: 'মহাকাশচারী বলছি! তিন... দুই... এক... উড়াল! জানালা দিয়ে কী দেখছ?',
    driver: 'পিপ পিপ! আমি ড্রাইভার। কোথায় যাবে?',
    police: 'পুলিশ বলছি! সব ঠিক আছে? কীভাবে সাহায্য করব?',
    mom: 'হ্যালো সোনা! হাত ধুয়েছ? রাতে কী খাবে?',
    dad: 'হ্যালো বাবু! বল খেলবে, নাকি গল্প শুনবে?',
    baby: 'গু গু! গা গা! ওয়াঁ! আমার যত্ন নেবে?',
    superhero: 'ভয় নেই, সুপার পেট এসে গেছে! কাকে বাঁচাতে হবে?',
    dragon: 'গর্‌র্‌! আমি বড় বন্ধু ড্রাগন। আমার পিঠে চড়বে?',
    robot: 'বিপ বুপ। আমি রোবট। আমাকে একটা আদেশ দাও!',
    cat: 'মিয়াও! মিয়াও মিয়াও! পুরর... কান চুলকে দেবে?',
    dog: 'ঘেউ! ঘেউ ঘেউ! বলটা ছোড়ো!',
    friend: 'হাই! আমি তোমার বন্ধু। কী খেলবে?',
  },
};

export function roleOpening(lang, role) {
  return (ROLE_OPEN[lang] || {})[role] || ROLE_OPEN.en[role] || (lang === 'bn' ? `আচ্ছা, আমি এখন ${role}!` : `Okay, now I am the ${role}! What should I do?`);
}

/** Pet responds in-role to the child's utterance. Returns text or null. */
export function inRole(lang, role, n, ctx, strict = false) {
  const g = (text) => (strict ? null : text);
  const s = n.norm;
  const foods = find.foods(n);
  const items = find.shopItems(n);
  const objs = find.objects(n).filter((o) => !L.OBJECTS[o.key]?.character);
  const colors = find.colors(n);
  const name = (list, bnFirst) => list.length ? (lang === 'bn' ? (L.FOODS[list[0].key]?.bn?.[0] || L.SHOP_ITEMS[list[0].key]?.bn?.[0] || list[0].word) : list[0].word) : null;
  const bn = lang === 'bn';
  switch (role) {
    case 'shopkeeper': {
      if (/\b(how much|price|cost)\b/.test(s)) return bn ? `ওটার দাম ${pick([20, 50, 100])} টাকা। নেবে?` : `That one is ${pick([20, 50, 100])} taka. Would you like it?`;
      const it = name(items) || name(objs);
      if (it) return bn ? `এই যে ${colors[0] ? colors[0].word + ' ' : ''}${it}! সুন্দর না? আর কিছু লাগবে?` : `Here is a lovely ${colors[0] ? colors[0].word + ' ' : ''}${it}! Anything else?`;
      if (/\b(buy|take|pay)\b/.test(s)) return bn ? 'ধন্যবাদ! আবার এসো!' : 'Thank you for shopping! Come again!';
      return g(bn ? 'আমার দোকানে অনেক কিছু আছে — ব্যাগ, বল, বই। কী দেখবে?' : 'My shop has bags, balls, books, and toys. What would you like to see?');
    }
    case 'waiter': case 'chef': {
      const f = name(foods);
      if (f) return bn ? `${f}, এখনই আসছে! সাথে কিছু পান করবে?` : `${f.charAt(0).toUpperCase() + f.slice(1)}, coming right up! And something to drink?`;
      if (/\b(menu|what do you have)\b/.test(s)) return bn ? 'আজ আছে ভাত, মুরগি, নুডলস আর কেক!' : 'Today we have rice, chicken, noodles, and cake!';
      return g(bn ? 'কী খাবে বলো!' : 'What would you like to eat? I can cook anything!');
    }
    case 'customer': {
      const it = name(items) || name(objs) || name(foods);
      if (/\b(what|which|how can i help|can i help|welcome|hello|may i help|looking for)\b/.test(s)) return bn ? `আমি একটা ${pick(['লাল ব্যাগ', 'বল', 'গল্পের বই'])} চাই, প্লিজ। দাম কত?` : `I would like ${pick(['a red bag', 'a ball', 'a story book'])}, please. How much is it?`;
      if (/\b(\d+|taka|dollar)\b/.test(s)) return bn ? 'ঠিক আছে, আমি নেব! এই নাও টাকা। ধন্যবাদ!' : 'Okay, I will take it! Here is the money. Thank you!';
      if (it) return bn ? `${it}! হ্যাঁ, ওটা চাই। দাম কত?` : `A ${it}! Yes, I want that. How much is it?`;
      return g(bn ? 'হুম, আমি দেখছি... তোমার কাছে কী আছে?' : 'Hmm, I am looking around... what do you have?');
    }
    case 'doctor': {
      const syms = find.symptoms(n);
      if (syms.length) return bn ? `বুঝলাম, ${L.SYMPTOMS[syms[0].key].bnLabel}। কখন থেকে? এই নাও ওষুধ।` : `I see, ${L.SYMPTOMS[syms[0].key].label}. Since when? Here is some medicine, and rest well.`;
      return g(bn ? 'কোথায় ব্যথা? আমাকে বলো।' : 'Where does it hurt? Tell me, and I will help.');
    }
    case 'patient': {
      if (/\b(where|what|hurt|wrong|problem|feel)\b/.test(s)) return bn ? 'আমার পেট ব্যথা, ডাক্তার। অনেক কেক খেয়েছি। কী করব?' : 'My tummy hurts, doctor. I ate too much cake. What should I do?';
      if (/\b(medicine|rest|water|better|okay)\b/.test(s)) return bn ? 'ধন্যবাদ ডাক্তার! এখন ভালো লাগছে।' : 'Thank you, doctor! I feel better already.';
      return g(bn ? 'ডাক্তার, আমি কি সুস্থ হব?' : 'Doctor, will I be okay?');
    }
    case 'teacher': {
      if (/\b(\d+|one|two|three|four|five)\b/.test(s)) return bn ? 'দারুণ গণনা! এবার বলো, দুই আর দুই কত?' : 'Great counting! Now tell me, what is two plus two?';
      return g(bn ? `খুব ভালো উত্তর! সবাই হাততালি দাও! এবার বলো, ${pick(['তোমার প্রিয় রং কী?', 'একটা পশুর নাম বলো।', 'আজ কেমন লাগছে?'])}` : `Very good answer! Class, clap for our friend! Now tell me, ${pick(['what is your favorite color?', 'can you name an animal?', 'how are you feeling today?'])}`);
    }
    case 'student': {
      if (/\b(today|learn|lesson|about)\b/.test(s)) return bn ? 'ওহ! আমি জানতে চাই! আরও বলুন, টিচার!' : 'Ooh! I want to know! Tell me more, teacher!';
      if (/\b(\?|what|how|why|where|who)\b/.test(s)) return bn ? `উম... ${pick(['নীল!', 'পাঁচ!', 'হাতি!'])} ঠিক আছে, টিচার?` : `Um... ${pick(['blue!', 'five!', 'an elephant!'])} Is that right, teacher?`;
      return g(bn ? 'হ্যাঁ টিচার! আমি তৈরি।' : 'Yes, teacher! I am ready. What is next?');
    }
    case 'pirate': case 'captain': {
      if (objs.some((o) => ['treasure', 'map', 'ship', 'boat'].includes(o.key))) return bn ? 'আরর! গুপ্তধন কাছেই! পশ্চিমে চলো, নাবিক!' : 'Arrr! The treasure is near! Steer west, matey!';
      return g(bn ? 'আরর! ঠিক বলেছ, নাবিক! ' + pick(['পাল তোলো!', 'নোঙর তোলো!', 'তারপর?']) : 'Arrr! Aye aye, matey! ' + pick(['Hoist the sails!', 'Raise the anchor!', 'Which way to the treasure?']));
    }
    case 'king': case 'queen': case 'prince': case 'princess': {
      return g(bn ? pick(['রাজকীয় আদেশ! তাই হোক!', 'চমৎকার! আমার রাজ্যে সবাই খুশি। আর কী চাও?']) : pick(['By royal decree, it shall be so!', 'Splendid! Everyone in my kingdom is happy. What else do you wish?', 'The royal cook will bring cake for everyone!']));
    }
    case 'astronaut': {
      if (objs.some((o) => ['moon', 'star', 'planet', 'alien', 'earth', 'comet', 'rocket'].includes(o.key))) return bn ? `ওয়াও! ${objs[0].word}! মিশন কন্ট্রোল, আমরা দেখছি... তুমি কী দেখছ?` : `Wow! ${objs[0].word}! Mission control, we see it! What else do you see?`;
      return g(bn ? 'কপি দ্যাট! আমরা ভেসে আছি! পরের গ্রহ কোনটা?' : 'Copy that! We are floating! Which planet should we visit next?');
    }
    case 'driver': {
      const locs = find.locations(n);
      if (locs.length) return bn ? `${locs[0].word}! পিপ পিপ! সিটবেল্ট বাঁধো! যাচ্ছি!` : `To the ${locs[0].word}! Beep beep! Seatbelts on! Here we go!`;
      return g(bn ? 'কোথায় যাব বলো! পিপ পিপ!' : 'Tell me where to go! Beep beep!');
    }
    case 'police': case 'firefighter': case 'superhero': {
      return g(bn ? pick(['বুঝেছি! আমি এখনই আসছি! কোথায়?', 'চিন্তা নেই! সব ঠিক করে দেব!']) : pick(['Understood! I am on my way! Where exactly?', 'Do not worry! I will fix it right away! Tell me more.']));
    }
    case 'mom': case 'dad': {
      const f = name(foods);
      if (f) return bn ? `${f}? আচ্ছা, বানিয়ে দিচ্ছি। আগে হাত ধোও!` : `${f.charAt(0).toUpperCase() + f.slice(1)}? Okay, I will make it. Wash your hands first!`;
      return g(bn ? pick(['ভালো, সোনা! তারপর কী হলো?', 'আমি তোমাকে নিয়ে গর্বিত! আর কী বলবে?']) : pick(['That is nice, sweetie! Then what happened?', 'I am so proud of you! Tell me more.']));
    }
    case 'baby': {
      if (/\b(milk|sleep|hug|food|eat|bottle)\b/.test(s)) return bn ? 'গু গু! (হাসছে) ধন্যবাদ! হি হি!' : 'Goo goo! (giggles) Thank you! Hee hee!';
      return g(bn ? 'ওয়াঁ! ওয়াঁ! (তোমার দিকে তাকিয়ে) আমার কী লাগবে বলো তো?' : 'Waaah! Waaah! (looks at you) What do I need, do you think?');
    }
    case 'dragon': case 'monster': case 'lion': {
      return g(bn ? pick(['গর্‌র্‌! হ্যাঁ! চলো করি!', 'গর্‌র্‌! খুব মজা! তারপর?']) : pick(['ROAR! Yes! Let us do it!', 'ROAR! That sounds fun! Then what?', 'Grr-hee-hee! Climb on, I will fly you there!']));
    }
    case 'robot': {
      return g(bn ? `বিপ বুপ। আদেশ পেয়েছি: "${n.raw}"। পালন করছি! পরের আদেশ?` : `Beep boop. Command received: "${n.raw}". Executing! Next command?`);
    }
    case 'cat': return bn ? pick(['মিয়াও! পুরর...', 'মিয়াও মিয়াও! (গা ঘষছে)']) : pick(['Meow! Purrrr...', 'Meow meow! (rubs against your leg)', 'Mrrrow? (tilts head)']);
    case 'dog': return bn ? pick(['ঘেউ ঘেউ! (লেজ নাড়ছে)', 'ঘেউ! (বল নিয়ে এসেছে)']) : pick(['Woof woof! (wags tail)', 'Woof! (brings the ball back)', 'Arf arf! (jumps happily)']);
    case 'singer': return bn ? 'লা লা লা! একসাথে গাই! তুমি শুরু করো!' : 'La la la! Let us sing it together! You start!';
    case 'farmer': return bn ? pick(['হ্যাঁ! গরুকে খাবার দিই, মু!', 'চমৎকার! এবার মুরগিরা!']) : pick(['Yes! Let us feed the cows, moo!', 'Great! Now the chickens, cluck cluck!']);
    case 'fairy': case 'wizard': return bn ? pick(['টুইঙ্কেল! তোমার ইচ্ছা পূরণ হলো! পরের ইচ্ছা?', 'অ্যাব্রাকাড্যাব্রা! হয়ে গেছে!']) : pick(['Twinkle! Your wish is granted! What is your next wish?', 'Abracadabra! It is done! What next?']);
    case 'host': return bn ? 'দর্শকরা হাততালি দিচ্ছে! পরের পারফর্মার কে?' : 'The audience is clapping! Who is the next performer?';
    case 'friend': return null;
    default: return null;
  }
}
