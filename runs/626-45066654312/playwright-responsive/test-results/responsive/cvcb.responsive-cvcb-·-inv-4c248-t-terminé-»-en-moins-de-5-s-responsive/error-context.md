# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cvcb.responsive.spec.ts >> cvcb · invalidation >> T2 — fin par la tâche planifiée : la fiche montre « Événement terminé » en moins de 5 s
- Location: e2e/cvcb.responsive.spec.ts:246:9

# Error details

```
Error: en moins de 5 s

expect(received).toBeLessThan(expected)

Expected: < 5000
Received:   52025
```

# Test source

```ts
  175 |         const storage = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }));
  176 |         expect(nearPosition(storage), `stockage : ${storage.slice(0, 300)}`).toEqual([]);
  177 |         const cookies = JSON.stringify(await context.cookies());
  178 |         expect(nearPosition(cookies), 'cookies').toEqual([]);
  179 |     });
  180 | 
  181 |     test('T1 — puis « Rechercher dans cette zone » : la zone envoyée ne doit pas permettre de retrouver la position (≥ 1 km)', async ({ page }) => {
  182 |         test.setTimeout(120_000);
  183 |         await openMapAroundMe(page);
  184 |         const req = page.waitForRequest((r) => r.url().includes('/api/events/carte') && r.url().includes('zone='), { timeout: 15_000 });
  185 |         await page.getByRole('button', { name: 'Rechercher dans cette zone' }).click();
  186 |         const url = new URL((await req).url());
  187 |         const [s, w, n, e] = (url.searchParams.get('zone') ?? '').split(',').map(Number);
  188 |         const centre = { lat: (s + n) / 2, lng: (w + e) / 2 };
  189 |         const d = metres({ lat: POS.latitude, lng: POS.longitude }, centre);
  190 |         console.log(`[cvcb] « Rechercher dans cette zone » après « Autour de moi » : ${url.pathname}${url.search} ; centre à ${d.toFixed(1)} m de la position`);
  191 |         expect(d, `position retrouvée au centre de la zone envoyée (${d.toFixed(1)} m) : ${url.search}`).toBeGreaterThanOrEqual(1_000);
  192 |     });
  193 | });
  194 | 
  195 | // ── Invalidation ───────────────────────────────────────────────────────────────────────────────────────────────────
  196 | 
  197 | test.describe('cvcb · invalidation', () => {
  198 |     test('G2 — position, dates, affiche, titre, annulation : carte ou Explorer à jour en moins de 5 s', async ({ page }) => {
  199 |         test.setTimeout(420_000);
  200 |         const o3 = await organisateur3();
  201 |         const tag = `${STAMP}g2`;
  202 |         const ev = {
  203 |             position: await publish(o3.userId, `CVCB position ${tag}`, 6),
  204 |             dates: await publish(o3.userId, `CVCB dates ${tag}`, 6),
  205 |             affiche: await publish(o3.userId, `CVCB affiche ${tag}`, 6),
  206 |             titre: await publish(o3.userId, `CVCB titre ${tag}`, 6),
  207 |             annulation: await publish(o3.userId, `CVCB annulation ${tag}`, 6),
  208 |         };
  209 |         // Entrée dans le cache (créés par la base, sans invalidation : jusqu'à 60 s)
  210 |         await waitUntil('événements sur la carte', async () => {
  211 |             const shown = new Set((await mapEvents(page.request, tag)).map((e) => String(e.id)));
  212 |             return Object.values(ev).every((id) => shown.has(id));
  213 |         }, 80_000, 1_000);
  214 |         await waitUntil('événements sur l’Explorer', async () => (await exploreHtml(page.request, tag)).includes(`CVCB affiche ${tag}`), 80_000, 1_000);
  215 |         const results: Record<string, number | null> = {};
  216 | 
  217 |         await editEvent(o3.api, ev.position, { latitude: 14.6681, longitude: -17.4357 });
  218 |         results.position = await measure(async () => (await mapEvents(page.request, tag)).some((e) => e.id === ev.position && e.lat === 14.6681 && e.lng === -17.4357), 65_000);
  219 | 
  220 |         const newDay = dakarDayFrom(new Date(), 9);
  221 |         await editEvent(o3.api, ev.dates, { start_date: newDay, end_date: newDay });
  222 |         results.dates = await measure(async () => (await mapEvents(page.request, tag)).some((e) => e.id === ev.dates && String(e.startsAt).startsWith(newDay)), 65_000);
  223 | 
  224 |         const poster = await partnerPosterOf(o3.userId);
  225 |         const file = poster.split('/').pop() ?? '';
  226 |         await editEvent(o3.api, ev.affiche, { image_url: poster });
  227 |         results.affiche = await measure(async () => (await exploreHtml(page.request, `CVCB affiche ${tag}`)).includes(file), 65_000);
  228 | 
  229 |         await editEvent(o3.api, ev.titre, { title: `CVCB titre renommé ${tag}` });
  230 |         results.titre = await measure(async () => (await mapEvents(page.request, tag)).some((e) => e.id === ev.titre && e.title === `CVCB titre renommé ${tag}`), 65_000);
  231 | 
  232 |         const cancel = await o3.api.post(`/api/partner/events/${ev.annulation}/cancel`, {
  233 |             data: { publicNotice: 'Annulé pour la contre-vérification de la carte.', internalReason: 'cvcb', confirmTitle: `CVCB annulation ${tag}` },
  234 |         });
  235 |         expect(cancel.status(), `annulation : ${await cancel.text()}`).toBe(200);
  236 |         results.annulation = await measure(async () => !(await mapEvents(page.request, tag)).some((e) => e.id === ev.annulation), 65_000);
  237 | 
  238 |         console.log(`[cvcb] invalidations (ms ; null = plus de 65 s) : ${JSON.stringify(results)}`);
  239 |         for (const [what, ms] of Object.entries(results)) {
  240 |             expect.soft(ms, `${what} : visible en moins de 5 s`).not.toBeNull();
  241 |             if (ms !== null) expect.soft(ms, `${what} : ${ms} ms`).toBeLessThan(MAX_STALE_MS);
  242 |         }
  243 |         await o3.api.dispose();
  244 |     });
  245 | 
  246 |     test('T2 — fin par la tâche planifiée : la fiche montre « Événement terminé » en moins de 5 s', async ({ page }) => {
  247 |         test.setTimeout(300_000);
  248 |         const secret = process.env.CRON_SECRET;
  249 |         expect(secret, `CRON_SECRET absente de ${e2eConfig().envFile}`).toBeTruthy();
  250 |         const o3 = await organisateur3();
  251 |         const id = await publish(o3.userId, `CVCB fin planifiée ${STAMP}`, 6);
  252 |         await o3.api.dispose();
  253 |         // Le temps passe : fin il y a une heure (heure de Dakar = UTC), sans écriture de l'application (rien n'invalide)
  254 |         const start = new Date(Date.now() - 3 * 3_600_000);
  255 |         const end = new Date(Date.now() - 3_600_000);
  256 |         const parts = (d: Date) => ({ date: d.toISOString().slice(0, 10), time: `${d.toISOString().slice(11, 16)}:00` });
  257 |         const s = parts(start);
  258 |         const e = parts(end);
  259 |         const { error } = await serviceClient().from('events').update({ start_date: s.date, start_time: s.time, end_date: e.date, end_time: e.time }).eq('id', id);
  260 |         expect(error, `fin passée : ${error?.message}`).toBeNull();
  261 |         const endIso = `${e.date}T${e.time}.000Z`;
  262 |         // Cache de la fiche rempli APRÈS le passage de l'heure (publiée, fin passée) : la fiche vient d'être préparée
  263 |         await waitUntil('fiche préparée avec la fin passée', async () => (await ficheHtml(page.request, id)).includes(endIso), 80_000, 1_000);
  264 |         expect(await ficheHtml(page.request, id), 'avant la tâche : pas encore « terminé »').not.toContain('Événement terminé');
  265 | 
  266 |         const cron = await fetch(`http://127.0.0.1:${PORT}/api/cron/events-finish`, { headers: { authorization: `Bearer ${secret}` } });
  267 |         const report = await cron.text();
  268 |         expect(cron.status, `tâche planifiée : ${report.slice(0, 300)}`).toBe(200);
  269 |         expect(report, 'événement passé à TERMINE par la tâche').toContain(id);
  270 |         const { data: row } = await serviceClient().from('events').select('status').eq('id', id).single();
  271 |         expect(row?.status, 'statut en base').toBe('TERMINE');
  272 |         const elapsed = await measure(async () => (await ficheHtml(page.request, id)).includes('Événement terminé'), 70_000);
  273 |         console.log(`[cvcb] fin planifiée visible sur la fiche après ${elapsed === null ? 'plus de 70 000' : elapsed} ms`);
  274 |         expect(elapsed, 'la fiche montre « Événement terminé »').not.toBeNull();
> 275 |         expect(elapsed ?? Infinity, 'en moins de 5 s').toBeLessThan(MAX_STALE_MS);
      |                                                        ^ Error: en moins de 5 s
  276 |     });
  277 | 
  278 |     test('T3 — nouveau nom commercial de la partenaire : la fiche suit en moins de 5 s', async ({ page }) => {
  279 |         test.setTimeout(300_000);
  280 |         const o3 = await organisateur3();
  281 |         const title = `CVCB nom ${STAMP}`;
  282 |         const id = await publish(o3.userId, title, 6);
  283 |         const { data: before } = await serviceClient().from('partners').select('commercial_name').eq('id', o3.partnerId).single();
  284 |         const oldName = String(before?.commercial_name ?? '');
  285 |         expect(oldName.length, 'nom commercial actuel').toBeGreaterThan(1);
  286 |         // Fiche préparée avec l'ancien nom (organisateur affiché sous le titre)
  287 |         await waitUntil('fiche avec le nom de la partenaire', async () => {
  288 |             const html = await ficheHtml(page.request, id);
  289 |             return html.includes(title) && html.includes(oldName);
  290 |         }, 80_000, 1_000);
  291 |         const newName = `Petite-Côte CVCB ${STAMP}`;
  292 |         try {
  293 |             const res = await o3.api.patch('/api/partner/profile', { data: { commercial_name: newName } });
  294 |             expect(res.status(), `nouveau nom : ${await res.text()}`).toBe(200);
  295 |             const elapsed = await measure(async () => (await ficheHtml(page.request, id)).includes(newName), 70_000);
  296 |             console.log(`[cvcb] nouveau nom commercial visible sur la fiche après ${elapsed === null ? 'plus de 70 000' : elapsed} ms (événement ${id})`);
  297 |             expect(elapsed, 'nouveau nom visible').not.toBeNull();
  298 |             expect(elapsed ?? Infinity, 'en moins de 5 s').toBeLessThan(MAX_STALE_MS);
  299 |         } finally {
  300 |             const back = await o3.api.patch('/api/partner/profile', { data: { commercial_name: oldName } });
  301 |             console.log(`[cvcb] nom commercial rétabli : HTTP ${back.status()}`);
  302 |             await o3.api.dispose();
  303 |         }
  304 |     });
  305 | });
  306 | 
  307 | // ── Middleware : requêtes brutes ───────────────────────────────────────────────────────────────────────────────────
  308 | 
  309 | function rawGet(pathname: string): Promise<{ status: number; type: string; location: string; body: string }> {
  310 |     return new Promise((resolve, reject) => {
  311 |         const req = http.request({ host: '127.0.0.1', port: Number(PORT), method: 'GET', path: pathname, headers: { host: `localhost:${PORT}` } }, (res) => {
  312 |             const chunks: Buffer[] = [];
  313 |             res.on('data', (c: Buffer) => chunks.push(c));
  314 |             res.on('end', () => resolve({
  315 |                 status: res.statusCode ?? 0,
  316 |                 type: String(res.headers['content-type'] ?? ''),
  317 |                 location: String(res.headers.location ?? ''),
  318 |                 body: Buffer.concat(chunks).toString('utf8').slice(0, 4_000),
  319 |             }));
  320 |         });
  321 |         req.on('error', reject);
  322 |         req.setTimeout(20_000, () => req.destroy(new Error(`délai dépassé : ${pathname}`)));
  323 |         req.end();
  324 |     });
  325 | }
  326 | 
  327 | test.describe('cvcb · middleware', () => {
  328 |     test('G3 — /leaflet/ ne sert que ses fichiers ; aucun chemin détourné ne sert une page ou une route protégée', async () => {
  329 |         test.setTimeout(240_000);
  330 |         const css = await rawGet('/leaflet/leaflet-1.9.4.css');
  331 |         expect(css.status, 'feuille de style').toBe(200);
  332 |         expect(css.type).toContain('text/css');
  333 |         const png = await rawGet('/leaflet/marker-icon.png');
  334 |         expect(png.status, 'icône').toBe(200);
  335 |         expect((await rawGet('/leaflet/inexistant.js')).status, 'fichier absent').toBe(404);
  336 | 
  337 |         const targets = ['admin', 'admin/events', 'partner/dashboard', 'tickets', 'controller/scanner', 'api/admin/users', 'api/partner/profile', 'api/tickets', 'api/auth/me'];
  338 |         const forms = (t: string): string[] => [
  339 |             `/leaflet/../${t}`, `/leaflet/%2e%2e/${t}`, `/leaflet/..%2f${t}`, `/leaflet/..%2F${t}`, `/leaflet/%2e%2e%2f${t}`,
  340 |             `/leaflet/..%5c${t}`, `/leaflet/..\\${t}`, `/leaflet//../${t}`, `/leaflet/%252e%252e/${t}`, `/leaflet/..;/${t}`,
  341 |             `/leaflet/%2f${t}`, `/leaflet/${t}`, `/leaflet/x/../../${t}`, `//leaflet/../${t}`, `/leaflet/.%2e/${t}`,
  342 |         ];
  343 |         const leaks: string[] = [];
  344 |         const summary = new Map<string, number>();
  345 |         for (const t of targets) {
  346 |             for (const p of forms(t)) {
  347 |                 // Redirections suivies (3 au plus) : une redirection vers /admin ou /tickets n'est pas une fuite si la page
  348 |                 // d'arrivée est refusée sans session ; la fuite est une réponse 2xx d'une page ou d'une route protégée
  349 |                 let at = p;
  350 |                 let r = await rawGet(at);
  351 |                 const hops: string[] = [`${r.status}`];
  352 |                 for (let i = 0; i < 3 && r.status >= 300 && r.status < 400 && r.location; i++) {
  353 |                     at = new URL(r.location, `http://localhost:${PORT}`).pathname + new URL(r.location, `http://localhost:${PORT}`).search;
  354 |                     r = await rawGet(at);
  355 |                     hops.push(`${at.slice(0, 30)} ${r.status}`);
  356 |                 }
  357 |                 const key = hops.map((h) => h.replace(/^.* (\d+)$/, '$1')).join('→');
  358 |                 summary.set(key, (summary.get(key) ?? 0) + 1);
  359 |                 const finalPath = at.split('?')[0];
  360 |                 const servedLogin = finalPath === '/login';
  361 |                 if (r.status >= 200 && r.status < 300 && !servedLogin) leaks.push(`${p} → ${hops.join(' → ')} ${r.type} ${r.body.slice(0, 120).replace(/\s+/g, ' ')}`);
  362 |             }
  363 |         }
  364 |         console.log(`[cvcb] middleware, ${targets.length * forms('x').length} chemins détournés : ${JSON.stringify(Object.fromEntries(summary))}`);
  365 |         expect(leaks, leaks.join('\n')).toEqual([]);
  366 |     });
  367 | });
  368 | 
  369 | // ── CSP sous HTTPS de même origine ─────────────────────────────────────────────────────────────────────────────────
  370 | 
  371 | test.describe('cvcb · CSP', () => {
  372 |     test('G4 — aucune violation img-src sous HTTPS de même origine (accueil, Explorer, fiche, salles, tables, connexion, aide)', async ({ browser }, testInfo) => {
  373 |         test.setTimeout(240_000);
  374 |         const mod = await import(pathToFileURL(path.resolve('scripts/e2e/h2-proxy.mjs')).href) as {
  375 |             startH2Proxy: (target: string, dir: string) => Promise<{ origin: string; port: number; close: () => Promise<void> }>;
```