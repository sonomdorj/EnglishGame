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
