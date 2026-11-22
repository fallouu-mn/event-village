/**
 * Lot Carte B — preuves de bout en bout dans le job « responsive » de la CI (projet responsive : nom en
 * « …responsive.spec.ts ») :
 *  - invalidation (B0) : l'arrêt de vente d'une catégorie (PATCH /api/partner/events/[id]/categories/[categoryId],
 *    is_active false) se voit sur l'Explorer en moins de 5 s (avant le lot : jusqu'à 60 s, cache du catalogue) ;
 * Données : un événement neuf publié par la partenaire de démonstration (titre unique), jamais un événement du seed.
 */
import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { readDemoIds } from './support/demo-ids';
import { dakarDayFrom } from './support/parcours';
import { createPublishedEvent, partnerPosterOf, serviceClient, userIdByEmail } from './support/service';
import { FIXTURE_USERS } from '../tests/helpers/fixture-data';

const STAMP = randomUUID().slice(0, 8);
/** Délai maximal entre l'écriture réussie et la page publique à jour (consigne du lot). */
const MAX_STALE_MS = 5_000;

/** Événement publié de la partenaire de démonstration « organisateur », sur une position donnée. */
async function publishDemoEvent(title: string, price: number, lat = 14.6928, lng = -17.4467): Promise<{ id: string; categoryId: string }> {
    const ids = readDemoIds();
    const day = dakarDayFrom(new Date(), 6);
    const id = await createPublishedEvent({
        partnerUserId: ids.accounts.organisateur.userId,
        superadminId: await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email),
        title,
        description: 'Événement du lot Carte B (invalidation des pages publiques). Données fictives.',
        startDate: day, startTime: '20:00:00', endDate: day, endTime: '23:00:00',
        location: 'Esplanade de test', city: 'Dakar', capacity: 100,
        // Affiche déposée comme par la route de dépôt (event_poster_path_ok n'accepte que ses noms de fichier)
        imageUrl: await partnerPosterOf(ids.accounts.organisateur.userId),
        latitude: lat, longitude: lng,
        category: { name: 'Standard', price, total: 50 },
    });
    const { data, error } = await serviceClient().from('ticket_categories').select('id').eq('event_id', id).single();
    if (error || !data) throw new Error(`[e2e] catégorie de ${id} : ${error?.message ?? 'introuvable'}`);
    return { id, categoryId: String(data.id) };
}

/** Attend que `check` soit vrai ; rend le temps écoulé (ms), ou lève après `timeoutMs`. */
async function waitUntil(label: string, check: () => Promise<boolean>, timeoutMs: number, stepMs = 250): Promise<number> {
    const t0 = Date.now();
    for (;;) {
        if (await check()) return Date.now() - t0;
        if (Date.now() - t0 > timeoutMs) throw new Error(`[e2e] ${label} : toujours faux après ${timeoutMs} ms`);
        await new Promise((r) => setTimeout(r, stepMs));
    }
}

/** HTML de l'Explorer filtré sur le titre (page serveur, catalogue en cache). */
async function exploreHtml(request: APIRequestContext, title: string): Promise<string> {
    const res = await request.get(`/explore?q=${encodeURIComponent(title)}`, { headers: { 'cache-control': 'no-cache' } });
    expect(res.status(), 'Explorer').toBe(200);
    return res.text();
}

test.describe('carte B · invalidation', () => {
    test.use({ evRole: 'organisateur' });

    test('arrêt de vente d’une catégorie : l’Explorer suit en moins de 5 s', async ({ page }) => {
        test.setTimeout(150_000);
        const title = `Carte B arrêt de vente ${STAMP}`;
        const ev = await publishDemoEvent(title, 4500);
        const priced = /4\s?500/;
        // L'événement entre dans le cache du catalogue (créé par la base, sans invalidation : jusqu'à 60 s)
        await waitUntil('événement visible avec son prix sur l’Explorer', async () => priced.test(await exploreHtml(page.request, title)), 75_000, 1_000);

        const res = await page.request.patch(`/api/partner/events/${ev.id}/categories/${ev.categoryId}`, { data: { is_active: false } });
        expect(res.status(), `arrêt de vente : ${await res.text()}`).toBe(200);
        const elapsed = await waitUntil('prix retiré de l’Explorer', async () => !priced.test(await exploreHtml(page.request, title)), 65_000);
        console.log(`[carte-b] arrêt de vente visible sur l'Explorer après ${elapsed} ms`);
        expect(elapsed, 'l’Explorer montre l’arrêt de vente en moins de 5 s').toBeLessThan(MAX_STALE_MS);
    });
});
