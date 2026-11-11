/**
 * Lot 6, tâche 6.7 — transfert de billet sans jeton, vers un numéro seulement (contrat B avec
 * l'amendement 2 de l'orchestrateur, G2 TRANSFER_*, G3, K1 T1-T6 ; décisions 15, 34, 36, 37, 38 ;
 * S2 groupe Pros).
 *  1. Initiation (POST /api/tickets/[id]/transfer) vers un numéro : réponse sans claim_token, claim_url ni
 *     recipient_notified (recipient_notification QUEUED), transfert sans haché de jeton, TRANSFER_OFFERED
 *     par SMS au numéro (texte exact, sans lien de réclamation ni jeton) et IN_APP + PUSH au compte dont le
 *     numéro est vérifié ; numéro non vérifié : SMS seulement ; cible email : 400 RECIPIENT_PHONE_REQUIRED.
 *  2. Liste entrante (GET /api/tickets/transfers/incoming) : numéro vérifié → l'élément (expéditeur masqué,
 *     catégorie, prix, événement) ; numéro non vérifié → phoneVerificationRequired sans aucun détail ;
 *     autre compte → rien ; ancien transfert PENDING vers un email → rien.
 *  3. Acceptation (POST /api/tickets/transfers/[id]/claim) : 200, billet au destinataire, identité du
 *     billet renouvelée (numéro, QR, secret TOTP, security_version + 1), TRANSFER_CLAIMED_SENDER et
 *     TRANSFER_RECEIVED (in-app, push et, lot 7 tâche 7.9 D91, email ; aucun SMS) ; refus 404 TRANSFER_NOT_FOUND identique pour un
 *     identifiant inconnu, le transfert d'un autre et un ancien transfert vers un email ; 403
 *     PHONE_NOT_VERIFIED ; 409 TRANSFER_NOT_PENDING ; 410 TRANSFER_EXPIRED ; 400 SELF_TRANSFER.
 *  4. Ancienne route /api/tickets/claim/[token] : GET et POST → 410 CLAIM_LINK_RETIRED, réponse identique
 *     pour un vrai et un faux jeton, POST derrière la session ; page /tickets/claim/[token] : redirection
 *     serveur vers /tickets?tab=recus ; contrôle statique (ni from(, ni rpc(, ni TicketTransferService).
 *  5. POST /api/auth/verify-otp pose users.phone_verified_at (première vérification conservée) ; le compte
 *     voit alors le transfert qui l'attendait.
 *
 * Rouge avant correctif : le transfert passe par un jeton (claim_url dans la réponse et dans le SMS,
 * lib/tickets/ticket-transfer.service.ts:241-249), les routes incoming et [id]/claim n'existent pas,
 * l'ancienne route lit la base, la page est un composant client, users.phone_verified_at et la boîte
 * d'envoi n'existent pas (migrations 20261103000002 et …05).
 *
 * Interprétations retenues : date limite du SMS par smsShortDateTime (lib/notifications/sms-format.ts) ;
 * l'ancien transfert vers un email est écrit directement par le service_role (plus aucune route ne le
 * permet), billet verrouillé comme par ticket_transfer_initiate.
 * Lot 9 bis (R57, T34) : mot de passe confirmé (confirmPassword) avant les transferts, une fois par session.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { getFakes } from '../fakes';
import { BASE_URL, confirmPassword, jsonRequest as publicRequest, routeContext, STRONG_PASSWORD } from './helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed, ticketRow, type RouteResult } from './acces-helpers';
import { advanceEventTo, createDraftEvent, type DraftEvent } from './cycle-helpers';
import {
    assertNotificationInvariants, dispatchAt, loadLotModule, markPhoneVerified, outboxRows, smsMark, smsTo,
    type OutboxChannel, type OutboxRow,
} from './notif-helpers';

after(async () => {
    await assertNotificationInvariants('notif-transferts');
});

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const ROOT = process.cwd();
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
const TRANSFER_ROUTE = '../../app/api/tickets/[id]/transfer/route';
const INCOMING_ROUTE = '../../app/api/tickets/transfers/incoming/route';
const CLAIM_ROUTE = '../../app/api/tickets/transfers/[id]/claim/route';
const LEGACY_ROUTE = '../../app/api/tickets/claim/[token]/route';
const LEGACY_ROUTE_FILE = 'app/api/tickets/claim/[token]/route.ts';
const LEGACY_PAGE_FILE = 'app/tickets/claim/[token]/page.tsx';
const RETIRED_MESSAGE = "Ce lien n'est plus utilisé. Connectez-vous avec le numéro auquel le billet a été envoyé, puis ouvrez « Mes billets ».";

let partner: TestPartner;
let ev: DraftEvent;
let owner: Buyer;
let tickets: string[] = [];
let nextTicket = 0;

before(async () => {
    assert.ok(APP_URL.startsWith('http'), 'NEXT_PUBLIC_APP_URL absente de .env.test');
    partner = await newPartner('notif-transferts');
    const title = `Transfert ${randomBytes(2).toString('hex')}`;
    ev = await createDraftEvent(partner, 'notif-transferts', [{ name: 'Standard', price: 5_000, total: 40, maxPerOrder: 20 }], { title, startsInHours: 96 });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    owner = await newBuyer('transf-expediteur', { firstName: 'Awa', lastName: 'Diallo' });
    tickets = (await buyConfirmed(owner, ev, [['Standard', 16]])).tickets.map((t) => String(t.id));
    assert.equal(tickets.length, 16, 'seize billets au porteur (13 prélèvements par takeTicket, run 61 : douze ne suffisaient pas)');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function takeTicket(): string {
    assert.ok(nextTicket < tickets.length, 'billets de la suite épuisés');
    return tickets[nextTicket++];
}

async function invoke(handler: Handler, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch (err) {
        body = { raw: text, parseError: (err as Error).message };
    }
    return { status: res.status, body };
}

function show(res: RouteResult): string {
    return `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 400)}`;
}

async function routeFn(rel: string, method: 'GET' | 'POST', what: string): Promise<Handler> {
    const mod = await loadLotModule(rel, what);
    assert.equal(typeof mod[method], 'function', `${what} : ${method} non exporté`);
    return mod[method] as Handler;
}

function hasKeyDeep(body: unknown, key: string): boolean {
    if (!body || typeof body !== 'object') return false;
    if (key in (body as Row)) return true;
    return Object.values(body as Row).some((v) => hasKeyDeep(v, key));
}

/** Lot 9 bis (R57, T34) : mot de passe confirmé une fois par session avant les transferts (10 minutes, quota par compte). */
const confirmedSessions = new Map<string, Promise<void>>();

async function initiate(from: Buyer, ticketId: string, recipient: string): Promise<RouteResult> {
    if (!confirmedSessions.has(from.accessToken)) confirmedSessions.set(from.accessToken, confirmPassword(from, STRONG_PASSWORD));
    await confirmedSessions.get(from.accessToken);
    const { POST } = await importModule(TRANSFER_ROUTE);
    return invoke(POST as Handler, authed(`/api/tickets/${ticketId}/transfer`, 'POST', from, { recipient }), routeContext({ id: ticketId }));
}

/** Transfert initié par la route (200 exigé) ; renvoie l'identifiant lu dans la réponse. */
async function initiateOk(from: Buyer, ticketId: string, recipient: string): Promise<{ id: string; body: Row }> {
    const res = await initiate(from, ticketId, recipient);
    assert.equal(res.status, 200, `initiation du transfert : ${show(res)}`);
    const transfer = (res.body.transfer ?? {}) as Row;
    assert.ok(typeof transfer.transfer_id === 'string', `réponse : transfer.transfer_id : ${show(res)}`);
    return { id: String(transfer.transfer_id), body: res.body };
}

async function incoming(user: Buyer): Promise<RouteResult> {
    const GET = await routeFn(INCOMING_ROUTE, 'GET', 'route GET /api/tickets/transfers/incoming (contrat B4)');
    return invoke(GET, authed('/api/tickets/transfers/incoming', 'GET', user));
}

async function claim(user: Buyer, transferId: string): Promise<RouteResult> {
    const POST = await routeFn(CLAIM_ROUTE, 'POST', 'route POST /api/tickets/transfers/[id]/claim (contrat B4)');
    return invoke(POST, authed(`/api/tickets/transfers/${transferId}/claim`, 'POST', user), routeContext({ id: transferId }));
}

async function transferRow(id: string): Promise<Row> {
    const { data, error } = await service.from('ticket_transfers').select('*').eq('id', id).single();
    assert.equal(error, null, `transfert ${id} : ${error?.message}`);
    return data as Row;
}

/** Ancien transfert PENDING (avant le lot 6) écrit par le service_role, billet verrouillé ; `token` : jeton dont le haché est gardé. */
async function legacyTransfer(ticketId: string, target: string, token = randomBytes(32).toString('hex')): Promise<{ id: string; token: string }> {
    const { data, error } = await service.from('ticket_transfers').insert({
        ticket_id: ticketId, from_user_id: owner.userId, to_phone_or_email: target, status: 'PENDING',
        claim_token_hash: createHash('sha256').update(token).digest('hex'), expires_at: new Date(Date.now() + 47 * 3600_000).toISOString(),
    }).select('id').single();
    assert.equal(error, null, `ancien transfert : ${error?.message}`);
    const { error: lErr } = await service.from('tickets').update({ transfer_locked: true }).eq('id', ticketId);
    assert.equal(lErr, null, `verrou du billet : ${lErr?.message}`);
    return { id: String(data.id), token };
}

async function verifiedRecipient(label: string): Promise<Buyer> {
    const b = await newBuyer(`transf-${label}`, { firstName: 'Fatou', lastName: 'Ndiaye' });
    await markPhoneVerified(b.userId);
    return b;
}

function channelsOf(rows: OutboxRow[]): OutboxChannel[] {
    return rows.map((r) => r.channel).sort();
}

let ipSeq = 0;
function freshIp(): string {
    ipSeq += 1;
    return `198.20.${(process.pid % 200) + 1}.${(ipSeq % 250) + 1}`;
}

// ── 1. Initiation ──────────────────────────────────────────────────────────

describe('6.7 Transfert — initiation vers un numéro, sans jeton (B3, B4, amendement 2)', () => {
    test('numéro vérifié : réponse QUEUED sans jeton ni lien, TRANSFER_OFFERED par SMS au numéro et in-app + push au compte ; SMS exact sans lien de réclamation', async () => {
        const to = await verifiedRecipient('offre');
        const ticketId = takeTicket();
        const { id, body } = await initiateOk(owner, ticketId, to.phoneE164);
        const transfer = body.transfer as Row;
        assert.equal(transfer.recipient_notification, 'QUEUED', `recipient_notification : ${JSON.stringify(body)}`);
        for (const k of ['claim_token', 'claim_url', 'recipient_notified']) assert.ok(!hasKeyDeep(body, k), `réponse sans ${k} : ${JSON.stringify(body)}`);
        assert.ok(!/claim\//.test(JSON.stringify(body)), `réponse sans lien de réclamation : ${JSON.stringify(body)}`);
        const row = await transferRow(id);
        assert.equal(row.claim_token_hash, null, 'transfert sans haché de jeton (B1)');
        assert.equal(row.to_phone_or_email, to.phoneE164, 'cible : le numéro normalisé');
        assert.equal((await ticketRow(ticketId)).transfer_locked, true, 'billet verrouillé');

        const rows = await outboxRows({ type: 'TRANSFER_OFFERED', keyPrefix: `TRANSFER_OFFERED:${id}:` });
        assert.deepEqual(channelsOf(rows), ['IN_APP', 'PUSH', 'SMS'], `canaux de l'offre (sans EMAIL, amendement 2) : ${JSON.stringify(rows.map((r) => r.channel))}`);
        const sms = rows.find((r) => r.channel === 'SMS')!;
        assert.equal(sms.recipient_phone, to.phoneE164, 'SMS : au numéro saisi');
        assert.equal(sms.actor_id, owner.userId, 'SMS : compte déclencheur = expéditeur (quota par compte)');
        for (const r of rows.filter((x) => x.channel !== 'SMS')) assert.equal(r.recipient_user_id, to.userId, `${r.channel} : au compte dont le numéro vérifié est la cible`);
        assert.ok(!/token|claim_url/.test(JSON.stringify(rows.map((r) => r.template_data))), 'aucun jeton dans template_data');

        const mark = smsMark(to.phoneE164);
        await dispatchAt(new Date(), { ids: rows.map((r) => r.id) });
        const fmt = await loadLotModule('../../lib/notifications/sms-format', 'formats SMS (contrat F2.2)');
        assert.equal(typeof fmt.smsShortDateTime, 'function', 'smsShortDateTime exporté');
        const dc = (fmt.smsShortDateTime as (v: string) => string)(new Date(String(row.expires_at)).toISOString());
        const got = smsTo(to.phoneE164, mark).map((m) => m.message);
        assert.deepEqual(got, [`Event Village : un billet ${ev.title} vous est transféré. Connectez-vous avec ce numéro avant le ${dc} : ${APP_URL}/tickets`], 'un SMS au texte exact (G3)');
        assert.ok(!/claim|[0-9a-f]{32,}/i.test(got[0]), `SMS sans lien de réclamation ni jeton : « ${got[0]} »`);
        const [inApp] = await outboxRows({ ids: [rows.find((r) => r.channel === 'IN_APP')!.id] });
        assert.equal(inApp.status, 'SENT', `in-app livrée (${inApp.status} ${inApp.reason})`);
        const { data: n, error } = await service.from('notifications').select('title, metadata').eq('id', inApp.notification_id).single();
        assert.equal(error, null, `notification : ${error?.message}`);
        assert.equal(n.title, 'Un billet vous est transféré', 'titre (G4)');
        assert.equal((n.metadata as Row).actionUrl, '/tickets?tab=recus', 'lien vers l’onglet Reçus');
    });

    test('numéro sans vérification : SMS au numéro seulement (aucune in-app à un compte non prouvé)', async () => {
        const to = await newBuyer('transf-non-verifie');
        const { id } = await initiateOk(owner, takeTicket(), to.phoneE164);
        const rows = await outboxRows({ type: 'TRANSFER_OFFERED', keyPrefix: `TRANSFER_OFFERED:${id}:` });
        assert.deepEqual(channelsOf(rows), ['SMS'], `canaux : ${JSON.stringify(rows.map((r) => r.channel))}`);
        assert.equal(rows[0].recipient_phone, to.phoneE164, 'SMS au numéro');
    });

    test('cible email : 400 RECIPIENT_PHONE_REQUIRED, aucun transfert, billet libre', async () => {
        const to = await verifiedRecipient('email');
        const ticketId = takeTicket();
        const res = await initiate(owner, ticketId, to.email);
        assert.equal(res.status, 400, `cible email : ${show(res)}`);
        assert.equal(res.body.code, 'RECIPIENT_PHONE_REQUIRED', `code : ${show(res)}`);
        assert.equal(res.body.error, 'Le billet se transfère vers un numéro de téléphone.', `message : ${show(res)}`);
        const { data, error } = await service.from('ticket_transfers').select('id').eq('ticket_id', ticketId);
        assert.equal(error, null, `transferts : ${error?.message}`);
        assert.deepEqual(data ?? [], [], 'aucun transfert créé');
        assert.equal((await ticketRow(ticketId)).transfer_locked, false, 'billet non verrouillé');
        const rpc = await service.rpc('ticket_transfer_initiate', {
            p: { ticket_id: ticketId, actor_id: owner.userId, recipient: to.email, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() },
        });
        assert.equal(rpc.error, null, `ticket_transfer_initiate : ${rpc.error?.message}`);
        assert.equal((rpc.data as Row).ok, false, `RPC : cible email refusée : ${JSON.stringify(rpc.data)}`);
        assert.equal((rpc.data as Row).code, 'RECIPIENT_PHONE_REQUIRED', `RPC : code : ${JSON.stringify(rpc.data)}`);
    });
});

// ── 2. Liste entrante ──────────────────────────────────────────────────────

describe('6.7 Transfert — liste entrante (B3 ticket_transfers_incoming, B4)', () => {
    test('vérifié → l’élément ; non vérifié → phoneVerificationRequired sans détail ; autre compte → rien ; ancien transfert vers un email → rien', async () => {
        const verified = await verifiedRecipient('liste-ok');
        const unverified = await newBuyer('transf-liste-nv');
        const stranger = await verifiedRecipient('liste-tiers');
        const emailTarget = await verifiedRecipient('liste-email');
        const t1 = await initiateOk(owner, takeTicket(), verified.phoneE164);
        const t2 = await initiateOk(owner, takeTicket(), unverified.phoneE164);
        const legacy = await legacyTransfer(takeTicket(), emailTarget.email);

        const ok = await incoming(verified);
        assert.equal(ok.status, 200, `liste du destinataire vérifié : ${show(ok)}`);
        assert.equal(ok.body.phoneVerificationRequired, false, `phoneVerificationRequired : ${show(ok)}`);
        const items = (ok.body.items ?? []) as Row[];
        assert.equal(items.length, 1, `un transfert entrant : ${show(ok)}`);
        const it = items[0];
        assert.equal(it.transfer_id, t1.id, 'transfer_id');
        assert.equal(it.sender_display, 'Awa D.', `expéditeur masqué « Prénom N. » : ${JSON.stringify(it)}`);
        assert.equal((it.ticket as Row)?.category_name, 'Standard', 'catégorie');
        assert.equal(Number((it.ticket as Row)?.price), 5_000, 'prix');
        assert.equal((it.event as Row)?.id, ev.eventId, 'événement');
        assert.equal((it.event as Row)?.title, ev.title, 'titre de l’événement');
        assert.ok(it.expires_at, 'échéance');
        assert.ok(!JSON.stringify(ok.body).includes(owner.phoneE164) && !JSON.stringify(ok.body).includes(owner.lastName), 'aucune donnée de l’expéditeur en clair');

        const nv = await incoming(unverified);
        assert.equal(nv.status, 200, `liste du numéro non vérifié : ${show(nv)}`);
        assert.deepEqual(nv.body.items, [], `aucun élément sans vérification du numéro : ${show(nv)}`);
        assert.equal(nv.body.phoneVerificationRequired, true, `phoneVerificationRequired : ${show(nv)}`);
        const raw = JSON.stringify(nv.body);
        assert.ok(!raw.includes(t2.id) && !raw.includes(ev.title) && !raw.includes(ev.eventId), `aucun détail du transfert : ${raw}`);

        for (const [who, label] of [[stranger, 'autre compte'], [emailTarget, 'ancien transfert vers un email']] as Array<[Buyer, string]>) {
            const res = await incoming(who);
            assert.equal(res.status, 200, `${label} : ${show(res)}`);
            assert.deepEqual(res.body.items, [], `${label} : rien (${show(res)})`);
            assert.equal(res.body.phoneVerificationRequired, false, `${label} : phoneVerificationRequired faux`);
        }
        assert.equal((await transferRow(legacy.id)).status, 'PENDING', 'ancien transfert : toujours PENDING (il expirera normalement)');
    });
});

// ── 3. Acceptation ─────────────────────────────────────────────────────────

describe('6.7 Transfert — acceptation par identifiant (B3 ticket_transfer_accept, B4)', () => {
    test('destinataire vérifié : 200, billet transféré, identité du billet renouvelée, TRANSFER_CLAIMED_SENDER et TRANSFER_RECEIVED (in-app, push, email du destinataire, aucun SMS) ; second appel 409', async () => {
        const to = await verifiedRecipient('accepte');
        const ticketId = takeTicket();
        const { id } = await initiateOk(owner, ticketId, to.phoneE164);
        const before0 = await ticketRow(ticketId);
        const res = await claim(to, id);
        assert.equal(res.status, 200, `acceptation : ${show(res)}`);
        assert.equal(res.body.message, 'Billet ajouté à vos billets.', `message : ${show(res)}`);
        const c = (res.body.claim ?? {}) as Row;
        assert.equal(c.transfer_id, id, 'claim.transfer_id');
        assert.equal(c.ticket_id, ticketId, 'claim.ticket_id');
        assert.equal(c.event_title, ev.title, 'claim.event_title');
        assert.ok(c.claimed_at, 'claim.claimed_at');
        const afterT = await ticketRow(ticketId);
        assert.equal(afterT.user_id, to.userId, 'billet au destinataire');
        assert.equal(afterT.transfer_locked, false, 'billet déverrouillé');
        assert.notEqual(afterT.qr_code, before0.qr_code, 'QR renouvelé');
        assert.notEqual(afterT.totp_secret, before0.totp_secret, 'secret TOTP renouvelé');
        assert.notEqual(afterT.ticket_number, before0.ticket_number, 'numéro renouvelé');
        assert.equal(Number(afterT.security_version), Number(before0.security_version) + 1, 'security_version + 1');
        assert.equal(c.ticket_number, afterT.ticket_number, 'claim.ticket_number = nouveau numéro');
        const tr = await transferRow(id);
        assert.equal(tr.status, 'CLAIMED', 'transfert CLAIMED');
        assert.equal(tr.to_user_id, to.userId, 'to_user_id');

        const sender = await outboxRows({ type: 'TRANSFER_CLAIMED_SENDER', keyPrefix: `TRANSFER_CLAIMED_SENDER:${id}:` });
        assert.deepEqual(channelsOf(sender), ['IN_APP', 'PUSH'], `expéditeur prévenu (in-app, push ; aucun SMS, décision 15) : ${JSON.stringify(sender.map((r) => r.channel))}`);
        assert.ok(sender.every((r) => r.recipient_user_id === owner.userId), 'à l’expéditeur');
        const received = await outboxRows({ type: 'TRANSFER_RECEIVED', keyPrefix: `TRANSFER_RECEIVED:${id}:` });
        // Lot 7, tâche 7.9 (D91) : le destinataire reçoit aussi l'email de confirmation (nouveau numéro du billet).
        assert.deepEqual(channelsOf(received), ['EMAIL', 'IN_APP', 'PUSH'], `destinataire prévenu (in-app, push, email ; D91) : ${JSON.stringify(received.map((r) => r.channel))}`);
        assert.ok(received.every((r) => r.recipient_user_id === to.userId), 'au destinataire');
        const mark = smsMark(owner.phoneE164);
        const markTo = smsMark(to.phoneE164);
        await dispatchAt(new Date(), { ids: [...sender, ...received].map((r) => r.id) });
        assert.equal(smsTo(owner.phoneE164, mark).length + smsTo(to.phoneE164, markTo).length, 0, 'aucun SMS après l’acceptation');

        const again = await claim(to, id);
        assert.equal(again.status, 409, `second appel : ${show(again)}`);
        assert.equal(again.body.code, 'TRANSFER_NOT_PENDING', `code : ${show(again)}`);
    });

    test('refus : 404 identique (inconnu, transfert d’un autre, ancien transfert vers un email), 403 PHONE_NOT_VERIFIED, 410 TRANSFER_EXPIRED, 400 SELF_TRANSFER ; billet inchangé', async () => {
        const unverified = await newBuyer('transf-refus-nv');
        const stranger = await verifiedRecipient('refus-tiers');
        const target = await verifiedRecipient('refus-cible');
        const emailTarget = await verifiedRecipient('refus-email');
        const tNv = await initiateOk(owner, takeTicket(), unverified.phoneE164);

        const unknown = await claim(stranger, randomUUID());
        const other = await claim(stranger, tNv.id);
        const legacy = await legacyTransfer(takeTicket(), emailTarget.email);
        const byEmail = await claim(emailTarget, legacy.id);
        for (const [res, label] of [[unknown, 'identifiant inconnu'], [other, 'transfert adressé à un autre'], [byEmail, 'ancien transfert vers un email']] as Array<[RouteResult, string]>) {
            assert.equal(res.status, 404, `${label} : ${show(res)}`);
            assert.equal(res.body.code, 'TRANSFER_NOT_FOUND', `${label} : code : ${show(res)}`);
            assert.equal(res.body.error, 'Ce transfert est introuvable.', `${label} : message : ${show(res)}`);
        }
        assert.deepEqual(other.body, unknown.body, 'aucune fuite d’existence : même réponse (décision 36)');

        const nv = await claim(unverified, tNv.id);
        assert.equal(nv.status, 403, `numéro non vérifié : ${show(nv)}`);
        assert.equal(nv.body.code, 'PHONE_NOT_VERIFIED', `code : ${show(nv)}`);
        assert.equal(nv.body.error, "Confirmez d'abord votre numéro par un code SMS.", `message : ${show(nv)}`);

        const expiredTicket = takeTicket();
        const tExp = await initiateOk(owner, expiredTicket, target.phoneE164);
        const { error: eErr } = await service.from('ticket_transfers')
            .update({ created_at: new Date(Date.now() - 49 * 3600_000).toISOString(), expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', tExp.id);
        assert.equal(eErr, null, `échéance passée : ${eErr?.message}`);
        const exp = await claim(target, tExp.id);
        assert.equal(exp.status, 410, `transfert échu : ${show(exp)}`);
        assert.equal(exp.body.code, 'TRANSFER_EXPIRED', `code : ${show(exp)}`);
        assert.equal((await ticketRow(expiredTicket)).user_id, owner.userId, 'transfert échu : billet resté au porteur');

        const selfTicket = takeTicket();
        const tSelf = await initiateOk(owner, selfTicket, target.phoneE164);
        await markPhoneVerified(owner.userId);
        const { error: sErr } = await service.from('ticket_transfers').update({ to_phone_or_email: owner.phoneE164 }).eq('id', tSelf.id);
        assert.equal(sErr, null, `cible = expéditeur : ${sErr?.message}`);
        const self = await claim(owner, tSelf.id);
        assert.equal(self.status, 400, `expéditeur = acteur : ${show(self)}`);
        assert.equal(self.body.code, 'SELF_TRANSFER', `code : ${show(self)}`);
        assert.equal((await transferRow(tSelf.id)).status, 'PENDING', 'refus : transfert toujours PENDING');
    });
});

// ── 4. Ancienne route et page ──────────────────────────────────────────────

describe('6.7 Transfert — ancien lien /tickets/claim/<jeton> retiré (B4, décision 37)', () => {
    test('GET et POST → 410 CLAIM_LINK_RETIRED, même réponse pour un vrai et un faux jeton ; POST sans session → 401 ; transfert intact', async () => {
        const target = await verifiedRecipient('ancien-lien');
        const real = await legacyTransfer(takeTicket(), target.phoneE164);
        const fake = randomBytes(32).toString('hex');
        const mod = await importModule(LEGACY_ROUTE);
        const results: Array<[string, RouteResult]> = [];
        for (const [label, token] of [['vrai jeton', real.token], ['faux jeton', fake]]) {
            results.push([`GET ${label}`, await invoke(mod.GET as Handler, new NextRequest(`${BASE_URL}/api/tickets/claim/${token}`), routeContext({ token }))]);
            results.push([`POST ${label}`, await invoke(mod.POST as Handler, authed(`/api/tickets/claim/${token}`, 'POST', target), routeContext({ token }))]);
        }
        for (const [label, res] of results) {
            assert.equal(res.status, 410, `${label} : ${show(res)}`);
            assert.deepEqual(res.body, { error: RETIRED_MESSAGE, code: 'CLAIM_LINK_RETIRED' }, `${label} : corps exact`);
        }
        const anonPost = await invoke(mod.POST as Handler, publicRequest(`/api/tickets/claim/${real.token}`, {}), routeContext({ token: real.token }));
        assert.equal(anonPost.status, 401, `POST sans session : requireActiveSession d'abord : ${show(anonPost)}`);
        const tr = await transferRow(real.id);
        assert.equal(tr.status, 'PENDING', 'le vrai jeton ne réclame plus rien');
        assert.equal(tr.to_user_id ?? null, null, 'aucun destinataire posé');
    });

    test('contrôle statique : la route retirée ne lit pas la base ; la page est une redirection serveur vers /tickets?tab=recus', () => {
        const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
        const route = strip(fs.readFileSync(path.resolve(ROOT, LEGACY_ROUTE_FILE), 'utf8'));
        for (const forbidden of [/\bfrom\s*\(/, /\brpc\s*\(/, /\bTicketTransferService\b/]) {
            assert.doesNotMatch(route, forbidden, `${LEGACY_ROUTE_FILE} : ${forbidden} interdit (contrat B4)`);
        }
        assert.match(route, /requireActiveSession/, `${LEGACY_ROUTE_FILE} : POST derrière requireActiveSession`);
        assert.match(route, /CLAIM_LINK_RETIRED/, `${LEGACY_ROUTE_FILE} : code CLAIM_LINK_RETIRED`);
        const page = strip(fs.readFileSync(path.resolve(ROOT, LEGACY_PAGE_FILE), 'utf8'));
        assert.doesNotMatch(page, /['"]use client['"]/, `${LEGACY_PAGE_FILE} : composant serveur (pas de « use client »)`);
        assert.match(page, /\bredirect\s*\(\s*['"]\/tickets\?tab=recus['"]\s*\)/, `${LEGACY_PAGE_FILE} : redirect('/tickets?tab=recus')`);
        assert.match(page, /from\s+['"]next\/navigation['"]/, `${LEGACY_PAGE_FILE} : redirect de next/navigation`);
    });
});

// ── 5. Vérification du numéro ──────────────────────────────────────────────

describe('6.7 Transfert — verify-otp pose phone_verified_at (B1)', () => {
    test('code de connexion vérifié : phone_verified_at posé une fois (conservé ensuite) ; le transfert qui attendait devient visible', async () => {
        const holder = await newBuyer('transf-verif-otp');
        const t = await initiateOk(owner, takeTicket(), holder.phoneE164);
        const pending = await incoming(holder);
        assert.equal(pending.body.phoneVerificationRequired, true, `avant vérification : ${show(pending)}`);

        const { POST: sendOtp } = await importModule('../../app/api/auth/send-otp/route');
        const { POST: verifyOtp } = await importModule('../../app/api/auth/verify-otp/route');
        const cycle = async (): Promise<void> => {
            const before0 = getFakes().sms.messagesTo(holder.phoneE164).length;
            const sent = await invoke(sendOtp as Handler, publicRequest('/api/auth/send-otp', { phone: holder.phoneE164, purpose: 'LOGIN' }, { 'x-forwarded-for': `${freshIp()}, 10.0.0.1` }));
            assert.equal(sent.status, 200, `send-otp : ${show(sent)}`);
            const msgs = getFakes().sms.messagesTo(holder.phoneE164).slice(before0);
            const code = msgs.map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter(Boolean).pop();
            assert.ok(code, `code reçu au ${holder.phoneE164}`);
            const verified = await invoke(verifyOtp as Handler, publicRequest('/api/auth/verify-otp', { phone: holder.phoneE164, otpCode: code, purpose: 'LOGIN' }, { 'x-forwarded-for': `${freshIp()}, 10.0.0.1` }));
            assert.equal(verified.status, 200, `verify-otp : ${show(verified)}`);
        };
        await cycle();
        const read = async (): Promise<string | null> => {
            const { data, error } = await service.from('users').select('phone_verified_at').eq('id', holder.userId).single();
            assert.equal(error, null, `phone_verified_at : ${error?.message} (colonne du contrat B1)`);
            return (data.phone_verified_at as string | null) ?? null;
        };
        const first = await read();
        assert.ok(first, 'verify-otp : users.phone_verified_at posé');
        await cycle();
        assert.equal(await read(), first, 'seconde vérification : première date conservée (COALESCE)');

        const visible = await incoming(holder);
        assert.equal(visible.status, 200, `après vérification : ${show(visible)}`);
        assert.equal(visible.body.phoneVerificationRequired, false, `après vérification : ${show(visible)}`);
        assert.deepEqual(((visible.body.items ?? []) as Row[]).map((i) => i.transfer_id), [t.id], 'le transfert qui attendait est listé');
    });
});
