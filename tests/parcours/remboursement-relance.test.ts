/**
 * Lot 8, tâche 8.2 v — relance d'un remboursement par un administrateur, POST /api/admin/refunds/[id]/retry
 * (EventCancellationService.retryRefund, lib/events/event-cancellation.service.ts:186-215). Cas T5 de
 * tests/legacy/event-cancellation-and-refunds.test.ts (tableau 12.1, ligne 15), RÉÉCRIT sur `cashouts` : le legacy
 * visait l'ancien modèle `refunds` seul ; securite-admin-lot7:311 ne teste que les 403 et 404.
 *  1. ECHOUE (refus de SamirPay) : remis à envoyer, envoyé une seconde fois, CONFIRME, refund PROCESSED, billet
 *     REMBOURSE, audit REFUND_RETRY ; 2 envois comptés sur le numéro du payeur ;
 *  2. ECHOUE, nouveau refus : réponse d'échec, ECHOUE et FAILED, un audit ;
 *  3. SOLDE_INSUFFISANT : débloqué et rebloqué tant que le solde manque (aucun envoi), puis envoyé une fois le solde
 *     revenu ;
 *  4. INCERTAIN : refusé, aucun envoi, aucun audit, statut inchangé (l'argent a pu partir) ;
 *  5. déjà CONFIRME : rien à faire, aucun envoi, aucun audit.
 * Les envois sont comptés par numéro de payeur neuf, jamais globalement.
 *
 * Annoncée verte dès l'écriture (port, section 12.1) : tout rouge est une anomalie à instruire (8.3 d). Suite verte
 * à l'écriture : assertTerrainInvariants, pas assertRecetteInvariants (Conventions). L'administrateur de la suite
 * est suspendu en fin de suite (il ne reçoit plus d'alertes, comme securite-admin-lot7).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { POST as retryRoute } from '../../app/api/admin/refunds/[id]/retry/route';
import { CashoutService } from '../../lib/payments/cashout.service';
import { callsOf, fakePay, newBuyer, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, createPartnerEvent, newPartner, type TestPartner } from './finance-helpers';
import { authed, ticketRow, type RouteResult } from './acces-helpers';
import { assertTerrainInvariants, newAdminWith } from './terrain-helpers';
import type { TestAdmin } from './notif-helpers';

type Row = Record<string, unknown>;

interface Refundable { buyer: Buyer; ticketId: string; cashoutId: string; refundId: string }

const FULL_BALANCE = 10_000_000;

let partner: TestPartner;
let ev: SaleEvent;
let admin: TestAdmin;

before(async () => {
    partner = await newPartner('relance');
    ev = await createPartnerEvent(partner.partnerId, 'relance', [{ name: 'Standard', price: 5000, total: 20 }]);
    admin = await newAdminWith(['refunds.manage'], { label: 'relance' });
});

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = FULL_BALANCE;
    const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', admin.userId).eq('status', 'ACTIF');
    assert.equal(error, null, `suspension de l’administrateur de la suite : ${error?.message}`);
    await assertTerrainInvariants('remboursement-relance');
});

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`;
}

/** Billet payé par un acheteur neuf, remboursement demandé : cashout A_ENVOYER, pas encore envoyé. */
async function refundable(label: string): Promise<Refundable> {
    const buyer = await newBuyer(`relance-${label}`);
    const { tickets } = await buyConfirmed(buyer, ev, [['Standard', 1]]);
    const ticketId = String(tickets[0].id);
    const out = await CashoutService.requestTicketRefund({ ticketId, actorId: partner.userId, reason: `Relance ${label} (lot 8)` });
    assert.equal(out.ok, true, `remboursement refusé : ${JSON.stringify(out)}`);
    assert.equal(out.mode, 'CASHOUT', 'billet payé en ligne : versement');
    const cashout = out.cashout!;
    assert.equal(cashout.status, 'A_ENVOYER', 'précondition : à envoyer');
    assert.equal(cashout.blocked_reason, null, 'précondition : aucun blocage');
    const row = await cashoutRow(cashout.id);
    assert.ok(row.refund_id, 'précondition : cashout rattaché à son remboursement');
    return { buyer, ticketId, cashoutId: cashout.id, refundId: String(row.refund_id) };
}

async function cashoutRow(id: string): Promise<Row> {
    const { data, error } = await service.from('cashouts').select('*').eq('id', id).single();
    assert.equal(error, null, `cashout ${id} : ${error?.message}`);
    return data as Row;
}

async function refundStatus(id: string): Promise<unknown> {
    const { data, error } = await service.from('refunds').select('status').eq('id', id).single();
    assert.equal(error, null, `remboursement ${id} : ${error?.message}`);
    return data.status;
}

async function retryAudits(cashoutId: string): Promise<Row[]> {
    const { data, error } = await service.from('audit_logs').select('*').eq('action', 'REFUND_RETRY').eq('object_id', cashoutId).order('created_at');
    assert.equal(error, null, `journal REFUND_RETRY : ${error?.message}`);
    return (data ?? []) as Row[];
}

function auditDetail(audit: Row): Row {
    const m = (audit.metadata ?? {}) as Row;
    return { refund_id: m.refund_id, previous_status: m.previous_status, blocked_reason: m.blocked_reason };
}

/** Envois de versement vers le numéro de ce payeur (faux SamirPay). */
function sendsTo(buyer: Buyer): number {
    return callsOf('sendCashout').filter((c) => c.args.phoneNumber === buyer.phone9).length;
}

async function retry(refundId: string): Promise<RouteResult> {
    const res = await retryRoute(authed(`/api/admin/refunds/${refundId}/retry`, 'POST', admin), { params: { id: refundId } });
    return { status: res.status, body: await res.json() as Row };
}

async function failedRefund(label: string): Promise<Refundable> {
    const r = await refundable(label);
    setFakeMode('cashoutMode', 'rejected');
    try {
        assert.equal((await CashoutService.send(r.cashoutId)).status, 'ECHOUE', 'précondition : refus de SamirPay');
    } finally {
        setFakeMode('cashoutMode', 'success');
    }
    assert.equal(await refundStatus(r.refundId), 'FAILED', 'précondition : remboursement FAILED');
    return r;
}

describe('8.2 v — POST /api/admin/refunds/[id]/retry (cas T5 réécrit sur cashouts)', () => {
    test('ECHOUE : remis à envoyer puis envoyé, CONFIRME, billet REMBOURSE, audit REFUND_RETRY', async () => {
        const r = await failedRefund('echoue');
        assert.equal(sendsTo(r.buyer), 1, 'un premier envoi refusé');
        const res = await retry(r.refundId);
        assert.equal(res.status, 200, show(res));
        assert.deepEqual({ success: res.body.success, refundId: res.body.refundId, status: res.body.status },
            { success: true, refundId: r.refundId, status: 'PROCESSED' }, show(res));
        assert.equal(sendsTo(r.buyer), 2, 'un second envoi, et un seul');
        const row = await cashoutRow(r.cashoutId);
        assert.equal(row.status, 'CONFIRME', 'versement confirmé');
        assert.equal(row.last_error, null, 'erreur précédente effacée');
        assert.equal(await refundStatus(r.refundId), 'PROCESSED', 'remboursement traité');
        assert.equal((await ticketRow(r.ticketId)).status, 'REMBOURSE', 'billet remboursé');
        const audits = await retryAudits(r.cashoutId);
        assert.equal(audits.length, 1, 'une ligne de journal REFUND_RETRY');
        assert.equal(audits[0].user_id, admin.userId, 'journal au nom de l’administrateur');
        assert.equal(audits[0].object_type, 'cashouts', 'objet journalisé');
        assert.deepEqual(auditDetail(audits[0]), { refund_id: r.refundId, previous_status: 'ECHOUE', blocked_reason: null }, 'détail du journal');
    });

    test('ECHOUE puis nouveau refus de SamirPay : réponse d’échec, ECHOUE et FAILED, un audit', async () => {
        const r = await failedRefund('echoue-encore');
        setFakeMode('cashoutMode', 'rejected');
        let res: RouteResult;
        try {
            res = await retry(r.refundId);
        } finally {
            setFakeMode('cashoutMode', 'success');
        }
        assert.equal(res.status, 200, show(res));
        assert.deepEqual({ success: res.body.success, status: res.body.status }, { success: false, status: 'FAILED' }, show(res));
        assert.equal(sendsTo(r.buyer), 2, 'deux envois, tous deux refusés');
        assert.equal((await cashoutRow(r.cashoutId)).status, 'ECHOUE', 'toujours en échec');
        assert.equal(await refundStatus(r.refundId), 'FAILED', 'remboursement de nouveau FAILED');
        assert.equal((await ticketRow(r.ticketId)).status, 'REMBOURSEMENT_EN_COURS', 'billet inchangé');
        assert.equal((await retryAudits(r.cashoutId)).length, 1, 'la tentative est journalisée');
    });

    test('SOLDE_INSUFFISANT : rebloqué sans envoi tant que le solde manque, envoyé une fois le solde revenu', async () => {
        const r = await refundable('solde');
        fakePay().balance = 0;
        try {
            assert.equal((await CashoutService.send(r.cashoutId)).skipped, 'SOLDE_INSUFFISANT', 'précondition : envoi bloqué par le solde');
            assert.equal((await cashoutRow(r.cashoutId)).blocked_reason, 'SOLDE_INSUFFISANT', 'précondition : motif de blocage');
            const still = await retry(r.refundId);
            assert.equal(still.status, 200, show(still));
            assert.deepEqual({ success: still.body.success, status: still.body.status }, { success: false, status: 'FAILED' }, show(still));
            const row = await cashoutRow(r.cashoutId);
            assert.deepEqual({ status: row.status, blocked: row.blocked_reason }, { status: 'A_ENVOYER', blocked: 'SOLDE_INSUFFISANT' }, 'rebloqué par le solde');
            assert.equal(sendsTo(r.buyer), 0, 'aucun envoi tant que le solde manque');
        } finally {
            fakePay().balance = FULL_BALANCE;
        }
        const res = await retry(r.refundId);
        assert.equal(res.status, 200, show(res));
        assert.deepEqual({ success: res.body.success, status: res.body.status }, { success: true, status: 'PROCESSED' }, show(res));
        const sent = await cashoutRow(r.cashoutId);
        assert.deepEqual({ status: sent.status, blocked: sent.blocked_reason }, { status: 'CONFIRME', blocked: null }, 'débloqué et confirmé');
        assert.equal(sendsTo(r.buyer), 1, 'un seul envoi');
        assert.equal((await ticketRow(r.ticketId)).status, 'REMBOURSE', 'billet remboursé');
        const audits = await retryAudits(r.cashoutId);
        assert.equal(audits.length, 2, 'une ligne de journal par relance');
        for (const audit of audits) {
            assert.deepEqual(auditDetail(audit), { refund_id: r.refundId, previous_status: 'A_ENVOYER', blocked_reason: 'SOLDE_INSUFFISANT' }, 'détail du journal');
        }
    });

    test('INCERTAIN : refusé, aucun envoi, aucun audit, statut inchangé', async () => {
        const r = await refundable('incertain');
        setFakeMode('cashoutMode', 'timeout');
        try {
            assert.equal((await CashoutService.send(r.cashoutId)).status, 'INCERTAIN', 'précondition : issue incertaine');
        } finally {
            setFakeMode('cashoutMode', 'success');
        }
        assert.equal(sendsTo(r.buyer), 1, 'précondition : un envoi d’issue inconnue');
        const res = await retry(r.refundId);
        assert.equal(res.status, 200, show(res));
        assert.deepEqual({ success: res.body.success, status: res.body.status }, { success: false, status: 'FAILED' }, show(res));
        assert.match(String(res.body.message), /Issue incertaine/, show(res));
        assert.equal(sendsTo(r.buyer), 1, 'aucun nouvel envoi : l’argent a pu partir');
        assert.equal((await cashoutRow(r.cashoutId)).status, 'INCERTAIN', 'statut inchangé');
        assert.equal(await refundStatus(r.refundId), 'PENDING', 'remboursement inchangé');
        assert.deepEqual(await retryAudits(r.cashoutId), [], 'aucune relance journalisée');
    });

    test('déjà CONFIRME : rien à faire, aucun envoi, aucun audit', async () => {
        const r = await refundable('confirme');
        assert.equal((await CashoutService.send(r.cashoutId)).status, 'CONFIRME', 'précondition : versement confirmé');
        const row = await cashoutRow(r.cashoutId);
        const res = await retry(r.refundId);
        assert.equal(res.status, 200, show(res));
        assert.deepEqual({ success: res.body.success, status: res.body.status, transactionId: res.body.transactionId },
            { success: true, status: 'PROCESSED', transactionId: row.samirpay_transaction_id }, show(res));
        assert.equal(res.body.message, 'Remboursement déjà envoyé.', show(res));
        assert.equal(sendsTo(r.buyer), 1, 'aucun nouvel envoi');
        assert.deepEqual(await retryAudits(r.cashoutId), [], 'aucune relance journalisée');
    });
});
