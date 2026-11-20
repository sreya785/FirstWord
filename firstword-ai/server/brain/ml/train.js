// Trains the intent classifier (multinomial logistic regression, SGD) on the generated
// corpus + any examples parents taught through the dashboard. Pure JavaScript, no GPU,
// no external services; takes a few seconds on a laptop.
//
//   npm run train            -> writes server/brain/ml/model.json and prints a report
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from '../normalize.js';
import { featurize } from './features.js';
import { generate, INTENTS, templateVocabulary } from './dataset.js';
import * as L from '../lexicon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MODEL_PATH = path.join(__dirname, 'model.json');
export const CUSTOM_PATH = path.join(__dirname, '..', '..', '..', 'data', 'training', 'custom.jsonl');

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function loadCustomExamples() {
  if (!fs.existsSync(CUSTOM_PATH)) return [];
  return fs.readFileSync(CUSTOM_PATH, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((e) => e && e.text && INTENTS.includes(e.intent));
}

export function trainModel({ epochs = 30, lr0 = 2.0, seed = 7, holdout = 0.15, log = console.log } = {}) {
  const t0 = Date.now();
  const custom = loadCustomExamples();
  const generated = generate({ perTemplate: 12, seed: 42 });
  // Parent-taught examples are precious: weight them by repeating
  const data = [...generated, ...custom.flatMap((e) => [e, e, e])];
  const rand = rng(seed);
  for (let i = data.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [data[i], data[j]] = [data[j], data[i]]; }

  // Featurise once
  const examples = data.map((e) => ({ f: featurize(normalize(e.text)), y: INTENTS.indexOf(e.intent), lang: e.lang || 'en', text: e.text }));
  // Stratified-ish holdout: every k-th example
  const k = Math.round(1 / holdout);
  const train = examples.filter((_, i) => i % k !== 0);
  const test = examples.filter((_, i) => i % k === 0);

  // Feature vocabulary (document frequency >= 2 in training set)
  const df = new Map();
  for (const ex of train) for (const key of ex.f.keys()) df.set(key, (df.get(key) || 0) + 1);
  const featIndex = new Map();
  for (const [key, c] of df) if (c >= 2) featIndex.set(key, featIndex.size);
  const F = featIndex.size, C = INTENTS.length;
  const toSparse = (f) => { const idx = [], val = []; for (const [key, v] of f) { const i = featIndex.get(key); if (i !== undefined) { idx.push(i); val.push(v); } } return { idx, val }; };
  for (const ex of [...train, ...test]) ex.s = toSparse(ex.f);

  const W = new Float32Array(F * C); // W[f*C + c]
  const b = new Float32Array(C);
  const scores = new Float64Array(C);
  const predict = (s) => {
    for (let c = 0; c < C; c++) scores[c] = b[c];
    for (let j = 0; j < s.idx.length; j++) { const base = s.idx[j] * C, v = s.val[j]; for (let c = 0; c < C; c++) scores[c] += W[base + c] * v; }
    let max = -Infinity; for (let c = 0; c < C; c++) if (scores[c] > max) max = scores[c];
    let sum = 0; for (let c = 0; c < C; c++) { scores[c] = Math.exp(scores[c] - max); sum += scores[c]; }
    for (let c = 0; c < C; c++) scores[c] /= sum;
    return scores;
  };

  let lr = lr0;
  const order = train.map((_, i) => i);
  for (let ep = 0; ep < epochs; ep++) {
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    let loss = 0;
    for (const i of order) {
      const ex = train[i];
      const p = predict(ex.s);
      loss -= Math.log(Math.max(1e-9, p[ex.y]));
      for (let c = 0; c < C; c++) {
        const g = p[c] - (c === ex.y ? 1 : 0);
        if (Math.abs(g) < 1e-4) continue;
        b[c] -= lr * g * 0.1;
        const gl = lr * g;
        for (let j = 0; j < ex.s.idx.length; j++) W[ex.s.idx[j] * C + c] -= gl * ex.s.val[j];
      }
    }
    // light L2 shrinkage once per epoch
    const shrink = 1 - lr * 1e-3;
    for (let i = 0; i < W.length; i++) W[i] *= shrink;
    lr *= 0.88;
    if ((ep + 1) % 5 === 0 || ep === epochs - 1) log(`epoch ${ep + 1}/${epochs}  loss=${(loss / train.length).toFixed(4)}`);
  }

  const evaluate = (set) => {
    let correct = 0; const per = {}; const confusions = new Map();
    for (const ex of set) {
      const p = predict(ex.s);
      let best = 0; for (let c = 1; c < C; c++) if (p[c] > p[best]) best = c;
      const y = INTENTS[ex.y], yhat = INTENTS[best];
      per[y] = per[y] || { n: 0, ok: 0 }; per[y].n++;
      if (best === ex.y) { correct++; per[y].ok++; } else { const key = `${y} -> ${yhat}`; confusions.set(key, (confusions.get(key) || 0) + 1); }
    }
    return { acc: set.length ? correct / set.length : 0, per, confusions: [...confusions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8) };
  };
  const trainEval = evaluate(train), testEval = evaluate(test);

  // Known vocabulary for the spelling fixer: training tokens + lexicon words + template words
  // (clean sources only: typo-augmented training rows must NOT teach the fixer that "plese" is a word)
  const known = new Set(templateVocabulary());
  for (const ex of generate({ perTemplate: 12, seed: 42, augment: false })) for (const t of normalize(ex.text).tokens) known.add(t);
  for (const ex of custom) for (const t of normalize(ex.text).tokens) known.add(t);
  for (const table of [L.FOODS, L.SHOP_ITEMS, L.OBJECTS, L.CHARACTERS, L.LOCATIONS, L.ROLES, L.SYMPTOMS, L.COLORS, L.FEELINGS, L.WEATHER, L.TIMES, L.SIZE_WORDS]) for (const e of Object.values(table)) for (const w of e.en || []) for (const t of w.split(' ')) known.add(t);

  // Quantise weights to int16 for a compact model file
  let maxAbs = 1e-6; for (let i = 0; i < W.length; i++) maxAbs = Math.max(maxAbs, Math.abs(W[i]));
  const scale = maxAbs / 32767;
  const q = new Int16Array(W.length); for (let i = 0; i < W.length; i++) q[i] = Math.round(W[i] / scale);
  const model = {
    version: 2, trainedAt: new Date().toISOString(), intents: INTENTS, features: [...featIndex.keys()], scale,
    weightsB64: Buffer.from(q.buffer).toString('base64'), bias: [...b].map((x) => +x.toFixed(5)),
    known: [...known],
    meta: {
      examples: data.length, generated: generated.length, custom: custom.length, features: F, epochs,
      trainAccuracy: +trainEval.acc.toFixed(4), testAccuracy: +testEval.acc.toFixed(4), testExamples: test.length,
      perIntent: Object.fromEntries(Object.entries(testEval.per).map(([k, v]) => [k, +(v.ok / v.n).toFixed(3)])),
      confusions: testEval.confusions, seconds: +((Date.now() - t0) / 1000).toFixed(1),
    },
  };
  fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
  fs.writeFileSync(MODEL_PATH, JSON.stringify(model));
  log(`\nTrained on ${data.length} examples (${generated.length} generated + ${custom.length} taught) · ${F} features · ${C} intents`);
  log(`Accuracy: train ${(trainEval.acc * 100).toFixed(1)}%  ·  held-out ${(testEval.acc * 100).toFixed(1)}% (${test.length} examples)  ·  ${model.meta.seconds}s`);
  if (testEval.confusions.length) log('Most confused: ' + testEval.confusions.map(([k, v]) => `${k} (${v})`).join(', '));
  log(`Model saved: ${MODEL_PATH} (${(fs.statSync(MODEL_PATH).size / 1024).toFixed(0)} KB)`);
  return model;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  trainModel({});
}
