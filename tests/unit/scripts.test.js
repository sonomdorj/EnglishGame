import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { ROOT, readJSON } from './data.js';
import { addNickVariants, adultsFrom } from '../../scripts/nicknames.js';
import { collectLines, VOICES } from '../../scripts/make_audio.js';
import { audioId } from '../../audioid.js';

const DATA = ['villagers.json', 'quests.json', 'words.json', 'letters.json', 'buu.json'];

// A copy of the game files in a temp folder, so scripts that write files cannot change the repo.
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'namekeeper-'));
  fs.mkdirSync(path.join(dir, 'scripts'));
  for (const f of fs.readdirSync(ROOT)) if (/\.(js|json)$/.test(f) && f !== 'package-lock.json') fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  for (const f of fs.readdirSync(path.join(ROOT, 'scripts'))) fs.copyFileSync(path.join(ROOT, 'scripts', f), path.join(dir, 'scripts', f));
  return dir;
}
const node = (dir, args, env = {}) => spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });

// ---------- nicknames.js ----------

const ADULTS = [{ id: 'b', first: 'Bold', nicknames: ['Big Nose', 'Mr Fish'] }];

test('adultsFrom: adults only, with first name and nicknames', () => {
  const list = adultsFrom(readJSON('villagers.json'));
  assert.ok(list.every(a => a.first && a.nicknames.length === 3));
  assert.ok(!list.some(a => a.id === 'oyunaa'));
  assert.deepEqual(list.find(a => a.id === 'batbayar').first, 'Batbayar');
});

test('addNickVariants: Buu lines that name an adult get one version per nickname', () => {
  const line = { who: 'buu', text: 'Meet Bold. Bold is here.' };
  addNickVariants(line, ADULTS);
  assert.deepEqual(line.nick, {
    'Big Nose': { who: 'buu', text: 'Meet Big Nose. Big Nose is here.' },
    'Mr Fish': { who: 'buu', text: 'Meet Mr Fish. Mr Fish is here.' },
  });
});

test('addNickVariants: whole words only; other speakers untouched; old nick removed', () => {
  const a = { who: 'buu', text: 'Boldness.', nick: { old: {} } };
  const b = { who: 'oyunaa', text: 'Bold is my father.' };
  addNickVariants([a, b], ADULTS);
  assert.equal(a.nick, undefined);
  assert.equal(b.nick, undefined);
});

test('addNickVariants: walks nested objects and plain versions', () => {
  const tree = { lines: { ask: [{ who: 'buu', text: 'Bold was here.', form: 'past', plain: { who: 'buu', text: 'Bold is here.' } }] }, n: 3, s: 'x' };
  addNickVariants(tree, ADULTS);
  const l = tree.lines.ask[0];
  assert.equal(l.nick['Mr Fish'].text, 'Mr Fish was here.');
  assert.equal(l.plain.nick['Mr Fish'].text, 'Mr Fish is here.');
  assert.doesNotThrow(() => addNickVariants(null, ADULTS));
});

// ---------- make_audio.js ----------

test('collectLines: every spoken line once, each speaker has a voice', () => {
  const lines = collectLines();
  assert.ok(lines.length > 1000);
  assert.equal(new Set(lines.map(l => l.id)).size, lines.length);
  for (const l of lines) {
    assert.ok(VOICES[l.who], l.who);
    assert.equal(l.id, audioId(l.who, l.text));
    assert.ok(!l.text.includes('*'), 'text is clean');
  }
  const ids = new Set(lines.map(l => l.id));
  const words = readJSON('words.json');
  for (const w of words) { assert.ok(ids.has(w.audio)); assert.ok(ids.has(w.sentenceAudio)); }
});

test('collectLines without write does not change the files', () => {
  const before = DATA.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'));
  collectLines();
  assert.deepEqual(DATA.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')), before);
});

test('VOICES: Buu and every villager have different voices', () => {
  const people = readJSON('villagers.json').map(p => p.id);
  const v = ['buu', ...people].map(id => VOICES[id]);
  assert.ok(v.every(Boolean));
  assert.equal(new Set(v).size, v.length);
});

test('audio_manifest.json is a sorted list of ids that exist as lines', () => {
  const manifest = readJSON('audio_manifest.json');
  assert.ok(Array.isArray(manifest));
  assert.deepEqual(manifest, [...manifest].sort());
  const ids = new Set(collectLines().map(l => l.id));
  for (const id of manifest) assert.ok(ids.has(id), id);
});

// ---------- the data pipeline ----------

let box;
before(() => { box = sandbox(); });
after(() => fs.rmSync(box, { recursive: true, force: true }));

test('pipeline: build_quests + nicknames + make_audio --ids-only gives the committed files', () => {
  for (const args of [['scripts/build_quests.js'], ['scripts/nicknames.js'], ['scripts/make_audio.js', '--ids-only']]) {
    const r = node(box, args);
    assert.equal(r.status, 0, `${args[0]}: ${r.stderr}`);
  }
  for (const f of DATA) {
    assert.equal(fs.readFileSync(path.join(box, f), 'utf8'), fs.readFileSync(path.join(ROOT, f), 'utf8'), `${f} is out of date: run the scripts`);
  }
});

test('make_audio without OPENAI_API_KEY: exit 2, nothing downloaded', () => {
  const r = node(box, ['scripts/make_audio.js'], { OPENAI_API_KEY: '' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /OPENAI_API_KEY is not set/);
  assert.equal(fs.existsSync(path.join(box, 'audio')), false);
});

const STUB = path.join(ROOT, 'tests/unit/stub-openai.mjs');

test('make_audio with a key: one mp3 per line, old files removed, manifest written', () => {
  const audio = path.join(box, 'audio');
  fs.mkdirSync(audio, { recursive: true });
  fs.writeFileSync(path.join(audio, 'old-line.mp3'), 'x');
  const r = node(box, ['--import', STUB, 'scripts/make_audio.js'], { OPENAI_API_KEY: 'test-key', STUB_TTS: 'ok' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /MATCH: one file per line\./);
  const lines = collectLines();
  const files = fs.readdirSync(audio).sort();
  assert.equal(files.length, lines.length);
  assert.ok(!files.includes('old-line.mp3'));
  const buuFile = fs.readFileSync(path.join(audio, `${lines.find(l => l.who === 'buu').id}.mp3`));
  assert.equal(buuFile.subarray(2).toString(), VOICES.buu, 'Buu uses his own voice');
  const manifest = JSON.parse(fs.readFileSync(path.join(box, 'audio_manifest.json'), 'utf8'));
  assert.deepEqual(manifest, files.map(f => f.slice(0, -4)));
  // Second run: nothing new to download.
  const again = node(box, ['--import', STUB, 'scripts/make_audio.js'], { OPENAI_API_KEY: 'test-key', STUB_TTS: '401' });
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /To download: 0/);
  fs.rmSync(audio, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'audio_manifest.json'), path.join(box, 'audio_manifest.json'));
});

test('make_audio: a refused key stops with exit 1 and the API message', () => {
  const r = node(box, ['--import', STUB, 'scripts/make_audio.js'], { OPENAI_API_KEY: 'bad', STUB_TTS: '401' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /TTS 401 for .*: bad key/);
  fs.rmSync(path.join(box, 'audio'), { recursive: true, force: true });
});

test('check_quests: OK on the real data', () => {
  const out = execFileSync(process.execPath, ['scripts/check_quests.js'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /OK: all quest rules hold\./);
  assert.match(out, /quests: 50/);
});

// Breaks quests.json in the sandbox in one way and expects check_quests to fail with `msg`.
function brokenCheck(edit, msg) {
  const q = readJSON('quests.json');
  edit(q);
  fs.writeFileSync(path.join(box, 'quests.json'), JSON.stringify(q));
  const r = node(box, ['scripts/check_quests.js']);
  fs.copyFileSync(path.join(ROOT, 'quests.json'), path.join(box, 'quests.json'));
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /FAILED/);
  assert.match(r.stdout, msg);
}

test('check_quests catches a wrong weekday', () => {
  brokenCheck(q => { q[0].weekday = q[0].weekday === 'Monday' ? 'Tuesday' : 'Monday'; }, /quest 1: weekday of .* is wrong/);
});

test('check_quests catches a trap that is not wrong', () => {
  brokenCheck(q => { q[2].trap.said = q[2].trap.weekday; }, /quest 3: trap is not a wrong weekday/);
});

test('check_quests catches a long line, an old audio id and past tense too early', () => {
  brokenCheck(q => { q[0].lines.claimA[0].text = 'This line has far too many words.'; }, /words \(arc 1 max 3\)/);
  brokenCheck(q => { q[0].lines.claimA[0].audio = 'x'; }, /missing or old audio id/);
  brokenCheck(q => { const l = q[0].lines.claimA[0]; l.text = 'It was.'; l.audio = audioId(l.who, l.text); }, /past tense before arc 4/);
});

test('check_quests catches a wrong quest count and duplicate titles', () => {
  brokenCheck(q => q.pop(), /expected 50 quests, found 49/);
  brokenCheck(q => { q[1].title = q[0].title; }, /case titles are not unique/);
});
