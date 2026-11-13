/**
 * Lot 9 bis, tâche 11 (R2 ; contrat 5.11, B30, B31, 4.2) — les adresses réservées à la partenaire n'acceptent que la
 * propriétaire, ou un admin qui a la permission de l'action : events.read pour lire (pilotage, avancement d'annulation,
 * invitations, fiche, équipe, caisses, promotion), events.write pour écrire (valider, suspendre, annuler, PIN, équipe,
 * droit d'encaisser), refunds.manage pour rembourser et chercher un billet, partners.read pour l'export avec contacts.
 *
 * Matrice à six acteurs sur chaque adresse marquée ✗ au tableau D-dro 1.2, corps valide :
 *  - sans session : 401 ;
 *  - client porteur d'un billet de l'événement, partenaire B : refus actuel (403 ou 404), sans effet ni donnée de A ;
 *    deux exceptions écrites telles quelles : team/all (GET, DELETE) et team/assignments, où B agit sur sa propre équipe
 *    (200 admis) sans rien voir ni toucher de A ;
 *  - ADMIN sans aucune permission, puis ADMIN muni d'AUTRES permissions (témoin de minimalité) : 403 PERMISSION_MISSING
 *    avec `permission` dans le corps (transition et annulation : 403 TRANSITION_NOT_ALLOWED admis, `role_missing` de la
 *    RPC), sans effet ;
 *  - ADMIN muni de la SEULE permission attendue, puis SUPERADMIN : succès et effet vérifié en base.
 * Puis les RPC directes : event_transition, event_cancel, pilotage_access, event_actions, participants_export,
 * event_controller_set_cash (acteur passé en paramètre, RPC réservées au service_role).
 *
 * Choix d'écriture (contrat muet, signalés) :
 *  - PATCH /api/partner/team/assignments est appelé au format final du contrat 4.3 (`assignments: [{ event_id,
 *    can_accept_cash }]`, R41) ; l'ancien format est retiré par fix(9b.26) ;
 *  - DELETE /api/partner/team/controller/[controllerId] par un admin porte `?partnerId=` (portée exigée de l'admin,
 *    route du lot 5) ;
 *  - l'export avec contacts est accordé à un admin events.read + partners.read ; events.read seul est refusé
 *    (`permission: 'partners.read'`).
 *
 * Rouge avant correctif (fix(9b.11), fix(9b.11-SC), fix(9b.11-SV)) : event_actor_profile donne `is_staff` à tout ADMIN
 * (M/20261102000003:191-205) et les routes ne lisent que le rôle (serverIsAdmin) : l'admin sans permission obtient 200
 * (reproduction la plus forte : POST …/transition {to:'SUSPENDU'} suspend l'événement) ; event_controller_set_cash
 * refuse tout admin (OWNER_ONLY) au lieu d'accepter events.write ; le format `assignments[]` est ignoré (R41).
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CashoutService } from '../../lib/payments/cashout.service';
import { getFakes } from '../fakes';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { randomSenegalPhone } from './helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { buyConfirmed, cashoutsByKey, confirmCashouts, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { newController, type RouteResult } from './acces-helpers';
import { createEventInStatus, eventStatus, rpcCancel, rpcTransition, type DraftEvent } from './cycle-helpers';
import { invoke, PILOTAGE_TABS, routeHandler, show } from './pilotage-helpers';
import { newAdminWith } from './terrain-helpers';
import type { TestAdmin } from './notif-helpers';

after(async () => {
    await assertLot9bisInvariants('droits-partenaire-9bis');
});

type Row = Record<string, unknown>;
type Call = (token: string | null) => Promise<RouteResult>;

const STANDARD = 'Standard';
const PRICE = 4_000;
const REASON = 'Test lot 9 bis : droits des admins';

let partnerA: TestPartner;
let partnerB: TestPartner;
let client: Buyer;
let evA: DraftEvent;
let tickets: Row[];
let bare: TestAdmin;
let superadmin: TestAdmin;
const admins: Record<string, TestAdmin> = {};

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

async function call(mod: string, method: string, path: string, token: string | null, params: Record<string, string>, body?: unknown): Promise<RouteResult> {
    const handler = await routeHandler(`../../app/api/partner/${mod}/route`, method, `${method} /api/partner/${mod}`);
    return invoke(handler, jsonRequest(path, method, token, body), ctx(params));
}

/** Admin neuf qui porte exactement ces permissions (mémorisé par jeu de permissions). */
async function adminWith(perms: string[]): Promise<TestAdmin> {
    const key = [...perms].sort().join('+') || '(aucune)';
    admins[key] ??= await newAdminWith(perms, { label: `dp-${key.replace(/[^a-z]/gi, '').slice(0, 12)}` });
    return admins[key];
}

async function event(label: string): Promise<DraftEvent> {
    return createEventInStatus(partnerA, label, [{ name: STANDARD, price: PRICE, total: 30 }], 'PUBLIE', { startsInHours: 72 });
}

async function assignmentOf(eventId: string, userId: string): Promise<Row | null> {
    const { data, error } = await service.from('event_controllers').select('id, can_accept_cash, entry_point').eq('event_id', eventId).eq('user_id', userId).maybeSingle();
    assert.equal(error, null, `affectation ${userId} : ${error?.message}`);
    return (data as Row | null) ?? null;
}

async function assignmentId(eventId: string, userId: string): Promise<string> {
    const a = await assignmentOf(eventId, userId);
    assert.ok(a, `affectation de ${userId} sur ${eventId} attendue`);
    return String(a.id);
}

async function ticketState(id: unknown): Promise<Row> {
    const { data, error } = await service.from('tickets').select('status').eq('id', String(id)).single();
    assert.equal(error, null, `billet ${String(id)} : ${error?.message}`);
    return { status: data.status, cashouts: (await cashoutsByKey(`REFUND-TKT-${String(id)}`)).length };
}

async function exportsCount(eventId: string): Promise<number> {
    const { count, error } = await service.from('participant_exports').select('id', { count: 'exact', head: true }).eq('event_id', eventId);
    assert.equal(error, null, `participant_exports : ${error?.message}`);
    return count ?? 0;
}

async function pinRow(eventId: string): Promise<Row | null> {
    const { data, error } = await service.from('event_regisseur_pins').select('pin_hash, updated_at').eq('event_id', eventId).maybeSingle();
    assert.equal(error, null, `PIN régisseur : ${error?.message}`);
    return (data as Row | null) ?? null;
}

async function usersWithPhone(phones: string[]): Promise<number> {
    const forms = phones.flatMap((p) => [p, p.replace(/^\+/, '')]);
    const { count, error } = await service.from('users').select('id', { count: 'exact', head: true }).in('phone', forms);
    assert.equal(error, null, `comptes par numéro : ${error?.message}`);
    return count ?? 0;
}

/** Versements créés par un remboursement accepté : envoyés et confirmés (aucun laissé en attente). */
async function settle(cashoutIds: unknown[]): Promise<void> {
    for (const id of cashoutIds) if (typeof id === 'string') await CashoutService.send(id);
    await confirmCashouts();
}

// ── Matrice ────────────────────────────────────────────────────────────────

const DATA_KEYS = ['impact', 'progress', 'ticket', 'tickets', 'entries', 'revenue', 'by_category', 'controllers', 'shifts', 'members',
    'promotion', 'event', 'items', 'pin', 'z', 'finance', 'absents'];

interface Matrix {
    name: string;
    /** Permission nommée dans le refus PERMISSION_MISSING. */
    permission: string;
    /** Admin muni de la seule permission attendue. */
    allowed: TestAdmin;
    /** Admin muni d'autres permissions (témoin de minimalité). */
    other: TestAdmin;
    /** Appel visé par les refus. */
    refused: Call;
    /** Photographie de l'état qu'un refus ne doit pas changer. */
    state: () => Promise<unknown>;
    /** Codes admis en plus de PERMISSION_MISSING pour un admin refusé (transition, annulation). */
    altAdminCodes?: string[];
    /** Partenaire B agit sur sa propre équipe : 200 admis, sans effet sur A ni donnée de A. */
    bOwnScope?: boolean;
    /** Appel et contrôle de l'admin autorisé, puis du SUPERADMIN. */
    byAllowed: Call;
    checkAllowed: (res: RouteResult) => Promise<void>;
    bySuper: Call;
    checkSuper: (res: RouteResult) => Promise<void>;
    successStatus?: number;
}

function assertNoLeak(res: RouteResult, what: string): void {
    const text = JSON.stringify(res.body);
    assert.ok(!text.includes(evA.title), `${what} : titre de l’événement de A dans la réponse : ${show(res)}`);
    assert.ok(!text.includes(client.email) && !text.includes(client.phoneE164), `${what} : donnée du client dans la réponse : ${show(res)}`);
}

async function expectRefusal(m: Matrix, token: string | null, who: string, statuses: number[]): Promise<void> {
    const before = JSON.stringify(await m.state());
    const res = await m.refused(token);
    const what = `${m.name}, ${who}`;
    assert.ok(statuses.includes(res.status), `${what} : HTTP ${statuses.join(' ou ')} attendu, ${show(res)}`);
    if (res.status >= 400) {
        assert.equal(typeof res.body.error, 'string', `${what} : refus { error, code } attendu, ${show(res)}`);
        for (const key of DATA_KEYS) assert.equal(res.body[key], undefined, `${what} : aucune donnée (${key}) dans un refus, ${show(res)}`);
    }
    assertNoLeak(res, what);
    assert.equal(JSON.stringify(await m.state()), before, `${what} : aucun effet attendu`);
}

async function expectAdminRefusal(m: Matrix, admin: TestAdmin, who: string): Promise<void> {
    const before = JSON.stringify(await m.state());
    const res = await m.refused(admin.accessToken);
    const what = `${m.name}, ${who}`;
    assert.equal(res.status, 403, `R2 : ${what} → 403 attendu, ${show(res)}`);
    const codes = ['PERMISSION_MISSING', ...(m.altAdminCodes ?? [])];
    assert.ok(codes.includes(String(res.body.code)), `${what} : code ${codes.join(' ou ')} attendu, ${show(res)}`);
    if (res.body.code === 'PERMISSION_MISSING') assert.equal(res.body.permission, m.permission, `${what} : permission manquante nommée (contrat 4.2), ${show(res)}`);
    for (const key of DATA_KEYS) assert.equal(res.body[key], undefined, `${what} : aucune donnée (${key}) dans un refus, ${show(res)}`);
    assert.equal(JSON.stringify(await m.state()), before, `${what} : aucun effet attendu`);
}

async function runMatrix(m: Matrix): Promise<void> {
    await expectRefusal(m, null, 'sans session', [401]);
    await expectRefusal(m, client.accessToken, 'client porteur d’un billet', [403, 404]);
    await expectRefusal(m, partnerB.accessToken, m.bOwnScope ? 'partenaire B (sa propre équipe)' : 'partenaire B', m.bOwnScope ? [200, 403, 404] : [403, 404]);
    await expectAdminRefusal(m, bare, 'ADMIN sans permission');
    await expectAdminRefusal(m, m.other, `ADMIN muni d’autres permissions (${m.other.permissions.join(', ')})`);
    const expected = m.successStatus ?? 200;
    const ok = await m.byAllowed(m.allowed.accessToken);
    assert.equal(ok.status, expected, `${m.name}, ADMIN ${m.allowed.permissions.join(' + ')} : ${show(ok)}`);
    await m.checkAllowed(ok);
    const sup = await m.bySuper(superadmin.accessToken);
    assert.equal(sup.status, expected, `${m.name}, SUPERADMIN : ${show(sup)}`);
    await m.checkSuper(sup);
}

/** Matrice d'une lecture : aucun état, la réponse autorisée porte `key`. */
async function readMatrix(name: string, permission: string, other: TestAdmin, read: Call, key: string): Promise<void> {
    const check = async (res: RouteResult): Promise<void> => {
        assert.ok(key in res.body, `${name} : champ ${key} attendu dans la réponse autorisée, ${show(res)}`);
    };
    await runMatrix({
        name, permission, allowed: await adminWith([permission]), other, refused: read, state: async () => null,
        byAllowed: read, checkAllowed: check, bySuper: read, checkSuper: check,
    });
}

before(async () => {
    partnerA = await newPartner('dp9-a');
    partnerB = await newPartner('dp9-b');
    evA = await event('droits-9bis-a');
    client = await newBuyer('dp9-client', { firstName: 'Seynabou', lastName: 'Porteuse' });
    ({ tickets } = await buyConfirmed(client, evA, [[STANDARD, 3]]));
    assert.equal(tickets.length, 3, 'trois billets payés en ligne');
    bare = await adminWith([]);
    superadmin = await newAdminWith([], { role: 'SUPERADMIN', label: 'dp-super' });
});

describe('R2 — lectures réservées à la propriétaire ou à un admin events.read', () => {
    test('pilotage (six onglets) : admin sans permission et admin sans events.read → 403 PERMISSION_MISSING ; events.read et SUPERADMIN → 200', async () => {
        const other = await adminWith(['refunds.manage', 'partners.validate']);
        for (const tab of PILOTAGE_TABS) {
            const read: Call = (t) => call(`events/[id]/pilotage/${tab}`, 'GET', `/api/partner/events/${evA.eventId}/pilotage/${tab}`, t, { id: evA.eventId });
            await runMatrix({
                name: `GET …/pilotage/${tab}`, permission: 'events.read', allowed: await adminWith(['events.read']), other, refused: read,
                state: async () => null, byAllowed: read, checkAllowed: async () => undefined, bySuper: read, checkSuper: async () => undefined,
            });
        }
    });

    test('GET …/cancellation (impact) : events.read', async () => {
        await readMatrix('GET …/cancellation', 'events.read', await adminWith(['refunds.manage', 'partners.validate']),
            (t) => call('events/[id]/cancellation', 'GET', `/api/partner/events/${evA.eventId}/cancellation`, t, { id: evA.eventId }), 'impact');
    });

    test('GET …/invitations : events.read', async () => {
        await readMatrix('GET …/invitations', 'events.read', await adminWith(['refunds.manage', 'partners.validate']),
            (t) => call('events/[id]/invitations', 'GET', `/api/partner/events/${evA.eventId}/invitations`, t, { id: evA.eventId }), 'items');
    });

    test('GET …/shifts : events.read', async () => {
        await readMatrix('GET …/shifts', 'events.read', await adminWith(['refunds.manage', 'partners.validate']),
            (t) => call('events/[id]/shifts', 'GET', `/api/partner/events/${evA.eventId}/shifts`, t, { id: evA.eventId }), 'shifts');
    });

    test('GET …/promotion : events.read', async () => {
        await readMatrix('GET …/promotion', 'events.read', await adminWith(['refunds.manage', 'partners.validate']),
            (t) => call('events/[id]/promotion', 'GET', `/api/partner/events/${evA.eventId}/promotion`, t, { id: evA.eventId }), 'promotion');
    });

    test('GET /api/partner/events/[id] (fiche) : events.read', async () => {
        await readMatrix('GET /api/partner/events/[id]', 'events.read', await adminWith(['refunds.manage', 'partners.validate']),
            (t) => call('events/[id]', 'GET', `/api/partner/events/${evA.eventId}`, t, { id: evA.eventId }), 'event');
    });

    test('GET /api/partner/team/[eventId] (équipe et téléphones) : events.read', async () => {
        const ctrl = await newController(partnerA, evA.eventId, { label: 'dp9-equipe' });
        const read: Call = (t) => call('team/[eventId]', 'GET', `/api/partner/team/${evA.eventId}`, t, { eventId: evA.eventId });
        const check = async (res: RouteResult): Promise<void> => {
            assert.ok(JSON.stringify(res.body.controllers ?? []).includes(ctrl.userId), `équipe de A lue : ${show(res)}`);
        };
        await runMatrix({
            name: 'GET /api/partner/team/[eventId]', permission: 'events.read', allowed: await adminWith(['events.read']),
            other: await adminWith(['refunds.manage', 'partners.validate']), refused: read, state: async () => null,
            byAllowed: read, checkAllowed: check, bySuper: read, checkSuper: check,
        });
    });

    test('GET /api/partner/team/all : events.read ; la partenaire B ne lit que sa propre équipe', async () => {
        const ctrl = await newController(partnerA, evA.eventId, { label: 'dp9-toutes' });
        const read: Call = (t) => call('team/all', 'GET', '/api/partner/team/all', t, {});
        const secret = async (res: RouteResult): Promise<void> => {
            assert.ok(JSON.stringify(res.body).includes(ctrl.userId), `toutes les équipes, contrôleur de A présent : ${show(res)}`);
        };
        await runMatrix({
            name: 'GET /api/partner/team/all', permission: 'events.read', allowed: await adminWith(['events.read']),
            other: await adminWith(['refunds.manage', 'partners.validate']), refused: read, bOwnScope: true,
            state: async () => null, byAllowed: read, checkAllowed: secret, bySuper: read, checkSuper: secret,
        });
        const own = await read(partnerB.accessToken);
        assert.ok(!JSON.stringify(own.body).includes(ctrl.userId) && !JSON.stringify(own.body).includes(ctrl.phoneE164),
            `partenaire B : aucun contrôleur de A dans sa propre équipe : ${show(own)}`);
    });

    test('GET …/tickets/lookup (fiche d’un billet à rembourser) : refunds.manage ; events.read et events.write ne suffisent pas', async () => {
        const number = String(tickets[0].ticket_number);
        const read: Call = (t) => call('events/[id]/tickets/lookup', 'GET', `/api/partner/events/${evA.eventId}/tickets/lookup?number=${encodeURIComponent(number)}`, t, { id: evA.eventId });
        const check = async (res: RouteResult): Promise<void> => {
            assert.equal((res.body.ticket as Row | undefined)?.ticket_number, number, `fiche du billet : ${show(res)}`);
        };
        await runMatrix({
            name: 'GET …/tickets/lookup', permission: 'refunds.manage', allowed: await adminWith(['refunds.manage']),
            other: await adminWith(['events.read', 'events.write']), refused: read, state: async () => null,
            byAllowed: read, checkAllowed: check, bySuper: read, checkSuper: check,
        });
    });

    test('POST …/participants-export sans contacts : events.read ; chaque export accordé est journalisé, aucun pour un refus', async () => {
        const exp: Call = (t) => call('events/[id]/participants-export', 'POST', `/api/partner/events/${evA.eventId}/participants-export`, t, { id: evA.eventId }, { includeContacts: false });
        let count = 0;
        const check = async (res: RouteResult): Promise<void> => {
            assert.equal(res.body.error, undefined, `fichier servi, pas un refus : ${show(res)}`);
            const now = await exportsCount(evA.eventId);
            assert.equal(now, count + 1, 'un export journalisé (participant_exports)');
            count = now;
        };
        await runMatrix({
            name: 'POST …/participants-export (sans contacts)', permission: 'events.read', allowed: await adminWith(['events.read']),
            other: await adminWith(['refunds.manage', 'partners.validate']), refused: exp,
            state: async () => { count = await exportsCount(evA.eventId); return count; },
            byAllowed: exp, checkAllowed: check, bySuper: exp, checkSuper: check,
        });
    });

    test('POST …/participants-export AVEC contacts : events.read + partners.read ; events.read seul → 403 permission partners.read', async () => {
        const body = { includeContacts: true, purpose: 'URGENT_EVENT_INFO' };
        const exp: Call = (t) => call('events/[id]/participants-export', 'POST', `/api/partner/events/${evA.eventId}/participants-export`, t, { id: evA.eventId }, body);
        let count = 0;
        const check = async (res: RouteResult): Promise<void> => {
            assert.equal(res.body.error, undefined, `fichier avec contacts servi : ${show(res)}`);
            const now = await exportsCount(evA.eventId);
            assert.equal(now, count + 1, 'un export journalisé (participant_exports)');
            count = now;
        };
        await runMatrix({
            name: 'POST …/participants-export (avec contacts)', permission: 'partners.read', allowed: await adminWith(['events.read', 'partners.read']),
            other: await adminWith(['events.read']), refused: exp,
            state: async () => { count = await exportsCount(evA.eventId); return count; },
            byAllowed: exp, checkAllowed: check, bySuper: exp, checkSuper: check,
        });
    });
});

describe('R2 — écritures réservées à la propriétaire ou à un admin events.write', () => {
    test('POST …/transition {to:SUSPENDU} (reproduction la plus forte) : admin sans events.write refusé, événement toujours PUBLIE ; events.write suspend, SUPERADMIN réactive', async () => {
        const ev = await event('droits-9bis-transition');
        const suspend: Call = (t) => call('events/[id]/transition', 'POST', `/api/partner/events/${ev.eventId}/transition`, t, { id: ev.eventId }, { to: 'SUSPENDU', reason: REASON });
        await runMatrix({
            name: 'POST …/transition', permission: 'events.write', allowed: await adminWith(['events.write']),
            other: await adminWith(['events.read', 'refunds.manage', 'partners.read']), altAdminCodes: ['TRANSITION_NOT_ALLOWED'],
            refused: suspend, state: () => eventStatus(ev.eventId),
            byAllowed: suspend, checkAllowed: async () => assert.equal(await eventStatus(ev.eventId), 'SUSPENDU', 'suspendu par l’admin events.write'),
            bySuper: (t) => call('events/[id]/transition', 'POST', `/api/partner/events/${ev.eventId}/transition`, t, { id: ev.eventId }, { to: 'PUBLIE', reason: REASON }),
            checkSuper: async () => assert.equal(await eventStatus(ev.eventId), 'PUBLIE', 'réactivé par le SUPERADMIN'),
        });
    });

    test('POST …/cancel : admin sans events.write refusé, événement toujours PUBLIE ; events.write et SUPERADMIN annulent', async () => {
        const first = await event('droits-9bis-annule-1');
        const second = await event('droits-9bis-annule-2');
        const cancel = (ev: DraftEvent): Call => (t) => call('events/[id]/cancel', 'POST', `/api/partner/events/${ev.eventId}/cancel`, t, { id: ev.eventId }, {
            publicNotice: 'Événement annulé par Event Village (test des droits).', internalReason: REASON, confirmTitle: ev.title,
        });
        await runMatrix({
            name: 'POST …/cancel', permission: 'events.write', allowed: await adminWith(['events.write']),
            other: await adminWith(['events.read', 'refunds.manage', 'partners.read']), altAdminCodes: ['TRANSITION_NOT_ALLOWED'],
            refused: cancel(first), state: () => eventStatus(first.eventId),
            byAllowed: cancel(first), checkAllowed: async () => assert.equal(await eventStatus(first.eventId), 'ANNULE', 'annulé par l’admin events.write'),
            bySuper: cancel(second), checkSuper: async () => assert.equal(await eventStatus(second.eventId), 'ANNULE', 'annulé par le SUPERADMIN'),
        });
    });

    test('POST …/regisseur-pin {confirm:true} : events.write ; un refus laisse le PIN tel quel', async () => {
        const gen: Call = (t) => call('events/[id]/regisseur-pin', 'POST', `/api/partner/events/${evA.eventId}/regisseur-pin`, t, { id: evA.eventId }, { confirm: true, confirmOpenShifts: true });
        let last: unknown = null;
        const check = async (res: RouteResult): Promise<void> => {
            assert.match(String(res.body.pin ?? ''), /^\d{6}$/, `PIN servi une fois : ${show(res)}`);
            const row = await pinRow(evA.eventId);
            assert.ok(row && JSON.stringify(row) !== JSON.stringify(last), 'PIN régénéré en base');
            last = row;
        };
        await runMatrix({
            name: 'POST …/regisseur-pin', permission: 'events.write', allowed: await adminWith(['events.write']),
            other: await adminWith(['events.read', 'refunds.manage', 'partners.read']), refused: gen,
            state: async () => { last = await pinRow(evA.eventId); return last; },
            byAllowed: gen, checkAllowed: check, bySuper: gen, checkSuper: check,
        });
    });

    test('DELETE /api/partner/team/[eventId]?assignmentId= : events.write ; un refus laisse l’affectation', async () => {
        const c1 = await newController(partnerA, evA.eventId, { label: 'dp9-retrait-1' });
        const c2 = await newController(partnerA, evA.eventId, { label: 'dp9-retrait-2' });
        const a1 = await assignmentId(evA.eventId, c1.userId);
        const a2 = await assignmentId(evA.eventId, c2.userId);
        const del = (id: string): Call => (t) => call('team/[eventId]', 'DELETE', `/api/partner/team/${evA.eventId}?assignmentId=${id}`, t, { eventId: evA.eventId });
        await runMatrix({
            name: 'DELETE /api/partner/team/[eventId]', permission: 'events.write', allowed: await adminWith(['events.write']),
            other: await adminWith(['events.read', 'refunds.manage', 'partners.read']), refused: del(a1),
            state: () => assignmentOf(evA.eventId, c1.userId),
            byAllowed: del(a1), checkAllowed: async () => assert.equal(await assignmentOf(evA.eventId, c1.userId), null, 'affectation retirée par l’admin events.write'),
            bySuper: del(a2), checkSuper: async () => assert.equal(await assignmentOf(evA.eventId, c2.userId), null, 'affectation retirée par le SUPERADMIN'),
        });
    });

    test('DELETE /api/partner/team/all?controllerId= : events.write ; la partenaire B n’agit que sur sa propre équipe', async () => {
        const c1 = await newController(partnerA, evA.eventId, { label: 'dp9-tout-1' });
        const c2 = await newController(partnerA, evA.eventId, { label: 'dp9-tout-2' });
        // Lot 9 quater (B8 : N-01) : un admin nomme l'organisateur (partnerId), ignoré pour une partenaire (modification signalée)
        const del = (u: Buyer): Call => (t) => call('team/all', 'DELETE', `/api/partner/team/all?controllerId=${u.userId}&partnerId=${partnerA.partnerId}`, t, {});
        await runMatrix({
            name: 'DELETE /api/partner/team/all', permission: 'events.write', allowed: await adminWith(['events.write']),
            other: await adminWith(['events.read', 'refunds.manage', 'partners.read']), refused: del(c1), bOwnScope: true,
            state: () => assignmentOf(evA.eventId, c1.userId),
            byAllowed: del(c1), checkAllowed: async () => assert.equal(await assignmentOf(evA.eventId, c1.userId), null, 'retiré par l’admin events.write'),
            bySuper: del(c2), checkSuper: async () => assert.equal(await assignmentOf(evA.eventId, c2.userId), null, 'retiré par le SUPERADMIN'),
        });
    });

    test('PATCH /api/partner/team/assignments (format assignments[] du contrat 4.3) : events.write', async () => {
        const ctrl = await newController(partnerA, evA.eventId, { label: 'dp9-affecte', canAcceptCash: false });
        const sync = (cash: boolean): Call => (t) => call('team/assignments', 'PATCH', '/api/partner/team/assignments', t, {}, {
            controller_id: ctrl.userId, assignments: [{ event_id: evA.eventId, can_accept_cash: cash }],
        });
        await runMatrix({
            name: 'PATCH /api/partner/team/assignments', permission: 'events.write', allowed: await adminWith(['events.write']),
            other: await adminWith(['events.read', 'refunds.manage', 'partners.read']), refused: sync(true), bOwnScope: true,
            state: () => assignmentOf(evA.eventId, ctrl.userId),
            byAllowed: sync(true), checkAllowed: async () => assert.equal((await assignmentOf(evA.eventId, ctrl.userId))?.can_accept_cash, true, 'droit d’encaisser accordé par l’admin events.write'),
            bySuper: sync(false), checkSuper: async () => assert.equal((await assignmentOf(evA.eventId, ctrl.userId))?.can_accept_cash, false, 'droit d’encaisser retiré par le SUPERADMIN'),
        });
    });

    test('PATCH /api/partner/team/assignments/[id] {canAcceptCash} : events.write (aujourd’hui OWNER_ONLY pour tout admin)', async () => {
        const ctrl = await newController(partnerA, evA.eventId, { label: 'dp9-especes', canAcceptCash: false });
        const id = await assignmentId(evA.eventId, ctrl.userId);
        const set = (cash: boolean): Call => (t) => call('team/assignments/[id]', 'PATCH', `/api/partner/team/assignments/${id}`, t, { id }, { canAcceptCash: cash });
        await runMatrix({
            name: 'PATCH /api/partner/team/assignments/[id]', permission: 'events.write', allowed: await adminWith(['events.write']),
            other: await adminWith(['events.read', 'refunds.manage', 'partners.read']), refused: set(true),
            state: () => assignmentOf(evA.eventId, ctrl.userId),
            byAllowed: set(true), checkAllowed: async () => assert.equal((await assignmentOf(evA.eventId, ctrl.userId))?.can_accept_cash, true, 'accordé par l’admin events.write'),
            bySuper: set(false), checkSuper: async () => assert.equal((await assignmentOf(evA.eventId, ctrl.userId))?.can_accept_cash, false, 'retiré par le SUPERADMIN'),
        });
    });

    test('DELETE /api/partner/team/controller/[controllerId]?partnerId= : events.write', async () => {
        const c1 = await newController(partnerA, evA.eventId, { label: 'dp9-equipe-1' });
        const c2 = await newController(partnerA, evA.eventId, { label: 'dp9-equipe-2' });
        const del = (u: Buyer): Call => (t) => call('team/controller/[controllerId]', 'DELETE', `/api/partner/team/controller/${u.userId}?partnerId=${partnerA.partnerId}`, t, { controllerId: u.userId });
        await runMatrix({
            name: 'DELETE /api/partner/team/controller/[controllerId]', permission: 'events.write', allowed: await adminWith(['events.write']),
            other: await adminWith(['events.read', 'refunds.manage', 'partners.read']), refused: del(c1),
            state: () => assignmentOf(evA.eventId, c1.userId),
            byAllowed: del(c1), checkAllowed: async () => assert.equal(await assignmentOf(evA.eventId, c1.userId), null, 'retiré de l’équipe de A par l’admin events.write'),
            bySuper: del(c2), checkSuper: async () => assert.equal(await assignmentOf(evA.eventId, c2.userId), null, 'retiré de l’équipe de A par le SUPERADMIN'),
        });
    });

    test('PATCH /api/partner/team/entry-point : events.write', async () => {
        const ctrl = await newController(partnerA, evA.eventId, { label: 'dp9-porte' });
        const set = (entryPoint: string): Call => (t) => call('team/entry-point', 'PATCH', '/api/partner/team/entry-point', t, {}, {
            controllerId: ctrl.userId, eventId: evA.eventId, entryPoint,
        });
        await runMatrix({
            name: 'PATCH /api/partner/team/entry-point', permission: 'events.write', allowed: await adminWith(['events.write']),
            other: await adminWith(['events.read', 'refunds.manage', 'partners.read']), refused: set('Porte refusée'),
            state: () => assignmentOf(evA.eventId, ctrl.userId),
            byAllowed: set('Porte Nord'), checkAllowed: async () => assert.equal((await assignmentOf(evA.eventId, ctrl.userId))?.entry_point, 'Porte Nord', 'posé par l’admin events.write'),
            bySuper: set('Porte Sud'), checkSuper: async () => assert.equal((await assignmentOf(evA.eventId, ctrl.userId))?.entry_point, 'Porte Sud', 'posé par le SUPERADMIN'),
        });
    });

    test('POST /api/partner/team/invite (numéro sans compte) : events.write ; un refus ne crée aucun compte et n’envoie aucun SMS', async () => {
        const refusedPhones: string[] = [];
        const invite = (phone: string): Call => (t) => call('team/invite', 'POST', '/api/partner/team/invite', t, {}, {
            event_id: evA.eventId, phone, first_name: 'Abdou', last_name: 'Invite',
        });
        const refused: Call = (t) => {
            const phone = randomSenegalPhone('76');
            refusedPhones.push(phone);
            return invite(phone)(t);
        };
        const smsTo = (phones: string[]): number => phones.reduce((n, p) => n + getFakes().sms.messagesTo(p).length, 0);
        const okPhone = randomSenegalPhone('76');
        const superPhone = randomSenegalPhone('76');
        const invited = async (phone: string, who: string): Promise<void> => {
            const { data, error } = await service.from('users').select('id').in('phone', [phone, phone.replace(/^\+/, '')]).maybeSingle();
            assert.equal(error, null, error?.message);
            assert.ok(data, `${who} : compte du contrôleur invité créé`);
            assert.ok(await assignmentOf(evA.eventId, String(data.id)), `${who} : contrôleur affecté à l’événement de A`);
        };
        await runMatrix({
            name: 'POST /api/partner/team/invite', permission: 'events.write', allowed: await adminWith(['events.write']),
            other: await adminWith(['events.read', 'refunds.manage', 'partners.read']), refused, successStatus: 201,
            // Chaque refus vise un numéro neuf : aucun compte et aucun SMS pour l'ensemble des numéros refusés (comptage par numéro).
            state: async () => ({ users: await usersWithPhone(refusedPhones), sms: smsTo(refusedPhones) }),
            byAllowed: invite(okPhone), checkAllowed: () => invited(okPhone, 'admin events.write'),
            bySuper: invite(superPhone), checkSuper: () => invited(superPhone, 'SUPERADMIN'),
        });
        assert.equal(await usersWithPhone(refusedPhones), 0, `aucun compte créé pour les ${refusedPhones.length} invitations refusées`);
        assert.equal(smsTo(refusedPhones), 0, 'aucun SMS envoyé pour les invitations refusées');
    });
});

describe('R2 — remboursement réservé à la propriétaire ou à un admin refunds.manage', () => {
    test('POST …/tickets/[ticketId]/refund : events.read et events.write ne suffisent pas ; refunds.manage et SUPERADMIN remboursent', async () => {
        const [t0, t1, t2] = tickets.map((t) => String(t.id));
        const refund = (ticketId: string): Call => (t) => call('events/[id]/tickets/[ticketId]/refund', 'POST',
            `/api/partner/events/${evA.eventId}/tickets/${ticketId}/refund`, t, { id: evA.eventId, ticketId }, { reason: REASON });
        const done: unknown[] = [];
        const check = (ticketId: string, who: string) => async (res: RouteResult): Promise<void> => {
            done.push(res.body.cashout_id);
            const s = await ticketState(ticketId);
            assert.equal(s.cashouts, 1, `${who} : un versement pour le billet`);
            assert.notEqual(s.status, 'VALIDE', `${who} : billet en remboursement`);
        };
        try {
            await runMatrix({
                name: 'POST …/tickets/[ticketId]/refund', permission: 'refunds.manage', allowed: await adminWith(['refunds.manage']),
                other: await adminWith(['events.read', 'events.write']), refused: refund(t0), state: () => ticketState(t0),
                byAllowed: refund(t1), checkAllowed: check(t1, 'admin refunds.manage'),
                bySuper: refund(t2), checkSuper: check(t2, 'SUPERADMIN'),
            });
        } finally {
            const leaked = (await cashoutsByKey(`REFUND-TKT-${t0}`)).map((c) => c.id);
            await settle([...done, ...leaked]);
        }
    });
});

describe('R2 — RPC directes (acteur en paramètre)', () => {
    test('event_transition et event_cancel : un admin sans events.write est refusé sans effet ; events.write passe', async () => {
        const ev = await event('droits-9bis-rpc');
        for (const admin of [bare, await adminWith(['events.read'])]) {
            const label = admin.permissions.join(', ') || 'aucune permission';
            const tr = await rpcTransition(ev.eventId, admin.userId, 'SUSPENDU', REASON);
            assert.equal(tr.error, null, `event_transition : ${tr.error?.message}`);
            assert.equal(tr.data?.ok, false, `R2 : event_transition par un admin (${label}) refusée : ${JSON.stringify(tr.data)}`);
            assert.ok(['PERMISSION_MISSING', 'TRANSITION_NOT_ALLOWED'].includes(String(tr.data?.code)), `code du refus : ${JSON.stringify(tr.data)}`);
            const cn = await rpcCancel(ev.eventId, admin.userId, { publicNotice: 'Annulation refusée (test).', internalReason: REASON, confirmTitle: ev.title });
            assert.equal(cn.error, null, `event_cancel : ${cn.error?.message}`);
            assert.equal(cn.data?.ok, false, `R2 : event_cancel par un admin (${label}) refusée : ${JSON.stringify(cn.data)}`);
            assert.equal(await eventStatus(ev.eventId), 'PUBLIE', `admin (${label}) : événement toujours PUBLIE`);
        }
        const writer = await adminWith(['events.write']);
        const ok = await rpcTransition(ev.eventId, writer.userId, 'SUSPENDU', REASON);
        assert.equal(ok.data?.ok, true, `event_transition par un admin events.write : ${JSON.stringify(ok.data ?? ok.error)}`);
        assert.equal(await eventStatus(ev.eventId), 'SUSPENDU');
    });

    test('pilotage_access : PERMISSION_MISSING sans events.read, NULL (accès) avec events.read', async () => {
        const denied = await service.rpc('pilotage_access', { p_event: evA.eventId, p_actor: bare.userId });
        assert.equal(denied.error, null, `pilotage_access : ${denied.error?.message}`);
        assert.equal(denied.data, 'PERMISSION_MISSING', `R2 : pilotage_access d’un admin sans permission (aujourd’hui NULL, accès accordé) : ${JSON.stringify(denied.data)}`);
        const granted = await service.rpc('pilotage_access', { p_event: evA.eventId, p_actor: (await adminWith(['events.read'])).userId });
        assert.equal(granted.error, null, granted.error?.message);
        assert.equal(granted.data, null, `admin events.read : accès accordé (NULL) : ${JSON.stringify(granted.data)}`);
    });

    test('event_actions : refusée à un admin sans permission', async () => {
        const { data, error } = await service.rpc('event_actions', { p: { event_id: evA.eventId, actor_id: bare.userId } });
        assert.equal(error, null, `event_actions : ${error?.message}`);
        assert.equal((data as Row).ok, false, `R2 : event_actions d’un admin sans permission (aujourd’hui ok, actions ADMIN servies) : ${JSON.stringify(data)}`);
        assert.equal((data as Row).actions, undefined, 'aucune action servie');
    });

    test('participants_export : avec contacts, events.read seul → PERMISSION_MISSING sans journal ; sans contacts, admin sans permission refusé', async () => {
        const reader = await adminWith(['events.read']);
        const before = await exportsCount(evA.eventId);
        const contacts = await service.rpc('participants_export', { p: { event_id: evA.eventId, actor_id: reader.userId, include_contacts: true, purpose: 'URGENT_EVENT_INFO' } });
        assert.equal(contacts.error, null, contacts.error?.message);
        assert.equal((contacts.data as Row).ok, false, `R2 : export avec contacts sans partners.read : ${JSON.stringify(contacts.data).slice(0, 400)}`);
        assert.equal((contacts.data as Row).code, 'PERMISSION_MISSING', JSON.stringify(contacts.data).slice(0, 400));
        const plain = await service.rpc('participants_export', { p: { event_id: evA.eventId, actor_id: bare.userId, include_contacts: false } });
        assert.equal(plain.error, null, plain.error?.message);
        assert.equal((plain.data as Row).ok, false, `R2 : export par un admin sans permission : ${JSON.stringify(plain.data).slice(0, 400)}`);
        assert.equal(await exportsCount(evA.eventId), before, 'aucun export journalisé pour un refus');
    });

    test('event_controller_set_cash : admin sans permission → PERMISSION_MISSING ; admin events.write → accordé', async () => {
        const ctrl = await newController(partnerA, evA.eventId, { label: 'dp9-rpc-especes', canAcceptCash: false });
        const id = await assignmentId(evA.eventId, ctrl.userId);
        const denied = await service.rpc('event_controller_set_cash', { p: { assignment_id: id, actor_id: bare.userId, can_accept_cash: true } });
        assert.equal(denied.error, null, denied.error?.message);
        assert.equal((denied.data as Row).code, 'PERMISSION_MISSING', `R2 : refus nommé (aujourd’hui OWNER_ONLY pour tout admin) : ${JSON.stringify(denied.data)}`);
        assert.equal((await assignmentOf(evA.eventId, ctrl.userId))?.can_accept_cash, false, 'refus sans effet');
        const writer = await adminWith(['events.write']);
        const granted = await service.rpc('event_controller_set_cash', { p: { assignment_id: id, actor_id: writer.userId, can_accept_cash: true } });
        assert.equal(granted.error, null, granted.error?.message);
        assert.equal((granted.data as Row).ok, true, `admin events.write : ${JSON.stringify(granted.data)}`);
        assert.equal((await assignmentOf(evA.eventId, ctrl.userId))?.can_accept_cash, true, 'droit d’encaisser accordé');
    });
});
