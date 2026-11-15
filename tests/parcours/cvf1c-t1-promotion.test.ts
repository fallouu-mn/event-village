/**
 * Correctifs de la contre-vérification de la finition 1 — un contrôleur qui devient compte d'administration (ADMIN ou
 * SUPERADMIN), par la page des comptes ou par toute autre voie qui donne ce rôle (migration 20261115000014). Décision de
 * l'utilisateur :
 *  a. caisse ouverte sur un événement : promotion refusée, rien ne change, texte « Cette personne a une caisse ouverte
 *     sur « {événement} ». Elle doit la fermer avec l’organisatrice avant de devenir administrateur. » (route, fonction
 *     user_roles_set et écriture directe du rôle) ;
 *  b. sinon, confirmation avant d'enregistrer : « Cette personne contrôle les entrées pour {n} organisateur(s). En
 *     devenant administrateur, elle sera retirée de leurs équipes. » (accord au singulier) ; rien ne change ;
 *  c. après confirmation, dans la même transaction : affectations retirées, rôle CONTROLEUR retiré, invitations en
 *     attente annulées, sessions révoquées (le scanner resté ouvert est refusé), journal, avis à chaque organisatrice
 *     concernée (cloche, push, email ; aucun SMS, aucun avis de retrait au compte promu) ; scans et caisses passés intacts
 *     (entrées, caisse, « Mes soirées ») ;
 *  d. toute autre voie qui donne le rôle (écriture du rôle par le serveur, comme l'amorçage du superadmin) fait de même ;
 *  e. promotion et invitation simultanées, dans les deux ordres (acceptation, affectation directe, nouvelle invitation,
 *     affectation déjà en cours) : aucun compte d'administration ne garde d'affectation (invariant f5).
 * Rouge avant le correctif : la promotion garde les affectations et le rôle, sans confirmation ni avis ; les courses
 * laissent une affectation au compte d'administration.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newBuyer, service, type SaleEvent } from './paiement-helpers';
import { newPartner, superadminId, type TestPartner } from './finance-helpers';
import { newController, openShift } from './acces-helpers';
import { outboxRows } from './notif-helpers';
import { signInAs } from '../helpers/fixtures';
import { openConcurrentClient, waitForLockWaiters } from '../helpers/db';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import {
    addRole, api, assignmentOf, freeEvent, freeTicket, rolesOf, scanTicket, show, type Reply, type Row,
} from '../audit/cvf1-helpers';

const NOT_INVITABLE_TEXT = 'Ce numéro ne peut pas être invité comme contrôleur. Choisissez une autre personne.';

function openShiftText(title: string): string {
    return `Cette personne a une caisse ouverte sur « ${title} ». Elle doit la fermer avec l’organisatrice avant de devenir administrateur.`;
}

function confirmText(n: number): string {
    return n === 1
        ? 'Cette personne contrôle les entrées pour 1 organisateur. En devenant administrateur, elle sera retirée de son équipe.'
        : `Cette personne contrôle les entrées pour ${n} organisateurs. En devenant administrateur, elle sera retirée de leurs équipes.`;
}

let SA: { accessToken: string };
let superId: string;
let P1: TestPartner;
let P2: TestPartner;
let P3: TestPartner;
let ev1: SaleEvent;
let ev1b: SaleEvent;
let ev2: SaleEvent;
let ev3: SaleEvent;

before(async () => {
    SA = await signInAs('SUPERADMIN');
    superId = await superadminId();
    P1 = await newPartner('cvf1c-pro-1');
    P2 = await newPartner('cvf1c-pro-2');
    P3 = await newPartner('cvf1c-pro-3');
    ev1 = await freeEvent(P1, 'cvf1c-pro-1', { startsInHours: 48 });
    ev1b = await freeEvent(P1, 'cvf1c-pro-1b', { startsInHours: 48 });
    ev2 = await freeEvent(P2, 'cvf1c-pro-2', { startsInHours: 48 });
    ev3 = await freeEvent(P3, 'cvf1c-pro-3', { startsInHours: 48 });
});

after(async () => {
    await assertFinition1Invariants('cvf1c-t1-promotion');
});

async function titleOf(eventId: string): Promise<string> {
    const { data, error } = await service.from('events').select('title').eq('id', eventId).single();
    assert.equal(error, null, `titre de ${eventId} : ${error?.message}`);
    return String(data!.title);
}

async function assignmentsOf(userId: string): Promise<string[]> {
    const { data, error } = await service.from('event_controllers').select('event_id').eq('user_id', userId);
    assert.equal(error, null, `affectations de ${userId} : ${error?.message}`);
    return (data ?? []).map((r) => String(r.event_id)).sort();
}

async function pendingInvitation(partner: TestPartner, userId: string, eventId: string): Promise<string> {
    const { data, error } = await service.from('controller_invitations').insert({
        partner_id: partner.partnerId, user_id: userId, created_by: partner.userId,
        assignments: [{ event_id: eventId, can_accept_cash: false }],
    }).select('id').single();
    assert.equal(error, null, `invitation en attente (montage) : ${error?.message}`);
    return String(data!.id);
}

async function invitationStatus(id: string): Promise<Row> {
    const { data, error } = await service.from('controller_invitations').select('status, responded_at, cancelled_by').eq('id', id).single();
    assert.equal(error, null, `invitation ${id} : ${error?.message}`);
    return data as Row;
}

function promote(userId: string, extra: Row = {}): Promise<Reply> {
    return api('PATCH', 'admin/users', { token: SA.accessToken, body: { userId, roles: ['ADMIN'], ...extra } });
}

async function rpcRow(name: string, p: Row): Promise<Row> {
    const { data, error } = await service.rpc(name, { p });
    assert.equal(error, null, `${name} : ${error?.message}`);
    return (data ?? {}) as Row;
}

async function figures(userId: string, eventId: string): Promise<unknown> {
    const { data, error } = await service.rpc('controller_evening_figures', { p_user: userId, p_event: eventId });
    assert.equal(error, null, `controller_evening_figures : ${error?.message}`);
    return data;
}

async function countRows(table: string, column: string, userId: string): Promise<number> {
    const { count, error } = await service.from(table).select('id', { count: 'exact', head: true }).eq(column, userId);
    assert.equal(error, null, `${table} : ${error?.message}`);
    return count ?? 0;
}

/** Avis « devenu administrateur » reçus par l'organisatrice pour ce compte (clé : type, organisatrice, compte). */
async function becameAdminNotices(partner: TestPartner, controllerId: string): Promise<Row[]> {
    const rows = (await outboxRows({ type: 'CONTROLLER_BECAME_ADMIN', userId: partner.userId })) as unknown as Row[];
    return rows.filter((r) => String(r.idempotency_key).includes(controllerId));
}

function checkTeamChannels(rows: Row[], what: string): void {
    const channels = new Set(rows.map((r) => String(r.channel)));
    assert.ok(channels.has('IN_APP'), `${what} : cloche absente (${[...channels].join(', ')})`);
    assert.ok(!channels.has('SMS'), `${what} : SMS envoyé`);
    for (const ch of channels) assert.ok(['IN_APP', 'PUSH', 'EMAIL'].includes(ch), `${what} : canal ${ch}`);
}

describe('a. caisse ouverte : promotion refusée, rien ne change', () => {
    test('route, fonction et écriture directe du rôle : refus au texte exact', async () => {
        const evOpen = await freeEvent(P1, 'cvf1c-pro-caisse', { startsInHours: 1 });
        const title = await titleOf(evOpen.eventId);
        const c = await newController(P1, evOpen.eventId, { canAcceptCash: true, label: 'cvf1c-pro-caisse' });
        const opened = await openShift(c, evOpen.eventId);
        assert.equal(opened.status, 200, `ouverture de caisse (montage) : ${JSON.stringify(opened.body)}`);
        const before = await rolesOf(c.userId);

        const viaRoute = await promote(c.userId, { confirm_staff_promotion: true });
        console.log(`[CVF1C-PRO] caisse ouverte, page des comptes → ${show(viaRoute)}`);
        assert.equal(viaRoute.status, 409, show(viaRoute));
        assert.equal(viaRoute.body.code, 'CONTROLLER_HAS_OPEN_SHIFT', show(viaRoute));
        assert.equal(viaRoute.body.error, openShiftText(title), show(viaRoute));

        const viaRpc = await rpcRow('user_roles_set', { user_id: c.userId, roles: ['CLIENT', 'ADMIN'], actor_id: superId });
        assert.equal(viaRpc.ok, false, JSON.stringify(viaRpc));
        assert.equal(viaRpc.code, 'CONTROLLER_HAS_OPEN_SHIFT', JSON.stringify(viaRpc));
        assert.equal(viaRpc.message, openShiftText(title), JSON.stringify(viaRpc));

        const { error } = await service.from('user_roles').upsert([{ user_id: c.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
        console.log(`[CVF1C-PRO] caisse ouverte, écriture directe du rôle → ${error ? `refus ${error.code} ${error.message}` : 'ACCEPTÉE'}`);
        assert.ok(error, 'rôle ADMIN accordé malgré la caisse ouverte');
        assert.equal(error.message, openShiftText(title));

        assert.deepEqual(await rolesOf(c.userId), before, 'rôles changés malgré le refus');
        assert.deepEqual(await assignmentsOf(c.userId), [evOpen.eventId], 'affectation retirée malgré le refus');
    });
});

describe('b, c. confirmation puis promotion', () => {
    test('b. confirmation demandée (pluriel et singulier) ; rien ne change', async () => {
        const two = await newController(P1, ev1.eventId, { label: 'cvf1c-pro-deux' });
        const { error: aErr } = await service.from('event_controllers').insert({ event_id: ev2.eventId, user_id: two.userId, created_by: P2.userId, can_accept_cash: false });
        assert.equal(aErr, null, `affectation chez P2 (montage) : ${aErr?.message}`);
        const ask = await promote(two.userId);
        console.log(`[CVF1C-PRO] deux organisatrices, sans confirmation → ${show(ask)}`);
        assert.equal(ask.status, 200, show(ask));
        assert.equal(ask.body.requires_confirmation, true, show(ask));
        assert.equal(ask.body.code, 'STAFF_PROMOTION_CONFIRMATION', show(ask));
        assert.equal(ask.body.message, confirmText(2), show(ask));
        assert.deepEqual(await rolesOf(two.userId), ['CLIENT', 'CONTROLEUR'], 'rôles changés avant la confirmation');
        assert.equal((await assignmentsOf(two.userId)).length, 2, 'affectations retirées avant la confirmation');

        const one = await newController(P1, ev1.eventId, { label: 'cvf1c-pro-une' });
        const askOne = await promote(one.userId);
        assert.equal(askOne.body.message, confirmText(1), show(askOne));
    });

    test('c. promotion confirmée : tout retiré dans la même transaction, passé intact, avis sans SMS', async () => {
        const evPast = await freeEvent(P1, 'cvf1c-pro-passe', { startsInHours: -3, durationHours: 1 });
        const c = await newController(P1, evPast.eventId, { canAcceptCash: true, label: 'cvf1c-pro-promu' });
        await addRole(c.userId, 'CLIENT');
        // Soirée passée : une entrée validée et une caisse ouverte puis fermée
        const holder = await newBuyer('cvf1c-pro-porteur');
        const t = await freeTicket(evPast, holder);
        const sc = await scanTicket(c, evPast.eventId, t.id);
        assert.equal(sc.status, 200, `scan (montage) : ${show(sc)}`);
        assert.equal(sc.body.result, 'valid', `scan (montage) : ${show(sc)}`);
        const opened = await openShift(c, evPast.eventId);
        assert.equal(opened.status, 200, `caisse (montage) : ${JSON.stringify(opened.body)}`);
        const shiftId = String((opened.body.shift as Row).id);
        const { data: shift } = await service.from('controller_shifts').select('expected_cash_total').eq('id', shiftId).single();
        const closed = await api('POST', 'controller/shifts/close', { token: c.accessToken, body: { shiftId, declaredCashTotal: Number(shift!.expected_cash_total ?? 0) } });
        assert.equal(closed.status, 200, `fermeture de caisse (montage) : ${show(closed)}`);
        // Équipes de P1 (ev1) et de P2 (ev2) ; invitation en attente de P3
        await service.from('event_controllers').insert([
            { event_id: ev1.eventId, user_id: c.userId, created_by: P1.userId, can_accept_cash: false },
            { event_id: ev2.eventId, user_id: c.userId, created_by: P2.userId, can_accept_cash: false },
        ]).then(({ error }) => assert.equal(error, null, `affectations (montage) : ${error?.message}`));
        const invP3 = await pendingInvitation(P3, c.userId, ev3.eventId);

        const evBefore = await rpcRow('controller_evenings', { user_id: c.userId });
        const figBefore = await figures(c.userId, evPast.eventId);
        const scansBefore = await countRows('ticket_scans', 'scanner_id', c.userId);
        const shiftsBefore = (await service.from('controller_shifts').select('*').eq('controller_id', c.userId)).data;
        const unassignedBefore = (await outboxRows({ type: 'CONTROLLER_UNASSIGNED', userId: c.userId })).length;
        const smsBefore = (await outboxRows({ userId: c.userId, channel: 'SMS' })).length;

        const done = await promote(c.userId, { confirm_staff_promotion: true });
        console.log(`[CVF1C-PRO] promotion confirmée → ${show(done)}`);
        assert.equal(done.status, 200, show(done));

        assert.deepEqual(await rolesOf(c.userId), ['ADMIN', 'CLIENT'], 'rôles après la promotion');
        assert.deepEqual(await assignmentsOf(c.userId), [], 'affectations restantes');
        const inv = await invitationStatus(invP3);
        assert.equal(inv.status, 'CANCELLED', `invitation de P3 : ${JSON.stringify(inv)}`);
        assert.ok(inv.responded_at, 'invitation annulée sans date');
        assert.equal(inv.cancelled_by, superId, 'auteur de l’annulation');

        const scanAfter = await scanTicket(c, ev1.eventId, t.id);
        console.log(`[CVF1C-PRO] scanner resté ouvert après la promotion → ${show(scanAfter)}`);
        assert.equal(scanAfter.status, 401, `scanner resté ouvert : ${show(scanAfter)}`);

        const { data: audit } = await service.from('audit_logs').select('user_id, action, old_value, metadata')
            .eq('object_id', c.userId).eq('action', 'CONTROLLER_REMOVED_FOR_ADMIN');
        assert.equal((audit ?? []).length, 1, `journal : ${JSON.stringify(audit)}`);
        assert.equal(audit![0].user_id, superId, 'auteur au journal');
        const meta = audit![0].metadata as Row;
        assert.deepEqual(((meta.partner_ids as string[]) ?? []).slice().sort(), [P1.partnerId, P2.partnerId].sort(), JSON.stringify(meta));
        assert.equal(meta.invitations_cancelled, 1, JSON.stringify(meta));

        for (const [p, what] of [[P1, 'P1'], [P2, 'P2']] as const) {
            const rows = await becameAdminNotices(p, c.userId);
            checkTeamChannels(rows, `avis à ${what}`);
            assert.ok(JSON.stringify(rows).includes(`${c.firstName} ${c.lastName}`), `${what} : nom du contrôleur dans l’avis`);
        }
        assert.equal((await becameAdminNotices(P3, c.userId)).length, 0, 'P3 (invitation seule) prévenue comme une équipe');
        assert.equal((await outboxRows({ type: 'CONTROLLER_UNASSIGNED', userId: c.userId })).length, unassignedBefore, 'avis de retrait envoyé au compte promu');
        assert.equal((await outboxRows({ userId: c.userId, channel: 'SMS' })).length, smsBefore, 'SMS envoyé au compte promu');

        assert.deepEqual(await rpcRow('controller_evenings', { user_id: c.userId }), evBefore, '« Mes soirées » changée');
        assert.deepEqual(await figures(c.userId, evPast.eventId), figBefore, 'entrées et caisse de la soirée passée changées');
        assert.equal(await countRows('ticket_scans', 'scanner_id', c.userId), scansBefore, 'scans du compte changés');
        assert.deepEqual((await service.from('controller_shifts').select('*').eq('controller_id', c.userId)).data, shiftsBefore, 'caisses du compte changées');
    });
});

describe('d. autre voie qui donne le rôle (écriture par le serveur, comme l’amorçage du superadmin)', () => {
    test('SUPERADMIN accordé directement : même nettoyage, avis à l’organisatrice', async () => {
        const d = await newController(P2, ev2.eventId, { label: 'cvf1c-pro-amorcage' });
        const { error } = await service.from('user_roles').upsert([{ user_id: d.userId, role: 'SUPERADMIN' }], { onConflict: 'user_id,role' });
        assert.equal(error, null, `rôle SUPERADMIN : ${error?.message}`);
        assert.deepEqual(await assignmentsOf(d.userId), [], 'affectation gardée');
        assert.ok(!(await rolesOf(d.userId)).includes('CONTROLEUR'), 'rôle CONTROLEUR gardé');
        const rows = await becameAdminNotices(P2, d.userId);
        checkTeamChannels(rows, 'avis à P2');
        const { data: audit } = await service.from('audit_logs').select('user_id').eq('object_id', d.userId).eq('action', 'CONTROLLER_REMOVED_FOR_ADMIN');
        assert.equal((audit ?? []).length, 1, `journal : ${JSON.stringify(audit)}`);
    });
});

describe('e. promotion et invitation simultanées', () => {
    /** Promotion par user_roles_set dans une transaction concurrente, validée quand la demande attend son verrou. */
    async function duringPromotion(userId: string, waitingOn: string, start: () => Promise<Reply>, label: string): Promise<Reply> {
        const tx = await openConcurrentClient({ applicationName: `cvf1c-pro-${label}` });
        try {
            const { rows } = await tx.query<{ r: Row }>('SELECT public.user_roles_set($1::jsonb) AS r',
                [JSON.stringify({ user_id: userId, roles: ['CLIENT', 'ADMIN'], actor_id: superId })]);
            assert.equal(rows[0].r.ok, true, `promotion (transaction concurrente) : ${JSON.stringify(rows[0].r)}`);
            const pending = start();
            try {
                const w = await waitForLockWaiters({ queryLike: waitingOn }, 8_000);
                console.log(`[CVF1C-PRO] ${label} : demande en attente de la promotion (${w.map((x) => `pid ${x.pid}`).join(', ')})`);
            } catch (err) {
                console.log(`[CVF1C-PRO] ${label} : aucune attente observée (${err instanceof Error ? err.message.slice(0, 200) : String(err)})`);
            }
            await tx.commit();
            const reply = await pending;
            console.log(`[CVF1C-PRO] ${label} → ${show(reply)}`);
            return reply;
        } finally {
            await tx.close();
        }
    }

    test('acceptation pendant la promotion : refusée, aucune affectation', async () => {
        const e = await newController(P2, ev2.eventId, { label: 'cvf1c-pro-accepte' });
        await addRole(e.userId, 'CLIENT');
        const id = await pendingInvitation(P3, e.userId, ev3.eventId);
        const reply = await duringPromotion(e.userId, 'controller_invitation_respond', () => api('POST', 'account/controller-invitations/[id]', {
            token: e.accessToken, path: `/api/account/controller-invitations/${id}`, params: { id }, body: { accept: true },
        }), 'acceptation');
        assert.ok(reply.status >= 400, `acceptée pendant la promotion : ${show(reply)}`);
        assert.deepEqual(await assignmentsOf(e.userId), [], 'affectation au compte d’administration');
        assert.equal((await invitationStatus(id)).status, 'CANCELLED', 'invitation non annulée');
    });

    test('affectation directe (invitation d’un contrôleur déjà connu) pendant la promotion : 409 neutre', async () => {
        const f = await newController(P1, ev1.eventId, { label: 'cvf1c-pro-connu' });
        const reply = await duringPromotion(f.userId, 'event_controllers',
            () => api('POST', 'partner/team/invite', { token: P1.accessToken, body: { event_ids: [ev1b.eventId], phone: f.phoneE164 } }), 'affectation directe');
        assert.equal(reply.status, 409, show(reply));
        assert.equal(reply.body.code, 'NOT_INVITABLE', show(reply));
        assert.equal(reply.body.error, NOT_INVITABLE_TEXT, show(reply));
        assert.deepEqual(await assignmentsOf(f.userId), [], 'affectation au compte d’administration');
    });

    test('nouvelle invitation pendant la promotion : 409 neutre, aucune invitation en attente', async () => {
        const h = await newController(P1, ev1.eventId, { label: 'cvf1c-pro-nouvelle' });
        const reply = await duringPromotion(h.userId, 'controller_invitation_create',
            () => api('POST', 'partner/team/invite', { token: P3.accessToken, body: { event_ids: [ev3.eventId], phone: h.phoneE164, confirm_promotion: true } }), 'nouvelle invitation');
        assert.equal(reply.status, 409, show(reply));
        assert.equal(reply.body.code, 'NOT_INVITABLE', show(reply));
        const { data } = await service.from('controller_invitations').select('id').eq('user_id', h.userId).eq('status', 'PENDING');
        assert.equal((data ?? []).length, 0, 'invitation en attente pour un compte d’administration');
    });

    test('affectation en cours quand la promotion commence : la promotion attend puis la retire', async () => {
        const g = await newController(P1, ev1.eventId, { label: 'cvf1c-pro-inverse' });
        const tx = await openConcurrentClient({ applicationName: 'cvf1c-pro-inverse' });
        let reply: Reply;
        try {
            await tx.query('INSERT INTO public.event_controllers (event_id, user_id, created_by, can_accept_cash) VALUES ($1, $2, $3, false)',
                [ev1b.eventId, g.userId, P1.userId]);
            const pending = promote(g.userId, { confirm_staff_promotion: true });
            try {
                await waitForLockWaiters({ queryLike: 'user_roles_set' }, 8_000);
                console.log('[CVF1C-PRO] promotion en attente de l’affectation en cours');
            } catch (err) {
                console.log(`[CVF1C-PRO] promotion : aucune attente observée (${err instanceof Error ? err.message.slice(0, 200) : String(err)})`);
            }
            await tx.commit();
            reply = await pending;
        } finally {
            await tx.close();
        }
        console.log(`[CVF1C-PRO] affectation puis promotion → ${show(reply)}`);
        assert.equal(reply.status, 200, show(reply));
        assert.deepEqual(await assignmentsOf(g.userId), [], 'affectation validée pendant la promotion gardée');
    });
});
