import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARC_LIMIT, tokens, hasPast, hasCause, wordCount, Grammar } from '../../grammar.js';

test('ARC_LIMIT grows with the arc', () => {
  assert.deepEqual(ARC_LIMIT, { 1: 3, 2: 5, 3: 7, 4: 10, 5: 12 });
});

test('tokens: lower case words, no "\'s", no numbers', () => {
  assert.deepEqual(tokens("Buu's cat, 12 DOGS!"), ['buu', 'cat', 'dogs']);
  assert.deepEqual(tokens(''), []);
  assert.deepEqual(tokens('123 456'), []);
});

test('hasPast: irregular verbs and -ed words', () => {
  for (const t of ['It was Monday.', 'They went home.', 'She baked bread.', 'He was born in May.']) assert.equal(hasPast(t), true, t);
  for (const t of ['It is Monday.', 'The bed is red.', 'I need a seed.', 'One hundred cows.', '']) assert.equal(hasPast(t), false, t);
});

test('hasCause: because and so', () => {
  assert.equal(hasCause('I ran because it rained.'), true);
  assert.equal(hasCause('It rained, so I ran.'), true);
  assert.equal(hasCause('Soap is good.'), false);
  assert.equal(hasCause('I am sorry.'), false);
});

test('wordCount', () => {
  assert.equal(wordCount('One two  three.'), 3);
  assert.equal(wordCount('   '), 0);
  assert.equal(wordCount('21 May 2009.'), 3);
});

function fakeG(state = {}, arc) {
  let saves = 0;
  const G = {
    state: { questsDone: 0, ...state },
    quests: [{ arc: 1 }, { arc: 4 }, { arc: 5 }],
    quest: arc ? { q: { arc } } : null,
    persist: () => { saves++; },
  };
  return { G, saves: () => saves };
}

test('constructor adds default grammar state, keeps a saved one', () => {
  const a = fakeG();
  new Grammar(a.G);
  assert.deepEqual(a.G.state.grammar, { past: false, cause: false, streak: 0 });
  const saved = { past: true, cause: false, streak: 2 };
  const b = fakeG({ grammar: saved });
  assert.equal(new Grammar(b.G).s, saved);
});

test('arc(): current quest first, then the next quest by questsDone', () => {
  assert.equal(new Grammar(fakeG({}, 3).G).arc(), 3);
  assert.equal(new Grammar(fakeG({ questsDone: 1 }).G).arc(), 4);
  assert.equal(new Grammar(fakeG({ questsDone: 99 }).G).arc(), 5); // past the end: last quest
  assert.equal(new Grammar({ state: {}, persist() {} }).arc(), 1);  // no data
});

test('record: streak counts and resets', () => {
  const f = fakeG({}, 1);
  const g = new Grammar(f.G);
  g.record(true); g.record(true);
  assert.equal(g.s.streak, 2);
  g.record(false);
  assert.equal(g.s.streak, 0);
  assert.equal(f.saves(), 3);
});

test('record: past unlocks only in arc 4+, after 5 in a row', () => {
  const low = new Grammar(fakeG({}, 3).G);
  for (let i = 0; i < 10; i++) low.record(true);
  assert.equal(low.s.past, false);

  const g = new Grammar(fakeG({}, 4).G);
  for (let i = 0; i < 4; i++) g.record(true);
  assert.equal(g.s.past, false);
  g.record(true);
  assert.deepEqual(g.s, { past: true, cause: false, streak: 0 });
  for (let i = 0; i < 10; i++) g.record(true);
  assert.equal(g.s.cause, false, 'cause needs arc 5');
});

test('record: cause unlocks in arc 5 only after past', () => {
  const g = new Grammar(fakeG({}, 5).G);
  for (let i = 0; i < 5; i++) g.record(true);
  assert.deepEqual(g.s, { past: true, cause: false, streak: 0 });
  for (let i = 0; i < 5; i++) g.record(true);
  assert.deepEqual(g.s, { past: true, cause: true, streak: 0 });
  for (let i = 0; i < 7; i++) g.record(true);
  assert.equal(g.s.streak, 7); // nothing more to unlock
});

test('allows: locked forms are refused', () => {
  const g = new Grammar(fakeG().G);
  assert.equal(g.allows('It is Monday.'), true);
  assert.equal(g.allows('It was Monday.'), false);
  assert.equal(g.allows('I ran so I am hot.'), false);
  g.s.past = true;
  assert.equal(g.allows('It was Monday.'), true);
  assert.equal(g.allows('It is hot, so I swim.'), false);
  g.s.cause = true;
  assert.equal(g.allows('It was hot, so I swam.'), true);
});

test('pick: plain version until the form unlocks', () => {
  const g = new Grammar(fakeG().G);
  const plain = { who: 'buu', text: 'It is Monday.' };
  const past = { who: 'buu', text: 'It was Monday.', form: 'past', plain };
  const cause = { who: 'buu', text: 'It was hot, so I swam.', form: 'cause', plain };
  const normal = { who: 'buu', text: 'Hi.' };
  assert.equal(g.pick(normal), normal);
  assert.equal(g.pick(null), null);
  assert.equal(g.pick(undefined), undefined);
  assert.equal(g.pick(past), plain);
  assert.equal(g.pick(cause), plain);
  g.s.cause = true; // cause without past is still locked
  assert.equal(g.pick(cause), plain);
  g.s.past = true;
  assert.equal(g.pick(past), past);
  assert.equal(g.pick(cause), cause);
  // A form line with no plain version is said as it is.
  const noPlain = { who: 'buu', text: 'It was.', form: 'past' };
  g.s.past = false;
  assert.equal(g.pick(noPlain), noPlain);
});
