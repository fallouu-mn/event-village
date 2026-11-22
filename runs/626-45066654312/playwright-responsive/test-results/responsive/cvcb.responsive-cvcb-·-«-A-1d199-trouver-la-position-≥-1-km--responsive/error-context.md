# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cvcb.responsive.spec.ts >> cvcb · « Autour de moi » >> T1 — puis « Rechercher dans cette zone » : la zone envoyée ne doit pas permettre de retrouver la position (≥ 1 km)
- Location: e2e/cvcb.responsive.spec.ts:181:9

# Error details

```
Error: position retrouvée au centre de la zone envoyée (6.8 m) : ?zone=14.6783%2C-17.4988%2C14.7648%2C-17.4377

expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 1000
Received:    6.832835772313987
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e13]:
          - button "Notifications" [ref=e15] [cursor=pointer]
          - button "Basculer le thème" [ref=e20] [cursor=pointer]
          - link "Se connecter" [ref=e24] [cursor=pointer]:
            - /url: /login
      - main [ref=e28]:
        - generic [ref=e30]:
          - generic [ref=e32]:
            - generic [ref=e33]:
              - heading "Explorer les événements" [level=1] [ref=e34]
              - paragraph [ref=e35]: Concerts, festivals, soirées et rencontres à venir au Sénégal. La liste se met à jour d’elle-même.
            - status [ref=e37]: En direct
          - region "Recherche et filtres" [ref=e39]:
            - generic [ref=e41]:
              - generic [ref=e42]: Rechercher un événement
              - searchbox "Rechercher un événement" [ref=e44]
            - group "Date et prix" [ref=e45]:
              - button "Aujourd’hui" [ref=e46] [cursor=pointer]
              - button "Ce week-end" [ref=e47] [cursor=pointer]
              - button "Cette semaine" [ref=e48] [cursor=pointer]
              - button "Gratuit" [ref=e49] [cursor=pointer]
            - generic [ref=e50]:
              - generic [ref=e51]:
                - generic [ref=e52]: Ville
                - combobox "Ville" [ref=e55] [cursor=pointer]:
                  - option "Toutes les villes" [selected]
                  - option "Dakar"
                  - option "Foundiougne"
                  - option "Gorée"
                  - option "Kaolack"
                  - option "Mbour"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Ziguinchor"
              - generic [ref=e56]:
                - generic [ref=e57]: Trier par
                - combobox "Trier par" [ref=e60] [cursor=pointer]:
                  - option "Date la plus proche" [selected]
                  - option "Prix croissant"
          - group "Catégorie" [ref=e62]:
            - button "Toutes les catégories" [pressed] [ref=e63] [cursor=pointer]:
              - generic [aria-hidden] [ref=e64]: ✓
              - text: Toutes les catégories
            - button "Concerts & Musique" [ref=e65] [cursor=pointer]
            - button "Festivals" [ref=e66] [cursor=pointer]
            - button "Gastronomie & Tables" [ref=e67] [cursor=pointer]
            - button "Salles & Réceptions" [ref=e68] [cursor=pointer]
          - tablist "Affichage des événements" [ref=e70]:
            - tab "Liste" [ref=e71] [cursor=pointer]
            - tab "Carte" [selected] [ref=e72] [cursor=pointer]
            - tab "Calendrier" [ref=e73] [cursor=pointer]
          - tabpanel "Carte" [ref=e74]:
            - generic [ref=e76]:
              - generic [ref=e77]:
                - generic [ref=e78]:
                  - generic [ref=e79]: Aller à
                  - combobox "Aller à" [ref=e81] [cursor=pointer]:
                    - option "Ville ou quartier" [selected]
                    - option "Tout le Sénégal"
                    - option "Dakar"
                    - option "Almadies"
                    - option "Plateau"
                    - option "Ngor"
                    - option "Ouakam"
                    - option "Mermoz"
                    - option "Sacré-Cœur"
                    - option "Saly"
                    - option "Mbour"
                    - option "Thiès"
                    - option "Saint-Louis"
                    - option "Kaolack"
                    - option "Ziguinchor"
                - button "Autour de moi" [ref=e82] [cursor=pointer]
              - generic [ref=e88]:
                - region "Carte des événements" [ref=e89]:
                  - generic:
                    - generic:
                      - button "Nuit du Sabar — édition d’automne, dim. 22 nov. · 21:30, Dès 5 000 F":
                        - generic [ref=e90] [cursor=pointer]: Dès 5 000 F
                      - 'button "2 événements : agrandir"':
                        - generic [ref=e94] [cursor=pointer]: "2"
                      - 'button "2 événements : agrandir"':
                        - generic [ref=e97] [cursor=pointer]: "2"
                  - generic:
                    - generic [ref=e100]:
                      - button "Zoom avant" [ref=e101] [cursor=pointer]: +
                      - button "Zoom arrière" [ref=e102] [cursor=pointer]: −
                    - generic [ref=e103]:
                      - text: ©
                      - link "Stadia Maps" [ref=e104] [cursor=pointer]:
                        - /url: https://stadiamaps.com/
                      - text: ©
                      - link "OpenMapTiles" [ref=e105] [cursor=pointer]:
                        - /url: https://openmaptiles.org/
                      - text: ©
                      - link "contributeurs OpenStreetMap" [ref=e106] [cursor=pointer]:
                        - /url: https://www.openstreetmap.org/copyright
                - paragraph [ref=e107]: Les repères sont accessibles avec la touche Tabulation, puis Entrée. La vue Liste présente les mêmes événements.
              - paragraph [ref=e108]: 5 événements dans cette zone
    - navigation "Navigation rapide":
      - generic [ref=e109]:
        - link "Accueil" [ref=e111] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e117] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e123] [cursor=pointer]:
          - /url: /tickets
        - link "Avis" [ref=e128] [cursor=pointer]:
          - /url: /notifications
        - link "Portefeuille" [ref=e134] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e140]
```

# Test source

```ts
  91  |     expect(res.status(), 'lecture de la carte').toBe(200);
  92  |     return ((await res.json()) as { events: Array<Record<string, unknown>> }).events;
  93  | }
  94  | 
  95  | async function ficheHtml(request: APIRequestContext, id: string): Promise<string> {
  96  |     const res = await request.get(`/events/${id}`);
  97  |     expect(res.status(), 'fiche').toBe(200);
  98  |     return res.text();
  99  | }
  100 | 
  101 | /** Session API de la partenaire « organisateur3 » (vraie route de connexion). */
  102 | async function organisateur3(): Promise<{ api: APIRequestContext; userId: string; partnerId: string }> {
  103 |     const acc = readDemoIds().accounts.organisateur3;
  104 |     const api = await pwRequest.newContext({ baseURL: APP_URL });
  105 |     const res = await api.post('/api/auth/login', { data: { identifier: acc.email, password: TEST_PASSWORD } });
  106 |     expect(res.status(), `connexion d’organisateur3 : ${await res.text()}`).toBe(200);
  107 |     const { data, error } = await serviceClient().from('partners').select('id').eq('user_id', acc.userId).single();
  108 |     if (error || !data) throw new Error(`[cvcb] partenaire d’organisateur3 : ${error?.message ?? 'introuvable'}`);
  109 |     return { api, userId: acc.userId, partnerId: String(data.id) };
  110 | }
  111 | 
  112 | async function publish(partnerUserId: string, title: string, offsetDays: number, lat = 14.7215, lng = -17.4683): Promise<string> {
  113 |     const day = dakarDayFrom(new Date(), offsetDays);
  114 |     return createPublishedEvent({
  115 |         partnerUserId,
  116 |         superadminId: await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email),
  117 |         title,
  118 |         description: 'Contre-vérification du lot Carte B (invalidation). Données fictives.',
  119 |         startDate: day, startTime: '20:00:00', endDate: day, endTime: '23:00:00',
  120 |         location: 'Esplanade de contre-vérification', city: 'Dakar', capacity: 100,
  121 |         imageUrl: await partnerPosterOf(partnerUserId),
  122 |         latitude: lat, longitude: lng,
  123 |         category: { name: 'Standard', price: 3500, total: 50 },
  124 |     });
  125 | }
  126 | 
  127 | async function updatedAt(id: string): Promise<string> {
  128 |     const { data, error } = await serviceClient().from('events').select('updated_at').eq('id', id).single();
  129 |     if (error || !data) throw new Error(`[cvcb] updated_at de ${id} : ${error?.message ?? 'introuvable'}`);
  130 |     return String(data.updated_at);
  131 | }
  132 | 
  133 | async function editEvent(api: APIRequestContext, id: string, patch: Record<string, unknown>): Promise<void> {
  134 |     const res = await api.put(`/api/partner/events/${id}`, { data: { patch, expected_updated_at: await updatedAt(id) } });
  135 |     expect(res.status(), `modification ${JSON.stringify(patch)} : ${await res.text()}`).toBe(200);
  136 | }
  137 | 
  138 | // ── « Autour de moi » ──────────────────────────────────────────────────────────────────────────────────────────────
  139 | 
  140 | test.describe('cvcb · « Autour de moi »', () => {
  141 |     test.use({ geolocation: POS, permissions: ['geolocation'] });
  142 | 
  143 |     async function openMapAroundMe(page: Page): Promise<{ urls: string[]; bodies: string[]; tiles: string[] }> {
  144 |         const urls: string[] = [];
  145 |         const bodies: string[] = [];
  146 |         const tiles: string[] = [];
  147 |         page.on('request', (r) => {
  148 |             const u = new URL(r.url());
  149 |             if (TILE_HOST.test(u.hostname)) {
  150 |                 tiles.push(r.url());
  151 |                 return;
  152 |             }
  153 |             urls.push(r.url());
  154 |             const body = r.postData();
  155 |             if (body) bodies.push(body);
  156 |         });
  157 |         await page.setViewportSize({ width: 390, height: 844 });
  158 |         await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  159 |         await expect(page.getByRole('region', { name: 'Carte des événements' })).toBeVisible({ timeout: 30_000 });
  160 |         await expect(page.locator('.leaflet-control-attribution')).toContainText('Stadia Maps', { timeout: 30_000 });
  161 |         urls.length = 0;
  162 |         bodies.length = 0;
  163 |         await page.getByRole('button', { name: 'Autour de moi' }).click();
  164 |         await expect(page.getByRole('button', { name: 'Rechercher dans cette zone' })).toBeVisible({ timeout: 15_000 });
  165 |         await page.waitForTimeout(1_500);
  166 |         return { urls, bodies, tiles };
  167 |     }
  168 | 
  169 |     test('G1 — « Autour de moi » seul : aucune requête, aucun stockage, aucun cookie ne porte la position', async ({ page, context }) => {
  170 |         test.setTimeout(120_000);
  171 |         const seen = await openMapAroundMe(page);
  172 |         const carried = [...seen.urls, ...seen.bodies].filter((t) => nearPosition(t).length > 0);
  173 |         console.log(`[cvcb] « Autour de moi » : ${seen.urls.length} requête(s) hors tuiles, ${seen.tiles.length} tuile(s) ; porteuses de la position : ${carried.length}`);
  174 |         expect(carried, 'requêtes qui portent la position').toEqual([]);
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
> 191 |         expect(d, `position retrouvée au centre de la zone envoyée (${d.toFixed(1)} m) : ${url.search}`).toBeGreaterThanOrEqual(1_000);
      |                                                                                                          ^ Error: position retrouvée au centre de la zone envoyée (6.8 m) : ?zone=14.6783%2C-17.4988%2C14.7648%2C-17.4377
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
  275 |         expect(elapsed ?? Infinity, 'en moins de 5 s').toBeLessThan(MAX_STALE_MS);
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
```