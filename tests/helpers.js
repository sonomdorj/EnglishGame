import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// Serve three.js from node_modules (some test machines cannot reach the CDN).
export async function routeThree(page) {
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => {
    const rel = route.request().url().split('three@0.160.0/')[1];
    return route.fulfill({ path: path.join(ROOT, 'node_modules/three', rel), contentType: 'text/javascript' });
  });
}

// Opens the game with a fresh save. Returns a list of console errors/warnings.
export async function openGame(page, { fresh = true } = {}) {
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  await routeThree(page);
  await page.goto('/?fast=1');
  if (fresh) { await page.evaluate(() => localStorage.clear()); await page.reload(); }
  await page.waitForFunction(() => window.game && window.game.ready, null, { timeout: 60000 });
  await page.click('#start');
  return problems;
}

export async function drain(page, max = 60) {
  for (let i = 0; i < max; i++) {
    if (!(await page.evaluate(() => game.dialog.open))) return;
    await page.keyboard.press('Space');
    await sleep(40);
  }
}

// Stand in front of a person and look at them.
export async function faceNpc(page, id) {
  await page.evaluate(id => {
    const npc = id === 'headmaster' ? game.headmaster.npc : game.villagers[id];
    const v = npc.group.position;
    const sx = v.x < 0 ? 1 : -1;
    const p = { x: v.x + sx * 2.0, z: v.z };
    game.teleportPlayer({ x: p.x, y: 0, z: p.z, yaw: Math.atan2(-(v.x - p.x), -(v.z - p.z)) });
  }, id);
  await page.waitForFunction(id => game.lookingAt && game.lookingAt.id === id, id, { timeout: 30000 });
}

export async function faceBuu(page) {
  await page.evaluate(() => {
    const b = game.buuBody.pos, p = game.player.pos;
    game.yaw = Math.atan2(-(b.x - p.x), -(b.z - p.z));
    game.pitch = -0.35;
  });
  await page.waitForFunction(() => game.lookingAt && game.lookingAt.kind === 'buu', null, { timeout: 30000 });
}

export async function clickOption(page, text) {
  await page.evaluate(t => [...document.querySelectorAll('#picker .p-options button')].find(b => b.textContent === t).click(), text);
  await sleep(60);
}

export async function waitStage(page, stage, ms = 60000) {
  for (let t = 0; t < ms; t += 100) {
    await drain(page);
    if (await page.evaluate(s => game.quest.stage === s, stage)) return;
    await sleep(100);
  }
  throw new Error(`stage ${stage} not reached; now ${await page.evaluate(() => game.quest.stage)}`);
}

// Plays the current quest from start to end. Works for every version of the quest flow.
export async function playQuest(page) {
  await page.evaluate(() => { game.dayNight.t = 60; });
  await waitStage(page, 'toA');
  const q = await page.evaluate(() => game.quest.q);
  await faceNpc(page, q.a);
  await page.keyboard.press('KeyE');
  await waitStage(page, 'toB');
  await faceNpc(page, q.b);
  await page.keyboard.press('KeyE');
  await drain(page);
  await page.waitForFunction(() => game.picker.isOpen, null, { timeout: 30000 });
  await clickOption(page, q.weekday);
  await waitStage(page, 'take');
  await faceNpc(page, q.liar);
  await page.keyboard.press('KeyE');
  await drain(page);
  // After the penalty: word check (click) or fetch (bring Buu the item).
  for (let guard = 0; guard < 400; guard++) {
    await drain(page);
    const st = await page.evaluate(() => ({ stage: game.quest.stage, picker: game.picker.isOpen, done: game.state.questsDone }));
    if (st.stage === 'idle' || st.stage === 'intro') break;
    if (await page.evaluate(() => game.picker.isOpen && !!game.quest.nicknameOpen)) {
      await page.evaluate(() => document.querySelector('#picker .p-options button').click());
      continue;
    }
    if (st.stage === 'words' && st.picker) {
      const word = await page.evaluate(() => game.quest.newWords[game.quest.wordIndex].word);
      await clickOption(page, word);
      continue;
    }
    if (st.stage === 'fetch') {
      const carrying = await page.evaluate(() => game.carrying);
      const want = await page.evaluate(() => game.quest.fetchWord);
      if (carrying !== want) {
        await page.evaluate(w => {
          const it = game.fetchItems.find(i => i.name === w);
          const p = it.group.position;
          game.teleportPlayer({ x: p.x, y: 0, z: p.z + 1.6, yaw: 0 });
          game.pitch = -0.75;
        }, want);
        await page.waitForFunction(w => game.lookingAt && game.lookingAt.kind === 'fetch' && game.lookingAt.name === w, want, { timeout: 30000 });
        await page.keyboard.press('KeyE');
        await sleep(100);
      } else {
        await faceBuu(page);
        await page.keyboard.press('KeyE');
        await sleep(100);
      }
      continue;
    }
    await sleep(100);
  }
  await drain(page);
  return q;
}
