# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: carte-b.responsive.spec.ts >> carte B · invalidation >> arrêt de vente d’une catégorie : l’Explorer suit en moins de 5 s
- Location: e2e/carte-b.responsive.spec.ts:61:9

# Error details

```
Error: l’Explorer montre l’arrêt de vente en moins de 5 s

expect(received).toBeLessThan(expected)

Expected: < 5000
Received:   59305
```

# Test source

```ts
  1  | /**
  2  |  * Lot Carte B — preuves de bout en bout dans le job « responsive » de la CI (projet responsive : nom en
  3  |  * « …responsive.spec.ts ») :
  4  |  *  - invalidation (B0) : l'arrêt de vente d'une catégorie (PATCH /api/partner/events/[id]/categories/[categoryId],
  5  |  *    is_active false) se voit sur l'Explorer en moins de 5 s (avant le lot : jusqu'à 60 s, cache du catalogue) ;
  6  |  * Données : un événement neuf publié par la partenaire de démonstration (titre unique), jamais un événement du seed.
  7  |  */
  8  | import { randomUUID } from 'node:crypto';
  9  | import type { APIRequestContext } from '@playwright/test';
  10 | import { test, expect } from './support/fixtures';
  11 | import { readDemoIds } from './support/demo-ids';
  12 | import { dakarDayFrom } from './support/parcours';
  13 | import { createPublishedEvent, partnerPosterOf, serviceClient, userIdByEmail } from './support/service';
  14 | import { FIXTURE_USERS } from '../tests/helpers/fixture-data';
  15 | 
  16 | const STAMP = randomUUID().slice(0, 8);
  17 | /** Délai maximal entre l'écriture réussie et la page publique à jour (consigne du lot). */
  18 | const MAX_STALE_MS = 5_000;
  19 | 
  20 | /** Événement publié de la partenaire de démonstration « organisateur », sur une position donnée. */
  21 | async function publishDemoEvent(title: string, price: number, lat = 14.6928, lng = -17.4467): Promise<{ id: string; categoryId: string }> {
  22 |     const ids = readDemoIds();
  23 |     const day = dakarDayFrom(new Date(), 6);
  24 |     const id = await createPublishedEvent({
  25 |         partnerUserId: ids.accounts.organisateur.userId,
  26 |         superadminId: await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email),
  27 |         title,
  28 |         description: 'Événement du lot Carte B (invalidation des pages publiques). Données fictives.',
  29 |         startDate: day, startTime: '20:00:00', endDate: day, endTime: '23:00:00',
  30 |         location: 'Esplanade de test', city: 'Dakar', capacity: 100,
  31 |         // Affiche déposée comme par la route de dépôt (event_poster_path_ok n'accepte que ses noms de fichier)
  32 |         imageUrl: await partnerPosterOf(ids.accounts.organisateur.userId),
  33 |         latitude: lat, longitude: lng,
  34 |         category: { name: 'Standard', price, total: 50 },
  35 |     });
  36 |     const { data, error } = await serviceClient().from('ticket_categories').select('id').eq('event_id', id).single();
  37 |     if (error || !data) throw new Error(`[e2e] catégorie de ${id} : ${error?.message ?? 'introuvable'}`);
  38 |     return { id, categoryId: String(data.id) };
  39 | }
  40 | 
  41 | /** Attend que `check` soit vrai ; rend le temps écoulé (ms), ou lève après `timeoutMs`. */
  42 | async function waitUntil(label: string, check: () => Promise<boolean>, timeoutMs: number, stepMs = 250): Promise<number> {
  43 |     const t0 = Date.now();
  44 |     for (;;) {
  45 |         if (await check()) return Date.now() - t0;
  46 |         if (Date.now() - t0 > timeoutMs) throw new Error(`[e2e] ${label} : toujours faux après ${timeoutMs} ms`);
  47 |         await new Promise((r) => setTimeout(r, stepMs));
  48 |     }
  49 | }
  50 | 
  51 | /** HTML de l'Explorer filtré sur le titre (page serveur, catalogue en cache). */
  52 | async function exploreHtml(request: APIRequestContext, title: string): Promise<string> {
  53 |     const res = await request.get(`/explore?q=${encodeURIComponent(title)}`, { headers: { 'cache-control': 'no-cache' } });
  54 |     expect(res.status(), 'Explorer').toBe(200);
  55 |     return res.text();
  56 | }
  57 | 
  58 | test.describe('carte B · invalidation', () => {
  59 |     test.use({ evRole: 'organisateur' });
  60 | 
  61 |     test('arrêt de vente d’une catégorie : l’Explorer suit en moins de 5 s', async ({ page }) => {
  62 |         test.setTimeout(150_000);
  63 |         const title = `Carte B arrêt de vente ${STAMP}`;
  64 |         const ev = await publishDemoEvent(title, 4500);
  65 |         const priced = /4\s?500/;
  66 |         // L'événement entre dans le cache du catalogue (créé par la base, sans invalidation : jusqu'à 60 s)
  67 |         await waitUntil('événement visible avec son prix sur l’Explorer', async () => priced.test(await exploreHtml(page.request, title)), 75_000, 1_000);
  68 | 
  69 |         const res = await page.request.patch(`/api/partner/events/${ev.id}/categories/${ev.categoryId}`, { data: { is_active: false } });
  70 |         expect(res.status(), `arrêt de vente : ${await res.text()}`).toBe(200);
  71 |         const elapsed = await waitUntil('prix retiré de l’Explorer', async () => !priced.test(await exploreHtml(page.request, title)), 65_000);
  72 |         console.log(`[carte-b] arrêt de vente visible sur l'Explorer après ${elapsed} ms`);
> 73 |         expect(elapsed, 'l’Explorer montre l’arrêt de vente en moins de 5 s').toBeLessThan(MAX_STALE_MS);
     |                                                                               ^ Error: l’Explorer montre l’arrêt de vente en moins de 5 s
  74 |     });
  75 | });
  76 | 
```