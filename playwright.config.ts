/**
 * Lot 5.1 — Playwright (chromium seul) sur l'application démarrée par `next start` avec le build
 * de verify, la base locale seedée et les faux services (scripts/e2e/*). Lancer par `npm run e2e`
 * (scripts/e2e/run-e2e.mjs), qui enchaîne des phases sans dépendance entre projets :
 *   connexion (projet setup) → captures (projets mobile et desktop) → fumée (projet fumee)
 *   → terrain → pwa → perf (lot 7, contrat section 11.1, décision D82).
 * Chaque phase a son dossier de sorties (E2E_PHASE) : une phase ne vide pas celles des autres.
 *
 * Lot 7 : `serviceWorkers: 'block'` reste le réglage global (D7) ; 'allow' seulement dans les contextes
 * dédiés (terrain : openRoleContext(…, { serviceWorkers: 'allow' }) ; pwa : contexte persistant).
 *  - terrain (e2e/terrain.spec.ts) : vue mobile, tests dans l'ordre du fichier (fullyParallel: false,
 *    lancé avec --workers=1) ; un test en échec n'empêche pas les suivants (aucun mode « serial »).
 *  - pwa (e2e/installable.spec.ts) : vue mobile, sans état de connexion (aucune dépendance au setup).
 *  - perf (e2e/perf.spec.ts) : vue mobile, animations non réduites (mesure réaliste), --workers=1.
 *  - emails (e2e/emails.spec.ts, tâche 7.9, contrat 19.9) : emails de confirmation rendus par
 *    scripts/e2e/render-emails.ts et affichés par page.setContent, sans session ni serveur d'application,
 *    réseau refusé ; phase « emails » de run-e2e.mjs, juste après les captures.
 */
import { defineConfig } from '@playwright/test';
import { APP_URL, e2eConfig } from './e2e/support/env';
import { DESKTOP, MOBILE } from './e2e/support/devices';

e2eConfig();

const phase = (process.env.E2E_PHASE || 'complet').replace(/[^a-z0-9-]/gi, '');

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
        // L'application écoute sur 127.0.0.1 mais est servie sous « localhost » (voir APP_URL) :
        // résolution forcée en IPv4, pour ne jamais tenter ::1 où rien n'écoute.
        launchOptions: { args: ['--host-resolver-rules=MAP localhost 127.0.0.1'] },
    },
    projects: [
        { name: 'setup', testMatch: /auth\.setup\.ts$/, use: DESKTOP },
        { name: 'mobile', testMatch: /captures\.spec\.ts$/, use: MOBILE },
        { name: 'desktop', testMatch: /captures\.spec\.ts$/, use: DESKTOP },
        { name: 'fumee', testMatch: /fumee\.spec\.ts$/, use: DESKTOP },
        { name: 'terrain', testMatch: /terrain\.spec\.ts$/, use: MOBILE, fullyParallel: false },
        { name: 'pwa', testMatch: /installable\.spec\.ts$/, use: MOBILE, fullyParallel: false },
        { name: 'perf', testMatch: /perf\.spec\.ts$/, use: { ...MOBILE, reducedMotion: 'no-preference' }, fullyParallel: false },
        { name: 'emails', testMatch: /emails\.spec\.ts$/, fullyParallel: false },
    ],
});
