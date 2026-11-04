import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.js', // tests/unit and tests/integration run with node --test
  timeout: 15 * 60 * 1000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3010',
    viewport: { width: 800, height: 450 },
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: 'npx serve . -l 3010',
    port: 3010,
    reuseExistingServer: true,
  },
});
