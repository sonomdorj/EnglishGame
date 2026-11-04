import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, audioId } from '../../audioid.js';
import { readJSON } from './data.js';

// Independent FNV-1a 32-bit, written with BigInt.
function fnv(s) {
  let h = 0x811c9dc5n;
  for (const ch of s) { h ^= BigInt(ch.charCodeAt(0)); h = (h * 0x01000193n) & 0xffffffffn; }
  return h.toString(16).padStart(8, '0');
}

test('cleanText removes stars and outer spaces', () => {
  assert.equal(cleanText('  The *cat* sleeps. '), 'The cat sleeps.');
  assert.equal(cleanText('***'), '');
  assert.equal(cleanText('no marks'), 'no marks');
});

test('audioId = speaker + FNV-1a hash of "speaker|clean text"', () => {
  assert.equal(audioId('buu', 'Next case.'), `buu-${fnv('buu|Next case.')}`);
  assert.equal(audioId('word', '*cat*'), audioId('word', 'cat'));
  assert.notEqual(audioId('buu', 'Hi.'), audioId('narrator', 'Hi.'));
  assert.notEqual(audioId('buu', 'Hi.'), audioId('buu', 'Hi!'));
  assert.match(audioId('x', ''), /^x-[0-9a-f]{8}$/);
});

test('audio ids stored in the data match audioId()', () => {
  let n = 0;
  const walk = node => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    if (typeof node.who === 'string' && typeof node.text === 'string') {
      assert.equal(node.audio, audioId(node.who, node.text), node.text);
      n++;
    }
    if (typeof node.word === 'string' && typeof node.sentence === 'string') {
      assert.equal(node.audio, audioId('word', node.word));
      assert.equal(node.sentenceAudio, audioId('word', node.sentence));
      n++;
    }
    Object.values(node).forEach(walk);
  };
  for (const f of ['villagers.json', 'quests.json', 'words.json', 'letters.json', 'buu.json']) walk(readJSON(f));
  assert.ok(n > 1000, `only ${n} lines`);
});
