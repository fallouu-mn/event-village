/**
 * Lot 8 (contrat 15.8, décision L75 ; phase courte « dev-page » de scripts/e2e/run-e2e.mjs) — page de développement du
 * faux SamirPay, en clair et en sombre, en mobile et sur ordinateur.
 *
 * Aucun serveur d'application ni session : scripts/e2e/render-dev-page.tsx rend `FakePaymentPanel` et écrit un document
 * autonome (feuilles de style du build en ligne) ; il est affiché par page.setContent dans un contexte où toute requête
 * réseau est refusée, comme e2e/emails.spec.ts. Thème : classe `dark` de la racine, celle que pose ThemeProvider.
 * Captures : .e2e-captures/captures/dev-paiements__<mobile|ordinateur>__<clair|sombre>.png, écrites dans l'index.
 * Contrôles bloquants : ceux des captures (runPageChecks), plus la mention permanente et les deux boutons (contrat 5.3).
 * Prouve l'apparence ; la route est couverte par tests/parcours/essai-middleware.test.ts et e2e/fumee.spec.ts.
 * Rouge jusqu'à fix(8.1e) : le rendu s'arrête en nommant le composant absent.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { runPageChecks } from './support/checks';
import { writeCaptureRecord, type CaptureRecord } from './support/capture-record';
import { CAPTURES_DIR, E2E_OUTPUT_DIR } from './support/demo-ids';
import { DESKTOP, MOBILE } from './support/devices';

const RENDER_SCRIPT = path.join('scripts', 'e2e', 'render-dev-page.tsx');
const OUT_DIR = path.join(E2E_OUTPUT_DIR, 'dev-page');

/** Rendu par le script (processus séparé : jamais d'import du dépôt dans Playwright, alias @/ en CI). */
function renderPage(): string {
    const r = spawnSync(process.execPath, ['--import', 'tsx', RENDER_SCRIPT, '--out', OUT_DIR], { cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 120_000 });
    if (r.error) throw new Error(`[e2e][dev-page] ${RENDER_SCRIPT} : ${r.error.message}`);
    if (r.status !== 0) throw new Error(`[e2e][dev-page] ${RENDER_SCRIPT} : code ${r.status}\n${(r.stderr ?? '').slice(-2000)}`);
    const out = (r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean);
    const last = out[out.length - 1] ?? '';
    let manifest: { html?: unknown };
    try {
        manifest = JSON.parse(last) as { html?: unknown };
    } catch (err) {
        throw new Error(`[e2e][dev-page] manifeste illisible (${err instanceof Error ? err.message : String(err)}) : ${last.slice(0, 300)}`);
    }
    if (typeof manifest.html !== 'string') throw new Error(`[e2e][dev-page] chemin absent du manifeste : ${last.slice(0, 300)}`);
    return fs.readFileSync(manifest.html, 'utf8');
}

let html = '';

test.beforeAll(() => {
    html = renderPage();
});

const DEVICES = [{ key: 'mobile', device: MOBILE }, { key: 'ordinateur', device: DESKTOP }] as const;
const THEMES = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }] as const;

for (const { key: vue, device } of DEVICES) {
    for (const theme of THEMES) {
        test(`page de développement : ${vue}, ${theme.key}`, async ({ browser }, testInfo) => {
            const file = `dev-paiements__${vue}__${theme.key}.png`;
            const started = Date.now();
            const record: CaptureRecord = {
                file, screen: 'dev-paiements', titre: 'Page de développement du faux SamirPay (rendu statique, sans route)', vue, theme: theme.key, role: 'anonyme',
                url: null, status: null, captured: false, blocking: [], warnings: [], axeDetails: [], notes: ['rendu statique de FakePaymentPanel (L75) : réseau refusé, aucun serveur'], error: null, durationMs: 0,
            };
            const { browserName: _browser, ...options } = device;
            const context = await browser.newContext({ ...options, locale: 'fr-FR', timezoneId: 'Africa/Dakar', colorScheme: theme.scheme });
            const requests: string[] = [];
            try {
                await context.route('**/*', async (route) => {
                    requests.push(`${route.request().resourceType()} ${route.request().url().slice(0, 120)}`);
                    await route.abort('blockedbyclient');
                });
                const page = await context.newPage();
                await page.setContent(html, { waitUntil: 'load' });
                await page.evaluate('window.__name = window.__name || function (f) { return f; };'); // aide esbuild, comme emails.spec.ts
                await page.evaluate((dark) => {
                    document.documentElement.classList.toggle('dark', dark);
                    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
                }, theme.key === 'sombre');

                await expect(page.getByText('Paiement simulé : aucun argent réel').first(), 'mention permanente de la page').toBeVisible();
                await expect(page.getByRole('button', { name: /^valider le paiement$/i })).toBeVisible();
                await expect(page.getByRole('button', { name: /^refuser le paiement$/i })).toBeVisible();

                const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true });
                record.blocking.push(...checks.blocking);
                record.warnings.push(...checks.warnings);
                record.axeDetails = checks.axeDetails;
                record.smallTextDetails = checks.smallTextDetails;
                record.metrics = checks.metrics;
                if (requests.length > 0) record.blocking.push(`requête(s) réseau émise(s) par la page : ${requests.slice(0, 5).join(' ; ')}`);

                fs.mkdirSync(CAPTURES_DIR, { recursive: true });
                const target = path.join(CAPTURES_DIR, file);
                await page.screenshot({ path: target, animations: 'disabled', caret: 'hide', scale: 'device' });
                record.captured = true;
                await testInfo.attach(file, { path: target, contentType: 'image/png' });
            } catch (err) {
                record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
                throw err;
            } finally {
                record.durationMs = Date.now() - started;
                writeCaptureRecord(record);
                await context.close();
            }
            expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
        });
    }
}
