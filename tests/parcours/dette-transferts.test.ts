/**
 * Lot 5, tâche 5.0 — dette du lot 4, C1 : transferts entre particuliers sans aucun repli en mémoire.
 * Contrat : section C1 de la conception du lot 5.
 *  - RPC ticket_transfer_initiate(p), ticket_transfer_cancel(p), ticket_transfers_expire(p) : chacune
 *    pose le transfert et tickets.transfer_locked dans la même transaction (SECURITY DEFINER,
 *    search_path = public, service_role seul) ;
 *  - le service n'a plus de mémoire (inMemoryTransfers et activeTransfersLock supprimés), toute erreur
 *    remonte ; getTransferRecord, getTransferByTicketId et isTicketLocked lisent la base et lèvent sur
 *    erreur ;
 *  - un échec du SMS au destinataire ne casse pas le transfert : la réponse porte recipient_notified ;
 *  - les crons ticket-transfers et moratoriums passent par refuseUnlessCron, sans repli sur la clé
 *    service_role.
 *
 * Rouge avant correctif :
 *  - lib/tickets/ticket-transfer.service.ts:92-93 (Set et Map statiques), :195-197, :300-306, :745-755,
 *    :826-828 (catch vides ou commentés), :851-891 (lectures qui avalent l'erreur puis lisent la Map :
 *    un identifiant mal formé donne null ou false au lieu d'une erreur) ; aucune des trois RPC n'existe
 *    (seule ticket_transfer_claim, supabase/migrations/20261101000010_lot4_scan.sql:254-305) ;
 *  - app/api/tickets/[id]/transfer/route.ts:55-70 : la réponse ne dit pas si le destinataire a été
 *    prévenu (service :326-346, échec du SMS seulement journalisé) ;
 *  - app/api/cron/ticket-transfers/route.ts:21-26 et app/api/cron/moratoriums/route.ts:21-26 :
 *    CRON_SECRET || SUPABASE_SERVICE_ROLE_KEY ; sans CRON_SECRET, la clé service_role déclenche le cron.
 *
 * Interprétations retenues (contrat muet sur les clés de p et la forme des réponses) :
 *  - initiate reçoit { ticket_id, actor_id, from_user_id, recipient, to_phone_or_email,
 *    claim_token_hash, expires_at } (les deux noms de l'acteur et du destinataire sont passés) ;
 *    cancel reçoit { transfer_id, actor_id, from_user_id } ; expire reçoit {} ; le résultat est lu en
 *    base, la réponse n'est contrôlée que sur `ok` ;
 *  - recipient_notified est lu à la racine de la réponse de la route, ou dans `transfer` ;
 *  - refus d'une RPC = `ok: false` (code libre), ou erreur levée pour une entrée invalide.
 * La suite crée son partenaire, son événement, son acheteur et ses billets.
 *
 * Lot 8 (8.2 v) : cas portés, verts dès l'écriture : T5 de tests/legacy/ticket-transfer-phase2-initiation.test.ts
 * (billet UTILISE), T11, T12, T15, T16 de tests/legacy/ticket-transfer-phase3-claim.test.ts (route d'annulation,
 * rejeu de l'expiration, nouveau transfert après expiration). Écarts au legacy : billet composté par un vrai scan ;
 * refus par code stable ; T15 compté sur le transfert de la suite (le legacy attendait 0 expiration sur toute la
 * base, faux dès qu'une autre suite laisse un transfert échu).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { resetServerEnvCache } from '../../lib/env';
import { inspect } from '../helpers/db';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { getFakes } from '../fakes';
import { confirmPassword, randomSenegalPhone, routeContext, STRONG_PASSWORD } from './helpers';
import { cronRequest, importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, scan, ticketPayload, ticketRow, type RouteResult } from './acces-helpers';
import { dispatchAt, loadLotModule, outboxRows } from './notif-helpers';

const ROOT = process.cwd();
const SERVICE_FILE = 'lib/tickets/ticket-transfer.service.ts';
const TRANSFER_ROUTE = '../../app/api/tickets/[id]/transfer/route'; const confirmedSessions = new Map<string, Promise<void>>(); // lot 9 bis (R57, T34) : une confirmation par session (quota par compte)
const CRON_ROUTE = '../../app/api/cron/ticket-transfers/route';
const CANCEL_ROUTE = '../../app/api/tickets/transfers/[id]/cancel/route';
const RPCS = ['ticket_transfer_initiate', 'ticket_transfer_cancel', 'ticket_transfers_expire'];
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');

let partner: TestPartner;
let ev: SaleEvent;
let owner: Buyer;
let stranger: Buyer;
let tickets: string[] = [];

before(async () => {
    partner = await newPartner('dette-transferts');
    ev = await createTimedEvent(partner.partnerId, 'dette-transferts', [{ name: 'Standard', price: 2000, total: 40, maxPerOrder: 20 }], { startsInHours: 48 });
    owner = await newBuyer('transf-porteur');
    stranger = await newBuyer('transf-tiers');
    tickets = (await buyConfirmed(owner, ev, [['Standard', 12]])).tickets.map((t) => String(t.id));
    assert.equal(tickets.length, 12, 'douze billets émis par le checkout');
});

after(async () => {
    await assertLifecycleInvariants('dette-transferts');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

async function invoke(handler: Handler, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

function show(res: RouteResult): string {
    return `HTTP ${res.status} ${JSON.stringify(res.body)}`;
}

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function source(rel: string): string {
    return stripComments(fs.readFileSync(path.resolve(ROOT, rel), 'utf8'));
}

async function initiateByRoute(user: Buyer, ticketId: string, recipient: string): Promise<RouteResult> {
    if (!confirmedSessions.has(user.accessToken)) confirmedSessions.set(user.accessToken, confirmPassword(user, STRONG_PASSWORD)); await confirmedSessions.get(user.accessToken); const { POST } = await importModule(TRANSFER_ROUTE);
    return invoke(POST as Handler, authed(`/api/tickets/${ticketId}/transfer`, 'POST', user, { recipient }), routeContext({ id: ticketId }));
}

async function transfersOf(ticketId: string): Promise<Row[]> {
    const { data, error } = await service.from('ticket_transfers').select('*').eq('ticket_id', ticketId).order('created_at');
    assert.equal(error, null, `transferts du billet ${ticketId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function pendingOf(ticketId: string): Promise<Row[]> {
    return (await transfersOf(ticketId)).filter((t) => t.status === 'PENDING');
}

async function lockOf(ticketId: string): Promise<boolean> {
    return (await ticketRow(ticketId)).transfer_locked === true;
}

/** recipient_notification de la réponse de la route (racine, ou objet `transfer`) — lot 6 (B4). */
function recipientNotification(body: Row): unknown {
    if ('recipient_notification' in body) return body.recipient_notification;
    const transfer = (body.transfer ?? {}) as Row;
    return transfer.recipient_notification;
}

async function eventTitle(eventId: string): Promise<string> {
    const { data, error } = await service.from('events').select('title').eq('id', eventId).single();
    assert.equal(error, null, `titre de l'événement : ${error?.message}`);
    return String(data.title);
}

function claimHash(): string {
    return createHash('sha256').update(randomBytes(32).toString('hex')).digest('hex');
}

function initiateParams(ticketId: string, actorId: string, recipient: string, overrides: Row = {}): Row {
    return {
        ticket_id: ticketId,
        actor_id: actorId,
        from_user_id: actorId,
        recipient,
        to_phone_or_email: recipient,
        claim_token_hash: claimHash(),
        expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
        ...overrides,
    };
}

interface RpcReply { data: Row | null; error: { message: string; code?: string } | null }

async function rpc(name: string, p: Row): Promise<RpcReply> {
    const { data, error } = await service.rpc(name, { p });
    return { data: (data ?? null) as Row | null, error };
}

function assertRpcOk(reply: RpcReply, what: string): Row {
    assert.equal(reply.error, null, `${what} : ${reply.error?.message} (code ${reply.error?.code})`);
    assert.ok(reply.data, `${what} : réponse vide`);
    assert.equal(reply.data.ok, true, `${what} refusé : ${JSON.stringify(reply.data)}`);
    return reply.data;
}

/** Refus d'une RPC du contrat : la fonction existe (pas d'erreur « introuvable ») et répond ok: false. */
function assertRpcRefused(reply: RpcReply, what: string): void {
    assert.equal(reply.error, null, `${what} : refus attendu sous la forme { ok: false, code }, reçu l’erreur ${reply.error?.message} (code ${reply.error?.code})`);
    assert.equal(reply.data?.ok, false, `${what} : refus attendu, reçu ${JSON.stringify(reply.data)}`);
    assert.equal(typeof reply.data?.code, 'string', `${what} : code de refus attendu : ${JSON.stringify(reply.data)}`);
}

/** Transfert PENDING vieilli : échu depuis une heure (le CHECK expires_at > created_at reste vrai). */
async function ageTransfer(transferId: string): Promise<void> {
    const { error } = await service.from('ticket_transfers').update({
        created_at: new Date(Date.now() - 49 * 3600_000).toISOString(),
        expires_at: new Date(Date.now() - 3600_000).toISOString(),
    }).eq('id', transferId);
    assert.equal(error, null, `vieillissement du transfert ${transferId} : ${error?.message}`);
}

/** Transfert PENDING créé par la route (code actuel comme code corrigé), puis rendu échu. */
async function overdueTransfer(ticketId: string): Promise<string> {
    const res = await initiateByRoute(owner, ticketId, randomSenegalPhone('77'));
    assert.equal(res.status, 200, `initiation de préparation : ${show(res)}`);
    const pending = await pendingOf(ticketId);
    assert.equal(pending.length, 1, `préparation : un transfert PENDING en base (trouvé ${pending.length})`);
    await ageTransfer(String(pending[0].id));
    assert.equal(await lockOf(ticketId), true, 'préparation : billet verrouillé');
    return String(pending[0].id);
}

async function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
    const saved = new Map<string, string | undefined>();
    for (const [k, v] of Object.entries(overrides)) {
        saved.set(k, process.env[k]);
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    resetServerEnvCache();
    try {
        return await fn();
    } finally {
        saved.forEach((v, k) => {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        });
        resetServerEnvCache();
    }
}

async function runCron(authorization: string | null): Promise<RouteResult> {
    const { GET } = await importModule(CRON_ROUTE);
    return invoke(GET as Handler, cronRequest('/api/cron/ticket-transfers', authorization));
}

// ── Contrôles statiques ────────────────────────────────────────────────────

describe('C1 — service sans mémoire (contrôle statique)', () => {
    test('lib/tickets/ticket-transfer.service.ts : plus aucun inMemoryTransfers ni activeTransfersLock', () => {
        const src = source(SERVICE_FILE);
        const hits = ['inMemoryTransfers', 'activeTransfersLock'].filter((name) => new RegExp(`\\b${name}\\b`).test(src));
        assert.deepEqual(hits, [], `état en mémoire encore présent dans ${SERVICE_FILE} : ${hits.join(', ')}`);
    });

    test('aucun catch vide ou réduit à un commentaire : toute erreur remonte', () => {
        const raw = fs.readFileSync(path.resolve(ROOT, SERVICE_FILE), 'utf8');
        const lines = raw.split(/\r?\n/);
        const offenders: string[] = [];
        const re = /catch\s*(\([^)]*\))?\s*\{(\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*\}/g;
        for (const m of Array.from(raw.matchAll(re))) {
            const line = raw.slice(0, m.index ?? 0).split(/\r?\n/).length;
            offenders.push(`${SERVICE_FILE}:${line} ${lines[line - 1].trim()}`);
        }
        assert.deepEqual(offenders, [], `catch qui avalent l’erreur :\n${offenders.join('\n')}`);
    });

    test('initiation, annulation et expiration passent par les RPC du contrat', () => {
        const src = source(SERVICE_FILE);
        const missing = RPCS.filter((name) => !new RegExp(`['"\`]${name}['"\`]`).test(src));
        assert.deepEqual(missing, [], `RPC non appelées par ${SERVICE_FILE} : ${missing.join(', ')}`);
    });

    test('crons ticket-transfers et moratoriums : refuseUnlessCron, aucun repli sur la clé service_role', () => {
        const problems: string[] = [];
        for (const rel of ['app/api/cron/ticket-transfers/route.ts', 'app/api/cron/moratoriums/route.ts']) {
            const src = source(rel);
            if (!/\brefuseUnlessCron\s*\(/.test(src)) problems.push(`${rel} : refuseUnlessCron absent`);
            if (/SUPABASE_SERVICE_ROLE_KEY/.test(src)) problems.push(`${rel} : repli sur SUPABASE_SERVICE_ROLE_KEY`);
        }
        assert.deepEqual(problems, [], problems.join('\n'));
    });
});

// ── Catalogue ──────────────────────────────────────────────────────────────

describe('C1 — RPC du contrat dans le catalogue', () => {
    test('ticket_transfer_initiate, ticket_transfer_cancel, ticket_transfers_expire : SECURITY DEFINER, search_path = public, service_role seul', async () => {
        const rows = await inspect(async (db) => (await db.query<{ name: string; secdef: boolean; config: string[] | null; anon: boolean; auth: boolean }>(
            `SELECT p.proname AS name, p.prosecdef AS secdef, p.proconfig AS config,
                    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [RPCS])).rows);
        const missing = RPCS.filter((name) => !rows.some((r) => r.name === name));
        assert.deepEqual(missing, [], `fonctions absentes : ${missing.join(', ')}`);
        for (const r of rows) {
            assert.equal(r.secdef, true, `${r.name} : SECURITY DEFINER`);
            assert.ok((r.config ?? []).some((c) => /^search_path=public$/.test(c)), `${r.name} : search_path = public (${JSON.stringify(r.config)})`);
            assert.equal(r.anon, false, `${r.name} : non exécutable par anon`);
            assert.equal(r.auth, false, `${r.name} : non exécutable par authenticated`);
        }
    });
});

// ── Initiation par la route ────────────────────────────────────────────────

describe('C1 — initiation par la route', () => {
    // Lot 6 (contrat B6, T) : l'offre au destinataire passe par la boîte d'envoi (recipient_notification
    // QUEUED, ligne TRANSFER_OFFERED SMS PENDING), puis l'envoyeur la remet ; plus aucun SMS dans la route.
    test('initiation vers un téléphone : transfert PENDING et transfer_locked posés ensemble ; offre en file (QUEUED), SMS exact remis par l’envoyeur', async () => {
        const ticketId = tickets[0];
        const recipient = randomSenegalPhone('77');
        const sms = getFakes().sms;
        const sentBefore = sms.messagesTo(recipient).length;
        const res = await initiateByRoute(owner, ticketId, recipient);
        assert.equal(res.status, 200, `initiation : ${show(res)}`);
        const pending = await pendingOf(ticketId);
        assert.equal(pending.length, 1, `un transfert PENDING en base (trouvé ${pending.length})`);
        assert.equal(pending[0].from_user_id, owner.userId, 'émetteur = porteur');
        assert.equal(await lockOf(ticketId), true, 'billet verrouillé (transfer_locked)');
        assert.equal(recipientNotification(res.body), 'QUEUED', `recipient_notification: QUEUED attendu dans la réponse : ${show(res)}`);
        assert.equal(sms.messagesTo(recipient).length, sentBefore, 'aucun SMS envoyé par la route (boîte d’envoi)');

        const rows = await outboxRows({ type: 'TRANSFER_OFFERED', keyPrefix: `TRANSFER_OFFERED:${pending[0].id}:` });
        assert.deepEqual(rows.map((r) => `${r.channel}:${r.status}`), ['SMS:PENDING'], `offre en file : une ligne SMS PENDING (${JSON.stringify(rows.map((r) => [r.channel, r.status, r.reason]))})`);
        assert.equal(rows[0].recipient_phone, recipient, 'SMS au numéro saisi');
        await dispatchAt(new Date(), { ids: rows.map((r) => r.id) });
        const [sent] = await outboxRows({ ids: [rows[0].id] });
        assert.equal(sent.status, 'SENT', `SMS remis par l’envoyeur (${sent.status} ${sent.reason ?? ''})`);
        assert.ok(sent.provider_message_id, 'identifiant du fournisseur enregistré');
        const fmt = await loadLotModule('../../lib/notifications/sms-format', 'formats SMS (contrat F2)');
        const smsVar = fmt.smsVar as (v: string, max: number) => string;
        const smsShortDateTime = fmt.smsShortDateTime as (v: string) => string;
        const expected = `Event Village : un billet ${smsVar(await eventTitle(ev.eventId), 20)} vous est transféré. Connectez-vous avec ce numéro avant le ${smsShortDateTime(new Date(String(pending[0].expires_at)).toISOString())} : ${APP_URL}/tickets`;
        assert.deepEqual(sms.messagesTo(recipient).slice(sentBefore).map((m) => m.message), [expected], 'un SMS au destinataire, texte exact (G3)');
    });

    test('échec du SMS au destinataire : transfert conservé (PENDING, billet verrouillé), ligne relancée (PENDING, 1 tentative, prochain essai à +1 min)', async () => {
        const ticketId = tickets[1];
        const recipient = randomSenegalPhone('77');
        const sms = getFakes().sms;
        const res = await initiateByRoute(owner, ticketId, recipient);
        assert.equal(res.status, 200, `l’initiation ne dépend pas du SMS : ${show(res)}`);
        assert.equal(recipientNotification(res.body), 'QUEUED', `recipient_notification: QUEUED attendu dans la réponse : ${show(res)}`);
        const pending = await pendingOf(ticketId);
        assert.equal(pending.length, 1, 'transfert PENDING en base');
        const rows = await outboxRows({ type: 'TRANSFER_OFFERED', keyPrefix: `TRANSFER_OFFERED:${pending[0].id}:SMS` });
        assert.equal(rows.length, 1, 'ligne SMS de l’offre');
        sms.failNext('panne MTarget simulée (lot 6, relance)');
        const now = new Date();
        await dispatchAt(now, { ids: rows.map((r) => r.id) });
        assert.ok(sms.messagesTo(recipient).some((m) => !m.success), 'précondition : l’envoi au destinataire a échoué (faux MTarget)');
        const [retry] = await outboxRows({ ids: [rows[0].id] });
        assert.equal(retry.status, 'PENDING', `échec temporaire : ligne remise en attente (${retry.status} ${retry.reason ?? ''})`);
        assert.equal(Number(retry.attempts), 1, 'une tentative comptée');
        assert.equal(new Date(String(retry.next_attempt_at)).getTime(), now.getTime() + 60_000, 'prochain essai une minute après la tentative');
        assert.equal((await pendingOf(ticketId)).length, 1, 'transfert PENDING conservé en base');
        assert.equal(await lockOf(ticketId), true, 'billet verrouillé');
    });

    test('garde-fou : deux initiations simultanées du même billet → une seule réussit, un seul transfert PENDING', async () => {
        const ticketId = tickets[2];
        const results = await Promise.all([
            initiateByRoute(owner, ticketId, randomSenegalPhone('77')),
            initiateByRoute(owner, ticketId, randomSenegalPhone('77')),
        ]);
        const ok = results.filter((r) => r.status === 200);
        assert.equal(ok.length, 1, `une seule initiation acceptée : ${results.map(show).join(' | ')}`);
        const refused = results.find((r) => r.status !== 200)!;
        assert.ok(refused.status >= 400 && refused.status < 500, `refus explicite (4xx) de la seconde : ${show(refused)}`);
        assert.equal((await pendingOf(ticketId)).length, 1, 'un seul transfert PENDING');
        assert.equal(await lockOf(ticketId), true, 'billet verrouillé');
    });
});

// ── RPC ────────────────────────────────────────────────────────────────────

describe('C1 — RPC transactionnelles', () => {
    test('ticket_transfer_initiate : transfert PENDING et verrou ensemble ; second transfert refusé ; tiers refusé sans effet', async () => {
        const ticketId = tickets[3];
        const recipient = randomSenegalPhone('77');
        assertRpcOk(await rpc('ticket_transfer_initiate', initiateParams(ticketId, owner.userId, recipient)), 'ticket_transfer_initiate');
        const pending = await pendingOf(ticketId);
        assert.equal(pending.length, 1, `un transfert PENDING (trouvé ${pending.length})`);
        assert.equal(pending[0].from_user_id, owner.userId, 'émetteur = porteur');
        assert.equal(await lockOf(ticketId), true, 'transfer_locked posé par la même RPC');

        assertRpcRefused(await rpc('ticket_transfer_initiate', initiateParams(ticketId, owner.userId, randomSenegalPhone('77'))), 'second transfert du même billet');
        assert.equal((await pendingOf(ticketId)).length, 1, 'toujours un seul transfert PENDING');

        const other = tickets[4];
        assertRpcRefused(await rpc('ticket_transfer_initiate', initiateParams(other, stranger.userId, randomSenegalPhone('77'))), 'transfert par un compte qui n’est pas le porteur');
        assert.deepEqual(await transfersOf(other), [], 'aucun transfert écrit pour le billet d’autrui');
        assert.equal(await lockOf(other), false, 'billet d’autrui non verrouillé');
    });

    test('ticket_transfer_initiate : entrée invalide → rien d’écrit, pas de verrou ; deux appels simultanés → un seul transfert', async () => {
        const ticketId = tickets[5];
        const rows = await inspect(async (db) => (await db.query<{ n: number }>(
            `SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'ticket_transfer_initiate'`)).rows);
        assert.equal(rows[0].n, 1, 'précondition : fonction ticket_transfer_initiate présente');

        // Lot 6 (B6, décision 38) : le jeton n'existe plus au contrat ; entrée invalide = destinataire absent.
        const invalid = await rpc('ticket_transfer_initiate', initiateParams(ticketId, owner.userId, randomSenegalPhone('77'), { recipient: null, to_phone_or_email: null }));
        assert.ok(invalid.error || invalid.data?.ok === false, `entrée invalide (destinataire absent) acceptée : ${JSON.stringify(invalid.data)}`);
        assert.deepEqual(await transfersOf(ticketId), [], 'aucun transfert écrit');
        assert.equal(await lockOf(ticketId), false, 'aucun verrou posé sans transfert');

        const both = await Promise.all([
            rpc('ticket_transfer_initiate', initiateParams(ticketId, owner.userId, randomSenegalPhone('77'))),
            rpc('ticket_transfer_initiate', initiateParams(ticketId, owner.userId, randomSenegalPhone('77'))),
        ]);
        assert.equal(both.filter((r) => r.error === null && r.data?.ok === true).length, 1, `un seul appel accepté : ${JSON.stringify(both)}`);
        assert.equal((await pendingOf(ticketId)).length, 1, 'un seul transfert PENDING');
        assert.equal(await lockOf(ticketId), true, 'billet verrouillé');
    });

    test('ticket_transfer_cancel : CANCELLED et billet déverrouillé ensemble ; annulation par un tiers refusée sans effet', async () => {
        const ticketId = tickets[6];
        const res = await initiateByRoute(owner, ticketId, randomSenegalPhone('77'));
        assert.equal(res.status, 200, `initiation de préparation : ${show(res)}`);
        const transferId = String((await pendingOf(ticketId))[0]?.id ?? '');
        assert.ok(transferId, 'préparation : transfert PENDING en base');

        assertRpcRefused(await rpc('ticket_transfer_cancel', { transfer_id: transferId, actor_id: stranger.userId, from_user_id: stranger.userId }), 'annulation par un tiers');
        assert.equal((await pendingOf(ticketId)).length, 1, 'transfert toujours PENDING');
        assert.equal(await lockOf(ticketId), true, 'billet toujours verrouillé');

        assertRpcOk(await rpc('ticket_transfer_cancel', { transfer_id: transferId, actor_id: owner.userId, from_user_id: owner.userId }), 'ticket_transfer_cancel');
        const row = (await transfersOf(ticketId)).find((t) => t.id === transferId)!;
        assert.equal(row.status, 'CANCELLED', 'transfert CANCELLED');
        assert.ok(row.cancelled_at, 'cancelled_at renseigné');
        assert.equal(await lockOf(ticketId), false, 'billet déverrouillé par la même RPC');
    });

    test('ticket_transfers_expire : transfert échu → EXPIRED et billet déverrouillé ; transfert en cours intact', async () => {
        const overdueTicket = tickets[7];
        const overdueId = await overdueTransfer(overdueTicket);
        const liveTicket = tickets[8];
        const live = await initiateByRoute(owner, liveTicket, randomSenegalPhone('77'));
        assert.equal(live.status, 200, `transfert en cours de préparation : ${show(live)}`);

        assertRpcOk(await rpc('ticket_transfers_expire', {}), 'ticket_transfers_expire');
        const expired = (await transfersOf(overdueTicket)).find((t) => t.id === overdueId)!;
        assert.equal(expired.status, 'EXPIRED', 'transfert échu → EXPIRED');
        assert.ok(expired.expired_at, 'expired_at renseigné');
        assert.equal(await lockOf(overdueTicket), false, 'billet déverrouillé par la même RPC');
        assert.equal((await pendingOf(liveTicket)).length, 1, 'transfert non échu toujours PENDING');
        assert.equal(await lockOf(liveTicket), true, 'billet du transfert en cours toujours verrouillé');
    });
});

// ── Lectures strictes ──────────────────────────────────────────────────────

describe('C1 — lectures strictes du service', () => {
    test('getTransferRecord, getTransferByTicketId, isTicketLocked lisent la base et lèvent sur erreur (identifiant mal formé)', async () => {
        const ticketId = tickets[9];
        const res = await initiateByRoute(owner, ticketId, randomSenegalPhone('77'));
        assert.equal(res.status, 200, `initiation de préparation : ${show(res)}`);
        const transferId = String((await pendingOf(ticketId))[0]?.id ?? '');
        assert.ok(transferId, 'préparation : transfert PENDING en base');

        const { TicketTransferService } = await importModule('../../lib/tickets/ticket-transfer.service');
        const record = (await TicketTransferService.getTransferRecord(transferId)) as Row | null;
        assert.equal(record?.id, transferId, 'getTransferRecord : ligne lue en base');
        const latest = (await TicketTransferService.getTransferByTicketId(ticketId)) as Row | null;
        assert.equal(latest?.id, transferId, 'getTransferByTicketId : dernier transfert lu en base');
        assert.equal(await TicketTransferService.isTicketLocked(ticketId), true, 'isTicketLocked : transfer_locked lu en base');

        // Un identifiant mal formé fait échouer la requête PostgREST (22P02) : l'erreur doit remonter.
        await assert.rejects(TicketTransferService.getTransferRecord('pas-un-uuid'), 'getTransferRecord : erreur de lecture avalée (null renvoyé)');
        await assert.rejects(TicketTransferService.getTransferByTicketId('pas-un-uuid'), 'getTransferByTicketId : erreur de lecture avalée (null renvoyé)');
        await assert.rejects(TicketTransferService.isTicketLocked('pas-un-uuid'), 'isTicketLocked : erreur de lecture avalée (false renvoyé)');
    });
});

// ── Cron ───────────────────────────────────────────────────────────────────

describe('C1 — cron ticket-transfers protégé par CRON_SECRET seul', () => {
    test('sans CRON_SECRET : la clé service_role ne déclenche pas le cron (refus), le transfert échu reste PENDING', async () => {
        const ticketId = tickets[10];
        const transferId = await overdueTransfer(ticketId);
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        assert.ok(serviceKey, 'précondition : SUPABASE_SERVICE_ROLE_KEY présente (.env.test)');
        const results = await withEnv({ CRON_SECRET: undefined }, async () => ({
            withServiceKey: await runCron(serviceKey!),
            withoutHeader: await runCron(null),
        }));
        assert.ok([401, 503].includes(results.withServiceKey.status), `clé service_role acceptée par le cron sans CRON_SECRET : ${show(results.withServiceKey)}`);
        assert.ok([401, 503].includes(results.withoutHeader.status), `cron sans CRON_SECRET ni en-tête : ${show(results.withoutHeader)}`);
        const row = (await transfersOf(ticketId)).find((t) => t.id === transferId)!;
        assert.equal(row.status, 'PENDING', `cron refusé : aucun effet attendu, transfert ${row.status}`);
        assert.equal(await lockOf(ticketId), true, 'billet toujours verrouillé');
    });

    test('garde-fou : CRON_SECRET présent → clé service_role refusée (401) ; bon secret → transfert échu EXPIRED, billet déverrouillé', async () => {
        const ticketId = tickets[11];
        const transferId = await overdueTransfer(ticketId);
        const refused = await runCron(process.env.SUPABASE_SERVICE_ROLE_KEY ?? null);
        assert.equal(refused.status, 401, `clé service_role présentée au cron : ${show(refused)}`);
        assert.ok(process.env.CRON_SECRET, 'précondition : CRON_SECRET présent (.env.test)');
        const ok = await runCron(process.env.CRON_SECRET!);
        assert.equal(ok.status, 200, `cron avec CRON_SECRET : ${show(ok)}`);
        const row = (await transfersOf(ticketId)).find((t) => t.id === transferId)!;
        assert.equal(row.status, 'EXPIRED', 'transfert échu → EXPIRED');
        assert.equal(await lockOf(ticketId), false, 'billet déverrouillé');
    });
});

// ── Cas portés du legacy (8.2 v) ───────────────────────────────────────────

describe('8.2 v — transferts : billet composté, route d’annulation, expiration (cas portés)', () => {
    let spare: string[] = [];

    before(async () => {
        spare = (await buyConfirmed(owner, ev, [['Standard', 4]])).tickets.map((t) => String(t.id));
        assert.equal(spare.length, 4, 'quatre billets de plus pour ces cas');
    });

    async function cancelByRoute(user: Buyer, transferId: string): Promise<RouteResult> {
        const { POST } = await importModule(CANCEL_ROUTE);
        return invoke(POST as Handler, authed(`/api/tickets/transfers/${transferId}/cancel`, 'POST', user), routeContext({ id: transferId }));
    }

    async function pendingTransfer(ticketId: string): Promise<string> {
        const res = await initiateByRoute(owner, ticketId, randomSenegalPhone('77'));
        assert.equal(res.status, 200, `initiation de préparation : ${show(res)}`);
        const [pending] = await pendingOf(ticketId);
        assert.ok(pending, 'préparation : transfert PENDING en base');
        return String(pending.id);
    }

    test('T5 : billet UTILISE → 400 TICKET_NOT_TRANSFERABLE, aucun transfert, aucun verrou', async () => {
        const door = await createTimedEvent(partner.partnerId, 'dette-transferts-entree', [{ name: 'Standard', price: 2000, total: 5 }], { startsInHours: 1 });
        const { tickets: bought } = await buyConfirmed(owner, door, [['Standard', 1]]);
        const ticketId = String(bought[0].id);
        const entry = await scan(partner, { eventId: door.eventId, payload: await ticketPayload(ticketId) });
        assert.equal(entry.body.result, 'valid', `compostage préalable : ${show(entry)}`);
        const res = await initiateByRoute(owner, ticketId, randomSenegalPhone('77'));
        assert.equal(res.status, 400, `billet composté : ${show(res)}`);
        assert.equal(res.body.code, 'TICKET_NOT_TRANSFERABLE', show(res));
        assert.match(String(res.body.error), /valide/i, `message explicite : ${show(res)}`);
        assert.deepEqual(await transfersOf(ticketId), [], 'aucun transfert écrit');
        assert.equal(await lockOf(ticketId), false, 'aucun verrou posé');
    });

    test('T11 : POST /api/tickets/transfers/[id]/cancel par l’émetteur → 200, CANCELLED, billet libre, porteur inchangé', async () => {
        const ticketId = spare[0];
        const transferId = await pendingTransfer(ticketId);
        const res = await cancelByRoute(owner, transferId);
        assert.equal(res.status, 200, `annulation par l’émetteur : ${show(res)}`);
        assert.equal(res.body.success, true, show(res));
        const row = (await transfersOf(ticketId)).find((t) => t.id === transferId)!;
        assert.equal(row.status, 'CANCELLED', 'transfert CANCELLED');
        assert.ok(row.cancelled_at, 'cancelled_at renseigné');
        assert.equal(await lockOf(ticketId), false, 'billet déverrouillé');
        assert.equal((await ticketRow(ticketId)).user_id, owner.userId, 'porteur inchangé');
    });

    test('T12 : la même route par un tiers → 403 NOT_SENDER, transfert toujours PENDING, billet toujours verrouillé', async () => {
        const ticketId = spare[1];
        const transferId = await pendingTransfer(ticketId);
        const res = await cancelByRoute(stranger, transferId);
        assert.equal(res.status, 403, `annulation par un tiers : ${show(res)}`);
        assert.equal(res.body.code, 'NOT_SENDER', show(res));
        assert.match(String(res.body.error), /émetteur/, `message explicite : ${show(res)}`);
        assert.deepEqual((await pendingOf(ticketId)).map((t) => t.id), [transferId], 'transfert toujours PENDING');
        assert.equal(await lockOf(ticketId), true, 'billet toujours verrouillé');
    });

    test('T15 : cron rejoué → le transfert expire une seule fois, sans second avis', async () => {
        const ticketId = spare[2];
        const transferId = await overdueTransfer(ticketId);
        const first = await runCron(process.env.CRON_SECRET!);
        assert.equal(first.status, 200, `premier passage : ${show(first)}`);
        assert.ok((first.body.transferIds as string[]).includes(transferId), `transfert expiré au premier passage : ${show(first)}`);
        const expired = (await transfersOf(ticketId)).find((t) => t.id === transferId)!;
        assert.equal(expired.status, 'EXPIRED', 'transfert EXPIRED');
        const notices = (await outboxRows({ type: 'TRANSFER_EXPIRED', keyPrefix: `TRANSFER_EXPIRED:${transferId}` })).map((r) => r.id).sort();
        assert.ok(notices.length > 0, 'avis d’expiration mis en file au premier passage');

        const second = await runCron(process.env.CRON_SECRET!);
        assert.equal(second.status, 200, `second passage : ${show(second)}`);
        assert.ok(!(second.body.transferIds as string[]).includes(transferId), `transfert traité deux fois : ${show(second)}`);
        const again = (await transfersOf(ticketId)).find((t) => t.id === transferId)!;
        assert.equal(again.expired_at, expired.expired_at, 'expired_at inchangé au second passage');
        assert.deepEqual((await outboxRows({ type: 'TRANSFER_EXPIRED', keyPrefix: `TRANSFER_EXPIRED:${transferId}` })).map((r) => r.id).sort(), notices, 'aucun second avis');
    });

    test('T16 : après expiration, nouveau transfert accepté sur le même billet, billet de nouveau verrouillé', async () => {
        const ticketId = spare[3];
        const expiredId = await overdueTransfer(ticketId);
        const cron = await runCron(process.env.CRON_SECRET!);
        assert.equal(cron.status, 200, `expiration : ${show(cron)}`);
        assert.equal(await lockOf(ticketId), false, 'précondition : billet déverrouillé par l’expiration');
        const res = await initiateByRoute(owner, ticketId, randomSenegalPhone('77'));
        assert.equal(res.status, 200, `nouveau transfert : ${show(res)}`);
        const pending = await pendingOf(ticketId);
        assert.equal(pending.length, 1, 'un transfert PENDING');
        assert.notEqual(pending[0].id, expiredId, 'un nouveau transfert, pas l’ancien');
        assert.equal(await lockOf(ticketId), true, 'billet de nouveau verrouillé');
    });
});
