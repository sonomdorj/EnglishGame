import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeG, data, pickOption, pickerOptions } from './fake-game.js';
import { QuestRunner } from '../../quest.js';
import { WEEKDAYS } from '../../dates.js';
import { FETCH_WORDS } from '../../world.js';
import { CONFIG } from '../../config.js';
import { withRandom } from './data.js';

function setup(over = {}, state = {}) {
  const G = makeG(over);
  Object.assign(G.state, state);
  G.quest = new QuestRunner(G);
  return G;
}
const wrongDay = d => WEEKDAYS[(WEEKDAYS.indexOf(d) + 1) % 7];

// Starts quest number questsDone and plays up to the stage `until`.
function playTo(G, until) {
  const Q = G.quest;
  Q.timer = 0;
  Q.update(0.1);
  G.dialog.finish();
  const q = Q.q;
  if (until === 'toA') return q;
  Q.talkVillager(q.a); G.dialog.finish();
  if (until === 'toB') return q;
  Q.talkVillager(q.b); G.dialog.finish();
  if (until === 'ask') return q;
  pickOption(G, q.weekday); G.dialog.finish();
  if (until === 'take') return q;
  Q.talkVillager(q.liar); G.dialog.finish();
  return q;
}

test('starts idle; the intro plays once, then the first case starts', () => {
  const G = setup({}, { introDone: false });
  const Q = G.quest;
  assert.equal(Q.stage, 'idle');
  Q.update(0.1);
  assert.equal(Q.stage, 'intro');
  assert.deepEqual(G.dialog.said, data.buu.intro);
  G.dialog.finish();
  assert.equal(G.state.introDone, true);
  assert.equal(Q.stage, 'idle');
  assert.equal(Q.timer, 0);
  Q.update(0.1);
  assert.equal(Q.stage, 'toA');
  assert.equal(Q.q, data.quests[0]);
});

test('does not start before the game starts, or while a dialog or panel is open', () => {
  const G = setup();
  const Q = G.quest;
  Q.timer = 0;
  G.started = false;
  Q.update(1);
  assert.equal(Q.stage, 'idle');
  G.started = true;
  G.dialog.say([{ who: 'buu', text: 'x' }]);
  Q.update(1);
  assert.equal(Q.stage, 'idle');
  G.dialog.finish();
  G.picker.open({ title: 't', options: [] });
  Q.update(1);
  assert.equal(Q.stage, 'idle');
  G.picker.close();
  Q.update(1);
  assert.equal(Q.stage, 'toA');
});

test('waits for the timer between cases', () => {
  const G = setup();
  const Q = G.quest;
  Q.timer = 2;
  Q.update(1.5);
  assert.equal(Q.stage, 'idle');
  Q.update(0.6);
  assert.equal(Q.stage, 'toA');
});

test('no case after the last one', () => {
  const G = setup({}, { questsDone: data.quests.length });
  G.quest.timer = 0;
  G.quest.update(1);
  assert.equal(G.quest.stage, 'idle');
  G.quest.talkBuu();
  assert.equal(G.dialog.last, data.buu.noMore);
});

test('start: announce lines, new words picked, trap armed', () => {
  const G = setup();
  const q = playTo(G, 'toA');
  assert.deepEqual(G.dialog.said, q.lines.announce);
  assert.equal(G.quest.newWords.length, q.words.length);
  assert.equal(G.quest.trapActive, true);
  assert.equal(G.quest.trapCaught, false);
  assert.deepEqual(G.quest.answers, { correct: 0, wrong: 0 });
});

test('talking to B first: "first meet A"', () => {
  const G = setup();
  const q = playTo(G, 'toA');
  G.dialog.reset();
  assert.equal(G.quest.talkVillager(q.b), true);
  assert.ok(G.dialog.said.includes(q.lines.wrongOrder[0]));
  assert.equal(G.quest.stage, 'toA');
});

test('talking to someone not in the case is not handled', () => {
  const G = setup();
  const q = playTo(G, 'toA');
  const other = Object.keys(G.villagerData).find(id => id !== q.a && id !== q.b);
  assert.equal(G.quest.talkVillager(other), false);
  assert.ok(!G.state.met.includes(other), 'not handled: the introduction is left for main.js');
  const idle = setup();
  assert.equal(idle.quest.talkVillager('oyunaa'), false, 'no quest yet');
  assert.deepEqual(idle.state.met, []);
});

test('A: intro (first meeting), claim, first half of the words; then Buu says meet B', () => {
  const G = setup();
  const q = playTo(G, 'toA');
  G.dialog.reset();
  G.quest.talkVillager(q.a);
  const intro = G.villagerData[q.a]?.lines.intro || [];
  const half = Math.ceil(G.quest.newWords.length / 2);
  assert.deepEqual(G.dialog.said.slice(0, intro.length + q.lines.claimA.length), [...intro, ...q.lines.claimA]);
  assert.equal(G.dialog.said.filter(l => l.who === 'word').length, half);
  G.dialog.finish();
  assert.equal(G.quest.stage, 'toB');
  assert.deepEqual(G.dialog.said.slice(-q.lines.toB.length), q.lines.toB);
  // Second visit: no intro again.
  G.dialog.reset();
  G.quest.talkVillager(q.a);
  assert.deepEqual(G.dialog.said, q.lines.claimA);
});

test('B: claim, other words, then the weekday question with 7 buttons', () => {
  const G = setup();
  const q = playTo(G, 'toB');
  G.dialog.reset();
  G.quest.talkVillager(q.b);
  const words = G.dialog.said.filter(l => l.who === 'word').length;
  assert.equal(words, G.quest.newWords.length - Math.ceil(G.quest.newWords.length / 2));
  G.dialog.finish();
  assert.equal(G.quest.stage, 'ask');
  assert.ok(G.dialog.said.some(l => l === q.lines.ask[0]));
  assert.equal(G.picker.isOpen, true);
  assert.equal(G.picker.titleEl.textContent, q.date);
  assert.deepEqual(pickerOptions(G), WEEKDAYS);
});

test('ask: the claims can be heard again', () => {
  const G = setup();
  const q = playTo(G, 'ask');
  G.dialog.reset();
  G.quest.talkVillager(q.a);
  G.quest.talkVillager(q.b);
  assert.deepEqual(G.dialog.said, [...q.lines.claimA, ...q.lines.claimB]);
});

test('wrong weekday: "No.", panel stays, counted wrong', () => {
  const G = setup();
  const q = playTo(G, 'ask');
  pickOption(G, wrongDay(q.weekday));
  assert.equal(G.dialog.last, data.buu.no);
  assert.equal(G.picker.isOpen, true);
  assert.equal(G.quest.stage, 'ask');
  assert.deepEqual(G.quest.answers, { correct: 0, wrong: 1 });
  assert.equal(G.state.wrongStreak, 1);
});

test('right weekday: panel closes, verdict, liar holds the penalty item', () => {
  const G = setup();
  const q = playTo(G, 'ask');
  G.dialog.reset();
  pickOption(G, q.weekday);
  assert.equal(G.picker.isOpen, false);
  assert.equal(G.quest.stage, 'take');
  assert.deepEqual(G.dialog.said, q.lines.verdict);
  const liar = q.liar === 'headmaster' ? G.headmaster.npc : G.villagers[q.liar];
  assert.equal(typeof liar.item, 'number');
  assert.deepEqual(G.quest.answers, { correct: 1, wrong: 0 });
});

test('item colors follow the penalty name', () => {
  const G = setup();
  const q = playTo(G, 'take'); // quest 1: bread
  assert.equal(q.penalty, 'bread');
  assert.equal(G.villagers[q.liar].item, 0xc98a3e);
  const unknown = setup();
  const qq = { ...data.quests[0], penalty: 'mystery thing' };
  unknown.quests = [qq];
  playTo(unknown, 'take');
  assert.equal(unknown.villagers[qq.liar].item, 0xffffff);
});

test('Buu repeats the task in every stage', () => {
  const G = setup();
  G.quest.talkBuu();
  assert.equal(G.dialog.last, data.buu.wait);
  G.dialog.finish();
  const q = playTo(G, 'toA');
  G.quest.talkBuu();
  assert.equal(G.dialog.last, data.buu.talkTo[q.a]);
  G.quest.talkVillager(q.a); G.dialog.finish();
  G.quest.talkBuu();
  assert.equal(G.dialog.last, data.buu.talkTo[q.b]);
  G.quest.talkVillager(q.b); G.dialog.finish();
  G.picker.close();
  G.quest.talkBuu();
  G.dialog.finish();
  assert.equal(G.picker.isOpen, true, 'ask: the panel opens again');
  pickOption(G, q.weekday); G.dialog.finish();
  G.quest.talkBuu();
  assert.equal(G.dialog.last, q.lines.verdict[1]);
});

test('ask lines finishing after the stage changed do not reopen the panel', () => {
  const G = setup();
  playTo(G, 'ask');
  G.picker.close();
  G.quest.talkBuu();       // ask lines queued
  G.quest.stage = 'take';  // stage moved on before they end
  G.dialog.finish();
  assert.equal(G.picker.isOpen, false);
});

test('take: penalty item to the player, catch counted, then fetch', () => {
  const G = setup();
  const q = playTo(G, 'take');
  G.dialog.reset();
  assert.equal(G.quest.talkVillager(q.liar), true);
  assert.deepEqual(G.dialog.said.slice(-q.lines.take.length), q.lines.take);
  G.dialog.finish();
  assert.deepEqual(G.state.items, [q.penalty]);
  assert.equal(G.villagers[q.liar].item, null);
  assert.deepEqual(G.power.caught, [q.liar]);
  assert.equal(G.quest.stage, 'fetch');
  assert.ok(FETCH_WORDS.includes(G.quest.fetchWord));
  assert.equal(G.spawned.length, 1);
  assert.equal(G.spawned[0].length, 3);
  assert.ok(G.spawned[0].includes(G.quest.fetchWord));
  assert.equal(new Set(G.spawned[0]).size, 3);
  assert.equal(G.dialog.last, data.buu.bring[G.quest.fetchWord]);
  assert.ok(G.state.known.includes(G.quest.fetchWord));
});

test('fetch: empty hands, wrong thing, right thing', () => {
  const G = setup();
  playTo(G, 'fetch');
  const Q = G.quest;
  G.dialog.reset();
  Q.talkBuu();
  assert.equal(G.dialog.last, data.buu.bring[Q.fetchWord]);
  G.carrying = FETCH_WORDS.find(w => w !== Q.fetchWord);
  Q.talkBuu();
  assert.equal(G.dropped, 1);
  assert.deepEqual(G.dialog.said.slice(-2), [data.buu.no, data.buu.bring[Q.fetchWord]]);
  assert.equal(Q.answers.wrong, 1);
  G.carrying = Q.fetchWord;
  G.dialog.reset();
  Q.talkBuu();
  assert.equal(G.cleared, 1);
  assert.equal(Q.stage, 'done');
  assert.deepEqual(G.dialog.said, [data.buu.correctNext]);
  G.dialog.finish();
  assert.equal(G.state.questsDone, 1);
  assert.equal(Q.stage, 'idle');
  assert.equal(Q.q, null);
  assert.equal(Q.timer, CONFIG.nextCaseDelaySec);
  assert.deepEqual(G.reports, [{ quest: 1, answers: { correct: 2, wrong: 1 } }]);
});

test('the last case ends with "all closed"', () => {
  const G = setup({}, { questsDone: data.quests.length - 1 });
  playTo(G, 'fetch');
  G.carrying = G.quest.fetchWord;
  G.quest.talkBuu();
  G.dialog.reset();
  G.dialog.finish();
  assert.equal(G.state.questsDone, data.quests.length);
  assert.deepEqual(G.dialog.said, data.buu.allClosed);
});

test('chooseFetchWord: a fetch word from this case first', () => {
  const G = setup();
  playTo(G, 'toA');
  G.quest.newWords = [{ word: 'zzz' }, { word: 'kite' }];
  assert.equal(G.quest.chooseFetchWord(), 'kite');
});

test('chooseFetchWord: else a new fetch word at or below the level', () => {
  const G = setup();
  playTo(G, 'toA');
  G.quest.newWords = [];
  const level = w => G.learner.byWord.get(w).level;
  for (let i = 0; i < 30; i++) {
    const w = G.quest.chooseFetchWord();
    assert.ok(level(w) <= G.learner.level && !G.state.known.includes(w), w);
  }
  // All low words known: a known one at the level comes back.
  const low = FETCH_WORDS.filter(w => level(w) <= G.learner.level);
  G.state.known.push(...low);
  assert.ok(low.includes(G.quest.chooseFetchWord()));
  // Level filter finds nothing: any fetch word.
  G.learner.s.level = 0;
  assert.ok(FETCH_WORDS.includes(G.quest.chooseFetchWord()));
});

test('trap (F): no case, right answer, wrong answer, already caught', () => {
  const G = setup();
  G.quest.trapKey();
  assert.equal(G.dialog.last, data.buu.nothingWrong);
  G.dialog.finish();
  const q = playTo(G, 'toA');
  G.quest.trapKey();
  assert.equal(G.picker.titleEl.textContent, q.trap.date);
  pickOption(G, wrongDay(q.trap.weekday));
  assert.equal(G.dialog.last, data.buu.no);
  assert.equal(G.quest.trapCaught, false);
  pickOption(G, q.trap.weekday);
  assert.equal(G.dialog.last, data.buu.silly);
  assert.equal(G.quest.trapCaught, true);
  assert.equal(G.quest.trapActive, false);
  G.quest.trapKey();
  assert.equal(G.dialog.last, data.buu.caughtAlready);
});

test('trap is off after the case ends', () => {
  const G = setup();
  playTo(G, 'fetch');
  G.carrying = G.quest.fetchWord;
  G.quest.talkBuu();
  G.dialog.finish();
  G.quest.trapKey();
  assert.equal(G.dialog.last, data.buu.nothingWrong);
});

test('word lines: example sentence with the word in stars', () => {
  const G = setup({}, { questsDone: 40 }); // arc 5: long sentences allowed
  G.state.grammar = { past: true, cause: true, streak: 0 };
  playTo(G, 'toA');
  G.quest.newWords = [{ word: 'cat', sentence: 'The cat sleeps on the bed.', audio: 'a', sentenceAudio: 's' }];
  assert.deepEqual(G.quest.wordLines(0), [{ who: 'word', text: 'The *cat* sleeps on the bed.', audio: 's' }]);
  assert.deepEqual(G.quest.wordLines(1), []);
  G.quest.newWords = [{ word: 'run', sentence: 'Running is fun.', sentenceAudio: 's' }];
  assert.equal(G.quest.wordLines(0)[0].text, '*Run*ning is fun.', 'case kept');
  G.quest.newWords = [{ word: 'x.y', sentence: 'No match here.', sentenceAudio: 's' }];
  assert.equal(G.quest.wordLines(0)[0].text, 'No match here.', 'regex chars escaped');
});

test('word lines: only the word when the sentence is too long or uses locked grammar', () => {
  const G = setup(); // arc 1: max 3 words
  playTo(G, 'toA');
  G.quest.newWords = [{ word: 'cat', sentence: 'The cat sleeps on the bed.', audio: 'a', sentenceAudio: 's' }];
  assert.deepEqual(G.quest.wordLines(0), [{ who: 'word', text: '*cat*', audio: 'a' }]);
  const H = setup({}, { questsDone: 40 });
  playTo(H, 'toA');
  H.quest.newWords = [{ word: 'cat', sentence: 'The cat jumped.', audio: 'a', sentenceAudio: 's' }];
  assert.equal(H.quest.wordLines(0)[0].text, '*cat*', 'past still locked');
});

test('word lines split: first half to A, rest to B', () => {
  const G = setup();
  playTo(G, 'toA');
  G.quest.newWords = ['a', 'b', 'c', 'd', 'e'].map(w => ({ word: w, sentence: w, audio: w, sentenceAudio: w }));
  assert.deepEqual(G.quest.wordLines(0).map(l => l.text), ['*a*', '*b*', '*c*']);
  assert.deepEqual(G.quest.wordLines(1).map(l => l.text), ['*d*', '*e*']);
});

test('the headmaster as liar gets the item', () => {
  const idx = data.quests.findIndex(q => q.liar === 'headmaster');
  assert.ok(idx >= 0);
  const G = setup({}, { questsDone: idx });
  playTo(G, 'take');
  assert.equal(typeof G.headmaster.npc.item, 'number');
  G.quest.talkVillager('headmaster');
  G.dialog.finish();
  assert.equal(G.headmaster.npc.item, null);
  assert.equal(G.quest.stage, 'fetch');
});

test('every quest can be played to the end', () => {
  const G = setup();
  withRandom([0.37, 0.71, 0.13, 0.92, 0.55], () => {
    for (let i = 0; i < data.quests.length; i++) {
      playTo(G, 'fetch');
      G.carrying = G.quest.fetchWord;
      G.quest.talkBuu();
      G.dialog.finish();
      assert.equal(G.state.questsDone, i + 1);
    }
  });
  assert.equal(G.reports.length, 50);
  assert.ok(G.reports.every(r => r.answers.wrong === 0 && r.answers.correct === 2));
});
