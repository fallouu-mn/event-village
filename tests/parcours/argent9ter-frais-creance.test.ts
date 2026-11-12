/**
 * Lot 9 ter, tâche 9t.6 (consigne 0.6, contrat A.4) — risque w19 : frais SamirPay d'un remboursement passé en entier
 * en créance.
 * Un remboursement d'annulation débite la partenaire par fin_ledger_debit ; si son solde total vaut 0, aucune écriture
 * REMBOURSEMENT n'est posée, tout part en créance REMB-<refund>-CREANCE (M/20261101000004:191-208). À la confirmation
 * du versement, cashout_fee_apply (M/20261109000005:80-182) ne trouve pas de date de REMBOURSEMENT et se replie sur
 * GREATEST(now(), max VENTE) (:142-147) ; si un crédit arrivé entre-temps rend le solde suffisant, il écrit
 * CASHOUT_FEE-<versement> au grand livre (:159-165) sans écriture REMBOURSEMENT du même remboursement à la même date :
 * w19 (tests/helpers/lot9bis-invariants.ts:143-151) est violé.
 * Un seul test, pas à pas (A.4.2) ; les étapes 4 (témoin) et 6 (étape fautive) se jouent dans une transaction annulée
 * (aucune violation laissée en base) ; l'étape 7 envoie réellement le versement, frais inconnus (cashoutFeeRate nul
 * toute la suite : FEES_UNKNOWN), pour ne rien laisser à envoyer qu'une autre suite reprendrait.
 * PROUVÉ par lecture, SUPPOSÉ rouge jusqu'au run « avant » : si l'étape 6 reste verte, fix(9t.6) n'est pas écrit et le
 * rapport cite la sortie brute de ce test (contrat A.4.3). Le témoin de l'étape 4 est vert dès l'écriture (annoncé).
 * Fin de suite : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { CashoutService } from '../../lib/payments/cashout.service';
import { SamirPayError } from '../../lib/samirpay/types';
import { inRolledBackTransaction } from '../helpers/db';
import { lot9bisViolations } from '../helpers/lot9bis-invariants';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { buyConfirmed, createPartnerEvent, jsonRequest, ledgerOf, newPartner, withSettings } from './finance-helpers';
import { fakePay, importModule, newBuyer, service, setFakeMode } from './paiement-helpers';

type Row = Record<string, unknown>;

const FULL_BALANCE = 10_000_000;
const PRICE = 10_000;
/** Frais SamirPay fabriqués dans la transaction annulée (1,5 % du remboursement). */
const FEES = 150;
const PARTNER_CANCEL_ROUTE = '../../app/api/partner/events/[id]/cancel/route';

before(() => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = FULL_BALANCE;
    fakePay().cashoutFeeRate = null;
});

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = FULL_BALANCE;
    fakePay().cashoutFeeRate = null;
    await assertLot9terInvariants('argent9ter-frais-creance');
});

// ── Outils ─────────────────────────────────────────────────────────────────

const cents = (x: unknown): number => Math.round(Number(x) * 100);

/** Remplace getSolde du faux par une panne brève le temps de fn (recopié de double-paiement.test.ts:350-362). */
async function withBalanceUnavailable<T>(fn: () => Promise<T>): Promise<T> {
    const fake = fakePay();
    const original = fake.getSolde;
    fake.getSolde = async () => {
        fake.calls.push({ method: 'getSolde', args: { simulated: 'UNAVAILABLE' }, at: new Date().toISOString() });
        throw new SamirPayError('UNCERTAIN', 'Solde SamirPay indisponible (simulation du test)');
    };
    try {
        return await fn();
    } finally {
        fake.getSolde = original;
    }
}

/** Contexte des routes d'annulation, qui lisent `params.id` sans await (patron versements-frais.test.ts:148-150). */
function syncParams<T extends Record<string, string>>(params: T): { params: Promise<T> & T } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

async function ledgerTotal(ownerId: string): Promise<number> {
    return (await ledgerOf(ownerId, 'ORGANISATEUR')).reduce((t, e) => t + cents(e.amount), 0) / 100;
}

async function one(table: string, column: string, value: string): Promise<Row[]> {
    const { data, error } = await service.from(table).select('*').eq(column, value);
    assert.equal(error, null, `${table}.${column} = ${value} : ${error?.message}`);
    return (data ?? []) as Row[];
}

/** Imputation des frais d'un versement : écriture CASHOUT_FEE-<id> et créance CASHOUT_FEE-<id>-CREANCE, lues dans db. */
async function feeBookingIn(db: Client, cashoutId: string): Promise<{ entries: Row[]; debts: Row[] }> {
    const key = `CASHOUT_FEE-${cashoutId}`;
    const entries = (await db.query<Row>('SELECT id, amount, available_at FROM public.finance_ledger WHERE source_key = $1', [key])).rows;
    const debts = (await db.query<Row>('SELECT id, amount FROM public.finance_debts WHERE source_key = $1', [`${key}-CREANCE`])).rows;
    return { entries, debts };
}

/** Ce que fait CashoutService.send d'un versement confirmé (lib/payments/cashout.service.ts:345-346), frais connus. */
async function confirmWithFeesIn(db: Client, cashoutId: string): Promise<void> {
    const tx = randomUUID();
    await db.query(`UPDATE public.cashouts SET status = 'CONFIRME', confirmed_at = now(), sent_at = now(), samirpay_fees = $2,
                           samirpay_transaction_id = $3, provider_status = 'SUCCESS' WHERE id = $1`, [cashoutId, FEES, tx]);
    await db.query('SELECT public.cashout_finalize($1, $2, $3)', [cashoutId, 'CONFIRME', tx]);
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('0.6 — risque w19 : frais d’un remboursement passé en entier en créance (lot 9 ter, 9t.6)', () => {
    test('remboursement entièrement en créance, crédit avant la confirmation du versement : aucune écriture de frais ne viole w19', async () => {
        await withSettings({ 'finance.payout_hold_enabled': false, 'finance.withdrawal_min_amount': 100 }, async () => {
            // 1. Partenaire neuve, E1 (une catégorie à 10 000 F), un billet acheté → VENTE disponible.
            const partner = await newPartner('9ter-frais-creance');
            const e1 = await createPartnerEvent(partner.partnerId, '9ter frais creance E1', [{ name: 'Standard', price: PRICE, total: 10 }]);
            const sale = await buyConfirmed(await newBuyer('9ter-frais-e1'), e1, [['Standard', 1]]);
            const available = await ledgerTotal(partner.userId);
            assert.ok(available > 0 && Number.isInteger(available), `précondition : reversement entier en F CFA (${available})`);

            // 2. Retrait de tout le disponible, envoyé et confirmé → solde total 0 exactement.
            const { data: w, error: wErr } = await service.rpc('withdrawal_request', {
                p: { user_id: partner.userId, account_kind: 'ORGANISATEUR', gross_amount: available, method: 'MOBILE_MONEY', operator: 'WAVE', phone_number: partner.phone9, client_key: randomUUID() },
            });
            assert.equal(wErr, null, `withdrawal_request : ${wErr?.message}`);
            assert.equal((w as Row | null)?.ok, true, `retrait de tout le disponible : ${JSON.stringify(w)}`);
            const sentW = await CashoutService.send(String((w as Row).cashout_id));
            assert.equal(sentW.status, 'CONFIRME', `retrait versé : ${JSON.stringify(sentW)}`);
            assert.equal(await ledgerTotal(partner.userId), 0, 'précondition : grand livre ORGANISATEUR de la partenaire = 0 exactement');

            // 3. Annulation de E1 par la partenaire, solde SamirPay indisponible : le versement reste à envoyer.
            const { data: ev1, error: tErr } = await service.from('events').select('title').eq('id', e1.eventId).single();
            assert.equal(tErr, null, `titre de E1 : ${tErr?.message}`);
            const { POST } = await importModule(PARTNER_CANCEL_ROUTE);
            const res: Response = await withBalanceUnavailable(() => POST(
                jsonRequest(`/api/partner/events/${e1.eventId}/cancel`, 'POST', partner.accessToken, {
                    internalReason: 'Test lot 9 ter : annulation (frais en créance)', publicNotice: 'Événement annulé : les acheteurs sont remboursés.', confirmTitle: String(ev1.title),
                }),
                syncParams({ id: e1.eventId }),
            ));
            assert.equal(res.status, 200, `annulation par la partenaire : HTTP ${res.status} ${await res.text()}`);
            const refunds = await one('refunds', 'payment_id', sale.payment.id);
            assert.equal(refunds.length, 1, `un remboursement pour la vente de E1 : ${JSON.stringify(refunds)}`);
            const refund = refunds[0];
            const debit = Number(refund.facial_part) + (refund.aggregator_fee_bearer === 'ORGANISATEUR' ? Number(refund.aggregator_fee_share) : 0);
            const rembDebts = await one('finance_debts', 'source_key', `REMB-${String(refund.id)}-CREANCE`);
            assert.ok(debit > 0, `précondition : débit du remboursement positif (${debit})`);
            assert.deepEqual(rembDebts.map((d) => cents(d.amount)), [cents(debit)], `précondition : remboursement entièrement en créance, égale au débit : ${JSON.stringify(rembDebts)}`);
            const rembEntries = (await ledgerOf(partner.userId, 'ORGANISATEUR')).filter((e) => e.refund_id === refund.id && e.entry_type === 'REMBOURSEMENT');
            assert.deepEqual(rembEntries, [], 'précondition : aucune écriture REMBOURSEMENT pour ce remboursement');
            const cashouts = await one('cashouts', 'refund_id', String(refund.id));
            assert.equal(cashouts.length, 1, `un versement pour ce remboursement : ${JSON.stringify(cashouts)}`);
            const cashoutId = String(cashouts[0].id);
            assert.deepEqual({ kind: cashouts[0].kind, status: cashouts[0].status, started: cashouts[0].send_started_at },
                { kind: 'EVENT_CANCELLATION_REFUND', status: 'A_ENVOYER', started: null }, 'précondition : versement d’annulation resté à envoyer');

            // Étapes 4 à 6 ; l'étape 7 (envoi réel) se joue en finally : rien n'est laissé à envoyer, même au run « avant ».
            let out: Awaited<ReturnType<typeof CashoutService.send>>;
            try {
                // 4. Témoin (vert annoncé) : confirmation avec frais tant que le solde est nul → frais entièrement en créance.
                const witness = await inRolledBackTransaction(async (db) => {
                    await confirmWithFeesIn(db, cashoutId);
                    const booking = await feeBookingIn(db, cashoutId);
                    const w19 = (await lot9bisViolations(db)).filter((v) => v.regle === 'w19');
                    return { booking, w19 };
                });
                assert.deepEqual(witness.booking.entries, [], `témoin : aucune écriture CASHOUT_FEE-${cashoutId} sur un solde nul`);
                assert.deepEqual(witness.booking.debts.map((d) => cents(d.amount)), [cents(FEES)], 'témoin : frais en créance CASHOUT_FEE-<id>-CREANCE');
                assert.deepEqual(witness.w19, [], 'témoin : aucune violation w19');

                // 5. Crédit : E2, deux billets → la créance du remboursement est compensée, le solde couvre les frais.
                const e2 = await createPartnerEvent(partner.partnerId, '9ter frais creance E2', [{ name: 'Standard', price: PRICE, total: 10 }]);
                await buyConfirmed(await newBuyer('9ter-frais-e2'), e2, [['Standard', 2]]);
                const settled = await one('finance_debts', 'source_key', `REMB-${String(refund.id)}-CREANCE`);
                assert.equal(cents(settled[0]?.remaining), 0, `précondition : créance du remboursement soldée par compensation : ${JSON.stringify(settled)}`);
                const compensations = (await ledgerOf(partner.userId, 'ORGANISATEUR')).filter((e) => e.entry_type === 'COMPENSATION_CREANCE' && e.debt_id === settled[0].id);
                assert.equal(compensations.length > 0, true, 'précondition : écriture COMPENSATION_CREANCE posée');
                const total = await ledgerTotal(partner.userId);
                assert.ok(total >= FEES, `précondition : solde total (${total}) au moins égal aux frais (${FEES})`);

                // 6. Étape fautive : même confirmation qu'en 4, après le crédit.
                const faulty = await inRolledBackTransaction(async (db) => {
                    await confirmWithFeesIn(db, cashoutId);
                    const booking = await feeBookingIn(db, cashoutId);
                    const w19 = (await lot9bisViolations(db)).filter((v) => v.regle === 'w19');
                    return { booking, w19 };
                });
                assert.deepEqual(faulty.w19, [], `w19 violé par l’écriture CASHOUT_FEE-${cashoutId} (repli GREATEST(now(), max VENTE), M/20261109000005:142-147) : ${JSON.stringify(faulty)}`);
                const booked = -faulty.booking.entries.reduce((t, e) => t + cents(e.amount), 0) + faulty.booking.debts.reduce((t, d) => t + cents(d.amount), 0);
                assert.equal(booked, cents(FEES), `frais imputés en entier (écriture + créance) : ${JSON.stringify(faulty.booking)}`);
            } finally {
                // 7. Sortie propre : envoi réel, frais inconnus (cashoutFeeRate nul) → CONFIRME sans imputation.
                out = await CashoutService.send(cashoutId);
            }
            assert.equal(out.status, 'CONFIRME', `versement d’annulation envoyé en fin de cas : ${JSON.stringify(out)}`);
        });
    });
});
