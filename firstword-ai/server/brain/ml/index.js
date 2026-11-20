// Runtime side of the trained intent model + a lexicon-aware spelling fixer.
// The rule engine stays the primary brain; this is the safety net for paraphrases
// and speech-recognition slips, and it can be re-trained from the parent dashboard.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { featurize } from './features.js';
import { INTENTS, INTENT_LABELS } from './dataset.js';
import { setSpellFixer } from '../normalize.js';
import * as L from '../lexicon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = path.join(__dirname, 'model.json');
const CUSTOM_PATH = path.join(__dirname, '..', '..', '..', 'data', 'training', 'custom.jsonl');

let model = null; // { intents, featIndex: Map, W: Int16Array, scale, bias, known: Set, meta }
let training = null;

// ---------- spelling fixer (edit distance against lexicon words) ----------
const COMMON = 'the a an and or but to of in on at for with from by is are was were be been am do does did have has had can could will would should may might must not no yes it this that these those my your our his her their me you we they he she him them us i who what where when why how which there here very so too also just only more most much many some any all every each both few little big good bad new old same other another again please okay ok now then today tomorrow yesterday always never sometimes maybe really thing things stuff way time day night home house room school work play games game friend friends mom dad baby boy girl man woman people name like love want need know think see look come go get give take make made put let say said tell talk eat drink sleep sit stand run walk jump fly swim open close help stop start find lost found happy sad angry scared tired hungry sick fine great nice fun funny cute pretty beautiful little small long short tall high low fast slow hot cold warm cool wet dry clean dirty red blue green yellow pink purple orange black white brown one two three four five six seven eight nine ten first last next before after up down left right inside outside under over near far away back again around through about because if than when while until'.split(' ');

let candidates = []; // [{ word, first, len }]
let candidateSet = new Set();
function buildCandidates() {
  const words = new Set();
  for (const table of [L.FOODS, L.SHOP_ITEMS, L.OBJECTS, L.CHARACTERS, L.LOCATIONS, L.ROLES, L.SYMPTOMS, L.COLORS, L.FEELINGS, L.WEATHER, L.TIMES]) {
    for (const e of Object.values(table)) for (const w of e.en || []) if (!w.includes(' ') && w.length >= 4) words.add(w);
  }
  for (const w of ['restaurant', 'hospital', 'doctor', 'please', 'want', 'make', 'remove', 'colour', 'color', 'night', 'morning', 'rain', 'snow', 'rainbow', 'thank', 'thanks', 'hello', 'birthday', 'party', 'story', 'song', 'sing', 'dance', 'again', 'another', 'medicine', 'bandage', 'ambulance', 'shopping', 'market', 'kitchen', 'tummy', 'hurts', 'scared', 'tired', 'hungry', 'happy', 'angry']) words.add(w);
  candidates = [...words].map((w) => ({ word: w, first: w[0], len: w.length }));
  candidateSet = new Set(words);
}

function damerau(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  let prev2 = null, prev = Array.from({ length: n + 1 }, (_, j) => j), cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i; let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v; if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur; cur = new Array(n + 1);
  }
  return prev[n];
}

// Extra protection: frequent real words that are one edit away from a lexicon word must never be "fixed".
const SAFE_WORDS = new Set(('kind mind find wind bind hind kids kite king ring sing wing thing bring think thank drink brink pink link sink ' +
  'down town gown crown brown frown clown drown shown grown known throw grow slow blow flow glow snow show ' +
  'payment pay paid cash card cards money price prices cost costs sell sells buy buys shop shops counter customer customers change bill bills ' +
  'feel feels felt fell fill full fall tall ball call wall hall mall small smell spell shell well tell sell yell bell ' +
  'read bread head dead lead bead seat beat heat meat neat eat ate late gate date hate mate rate plate skate state ' +
  'cat cats hat hats bat bats rat rats mat sat fat pat chat that flat ' +
  'dog dogs log fog jog hog frog ' +
  'cake bake lake make take wake rake sake fake ' +
  'car cars bar far jar star scar card cart care ' +
  'pie pies lie tie die ' +
  'nice rice mice ice dice price slice twice ' +
  'cool pool tool fool wool school stool ' +
  'bed beds red fed led wed sled shed ' +
  'ship shop shoe shot show shut shout short sport spot stop stops top tops hop hops pop pops mop cop drop ' +
  'tree trees three free see sea seed seen tea team ' +
  'sun fun run bun gun nun sunny funny bunny money honey ' +
  'name game same came fame lame tame flame frame ' +
  'book books look looks cook cooks took hook nook brook ' +
  'door floor poor moon soon noon spoon room zoom boom ' +
  'bird birds word words world third ' +
  'hand hands sand land band stand grand ' +
  'rain train brain drain grain main pain gain chain plain stain ' +
  'light night right fight sight tight might bright flight ' +
  'water later matter better letter butter ' +
  'milk silk talk walk chalk ' +
  'coat boat goat moat float ' +
  'pen pens hen ten den men then when open ' +
  'cup cups pup pups up ' +
  'bug bugs hug hugs mug mugs rug rugs jug jugs tug ' +
  'fish dish wish swish ' +
  'bear beer dear fear gear hear near pear tear wear year ' +
  'duck luck truck stuck ' +
  'cow cows how now wow bow row ' +
  'song songs long along belong wrong strong ' +
  'star stars start starts party part parts party ' +
  'dance chance france glance ' +
  'baby maybe lady ' +
  'eyes eye bye byes ' +
  'play plays played player stay stays day days way ways say says may pay lay ' +
  'home come some dome nome ' +
  'love loves dove glove above ' +
  'like likes bike bikes hike mike spike strike ' +
  'went want wants want sent tent bent rent dent cent ' +
  'live lives give gives five dive hive alive ' +
  'help helps held hello yellow fellow mellow ' +
  'good food mood wood hood ' +
  'first worst burst thirst ' +
  'friend friends fried tried cried dried ' +
  'tired fired hired wired ' +
  'happy nappy snappy ' +
  'sick kick lick pick tick thick stick quick trick brick click ' +
  'hurt hurts shirt dirt skirt ' +
  'cold bold fold gold hold sold told ' +
  'hot hots not lot pot dot got rot cot ' +
  'more sore core bore wore tore store score ' +
  'done bone cone tone zone gone none phone alone stone ' +
  'said paid laid maid raid ' +
  'draw drew draws straw claw paw paws raw saw law jaw ' +
  'please pleased lease tease cheese these those ' +
  'grab grabs crab crabs drab ' +
  'bite bites kite kites site white quite write ' +
  'person persons lesson ' +
  'again against ' +
  'ready already steady ' +
  'sure pure cure ' +
  'turn turns burn burns ' +
  'wait waits waited ' +
  'tummy mummy dummy yummy ' +
  'belly jelly smelly ' +
  'teeth tooth booth ' +
  'nose rose hose those chose close ' +
  'ears hears tears years bears ' +
  'arm arms farm farms harm charm warm ' +
  'leg legs beg begs peg ' +
  'foot feet meet sweet street ' +
  'face race pace lace place space ' +
  'hair fair pair chair stair ' +
  'back pack sack snack track black ' +
  'funny bunny sunny ' +
  'silly hilly chilly ' +
  'quiet quite quit ' +
  'loud cloud proud ' +
  'fast last past vast ' +
  'slow slower ' +
  'soft loft ' +
  'hard card yard ' +
  'wet pet pets net nets jet jets set sets let lets get gets met vet vets yet ' +
  'dry cry fry try sky shy why fly ' +
  'ask asks mask task bask ' +
  'tell tells ' +
  'mine mind ' +
  'sad mad bad dad had pad glad ' +
  'cry crying ' +
  'hungry angry ' +
  'can cane pan fan man van ran tan than plan ' +
  'eat ate eats ' +
  'there where here were ' +
  'their there ' +
  'two too to ' +
  'four for fore ' +
  'one won ' +
  'eight ate ' +
  'know no now ' +
  'new knew ' +
  'blue blew ' +
  'hear here ' +
  'wear where ' +
  'sun son ' +
  'flower flour ' +
  'bored board ' +
  'brake break ' +
  'cell sell ' +
  'tail tale ' +
  'dear deer ' +
  'meat meet ' +
  'pair pear ' +
  'plain plane ' +
  'sea see ' +
  'weak week ' +
  'write right ' +
  'tomorrow today tonight ' +
  'morning evening afternoon ' +
  'inside outside beside ' +
  'under over after before ' +
  'with without within ' +
  'about above across along around ' +
  'because became become ' +
  'between beyond ' +
  'during ' +
  'myself yourself herself himself itself ' +
  'something nothing anything everything ' +
  'someone anyone everyone ' +
  'somewhere anywhere everywhere nowhere ' +
  'first second third fourth fifth ' +
  'once twice ' +
  'kinda sorta gonna wanna gotta lemme gimme dunno ').split(/\s+/).filter(Boolean));

export function fixToken(tok) {
  if (!/^[a-z]{4,}$/.test(tok)) return null;
  if (model?.known.has(tok) || COMMON_SET.has(tok) || SAFE_WORDS.has(tok) || SAFE_WORDS.has(tok.replace(/s$/, ''))) return null;   // 'payments' is no misspelling
  if (tok.length === 4) {
    // Very short words: only accept a "missing double letter" fix (piza -> pizza), never a substitution (kind -> king)
    for (let i = 0; i < 4; i++) { const cand = tok.slice(0, i + 1) + tok[i] + tok.slice(i + 1); if (candidateSet.has(cand)) return cand; }
    return null;
  }
  const max = tok.length <= 6 ? 1 : 2;
  let best = null, bestD = max + 1;
  for (const c of candidates) {
    if (c.first !== tok[0] || Math.abs(c.len - tok.length) > max) continue;
    const d = damerau(tok, c.word, max);
    if (d < bestD) { bestD = d; best = c.word; if (d === 0) break; }
  }
  return best && bestD <= max ? best : null;
}
const COMMON_SET = new Set(COMMON);

function spellFixer(tokens) {
  let changed = false;
  const out = tokens.map((t) => { const fx = fixToken(t); if (fx && fx !== t) { changed = true; return fx; } return t; });
  return changed ? out : null;
}

// ---------- model ----------
export function loadModel() {
  try {
    if (!fs.existsSync(MODEL_PATH)) { model = null; return false; }
    const raw = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
    const buf = Buffer.from(raw.weightsB64, 'base64');
    const W = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
    model = { intents: raw.intents, featIndex: new Map(raw.features.map((f, i) => [f, i])), W, scale: raw.scale, bias: raw.bias, known: new Set(raw.known), meta: raw.meta, trainedAt: raw.trainedAt };
    return true;
  } catch (e) {
    console.error('ML model failed to load:', e.message);
    model = null; return false;
  }
}

export function ready() { return Boolean(model); }
export function status() {
  return { ready: Boolean(model), training: Boolean(training), trainedAt: model?.trainedAt || null, meta: model?.meta || null, intents: INTENTS, labels: INTENT_LABELS, customExamples: countCustom() };
}
function countCustom() { try { return fs.existsSync(CUSTOM_PATH) ? fs.readFileSync(CUSTOM_PATH, 'utf8').split('\n').filter(Boolean).length : 0; } catch { return 0; } }

/** Classify a normalized utterance → { intent, conf, second, secondConf } or null */
export function classify(n) {
  if (!model || !n?.tokens?.length) return null;
  const f = featurize(n);
  const C = model.intents.length;
  const scores = new Float64Array(C);
  for (let c = 0; c < C; c++) scores[c] = model.bias[c];
  for (const [key, v] of f) {
    const i = model.featIndex.get(key);
    if (i === undefined) continue;
    const base = i * C;
    for (let c = 0; c < C; c++) scores[c] += model.W[base + c] * model.scale * v;
  }
  let max = -Infinity; for (let c = 0; c < C; c++) if (scores[c] > max) max = scores[c];
  let sum = 0; for (let c = 0; c < C; c++) { scores[c] = Math.exp(scores[c] - max); sum += scores[c]; }
  let best = 0, second = -1;
  for (let c = 0; c < C; c++) { scores[c] /= sum; if (scores[c] > scores[best]) best = c; }
  for (let c = 0; c < C; c++) if (c !== best && (second < 0 || scores[c] > scores[second])) second = c;
  return { intent: model.intents[best], conf: +scores[best].toFixed(3), second: model.intents[second], secondConf: +scores[second].toFixed(3) };
}

/** Add a parent-taught example and retrain in the background. */
export function teach({ text, intent, lang }) {
  if (!text || !INTENTS.includes(intent)) throw new Error('Invalid example');
  fs.mkdirSync(path.dirname(CUSTOM_PATH), { recursive: true });
  const clean = String(text).trim().slice(0, 200);
  // keep one entry per sentence: re-teaching replaces the old label instead of piling up duplicates
  const kept = fs.existsSync(CUSTOM_PATH)
    ? fs.readFileSync(CUSTOM_PATH, 'utf8').split('\n').filter(Boolean).filter((l) => { try { return JSON.parse(l).text.toLowerCase() !== clean.toLowerCase(); } catch { return false; } })
    : [];
  kept.push(JSON.stringify({ text: clean, intent, lang: lang === 'bn' ? 'bn' : 'en', at: new Date().toISOString() }));
  fs.writeFileSync(CUSTOM_PATH, kept.join('\n') + '\n');
  return retrain();
}

export function retrain() {
  if (training) return training;
  training = new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'train.js')], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => {
      training = null;
      const ok = code === 0 && loadModel();
      console.log(ok ? `ML model retrained (${model.meta.examples} examples, held-out ${(model.meta.testAccuracy * 100).toFixed(1)}%)` : `ML retrain failed:\n${out}`);
      resolve({ ok, log: out.trim().split('\n').slice(-4).join('\n'), meta: model?.meta || null });
    });
  });
  return training;
}

// ---------- boot ----------
buildCandidates();
setSpellFixer(spellFixer);
loadModel();
