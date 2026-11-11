/**
 * Lot 9, tâche 9.0 — outil d'invitations : envoi par le partenaire, droits, forme, stock, attribution, liste,
 * SMS, audit, pilotage et export (contrat 4.1 et 5.1, L1 à L16, AR15 ; découverte 9-invitations, section 4.1).
 *  - POST /api/partner/events/[id]/invitations : propriétaire, ADMIN avec events.write et SUPERADMIN seuls ;
 *    tiers (partenaire, client, contrôleur) 404 ; ADMIN sans permission 403 ; statuts PUBLIE et VALIDE seuls ;
 *  - forme Zod : 1 à 10 numéros distincts au format sénégalais, 1 à 4 billets par numéro ;
 *  - toute catégorie est admise, sauf inactive ; événement passé et stock insuffisant refusés sans écriture ;
 *  - billet : canal INVITATION, prix 0, décision INVITATION, aucun paiement, stock décrémenté ; au compte si le
 *    numéro est vérifié et ACTIF, sinon billet sans porteur et transfert PENDING sans expéditeur (AR15) ;
 *  - réponse identique avec ou sans compte (L7), liste sans numéro de billet ni QR ;
 *  - SMS INVITATION_RECEIVED : une ligne SMS par numéro, ESSENTIAL, sans actor_id ni compte (lot 9 bis, R79 : in-app et push au compte vérifié), texte exact, 1 segment
 *    GSM-7 (calculé ici), aucun claim, token, 6 chiffres ; audit sans numéro en clair ;
 *  - pilotage (invitations comptées à part, restants) et CSV (colonne « Canal », nom « Invitation en attente »).
 *
 * Rouge avant correctif : ni la route app/api/partner/events/[id]/invitations/route.ts, ni la RPC
 * ticket_invitation_create (M2), ni le type INVITATION_RECEIVED n'existent : chaque cas échoue en nommant la route
 * absente ; after() : assertLot9Invariants nomme le schéma manquant jusqu'à M2 et M4.
 * Déjà vrai sur le code actuel : le 401 du middleware sans session (préfixe /api/partner non public) ; garde-fou,
 * le même cas exige aussi le 401 AUTH_REQUIRED de la route, absente aujourd'hui.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { callMiddleware } from '../helpers/middleware';
import { smsDateTime } from '../../lib/notifications/sms-format';
import { BASE_URL, jsonRequest, randomSenegalPhone, routeContext } from './helpers';
import { categoryState, eventTickets, newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, type RouteResult } from './acces-helpers';
import { advanceEventTo, createDraftEvent, createEventInStatus, shiftEventDates, type EventStatus } from './cycle-helpers';
import { dispatchAt, markPhoneVerified, newAdmin, outboxRows, smsMark, smsTo } from './notif-helpers';
import { findItem, invoke, listAt, numberAt, participantsExport, pilotageOk, routeHandler, show, showExport } from './pilotage-helpers';

type Row = Record<string, unknown>;

const ROUTE = '../../app/api/partner/events/[id]/invitations/route';
const POST_LABEL = 'POST /api/partner/events/[id]/invitations (contrat 4.1)';
const GET_LABEL = 'GET /api/partner/events/[id]/invitations (contrat 4.1)';
const STANDARD = 'Standard';
const CATEGORIES: CategorySpec[] = [{ name: STANDARD, price: 5_000, total: 30, maxPerOrder: 10 }];
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const LIST_ITEM_KEYS = ['can_cancel', 'category', 'channel', 'created_at', 'phone_masked', 'price', 'status_label', 'ticket_id'];

let partner: TestPartner;

before(async () => {
    partner = await newPartner('invitations');
});

after(async () => {
    await assertLot9Invariants('invitations');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function pathOf(eventId: string): string {
    return `/api/partner/events/${eventId}/invitations`;
}

async function send(user: Buyer | null, eventId: string, body: unknown): Promise<RouteResult> {
    const handler = await routeHandler(ROUTE, 'POST', POST_LABEL);
    const req = user ? authed(pathOf(eventId), 'POST', user, body) : jsonRequest(pathOf(eventId), body);
    return invoke(handler, req, routeContext({ id: eventId }));
}

async function list(user: Buyer | null, eventId: string, page?: number): Promise<RouteResult> {
    const handler = await routeHandler(ROUTE, 'GET', GET_LABEL);
    const path = page === undefined ? pathOf(eventId) : `${pathOf(eventId)}?page=${page}`;
    const req = user ? authed(path, 'GET', user) : new NextRequest(`${BASE_URL}${path}`, { method: 'GET' });
    return invoke(handler, req, routeContext({ id: eventId }));
}

function payload(ev: SaleEvent, phones: string[], quantity = 1, category = STANDARD): Row {
    return { category_id: ev.categories[category].id, phones, quantity };
}

async function sendOk(user: Buyer, ev: SaleEvent, phones: string[], quantity = 1): Promise<RouteResult> {
    const res = await send(user, ev.eventId, payload(ev, phones, quantity));
    assert.equal(res.status, 200, `envoi accepté attendu : ${show(res)}`);
    return res;
}

function newEvent(label: string, categories: CategorySpec[] = CATEGORIES): Promise<SaleEvent> {
    return createTimedEvent(partner.partnerId, `invitations ${label}`, categories, { startsInHours: 48 });
}

async function verifiedAccount(label: string): Promise<Buyer> {
    const account = await newBuyer(`inv-${label}`, { firstName: 'Fatou', lastName: 'Invitee' });
    await markPhoneVerified(account.userId);
    return account;
}

async function invitationTickets(eventId: string): Promise<Row[]> {
    return (await eventTickets(eventId)).filter((t) => t.sale_channel === 'INVITATION');
}

async function transfersOf(ticketIds: string[]): Promise<Row[]> {
    const { data, error } = await service.from('ticket_transfers').select('*').in('ticket_id', ticketIds);
    assert.equal(error, null, `transferts : ${error?.message}`);
    return (data ?? []) as Row[];
}

function assertRefusal(res: RouteResult, status: number, code: string, what: string): void {
    assert.equal(res.status, status, `${what} : ${status} attendu, ${show(res)}`);
    assert.equal(res.body.code, code, `${what} : code ${code} attendu, ${show(res)}`);
    assert.equal(typeof res.body.error, 'string', `${what} : message d’erreur, ${show(res)}`);
    assert.doesNotMatch(String(res.body.error), /[A-Z]+_[A-Z_]+|PGRST|\bnull\b|\bundefined\b/, `${what} : aucun texte technique à l’écran, ${show(res)}`);
}

async function assertNoWrite(ev: SaleEvent, what: string): Promise<void> {
    assert.deepEqual(await eventTickets(ev.eventId), [], `${what} : aucun billet créé`);
    assert.equal((await categoryState(ev.categories[STANDARD].id)).sold, 0, `${what} : stock inchangé`);
    assert.deepEqual(await outboxRows({ type: 'INVITATION_RECEIVED', eventId: ev.eventId }), [], `${what} : aucun SMS en file`);
}

function problemCodes(res: RouteResult): string[] {
    assert.ok(Array.isArray(res.body.problems), `réponse avec problems : ${show(res)}`);
    return (res.body.problems as Row[]).map((p) => String(p.code));
}

function eventEnd(eventId: string): Promise<Date> {
    return inspect(async (db) => (await db.query<{ at: Date }>('SELECT public.event_end_at($1::uuid) AS at', [eventId])).rows[0].at);
}

/** Alphabet GSM-7 de base et d'extension : calcul indépendant du module testé. */
const GSM7_BASIC = new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
const GSM7_EXTENSION = new Set(Array.from('\f^{}\\[~]|€'));

function septets(text: string): number {
    let total = 0;
    for (const ch of Array.from(text)) {
        if (GSM7_BASIC.has(ch)) total += 1;
        else if (GSM7_EXTENSION.has(ch)) total += 2;
        else assert.fail(`caractère hors GSM-7 « ${ch} » dans : ${text}`);
    }
    return total;
}

function withoutUuids(value: unknown): string {
    return JSON.stringify(value).replace(UUID_RE, '');
}

function maskOf(phone: string): string {
    return `+221***${phone.slice(-2)}`;
}

// ── Droits ─────────────────────────────────────────────────────────────────

describe('9.0 Invitations : droits (contrat 4.1, 5.1 étape 3)', () => {
    test('sans session : middleware 401 sur /api/partner/events/<id>/invitations, puis route 401 AUTH_REQUIRED en POST et en GET', async () => {
        const ev = await newEvent('anonyme');
        const mw = await callMiddleware(pathOf(ev.eventId), []);
        assert.equal(mw.status, 401, `middleware sans session : ${JSON.stringify(mw)}`);
        const post = await send(null, ev.eventId, payload(ev, [randomSenegalPhone('76')]));
        assertRefusal(post, 401, 'AUTH_REQUIRED', 'POST sans session');
        const get = await list(null, ev.eventId);
        assertRefusal(get, 401, 'AUTH_REQUIRED', 'GET sans session');
        await assertNoWrite(ev, 'sans session');
    });

    test('partenaire propriétaire : 200 { ok, ticket_count, phone_count, message }', async () => {
        const ev = await newEvent('proprietaire');
        const phones = [randomSenegalPhone('76'), randomSenegalPhone('76')];
        const res = await sendOk(partner, ev, phones, 2);
        assert.equal(res.body.ok, true, show(res));
        assert.equal(res.body.ticket_count, 4, `2 numéros × 2 billets : ${show(res)}`);
        assert.equal(res.body.phone_count, 2, show(res));
        assert.equal(typeof res.body.message, 'string', show(res));
    });

    test('tiers : autre partenaire, client et contrôleur affecté → 404 EVENT_NOT_FOUND, sans écriture ; un actor_id dans le corps n’y change rien', async () => {
        const ev = await newEvent('tiers');
        const other = await newPartner('invitations-tiers');
        const client = await newBuyer('inv-client');
        const controller = await newController(partner, ev.eventId, { label: 'invitations' });
        for (const [who, label] of [[other, 'autre partenaire'], [client, 'client'], [controller, 'contrôleur affecté']] as Array<[Buyer, string]>) {
            const res = await send(who, ev.eventId, { ...payload(ev, [randomSenegalPhone('76')]), actor_id: partner.userId, user_id: partner.userId });
            assertRefusal(res, 404, 'EVENT_NOT_FOUND', label);
        }
        await assertNoWrite(ev, 'tiers');
    });

    test('ADMIN sans events.write : 403 FORBIDDEN ; ADMIN avec events.write et SUPERADMIN : 200', async () => {
        const ev = await newEvent('admins');
        const readOnly = await newAdmin('inv-lecture', ['events.read']);
        assertRefusal(await send(readOnly, ev.eventId, payload(ev, [randomSenegalPhone('76')])), 403, 'FORBIDDEN', 'ADMIN sans events.write');
        await assertNoWrite(ev, 'ADMIN sans events.write');

        const writer = await newAdmin('inv-ecriture', ['events.write']);
        assert.equal((await sendOk(writer, ev, [randomSenegalPhone('76')])).body.ok, true);
        const root = await newAdmin('inv-super', [], { role: 'SUPERADMIN' });
        assert.equal((await sendOk(root, ev, [randomSenegalPhone('76')])).body.ok, true);
        assert.equal((await invitationTickets(ev.eventId)).length, 2, 'un billet par envoi accepté');
    });

    test('compte inactif : route 403 ACCOUNT_NOT_ACTIVE ; RPC directe ACCOUNT_NOT_ACTIVE', async () => {
        const off = await newPartner('invitations-inactif');
        const ev = await createTimedEvent(off.partnerId, 'invitations inactif', CATEGORIES, { startsInHours: 48 });
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', off.userId);
        assert.equal(error, null, `compte suspendu : ${error?.message}`);
        const res = await send(off, ev.eventId, payload(ev, [randomSenegalPhone('76')]));
        assert.equal(res.status, 403, show(res));
        assert.equal(res.body.code, 'ACCOUNT_NOT_ACTIVE', show(res));
        const rpc = await service.rpc('ticket_invitation_create', {
            p: { actor_id: off.userId, event_id: ev.eventId, category_id: ev.categories[STANDARD].id, phones: [randomSenegalPhone('76')], quantity: 1, limits: { per_event_hour: 50, per_phone_day: 3 } },
        });
        assert.equal(rpc.error, null, `ticket_invitation_create : ${rpc.error?.message} (RPC de M2)`);
        assert.equal((rpc.data as Row).code, 'ACCOUNT_NOT_ACTIVE', JSON.stringify(rpc.data));
        await assertNoWrite(ev, 'compte inactif');
    });

    test('statuts BROUILLON, EN_ATTENTE, SUSPENDU, TERMINE, ANNULE : 409 EVENT_NOT_ACTIVE, sans écriture', async () => {
        const opts: Partial<Record<EventStatus, Parameters<typeof createEventInStatus>[4]>> = {
            TERMINE: { startsInHours: 48, finishShift: { startsInHours: -8, durationHours: 4 } },
        };
        for (const status of ['BROUILLON', 'EN_ATTENTE', 'SUSPENDU', 'TERMINE', 'ANNULE'] as EventStatus[]) {
            const ev = await createEventInStatus(partner, `invitations ${status}`, CATEGORIES, status, opts[status] ?? { startsInHours: 48 });
            assertRefusal(await send(partner, ev.eventId, payload(ev, [randomSenegalPhone('76')])), 409, 'EVENT_NOT_ACTIVE', `événement ${status}`);
            await assertNoWrite(ev, `événement ${status}`);
        }
    });

    test('statuts VALIDE et PUBLIE : acceptés, billets créés', async () => {
        for (const status of ['VALIDE', 'PUBLIE'] as EventStatus[]) {
            const ev = await createEventInStatus(partner, `invitations ${status}`, CATEGORIES, status, { startsInHours: 48 });
            assert.equal((await sendOk(partner, ev, [randomSenegalPhone('76')])).body.ok, true, `événement ${status}`);
            assert.equal((await invitationTickets(ev.eventId)).length, 1, `événement ${status} : un billet`);
        }
    });

    test('événement inconnu : 404 EVENT_NOT_FOUND', async () => {
        const ev = await newEvent('inconnu');
        const fake = '00000000-0000-4000-8000-00000000abcd';
        assertRefusal(await send(partner, fake, payload(ev, [randomSenegalPhone('76')])), 404, 'EVENT_NOT_FOUND', 'identifiant inconnu');
    });
});

// ── Forme ──────────────────────────────────────────────────────────────────

describe('9.0 Invitations : forme de la demande (contrat 4.1, Zod)', () => {
    test('11 numéros, aucun numéro, 5 billets, 0 billet, numéro invalide, doublon, catégorie non uuid : 400 INVALID_FIELD avec field', async () => {
        const ev = await newEvent('forme');
        const one = randomSenegalPhone('76');
        const many = Array.from({ length: 11 }, () => randomSenegalPhone('76'));
        const cat = ev.categories[STANDARD].id;
        const cases: Array<[string, Row, string]> = [
            ['11 numéros', { category_id: cat, phones: many, quantity: 1 }, 'phones'],
            ['aucun numéro', { category_id: cat, phones: [], quantity: 1 }, 'phones'],
            ['5 billets par numéro', { category_id: cat, phones: [one], quantity: 5 }, 'quantity'],
            ['0 billet', { category_id: cat, phones: [one], quantity: 0 }, 'quantity'],
            ['numéro hors format', { category_id: cat, phones: ['+33612345678'], quantity: 1 }, 'phones'],
            ['préfixe 74 refusé', { category_id: cat, phones: ['+221741234567'], quantity: 1 }, 'phones'],
            ['même numéro sous deux formes', { category_id: cat, phones: [one, one.slice(4)], quantity: 1 }, 'phones'],
            ['catégorie non uuid', { category_id: 'pas-un-uuid', phones: [one], quantity: 1 }, 'category_id'],
        ];
        for (const [label, body, field] of cases) {
            const res = await send(partner, ev.eventId, body);
            assertRefusal(res, 400, 'INVALID_FIELD', label);
            assert.ok(String(res.body.field).startsWith(field), `${label} : field ${field} attendu, ${show(res)}`);
        }
        await assertNoWrite(ev, 'forme invalide');
    });

    test('corps illisible : 400 INVALID_BODY', async () => {
        const ev = await newEvent('corps');
        const handler = await routeHandler(ROUTE, 'POST', POST_LABEL);
        const res = await invoke(handler, new NextRequest(`${BASE_URL}${pathOf(ev.eventId)}`, {
            method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${partner.accessToken}` }, body: '{',
        }), routeContext({ id: ev.eventId }));
        assertRefusal(res, 400, 'INVALID_BODY', 'corps illisible');
    });

    test('limites admises : 10 numéros, 4 billets par numéro ; numéro à 9 chiffres normalisé en +221', async () => {
        const ev = await newEvent('limites', [{ name: STANDARD, price: 5_000, total: 60, maxPerOrder: 10 }]);
        const phones = Array.from({ length: 10 }, () => randomSenegalPhone('76'));
        const res = await sendOk(partner, ev, phones, 4);
        assert.equal(res.body.ticket_count, 40, show(res));
        assert.equal(res.body.phone_count, 10, show(res));
        const local = randomSenegalPhone('76');
        await sendOk(partner, ev, [local.slice(4)], 1);
        const tickets = await invitationTickets(ev.eventId);
        const transfers = await transfersOf(tickets.map((t) => String(t.id)));
        assert.equal(transfers.filter((x) => x.to_phone_or_email === local).length, 1, 'cible normalisée en +221');
    });
});

// ── Catégories et stock ────────────────────────────────────────────────────

describe('9.0 Invitations : catégories admises et stock (L5, 5.1 étapes 5 et 6)', () => {
    test('catégorie sans canal, vente close, un billet maximum par commande : acceptée, décision à faux sur les deux canaux', async () => {
        const ev = await newEvent('sans-canal', [{ name: STANDARD, price: 5_000, total: 30, maxPerOrder: 1 }]);
        const past = (hours: number): string => new Date(Date.now() - hours * 3600_000).toISOString();
        const { error } = await service.from('ticket_categories')
            .update({ sale_online: false, sale_counter: false, sale_start: past(48), sale_end: past(24) }).eq('id', ev.categories[STANDARD].id);
        assert.equal(error, null, `catégorie sans canal : ${error?.message}`);
        await sendOk(partner, ev, [randomSenegalPhone('76')], 4);
        const tickets = await invitationTickets(ev.eventId);
        assert.equal(tickets.length, 4, 'quatre billets malgré max_per_order à 1');
        for (const t of tickets) {
            const decision = t.sale_decision as Row;
            assert.equal(decision.source, 'INVITATION', JSON.stringify(decision));
            assert.equal(decision.sale_online, false, JSON.stringify(decision));
            assert.equal(decision.sale_counter, false, JSON.stringify(decision));
        }
    });

    test('catégorie vendue en ligne : acceptée, décision à vrai', async () => {
        const ev = await newEvent('en-ligne');
        await sendOk(partner, ev, [randomSenegalPhone('76')]);
        const [ticket] = await invitationTickets(ev.eventId);
        assert.equal((ticket.sale_decision as Row).source, 'INVITATION', JSON.stringify(ticket.sale_decision));
        assert.equal((ticket.sale_decision as Row).sale_online, true, JSON.stringify(ticket.sale_decision));
    });

    test('catégorie inactive : 409 SALE_CHECK_FAILED, problems CATEGORY_INACTIVE, sans écriture', async () => {
        const ev = await newEvent('inactive', [{ name: STANDARD, price: 5_000, total: 30, isActive: false }, { name: 'Active', price: 5_000, total: 30 }]);
        const res = await send(partner, ev.eventId, payload(ev, [randomSenegalPhone('76')]));
        assertRefusal(res, 409, 'SALE_CHECK_FAILED', 'catégorie inactive');
        assert.deepEqual(problemCodes(res), ['CATEGORY_INACTIVE'], show(res));
        await assertNoWrite(ev, 'catégorie inactive');
    });

    test('catégorie d’un autre événement : 409 SALE_CHECK_FAILED, sans écriture des deux côtés', async () => {
        const ev = await newEvent('categorie-a');
        const elsewhere = await newEvent('categorie-b');
        const res = await send(partner, ev.eventId, { category_id: elsewhere.categories[STANDARD].id, phones: [randomSenegalPhone('76')], quantity: 1 });
        assertRefusal(res, 409, 'SALE_CHECK_FAILED', 'catégorie d’un autre événement');
        await assertNoWrite(ev, 'catégorie étrangère, événement visé');
        await assertNoWrite(elsewhere, 'catégorie étrangère, son événement');
    });

    test('événement passé : 409 SALE_CHECK_FAILED, problems EVENT_PAST', async () => {
        const ev = await newEvent('passe');
        await shiftEventDates(ev.eventId, { startsInHours: -10, durationHours: 4 });
        const res = await send(partner, ev.eventId, payload(ev, [randomSenegalPhone('76')]));
        assertRefusal(res, 409, 'SALE_CHECK_FAILED', 'événement passé');
        assert.ok(problemCodes(res).includes('EVENT_PAST'), show(res));
        await assertNoWrite(ev, 'événement passé');
    });

    test('stock : au-delà du restant (numéros × quantité) 409 INSUFFICIENT_STOCK sans écriture ; exactement le restant accepté, stock décrémenté, réservé à 0', async () => {
        const ev = await newEvent('stock', [{ name: STANDARD, price: 5_000, total: 6, maxPerOrder: 10 }]);
        const phones = [randomSenegalPhone('76'), randomSenegalPhone('76'), randomSenegalPhone('76')];
        const over = await send(partner, ev.eventId, payload(ev, [...phones, randomSenegalPhone('76')], 2));
        assertRefusal(over, 409, 'SALE_CHECK_FAILED', 'stock dépassé');
        assert.deepEqual(problemCodes(over), ['INSUFFICIENT_STOCK'], show(over));
        await assertNoWrite(ev, 'stock dépassé');

        await sendOk(partner, ev, phones, 2);
        assert.deepEqual(await categoryState(ev.categories[STANDARD].id), { sold: 6, held: 0, total: 6 }, 'stock décrémenté comme une vente');
        assert.equal((await invitationTickets(ev.eventId)).length, 6, 'autant de billets que de places décomptées');
        assertRefusal(await send(partner, ev.eventId, payload(ev, [randomSenegalPhone('76')])), 409, 'SALE_CHECK_FAILED', 'catégorie pleine');
    });
});

// ── Billets et attribution ─────────────────────────────────────────────────

describe('9.0 Invitations : billet créé et attribution (L3, L6, AR15)', () => {
    test('compte ACTIF au numéro vérifié : billets au compte, canal INVITATION, prix 0, décision INVITATION, aucun paiement, aucun transfert', async () => {
        const ev = await newEvent('compte');
        const account = await verifiedAccount('compte');
        await sendOk(partner, ev, [account.phoneE164], 2);
        const tickets = await invitationTickets(ev.eventId);
        assert.equal(tickets.length, 2, 'deux billets');
        for (const t of tickets) {
            assert.equal(t.user_id, account.userId, 'billet au compte du numéro');
            assert.equal(t.transfer_locked, false, 'billet libre');
            assert.equal(Number(t.price), 0, 'prix 0 malgré une catégorie à 5 000');
            assert.equal(t.status, 'VALIDE', 'billet valide');
            assert.equal(t.payment_id, null, 'aucun paiement');
            assert.equal((t.sale_decision as Row).source, 'INVITATION', JSON.stringify(t.sale_decision));
            assert.ok(t.ticket_number && t.qr_code, 'numéro et QR générés');
        }
        assert.deepEqual(await transfersOf(tickets.map((t) => String(t.id))), [], 'aucun transfert pour une attribution directe');
    });

    test('numéro sans compte : billets sans porteur et verrouillés, un transfert PENDING par billet, sans expéditeur ni jeton, échéance à la fin de l’événement', async () => {
        const ev = await newEvent('sans-compte');
        const phone = randomSenegalPhone('76');
        await sendOk(partner, ev, [phone], 3);
        const tickets = await invitationTickets(ev.eventId);
        assert.equal(tickets.length, 3, 'trois billets');
        for (const t of tickets) {
            assert.equal(t.user_id, null, 'billet sans porteur (L3)');
            assert.equal(t.transfer_locked, true, 'billet verrouillé jusqu’à la réclamation');
            assert.equal(t.status, 'VALIDE', 'billet valide');
        }
        const transfers = await transfersOf(tickets.map((t) => String(t.id)));
        assert.equal(transfers.length, 3, 'une ligne de transfert par billet');
        const end = await eventEnd(ev.eventId);
        for (const x of transfers) {
            assert.equal(x.status, 'PENDING', JSON.stringify(x));
            assert.equal(x.from_user_id, null, 'aucun expéditeur (L3)');
            assert.equal(x.claim_token_hash, null, 'aucun jeton');
            assert.equal(x.to_phone_or_email, phone, 'cible : le numéro');
            assert.equal(new Date(String(x.expires_at)).getTime(), end.getTime(), 'échéance = fin de l’événement (L8)');
        }
        const { data, error } = await service.from('users').select('id').eq('phone', phone);
        assert.equal(error, null, `comptes : ${error?.message}`);
        assert.deepEqual(data ?? [], [], 'aucun compte créé par l’invitation');
    });

    test('compte au numéro non vérifié ou compte suspendu : attente (AR15), jamais attribué', async () => {
        const ev = await newEvent('non-verifie');
        const unverified = await newBuyer('inv-non-verifie');
        const suspended = await verifiedAccount('suspendu');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspended.userId);
        assert.equal(error, null, `compte suspendu : ${error?.message}`);
        await sendOk(partner, ev, [unverified.phoneE164, suspended.phoneE164]);
        const tickets = await invitationTickets(ev.eventId);
        assert.equal(tickets.length, 2, 'deux billets');
        assert.ok(tickets.every((t) => t.user_id === null && t.transfer_locked === true), `billets en attente : ${JSON.stringify(tickets.map((t) => t.user_id))}`);
        const targets = (await transfersOf(tickets.map((t) => String(t.id)))).map((x) => x.to_phone_or_email).sort();
        assert.deepEqual(targets, [unverified.phoneE164, suspended.phoneE164].sort(), 'un transfert par numéro');
    });

    test('réponse identique avec ou sans compte : aucune énumération (L7)', async () => {
        const ev = await newEvent('enumeration');
        const account = await verifiedAccount('enumeration');
        const withAccount = await sendOk(partner, ev, [account.phoneE164], 2);
        const without = await sendOk(partner, ev, [randomSenegalPhone('76')], 2);
        assert.deepEqual(without.body, withAccount.body, 'même réponse');
    });
});

// ── Liste ──────────────────────────────────────────────────────────────────

describe('9.0 Invitations : liste du pilotage (L7, L14, 4.1)', () => {
    test('GET : mêmes champs avec ou sans compte, statut « Envoyée », numéro masqué ; ni numéro de billet, ni QR, ni numéro en clair', async () => {
        const ev = await newEvent('liste');
        const account = await verifiedAccount('liste');
        const phone = randomSenegalPhone('76');
        await sendOk(partner, ev, [account.phoneE164, phone]);
        const res = await list(partner, ev.eventId);
        assert.equal(res.status, 200, show(res));
        assert.equal(res.body.page, 1, show(res));
        assert.equal(res.body.page_size, 50, show(res));
        assert.equal(res.body.total_count, 2, show(res));
        const items = res.body.items as Row[];
        assert.equal(items.length, 2, show(res));
        for (const item of items) {
            assert.deepEqual(Object.keys(item).sort(), LIST_ITEM_KEYS, `champs exacts : ${JSON.stringify(item)}`);
            assert.equal(item.category, STANDARD, JSON.stringify(item));
            assert.equal(Number(item.price), 0, JSON.stringify(item));
            assert.equal(item.channel, 'Invitation', JSON.stringify(item));
            assert.equal(item.status_label, 'Envoyée', `aucun état « en attente » montré au partenaire : ${JSON.stringify(item)}`);
            assert.equal(item.can_cancel, true, JSON.stringify(item));
        }
        assert.deepEqual(items.map((i) => i.phone_masked).sort(), [maskOf(account.phoneE164), maskOf(phone)].sort(), show(res));
        const raw = JSON.stringify(res.body);
        for (const t of await invitationTickets(ev.eventId)) {
            assert.ok(!raw.includes(String(t.ticket_number)), `numéro de billet exposé : ${raw}`);
            assert.ok(!raw.includes(String(t.qr_code)), `QR exposé : ${raw}`);
        }
        for (const clear of [account.phoneE164, account.phone9, phone, phone.slice(4), account.lastName]) {
            assert.ok(!raw.includes(clear), `donnée en clair ${clear} : ${raw}`);
        }
    });

    test('page 2 vide, total conservé', async () => {
        const ev = await newEvent('page-2');
        await sendOk(partner, ev, [randomSenegalPhone('76')]);
        const res = await list(partner, ev.eventId, 2);
        assert.equal(res.status, 200, show(res));
        assert.deepEqual(res.body.items, [], show(res));
        assert.equal(res.body.page, 2, show(res));
        assert.equal(res.body.total_count, 1, show(res));
    });

    test('lecture : admin sans events.write 200 (L14) ; autre partenaire et client 404 EVENT_NOT_FOUND', async () => {
        const ev = await newEvent('lecture');
        await sendOk(partner, ev, [randomSenegalPhone('76')]);
        const reader = await newAdmin('inv-liste', ['events.read']);
        const asAdmin = await list(reader, ev.eventId);
        assert.equal(asAdmin.status, 200, show(asAdmin));
        assert.equal(asAdmin.body.total_count, 1, show(asAdmin));
        const other = await newPartner('invitations-liste');
        const client = await newBuyer('inv-liste-client');
        for (const [who, label] of [[other, 'autre partenaire'], [client, 'client']] as Array<[Buyer, string]>) {
            assertRefusal(await list(who, ev.eventId), 404, 'EVENT_NOT_FOUND', label);
        }
    });
});

// ── SMS ────────────────────────────────────────────────────────────────────

describe('9.0 Invitations : SMS INVITATION_RECEIVED (L10, AR15, 5.1 étape 9)', () => {
    test('une ligne SMS par numéro, ESSENTIAL, sans actor_id ni compte, même pour un compte vérifié (in-app et push au compte, R79) ; quantité portée dans les données', async () => {
        const ev = await newEvent('sms-lignes');
        const account = await verifiedAccount('sms');
        const phone = randomSenegalPhone('76');
        await sendOk(partner, ev, [account.phoneE164, phone], 2);
        const rows = await outboxRows({ type: 'INVITATION_RECEIVED', eventId: ev.eventId, channel: 'SMS' }); // lot 9 bis (R79, T57) : lignes SMS seules pour L10/AR15
        assert.equal(rows.length, 2, `une ligne SMS par numéro : ${JSON.stringify(rows.map((r) => r.recipient_phone))}`);
        assert.deepEqual(rows.map((r) => r.recipient_phone).sort(), [account.phoneE164, phone].sort(), 'destinataires');
        const ticketIds = new Set((await invitationTickets(ev.eventId)).map((t) => String(t.id)));
        for (const r of rows) {
            assert.equal(r.channel, 'SMS', JSON.stringify(r));
            assert.equal(r.family, 'ESSENTIAL', JSON.stringify(r));
            assert.equal(r.actor_id, null, `SMS hors quota par compte (AR15) : ${JSON.stringify(r)}`);
            assert.equal(r.recipient_user_id, null, JSON.stringify(r));
            assert.equal(r.template_data.ticket_count, 2, JSON.stringify(r.template_data));
            assert.ok(ticketIds.has(String(r.template_data.ticket_id)), `ticket_id de l’envoi : ${JSON.stringify(r.template_data)}`);
            assert.equal(r.idempotency_key, `INVITATION_RECEIVED:${r.template_data.ticket_id}:SMS`, JSON.stringify(r));
            assert.ok(!/claim|token/i.test(JSON.stringify(r.template_data)), `données sans jeton : ${JSON.stringify(r.template_data)}`);
        }
        const toAccount = (await outboxRows({ type: 'INVITATION_RECEIVED', userId: account.userId })).map((r) => r.channel); assert.ok(toAccount.includes('IN_APP') && toAccount.includes('PUSH') && !toAccount.includes('SMS'), `lot 9 bis (R79, T57, règle changée : L10 renversée par la consigne) : in-app et push au compte vérifié, jamais le SMS : ${JSON.stringify(toAccount)}`);
    });

    test('texte exact au singulier et au pluriel, 1 segment GSM-7, lien /tickets, aucun claim, token ni code à 6 chiffres', async () => {
        const title = 'Gala Invitation';
        const draft = await createDraftEvent(partner, 'invitations sms', CATEGORIES, { title, startsInHours: 96 });
        await advanceEventTo(draft.eventId, 'PUBLIE', { partnerUserId: partner.userId });
        const { data: dates, error } = await service.from('events').select('start_date, start_time').eq('id', draft.eventId).single();
        assert.equal(error, null, `dates : ${error?.message}`);
        assert.ok(APP_URL.startsWith('http'), 'NEXT_PUBLIC_APP_URL absente de .env.test');
        const when = smsDateTime(new Date(`${dates.start_date}T${dates.start_time}Z`).toISOString());

        for (const [quantity, words] of [[1, '1 invitation'], [2, '2 invitations']] as Array<[number, string]>) {
            const phone = randomSenegalPhone('76');
            const mark = smsMark(phone);
            await sendOk(partner, draft, [phone], quantity);
            const rows = await outboxRows({ type: 'INVITATION_RECEIVED', phone });
            assert.equal(rows.length, 1, `une ligne au ${phone}`);
            await dispatchAt(new Date(), { ids: rows.map((r) => r.id) });
            const got = smsTo(phone, mark).map((m) => m.message);
            assert.deepEqual(got, [`Event Village : ${words} pour ${title} le ${when}. Connectez-vous avec ce numéro : ${APP_URL}/tickets`], 'un SMS au texte exact');
            assert.ok(septets(got[0]) <= 160, `un segment GSM-7 : ${septets(got[0])} septets`);
            assert.doesNotMatch(got[0], /claim|token/i, got[0]);
            assert.doesNotMatch(got[0], /(?<![\w-])\d{6}(?![\w-])/, got[0]);
        }
    });
});

// ── Audit ──────────────────────────────────────────────────────────────────

describe('9.0 Invitations : audit (5.1 étape 10)', () => {
    test('TICKET_INVITATIONS_SENT : acteur, rôle, catégorie, nombres, numéros masqués ; ni numéro complet ni 9 chiffres', async () => {
        const ev = await newEvent('audit');
        const phones = [randomSenegalPhone('76'), randomSenegalPhone('76')];
        await sendOk(partner, ev, phones, 2);
        const categoryId = ev.categories[STANDARD].id;
        const { data, error } = await service.from('audit_logs').select('*')
            .eq('action', 'TICKET_INVITATIONS_SENT').eq('user_id', partner.userId).contains('metadata', { category_id: categoryId });
        assert.equal(error, null, `audit : ${error?.message}`);
        const rows = (data ?? []) as Row[];
        assert.equal(rows.length, 1, `une ligne d’audit : ${JSON.stringify(rows)}`);
        const [row] = rows;
        assert.equal(row.object_type, 'events', JSON.stringify(row));
        assert.equal(row.user_role, 'PARTENAIRE', JSON.stringify(row));
        const meta = row.metadata as Row;
        assert.deepEqual([...(meta.phones_masked as string[])].sort(), phones.map(maskOf).sort(), JSON.stringify(meta));
        assert.deepEqual({ ...meta, phones_masked: null }, { category_id: categoryId, category: STANDARD, phone_count: 2, ticket_count: 4, quantity: 2, phones_masked: null }, JSON.stringify(meta));
        const text = withoutUuids(row);
        for (const phone of phones) {
            assert.ok(!text.includes(phone), `numéro complet au journal : ${text}`);
            assert.ok(!text.includes(phone.slice(4)), `9 chiffres au journal : ${text}`);
        }
    });

    test('envoi par un ADMIN : rôle ADMIN au journal', async () => {
        const ev = await newEvent('audit-admin');
        const writer = await newAdmin('inv-audit', ['events.write']);
        await sendOk(writer, ev, [randomSenegalPhone('76')]);
        const { data, error } = await service.from('audit_logs').select('user_role')
            .eq('action', 'TICKET_INVITATIONS_SENT').eq('user_id', writer.userId).contains('metadata', { category_id: ev.categories[STANDARD].id });
        assert.equal(error, null, `audit : ${error?.message}`);
        assert.deepEqual(data, [{ user_role: 'ADMIN' }], JSON.stringify(data));
    });
});

// ── Pilotage et export ─────────────────────────────────────────────────────

describe('9.0 Invitations : pilotage et export (L13)', () => {
    test('pilotage : invitations comptées à part, hors ventes, restants diminués', async () => {
        const ev = await newEvent('pilotage');
        await sendOk(partner, ev, [randomSenegalPhone('76')], 3);
        const overview = await pilotageOk(partner, ev.eventId, 'overview', 'le partenaire propriétaire');
        assert.equal(numberAt(overview, 'tickets.invitations', 'invitations'), 3, 'trois invitations');
        assert.equal(numberAt(overview, 'tickets.sold', 'vendus'), 0, 'hors ventes');
        const sales = await pilotageOk(partner, ev.eventId, 'sales', 'le partenaire propriétaire');
        const row = findItem(listAt(sales, 'by_category', 'ventes par catégorie'), 'category_id', ev.categories[STANDARD].id, 'catégorie');
        assert.equal(numberAt(row, 'invitations', 'invitations de la catégorie'), 3, 'invitations de la catégorie');
        assert.equal(numberAt(row, 'remaining', 'restants'), 27, 'restants = 30 − 3');
    });

    test('CSV : colonne « Canal » en troisième position ; invitation en attente, invitation attribuée et vente en ligne ; aucun numéro', async () => {
        const ev = await newEvent('export');
        const account = await verifiedAccount('export');
        const pending = randomSenegalPhone('76');
        await sendOk(partner, ev, [account.phoneE164, pending]);
        const buyer = await newBuyer('inv-export', { firstName: 'Ramatoulaye', lastName: 'Acheteuse' });
        await buyConfirmed(buyer, ev, [[STANDARD, 1]]);

        const res = await participantsExport(partner, ev.eventId, { includeContacts: false });
        assert.equal(res.status, 200, showExport(res));
        const lines = res.text.split(/\r?\n/).filter((l) => l.trim() !== '').map((l) => l.split(';'));
        const [header, ...rows] = lines;
        assert.deepEqual(header, ['Nom', 'Catégorie', 'Canal', 'Statut du billet', 'Heure d’entrée'], showExport(res));
        assert.equal(rows.length, 3, showExport(res));
        const channelOf = (name: string): string | undefined => rows.find((r) => r[0].includes(name))?.[2];
        assert.equal(channelOf('Invitation en attente'), 'Invitation', showExport(res));
        assert.equal(channelOf(account.lastName), 'Invitation', showExport(res));
        assert.equal(channelOf(buyer.lastName), 'En ligne', showExport(res));
        assert.ok(!rows.some((r) => r[0].includes('Vente au guichet')), `une invitation en attente n’est pas une vente au guichet : ${showExport(res)}`);
        for (const clear of [pending, pending.slice(4), account.phoneE164]) assert.ok(!res.text.includes(clear), `numéro en clair ${clear}`);
    });
});
