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
