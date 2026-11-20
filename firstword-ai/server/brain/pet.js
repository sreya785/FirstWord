// Pet personality: bilingual line templates, moods and helpers.
import { pick, cap } from './normalize.js';
import { PET_TYPES } from './lexicon.js';

// Template tokens: {pet} pet name, {child} child name, {x} generic
const LINES = {
  en: {
    greet_first: [
      'Hi {child}! I am {pet}, your friend. I am SO happy you are here! What shall we do today?',
      'Yay, {child} is here! I am {pet}. We can go anywhere you like. What do you want to do?',
    ],
    greet_back: [
      'Hello again, {child}! I missed you. What shall we do today?',
      'Hi {child}! I was waiting for you. Where should we go today?',
    ],
    hello: ['Hello hello! I am so happy to hear your voice!', 'Hi {child}! Hi hi hi!', 'Hello! You sound great today!'],
    bye: ['Bye bye, {child}! Come back soon. I will keep our world safe!', 'See you soon, {child}! It was so fun talking with you.'],
    thanks: ['You are welcome, {child}! You said thank you — that was so kind.', 'Aww, you are welcome!'],
    praised: ['Aww, {child}! That makes my heart go boom boom! I love you too!', 'You are the best friend ever, {child}! Big hug!', 'Yay! I am so happy you said that!'],
    love: ['I love you too, {child}! You are my best friend in the whole world!'],
    name: ['My name is {pet}! And you are {child}, my best friend.', 'I am {pet}! {pet}, {pet}, {pet}! Do you like my name?'],
    how_are_you: ['I am great, because you are here! How are you feeling today?', 'I am happy and a little bit silly today. How are you?'],
    age: ['I am three and a half! That is almost a big kid. How old are you?'],
    likes: ['I love {x}! What do you love?', 'My favorite things are {x}. What are yours?'],
    fav_color: ['My favorite color is {x}! What is your favorite color?'],
    fav_food: ['Mmm, I love {x}! What is your favorite food?'],
    like_yes: ['Oh yes, I like {x} a lot! Do you like it too?', 'I LOVE {x}! Why do you like it?'],
    like_no: ['Hmm, {x} is not my favorite. But I will try it with you! What else do you like?', 'Not really... {x} makes me go "eek". What do you like instead?'],
    who_am_i: ['You are {child}, my best friend!', 'You are {child}! The one who makes our world so fun.'],
    what_doing: ['I am playing with you! That is my favorite thing to do.'],
    can_you: ['Watch me! Wheee! Can you do it too?'],
    dance: ['Dance time! Wiggle wiggle, hop hop! Dance with me!'],
    jump: ['Boing! Boing! I can jump really high! How high can you jump?'],
    fly: ['Wheee, I am flying! Look at me go! Where should we fly to?'],
    sing: ['La la la, {child} is my friend, la la laaa! Your turn — sing something!'],
    sleep: ['Yaaawn... okay, a tiny nap. Zzz... Wake me up when you want to play!'],
    story_ask: ['Once upon a time, there was a little {x} who wanted to find a rainbow. One day the {x} met... who do you think it met?'],
    play: ['Yes! Let us play! Should we go to a restaurant, a shop, the doctor, the stage, or build our own world?'],
    hide: ['Hide and seek! I will hide... Okay, I am hiding behind the big tree! Can you find me? Say "found you!"'],
    found: ['You found me! You are so good at this. Now you hide and I will count. One... two... three...'],
    // feelings
    feel_happy: ['Yay! When you are happy, I am happy too! What made you happy today?'],
    feel_sad: ['Oh, {child}. It is okay to feel sad. I am right here with you. Do you want to tell me about it, or should we do something fun together?'],
    feel_angry: ['It is okay to feel angry. Let us take a big breath together... in... and out. Do you want to tell me what happened?'],
    feel_scared: ['I am here with you, {child}. You are safe. We can go slowly. What would make you feel better?'],
    feel_tired: ['Being tired is okay. We can do something slow and quiet. Should we watch the clouds or hear a short story?'],
    feel_hungry: ['Hungry? Let us go to the restaurant! Say "let us go to the restaurant" and I will take you there.'],
    feel_sick: ['Oh no, I hope you feel better soon. Should we visit the doctor together so you can see how it works?'],
    // support
    dont_know: ['That is okay! Not knowing is fine. You could say "I want to play" or "let us go somewhere". Or I can choose?', 'No problem at all. We can take it slow. Want me to show you some things we can say?'],
    help_me: ['Of course! You can tell me where to go, like "let us go to the shop", or what to make, like "make a dragon". Or just tell me how you feel!'],
    try_again: ['No rush, {child}. Whenever you are ready.'],
    silence_1: ['Take your time, {child}. I am right here. You could say "{x}".', 'No hurry! When you are ready, you could try saying "{x}".'],
    silence_2: ['It is okay to be quiet too. I will just sit here with you for a bit. If you like, tap a button, or say "{x}".'],
    silence_3: ['I am happy just being with you. Whenever you want, we can play. I will hum a little song... hmm hmm hmm.'],
    // fallback
    fb_noun: ['Ooh, {x}! Tell me more about the {x}.', 'A {x}! I like that. What happens with the {x}?', 'You said {x}! What should we do with the {x}?'],
    fb_question: ['Good question! Hmm, what do YOU think?', 'That is a great question. I think... hmm. What do you think the answer is?'],
    fb_long: ['Wow, you told me so much! I especially liked the part about {x}. What happened next?', 'That is a big story! Tell me what happened after that.'],
    fb_short: ['Mm-hmm! I am listening. Can you tell me a little more?', 'Okay! And then? Tell me more.', 'I hear you! What do you want to do next?'],
    fb_recast: ['{x}! Got it. You can also say "{y}".'],
    affirm: ['Great! Let us do it!', 'Yes! I like that plan.', 'Okay!'],
    negate: ['Okay, no problem. We can do something else. What would you like instead?', 'That is fine! You can change your mind. What should we do instead?'],
    changed_mind: ['Okay, you changed your mind — that is totally fine!', 'Sure! Changing your mind is allowed.'],
    // navigation
    go_to: ['Okay! Let us go to the {x}!', 'To the {x} we go! Hold my paw!', 'Yes! The {x}! Follow me!'],
    go_home: ['Home sweet home! What should we do here?'],
    cannot_go: ['Hmm, I am not sure where that is yet. We can build it! Say "make a {x}" and I will try.'],
    // world building
    built: ['Ta-da! {x} appeared!', 'Poof! Here is {x}, just like you said!', 'Done! {x}, coming right up!'],
    built_many: ['Poof poof poof! {x} appeared!', 'Here they are: {x}! Our world is getting big!'],
    built_q: ['What should we build next?', 'What do you think happens next?', 'Who lives there?', 'What color should it be?', 'Should we add something else?', 'What should we name it?'],
    char_arrives: ['Look who is here! The {x} says hello. What should we say to the {x}?', 'A {x} came to visit us! Do you want to talk to the {x}?'],
    color_changed: ['Swish! Now the {x} is {y}. Do you like it?', 'Okay, {y} {x}! It looks lovely.'],
    weather_rain: ['Pitter patter, pitter patter! It is raining. Should we get an umbrella or jump in puddles?'],
    weather_snow: ['Brrr! Snow! Let us catch snowflakes on our tongues. Should we build a snowman?'],
    weather_clear: ['The sun is out! What a beautiful day.'],
    weather_rainbow: ['A rainbow! Red, orange, yellow, green, blue, purple! Which color do you like best?'],
    weather_wind: ['Whoosh! The wind is blowing. Hold on to your hat!'],
    time_night: ['It is night time now. Look at all the stars! Should we count them?'],
    time_day: ['Good morning, world! The sun is up. What shall we do today?'],
    time_sunset: ['Ooh, the sunset is so pretty. Orange and pink!'],
    role_set: ['Okay! Now you are the {x} and I am the {y}. Let us start!', 'Fun! I am the {y} and you are the {x}. Ready?'],
    role_pet: ['Okay, I am the {y} now! Here I go...'],
    role_child: ['You are the {x}! And I will be your helper.'],
    removed: ['Poof! The {x} is gone.', 'Okay, no more {x}.'],
    nothing_to_remove: ['I do not see a {x} here. Should we make one first?'],
    new_situation: ['You are doing so well! Should we try something new? We could visit the {x}.'],
    model_longer: ['You said "{x}". You can also say "{y}".'],
  },
  bn: {
    greet_first: ['হাই {child}! আমি {pet}, তোমার বন্ধু। তুমি এসেছ বলে আমি খুব খুশি! আজ আমরা কী করব?'],
    greet_back: ['আবার হ্যালো, {child}! তোমাকে মিস করেছি। আজ আমরা কোথায় যাব?'],
    hello: ['হ্যালো হ্যালো! তোমার কণ্ঠ শুনে আমি খুব খুশি!', 'হাই {child}! হাই হাই হাই!'],
    bye: ['টাটা, {child}! আবার এসো। আমি আমাদের জগৎটা দেখে রাখব!'],
    thanks: ['তোমাকেও ধন্যবাদ, {child}! তুমি "ধন্যবাদ" বলেছ — খুব সুন্দর।'],
    praised: ['আউ, {child}! আমার মন খুশিতে নাচছে! আমিও তোমাকে ভালোবাসি!', 'তুমি সেরা বন্ধু, {child}! বড় একটা জড়িয়ে ধরা!'],
    love: ['আমিও তোমাকে ভালোবাসি, {child}! তুমি আমার সবচেয়ে ভালো বন্ধু!'],
    name: ['আমার নাম {pet}! আর তুমি {child}, আমার সেরা বন্ধু।'],
    how_are_you: ['আমি খুব ভালো আছি, কারণ তুমি এসেছ! তুমি কেমন আছ?'],
    age: ['আমার বয়স সাড়ে তিন! তোমার বয়স কত?'],
    likes: ['আমি {x} খুব পছন্দ করি! তুমি কী পছন্দ করো?'],
    fav_color: ['আমার প্রিয় রং {x}! তোমার প্রিয় রং কী?'],
    fav_food: ['আমি {x} খেতে ভালোবাসি! তোমার প্রিয় খাবার কী?'],
    like_yes: ['হ্যাঁ, আমি {x} খুব পছন্দ করি! তুমিও করো?'],
    like_no: ['হুম, {x} আমার খুব একটা পছন্দ না। তুমি আর কী পছন্দ করো?'],
    who_am_i: ['তুমি {child}, আমার সেরা বন্ধু!'],
    what_doing: ['আমি তোমার সাথে খেলছি! এটাই আমার সবচেয়ে প্রিয় কাজ।'],
    can_you: ['দেখো আমাকে! হুউউ! তুমিও পারো?'],
    dance: ['নাচের সময়! দুলি দুলি, লাফ লাফ! আমার সাথে নাচো!'],
    jump: ['বোইং! বোইং! আমি অনেক উঁচুতে লাফাতে পারি! তুমি কত উঁচুতে লাফাতে পারো?'],
    fly: ['হুউউ, আমি উড়ছি! আমরা কোথায় উড়ে যাব?'],
    sing: ['লা লা লা, {child} আমার বন্ধু, লা লা লা! এবার তুমি গাও!'],
    sleep: ['হাআআই... আচ্ছা, একটু ঘুম। ঝিম ঝিম... খেলতে চাইলে আমাকে ডেকো!'],
    story_ask: ['এক দেশে ছিল একটা ছোট্ট {x}, যে রংধনু খুঁজতে চাইত। একদিন {x} দেখা পেল... কার সাথে দেখা হলো বলো তো?'],
    play: ['হ্যাঁ! চলো খেলি! রেস্টুরেন্ট, দোকান, ডাক্তার, মঞ্চ, নাকি নিজের জগৎ বানাব?'],
    hide: ['লুকোচুরি! আমি লুকাচ্ছি... বড় গাছটার পেছনে! আমাকে খুঁজে পাও? বলো "পেয়েছি!"'],
    found: ['তুমি আমাকে খুঁজে পেয়েছ! এবার তুমি লুকাও, আমি গুনছি। এক... দুই... তিন...'],
    feel_happy: ['ইয়ে! তুমি খুশি হলে আমিও খুশি! আজ কী তোমাকে খুশি করল?'],
    feel_sad: ['ও {child}। মন খারাপ হতেই পারে। আমি তোমার পাশে আছি। বলবে কী হয়েছে, নাকি একসাথে মজার কিছু করব?'],
    feel_angry: ['রাগ হতেই পারে। চলো একসাথে বড় একটা শ্বাস নিই... ভেতরে... বাইরে। কী হয়েছে বলবে?'],
    feel_scared: ['আমি তোমার সাথে আছি, {child}। তুমি নিরাপদ। আমরা ধীরে ধীরে যাব। কী করলে তোমার ভালো লাগবে?'],
    feel_tired: ['ক্লান্ত লাগা ঠিক আছে। আমরা শান্ত কিছু করতে পারি। মেঘ দেখব, নাকি ছোট্ট একটা গল্প শুনবে?'],
    feel_hungry: ['খিদে পেয়েছে? চলো রেস্টুরেন্টে যাই! বলো "চলো রেস্টুরেন্টে যাই"।'],
    feel_sick: ['ইশ, তুমি তাড়াতাড়ি সুস্থ হয়ে ওঠো। চলো একসাথে ডাক্তারের কাছে যাই?'],
    dont_know: ['ঠিক আছে! না জানলেও সমস্যা নেই। তুমি বলতে পারো "আমি খেলতে চাই" বা "চলো কোথাও যাই"। নাকি আমি বেছে নেব?'],
    help_me: ['অবশ্যই! তুমি বলতে পারো কোথায় যাবে, যেমন "চলো দোকানে যাই", বা কী বানাবে, যেমন "একটা ড্রাগন বানাও"।'],
    try_again: ['তাড়া নেই, {child}। যখন তুমি প্রস্তুত।'],
    silence_1: ['সময় নাও, {child}। আমি এখানেই আছি। তুমি বলতে পারো "{x}"।'],
    silence_2: ['চুপ থাকাও ঠিক আছে। আমি তোমার পাশে একটু বসি। চাইলে একটা বোতাম চাপো, বা বলো "{x}"।'],
    silence_3: ['তোমার সাথে থাকতেই আমার ভালো লাগে। যখন চাও, খেলব। আমি একটু গুনগুন করি... হুম হুম হুম।'],
    fb_noun: ['ওহ, {x}! {x} নিয়ে আরও বলো।', '{x}! ভালো লাগল। {x} দিয়ে কী হবে?'],
    fb_question: ['ভালো প্রশ্ন! তুমি কী মনে করো?'],
    fb_long: ['বাহ, তুমি অনেক কিছু বললে! {x} এর অংশটা আমার খুব ভালো লেগেছে। তারপর কী হলো?'],
    fb_short: ['হুম! আমি শুনছি। আরেকটু বলবে?', 'আচ্ছা! তারপর? আরও বলো।'],
    fb_recast: ['{x}! বুঝেছি। তুমি এভাবেও বলতে পারো: "{y}"।'],
    affirm: ['দারুণ! চলো করি!', 'হ্যাঁ! প্ল্যানটা ভালো।', 'আচ্ছা!'],
    negate: ['ঠিক আছে, সমস্যা নেই। অন্য কিছু করি। কী করতে চাও?'],
    changed_mind: ['আচ্ছা, তুমি মত বদলেছ — একদম ঠিক আছে!'],
    go_to: ['আচ্ছা! চলো {x} যাই!', '{x}! আমার হাত ধরো!'],
    go_home: ['বাড়ি! এখানে কী করব?'],
    cannot_go: ['হুম, ওটা কোথায় আমি এখনো জানি না। আমরা বানাতে পারি! বলো "একটা {x} বানাও"।'],
    built: ['টা-ডা! {x} এসে গেল!', 'পুফ! এই যে {x}!'],
    built_many: ['পুফ পুফ পুফ! {x} এসে গেল!'],
    built_q: ['এরপর কী বানাব?', 'তারপর কী হয় বলো তো?', 'ওখানে কে থাকে?', 'কী রং হবে?', 'আর কিছু যোগ করব?'],
    char_arrives: ['দেখো কে এসেছে! {x} হ্যালো বলছে। {x}-কে কী বলব?'],
    color_changed: ['সুইশ! এখন {x} {y}। পছন্দ হয়েছে?'],
    weather_rain: ['টাপুর টুপুর! বৃষ্টি পড়ছে। ছাতা নেব, নাকি পানিতে লাফাব?'],
    weather_snow: ['ব্রররর! তুষার! চলো তুষারমানব বানাই?'],
    weather_clear: ['রোদ উঠেছে! কী সুন্দর দিন।'],
    weather_rainbow: ['রংধনু! লাল, কমলা, হলুদ, সবুজ, নীল, বেগুনি! কোন রং তোমার সবচেয়ে পছন্দ?'],
    weather_wind: ['হুশশ! বাতাস বইছে। টুপি ধরে রাখো!'],
    time_night: ['এখন রাত। কত তারা! গুনব?'],
    time_day: ['শুভ সকাল, পৃথিবী! সূর্য উঠেছে। আজ কী করব?'],
    time_sunset: ['ওহ, সূর্যাস্ত কী সুন্দর। কমলা আর গোলাপি!'],
    role_set: ['আচ্ছা! এখন তুমি {x} আর আমি {y}। শুরু করি!'],
    role_pet: ['আচ্ছা, আমি এখন {y}! শুরু...'],
    role_child: ['তুমি {x}! আর আমি তোমার সাহায্যকারী।'],
    removed: ['পুফ! {x} চলে গেল।'],
    nothing_to_remove: ['এখানে {x} দেখছি না। আগে একটা বানাব?'],
    new_situation: ['তুমি খুব ভালো করছ! নতুন কিছু করব? আমরা {x} যেতে পারি।'],
    model_longer: ['তুমি বললে "{x}"। তুমি এভাবেও বলতে পারো: "{y}"।'],
  },
};

export function say(lang, key, vars = {}, seed) {
  const table = LINES[lang]?.[key] || LINES.en[key] || [''];
  let s = pick(table, seed);
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v ?? ''));
  return s.replace(/\{[a-z]+\}/g, '').replace(/\s+/g, ' ').trim()
    .replace(/\b([Aa]) (?=(?!uni|use|one|eu|ewe)[aeiouAEIOU])/g, (m, a) => `${a}n `)
    .replace(/(^|[.!?]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase());
}

export function petProfile(petType, petName, lang = 'en') {
  const t = PET_TYPES[petType] || PET_TYPES.cat;
  return { ...t, type: petType, name: petName || (lang === 'bn' ? (t.bnName || t.name) : t.name) };
}

export const MOODS = ['happy', 'excited', 'sad', 'worried', 'thinking', 'sleepy', 'surprised', 'proud', 'sick', 'relieved', 'love', 'silly'];

export function ensureMood(m) {
  return MOODS.includes(m) ? m : 'happy';
}

export { cap };
