/**
 * Lot 9 ter, tâche 9t.2 (consigne 0.2 ; contrat 5.B 9t.2, B.2.2 (6), 11.1 et 11.2 N1, décisions B-D1 à B-D4) — le
 * détenteur actuel d'un billet transféré est prévenu quand ce billet est remboursé : type nouveau
 * TICKET_REFUNDED_HOLDER (SMS indispensable, cloche, push, email si vérifié), clé `TICKET_REFUNDED_HOLDER:<billet>`, au
 * porteur actuel (tickets.user_id) quand il n'est pas le payeur et qu'un transfert CLAIMED existe (règle R13) ; SMS de la
 * consigne mot pour mot : « Event Village : votre billet {catégorie} pour {titre} a été annulé. Le remboursement est
 * versé à l'acheteur d'origine. » L'acheteur garde REFUND_REQUESTED. Billet payé en espèces, transféré, remboursé : le
 * texte 0.2 remplace TICKET_CANCELLED CASH (B-D2). Report de plus de 24 h, remboursement demandé par le porteur : message
 * envoyé (B-D3). Annulation de l'événement : déjà conforme (EVENT_CANCELLED mode TRANSFERRED au porteur), preuve seule.
 *
 * Montage : partenaire neuve, événement PUBLIE dans 10 jours (titre court ≤ 20 caractères : le SMS le cite sans
 * troncature), catégories VIP 10 000 F ×20 et Gratuit 0 F ×20 ; Fatou achète par le parcours complet (buyConfirmed),
 * transfère à Lamine par ticket_transfer_initiate puis ticket_transfer_accept (patron lot9bis-report) ; remboursement
 * par la route POST /api/partner/events/[id]/tickets/[ticketId]/refund (jeton de la partenaire ou d'un admin
 * refunds.manage). Lignes lues par outboxRows (filtre type, événement, destinataire), SMS comptés par numéro neuf
 * (smsMark / smsTo) après l'envoi de la seule ligne SMS du porteur. Les versements de remboursement sont envoyés et
 * confirmés avant les assertions (aucun versement laissé en attente).
 *
 * Rouge avant correctif : TICKET_REFUNDED_HOLDER n'est ni au registre (M04) ni émis par ticket_refund_request (M06,
 * recopie F15) : cas 1 à 7 échouent sur le nombre de lignes (0 au lieu de 4) ; le cas 5 reçoit aujourd'hui
 * TICKET_CANCELLED CASH (M/20261109000006:1127-1135). Témoins 8 à 11 verts aujourd'hui (rien n'est envoyé au mauvais
 * destinataire). after() : assertLot9terInvariants, dont la garde de schéma nomme les objets absents jusqu'à M11.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CashoutService } from '../../lib/payments/cashout.service';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { categoryState, fakePay, newBuyer, service, setFakeMode, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, cashoutsByKey, confirmCashouts, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { advanceEventTo, assertRpcOk, createDraftEvent, rpcCancel, type DraftEvent } from './cycle-helpers';
import { flushNotifications, markEmailVerified, markPhoneVerified, outboxRows, smsMark, smsTo, type OutboxRow } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { issueFreeTicket, newAdminWith } from './terrain-helpers';
import type { RouteResult } from './acces-helpers';
import { technicalEmailFor } from '../../lib/auth/technical-email';

type Row = Record<string, unknown>;

const HOUR = 3600_000;
const VIP = 'VIP';
const FREE = 'Gratuit';
const CATEGORIES: CategorySpec[] = [{ name: VIP, price: 10_000, total: 20 }, { name: FREE, price: 0, total: 20 }];
const TYPE = 'TICKET_REFUNDED_HOLDER';
const CHANNELS = ['EMAIL', 'IN_APP', 'PUSH', 'SMS'];
const PARTNER_REFUND_ROUTE = '../../app/api/partner/events/[id]/tickets/[ticketId]/refund/route';
const CLIENT_REFUND_ROUTE = '../../app/api/tickets/[id]/refund/route';
const REASON = 'Test 9 ter';

/** SMS de la consigne 0.2, mot pour mot (contrat 11.1). */
function holderSms(category: string, title: string): string {
    return `Event Village : votre billet ${category} pour ${title} a été annulé. Le remboursement est versé à l'acheteur d'origine.`;
}

// ── Montage ────────────────────────────────────────────────────────────────

let partner: TestPartner;
let seq = 0;

/** Titre court (≤ 20 caractères, GSM-7 de base) : le SMS le cite sans troncature. */
function shortTitle(): string {
    seq += 1;
    return `Gala det ${String(Date.now() % 100_000).padStart(5, '0')}${seq}`.slice(0, 20);
}

async function publishedEvent(label: string): Promise<DraftEvent> {
    const ev = await createDraftEvent(partner, label, CATEGORIES, { title: shortTitle(), startsInHours: 240, durationHours: 4 });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    return ev;
}

async function holderAccount(label: string, firstName: string): Promise<Buyer> {
    const b = await newBuyer(label, { firstName, lastName: 'Detenteur' });
    await markPhoneVerified(b.userId);
    return b;
}

/**
 * Adresse technique du compte : aucune adresse réelle, l'email part SKIPPED NO_REAL_EMAIL. Lot 9 quater (A4 : AUD-19) :
 * forme actuelle « u…@comptes.eventvillage.invalid » (technical_email_for), l'ancienne « <chiffres>@eventvillage.sn »
 * n'existe plus après la reprise et reste interdite par l'invariant (q1) (modification signalée au rapport).
 */
async function withoutRealEmail(b: Buyer): Promise<void> {
    const { error } = await service.from('users').update({ email: technicalEmailFor(b.userId) }).eq('id', b.userId);
    assert.equal(error, null, `adresse technique du compte : ${error?.message}`);
}

async function boughtTicket(buyer: Buyer, ev: DraftEvent): Promise<string> {
    const { tickets } = await buyConfirmed(buyer, ev, [[VIP, 1]]);
    assert.equal(tickets.length, 1, 'un billet acheté');
    return String(tickets[0].id);
}

/** Transfert initié puis accepté par les RPC du contrat (patron lot9bis-report.test.ts). */
async function transfer(ticketId: string, from: Buyer, to: Buyer): Promise<void> {
    const { data, error } = await service.rpc('ticket_transfer_initiate', {
        p: { ticket_id: ticketId, actor_id: from.userId, recipient: to.phoneE164, expires_at: new Date(Date.now() + 48 * HOUR).toISOString() },
    });
    assert.equal(error, null, `ticket_transfer_initiate : ${error?.message}`);
    const body = (data ?? {}) as Row;
    assert.equal(body.ok, true, `transfert refusé : ${JSON.stringify(body)}`);
    const { data: acc, error: accErr } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: String(body.transfer_id), actor_id: to.userId } });
    assert.equal(accErr, null, `ticket_transfer_accept : ${accErr?.message}`);
    assert.equal((acc as Row | null)?.ok, true, `acceptation du transfert : ${JSON.stringify(acc)}`);
    const { data: t, error: tErr } = await service.from('tickets').select('user_id').eq('id', ticketId).single();
    assert.equal(tErr, null, `billet ${ticketId} : ${tErr?.message}`);
    assert.equal(t.user_id, to.userId, 'précondition : le billet est au destinataire');
}

/** Vente espèces (rectification B.1) : paiement hors plateforme SUCCESS rattaché au compte, billet VALIDE (patron finance-remboursement-billet). */
async function cashTicket(buyer: Buyer, ev: DraftEvent): Promise<string> {
    const cat = ev.categories[VIP];
    const { data: pay, error: payErr } = await service.from('payments').insert({
        transaction_id: `TX-CASH-9T2-${randomUUID()}`, client_id: buyer.userId, partner_id: partner.partnerId,
        payment_target: 'TICKET', amount: cat.price, currency: 'XOF', is_platform_payment: false,
        offline_payment_method: 'ESPECES', payment_method: 'CASH', status: 'SUCCESS', paid_at: new Date().toISOString(),
        metadata: { event_id: ev.eventId },
    }).select('id').single();
    assert.equal(payErr, null, `paiement espèces : ${payErr?.message}`);
    const { data: t, error: tErr } = await service.from('tickets').insert({
        event_id: ev.eventId, category_id: cat.id, user_id: buyer.userId, payment_id: pay.id,
        ticket_number: `TCK-CASH-${randomUUID().slice(0, 12).toUpperCase()}`, price: cat.price,
        qr_code: `EV-QR-TEST-${randomUUID()}`, status: 'VALIDE',
    }).select('id').single();
    assert.equal(tErr, null, `billet espèces : ${tErr?.message}`);
    const state = await categoryState(cat.id);
    const { error: soldErr } = await service.from('ticket_categories').update({ sold_quantity: state.sold + 1 }).eq('id', cat.id);
    assert.equal(soldErr, null, `stock vendu : ${soldErr?.message}`);
    return String(t.id);
}

// ── Routes et versements ───────────────────────────────────────────────────

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

async function partnerRefund(actor: Pick<Buyer, 'accessToken'>, eventId: string, ticketId: string): Promise<RouteResult> {
    const handler = await routeHandler(PARTNER_REFUND_ROUTE, 'POST', 'POST /api/partner/events/[id]/tickets/[ticketId]/refund');
    return invoke(handler, jsonRequest(`/api/partner/events/${eventId}/tickets/${ticketId}/refund`, 'POST', actor.accessToken, { reason: REASON }),
        ctx({ id: eventId, ticketId }));
}

/** Versements de remboursement du billet envoyés puis confirmés (rien laissé en attente pour les suites suivantes). */
async function settle(ticketId: string): Promise<void> {
    for (const c of await cashoutsByKey(`REFUND-TKT-${ticketId}`)) {
        if (c.status === 'A_ENVOYER' && !c.blocked_reason) await CashoutService.send(String(c.id));
    }
    for (const c of await cashoutsByKey(`REFUND-TKT-${ticketId}`)) {
        if (c.samirpay_transaction_id) fakePay().setTransactionStatus(String(c.samirpay_transaction_id), 'SUCCESS');
    }
    await confirmCashouts();
}

async function refundOk(actor: Pick<Buyer, 'accessToken'>, eventId: string, ticketId: string, label: string): Promise<RouteResult> {
    const res = await partnerRefund(actor, eventId, ticketId);
    await settle(ticketId);
    assert.equal(res.status, 200, `${label} : ${show(res)}`);
    return res;
}

// ── Lecture ────────────────────────────────────────────────────────────────

function brief(rows: OutboxRow[]): string {
    return JSON.stringify(rows.map((r) => [r.type, r.channel, r.recipient_user_id, r.status, r.reason]));
}

async function holderRows(eventId: string, userId?: string): Promise<OutboxRow[]> {
    return outboxRows({ type: TYPE, eventId, userId });
}

/** Les 4 lignes de N1 au porteur : canaux du registre, clé, données ; EMAIL selon l'adresse. */
function assertHolderSeries(rows: OutboxRow[], holder: Buyer, ticketId: string, emailState: 'NO_REAL_EMAIL' | 'PENDING'): void {
    assert.deepEqual(rows.map((r) => r.channel).sort(), CHANNELS,
        `4 lignes ${TYPE} au porteur actuel (SMS, IN_APP, PUSH, EMAIL) : ${brief(rows)}`);
    for (const r of rows) {
        assert.equal(r.recipient_user_id, holder.userId, `destinataire = porteur actuel : ${brief([r])}`);
        assert.equal(r.group_key, `${TYPE}:${ticketId}`, `clé de groupe ${TYPE}:<billet> : ${r.group_key}`);
        assert.equal(r.template_data.ticket_id, ticketId, `template_data.ticket_id : ${JSON.stringify(r.template_data)}`);
        assert.equal(r.template_data.category, VIP, `template_data.category : ${JSON.stringify(r.template_data)}`);
    }
    for (const ch of ['IN_APP', 'SMS', 'PUSH']) {
        const r = rows.find((x) => x.channel === ch)!;
        assert.equal(r.status, 'PENDING', `${ch} en file : ${brief([r])}`);
    }
    const email = rows.find((x) => x.channel === 'EMAIL')!;
    if (emailState === 'PENDING') assert.equal(email.status, 'PENDING', `adresse réelle et vérifiée : EMAIL en file : ${brief([email])}`);
    else assert.deepEqual([email.status, email.reason], ['SKIPPED', 'NO_REAL_EMAIL'], `aucune adresse réelle : ${brief([email])}`);
}

/** Envoie la seule ligne SMS de N1 du porteur et rend les SMS reçus par son numéro depuis la marque. */
async function deliverHolderSms(rows: OutboxRow[], holder: Buyer): Promise<string[]> {
    const sms = rows.filter((r) => r.channel === 'SMS');
    assert.equal(sms.length, 1, `une ligne SMS ${TYPE} : ${brief(rows)}`);
    const mark = smsMark(holder.phoneE164);
    await flushNotifications({ ids: [sms[0].id] });
    return smsTo(holder.phoneE164, mark).map((m) => m.message);
}

before(async () => {
    partner = await newPartner('det9t');
});

after(async () => {
    setFakeMode('cashoutMode', 'success');
    await assertLot9terInvariants('messages-detenteur-9ter');
});

describe('9t.2 (0.2) : le détenteur actuel d\'un billet transféré est prévenu du remboursement', () => {
    test('payé en ligne, transféré, accepté, remboursé par l\'organisatrice : TICKET_REFUNDED_HOLDER au porteur actuel (SMS, cloche, push, email) ; l\'acheteur garde REFUND_REQUESTED', async () => {
        const ev = await publishedEvent('det-1');
        const fatou = await newBuyer('det-fatou', { firstName: 'Fatou', lastName: 'Acheteuse' });
        const lamine = await holderAccount('det-lamine', 'Lamine');
        await withoutRealEmail(lamine);
        const ticketId = await boughtTicket(fatou, ev);
        await transfer(ticketId, fatou, lamine);

        await refundOk(partner, ev.eventId, ticketId, 'remboursement par l\'organisatrice');

        const rows = await holderRows(ev.eventId, lamine.userId);
        assertHolderSeries(rows, lamine, ticketId, 'NO_REAL_EMAIL');
        assert.deepEqual(await deliverHolderSms(rows, lamine), [holderSms(VIP, ev.title)], 'un SMS au porteur, texte de la consigne 0.2 mot pour mot');
        const payer = await outboxRows({ type: 'REFUND_REQUESTED', eventId: ev.eventId, userId: fatou.userId });
        assert.ok(payer.length > 0, `l'acheteuse garde REFUND_REQUESTED : ${brief(payer)}`);
        assert.deepEqual(await holderRows(ev.eventId, fatou.userId), [], 'aucune ligne TICKET_REFUNDED_HOLDER pour l\'acheteuse');
    });

    test('adresse réelle et vérifiée du porteur : la ligne EMAIL part (PENDING)', async () => {
        const ev = await publishedEvent('det-2');
        const fatou = await newBuyer('det2-fatou', { firstName: 'Fatou', lastName: 'Acheteuse' });
        const lamine = await holderAccount('det2-lamine', 'Lamine');
        await markEmailVerified(lamine.userId);
        const ticketId = await boughtTicket(fatou, ev);
        await transfer(ticketId, fatou, lamine);

        await refundOk(partner, ev.eventId, ticketId, 'remboursement par l\'organisatrice');

        assertHolderSeries(await holderRows(ev.eventId, lamine.userId), lamine, ticketId, 'PENDING');
    });

    test('remboursé par un admin refunds.manage : même message au porteur actuel', async () => {
        const ev = await publishedEvent('det-3');
        const admin = await newAdminWith(['refunds.manage'], { label: 'det9t-remb' });
        const fatou = await newBuyer('det3-fatou', { firstName: 'Fatou', lastName: 'Acheteuse' });
        const lamine = await holderAccount('det3-lamine', 'Lamine');
        await withoutRealEmail(lamine);
        const ticketId = await boughtTicket(fatou, ev);
        await transfer(ticketId, fatou, lamine);

        await refundOk(admin, ev.eventId, ticketId, 'remboursement par un admin refunds.manage');

        const rows = await holderRows(ev.eventId, lamine.userId);
        assertHolderSeries(rows, lamine, ticketId, 'NO_REAL_EMAIL');
        assert.ok(rows.every((r) => r.actor_id === admin.userId), `acteur = l'admin : ${JSON.stringify(rows.map((r) => r.actor_id))}`);
    });

    test('chaîne A → B → C : seul C, le porteur actuel, est prévenu ; jamais B', async () => {
        const ev = await publishedEvent('det-4');
        const a = await newBuyer('det4-a', { firstName: 'Fatou', lastName: 'Acheteuse' });
        const b = await holderAccount('det4-b', 'Moussa');
        const c = await holderAccount('det4-c', 'Lamine');
        await withoutRealEmail(c);
        const ticketId = await boughtTicket(a, ev);
        await transfer(ticketId, a, b);
        await transfer(ticketId, b, c);

        await refundOk(partner, ev.eventId, ticketId, 'remboursement après deux transferts');

        assertHolderSeries(await holderRows(ev.eventId, c.userId), c, ticketId, 'NO_REAL_EMAIL');
        assert.deepEqual(brief(await holderRows(ev.eventId, b.userId)), '[]', 'aucune ligne pour l\'ancien détenteur B');
        assert.deepEqual(brief(await holderRows(ev.eventId, a.userId)), '[]', 'aucune ligne pour l\'acheteuse A');
    });

    test('billet payé en espèces, transféré, remboursé : le texte 0.2 remplace TICKET_CANCELLED CASH (B-D2)', async () => {
        const ev = await publishedEvent('det-5');
        const fatou = await newBuyer('det5-fatou', { firstName: 'Fatou', lastName: 'Acheteuse' });
        const lamine = await holderAccount('det5-lamine', 'Lamine');
        await withoutRealEmail(lamine);
        const ticketId = await cashTicket(fatou, ev);
        await transfer(ticketId, fatou, lamine);

        const res = await refundOk(partner, ev.eventId, ticketId, 'remboursement d\'un billet payé en espèces');
        assert.equal(res.body.mode, 'ORGANISATEUR', `espèces : remboursement par l'organisateur : ${show(res)}`);

        const rows = await holderRows(ev.eventId, lamine.userId);
        assertHolderSeries(rows, lamine, ticketId, 'NO_REAL_EMAIL');
        const cancelled = (await outboxRows({ type: 'TICKET_CANCELLED', eventId: ev.eventId })).filter((r) => r.template_data.ticket_id === ticketId);
        assert.deepEqual(brief(cancelled), '[]', 'aucune ligne TICKET_CANCELLED pour ce billet (le porteur reçoit le texte 0.2)');
        assert.deepEqual(await deliverHolderSms(rows, lamine), [holderSms(VIP, ev.title)], 'SMS du porteur, texte de la consigne 0.2');
    });

    test('report de plus de 24 h, remboursement demandé par le porteur lui-même : message envoyé (B-D3)', async () => {
        const ev = await publishedEvent('det-6');
        const fatou = await newBuyer('det6-fatou', { firstName: 'Fatou', lastName: 'Acheteuse' });
        const lamine = await holderAccount('det6-lamine', 'Lamine');
        await withoutRealEmail(lamine);
        const ticketId = await boughtTicket(fatou, ev);
        await transfer(ticketId, fatou, lamine);
        await postpone(ev.eventId, 48);

        const handler = await routeHandler(CLIENT_REFUND_ROUTE, 'POST', 'POST /api/tickets/[id]/refund');
        const res = await invoke(handler, jsonRequest(`/api/tickets/${ticketId}/refund`, 'POST', lamine.accessToken, { confirm: true }), ctx({ id: ticketId }));
        await settle(ticketId);
        assert.equal(res.status, 200, `demande du porteur après un report de 48 h : ${show(res)}`);
        assert.equal(res.body.to_original_buyer, true, show(res));

        assertHolderSeries(await holderRows(ev.eventId, lamine.userId), lamine, ticketId, 'NO_REAL_EMAIL');
    });

    test('double clic : deux remboursements simultanés, une seule série de 4 lignes', async () => {
        const ev = await publishedEvent('det-7');
        const fatou = await newBuyer('det7-fatou', { firstName: 'Fatou', lastName: 'Acheteuse' });
        const lamine = await holderAccount('det7-lamine', 'Lamine');
        await withoutRealEmail(lamine);
        const ticketId = await boughtTicket(fatou, ev);
        await transfer(ticketId, fatou, lamine);

        const settled = await Promise.allSettled([partnerRefund(partner, ev.eventId, ticketId), partnerRefund(partner, ev.eventId, ticketId)]);
        await settle(ticketId);
        const results = settled.map((s) => {
            assert.equal(s.status, 'fulfilled', `appel de la route : ${s.status === 'rejected' ? String(s.reason) : ''}`);
            return (s as PromiseFulfilledResult<RouteResult>).value;
        });
        const fresh = results.filter((r) => r.status === 200 && r.body.already === false);
        assert.equal(fresh.length, 1, `un seul remboursement effectif : ${results.map(show).join(' | ')}`);
        const other = results.find((r) => r !== fresh[0])!;
        assert.ok((other.status === 200 && other.body.already === true) || other.status === 409, `second clic : rejeu ou refus : ${show(other)}`);

        assertHolderSeries(await holderRows(ev.eventId, lamine.userId), lamine, ticketId, 'NO_REAL_EMAIL');
    });
});

describe('9t.2 (0.2) : témoins, jamais un autre destinataire à la place du porteur', () => {
    test('témoin : billet payé non transféré, remboursé : aucune ligne TICKET_REFUNDED_HOLDER, REFUND_REQUESTED à l\'acheteuse', async () => {
        const ev = await publishedEvent('det-8');
        const fatou = await newBuyer('det8-fatou', { firstName: 'Fatou', lastName: 'Acheteuse' });
        const ticketId = await boughtTicket(fatou, ev);
        await refundOk(partner, ev.eventId, ticketId, 'remboursement d\'un billet non transféré');
        assert.deepEqual(brief(await holderRows(ev.eventId)), '[]', 'aucune ligne TICKET_REFUNDED_HOLDER pour l\'événement');
        const payer = await outboxRows({ type: 'REFUND_REQUESTED', eventId: ev.eventId, userId: fatou.userId });
        assert.ok(payer.length > 0, `REFUND_REQUESTED inchangé : ${brief(payer)}`);
    });

    test('témoin : billet gratuit transféré et accepté, annulé : TICKET_CANCELLED kind FREE au porteur, aucune ligne TICKET_REFUNDED_HOLDER', async () => {
        const ev = await publishedEvent('det-9');
        const fatou = await newBuyer('det9-fatou', { firstName: 'Fatou', lastName: 'Acheteuse' });
        const lamine = await holderAccount('det9-lamine', 'Lamine');
        const ticketId = await issueFreeTicket(ev.eventId, ev.categories[FREE].id, fatou);
        await transfer(ticketId, fatou, lamine);
        const res = await refundOk(partner, ev.eventId, ticketId, 'annulation d\'un billet gratuit');
        assert.equal(res.body.mode, 'AUCUN', `billet gratuit : aucun remboursement : ${show(res)}`);
        const cancelled = (await outboxRows({ type: 'TICKET_CANCELLED', eventId: ev.eventId, userId: lamine.userId }))
            .filter((r) => r.template_data.ticket_id === ticketId);
        assert.ok(cancelled.length > 0, `TICKET_CANCELLED au porteur : ${brief(cancelled)}`);
        assert.ok(cancelled.every((r) => r.template_data.kind === 'FREE'), `kind FREE : ${JSON.stringify(cancelled.map((r) => r.template_data.kind))}`);
        assert.deepEqual(brief(await holderRows(ev.eventId)), '[]', 'aucune ligne TICKET_REFUNDED_HOLDER');
    });

    test('témoin : A → B → A (billet revenu au payeur), remboursé : aucune ligne (porteur = payeur, règle R13)', async () => {
        const ev = await publishedEvent('det-10');
        const a = await holderAccount('det10-a', 'Fatou');
        const b = await holderAccount('det10-b', 'Moussa');
        const ticketId = await boughtTicket(a, ev);
        await transfer(ticketId, a, b);
        await transfer(ticketId, b, a);
        await refundOk(partner, ev.eventId, ticketId, 'remboursement d\'un billet revenu au payeur');
        assert.deepEqual(brief(await holderRows(ev.eventId)), '[]', 'aucune ligne TICKET_REFUNDED_HOLDER');
    });

    test('témoin : annulation de l\'événement, chaîne A → B → C : C EVENT_CANCELLED mode TRANSFERRED, A mode AUTO, B rien, aucune ligne TICKET_REFUNDED_HOLDER', async () => {
        const ev = await publishedEvent('det-11');
        const a = await newBuyer('det11-a', { firstName: 'Fatou', lastName: 'Acheteuse' });
        const b = await holderAccount('det11-b', 'Moussa');
        const c = await holderAccount('det11-c', 'Lamine');
        const ticketId = await boughtTicket(a, ev);
        await transfer(ticketId, a, b);
        await transfer(ticketId, b, c);

        assertRpcOk(await rpcCancel(ev.eventId, partner.userId, {
            publicNotice: 'Salle indisponible ce soir', internalReason: 'Test 9 ter, preuve A → B → C', confirmTitle: ev.title,
        }), 'annulation par la partenaire');

        const inApp = async (userId: string): Promise<OutboxRow[]> => outboxRows({ type: 'EVENT_CANCELLED', eventId: ev.eventId, userId, channel: 'IN_APP' });
        const cRows = await inApp(c.userId);
        assert.ok(cRows.length > 0, 'C, porteur au moment de l\'annulation, est prévenu');
        assert.deepEqual(Array.from(new Set(cRows.map((r) => r.template_data.refund_mode))), ['TRANSFERRED'], `C : mode TRANSFERRED : ${brief(cRows)}`);
        const aRows = await inApp(a.userId);
        assert.ok(aRows.length > 0, 'A, acheteuse sans billet, est prévenue');
        assert.deepEqual(Array.from(new Set(aRows.map((r) => r.template_data.refund_mode))), ['AUTO'], `A : mode AUTO : ${brief(aRows)}`);
        assert.deepEqual(brief(await outboxRows({ type: 'EVENT_CANCELLED', eventId: ev.eventId, userId: b.userId })), '[]', 'B, ancien détenteur : rien');
        assert.deepEqual(brief(await holderRows(ev.eventId)), '[]', 'aucune ligne TICKET_REFUNDED_HOLDER en contexte d\'annulation');
    });
});

// ── Report (cas 6) ─────────────────────────────────────────────────────────

interface EventDates { start_date: string; start_time: string; end_date: string | null; end_time: string | null; updated_at: string }

function columns(at: Date): { date: string; time: string } {
    const iso = at.toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 19) };
}

/** Report de `hours` heures par event_update (propriétaire, version attendue), patron lot9bis-report.test.ts. */
async function postpone(eventId: string, hours: number): Promise<void> {
    const { data, error } = await service.from('events').select('start_date, start_time, end_date, end_time, updated_at').eq('id', eventId).single();
    assert.equal(error, null, `dates de l'événement : ${error?.message}`);
    const d = data as EventDates;
    const s = columns(new Date(new Date(`${d.start_date}T${d.start_time}Z`).getTime() + hours * HOUR));
    const patch: Row = { start_date: s.date, start_time: s.time };
    if (d.end_date && d.end_time) {
        const e = columns(new Date(new Date(`${d.end_date}T${d.end_time}Z`).getTime() + hours * HOUR));
        patch.end_date = e.date;
        patch.end_time = e.time;
    }
    const { data: res, error: upErr } = await service.rpc('event_update', { p: { event_id: eventId, actor_id: partner.userId, expected_updated_at: d.updated_at, patch } });
    assert.equal(upErr, null, `event_update (report de ${hours} h) : ${upErr?.message}`);
    assert.equal((res as Row | null)?.ok, true, `report de ${hours} h refusé : ${JSON.stringify(res)}`);
}
