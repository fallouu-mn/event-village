/**
 * Lot 7 (contrat, section 11.5 ; tâches 7.1 et 7.2) — projet Playwright « terrain » : billet hors ligne avec le
 * service worker et scanner du contrôleur, sur l'application démarrée (next start) et la base locale seedée.
 *
 * Données : chaque test prépare son propre événement par scripts/e2e/terrain-setup.ts (partenaire A du seed de
 * test, début à ≈ 20 h de l'heure réelle, billets gratuits émis par free_tickets_claim, contrôleur A affecté) et
 * pose `access.scan_window_before_hours = 24` (D6), remis dans un finally. Aucune route n'accepte d'heure.
 * Comptes : fumee-client (porteur des billets présentés hors ligne), fumee-client-bis (porteur des billets
 * scannés en série, lus par sa route live-code tant qu'ils sont valables ; un billet déjà composté, que cette
 * route refuse par un 409, est relu avec un code calculé par terrain-setup.ts `payload`), fumee-controleur (scanner).
 * Le QR présenté au scanner est tenu devant la caméra simulée jusqu'à l'envoi de la lecture (sonde, support/terrain.ts).
 *
 * Contextes : service worker autorisé seulement pour le client (`serviceWorkers: 'allow'`, D7) ; horloge
 * installée seulement dans le contexte du client du test 1 (jamais chez le contrôleur ni pendant une mesure :
 * marques factices sinon). Le réseau 3G est posé par CDP après le chargement et retiré avant tout setOffline.
 *
 * Les tests s'exécutent dans l'ordre du fichier (projet terrain, fullyParallel: false, --workers=1), sans mode
 * « serial » : un test rouge n'empêche pas les suivants, ni la mesure du scan (écrite avant ses assertions).
 * Les erreurs du navigateur sont imprimées et jointes au rapport, sans bloquer (aucun contrôle de ce type
 * n'est demandé par le contrat pour ce projet).
 *
 * Vague F (fix(7.7)) : marques et sélecteurs des écrans committés. Scanner (E3, fix(7.2e)) : écran « Commencer le
 * contrôle » seul (openScanner, support/terrain.ts : bouton radio de l'événement, plus de repli du lot 6),
 * `data-scan-state` = pending | slow (calque d'envoi), result (plein écran), offline (bandeau) ;
 * `data-scan-result` porté par le seul plein écran ; marques ev-scan:read, ev-scan:pending, ev-scan:result.
 * Billet hors ligne (E2, fix(7.1e)) : `data-ev-offline-state` de OfflineStatusBadge sur la carte (available,
 * missing, not_yet, offline_missing, expired), `data-ev-qr-payload` et `data-ev-qr-counter` de la page hors ligne.
 * Les assertions et les seuils sont inchangés.
 */
import type { Browser, BrowserContext, Locator, Page, TestInfo } from '@playwright/test';
import { test, expect, openRoleContext } from './support/fixtures';
import type { RoleKey } from './support/accounts';
import { CDP_NO_THROTTLING, cdpNetworkConditions, NET_3G } from './support/devices';
import { PageGuard } from './support/network';
import {
    codeOf, computedPayload, describeProbe, fmtMs, forgedPayload, installScanProbe, livePayload, median, openScanner, percentile,
    prepareTerrainEvent, presentPayload, presentPayloadNoResult, probeTracks, probeVibrations, restoreTerrainSetting, scanMarks,
    ticketScans, appendPerfFile, writePerfFile, type ProbeRecord, type TerrainEvent,
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

type Reseau = 'normal' | '3G';
interface ScanRow { reseau: Reseau; attendu: 'valid' | 'already_used'; ticket: string; record: ProbeRecord }
interface MeasuredRow extends ScanRow {
    sondeAttente: number | null;
    sondeResultat: number | null;
    /** Depuis la lecture envoyée par l'écran (dernière lecture avant le POST) : diffère si l'écran a ignoré une lecture. */
    sondeResultatEnvoyee: number | null;
    marqueAttente: number | null;
    marqueResultat: number | null;
}

/** Billets neufs par réseau (série 1), puis relectures « déjà utilisé » par réseau (série 2, D41 : autre pas). */
const SCAN_NEW_PER_NETWORK = 10;
const SCAN_USED_PER_NETWORK = 5;
const SCAN_SOURCES = [
    ['marques', 'attente', (m: MeasuredRow) => m.marqueAttente],
    ['marques', 'resultat', (m: MeasuredRow) => m.marqueResultat],
    ['sonde', 'attente', (m: MeasuredRow) => m.sondeAttente],
    ['sonde', 'resultat', (m: MeasuredRow) => m.sondeResultat],
    ['sonde-lecture-envoyee', 'resultat', (m: MeasuredRow) => m.sondeResultatEnvoyee],
] as const;
const SCAN_DETAIL_HEADER = 'reseau\tattendu\tobtenu_sonde\tbillet\tlectures\tpost\tsonde_attente_ms\tsonde_resultat_ms\tsonde_resultat_lecture_envoyee_ms\tmarque_attente_ms\tmarque_resultat_ms';

interface ScanStat { n: number; med: number | null; p95: number | null; min: number | null; max: number | null }

function scanStats(measured: MeasuredRow[]): Record<string, ScanStat> {
    const out: Record<string, ScanStat> = {};
    for (const reseau of ['normal', '3G'] as const) {
        for (const [source, mesure, pick] of SCAN_SOURCES) {
            const values = measured.filter((m) => m.reseau === reseau).map(pick).filter((v): v is number => v !== null);
            out[`${reseau}:${source}:${mesure}`] = {
                n: values.length, med: median(values), p95: percentile(values, 95),
                min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null,
            };
        }
    }
    return out;
}

/** scan.tsv réécrit après chaque lecture : un échec plus loin garde les mesures déjà prises. */
function writeScanSummary(measured: MeasuredRow[]): string {
    const st = scanStats(measured);
    const lines = ['reseau\tsource\tmesure\tn\tmediane_ms\tp95_ms\tmin_ms\tmax_ms'];
    for (const reseau of ['normal', '3G'] as const) {
        for (const [source, mesure] of SCAN_SOURCES) {
            const v = st[`${reseau}:${source}:${mesure}`];
            lines.push([reseau, source, mesure, v.n, fmtMs(v.med), fmtMs(v.p95), fmtMs(v.min), fmtMs(v.max)].join('\t'));
        }
    }
    return writePerfFile('scan.tsv', lines.join('\n'));
}

/**
 * Mesure d'une lecture, prise juste après son résultat : marques de l'application posées depuis la présentation
 * (aucune lecture suivante n'est encore présentée) et sonde ; ligne ajoutée à scan-lectures.tsv, scan.tsv réécrit.
 */
async function measureRow(page: Page, row: ScanRow, measured: MeasuredRow[]): Promise<MeasuredRow> {
    const lo = row.record.armedAt;
    const since = async () => (await scanMarks(page)).filter((m) => m.startTime >= lo).sort((a, b) => a.startTime - b.startTime);
    let marks = await since();
    // Marque de résultat posée après l'affichage relevé par la sonde : relue pendant 1 s au plus (aucune attente sans marque de lecture)
    for (let i = 0; i < 5; i++) {
        const r = marks.find((m) => m.name === 'ev-scan:read');
        if (!r || marks.some((m) => m.name === 'ev-scan:result' && m.startTime >= r.startTime)) break;
        await page.waitForTimeout(200);
        marks = await since();
    }
    const read = marks.find((m) => m.name === 'ev-scan:read') ?? null;
    const pending = read ? marks.find((m) => m.name === 'ev-scan:pending' && m.startTime >= read.startTime) ?? null : null;
    const result = read ? marks.find((m) => m.name === 'ev-scan:result' && m.startTime >= read.startTime) ?? null : null;
    const p = row.record;
    const m: MeasuredRow = {
        ...row,
        sondeAttente: p.readAt !== null && p.pendingAt !== null ? p.pendingAt - p.readAt : null,
        sondeResultat: p.readAt !== null && p.resultAt !== null ? p.resultAt - p.readAt : null,
        sondeResultatEnvoyee: p.lastReadAt !== null && p.resultAt !== null ? p.resultAt - p.lastReadAt : null,
        marqueAttente: read && pending ? pending.startTime - read.startTime : null,
        marqueResultat: read && result ? result.startTime - read.startTime : null,
    };
    measured.push(m);
    appendPerfFile('scan-lectures.tsv', SCAN_DETAIL_HEADER, [[m.reseau, m.attendu, m.record.result ?? '', m.ticket, m.record.reads, m.record.postAt !== null ? 'oui' : 'non',
        fmtMs(m.sondeAttente), fmtMs(m.sondeResultat), fmtMs(m.sondeResultatEnvoyee), fmtMs(m.marqueAttente), fmtMs(m.marqueResultat)].join('\t')]);
    writeScanSummary(measured);
    console.log(`[SCAN-MESURE] ${m.reseau} ${m.attendu} ${m.ticket} : obtenu « ${m.record.result ?? '—'} », lectures ${m.record.reads}, `
        + `sonde résultat − lecture ${fmtMs(m.sondeResultat)} ms, marques attente ${fmtMs(m.marqueAttente)} ms / résultat ${fmtMs(m.marqueResultat)} ms`);
    return m;
}

/**
 * QR du pas courant d'un billet DÉJÀ COMPOSTÉ, d'un autre pas que `used` (anti-doublon D41). La route live-code
 * du porteur refuse un billet UTILISE (409, run 72) : le code est calculé par terrain-setup.ts `payload`
 * (lib/security/totp.ts, secret de la base locale), qui attend réellement le pas suivant si besoin (20 s au plus).
 */
function freshPayload(ticketId: string, used: string): string {
    const out = computedPayload(ticketId, codeOf(used));
    if (out.payload === used) throw new Error(`payload calculé du billet ${ticketId} identique à la lecture précédente`);
    if (out.status !== 'UTILISE') console.log(`[e2e][terrain] billet ${ticketId} au statut ${out.status} avant sa relecture (UTILISE attendu)`);
    return out.payload;
}

test('4. mesure du scan : billets neufs en réseau normal puis en 3G, relectures « déjà utilisé », puis une lecture hors ligne', async ({ browser }, testInfo) => {
    test.setTimeout(15 * 60_000);
    const s = new Session(browser, testInfo);
    let ev: TerrainEvent | null = null;
    try {
        ev = prepareTerrainEvent('mesure du scan', 'client-bis', 2 * SCAN_NEW_PER_NETWORK);
        const holder = await s.holder('fumee-client-bis');
        const ctl = await s.open('fumee-controleur', { probe: true });
        await openScanner(ctl.page, ev.title);
        writePerfFile('scan-lectures.tsv', SCAN_DETAIL_HEADER); // en-tête seul : les lignes sont ajoutées au fil des lectures
        const fileSummary = writeScanSummary([]);
        console.log(`[SCAN-MESURE] réseau 3G (D83) : latence ${NET_3G.latency} ms, ${NET_3G.downloadThroughput * 8 / 1000} kbit/s descendant, `
            + `${NET_3G.uploadThroughput * 8 / 1000} kbit/s montant ; tableaux tenus à jour lecture par lecture dans ${fileSummary} et scan-lectures.tsv`);

        // Bridage par CDP après le chargement (D83) ; jamais combiné à setOffline
        const cdp = await ctl.context.newCDPSession(ctl.page);
        await cdp.send('Network.enable');
        const setNetwork = async (reseau: Reseau): Promise<void> => {
            await cdp.send('Network.emulateNetworkConditions', reseau === '3G' ? cdpNetworkConditions(NET_3G) : CDP_NO_THROTTLING);
        };
        const measured: MeasuredRow[] = [];
        const series: Record<Reseau, typeof ev.tickets> = {
            normal: ev.tickets.slice(0, SCAN_NEW_PER_NETWORK),
            '3G': ev.tickets.slice(SCAN_NEW_PER_NETWORK, 2 * SCAN_NEW_PER_NETWORK),
        };
        const used = new Map<string, string>();

        // Série 1 : billets neufs, réseau normal puis 3G (mesures écrites avant toute relecture)
        for (const reseau of ['normal', '3G'] as const) {
            await setNetwork(reseau);
            for (const t of series[reseau]) {
                const payload = await livePayload(holder, t.id);
                used.set(t.id, payload);
                const { record } = await presentPayload(ctl.page, payload, `${reseau} : billet neuf ${t.number}`);
                await measureRow(ctl.page, { reseau, attendu: 'valid', ticket: t.number, record }, measured);
            }
        }
        // Série 2 : relectures « déjà utilisé », exigées (un POST et l'affichage already_used), réseau normal puis 3G
        for (const reseau of ['normal', '3G'] as const) {
            await setNetwork(reseau);
            for (const t of series[reseau].slice(0, SCAN_USED_PER_NETWORK)) {
                const payload = freshPayload(t.id, used.get(t.id) as string);
                const { index, record } = await presentPayload(ctl.page, payload, `${reseau} : billet déjà utilisé ${t.number}`);
                const m = await measureRow(ctl.page, { reseau, attendu: 'already_used', ticket: t.number, record }, measured);
                expect.soft(m.record.postAt, `${reseau} : relecture du billet déjà utilisé ${t.number} envoyée au serveur (POST) — ${await describeProbe(ctl.page, index)}`).not.toBeNull();
            }
        }
        await setNetwork('normal');
        await cdp.detach();

        const results = scanStats(measured);
        const ignored = measured.filter((m) => m.record.reads > 1);
        console.log(`[SCAN-MESURE] lectures ignorées par l'écran (QR relu au moins une fois avant l'envoi) : ${ignored.length} sur ${measured.length}`
            + `${ignored.length ? ` (${ignored.map((m) => `${m.reseau} ${m.ticket} : ${m.record.reads} lectures`).join(', ')})` : ''}`);
        for (const [key, st] of Object.entries(results)) {
            console.log(`[SCAN-MESURE] ${key} : n=${st.n} médiane=${fmtMs(st.med)} ms p95=${fmtMs(st.p95)} ms (min ${fmtMs(st.min)}, max ${fmtMs(st.max)})`);
        }
        await testInfo.attach('scan.tsv', { path: fileSummary, contentType: 'text/tab-separated-values' });
        const probe3g = results['3G:sonde:resultat'];
        if (probe3g.med !== null && probe3g.med < NET_3G.latency) {
            console.log(`[SCAN-MESURE] AVERTISSEMENT : médiane 3G résultat − lecture (sonde) ${fmtMs(probe3g.med)} ms < latence simulée ${NET_3G.latency} ms : bridage CDP peut-être non appliqué`);
        }
        for (const key of ['normal:marques:attente', 'normal:marques:resultat', '3G:marques:attente', '3G:marques:resultat']) {
            console.log(`[SCAN-MESURE] AVERTISSEMENT (non bloquant) ${key} p95=${fmtMs(results[key].p95)} ms`);
        }

        // Hors ligne : une lecture → état « Hors ligne », aucune vibration (D47)
        await ctl.context.setOffline(true);
        ctl.guard.freeze();
        // Billet 1 composté : code calculé (la route live-code le refuse) ; aucun envoi attendu hors ligne
        const offline = await presentPayloadNoResult(ctl.page, computedPayload(ev.tickets[0].id).payload, 'lecture hors ligne');
        await expect.soft(ctl.page.locator('[data-scan-state="offline"]').first(), 'lecture hors ligne : état data-scan-state="offline"').toBeAttached({ timeout: 10_000 });
        const offlineVibrations = (await probeVibrations(ctl.page)).filter((v) => offline.record.readAt !== null && v.at >= offline.record.readAt);
        expect.soft(offlineVibrations.map((v) => v.pattern), 'aucune vibration pour un incident technique (hors ligne)').toEqual([]);
        await ctl.context.setOffline(false);

        // Assertions (après l'écriture des mesures, pour que le run « avant » les produise)
        for (const m of measured) {
            expect.soft(m.record.result, `${m.reseau} billet ${m.ticket} : résultat affiché`).toBe(m.attendu);
        }
        for (const reseau of ['normal', '3G'] as const) {
            const expected = measured.filter((m) => m.reseau === reseau).length;
            for (const mesure of ['attente', 'resultat'] as const) {
                expect.soft(results[`${reseau}:marques:${mesure}`].n,
                    `${reseau} : marques performance.mark('ev-scan:read' et 'ev-scan:${mesure === 'attente' ? 'pending' : 'result'}') pour chacune des ${expected} lectures (contrat 6.1, cas 5)`).toBe(expected);
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
        await expect.poll(async () => (await probeVibrations(ctl.page)).filter((v) => v.at >= (accepted.readAt as number)).length,
            { message: 'au moins une vibration pour l’entrée acceptée', timeout: 5_000 }).toBeGreaterThan(0);
        await ctl.page.waitForTimeout(300); // une vibration posée par un effet après l'affichage est aussi relevée
        // Fenêtre de l'accepté relevée AVANT de présenter le code falsifié (de sa première lecture à maintenant) :
        // l'assertion D50 de l'accepté est jugée même si la lecture suivante échoue
        const acceptWindow = (await probeVibrations(ctl.page)).filter((v) => v.at >= (accepted.readAt as number)).map((v) => v.pattern);
        console.log(`[e2e][terrain] vibrations reçues pour l'accepté (lectures : ${accepted.reads}) : ${JSON.stringify(acceptWindow)}`);
        expect.soft(acceptWindow, 'accepté : exactement une vibration [60] (D50 ; plus de vibration de 80 ms à la lecture)').toEqual([VIBRATION_ACCEPTE]);

        const refusedPayload = forgedPayload(await livePayload(holder, ev.tickets[1].id));
        const { index: refusedIndex, record: refused } = await presentPayload(ctl.page, refusedPayload, 'code qui ne se vérifie pas');
        expect(REFUS.has(String(refused.result)), `code falsifié : résultat de refus attendu, obtenu « ${refused.result ?? '—'} » — ${await describeProbe(ctl.page, refusedIndex)}`).toBe(true);
        await expect.poll(async () => (await probeVibrations(ctl.page)).filter((v) => v.at >= (refused.readAt as number)).length,
            { message: 'une vibration pour le refus', timeout: 5_000 }).toBeGreaterThan(0);

        const refuseWindow = (await probeVibrations(ctl.page)).filter((v) => v.at >= (refused.readAt as number)).map((v) => v.pattern);
        console.log(`[e2e][terrain] vibrations reçues pour le refus (lectures : ${refused.reads}) : ${JSON.stringify(refuseWindow)}`);
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
