/**
 * Lot 7, tâche 7.2 (serveur) — clé d'idempotence du scan et de l'encaissement (contrat, sections 3.3, 6.1 et M5 ;
 * décisions D39, D40).
 *  - POST /api/controller/scan exige l'en-tête Idempotency-Key (^[A-Za-z0-9_-]{8,100}$) : sans clé ou clé
 *    invalide → 400 IDEMPOTENCY_KEY_REQUIRED, sans aucun effet (ni ligne ticket_scans, ni compostage) ;
 *  - même clé rejouée par le même scanneur (réponse perdue, relance automatique) → le verdict d'origine
 *    (`replayed: true`, même scan_id), sans nouvelle ligne, même si le code a expiré entre-temps ; deux envois
 *    simultanés de la même clé → une seule ligne, mêmes réponses ;
 *  - clés différentes, même code → `valid` puis `already_used` avec `ticket.checked_in_by_me: true` ;
 *  - même clé, autre scanneur → nouveau scan (la clé est propre au scanneur) ;
 *  - encaissement (PUT) rejoué par le même scanneur → 200 `valid`, `replayed: true`, un seul paiement
 *    CASH_CHECKIN, total attendu de la caisse incrémenté une seule fois ; rejoué par un autre scanneur → refus ;
 *  - ticket_scans.client_key et ticket_scans.secret_version écrits (M5).
 * Rouge avant correctif (fix(7.2s)) : app/api/controller/scan/route.ts ne lit aucun en-tête Idempotency-Key
 * (:81-133), ticket_scan ne connaît ni client_key ni rejeu (20261102000002_lot5_dette.sql:743-861 : le second
 * envoi répond already_used et ajoute une ligne de refus), ticket_cash_checkin répond 409
 * CASH_ALREADY_PROCESSED au rejeu (20261101000011_lot4_caisse.sql:120), colonnes client_key et
 * secret_version absentes de ticket_scans.
 * Couverture ajoutée, déjà verte (V) : « jamais deux entrées » (relance 5 fois), garanti aujourd'hui par
 * uq_ticket_scans_one_accepted et le compostage conditionnel ; son garde-fou est le compte des lignes acceptées
 * lu en base (une double entrée le ferait échouer).
 * La suite crée son partenaire, son événement (dans la fenêtre de scan), ses contrôleurs et ses billets.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import {
    cashCheckin, createCashOrderTickets, createTimedEvent, newController, newScanKey, openShift, scansOf, shiftRow, ticketPayload, ticketRow,
    type RouteResult,
} from './acces-helpers';
import { assertTerrainInvariants, issueFreeTicket, scanWithKey } from './terrain-helpers';

const FREE = 'Entrée';
const STANDARD = 'Standard';
const PRICE = 5000;

let partner: TestPartner;
let ev: SaleEvent;
let holder: Buyer;
let cashBuyer: Buyer;

before(async () => {
    partner = await newPartner('scan-idempotence');
    ev = await createTimedEvent(partner.partnerId, 'scan-idempotence', [
        { name: FREE, price: 0, total: 80 },
        { name: STANDARD, price: PRICE, total: 20 },
    ], { startsInHours: 1, durationHours: 6 });
    holder = await newBuyer('idem-porteur', { firstName: 'Mariama', lastName: 'Porteuse' });
    cashBuyer = await newBuyer('idem-especes');
});

after(async () => {
    await assertTerrainInvariants('scan-idempotence');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 800)}`;
}

async function freeTicket(): Promise<string> {
    return issueFreeTicket(ev.eventId, ev.categories[FREE].id, holder);
}

async function camera(ticketId: string, at?: Date): Promise<Record<string, unknown>> {
    return { eventId: ev.eventId, payload: await ticketPayload(ticketId, at) };
}

/** La ligne de journal porte les colonnes du lot 7 (M5) : message nommé si elles manquent. */
function assertKeyColumns(row: Row, label: string): void {
    assert.ok('client_key' in row, `${label} : colonne ticket_scans.client_key absente (migration 20261105000005, contrat M5)`);
    assert.ok('secret_version' in row, `${label} : colonne ticket_scans.secret_version absente (migration 20261105000005, contrat M5)`);
}

function accepted(rows: Row[]): Row[] {
    return rows.filter((r) => r.accepted === true);
}

function ticketOf(r: RouteResult): Row {
    const t = r.body.ticket;
    assert.ok(t && typeof t === 'object', `réponse sans objet ticket : ${show(r)}`);
    return t as Row;
}

async function expectValid(r: RouteResult, label: string): Promise<string> {
    assert.equal(r.status, 200, `${label} : ${show(r)}`);
    assert.equal(r.body.result, 'valid', `${label} : valid attendu, ${show(r)}`);
    assert.equal(typeof r.body.scan_id, 'string', `${label} : scan_id attendu, ${show(r)}`);
    return String(r.body.scan_id);
}

// ── 1. Clé obligatoire ─────────────────────────────────────────────────────

describe('7.2 — Idempotency-Key obligatoire sur POST /api/controller/scan (D39)', () => {
    test('sans en-tête, clé trop courte (« a »), clé de 101 caractères ou à caractères interdits → 400 IDEMPOTENCY_KEY_REQUIRED, aucun effet', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'idem-cle' });
        const ticketId = await freeTicket();
        const cases: Array<[string, string | null]> = [
            ['en-tête absent', null],
            ['clé « a »', 'a'],
            ['clé de 7 caractères', 'abcdefg'],
            ['clé de 101 caractères', 'k'.repeat(101)],
            ['caractères interdits', 'clé invalide !'],
        ];
        for (const [label, key] of cases) {
            const r = await scanWithKey(ctrl, await camera(ticketId), key);
            assert.equal(r.status, 400, `${label} : 400 attendu, ${show(r)}`);
            assert.equal(r.body.code, 'IDEMPOTENCY_KEY_REQUIRED', `${label} : code IDEMPOTENCY_KEY_REQUIRED attendu, ${show(r)}`);
            assert.notEqual(r.body.result, 'valid', `${label} : jamais un verdict, ${show(r)}`);
        }
        assert.deepEqual(await scansOf(ticketId), [], 'requêtes refusées : aucune ligne ticket_scans pour le billet');
        assert.equal((await ticketRow(ticketId)).status, 'VALIDE', 'requêtes refusées : billet non composté');
        const ok = await scanWithKey(ctrl, await camera(ticketId), newScanKey());
        await expectValid(ok, 'clé valide ensuite');
    });
});

// ── 2 à 6. Rejeu ───────────────────────────────────────────────────────────

describe('7.2 — rejeu d’un scan par sa clé (D40, M5 étape 1 bis)', () => {
    test('même clé deux fois (réponse perdue) : second `valid`, `replayed: true`, même scan_id, une seule ligne, aucune ligne already_used', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'idem-rejeu' });
        const ticketId = await freeTicket();
        const key = newScanKey();
        const body = await camera(ticketId);
        const first = await scanWithKey(ctrl, body, key);
        const scanId = await expectValid(first, 'premier envoi');
        assert.equal(first.body.replayed, false, `premier envoi : replayed = false (contrat 3.3), ${show(first)}`);
        const again = await scanWithKey(ctrl, body, key);
        assert.equal(again.status, 200, `rejeu : ${show(again)}`);
        assert.equal(again.body.result, 'valid', `rejeu de la même clé : verdict d’origine valid (pas already_used), ${show(again)}`);
        assert.equal(again.body.replayed, true, `rejeu : replayed = true, ${show(again)}`);
        assert.equal(again.body.scan_id, scanId, `rejeu : même scan_id que l’envoi d’origine, ${show(again)}`);
        assert.equal(ticketOf(again).ticket_number, ticketOf(first).ticket_number, 'rejeu : même billet');
        const rows = await scansOf(ticketId);
        assert.equal(rows.length, 1, `une seule ligne ticket_scans pour le billet (trouvé ${rows.length}) : ${JSON.stringify(rows.map((r) => r.result))}`);
        assert.deepEqual(rows.filter((r) => r.result === 'already_used'), [], 'aucune ligne de refus already_used ajoutée par le rejeu');
        assert.equal(rows[0].id, scanId, 'la ligne unique est celle du verdict d’origine');
    });

    test('même clé après expiration du code : verdict d’origine (valid, replayed), aucune nouvelle ligne', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'idem-expire' });
        const ticketId = await freeTicket();
        const key = newScanKey();
        const scanId = await expectValid(await scanWithKey(ctrl, await camera(ticketId), key), 'premier envoi');
        // Code d'il y a 10 minutes (pas de 20 s largement dépassé) : la route le juge expiré (totp_ok faux)
        const stale = await camera(ticketId, new Date(Date.now() - 10 * 60_000));
        const replay = await scanWithKey(ctrl, stale, key);
        assert.equal(replay.status, 200, `rejeu avec un code expiré : ${show(replay)}`);
        assert.equal(replay.body.result, 'valid', `rejeu avec un code expiré : verdict d’origine valid (pas qr_expired), ${show(replay)}`);
        assert.equal(replay.body.replayed, true, `rejeu avec un code expiré : replayed = true, ${show(replay)}`);
        assert.equal(replay.body.scan_id, scanId, `rejeu avec un code expiré : même scan_id, ${show(replay)}`);
        const rows = await scansOf(ticketId);
        assert.equal(rows.length, 1, `rejeu : aucune nouvelle ligne (trouvé ${rows.length}) : ${JSON.stringify(rows.map((r) => r.result))}`);
    });

    test('deux envois simultanés de la même clé : une seule ligne, réponses identiques (valid, même scan_id)', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'idem-course' });
        const ticketId = await freeTicket();
        const key = newScanKey();
        const body = await camera(ticketId);
        const settled = await Promise.allSettled([scanWithKey(ctrl, body, key), scanWithKey(ctrl, body, key)]);
        assert.deepEqual(settled.filter((s) => s.status === 'rejected'), [], 'aucune exception non gérée');
        const [a, b] = settled.map((s) => (s as PromiseFulfilledResult<RouteResult>).value);
        assert.equal(a.status, 200, `envoi A : ${show(a)}`);
        assert.equal(b.status, 200, `envoi B : ${show(b)}`);
        assert.equal(a.body.result, 'valid', `envoi A : valid, ${show(a)}`);
        assert.equal(b.body.result, 'valid', `envoi B : valid (rejeu de la ligne gagnante, pas already_used), ${show(b)}`);
        assert.equal(a.body.scan_id, b.body.scan_id, `réponses identiques : même scan_id (${a.body.scan_id} / ${b.body.scan_id})`);
        assert.deepEqual([a.body.replayed, b.body.replayed].sort(), [false, true], `un envoi d’origine et un rejeu : ${show(a)} / ${show(b)}`);
        const rows = await scansOf(ticketId);
        assert.equal(rows.length, 1, `une seule ligne ticket_scans (trouvé ${rows.length}) : ${JSON.stringify(rows.map((r) => r.result))}`);
        assert.equal(accepted(rows).length, 1, 'une seule entrée acceptée');
    });

    test('clés différentes, même code : valid puis already_used avec ticket.checked_in_by_me = true et checked_in_at', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'idem-deux-cles' });
        const ticketId = await freeTicket();
        const body = await camera(ticketId);
        const first = await scanWithKey(ctrl, body, newScanKey());
        await expectValid(first, 'première lecture');
        const second = await scanWithKey(ctrl, body, newScanKey());
        assert.equal(second.status, 200, `seconde lecture : ${show(second)}`);
        assert.equal(second.body.result, 'already_used', `seconde lecture (autre clé) : already_used, ${show(second)}`);
        assert.equal(second.body.replayed, false, `seconde lecture : pas un rejeu, ${show(second)}`);
        const t = ticketOf(second);
        assert.equal(t.checked_in_by_me, true, `already_used par le même scanneur : checked_in_by_me = true (contrat 3.3, D41), ${show(second)}`);
        const checkedIn = (await ticketRow(ticketId)).checked_in_at;
        assert.ok(typeof t.checked_in_at === 'string' && t.checked_in_at !== '', `already_used : checked_in_at renvoyé, ${show(second)}`);
        assert.equal(new Date(String(t.checked_in_at)).getTime(), new Date(String(checkedIn)).getTime(), 'checked_in_at = heure du compostage en base');
        const rows = await scansOf(ticketId);
        assert.deepEqual(rows.map((r) => r.result), ['valid', 'already_used'], 'deux lignes : valid puis already_used');
    });

    test('même clé, autre scanneur : nouveau scan (already_used, pas un rejeu, checked_in_by_me = false), ligne du second scanneur avec la clé', async () => {
        const ctrlA = await newController(partner, ev.eventId, { label: 'idem-a' });
        const ctrlB = await newController(partner, ev.eventId, { label: 'idem-b' });
        const ticketId = await freeTicket();
        const key = newScanKey();
        const body = await camera(ticketId);
        const scanA = await expectValid(await scanWithKey(ctrlA, body, key), 'scanneur A');
        const byB = await scanWithKey(ctrlB, body, key);
        assert.equal(byB.status, 200, `scanneur B, même clé : ${show(byB)}`);
        assert.equal(byB.body.result, 'already_used', `scanneur B, même clé : nouveau scan already_used, ${show(byB)}`);
        assert.notEqual(byB.body.replayed, true, `scanneur B : la clé de A n’est pas rejouée pour B, ${show(byB)}`);
        assert.notEqual(byB.body.scan_id, scanA, 'scanneur B : nouvelle ligne, autre scan_id');
        assert.equal(ticketOf(byB).checked_in_by_me, false, `billet composté par A : checked_in_by_me = false pour B, ${show(byB)}`);
        const rowsB = (await scansOf(ticketId)).filter((r) => r.scanner_id === ctrlB.userId);
        assert.equal(rowsB.length, 1, `une ligne pour le scanneur B (trouvé ${rowsB.length})`);
        assertKeyColumns(rowsB[0], 'ligne du scanneur B');
        assert.equal(rowsB[0].client_key, key, 'ligne du scanneur B : client_key = clé envoyée');
    });
});

// ── 7. Encaissement rejoué ─────────────────────────────────────────────────

describe('7.2 — encaissement (PUT) idempotent par scan_id (D40, M5 ticket_cash_checkin)', () => {
    test('rejeu par le même scanneur : 200 valid, replayed, même paiement ; un seul paiement CASH_CHECKIN ; total attendu incrémenté une fois ; rejeu par un autre scanneur refusé', async () => {
        const ctrl = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'idem-caisse' });
        const other = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'idem-caisse-autre' });
        for (const u of [ctrl, other]) {
            const o = await openShift(u, ev.eventId);
            assert.equal(o.status, 200, `ouverture de caisse : ${show(o)}`);
        }
        const shiftOf = async (u: Buyer): Promise<string> => {
            const { data, error } = await service.from('controller_shifts').select('id').eq('controller_id', u.userId).eq('event_id', ev.eventId).eq('status', 'OUVERT');
            assert.equal(error, null, `caisse ouverte : ${error?.message}`);
            assert.equal((data ?? []).length, 1, 'une caisse OUVERT');
            return String(data![0].id);
        };
        const shiftId = await shiftOf(ctrl);
        const otherShift = await shiftOf(other);
        const start = Number((await shiftRow(shiftId)).expected_cash_total);

        const order = await createCashOrderTickets(cashBuyer, partner, ev, STANDARD, 1);
        const ticketId = order.ticketIds[0];
        const scanned = await scanWithKey(ctrl, await camera(ticketId), newScanKey());
        assert.equal(scanned.body.result, 'cash_required', `scan d’un billet à régler sur place : ${show(scanned)}`);
        const scanId = String(scanned.body.scan_id);

        const first = await cashCheckin(ctrl, { scanId, eventId: ev.eventId });
        assert.equal(first.status, 200, `encaissement : ${show(first)}`);
        assert.equal(first.body.result, 'valid', `encaissement : ${show(first)}`);
        const replay = await cashCheckin(ctrl, { scanId, eventId: ev.eventId });
        assert.equal(replay.status, 200, `rejeu de l’encaissement par le même scanneur : 200 (jamais 409), ${show(replay)}`);
        assert.equal(replay.body.result, 'valid', `rejeu : valid, ${show(replay)}`);
        assert.equal(replay.body.replayed, true, `rejeu : replayed = true, ${show(replay)}`);
        assert.equal(Number(replay.body.amount), PRICE, `rejeu : montant encaissé, ${show(replay)}`);
        assert.equal(replay.body.payment_id, first.body.payment_id, `rejeu : même paiement, ${show(replay)}`);
        assert.equal(replay.body.scan_id, first.body.scan_id, `rejeu : scan_id de la ligne acceptée d’origine, ${show(replay)}`);
        assert.equal(replay.body.shift_id, shiftId, `rejeu : caisse du scanneur, ${show(replay)}`);

        const { data: pays, error } = await service.from('payments').select('id, metadata').eq('ticket_id', ticketId);
        assert.equal(error, null, `paiements du billet : ${error?.message}`);
        const cash = (pays ?? []).filter((p) => (p.metadata as Row | null)?.source === 'CASH_CHECKIN');
        assert.equal(cash.length, 1, `un seul paiement CASH_CHECKIN pour le billet (trouvé ${cash.length})`);
        assert.equal(Number((await shiftRow(shiftId)).expected_cash_total), start + PRICE, 'total attendu de la caisse incrémenté une seule fois');
        assert.equal(accepted(await scansOf(ticketId)).length, 1, 'une seule entrée acceptée');

        const byOther = await cashCheckin(other, { scanId, eventId: ev.eventId });
        assert.ok(byOther.status >= 400 && byOther.status < 500, `rejeu par un autre scanneur : refus 4xx attendu, ${show(byOther)}`);
        assert.notEqual(byOther.body.result, 'valid', `rejeu par un autre scanneur : jamais valid, ${show(byOther)}`);
        assert.notEqual(byOther.body.replayed, true, `rejeu par un autre scanneur : pas un rejeu, ${show(byOther)}`);
        assert.equal(Number((await shiftRow(otherShift)).expected_cash_total), 0, 'caisse de l’autre scanneur inchangée');
        assert.equal(Number((await shiftRow(shiftId)).expected_cash_total), start + PRICE, 'caisse du scanneur inchangée par le refus');
    });
});

// ── 8. Jamais deux entrées (couverture ajoutée, déjà vraie) ─────────────────

describe('7.2 — jamais deux entrées pour une relance (V)', () => {
    test('5 relances de la même clé (en parallèle) puis 5 clés différentes (en parallèle) : une seule entrée acceptée par billet, aucune erreur serveur', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'idem-relances' });
        for (const [label, keys] of [['même clé', Array(5).fill(newScanKey())], ['clés différentes', Array.from({ length: 5 }, () => newScanKey())]] as Array<[string, string[]]>) {
            const ticketId = await freeTicket();
            const body = await camera(ticketId);
            const settled = await Promise.allSettled(keys.map((k) => scanWithKey(ctrl, body, k)));
            assert.deepEqual(settled.filter((s) => s.status === 'rejected'), [], `${label} : aucune exception non gérée`);
            const res = settled.map((s) => (s as PromiseFulfilledResult<RouteResult>).value);
            assert.ok(res.every((r) => r.status === 200), `${label} : aucune erreur serveur ni refus de quota : ${res.map(show).join(' | ')}`);
            assert.ok(res.every((r) => r.body.result === 'valid' || r.body.result === 'already_used'), `${label} : seulement valid ou already_used : ${res.map(show).join(' | ')}`);
            const rows = await scansOf(ticketId);
            assert.equal(accepted(rows).length, 1, `${label} : exactement une ligne acceptée (trouvé ${accepted(rows).length})`);
            const t = await ticketRow(ticketId);
            assert.equal(t.status, 'UTILISE', `${label} : billet composté une fois`);
            assert.equal(t.checked_in_by, ctrl.userId, `${label} : composté par le scanneur`);
        }
    });
});

// ── 9. Colonnes du journal ─────────────────────────────────────────────────

describe('7.2 — ticket_scans.client_key et secret_version écrits (M5)', () => {
    test('scan accepté : client_key = clé de l’en-tête, secret_version = version courante du secret du billet ; refus qr_expired : clé écrite aussi', async () => {
        const ctrl = await newController(partner, ev.eventId, { label: 'idem-colonnes' });
        const ticketId = await freeTicket();
        const version = Number((await ticketRow(ticketId)).security_version);
        const staleKey = `cle-perimee-${randomUUID().slice(0, 8)}`;
        const stale = await scanWithKey(ctrl, await camera(ticketId, new Date(Date.now() - 10 * 60_000)), staleKey);
        assert.equal(stale.body.result, 'qr_expired', `code d’il y a 10 minutes : qr_expired, ${show(stale)}`);
        const key = newScanKey();
        const scanId = await expectValid(await scanWithKey(ctrl, await camera(ticketId), key), 'scan accepté');
        const rows = await scansOf(ticketId);
        const row = rows.find((r) => r.id === scanId);
        assert.ok(row, 'ligne du scan accepté');
        assertKeyColumns(row, 'ligne du scan accepté');
        assert.equal(row.client_key, key, 'ligne acceptée : client_key = Idempotency-Key');
        assert.equal(Number(row.secret_version), version, `ligne acceptée : secret_version = tickets.security_version (${version})`);
        const refused = rows.find((r) => r.result === 'qr_expired');
        assert.ok(refused, 'ligne du refus qr_expired');
        assert.equal(refused.client_key, staleKey, 'ligne de refus : client_key = Idempotency-Key');
    });
});
