// Parent dashboard aggregates. Describes observed app activity only — never a diagnosis.
import { SKILLS, LEVEL_LABELS } from './brain/adapt.js';
import { sessionsForChild } from './db.js';
import { getCurriculumItemById } from './curriculum/retriever.js';

const SCENE_LABELS = {
  en: { home: 'Home', restaurant: 'Restaurant', shop: 'Shop', hospital: 'Doctor', stage: 'Stage show', emergency: 'Help my pet', create: 'Own world', park: 'Park', beach: 'Beach', space: 'Space', garden: 'Garden', school: 'School', forest: 'Forest', castle: 'Castle', farm: 'Farm', city: 'City', underwater: 'Under the sea', mountain: 'Mountain', zoo: 'Zoo', kitchen: 'Kitchen', party: 'Party', snow: 'Snow land', pirate: 'Pirate ship' },
  bn: { home: 'বাড়ি', restaurant: 'রেস্টুরেন্ট', shop: 'দোকান', hospital: 'ডাক্তার', stage: 'মঞ্চ', emergency: 'বন্ধুকে সাহায্য', create: 'নিজের জগৎ', park: 'পার্ক', beach: 'সমুদ্র', space: 'মহাকাশ', garden: 'বাগান', school: 'স্কুল', forest: 'বন', castle: 'প্রাসাদ', farm: 'খামার', city: 'শহর', underwater: 'সমুদ্রের নিচে', mountain: 'পাহাড়', zoo: 'চিড়িয়াখানা', kitchen: 'রান্নাঘর', party: 'পার্টি', snow: 'বরফের দেশ', pirate: 'জলদস্যু জাহাজ' },
};

/**
 * Score weights, thresholds, and level targets.
 * Draft targets per adaptive level (1..4) — to be tuned in a pilot.
 */
export const SCORE_CONSTANTS = {
  // Four mini-bar component weights (must sum to 1.0)
  weights: {
    wordVariety: 0.30,    // Unique words per session vs target for the child's level
    sentenceLength: 0.30, // Average words per sentence vs target
    takingPart: 0.20,     // Utterances / (utterances + silences)
    sentenceLevel: 0.20,  // Level 1..4 mapped to 0..100
  },
  // Minimum utterances for a session to qualify for scoring and baseline
  minUtterances: 5,
  // Number of qualifying sessions needed to form the initial baseline
  baselineSessionsCount: 3,
  // Number of qualifying sessions after baseline needed to evaluate early flag
  earlyFlagSessionsCount: 5,
  // Margin below baseline (15%) required across all 5 consecutive sessions to trigger early flag
  earlyFlagMargin: 0.15,
  // Draft targets per adaptive level (1..4) - to be tuned in a pilot
  targets: {
    // Target unique words per qualifying session for levels 1, 2, 3, 4
    uniqueWords: {
      1: 8,
      2: 15,
      3: 25,
      4: 40,
    },
    // Target average words per sentence for levels 1, 2, 3, 4
    avgWords: {
      1: 1.8,
      2: 2.8,
      3: 4.2,
      4: 6.0,
    },
  },
};

/**
 * Compute speaking score (0..100) and its four mini-bar components for a session.
 * Count only sessions with at least 5 utterances.
 * Each component is capped at 100.
 */
export function computeSessionScore(session, level = 2) {
  if (!session || (session.utterances || 0) < SCORE_CONSTANTS.minUtterances) {
    return null;
  }
  const lvl = Math.max(1, Math.min(4, Number(level) || 2));
  const uniqueWords = Object.keys(session.vocab || {}).length;
  const targetWords = SCORE_CONSTANTS.targets.uniqueWords[lvl] || 15;
  const wordVariety = Math.min(100, Math.round((uniqueWords / targetWords) * 100));

  const avgWords = session.utterances > 0 ? (session.words / session.utterances) : 0;
  const targetAvg = SCORE_CONSTANTS.targets.avgWords[lvl] || 2.8;
  const sentenceLength = Math.min(100, Math.round((avgWords / targetAvg) * 100));

  const totalTurns = (session.utterances || 0) + (session.silences || 0);
  const takingPart = totalTurns > 0 ? Math.min(100, Math.round((session.utterances / totalTurns) * 100)) : 0;

  const sentenceLevel = Math.min(100, Math.round((lvl / 4) * 100));

  const total = Math.min(100, Math.max(0, Math.round(
    wordVariety * SCORE_CONSTANTS.weights.wordVariety +
    sentenceLength * SCORE_CONSTANTS.weights.sentenceLength +
    takingPart * SCORE_CONSTANTS.weights.takingPart +
    sentenceLevel * SCORE_CONSTANTS.weights.sentenceLevel
  )));

  return {
    total,
    components: {
      wordVariety,
      sentenceLength,
      takingPart,
      sentenceLevel,
    },
    raw: {
      uniqueWords,
      targetWords,
      avgWords: +avgWords.toFixed(2),
      targetAvg,
      utterances: session.utterances,
      silences: session.silences || 0,
      takingPartPercent: takingPart,
      level: lvl,
    },
  };
}

/**
 * Evaluate early flag condition:
 * Only evaluate qualifying sessions AFTER the 3 baseline sessions.
 * Trigger only if the last 5 of those are all below baseline on sentence length
 * or taking part by a margin of at least 15%.
 */
export function evaluateEarlyFlag(qualifyingSessions) {
  if (!qualifyingSessions || qualifyingSessions.length < SCORE_CONSTANTS.baselineSessionsCount + SCORE_CONSTANTS.earlyFlagSessionsCount) {
    return { active: false, reasons: [], reason: null };
  }
  const baselineSessions = qualifyingSessions.slice(0, SCORE_CONSTANTS.baselineSessionsCount);
  const subsequentSessions = qualifyingSessions.slice(SCORE_CONSTANTS.baselineSessionsCount);
  if (subsequentSessions.length < SCORE_CONSTANTS.earlyFlagSessionsCount) {
    return { active: false, reasons: [], reason: null };
  }

  const baselineAvgWords = baselineSessions.reduce((acc, s) => acc + (s.utterances ? s.words / s.utterances : 0), 0) / baselineSessions.length;
  const baselineTakingPart = baselineSessions.reduce((acc, s) => {
    const t = s.utterances + (s.silences || 0);
    return acc + (t > 0 ? (s.utterances / t) * 100 : 0);
  }, 0) / baselineSessions.length;

  const thresholdLength = baselineAvgWords * (1 - SCORE_CONSTANTS.earlyFlagMargin);
  const thresholdTakingPart = baselineTakingPart * (1 - SCORE_CONSTANTS.earlyFlagMargin);

  const last5 = subsequentSessions.slice(-SCORE_CONSTANTS.earlyFlagSessionsCount);
  const allLengthBelow = last5.every((s) => (s.utterances ? s.words / s.utterances : 0) < thresholdLength);
  const allTakingPartBelow = last5.every((s) => {
    const t = s.utterances + (s.silences || 0);
    return (t > 0 ? (s.utterances / t) * 100 : 0) < thresholdTakingPart;
  });

  if (!allLengthBelow && !allTakingPartBelow) {
    return { active: false, reasons: [], reason: null };
  }

  const last5AvgWords = last5.reduce((acc, s) => acc + (s.utterances ? s.words / s.utterances : 0), 0) / last5.length;
  const last5TakingPart = last5.reduce((acc, s) => {
    const t = s.utterances + (s.silences || 0);
    return acc + (t > 0 ? (s.utterances / t) * 100 : 0);
  }, 0) / last5.length;

  const reasons = [];
  if (allLengthBelow) {
    reasons.push({
      metric: 'sentenceLength',
      label: 'Sentence length',
      baseline: +baselineAvgWords.toFixed(2),
      recent: +last5AvgWords.toFixed(2),
      dropPercent: Math.round(((baselineAvgWords - last5AvgWords) / baselineAvgWords) * 100),
    });
  }
  if (allTakingPartBelow) {
    reasons.push({
      metric: 'takingPart',
      label: 'Taking part',
      baseline: +baselineTakingPart.toFixed(1),
      recent: +last5TakingPart.toFixed(1),
      dropPercent: Math.round(((baselineTakingPart - last5TakingPart) / baselineTakingPart) * 100),
    });
  }

  return {
    active: true,
    reason: allLengthBelow && allTakingPartBelow ? 'both' : (allLengthBelow ? 'sentence_length' : 'taking_part'),
    reasons,
    marginPercent: Math.round(SCORE_CONSTANTS.earlyFlagMargin * 100),
    sessionCount: SCORE_CONSTANTS.earlyFlagSessionsCount,
    baseline: {
      avgWords: +baselineAvgWords.toFixed(2),
      takingPart: +baselineTakingPart.toFixed(1),
    },
    recent: {
      avgWords: +last5AvgWords.toFixed(2),
      takingPart: +last5TakingPart.toFixed(1),
    },
    thresholds: {
      avgWords: +thresholdLength.toFixed(2),
      takingPart: +thresholdTakingPart.toFixed(1),
    },
    note: 'The last 5 qualifying sessions were consistently below earlier baseline. Consider consulting a qualified speech-language therapist for observations and guidance.',
  };
}

export function buildDashboard(child, { pinVerified = false, range = 'all' } = {}) {
  const lang = child.lang || 'en';
  const hasPin = Boolean(child.pinHash);
  const isPinUnlocked = hasPin && pinVerified;
  const allSessions = sessionsForChild(child.id).sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  // Note: for old sessions without a stored score, scores are computed dynamically at read time
  // without mutating the underlying stored session record in db.

  // Filter sessions by selected range ('today', 'week', 'all')
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 86400000);

  let filteredSessions = allSessions;
  if (range === 'today') {
    filteredSessions = allSessions.filter((s) => new Date(s.startedAt) >= startOfToday);
  } else if (range === 'week') {
    filteredSessions = allSessions.filter((s) => new Date(s.startedAt) >= startOfWeek);
  }

  const totals = { sessions: filteredSessions.length, utterances: 0, words: 0, silences: 0, questions: 0, minutes: 0 };
  const skills = {};
  const scenes = {};
  const vocab = {};
  const timeline = [];

  for (const s of filteredSessions) {
    totals.utterances += s.utterances;
    totals.words += s.words;
    totals.silences += s.silences;
    totals.questions += s.questions;
    const end = s.endedAt ? new Date(s.endedAt) : (s.turns?.length ? new Date(s.turns[s.turns.length - 1].t) : new Date(s.startedAt));
    totals.minutes += Math.max(0, (end - new Date(s.startedAt)) / 60000);
    for (const [k, v] of Object.entries(s.skills || {})) skills[k] = (skills[k] || 0) + v;
    for (const sc of s.scenes || []) scenes[sc] = (scenes[sc] || 0) + 1;
    for (const [w, c] of Object.entries(s.vocab || {})) vocab[w] = (vocab[w] || 0) + c;
    timeline.push({
      id: s.id,
      date: s.startedAt,
      utterances: s.utterances,
      avgWords: s.utterances ? +(s.words / s.utterances).toFixed(2) : 0,
      maxWords: s.maxWords || 0,
      silences: s.silences,
      questions: s.questions,
      scenes: s.scenes,
      level: s.level || null,
      score: s.score || computeSessionScore(s, s.level || child.level || 2),
      minutes: +Math.max(0, (end - new Date(s.startedAt)) / 60000).toFixed(1),
    });
  }

  // All-time vocabulary (for total words count)
  const allVocab = {};
  for (const s of allSessions) {
    for (const [w, c] of Object.entries(s.vocab || {})) allVocab[w] = (allVocab[w] || 0) + c;
  }
  const topWords = Object.entries(vocab).sort((a, b) => b[1] - a[1]).slice(0, 35).map(([word, count]) => ({ word, count }));

  // New words this week: used in last 7 days but not prior
  const priorWordsSet = new Set();
  const weekWordsSet = new Set();
  for (const s of allSessions) {
    const isWeek = new Date(s.startedAt) >= startOfWeek;
    for (const w of Object.keys(s.vocab || {})) {
      if (isWeek) weekWordsSet.add(w);
      else priorWordsSet.add(w);
    }
  }
  const newWordsThisWeek = [...weekWordsSet].filter((w) => !priorWordsSet.has(w)).slice(0, 25);

  const skillList = Object.entries(SKILLS).map(([key, meta]) => ({ key, label: lang === 'bn' ? meta.bn : meta.label, count: skills[key] || 0 })).sort((a, b) => b.count - a.count);
  const sceneList = Object.entries(scenes).map(([key, count]) => ({ key, label: (SCENE_LABELS[lang] || SCENE_LABELS.en)[key] || key, count })).sort((a, b) => b.count - a.count);
  const avgWords = totals.utterances ? +(totals.words / totals.utterances).toFixed(2) : 0;
  const participation = totals.utterances + totals.silences ? Math.round((totals.utterances / (totals.utterances + totals.silences)) * 100) : null;

  // Trend
  let trend = null;
  const withData = timeline.filter((t) => t.utterances >= SCORE_CONSTANTS.minUtterances);
  if (withData.length >= 4) {
    const half = Math.floor(withData.length / 2);
    const a = withData.slice(0, half).reduce((x, y) => x + y.avgWords, 0) / half;
    const b = withData.slice(half).reduce((x, y) => x + y.avgWords, 0) / (withData.length - half);
    trend = { earlier: +a.toFixed(2), recent: +b.toFixed(2), change: +(b - a).toFixed(2) };
  }

  const level = child.level || 2;
  const disclaimer = lang === 'bn'
    ? 'এই তথ্যগুলো শুধু অ্যাপে কী কী কথা বলা হয়েছে তা দেখায়। এটি কোনো চিকিৎসা মূল্যায়ন বা রোগনির্ণয় নয়। স্পিচ রিকগনিশন ভুল করতে পারে, তাই কম কথা বা ভুল শব্দ কোনো সমস্যার প্রমাণ নয়। উদ্বেগ থাকলে একজন পেশাদার স্পিচ-ল্যাঙ্গুয়েজ থেরাপিস্টের সাথে কথা বলুন।'
    : 'These numbers describe what happened inside the app. They are not a medical assessment or diagnosis. Speech recognition makes mistakes, so low counts or odd words are never proof of a speech difficulty. If you have concerns, please talk to a qualified speech-language therapist.';

  // Practice words from the last 7 days (deduplicated, most-used first)
  const practiceMap = new Map();
  for (const s of allSessions) {
    if (new Date(s.startedAt) >= startOfWeek) {
      for (const tr of s.turns || []) {
        if (tr.curriculum && tr.curriculum.targetWords?.length) {
          const item = getCurriculumItemById(tr.curriculum.id);
          const words = [...new Set(tr.curriculum.targetWords)];
          const key = words.slice().sort().join(', ');
          const cur = practiceMap.get(key) || {
            words,
            count: 0,
            example: item?.exampleSentences?.[0] || null,
            question: tr.curriculum.followUpQuestion || item?.followUpQuestions?.[0] || null,
          };
          cur.count++;
          if (!cur.question && tr.curriculum.followUpQuestion) cur.question = tr.curriculum.followUpQuestion;
          practiceMap.set(key, cur);
        }
      }
    }
  }
  const practiceWords = [...practiceMap.values()].sort((a, b) => b.count - a.count);

  // Base payload available without PIN verification
  const baseResult = {
    child: { id: child.id, name: child.name, lang, petType: child.petType, petName: child.petName, hasPin, settings: child.settings },
    requiresPin: !isPinUnlocked,
    hasPin,
    disclaimer,
    range,
    totals: { ...totals, minutes: +totals.minutes.toFixed(1), avgWords, participation },
    level: { value: level, label: LEVEL_LABELS[level]?.[lang] || LEVEL_LABELS[level]?.en },
    skills: skillList,
    scenes: sceneList,
    totalUniqueWords: Object.keys(allVocab).length,
    suggestions: suggestionsFor({ lang, skillList, sceneList, avgWords, totals, level }),
    practiceWords,
    speakingScore: null,
    todayCard: null,
    earlyFlag: null,
  };

  // Rule 4: If the child has no parent PIN or request is unverified, DO NOT send score, today details, or early flag!
  if (!isPinUnlocked) {
    return baseResult;
  }

  // --- PIN VERIFIED: Compute Speaking Score, Baseline, Today Details, and Early Flag ---

  // Qualifying sessions (utterances >= 5) across chronological history
  const qualifyingSessions = allSessions.filter((s) => s.utterances >= SCORE_CONSTANTS.minUtterances);
  const baselineSessions = qualifyingSessions.slice(0, SCORE_CONSTANTS.baselineSessionsCount);
  const baselineReady = baselineSessions.length >= SCORE_CONSTANTS.baselineSessionsCount;

  let baseline = null;
  let speakingScore = null;

  if (baselineReady) {
    const baselineAvgWords = baselineSessions.reduce((acc, s) => acc + (s.words / s.utterances), 0) / baselineSessions.length;
    const baselineTakingPart = baselineSessions.reduce((acc, s) => {
      const t = s.utterances + (s.silences || 0);
      return acc + (t > 0 ? (s.utterances / t) * 100 : 0);
    }, 0) / baselineSessions.length;
    const baselineScores = baselineSessions.map((s) => s.score || computeSessionScore(s, s.level || level));
    const baselineTotal = Math.round(baselineScores.reduce((acc, sc) => acc + (sc ? sc.total : 0), 0) / baselineScores.length);

    baseline = {
      ready: true,
      total: baselineTotal,
      avgWords: +baselineAvgWords.toFixed(2),
      takingPart: +baselineTakingPart.toFixed(1),
      sessionsCount: baselineSessions.length,
    };

    // Current score: evaluate the latest qualifying session (or the average of qualifying sessions in range)
    const inRangeQualifying = filteredSessions.filter((s) => s.utterances >= SCORE_CONSTANTS.minUtterances);
    const activeSession = inRangeQualifying.length ? inRangeQualifying[inRangeQualifying.length - 1] : qualifyingSessions[qualifyingSessions.length - 1];
    const curScore = activeSession.score || computeSessionScore(activeSession, activeSession.level || level);

    if (curScore) {
      const diff = curScore.total - baselineTotal;
      const label = curScore.total >= 75 ? (lang === 'bn' ? 'দৃঢ়' : 'Strong')
        : curScore.total >= 50 ? (lang === 'bn' ? 'অগ্রগতি হচ্ছে' : 'Growing')
        : (lang === 'bn' ? 'শুরু হচ্ছে' : 'Getting started');

      speakingScore = {
        number: curScore.total,
        label,
        changeVsBaseline: diff > 0 ? `+${diff}` : String(diff),
        diffNumber: diff,
        components: curScore.components,
        raw: curScore.raw,
        disclaimer: lang === 'bn'
          ? 'শব্দভাণ্ডার, বাক্যের দৈর্ঘ্য এবং অংশগ্রহণের পরিমাণের উপর ভিত্তি করে হিসাব করা হয়েছে (কোনো উচ্চারণ বিশ্লেষণ নয়)।'
          : 'Based on words, sentence length and taking part (no pronunciation analysis).',
      };
    }
  } else {
    baseline = {
      ready: false,
      sessionsCompleted: baselineSessions.length,
      sessionsNeeded: SCORE_CONSTANTS.baselineSessionsCount,
      message: lang === 'bn'
        ? `ভিত্তিরেখা তৈরি হচ্ছে (${baselineSessions.length}/${SCORE_CONSTANTS.baselineSessionsCount}টি সেশন সম্পন্ন)`
        : `Building your baseline (${baselineSessions.length} of ${SCORE_CONSTANTS.baselineSessionsCount} sessions)`,
    };
  }

  // --- Today Card Details ---
  const todaySessions = allSessions.filter((s) => new Date(s.startedAt) >= startOfToday);
  const yesterdaySessions = allSessions.filter((s) => new Date(s.startedAt) >= startOfYesterday && new Date(s.startedAt) < startOfToday);
  const priorSessions = allSessions.filter((s) => new Date(s.startedAt) < startOfToday);

  const priorWords = new Set();
  for (const s of priorSessions) {
    for (const w of Object.keys(s.vocab || {})) priorWords.add(w);
  }
  const todayWords = new Set();
  for (const s of todaySessions) {
    for (const w of Object.keys(s.vocab || {})) todayWords.add(w);
  }
  const newWordsToday = [...todayWords].filter((w) => !priorWords.has(w));

  const todayUtterances = todaySessions.reduce((acc, s) => acc + s.utterances, 0);
  const todayWordsCount = todaySessions.reduce((acc, s) => acc + s.words, 0);
  const todayAvgWords = todayUtterances > 0 ? +(todayWordsCount / todayUtterances).toFixed(2) : 0;
  const todayMinutes = todaySessions.reduce((acc, s) => {
    const end = s.endedAt ? new Date(s.endedAt) : (s.turns?.length ? new Date(s.turns[s.turns.length - 1].t) : new Date(s.startedAt));
    return acc + Math.max(0, (end - new Date(s.startedAt)) / 60000);
  }, 0);

  const yesterdayUtterances = yesterdaySessions.reduce((acc, s) => acc + s.utterances, 0);
  const yesterdayWordsCount = yesterdaySessions.reduce((acc, s) => acc + s.words, 0);
  const yesterdayAvgWords = yesterdayUtterances > 0 ? +(yesterdayWordsCount / yesterdayUtterances).toFixed(2) : null;
  const avgChangeVsYesterday = yesterdayAvgWords !== null ? +(todayAvgWords - yesterdayAvgWords).toFixed(2) : null;

  // Longest sentence today
  let longestToday = { wordCount: 0, text: null };
  const storeTranscripts = child.settings?.storeTranscripts !== false;
  for (const s of todaySessions) {
    for (const tr of s.turns || []) {
      if (tr.source !== 'silence' && (tr.words || 0) > longestToday.wordCount) {
        longestToday = {
          wordCount: tr.words || 0,
          text: storeTranscripts ? (tr.child || null) : null,
        };
      }
    }
  }

  const todaySituations = [...new Set(todaySessions.flatMap((s) => s.scenes || []))].map((sc) => ({
    key: sc,
    label: (SCENE_LABELS[lang] || SCENE_LABELS.en)[sc] || sc,
  }));

  const todayCard = {
    hasData: todaySessions.length > 0,
    sentencesCount: todayUtterances,
    minutesPlayed: +todayMinutes.toFixed(1),
    newWords: newWordsToday,
    avgWords: todayAvgWords,
    avgChangeVsYesterday,
    longestSentence: longestToday,
    situations: todaySituations,
  };

  // --- Early Flag ---
  const earlyFlag = evaluateEarlyFlag(qualifyingSessions);

  return {
    ...baseResult,
    baseline,
    speakingScore,
    todayCard,
    earlyFlag,
    newWordsThisWeek,
    topWords,
    timeline,
    trend,
    recentTurns: allSessions.slice(-1).flatMap((s) => s.turns?.slice(-12) || []),
  };
}

function suggestionsFor({ lang, skillList, sceneList, avgWords, totals, level }) {
  const bn = lang === 'bn';
  const out = [];
  const count = (k) => skillList.find((s) => s.key === k)?.count || 0;
  const visited = new Set(sceneList.map((s) => s.key));
  if (totals.utterances < 5) {
    out.push(bn ? 'শুরুর দিকে পাশে বসে একসাথে খেলুন। আপনি একটা কথা বলুন, তারপর শিশুর পালা।' : 'Sit together for the first few sessions. You say one thing to the pet, then it is your child\'s turn.');
  }
  if (count('asking_questions') < Math.max(3, count('requesting') / 3)) {
    out.push(bn ? 'প্রশ্ন করার অভ্যাস বাড়াতে দোকানে গিয়ে "দাম কত?" বা পোষা বন্ধুকে "তুমি কী চাও?" জিজ্ঞেস করতে উৎসাহ দিন। বাসায় খাবারের সময় "তুমি কোনটা চাও?" ধরনের বিকল্প দিন।' : 'Asking questions appears less often than asking for things. Try the shop ("How much is it?") or ask the pet "What do you want?". At home, offer choices at mealtimes so your child can ask and answer.');
  }
  if (count('changing_mind') === 0 && totals.utterances > 8) {
    out.push(bn ? 'রেস্টুরেন্টে অর্ডার দিয়ে তারপর "না, আমি নুডলস চাই" বলে মত বদলানোর খেলা খেলুন — ভদ্রভাবে না বলা শেখার সুন্দর উপায়।' : 'Play the restaurant and model changing your mind ("Actually, I want noodles instead"). It is a safe way to practise saying no politely.');
  }
  if (!visited.has('stage') && totals.utterances > 10) {
    out.push(bn ? 'মঞ্চ অ্যাক্টিভিটি এখনো চেষ্টা করা হয়নি। লম্বা বাক্য আর গল্প বলার জন্য এটা ভালো জায়গা — আপনি দর্শক হয়ে হাততালি দিন!' : 'The stage show has not been tried yet. It is great for longer sentences — you can be the audience and clap!');
  }
  if (!visited.has('emergency') && totals.utterances > 10) {
    out.push(bn ? '"বন্ধুকে সাহায্য" অ্যাক্টিভিটিতে শিশু নির্দেশ দেওয়া আর সান্ত্বনা দেওয়া অনুশীলন করে। বাসায় পুতুল বা খেলনা দিয়ে একই খেলা খেলতে পারেন।' : 'In "Help my pet" children practise giving instructions and reassuring someone. You can replay it at home with a soft toy that "needs help".');
  }
  if (avgWords > 0 && avgWords < 2.2) {
    out.push(bn ? 'শিশু বেশিরভাগ এক-দুই শব্দে কথা বলছে। শিশুর কথা একটু বড় করে ফিরিয়ে বলুন (শিশু: "কেক" → আপনি: "তুমি চকলেট কেক চাও!"), পুনরাবৃত্তি করতে বলবেন না।' : 'Most turns are one or two words right now. A gentle habit: repeat back a slightly longer version (child: "cake" → you: "You want a chocolate cake!") without asking them to repeat it.');
  } else if (avgWords >= 5) {
    out.push(bn ? 'শিশু পূর্ণ বাক্যে কথা বলছে। "কেন?" আর "তারপর কী হলো?" প্রশ্ন করে গল্প বলা আরও বাড়াতে পারেন।' : 'Your child is using full sentences. Ask "why?" and "what happened next?" to stretch storytelling further.');
  }
  if (count('expressing_feelings') === 0 && totals.utterances > 12) {
    out.push(bn ? 'অনুভূতির কথা বলার সুযোগ দিন: "আজ তুমি কেমন অনুভব করছ?" — পোষা বন্ধুকে বলতে বলুন।' : 'Invite feeling-talk: ask your child to tell the pet how they feel today, and share how you feel too.');
  }
  if (totals.silences > totals.utterances * 0.5 && totals.utterances > 5) {
    out.push(bn ? 'নীরবতা বেশ আছে — এটা স্বাভাবিক। চাপ না দিয়ে বোতাম দিয়ে শুরু করতে দিন; আত্মবিশ্বাস বাড়লে কথা বাড়ে।' : 'There are quite a few quiet moments — that is okay. Let your child start with the buttons; talking grows with confidence, not pressure.');
  }
  if (!out.length) out.push(bn ? 'দারুণ চলছে! নতুন জায়গা তৈরি করতে বলুন — "পশুদের জন্য একটা স্কুল বানাও"।' : 'Things are going well! Invite a brand-new world: "Make a school for animals."');
  return out.slice(0, 5);
}
