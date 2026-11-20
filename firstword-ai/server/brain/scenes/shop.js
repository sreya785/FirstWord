// Shop scene: you and your pet own the shop. Customers come to your counter with an item,
// you quote a price, scan the item, and the customer hands the money over in cash.
import * as L from '../lexicon.js';
import * as W from '../world.js';
import { find, pick, isNegative } from '../normalize.js';
import { createReply } from '../reply.js';
import * as qwen from '../qwen.js';

const ITEM_KEYS = Object.keys(L.SHOP_ITEMS);
const PRICES = [20, 30, 50, 80, 100, 120, 150, 200];
const TAG_PRICE = { ball: 40, book: 90, teddy: 150, bag: 120, gift: 100, toy: 70, doll: 110, kite: 60, balloon: 25 };
const SHIRTS = ['#38bdf8', '#f472b6', '#4ade80', '#fbbf24', '#a78bfa'];
const CUSTOMERS = [
  { en: 'A customer in a yellow scarf', bn: 'হলুদ স্কার্ফ পরা এক ক্রেতা' },
  { en: 'A customer with a big smile', bn: 'হাসিমুখ এক ক্রেতা' },
  { en: 'A customer holding a basket', bn: 'ঝুড়ি হাতে এক ক্রেতা' },
  { en: 'A young customer with a cap', bn: 'টুপি পরা ছোট এক ক্রেতা' },
];

function itemName(key, lang) {
  const it = L.SHOP_ITEMS[key];
  return it ? (lang === 'bn' ? it.bn[0] : it.en[0]) : key;
}
function colorName(key, lang) {
  const c = L.COLORS[key];
  return c ? (lang === 'bn' ? c.bn[0] : c.en[0]) : '';
}
function money(n, lang) {
  return lang === 'bn' ? `${n} টাকা` : `${n} taka`;
}

/** The customer speaks from the other side of the counter. */
async function customerSay(session, ctx, r, text, utterance = '', context = {}) {
  const lang = ctx.lang;
  const st = session.sceneState || {};
  const who = CUSTOMERS[(st.customerCount || 0) % CUSTOMERS.length];
  const name = lang === 'bn' ? who.bn : who.en;
  let line = text;
  const clientKey = session?.clientKey || null;
  if (utterance && qwen.isRoleEnabled('shop_customer', lang, clientKey)) {
    const aiLine = await qwen.generateRoleReply({
      role: 'shop_customer',
      lang,
      utterance,
      clientKey,
      context: { stage: st.stage, item: st.customerItem, price: st.price, paid: st.paid, ...context },
    });
    if (aiLine) line = aiLine;
  }
  const list = (session.world.characters || []).filter((c) => c.role === 'customer').sort((a, b) => (a.queue ?? 9) - (b.queue ?? 9));
  const existing = list.find((c) => (c.queue ?? 0) === 0) || list[0];
  const key = existing ? 'c' + existing.id : null;
  if (existing) {
    existing.name = name; existing.line = line; existing.isNew = true; session.world.version++;
  } else {
    const c = W.addCharacter(session.world, 'friend', { name, role: 'customer', queue: 0, line, color: SHIRTS[(st.customerCount || 0) % SHIRTS.length], allowDuplicate: true });
    session.world.version++;
    r.char('customer', name, '🧒', line, { key: 'c' + c.id });
    return r;
  }
  r.char('customer', name, '🧒', line, { key });
  return r;
}

/**
 * The little line of customers in front of the counter. The first one is being served; the
 * others wait behind (the client puts each `queue` index on the floor line). Old waiters are
 * cleared away so the same people never pile up.
 */
function ensureQueue(session, ctx, r) {
  const lang = ctx.lang;
  const st = session.sceneState;
  const world = session.world;
  const keep = [];
  const served = world.characters.filter((c) => c.role === 'customer' && c.queue == null);
  for (const c of served) keep.push(c);
  if (!keep.length) {
    // no one at the counter yet: bring the first customer in
    const first = CUSTOMERS[(st.customerCount || 0) % CUSTOMERS.length];
    const c = W.addCharacter(world, 'friend', { name: lang === 'bn' ? first.bn : first.en, role: 'customer', queue: 0, line: '', color: SHIRTS[(st.customerCount || 0) % SHIRTS.length], allowDuplicate: true });
    keep.push(c);
    st.customerCount = (st.customerCount || 0) + 1;
  }
  // two more shoppers in the line, so it looks like a real shop
  const want = Math.max(keep.length, Math.min(3, (st.waiting || 0) + 1));
  for (let i = keep.length; i < want; i++) {
    const who = CUSTOMERS[(st.customerCount + i) % CUSTOMERS.length];
    const c = W.addCharacter(world, 'friend', { name: lang === 'bn' ? who.bn : who.en, role: 'customer', queue: i, line: '', color: SHIRTS[(i + (st.customerCount || 0)) % SHIRTS.length], allowDuplicate: true });
    keep.push(c);
  }
  keep.forEach((c, i) => { c.queue = i; });
  world.characters = world.characters.filter((c) => c.role !== 'customer').concat(keep);
  world.version++;
  return keep;
}

/** Keep the customer's item on the counter (one object, never duplicated). */
function showCounterItem(session, key) {
  const st = session.sceneState;
  session.world.objects = (session.world.objects || []).filter((o) => !o.counter);
  const obj = W.addObject(session.world, key, { x: 50, y: 78, name: 'customer item', size: 'big' });
  if (obj) obj.counter = true;
  return obj;
}

async function newCustomer(session, ctx, r) {
  const st = session.sceneState;
  st.customerCount = (st.customerCount || 0) + 1;
  st.customerItem = pick(['ball', 'book', 'teddy', 'bag', 'toy', 'doll', 'kite', 'balloon']);
  st.tag = TAG_PRICE[st.customerItem] || 60;
  st.price = 0; st.paid = null; st.stage = 'customer_waiting'; st.scanned = false; st.bargained = false;
  showCounterItem(session, st.customerItem);
  await customerSay(session, ctx, r, ctx.lang === 'bn'
    ? `নমস্কার! আমি এই ${itemName(st.customerItem, 'bn')}টা কিনতে চাই। দাম কত?`
    : `Hello! I would like to buy this ${itemName(st.customerItem, 'en')}. How much is it?`);
  return r;
}

export async function enter(session, ctx) {
  const { lang } = ctx;
  const r = createReply('enter_shop');
  session.sceneState = {
    stage: 'customer_waiting', item: null, color: null, size: null, price: 0, cart: [], gift: false,
    shown: 0, workflow: 'owner-counter', customerCount: 0, customerItem: null, customerServed: 0, tag: 0, paid: null,
    scanned: false, bargained: false, waiting: 2,
  };
  const st = session.sceneState;
  W.setCustomLabel(session.world, lang === 'bn' ? 'আমাদের দোকান' : 'Our Shop');
  r.pet(lang === 'bn'
    ? 'আমরা এই দোকানের দোকানদার! কাউন্টারের পিছনে দাঁড়িয়ে আছি — ক্রেতারা দরজা দিয়ে একে একে এসে লাইনে দাঁড়ায়। দাম বলো, তারপর হাতের স্ক্যানার দিয়ে জিনিসটা স্ক্যান করো!'
    : 'We are the shopkeepers! We stand behind the counter — customers come in through the door one by one and wait in the line. Tell them the price, then scan the item with the scanner in your hand!', 'excited', 'bounce');
  // WE are the shopkeepers (child + pet behind the counter): the child greets the first customer
  r.pet(lang === 'bn' ? 'নমস্কার! আমাদের দোকানে স্বাগতম।' : 'Hello! Welcome to our shop.', 'happy');
  ensureQueue(session, ctx, r);
  newCustomer(session, ctx, r);
  ensureQueue(session, ctx, r);
  r.suggest(lang === 'bn' ? 'দাম কত?' : 'How much is it?', lang === 'bn' ? '১৫০ টাকা' : '150 taka', lang === 'bn' ? 'স্ক্যান করো' : 'Scan it');
  return r;
}

function calcCashGiven(price) {
  if (!price) return 60;
  if (price === 20) return 50;
  if (price === 50) return 100;
  if (price === 100) return 100; // exact
  if (price === 200) return 200; // exact
  const notes = [50, 100, 150, 200, 500];
  const nextNote = notes.find((n) => n > price);
  return nextNote || (price + 20);
}

/** The scanner in the child's hand: beep, show the item, then take payment. */
async function scanTurn(session, ctx, r, s, raw) {
  const lang = ctx.lang;
  const st = session.sceneState;
  if (/\b(scan|scanner|beep|barcode|code)\b/.test(s) || /স্ক্যান/.test(raw)) {
    if (!st.customerItem) return r.pet(lang === 'bn' ? 'এখন কাউন্টারে কেউ নেই — পরের ক্রেতাকে ডাকো!' : 'No one is at the counter right now — call the next customer!', 'happy');
    if (st.stage === 'customer_waiting') {
      r.pet(lang === 'bn'
        ? 'স্ক্যান করার আগে দাম বলো — ক্রেতা জানতে চাইছে!'
        : 'Before we scan, tell the customer the price — they are asking!', 'thinking');
      r.suggest(lang === 'bn' ? `দাম ${money(st.tag, 'bn')}` : `It costs ${money(st.tag, 'en')}`);
      return r;
    }
    if (st.stage === 'priced' || st.stage === 'payment') {
      st.scanned = true;
      const p = st.price || st.tag || 60;
      st.cashGiven = calcCashGiven(p);
      st.changeDue = Math.max(0, st.cashGiven - p);
      st.stage = 'payment'; // customer puts money on the counter
      r.event('sparkle');
      if (st.changeDue > 0) {
        await customerSay(session, ctx, r, lang === 'bn'
          ? `বিপ! ${itemName(st.customerItem, 'bn')} — দাম ${money(p, 'bn')}। কাউন্টারে ${money(st.cashGiven, 'bn')} রাখলাম। আর ${money(st.changeDue, 'bn')} ফেরত দিও!`
          : `Beep! ${itemName(st.customerItem, 'en')} — ${money(p, 'en')}. Here is ${money(st.cashGiven, 'en')} on the counter! Please give me ${money(st.changeDue, 'en')} change.`, raw || s);
      } else {
        await customerSay(session, ctx, r, lang === 'bn'
          ? `বিপ! ${itemName(st.customerItem, 'bn')} — দাম ${money(p, 'bn')}। কাউন্টারে ঠিক ${money(st.cashGiven, 'bn')} রাখলাম, একদম সঠিক হিসাব!`
          : `Beep! ${itemName(st.customerItem, 'en')} — ${money(p, 'en')}. Here is exact ${money(st.cashGiven, 'en')} on the counter!`, raw || s);
      }
      r.pet(lang === 'bn'
        ? `স্ক্যান হয়ে গেল! কাউন্টার থেকে টাকাটা হাতে নাও।`
        : `Scanned! Click the money on the counter to take it into your hand.`, 'proud');
      r.skill('requesting');
      r.suggest(lang === 'bn' ? 'টাকা নাও' : 'Take the money');
      return r;
    }
    if (st.stage === 'money_held' || st.stage === 'change_needed') {
      r.pet(lang === 'bn' ? 'স্ক্যান তো হয়ে গেছে! ডেস্কে ল্যাপটপ ক্যাশ বক্সে টাকা রাখো।' : 'Already scanned! Put the money inside the laptop cash box.', 'thinking');
      return r;
    }
    if (st.stage === 'sold') {
      r.pet(lang === 'bn' ? 'এই জিনিসটা তো বিক্রি হয়ে গেছে! পরের ক্রেতাকে ডাকি।' : 'That one is already sold! Let us call the next customer.', 'happy');
      r.suggest(lang === 'bn' ? 'পরের ক্রেতা' : 'Next customer');
      return r;
    }
  }
  return null;
}

export async function handle(session, n, ctx) {
  const { lang } = ctx;
  const st = session.sceneState;
  const s = n.norm;
  const raw = n.raw || '';
  const items = find.shopItems(n);
  const colors = find.colors(n);
  const r = createReply('shop');

  // -----------------------------------------------------------------
  // Owner / cashier loop
  // -----------------------------------------------------------------
  if (st.workflow === 'owner-counter') {
    const scanned = await scanTurn(session, ctx, r, s, raw);
    if (scanned) return scanned;
    const num = Number((/\b(\d{1,4})\b/.exec(s) || [])[1] || 0);
    const bnNum = Number((/([০-৯]{1,4})/.exec(raw) || [])[1]?.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6)) || 0);
    const quote = num || bnNum || (/\b(cost|price|taka|dollar|how much|charge|that is|it is)\b/.test(s) ? (st.tag || 60) : 0);
    const paysCash = /\b(cash|notes?|coins?|taka|money|pay|paid|take|change|here you go)\b/.test(s) || /নগদ|টাকা|পেমেন্ট/.test(raw);

    // ---- customer at the counter: tell the price, then scan the item ----
    if (st.stage === 'customer_waiting' || st.stage === 'priced') {
      if (quote) {
        st.priceMisses = 0;
        const first = st.stage === 'customer_waiting';
        st.price = quote; st.stage = 'priced'; st.scanned = false;
        const low = quote < Math.round((st.tag || 60) * 0.55);
        if (low) {
          // gentle bargaining: the child can hold the price or give a friendly deal
          st.bargained = true;
          await customerSay(session, ctx, r, lang === 'bn'
            ? `${money(quote, 'bn')}? আরেকটু কম হবে না? দোকানে তো ${money(st.tag, 'bn')} লেখা!`
            : `${money(quote, 'en')}? Could you make it a little cheaper? The tag says ${money(st.tag, 'en')}!`, raw || s);
          r.pet(lang === 'bn'
            ? `ও দামটা অনেক কম! দোকানের ট্যাগে ${money(st.tag, 'bn')} লেখা। হয় ${money(st.tag, 'bn')}-ই রাখো, নাহয় ভদ্রভাবে কমিয়ে দাও — দুইটাই ঠিক।`
            : `That is a very low price — the tag says ${money(st.tag, 'en')}. You can keep the tag price, or kindly give a small discount. Both are fine!`, 'thinking');
        } else {
          await customerSay(session, ctx, r, lang === 'bn'
            ? `${money(quote, 'bn')}? দারুণ! আমি নেব। স্ক্যান করে দাও!`
            : `${money(quote, 'en')}? Great, I will take it! Please scan it for me!`, raw || s);
          r.pet(lang === 'bn'
            ? (first ? 'তুমি দাম বললে। এখন হাতের স্ক্যানার দিয়ে জিনিসটা স্ক্যান করো!' : 'দাম বদলে দিলে। এবার স্ক্যান করো!')
            : (first ? 'You told them the price! Now scan the item with the scanner in your hand!' : 'A new price it is. Now scan it!'), 'proud');
        }
        r.skill('requesting');
        r.suggest(lang === 'bn' ? 'স্ক্যান করো' : 'Scan it', lang === 'bn' ? `${money(st.price, 'bn')}` : `${st.price} taka`);
        return r;
      }
      if (/^(hello|hi|hey|assalamu|salam|নমস্কার|হ্যালো|আসসালামু)/.test(s)) {
        await customerSay(session, ctx, r, lang === 'bn' ? 'নমস্কার! আপনার দোকান খুব সুন্দর!' : 'Hello! Your shop looks lovely!', raw || s);
        r.pet(lang === 'bn' ? `ধন্যবাদ! ক্রেতার হাতে ${itemName(st.customerItem, 'bn')} — দাম বলি।` : `Thank you! The customer is holding a ${itemName(st.customerItem, 'en')} — let us tell them the price.`, 'happy');
        r.suggest(lang === 'bn' ? `দাম ${money(st.tag, 'bn')}` : `It costs ${money(st.tag, 'en')}`);
        return r;
      }
      if (items.length || colors.length) {
        st.customerItem = items[0]?.key || st.customerItem;
        st.tag = TAG_PRICE[st.customerItem] || st.tag || 60;
        showCounterItem(session, st.customerItem);
        await customerSay(session, ctx, r, lang === 'bn'
          ? `এই ${colorName(colors[0]?.key, 'bn') || ''} ${itemName(st.customerItem, 'bn')}টা কেমন? দাম কত?`
          : `How about this ${colorName(colors[0]?.key, 'en') || ''} ${itemName(st.customerItem, 'en')}? How much is it?`, raw || s);
        r.pet(lang === 'bn' ? 'দাম বলো, তারপর স্ক্যান করি।' : 'Tell them the price, then we scan it.', 'happy');
        return r;
      }
      if (st.stage === 'customer_waiting' && n.tokens.length >= 1) {
        st.priceMisses = (st.priceMisses || 0) + 1;
        if (st.priceMisses >= 3) {
          st.price = st.tag || 60;
          st.stage = 'priced';
          st.scanned = false;
          await customerSay(session, ctx, r, lang === 'bn'
            ? `${money(st.price, 'bn')}? দারুণ! আমি নেব। স্ক্যান করে দাও!`
            : `${money(st.price, 'en')}? Great, I will take it! Please scan it for me!`, raw || s);
          r.pet(lang === 'bn'
            ? 'দাম ঠিক হলো! এবার হাতের স্ক্যানার দিয়ে জিনিসটা স্ক্যান করো।'
            : 'Price accepted! Now scan the item with the scanner in your hand!', 'proud');
          r.suggest(lang === 'bn' ? 'স্ক্যান করো' : 'Scan it');
          return r;
        }
        if (st.priceMisses === 2) {
          await customerSay(session, ctx, r, lang === 'bn'
            ? `এই ${itemName(st.customerItem, 'bn')}টার দাম কত? মুখে বলো: ${money(st.tag, 'bn')}!`
            : `How much is this ${itemName(st.customerItem, 'en')}? You can say: ${money(st.tag, 'en')}!`, raw || s);
          r.pet(lang === 'bn' ? `তুমি বলতে পারো: ${money(st.tag, 'bn')}!` : `You can say: ${money(st.tag, 'en')}!`, 'thinking');
        } else {
          await customerSay(session, ctx, r, lang === 'bn'
            ? `আমি এই ${itemName(st.customerItem, 'bn')}টা কিনতে চাই। দাম কত বলবে?`
            : `I would like to buy this ${itemName(st.customerItem, 'en')}. Can you tell me the price?`, raw || s);
          r.pet(lang === 'bn' ? `দোকানদার হিসেবে দাম বলো! যেমন: ${money(st.tag, 'bn')}` : `Tell the customer the price! For example: ${money(st.tag, 'en')}`, 'thinking');
        }
        r.suggest(lang === 'bn' ? `${money(st.tag, 'bn')}` : `${money(st.tag, 'en')}`);
        return r;
      }
      if (st.stage === 'priced') {
        r.pet(lang === 'bn'
          ? `ক্রেতা ${money(st.price, 'bn')} দিতে রাজি। এখন স্ক্যানার দিয়ে জিনিসটা স্ক্যান করো!`
          : `The customer agreed to ${money(st.price, 'en')}. Now scan the item with your scanner!`, 'thinking');
        r.suggest(lang === 'bn' ? 'স্ক্যান করো' : 'Scan it');
        return r;
      }
      r.pet(lang === 'bn'
        ? `ক্রেতা ${itemName(st.customerItem, 'bn')} হাতে দাঁড়িয়ে আছেন। দাম বলো — যেমন ${money(st.tag, 'bn')}!`
        : `The customer is waiting with a ${itemName(st.customerItem, 'en')}. Tell them a price — like ${money(st.tag, 'en')}!`, 'thinking');
      r.suggest(lang === 'bn' ? `দাম ${money(st.tag, 'bn')}` : `It costs ${money(st.tag, 'en')}`);
      return r;
    }

    // ---- payment: customer placed money on counter, child clicks money to take it ----
    if (st.stage === 'payment') {
      const wantsTake = /\b(take|take money|pick|got|have|cash|money|হাতে|টাকা নাও|টাকা নিলাম|টাকা)\b/.test(s) || /টাকা/.test(raw);
      if (wantsTake) {
        st.stage = 'money_held';
        r.event('sparkle');
        r.pet(lang === 'bn'
          ? 'টাকা হাতে নিলে! এবার তোমার ডেস্কে ল্যাপটপ ক্যাশ বক্সে টাকাটা রাখো।'
          : 'You took the money in your hand! Now put it inside the laptop cash box on your desk.', 'proud');
        await customerSay(session, ctx, r, lang === 'bn'
          ? 'টাকাটা তোমার ক্যাশ বক্সে রেখে দাও।'
          : 'Put the cash in your register box.', raw || s);
        r.suggest(lang === 'bn' ? 'ক্যাশ বক্সে রাখো' : 'Put in cash box');
        return r;
      }
      if (isNegative(n)) {
        st.stage = 'customer_waiting'; st.price = 0;
        await customerSay(session, ctx, r, lang === 'bn' ? 'ঠিক আছে, তখন আরেকটু দেখি।' : 'No problem — I will look around a little more.', raw || s);
        r.pet(lang === 'bn' ? 'কোনো সমস্যা নেই! ক্রেতা কিছুক্ষণ পর আবার আসতে পারেন।' : 'That is absolutely fine! Customers can look around first.', 'happy');
        return r;
      }
      r.pet(lang === 'bn'
        ? `কাউন্টারে ${money(st.cashGiven || st.price, 'bn')} রাখা আছে — টাকাতে চাপ দিয়ে হাতে নাও!`
        : `The customer placed ${money(st.cashGiven || st.price, 'en')} on the counter — click the money to take it!`, 'thinking');
      r.suggest(lang === 'bn' ? 'টাকা নাও' : 'Take the money');
      return r;
    }

    // ---- money in hand: child deposits money into laptop cash box ----
    if (st.stage === 'money_held') {
      const putsInBox = /\b(put|box|cash box|register|drawer|laptop|deposit|store|keep|বক্সে|রাখো|ক্যাশ বক্স|টাকা রাখো)\b/.test(s) || /বক্স|রাখ/.test(raw);
      if (putsInBox) {
        st.paid = 'cash';
        if (st.changeDue > 0) {
          st.stage = 'change_needed';
          r.event('sparkle');
          r.pet(lang === 'bn'
            ? `টাকা ক্যাশ বক্সে রাখা হলো! এবার ড্রয়ার থেকে ক্রেতাকে ${money(st.changeDue, 'bn')} ফেরত দাও।`
            : `Money stored in the cash box! Now give ${money(st.changeDue, 'en')} change to the customer.`, 'proud');
          await customerSay(session, ctx, r, lang === 'bn'
            ? `ধন্যবাদ! আমার ${money(st.changeDue, 'bn')} ফেরতটা দিও।`
            : `Thank you! Waiting for my ${money(st.changeDue, 'en')} change.`, raw || s);
          r.suggest(lang === 'bn' ? 'ফেরত নাও' : 'Give change');
          return r;
        } else {
          // Exact money: completed!
          st.stage = 'sold';
          st.customerServed = (st.customerServed || 0) + 1;
          st.cart.push({ item: st.customerItem, price: st.price });
          r.event('confetti');
          await customerSay(session, ctx, r, lang === 'bn'
            ? 'হিসাব একদম মিলে গেছে! অনেক ধন্যবাদ, দারুণ দোকান!'
            : 'Exact payment — all done! Thank you so much, wonderful shop!', raw || s);
          r.pet(lang === 'bn'
            ? `টাকা ক্যাশ বক্সে রাখা হলো এবং হিসাব মিলে গেল! ক্রেতা ${itemName(st.customerItem, 'bn')} নিয়ে গেলেন। পরের ক্রেতাকে ডাকি!`
            : `Money stored in the box and payment complete! The customer took their ${itemName(st.customerItem, 'en')}. Let us call the next customer!`, 'proud');
          r.skill('greeting_politeness');
          r.suggest(lang === 'bn' ? 'ধন্যবাদ, আবার আসবেন' : 'Thank you, come again', lang === 'bn' ? 'পরের ক্রেতা' : 'Next customer');
          return r;
        }
      }
      r.pet(lang === 'bn'
        ? 'টাকা তোমার হাতে আছে — ডেস্কের ল্যাপটপ ক্যাশ বক্সে চাপ দিয়ে টাকা রাখো।'
        : 'The money is in your hand — tap the laptop cash box to store the money!', 'thinking');
      r.suggest(lang === 'bn' ? 'ক্যাশ বক্সে রাখো' : 'Put in cash box');
      return r;
    }

    // ---- change step: child gives change from drawer ----
    if (st.stage === 'change_needed') {
      const givesChange = /\b(change|return|give change|here is your change|here you go|ফেরত|দিলাম)\b/.test(s) || /ফেরত/.test(raw);
      if (givesChange) {
        st.stage = 'sold';
        st.customerServed = (st.customerServed || 0) + 1;
        st.cart.push({ item: st.customerItem, price: st.price });
        r.event('confetti');
        await customerSay(session, ctx, r, lang === 'bn'
          ? `${money(st.changeDue, 'bn')} ফেরত পেলাম! অনেক ধন্যবাদ, আপনাদের দোকান দারুণ! আবার আসব!`
          : `Got my ${money(st.changeDue, 'en')} change! Thank you so much, your shop is great!`, raw || s);
        r.pet(lang === 'bn'
          ? `চমৎকার! ঠিকঠাক ফেরত দিলে এবং ক্রেতা খুশি হলেন। ক্রেতা ${itemName(st.customerItem, 'bn')} নিয়ে গেলেন। এবার পরের ক্রেতাকে ডাকি!`
          : `Wonderful! You gave the correct change and the customer is happy. They took their ${itemName(st.customerItem, 'en')}. Call the next customer!`, 'proud');
        r.skill('greeting_politeness');
        r.suggest(lang === 'bn' ? 'ধন্যবাদ, আবার আসবেন' : 'Thank you, come again', lang === 'bn' ? 'পরের ক্রেতা' : 'Next customer');
        return r;
      }
      r.pet(lang === 'bn'
        ? `ক্রেতাকে ${money(st.changeDue, 'bn')} ফেরত দাও — ক্যাশ বক্সে চাপো!`
        : `Give the customer ${money(st.changeDue, 'en')} change — tap the cash drawer!`, 'thinking');
      r.suggest(lang === 'bn' ? 'ফেরত নাও' : 'Give change');
      return r;
    }

    // ---- child attempts to give change when NOT needed ----
    if (/\b(change|ফেরত)\b/.test(s) || /ফেরত/.test(raw)) {
      await customerSay(session, ctx, r, lang === 'bn'
        ? 'হিসাব তো একদম মিলে গেছে, ফেরত লাগবে না! ধন্যবাদ!'
        : 'No change needed, that was exact! Thank you!', raw || s);
      r.pet(lang === 'bn'
        ? 'ক্রেতা সঠিক টাকা দিয়েছিলেন — কোনো ফেরত দরকার নেই।'
        : 'The customer paid the exact amount — no change was needed!', 'happy');
      return r;
    }

    // ---- sold: thank the customer, call the next one ----
    if (st.stage === 'sold') {
      if (/next|another|new customer|next one|পরের/.test(s) || /পরের/.test(raw)) {
        const done = st.customerServed >= 3;
        // the served customer leaves and the line steps forward
        const list = (session.world.characters || []).filter((c) => c.role === 'customer');
        if (list.length > 1) { const gone = list[0]; session.world.characters = session.world.characters.filter((c) => c !== gone); }
        session.sceneState.waiting = 2;   // keep the little line going
        ensureQueue(session, ctx, r);
        await newCustomer(session, ctx, r);
        ensureQueue(session, ctx, r);
        r.pet(lang === 'bn'
          ? `পরের ক্রেতা এসেছেন, ${itemName(st.customerItem, 'bn')} হাতে। দাম বলি!`
          : `Here comes the next customer with a ${itemName(st.customerItem, 'en')}. Let us tell them the price!`, 'excited', 'bounce');
        if (done) {
          r.pet(lang === 'bn'
            ? 'তিনজন ক্রেতা হয়ে গেল! আমরা দারুণ দোকানদার! আরেকজনকে ডাকি, নাকি একটা ছোট বিরতি নিই?'
            : 'Three customers served — we are great shop owners! Shall we call one more, or take a little break?', 'proud', 'bounce');
        }
        return r;
      }
      await customerSay(session, ctx, r, lang === 'bn' ? 'আপনাদের দোকান দারুণ! আবার আসব!' : 'Your shop is wonderful! I will come again!', raw || s);
      r.pet(lang === 'bn' ? 'ধন্যবাদ বললে ক্রেতা খুশি হয়! এখন পরের ক্রেতাকে ডাকি।' : 'A thank-you makes customers happy! Now let us call the next one.', 'happy');
      r.suggest(lang === 'bn' ? 'ধন্যবাদ, আবার আসবেন' : 'Thank you, come again', lang === 'bn' ? 'পরের ক্রেতা' : 'Next customer');
      return r;
    }
  }

  // -----------------------------------------------------------------
  // Chat while running the shop
  // -----------------------------------------------------------------
  if (/\b(bill|closed|close the shop|finished|all done|we are done|leave|lets leave|go home|break)\b/.test(s)) {
    r.pet(lang === 'bn' ? `আজকের মতো দোকান বন্ধ করি — ${st.customerServed || 0} জন ক্রেতাকে সাহায্য করলাম!` : `Let us close the shop for today — we helped ${st.customerServed || 0} customers!`, 'proud', 'bounce');
    r.event('sparkle').skill('greeting_politeness');
    r.suggest(lang === 'bn' ? 'চলো বাড়ি যাই' : 'Let us go home', lang === 'bn' ? 'আরেকজন ক্রেতা' : 'One more customer');
    return r;
  }
  if (/\b(what do you want|what would you like|what about you|and you|your order|what should we do|help|how do i play)\b/.test(s)) {
    r.pet(lang === 'bn'
      ? 'আমরা দোকানের মালিক! ক্রেতা যা এনেছেন তার দাম বলো, স্ক্যান করো, তারপর হাত বাড়িয়ে টাকা নাও।'
      : 'We are the shopkeepers! Tell the customer the price of their item, scan it, then hold out your hand for the money.', 'happy');
    r.suggest(lang === 'bn' ? 'দাম কত?' : 'How much is it?', lang === 'bn' ? 'স্ক্যান করো' : 'Scan it');
    return r;
  }
  if (/\b(how much|price|cost|taka|dollar|expensive|cheap)\b/.test(s) && st.customerItem) {
    const p = TAG_PRICE[st.customerItem] || 60;
    st.price = p;
    st.cashGiven = calcCashGiven(p);
    st.changeDue = Math.max(0, st.cashGiven - p);
    st.stage = 'payment';
    await customerSay(session, ctx, r, lang === 'bn' ? `${money(p, 'bn')}? ঠিক আছে, নেব!` : `${money(p, 'en')}? Okay, I will take it!`, raw || s);
    r.pet(lang === 'bn' ? `দাম ${money(p, 'bn')} — এবার পেমেন্ট নিই।` : `The price is ${money(p, 'en')} — now let us take payment.`, 'proud');
    r.suggest(lang === 'bn' ? 'টাকা নাও' : 'Take the money', lang === 'bn' ? 'ধন্যবাদ, আবার আসবেন' : 'Thank you, come again');
    return r;
  }
  if (items.length) {
    st.customerItem = items[0].key; st.tag = TAG_PRICE[st.customerItem] || 60; st.stage = 'customer_waiting';
    showCounterItem(session, st.customerItem);
    await customerSay(session, ctx, r, lang === 'bn'
      ? `আমি এই ${itemName(st.customerItem, 'bn')}টা চাই। দাম কত?`
      : `I would like this ${itemName(st.customerItem, 'en')}. How much is it?`, raw || s);
    r.pet(lang === 'bn' ? 'দাম বলে দাও!' : 'Tell them the price!', 'happy');
    r.suggest(lang === 'bn' ? `দাম ${money(st.tag, 'bn')}` : `It costs ${money(st.tag, 'en')}`);
    return r;
  }
  // gentle fallback
  r.pet(lang === 'bn'
    ? `ক্রেতা কাউন্টারে অপেক্ষা করছেন। দাম বলো, তারপর পেমেন্ট নাও।`
    : `A customer is waiting at the counter. Tell them the price, then take payment.`, 'thinking');
  r.suggest(lang === 'bn' ? `দাম ${money(st.tag || 60, 'bn')}` : `It costs ${money(st.tag || 60, 'en')}`, lang === 'bn' ? 'স্ক্যান করো' : 'Scan it');
  return r;
}
