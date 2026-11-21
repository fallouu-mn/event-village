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
 *
 * Lot 8 (contrat 11.4, 15.1, 15.8 ; T27) :
 *  - projets mobile et desktop seulement : drapeau LangAttributeAwareFormControlUI (L66), pour que les champs de date
 *    suivent l'attribut lang de la page (dd/mm/yyyy et 24 h). `locale: 'fr-FR'` n'a aucun effet sur ces champs. Limité
 *    aux captures : le drapeau rend aussi le champ `number` sensible à la langue. `launchOptions` d'un projet REMPLACE
 *    celui de `use` : la résolution forcée en IPv4 y est donc répétée. Lot 9 (relecture du run 111) : `--lang=fr-FR` en
 *    plus, le drapeau seul laissant les `datetime-local` en mm/dd/yyyy dans le Chromium Linux de la CI (écart du lot 8) ;
 *  - dev-page (e2e/dev-page.spec.ts, phase courte) : rendu statique de la page de développement, sans serveur (L75) ;
 *  - recette (e2e/recette.spec.ts, vague F) : parcours enchaînés, un seul worker. Sans ce fichier, le projet est vide.
 *
 * Design 1c (point 1) : responsive (e2e/responsive.spec.ts), toutes les pages à 320, 360, 390, 768, 1024 et 1440 px ;
 * phase lancée seule par le job « responsive » de la CI (EV_E2E_PHASES=connexion,responsive), jamais par le job e2e.
 */
import { defineConfig } from '@playwright/test';
import { APP_URL, e2eConfig } from './e2e/support/env';
import { DESKTOP, FR_CONTEXT, FR_LANG_ARG, MOBILE, frBrowserEnv } from './e2e/support/devices';

e2eConfig();

/** Résolution forcée en IPv4 : voir `launchOptions` de `use`. */
const HOST_RESOLVER_RULES = '--host-resolver-rules=MAP localhost 127.0.0.1';
/** Stabilité (mini-lot stabilite/langue) : navigateur en français à l'heure de Dakar pour tous les projets (e2e/support/devices.ts). */
const FR_ENV = frBrowserEnv();
/** Lanceur de tous les projets : résolution forcée en IPv4, navigateur en français. */
const LAUNCH = { args: [HOST_RESOLVER_RULES, FR_LANG_ARG], env: FR_ENV };
/** Lot 8 (L66) : lanceur des projets de capture. Remplace celui de `use`, d'où la répétition des autres réglages. */
const CAPTURE_LAUNCH = { args: [HOST_RESOLVER_RULES, '--enable-blink-features=LangAttributeAwareFormControlUI', FR_LANG_ARG], env: FR_ENV };

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
        ...FR_CONTEXT,
        serviceWorkers: 'block',
        reducedMotion: 'reduce',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'off',
        actionTimeout: 15_000,
        navigationTimeout: 45_000,
        // L'application écoute sur 127.0.0.1 mais est servie sous « localhost » (voir APP_URL) :
        // résolution forcée en IPv4, pour ne jamais tenter ::1 où rien n'écoute. Navigateur en français (mini-lot stabilite/langue).
        launchOptions: LAUNCH,
    },
    // Stabilité (mini-lot stabilite/langue) : langue et fuseau répétés dans chaque projet (FR_CONTEXT), lanceur en français
    // (LAUNCH ou CAPTURE_LAUNCH) : aucun projet ne peut en hériter autrement.
    projects: [
        { name: 'setup', testMatch: /auth\.setup\.ts$/, use: { ...DESKTOP, ...FR_CONTEXT, launchOptions: LAUNCH } },
        { name: 'mobile', testMatch: /captures\.spec\.ts$/, use: { ...MOBILE, ...FR_CONTEXT, launchOptions: CAPTURE_LAUNCH } },
        { name: 'desktop', testMatch: /captures\.spec\.ts$/, use: { ...DESKTOP, ...FR_CONTEXT, launchOptions: CAPTURE_LAUNCH } },
        { name: 'fumee', testMatch: /fumee\.spec\.ts$/, use: { ...DESKTOP, ...FR_CONTEXT, launchOptions: LAUNCH } },
        { name: 'terrain', testMatch: /terrain\.spec\.ts$/, use: { ...MOBILE, ...FR_CONTEXT, launchOptions: LAUNCH }, fullyParallel: false },
        { name: 'pwa', testMatch: /installable\.spec\.ts$/, use: { ...MOBILE, ...FR_CONTEXT, launchOptions: { args: [HOST_RESOLVER_RULES] } }, fullyParallel: false }, // lancement de main, sans l'environnement LANG/TZ : le Chromium persistant du test (fr-FR et Dakar fixés dans le test, aucun champ de date) ne reçoit plus beforeinstallprompt avec (runs 513, 516)
        // Sécurité (déconnexion sans réseau) : un compte créé par le test, réseau coupé, horloge avancée
        { name: 'deconnexion', testMatch: /deconnexion\.spec\.ts$/, use: { ...MOBILE, ...FR_CONTEXT, launchOptions: LAUNCH }, fullyParallel: false },
        // Stabilité (mini-lot stabilite/connexion) : connexion d'un ADMIN, aucune page rechargée après l'arrivée
        { name: 'connexion-course', testMatch: /connexion-course\.spec\.ts$/, use: { ...DESKTOP, ...FR_CONTEXT, launchOptions: LAUNCH }, fullyParallel: false },
        { name: 'perf', testMatch: /perf\.spec\.ts$/, use: { ...MOBILE, ...FR_CONTEXT, launchOptions: LAUNCH, reducedMotion: 'no-preference' }, fullyParallel: false },
        { name: 'emails', testMatch: /emails\.spec\.ts$/, use: { ...FR_CONTEXT, launchOptions: LAUNCH }, fullyParallel: false },
        { name: 'dev-page', testMatch: /dev-page\.spec\.ts$/, use: { ...FR_CONTEXT, launchOptions: LAUNCH }, fullyParallel: false },
        { name: 'recette', testMatch: /recette\.spec\.ts$/, use: { ...DESKTOP, ...FR_CONTEXT, launchOptions: LAUNCH }, fullyParallel: false },
        // Design 1c (point 1) : contrôle responsive, fenêtre redimensionnée par le test (320 à 1 440 px, paysage du scanner)
        { name: 'responsive', testMatch: /responsive\.spec\.ts$/, use: { ...DESKTOP, ...FR_CONTEXT, launchOptions: CAPTURE_LAUNCH } },
    ],
});
