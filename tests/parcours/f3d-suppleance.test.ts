/**
 * Finition 3d (recours et suppléance) — point 4, l'administration à la place d'une organisatrice.
 *
 * 4a. Remboursement en espèces marqué par un admin (droit refunds.manage), à tout moment (fiche de l'organisatrice
 *     suspendue comprise), motif obligatoire, journalisé : POST /api/admin/events/[id]/cash-refunds/[paymentId] { reason }.
 *     L'organisatrice est prévenue (cloche, push, email : CASH_REFUND_MARKED_BY_ADMIN, avec le motif) ; le client reçoit le
 *     même avis que si l'organisatrice avait marqué : aucun aujourd'hui, ni dans un cas ni dans l'autre (vérifié). La route
 *     de l'organisatrice refuse toujours un admin.
 * 4b. Page Équipe d'un admin : l'organisatrice se choisit dans une liste avec recherche (fini « ?partnerId= » tapé à la
 *     main) : GET /api/partner/team/organizers?q= — admin muni de events.read (le droit qui ouvre la lecture de l'équipe) ;
 *     recherche sans tenir compte des accents ni des majuscules (nom commercial, raison sociale, ville, titulaire) ;
 *     organisatrices validées ou suspendues seulement ; 20 au plus. Une organisatrice, un admin sans events.read, un
 *     appel sans session : refusés.
 * Fin de suite : assertFinition3dInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { assertFinition3dInvariants } from '../helpers/finition3d-invariants';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { importModule, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { authed, createTimedEvent, newController } from './acces-helpers';
import { assertRpcOk, eventStatus, rpcCancel } from './cycle-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

type Handler = (req: NextRequest) => Promise<Response>;
interface Organizer { partner_id: string; name: string; city: string | null; status: string }
type Row = Record<string, unknown>;

const TOKEN = randomBytes(3).toString('hex');
let reader: TestAdmin;
let organizer: TestPartner;
let suspended: TestPartner;

async function organizersRoute(): Promise<Handler> {
    const mod = (await importModule('../../app/api/partner/team/organizers/route')) as { GET?: Handler };
    assert.equal(typeof mod.GET, 'function', 'GET /api/partner/team/organizers absente');
    return mod.GET as Handler;
}

before(async () => {
    reader = await newAdmin('f3d-equipe-lecteur', ['events.read']);
    organizer = await newPartner(`f3d-equipe-${TOKEN}`);
    suspended = await newPartner(`f3d-equipe-susp-${TOKEN}`);
    const { error } = await service.from('partners').update({ commercial_name: `Gorée Événements ${TOKEN}`, city: 'Saint-Louis' }).eq('id', organizer.partnerId);
    assert.equal(error, null, error?.message);
    const { error: sErr } = await service.from('partners').update({ commercial_name: `Thiès Spectacles ${TOKEN}`, status: 'SUSPENDU' }).eq('id', suspended.partnerId);
    assert.equal(sErr, null, sErr?.message);
});

after(async () => {
    await assertFinition3dInvariants('f3d-suppleance');
});

describe('4b. Équipe d’un admin : choix de l’organisatrice par une liste avec recherche', () => {
    test('admin events.read : recherche sans accents ni majuscules, nom et ville rendus', async () => {
        const GET = await organizersRoute();
        const res = await GET(jsonRequest(`/api/partner/team/organizers?q=${encodeURIComponent(`GOREE evenements ${TOKEN}`)}`, 'GET', reader.accessToken));
        const body = (await res.json()) as { organizers?: Organizer[] };
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.deepEqual(body.organizers?.map((o) => [o.partner_id, o.name, o.city, o.status]),
            [[organizer.partnerId, `Gorée Événements ${TOKEN}`, 'Saint-Louis', 'VALIDE']]);
    });

    test('une organisatrice suspendue reste dans la liste (l’admin agit à sa place), statut rendu', async () => {
        const GET = await organizersRoute();
        const res = await GET(jsonRequest(`/api/partner/team/organizers?q=${encodeURIComponent(`thies ${TOKEN}`)}`, 'GET', reader.accessToken));
        const body = (await res.json()) as { organizers?: Organizer[] };
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.deepEqual(body.organizers?.map((o) => [o.partner_id, o.status]), [[suspended.partnerId, 'SUSPENDU']]);
    });

    test('sans recherche : 20 organisatrices au plus, triées par nom', async () => {
        const GET = await organizersRoute();
        const res = await GET(jsonRequest('/api/partner/team/organizers', 'GET', reader.accessToken));
        const body = (await res.json()) as { organizers?: Organizer[]; truncated?: boolean };
        assert.equal(res.status, 200, JSON.stringify(body).slice(0, 300));
        const names = (body.organizers ?? []).map((o) => o.name);
        assert.ok(names.length > 0 && names.length <= 20, `nombre rendu : ${names.length}`);
        assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })));
        assert.equal(typeof body.truncated, 'boolean');
    });

    test('refus : admin sans events.read (403 PERMISSION_MISSING), organisatrice (403), sans session (401)', async () => {
        const GET = await organizersRoute();
        const noRight = await newAdmin('f3d-equipe-sans-droit', ['users.read']);
        const r1 = await GET(jsonRequest('/api/partner/team/organizers', 'GET', noRight.accessToken));
        const b1 = (await r1.json()) as { code?: string; permission?: string };
        assert.deepEqual([r1.status, b1.code, b1.permission], [403, 'PERMISSION_MISSING', 'events.read'], JSON.stringify(b1));
        const r2 = await GET(jsonRequest('/api/partner/team/organizers', 'GET', organizer.accessToken));
        assert.equal(r2.status, 403, await r2.text());
        const r3 = await GET(jsonRequest('/api/partner/team/organizers', 'GET', null));
        assert.equal(r3.status, 401, await r3.text());
    });
});

// ── 4a. Espèces marquées rendues par un admin ─────────────────────────────────────────────────────────────────────────

const PRICE = 3_000;
const ADMIN_MARK_ROUTE = '../../app/api/admin/events/[id]/cash-refunds/[paymentId]/route';
const PARTNER_MARK_ROUTE = '../../app/api/partner/events/[id]/cash-refunds/[paymentId]/route';
const PIN_ROUTE = '../../app/api/partner/events/[id]/regisseur-pin/route';
const OPEN_ROUTE = '../../app/api/controller/shifts/open/route';
const COUNTER_ROUTE = '../../app/api/controller/counter-sale/route';

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

/** Recopie de lot9bis-guichet-annulation.test.ts : caisse OUVERT du vendeur, PIN régisseur de la propriétaire. */
async function openShiftWithPin(owner: TestPartner, seller: Buyer, eventId: string): Promise<string> {
    const pinHandler = await routeHandler(PIN_ROUTE, 'POST', 'POST /api/partner/events/[id]/regisseur-pin');
    const pinRes = await invoke(pinHandler, authed(`/api/partner/events/${eventId}/regisseur-pin`, 'POST', owner, { confirm: true }), ctx({ id: eventId }));
    assert.equal(pinRes.status, 200, `génération du PIN régisseur : ${show(pinRes)}`);
    const pin = String(pinRes.body.pin ?? '');
    const openHandler = await routeHandler(OPEN_ROUTE, 'POST', 'POST /api/controller/shifts/open');
    const res = await invoke(openHandler, authed('/api/controller/shifts/open', 'POST', seller, {
        eventId, event_id: eventId, openingFloat: 0, opening_float_amount: 0, pin, regisseurPin: pin, regisseur_pin: pin,
    }));
    assert.equal(res.status, 200, `ouverture de la caisse avec le PIN : ${show(res)}`);
    const { data, error } = await service.from('controller_shifts').select('id').eq('controller_id', seller.userId).eq('event_id', eventId).eq('status', 'OUVERT');
    assert.equal(error, null, error?.message);
    return String(data![0].id);
}

interface CashCase { owner: TestPartner; ev: SaleEvent; sales: Row[] }

/** Événement de la propriétaire, deux ventes au guichet (1 puis 2 billets), puis annulation par la propriétaire. */
async function cancelledEventWithCashSales(label: string): Promise<CashCase> {
    const owner = await newPartner(`f3d-esp-${label}`);
    const ev = await createTimedEvent(owner.partnerId, `f3d-esp-${label}`, [{ name: 'Standard', price: PRICE, total: 30 }]);
    const seller = await newController(owner, ev.eventId, { canAcceptCash: true, label: `f3d-esp-${label}` });
    const shiftId = await openShiftWithPin(owner, seller, ev.eventId);
    const counter = await routeHandler(COUNTER_ROUTE, 'POST', 'POST /api/controller/counter-sale');
    for (const quantity of [1, 2]) {
        const res = await invoke(counter, authed('/api/controller/counter-sale', 'POST', seller,
            { eventId: ev.eventId, items: [{ categoryId: ev.categories.Standard.id, quantity }] }, { 'idempotency-key': randomUUID() }));
        assert.equal(res.status, 200, `vente au guichet : ${show(res)}`);
    }
    const { data: sales, error } = await service.from('payments').select('*').eq('shift_id', shiftId).order('created_at');
    assert.equal(error, null, error?.message);
    assert.equal((sales ?? []).length, 2, 'deux ventes au guichet');
    const { data: title } = await service.from('events').select('title').eq('id', ev.eventId).single();
    assertRpcOk(await rpcCancel(ev.eventId, owner.userId, {
        publicNotice: 'Événement annulé : les espèces sont rendues à la billetterie.',
        internalReason: 'Annulation de test de la finition 3d (espèces)',
        confirmTitle: String(title?.title),
    }), 'annulation par la propriétaire');
    assert.equal(await eventStatus(ev.eventId), 'ANNULE');
    return { owner, ev, sales: (sales ?? []) as Row[] };
}

async function adminMark(admin: TestAdmin, c: CashCase, paymentId: string, body: Row) {
    const handler = await routeHandler(ADMIN_MARK_ROUTE, 'POST', 'POST /api/admin/events/[id]/cash-refunds/[paymentId] (finition 3d, point 4a)');
    return invoke(handler, jsonRequest(`/api/admin/events/${c.ev.eventId}/cash-refunds/${paymentId}`, 'POST', admin.accessToken, body),
        ctx({ id: c.ev.eventId, paymentId }));
}

/** Lignes de la boîte d'envoi de l'événement créées après `since`, hors avis à l'organisatrice de la 3d. */
async function clientSideNotices(eventId: string, since: string): Promise<Row[]> {
    const { data, error } = await service.from('notification_outbox').select('type, channel, recipient_user_id, recipient_phone')
        .eq('event_id', eventId).gt('created_at', since).neq('type', 'CASH_REFUND_MARKED_BY_ADMIN');
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

describe('4a. espèces marquées rendues par un admin (refunds.manage), à la place de l’organisatrice', () => {
    let c: CashCase;
    let refunder: TestAdmin;
    before(async () => {
        c = await cancelledEventWithCashSales('a');
        refunder = await newAdmin('f3d-esp-rembourse', ['refunds.manage']);
    });

    test('motif obligatoire : 400 REASON_REQUIRED, aucune marque', async () => {
        const r = await adminMark(refunder, c, String(c.sales[0].id), { reason: ' ' });
        assert.deepEqual([r.status, r.body.code], [400, 'REASON_REQUIRED'], show(r));
        const { data } = await service.from('event_cash_refund_marks').select('payment_id').eq('event_id', c.ev.eventId);
        assert.deepEqual(data ?? [], []);
    });

    test('sans refunds.manage : 403 PERMISSION_MISSING', async () => {
        const reader = await newAdmin('f3d-esp-lecteur', ['events.read', 'events.write']);
        const r = await adminMark(reader, c, String(c.sales[0].id), { reason: 'Espèces rendues au guichet' });
        assert.deepEqual([r.status, r.body.code, r.body.permission], [403, 'PERMISSION_MISSING', 'refunds.manage'], show(r));
    });

    test('la route de l’organisatrice refuse toujours un admin (403), rien n’est marqué', async () => {
        const handler = await routeHandler(PARTNER_MARK_ROUTE, 'POST', 'POST /api/partner/events/[id]/cash-refunds/[paymentId]');
        const r = await invoke(handler, jsonRequest(`/api/partner/events/${c.ev.eventId}/cash-refunds/${String(c.sales[0].id)}`, 'POST', refunder.accessToken, {}),
            ctx({ id: c.ev.eventId, paymentId: String(c.sales[0].id) }));
        assert.equal(r.status, 403, show(r));
    });

    test('admin refunds.manage, fiche de l’organisatrice suspendue : marque posée, motif gardé, journal ADMIN, organisatrice prévenue', async () => {
        const { error: sErr } = await service.from('partners').update({ status: 'SUSPENDU', suspended_reason: 'Test de la finition 3d' }).eq('id', c.owner.partnerId);
        assert.equal(sErr, null, sErr?.message);
        const paymentId = String(c.sales[1].id);
        const r = await adminMark(refunder, c, paymentId, { reason: 'Espèces rendues par la billetterie du lieu' });
        assert.equal(r.status, 200, show(r));
        const { data: marks } = await service.from('event_cash_refund_marks').select('payment_id, marked_by, note').eq('payment_id', paymentId);
        assert.deepEqual(marks, [{ payment_id: paymentId, marked_by: refunder.userId, note: 'Espèces rendues par la billetterie du lieu' }]);
        const { data: audits } = await service.from('audit_logs').select('user_id, user_role, metadata').eq('action', 'CASH_REFUND_MARKED').eq('object_id', paymentId);
        assert.equal((audits ?? []).length, 1, `journal CASH_REFUND_MARKED : ${JSON.stringify(audits)}`);
        assert.deepEqual([audits![0].user_id, audits![0].user_role, (audits![0].metadata as Row).reason, (audits![0].metadata as Row).by_admin],
            [refunder.userId, 'ADMIN', 'Espèces rendues par la billetterie du lieu', true]);
        const { data: outbox } = await service.from('notification_outbox').select('channel, recipient_user_id, template_data')
            .eq('idempotency_key', `CASH_REFUND_MARKED_BY_ADMIN:${paymentId}:IN_APP`);
        assert.equal((outbox ?? []).length, 1, 'avis IN_APP à l’organisatrice absent');
        assert.equal(outbox![0].recipient_user_id, c.owner.userId);
        assert.equal((outbox![0].template_data as Row).reason, 'Espèces rendues par la billetterie du lieu');
        const { data: channels } = await service.from('notification_outbox').select('channel').eq('group_key', `CASH_REFUND_MARKED_BY_ADMIN:${paymentId}`);
        assert.deepEqual((channels ?? []).map((x) => x.channel).sort(), ['EMAIL', 'IN_APP', 'PUSH']);
    });

    test('second appel : 200 ALREADY_MARKED, la marque existante, aucun second avis', async () => {
        const paymentId = String(c.sales[1].id);
        const r = await adminMark(refunder, c, paymentId, { reason: 'Encore une fois' });
        assert.deepEqual([r.status, r.body.code], [200, 'ALREADY_MARKED'], show(r));
        const { data: rows } = await service.from('notification_outbox').select('id').eq('group_key', `CASH_REFUND_MARKED_BY_ADMIN:${paymentId}`);
        assert.equal((rows ?? []).length, 3);
    });

    test('le client reçoit le même avis que si l’organisatrice avait marqué : aucun, dans un cas comme dans l’autre', async () => {
        const other = await cancelledEventWithCashSales('b');
        const since = new Date(Date.now() - 1000).toISOString();
        const handler = await routeHandler(PARTNER_MARK_ROUTE, 'POST', 'POST /api/partner/events/[id]/cash-refunds/[paymentId]');
        const own = await invoke(handler, jsonRequest(`/api/partner/events/${other.ev.eventId}/cash-refunds/${String(other.sales[0].id)}`, 'POST', other.owner.accessToken, {}),
            ctx({ id: other.ev.eventId, paymentId: String(other.sales[0].id) }));
        assert.equal(own.status, 200, show(own));
        const byOwner = await clientSideNotices(other.ev.eventId, since);
        const r = await adminMark(refunder, other, String(other.sales[1].id), { reason: 'Rendues par la billetterie' });
        assert.equal(r.status, 200, show(r));
        const both = await clientSideNotices(other.ev.eventId, since);
        assert.deepEqual(both, byOwner, 'le marquage par un admin ne doit rien envoyer de plus au client');
        assert.deepEqual(byOwner, [], 'aucun avis au client aujourd’hui quand l’organisatrice marque');
    });

    test('événement non annulé : 409 EVENT_NOT_CANCELLED', async () => {
        const owner = await newPartner('f3d-esp-ouvert');
        const ev = await createTimedEvent(owner.partnerId, 'f3d-esp-ouvert', [{ name: 'Standard', price: PRICE, total: 10 }]);
        const r = await adminMark(refunder, { owner, ev, sales: [] }, randomUUID(), { reason: 'Espèces rendues' });
        assert.deepEqual([r.status, r.body.code], [409, 'EVENT_NOT_CANCELLED'], show(r));
    });
});
