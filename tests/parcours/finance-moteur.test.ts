/**
 * Lot 3.1 (contrat B) — moteur financier unique (SQL), taux lus dans les réglages.
 *  - finance_compute : exemple de l'Annexe C du CDC (1 000 → client 1 050, agrégateur 15,75,
 *    organisateur 1 000, Event Village 34,25) ; prix 1 250 (service 63, total 1 313, agrégateur 19,70,
 *    net 43,30) ; frais de service arrondis au FCFA supérieur PAR BILLET ; taux de service 0 accepté
 *    (aucun repli) ; taux Wave ≠ Orange Money ; devis sans opérateur ; abonnement ; opérateur inconnu ;
 *  - checkout de bout en bout : montant envoyé à SamirPay = total client ; colonnes persistées
 *    (facial_amount, service_fee, aggregator_fee, partner_payout_amount, net_event_village_revenue,
 *    service_fee_rate, aggregator_fee_rate, operator) ; frais de service recopiés sur les réservations
 *    et les billets ; checkout_create_payment ignore les montants fournis par l'appelant ;
 *  - code : plus de computeTicketingFees ni de lib/payments/fees.ts, plus de taux codés en dur dans
 *    les calculs relevés à la découverte.
 * Rouge avant correctif : le client est débité du prix facial (lib/payments/checkout.service.ts:180,214),
 * frais de service retirés à l'organisateur (lib/payments/fees.ts:38), agrégateur sur le facial
 * (fees.ts:28), arrondi au centime (fees.ts:28,32), montants du corps repris par la RPC
 * (20261031000013_lot2_reservations.sql:166-168), aucun taux persisté.
 * Les montants attendus sont écrits en dur (arrondi décimal de PostgreSQL : 51,195 → 51,20), jamais
 * recalculés en flottant JavaScript.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { buyConfirmed, createPartnerEvent, newPartner, paymentRow, withSettings, type TestPartner } from './finance-helpers';
import { cart, checkout, deliverWebhook, initCalls, newBuyer, paymentById, providerSays, service, type SaleEvent } from './paiement-helpers';

let partner: TestPartner;
let ev: SaleEvent;

before(async () => {
    partner = await newPartner('moteur');
    ev = await createPartnerEvent(partner.partnerId, 'moteur', [
        { name: 'Standard', price: 1000, total: 40 },
        { name: 'VIP', price: 1250, total: 20 },
        { name: 'Impair', price: 1010, total: 20 },
    ]);
});

after(async () => {
    await assertFinanceInvariants('finance-moteur');
});

function num(v: unknown): number | null {
    return v === null || v === undefined ? null : Number(v);
}

function assertAmounts(actual: Record<string, unknown>, expected: Record<string, number | null>, label: string): void {
    for (const [k, v] of Object.entries(expected)) {
        assert.equal(num(actual[k]), v, `${label} : ${k} = ${JSON.stringify(actual[k])}, attendu ${v}`);
    }
}

async function compute(target: string, lines: Array<{ unit_price: number; quantity: number }>, operator: string | null): Promise<Record<string, unknown>> {
    const { data, error } = await service.rpc('finance_compute', { p_target: target, p_lines: lines, p_operator: operator });
    assert.equal(error, null, `finance_compute(${target}) : ${error?.message}`);
    assert.ok(data, 'finance_compute : réponse vide');
    return data as Record<string, unknown>;
}

function lineOf(result: Record<string, unknown>, i: number): Record<string, unknown> {
    const lines = result.lines as Array<Record<string, unknown>> | undefined;
    assert.ok(Array.isArray(lines) && lines[i], `ligne ${i} absente : ${JSON.stringify(result.lines)}`);
    return lines[i];
}

/** Réglages de l'exemple de l'Annexe C (valeurs par défaut du contrat A), restaurés après le test. */
const ANNEXE_C = { 'finance.service_fee_rate': 5, 'finance.aggregator_fee_rate.WAVE': 1.5, 'finance.aggregator_fee_rate.ORANGE_MONEY': 1.5 } as const;

describe('finance_compute (moteur unique)', () => {
    test('Annexe C : 1 000 F (Wave 1,5 %) → client 1 050, agrégateur 15,75, organisateur 1 000, Event Village 34,25', async () => {
        await withSettings(ANNEXE_C, async () => {
            const r = await compute('TICKET', [{ unit_price: 1000, quantity: 1 }], 'WAVE');
            assertAmounts(r, {
                facial_amount: 1000, service_fee: 50, total_amount: 1050, aggregator_fee: 15.75, partner_payout_amount: 1000,
                gross_event_village_revenue: 50, net_event_village_revenue: 34.25, service_fee_rate: 5, aggregator_fee_rate: 1.5,
            }, 'Annexe C');
            assert.equal(r.operator, 'WAVE');
            assertAmounts(lineOf(r, 0), { unit_service_fee: 50, line_facial: 1000, line_service_fee: 50, line_total: 1050 }, 'ligne');
        });
    });

    test('1 250 F → service 63 (FCFA supérieur), total 1 313, agrégateur 19,70, net 43,30', async () => {
        await withSettings(ANNEXE_C, async () => {
            const r = await compute('TICKET', [{ unit_price: 1250, quantity: 1 }], 'WAVE');
            assertAmounts(r, {
                facial_amount: 1250, service_fee: 63, total_amount: 1313, aggregator_fee: 19.7, partner_payout_amount: 1250,
                gross_event_village_revenue: 63, net_event_village_revenue: 43.3,
            }, '1 250 F');
        });
    });

    test('frais de service arrondis au FCFA supérieur par billet ; agrégateur sur le total du panier', async () => {
        await withSettings(ANNEXE_C, async () => {
            // 1 010 × 5 % = 50,5 → 51 par billet, × 3 = 153 (et non ceil(151,5) = 152 sur le panier)
            const odd = await compute('TICKET', [{ unit_price: 1010, quantity: 3 }], 'WAVE');
            assertAmounts(odd, { facial_amount: 3030, service_fee: 153, total_amount: 3183, aggregator_fee: 47.75, net_event_village_revenue: 105.25 }, '3 × 1 010 F');
            assertAmounts(lineOf(odd, 0), { unit_service_fee: 51, line_service_fee: 153 }, 'ligne 3 × 1 010 F');
            // 2 × 1 000 + 1 × 1 250 : service 163, total 3 413, agrégateur 1,5 % × 3 413 = 51,195 → 51,20
            const mixed = await compute('TICKET', [{ unit_price: 1000, quantity: 2 }, { unit_price: 1250, quantity: 1 }], 'ORANGE_MONEY');
            assertAmounts(mixed, { facial_amount: 3250, service_fee: 163, total_amount: 3413, aggregator_fee: 51.2, partner_payout_amount: 3250, net_event_village_revenue: 111.8 }, 'panier mixte');
        });
    });

    test('taux de service à 0 : accepté et appliqué, sans repli à 5 %', async () => {
        await withSettings({ 'finance.service_fee_rate': 0, 'finance.aggregator_fee_rate.WAVE': 1.5 }, async () => {
            const r = await compute('TICKET', [{ unit_price: 1000, quantity: 2 }], 'WAVE');
            // Sans frais de service, Event Village supporte l'agrégateur : net = 0 − 30 (contrat B : net = service − agrégateur)
            assertAmounts(r, {
                facial_amount: 2000, service_fee: 0, total_amount: 2000, aggregator_fee: 30, partner_payout_amount: 2000,
                gross_event_village_revenue: 0, net_event_village_revenue: -30, service_fee_rate: 0,
            }, 'taux 0');
            assertAmounts(lineOf(r, 0), { unit_service_fee: 0 }, 'ligne taux 0');
        });
    });

    test('taux d’agrégateur par opérateur : Wave ≠ Orange Money', async () => {
        await withSettings({ 'finance.service_fee_rate': 5, 'finance.aggregator_fee_rate.WAVE': 1, 'finance.aggregator_fee_rate.ORANGE_MONEY': 2 }, async () => {
            const wave = await compute('TICKET', [{ unit_price: 1000, quantity: 1 }], 'WAVE');
            const om = await compute('TICKET', [{ unit_price: 1000, quantity: 1 }], 'ORANGE_MONEY');
            assertAmounts(wave, { total_amount: 1050, aggregator_fee_rate: 1, aggregator_fee: 10.5, net_event_village_revenue: 39.5 }, 'Wave');
            assertAmounts(om, { total_amount: 1050, aggregator_fee_rate: 2, aggregator_fee: 21, net_event_village_revenue: 29 }, 'Orange Money');
            assert.equal(om.operator, 'ORANGE_MONEY');
        });
    });

    test('devis sans opérateur : total connu, agrégateur et taux d’agrégateur nuls', async () => {
        await withSettings(ANNEXE_C, async () => {
            const r = await compute('TICKET', [{ unit_price: 1000, quantity: 1 }], null);
            assertAmounts(r, { facial_amount: 1000, service_fee: 50, total_amount: 1050, aggregator_fee: null, aggregator_fee_rate: null }, 'devis');
        });
    });

    test('abonnement : pas de frais de service, organisateur 0, brut = facial, net = facial − agrégateur', async () => {
        await withSettings(ANNEXE_C, async () => {
            const r = await compute('SUBSCRIPTION', [{ unit_price: 25000, quantity: 1 }], 'WAVE');
            assertAmounts(r, {
                facial_amount: 25000, service_fee: 0, total_amount: 25000, aggregator_fee: 375, partner_payout_amount: 0,
                gross_event_village_revenue: 25000, net_event_village_revenue: 24625,
            }, 'abonnement');
        });
    });

    test('opérateur inconnu : erreur (aucun taux de repli)', async () => {
        const { error } = await service.rpc('finance_compute', { p_target: 'TICKET', p_lines: [{ unit_price: 1000, quantity: 1 }], p_operator: 'FREE_MONEY' });
        assert.ok(error, 'opérateur sans taux configuré accepté');
    });
});

describe('Checkout de bout en bout (montants du moteur)', () => {
    test('Annexe C par le checkout : SamirPay débite 1 050, colonnes persistées, billet avec ses frais', async () => {
        const b = await newBuyer('moteur-annexe');
        const r = await checkout(b, cart(ev.eventId, [[ev.categories.Standard.id, 1]], b, 'WAVE'));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const call = initCalls().find((c) => c.orderId === r.payment!.external_order_id);
        assert.ok(call, 'appel SamirPay enregistré');
        assert.equal(Number(call.args.amount), 1050, 'montant envoyé à SamirPay = prix + frais de service (débit actuel : prix seul)');
        assert.equal(Number(r.body.amount), 1050, 'montant renvoyé à l’interface');

        const { data: reservations, error: resErr } = await service.from('stock_reservations').select('unit_price, unit_service_fee, quantity').eq('payment_id', r.payment!.id);
        assert.equal(resErr, null, `réservations : ${resErr?.message}`);
        assert.deepEqual((reservations ?? []).map((x) => [Number(x.unit_price), Number(x.unit_service_fee), x.quantity]), [[1000, 50, 1]], 'frais unitaires sur la réservation');

        const { payment, tickets } = await buyConfirmedFrom(b, r.payment!.id);
        assertAmounts(payment, {
            amount: 1050, facial_amount: 1000, service_fee: 50, aggregator_fee: 15.75, partner_payout_amount: 1000,
            gross_event_village_revenue: 50, net_event_village_revenue: 34.25, service_fee_rate: 5, aggregator_fee_rate: 1.5,
        }, 'paiement persisté');
        assert.equal(payment.operator, 'WAVE');
        assert.equal(payment.is_platform_payment, true);
        assert.deepEqual(tickets.map((t) => [Number(t.price), Number(t.service_fee)]), [[1000, 50]], 'billet : prix facial et frais de service');
    });

    test('panier mixte Orange Money : SamirPay débite 3 413, agrégateur 51,20, billets 50 et 63', async () => {
        const b = await newBuyer('moteur-mixte');
        const { payment, tickets } = await buyConfirmed(b, ev, [['Standard', 2], ['VIP', 1]], 'ORANGE_MONEY');
        const call = initCalls().find((c) => c.orderId === payment.external_order_id);
        assert.ok(call, 'appel SamirPay enregistré');
        assert.equal(Number(call.args.amount), 3413, 'montant envoyé à SamirPay = total client');
        assertAmounts(payment, {
            amount: 3413, facial_amount: 3250, service_fee: 163, aggregator_fee: 51.2, partner_payout_amount: 3250,
            gross_event_village_revenue: 163, net_event_village_revenue: 111.8, service_fee_rate: 5, aggregator_fee_rate: 1.5,
        }, 'paiement mixte');
        assert.equal(payment.operator, 'ORANGE_MONEY');
        const pairs = tickets.map((t) => [Number(t.price), Number(t.service_fee)]).sort((x, y) => x[0] - y[0]);
        assert.deepEqual(pairs, [[1000, 50], [1000, 50], [1250, 63]], 'frais de service par billet');
    });

    test('checkout_create_payment ignore les montants fournis par l’appelant', async () => {
        const b = await newBuyer('moteur-forge');
        const id = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
        const { data, error } = await service.rpc('checkout_create_payment', {
            p: {
                client_id: b.userId,
                event_id: ev.eventId,
                partner_id: partner.partnerId,
                items: [{ category_id: ev.categories.Standard.id, quantity: 1, unit_price: 1000 }],
                amount: 1, aggregator_fee: 0, service_fee: 0, gross_revenue: 0, net_revenue: 999, partner_payout: 5,
                operator: 'WAVE',
                payer_phone: b.phone9,
                callback_token_hash: createHash('sha256').update(randomUUID()).digest('hex'),
                client_idempotency_key: randomUUID(),
                transaction_id: `TX-EV-TEST-${id}`,
                external_order_id: `ORD-EV-TEST-${id}`,
                hold_minutes: 15,
                metadata: { target_type: 'TICKET', event_id: ev.eventId, test: 'lot3-montants-ignores' },
            },
        });
        assert.equal(error, null, `checkout_create_payment : ${error?.message}`);
        const created = data as { ok?: boolean; payment_id?: string; amount?: unknown };
        assert.equal(created?.ok, true, JSON.stringify(data));
        try {
            const p = await paymentRow(created.payment_id!);
            assertAmounts(p, { amount: 1050, facial_amount: 1000, service_fee: 50, aggregator_fee: 15.75, partner_payout_amount: 1000, net_event_village_revenue: 34.25 }, 'montants recalculés');
            assert.equal(num(created.amount), 1050, 'la RPC renvoie le montant à débiter');
        } finally {
            const { error: relErr } = await service.rpc('payment_release', { p_payment_id: created.payment_id, p_status: 'CANCELLED', p_reason: 'TEST_LOT3' });
            assert.equal(relErr, null, `libération des réservations : ${relErr?.message}`);
        }
    });
});

/** Confirmation d'un paiement déjà créé par checkout (succès SamirPay puis webhook). */
async function buyConfirmedFrom(b: { userId: string }, paymentId: string): Promise<{ payment: Record<string, unknown>; tickets: Array<Record<string, unknown>> }> {
    const row = await paymentById(paymentId);
    assert.equal(row.client_id, b.userId);
    providerSays(row, 'SUCCESS');
    const hook = await deliverWebhook(row);
    assert.equal(hook.status, 200, 'webhook accepté');
    const payment = await paymentRow(paymentId);
    assert.equal(payment.status, 'SUCCESS', `paiement confirmé (${payment.status})`);
    const { data: tickets, error } = await service.from('tickets').select('*').eq('payment_id', paymentId);
    assert.equal(error, null, `billets : ${error?.message}`);
    return { payment, tickets: (tickets ?? []) as Array<Record<string, unknown>> };
}

// ── Contrôles statiques ────────────────────────────────────────────────────

function read(rel: string): string {
    return fs.readFileSync(rel, 'utf8');
}

function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full, out);
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(full.replace(/\\/g, '/'));
    }
    return out;
}

/** Corps d'une méthode de classe (de sa déclaration à la méthode statique suivante). */
function methodBody(src: string, name: string): string {
    const start = src.search(new RegExp(`static\\s+async\\s+${name}\\s*\\(`));
    assert.ok(start >= 0, `méthode ${name} introuvable`);
    const rest = src.slice(start + 1);
    const next = rest.search(/\n\s{4}(public\s+|private\s+)?static\s/);
    return next < 0 ? rest : rest.slice(0, next);
}

/** Calculs à taux codés en dur relevés à la découverte du lot 3 (fichier:ligne avant correctif). */
const HARDCODED: Array<{ file: string; method?: string; optional?: boolean; pattern: RegExp; what: string }> = [
    { file: 'lib/admin/admin.service.ts', method: 'getFinancialReconciliation', pattern: /\b0\.0(1|15|25)\b|\b6\.5\b/, what: 'agrégateur 1 / 1,5 / 2,5 % et commission 6,5 % (L130-139)' },
    { file: 'app/api/admin/metrics/route.ts', pattern: /platform_commission_rate|evCommissionRate/, what: 'revenu EV = volume × 6,5 % (L29, L53, L60)' },
    { file: 'lib/partner/partner-dashboard.service.ts', pattern: /\|\|\s*(5(\.0)?|1\.5)\s*\)/, what: 'replis || 5.0 / || 1.5 (L219-221)' },
    { file: 'lib/partner/partner-dashboard.service.ts', pattern: /FinancialCalculatorService\.calculate/, what: 'recalcul avec les taux courants (L245, L255, L285)' },
    { file: 'app/api/partner/finance/route.ts', pattern: /FinancialCalculatorService\.calculate/, what: 'recalcul avec les défauts 5 / 1,5 du calculateur (L97-110)' },
    { file: 'app/api/partner/metrics/route.ts', pattern: /FinancialCalculatorService\.calculate/, what: 'recalcul avec ticketing_fee_config et les taux courants (L53, L97-107)' },
    { file: 'lib/orders/order.service.ts', pattern: /FinancialCalculatorService\.calculate/, what: 'commission commande au taux par défaut de 5 % (L144)' },
    { file: 'lib/payments/financial-calculator.service.ts', optional: true, pattern: /!==\s*undefined\s*\?\s*params\.\w+\s*:\s*\d/, what: 'défauts 5 / 1,5 / 30 / 1 / 5000 (L61-62, L100-101, L136-137, L165-166)' },
    { file: 'app/partner/finance/page.tsx', pattern: /\*\s*0\.01\b|1\.5\s*%/, what: 'frais de retrait × 0,01 (L117), libellé « Frais agrégateur 1.5% » (L320)' },
    { file: 'app/wallet/page.tsx', pattern: /\*\s*0\.01\b/, what: 'frais de retrait × 0,01 (L133)' },
    { file: 'lib/payments/withdrawal.service.ts', pattern: /[<>]=?\s*5000\b/, what: 'seuil de retrait 5 000 codé (L36)' },
];

describe('Code : un seul moteur, aucun taux codé en dur', () => {
    test('plus de computeTicketingFees ni de lib/payments/fees.ts', () => {
        assert.equal(fs.existsSync('lib/payments/fees.ts'), false, 'lib/payments/fees.ts existe encore');
        const offenders = ['app', 'lib', 'components']
            .flatMap((d) => walk(d))
            .filter((f) => /computeTicketingFees|payments\/fees['"]|from ['"]\.\/fees['"]/.test(read(f)));
        assert.deepEqual(offenders, [], `références à l’ancien calcul :\n${offenders.join('\n')}`);
    });

    test('aucun taux de frais, de commission ou de retrait codé en dur dans les calculs relevés', () => {
        const offenders: string[] = [];
        for (const h of HARDCODED) {
            if (!fs.existsSync(h.file)) {
                if (!h.optional) offenders.push(`${h.file} : fichier introuvable (contrôle à mettre à jour)`);
                continue;
            }
            const src = h.method ? methodBody(read(h.file), h.method) : read(h.file);
            if (h.pattern.test(src)) offenders.push(`${h.file}${h.method ? `#${h.method}` : ''} : ${h.what}`);
        }
        assert.deepEqual(offenders, [], `taux codés en dur :\n${offenders.join('\n')}`);
    });

    test('l’ancienne clé ticketing_fee_config n’est plus lue par le code', () => {
        const offenders = ['app', 'lib'].flatMap((d) => walk(d)).filter((f) => read(f).includes('ticketing_fee_config'));
        assert.deepEqual(offenders, [], `lecture de ticketing_fee_config (remplacée par finance.*) :\n${offenders.join('\n')}`);
    });
});
