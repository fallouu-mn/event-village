/**
 * Correctifs de la contre-vérification de la finition 1 — T1 en base (migration 20261115000013) : aucune affectation de
 * contrôleur n'est créée pour un compte ADMIN ou SUPERADMIN, quel que soit le chemin. Même texte neutre que la route.
 *  a. controller_assignments_sync : ajouter un événement à un compte d'administration (contrôleur de l'organisatrice
 *     devenu admin, donc connu d'elle) → refus NOT_INVITABLE, texte neutre, rien d'écrit. Depuis la migration 14, la
 *     promotion retire elle-même ses affectations (tests cvf1c-t1-promotion) : le témoin « droit d'encaisser et retrait
 *     d'un compte d'administration encore affecté » n'a plus de cas à construire et il est retiré (signalé au rapport).
 *  b. Garde de la table event_controllers : insertion directe par le service_role (comme la route d'invitation, les
 *     seeds ou toute fonction future), ou ligne passée à un compte d'administration → refus CT409 au texte neutre ; un
 *     contrôleur ordinaire s'affecte toujours.
 *  c. POST /api/partner/team/invite (écriture directe de la table) : le compte devient admin pendant la demande (table
 *     verrouillée, rôle validé pendant l'attente) → 409 NOT_INVITABLE au texte neutre, aucune affectation.
 *  d. PATCH /api/partner/team/assignments (controller_assignments_sync) : même course → 409 neutre, aucune affectation.
 *  (e, acceptation pendant la promotion : depuis la migration 14, l'acceptation verrouille d'abord le compte et la
 *   promotion annule l'invitation ; la course est éprouvée dans cvf1c-t1-promotion, cas e. Retiré d'ici, signalé.)
 * Rouge avant le correctif : a et b écrivent l'affectation ; c et d la créent (201, 200).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { newController } from './acces-helpers';
import { newAdmin } from './notif-helpers';
import { openConcurrentClient, waitForLockWaiters } from '../helpers/db';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { addRole, api, assignmentOf, freeEvent, show, type Reply, type Row } from '../audit/cvf1-helpers';

const NOT_INVITABLE_TEXT = 'Ce numéro ne peut pas être invité comme contrôleur. Choisissez une autre personne.';

let P: TestPartner;
let ev1: SaleEvent;
let ev2: SaleEvent;
let ev3: SaleEvent;

before(async () => {
    P = await newPartner('cvf1c-t1b');
    ev1 = await freeEvent(P, 'cvf1c-t1b-1', { startsInHours: 48 });
    ev2 = await freeEvent(P, 'cvf1c-t1b-2', { startsInHours: 48 });
    ev3 = await freeEvent(P, 'cvf1c-t1b-3', { startsInHours: 48 });
});

after(async () => {
    await assertFinition1Invariants('cvf1c-t1-affectations-base');
});

/** Contrôleur de P (affecté à ev1, donc connu d'elle) devenu compte d'administration. */
async function controllerTurnedStaff(label: string, role: 'ADMIN' | 'SUPERADMIN'): Promise<Buyer> {
    const c = await newController(P, ev1.eventId, { label });
    await addRole(c.userId, role);
    return c;
}

async function sync(controllerId: string, assignments: Array<{ event_id: string; can_accept_cash: boolean | null }>): Promise<Row> {
    const { data, error } = await service.rpc('controller_assignments_sync', {
        p: { actor_id: P.userId, actor_role: 'PARTENAIRE', controller_id: controllerId, partner_id: P.partnerId, assignments },
    });
    assert.equal(error, null, `controller_assignments_sync : ${error?.message}`);
    return data as Row;
}

/**
 * La table event_controllers est verrouillée par une transaction concurrente ; `start` lance la demande, qui attend le
 * verrou au moment d'écrire l'affectation (requête contenant `waitingOn`). Pendant l'attente, le compte reçoit le rôle
 * ADMIN dans cette même transaction, validée ensuite : la demande reprend avec un compte devenu admin, après les
 * vérifications faites avant l'écriture.
 */
async function raceToStaff(userId: string, waitingOn: string, start: () => Promise<Reply>, label: string): Promise<Reply> {
    const tx = await openConcurrentClient({ applicationName: `cvf1c-t1b-${label}` });
    try {
        await tx.query('LOCK TABLE public.event_controllers IN SHARE ROW EXCLUSIVE MODE');
        const pending = start();
        try {
            const waiters = await waitForLockWaiters({ queryLike: waitingOn }, 8_000);
            console.log(`[CVF1C-T1B] ${label} : écriture en attente du verrou (${waiters.map((w) => `pid ${w.pid}`).join(', ')})`);
        } catch (err) {
            console.log(`[CVF1C-T1B] ${label} : aucune attente de verrou observée (${err instanceof Error ? err.message.slice(0, 200) : String(err)})`);
        }
        await tx.query(`INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'ADMIN') ON CONFLICT (user_id, role) DO NOTHING`, [userId]);
        await tx.commit();
        const reply = await pending;
        console.log(`[CVF1C-T1B] ${label} : compte devenu admin pendant la demande → ${show(reply)}`);
        return reply;
    } finally {
        await tx.close();
    }
}

function assertNeutral(r: Reply, what: string): void {
    assert.equal(r.status, 409, `${what} : statut (${show(r)})`);
    assert.equal(r.body.code, 'NOT_INVITABLE', `${what} : code (${show(r)})`);
    assert.equal(r.body.error, NOT_INVITABLE_TEXT, `${what} : texte (${show(r)})`);
}

describe('T1 base a. controller_assignments_sync', () => {
    for (const role of ['ADMIN', 'SUPERADMIN'] as const) {
        test(`${role} : aucun événement ajouté, texte neutre`, async () => {
            const a = await controllerTurnedStaff(`cvf1c-t1b-sync-${role.toLowerCase()}`, role);
            const reply = await sync(a.userId, [{ event_id: ev1.eventId, can_accept_cash: false }, { event_id: ev2.eventId, can_accept_cash: false }]);
            console.log(`[CVF1C-T1B] ${role} : controller_assignments_sync avec un événement de plus → ${JSON.stringify(reply)}`);
            assert.equal(reply.ok, false, `${role} : événement ajouté à un compte d'administration (${JSON.stringify(reply)})`);
            assert.equal(reply.code, 'NOT_INVITABLE', JSON.stringify(reply));
            assert.equal(reply.message, NOT_INVITABLE_TEXT, JSON.stringify(reply));
            assert.equal(await assignmentOf(ev2.eventId, a.userId), null, `${role} : affecté à ev2`);
            // Migration 14 : la promotion a retiré l'affectation d'avant (ev1) ; le refus n'en ajoute aucune
            assert.equal(await assignmentOf(ev1.eventId, a.userId), null, `${role} : affectation d'avant (ev1) gardée par la promotion`);
        });
    }
});

describe('T1 base b. garde de la table event_controllers', () => {
    for (const role of ['ADMIN', 'SUPERADMIN'] as const) {
        test(`${role} : insertion directe refusée (CT409, texte neutre)`, async () => {
            const admin = await newAdmin(`cvf1c-t1b-direct-${role.toLowerCase()}`, [], { role });
            const { error } = await service.from('event_controllers')
                .insert({ event_id: ev1.eventId, user_id: admin.userId, created_by: P.userId, can_accept_cash: false });
            console.log(`[CVF1C-T1B] ${role} : insertion directe → ${error ? `refus ${error.code} ${error.message}` : 'ACCEPTÉE'}`);
            assert.ok(error, `${role} : affectation directe d'un compte d'administration acceptée`);
            assert.equal(error.code, 'CT409', `${role} : code (${error.code} ${error.message})`);
            assert.equal(error.message, NOT_INVITABLE_TEXT, `${role} : texte`);
            assert.equal(await assignmentOf(ev1.eventId, admin.userId), null, `${role} : affecté`);
        });
    }

    test('ligne passée à un compte d’administration : refusée ; un contrôleur ordinaire s’affecte toujours', async () => {
        const admin = await newAdmin('cvf1c-t1b-titulaire', []);
        const c = await newController(P, ev3.eventId, { label: 'cvf1c-t1b-titulaire' });
        const row = await assignmentOf(ev3.eventId, c.userId);
        assert.ok(row, 'affectation du contrôleur ordinaire (témoin) refusée');
        const { error } = await service.from('event_controllers').update({ user_id: admin.userId }).eq('id', String(row.id));
        console.log(`[CVF1C-T1B] ligne passée à un admin → ${error ? `refus ${error.code} ${error.message}` : 'ACCEPTÉE'}`);
        assert.ok(error, 'affectation passée à un compte d’administration');
        assert.equal(error.code, 'CT409', `${error.code} ${error.message}`);
        assert.equal(error.message, NOT_INVITABLE_TEXT);
        assert.equal(await assignmentOf(ev3.eventId, admin.userId), null, 'compte d’administration affecté');
        assert.ok(await assignmentOf(ev3.eventId, c.userId), 'affectation du contrôleur ordinaire perdue');
    });
});

describe('T1 base c, d. compte devenu admin pendant la demande', () => {
    test('c. invitation (écriture directe de la table) : 409 neutre, aucune affectation', async () => {
        const k = await newController(P, ev1.eventId, { label: 'cvf1c-t1b-invite' });
        const reply = await raceToStaff(k.userId, 'event_controllers',
            () => api('POST', 'partner/team/invite', { token: P.accessToken, body: { event_ids: [ev2.eventId], phone: k.phoneE164 } }), 'invitation');
        assertNeutral(reply, 'invitation');
        assert.equal(await assignmentOf(ev2.eventId, k.userId), null, 'compte devenu admin affecté par l’invitation');
    });

    test('d. événements du contrôleur (controller_assignments_sync) : 409 neutre, aucune affectation', async () => {
        const k = await newController(P, ev1.eventId, { label: 'cvf1c-t1b-patch' });
        const reply = await raceToStaff(k.userId, 'controller_assignments_sync',
            () => api('PATCH', 'partner/team/assignments', {
                token: P.accessToken,
                body: { controller_id: k.userId, assignments: [{ event_id: ev1.eventId, can_accept_cash: false }, { event_id: ev2.eventId, can_accept_cash: false }] },
            }), 'événements du contrôleur');
        assertNeutral(reply, 'événements du contrôleur');
        assert.equal(await assignmentOf(ev2.eventId, k.userId), null, 'compte devenu admin affecté à ev2');
        // Migration 14 : la promotion pendant la demande a retiré l'affectation d'avant (ev1)
        assert.equal(await assignmentOf(ev1.eventId, k.userId), null, 'affectation d’avant (ev1) gardée par la promotion');
    });
});
