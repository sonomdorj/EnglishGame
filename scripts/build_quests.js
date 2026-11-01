// Builds quests.json: 50 quests in 5 arcs of 10.
//   node scripts/build_quests.js && node scripts/nicknames.js && node scripts/make_audio.js --ids-only
// Weekdays are computed with dates.js, never typed by hand.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { weekday, parseDate, formatDate, WEEKDAYS } from '../dates.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V = JSON.parse(fs.readFileSync(path.join(ROOT, 'villagers.json'), 'utf8'));
const first = id => V.find(v => v.id === id).name.split(' ')[0];

export const ARCS = ["The Baker's Lie", 'The Fake Birthday', "The Headmaster's Diary", 'The Wedding War', "Buu's Betrayal"];

// Seeded random, so the file is the same every time.
let seed = 20261101;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];

const usedDates = new Set();
function randomDate(y0, y1) {
  for (;;) {
    const y = y0 + Math.floor(rnd() * (y1 - y0 + 1)), m = 1 + Math.floor(rnd() * 12), d = 1 + Math.floor(rnd() * 28);
    const s = formatDate({ d, m, y });
    if (!usedDates.has(s)) { usedDates.add(s); return s; }
  }
}
const wd = s => { const p = parseDate(s); return weekday(p.d, p.m, p.y); };
const wrongDay = (real, k) => WEEKDAYS[(WEEKDAYS.indexOf(real) + k) % 7];

// ---------------- story data ----------------
// Each event: [a, b, liar ('a'|'b'), title, penalty, words, A lines, B lines]
// {A} = weekday said by A, {B} = weekday said by B, {D} = the date.

const ARC1 = [
  ['dulamsuren', 'batbayar', 'b', 'Bread Case', 'bread', ['bread', 'pay', 'coin'], ['Batbayar takes bread.', 'On {A}.', '{D}.'], ['Not true.', 'On {B}.']],
  ['ganbold', 'dulamsuren', 'b', 'Cake Case', 'cake', ['cake', 'sell', 'old'], ['Dulamsuren sells cake.', 'Old cake.', 'On {A}.', '{D}.'], ['Good cake.', 'On {B}.']],
  ['tsetseg', 'dulamsuren', 'b', 'Milk Case', 'milk', ['milk', 'cup', 'drink'], ['Dulamsuren takes milk.', 'On {A}.', '{D}.'], ['Not true.', 'On {B}.']],
  ['enkhjargal', 'dulamsuren', 'a', 'Egg Case', 'eggs', ['egg', 'hen', 'basket'], ['Dulamsuren takes eggs.', 'On {A}.', '{D}.'], ['I pay.', 'On {B}.']],
  ['batbayar', 'dulamsuren', 'b', 'Oven Case', 'iron', ['oven', 'fix', 'hot'], ['I fix oven.', 'On {A}.', '{D}.'], ['Oven is cold.', 'On {B}.']],
  ['dulamsuren', 'enkhjargal', 'a', 'Flour Case', 'flour', ['flour', 'wheat', 'bag'], ['Enkhjargal sells flour.', 'Old flour.', 'On {A}.', '{D}.'], ['Not old.', 'On {B}.']],
  ['oyunaa', 'dulamsuren', 'b', 'Coin Case', 'coins', ['coin', 'count', 'money'], ['Dulamsuren takes coins.', 'On {A}.', '{D}.'], ['Not true.', 'On {B}.']],
  ['dulamsuren', 'ganbold', 'a', 'Fish Case', 'fish', ['fish', 'net', 'lake'], ['Ganbold sells fish.', 'Old fish.', 'On {A}.', '{D}.'], ['Good fish.', 'On {B}.']],
  ['tsetseg', 'dulamsuren', 'b', 'Hat Case', 'hat', ['hat', 'black', 'head'], ['Dulamsuren takes hat.', 'On {A}.', '{D}.'], ['My hat.', 'On {B}.']],
  ['ganbold', 'dulamsuren', 'b', 'Fire Case', 'potatoes', ['fire', 'smoke', 'oven'], ['Fire in oven.', 'Dulamsuren sleeps.', 'On {A}.', '{D}.'], ['Not true.', 'On {B}.']],
];

const ARC2_ITEMS = [
  ['tsetseg', 'oyunaa', 'b', 'Cake Party', 'cake', ['party', 'birthday', 'cake'], 'Oyunaa has a party.', 'It is my birthday.'],
  ['batbayar', 'ganbold', 'a', 'Dog Party', 'fish', ['dog', 'party', 'happy'], 'Ganbold has a dog party.', 'My dog is happy.'],
  ['oyunaa', 'tsetseg', 'b', 'Kite Party', 'pencil', ['kite', 'sky', 'high'], 'Tsetseg has a kite party.', 'I like my kite.'],
  ['enkhjargal', 'batbayar', 'b', 'Ball Party', 'hammer', ['ball', 'kick', 'play'], 'Batbayar has a ball party.', 'It is my birthday.'],
  ['dulamsuren', 'enkhjargal', 'a', 'Hat Party', 'hat', ['hat', 'wear', 'red'], 'Enkhjargal has a hat party.', 'I like red hats.'],
  ['ganbold', 'tsetseg', 'b', 'Fish Party', 'book', ['fish', 'swim', 'river'], 'Tsetseg has a fish party.', 'I like fish.'],
  ['tsetseg', 'batbayar', 'a', 'Song Party', 'coin', ['song', 'sing', 'loud'], 'Batbayar sings at a party.', 'I sing every week.'],
  ['batbayar', 'dulamsuren', 'b', 'Tea Party', 'bread', ['tea', 'cup', 'hot'], 'Dulamsuren has a tea party.', 'It is my birthday.'],
  ['enkhjargal', 'oyunaa', 'a', 'Garden Party', 'apple', ['garden', 'flowers', 'grow'], 'Oyunaa has a garden party.', 'The flowers are nice.'],
  ['oyunaa', 'ganbold', 'b', 'Snow Party', 'shell', ['snow', 'cold', 'winter'], 'Ganbold has a snow party.', 'It is my birthday.'],
];

// Headmaster's diary: [other, headmaster is A?, liar, title, penalty, words, noun, verb phrase]
const ARC3_ITEMS = [
  ['tsetseg', true, 'a', 'Lamp Story', 'lamp', ['lamp', 'light', 'dark'], 'lamp', 'goes out'],
  ['batbayar', false, 'b', 'Clock Story', 'clock', ['clock', 'hour', 'late'], 'clock', 'is late'],
  ['ganbold', true, 'a', 'Key Story', 'key', ['key', 'lose', 'door'], 'key', 'is gone'],
  ['dulamsuren', false, 'a', 'Gate Story', 'bread', ['gate', 'open', 'close'], 'gate', 'is open'],
  ['oyunaa', true, 'a', 'Book Story', 'book', ['book', 'read', 'school'], 'book', 'is new'],
  ['enkhjargal', false, 'b', 'Chair Story', 'potato', ['chair', 'sit', 'old'], 'chair', 'is old'],
  ['tsetseg', true, 'b', 'Window Story', 'pen', ['window', 'open', 'cold'], 'window', 'is open'],
  ['ganbold', false, 'b', 'Garden Story', 'lantern', ['garden', 'grass', 'green'], 'garden', 'is green'],
  ['batbayar', true, 'a', 'Night Story', 'lantern', ['night', 'quiet', 'sleep'], 'night', 'is quiet'],
  ['oyunaa', false, 'a', 'Test Story', 'eraser', ['test', 'answer', 'question'], 'test', 'is long'],
];

// Wedding war: Tsetseg and Ganbold marry. Families fight about the days.
// [a, b, liar, title, penalty, words, [past, plain] event for A, [past, plain] for B]
const ARC4_ITEMS = [
  ['enkhjargal', 'ganbold', 'b', 'Wedding Cake', 'cake', ['wedding', 'cake', 'family'],
    ['Ganbold lost the wedding cake on {A}, {D}.', 'Ganbold loses the wedding cake on {A}, {D}.'],
    ['That is not true. I lost it on {B}.', 'That is not true. I lose it on {B}.']],
  ['tsetseg', 'batbayar', 'a', 'Wedding Song', 'hammer', ['song', 'sing', 'long'],
    ['Batbayar played a long song on {A}, {D}.', 'Batbayar plays a long song on {A}, {D}.'],
    ['I played one song. It was on {B}.', 'I play one song. It is on {B}.']],
  ['ganbold', 'dulamsuren', 'b', 'Wedding Bread', 'bread', ['bread', 'bake', 'oven'],
    ['Dulamsuren made the wedding bread on {A}, {D}.', 'Dulamsuren makes the wedding bread on {A}, {D}.'],
    ['I made the bread on {B}. I remember.', 'I bake the bread on {B}. I remember.']],
  ['oyunaa', 'enkhjargal', 'a', 'Wedding Hat', 'hat', ['hat', 'wear', 'family'],
    ['Enkhjargal lost my wedding hat on {A}, {D}.', 'Enkhjargal loses my wedding hat on {A}, {D}.'],
    ['I found your hat. That was on {B}.', 'I have your hat. That is on {B}.']],
  ['batbayar', 'tsetseg', 'b', 'Wedding Letter', 'pen', ['letter', 'write', 'name'],
    ['Tsetseg wrote the wedding letter on {A}, {D}.', 'Tsetseg writes the wedding letter on {A}, {D}.'],
    ['I wrote that letter on {B}. I remember.', 'I write that letter on {B}. I remember.']],
  ['dulamsuren', 'ganbold', 'a', 'Wedding Boat', 'fish', ['boat', 'lake', 'water'],
    ['Ganbold lost my boat on {A}, {D}.', 'Ganbold loses my boat on {A}, {D}.'],
    ['I found the boat on {B}. The lake was quiet.', 'I have the boat on {B}. The lake is quiet.']],
  ['tsetseg', 'enkhjargal', 'b', 'Wedding Garden', 'flour', ['garden', 'flowers', 'grow'],
    ['Mother went to the garden on {A}, {D}.', 'Mother goes to the garden on {A}, {D}.'],
    ['I went on {B}. The flowers were nice.', 'I go on {B}. The flowers are nice.']],
  ['ganbold', 'batbayar', 'a', 'Wedding Box', 'iron', ['metal', 'iron', 'fire'],
    ['Batbayar made a metal box on {A}, {D}.', 'Batbayar makes a metal box on {A}, {D}.'],
    ['I made it with fire on {B}.', 'I am making it with fire on {B}.']],
  ['enkhjargal', 'tsetseg', 'b', 'Wedding Rain', 'umbrella', ['rain', 'umbrella', 'wet'],
    ['It rained at the wedding on {A}, {D}.', 'Rain is at the wedding on {A}, {D}.'],
    ['Not true, Mother. It rained on {B}.', 'Not true, Mother. The rain is on {B}.']],
  ['oyunaa', 'ganbold', 'a', 'Wedding Night', 'shell', ['night', 'stars', 'party'],
    ['Ganbold went home on {A}, {D}.', 'Ganbold goes home on {A}, {D}.'],
    ['I went home on {B}. I saw the stars.', 'I go home on {B}. I look at the stars.']],
];

// Buu's betrayal: villagers say Buu tells them wrong days on purpose.
// [a, b, liar, title, penalty, words, A cause line [cause, plain], B cause line [cause, plain], A past line [past, plain]]
const ARC5_ITEMS = [
  ['dulamsuren', 'batbayar', 'b', 'Panda Lie', 'bread', ['panda', 'lie', 'truth'],
    ['Buu tells me the wrong day, so I lose my bread.', 'Buu tells me the wrong day. I lose my bread.'],
    ['I come late because Buu says the wrong day.', 'I come late. Buu says the wrong day.'],
    ['I went to the market on {A}, {D}.', 'I go to the market on {A}, {D}.']],
  ['ganbold', 'tsetseg', 'a', 'Panda Letter', 'pen', ['letter', 'secret', 'write'],
    ['Buu reads my letter, so everyone knows my secret.', 'Buu reads my letter. Everyone knows my secret.'],
    ['I am angry because the letter is a secret.', 'I am angry. The letter is a secret.'],
    ['Tsetseg read my letter on {A}, {D}.', 'Tsetseg reads my letter on {A}, {D}.']],
  ['enkhjargal', 'oyunaa', 'b', 'Panda Secret', 'kite', ['secret', 'whisper', 'hide'],
    ['Buu tells Oyunaa my secret, so she knows everything.', 'Buu tells Oyunaa my secret. She knows everything.'],
    ['I know it because Buu whispers it to me.', 'I know it. Buu whispers it to me.'],
    ['Oyunaa told the village on {A}, {D}.', 'Oyunaa tells the village on {A}, {D}.']],
  ['tsetseg', 'headmaster', 'b', 'Panda Bell', 'lantern', ['school', 'late', 'clock'],
    ['Buu moves the school clock, so the children are late.', 'Buu moves the school clock. The children are late.'],
    ['I am strict because the children must not be late.', 'I am strict. The children must not be late.'],
    ['The headmaster closed the school on {A}, {D}.', 'The headmaster closes the school on {A}, {D}.']],
  ['batbayar', 'ganbold', 'a', 'Panda Boat', 'fish', ['boat', 'river', 'lake'],
    ['Buu takes the boat, so Ganbold cannot fish.', 'Buu takes the boat. Ganbold cannot fish.'],
    ['I do not fish because the boat is not there.', 'I do not fish. The boat is not there.'],
    ['Ganbold came to my house on {A}, {D}.', 'Ganbold comes to my house on {A}, {D}.']],
  ['oyunaa', 'dulamsuren', 'b', 'Panda Cake', 'cake', ['cake', 'eat', 'hungry'],
    ['Buu eats the cake, so the baker is angry.', 'Buu eats the cake. The baker is angry.'],
    ['I am angry because the cake is for a party.', 'I am angry. The cake is for a party.'],
    ['Dulamsuren made a new cake on {A}, {D}.', 'Dulamsuren makes a new cake on {A}, {D}.']],
  ['ganbold', 'enkhjargal', 'a', 'Panda Key', 'key', ['key', 'door', 'lose'],
    ['Buu hides my key, so I sleep outside.', 'Buu hides my key. I sleep outside.'],
    ['I have the key because Buu gives it to me.', 'I have the key. Buu gives it to me.'],
    ['Enkhjargal opened my door on {A}, {D}.', 'Enkhjargal opens my door on {A}, {D}.']],
  ['tsetseg', 'batbayar', 'b', 'Panda Gate', 'iron', ['gate', 'fence', 'open'],
    ['Buu opens the gate, so the cows run away.', 'Buu opens the gate. The cows run away.'],
    ['I fix the gate because it is my job.', 'I fix the gate. It is my job.'],
    ['Batbayar fixed the gate on {A}, {D}.', 'Batbayar fixes the gate on {A}, {D}.']],
  ['enkhjargal', 'dulamsuren', 'a', 'Panda Garden', 'apple', ['garden', 'carrot', 'eat'],
    ['Buu eats my carrots, so my garden is empty.', 'Buu eats my carrots. My garden is empty.'],
    ['I see Buu in the garden, so I tell everyone.', 'I see Buu in the garden. I tell everyone.'],
    ['Dulamsuren saw Buu in my garden on {A}, {D}.', 'Dulamsuren sees Buu in my garden on {A}, {D}.']],
  ['oyunaa', 'headmaster', 'b', 'Panda Truth', 'book', ['truth', 'judge', 'fair'],
    ['Buu says sorry, so we forgive the silly panda.', 'Buu says sorry. We forgive the silly panda.'],
    ['I am the judge here because I am the headmaster.', 'I am the judge here. I am the headmaster.'],
    ['The headmaster wrote in his diary on {A}, {D}.', 'The headmaster writes in his diary on {A}, {D}.']],
];

// ---------------- builders ----------------
const L = (who, text, extra = {}) => ({ who, text, ...extra });
const past = (who, pastText, plainText) => ({ who, text: pastText, form: 'past', plain: { who, text: plainText } });
const cause = (who, causeText, plainText) => ({ who, text: causeText, form: 'cause', plain: { who, text: plainText } });

function fill(s, v) {
  return s.replace(/\{A\}/g, v.A).replace(/\{B\}/g, v.B).replace(/\{D\}/g, v.D).replace(/\{T\}/g, v.T || '');
}
function fillLine(l, v) {
  const out = { ...l, text: fill(l.text, v) };
  if (l.plain) out.plain = { ...l.plain, text: fill(l.plain.text, v) };
  return out;
}

function mentionLine(arc, who, title) {
  if (arc === 1) return L(who, `Like ${title}.`);
  if (arc === 2) return L(who, `Like the ${title}.`);
  if (arc === 3) return L(who, `This is like the ${title}.`);
  if (arc === 4) return L(who, `This is like the ${title} again.`);
  return L(who, `Remember the ${title}? This is the same.`);
}

function buuLines(arc, q, v) {
  const A = first(q.a), B = first(q.b), Lr = first(q.liar);
  const trapDate = q.trap.date, said = q.trap.said;
  if (arc === 1) return {
    announce: [L('buu', 'Next case.'), L('buu', `Meet ${A}.`), L('buu', `${trapDate}.`), L('buu', `${said}.`)],
    toB: [L('buu', `Meet ${B}.`)], wrongOrder: [L('buu', `First: ${A}.`)],
    ask: [L('buu', 'What day?'), L('buu', `${v.D}.`)],
    verdict: [L('buu', `${q.weekday}.`), L('buu', `Liar: ${Lr}.`)],
    take: [L('narrator', `You take ${q.penalty}.`)],
  };
  if (arc === 2) return {
    announce: [L('buu', 'Next case.'), L('buu', `Meet ${A}.`), L('buu', `${trapDate}: ${said}.`)],
    toB: [L('buu', `Next, meet ${B}.`)], wrongOrder: [L('buu', `First meet ${A}.`)],
    ask: [L('buu', 'What day is it?'), L('buu', `Date: ${v.D}.`)],
    verdict: [L('buu', `It is ${q.weekday}.`), L('buu', `${Lr} is the liar.`)],
    take: [L('narrator', `You take the ${q.penalty}.`)],
  };
  if (arc === 3) return {
    announce: [L('buu', 'Next case. The diary again.'), L('buu', `Meet ${A}.`), L('buu', `${trapDate} is a ${said}.`)],
    toB: [L('buu', `Next, meet ${B}.`)], wrongOrder: [L('buu', `First meet ${A}.`)],
    ask: [L('buu', `What day is ${v.D}?`)],
    verdict: [L('buu', `It is ${q.weekday}.`), L('buu', `${Lr} is the liar.`)],
    take: [L('narrator', `You take the ${q.penalty} from ${Lr}.`)],
  };
  return {
    announce: [L('buu', arc === 4 ? 'Next case. The family is angry.' : 'Next case. People are angry with me.'),
      L('buu', `Meet ${A}.`), past('buu', `${trapDate} was a ${said}.`, `${trapDate} is a ${said}.`)],
    toB: [L('buu', `Next, meet ${B}.`)], wrongOrder: [L('buu', `First meet ${A}.`)],
    ask: [past('buu', `What day was ${v.D}?`, `What day is ${v.D}?`)],
    verdict: [past('buu', `It was ${q.weekday}.`, `It is ${q.weekday}.`), L('buu', arc === 5 ? `${Lr} is the liar, not me.` : `${Lr} is the liar.`)],
    take: [L('narrator', `You take the ${q.penalty} from ${Lr}.`)],
  };
}

function build() {
  const quests = [];
  const ranges = { 1: [1990, 2024], 2: [1995, 2024], 3: [1980, 2020], 4: [2000, 2025], 5: [2010, 2026] };
  const add = (arc, i, spec) => {
    const id = quests.length + 1;
    const date = randomDate(...ranges[arc]);
    const real = wd(date);
    const wrong = wrongDay(real, 1 + Math.floor(rnd() * 6));
    const q = { id, arc, arcTitle: ARCS[arc - 1], title: `The ${spec.title}`, a: spec.a, b: spec.b,
      liar: spec.liar === 'a' ? spec.a : spec.b, date, weekday: real, penalty: spec.penalty, words: spec.words };
    const tDate = randomDate(1950, 2020), tReal = wd(tDate);
    q.trap = { date: tDate, weekday: tReal, said: wrongDay(tReal, 1 + Math.floor(rnd() * 6)) };
    const v = { A: spec.liar === 'a' ? wrong : real, B: spec.liar === 'b' ? wrong : real, D: date };
    const claimA = spec.claimA.map(l => fillLine(l, v));
    const claimB = spec.claimB.map(l => fillLine(l, v));
    // Villagers mention an earlier case by name.
    if (quests.length) {
      const earlier = pick(quests);
      claimA.push(mentionLine(arc, spec.a, earlier.title.replace(/^The /, '')));
    }
    q.lines = { ...buuLines(arc, q, v), claimA, claimB };
    quests.push(q);
  };

  ARC1.forEach(([a, b, liar, title, penalty, words, A, B], i) => add(1, i, {
    a, b, liar, title, penalty, words, claimA: A.map(t => L(a, t)), claimB: B.map(t => L(b, t)) }));
  ARC2_ITEMS.forEach(([a, b, liar, title, penalty, words, first, bLine], i) => add(2, i, {
    a, b, liar, title, penalty, words,
    claimA: [L(a, first), L(a, 'The party is on {A}.'), L(a, 'Date: {D}.')],
    claimB: [L(b, bLine), L(b, 'The party is on {B}.')] }));
  ARC3_ITEMS.forEach(([other, hmIsA, liar, title, penalty, words, noun, verb], i) => {
    const a = hmIsA ? 'headmaster' : other, b = hmIsA ? other : 'headmaster';
    const hm = hmIsA ? 'A' : 'B', ot = hmIsA ? 'B' : 'A';
    const hmLines = [`In my diary, the ${noun} ${verb}.`, `That is on {${hm}}.`, 'The date is {D}.'];
    const otLines = ['That is not right.', `The ${noun} ${verb} on {${ot}}.`];
    add(3, i, { a, b, liar, title, penalty, words,
      claimA: (hmIsA ? hmLines : otLines).map(t => L(a, t)), claimB: (hmIsA ? otLines : hmLines).map(t => L(b, t)) });
  });
  ARC4_ITEMS.forEach(([a, b, liar, title, penalty, words, aEv, bEv], i) => add(4, i, {
    a, b, liar, title, penalty, words,
    claimA: [past(a, ...aEv), L(a, 'Ask the village.')],
    claimB: [past(b, ...bEv)] }));
  ARC5_ITEMS.forEach(([a, b, liar, title, penalty, words, aCause, bCause, aPast], i) => add(5, i, {
    a, b, liar, title, penalty, words,
    claimA: [cause(a, ...aCause), past(a, ...aPast)],
    claimB: [cause(b, ...bCause), L(b, 'My day is {B}. That is the truth.')] }));
  return quests;
}

const quests = build();
fs.writeFileSync(path.join(ROOT, 'quests.json'), JSON.stringify(quests, null, 2) + '\n');
console.log(`quests.json: ${quests.length} quests`);
