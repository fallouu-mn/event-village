/**
 * Lot 9 bis, tâche 23 (X27, contrat 3.3 ; R44, R61) — ordre des verrous des transferts, connexions pg locales tenues en
 * transaction (modèle course-verrous-lot9.test.ts) : aucune minuterie de fond, chaque attente est constatée, chaque
 * issue est choisie par un COMMIT ou un ROLLBACK explicite.
 *  1. X27 : `ticket_scan` tient le billet puis appelle `ticket_transfers_expire_due(t, TRUE)`, arête billet → transfert
 *     inverse de l'ordre global : le transfert échu est pris en `FOR UPDATE SKIP LOCKED`. Une acceptation qui tient le
 *     transfert (C, entre sa prise du transfert et celle du billet) ne fait donc ni attendre ni interbloquer le scan
 *     (S, `lock_timeout` de 2 s) : le scan rend `transfer_pending`, sans compostage.
 *  2. R61 : remboursement (A, paiement → catégorie → transferts du billet FOR UPDATE → billet) contre acceptation
 *     (B, events FOR SHARE → transfert → billet) : B attend le transfert, A valide, B aboutit sur
 *     TRANSFER_NOT_PENDING ; aucun 40P01.
 * Rouge avant correctif : 1. ticket_scan ne lit pas les transferts : `valid` et billet UTILISE ; 2. A ne touche pas au
 * transfert : B attend le billet puis rend TICKET_NOT_TRANSFERABLE, transfert toujours PENDING.
 * Non exécuté sur ce poste (pas de Docker) : l'issue se lira au run « avant » en CI.
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { CashoutService } from '../../lib/payments/cashout.service';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, cashoutsByKey, confirmCashouts, newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent, newController, ticketRow } from './acces-helpers';
import { markPhoneVerified } from './notif-helpers';
import { issueFreeTicket, openConcurrentClient, waitForLockWaiters, type ConcurrentClient } from './terrain-helpers';

type Row = Record<string, unknown>;

const HOUR = 3600_000;
const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 2_000, total: 20 }, { name: 'Gratuit', price: 0, total: 20 }];
const SCAN_SQL = 'SELECT public.ticket_scan($1::jsonb) AS r';
const ACCEPT_SQL = 'SELECT public.ticket_transfer_accept($1::jsonb) AS r';
const REFUND_SQL = 'SELECT public.ticket_refund_request($1::uuid, $2::uuid, $3::text) AS r';
const TRANSFER_LOCK_SQL = 'SELECT id FROM public.ticket_transfers WHERE id = $1 FOR UPDATE';

let partner: TestPartner;
let ev: SaleEvent;
let controller: Buyer;

before(async () => {
    partner = await newPartner('course-verrous-9bis');
    ev = await createTimedEvent(partner.partnerId, 'verrou9bis', CATEGORIES, { startsInHours: 1 });
    controller = await newController(partner, ev.eventId, { label: 'verrou9bis' });
});

after(async () => {
    await assertLot9bisInvariants('course-verrous-lot9bis');
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

function assertNoDeadlock(outcomes: Array<[string, Outcome]>): void {
    const deadlocks = outcomes.filter(([, o]) => !o.ok && o.code === '40P01').map(([who, o]) => `${who} : ${describeOutcome(o)}`);
    assert.deepEqual(deadlocks, [], `interblocage (40P01) :\n${deadlocks.join('\n')}`);
}

async function finish(client: ConcurrentClient, o: Outcome): Promise<void> {
    if (o.ok) await client.commit();
    else await client.rollback();
}

async function closeAll(...clients: ConcurrentClient[]): Promise<void> {
    for (const c of clients) await c.close();
}

async function initiate(ticketId: string, from: Buyer, to: string): Promise<string> {
    const { data, error } = await service.rpc('ticket_transfer_initiate', {
        p: { ticket_id: ticketId, actor_id: from.userId, recipient: to, expires_at: new Date(Date.now() + 48 * HOUR).toISOString() },
    });
    assert.equal(error, null, `ticket_transfer_initiate : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `transfert refusé : ${JSON.stringify(data)}`);
    return String((data as Row).transfer_id);
}

async function transferStatus(id: string): Promise<string> {
    const { data, error } = await service.from('ticket_transfers').select('status').eq('id', id).single();
    assert.equal(error, null, `transfert ${id} : ${error?.message}`);
    return String(data.status);
}

function scanArgs(ticketId: string, securityVersion: number): unknown[] {
    return [JSON.stringify({
        scanner_id: controller.userId, event_id: ev.eventId, client_key: randomUUID(), method: 'QR', ticket_id: ticketId, totp_ok: true,
        secret_version: securityVersion, payload_hash: createHash('sha256').update(`course-lot9bis-${ticketId}`).digest('hex'),
    })];
}

// ── 1. X27 : scan contre acceptation d'un transfert échu ───────────────────

describe('X27 — scan d’un billet dont le transfert échu est tenu par une acceptation', () => {
    test('C tient le transfert ; S scanne (lock_timeout 2 s) : ni attente ni 40P01, transfer_pending, billet non composté', async () => {
        const holder = await newBuyer('verrou9bis-scan');
        const recipient = await newBuyer('verrou9bis-dest');
        await markPhoneVerified(recipient.userId);
        const ticketId = await issueFreeTicket(ev.eventId, ev.categories.Gratuit.id, holder);
        const transferId = await initiate(ticketId, holder, recipient.phoneE164);
        const { error: upErr } = await service.from('ticket_transfers')
            .update({ created_at: new Date(Date.now() - 3 * HOUR).toISOString(), expires_at: new Date(Date.now() - HOUR).toISOString() })
            .eq('id', transferId);
        assert.equal(upErr, null, `transfert rendu échu : ${upErr?.message}`);
        const ticket = await ticketRow(ticketId);

        const c = await openConcurrentClient({ applicationName: 'ev-test-verrou9bis-acceptation' });
        const s = await openConcurrentClient({ applicationName: 'ev-test-verrou9bis-scan', lockTimeoutMs: 2_000 });
        let sOut: Outcome = { ok: false, code: 'NON_LANCE', message: 'scan non lancé' };
        try {
            const held = await c.query(TRANSFER_LOCK_SQL, [transferId]);
            assert.equal(held.rows.length, 1, 'précondition : transfert tenu par C (acceptation en cours)');
            sOut = await settle(s.query<{ r: Row }>(SCAN_SQL, scanArgs(ticketId, Number(ticket.security_version))));
            assertNoDeadlock([['S (scan)', sOut]]);
            assert.ok(sOut.ok, `S : le scan ne doit ni attendre le transfert tenu (SKIP LOCKED) ni échouer : ${describeOutcome(sOut)}`);
            await finish(s, sOut);
            await c.rollback();
        } finally {
            await closeAll(s, c);
        }
        assert.equal(sOut.ok && sOut.r.result, 'transfer_pending', `transfert tenu, non expiré par le scan : transfer_pending (aujourd’hui valid) : ${describeOutcome(sOut)}`);
        assert.equal((await ticketRow(ticketId)).status, 'VALIDE', 'billet non composté');
    });
});

// ── 2. R61 : remboursement contre acceptation ──────────────────────────────

describe('R61 — remboursement contre acceptation du même billet', () => {
    test('A rembourse (transaction ouverte) ; B accepte, attend ; A valide : B rend TRANSFER_NOT_PENDING, transfert CANCELLED, aucun 40P01', async () => {
        const buyer = await newBuyer('verrou9bis-acheteur');
        const recipient = await newBuyer('verrou9bis-receveur');
        await markPhoneVerified(recipient.userId);
        const [ticket] = (await buyConfirmed(buyer, ev, [['Standard', 1]])).tickets;
        const ticketId = String(ticket.id);
        const transferId = await initiate(ticketId, buyer, recipient.phoneE164);

        const a = await openConcurrentClient({ applicationName: 'ev-test-verrou9bis-remboursement' });
        const b = await openConcurrentClient({ applicationName: 'ev-test-verrou9bis-accept' });
        let aOut: Outcome = { ok: false, code: 'NON_LANCE', message: 'remboursement non lancé' };
        let bOut: Outcome = { ok: false, code: 'NON_LANCE', message: 'acceptation non lancée' };
        try {
            aOut = await settle(a.query<{ r: Row }>(REFUND_SQL, [ticketId, partner.userId, 'Course remboursement et acceptation (lot 9 bis)']));
            assert.ok(aOut.ok && aOut.r.ok === true, `A : remboursement accepté : ${describeOutcome(aOut)}`);
            const bPending = settle(b.query<{ r: Row }>(ACCEPT_SQL, [JSON.stringify({ transfer_id: transferId, actor_id: recipient.userId })]));
            await waitForLockWaiters([b.pid]);
            await a.commit();
            bOut = await bPending;
            assertNoDeadlock([['A (remboursement)', aOut], ['B (acceptation)', bOut]]);
            await finish(b, bOut);
        } finally {
            await closeAll(a, b);
        }
        try {
            assert.ok(bOut.ok, `B : ${describeOutcome(bOut)}`);
            assert.equal(bOut.r.code, 'TRANSFER_NOT_PENDING', `B : le transfert a été annulé par le remboursement (aujourd’hui TICKET_NOT_TRANSFERABLE) : ${describeOutcome(bOut)}`);
            assert.equal(await transferStatus(transferId), 'CANCELLED', 'transfert annulé par le remboursement');
            assert.equal((await ticketRow(ticketId)).user_id, buyer.userId, 'billet jamais passé au destinataire');
        } finally {
            for (const co of await cashoutsByKey(`REFUND-TKT-${ticketId}`)) {
                if (co.status === 'A_ENVOYER') await CashoutService.send(String(co.id));
            }
            await confirmCashouts();
        }
    });
});
