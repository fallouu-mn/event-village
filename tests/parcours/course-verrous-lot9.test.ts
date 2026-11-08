/**
 * Lot 9, tâche 9.3, PO3 et PO4 (contrat 3.3, 5.4, AR4, D-sec 10 et 11) — ordre unique des verrous : ticket_refund_request
 * (catégorie avant billet, FOR NO KEY UPDATE) ; event_update et ticket_category_guard (events en FOR NO KEY UPDATE).
 * Connexions pg locales tenues en transaction, modèle course-confirmation-annulation.test.ts : aucune minuterie, chaque
 * attente est constatée, chaque issue est choisie par un COMMIT explicite, mêmes étapes avant et après le correctif.
 *
 * PO3 (billet sans paiement : gratuit, bientôt invitation) :
 *  1. Vrai cycle : C tient le billet ; A lance ticket_refund_request, attend ; B lance event_cancel, attend ; C annule.
 *     Avant : A obtient le billet et veut la catégorie tenue par B, B veut le billet : 40P01. Après : A tient catégorie
 *     et billet, annule le billet, B aboutit ; sold_quantity juste.
 *  2. Garde-fou contre le mauvais remède (`FOR UPDATE` sur la catégorie avant le billet, qui crée un cycle avec
 *     ticket_scan : billet tenu, FOR KEY SHARE de ticket_scans.category_id) : C tient la catégorie ; A rembourse, attend ;
 *     S scanne, attend ; C annule. Aucun 40P01, issue cohérente. L'ordre diffère : avant, A tient le billet et passe la
 *     première ; après, S passe la première et A refuse TICKET_NOT_REFUNDABLE. Les deux issues sont admises.
 *  3. Témoin : billet payé, le paiement sérialise A et B, aucun cycle.
 *  4. Statique : pg_get_functiondef, paiement, puis catégorie en FOR NO KEY UPDATE, puis billet ; plus aucun FOR UPDATE
 *     sur ticket_categories.
 *
 * PO4 (A tient une catégorie et prend FOR KEY SHARE sur events par la clé étrangère de payments ; B tient events) :
 *  1. Cycle event_update : deux catégories ; C tient la plus petite ; B (event_update) tient events et s'arrête sur
 *     elle ; A (checkout) prend l'autre, puis la clé étrangère. Avant : A attend events, C annule, B veut la catégorie de
 *     A : 40P01. Après : A n'attend plus events (blockedOrDone), COMMIT, B aboutit.
 *  2. Même cycle par ticket_category_update (ticket_category_guard).
 *  3. Témoin D20 : ticket_transfer_accept (events FOR SHARE) attend tant que event_update tient events.
 *  4. Statique : FOR NO KEY UPDATE sur events dans les deux fonctions, plus aucun FOR UPDATE sur events.
 *
 * Rouge avant correctif (fix(9.3-PO3), fix(9.3-PO4)) : PO3 1 et PO4 1, 2 : 40P01 sur A ou sur B, lu dans l'assertion
 * assertNoDeadlock au run « avant » (deadlock_timeout d'une seconde) ; statiques 4 ; after() : assertLot9Invariants,
 * rouge jusqu'à M2 et M4.
 * Verts dès l'écriture (signalés) : PO3 2 (garde-fou : il serait rouge si un FOR UPDATE reprenait la place du NKU), PO3 3,
 * PO4 3 (D20, témoin).
 * Non exécuté sur Supabase local (pas de Docker sur ce poste) : le 40P01 se lira au run « avant » en CI.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { POST as transferRoute } from '../../app/api/tickets/[id]/transfer/route';
import { inspect } from '../helpers/db';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { authed, createTimedEvent, newController, ticketRow } from './acces-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { markPhoneVerified } from './notif-helpers';
import { reply, routeCtx } from './panne-helpers';
import { categoryState, newBuyer, paymentById, service, sleep, type Buyer, type CategorySpec, type PaymentRow, type SaleEvent } from './paiement-helpers';
import { openConcurrentClient, waitForLockWaiters, type ConcurrentClient } from './terrain-helpers';

type Row = Record<string, unknown>;

const REFUND_SQL = 'SELECT public.ticket_refund_request($1::uuid, $2::uuid, $3::text) AS r';
const CANCEL_SQL = 'SELECT public.event_cancel($1::jsonb) AS r';
const SCAN_SQL = 'SELECT public.ticket_scan($1::jsonb) AS r';
const CHECKOUT_SQL = 'SELECT public.checkout_create_payment($1::jsonb) AS r';
const EVENT_UPDATE_SQL = 'SELECT public.event_update($1::jsonb) AS r';
const CATEGORY_UPDATE_SQL = 'SELECT public.ticket_category_update($1::jsonb) AS r';
const ACCEPT_SQL = 'SELECT public.ticket_transfer_accept($1::jsonb) AS r';
const TICKET_LOCK_SQL = 'SELECT id FROM public.tickets WHERE id = $1 FOR UPDATE';
const LOWEST_CATEGORY_SQL = 'SELECT id FROM public.ticket_categories WHERE event_id = $1 ORDER BY id LIMIT 1 FOR UPDATE';
const ALL_CATEGORIES_SQL = 'SELECT id FROM public.ticket_categories WHERE event_id = $1 ORDER BY id FOR UPDATE';
const PUBLIC_NOTICE = 'Événement annulé par l’organisateur : vos billets sont remboursés.';
const INTERNAL_REASON = 'Course de verrous du lot 9';
const REFUND_REASON = 'Remboursement de la course du lot 9';
const POLL_MS = 25;
const WAIT_MS = 10_000;

let partner: TestPartner;

before(async () => {
    partner = await newPartner('course-verrous-lot9');
});

after(async () => {
    await assertLot9Invariants('course-verrous-lot9');
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

function assertRpc(who: string, o: Outcome): Row {
    assert.ok(o.ok, `${who} : ${describeOutcome(o)}`);
    return o.r;
}

async function closeAll(...clients: ConcurrentClient[]): Promise<void> {
    for (const c of clients) await c.close();
}

/** Attente bloquée sur un verrou, ou requête terminée (après le correctif, FOR KEY SHARE ne bloque plus). */
async function blockedOrDone(pending: Promise<Outcome>, pid: number): Promise<void> {
    let done = false;
    void pending.then(() => { done = true; });
    const deadline = Date.now() + WAIT_MS;
    for (;;) {
        if (done) return;
        const state = await inspect(async (db) => (await db.query<{ wait_event_type: string | null; query: string }>(
            'SELECT wait_event_type, left(query, 200) AS query FROM pg_stat_activity WHERE pid = $1', [pid])).rows[0]);
        if (state?.wait_event_type === 'Lock') return;
        assert.ok(Date.now() < deadline, `connexion ${pid} ni bloquée ni terminée après ${WAIT_MS} ms : ${JSON.stringify(state)}`);
        await sleep(POLL_MS);
    }
}

interface Scene { ev: SaleEvent; title: string; buyer: Buyer }

async function scene(label: string, categories: CategorySpec[], startsInHours: number): Promise<Scene> {
    const buyer = await newBuyer(`verrou9-${label}`, { firstName: 'Khady', lastName: 'Acheteuse' });
    const ev = await createTimedEvent(partner.partnerId, `verrou9 ${label}`, categories, { startsInHours });
    const { data, error } = await service.from('events').select('title, status').eq('id', ev.eventId).single();
    assert.equal(error, null, `événement ${ev.eventId} : ${error?.message}`);
    assert.equal(data.status, 'PUBLIE', 'précondition : événement PUBLIE');
    return { ev, title: String(data.title), buyer };
}

const STANDARD: CategorySpec[] = [{ name: 'Standard', price: 2_000, total: 20, maxPerOrder: 10 }];
const FREE: CategorySpec[] = [{ name: 'Gratuit', price: 0, total: 20, maxPerOrder: 4 }];
const TWO_PAID: CategorySpec[] = [
    { name: 'Standard', price: 2_000, total: 20, maxPerOrder: 10 },
    { name: 'Balcon', price: 3_000, total: 20, maxPerOrder: 10 },
];

function cancelArgs(s: Scene): unknown[] {
    return [JSON.stringify({
        event_id: s.ev.eventId, actor_id: partner.userId,
        public_notice: PUBLIC_NOTICE, internal_reason: INTERNAL_REASON, confirm_title: s.title,
    })];
}

function refundArgs(ticketId: string): unknown[] {
    return [ticketId, partner.userId, REFUND_REASON];
}

async function claimFree(s: Scene): Promise<string> {
    const { data, error } = await service.rpc('free_tickets_claim', {
        p_user_id: s.buyer.userId, p_event_id: s.ev.eventId, p_items: [{ category_id: s.ev.categories.Gratuit.id, quantity: 1 }],
    });
    assert.equal(error, null, `free_tickets_claim : ${error?.message}`);
    const ids = (data as { ticket_ids?: string[] }).ticket_ids ?? [];
    assert.equal(ids.length, 1, `un billet gratuit émis : ${JSON.stringify(data)}`);
    return ids[0];
}

async function eventRow(id: string): Promise<{ status: string; title: string; updated_at: string }> {
    const { data, error } = await service.from('events').select('status, title, updated_at').eq('id', id).single();
    assert.equal(error, null, `événement ${id} : ${error?.message}`);
    return { status: String(data.status), title: String(data.title), updated_at: String(data.updated_at) };
}

async function cashoutsOf(paymentId: string): Promise<Row[]> {
    const { data, error } = await service.from('cashouts').select('kind, amount').eq('payment_id', paymentId);
    assert.equal(error, null, `cashouts : ${error?.message}`);
    return (data ?? []) as Row[];
}

function scanArgs(s: Scene, controllerId: string, ticketId: string, securityVersion: number): unknown[] {
    return [JSON.stringify({
        scanner_id: controllerId, event_id: s.ev.eventId, client_key: randomUUID(), method: 'QR', ticket_id: ticketId, totp_ok: true,
        secret_version: securityVersion, payload_hash: createHash('sha256').update(`course-lot9-${ticketId}`).digest('hex'),
    })];
}

// ── PO3 ────────────────────────────────────────────────────────────────────

describe('PO3 — ticket_refund_request : catégorie avant billet, trois connexions', () => {
    test('1. vrai cycle sur un billet gratuit : C tient le billet, A rembourse, B annule, C libère : A AUCUN, B aboutit, aucun 40P01', async () => {
        const s = await scene('gratuit', FREE, 48);
        const ticketId = await claimFree(s);
        const c = await openConcurrentClient({ applicationName: 'ev-test-verrou9-barriere' });
        const a = await openConcurrentClient({ applicationName: 'ev-test-verrou9-refund' });
        const b = await openConcurrentClient({ applicationName: 'ev-test-verrou9-cancel' });
        let aOut: Outcome;
        let bOut: Outcome;
        try {
            const held = await c.query(TICKET_LOCK_SQL, [ticketId]);
            assert.equal(held.rows.length, 1, 'précondition : billet verrouillé par C');
            const aPending = settle(a.query<{ r: Row }>(REFUND_SQL, refundArgs(ticketId)));
            await waitForLockWaiters([a.pid]);
            const bPending = settle(b.query<{ r: Row }>(CANCEL_SQL, cancelArgs(s)));
            await waitForLockWaiters([b.pid]);
            await c.rollback();
            aOut = await aPending;
            await finish(a, aOut);
            bOut = await bPending;
            await finish(b, bOut);
        } finally {
            await closeAll(a, b, c);
        }
        assertNoDeadlock([['A (remboursement)', aOut], ['B (annulation)', bOut]]);
        const refund = assertRpc('A (remboursement)', aOut);
        assert.equal(refund.ok, true, `A : ${describeOutcome(aOut)}`);
        assert.equal(refund.mode, 'AUCUN', `A : ${describeOutcome(aOut)}`);
        assert.equal(assertRpc('B (annulation)', bOut).ok, true, `B : ${describeOutcome(bOut)}`);
        assert.equal((await eventRow(s.ev.eventId)).status, 'ANNULE', 'événement annulé');
        assert.equal((await ticketRow(ticketId)).status, 'ANNULE', 'billet annulé');
        assert.equal((await categoryState(s.ev.categories.Gratuit.id)).sold, 0, 'stock rendu une seule fois');
    });

    test('2. garde-fou : C tient la catégorie, A rembourse un billet payé, S scanne, C libère : issue cohérente, aucun 40P01', async () => {
        const s = await scene('scan', STANDARD, 1);
        const purchase = await buyConfirmed(s.buyer, s.ev, [['Standard', 1]]);
        const ticketId = String(purchase.tickets[0].id);
        const controller = await newController(partner, s.ev.eventId, { label: 'verrou9' });
        const ticket = await ticketRow(ticketId);
        const c = await openConcurrentClient({ applicationName: 'ev-test-verrou9-barriere' });
        const a = await openConcurrentClient({ applicationName: 'ev-test-verrou9-refund' });
        const sc = await openConcurrentClient({ applicationName: 'ev-test-verrou9-scan' });
        let aOut: Outcome | undefined;
        let sOut: Outcome | undefined;
        try {
            const held = await c.query(ALL_CATEGORIES_SQL, [s.ev.eventId]);
            assert.equal(held.rows.length, 1, 'précondition : catégorie verrouillée par C');
            const aPending = settle(a.query<{ r: Row }>(REFUND_SQL, refundArgs(ticketId)));
            await waitForLockWaiters([a.pid]);
            const sPending = settle(sc.query<{ r: Row }>(SCAN_SQL, scanArgs(s, controller.userId, ticketId, Number(ticket.security_version))));
            await waitForLockWaiters([sc.pid]);
            await c.rollback();
            // Avant le correctif A passe la première (elle tient le billet, S attend son COMMIT) ; après, S la première.
            // Celle qui a fini valide d'abord : l'autre ne peut pas finir avant ce COMMIT.
            const first = await Promise.race([aPending.then(() => 'A' as const), sPending.then(() => 'S' as const)]);
            if (first === 'A') {
                aOut = await aPending;
                await finish(a, aOut);
                sOut = await sPending;
                await finish(sc, sOut);
            } else {
                sOut = await sPending;
                await finish(sc, sOut);
                aOut = await aPending;
                await finish(a, aOut);
            }
        } finally {
            await closeAll(a, sc, c);
        }
        assertNoDeadlock([['A (remboursement)', aOut], ['S (scan)', sOut]]);
        const refund = assertRpc('A (remboursement)', aOut);
        const scanned = assertRpc('S (scan)', sOut);
        const status = (await ticketRow(ticketId)).status;
        if (scanned.result === 'valid') {
            assert.deepEqual([refund.ok, refund.code], [false, 'TICKET_NOT_REFUNDABLE'], `billet composté, remboursement refusé : ${describeOutcome(aOut)}`);
            assert.equal(status, 'UTILISE', 'billet composté');
        } else {
            assert.equal(refund.ok, true, `remboursement accordé si le scan a refusé : ${describeOutcome(aOut)} / ${describeOutcome(sOut)}`);
            assert.equal(scanned.result, 'refunded', `scan après remboursement : ${describeOutcome(sOut)}`);
            assert.equal(status, 'REMBOURSEMENT_EN_COURS', 'billet remboursé');
        }
    });

    test('3. témoin, billet payé : le paiement sérialise A et B, A puis B, aucun 40P01 (vert dès l’écriture)', async () => {
        const s = await scene('paye', STANDARD, 48);
        const purchase = await buyConfirmed(s.buyer, s.ev, [['Standard', 1]]);
        const ticketId = String(purchase.tickets[0].id);
        const c = await openConcurrentClient({ applicationName: 'ev-test-verrou9-barriere' });
        const a = await openConcurrentClient({ applicationName: 'ev-test-verrou9-refund' });
        const b = await openConcurrentClient({ applicationName: 'ev-test-verrou9-cancel' });
        let aOut: Outcome;
        let bOut: Outcome;
        try {
            await c.query(TICKET_LOCK_SQL, [ticketId]);
            const aPending = settle(a.query<{ r: Row }>(REFUND_SQL, refundArgs(ticketId)));
            await waitForLockWaiters([a.pid]);
            const bPending = settle(b.query<{ r: Row }>(CANCEL_SQL, cancelArgs(s)));
            await waitForLockWaiters([b.pid]);
            await c.rollback();
            aOut = await aPending;
            await finish(a, aOut);
            bOut = await bPending;
            await finish(b, bOut);
        } finally {
            await closeAll(a, b, c);
        }
        assertNoDeadlock([['A (remboursement)', aOut], ['B (annulation)', bOut]]);
        const refund = assertRpc('A (remboursement)', aOut);
        assert.deepEqual([refund.ok, refund.mode], [true, 'CASHOUT'], `A : ${describeOutcome(aOut)}`);
        assert.equal(assertRpc('B (annulation)', bOut).ok, true, `B : ${describeOutcome(bOut)}`);
        assert.equal((await eventRow(s.ev.eventId)).status, 'ANNULE', 'événement annulé');
        assert.equal((await ticketRow(ticketId)).status, 'REMBOURSEMENT_EN_COURS', 'billet en remboursement');
        const cashouts = await cashoutsOf(purchase.payment.id);
        assert.equal(cashouts.filter((x) => x.kind === 'TICKET_REFUND').length, 1, `un remboursement du billet : ${JSON.stringify(cashouts)}`);
        const total = cashouts.reduce((sum, x) => sum + Number(x.amount), 0);
        assert.equal(total, Number((await paymentById(purchase.payment.id)).amount), `montants remboursés : ${JSON.stringify(cashouts)}`);
    });
});

// ── PO4 ────────────────────────────────────────────────────────────────────

function otherCategory(s: Scene, held: string): { id: string; price: number } {
    const others = Object.values(s.ev.categories).filter((c) => c.id !== held);
    assert.equal(others.length, 1, `précondition : deux catégories (${JSON.stringify(s.ev.categories)})`);
    return others[0];
}

function checkoutArgs(s: Scene, held: string): unknown[] {
    const cat = otherCategory(s, held);
    return [JSON.stringify({
        client_id: s.buyer.userId, event_id: s.ev.eventId, partner_id: partner.partnerId,
        items: [{ category_id: cat.id, quantity: 1, unit_price: cat.price }],
        operator: 'WAVE', payer_phone: s.buyer.phone9, client_idempotency_key: randomUUID(),
        transaction_id: `TX-VERROU9-${randomUUID()}`, external_order_id: `ORD-VERROU9-${randomUUID()}`, hold_minutes: 15, metadata: { target_type: 'TICKET' },
    })];
}

/**
 * Montage commun des cycles de PO4 : C tient la plus petite catégorie, B tient events et attend, A prend l'autre
 * catégorie puis est bloquée (avant le correctif) ou finit (après) ; C annule ; A puis B rendent leur issue.
 */
async function raceAgainstEdit(s: Scene, sql: string, args: (held: string) => unknown[]): Promise<{ aOut: Outcome; bOut: Outcome; held: string }> {
    const c = await openConcurrentClient({ applicationName: 'ev-test-verrou9-barriere' });
    const b = await openConcurrentClient({ applicationName: 'ev-test-verrou9-edit' });
    const a = await openConcurrentClient({ applicationName: 'ev-test-verrou9-checkout' });
    try {
        const held = (await c.query<{ id: string }>(LOWEST_CATEGORY_SQL, [s.ev.eventId])).rows[0].id;
        const bPending = settle(b.query<{ r: Row }>(sql, args(held)));
        await waitForLockWaiters([b.pid]);
        const aPending = settle(a.query<{ r: Row }>(CHECKOUT_SQL, checkoutArgs(s, held)));
        await blockedOrDone(aPending, a.pid);
        await c.rollback();
        const aOut = await aPending;
        await finish(a, aOut);
        const bOut = await bPending;
        await finish(b, bOut);
        assertNoDeadlock([['A (checkout)', aOut], ['B (édition)', bOut]]);
        return { aOut, bOut, held };
    } finally {
        await closeAll(a, b, c);
    }
}

async function assertPendingCheckout(s: Scene, aOut: Outcome, held: string): Promise<void> {
    const created = assertRpc('A (checkout)', aOut);
    assert.equal(created.ok, true, `A : ${describeOutcome(aOut)}`);
    const paymentId = String(created.payment_id);
    const payment: PaymentRow = await paymentById(paymentId);
    assert.equal(payment.status, 'PENDING', 'paiement créé, en attente');
    const { data, error } = await service.rpc('payment_release', { p_payment_id: paymentId, p_status: 'CANCELLED', p_reason: 'TEST_COURSE_LOT9' });
    assert.equal(error, null, `libération : ${error?.message}`);
    assert.equal((data as Row | null)?.changed, true, `libération : ${JSON.stringify(data)}`);
    assert.equal((await categoryState(otherCategory(s, held).id)).held, 0, 'réservation libérée');
}

describe('PO4 — event_update et ticket_category_guard : events en FOR NO KEY UPDATE, trois connexions', () => {
    test('1. event_update : C tient la plus petite catégorie, B édite, A achète l’autre, C libère : A puis B, aucun 40P01', async () => {
        const s = await scene('edit', TWO_PAID, 48);
        const { updated_at: expected } = await eventRow(s.ev.eventId);
        const title = `${s.title} (modifié)`;
        const { aOut, bOut, held } = await raceAgainstEdit(s, EVENT_UPDATE_SQL, () => [JSON.stringify({
            event_id: s.ev.eventId, actor_id: partner.userId, patch: { title }, expected_updated_at: expected,
        })]);
        await assertPendingCheckout(s, aOut, held);
        assert.equal(assertRpc('B (event_update)', bOut).ok, true, `B : ${describeOutcome(bOut)}`);
        assert.equal((await eventRow(s.ev.eventId)).title, title, 'titre modifié');
    });

    test('2. ticket_category_update (ticket_category_guard) : même montage, aucun 40P01', async () => {
        const s = await scene('guard', TWO_PAID, 48);
        const description = 'Description modifiée pendant la course.';
        const { aOut, bOut, held } = await raceAgainstEdit(s, CATEGORY_UPDATE_SQL, (lowest) => [JSON.stringify({
            event_id: s.ev.eventId, category_id: lowest, actor_id: partner.userId, patch: { description },
        })]);
        await assertPendingCheckout(s, aOut, held);
        assert.equal(assertRpc('B (ticket_category_update)', bOut).ok, true, `B : ${describeOutcome(bOut)}`);
        const { data, error } = await service.from('ticket_categories').select('description').eq('id', held).single();
        assert.equal(error, null, `catégorie : ${error?.message}`);
        assert.equal(data.description, description, 'catégorie modifiée');
    });

    test('3. témoin D20 : ticket_transfer_accept attend tant que event_update tient events (vert dès l’écriture)', async () => {
        const s = await scene('d20', STANDARD, 48);
        const recipient = await newBuyer('verrou9-dest', { firstName: 'Mariama', lastName: 'Destinataire' });
        await markPhoneVerified(recipient.userId);
        const purchase = await buyConfirmed(s.buyer, s.ev, [['Standard', 1]]);
        const ticketId = String(purchase.tickets[0].id);
        const started = await reply(await transferRoute(authed(`/api/tickets/${ticketId}/transfer`, 'POST', s.buyer, { recipient: recipient.phoneE164 }), routeCtx({ id: ticketId })));
        assert.equal(started.status, 200, `initiation du transfert : HTTP ${started.status} ${started.text.slice(0, 300)}`);
        const { data: transfers, error: tErr } = await service.from('ticket_transfers').select('id').eq('ticket_id', ticketId).eq('status', 'PENDING');
        assert.equal(tErr, null, `transfert : ${tErr?.message}`);
        assert.equal(transfers?.length, 1, 'précondition : un transfert PENDING');

        const { updated_at: expected } = await eventRow(s.ev.eventId);
        const title = `${s.title} (D20)`;
        const b = await openConcurrentClient({ applicationName: 'ev-test-verrou9-edit' });
        const a = await openConcurrentClient({ applicationName: 'ev-test-verrou9-accept' });
        let aOut: Outcome;
        let bOut: Outcome;
        try {
            bOut = await settle(b.query<{ r: Row }>(EVENT_UPDATE_SQL, [JSON.stringify({
                event_id: s.ev.eventId, actor_id: partner.userId, patch: { title }, expected_updated_at: expected,
            })]));
            assert.equal(assertRpc('B (event_update)', bOut).ok, true, `B : ${describeOutcome(bOut)}`);
            const aPending = settle(a.query<{ r: Row }>(ACCEPT_SQL, [JSON.stringify({ transfer_id: transfers![0].id, actor_id: recipient.userId })]));
            await waitForLockWaiters([a.pid]);
            await b.commit();
            aOut = await aPending;
            await finish(a, aOut);
        } finally {
            await closeAll(a, b);
        }
        assertNoDeadlock([['A (acceptation)', aOut], ['B (event_update)', bOut]]);
        assert.equal(assertRpc('A (acceptation)', aOut).ok, true, `A : ${describeOutcome(aOut)}`);
        assert.equal((await ticketRow(ticketId)).user_id, recipient.userId, 'billet transféré après la modification');
        assert.equal((await eventRow(s.ev.eventId)).title, title, 'titre modifié');
    });
});

// ── Statique ───────────────────────────────────────────────────────────────

async function definitionOf(name: string): Promise<string> {
    const defs = await inspect(async (db) => (await db.query<{ def: string }>(
        `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = $1`, [name])).rows);
    assert.equal(defs.length, 1, `une seule fonction public.${name}`);
    return defs[0].def.replace(/--[^\n]*/g, '');
}

/** Position de la première instruction (sans « ; » intérieur) qui lit `table` et se termine par ce verrou. */
function lockAt(src: string, table: string, lock: string): number {
    return src.search(new RegExp(`FROM\\s+public\\.${table}\\b[^;]*?\\b${lock}`, 'i'));
}

const NKU = 'FOR\\s+NO\\s+KEY\\s+UPDATE';
const FU = 'FOR\\s+UPDATE';

describe('PO3, PO4 — ordre écrit dans les fonctions (statique)', () => {
    test('ticket_refund_request : paiement, puis catégorie en FOR NO KEY UPDATE, puis billet ; aucun FOR UPDATE sur la catégorie', async () => {
        const src = await definitionOf('ticket_refund_request');
        const payment = lockAt(src, 'payments', FU);
        const category = lockAt(src, 'ticket_categories', NKU);
        const ticket = lockAt(src, 'tickets', FU);
        assert.ok(payment >= 0, 'verrou du paiement');
        assert.ok(category >= 0, 'verrou de la catégorie en FOR NO KEY UPDATE');
        assert.ok(ticket >= 0, 'verrou du billet');
        assert.ok(payment < category && category < ticket, `ordre paiement → catégorie → billet (positions ${payment}, ${category}, ${ticket})`);
        assert.equal(lockAt(src, 'ticket_categories', FU), -1, 'plus aucun FOR UPDATE sur ticket_categories : il créerait un cycle avec ticket_scan');
    });

    for (const fn of ['event_update', 'ticket_category_guard']) {
        test(`${fn} : events en FOR NO KEY UPDATE, plus aucun FOR UPDATE sur events`, async () => {
            const src = await definitionOf(fn);
            assert.ok(lockAt(src, 'events', NKU) >= 0, `${fn} : verrou FOR NO KEY UPDATE sur public.events`);
            assert.equal(lockAt(src, 'events', FU), -1, `${fn} : plus aucun FOR UPDATE sur public.events (il bloquerait les clés étrangères)`);
        });
    }
});
