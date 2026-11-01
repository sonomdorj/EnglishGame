import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import fs from 'fs';
import { openGame, playQuest, drain, waitStage } from './helpers.js';

test('scripts/check_quests.js exits 0', () => {
  const out = execFileSync('node', ['scripts/check_quests.js']).toString();
  console.log(out.trim());
  expect(out).toContain('OK: all quest rules hold.');
});

test('arc 3: a full headmaster quest, report.json written', async ({ page }) => {
  const problems = await openGame(page);
  await page.evaluate(() => { game.state.questsDone = 20; game.state.introDone = true; game.dialog.clear(); game.quest.stage = 'idle'; game.quest.timer = 0; });
  const q = await playQuest(page);
  expect(q.arc).toBe(3);
  expect([q.a, q.b]).toContain('headmaster');
  const report = await page.evaluate(() => JSON.parse(localStorage.getItem('report.json')));
  expect(report.at(-1).quest).toBe(q.id);
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync('test-results/report.json', JSON.stringify(report, null, 2));
  console.log('report.json entry:', JSON.stringify(report.at(-1)));
  expect(problems).toEqual([]);
});

test('arc 4: past tense is said only after 5 correct in a row', async ({ page }) => {
  const problems = await openGame(page);
  await page.evaluate(() => { game.state.questsDone = 30; game.state.introDone = true; game.state.grammar = { past: false, cause: false, streak: 0 }; game.dialog.clear(); game.quest.stage = 'idle'; game.quest.timer = 0; });
  await waitStage(page, 'toA');
  // Locked: Buu's past-tense question uses the plain (present) version.
  const before = await page.evaluate(() => game.grammar.pick(game.quest.q.lines.ask[0]).text);
  expect(before).toMatch(/^What day is /);
  await page.evaluate(() => { for (let i = 0; i < 4; i++) game.learner.record(true); });
  expect(await page.evaluate(() => game.state.grammar.past)).toBe(false);
  await page.evaluate(() => game.learner.record(true));
  expect(await page.evaluate(() => game.state.grammar.past)).toBe(true);
  const after = await page.evaluate(() => game.grammar.pick(game.quest.q.lines.ask[0]).text);
  expect(after).toMatch(/^What day was /);
  // because/so stays locked in arc 4.
  await page.evaluate(() => { for (let i = 0; i < 5; i++) game.learner.record(true); });
  expect(await page.evaluate(() => game.state.grammar.cause)).toBe(false);
  await drain(page);
  expect(problems).toEqual([]);
});
