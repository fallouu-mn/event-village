/**
 * Lot 8, tâche 8.2 e — mode « renvoi seulement » du scan, côté serveur (point ouvert 3 ; contrat 3.5 et 7.1,
 * décisions L42, L43, L44 ; écrivain W4). Un scan repris après une sortie de l'application part avec
 * `replayOnly: true` : le serveur ne rend que le verdict d'une ligne existante pour cette clé et ne crée jamais
 * d'entrée. Le spectateur n'est plus là : aucun billet ne doit être composté à sa place.
 *  1. clé inconnue : 200 `not_processed`, billet VALIDE, aucune ligne ticket_scans, aucun avis ;
 *  2. clé connue : verdict d'origine, `replayed: true`, même scan_id, aucune ligne de plus ;
 *  3. clé connue, code expiré, absent ou illisible : même verdict ;
 *  4. scanneur sans droit : 403, aucune ligne, pas même `forbidden` ;
 *  5. sans clé : 400 sur la route et sur la RPC, aucune ligne ;
 *  6. indicateur mal formé : 400 INVALID_REPLAY_FLAG, billet VALIDE, jamais un compostage ;
 *  7. RPC directe : aucun compostage, quelle que soit la valeur non `false` ;
 *  8. autre événement, clé connue : `not_processed` ;
 *  9. concurrence : le renvoi attend le verrou consultatif de l'envoi d'origine et rend son verdict ;
 * 10. relecture normale après `not_processed` : `valid` ; lecture d'origine arrivée après le renvoi, puis nouveau
 *     scan : `already_used`, `checked_in_by_me: true`.
 * Le corps réel du client est `{ eventId, replayOnly: true }` (contrat 7.1) ; `payload` est toléré, jamais lu.
 *
 * Rouge avant correctif (fix(8.2e-s)) : app/api/controller/scan/route.ts:15-21 retire la clé inconnue, le scan part
 * donc en compostage réel s'il porte un code (1, 6), ou reçoit 400 sans code s'il n'en porte pas (2, 3, 9, 10) ;
 * ticket_scan (20261105000005_lot7_scan.sql:63-245) ignore `replay_only` (5, 7), écrit `forbidden` avant le rejeu
 * (:109-112, cas 4) et ne filtre pas le rejeu par événement (:115, cas 8) ; `not_processed` absent de
 * lib/scan/scan-result.ts. after() : assertRecetteInvariants nomme le schéma du lot absent.
 * Couverture ajoutée, déjà verte (V), signalée :
 *  - « sans clé, sur la route » : le contrôle de l'en-tête précède déjà les schémas ; garde-fou contre une branche
 *    de renvoi placée avant ce contrôle ;
 *  - « replayOnly: false » : parcours normal ; garde-fou contre un indicateur lu à tort comme un renvoi.
 * Le cas 3 avec un code expiré est vrai aujourd'hui ; c'est la variante sans code qui le rend rouge.
 * La suite crée son partenaire, ses événements (dans la fenêtre de scan), ses contrôleurs et ses billets. Chaque cas
 * a son contrôleur : les lignes ticket_scans se comptent par scanneur, et le quota par scanneur n'interfère pas.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertRecetteInvariants } from '../helpers/recette-invariants';
import { SCAN_RESULT_LABELS, isTechnicalScanResult, scanCategoryOf, type ScanResult } from '../../lib/scan/scan-result';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { assignController, createTimedEvent, newController, newScanKey, ticketPayload, ticketRow, type RouteResult } from './acces-helpers';
import { issueFreeTicket, openConcurrentClient, scanWithKey, waitForLockWaiters } from './terrain-helpers';
import { outboxRows } from './notif-helpers';

type Row = Record<string, unknown>;

const FREE = 'Entrée';
const NOT_PROCESSED_MESSAGE = 'Scan non traité : aucune entrée enregistrée. Scannez le billet de nouveau.';
const NOT_PROCESSED_LABEL = 'Scan non traité : scannez le billet de nouveau';
const SCAN_SQL = 'SELECT public.ticket_scan($1::jsonb) AS r';

let partner: TestPartner;
let ev: SaleEvent;
let holder: Buyer;

before(async () => {
    partner = await newPartner('scan-renvoi');
    ev = await createTimedEvent(partner.partnerId, 'scan-renvoi', [{ name: FREE, price: 0, total: 60 }], { startsInHours: 1, durationHours: 6 });
    holder = await newBuyer('renvoi-porteur', { firstName: 'Mariama', lastName: 'Porteuse' });
});

after(async () => {
    await assertRecetteInvariants('scan-renvoi-seulement');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 800)}`;
}

async function freeTicket(owner: Buyer = holder): Promise<string> {
    return issueFreeTicket(ev.eventId, ev.categories[FREE].id, owner);
}

async function camera(ticketId: string, at?: Date): Promise<Row> {
    return { eventId: ev.eventId, payload: await ticketPayload(ticketId, at) };
}

/** Corps réel du client à la reprise (contrat 7.1). */
function replayBody(eventId: string = ev.eventId): Row {
    return { eventId, replayOnly: true };
}

/** Lignes du journal d'un scanneur : chaque cas a son contrôleur, une ligne `forbidden` sans billet y est comptée. */
async function scansBy(scannerId: string): Promise<Row[]> {
    const { data, error } = await service.from('ticket_scans').select('*').eq('scanner_id', scannerId).order('created_at');
    assert.equal(error, null, `ticket_scans du scanneur : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function assertNoEntry(ticketId: string, scannerId: string, label: string): Promise<void> {
    const rows = await scansBy(scannerId);
    assert.deepEqual(rows.map((r) => r.result), [], `${label} : aucune ligne ticket_scans pour ce scanneur`);
    const t = await ticketRow(ticketId);
    assert.equal(t.status, 'VALIDE', `${label} : billet toujours VALIDE, jamais composté sans le spectateur`);
    assert.equal(t.checked_in_at ?? null, null, `${label} : checked_in_at vide`);
    assert.equal(t.checked_in_by ?? null, null, `${label} : checked_in_by vide`);
}

/** Réponse du contrat 3.5 quand aucune ligne n'existe pour la clé. */
function assertNotProcessed(r: RouteResult, label: string): void {
    assert.equal(r.status, 200, `${label} : ${show(r)}`);
    assert.equal(r.body.result, 'not_processed', `${label} : not_processed attendu, ${show(r)}`);
    assert.equal(r.body.replayed, false, `${label} : replayed = false, ${show(r)}`);
    assert.equal(r.body.code, 'REPLAY_NOT_FOUND', `${label} : code REPLAY_NOT_FOUND, ${show(r)}`);
    assert.equal(r.body.message, NOT_PROCESSED_MESSAGE, `${label} : message du contrat 3.5, ${show(r)}`);
    assert.equal('scan_id' in r.body, false, `${label} : aucun scan_id, ${show(r)}`);
    assert.equal('ticket' in r.body, false, `${label} : aucune donnée de billet, ${show(r)}`);
}

async function firstValidScan(ctrl: Buyer, ticketId: string, key: string): Promise<{ scanId: string; ticket: Row }> {
    const r = await scanWithKey(ctrl, await camera(ticketId), key);
    assert.equal(r.status, 200, `lecture d’origine : ${show(r)}`);
    assert.equal(r.body.result, 'valid', `lecture d’origine : valid attendu, ${show(r)}`);
    assert.equal(typeof r.body.scan_id, 'string', `lecture d’origine : scan_id attendu, ${show(r)}`);
    return { scanId: String(r.body.scan_id), ticket: r.body.ticket as Row };
}

function assertOriginalVerdict(r: RouteResult, result: string, scanId: string, label: string): void {
    assert.equal(r.status, 200, `${label} : ${show(r)}`);
    assert.equal(r.body.result, result, `${label} : verdict d’origine ${result}, ${show(r)}`);
    assert.equal(r.body.replayed, true, `${label} : replayed = true, ${show(r)}`);
    assert.equal(r.body.scan_id, scanId, `${label} : même scan_id, ${show(r)}`);
}

/** Paramètres qu'un appel direct mettrait pour composter : code jugé bon, version courante du secret. */
async function compostingParams(scannerId: string, ticketId: string, key: string | null): Promise<Row> {
    const t = await ticketRow(ticketId);
    const p: Row = { scanner_id: scannerId, event_id: ev.eventId, ticket_id: ticketId, method: 'QR', totp_ok: true, secret_version: Number(t.security_version) };
    if (key !== null) p.client_key = key;
    return p;
}

async function rpcScan(p: Row): Promise<Row> {
    const { data, error } = await service.rpc('ticket_scan', { p });
    assert.equal(error, null, `ticket_scan : ${error?.message}`);
    assert.ok(data && typeof data === 'object', `ticket_scan : réponse vide ${JSON.stringify(data)}`);
    return data as Row;
}

// ── 1. Clé inconnue ────────────────────────────────────────────────────────

describe('8.2 e — clé inconnue : rien n’est créé (L42, contrat 3.5)', () => {
    test('1. billet VALIDE, replayOnly: true, avec ou sans code : 200 not_processed, billet VALIDE, aucune ligne ticket_scans, aucun avis au porteur', async () => {
        const owner = await newBuyer('renvoi-inconnue', { firstName: 'Awa', lastName: 'Inconnue' });
        const ctrl = await newController(partner, ev.eventId, { label: 'renvoi-inconnue' });
        const ticketId = await freeTicket(owner);
        assertNotProcessed(await scanWithKey(ctrl, { ...await camera(ticketId), replayOnly: true }, newScanKey()), 'renvoi avec un code valide');
        await assertNoEntry(ticketId, ctrl.userId, 'renvoi avec un code valide');
        assertNotProcessed(await scanWithKey(ctrl, replayBody(), newScanKey()), 'renvoi sans code');
        await assertNoEntry(ticketId, ctrl.userId, 'renvoi sans code');
        assert.deepEqual(await outboxRows({ userId: owner.userId, type: 'TICKET_SCANNED' }), [], 'aucun avis « entrée validée » au porteur (témoin au cas 10)');
    });

    test('libellé et classement : not_processed est un incident technique, jamais un verdict sur le billet', () => {
        const labels = SCAN_RESULT_LABELS as Record<string, string>;
        assert.equal(labels.not_processed, NOT_PROCESSED_LABEL, 'libellé court de lib/scan/scan-result.ts (contrat 7.1)');
        const result = 'not_processed' as ScanResult;
        assert.equal(isTechnicalScanResult(result), true, 'not_processed dans TECHNICAL_SCAN_RESULTS');
        assert.equal(scanCategoryOf(result), 'technique', 'catégorie technique : ni vibration, ni compteur de refus');
    });
});

// ── 2 et 3. Clé connue ─────────────────────────────────────────────────────

describe('8.2 e — clé connue : le verdict d’origine, sans ligne de plus', () => {
    test('2. lecture acceptée puis renvoi : verdict d’origine, replayed: true, même scan_id, même billet, une seule ligne', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'renvoi-connue' });
        const ticketId = await freeTicket();
        const key = newScanKey();
        const origin = await firstValidScan(ctrl, ticketId, key);
        const replay = await scanWithKey(ctrl, replayBody(), key);
        assertOriginalVerdict(replay, 'valid', origin.scanId, 'renvoi');
        assert.equal((replay.body.ticket as Row | undefined)?.ticket_number, origin.ticket.ticket_number, `renvoi : même billet, ${show(replay)}`);
        const rows = await scansBy(ctrl.userId);
        assert.deepEqual(rows.map((r) => r.id), [origin.scanId], 'une seule ligne, celle de la lecture d’origine');
    });

    test('3. renvoi avec un code expiré, sans code ou avec un code illisible : même verdict, aucune ligne ; verdict de refus rendu tel quel', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'renvoi-expire' });
        const ticketId = await freeTicket();
        const key = newScanKey();
        const { scanId } = await firstValidScan(ctrl, ticketId, key);
        const stale = await camera(ticketId, new Date(Date.now() - 10 * 60_000));
        const bodies: Array<[string, Row]> = [
            ['code absent', replayBody()],
            ['code expiré', { ...stale, replayOnly: true }],
            ['code illisible', { ...replayBody(), payload: '' }],
        ];
        for (const [label, body] of bodies) assertOriginalVerdict(await scanWithKey(ctrl, body, key), 'valid', scanId, label);
        assert.equal((await scansBy(ctrl.userId)).length, 1, 'une seule ligne après les trois renvois');

        const refusedKey = newScanKey();
        const other = await freeTicket();
        const refused = await scanWithKey(ctrl, await camera(other, new Date(Date.now() - 10 * 60_000)), refusedKey);
        assert.equal(refused.body.result, 'qr_expired', `lecture d’origine refusée : ${show(refused)}`);
        assertOriginalVerdict(await scanWithKey(ctrl, replayBody(), refusedKey), 'qr_expired', String(refused.body.scan_id), 'renvoi d’un refus');
        assert.equal((await ticketRow(other)).status, 'VALIDE', 'renvoi d’un refus : billet toujours VALIDE');
        assert.equal((await scansBy(ctrl.userId)).length, 2, 'renvoi d’un refus : aucune ligne de plus');
    });
});

// ── 4 à 6. Refus ───────────────────────────────────────────────────────────

describe('8.2 e — refus du renvoi, sans aucune écriture (L43, L44)', () => {
    test('4. scanneur sans droit, avec ou sans code, par la route et par la RPC : 403 SCAN_FORBIDDEN, aucune ligne, pas même forbidden', async () => {
        const intruder = await newController(partner, null, { label: 'renvoi-sans-droit' });
        const ticketId = await freeTicket();
        for (const [label, body] of [['avec code', { ...await camera(ticketId), replayOnly: true }], ['sans code', replayBody()]] as Array<[string, Row]>) {
            const r = await scanWithKey(intruder, body, newScanKey());
            assert.equal(r.status, 403, `${label} : ${show(r)}`);
            assert.equal(r.body.code, 'SCAN_FORBIDDEN', `${label} : code SCAN_FORBIDDEN, ${show(r)}`);
            assert.equal('ticket' in r.body, false, `${label} : aucune donnée du billet, ${show(r)}`);
            await assertNoEntry(ticketId, intruder.userId, label);
        }
        const direct = await rpcScan({ ...await compostingParams(intruder.userId, ticketId, newScanKey()), replay_only: true });
        assert.deepEqual(direct, { http: 403, code: 'SCAN_FORBIDDEN' }, 'RPC directe : refus seul');
        await assertNoEntry(ticketId, intruder.userId, 'RPC directe');
    });

    test('5 (V). sans clé ou avec une clé invalide, sur la route : 400 IDEMPOTENCY_KEY_REQUIRED, aucune ligne ; événement illisible : 400', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'renvoi-sans-cle' });
        const ticketId = await freeTicket();
        for (const [label, key] of [['en-tête absent', null], ['clé trop courte', 'a']] as Array<[string, string | null]>) {
            const r = await scanWithKey(ctrl, { ...await camera(ticketId), replayOnly: true }, key);
            assert.equal(r.status, 400, `${label} : ${show(r)}`);
            assert.equal(r.body.code, 'IDEMPOTENCY_KEY_REQUIRED', `${label} : ${show(r)}`);
            await assertNoEntry(ticketId, ctrl.userId, label);
        }
        const bad = await scanWithKey(ctrl, { eventId: 'pas-un-uuid', replayOnly: true }, newScanKey());
        assert.equal(bad.status, 400, `événement illisible : ${show(bad)}`);
        assert.notEqual(bad.body.result, 'valid', `événement illisible : jamais un verdict, ${show(bad)}`);
        await assertNoEntry(ticketId, ctrl.userId, 'événement illisible');
    });

    test('5. sans clé, par la RPC directe : { http: 400, code: IDEMPOTENCY_KEY_REQUIRED }, avant toute écriture', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'renvoi-rpc-sans-cle' });
        const ticketId = await freeTicket();
        const r = await rpcScan({ ...await compostingParams(ctrl.userId, ticketId, null), replay_only: true });
        assert.deepEqual(r, { http: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' }, `RPC sans clé en mode renvoi : ${JSON.stringify(r)}`);
        await assertNoEntry(ticketId, ctrl.userId, 'RPC sans clé');
    });

    test('6. indicateur mal formé (« true », 1, null, 0, « false », replay_only) : 400 INVALID_REPLAY_FLAG, billet VALIDE, jamais un compostage', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'renvoi-drapeau' });
        const ticketId = await freeTicket();
        const flags: Array<[string, Row]> = [
            ['replayOnly: "true"', { replayOnly: 'true' }],
            ['replayOnly: 1', { replayOnly: 1 }],
            ['replayOnly: null', { replayOnly: null }],
            ['replayOnly: 0', { replayOnly: 0 }],
            ['replayOnly: "false"', { replayOnly: 'false' }],
            ['replay_only: true', { replay_only: true }],
            ['replay_only: false', { replay_only: false }],
        ];
        for (const [label, flag] of flags) {
            const withCode = await scanWithKey(ctrl, { ...await camera(ticketId), ...flag }, newScanKey());
            assert.equal(withCode.status, 400, `${label}, avec code : ${show(withCode)}`);
            assert.equal(withCode.body.code, 'INVALID_REPLAY_FLAG', `${label}, avec code : ${show(withCode)}`);
            await assertNoEntry(ticketId, ctrl.userId, `${label}, avec code`);
            // Lu sur le corps brut, avant les schémas : l'indicateur est refusé même sans code
            const bare = await scanWithKey(ctrl, { eventId: ev.eventId, ...flag }, newScanKey());
            assert.equal(bare.status, 400, `${label}, sans code : ${show(bare)}`);
            assert.equal(bare.body.code, 'INVALID_REPLAY_FLAG', `${label}, sans code : ${show(bare)}`);
        }
        await assertNoEntry(ticketId, ctrl.userId, 'après tous les indicateurs mal formés');
    });

    test('6 (V). replayOnly: false : parcours normal, le billet est composté', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'renvoi-faux' });
        const ticketId = await freeTicket();
        const r = await scanWithKey(ctrl, { ...await camera(ticketId), replayOnly: false }, newScanKey());
        assert.equal(r.status, 200, `replayOnly: false : ${show(r)}`);
        assert.equal(r.body.result, 'valid', `replayOnly: false : ${show(r)}`);
        assert.equal((await ticketRow(ticketId)).status, 'UTILISE', 'replayOnly: false : billet composté');
    });
});

// ── 7. RPC directe ─────────────────────────────────────────────────────────

describe('8.2 e — ticket_scan en mode renvoi, appelée directement', () => {
    test('7. { replay_only, ticket_id, totp_ok: true, secret_version, client_key } : aucun compostage pour toute valeur non false ; témoin : false composte', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'renvoi-rpc' });
        const ticketId = await freeTicket();
        for (const flag of [true, 'true', 1, 'oui']) {
            const label = `replay_only = ${JSON.stringify(flag)}`;
            const r = await rpcScan({ ...await compostingParams(ctrl.userId, ticketId, newScanKey()), replay_only: flag });
            assert.deepEqual(r, { result: 'not_processed', replayed: false, code: 'REPLAY_NOT_FOUND' }, `${label} : ${JSON.stringify(r)}`);
            await assertNoEntry(ticketId, ctrl.userId, label);
        }
        const witness = await rpcScan({ ...await compostingParams(ctrl.userId, ticketId, newScanKey()), replay_only: false });
        assert.equal(witness.result, 'valid', `témoin replay_only = false : les paramètres compostent, ${JSON.stringify(witness)}`);
        assert.equal((await ticketRow(ticketId)).status, 'UTILISE', 'témoin : billet composté');
    });
});

// ── 8. Autre événement ─────────────────────────────────────────────────────

describe('8.2 e — le renvoi est propre à l’événement', () => {
    test('8. clé connue sur l’événement A, renvoi sur l’événement B, avec ou sans code : not_processed, aucune ligne ; le verdict reste rendu sur A', async () => {
        const otherEvent = await createTimedEvent(partner.partnerId, 'scan-renvoi-b', [{ name: FREE, price: 0, total: 5 }], { startsInHours: 1, durationHours: 6 });
        const ctrl = await newController(partner, ev.eventId, { label: 'renvoi-autre-evt' });
        await assignController(partner, ctrl.userId, otherEvent.eventId, false);
        const ticketId = await freeTicket();
        const key = newScanKey();
        const { scanId } = await firstValidScan(ctrl, ticketId, key);
        assertNotProcessed(await scanWithKey(ctrl, { ...await camera(ticketId), eventId: otherEvent.eventId, replayOnly: true }, key), 'renvoi sur B, avec code');
        assertNotProcessed(await scanWithKey(ctrl, replayBody(otherEvent.eventId), key), 'renvoi sur B, sans code');
        assert.deepEqual((await scansBy(ctrl.userId)).map((r) => r.id), [scanId], 'aucune ligne de plus');
        assertOriginalVerdict(await scanWithKey(ctrl, replayBody(), key), 'valid', scanId, 'renvoi sur A');
    });
});

// ── 9. Concurrence ─────────────────────────────────────────────────────────

type RaceOutcome = { kind: 'answered'; r: RouteResult } | { kind: 'blocked'; waitEvents: Array<string | null> } | { kind: 'not_blocked'; reason: string };

describe('8.2 e — renvoi pendant l’envoi d’origine', () => {
    test('9. l’envoi d’origine tient le verrou consultatif de la clé : le renvoi attend, puis rend le verdict d’origine, sans ligne de plus', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'renvoi-course' });
        const ticketId = await freeTicket();
        const key = newScanKey();
        const params = await compostingParams(ctrl.userId, ticketId, key);
        const origin = await openConcurrentClient({ applicationName: 'ev-test-renvoi-origine' });
        let pending: Promise<RouteResult> | null = null;
        let scanId = '';
        try {
            // Transaction d'origine ouverte : verdict écrit, non validé, verrou consultatif (scanneur, clé) tenu
            const held = await origin.query<{ r: Row }>(SCAN_SQL, [JSON.stringify(params)]);
            const verdict = held.rows[0]?.r;
            assert.equal(verdict?.result, 'valid', `envoi d’origine en cours : ${JSON.stringify(verdict)}`);
            scanId = String(verdict.scan_id);
            pending = scanWithKey(ctrl, replayBody(), key);
            const blocked: Promise<RaceOutcome> = waitForLockWaiters({ queryLike: 'ticket_scan' }, 10_000).then(
                (waiters) => ({ kind: 'blocked', waitEvents: waiters.map((w) => w.wait_event) }),
                (err: unknown) => ({ kind: 'not_blocked', reason: err instanceof Error ? err.message : String(err) }),
            );
            const answered: Promise<RaceOutcome> = pending.then((r) => ({ kind: 'answered', r }));
            const first = await Promise.race([answered, blocked]);
            assert.ok(first.kind === 'blocked', `le renvoi doit attendre l’envoi d’origine : ${first.kind === 'answered' ? show(first.r) : first.kind === 'not_blocked' ? first.reason : ''}`);
            assert.ok(first.waitEvents.includes('advisory'), `attente sur le verrou consultatif de la clé : ${JSON.stringify(first.waitEvents)}`);
            await origin.commit();
        } finally {
            await origin.close();
        }
        assert.ok(pending, 'renvoi lancé');
        assertOriginalVerdict(await pending, 'valid', scanId, 'renvoi après la validation de l’envoi d’origine');
        assert.deepEqual((await scansBy(ctrl.userId)).map((r) => r.id), [scanId], 'une seule ligne, celle de l’envoi d’origine');
        assert.equal((await ticketRow(ticketId)).status, 'UTILISE', 'composté une fois, par l’envoi d’origine');
    });
});

// ── 10. Après not_processed ────────────────────────────────────────────────

describe('8.2 e — après not_processed, le contrôleur peut rescanner', () => {
    test('10. relecture normale : valid, une seule ligne ; témoin : l’avis au porteur part seulement à ce moment', async () => {
        const owner = await newBuyer('renvoi-relecture', { firstName: 'Fatou', lastName: 'Relecture' });
        const ctrl = await newController(partner, ev.eventId, { label: 'renvoi-relecture' });
        const ticketId = await freeTicket(owner);
        assertNotProcessed(await scanWithKey(ctrl, replayBody(), newScanKey()), 'renvoi');
        assert.deepEqual(await outboxRows({ userId: owner.userId, type: 'TICKET_SCANNED' }), [], 'renvoi : aucun avis');
        const { scanId } = await firstValidScan(ctrl, ticketId, newScanKey());
        assert.deepEqual((await scansBy(ctrl.userId)).map((r) => r.id), [scanId], 'une seule ligne, celle de la relecture');
        const t = await ticketRow(ticketId);
        assert.equal(t.status, 'UTILISE', 'relecture : billet composté');
        assert.equal(t.checked_in_by, ctrl.userId, 'relecture : composté par le scanneur');
        assert.ok((await outboxRows({ userId: owner.userId, type: 'TICKET_SCANNED' })).length > 0, 'témoin : l’avis « entrée validée » est bien lu par ce filtre');
    });

    test('10. lecture d’origine arrivée après le renvoi, puis nouveau scan : already_used, checked_in_by_me: true ; le renvoi rend alors le verdict d’origine', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'renvoi-retard' });
        const ticketId = await freeTicket();
        const key = newScanKey();
        assertNotProcessed(await scanWithKey(ctrl, replayBody(), key), 'renvoi avant l’arrivée de l’envoi d’origine');
        const { scanId } = await firstValidScan(ctrl, ticketId, key);
        const again = await scanWithKey(ctrl, await camera(ticketId), newScanKey());
        assert.equal(again.status, 200, `nouveau scan : ${show(again)}`);
        assert.equal(again.body.result, 'already_used', `nouveau scan : ${show(again)}`);
        assert.equal(again.body.replayed, false, `nouveau scan : pas un rejeu, ${show(again)}`);
        assert.equal((again.body.ticket as Row | undefined)?.checked_in_by_me, true, `composté par ce scanneur : ${show(again)}`);
        assert.deepEqual((await scansBy(ctrl.userId)).map((r) => r.result), ['valid', 'already_used'], 'deux lignes : valid puis already_used');
        assertOriginalVerdict(await scanWithKey(ctrl, replayBody(), key), 'valid', scanId, 'renvoi tardif');
        assert.equal((await scansBy(ctrl.userId)).length, 2, 'renvoi tardif : aucune ligne de plus');
    });
});
