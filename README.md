# FirstWord AI 🐾

**A voice-powered pet friend for children's speech development.**
The child speaks → the pet listens → the world responds. No fixed answers, no scores, no pressure.

Built as a **real-time 3D game in the browser** (WebGL / three.js) on top of a small Node.js backend — all on **free, local technology**: no paid APIs, no cloud AI keys, no audio ever stored.

---

## ✨ What it does

| Feature | How |
|---|---|
| **Voice-first play** | Browser Web Speech API (free, built in) for listening *and* the pet's warm storytelling voice. Real speech is required: children ask guests for orders by voice, tell the chef by voice, say sorry by voice, quote shop prices by voice before scanning, and talk to doctors / perform on stage. Taps guide the child verbally instead of auto-sending text. Clickable phrase chips and typing boxes are removed from normal play; typing is strictly an accessible fallback shown only when the microphone is denied or unsupported |
| **Spoken hints from pet** | Tapping the 💡 Hint button has the pet friend speak a gentle verbal hint aloud (e.g. *"You can say: I want pizza"* or *"তুমি বলতে পারো: ..."*) rather than cluttering the screen with clickable shortcut buttons |
| **Forgiving progression** | Children are never blocked: for steps asking the child to speak, any spoken attempt of 1+ words moves the game forward. Content is checked only where needed (shop: price number; chef: dish name) using fuzzy matching and spell-fix. After 2 misses, the pet repeats the hint, then accepts the next attempt |
| **Warm AI voice** | Calibrated natural, warm storytelling female AI voice for an engaging, gentle storybook companion feel in English and Bangla |
| **3-bar Places menu** | Explore places via the clean 3-bar menu drawer or via voice commands (*"Take me to restaurant"*, *"Go to shop"*, *"Doctor"*, *"Stage"*, *"Zoom in"*) |
| **A friend, not a teacher** | Rule-based "pet brain" that answers naturally, never corrects, gently *recasts* short utterances into fuller sentences |
| **The world responds** | "Make a red house", "I want an elephant", "Make the sky purple", "Let it rain", "You are the doctor" – objects, characters, colours, weather and roles change live |
| **Real-life situations** | 🆘 Help my pet · 🍽️ Restaurant · 🛍️ Shop · 🩺 Doctor · 🎭 Stage show · 🌈 Create your own world (plus park, beach, space, farm, zoo, castle, under the sea…) |
| **Adaptive level** | The pet measures utterance length over the last turns and matches its own sentence length (1 = single words → 3 = full sentences) |
| **Silence is safe** | After a pause the pet talks to itself or offers an easy phrase — at most twice — and then simply waits. The pet is never hurt, punished or abandoned |
| **Bangla + English** | Full lexicon, intents and pet lines in both (`bn-BD` speech recognition / synthesis where the browser offers it) |
| **Parent view** | PIN-protected, parent-only report: parent speaking score (0..100) with 4 mini-bar components, baseline tracking, "Today" overview, SVG weekly sentence length chart with shaded level bands, vocabulary chips, situations played, early flag alerts, and print-to-PDF. The child never sees the score. Non-medical and honest |
| **Privacy** | Text transcripts can be switched off (then only word counts are kept). Audio is never stored. Export or delete all data at any time |
| **Own the counter** | The shop is seen from the shopkeeper's side: you stand *inside* the shop behind your counter (no roof or awning in the way), the pet on its crate at your side, and you can turn a full 360° to see the shelves behind you and the door in front. Customers walk in one by one and wait in a little line; the one at the counter holds up an item and asks how much it costs. You tell the price (they may bargain), then **scan the item with the scanner in your hand** — beep! — and the customer **hands you the money**: hold out your hand, take the notes, give the change, and they take their item away. Then the next customer steps up. There is no card reader — it is all cash. **Zoom in and out freely** with the on-screen ➖ / ➕ buttons, a mouse wheel or a two-finger pinch, and drag anywhere to turn a full 360° |
| **A real 3D game** | WebGL world rendered with three.js (vendored, no CDN): 23 hand-built low-poly sets (home, park, restaurant, shop, clinic, stage with audience & spotlights, beach, space, underwater, castle, farm, snow…), a chibi 3D pet with procedural animation (breathing, blinking, lip-sync while it talks, walking, 15 actions, 12 moods, 13 outfits, sleeping/sick states), 150+ procedural 3D objects, 30 animals and 34 people the child can summon by voice, real-time shadows, day/sunset/night skies, rain, snow, confetti, hearts, sparkles. The child **walks the pet around** (WASD / arrows, touch joystick, or tap the ground), drags to look around, pinches/scrolls to zoom; the camera frames new characters automatically |
| **Restaurant & shop jobs** | The restaurant is a tap-driven job: the chef (Chef Rafi) works **inside the house kitchen** behind the side pass window, guests **sit on chairs at the tables**, and your child and the pet are the servers. Nothing is said until you tap: tap a table → the camera zooms to the seated guest, who then gives their order → tap the chef's window → walk up and tell the chef → the chef cooks → collect at the window → serve the right guest (a wrong dish gets a gentle complaint and a second try) → tap the next table. In the shop the child and pet **are the shopkeepers**, seen from **behind the counter** (the camera stands inside the shop at the counter, and turns all the way round): customers walk in through the door one by one and form a line, the first holds up an item and asks its price, the child quotes a price (bargaining is welcome), then **scans the item with the hand scanner** and the customer **hands over cash** (no cards: the money goes straight into the child's hand) before taking it away and the next one steps up |
| **Missions & stickers** | Every situation has a gentle mission card (e.g. *Restaurant: choose a seat · order · ask something · say thank you*). Stickers celebrate *doing* things (first words, long sentence, friend maker, brave patient…). Nothing can ever be lost, nothing is a score |
| **Trained intent model** | A small softmax-regression text classifier (34 intents, EN + BN, char/word n-grams) is **trained locally** (`npm run train`, ~1 s, 93 % held-out accuracy) and acts as a safety net for paraphrases the rules miss ("wanna see a doctor person" → doctor). It also powers a conservative spell-fixer ("resturant", "docter", "piza") that shows *"I think you meant…"* to the child instead of correcting them |
| **Parents can teach the pet** | The dashboard lists sentences the pet was unsure about; pick the right meaning → the model retrains in a second, on your machine. Still no cloud AI |
| **Local Curriculum Retrieval** | In-memory BM25 keyword retriever over a structured speech curriculum (restaurant, shop, hospital, stage, home; levels 1–4; EN/BN; 120 draft items). Queries combine scene + level + measured weak points (never child text). Used strictly for silence hints, fallback replies, and at most one gentle follow-up question for short answers at level 1–2. Feeds 7-day practice words into the parent report |
| **Optional local LLM** | If you run [Ollama](https://ollama.com) locally, set `OLLAMA_URL` and the pet uses it *only* for open-ended chit-chat, under the same safety rules, grounded by the top 3 retrieved curriculum items. Everything works without it |
| **Qwen Multi-Role AI** | Dynamic roleplaying using Alibaba Qwen ("quwan") OpenAI-compatible API with situation-specific API keys (`QWEN_KEY_SHOP_CUSTOMER`, `QWEN_KEY_RESTAURANT_CUSTOMER`, `QWEN_KEY_RESTAURANT_CHEF`, `QWEN_KEY_HOSPITAL_DOCTOR`, `QWEN_KEY_STAGE_AUDIENCE`, `QWEN_KEY_PET`). Strict child-safety condition prompts (1 spoken line under 12 words, strictly on-topic, bilingual Bangla & English) with zero-crash rule-engine fallback when keys are unset |

## 🚀 Run it

```bash
npm install
npm start           # http://localhost:3000
npm run mcp         # runs the read-only Model Context Protocol (MCP) server over stdio
```

Requirements: **Node.js 18+** (tested on Node 20). No database server, no build step — data lives in `data/db.json`.

Open the site in **Chrome, Edge or Safari** (they ship speech recognition). Firefox can play with tap/type and still hears the pet speak.

> **Microphone tip:** speech recognition needs a real browser tab with microphone permission.
> If you are viewing a sandboxed preview/iframe and the mic is blocked, open the URL in a new tab.
> Chrome's recogniser sends audio to Google's free speech service while you talk (nothing is stored by this app).

Dev mode with auto-restart: `npm run dev`. Brain regression test (scenes, Bangla, trained model, spelling): `npm test`.

### Playing

1. **Title** → ▶ Play → pick a saved player or create one (name, age, language, pet — tap a pet in the world to choose it, optional parent PIN).
2. **Play**: the pet greets the child with a warm female storytelling voice. **Speak with your real voice** (big mic button, or the space bar). Spoken live words appear in the dialogue chip as you talk. Say things like
   *"make a dragon"*, *"a big red car"*, *"make it rain"*, *"make the sky purple"*, *"go to the beach"*, *"I want pizza"*, *"you are the doctor"*, *"my tummy hurts"*, *"I want to sing"*.
   If you ever need an idea, tap **💡 Hint** and your pet speaks a hint out loud.
   *(Note: typing is strictly an accessible fallback shown only when the microphone is denied or unsupported).*
3. **Move**: WASD / arrow keys, the on-screen joystick (touch), or tap the ground. Drag to orbit the camera, wheel/pinch to zoom. Tap a character to walk up and wave; tap the pet for hearts.
4. **Scenes**: tap the ☰ 3-bar places button (or say *"Take me to restaurant"*, *"Go to shop"*, *"Doctor"*, *"Stage"*, *"Take me home"*) to explore places.
5. **Jobs & Voice Progression**:
   - **Restaurant**: tap a table to walk over; the pet guides you to ask the customer's order by voice. Walk to the chef window and tell Chef Rafi the order by voice. If a wrong dish is delivered, say sorry by voice!
   - **Shop**: stand behind the counter as the shopkeeper with a desk monitor and laptop cash box!
     - *Customer Face & Mouth*: the customer faces the child directly across the counter, talking with animated mouth sync.
     - *Step 1 (Price)*: tell the customer the price by voice (or pet hints).
     - *Step 2 (Scan)*: tap the item or scanner, or say *"Scan it"* (barcode scanner beeps + sparkles).
     - *Step 3 (Cash on Counter)*: customer visibly places banknotes on the counter.
     - *Step 4 (Take Money)*: tap the money on the counter to pick it up into your hand (separate from scanning).
     - *Step 5 (Cash Box)*: tap the laptop cash box on the desk to deposit the cash with a register chime.
     - *Step 6 (Change & Receipt)*: if change is needed, tap the cash drawer to hand change back; if exact payment was made, the customer politely refuses unnecessary change (*"No change needed, that was exact! Thank you!"*). Receipt prints and the next customer in line steps forward!
   - **Hospital & Stage**: arrive and speak by voice to tell the doctor what is wrong, or step on stage and speak to perform.
   - **Forgiving progression**: children are never blocked. Any spoken attempt of 1+ words progresses the story; after 2 misses on content (dish name or price number), the pet repeats the hint and accepts the next attempt.
   - **Profile Selection & Preview**:
     - Displays a single rich **Preview Profile** (`sreya`) with full historical sessions, vocabulary growth, and speaking score data for both Player and Parent views to explore.
     - Prominent **+ New Player / Child** button in both Player and Parent modes: creating a profile with your name stores it forever in the local database, while hiding bulk automated test records.
6. **⏸ Pause**: auto-listen, sound, ambience, language (EN/বাং), parent dashboard, switch player, finish & save. **⭐** opens the sticker book, **🎯** the mission card.

Deep links: `#/play/:childId` (shows a tap-to-start gate so audio can play) and `#/parent/:childId`.

**Performance:** runs on integrated graphics and phones (device-pixel-ratio capped, 1024 px shadows on mobile, instanced confetti, one draw loop). If a browser lacks WebGL the page explains why instead of a blank screen.

### Train the intent model

```bash
npm run train     # regenerates server/brain/ml/model.json from the bilingual templates (+ anything parents taught)
```

The data set is generated from templates in `server/brain/ml/dataset.js` (34 intents × EN/BN × slot fillers from the lexicon, with
prefix/suffix/typo augmentation → ~4 300 examples). Training is plain JavaScript (no Python, no GPU): hashed word uni/bi-grams,
character 3/4-grams and skip-grams → multinomial logistic regression with SGD, 30 epochs, ~1 second. The report prints held-out
accuracy, per-intent accuracy and the most confused pairs. A trained model ships in the repo; retraining is optional.

Parent-taught examples live in `data/training/custom.jsonl` (weight ×3) and are included automatically on every retrain
(dashboard → **Teach the pet** → *Teach* / *Retrain model*, or `POST /api/children/:id/teach`).

The game plays fully offline from your own server: the only network use is the browser's built-in speech service (Chrome/Edge)
when a child talks. Fonts (Fredoka + Baloo Da 2, SIL Open Font License) are served locally from `public/fonts/`.

---

## 🤖 Qwen ("quwan") AI Multi-Role API Configuration

FirstWord AI supports condition-based dynamic dialogue powered by the Alibaba Qwen API (DashScope OpenAI-compatible endpoint). Different roles in different situations can have their own independent API keys, condition-based system prompt guardrails, and role boundaries:

| Environment Variable | Role / Situation | Persona & Condition Prompt Guardrails |
|---|---|---|
| `QWEN_KEY_SHOP_CUSTOMER` | **Shop Customer** | Cheerful customer asking prices, buying items, paying cash, and thanking the cashier child. |
| `QWEN_KEY_RESTAURANT_CUSTOMER` | **Restaurant Guest / Diner** | Hungry dining guest ordering delicious dishes and complimenting the food. |
| `QWEN_KEY_RESTAURANT_CHEF` | **Chef Rafi (Kitchen)** | Energetic master chef talking about cooking recipes, kitchen prep, and encouraging the child helper. |
| `QWEN_KEY_HOSPITAL_DOCTOR` | **Doctor Mitu (Clinic)** | Gentle, compassionate doctor caring for sick pet patients, listening to symptoms, and praising the child. |
| `QWEN_KEY_STAGE_AUDIENCE` | **Stage Audience** | Enthusiastic kids talent-show audience cheering, clapping, and reacting to stories/songs/dances. |
| `QWEN_KEY_PET` | **Pet Companion (Fallback)** | Loving, warm pet friend (Momo the cat) providing gentle conversation recasts and encouragement. |
| `QWEN_API_KEY` or `DASHSCOPE_API_KEY` | **Master Fallback Key** | Used if any role-specific key above is not explicitly set. |
| `QWEN_MODEL` | *Default:* `qwen-turbo` | Model name (e.g. `qwen-turbo`, `qwen-plus`, `qwen-max`). |
| `QWEN_BASE_URL` | *Default:* `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | OpenAI-compatible endpoint URL. |

### Strict Condition Guardrails:
1. **Strictly In-Character & On-Topic:** Customers only act like customers, Chef Rafi only acts like a chef, Doctor Mitu only acts like a doctor, Audience only cheers/reacts. No outer talk, no preambles.
2. **Child-Friendly Length:** Exactly 1 short spoken sentence (10–12 words max), simple vocabulary suited for 3–6 year old children.
3. **Bilingual:** Replies natively in English or Bangla depending on the session language.
4. **Zero-Crash Fallback:** If any API key is omitted, timed out (3.5s), or offline, the system non-blockingly falls back to the deterministic local rule engine without breaking gameplay.

### Example `.env` file or export:
```bash
# Set individual keys for each role:
export QWEN_KEY_SHOP_CUSTOMER="sk-xxx-shop"
export QWEN_KEY_RESTAURANT_CUSTOMER="sk-xxx-customer"
export QWEN_KEY_RESTAURANT_CHEF="sk-xxx-chef"
export QWEN_KEY_HOSPITAL_DOCTOR="sk-xxx-doctor"
export QWEN_KEY_STAGE_AUDIENCE="sk-xxx-audience"
export QWEN_KEY_PET="sk-xxx-pet"

# Or set a single master key for all roles:
export QWEN_API_KEY="sk-xxx-master"
```

---

## 🧠 How the pet brain works (no paid AI)

```
server/brain/
├── normalize.js   tokenise, lowercase, Bangla phrase → intent-word normalisation, suffix-tolerant matching
├── lexicon.js     bilingual dictionary: locations, foods, shop items, objects, characters, roles, colours, feelings, symptoms…
├── intents.js     intent detectors (go_to, build/remove, colour, weather/time, role-assign, talk-to, feelings, questions…)
├── scenes/        situation scripts: restaurant, shop, hospital, stage, emergency, create, home (each handles its own flow)
├── roleplay.js    child/pet role swaps ("you are the shopkeeper, I am the customer")
├── adapt.js       utterance metrics, level estimation, level-aware suggestion chips, gentle recasts
├── pet.js         pet personalities + hundreds of templated lines in EN/BN
├── world.js       world state (objects, characters, colours, weather, roles, outfit)
├── quests.js      per-situation mission cards (steps tick as the child does things)
├── ml/            trained intent model: dataset.js (templates) · features.js · train.js · index.js (classify, spell-fix, teach, retrain)
└── index.js       the router: rules → scene scripts → trained-model fallback → safe templates
```

Order of a turn: pending yes/no → navigation → role play → *(confident trained-model travel request)* → scene script → talking to
characters → build/remove/colour/weather/time → feelings & questions → in-role replies → **trained model (≥ 55 % confidence)** →
friendly fallback. Rewards (`server/rewards.js`) and the mission card are computed after the reply.

A turn returns: pet text/mood/action, an ordered list of who-says-what (pet and characters get different voices), the updated world, visual events (confetti, hearts, phone ring…), suggestion chips at the child's level, the skills practised and metrics for the parent view.

## 🗂 Project layout

```
server/index.js      Express API + static hosting
server/db.js         JSON file store (children, sessions, PIN hashes)
server/dashboard.js  parent summaries (non-medical)
server/rewards.js    sticker rules (encouragement only)
server/curriculum/   curriculum datasets (en/bn, restaurant/shop/hospital/stage/home, levels 1–4) + BM25 retriever
server/mcp/          read-only Model Context Protocol (MCP) server for parents' AI assistants
server/brain/        the pet brain (rules + lexicon + trained intent model + scenes + quests)
public/              the game — vanilla ES modules, no framework, no bundler, no CDN
  index.html         full-screen <canvas id="gl"> + DOM overlay root + import map for three
  vendor/three.module.js  three.js r186, bundled locally (MIT, see THREE-LICENSE.txt)
  js/main.js         boot + screens: title (sunset park), player select (pets on pedestals), play, parent overlay, routing
  js/engine.js       WebGL engine: renderer, sky dome/stars/sun/moon, light presets, fog, follow/orbit/intro/frame camera,
                     drag/pinch/wheel/tap input, keyboard+joystick move vector, projection helper, main loop
  js/world3d.js      the living world: 23 location sets, server world → 3D actors (walk-in / pop-in / poof), atmosphere,
                     ambient animation (rotors, wheels, waves, clouds, audience clapping), nameplate anchors
  js/pet3d.js        the 3D pet (cat / bunny / dino): procedural body, canvas face (moods, blink, lip-sync), walk cycle,
                     actions, outfits, sleeping / sick states
  js/models.js       ~150 procedural low-poly props + canvas textures (ground tiles, signs, emoji standees)
  js/creatures.js    31 animals + 34 people built from parts, with faces, roles and idle/walk animation hooks
  js/fx3d.js         3D effects: instanced confetti, sparkles, hearts, poofs, heal ring, emotes, 💤, applause,
                     rain / snow / bubbles / fireflies / petals following the camera
  js/play3d.js       gameplay: voice loop (listen → brain → speak), dialogue box synced to speech, chips, hint,
                     silence handling, quests, stickers, pause menu, nameplates, movement, tap-to-walk, scene travel
  js/pet.js          vector portrait of the pet for the dialogue box
  js/sfx.js          Web Audio sound effects + ambience (synthesised, no files)
  js/speech.js       Web Speech wrapper (STT + TTS, word-boundary events for the typewriter)
  js/parent.js       dashboard, sticker book, teach-the-pet, privacy, export/delete (opens as an overlay over the game)
  js/i18n.js         UI strings EN/BN
  css/game.css       HUD + screens · css/styles.css shared base + dashboard · fonts/ local OFL fonts
scripts/ui-smoke.py  optional headless browser smoke test (Playwright + SwiftShader WebGL)
```

## 📊 Parent Report & Speaking Score (Parent-Only)

The **Parent Dashboard** is designed for honesty, clarity, and privacy. **The child must never see the speaking score.** The score is shown exclusively in the parent overlay and is protected by the parent PIN.

### Design & Layout
* Styled using the warm pastel colors and rounded typography of `css/game.css`.
* Responsive layout: single column on phones, clear structured cards on tablets and desktops.
* Fully bilingual: instant toggle between **English** and **বাংলা**.
* **Zero external chart libraries**: the weekly timeline is drawn using light, accessible inline SVG.
* **Print & PDF ready**: dedicated print stylesheet and a **"Download as PDF"** button calling `window.print()`.
* **Time Range Filter**: quick switcher for **Today | This week | All time**.

### The 7 Report Cards

1. **"Today" Card**:
   - Sentences said today and minutes played.
   - **New words today**: interactive chips for words never used in earlier sessions.
   - **Average sentence length today**: with an up/down change indicator vs yesterday.
   - **Longest sentence today**: word count is always shown. **The actual sentence text is shown ONLY if the transcripts setting is ON**. If transcripts are OFF, text is strictly redacted to respect privacy.
   - **Situations played today**: badges for restaurant, shop, doctor, stage, etc.

2. **"Speaking Score" Card (0 to 100)**:
   - Big numerical score, change vs baseline (`+` / `-`), and status badge: *Getting started* (< 50), *Growing* (50–74), or *Strong* (≥ 75).
   - **Baseline tracking**: Computed over the child's **first 3 qualifying sessions** (sessions with $\ge 5$ utterances). Prior to 3 qualifying sessions, displays *"Building your baseline (X of 3 sessions)"* instead of a number.
   - Four mini-bars explaining the score breakdown:
     - **Word variety (30%)**: unique words per qualifying session vs level target.
     - **Sentence length (30%)**: average words per sentence vs level target (capped at level 4 target).
     - **Taking part (20%)**: ratio of active utterances to total turns: $\frac{\text{utterances}}{\text{utterances} + \text{silences}}$.
     - **Sentence level (20%)**: adaptive level (1 to 4) mapped across 0 to 100.
   - Transparent disclaimer: *"Based on words, sentence length and taking part (no pronunciation analysis)."*
   - Persisted on each qualifying session at session end; computed dynamically at read time for legacy sessions.

#### Target Matrix (`SCORE_CONSTANTS` in `server/dashboard.js`)
*Note: Draft targets per adaptive level — to be tuned in a pilot.*

| Adaptive Level | Description | Target Unique Words / Session | Target Avg Words / Sentence |
|:---:|---|:---:|:---:|
| **Level 1** | Single words | 8 | 1.8 |
| **Level 2** | Phrases (2–3 words) | 15 | 2.8 |
| **Level 3** | Simple sentences | 25 | 4.2 |
| **Level 4** | Full sentences / stories | 40 | 6.0 |

*Each mini-bar component is capped at 100.*

3. **Sentence Length Over Time**:
   - Weekly inline SVG line chart showing average sentence length session-by-session.
   - Shaded horizontal reference bands marking Level 1, Level 2, Level 3, and Level 4 expectations.

4. **Words & Vocabulary**:
   - New words this week (used in the last 7 days but never before).
   - Total count of different unique words observed across all sessions.
   - Top 35 most frequent words.

5. **Skills & Situations**:
   - Breakdown of speech skills practiced (e.g. asking questions, naming, expressing feelings, requesting).
   - Situations visited and frequency of play (restaurant, shop, hospital, stage, etc.).

6. **Practice at Home**:
   - Contextual, gentle activity ideas based on observed play (e.g., modeling polite choices, turn-taking, role-play).
   - **Practice words**: Displays target words retrieved from the curriculum during play over the last 7 days, deduplicated and sorted most-used first, complete with an example sentence and follow-up question for home practice (with clean empty state when no data).

7. **Early Flag Alert**:
   - **Rule**: Evaluates only qualifying sessions ($\ge 5$ utterances) *after* the initial 3 baseline sessions.
   - **Trigger**: Triggers if the last 5 consecutive qualifying sessions are all below the child's baseline on sentence length or taking part by a margin of $\ge 15\%$ (`earlyFlagMargin: 0.15`).
   - **Transparency & Safety**: Shows exact numbers (baseline vs recent average and drop percentage). Gently suggests talking to a professional speech-language therapist; **never diagnoses**.

### Parent PIN Gate
- If a child has no parent PIN configured or the request is unverified (`pinVerified: false`), the backend strictly omits the speaking score, today card details, and early flag from the payload.
- The UI presents a clean card: *"Set a parent PIN to see the full report"* with an inline form to set a 4-digit PIN immediately.

---

## 📚 Local Curriculum Retrieval (BM25)

FirstWord AI incorporates a zero-dependency, in-memory **Okapi BM25** keyword retriever over a structured speech curriculum (`server/curriculum/`).

### Curriculum Datasets
* **Structured by Scene, Level, and Language**:
  - Scenes: `restaurant`, `shop`, `hospital`, `stage`, `home`
  - Levels: 1 (single words) to 4 (longer stories)
  - Languages: `en` (English) and `bn` (বাংলা)
  - 10 JSON files with $\ge 3$ items per scene/level/language combination (120 items total).
  - All items are labeled: `"note": "draft, to be reviewed by a language professional"`.
* **Item Properties**: `id`, `scene`, `level`, `lang`, `targetWords`, `exampleSentences`, `followUpQuestions`, `weakPoints`.

### Retrieval Architecture & Safety Rules
1. **Hard Filtering**: Hard filter on language, scene, and level. If a scene and level has no items, falls back to the nearest level, then the scene default, then generic home. BM25 ranks *only* within the filtered candidate set.
2. **Unicode Tokenizer**: Matches `[\p{L}\p{M}\p{N}]+` so combining characters and Bangla vowel signs stay attached to words.
3. **Query Construction**: Built strictly from `scene + level + measured weak points` (short answers, few words, silences). **The child's text is never used in the query.**
4. **Strict Usage Boundaries**:
   - **Silence hints**: Used to suggest target vocabulary when a child stays quiet.
   - **Fallback replies**: When rules have no answer, the pet asks a gentle curriculum follow-up question.
   - **Short answers at Level 1 or 2**: At most ONE follow-up question is asked after a 1–2 word utterance.
   - **Guarantees**: Never modifies scripted scene lines or state transitions; never asks more than one question in a turn.
5. **Ollama Grounding**: When local Ollama is active, the top 3 retrieved items are injected into the system prompt, keeping answers within the 25-word limit and 60-token cap.
6. **Privacy & Persistence**: On each turn, only the used item `id`, `targetWords`, and used `followUpQuestion` are stored. Unused retrieved items are never saved.

---

## 🤖 Parent MCP Server (Read-Only)

FirstWord AI ships an official, strictly **read-only** Model Context Protocol (MCP) server in `server/mcp/index.js` using `@modelcontextprotocol/sdk` (pinned at `1.32.2`) with `stdio` transport.

> **⚠️ Privacy & Provider Notice:** Connecting an AI assistant sends the data these tools return to that assistant's provider. This is the parent's choice. Tools return no audio and no full conversations.

### Starting the Server
```bash
npm run mcp
```

### Client Configuration (e.g., Claude Desktop)
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "firstword-parent": {
      "command": "node",
      "args": ["C:/Projects/FIRSTWORD01/firstword-ai/server/mcp/index.js"]
    }
  }
}
```

### Tools (Read-Only)

| Tool | Inputs | Description & Permissions |
|---|---|---|
| `get_progress_summary` | `childId` (string, req), `pin` (string, req) | Returns today's numbers (sentences said, minutes played, average sentence length vs yesterday, longest sentence, situations played, new words today), speaking score (0..100) with 4 mini-bar components, and baseline status. |
| `get_weekly_report` | `childId` (string, req), `pin` (string, req) | Returns the comprehensive parent report matching the dashboard: totals, level, speaking score, weekly timeline, words, skills, situations, 7-day practice words, and early flag observations. |
| `search_curriculum` | `query` (string, max 200 chars), `scene` (enum), `level` (1..4), `lang` (`en`\|`bn`) | Returns up to 5 matching curriculum items (target words, example sentences, follow-up questions). **Curriculum lookup only — zero access to child records or play history.** |

### Mandatory Notice & Safety Rules
1. **Mandatory Non-Medical Notice**: Every response from `get_progress_summary` and `get_weekly_report` includes:
   *"These numbers describe what happened inside the app. They are not a medical assessment or diagnosis. Speech recognition makes mistakes."*
2. **PIN Required & Zero Leakage**: If a child has no parent PIN configured, requests are refused with: *"Set a parent PIN in the FirstWord parent view first."* Unknown child IDs and wrong PINs return the exact same error (*"Authentication failed. Please check the child ID and PIN."*), preventing child ID enumeration.
3. **Lockout Protection**: After 5 failed PIN attempts for a child within 10 minutes, requests are refused for 10 minutes (*"Too many failed attempts. Please try again in X minute(s)."*).
4. **Strict Privacy**:
   - **No Conversation Turns**: Recent dialogue turns (`recentTurns`) are never returned.
   - **No Secrets**: PIN hashes (`pinHash`, `pinSalt`) are strictly stripped.
   - **Transcripts Setting**: The longest sentence text is returned only if the child's `storeTranscripts` setting is ON; if OFF, only the word count is returned (`text: null`).
5. **Fresh Data & Clean Protocol**: Re-reads database from disk on every tool call (`db.load()`), never writes to `db.json`, respects `process.env.DATA_DIR`, and ensures `stdout` carries *only* valid JSON-RPC protocol messages (all logging is directed to `stderr`).

---

## 🔌 API (all local)

| Interface | Method / Tool | Path / Identifier | Purpose |
|---|---|---|---|
| HTTP | GET | `/api/health` | status + whether a local LLM is attached |
| HTTP | GET/POST | `/api/children` | list / create child profile (`name, age, lang, petType, petName, pin`) |
| HTTP | GET/PATCH/DELETE | `/api/children/:id` | read / update / delete (PIN needed for delete, PIN change, transcript setting) |
| HTTP | POST | `/api/children/:id/verify-pin` | check PIN |
| HTTP | GET | `/api/children/:id/dashboard` | parent report (`?range=today\|week\|all`, header `x-parent-pin` to unlock score, today details, early flag) |
| HTTP | GET | `/api/children/:id/export` | download all data as JSON |
| HTTP | DELETE | `/api/children/:id/data` | delete play history, keep profile |
| HTTP | POST | `/api/sessions` | start a play session → greeting |
| HTTP | POST | `/api/sessions/:id/say` | `{ text, source: voice\|typed\|button\|tap\|silence }` → pet reply + world (supports shop cashier steps: pricing, scanning, taking money, cash drawer deposit, change) |
| HTTP | POST | `/api/sessions/:id/scene` | jump to a situation with a button |
| HTTP | POST | `/api/sessions/:id/end` | close session (calculates and stores session speaking score) |
| HTTP | GET | `/api/children/:id/stickers` | sticker book (earned + still secret) |
| HTTP | GET | `/api/ml/status` | trained-model status: examples, accuracy, intents, labels |
| HTTP | GET | `/api/children/:id/unclear` | sentences the pet was unsure about (PIN) |
| HTTP | POST | `/api/children/:id/teach` | `{ text, intent }` → stored + model retrained (PIN) |
| HTTP | POST | `/api/children/:id/retrain` | retrain from templates + taught examples (PIN) |
| **MCP** | Tool | `get_progress_summary` | Today's metrics, speaking score, change vs baseline (PIN required) |
| **MCP** | Tool | `get_weekly_report` | Comprehensive weekly parent report, level bands, early flag (PIN required) |
| **MCP** | Tool | `search_curriculum` | Curriculum vocabulary and prompts search (read-only, no child data) |

Every `/say` and `/scene` response also carries `corrected` (spelling hints), `ml` (model guess when used), `quest` (mission card),
`rewards` (new stickers) and `stickerCount`.

## 🛡 Design promises

* The pet is **never** beaten, injured, abandoned or emotionally punished — including when the child stays silent.
* No scores, stars or "wrong" answers. Short or unclear speech is simply echoed back a little fuller.
* Parent data is descriptive, not diagnostic; the dashboard says so on every page.
* Minimal data: no audio, optional transcripts, local JSON file you fully control.

## Optional: local LLM for open chat

```bash
ollama pull qwen2.5:1.5b          # any small instruct model
OLLAMA_URL=http://localhost:11434 OLLAMA_MODEL=qwen2.5:1.5b npm start
```

The rule engine still handles every scene, world command and safety rule; the LLM only fills in free conversation, with a child-safe system prompt and a hard fallback to templates.
