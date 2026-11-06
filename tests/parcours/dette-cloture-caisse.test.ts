/**
 * Lot 5, tâche 5.0 — dette du lot 4, C2 : clôture de caisse transactionnelle. Contrat : section C2 de
 * la conception du lot 5.
 *  - RPC shift_close(p) { shift_id, actor_id, declared_cash_total (entier ≥ 0), justification?,
 *    regisseur_pin? } : verrou FOR UPDATE sur la caisse, statut OUVERT sinon SHIFT_NOT_OPEN, écart =
 *    déclaré − attendu relu sous verrou ;
 *  - écart non nul : justification d'au moins 10 caractères (sinon JUSTIFICATION_REQUIRED) et PIN
 *    régisseur vérifié dans la transaction (sinon PIN_REQUIRED ou PIN_INVALID) ; sans écart, aucun PIN ;
 *  - écritures : CLOTURE, closed_at, closed_by, declared_cash_total, écart, justification, co-signature,
 *    et alerte in-app au partenaire propriétaire dans la même transaction ;
 *  - qui clôture : le contrôleur de la caisse, le partenaire propriétaire ou un admin ;
 *  - deux clôtures simultanées : une seule réussit, l'autre reçoit SHIFT_NOT_OPEN ;
 *  - route POST /api/controller/shifts/close { shiftId, declaredCashTotal, justification?, regisseurPin? }.
 *
 * Rouge avant correctif :
 *  - lib/shifts/shift.service.ts:349 : caisse lue sans verrou, et seulement si `controller_id` est
 *    l'appelant (le partenaire propriétaire et l'admin reçoivent 404) ;
 *  - :355-357 : PIN exigé même sans écart (400 PIN_REQUIRED) ;
 *  - :362-366 : justification non vide suffit, montant non entier accepté ;
 *  - app/api/controller/shifts/close/route.ts:9-24 : le champ `justification` du contrat est ignoré
 *    (seuls discrepancyJustification et discrepancy_justification sont lus) ;
 *  - controller_shifts n'a pas de colonne closed_by (supabase/migrations/20260906000002_controller_shifts.sql:15-33) ;
 *  - lib/notifications/notification.service.ts:615 : titre de l'alerte avec un emoji ;
 *  - la RPC shift_close n'existe pas.
 *
 * Interprétations retenues (contrat muet ou ambigu) :
 *  - noms des colonnes : le contrat nomme cash_difference, justification, pin_cosigned ; les colonnes
 *    existantes discrepancy_amount, discrepancy_justification, closing_confirmed_by_pin sont acceptées
 *    comme équivalentes ; closed_by est exigée ;
 *  - l'alerte in-app est la notification du compte du partenaire créée par la clôture (une par clôture
 *    avec écart), sans emoji ;
 *  - refus d'un autre contrôleur : 403 ou 404, caisse inchangée ;
 *  - PIN faux : 401 PIN_INVALID (statut actuel de la route).
 * Chaque cas a sa propre caisse (quota REGISSEUR_PIN_PER_SHIFT_15MIN par caisse). La suite crée son
 * partenaire, son événement (dans la fenêtre de scan), ses contrôleurs et son admin.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { routeContext } from './helpers';
import { importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { authed, cashCheckin, createCashOrderTickets, createTimedEvent, newController, openShift, scan, shiftRow, ticketPayload, type RouteResult } from './acces-helpers';
import { flushNotifications, outboxRows } from './notif-helpers';

const CLOSE_ROUTE = '../../app/api/controller/shifts/close/route';
const PIN_ROUTE = '../../app/api/partner/events/[id]/regisseur-pin/route';
const JUSTIFICATION = 'Billet de 2 500 F rendu en trop à un spectateur, constaté au comptage.';
const EMOJI = new RegExp('\\p{Extended_Pictographic}', 'u');

let partner: TestPartner;
let ev: SaleEvent;
let admin: Buyer;
let pin: string;

before(async () => {
    partner = await newPartner('dette-cloture');
    ev = await createTimedEvent(partner.partnerId, 'dette-cloture', [{ name: 'Standard', price: 5000, total: 20 }]);
    admin = await newAdmin('dette-cloture');
    // PIN régisseur généré avant toute ouverture de caisse (sinon 409 OPEN_SHIFTS)
    const { POST } = await importModule(PIN_ROUTE);
    const res = await invoke(POST as Handler, authed(`/api/partner/events/${ev.eventId}/regisseur-pin`, 'POST', partner, { confirm: true }), routeContext({ id: ev.eventId }));
    assert.equal(res.status, 200, `génération du PIN régisseur : ${show(res)}`);
    pin = String(res.body.pin);
    assert.match(pin, /^\d{4,8}$/, `PIN régisseur renvoyé en clair : ${show(res)}`);
});

after(async () => {
    await assertLifecycleInvariants('dette-cloture-caisse');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

async function invoke(handler: Handler, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

function show(res: RouteResult): string {
    return `HTTP ${res.status} ${JSON.stringify(res.body)}`;
}

async function newAdmin(label: string): Promise<Buyer> {
    const user = await newBuyer(`admin-${label}`, { firstName: 'Aminata', lastName: 'Administratrice' });
    const { error } = await service.from('user_roles').upsert([{ user_id: user.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(error, null, `rôle ADMIN : ${error?.message}`);
    return user;
}

interface Cashier { ctrl: Buyer; shiftId: string; expected: number }

/** Contrôleur affecté avec la permission espèces et sa caisse OUVERT (route d'ouverture du lot 4). */
async function newCashier(label: string): Promise<Cashier> {
    const ctrl = await newController(partner, ev.eventId, { canAcceptCash: true, label });
    const res = await openShift(ctrl, ev.eventId);
    assert.equal(res.status, 200, `ouverture de caisse (${label}) : ${show(res)}`);
    const { data, error } = await service.from('controller_shifts').select('id, expected_cash_total')
        .eq('controller_id', ctrl.userId).eq('event_id', ev.eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisse ouverte (${label}) : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `une caisse OUVERT pour ${label}`);
    return { ctrl, shiftId: String(data![0].id), expected: Number(data![0].expected_cash_total) };
}

async function closeByRoute(user: Buyer, body: Row): Promise<RouteResult> {
    const { POST } = await importModule(CLOSE_ROUTE);
    return invoke(POST as Handler, authed('/api/controller/shifts/close', 'POST', user, body));
}

interface Closed { status: string; declared: number; difference: number; justification: string | null; pinCosigned: unknown; closedBy: unknown; closedAt: unknown }

/** Lecture de la caisse avec les noms du contrat (ou les colonnes existantes équivalentes). */
async function closedState(shiftId: string): Promise<Closed> {
    const row = await shiftRow(shiftId);
    const pick = (a: string, b: string): unknown => (row[a] !== undefined && row[a] !== null ? row[a] : row[b]);
    return {
        status: String(row.status),
        declared: Number(row.declared_cash_total),
        difference: Number(pick('cash_difference', 'discrepancy_amount')),
        justification: (pick('justification', 'discrepancy_justification') as string | null) ?? null,
        pinCosigned: pick('pin_cosigned', 'closing_confirmed_by_pin'),
        closedBy: row.closed_by,
        closedAt: row.closed_at,
    };
}

/**
 * Lot 6 (6.1, J2.1) : l'alerte in-app passe par la boîte d'envoi. Motif « vider → photographier → agir →
 * vider → comparer » : l'envoyeur livre les lignes en attente du partenaire (restreint à ses lignes)
 * avant la photographie et avant la comparaison ; l'assertion de fond est inchangée.
 */
async function flushPartnerLines(): Promise<void> {
    const pending = await outboxRows({ userId: partner.userId, status: 'PENDING' });
    if (pending.length > 0) await flushNotifications({ ids: pending.map((r) => r.id) });
}

async function partnerNotificationIds(): Promise<Set<string>> {
    await flushPartnerLines();
    const { data, error } = await service.from('notifications').select('id').eq('user_id', partner.userId);
    assert.equal(error, null, `notifications du partenaire : ${error?.message}`);
    return new Set((data ?? []).map((n) => String(n.id)));
}

async function newPartnerNotifications(before: Set<string>): Promise<Row[]> {
    await flushPartnerLines();
    const { data, error } = await service.from('notifications').select('id, title, content, channel, type').eq('user_id', partner.userId);
    assert.equal(error, null, `notifications du partenaire : ${error?.message}`);
    return ((data ?? []) as Row[]).filter((n) => !before.has(String(n.id)));
}

async function closedAuditRows(shiftId: string): Promise<number> {
    const { data, error } = await service.from('audit_logs').select('id').eq('action', 'SHIFT_CLOSED').eq('object_id', shiftId);
    assert.equal(error, null, `audit_logs SHIFT_CLOSED : ${error?.message}`);
    return (data ?? []).length;
}

async function assertStillOpen(shiftId: string, label: string): Promise<void> {
    const s = await shiftRow(shiftId);
    assert.equal(s.status, 'OUVERT', `${label} : caisse toujours OUVERT (statut ${s.status})`);
    assert.equal(s.closed_at ?? null, null, `${label} : closed_at vide`);
}

/**
 * Lot 8, tâche 8.2 f (contrat 3.6) : un refus JUSTIFICATION_REQUIRED ou PIN_REQUIRED porte l'écart, pour que l'écran
 * l'affiche (components/shifts/ShiftModals.tsx:205-207) : expected, declared, discrepancy = déclaré − attendu.
 */
function assertGap(res: RouteResult, expected: number, declared: number, label: string): void {
    assert.equal(res.body.expected, expected, `${label} : expected = total attendu : ${show(res)}`);
    assert.equal(res.body.declared, declared, `${label} : declared = montant déclaré : ${show(res)}`);
    assert.equal(res.body.discrepancy, declared - expected, `${label} : discrepancy = déclaré − attendu : ${show(res)}`);
}

// ── Clôture par la route ───────────────────────────────────────────────────

describe('C2 — clôture de caisse par la route', () => {
    test('clôture sans écart : sans PIN, CLOTURE, écart 0, déclaré = attendu, closed_by = contrôleur', async () => {
        const c = await newCashier('cl-sans-ecart');
        const res = await closeByRoute(c.ctrl, { shiftId: c.shiftId, declaredCashTotal: c.expected });
        assert.equal(res.status, 200, `clôture sans écart (sans PIN) : ${show(res)}`);
        const s = await closedState(c.shiftId);
        assert.equal(s.status, 'CLOTURE', 'caisse CLOTURE');
        assert.equal(s.declared, c.expected, 'declared_cash_total = montant déclaré');
        assert.equal(s.difference, 0, 'écart nul');
        assert.ok(s.closedAt, 'closed_at renseigné');
        assert.equal(s.closedBy, c.ctrl.userId, 'closed_by = contrôleur de la caisse');
        assert.equal(s.pinCosigned, false, 'aucune co-signature sans écart');
    });

    test('clôture avec écart justifié et PIN : CLOTURE, écart = déclaré − attendu, justification, co-signature, une alerte in-app sans emoji', async () => {
        const c = await newCashier('cl-ecart-justifie');
        const before = await partnerNotificationIds();
        const declared = c.expected + 2500;
        const res = await closeByRoute(c.ctrl, { shiftId: c.shiftId, declaredCashTotal: declared, justification: JUSTIFICATION, regisseurPin: pin });
        assert.equal(res.status, 200, `clôture avec écart justifié : ${show(res)}`);
        const s = await closedState(c.shiftId);
        assert.equal(s.status, 'CLOTURE', 'caisse CLOTURE');
        assert.equal(s.declared, declared, 'declared_cash_total = montant déclaré');
        assert.equal(s.difference, 2500, 'écart = déclaré − attendu');
        assert.equal(s.justification, JUSTIFICATION, 'justification enregistrée');
        assert.equal(s.pinCosigned, true, 'co-signature par le PIN régisseur');
        assert.equal(s.closedBy, c.ctrl.userId, 'closed_by = contrôleur de la caisse');
        const alerts = await newPartnerNotifications(before);
        assert.equal(alerts.length, 1, `une alerte in-app au partenaire propriétaire (trouvé ${alerts.length}) : ${JSON.stringify(alerts)}`);
        assert.doesNotMatch(`${alerts[0].title} ${alerts[0].content}`, EMOJI, `alerte sans emoji : ${JSON.stringify(alerts[0])}`);
    });

    test('garde-fou : écart sans justification, ou justification de moins de 10 caractères → 400 JUSTIFICATION_REQUIRED, caisse OUVERT', async () => {
        const c = await newCashier('cl-sans-justif');
        for (const [label, justification] of [['sans justification', undefined], ['justification trop courte', 'Erreur']] as Array<[string, string | undefined]>) {
            const body: Row = { shiftId: c.shiftId, declaredCashTotal: c.expected + 1000, regisseurPin: pin };
            if (justification !== undefined) body.justification = justification;
            const res = await closeByRoute(c.ctrl, body);
            assert.equal(res.status, 400, `${label} : ${show(res)}`);
            assert.equal(res.body.code, 'JUSTIFICATION_REQUIRED', `${label} : code JUSTIFICATION_REQUIRED : ${show(res)}`);
            assertGap(res, c.expected, c.expected + 1000, label);
            await assertStillOpen(c.shiftId, label);
        }
    });

    test('garde-fou : écart justifié avec un PIN faux → 401 PIN_INVALID ; sans PIN → 400 PIN_REQUIRED ; caisse OUVERT', async () => {
        const c = await newCashier('cl-pin-faux');
        const wrong = pin === '000000' ? '111111' : '000000';
        const bad = await closeByRoute(c.ctrl, { shiftId: c.shiftId, declaredCashTotal: c.expected + 1000, justification: JUSTIFICATION, regisseurPin: wrong });
        assert.equal(bad.status, 401, `PIN faux : ${show(bad)}`);
        assert.equal(bad.body.code, 'PIN_INVALID', `PIN faux : code PIN_INVALID : ${show(bad)}`);
        await assertStillOpen(c.shiftId, 'PIN faux');
        const none = await closeByRoute(c.ctrl, { shiftId: c.shiftId, declaredCashTotal: c.expected + 1000, justification: JUSTIFICATION });
        assert.equal(none.status, 400, `écart sans PIN : ${show(none)}`);
        assert.equal(none.body.code, 'PIN_REQUIRED', `écart sans PIN : code PIN_REQUIRED : ${show(none)}`);
        assertGap(none, c.expected, c.expected + 1000, 'écart sans PIN');
        await assertStillOpen(c.shiftId, 'écart sans PIN');
    });

    test('écart négatif (espèces manquantes) : JUSTIFICATION_REQUIRED puis PIN_REQUIRED portent expected, declared et discrepancy = −1000 ; caisse OUVERT', async () => {
        const c = await newCashier('cl-ecart-negatif');
        // Un total attendu positif ne vient que d'un encaissement réel (invariant (h) : somme des paiements rattachés)
        const buyer = await newBuyer('cl-ecart-negatif');
        const order = await createCashOrderTickets(buyer, partner, ev, 'Standard', 1);
        const scanned = await scan(c.ctrl, { eventId: ev.eventId, payload: await ticketPayload(order.ticketIds[0]) });
        assert.equal(scanned.body.result, 'cash_required', `billet à régler sur place : ${show(scanned)}`);
        const paid = await cashCheckin(c.ctrl, { scanId: scanned.body.scan_id, eventId: ev.eventId });
        assert.equal(paid.body.result, 'valid', `encaissement : ${show(paid)}`);
        const expected = Number((await shiftRow(c.shiftId)).expected_cash_total);
        assert.equal(expected, c.expected + 5000, 'total attendu après l’encaissement');
        const declared = expected - 1000;

        const noReason = await closeByRoute(c.ctrl, { shiftId: c.shiftId, declaredCashTotal: declared, regisseurPin: pin });
        assert.equal(noReason.status, 400, `écart négatif sans justification : ${show(noReason)}`);
        assert.equal(noReason.body.code, 'JUSTIFICATION_REQUIRED', `écart négatif sans justification : ${show(noReason)}`);
        assertGap(noReason, expected, declared, 'écart négatif sans justification');
        assert.equal(noReason.body.discrepancy, -1000, 'écart négatif : signe de la RPC (déclaré − attendu)');

        const noPin = await closeByRoute(c.ctrl, { shiftId: c.shiftId, declaredCashTotal: declared, justification: JUSTIFICATION });
        assert.equal(noPin.status, 400, `écart négatif sans PIN : ${show(noPin)}`);
        assert.equal(noPin.body.code, 'PIN_REQUIRED', `écart négatif sans PIN : ${show(noPin)}`);
        assertGap(noPin, expected, declared, 'écart négatif sans PIN');
        assert.equal(noPin.body.discrepancy, -1000, 'écart négatif : signe de la RPC (déclaré − attendu)');
        await assertStillOpen(c.shiftId, 'écart négatif');
    });

    test('double clôture simultanée sans écart : une 200, une 409 SHIFT_NOT_OPEN ; une seule clôture journalisée', async () => {
        const c = await newCashier('cl-double');
        const results = await Promise.all([
            closeByRoute(c.ctrl, { shiftId: c.shiftId, declaredCashTotal: c.expected }),
            closeByRoute(c.ctrl, { shiftId: c.shiftId, declaredCashTotal: c.expected }),
        ]);
        const statuses = results.map((r) => r.status).sort();
        assert.deepEqual(statuses, [200, 409], `une clôture acceptée, l’autre refusée : ${results.map(show).join(' | ')}`);
        const loser = results.find((r) => r.status === 409)!;
        assert.equal(loser.body.code, 'SHIFT_NOT_OPEN', `seconde clôture : code SHIFT_NOT_OPEN : ${show(loser)}`);
        assert.equal((await closedState(c.shiftId)).status, 'CLOTURE', 'caisse CLOTURE');
        assert.ok(await closedAuditRows(c.shiftId) <= 1, 'au plus une ligne SHIFT_CLOSED dans audit_logs');
    });

    test('double clôture simultanée avec écart justifié : une seule réussit, une seule alerte au partenaire', async () => {
        const c = await newCashier('cl-double-ecart');
        const before = await partnerNotificationIds();
        const body = { shiftId: c.shiftId, declaredCashTotal: c.expected + 500, justification: JUSTIFICATION, regisseurPin: pin };
        const results = await Promise.all([closeByRoute(c.ctrl, body), closeByRoute(c.ctrl, body)]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409], `une clôture acceptée, l’autre refusée : ${results.map(show).join(' | ')}`);
        assert.equal(results.find((r) => r.status === 409)!.body.code, 'SHIFT_NOT_OPEN', `seconde clôture : ${results.map(show).join(' | ')}`);
        assert.equal((await newPartnerNotifications(before)).length, 1, 'une seule alerte in-app pour une seule clôture');
    });

    test('le partenaire propriétaire clôture la caisse d’un contrôleur : 200, closed_by = partenaire', async () => {
        const c = await newCashier('cl-par-partenaire');
        const res = await closeByRoute(partner, { shiftId: c.shiftId, declaredCashTotal: c.expected });
        assert.equal(res.status, 200, `clôture par le partenaire propriétaire : ${show(res)}`);
        const s = await closedState(c.shiftId);
        assert.equal(s.status, 'CLOTURE', 'caisse CLOTURE');
        assert.equal(s.closedBy, partner.userId, 'closed_by = partenaire propriétaire');
    });

    test('un admin clôture avec écart justifié et PIN : 200, closed_by = admin', async () => {
        const c = await newCashier('cl-par-admin');
        const res = await closeByRoute(admin, { shiftId: c.shiftId, declaredCashTotal: c.expected + 1000, justification: JUSTIFICATION, regisseurPin: pin });
        assert.equal(res.status, 200, `clôture par un admin : ${show(res)}`);
        const s = await closedState(c.shiftId);
        assert.equal(s.status, 'CLOTURE', 'caisse CLOTURE');
        assert.equal(s.difference, 1000, 'écart = déclaré − attendu');
        assert.equal(s.closedBy, admin.userId, 'closed_by = admin');
    });

    test('garde-fou : le contrôleur d’une autre caisse du même événement est refusé (403 ou 404), caisse OUVERT', async () => {
        const target = await newCashier('cl-cible');
        const intruder = await newCashier('cl-intrus');
        const res = await closeByRoute(intruder.ctrl, { shiftId: target.shiftId, declaredCashTotal: target.expected });
        assert.ok([403, 404].includes(res.status), `clôture de la caisse d’un autre contrôleur : ${show(res)}`);
        await assertStillOpen(target.shiftId, 'caisse d’un autre contrôleur');
    });
});

// ── RPC shift_close ────────────────────────────────────────────────────────

interface RpcReply { data: Row | null; error: { message: string; code?: string } | null }

async function shiftCloseRpc(p: Row): Promise<RpcReply> {
    const { data, error } = await service.rpc('shift_close', { p });
    return { data: (data ?? null) as Row | null, error };
}

describe('C2 — RPC shift_close', () => {
    test('catalogue : SECURITY DEFINER, search_path = public, service_role seul', async () => {
        const rows = await inspect(async (db) => (await db.query<{ secdef: boolean; config: string[] | null; anon: boolean; auth: boolean }>(
            `SELECT p.prosecdef AS secdef, p.proconfig AS config,
                    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'shift_close'`)).rows);
        assert.ok(rows.length > 0, 'fonction shift_close absente');
        for (const r of rows) {
            assert.equal(r.secdef, true, 'shift_close : SECURITY DEFINER');
            assert.ok((r.config ?? []).some((c) => /^search_path=public$/.test(c)), `shift_close : search_path = public (${JSON.stringify(r.config)})`);
            assert.equal(r.anon, false, 'shift_close : non exécutable par anon');
            assert.equal(r.auth, false, 'shift_close : non exécutable par authenticated');
        }
    });

    test('deux appels simultanés sans écart : un ok, l’autre SHIFT_NOT_OPEN', async () => {
        const c = await newCashier('rpc-double');
        const p = { shift_id: c.shiftId, actor_id: c.ctrl.userId, declared_cash_total: c.expected };
        const replies = await Promise.all([shiftCloseRpc(p), shiftCloseRpc(p)]);
        for (const r of replies) assert.equal(r.error, null, `shift_close : ${r.error?.message} (code ${r.error?.code})`);
        const ok = replies.filter((r) => r.data?.ok === true);
        const refused = replies.filter((r) => r.data?.ok === false);
        assert.equal(ok.length, 1, `une seule clôture acceptée : ${JSON.stringify(replies.map((r) => r.data))}`);
        assert.equal(refused.length, 1, `une clôture refusée : ${JSON.stringify(replies.map((r) => r.data))}`);
        assert.equal(refused[0].data?.code, 'SHIFT_NOT_OPEN', `code du refus : ${JSON.stringify(refused[0].data)}`);
        const s = await closedState(c.shiftId);
        assert.equal(s.status, 'CLOTURE', 'caisse CLOTURE');
        assert.equal(s.closedBy, c.ctrl.userId, 'closed_by = acteur');
    });

    test('montant déclaré non entier ou négatif : refusé, caisse OUVERT', async () => {
        const c = await newCashier('rpc-montant');
        for (const declared of [c.expected + 0.5, -100]) {
            const r = await shiftCloseRpc({ shift_id: c.shiftId, actor_id: c.ctrl.userId, declared_cash_total: declared, justification: JUSTIFICATION });
            assert.equal(r.error, null, `shift_close (${declared}) : refus attendu sous la forme { ok: false }, reçu l’erreur ${r.error?.message} (code ${r.error?.code})`);
            assert.equal(r.data?.ok, false, `montant ${declared} accepté : ${JSON.stringify(r.data)}`);
            await assertStillOpen(c.shiftId, `montant ${declared}`);
        }
    });

    test('acteur sans droit (autre contrôleur) : refusé, caisse OUVERT', async () => {
        const target = await newCashier('rpc-cible');
        const intruder = await newCashier('rpc-intrus');
        const r = await shiftCloseRpc({ shift_id: target.shiftId, actor_id: intruder.ctrl.userId, declared_cash_total: target.expected });
        assert.equal(r.error, null, `shift_close : refus attendu sous la forme { ok: false }, reçu l’erreur ${r.error?.message} (code ${r.error?.code})`);
        assert.equal(r.data?.ok, false, `clôture par un autre contrôleur acceptée : ${JSON.stringify(r.data)}`);
        await assertStillOpen(target.shiftId, 'autre contrôleur');
    });
});
