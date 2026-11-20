// Feature extraction for the intent classifier.
// Works on the normalized utterance (n.norm / n.tokens) so Bangla phrase-mapping already happened.
// Word uni/bigrams + character n-grams make it robust to speech-recognition slips ("resturant", "hostpital").

const STOP = new Set(['the', 'a', 'an', 'to', 'of', 'and', 'is', 'it', 'in', 'on', 'at', 'for', 'me', 'my', 'we', 'i', 'you', 'us', 'this', 'that', 'be', 'do', 'so', 'please', 'okay', 'um', 'uh']);

export function featurize(n) {
  const f = new Map();
  const add = (k, w = 1) => f.set(k, (f.get(k) || 0) + w);
  const toks = n.tokens.filter((t) => t !== '?' && t !== '.');
  const content = toks.filter((t) => !STOP.has(t));
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    add(`w:${t}`);
    if (i + 1 < toks.length) add(`b:${t}_${toks[i + 1]}`, 0.9);
    if (t.length >= 3) {
      const padded = `#${t}#`;
      for (let j = 0; j + 3 <= padded.length; j++) add(`c3:${padded.slice(j, j + 3)}`, 0.5);
      if (padded.length >= 5) for (let j = 0; j + 4 <= padded.length; j++) add(`c4:${padded.slice(j, j + 4)}`, 0.6);
    }
  }
  // skip-grams of content words capture "want ... pizza" even with filler words between
  for (let i = 0; i < content.length; i++) for (let j = i + 1; j < Math.min(content.length, i + 3); j++) add(`s:${content[i]}_${content[j]}`, 0.6);
  if (toks.length) { add(`first:${toks[0]}`, 0.8); add(`last:${toks[toks.length - 1]}`, 0.8); }
  add(`len:${toks.length <= 1 ? 1 : toks.length <= 3 ? 2 : toks.length <= 6 ? 3 : 4}`, 0.5);
  if (n.hasQuestionMark) add('q:1', 0.8);
  if (n.isBangla) add('lang:bn', 0.5);
  // L2 normalise so long utterances do not dominate
  let norm = 0;
  for (const v of f.values()) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (const [k, v] of f) f.set(k, v / norm);
  return f;
}
