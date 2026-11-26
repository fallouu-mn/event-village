/**
 * Lot 11c-c — tables d'un événement : routes des écrans de l'organisatrice, du pilotage, de la porte et de
 * l'administration (base LOCALE, faux SamirPay ; montants et places attendus écrits à la main).
 *
 *  A. GET /api/partner/events/[id]/tables/report (event_table_report, migration 20261215000001) : contenu exact pour la
 *     propriétaire (jauge en places, types, ventes avec titulaire en prénom et initiale, places envoyées et entrées,
 *     totaux), aucun téléphone, courriel ni nom complet ; une autre organisatrice, une cliente, un contrôleur d'un autre
 *     événement : 404 ; sans session : 401 ; administration avec events.read : 200 (lecture, historique) ; sans : 403.
 *     GET /api/admin/events/[id]/tables : administration events.read seulement.
 *  B. Le refus d'écriture lu par l'écran (edit_refusal) est celui que rend l'écriture : en attente de validation, service
 *     fermé, événement suspendu (contre-vérification T4 : code ET texte, l11cc-cv-correctifs pour tous les états).
 *  C. GET /api/events/[id]/tables/door : propriétaire 200 (titulaire et invité en prénom et initiale) ; contrôleur
 *     affecté, contrôle pas encore ouvert (début dans 10 jours) : 409 CONTROL_CLOSED, aucune donnée (contre-vérification
 *     T1 ; dans la plage : l11cc-cv-correctifs) ; contrôleur d'un autre événement, autre organisatrice, cliente : 403.
 *  D. GET …/tables/price : règle de la base (arrondi, exact) ; bornes ; une cliente : 403.
 *  E. POST …/tables/copy : copie des types, numéros et positions entre deux événements de la MÊME organisatrice ; refusée
 *     (404, rien écrit) avec l'événement d'une autre ; 409 sur un événement qui a déjà des tables.
 *  F. GET /api/controller/assignments : `tables_sold` de l'événement affecté.
 *  G. Fiche de l'administration : les types de tables ne sont plus listés parmi les catégories de billets.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLot11cInvariants } from '../helpers/lot11c-invariants';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { stepUpTestSession } from '../helpers/admin-step-up';
import { routeContext } from './helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { newAdmin } from './notif-helpers';
import { advanceEventTo } from './cycle-helpers';
import {
    buyTable, createTableType, createdTableType, doorList, newTablesEvent, saveTables, show, switchEventTablesService, tablesForSave,
    transferSeat, vipType, withEventTablesSetting, type Reply, type Row,
} from './l11c-helpers';
import { GET as reportGet } from '../../app/api/partner/events/[id]/tables/report/route';
import { GET as priceGet } from '../../app/api/partner/events/[id]/tables/price/route';
import { POST as copyPost } from '../../app/api/partner/events/[id]/tables/copy/route';
import { GET as adminTablesGet } from '../../app/api/admin/events/[id]/tables/route';
import { GET as adminEventGet } from '../../app/api/admin/events/[id]/route';
import { GET as assignmentsGet } from '../../app/api/controller/assignments/route';

async function reply(res: Response): Promise<Reply> {
    const text = await res.text();
    let body: Row;
    try {
        body = (text ? JSON.parse(text) : {}) as Row;
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

const report = async (user: Buyer | null, eventId: string): Promise<Reply> =>
    reply(await reportGet(jsonRequest(`/api/partner/events/${eventId}/tables/report`, 'GET', user?.accessToken ?? null), routeContext({ id: eventId })));
const adminTables = async (user: Buyer, eventId: string): Promise<Reply> =>
    reply(await adminTablesGet(jsonRequest(`/api/admin/events/${eventId}/tables`, 'GET', user.accessToken), routeContext({ id: eventId })));
const price = async (user: Buyer, eventId: string, p: string, seats: string): Promise<Reply> =>
    reply(await priceGet(jsonRequest(`/api/partner/events/${eventId}/tables/price?price=${encodeURIComponent(p)}&seats=${encodeURIComponent(seats)}`, 'GET', user.accessToken)));
const copy = async (user: Buyer, eventId: string, from: unknown): Promise<Reply> =>
    reply(await copyPost(jsonRequest(`/api/partner/events/${eventId}/tables/copy`, 'POST', user.accessToken, { from_event_id: from }), routeContext({ id: eventId })));

const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);

let restore: () => Promise<void>;
let owner: TestPartner;
let other: TestPartner;
let holder: Buyer;
let guest: Buyer;
let client: Buyer;
let controller: Buyer;
let foreignController: Buyer;
let ev: { eventId: string; typeId: string; tables: Array<{ id: string; number: number }> };
let foreignEventId: string;

async function newController(label: string, eventId: string, createdBy: string): Promise<Buyer> {
    const c = await newBuyer(`ctl-${label}`, { firstName: 'Ibrahima', lastName: 'Contrôleur' });
    const { error: rErr } = await service.from('user_roles').upsert([{ user_id: c.userId, role: 'CONTROLEUR' }], { onConflict: 'user_id,role' });
    assert.equal(rErr, null, `rôle CONTROLEUR : ${rErr?.message}`);
    const { error } = await service.from('event_controllers').upsert(
        { event_id: eventId, user_id: c.userId, can_accept_cash: false, created_by: createdBy, entry_point: 'Entrée principale' },
        { onConflict: 'event_id,user_id' });
    assert.equal(error, null, `affectation du contrôleur : ${error?.message}`);
    return c;
}

before(async () => {
    restore = await switchEventTablesService(true);
    owner = await newPartner('l11cc-proprio');
    other = await newPartner('l11cc-autre');
    holder = await newBuyer('l11cc-titulaire', { firstName: 'Awa', lastName: 'Diallo' });
    guest = await newBuyer('l11cc-invitee', { firstName: 'Mariama', lastName: 'Sow' });
    client = await newBuyer('l11cc-cliente', { firstName: 'Fatou', lastName: 'Ndiaye' });

    const created = await newTablesEvent(owner, 'ecrans', { capacity: 100 });
    const t = await createdTableType(owner, created.eventId, vipType({ name: 'Carré VIP écrans' }), 3);
    ev = { eventId: created.eventId, typeId: t.typeId, tables: t.tables };
    // Plan non montré : le client choisit un type et reçoit la plus petite table libre (ev.tables[0])
    const sold = await buyTable(holder, ev.eventId, ev.typeId);
    const seat = String(sold.tickets[0].id);
    const transferId = await transferSeat(seat, holder, guest.phoneE164);
    const { data: acc, error: accErr } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: transferId, actor_id: guest.userId } });
    assert.equal(accErr, null, `ticket_transfer_accept : ${accErr?.message}`);
    assert.equal((acc as Row | null)?.ok, true, `place acceptée par l'invitée : ${JSON.stringify(acc)}`);

    controller = await newController('l11cc-porte', ev.eventId, owner.userId);
    const foreign = await newTablesEvent(other, 'ecrans-autre', { capacity: 50 });
    foreignEventId = foreign.eventId;
    foreignController = await newController('l11cc-ailleurs', foreignEventId, other.userId);
});

after(async () => {
    if (restore) await restore();
    await checkLot11cInvariants('l11cc-ecrans');
    await assertNotificationInvariants('l11cc-ecrans');
});

describe('A. Lecture des tables pour les écrans', () => {
    test('propriétaire : 200, jauge en places, type, vente (« Awa D. », 1 place envoyée, 5 à envoyer), totaux, recette hors frais', async () => {
        const r = await report(owner, ev.eventId);
        assert.equal(r.status, 200, show(r));
        const b = r.body;
        assert.equal(b.viewer, 'OWNER');
        assert.equal(b.edit_refusal, null, `aucun refus d'écriture : ${JSON.stringify(b.edit_refusal)}`);
        // 20 billets « Entrée » (1 place) + 3 tables de 6 places = 38 places sur 100
        assert.deepEqual(b.gauge, { capacity: 100, seats: 38, table_seats: 18, ticket_seats: 20, free: 62 });
        const type = rows(b.types)[0];
        assert.equal(type.name, 'Carré VIP écrans');
        assert.equal(Number(type.price), 150_000);
        assert.equal(Number(type.seats), 6);
        assert.equal(Number(type.price_per_person), 25_000);
        assert.equal(type.price_per_person_exact, true);
        assert.equal(type.locked, true, 'prix et places figés après la vente');
        assert.deepEqual([Number(type.sold_tables), Number(type.held_tables), Number(type.free_tables), Number(type.total_tables)], [1, 0, 2, 3]);
        const booking = rows(b.bookings)[0];
        assert.equal(booking.holder, 'Awa D.');
        assert.equal(booking.status, 'ACTIVE');
        assert.equal(Number(booking.seats), 6);
        assert.equal(Number(booking.price), 150_000, 'prix de la table, hors frais');
        assert.deepEqual(booking.counts, { sent: 1, pending: 0, to_send: 5, entered: 0, given: 1 });
        const totals = b.totals as Row;
        assert.deepEqual(
            [totals.tables, totals.sold, totals.held, totals.free, totals.sold_seats, totals.entered_seats, totals.revenue, totals.refunded].map(Number),
            [3, 1, 0, 2, 6, 0, 150_000, 0],
        );
        assert.ok(Array.isArray(b.copy_sources), 'événements copiables (propriétaire)');
        assert.equal('changes' in b, false, 'historique réservé à l’administration');
        const text = JSON.stringify(b);
        for (const secret of [holder.phoneE164, holder.phone9, holder.email, 'Diallo', guest.phoneE164, guest.email, 'Sow']) {
            assert.equal(text.includes(secret), false, `la lecture ne contient pas « ${secret} »`);
        }
    });

    test('une autre organisatrice, la titulaire, une cliente et un contrôleur d’un autre événement : 404 ; sans session : 401', async () => {
        for (const [who, user] of [['autre organisatrice', other], ['titulaire', holder], ['cliente', client], ['contrôleur d’un autre événement', foreignController]] as const) {
            const r = await report(user, ev.eventId);
            assert.equal(r.status, 404, `${who} : ${show(r)}`);
            assert.equal(r.body.code, 'EVENT_NOT_FOUND', `${who} : aucun indice`);
            assert.equal('types' in r.body, false, `${who} : aucune donnée`);
        }
        const anon = await report(null, ev.eventId);
        assert.equal(anon.status, 401, show(anon));
    });

    test('administration : events.read → 200 (lecture seule, historique) ; sans la permission → 403 ; route admin refusée à la propriétaire et à une cliente', async () => {
        const reader = await newAdmin('l11cc-lecteur', ['events.read']);
        await stepUpTestSession(reader.accessToken);
        const viaPartner = await report(reader, ev.eventId);
        assert.equal(viaPartner.status, 200, show(viaPartner));
        assert.equal(viaPartner.body.viewer, 'STAFF');
        assert.equal((viaPartner.body.edit_refusal as Row).code, 'ADMIN_CANNOT_EDIT');
        assert.ok(Array.isArray(viaPartner.body.changes), 'historique des changements après validation');
        assert.equal('copy_sources' in viaPartner.body, false);
        const viaAdmin = await adminTables(reader, ev.eventId);
        assert.equal(viaAdmin.status, 200, show(viaAdmin));
        assert.equal(rows(viaAdmin.body.bookings)[0].holder, 'Awa D.');

        const blind = await newAdmin('l11cc-aveugle', []);
        await stepUpTestSession(blind.accessToken);
        const refused = await report(blind, ev.eventId);
        assert.equal(refused.status, 403, show(refused));
        assert.equal(refused.body.code, 'PERMISSION_MISSING');
        const refusedAdmin = await adminTables(blind, ev.eventId);
        assert.equal(refusedAdmin.status, 403, show(refusedAdmin));
        for (const user of [owner, client]) {
            const r = await adminTables(user, ev.eventId);
            assert.equal(r.status, 403, show(r));
        }
    });

    test('historique : un type ajouté après la validation est signalé (ADMIN_EVENT_TABLES_CHANGED) et apparaît dans la lecture de l’administration', async () => {
        const reader = await newAdmin('l11cc-histo', ['events.read']);
        await stepUpTestSession(reader.accessToken);
        const before = rows((await adminTables(reader, ev.eventId)).body.changes).length;
        await createdTableType(owner, ev.eventId, vipType({ name: 'Table d’honneur écrans', seats: 8, price: 200_000 }), 1);
        const after = await adminTables(reader, ev.eventId);
        assert.equal(after.status, 200, show(after));
        const changes = rows(after.body.changes);
        assert.equal(changes.length, before + 1, `un changement de plus : ${JSON.stringify(changes)}`);
        assert.ok(!Number.isNaN(Date.parse(String(changes[0].at))), 'date du changement');
    });
});

describe('B. Le refus lu par l’écran est celui de l’écriture', () => {
    test('en attente de validation : WITHDRAW_TO_EDIT, texte de l’écriture ; l’ajout d’un type rend le même code et le même texte', async () => {
        const pending = await newTablesEvent(owner, 'ecrans-attente', { capacity: 60, status: 'EN_ATTENTE' });
        const r = await report(owner, pending.eventId);
        assert.equal(r.status, 200, show(r));
        // Contre-vérification 11c-c (T4) : le texte de l'écran est celui de l'écriture (avant : texte propre à l'écran)
        assert.deepEqual(r.body.edit_refusal, { code: 'WITHDRAW_TO_EDIT', message: "L'événement est en cours de validation : retirez-le de la validation pour modifier sa billetterie." });
        const write = await createTableType(owner, pending.eventId, vipType(), 1);
        assert.notEqual(write.status, 201, show(write));
        assert.equal(write.body.code, 'WITHDRAW_TO_EDIT');
        assert.equal(write.body.error, (r.body.edit_refusal as Row).message);
    });

    test('service fermé : SERVICE_UNAVAILABLE à la lecture comme à l’enregistrement des tables', async () => {
        await withEventTablesSetting('features.event_tables_enabled', false, async () => {
            const r = await report(owner, ev.eventId);
            assert.equal(r.status, 200, `lisible service fermé : ${show(r)}`);
            assert.equal(r.body.service_open, false);
            assert.equal((r.body.edit_refusal as Row).code, 'SERVICE_UNAVAILABLE');
            const write = await saveTables(owner, ev.eventId, { plan_enabled: false, tables: await tablesForSave(owner, ev.eventId), zones: [] });
            assert.equal(write.body.code, 'SERVICE_UNAVAILABLE', show(write));
        });
    });

    test('événement suspendu : EVENT_SUSPENDED à la lecture comme à l’enregistrement', async () => {
        const s = await newTablesEvent(owner, 'ecrans-suspendu', { capacity: 60 });
        await createdTableType(owner, s.eventId, vipType(), 1);
        await advanceEventTo(s.eventId, 'SUSPENDU', { partnerUserId: owner.userId });
        const r = await report(owner, s.eventId);
        assert.equal(r.status, 200, show(r));
        assert.equal((r.body.edit_refusal as Row).code, 'EVENT_SUSPENDED');
        const write = await saveTables(owner, s.eventId, { plan_enabled: false, tables: await tablesForSave(owner, s.eventId), zones: [] });
        assert.equal(write.body.code, 'EVENT_SUSPENDED', show(write));
    });
});

describe('C. Liste de la porte', () => {
    test('propriétaire : 200, « Awa D. » et son invitée « Mariama S. », 0/6 entrés ; contrôleur affecté hors de la plage : 409 sans donnée ; autres comptes : 403', async () => {
        // Contre-vérification 11c-c (T1) : l'événement commence dans 10 jours, le contrôle n'est pas ouvert
        const closed = await doorList(controller, ev.eventId);
        assert.deepEqual([closed.status, closed.body.code], [409, 'CONTROL_CLOSED'], show(closed));
        assert.match(String(closed.body.error), /^Le contrôle ouvre le /);
        assert.equal('items' in closed.body, false, 'contrôle fermé : aucune donnée');
        const r = await doorList(owner, ev.eventId);
        assert.equal(r.status, 200, show(r));
        const item = rows(r.body.items).find((x) => Number(x.table_number) === ev.tables[0].number);
        assert.ok(item, `table vendue dans la liste : ${show(r)}`);
        assert.equal(item!.holder, 'Awa D.');
        assert.deepEqual(item!.guests, ['Mariama S.']);
        assert.deepEqual([Number(item!.entered), Number(item!.seats)], [0, 6]);
        for (const [who, user] of [['contrôleur d’un autre événement', foreignController], ['autre organisatrice', other], ['cliente', client]] as const) {
            const refused = await doorList(user, ev.eventId);
            assert.equal(refused.status, 403, `${who} : ${show(refused)}`);
            assert.equal('items' in refused.body, false, `${who} : aucune donnée`);
        }
    });
});

describe('D. Aperçu du prix par personne (serveur)', () => {
    test('150 000 F pour 6 : 25 000 F, exact ; 100 000 F pour 3 : 33 333 F, arrondi ; bornes 400 ; cliente 403', async () => {
        const a = await price(owner, ev.eventId, '150000', '6');
        assert.equal(a.status, 200, show(a));
        assert.deepEqual([a.body.price_per_person, a.body.price_per_person_exact], [25_000, true]);
        const b = await price(owner, ev.eventId, '100000', '3');
        assert.deepEqual([b.body.price_per_person, b.body.price_per_person_exact], [33_333, false]);
        const c = await price(owner, ev.eventId, '100001', '2');
        assert.deepEqual([c.body.price_per_person, c.body.price_per_person_exact], [50_001, false], 'moitié arrondie vers le haut, comme round() de la base');
        for (const [p, s] of [['150000', '1'], ['150000', '21'], ['abc', '6'], ['0', '6'], ['-5', '6'], ['12.5', '4']]) {
            const r = await price(owner, ev.eventId, p, s);
            assert.equal(r.status, 400, `${p} F pour ${s} : ${show(r)}`);
        }
        const refused = await price(client, ev.eventId, '150000', '6');
        assert.equal(refused.status, 403, show(refused));
    });
});

describe('E. Copie des tables d’un événement précédent', () => {
    test('même organisatrice : types, numéros et positions repris ; seconde copie 409 ; événement d’une autre organisatrice (source ou cible) : 404, rien écrit', async () => {
        const source = await newTablesEvent(owner, 'ecrans-source', { capacity: 80 });
        const st = await createdTableType(owner, source.eventId, vipType({ name: 'Carré copie', seats: 4, price: 80_000 }), 2);
        const placed = (await tablesForSave(owner, source.eventId)).map((t, i) => ({ ...t, number: 10 + i, x: 20 + 30 * i, y: 40 }));
        const saved = await saveTables(owner, source.eventId, { plan_enabled: true, tables: placed, zones: [] });
        assert.equal(saved.status, 200, show(saved));
        assert.ok(st.typeId);

        const target = await newTablesEvent(owner, 'ecrans-cible', { capacity: 80 });
        const r = await copy(owner, target.eventId, source.eventId);
        assert.equal(r.status, 200, show(r));
        assert.deepEqual([r.body.types, r.body.tables], [1, 2]);
        const after = await report(owner, target.eventId);
        const type = rows(after.body.types)[0];
        assert.deepEqual([type.name, Number(type.seats), Number(type.price)], ['Carré copie', 4, 80_000]);
        const tables = rows(after.body.tables).map((t) => [Number(t.number), Number(t.x), Number(t.y)]).sort((a, b) => a[0] - b[0]);
        assert.deepEqual(tables, [[10, 20, 40], [11, 50, 40]]);
        assert.equal(after.body.plan_enabled, false, 'plan pas encore montré aux clients après une copie');

        const again = await copy(owner, target.eventId, source.eventId);
        assert.equal(again.status, 409, show(again));
        assert.equal(again.body.code, 'TABLES_NOT_EMPTY');

        const otherTarget = await newTablesEvent(other, 'ecrans-cible-autre', { capacity: 80 });
        const stolen = await copy(other, otherTarget.eventId, source.eventId);
        assert.equal(stolen.status, 404, `source d’une autre organisatrice : ${show(stolen)}`);
        assert.equal(rows((await report(other, otherTarget.eventId)).body.types).length, 0, 'rien écrit chez l’autre organisatrice');
        const pushed = await copy(owner, otherTarget.eventId, source.eventId);
        assert.equal(pushed.status, 404, `cible d’une autre organisatrice : ${show(pushed)}`);
        assert.equal(rows((await report(other, otherTarget.eventId)).body.types).length, 0, 'toujours rien chez l’autre organisatrice');
        const self = await copy(owner, target.eventId, target.eventId);
        assert.equal(self.status, 400, show(self));
        const junk = await copy(owner, target.eventId, 'pas-un-identifiant');
        assert.equal(junk.status, 400, show(junk));
    });
});

describe('F. Scanner : tables vendues de l’événement affecté', () => {
    test('GET /api/controller/assignments : tables_sold = 1 pour l’événement aux tables, 0 ailleurs', async () => {
        const r = await reply(await assignmentsGet(jsonRequest('/api/controller/assignments', 'GET', controller.accessToken)));
        assert.equal(r.status, 200, show(r));
        const mine = rows(r.body.assignments).find((a) => (a.events as Row | null)?.id === ev.eventId);
        assert.ok(mine, 'affectation lue');
        assert.equal(mine!.tables_sold, 1);
        const f = await reply(await assignmentsGet(jsonRequest('/api/controller/assignments', 'GET', foreignController.accessToken)));
        const theirs = rows(f.body.assignments).find((a) => (a.events as Row | null)?.id === foreignEventId);
        assert.equal(theirs?.tables_sold, 0);
    });
});

describe('G. Fiche de l’administration', () => {
    test('les types de tables ne sont pas listés parmi les catégories de billets', async () => {
        const reader = await newAdmin('l11cc-fiche', ['events.read']);
        await stepUpTestSession(reader.accessToken);
        const r = await reply(await adminEventGet(jsonRequest(`/api/admin/events/${ev.eventId}`, 'GET', reader.accessToken), routeContext({ id: ev.eventId })));
        assert.equal(r.status, 200, show(r));
        const names = rows(r.body.categories).map((c) => String(c.name));
        assert.deepEqual(names, ['Entrée'], `catégories de billets seulement : ${names.join(', ')}`);
    });
});
