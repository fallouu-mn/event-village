/**
 * Contre-vérification de la finition 3d, attaque 4 — espèces marquées rendues par un admin
 * (POST /api/admin/events/[id]/cash-refunds/[paymentId] ; event_cash_refund_mark_admin).
 *  a. Sans refunds.manage (events.read et events.write) ; compte admin suspendu : refus, rien d'écrit.
 *  b. Motif absent, blanc, trop court, trop long (501 caractères) : refus, rien d'écrit.
 *  c. Paiement d'un autre événement ; événement non annulé : refus, rien d'écrit.
 *  d. Déjà marqué par l'organisatrice, puis par un autre admin : la marque d'origine reste (auteur, motif), aucun second
 *     avis, aucun second journal.
 *  e. Trois marquages en parallèle (deux admins) : une seule marque, un seul journal, un seul avis.
 *  f. Montant et client inchangeables : champs en plus refusés ; après un marquage, la ligne du paiement est identique.
 * Sortie brute `[CVF3D-4]`.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertFinition3dInvariants } from '../helpers/finition3d-invariants';
import { authed, createTimedEvent, newController } from '../parcours/acces-helpers';
import { assertRpcOk, eventStatus, rpcCancel } from '../parcours/cycle-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { newAdmin } from '../parcours/notif-helpers';
import { service, type Buyer, type SaleEvent } from '../parcours/paiement-helpers';
import { invoke, routeHandler, show as showRoute } from '../parcours/pilotage-helpers';
import { call, show, type Reply, type Row, type TestAdmin } from './cvf3d-helpers';

const PRICE = 3_000;
const PIN_ROUTE = '../../app/api/partner/events/[id]/regisseur-pin/route';
const OPEN_ROUTE = '../../app/api/controller/shifts/open/route';
const COUNTER_ROUTE = '../../app/api/controller/counter-sale/route';

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

/** Recopie de f3d-suppleance (lot9bis-guichet-annulation) : caisse OUVERT du vendeur, PIN régisseur de la propriétaire. */
async function openShiftWithPin(owner: TestPartner, seller: Buyer, eventId: string): Promise<string> {
    const pinHandler = await routeHandler(PIN_ROUTE, 'POST', 'POST /api/partner/events/[id]/regisseur-pin');
    const pinRes = await invoke(pinHandler, authed(`/api/partner/events/${eventId}/regisseur-pin`, 'POST', owner, { confirm: true }), ctx({ id: eventId }));
    assert.equal(pinRes.status, 200, `PIN régisseur (montage) : ${showRoute(pinRes)}`);
    const pin = String(pinRes.body.pin ?? '');
    const openHandler = await routeHandler(OPEN_ROUTE, 'POST', 'POST /api/controller/shifts/open');
    const res = await invoke(openHandler, authed('/api/controller/shifts/open', 'POST', seller, {
        eventId, event_id: eventId, openingFloat: 0, opening_float_amount: 0, pin, regisseurPin: pin, regisseur_pin: pin,
    }));
    assert.equal(res.status, 200, `ouverture de la caisse (montage) : ${showRoute(res)}`);
    const { data, error } = await service.from('controller_shifts').select('id').eq('controller_id', seller.userId).eq('event_id', eventId).eq('status', 'OUVERT');
    assert.equal(error, null, error?.message);
    return String(data![0].id);
}

interface CashCase { owner: TestPartner; ev: SaleEvent; sales: Row[] }

/** Événement de la propriétaire, `count` ventes au guichet d'un billet, puis annulation si `cancel`. */
async function eventWithCashSales(label: string, count: number, cancel = true): Promise<CashCase> {
    const owner = await newPartner(`cvf3d4-${label}`);
    const ev = await createTimedEvent(owner.partnerId, `cvf3d4-${label}`, [{ name: 'Standard', price: PRICE, total: 30 }]);
    const seller = await newController(owner, ev.eventId, { canAcceptCash: true, label: `cvf3d4-${label}` });
    const shiftId = await openShiftWithPin(owner, seller, ev.eventId);
    const counter = await routeHandler(COUNTER_ROUTE, 'POST', 'POST /api/controller/counter-sale');
    for (let i = 0; i < count; i += 1) {
        const res = await invoke(counter, authed('/api/controller/counter-sale', 'POST', seller,
            { eventId: ev.eventId, items: [{ categoryId: ev.categories.Standard.id, quantity: 1 }] }, { 'idempotency-key': randomUUID() }));
        assert.equal(res.status, 200, `vente au guichet (montage) : ${showRoute(res)}`);
    }
    const { data: sales, error } = await service.from('payments').select('*').eq('shift_id', shiftId).order('created_at');
    assert.equal(error, null, error?.message);
    assert.equal((sales ?? []).length, count, 'ventes au guichet (montage)');
    if (cancel) {
        const { data: title } = await service.from('events').select('title').eq('id', ev.eventId).single();
        assertRpcOk(await rpcCancel(ev.eventId, owner.userId, {
            publicNotice: 'Événement annulé : les espèces sont rendues à la billetterie.',
            internalReason: 'Annulation de la contre-vérification 3d (espèces)',
            confirmTitle: String(title?.title),
        }), 'annulation par la propriétaire (montage)');
        assert.equal(await eventStatus(ev.eventId), 'ANNULE');
    }
    return { owner, ev, sales: (sales ?? []) as Row[] };
}

const mark = (admin: Pick<TestAdmin, 'accessToken'>, eventId: string, paymentId: string, body: unknown): Promise<Reply> =>
    call('POST', 'admin/events/[id]/cash-refunds/[paymentId]', {
        token: admin.accessToken, path: `/api/admin/events/${eventId}/cash-refunds/${paymentId}`, params: { id: eventId, paymentId }, body,
    });

const ownerMark = (owner: TestPartner, eventId: string, paymentId: string): Promise<Reply> =>
    call('POST', 'partner/events/[id]/cash-refunds/[paymentId]', {
        token: owner.accessToken, path: `/api/partner/events/${eventId}/cash-refunds/${paymentId}`, params: { id: eventId, paymentId },
        body: { note: 'Rendu par l\'organisatrice' },
    });

async function marksOf(paymentId: string): Promise<Row[]> {
    const { data, error } = await service.from('event_cash_refund_marks').select('payment_id, marked_by, note, marked_at').eq('payment_id', paymentId);
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

async function adminJournal(paymentId: string): Promise<number> {
    const { data, error } = await service.from('audit_logs').select('metadata').eq('action', 'CASH_REFUND_MARKED').eq('object_id', paymentId);
    assert.equal(error, null, error?.message);
    return (data ?? []).filter((r) => (r.metadata as Row | null)?.by_admin === true).length;
}

async function noticeGroups(paymentId: string): Promise<{ groups: number; rows: number }> {
    const { data, error } = await service.from('notification_outbox').select('group_key').eq('group_key', `CASH_REFUND_MARKED_BY_ADMIN:${paymentId}`);
    assert.equal(error, null, error?.message);
    return { groups: new Set((data ?? []).map((r) => String(r.group_key))).size, rows: (data ?? []).length };
}

let A: CashCase;
let refunder: TestAdmin;

after(async () => {
    await assertFinition3dInvariants('cvf3d-4-especes');
});

describe('4. qui marque, et avec quel motif', () => {
    test('a. sans refunds.manage, ou compte suspendu : 403, rien d\'écrit', async () => {
        A = await eventWithCashSales('a', 4);
        refunder = await newAdmin('cvf3d4-refunder', ['refunds.manage', 'events.read']);
        const writer = await newAdmin('cvf3d4-writer', ['events.read', 'events.write']);
        const suspended = await newAdmin('cvf3d4-suspendu', ['refunds.manage', 'events.read']);
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspended.userId);
        assert.equal(error, null, error?.message);
        const pid = String(A.sales[0].id);
        const r1 = await mark(writer, A.ev.eventId, pid, { reason: 'Espèces rendues au guichet' });
        const r2 = await mark(suspended, A.ev.eventId, pid, { reason: 'Espèces rendues au guichet' });
        console.log(`[CVF3D-4a] events.write sans refunds.manage : ${show(r1)} ; compte suspendu : ${show(r2)} ; marques : ${(await marksOf(pid)).length}`);
        assert.equal(r1.status, 403, show(r1));
        assert.equal(r2.status, 403, show(r2));
        assert.equal((await marksOf(pid)).length, 0);
        assert.equal(await adminJournal(pid), 0);
        assert.equal((await noticeGroups(pid)).rows, 0);
    });

    test('b. motif absent, blanc, trop court, trop long : 400, rien d\'écrit', async () => {
        const pid = String(A.sales[0].id);
        const bodies: unknown[] = [{}, { reason: '   ' }, { reason: 'ab' }, { reason: 'x'.repeat(501) }, { reason: null }, { reason: 12345 }];
        const replies: Reply[] = [];
        for (const body of bodies) replies.push(await mark(refunder, A.ev.eventId, pid, body));
        console.log(`[CVF3D-4b] ${replies.map((r) => `${r.status} ${String(r.body.code)}`).join(' | ')} ; marques : ${(await marksOf(pid)).length}`);
        for (const r of replies) assert.equal(r.status, 400, show(r));
        assert.equal((await marksOf(pid)).length, 0);
    });
});

describe('4. sur quoi', () => {
    test('c. paiement d\'un autre événement ; événement non annulé : refus, rien d\'écrit', async () => {
        const B = await eventWithCashSales('c-autre', 1);
        const live = await eventWithCashSales('c-actif', 1, false);
        const foreign = await mark(refunder, A.ev.eventId, String(B.sales[0].id), { reason: 'Espèces rendues au guichet' });
        const notCancelled = await mark(refunder, live.ev.eventId, String(live.sales[0].id), { reason: 'Espèces rendues au guichet' });
        const random = await mark(refunder, A.ev.eventId, randomUUID(), { reason: 'Espèces rendues au guichet' });
        console.log(`[CVF3D-4c] paiement d'un autre événement : ${show(foreign)} ; événement non annulé : ${show(notCancelled)} ; paiement inconnu : ${show(random)}`);
        assert.deepEqual([foreign.status, foreign.body.code], [404, 'PAYMENT_NOT_FOUND'], show(foreign));
        assert.deepEqual([notCancelled.status, notCancelled.body.code], [409, 'EVENT_NOT_CANCELLED'], show(notCancelled));
        assert.equal(random.status, 404, show(random));
        assert.equal((await marksOf(String(B.sales[0].id))).length, 0);
        assert.equal((await marksOf(String(live.sales[0].id))).length, 0);
    });

    test('d. déjà marqué (par l\'organisatrice, puis par un autre admin) : marque d\'origine gardée, aucun second avis ni journal', async () => {
        const p1 = String(A.sales[1].id);
        const byOwner = await ownerMark(A.owner, A.ev.eventId, p1);
        const before1 = await marksOf(p1);
        const overOwner = await mark(refunder, A.ev.eventId, p1, { reason: 'Je repasse derrière l\'organisatrice' });
        const after1 = await marksOf(p1);
        const p2 = String(A.sales[2].id);
        const other = await newAdmin('cvf3d4-autre', ['refunds.manage']);
        const firstAdmin = await mark(refunder, A.ev.eventId, p2, { reason: 'Rendu au guichet par Awa' });
        const secondAdmin = await mark(other, A.ev.eventId, p2, { reason: 'Motif écrasé ?' });
        const after2 = await marksOf(p2);
        console.log(`[CVF3D-4d] organisatrice : ${show(byOwner)} ; admin ensuite : ${show(overOwner)} ; marque avant/après : ${JSON.stringify(before1)} / ${JSON.stringify(after1)}`);
        console.log(`[CVF3D-4d] premier admin : ${show(firstAdmin)} ; second admin : ${show(secondAdmin)} ; marque : ${JSON.stringify(after2)} ; journal admin : ${await adminJournal(p2)} ; avis : ${JSON.stringify(await noticeGroups(p2))}`);
        assert.equal(byOwner.status, 200, `marquage par l'organisatrice (montage) : ${show(byOwner)}`);
        assert.equal(overOwner.body.code, 'ALREADY_MARKED', show(overOwner));
        assert.deepEqual(after1, before1, 'marque de l\'organisatrice modifiée');
        assert.equal(await adminJournal(p1), 0, 'journal « par un admin » sur la marque de l\'organisatrice');
        assert.equal((await noticeGroups(p1)).rows, 0, 'avis « par l\'administration » sur la marque de l\'organisatrice');
        assert.equal(firstAdmin.status, 200, show(firstAdmin));
        assert.equal(secondAdmin.body.code, 'ALREADY_MARKED', show(secondAdmin));
        assert.equal(after2.length, 1);
        assert.equal(after2[0].marked_by, refunder.userId, 'auteur remplacé');
        assert.equal(after2[0].note, 'Rendu au guichet par Awa', 'motif remplacé');
        assert.equal(await adminJournal(p2), 1, 'un seul journal');
        assert.equal((await noticeGroups(p2)).groups, 1, 'un seul avis');
    });

    test('e. trois marquages en parallèle (deux admins) : une seule marque, un journal, un avis', async () => {
        const D = await eventWithCashSales('e', 2);
        const other = await newAdmin('cvf3d4-e-autre', ['refunds.manage']);
        const pid = String(D.sales[0].id);
        const replies = await Promise.all([
            mark(refunder, D.ev.eventId, pid, { reason: 'Parallèle 1' }),
            mark(refunder, D.ev.eventId, pid, { reason: 'Parallèle 2' }),
            mark(other, D.ev.eventId, pid, { reason: 'Parallèle 3' }),
        ]);
        const created = replies.filter((r) => r.status === 200 && r.body.code === undefined).length;
        const marks = await marksOf(pid);
        const notices = await noticeGroups(pid);
        console.log(`[CVF3D-4e] ${replies.map(show).join(' | ')} ; marques : ${marks.length} ; journal admin : ${await adminJournal(pid)} ; avis : ${JSON.stringify(notices)}`);
        assert.equal(created, 1, 'une seule création');
        assert.equal(marks.length, 1);
        assert.equal(await adminJournal(pid), 1);
        assert.equal(notices.groups, 1);
    });

    test('f. montant et client inchangeables : champs en plus refusés ; ligne du paiement identique après le marquage', async () => {
        const D = await eventWithCashSales('f', 1);
        const pid = String(D.sales[0].id);
        const { data: before, error } = await service.from('payments').select('*').eq('id', pid).single();
        assert.equal(error, null, error?.message);
        const extra = await mark(refunder, D.ev.eventId, pid, {
            reason: 'Espèces rendues', amount: 1, user_id: refunder.userId, buyer_id: refunder.userId, event_id: A.ev.eventId, payment_id: randomUUID(), status: 'REFUNDED',
        });
        const marksAfterExtra = (await marksOf(pid)).length;
        const ok = await mark(refunder, D.ev.eventId, pid, { reason: 'Espèces rendues au guichet' });
        const { data: afterRow, error: e2 } = await service.from('payments').select('*').eq('id', pid).single();
        assert.equal(e2, null, e2?.message);
        const changed = Object.keys(before as Row).filter((k) => JSON.stringify((before as Row)[k]) !== JSON.stringify((afterRow as Row)[k]));
        console.log(`[CVF3D-4f] champs en plus : ${show(extra)} (marques ensuite : ${marksAfterExtra}) ; marquage : ${show(ok)} ; colonnes du paiement changées : ${changed.length === 0 ? 'aucune' : changed.join(', ')}`);
        assert.equal(extra.status, 400, show(extra));
        assert.equal(marksAfterExtra, 0);
        assert.equal(ok.status, 200, show(ok));
        assert.deepEqual(changed, [], `paiement modifié par le marquage : ${changed.join(', ')}`);
    });
});
