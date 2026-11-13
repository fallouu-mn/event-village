/**
 * Lot 9, tâche 9.0 — concurrence des invitations (contrat 3.3, 5.1, L9 ; découverte 9-invitations, 3.3, 4.1).
 * Connexions pg locales tenues en transaction, modèle course-annulation-transfert.test.ts : aucune minuterie, chaque
 * attente est constatée dans pg_stat_activity (waitForLockWaiters), chaque issue est choisie par COMMIT explicite.
 *  1. Deux envois simultanés dépassant le stock, trois connexions : C tient la catégorie, A puis B attendent, C
 *     annule ; A passe ; après son COMMIT, B est refusé SALE_CHECK_FAILED, INSUFFICIENT_STOCK : stock exact, aucun
 *     billet, transfert ni SMS pour B.
 *  2. Témoin : deux envois simultanés qui tiennent exactement dans le stock passent tous les deux.
 *  3. Annulation contre réclamation, annulation d'abord : la réclamation attend, puis TRANSFER_NOT_PENDING.
 *  4. Annulation contre réclamation, réclamation d'abord : l'annulation attend, puis annule le billet réclamé.
 * Aucun 40P01 dans aucun cas ; égalité exacte vendus = billets actifs (contrat 6.4).
 *
 * Rouge avant correctif : les RPC ticket_invitation_create et ticket_invitation_cancel n'existent pas (M2) : chaque cas
 * échoue en nommant la fonction absente, avant toute connexion ; after() : assertLot9Invariants nomme le schéma manquant.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect, openConcurrentClient, waitForLockWaiters, type ConcurrentClient } from '../helpers/db';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { randomSenegalPhone } from './helpers';
import { categoryState, eventTickets, newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent, ticketRow } from './acces-helpers';
import { markPhoneVerified, outboxRows } from './notif-helpers';

type Row = Record<string, unknown>;

const STANDARD = 'Standard';
const LIMITS = { per_event_hour: 50, per_phone_day: 3 };
const CREATE_SQL = 'SELECT public.ticket_invitation_create($1::jsonb) AS r';
const CANCEL_SQL = 'SELECT public.ticket_invitation_cancel($1::jsonb) AS r';
const ACCEPT_SQL = 'SELECT public.ticket_transfer_accept($1::jsonb) AS r';

let partner: TestPartner;

before(async () => {
    partner = await newPartner('invitations-course');
});

after(async () => {
    await assertLot9Invariants('invitations-course');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

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

async function finish(client: ConcurrentClient, o: Outcome): Promise<void> {
    if (o.ok) await client.commit();
    else await client.rollback();
}

function assertNoDeadlock(outcomes: Array<[string, Outcome]>): void {
    const deadlocks = outcomes.filter(([, o]) => !o.ok && o.code === '40P01').map(([who, o]) => `${who} : ${describeOutcome(o)}`);
    assert.deepEqual(deadlocks, [], `interblocage (40P01) :\n${deadlocks.join('\n')}`);
}

function assertRpcOk(who: string, o: Outcome): Row {
    assert.ok(o.ok, `${who} : ${describeOutcome(o)}`);
    assert.equal(o.r.ok, true, `${who} : ${describeOutcome(o)}`);
    return o.r;
}

/** Les RPC du contrat existent : sinon une attente de verrou échouerait sans dire ce qui manque. */
async function assertRpcsExist(): Promise<void> {
    const missing = await inspect(async (db) => {
        const out: string[] = [];
        for (const fn of ['ticket_invitation_create(jsonb)', 'ticket_invitation_cancel(jsonb)']) {
            const { rows } = await db.query<{ reg: string | null }>('SELECT to_regprocedure($1)::text AS reg', [`public.${fn}`]);
            if (!rows[0].reg) out.push(fn);
        }
        return out;
    });
    assert.deepEqual(missing, [], `RPC absentes (migration M2, contrat 5.1) : ${missing.join(', ')}`);
}

function newEvent(label: string, total: number): Promise<SaleEvent> {
    const categories: CategorySpec[] = [{ name: STANDARD, price: 5_000, total, maxPerOrder: 10 }];
    return createTimedEvent(partner.partnerId, `course ${label}`, categories, { startsInHours: 48 });
}

function createArgs(ev: SaleEvent, phone: string, quantity: number): unknown[] {
    return [JSON.stringify({ actor_id: partner.userId, event_id: ev.eventId, category_id: ev.categories[STANDARD].id, phones: [phone], quantity, limits: LIMITS })];
}

interface Pending { ticketId: string; transferId: string; invitee: Buyer }

/** Invitation en attente pour un compte au numéro non vérifié (AR15), puis numéro vérifié : réclamable. */
async function pendingInvitation(ev: SaleEvent, label: string): Promise<Pending> {
    const invitee = await newBuyer(`course-${label}`, { firstName: 'Mariama', lastName: 'Invitee', phoneVerified: false });
    const { data, error } = await service.rpc('ticket_invitation_create', {
        p: { actor_id: partner.userId, event_id: ev.eventId, category_id: ev.categories[STANDARD].id, phones: [invitee.phoneE164], quantity: 1, limits: LIMITS },
    });
    assert.equal(error, null, `ticket_invitation_create : ${error?.message}`);
    assert.equal((data as Row).ok, true, `précondition : invitation créée : ${JSON.stringify(data)}`);
    await markPhoneVerified(invitee.userId);
    const { data: rows, error: tErr } = await service.from('ticket_transfers').select('id, ticket_id').eq('to_phone_or_email', invitee.phoneE164).eq('status', 'PENDING');
    assert.equal(tErr, null, `transfert : ${tErr?.message}`);
    assert.equal((rows ?? []).length, 1, `précondition : un transfert PENDING (${JSON.stringify(rows)})`);
    return { ticketId: String(rows![0].ticket_id), transferId: String(rows![0].id), invitee };
}

function cancelArgs(ev: SaleEvent, s: Pending): unknown[] {
    return [JSON.stringify({ actor_id: partner.userId, event_id: ev.eventId, ticket_id: s.ticketId })];
}

function acceptArgs(s: Pending): unknown[] {
    return [JSON.stringify({ transfer_id: s.transferId, actor_id: s.invitee.userId })];
}

async function invitationCount(ev: SaleEvent): Promise<number> {
    return (await eventTickets(ev.eventId)).filter((t) => t.sale_channel === 'INVITATION').length;
}

/** Égalité exacte du contrat 6.4 : vendus = billets actifs, réservé à 0. */
async function assertStockExact(ev: SaleEvent, expected: number, what: string): Promise<void> {
    const state = await categoryState(ev.categories[STANDARD].id);
    assert.equal(state.sold, expected, `${what} : vendus`);
    assert.equal(state.held, 0, `${what} : réservé`);
    const active = (await eventTickets(ev.eventId)).filter((t) => ['VALIDE', 'UTILISE'].includes(String(t.status)));
    assert.equal(active.length, expected, `${what} : billets actifs = vendus`);
}

async function transferStatus(id: string): Promise<string> {
    const { data, error } = await service.from('ticket_transfers').select('status').eq('id', id).single();
    assert.equal(error, null, `transfert ${id} : ${error?.message}`);
    return String(data.status);
}

async function closeAll(...clients: ConcurrentClient[]): Promise<void> {
    for (const c of clients) await c.close();
}

/** C tient la catégorie, A puis B attendent derrière elle, C annule ; A passe, COMMIT, puis B rend son issue. */
async function raceSends(ev: SaleEvent, a0: unknown[], b0: unknown[]): Promise<{ aOut: Outcome; bOut: Outcome }> {
    const c = await openConcurrentClient({ applicationName: 'ev-test-invitation-barriere' });
    const a = await openConcurrentClient({ applicationName: 'ev-test-invitation-a' });
    const b = await openConcurrentClient({ applicationName: 'ev-test-invitation-b' });
    try {
        const held = await c.query('SELECT id FROM public.ticket_categories WHERE id = $1 FOR UPDATE', [ev.categories[STANDARD].id]);
        assert.equal(held.rows.length, 1, 'précondition : catégorie verrouillée par C');
        const aPending = settle(a.query<{ r: Row }>(CREATE_SQL, a0));
        await waitForLockWaiters([a.pid]);
        const bPending = settle(b.query<{ r: Row }>(CREATE_SQL, b0));
        await waitForLockWaiters([b.pid]);
        await c.rollback();
        const aOut = await aPending;
        await finish(a, aOut);
        const bOut = await bPending;
        await finish(b, bOut);
        assertNoDeadlock([['A', aOut], ['B', bOut]]);
        return { aOut, bOut };
    } finally {
        await closeAll(a, b, c);
    }
}

// ── Envois simultanés ──────────────────────────────────────────────────────

describe('9.0 Course : deux envois simultanés (trois connexions)', () => {
    test('1. dépassement du stock : un seul envoi passe, stock exact, rien pour le perdant', async () => {
        await assertRpcsExist();
        const ev = await newEvent('depassement', 4);
        const [phoneA, phoneB] = [randomSenegalPhone('76'), randomSenegalPhone('76')];
        const { aOut, bOut } = await raceSends(ev, createArgs(ev, phoneA, 3), createArgs(ev, phoneB, 3));

        assert.equal(assertRpcOk('A', aOut).ticket_count, 3, describeOutcome(aOut));
        assert.ok(bOut.ok, `B : ${describeOutcome(bOut)}`);
        assert.equal(bOut.r.ok, false, `B doit être refusé : ${describeOutcome(bOut)}`);
        assert.equal(bOut.r.code, 'SALE_CHECK_FAILED', describeOutcome(bOut));
        assert.deepEqual(((bOut.r.problems ?? []) as Row[]).map((p) => p.code), ['INSUFFICIENT_STOCK'], describeOutcome(bOut));

        await assertStockExact(ev, 3, 'après la course');
        assert.equal(await invitationCount(ev), 3, 'les seuls billets du gagnant');
        const { data, error } = await service.from('ticket_transfers').select('id').eq('to_phone_or_email', phoneB);
        assert.equal(error, null, `transferts : ${error?.message}`);
        assert.deepEqual(data ?? [], [], 'aucun transfert pour le perdant');
        assert.equal((await outboxRows({ type: 'INVITATION_RECEIVED', phone: phoneA })).length, 1, 'un SMS au gagnant');
        assert.deepEqual(await outboxRows({ type: 'INVITATION_RECEIVED', phone: phoneB }), [], 'aucun SMS au perdant');
    });

    test('2. témoin : deux envois qui tiennent exactement dans le stock passent, stock exact', async () => {
        await assertRpcsExist();
        const ev = await newEvent('exact', 4);
        const { aOut, bOut } = await raceSends(ev, createArgs(ev, randomSenegalPhone('76'), 2), createArgs(ev, randomSenegalPhone('76'), 2));
        assertRpcOk('A', aOut);
        assertRpcOk('B', bOut);
        await assertStockExact(ev, 4, 'stock plein');
        assert.equal(await invitationCount(ev), 4, 'quatre billets');
    });
});

// ── Annulation contre réclamation ──────────────────────────────────────────

describe('9.0 Course : annulation contre réclamation (deux connexions)', () => {
    test('3. annulation d’abord : la réclamation attend, puis TRANSFER_NOT_PENDING ; billet annulé, sans porteur, stock rendu', async () => {
        await assertRpcsExist();
        const ev = await newEvent('annule-dabord', 10);
        const s = await pendingInvitation(ev, 'annule');
        const a = await openConcurrentClient({ applicationName: 'ev-test-invitation-annule' });
        const b = await openConcurrentClient({ applicationName: 'ev-test-invitation-accepte' });
        let aOut: Outcome;
        let bOut: Outcome;
        try {
            aOut = await settle(a.query<{ r: Row }>(CANCEL_SQL, cancelArgs(ev, s)));
            assertRpcOk('A (annulation)', aOut);
            const bPending = settle(b.query<{ r: Row }>(ACCEPT_SQL, acceptArgs(s)));
            await waitForLockWaiters([b.pid]);
            await a.commit();
            bOut = await bPending;
            await finish(b, bOut);
        } finally {
            await closeAll(a, b);
        }
        assertNoDeadlock([['A (annulation)', aOut], ['B (réclamation)', bOut]]);
        assert.ok(bOut.ok, describeOutcome(bOut));
        assert.equal(bOut.r.ok, false, `réclamation d’une invitation annulée : ${describeOutcome(bOut)}`);
        assert.equal(bOut.r.code, 'TRANSFER_NOT_PENDING', describeOutcome(bOut));

        const ticket = await ticketRow(s.ticketId);
        assert.equal(ticket.status, 'ANNULE', 'billet annulé');
        assert.equal(ticket.user_id, null, 'aucun porteur');
        assert.equal(ticket.transfer_locked, false, 'billet déverrouillé');
        assert.equal(await transferStatus(s.transferId), 'CANCELLED', 'transfert annulé');
        await assertStockExact(ev, 0, 'stock rendu');
        assert.deepEqual(await outboxRows({ type: 'TRANSFER_RECEIVED', eventId: ev.eventId }), [], 'aucun avis de réception');
    });

    test('4. réclamation d’abord : l’annulation attend, puis annule le billet réclamé ; transfert CLAIMED, stock rendu', async () => {
        await assertRpcsExist();
        const ev = await newEvent('reclame-dabord', 10);
        const s = await pendingInvitation(ev, 'reclame');
        const a = await openConcurrentClient({ applicationName: 'ev-test-invitation-accepte' });
        const b = await openConcurrentClient({ applicationName: 'ev-test-invitation-annule' });
        let aOut: Outcome;
        let bOut: Outcome;
        try {
            aOut = await settle(a.query<{ r: Row }>(ACCEPT_SQL, acceptArgs(s)));
            assertRpcOk('A (réclamation)', aOut);
            const bPending = settle(b.query<{ r: Row }>(CANCEL_SQL, cancelArgs(ev, s)));
            await waitForLockWaiters([b.pid]);
            await a.commit();
            bOut = await bPending;
            await finish(b, bOut);
        } finally {
            await closeAll(a, b);
        }
        assertNoDeadlock([['A (réclamation)', aOut], ['B (annulation)', bOut]]);
        assertRpcOk('B (annulation)', bOut);

        const ticket = await ticketRow(s.ticketId);
        assert.equal(ticket.status, 'ANNULE', 'billet annulé');
        assert.equal(ticket.user_id, s.invitee.userId, 'porteur conservé');
        assert.equal(await transferStatus(s.transferId), 'CLAIMED', 'transfert réclamé');
        await assertStockExact(ev, 0, 'stock rendu');
    });
});
