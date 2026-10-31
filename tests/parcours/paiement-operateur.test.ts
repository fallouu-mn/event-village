/**
 * Complément lot 2 — moyens de paiement (cashin).
 * Le client choisit obligatoirement Wave ou Orange Money ; operatorName et le téléphone payeur
 * (9 chiffres) sont envoyés à SamirPay (cashin direct) et persistés sur la ligne payments. Libellés
 * de l'interface adaptés à l'opérateur ; option carte bancaire retirée tant qu'elle n'est pas
 * intégrée.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertPaymentInvariants } from '../helpers/payment-invariants';
import { cart, checkout, createSaleEvent, initCalls, newBuyer, paymentById, pollStatus, SaleEvent } from './paiement-helpers';

let ev: SaleEvent;

before(async () => {
    ev = await createSaleEvent('operateur', [{ name: 'Standard', price: 4000, total: 20 }]);
});

after(async () => {
    await assertPaymentInvariants('paiement-operateur');
});

describe('Opérateur de paiement', () => {
    for (const operator of ['WAVE', 'ORANGE_MONEY'] as const) {
        test(`${operator} : opérateur et téléphone payeur corrects en base, dans l’appel SamirPay et pour l’interface`, async () => {
            const b = await newBuyer(`op-${operator.toLowerCase()}`);
            const r = await checkout(b, cart(ev.eventId, [[ev.categories.Standard.id, 1]], b, operator));
            assert.equal(r.status, 200, JSON.stringify(r.body));
            const p = await paymentById(r.payment!.id);
            assert.equal(p.operator, operator, 'opérateur en base');
            assert.equal(p.payer_phone, b.phone9, 'téléphone payeur en base (9 chiffres)');
            const call = initCalls().find((c) => c.orderId === p.external_order_id)!;
            assert.equal(call.args.operatorName, operator, 'opérateur envoyé à SamirPay');
            assert.equal(call.args.telephone, b.phone9, 'téléphone envoyé à SamirPay (9 chiffres)');
            assert.equal(String(call.args.amount), '4000', 'montant envoyé en chaîne');
            assert.ok(String(call.args.callBackUrl).includes('/api/webhooks/samirpay?t='), 'callBackUrl avec jeton');
            assert.equal(r.body.operator, operator, 'opérateur renvoyé à l’interface');
            assert.equal((await pollStatus(b.accessToken, p.id)).body.operator, operator, 'opérateur exposé par la route de statut');
        });
    }

    test('interface : choix Wave / Orange Money obligatoire, aucune option carte, libellés selon l’opérateur', () => {
        const modal = fs.readFileSync('components/payment/PaymentModal.tsx', 'utf8');
        assert.doesNotMatch(modal, /['"]card['"]|Carte\s+Bancaire|CARD/i, 'aucune option carte bancaire');
        assert.match(modal, /ORANGE_MONEY/);
        assert.match(modal, /WAVE/);
        const labels = modal.match(/Orange Money/g) ?? [];
        assert.ok(labels.length <= 2, `« Orange Money » n'est plus codé en dur dans les messages (${labels.length} occurrences)`);
        assert.match(modal, /operatorLabel|OPERATOR_LABELS/, 'libellé dérivé de l’opérateur choisi');
        const schemas = fs.readFileSync('lib/validations/payment.ts', 'utf8');
        assert.doesNotMatch(schemas, /['"]CARD['"]/, 'schémas Zod sans carte bancaire');
    });
});
