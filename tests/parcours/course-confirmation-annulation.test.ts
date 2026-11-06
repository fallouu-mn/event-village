/**
 * Lot 8, tâche 8.2 b — ordre unique des verrous : payment_confirm et event_cancel (contrat sections 2.3 et 6.2,
 * L34, AR4, D9 du lot 7, point ouvert 11 ; écrivain W3). Connexions pg locales tenues en transaction, modèle
 * course-annulation-transfert.test.ts : aucune minuterie, chaque attente est constatée dans pg_stat_activity,
 * chaque issue est choisie par COMMIT explicite. Les étapes sont les mêmes avant et après le correctif, seules
 * les issues changent.
 *
 * Le cycle réel passe par la clé étrangère vers events : A tient une catégorie ou un billet et veut FOR KEY SHARE
 * sur events ; B (event_cancel) tient events FOR UPDATE et attend cette catégorie ou ce billet. Le correctif :
 * events FOR NO KEY UPDATE, puis paiements, puis catégories, dans payment_confirm et event_cancel.
 *  1. Vrai cycle : C tient les réservations du paiement P ; A lance payment_confirm(P), attend ; B lance
 *     event_cancel, attend ; C annule. A rend CONFIRMED, COMMIT, B aboutit, P est remboursé, billet
 *     REMBOURSEMENT_EN_COURS. Aucun 40P01.
 *  2. Garde-fou : C tient les catégories ; B lance event_cancel ; A lance payment_confirm ; C annule. B annule
 *     l'événement, A rend REFUND_REQUIRED après le COMMIT de B.
 *  3. Point ouvert 11 : C tient les catégories ; B tient events, attend ; A lance ticket_scan (billet tenu, clé
 *     étrangère vers events) ; C annule. A rend son verdict, COMMIT, B aboutit. Aucun 40P01.
 *  4. Même famille, checkout_create_payment ; 5. free_tickets_claim. Événement à DEUX catégories : voir plus bas.
 *  6. Statique : pg_get_functiondef, ordre des instructions de verrou dans les deux fonctions.
 *
 * Écart au contrat, signalé :
 *  - 4 et 5 : avec le « même montage » pris à la lettre (C tient TOUTES les catégories), A s'arrête à son premier
 *    verrou de catégorie, derrière B, sans rien tenir : aucun cycle, le test serait vert par accident. Pour un
 *    vrai cycle, A doit tenir une catégorie que B n'a pas encore atteinte. L'événement a donc deux catégories :
 *    C tient la plus petite (event_cancel les prend par id croissant, B s'y arrête en tenant events) et A achète
 *    la plus grande ; A tient alors sa catégorie et attend events ; quand C annule, B veut la catégorie de A.
 *    C'est le même mécanisme que le contrat décrit, avec un seul verrou de moins pour C.
 *  - 3, 4, 5 : après le correctif, A n'attend plus rien (FOR KEY SHARE passe sous FOR NO KEY UPDATE) : une attente
 *    constatée par waitForLockWaiters échouerait. L'étape devient « A est bloquée, ou A a fini » (blockedOrDone),
 *    ce qui garde les mêmes étapes avant et après.
 *  - 6 : la position de la PREMIÈRE mention de public.payments ne convient pas à payment_confirm, dont le correctif
 *    lit d'abord le paiement sans verrou (contrat 6.2) : le contrôle compare les instructions de VERROU.
 *
 * Rouge avant correctif (fix(8.2b)) :
 *  - 1, 3, 4 : 40P01 sur A ou sur B (deadlock_timeout d'une seconde) ; 5 : même mécanisme (SUPPOSÉ) ;
 *  - 6 : event_cancel verrouille events FOR UPDATE, puis les catégories, et ne verrouille les paiements qu'après
 *    (20261105000003_lot7_securite.sql:128,165,197) ; payment_confirm verrouille d'abord le paiement et jamais
 *    events (20261105000007_lot7_confirmation.sql:80) ;
 *  - after() : assertRecetteInvariants nomme le schéma du lot absent.
 * Vert dès l'écriture (SUPPOSÉ, signalé) : 2, garde-fou : B passe avant A dans la file de la catégorie, et les
 * paiements PENDING ne sont pas verrouillés par l'ancien event_cancel. Son rôle est de verrouiller le nouvel ordre :
 * un correctif qui ferait passer A avant B rendrait des billets sur un événement annulé.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { CashoutService } from '../../lib/payments/cashout.service';
import { inspect } from '../helpers/db';
import { assertRecetteInvariants } from '../helpers/recette-invariants';
import { cart, categoryState, checkout, newBuyer, paymentById, service, sleep, type Buyer, type CategorySpec, type PaymentRow, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent, newController, ticketRow } from './acces-helpers';
import { openConcurrentClient, waitForLockWaiters, type ConcurrentClient } from './terrain-helpers';

type Row = Record<string, unknown>;

const CONFIRM_SQL = 'SELECT public.payment_confirm($1::uuid, $2::text) AS r';
const CANCEL_SQL = 'SELECT public.event_cancel($1::jsonb) AS r';
const SCAN_SQL = 'SELECT public.ticket_scan($1::jsonb) AS r';
const CHECKOUT_SQL = 'SELECT public.checkout_create_payment($1::jsonb) AS r';
const FREE_SQL = 'SELECT public.free_tickets_claim($1::uuid, $2::uuid, $3::jsonb) AS r';
const LOWEST_CATEGORY_SQL = 'SELECT id FROM public.ticket_categories WHERE event_id = $1 ORDER BY id LIMIT 1 FOR UPDATE';
const ALL_CATEGORIES_SQL = 'SELECT id FROM public.ticket_categories WHERE event_id = $1 ORDER BY id FOR UPDATE';
const PUBLIC_NOTICE = 'Événement annulé par l’organisateur : vos billets sont remboursés.';
const INTERNAL_REASON = 'Course confirmation et annulation (lot 8)';
const POLL_MS = 25;
const WAIT_MS = 10_000;

let partner: TestPartner;

before(async () => {
    partner = await newPartner('course-confirmation');
});

after(async () => {
    await assertRecetteInvariants('course-confirmation-annulation');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

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
    assert.deepEqual(deadlocks, [], `interblocage (40P01) :\n${deadlocks.join('\n')}`);
}

function assertRpc(who: string, o: Outcome): Row {
    assert.ok(o.ok, `${who} : ${describeOutcome(o)}`);
    return o.r;
}

/**
 * Attend que la requête `pending` de la connexion `pid` soit bloquée sur un verrou, ou terminée (après le correctif,
 * FOR KEY SHARE passe sous FOR NO KEY UPDATE et A ne bloque plus). Une lecture par sondage, hors transaction :
 * pg_stat_activity est figé dans une transaction. Échec explicite si ni l'un ni l'autre n'arrive.
 */
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
    const buyer = await newBuyer(`course-conf-${label}`, { firstName: 'Khady', lastName: 'Acheteuse' });
    const ev = await createTimedEvent(partner.partnerId, `course conf ${label}`, categories, { startsInHours });
    const { data, error } = await service.from('events').select('title, status').eq('id', ev.eventId).single();
    assert.equal(error, null, `événement ${ev.eventId} : ${error?.message}`);
    assert.equal(data.status, 'PUBLIE', 'précondition : événement PUBLIE');
    return { ev, title: String(data.title), buyer };
}

const STANDARD: CategorySpec[] = [{ name: 'Standard', price: 2_000, total: 20, maxPerOrder: 10 }];

async function pendingPayment(s: Scene): Promise<PaymentRow> {
    const r = await checkout(s.buyer, cart(s.ev.eventId, [[s.ev.categories.Standard.id, 1]], s.buyer));
    assert.equal(r.status, 200, `checkout de préparation : HTTP ${r.status} ${JSON.stringify(r.body)}`);
    assert.ok(r.payment, 'paiement de préparation créé');
    return r.payment!;
}

function cancelArgs(s: Scene): unknown[] {
    return [JSON.stringify({
        event_id: s.ev.eventId, actor_id: partner.userId,
        public_notice: PUBLIC_NOTICE, internal_reason: INTERNAL_REASON, confirm_title: s.title,
    })];
}

/** Identifiant de la catégorie de l'événement qui n'est pas `held` (montage des cas 4 et 5). */
function otherCategory(s: Scene, held: string): { id: string; price: number } {
    const others = Object.values(s.ev.categories).filter((c) => c.id !== held);
    assert.equal(others.length, 1, `précondition : deux catégories (${JSON.stringify(s.ev.categories)})`);
    return others[0];
}

async function eventStatusOf(id: string): Promise<string> {
    const { data, error } = await service.from('events').select('status').eq('id', id).single();
    assert.equal(error, null, `événement ${id} : ${error?.message}`);
    return String(data.status);
}

async function cashoutsOf(paymentId: string): Promise<Row[]> {
    const { data, error } = await service.from('cashouts').select('*').eq('payment_id', paymentId);
    assert.equal(error, null, `cashouts du paiement ${paymentId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function closeAll(...clients: ConcurrentClient[]): Promise<void> {
    for (const c of clients) await c.close();
}

/**
 * Montage des cas 3, 4 et 5 : C prend son verrou (`hold`) ; B tient events et attend ; A lance sa requête, puis est
 * bloquée (avant le correctif) ou finit (après) ; C annule ; A puis B rendent leur issue, sans aucun 40P01.
 */
async function raceAgainstCancel(s: Scene, hold: (c: ConcurrentClient) => Promise<void>, sql: string, args: () => unknown[]): Promise<{ aOut: Outcome; bOut: Outcome }> {
    const c = await openConcurrentClient({ applicationName: 'ev-test-course-barriere' });
    const b = await openConcurrentClient({ applicationName: 'ev-test-course-cancel' });
    const a = await openConcurrentClient({ applicationName: 'ev-test-course-a' });
    try {
        await hold(c);
        const bPending = settle(b.query<{ r: Row }>(CANCEL_SQL, cancelArgs(s)));
        await waitForLockWaiters([b.pid]);
        const aPending = settle(a.query<{ r: Row }>(sql, args()));
        await blockedOrDone(aPending, a.pid);
        await c.rollback();
        const aOut = await aPending;
        await finish(a, aOut);
        const bOut = await bPending;
        await finish(b, bOut);
        assertNoDeadlock([['A', aOut], ['B (annulation)', bOut]]);
        return { aOut, bOut };
    } finally {
        await closeAll(a, b, c);
    }
}

// ── Scénarios ──────────────────────────────────────────────────────────────

describe('8.2 b — payment_confirm et event_cancel, trois connexions', () => {
    test('1. vrai cycle : C tient les réservations, A confirme, B annule, C annule : A CONFIRMED puis B aboutit, aucun 40P01', async () => {
        const s = await scene('cycle', STANDARD, 48);
        const payment = await pendingPayment(s);
        const c = await openConcurrentClient({ applicationName: 'ev-test-course-barriere' });
        const a = await openConcurrentClient({ applicationName: 'ev-test-course-confirm' });
        const b = await openConcurrentClient({ applicationName: 'ev-test-course-cancel' });
        let aOut: Outcome;
        let bOut: Outcome;
        try {
            const held = await c.query('SELECT 1 FROM public.stock_reservations WHERE payment_id = $1 FOR UPDATE', [payment.id]);
            assert.equal(held.rows.length, 1, 'précondition : réservation du paiement verrouillée par C');
            const aPending = settle(a.query<{ r: Row }>(CONFIRM_SQL, [payment.id, 'TEST']));
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
        assertNoDeadlock([['A (confirmation)', aOut], ['B (annulation)', bOut]]);
        assert.equal(assertRpc('A (confirmation)', aOut).result, 'CONFIRMED', `A : ${describeOutcome(aOut)}`);
        assert.equal(assertRpc('B (annulation)', bOut).ok, true, `B : ${describeOutcome(bOut)}`);

        assert.equal(await eventStatusOf(s.ev.eventId), 'ANNULE', 'événement annulé');
        assert.equal((await paymentById(payment.id)).status, 'SUCCESS', 'paiement confirmé avant l’annulation');
        const cashouts = await cashoutsOf(payment.id);
        assert.deepEqual(cashouts.map((x) => [x.kind, Number(x.amount)]), [['EVENT_CANCELLATION_REFUND', Number(payment.amount)]], 'remboursement du paiement par l’annulation');
        const { data: tickets, error } = await service.from('tickets').select('status').eq('payment_id', payment.id);
        assert.equal(error, null, `billets : ${error?.message}`);
        assert.deepEqual((tickets ?? []).map((t) => t.status), ['REMBOURSEMENT_EN_COURS'], 'billet en cours de remboursement');
    });

    test('2. garde-fou : C tient les catégories, B annule, A confirme : B annule l’événement, A rend REFUND_REQUIRED après le COMMIT de B', async () => {
        const s = await scene('garde-fou', STANDARD, 48);
        const payment = await pendingPayment(s);
        const c = await openConcurrentClient({ applicationName: 'ev-test-course-barriere' });
        const b = await openConcurrentClient({ applicationName: 'ev-test-course-cancel' });
        const a = await openConcurrentClient({ applicationName: 'ev-test-course-confirm' });
        let aOut: Outcome;
        let bOut: Outcome;
        try {
            const held = await c.query(ALL_CATEGORIES_SQL, [s.ev.eventId]);
            assert.equal(held.rows.length, 1, 'précondition : catégorie verrouillée par C');
            const bPending = settle(b.query<{ r: Row }>(CANCEL_SQL, cancelArgs(s)));
            await waitForLockWaiters([b.pid]);
            const aPending = settle(a.query<{ r: Row }>(CONFIRM_SQL, [payment.id, 'TEST']));
            await waitForLockWaiters([a.pid]);
            await c.rollback();
            bOut = await bPending;
            await finish(b, bOut);
            aOut = await aPending;
            await finish(a, aOut);
        } finally {
            await closeAll(a, b, c);
        }
        assertNoDeadlock([['A (confirmation)', aOut], ['B (annulation)', bOut]]);
        assert.equal(assertRpc('B (annulation)', bOut).ok, true, `B : ${describeOutcome(bOut)}`);
        const confirmed = assertRpc('A (confirmation)', aOut);
        assert.equal(confirmed.result, 'REFUND_REQUIRED', `A, sur un événement annulé : ${describeOutcome(aOut)}`);

        assert.equal(await eventStatusOf(s.ev.eventId), 'ANNULE', 'événement annulé');
        assert.equal((await paymentById(payment.id)).status, 'REFUND_PENDING', 'paiement à rembourser');
        const { count, error } = await service.from('tickets').select('id', { count: 'exact', head: true }).eq('payment_id', payment.id);
        assert.equal(error, null, `billets : ${error?.message}`);
        assert.equal(count, 0, 'aucun billet sur un événement annulé');
        // Envoi du remboursement : aucune ligne REFUND à envoyer ne reste pour le cron d'une autre suite
        assert.equal((await CashoutService.send(String(confirmed.cashout_id))).status, 'CONFIRME', 'remboursement envoyé');
        assert.equal((await paymentById(payment.id)).status, 'REFUNDED', 'paiement remboursé');
    });

    test('3. point ouvert 11 : C tient les catégories, B tient events, A lance ticket_scan : A rend son verdict, B aboutit, aucun 40P01', async () => {
        const s = await scene('scan', STANDARD, 1);
        const purchase = await buyConfirmed(s.buyer, s.ev, [['Standard', 1]]);
        const ticketId = String(purchase.tickets[0].id);
        const controller = await newController(partner, s.ev.eventId, { label: 'course-conf' });
        const ticket = await ticketRow(ticketId);
        const scanArgs = [JSON.stringify({
            scanner_id: controller.userId, event_id: s.ev.eventId, client_key: randomUUID(), method: 'QR', ticket_id: ticketId, totp_ok: true,
            secret_version: Number(ticket.security_version), payload_hash: createHash('sha256').update(`course-${ticketId}`).digest('hex'),
        })];
        const { aOut, bOut } = await raceAgainstCancel(s, async (c) => {
            const held = await c.query(ALL_CATEGORIES_SQL, [s.ev.eventId]);
            assert.equal(held.rows.length, 1, 'précondition : catégorie verrouillée par C');
        }, SCAN_SQL, () => scanArgs);
        assert.equal(assertRpc('A (scan)', aOut).result, 'valid', `A : ${describeOutcome(aOut)}`);
        assert.equal(assertRpc('B (annulation)', bOut).ok, true, `B : ${describeOutcome(bOut)}`);
        assert.equal(await eventStatusOf(s.ev.eventId), 'ANNULE', 'événement annulé');
        assert.equal((await ticketRow(ticketId)).status, 'UTILISE', 'billet composté avant l’annulation');
        assert.deepEqual((await cashoutsOf(purchase.payment.id)).map((x) => x.kind), ['EVENT_CANCELLATION_REFUND'], 'paiement remboursé par l’annulation');
    });

    test('4. même famille, checkout_create_payment : A tient sa catégorie et la clé étrangère passe, B aboutit, aucun 40P01', async () => {
        const s = await scene('checkout', [
            { name: 'Standard', price: 2_000, total: 20, maxPerOrder: 10 },
            { name: 'Balcon', price: 3_000, total: 20, maxPerOrder: 10 },
        ], 48);
        let held = '';
        const args = (): unknown[] => {
            const cat = otherCategory(s, held);
            return [JSON.stringify({
                client_id: s.buyer.userId, event_id: s.ev.eventId, partner_id: partner.partnerId,
                items: [{ category_id: cat.id, quantity: 1, unit_price: cat.price }],
                operator: 'WAVE', payer_phone: s.buyer.phone9, client_idempotency_key: randomUUID(),
                transaction_id: `TX-COURSE-${randomUUID()}`, external_order_id: `ORD-COURSE-${randomUUID()}`, hold_minutes: 15, metadata: { target_type: 'TICKET' },
            })];
        };
        const { aOut, bOut } = await raceAgainstCancel(s, async (c) => {
            held = (await c.query<{ id: string }>(LOWEST_CATEGORY_SQL, [s.ev.eventId])).rows[0].id;
        }, CHECKOUT_SQL, args);
        const created = assertRpc('A (checkout)', aOut);
        assert.equal(created.ok, true, `A : ${describeOutcome(aOut)}`);
        assert.equal(assertRpc('B (annulation)', bOut).ok, true, `B : ${describeOutcome(bOut)}`);
        assert.equal(await eventStatusOf(s.ev.eventId), 'ANNULE', 'événement annulé');

        const paymentId = String(created.payment_id);
        assert.equal((await paymentById(paymentId)).status, 'PENDING', 'paiement créé avant l’annulation, encore en attente');
        // Réservation rendue : rien ne reste tenu sur un événement annulé
        const { data, error } = await service.rpc('payment_release', { p_payment_id: paymentId, p_status: 'CANCELLED', p_reason: 'TEST_COURSE' });
        assert.equal(error, null, `libération : ${error?.message}`);
        assert.equal((data as Row | null)?.changed, true, `libération : ${JSON.stringify(data)}`);
        assert.equal((await categoryState(otherCategory(s, held).id)).held, 0, 'réservation libérée');
    });

    test('5. même famille, free_tickets_claim : A tient sa catégorie gratuite et la clé étrangère passe, B aboutit, aucun 40P01', async () => {
        const s = await scene('gratuit', [
            { name: 'Gratuit', price: 0, total: 20, maxPerOrder: 4 },
            { name: 'Invitation', price: 0, total: 20, maxPerOrder: 4 },
        ], 48);
        let held = '';
        const args = (): unknown[] => [s.buyer.userId, s.ev.eventId, JSON.stringify([{ category_id: otherCategory(s, held).id, quantity: 1 }])];
        const { aOut, bOut } = await raceAgainstCancel(s, async (c) => {
            held = (await c.query<{ id: string }>(LOWEST_CATEGORY_SQL, [s.ev.eventId])).rows[0].id;
        }, FREE_SQL, args);
        const claimed = assertRpc('A (gratuits)', aOut);
        assert.equal(claimed.ok, true, `A : ${describeOutcome(aOut)}`);
        assert.equal(assertRpc('B (annulation)', bOut).ok, true, `B : ${describeOutcome(bOut)}`);
        assert.equal(await eventStatusOf(s.ev.eventId), 'ANNULE', 'événement annulé');
        const ids = claimed.ticket_ids as string[];
        assert.equal(ids.length, 1, 'un billet gratuit émis avant l’annulation');
        assert.equal((await ticketRow(ids[0])).status, 'ANNULE', 'billet gratuit annulé par l’annulation de l’événement');
        assert.equal((await categoryState(otherCategory(s, held).id)).sold, 0, 'stock rendu');
    });
});

describe('8.2 b — ordre écrit dans les deux fonctions', () => {
    test('6. pg_get_functiondef : events FOR NO KEY UPDATE dans les deux ; paiements avant catégories dans event_cancel ; events avant le verrou du paiement dans payment_confirm', async () => {
        const defs = await inspect(async (db) => (await db.query<{ proname: string; def: string }>(
            `SELECT p.proname, pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname IN ('payment_confirm', 'event_cancel')`)).rows);
        const code = (name: string): string => {
            const found = defs.filter((d) => d.proname === name);
            assert.equal(found.length, 1, `une seule fonction public.${name}`);
            return found[0].def.replace(/--[^\n]*/g, '');
        };
        /** Position de la première instruction (sans « ; » intérieur) qui lit `table` et se termine par ce verrou. */
        const lockAt = (src: string, table: string, lock: string): number => src.search(new RegExp(`FROM\\s+public\\.${table}\\b[^;]*?\\b${lock}`, 'i'));

        const cancel = code('event_cancel');
        const cancelEvents = lockAt(cancel, 'events', 'FOR\\s+NO\\s+KEY\\s+UPDATE');
        const cancelPayments = lockAt(cancel, 'payments', 'FOR\\s+UPDATE');
        const cancelCategories = lockAt(cancel, 'ticket_categories', 'FOR\\s+UPDATE');
        assert.ok(cancelEvents >= 0, 'event_cancel : verrou FOR NO KEY UPDATE sur public.events');
        assert.equal(lockAt(cancel, 'events', 'FOR\\s+UPDATE'), -1, 'event_cancel : plus aucun FOR UPDATE sur public.events (il bloquerait les clés étrangères)');
        assert.ok(cancelCategories >= 0, 'event_cancel : verrou des catégories');
        assert.ok(cancelPayments >= 0 && cancelEvents < cancelPayments && cancelPayments < cancelCategories,
            `event_cancel : ordre events → paiements → catégories (positions ${cancelEvents}, ${cancelPayments}, ${cancelCategories})`);

        const confirm = code('payment_confirm');
        const confirmEvents = lockAt(confirm, 'events', 'FOR\\s+NO\\s+KEY\\s+UPDATE');
        const confirmPayments = lockAt(confirm, 'payments', 'FOR\\s+UPDATE');
        const confirmCategories = lockAt(confirm, 'ticket_categories', 'FOR\\s+UPDATE');
        assert.ok(confirmEvents >= 0, 'payment_confirm : verrou FOR NO KEY UPDATE sur public.events');
        assert.ok(confirmPayments >= 0 && confirmEvents < confirmPayments && confirmPayments < confirmCategories,
            `payment_confirm : ordre events → paiement → catégories (positions ${confirmEvents}, ${confirmPayments}, ${confirmCategories})`);
    });
});
