// Gentle "missions" per situation. They only ever get completed — never failed.
export function questFor(session, ctx) {
  const lang = ctx.lang;
  const bn = lang === 'bn';
  const st = session.sceneState || {};
  const w = session.world;
  const pet = ctx.pet.name;
  const seen = session.intentsSeen || new Set();
  const step = (en, bnText, done) => ({ label: bn ? bnText : en, done: Boolean(done) });
  switch (session.scene) {
    case 'restaurant': return {
      title: bn ? 'রেস্টুরেন্ট মিশন' : 'Restaurant mission', emoji: '🍽️',
      steps: [
        step('Choose where to sit', 'কোথায় বসবে বলো', st.table || (st.stage && st.stage !== 'seating')),
        step('Order something to eat', 'খাবার অর্ডার করো', (st.orders || []).length >= 1),
        step(`Order something for ${pet} too`, `${pet}-এর জন্যও কিছু অর্ডার করো`, (st.orders || []).length >= 2),
        step('Say thank you or ask for the bill', 'ধন্যবাদ বলো বা বিল চাও', st.stage === 'done' || seen.has('greet_thanks')),
      ],
    };
    case 'shop': return {
      title: bn ? 'দোকান মিশন' : 'Shop mission', emoji: '🛍️',
      steps: [
        step('Greet the customer at the counter', 'কাউন্টারে ক্রেতাকে স্বাগতম জানাও', (st.customerCount || 0) >= 1),
        step('Tell them the price', 'ক্রেতাকে দাম বলো', (st.price || 0) > 0),
        step('Scan the item with your scanner', 'হাতের স্ক্যানার দিয়ে জিনিসটা স্ক্যান করো', st.scanned || st.stage === 'sold'),
        step('Take the money from the customer', 'ক্রেতার হাত থেকে টাকা নাও', (st.cart || []).length >= 1),
      ],
    };
    case 'hospital': return {
      title: bn ? 'ডাক্তার মিশন' : 'Doctor mission', emoji: '🩺',
      steps: [
        step('Tell the doctor what hurts', 'ডাক্তারকে বলো কী হয়েছে', st.described),
        step("Answer the doctor's question", 'ডাক্তারের প্রশ্নের উত্তর দাও', (st.answers || 0) >= 1),
        step(`Comfort ${pet}`, `${pet}-কে সাহস দাও`, (st.helped || 0) >= 1),
        step('All better!', 'সুস্থ হয়ে গেছে!', st.stage === 'treat' || w.petState === 'normal' && st.described),
      ],
    };
    case 'stage': return {
      title: bn ? 'মঞ্চ মিশন' : 'Stage mission', emoji: '🎭',
      steps: [
        step('Pick a show: a story or a song', 'গল্প না গান — বেছে নাও', st.type),
        step('Perform three lines', 'তিন লাইন পারফর্ম করো', (st.lines || 0) >= 3),
        step('Take a bow for the applause', 'হাততালি নিয়ে বাউ করো', st.stage === 'finished'),
      ],
    };
    case 'emergency': return {
      title: bn ? 'সাহায্য মিশন' : 'Rescue mission', emoji: '🆘',
      steps: [
        step(`Tell ${pet} it will be okay`, `${pet}-কে বলো সব ঠিক হয়ে যাবে`, st.reassured),
        step('Call someone for help', 'কাউকে সাহায্যের জন্য ডাকো', st.helperCalled),
        step('Explain what happened', 'কী হয়েছে বুঝিয়ে বলো', (st.steps || 0) >= 2),
        step('Problem solved!', 'সমস্যা মিটে গেছে!', st.resolved),
      ],
    };
    case 'create': return {
      title: bn ? 'জগৎ বানানোর মিশন' : 'World-builder mission', emoji: '🌈',
      steps: [
        step('Make something appear', 'কিছু একটা বানাও', (st.builds || 0) >= 1 || w.objects.length > 0),
        step('Invite a friend or animal', 'কোনো বন্ধু বা প্রাণী আনো', w.characters.length > 0),
        step('Change a colour', 'একটা রং বদলাও', w.colors.sky || w.colors.ground || w.colors.room || w.objects.some((o) => o.color)),
        step('Change the weather or time', 'আবহাওয়া বা সময় বদলাও', w.weather !== 'clear' || w.time !== 'day'),
      ],
    };
    default: return {
      title: bn ? 'আজকের মিশন' : "Today's mission", emoji: '🐾',
      steps: [
        step(`Say hello to ${pet}`, `${pet}-কে হ্যালো বলো`, seen.has('greet_hello') || seen.has('ml_greet')),
        step(`Ask ${pet} a question`, `${pet}-কে একটা প্রশ্ন করো`, [...seen].some((k) => k.startsWith('pet_q') || k === 'ml_pet_question' || k === 'pet_question')),
        step('Make something appear', 'কিছু একটা বানাও', seen.has('build') || w.objects.length > 0),
        step('Go somewhere together', 'একসাথে কোথাও যাও', session.scenesVisited && session.scenesVisited.length > 1),
      ],
    };
  }
}
