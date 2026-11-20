// World state: locations, objects, characters, roles, weather, time.
import * as L from './lexicon.js';

let idCounter = 1;
const nextId = () => `o${Date.now().toString(36)}${(idCounter++).toString(36)}`;

// Visual presets per location (used by the client renderer)
export const LOCATION_PRESETS = {
  home:       { sky: ['#fde68a', '#fbcfe8'], ground: '#f5d0a9', indoor: true, decor: ['🪟', '🖼️', '🪴', '🛋️'], label: 'Our Cozy Room' },
  restaurant: { sky: ['#fff7ed', '#fed7aa'], ground: '#d6b38a', indoor: true, decor: ['🪟', '🍽️', '🌿', '🕯️'], label: 'Sunny Side Restaurant' },
  shop:       { sky: ['#ecfeff', '#bae6fd'], ground: '#cbd5e1', indoor: true, decor: ['🛍️', '🏷️', '🧸', '👗', '📚'], label: 'Rainbow Mall' },
  hospital:   { sky: ['#f0fdf4', '#bbf7d0'], ground: '#e2e8f0', indoor: true, decor: ['🩺', '🪟', '🌿', '🛏️'], label: 'Kind Care Clinic' },
  stage:      { sky: ['#1e1b4b', '#4c1d95'], ground: '#7c2d12', indoor: true, decor: ['🎭', '🎤', '✨', '🎶'], label: 'Starlight Stage' },
  emergency:  { sky: ['#bfdbfe', '#dbeafe'], ground: '#86efac', indoor: false, decor: ['🌳', '🌳', '🪑', '🌼'], label: 'Green Park' },
  create:     { sky: ['#bae6fd', '#e0f2fe'], ground: '#bbf7d0', indoor: false, decor: [], label: 'Our Own World' },
  park:       { sky: ['#93c5fd', '#dbeafe'], ground: '#86efac', indoor: false, decor: ['🌳', '🌼', '🛝', '🌳'], label: 'Green Park' },
  beach:      { sky: ['#7dd3fc', '#e0f2fe'], ground: '#fde68a', indoor: false, water: true, decor: ['🌴', '⛱️', '🐚', '🌊'], label: 'Blue Sea Beach' },
  space:      { sky: ['#020617', '#1e1b4b'], ground: '#64748b', indoor: false, stars: true, decor: ['🪐', '⭐', '🌍', '☄️'], label: 'Outer Space' },
  garden:     { sky: ['#bfdbfe', '#f0fdf4'], ground: '#4ade80', indoor: false, decor: ['🌷', '🌻', '🦋', '🌹', '🐝'], label: 'Flower Garden' },
  school:     { sky: ['#fef9c3', '#dbeafe'], ground: '#fcd34d', indoor: true, decor: ['🏫', '📚', '✏️', '🎒'], label: 'Sunshine School' },
  forest:     { sky: ['#a7f3d0', '#d1fae5'], ground: '#166534', indoor: false, decor: ['🌲', '🌲', '🍄', '🦉', '🌲'], label: 'Whispering Forest' },
  castle:     { sky: ['#c7d2fe', '#fae8ff'], ground: '#a3a3a3', indoor: false, decor: ['🏰', '🚩', '🛡️', '👑'], label: 'Cloud Castle' },
  farm:       { sky: ['#fef3c7', '#bfdbfe'], ground: '#a3e635', indoor: false, decor: ['🚜', '🐄', '🌾', '🐔'], label: 'Happy Farm' },
  city:       { sky: ['#bfdbfe', '#e2e8f0'], ground: '#64748b', indoor: false, decor: ['🏢', '🏬', '🚌', '🛺', '🏢'], label: 'Big City' },
  underwater: { sky: ['#0369a1', '#38bdf8'], ground: '#fcd34d', indoor: false, water: true, decor: ['🐠', '🪸', '🐙', '🐚', '🫧'], label: 'Under the Sea' },
  mountain:   { sky: ['#bae6fd', '#f1f5f9'], ground: '#94a3b8', indoor: false, decor: ['⛰️', '🏔️', '🌲', '🦅'], label: 'Misty Mountain' },
  zoo:        { sky: ['#bfdbfe', '#fef9c3'], ground: '#bef264', indoor: false, decor: ['🦁', '🐘', '🦒', '🐒'], label: 'Friendly Zoo' },
  kitchen:    { sky: ['#fef3c7', '#fde68a'], ground: '#d4d4d8', indoor: true, decor: ['🍳', '🥘', '🧁', '🫖'], label: 'Little Kitchen' },
  party:      { sky: ['#fbcfe8', '#fde68a'], ground: '#c4b5fd', indoor: true, decor: ['🎈', '🎊', '🎂', '🎁', '🎈'], label: 'Birthday Party' },
  snow:       { sky: ['#e0f2fe', '#f8fafc'], ground: '#f1f5f9', indoor: false, snow: true, decor: ['⛄', '🌲', '❄️', '🏔️'], label: 'Snowy Land' },
  pirate:     { sky: ['#7dd3fc', '#bae6fd'], ground: '#92400e', indoor: false, water: true, decor: ['🏴‍☠️', '⚓', '🗺️', '🦜'], label: 'Pirate Ship' },
};

export function newWorld(location = 'home', lang = 'en') {
  const preset = LOCATION_PRESETS[location] || LOCATION_PRESETS.home;
  return {
    location,
    label: lang === 'bn' ? (L.LOCATIONS[location]?.bnLabel || preset.label) : preset.label,
    time: location === 'stage' || location === 'space' ? 'night' : 'day',
    weather: 'clear',
    colors: { room: null, sky: null, ground: null },
    objects: [],
    characters: [],
    roles: { child: 'friend', pet: 'friend' },
    petOutfit: null,
    petState: 'normal', // normal | sick | sleeping
    spotlight: false,
    version: 1,
  };
}

export function setLocation(world, location, lang) {
  const preset = LOCATION_PRESETS[location] || LOCATION_PRESETS.create;
  world.location = location;
  world.label = lang === 'bn' ? (L.LOCATIONS[location]?.bnLabel || preset.label) : preset.label;
  world.objects = [];
  world.characters = [];
  world.colors = { room: null, sky: null, ground: null };
  world.spotlight = false;
  world.time = location === 'stage' || location === 'space' ? 'night' : 'day';
  world.weather = location === 'snow' ? 'snow' : 'clear';
  if (location !== 'hospital' && location !== 'emergency') world.petState = 'normal';
  world.version++;
  return world;
}

export function setCustomLabel(world, label) {
  world.label = label;
  world.version++;
}

function randomSpot(world, size) {
  // x in percent (8..92), y in percent of ground area (0..100) -> renderer places on ground band
  const used = world.objects.map((o) => o.x);
  let x = 10 + Math.random() * 80;
  for (let i = 0; i < 8; i++) {
    const candidate = 10 + Math.random() * 80;
    if (!used.some((u) => Math.abs(u - candidate) < 9)) { x = candidate; break; }
  }
  const y = size === 'sky' ? 5 + Math.random() * 35 : 55 + Math.random() * 40;
  return { x: Math.round(x), y: Math.round(y) };
}

const SKY_OBJECTS = new Set(['star', 'moon', 'sun', 'cloud', 'rainbow', 'plane', 'helicopter', 'rocket', 'bird', 'butterfly', 'bee', 'kite', 'balloons', 'comet', 'planet', 'satellite', 'earth', 'snowflake', 'dragon', 'fairy']);

export function addObject(world, key, opts = {}) {
  const entry = L.OBJECTS[key] || L.SHOP_ITEMS[key] || L.FOODS[key];
  if (!entry) return null;
  const spot = randomSpot(world, SKY_OBJECTS.has(key) ? 'sky' : 'ground');
  const obj = {
    id: nextId(),
    key,
    name: opts.name || key,
    emoji: entry.emoji,
    x: opts.x ?? spot.x,
    y: opts.y ?? spot.y,
    size: opts.size || 'normal', // small | normal | big
    color: opts.color || null,
    sky: SKY_OBJECTS.has(key),
    isNew: true,
  };
  // never push out the restaurant's table / chef-window props (they are the clickable game board)
  const pinned = (o) => o.key === 'window' || /^Table \d$/.test(o.name || '');
  while (world.objects.length >= 24) {
    const i = world.objects.findIndex((o) => !pinned(o));
    if (i < 0) break;
    world.objects.splice(i, 1);
  }
  world.objects.push(obj);
  world.version++;
  return obj;
}

export function removeObjects(world, key) {
  const before = world.objects.length;
  world.objects = world.objects.filter((o) => o.key !== key);
  const removedChars = world.characters.filter((c) => c.key === key).length;
  world.characters = world.characters.filter((c) => c.key !== key);
  world.version++;
  return before - world.objects.length + removedChars;
}

export function addCharacter(world, key, opts = {}) {
  const entry = L.CHARACTERS[key] || L.OBJECTS[key];
  if (!entry) return null;
  const existing = world.characters.find((c) => c.key === key && !opts.allowDuplicate);
  if (existing) {
    existing.line = opts.line ?? existing.line;
    existing.isNew = true;
    world.version++;
    return existing;
  }
  const ch = {
    id: nextId(),
    key,
    name: opts.name || key,
    x: typeof opts.x === 'number' ? opts.x : undefined,
    y: typeof opts.y === 'number' ? opts.y : undefined,
    emoji: entry.emoji,
    role: opts.role || key,
    line: opts.line ?? entry.line ?? '',
    mood: 'happy',
    isNew: true,
  };
  if (typeof opts.color === 'string') ch.color = opts.color;   // each shop shopper gets their own shirt colour
  if (typeof opts.queue === 'number') ch.queue = opts.queue;   // the shop uses this for the line in front of the counter
  if (world.characters.length >= 6) world.characters.shift();
  world.characters.push(ch);
  world.version++;
  return ch;
}

export function clearNewFlags(world) {
  for (const o of world.objects) o.isNew = false;
  for (const c of world.characters) { c.isNew = false; }
}

export function setCharacterLine(world, key, line) {
  const c = world.characters.find((ch) => ch.key === key);
  if (c) { c.line = line; world.version++; }
  return c;
}

export function clearCharacterLines(world) {
  for (const c of world.characters) c.line = '';
}

export function setColor(world, target, colorKey) {
  const hex = L.COLORS[colorKey]?.hex || colorKey;
  if (target === 'sky') world.colors.sky = hex;
  else if (target === 'ground') world.colors.ground = hex;
  else world.colors.room = hex;
  world.version++;
}

export function setWeather(world, w) { world.weather = w; world.version++; }
export function setTime(world, t) { world.time = t; world.version++; }
export function setRoles(world, roles) { world.roles = { ...world.roles, ...roles }; world.version++; }
export function setOutfit(world, outfit) { world.petOutfit = outfit; world.version++; }
export function setPetState(world, s) { world.petState = s; world.version++; }

export function describeWorld(world) {
  const objs = world.objects.map((o) => o.name).slice(-6).join(', ');
  const chars = world.characters.map((c) => c.name).join(', ');
  return `location=${world.location}; time=${world.time}; weather=${world.weather}; objects=[${objs}]; characters=[${chars}]; roles child=${world.roles.child}, pet=${world.roles.pet}`;
}
