/**
 * Lot Carte B3 — salles et restaurants sur la carte d'Explorer, preuves de bout en bout dans le job « responsive » de la
 * CI (nom en « …responsive.spec.ts »), sous le verrou des services (e2e/support/services-switch.ts : interrupteurs
 * features.halls_enabled et features.tables_enabled ouverts le temps de ces tests seulement) :
 *  - invalidation : une salle validée par l'administration (POST /api/admin/halls/[id]/validation) arrive sur la carte en
 *    moins de 5 s ; suspendue, elle en disparaît en moins de 5 s ;
 *  - décision du client du 25/11 (application entièrement publique ; modification signalée au rapport, elle remplace les
 *    preuves de la zone de 300 m) : la carte montre le point exact ; la fiche publique, la recherche et la fiche de l'API
 *    donnent l'adresse et le point, avec « Voir l'itinéraire » ; rien de la partenaire ; champs publics seulement ;
 *  - couches gardées dans l'adresse (`couches=`), repère masqué avec sa couche ;
 *  - captures du rapport, clair et sombre : couches, repères des trois types, feuille du téléphone, liste de
 *    l'ordinateur, fiches d'une salle et d'un restaurant :
 *    .e2e-captures/captures-responsive/cb3-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
 * En CI, aucune tuile ne vient d'Internet (verrou réseau : tuile neutre locale). Données : lieux neufs de la partenaire de
 * démonstration « organisateur » (noms uniques), retirés à la fin ; les lieux du seed servent aux captures.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect, type ThemeKey } from './support/fixtures';
import { readDemoIds, E2E_OUTPUT_DIR } from './support/demo-ids';
import { serviceClient, userIdByEmail } from './support/service';
import { FIXTURE_USERS } from '../tests/helpers/fixture-data';

const STAMP = randomUUID().slice(0, 8);
// Un seul worker pour tout le fichier : les salles de Thiès des captures sont créées une fois (deux jeux au même endroit
// seraient regroupés sur la carte)
test.describe.configure({ mode: 'serial' });
const MAX_STALE_MS = 5_000;
const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');

/** Partenaire de démonstration « organisateur ». */
async function demoPartnerId(): Promise<string> {
    const { data, error } = await serviceClient().from('partners').select('id').eq('user_id', readDemoIds().accounts.organisateur.userId).single();
    if (error || !data) throw new Error(`[e2e] partenaire de démonstration : ${error?.message ?? 'absente'}`);
    return String(data.id);
}

/** Salle neuve de la partenaire de démonstration, en attente de validation (ou validée par la base si `validate`). */
async function newHall(spec: { name: string; address: string; lat: number; lng: number; city?: string; validate?: boolean }): Promise<string> {
    const svc = serviceClient();
    const { data, error } = await svc.from('halls').insert({
        partner_id: await demoPartnerId(), name: spec.name, capacity: 250, price_per_day: 150_000, city: spec.city ?? 'Dakar',
        address: spec.address, latitude: spec.lat, longitude: spec.lng, is_active: true,
        description: 'Salle du lot Carte B3 (données fictives).',
    }).select('id').single();
    if (error || !data) throw new Error(`[e2e] salle : ${error?.message ?? 'absente'}`);
    const id = String(data.id);
    if (spec.validate) {
        const { data: d, error: e } = await svc.rpc('hall_validation_decide', { p: { actor_id: await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email), hall_id: id, decision: 'VALIDER', reason: null } });
        if (e || (d as { ok?: boolean } | null)?.ok !== true) throw new Error(`[e2e] validation : ${e?.message ?? JSON.stringify(d)}`);
    }
    return id;
}

async function retire(id: string): Promise<void> {
    const { error } = await serviceClient().from('halls').update({ is_active: false }).eq('id', id);
    if (error) console.warn(`[carte-b3] salle ${id} non retirée : ${error.message}`);
}

async function waitUntil(label: string, check: () => Promise<boolean>, timeoutMs: number, stepMs = 250): Promise<number> {
    const t0 = Date.now();
    for (;;) {
        if (await check()) return Date.now() - t0;
        if (Date.now() - t0 > timeoutMs) throw new Error(`[e2e] ${label} : toujours faux après ${timeoutMs} ms`);
        await new Promise((r) => setTimeout(r, stepMs));
    }
}

async function hallsOnMap(request: APIRequestContext): Promise<Array<Record<string, unknown>>> {
    const res = await request.get('/api/lieux/carte?couche=salles');
    expect(res.status(), 'lecture des salles de la carte').toBe(200);
    return ((await res.json()) as { places: Array<Record<string, unknown>> }).places;
}

test.describe('carte B3 · validation, lieu public, suspension', () => {
    test.use({ evRole: 'fumee-superadmin' });
    test.beforeEach(async ({ servicesLock }) => { await servicesLock.enter('services'); });

    test('salle validée : sur la carte en moins de 5 s à son point exact, adresse et itinéraire publics ; suspendue : retirée en moins de 5 s', async ({ page, playwright, baseURL }) => {
        test.setTimeout(180_000);
        const point = { lat: 14.70417, lng: -17.45333 };
        const address = `Villa ${STAMP}, rue des Cocotiers`;
        const name = `Salle B3 ${STAMP}`;
        const id = await newHall({ name, address, ...point });
        try {
            const decide = await page.request.post(`/api/admin/halls/${id}/validation`, { data: { decision: 'VALIDER' } });
            expect(decide.status(), `validation : ${await decide.text()}`).toBe(200);
            const shownAfter = await waitUntil('salle sur la carte', async () => (await hallsOnMap(page.request)).some((p) => p.id === id), 65_000);
            console.log(`[carte-b3] salle validée visible sur la carte après ${shownAfter} ms`);
            expect(shownAfter, 'sur la carte en moins de 5 s').toBeLessThan(MAX_STALE_MS);

            const places = await hallsOnMap(page.request);
            const shown = places.find((p) => p.id === id)!;
            // Lot 12b (modification signalée au rapport) : champ public « orders » (établissement ouvert à la commande ; toujours
            // faux pour une salle), ajouté à PUBLIC_PLACE_FIELDS
            expect(Object.keys(shown).sort(), 'champs publics seulement').toEqual(['area', 'capacity', 'hours', 'id', 'lat', 'lng', 'name', 'orders', 'photos', 'price', 'type']);
            expect(shown.orders, 'une salle ne prend pas de commande').toBe(false);
            expect({ lat: shown.lat, lng: shown.lng }, 'point exact (décision du 25/11)').toEqual(point);

            // Visiteur sans session (aucun cookie) : adresse, point et itinéraire publics ; rien de la partenaire
            const visitor = await playwright.request.newContext({ baseURL });
            const page0 = await (await visitor.get(`/halls/${id}`)).text();
            const search = await (await visitor.get(`/api/halls?q=${encodeURIComponent(STAMP)}`)).text();
            const apiOne = await (await visitor.get(`/api/halls/${id}`)).text();
            await visitor.dispose();
            expect(page0, 'fiche : adresse').toContain(address);
            expect(page0, 'fiche : itinéraire vers le point exact').toContain(`maps/dir/?api=1&amp;destination=${point.lat},${point.lng}`);
            expect(search, 'recherche par un mot de l’adresse').toContain(id);
            for (const [label, text] of [['recherche', search], ['fiche de l’API', apiOne]] as const) {
                expect(text, `${label} : adresse`).toContain(address);
                expect(text, `${label} : point`).toContain(String(point.lat));
            }
            const { data: pa } = await serviceClient().from('partners').select('company_name, phone, email').eq('id', await demoPartnerId()).single();
            for (const secret of [pa?.phone, pa?.email].filter((x): x is string => typeof x === 'string' && x.length > 0)) {
                for (const [label, text] of [['fiche', page0], ['recherche', search], ['fiche de l’API', apiOne], ['carte', JSON.stringify(places)]] as const) {
                    expect(text.includes(secret), `${label} : coordonnée de la partenaire`).toBe(false);
                }
            }

            const suspend = await page.request.post(`/api/admin/halls/${id}/validation`, { data: { decision: 'SUSPENDRE', reason: `Contrôle du lot Carte B3 ${STAMP}` } });
            expect(suspend.status(), `suspension : ${await suspend.text()}`).toBe(200);
            const goneAfter = await waitUntil('salle retirée de la carte', async () => !(await hallsOnMap(page.request)).some((p) => p.id === id), 65_000);
            console.log(`[carte-b3] salle suspendue retirée de la carte après ${goneAfter} ms`);
            expect(goneAfter, 'retirée en moins de 5 s').toBeLessThan(MAX_STALE_MS);
        } finally {
            await retire(id);
        }
    });
});

async function settle(page: Page): Promise<void> {
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
    await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
}

/** Fait défiler jusqu'à un élément, placé sous l'en-tête et la barre collante des catégories d'Explorer (≈ 130 px). */
async function scrollToTop(page: Page, selector: string): Promise<void> {
    await page.locator(selector).first().evaluate((el) => {
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 132, behavior: 'instant' as ScrollBehavior });
    });
    await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
}

async function shot(page: Page, name: string, width: number, theme: ThemeKey): Promise<void> {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.waitForTimeout(350); // fin des transitions (≤ 300 ms)
    await page.screenshot({ path: path.join(SHOTS, `cb3-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css' });
}

const LAYERS = '[role="group"][aria-label="Afficher sur la carte"]';

/** Salles des captures, à Thiès (« Aller à » Thiès, zoom 13), assez éloignées pour ne pas être regroupées. */
const THIES = {
    teranga: { name: `Salle Teranga ${STAMP}`, address: `Villa ${STAMP}, quartier Randoulène`, lat: 14.799, lng: -16.92, city: 'Thiès' },
    rails: { name: `Salle Les Rails ${STAMP}`, address: `Avenue de la Gare ${STAMP}, Thiès`, lat: 14.783, lng: -16.957, city: 'Thiès' },
} as const;
const thiesIds: string[] = [];

test.beforeAll(async () => {
    for (const spec of [THIES.teranga, THIES.rails]) thiesIds.push(await newHall({ ...spec, validate: true }));
});
test.afterAll(async () => {
    for (const id of thiesIds) await retire(id);
});
const MAP = '[role="region"][aria-label="Carte des événements et des lieux"]';

const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
    { key: 'clair', colorScheme: 'light' },
    { key: 'sombre', colorScheme: 'dark' },
];

for (const theme of THEMES) {
    test.describe(`carte B3 · captures · ${theme.key}`, () => {
        test.use({ colorScheme: theme.colorScheme, evTheme: theme.key });
        test.beforeEach(async ({ context, servicesLock }) => {
            await servicesLock.enter('services');
            await context.addInitScript((value: string) => { document.cookie = `ev-theme=${value}; path=/`; }, theme.colorScheme);
        });

        test('couches, repères des trois types, feuille du téléphone (360 px)', async ({ page }) => {
            test.setTimeout(240_000);
            await page.setViewportSize({ width: 360, height: 780 });
            // Salles de Thiès créées sans passer par l'administration : cache de la carte (60 s au plus) attendu ici
            await waitUntil('salles de Thiès sur la carte', async () => {
                const shown = new Set((await hallsOnMap(page.request)).map((p) => p.id));
                return thiesIds.every((id) => shown.has(id));
            }, 75_000, 1_000);
            await page.goto('/explore?vue=carte', { waitUntil: 'load' });
            const layers = page.locator(LAYERS);
            await expect(layers.getByRole('button', { name: /Salles/ })).toBeVisible({ timeout: 30_000 });
            await expect(layers.getByRole('button', { name: /Restaurants/ })).toHaveAttribute('aria-pressed', 'true');
            // Lot stabilité (runs 746 et 779) : carte réellement créée (Leaflet chargé) avant « Aller à » ; un lieu choisi plus tôt
            // est désormais gardé par la carte, mais le test vise l'état réel plutôt qu'un délai
            await expect(page.locator(`${MAP}[data-ev-carte="prete"]`)).toBeVisible({ timeout: 30_000 });

            // Thiès : un événement (billet), deux salles (bâtiment)
            await page.getByLabel('Aller à').selectOption('thies');
            const teranga = page.getByRole('button', { name: new RegExp(`^Salle Teranga ${STAMP},`) });
            await expect(teranga.locator('.ev-repere--salle')).toBeVisible({ timeout: 30_000 });
            await expect(page.getByRole('button', { name: new RegExp(`^Salle Les Rails ${STAMP},`) }).locator('.ev-repere--salle')).toBeVisible();
            await settle(page);
            await scrollToTop(page, LAYERS);
            await shot(page, 'couches-reperes', 360, theme.key);

            // Couche masquée : plus de repère de salle, couches gardées dans l'adresse
            await layers.getByRole('button', { name: /Salles/ }).click();
            await expect(layers.getByRole('button', { name: /Salles/ })).toHaveAttribute('aria-pressed', 'false');
            await expect(page).toHaveURL(/couches=evenements(%2C|,)restaurants/);
            await expect(page.locator('.leaflet-marker-icon .ev-repere--salle')).toHaveCount(0);
            await layers.getByRole('button', { name: /Salles/ }).click();
            await expect(teranga.locator('.ev-repere--salle')).toBeVisible({ timeout: 15_000 });

            // Feuille du téléphone : photos, faits, lien vers la fiche (la réservation se fait là)
            await teranga.locator('.ev-repere').click();
            const sheet = page.getByRole('dialog');
            await expect(sheet.getByRole('link', { name: 'Voir la salle' })).toBeVisible();
            await scrollToTop(page, MAP);
            await shot(page, 'feuille-lieu', 360, theme.key);
            await sheet.getByRole('button', { name: 'Fermer' }).click();

            // Restaurants du seed (Sacré-Cœur) : couverts
            await page.getByLabel('Aller à').selectOption('sacre-coeur');
            await expect(page.locator('.leaflet-marker-icon .ev-repere--resto').first()).toBeVisible({ timeout: 30_000 });
            await settle(page);
            await scrollToTop(page, MAP);
            await shot(page, 'repere-restaurant', 360, theme.key);
        });

        test('liste de l’ordinateur et survol d’un lieu (1 440 px)', async ({ page }) => {
            test.setTimeout(150_000);
            await page.setViewportSize({ width: 1440, height: 900 });
            await page.goto('/explore?vue=carte', { waitUntil: 'load' });
            await expect(page.locator(LAYERS).getByRole('button', { name: /Salles/ })).toBeVisible({ timeout: 30_000 });
            await expect(page.locator(`${MAP}[data-ev-carte="prete"]`)).toBeVisible({ timeout: 30_000 });
            await page.getByLabel('Aller à').selectOption('dakar');
            const place = page.locator('[id^="carte-vignette-p-"] a').first();
            await expect(place).toBeVisible({ timeout: 30_000 });
            await place.hover();
            // Run 658 : le lieu survolé peut être caché dans un regroupement, qui s'allume alors à sa place
            await expect(page.locator('.ev-repere--choisi'), 'survol : repère du lieu mis en évidence').toHaveCount(1, { timeout: 5_000 });
            await settle(page);
            await scrollToTop(page, LAYERS);
            await place.hover();
            await shot(page, 'liste-ordinateur', 1440, theme.key);
        });

        test('fiches : adresse, carte au point exact, « Voir l’itinéraire » (360 et 1 440 px)', async ({ page }) => {
            test.setTimeout(180_000);
            const ids = readDemoIds();
            for (const w of [360, 1440] as const) {
                await page.setViewportSize({ width: w, height: w === 360 ? 780 : 900 });
                for (const [name, href] of [['fiche-salle', `/halls/${ids.halls.validee.id}`], ['fiche-restaurant', `/tables/${ids.tables.restaurant.id}`]] as const) {
                    await page.goto(href, { waitUntil: 'load' });
                    // Page entièrement chargée d'abord (la fiche se redessine après l'arrivée du code : run 654) ; le clic
                    // attend le bouton et le fait défiler lui-même
                    await settle(page);
                    const section = page.locator('section[aria-labelledby="salle-adresse"], section[aria-labelledby="etab-adresse"]');
                    await section.getByRole('button', { name: 'Afficher la carte' }).click({ timeout: 30_000 });
                    await expect(section.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
                    await expect(section.getByRole('link', { name: /Voir l’itinéraire/ })).toBeVisible();
                    await settle(page);
                    await scrollToTop(page, 'section[aria-labelledby="salle-adresse"], section[aria-labelledby="etab-adresse"]');
                    await shot(page, name, w, theme.key);
                }
            }
        });
    });
}
