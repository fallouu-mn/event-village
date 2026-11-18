/**
 * Lot 11a — correctifs de la contre-vérification (docs/audit-lot11a.md, trous T1 à T7 et constat). Les suites
 * tests/audit/cv11a-* restent la preuve de chaque trou (vertes après correctif, assertions inchangées) ; cette suite
 * contrôle ce que les correctifs ajoutent autour :
 *  T2 une seule table par client et par créneau dans un établissement ; au plus tables.max_pending_per_client
 *     réservations à venir non payées (gratuites confirmées comprises) ; une réservation annulée, passée ou dont
 *     l'acompte est payé ne compte plus ; même règle à la relance d'une attente échue ; demandes simultanées.
 *  T3 demande en attente de réponse annulée par le client : remboursée en entier, quelle que soit l'heure.
 *  T5 acceptation par un établissement suspendu ou une partenaire suspendue : refusée, remboursée en entier.
 *  T6 menu public : identifiant exact seulement (nom complet, partiel ou « rest-<nom> » : 404).
 *  T7 réglages halls.* et tables.* par la route du SUPERADMIN : les 22, bornes de la base.
 *  Constat : suppression d'une table ou d'une zone d'une autre partenaire : 404, jamais un faux succès.
 * Temps simulé comme dans les suites du lot (shiftReservation), jamais l'horloge. Faux SamirPay.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot11aInvariants } from '../helpers/lot11a-invariants';
import { signInAs } from '../helpers/fixtures';
import { api, clientCancel, partnerAction, routeId, service, sql } from '../audit/cv11a-helpers';
import { withFeatureFlags } from './terrain-helpers';
import { setFiche } from '../audit/cvf1-helpers';
import {
    allChannels, dayFromNow, decideVenue, newBuyer, newPartner, newTable, newVenue, newZone, openTablesService, outboxOf, payConfirmed, refundsOf, reservation, reserveRpc,
    shiftReservation, startIn, startPayment, tick, type Row, type TestPartner,
} from './l11a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;

before(async () => {
    restore = await openTablesService();
    partner = await newPartner('l11a-cv');
});

after(async () => {
    await restore();
    await assertLot11aInvariants('l11a-cv-correctifs');
});

const code = (r: Row): string => (r.ok === true ? 'OK' : String(r.code));

/** Établissement gratuit à confirmation automatique, avec `tables` tables de 4. */
async function freeVenue(tables = 1): Promise<string> {
    const venue = await newVenue(partner);
    for (let i = 0; i < tables; i += 1) await newTable(partner, venue, 4);
    return venue;
}

describe('T2 — une table par client et par créneau, au plus 3 réservations à venir non payées', () => {
    test('même établissement : 20:00 accepté, 21:00 (chevauche) refusé, 22:00 (à la suite) accepté ; autre établissement à 20:00 accepté ; la 4e réservation gratuite refusée', async () => {
        const cl = await newBuyer('l11a-cv-creneau');
        const a = await freeVenue(3);
        const b = await freeVenue();
        const c = await freeVenue();
        const date = dayFromNow(60);
        const first = await reserveRpc(cl, a, { date, time: '20:00', guests: 2 });
        const overlap = await reserveRpc(cl, a, { date, time: '21:00', guests: 2 });
        const next = await reserveRpc(cl, a, { date, time: '22:00', guests: 2 });
        const elsewhere = await reserveRpc(cl, b, { date, time: '20:00', guests: 2 });
        const fourth = await reserveRpc(cl, c, { date, time: '20:00', guests: 2 });
        assert.deepEqual([code(first), code(overlap), overlap.message, code(next), code(elsewhere)],
            ['OK', 'CLIENT_SLOT_TAKEN', 'Vous avez déjà une table dans cet établissement à cette heure-là.', 'OK', 'OK']);
        assert.deepEqual([first.booking_state, next.booking_state, elsewhere.booking_state], ['CONFIRMEE', 'CONFIRMEE', 'CONFIRMEE']);
        assert.deepEqual([code(fourth), fourth.message],
            ['TOO_MANY_PENDING', 'Vous avez déjà 3 réservations à venir sans acompte payé. Annulez-en une pour réserver une autre table.']);
        // Un autre client prend la table libre du même créneau
        assert.equal(code(await reserveRpc(await newBuyer('l11a-cv-creneau-autre'), a, { date, time: '21:00', guests: 2 })), 'OK');
    });

    test('réservation gratuite annulée, ou dont l’heure est passée : elle ne compte plus', async () => {
        const cl = await newBuyer('l11a-cv-annulee');
        const ids: string[] = [];
        for (let i = 0; i < 3; i += 1) {
            const r = await reserveRpc(cl, await freeVenue(), { date: dayFromNow(61), guests: 2 });
            assert.equal(r.ok, true, JSON.stringify(r));
            ids.push(String(r.reservation_id));
        }
        assert.equal(code(await reserveRpc(cl, await freeVenue(), { date: dayFromNow(61), guests: 2 })), 'TOO_MANY_PENDING');
        const cancelled = await clientCancel(ids[0], cl.accessToken);
        assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
        assert.equal(code(await reserveRpc(cl, await freeVenue(), { date: dayFromNow(61), guests: 2 })), 'OK', 'après une annulation');
        assert.equal(code(await reserveRpc(cl, await freeVenue(), { date: dayFromNow(61), guests: 2 })), 'TOO_MANY_PENDING');
        await shiftReservation(ids[1], { startMinutes: -30 });
        assert.equal(code(await reserveRpc(cl, await freeVenue(), { date: dayFromNow(61), guests: 2 })), 'OK', 'après l’heure d’une réservation');
    });

    test('demande dont l’acompte est payé (en attente de réponse) : elle ne compte plus parmi les réservations non payées', async () => {
        const cl = await newBuyer('l11a-cv-payee');
        const manual = await newVenue(partner, { deposit_per_person: 2_000, confirmation_mode: 'MANUELLE' });
        await newTable(partner, manual, 4);
        const paid = String((await reserveRpc(cl, manual, { date: dayFromNow(62), guests: 2 })).reservation_id);
        await payConfirmed(cl, paid);
        assert.deepEqual([(await reservation(paid)).booking_state, Number((await reservation(paid)).paid_amount)], ['EN_ATTENTE_ACCEPTATION', 4_200]);
        for (let i = 0; i < 3; i += 1) assert.equal(code(await reserveRpc(cl, await freeVenue(), { date: dayFromNow(62), guests: 2 })), 'OK', `gratuite ${i + 1}`);
        assert.equal(code(await reserveRpc(cl, await freeVenue(), { date: dayFromNow(62), guests: 2 })), 'TOO_MANY_PENDING');
    });

    test('relance d’une attente échue : refusée au-delà de 3 réservations non payées (gratuites comprises), et si le client tient déjà une table du même établissement au même créneau', async () => {
        const cl = await newBuyer('l11a-cv-relance');
        const paidVenue = await newVenue(partner, { deposit_per_person: 2_000 });
        const t1 = await newTable(partner, paidVenue, 4);
        const t2 = await newTable(partner, paidVenue, 4);
        const date = dayFromNow(63);
        const expired = String((await reserveRpc(cl, paidVenue, { date, time: '20:00', guests: 2, tableId: t1 })).reservation_id);
        await shiftReservation(expired, { holdMinutes: -1 });
        await tick();
        assert.equal((await reservation(expired)).booking_state, 'EXPIREE');
        // Autre table du même établissement, créneau qui chevauche : la table de l'attente échue reste libre
        const sameSlot = await reserveRpc(cl, paidVenue, { date, time: '20:30', guests: 2, tableId: t2 });
        assert.equal(sameSlot.ok, true, JSON.stringify(sameSlot));
        const slotTaken = await startPayment(cl, expired);
        assert.deepEqual([slotTaken.body.code, slotTaken.payment], ['CLIENT_SLOT_TAKEN', null]);
        assert.equal((await reservation(expired)).booking_state, 'EXPIREE');

        const cl2 = await newBuyer('l11a-cv-relance-limite');
        const v2 = await newVenue(partner, { deposit_per_person: 2_000 });
        await newTable(partner, v2, 4);
        const expired2 = String((await reserveRpc(cl2, v2, { date, guests: 2 })).reservation_id);
        await shiftReservation(expired2, { holdMinutes: -1 });
        for (let i = 0; i < 3; i += 1) assert.equal(code(await reserveRpc(cl2, await freeVenue(), { date, guests: 2 })), 'OK');
        const limited = await startPayment(cl2, expired2);
        assert.deepEqual([limited.status, limited.body.code, limited.payment], [429, 'TOO_MANY_PENDING', null]);
        assert.notEqual((await reservation(expired2)).booking_state, 'EN_ATTENTE_PAIEMENT', 'attente reprise malgré le refus');
    });

    test('demandes simultanées du même client : 6 au même créneau du même établissement → une seule ; 6 dans 6 établissements → 3', async () => {
        const cl = await newBuyer('l11a-cv-course');
        const venue = await freeVenue(6);
        const date = dayFromNow(64);
        const same = await Promise.all([0, 1, 2, 3, 4, 5].map(() => reserveRpc(cl, venue, { date, time: '20:00', guests: 2 })));
        assert.equal(same.filter((r) => r.ok === true).length, 1, JSON.stringify(same.map(code)));
        assert.ok(same.filter((r) => r.ok !== true).every((r) => r.code === 'CLIENT_SLOT_TAKEN'), JSON.stringify(same.map(code)));

        const cl2 = await newBuyer('l11a-cv-course-6');
        const venues = await Promise.all([0, 1, 2, 3, 4, 5].map(() => freeVenue()));
        const spread = await Promise.all(venues.map((v) => reserveRpc(cl2, v, { date, time: '20:00', guests: 2 })));
        assert.equal(spread.filter((r) => r.ok === true).length, 3, JSON.stringify(spread.map(code)));
        assert.ok(spread.filter((r) => r.ok !== true).every((r) => r.code === 'TOO_MANY_PENDING'), JSON.stringify(spread.map(code)));
    });
});

describe('T3 — demande en attente de réponse annulée par le client : remboursée en entier, quelle que soit l’heure', () => {
    test('demande payée (21 000 F), annulée à 1 h 30 de l’heure : 21 000 rendus, message du remboursement ; réservation confirmée annulée à 1 h 30 : rien rendu', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 5_000, confirmation_mode: 'MANUELLE' });
        await newTable(partner, venue, 4);
        const cl = await newBuyer('l11a-cv-annule-demande');
        const id = String((await reserveRpc(cl, venue, { ...startIn(180), guests: 4 })).reservation_id);
        await payConfirmed(cl, id);
        await shiftReservation(id, { startMinutes: 90, responseMinutes: 30 });
        assert.equal((await reservation(id)).booking_state, 'EN_ATTENTE_ACCEPTATION');
        const r = await clientCancel(id, cl.accessToken);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal((r.body as Row).message, 'Réservation annulée. Vous êtes remboursé de 21 000 F CFA sur votre compte de paiement.');
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, Number(row.refund_percent), Number(row.refunded_amount)], ['ANNULEE_CLIENT', 100, 21_000]);
        assert.deepEqual((await refundsOf(id)).map((f) => Number(f.amount)), [21_000]);

        // Garde-fou : la règle des 2 h vaut toujours pour une réservation confirmée
        const auto = await newVenue(partner, { deposit_per_person: 5_000 });
        await newTable(partner, auto, 4);
        const cl2 = await newBuyer('l11a-cv-annule-confirmee');
        const confirmed = String((await reserveRpc(cl2, auto, { ...startIn(180), guests: 4 })).reservation_id);
        await payConfirmed(cl2, confirmed);
        await shiftReservation(confirmed, { startMinutes: 90 });
        assert.equal((await reservation(confirmed)).booking_state, 'CONFIRMEE');
        const late = await clientCancel(confirmed, cl2.accessToken);
        assert.equal(late.status, 200, JSON.stringify(late.body));
        assert.deepEqual([(await reservation(confirmed)).booking_state, (await refundsOf(confirmed)).length], ['ANNULEE_CLIENT', 0]);
    });
});

describe('T5 — l’acceptation refait les contrôles de l’établissement et de la partenaire', () => {
    for (const scenario of ['établissement suspendu', 'fiche de la partenaire suspendue'] as const) {
        test(`${scenario} : la demande payée n’est pas confirmée, elle est refusée et remboursée en entier (21 000), avis du refus`, async () => {
            const owner = await newPartner(scenario === 'établissement suspendu' ? 'l11a-cv-accepte-etab' : 'l11a-cv-accepte-fiche');
            const venue = await newVenue(owner, { deposit_per_person: 5_000, confirmation_mode: 'MANUELLE' });
            await newTable(owner, venue, 4);
            const cl = await newBuyer(scenario === 'établissement suspendu' ? 'l11a-cv-accepte-etab-cl' : 'l11a-cv-accepte-fiche-cl');
            const id = String((await reserveRpc(cl, venue, { date: dayFromNow(65), guests: 4 })).reservation_id);
            await payConfirmed(cl, id);
            if (scenario === 'établissement suspendu') assert.equal((await decideVenue(venue, 'SUSPENDRE', 'Contrôle d’hygiène en cours.')).ok, true);
            else await setFiche(owner.partnerId, 'SUSPENDU');
            const r = await partnerAction(id, owner.accessToken, { action: 'ACCEPTER' });
            if (scenario !== 'établissement suspendu') await setFiche(owner.partnerId, 'VALIDE');
            assert.deepEqual([r.status, (r.body as Row).code, (r.body as Row).error], [409, 'VENUE_NOT_AVAILABLE',
                'Cet établissement n’accepte plus de réservation pour le moment : la demande est refusée et le client remboursé en entier.']);
            const row = await reservation(id);
            assert.deepEqual([row.booking_state, Number(row.paid_amount), Number(row.refunded_amount), Number(row.refund_percent)], ['REFUSEE', 21_000, 21_000, 100]);
            assert.deepEqual((await refundsOf(id)).map((f) => Number(f.amount)), [21_000]);
            const notices = await outboxOf(cl.userId, id);
            assert.deepEqual(notices.filter((t) => t.startsWith('TABLE_REQUEST_REFUSED:')), allChannels('TABLE_REQUEST_REFUSED'));
            assert.deepEqual(notices.filter((t) => t.startsWith('TABLE_RESERVATION_CONFIRMED:')), [], 'aucun avis de confirmation');
        });
    }

    test('garde-fou : établissement validé et partenaire VALIDE, la demande payée est acceptée (confirmée)', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 5_000, confirmation_mode: 'MANUELLE' });
        await newTable(partner, venue, 4);
        const cl = await newBuyer('l11a-cv-accepte-ok');
        const id = String((await reserveRpc(cl, venue, { date: dayFromNow(66), guests: 4 })).reservation_id);
        await payConfirmed(cl, id);
        const r = await partnerAction(id, partner.accessToken, { action: 'ACCEPTER' });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal((await reservation(id)).booking_state, 'CONFIRMEE');
    });
});

describe('T6 — /api/restaurants/[id]/menu : identifiant exact seulement', () => {
    test('identifiant d’une partenaire VALIDE : son menu ; son nom complet, un nom partiel ou « rest-<nom> » : 404, jamais un menu', async () => {
        const named = await newPartner('l11a-cv-menu');
        const unique = `Chez L11a Cv Menu ${Date.now()}`;
        assert.equal((await service.from('partners').update({ commercial_name: unique }).eq('id', named.partnerId)).error, null);
        const { error } = await service.from('products').insert({ partner_id: named.partnerId, name: 'TEST Yassa l11a cv', price: 3_000, status: 'DISPONIBLE' });
        assert.equal(error, null, error?.message);
        const out = await withFeatureFlags({ orders: true }, async () => {
            const byId = await routeId('GET', 'restaurants/[id]/menu', named.partnerId, null);
            const others: Row = {};
            for (const id of [unique, `rest-${unique.toLowerCase().replace(/ /g, '-')}`, 'l11a', 'rest-e']) {
                const r = await routeId('GET', 'restaurants/[id]/menu', id, null);
                others[id] = `${r.status} ${JSON.stringify(r.body).includes('TEST Yassa l11a cv') ? 'menu' : ''}`.trim();
            }
            return { byId, others };
        });
        assert.equal(out.byId.status, 200, JSON.stringify(out.byId.body));
        assert.equal((out.byId.body as Row).partnerName, unique);
        assert.ok(JSON.stringify(out.byId.body).includes('TEST Yassa l11a cv'), 'menu de la partenaire');
        for (const [id, s] of Object.entries(out.others)) assert.equal(s, '404', `« ${id} » : ${String(s)}`);
    });
});

describe('T7 — PUT /api/admin/finance-settings : les 22 réglages des salles et des tables', () => {
    test('SUPERADMIN : chacun des 22 réglages halls.* et tables.* enregistré à la même valeur (200) ; hors bornes refusé par la base (400, motif en français) ; valeur inchangée', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const rows = await sql<{ key: string; value: Row }>(`SELECT key, value FROM public.platform_settings WHERE key ~ '^(halls|tables)\.' ORDER BY key`);
        assert.equal(rows.length, 22, `réglages des salles et des tables : ${rows.map((r) => r.key).join(', ')}`);
        assert.deepEqual([rows.filter((r) => r.key.startsWith('halls.')).length, rows.filter((r) => r.key.startsWith('tables.')).length], [12, 10]);
        const problems: string[] = [];
        for (const r of rows) {
            const value = r.value.value;
            const same = await api('PUT', 'admin/finance-settings', { token: superadmin.accessToken, body: { key: r.key, value, reason: 'correctif T7 : même valeur' } });
            if (same.status !== 200 || JSON.stringify((same.body as Row).value) !== JSON.stringify(value)) problems.push(`${r.key} même valeur : ${same.status} ${JSON.stringify(same.body)}`);
            const bad = typeof value === 'boolean' ? 5 : -1;
            const refused = await api('PUT', 'admin/finance-settings', { token: superadmin.accessToken, body: { key: r.key, value: bad, reason: 'correctif T7 : valeur interdite' } });
            const error = String((refused.body as Row).error ?? '');
            if (refused.status !== 400 || (refused.body as Row).code !== 'INVALID_VALUE' || /[a-z]+\.[a-z_]+/.test(error)) problems.push(`${r.key} = ${bad} : ${refused.status} ${JSON.stringify(refused.body)}`);
            const now = (await sql<{ value: Row }>(`SELECT value FROM public.platform_settings WHERE key = $1`, [r.key]))[0];
            if (JSON.stringify(now.value) !== JSON.stringify(r.value)) problems.push(`${r.key} : valeur changée (${JSON.stringify(r.value)} → ${JSON.stringify(now.value)})`);
        }
        assert.deepEqual(problems, []);
    });

    test('clé inconnue des salles ou des tables : « Ce réglage n’existe pas » ; famille inconnue toujours refusée par la route ; sans session SUPERADMIN : refus', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const unknown = await api('PUT', 'admin/finance-settings', { token: superadmin.accessToken, body: { key: 'tables.inconnu', value: 1, reason: 'correctif T7 : clé inconnue' } });
        assert.deepEqual([unknown.status, (unknown.body as Row).code, (unknown.body as Row).error], [400, 'UNKNOWN_KEY', 'Ce réglage n’existe pas.']);
        const family = await api('PUT', 'admin/finance-settings', { token: superadmin.accessToken, body: { key: 'salles.hold_minutes', value: 15, reason: 'correctif T7 : famille inconnue' } });
        assert.equal(family.status, 400, JSON.stringify(family.body));
        const client = await newBuyer('l11a-cv-reglages');
        const forbidden = await api('PUT', 'admin/finance-settings', { token: client.accessToken, body: { key: 'tables.hold_minutes', value: 15, reason: 'correctif T7 : client' } });
        assert.ok(forbidden.status === 401 || forbidden.status === 403, `client : ${forbidden.status}`);
    });
});

describe('Constat — DELETE /api/partner/tables/[id] : jamais un faux succès', () => {
    test('table ou zone d’une autre partenaire : 404, rien supprimé ; les siennes (sans réservation) : 200, supprimées', async () => {
        const owner = await newPartner('l11a-cv-suppr-proprietaire');
        const other = await newPartner('l11a-cv-suppr-autre');
        const venue = await newVenue(owner);
        const zone = await newZone(owner, venue, 'Terrasse');
        const table = await newTable(owner, venue, 4, { zoneId: zone });
        const otherTable = await routeId('DELETE', 'partner/tables/[id]', table, other.accessToken);
        const otherZone = await routeId('DELETE', 'partner/tables/[id]', zone, other.accessToken, undefined, '?type=zone');
        assert.deepEqual([otherTable.status, (otherTable.body as Row).error, otherZone.status, (otherZone.body as Row).error],
            [404, 'Table introuvable.', 404, 'Zone introuvable.']);
        assert.equal((await sql(`SELECT id FROM public.restaurant_tables WHERE id = $1`, [table])).length, 1, 'table d’une autre supprimée');
        assert.equal((await sql(`SELECT id FROM public.restaurant_zones WHERE id = $1`, [zone])).length, 1, 'zone d’une autre supprimée');
        const unknown = await routeId('DELETE', 'partner/tables/[id]', '00000000-0000-4000-8000-000000000000', owner.accessToken);
        assert.equal(unknown.status, 404, JSON.stringify(unknown.body));
        const mine = await routeId('DELETE', 'partner/tables/[id]', table, owner.accessToken);
        assert.equal(mine.status, 200, JSON.stringify(mine.body));
        assert.equal((await sql(`SELECT id FROM public.restaurant_tables WHERE id = $1`, [table])).length, 0);
        const myZone = await routeId('DELETE', 'partner/tables/[id]', zone, owner.accessToken, undefined, '?type=zone');
        assert.equal(myZone.status, 200, JSON.stringify(myZone.body));
        assert.equal((await sql(`SELECT id FROM public.restaurant_zones WHERE id = $1`, [zone])).length, 0);
    });
});
