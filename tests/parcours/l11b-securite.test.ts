/**
 * Lot 11b — tables : failles trouvées pendant le lot (tests rouges d'abord, puis correctifs).
 *
 *  F1. Fiche partenaire SUSPENDU (compte ACTIF) : la garde des fiches (lib/auth/partner-fiche-guard.ts) refusait les
 *      écritures des événements, de l'équipe, des caisses et des salles, mais PAS celles des établissements et des tables
 *      (/api/partner/venues*, /api/partner/tables*). Une partenaire suspendue renommait un établissement validé, créait
 *      des tables, marquait « absent » un client qui avait payé son acompte (l'acompte est alors gardé) ou annulait ses
 *      réservations. En base, table_reservation_presence et table_reservation_cancel (origine établissement) ne
 *      vérifiaient que le compte (ACTIF), jamais la fiche.
 *
 * Base LOCALE seulement, faux SamirPay. Routes réelles (gestionnaires importés, session par jeton).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import {
    newBuyer, newPartner, newTable, newVenue, openTablesService, payConfirmed, reservation, reserveRpc, dayFromNow,
    routeId, service, shiftReservation, show, type Buyer, type Row, type TestPartner,
} from '../audit/cv11a-helpers';

let restore: () => Promise<void>;
let host: TestPartner;
let client: Buyer;
let venue = '';
let day = 10;

/** Réservation confirmée et payée (acompte), un jour différent à chaque appel ; `startedMinutesAgo` : déjà commencée. */
async function paidReservation(startedMinutesAgo?: number): Promise<string> {
    day += 1;
    // Une table par réservation : déplacer le début d'une réservation ne la fait jamais chevaucher une autre
    const tableId = await newTable(host, venue, 4, { number: `S${day}` });
    const r = await reserveRpc(client, venue, { date: dayFromNow(day), time: '20:00', guests: 4, tableId });
    assert.equal(r.ok, true, JSON.stringify(r));
    const id = String(r.reservation_id);
    await payConfirmed(client, id);
    if (startedMinutesAgo !== undefined) await shiftReservation(id, { startMinutes: -startedMinutesAgo });
    return id;
}

async function setFiche(partnerId: string, status: 'VALIDE' | 'SUSPENDU'): Promise<void> {
    const { error } = await service.from('partners').update({ status }).eq('id', partnerId);
    assert.equal(error, null, `fiche ${partnerId} → ${status} : ${error?.message}`);
}

before(async () => {
    restore = await openTablesService();
    host = await newPartner('l11b-suspendue');
    client = await newBuyer('l11b-client-suspendue', { firstName: 'Awa', lastName: 'Diop' });
    venue = await newVenue(host, { deposit_per_person: 5_000 });
});

after(async () => {
    await setFiche(host.partnerId, 'VALIDE');
    await restore();
    await assertFinanceInvariants('l11b-securite');
});

describe('F1. Fiche partenaire SUSPENDU : établissements, tables et réservations en lecture seule', () => {
    test('routes : renommer l’établissement, créer une table, marquer absent, annuler → 403 PARTNER_SUSPENDED, rien d’écrit', async () => {
        // Commencée il y a 10 minutes : « Client absent » serait possible pour une fiche VALIDE
        const paidRes = await paidReservation(10);
        const laterRes = await paidReservation();
        const { data: before0 } = await service.from('venues').select('name').eq('id', venue).single();
        const { count: tablesBefore } = await service.from('restaurant_tables').select('id', { count: 'exact', head: true }).eq('venue_id', venue);
        await setFiche(host.partnerId, 'SUSPENDU');
        try {
            const rename = await routeId('PATCH', 'partner/venues/[id]', venue, host.accessToken, { name: 'Renommé pendant la suspension' });
            const create = await routeId('POST', 'partner/tables', '', host.accessToken, { venue_id: venue, table_number: 'S9', capacity: 4 });
            const absent = await routeId('PATCH', 'partner/tables/reservations/[id]', paidRes, host.accessToken, { action: 'ABSENT' });
            const cancel = await routeId('PATCH', 'partner/tables/reservations/[id]', laterRes, host.accessToken, { action: 'ANNULER', reason: 'Annulation par une fiche suspendue' });
            const { data: after0 } = await service.from('venues').select('name').eq('id', venue).single();
            const { count: tablesAfter } = await service.from('restaurant_tables').select('id', { count: 'exact', head: true }).eq('venue_id', venue);
            const states = { paid: (await reservation(paidRes)).booking_state, later: (await reservation(laterRes)).booking_state };
            console.log(`[L11B] F1 routes : ${JSON.stringify({ rename: show(rename), create: show(create), absent: show(absent), cancel: show(cancel), venue: after0, tables: [tablesBefore, tablesAfter], states })}`);
            for (const [k, r] of Object.entries({ rename, create, absent, cancel })) {
                assert.equal(r.status, 403, `${k} par une fiche SUSPENDU : ${show(r)}`);
                assert.equal(r.body.code, 'PARTNER_SUSPENDED', `${k} : ${show(r)}`);
            }
            assert.deepEqual(after0, before0, 'établissement inchangé');
            assert.equal(tablesAfter, tablesBefore, 'aucune table créée');
            assert.deepEqual(states, { paid: 'CONFIRMEE', later: 'CONFIRMEE' }, 'réservations inchangées');
        } finally {
            await setFiche(host.partnerId, 'VALIDE');
        }
    });

    test('base : présence et annulation par l’établissement refusées pour une fiche SUSPENDU (défense en profondeur)', async () => {
        const paidRes = await paidReservation(10);
        const laterRes = await paidReservation();
        await setFiche(host.partnerId, 'SUSPENDU');
        try {
            const { data: absent, error: e1 } = await service.rpc('table_reservation_presence', { p: { reservation_id: paidRes, actor_id: host.userId, action: 'ABSENT' } });
            const { data: cancel, error: e2 } = await service.rpc('table_reservation_cancel', { p: { reservation_id: laterRes, actor_id: host.userId, origin: 'ETABLISSEMENT', reason: 'Annulation par une fiche suspendue' } });
            assert.equal(e1, null, e1?.message);
            assert.equal(e2, null, e2?.message);
            console.log(`[L11B] F1 base : ${JSON.stringify({ absent, cancel })}`);
            assert.equal((absent as Row).ok, false, `présence : ${JSON.stringify(absent)}`);
            assert.equal((absent as Row).code, 'PARTNER_SUSPENDED', `présence : ${JSON.stringify(absent)}`);
            assert.equal((cancel as Row).ok, false, `annulation : ${JSON.stringify(cancel)}`);
            assert.equal((cancel as Row).code, 'PARTNER_SUSPENDED', `annulation : ${JSON.stringify(cancel)}`);
            assert.equal((await reservation(paidRes)).booking_state, 'CONFIRMEE');
            assert.equal((await reservation(laterRes)).booking_state, 'CONFIRMEE');
        } finally {
            await setFiche(host.partnerId, 'VALIDE');
        }
    });

    test('garde-fou : fiche VALIDE, mêmes actions acceptées (le refus vise bien la suspension)', async () => {
        const paidRes = await paidReservation(10);
        const absent = await routeId('PATCH', 'partner/tables/reservations/[id]', paidRes, host.accessToken, { action: 'ABSENT' });
        assert.equal(absent.status, 200, show(absent));
        assert.equal((await reservation(paidRes)).booking_state, 'ABSENT');
    });
});
