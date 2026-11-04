import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Dialog } from '../../dialog.js';
import { CONFIG } from '../../config.js';
import { FakeElement } from './fake-dom.js';

// Voice stand-in: records lines; onStart runs at once (like a missing file).
function fakeVoice() {
  return {
    played: [], stopped: 0, replays: 0,
    play(line, onStart) { this.played.push(line.text); onStart?.(false); },
    replay() { this.replays++; },
    stop() { this.stopped++; },
  };
}

let root, voice, d, warn;
beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout'] });
  root = new FakeElement();
  root.hidden = true;
  voice = fakeVoice();
  d = new Dialog(root, voice, who => ({ buu: 'Buu', narrator: '' }[who] ?? who));
  warn = mock.method(console, 'warn', () => {});
});
afterEach(() => { mock.timers.reset(); mock.restoreAll(); });

const L = (text, who = 'buu') => ({ who, text });

test('starts closed', () => {
  assert.equal(d.open, false);
  assert.equal(d.current, null);
  assert.deepEqual(d.warnings, []);
});

test('say shows the first line, hides text, plays the voice', () => {
  d.say([L('Hi.'), L('Bye.')]);
  assert.equal(d.open, true);
  assert.equal(root.hidden, false);
  assert.equal(d.current.text, 'Hi.');
  assert.equal(d.queue.length, 1);
  assert.equal(d.nameEl.textContent, 'Buu');
  assert.equal(d.nameEl.hidden, false);
  assert.equal(d.textVisible, false);
  assert.deepEqual(voice.played, ['Hi.']);
});

test(`text appears ${CONFIG.textDelaySec} s after the voice starts`, () => {
  d.say([L('Hi.')]);
  mock.timers.tick(CONFIG.textDelaySec * 1000 - 1);
  assert.equal(d.textVisible, false);
  mock.timers.tick(1);
  assert.equal(d.textVisible, true);
  assert.ok(d.shownAt >= d.voiceStartAt);
});

test('a timer from an old line does not show the new line', () => {
  d.say([L('One.'), L('Two.')]);
  mock.timers.tick(500);
  d.next();
  mock.timers.tick(CONFIG.textDelaySec * 1000 - 500);
  assert.equal(d.current.text, 'Two.');
  assert.equal(d.textVisible, false);
  mock.timers.tick(500);
  assert.equal(d.textVisible, true);
});

test('empty name hides the name box', () => {
  d.say([L('Once upon a time.', 'narrator')]);
  assert.equal(d.nameEl.hidden, true);
});

test('text: HTML is escaped, *word* is bold', () => {
  d.say([L('A *cat* & <b>"dog"</b>.')]);
  assert.equal(d.textEl.innerHTML, 'A <b>cat</b> &amp; &lt;b&gt;&quot;dog&quot;&lt;/b&gt;.');
});

test('next goes through the queue; onDone runs after the last line', () => {
  const done = [];
  d.say([L('One.'), L('Two.')], () => done.push('a'));
  d.next();
  assert.equal(d.current.text, 'Two.');
  assert.deepEqual(done, []);
  d.next();
  assert.deepEqual(done, ['a']);
  assert.equal(d.open, false);
  assert.equal(root.hidden, true);
  assert.equal(voice.stopped, 1);
  assert.doesNotThrow(() => d.next()); // closed: nothing happens
});

test('onDone can start a new dialog', () => {
  d.say([L('One.')], () => d.say([L('Two.')]));
  d.next();
  assert.equal(d.current.text, 'Two.');
  assert.equal(root.hidden, false);
});

test('say while open: lines wait in the queue', () => {
  d.say([L('One.')]);
  d.say([L('Two.')]);
  assert.equal(d.current.text, 'One.');
  d.next();
  assert.equal(d.current.text, 'Two.');
});

test('empty or falsy lines: onDone at once, dialog stays closed', () => {
  let n = 0;
  d.say([], () => n++);
  d.say([null, undefined, false], () => n++);
  assert.equal(n, 2);
  assert.equal(d.open, false);
  d.say([null, L('Hi.'), undefined]);
  assert.equal(d.current.text, 'Hi.');
  assert.equal(d.queue.length, 0);
});

test('swap changes each line; the original is not changed', () => {
  const orig = L('Meet Batbayar.');
  d = new Dialog(root, voice, w => w, l => (l.text === 'Meet Batbayar.' ? L('Meet Iron Nose.') : l));
  d.say([orig]);
  assert.equal(d.current.text, 'Meet Iron Nose.');
  assert.equal(orig.text, 'Meet Batbayar.');
  assert.equal(orig.onDone, undefined);
});

test('Buu lines over 8 words give a warning', () => {
  d.say([L('One two three four five six seven eight.'), L('One two three four five six seven eight nine.'),
    L('One two three four five six seven eight nine ten.', 'oyunaa')]);
  assert.equal(d.warnings.length, 1);
  assert.match(d.warnings[0], /nine/);
  assert.equal(warn.mock.callCount(), 1);
});

test('replay: same line again, text hidden until the delay', () => {
  d.say([L('Hi.')]);
  mock.timers.tick(CONFIG.textDelaySec * 1000);
  assert.equal(d.textVisible, true);
  d.replay();
  assert.equal(d.textVisible, false);
  assert.deepEqual(voice.played, ['Hi.', 'Hi.']);
  mock.timers.tick(CONFIG.textDelaySec * 1000);
  assert.equal(d.textVisible, true);
});

test('replay when closed asks the voice to replay the last line', () => {
  d.replay();
  assert.equal(voice.replays, 1);
});

test('clear closes without onDone', () => {
  let n = 0;
  d.say([L('One.'), L('Two.')], () => n++);
  d.clear();
  assert.equal(d.open, false);
  assert.equal(d.queue.length, 0);
  assert.equal(root.hidden, true);
  mock.timers.tick(5000);
  assert.equal(n, 0);
  assert.equal(d.textVisible, false);
});
