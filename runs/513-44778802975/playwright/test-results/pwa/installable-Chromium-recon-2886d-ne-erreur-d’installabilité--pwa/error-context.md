# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: installable.spec.ts >> Chromium reconnaît l’application installable (beforeinstallprompt, aucune erreur d’installabilité)
- Location: e2e/installable.spec.ts:110:5

# Error details

```
Error: beforeinstallprompt jamais reçu en 15 s (page.waitForFunction: Timeout 15000ms exceeded.)
```

# Test source

```ts
  18  | import { chromium, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
  19  | import { test, expect } from './support/fixtures';
  20  | import { FR_CONTEXT, FR_LANG_ARG, MOBILE, frBrowserEnv } from './support/devices';
  21  | import { APP_URL, e2eConfig } from './support/env';
  22  | import { installNetworkGuard } from './support/network';
  23  | 
  24  | interface ObservedResponse { url: string; path: string; type: string; status: number }
  25  | interface FetchedBytes { status: number; contentType: string; head: number[]; text: string | null }
  26  | interface ManifestIcon { src: string; sizes?: string; type?: string; purpose?: string }
  27  | 
  28  | /** Contexte persistant du Chromium complet ; échec explicite si le binaire manque. */
  29  | async function persistentContext(testInfo: TestInfo, profil: string): Promise<BrowserContext> {
  30  |     const dir = testInfo.outputPath(profil);
  31  |     fs.rmSync(dir, { recursive: true, force: true });
  32  |     let context: BrowserContext;
  33  |     try {
  34  |         context = await chromium.launchPersistentContext(dir, {
  35  |             channel: 'chromium',
  36  |             headless: true,
  37  |             // Navigateur en français à l'heure de Dakar, comme les projets de playwright.config.ts (mini-lot stabilite/langue)
  38  |             args: ['--host-resolver-rules=MAP localhost 127.0.0.1', FR_LANG_ARG],
  39  |             env: frBrowserEnv(),
  40  |             baseURL: APP_URL,
  41  |             viewport: MOBILE.viewport,
  42  |             deviceScaleFactor: MOBILE.deviceScaleFactor,
  43  |             isMobile: MOBILE.isMobile,
  44  |             hasTouch: MOBILE.hasTouch,
  45  |             userAgent: MOBILE.userAgent,
  46  |             ...FR_CONTEXT,
  47  |         });
  48  |     } catch (err) {
  49  |         const message = err instanceof Error ? err.message : String(err);
  50  |         if (/executable doesn'?t exist|not found|is not installed|no such file/i.test(message)) {
  51  |             throw new Error(`binaire Chromium complet absent : npx playwright install chromium (${message.split('\n')[0]})`);
  52  |         }
  53  |         throw err;
  54  |     }
  55  |     await installNetworkGuard(context, e2eConfig().allowedHosts);
  56  |     await context.addInitScript({ content: 'window.__name = window.__name || function (f) { return f; };' });
  57  |     await context.addInitScript(() => {
  58  |         const w = window as unknown as { __evInstallPrompts: number };
  59  |         w.__evInstallPrompts = 0;
  60  |         window.addEventListener('beforeinstallprompt', () => { w.__evInstallPrompts += 1; });
  61  |     });
  62  |     return context;
  63  | }
  64  | 
  65  | function observe(context: BrowserContext): ObservedResponse[] {
  66  |     const seen: ObservedResponse[] = [];
  67  |     context.on('response', (r) => {
  68  |         let p = '';
  69  |         try {
  70  |             p = new URL(r.url()).pathname;
  71  |         } catch (err) {
  72  |             p = `(URL illisible : ${err instanceof Error ? err.message : String(err)})`;
  73  |         }
  74  |         seen.push({ url: r.url(), path: p, type: r.request().resourceType(), status: r.status() });
  75  |     });
  76  |     return seen;
  77  | }
  78  | 
  79  | /** Ressource demandée par la page (même origine, résolution forcée en IPv4 par le navigateur). */
  80  | async function fetchFromPage(page: Page, url: string, asText: boolean): Promise<FetchedBytes> {
  81  |     return page.evaluate(async ({ u, t }) => {
  82  |         const res = await fetch(u, { cache: 'no-store', credentials: 'omit' });
  83  |         const buf = new Uint8Array(await res.arrayBuffer());
  84  |         return {
  85  |             status: res.status,
  86  |             contentType: res.headers.get('content-type') ?? '',
  87  |             head: Array.from(buf.slice(0, 32)),
  88  |             text: t ? new TextDecoder().decode(buf) : null,
  89  |         };
  90  |     }, { u: url, t: asText });
  91  | }
  92  | 
  93  | /** Largeur et hauteur d'un PNG lues dans l'en-tête IHDR (octets 16 à 23), null si ce n'est pas un PNG. */
  94  | function pngSize(head: number[]): { width: number; height: number; colorType: number } | null {
  95  |     const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  96  |     if (head.length < 26 || sig.some((b, i) => head[i] !== b)) return null;
  97  |     const u32 = (o: number) => ((head[o] << 24) | (head[o + 1] << 16) | (head[o + 2] << 8) | head[o + 3]) >>> 0;
  98  |     return { width: u32(16), height: u32(20), colorType: head[25] };
  99  | }
  100 | 
  101 | async function installabilityErrors(context: BrowserContext, page: Page): Promise<string[]> {
  102 |     const cdp = await context.newCDPSession(page);
  103 |     const out = await cdp.send('Page.getInstallabilityErrors') as { installabilityErrors?: Array<{ errorId: string; errorArguments?: Array<{ name: string; value: string }> }> };
  104 |     await cdp.detach();
  105 |     return (out.installabilityErrors ?? []).map((e) => `${e.errorId}${e.errorArguments?.length ? ` (${e.errorArguments.map((a) => `${a.name}=${a.value}`).join(', ')})` : ''}`);
  106 | }
  107 | 
  108 | test.describe.configure({ mode: 'default' });
  109 | 
  110 | test('Chromium reconnaît l’application installable (beforeinstallprompt, aucune erreur d’installabilité)', async ({}, testInfo) => {
  111 |     const context = await persistentContext(testInfo, 'profil');
  112 |     try {
  113 |         const seen = observe(context);
  114 |         const page = context.pages()[0] ?? await context.newPage();
  115 |         await page.goto('/');
  116 |         await page.waitForFunction(() => ((window as unknown as { __evInstallPrompts?: number }).__evInstallPrompts ?? 0) > 0, null, { timeout: 15_000 })
  117 |             .catch((err: unknown) => {
> 118 |                 throw new Error(`beforeinstallprompt jamais reçu en 15 s (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
      |                       ^ Error: beforeinstallprompt jamais reçu en 15 s (page.waitForFunction: Timeout 15000ms exceeded.)
  119 |             });
  120 |         const errors = await installabilityErrors(context, page);
  121 |         console.log(`[e2e][pwa] Page.getInstallabilityErrors : ${errors.length === 0 ? 'aucune' : errors.join(' ; ')}`);
  122 |         expect(errors, 'Page.getInstallabilityErrors : liste vide attendue').toEqual([]);
  123 | 
  124 |         await expect.poll(() => seen.filter((r) => r.type === 'manifest' && r.path === '/manifest.json').map((r) => r.status), {
  125 |             message: 'manifest demandé par Chromium (type « manifest ») vers /manifest.json', timeout: 15_000,
  126 |         }).toContain(200);
  127 |         const manifest = await fetchFromPage(page, '/manifest.json', true);
  128 |         expect(manifest.status, 'manifest servi').toBe(200);
  129 |         const icons = (JSON.parse(manifest.text ?? '{}') as { icons?: ManifestIcon[] }).icons ?? [];
  130 |         expect(icons.length, 'icônes déclarées dans le manifest').toBeGreaterThan(0);
  131 |         const iconPaths = new Set(icons.map((i) => new URL(i.src, APP_URL).pathname));
  132 |         await expect.poll(() => seen.filter((r) => iconPaths.has(r.path) && r.status === 200).map((r) => r.path), {
  133 |             message: `au moins une icône déclarée demandée par Chromium et servie en 200 (${Array.from(iconPaths).join(', ')})`, timeout: 15_000,
  134 |         }).not.toEqual([]);
  135 |         for (const icon of icons) {
  136 |             const got = await fetchFromPage(page, icon.src, false);
  137 |             const size = pngSize(got.head);
  138 |             expect.soft({ src: icon.src, status: got.status, type: got.contentType.split(';')[0], size: size ? `${size.width}x${size.height}` : null },
  139 |                 `icône ${icon.src} servie sans session`).toEqual({ src: icon.src, status: 200, type: 'image/png', size: icon.sizes ?? null });
  140 |         }
  141 |         const failed = seen.filter((r) => r.status >= 400);
  142 |         expect(failed.map((r) => `${r.status} ${r.url}`), 'aucune réponse en erreur pendant le chargement de l’accueil').toEqual([]);
  143 |     } finally {
  144 |         await context.close();
  145 |     }
  146 | });
  147 | 
  148 | test('témoin négatif : manifest servi sans icône → Chromium signale l’icône manquante', async ({}, testInfo) => {
  149 |     const context = await persistentContext(testInfo, 'profil-temoin');
  150 |     try {
  151 |         await context.route('**/manifest.json', async (route) => {
  152 |             const original = await route.fetch();
  153 |             const body = (await original.json()) as Record<string, unknown>;
  154 |             delete body.icons;
  155 |             await route.fulfill({ status: 200, contentType: 'application/manifest+json', body: JSON.stringify(body) });
  156 |         });
  157 |         const page = context.pages()[0] ?? await context.newPage();
  158 |         await page.goto('/');
  159 |         await expect.poll(() => installabilityErrors(context, page), {
  160 |             message: 'manifest sans icône : manifest-missing-suitable-icon ou no-acceptable-icon attendu (sinon : headless shell, faux positif)', timeout: 15_000,
  161 |         }).toEqual(expect.arrayContaining([expect.stringMatching(/^(manifest-missing-suitable-icon|no-acceptable-icon)/)]));
  162 |     } finally {
  163 |         await context.close();
  164 |     }
  165 | });
  166 | 
  167 | test('manifest servi : id, scope, start_url, standalone, couleurs, icônes 192 et 512 dont une maskable (contrat 4.5)', async ({ page, guard }) => {
  168 |     await page.goto('/manifest.json');
  169 |     const got = await fetchFromPage(page, '/manifest.json', true);
  170 |     expect(got.status, 'manifest servi sans session').toBe(200);
  171 |     const m = JSON.parse(got.text ?? '{}') as Record<string, unknown> & { icons?: ManifestIcon[] };
  172 |     const scope = String(m.scope ?? '');
  173 |     expect.soft(m.id, 'id').toBe('/');
  174 |     expect.soft(scope, 'scope').toBe('/');
  175 |     expect.soft(String(m.start_url ?? '').startsWith(scope || '\u0000'), `start_url « ${String(m.start_url)} » dans le scope « ${scope} »`).toBe(true);
  176 |     expect.soft(m.display, 'display').toBe('standalone');
  177 |     expect.soft(String(m.theme_color ?? ''), 'theme_color #RRGGBB').toMatch(/^#[0-9A-Fa-f]{6}$/);
  178 |     expect.soft(String(m.background_color ?? ''), 'background_color #RRGGBB').toMatch(/^#[0-9A-Fa-f]{6}$/);
  179 |     const icons = m.icons ?? [];
  180 |     const purposeOf = (i: ManifestIcon) => (i.purpose ?? 'any').split(/\s+/);
  181 |     expect.soft(icons.some((i) => i.sizes === '192x192' && purposeOf(i).includes('any')), 'icône 192×192 « any »').toBe(true);
  182 |     expect.soft(icons.some((i) => i.sizes === '512x512' && purposeOf(i).includes('any')), 'icône 512×512 « any »').toBe(true);
  183 |     const maskable = icons.filter((i) => purposeOf(i).includes('maskable'));
  184 |     expect.soft(maskable.length, 'au moins une icône « maskable »').toBeGreaterThan(0);
  185 |     for (const icon of maskable) {
  186 |         const bytes = await fetchFromPage(page, icon.src, false);
  187 |         const size = pngSize(bytes.head);
  188 |         expect.soft({ status: bytes.status, type: bytes.contentType.split(';')[0], size: size ? `${size.width}x${size.height}` : null, colorType: size?.colorType ?? null },
  189 |             `icône maskable ${icon.src} : 200, PNG opaque (type de couleur 2), ${icon.sizes ?? '?'}`).toEqual({ status: 200, type: 'image/png', size: icon.sizes ?? null, colorType: 2 });
  190 |     }
  191 |     expect(guard.blockingIssues(), 'aucune erreur du navigateur').toEqual([]);
  192 | });
  193 | 
  194 | test('iPhone : balises apple-mobile-web-app et icône apple-touch 180×180 dans le <head> de l’accueil', async ({ page, guard }) => {
  195 |     await page.goto('/');
  196 |     const head = await page.evaluate(() => ({
  197 |         appleIcons: Array.from(document.querySelectorAll('link[rel="apple-touch-icon"]')).map((l) => l.getAttribute('href') ?? ''),
  198 |         capable: Array.from(document.querySelectorAll('meta[name="apple-mobile-web-app-capable"]')).map((m) => m.getAttribute('content') ?? ''),
  199 |         title: Array.from(document.querySelectorAll('meta[name="apple-mobile-web-app-title"]')).map((m) => m.getAttribute('content') ?? ''),
  200 |         manifests: Array.from(document.querySelectorAll('link[rel="manifest"]')).map((l) => l.getAttribute('href') ?? ''),
  201 |     }));
  202 |     console.log(`[e2e][pwa] <head> : ${JSON.stringify(head)}`);
  203 |     expect.soft(head.appleIcons.length, `exactement un link[rel=apple-touch-icon] (trouvés : ${JSON.stringify(head.appleIcons)})`).toBe(1);
  204 |     expect.soft(head.capable, 'meta apple-mobile-web-app-capable = yes').toEqual(['yes']);
  205 |     expect.soft(head.title.length === 1 && head.title[0].trim().length > 0, `meta apple-mobile-web-app-title renseignée (${JSON.stringify(head.title)})`).toBe(true);
  206 |     expect.soft(head.manifests, 'link[rel=manifest] vers /manifest.json').toEqual(['/manifest.json']);
  207 |     for (const href of head.appleIcons) {
  208 |         const bytes = await fetchFromPage(page, href, false);
  209 |         const size = pngSize(bytes.head);
  210 |         expect.soft({ href, status: bytes.status, type: bytes.contentType.split(';')[0], size: size ? `${size.width}x${size.height}` : null },
  211 |             `icône apple-touch ${href}`).toEqual({ href, status: 200, type: 'image/png', size: '180x180' });
  212 |     }
  213 |     expect(guard.blockingIssues(), 'aucune erreur du navigateur').toEqual([]);
  214 | });
  215 | 
```