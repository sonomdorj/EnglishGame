import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Learner, shuffle } from '../../learn.js';
import { readJSON } from './data.js';

// 4 words on each level 1-10: "w<level>_<n>".
const WORDS = [];
for (let l = 1; l <= 10; l++) for (let n = 0; n < 4; n++) WORDS.push({ word: `w${l}_${n}`, level: l, sentence: `A w${l}_${n}.` });

const make = (state = {}) => {
  let changes = 0;
  const L = new Learner(WORDS, state, () => changes++);
  return { L, s: state, changes: () => changes };
};

test('constructor fills defaults and keeps saved values', () => {
  const { L, s } = make();
  assert.deepEqual(s, { level: 1, known: [], correctStreak: 0, wrongStreak: 0, reuseNext: false });
  assert.equal(L.level, 1);
  assert.equal(L.byWord.get('w3_1').level, 3);
  const saved = make({ level: 7, known: ['w1_0'] });
  assert.equal(saved.L.level, 7);
  assert.deepEqual(saved.s.known, ['w1_0']);
  assert.doesNotThrow(() => new Learner(WORDS, {}).record(true)); // default onChange
});

test('5 correct in a row: level up, streak resets', () => {
  const { L, s, changes } = make();
  for (let i = 0; i < 4; i++) L.record(true);
  assert.equal(s.level, 1);
  L.record(true);
  assert.equal(s.level, 2);
  assert.equal(s.correctStreak, 0);
  assert.equal(changes(), 5);
});

test('a wrong answer breaks the correct streak', () => {
  const { L, s } = make();
  for (let i = 0; i < 4; i++) L.record(true);
  L.record(false);
  for (let i = 0; i < 4; i++) L.record(true);
  assert.equal(s.level, 1);
});

test('2 wrong in a row: level down and reuse known words next', () => {
  const { L, s } = make({ level: 5 });
  L.record(false);
  assert.equal(s.level, 5);
  L.record(false);
  assert.equal(s.level, 4);
  assert.equal(s.wrongStreak, 0);
  assert.equal(s.reuseNext, true);
});

test('a correct answer breaks the wrong streak', () => {
  const { L, s } = make({ level: 5 });
  L.record(false); L.record(true); L.record(false);
  assert.equal(s.level, 5);
});

test('level stays inside 1..10', () => {
  const lo = make();
  for (let i = 0; i < 10; i++) lo.L.record(false);
  assert.equal(lo.s.level, 1);
  const hi = make({ level: 10 });
  for (let i = 0; i < 20; i++) hi.L.record(true);
  assert.equal(hi.s.level, 10);
});

test('onRecord hook sees every answer', () => {
  const { L } = make();
  const seen = [];
  L.onRecord = ok => seen.push(ok);
  L.record(true); L.record(false);
  assert.deepEqual(seen, [true, false]);
});

test('pickWords: new words of the current level, marked known', () => {
  const { L, s, changes } = make({ level: 3 });
  const picked = L.pickWords(3);
  assert.equal(picked.length, 3);
  assert.ok(picked.every(w => w.level === 3));
  assert.equal(new Set(picked.map(w => w.word)).size, 3);
  assert.deepEqual([...s.known].sort(), picked.map(w => w.word).sort());
  assert.equal(changes(), 1);
});

test('pickWords: level used up, borrow from higher then lower levels', () => {
  const { L, s } = make({ level: 3, known: ['w3_0', 'w3_1', 'w3_2'] });
  const picked = L.pickWords(3);
  assert.equal(picked.filter(w => w.level === 3).length, 1);
  assert.equal(picked.filter(w => w.level === 4).length, 2);

  const top = make({ level: 10, known: ['w10_0', 'w10_1', 'w10_2', 'w10_3'] });
  assert.ok(top.L.pickWords(2).every(w => w.level === 9));
  assert.equal(s.reuseNext, false);
});

test('pickWords: every word known, known words come back', () => {
  const all = WORDS.map(w => w.word);
  const { L, s } = make({ level: 5, known: [...all] });
  const picked = L.pickWords(4);
  assert.equal(picked.length, 4);
  assert.equal(s.known.length, all.length, 'no duplicates added');
});

test('pickWords: reuseNext uses only known words, then clears', () => {
  const known = ['w1_0', 'w1_1', 'w2_0'];
  const { L, s } = make({ level: 6, known: [...known], reuseNext: true });
  const picked = L.pickWords(3);
  assert.deepEqual(picked.map(w => w.word).sort(), [...known].sort());
  assert.equal(s.reuseNext, false);
});

test('pickWords: reuseNext with too few known words uses new words', () => {
  const { L, s } = make({ level: 2, known: ['w1_0'], reuseNext: true });
  const picked = L.pickWords(3);
  assert.ok(picked.every(w => w.level === 2));
  assert.equal(s.reuseNext, false);
});

test('pickWords: unknown saved words are ignored', () => {
  const { L } = make({ level: 1, known: ['gone', 'w1_0', 'w1_1'], reuseNext: true });
  assert.deepEqual(L.pickWords(2).map(w => w.word).sort(), ['w1_0', 'w1_1']);
});

test('distractors: same level first, then levels next to it', () => {
  const { L } = make();
  const target = L.byWord.get('w5_0');
  const three = L.distractors(target, 3);
  assert.equal(three.length, 3);
  assert.ok(three.every(w => w.level === 5 && w.word !== 'w5_0'));
  const many = L.distractors(target, 20);
  assert.equal(many.length, 3 + 8); // 3 on level 5, 4 on level 4, 4 on level 6
  assert.ok(many.slice(3).every(w => w.level === 4 || w.level === 6));
  assert.ok(!many.some(w => w.word === 'w5_0'));
});

test('shuffle: same items, input not changed', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  const b = shuffle(a);
  assert.deepEqual(a, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.notEqual(a, b);
  assert.deepEqual([...b].sort(), a);
  assert.deepEqual(shuffle([]), []);
});

test('shuffle: every order is possible', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(shuffle([1, 2, 3]).join(''));
  assert.equal(seen.size, 6);
});

test('real words.json: 300 words, 30 per level, unique', () => {
  const words = readJSON('words.json');
  assert.equal(words.length, 300);
  assert.equal(new Set(words.map(w => w.word)).size, 300);
  for (let l = 1; l <= 10; l++) assert.equal(words.filter(w => w.level === l).length, 30, `level ${l}`);
  for (const w of words) assert.match(w.sentence, new RegExp(`\\b${w.word}`, 'i'), w.word);
});
