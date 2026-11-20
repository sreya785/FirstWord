// Drives the brain through the scenarios from the FirstWord AI concept document.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as brain from './index.js';

const child = { id: 'test', name: 'Ayan', lang: 'en', petType: 'cat', petName: null, level: 2, settings: {} };
const session = brain.newSession(child, 'en');
let failures = 0;

async function say(text, expect = {}) {
  const res = await brain.processTurn(session, child, { text, source: text === '' ? 'silence' : 'voice' });
  const others = res.speech.filter((s) => s.who === 'char').map((s) => `${s.name}: ${s.text}`).join(' | ');
  console.log(`\n👧 ${text || '(silence)'}`);
  if (others) console.log(`   🗣️  ${others}`);
  console.log(`   🐱 [${res.pet.mood}${res.pet.action ? '/' + res.pet.action : ''}] ${res.pet.text}`);
  console.log(`   🌍 ${res.scene}@${res.world.location} objs=[${res.world.objects.map((o) => o.emoji).join('')}] chars=[${res.world.characters.map((c) => c.emoji).join('')}] roles=${res.world.roles.child}/${res.world.roles.pet} ev=${res.events.join(',')} intent=${res.intent} skills=${res.skills.join(',')}`);
  for (const [k, v] of Object.entries(expect)) {
    const actual = k === 'scene' ? res.scene : k === 'location' ? res.world.location : k === 'intent' ? res.intent : k === 'hasObject' ? res.world.objects.some((o) => o.key === v) : k === 'hasChar' ? res.world.characters.some((c) => c.key === v) : k === 'petRole' ? res.world.roles.pet : k === 'childRole' ? res.world.roles.child : k === 'weather' ? res.world.weather : k === 'time' ? res.world.time : res[k];
    const ok = (k === 'hasObject' || k === 'hasChar') ? actual === true : actual === v;
    if (!ok) { failures++; console.log(`   ❌ expected ${k}=${v} got ${actual}`); }
  }
  return res;
}

console.log('=== GREETING ===');
console.log(brain.greet(session, child, 'en', false).pet.text);

console.log('\n=== RESTAURANT ===');
await say("Let's go to a restaurant", { scene: 'restaurant' });
await say('By the window please');
await say('I want rice and chicken', { intent: 'restaurant' });
await say('No, I want noodles');
await say('What do you want?');
await say('Ice cream for my friend');
await say('Where is my juice?');
await say('Is the pizza spicy?');
await say('yes');
await say("Let's go to another restaurant");

console.log('\n=== SHOP ===');
await say("Let's go to the shop", { scene: 'shop' });
await say('I want the red bag', { hasObject: 'bag' });
await say('How much is this?');
await say('Can I see the blue one?');
await say("No, I don't like this. Show me another one");
await say('I want to buy a gift for my friend');
await say('She likes dolls');
await say('I will buy it');
await say('thank you');

console.log('\n=== HOSPITAL ===');
await say("Let's go to the hospital", { scene: 'hospital' });
await say('My pet has a stomachache');
await say('Since yesterday. It ate too much cake');
await say('Can you help my pet?');
await say('What should we do now?');

console.log('\n=== STAGE ===');
await say("Let's go to the stage", { scene: 'stage' });
await say('Today I will tell you a story about a cat');
await say('Once upon a time there was a small cat who lived in a big city');
await say('The cat found a dragon and they became friends');
await say('Let me introduce my friend');
await say('The end! Thank you everyone');

console.log('\n=== EMERGENCY ===');
await say('Help my pet', { scene: 'emergency' });
await say('');
await say('');
await say("Don't worry, I will help you");
await say('We need to call someone');
await say('My friend is stuck and needs help please');
await say("Let's go home", { scene: 'home', location: 'home' });

console.log('\n=== CREATE YOUR OWN WORLD ===');
await say("Let's create our own world", { scene: 'create' });
await say("Let's build a house beside the sea", { location: 'beach', hasObject: 'house' });
await say('Make a school for animals', { location: 'school' });
await say('Now we are astronauts', { location: 'space' });
await say('Turn this room into a garden', { location: 'garden' });
await say('You are the shopkeeper and I am the customer', { petRole: 'shopkeeper', childRole: 'customer' });
await say('I want a red ball please');
await say('How much is it?');
await say("Let's create a birthday party for you", { location: 'party' });
await say('I want a dragon to come and visit us', { hasChar: 'dragon' });
await say('Hello dragon, do you like cake?');
await say('Make the sky purple');
await say('Make it night', { time: 'night' });
await say('Let it rain', { weather: 'rain' });
await say('three big trees', { hasObject: 'tree' });
await say('Remove the trees');
await say("What's your name?");
await say('Do you like bitter gourd?');
await say('I am sad');
await say("I don't know");
await say('Dance with me');
await say('Blah blah something random here today');
await say('bye bye');

console.log('\n=== BANGLA ===');
const bchild = { ...child, lang: 'bn', name: 'রিয়া' };
const bsession = brain.newSession(bchild, 'bn');
async function bsay(text, expect = {}) {
  const res = await brain.processTurn(bsession, bchild, { text, source: 'voice' });
  const others = res.speech.filter((s) => s.who === 'char').map((s) => `${s.name}: ${s.text}`).join(' | ');
  console.log(`\n👧 ${text}`);
  if (others) console.log(`   🗣️  ${others}`);
  console.log(`   🐱 ${res.pet.text}`);
  console.log(`   🌍 ${res.scene}@${res.world.location} objs=[${res.world.objects.map((o) => o.emoji).join('')}] intent=${res.intent}`);
  for (const [k, v] of Object.entries(expect)) {
    const actual = k === 'scene' ? res.scene : k === 'location' ? res.world.location : k === 'hasObject' ? res.world.objects.some((o) => o.key === v) : res[k];
    const ok = k === 'hasObject' ? actual === true : actual === v;
    if (!ok) { failures++; console.log(`   ❌ expected ${k}=${v} got ${actual}`); }
  }
}
await bsay('চলো রেস্টুরেন্টে যাই', { scene: 'restaurant' });
await bsay('জানালার পাশে');
await bsay('আমি ভাত আর মুরগি চাই');
await bsay('না, আমি নুডলস চাই');
await bsay('তুমি কী চাও?');
await bsay('চলো দোকানে যাই', { scene: 'shop' });
await bsay('আমি লাল ব্যাগ চাই', { hasObject: 'bag' });
await bsay('দাম কত?');
await bsay('চলো হাসপাতালে যাই', { scene: 'hospital' });
await bsay('আমার বন্ধুর পেট ব্যথা');
await bsay('চলো নিজের জগৎ বানাই', { scene: 'create' });
await bsay('একটা ড্রাগন বানাও');
await bsay('ঘরটা নীল করো');
await bsay('এখন আমরা মহাকাশচারী', { location: 'space' });
await bsay('আমি খুশি');

console.log('\n=== TRAINED MODEL + SPELLING (paraphrases the rules do not know) ===');
const mchild = { id: 'ml', name: 'Ayan', lang: 'en', petType: 'cat', petName: null, level: 2, settings: {} };
const msession = brain.newSession(mchild, 'en');
async function msay(text, expect = {}) {
  const res = await brain.processTurn(msession, mchild, { text, source: 'voice' });
  console.log(`\n👧 ${text}`);
  console.log(`   🐱 ${res.pet.text}`);
  console.log(`   🌍 ${res.scene}@${res.world.location} intent=${res.intent} ml=${res.ml ? `${res.ml.intent}@${res.ml.conf}` : '-'} corrected=${JSON.stringify(res.corrected)} quest=${res.quest?.title}`);
  for (const [k, v] of Object.entries(expect)) {
    const actual = k === 'scene' ? res.scene : k === 'location' ? res.world.location : k === 'corrected' ? JSON.stringify((res.corrected || []).map((c) => c.to)) : k === 'mlIntent' ? res.ml?.intent : k === 'intentStarts' ? String(res.intent).startsWith(v) : k === 'hasQuest' ? Boolean(res.quest) : res[k];
    const ok = k === 'intentStarts' ? actual === true : k === 'hasQuest' ? actual === v : actual === v;
    if (!ok) { failures++; console.log(`   ❌ expected ${k}=${v} got ${actual}`); }
  }
  return res;
}
await msay('take me to the resturant', { scene: 'restaurant', corrected: '["restaurant"]', hasQuest: true });
await msay('wanna see a doctor person', { scene: 'hospital', mlIntent: 'go_hospital' });
await msay('i am feeling kind of down today', { corrected: '[]' }); // "kind" must not become "king"
await msay('lets go home', { scene: 'home' });
await msay('can we go eat somewhere', { scene: 'restaurant' });
await msay('I want piza plese', { corrected: '["pizza","please"]' });
await msay('go home', { scene: 'home' });
await msay('wanna perform in front of people', { scene: 'stage' });
await msay('go home', { scene: 'home' });
await msay('could you tell me the price of this', { intentStarts: 'ml_' });

console.log('\n=== VOICE-FIRST FORGIVING PROGRESSION TESTS ===');
const vchild = { id: 'voice_test', name: 'Ayan', lang: 'en', petType: 'cat', petName: 'Momo', level: 2, settings: {} };
const vsession = brain.newSession(vchild, 'en');
async function vsay(text, expect = {}) {
  const res = await brain.processTurn(vsession, vchild, { text, source: text === '' ? 'silence' : 'voice' });
  const others = res.speech.filter((s) => s.who === 'char').map((s) => `${s.name}: ${s.text}`).join(' | ');
  console.log(`\n👧 ${text || '(silence)'}`);
  if (others) console.log(`   🗣️  ${others}`);
  console.log(`   🐱 ${res.pet.text}`);
  console.log(`   🌍 ${res.scene}@${res.world.location} stage=${vsession.sceneState?.stage}`);
  for (const [k, v] of Object.entries(expect)) {
    const actual = k === 'scene' ? res.scene : k === 'location' ? res.world.location : k === 'stage' ? vsession.sceneState?.stage : res[k];
    const ok = actual === v;
    if (!ok) { failures++; console.log(`   ❌ expected ${k}=${v} got ${actual}`); }
  }
  return res;
}

// 1. Restaurant voice order-taking, chef with 2 misses then accept, and complaint sorry
await vsay("Let's go to the restaurant", { scene: 'restaurant', stage: 'table_ready' });
// Voice order-taking: any spoken words advance to order_heard
await vsay("What would you like to eat today?", { stage: 'order_heard' });
// Move to chef window
await vsay("Chef window", { stage: 'at_chef' });
// Miss 1 at chef:
await vsay("wrong food one", { stage: 'chef_mismatch' });
// Miss 2 at chef:
await vsay("wrong food two", { stage: 'chef_mismatch' });
// 3rd attempt at chef: accepts and starts cooking!
await vsay("start now please", { stage: 'cooking' });
// Collect food from window
await vsay("Chef window", { stage: 'ready_to_serve' });
// Simulate wrong dish complaint
vsession.sceneState.stage = 'complaint';
// Voice complaint resolution: child says sorry by voice
await vsay("I am so sorry about that", { stage: 'ready_to_serve' });

// 2. Shop voice pricing: 2 misses repeat hint, 3rd attempt accepts price and allows scan
await vsay("Let's go to the shop", { scene: 'shop', stage: 'customer_waiting' });
// Scanner cannot scan before price is given
await vsay("scan the item", { stage: 'customer_waiting' });
// Miss 1 on price
await vsay("first guess here", { stage: 'customer_waiting' });
// Miss 2 on price: repeats hint
await vsay("second guess here", { stage: 'customer_waiting' });
// 3rd attempt accepts price and moves to priced
await vsay("third guess here", { stage: 'priced' });
// Now voice scan works and customer hands over money
await vsay("scan the item now", { stage: 'payment' });
// Child takes money into hand
await vsay("take the money", { stage: 'money_held' });
// Exact payment test: deposit in cash box completes sale
vsession.sceneState.changeDue = 0;
await vsay("put in the cash box", { stage: 'sold' });
// Try to give change when exact: customer politely refuses
const enRefusal = await vsay("here is your change", {});
assert(enRefusal.speech.some((s) => s.text.includes('No change needed')), 'Customer politely refuses unwanted change in English');

// 3. Hospital voice progression: any spoken words upon arrival advance to doctor treatment
await vsay("Let's go to the hospital", { scene: 'hospital', stage: 'arrive' });
await vsay("my friend is feeling really unwell today", { stage: 'describe' });

// 4. Stage voice progression: any spoken words start performing
await vsay("Let's go to the stage", { scene: 'stage', stage: 'prep' });
await vsay("Hello everyone I am going to tell you a fun story", { stage: 'performing' });

// 5. Bangla voice progression tests
const vbchild = { id: 'voice_bn', name: 'রিয়া', lang: 'bn', petType: 'cat', petName: 'মোমো', level: 2, settings: {} };
const vbsession = brain.newSession(vbchild, 'bn');
async function vbsay(text, expect = {}) {
  const res = await brain.processTurn(vbsession, vbchild, { text, source: text === '' ? 'silence' : 'voice' });
  for (const [k, v] of Object.entries(expect)) {
    const actual = k === 'scene' ? res.scene : k === 'stage' ? vbsession.sceneState?.stage : res[k];
    const ok = actual === v;
    if (!ok) { failures++; console.log(`   ❌ expected ${k}=${v} got ${actual}`); }
  }
  return res;
}
await vbsay("চলো রেস্টুরেন্টে যাই", { scene: 'restaurant', stage: 'table_ready' });
await vbsay("আপনি কী খাবেন?", { stage: 'order_heard' });
await vbsay("শেফের জানালা", { stage: 'at_chef' });
await vbsay("ভুল খাবার ১", { stage: 'chef_mismatch' });
await vbsay("ভুল খাবার ২", { stage: 'chef_mismatch' });
await vbsay("এবার ঠিক করো", { stage: 'cooking' });
vbsession.sceneState.stage = 'complaint';
await vbsay("আমি আন্তরিকভাবে দুঃখিত", { stage: 'ready_to_serve' });

await vbsay("চলো দোকানে যাই", { scene: 'shop', stage: 'customer_waiting' });
await vbsay("স্ক্যান করো", { stage: 'customer_waiting' });
await vbsay("অন্য কথা এক", { stage: 'customer_waiting' });
await vbsay("অন্য কথা দুই", { stage: 'customer_waiting' });
await vbsay("অন্য কথা তিন", { stage: 'priced' });
await vbsay("স্ক্যান করো", { stage: 'payment' });
await vbsay("টাকা নিলাম", { stage: 'money_held' });
vbsession.sceneState.changeDue = 20;
await vbsay("ক্যাশ বক্সে রাখো", { stage: 'change_needed' });
await vbsay("ফেরত নাও", { stage: 'sold' });
const bnRefusal = await vbsay("ফেরত নাও", {});
assert(bnRefusal.speech.some((s) => s.text.includes('ফেরত লাগবে না')), 'Customer politely refuses unwanted change in Bangla');

await vbsay("চলো হাসপাতালে যাই", { scene: 'hospital', stage: 'arrive' });
await vbsay("আমার বন্ধু খুব অসুস্থ", { stage: 'describe' });

console.log('\n=== PARENT REPORT & SPEAKING SCORE TESTS ===');

// Setup isolated DATA_DIR to ensure data/db.json is NEVER touched
const __test_dirname = path.dirname(fileURLToPath(import.meta.url));
const realDbPath = path.join(__test_dirname, '..', '..', 'data', 'db.json');
let realDbContentBefore = null;
if (fs.existsSync(realDbPath)) {
  realDbContentBefore = fs.readFileSync(realDbPath, 'utf8');
}

const testTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-selftest-'));
process.env.DATA_DIR = testTmpDir;

const db = await import('../db.js');
const dashboard = await import('../dashboard.js');
db.load();

function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.log(`   ❌ Assertion failed: ${msg}`);
  } else {
    console.log(`   ✓ ${msg}`);
  }
}

// Helper to record a quick mock turn
function addMockTurn(rec, c, text, wordCount, opts = {}) {
  db.recordTurn(rec, c, {
    text,
    source: opts.source || 'voice',
    response: {
      skills: opts.skills || ['naming'],
      intent: opts.intent || 'chat',
      scene: opts.scene || 'home',
      world: { location: opts.scene || 'home' },
      pet: { text: 'Great!' },
      level: opts.level || c.level || 2,
    },
    metrics: { wordCount, isQuestion: Boolean(opts.isQuestion) },
  });
}

// 1. Non-qualifying session test (< 5 utterances)
console.log('\n--- 1. Non-qualifying session (< 5 utterances) ---');
const nqChild = db.createChild({ name: 'Shorty', lang: 'en', pin: '1111' });
const nqSession = db.createSessionRecord(nqChild);
for (let i = 0; i < 4; i++) {
  addMockTurn(nqSession, nqChild, `little phrase ${i}`, 3);
}
db.endSessionRecord(nqSession);
assert(nqSession.score === undefined || nqSession.score === null, 'Session with < 5 utterances has no score stored');
const nqScoreDirect = dashboard.computeSessionScore(nqSession, 2);
assert(nqScoreDirect === null, 'computeSessionScore returns null for session with < 5 utterances');
const nqDash = dashboard.buildDashboard(nqChild, { pinVerified: true });
assert(nqDash.baseline.ready === false, 'Baseline is not ready when qualifying sessions < 3');
assert(nqDash.baseline.sessionsCompleted === 0, 'Non-qualifying session not counted toward baseline');
assert(nqDash.speakingScore === null, 'Speaking score is null when baseline not ready');

// 2. Baseline building (3 qualifying sessions)
console.log('\n--- 2. Baseline building (Sessions 1, 2, 3) ---');
const baseChild = db.createChild({ name: 'BaseKid', lang: 'en', pin: '2222', level: 2 });

// Session 1 (qualifying: 5 utterances)
const bs1 = db.createSessionRecord(baseChild);
for (let i = 0; i < 5; i++) {
  addMockTurn(bs1, baseChild, `apple banana orange fruit ${i}`, 4);
}
db.endSessionRecord(bs1);
assert(bs1.score !== undefined && bs1.score !== null, 'Session 1 has score computed and saved');
const bDash1 = dashboard.buildDashboard(baseChild, { pinVerified: true });
assert(bDash1.baseline.ready === false, 'Baseline not ready after 1 session');
assert(bDash1.baseline.sessionsCompleted === 1, 'Baseline reports 1 session completed');
assert(bDash1.baseline.message.includes('(1 of 3 sessions)'), 'Baseline message shows (1 of 3 sessions)');
assert(bDash1.speakingScore === null, 'Speaking score is null after 1 session');

// Session 2 (qualifying: 5 utterances)
const bs2 = db.createSessionRecord(baseChild);
for (let i = 0; i < 5; i++) {
  addMockTurn(bs2, baseChild, `cat dog puppy kitten pet ${i}`, 4);
}
db.endSessionRecord(bs2);
const bDash2 = dashboard.buildDashboard(baseChild, { pinVerified: true });
assert(bDash2.baseline.ready === false, 'Baseline not ready after 2 sessions');
assert(bDash2.baseline.sessionsCompleted === 2, 'Baseline reports 2 sessions completed');
assert(bDash2.baseline.message.includes('(2 of 3 sessions)'), 'Baseline message shows (2 of 3 sessions)');
assert(bDash2.speakingScore === null, 'Speaking score is null after 2 sessions');

// Session 3 (qualifying: 5 utterances)
const bs3 = db.createSessionRecord(baseChild);
for (let i = 0; i < 5; i++) {
  addMockTurn(bs3, baseChild, `red blue green yellow color ${i}`, 4);
}
db.endSessionRecord(bs3);
const bDash3 = dashboard.buildDashboard(baseChild, { pinVerified: true });
assert(bDash3.baseline.ready === true, 'Baseline is ready after 3 qualifying sessions');
assert(bDash3.baseline.sessionsCount === 3, 'Baseline sessionsCount is 3');
assert(bDash3.speakingScore !== null, 'Speaking score is generated once baseline is ready');
assert(typeof bDash3.speakingScore.number === 'number' && bDash3.speakingScore.number >= 0 && bDash3.speakingScore.number <= 100, 'Score is between 0 and 100');
assert(bDash3.speakingScore.components.wordVariety >= 0, 'wordVariety mini-bar present');
assert(bDash3.speakingScore.components.sentenceLength >= 0, 'sentenceLength mini-bar present');
assert(bDash3.speakingScore.components.takingPart >= 0, 'takingPart mini-bar present');
assert(bDash3.speakingScore.components.sentenceLevel >= 0, 'sentenceLevel mini-bar present');
assert(['Getting started', 'Growing', 'Strong'].includes(bDash3.speakingScore.label), 'Speaking score label valid');
assert(bDash3.speakingScore.disclaimer.includes('no pronunciation analysis'), 'Disclaimer states no pronunciation analysis');

// 3. Score going up and going down vs baseline
console.log('\n--- 3. Score going up and down vs baseline ---');
// Session 4: Higher performance (more variety, longer sentences: 7 words per utterance, 6 utterances)
const bs4 = db.createSessionRecord(baseChild);
for (let i = 0; i < 6; i++) {
  addMockTurn(bs4, baseChild, `extraordinary wondrous fantastic brilliant magical story chapter ${i}`, 7);
}
db.endSessionRecord(bs4);
const bDash4 = dashboard.buildDashboard(baseChild, { pinVerified: true, range: 'today' });
assert(bDash4.speakingScore.diffNumber >= 0, 'Score goes up on longer sentences and richer variety');
assert(bDash4.speakingScore.changeVsBaseline.startsWith('+') || bDash4.speakingScore.changeVsBaseline === '0', 'Positive change has + prefix');

// Session 5: Lower performance (short sentences: 1 word per utterance, 5 utterances)
const bs5 = db.createSessionRecord(baseChild);
for (let i = 0; i < 5; i++) {
  addMockTurn(bs5, baseChild, 'hi', 1);
}
db.endSessionRecord(bs5);
const bDash5 = dashboard.buildDashboard(baseChild, { pinVerified: true, range: 'today' });
assert(bDash5.speakingScore.diffNumber < bDash4.speakingScore.diffNumber, 'Score decreases when session metrics drop below baseline');

// 4. Transcripts privacy (storeTranscripts OFF hides sentence text, keeps counts)
console.log('\n--- 4. Transcripts privacy toggle ---');
const privKid = db.createChild({ name: 'PrivKid', lang: 'en', pin: '3333' });
db.updateChild(privKid.id, { settings: { storeTranscripts: false } });
const pSession = db.createSessionRecord(privKid);
for (let i = 0; i < 5; i++) {
  addMockTurn(pSession, privKid, `Top secret sentence number ${i} that should never be revealed in raw text`, 11);
}
db.endSessionRecord(pSession);
assert(pSession.turns[0].child === '[11 words]', 'Recorded turn child text is replaced with [N words] when storeTranscripts=false');
const privDash = dashboard.buildDashboard(privKid, { pinVerified: true });
assert(privDash.todayCard.longestSentence.wordCount === 11, 'Longest sentence word count is retained');
assert(privDash.todayCard.longestSentence.text === null, 'Longest sentence text is strictly null when storeTranscripts=false');
assert(privDash.todayCard.newWords.length > 0, 'Word chips/vocab counts still work');

// 5. Early flag logic (5 consecutive qualifying sessions after 3 baseline sessions below by >= 15%)
console.log('\n--- 5. Early flag logic ---');
const flagKid = db.createChild({ name: 'FlagKid', lang: 'en', pin: '4444', level: 2 });
// 3 baseline sessions with high average sentence length (5.0 words/sentence)
for (let s = 1; s <= 3; s++) {
  const sess = db.createSessionRecord(flagKid);
  for (let u = 0; u < 5; u++) {
    addMockTurn(sess, flagKid, `baseline sentence word one two ${s}_${u}`, 5);
  }
  db.endSessionRecord(sess);
}
const flagDash0 = dashboard.buildDashboard(flagKid, { pinVerified: true });
assert(flagDash0.baseline.ready === true, 'FlagKid baseline established');
assert(flagDash0.baseline.avgWords === 5, 'FlagKid baseline avgWords is 5.0');
assert(flagDash0.earlyFlag.active === false, 'Early flag inactive immediately after baseline');

// Add 4 qualifying sessions with low sentence length (2.0 words/sentence, drop = 60% > 15%)
for (let s = 1; s <= 4; s++) {
  const sess = db.createSessionRecord(flagKid);
  for (let u = 0; u < 5; u++) {
    addMockTurn(sess, flagKid, `low turn`, 2);
  }
  db.endSessionRecord(sess);
}
const flagDash4 = dashboard.buildDashboard(flagKid, { pinVerified: true });
assert(flagDash4.earlyFlag.active === false, 'Early flag inactive with only 4 sessions below baseline (requires 5)');

// Add 5th qualifying session with low sentence length
const sess5 = db.createSessionRecord(flagKid);
for (let u = 0; u < 5; u++) {
  addMockTurn(sess5, flagKid, `low turn`, 2);
}
db.endSessionRecord(sess5);
const flagDash5 = dashboard.buildDashboard(flagKid, { pinVerified: true });
assert(flagDash5.earlyFlag.active === true, 'Early flag triggers on 5 consecutive sessions >= 15% below baseline');
assert(flagDash5.earlyFlag.reasons.length > 0, 'Early flag lists reasons with exact numbers');
assert(flagDash5.earlyFlag.reasons[0].metric === 'sentenceLength', 'Reason correctly identifies sentenceLength drop');
assert(flagDash5.earlyFlag.reasons[0].baseline === 5, 'Reason shows exact baseline: 5');
assert(flagDash5.earlyFlag.reasons[0].recent === 2, 'Reason shows exact recent: 2');
assert(flagDash5.earlyFlag.reasons[0].dropPercent === 60, 'Reason shows exact drop percentage: 60%');
assert(!flagDash5.earlyFlag.note.toLowerCase().includes('diagnos'), 'Early flag gently suggests professional and never diagnoses');

// 6. Bangla session test
console.log('\n--- 6. Bangla session test ---');
const bnKid = db.createChild({ name: 'অনিক', lang: 'bn', pin: '5555', level: 2 });
const bnSess = db.createSessionRecord(bnKid);
const bnPhrases = [
  'আমি একটা সুন্দর লাল গাড়ি চাই',
  'চলো আমরা দোকানে গিয়ে একটা বই কিনি',
  'আমার বিড়াল অনেক মিষ্টি বন্ধু',
  'ডাক্তার কাকা আমার পেটে ব্যথা',
  'তুমি কেমন আছো আজ সকালে',
  'আমরা অনেক মজা করব আজ'
];
for (const phrase of bnPhrases) {
  addMockTurn(bnSess, bnKid, phrase, phrase.split(' ').length);
}
db.endSessionRecord(bnSess);
assert(bnSess.score !== undefined && bnSess.score !== null, 'Bangla session score computed');
assert(bnSess.score.total > 0 && bnSess.score.total <= 100, 'Bangla session score in valid range 0..100');
assert(Object.keys(bnSess.vocab).length >= 5, 'Bangla unique vocabulary tracked correctly');
const bnDash = dashboard.buildDashboard(bnKid, { pinVerified: true });
assert(bnDash.todayCard.hasData === true, 'Bangla today card has data');
assert(bnDash.disclaimer.includes('চিকিৎসা মূল্যায়ন'), 'Bangla disclaimer rendered in Bangla');
assert(bnDash.level.label.length > 0, 'Bangla level label present');

// 7. Parent PIN gate test
console.log('\n--- 7. Parent PIN gate test ---');
// Child without PIN
const noPinKid = db.createChild({ name: 'NoPinKid', lang: 'en' });
const noPinDash = dashboard.buildDashboard(noPinKid, { pinVerified: false });
assert(noPinDash.requiresPin === true, 'Child without PIN has requiresPin=true');
assert(noPinDash.speakingScore === null, 'Speaking score omitted when PIN is not verified');
assert(noPinDash.todayCard === null, 'Today card omitted when PIN is not verified');
assert(noPinDash.earlyFlag === null, 'Early flag omitted when PIN is not verified');

// Child with PIN but unverified request
const pinKid = db.createChild({ name: 'PinKid', lang: 'en', pin: '6666' });
const unverifiedDash = dashboard.buildDashboard(pinKid, { pinVerified: false });
assert(unverifiedDash.requiresPin === true, 'Unverified request has requiresPin=true');
assert(unverifiedDash.speakingScore === null, 'Speaking score omitted for unverified request');
assert(unverifiedDash.todayCard === null, 'Today card omitted for unverified request');
assert(unverifiedDash.earlyFlag === null, 'Early flag omitted for unverified request');

// Child with PIN and verified request
const verifiedDash = dashboard.buildDashboard(pinKid, { pinVerified: true });
assert(verifiedDash.requiresPin === false, 'Verified request has requiresPin=false');
assert(verifiedDash.baseline !== undefined, 'Baseline present when verified');

// 8. Old session without score: read-time score computation
console.log('\n--- 8. Old session read-time computation ---');
const oldKid = db.createChild({ name: 'OldKid', lang: 'en', pin: '7777', level: 2 });
const oldSess = db.createSessionRecord(oldKid);
for (let i = 0; i < 5; i++) {
  addMockTurn(oldSess, oldKid, `legacy turn utterance ${i}`, 4);
}
// Simulate old session ending before score feature was added:
oldSess.endedAt = new Date().toISOString();
delete oldSess.score;
assert(oldSess.score === undefined, 'Old session has no saved score');
const oldDash = dashboard.buildDashboard(oldKid, { pinVerified: true });
assert(oldDash.timeline.length === 1, 'Old session is in timeline');
assert(oldDash.timeline[0].score !== null && oldDash.timeline[0].score.total > 0, 'Score is computed dynamically at read-time for old sessions');
assert(oldSess.score === undefined, 'Old session record in db was not mutated/rewritten');

console.log('\n=== LOCAL CURRICULUM RETRIEVAL & BM25 TESTS ===');
const retriever = await import('../curriculum/retriever.js');

// Test 1: Hard filter matching on scene, level, and language
console.log('\n--- 1. Hard filters on scene, level, and language ---');
const restItems = retriever.retrieve({ lang: 'en', scene: 'restaurant', level: 2 });
assert(restItems.length >= 3, 'Retrieved at least 3 items for restaurant level 2 EN');
assert(restItems.every((it) => it.scene === 'restaurant' && it.level === 2 && it.lang === 'en'), 'All retrieved items strictly match scene=restaurant, level=2, lang=en');

const shopItemsL3 = retriever.retrieve({ lang: 'en', scene: 'shop', level: 3 });
assert(shopItemsL3.every((it) => it.scene === 'shop' && it.level === 3), 'All items match shop level 3');

// Test 2: Safe fallback when level or scene has no direct items
console.log('\n--- 2. Safe fallback when level or scene has no direct items ---');
// Nearest level fallback
const fallbackLvl = retriever.getFilteredCandidates('en', 'restaurant', 99); // nonexistent level 99
assert(fallbackLvl.length >= 3, 'Fallback returned items for out-of-range level 99');
assert(fallbackLvl.every((it) => it.scene === 'restaurant'), 'Fallback preserved scene=restaurant');

// Empty/unknown scene falls back to home
const fallbackScene = retriever.getFilteredCandidates('en', 'unknown_mystic_land', 2);
assert(fallbackScene.length >= 3, 'Fallback returned items for unknown scene');
assert(fallbackScene.every((it) => it.scene === 'home'), 'Unknown scene falls back to home scene');

// Test 3: Tokenizer preserves Bangla vowel signs and retrieves by vowel-sign query
console.log('\n--- 3. Tokenizer with Bangla vowel signs (\\p{M}) ---');
const bnTokens = retriever.tokenize('আমি গরম ভাত আর মিষ্টি পানি খাব');
assert(bnTokens.includes('গরম'), 'Token includes গরম');
assert(bnTokens.includes('ভাত'), 'Token includes ভাত (with vowel sign া)');
assert(bnTokens.includes('পানি'), 'Token includes পানি (with vowel signs া and ি)');
assert(bnTokens.includes('মিষ্টি'), 'Token includes মিষ্টি (with vowel signs and conjunct)');

// Test BM25 ranking on Bangla query with vowel signs
const bnRest = retriever.retrieve({ lang: 'bn', scene: 'restaurant', level: 1, query: 'পানি গরম ভাত' });
assert(bnRest.length >= 3, 'Retrieved Bangla restaurant items');
assert(bnRest[0].targetWords.includes('ভাত') || bnRest[0].targetWords.includes('পানি'), 'Top item matches vowel-bearing query terms');

// Test 4: Query uses only scene, level, and weak points (never child text)
console.log('\n--- 4. Query construction uses only scene, level, and weak points ---');
const qStr = retriever.buildQuery('hospital', 2, ['short_answers', 'silences']);
assert(qStr.includes('hospital') && qStr.includes('level_2') && qStr.includes('short_answers') && qStr.includes('silences'), 'Query constructed with scene, level, and weak points');
assert(!qStr.includes('my tummy hurts'), 'Query does not contain child text');

// Weak points detection reuses dashboard targets
const weakPts = retriever.detectWeakPoints({ silences: 2, recentMetrics: [{ wordCount: 1 }], vocab: { hi: 1 } }, 2);
assert(weakPts.includes('short_answers'), 'detectWeakPoints detects short_answers using dashboard target');
assert(weakPts.includes('few_words'), 'detectWeakPoints detects few_words using dashboard target');
assert(weakPts.includes('silences'), 'detectWeakPoints detects silences');

// Test 5: Curriculum usage in pet replies: silence, fallback, and level 1/2 short answer follow-up
console.log('\n--- 5. Pet reply curriculum usage and question limit ---');
const cChild = db.createChild({ name: 'CurricKid', lang: 'en', level: 1 });
const cSession = brain.newSession(cChild, 'en');

// (a) Silence hint
const silTurn = await brain.processTurn(cSession, cChild, { text: '', source: 'silence' });
assert(silTurn.curriculum !== null, 'Curriculum stored on silence turn');
assert(silTurn.curriculum.id && silTurn.curriculum.targetWords?.length > 0, 'Curriculum has id and target words');

// (b) Fallback reply when rules have no answer
const fbTurn = await brain.processTurn(cSession, cChild, { text: 'xyzzy gobbledegook blabla', source: 'voice' });
assert(fbTurn.curriculum !== null, 'Curriculum used on fallback turn');
assert(fbTurn.curriculum.id && fbTurn.curriculum.targetWords?.length > 0, 'Curriculum target words present on fallback');
const fbQuestionsCount = (fbTurn.pet.text.match(/\?/g) || []).length;
assert(fbQuestionsCount <= 1, 'At most ONE question asked on fallback turn');

// (c) Short answer at level 1: at most one question asked
const shortTurn = await brain.processTurn(cSession, cChild, { text: 'cat', source: 'voice' });
const shortQuestionsCount = (shortTurn.pet.text.match(/\?/g) || []).length;
assert(shortQuestionsCount <= 1, 'At most ONE question asked on short answer turn at level 1');

// Scripted scene rule check: Step 1 voice required rule is untouched
const vSess = brain.newSession(cChild, 'en');
await brain.processTurn(vSess, cChild, { text: "Let's go to the restaurant", source: 'voice' });
assert(vSess.sceneState?.stage === 'table_ready', 'Scripted scene stage transition preserved');

// Test 6: Persistence: only id, targetWords, and followUpQuestion stored on turn
console.log('\n--- 6. Persistence of used curriculum on turns ---');
const pChild = db.createChild({ name: 'PersistKid', lang: 'en', level: 2 });
const pSess = db.createSessionRecord(pChild);
db.recordTurn(pSess, pChild, {
  text: 'blabla fallback utterance',
  source: 'voice',
  response: {
    skills: ['naming'],
    intent: 'fallback',
    scene: 'home',
    world: { location: 'home' },
    pet: { text: 'Tell me more! What color is it?' },
    level: 2,
    curriculum: {
      id: 'home_en_l2_01',
      targetWords: ['clean', 'tidy', 'toys'],
      followUpQuestion: 'Does your room look nice and tidy?',
    },
  },
  metrics: { wordCount: 3 },
});
db.endSessionRecord(pSess);
const savedTurn = pSess.turns[0];
assert(savedTurn.curriculum !== undefined && savedTurn.curriculum !== null, 'Turn has curriculum saved');
assert(savedTurn.curriculum.id === 'home_en_l2_01', 'Curriculum id saved');
assert(Array.isArray(savedTurn.curriculum.targetWords) && savedTurn.curriculum.targetWords.length === 3, 'Curriculum targetWords saved');
assert(savedTurn.curriculum.followUpQuestion === 'Does your room look nice and tidy?', 'Curriculum followUpQuestion saved');
assert(savedTurn.curriculum.exampleSentences === undefined, 'Unused fields (exampleSentences) are not stored on turn');

// Test 7: Parent report section 6 practice words aggregation
console.log('\n--- 7. Parent report section 6 practice words ---');
const pDash = dashboard.buildDashboard(pChild, { pinVerified: true });
assert(Array.isArray(pDash.practiceWords), 'practiceWords is an array in dashboard');
assert(pDash.practiceWords.length === 1, '1 practice word group found from recent sessions');
assert(pDash.practiceWords[0].words.includes('clean'), 'Practice group includes clean');
assert(pDash.practiceWords[0].count === 1, 'Practice count is 1');
assert(pDash.practiceWords[0].example !== null, 'Practice group has example sentence looked up from index');
assert(pDash.practiceWords[0].question === 'Does your room look nice and tidy?', 'Practice group has follow-up question');

// Empty state test when no practice words in last 7 days
const emptyChild = db.createChild({ name: 'EmptyKid', lang: 'en', pin: '0000' });
const emptyDash = dashboard.buildDashboard(emptyChild, { pinVerified: true });
assert(Array.isArray(emptyDash.practiceWords) && emptyDash.practiceWords.length === 0, 'Empty state when no practice words');

console.log('\n=== READ-ONLY MCP SERVER TESTS ===');
const mcp = await import('../mcp/index.js');
mcp._resetLockoutForTest();

// 1. A child with no PIN is refused with exact message
console.log('\n--- 1. Child with no PIN refused ---');
const noPinKidMcp = db.createChild({ name: 'NoPinMcp', lang: 'en' });
const noPinAuth = mcp.authenticateChild(noPinKidMcp.id, '1234');
assert(noPinAuth.error === 'Set a parent PIN in the FirstWord parent view first.', 'Child with no PIN refused with exact message');
assert(noPinAuth.child === null, 'No child returned when child has no PIN');

// 2. Lockout works after 5 wrong PINs
console.log('\n--- 2. Lockout after 5 wrong PINs ---');
const pinKidMcp = db.createChild({ name: 'LockoutKid', lang: 'en', pin: '5678' });
// Try 4 wrong PINs
for (let i = 1; i <= 4; i++) {
  const res = mcp.authenticateChild(pinKidMcp.id, `wrong${i}`);
  assert(res.error === 'Authentication failed. Please check the child ID and PIN.', `Attempt ${i} generic auth failure`);
}
// 5th wrong attempt triggers lockout
const res5 = mcp.authenticateChild(pinKidMcp.id, 'wrong5');
assert(res5.error === 'Authentication failed. Please check the child ID and PIN.', 'Attempt 5 auth failure');
assert(mcp.checkLockout(pinKidMcp.id).locked === true, 'Child is locked out after 5 failures');

// 6th attempt (even with right PIN) is refused with lockout message
const res6 = mcp.authenticateChild(pinKidMcp.id, '5678');
assert(res6.error.startsWith('Too many failed attempts. Please try again in'), 'Attempt 6 locked out with retry message');

// Same error for unknown child
const unkRes = mcp.authenticateChild('nonexistent_child_id', '1234');
assert(unkRes.error === 'Authentication failed. Please check the child ID and PIN.', 'Unknown child returns identical error to wrong PIN');

// 3. Privacy: No PIN hashes, no conversation turns, transcript setting respected
console.log('\n--- 3. MCP tool privacy & notice enforcement ---');
mcp._resetLockoutForTest();
const privChildMcp = db.createChild({ name: 'PrivMcpKid', lang: 'en', pin: '1122' });
db.updateChild(privChildMcp.id, { settings: { storeTranscripts: false } });
const pSessMcp = db.createSessionRecord(privChildMcp);
addMockTurn(pSessMcp, privChildMcp, 'Private sentence should not be exposed', 6);
db.endSessionRecord(pSessMcp);

// Call get_progress_summary handler
const summaryHandler = mcp.server._registeredTools['get_progress_summary'];
const summaryRaw = await summaryHandler.handler({ childId: privChildMcp.id, pin: '1122' });
assert(!summaryRaw.isError, 'get_progress_summary executed successfully');
const summaryData = JSON.parse(summaryRaw.content[0].text);
assert(summaryData.notice === 'These numbers describe what happened inside the app. They are not a medical assessment or diagnosis. Speech recognition makes mistakes.', 'Progress summary includes exact medical notice');
assert(!JSON.stringify(summaryData).includes('pinHash') && !JSON.stringify(summaryData).includes('pinSalt'), 'No PIN hash or salt in progress summary');
assert(summaryData.today.longestSentence.wordCount === 6, 'Longest sentence word count present');
assert(summaryData.today.longestSentence.text === null, 'Longest sentence text is null when transcripts are OFF');
assert(summaryData.recentTurns === undefined, 'No conversation turns returned in summary');

// Call get_weekly_report handler
const reportHandler = mcp.server._registeredTools['get_weekly_report'];
const reportRaw = await reportHandler.handler({ childId: privChildMcp.id, pin: '1122' });
assert(!reportRaw.isError, 'get_weekly_report executed successfully');
const reportData = JSON.parse(reportRaw.content[0].text);
assert(reportData.notice === 'These numbers describe what happened inside the app. They are not a medical assessment or diagnosis. Speech recognition makes mistakes.', 'Weekly report includes exact medical notice');
assert(!JSON.stringify(reportData).includes('pinHash') && !JSON.stringify(reportData).includes('pinSalt'), 'No PIN hash or salt in weekly report');
assert(reportData.recentTurns === undefined, 'Recent conversation turns strictly excluded from weekly report');

// Call search_curriculum handler
const curricHandler = mcp.server._registeredTools['search_curriculum'];
const curricRaw = await curricHandler.handler({ query: 'warm rice', scene: 'restaurant', level: 1, lang: 'en' });
assert(!curricRaw.isError, 'search_curriculum executed successfully');
const curricData = JSON.parse(curricRaw.content[0].text);
assert(Array.isArray(curricData) && curricData.length <= 5, 'Curriculum results capped at 5');
assert(curricData.every((it) => it.id && it.targetWords && it.scene === 'restaurant'), 'Curriculum items contain educational fields');
assert(!JSON.stringify(curricData).includes(privChildMcp.id), 'Search curriculum contains zero child data');

// 4. Stdio MCP process execution test
console.log('\n--- 4. Stdio MCP protocol execution test ---');
const mcpScriptPath = path.join(__test_dirname, '..', 'mcp', 'index.js');
const mcpProcess = spawn('node', [mcpScriptPath], {
  env: { ...process.env, DATA_DIR: testTmpDir },
  stdio: ['pipe', 'pipe', 'pipe'],
});

const mcpStdoutLines = [];
let mcpStderr = '';
mcpProcess.stderr.on('data', (d) => { mcpStderr += d.toString(); });

const stdioTestDone = new Promise((resolve, reject) => {
  let buf = '';
  mcpProcess.stdout.on('data', (d) => {
    buf += d.toString();
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      mcpStdoutLines.push(line.trim());
      try {
        const msg = JSON.parse(line.trim());
        if (msg.id === 1) {
          // Send tools/list request
          mcpProcess.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
        } else if (msg.id === 2) {
          resolve(msg);
        }
      } catch (err) {
        reject(new Error(`Stdout line was not valid JSON: ${line}`));
      }
    }
  });

  // Send initialize request
  mcpProcess.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'selftest', version: '1.0' },
    },
  }) + '\n');
});

const toolsResponse = await Promise.race([
  stdioTestDone,
  new Promise((_, reject) => setTimeout(() => reject(new Error('MCP stdio test timed out')), 5000)),
]);

mcpProcess.kill();

assert(mcpStdoutLines.length >= 2, 'MCP server produced stdout responses');
assert(mcpStdoutLines.every((l) => {
  try { JSON.parse(l); return true; } catch { return false; }
}), 'Server stdout contains ONLY valid JSON-RPC messages');

const toolsList = toolsResponse.result.tools.map((t) => t.name);
assert(toolsList.length === 3, 'Tool list is exactly 3 tools');
assert(toolsList.includes('get_progress_summary') && toolsList.includes('get_weekly_report') && toolsList.includes('search_curriculum'), 'Tools match expected names');
const forbiddenWords = ['write', 'delete', 'set', 'update'];
const hasForbidden = toolsList.some((t) => forbiddenWords.some((w) => t.toLowerCase().includes(w)));
assert(!hasForbidden, 'No tool name contains write, delete, set, or update (strictly read-only)');

// 8. Profile preview and persistent storage check
console.log('\n--- 8. Profile preview & persistent storage check ---');
const testProfiles = db.listChildren();
assert(Array.isArray(testProfiles), 'listChildren returns array');
const persistentChild = db.createChild({ name: 'Zayan', lang: 'en', petType: 'bunny', petName: 'Fluffy' });
const refreshedList = db.listChildren();
assert(refreshedList.some((c) => c.id === persistentChild.id && c.name === 'Zayan'), 'Newly created profile is immediately listed and saved');

// 9. Verify data/db.json was NOT touched
console.log('\n--- 9. Data preservation check ---');
if (realDbContentBefore !== null && fs.existsSync(realDbPath)) {
  const realDbContentAfter = fs.readFileSync(realDbPath, 'utf8');
  assert(realDbContentBefore === realDbContentAfter, 'data/db.json was NOT touched or modified during tests');
} else {
  assert(!fs.existsSync(realDbPath), 'data/db.json did not exist and was not created');
}

// Clean up test temporary folder
try {
  fs.rmSync(testTmpDir, { recursive: true, force: true });
} catch (e) {
  // best effort cleanup
}

console.log(`\n\n${failures ? `❌ ${failures} expectation(s) failed` : '✅ all expectations passed'}`);
process.exit(failures ? 1 : 0);
