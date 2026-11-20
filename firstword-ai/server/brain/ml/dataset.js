// Training data generator for the intent classifier (English + Bangla).
// Templates with slots are expanded with words from the shared lexicon, so the
// classifier learns the same vocabulary the rule engine knows — plus paraphrases
// the rules may miss. Deterministic (seeded) so `npm run train` is reproducible.
import * as L from '../lexicon.js';

export const INTENTS = [
  'go_restaurant', 'go_shop', 'go_hospital', 'go_stage', 'go_emergency', 'go_create', 'go_home', 'go_place',
  'order_food', 'ask_price', 'buy_item', 'symptom', 'call_help', 'perform',
  'build', 'remove', 'color', 'weather', 'time', 'role_assign',
  'greet', 'bye', 'thanks', 'affirm', 'negate',
  'feel_happy', 'feel_sad', 'feel_scared', 'feel_angry', 'feel_tired',
  'pet_question', 'praise', 'ask_help', 'chitchat',
];

export const INTENT_LABELS = {
  en: {
    go_restaurant: 'Go to the restaurant', go_shop: 'Go to the shop', go_hospital: 'Go to the doctor', go_stage: 'Go to the stage', go_emergency: 'Help my pet', go_create: 'Create our own world', go_home: 'Go home', go_place: 'Go to another place',
    order_food: 'Order food', ask_price: 'Ask the price', buy_item: 'Ask for / buy an item', symptom: 'Describe a symptom', call_help: 'Call for help', perform: 'Sing / tell a story / dance',
    build: 'Make something appear', remove: 'Make something disappear', color: 'Change a colour', weather: 'Change the weather', time: 'Change day / night', role_assign: 'Assign roles (pretend play)',
    greet: 'Greeting', bye: 'Goodbye', thanks: 'Thank you', affirm: 'Yes', negate: 'No',
    feel_happy: 'Feeling happy', feel_sad: 'Feeling sad', feel_scared: 'Feeling scared / worried', feel_angry: 'Feeling angry', feel_tired: 'Feeling tired',
    pet_question: 'Question for the pet', praise: 'Praise / affection', ask_help: 'Asking what to say', chitchat: 'Just chatting',
  },
  bn: {
    go_restaurant: 'রেস্টুরেন্টে যাওয়া', go_shop: 'দোকানে যাওয়া', go_hospital: 'ডাক্তারের কাছে যাওয়া', go_stage: 'মঞ্চে যাওয়া', go_emergency: 'বন্ধুকে সাহায্য', go_create: 'নিজের জগৎ বানানো', go_home: 'বাড়ি যাওয়া', go_place: 'অন্য জায়গায় যাওয়া',
    order_food: 'খাবার অর্ডার', ask_price: 'দাম জিজ্ঞেস', buy_item: 'জিনিস চাওয়া / কেনা', symptom: 'অসুখের কথা বলা', call_help: 'সাহায্য ডাকা', perform: 'গান / গল্প / নাচ',
    build: 'কিছু বানানো', remove: 'কিছু সরানো', color: 'রং বদলানো', weather: 'আবহাওয়া বদলানো', time: 'দিন / রাত বদলানো', role_assign: 'ভূমিকা দেওয়া (সাজা)',
    greet: 'সম্ভাষণ', bye: 'বিদায়', thanks: 'ধন্যবাদ', affirm: 'হ্যাঁ', negate: 'না',
    feel_happy: 'খুশি লাগছে', feel_sad: 'মন খারাপ', feel_scared: 'ভয় / চিন্তা', feel_angry: 'রাগ', feel_tired: 'ক্লান্ত',
    pet_question: 'বন্ধুকে প্রশ্ন', praise: 'প্রশংসা / আদর', ask_help: 'কী বলব জানতে চাওয়া', chitchat: 'এমনি গল্প',
  },
};

// ---------- slot fillers ----------
const objKeys = Object.keys(L.OBJECTS);
const charObj = objKeys.filter((k) => L.OBJECTS[k].character);
const plainObj = objKeys.filter((k) => !L.OBJECTS[k].character);
const places = ['park', 'beach', 'space', 'garden', 'school', 'forest', 'castle', 'farm', 'city', 'zoo', 'kitchen', 'mountain', 'snow', 'underwater', 'pirate', 'party'];

const SLOTS = {
  en: {
    food: Object.values(L.FOODS).flatMap((f) => f.en.slice(0, 2)),
    item: Object.values(L.SHOP_ITEMS).flatMap((f) => f.en.slice(0, 2)),
    obj: plainObj.flatMap((k) => L.OBJECTS[k].en.slice(0, 2)),
    char: [...charObj.flatMap((k) => L.OBJECTS[k].en.slice(0, 1)), ...Object.values(L.CHARACTERS).flatMap((c) => c.en.slice(0, 2))],
    color: Object.values(L.COLORS).flatMap((c) => c.en.slice(0, 1)),
    loc: places.flatMap((k) => L.LOCATIONS[k].en.slice(0, 2)),
    symptom: Object.values(L.SYMPTOMS).flatMap((s) => s.en.slice(0, 2)),
    role: Object.values(L.ROLES).flatMap((r) => r.en.slice(0, 1)),
    size: ['big', 'small', 'tiny', 'huge', 'little', 'giant'],
    num: ['two', 'three', 'four', 'five', 'many', 'lots of'],
    pet: ['momo', 'bubu', 'pip', 'my pet', 'my friend'],
  },
  bn: {
    food: Object.values(L.FOODS).flatMap((f) => f.bn.slice(0, 2)),
    item: Object.values(L.SHOP_ITEMS).flatMap((f) => f.bn.slice(0, 2)),
    obj: plainObj.flatMap((k) => (L.OBJECTS[k].bn || []).slice(0, 2)),
    char: [...charObj.flatMap((k) => (L.OBJECTS[k].bn || []).slice(0, 1)), ...Object.values(L.CHARACTERS).flatMap((c) => c.bn.slice(0, 2))],
    color: Object.values(L.COLORS).flatMap((c) => c.bn.slice(0, 1)),
    loc: places.flatMap((k) => (L.LOCATIONS[k].bn || []).slice(0, 2)),
    symptom: Object.values(L.SYMPTOMS).flatMap((s) => (s.bn || []).slice(0, 2)),
    role: Object.values(L.ROLES).flatMap((r) => (r.bn || []).slice(0, 1)),
    size: ['বড়', 'ছোট', 'বিশাল', 'ছোট্ট'],
    num: ['দুই', 'তিন', 'চার', 'পাঁচ', 'অনেক'],
    pet: ['মোমো', 'বুবু', 'পিপ', 'আমার বন্ধু'],
  },
};

// ---------- templates ----------
const T = {
  en: {
    go_restaurant: ['let us go to the restaurant', 'i want to eat outside', 'can we go to a restaurant', 'restaurant', 'take me to the restaurant', 'i am hungry let us eat somewhere', 'let us eat at a restaurant', 'go to the cafe', 'lets go eat', 'i want to go to a restaurant please', 'restaurant please', 'food place', 'let us go to the pizza place', 'can we eat out today', 'i want to go to the burger place', 'to the restaurant'],
    go_shop: ['let us go to the shop', 'i want to go shopping', 'take me to the mall', 'shop', 'can we go to the market', 'lets buy something', 'go to the toy shop', 'i want to go to the store', 'mall', 'market please', 'shopping time', 'let us visit the mall', 'to the shop', 'i want to go to the toy store'],
    go_hospital: ['let us go to the hospital', 'take me to the doctor', 'doctor', 'we need a doctor', 'go to the clinic', 'i want to see the doctor', 'hospital', 'can we visit the doctor', 'let us go to the doctor', 'to the hospital please', 'doctor please', 'we should see a doctor'],
    go_stage: ['let us go to the stage', 'i want to do a show', 'stage show', 'i want to sing on stage', 'let us perform', 'concert', 'theatre', 'go to the stage', 'i want to be on stage', 'show time', 'let us put on a show', 'to the stage'],
    go_emergency: ['help my pet', 'my pet needs help', 'something is wrong with {pet}', 'help {pet}', 'emergency', '{pet} is in trouble', 'save my pet', 'my friend needs help', 'rescue', 'help my friend', '{pet} needs me', 'is {pet} okay'],
    go_create: ['let us create our own world', 'make a new world', 'i want to build a world', 'our own world', 'create world', 'let us make a world', 'imagination time', 'i want to make my own place', 'new world', 'let us imagine a world', 'build our world', 'dream world'],
    go_home: ['let us go home', 'go home', 'home', 'i want to go back home', 'take me home', 'back to our room', 'go back', 'our room', 'home please', 'let us return home', 'i want to go home now'],
    go_place: ['let us go to the {loc}', 'i want to go to the {loc}', 'take me to the {loc}', '{loc}', 'can we visit the {loc}', 'go {loc}', 'to the {loc} please', 'lets go {loc}', 'i want to see the {loc}', 'can we go to the {loc} today', 'fly to the {loc}', 'let us travel to the {loc}'],
    order_food: ['i want {food}', 'i want {food} please', '{food} please', 'can i have {food}', 'give me {food}', 'i would like {food}', '{food}', 'one {food} please', 'i will have the {food}', 'can we order {food}', 'i want to eat {food}', '{food} and {food}', 'more {food} please', 'i want some {food}', 'do you have {food}', 'we want {food} for two', '{food} for me and {food} for {pet}', 'order {food}', 'i am hungry i want {food}', 'can i get {food}'],
    ask_price: ['how much is it', 'how much is the {item}', 'how much does it cost', 'what is the price', 'price please', 'how much', 'is it expensive', 'how many taka', 'how much for the {item}', 'what does the {item} cost', 'how much money', 'how much is this one', 'what is the price of the {item}', 'cost'],
    buy_item: ['i want to buy a {item}', 'i want the {item}', 'can i see the {item}', 'show me the {item}', 'do you have a {item}', 'i am looking for a {item}', 'a {color} {item} please', 'i will take the {item}', 'i want a {size} {item}', 'give me that {item}', 'i want to buy {item} for my mom', '{item}', 'the {color} one', 'i will buy it', 'i want this one', 'can i buy the {item}', 'show me a {color} {item}', 'do you have {item} in {color}', 'i want a {item} and a {item}'],
    symptom: ['my tummy hurts', 'i have a {symptom}', 'my friend has a {symptom}', '{pet} has {symptom}', 'it hurts here', 'my head hurts', 'i feel dizzy', 'i have fever', 'my pet is sick', '{pet} has a tummy ache', 'he has a cough', 'my ear hurts', 'my tooth hurts', 'i am not feeling well', 'the pet is hot', 'she is coughing', '{pet} is sick', 'my leg hurts', 'i feel sick', '{pet} has a {symptom}', 'it hurts', 'ouch my hand'],
    call_help: ['call mom', 'call the doctor', 'call an ambulance', 'call for help', 'we need help', 'call {char}', 'let us call someone', 'ask {char} for help', 'get help', 'phone the police', 'call the firefighter', 'somebody help', 'call dad please', 'we should call {char}', 'ring the doctor', 'tell {char} to come'],
    perform: ['i want to sing', 'let us sing a song', 'i will tell a story', 'once upon a time', 'i want to dance', 'listen to my song', 'i will sing', 'story time', 'i want to tell a story', 'la la la', 'watch me dance', 'can i sing', 'i will do a show', 'let me sing for you', 'i know a poem', 'i want to recite a poem', 'twinkle twinkle little star'],
    build: ['make a {obj}', 'i want a {obj}', 'make a {size} {obj}', 'put a {obj} here', 'can you make {num} {obj}', 'build a {obj}', 'i want {num} {obj}', 'a {color} {obj}', 'make a {color} {obj}', '{obj}', 'add a {obj}', 'create a {obj}', 'i want a {obj} and a {obj}', 'draw a {obj}', 'give me a {obj}', 'there is a {obj}', 'make a {char}', 'i want a {char}', 'bring a {char}', 'let a {char} come', '{char} come here', 'a {size} {color} {obj} please', 'can we have a {obj}', 'i need a {obj}', 'put {num} {obj} over there', 'a {char}'],
    remove: ['remove the {obj}', 'take away the {obj}', 'delete the {obj}', 'make the {obj} disappear', 'no more {obj}', 'bye bye {obj}', 'get rid of the {obj}', 'clear everything', 'remove it', 'take it away', 'make it go away', 'the {char} should go away', 'remove the {char}', 'i do not want the {obj}', 'delete everything', 'take the {obj} out'],
    color: ['make it {color}', 'make the sky {color}', 'paint the house {color}', '{color}', 'change the color to {color}', 'i want it {color}', 'make the room {color}', 'turn the {obj} {color}', 'the ground should be {color}', 'color it {color}', 'make everything {color}', 'can you make the {obj} {color}', 'paint it {color}', '{color} please', 'i want a {color} sky', 'change it to {color}'],
    weather: ['let it rain', 'make it rain', 'i want snow', 'make it snow', 'rain', 'snow', 'make a rainbow', 'sunny please', 'make it sunny', 'i want a storm', 'it is raining', 'let it be windy', 'stop the rain', 'clear sky', 'can it rain please', 'i want a rainbow in the sky', 'snow please', 'make the sun shine'],
    time: ['make it night', 'night time', 'turn off the sun', 'i want the moon', 'make it day', 'good morning sun', 'sunset', 'make it dark', 'it is night now', 'morning time', 'bring the stars', 'make the sun come out', 'i want it to be night', 'night please', 'day time', 'evening'],
    role_assign: ['you are the {role}', 'you be the {role}', 'i am the {role}', 'let us pretend you are a {role}', 'pretend to be a {role}', 'i will be the {role} and you are the {role}', 'can you be the {role}', 'you are a {role} now', 'be a {role}', 'i want to be the {role}', 'let us play {role}', 'become a {role}', 'you play the {role}', 'now you are the {role} okay', 'i am the {role} you are the {role}'],
    greet: ['hello', 'hi', 'hi {pet}', 'hello there', 'good morning', 'hey', 'hello {pet} how are you', 'assalamu alaikum', 'good afternoon', 'hi there friend', 'hey {pet}', 'hello hello', 'good evening', 'hi hi'],
    bye: ['bye', 'goodbye', 'bye bye', 'see you later', 'good night', 'i have to go', 'see you tomorrow', 'bye {pet}', 'time to go', 'i am going now', 'bye bye {pet}', 'see you', 'good night {pet}'],
    thanks: ['thank you', 'thanks', 'thank you {pet}', 'thanks a lot', 'thank you so much', 'thank you very much', 'thanks friend', 'that was nice thank you', 'thank you for helping', 'thanks {pet}'],
    affirm: ['yes', 'yes please', 'okay', 'sure', 'yeah', 'yes i want', 'of course', 'alright', 'ok lets do it', 'yes yes', 'fine', 'yep', 'definitely', 'okay okay', 'yes do it', 'good idea'],
    negate: ['no', 'no thank you', 'nope', 'i do not want', 'not that', 'no no', 'never', 'i do not like it', 'no way', 'not now', 'i do not want to', 'nah', 'stop', 'no thanks', 'i do not want that', 'not this one'],
    feel_happy: ['i am happy', 'i feel good', 'i am so happy', 'i am excited', 'this is fun', 'i feel great', 'i am fine', 'i love this', 'yay i am happy', 'i had fun today', 'i feel wonderful', 'i am very happy today', 'so much fun', 'i am glad'],
    feel_sad: ['i am sad', 'i feel sad', 'i am crying', 'i miss my mom', 'i feel lonely', 'i am upset', 'nobody plays with me', 'i feel bad', 'i am unhappy', 'i want to cry', 'my friend was mean to me', 'i am so sad today', 'i lost my toy and i am sad', 'i feel like crying'],
    feel_scared: ['i am scared', 'i am afraid', 'this is scary', 'i feel nervous', 'i am worried', 'i am shy', 'that is frightening', 'i do not want to be alone', 'there is a monster i am scared', 'i feel afraid of the dark', 'i am scared of the doctor', 'it is too scary', 'i am a little scared'],
    feel_angry: ['i am angry', 'i am mad', 'this makes me angry', 'i am so mad', 'i hate this', 'i am annoyed', 'grr i am angry', 'my brother broke my toy i am mad', 'i am cross', 'that makes me so angry', 'i am really angry now', 'i am angry at my sister'],
    feel_tired: ['i am tired', 'i am sleepy', 'i want to sleep', 'i am bored', 'i feel exhausted', 'i want to rest', 'yawn i am sleepy', 'i am so tired today', 'can we rest', 'i am very sleepy', 'i feel tired', 'i am bored now'],
    pet_question: ['what is your name', 'how are you', 'do you like {food}', 'what do you like', 'what do you want to do', 'where do you live', 'how old are you', 'what is your favorite color', 'do you like me', 'are you happy', 'what do you want to eat', 'who are you', 'what can you do', 'can you dance', 'do you have a family', 'what is your favourite food', 'tell me about yourself', 'are you hungry', 'do you like {color}', 'what do you want', 'are you a boy or a girl', 'do you like to play'],
    praise: ['good job', 'i love you', 'you are my best friend', 'well done', 'you are so cute', 'i like you', 'you are the best', 'great job {pet}', 'you are funny', 'i love you {pet}', 'you are a good friend', 'hug', 'give me a hug', 'you are so nice', 'i love you so much', 'you are amazing', 'kiss', 'high five'],
    ask_help: ['i do not know', 'help me', 'what should i say', 'what can i do', 'i do not understand', 'what now', 'what should we do', 'give me ideas', 'i need help', 'how do i do this', 'i do not know what to say', 'what can we do here', 'what do i say', 'i am confused', 'tell me what to do'],
    chitchat: ['my school is big', 'i have a brother', 'today is my birthday', 'my teacher gave me homework', 'the bus was late', 'i saw a bird yesterday', 'my mom cooked rice', 'i like football', 'it is raining outside my house', 'my dad is at work', 'we went to the village', 'i watched cartoons', 'my favorite color is {color}', 'i am five years old', 'my sister is sleeping', 'i ate {food} today', 'i have a {item} at home', 'the {obj} is big', 'i went to school today', 'my cat is black', 'tomorrow is friday', 'grandma is coming', 'i can count to ten', 'one two three', 'i know a song', 'we have a new baby', 'my name is sam', 'i am in class one', 'my friend has a {item}', 'yesterday we played cricket', 'i like {color} and {color}'],
  },
  bn: {
    go_restaurant: ['চলো রেস্টুরেন্টে যাই', 'রেস্টুরেন্টে যাব', 'আমি রেস্টুরেন্টে যেতে চাই', 'রেস্টুরেন্ট', 'বাইরে খেতে যাই', 'চলো খেতে যাই', 'হোটেলে যাই', 'রেস্টুরেন্টে নিয়ে যাও', 'চলো কোথাও খেতে যাই', 'আমার খিদে পেয়েছে চলো খেতে যাই'],
    go_shop: ['চলো দোকানে যাই', 'আমি শপিং করতে চাই', 'মার্কেটে যাব', 'দোকান', 'চলো কিছু কিনি', 'মলে যাই', 'খেলনার দোকানে যাই', 'দোকানে নিয়ে যাও', 'শপিং করব', 'বাজারে যাই'],
    go_hospital: ['চলো হাসপাতালে যাই', 'ডাক্তারের কাছে যাব', 'ডাক্তার', 'আমাদের ডাক্তার লাগবে', 'হাসপাতাল', 'ডাক্তার দেখাতে যাই', 'হাসপাতালে নিয়ে যাও', 'ক্লিনিকে যাই', 'ডাক্তারের কাছে চলো'],
    go_stage: ['চলো মঞ্চে যাই', 'আমি শো করতে চাই', 'মঞ্চ', 'স্টেজে গান গাইব', 'চলো পারফর্ম করি', 'স্টেজ শো', 'মঞ্চে নিয়ে যাও', 'শো করব', 'স্টেজে যাই'],
    go_emergency: ['বন্ধুকে সাহায্য করো', 'আমার বন্ধুর সাহায্য লাগবে', '{pet} এর কী হয়েছে', '{pet} কে বাঁচাও', 'জরুরি', 'আমার বন্ধু বিপদে', 'বন্ধুকে সাহায্য', '{pet} কে সাহায্য করো', '{pet} ঠিক আছে তো'],
    go_create: ['চলো নিজের জগৎ বানাই', 'নতুন জগৎ বানাও', 'আমি একটা জগৎ বানাতে চাই', 'নিজের দুনিয়া', 'কল্পনার জগৎ', 'চলো একটা দুনিয়া বানাই', 'আমাদের নিজের জগৎ', 'নতুন দুনিয়া'],
    go_home: ['চলো বাড়ি যাই', 'বাড়ি যাব', 'বাসায় যাই', 'ঘরে ফিরি', 'বাড়ি', 'আমাদের ঘরে যাই', 'বাড়ি ফিরে যাই', 'এখন বাড়ি যাব', 'ফিরে যাই'],
    go_place: ['চলো {loc} যাই', 'আমি {loc} যেতে চাই', '{loc} নিয়ে যাও', '{loc}', '{loc} ঘুরতে যাই', 'চলো {loc}', 'আজ {loc} যাব', '{loc} দেখতে চাই', 'উড়ে {loc} যাই'],
    order_food: ['আমি {food} চাই', '{food} দাও', '{food} খাব', 'আমাকে {food} দিন', '{food}', 'একটা {food} প্লিজ', '{food} খেতে চাই', 'আরও {food} দাও', '{food} আছে?', '{food} আর {food}', 'আমার জন্য {food} আর {pet} এর জন্য {food}', '{food} অর্ডার করি', 'খিদে পেয়েছে {food} চাই', 'দুইটা {food} দিন', 'একটু {food} দাও'],
    ask_price: ['কত দাম', 'দাম কত', 'এটার দাম কত', '{item} এর দাম কত', 'কত টাকা', 'এটা কি দামি', 'এটার দাম কত টাকা', '{item}টার দাম কত', 'দাম বলো'],
    buy_item: ['আমি একটা {item} কিনতে চাই', '{item} দেখাও', '{item} আছে?', 'আমি {item} চাই', 'একটা {color} {item} দাও', 'আমি {item} খুঁজছি', 'এটা নিব', '{item}', '{color}টা দাও', 'আমি এটা কিনব', '{item} কিনব', 'একটা {size} {item} চাই', 'ওই {item}টা দাও', 'মায়ের জন্য {item} কিনব', '{color} {item} আছে?'],
    symptom: ['আমার পেট ব্যথা', 'আমার {symptom}', '{pet} এর {symptom}', 'মাথা ব্যথা করছে', 'আমার জ্বর', 'বন্ধুর {symptom}', 'ওর কাশি', 'এখানে ব্যথা', 'আমার ভালো লাগছে না', 'আমার বন্ধু অসুস্থ', '{pet} এর গা গরম', '{pet} অসুস্থ', 'পা ব্যথা করছে', 'আমার অসুখ', 'উফ হাতে ব্যথা', 'ওর {symptom} হয়েছে'],
    call_help: ['মাকে ফোন করো', 'ডাক্তার ডাকো', 'অ্যাম্বুলেন্স ডাকো', 'সাহায্য ডাকো', 'আমাদের সাহায্য লাগবে', '{char} কে ডাকো', 'কাউকে ডাকি', 'পুলিশ ডাকো', 'বাবাকে ফোন করো', 'কেউ সাহায্য করো', '{char} কে ফোন করি', '{char} কে আসতে বলো', 'ডাক্তারকে ফোন করো'],
    perform: ['আমি গান গাইতে চাই', 'চলো গান গাই', 'আমি গল্প বলব', 'এক দেশে ছিল', 'আমি নাচতে চাই', 'আমার গান শোনো', 'গল্পের সময়', 'আমি নাচব দেখো', 'আমি একটা শো করব', 'তোমাকে গান শোনাই', 'আমি একটা ছড়া জানি', 'ছড়া বলব', 'আমি গান গাইব'],
    build: ['একটা {obj} বানাও', 'আমি একটা {obj} চাই', 'একটা {size} {obj} বানাও', '{obj} দাও', '{num}টা {obj} বানাও', 'একটা {color} {obj}', '{obj}', 'একটা {obj} আনো', 'এখানে একটা {obj} রাখো', '{char} আসুক', 'একটা {char} চাই', '{char} বানাও', 'একটা {obj} আর একটা {obj} বানাও', 'একটা {obj} আঁকো', 'একটা {obj} লাগবে', '{num}টা {obj} চাই', 'একটা {size} {color} {obj} দাও', 'একটা {char}', '{char} নিয়ে এসো'],
    remove: ['{obj} সরাও', '{obj} মুছে দাও', '{obj} চাই না আর', '{obj} নিয়ে যাও', 'সব মুছে দাও', 'এটা সরাও', '{char} চলে যাক', '{obj} উধাও করো', '{obj} সরিয়ে ফেলো', 'সব সরাও', '{char} সরাও', 'এটা চলে যাক'],
    color: ['এটা {color} করো', 'আকাশ {color} করো', 'ঘরটা {color} করো', '{color}', 'রং বদলে {color} করো', '{obj}টা {color} করো', 'মাটি {color} হোক', 'সব {color} করো', '{color} রং দাও', '{color} করে দাও', 'আকাশটা {color} হোক', 'বাড়িটা {color} রং করো'],
    weather: ['বৃষ্টি নামাও', 'বৃষ্টি হোক', 'বরফ পড়ুক', 'বৃষ্টি', 'তুষার', 'রংধনু বানাও', 'রোদ উঠুক', 'ঝড় চাই', 'বৃষ্টি থামাও', 'বাতাস দাও', 'বৃষ্টি চাই', 'আকাশে রংধনু চাই', 'বরফ চাই', 'রোদ চাই'],
    time: ['রাত করো', 'রাত হোক', 'সূর্য নিভিয়ে দাও', 'চাঁদ চাই', 'দিন করো', 'সকাল হোক', 'সূর্যাস্ত', 'অন্ধকার করো', 'তারা আনো', 'সূর্য উঠুক', 'এখন রাত', 'রাত চাই', 'দিন হোক', 'সন্ধ্যা করো'],
    role_assign: ['তুমি {role}', 'তুমি {role} হও', 'আমি {role}', 'ধরো তুমি {role}', '{role} সাজো', 'আমি {role} আর তুমি {role}', 'তুমি কি {role} হবে', 'চলো {role} খেলি', 'আমি {role} হব', 'তুমি এখন {role}', 'তুমি {role} সাজো আমি {role}', '{role} হও'],
    greet: ['হ্যালো', 'হাই', 'হাই {pet}', 'আসসালামু আলাইকুম', 'শুভ সকাল', 'কেমন আছো {pet}', 'হ্যালো বন্ধু', 'এই যে', 'হ্যালো হ্যালো', 'শুভ সন্ধ্যা', 'হাই হাই'],
    bye: ['বাই', 'টাটা', 'বিদায়', 'পরে দেখা হবে', 'শুভ রাত্রি', 'আমাকে যেতে হবে', 'কাল দেখা হবে', 'বাই {pet}', 'আমি যাই', 'বাই বাই', 'শুভ রাত্রি {pet}', 'এখন যাই'],
    thanks: ['ধন্যবাদ', 'থ্যাংক ইউ', 'অনেক ধন্যবাদ', 'ধন্যবাদ {pet}', 'থ্যাংকস', 'অনেক অনেক ধন্যবাদ', 'সাহায্যের জন্য ধন্যবাদ', 'থ্যাংক ইউ {pet}'],
    affirm: ['হ্যাঁ', 'হ্যাঁ প্লিজ', 'আচ্ছা', 'ঠিক আছে', 'অবশ্যই', 'হুম', 'হ্যাঁ চাই', 'ওকে', 'হ্যাঁ হ্যাঁ', 'ঠিক', 'করো', 'হ্যাঁ করো', 'ভালো আইডিয়া'],
    negate: ['না', 'না ধন্যবাদ', 'চাই না', 'ওটা না', 'না না', 'কখনো না', 'পছন্দ না', 'এখন না', 'থাক', 'না করব না', 'এটা না', 'থামো', 'না থাক'],
    feel_happy: ['আমি খুশি', 'আমার ভালো লাগছে', 'আমি খুব খুশি', 'মজা লাগছে', 'আমি আনন্দিত', 'খুব মজা', 'আমি ভালো আছি', 'ইয়ে আমি খুশি', 'আজ খুব মজা হয়েছে', 'আমি আজ খুব খুশি', 'কী মজা'],
    feel_sad: ['আমার মন খারাপ', 'আমি দুঃখী', 'আমি কাঁদছি', 'মাকে মিস করছি', 'আমি একা', 'আমার খারাপ লাগছে', 'কেউ আমার সাথে খেলে না', 'কান্না পাচ্ছে', 'আমার বন্ধু আমাকে বকেছে', 'আজ আমার মন খারাপ', 'খেলনা হারিয়ে গেছে মন খারাপ'],
    feel_scared: ['আমি ভয় পাচ্ছি', 'ভয় লাগছে', 'এটা ভয়ের', 'আমি নার্ভাস', 'আমার চিন্তা হচ্ছে', 'আমি লজ্জা পাচ্ছি', 'অন্ধকারে ভয় লাগে', 'একা থাকতে চাই না', 'ওখানে ভূত আছে ভয় লাগে', 'ডাক্তারকে ভয় লাগে', 'খুব ভয় লাগছে', 'একটু ভয় লাগছে'],
    feel_angry: ['আমি রেগে আছি', 'আমার রাগ লাগছে', 'রাগ হচ্ছে', 'আমি খুব রেগে গেছি', 'আমি বিরক্ত', 'গ্রর আমি রাগী', 'ভাই আমার খেলনা ভেঙেছে রাগ লাগছে', 'খুব রাগ হচ্ছে', 'আমি রাগ করেছি', 'বোনের উপর রাগ হচ্ছে'],
    feel_tired: ['আমি ক্লান্ত', 'ঘুম পাচ্ছে', 'আমি ঘুমাতে চাই', 'বিরক্ত লাগছে', 'খুব ক্লান্ত লাগছে', 'একটু বিশ্রাম নিই', 'হাই ঘুম পাচ্ছে', 'আজ খুব ক্লান্ত', 'আমরা কি একটু বিশ্রাম নিতে পারি', 'আমার ঘুম পাচ্ছে', 'ক্লান্ত লাগছে'],
    pet_question: ['তোমার নাম কি', 'কেমন আছো', 'তুমি কি {food} পছন্দ করো', 'তুমি কি পছন্দ করো', 'তুমি কি করতে চাও', 'তুমি কোথায় থাকো', 'তোমার বয়স কত', 'তোমার প্রিয় রং কি', 'তুমি কি আমাকে পছন্দ করো', 'তুমি কি খুশি', 'তুমি কি খাবে', 'তুমি কে', 'তুমি কি কি পারো', 'তুমি কি নাচতে পারো', 'তোমার প্রিয় খাবার কি', 'তোমার কথা বলো', 'তোমার খিদে পেয়েছে', 'তুমি কি {color} পছন্দ করো', 'তুমি কি চাও', 'তুমি কি খেলতে পছন্দ করো'],
    praise: ['সাবাশ', 'আমি তোমাকে ভালোবাসি', 'তুমি আমার সেরা বন্ধু', 'খুব ভালো', 'তুমি খুব কিউট', 'তোমাকে আমার ভালো লাগে', 'তুমি সেরা', 'দারুণ {pet}', 'তুমি মজার', 'তুমি ভালো বন্ধু', 'জড়িয়ে ধরো', 'একটা হাগ দাও', 'তুমি খুব ভালো', 'ভালোবাসি {pet}', 'হাই ফাইভ', 'চুমু'],
    ask_help: ['আমি জানি না', 'আমাকে সাহায্য করো', 'কি বলব', 'কি করতে পারি', 'বুঝতে পারছি না', 'এখন কি', 'কি করব', 'আইডিয়া দাও', 'আমার সাহায্য লাগবে', 'কিভাবে করব', 'কি বলব বুঝছি না', 'এখানে কি করা যায়', 'কী বলব', 'কী করব', 'বলে দাও কি করব'],
    chitchat: ['আমার স্কুল অনেক বড়', 'আমার একটা ভাই আছে', 'আজ আমার জন্মদিন', 'টিচার হোমওয়ার্ক দিয়েছে', 'বাস দেরি করেছিল', 'কাল একটা পাখি দেখেছি', 'মা ভাত রান্না করেছে', 'আমি ফুটবল ভালোবাসি', 'বাইরে বৃষ্টি হচ্ছে', 'বাবা অফিসে', 'আমরা গ্রামে গিয়েছিলাম', 'আমি কার্টুন দেখেছি', 'আমার প্রিয় রং {color}', 'আমার বয়স পাঁচ', 'বোন ঘুমাচ্ছে', 'আজ {food} খেয়েছি', 'আমার বাসায় একটা {item} আছে', 'আমি আজ স্কুলে গিয়েছি', 'আমার বিড়াল কালো', 'কাল শুক্রবার', 'দাদি আসছে', 'আমি দশ পর্যন্ত গুনতে পারি', 'এক দুই তিন', 'আমি একটা গান জানি', 'আমাদের নতুন বেবি হয়েছে', 'আমার নাম রাফি', 'আমি ক্লাস ওয়ানে পড়ি', 'আমার বন্ধুর একটা {item} আছে', 'কাল ক্রিকেট খেলেছি'],
  },
};
const EXTRA_EN = {
  "go_restaurant": [
    "wanna go eat somewhere",
    "can we go eat something",
    "i want to go where they serve food",
    "let us go to a place with food",
    "i am so hungry can we eat out",
    "lets grab a bite",
    "i want to eat at a cafe",
    "where can we eat",
    "take me to a food place",
    "lets go for dinner",
    "can we get lunch somewhere",
    "food shop please"
  ],
  "go_shop": [
    "wanna go buy stuff",
    "can we go see the toys at the shop",
    "lets go to the market and look around",
    "i wanna go to the mall",
    "take me where they sell toys",
    "shopping please",
    "lets go look at things to buy",
    "can we visit a store",
    "i want to look at the shops"
  ],
  "go_hospital": [
    "wanna see a doctor person",
    "take me where the doctors are",
    "can we go see the nurse",
    "i want a doctor to check",
    "lets visit the clinic",
    "we have to go to the hospital",
    "i wanna go to the doctor",
    "doctor place please",
    "can a doctor look at it",
    "lets find a doctor"
  ],
  "go_stage": [
    "wanna perform in front of people",
    "i want to show everyone my dance",
    "lets go where the audience is",
    "can i do my show for everyone",
    "i want to go on the stage and sing",
    "lets put on a show for everybody",
    "take me to the stage",
    "i want to go to the theatre",
    "show for people",
    "i want to perform for the audience",
    "can we go to the concert place"
  ],
  "go_emergency": [
    "something happened to {pet}",
    "{pet} is hurt",
    "my pet is stuck",
    "come quick {pet} needs help",
    "we have to help {pet}",
    "{pet} fell down",
    "oh no {pet} is crying",
    "please help my friend",
    "my pet got hurt",
    "{pet} is sick help"
  ],
  "go_home": [
    "lets go back to the house",
    "can we go home now",
    "i wanna go home",
    "back home please",
    "i want to go to our room",
    "home time",
    "take us home"
  ],
  "ask_price": [
    "could you tell me the price of this",
    "how much is that",
    "what does this cost",
    "tell me the price",
    "how much do i pay",
    "how much taka is it",
    "is this expensive",
    "what is the cost of the {item}",
    "can you tell me how much the {item} is",
    "how much for this one",
    "how many taka for the {item}"
  ],
  "symptom": [
    "my throat is sore",
    "i have a headache",
    "{pet} is throwing up",
    "my leg hurts a lot",
    "i have a cold",
    "my nose is runny",
    "i feel hot",
    "{pet} does not want to eat",
    "i cannot stop coughing",
    "my eye hurts",
    "he fell and hurt his arm",
    "{pet} is very tired and sad"
  ],
  "call_help": [
    "can we call someone to help",
    "lets phone the doctor",
    "call for the ambulance",
    "we need to call mom",
    "ring the ambulance",
    "phone someone",
    "lets call for help quickly",
    "call a grown up",
    "can you call the doctor please"
  ],
  "perform": [
    "i wanna sing a song for you",
    "listen to my story",
    "can i dance now",
    "i will dance for you",
    "let me tell you a story",
    "i want to sing a song",
    "watch me sing",
    "i will recite a poem",
    "lets dance together",
    "i can sing twinkle twinkle",
    "i will tell a story about a {obj}",
    "do you want to hear my song"
  ],
  "feel_sad": [
    "i am feeling kind of down today",
    "i feel a little sad",
    "i am not happy",
    "today was bad",
    "i feel blue",
    "i am sad because my friend left",
    "nobody likes me",
    "i feel left out"
  ],
  "feel_happy": [
    "i am feeling great today",
    "today was awesome",
    "i am so excited for this",
    "this makes me happy",
    "i feel super good",
    "best day ever"
  ],
  "feel_scared": [
    "i am a bit scared of this",
    "that noise scared me",
    "i do not like the dark",
    "i am frightened",
    "i feel scared right now",
    "the dog scared me"
  ],
  "feel_tired": [
    "i am kinda bored",
    "i feel sleepy now",
    "i want a nap",
    "i am worn out",
    "can we do something quiet",
    "i am too tired to play"
  ],
  "ask_help": [
    "i do not know what to do",
    "can you help me please",
    "what are we supposed to do",
    "i am stuck",
    "give me a hint",
    "what should i do now",
    "help me out",
    "i need an idea"
  ],
  "praise": [
    "you are so clever",
    "i like playing with you",
    "you are my favorite",
    "that was great {pet}",
    "you did so well",
    "i am proud of you",
    "you are the cutest",
    "good boy",
    "good girl",
    "nice one"
  ],
  "pet_question": [
    "what is your favorite food",
    "do you have friends",
    "what do you like to play",
    "are you a cat",
    "can you fly",
    "do you sleep",
    "what makes you happy",
    "where is your mom",
    "do you like the rain",
    "how do you feel"
  ],
  "chitchat": [
    "i went to school today",
    "my name is ayan",
    "my brother is five",
    "i have a blue bike",
    "we watched a movie",
    "my teacher is nice",
    "i like cars",
    "it is my birthday tomorrow",
    "i saw a big truck",
    "my dad is at work"
  ]
};
for (const [k, v] of Object.entries(EXTRA_EN)) T.en[k] = [...(T.en[k] || []), ...v];

// ---------- expansion ----------
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function fill(template, slots, rand) {
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const list = slots[k] || [];
    return list.length ? list[Math.floor(rand() * list.length)] : k;
  });
}

const PREFIX = { en: ['um', 'please', 'momo', 'bubu', 'pip', 'can you', 'hey', 'i said', 'okay', 'now', 'so', 'and'], bn: ['মোমো', 'বুবু', 'পিপ', 'আচ্ছা', 'এই', 'আর', 'প্লিজ', 'এখন'] };
const SUFFIX = { en: ['please', 'now', 'okay', 'momo', 'bubu', 'pip', 'please please', 'right now', 'today'], bn: ['প্লিজ', 'এখন', 'আচ্ছা', 'মোমো', 'বুবু', 'তো'] };

/** Simulate speech-recognition / typing slips so the classifier learns to be forgiving. */
function typo(text, rand) {
  const words = text.split(' ');
  const idx = words.map((w, i) => (/^[a-z]{5,}$/.test(w) ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return text;
  const i = idx[Math.floor(rand() * idx.length)];
  const w = words[i];
  const p = 1 + Math.floor(rand() * (w.length - 2));
  const kind = rand();
  words[i] = kind < 0.35 ? w.slice(0, p) + w.slice(p + 1)                       // drop a letter
    : kind < 0.7 ? w.slice(0, p) + w[p + 1] + w[p] + w.slice(p + 2)              // swap two letters
      : w.slice(0, p) + w[p] + w.slice(p);                                       // double a letter
  return words.join(' ');
}

/** Generate the labelled corpus. Returns [{ text, intent, lang }]. */
export function generate({ perTemplate = 12, seed = 42, augment = true } = {}) {
  const rand = rng(seed);
  const out = [];
  const push = (text, intent, lang) => out.push({ text, intent, lang });
  for (const lang of ['en', 'bn']) {
    for (const intent of INTENTS) {
      const templates = T[lang][intent] || [];
      for (const tpl of templates) {
        const hasSlot = /\{\w+\}/.test(tpl);
        const n = hasSlot ? perTemplate : 3;
        const seen = new Set();
        for (let i = 0; i < n; i++) {
          let text = fill(tpl, SLOTS[lang], rand);
          if (augment && i > 0) {
            const r = rand();
            if (r < 0.2) text = `${PREFIX[lang][Math.floor(rand() * PREFIX[lang].length)]} ${text}`;
            else if (r < 0.4) text = `${text} ${SUFFIX[lang][Math.floor(rand() * SUFFIX[lang].length)]}`;
            else if (r < 0.55 && lang === 'en') text = typo(text, rand);
          }
          if (seen.has(text)) continue;
          seen.add(text);
          push(text, intent, lang);
        }
      }
    }
  }
  return out;
}

/** Words that appear in templates (used to avoid "correcting" ordinary words). */
export function templateVocabulary() {
  const words = new Set();
  for (const lang of ['en']) for (const intent of INTENTS) for (const tpl of T[lang][intent] || []) for (const w of tpl.replace(/\{\w+\}/g, ' ').split(/\s+/)) if (w) words.add(w);
  return words;
}
