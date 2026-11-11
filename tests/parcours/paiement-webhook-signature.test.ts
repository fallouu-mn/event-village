/**
 * Lot 9 bis, tâche H3 — signature du webhook SamirPay (consigne H3 ; contrat 5.56, 4.5, B104 ; découverte
 * 9bis/discovery-9bis-samirpay.md section 4). En-tête X-SamirPay-Signature `t=<secondes>,v1=<hex>` : HMAC-SHA256 du
 * secret entier (préfixe whsec_ compris) sur `t + "." + corps brut`, écart de 5 minutes au plus, plusieurs v1 admis.
 * Faux SamirPay de tests/fakes (buildWebhook({ secret, t?, extraV1? })), un paiement neuf par cas.
 *  1. secret défini, aucun en-tête : 401 { received: false }, REJECTED_SIGNATURE, aucun billet, aucun appel de statut ;
 *  2. v1 faux → 401 ; 3. t à −6 et +6 minutes, HMAC juste → 401 ; 4. corps modifié d'un octet après signature → 401 ;
 *  5. deux v1 (l'ancien faux, le nouveau juste) → traité, billets émis ;
 *  6. signature juste, SamirPay encore PENDING → aucun billet (la confirmation par le statut reste obligatoire) ;
 *  7. journal : signature_present vrai, jamais la signature en clair ;
 *  8. secret absent : webhook sans signature traité comme aujourd'hui.
 *
 * Rouge aujourd'hui : aucune vérification (lib/payments/webhook.service.ts:4, SAMIRPAY_WEBHOOK_SECRET non lue,
 * lib/env.ts:42-44) : 1 à 4 répondent 200 et émettent les billets ; 7 : aucun signature_present.
 * Verts dès l'écriture (signalés) : 5 et 8 (non-régression : la signature est ignorée aujourd'hui) et 6 (garde du
 * statut, déjà là). Leurs garde-fous : 1 à 4, même montage, refusés après le correctif.
 * after() : assertLot9bisInvariants (garde de schéma rouge jusqu'aux migrations du lot).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST as webhookRoute } from '../../app/api/webhooks/samirpay/route';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { BASE_URL } from './helpers';
import {
    callbackUrlFor, callsOf, cart, checkout, createSaleEvent, eventTickets, fakePay, newBuyer, paymentById, providerSays, setFakeMode, service,
    type PaymentRow, type SaleEvent,
} from './paiement-helpers';
import { withEnv } from './notif-helpers';

type Row = Record<string, unknown>;

/** Secret de test fabriqué à chaque exécution (jamais un secret réel) : préfixe whsec_ de la v1.2. */
const SECRET = `whsec_${randomBytes(24).toString('hex')}`;
const SIX_MINUTES = 6 * 60;

let ev: SaleEvent;

before(async () => {
    setFakeMode('initMode', 'success');
    ev = await createSaleEvent('webhook-signature', [{ name: 'Standard', price: 2_000, total: 60, maxPerOrder: 5 }]);
});

after(async () => {
    await assertLot9bisInvariants('paiement-webhook-signature');
});

interface Built { url: string; body: string; headers: Record<string, string> }

/** Paiement PENDING neuf, que SamirPay dit payé (le faux ne bâtit un webhook que pour un succès). */
async function paidPayment(label: string): Promise<PaymentRow> {
    const buyer = await newBuyer(`sig-${label}`);
    const r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
    assert.equal(r.status, 200, `checkout : HTTP ${r.status} ${JSON.stringify(r.body)}`);
    providerSays(r.payment!, 'SUCCESS');
    return r.payment!;
}

/** Webhook que SamirPay enverrait, signé par le faux (buildWebhook({ secret, t?, extraV1? }), T14). */
function signedHook(payment: PaymentRow, opts: { secret?: string; t?: number; extraV1?: string } | null): Built {
    const fake = fakePay();
    if (opts === null) {
        const raw = fake.buildWebhook(payment.external_transaction_id) as Built;
        return { url: callbackUrlFor(payment.external_order_id!), body: raw.body, headers: { 'content-type': 'application/x-www-form-urlencoded' } };
    }
    const built = fake.buildWebhook(payment.external_transaction_id, { secret: opts.secret ?? SECRET, t: opts.t, extraV1: opts.extraV1 }) as Built;
    assert.match(String(built.headers['x-samirpay-signature'] ?? ''), /^t=\d+,(v1=[0-9a-f]{64},?)+$/, `précondition : en-tête signé par le faux (T14) : ${JSON.stringify(built.headers)}`);
    return { url: callbackUrlFor(payment.external_order_id!), body: built.body, headers: built.headers };
}

async function post(hook: Built, overrides: { headers?: Record<string, string | null>; body?: string } = {}): Promise<{ status: number; body: Row }> {
    const headers: Record<string, string> = { ...hook.headers };
    for (const [k, v] of Object.entries(overrides.headers ?? {})) {
        if (v === null) delete headers[k];
        else headers[k] = v;
    }
    const res = await webhookRoute(new NextRequest(new URL(hook.url, BASE_URL).toString(), { method: 'POST', headers, body: overrides.body ?? hook.body }));
    return { status: res.status, body: (await res.json()) as Row };
}

async function eventsOf(payment: PaymentRow): Promise<Row[]> {
    const { data, error } = await service.from('payment_webhook_events').select('result, headers, raw_body').eq('order_id', payment.external_order_id!);
    assert.equal(error, null, `journal des webhooks : ${error?.message}`);
    return (data ?? []) as Row[];
}

function statusChecks(payment: PaymentRow): number {
    return callsOf('checkTransactionStatus').filter((c) => c.args.transactionId === payment.external_transaction_id).length;
}

async function ticketsOf(payment: PaymentRow): Promise<number> {
    return (await eventTickets(ev.eventId)).filter((t) => t.payment_id === payment.id).length;
}

/** Refus attendu : 401 { received: false }, REJECTED_SIGNATURE au journal, aucun billet, aucun appel de statut. */
async function assertRejected(payment: PaymentRow, res: { status: number; body: Row }, checksBefore: number, what: string): Promise<void> {
    assert.deepEqual({ status: res.status, body: res.body }, { status: 401, body: { received: false } }, `${what} : 401 (aujourd’hui 200, signature ignorée)`);
    assert.ok((await eventsOf(payment)).some((e) => e.result === 'REJECTED_SIGNATURE'), `${what} : REJECTED_SIGNATURE au journal`);
    assert.equal(await ticketsOf(payment), 0, `${what} : aucun billet`);
    assert.equal(statusChecks(payment), checksBefore, `${what} : aucune lecture du paiement chez SamirPay`);
    assert.equal((await paymentById(payment.id)).status, 'PENDING', `${what} : paiement inchangé`);
}

const withSecret = <T>(fn: () => Promise<T>): Promise<T> => withEnv({ SAMIRPAY_WEBHOOK_SECRET: SECRET }, fn);

describe('H3 — webhook signé : vérification quand SAMIRPAY_WEBHOOK_SECRET est défini (B104)', () => {
    test('1. secret défini, aucun en-tête de signature : 401, REJECTED_SIGNATURE, aucun billet, aucun appel de statut', async () => {
        const p = await paidPayment('absente');
        const hook = signedHook(p, {});
        const checks = statusChecks(p);
        const res = await withSecret(() => post(hook, { headers: { 'x-samirpay-signature': null } }));
        await assertRejected(p, res, checks, 'signature absente');
    });

    test('2. v1 faux : 401', async () => {
        const p = await paidPayment('fausse');
        const hook = signedHook(p, { secret: `whsec_${randomBytes(24).toString('hex')}` });
        const checks = statusChecks(p);
        await assertRejected(p, await withSecret(() => post(hook)), checks, 'v1 calculé avec un autre secret');
    });

    test('3. t à 6 minutes dans le passé ou dans le futur, HMAC juste : 401', async () => {
        for (const shift of [-SIX_MINUTES, SIX_MINUTES]) {
            const p = await paidPayment(`perimee${shift}`);
            const hook = signedHook(p, { t: Math.floor(Date.now() / 1000) + shift });
            const checks = statusChecks(p);
            await assertRejected(p, await withSecret(() => post(hook)), checks, `t décalé de ${shift} s`);
        }
    });

    test('4. corps modifié d’un octet après la signature : 401', async () => {
        const p = await paidPayment('corps');
        const hook = signedHook(p, {});
        const checks = statusChecks(p);
        // Un « & » final ne change aucun champ (URLSearchParams l'ignore) : seule la signature peut refuser.
        await assertRejected(p, await withSecret(() => post(hook, { body: `${hook.body}&` })), checks, 'corps modifié d’un octet');
    });

    test('5. deux v1 (l’ancien faux, le nouveau juste, renouvellement du secret) : traité, billet émis', async () => {
        const p = await paidPayment('deux-v1');
        const hook = signedHook(p, { extraV1: randomBytes(32).toString('hex') });
        const res = await withSecret(() => post(hook));
        assert.equal(res.status, 200, `webhook signé pendant un renouvellement : ${JSON.stringify(res.body)}`);
        assert.equal((await paymentById(p.id)).status, 'SUCCESS', 'paiement confirmé');
        assert.equal(await ticketsOf(p), 1, 'billet émis');
    });

    test('6. signature juste mais SamirPay encore PENDING : aucun billet (la confirmation par le statut reste obligatoire)', async () => {
        const p = await paidPayment('statut');
        const hook = signedHook(p, {});
        providerSays(p, 'PENDING');
        const res = await withSecret(() => post(hook));
        assert.equal(res.status, 200, `webhook signé accepté : ${JSON.stringify(res.body)}`);
        assert.equal((await paymentById(p.id)).status, 'PENDING', 'paiement toujours en attente : le statut SamirPay décide');
        assert.equal(await ticketsOf(p), 0, 'aucun billet sans statut SUCCESS');
    });

    test('7. journal : signature_present vrai, jamais la signature en clair', async () => {
        const p = await paidPayment('journal');
        const hook = signedHook(p, {});
        assert.equal((await withSecret(() => post(hook))).status, 200, 'webhook signé traité');
        const events = await eventsOf(p);
        assert.ok(events.length > 0, 'webhook journalisé');
        const signature = String(hook.headers['x-samirpay-signature']);
        for (const e of events) {
            assert.equal((e.headers as Row | null)?.signature_present, true, `headers.signature_present (contrat 4.5) : ${JSON.stringify(e.headers)}`);
            assert.equal(JSON.stringify(e).includes(signature.split('v1=')[1]), false, 'la signature n’est jamais conservée en clair');
        }
    });

    test('8. secret absent : un webhook sans signature est traité comme aujourd’hui', async () => {
        const p = await paidPayment('sans-secret');
        const res = await withEnv({ SAMIRPAY_WEBHOOK_SECRET: undefined }, () => post(signedHook(p, null)));
        assert.equal(res.status, 200, `sans secret : ${JSON.stringify(res.body)}`);
        assert.equal((await paymentById(p.id)).status, 'SUCCESS', 'paiement confirmé par le statut SamirPay');
        assert.equal(await ticketsOf(p), 1, 'billet émis');
    });
});
