/**
 * Lot 9 bis, tâche 6 — R47 et R30 : paiement en attente (consigne A.6 ; contrat 5.6, B10, B11, 11.1 N1 et N4 ;
 * découverte 9bis/discovery-9bis-versements.md section 3). Faux SamirPay de tests/fakes, acheteurs et événements neufs.
 *  R47-a  premier checkout, réservation échue (held_expires_at reculé), paiement toujours PENDING : un second checkout
 *         (autre clé, autre opérateur) → 409 PAYMENT_PENDING (message actuel), aucun paiement ni appel SamirPay de plus ;
 *  R47-b  témoins : après annulation par le client → 200 ; après expiration (EXPIRED) → 200 ;
 *  R47-c  statique : /paiement/[id] rend, quand la réservation est échue, le bandeau « Paiement toujours en attente… »
 *         (texte du contrat 5.6) et « Annuler ce paiement » en bouton principal ;
 *  R30-a  succès tardif sans stock : PAYMENT_REFUND_STARTED (SMS, in-app, push, email) au client AVANT tout versement,
 *         SMS exact (11.1 N4) ;
 *  R30-b  double paiement : PAYMENT_REFUND_STARTED, variante « double », SMS exact ;
 *  R30-c  remboursement bloqué par un solde SamirPay nul : REFUND_DELAYED au client (11.1 N1).
 *
 * Rouge aujourd'hui (rien n'est corrigé) :
 *  - R47-a : la garde du PENDING exige held_expires_at > now() (supabase/migrations/20261105000006_lot7_client.sql:69) :
 *    200 et un second paiement ;
 *  - R47-c : la page dit « Vérification en cours » et garde « Annuler le paiement » en bouton discret
 *    (app/paiement/[id]/page.tsx:217-224, :926-935) ;
 *  - R30 : notif_cashouts_notify n'avise à la création que d'un TICKET_REFUND (20261103000006_lot6_pros_admin.sql:370-379),
 *    types PAYMENT_REFUND_STARTED et REFUND_DELAYED absents du registre.
 * Verts dès l'écriture (témoins, signalés) : R47-b. Leur garde-fou est R47-a : même montage, paiement encore PENDING.
 * Envois comptés par numéro neuf. after() : assertLot9bisInvariants (garde de schéma rouge jusqu'aux migrations).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { smsAmount, smsVar } from '../../lib/notifications/sms-format';
import { SamirPayError } from '../../lib/samirpay/types';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { routeContext } from './helpers';
import {
    callsOf, cart, checkout, createSaleEvent, deliverWebhook, fakePay, importModule, initCalls, newBuyer, paymentById, paymentsOf,
    providerSays, service, setFakeMode, type Buyer, type PaymentRow, type SaleEvent,
} from './paiement-helpers';
import { buyConfirmed, jsonRequest } from './finance-helpers';
import { flushNotifications, outboxRows, smsMark, smsTo, type OutboxRow } from './notif-helpers';

type Row = Record<string, unknown>;

const PAGE = 'app/paiement/[id]/page.tsx';
const CANCEL_ROUTE = '../../app/api/payments/[transactionId]/cancel/route';
/** Message actuel du refus PAYMENT_PENDING (lib/payments/checkout.service.ts:94-98), gardé par le contrat 4.1. */
const PAYMENT_PENDING_TEXT = 'Un paiement est déjà en attente pour cet événement.';
/** Bandeau du contrat 5.6, phrase par phrase (apostrophes et espaces normalisées avant comparaison). */
const BANNER = [
    'Paiement toujours en attente.',
    'Si vous n’avez pas validé sur votre téléphone, annulez-le : aucun autre paiement n’est possible pour cet événement tant que celui-ci n’est ni confirmé ni annulé.',
    'Si vous avez déjà validé, attendez : vos billets arriveront, ou vous serez remboursé.',
];
const FULL_BALANCE = 10_000_000;

let ev: SaleEvent;

before(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = FULL_BALANCE;
    ev = await createSaleEvent('attente-9bis', [{ name: 'Standard', price: 3_000, total: 60, maxPerOrder: 10 }]);
});

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = FULL_BALANCE;
    await assertLot9bisInvariants('paiement-attente-9bis');
});

// ── Outils ─────────────────────────────────────────────────────────────────

function brief(r: { status: number; body: Row }): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`;
}

async function pendingCheckout(buyer: Buyer, target: SaleEvent, quantity: number): Promise<PaymentRow> {
    const r = await checkout(buyer, cart(target.eventId, [[target.categories.Standard.id, quantity]], buyer));
    assert.equal(r.status, 200, `checkout de préparation : ${brief(r)}`);
    assert.ok(r.payment, 'paiement de préparation créé');
    assert.equal(r.payment!.status, 'PENDING', 'paiement de préparation PENDING');
    return r.payment!;
}

/** Réservation échue (comme 11 minutes après la création) ; le paiement, lui, reste PENDING chez nous et chez SamirPay. */
async function holdElapsed(payment: PaymentRow): Promise<void> {
    const past = new Date(Date.now() - 60_000).toISOString();
    const { error } = await service.from('payments').update({ held_expires_at: past }).eq('id', payment.id);
    assert.equal(error, null, `échéance de la réservation du paiement : ${error?.message}`);
    const { error: rErr } = await service.from('stock_reservations').update({ expires_at: past }).eq('payment_id', payment.id).eq('status', 'ACTIVE');
    assert.equal(rErr, null, `échéance de la réservation de stock : ${rErr?.message}`);
}

async function expire(payment: PaymentRow): Promise<void> {
    const { data, error } = await service.rpc('payment_release', { p_payment_id: payment.id, p_status: 'EXPIRED', p_reason: 'PENDING_TOO_OLD' });
    assert.equal(error, null, `expiration : ${error?.message}`);
    assert.equal((data as Row | null)?.changed, true, `précondition : paiement EXPIRED (${JSON.stringify(data)})`);
}

async function cancelByClient(buyer: Buyer, payment: PaymentRow): Promise<void> {
    const { POST } = await importModule(CANCEL_ROUTE);
    const res = await POST(jsonRequest(`/api/payments/${payment.id}/cancel`, 'POST', buyer.accessToken), routeContext({ transactionId: payment.id }));
    assert.equal(res.status, 200, `annulation par le client : HTTP ${res.status}`);
    assert.equal((await paymentById(payment.id)).status, 'CANCELLED', 'précondition : paiement annulé');
}

async function lateSuccess(payment: PaymentRow): Promise<void> {
    providerSays(payment, 'SUCCESS');
    const hook = await deliverWebhook(payment);
    assert.equal(hook.status, 200, `webhook du paiement ${payment.id} : HTTP ${hook.status}`);
}

/** Remplace getSolde du faux par une panne le temps de fn : le remboursement reste A_ENVOYER, rien ne part. */
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

async function cashoutsOf(paymentId: string): Promise<Row[]> {
    const { data, error } = await service.from('cashouts').select('*').eq('payment_id', paymentId).order('created_at');
    assert.equal(error, null, `cashouts du paiement ${paymentId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

function sendsTo(buyer: Buyer): number {
    return callsOf('sendCashout').filter((c) => c.args.phoneNumber === buyer.phone9).length;
}

async function titleOf(eventId: string): Promise<string> {
    const { data, error } = await service.from('events').select('title').eq('id', eventId).single();
    assert.equal(error, null, `titre de l’événement : ${error?.message}`);
    return String(data.title);
}

/** Un seul SMS de ces lignes, envoyé par l'envoyeur limité à elles et lu sur le numéro neuf du client. */
async function smsOf(rows: OutboxRow[], phoneE164: string): Promise<string[]> {
    const sms = rows.filter((r) => r.channel === 'SMS');
    assert.equal(sms.length, 1, `une ligne SMS : ${JSON.stringify(rows.map((r) => [r.channel, r.idempotency_key]))}`);
    const mark = smsMark(phoneE164);
    await flushNotifications({ ids: sms.map((r) => r.id) });
    return smsTo(phoneE164, mark).map((m) => m.message);
}

/** Avis PAYMENT_REFUND_STARTED du client : un par canal (SMS, in-app, push, email), indispensable. */
async function refundStarted(buyer: Buyer): Promise<OutboxRow[]> {
    const rows = await outboxRows({ type: 'PAYMENT_REFUND_STARTED', userId: buyer.userId });
    assert.deepEqual(rows.map((r) => r.channel).sort(), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], `PAYMENT_REFUND_STARTED au client (R30, 11.1 N4) : ${JSON.stringify(rows.map((r) => r.idempotency_key))}`);
    assert.ok(rows.every((r) => r.family === 'ESSENTIAL'), 'avis indispensable');
    return rows;
}

// ── R47 : un seul paiement en attente, même après l'échéance de la réservation ──

describe('Tâche 6 — R47 : aucun second paiement tant que le premier n’est ni confirmé ni annulé (B10)', () => {
    test('R47-a : réservation échue, premier paiement toujours PENDING : second checkout → 409 PAYMENT_PENDING, rien de créé', async () => {
        const buyer = await newBuyer('9bis-r47');
        const first = await pendingCheckout(buyer, ev, 2);
        await holdElapsed(first);
        assert.equal((await paymentById(first.id)).status, 'PENDING', 'précondition : le premier paiement attend toujours la validation');
        const inits = initCalls().length;

        const second = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer, 'ORANGE_MONEY'));
        assert.equal(second.status, 409, `second paiement après l’échéance de la réservation (aujourd’hui 200) : ${brief(second)}`);
        assert.deepEqual({ code: second.body.code, payment_id: second.body.payment_id, error: second.body.error },
            { code: 'PAYMENT_PENDING', payment_id: first.id, error: PAYMENT_PENDING_TEXT }, `refus : ${brief(second)}`);
        assert.deepEqual((await paymentsOf(buyer.userId)).map((p) => p.id), [first.id], 'aucun paiement de plus');
        assert.equal(initCalls().length, inits, 'aucun appel SamirPay de plus');
    });

    test('R47-b : témoins : après annulation par le client → 200 ; après expiration → 200', async () => {
        const a = await newBuyer('9bis-r47-annule');
        const cancelled = await pendingCheckout(a, ev, 1);
        await holdElapsed(cancelled);
        await cancelByClient(a, cancelled);
        const afterCancel = await checkout(a, cart(ev.eventId, [[ev.categories.Standard.id, 1]], a));
        assert.equal(afterCancel.status, 200, `après annulation : ${brief(afterCancel)}`);
        assert.notEqual(afterCancel.body.payment_id, cancelled.id, 'après annulation : nouveau paiement');

        const b = await newBuyer('9bis-r47-expire');
        const expired = await pendingCheckout(b, ev, 1);
        await expire(expired);
        const afterExpiry = await checkout(b, cart(ev.eventId, [[ev.categories.Standard.id, 1]], b));
        assert.equal(afterExpiry.status, 200, `après expiration : ${brief(afterExpiry)}`);
        assert.notEqual(afterExpiry.body.payment_id, expired.id, 'après expiration : nouveau paiement');
    });
});

// ── R47-c : la page d'attente (statique) ───────────────────────────────────

function parsePage(): ts.SourceFile {
    const file = path.join(process.cwd(), PAGE);
    assert.ok(fs.existsSync(file), `${PAGE} absent`);
    return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function normalize(text: string): string {
    return text.replace(/&apos;|&#39;|&rsquo;|’/g, '\'').replace(/[\s  ]+/g, ' ').trim();
}

function allNodes(root: ts.Node): ts.Node[] {
    const out: ts.Node[] = [];
    const visit = (n: ts.Node): void => {
        out.push(n);
        n.forEachChild(visit);
    };
    visit(root);
    return out;
}

function isTextNode(n: ts.Node): n is ts.JsxText | ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
    return ts.isJsxText(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
}

/** Vrai si un ancêtre conditionne le nœud sur `expired` (ternaire, &&, if). */
function guardedByExpired(sf: ts.SourceFile, n: ts.Node): boolean {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
        const cond = ts.isConditionalExpression(p) ? p.condition : ts.isBinaryExpression(p) ? p.left : ts.isIfStatement(p) ? p.expression : null;
        if (cond && /\bexpired\b/.test(cond.getText(sf))) return true;
    }
    return false;
}

describe('Tâche 6 — R47-c : /paiement/[id] propose d’abord d’annuler quand la réservation est échue (statique)', () => {
    test('le bandeau « Paiement toujours en attente… » (texte du contrat 5.6) est rendu sous la condition expired', () => {
        const sf = parsePage();
        const texts = allNodes(sf).filter(isTextNode);
        const joined = normalize(texts.map((t) => t.text).join(' '));
        for (const sentence of BANNER) assert.ok(joined.includes(normalize(sentence)), `${PAGE} : phrase du bandeau absente : « ${sentence} »`);
        const head = texts.find((t) => normalize(t.text).includes('Paiement toujours en attente'));
        assert.ok(head && guardedByExpired(sf, head), `${PAGE} : le bandeau doit dépendre de l’échéance (expired)`);
        assert.equal(joined.includes('Le délai de paiement est écoulé'), false, `${PAGE} : « Le délai de paiement est écoulé » doit disparaître (le paiement reste payable)`);
    });

    test('« Annuler ce paiement » est un bouton principal (ni ghost, ni outline, ni secondary) quand la réservation est échue', () => {
        const sf = parsePage();
        const buttons = allNodes(sf).filter((n): n is ts.JsxElement => ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === 'Button'
            && normalize(n.children.map((c) => (ts.isJsxText(c) ? c.text : '')).join(' ')).includes('Annuler ce paiement'));
        assert.ok(buttons.length > 0, `${PAGE} : bouton « Annuler ce paiement » absent`);
        /** Texte de l'attribut variant, null s'il est absent (Button : primary par défaut). */
        const variantOf = (b: ts.JsxElement): string | null => {
            const attr = b.openingElement.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'variant') as ts.JsxAttribute | undefined;
            return attr ? (attr.initializer?.getText(sf) ?? '') : null;
        };
        const isMain = (b: ts.JsxElement): boolean => variantOf(b) === null || /primary|danger/.test(variantOf(b)!);
        assert.ok(buttons.some((b) => isMain(b) && (guardedByExpired(sf, b) || /\bexpired\b/.test(variantOf(b) ?? ''))),
            `${PAGE} : « Annuler ce paiement » doit être le bouton principal (variant primary ou danger) quand expired : ${buttons.map((b) => b.openingElement.getText(sf).slice(0, 160)).join(' | ')}`);
    });
});

// ── R30 : le client est prévenu dès que son paiement doit lui être rendu ───

describe('Tâche 6 — R30 : PAYMENT_REFUND_STARTED et REFUND_DELAYED au client (B11)', () => {
    test('R30-a : succès tardif sans stock : PAYMENT_REFUND_STARTED avant tout versement, SMS exact', async () => {
        const small = await createSaleEvent('attente-9bis-stock', [{ name: 'Standard', price: 2_000, total: 2 }]);
        const title = await titleOf(small.eventId);
        const late = await newBuyer('9bis-r30-tardif');
        const first = await pendingCheckout(late, small, 2);
        await expire(first);
        await buyConfirmed(await newBuyer('9bis-r30-autre'), small, [['Standard', 2]]);
        await withBalanceUnavailable(() => lateSuccess(first));

        const paid = await paymentById(first.id);
        assert.equal(paid.status, 'REFUND_PENDING', `précondition : encaissé sans billet possible (${paid.status})`);
        const [refund] = await cashoutsOf(first.id);
        assert.deepEqual({ kind: refund?.kind, status: refund?.status }, { kind: 'REFUND', status: 'A_ENVOYER' }, 'précondition : remboursement créé, pas encore envoyé');
        assert.equal(sendsTo(late), 0, 'précondition : rien n’est parti');

        const rows = await refundStarted(late);
        assert.deepEqual(await smsOf(rows, late.phoneE164),
            [`Event Village : paiement de ${smsAmount(Number(paid.amount))} ("${smsVar(title, 30)}") sans billet possible : il vous est remboursé sur votre compte Wave.`],
            'SMS PAYMENT_REFUND_STARTED, texte exact (11.1 N4)');
    });

    test('R30-b : double paiement : PAYMENT_REFUND_STARTED, variante « double », SMS exact', async () => {
        const target = await createSaleEvent('attente-9bis-double', [{ name: 'Standard', price: 1_500, total: 10 }]);
        const title = await titleOf(target.eventId);
        const buyer = await newBuyer('9bis-r30-double');
        const first = await pendingCheckout(buyer, target, 1);
        await cancelByClient(buyer, first);
        await buyConfirmed(buyer, target, [['Standard', 1]]);
        await withBalanceUnavailable(() => lateSuccess(first));

        const paid = await paymentById(first.id);
        assert.equal(paid.status, 'REFUND_PENDING', `précondition : paiement en double à rembourser (${paid.status})`);
        assert.equal(sendsTo(buyer), 0, 'précondition : rien n’est parti');
        const rows = await refundStarted(buyer);
        assert.deepEqual(await smsOf(rows, buyer.phoneE164),
            [`Event Village : paiement en double de ${smsAmount(Number(paid.amount))} ("${smsVar(title, 28)}"), remboursé sur votre compte Wave. Vos billets restent valables.`],
            'SMS PAYMENT_REFUND_STARTED « double », texte exact (11.1 N4)');
    });

    test('R30-c : remboursement bloqué par un solde SamirPay nul : REFUND_DELAYED au client, un avis par canal', async () => {
        const target = await createSaleEvent('attente-9bis-solde', [{ name: 'Standard', price: 1_500, total: 10 }]);
        const buyer = await newBuyer('9bis-r30-solde');
        const first = await pendingCheckout(buyer, target, 1);
        await cancelByClient(buyer, first);
        await buyConfirmed(buyer, target, [['Standard', 1]]);
        fakePay().balance = 0;
        try {
            await lateSuccess(first);
        } finally {
            fakePay().balance = FULL_BALANCE;
        }
        const [refund] = await cashoutsOf(first.id);
        assert.deepEqual({ status: refund?.status, blocked: refund?.blocked_reason }, { status: 'A_ENVOYER', blocked: 'SOLDE_INSUFFISANT' }, 'précondition : remboursement bloqué par le solde');
        const delayed = await outboxRows({ type: 'REFUND_DELAYED', keyPrefix: `REFUND_DELAYED:${String(refund.id)}:` });
        assert.deepEqual(delayed.map((d) => d.channel).sort(), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], `REFUND_DELAYED (11.1 N1) : ${JSON.stringify(delayed.map((d) => d.idempotency_key))}`);
        assert.ok(delayed.every((d) => d.recipient_user_id === buyer.userId && d.family === 'ESSENTIAL'), 'avis indispensable, adressé au client');
    });
});
