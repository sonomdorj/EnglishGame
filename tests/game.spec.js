import { test, expect } from '@playwright/test';
import { openGame, drain, playQuest, sleep } from './helpers.js';

test('one full quest, no console errors', async ({ page }) => {
  const problems = await openGame(page);
  const q = await playQuest(page);
  expect(await page.evaluate(() => game.state.questsDone)).toBe(1);
  console.log(`played quest ${q.id}; console problems: ${problems.length}`);
  expect(problems).toEqual([]);
  expect(await page.evaluate(() => game.dialog.warnings)).toEqual([]);
});

test('text appears 1.5 s after the voice starts; R replays', async ({ page }) => {
  const problems = await openGame(page);
  await page.waitForFunction(() => game.dialog.open, null, { timeout: 30000 });
  await page.waitForFunction(() => game.dialog.textVisible, null, { timeout: 10000 });
  const gap = await page.evaluate(() => game.dialog.shownAt - game.dialog.voiceStartAt);
  console.log(`text shown ${Math.round(gap)} ms after voice start`);
  expect(gap).toBeGreaterThanOrEqual(1490);
  expect(gap).toBeLessThan(2500);
  const before = await page.evaluate(() => game.voice.log.length);
  await page.keyboard.press('KeyR');
  await sleep(100);
  expect(await page.evaluate(() => game.voice.log.length)).toBe(before + 1);
  expect(await page.evaluate(() => game.dialog.textVisible)).toBe(false);
  await page.waitForFunction(() => game.dialog.textVisible, null, { timeout: 10000 });
  await drain(page);
  expect(problems).toEqual([]);
});

test('every spoken line has an audio id', async ({ page }) => {
  await openGame(page);
  const missing = await page.evaluate(async () => {
    const files = ['villagers.json', 'quests.json', 'words.json', 'letters.json', 'buu.json'];
    const bad = [];
    const walk = (n, f) => {
      if (Array.isArray(n)) return n.forEach(x => walk(x, f));
      if (!n || typeof n !== 'object') return;
      if (typeof n.who === 'string' && typeof n.text === 'string' && !n.audio) bad.push(`${f}: ${n.text}`);
      if (typeof n.word === 'string' && (!n.audio || !n.sentenceAudio)) bad.push(`${f}: ${n.word}`);
      Object.values(n).forEach(v => walk(v, f));
    };
    for (const f of files) walk(await (await fetch(f)).json(), f);
    return bad;
  });
  expect(missing).toEqual([]);
});

test('Bring Buu the thing: wrong thing = "No.", right thing ends the quest', async ({ page }) => {
  const problems = await openGame(page);
  const { faceNpc, waitStage, clickOption, faceBuu } = await import('./helpers.js');
  await page.evaluate(() => { game.dayNight.t = 60; });
  await waitStage(page, 'toA');
  const q = await page.evaluate(() => game.quest.q);
  await faceNpc(page, q.a); await page.keyboard.press('KeyE'); await waitStage(page, 'toB');
  await faceNpc(page, q.b); await page.keyboard.press('KeyE'); await drain(page);
  await page.waitForFunction(() => game.picker.isOpen);
  await clickOption(page, q.weekday);
  await waitStage(page, 'take');
  await faceNpc(page, q.liar); await page.keyboard.press('KeyE');
  await waitStage(page, 'fetch');
  expect(await page.evaluate(() => game.picker.isOpen)).toBe(false);   // no click-on-word panel
  const want = await page.evaluate(() => game.quest.fetchWord);
  const names = await page.evaluate(() => game.fetchItems.map(i => i.name));
  expect(names).toContain(want);
  expect(names.length).toBe(3);
  const pick = async name => {
    await page.evaluate(w => { const p = game.fetchItems.find(i => i.name === w).group.position;
      game.teleportPlayer({ x: p.x, y: 0, z: p.z + 1.6, yaw: 0 }); game.pitch = -0.75; }, name);
    await page.waitForFunction(w => game.lookingAt?.kind === 'fetch' && game.lookingAt.name === w, name);
    await page.keyboard.press('KeyE'); await sleep(100);
  };
  const wrong = names.find(n => n !== want);
  await pick(wrong);
  expect(await page.evaluate(() => game.carrying)).toBe(wrong);
  await faceBuu(page); await page.keyboard.press('KeyE'); await sleep(100);
  expect(await page.evaluate(() => game.dialog.current.text)).toBe('No.');
  expect(await page.evaluate(() => game.carrying)).toBe(null);
  await drain(page);
  await pick(want);
  await faceBuu(page); await page.keyboard.press('KeyE'); await sleep(100);
  expect(await page.evaluate(() => game.dialog.current.text)).toBe('Correct. Next.');
  await drain(page);
  expect(await page.evaluate(() => game.state.questsDone)).toBe(1);
  expect(await page.evaluate(() => game.fetchItems.length)).toBe(0);
  expect(problems).toEqual([]);
});

test('Day 9: 7 buttons, no calendar, wrong = "No." and waits', async ({ page }) => {
  const problems = await openGame(page);
  const { faceNpc, waitStage, clickOption } = await import('./helpers.js');
  await page.evaluate(() => { game.dayNight.t = 60; });
  await waitStage(page, 'toA');
  const q = await page.evaluate(() => game.quest.q);
  await faceNpc(page, q.a); await page.keyboard.press('KeyE'); await waitStage(page, 'toB');
  await faceNpc(page, q.b); await page.keyboard.press('KeyE'); await drain(page);
  await page.waitForFunction(() => game.picker.isOpen);
  const buttons = await page.$$eval('#picker .p-options button', bs => bs.map(b => b.textContent));
  expect(buttons).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  expect(await page.$$eval('#picker table, #picker .cal', e => e.length)).toBe(0);
  await clickOption(page, q.weekday === 'Monday' ? 'Tuesday' : 'Monday');
  expect(await page.evaluate(() => game.dialog.current.text)).toBe('No.');
  expect(await page.evaluate(() => game.picker.isOpen)).toBe(true);
  expect(await page.evaluate(() => game.quest.stage)).toBe('ask');
  await drain(page);
  await clickOption(page, q.weekday);
  await waitStage(page, 'take');
  expect(problems).toEqual([]);
});

test('Day 9: 3 catches = nickname that Buu uses; 5 = no market; headmaster bows', async ({ page }) => {
  const problems = await openGame(page);
  const { playQuest } = await import('./helpers.js');
  // Quest 1 liar is Batbayar. Give him 2 earlier catches, so this is catch 3.
  await page.evaluate(() => { game.state.catches = { batbayar: 2 }; });
  await playQuest(page);
  const nick = await page.evaluate(() => game.state.nicknames.batbayar);
  console.log('nickname picked:', nick);
  expect(await page.evaluate(() => game.people.batbayar.nicknames)).toContain(nick);
  const said = await page.evaluate(() => game.power.lineFor(game.buuLines.talkTo.batbayar).text);
  expect(said).toBe(`Talk to ${nick}.`);
  expect(await page.evaluate(() => game.voice.log.some(id => id === game.buuLines.nickOk[game.state.nicknames.batbayar].audio))).toBe(true);

  // Catch 5: locked out of the market today.
  await page.evaluate(() => { game.state.catches.batbayar = 4; game.quest.timer = 0; });
  await playQuest(page).catch(() => {});
  await page.evaluate(() => { game.state.catches.batbayar = 4; });
  await page.evaluate(() => new Promise(res => game.power.onCatch('batbayar', res)));
  await drain(page);
  expect(await page.evaluate(() => game.power.isLocked('batbayar'))).toBe(true);
  await page.evaluate(() => { game.dayNight.t = 120; });
  await page.waitForFunction(() => {
    const d = game.villagers.dulamsuren.group.position;
    return Math.hypot(d.x + 5.5, d.z - 6.5) < 0.2;
  }, null, { timeout: 120000 });
  const b = await page.evaluate(() => { const p = game.villagers.batbayar.group.position, h = game.villagers.batbayar.home; return Math.hypot(p.x - h.x, p.z - h.z); });
  expect(b).toBeLessThan(0.2);   // Batbayar stayed home

  // Headmaster bows at 3 catches.
  await page.evaluate(() => { game.dayNight.t = 60; game.state.catches.headmaster = 3; game.bows = 0; game.power.bow.cooldown = 0; });
  await page.waitForFunction(() => Math.hypot(game.headmaster.npc.group.position.x - game.headmaster.daySpot.x, game.headmaster.npc.group.position.z - game.headmaster.daySpot.z) < 0.3, null, { timeout: 120000 });
  await page.evaluate(() => { const s = game.headmaster.daySpot; game.teleportPlayer({ x: s.x + 2, y: 0, z: s.z + 2, yaw: 0 }); });
  await page.waitForFunction(() => game.bows > 0, null, { timeout: 30000 });
  expect(await page.evaluate(() => game.headmaster.npc.torso.rotation.x)).toBeGreaterThan(0);
  expect(problems).toEqual([]);
});
