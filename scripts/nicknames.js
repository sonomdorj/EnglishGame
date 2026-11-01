// Adds nickname versions of Buu lines that name an adult.
// After the player picks a nickname (3 catches), Buu says the nickname version forever.
//   node scripts/nicknames.js      (updates buu.json and quests.json)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const write = (f, d) => fs.writeFileSync(path.join(ROOT, f), JSON.stringify(d, null, 2) + '\n');

export function addNickVariants(node, adults) {
  if (Array.isArray(node)) { node.forEach(n => addNickVariants(n, adults)); return; }
  if (!node || typeof node !== 'object') return;
  if (node.who === 'buu' && typeof node.text === 'string') {
    const nick = {};
    for (const a of adults) {
      const re = new RegExp(`\\b${a.first}\\b`, 'g');
      if (!re.test(node.text)) continue;
      for (const n of a.nicknames) nick[n] = { who: 'buu', text: node.text.replace(re, n) };
    }
    if (Object.keys(nick).length) node.nick = nick; else delete node.nick;
    if (node.plain) addNickVariants(node.plain, adults);
    return;
  }
  for (const v of Object.values(node)) addNickVariants(v, adults);
}

export function adultsFrom(villagers) {
  return villagers.filter(v => v.adult).map(v => ({ id: v.id, first: v.name.split(' ')[0], nicknames: v.nicknames }));
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) {
  const adults = adultsFrom(read('villagers.json'));
  for (const f of ['buu.json', 'quests.json']) {
    const d = read(f);
    // Lines that confirm a nickname must not be changed.
    const keep = f === 'buu.json' ? d.nickOk : null;
    if (keep) delete d.nickOk;
    addNickVariants(d, adults);
    if (keep) d.nickOk = keep;
    write(f, d);
  }
  console.log('Nickname variants added.');
}
