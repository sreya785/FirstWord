// OPTIONAL: local, free LLM via Ollama (https://ollama.com). Never required.
// Enabled only when OLLAMA_URL is set (e.g. http://localhost:11434). Used for open-ended chit-chat
// when the rule engine has no confident answer. World state is always controlled by the rule engine.
const URL = process.env.OLLAMA_URL || '';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
let available = null;

export function enabled() { return Boolean(URL); }

export async function check() {
  if (!URL) return false;
  if (available !== null) return available;
  try {
    const res = await fetch(`${URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    available = res.ok;
  } catch { available = false; }
  return available;
}

export async function petReply({ lang, petName, childName, worldSummary, history, utterance, curriculumItems = [] }) {
  if (!(await check())) return null;
  let curriculumGrounding = '';
  if (Array.isArray(curriculumItems) && curriculumItems.length > 0) {
    const top3 = curriculumItems.slice(0, 3);
    const targetWords = [...new Set(top3.flatMap((item) => item.targetWords || []))].slice(0, 6);
    const sampleQuestions = top3.flatMap((item) => item.followUpQuestions || []).slice(0, 2);
    if (targetWords.length > 0 || sampleQuestions.length > 0) {
      curriculumGrounding = ` Curriculum words: ${targetWords.join(', ')}. Suggested question: ${sampleQuestions[0] || ''}.`;
    }
  }
  const system = `You are ${petName}, a small, kind, playful pet friend for a young child named ${childName} in a speech-practice game.
Rules: Reply in ${lang === 'bn' ? 'simple Bangla' : 'very simple English'}, 1-2 short sentences (max 25 words), warm and encouraging.
Never shame mistakes. Never mention being an AI. Ask ONE gentle follow-up question that invites the child to talk more.
Stay in the pretend world: ${worldSummary}.${curriculumGrounding} Never describe anything scary or violent.`;
  const prompt = `${history.slice(-6).map((h) => `${h.who === 'child' ? childName : petName}: ${h.text}`).join('\n')}\n${childName}: ${utterance}\n${petName}:`;
  try {
    const res = await fetch(`${URL}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, system, prompt, stream: false, options: { temperature: 0.7, num_predict: 60 } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    let text = String(data.response || '').trim().split('\n')[0].replace(/^["']|["']$/g, '').trim();
    if (!text || text.length > 220) return null;
    return text;
  } catch {
    return null;
  }
}
