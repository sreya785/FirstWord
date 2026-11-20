// Reply builder shared by scene handlers.
export function createReply(intent = 'unknown') {
  const r = {
    intent,
    speech: [],         // ordered: [{ who: 'pet'|'char', key, name, emoji, text }]
    petText: '',
    petMood: null,
    petAction: null,
    events: [],
    skills: [],
    extraSuggestions: [],
    recast: null,
    sceneChanged: false,
    pending: undefined, // set to null to clear, object to set
    usedCurriculum: null, // { id, targetWords, followUpQuestion }
  };
  r.pet = (text, mood, action) => {
    if (!text) return r;
    r.speech.push({ who: 'pet', text });
    r.petText = r.petText ? `${r.petText} ${text}` : text;
    if (mood) r.petMood = mood;
    if (action) r.petAction = action;
    return r;
  };
  r.char = (key, name, emoji, text, opts) => {
    if (!text) return r;
    r.speech.push({ who: 'char', key, name, emoji, text });
    if (opts && opts.key) { r.speech[r.speech.length - 1].key = opts.key; }
    return r;
  };
  r.event = (...e) => { r.events.push(...e); return r; };
  r.skill = (...s) => { for (const x of s) if (!r.skills.includes(x)) r.skills.push(x); return r; };
  r.suggest = (...s) => { r.extraSuggestions.push(...s); return r; };
  r.setPending = (p) => { r.pending = p; return r; };
  return r;
}
