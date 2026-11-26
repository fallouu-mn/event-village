/**
 * Contre-vérification du lot 11c-c — TROUS. Chaque test décrit le comportement attendu : VERT = attaque bloquée,
 * ROUGE = trou (branche lot11c/cv-rouges-c, jamais fusionnée). Base LOCALE, faux SamirPay.
 *
 *  T1. Liste de la porte lisible par un contrôleur affecté HORS de la plage du contrôle (événement dans 10 jours ;
 *      événement suspendu) : titulaires et invités en prénom et initiale, numéros de table. La liste des invités
 *      (ticket_guest_list_search) et le scan ne révèlent rien hors de la plage depuis la finition 1 (complément 10,
 *      cvf1c-t4) ; la page /controller/porte/[id] du lot et le lien du scanner l'exposent.
 *  T2. Copie refusée au 2e type sur un événement validé : aucune table ne reste, mais des avis
 *      ADMIN_EVENT_TABLES_CHANGED partent aux administrateurs et l'historique de la fiche montre des changements qui n'ont
 *      jamais eu lieu (création puis retrait du 1er type, chacun dans sa transaction).
 *  T3. Deux copies simultanées vers la même cible depuis deux événements différents : les deux répondent 200 ; la seconde
 *      enregistre la liste complète de SES tables et supprime celles de la première. Le type de la première reste
 *      sans aucune table (entrelacement forcé, sans hasard).
 *  T4. Texte du refus lu par l'écran différent de celui de l'écriture pour EVENT_LOCKED (terminé, annulé) et
 *      ADMIN_CANNOT_EDIT ; le rapport ne déclare que le texte de l'attente de validation comme propre à l'écran.
 *  T5. Type de table présenté comme supprimable (ever_sold faux, locked faux : bouton « Supprimer » de l'éditeur) après un
 *      paiement échoué, mais la suppression est refusée (CATEGORY_HAS_SALES) : l'écran cache une raison du refus.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLot11cInvariants } from '../helpers/lot11c-invariants';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { stepUpTestSession } from '../helpers/admin-step-up';
import { newBuyer, service, type Buyer } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { newAdmin } from '../parcours/notif-helpers';
import { advanceEventTo } from '../parcours/cycle-helpers';
import {
    buyTable, createTableType, createdTableType, deleteTableType, doorList, newTablesEvent, outbox, show, switchEventTablesService,
    tableCheckout, transferSeat, vipType, type Row,
} from '../parcours/l11c-helpers';
import { adminTables, beforeRpc, clearHook, copy, hookPending, newController, report, rows, sourceWithTables, tablesState } from './cv11cc-helpers';

let restore: () => Promise<void>;
let owner: TestPartner;
let holder: Buyer;
let guest: Buyer;

before(async () => {
    restore = await switchEventTablesService(true);
    owner = await newPartner('cv11cc-t');
    holder = await newBuyer('cv11cc-t-titulaire', { firstName: 'Awa', lastName: 'Dioptrou' });
    guest = await newBuyer('cv11cc-t-invitee', { firstName: 'Mariama', lastName: 'Sowtrou' });
});

after(async () => {
    clearHook();
    if (restore) await restore();
    await checkLot11cInvariants('cv11cc-1-trous');
    await assertNotificationInvariants('cv11cc-1-trous');
});

/** Événement aux tables (début dans 10 jours par défaut), une table vendue à `holder`, une place acceptée par `guest`. */
async function soldEvent(label: string): Promise<{ eventId: string; typeId: string }> {
    const ev = await newTablesEvent(owner, label, { capacity: 100 });
    const t = await createdTableType(owner, ev.eventId, vipType({ name: `Carre ${label}` }), 2);
    const sold = await buyTable(holder, ev.eventId, t.typeId);
    const transferId = await transferSeat(String(sold.tickets[0].id), holder, guest.phoneE164);
    const { data, error } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: transferId, actor_id: guest.userId } });
    assert.equal(error, null, `ticket_transfer_accept : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, JSON.stringify(data));
    return { eventId: ev.eventId, typeId: t.typeId };
}

describe('T1. Liste de la porte hors de la plage du contrôle', () => {
    test('contrôleur affecté, contrôle pas encore ouvert (début dans 10 jours) : aucune liste', async () => {
        const ev = await soldEvent('t1-avant');
        const { data: problem, error } = await service.rpc('scan_event_problem', { p_event: ev.eventId });
        assert.equal(error, null, error?.message);
        assert.equal(problem, 'event_not_open', 'contrôle fermé pour le scan et la liste des invités');
        const ctl = await newController('cv11cc-t1-avant', ev.eventId, owner.userId);
        const r = await doorList(ctl, ev.eventId);
        const text = JSON.stringify(r.body);
        assert.ok(!text.includes('Awa D.') && !text.includes('Mariama S.'),
            `hors de la plage, la porte livre les titulaires et invités (HTTP ${r.status}) : ${show(r)}`);
        assert.notEqual(r.status, 200, `hors de la plage : refus attendu, obtenu ${show(r)}`);
    });

    test('contrôleur affecté, événement SUSPENDU (contrôle fermé tout de suite) : aucune liste', async () => {
        const ev = await soldEvent('t1-suspendu');
        const ctl = await newController('cv11cc-t1-susp', ev.eventId, owner.userId);
        await advanceEventTo(ev.eventId, 'SUSPENDU', { partnerUserId: owner.userId });
        const { data: problem } = await service.rpc('scan_event_problem', { p_event: ev.eventId });
        assert.equal(problem, 'event_suspended');
        const r = await doorList(ctl, ev.eventId);
        const text = JSON.stringify(r.body);
        assert.ok(!text.includes('Awa D.') && !text.includes('Mariama S.'),
            `événement suspendu, la porte livre les titulaires et invités (HTTP ${r.status}) : ${show(r)}`);
        assert.notEqual(r.status, 200, `événement suspendu : refus attendu, obtenu ${show(r)}`);
    });
});

describe('T2. Copie refusée au 2e type après la validation', () => {
    test('rien ne reste, et aucun avis ADMIN_EVENT_TABLES_CHANGED ni changement dans l’historique de la fiche', async () => {
        // Source : 2 tables de 4 places puis 2 tables de 6 places (8 + 12 places)
        const source = await sourceWithTables(owner, 't2-source', [{ name: 'Carre T2 un', seats: 4, count: 2 }, { name: 'Carre T2 deux', seats: 6, count: 2 }]);
        // Cible publiée : 20 billets ; capacité 33 → le 1er type passe (28), le 2e non (40)
        const target = await newTablesEvent(owner, 't2-cible', { capacity: 33 });
        assert.equal((await outbox({ type: 'ADMIN_EVENT_TABLES_CHANGED', eventId: target.eventId })).length, 0, 'aucun avis avant la copie');
        const r = await copy(owner, target.eventId, source);
        assert.equal(r.status, 409, `copie refusée par la jauge au 2e type : ${show(r)}`);
        const state = await tablesState(target.eventId);
        assert.deepEqual([state.types.length, state.tables.length], [0, 0], `aucun reste en base : ${JSON.stringify(state)}`);

        const alerts = await outbox({ type: 'ADMIN_EVENT_TABLES_CHANGED', eventId: target.eventId });
        const reader = await newAdmin('cv11cc-t2', ['events.read']);
        await stepUpTestSession(reader.accessToken);
        const sheet = await adminTables(reader, target.eventId);
        assert.equal(sheet.status, 200, show(sheet));
        const changes = rows(sheet.body.changes);
        assert.deepEqual([alerts.length, changes.length], [0, 0],
            `copie refusée sans aucun effet, mais ${alerts.length} avis ADMIN_EVENT_TABLES_CHANGED en file et ${changes.length} changement(s) dans l’historique de la fiche : ${JSON.stringify(changes)}`);
    });
});

describe('T3. Deux copies simultanées depuis deux événements différents', () => {
    test('jamais deux réponses 200 ; jamais un type sans table après les copies', async () => {
        const sourceA = await sourceWithTables(owner, 't3-source-a', [{ name: 'Carre T3 A', seats: 4, count: 2 }]);
        const sourceB = await sourceWithTables(owner, 't3-source-b', [{ name: 'Carre T3 B', seats: 4, count: 3 }]);
        const target = await newTablesEvent(owner, 't3-cible', { capacity: 100 });

        // La copie A a passé ses lectures (cible vide) ; juste avant son 1er enregistrement, la copie B s'exécute en entier
        let second: { status: number; body: Row } | null = null;
        beforeRpc('event_table_copy', [target.eventId, sourceA], async () => {
            second = await copy(owner, target.eventId, sourceB);
        });
        const first = await copy(owner, target.eventId, sourceA);
        assert.equal(hookPending(), false, 'entrelacement joué');
        assert.ok(second, 'seconde copie exécutée');
        const b = second as unknown as { status: number; body: Row };
        assert.equal(b.status, 200, `copie B seule sur la cible vide : ${show(b)}`);

        const state = await tablesState(target.eventId);
        const perType = state.types.map((t) => [String(t.name), state.tables.filter((x) => x.category_id === t.id).length, Number(t.total_quantity)]);
        const empty = perType.filter(([, n]) => n === 0);
        assert.deepEqual(empty, [],
            `copie A ${first.status}, copie B ${b.status} ; type(s) laissé(s) sans table : ${JSON.stringify(perType)}`);
        assert.ok(!(first.status === 200 && b.status === 200),
            `les deux copies répondent 200 sur la même cible : ${JSON.stringify(perType)}`);
    });
});

describe('T4. Le texte du refus lu par l’écran est celui de l’écriture', () => {
    test('EVENT_LOCKED (terminé, annulé) et ADMIN_CANNOT_EDIT : même code ET même texte', async () => {
        const mismatches: string[] = [];
        for (const status of ['TERMINE', 'ANNULE'] as const) {
            const ev = await newTablesEvent(owner, `t4-${status.toLowerCase()}`, { capacity: 80 });
            await createdTableType(owner, ev.eventId, vipType(), 1);
            await advanceEventTo(ev.eventId, status, { partnerUserId: owner.userId, ...(status === 'TERMINE' ? { finishShift: { startsInHours: -3 } } : {}) });
            const read = await report(owner, ev.eventId);
            assert.equal(read.status, 200, show(read));
            const write = await createTableType(owner, ev.eventId, vipType(), 1);
            const screen = read.body.edit_refusal as Row;
            assert.equal(screen.code, write.body.code, `${status} : codes (${show(write)})`);
            const written = String(write.body.error ?? write.body.message);
            if (screen.message !== written) mismatches.push(`${status} : écran « ${String(screen.message)} » ≠ écriture « ${written} »`);
        }
        const ev = await newTablesEvent(owner, 't4-admin', { capacity: 80 });
        const staff = await newAdmin('cv11cc-t4', ['events.read', 'events.write']);
        await stepUpTestSession(staff.accessToken);
        const read = await report(staff, ev.eventId);
        assert.equal(read.status, 200, show(read));
        const { data, error } = await service.rpc('event_table_type_save', { p: { event_id: ev.eventId, actor_id: staff.userId, count: 1, type: vipType() } });
        assert.equal(error, null, error?.message);
        const w = data as Row;
        const screen = read.body.edit_refusal as Row;
        assert.equal(screen.code, w.code, `administration : codes (${JSON.stringify(w)})`);
        if (screen.message !== w.message) mismatches.push(`ADMIN_CANNOT_EDIT : écran « ${String(screen.message)} » ≠ écriture « ${String(w.message)} »`);
        assert.deepEqual(mismatches, [], `textes différents :\n${mismatches.join('\n')}`);
    });
});

describe('T5. Type présenté comme supprimable, suppression refusée', () => {
    test('après un paiement échoué : l’écran propose « Supprimer » si et seulement si la suppression passe', async () => {
        const ev = await newTablesEvent(owner, 't5', { capacity: 80 });
        const t = await createdTableType(owner, ev.eventId, vipType({ name: 'Carre T5' }), 2);
        const client = await newBuyer('cv11cc-t5-cliente', { firstName: 'Fatou', lastName: 'Ndiayetrou' });
        const started = await tableCheckout(client, ev.eventId, t.typeId);
        assert.equal(started.status, 200, show(started));
        const { error } = await service.rpc('payment_release', { p_payment_id: started.payment!.id, p_status: 'FAILED', p_reason: 'cv11cc T5' });
        assert.equal(error, null, `payment_release : ${error?.message}`);

        const read = await report(owner, ev.eventId);
        assert.equal(read.status, 200, show(read));
        const type = rows(read.body.types).find((x) => x.id === t.typeId)!;
        assert.deepEqual([Number(type.held_tables), Number(type.sold_tables)], [0, 0], `paiement échoué, rien en paiement : ${JSON.stringify(type)}`);
        // Condition du bouton « Supprimer » de components/event-tables/TablesEditor.tsx (éditeur modifiable)
        const offered = read.body.edit_refusal === null && type.ever_sold !== true && type.locked !== true;
        const del = await deleteTableType(owner, ev.eventId, t.typeId);
        assert.equal(offered, del.status === 200,
            `écran : « Supprimer » ${offered ? 'proposé' : 'caché'} (ever_sold ${String(type.ever_sold)}, locked ${String(type.locked)}) ; écriture : ${show(del)}`);
    });
});
