/**
 * Lot 9 ter, tâche 9t.4 (consigne 0.4, contrat A.3) — retour du client après le paiement.
 *  - En https (production), le cashin direct envoie successUrl et errorUrl, tous deux égaux à
 *    `<NEXT_PUBLIC_APP_URL>/paiement/<id du paiement>` : Wave et Orange Money ramènent le client sur la page de suivi,
 *    qui lit l'état sur le serveur. Même payload à la relance unique (initCashinOnce), donc mêmes adresses.
 *  - En http (CI, essai local), rien n'est envoyé : corps strictement identique à aujourd'hui (cas 1, vert annoncé).
 *  - La décision tient dans une aide pure, cashinReturnUrls(appUrl, paymentId) de lib/payments/cashin-init.ts
 *    (importée dynamiquement : l'export n'existe pas avant fix(9t.4)).
 *  - La page /paiement/[id] ne déduit jamais l'issue de l'adresse (cas 4, vert annoncé, garde).
 * Rouge avant correctif : cas 2 (champs absents des appels du faux SamirPay) et cas 3 (export absent).
 * Écritures : paiements PENDING créés par le checkout et par POST /api/payments/create (abonnement), chacun rendu en
 * fin de cas par payment_release CANCELLED (w17 tenu) ; aucun webhook livré. L'URL de l'application est restaurée
 * dans un finally (et en after()), avec resetServerEnvCache.
 * Fin de suite : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { POST as createPaymentRoute } from '../../app/api/payments/create/route';
import { resetServerEnvCache } from '../../lib/env';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { jsonRequest, newPartner } from './finance-helpers';
import {
    callsOf, cart, checkout, createSaleEvent, importModule, newBuyer, paymentById, service, setFakeMode,
    type SaleEvent,
} from './paiement-helpers';

type Row = Record<string, unknown>;

const HTTPS_APP_URL = 'https://eventvillage.example';
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const PAGE = 'app/paiement/[id]/page.tsx';

let ev: SaleEvent;
let planId: string;

before(async () => {
    setFakeMode('initMode', 'success');
    ev = await createSaleEvent('retour-9ter', [{ name: 'Standard', price: 2_000, total: 40, maxPerOrder: 4 }]);
    const { data, error } = await service.from('subscription_plans').insert({
        code: `TEST-9TER-${randomUUID()}`, name: 'Pack de test (lot 9 ter)', description: 'Plan dédié aux tests du retour après paiement (0.4).',
        price: 15_000, billing_period: 'MONTHLY', features: {}, is_active: true,
    }).select('id').single();
    assert.equal(error, null, `plan d'abonnement : ${error?.message}`);
    planId = String(data.id);
});

after(async () => {
    restoreAppUrl();
    setFakeMode('initMode', 'success');
    await assertLot9terInvariants('paiement-retour-9ter');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function restoreAppUrl(): void {
    if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
    resetServerEnvCache();
}

/** Appels d'initialisation du faux SamirPay pour ce paiement (orderId enregistré avant l'appel). */
async function initArgsOf(paymentId: string): Promise<Row[]> {
    const payment = await paymentById(paymentId);
    assert.ok(payment.external_order_id, `orderId du paiement ${paymentId} enregistré`);
    return callsOf('initDirectPayment').filter((c) => c.args.orderId === payment.external_order_id).map((c) => c.args);
}

/** Paiement rendu en fin de cas : rien ne reste en attente pour les suites suivantes (w17). */
async function release(paymentIds: string[]): Promise<void> {
    for (const id of paymentIds) {
        if ((await paymentById(id)).status !== 'PENDING') continue;
        const { data, error } = await service.rpc('payment_release', { p_payment_id: id, p_status: 'CANCELLED', p_reason: 'TEST_9TER_RETOUR' });
        assert.equal(error, null, `libération du paiement ${id} : ${error?.message}`);
        assert.equal((data as Row | null)?.changed, true, `libération du paiement ${id} : ${JSON.stringify(data)}`);
    }
}

async function ticketCheckout(label: string, created: string[]): Promise<string> {
    const buyer = await newBuyer(`retour-${label}`);
    const r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
    if (typeof r.body.payment_id === 'string') created.push(r.body.payment_id);
    assert.equal(r.status, 200, `checkout ${label} : HTTP ${r.status} ${JSON.stringify(r.body)}`);
    assert.ok(r.payment, `paiement du checkout ${label}`);
    assert.equal(r.payment.status, 'PENDING', `checkout ${label} : paiement en attente`);
    return r.payment.id;
}

async function subscriptionPayment(label: string, created: string[]): Promise<string> {
    const partner = await newPartner(`retour-${label}`);
    const res = await createPaymentRoute(jsonRequest('/api/payments/create', 'POST', partner.accessToken, {
        targetType: 'SUBSCRIPTION', targetId: planId, operator: 'WAVE', payerPhone: partner.phone9,
    }));
    const body = (await res.json()) as Row;
    if (typeof body.payment_id === 'string') created.push(body.payment_id);
    assert.equal(res.status, 201, `paiement d'abonnement ${label} : HTTP ${res.status} ${JSON.stringify(body)}`);
    assert.equal((await paymentById(String(body.payment_id))).status, 'PENDING', `abonnement ${label} : paiement en attente`);
    return String(body.payment_id);
}

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('0.4 — retour du client après le paiement (lot 9 ter, 9t.4)', () => {
    test('http (CI) : checkout de billets et paiement d’abonnement sans successUrl ni errorUrl', async () => {
        assert.match(String(process.env.NEXT_PUBLIC_APP_URL), /^http:\/\//, `précondition : URL de l’application en http (${process.env.NEXT_PUBLIC_APP_URL})`);
        const created: string[] = [];
        try {
            for (const id of [await ticketCheckout('http-billets', created), await subscriptionPayment('http-abo', created)]) {
                const calls = await initArgsOf(id);
                assert.equal(calls.length, 1, `un appel d'initialisation pour le paiement ${id} : ${calls.length}`);
                for (const args of calls) {
                    assert.equal('successUrl' in args, false, `http : successUrl envoyé (${JSON.stringify(args)})`);
                    assert.equal('errorUrl' in args, false, `http : errorUrl envoyé (${JSON.stringify(args)})`);
                }
            }
        } finally {
            await release(created);
        }
    });

    test('https : les deux URL vers /paiement/<id du paiement>, aussi à la relance unique', async () => {
        const created: string[] = [];
        process.env.NEXT_PUBLIC_APP_URL = HTTPS_APP_URL;
        resetServerEnvCache();
        try {
            const tickets = await ticketCheckout('https-billets', created);
            const subscription = await subscriptionPayment('https-abo', created);
            setFakeMode('initMode', 'timeout-once');
            let retried: string;
            try {
                retried = await ticketCheckout('https-relance', created);
            } finally {
                setFakeMode('initMode', 'success');
            }
            for (const [label, id, expectedCalls] of [['billets', tickets, 1], ['abonnement', subscription, 1], ['relance unique', retried, 2]] as const) {
                const calls = await initArgsOf(id);
                assert.equal(calls.length, expectedCalls, `${label} : nombre d'appels d'initialisation (${calls.length})`);
                const expected = `${HTTPS_APP_URL}/paiement/${id}`;
                for (const [i, args] of calls.entries()) {
                    assert.deepEqual({ successUrl: args.successUrl, errorUrl: args.errorUrl }, { successUrl: expected, errorUrl: expected },
                        `${label}, appel ${i + 1} : successUrl et errorUrl vers la page de suivi du paiement (aujourd’hui absents)`);
                    assert.match(String(args.callBackUrl), /^https:\/\/eventvillage\.example\/api\/webhooks\/samirpay\?t=/, `${label} : callBackUrl inchangée dans sa forme`);
                }
            }
        } finally {
            restoreAppUrl();
            await release(created);
        }
    });

    test('cashinReturnUrls : http → {} ; https avec barre finale → une seule barre ; valeur illisible → {}', async () => {
        const mod = await importModule('../../lib/payments/cashin-init');
        assert.equal(typeof mod.cashinReturnUrls, 'function', 'cashinReturnUrls absente de lib/payments/cashin-init.ts : livrée par fix(9t.4)');
        const id = randomUUID();
        assert.deepEqual(mod.cashinReturnUrls('http://127.0.0.1:3000', id), {}, 'http : aucune adresse de retour');
        assert.deepEqual(mod.cashinReturnUrls('https://eventvillage.example/', id),
            { successUrl: `https://eventvillage.example/paiement/${id}`, errorUrl: `https://eventvillage.example/paiement/${id}` }, 'https, barre finale : une seule barre');
        assert.deepEqual(mod.cashinReturnUrls('https://eventvillage.example', id),
            { successUrl: `https://eventvillage.example/paiement/${id}`, errorUrl: `https://eventvillage.example/paiement/${id}` }, 'https sans barre finale');
        assert.deepEqual(mod.cashinReturnUrls('pas une url', id), {}, 'valeur illisible : aucune adresse de retour');
    });

    test('la page /paiement/[id] ne déduit jamais l’issue de l’URL', () => {
        const file = path.join(process.cwd(), ...PAGE.split('/'));
        assert.ok(fs.existsSync(file), `${PAGE} absent : le contrôle ne prouverait rien`);
        const raw = fs.readFileSync(file, 'utf8');
        const code = stripComments(raw);
        const found: string[] = [];
        code.split(/\r?\n/).forEach((line, i) => {
            for (const token of ['useSearchParams', 'searchParams', 'location.search', 'location.hash', 'URLSearchParams']) {
                if (line.includes(token)) found.push(`${PAGE}:${i + 1} ${token}`);
            }
        });
        assert.deepEqual(found, [], `la page lit l’adresse :\n${found.join('\n')}`);
        assert.ok(code.includes('/api/payments/${id}/status'), `${PAGE} doit lire l’issue sur le serveur (/api/payments/\${id}/status)`);
    });
});
