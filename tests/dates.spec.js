import { test, expect } from '@playwright/test';

test('date engine: 20 of 20 known dates', async ({ page }) => {
  await page.goto('/test_dates.html');
  await page.waitForFunction(() => window.testResult);
  const r = await page.evaluate(() => window.testResult);
  expect(r).toEqual({ pass: 20, total: 20 });
});
