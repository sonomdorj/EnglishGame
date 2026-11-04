import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Voice } from '../../audio.js';
import { audioId } from '../../audioid.js';

// Fake HTMLAudioElement. play() returns what `nextPlay` says.
class FakeAudio {
  constructor() { this.paused = true; this.src = ''; this.currentTime = 5; this.plays = 0; FakeAudio.last = this; }
  pause() { this.paused = true; }
  play() { this.plays++; this.paused = false; return FakeAudio.nextPlay?.(); }
}
beforeEach(() => { globalThis.Audio = FakeAudio; FakeAudio.nextPlay = () => Promise.resolve(); });

const line = { who: 'buu', text: 'Next case.' };
const id = audioId('buu', 'Next case.');

test('constructor', () => {
  const v = new Voice();
  assert.equal(v.el.preload, 'auto');
  assert.equal(v.available.size, 0);
  assert.equal(v.last, null);
  assert.deepEqual(v.log, []);
});

test('load: manifest lists the files', async () => {
  globalThis.fetch = async url => { assert.equal(url, 'audio_manifest.json'); return { ok: true, json: async () => ['a', 'b'] }; };
  const v = new Voice();
  await v.load();
  assert.deepEqual([...v.available], ['a', 'b']);
});

test('load: bad response or network error = no audio', async () => {
  globalThis.fetch = async () => ({ ok: false, json: async () => ['x'] });
  const v = new Voice();
  await v.load();
  assert.equal(v.available.size, 0);
  globalThis.fetch = async () => { throw new Error('offline'); };
  await assert.doesNotReject(v.load());
  assert.equal(v.available.size, 0);
});

test('idFor: stored id first, else computed (narrator by default)', () => {
  const v = new Voice();
  assert.equal(v.idFor({ who: 'buu', text: 'x', audio: 'given' }), 'given');
  assert.equal(v.idFor(line), id);
  assert.equal(v.idFor({ text: 'Hello.' }), audioId('narrator', 'Hello.'));
});

test('play without a file: onStart(false) at once, nothing loaded', () => {
  const v = new Voice();
  const calls = [];
  v.play(line, ok => calls.push(ok));
  assert.deepEqual(calls, [false]);
  assert.equal(v.el.plays, 0);
  assert.equal(v.el.src, '');
  assert.equal(v.last, line);
  assert.deepEqual(v.log, [id]);
  assert.doesNotThrow(() => v.play(line)); // no callback
});

test('play with a file: src set, onStart(true) once when playing', () => {
  const v = new Voice();
  v.available.add(id);
  const calls = [];
  v.play(line, ok => calls.push(ok));
  assert.equal(v.el.src, `audio/${id}.mp3`);
  assert.equal(v.el.currentTime, 0);
  assert.equal(v.el.plays, 1);
  assert.deepEqual(calls, []);
  v.el.onplaying();
  v.el.onplaying();
  v.el.onerror();
  assert.deepEqual(calls, [true]);
});

test('play: a load error still starts the text', () => {
  const v = new Voice();
  v.available.add(id);
  const calls = [];
  v.play(line, ok => calls.push(ok));
  v.el.onerror();
  assert.deepEqual(calls, [true]);
});

test('play: a refused play() (autoplay) still starts the text', async () => {
  FakeAudio.nextPlay = () => Promise.reject(new Error('NotAllowedError'));
  const v = new Voice();
  v.available.add(id);
  const calls = [];
  v.play(line, ok => calls.push(ok));
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(calls, [true]);
});

test('play: old browsers where play() returns nothing', () => {
  FakeAudio.nextPlay = () => undefined;
  const v = new Voice();
  v.available.add(id);
  assert.doesNotThrow(() => v.play(line));
});

test('log keeps the last 300 ids', () => {
  const v = new Voice();
  for (let i = 0; i < 310; i++) v.play({ who: 'buu', text: `L${i}` });
  assert.equal(v.log.length, 300);
  assert.equal(v.log[0], audioId('buu', 'L10'));
  assert.equal(v.log.at(-1), audioId('buu', 'L309'));
});

test('replay plays the last line again; nothing before the first line', () => {
  const v = new Voice();
  v.replay();
  assert.deepEqual(v.log, []);
  v.play(line);
  const calls = [];
  v.replay(ok => calls.push(ok));
  assert.deepEqual(v.log, [id, id]);
  assert.deepEqual(calls, [false]);
});

test('stop pauses the element', () => {
  const v = new Voice();
  v.el.paused = false;
  v.stop();
  assert.equal(v.el.paused, true);
});
