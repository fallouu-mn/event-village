/**
 * Lot 5, tâche 5.10 — page de pilotage, onglet Entrées (contrat, sections I et O3).
 *  - GET /api/partner/events/[id]/pilotage/entries (RPC pilotage_entries) : total des entrées (scans
 *    acceptés) dont guichet ; par contrôleur (nom, entrées, refus, dernière activité) ; par point
 *    d'entrée ; par catégorie ; flux par quart d'heure (Africa/Dakar) ; refus par motif (libellés
 *    français, forbidden compris) ; tentatives multiples (au moins 2 tentatives sur le même billet en
 *    10 minutes hors couple cash_required → valid, ou toute tentative already_used ; numéro du billet
 *    visible du propriétaire) ; incidents techniques par contrôleur (scan_incidents, contrat C8) ;
 *  - exigence de la consigne « un scan apparaît en direct » : le partenaire propriétaire abonné en
 *    Realtime à ticket_scans de son événement reçoit le scan sans recharger, puis l'API entries le
 *    compte ; le partenaire B, abonné avec et sans filtre, ne reçoit rien.
 * Jeu de données et valeurs attendues (calculées à la main) : tests/parcours/pilotage-helpers.ts. Les
 * dernières activités et les quarts d'heure attendus sont déduits des horodatages bruts des scans du jeu
 * (arithmétique du test : arrondi au quart d'heure inférieur, Dakar = UTC+0), jamais d'une agrégation SQL.
 * Règle des suites : la ligne cash_required consommée par un encaissement n'est pas un refus.
 *
 * Rouge avant correctif :
 *  - aucune route app/api/partner/events/[id]/pilotage/entries ni RPC pilotage_entries ;
 *  - table scan_incidents absente (aucune migration) : les incidents du point 19 du lot 4 ne sont
 *    comptés nulle part ; la route de scan refuse en 429 avant de lire le corps
 *    (app/api/controller/scan/route.ts:55-63) ;
 *  - libellé de forbidden absent de SCAN_RESULT_LABELS (lib/scan/scan-result.ts:8-27) ;
 *  - le jeu de données échoue avant (event_transition, tickets.sale_channel, vente au guichet sans scan
 *    COUNTER : voir pilotage-apercu-ventes.test.ts) ;
 *  - aucun écran ne s'abonne aujourd'hui à ticket_scans (la publication existe depuis
 *    supabase/migrations/20261101000013_lot4_pilotage.sql:74-79, seuls les tests du lot 4 l'utilisent).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import {
    disposeClients, expectNothing, produceUntilReceived, signedInClient, subscribeCollect, waitForEvent,
} from '../helpers/realtime';
import { service } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { scan, ticketPayload, ticketRow } from './acces-helpers';
import { createDraftEvent, type DraftEvent } from './cycle-helpers';
import {
    buildKnownDataset, dateOf, ENTRY_POINTS, ETUDIANT, eventScans, EXPECTED, findItem, fullName, isRefusal, listAt,
    logRefusedAttempt, numberAt, pilotageOk, quarterStart, show, STANDARD, VIP, type KnownDataset, type Row,
} from './pilotage-helpers';

let ds: KnownDataset;
let partnerB: TestPartner;
let eventB: DraftEvent;

before(async () => {
    ds = await buildKnownDataset('entrees');
    partnerB = await newPartner('pil-entrees-b');
    eventB = await createDraftEvent(partnerB, 'pilotage-entrees-b', [{ name: STANDARD, price: 1_000, total: 10 }]);
    // Incident de C2 sur un AUTRE événement : ne doit pas apparaître dans le pilotage de A
    const { error } = await service.from('scan_incidents').insert({ scanner_id: ds.c2.userId, event_id: eventB.eventId, kind: 'NETWORK', source: 'DEVICE' });
    assert.equal(error, null, `incident sur l’événement de B (scan_incidents, contrat C8) : ${error?.message}`);
});

after(async () => {
    await assertLifecycleInvariants('pilotage-entrees');
});

function lastActivityOf(scans: Row[], scannerId: string): number {
    const times = scans.filter((s) => s.scanner_id === scannerId).map((s) => new Date(String(s.created_at)).getTime());
    assert.ok(times.length > 0, `garde-fou : le scanneur ${scannerId} a des scans dans le jeu`);
    return Math.max(...times);
}

describe('5.10 Entrées : GET …/pilotage/entries', () => {
    test('total des entrées (scans acceptés), dont guichet, et total des refus', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'entries', 'le partenaire propriétaire');
        assert.equal(numberAt(body, 'total', 'entrées'), EXPECTED.entries.total, 'entrées = 7 scans acceptés (QR, encaissement, guichet)');
        assert.equal(numberAt(body, 'counter', 'entrées au guichet'), EXPECTED.entries.counter, 'dont 3 ventes au guichet (méthode COUNTER)');
        assert.equal(numberAt(body, 'refused', 'refus'), EXPECTED.entries.refused,
            'refus = already_used ×2, qr_expired, forbidden ; le cash_required encaissé n’est pas un refus');
    });

    test('par contrôleur : nom, entrées, refus et dernière activité', async () => {
        const scans = await eventScans(ds.eventId);
        const body = await pilotageOk(ds.partner, ds.eventId, 'entries', 'le partenaire propriétaire');
        const rows = listAt(body, 'by_scanner', 'entrées par contrôleur');
        for (const key of ['c1', 'c2'] as const) {
            const ctrl = ds[key];
            const row = findItem(rows, 'scanner_id', ctrl.userId, `contrôleur ${fullName(ctrl)}`);
            assert.ok(String(row.name ?? '').includes(ctrl.firstName) && String(row.name ?? '').includes(ctrl.lastName),
                `nom du contrôleur ${fullName(ctrl)} : ${JSON.stringify(row)}`);
            assert.equal(numberAt(row, 'accepted', `${fullName(ctrl)} : entrées`), EXPECTED.byScanner[key].accepted, `${fullName(ctrl)} : entrées (guichet compris)`);
            assert.equal(numberAt(row, 'refused', `${fullName(ctrl)} : refus`), EXPECTED.byScanner[key].refused, `${fullName(ctrl)} : refus`);
            const last = dateOf(row.last_activity_at, `${fullName(ctrl)} : dernière activité`).getTime();
            const expected = lastActivityOf(scans, ctrl.userId);
            assert.ok(Math.abs(last - expected) < 1_000,
                `${fullName(ctrl)} : dernière activité = horodatage de son dernier scan (${new Date(expected).toISOString()}), reçu ${row.last_activity_at}`);
        }
    });

    test('par point d’entrée et par catégorie', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'entries', 'le partenaire propriétaire');
        const points = listAt(body, 'by_entry_point', 'entrées par point d’entrée');
        for (const [point, n] of Object.entries(EXPECTED.byEntryPoint)) {
            const row = findItem(points, 'entry_point', point, `point d’entrée ${point}`);
            assert.equal(numberAt(row, 'accepted', `${point} : entrées`), n, `${point} : entrées (point d’entrée du moment du scan)`);
        }
        const vip = points.find((p) => p.entry_point === ENTRY_POINTS.c4);
        if (vip) assert.equal(numberAt(vip, 'accepted', 'Entrée VIP'), 0, 'Entrée VIP : aucun scan dans le jeu');

        const cats = listAt(body, 'by_category', 'entrées par catégorie');
        for (const name of [STANDARD, VIP, ETUDIANT]) {
            const row = findItem(cats, 'category_id', ds.categoryIds[name], `catégorie ${name}`);
            assert.equal(numberAt(row, 'accepted', `${name} : entrées`), EXPECTED.byCategory[name].accepted, `${name} : entrées`);
        }
    });

    test('flux par quart d’heure (Africa/Dakar) : entrées et refus de chaque quart d’heure du jeu', async () => {
        const scans = await eventScans(ds.eventId);
        const expected = new Map<number, { accepted: number; refused: number }>();
        for (const s of scans) {
            const q = quarterStart(s.created_at);
            const cur = expected.get(q) ?? { accepted: 0, refused: 0 };
            if (s.accepted === true) cur.accepted += 1;
            else if (isRefusal(s)) cur.refused += 1;
            expected.set(q, cur);
        }
        const body = await pilotageOk(ds.partner, ds.eventId, 'entries', 'le partenaire propriétaire');
        const quarters = listAt(body, 'by_quarter', 'flux par quart d’heure');
        const seen = new Map<number, { accepted: number; refused: number }>();
        for (const q of quarters) {
            const start = dateOf(q.start, 'début du quart d’heure').getTime();
            assert.equal(start % 900_000, 0, `quart d’heure aligné sur :00, :15, :30 ou :45 : ${JSON.stringify(q)}`);
            seen.set(start, { accepted: numberAt(q, 'accepted', 'entrées du quart d’heure'), refused: numberAt(q, 'refused', 'refus du quart d’heure') });
        }
        for (const [start, exp] of Array.from(expected)) {
            assert.deepEqual(seen.get(start), exp, `quart d’heure de ${new Date(start).toISOString()} : ${JSON.stringify(exp)} attendu, reçu ${JSON.stringify(quarters)}`);
        }
        for (const [start, got] of Array.from(seen)) {
            if (!expected.has(start)) assert.deepEqual(got, { accepted: 0, refused: 0 }, `quart d’heure ${new Date(start).toISOString()} sans scan dans le jeu`);
        }
        assert.equal(quarters.reduce((s, q) => s + numberAt(q, 'accepted', 'entrées'), 0), EXPECTED.entries.total, 'Σ des quarts d’heure = entrées');
    });

    test('refus par motif, libellés français (forbidden compris) ; l’encaissement consommé n’est pas un refus', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'entries', 'le partenaire propriétaire');
        const rows = listAt(body, 'refusals_by_reason', 'refus par motif');
        const counts: Record<string, number> = {};
        for (const r of rows) {
            const n = numberAt(r, 'count', `refus ${r.result}`);
            if (n === 0) continue;
            counts[String(r.result)] = n;
            assert.equal(typeof r.label, 'string', `motif ${r.result} : libellé attendu ${JSON.stringify(r)}`);
            assert.ok(String(r.label).trim().length > 0 && r.label !== r.result && !/^[a-z_]+$/.test(String(r.label)),
                `motif ${r.result} : libellé français, pas l’enum brut ${JSON.stringify(r)}`);
        }
        assert.deepEqual(counts, EXPECTED.refusalsByReason, `refus par motif : ${JSON.stringify(rows)}`);
    });

    test('tentatives multiples : le billet tenté 3 fois est signalé avec son numéro ; le couple cash_required → valid est exclu', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'entries', 'le partenaire propriétaire');
        const rows = listAt(body, 'repeated_attempts', 'tentatives multiples');
        assert.equal(rows.length, 1, `un seul billet signalé (P1-a) : ${JSON.stringify(rows)}`);
        const row = findItem(rows, 'ticket_id', ds.tickets.p1a, 'billet tenté 3 fois');
        assert.equal(numberAt(row, 'attempts', 'tentatives'), EXPECTED.repeatedAttempts.attempts, 'P1-a : 3 tentatives (valid, already_used, already_used)');
        assert.equal(row.last_result, EXPECTED.repeatedAttempts.lastResult, 'P1-a : dernière tentative already_used');
        assert.equal(row.ticket_number, (await ticketRow(ds.tickets.p1a)).ticket_number, 'numéro du billet visible du partenaire propriétaire');
        assert.ok(!rows.some((r) => r.ticket_id === ds.tickets.cashPaid), 'billet encaissé au scan (cash_required puis valid) non signalé');
    });

    test('incidents techniques par contrôleur (scan_incidents), sans ceux d’un autre événement', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'entries', 'le partenaire propriétaire');
        const rows = listAt(body, 'incidents', 'incidents techniques');
        const got: Record<string, Record<string, number>> = {};
        for (const r of rows) {
            const who = r.scanner_id === ds.c1.userId ? 'c1' : r.scanner_id === ds.c2.userId ? 'c2' : String(r.scanner_id);
            got[who] = got[who] ?? {};
            got[who][String(r.kind)] = (got[who][String(r.kind)] ?? 0) + numberAt(r, 'count', `incidents ${r.kind}`);
        }
        assert.deepEqual(got, EXPECTED.incidents,
            `incidents : C1 NETWORK ×2, C2 TIMEOUT et RATE_LIMITED ; l’incident NETWORK de C2 sur l’événement de B absent : ${JSON.stringify(rows)}`);
    });
});

describe('5.10 Entrées en direct (Realtime sur ticket_scans, sans recharger)', () => {
    test('le propriétaire abonné reçoit le scan, puis l’API entries le compte ; le partenaire B ne reçoit rien', async () => {
        const owner = await signedInClient(ds.partner);
        const intruder = await signedInClient(partnerB);
        const filter = `event_id=eq.${ds.eventId}`;
        const toOwner = subscribeCollect(owner, { table: 'ticket_scans', event: 'INSERT', filter }, { label: 'propriétaire' });
        const toB = subscribeCollect(intruder, { table: 'ticket_scans', event: 'INSERT', filter }, { label: 'partenaire B, filtre sur l’événement de A' });
        const toBAll = subscribeCollect(intruder, { table: 'ticket_scans', event: 'INSERT' }, { label: 'partenaire B, sans filtre' });
        const ofA = (e: { new: Record<string, unknown> }) => e.new.event_id === ds.eventId;
        try {
            await Promise.all([toOwner.ready, toB.ready, toBAll.ready]);
            // Vivacité de l'abonnement du propriétaire (schéma du lot 4)
            await produceUntilReceived(toOwner, () => logRefusedAttempt(ds.eventId, ds.c1.userId), ofA, { what: 'vivacité de l’abonnement du propriétaire' });

            const res = await scan(ds.c2, { eventId: ds.eventId, payload: await ticketPayload(ds.tickets.p1b) });
            assert.equal(res.status, 200, `scan de P1-b par C2 : ${show(res)}`);
            assert.equal(res.body.result, 'valid', `scan de P1-b par C2 : ${show(res)}`);
            const live = await waitForEvent(toOwner, (e) => e.new.ticket_id === ds.tickets.p1b && e.new.accepted === true,
                undefined, 'le scan accepté de P1-b arrive au partenaire propriétaire sans rechargement');
            assert.equal(live.new.scanner_id, ds.c2.userId, 'scan reçu : scanneur C2');
            assert.equal(live.new.entry_point, ENTRY_POINTS.c2, 'scan reçu : point d’entrée du moment');

            // Sentinelle : reçue par le propriétaire après le scan, puis aucune ligne de A chez B
            const sentinel = await logRefusedAttempt(ds.eventId, ds.c1.userId);
            await waitForEvent(toOwner, (e) => e.new.payload_hash === sentinel, undefined, 'sentinelle reçue par le propriétaire');
            await expectNothing(toB, 1_000, ofA, 'le partenaire B (filtre sur l’événement de A) ne reçoit aucun scan de A');
            await expectNothing(toBAll, 0, ofA, 'le partenaire B (sans filtre) ne reçoit aucun scan de A');

            // L'API compte le scan reçu en direct
            const body = await pilotageOk(ds.partner, ds.eventId, 'entries', 'le partenaire propriétaire');
            assert.equal(numberAt(body, 'total', 'entrées après le scan en direct'), EXPECTED.entries.total + 1, 'entrées = 7 + le scan reçu en direct');
            const c2 = findItem(listAt(body, 'by_scanner', 'entrées par contrôleur'), 'scanner_id', ds.c2.userId, 'contrôleur C2');
            assert.equal(numberAt(c2, 'accepted', 'C2 : entrées'), EXPECTED.byScanner.c2.accepted + 1, 'C2 : une entrée de plus');
            const last = dateOf(c2.last_activity_at, 'C2 : dernière activité').getTime();
            assert.ok(last >= new Date(String(live.new.created_at)).getTime() - 1_000, `C2 : dernière activité au moins celle du scan reçu (${live.new.created_at}), reçu ${c2.last_activity_at}`);
            const overview = await pilotageOk(ds.partner, ds.eventId, 'overview', 'le partenaire propriétaire');
            assert.equal(numberAt(overview, 'entries.total', 'entrées de l’aperçu'), EXPECTED.entries.total + 1, 'aperçu : même total d’entrées');
        } finally {
            await disposeClients(owner, intruder);
        }
    });
});
