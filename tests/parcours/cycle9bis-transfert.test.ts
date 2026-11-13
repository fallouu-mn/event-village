/**
 * Lot 9 bis, tâche 23 (R19, R61, R63, R46, R44, R45 ; contrat 5.23, 4.3, B52 à B57, 11.1 N9 à N11) — transferts :
 *  1. R19 : un billet en cours de transfert est refusé à l'entrée : saisie manuelle (pièce vérifiée) et QR →
 *     `transfer_pending`, billet VALIDE ; vérification de saisie `preview = transfer_pending` ; live-code 409
 *     TRANSFER_PENDING « Ce billet est en cours de transfert. ».
 *  2. R61 : un remboursement annule le transfert en cours (CANCELLED, verrou levé), TRANSFER_REVOKED au numéro du
 *     destinataire (SMS exact) ; l'acceptation ensuite rend TRANSFER_NOT_PENDING.
 *  3. R63 : le destinataire change de numéro (routes réelles, mot de passe confirmé) : transfert CANCELLED, verrou levé,
 *     TRANSFER_RECIPIENT_CHANGED à l'expéditeur ; invitation sans expéditeur : billet ANNULE, place rendue.
 *  4. R46 : POST /api/tickets/transfers/[id]/decline : DECLINED, `declined_at`, verrou levé, TRANSFER_DECLINED_SENDER ;
 *     invitation refusée : billet ANNULE, place rendue, liste partenaire « Refusée » ; tiers et expéditeur reçoivent le
 *     même refus que l'acceptation (aucune fuite) ; échu : 410 TRANSFER_EXPIRED au texte du contrat.
 *  5. R44 : transfert échu non traité par le cron : GET /api/tickets l'expire (EXPIRED, verrou levé, un seul
 *     TRANSFER_EXPIRED par canal, même clé que le cron) ; le scan l'expire aussi et accepte l'entrée.
 *  6. R45 : Mes billets ouvre « Reçus » d'office quand un transfert attend et qu'aucun onglet n'est demandé (statique).
 * Rouge avant correctif : ticket_scan et ticket_manual_lookup ne lisent pas transfer_locked
 * (M/20261108000005:137-214, :255-296) ; live-code ne contrôle que VALIDE (`live-code/route.ts:42-45`) ;
 * ticket_refund_request et account_phone_finalize ne touchent pas aux transferts ; statut DECLINED et route decline
 * absents ; GET /api/tickets garde le verrou d'un transfert échu (`:66-71`, `:128`) ; onglet par défaut `a-venir`.
 * Vert dès l'écriture (témoin, signalé) : le scan d'un billet dont le transfert est échu est accepté ; le garde-fou
 * est l'expiration du transfert relue après le scan (rouge).
 * R63 passe par les routes du changement de numéro, donc aussi par la confirmation du mot de passe (fix(9b.13)).
 * Comptage des SMS par numéro neuf. Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CashoutService } from '../../lib/payments/cashout.service';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { getFakes } from '../fakes';
import { confirmPassword, randomSenegalPhone, routeContext, STRONG_PASSWORD } from './helpers';
import { newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, cashoutsByKey, confirmCashouts, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { liveCode, newController, scan, ticketPayload, ticketRow, type RouteResult } from './acces-helpers';
import { advanceEventTo, createDraftEvent, type DraftEvent } from './cycle-helpers';
import { dispatchAt, markPhoneVerified, outboxRows, smsMark, smsTo } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { issueFreeTicket } from './terrain-helpers';

type Row = Record<string, unknown>;

const HOUR = 3600_000;
const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 5_000, total: 40 }, { name: 'Gratuit', price: 0, total: 40 }];
const LIMITS = { per_event_hour: 50, per_phone_day: 3 };
const TICKETS_ROUTE = '../../app/api/tickets/route';
const CLAIM_ROUTE = '../../app/api/tickets/transfers/[id]/claim/route';
const DECLINE_ROUTE = '../../app/api/tickets/transfers/[id]/decline/route';
const LOOKUP_ROUTE = '../../app/api/controller/scan/lookup/route';
const PHONE_START_ROUTE = '../../app/api/account/phone/start/route';
const PHONE_CONFIRM_ROUTE = '../../app/api/account/phone/confirm/route';
const TICKETS_PAGE = path.join('app', 'tickets', 'page.tsx');
const EXPIRED_TEXT = 'Ce billet ne peut plus être accepté : le délai est dépassé.';

let partner: TestPartner;
let ev: DraftEvent;
let controller: Buyer;
let appUrl: string;

before(async () => {
    partner = await newPartner('transfert-9bis');
    const title = `Gala transfert ${String(Date.now() % 100_000).padStart(5, '0')}`.slice(0, 30);
    ev = await createDraftEvent(partner, 'transfert-9bis', CATEGORIES, { title, startsInHours: 1, durationHours: 4 });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    controller = await newController(partner, ev.eventId, { label: 'transfert-9bis' });
    appUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
    assert.ok(appUrl, 'NEXT_PUBLIC_APP_URL définie (.env.test)');
});

after(async () => {
    await assertLot9bisInvariants('cycle9bis-transfert');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

async function freeTicket(holder: Buyer): Promise<string> {
    return issueFreeTicket(ev.eventId, ev.categories.Gratuit.id, holder);
}

/** ticket_transfer_initiate (RPC du lot 6) : transfert PENDING, billet verrouillé ; rend l'identifiant. */
async function initiate(ticketId: string, from: Buyer, to: string): Promise<string> {
    const { data, error } = await service.rpc('ticket_transfer_initiate', {
        p: { ticket_id: ticketId, actor_id: from.userId, recipient: to, expires_at: new Date(Date.now() + 48 * HOUR).toISOString() },
    });
    assert.equal(error, null, `ticket_transfer_initiate : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `transfert refusé : ${JSON.stringify(data)}`);
    return String((data as Row).transfer_id);
}

/** Transfert échu sans passage du cron : créé il y a 3 h, échu depuis 1 h (CHECK expires_at > created_at gardé). */
async function makeOverdue(transferId: string): Promise<void> {
    const { error } = await service.from('ticket_transfers')
        .update({ created_at: new Date(Date.now() - 3 * HOUR).toISOString(), expires_at: new Date(Date.now() - HOUR).toISOString() })
        .eq('id', transferId);
    assert.equal(error, null, `transfert ${transferId} rendu échu : ${error?.message}`);
}

async function transferRow(id: string): Promise<Row> {
    const { data, error } = await service.from('ticket_transfers').select('*').eq('id', id).single();
    assert.equal(error, null, `transfert ${id} : ${error?.message}`);
    return data as Row;
}

async function categorySold(categoryId: string): Promise<number> {
    const { data, error } = await service.from('ticket_categories').select('sold_quantity').eq('id', categoryId).single();
    assert.equal(error, null, `catégorie ${categoryId} : ${error?.message}`);
    return Number(data.sold_quantity);
}

async function myTickets(user: Buyer): Promise<Row[]> {
    const handler = await routeHandler(TICKETS_ROUTE, 'GET', 'GET /api/tickets');
    const res = await invoke(handler, jsonRequest('/api/tickets', 'GET', user.accessToken));
    assert.equal(res.status, 200, `Mes billets : ${show(res)}`);
    return (res.body.tickets ?? []) as Row[];
}

async function transferAction(route: string, what: string, user: Buyer, transferId: string): Promise<RouteResult> {
    const handler = await routeHandler(route, 'POST', what);
    return invoke(handler, jsonRequest(`/api/tickets/transfers/${transferId}/x`, 'POST', user.accessToken, {}), routeContext({ id: transferId }));
}

function claim(user: Buyer, transferId: string): Promise<RouteResult> {
    return transferAction(CLAIM_ROUTE, 'POST /api/tickets/transfers/[id]/claim', user, transferId);
}

function decline(user: Buyer, transferId: string): Promise<RouteResult> {
    return transferAction(DECLINE_ROUTE, 'POST /api/tickets/transfers/[id]/decline (contrat 4.3, fix(9b.23))', user, transferId);
}

async function lookup(ticketNumber: string): Promise<RouteResult> {
    const handler = await routeHandler(LOOKUP_ROUTE, 'POST', 'POST /api/controller/scan/lookup');
    return invoke(handler, jsonRequest('/api/controller/scan/lookup', 'POST', controller.accessToken, { eventId: ev.eventId, manualTicketNumber: ticketNumber }));
}

/** Destinataire avec un compte au numéro vérifié (identité MATCH à l'acceptation). */
async function verifiedRecipient(label: string): Promise<Buyer> {
    const user = await newBuyer(label, { phoneVerified: false });
    await markPhoneVerified(user.userId);
    return user;
}

/** Invitation de la partenaire au numéro d'un compte non vérifié : billet sans porteur, transfert PENDING sans expéditeur. */
async function pendingInvitation(phone: string): Promise<{ ticketId: string; transferId: string }> {
    const { data, error } = await service.rpc('ticket_invitation_create', {
        p: { actor_id: partner.userId, event_id: ev.eventId, category_id: ev.categories.Gratuit.id, phones: [phone], quantity: 1, limits: LIMITS },
    });
    assert.equal(error, null, `ticket_invitation_create : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `invitation refusée : ${JSON.stringify(data)}`);
    const { data: rows, error: tErr } = await service.from('ticket_transfers').select('id, ticket_id, from_user_id').eq('to_phone_or_email', phone).eq('status', 'PENDING');
    assert.equal(tErr, null, `transfert de l'invitation : ${tErr?.message}`);
    assert.equal((rows ?? []).length, 1, `un transfert PENDING sans expéditeur : ${JSON.stringify(rows)}`);
    assert.equal(rows![0].from_user_id, null, 'invitation : aucun expéditeur');
    return { ticketId: String(rows![0].ticket_id), transferId: String(rows![0].id) };
}

/** Changement de numéro complet par les routes (mot de passe confirmé, code reçu au nouveau numéro). */
async function changePhone(user: Buyer, next: string): Promise<void> {
    await confirmPassword(user, STRONG_PASSWORD);
    const start = await routeHandler(PHONE_START_ROUTE, 'POST', 'POST /api/account/phone/start');
    const since = getFakes().sms.messagesTo(next).length;
    const s = await invoke(start, jsonRequest('/api/account/phone/start', 'POST', user.accessToken, { phone: next }));
    assert.equal(s.status, 200, `démarrage du changement de numéro : ${show(s)}`);
    const codes = getFakes().sms.messagesTo(next).slice(since).map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter((c): c is string => Boolean(c));
    assert.equal(codes.length, 1, `un code au nouveau numéro ${next}`);
    const confirm = await routeHandler(PHONE_CONFIRM_ROUTE, 'POST', 'POST /api/account/phone/confirm');
    const c = await invoke(confirm, jsonRequest('/api/account/phone/confirm', 'POST', user.accessToken, { phone: next, code: codes[0] }));
    assert.equal(c.status, 200, `confirmation du changement de numéro : ${show(c)}`);
}

/** Versements du remboursement envoyés puis confirmés (rien laissé à envoyer). */
async function settleRefund(ticketId: string): Promise<void> {
    for (const c of await cashoutsByKey(`REFUND-TKT-${ticketId}`)) {
        if (c.status === 'A_ENVOYER') await CashoutService.send(String(c.id));
    }
    await confirmCashouts();
}

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

// ── 1. R19 : billet en cours de transfert à l'entrée ───────────────────────

describe('R19 — billet en cours de transfert : refusé au scan comme à la saisie (« Transfert en cours »)', () => {
    test('saisie manuelle : vérification preview transfer_pending, puis entrée refusée transfer_pending, billet toujours VALIDE', async () => {
        const holder = await newBuyer('r19-saisie');
        const ticketId = await freeTicket(holder);
        await initiate(ticketId, holder, randomSenegalPhone('76'));
        const number = String((await ticketRow(ticketId)).ticket_number);
        const preview = await lookup(number);
        assert.equal(preview.status, 200, `vérification de saisie : ${show(preview)}`);
        assert.equal((preview.body.ticket as Row | undefined)?.preview, 'transfer_pending', `preview transfer_pending (aujourd’hui valid) : ${show(preview)}`);
        const res = await scan(controller, { eventId: ev.eventId, manualTicketNumber: number, identityVerified: true });
        assert.equal(res.status, 200, show(res));
        assert.equal(res.body.result, 'transfer_pending', `saisie d’un billet en transfert : transfer_pending attendu (aujourd’hui valid et billet composté) : ${show(res)}`);
        assert.equal(res.body.message, 'Transfert en cours', `libellé du résultat : ${show(res)}`);
        assert.equal((await ticketRow(ticketId)).status, 'VALIDE', 'billet non composté');
    });

    test('QR et code dynamique : live-code 409 TRANSFER_PENDING ; un QR calculé avec le secret est refusé transfer_pending', async () => {
        const holder = await newBuyer('r19-qr');
        const ticketId = await freeTicket(holder);
        await initiate(ticketId, holder, randomSenegalPhone('76'));
        const code = await liveCode(holder, ticketId);
        assert.equal(code.status, 409, `live-code d’un billet en transfert : 409 attendu (aujourd’hui 200) : ${show(code)}`);
        assert.equal(code.body.code, 'TRANSFER_PENDING', show(code));
        assert.equal(code.body.error, 'Ce billet est en cours de transfert.', show(code));
        const res = await scan(controller, { eventId: ev.eventId, payload: await ticketPayload(ticketId) });
        assert.equal(res.body.result, 'transfer_pending', `QR d’un billet en transfert : ${show(res)}`);
        assert.equal((await ticketRow(ticketId)).status, 'VALIDE', 'billet non composté');
    });
});

// ── 2. R61 : remboursement d'un billet en transfert ────────────────────────

describe('R61 — un remboursement annule le transfert en cours et prévient le destinataire', () => {
    test('remboursement par la partenaire : transfert CANCELLED, verrou levé, TRANSFER_REVOKED (SMS exact) au destinataire ; acceptation ensuite → TRANSFER_NOT_PENDING', async () => {
        const buyer = await newBuyer('r61-acheteur');
        const recipient = await verifiedRecipient('r61-destinataire');
        const [ticket] = (await buyConfirmed(buyer, ev, [['Standard', 1]])).tickets;
        const ticketId = String(ticket.id);
        const transferId = await initiate(ticketId, buyer, recipient.phoneE164);
        const { data, error } = await service.rpc('ticket_refund_request', { p_ticket_id: ticketId, p_actor: partner.userId, p_reason: 'Remboursement pendant un transfert (R61)' });
        assert.equal(error, null, `ticket_refund_request : ${error?.message}`);
        assert.equal((data as Row | null)?.ok, true, `remboursement accepté : ${JSON.stringify(data)}`);
        try {
            const tr = await transferRow(transferId);
            assert.equal(tr.status, 'CANCELLED', `transfert annulé dans la même fonction (aujourd’hui PENDING) : ${JSON.stringify(tr)}`);
            assert.equal((await ticketRow(ticketId)).transfer_locked, false, 'verrou de transfert levé');
            const sms = await outboxRows({ type: 'TRANSFER_REVOKED', phone: recipient.phoneE164, channel: 'SMS' });
            assert.equal(sms.length, 1, `un SMS TRANSFER_REVOKED au numéro du destinataire : ${JSON.stringify(sms.map((r) => r.status))}`);
            const mark = smsMark(recipient.phoneE164);
            await dispatchAt(new Date(), { ids: [sms[0].id] });
            assert.deepEqual(smsTo(recipient.phoneE164, mark).map((m) => m.message),
                [`Event Village : le billet ${ev.title} qui vous était transféré a été remboursé à son acheteur. Le transfert est annulé.`],
                'texte exact (11.1 N9)');
            const accepted = await claim(recipient, transferId);
            assert.equal(accepted.body.code, 'TRANSFER_NOT_PENDING', `acceptation après le remboursement : ${show(accepted)}`);
        } finally {
            await settleRefund(ticketId);
        }
    });
});

// ── 3. R63 : le destinataire change de numéro ──────────────────────────────

describe('R63 — le destinataire change de numéro : transfert annulé, expéditeur averti', () => {
    test('transfert vers l’ancien numéro : CANCELLED, verrou levé, TRANSFER_RECIPIENT_CHANGED (in-app) à l’expéditeur', async () => {
        const sender = await newBuyer('r63-expediteur');
        const recipient = await verifiedRecipient('r63-destinataire');
        const ticketId = await freeTicket(sender);
        const transferId = await initiate(ticketId, sender, recipient.phoneE164);
        await changePhone(recipient, randomSenegalPhone('78'));
        assert.equal((await transferRow(transferId)).status, 'CANCELLED', 'transfert vers l’ancien numéro annulé (aujourd’hui PENDING, compte-numero:977-990)');
        assert.equal((await ticketRow(ticketId)).transfer_locked, false, 'billet rendu à l’expéditeur, déverrouillé');
        const notices = await outboxRows({ type: 'TRANSFER_RECIPIENT_CHANGED', userId: sender.userId, channel: 'IN_APP' });
        assert.equal(notices.length, 1, `un avis in-app TRANSFER_RECIPIENT_CHANGED à l’expéditeur : ${JSON.stringify(notices.map((r) => r.status))}`);
    });

    test('invitation sans expéditeur vers l’ancien numéro : transfert CANCELLED, billet ANNULE, place rendue, aucun avis', async () => {
        const invitee = await newBuyer('r63-invite', { phoneVerified: false });
        const soldBefore = await categorySold(ev.categories.Gratuit.id);
        const inv = await pendingInvitation(invitee.phoneE164);
        assert.equal(await categorySold(ev.categories.Gratuit.id), soldBefore + 1, 'précondition : place prise par l’invitation');
        await changePhone(invitee, randomSenegalPhone('78'));
        assert.equal((await transferRow(inv.transferId)).status, 'CANCELLED', 'transfert de l’invitation annulé');
        assert.equal((await ticketRow(inv.ticketId)).status, 'ANNULE', 'billet de l’invitation annulé');
        assert.equal(await categorySold(ev.categories.Gratuit.id), soldBefore, 'place rendue (sold_quantity − 1)');
        assert.deepEqual(await outboxRows({ type: 'TRANSFER_RECIPIENT_CHANGED', eventId: ev.eventId, userId: partner.userId }), [], 'aucun avis à la partenaire');
    });
});

// ── 4. R46 : refus par le destinataire ─────────────────────────────────────

describe('R46 — le destinataire refuse le billet', () => {
    test('refus d’un transfert : 200, DECLINED et declined_at, verrou levé, TRANSFER_DECLINED_SENDER (in-app) à l’expéditeur', async () => {
        const sender = await newBuyer('r46-expediteur');
        const recipient = await verifiedRecipient('r46-destinataire');
        const ticketId = await freeTicket(sender);
        const transferId = await initiate(ticketId, sender, recipient.phoneE164);
        const res = await decline(recipient, transferId);
        assert.equal(res.status, 200, `refus par le destinataire : ${show(res)}`);
        const tr = await transferRow(transferId);
        assert.equal(tr.status, 'DECLINED', JSON.stringify(tr));
        assert.ok(tr.declined_at, `declined_at renseigné : ${JSON.stringify(tr)}`);
        const t = await ticketRow(ticketId);
        assert.deepEqual({ status: t.status, owner: t.user_id, locked: t.transfer_locked }, { status: 'VALIDE', owner: sender.userId, locked: false }, 'billet rendu à l’expéditeur');
        const notices = await outboxRows({ type: 'TRANSFER_DECLINED_SENDER', userId: sender.userId, channel: 'IN_APP' });
        assert.equal(notices.length, 1, 'un avis in-app TRANSFER_DECLINED_SENDER à l’expéditeur');
    });

    test('refus d’une invitation : billet ANNULE, place rendue, liste partenaire « Refusée »', async () => {
        const invitee = await newBuyer('r46-invite', { phoneVerified: false });
        const soldBefore = await categorySold(ev.categories.Gratuit.id);
        const inv = await pendingInvitation(invitee.phoneE164);
        await markPhoneVerified(invitee.userId);
        const res = await decline(invitee, inv.transferId);
        assert.equal(res.status, 200, `refus de l’invitation : ${show(res)}`);
        assert.equal((await transferRow(inv.transferId)).status, 'DECLINED');
        assert.equal((await ticketRow(inv.ticketId)).status, 'ANNULE', 'billet de l’invitation annulé');
        assert.equal(await categorySold(ev.categories.Gratuit.id), soldBefore, 'place rendue');
        const { data, error } = await service.rpc('ticket_invitations_list', { p: { actor_id: partner.userId, event_id: ev.eventId } });
        assert.equal(error, null, `ticket_invitations_list : ${error?.message}`);
        const items = ((data as Row | null)?.items ?? []) as Row[];
        const item = items.find((i) => i.ticket_id === inv.ticketId);
        assert.equal(item?.status_label, 'Refusée', `liste de la partenaire : « Refusée » (aujourd’hui « Annulée ») : ${JSON.stringify(item)}`);
    });

    test('tiers et expéditeur : même refus que l’acceptation (aucune fuite), transfert intact ; échu : 410 TRANSFER_EXPIRED au texte du contrat', async () => {
        const sender = await newBuyer('r46-tiers-exp');
        const recipient = await verifiedRecipient('r46-tiers-dest');
        const stranger = await verifiedRecipient('r46-tiers');
        const ticketId = await freeTicket(sender);
        const transferId = await initiate(ticketId, sender, recipient.phoneE164);
        for (const [label, who] of [['tiers', stranger], ['expéditeur', sender]] as Array<[string, Buyer]>) {
            const viaClaim = await claim(who, transferId);
            const viaDecline = await decline(who, transferId);
            assert.ok(viaDecline.status >= 400, `${label} : refus attendu, ${show(viaDecline)}`);
            assert.deepEqual({ status: viaDecline.status, code: viaDecline.body.code }, { status: viaClaim.status, code: viaClaim.body.code },
                `${label} : refus identique à celui de l’acceptation (${show(viaClaim)})`);
            assert.equal((await transferRow(transferId)).status, 'PENDING', `${label} : transfert intact`);
        }
        const late = await initiate(await freeTicket(sender), sender, recipient.phoneE164);
        await makeOverdue(late);
        const expired = await decline(recipient, late);
        assert.equal(expired.status, 410, show(expired));
        assert.equal(expired.body.code, 'TRANSFER_EXPIRED', show(expired));
        assert.equal(expired.body.error, EXPIRED_TEXT, `texte du contrat 4.3 (ex-10.0 d) : ${show(expired)}`);
    });
});

// ── 5. R44 : transfert échu traité à la lecture ────────────────────────────

describe('R44 — transfert échu traité dès sa lecture', () => {
    test('GET /api/tickets : transfert EXPIRED, billet déverrouillé, un seul TRANSFER_EXPIRED par canal (même clé que le cron)', async () => {
        const sender = await newBuyer('r44-expediteur');
        const ticketId = await freeTicket(sender);
        const transferId = await initiate(ticketId, sender, randomSenegalPhone('76'));
        await makeOverdue(transferId);
        const card = (await myTickets(sender)).find((t) => t.id === ticketId);
        assert.ok(card, 'billet dans Mes billets');
        assert.deepEqual({ locked: card.isTransferLocked, active: card.activeTransfer }, { locked: false, active: null },
            `billet libre dès la lecture (aujourd’hui verrouillé sans transfert lisible) : ${JSON.stringify(card)}`);
        const tr = await transferRow(transferId);
        assert.equal(tr.status, 'EXPIRED', `transfert expiré à la lecture : ${JSON.stringify(tr)}`);
        assert.equal((await ticketRow(ticketId)).transfer_locked, false, 'verrou levé en base');

        await myTickets(sender);
        const { error } = await service.rpc('ticket_transfers_expire', { p: {} });
        assert.equal(error, null, `cron ticket_transfers_expire : ${error?.message}`);
        const notices = await outboxRows({ type: 'TRANSFER_EXPIRED', userId: sender.userId });
        assert.ok(notices.length > 0, 'avis TRANSFER_EXPIRED à l’expéditeur');
        const perChannel = new Map<string, number>();
        for (const n of notices) perChannel.set(n.channel, (perChannel.get(n.channel) ?? 0) + 1);
        assert.ok(Array.from(perChannel.values()).every((n) => n === 1), `un seul avis par canal après deux lectures et le cron : ${JSON.stringify(Array.from(perChannel.entries()))}`);
    });

    test('scan d’un billet dont le transfert est échu : entrée acceptée (témoin) et transfert expiré par le scan', async () => {
        const holder = await newBuyer('r44-scan');
        const ticketId = await freeTicket(holder);
        const transferId = await initiate(ticketId, holder, randomSenegalPhone('76'));
        await makeOverdue(transferId);
        const res = await scan(controller, { eventId: ev.eventId, payload: await ticketPayload(ticketId) });
        assert.equal(res.body.result, 'valid', `transfert échu : l’entrée reste possible : ${show(res)}`);
        assert.equal((await transferRow(transferId)).status, 'EXPIRED', 'le scan expire le transfert échu (aujourd’hui PENDING jusqu’au cron)');
    });
});

// ── 6. R45 : onglet « Reçus » ──────────────────────────────────────────────

describe('R45 — Mes billets ouvre « Reçus » quand un transfert attend (contrôle statique)', () => {
    test('après la lecture des transferts entrants, bascule vers recus si au moins un attend et qu’aucun onglet n’est demandé', () => {
        assert.ok(fs.existsSync(TICKETS_PAGE), `${TICKETS_PAGE} absent`);
        const src = stripComments(fs.readFileSync(TICKETS_PAGE, 'utf8'));
        const at = src.indexOf('readIncomingTransfers()');
        assert.ok(at >= 0, 'lecture des transferts entrants (readIncomingTransfers)');
        const around = src.slice(Math.max(0, at - 1500), at + 1500);
        assert.match(around, /items\.length\s*>\s*0/, 'au moins un transfert attend');
        assert.match(around, /(?:get|has)\(\s*['"]tab['"]\s*\)/, 'aucun onglet demandé dans l’URL');
        assert.match(around, /['"]recus['"]/, 'bascule vers l’onglet « Reçus » (aujourd’hui onglet par défaut a-venir, SMS vers /tickets)');
    });
});
