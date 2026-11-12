/**
 * Lot 9 ter, tâche 9t.17 (consigne 3 : gratuits et invitations à la porte) — nom de l'invité saisi par l'organisatrice
 * (contrat 5.C, C.3.3 F22 à F24, C.3.4, C.3.6, 11.3 ; arbitrage 20, x12).
 *  1. envoi avec des noms : chaque billet du numéro porte son nom (espaces ôtés), un numéro sans nom reste sans nom ;
 *  2. sans guest_names : réponse et lignes identiques à aujourd'hui ;
 *  3. 61 caractères, longueur différente des numéros : 400 INVALID_FIELD, rien écrit, aucun quota ;
 *  4. modifier le nom d'une invitation non utilisée ; refus sur un billet utilisé, annulé, d'un tiers, sans
 *     events.write, d'une vente ;
 *  5. liste de la partenaire : guest_name servi ; audits sans nom ni numéro ;
 *  6. nom illisible par REST et Realtime (privilèges de colonne, contrôleur affecté, abonnement aux billets) ;
 *  7. aucun nom dans les messages (notification_outbox).
 *
 * Rouge avant correctif (fix(9t.17), migration 20261110000008, chore(9t.17)) : colonne tickets.guest_name absente,
 * schéma Zod sans guest_names (clé ôtée, envoi accepté), route PATCH …/invitations/[ticketId] absente (setGuestName
 * la nomme), liste sans guest_name, audits sans named_count. Verts dès l'écriture, annoncés : cas 2 (non-régression)
 * et cas 7 (aucun nom n'entre dans template_data ; aujourd'hui le nom n'existe pas).
 * after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from '../helpers/db';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { disposeClients, expectNothing, signedInClient, subscribeCollect } from '../helpers/realtime';
import { randomSenegalPhone, routeContext } from './helpers';
import { eventTickets, newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, ticketRow, type RouteResult } from './acces-helpers';
import { newAdmin, outboxRows } from './notif-helpers';
import { invoke, routeHandler } from './pilotage-helpers';
import { guestAdmit, sendInvitations, setGuestName } from './zones-helpers';

type Row = Record<string, unknown>;

const VIP = 'VIP';
const CATEGORIES: CategorySpec[] = [{ name: VIP, price: 20_000, total: 40, maxPerOrder: 10 }];
const NAME_TOO_LONG = 'Le nom de l’invité ne doit pas dépasser 60 caractères.';
const NAMES_MISMATCH = 'Chaque nom d’invité doit correspondre à un numéro.';
const INVITATIONS_ROUTE = '../../app/api/partner/events/[id]/invitations/route';

let partner: TestPartner;
let partnerB: TestPartner;

before(async () => {
    partner = await newPartner('invites-nom');
    partnerB = await newPartner('invites-nom-b');
});

after(async () => {
    await assertLot9terInvariants('invites-nom');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 900)}`;
}

function newEvent(label: string): Promise<SaleEvent> {
    return createTimedEvent(partner.partnerId, `invites-nom ${label}`, CATEGORIES);
}

function body(ev: SaleEvent, phones: string[], quantity: number, guestNames?: Array<string | null>): Row {
    const out: Row = { category_id: ev.categories[VIP].id, phones, quantity };
    if (guestNames !== undefined) out.guest_names = guestNames;
    return out;
}

async function invitationTickets(eventId: string): Promise<Row[]> {
    return (await eventTickets(eventId)).filter((t) => t.sale_channel === 'INVITATION');
}

/** Billets d'invitation en attente vers un numéro (transferts sans expéditeur). */
async function ticketsTo(phone: string): Promise<Row[]> {
    const { data, error } = await service.from('ticket_transfers').select('ticket_id').eq('to_phone_or_email', phone).is('from_user_id', null);
    assert.equal(error, null, `transferts vers ${phone} : ${error?.message}`);
    return Promise.all((data ?? []).map((t) => ticketRow(String(t.ticket_id))));
}

/** Colonne guest_name d'une ligne ; échec explicite qui la nomme si la colonne n'existe pas. */
function guestNameOf(t: Row): unknown {
    assert.ok('guest_name' in t, `colonne tickets.guest_name absente (migration 20261110000008) : ${JSON.stringify(Object.keys(t))}`);
    return t.guest_name;
}

async function invitationQuotaHits(eventId: string): Promise<number> {
    const { data, error } = await service.from('quota_counters').select('hits').eq('scope', 'invitation_event').eq('bucket', eventId);
    assert.equal(error, null, `quota_counters : ${error?.message}`);
    return (data ?? []).reduce((sum, r) => sum + Number(r.hits), 0);
}

async function auditRows(action: string, filter: { userId?: string; objectId?: string; eventId?: string }): Promise<Row[]> {
    let q = service.from('audit_logs').select('*').eq('action', action);
    if (filter.userId) q = q.eq('user_id', filter.userId);
    if (filter.objectId) q = q.eq('object_id', filter.objectId);
    if (filter.eventId) q = q.contains('metadata', { event_id: filter.eventId });
    const { data, error } = await q.order('created_at');
    assert.equal(error, null, `audit ${action} : ${error?.message}`);
    return (data ?? []) as Row[];
}

// ── 1 à 3. Envoi ───────────────────────────────────────────────────────────

describe('9t.17 Invitations nommées : envoi', () => {
    test('1. envoi avec des noms : chaque billet du numéro porte son nom, un numéro sans nom reste sans nom', async () => {
        const ev = await newEvent('envoi');
        const phones = [randomSenegalPhone('76'), randomSenegalPhone('76'), randomSenegalPhone('76')];
        const r = await sendInvitations(partner, ev.eventId, body(ev, phones, 2, ['Awa Diop', null, '  Moussa Fall  ']));
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.ticket_count, 6, show(r));
        const expected: Array<[string, string | null]> = [[phones[0], 'Awa Diop'], [phones[1], null], [phones[2], 'Moussa Fall']];
        for (const [phone, name] of expected) {
            const tickets = await ticketsTo(phone);
            assert.equal(tickets.length, 2, `deux billets vers ${phone}`);
            assert.deepEqual(tickets.map(guestNameOf), [name, name], `nom de chaque billet du numéro ${phone}`);
        }
    });

    test('2. sans guest_names : réponse et lignes identiques à aujourd’hui', async () => {
        const ev = await newEvent('sans-nom');
        const r = await sendInvitations(partner, ev.eventId, body(ev, [randomSenegalPhone('76')], 1));
        assert.equal(r.status, 200, show(r));
        assert.deepEqual(Object.keys(r.body).sort(), ['message', 'ok', 'phone_count', 'ticket_count'], `clés de la réponse inchangées : ${show(r)}`);
        const tickets = await invitationTickets(ev.eventId);
        assert.equal(tickets.length, 1, 'un billet');
        assert.equal(tickets[0].guest_name ?? null, null, 'aucun nom');
    });

    test('3. 61 caractères, longueur différente des numéros : 400 INVALID_FIELD, rien écrit, aucun quota', async () => {
        const ev = await newEvent('refus');
        const hitsBefore = await invitationQuotaHits(ev.eventId);
        const cases: Array<[string, Row, string, string]> = [
            ['nom de 61 caractères', body(ev, [randomSenegalPhone('76')], 1, ['a'.repeat(61)]), 'guest_names.0', NAME_TOO_LONG],
            ['deux noms pour un numéro', body(ev, [randomSenegalPhone('76')], 1, ['Awa Diop', 'Moussa Fall']), 'guest_names', NAMES_MISMATCH],
        ];
        for (const [label, b, field, text] of cases) {
            const r = await sendInvitations(partner, ev.eventId, b);
            assert.equal(r.status, 400, `${label} : ${show(r)}`);
            assert.deepEqual({ code: r.body.code, field: r.body.field, error: r.body.error }, { code: 'INVALID_FIELD', field, error: text }, `${label} : ${show(r)}`);
        }
        assert.deepEqual(await invitationTickets(ev.eventId), [], 'aucun billet');
        assert.equal(await invitationQuotaHits(ev.eventId), hitsBefore, 'aucun quota consommé (refus avant tout verrou)');
    });
});

// ── 4 et 5. Modification du nom, liste, audits ─────────────────────────────

describe('9t.17 Invitations nommées : modification, liste, audits', () => {
    test('4. modifier le nom d’une invitation non utilisée ; refus sur un billet utilisé, annulé, d’un tiers, sans events.write', async () => {
        const ev = await newEvent('modification');
        const phones = [randomSenegalPhone('76'), randomSenegalPhone('76'), randomSenegalPhone('76')];
        const sent = await sendInvitations(partner, ev.eventId, body(ev, phones, 1, ['Awa Diop', null, null]));
        assert.equal(sent.status, 200, show(sent));
        const [[editable], [used], [cancelled]] = await Promise.all(phones.map(ticketsTo));
        const editableId = String(editable.id);

        const ok = await setGuestName(partner, ev.eventId, editableId, '  Aïssatou Ndiaye  ');
        assert.equal(ok.status, 200, show(ok));
        assert.deepEqual(ok.body, { ok: true, ticket_id: editableId, guest_name: 'Aïssatou Ndiaye', message: 'Nom de l’invité enregistré.' }, show(ok));
        assert.equal(guestNameOf(await ticketRow(editableId)), 'Aïssatou Ndiaye');
        const before = await ticketRow(editableId);

        const ctrl = await newController(partner, ev.eventId, { label: 'nom-liste' });
        const admitted = await guestAdmit(ctrl, ev.eventId, String(used.id));
        assert.equal(admitted.body.result, 'valid', `billet validé par la liste : ${show(admitted)}`);
        const usedRes = await setGuestName(partner, ev.eventId, String(used.id), 'Moussa Fall');
        assert.equal(usedRes.status, 409, show(usedRes));
        assert.deepEqual({ code: usedRes.body.code, error: usedRes.body.error },
            { code: 'TICKET_ALREADY_USED', error: 'Ce billet a déjà été utilisé : le nom ne peut plus être modifié.' }, show(usedRes));

        const cancel = await routeHandler('../../app/api/partner/events/[id]/invitations/[ticketId]/cancel/route', 'POST', 'annulation d’une invitation');
        const cancelRes = await invoke(cancel, authed(`/api/partner/events/${ev.eventId}/invitations/${cancelled.id}/cancel`, 'POST', partner),
            routeContext({ id: ev.eventId, ticketId: String(cancelled.id) }));
        assert.equal(cancelRes.status, 200, `annulation : ${show(cancelRes)}`);
        const cancelledRes = await setGuestName(partner, ev.eventId, String(cancelled.id), 'Moussa Fall');
        assert.equal(cancelledRes.status, 409, show(cancelledRes));
        assert.deepEqual({ code: cancelledRes.body.code, error: cancelledRes.body.error },
            { code: 'TICKET_NOT_EDITABLE', error: 'Cette invitation ne peut plus être modifiée.' }, show(cancelledRes));

        const byB = await setGuestName(partnerB, ev.eventId, editableId, 'Intrus');
        assert.equal(byB.status, 404, show(byB));
        assert.equal(byB.body.code, 'EVENT_NOT_FOUND', show(byB));
        const reader = await newAdmin('invites-nom', ['events.read']);
        const byReader = await setGuestName(reader, ev.eventId, editableId, 'Intrus');
        assert.equal(byReader.status, 403, show(byReader));
        assert.ok(['FORBIDDEN', 'PERMISSION_MISSING'].includes(String(byReader.body.code)), `admin sans events.write : ${show(byReader)}`);
        const buyer = await newBuyer('invites-nom-vente');
        const [sold] = (await buyConfirmed(buyer, ev, [[VIP, 1]])).tickets;
        const soldRes = await setGuestName(partner, ev.eventId, String(sold.id), 'Intrus');
        assert.equal(soldRes.status, 404, show(soldRes));
        assert.equal(soldRes.body.code, 'TICKET_NOT_FOUND', show(soldRes));
        const after0 = await ticketRow(editableId);
        assert.equal(guestNameOf(after0), 'Aïssatou Ndiaye', 'nom inchangé par les refus');
        assert.equal(after0.security_version, before.security_version, 'aucune rotation du secret (ni user_id ni status touchés)');
    });

    test('5. liste de la partenaire : guest_name servi ; audits sans nom ni numéro', async () => {
        const ev = await newEvent('liste');
        const named = randomSenegalPhone('76');
        const plain = randomSenegalPhone('76');
        const sent = await sendInvitations(partner, ev.eventId, body(ev, [named, plain], 1, ['Awa Diop', null]));
        assert.equal(sent.status, 200, show(sent));
        const handler = await routeHandler(INVITATIONS_ROUTE, 'GET', 'GET /api/partner/events/[id]/invitations');
        const list = await invoke(handler, authed(`/api/partner/events/${ev.eventId}/invitations`, 'GET', partner), routeContext({ id: ev.eventId }));
        assert.equal(list.status, 200, show(list));
        const items = (list.body.items ?? []) as Row[];
        assert.equal(items.length, 2, show(list));
        for (const i of items) assert.ok('guest_name' in i, `clé guest_name servie par la liste (F24) : ${JSON.stringify(i)}`);
        assert.deepEqual(items.map((i) => i.guest_name).filter((n) => n !== null), ['Awa Diop'], show(list));
        assert.equal(items.filter((i) => i.guest_name === null).length, 1, `invitation sans nom : null : ${show(list)}`);

        const [namedTicket] = await ticketsTo(named);
        const renamed = await setGuestName(partner, ev.eventId, String(namedTicket.id), 'Awa Diop Sarr');
        assert.equal(renamed.status, 200, show(renamed));
        const sentAudits = await auditRows('TICKET_INVITATIONS_SENT', { userId: partner.userId, eventId: undefined });
        const mine = sentAudits.filter((a) => (a.metadata as Row).category_id === ev.categories[VIP].id);
        assert.equal(mine.length, 1, `un audit d’envoi : ${JSON.stringify(mine)}`);
        assert.equal((mine[0].metadata as Row).named_count, 1, `named_count : ${JSON.stringify(mine[0].metadata)}`);
        const nameAudits = await auditRows('TICKET_INVITATION_GUEST_NAMED', { objectId: String(namedTicket.id) });
        assert.equal(nameAudits.length, 1, `un audit de nom : ${JSON.stringify(nameAudits)}`);
        assert.deepEqual(nameAudits[0].metadata, { event_id: ev.eventId, named: true, changed: true }, JSON.stringify(nameAudits[0]));
        for (const row of [...mine, ...nameAudits]) {
            const text = JSON.stringify(row);
            for (const leak of ['Awa', 'Diop', named.slice(4), plain.slice(4)]) assert.ok(!text.includes(leak), `audit sans « ${leak} » : ${text}`);
        }
    });
});

// ── 6 et 7. Confidentialité du nom ─────────────────────────────────────────

describe('9t.17 Invitations nommées : nom jamais exposé', () => {
    test('6. nom illisible par REST et Realtime', async () => {
        const rights = await inspect(async (db) => {
            const out: Record<string, boolean> = {};
            for (const role of ['anon', 'authenticated']) {
                try {
                    const { rows } = await db.query<{ ok: boolean }>(`SELECT has_column_privilege($1, 'public.tickets', 'guest_name', 'SELECT') AS ok`, [role]);
                    out[role] = rows[0].ok;
                } catch (err) {
                    const e = err as { code?: string; message?: string };
                    assert.fail(`tickets.guest_name illisible au catalogue (${e.code} ${e.message}) : colonne absente (migration 20261110000008)`);
                }
            }
            return out;
        });
        assert.deepEqual(rights, { anon: false, authenticated: false }, `aucun GRANT SELECT de colonne : ${JSON.stringify(rights)}`);

        const ev = await newEvent('confidentialite');
        const ctrl = await newController(partner, ev.eventId, { label: 'nom-rest' });
        const ctrlClient = await signedInClient({ email: ctrl.email });
        const ownerClient = await signedInClient({ email: partner.email });
        try {
            const { error } = await ctrlClient.from('tickets').select('guest_name').eq('event_id', ev.eventId);
            assert.equal(error?.code, '42501', `contrôleur affecté : lecture REST de guest_name refusée (42501) : ${JSON.stringify(error)}`);
            const feed = subscribeCollect(ownerClient, { table: 'tickets', filter: `event_id=eq.${ev.eventId}` }, { label: 'propriétaire, billets de l’événement' });
            const ctrlFeed = subscribeCollect(ctrlClient, { table: 'tickets', filter: `event_id=eq.${ev.eventId}` }, { label: 'contrôleur, billets de l’événement' });
            await Promise.all([feed.ready, ctrlFeed.ready]);
            const phone = randomSenegalPhone('76');
            const sent = await sendInvitations(partner, ev.eventId, body(ev, [phone], 1, ['Awa Diop']));
            assert.equal(sent.status, 200, show(sent));
            const [t] = await ticketsTo(phone);
            const cancel = await routeHandler('../../app/api/partner/events/[id]/invitations/[ticketId]/cancel/route', 'POST', 'annulation d’une invitation');
            const cancelled = await invoke(cancel, authed(`/api/partner/events/${ev.eventId}/invitations/${t.id}/cancel`, 'POST', partner),
                routeContext({ id: ev.eventId, ticketId: String(t.id) }));
            assert.equal(cancelled.status, 200, `changement de statut du billet : ${show(cancelled)}`);
            const leak = (e: { new: Row; old: Row }): boolean => 'guest_name' in e.new || 'guest_name' in e.old || JSON.stringify(e).includes('Awa Diop');
            await expectNothing(feed, 3_000, leak, 'Realtime de la propriétaire : aucun nom d’invité');
            await expectNothing(ctrlFeed, 0, leak, 'Realtime du contrôleur : aucun nom d’invité');
        } finally {
            await disposeClients(ctrlClient, ownerClient);
        }
    });

    test('7. aucun nom dans les messages', async () => {
        const ev = await newEvent('messages');
        const phone = randomSenegalPhone('76');
        const sent = await sendInvitations(partner, ev.eventId, body(ev, [phone], 1, ['Awa Diop']));
        assert.equal(sent.status, 200, show(sent));
        const rows = await outboxRows({ eventId: ev.eventId });
        assert.ok(rows.length > 0, 'précondition : l’invitation a mis un SMS en file');
        const leaks = rows.filter((r) => 'guest_name' in (r.template_data ?? {}) || JSON.stringify(r.template_data).includes('Awa Diop'));
        assert.deepEqual(leaks.map((r) => r.id), [], 'aucun nom d’invité dans template_data (x12)');
    });
});
