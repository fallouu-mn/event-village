/**
 * Contre-vérification du lot Carte B (22/11/2026) — preuves de bout en bout, serveur construit (job « responsive » de la
 * CI : nom en « …responsive.spec.ts »). Vert = attaque bloquée ; rouge = trou.
 *
 * Trous (rouges attendus) :
 *  T1 « Autour de moi » puis « Rechercher dans cette zone » : la zone envoyée au serveur est centrée sur la position du
 *     téléphone (centre retrouvé à quelques mètres près).
 *  T2 Fin d'événement par la tâche planifiée (vraie route GET /api/cron/events-finish, Bearer CRON_SECRET) : la fiche
 *     garde l'état « publié » (sans « Événement terminé ») bien au-delà de 5 s.
 *  T3 Nouveau nom commercial de la partenaire (PATCH /api/partner/profile) : la fiche (organisateur) garde l'ancien bien
 *     au-delà de 5 s.
 *
 * Garde-fous (verts attendus) :
 *  G1 « Autour de moi » seul : aucune requête (hors tuiles), aucun stockage, aucun cookie ne porte la position.
 *  G2 Écritures de la partenaire : position, dates, affiche, titre, annulation visibles sur la carte ou l'Explorer en moins
 *     de 5 s.
 *  G3 Middleware, requêtes HTTP brutes (chemins non normalisés par le client) : /leaflet/ ne sert que ses fichiers ; aucune
 *     page ni route protégée servie par ce biais.
 *  G4 CSP sous HTTPS de même origine (relais HTTP/2 local de la mesure mobile) : aucune violation img-src sur l'accueil,
 *     Explorer (liste et carte), la fiche (logos de paiement, carte du lieu), salles, tables, connexion, aide.
 *  G5 GET /api/events/carte sur le vrai serveur : paramètres piégés → 200 ou 400, jamais 500, réponse publique, rapide ;
 *     aucune écriture (POST, PUT, PATCH, DELETE refusés).
 *  G6 Fiche : aucune tuile avant « Afficher la carte » ; mention des fonds visible ensuite.
 *
 * Données : événements neufs de la partenaire de démonstration « organisateur3 » (utilisée par aucun autre test e2e),
 * connectée par l'API ; son nom commercial est rétabli à la fin de T3.
 */
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';
import { test, expect, openAnonymousContext } from './support/fixtures';
import { readDemoIds } from './support/demo-ids';
import { dakarDayFrom } from './support/parcours';
import { createPublishedEvent, partnerPosterOf, serviceClient, userIdByEmail } from './support/service';
import { installNetworkGuard } from './support/network';
import { APP_URL, e2eConfig } from './support/env';
import { TEST_PASSWORD } from './support/accounts';
import { FIXTURE_USERS } from '../tests/helpers/fixture-data';

const STAMP = `cvcb${randomUUID().slice(0, 6)}`;
const MAX_STALE_MS = 5_000;
const PORT = new URL(APP_URL).port || '3000';
const TILE_HOST = /(^|\.)tiles\.stadiamaps\.com$/;
/** Position simulée du téléphone (Sacré-Cœur, Dakar). */
const POS = { latitude: 14.72153, longitude: -17.46831 };

async function waitUntil(label: string, check: () => Promise<boolean>, timeoutMs: number, stepMs = 250): Promise<number> {
    const t0 = Date.now();
    for (;;) {
        if (await check()) return Date.now() - t0;
        if (Date.now() - t0 > timeoutMs) throw new Error(`[cvcb] ${label} : toujours faux après ${timeoutMs} ms`);
        await new Promise((r) => setTimeout(r, stepMs));
    }
}

/** Mesure sans lever : temps écoulé, ou null si toujours faux après `timeoutMs`. */
async function measure(check: () => Promise<boolean>, timeoutMs: number, stepMs = 250): Promise<number | null> {
    try {
        return await waitUntil('mesure', check, timeoutMs, stepMs);
    } catch {
        return null;
    }
}

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const k = 111_320;
    return Math.hypot((a.lat - b.lat) * k, (a.lng - b.lng) * k * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180));
}

/** Nombres décimaux d'un texte à moins de 0,02° de la position simulée (≈ 2 km). */
function nearPosition(text: string): string[] {
    const out: string[] = [];
    for (const m of text.matchAll(/-?\d{1,3}\.\d{2,}/g)) {
        const n = Number(m[0]);
        if (Math.abs(n - POS.latitude) < 0.02 || Math.abs(n - POS.longitude) < 0.02) out.push(m[0]);
    }
    return out;
}

async function exploreHtml(request: APIRequestContext, q: string): Promise<string> {
    const res = await request.get(`/explore?q=${encodeURIComponent(q)}`);
    expect(res.status(), 'Explorer').toBe(200);
    return res.text();
}

async function mapEvents(request: APIRequestContext, q: string): Promise<Array<Record<string, unknown>>> {
    const res = await request.get(`/api/events/carte?q=${encodeURIComponent(q)}`);
    expect(res.status(), 'lecture de la carte').toBe(200);
    return ((await res.json()) as { events: Array<Record<string, unknown>> }).events;
}

async function ficheHtml(request: APIRequestContext, id: string): Promise<string> {
    const res = await request.get(`/events/${id}`);
    expect(res.status(), 'fiche').toBe(200);
    return res.text();
}

/** Session API de la partenaire « organisateur3 » (vraie route de connexion). */
async function organisateur3(): Promise<{ api: APIRequestContext; userId: string; partnerId: string }> {
    const acc = readDemoIds().accounts.organisateur3;
    const api = await pwRequest.newContext({ baseURL: APP_URL });
    const res = await api.post('/api/auth/login', { data: { identifier: acc.email, password: TEST_PASSWORD } });
    expect(res.status(), `connexion d’organisateur3 : ${await res.text()}`).toBe(200);
    const { data, error } = await serviceClient().from('partners').select('id').eq('user_id', acc.userId).single();
    if (error || !data) throw new Error(`[cvcb] partenaire d’organisateur3 : ${error?.message ?? 'introuvable'}`);
    return { api, userId: acc.userId, partnerId: String(data.id) };
}

async function publish(partnerUserId: string, title: string, offsetDays: number, lat = 14.7215, lng = -17.4683): Promise<string> {
    const day = dakarDayFrom(new Date(), offsetDays);
    return createPublishedEvent({
        partnerUserId,
        superadminId: await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email),
        title,
        description: 'Contre-vérification du lot Carte B (invalidation). Données fictives.',
        startDate: day, startTime: '20:00:00', endDate: day, endTime: '23:00:00',
        location: 'Esplanade de contre-vérification', city: 'Dakar', capacity: 100,
        imageUrl: await partnerPosterOf(partnerUserId),
        latitude: lat, longitude: lng,
        category: { name: 'Standard', price: 3500, total: 50 },
    });
}

async function updatedAt(id: string): Promise<string> {
    const { data, error } = await serviceClient().from('events').select('updated_at').eq('id', id).single();
    if (error || !data) throw new Error(`[cvcb] updated_at de ${id} : ${error?.message ?? 'introuvable'}`);
    return String(data.updated_at);
}

async function editEvent(api: APIRequestContext, id: string, patch: Record<string, unknown>): Promise<void> {
    const res = await api.put(`/api/partner/events/${id}`, { data: { patch, expected_updated_at: await updatedAt(id) } });
    expect(res.status(), `modification ${JSON.stringify(patch)} : ${await res.text()}`).toBe(200);
}

// ── « Autour de moi » ──────────────────────────────────────────────────────────────────────────────────────────────

test.describe('cvcb · « Autour de moi »', () => {
    test.use({ geolocation: POS, permissions: ['geolocation'] });

    async function openMapAroundMe(page: Page): Promise<{ urls: string[]; bodies: string[]; tiles: string[] }> {
        const urls: string[] = [];
        const bodies: string[] = [];
        const tiles: string[] = [];
        page.on('request', (r) => {
            const u = new URL(r.url());
            if (TILE_HOST.test(u.hostname)) {
                tiles.push(r.url());
                return;
            }
            urls.push(r.url());
            const body = r.postData();
            if (body) bodies.push(body);
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/explore?vue=carte', { waitUntil: 'load' });
        await expect(page.getByRole('region', { name: 'Carte des événements' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.leaflet-control-attribution')).toContainText('Stadia Maps', { timeout: 30_000 });
        urls.length = 0;
        bodies.length = 0;
        await page.getByRole('button', { name: 'Autour de moi' }).click();
        await expect(page.getByRole('button', { name: 'Rechercher dans cette zone' })).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(1_500);
        return { urls, bodies, tiles };
    }

    test('G1 — « Autour de moi » seul : aucune requête, aucun stockage, aucun cookie ne porte la position', async ({ page, context }) => {
        test.setTimeout(120_000);
        const seen = await openMapAroundMe(page);
        const carried = [...seen.urls, ...seen.bodies].filter((t) => nearPosition(t).length > 0);
        console.log(`[cvcb] « Autour de moi » : ${seen.urls.length} requête(s) hors tuiles, ${seen.tiles.length} tuile(s) ; porteuses de la position : ${carried.length}`);
        expect(carried, 'requêtes qui portent la position').toEqual([]);
        const storage = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }));
        expect(nearPosition(storage), `stockage : ${storage.slice(0, 300)}`).toEqual([]);
        const cookies = JSON.stringify(await context.cookies());
        expect(nearPosition(cookies), 'cookies').toEqual([]);
    });

    test('T1 — puis « Rechercher dans cette zone » : la zone envoyée ne doit pas permettre de retrouver la position (≥ 1 km)', async ({ page }) => {
        test.setTimeout(120_000);
        await openMapAroundMe(page);
        const req = page.waitForRequest((r) => r.url().includes('/api/events/carte') && r.url().includes('zone='), { timeout: 15_000 });
        await page.getByRole('button', { name: 'Rechercher dans cette zone' }).click();
        const url = new URL((await req).url());
        const [s, w, n, e] = (url.searchParams.get('zone') ?? '').split(',').map(Number);
        const centre = { lat: (s + n) / 2, lng: (w + e) / 2 };
        const d = metres({ lat: POS.latitude, lng: POS.longitude }, centre);
        console.log(`[cvcb] « Rechercher dans cette zone » après « Autour de moi » : ${url.pathname}${url.search} ; centre à ${d.toFixed(1)} m de la position`);
        expect(d, `position retrouvée au centre de la zone envoyée (${d.toFixed(1)} m) : ${url.search}`).toBeGreaterThanOrEqual(1_000);
    });
});

// ── Invalidation ───────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('cvcb · invalidation', () => {
    test('G2 — position, dates, affiche, titre, annulation : carte ou Explorer à jour en moins de 5 s', async ({ page }) => {
        test.setTimeout(420_000);
        const o3 = await organisateur3();
        const tag = `${STAMP}g2`;
        const ev = {
            position: await publish(o3.userId, `CVCB position ${tag}`, 6),
            dates: await publish(o3.userId, `CVCB dates ${tag}`, 6),
            affiche: await publish(o3.userId, `CVCB affiche ${tag}`, 6),
            titre: await publish(o3.userId, `CVCB titre ${tag}`, 6),
            annulation: await publish(o3.userId, `CVCB annulation ${tag}`, 6),
        };
        // Entrée dans le cache (créés par la base, sans invalidation : jusqu'à 60 s)
        await waitUntil('événements sur la carte', async () => {
            const shown = new Set((await mapEvents(page.request, tag)).map((e) => String(e.id)));
            return Object.values(ev).every((id) => shown.has(id));
        }, 80_000, 1_000);
        await waitUntil('événements sur l’Explorer', async () => (await exploreHtml(page.request, tag)).includes(`CVCB affiche ${tag}`), 80_000, 1_000);
        const results: Record<string, number | null> = {};

        await editEvent(o3.api, ev.position, { latitude: 14.6681, longitude: -17.4357 });
        results.position = await measure(async () => (await mapEvents(page.request, tag)).some((e) => e.id === ev.position && e.lat === 14.6681 && e.lng === -17.4357), 65_000);

        const newDay = dakarDayFrom(new Date(), 9);
        await editEvent(o3.api, ev.dates, { start_date: newDay, end_date: newDay });
        results.dates = await measure(async () => (await mapEvents(page.request, tag)).some((e) => e.id === ev.dates && String(e.startsAt).startsWith(newDay)), 65_000);

        const poster = await partnerPosterOf(o3.userId);
        const file = poster.split('/').pop() ?? '';
        await editEvent(o3.api, ev.affiche, { image_url: poster });
        results.affiche = await measure(async () => (await exploreHtml(page.request, `CVCB affiche ${tag}`)).includes(file), 65_000);

        await editEvent(o3.api, ev.titre, { title: `CVCB titre renommé ${tag}` });
        results.titre = await measure(async () => (await mapEvents(page.request, tag)).some((e) => e.id === ev.titre && e.title === `CVCB titre renommé ${tag}`), 65_000);

        const cancel = await o3.api.post(`/api/partner/events/${ev.annulation}/cancel`, {
            data: { publicNotice: 'Annulé pour la contre-vérification de la carte.', internalReason: 'cvcb', confirmTitle: `CVCB annulation ${tag}` },
        });
        expect(cancel.status(), `annulation : ${await cancel.text()}`).toBe(200);
        results.annulation = await measure(async () => !(await mapEvents(page.request, tag)).some((e) => e.id === ev.annulation), 65_000);

        console.log(`[cvcb] invalidations (ms ; null = plus de 65 s) : ${JSON.stringify(results)}`);
        for (const [what, ms] of Object.entries(results)) {
            expect.soft(ms, `${what} : visible en moins de 5 s`).not.toBeNull();
            if (ms !== null) expect.soft(ms, `${what} : ${ms} ms`).toBeLessThan(MAX_STALE_MS);
        }
        await o3.api.dispose();
    });

    test('T2 — fin par la tâche planifiée : la fiche montre « Événement terminé » en moins de 5 s', async ({ page }) => {
        test.setTimeout(300_000);
        const secret = process.env.CRON_SECRET;
        expect(secret, `CRON_SECRET absente de ${e2eConfig().envFile}`).toBeTruthy();
        const o3 = await organisateur3();
        const id = await publish(o3.userId, `CVCB fin planifiée ${STAMP}`, 6);
        await o3.api.dispose();
        // Le temps passe : fin il y a une heure (heure de Dakar = UTC), sans écriture de l'application (rien n'invalide)
        const start = new Date(Date.now() - 3 * 3_600_000);
        const end = new Date(Date.now() - 3_600_000);
        const parts = (d: Date) => ({ date: d.toISOString().slice(0, 10), time: `${d.toISOString().slice(11, 16)}:00` });
        const s = parts(start);
        const e = parts(end);
        const { error } = await serviceClient().from('events').update({ start_date: s.date, start_time: s.time, end_date: e.date, end_time: e.time }).eq('id', id);
        expect(error, `fin passée : ${error?.message}`).toBeNull();
        const endIso = `${e.date}T${e.time}.000Z`;
        // Cache de la fiche rempli APRÈS le passage de l'heure (publiée, fin passée) : la fiche vient d'être préparée
        await waitUntil('fiche préparée avec la fin passée', async () => (await ficheHtml(page.request, id)).includes(endIso), 80_000, 1_000);
        expect(await ficheHtml(page.request, id), 'avant la tâche : pas encore « terminé »').not.toContain('Événement terminé');

        const cron = await fetch(`http://127.0.0.1:${PORT}/api/cron/events-finish`, { headers: { authorization: `Bearer ${secret}` } });
        const report = await cron.text();
        expect(cron.status, `tâche planifiée : ${report.slice(0, 300)}`).toBe(200);
        expect(report, 'événement passé à TERMINE par la tâche').toContain(id);
        const { data: row } = await serviceClient().from('events').select('status').eq('id', id).single();
        expect(row?.status, 'statut en base').toBe('TERMINE');
        const elapsed = await measure(async () => (await ficheHtml(page.request, id)).includes('Événement terminé'), 70_000);
        console.log(`[cvcb] fin planifiée visible sur la fiche après ${elapsed === null ? 'plus de 70 000' : elapsed} ms`);
        expect(elapsed, 'la fiche montre « Événement terminé »').not.toBeNull();
        expect(elapsed ?? Infinity, 'en moins de 5 s').toBeLessThan(MAX_STALE_MS);
    });

    test('T3 — nouveau nom commercial de la partenaire : la fiche suit en moins de 5 s', async ({ page }) => {
        test.setTimeout(300_000);
        const o3 = await organisateur3();
        const title = `CVCB nom ${STAMP}`;
        const id = await publish(o3.userId, title, 6);
        const { data: before } = await serviceClient().from('partners').select('commercial_name').eq('id', o3.partnerId).single();
        const oldName = String(before?.commercial_name ?? '');
        expect(oldName.length, 'nom commercial actuel').toBeGreaterThan(1);
        // Fiche préparée avec l'ancien nom (organisateur affiché sous le titre)
        await waitUntil('fiche avec le nom de la partenaire', async () => {
            const html = await ficheHtml(page.request, id);
            return html.includes(title) && html.includes(oldName);
        }, 80_000, 1_000);
        const newName = `Petite-Côte CVCB ${STAMP}`;
        try {
            const res = await o3.api.patch('/api/partner/profile', { data: { commercial_name: newName } });
            expect(res.status(), `nouveau nom : ${await res.text()}`).toBe(200);
            const elapsed = await measure(async () => (await ficheHtml(page.request, id)).includes(newName), 70_000);
            console.log(`[cvcb] nouveau nom commercial visible sur la fiche après ${elapsed === null ? 'plus de 70 000' : elapsed} ms (événement ${id})`);
            expect(elapsed, 'nouveau nom visible').not.toBeNull();
            expect(elapsed ?? Infinity, 'en moins de 5 s').toBeLessThan(MAX_STALE_MS);
        } finally {
            const back = await o3.api.patch('/api/partner/profile', { data: { commercial_name: oldName } });
            console.log(`[cvcb] nom commercial rétabli : HTTP ${back.status()}`);
            await o3.api.dispose();
        }
    });
});

// ── Middleware : requêtes brutes ───────────────────────────────────────────────────────────────────────────────────

function rawGet(pathname: string): Promise<{ status: number; type: string; location: string; body: string }> {
    return new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port: Number(PORT), method: 'GET', path: pathname, headers: { host: `localhost:${PORT}` } }, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (c: Buffer) => chunks.push(c));
            res.on('end', () => resolve({
                status: res.statusCode ?? 0,
                type: String(res.headers['content-type'] ?? ''),
                location: String(res.headers.location ?? ''),
                body: Buffer.concat(chunks).toString('utf8').slice(0, 4_000),
            }));
        });
        req.on('error', reject);
        req.setTimeout(20_000, () => req.destroy(new Error(`délai dépassé : ${pathname}`)));
        req.end();
    });
}

test.describe('cvcb · middleware', () => {
    test('G3 — /leaflet/ ne sert que ses fichiers ; aucun chemin détourné ne sert une page ou une route protégée', async () => {
        test.setTimeout(240_000);
        const css = await rawGet('/leaflet/leaflet-1.9.4.css');
        expect(css.status, 'feuille de style').toBe(200);
        expect(css.type).toContain('text/css');
        const png = await rawGet('/leaflet/marker-icon.png');
        expect(png.status, 'icône').toBe(200);
        expect((await rawGet('/leaflet/inexistant.js')).status, 'fichier absent').toBe(404);

        const targets = ['admin', 'admin/events', 'partner/dashboard', 'tickets', 'controller/scanner', 'api/admin/users', 'api/partner/profile', 'api/tickets', 'api/auth/me'];
        const forms = (t: string): string[] => [
            `/leaflet/../${t}`, `/leaflet/%2e%2e/${t}`, `/leaflet/..%2f${t}`, `/leaflet/..%2F${t}`, `/leaflet/%2e%2e%2f${t}`,
            `/leaflet/..%5c${t}`, `/leaflet/..\\${t}`, `/leaflet//../${t}`, `/leaflet/%252e%252e/${t}`, `/leaflet/..;/${t}`,
            `/leaflet/%2f${t}`, `/leaflet/${t}`, `/leaflet/x/../../${t}`, `//leaflet/../${t}`, `/leaflet/.%2e/${t}`,
        ];
        const leaks: string[] = [];
        const summary = new Map<string, number>();
        for (const t of targets) {
            for (const p of forms(t)) {
                // Redirections suivies (3 au plus) : une redirection vers /admin ou /tickets n'est pas une fuite si la page
                // d'arrivée est refusée sans session ; la fuite est une réponse 2xx d'une page ou d'une route protégée
                let at = p;
                let r = await rawGet(at);
                const hops: string[] = [`${r.status}`];
                for (let i = 0; i < 3 && r.status >= 300 && r.status < 400 && r.location; i++) {
                    at = new URL(r.location, `http://localhost:${PORT}`).pathname + new URL(r.location, `http://localhost:${PORT}`).search;
                    r = await rawGet(at);
                    hops.push(`${at.slice(0, 30)} ${r.status}`);
                }
                const key = hops.map((h) => h.replace(/^.* (\d+)$/, '$1')).join('→');
                summary.set(key, (summary.get(key) ?? 0) + 1);
                const finalPath = at.split('?')[0];
                const servedLogin = finalPath === '/login';
                if (r.status >= 200 && r.status < 300 && !servedLogin) leaks.push(`${p} → ${hops.join(' → ')} ${r.type} ${r.body.slice(0, 120).replace(/\s+/g, ' ')}`);
            }
        }
        console.log(`[cvcb] middleware, ${targets.length * forms('x').length} chemins détournés : ${JSON.stringify(Object.fromEntries(summary))}`);
        expect(leaks, leaks.join('\n')).toEqual([]);
    });
});

// ── CSP sous HTTPS de même origine ─────────────────────────────────────────────────────────────────────────────────

test.describe('cvcb · CSP', () => {
    test('G4 — aucune violation img-src sous HTTPS de même origine (accueil, Explorer, fiche, salles, tables, connexion, aide)', async ({ browser }, testInfo) => {
        test.setTimeout(240_000);
        const mod = await import(pathToFileURL(path.resolve('scripts/e2e/h2-proxy.mjs')).href) as {
            startH2Proxy: (target: string, dir: string) => Promise<{ origin: string; port: number; close: () => Promise<void> }>;
        };
        const proxy = await mod.startH2Proxy(`http://127.0.0.1:${PORT}`, path.join(os.tmpdir(), 'cvcb-h2'));
        const context = await openAnonymousContext(browser, testInfo, 'clair', { ignoreHTTPSErrors: true, baseURL: proxy.origin, viewport: { width: 390, height: 844 } });
        try {
            await installNetworkGuard(context, new Set([...e2eConfig().allowedHosts, `localhost:${proxy.port}`]));
            await context.addInitScript(() => {
                const w = window as unknown as { __cvcbCsp: string[] };
                w.__cvcbCsp = [];
                document.addEventListener('securitypolicyviolation', (e) => {
                    w.__cvcbCsp.push(`${e.effectiveDirective} ${e.blockedURI} ${e.disposition} ${location.pathname}`);
                });
            });
            const page = await context.newPage();
            const fiche = readDemoIds().events.publie.id;
            const pages = ['/', '/explore', '/explore?vue=carte', `/events/${fiche}`, '/halls', '/tables', '/login', '/aide'];
            const all: string[] = [];
            for (const p of pages) {
                await page.goto(p, { waitUntil: 'load' });
                expect(new URL(page.url()).origin, `${p} servie en HTTPS par le relais`).toBe(proxy.origin);
                // Défilement complet : images paresseuses, logos de paiement, aperçu de la carte de l'accueil
                await page.evaluate(async () => {
                    for (let y = 0; y < document.body.scrollHeight; y += 400) {
                        window.scrollTo(0, y);
                        await new Promise((r) => setTimeout(r, 120));
                    }
                });
                if (p.startsWith('/events/')) {
                    const show = page.getByRole('button', { name: 'Afficher la carte' });
                    if (await show.count()) await show.first().click();
                }
                await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
                await page.waitForTimeout(800);
                const v = await page.evaluate(() => (window as unknown as { __cvcbCsp?: string[] }).__cvcbCsp ?? []);
                all.push(...v);
            }
            console.log(`[cvcb] CSP sous HTTPS (${proxy.origin}) : ${all.length} violation(s) ${JSON.stringify(all)}`);
            const img = all.filter((v) => v.startsWith('img-src'));
            expect(img, 'violations img-src').toEqual([]);
        } finally {
            await context.close();
            await proxy.close();
        }
    });
});

// ── Lecture publique sur le vrai serveur ───────────────────────────────────────────────────────────────────────────

test.describe('cvcb · lecture publique', () => {
    test('G5 — paramètres piégés : 200 ou 400, jamais 500, champs publics, rapide ; aucune écriture', async ({ request }) => {
        test.setTimeout(180_000);
        const traps = [
            '', 'zone=1e9,1,2,3', 'zone=-90,-180,90,180', 'zone=NaN,NaN,NaN,NaN', `zone=${'9'.repeat(3000)},1,2,3`, 'zone=14.7,-17.5,14.8,-17.4;DROP%20TABLE%20events',
            'du=2026-02-30&au=2026-03-01', 'du=0000-01-01&au=9999-01-01', `q=${'a'.repeat(4000)}`, "q='%20OR%201=1%20--", 'q=),or(status.neq.PUBLIE',
            'q=%00', 'categorie=BROUILLON', 'gratuit=1&gratuit=0', `ville=${'x'.repeat(4000)}`, 'quand=1;select', 'status=BROUILLON&select=*&limit=100000',
            'or=(status.eq.BROUILLON)', 'zone=14.6,-17.6,14.9,-17.2&q=CVCB&categorie=CONCERT&gratuit=1&ville=Dakar&quand=semaine',
        ];
        const fields = ['blur', 'color', 'endsAt', 'highlight', 'id', 'lat', 'lng', 'price', 'startsAt', 'title'];
        const statuses = new Map<number, number>();
        for (const q of traps) {
            const t0 = Date.now();
            const res = await request.get(`/api/events/carte${q ? `?${q}` : ''}`);
            const ms = Date.now() - t0;
            statuses.set(res.status(), (statuses.get(res.status()) ?? 0) + 1);
            expect([200, 400], `?${q.slice(0, 60)} : HTTP ${res.status()}`).toContain(res.status());
            expect(ms, `?${q.slice(0, 60)} : ${ms} ms`).toBeLessThan(5_000);
            expect(res.headers()['cache-control'] ?? '', 'no-store').toContain('no-store');
            if (res.status() === 200) {
                const body = await res.json() as { events: Array<Record<string, unknown>>; total: number; truncated: boolean };
                expect(Object.keys(body).sort()).toEqual(['events', 'total', 'truncated']);
                expect(body.events.length).toBeLessThanOrEqual(300);
                for (const e of body.events) expect(Object.keys(e).sort(), `?${q.slice(0, 60)}`).toEqual(fields);
            }
        }
        console.log(`[cvcb] lecture publique, ${traps.length} adresses piégées : ${JSON.stringify(Object.fromEntries(statuses))}`);
        for (const method of ['post', 'put', 'patch', 'delete'] as const) {
            const res = await request[method]('/api/events/carte', { data: { status: 'PUBLIE' } });
            expect(res.status(), `${method.toUpperCase()} /api/events/carte`).toBe(405);
        }
    });

    test('G6 — fiche : aucune tuile avant « Afficher la carte » ; mention des fonds visible ensuite', async ({ page }) => {
        test.setTimeout(120_000);
        const tiles: string[] = [];
        page.on('request', (r) => { if (TILE_HOST.test(new URL(r.url()).hostname)) tiles.push(r.url()); });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`/events/${readDemoIds().events.publie.id}`, { waitUntil: 'load' });
        const show = page.getByRole('button', { name: 'Afficher la carte' });
        await show.scrollIntoViewIfNeeded();
        await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
        await page.waitForTimeout(1_000);
        expect(tiles, 'aucune tuile avant le geste').toEqual([]);
        await show.click();
        await expect(page.locator('.leaflet-control-attribution')).toContainText('Stadia Maps', { timeout: 30_000 });
        await expect(page.locator('.leaflet-control-attribution')).toContainText('contributeurs OpenStreetMap');
        await expect(page.locator('.leaflet-control-attribution')).toBeVisible();
        await waitUntil('tuiles demandées après le geste', async () => tiles.length > 0, 15_000);
    });
});
