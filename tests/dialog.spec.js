import { test, expect } from '@playwright/test';

test('text appears 1.5 s after the voice starts (no 3D load); R replays', async ({ page }) => {
  await page.goto('/tests/dialog_timing.html');
  await page.waitForFunction(() => window.results.length >= 4, null, { timeout: 30000 });
  const r = await page.evaluate(() => ({ results: window.results, replay: window.replay }));
  console.log('text delay per line (ms):', r.results.map(x => Math.round(x)).join(', '));
  for (const ms of r.results) { expect(ms).toBeGreaterThanOrEqual(1490); expect(ms).toBeLessThan(1600); }
  expect(r.replay).toEqual({ played: 1, hidden: true });
});
