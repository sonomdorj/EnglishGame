// Makes one mp3 per spoken line with OpenAI text-to-speech.
//
//   OPENAI_API_KEY=... node scripts/make_audio.js        assign ids + download missing files
//   node scripts/make_audio.js --ids-only                 only write the "audio" fields
//
// Reads villagers.json, quests.json, words.json, letters.json, buu.json.
// Every spoken line gets an "audio" field (words also get "sentenceAudio").
// Files are saved as audio/<id>.mp3. audio_manifest.json lists the files that exist.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { audioId, cleanText } from '../audioid.js';
import { CONFIG } from '../config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = path.join(ROOT, 'audio');
const FILES = ['villagers.json', 'quests.json', 'words.json', 'letters.json', 'buu.json'];

// Buu = alloy. Six other voices for the six villagers.
export const VOICES = {
  buu: 'alloy',
  batbayar: 'onyx', dulamsuren: 'shimmer', oyunaa: 'nova', enkhjargal: 'coral', tsetseg: 'sage', ganbold: 'echo',
  headmaster: 'ash', narrator: 'fable', letter: 'fable', word: 'fable',
};

// Finds every line object { who, text } in a JSON value and gives it an audio id.
function walk(node, found) {
  if (Array.isArray(node)) { node.forEach(n => walk(n, found)); return; }
  if (!node || typeof node !== 'object') return;
  if (typeof node.who === 'string' && typeof node.text === 'string') {
    node.audio = audioId(node.who, node.text);
    found.push({ id: node.audio, who: node.who, text: cleanText(node.text) });
  }
  // words.json entries
  if (typeof node.word === 'string' && typeof node.sentence === 'string') {
    node.audio = audioId('word', node.word);
    node.sentenceAudio = audioId('word', node.sentence);
    found.push({ id: node.audio, who: 'word', text: node.word });
    found.push({ id: node.sentenceAudio, who: 'word', text: cleanText(node.sentence) });
  }
  for (const [k, v] of Object.entries(node)) if (k !== 'plainOf') walk(v, found);
}

export function collectLines({ write = false } = {}) {
  const found = [];
  for (const f of FILES) {
    const p = path.join(ROOT, f);
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    walk(data, found);
    if (write) fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
  }
  const unique = new Map();
  for (const l of found) {
    if (!VOICES[l.who]) throw new Error(`No voice for speaker "${l.who}"`);
    unique.set(l.id, l);
  }
  return [...unique.values()];
}

async function tts(line, key) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1', voice: VOICES[line.who], input: line.text, speed: CONFIG.ttsRate, response_format: 'mp3' }),
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    if (attempt === 4 || (r.status < 500 && r.status !== 429)) throw new Error(`TTS ${r.status} for ${line.id}: ${await r.text()}`);
    await new Promise(res => setTimeout(res, 2000 * 2 ** attempt));
  }
}

function writeManifest() {
  const ids = fs.existsSync(AUDIO) ? fs.readdirSync(AUDIO).filter(f => f.endsWith('.mp3')).map(f => f.slice(0, -4)) : [];
  fs.writeFileSync(path.join(ROOT, 'audio_manifest.json'), JSON.stringify(ids.sort()) + '\n');
  return ids.length;
}

async function main() {
  const idsOnly = process.argv.includes('--ids-only');
  const lines = collectLines({ write: true });
  console.log(`Spoken lines (unique): ${lines.length}`);
  if (idsOnly) { console.log('Audio ids written. No files downloaded (--ids-only).'); return; }

  const key = process.env.OPENAI_API_KEY;
  if (!key) { console.error('OPENAI_API_KEY is not set. Nothing downloaded.'); process.exit(2); }
  fs.mkdirSync(AUDIO, { recursive: true });
  // Remove files for lines that no longer exist.
  const keep = new Set(lines.map(l => l.id));
  for (const f of fs.readdirSync(AUDIO)) if (f.endsWith('.mp3') && !keep.has(f.slice(0, -4))) fs.unlinkSync(path.join(AUDIO, f));

  const todo = lines.filter(l => !fs.existsSync(path.join(AUDIO, `${l.id}.mp3`)));
  console.log(`To download: ${todo.length}`);
  let done = 0;
  const worker = async () => {
    while (todo.length) {
      const l = todo.shift();
      fs.writeFileSync(path.join(AUDIO, `${l.id}.mp3`), await tts(l, key));
      if (++done % 50 === 0) console.log(`  ${done} done`);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  writeManifest();
  const count = execSync('ls audio | wc -l', { cwd: ROOT }).toString().trim();
  console.log(`ls audio | wc -l -> ${count}`);
  console.log(Number(count) === lines.length ? 'MATCH: one file per line.' : `MISMATCH: ${count} files, ${lines.length} lines.`);
  if (Number(count) !== lines.length) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
