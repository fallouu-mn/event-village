/**
 * Lot 9 bis, tâche 30 (R12 ; contrat 5.30, B69, 11.2 M1 et M2) — les numéros sans compte sont prévenus d'une
 * annulation et d'un changement de date ou de lieu, par SMS indispensable :
 *  1. invitation non réclamée (numéro sans compte), annulation par la partenaire → une ligne EVENT_CANCELLED SMS au
 *     numéro, `recipient_user_id` NULL, SMS remis au texte exact « … Le billet qui vous était destiné n'est plus
 *     valable. » (11.2 M2, numéro seul NONE, sans lien) ;
 *  2. vente au guichet avec numéro, annulation pendant l'événement par un admin → SMS « … Remboursement par
 *     l'organisateur. » au +221… (11.2 M2, numéro seul ORGANIZER, sans lien) ; vente au guichet sans numéro : aucune
 *     ligne (une seule ligne « numéro seul » pour l'événement, celle du numéro saisi) ;
 *  3. changement de lieu (PUT /api/partner/events/[id]) avec une invitation non réclamée → une ligne EVENT_CHANGED SMS
 *     au numéro, PENDING, `due_at` à maintenant + 10 minutes (B71) ;
 *  4. statique : aide du champ numéro du guichet = texte de la consigne (« Pour être prévenu en cas de changement ou
 *     d'annulation »), l'ancienne aide retirée ; message de l'éditeur « … SMS partiront dans 10 minutes (vos
 *     corrections d’ici là y seront regroupées). » (contrat 5.30, écrans E-D).
 *
 * Rouge avant correctif : le trigger d'annulation ne parcourt que les porteurs à compte (`t.user_id IS NOT NULL`,
 * M/20261103000005:1298-1299) et event_update joint les porteurs à `users` (M/20261108000001:433) : aucune ligne au
 * numéro, chaque cas échoue sur le nombre de lignes ; les écrans gardent leurs anciens textes
 * (components/scan/CounterSalePanel.tsx:235, components/events/EventForm.tsx:745). after() : la garde de schéma
 * du lot 9 bis nomme les objets absents jusqu'à M12 (attendu, contrat section 10).
 *
 * Lot 9 bis, tâche 31 (R13 ; contrat 5.31, B70, 11.2 M2) — billet reçu par transfert : Fatou achète, transfère à
 * Lamine qui accepte (mot de passe confirmé avant le transfert, R57), puis la partenaire annule. La ligne in-app de
 * Lamine (mode TRANSFERRED) dit « acheteur d'origine » et non « Votre remboursement est en cours » ; son SMS dit
 * « Remboursement à l'acheteur d'origine. » (texte exact, 11.2 M2) ; Fatou, sans billet, reçoit EVENT_CANCELLED
 * (clé `EVENT_CANCELLED:<event>:<fatou>`) en mode AUTO. Rouge : le mode est AUTO dès que le porteur détient un billet
 * payé en ligne (M/20261103000005:1308-1312) et Fatou, sans billet, est hors de la boucle des porteurs ; la route de
 * confirmation du mot de passe manque jusqu'à fix(9b.13) (l'aide confirmPassword la nomme).
 * Envois comptés par numéro neuf (randomSenegalPhone) et par texte exact, jamais globalement.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { smsDateTime } from '../../lib/notifications/sms-format';
import { confirmPassword, randomSenegalPhone, routeContext, STRONG_PASSWORD } from './helpers';
import { eventTickets, newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { authed, newController, type RouteResult } from './acces-helpers';
import { advanceEventTo, assertRpcOk, createDraftEvent, rpcCancel, shiftEventDates, type DraftEvent } from './cycle-helpers';
import { flushNotifications, markPhoneVerified, outboxRows, smsMark, smsTo, type OutboxRow } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

type Row = Record<string, unknown>;

const ROOT = process.cwd();
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
const STANDARD = 'Standard';
const CATEGORIES: CategorySpec[] = [{ name: STANDARD, price: 3_000, total: 40, maxPerOrder: 10 }];
const INVITE_ROUTE = '../../app/api/partner/events/[id]/invitations/route';
const EVENT_ROUTE = '../../app/api/partner/events/[id]/route';
const PIN_ROUTE = '../../app/api/partner/events/[id]/regisseur-pin/route';
const OPEN_ROUTE = '../../app/api/controller/shifts/open/route';
const COUNTER_ROUTE = '../../app/api/controller/counter-sale/route';
const TRANSFER_ROUTE = '../../app/api/tickets/[id]/transfer/route';
const CLAIM_ROUTE = '../../app/api/tickets/transfers/[id]/claim/route';
const PUBLIC_NOTICE = 'Salle indisponible ce soir';
const INTERNAL_REASON = 'Test du lot 9 bis';

let partner: TestPartner;

before(async () => {
    assert.ok(APP_URL.startsWith('http'), 'NEXT_PUBLIC_APP_URL absente de .env.test');
    partner = await newPartner('msg-annulation');
});

after(async () => {
    await assertLot9bisInvariants('messages-annulation-9bis');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

/** Titre court, GSM-7, jamais tronqué par smsVar (25 caractères au plus). */
function shortTitle(prefix: string): string {
    const t = `${prefix} ${randomBytes(2).toString('hex')}`;
    assert.ok(t.length <= 25 && /^[A-Za-z0-9 ]+$/.test(t), `titre de test « ${t} » : 25 caractères GSM-7 au plus`);
    return t;
}

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

/** Événement PUBLIE de la partenaire, titre court, début dans `startsInHours` heures. */
async function publishedEvent(label: string, startsInHours = 72): Promise<DraftEvent> {
    const ev = await createDraftEvent(partner, `msg-annul ${label}`, CATEGORIES, { title: shortTitle(label), startsInHours });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    return ev;
}

async function eventRow(eventId: string): Promise<Row> {
    const { data, error } = await service.from('events').select('*').eq('id', eventId).single();
    assert.equal(error, null, `événement ${eventId} : ${error?.message}`);
    return data as Row;
}

/** Début de l'événement (Dakar = UTC+0), au format des SMS (smsDateTime). */
async function smsStart(eventId: string): Promise<string> {
    const ev = await eventRow(eventId);
    const time = String(ev.start_time).length === 5 ? `${String(ev.start_time)}:00` : String(ev.start_time);
    return smsDateTime(`${String(ev.start_date)}T${time}.000Z`);
}

/** Invitation non réclamée : POST /api/partner/events/[id]/invitations vers un numéro neuf, sans compte. */
async function pendingInvitation(ev: DraftEvent): Promise<string> {
    const phone = randomSenegalPhone('76');
    const handler = await routeHandler(INVITE_ROUTE, 'POST', 'POST /api/partner/events/[id]/invitations (lot 9, contrat 4.1)');
    const res = await invoke(handler, authed(`/api/partner/events/${ev.eventId}/invitations`, 'POST', partner,
        { category_id: ev.categories[STANDARD].id, phones: [phone], quantity: 1 }), routeContext({ id: ev.eventId }));
    assert.equal(res.status, 200, `invitation : ${show(res)}`);
    const { data, error } = await service.from('ticket_transfers').select('id, ticket_id, from_user_id').eq('to_phone_or_email', phone).eq('status', 'PENDING');
    assert.equal(error, null, `transfert d'invitation : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `précondition : une invitation PENDING sans expéditeur vers ${phone} (${JSON.stringify(data)})`);
    assert.equal(data![0].from_user_id, null, 'invitation sans expéditeur (AR15)');
    const tickets = (await eventTickets(ev.eventId)).filter((t) => String(t.id) === String(data![0].ticket_id));
    assert.equal(tickets[0]?.user_id ?? null, null, 'précondition : billet sans porteur (numéro sans compte)');
    return phone;
}

/** Caisse OUVERT du vendeur : PIN régisseur généré par la propriétaire puis passé à l'ouverture (A11, B51). */
async function openShiftWithPin(seller: Buyer, eventId: string): Promise<void> {
    const pinHandler = await routeHandler(PIN_ROUTE, 'POST', 'POST /api/partner/events/[id]/regisseur-pin');
    const pinRes = await invoke(pinHandler, authed(`/api/partner/events/${eventId}/regisseur-pin`, 'POST', partner, { confirm: true }), ctx({ id: eventId }));
    assert.equal(pinRes.status, 200, `génération du PIN régisseur : ${show(pinRes)}`);
    const pin = String(pinRes.body.pin ?? '');
    assert.match(pin, /^\d{6}$/, `PIN renvoyé en clair une fois : ${show(pinRes)}`);
    const openHandler = await routeHandler(OPEN_ROUTE, 'POST', 'POST /api/controller/shifts/open');
    const res = await invoke(openHandler, authed('/api/controller/shifts/open', 'POST', seller, {
        eventId, event_id: eventId, openingFloat: 0, opening_float_amount: 0, pin, regisseurPin: pin, regisseur_pin: pin,
    }));
    assert.equal(res.status, 200, `ouverture de la caisse avec le PIN : ${show(res)}`);
}

/** Vente au guichet d'un billet, avec ou sans numéro de l'acheteur (champ facultatif). */
async function counterSale(seller: Buyer, ev: DraftEvent, buyerPhone: string | null): Promise<RouteResult> {
    const handler = await routeHandler(COUNTER_ROUTE, 'POST', 'POST /api/controller/counter-sale');
    const body: Row = { eventId: ev.eventId, items: [{ categoryId: ev.categories[STANDARD].id, quantity: 1 }] };
    if (buyerPhone) body.buyerPhone = buyerPhone;
    return invoke(handler, authed('/api/controller/counter-sale', 'POST', seller, body, { 'idempotency-key': randomUUID() }));
}

async function putEvent(user: Buyer, eventId: string, patch: Row): Promise<RouteResult> {
    const handler = await routeHandler(EVENT_ROUTE, 'PUT', 'PUT /api/partner/events/[id]');
    const expected = String((await eventRow(eventId)).updated_at);
    return invoke(handler, jsonRequest(`/api/partner/events/${eventId}`, 'PUT', user.accessToken, { patch, expected_updated_at: expected }), routeContext({ id: eventId }));
}

/** Lignes « numéro seul » d'un type pour l'événement : SMS, sans compte destinataire. */
async function phoneOnlyRows(type: string, eventId: string): Promise<OutboxRow[]> {
    return (await outboxRows({ type, eventId, channel: 'SMS' })).filter((r) => r.recipient_user_id === null);
}

function describeRows(rows: OutboxRow[]): string {
    return JSON.stringify(rows.map((r) => [r.recipient_phone, r.status, r.reason, r.template_data.refund_mode ?? null]));
}

// ── R12 : numéros sans compte ──────────────────────────────────────────────

describe('9b.30 R12 : SMS indispensable aux numéros sans compte (invitation non réclamée, acheteur au guichet)', () => {
    test('invitation non réclamée, annulation par la partenaire : EVENT_CANCELLED par SMS au numéro, sans compte, texte exact', async () => {
        const ev = await publishedEvent('Invit annul');
        const phone = await pendingInvitation(ev);
        const mark = smsMark(phone);
        const date = await smsStart(ev.eventId);

        assertRpcOk(await rpcCancel(ev.eventId, partner.userId, { publicNotice: PUBLIC_NOTICE, internalReason: INTERNAL_REASON, confirmTitle: ev.title }), 'annulation par la partenaire');

        const rows = await outboxRows({ type: 'EVENT_CANCELLED', phone });
        assert.equal(rows.length, 1, `une ligne EVENT_CANCELLED au numéro de l'invitation non réclamée : ${describeRows(rows)}`);
        const [row] = rows;
        assert.deepEqual([row.channel, row.recipient_user_id, row.event_id, row.family], ['SMS', null, ev.eventId, 'ESSENTIAL'],
            `SMS indispensable, numéro seul, rattaché à l'événement : ${describeRows(rows)}`);
        assert.ok(!JSON.stringify(row.template_data).includes(phone.slice(4)), `aucun numéro dans les données (notification_outbox_no_secret_chk) : ${JSON.stringify(row.template_data)}`);

        await flushNotifications({ eventIds: [ev.eventId] });
        assert.deepEqual(smsTo(phone, mark).map((m) => m.message),
            [`Event Village : ${ev.title} du ${date} est annulé. Le billet qui vous était destiné n'est plus valable.`],
            'un SMS remis au numéro, texte exact (11.2 M2, numéro seul, sans lien)');
    });

    test('vente au guichet avec numéro, annulation par un admin pendant l\'événement : « Remboursement par l\'organisateur. » au +221… ; sans numéro, aucune ligne', async () => {
        const ev = await publishedEvent('Guichet annul', 1);
        await shiftEventDates(ev.eventId, { startsInHours: -1, durationHours: 4 });
        const seller = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'msg-guichet' });
        await openShiftWithPin(seller, ev.eventId);
        const phone = randomSenegalPhone('76');
        const withPhone = await counterSale(seller, ev, phone.slice(4));
        assert.equal(withPhone.status, 200, `vente au guichet avec numéro : ${show(withPhone)}`);
        const withoutPhone = await counterSale(seller, ev, null);
        assert.equal(withoutPhone.status, 200, `vente au guichet sans numéro : ${show(withoutPhone)}`);
        const mark = smsMark(phone);
        const date = await smsStart(ev.eventId);

        assertRpcOk(await rpcCancel(ev.eventId, await superadminId(), { publicNotice: PUBLIC_NOTICE, internalReason: INTERNAL_REASON, confirmTitle: ev.title }), 'annulation par un admin');

        const rows = await phoneOnlyRows('EVENT_CANCELLED', ev.eventId);
        assert.deepEqual(rows.map((r) => r.recipient_phone), [phone],
            `une seule ligne « numéro seul » : celle du numéro saisi au guichet, rien pour la vente sans numéro : ${describeRows(rows)}`);
        assert.equal(rows[0].family, 'ESSENTIAL', 'SMS indispensable');

        await flushNotifications({ eventIds: [ev.eventId] });
        assert.deepEqual(smsTo(phone, mark).map((m) => m.message),
            [`Event Village : ${ev.title} du ${date} est annulé. Remboursement par l'organisateur.`],
            'un SMS remis à l\'acheteur au guichet, texte exact (11.2 M2, numéro seul ORGANIZER, sans lien)');
    });

    test('changement de lieu avec une invitation non réclamée : ligne EVENT_CHANGED SMS au numéro, PENDING, due dans 10 minutes', async () => {
        const ev = await publishedEvent('Invit lieu');
        const phone = await pendingInvitation(ev);
        const before = Date.now();
        const res = await putEvent(partner, ev.eventId, { location: `Nouveau lieu ${randomBytes(2).toString('hex')}` });
        const afterPut = Date.now();
        assert.equal(res.status, 200, `changement de lieu : ${show(res)}`);

        const rows = await outboxRows({ type: 'EVENT_CHANGED', phone });
        assert.equal(rows.length, 1, `une ligne EVENT_CHANGED au numéro de l'invitation non réclamée : ${describeRows(rows)}`);
        const [row] = rows;
        assert.deepEqual([row.channel, row.recipient_user_id, row.event_id, row.status], ['SMS', null, ev.eventId, 'PENDING'],
            `SMS en attente, numéro seul : ${describeRows(rows)}`);
        const due = Date.parse(row.due_at);
        assert.ok(due >= before + 9 * 60_000 && due <= afterPut + 11 * 60_000,
            `due_at à maintenant + 10 minutes (B71) : ${row.due_at} (changement entre ${new Date(before).toISOString()} et ${new Date(afterPut).toISOString()})`);
    });

    test('statique : aide du numéro au guichet (texte de la consigne) et message de l\'éditeur (SMS dans 10 minutes)', () => {
        const panel = fs.readFileSync(path.join(ROOT, 'components', 'scan', 'CounterSalePanel.tsx'), 'utf8');
        assert.match(panel, /Pour être prévenu en cas de changement ou d['’]annulation/, 'aide du champ numéro (consigne, tâche 30)');
        assert.ok(!panel.includes('Pour lui envoyer un reçu par SMS'), 'ancienne aide retirée');
        const form = fs.readFileSync(path.join(ROOT, 'components', 'events', 'EventForm.tsx'), 'utf8');
        assert.ok(form.includes('SMS partiront dans 10 minutes (vos corrections d’ici là y seront regroupées).'),
            'message de l\'éditeur après un changement (contrat 5.30, écrans E-D)');
        assert.ok(!form.includes('SMS en file d’envoi'), 'ancien message « SMS en file d’envoi » retiré');
    });
});

// ── R13 : billet reçu par transfert ────────────────────────────────────────

/** Transfert accepté par les routes : mot de passe confirmé (R57), initiation vers le numéro vérifié, réclamation. */
async function transferAccepted(from: Buyer, ticketId: string, to: Buyer): Promise<void> {
    await confirmPassword(from, STRONG_PASSWORD);
    const initiate = await routeHandler(TRANSFER_ROUTE, 'POST', 'POST /api/tickets/[id]/transfer');
    const init = await invoke(initiate, authed(`/api/tickets/${ticketId}/transfer`, 'POST', from, { recipient: to.phoneE164 }), routeContext({ id: ticketId }));
    assert.equal(init.status, 200, `initiation du transfert : ${show(init)}`);
    const { data, error } = await service.from('ticket_transfers').select('id').eq('ticket_id', ticketId).eq('status', 'PENDING');
    assert.equal(error, null, `transfert PENDING : ${error?.message}`);
    assert.equal((data ?? []).length, 1, 'un transfert PENDING');
    const transferId = String(data![0].id);
    const claim = await routeHandler(CLAIM_ROUTE, 'POST', 'POST /api/tickets/transfers/[id]/claim');
    const res = await invoke(claim, authed(`/api/tickets/transfers/${transferId}/claim`, 'POST', to), routeContext({ id: transferId }));
    assert.equal(res.status, 200, `acceptation du transfert : ${show(res)}`);
}

/** Notifications in-app du compte rattachées à l'événement (metadata), écrites par l'envoyeur. */
async function inAppOf(userId: string, eventId: string): Promise<Row[]> {
    const { data, error } = await service.from('notifications').select('id, title, content, metadata').eq('user_id', userId);
    assert.equal(error, null, `notifications de ${userId} : ${error?.message}`);
    return ((data ?? []) as Row[]).filter((n) => JSON.stringify(n.metadata ?? {}).includes(eventId));
}

/** Espaces insécables et apostrophes typographiques ramenés à leur forme simple. */
function norm(s: string): string {
    return s.replace(/[  ]/g, ' ').replace(/[’‘]/g, '\'');
}

describe('9b.31 R13 : billet reçu par transfert, annonce à l\'acheteur d\'origine', () => {
    test('Lamine (billet reçu) : mode TRANSFERRED, « acheteur d\'origine », SMS exact ; Fatou (acheteuse, sans billet) : EVENT_CANCELLED en mode AUTO', async () => {
        const ev = await publishedEvent('Transfert annul');
        const fatou = await newBuyer('msg-fatou', { firstName: 'Fatou', lastName: 'Acheteuse' });
        const lamine = await newBuyer('msg-lamine', { firstName: 'Lamine', lastName: 'Destinataire' });
        await markPhoneVerified(lamine.userId);
        const purchase = await buyConfirmed(fatou, ev, [[STANDARD, 1]]);
        const ticketId = String(purchase.tickets[0].id);
        await transferAccepted(fatou, ticketId, lamine);
        const { data: t, error: tErr } = await service.from('tickets').select('user_id').eq('id', ticketId).single();
        assert.equal(tErr, null, `billet : ${tErr?.message}`);
        assert.equal(t.user_id, lamine.userId, 'précondition : le billet est à Lamine, Fatou n\'en a plus');
        const laMark = smsMark(lamine.phoneE164);
        const date = await smsStart(ev.eventId);

        assertRpcOk(await rpcCancel(ev.eventId, partner.userId, { publicNotice: PUBLIC_NOTICE, internalReason: INTERNAL_REASON, confirmTitle: ev.title }), 'annulation par la partenaire');

        const laRows = await outboxRows({ type: 'EVENT_CANCELLED', eventId: ev.eventId, userId: lamine.userId });
        assert.ok(laRows.length > 0, 'Lamine, porteur au moment de l\'annulation, est prévenu');
        assert.deepEqual(Array.from(new Set(laRows.map((r) => r.template_data.refund_mode))), ['TRANSFERRED'],
            `mode TRANSFERRED pour le billet reçu par transfert (B70) : ${describeRows(laRows)}`);

        const faRows = await outboxRows({ type: 'EVENT_CANCELLED', keyPrefix: `EVENT_CANCELLED:${ev.eventId}:${fatou.userId}` });
        assert.ok(faRows.length > 0, `Fatou, acheteuse d'origine sans billet, reçoit EVENT_CANCELLED (clé EVENT_CANCELLED:<event>:<fatou>) : ${describeRows(faRows)}`);
        assert.ok(faRows.every((r) => r.recipient_user_id === fatou.userId && r.template_data.refund_mode === 'AUTO'),
            `mode AUTO pour l'acheteuse d'origine (son remboursement est réel) : ${describeRows(faRows)}`);

        await flushNotifications({ eventIds: [ev.eventId] });
        const notes = await inAppOf(lamine.userId, ev.eventId);
        const cancelNotes = notes.filter((n) => norm(String(n.title)) === 'Événement annulé');
        assert.equal(cancelNotes.length, 1, `une notification in-app « Événement annulé » pour Lamine : ${JSON.stringify(notes)}`);
        const content = norm(String(cancelNotes[0].content));
        assert.match(content, /acheteur d'origine/, `la notification de Lamine dit « acheteur d'origine » : ${content}`);
        assert.doesNotMatch(content, /Votre remboursement est en cours/, `aucune promesse de remboursement à Lamine : ${content}`);
        assert.deepEqual(smsTo(lamine.phoneE164, laMark).map((m) => m.message),
            [`Event Village : ${ev.title} du ${date} est annulé. Remboursement à l'acheteur d'origine. ${APP_URL}/tickets`],
            'SMS de Lamine, texte exact (11.2 M2, mode TRANSFERRED)');
    });
});
