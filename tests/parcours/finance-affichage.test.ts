/**
 * Lot 3.2 (contrat B) — affichage des frais au client, toujours lu depuis le serveur.
 *  - POST /api/checkout/quote (route publique) : sous-total (prix faciaux), frais de service, total,
 *    détail par ligne ; panier invalide refusé ;
 *  - un seul montant de bout en bout : devis = montant envoyé à SamirPay = payments.amount = montant
 *    de la route de statut, qui expose aussi facial_amount et service_fee ;
 *  - SMS de confirmation d'achat et PDF du billet : frais de service et total payé ;
 *  - code : la page événement et la modale affichent le devis serveur, sans calcul de frais dans le
 *    navigateur ; /paiement/[id] affiche frais de service et total.
 * Rouge avant correctif : aucune route de devis ; le panier est calculé dans le navigateur
 * (app/events/[id]/page.tsx:83, transmis à la modale L747) ; la route de statut n'expose que amount
 * (app/api/payments/[transactionId]/status/route.ts:40-48) ; le SMS client ne donne aucun montant
 * (lib/notifications/notification.service.ts:733-735) ; le PDF n'affiche que le prix du billet
 * (app/api/tickets/[id]/pdf/route.ts:113-114).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NextRequest } from 'next/server';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { getFakes } from '../fakes';
import { BASE_URL, routeContext } from './helpers';
import { GET as ticketPdfRoute } from '../../app/api/tickets/[id]/pdf/route';
import { buyConfirmed, createPartnerEvent, jsonRequest, newPartner, paymentRow, type TestPartner } from './finance-helpers';
import { cart, checkout, importModule, initCalls, newBuyer, pollStatus, type SaleEvent } from './paiement-helpers';
import { flushNotifications, outboxRows } from './notif-helpers';

type Handler = (req: NextRequest) => Promise<Response>;

let quoteRoute: Handler;
let partner: TestPartner;
let ev: SaleEvent;

before(async () => {
    ({ POST: quoteRoute } = await importModule('../../app/api/checkout/quote/route'));
    partner = await newPartner('affichage');
    ev = await createPartnerEvent(partner.partnerId, 'affichage', [
        { name: 'Standard', price: 1000, total: 30 },
        { name: 'VIP', price: 1250, total: 10 },
    ]);
});

after(async () => {
    await assertFinanceInvariants('finance-affichage');
});

interface Quote {
    facial_amount: number;
    service_fee: number;
    total_amount: number;
    lines: Array<Record<string, unknown>>;
    [key: string]: unknown;
}

async function quote(items: Array<[string, number]>, operator?: 'WAVE' | 'ORANGE_MONEY'): Promise<{ status: number; body: Record<string, unknown>; quote: Quote }> {
    const res = await quoteRoute(jsonRequest('/api/checkout/quote', 'POST', null, {
        eventId: ev.eventId,
        items: items.map(([categoryId, quantity]) => ({ categoryId, quantity })),
        ...(operator ? { operator } : {}),
    }));
    const body = (await res.json()) as Record<string, unknown>;
    const q = ((body.quote ?? body) as Quote);
    return { status: res.status, body, quote: q };
}

/** Montant FCFA dans un texte, séparateur de milliers quelconque (espace, espace fine, point) ou absent. */
function money(n: number): RegExp {
    const grouped = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u202F\\u00A0.]?');
    return new RegExp(`(?<![\\w.,])${grouped}(?![\\w,]|\\.\\d)`);
}

/** Textes affichés d'un PDF non compressé (opérandes des opérateurs Tj). */
function pdfTexts(pdf: string): string {
    return Array.from(pdf.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)).map((m) => m[1].replace(/\\([()\\])/g, '$1')).join('\n');
}

describe('Devis serveur : POST /api/checkout/quote', () => {
    test('route publique : sous-total, frais de service (FCFA supérieur par billet), total, détail par ligne', async () => {
        const std = ev.categories.Standard.id;
        const vip = ev.categories.VIP.id;
        const r = await quote([[std, 2], [vip, 1]], 'WAVE');
        assert.equal(r.status, 200, `devis : HTTP ${r.status} ${JSON.stringify(r.body)}`);
        assert.equal(Number(r.quote.facial_amount), 3250, 'sous-total (prix faciaux)');
        assert.equal(Number(r.quote.service_fee), 163, 'frais de service : 2 × 50 + 63');
        assert.equal(Number(r.quote.total_amount), 3413, 'total à payer');
        const lines = r.quote.lines ?? [];
        const byCategory = new Map(lines.map((l) => [String(l.category_id), l]));
        assert.equal(Number(byCategory.get(std)?.unit_service_fee), 50, 'frais unitaires Standard');
        assert.equal(Number(byCategory.get(vip)?.unit_service_fee), 63, 'frais unitaires VIP (62,5 → 63)');
        const noOperator = await quote([[std, 2], [vip, 1]]);
        assert.equal(noOperator.status, 200, `devis sans opérateur : HTTP ${noOperator.status}`);
        assert.equal(Number(noOperator.quote.total_amount), 3413, 'le total ne dépend pas de l’opérateur');
    });

    test('panier vide ou catégorie étrangère à l’événement : refusé, aucun montant', async () => {
        const empty = await quote([]);
        assert.ok(empty.status >= 400 && empty.status < 500, `panier vide : HTTP ${empty.status}`);
        const foreign = await quote([['00000000-0000-4000-8000-000000000000', 1]]);
        assert.ok(foreign.status >= 400 && foreign.status < 500, `catégorie inconnue : HTTP ${foreign.status}`);
        assert.equal(foreign.quote.total_amount, undefined, 'aucun total pour un panier refusé');
    });

    test('un seul montant : devis = montant envoyé à SamirPay = payments.amount = route de statut', async () => {
        const b = await newBuyer('affichage-egalite');
        const items: Array<[string, number]> = [[ev.categories.Standard.id, 2], [ev.categories.VIP.id, 1]];
        const q = await quote(items, 'ORANGE_MONEY');
        assert.equal(q.status, 200, `devis : HTTP ${q.status}`);
        const r = await checkout(b, cart(ev.eventId, items, b, 'ORANGE_MONEY'));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const call = initCalls().find((c) => c.orderId === r.payment!.external_order_id);
        assert.ok(call, 'appel SamirPay enregistré');
        const p = await paymentRow(r.payment!.id);
        const status = await pollStatus(b.accessToken, r.payment!.id);
        assert.equal(status.status, 200, JSON.stringify(status.body));
        const total = Number(q.quote.total_amount);
        assert.equal(Number(call.args.amount), total, 'montant envoyé à SamirPay = total du devis');
        assert.equal(Number(p.amount), total, 'payments.amount = total du devis');
        assert.equal(Number(status.body.amount), total, 'route de statut : amount = total du devis');
        assert.equal(Number(status.body.facial_amount), Number(q.quote.facial_amount), 'route de statut : facial_amount exposé');
        assert.equal(Number(status.body.service_fee), Number(q.quote.service_fee), 'route de statut : service_fee exposé');
    });
});

describe('Confirmation : SMS et PDF du billet', () => {
    test('SMS de confirmation d’achat : frais de service et total payé', async () => {
        const b = await newBuyer('affichage-sms');
        const sms = getFakes().sms;
        const before0 = sms.messagesTo(b.phoneE164).length;
        const { payment } = await buyConfirmed(b, ev, [['Standard', 1]], 'WAVE');
        // Lot 6 (T) : la confirmation part par la boîte d'envoi ; passage de l'envoyeur sur ses lignes avant la lecture.
        await flushNotifications({ ids: (await outboxRows({ keyPrefix: `PURCHASE_CONFIRMED:${payment.id}:` })).map((r) => r.id) });
        const received = sms.messagesTo(b.phoneE164).slice(before0).filter((m) => /achat|billet/i.test(m.message));
        assert.ok(received.length >= 1, 'SMS de confirmation envoyé à l’acheteur');
        const text = received[received.length - 1].message;
        assert.match(text, /frais de service/i, `SMS sans les frais de service : « ${text} »`);
        assert.match(text, /total/i, `SMS sans le total payé : « ${text} »`);
        assert.match(text, money(1050), `SMS sans le montant total 1 050 : « ${text} »`);
    });

    test('PDF du billet : frais de service et total payé', async () => {
        const b = await newBuyer('affichage-pdf');
        const { tickets } = await buyConfirmed(b, ev, [['Standard', 1]], 'WAVE');
        assert.equal(tickets.length, 1);
        const ticketId = String(tickets[0].id);
        const req = new NextRequest(`${BASE_URL}/api/tickets/${ticketId}/pdf`, { method: 'GET', headers: { authorization: `Bearer ${b.accessToken}` } });
        const res = await ticketPdfRoute(req, routeContext({ id: ticketId }));
        assert.equal(res.status, 200, `PDF : HTTP ${res.status}`);
        const text = pdfTexts(Buffer.from(await res.arrayBuffer()).toString('latin1'));
        assert.match(text, /frais de service/i, `PDF sans les frais de service :\n${text}`);
        assert.match(text, /total/i, `PDF sans le total payé :\n${text}`);
        assert.match(text, money(1050), `PDF sans le montant total 1 050 :\n${text}`);
    });
});

// ── Contrôles statiques ────────────────────────────────────────────────────

/** Calcul de frais dans le navigateur : taux multiplié, ou multiplication par un taux littéral. */
const FEE_MATH = /(service_?fee_?rate|serviceFeeRate|feeRate)\s*[*/]|[*/]\s*(service_?fee_?rate|serviceFeeRate|feeRate)|\*\s*0?\.0\d|\*\s*1\.0\d/i;

describe('Code : affichage du devis serveur', () => {
    test('page événement : demande le devis au serveur et ne transmet plus le total calculé dans le navigateur', () => {
        const page = fs.readFileSync('app/events/[id]/page.tsx', 'utf8');
        assert.match(page, /\/api\/checkout\/quote/, 'aucun appel au devis serveur');
        const start = page.indexOf('<PaymentModal');
        assert.ok(start >= 0, 'PaymentModal absent de la page');
        const modalProps = page.slice(start, page.indexOf('/>', start));
        assert.doesNotMatch(modalProps, /cartTotal/, 'la modale reçoit encore le total calculé dans le navigateur (cartTotal)');
        assert.doesNotMatch(page, FEE_MATH, 'calcul de frais dans le navigateur');
    });

    test('modale : affiche les frais de service et le total du devis, sans les calculer', () => {
        const modal = fs.readFileSync('components/payment/PaymentModal.tsx', 'utf8');
        assert.match(modal, /frais de service/i, 'libellé « Frais de service » absent');
        assert.match(modal, /service_fee|serviceFee/, 'frais de service du devis non affichés');
        assert.match(modal, /total_amount|totalAmount/, 'total du devis non affiché');
        assert.doesNotMatch(modal, FEE_MATH, 'calcul de frais dans la modale');
    });

    test('page /paiement/[id] : affiche le prix, les frais de service et le total', () => {
        const page = fs.readFileSync('app/paiement/[id]/page.tsx', 'utf8');
        assert.match(page, /frais de service/i, 'libellé « Frais de service » absent');
        assert.match(page, /service_fee|serviceFee/, 'frais de service de la route de statut non lus');
        assert.match(page, /facial_amount|facialAmount/, 'prix facial de la route de statut non lu');
        assert.doesNotMatch(page, FEE_MATH, 'calcul de frais dans la page de suivi');
    });
});
