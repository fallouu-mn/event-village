/**
 * Lot 2.10 — retour de paiement côté client (client-ux-7).
 * Le cashin direct n'a pas d'URL de retour dans le contrat SamirPay : l'interface renvoie le client
 * vers /paiement/[id], page qui sonde la route de statut (En attente / Confirmé / Échoué) puis
 * renvoie vers le billet. Les URL fournies par le client ne sont plus transmises. Annulation par le
 * client : endpoint qui libère la réservation. Délai d'attente aligné sur l'échéance de la
 * réservation ; libellé de l'opérateur dynamique.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertPaymentInvariants } from '../helpers/payment-invariants';
import { cart, checkout, createSaleEvent, initCalls, newBuyer, SaleEvent } from './paiement-helpers';

let ev: SaleEvent;

before(async () => {
    ev = await createSaleEvent('retour', [{ name: 'Standard', price: 1000, total: 10 }]);
});

after(async () => {
    await assertPaymentInvariants('paiement-retour');
});

describe('Retour de paiement côté client', () => {
    test('réponse du checkout : page de suivi /paiement/<id>, échéance ; URL du client ignorées', async () => {
        const b = await newBuyer('retour');
        const body = { ...cart(ev.eventId, [[ev.categories.Standard.id, 1]], b), returnUrl: 'https://piege.example/ok', cancelUrl: 'https://piege.example/ko' };
        const r = await checkout(b, body);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.status_page_url, `/paiement/${r.payment!.id}`);
        assert.ok(r.body.expires_at, 'échéance de la réservation');
        const call = initCalls().find((c) => c.orderId === r.payment!.external_order_id)!;
        assert.ok(!JSON.stringify(call.args).includes('piege.example'), 'URL du client non transmises à SamirPay');
    });

    test('page /paiement/[id] : sonde la route de statut, affiche les trois états, renvoie vers le billet, permet l’annulation', () => {
        const page = fs.readFileSync('app/paiement/[id]/page.tsx', 'utf8');
        assert.match(page, /\/api\/payments\/\$\{[^}]+\}\/status/, 'sondage de la route de statut');
        assert.match(page, /En attente/);
        assert.match(page, /Confirmé/);
        assert.match(page, /Échoué/);
        assert.match(page, /\/tickets/, 'lien vers le billet');
        assert.match(page, /\/cancel/, 'annulation par le client');
        assert.match(page, /expires_at/, 'délai aligné sur l’échéance de la réservation');
        assert.match(page, /operatorLabel|OPERATOR_LABELS/, 'libellé de l’opérateur dynamique');
    });

    test('modale de paiement : délai aligné sur l’échéance, renvoi vers /paiement/[id], clé d’idempotence', () => {
        const modal = fs.readFileSync('components/payment/PaymentModal.tsx', 'utf8');
        assert.doesNotMatch(modal, /MAX_POLL|3\s*\*\s*60\s*\*\s*1000/, 'plus de délai fixe de 3 minutes');
        assert.match(modal, /status_page_url|\/paiement\//, 'renvoi vers la page de suivi');
        assert.match(modal, /Idempotency-Key/i, 'clé d’idempotence envoyée');
    });
});
