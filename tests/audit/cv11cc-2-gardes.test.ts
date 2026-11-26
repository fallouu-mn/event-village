/**
 * Contre-vérification du lot 11c-c — GARDE-FOUS (attaques essayées, VERTES attendues : l'attaque est bloquée).
 * Base LOCALE, faux SamirPay.
 *
 *  G1. Identité : compte et événement viennent de la session et de l'adresse, jamais d'un champ ajouté (corps, paramètre
 *      d'adresse, en-tête) : lecture, copie, administration.
 *  G2. Accès : autre organisatrice, cliente, titulaire, contrôleur (affecté, d'un autre événement, affectation retirée),
 *      administrateur sans permission, sans session — lecture, administration, porte, aperçu, copie, affectations.
 *  G3. Données personnelles : lecture, administration, porte — ni téléphone, ni courriel, ni nom, ni identifiant de compte
 *      ou de paiement ; clés de la porte limitées.
 *  G4. Copie refusée (409, rien écrit) : cible en validation, suspendue, terminée, annulée, service fermé, fiche suspendue.
 *  G5. Copie après la validation : ADMIN_EVENT_TABLES_CHANGED envoyé, historique de la fiche alimenté.
 *  G6. Copie refusée au 2e type (brouillon) : aucun type, aucune table, aucun plan.
 *  G7. Deux copies de la MÊME source entrelacées : une seule passe, aucune table en double.
 *  G8. Formulaire et requêtes fabriquées : un type de table ne se modifie, ne s'arrête, ne se supprime ni ne se crée par
 *      les routes des catégories de billets ni par l'enregistrement de l'événement ; jauge en places tenue.
 *  G9. Refus lu par l'écran = code de l'écriture dans chaque état (modifiable, validation, suspendu, terminé, annulé,
 *      service fermé, fiche suspendue, administration).
 *  G10. Scanner : badge null pour un billet ordinaire ; badge d'une place de table venu du serveur.
 *  G0. Migration 20261215000001 sur la base migrée : supabase/hotfix/2026-10-31-lot1a/03-verification.sql entièrement OK ;
 *      rejouée deux fois de plus (transaction annulée) ; droits d'exécution réels des deux fonctions.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkLot11cInvariants } from '../helpers/lot11c-invariants';
import { inRolledBackTransaction, inspect, writeLocal } from '../helpers/db';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { stepUpTestSession } from '../helpers/admin-step-up';
import { newBuyer, service, type Buyer } from '../parcours/paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from '../parcours/finance-helpers';
import { routeContext } from '../parcours/helpers';
import { newAdmin } from '../parcours/notif-helpers';
import { advanceEventTo } from '../parcours/cycle-helpers';
import {
    buyTable, createTableType, createdTableType, doorList, newTablesEvent, outbox, show, switchEventTablesService, transferSeat,
    updateCapacity, vipType, withEventTablesSetting, type Row,
} from '../parcours/l11c-helpers';
import { adminTables, beforeRpc, clearHook, copy, copyRaw, hookPending, newController, reply, report, rows, sourceWithTables, tablesState } from './cv11cc-helpers';
import { GET as priceGet } from '../../app/api/partner/events/[id]/tables/price/route';
import { GET as assignmentsGet } from '../../app/api/controller/assignments/route';
import { PATCH as categoryPatch, DELETE as categoryDelete } from '../../app/api/partner/events/[id]/categories/[categoryId]/route';
import { POST as categoryPost } from '../../app/api/partner/events/[id]/categories/route';
import { PUT as eventPut } from '../../app/api/partner/events/[id]/route';
import { GET as doorGet } from '../../app/api/events/[id]/tables/door/route';

let restore: () => Promise<void>;
let owner: TestPartner;
let other: TestPartner;
let holder: Buyer;
let guest: Buyer;
let client: Buyer;
let controller: Buyer;
let foreignController: Buyer;
let ev: { eventId: string; typeId: string; bookingId: string; paymentId: string; seatId: string };
let foreignEventId: string;

before(async () => {
    restore = await switchEventTablesService(true);
    owner = await newPartner('cv11cc-g');
    other = await newPartner('cv11cc-g-autre');
    holder = await newBuyer('cv11cc-g-titulaire', { firstName: 'Awa', lastName: 'Diallogarde' });
    guest = await newBuyer('cv11cc-g-invitee', { firstName: 'Mariama', lastName: 'Sowgarde' });
    client = await newBuyer('cv11cc-g-cliente', { firstName: 'Fatou', lastName: 'Ndiayegarde' });

    const created = await newTablesEvent(owner, 'cv-g', { capacity: 100 });
    const t = await createdTableType(owner, created.eventId, vipType({ name: 'Carre garde' }), 3);
    const sold = await buyTable(holder, created.eventId, t.typeId);
    const transferId = await transferSeat(String(sold.tickets[0].id), holder, guest.phoneE164);
    const { data: acc, error: accErr } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: transferId, actor_id: guest.userId } });
    assert.equal(accErr, null, accErr?.message);
    assert.equal((acc as Row | null)?.ok, true, JSON.stringify(acc));
    ev = { eventId: created.eventId, typeId: t.typeId, bookingId: String(sold.booking.id), paymentId: String(sold.payment.id), seatId: String(sold.tickets[1].id) };

    controller = await newController('cv11cc-g-porte', ev.eventId, owner.userId);
    const foreign = await newTablesEvent(other, 'cv-g-autre', { capacity: 50 });
    foreignEventId = foreign.eventId;
    foreignController = await newController('cv11cc-g-ailleurs', foreignEventId, other.userId);
});

after(async () => {
    clearHook();
    if (restore) await restore();
    await checkLot11cInvariants('cv11cc-2-gardes');
    await assertNotificationInvariants('cv11cc-2-gardes');
});

describe('G0. Migration du lot sur la base migrée', () => {
    test('03-verification.sql : tous les points OK', async () => {
        const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/hotfix/2026-10-31-lot1a/03-verification.sql'), 'utf8');
        const res = await inspect((c) => c.query(sql));
        const out = (Array.isArray(res) ? res[res.length - 1].rows : res.rows) as Array<{ point: string; statut: string; detail: string }>;
        assert.ok(out.length >= 20, `${out.length} points`);
        const failed = out.filter((r) => r.statut !== 'OK').map((r) => `${r.point} (${r.detail})`);
        assert.deepEqual(failed, []);
    });

    test('rejouée deux fois de plus sans erreur ; droits : report au seul service, aide de private à aucun rôle', async () => {
        const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261215000001_l11cc_lectures_tables.sql'), 'utf8');
        await inRolledBackTransaction(async (c) => { await c.query(sql); await c.query(sql); });
        const got = await writeLocal(async (c) => (await c.query<{ fn: string; anon: boolean; auth: boolean; svc: boolean; pub: boolean; definer: boolean; cfg: string | null }>(
            `SELECT x.fn, has_function_privilege('anon', x.fn, 'execute') AS anon, has_function_privilege('authenticated', x.fn, 'execute') AS auth,
                    has_function_privilege('service_role', x.fn, 'execute') AS svc,
                    EXISTS (SELECT 1 FROM pg_proc p, aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
                             WHERE p.oid = x.fn::regprocedure AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS pub,
                    (SELECT prosecdef FROM pg_proc WHERE oid = x.fn::regprocedure) AS definer,
                    (SELECT array_to_string(proconfig, ' ') FROM pg_proc WHERE oid = x.fn::regprocedure) AS cfg
               FROM unnest($1::text[]) AS x(fn)`,
            [['public.event_table_report(jsonb)', 'private.event_table_edit_refusal(uuid,uuid)']])).rows);
        assert.deepEqual(got.map((r) => [r.fn, r.anon, r.auth, r.svc, r.pub, r.definer, r.cfg]), [
            ['public.event_table_report(jsonb)', false, false, true, false, true, 'search_path=public'],
            ['private.event_table_edit_refusal(uuid,uuid)', false, false, false, false, true, 'search_path=public'],
        ]);
        // Par l'API (clé de service, PostgREST) : l'aide de private n'est pas exposée
        const { error } = await service.rpc('event_table_edit_refusal', { p_event: ev.eventId, p_actor: owner.userId });
        assert.ok(error, 'aide de private inatteignable par la clé de service');
    });
});

describe('G1. Identité de l’appelant', () => {
    test('lecture : actor_id / event_id en paramètres d’adresse et en en-têtes ignorés', async () => {
        const q = `?actor_id=${owner.userId}&event_id=${ev.eventId}&p=${encodeURIComponent(JSON.stringify({ actor_id: owner.userId }))}`;
        const h = { 'x-user-id': owner.userId, 'x-actor-id': owner.userId, 'x-supabase-user': owner.userId };
        for (const user of [other, client, controller]) {
            const r = await report(user, ev.eventId, q, h);
            assert.equal(r.status, 404, `${user.email} : ${show(r)}`);
            assert.equal('types' in r.body, false);
        }
        const anon = await report(null, ev.eventId, q, h);
        assert.equal(anon.status, 401, show(anon));
        const blind = await newAdmin('cv11cc-g1', []);
        await stepUpTestSession(blind.accessToken);
        const reader = await newAdmin('cv11cc-g1-lecteur', ['events.read']);
        const viaHeader = await adminTables(blind, ev.eventId, { 'x-user-id': reader.userId, 'x-actor-id': reader.userId });
        assert.equal(viaHeader.status, 403, show(viaHeader));
    });

    test('copie : actor_id, user_id, event_id ajoutés au corps ignorés (ni écriture chez l’autre, ni lecture de sa source)', async () => {
        const mine = await sourceWithTables(owner, 'g1-source', [{ name: 'Carre G1', seats: 4, count: 2 }]);
        const theirs = await sourceWithTables(other, 'g1-source-autre', [{ name: 'Carre G1 autre', seats: 4, count: 2 }]);
        const otherTarget = await newTablesEvent(other, 'g1-cible-autre', { capacity: 80 });
        // L'autre organisatrice se fait passer pour la propriétaire de la source
        const stolen = await copyRaw(other, otherTarget.eventId, { from_event_id: mine, actor_id: owner.userId, user_id: owner.userId, event_id: otherTarget.eventId });
        assert.equal(stolen.status, 404, show(stolen));
        assert.equal((await tablesState(otherTarget.eventId)).types.length, 0, 'rien écrit');
        // La propriétaire désigne la cible de l'autre dans le corps : la cible reste celle de l'adresse (la sienne)
        const mineTarget = await newTablesEvent(owner, 'g1-cible', { capacity: 80 });
        const pushed = await copyRaw(owner, mineTarget.eventId, { from_event_id: mine, event_id: otherTarget.eventId, actor_id: other.userId, to_event_id: otherTarget.eventId });
        assert.equal(pushed.status, 200, show(pushed));
        assert.equal((await tablesState(mineTarget.eventId)).types.length, 1);
        assert.equal((await tablesState(otherTarget.eventId)).types.length, 0, 'toujours rien chez l’autre');
        // Source de l'autre, compte de l'autre glissé dans le corps
        const fromTheirs = await copyRaw(owner, (await newTablesEvent(owner, 'g1-cible2', { capacity: 80 })).eventId, { from_event_id: theirs, actor_id: other.userId });
        assert.equal(fromTheirs.status, 404, show(fromTheirs));
    });
});

describe('G2. Accès', () => {
    test('lecture : contrôleur AFFECTÉ, titulaire, invitée : 404 ; administration events.read : 200 ; sans permission : 403', async () => {
        for (const [who, user] of [['contrôleur affecté', controller], ['titulaire', holder], ['invitée', guest], ['contrôleur ailleurs', foreignController]] as const) {
            const r = await report(user, ev.eventId);
            assert.equal(r.status, 404, `${who} : ${show(r)}`);
        }
        for (const user of [owner, controller, holder, client]) {
            const r = await adminTables(user, ev.eventId);
            assert.equal(r.status, 403, `${user.email} sur la route admin : ${show(r)}`);
        }
        assert.equal((await adminTables(null, ev.eventId)).status, 401);
    });

    test('porte : affectation retirée, titulaire, invitée, administrateur sans permission, autre organisatrice : 403 ; sans session : 401', async () => {
        const removed = await newController('cv11cc-g2-retire', ev.eventId, owner.userId);
        const { error } = await service.from('event_controllers').delete().eq('event_id', ev.eventId).eq('user_id', removed.userId);
        assert.equal(error, null, error?.message);
        const blind = await newAdmin('cv11cc-g2', []);
        await stepUpTestSession(blind.accessToken);
        const reader = await newAdmin('cv11cc-g2-lecteur', ['events.read']);
        await stepUpTestSession(reader.accessToken);
        for (const [who, user] of [['affectation retirée', removed], ['titulaire', holder], ['invitée', guest], ['admin sans permission', blind],
            ['admin events.read seul', reader], ['autre organisatrice', other], ['contrôleur ailleurs', foreignController]] as const) {
            const r = await doorList(user, ev.eventId);
            assert.equal(r.status, 403, `${who} : ${show(r)}`);
            assert.equal('items' in r.body, false, `${who} : aucune donnée`);
        }
        const anon = await reply(await doorGet(jsonRequest(`/api/events/${ev.eventId}/tables/door`, 'GET', null), routeContext({ id: ev.eventId })));
        assert.equal(anon.status, 401, show(anon));
    });

    test('aperçu du prix, copie, affectations : sans session 401 ; cliente 403 ; affectation retirée : événement absent', async () => {
        const p = await reply(await priceGet(jsonRequest(`/api/partner/events/${ev.eventId}/tables/price?price=1000&seats=4`, 'GET', null)));
        assert.equal(p.status, 401, show(p));
        const c = await copyRaw(null, ev.eventId, { from_event_id: foreignEventId });
        assert.equal(c.status, 401, show(c));
        const cc = await copy(client, ev.eventId, foreignEventId);
        assert.equal(cc.status, 403, show(cc));
        const a = await reply(await assignmentsGet(jsonRequest('/api/controller/assignments', 'GET', client.accessToken)));
        assert.equal(a.status, 403, show(a));
        const gone = await newController('cv11cc-g2-parti', ev.eventId, owner.userId);
        await service.from('event_controllers').delete().eq('event_id', ev.eventId).eq('user_id', gone.userId);
        const g = await reply(await assignmentsGet(jsonRequest('/api/controller/assignments', 'GET', gone.accessToken)));
        assert.equal(g.status, 200, show(g));
        assert.equal(rows(g.body.assignments).some((x) => (x.events as Row | null)?.id === ev.eventId), false, 'affectation retirée : rien');
        const f = await reply(await assignmentsGet(jsonRequest('/api/controller/assignments', 'GET', foreignController.accessToken)));
        assert.equal(rows(f.body.assignments).some((x) => (x.events as Row | null)?.id === ev.eventId), false, 'contrôleur ailleurs : rien de cet événement');
    });
});

describe('G3. Données personnelles et identifiants', () => {
    test('lecture, administration, porte : ni téléphone, ni courriel, ni nom, ni identifiant de compte, de vente ou de paiement', async () => {
        const reader = await newAdmin('cv11cc-g3', ['events.read']);
        await stepUpTestSession(reader.accessToken);
        const bodies: Array<[string, Row]> = [
            ['lecture', (await report(owner, ev.eventId)).body],
            ['administration', (await adminTables(reader, ev.eventId)).body],
            ['porte', (await doorList(controller, ev.eventId)).body],
        ];
        const secrets = [holder.phoneE164, holder.phone9, holder.email, holder.lastName, holder.userId, guest.phoneE164, guest.phone9, guest.email,
            guest.lastName, guest.userId, ev.paymentId];
        for (const [what, body] of bodies) {
            const text = JSON.stringify(body);
            assert.ok(text.includes('Awa D.'), `${what} : titulaire en prénom et initiale (${text.slice(0, 300)})`);
            for (const s of secrets) assert.equal(text.includes(s), false, `${what} : contient « ${s} »`);
        }
        const door = bodies[2][1];
        assert.equal(JSON.stringify(door).includes(ev.bookingId), false, 'porte : aucun identifiant de vente');
        assert.equal(JSON.stringify(door).includes(ev.seatId), false, 'porte : aucun identifiant de billet');
        for (const item of rows(door.items)) {
            assert.deepEqual(Object.keys(item).sort(), ['entered', 'guests', 'holder', 'seats', 'table_number', 'type_name', 'zone'], JSON.stringify(item));
        }
        const booking = rows(bodies[0][1].bookings)[0];
        for (const k of ['holder_id', 'payment_id', 'user_id', 'phone', 'email', 'id']) assert.equal(k in booking, false, `vente : clé ${k}`);
    });
});

describe('G4. Copie refusée sur une cible non modifiable', () => {
    test('en validation, suspendue, terminée, annulée, service fermé, fiche suspendue : 409 et rien écrit', async () => {
        const source = await sourceWithTables(owner, 'g4-source', [{ name: 'Carre G4', seats: 4, count: 2 }]);
        const cases: Array<[string, string, () => Promise<string>]> = [
            ['EN_ATTENTE', 'WITHDRAW_TO_EDIT', async () => (await newTablesEvent(owner, 'g4-attente', { capacity: 80, status: 'EN_ATTENTE' })).eventId],
            ['SUSPENDU', 'EVENT_SUSPENDED', async () => { const e = await newTablesEvent(owner, 'g4-susp', { capacity: 80 }); await advanceEventTo(e.eventId, 'SUSPENDU', { partnerUserId: owner.userId }); return e.eventId; }],
            ['TERMINE', 'EVENT_LOCKED', async () => { const e = await newTablesEvent(owner, 'g4-fin', { capacity: 80 }); await advanceEventTo(e.eventId, 'TERMINE', { partnerUserId: owner.userId }); return e.eventId; }],
            ['ANNULE', 'EVENT_LOCKED', async () => { const e = await newTablesEvent(owner, 'g4-annule', { capacity: 80 }); await advanceEventTo(e.eventId, 'ANNULE', { partnerUserId: owner.userId }); return e.eventId; }],
        ];
        for (const [label, code, make] of cases) {
            const target = await make();
            const r = await copy(owner, target, source);
            assert.deepEqual([r.status, r.body.code], [409, code], `${label} : ${show(r)}`);
            assert.equal((await tablesState(target)).types.length, 0, `${label} : rien écrit`);
        }
        const closed = await newTablesEvent(owner, 'g4-ferme', { capacity: 80 });
        await withEventTablesSetting('features.event_tables_enabled', false, async () => {
            const r = await copy(owner, closed.eventId, source);
            assert.deepEqual([r.status, r.body.code], [409, 'SERVICE_UNAVAILABLE'], show(r));
        });
        assert.equal((await tablesState(closed.eventId)).types.length, 0, 'service fermé : rien écrit');

        const suspendedPartner = await newPartner('cv11cc-g4-fiche');
        const src = await sourceWithTables(suspendedPartner, 'g4-fiche-source', [{ name: 'Carre G4 fiche', seats: 4, count: 1 }]);
        const tgt = await newTablesEvent(suspendedPartner, 'g4-fiche-cible', { capacity: 80 });
        const { error } = await service.from('partners').update({ status: 'SUSPENDU' }).eq('id', suspendedPartner.partnerId);
        assert.equal(error, null, error?.message);
        const r = await copy(suspendedPartner, tgt.eventId, src);
        assert.deepEqual([r.status, r.body.code], [409, 'PARTNER_SUSPENDED'], show(r));
        assert.equal((await tablesState(tgt.eventId)).types.length, 0, 'fiche suspendue : rien écrit');
    });
});

describe('G5–G7. Copie : alerte après validation, refus en cours, copies entrelacées', () => {
    test('G5. copie sur un événement publié : ADMIN_EVENT_TABLES_CHANGED en file et historique de la fiche', async () => {
        const source = await sourceWithTables(owner, 'g5-source', [{ name: 'Carre G5', seats: 4, count: 2 }]);
        const target = await newTablesEvent(owner, 'g5-cible', { capacity: 80 });
        const r = await copy(owner, target.eventId, source);
        assert.equal(r.status, 200, show(r));
        assert.ok((await outbox({ type: 'ADMIN_EVENT_TABLES_CHANGED', eventId: target.eventId })).length > 0, 'avis aux administrateurs');
        const reader = await newAdmin('cv11cc-g5', ['events.read']);
        await stepUpTestSession(reader.accessToken);
        assert.ok(rows((await adminTables(reader, target.eventId)).body.changes).length > 0, 'historique de la fiche');
    });

    test('G6. brouillon, refus au 2e type (jauge) : aucun type, aucune table, aucun plan', async () => {
        const source = await sourceWithTables(owner, 'g6-source', [{ name: 'Carre G6 un', seats: 4, count: 2 }, { name: 'Carre G6 deux', seats: 6, count: 2 }]);
        const target = await newTablesEvent(owner, 'g6-cible', { capacity: 33, status: 'BROUILLON' });
        const r = await copy(owner, target.eventId, source);
        assert.equal(r.status, 409, show(r));
        const s = await tablesState(target.eventId);
        assert.deepEqual([s.types.length, s.tables.length, s.plan], [0, 0, null], JSON.stringify(s));
    });

    test('G7. deux copies de la même source, la seconde glissée avant le 1er enregistrement de la première : une seule passe, aucune table en double', async () => {
        const source = await sourceWithTables(owner, 'g7-source', [{ name: 'Carre G7', seats: 4, count: 3 }]);
        const target = await newTablesEvent(owner, 'g7-cible', { capacity: 80 });
        let second: { status: number; body: Row } | null = null;
        beforeRpc('event_table_type_save', [target.eventId, 'Carre G7'], async () => { second = await copy(owner, target.eventId, source); });
        const first = await copy(owner, target.eventId, source);
        assert.equal(hookPending(), false, 'entrelacement joué');
        const b = second as unknown as { status: number; body: Row };
        assert.deepEqual([b.status, first.status].sort(), [200, 409], `seconde ${show(b)} ; première ${show(first)}`);
        const s = await tablesState(target.eventId);
        assert.equal(s.types.length, 1, JSON.stringify(s.types));
        assert.deepEqual(s.tables.map((t) => Number(t.number)), [10, 11, 12], 'numéros de la source, une fois chacun');
    });
});

describe('G8. Formulaire et requêtes fabriquées sur un type de table', () => {
    test('routes des catégories de billets et enregistrement de l’événement : le type de table ne bouge pas', async () => {
        const before = (await tablesState(ev.eventId)).types.find((t) => t.id === ev.typeId)!;
        const cat = (id: string) => routeContext({ id: ev.eventId, categoryId: id });
        for (const patch of [{ price: 1_000 }, { total_quantity: 1 }, { is_active: false }, { name: 'Renomme' }]) {
            const r = await reply(await categoryPatch(jsonRequest(`/api/partner/events/${ev.eventId}/categories/${ev.typeId}`, 'PATCH', owner.accessToken, patch), cat(ev.typeId)));
            assert.notEqual(r.status, 200, `PATCH ${JSON.stringify(patch)} : ${show(r)}`);
        }
        const del = await reply(await categoryDelete(jsonRequest(`/api/partner/events/${ev.eventId}/categories/${ev.typeId}`, 'DELETE', owner.accessToken), cat(ev.typeId)));
        assert.deepEqual([del.status, del.body.code], [409, 'TABLE_TYPE'], show(del));
        const { data: rpc, error } = await service.rpc('ticket_category_update', { p: { event_id: ev.eventId, category_id: ev.typeId, actor_id: owner.userId, patch: { price: 1_000 } } });
        assert.equal(error, null, error?.message);
        assert.equal((rpc as Row).code, 'TABLE_TYPE', JSON.stringify(rpc));
        // Création fabriquée : champs d'un type de table glissés dans une catégorie de billets
        const created = await reply(await categoryPost(jsonRequest(`/api/partner/events/${ev.eventId}/categories`, 'POST', owner.accessToken,
            { name: 'Fausse table', price: 2_000, total_quantity: 2, kind: 'TABLE', seats_per_unit: 10, included_text: 'x' }), routeContext({ id: ev.eventId })));
        const { data: tables } = await service.from('ticket_categories').select('id, name, kind, seats_per_unit').eq('event_id', ev.eventId).eq('kind', 'TABLE');
        assert.deepEqual((tables ?? []).map((t) => t.id), [ev.typeId], `aucun type de table créé par la route des billets (${show(created)})`);
        if (created.status === 200 || created.status === 201) {
            const { data: c } = await service.from('ticket_categories').select('kind, seats_per_unit').eq('event_id', ev.eventId).eq('name', 'Fausse table').single();
            assert.deepEqual([c?.kind, Number(c?.seats_per_unit)], ['TICKET', 1], 'catégorie de billets ordinaire');
        }
        // Enregistrement de l'événement avec les catégories (formulaire fabriqué)
        const { data: e } = await service.from('events').select('updated_at').eq('id', ev.eventId).single();
        const put = await reply(await eventPut(jsonRequest(`/api/partner/events/${ev.eventId}`, 'PUT', owner.accessToken,
            { expected_updated_at: e!.updated_at, patch: { ticket_categories: [{ id: ev.typeId, price: 1_000, total_quantity: 1, is_active: false }] } }), routeContext({ id: ev.eventId })));
        assert.notEqual(put.status, 200, show(put));
        // Jauge : capacité sous les places déjà en vente (20 billets + 3 tables de 6 = 38)
        const low = await updateCapacity(owner, ev.eventId, 30);
        assert.notEqual(low.ok, true, `capacité 30 pour 38 places en vente : ${JSON.stringify(low)}`);

        const after = (await tablesState(ev.eventId)).types.find((t) => t.id === ev.typeId)!;
        assert.deepEqual(after, before, 'type de table inchangé');
    });
});

describe('G9. Refus lu par l’écran = code de l’écriture', () => {
    test('modifiable, validation, suspendu, terminé, annulé, service fermé, fiche suspendue, administration', async () => {
        const pairs: string[] = [];
        const compare = async (label: string, user: Buyer, eventId: string): Promise<void> => {
            const read = await report(user, eventId);
            assert.equal(read.status, 200, `${label} : ${show(read)}`);
            const write = await createTableType(user, eventId, vipType(), 1);
            const screen = read.body.edit_refusal as Row | null;
            pairs.push(`${label} : écran ${screen ? String(screen.code) : 'modifiable'} / écriture ${write.status === 201 ? 'acceptée' : String(write.body.code)}`);
            if (screen === null) assert.equal(write.status, 201, `${label} : écran modifiable, écriture refusée : ${show(write)}`);
            else assert.equal(write.body.code, screen.code, `${label} : ${show(write)}`);
        };
        await compare('modifiable', owner, (await newTablesEvent(owner, 'g9-ok', { capacity: 80 })).eventId);
        await compare('brouillon', owner, (await newTablesEvent(owner, 'g9-brouillon', { capacity: 80, status: 'BROUILLON' })).eventId);
        await compare('validation', owner, (await newTablesEvent(owner, 'g9-attente', { capacity: 80, status: 'EN_ATTENTE' })).eventId);
        for (const status of ['SUSPENDU', 'TERMINE', 'ANNULE'] as const) {
            const e = await newTablesEvent(owner, `g9-${status.toLowerCase()}`, { capacity: 80 });
            await advanceEventTo(e.eventId, status, { partnerUserId: owner.userId });
            await compare(status, owner, e.eventId);
        }
        const open = await newTablesEvent(owner, 'g9-ferme', { capacity: 80 });
        await withEventTablesSetting('features.event_tables_enabled', false, () => compare('service fermé', owner, open.eventId));
        const sp = await newPartner('cv11cc-g9-fiche');
        const spEv = await newTablesEvent(sp, 'g9-fiche', { capacity: 80 });
        await service.from('partners').update({ status: 'SUSPENDU' }).eq('id', sp.partnerId);
        await compare('fiche suspendue', sp, spEv.eventId);

        const staff = await newAdmin('cv11cc-g9', ['events.read', 'events.write']);
        await stepUpTestSession(staff.accessToken);
        const read = await report(staff, open.eventId);
        const { data } = await service.rpc('event_table_type_save', { p: { event_id: open.eventId, actor_id: staff.userId, count: 1, type: vipType() } });
        assert.equal((read.body.edit_refusal as Row).code, (data as Row).code, `administration : ${JSON.stringify(data)}`);
        console.log(pairs.join('\n'));
    });
});

describe('G10. Scanner : badge du serveur', () => {
    test('billet ordinaire (aucune vente de table liée) : aucun badge ; place de table : « Table N · type », places entrées sur places', async () => {
        const { data: plain, error } = await service.from('tickets').select('id').is('event_table_booking_id', null).limit(1).maybeSingle();
        assert.equal(error, null, error?.message);
        if (plain) {
            const { data: none } = await service.rpc('event_table_badge', { p_ticket: plain.id });
            assert.equal(none, null, 'billet ordinaire : aucun badge');
        }
        const { data: unknown } = await service.rpc('event_table_badge', { p_ticket: '00000000-0000-4000-8000-000000000000' });
        assert.equal(unknown, null, 'billet inconnu : aucun badge');
        const { data: badge } = await service.rpc('event_table_badge', { p_ticket: ev.seatId });
        const b = badge as Row;
        assert.match(String(b.label), /^Table \d+ · Carre garde$/);
        assert.deepEqual([Number(b.entered), Number(b.seats)], [0, 6]);
    });
});
