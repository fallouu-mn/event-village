/**
 * Lot 2.7 et complément « moyens de paiement et retraits » — remboursement automatique sûr par un
 * module de cashout commun (payment-security-9).
 *  - opérateur et numéro payeur (9 chiffres) persistés à la création du paiement ; jamais
 *    d'opérateur par défaut ni de numéro de repli : inconnu → en attente, alerte, aucun cashout ;
 *  - machine à états A_ENVOYER → ENVOYE → CONFIRME | ECHOUE | INCERTAIN, clé unique par
 *    paiement (REFUND-<paymentId>) ; INCERTAIN jamais renvoyé automatiquement ;
 *  - solde partenaire vérifié avant l'envoi ;
 *  - remboursements et annulation d'événement passent par ce module (CASH et invitations exclus).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EventCancellationService } from '../../lib/events/event-cancellation.service';
import { loadFixtures } from '../helpers/fixtures';
import { assertPaymentInvariants } from '../helpers/payment-invariants';
import {
    Buyer, callsOf, cart, checkout, createSaleEvent, deliverWebhook, fakePay, importModule, newBuyer, paymentById,
    providerSays, service, setFakeMode,
} from './paiement-helpers';
import { flushNotifications, outboxRows } from './notif-helpers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Cashouts: any;

before(async () => {
    ({ CashoutService: Cashouts } = await importModule('../../lib/payments/cashout.service'));
});

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = 10_000_000;
    await assertPaymentInvariants('paiement-remboursement');
});

/** Paiement encaissé qui ne peut plus être honoré (dernière place vendue entre-temps) → remboursement. */
async function unhonorable(label: string, operator: 'WAVE' | 'ORANGE_MONEY') {
    const ev = await createSaleEvent(`rembourse-${label}`, [{ name: 'Unique', price: 7000, total: 1 }]);
    const cat = ev.categories.Unique.id;
    const buyer = await newBuyer(`r-${label}`, { firstName: 'Fatou', lastName: 'Remboursee' });
    const r = await checkout(buyer, cart(ev.eventId, [[cat, 1]], buyer, operator));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    await service.from('stock_reservations').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('payment_id', r.payment!.id);
    await service.rpc('stock_reservations_expire');
    const rival = await newBuyer(`r-${label}-rival`);
    const r2 = await checkout(rival, cart(ev.eventId, [[cat, 1]], rival));
    providerSays(r2.payment!, 'SUCCESS');
    await deliverWebhook(r2.payment!, { token: 'valid' });
    // Le paiement du premier acheteur aboutit malgré tout chez SamirPay : remboursement.
    providerSays(r.payment!, 'SUCCESS');
    await deliverWebhook(r.payment!, { token: 'valid' });
    return { buyer, payment: r.payment! };
}

/** Paiement à rembourser inséré directement (cas d'un paiement ancien, sans opérateur connu). */
async function insertRefundablePayment(buyer: Buyer, opts: { operator?: string | null; payerPhone?: string | null; amount?: number }) {
    const { data, error } = await service.from('payments').insert({
        transaction_id: `TX-TEST-${randomUUID()}`,
        external_order_id: `ORD-TEST-${randomUUID()}`,
        client_id: buyer.userId,
        payment_target: 'TICKET',
        amount: opts.amount ?? 4000,
        // Lot 5 : répartition explicite d'un paiement plateforme sans frais (invariant (d) du lot 3), qui
        // n'était vérifié par aucune suite exécutée après celle-ci avant le lot 5.
        facial_amount: opts.amount ?? 4000,
        service_fee: 0,
        aggregator_fee: 0,
        partner_payout_amount: opts.amount ?? 4000,
        gross_event_village_revenue: 0,
        net_event_village_revenue: 0,
        currency: 'XOF',
        is_platform_payment: true,
        status: 'REFUND_PENDING',
        operator: opts.operator ?? null,
        payer_phone: opts.payerPhone ?? null,
    }).select('*').single();
    assert.equal(error, null, `paiement de test : ${error?.message}`);
    return data;
}

describe('Remboursement automatique et module de cashout', () => {
    test('payeur Orange Money : remboursement sur Orange Money, au numéro payeur (9 chiffres), prénom et nom', async () => {
        const before0 = callsOf('sendCashout').length;
        const { buyer, payment } = await unhonorable('om', 'ORANGE_MONEY');
        const { data: cashouts } = await service.from('cashouts').select('*').eq('payment_id', payment.id);
        assert.equal(cashouts?.length, 1);
        const c = cashouts![0];
        assert.equal(c.operator, 'ORANGE_MONEY');
        assert.equal(c.phone_number, buyer.phone9);
        assert.equal(c.first_name, 'Fatou');
        assert.equal(c.last_name, 'Remboursee');
        const sent = callsOf('sendCashout').slice(before0);
        assert.equal(sent.length, 1, 'un envoi');
        assert.equal(sent[0].args.operatorName, 'ORANGE_MONEY');
        assert.equal(sent[0].args.phoneNumber, buyer.phone9);
        assert.ok(['ENVOYE', 'CONFIRME'].includes(String((await service.from('cashouts').select('status').eq('id', c.id).single()).data?.status)));
    });

    test('opérateur ou numéro inconnu : aucun cashout envoyé, remboursement en attente, alerte admin', async () => {
        const buyer = await newBuyer('inconnu');
        const p = await insertRefundablePayment(buyer, { operator: null, payerPhone: null });
        const before0 = callsOf('sendCashout').length;
        const c = await Cashouts.requestRefund({ paymentId: p.id, reason: 'test opérateur inconnu' });
        const out = await Cashouts.send(c.id);
        assert.equal(callsOf('sendCashout').length, before0, 'aucun envoi');
        const { data: row } = await service.from('cashouts').select('*').eq('id', c.id).single();
        assert.equal(row?.status, 'A_ENVOYER');
        assert.ok(row?.blocked_reason, `motif de blocage : ${JSON.stringify(out)}`);
        const fx = await loadFixtures();
        // Lot 6 (6.1, J2.2) : l'alerte est mise en file par trg_cashouts_notify (ADMIN_REFUND_TO_RETRY) ;
        // l'envoyeur livre les lignes de ce cashout au SUPERADMIN avant la lecture (assertion inchangée).
        const queued = await outboxRows({ userId: fx.users.SUPERADMIN.id, keyPrefix: `ADMIN_REFUND_TO_RETRY:${c.id}:`, status: 'PENDING' });
        if (queued.length > 0) await flushNotifications({ ids: queued.map((r) => r.id) });
        const { data: alerts } = await service.from('notifications').select('id').eq('user_id', fx.users.SUPERADMIN.id).eq('type', 'CASHOUT_ALERT').contains('metadata', { cashout_id: c.id });
        assert.ok((alerts?.length ?? 0) >= 1, 'alerte admin');
    });

    test('deux envois simultanés pour le même remboursement : un seul cashout', async () => {
        const buyer = await newBuyer('double-envoi');
        const p = await insertRefundablePayment(buyer, { operator: 'WAVE', payerPhone: buyer.phone9 });
        const c = await Cashouts.requestRefund({ paymentId: p.id, reason: 'test concurrence' });
        const again = await Cashouts.requestRefund({ paymentId: p.id, reason: 'test concurrence (bis)' });
        assert.equal(again.id, c.id, 'clé unique par paiement');
        const before0 = callsOf('sendCashout').length;
        await Promise.allSettled([Cashouts.send(c.id), Cashouts.send(c.id)]);
        assert.equal(callsOf('sendCashout').length - before0, 1, 'un seul appel SamirPay');
    });

    test('délai dépassé simulé : INCERTAIN, aucun second envoi, alerte', async () => {
        const buyer = await newBuyer('incertain');
        const p = await insertRefundablePayment(buyer, { operator: 'WAVE', payerPhone: buyer.phone9 });
        const c = await Cashouts.requestRefund({ paymentId: p.id, reason: 'test délai' });
        const before0 = callsOf('sendCashout').length;
        setFakeMode('cashoutMode', 'timeout-after-send');
        try {
            await Cashouts.send(c.id);
            await Cashouts.send(c.id);
        } finally {
            setFakeMode('cashoutMode', 'success');
        }
        assert.equal(callsOf('sendCashout').length - before0, 1, 'aucun renvoi automatique');
        const { data: row } = await service.from('cashouts').select('status').eq('id', c.id).single();
        assert.equal(row?.status, 'INCERTAIN');
        assert.notEqual((await paymentById(p.id)).status, 'REFUNDED');
    });

    test('solde partenaire insuffisant : aucun envoi, alerte', async () => {
        const buyer = await newBuyer('solde');
        const p = await insertRefundablePayment(buyer, { operator: 'ORANGE_MONEY', payerPhone: buyer.phone9, amount: 9000 });
        const c = await Cashouts.requestRefund({ paymentId: p.id, reason: 'test solde' });
        fakePay().balance = 1000;
        const before0 = callsOf('sendCashout').length;
        try {
            await Cashouts.send(c.id);
        } finally {
            fakePay().balance = 10_000_000;
        }
        assert.equal(callsOf('sendCashout').length, before0, 'aucun envoi');
        const { data: row } = await service.from('cashouts').select('status, blocked_reason').eq('id', c.id).single();
        assert.equal(row?.status, 'A_ENVOYER');
        assert.equal(row?.blocked_reason, 'SOLDE_INSUFFISANT');
    });

    test('annulation d’événement : remboursements par le module (REFUND-<paymentId>), CASH et invitations exclus', async () => {
        const fx = await loadFixtures();
        const ev = await createSaleEvent('annulation', [{ name: 'Standard', price: 5000, total: 10 }]);
        const buyer = await newBuyer('annulation', { firstName: 'Ibou', lastName: 'Annule' });
        const r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer, 'ORANGE_MONEY'));
        providerSays(r.payment!, 'SUCCESS');
        await deliverWebhook(r.payment!, { token: 'valid' });
        assert.equal((await paymentById(r.payment!.id)).status, 'SUCCESS');
        const { data: cash, error: cashErr } = await service.from('payments').insert({
            transaction_id: `TX-CASH-TEST-${randomUUID()}`, client_id: buyer.userId, payment_target: 'TICKET', amount: 5000,
            currency: 'XOF', is_platform_payment: false, status: 'SUCCESS', payment_method: 'CASH', metadata: { event_id: ev.eventId },
        }).select('id').single();
        assert.equal(cashErr, null, `paiement espèces : ${cashErr?.message}`);
        const before0 = callsOf('sendCashout').length;
        // Lot 5 (contrat D6) : annulation transactionnelle, titre retapé et avis public obligatoires
        const { data: evRow, error: evErr } = await service.from('events').select('title').eq('id', ev.eventId).single();
        assert.equal(evErr, null, `titre de l’événement : ${evErr?.message}`);
        await EventCancellationService.cancelEvent(ev.eventId, fx.users.SUPERADMIN.id, {
            internalReason: 'Test lot 2 : annulation',
            publicNotice: 'Événement annulé : les acheteurs sont remboursés.',
            confirmTitle: String(evRow.title),
        });
        const { data: cashouts } = await service.from('cashouts').select('*').in('payment_id', [r.payment!.id, cash!.id]);
        assert.equal(cashouts?.length, 1, `un remboursement (paiement plateforme seulement) : ${JSON.stringify(cashouts)}`);
        assert.equal(cashouts![0].idempotency_key, `REFUND-${r.payment!.id}`);
        assert.equal(cashouts![0].operator, 'ORANGE_MONEY');
        const sent = callsOf('sendCashout').slice(before0);
        assert.equal(sent.length, 1);
        assert.equal(sent[0].args.phoneNumber, buyer.phone9);
    });

    test('code : aucun numéro de repli, aucun opérateur par défaut, un seul module d’envoi', () => {
        const offenders: string[] = [];
        // Lot 3 : les retraits passent par le module de cashout, plus aucune exemption
        const allowed = new Set(['lib/payments/cashout.service.ts']);
        const walk = (dir: string) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, e.name);
                const rel = full.replace(/\\/g, '/');
                if (e.isDirectory()) { walk(full); continue; }
                if (!/\.(ts|tsx)$/.test(e.name)) continue;
                const src = fs.readFileSync(full, 'utf8');
                if (src.includes('770000000')) offenders.push(`${rel} : numéro de repli`);
                if (/operator\w*\s*\|\|\s*['"]WAVE['"]|['"]WAVE['"]\s*;\s*\/\/\s*défaut/i.test(src)) offenders.push(`${rel} : opérateur par défaut`);
                if (/\.sendCashout\(/.test(src) && !allowed.has(rel) && !rel.startsWith('lib/samirpay/') && !rel.startsWith('lib/integrations/')) offenders.push(`${rel} : envoi d'argent hors du module`);
            }
        };
        walk('app');
        walk('lib');
        assert.deepEqual(offenders, []);
    });
});
