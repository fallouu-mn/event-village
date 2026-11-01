/**
 * Lot 5.1 — Playwright (chromium seul) sur l'application démarrée par `next start` avec le build
 * de verify, la base locale seedée et les faux services (scripts/e2e/*). Lancer par `npm run e2e`
 * (scripts/e2e/run-e2e.mjs), qui enchaîne trois phases sans dépendance entre projets :
 *   connexion (projet setup) → captures (projets mobile et desktop) → fumée (projet fumee).
 * Chaque phase a son dossier de sorties (E2E_PHASE) : une phase ne vide pas celles des autres.
 */
import { defineConfig } from '@playwright/test';
import { APP_URL, e2eConfig } from './e2e/support/env';

e2eConfig();

const phase = (process.env.E2E_PHASE || 'complet').replace(/[^a-z0-9-]/gi, '');

const DESKTOP = { browserName: 'chromium' as const, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
const MOBILE = {
    browserName: 'chromium' as const,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
};

export default defineConfig({
    testDir: './e2e',
    outputDir: `test-results/${phase}`,
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    workers: process.env.CI ? 2 : undefined,
    timeout: 120_000,
    expect: { timeout: 15_000 },
    reporter: [['list'], ['html', { outputFolder: `playwright-report/${phase}`, open: 'never' }]],
    globalTeardown: './e2e/support/build-index.ts',
    use: {
        baseURL: APP_URL,
        locale: 'fr-FR',
        timezoneId: 'Africa/Dakar',
        serviceWorkers: 'block',
        reducedMotion: 'reduce',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'off',
        actionTimeout: 15_000,
        navigationTimeout: 45_000,
    },
    projects: [
        { name: 'setup', testMatch: /auth\.setup\.ts$/, use: DESKTOP },
        { name: 'mobile', testMatch: /captures\.spec\.ts$/, use: MOBILE },
        { name: 'desktop', testMatch: /captures\.spec\.ts$/, use: DESKTOP },
        { name: 'fumee', testMatch: /fumee\.spec\.ts$/, use: DESKTOP },
    ],
});
