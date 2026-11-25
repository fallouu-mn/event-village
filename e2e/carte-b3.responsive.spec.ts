/**
 * Lot Carte B3 — salles et restaurants sur la carte d'Explorer, preuves de bout en bout dans le job « responsive » de la
 * CI (nom en « …responsive.spec.ts »), sous le verrou des services (e2e/support/services-switch.ts : interrupteurs
 * features.halls_enabled et features.tables_enabled ouverts le temps de ces tests seulement) :
 *  - invalidation : une salle validée par l'administration (POST /api/admin/halls/[id]/validation) arrive sur la carte en
 *    moins de 5 s ; suspendue, elle en disparaît en moins de 5 s ;
 *  - vie privée : une salle de particulier n'est montrée que par sa zone (centre décalé de 80 à 220 m, jamais le point) ;
 *    ni la fiche publique (page servie, données de la page), ni la recherche, ni la fiche de l'API, ni la carte ne
 *    contiennent son adresse, son point exact ou un lien d'itinéraire ;
 *  - couches gardées dans l'adresse (`couches=`), repère masqué avec sa couche ;
 *  - captures du rapport, clair et sombre : couches, repères des trois types, zone d'un particulier, feuille du téléphone,
 *    liste de l'ordinateur, fiches (zone d'un particulier, point d'un lieu professionnel) :
 *    .e2e-captures/captures-responsive/cb3-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
 * En CI, aucune tuile ne vient d'Internet (verrou réseau : tuile neutre locale). Données : lieux neufs de la partenaire de
 * démonstration « organisateur » (noms uniques), retirés à la fin ; les lieux du seed (salles et établissements de
 * démonstration, particuliers par défaut) servent aux captures.
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
async function newHall(spec: { name: string; address: string; lat: number; lng: number; city?: string; pro?: boolean; validate?: boolean }): Promise<string> {
    const svc = serviceClient();
    const { data, error } = await svc.from('halls').insert({
        partner_id: await demoPartnerId(), name: spec.name, capacity: 250, price_per_day: 150_000, city: spec.city ?? 'Dakar',
        address: spec.address, latitude: spec.lat, longitude: spec.lng, is_active: true,
        description: 'Salle du lot Carte B3 (données fictives).', host_kind: spec.pro ? 'PROFESSIONNEL' : 'PARTICULIER',
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

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const dy = (a.lat - b.lat) * 111_320;
    const dx = (a.lng - b.lng) * 111_320 * Math.cos((b.lat * Math.PI) / 180);
    return Math.hypot(dx, dy);
}

test.describe('carte B3 · validation, vie privée, suspension', () => {
    test.use({ evRole: 'fumee-superadmin' });
    test.beforeEach(async ({ servicesLock }) => { await servicesLock.enter('services'); });

    test('salle de particulier validée : sur la carte en moins de 5 s, zone et jamais le point ; suspendue : retirée en moins de 5 s', async ({ page, playwright, baseURL }) => {
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
            expect(Object.keys(shown).sort(), 'champs publics seulement').toEqual(['area', 'capacity', 'exact', 'hours', 'id', 'lat', 'lng', 'name', 'photos', 'price', 'type']);
            expect(shown.exact, 'particulier : zone').toBe(false);
            const d = metres({ lat: Number(shown.lat), lng: Number(shown.lng) }, point);
            console.log(`[carte-b3] centre de la zone à ${d.toFixed(1)} m du vrai point`);
            expect(d, 'écart au vrai point').toBeGreaterThan(79);
            expect(d, 'écart au vrai point').toBeLessThan(221);
            // Même centre d'une lecture à l'autre
            const again = (await hallsOnMap(page.request)).find((p) => p.id === id)!;
            expect({ lat: again.lat, lng: again.lng }).toEqual({ lat: shown.lat, lng: shown.lng });

            // Nulle part : adresse, point exact, lien d'itinéraire (fiche servie, recherche, fiche de l'API, carte)
            const forbidden = [address, STAMP + ', rue', String(point.lat), String(point.lng), 'maps/dir'];
            // Visiteur sans session (aucun cookie)
            const visitor = await playwright.request.newContext({ baseURL });
            const sources: Array<[string, string]> = [
                ['fiche publique', await (await visitor.get(`/halls/${id}`)).text()],
                ['recherche', await (await visitor.get(`/api/halls?q=${encodeURIComponent(name)}`)).text()],
                ['fiche de l’API', await (await visitor.get(`/api/halls/${id}`)).text()],
                ['carte', JSON.stringify(places)],
            ];
            await visitor.dispose();
            for (const [label, text] of sources) {
                for (const f of forbidden) expect(text.includes(f), `${label} : « ${f} »`).toBe(false);
            }
            expect(sources[0][1], 'fiche : phrase de la zone').toContain('Adresse exacte après réservation');

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

/** Salles des captures, à Thiès (« Aller à » Thiès, zoom 13) : une de particulier, une professionnelle. */
const THIES = {
    particulier: { name: `Salle Teranga ${STAMP}`, address: `Villa ${STAMP}, quartier Randoulène`, lat: 14.799, lng: -16.92, city: 'Thiès' },
    pro: { name: `Salle Les Rails ${STAMP}`, address: `Avenue de la Gare ${STAMP}, Thiès`, lat: 14.783, lng: -16.957, city: 'Thiès', pro: true },
} as const;
const thiesIds: string[] = [];

test.beforeAll(async () => {
    for (const spec of [THIES.particulier, THIES.pro]) thiesIds.push(await newHall({ ...spec, validate: true }));
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

        test('couches, repères des trois types, zone d’un particulier, feuille du téléphone (360 px)', async ({ page }) => {
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

            // Thiès : un événement (billet), une salle de particulier (pointillé, zone), une salle professionnelle
            await page.getByLabel('Aller à').selectOption('thies');
            const particulier = page.getByRole('button', { name: new RegExp(`^Salle Teranga ${STAMP},`) });
            await expect(particulier.locator('.ev-repere--approx')).toBeVisible({ timeout: 30_000 });
            await expect(page.getByRole('button', { name: new RegExp(`^Salle Les Rails ${STAMP},`) }).locator('.ev-repere--salle')).toBeVisible();
            await expect(page.locator('path.ev-zone').first()).toBeVisible({ timeout: 15_000 });
            await settle(page);
            await scrollToTop(page, LAYERS);
            await shot(page, 'couches-reperes', 360, theme.key);

            // Couche masquée : plus de repère de salle, couches gardées dans l'adresse
            await layers.getByRole('button', { name: /Salles/ }).click();
            await expect(layers.getByRole('button', { name: /Salles/ })).toHaveAttribute('aria-pressed', 'false');
            await expect(page).toHaveURL(/couches=evenements(%2C|,)restaurants/);
            await expect(page.locator('.leaflet-marker-icon .ev-repere--salle')).toHaveCount(0);
            await layers.getByRole('button', { name: /Salles/ }).click();
            await expect(particulier.locator('.ev-repere--approx')).toBeVisible({ timeout: 15_000 });

            // Feuille du téléphone : photos, faits, « Adresse exacte après réservation », lien vers la fiche
            await particulier.locator('.ev-repere').click();
            const sheet = page.getByRole('dialog');
            await expect(sheet.getByRole('link', { name: 'Voir la salle' })).toBeVisible();
            await expect(sheet).toContainText('Adresse exacte après réservation');
            await expect(sheet).not.toContainText(THIES.particulier.address);
            await scrollToTop(page, MAP);
            await shot(page, 'feuille-lieu', 360, theme.key);
            await sheet.getByRole('button', { name: 'Fermer' }).click();

            // Restaurants du seed (Sacré-Cœur : « Le Petit Jardin », particulier) : couverts en pointillé et zone
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
            await page.getByLabel('Aller à').selectOption('dakar');
            const place = page.locator('[id^="carte-vignette-p-"] a').first();
            await expect(place).toBeVisible({ timeout: 30_000 });
            await place.hover();
            await expect(page.locator('.ev-repere--choisi'), 'survol : repère du lieu mis en évidence').toHaveCount(1, { timeout: 5_000 });
            await settle(page);
            await scrollToTop(page, LAYERS);
            await place.hover();
            await shot(page, 'liste-ordinateur', 1440, theme.key);
        });

        test('fiches : zone d’un particulier, point d’un lieu professionnel (360 et 1 440 px)', async ({ page }) => {
            test.setTimeout(180_000);
            const ids = readDemoIds();
            const pro = thiesIds[1];
            {
                for (const w of [360, 1440] as const) {
                    await page.setViewportSize({ width: w, height: w === 360 ? 780 : 900 });
                    for (const [name, href] of [['fiche-salle-particulier', `/halls/${ids.halls.validee.id}`], ['fiche-restaurant-particulier', `/tables/${ids.tables.restaurant.id}`], ['fiche-salle-pro', `/halls/${pro}`]] as const) {
                        await page.goto(href, { waitUntil: 'load' });
                        // Page entièrement chargée d'abord (la fiche se redessine après l'arrivée du code : run 654) ; le
                        // clic attend le bouton et le fait défiler lui-même
                        await settle(page);
                        const section = page.locator('section[aria-labelledby="salle-adresse"], section[aria-labelledby="etab-adresse"]');
                        await section.getByRole('button', { name: 'Afficher la carte' }).click({ timeout: 30_000 });
                        await expect(section.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
                        if (name === 'fiche-salle-pro') {
                            await expect(section.getByRole('link', { name: /Voir l’itinéraire/ })).toBeVisible();
                        } else {
                            await expect(section.locator('path.ev-zone')).toHaveCount(1, { timeout: 15_000 });
                            await expect(section).toContainText('Adresse exacte après réservation');
                            await expect(section.getByRole('link', { name: /Voir l’itinéraire/ })).toHaveCount(0);
                        }
                        await settle(page);
                        await scrollToTop(page, 'section[aria-labelledby="salle-adresse"], section[aria-labelledby="etab-adresse"]');
                        await shot(page, name, w, theme.key);
                    }
                }
            }
        });
    });
}
