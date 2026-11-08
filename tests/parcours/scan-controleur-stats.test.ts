/**
 * Lot 7, tâche 7.2 (serveur) — statistiques, historique, saisie manuelle, caisse et guichet servis par le
 * serveur au contrôleur (contrat, sections 3.3, 6.1 et M5 ; décisions D42, D43, D46, D53 ; règle du lot 5
 * « le serveur est la seule source des chiffres »).
 *  - GET /api/controller/scans?event_id= (RPC controller_scan_stats) : porte nommée → entrées acceptées de
 *    l'événement à la même porte (tous les contrôleurs de cette porte), libellé « Porte <x> » ; sans porte →
 *    les entrées du contrôleur, libellé « Vos entrées » ; refus du contrôleur ventilés par résultat (avec
 *    libellé) ; `recent` : 20 au plus, le plus récent d'abord, sans nom de porteur ; non affecté → 404 ;
 *  - GET /api/controller/assignments : `entry_point`, `counter_sale_enabled` (réglage access.counter_sale_enabled),
 *    « Arrivées » (stats.scanned_today) = total de l'événement, plus coupé à minuit UTC (entrée de la veille à
 *    23 h 50 comptée) ;
 *  - POST /api/controller/scan/lookup (RPC ticket_manual_lookup) : numéro de l'événement → found, titulaire,
 *    catégorie, statut lisible, `preview` = résultat qu'aurait le scan, sans compostage ni ligne ticket_scans,
 *    une ligne audit_logs MANUAL_LOOKUP (numéro haché) ; numéro d'un autre événement → found:false ; quota
 *    SCAN_LOOKUP_PER_SCANNER_MIN → 429 ; périmètre access.manual_entry_scope respecté (403 SCAN_FORBIDDEN) ;
 *  - GET /api/controller/shifts/active : `expected_cash_in_drawer` = fonds + encaissé, calculé par le serveur ;
 *  - GET /api/controller/counter-sale?event_id= : `{ enabled, can_accept_cash, open_shift, categories }` ;
 *    POST /api/controller/counter-sale/quote (RPC counter_sale_quote) : total et lignes du serveur, sans
 *    écriture ; catégorie non vendable → 400 INVALID_ITEMS ; guichet désactivé → enabled:false.
 * Rouge avant correctif (fix(7.2s)) : les routes app/api/controller/scans, scan/lookup et counter-sale/quote
 * n'existent pas ; counter-sale n'exporte pas GET ; assignments ne renvoie ni entry_point ni
 * counter_sale_enabled et compte les arrivées depuis minuit UTC (app/api/controller/assignments/route.ts:45,63) ;
 * shifts/active ne renvoie pas le total attendu (calculé dans le navigateur, ScannerShiftBanner.tsx:28-29).
 * Interprétations (contrat muet, à reprendre au rapport) :
 *  - « Porte <x> » : la suite nomme les portes « A » et « B » et attend door_label = « Porte A » ;
 *  - total attendu de la caisse : champ `expected_cash_in_drawer` à la racine de la réponse ou dans `shift` ;
 *  - lookup hors périmètre (scope ASSIGNED_CONTROLLER, partenaire propriétaire) : 403 SCAN_FORBIDDEN, seul refus
 *    de droit du contrat 3.3, sans aucune donnée du billet ;
 *  - corps de la route quote : `{ eventId, items: [{ categoryId, quantity }] }` (forme de POST counter-sale) ;
 *  - catégories du guichet : seules les catégories vendables (actives) sont listées.
 * La suite crée son partenaire, ses événements (dans la fenêtre de scan), ses contrôleurs et ses billets.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { resetServerEnvCache } from '../../lib/env';
import { scanReasonLabel } from '../../lib/scan/scan-result';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import {
    authed, createTimedEvent, newController, openShift, scan, scansOf, ticketPayload, ticketRow,
    withAccessSettings, type RouteResult,
} from './acces-helpers';
import { routeHandler } from './pilotage-helpers';
import { alignQuotaWindow, assertSameQuotaWindow, assertTerrainInvariants, getPlatformSetting, issueFreeTicket } from './terrain-helpers';

const FREE = 'Entrée';
const STANDARD = 'Standard';
const RARE = 'Rare';
const INACTIVE = 'Inactive';
const PRICE = 5000;
const RARE_PRICE = 4000;
const HOLDER_FIRST = 'Khadija';
const HOLDER_LAST = 'Sansnomaffiche';

let partner: TestPartner;
let ev: SaleEvent;
let otherEv: SaleEvent;
let holder: Buyer;

before(async () => {
    partner = await newPartner('scan-stats');
    ev = await createTimedEvent(partner.partnerId, 'scan-stats', [
        { name: FREE, price: 0, total: 120 },
        { name: STANDARD, price: PRICE, total: 20 },
        { name: RARE, price: RARE_PRICE, total: 3 },
        { name: INACTIVE, price: 2000, total: 10, isActive: false },
    ], { startsInHours: 1, durationHours: 6 });
    otherEv = await createTimedEvent(partner.partnerId, 'scan-stats-autre', [{ name: FREE, price: 0, total: 20 }], { startsInHours: 1, durationHours: 6 });
    holder = await newBuyer('stats-porteur', { firstName: HOLDER_FIRST, lastName: HOLDER_LAST });
});

after(async () => {
    await assertTerrainInvariants('scan-controleur-stats');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

interface RouteReply extends RouteResult { headers: Record<string, string> }

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 1200)}`;
}

async function invoke(handler: Handler, req: NextRequest): Promise<RouteReply> {
    const res = await handler(req);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text.slice(0, 2000) }; // corps non JSON conservé tel quel pour l'assertion
    }
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    return { status: res.status, body, headers };
}

async function withEnv<T>(overrides: Record<string, string>, fn: () => Promise<T>): Promise<T> {
    const saved = new Map<string, string | undefined>();
    for (const [k, v] of Object.entries(overrides)) {
        saved.set(k, process.env[k]);
        process.env[k] = v;
    }
    resetServerEnvCache();
    try {
        return await fn();
    } finally {
        saved.forEach((v, k) => {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        });
        resetServerEnvCache();
    }
}

async function getScans(user: Buyer, eventId: string): Promise<RouteReply> {
    const GET = await routeHandler('../../app/api/controller/scans/route', 'GET', 'GET /api/controller/scans (contrat 3.3, fix(7.2s))');
    return invoke(GET, authed(`/api/controller/scans?event_id=${eventId}`, 'GET', user));
}

async function getAssignments(user: Buyer): Promise<RouteReply> {
    const GET = await routeHandler('../../app/api/controller/assignments/route', 'GET', 'GET /api/controller/assignments');
    return invoke(GET, authed('/api/controller/assignments', 'GET', user));
}

async function lookup(user: Buyer, eventId: string, ticketNumber: string): Promise<RouteReply> {
    const POST = await routeHandler('../../app/api/controller/scan/lookup/route', 'POST', 'POST /api/controller/scan/lookup (contrat 3.3, D43, fix(7.2s))');
    return invoke(POST, authed('/api/controller/scan/lookup', 'POST', user, { eventId, manualTicketNumber: ticketNumber }));
}

async function activeShift(user: Buyer, eventId: string): Promise<RouteReply> {
    const GET = await routeHandler('../../app/api/controller/shifts/active/route', 'GET', 'GET /api/controller/shifts/active');
    return invoke(GET, authed(`/api/controller/shifts/active?event_id=${eventId}`, 'GET', user));
}

async function counterSaleInfo(user: Buyer, eventId: string): Promise<RouteReply> {
    const GET = await routeHandler('../../app/api/controller/counter-sale/route', 'GET', 'GET /api/controller/counter-sale (contrat 3.3, D53, fix(7.2s))');
    return invoke(GET, authed(`/api/controller/counter-sale?event_id=${eventId}`, 'GET', user));
}

async function counterSaleQuote(user: Buyer, body: Row): Promise<RouteReply> {
    const POST = await routeHandler('../../app/api/controller/counter-sale/quote/route', 'POST', 'POST /api/controller/counter-sale/quote (contrat 3.3, D53, fix(7.2s))');
    return invoke(POST, authed('/api/controller/counter-sale/quote', 'POST', user, body, { 'idempotency-key': randomUUID() }));
}

/** Vente au guichet (POST /api/controller/counter-sale, contrat C7) : billets réglés en espèces, crédités à la caisse. */
async function counterSale(user: Buyer, eventId: string, items: Array<{ categoryId: string; quantity: number }>): Promise<RouteReply> {
    const POST = await routeHandler('../../app/api/controller/counter-sale/route', 'POST', 'POST /api/controller/counter-sale (contrat C7)');
    return invoke(POST, authed('/api/controller/counter-sale', 'POST', user, { eventId, items }, { 'idempotency-key': randomUUID() }));
}

async function setEntryPoint(eventId: string, userId: string, entryPoint: string): Promise<void> {
    const { error } = await service.from('event_controllers').update({ entry_point: entryPoint }).eq('event_id', eventId).eq('user_id', userId);
    assert.equal(error, null, `point d’entrée ${entryPoint} : ${error?.message}`);
}

async function freeTicket(eventId = ev.eventId): Promise<string> {
    const cat = eventId === ev.eventId ? ev.categories[FREE].id : otherEv.categories[FREE].id;
    return issueFreeTicket(eventId, cat, holder);
}

/** Scan caméra avec le code courant (ou le code d'un instant passé, refusé qr_expired) ; résultat attendu. */
async function scanExpect(user: Buyer, ticketId: string, expected: string, label: string, at?: Date): Promise<string> {
    const res = await scan(user, { eventId: ev.eventId, payload: await ticketPayload(ticketId, at) });
    assert.equal(res.status, 200, `${label} : ${show(res)}`);
    assert.equal(res.body.result, expected, `${label} : ${expected} attendu, ${show(res)}`);
    return String(res.body.scan_id);
}

async function scanUnknown(user: Buyer, label: string): Promise<string> {
    const res = await scan(user, { eventId: ev.eventId, payload: `EVT1:${randomUUID()}:000000` });
    assert.equal(res.body.result, 'invalid', `${label} : billet introuvable → invalid, ${show(res)}`);
    return String(res.body.scan_id);
}

function num(body: Row, key: string, what: string): number {
    const v = body[key];
    assert.ok(typeof v === 'number' || (typeof v === 'string' && v !== '' && Number.isFinite(Number(v))), `${what} : champ ${key} numérique attendu, reçu ${JSON.stringify(v)}`);
    return Number(v);
}

function list(body: Row, key: string, what: string): Row[] {
    const v = body[key];
    assert.ok(Array.isArray(v), `${what} : liste ${key} attendue, reçu ${JSON.stringify(v)?.slice(0, 300)}`);
    return v as Row[];
}

function refusalsMap(body: Row, what: string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of list(body, 'refusals_by_result', what)) {
        assert.equal(typeof r.result, 'string', `${what} : refusals_by_result.result`);
        assert.equal(r.label, scanReasonLabel(r.result), `${what} : libellé du motif ${String(r.result)} (scanReasonLabel), reçu ${JSON.stringify(r.label)}`);
        out[String(r.result)] = Number(r.count);
    }
    return out;
}

async function auditOf(userId: string): Promise<Row[]> {
    const { data, error } = await service.from('audit_logs').select('*').eq('user_id', userId).eq('action', 'MANUAL_LOOKUP').order('created_at');
    assert.equal(error, null, `audit_logs : ${error?.message}`);
    return (data ?? []) as Row[];
}

// ── Compteur de porte et historique ────────────────────────────────────────

describe('7.2 — GET /api/controller/scans : porte, compteurs, refus ventilés, historique (D42)', () => {
    let cA1: Buyer;
    let cA2: Buyer;
    let cB: Buyer;
    let cN: Buyer;
    const a1Scans: string[] = [];
    let nInvalid = '';

    before(async () => {
        cA1 = await newController(partner, ev.eventId, { label: 'porte-a1' });
        cA2 = await newController(partner, ev.eventId, { label: 'porte-a2' });
        cB = await newController(partner, ev.eventId, { label: 'porte-b' });
        cN = await newController(partner, ev.eventId, { label: 'sans-porte' });
        // Points d'entrée posés AVANT les scans : ticket_scans.entry_point est figé à l'insertion (ticket_scans_enrich)
        await setEntryPoint(ev.eventId, cA1.userId, 'A');
        await setEntryPoint(ev.eventId, cA2.userId, 'A');
        await setEntryPoint(ev.eventId, cB.userId, 'B');

        const t1 = await freeTicket();
        const t2 = await freeTicket();
        const t3 = await freeTicket();
        a1Scans.push(await scanExpect(cA1, t1, 'valid', 'A1, billet 1'));
        a1Scans.push(await scanExpect(cA1, t2, 'valid', 'A1, billet 2'));
        a1Scans.push(await scanExpect(cA1, t1, 'already_used', 'A1, billet 1 relu'));
        a1Scans.push(await scanExpect(cA1, t3, 'qr_expired', 'A1, billet 3 avec un code de 10 minutes', new Date(Date.now() - 10 * 60_000)));
        await scanExpect(cA2, t3, 'valid', 'A2, billet 3');
        await scanExpect(cB, await freeTicket(), 'valid', 'B, billet 4');
        await scanExpect(cN, await freeTicket(), 'valid', 'sans porte, billet 5');
        nInvalid = await scanUnknown(cN, 'sans porte, billet inconnu');
    });

    test('porte nommée : door_entries = entrées acceptées de la porte A (2 contrôleurs), my_entries, my_refusals, refus ventilés, « Porte A »', async () => {
        const r = await getScans(cA1, ev.eventId);
        assert.equal(r.status, 200, `contrôleur affecté à la porte A : ${show(r)}`);
        assert.equal(r.body.entry_point, 'A', `entry_point de l’affectation : ${show(r)}`);
        assert.equal(r.body.door_label, 'Porte A', `door_label « Porte <x> » : ${show(r)}`);
        assert.equal(num(r.body, 'door_entries', 'porte A'), 3, `door_entries = 2 entrées de A1 + 1 de A2, la porte B et le contrôleur sans porte exclus : ${show(r)}`);
        assert.equal(num(r.body, 'my_entries', 'porte A'), 2, `my_entries = entrées acceptées par A1 : ${show(r)}`);
        assert.equal(num(r.body, 'my_refusals', 'porte A'), 2, `my_refusals = already_used + qr_expired de A1 : ${show(r)}`);
        assert.deepEqual(refusalsMap(r.body, 'porte A'), { already_used: 1, qr_expired: 1 }, `refus ventilés de A1 : ${show(r)}`);
        assert.ok(typeof r.body.server_time === 'string' && !Number.isNaN(Date.parse(String(r.body.server_time))), `server_time ISO : ${show(r)}`);
    });

    test('recent : scans du contrôleur seulement, le plus récent d’abord, avec résultat, libellé, méthode, numéro et catégorie, sans nom de porteur', async () => {
        const r = await getScans(cA1, ev.eventId);
        assert.equal(r.status, 200, show(r));
        const recent = list(r.body, 'recent', 'historique de A1');
        assert.deepEqual(recent.map((x) => x.scan_id), a1Scans.slice().reverse(), `les 4 scans de A1, du plus récent au plus ancien : ${JSON.stringify(recent).slice(0, 800)}`);
        const rows = await Promise.all(recent.map(async (x) => (await service.from('ticket_scans').select('result, ticket_id, created_at').eq('id', String(x.scan_id)).single()).data as Row));
        recent.forEach((x, i) => {
            assert.equal(x.result, rows[i].result, `recent[${i}].result = ticket_scans.result`);
            assert.equal(x.label, scanReasonLabel(x.result), `recent[${i}].label`);
            assert.equal(x.method, 'QR', `recent[${i}].method`);
            assert.equal(x.category, FREE, `recent[${i}].category`);
            assert.ok(typeof x.ticket_number === 'string' && /^TCK-/.test(x.ticket_number), `recent[${i}].ticket_number : ${JSON.stringify(x)}`);
            assert.ok(!Number.isNaN(Date.parse(String(x.at))), `recent[${i}].at ISO : ${JSON.stringify(x)}`);
            if (i > 0) assert.ok(Date.parse(String(recent[i - 1].at)) >= Date.parse(String(x.at)), 'ordre : le plus récent d’abord');
        });
        const text = JSON.stringify(r.body);
        assert.ok(!text.includes(HOLDER_FIRST) && !text.includes(HOLDER_LAST), `aucun nom de porteur dans la réponse : ${text.slice(0, 600)}`);
    });

    test('sans point d’entrée : « Vos entrées », door_entries = entrées du contrôleur seul ; billet inconnu compté comme refus', async () => {
        const r = await getScans(cN, ev.eventId);
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.entry_point ?? null, null, `pas de point d’entrée : ${show(r)}`);
        assert.equal(r.body.door_label, 'Vos entrées', `door_label sans porte : ${show(r)}`);
        assert.equal(num(r.body, 'door_entries', 'sans porte'), 1, `door_entries = entrées de ce contrôleur seul : ${show(r)}`);
        assert.equal(num(r.body, 'my_entries', 'sans porte'), 1, show(r));
        assert.equal(num(r.body, 'my_refusals', 'sans porte'), 1, show(r));
        assert.deepEqual(refusalsMap(r.body, 'sans porte'), { invalid: 1 }, show(r));
        const recent = list(r.body, 'recent', 'historique sans porte');
        assert.equal(recent[0]?.scan_id, nInvalid, 'le refus le plus récent en tête');
    });

    test('recent : 20 lignes au plus (22 scans du contrôleur), les 20 plus récentes', async () => {
        const many = await newController(partner, ev.eventId, { label: 'historique-22' });
        const ids: string[] = [];
        for (let i = 0; i < 22; i++) {
            const res = await scan(many, { eventId: ev.eventId, payload: `TCK-HISTORIQUE-${i}` });
            assert.equal(res.body.result, 'dynamic_qr_required', `scan ${i + 1} : ${show(res)}`);
            ids.push(String(res.body.scan_id));
        }
        const r = await getScans(many, ev.eventId);
        assert.equal(r.status, 200, show(r));
        const recent = list(r.body, 'recent', 'historique de 22 scans');
        assert.equal(recent.length, 20, `20 lignes au plus : ${recent.length}`);
        assert.deepEqual(recent.map((x) => x.scan_id), ids.slice(-20).reverse(), 'les 20 plus récentes, du plus récent au plus ancien');
        assert.equal(num(r.body, 'my_refusals', 'historique'), 22, 'tous les refus comptés (la limite ne touche que la liste)');
    });

    test('contrôleur non affecté à l’événement (ou affecté à un autre) → 404 sans donnée', async () => {
        const unassigned = await newController(partner, null, { label: 'non-affecte' });
        const elsewhere = await newController(partner, otherEv.eventId, { label: 'autre-evenement' });
        for (const [label, u] of [['sans affectation', unassigned], ['affecté à un autre événement', elsewhere]] as Array<[string, Buyer]>) {
            const r = await getScans(u, ev.eventId);
            assert.equal(r.status, 404, `${label} : 404 attendu, ${show(r)}`);
            assert.equal(r.body.door_entries, undefined, `${label} : aucun compteur, ${show(r)}`);
            assert.equal(r.body.recent, undefined, `${label} : aucun historique, ${show(r)}`);
        }
    });
});

// ── Affectations ───────────────────────────────────────────────────────────

describe('7.2 — GET /api/controller/assignments : porte, guichet, « Arrivées » sans coupure à minuit (D42, D53)', () => {
    test('entry_point et counter_sale_enabled de l’affectation ; entrée de la veille à 23 h 50 comptée dans les arrivées', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'affectations' });
        await setEntryPoint(ev.eventId, ctrl.userId, 'Nord');
        const late = await freeTicket();
        await scanExpect(ctrl, late, 'valid', 'billet composté « la veille »');
        const now = new Date();
        const eve = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 23, 50, 0));
        const { error } = await service.from('tickets').update({ checked_in_at: eve.toISOString() }).eq('id', late);
        assert.equal(error, null, `entrée datée de la veille 23 h 50 : ${error?.message}`);
        await scanExpect(ctrl, await freeTicket(), 'valid', 'billet composté aujourd’hui');
        const { count, error: cErr } = await service.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', ev.eventId).eq('status', 'UTILISE');
        assert.equal(cErr, null, `billets UTILISE : ${cErr?.message}`);

        for (const enabled of [false, true]) {
            await withAccessSettings({ 'access.counter_sale_enabled': enabled }, async () => {
                assert.equal(await getPlatformSetting('access.counter_sale_enabled'), enabled, 'réglage posé');
                const r = await getAssignments(ctrl);
                assert.equal(r.status, 200, show(r));
                const a = list(r.body, 'assignments', 'affectations').find((x) => (x.events as Row | null)?.id === ev.eventId);
                assert.ok(a, `affectation de l’événement : ${show(r)}`);
                assert.equal(a.entry_point, 'Nord', `entry_point de l’affectation : ${JSON.stringify(a)}`);
                assert.equal(a.counter_sale_enabled, enabled, `counter_sale_enabled = access.counter_sale_enabled (${enabled}) : ${JSON.stringify(a)}`);
                const stats = a.stats as Row | undefined;
                assert.ok(stats, `stats de l’affectation : ${JSON.stringify(a)}`);
                assert.equal(Number(stats.scanned_today), count, `« Arrivées » = total des entrées de l’événement (${count}), entrée de la veille à 23 h 50 comprise : ${JSON.stringify(stats)}`);
            });
        }
    });
});

// ── Saisie manuelle : vérification avant validation ────────────────────────

describe('7.2 — POST /api/controller/scan/lookup : vérification sans compostage (D43)', () => {
    test('numéro de l’événement → found, titulaire, catégorie, statut lisible, preview valid ; aucune ligne ticket_scans, billet VALIDE, une ligne audit_logs MANUAL_LOOKUP sans numéro en clair', async () => {
        await withAccessSettings({ 'access.manual_entry_scope': 'ASSIGNED_CONTROLLER' }, async () => {
            const ctrl = await newController(partner, ev.eventId, { label: 'lookup' });
            const ticketId = await freeTicket();
            const number = String((await ticketRow(ticketId)).ticket_number);
            const r = await lookup(ctrl, ev.eventId, number);
            assert.equal(r.status, 200, `lookup : ${show(r)}`);
            assert.equal(r.body.found, true, `numéro de l’événement : found = true, ${show(r)}`);
            const t = r.body.ticket as Row;
            assert.ok(t && typeof t === 'object', `objet ticket : ${show(r)}`);
            assert.equal(t.ticket_number, number, 'numéro');
            assert.equal(t.holder, `${HOLDER_FIRST} ${HOLDER_LAST}`, `titulaire enregistré : ${show(r)}`);
            assert.equal(t.category, FREE, 'catégorie');
            assert.equal(t.preview, 'valid', `preview = résultat qu’aurait le scan : ${show(r)}`);
            assert.ok(typeof t.status_label === 'string' && t.status_label.trim() !== '' && !/^[A-Z_]+$/.test(t.status_label), `statut lisible, jamais l’enum brut : ${JSON.stringify(t.status_label)}`);

            assert.deepEqual(await scansOf(ticketId), [], 'vérification : aucune ligne ticket_scans');
            assert.equal((await ticketRow(ticketId)).status, 'VALIDE', 'vérification : billet non composté');
            const audit = await auditOf(ctrl.userId);
            assert.equal(audit.length, 1, `une ligne audit_logs MANUAL_LOOKUP (trouvé ${audit.length})`);
            assert.equal(audit[0].object_type, 'tickets', 'audit : object_type');
            assert.equal(audit[0].object_id, ticketId, 'audit : object_id = billet');
            const meta = (audit[0].metadata ?? {}) as Row;
            assert.equal(meta.event_id, ev.eventId, 'audit : metadata.event_id');
            assert.equal(meta.found, true, 'audit : metadata.found');
            assert.equal(typeof meta.ticket_number_hash, 'string', 'audit : numéro haché');
            assert.ok(!JSON.stringify(audit[0]).includes(number), 'audit : jamais le numéro de billet en clair');

            // Billet déjà composté : la prévisualisation dit already_used, sans nouvelle ligne
            await scanExpect(ctrl, ticketId, 'valid', 'validation après vérification');
            const used = await lookup(ctrl, ev.eventId, number);
            assert.equal((used.body.ticket as Row | undefined)?.preview, 'already_used', `billet composté : preview already_used, ${show(used)}`);
            assert.equal((await scansOf(ticketId)).length, 1, 'seconde vérification : aucune ligne ticket_scans de plus');

            // Numéro d'un autre événement : rien n'est révélé
            const foreign = String((await ticketRow(await freeTicket(otherEv.eventId))).ticket_number);
            const other = await lookup(ctrl, ev.eventId, foreign);
            assert.equal(other.status, 200, show(other));
            assert.equal(other.body.found, false, `numéro d’un autre événement : found = false, ${show(other)}`);
            assert.equal(other.body.ticket, undefined, `numéro d’un autre événement : aucune donnée, ${show(other)}`);
            const audit2 = await auditOf(ctrl.userId);
            assert.equal(audit2.length, 3, `chaque vérification journalisée (trouvé ${audit2.length})`);
            assert.equal((audit2[2].metadata as Row).found, false, 'audit : found = false pour le numéro étranger');
        });
    });

    test('quota SCAN_LOOKUP_PER_SCANNER_MIN : au-delà → 429 avec Retry-After, sans journal ni lecture', async () => {
        await withEnv({ SCAN_LOOKUP_PER_SCANNER_MIN: '2' }, async () => {
            const ctrl = await newController(partner, ev.eventId, { label: 'lookup-quota' });
            const number = String((await ticketRow(await freeTicket())).ticket_number);
            await routeHandler('../../app/api/controller/scan/lookup/route', 'POST', 'POST /api/controller/scan/lookup (contrat 3.3, D43, fix(7.2s))');
            const win = await alignQuotaWindow(60, 8000);
            const out: RouteReply[] = [];
            for (let i = 0; i < 3; i++) out.push(await lookup(ctrl, ev.eventId, number));
            await assertSameQuotaWindow(win, 'rafale de vérifications');
            assert.deepEqual(out.slice(0, 2).map((r) => r.status), [200, 200], `sous le quota : ${out.map(show).join(' | ')}`);
            assert.equal(out[2].status, 429, `au-delà du quota : ${show(out[2])}`);
            assert.ok(Number(out[2].headers['retry-after']) > 0, `en-tête Retry-After : ${JSON.stringify(out[2].headers)}`);
            assert.equal(out[2].body.ticket, undefined, 'refus de quota : aucune donnée du billet');
            assert.equal((await auditOf(ctrl.userId)).length, 2, 'refus de quota : aucune ligne audit_logs');
        });
    });

    test('périmètre access.manual_entry_scope : ASSIGNED_CONTROLLER refuse le partenaire propriétaire et un contrôleur non affecté (403 SCAN_FORBIDDEN, rien révélé) ; STAFF admet le propriétaire', async () => {
        const number = String((await ticketRow(await freeTicket())).ticket_number);
        const unassigned = await newController(partner, otherEv.eventId, { label: 'lookup-autre' });
        await withAccessSettings({ 'access.manual_entry_scope': 'ASSIGNED_CONTROLLER' }, async () => {
            for (const [label, u] of [['partenaire propriétaire', partner], ['contrôleur d’un autre événement', unassigned]] as Array<[string, Buyer]>) {
                const r = await lookup(u, ev.eventId, number);
                assert.equal(r.status, 403, `${label} hors périmètre : 403 attendu, ${show(r)}`);
                assert.equal(r.body.code, 'SCAN_FORBIDDEN', `${label} : code SCAN_FORBIDDEN, ${show(r)}`);
                const text = JSON.stringify(r.body);
                assert.ok(!text.includes(HOLDER_LAST) && r.body.ticket === undefined, `${label} : aucune donnée du billet, ${text}`);
            }
        });
        await withAccessSettings({ 'access.manual_entry_scope': 'STAFF' }, async () => {
            const r = await lookup(partner, ev.eventId, number);
            assert.equal(r.status, 200, `STAFF : partenaire propriétaire admis, ${show(r)}`);
            assert.equal(r.body.found, true, show(r));
            const still = await lookup(unassigned, ev.eventId, number);
            assert.equal(still.status, 403, `STAFF : contrôleur d’un autre événement toujours refusé, ${show(still)}`);
        });
    });
});

// ── Caisse : total attendu servi ───────────────────────────────────────────

describe('7.2 — GET /api/controller/shifts/active : total attendu servi par le serveur (D46)', () => {
    test('fonds de 2 500 F + une vente au guichet de 5 000 F → expected_cash_in_drawer = 7 500', async () => {
        const ctrl = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'caisse-active' });
        const opened = await openShift(ctrl, ev.eventId, 2500);
        assert.equal(opened.status, 200, `ouverture : ${show(opened)}`);
        // Lot 9 (A16) : la caisse est créditée par une vente au guichet, seul encaissement restant (même assertion 2500 + PRICE).
        await withAccessSettings({ 'access.counter_sale_enabled': true }, async () => {
            const sold = await counterSale(ctrl, ev.eventId, [{ categoryId: ev.categories[STANDARD].id, quantity: 1 }]);
            assert.equal(sold.status, 200, show(sold));
            assert.equal(sold.body.ok, true, show(sold));
        });
        const r = await activeShift(ctrl, ev.eventId);
        assert.equal(r.status, 200, show(r));
        const shift = (r.body.shift ?? null) as Row | null;
        assert.ok(shift, `caisse ouverte renvoyée : ${show(r)}`);
        const served = r.body.expected_cash_in_drawer ?? shift.expected_cash_in_drawer;
        assert.ok(served !== undefined && served !== null, `expected_cash_in_drawer servi par le serveur (racine ou shift) : ${show(r)}`);
        assert.equal(Number(served), 2500 + PRICE, `fonds + encaissé : ${show(r)}`);
    });
});

// ── Guichet : informations et devis servis ─────────────────────────────────

describe('7.2 — guichet : GET /api/controller/counter-sale et POST /api/controller/counter-sale/quote (D53)', () => {
    test('GET : enabled, can_accept_cash, open_shift, catégories vendables avec prix et disponibilité ; guichet désactivé → enabled:false', async () => {
        const seller = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'guichet-info' });
        const opened = await openShift(seller, ev.eventId, 0);
        assert.equal(opened.status, 200, show(opened));
        await withAccessSettings({ 'access.counter_sale_enabled': true }, async () => {
            const r = await counterSaleInfo(seller, ev.eventId);
            assert.equal(r.status, 200, show(r));
            assert.equal(r.body.enabled, true, `guichet activé : ${show(r)}`);
            assert.equal(r.body.can_accept_cash, true, show(r));
            assert.ok(r.body.open_shift, `caisse ouverte signalée : ${show(r)}`);
            const cats = list(r.body, 'categories', 'catégories du guichet');
            for (const name of [STANDARD, RARE]) {
                const { data, error } = await service.from('ticket_categories').select('total_quantity, sold_quantity').eq('id', ev.categories[name].id).single();
                assert.equal(error, null, `stock ${name} : ${error?.message}`);
                const c = cats.find((x) => x.id === ev.categories[name].id);
                assert.ok(c, `catégorie ${name} listée : ${JSON.stringify(cats)}`);
                assert.equal(c.name, name, `nom de ${name}`);
                assert.equal(Number(c.price), ev.categories[name].price, `prix de ${name}`);
                assert.equal(Number(c.available), Number(data.total_quantity) - Number(data.sold_quantity), `disponibilité de ${name} lue en base`);
            }
            assert.equal(cats.find((x) => x.id === ev.categories[INACTIVE].id), undefined, 'catégorie inactive non proposée au guichet');
        });
        const noCash = await newController(partner, ev.eventId, { canAcceptCash: false, label: 'guichet-sans-especes' });
        const r2 = await counterSaleInfo(noCash, ev.eventId);
        assert.equal(r2.status, 200, show(r2));
        assert.equal(r2.body.can_accept_cash, false, `contrôleur sans permission espèces : ${show(r2)}`);
        await withAccessSettings({ 'access.counter_sale_enabled': false }, async () => {
            const r = await counterSaleInfo(seller, ev.eventId);
            assert.equal(r.status, 200, show(r));
            assert.equal(r.body.enabled, false, `access.counter_sale_enabled = false → enabled:false, ${show(r)}`);
        });
    });

    test('POST quote : total et lignes calculés par le serveur, sans écriture ; catégorie inactive → 400 INVALID_ITEMS', async () => {
        const seller = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'guichet-devis' });
        const opened = await openShift(seller, ev.eventId, 0);
        assert.equal(opened.status, 200, show(opened));
        const stockBefore = await Promise.all([STANDARD, RARE].map(async (n) => Number((await service.from('ticket_categories').select('sold_quantity').eq('id', ev.categories[n].id).single()).data?.sold_quantity)));
        const { count: paysBefore } = await service.from('payments').select('id', { count: 'exact', head: true }).eq('event_id', ev.eventId);
        await withAccessSettings({ 'access.counter_sale_enabled': true }, async () => {
            const r = await counterSaleQuote(seller, { eventId: ev.eventId, items: [{ categoryId: ev.categories[STANDARD].id, quantity: 2 }, { categoryId: ev.categories[RARE].id, quantity: 1 }] });
            assert.equal(r.status, 200, `devis : ${show(r)}`);
            assert.equal(Number(r.body.total), 2 * PRICE + RARE_PRICE, `total du serveur : ${show(r)}`);
            const lines = list(r.body, 'lines', 'devis');
            const byCat = new Map(lines.map((l) => [String(l.category_id), l]));
            for (const [name, qty, unit] of [[STANDARD, 2, PRICE], [RARE, 1, RARE_PRICE]] as Array<[string, number, number]>) {
                const l = byCat.get(ev.categories[name].id);
                assert.ok(l, `ligne ${name} : ${show(r)}`);
                assert.equal(l.name, name, `ligne ${name} : nom`);
                assert.equal(Number(l.unit_price), unit, `ligne ${name} : prix unitaire`);
                assert.equal(Number(l.quantity), qty, `ligne ${name} : quantité`);
                assert.equal(Number(l.amount), unit * qty, `ligne ${name} : montant`);
            }
            assert.equal(lines.length, 2, 'deux lignes');
            const bad = await counterSaleQuote(seller, { eventId: ev.eventId, items: [{ categoryId: ev.categories[INACTIVE].id, quantity: 1 }] });
            assert.equal(bad.status, 400, `catégorie inactive : 400 attendu, ${show(bad)}`);
            assert.equal(bad.body.code, 'INVALID_ITEMS', `catégorie inactive : INVALID_ITEMS, ${show(bad)}`);
            assert.equal(bad.body.total, undefined, 'refus : aucun total');
        });
        const stockAfter = await Promise.all([STANDARD, RARE].map(async (n) => Number((await service.from('ticket_categories').select('sold_quantity').eq('id', ev.categories[n].id).single()).data?.sold_quantity)));
        assert.deepEqual(stockAfter, stockBefore, 'devis : stock inchangé');
        const { count: paysAfter } = await service.from('payments').select('id', { count: 'exact', head: true }).eq('event_id', ev.eventId);
        assert.equal(paysAfter, paysBefore, 'devis : aucun paiement créé');
    });
});
