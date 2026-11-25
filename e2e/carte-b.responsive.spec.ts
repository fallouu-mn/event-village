/**
 * Lot Carte B — preuves de bout en bout dans le job « responsive » de la CI (projet responsive : nom en
 * « …responsive.spec.ts ») :
 *  - invalidation (B0) : l'arrêt de vente d'une catégorie (PATCH /api/partner/events/[id]/categories/[categoryId],
 *    is_active false) se voit sur l'Explorer en moins de 5 s (avant le lot : jusqu'à 60 s, cache du catalogue), et sur la
 *    carte ; une suspension par l'administration retire l'événement de la carte en moins de 5 s ;
 *  - fond de carte (B1) : aucune tuile demandée avant l'ouverture de la vue Carte ; mention des fonds visible ; tuiles en
 *    échec → retour à la Liste avec un message simple (la Liste marche toujours) ;
 *  - captures du rapport (Explorer Liste, Carte au Sénégal et zoomée, feuille du téléphone, liste synchronisée de
 *    l'ordinateur, Calendrier et feuille d'un jour, aperçu de l'accueil), clair et sombre :
 *    .e2e-captures/captures-responsive/cb-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
 * En CI, aucune tuile ne vient d'Internet : le verrou réseau de l'e2e sert une tuile neutre locale (e2e/support/network.ts).
 * Données : des événements neufs publiés par la partenaire de démonstration (titres uniques), jamais un événement du seed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect, type ThemeKey } from './support/fixtures';
import { readDemoIds, E2E_OUTPUT_DIR } from './support/demo-ids';
import { dakarDayFrom } from './support/parcours';
import { createPublishedEvent, partnerPosterOf, serviceClient, userIdByEmail } from './support/service';
import { FIXTURE_USERS } from '../tests/helpers/fixture-data';

const STAMP = randomUUID().slice(0, 8);
/** Délai maximal entre l'écriture réussie et la page publique à jour (consigne du lot). */
const MAX_STALE_MS = 5_000;
const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
const TILE_HOST = /(^|\.)tiles\.stadiamaps\.com$/;

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

/** Événements de la carte filtrés sur le titre (lecture publique, sous cache). */
async function mapEvents(request: APIRequestContext, title: string): Promise<Array<Record<string, unknown>>> {
    const res = await request.get(`/api/events/carte?q=${encodeURIComponent(title)}`);
    expect(res.status(), 'lecture de la carte').toBe(200);
    const body = await res.json() as { events: Array<Record<string, unknown>> };
    return body.events;
}

// Lot Carte B3 : la carte d'Explorer montre aussi les salles et les restaurants quand leurs services sont ouverts ; ces
// tests tournent interrupteurs à leur valeur d'origine (groupe « autres » du verrou des services, comme les pages qui ne
// sont pas des services), jamais pendant les tests des services
test.beforeEach(async ({ servicesLock }) => { await servicesLock.enter('autres'); });

test.describe('carte B · invalidation', () => {
    test.use({ evRole: 'organisateur' });

    test('arrêt de vente d’une catégorie : l’Explorer suit en moins de 5 s', async ({ page }) => {
        test.setTimeout(150_000);
        const title = `Carte B arrêt de vente ${STAMP}`;
        const ev = await publishDemoEvent(title, 4500);
        const priced = /4\s?500/;
        // L'événement entre dans le cache du catalogue (créé par la base, sans invalidation : jusqu'à 60 s)
        await waitUntil('événement visible avec son prix sur l’Explorer', async () => priced.test(await exploreHtml(page.request, title)), 75_000, 1_000);
        await waitUntil('événement sur la carte avec son prix', async () => (await mapEvents(page.request, title)).some((e) => e.id === ev.id && e.price === 4500), 75_000, 1_000);

        const res = await page.request.patch(`/api/partner/events/${ev.id}/categories/${ev.categoryId}`, { data: { is_active: false } });
        expect(res.status(), `arrêt de vente : ${await res.text()}`).toBe(200);
        const t0 = Date.now();
        const elapsed = await waitUntil('prix retiré de l’Explorer', async () => !priced.test(await exploreHtml(page.request, title)), 65_000);
        console.log(`[carte-b] arrêt de vente visible sur l'Explorer après ${elapsed} ms`);
        expect(elapsed, 'l’Explorer montre l’arrêt de vente en moins de 5 s').toBeLessThan(MAX_STALE_MS);
        await waitUntil('prix retiré de la carte', async () => (await mapEvents(page.request, title)).some((e) => e.id === ev.id && e.price === null), 65_000);
        const onMap = Date.now() - t0;
        console.log(`[carte-b] arrêt de vente visible sur la carte après ${onMap} ms`);
        expect(onMap, 'la carte montre l’arrêt de vente en moins de 5 s').toBeLessThan(MAX_STALE_MS);
    });
});

test.describe('carte B · suspension', () => {
    test.use({ evRole: 'admin' });

    test('suspension par l’administration : l’événement quitte la carte en moins de 5 s ; aucun champ en trop', async ({ page }) => {
        test.setTimeout(150_000);
        const title = `Carte B suspension ${STAMP}`;
        const ev = await publishDemoEvent(title, 3000, 14.8606, -15.8758);
        await waitUntil('événement sur la carte', async () => (await mapEvents(page.request, title)).some((e) => e.id === ev.id), 75_000, 1_000);
        const shown = (await mapEvents(page.request, title)).find((e) => e.id === ev.id);
        expect(Object.keys(shown ?? {}).sort(), 'champs publics seulement').toEqual(['blur', 'color', 'endsAt', 'highlight', 'id', 'lat', 'lng', 'price', 'startsAt', 'title']);

        const res = await page.request.post(`/api/admin/events/${ev.id}/transition`, { data: { to: 'SUSPENDU', reason: `Contrôle du lot Carte B ${STAMP}` } });
        expect(res.status(), `suspension : ${await res.text()}`).toBe(200);
        const elapsed = await waitUntil('événement retiré de la carte', async () => !(await mapEvents(page.request, title)).some((e) => e.id === ev.id), 65_000);
        console.log(`[carte-b] suspension visible sur la carte après ${elapsed} ms`);
        expect(elapsed, 'retiré de la carte en moins de 5 s').toBeLessThan(MAX_STALE_MS);
    });
});

/** Requêtes de tuiles Stadia vues par la page (servies par le verrou réseau : jamais Internet). */
function watchTiles(page: Page): string[] {
    const seen: string[] = [];
    page.on('request', (r) => {
        try {
            if (TILE_HOST.test(new URL(r.url()).hostname)) seen.push(r.url());
        } catch (err) {
            console.warn(`[carte-b] adresse illisible : ${err instanceof Error ? err.message : String(err)}`);
        }
    });
    return seen;
}

async function settle(page: Page): Promise<void> {
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
    await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
}

/** Fait défiler jusqu'à un élément, placé en haut de l'écran sous l'en-tête (captures parlantes : la vue, pas les filtres). */
async function scrollToTop(page: Page, selector: string): Promise<void> {
    await page.locator(selector).first().evaluate((el) => {
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'instant' as ScrollBehavior });
    });
    await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
}

const VIEWS = '[role="tablist"][aria-label="Affichage des événements"]';

async function shot(page: Page, name: string, width: number, theme: ThemeKey): Promise<void> {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.waitForTimeout(350); // fin des transitions (≤ 300 ms)
    await page.screenshot({ path: path.join(SHOTS, `cb-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css' });
}

test.describe('carte B · fond de carte', () => {
    test('aucune tuile avant la vue Carte ; mention visible ; tuiles en échec → Liste et message simple', async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: 1024, height: 768 });
        const tiles = watchTiles(page);
        await page.goto('/explore', { waitUntil: 'load' });
        await settle(page);
        expect(tiles, 'Liste : aucune tuile demandée').toEqual([]);
        await expect(page.getByRole('tab', { name: 'Liste' })).toHaveAttribute('aria-selected', 'true');

        await page.getByRole('tab', { name: 'Carte' }).click();
        await expect(page).toHaveURL(/vue=carte/);
        await expect(page.getByRole('region', { name: 'Carte des événements' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.leaflet-control-attribution')).toContainText('Stadia Maps');
        await expect(page.locator('.leaflet-control-attribution')).toContainText('OpenMapTiles');
        await expect(page.locator('.leaflet-control-attribution')).toContainText('contributeurs OpenStreetMap');
        await waitUntil('tuiles demandées à l’ouverture de la carte', async () => tiles.length > 0, 15_000);

        // Tuiles refusées : la page revient sur la Liste, message simple, liste utilisable
        await page.route(/tiles\.stadiamaps\.com/, (route) => route.abort('failed'));
        await page.goto('/explore?vue=carte', { waitUntil: 'load' });
        await expect(page.getByText('La carte ne peut pas s’afficher pour le moment')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole('tab', { name: 'Liste' })).toHaveAttribute('aria-selected', 'true');
        await expect(page).not.toHaveURL(/vue=carte/);
        await expect(page.getByRole('tabpanel').getByRole('heading', { level: 2 }).first()).toBeVisible();
    });
});

const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
    { key: 'clair', colorScheme: 'light' },
    { key: 'sombre', colorScheme: 'dark' },
];

for (const theme of THEMES) {
    test.describe(`carte B · captures · ${theme.key}`, () => {
        test.use({ colorScheme: theme.colorScheme, evTheme: theme.key });
        test.beforeEach(async ({ context }) => {
            await context.addInitScript((value: string) => { document.cookie = `ev-theme=${value}; path=/`; }, theme.colorScheme);
        });

        test('Explorer Liste, Carte au Sénégal et zoomée, feuille du téléphone (360 px)', async ({ page }) => {
            test.setTimeout(180_000);
            await page.setViewportSize({ width: 360, height: 780 });
            await page.goto('/explore', { waitUntil: 'load' });
            await settle(page);
            await shot(page, 'explorer-liste', 360, theme.key);

            await page.getByRole('tab', { name: 'Carte' }).click();
            const map = page.getByRole('region', { name: 'Carte des événements' });
            await expect(map).toBeVisible({ timeout: 30_000 });
            // Le repère de Leaflet mesure 0 × 0 px : le billet visible est son enfant (.ev-repere), qui reçoit le toucher
            await expect(page.locator('.leaflet-marker-icon .ev-repere').first()).toBeVisible({ timeout: 30_000 });
            await settle(page);
            await scrollToTop(page, VIEWS);
            await shot(page, 'carte-senegal', 360, theme.key);

            await page.getByLabel('Aller à').selectOption('dakar');
            await settle(page);
            await scrollToTop(page, VIEWS);
            await shot(page, 'carte-zoomee', 360, theme.key);

            // Saint-Louis : un seul événement publié dans le jeu de démonstration (repère simple)
            await page.getByLabel('Aller à').selectOption('saint-louis');
            await settle(page);
            // Repère visé par son nom accessible (titre de l'événement) : les repères hors de la partie visible restent dans la page
            // (tout caractère autre qu'une lettre, un chiffre ou une espace devient un joker : aucune expression à échapper)
            const stLouis = readDemoIds().events.publie.title.replace(/[^\p{L}\p{N} ]/gu, '.');
            const single = page.getByRole('button', { name: new RegExp(`^${stLouis},`, 'u') });
            await expect(single.locator('.ev-repere')).toBeVisible({ timeout: 15_000 });
            await single.locator('.ev-repere').click();
            await expect(page.getByRole('dialog').getByRole('link', { name: /Voir l’événement/ })).toBeVisible();
            await scrollToTop(page, '[role="region"][aria-label="Carte des événements"]');
            await shot(page, 'feuille-telephone', 360, theme.key);
            // Clavier : un repère prend le focus et s'ouvre avec Entrée
            await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
            await single.focus();
            await page.keyboard.press('Enter');
            await expect(page.getByRole('dialog').getByRole('link', { name: /Voir l’événement/ })).toBeVisible();
        });

        test('liste synchronisée et survol (1 440 px)', async ({ page }) => {
            test.setTimeout(150_000);
            await page.setViewportSize({ width: 1440, height: 900 });
            await page.goto('/explore?vue=carte', { waitUntil: 'load' });
            await expect(page.getByRole('region', { name: 'Carte des événements' })).toBeVisible({ timeout: 30_000 });
            await expect(page.locator('#carte-liste-titre')).toContainText(/dans cette zone/, { timeout: 30_000 });
            const before = await page.locator('[id^="carte-vignette-"]').count();
            // Saint-Louis (zoom 13) : la liste suit la zone visible ; un seul événement publié du jeu de démonstration y est
            await page.getByLabel('Aller à').selectOption('saint-louis');
            await settle(page);
            const cards = page.locator('[id^="carte-vignette-"]');
            await expect.poll(async () => cards.count(), { timeout: 10_000, message: 'liste ramenée à la zone visible' }).toBeLessThan(before);
            const first = cards.locator('a').first();
            await expect(first).toBeVisible({ timeout: 15_000 });
            await first.hover();
            await expect(page.locator('.ev-repere--choisi'), 'survol : repère mis en évidence').toHaveCount(1, { timeout: 5_000 });
            await scrollToTop(page, VIEWS);
            await first.hover();
            await shot(page, 'liste-synchronisee', 1440, theme.key);
            await expect(page.getByRole('button', { name: 'Rechercher dans cette zone' })).toBeVisible();
        });

        test('Calendrier et feuille d’un jour (360 et 1 440 px)', async ({ page }) => {
            test.setTimeout(150_000);
            for (const w of [360, 1440] as const) {
                await page.setViewportSize({ width: w, height: w === 360 ? 780 : 900 });
                await page.goto('/explore?vue=calendrier', { waitUntil: 'load' });
                const day = page.getByRole('button', { name: /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) \d{1,2} \S+, \d+ événements?$/ }).first();
                await expect(day).toBeVisible({ timeout: 30_000 });
                await settle(page);
                await scrollToTop(page, VIEWS);
                await shot(page, 'calendrier', w, theme.key);
                await day.click();
                const sheet = page.getByRole('dialog');
                await expect(sheet.getByRole('link', { name: /Acheter/ }).first()).toBeVisible();
                await shot(page, 'calendrier-jour', w, theme.key);
                await page.keyboard.press('Escape');
            }
        });

        test('aperçu de la carte sur l’accueil (360 et 1 440 px)', async ({ page }) => {
            test.setTimeout(150_000);
            for (const w of [360, 1440] as const) {
                await page.setViewportSize({ width: w, height: w === 360 ? 780 : 900 });
                const tiles = watchTiles(page);
                await page.goto('/', { waitUntil: 'load' });
                await settle(page);
                expect(tiles, 'accueil : aucune tuile avant que l’aperçu soit visible').toEqual([]);
                const heading = page.getByRole('heading', { name: 'Partout au Sénégal' });
                await heading.scrollIntoViewIfNeeded({ timeout: 30_000 });
                await expect(page.getByRole('region', { name: 'Aperçu de la carte des événements' })).toBeVisible({ timeout: 30_000 });
                await settle(page);
                await scrollToTop(page, 'section[aria-labelledby="senegal-titre"]');
                await shot(page, 'accueil-apercu', w, theme.key);
                await expect(page.getByRole('link', { name: 'Ouvrir la carte' })).toHaveAttribute('href', '/explore?vue=carte');
            }
        });
    });
}
