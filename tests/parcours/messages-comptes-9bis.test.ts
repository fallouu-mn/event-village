/**
 * Lot 9 bis, tâche 34 (R22, R23, R59 ; contrat 5.34, B73, B74, 11.1 N18 à N20, 11.2 M2) — billets annulés, transfert
 * révoqué, client suspendu :
 *  1. invitation non réclamée annulée (POST …/invitations/[ticketId]/cancel) → TICKET_CANCELLED par SMS au numéro,
 *     sans compte, texte exact (variante invitation) ;
 *  2. invitation réclamée (attribuée au compte vérifié) annulée → TICKET_CANCELLED IN_APP et SMS au compte ;
 *  3. billet gratuit remboursé par la partenaire (POST …/tickets/[ticketId]/refund) → TICKET_CANCELLED `kind` FREE,
 *     SMS exact ; billet payé en espèces (createCashOrderTickets, hors plateforme) → `kind` CASH, SMS exact ;
 *  4. témoin : event_cancel n'ajoute aucun TICKET_CANCELLED (les porteurs ont EVENT_CANCELLED) ;
 *  5. R23 : transfert PENDING d'un porteur vers un numéro, puis annulation de l'événement → EVENT_CANCELLED au
 *     numéro du destinataire, sans compte, « … Le billet qui vous était destiné n'est plus valable. » ;
 *  6. R59 : admin_user_status_set suspend un client avec motif → ACCOUNT_SUSPENDED SMS SENT malgré le statut (texte
 *     exact) ; réactivation → ACCOUNT_REACTIVATED (texte exact) ; témoin : compte partenaire refusé par la RPC, statut
 *     intact, aucun avis ;
 *  7. R59, règle d'entrée (B74, décision A8) : billet payé d'un client suspendu, scan d'un code valide → `valid`.
 *     Non reproduit probable, vert dès l'écriture (ticket_scan ne lit pas le statut du porteur,
 *     M/20261108000005:104,141) : garde-fou de la décision, le statut est posé comme le fait la route actuelle.
 * Lot 9 bis, tâche 37 (R79 ; contrat 5.37, B78, 11.2 M3) — invitation à un compte vérifié : INVITATION_RECEIVED aussi
 * en in-app et push (et email) au compte ; la ligne SMS reste sans compte ni acteur (AR15 du lot 9). Rouge : SMS seul,
 * sans compte (M/20261108000002:477-482).
 *
 * Rouge avant correctif : ticket_invitation_cancel ne met rien en file (M/20261108000002:501), ticket_refund_request
 * n'avise pas dans ses branches gratuit et espèces (M/20261108000001:69-86), event_cancel révoque les transferts sans
 * avis (M/20261106000003:364-367), la RPC admin_user_status_set n'existe pas (l'appel la nomme) ; la confirmation
 * du mot de passe avant le transfert manque jusqu'à fix(9b.13). after() : la garde de schéma du lot 9 bis nomme les
 * objets absents jusqu'à M12 (attendu).
 * Envois comptés par numéro neuf et par texte exact, jamais globalement.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { smsDateTime } from '../../lib/notifications/sms-format';
import { confirmPassword, randomSenegalPhone, routeContext, STRONG_PASSWORD } from './helpers';
import { eventTickets, newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { authed, createCashOrderTickets, newController, scan, ticketPayload, type RouteResult } from './acces-helpers';
import { advanceEventTo, assertRpcOk, createDraftEvent, rpcCancel, type DraftEvent, type RpcBody } from './cycle-helpers';
import { flushNotifications, markPhoneVerified, outboxRows, smsMark, smsTo, type OutboxRow } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { issueFreeTicket } from './terrain-helpers';

type Row = Record<string, unknown>;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
const STANDARD = 'Standard';
const FREE = 'Entree libre';
const CATEGORIES: CategorySpec[] = [{ name: STANDARD, price: 3_000, total: 40, maxPerOrder: 10 }, { name: FREE, price: 0, total: 40, maxPerOrder: 10 }];
const INVITE_ROUTE = '../../app/api/partner/events/[id]/invitations/route';
const INVITE_CANCEL_ROUTE = '../../app/api/partner/events/[id]/invitations/[ticketId]/cancel/route';
const REFUND_ROUTE = '../../app/api/partner/events/[id]/tickets/[ticketId]/refund/route';
const TRANSFER_ROUTE = '../../app/api/tickets/[id]/transfer/route';
const PUBLIC_NOTICE = 'Salle indisponible ce soir';
const SUSPEND_REASON = 'Fraude au paiement signalee';

let partner: TestPartner;

before(async () => {
    assert.ok(APP_URL.startsWith('http'), 'NEXT_PUBLIC_APP_URL absente de .env.test');
    partner = await newPartner('msg-comptes');
});

after(async () => {
    await assertLot9bisInvariants('messages-comptes-9bis');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

/** Titre court, GSM-7, jamais tronqué par smsVar (20 caractères au plus). */
function shortTitle(prefix: string): string {
    const t = `${prefix} ${randomBytes(2).toString('hex')}`;
    assert.ok(t.length <= 20 && /^[A-Za-z0-9 ]+$/.test(t), `titre de test « ${t} » : 20 caractères GSM-7 au plus`);
    return t;
}

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

/** Événement PUBLIE de la partenaire, titre court, début dans `startsInHours` heures. */
async function publishedEvent(label: string, startsInHours = 96): Promise<DraftEvent> {
    const ev = await createDraftEvent(partner, `msg-cpt ${label}`, CATEGORIES, { title: shortTitle(label), startsInHours });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    return ev;
}

/** Début de l'événement (Dakar = UTC+0), au format des SMS (smsDateTime). */
async function smsStart(eventId: string): Promise<string> {
    const { data, error } = await service.from('events').select('start_date, start_time').eq('id', eventId).single();
    assert.equal(error, null, `événement ${eventId} : ${error?.message}`);
    const time = String(data.start_time).length === 5 ? `${String(data.start_time)}:00` : String(data.start_time);
    return smsDateTime(`${String(data.start_date)}T${time}.000Z`);
}

/** Invitation envoyée par la partenaire à un numéro ; rend le billet émis pour ce numéro. */
async function invite(ev: DraftEvent, phone: string): Promise<string> {
    const before = new Set((await eventTickets(ev.eventId)).map((t) => String(t.id)));
    const handler = await routeHandler(INVITE_ROUTE, 'POST', 'POST /api/partner/events/[id]/invitations (lot 9, contrat 4.1)');
    const res = await invoke(handler, authed(`/api/partner/events/${ev.eventId}/invitations`, 'POST', partner,
        { category_id: ev.categories[STANDARD].id, phones: [phone], quantity: 1 }), routeContext({ id: ev.eventId }));
    assert.equal(res.status, 200, `invitation : ${show(res)}`);
    const added = (await eventTickets(ev.eventId)).filter((t) => !before.has(String(t.id)) && t.sale_channel === 'INVITATION');
    assert.equal(added.length, 1, `un billet d'invitation émis : ${JSON.stringify(added.map((t) => t.id))}`);
    return String(added[0].id);
}

async function cancelInvitation(ev: DraftEvent, ticketId: string): Promise<void> {
    const handler = await routeHandler(INVITE_CANCEL_ROUTE, 'POST', 'POST /api/partner/events/[id]/invitations/[ticketId]/cancel (lot 9)');
    const res = await invoke(handler, authed(`/api/partner/events/${ev.eventId}/invitations/${ticketId}/cancel`, 'POST', partner), ctx({ id: ev.eventId, ticketId }));
    assert.equal(res.status, 200, `annulation de l'invitation : ${show(res)}`);
}

async function partnerRefund(ev: DraftEvent, ticketId: string): Promise<RouteResult> {
    const handler = await routeHandler(REFUND_ROUTE, 'POST', 'POST /api/partner/events/[id]/tickets/[ticketId]/refund');
    return invoke(handler, jsonRequest(`/api/partner/events/${ev.eventId}/tickets/${ticketId}/refund`, 'POST', partner.accessToken,
        { reason: 'Annulation demandée par le client' }), ctx({ id: ev.eventId, ticketId }));
}

/** admin_user_status_set (contrat X9, M04) appelée comme la route : acteur SUPERADMIN, motif. */
async function rpcUserStatus(userId: string, status: 'ACTIF' | 'SUSPENDU', reason: string): Promise<{ data: RpcBody | null; error: { message: string; code?: string } | null }> {
    const { data, error } = await service.rpc('admin_user_status_set', { p: { actor_id: await superadminId(), user_id: userId, status, reason } });
    return { data: (data ?? null) as RpcBody | null, error };
}

function describeRows(rows: OutboxRow[]): string {
    return JSON.stringify(rows.map((r) => [r.type, r.channel, r.status, r.reason, r.recipient_phone, r.template_data.kind ?? null]));
}

// ── R22 : invitation, billet gratuit ou payé en espèces annulé ──────────────

describe('9b.34 R22 : TICKET_CANCELLED au détenteur d\'une invitation, d\'un billet gratuit ou payé en espèces', () => {
    test('invitation non réclamée annulée : TICKET_CANCELLED par SMS au numéro, sans compte, texte exact', async () => {
        const ev = await publishedEvent('Invit numero');
        const phone = randomSenegalPhone('76');
        const ticketId = await invite(ev, phone);
        const mark = smsMark(phone);
        const date = await smsStart(ev.eventId);
        await cancelInvitation(ev, ticketId);

        const rows = await outboxRows({ type: 'TICKET_CANCELLED', phone });
        assert.deepEqual(rows.map((r) => [r.channel, r.recipient_user_id, r.event_id]), [['SMS', null, ev.eventId]],
            `une ligne SMS au numéro, sans compte : ${describeRows(rows)}`);
        await flushNotifications({ eventIds: [ev.eventId] });
        assert.deepEqual(smsTo(phone, mark).map((m) => m.text),
            [`Event Village : votre invitation pour ${ev.title} du ${date} est annulée par l'organisateur.`],
            'un SMS au numéro, texte exact (11.1 N18, invitation)');
    });

    test('invitation réclamée (attribuée au compte) annulée : TICKET_CANCELLED in-app et SMS au compte', async () => {
        const ev = await publishedEvent('Invit compte');
        const account = await newBuyer('cpt-invite', { firstName: 'Fatou', lastName: 'Invitee' });
        await markPhoneVerified(account.userId);
        const ticketId = await invite(ev, account.phoneE164);
        const { data: t, error } = await service.from('tickets').select('user_id').eq('id', ticketId).single();
        assert.equal(error, null, `billet : ${error?.message}`);
        assert.equal(t.user_id, account.userId, 'précondition : invitation attribuée au compte vérifié');
        await cancelInvitation(ev, ticketId);

        const rows = await outboxRows({ type: 'TICKET_CANCELLED', userId: account.userId });
        const chans = rows.map((r) => r.channel);
        assert.ok(chans.includes('IN_APP') && chans.includes('SMS'), `TICKET_CANCELLED in-app et SMS au compte : ${describeRows(rows)}`);
        assert.ok(rows.every((r) => r.template_data.kind === 'INVITATION'), `variante invitation : ${describeRows(rows)}`);
    });

    test('billet gratuit remboursé par la partenaire : TICKET_CANCELLED FREE, SMS exact ; billet payé en espèces : CASH, SMS exact', async () => {
        const ev = await publishedEvent('Gratuit cash');
        const date = await smsStart(ev.eventId);
        const freeHolder = await newBuyer('cpt-gratuit');
        const freeTicket = await issueFreeTicket(ev.eventId, ev.categories[FREE].id, freeHolder);
        const cashHolder = await newBuyer('cpt-especes');
        const cash = await createCashOrderTickets(cashHolder, partner, ev, STANDARD, 1);
        const freeMark = smsMark(freeHolder.phoneE164);
        const cashMark = smsMark(cashHolder.phoneE164);

        const free = await partnerRefund(ev, freeTicket);
        assert.equal(free.status, 200, `remboursement du billet gratuit : ${show(free)}`);
        const cashRes = await partnerRefund(ev, cash.ticketIds[0]);
        assert.equal(cashRes.status, 200, `remboursement du billet payé en espèces : ${show(cashRes)}`);

        const freeRows = await outboxRows({ type: 'TICKET_CANCELLED', userId: freeHolder.userId });
        assert.ok(freeRows.some((r) => r.channel === 'SMS') && freeRows.every((r) => r.template_data.kind === 'FREE'), `TICKET_CANCELLED FREE : ${describeRows(freeRows)}`);
        const cashRows = await outboxRows({ type: 'TICKET_CANCELLED', userId: cashHolder.userId });
        assert.ok(cashRows.some((r) => r.channel === 'SMS') && cashRows.every((r) => r.template_data.kind === 'CASH'), `TICKET_CANCELLED CASH : ${describeRows(cashRows)}`);

        await flushNotifications({ eventIds: [ev.eventId] });
        assert.deepEqual(smsTo(freeHolder.phoneE164, freeMark).map((m) => m.text),
            [`Event Village : votre billet gratuit pour ${ev.title} du ${date} est annulé par l'organisateur.`], 'SMS exact (11.1 N18, gratuit)');
        assert.deepEqual(smsTo(cashHolder.phoneE164, cashMark).map((m) => m.text),
            [`Event Village : votre billet pour ${ev.title} du ${date} est annulé. Remboursement par l'organisateur.`], 'SMS exact (11.1 N18, espèces)');
    });

    test('témoin : event_cancel n\'ajoute aucun TICKET_CANCELLED (les porteurs reçoivent EVENT_CANCELLED)', async () => {
        const ev = await publishedEvent('Annul temoin');
        const holder = await newBuyer('cpt-temoin');
        await issueFreeTicket(ev.eventId, ev.categories[FREE].id, holder);
        await invite(ev, randomSenegalPhone('76'));
        assertRpcOk(await rpcCancel(ev.eventId, partner.userId, { publicNotice: PUBLIC_NOTICE, internalReason: 'Test du lot 9 bis', confirmTitle: ev.title }), 'annulation');
        assert.deepEqual(await outboxRows({ type: 'TICKET_CANCELLED', eventId: ev.eventId }), [], 'aucun TICKET_CANCELLED pendant event_cancel (D11)');
        assert.ok((await outboxRows({ type: 'EVENT_CANCELLED', eventId: ev.eventId, userId: holder.userId })).length > 0, 'le porteur reçoit EVENT_CANCELLED');
    });
});

// ── R23 : transfert révoqué par l'annulation ───────────────────────────────

describe('9b.34 R23 : destinataire d\'un transfert révoqué par l\'annulation prévenu par SMS', () => {
    test('transfert PENDING vers un numéro, annulation : EVENT_CANCELLED au numéro, sans compte, texte exact', async () => {
        const ev = await publishedEvent('Transfert revoque');
        const holder = await newBuyer('cpt-expediteur');
        const purchase = await buyConfirmed(holder, ev, [[STANDARD, 1]]);
        const ticketId = String(purchase.tickets[0].id);
        const recipient = randomSenegalPhone('76');
        await confirmPassword(holder, STRONG_PASSWORD);
        const initiate = await routeHandler(TRANSFER_ROUTE, 'POST', 'POST /api/tickets/[id]/transfer');
        const init = await invoke(initiate, authed(`/api/tickets/${ticketId}/transfer`, 'POST', holder, { recipient }), routeContext({ id: ticketId }));
        assert.equal(init.status, 200, `initiation du transfert : ${show(init)}`);
        const mark = smsMark(recipient);
        const date = await smsStart(ev.eventId);

        assertRpcOk(await rpcCancel(ev.eventId, partner.userId, { publicNotice: PUBLIC_NOTICE, internalReason: 'Test du lot 9 bis', confirmTitle: ev.title }), 'annulation');

        const rows = await outboxRows({ type: 'EVENT_CANCELLED', phone: recipient });
        assert.deepEqual(rows.map((r) => [r.channel, r.recipient_user_id, r.event_id]), [['SMS', null, ev.eventId]],
            `une ligne SMS au numéro du destinataire du transfert révoqué : ${describeRows(rows)}`);
        await flushNotifications({ eventIds: [ev.eventId] });
        assert.deepEqual(smsTo(recipient, mark).map((m) => m.text),
            [`Event Village : ${ev.title} du ${date} est annulé. Le billet qui vous était destiné n'est plus valable.`],
            'un SMS au destinataire, texte exact (11.2 M2, numéro seul NONE)');
    });
});

// ── R59 : client suspendu ou réactivé ──────────────────────────────────────

describe('9b.34 R59 : client suspendu ou réactivé prévenu par SMS avec motif ; ses billets payés restent valables', () => {
    test('suspension avec motif : ACCOUNT_SUSPENDED SMS SENT malgré le statut, texte exact ; réactivation : ACCOUNT_REACTIVATED, texte exact', async () => {
        const client = await newBuyer('cpt-suspendu', { firstName: 'Awa', lastName: 'Cliente' });
        const mark = smsMark(client.phoneE164);

        const suspended = await rpcUserStatus(client.userId, 'SUSPENDU', SUSPEND_REASON);
        assert.equal(suspended.error, null, `admin_user_status_set (contrat X9, M04) : ${suspended.error?.message} (code ${suspended.error?.code})`);
        assert.equal(suspended.data?.ok, true, `suspension refusée : ${JSON.stringify(suspended.data)}`);
        const { data: u, error: uErr } = await service.from('users').select('status').eq('id', client.userId).single();
        assert.equal(uErr, null, `compte : ${uErr?.message}`);
        assert.equal(u.status, 'SUSPENDU', 'compte suspendu');
        const sRows = await outboxRows({ type: 'ACCOUNT_SUSPENDED', userId: client.userId });
        await flushNotifications({ ids: sRows.map((r) => r.id) });
        const sSms = (await outboxRows({ type: 'ACCOUNT_SUSPENDED', userId: client.userId, channel: 'SMS' }));
        assert.deepEqual(sSms.map((r) => [r.status, r.reason]), [['SENT', null]], `SMS envoyé malgré la suspension (politique ALLOW) : ${describeRows(sSms)}`);
        assert.deepEqual(smsTo(client.phoneE164, mark).map((m) => m.text),
            [`Event Village : votre compte est suspendu. Motif : ${SUSPEND_REASON}. Vos billets payés restent valables à l'entrée. Contactez le support.`],
            'SMS exact (11.1 N19)');

        const second = smsMark(client.phoneE164);
        const reactivated = await rpcUserStatus(client.userId, 'ACTIF', 'Vérification terminée');
        assert.equal(reactivated.error, null, `réactivation : ${reactivated.error?.message}`);
        assert.equal(reactivated.data?.ok, true, `réactivation refusée : ${JSON.stringify(reactivated.data)}`);
        const rRows = await outboxRows({ type: 'ACCOUNT_REACTIVATED', userId: client.userId });
        await flushNotifications({ ids: rRows.map((r) => r.id) });
        assert.deepEqual(smsTo(client.phoneE164, second).map((m) => m.text),
            [`Event Village : votre compte est réactivé. Vous pouvez de nouveau vous connecter : ${APP_URL}/login`], 'SMS exact (11.1 N20)');
    });

    test('témoin : un compte partenaire est refusé par la RPC (fiche partenaire), statut intact, aucun avis', async () => {
        const other = await newPartner('msg-cpt-part');
        const res = await rpcUserStatus(other.userId, 'SUSPENDU', SUSPEND_REASON);
        assert.equal(res.error, null, `admin_user_status_set (contrat X9, M04) : ${res.error?.message} (code ${res.error?.code})`);
        assert.equal(res.data?.ok, false, `compte partenaire : refus attendu, ${JSON.stringify(res.data)}`);
        assert.equal(res.data?.code, 'PARTNER_STATUS_VIA_PARTNER_SHEET', `refus renvoyé à la fiche partenaire (B38) : ${JSON.stringify(res.data)}`);
        const { data: u, error } = await service.from('users').select('status').eq('id', other.userId).single();
        assert.equal(error, null, `compte : ${error?.message}`);
        assert.equal(u.status, 'ACTIF', 'statut intact');
        assert.deepEqual(await outboxRows({ type: 'ACCOUNT_SUSPENDED', userId: other.userId }), [], 'aucun avis');
    });

    test('règle d\'entrée (B74, A8) : billet payé d\'un client suspendu, code valide scanné → valid (vert dès l\'écriture)', async () => {
        const ev = await publishedEvent('Entree suspendu', 1);
        const controller = await newController(partner, ev.eventId, { label: 'cpt-entree' });
        const client = await newBuyer('cpt-entree');
        const purchase = await buyConfirmed(client, ev, [[STANDARD, 1]]);
        const ticketId = String(purchase.tickets[0].id);
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', client.userId);
        assert.equal(error, null, `suspension du client (comme la route actuelle) : ${error?.message}`);

        const r = await scan(controller, { eventId: ev.eventId, payload: await ticketPayload(ticketId) });
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.result, 'valid', `billet payé d'un client suspendu valable à l'entrée (décision A8) : ${show(r)}`);
    });
});

// ── R79 : invité qui a un compte ───────────────────────────────────────────

describe('9b.37 R79 : avis in-app à l\'invité qui a un compte', () => {
    test('invitation à un compte vérifié : INVITATION_RECEIVED in-app et push au compte ; la ligne SMS reste sans compte ni acteur', async () => {
        const ev = await publishedEvent('Invit inapp');
        const account = await newBuyer('cpt-r79', { firstName: 'Mariama', lastName: 'Invitee' });
        await markPhoneVerified(account.userId);
        await invite(ev, account.phoneE164);

        const toAccount = await outboxRows({ type: 'INVITATION_RECEIVED', eventId: ev.eventId, userId: account.userId });
        const chans = toAccount.map((r) => r.channel);
        assert.ok(chans.includes('IN_APP') && chans.includes('PUSH'), `in-app et push au compte (R79) : ${describeRows(toAccount)}`);
        assert.ok(!chans.includes('SMS'), `le SMS ne part pas par le compte : ${describeRows(toAccount)}`);
        const sms = await outboxRows({ type: 'INVITATION_RECEIVED', eventId: ev.eventId, channel: 'SMS' });
        assert.deepEqual(sms.map((r) => [r.recipient_phone, r.recipient_user_id, r.actor_id]), [[account.phoneE164, null, null]],
            `une ligne SMS au numéro, sans compte ni acteur (AR15) : ${describeRows(sms)}`);
    });
});
