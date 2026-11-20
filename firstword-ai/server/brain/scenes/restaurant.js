// Restaurant scene: you and your pet are the servers, the chef works inside the house.
// Click a table -> camera zooms to the seated customer who says their order ->
// click the chef's window -> walk up and tell the chef -> collect the food -> serve the table.
import * as L from '../lexicon.js';
import * as W from '../world.js';
import { find, pick, isNegative, hasAny } from '../normalize.js';
import { createReply } from '../reply.js';
import * as qwen from '../qwen.js';

const CHEF = { key: 'waiter', name: 'Chef Rafi', bnName: 'শেফ রাফি', emoji: '🧑‍🍳' };
const CUSTOMER_ORDERS = ['burger', 'pizza', 'noodles', 'rice', 'chicken', 'juice', 'biryani', 'icecream', 'cake'];
const TABLE_SPOTS = { 1: [20, 72], 2: [80, 72], 3: [50, 65] };

const RESTAURANTS = ['Sunny Side Restaurant', 'Mango Tree Cafe', 'Happy Hippo Diner', 'Star Kitchen', 'Rooftop Rickshaw Restaurant'];
const MENU = ['rice', 'chicken', 'noodles', 'pizza', 'burger', 'biryani', 'fish', 'soup', 'cake', 'icecream', 'juice', 'milk', 'lemonade'];

function foodName(key, lang) {
  const f = L.FOODS[key];
  if (!f) return key;
  return lang === 'bn' ? f.bn[0] : f.en[0];
}

function listFoods(keys, lang) {
  const names = keys.map((k) => foodName(k, lang));
  if (names.length <= 1) return names[0] || '';
  if (lang === 'bn') return `${names.slice(0, -1).join(', ')} আর ${names[names.length - 1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

async function chefSay(r, text, lang, utterance = '', context = {}, clientKey = null) {
  let line = text;
  if (qwen.isRoleEnabled('restaurant_chef', lang, clientKey)) {
    const aiLine = await qwen.generateRoleReply({
      role: 'restaurant_chef',
      lang,
      utterance: utterance || text,
      clientKey,
      context: { chef: 'Chef Rafi', situation: text, ...context },
    });
    if (aiLine) line = aiLine;
  }
  r.char(CHEF.key, lang === 'bn' ? CHEF.bnName : CHEF.name, CHEF.emoji, line);
}

function tableLabel(st, lang) {
  return lang === 'bn' ? `টেবিল ${st.customerTable}` : `Table ${st.customerTable}`;
}

/** Add an object only once: reuse the existing one so clicks stay on the same 3D actor. */
function ensureObject(session, key, opts) {
  const found = (session.world.objects || []).find((o) => o.key === key && o.name === opts.name);
  if (found) {
    if (found.x !== opts.x || found.y !== opts.y) { found.x = opts.x; found.y = opts.y; session.world.version++; }
    return found;
  }
  return W.addObject(session.world, key, opts);
}

/** Place (or move) the seated customer at a table, the chef inside the house, and the pass window. */
function placeActors(session, lang) {
  const st = session.sceneState;
  const [tx, ty] = TABLE_SPOTS[st.customerTable] || TABLE_SPOTS[1];
  const cname = lang === 'bn' ? `টেবিল ${st.customerTable}-এর অতিথি` : `Customer at table ${st.customerTable}`;
  // The guest only speaks after the player taps the table (stage order_heard or later).
  const line = st.spoke
    ? (lang === 'bn' ? `আমি ${foodName(st.customerOrder, 'bn')} চাই।` : `I would like ${foodName(st.customerOrder, 'en')}, please.`)
    : (lang === 'bn' ? '…' : '…');
  const existing = (session.world.characters || []).find((c) => c.role === 'customer');
  if (existing) {
    existing.x = tx; existing.y = ty; existing.name = cname;
    if (line) existing.line = line;
    existing.isNew = true;
    session.world.version++;
  } else {
    W.addCharacter(session.world, 'friend', { name: cname, role: 'customer', x: tx, y: ty, line, allowDuplicate: true });
  }
  for (const t of Object.keys(TABLE_SPOTS)) {
    const [x, y] = TABLE_SPOTS[t];
    ensureObject(session, 'table', { x, y, name: `Table ${t}` });
  }
  // a second guest, quietly reading a menu at another table (so the room feels busy)
  const quietTable = st.customerTable === 3 ? 2 : 3;
  const [qx, qy] = TABLE_SPOTS[quietTable];
  const diner = (session.world.characters || []).find((c) => c.role === 'diner');
  const dname = lang === 'bn' ? `টেবিল ${quietTable}-এর অতিথি` : `Guest at table ${quietTable}`;
  if (diner) { diner.x = qx; diner.y = qy; diner.name = dname; session.world.version++; }
  else W.addCharacter(session.world, 'friend', { name: dname, role: 'diner', x: qx, y: qy, line: lang === 'bn' ? '…' : '…', allowDuplicate: true });
  ensureObject(session, 'window', { x: 80, y: 57, name: 'Chef window' });
}

/** Customer speaks, camera-ready line included. */
async function customerSays(session, ctx, r, text, utterance = '', context = {}) {
  const lang = ctx.lang;
  session.sceneState.spoke = true;
  placeActors(session, lang);
  let line = text;
  const clientKey = session?.clientKey || ctx?.clientKey || null;
  const childSpeech = utterance || ctx?.utterance || ctx?.raw || '';
  if (qwen.isRoleEnabled('restaurant_customer', lang, clientKey)) {
    const aiLine = await qwen.generateRoleReply({
      role: 'restaurant_customer',
      lang,
      utterance: childSpeech || text,
      clientKey,
      context: { table: session.sceneState?.customerTable, order: session.sceneState?.customerOrder, situation: text, ...context },
    });
    if (aiLine) line = aiLine;
  }
  r.char('customer', lang === 'bn' ? `টেবিল ${session.sceneState.customerTable}-এর অতিথি` : `Customer at table ${session.sceneState.customerTable}`, '🧒', line);
  return r;
}

export async function enter(session, ctx, carry = {}) {
  const { lang } = ctx;
  const r = createReply('enter_restaurant');
  let name = session.sceneState.restaurantName || RESTAURANTS[0];
  if (carry.another) name = RESTAURANTS[(RESTAURANTS.indexOf(name) + 1) % RESTAURANTS.length];
  session.sceneState = {
    stage: 'table_ready', table: null, orders: [], served: [], missing: [], petWish: null,
    restaurantName: name, asksAnswered: 0, customerTable: 1, customerOrder: pick(CUSTOMER_ORDERS),
    workflow: 'table-service', kitchenOrder: null, heardOrder: null, complaints: 0,
  };
  const st = session.sceneState;
  W.setCustomLabel(session.world, lang === 'bn' ? 'রেস্টুরেন্ট' : name);
  placeActors(session, lang);
  W.addCharacter(session.world, CHEF.key, {
    name: lang === 'bn' ? CHEF.bnName : CHEF.name, role: 'chef',
    line: lang === 'bn' ? 'রান্নাঘর প্রস্তুত!' : 'Kitchen is ready!',
  });
  await chefSay(r, lang === 'bn'
    ? `স্বাগতম ${name}-এ! আমি ভেতরে রান্নাঘরে আছি — জানালায় এসে অর্ডার বলো।`
    : `Welcome to ${name}! I stay inside the kitchen. Come to the window and tell me each order.`, lang);
  r.pet(lang === 'bn'
    ? `অতিথিরা টেবিলে বসে আছে, এখনো কেউ অর্ডার দেয়নি। যেকোনো টেবিলে ক্লিক করো — অতিথি নিজেই অর্ডার বলবে!`
    : `The guests are sitting at their tables and nobody has ordered yet. Tap a table — the customer will tell you their order!`, 'excited', 'bounce');
  r.suggest(lang === 'bn' ? 'টেবিল ১' : 'Table 1', lang === 'bn' ? 'টেবিল ২' : 'Table 2');
  return r;
}

export async function handle(session, n, ctx) {
  const { lang } = ctx;
  const st = session.sceneState;
  const s = n.norm;
  const foods = find.foods(n);
  const r = createReply('restaurant');

  // ---------------------------------------------------------------
  // Table-service game loop (click driven)
  // ---------------------------------------------------------------
  if (st.workflow === 'table-service') {
    const food = foods[0]?.key;
    const raw = n.raw || '';
    const tableClick = /^(table|click table|tap table|go to table|table \d+)/.test(s)
      || /(take (their|the|a) order|take order|next table|next customer|new customer|another table)/.test(s)
      || /টেবিল/.test(raw);
    const clickedTable = Number((/table\s*(\d+)/i.exec(s) || [])[1] || 0) || null;
    const windowClick = /^(chef window|click chef window|click window|tap window|window|go to window|kitchen window|chef)$/.test(s) || /chef.{0,12}window/.test(s) || /জানালা/.test(raw);

    // ---- serve the guest: the helper for "carrying food + tap the right table" ----
    const serveTable = (serving) => {
      if (serving && serving !== st.customerOrder) {
        st.stage = 'complaint';
        customerSays(session, ctx, r, lang === 'bn'
          ? `এটা তো আমি অর্ডার করিনি! আমি ${foodName(st.customerOrder, 'bn')} চেয়েছিলাম, আর তুমি ${foodName(serving, 'bn')} এনেছ।`
          : `Hmm, I did not order this. I asked for ${foodName(st.customerOrder, 'en')} — this is ${foodName(serving, 'en')}.`);
        r.pet(lang === 'bn' ? 'ওহ! ভুল খাবার চলে গেছে। দুঃখিত বলে ঠিক খাবারটা আনি।' : 'Oh! The wrong dish went out. Let us say sorry and bring the right one.', 'worried');
        r.suggest(lang === 'bn' ? 'দুঃখিত, সঠিক খাবার আনছি' : 'Sorry, I will bring the right order');
        return;
      }
      st.stage = 'returned'; st.served.push(st.customerOrder);
      customerSays(session, ctx, r, lang === 'bn'
        ? `ধন্যবাদ! ঠিক ${foodName(st.customerOrder, 'bn')} — একদম যা চেয়েছিলাম।`
        : `Thank you! ${foodName(st.customerOrder, 'en')} — exactly what I ordered.`);
      r.pet(lang === 'bn' ? 'সঠিক খাবার পৌঁছে গেছে! দারুণ দলগত কাজ!' : 'The right food is served! Great teamwork!', 'proud');
      r.suggest(lang === 'bn' ? 'পরের টেবিল' : 'Next table');
    };

    // ---- a table that is only being looked at (no order wanted from it yet) ----
    if (tableClick && !food && st.customerTable && Number((/table\s*(\d+)/i.exec(s) || [])[1] || 0) && Number((/table\s*(\d+)/i.exec(s) || [])[1]) !== st.customerTable
        && st.stage !== 'returned' && st.stage !== 'served') {
      const look = Number((/table\s*(\d+)/i.exec(s) || [])[1]);
      const busy = (session.world.characters || []).some((c) => c.role === 'diner' && (c.name || '').includes(String(look)));
      r.pet(lang === 'bn'
        ? `টেবিল ${look}-এ ${busy ? 'আরেকজন অতিথি বসে আছেন' : 'কেউ বসে নেই'} — এখন আমরা টেবিল ${st.customerTable}-এর অর্ডার নিচ্ছি। ওখানেই ফিরি!`
        : `Table ${look} ${busy ? 'has another guest sitting there' : 'is empty'} — right now we are taking table ${st.customerTable}'s order. Let us go back there!`, 'happy');
      r.suggest(lang === 'bn' ? `টেবিল ${st.customerTable}` : `Table ${st.customerTable}`);
      return r;
    }

    // ---- CLICK A TABLE: zoom in, hear the seated customer's order ----
    if (tableClick) {
      const wantsNext = !clickedTable && (/(next table|next customer|new customer|another table)/.test(s) || /পরের (টেবিল|অতিথি)/.test(raw));
      const t = clickedTable || (wantsNext ? (st.customerTable % 3) + 1 : st.customerTable);
      if (st.stage === 'ready_to_serve' || (st.stage === 'cooking' && t === st.customerTable && food)) {
        if (st.stage === 'cooking') {
          chefSay(r, lang === 'bn' ? `${foodName(st.kitchenOrder, 'bn')} তৈরি — জানালা থেকে নিয়ে যাও।` : `Your ${foodName(st.kitchenOrder, 'en')} is ready at the window — collect it first.`, lang);
          r.pet(lang === 'bn' ? 'আগে জানালা থেকে খাবারটা নিই!' : 'Let us grab the food from the window first!', 'happy');
          r.suggest(lang === 'bn' ? 'শেফের জানালা' : 'Chef window');
          return r;
        }
        if (t !== st.customerTable) {
          r.pet(lang === 'bn'
            ? `টেবিল ${t} এখনো অর্ডার দেয়নি — খাবারটা টেবিল ${st.customerTable}-এর। আগে সেখানে দিই!`
            : `Table ${t} did not order this — our food belongs to table ${st.customerTable}. Let us serve them first!`, 'thinking');
          r.suggest(lang === 'bn' ? `টেবিল ${st.customerTable}` : `Table ${st.customerTable}`);
          return r;
        }
        serveTable(food || st.kitchenOrder);
        return r;
      }
      if (st.stage === 'cooking') {
        chefSay(r, lang === 'bn' ? `${foodName(st.kitchenOrder, 'bn')} তৈরি হচ্ছে — জানালায় নিয়ে যাব।` : `Your ${foodName(st.kitchenOrder, 'en')} is on the stove — collect it at the window when it is ready.`, lang);
        r.pet(lang === 'bn' ? 'শেফ রান্না করছেন। জানালা থেকে খাবার নিয়ে তারপর টেবিলে দিই!' : 'Chef is cooking. We collect it at the window, then serve the table!', 'thinking');
        r.suggest(lang === 'bn' ? 'শেফের জানালা' : 'Chef window');
        return r;
      }
      if (st.stage === 'complaint') {
        customerSays(session, ctx, r, lang === 'bn'
          ? `আমি ${foodName(st.customerOrder, 'bn')} অর্ডার করেছিলাম, মনে আছে?`
          : `Remember? I ordered ${foodName(st.customerOrder, 'en')}.`);
        r.pet(lang === 'bn' ? 'দুঃখিত বলি আর ঠিক খাবারটা নিয়ে আসি।' : 'Let us say sorry and bring the right dish.', 'worried');
        r.suggest(lang === 'bn' ? 'দুঃখিত, সঠিক খাবার আনছি' : 'Sorry, I will bring the right order');
        return r;
      }
      if (st.stage === 'order_heard' && t === st.customerTable) {
        customerSays(session, ctx, r, lang === 'bn'
          ? `আমার অর্ডার: ${foodName(st.customerOrder, 'bn')}।`
          : `I asked for ${foodName(st.customerOrder, 'en')}.`);
        r.pet(lang === 'bn' ? 'অর্ডারটা আবার শুনলাম — এবার শেফের জানালায় বলি!' : 'Order heard again — now let us tell the chef at the window!', 'thinking');
        r.suggest(lang === 'bn' ? 'শেফের জানালা' : 'Chef window');
        return r;
      }
      if (st.stage === 'order_heard') {
        // tapping the same guest again: just repeat their order, the guest does not move
        customerSays(session, ctx, r, lang === 'bn'
          ? `আমার অর্ডার: ${foodName(st.customerOrder, 'bn')}। এখন শেফের জানালায় গিয়ে বলো!`
          : `I asked for ${foodName(st.customerOrder, 'en')}. Now tell the chef at the window!`);
        r.pet(lang === 'bn' ? 'অর্ডারটা আবার বললাম। এবার শেফের জানালায় যাই!' : 'Order repeated. Now let us tell the chef at the window!', 'thinking');
        r.suggest(lang === 'bn' ? 'শেফের জানালা' : 'Chef window', lang === 'bn' ? `শেফ, ${foodName(st.customerOrder, 'bn')}` : `Chef, ${foodName(st.customerOrder, 'en')}`);
        return r;
      }
      if (st.stage === 'returned' || st.stage === 'returning_food' || st.stage === 'served' || st.stage === 'closing') {
        st.customerTable = Math.max(1, Math.min(3, t));
        st.customerOrder = pick(CUSTOMER_ORDERS);
        st.stage = 'order_heard';
        customerSays(session, ctx, r, lang === 'bn'
          ? `আমি ${foodName(st.customerOrder, 'bn')} চাই।`
          : `I would like ${foodName(st.customerOrder, 'en')}, please.`);
        r.pet(lang === 'bn'
          ? `টেবিল ${st.customerTable}-এর অতিথি ${foodName(st.customerOrder, 'bn')} চেয়েছেন। এখন শেফের জানালায় গিয়ে বলি!`
          : `Table ${st.customerTable} would like ${foodName(st.customerOrder, 'en')}. Now tap the chef's window and tell Chef Rafi!`, 'thinking');
        r.suggest(lang === 'bn' ? 'শেফের জানালা' : 'Chef window', lang === 'bn' ? `শেফ, ${foodName(st.customerOrder, 'bn')}` : `Chef, ${foodName(st.customerOrder, 'en')}`);
        return r;
      }
      // table_ready or anything else: the seated guest says their order
      st.customerTable = Math.max(1, Math.min(3, t));
      st.customerOrder = pick(CUSTOMER_ORDERS);
      st.stage = 'order_heard';
      customerSays(session, ctx, r, lang === 'bn'
        ? `আমি ${foodName(st.customerOrder, 'bn')} চাই।`
        : `I would like ${foodName(st.customerOrder, 'en')}, please.`);
      r.pet(lang === 'bn'
        ? `অতিথির অর্ডার শুনলাম। এখন শেফের জানালায় ক্লিক করে অর্ডারটা বলি!`
        : `Order heard! Now tap the chef's window and tell Chef Rafi the order.`, 'thinking');
      r.suggest(lang === 'bn' ? 'শেফের জানালা' : 'Chef window');
      return r;
    }

    // ---- CLICK THE CHEF WINDOW: walk up and talk to the chef inside the house ----
    if (windowClick) {
      if (st.stage === 'order_heard' || st.stage === 'chef_mismatch' || st.stage === 'at_chef') {
        st.stage = 'at_chef';
        r.pet(lang === 'bn'
          ? `শেফের জানালায় এসে গেছি। শেফকে বলি: ${foodName(st.customerOrder, 'bn')}!`
          : `We are at the chef's window. Let us tell Chef Rafi: ${foodName(st.customerOrder, 'en')}!`, 'happy');
        chefSay(r, lang === 'bn' ? 'কী রান্না করব, বলো?' : 'What shall I cook for the table?', lang);
        r.suggest(lang === 'bn' ? foodName(st.customerOrder, 'bn') : foodName(st.customerOrder, 'en'), lang === 'bn' ? `শেফ, ${foodName(st.customerOrder, 'bn')}` : `Chef, ${foodName(st.customerOrder, 'en')}`);
        return r;
      }
      if (st.stage === 'cooking') {
        st.stage = 'ready_to_serve';
        chefSay(r, lang === 'bn' ? `${foodName(st.kitchenOrder, 'bn')} তৈরি! গরম গরম নিয়ে যাও।` : `Here is the ${foodName(st.kitchenOrder, 'en')} — fresh and hot!`, lang);
        r.pet(lang === 'bn' ? 'খাবার নিলাম! এবার টেবিলে নিয়ে যাই।' : 'We have the food! Let us take it to the table.', 'excited');
        r.suggest(lang === 'bn' ? `টেবিল ${st.customerTable}` : `Table ${st.customerTable}`);
        return r;
      }
      if (st.stage === 'ready_to_serve') {
        r.pet(lang === 'bn' ? 'খাবার হাতে আছে — আগে টেবিলে দিই!' : 'We are already carrying the food — let us serve the table first!', 'happy');
        r.suggest(lang === 'bn' ? `টেবিল ${st.customerTable}` : `Table ${st.customerTable}`);
        return r;
      }
      if (st.stage === 'complaint') {
        chefSay(r, lang === 'bn' ? 'দুশ্চিন্তা না করে জানালা থেকে ঠিক খাবারটা নাও।' : 'No worries — collect the right dish at the window and try again.', lang);
        st.stage = 'ready_to_serve';
        r.pet(lang === 'bn' ? `এবার সঠিক ${foodName(st.customerOrder, 'bn')} নিয়ে যাই!` : `Let us take the correct ${foodName(st.customerOrder, 'en')} this time!`, 'happy');
        r.suggest(lang === 'bn' ? `টেবিল ${st.customerTable}` : `Table ${st.customerTable}`);
        return r;
      }
      chefSay(r, lang === 'bn' ? 'আমি ভেতরে রান্নাঘরে আছি — আগে টেবিলে ক্লিক করে অতিথির অর্ডার নিয়ে এসো!' : 'I am inside the kitchen! First tap a table, hear the guest’s order, then come tell me.', lang);
      r.pet(lang === 'bn' ? 'আগে টেবিলে ক্লিক করে অর্ডার নিই।' : 'Let us tap a table and take an order first.', 'thinking');
      r.suggest(lang === 'bn' ? 'টেবিল ১' : 'Table 1');
      return r;
    }

    // ---- TELL THE CHEF THE ORDER (talking at the window) ----
    if (st.stage === 'at_chef' || st.stage === 'chef_mismatch') {
      if (food) {
        if (food === st.customerOrder) {
          st.heardOrder = food; st.kitchenOrder = food; st.stage = 'cooking'; st.chefMisses = 0;
          chefSay(r, lang === 'bn' ? `${foodName(food, 'bn')} — একদম ঠিক অর্ডার! রান্না শুরু করছি।` : `${foodName(food, 'en')} — that is the right order! Cooking it now.`, lang);
          r.pet(lang === 'bn' ? 'শেফ রান্না করছেন। তৈরি হলে জানালা থেকে নিয়ে টেবিলে দিই!' : 'Chef Rafi is cooking. When it is ready we collect it at the window and serve the table!', 'excited', 'bounce');
          r.suggest(lang === 'bn' ? 'শেফের জানালা' : 'Chef window');
          return r;
        } else {
          st.chefMisses = (st.chefMisses || 0) + 1;
          if (st.chefMisses >= 3) {
            st.heardOrder = st.customerOrder; st.kitchenOrder = st.customerOrder; st.stage = 'cooking';
            chefSay(r, lang === 'bn' ? `দারুণ চেষ্টা! আমি টেবিল ${st.customerTable}-এর জন্য ${foodName(st.customerOrder, 'bn')} রান্না করছি।` : `You did your best! Let us make ${foodName(st.customerOrder, 'en')} for table ${st.customerTable}. Cooking now!`, lang);
            r.pet(lang === 'bn' ? 'শেফ রান্না শুরু করেছেন!' : 'Chef Rafi is cooking it now!', 'excited', 'bounce');
            r.suggest(lang === 'bn' ? 'শেফের জানালা' : 'Chef window');
            return r;
          }
          st.stage = 'chef_mismatch';
          if (st.chefMisses === 2) {
            chefSay(r, lang === 'bn' ? `অতিথি চেয়েছেন ${foodName(st.customerOrder, 'bn')}। বলো: ${foodName(st.customerOrder, 'bn')}!` : `The guest asked for ${foodName(st.customerOrder, 'en')}. You can say: ${foodName(st.customerOrder, 'en')}!`, lang);
          } else {
            chefSay(r, lang === 'bn'
              ? `একটু ভাবো — অতিথি ${foodName(st.customerOrder, 'bn')} চেয়েছেন। আবার বলো।`
              : `Careful — the guest at table ${st.customerTable} asked for ${foodName(st.customerOrder, 'en')}. Think again and tell me that order.`, lang);
          }
          r.pet(lang === 'bn' ? `শেফকে বলো: ${foodName(st.customerOrder, 'bn')}!` : `Tell the chef: ${foodName(st.customerOrder, 'en')}!`, 'thinking');
          r.suggest(lang === 'bn' ? foodName(st.customerOrder, 'bn') : foodName(st.customerOrder, 'en'));
          return r;
        }
      } else if (n.tokens.length >= 1 && !windowClick) {
        st.chefMisses = (st.chefMisses || 0) + 1;
        if (st.chefMisses >= 3) {
          st.heardOrder = st.customerOrder; st.kitchenOrder = st.customerOrder; st.stage = 'cooking';
          chefSay(r, lang === 'bn' ? `দারুণ চেষ্টা! আমি টেবিল ${st.customerTable}-এর জন্য ${foodName(st.customerOrder, 'bn')} রান্না করছি।` : `You tried your best! I will cook the ${foodName(st.customerOrder, 'en')}. On the stove now!`, lang);
          r.pet(lang === 'bn' ? 'শেফ রান্না শুরু করেছেন!' : 'Chef Rafi started cooking!', 'excited', 'bounce');
          r.suggest(lang === 'bn' ? 'শেফের জানালা' : 'Chef window');
          return r;
        }
        st.stage = 'chef_mismatch';
        if (st.chefMisses === 2) {
          chefSay(r, lang === 'bn' ? `তুমি বলতে পারো: ${foodName(st.customerOrder, 'bn')}!` : `You can say: ${foodName(st.customerOrder, 'en')}!`, lang);
        } else {
          chefSay(r, lang === 'bn' ? `টেবিল ${st.customerTable}-এর অতিথি কী চেয়েছেন? অর্ডারটা বলো!` : `What did table ${st.customerTable} want? Tell me the dish name!`, lang);
        }
        r.pet(lang === 'bn' ? `শেফকে বলো: ${foodName(st.customerOrder, 'bn')}!` : `Tell the chef: ${foodName(st.customerOrder, 'en')}!`, 'thinking');
        r.suggest(lang === 'bn' ? foodName(st.customerOrder, 'bn') : foodName(st.customerOrder, 'en'));
        return r;
      }
    }

    // ---- Say sorry on complaint ----
    if (st.stage === 'complaint' && n.tokens.length >= 1) {
      st.stage = 'ready_to_serve';
      customerSays(session, ctx, r, lang === 'bn'
        ? `ধন্যবাদ দুঃখিত বলার জন্য! ঠিক আছে, এবার সঠিক ${foodName(st.customerOrder, 'bn')} এনে দাও।`
        : `Thank you for saying sorry! That is totally okay. Please bring the right ${foodName(st.customerOrder, 'en')}.`);
      chefSay(r, lang === 'bn'
        ? `এখানে তোমার সঠিক ${foodName(st.customerOrder, 'bn')} — টেবিলে দাও।`
        : `Here is the correct ${foodName(st.customerOrder, 'en')} — go ahead and serve the table!`, lang);
      r.pet(lang === 'bn' ? 'দুঃখিত বলে খুব সুন্দর করে ঠিক করলে! চলো খাবারটা দিই।' : 'Saying sorry was so polite! Let us deliver the food to the table.', 'happy');
      r.suggest(lang === 'bn' ? `টেবিল ${st.customerTable}` : `Table ${st.customerTable}`);
      return r;
    }

    // ---- Any spoken attempt asks the guest if at table_ready/returned ----
    if ((st.stage === 'table_ready' || st.stage === 'returned' || st.stage === 'served') && n.tokens.length >= 1 && !windowClick) {
      st.customerTable = st.customerTable || 1;
      st.customerOrder = pick(CUSTOMER_ORDERS);
      st.stage = 'order_heard';
      customerSays(session, ctx, r, lang === 'bn'
        ? `আমি ${foodName(st.customerOrder, 'bn')} চাই।`
        : `I would like ${foodName(st.customerOrder, 'en')}, please.`);
      r.pet(lang === 'bn'
        ? `অতিথির অর্ডার শুনলাম! এখন শেফের জানালায় গিয়ে বলো: ${foodName(st.customerOrder, 'bn')}!`
        : `Order heard! Now tell Chef Rafi at the window: ${foodName(st.customerOrder, 'en')}!`, 'thinking');
      r.suggest(lang === 'bn' ? 'শেফের জানালা' : 'Chef window');
      return r;
    }

    // ---- serve by talking (no click): "serve the table" while carrying food ----
    if (st.stage === 'ready_to_serve') {
      serveTable(food || st.kitchenOrder);
      return r;
    }

    // ---- the guest is served: walk back to the dining area and pick the next table ----
    if (st.stage === 'returned' || st.stage === 'returning_food' || st.stage === 'served') {
      if (st.stage === 'returned') { st.stage = 'served'; }
      r.pet(lang === 'bn'
        ? 'গেস্ট খুশি! এখন আরেকটা টেবিলে ক্লিক করে পরের অর্ডার নিই।'
        : 'The guest is happy! Now tap another table to take the next order.', 'happy', 'bounce');
      r.suggest(lang === 'bn' ? 'পরের টেবিল' : 'Next table', lang === 'bn' ? 'বিল দাও' : 'The bill, please');
      return r;
    }

    // ---- chat about the order while it is not yet heard ----
    if (st.stage === 'order_heard' && !food) {
      r.pet(lang === 'bn'
        ? `টেবিল ${st.customerTable} কিছুক্ষণ অপেক্ষা করছে — শেফের জানালায় গিয়ে ${foodName(st.customerOrder, 'bn')} বলি!`
        : `Table ${st.customerTable} is waiting — let us go to the chef's window and order ${foodName(st.customerOrder, 'en')}!`, 'thinking');
      r.suggest(lang === 'bn' ? 'শেফের জানালা' : 'Chef window');
      return r;
    }
    if (st.stage === 'complaint' && !food) {
      r.pet(lang === 'bn' ? 'দুঃখিত বলে ঠিক খাবারটা নিয়ে আসি।' : 'Let us say sorry and bring the right dish.', 'worried');
      r.suggest(lang === 'bn' ? 'দুঃখিত, সঠিক খাবার আনছি' : 'Sorry, I will bring the right order');
      return r;
    }
  }

  // ---------------------------------------------------------------
  // Free chat at the restaurant
  // ---------------------------------------------------------------

  // "what should we do" helper
  if (/^(help|what do i do|what now|what next|how do i play)$/.test(s)) {
    r.pet(lang === 'bn'
      ? 'টেবিলে ক্লিক করো → অতিথির অর্ডার শোনো → শেফের জানালায় ক্লিক করো → শেফকে অর্ডার বলো → খাবার নিয়ে টেবিলে দাও।'
      : 'Tap a table to hear the order, tap the chef window to tell Chef Rafi, then serve the food to the table.', 'happy');
    return r;
  }

  // Leave / another restaurant
  if (/\b(another restaurant|different restaurant|other restaurant|new restaurant|other place to eat)\b/.test(s)) {
    const next = RESTAURANTS[(RESTAURANTS.indexOf(st.restaurantName) + 1) % RESTAURANTS.length];
    session.sceneState = { restaurantName: next };
    const e = enter(session, ctx);
    e.intent = 'restaurant_switch';
    e.speech.unshift({ who: 'pet', text: lang === 'bn' ? 'আচ্ছা, অন্য রেস্টুরেন্টে যাই!' : `Okay! Let us try ${next} instead!` });
    e.petText = `${lang === 'bn' ? 'আচ্ছা, অন্য রেস্টুরেন্টে যাই!' : `Okay! Let us try ${next} instead!`} ${e.petText}`;
    e.skill('changing_mind');
    return e;
  }
  if (/\b(bill|pay|check please|finished|done eating|finished eating|all done|we are done|leave|lets leave)\b/.test(s)) {
    st.stage = 'closing';
    chefSay(r, lang === 'bn' ? 'আজকের কাজ শেষ! সব অতিথি খুশি।' : 'That is the shift done! Every guest is happy.', lang);
    r.pet(lang === 'bn' ? 'কী মজার দিন! এরপর কোথায় যাব?' : 'What a fun day of serving! Where should we go next?', 'happy', 'bounce');
    r.event('sparkle').skill('greeting_politeness');
    r.suggest(lang === 'bn' ? 'চলো দোকানে যাই' : 'Let us go to the shop', lang === 'bn' ? 'চলো বাড়ি যাই' : 'Let us go home');
    return r;
  }

  // Ask pet what it wants
  if (/\b(what do you want|what would you like|what do you want to eat|what about you|and you|you want|what will you have|do you want anything|your order)\b/.test(s)) {
    const wish = st.petWish || pick(['icecream', 'cake', 'mango', 'noodles', 'juice']);
    st.petWish = wish;
    r.pet(lang === 'bn'
      ? `তুমি জিজ্ঞেস করলে! আমি ${foodName(wish, 'bn')} খেতে চাই। শিফট শেষে খাব, এখন অতিথিদের খাবার দিই!`
      : `Aww, you asked me! I would love some ${foodName(wish, 'en')}. After our shift, though — guests first!`, 'love', 'bounce');
    r.skill('asking_questions');
    r.suggest(lang === 'bn' ? `আমার বন্ধুর জন্য ${foodName(wish, 'bn')}` : `${foodName(wish, 'en')} for my friend, please`);
    return r;
  }

  // Missing item at a table
  if (/\b(missing|where is my|did not get|did not come|have not got|not here|forgot my|still waiting|not come yet|is not here)\b/.test(s) || (/\bwhere is the\b/.test(s) && foods.length)) {
    const item = foods[0]?.key || st.customerOrder || 'water';
    customerSays(session, ctx, r, lang === 'bn' ? `আমার ${foodName(item, 'bn')} এখনো আসেনি।` : `My ${foodName(item, 'en')} has not arrived yet.`);
    r.pet(lang === 'bn' ? 'দুঃখিত! জানালায় গিয়ে দেখি — সমস্যা বলতে পারা দারুণ ব্যাপার।' : 'Sorry about that! Let us check at the window — telling someone when something is missing is a big, brave thing.', 'proud');
    r.skill('describing', 'requesting');
    return r;
  }

  // Questions about food
  if (/\b(what do you have|what is there|menu|what can i eat|what food|is there|do you have|have you got|what is in|what is .* made of|how is the)\b/.test(s) || /\bis (it|the|this|that|your) .*\b(spicy|sweet|hot|cold|good|tasty|yummy|fresh|big|small)\b/.test(s)) {
    st.asksAnswered = (st.asksAnswered || 0) + 1;
    if (foods.length) {
      const f = foods[0].key;
      chefSay(r, lang === 'bn' ? `${foodName(f, 'bn')} — আজকের মেনুতে দারুণ!` : `${foodName(f, 'en')}? Yes — it is on today's menu and very tasty!`, lang);
      r.pet(lang === 'bn' ? 'অর্ডার করার আগে জিজ্ঞেস করা খুব ভালো কাজ!' : 'Asking first is a great idea!', 'proud');
      r.skill('asking_questions');
      return r;
    }
    const menu = listFoods(MENU.slice(0, 6), lang);
    chefSay(r, lang === 'bn' ? `আজকের মেনু: ${menu}.` : `Today we have ${menu}. What would you like?`, lang);
    r.pet(lang === 'bn' ? 'মেনু থেকে বেছে নাও!' : 'Pick something you like!', 'happy');
    r.skill('asking_questions');
    return r;
  }

  // The child ordering for themselves / the pet
  if (foods.length) {
    const keys = foods.map((f) => f.key);
    st.orders.push(...keys);
    st.heardOrder = keys[0];
    chefSay(r, lang === 'bn' ? `${listFoods(keys, 'bn')}! চমৎকার পছন্দ, এখনই বানাচ্ছি।` : `${listFoods(keys, 'en')}! Lovely choice — coming right up.`, lang);
    r.pet(lang === 'bn' ? `${listFoods(keys, 'bn')}? দারুণ পছন্দ!` : `${listFoods(keys, 'en')}? Yummy choice!`, 'excited', 'bounce');
    r.skill('requesting');
    return r;
  }

  // Negative / change mind
  if (isNegative(n) && st.orders.length) {
    st.orders.pop();
    chefSay(r, lang === 'bn' ? 'কোনো সমস্যা নেই, অন্য কিছু নেবে?' : 'No problem at all — would you like something else?', lang);
    r.pet(lang === 'bn' ? 'বদলাতে চাইলে বলো, কিছুই সমস্যা না।' : 'You can always change your mind. That is totally okay!', 'happy');
    r.skill('changing_mind');
    return r;
  }

  // Fallback: gentle, role-aware
  chefSay(r, lang === 'bn' ? 'আমি ভেতরে রান্নাঘরে আছি — জানালায় ক্লিক করে অর্ডারটা বলো!' : 'I am in the kitchen — tap the window and tell me the order!', lang);
  r.pet(lang === 'bn'
    ? `টেবিলে ক্লিক করো, তারপর শেফের জানালায়। ${st.customerTable ? `টেবিল ${st.customerTable} এখনো অপেক্ষা করছে!` : ''}`
    : `Tap a table, then the chef's window. ${st.customerTable ? `Table ${st.customerTable} is still waiting!` : ''}`, 'thinking');
  r.suggest(lang === 'bn' ? 'টেবিল ১' : 'Table 1', lang === 'bn' ? 'শেফের জানালা' : 'Chef window');
  if (ctx.lang === 'bn') r.skill('turn_taking');
  return r;
}
