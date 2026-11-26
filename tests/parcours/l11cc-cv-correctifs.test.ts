/**
 * Lot 11c-c — correctifs de la contre-vérification (docs/audit-lot11c-c.md, migration 20261215000002), base LOCALE,
 * faux SamirPay. Chaque correctif est éprouvé au-delà du test rouge de l'audit qui le visait.
 *
 *  T1. Liste de la porte et plage du contrôle : contrôleur affecté DANS la plage (début dans 2 h) : 200, titulaire et
 *      invitée en prénom et initiale, sans téléphone, courriel, nom complet ni identifiant de vente, de paiement ou de
 *      billet (demande de l'utilisateur, G3 de l'audit lisant désormais la porte par la propriétaire) ; contrôle pas encore ouvert : 409 CONTROL_CLOSED « Le contrôle ouvre le … », aucune
 *      donnée ; événement suspendu, annulé : 409 avec le message du scanner ; la propriétaire et l'administration munie
 *      de events.read (et du droit de scanner) gardent la liste ; un administrateur qui n'a que le droit de scanner est
 *      traité comme un contrôleur (décision) ; events.read seul : 403 (inchangé).
 *  T2. Copie : un succès après validation = une seule transaction signalée (un avis par administrateur, tous de la même
 *      transaction) et UNE ligne d'historique « Plan copié depuis « titre » » ; un refus en cours = aucun avis, aucune
 *      ligne, aucun journal de copie. La copie garde l'état de vente de la source (décision).
 *  T3. Deux copies vraiment simultanées (Promise.all) vers la même cible : une seule réussit, l'autre 409
 *      TABLES_NOT_EMPTY ; aucun type sans table.
 *  T4. Le refus lu par l'écran est celui de l'écriture, code ET texte, dans tous les états : publié et brouillon (aucun
 *      refus, écriture acceptée), en attente de validation, suspendu, terminé, annulé, service fermé, fiche suspendue,
 *      administration.
 *  T5. « Retirer » : la lecture rend deletable (règle de la suppression) ; après un paiement échoué, deletable faux et
 *      delete_refusal = le refus de la suppression (code et texte) ; un type neuf : deletable vrai et suppression 200.
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
    buyTable, createTableType, createdTableType, deleteTableType, doorList, newTablesEvent, outbox, saveTables, show,
    switchEventTablesService, tableCheckout, tablesForSave, transferSeat, vipType, withEventTablesSetting, type Reply, type Row,
} from './l11c-helpers';
import { GET as reportGet } from '../../app/api/partner/events/[id]/tables/report/route';
import { POST as copyPost } from '../../app/api/partner/events/[id]/tables/copy/route';
import { GET as adminTablesGet } from '../../app/api/admin/events/[id]/tables/route';

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

const report = async (user: Buyer, eventId: string): Promise<Reply> =>
    reply(await reportGet(jsonRequest(`/api/partner/events/${eventId}/tables/report`, 'GET', user.accessToken), routeContext({ id: eventId })));
const adminTables = async (user: Buyer, eventId: string): Promise<Reply> =>
    reply(await adminTablesGet(jsonRequest(`/api/admin/events/${eventId}/tables`, 'GET', user.accessToken), routeContext({ id: eventId })));
const copy = async (user: Buyer, eventId: string, from: string): Promise<Reply> =>
    reply(await copyPost(jsonRequest(`/api/partner/events/${eventId}/tables/copy`, 'POST', user.accessToken, { from_event_id: from }), routeContext({ id: eventId })));

const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);

let restore: () => Promise<void>;
let owner: TestPartner;
let holder: Buyer;
let guest: Buyer;

async function newController(label: string, eventId: string, createdBy: string): Promise<Buyer> {
    const c = await newBuyer(`ctl-${label}`, { firstName: 'Ibrahima', lastName: 'Controleurcv' });
    const { error: rErr } = await service.from('user_roles').upsert([{ user_id: c.userId, role: 'CONTROLEUR' }], { onConflict: 'user_id,role' });
    assert.equal(rErr, null, `rôle CONTROLEUR : ${rErr?.message}`);
    const { error } = await service.from('event_controllers').upsert(
        { event_id: eventId, user_id: c.userId, can_accept_cash: false, created_by: createdBy, entry_point: 'Entrée principale' },
        { onConflict: 'event_id,user_id' });
    assert.equal(error, null, `affectation du contrôleur : ${error?.message}`);
    return c;
}

/** Événement aux tables, une table vendue à `holder`, une place acceptée par `guest`. */
async function soldEvent(label: string, startsInHours?: number): Promise<string> {
    const ev = await newTablesEvent(owner, label, { capacity: 100, ...(startsInHours === undefined ? {} : { startsInHours }) });
    const t = await createdTableType(owner, ev.eventId, vipType({ name: `Carre ${label}` }), 2);
    const sold = await buyTable(holder, ev.eventId, t.typeId);
    const transferId = await transferSeat(String(sold.tickets[0].id), holder, guest.phoneE164);
    const { data, error } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: transferId, actor_id: guest.userId } });
    assert.equal(error, null, `ticket_transfer_accept : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, JSON.stringify(data));
    return ev.eventId;
}

/** Source aux tables placées (numéros 10, 11… , positions sur une ligne). */
async function source(label: string, types: Array<{ name: string; seats: number; count: number }>): Promise<{ eventId: string; title: string }> {
    const src = await newTablesEvent(owner, label, { capacity: 120 });
    for (const t of types) await createdTableType(owner, src.eventId, vipType({ name: t.name, seats: t.seats, price: 60_000 }), t.count);
    const placed = (await tablesForSave(owner, src.eventId)).map((t, i) => ({ ...t, number: 10 + i, x: 10 + 12 * i, y: 30 }));
    const saved = await saveTables(owner, src.eventId, { plan_enabled: false, tables: placed, zones: [] });
    assert.equal(saved.status, 200, `plan de la source ${label} : ${show(saved)}`);
    return { eventId: src.eventId, title: src.title };
}

async function typesOf(eventId: string): Promise<Row[]> {
    const { data, error } = await service.from('ticket_categories').select('id, name, is_active, total_quantity').eq('event_id', eventId).eq('kind', 'TABLE').order('created_at');
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

async function tableCount(categoryId: string): Promise<number> {
    const { count, error } = await service.from('event_tables').select('id', { count: 'exact', head: true }).eq('category_id', categoryId);
    assert.equal(error, null, error?.message);
    return count ?? 0;
}

before(async () => {
    restore = await switchEventTablesService(true);
    owner = await newPartner('l11cc-cv');
    holder = await newBuyer('l11cc-cv-titulaire', { firstName: 'Awa', lastName: 'Diopcorrige' });
    guest = await newBuyer('l11cc-cv-invitee', { firstName: 'Mariama', lastName: 'Sowcorrige' });
});

after(async () => {
    if (restore) await restore();
    await checkLot11cInvariants('l11cc-cv-correctifs');
    await assertNotificationInvariants('l11cc-cv-correctifs');
});

describe('T1. Liste de la porte et plage du contrôle', () => {
    test('contrôleur affecté dans la plage (début dans 2 h) : 200, « Awa D. » et « Mariama S. »', async () => {
        const eventId = await soldEvent('cv-t1-plage', 2);
        const { data: problem, error } = await service.rpc('scan_event_problem', { p_event: eventId });
        assert.equal(error, null, error?.message);
        assert.equal(problem, null, 'contrôle ouvert');
        const ctl = await newController('l11cc-cv-plage', eventId, owner.userId);
        const r = await doorList(ctl, eventId);
        assert.equal(r.status, 200, show(r));
        const item = rows(r.body.items)[0];
        assert.ok(item, show(r));
        assert.equal(item.holder, 'Awa D.');
        assert.deepEqual(item.guests, ['Mariama S.']);
    });

    test('contrôleur affecté pendant la plage : prénom et initiale seulement, ni téléphone, ni courriel, ni nom complet, ni identifiant', async () => {
        const ev = await newTablesEvent(owner, 'cv-t1-donnees', { capacity: 100, startsInHours: 2 });
        const t = await createdTableType(owner, ev.eventId, vipType({ name: 'Carre cv donnees' }), 2);
        const sold = await buyTable(holder, ev.eventId, t.typeId);
        const transferId = await transferSeat(String(sold.tickets[0].id), holder, guest.phoneE164);
        const { data: acc, error: accErr } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: transferId, actor_id: guest.userId } });
        assert.equal(accErr, null, accErr?.message);
        assert.equal((acc as Row | null)?.ok, true, JSON.stringify(acc));
        const ctl = await newController('l11cc-cv-donnees', ev.eventId, owner.userId);
        const r = await doorList(ctl, ev.eventId);
        assert.equal(r.status, 200, show(r));
        const text = JSON.stringify(r.body);
        assert.ok(text.includes('Awa D.') && text.includes('Mariama S.'), `prénom et initiale : ${text}`);
        const secrets = [holder.phoneE164, holder.phone9, holder.email, holder.lastName, holder.userId,
            guest.phoneE164, guest.phone9, guest.email, guest.lastName, guest.userId,
            String(sold.booking.id), String(sold.payment.id), ...sold.tickets.map((x) => String(x.id)), ...sold.tickets.map((x) => String(x.ticket_number ?? ''))]
            .filter((s) => s.length > 0);
        for (const s of secrets) assert.equal(text.includes(s), false, `la porte contient « ${s} »`);
        for (const item of rows(r.body.items)) {
            assert.deepEqual(Object.keys(item).sort(), ['entered', 'guests', 'holder', 'seats', 'table_number', 'type_name', 'zone'], JSON.stringify(item));
        }
    });

    test('contrôle pas encore ouvert : contrôleur et administrateur qui n’a que le droit de scanner 409 sans donnée ; propriétaire et administration events.read gardent la liste', async () => {
        const eventId = await soldEvent('cv-t1-avant');
        const ctl = await newController('l11cc-cv-avant', eventId, owner.userId);
        const scanOnly = await newAdmin('l11cc-cv-scan', ['access.operate']);
        await stepUpTestSession(scanOnly.accessToken);
        for (const [who, user] of [['contrôleur affecté', ctl], ['administrateur qui n’a que le droit de scanner', scanOnly]] as const) {
            const r = await doorList(user, eventId);
            assert.deepEqual([r.status, r.body.code], [409, 'CONTROL_CLOSED'], `${who} : ${show(r)}`);
            assert.match(String(r.body.error), /^Le contrôle ouvre le .+ à .+\.$/, `${who} : ${show(r)}`);
            const text = JSON.stringify(r.body);
            assert.ok(!('items' in r.body) && !text.includes('Awa D.') && !text.includes('Mariama S.'), `${who} : aucune donnée (${text})`);
        }
        const reader = await newAdmin('l11cc-cv-lecteur', ['events.read', 'access.operate']);
        await stepUpTestSession(reader.accessToken);
        for (const [who, user] of [['propriétaire', owner], ['administration events.read', reader]] as const) {
            const r = await doorList(user, eventId);
            assert.equal(r.status, 200, `${who} : ${show(r)}`);
            assert.equal(rows(r.body.items)[0]?.holder, 'Awa D.', `${who} : ${show(r)}`);
        }
        const readOnly = await newAdmin('l11cc-cv-lecture-seule', ['events.read']);
        await stepUpTestSession(readOnly.accessToken);
        const refused = await doorList(readOnly, eventId);
        assert.equal(refused.status, 403, `events.read sans droit de scanner : ${show(refused)}`);
    });

    test('événement suspendu, puis annulé : contrôleur 409 avec le message du scanner ; propriétaire 200', async () => {
        const suspended = await soldEvent('cv-t1-suspendu', 2);
        const ctl = await newController('l11cc-cv-susp', suspended, owner.userId);
        await advanceEventTo(suspended, 'SUSPENDU', { partnerUserId: owner.userId });
        const s = await doorList(ctl, suspended);
        assert.deepEqual([s.status, s.body.code, s.body.error], [409, 'CONTROL_CLOSED', 'Cet événement est suspendu : le contrôle est fermé.'], show(s));
        assert.equal((await doorList(owner, suspended)).status, 200, 'propriétaire : liste gardée');

        const cancelled = await newTablesEvent(owner, 'cv-t1-annule', { capacity: 60, startsInHours: 2 });
        await createdTableType(owner, cancelled.eventId, vipType({ name: 'Carre annule' }), 1);
        const ctl2 = await newController('l11cc-cv-annule', cancelled.eventId, owner.userId);
        assert.equal((await doorList(ctl2, cancelled.eventId)).status, 200, 'dans la plage, avant l’annulation');
        await advanceEventTo(cancelled.eventId, 'ANNULE', { partnerUserId: owner.userId });
        const c = await doorList(ctl2, cancelled.eventId);
        assert.deepEqual([c.status, c.body.code, c.body.error], [409, 'CONTROL_CLOSED', 'Cet événement est annulé : le contrôle est fermé.'], show(c));
        assert.equal((await doorList(owner, cancelled.eventId)).status, 200, 'propriétaire : liste gardée');
    });
});

describe('T2. Copie : un avis, une ligne d’historique', () => {
    test('succès sur un événement publié : une seule transaction signalée, une ligne « Plan copié depuis « … » »', async () => {
        const src = await source('cv-t2-source', [{ name: 'Carre CV un', seats: 4, count: 2 }, { name: 'Carre CV deux', seats: 6, count: 1 }]);
        const target = await newTablesEvent(owner, 'cv-t2-cible', { capacity: 100 });
        const r = await copy(owner, target.eventId, src.eventId);
        assert.equal(r.status, 200, show(r));
        assert.deepEqual([r.body.types, r.body.tables], [2, 3]);
        const alerts = await outbox({ type: 'ADMIN_EVENT_TABLES_CHANGED', eventId: target.eventId });
        assert.ok(alerts.length > 0, 'avis aux administrateurs');
        const txs = new Set(alerts.map((a) => /:tx(\d+)/.exec(String(a.idempotency_key))?.[1] ?? 'aucune'));
        assert.equal(txs.size, 1, `une seule transaction signalée : ${JSON.stringify([...txs])}`);
        const recipients = alerts.filter((a) => a.channel === alerts[0].channel).map((a) => a.recipient_user_id);
        assert.equal(new Set(recipients).size, recipients.length, 'un seul avis par administrateur et par canal');

        const reader = await newAdmin('l11cc-cv-t2', ['events.read']);
        await stepUpTestSession(reader.accessToken);
        const sheet = await adminTables(reader, target.eventId);
        assert.equal(sheet.status, 200, show(sheet));
        const changes = rows(sheet.body.changes);
        assert.equal(changes.length, 1, JSON.stringify(changes));
        assert.equal(changes[0].label, `Plan copié depuis « ${src.title} »`);
    });

    test('refus en cours (jauge au 2e type) après validation : rien écrit, aucun avis, aucune ligne, aucun journal de copie', async () => {
        const src = await source('cv-t2-refus-source', [{ name: 'Carre CV refus un', seats: 4, count: 2 }, { name: 'Carre CV refus deux', seats: 6, count: 2 }]);
        const target = await newTablesEvent(owner, 'cv-t2-refus-cible', { capacity: 33 });
        const r = await copy(owner, target.eventId, src.eventId);
        assert.deepEqual([r.status, r.body.code], [409, 'QUOTA_ABOVE_CAPACITY'], show(r));
        assert.equal((await typesOf(target.eventId)).length, 0);
        assert.equal((await outbox({ type: 'ADMIN_EVENT_TABLES_CHANGED', eventId: target.eventId })).length, 0);
        const { data, error } = await service.from('audit_logs').select('id').eq('action', 'EVENT_TABLES_COPIED').eq('object_id', target.eventId);
        assert.equal(error, null, error?.message);
        assert.equal((data ?? []).length, 0);
    });

    test('état de vente de la source gardé : un type arrêté reste arrêté, un type en vente reste en vente', async () => {
        const src = await source('cv-t2-arret-source', [{ name: 'Carre CV arrete', seats: 4, count: 1 }, { name: 'Carre CV en vente', seats: 4, count: 1 }]);
        const stopped = (await typesOf(src.eventId)).find((t) => t.name === 'Carre CV arrete')!;
        const { data, error } = await service.rpc('event_table_type_save', { p: { event_id: src.eventId, actor_id: owner.userId, type_id: stopped.id, type: { is_active: false } } });
        assert.equal(error, null, error?.message);
        assert.equal((data as Row).ok, true, JSON.stringify(data));
        const target = await newTablesEvent(owner, 'cv-t2-arret-cible', { capacity: 100 });
        const r = await copy(owner, target.eventId, src.eventId);
        assert.equal(r.status, 200, show(r));
        const copied = Object.fromEntries((await typesOf(target.eventId)).map((t) => [String(t.name), t.is_active]));
        assert.deepEqual(copied, { 'Carre CV arrete': false, 'Carre CV en vente': true });
    });
});

describe('T3. Deux copies simultanées', () => {
    test('Promise.all depuis deux sources : une seule réussit, l’autre 409 TABLES_NOT_EMPTY ; aucun type sans table', async () => {
        const a = await source('cv-t3-a', [{ name: 'Carre CV A', seats: 4, count: 2 }]);
        const b = await source('cv-t3-b', [{ name: 'Carre CV B', seats: 4, count: 3 }]);
        const target = await newTablesEvent(owner, 'cv-t3-cible', { capacity: 100 });
        const [ra, rb] = await Promise.all([copy(owner, target.eventId, a.eventId), copy(owner, target.eventId, b.eventId)]);
        const statuses = [ra.status, rb.status].sort();
        assert.deepEqual(statuses, [200, 409], `${show(ra)} ; ${show(rb)}`);
        const loser = ra.status === 409 ? ra : rb;
        assert.equal(loser.body.code, 'TABLES_NOT_EMPTY', show(loser));
        const types = await typesOf(target.eventId);
        assert.equal(types.length, 1, JSON.stringify(types));
        for (const t of types) {
            const n = await tableCount(String(t.id));
            assert.ok(n > 0 && n === Number(t.total_quantity), `${String(t.name)} : ${n} table(s), quota ${String(t.total_quantity)}`);
        }
    });
});

describe('T4. Refus lu = refus écrit, code et texte, dans tous les états', () => {
    test('publié, brouillon, attente, suspendu, terminé, annulé, service fermé, fiche suspendue, administration', async () => {
        const compare = async (label: string, partner: TestPartner, eventId: string): Promise<void> => {
            const read = await report(partner, eventId);
            assert.equal(read.status, 200, `${label} : ${show(read)}`);
            const screen = read.body.edit_refusal as Row | null;
            const write = await createTableType(partner, eventId, vipType({ name: `Carre ${label}` }), 1);
            if (screen === null) {
                assert.equal(write.status, 201, `${label} : aucun refus à l'écran, écriture acceptée (${show(write)})`);
                return;
            }
            assert.deepEqual([screen.code, screen.message], [write.body.code, write.body.error], `${label} : écran ≠ écriture (${show(write)})`);
        };
        await compare('publie', owner, (await newTablesEvent(owner, 'cv-t4-publie', { capacity: 80 })).eventId);
        await compare('brouillon', owner, (await newTablesEvent(owner, 'cv-t4-brouillon', { capacity: 80, status: 'BROUILLON' })).eventId);
        await compare('attente', owner, (await newTablesEvent(owner, 'cv-t4-attente', { capacity: 80, status: 'EN_ATTENTE' })).eventId);
        for (const status of ['SUSPENDU', 'TERMINE', 'ANNULE'] as const) {
            const ev = await newTablesEvent(owner, `cv-t4-${status.toLowerCase()}`, { capacity: 80 });
            await advanceEventTo(ev.eventId, status, { partnerUserId: owner.userId, ...(status === 'TERMINE' ? { finishShift: { startsInHours: -3 } } : {}) });
            await compare(status.toLowerCase(), owner, ev.eventId);
        }
        const closed = await newTablesEvent(owner, 'cv-t4-ferme', { capacity: 80 });
        await withEventTablesSetting('features.event_tables_enabled', false, () => compare('service ferme', owner, closed.eventId));

        const suspendedPartner = await newPartner('l11cc-cv-t4-fiche');
        const ficheEvent = await newTablesEvent(suspendedPartner, 'cv-t4-fiche', { capacity: 80 });
        const { error } = await service.from('partners').update({ status: 'SUSPENDU' }).eq('id', suspendedPartner.partnerId);
        assert.equal(error, null, error?.message);
        await compare('fiche suspendue', suspendedPartner, ficheEvent.eventId);

        // Administration : la lecture de l'administration et l'écriture en base (les routes de l'organisatrice refusent un
        // compte qui n'est pas organisateur avant la base)
        const ev = await newTablesEvent(owner, 'cv-t4-admin', { capacity: 80 });
        const staff = await newAdmin('l11cc-cv-t4', ['events.read', 'events.write']);
        await stepUpTestSession(staff.accessToken);
        const read = await report(staff, ev.eventId);
        assert.equal(read.status, 200, show(read));
        const { data, error: wErr } = await service.rpc('event_table_type_save', { p: { event_id: ev.eventId, actor_id: staff.userId, count: 1, type: vipType() } });
        assert.equal(wErr, null, wErr?.message);
        const screen = read.body.edit_refusal as Row;
        assert.deepEqual([screen.code, screen.message], [(data as Row).code, (data as Row).message], JSON.stringify(data));
    });
});

describe('T5. « Retirer » proposé si et seulement si la suppression passe', () => {
    test('paiement échoué : deletable faux, delete_refusal = refus de la suppression ; type neuf : deletable vrai, suppression 200', async () => {
        const ev = await newTablesEvent(owner, 'cv-t5', { capacity: 80 });
        const t = await createdTableType(owner, ev.eventId, vipType({ name: 'Carre CV T5' }), 2);
        const fresh = await createdTableType(owner, ev.eventId, vipType({ name: 'Carre CV T5 neuf' }), 1);
        const client = await newBuyer('l11cc-cv-t5-cliente', { firstName: 'Fatou', lastName: 'Ndiayecorrige' });
        const started = await tableCheckout(client, ev.eventId, t.typeId);
        assert.equal(started.status, 200, show(started));
        const { error } = await service.rpc('payment_release', { p_payment_id: started.payment!.id, p_status: 'FAILED', p_reason: 'l11cc-cv T5' });
        assert.equal(error, null, `payment_release : ${error?.message}`);

        const read = await report(owner, ev.eventId);
        assert.equal(read.status, 200, show(read));
        const failed = rows(read.body.types).find((x) => x.id === t.typeId)!;
        assert.deepEqual([failed.deletable, failed.ever_sold, failed.locked], [false, true, false], JSON.stringify(failed));
        const del = await deleteTableType(owner, ev.eventId, t.typeId);
        assert.equal(del.status, 409, show(del));
        assert.deepEqual(failed.delete_refusal, { code: del.body.code, message: del.body.error }, show(del));

        const neuf = rows(read.body.types).find((x) => x.id === fresh.typeId)!;
        assert.deepEqual([neuf.deletable, neuf.delete_refusal], [true, null], JSON.stringify(neuf));
        const ok = await deleteTableType(owner, ev.eventId, fresh.typeId);
        assert.equal(ok.status, 200, show(ok));
    });
});
