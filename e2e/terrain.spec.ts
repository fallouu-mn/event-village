/**
 * Lot 7 (contrat, section 11.5 ; tâches 7.1 et 7.2) — projet Playwright « terrain » : billet hors ligne avec le
 * service worker et scanner du contrôleur, sur l'application démarrée (next start) et la base locale seedée.
 *
 * Données : chaque test prépare son propre événement par scripts/e2e/terrain-setup.ts (partenaire A du seed de
 * test, début à ≈ 20 h de l'heure réelle, billets gratuits émis par free_tickets_claim, contrôleur A affecté) et
 * pose `access.scan_window_before_hours = 24` (D6), remis dans un finally. Aucune route n'accepte d'heure.
 * Comptes : fumee-client (porteur des billets présentés hors ligne), fumee-client-bis (porteur des billets
 * scannés en série, lus par sa route live-code), fumee-controleur (scanner).
 *
 * Contextes : service worker autorisé seulement pour le client (`serviceWorkers: 'allow'`, D7) ; horloge
 * installée seulement dans le contexte du client du test 1 (jamais chez le contrôleur ni pendant une mesure :
 * marques factices sinon). Le réseau 3G est posé par CDP après le chargement et retiré avant tout setOffline.
 *
 * Les tests s'exécutent dans l'ordre du fichier (projet terrain, fullyParallel: false, --workers=1), sans mode
 * « serial » : un test rouge n'empêche pas les suivants, ni la mesure du scan (écrite avant ses assertions).
 * Les erreurs du navigateur sont imprimées et jointes au rapport, sans bloquer (aucun contrôle de ce type
 * n'est demandé par le contrat pour ce projet).
 */
import type { Browser, BrowserContext, Locator, Page, TestInfo } from '@playwright/test';
import { test, expect, openRoleContext } from './support/fixtures';
import type { RoleKey } from './support/accounts';
import { CDP_NO_THROTTLING, cdpNetworkConditions, NET_3G } from './support/devices';
import { PageGuard } from './support/network';
import {
    fmtMs, forgedPayload, installScanProbe, livePayload, median, openScanner, percentile, prepareTerrainEvent,
    presentPayload, presentPayloadNoResult, probeTracks, probeVibrations, restoreTerrainSetting, scanMarks, ticketScans,
    writePerfFile, type ProbeRecord, type TerrainEvent,
} from './support/terrain';

const OFFLINE_PATH = '/billet/hors-ligne';
const OFFLINE_CACHE = 'ev-hors-ligne-lot7-1';
/** Contrat 5.3 : ressources publiques que le service worker peut mettre en cache. */
const PUBLIC_ASSETS = [
    '/manifest.json', '/favicon.ico', '/branding/event-village-mark.svg', '/icon-192x192.png', '/icon-512x512.png',
    '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png',
];
/** D50 : motifs de vibration. */
const VIBRATION_ACCEPTE = [60];
const VIBRATION_REFUS = [120, 60, 120, 60, 120];
const REFUS = new Set(['invalid', 'qr_expired', 'cancelled', 'refunded', 'wrong_event', 'dynamic_qr_required', 'manual_entry_refused', 'payment_required', 'already_used']);

interface Opened { role: string; context: BrowserContext; page: Page; guard: PageGuard }

/** Contextes ouverts par un test, fermés et diagnostiqués dans son finally. */
class Session {
    readonly opened: Opened[] = [];

    constructor(private readonly browser: Browser, private readonly testInfo: TestInfo) {}

    async open(role: RoleKey, opts: { serviceWorkers?: 'allow'; clockOffsetMs?: number; probe?: boolean } = {}): Promise<Opened> {
        const context = await openRoleContext(this.browser, this.testInfo, role, role === 'fumee-controleur' ? 'sombre' : 'clair',
            opts.serviceWorkers ? { serviceWorkers: opts.serviceWorkers } : {});
        if (opts.probe) await context.addInitScript(installScanProbe);
        if (opts.clockOffsetMs !== undefined) await context.clock.install({ time: Date.now() + opts.clockOffsetMs });
        const page = await context.newPage();
        const o = { role, context, page, guard: new PageGuard(page) };
        this.opened.push(o);
        return o;
    }

    /** Page du porteur sur une ressource statique (aucun script de l'application) : origine des appels fetch. */
    async holder(role: RoleKey): Promise<Page> {
        const o = await this.open(role);
        await o.page.goto('/manifest.json');
        return o.page;
    }

    async close(): Promise<void> {
        const issues = this.opened.flatMap(({ role, guard }) => [...guard.blockingIssues(), ...guard.nonBlockingIssues()].map((i) => `${role} : ${i}`));
        if (issues.length > 0) {
            console.log(`[e2e][terrain] ${this.testInfo.title} — observations du navigateur (non bloquantes) :\n${issues.join('\n')}`);
            await this.testInfo.attach('navigateur.txt', { body: issues.join('\n'), contentType: 'text/plain' });
        }
        for (const o of this.opened) await o.context.close();
    }
}

/** Carte du billet dans Mes billets (repérée par son numéro). */
function ticketCard(page: Page, ticketNumber: string): Locator {
    return page.locator('li, article').filter({ hasText: ticketNumber }).last();
}

async function expectOfflineAvailable(page: Page, ticketNumber: string): Promise<void> {
    const card = ticketCard(page, ticketNumber);
    await expect(card, `carte du billet ${ticketNumber} dans Mes billets`).toBeVisible({ timeout: 45_000 });
    await expect(card.locator('[data-ev-offline-state]'),
        `indicateur hors ligne de la carte ${ticketNumber} (contrat 5.2) : « available » attendu après le téléchargement automatique`)
        .toHaveAttribute('data-ev-offline-state', 'available', { timeout: 45_000 });
}

/** Scanne un payload et exige `[data-scan-result=<attendu>]` affiché. */
async function scanAndExpect(ctl: Page, payload: string, what: string, expected: string): Promise<ProbeRecord> {
    const { record } = await presentPayload(ctl, payload, what);
    await expect(ctl.locator(`[data-scan-result="${expected}"]`).first(), `${what} : résultat « ${expected} » attendu (sonde : « ${record.result ?? '—'} »)`).toBeVisible();
    return record;
}

// ── 1. Écart d'horloge ±5 min ─────────────────────────────────────────────

for (const [label, offsetMin] of [['en avance de 5 min', 5], ['en retard de 5 min', -5]] as const) {
    test(`1. téléphone ${label} : codes téléchargés, hors ligne, QR accepté par le contrôleur`, async ({ browser }, testInfo) => {
        test.setTimeout(5 * 60_000);
        const s = new Session(browser, testInfo);
        let ev: TerrainEvent | null = null;
        try {
            ev = prepareTerrainEvent(`écart ${offsetMin > 0 ? '+' : ''}${offsetMin} min`, 'client', 1);
            const ticket = ev.tickets[0];
            const client = await s.open('fumee-client', { serviceWorkers: 'allow', clockOffsetMs: offsetMin * 60_000 });
            await client.page.goto('/tickets');
            await expectOfflineAvailable(client.page, ticket.number);

            await client.context.setOffline(true);
            client.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
            const res = await client.page.goto(`${OFFLINE_PATH}?id=${ticket.id}`);
            expect(res?.fromServiceWorker(), `${OFFLINE_PATH} hors ligne : réponse servie par le service worker`).toBe(true);
            const qr = client.page.locator('[data-ev-qr-payload]');
            await expect(qr, 'QR du billet affiché hors ligne (data-ev-qr-payload)').toBeVisible({ timeout: 20_000 });
            const payload = String(await qr.getAttribute('data-ev-qr-payload'));
            expect(payload, 'payload du QR hors ligne : <préfixe>:<billet>:<6 chiffres>').toMatch(new RegExp(`:${ticket.id}:\\d{6}$`));

            const ctl = await s.open('fumee-controleur', { probe: true });
            await openScanner(ctl.page, ev.title);
            await scanAndExpect(ctl.page, payload, `code affiché par un téléphone ${label}`, 'valid');
            const db = ticketScans(ticket.id);
            expect(db.ticket.status, `billet ${ticket.number} composté`).toBe('UTILISE');
            expect(db.scans.filter((r) => r.accepted).length, `une seule entrée acceptée : ${JSON.stringify(db.scans)}`).toBe(1);
        } finally {
            await s.close();
            restoreTerrainSetting(ev);
        }
    });
}

// ── 2. Cache du service worker sans /api/ ──────────────────────────────────

test('2. cache du service worker : coquille hors ligne et ressources statiques seulement, anciens caches supprimés', async ({ browser }, testInfo) => {
    test.setTimeout(4 * 60_000);
    const s = new Session(browser, testInfo);
    let ev: TerrainEvent | null = null;
    try {
        ev = prepareTerrainEvent('cache sans api', 'client', 1);
        const ticket = ev.tickets[0];
        const client = await s.open('fumee-client', { serviceWorkers: 'allow' });
        const servedApi: string[] = [];
        client.page.on('response', (r) => {
            if (r.fromServiceWorker() && new URL(r.url()).pathname.startsWith('/api/')) servedApi.push(`${r.status()} ${r.url()}`);
        });

        // Anciens caches créés avant tout enregistrement (page statique : aucun script de l'application)
        await client.page.goto('/manifest.json');
        const before = await client.page.evaluate(async () => {
            const registrations = (await navigator.serviceWorker.getRegistrations()).length;
            for (const name of ['event-village-v1', 'ev-hors-ligne-ancien']) {
                const cache = await caches.open(name);
                await cache.put('/__e2e-ancien', new Response('ancien cache du projet terrain'));
            }
            return { registrations, keys: (await caches.keys()).sort() };
        });
        expect(before, 'anciens caches posés avant l’enregistrement du service worker').toEqual({ registrations: 0, keys: ['ev-hors-ligne-ancien', 'event-village-v1'] });

        await client.page.goto('/tickets');
        await client.page.waitForFunction(async () => {
            const reg = await navigator.serviceWorker.getRegistration('/');
            return reg?.active?.state === 'activated';
        }, null, { timeout: 30_000 });
        await expect.poll(() => client.page.evaluate(async () => (await caches.keys()).sort()), {
            message: `caches après l’activation : seul ${OFFLINE_CACHE} attendu (event-village-v1 et ev-hors-ligne-ancien supprimés)`, timeout: 30_000,
        }).toEqual([OFFLINE_CACHE]);
        await expectOfflineAvailable(client.page, ticket.number);

        const urls = await client.page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url), OFFLINE_CACHE);
        const paths = urls.map((u) => new URL(u));
        const outside = paths.filter((u) => !(u.pathname === OFFLINE_PATH || u.pathname.startsWith('/_next/static/') || PUBLIC_ASSETS.includes(u.pathname)));
        const forbidden = paths.filter((u) => u.pathname.startsWith('/api/') || u.searchParams.has('_rsc'));
        console.log(`[e2e][terrain] cache ${OFFLINE_CACHE} : ${urls.length} entrée(s)\n${urls.join('\n')}`);
        expect(forbidden.map(String), 'aucune réponse /api/ ni charge _rsc en cache').toEqual([]);
        expect(outside.map(String), `cache limité à ${OFFLINE_PATH}, /_next/static/ et aux ressources publiques du contrat 5.3`).toEqual([]);
        expect(paths.some((u) => u.pathname === OFFLINE_PATH), `coquille ${OFFLINE_PATH} en cache`).toBe(true);
        expect(paths.some((u) => u.pathname.startsWith('/_next/static/')), 'ressources /_next/static/ de la coquille en cache').toBe(true);
        expect(servedApi, 'aucune réponse /api/ servie par le service worker').toEqual([]);

        await client.context.setOffline(true);
        client.guard.freeze();
        const outcome = await client.page.evaluate(async (id) => {
            try {
                const r = await fetch(`/api/tickets/${id}/offline-codes`, { cache: 'no-store' });
                return `servi (HTTP ${r.status})`;
            } catch (err) {
                return `rejeté (${err instanceof Error ? err.message : String(err)})`;
            }
        }, ticket.id);
        expect(outcome, 'hors ligne, la route des codes n’est jamais servie depuis un cache').toMatch(/^rejeté/);
    } finally {
        await s.close();
        restoreTerrainSetting(ev);
    }
});

// ── 3. Idempotence : réponse perdue puis relance ───────────────────────────

test('3. réponse du scan perdue : relance automatique avec la même clé, une seule entrée', async ({ browser }, testInfo) => {
    test.setTimeout(4 * 60_000);
    const s = new Session(browser, testInfo);
    let ev: TerrainEvent | null = null;
    try {
        ev = prepareTerrainEvent('idempotence', 'client-bis', 1);
        const ticket = ev.tickets[0];
        const holder = await s.holder('fumee-client-bis');
        const ctl = await s.open('fumee-controleur', { probe: true });
        await openScanner(ctl.page, ev.title);

        const posts: Array<string | null> = [];
        ctl.page.on('request', (req) => {
            if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/controller/scan') posts.push(req.headers()['idempotency-key'] ?? null);
        });
        let lost = 0;
        let lostStatus = 0;
        await ctl.page.route('**/api/controller/scan', async (route) => {
            if (route.request().method() !== 'POST' || lost > 0) {
                await route.fallback();
                return;
            }
            lost += 1;
            const served = await route.fetch(); // le serveur traite la lecture…
            lostStatus = served.status();
            await route.abort('timedout'); // … mais l'écran ne voit jamais la réponse
        });

        await presentPayload(ctl.page, await livePayload(holder, ticket.id), 'scan dont la première réponse est perdue', 60_000);
        expect(lost, 'une réponse perdue simulée').toBe(1);
        expect(lostStatus, 'la lecture perdue a bien été traitée par le serveur').toBe(200);
        await expect(ctl.page.locator('[data-scan-result="valid"]').first(),
            `relance automatique après la réponse perdue : « valid » attendu (envois : ${posts.length})`).toBeVisible({ timeout: 30_000 });
        await expect(ctl.page.locator('[data-scan-result="already_used"]'), 'jamais « déjà utilisé » pour la relance de sa propre lecture').toHaveCount(0);
        expect(posts.length, 'au moins deux envois (lecture perdue, puis relance)').toBeGreaterThanOrEqual(2);
        expect(posts[0], 'en-tête Idempotency-Key sur chaque envoi (D39)').toMatch(/^[0-9a-f-]{36}$/i);
        expect(new Set(posts).size, `même clé pour la lecture et sa relance : ${JSON.stringify(posts)}`).toBe(1);

        const db = ticketScans(ticket.id);
        expect(db.scans.filter((r) => r.accepted).length, `une seule ligne acceptée : ${JSON.stringify(db.scans)}`).toBe(1);
        expect(db.scans.filter((r) => r.result === 'already_used').length, `aucune ligne already_used : ${JSON.stringify(db.scans)}`).toBe(0);
        expect(db.ticket.status).toBe('UTILISE');
    } finally {
        await s.close();
        restoreTerrainSetting(ev);
    }
});

// ── 4. Mesure du scan : réseau normal, 3G, puis hors ligne ─────────────────

interface ScanRow { reseau: 'normal' | '3G'; attendu: 'valid' | 'already_used'; ticket: string; record: ProbeRecord }

/** Payload courant d'un billet, différent de `used` (QR changé : pas suivant de 20 s). */
async function freshPayload(holder: Page, ticketId: string, used: string): Promise<string> {
    const deadline = Date.now() + 30_000;
    for (;;) {
        const p = await livePayload(holder, ticketId);
        if (p !== used) return p;
        if (Date.now() > deadline) throw new Error(`live-code du billet ${ticketId} : même code après 30 s`);
        await holder.waitForTimeout(2_000); // attente réelle du pas suivant du QR dynamique (20 s)
    }
}

test('4. mesure du scan : 10 lectures en réseau normal, 10 en 3G, puis une lecture hors ligne', async ({ browser }, testInfo) => {
    test.setTimeout(12 * 60_000);
    const s = new Session(browser, testInfo);
    let ev: TerrainEvent | null = null;
    try {
        ev = prepareTerrainEvent('mesure du scan', 'client-bis', 10);
        const holder = await s.holder('fumee-client-bis');
        const ctl = await s.open('fumee-controleur', { probe: true });
        await openScanner(ctl.page, ev.title);

        const rows: ScanRow[] = [];
        const series: Array<{ reseau: 'normal' | '3G'; tickets: typeof ev.tickets }> = [
            { reseau: 'normal', tickets: ev.tickets.slice(0, 5) },
            { reseau: '3G', tickets: ev.tickets.slice(5, 10) },
        ];
        let cdp: Awaited<ReturnType<BrowserContext['newCDPSession']>> | null = null;
        for (const serie of series) {
            if (serie.reseau === '3G') {
                // Bridage par CDP après le chargement (D83) ; jamais combiné à setOffline
                cdp = await ctl.context.newCDPSession(ctl.page);
                await cdp.send('Network.enable');
                await cdp.send('Network.emulateNetworkConditions', cdpNetworkConditions(NET_3G));
            }
            const used = new Map<string, string>();
            for (const t of serie.tickets) {
                const payload = await livePayload(holder, t.id);
                used.set(t.id, payload);
                const { record } = await presentPayload(ctl.page, payload, `${serie.reseau} : billet neuf ${t.number}`);
                rows.push({ reseau: serie.reseau, attendu: 'valid', ticket: t.number, record });
            }
            for (const t of serie.tickets) {
                const payload = await freshPayload(holder, t.id, used.get(t.id) as string);
                const { record } = await presentPayload(ctl.page, payload, `${serie.reseau} : billet déjà utilisé ${t.number}`);
                rows.push({ reseau: serie.reseau, attendu: 'already_used', ticket: t.number, record });
            }
        }
        if (cdp) {
            await cdp.send('Network.emulateNetworkConditions', CDP_NO_THROTTLING);
            await cdp.detach();
        }

        // Marques de l'application, rattachées à chaque lecture (entre sa présentation et la suivante)
        const marks = (await scanMarks(ctl.page)).sort((a, b) => a.startTime - b.startTime);
        const armed = rows.map((r) => r.record.armedAt);
        const measured = rows.map((r, i) => {
            const lo = armed[i];
            const hi = i + 1 < armed.length ? armed[i + 1] : Number.POSITIVE_INFINITY;
            const read = marks.find((m) => m.name === 'ev-scan:read' && m.startTime >= lo && m.startTime < hi) ?? null;
            const pending = read ? marks.find((m) => m.name === 'ev-scan:pending' && m.startTime >= read.startTime && m.startTime < hi) ?? null : null;
            const result = read ? marks.find((m) => m.name === 'ev-scan:result' && m.startTime >= read.startTime && m.startTime < hi) ?? null : null;
            const p = r.record;
            return {
                ...r,
                sondeAttente: p.readAt !== null && p.pendingAt !== null ? p.pendingAt - p.readAt : null,
                sondeResultat: p.readAt !== null && p.resultAt !== null ? p.resultAt - p.readAt : null,
                marqueAttente: read && pending ? pending.startTime - read.startTime : null,
                marqueResultat: read && result ? result.startTime - read.startTime : null,
            };
        });

        const summary: string[] = ['reseau\tsource\tmesure\tn\tmediane_ms\tp95_ms\tmin_ms\tmax_ms'];
        const stat = (reseau: 'normal' | '3G', pick: (m: typeof measured[number]) => number | null) => {
            const values = measured.filter((m) => m.reseau === reseau).map(pick).filter((v): v is number => v !== null);
            return { n: values.length, med: median(values), p95: percentile(values, 95), min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null };
        };
        const results: Record<string, ReturnType<typeof stat>> = {};
        for (const reseau of ['normal', '3G'] as const) {
            for (const [source, mesure, pick] of [
                ['marques', 'attente', (m: typeof measured[number]) => m.marqueAttente],
                ['marques', 'resultat', (m: typeof measured[number]) => m.marqueResultat],
                ['sonde', 'attente', (m: typeof measured[number]) => m.sondeAttente],
                ['sonde', 'resultat', (m: typeof measured[number]) => m.sondeResultat],
            ] as const) {
                const st = stat(reseau, pick);
                results[`${reseau}:${source}:${mesure}`] = st;
                summary.push([reseau, source, mesure, st.n, fmtMs(st.med), fmtMs(st.p95), fmtMs(st.min), fmtMs(st.max)].join('\t'));
                console.log(`[SCAN-MESURE] ${reseau} ${source} ${mesure === 'attente' ? 'attente − lecture' : 'résultat − lecture'} : n=${st.n} médiane=${fmtMs(st.med)} ms p95=${fmtMs(st.p95)} ms (min ${fmtMs(st.min)}, max ${fmtMs(st.max)})`);
            }
        }
        const detail = ['reseau\tattendu\tobtenu_sonde\tbillet\tsonde_attente_ms\tsonde_resultat_ms\tmarque_attente_ms\tmarque_resultat_ms',
            ...measured.map((m) => [m.reseau, m.attendu, m.record.result ?? '', m.ticket, fmtMs(m.sondeAttente), fmtMs(m.sondeResultat), fmtMs(m.marqueAttente), fmtMs(m.marqueResultat)].join('\t'))];
        const fileSummary = writePerfFile('scan.tsv', summary.join('\n'));
        writePerfFile('scan-lectures.tsv', detail.join('\n'));
        await testInfo.attach('scan.tsv', { path: fileSummary, contentType: 'text/tab-separated-values' });
        console.log(`[SCAN-MESURE] réseau 3G (D83) : latence ${NET_3G.latency} ms, ${NET_3G.downloadThroughput * 8 / 1000} kbit/s descendant, ${NET_3G.uploadThroughput * 8 / 1000} kbit/s montant ; tableaux écrits dans ${fileSummary} et scan-lectures.tsv`);
        const probe3g = results['3G:sonde:resultat'];
        if (probe3g.med !== null && probe3g.med < NET_3G.latency) {
            console.log(`[SCAN-MESURE] AVERTISSEMENT : médiane 3G résultat − lecture (sonde) ${fmtMs(probe3g.med)} ms < latence simulée ${NET_3G.latency} ms : bridage CDP peut-être non appliqué`);
        }
        for (const key of ['normal:marques:attente', 'normal:marques:resultat', '3G:marques:attente', '3G:marques:resultat']) {
            const st = results[key];
            console.log(`[SCAN-MESURE] AVERTISSEMENT (non bloquant) ${key} p95=${fmtMs(st.p95)} ms`);
        }

        // Hors ligne : une lecture → état « Hors ligne », aucune vibration (D47)
        await ctl.context.setOffline(true);
        ctl.guard.freeze();
        const offline = await presentPayloadNoResult(ctl.page, await livePayload(holder, ev.tickets[0].id), 'lecture hors ligne');
        await expect.soft(ctl.page.locator('[data-scan-state="offline"]').first(), 'lecture hors ligne : état data-scan-state="offline"').toBeAttached({ timeout: 10_000 });
        const offlineVibrations = (await probeVibrations(ctl.page)).filter((v) => offline.record.readAt !== null && v.at >= offline.record.readAt);
        expect.soft(offlineVibrations.map((v) => v.pattern), 'aucune vibration pour un incident technique (hors ligne)').toEqual([]);
        await ctl.context.setOffline(false);

        // Assertions (après l'écriture des mesures, pour que le run « avant » les produise)
        for (const m of measured) {
            expect.soft(m.record.result, `${m.reseau} billet ${m.ticket} : résultat affiché`).toBe(m.attendu);
        }
        for (const reseau of ['normal', '3G'] as const) {
            for (const mesure of ['attente', 'resultat'] as const) {
                expect.soft(results[`${reseau}:marques:${mesure}`].n,
                    `${reseau} : marques performance.mark('ev-scan:read' et 'ev-scan:${mesure === 'attente' ? 'pending' : 'result'}') pour chacune des 10 lectures (contrat 6.1, cas 5)`).toBe(10);
            }
            const att = results[`${reseau}:marques:attente`].med;
            expect.soft(att !== null && att <= 300, `${reseau} : médiane attente − lecture ≤ 300 ms (mesurée : ${fmtMs(att)} ms)`).toBe(true);
        }
        const res = results['normal:marques:resultat'].med;
        expect.soft(res !== null && res <= 1_000, `réseau normal : médiane résultat − lecture ≤ 1 000 ms (mesurée : ${fmtMs(res)} ms)`).toBe(true);
    } finally {
        await s.close();
        restoreTerrainSetting(ev);
    }
});

// ── 5. Vibrations distinctes ───────────────────────────────────────────────

test('5. vibrations : accepté [60], refusé [120,60,120,60,120], motifs distincts, aucune vibration à la lecture', async ({ browser }, testInfo) => {
    test.setTimeout(4 * 60_000);
    const s = new Session(browser, testInfo);
    let ev: TerrainEvent | null = null;
    try {
        ev = prepareTerrainEvent('vibrations', 'client-bis', 2);
        const holder = await s.holder('fumee-client-bis');
        const ctl = await s.open('fumee-controleur', { probe: true });
        await openScanner(ctl.page, ev.title);

        const accepted = await scanAndExpect(ctl.page, await livePayload(holder, ev.tickets[0].id), 'billet valide', 'valid');
        const refusedPayload = forgedPayload(await livePayload(holder, ev.tickets[1].id));
        const { record: refused } = await presentPayload(ctl.page, refusedPayload, 'code qui ne se vérifie pas');
        expect(REFUS.has(String(refused.result)), `code falsifié : résultat de refus attendu, obtenu « ${refused.result ?? '—'} »`).toBe(true);
        await expect.poll(async () => (await probeVibrations(ctl.page)).filter((v) => v.at >= (refused.readAt as number)).length,
            { message: 'une vibration pour le refus', timeout: 5_000 }).toBeGreaterThan(0);

        const all = await probeVibrations(ctl.page);
        const acceptWindow = all.filter((v) => v.at >= (accepted.readAt as number) && v.at < refused.armedAt).map((v) => v.pattern);
        const refuseWindow = all.filter((v) => v.at >= (refused.readAt as number)).map((v) => v.pattern);
        console.log(`[e2e][terrain] vibrations reçues : accepté ${JSON.stringify(acceptWindow)}, refusé ${JSON.stringify(refuseWindow)}`);
        expect(acceptWindow, 'accepté : exactement une vibration [60] (D50 ; plus de vibration de 80 ms à la lecture)').toEqual([VIBRATION_ACCEPTE]);
        expect(refuseWindow, 'refusé : exactement une vibration [120,60,120,60,120] (D50)').toEqual([VIBRATION_REFUS]);
        expect(JSON.stringify(acceptWindow)).not.toBe(JSON.stringify(refuseWindow));
    } finally {
        await s.close();
        restoreTerrainSetting(ev);
    }
});

// ── 6. Caméra libérée en arrière-plan ──────────────────────────────────────

test('6. onglet en arrière-plan : pistes de la caméra arrêtées', async ({ browser }, testInfo) => {
    test.setTimeout(3 * 60_000);
    const s = new Session(browser, testInfo);
    let ev: TerrainEvent | null = null;
    try {
        ev = prepareTerrainEvent('camera en arriere-plan', 'client-bis', 1);
        const ctl = await s.open('fumee-controleur', { probe: true });
        await openScanner(ctl.page, ev.title);
        const live = (await probeTracks(ctl.page)).filter((t) => t.kind === 'video' && t.readyState === 'live');
        expect(live.length, 'caméra simulée en marche avant le passage en arrière-plan').toBeGreaterThan(0);

        await ctl.page.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await expect.poll(async () => (await probeTracks(ctl.page)).filter((t) => t.kind === 'video' && t.readyState !== 'ended').length, {
            message: 'pistes vidéo encore actives après visibilitychange (hidden) : la caméra doit être libérée (D48)', timeout: 10_000,
        }).toBe(0);
    } finally {
        await s.close();
        restoreTerrainSetting(ev);
    }
});
