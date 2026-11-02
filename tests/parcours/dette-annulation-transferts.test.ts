/**
 * Lot 6, tâche 6.0 c — event_cancel annule les transferts PENDING et déverrouille les billets dans la même
 * transaction que l'annulation (contrat A3, S2 groupe Dette ; ancien cas 6 de
 * tests/legacy/event-cancellation-and-refunds.test.ts, supprimé au lot 5, point ouvert du rapport du lot 5).
 *  1. Montage : partenaire, événement PUBLIE, porteur avec deux billets, transfert PENDING du billet 1 par la
 *     route POST /api/tickets/[id]/transfer vers le numéro d'un compte destinataire ; témoin : un transfert
 *     PENDING sur un AUTRE événement du même porteur.
 *  2. Annulation par event_cancel (advanceEventTo, acteur partenaire) : transfert CANCELLED avec cancelled_at,
 *     billet déverrouillé, événement ANNULE ; le témoin reste PENDING et verrouillé.
 *  3. Même transaction : xmin de la ligne ticket_transfers = txid (mod 2^32) de la ligne CANCELLATION de
 *     event_status_history, et ticket_transfers.cancelled_at = event_cancellations.cancelled_at (now() est
 *     constant dans une transaction).
 *  4. Tout ou rien (transaction annulée, connexion directe) : un trigger temporaire AFTER UPDATE OF
 *     transfer_locked ON tickets lève « échec simulé » ; event_cancel échoue, et après ROLLBACK TO SAVEPOINT le
 *     transfert est PENDING, le billet verrouillé, l'événement PUBLIE, sans ligne event_cancellations (toutes
 *     les lectures par la même connexion).
 *  5. Réclamation après l'annulation par la nouvelle route POST /api/tickets/transfers/[id]/claim (contrat B4,
 *     destinataire au numéro vérifié) → 409 TRANSFER_NOT_PENDING, billet resté au porteur.
 *  6. Variante SUSPENDU → ANNULE.
 *  7. Garde-fou de détection (transaction annulée) : copie de event_cancel sans ses deux instructions
 *     « UPDATE public.ticket_transfers SET status = 'CANCELLED' … ; » et « UPDATE public.tickets SET
 *     transfer_locked = FALSE … ; » (le test échoue si la substitution n'en retire pas exactement deux),
 *     annulation d'un événement par cette copie : la vérification du point 2 relève le transfert resté
 *     PENDING et le billet verrouillé. Contre-épreuve hors transaction : la vraie fonction annule.
 *
 * État avant correctif (couverture ajoutée, aucun correctif attendu, contrat A3) :
 *  - points 1 à 4, 6 et 7 : verts dès l'écriture, le comportement existe
 *    (supabase/migrations/20261102000003_lot5_cycle.sql:634-637) ; le point 7 prouve que la vérification
 *    détecterait son absence ;
 *  - point 5 : rouge jusqu'au correctif 6.7 (route de réclamation par identifiant absente, colonne
 *    users.phone_verified_at absente : markPhoneVerified échoue en nommant B1) ;
 *  - fin de suite : assertNotificationInvariants échoue avant le correctif 6.1 (boîte d'envoi absente).
 * La suite crée son partenaire, ses événements, son porteur et son destinataire.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { Client } from 'pg';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { assertNotificationInvariants, loadLotModule, markPhoneVerified } from './notif-helpers';
import { importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, ticketRow, type RouteResult } from './acces-helpers';
import { advanceEventTo, eventStatus } from './cycle-helpers';

const TRANSFER_ROUTE = '../../app/api/tickets/[id]/transfer/route';
const CLAIM_ROUTE = '../../app/api/tickets/transfers/[id]/claim/route';
const PUBLIC_NOTICE = 'Événement annulé par l’organisateur : vos billets sont remboursés.';
const INTERNAL_REASON = 'Annulation de test du lot 6 (transferts)';

let partner: TestPartner;
let holder: Buyer;
let recipient: Buyer;

before(async () => {
    partner = await newPartner('annul-transferts');
    holder = await newBuyer('annul-transf-porteur');
    recipient = await newBuyer('annul-transf-dest', { firstName: 'Mariama', lastName: 'Destinataire' });
});

after(async () => {
    await assertNotificationInvariants('dette-annulation-transferts');
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

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body)}`;
}

/** Contexte de route valable que le gestionnaire lise `params.id` ou `await params`. */
function paramsContext(id: string): { params: Promise<{ id: string }> & { id: string } } {
    return { params: Object.assign(Promise.resolve({ id }), { id }) };
}

async function transfersOf(ticketId: string): Promise<Row[]> {
    const { data, error } = await service.from('ticket_transfers').select('*').eq('ticket_id', ticketId).order('created_at');
    assert.equal(error, null, `transferts du billet ${ticketId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function transferRow(id: string): Promise<Row> {
    const { data, error } = await service.from('ticket_transfers').select('*').eq('id', id).single();
    assert.equal(error, null, `transfert ${id} : ${error?.message}`);
    return data as Row;
}

interface PendingSetup {
    ev: SaleEvent;
    title: string;
    ticketIds: string[];
    transferId: string;
}

/** Événement PUBLIE, `count` billets du porteur, transfert PENDING du premier par la route (vers le numéro du destinataire). */
async function pendingTransfer(label: string, count: number): Promise<PendingSetup> {
    const ev = await createTimedEvent(partner.partnerId, label, [{ name: 'Standard', price: 2000, total: 30, maxPerOrder: 10 }], { startsInHours: 48 });
    const { data: evRow, error: evErr } = await service.from('events').select('title').eq('id', ev.eventId).single();
    assert.equal(evErr, null, `titre de l'événement ${ev.eventId} : ${evErr?.message}`);
    const purchase = await buyConfirmed(holder, ev, [['Standard', count]]);
    const ticketIds = purchase.tickets.map((t) => String(t.id));
    assert.equal(ticketIds.length, count, `${count} billet(s) émis`);
    const { POST } = await importModule(TRANSFER_ROUTE);
    const res = await invoke(POST as Handler, authed(`/api/tickets/${ticketIds[0]}/transfer`, 'POST', holder, { recipient: recipient.phoneE164 }), paramsContext(ticketIds[0]));
    assert.equal(res.status, 200, `initiation du transfert par la route : ${show(res)}`);
    const pending = (await transfersOf(ticketIds[0])).filter((t) => t.status === 'PENDING');
    assert.equal(pending.length, 1, `précondition : un transfert PENDING du billet (${JSON.stringify(pending)})`);
    assert.equal((await ticketRow(ticketIds[0])).transfer_locked, true, 'précondition : billet verrouillé par le transfert');
    return { ev, title: String(evRow.title), ticketIds, transferId: String(pending[0].id) };
}

/**
 * Écarts à l'état attendu après l'annulation (point 2), lus par la connexion `db` (transaction en cours ou
 * lecture seule) : liste vide = transfert CANCELLED avec cancelled_at, billet déverrouillé, événement ANNULE.
 */
async function cancellationGaps(db: Client, transferId: string): Promise<string[]> {
    const { rows } = await db.query<{ status: string; has_cancelled_at: boolean; transfer_locked: boolean; event_status: string }>(
        `SELECT x.status::text AS status, x.cancelled_at IS NOT NULL AS has_cancelled_at, t.transfer_locked, e.status::text AS event_status
           FROM public.ticket_transfers x
           JOIN public.tickets t ON t.id = x.ticket_id
           JOIN public.events e ON e.id = t.event_id
          WHERE x.id = $1`, [transferId]);
    assert.equal(rows.length, 1, `transfert ${transferId} introuvable`);
    const r = rows[0];
    const gaps: string[] = [];
    if (r.status !== 'CANCELLED') gaps.push(`transfert resté ${r.status}`);
    if (!r.has_cancelled_at) gaps.push('transfert sans cancelled_at');
    if (r.transfer_locked) gaps.push('billet encore verrouillé');
    if (r.event_status !== 'ANNULE') gaps.push(`événement ${r.event_status}`);
    return gaps;
}

/** Preuve de la même transaction (point 3) : xmin du transfert et txid de la ligne CANCELLATION, instants égaux. */
async function assertSameTransaction(eventId: string, transferId: string): Promise<void> {
    const rows = await inspect(async (db) => (await db.query<{ xmin: string; txid32: string; same_instant: boolean; transfer_at: string; cancellation_at: string }>(
        `SELECT x.xmin::text AS xmin, (h.txid % 4294967296)::text AS txid32,
                (x.cancelled_at = c.cancelled_at) AS same_instant, x.cancelled_at::text AS transfer_at, c.cancelled_at::text AS cancellation_at
           FROM public.ticket_transfers x
           JOIN public.event_status_history h ON h.event_id = $2 AND h.channel = 'CANCELLATION'
           JOIN public.event_cancellations c ON c.event_id = $2
          WHERE x.id = $1`, [transferId, eventId])).rows);
    assert.equal(rows.length, 1, `une ligne CANCELLATION et une annulation pour l'événement ${eventId} (trouvé ${rows.length})`);
    const r = rows[0];
    assert.equal(r.xmin, r.txid32, `transfert révoqué hors de la transaction de l'annulation (xmin ${r.xmin}, txid de la ligne CANCELLATION ${r.txid32})`);
    assert.equal(r.same_instant, true, `cancelled_at du transfert (${r.transfer_at}) ≠ cancelled_at de l'annulation (${r.cancellation_at})`);
}

function cancelParams(setup: PendingSetup): string {
    return JSON.stringify({
        event_id: setup.ev.eventId, actor_id: partner.userId,
        public_notice: PUBLIC_NOTICE, internal_reason: INTERNAL_REASON, confirm_title: setup.title,
    });
}

const TRANSFER_CANCEL_RE = /UPDATE\s+public\.ticket_transfers\s+SET\s+status\s*=\s*'CANCELLED'[^;]*;/gi;
const TICKET_UNLOCK_RE = /UPDATE\s+public\.tickets\s+SET\s+transfer_locked\s*=\s*FALSE[^;]*;/gi;

// ── Annulation ─────────────────────────────────────────────────────────────

describe('6.0 c — event_cancel : transferts PENDING annulés et billets déverrouillés dans sa transaction', () => {
    test('PUBLIE → ANNULE : transfert CANCELLED, billet déverrouillé, même transaction ; le transfert d’un autre événement reste PENDING', async () => {
        const main = await pendingTransfer('annul-transf-principal', 2);
        const witness = await pendingTransfer('annul-transf-temoin', 1);

        await advanceEventTo(main.ev.eventId, 'ANNULE', { publicNotice: PUBLIC_NOTICE, internalReason: INTERNAL_REASON });
        assert.equal(await eventStatus(main.ev.eventId), 'ANNULE', 'événement annulé');

        const t = await transferRow(main.transferId);
        assert.equal(t.status, 'CANCELLED', `transfert après l'annulation : ${JSON.stringify(t)}`);
        assert.ok(t.cancelled_at, 'cancelled_at du transfert posé');
        for (const id of main.ticketIds) {
            assert.equal((await ticketRow(id)).transfer_locked, false, `billet ${id} encore verrouillé après l'annulation`);
        }
        assert.deepEqual(await inspect((db) => cancellationGaps(db, main.transferId)), [], 'état après l’annulation');
        await assertSameTransaction(main.ev.eventId, main.transferId);

        const w = await transferRow(witness.transferId);
        assert.equal(w.status, 'PENDING', `témoin : transfert d'un autre événement modifié (${w.status})`);
        assert.equal(w.cancelled_at, null, 'témoin : cancelled_at posé');
        assert.equal((await ticketRow(witness.ticketIds[0])).transfer_locked, true, 'témoin : billet d’un autre événement déverrouillé');
        assert.equal(await eventStatus(witness.ev.eventId), 'PUBLIE', 'témoin : événement toujours publié');
    });

    test('tout ou rien : un échec au déverrouillage annule toute l’annulation (transaction annulée)', async () => {
        const setup = await pendingTransfer('annul-transf-tout-ou-rien', 1);
        const fn = `ev_test_fail_unlock_${randomBytes(4).toString('hex')}`;
        const outcome = await inRolledBackTransaction(async (db) => {
            await db.query(`CREATE FUNCTION public.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'échec simulé'; END $$`);
            await db.query(`CREATE TRIGGER ${fn} AFTER UPDATE OF transfer_locked ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.${fn}()`);
            await db.query('SAVEPOINT s');
            let failure: string | null = null;
            let result: unknown = null;
            try {
                result = (await db.query<{ r: unknown }>('SELECT public.event_cancel($1::jsonb) AS r', [cancelParams(setup)])).rows[0].r;
            } catch (err) {
                failure = (err as Error).message;
            }
            await db.query('ROLLBACK TO SAVEPOINT s');
            const state = (await db.query<{ transfer_status: string; cancelled_at: string | null; transfer_locked: boolean; event_status: string; cancellations: string }>(
                `SELECT x.status::text AS transfer_status, x.cancelled_at::text AS cancelled_at, t.transfer_locked, e.status::text AS event_status,
                        (SELECT count(*) FROM public.event_cancellations c WHERE c.event_id = e.id)::text AS cancellations
                   FROM public.ticket_transfers x JOIN public.tickets t ON t.id = x.ticket_id JOIN public.events e ON e.id = t.event_id
                  WHERE x.id = $1`, [setup.transferId])).rows[0];
            return { failure, result, state };
        });
        assert.ok(outcome.failure, `event_cancel n'a pas échoué malgré le trigger d'échec (résultat ${JSON.stringify(outcome.result)})`);
        assert.match(outcome.failure, /échec simulé/, `échec venu d'ailleurs que le trigger temporaire : ${outcome.failure}`);
        assert.deepEqual(outcome.state, { transfer_status: 'PENDING', cancelled_at: null, transfer_locked: true, event_status: 'PUBLIE', cancellations: '0' },
            'après ROLLBACK TO SAVEPOINT : rien de l’annulation ne subsiste');
        assert.equal((await transferRow(setup.transferId)).status, 'PENDING', 'état validé hors transaction : transfert PENDING');
        assert.equal(await eventStatus(setup.ev.eventId), 'PUBLIE', 'état validé hors transaction : événement PUBLIE');
    });

    test('variante SUSPENDU → ANNULE : transfert CANCELLED, billet déverrouillé, même transaction', async () => {
        const setup = await pendingTransfer('annul-transf-suspendu', 1);
        await advanceEventTo(setup.ev.eventId, 'SUSPENDU', { suspendReason: 'Suspension de test du lot 6 (transferts)' });
        assert.equal((await transferRow(setup.transferId)).status, 'PENDING', 'précondition : la suspension laisse le transfert PENDING');
        await advanceEventTo(setup.ev.eventId, 'ANNULE', { publicNotice: PUBLIC_NOTICE, internalReason: INTERNAL_REASON });
        assert.deepEqual(await inspect((db) => cancellationGaps(db, setup.transferId)), [], 'état après l’annulation d’un événement suspendu');
        await assertSameTransaction(setup.ev.eventId, setup.transferId);
    });

    test('réclamation après l’annulation par la route POST /api/tickets/transfers/[id]/claim → 409 TRANSFER_NOT_PENDING, billet resté au porteur', async () => {
        const setup = await pendingTransfer('annul-transf-reclamation', 1);
        await advanceEventTo(setup.ev.eventId, 'ANNULE', { publicNotice: PUBLIC_NOTICE, internalReason: INTERNAL_REASON });
        await markPhoneVerified(recipient.userId);
        const mod = await loadLotModule(CLAIM_ROUTE, 'route de réclamation d’un transfert par identifiant (contrat B4)');
        assert.equal(typeof mod.POST, 'function', 'app/api/tickets/transfers/[id]/claim/route.ts : POST non exporté (contrat B4)');
        const res = await invoke(mod.POST as Handler, authed(`/api/tickets/transfers/${setup.transferId}/claim`, 'POST', recipient, {}), paramsContext(setup.transferId));
        assert.equal(res.status, 409, show(res));
        assert.equal(res.body.code, 'TRANSFER_NOT_PENDING', show(res));
        assert.equal(res.body.error, 'Ce transfert n\'est plus en attente.', show(res));
        const t = await transferRow(setup.transferId);
        assert.equal(t.status, 'CANCELLED', `transfert après la tentative : ${t.status}`);
        assert.equal(t.to_user_id ?? null, null, 'transfert attribué au destinataire');
        assert.equal((await ticketRow(setup.ticketIds[0])).user_id, holder.userId, 'billet passé au destinataire malgré l’annulation');
    });
});

// ── Garde-fou ──────────────────────────────────────────────────────────────

describe('6.0 c — garde-fou : la vérification détecte une annulation qui ne révoque plus les transferts', () => {
    test('copie de event_cancel sans les deux UPDATE (transaction annulée) : transfert resté PENDING et billet verrouillé relevés ; contre-épreuve hors transaction', async () => {
        const setup = await pendingTransfer('annul-transf-garde-fou', 1);
        const detected = await inRolledBackTransaction(async (db) => {
            const def = (await db.query<{ def: string }>("SELECT pg_get_functiondef('public.event_cancel(jsonb)'::regprocedure) AS def")).rows[0].def;
            const transferStatements = def.match(TRANSFER_CANCEL_RE) ?? [];
            const unlockStatements = def.match(TICKET_UNLOCK_RE) ?? [];
            assert.equal(transferStatements.length + unlockStatements.length, 2,
                `garde-fou inopérant : la substitution doit retirer exactement 2 instructions (trouvé ${transferStatements.length} UPDATE ticket_transfers, ${unlockStatements.length} UPDATE tickets.transfer_locked)`);
            assert.equal(transferStatements.length, 1, 'une instruction UPDATE public.ticket_transfers … CANCELLED');
            assert.equal(unlockStatements.length, 1, 'une instruction UPDATE public.tickets SET transfer_locked = FALSE');
            const broken = def.replace(TRANSFER_CANCEL_RE, '/* garde-fou : révocation retirée */').replace(TICKET_UNLOCK_RE, '/* garde-fou : déverrouillage retiré */');
            await db.query(broken);
            const result = (await db.query<{ r: { ok?: boolean } }>('SELECT public.event_cancel($1::jsonb) AS r', [cancelParams(setup)])).rows[0].r;
            assert.equal(result?.ok, true, `annulation par la copie refusée : ${JSON.stringify(result)}`);
            return cancellationGaps(db, setup.transferId);
        });
        assert.ok(detected.includes('transfert resté PENDING'), `la vérification ne relève pas le transfert resté PENDING : ${JSON.stringify(detected)}`);
        assert.ok(detected.includes('billet encore verrouillé'), `la vérification ne relève pas le billet verrouillé : ${JSON.stringify(detected)}`);
        assert.ok(!detected.some((g) => g.startsWith('événement')), `la copie n'a pas annulé l'événement : ${JSON.stringify(detected)}`);

        assert.equal((await transferRow(setup.transferId)).status, 'PENDING', 'transaction annulée : transfert toujours PENDING');
        await advanceEventTo(setup.ev.eventId, 'ANNULE', { publicNotice: PUBLIC_NOTICE, internalReason: INTERNAL_REASON });
        assert.deepEqual(await inspect((db) => cancellationGaps(db, setup.transferId)), [], 'contre-épreuve : la vraie fonction révoque et déverrouille');
    });
});
