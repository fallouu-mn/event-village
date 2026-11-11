/**
 * Lot 8, tâche 8.2 v, puis lot 9 bis, tâche 1 (T17, B3, B4, X18) — « Renvoyer » un versement par un administrateur :
 * POST /api/admin/cashouts/[id]/resend avec une justification (contrat 4.1). La route refunds/[id]/retry est
 * supprimée (B4) ; ses cas sont migrés ici, assertion par assertion. Cas T5 de tests/legacy/event-cancellation-and-
 * refunds.test.ts (tableau 12.1, ligne 15), réécrit sur `cashouts`.
 *  1. ECHOUE (refus 400 de SamirPay, rien n'est parti) : renvoyé, CONFIRME, refund PROCESSED, billet REMBOURSE,
 *     audit CASHOUT_RESENT avec la justification, statut ECHOUE précédent tracé par trg_audit_cashouts (M04) ;
 *     2 envois comptés sur le numéro du payeur ;
 *  2. ECHOUE, nouveau refus : { ok: false, status: ECHOUE }, refund FAILED, un audit ;
 *  3. SOLDE_INSUFFISANT : rebloqué tant que le solde manque (aucun envoi), puis envoyé une fois le solde revenu ;
 *     un audit par décision ;
 *  4. INCERTAIN sans identifiant SamirPay : 409 NOT_RESENDABLE (texte du contrat), aucun envoi, aucun audit (B2) ;
 *  5. déjà CONFIRME : 409 ALREADY_FINAL, aucun envoi, aucun audit (écart tranché : code de « Marquer versé »).
 * Les envois sont comptés par numéro de payeur neuf, jamais globalement.
 *
 * Rouge jusqu'à fix(9b.1) (S-V) : route absente, importée dynamiquement. L'audit est désormais écrit par
 * cashout_admin_decide dans la transaction de la décision (« un audit » exigé, comme avant). Suite existante :
 * assertTerrainInvariants gardé. L'administrateur de la suite est suspendu en fin de suite.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import { CashoutService } from '../../lib/payments/cashout.service';
import { callsOf, fakePay, importModule, newBuyer, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, createPartnerEvent, newPartner, type TestPartner } from './finance-helpers';
import { authed, ticketRow, type RouteResult } from './acces-helpers';
import { assertTerrainInvariants, newAdminWith } from './terrain-helpers';
import type { TestAdmin } from './notif-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx: { params: Promise<{ id: string }> & { id: string } }) => Promise<Response>;

interface Refundable { buyer: Buyer; ticketId: string; cashoutId: string; refundId: string }

const FULL_BALANCE = 10_000_000;
const RESEND_ROUTE = '../../app/api/admin/cashouts/[id]/resend/route';
/** Justification de la décision (10 à 500 caractères, contrat 4.1). */
const REASON = 'Refus de l’opérateur levé, nouvel essai (test du lot 9 bis)';
/** Refus d'un renvoi quand rien ne prouve que l'argent n'est pas parti (contrat 4.1, mot pour mot). */
const NOT_RESENDABLE_TEXT = 'Ce versement ne peut pas être renvoyé : rien ne prouve qu’il n’est pas parti. Vérifiez auprès du support SamirPay, puis marquez-le versé s’il l’est.';

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
    const { data, error } = await service.from('audit_logs').select('*').eq('action', 'CASHOUT_RESENT').eq('object_id', cashoutId).order('created_at');
    assert.equal(error, null, `journal CASHOUT_RESENT : ${error?.message}`);
    return (data ?? []) as Row[];
}

/** Justification journalisée par cashout_admin_decide (metadata.reason, invariant w2). */
function auditDetail(audit: Row): Row {
    const m = (audit.metadata ?? {}) as Row;
    return { reason: m.reason, object_type: audit.object_type, user_id: audit.user_id };
}

/** Traces de trg_audit_cashouts (M04) : ancienne et nouvelle ligne du versement à chaque changement. */
async function statusTrail(cashoutId: string): Promise<Array<{ from: unknown; to: unknown; blockedBefore: unknown }>> {
    const { data, error } = await service.from('audit_logs').select('old_value, new_value, created_at').eq('object_type', 'cashouts').eq('action', 'UPDATE').eq('object_id', cashoutId).order('created_at');
    assert.equal(error, null, `traces de trg_audit_cashouts : ${error?.message}`);
    return (data ?? []).map((a) => ({ from: (a.old_value as Row | null)?.status, to: (a.new_value as Row | null)?.status, blockedBefore: (a.old_value as Row | null)?.blocked_reason }));
}

/** Envois de versement vers le numéro de ce payeur (faux SamirPay). */
function sendsTo(buyer: Buyer): number {
    return callsOf('sendCashout').filter((c) => c.args.phoneNumber === buyer.phone9).length;
}

/** « Renvoyer » (contrat 4.1) : route importée dynamiquement, absente avant fix(9b.1). */
async function retry(cashoutId: string): Promise<RouteResult> {
    let mod: { POST?: Handler };
    try {
        mod = await importModule(RESEND_ROUTE);
    } catch (err) {
        assert.fail(`POST /api/admin/cashouts/[id]/resend absente : app/api/admin/cashouts/[id]/resend/route.ts (contrat 4.1, B4, fix(9b.1)) — ${String((err as Error).message).split('\n')[0]}`);
    }
    assert.equal(typeof mod.POST, 'function', 'app/api/admin/cashouts/[id]/resend/route.ts : POST non exporté');
    const res = await mod.POST!(authed(`/api/admin/cashouts/${cashoutId}/resend`, 'POST', admin, { reason: REASON }), { params: Object.assign(Promise.resolve({ id: cashoutId }), { id: cashoutId }) });
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

describe('8.2 v, 9 bis tâche 1 — POST /api/admin/cashouts/[id]/resend (cas T5 réécrit sur cashouts)', () => {
    test('ECHOUE : remis à envoyer puis envoyé, CONFIRME, billet REMBOURSE, audit CASHOUT_RESENT', async () => {
        const r = await failedRefund('echoue');
        assert.equal(sendsTo(r.buyer), 1, 'un premier envoi refusé');
        const res = await retry(r.cashoutId);
        assert.equal(res.status, 200, show(res));
        assert.deepEqual({ ok: res.body.ok, status: res.body.status }, { ok: true, status: 'CONFIRME' }, show(res));
        assert.equal(sendsTo(r.buyer), 2, 'un second envoi, et un seul');
        const row = await cashoutRow(r.cashoutId);
        assert.equal(row.status, 'CONFIRME', 'versement confirmé');
        assert.equal(row.last_error, null, 'erreur précédente effacée');
        assert.equal(await refundStatus(r.refundId), 'PROCESSED', 'remboursement traité');
        assert.equal((await ticketRow(r.ticketId)).status, 'REMBOURSE', 'billet remboursé');
        const audits = await retryAudits(r.cashoutId);
        assert.equal(audits.length, 1, 'une ligne de journal CASHOUT_RESENT (X18)');
        assert.equal(audits[0].user_id, admin.userId, 'journal au nom de l’administrateur');
        assert.equal(audits[0].object_type, 'cashouts', 'objet journalisé');
        assert.deepEqual(auditDetail(audits[0]), { reason: REASON, object_type: 'cashouts', user_id: admin.userId }, 'détail du journal : justification');
        assert.ok((await statusTrail(r.cashoutId)).some((t) => t.from === 'ECHOUE'), 'statut précédent ECHOUE tracé par trg_audit_cashouts');
    });

    test('ECHOUE puis nouveau refus de SamirPay : réponse d’échec, ECHOUE et FAILED, un audit', async () => {
        const r = await failedRefund('echoue-encore');
        setFakeMode('cashoutMode', 'rejected');
        let res: RouteResult;
        try {
            res = await retry(r.cashoutId);
        } finally {
            setFakeMode('cashoutMode', 'success');
        }
        assert.equal(res.status, 200, show(res));
        assert.deepEqual({ ok: res.body.ok, status: res.body.status }, { ok: false, status: 'ECHOUE' }, show(res));
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
            const still = await retry(r.cashoutId);
            assert.equal(still.status, 200, show(still));
            assert.deepEqual({ ok: still.body.ok, status: still.body.status }, { ok: false, status: 'A_ENVOYER' }, show(still));
            const row = await cashoutRow(r.cashoutId);
            assert.deepEqual({ status: row.status, blocked: row.blocked_reason }, { status: 'A_ENVOYER', blocked: 'SOLDE_INSUFFISANT' }, 'rebloqué par le solde');
            assert.equal(sendsTo(r.buyer), 0, 'aucun envoi tant que le solde manque');
        } finally {
            fakePay().balance = FULL_BALANCE;
        }
        const res = await retry(r.cashoutId);
        assert.equal(res.status, 200, show(res));
        assert.deepEqual({ ok: res.body.ok, status: res.body.status }, { ok: true, status: 'CONFIRME' }, show(res));
        const sent = await cashoutRow(r.cashoutId);
        assert.deepEqual({ status: sent.status, blocked: sent.blocked_reason }, { status: 'CONFIRME', blocked: null }, 'débloqué et confirmé');
        assert.equal(sendsTo(r.buyer), 1, 'un seul envoi');
        assert.equal((await ticketRow(r.ticketId)).status, 'REMBOURSE', 'billet remboursé');
        const audits = await retryAudits(r.cashoutId);
        assert.equal(audits.length, 2, 'une ligne de journal par relance');
        for (const audit of audits) {
            assert.deepEqual(auditDetail(audit), { reason: REASON, object_type: 'cashouts', user_id: admin.userId }, 'détail du journal');
        }
        assert.ok((await statusTrail(r.cashoutId)).some((t) => t.from === 'A_ENVOYER' && t.blockedBefore === 'SOLDE_INSUFFISANT'), 'blocage SOLDE_INSUFFISANT précédent tracé par trg_audit_cashouts');
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
        const res = await retry(r.cashoutId);
        assert.equal(res.status, 409, show(res));
        assert.deepEqual({ code: res.body.code, error: res.body.error }, { code: 'NOT_RESENDABLE', error: NOT_RESENDABLE_TEXT }, show(res));
        assert.equal(sendsTo(r.buyer), 1, 'aucun nouvel envoi : l’argent a pu partir');
        assert.equal((await cashoutRow(r.cashoutId)).status, 'INCERTAIN', 'statut inchangé');
        assert.equal(await refundStatus(r.refundId), 'PENDING', 'remboursement inchangé');
        assert.deepEqual(await retryAudits(r.cashoutId), [], 'aucune relance journalisée');
    });

    test('déjà CONFIRME : rien à faire, aucun envoi, aucun audit', async () => {
        const r = await refundable('confirme');
        assert.equal((await CashoutService.send(r.cashoutId)).status, 'CONFIRME', 'précondition : versement confirmé');
        const row = await cashoutRow(r.cashoutId);
        const res = await retry(r.cashoutId);
        assert.equal(res.status, 409, show(res));
        assert.equal(res.body.code, 'ALREADY_FINAL', show(res));
        assert.equal(typeof res.body.error, 'string', `refus en français : ${show(res)}`);
        const still = await cashoutRow(r.cashoutId);
        assert.deepEqual({ status: still.status, tx: still.samirpay_transaction_id }, { status: 'CONFIRME', tx: row.samirpay_transaction_id }, 'versement inchangé');
        assert.equal(sendsTo(r.buyer), 1, 'aucun nouvel envoi');
        assert.deepEqual(await retryAudits(r.cashoutId), [], 'aucune relance journalisée');
    });
});
