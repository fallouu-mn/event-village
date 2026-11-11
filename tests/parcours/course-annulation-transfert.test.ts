/**
 * Lot 7, tâche 7.0 c — course entre l'annulation d'un événement (event_cancel) et l'acceptation d'un
 * transfert (ticket_transfer_accept), par des connexions pg locales tenues en transaction (contrat section
 * 4.3, D20, M3.4 à M3.6 ; écrivain W2). Aucune minuterie : chaque attente est constatée dans
 * pg_stat_activity (waitForLockWaiters), chaque issue est choisie par COMMIT explicite.
 *
 * Montage commun : partenaire, événement PUBLIE à J+2, expéditeur avec un billet payé (buyConfirmed),
 * transfert PENDING initié par la route POST /api/tickets/[id]/transfer vers le numéro vérifié d'un
 * destinataire (comme dette-annulation-transferts).
 *  1. A : BEGIN ; ticket_transfer_accept (sans COMMIT). B : event_cancel, bloqué (attente de verrou
 *     constatée). COMMIT de A ; B se termine. Le destinataire a sa ligne EVENT_CANCELLED de l'événement,
 *     l'expéditeur aucune ; aucune erreur 40P01.
 *  2. Ordre inverse : B tient event_cancel sans COMMIT, A attend ; après le COMMIT de B, A répond
 *     EVENT_NOT_ACTIVE ou TRANSFER_NOT_PENDING ; le porteur n'a pas changé ; aucune erreur 40P01.
 *  3. Course au milieu de event_cancel (trois connexions) : C tient les catégories de l'événement
 *     (FOR UPDATE) ; B lance event_cancel, qui s'arrête sur ce verrou après avoir verrouillé l'événement
 *     (FOR NO KEY UPDATE depuis le lot 8, tâche 8.2 b) ;
 *     A lance ticket_transfer_accept et attend à son tour ; C annule. Attendu : aucune erreur 40P01,
 *     B annule l'événement, A est refusé (EVENT_NOT_ACTIVE ou TRANSFER_NOT_PENDING), le billet reste à
 *     l'expéditeur, le transfert est CANCELLED, EVENT_CANCELLED part à l'expéditeur et pas au destinataire,
 *     aucun TRANSFER_RECEIVED.
 *  4. ticket_transfer_claim (lot 4, encore appelée par accept) et ticket_transfer_accept appelées
 *     directement sur un événement ANNULE puis SUSPENDU (transaction annulée, triggers de events désactivés
 *     le temps de la transaction, transfert PENDING réel) → EVENT_NOT_ACTIVE ; témoin dans la même
 *     transaction : sur l'événement PUBLIE, les deux réussissent.
 *
 * État avant correctif (fix(7.0c), migration 20261105000003) :
 *  - 1 et 2 : verts dès l'écriture (SUPPOSÉ par lecture, couverture ajoutée). Pour 1, l'acceptation insère
 *    ses avis dans notification_outbox, dont la clé étrangère event_id pose FOR KEY SHARE sur la ligne de
 *    l'événement (20261103000002_lot6_outbox.sql:166) : event_cancel attend déjà à son FOR UPDATE de events
 *    (20261103000005_lot6_billetterie.sql:1094 ; depuis le lot 8, FOR NO KEY UPDATE, en conflit avec le FOR SHARE
 *    de l'acceptation) et lit les porteurs après le COMMIT de A. Le scénario du
 *    contrat ne peut donc pas être rouge aujourd'hui ; il reste le garde-fou de la correction ;
 *  - 3 : ROUGE. B tient l'événement (FOR UPDATE, FOR NO KEY UPDATE depuis le lot 8) quand A verrouille le
 *    transfert et le billet ; A attend
 *    alors l'événement à sa mise en file (clé étrangère), B attend le transfert à son UPDATE des transferts
 *    (:1147-1149) : interblocage, une des deux transactions est annulée en 40P01. C'est la course réelle
 *    de la consigne ; le correctif (A verrouille l'événement FOR SHARE avant le transfert, event_cancel
 *    verrouille transferts puis billets avant de lire les porteurs) la supprime ;
 *  - 4 : ROUGE. ticket_transfer_claim (20261101000010_lot4_scan.sql:254-283) et ticket_transfer_accept
 *    (:354-447) ne lisent pas le statut de l'événement : la réclamation réussit sur un événement annulé ;
 *  - fin de suite : assertTerrainInvariants échoue tant que le schéma du lot 7 manque (M4, M5).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import type { Client } from 'pg';
import { inRolledBackTransaction } from '../helpers/db';
import { markPhoneVerified } from './notif-helpers';
import { importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, ticketRow, type RouteResult } from './acces-helpers';
import { confirmPassword, STRONG_PASSWORD } from './helpers';
import { assertTerrainInvariants, openConcurrentClient, waitForLockWaiters, type ConcurrentClient } from './terrain-helpers';

const TRANSFER_ROUTE = '../../app/api/tickets/[id]/transfer/route';
const PUBLIC_NOTICE = 'Événement annulé par l’organisateur : vos billets sont remboursés.';
const INTERNAL_REASON = 'Course annulation et transfert (lot 7)';
const REFUSALS = ['EVENT_NOT_ACTIVE', 'TRANSFER_NOT_PENDING'];

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

let partner: TestPartner;

before(async () => {
    partner = await newPartner('course-transfert');
});

after(async () => {
    await assertTerrainInvariants('course-annulation-transfert');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

async function invoke(handler: Handler, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Row = {};
    if (text) {
        try {
            body = JSON.parse(text) as Row;
        } catch (err) {
            body = { raw: text.slice(0, 2000), parseError: (err as Error).message };
        }
    }
    return { status: res.status, body };
}

/** Contexte de route valable que le gestionnaire lise `params.id` ou `await params`. */
function paramsContext(id: string): { params: Promise<{ id: string }> & { id: string } } {
    return { params: Object.assign(Promise.resolve({ id }), { id }) };
}

interface PendingSetup {
    ev: SaleEvent;
    title: string;
    ticketId: string;
    transferId: string;
    sender: Buyer;
    recipient: Buyer;
}

/** Événement PUBLIE à J+2, un billet payé de l'expéditeur, transfert PENDING par la route vers le numéro vérifié du destinataire. */
async function pendingTransfer(label: string): Promise<PendingSetup> {
    const sender = await newBuyer(`course-exp-${label}`, { firstName: 'Aminata', lastName: 'Expeditrice' });
    const recipient = await newBuyer(`course-dest-${label}`, { firstName: 'Mariama', lastName: 'Destinataire' });
    await markPhoneVerified(recipient.userId);
    const ev = await createTimedEvent(partner.partnerId, `course ${label}`, [{ name: 'Standard', price: 2000, total: 20, maxPerOrder: 10 }], { startsInHours: 48 });
    const { data: evRow, error: evErr } = await service.from('events').select('title, status').eq('id', ev.eventId).single();
    assert.equal(evErr, null, `événement ${ev.eventId} : ${evErr?.message}`);
    assert.equal(evRow.status, 'PUBLIE', 'précondition : événement PUBLIE');
    const purchase = await buyConfirmed(sender, ev, [['Standard', 1]]);
    assert.equal(purchase.tickets.length, 1, 'précondition : un billet émis');
    const ticketId = String(purchase.tickets[0].id);
    const { POST } = await importModule(TRANSFER_ROUTE);
    await confirmPassword(sender, STRONG_PASSWORD); // lot 9 bis (R57, T34) : mot de passe confirmé avant le transfert
    const res = await invoke(POST as Handler, authed(`/api/tickets/${ticketId}/transfer`, 'POST', sender, { recipient: recipient.phoneE164 }), paramsContext(ticketId));
    assert.equal(res.status, 200, `initiation du transfert : HTTP ${res.status} ${JSON.stringify(res.body)}`);
    const { data: transfers, error: tErr } = await service.from('ticket_transfers').select('id, status').eq('ticket_id', ticketId).eq('status', 'PENDING');
    assert.equal(tErr, null, `transfert : ${tErr?.message}`);
    assert.equal((transfers ?? []).length, 1, `précondition : un transfert PENDING (${JSON.stringify(transfers)})`);
    return { ev, title: String(evRow.title), ticketId, transferId: String(transfers![0].id), sender, recipient };
}

const ACCEPT_SQL = 'SELECT public.ticket_transfer_accept($1::jsonb) AS r';
const CANCEL_SQL = 'SELECT public.event_cancel($1::jsonb) AS r';

function acceptArgs(s: PendingSetup): unknown[] {
    return [JSON.stringify({ transfer_id: s.transferId, actor_id: s.recipient.userId })];
}

function cancelArgs(s: PendingSetup): unknown[] {
    return [JSON.stringify({
        event_id: s.ev.eventId, actor_id: partner.userId,
        public_notice: PUBLIC_NOTICE, internal_reason: INTERNAL_REASON, confirm_title: s.title,
    })];
}

/** Issue d'une requête lancée sans être attendue : corps jsonb de la RPC, ou erreur pg (code SQLSTATE). */
type Outcome = { ok: true; r: Row } | { ok: false; code: string; message: string };

function settle(p: Promise<{ rows: Array<{ r: Row }> }>): Promise<Outcome> {
    return p.then(
        (res): Outcome => ({ ok: true, r: res.rows[0].r }),
        (err: unknown): Outcome => ({ ok: false, code: String((err as { code?: string }).code ?? ''), message: String((err as Error).message ?? err) }),
    );
}

function describeOutcome(o: Outcome): string {
    return o.ok ? JSON.stringify(o.r) : `erreur ${o.code} ${o.message}`;
}

/** Valide la transaction si la requête a réussi, l'annule sinon (transaction abandonnée). */
async function finish(client: ConcurrentClient, o: Outcome): Promise<void> {
    if (o.ok) await client.commit();
    else await client.rollback();
}

function assertNoDeadlock(outcomes: Array<[string, Outcome]>): void {
    const deadlocks = outcomes.filter(([, o]) => !o.ok && o.code === '40P01').map(([who, o]) => `${who} : ${describeOutcome(o)}`);
    assert.deepEqual(deadlocks, [], `interblocage (40P01) entre event_cancel et ticket_transfer_accept :\n${deadlocks.join('\n')}`);
}

async function outboxKeys(groupKey: string): Promise<string[]> {
    const { data, error } = await service.from('notification_outbox').select('idempotency_key').eq('group_key', groupKey);
    assert.equal(error, null, `boîte d'envoi ${groupKey} : ${error?.message}`);
    return (data ?? []).map((r) => String(r.idempotency_key)).sort();
}

async function transferStatus(id: string): Promise<string> {
    const { data, error } = await service.from('ticket_transfers').select('status').eq('id', id).single();
    assert.equal(error, null, `transfert ${id} : ${error?.message}`);
    return String(data.status);
}

async function eventStatusOf(id: string): Promise<string> {
    const { data, error } = await service.from('events').select('status').eq('id', id).single();
    assert.equal(error, null, `événement ${id} : ${error?.message}`);
    return String(data.status);
}

// ── Scénarios ──────────────────────────────────────────────────────────────

describe('7.0 c — course event_cancel / ticket_transfer_accept (deux et trois connexions)', () => {
    test('1. A accepte sans COMMIT, B annule et attend ; après le COMMIT de A, le destinataire reçoit EVENT_CANCELLED, l’expéditeur non', async () => {
        const s = await pendingTransfer('accepte-dabord');
        const a = await openConcurrentClient({ applicationName: 'ev-test-course-accept' });
        const b = await openConcurrentClient({ applicationName: 'ev-test-course-cancel' });
        try {
            const aOut = await settle(a.query<{ r: Row }>(ACCEPT_SQL, acceptArgs(s)));
            assert.ok(aOut.ok && aOut.r.ok === true, `précondition : acceptation par A : ${describeOutcome(aOut)}`);
            const bPending = settle(b.query<{ r: Row }>(CANCEL_SQL, cancelArgs(s)));
            await waitForLockWaiters([b.pid]);
            await a.commit();
            const bOut = await bPending;
            await finish(b, bOut);
            assertNoDeadlock([['A (acceptation)', aOut], ['B (annulation)', bOut]]);
            assert.ok(bOut.ok && bOut.r.ok === true, `annulation par B : ${describeOutcome(bOut)}`);

            assert.equal(await eventStatusOf(s.ev.eventId), 'ANNULE', 'événement annulé');
            assert.equal(await transferStatus(s.transferId), 'CLAIMED', 'transfert réclamé avant l’annulation');
            assert.equal((await ticketRow(s.ticketId)).user_id, s.recipient.userId, 'billet au destinataire');
            const toRecipient = await outboxKeys(`EVENT_CANCELLED:${s.ev.eventId}:${s.recipient.userId}`);
            assert.ok(toRecipient.length > 0, 'le destinataire, porteur au moment de l’annulation, doit recevoir EVENT_CANCELLED');
            assert.deepEqual(await outboxKeys(`EVENT_CANCELLED:${s.ev.eventId}:${s.sender.userId}`), [],
                'l’expéditeur, qui n’a plus de billet de l’événement, ne doit pas recevoir EVENT_CANCELLED');
        } finally {
            await a.close();
            await b.close();
        }
    });

    test('2. ordre inverse : B tient event_cancel sans COMMIT, A attend ; après le COMMIT de B, A est refusé et le porteur ne change pas', async () => {
        const s = await pendingTransfer('annule-dabord');
        const a = await openConcurrentClient({ applicationName: 'ev-test-course-accept' });
        const b = await openConcurrentClient({ applicationName: 'ev-test-course-cancel' });
        try {
            const bOut = await settle(b.query<{ r: Row }>(CANCEL_SQL, cancelArgs(s)));
            assert.ok(bOut.ok && bOut.r.ok === true, `précondition : annulation par B : ${describeOutcome(bOut)}`);
            const aPending = settle(a.query<{ r: Row }>(ACCEPT_SQL, acceptArgs(s)));
            await waitForLockWaiters([a.pid]);
            await b.commit();
            const aOut = await aPending;
            await finish(a, aOut);
            assertNoDeadlock([['A (acceptation)', aOut], ['B (annulation)', bOut]]);
            assert.ok(aOut.ok, `acceptation par A : ${describeOutcome(aOut)}`);
            assert.equal(aOut.r.ok, false, `A ne doit pas réclamer un billet d’un événement annulé : ${describeOutcome(aOut)}`);
            assert.ok(REFUSALS.includes(String(aOut.r.code)), `code de refus ${REFUSALS.join(' ou ')} attendu : ${describeOutcome(aOut)}`);

            assert.equal(await eventStatusOf(s.ev.eventId), 'ANNULE', 'événement annulé');
            assert.equal(await transferStatus(s.transferId), 'CANCELLED', 'transfert révoqué par l’annulation');
            assert.equal((await ticketRow(s.ticketId)).user_id, s.sender.userId, 'porteur inchangé');
            assert.deepEqual(await outboxKeys(`TRANSFER_RECEIVED:${s.transferId}`), [], 'aucun avis TRANSFER_RECEIVED pour un transfert révoqué');
        } finally {
            await a.close();
            await b.close();
        }
    });

    test('3. course au milieu de event_cancel (C tient les catégories, B annule, A accepte) : aucun interblocage, A refusé, billet à l’expéditeur', async () => {
        const s = await pendingTransfer('milieu');
        const c = await openConcurrentClient({ applicationName: 'ev-test-course-barriere' });
        const b = await openConcurrentClient({ applicationName: 'ev-test-course-cancel' });
        const a = await openConcurrentClient({ applicationName: 'ev-test-course-accept' });
        try {
            const held = await c.query('SELECT id FROM public.ticket_categories WHERE event_id = $1 ORDER BY id FOR UPDATE', [s.ev.eventId]);
            assert.ok(held.rows.length > 0, 'précondition : catégories de l’événement verrouillées par C');
            const bPending = settle(b.query<{ r: Row }>(CANCEL_SQL, cancelArgs(s)));
            // B a verrouillé l'événement (FOR NO KEY UPDATE depuis le lot 8) et attend les catégories tenues par C
            await waitForLockWaiters([b.pid]);
            const aPending = settle(a.query<{ r: Row }>(ACCEPT_SQL, acceptArgs(s)));
            // A attend la ligne de l'événement tenue par B (avant le correctif : à sa mise en file, après avoir verrouillé transfert et billet)
            await waitForLockWaiters([a.pid]);
            await c.rollback();

            const bOut = await bPending;
            await finish(b, bOut);
            const aOut = await aPending;
            await finish(a, aOut);
            assertNoDeadlock([['A (acceptation)', aOut], ['B (annulation)', bOut]]);
            assert.ok(bOut.ok && bOut.r.ok === true, `annulation par B : ${describeOutcome(bOut)}`);
            assert.ok(aOut.ok, `acceptation par A : ${describeOutcome(aOut)}`);
            assert.equal(aOut.r.ok, false, `A ne doit pas réclamer un billet pendant l’annulation : ${describeOutcome(aOut)}`);
            assert.ok(REFUSALS.includes(String(aOut.r.code)), `code de refus ${REFUSALS.join(' ou ')} attendu : ${describeOutcome(aOut)}`);

            assert.equal(await eventStatusOf(s.ev.eventId), 'ANNULE', 'événement annulé');
            assert.equal(await transferStatus(s.transferId), 'CANCELLED', 'transfert révoqué par l’annulation');
            assert.equal((await ticketRow(s.ticketId)).user_id, s.sender.userId, 'billet resté à l’expéditeur');
            assert.ok((await outboxKeys(`EVENT_CANCELLED:${s.ev.eventId}:${s.sender.userId}`)).length > 0, 'EVENT_CANCELLED à l’expéditeur, porteur du billet');
            assert.deepEqual(await outboxKeys(`EVENT_CANCELLED:${s.ev.eventId}:${s.recipient.userId}`), [], 'aucun EVENT_CANCELLED au destinataire, qui n’a jamais détenu le billet');
            assert.deepEqual(await outboxKeys(`TRANSFER_RECEIVED:${s.transferId}`), [], 'aucun avis TRANSFER_RECEIVED pour un événement annulé');
        } finally {
            await a.close();
            await b.close();
            await c.close();
        }
    });
});

describe('7.0 c — ticket_transfer_claim et ticket_transfer_accept contrôlent le statut de l’événement (D20)', () => {
    test('4. événement ANNULE puis SUSPENDU (transaction annulée) → EVENT_NOT_ACTIVE ; témoin PUBLIE → réclamation réussie', async () => {
        const s = await pendingTransfer('claim-direct');
        const claim = (db: Client) => db.query<{ r: Row }>('SELECT public.ticket_transfer_claim($1::uuid, $2::uuid) AS r', [s.transferId, s.recipient.userId]).then((res) => res.rows[0].r);
        const accept = (db: Client) => db.query<{ r: Row }>(ACCEPT_SQL, acceptArgs(s)).then((res) => res.rows[0].r);
        const seen = await inRolledBackTransaction(async (db) => {
            const out: Record<string, { r: Row; owner: string }> = {};
            const ownerNow = async (): Promise<string> =>
                String((await db.query<{ user_id: string }>('SELECT user_id FROM public.tickets WHERE id = $1', [s.ticketId])).rows[0].user_id);
            const attempt = async (label: string, fn: (db: Client) => Promise<Row>): Promise<void> => {
                await db.query('SAVEPOINT essai');
                const r = await fn(db);
                out[label] = { r, owner: await ownerNow() };
                await db.query('ROLLBACK TO SAVEPOINT essai');
            };
            await attempt('claim PUBLIE', claim);
            await attempt('accept PUBLIE', accept);
            await db.query('ALTER TABLE public.events DISABLE TRIGGER USER');
            for (const status of ['ANNULE', 'SUSPENDU']) {
                const upd = await db.query('UPDATE public.events SET status = $2 WHERE id = $1', [s.ev.eventId, status]);
                assert.equal(upd.rowCount, 1, `événement passé ${status} dans la transaction`);
                await attempt(`claim ${status}`, claim);
                await attempt(`accept ${status}`, accept);
            }
            return out;
        });

        for (const label of ['claim PUBLIE', 'accept PUBLIE']) {
            assert.equal(seen[label].r.ok, true, `témoin ${label} : ${JSON.stringify(seen[label].r)}`);
            assert.equal(seen[label].owner, s.recipient.userId, `témoin ${label} : billet au destinataire dans la transaction`);
        }
        for (const status of ['ANNULE', 'SUSPENDU']) {
            for (const fn of ['claim', 'accept']) {
                const { r, owner } = seen[`${fn} ${status}`];
                assert.equal(r.ok, false, `${fn === 'claim' ? 'ticket_transfer_claim' : 'ticket_transfer_accept'} sur un événement ${status} : ${JSON.stringify(r)}`);
                assert.equal(r.code, 'EVENT_NOT_ACTIVE', `${fn} ${status} : code EVENT_NOT_ACTIVE attendu, reçu ${JSON.stringify(r)}`);
                assert.equal(owner, s.sender.userId, `${fn} ${status} : porteur inchangé`);
            }
        }
        assert.equal(await transferStatus(s.transferId), 'PENDING', 'après ROLLBACK : transfert toujours PENDING');
        assert.equal(await eventStatusOf(s.ev.eventId), 'PUBLIE', 'après ROLLBACK : événement PUBLIE');
    });
});
