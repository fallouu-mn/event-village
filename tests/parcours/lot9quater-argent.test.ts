/**
 * Lot 9 quater — argent, stock et caisse (C1 : AUD-20 ; C2, C3 : AUD-21, AUD-27 ; C4 : AUD-29 ; C5 : AUD-30 ;
 * C6 : AUD-31, G-24 ; C7 : AUD-16). Base LOCALE, faux SamirPay. Rouge avant correctif (migration 20261111000005
 * absente : doublons remboursés en entier sans fin, aucune limite par numéro payeur, auto-parrainage commissionné,
 * limite des billets gratuits sur les seuls billets détenus, PIN exigé à la clôture avec écart).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { assertLot9quaterInvariants } from '../helpers/lot9quater-invariants';
import { confirmPassword, jsonRequest, randomSenegalPhone, routeContext, STRONG_PASSWORD } from './helpers';
import {
    cart, checkout, deliverWebhook, importModule, newBuyer, paymentById, providerSays, service, type Buyer, type PaymentRow,
} from './paiement-helpers';
import { buyConfirmed, createPartnerEvent, newPartner } from './finance-helpers';
import { authed, newController, openShift, type RouteResult } from './acces-helpers';
import { newAdminWith } from './terrain-helpers';

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

after(async () => {
    await assertLot9quaterInvariants('lot9quater-argent');
});

async function call(modulePath: string, req: NextRequest, method = 'POST', ctx?: unknown): Promise<RouteResult> {
    const mod = await importModule(modulePath) as Record<string, Handler>;
    const res = await mod[method](req, ctx);
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try { body = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { body = { raw: text.slice(0, 300) }; }
    return { status: res.status, body };
}

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`;
}

// ── C1 ─────────────────────────────────────────────────────────────────────

/** Paiement en double du même panier pour `buyer` : A annulé localement, B confirmé, succès tardif de A remboursé. */
async function duplicateFor(buyer: Buyer, label: string): Promise<PaymentRow> {
    const partner = await newPartner(`q-c1-${label}`);
    const ev = await createPartnerEvent(partner.partnerId, `q c1 ${label}`, [{ name: 'Standard', price: 2_000, total: 10 }]);
    const r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
    assert.equal(r.status, 200, `premier paiement : ${JSON.stringify(r.body)}`);
    const first = r.payment!;
    const { POST } = await importModule('../../app/api/payments/[transactionId]/cancel/route');
    const cancel: Response = await POST(jsonRequest(`/api/payments/${first.id}/cancel`, { }, { authorization: `Bearer ${buyer.accessToken}` }), routeContext({ transactionId: first.id }));
    assert.equal(cancel.status, 200, 'premier paiement annulé par le client');
    await buyConfirmed(buyer, ev, [['Standard', 1]]);
    providerSays(first, 'SUCCESS');
    assert.equal((await deliverWebhook(first)).status, 200, 'succès tardif du premier paiement');
    return paymentById(first.id);
}

describe('C1 — doublons remboursés en boucle', () => {
    test('les 2 premiers doublons du compte sur 30 jours : remboursés en entier ; le 3e : moins les frais SamirPay, admins et client prévenus', async () => {
        const buyer = await newBuyer('q-c1');
        const refunds: Array<{ amount: number; paid: number; fee: number; payer: string | null; phone: string | null }> = [];
        for (const label of ['a', 'b', 'c']) {
            const dup = await duplicateFor(buyer, label);
            const { data: rf } = await service.from('refunds').select('amount').eq('payment_id', dup.id).single();
            const { data: co } = await service.from('cashouts').select('phone_number').eq('payment_id', dup.id).single();
            const { data: pay } = await service.from('payments').select('amount, aggregator_fee, payer_phone').eq('id', dup.id).single();
            refunds.push({ amount: Number(rf?.amount), paid: Number(pay?.amount), fee: Number(pay?.aggregator_fee ?? 0), payer: pay?.payer_phone ?? null, phone: co?.phone_number ?? null });
        }
        console.log(`[C1] remboursements : ${JSON.stringify(refunds)}`);
        assert.equal(refunds[0].amount, refunds[0].paid, '1er doublon : remboursé en entier');
        assert.equal(refunds[1].amount, refunds[1].paid, '2e doublon : remboursé en entier');
        assert.ok(refunds[2].fee > 0, 'précondition : frais SamirPay du paiement connus');
        assert.equal(refunds[2].amount, refunds[2].paid - refunds[2].fee, '3e doublon : moins les frais SamirPay');
        assert.ok(refunds.every((r) => r.phone === r.payer), 'C3 : le remboursement part vers le numéro qui a payé');
        const { data: alerts } = await service.from('notification_outbox').select('template_data').eq('type', 'ADMIN_DUPLICATE_PAYMENT')
            .contains('template_data', { withheld: refunds[2].fee });
        assert.ok((alerts ?? []).length > 0, 'alerte aux admins avec la retenue');
        const { data: notice } = await service.from('notification_outbox').select('template_data').eq('type', 'PAYMENT_REFUND_STARTED')
            .eq('recipient_user_id', buyer.userId).contains('template_data', { withheld: refunds[2].fee });
        assert.ok((notice ?? []).length > 0, 'client prévenu de la retenue');
    });
});

// ── C2, C3 ─────────────────────────────────────────────────────────────────

describe('C2, C3 — paiements en attente par numéro payeur', () => {
    test('au plus 3 paiements en attente par numéro payeur et par heure, tous comptes confondus', async () => {
        const payer = randomSenegalPhone('77').slice(4);
        const statuses: number[] = [];
        let last: RouteResult | null = null;
        for (let i = 0; i < 4; i += 1) {
            const partner = await newPartner(`q-c2-${i}`);
            const ev = await createPartnerEvent(partner.partnerId, `q c2 ${i}`, [{ name: 'Standard', price: 1_000, total: 5 }]);
            const buyer = await newBuyer(`q-c2-${i}`);
            const body = { ...cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer), payerPhone: payer };
            const r = await checkout(buyer, body);
            statuses.push(r.status);
            last = { status: r.status, body: r.body };
        }
        console.log(`[C2] statuts : ${statuses.join(', ')} ; dernier : ${last ? show(last) : ''}`);
        assert.deepEqual(statuses, [200, 200, 200, 409]);
        assert.deepEqual([last!.body.code, last!.body.error], ['PAYER_PENDING_LIMIT', 'Un paiement est déjà en attente pour ce numéro. Terminez-le ou attendez quelques minutes.']);
    });

    test('écran : avertissement « Le paiement sera demandé au … » quand le numéro payeur diffère de celui du compte', () => {
        const modal = fs.readFileSync('components/payment/PaymentModal.tsx', 'utf8');
        assert.match(modal, /Le paiement sera demandé au/);
        assert.match(modal, /normalizePayerPhone\(profile\?\.phone\) !== payerPhone/);
    });
});

// ── C4 ─────────────────────────────────────────────────────────────────────

describe('C4 — paiement FAILED sans identifiant SamirPay', () => {
    test('signalé dans « Versements à reprendre » avec la consigne, sans action automatique', async () => {
        const buyer = await newBuyer('q-c4');
        const partner = await newPartner('q-c4');
        const ev = await createPartnerEvent(partner.partnerId, 'q c4', [{ name: 'Standard', price: 1_000, total: 5 }]);
        const r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const { error } = await service.from('payments').update({ status: 'FAILED', external_transaction_id: null }).eq('id', r.payment!.id);
        assert.equal(error, null, error?.message);
        const admin = await newAdminWith(['refunds.manage'], { label: 'q-c4' });
        const list = await call('../../app/api/admin/refunds/route', authed('/api/admin/refunds?state=to_retry', 'GET', admin), 'GET');
        assert.equal(list.status, 200, show(list));
        const item = ((list.body.items ?? []) as Array<Record<string, unknown>>).find((i) => i.id === r.payment!.id);
        assert.ok(item, 'paiement signalé');
        assert.equal(item!.kind_label, 'Paiement sans identifiant SamirPay');
        assert.match(String(item!.advice), /tableau de bord SamirPay/);
        assert.deepEqual([item!.can_resend, item!.can_mark_paid], [false, false]);
    });
});

// ── C5 ─────────────────────────────────────────────────────────────────────

describe('C5 — auto-parrainage par un second numéro', () => {
    test('aucune commission quand le numéro payeur est celui du parrain ; commission avec un autre numéro', async () => {
        const sponsor = await newBuyer('q-c5-parrain');
        const referred = await newBuyer('q-c5-filleul');
        const { error } = await service.from('referral_relationships').insert({
            sponsor_id: sponsor.userId, referred_id: referred.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
            rate_n1_at_creation: 5, rate_n2_at_creation: 2, duration_months: 12,
            expires_at: new Date(Date.now() + 365 * 24 * 3600_000).toISOString(), is_active: true,
        });
        assert.equal(error, null, error?.message);
        const partner = await newPartner('q-c5');
        const ev1 = await createPartnerEvent(partner.partnerId, 'q c5 a', [{ name: 'Standard', price: 5_000, total: 5 }]);
        const ev2 = await createPartnerEvent(partner.partnerId, 'q c5 b', [{ name: 'Standard', price: 5_000, total: 5 }]);
        const selfPaid = await buyConfirmed({ ...referred, phone9: sponsor.phone9 }, ev1, [['Standard', 1]]);
        const ownPaid = await buyConfirmed(referred, ev2, [['Standard', 1]]);
        const count = async (paymentId: string) => (await service.from('referral_commissions').select('id').eq('payment_id', paymentId).eq('sponsor_id', sponsor.userId)).data?.length ?? 0;
        const [a, b] = [await count(selfPaid.payment.id), await count(ownPaid.payment.id)];
        console.log(`[C5] commissions : payé avec le numéro du parrain ${a} ; avec son propre numéro ${b}`);
        assert.deepEqual([a, b], [0, 1]);
    });
});

// ── C6 ─────────────────────────────────────────────────────────────────────

describe('C6 — limite des billets gratuits', () => {
    test('billet gratuit transféré : compté ; panier mixte : limite appliquée', async () => {
        const buyer = await newBuyer('q-c6');
        const friend = await newBuyer('q-c6-ami');
        const partner = await newPartner('q-c6');
        const ev = await createPartnerEvent(partner.partnerId, 'q c6', [{ name: 'Gratuite', price: 0, total: 10 }, { name: 'Standard', price: 1_000, total: 10 }]);
        await service.from('ticket_categories').update({ max_per_order: 1 }).eq('id', ev.categories.Gratuite.id);
        const claim = () => call('../../app/api/tickets/claim-free/route', authed('/api/tickets/claim-free', 'POST', buyer, { categoryId: ev.categories.Gratuite.id, quantity: 1 }));
        const first = await claim();
        assert.equal(first.status, 200, show(first));
        const ticketId = String((first.body.ticket_ids as string[])[0]);
        // Transfert réclamé par l'ami (écriture du service_role : effet d'un transfert accepté)
        const tr = await service.from('ticket_transfers').insert({
            ticket_id: ticketId, from_user_id: buyer.userId, to_user_id: friend.userId, to_phone_or_email: friend.phoneE164, status: 'CLAIMED',
            claim_token_hash: randomBytes(32).toString('hex'), expires_at: new Date(Date.now() + 3600_000).toISOString(), claimed_at: new Date().toISOString(),
        });
        assert.equal(tr.error, null, tr.error?.message);
        await service.from('tickets').update({ user_id: friend.userId }).eq('id', ticketId);
        const second = await claim();
        assert.notEqual(second.status, 200, `billet gratuit transféré puis redemandé : ${show(second)}`);
        const mixed = await checkout(buyer, cart(ev.eventId, [[ev.categories.Gratuite.id, 1], [ev.categories.Standard.id, 1]], buyer));
        console.log(`[C6] redemande ${show(second)} ; panier mixte HTTP ${mixed.status} ${JSON.stringify(mixed.body).slice(0, 200)}`);
        assert.notEqual(mixed.status, 200, 'panier mixte au-delà de la limite');
        assert.match(JSON.stringify(mixed.body), /FREE_LIMIT_REACHED/);
    });
});

// ── C7 ─────────────────────────────────────────────────────────────────────

describe('C7 — écart de caisse validé par l’organisatrice', () => {
    test('clôture avec écart sans PIN ; validation par la partenaire seule, mot de passe récent exigé', async () => {
        const partner = await newPartner('q-c7');
        const ev = await createPartnerEvent(partner.partnerId, 'q c7', [{ name: 'Standard', price: 1_000, total: 10 }]);
        const ctrl = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'q-c7' });
        const opened = await openShift(ctrl, ev.eventId, 0);
        assert.equal(opened.status, 200, show(opened));
        const shiftId = String((opened.body.shift as { id: string } | undefined)?.id ?? opened.body.shift_id ?? opened.body.id);
        const close = await call('../../app/api/controller/shifts/close/route', authed('/api/controller/shifts/close', 'POST', ctrl,
            { shiftId, declaredCashTotal: 500, justification: 'Monnaie rendue en trop à un spectateur' }));
        assert.equal(close.status, 200, `clôture avec écart, sans PIN : ${show(close)}`);
        assert.equal(close.body.discrepancy_pending, true);
        assert.match(String(close.body.message), /Écart en attente de validation par l’organisateur/);

        const other = await newPartner('q-c7-autre');
        const path = `/api/partner/shifts/${shiftId}/validate-discrepancy`;
        const mod = '../../app/api/partner/shifts/[id]/validate-discrepancy/route';
        await confirmPassword(other, STRONG_PASSWORD);
        const foreign = await call(mod, authed(path, 'POST', other, {}), 'POST', { params: { id: shiftId } });
        assert.equal(foreign.status, 404, `autre partenaire : ${show(foreign)}`);
        const noPwd = await call(mod, authed(path, 'POST', partner, {}), 'POST', { params: { id: shiftId } });
        assert.equal(noPwd.status, 403, `sans mot de passe récent : ${show(noPwd)}`);
        assert.equal(noPwd.body.code, 'PASSWORD_CONFIRMATION_REQUIRED');
        await confirmPassword(partner, STRONG_PASSWORD);
        const ok = await call(mod, authed(path, 'POST', partner, {}), 'POST', { params: { id: shiftId } });
        assert.equal(ok.status, 200, show(ok));
        const { data } = await service.from('controller_shifts').select('discrepancy_validated_at, discrepancy_validated_by').eq('id', shiftId).single();
        assert.ok(data?.discrepancy_validated_at, 'écart validé');
        assert.equal(data?.discrepancy_validated_by, partner.userId);
    });

    test('écran : bouton « Valider l’écart » dans l’onglet Caisse, plus de PIN à la clôture', () => {
        const block = fs.readFileSync('components/partner/pilotage/DiscrepancyValidation.tsx', 'utf8');
        assert.match(block, /Valider l’écart/);
        const modals = fs.readFileSync('components/shifts/ShiftModals.tsx', 'utf8');
        const close = modals.slice(modals.indexOf('export function CloseShiftModal'), modals.indexOf('interface ZSummaryModalProps'));
        assert.doesNotMatch(close, /regisseurPin/, 'aucun PIN envoyé à la clôture');
        assert.match(modals, /Écart en attente de validation par l’organisateur/);
    });
});

void randomUUID;
