/**
 * Lot 9 ter, tâche 9t.17 (consigne 3 ; consigne 6 : « deux contrôleurs, même invité, en même temps → une entrée ») —
 * courses autour de la validation par la liste des invités (contrat 5.C, C.2.2 points 10 et 12, C.3.3 F22 et F25,
 * C.3.6 ; X27 : SKIP LOCKED ; ordre des verrous, section 1).
 *  1. deux contrôleurs valident le même invité en même temps : une seule entrée ; même cas avec une invitation de
 *     deux billets (les deux choisissent le premier) ;
 *  2. invitation tenue par une acceptation en cours : transfer_pending immédiat (SKIP LOCKED), rien composté, puis vert ;
 *  3. validation et acceptation concurrentes : jamais deux entrées, jamais ADMITTED sur un billet VALIDE, aucune 40P01 ;
 *  4. modification du nom pendant un compostage : la modification attend, puis TICKET_ALREADY_USED ;
 *  5. double clic sur Valider : même clé → un valid, un valid rejoué, une ligne.
 *
 * Rouge avant correctif (fix(9t.17), fix(9t.17-SZ), migrations 20261110000003, …08, …09) : corps GUEST_LIST refusé
 * par la route du scan (400) ; cas 3 et 4 : garde de schéma qui nomme ticket_guest_list_search,
 * ticket_invitation_guest_name_set et tickets.guest_name absents (aucune attente de verrou sans objet).
 * after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { inspect, openConcurrentClient, waitForLockWaiters, type ConcurrentClient } from '../helpers/db';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { randomSenegalPhone } from './helpers';
import { newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent, newController, scansOf, ticketRow, type RouteResult } from './acces-helpers';
import { markPhoneVerified } from './notif-helpers';
import { guestAdmit, sendInvitations } from './zones-helpers';

type Row = Record<string, unknown>;

const VIP = 'VIP';
const CATEGORIES: CategorySpec[] = [{ name: VIP, price: 20_000, total: 30, maxPerOrder: 10 }];
const SCAN_SQL = 'SELECT public.ticket_scan($1::jsonb) AS r';
const ACCEPT_SQL = 'SELECT public.ticket_transfer_accept($1::jsonb) AS r';
const NAME_SQL = 'SELECT public.ticket_invitation_guest_name_set($1::jsonb) AS r';

let partner: TestPartner;

before(async () => {
    partner = await newPartner('course-invites');
});

after(async () => {
    await assertLot9terInvariants('course-invites');
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

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 900)}`;
}

function newEvent(label: string): Promise<SaleEvent> {
    return createTimedEvent(partner.partnerId, `course-invites ${label}`, CATEGORIES);
}

/** Les objets du contrat existent : sinon une attente de verrou échouerait sans dire ce qui manque. */
async function assertGuestListSchema(): Promise<void> {
    const missing = await inspect(async (db) => {
        const out: string[] = [];
        for (const fn of ['ticket_guest_list_search(jsonb)', 'ticket_invitation_guest_name_set(jsonb)']) {
            const { rows } = await db.query<{ reg: string | null }>('SELECT to_regprocedure($1)::text AS reg', [`public.${fn}`]);
            if (!rows[0].reg) out.push(fn);
        }
        const { rows } = await db.query<{ n: number }>(
            `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'guest_name'`);
        if (rows[0].n !== 1) out.push('tickets.guest_name');
        return out;
    });
    assert.deepEqual(missing, [], `objets absents (migration 20261110000008, contrat C.3.3) : ${missing.join(', ')}`);
}

interface Invitation { phone: string; ticketIds: string[]; transferIds: string[] }

async function pendingInvitation(ev: SaleEvent, phone: string, quantity = 1): Promise<Invitation> {
    const r = await sendInvitations(partner, ev.eventId, { category_id: ev.categories[VIP].id, phones: [phone], quantity, guest_names: ['Awa Diop'] });
    assert.equal(r.status, 200, `invitation : ${show(r)}`);
    const { data, error } = await service.from('ticket_transfers').select('id, ticket_id').eq('to_phone_or_email', phone).is('from_user_id', null).eq('status', 'PENDING');
    assert.equal(error, null, `transferts : ${error?.message}`);
    const rows = (data ?? []).slice().sort((a, b) => String(a.ticket_id).localeCompare(String(b.ticket_id)));
    assert.equal(rows.length, quantity, `précondition : ${quantity} transfert(s) PENDING`);
    return { phone, ticketIds: rows.map((t) => String(t.ticket_id)), transferIds: rows.map((t) => String(t.id)) };
}

async function transferStatus(id: string): Promise<string> {
    const { data, error } = await service.from('ticket_transfers').select('status').eq('id', id).single();
    assert.equal(error, null, `transfert ${id} : ${error?.message}`);
    return String(data.status);
}

function guestScanArgs(scannerId: string, ev: SaleEvent, ticketId: string): unknown[] {
    return [JSON.stringify({
        scanner_id: scannerId, event_id: ev.eventId, client_key: randomUUID(), method: 'GUEST_LIST', ticket_id: ticketId, identity_verified: true,
        payload_hash: createHash('sha256').update(`GUEST:${ticketId}`).digest('hex'),
    })];
}

async function closeAll(...clients: ConcurrentClient[]): Promise<void> {
    for (const c of clients) await c.close();
}

function settledResults(settled: Array<PromiseSettledResult<RouteResult>>): string[] {
    return settled.map((s) => {
        assert.equal(s.status, 'fulfilled', `appel rejeté : ${s.status === 'rejected' ? String(s.reason) : ''}`);
        const r = (s as PromiseFulfilledResult<RouteResult>).value;
        assert.equal(r.status, 200, show(r));
        return String(r.body.result);
    });
}

// ── Scénarios ──────────────────────────────────────────────────────────────

describe('9t.17 Courses de la liste des invités', () => {
    test('1. deux contrôleurs valident le même invité en même temps : une seule entrée (consigne 6)', async () => {
        const ev = await newEvent('deux-controleurs');
        const a = await newController(partner, ev.eventId, { label: 'course-a' });
        const b = await newController(partner, ev.eventId, { label: 'course-b' });
        for (const quantity of [1, 2]) {
            const inv = await pendingInvitation(ev, randomSenegalPhone('76'), quantity);
            const [first] = inv.ticketIds;
            const results = settledResults(await Promise.allSettled([guestAdmit(a, ev.eventId, first), guestAdmit(b, ev.eventId, first)]));
            assert.deepEqual(results.sort(), ['already_used', 'valid'], `invitation de ${quantity} billet(s) : ${JSON.stringify(results)}`);
            assert.equal((await scansOf(first)).filter((s) => s.accepted === true).length, 1, 'une ligne acceptée');
            assert.equal(await transferStatus(inv.transferIds[0]), 'ADMITTED', 'un transfert ADMITTED');
            for (let i = 1; i < inv.ticketIds.length; i++) {
                assert.equal((await ticketRow(inv.ticketIds[i])).status, 'VALIDE', 'le second billet de l’invité reste à valider');
                assert.equal(await transferStatus(inv.transferIds[i]), 'PENDING', 'son transfert reste PENDING');
            }
        }
    });

    test('2. invitation tenue par une acceptation en cours : transfer_pending, rien composté, puis vert', async () => {
        const ev = await newEvent('tenue');
        const ctrl = await newController(partner, ev.eventId, { label: 'course-tenue' });
        const inv = await pendingInvitation(ev, randomSenegalPhone('76'));
        const holder = await openConcurrentClient({ applicationName: 'ev-test-invitation-tenue' });
        try {
            const held = await holder.query('SELECT id FROM public.ticket_transfers WHERE id = $1 FOR UPDATE', [inv.transferIds[0]]);
            assert.equal(held.rows.length, 1, 'précondition : transfert verrouillé');
            let timer: NodeJS.Timeout | undefined;
            const deadline = new Promise<'attente'>((resolve) => { timer = setTimeout(() => resolve('attente'), 10_000); });
            const r = await Promise.race([guestAdmit(ctrl, ev.eventId, inv.ticketIds[0]), deadline]);
            clearTimeout(timer);
            assert.notEqual(r, 'attente', 'la validation attend la fin de l’acceptation au lieu de sauter le transfert verrouillé (SKIP LOCKED, X27)');
            if (r === 'attente') return;
            assert.equal(r.status, 200, show(r));
            assert.equal(r.body.result, 'transfer_pending', `SKIP LOCKED : aucune attente, refus immédiat : ${show(r)}`);
            assert.equal((await ticketRow(inv.ticketIds[0])).status, 'VALIDE', 'rien composté');
        } finally {
            await holder.close();
        }
        const ok = await guestAdmit(ctrl, ev.eventId, inv.ticketIds[0]);
        assert.equal(ok.body.result, 'valid', `clé neuve, verrou rendu : ${show(ok)}`);
        assert.equal(await transferStatus(inv.transferIds[0]), 'ADMITTED');
    });

    test('3. validation et acceptation concurrentes : jamais deux entrées, jamais ADMITTED sur un billet VALIDE', async () => {
        await assertGuestListSchema();
        const ev = await newEvent('acceptation');
        const ctrl = await newController(partner, ev.eventId, { label: 'course-accept' });
        const invitee = await newBuyer('course-invitee', { firstName: 'Awa', lastName: 'Diop' });
        const inv = await pendingInvitation(ev, invitee.phoneE164);
        await markPhoneVerified(invitee.userId);
        const acceptor = await openConcurrentClient({ applicationName: 'ev-test-invites-acceptation' });
        const scanner = await openConcurrentClient({ applicationName: 'ev-test-invites-liste' });
        let accepted: Outcome;
        let scanned: Outcome;
        try {
            accepted = await settle(acceptor.query<{ r: Row }>(ACCEPT_SQL, [JSON.stringify({ transfer_id: inv.transferIds[0], actor_id: invitee.userId })]));
            assert.ok(accepted.ok && accepted.r.ok === true, `acceptation tenue : ${describeOutcome(accepted)}`);
            const pending = settle(scanner.query<{ r: Row }>(SCAN_SQL, guestScanArgs(ctrl.userId, ev, inv.ticketIds[0])));
            await waitForLockWaiters([scanner.pid]);
            await acceptor.commit();
            scanned = await pending;
            if (scanned.ok) await scanner.commit();
            else await scanner.rollback();
        } finally {
            await closeAll(acceptor, scanner);
        }
        for (const [who, o] of [['acceptation', accepted], ['liste', scanned]] as Array<[string, Outcome]>) {
            assert.ok(!(!o.ok && o.code === '40P01'), `${who} : interblocage (40P01) : ${describeOutcome(o)}`);
        }
        assert.ok(scanned.ok, `liste : ${describeOutcome(scanned)}`);
        const result = String(scanned.r.result);
        assert.ok(['valid', 'transfer_pending'].includes(result), `issue de la liste : ${describeOutcome(scanned)}`);
        const t = await ticketRow(inv.ticketIds[0]);
        const status = await transferStatus(inv.transferIds[0]);
        assert.equal(t.user_id, invitee.userId, 'billet au compte qui a accepté');
        assert.equal(status, 'CLAIMED', 'transfert réclamé, jamais ADMITTED après une acceptation');
        assert.equal(t.status, result === 'valid' ? 'UTILISE' : 'VALIDE', `statut du billet selon l’issue (${result})`);
        assert.ok((await scansOf(inv.ticketIds[0])).filter((s) => s.accepted === true).length <= 1, 'jamais deux entrées');
    });

    test('4. modification du nom pendant un compostage : TICKET_ALREADY_USED', async () => {
        await assertGuestListSchema();
        const ev = await newEvent('nom-compostage');
        const ctrl = await newController(partner, ev.eventId, { label: 'course-nom' });
        const inv = await pendingInvitation(ev, randomSenegalPhone('76'));
        const scanner = await openConcurrentClient({ applicationName: 'ev-test-invites-compostage' });
        const editor = await openConcurrentClient({ applicationName: 'ev-test-invites-nom' });
        let edited: Outcome;
        try {
            const scanned = await settle(scanner.query<{ r: Row }>(SCAN_SQL, guestScanArgs(ctrl.userId, ev, inv.ticketIds[0])));
            assert.ok(scanned.ok && scanned.r.result === 'valid', `compostage tenu : ${describeOutcome(scanned)}`);
            const pending = settle(editor.query<{ r: Row }>(NAME_SQL,
                [JSON.stringify({ actor_id: partner.userId, event_id: ev.eventId, ticket_id: inv.ticketIds[0], guest_name: 'Moussa Fall' })]));
            await waitForLockWaiters([editor.pid]);
            await scanner.commit();
            edited = await pending;
            if (edited.ok) await editor.commit();
            else await editor.rollback();
        } finally {
            await closeAll(scanner, editor);
        }
        assert.ok(edited.ok, `modification : ${describeOutcome(edited)}`);
        assert.deepEqual({ ok: edited.r.ok, code: edited.r.code }, { ok: false, code: 'TICKET_ALREADY_USED' }, describeOutcome(edited));
        assert.equal((await ticketRow(inv.ticketIds[0])).guest_name, 'Awa Diop', 'nom inchangé');
    });

    test('5. double clic sur Valider : même clé → replayed, une ligne', async () => {
        const ev = await newEvent('double-clic');
        const ctrl = await newController(partner, ev.eventId, { label: 'course-double' });
        const inv = await pendingInvitation(ev, randomSenegalPhone('76'));
        const key = randomUUID();
        const settled = await Promise.allSettled([
            guestAdmit(ctrl, ev.eventId, inv.ticketIds[0], { idempotencyKey: key }),
            guestAdmit(ctrl, ev.eventId, inv.ticketIds[0], { idempotencyKey: key }),
        ]);
        const replies = settled.map((s) => {
            assert.equal(s.status, 'fulfilled', `appel rejeté : ${s.status === 'rejected' ? String(s.reason) : ''}`);
            return (s as PromiseFulfilledResult<RouteResult>).value;
        });
        assert.deepEqual(replies.map((r) => [r.status, r.body.result]), [[200, 'valid'], [200, 'valid']], replies.map(show).join('\n'));
        assert.deepEqual(replies.map((r) => r.body.replayed).sort(), [false, true], `un envoi rejoué (verrou consultatif de la clé) : ${replies.map(show).join('\n')}`);
        assert.equal((await scansOf(inv.ticketIds[0])).length, 1, 'une seule ligne');
    });
});
