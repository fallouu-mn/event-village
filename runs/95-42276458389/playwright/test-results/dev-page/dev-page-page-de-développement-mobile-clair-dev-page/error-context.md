# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dev-page.spec.ts >> page de développement : mobile, clair
- Location: e2e/dev-page.spec.ts:53:13

# Error details

```
Error: [e2e][dev-page] scripts/e2e/render-dev-page.tsx : code 1
[render-dev-page] components/dev/FakePaymentPanel.tsx absent : la page de développement n'est pas encore livrée (fix(8.1e)).

```

# Test source

```ts
  1   | /**
  2   |  * Lot 8 (contrat 15.8, décision L75 ; phase courte « dev-page » de scripts/e2e/run-e2e.mjs) — page de développement du
  3   |  * faux SamirPay, en clair et en sombre, en mobile et sur ordinateur.
  4   |  *
  5   |  * Aucun serveur d'application ni session : scripts/e2e/render-dev-page.tsx rend `FakePaymentPanel` et écrit un document
  6   |  * autonome (feuilles de style du build en ligne) ; il est affiché par page.setContent dans un contexte où toute requête
  7   |  * réseau est refusée, comme e2e/emails.spec.ts. Thème : classe `dark` de la racine, celle que pose ThemeProvider.
  8   |  * Captures : .e2e-captures/captures/dev-paiements__<mobile|ordinateur>__<clair|sombre>.png, écrites dans l'index.
  9   |  * Contrôles bloquants : ceux des captures (runPageChecks), plus la mention permanente et les deux boutons (contrat 5.3).
  10  |  * Prouve l'apparence ; la route est couverte par tests/parcours/essai-middleware.test.ts et e2e/fumee.spec.ts.
  11  |  * Rouge jusqu'à fix(8.1e) : le rendu s'arrête en nommant le composant absent.
  12  |  */
  13  | import { spawnSync } from 'node:child_process';
  14  | import fs from 'node:fs';
  15  | import path from 'node:path';
  16  | import { test, expect } from '@playwright/test';
  17  | import { runPageChecks } from './support/checks';
  18  | import { writeCaptureRecord, type CaptureRecord } from './support/capture-record';
  19  | import { CAPTURES_DIR, E2E_OUTPUT_DIR } from './support/demo-ids';
  20  | import { DESKTOP, MOBILE } from './support/devices';
  21  | 
  22  | const RENDER_SCRIPT = path.join('scripts', 'e2e', 'render-dev-page.tsx');
  23  | const OUT_DIR = path.join(E2E_OUTPUT_DIR, 'dev-page');
  24  | 
  25  | /** Rendu par le script (processus séparé : jamais d'import du dépôt dans Playwright, alias @/ en CI). */
  26  | function renderPage(): string {
  27  |     const r = spawnSync(process.execPath, ['--import', 'tsx', RENDER_SCRIPT, '--out', OUT_DIR], { cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 120_000 });
  28  |     if (r.error) throw new Error(`[e2e][dev-page] ${RENDER_SCRIPT} : ${r.error.message}`);
> 29  |     if (r.status !== 0) throw new Error(`[e2e][dev-page] ${RENDER_SCRIPT} : code ${r.status}\n${(r.stderr ?? '').slice(-2000)}`);
      |                               ^ Error: [e2e][dev-page] scripts/e2e/render-dev-page.tsx : code 1
  30  |     const out = (r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean);
  31  |     const last = out[out.length - 1] ?? '';
  32  |     let manifest: { html?: unknown };
  33  |     try {
  34  |         manifest = JSON.parse(last) as { html?: unknown };
  35  |     } catch (err) {
  36  |         throw new Error(`[e2e][dev-page] manifeste illisible (${err instanceof Error ? err.message : String(err)}) : ${last.slice(0, 300)}`);
  37  |     }
  38  |     if (typeof manifest.html !== 'string') throw new Error(`[e2e][dev-page] chemin absent du manifeste : ${last.slice(0, 300)}`);
  39  |     return fs.readFileSync(manifest.html, 'utf8');
  40  | }
  41  | 
  42  | let html = '';
  43  | 
  44  | test.beforeAll(() => {
  45  |     html = renderPage();
  46  | });
  47  | 
  48  | const DEVICES = [{ key: 'mobile', device: MOBILE }, { key: 'ordinateur', device: DESKTOP }] as const;
  49  | const THEMES = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }] as const;
  50  | 
  51  | for (const { key: vue, device } of DEVICES) {
  52  |     for (const theme of THEMES) {
  53  |         test(`page de développement : ${vue}, ${theme.key}`, async ({ browser }, testInfo) => {
  54  |             const file = `dev-paiements__${vue}__${theme.key}.png`;
  55  |             const started = Date.now();
  56  |             const record: CaptureRecord = {
  57  |                 file, screen: 'dev-paiements', titre: 'Page de développement du faux SamirPay (rendu statique, sans route)', vue, theme: theme.key, role: 'anonyme',
  58  |                 url: null, status: null, captured: false, blocking: [], warnings: [], axeDetails: [], notes: ['rendu statique de FakePaymentPanel (L75) : réseau refusé, aucun serveur'], error: null, durationMs: 0,
  59  |             };
  60  |             const { browserName: _browser, ...options } = device;
  61  |             const context = await browser.newContext({ ...options, locale: 'fr-FR', timezoneId: 'Africa/Dakar', colorScheme: theme.scheme });
  62  |             const requests: string[] = [];
  63  |             try {
  64  |                 await context.route('**/*', async (route) => {
  65  |                     requests.push(`${route.request().resourceType()} ${route.request().url().slice(0, 120)}`);
  66  |                     await route.abort('blockedbyclient');
  67  |                 });
  68  |                 const page = await context.newPage();
  69  |                 await page.setContent(html, { waitUntil: 'load' });
  70  |                 await page.evaluate('window.__name = window.__name || function (f) { return f; };'); // aide esbuild, comme emails.spec.ts
  71  |                 await page.evaluate((dark) => {
  72  |                     document.documentElement.classList.toggle('dark', dark);
  73  |                     document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  74  |                 }, theme.key === 'sombre');
  75  | 
  76  |                 await expect(page.getByText('Paiement simulé : aucun argent réel').first(), 'mention permanente de la page').toBeVisible();
  77  |                 await expect(page.getByRole('button', { name: /^valider le paiement$/i })).toBeVisible();
  78  |                 await expect(page.getByRole('button', { name: /^refuser le paiement$/i })).toBeVisible();
  79  | 
  80  |                 const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true });
  81  |                 record.blocking.push(...checks.blocking);
  82  |                 record.warnings.push(...checks.warnings);
  83  |                 record.axeDetails = checks.axeDetails;
  84  |                 record.smallTextDetails = checks.smallTextDetails;
  85  |                 record.metrics = checks.metrics;
  86  |                 if (requests.length > 0) record.blocking.push(`requête(s) réseau émise(s) par la page : ${requests.slice(0, 5).join(' ; ')}`);
  87  | 
  88  |                 fs.mkdirSync(CAPTURES_DIR, { recursive: true });
  89  |                 const target = path.join(CAPTURES_DIR, file);
  90  |                 await page.screenshot({ path: target, animations: 'disabled', caret: 'hide', scale: 'device' });
  91  |                 record.captured = true;
  92  |                 await testInfo.attach(file, { path: target, contentType: 'image/png' });
  93  |             } catch (err) {
  94  |                 record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  95  |                 throw err;
  96  |             } finally {
  97  |                 record.durationMs = Date.now() - started;
  98  |                 writeCaptureRecord(record);
  99  |                 await context.close();
  100 |             }
  101 |             expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
  102 |         });
  103 |     }
  104 | }
  105 | 
```