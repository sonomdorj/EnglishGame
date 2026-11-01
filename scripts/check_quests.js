// Checks quests.json. Exits 0 only if every rule holds.
//   node scripts/check_quests.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { weekday, parseDate } from '../dates.js';
import { ARC_LIMIT, hasPast, hasCause, tokens, wordCount } from '../grammar.js';
import { audioId } from '../audioid.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const quests = read('quests.json'), words = read('words.json'), people = read('villagers.json');
const ARCS = ["The Baker's Lie", 'The Fake Birthday', "The Headmaster's Diary", 'The Wedding War', "Buu's Betrayal"];

// Words already in words.json: the words and every word of their example sentences.
const vocab = new Set();
for (const w of words) for (const t of tokens(`${w.word} ${w.sentence}`)) vocab.add(t);
// Names and nicknames are not English words to learn. Numbers are not words.
const names = new Set(['buu']);
for (const p of people) {
  for (const t of tokens(`${p.name} ${p.father} ${p.mother}`)) names.add(t);
  for (const n of p.nicknames || []) for (const t of tokens(n)) names.add(t);
}

const errors = [];
const err = (q, msg) => errors.push(`quest ${q.id}: ${msg}`);

// Every line object in a quest, with its plain and nickname versions.
function linesOf(q) {
  const out = [];
  const add = (l, kind) => {
    out.push({ ...l, kind });
    if (l.plain) out.push({ ...l.plain, kind: 'plain', parentForm: l.form });
    for (const n of Object.values(l.nick || {})) out.push({ ...n, kind: 'nick', parentForm: l.form });
    for (const n of Object.values(l.plain?.nick || {})) out.push({ ...n, kind: 'nick-plain' });
  };
  for (const [k, list] of Object.entries(q.lines)) for (const l of list) add(l, k);
  return out;
}

if (quests.length !== 50) errors.push(`expected 50 quests, found ${quests.length}`);
const titles = [];
const stats = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };
quests.forEach((q, i) => {
  const arc = Math.floor(i / 10) + 1;
  if (q.arc !== arc) err(q, `arc ${q.arc}, expected ${arc}`);
  if (q.arcTitle !== ARCS[arc - 1]) err(q, `arc title "${q.arcTitle}"`);
  const limit = ARC_LIMIT[arc];
  const st = stats[arc];
  st.maxWords = st.maxWords || 0;

  // Dates and liar
  const p = parseDate(q.date);
  if (weekday(p.d, p.m, p.y) !== q.weekday) err(q, `weekday of ${q.date} is wrong`);
  const t = parseDate(q.trap.date);
  if (weekday(t.d, t.m, t.y) !== q.trap.weekday || q.trap.said === q.trap.weekday) err(q, 'trap is not a wrong weekday');
  const daysIn = list => list.map(l => (l.plain || l).text + ' ' + l.text).join(' ');
  const liarSide = q.liar === q.a ? 'claimA' : 'claimB', honestSide = q.liar === q.a ? 'claimB' : 'claimA';
  const W = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const said = side => W.filter(w => daysIn(q.lines[side]).includes(w));
  if (!said(honestSide).includes(q.weekday)) err(q, 'honest person does not say the true weekday');
  if (said(liarSide).includes(q.weekday) || !said(liarSide).length) err(q, 'liar does not say a wrong weekday');

  const lines = linesOf(q);
  let vocabHit = 0, vocabAll = 0;
  const unknown = new Set();
  for (const l of lines) {
    const n = wordCount(l.text);
    st.maxWords = Math.max(st.maxWords, n);
    if (n > limit) err(q, `line has ${n} words (arc ${arc} max ${limit}): "${l.text}"`);
    if (l.who === 'buu' && n > 8) err(q, `Buu line over 8 words: "${l.text}"`);
    if (l.audio !== audioId(l.who, l.text)) err(q, `missing or old audio id: "${l.text}"`);
    const past = hasPast(l.text), cause = hasCause(l.text);
    if (past) st.past = (st.past || 0) + 1;
    if (cause) st.cause = (st.cause || 0) + 1;
    // Past only from arc 4, because/so only from arc 5.
    if (past && arc < 4) err(q, `past tense before arc 4: "${l.text}"`);
    if (cause && arc < 5) err(q, `because/so before arc 5: "${l.text}"`);
    // A locked form must have a plain version without it.
    if (past && !['past'].includes(l.form) && !['past'].includes(l.parentForm)) err(q, `past tense line without form "past": "${l.text}"`);
    if (cause && l.form !== 'cause' && l.parentForm !== 'cause') err(q, `because/so line without form "cause": "${l.text}"`);
    if (l.form && (!l.plain || hasPast(l.plain.text) || hasCause(l.plain.text))) err(q, `plain version missing or not plain: "${l.text}"`);
    for (const tok of tokens(l.text)) {
      if (names.has(tok)) continue;
      vocabAll++;
      if (vocab.has(tok)) vocabHit++; else unknown.add(tok);
    }
  }
  const share = vocabHit / vocabAll;
  st.minShare = Math.min(st.minShare ?? 1, share);
  if (share < 0.9) err(q, `only ${(share * 100).toFixed(1)}% known words (new: ${[...unknown].join(', ')})`);

  // Mentions of past cases by name
  if (i > 0) {
    const all = [...q.lines.claimA, ...q.lines.claimB].map(l => l.text).join(' ');
    const core = titles.map(x => x.replace(/^The /, ''));
    if (!core.some(c => all.includes(c))) err(q, 'no villager mentions a past case by name');
  }
  titles.push(q.title);
});
if (new Set(titles).size !== titles.length) errors.push('case titles are not unique');

for (let a = 1; a <= 5; a++) {
  const s = stats[a];
  console.log(`arc ${a} ${ARCS[a - 1].padEnd(24)} max words ${String(s.maxWords).padStart(2)} / ${ARC_LIMIT[a]}  past lines ${String(s.past || 0).padStart(3)}  because/so lines ${String(s.cause || 0).padStart(3)}  min known words ${(s.minShare * 100).toFixed(1)}%`);
}
console.log(`quests: ${quests.length}`);
if (errors.length) {
  console.log(`FAILED: ${errors.length} problem(s)`);
  for (const e of errors) console.log('  ' + e);
  process.exit(1);
}
console.log('OK: all quest rules hold.');
