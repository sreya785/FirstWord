// Local BM25 keyword retriever over curriculum JSON files.
// Built in plain JavaScript, runs in-memory with zero external services.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCORE_CONSTANTS } from '../dashboard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCENES = ['restaurant', 'shop', 'hospital', 'stage', 'home'];
const LANGUAGES = ['en', 'bn'];

/**
 * Unicode-aware tokenizer supporting English and Bangla with vowel signs (\p{M}).
 */
export function tokenize(text) {
  if (!text) return [];
  const matches = String(text).toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu);
  return matches || [];
}

/**
 * Load all curriculum JSON files into memory once at server start.
 */
function loadAllCurriculum() {
  const index = { en: {}, bn: {} };
  for (const lang of LANGUAGES) {
    for (const sc of SCENES) {
      const filePath = path.join(__dirname, lang, `${sc}.json`);
      try {
        if (fs.existsSync(filePath)) {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          index[lang][sc] = Array.isArray(content) ? content : [];
        } else {
          index[lang][sc] = [];
        }
      } catch (err) {
        console.error(`Failed to load curriculum file ${filePath}:`, err.message);
        index[lang][sc] = [];
      }
    }
  }
  return index;
}

// In-memory index built once at server start
const CURRICULUM_INDEX = loadAllCurriculum();

/**
 * Find an item by its unique ID across the in-memory index.
 */
export function getCurriculumItemById(id) {
  if (!id) return null;
  for (const lang of LANGUAGES) {
    for (const sc of SCENES) {
      const items = CURRICULUM_INDEX[lang]?.[sc] || [];
      const found = items.find((item) => item.id === id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Retrieve candidate items using HARD filters on language, scene, and level.
 * Falls back to nearest level, then scene default, then generic home if needed.
 */
export function getFilteredCandidates(lang, scene, level) {
  const l = lang === 'bn' ? 'bn' : 'en';
  const sc = SCENES.includes(scene) ? scene : 'home';
  const targetLvl = Math.max(1, Math.min(4, Number(level) || 2));

  const sceneItems = CURRICULUM_INDEX[l]?.[sc] || [];

  // Exact level match
  let candidates = sceneItems.filter((item) => item.level === targetLvl);
  if (candidates.length > 0) return candidates;

  // Fallback 1: Nearest level in the same scene
  const offsets = [1, -1, 2, -2, 3, -3];
  for (const off of offsets) {
    const candidateLvl = targetLvl + off;
    if (candidateLvl >= 1 && candidateLvl <= 4) {
      candidates = sceneItems.filter((item) => item.level === candidateLvl);
      if (candidates.length > 0) return candidates;
    }
  }

  // Fallback 2: Scene default (all items in that scene)
  if (sceneItems.length > 0) return sceneItems;

  // Fallback 3: Generic home scene items
  const homeItems = CURRICULUM_INDEX[l]?.home || [];
  candidates = homeItems.filter((item) => item.level === targetLvl);
  return candidates.length > 0 ? candidates : homeItems;
}

/**
 * Okapi BM25 ranking over a candidate document set.
 * k1 = 1.2, b = 0.75.
 */
export function rankBM25(candidates, queryTokens, { k1 = 1.2, b = 0.75 } = {}) {
  if (!candidates || candidates.length === 0) return [];
  if (!queryTokens || queryTokens.length === 0) return [...candidates];

  const N = candidates.length;

  // Pre-tokenize candidate docs
  const docTokensList = candidates.map((doc) => {
    const text = [
      ...(doc.targetWords || []),
      ...(doc.exampleSentences || []),
      ...(doc.followUpQuestions || []),
      ...(doc.weakPoints || []),
      doc.scene || '',
      `level_${doc.level}`,
    ].join(' ');
    return tokenize(text);
  });

  const docLengths = docTokensList.map((tokens) => tokens.length);
  const avgdl = docLengths.reduce((sum, len) => sum + len, 0) / N || 1;

  // Compute term frequencies per doc
  const docTermFreqs = docTokensList.map((tokens) => {
    const freq = {};
    for (const token of tokens) freq[token] = (freq[token] || 0) + 1;
    return freq;
  });

  // Compute IDF for each query term
  const idf = {};
  const querySet = new Set(queryTokens);
  for (const q of querySet) {
    let n_q = 0;
    for (let i = 0; i < N; i++) {
      if (docTermFreqs[i][q]) n_q++;
    }
    // Standard BM25 IDF with smoothing
    idf[q] = Math.log(((N - n_q + 0.5) / (n_q + 0.5)) + 1);
  }

  // Score each candidate document
  const scored = candidates.map((doc, idx) => {
    let score = 0;
    const freqs = docTermFreqs[idx];
    const dl = docLengths[idx];

    for (const q of queryTokens) {
      const f = freqs[q] || 0;
      if (f > 0) {
        const idfVal = idf[q] || 0;
        const num = f * (k1 + 1);
        const denom = f + k1 * (1 - b + b * (dl / avgdl));
        score += idfVal * (num / denom);
      }
    }
    return { doc, score, originalIndex: idx };
  });

  // Sort descending by score; break ties with original candidate order
  scored.sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex);
  return scored.map((item) => item.doc);
}

/**
 * Detect active weak points using the speaking score targets from server/dashboard.js.
 * Zero duplicate numbers.
 */
export function detectWeakPoints(session, level) {
  const lvl = Math.max(1, Math.min(4, Number(level) || 2));
  const weakPoints = [];

  // Target metrics defined in SCORE_CONSTANTS
  const targetAvg = SCORE_CONSTANTS?.targets?.avgWords?.[lvl] || 2.8;
  const targetWords = SCORE_CONSTANTS?.targets?.uniqueWords?.[lvl] || 15;

  const metrics = session?.recentMetrics || [];
  const validMetrics = metrics.filter((m) => m && m.wordCount > 0);

  // Short answers: recent average words per sentence below level target
  if (validMetrics.length > 0) {
    const avgWords = validMetrics.reduce((sum, m) => sum + m.wordCount, 0) / validMetrics.length;
    if (avgWords < targetAvg) {
      weakPoints.push('short_answers');
    }
  } else {
    // If no utterances yet or silence, short_answers is relevant
    weakPoints.push('short_answers');
  }

  // Few unique words: unique vocabulary observed below target
  const uniqueSeen = Object.keys(session?.vocab || {}).length;
  if (uniqueSeen < targetWords) {
    weakPoints.push('few_words');
  }

  // Silences: session has silences
  if ((session?.silences || 0) >= 1) {
    weakPoints.push('silences');
  }

  return weakPoints;
}

/**
 * Build retrieval query strictly from scene, level, and weak points (never child text).
 */
export function buildQuery(scene, level, weakPoints = []) {
  return `${scene} level_${level} ${weakPoints.join(' ')}`.trim();
}

/**
 * Main retrieval interface:
 * 1. Hard-filters candidates by language, scene, and level (with fallback).
 * 2. Ranks candidates inside the filtered set using BM25.
 * 3. Returns top 3 to 5 items.
 */
export function retrieve({ lang = 'en', scene = 'home', level = 2, weakPoints = [], query = null } = {}) {
  const candidates = getFilteredCandidates(lang, scene, level);
  const qStr = query || buildQuery(scene, level, weakPoints);
  const qTokens = tokenize(qStr);

  const ranked = rankBM25(candidates, qTokens);
  // Return top 3 to 5 items
  const count = Math.min(5, Math.max(3, Math.min(candidates.length, 3)));
  return ranked.slice(0, count);
}
