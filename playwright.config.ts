import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env['CI'];
const ES_URL = 'http://localhost:4200';
const EN_URL = 'http://localhost:4201';

/**
 * Pruebas E2E del portal (HU-38). La web corre con su servidor de desarrollo y el backend se
 * simula con `page.route` (ver `e2e/support/backend.ts`): así se prueban los interceptores y los
 * errores reales sin levantar servicios. El proyecto `en-US` usa el build en inglés.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    // Fecha fija: los tests comparan fechas formateadas y no deben depender de la zona del equipo.
    timezoneId: 'America/Bogota',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'es-CO',
      testIgnore: /locale-en-us/,
      use: { ...devices['Desktop Chrome'], baseURL: ES_URL, locale: 'es-CO' },
    },
    {
      name: 'en-US',
      testMatch: /locale-en-us/,
      use: { ...devices['Desktop Chrome'], baseURL: EN_URL, locale: 'en-US' },
    },
  ],
  webServer: [
    {
      command: 'npx ng serve --port 4200',
      url: ES_URL,
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
    {
      command: 'npx ng serve --configuration en-US --port 4201',
      url: EN_URL,
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
  ],
});
