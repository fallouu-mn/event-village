# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: installable.spec.ts >> manifest servi : id, scope, start_url, standalone, couleurs, icônes 192 et 512 dont une maskable (contrat 4.5)
- Location: e2e/installable.spec.ts:166:5

# Error details

```
Error: id

expect(received).toBe(expected) // Object.is equality

Expected: "/"
Received: undefined
```

```
Error: scope

expect(received).toBe(expected) // Object.is equality

Expected: "/"
Received: ""
```

```
Error: start_url « / » dans le scope «  »

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

```
Error: au moins une icône « maskable »

expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: "{ \"name\": \"Event Village\", \"short_name\": \"EventVillage\", \"description\": \"Plateforme événementielle B2C & B2B — Événements, Ticketing, Réservations & Services au Sénégal\", \"start_url\": \"/\", \"display\": \"standalone\", \"background_color\": \"#0F0F11\", \"theme_color\": \"#FF5722\", \"icons\": [ { \"src\": \"/icon-192x192.png\", \"sizes\": \"192x192\", \"type\": \"image/png\" }, { \"src\": \"/icon-512x512.png\", \"sizes\": \"512x512\", \"type\": \"image/png\" } ] }"
```

# Test source

```ts
  83  |         return {
  84  |             status: res.status,
  85  |             contentType: res.headers.get('content-type') ?? '',
  86  |             head: Array.from(buf.slice(0, 32)),
  87  |             text: t ? new TextDecoder().decode(buf) : null,
  88  |         };
  89  |     }, { u: url, t: asText });
  90  | }
  91  | 
  92  | /** Largeur et hauteur d'un PNG lues dans l'en-tête IHDR (octets 16 à 23), null si ce n'est pas un PNG. */
  93  | function pngSize(head: number[]): { width: number; height: number; colorType: number } | null {
  94  |     const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  95  |     if (head.length < 26 || sig.some((b, i) => head[i] !== b)) return null;
  96  |     const u32 = (o: number) => ((head[o] << 24) | (head[o + 1] << 16) | (head[o + 2] << 8) | head[o + 3]) >>> 0;
  97  |     return { width: u32(16), height: u32(20), colorType: head[25] };
  98  | }
  99  | 
  100 | async function installabilityErrors(context: BrowserContext, page: Page): Promise<string[]> {
  101 |     const cdp = await context.newCDPSession(page);
  102 |     const out = await cdp.send('Page.getInstallabilityErrors') as { installabilityErrors?: Array<{ errorId: string; errorArguments?: Array<{ name: string; value: string }> }> };
  103 |     await cdp.detach();
  104 |     return (out.installabilityErrors ?? []).map((e) => `${e.errorId}${e.errorArguments?.length ? ` (${e.errorArguments.map((a) => `${a.name}=${a.value}`).join(', ')})` : ''}`);
  105 | }
  106 | 
  107 | test.describe.configure({ mode: 'default' });
  108 | 
  109 | test('Chromium reconnaît l’application installable (beforeinstallprompt, aucune erreur d’installabilité)', async ({}, testInfo) => {
  110 |     const context = await persistentContext(testInfo, 'profil');
  111 |     try {
  112 |         const seen = observe(context);
  113 |         const page = context.pages()[0] ?? await context.newPage();
  114 |         await page.goto('/');
  115 |         await page.waitForFunction(() => ((window as unknown as { __evInstallPrompts?: number }).__evInstallPrompts ?? 0) > 0, null, { timeout: 15_000 })
  116 |             .catch((err: unknown) => {
  117 |                 throw new Error(`beforeinstallprompt jamais reçu en 15 s (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
  118 |             });
  119 |         const errors = await installabilityErrors(context, page);
  120 |         console.log(`[e2e][pwa] Page.getInstallabilityErrors : ${errors.length === 0 ? 'aucune' : errors.join(' ; ')}`);
  121 |         expect(errors, 'Page.getInstallabilityErrors : liste vide attendue').toEqual([]);
  122 | 
  123 |         await expect.poll(() => seen.filter((r) => r.type === 'manifest' && r.path === '/manifest.json').map((r) => r.status), {
  124 |             message: 'manifest demandé par Chromium (type « manifest ») vers /manifest.json', timeout: 15_000,
  125 |         }).toContain(200);
  126 |         const manifest = await fetchFromPage(page, '/manifest.json', true);
  127 |         expect(manifest.status, 'manifest servi').toBe(200);
  128 |         const icons = (JSON.parse(manifest.text ?? '{}') as { icons?: ManifestIcon[] }).icons ?? [];
  129 |         expect(icons.length, 'icônes déclarées dans le manifest').toBeGreaterThan(0);
  130 |         const iconPaths = new Set(icons.map((i) => new URL(i.src, APP_URL).pathname));
  131 |         await expect.poll(() => seen.filter((r) => iconPaths.has(r.path) && r.status === 200).map((r) => r.path), {
  132 |             message: `au moins une icône déclarée demandée par Chromium et servie en 200 (${Array.from(iconPaths).join(', ')})`, timeout: 15_000,
  133 |         }).not.toEqual([]);
  134 |         for (const icon of icons) {
  135 |             const got = await fetchFromPage(page, icon.src, false);
  136 |             const size = pngSize(got.head);
  137 |             expect.soft({ src: icon.src, status: got.status, type: got.contentType.split(';')[0], size: size ? `${size.width}x${size.height}` : null },
  138 |                 `icône ${icon.src} servie sans session`).toEqual({ src: icon.src, status: 200, type: 'image/png', size: icon.sizes ?? null });
  139 |         }
  140 |         const failed = seen.filter((r) => r.status >= 400);
  141 |         expect(failed.map((r) => `${r.status} ${r.url}`), 'aucune réponse en erreur pendant le chargement de l’accueil').toEqual([]);
  142 |     } finally {
  143 |         await context.close();
  144 |     }
  145 | });
  146 | 
  147 | test('témoin négatif : manifest servi sans icône → Chromium signale l’icône manquante', async ({}, testInfo) => {
  148 |     const context = await persistentContext(testInfo, 'profil-temoin');
  149 |     try {
  150 |         await context.route('**/manifest.json', async (route) => {
  151 |             const original = await route.fetch();
  152 |             const body = (await original.json()) as Record<string, unknown>;
  153 |             delete body.icons;
  154 |             await route.fulfill({ status: 200, contentType: 'application/manifest+json', body: JSON.stringify(body) });
  155 |         });
  156 |         const page = context.pages()[0] ?? await context.newPage();
  157 |         await page.goto('/');
  158 |         await expect.poll(() => installabilityErrors(context, page), {
  159 |             message: 'manifest sans icône : manifest-missing-suitable-icon ou no-acceptable-icon attendu (sinon : headless shell, faux positif)', timeout: 15_000,
  160 |         }).toEqual(expect.arrayContaining([expect.stringMatching(/^(manifest-missing-suitable-icon|no-acceptable-icon)/)]));
  161 |     } finally {
  162 |         await context.close();
  163 |     }
  164 | });
  165 | 
  166 | test('manifest servi : id, scope, start_url, standalone, couleurs, icônes 192 et 512 dont une maskable (contrat 4.5)', async ({ page, guard }) => {
  167 |     await page.goto('/manifest.json');
  168 |     const got = await fetchFromPage(page, '/manifest.json', true);
  169 |     expect(got.status, 'manifest servi sans session').toBe(200);
  170 |     const m = JSON.parse(got.text ?? '{}') as Record<string, unknown> & { icons?: ManifestIcon[] };
  171 |     const scope = String(m.scope ?? '');
  172 |     expect.soft(m.id, 'id').toBe('/');
  173 |     expect.soft(scope, 'scope').toBe('/');
  174 |     expect.soft(String(m.start_url ?? '').startsWith(scope || '\u0000'), `start_url « ${String(m.start_url)} » dans le scope « ${scope} »`).toBe(true);
  175 |     expect.soft(m.display, 'display').toBe('standalone');
  176 |     expect.soft(String(m.theme_color ?? ''), 'theme_color #RRGGBB').toMatch(/^#[0-9A-Fa-f]{6}$/);
  177 |     expect.soft(String(m.background_color ?? ''), 'background_color #RRGGBB').toMatch(/^#[0-9A-Fa-f]{6}$/);
  178 |     const icons = m.icons ?? [];
  179 |     const purposeOf = (i: ManifestIcon) => (i.purpose ?? 'any').split(/\s+/);
  180 |     expect.soft(icons.some((i) => i.sizes === '192x192' && purposeOf(i).includes('any')), 'icône 192×192 « any »').toBe(true);
  181 |     expect.soft(icons.some((i) => i.sizes === '512x512' && purposeOf(i).includes('any')), 'icône 512×512 « any »').toBe(true);
  182 |     const maskable = icons.filter((i) => purposeOf(i).includes('maskable'));
> 183 |     expect.soft(maskable.length, 'au moins une icône « maskable »').toBeGreaterThan(0);
      |                                                                     ^ Error: au moins une icône « maskable »
  184 |     for (const icon of maskable) {
  185 |         const bytes = await fetchFromPage(page, icon.src, false);
  186 |         const size = pngSize(bytes.head);
  187 |         expect.soft({ status: bytes.status, type: bytes.contentType.split(';')[0], size: size ? `${size.width}x${size.height}` : null, colorType: size?.colorType ?? null },
  188 |             `icône maskable ${icon.src} : 200, PNG opaque (type de couleur 2), ${icon.sizes ?? '?'}`).toEqual({ status: 200, type: 'image/png', size: icon.sizes ?? null, colorType: 2 });
  189 |     }
  190 |     expect(guard.blockingIssues(), 'aucune erreur du navigateur').toEqual([]);
  191 | });
  192 | 
  193 | test('iPhone : balises apple-mobile-web-app et icône apple-touch 180×180 dans le <head> de l’accueil', async ({ page, guard }) => {
  194 |     await page.goto('/');
  195 |     const head = await page.evaluate(() => ({
  196 |         appleIcons: Array.from(document.querySelectorAll('link[rel="apple-touch-icon"]')).map((l) => l.getAttribute('href') ?? ''),
  197 |         capable: Array.from(document.querySelectorAll('meta[name="apple-mobile-web-app-capable"]')).map((m) => m.getAttribute('content') ?? ''),
  198 |         title: Array.from(document.querySelectorAll('meta[name="apple-mobile-web-app-title"]')).map((m) => m.getAttribute('content') ?? ''),
  199 |         manifests: Array.from(document.querySelectorAll('link[rel="manifest"]')).map((l) => l.getAttribute('href') ?? ''),
  200 |     }));
  201 |     console.log(`[e2e][pwa] <head> : ${JSON.stringify(head)}`);
  202 |     expect.soft(head.appleIcons.length, `exactement un link[rel=apple-touch-icon] (trouvés : ${JSON.stringify(head.appleIcons)})`).toBe(1);
  203 |     expect.soft(head.capable, 'meta apple-mobile-web-app-capable = yes').toEqual(['yes']);
  204 |     expect.soft(head.title.length === 1 && head.title[0].trim().length > 0, `meta apple-mobile-web-app-title renseignée (${JSON.stringify(head.title)})`).toBe(true);
  205 |     expect.soft(head.manifests, 'link[rel=manifest] vers /manifest.json').toEqual(['/manifest.json']);
  206 |     for (const href of head.appleIcons) {
  207 |         const bytes = await fetchFromPage(page, href, false);
  208 |         const size = pngSize(bytes.head);
  209 |         expect.soft({ href, status: bytes.status, type: bytes.contentType.split(';')[0], size: size ? `${size.width}x${size.height}` : null },
  210 |             `icône apple-touch ${href}`).toEqual({ href, status: 200, type: 'image/png', size: '180x180' });
  211 |     }
  212 |     expect(guard.blockingIssues(), 'aucune erreur du navigateur').toEqual([]);
  213 | });
  214 | 
```