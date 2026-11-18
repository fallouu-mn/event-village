/**
 * Lot 11a — réserver et payer une table (argent et sécurité). Montants calculés à la main dans chaque test, avec les
 * réglages par défaut vérifiés en tête : frais de service 5 % (sur l'acompte), commission 0 %, créneau 2 h, attente de
 * paiement 15 minutes, réponse de l'établissement sous 2 h, absence 30 minutes après l'heure, annulation gratuite
 * jusqu'à 2 h avant, 3 demandes en attente au plus, frais Wave 1,5 %, garde des ventes 48 h après la fin.
 *
 *  A. Réserver (T1, T2, T3, T5, T6) : gratuite et confirmée tout de suite, acompte par personne, arrondis, créneau de
 *     l'établissement, table choisie par la base (la plus petite qui convient), horaires d'ouverture (plages, nuit,
 *     jour fermé), dates ; attaques : montant dans le corps, 0 F, établissement non validé / refusé / suspendu /
 *     inactif, partenaire suspendue, son propre établissement, table ou zone d'un autre établissement, table trop
 *     petite, chevauchements simultanés, 3 demandes au plus, attente échue, réservation sans table, écriture directe.
 *  B. Payer (C1, T4) : acompte relu en base, confirmation automatique ou demande à accepter, paiement arrivé trop tard
 *     (remboursé), échec du paiement, acceptation sans paiement refusée, paiement sur place jamais compté, avis.
 * Faux SamirPay seulement. Base LOCALE. Invariants du lot (t1 à t6) et des livraisons précédentes à la fin.
 */
import '../helpers/env';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { assertLot11aInvariants } from '../helpers/lot11a-invariants';
import { service, deliverWebhook, providerSays, paymentById } from './paiement-helpers';
import { BASE_URL } from './helpers';
import * as partnerReservationsRoute from '../../app/api/partner/tables/reservations/route';
import { PATCH as partnerActionRoute } from '../../app/api/partner/tables/reservations/[id]/route';
import { POST as createVenueRoute } from '../../app/api/partner/venues/route';
import { PATCH as updateVenueRoute } from '../../app/api/partner/venues/[id]/route';
import { GET as partnerTablesGet } from '../../app/api/partner/tables/route';
import { PATCH as partnerTablePatch, DELETE as partnerTableDelete } from '../../app/api/partner/tables/[id]/route';
import { GET as partnerReservationsGet } from '../../app/api/partner/tables/reservations/route';
import { GET as menuRoute } from '../../app/api/restaurants/[id]/menu/route';
import { withFeatureFlags } from './terrain-helpers';
import {
    ALWAYS_OPEN, allChannels, dayFromNow, decideVenue, isoWeekday, ledgerOfPayment, newBuyer, newPartner, newTable, newVenue, newZone,
    openTablesService, outboxOf, payConfirmed, platformSetting, releasePending, reservation, reserveRoute, reserveRpc, setHours,
    shiftReservation, startIn, startPayment, type Buyer, type Row, type TestPartner,
} from './l11a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;
let client: Buyer;

before(async () => {
    restore = await openTablesService();
    partner = await newPartner('l11a-tables');
    client = await newBuyer('l11a-client');
});

// Au plus 3 demandes en attente par client : les attentes laissées par les tests précédents sont rendues
beforeEach(async () => {
    if (client) await releasePending(client.userId);
});

after(async () => {
    await restore();
    await assertLot11aInvariants('l11a-tables');
});

const n = (v: unknown): number => Number(v);

async function partnerAction(id: string, token: string, body: Row): Promise<{ status: number; body: Row }> {
    const res = await partnerActionRoute(new NextRequest(`${BASE_URL}/api/partner/tables/reservations/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    }), { params: Promise.resolve({ id }) });
    return { status: res.status, body: (await res.json()) as Row };
}

describe('A. Réserver une table : contrôles et argent en base', () => {
    test('réglages par défaut (décisions du client)', async () => {
        const expected: Record<string, unknown> = {
            'tables.service_fee_rate': 5, 'tables.commission_rate': 0, 'tables.validation_required': true, 'tables.slot_minutes': 120,
            'tables.hold_minutes': 15, 'tables.response_minutes': 120, 'tables.no_show_minutes': 30, 'tables.cancel_free_hours': 2,
            'tables.max_pending_per_client': 3, 'tables.reminder_hours': 3, 'finance.aggregator_fee_rate.WAVE': 1.5, 'finance.payout_delay_hours': 48,
        };
        for (const [key, value] of Object.entries(expected)) assert.equal(await platformSetting(key), value, key);
    });

    test('gratuite, confirmation automatique : la plus petite table qui convient (4 places pour 4), créneau 20:00-22:00, 0 F, avis sur les 4 canaux', async () => {
        const venue = await newVenue(partner);
        await newTable(partner, venue, 2, { number: 'A2' });
        const four = await newTable(partner, venue, 4, { number: 'A4' });
        await newTable(partner, venue, 6, { number: 'A6' });
        const r = await reserveRpc(client, venue, { date: dayFromNow(20), time: '20:00', guests: 4 });
        assert.equal(r.ok, true, JSON.stringify(r));
        const row = await reservation(String(r.reservation_id));
        assert.deepEqual([row.booking_state, row.status, row.table_id, row.venue_id, n(row.slot_minutes), row.reservation_time,
            n(row.deposit_amount), n(row.service_fee_amount), n(row.total_amount), n(row.paid_amount), row.confirmation_mode],
            ['CONFIRMEE', 'CONFIRMEE', four, venue, 120, '20:00:00', 0, 0, 0, 0, 'AUTO']);
        assert.equal(row.slot, `["${dayFromNow(20)} 20:00:00","${dayFromNow(20)} 22:00:00")`);
        assert.equal(r.table_number, 'A4');
        assert.deepEqual(await outboxOf(client.userId, String(r.reservation_id)), allChannels('TABLE_RESERVATION_CONFIRMED'));
        assert.deepEqual(await outboxOf(partner.userId, String(r.reservation_id)), allChannels('TABLE_NEW_RESERVATION'));
    });

    test('acompte 5 000 F par personne × 4 → acompte 20 000, frais 1 000, à payer 21 000 ; table tenue 15 minutes', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 5_000 });
        await newTable(partner, venue, 4);
        const r = await reserveRpc(client, venue, { guests: 4 });
        assert.equal(r.ok, true, JSON.stringify(r));
        const row = await reservation(String(r.reservation_id));
        assert.deepEqual([row.booking_state, row.status, n(row.deposit_per_person), n(row.deposit_amount), n(row.service_fee_rate),
            n(row.service_fee_amount), n(row.total_amount), n(row.commission_rate), n(row.paid_amount)],
            ['EN_ATTENTE_PAIEMENT', 'EN_ATTENTE', 5_000, 20_000, 5, 1_000, 21_000, 0, 0]);
        const hold = Date.parse(String(row.hold_expires_at)) - Date.now();
        assert.ok(hold > 13 * 60_000 && hold <= 15 * 60_000, `table tenue 15 minutes (${Math.round(hold / 1000)} s)`);
        assert.deepEqual(await outboxOf(client.userId, String(r.reservation_id)), [], 'aucun avis avant le paiement');
    });

    test('arrondi au franc supérieur : 1 234 F × 3 = 3 702, frais 185,1 → 186, à payer 3 888', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 1_234 });
        await newTable(partner, venue, 4);
        const r = await reserveRpc(client, venue, { guests: 3 });
        assert.equal(r.ok, true, JSON.stringify(r));
        const row = await reservation(String(r.reservation_id));
        assert.deepEqual([n(row.deposit_amount), n(row.service_fee_amount), n(row.total_amount)], [3_702, 186, 3_888]);
    });

    test('créneau de l’établissement (90 min) : 20:00-21:30 ; même table à 21:30 permise, à 21:15 refusée', async () => {
        const venue = await newVenue(partner, { slot_minutes: 90 });
        const table = await newTable(partner, venue, 4);
        const date = dayFromNow(21);
        const r = await reserveRpc(client, venue, { date, time: '20:00', tableId: table });
        assert.equal(r.ok, true, JSON.stringify(r));
        assert.equal((await reservation(String(r.reservation_id))).slot, `["${date} 20:00:00","${date} 21:30:00")`);
        const overlap = await reserveRpc(await newBuyer('l11a-creneau-2'), venue, { date, time: '21:15', tableId: table });
        assert.deepEqual([overlap.ok, overlap.code, overlap.message],
            [false, 'SLOT_TAKEN', 'Cette table est déjà réservée à cette heure-là. Choisissez une autre heure ou une autre table.']);
        const next = await reserveRpc(await newBuyer('l11a-creneau-3'), venue, { date, time: '21:30', tableId: table });
        assert.equal(next.ok, true, `créneau à la suite : ${JSON.stringify(next)}`);
    });

    test('table choisie par la base : 20:00 → T1, 21:00 → T2, 21:30 → aucune table libre, 22:00 → T1 (borne du créneau)', async () => {
        const venue = await newVenue(partner);
        const t1 = await newTable(partner, venue, 4, { number: '1' });
        const t2 = await newTable(partner, venue, 4, { number: '2' });
        const date = dayFromNow(22);
        const a = await reserveRpc(await newBuyer('l11a-auto-a'), venue, { date, time: '20:00' });
        const b = await reserveRpc(await newBuyer('l11a-auto-b'), venue, { date, time: '21:00' });
        const c = await reserveRpc(await newBuyer('l11a-auto-c'), venue, { date, time: '21:30' });
        const d = await reserveRpc(await newBuyer('l11a-auto-d'), venue, { date, time: '22:00' });
        assert.deepEqual([a.table_id, b.table_id, c.ok, c.code, c.message, d.table_id],
            [t1, t2, false, 'NO_TABLE_FREE', 'Aucune table libre à cette heure-là. Choisissez une autre heure.', t1]);
        const explicit = await reserveRpc(await newBuyer('l11a-auto-e'), venue, { date, time: '21:00', tableId: t1 });
        assert.deepEqual([explicit.ok, explicit.code], [false, 'SLOT_TAKEN']);
    });

    test('zone choisie : la table vient de cette zone ; zone d’un autre établissement refusée', async () => {
        const venue = await newVenue(partner);
        const other = await newVenue(partner);
        const terrace = await newZone(partner, venue, 'Terrasse');
        const inside = await newZone(partner, venue, 'Salle');
        await newTable(partner, venue, 4, { zoneId: inside });
        const t = await newTable(partner, venue, 6, { zoneId: terrace });
        const r = await reserveRpc(client, venue, { guests: 4, zoneId: terrace, date: dayFromNow(23) });
        assert.deepEqual([r.ok, r.table_id, (await reservation(String(r.reservation_id))).zone_id], [true, t, terrace]);
        const foreignZone = await newZone(partner, other, 'Ailleurs');
        const bad = await reserveRpc(client, venue, { zoneId: foreignZone, date: dayFromNow(23), time: '12:00' });
        assert.deepEqual([bad.ok, bad.code, bad.message], [false, 'ZONE_NOT_FOUND', 'Cette zone n’existe pas dans cet établissement.']);
    });

    test('capacité : 7 personnes à une table de 6 refusées ; 1 personne à une table de 2 à 6 refusée ; 12 personnes sans table assez grande', async () => {
        const venue = await newVenue(partner);
        const t = await newTable(partner, venue, 6, { min: 2 });
        const date = dayFromNow(24);
        const tooMany = await reserveRpc(client, venue, { date, guests: 7, tableId: t });
        assert.deepEqual([tooMany.ok, tooMany.code, tooMany.message], [false, 'TABLE_TOO_SMALL', 'Cette table accueille de 2 à 6 personnes.']);
        const tooFew = await reserveRpc(client, venue, { date, guests: 1, tableId: t });
        assert.deepEqual([tooFew.ok, tooFew.code], [false, 'TABLE_TOO_SMALL']);
        const none = await reserveRpc(client, venue, { date, guests: 12 });
        assert.deepEqual([none.ok, none.code, none.message], [false, 'NO_TABLE_FITS', 'Aucune table ne peut accueillir 12 personnes. Contactez l’établissement.']);
    });

    test('horaires : 12:00-15:00 et 19:00-02:00 → 12:00 oui, 13:30 non, 16:00 non, 23:30 oui (fin 01:30), 00:00 oui, 00:30 non', async () => {
        const hours = [1, 2, 3, 4, 5, 6, 7].flatMap((weekday) => [
            { weekday, opens_at: '12:00', closes_at: '15:00' }, { weekday, opens_at: '19:00', closes_at: '02:00' },
        ]);
        const venue = await newVenue(partner, { hours });
        await newTable(partner, venue, 4);
        const date = dayFromNow(25);
        const cases: Array<[string, boolean]> = [['12:00', true], ['13:30', false], ['16:00', false], ['23:30', true], ['00:00', true], ['00:30', false]];
        for (const [time, ok] of cases) {
            const r = await reserveRpc(await newBuyer(`l11a-h-${time.replace(':', '')}`), venue, { date, time });
            assert.equal(r.ok, ok, `${time} : ${JSON.stringify(r)}`);
            if (!ok) assert.deepEqual([r.code, r.message], ['OUTSIDE_HOURS', 'L’établissement n’est pas ouvert à cette heure-là. Choisissez une autre heure.']);
        }
    });

    test('jour fermé : ouvert seulement le jour J (12:00-15:00) → J+1 à 13:00 refusé', async () => {
        const date = dayFromNow(26);
        const venue = await newVenue(partner, { hours: [{ weekday: isoWeekday(date), opens_at: '12:00', closes_at: '15:00' }] });
        await newTable(partner, venue, 4);
        assert.equal((await reserveRpc(client, venue, { date, time: '13:00' })).ok, true);
        const closed = await reserveRpc(client, venue, { date: dayFromNow(27), time: '13:00' });
        assert.deepEqual([closed.ok, closed.code], [false, 'OUTSIDE_HOURS']);
    });

    test('dates et saisies : passée, à plus de 90 jours, heure hors quart d’heure, personnes 0 ou 51, date illisible', async () => {
        const venue = await newVenue(partner);
        await newTable(partner, venue, 4);
        const past = startIn(-60);
        const cases: Array<[Row, string, string]> = [
            [{ date: past.date, time: past.time }, 'DATE_PASSED', 'Choisissez une date et une heure à venir.'],
            [{ date: dayFromNow(92) }, 'DATE_TOO_FAR', 'La date doit être dans les 90 jours à venir.'],
            [{ time: '20:10' }, 'INVALID_TIME', 'Choisissez une heure au quart d’heure près (par exemple 20:00, 20:15 ou 20:30).'],
            [{ guests: 0 }, 'INVALID_GUESTS', 'Indiquez un nombre de personnes entre 1 et 50.'],
            [{ guests: 51 }, 'INVALID_GUESTS', 'Indiquez un nombre de personnes entre 1 et 50.'],
            [{ date: '2026-02-30' }, 'INVALID_DATE', 'La date ou l’heure choisie n’est pas valable.'],
        ];
        for (const [opts, code, message] of cases) {
            const r = await reserveRpc(client, venue, opts as never);
            assert.deepEqual([r.ok, r.code, r.message], [false, code, message], JSON.stringify(opts));
        }
    });

    test('attaque : montants envoyés dans le corps ignorés (21 000 calculés en base) ; réponse en français simple', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 5_000 });
        await newTable(partner, venue, 4);
        const res = await reserveRoute(client, {
            venueId: venue, date: dayFromNow(28), time: '20:00', guests: 4,
            depositAmount: 1, deposit_amount: 1, deposit_per_person: 1, totalAmount: 1, total_amount: 1, service_fee_amount: 0,
            isPlatformPayment: false, partnerId: partner.partnerId,
        });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        const resa = res.body.reservation as Row;
        assert.deepEqual([resa.depositAmount, resa.serviceFee, resa.totalToPay, resa.state],
            [20_000, 1_000, 21_000, 'En attente de paiement']);
        assert.equal(resa.cancellation, 'Acompte remboursé si vous annulez au moins 2 h avant l’heure, rien ensuite.');
        assert.doesNotMatch(JSON.stringify(res.body), /EN_ATTENTE|CONFIRMEE|_PAIEMENT/);
    });

    test('attaque 0 F et réglages faux : refusés par la base', async () => {
        const bad: Row[] = [
            { deposit_per_person: 0 }, { deposit_per_person: -100 }, { deposit_per_person: 99 }, { deposit_per_person: 100.5 },
            { slot_minutes: 20 }, { slot_minutes: 400 }, { slot_minutes: 100 }, { confirmation_mode: 'PEUT_ETRE' }, { kind: 'HOTEL' },
            { latitude: 48.85, longitude: 2.35 }, { latitude: 14.7 },
        ];
        for (const fields of bad) {
            const { error } = await service.from('venues').insert({ partner_id: partner.partnerId, name: 'TEST Établissement invalide', city: 'Dakar', ...fields });
            assert.ok(error, `établissement accepté : ${JSON.stringify(fields)}`);
        }
        const venue = await newVenue(partner);
        for (const hours of [[{ weekday: 0, opens_at: '12:00', closes_at: '15:00' }], [{ weekday: 1, opens_at: '12:00', closes_at: '15:00' }, { weekday: 1, opens_at: '14:00', closes_at: '16:00' }]]) {
            const { data } = await service.rpc('venue_hours_set', { p: { actor_id: partner.userId, venue_id: venue, hours } });
            assert.equal((data as Row).ok, false, `horaires acceptés : ${JSON.stringify(hours)}`);
        }
    });

    test('attaque : établissement en attente, refusé, suspendu, inactif, partenaire suspendue → réservation refusée', async () => {
        const message = 'Cet établissement n’accepte pas de réservation pour le moment.';
        const pending = await newVenue(partner, { validate: false });
        const refused = await newVenue(partner, { validate: false });
        assert.equal((await decideVenue(refused, 'REFUSER', 'Photos manquantes.')).ok, true);
        const suspended = await newVenue(partner);
        assert.equal((await decideVenue(suspended, 'SUSPENDRE', 'Contrôle d’hygiène en cours.')).ok, true);
        const inactive = await newVenue(partner, { is_active: false });
        for (const v of [pending, refused, suspended, inactive]) {
            await newTable(partner, v, 4);
            const r = await reserveRpc(client, v);
            assert.deepEqual([r.ok, r.code, r.message], [false, 'VENUE_NOT_AVAILABLE', message], v);
        }
        const other = await newPartner('l11a-suspendue');
        const venue = await newVenue(other);
        await newTable(other, venue, 4);
        await service.from('partners').update({ status: 'SUSPENDU' }).eq('id', other.partnerId);
        const r = await reserveRpc(client, venue);
        assert.deepEqual([r.ok, r.code], [false, 'VENUE_NOT_AVAILABLE']);
    });

    test('attaque : son propre établissement ; table d’un autre établissement ou d’une autre partenaire ; table retirée', async () => {
        const venue = await newVenue(partner);
        await newTable(partner, venue, 4);
        const own = await reserveRpc(partner, venue);
        assert.deepEqual([own.ok, own.code], [false, 'OWN_VENUE']);
        const sister = await newVenue(partner);
        const sisterTable = await newTable(partner, sister, 4);
        const stranger = await newPartner('l11a-etrangere');
        const strangerTable = await newTable(stranger, await newVenue(stranger), 4);
        const retired = await newTable(partner, venue, 4, { active: false });
        for (const tableId of [sisterTable, strangerTable, retired]) {
            const r = await reserveRpc(client, venue, { tableId, date: dayFromNow(29) });
            assert.deepEqual([r.ok, r.code, r.message], [false, 'TABLE_NOT_FOUND', 'Cette table n’existe pas dans cet établissement.'], tableId);
        }
    });

    test('attaque : zone ou établissement d’une autre partenaire pour créer une table → refusé par la base', async () => {
        const stranger = await newPartner('l11a-zone-volee');
        const strangerVenue = await newVenue(stranger);
        const strangerZone = await newZone(stranger, strangerVenue, 'VIP');
        const mine = await newVenue(partner);
        const tries: Row[] = [
            { partner_id: partner.partnerId, venue_id: strangerVenue, table_number: 'X1', capacity: 4 },
            { partner_id: partner.partnerId, venue_id: mine, zone_id: strangerZone, table_number: 'X2', capacity: 4 },
        ];
        for (const fields of tries) {
            const { error } = await service.from('restaurant_tables').insert(fields);
            assert.ok(error, `table acceptée : ${JSON.stringify(fields)}`);
        }
        const { error: zoneErr } = await service.from('restaurant_zones').insert({ partner_id: partner.partnerId, venue_id: strangerVenue, name: 'Volée' });
        assert.ok(zoneErr, 'zone créée dans l’établissement d’une autre partenaire');
    });

    test('attaque : 6 réservations simultanées de la dernière table → une seule tient la table', async () => {
        const venue = await newVenue(partner);
        const table = await newTable(partner, venue, 4);
        const date = dayFromNow(30);
        const buyers = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => newBuyer(`l11a-course-${i}`)));
        const results = await Promise.all(buyers.map((b) => reserveRpc(b, venue, { date, time: '20:00' })));
        assert.equal(results.filter((r) => r.ok === true).length, 1, JSON.stringify(results.map((r) => r.code ?? 'OK')));
        assert.ok(results.filter((r) => r.ok !== true).every((r) => r.code === 'NO_TABLE_FREE'), JSON.stringify(results));
        const { count } = await service.from('table_reservations').select('id', { count: 'exact', head: true })
            .eq('table_id', table).in('status', ['EN_ATTENTE', 'CONFIRMEE']);
        assert.equal(count, 1);
    });

    test('3 demandes en attente au plus par client ; la 4e est refusée', async () => {
        const venue = await newVenue(partner, { confirmation_mode: 'MANUELLE' });
        for (let i = 0; i < 4; i += 1) await newTable(partner, venue, 4);
        const date = dayFromNow(31);
        for (const time of ['12:00', '14:00', '16:00']) {
            const r = await reserveRpc(client, venue, { date, time });
            assert.deepEqual([r.ok, r.booking_state], [true, 'EN_ATTENTE_ACCEPTATION'], JSON.stringify(r));
        }
        const fourth = await reserveRpc(client, venue, { date, time: '18:00' });
        assert.deepEqual([fourth.ok, fourth.code, fourth.message],
            [false, 'TOO_MANY_PENDING', 'Vous avez déjà 3 demandes en attente. Attendez une réponse ou annulez-en une.']);
    });

    test('attente de paiement échue : la table est rendue au client suivant ; la première demande passe à « Non payée à temps »', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 2_000 });
        await newTable(partner, venue, 4);
        const date = dayFromNow(32);
        const first = await reserveRpc(client, venue, { date });
        assert.equal(first.ok, true, JSON.stringify(first));
        const other = await newBuyer('l11a-suivant');
        assert.equal((await reserveRpc(other, venue, { date })).code, 'NO_TABLE_FREE');
        await shiftReservation(String(first.reservation_id), { holdMinutes: -1 });
        const second = await reserveRpc(other, venue, { date });
        assert.equal(second.ok, true, JSON.stringify(second));
        assert.equal((await reservation(String(first.reservation_id))).booking_state, 'EXPIREE');
    });

    test('demande à accepter (gratuite) : « En attente de réponse », réponse attendue sous 2 h ; avis au client et à l’établissement', async () => {
        const venue = await newVenue(partner, { confirmation_mode: 'MANUELLE' });
        await newTable(partner, venue, 4);
        const r = await reserveRpc(client, venue, { date: dayFromNow(33) });
        assert.equal(r.ok, true, JSON.stringify(r));
        const row = await reservation(String(r.reservation_id));
        assert.deepEqual([row.booking_state, row.status], ['EN_ATTENTE_ACCEPTATION', 'EN_ATTENTE']);
        const due = Date.parse(String(row.response_due_at)) - Date.now();
        assert.ok(due > 118 * 60_000 && due <= 120 * 60_000, `réponse sous 2 h (${Math.round(due / 60_000)} min)`);
        assert.deepEqual(await outboxOf(client.userId, String(r.reservation_id)), allChannels('TABLE_REQUEST_SENT'));
        assert.deepEqual(await outboxOf(partner.userId, String(r.reservation_id)), allChannels('TABLE_REQUEST_TO_ANSWER'));
    });

    test('demande à accepter pour dans 1 h : la réponse est attendue avant l’heure (pas 2 h)', async () => {
        const venue = await newVenue(partner, { confirmation_mode: 'MANUELLE' });
        await newTable(partner, venue, 4);
        const at = startIn(60);
        const r = await reserveRpc(client, venue, at);
        assert.equal(r.ok, true, JSON.stringify(r));
        const row = await reservation(String(r.reservation_id));
        assert.equal(Date.parse(String(row.response_due_at)), Date.parse(`${at.date}T${at.time}:00Z`));
    });

    test('attaque : jamais de réservation sans table ni d’écriture directe (insertion, état, argent, suppression)', async () => {
        const venue = await newVenue(partner);
        const table = await newTable(partner, venue, 4);
        const ok = await reserveRpc(client, venue, { date: dayFromNow(34) });
        const id = String(ok.reservation_id);
        const ins = await service.from('table_reservations').insert({
            partner_id: partner.partnerId, venue_id: venue, client_id: client.userId, reservation_date: dayFromNow(35), reservation_time: '20:00', guest_count: 2,
        });
        assert.ok(ins.error, 'insertion directe sans table acceptée');
        const ins2 = await service.from('table_reservations').insert({
            partner_id: partner.partnerId, venue_id: venue, table_id: table, client_id: client.userId, reservation_date: dayFromNow(35), reservation_time: '20:00', guest_count: 2,
        });
        assert.ok(ins2.error, 'insertion directe avec table acceptée');
        for (const fields of [{ booking_state: 'ANNULEE_CLIENT' }, { status: 'ANNULEE' }, { payment_status: 'SUCCESS' }, { paid_amount: 1 }, { table_id: null }, { guest_count: 20 }]) {
            const upd = await service.from('table_reservations').update(fields).eq('id', id).select('id');
            assert.ok(upd.error, `mise à jour directe acceptée : ${JSON.stringify(fields)}`);
        }
        const del = await service.from('table_reservations').delete().eq('id', id).select('id');
        assert.ok(del.error, 'suppression directe acceptée');
        assert.equal((await reservation(id)).booking_state, 'CONFIRMEE');
        const old = await service.rpc('create_table_reservation_atomic', {
            p_table_id: table, p_client_id: client.userId, p_reservation_date: dayFromNow(36), p_reservation_time: '20:00', p_guest_count: 2,
        });
        assert.ok(old.error, 'l’ancienne fonction de réservation existe encore');
        assert.equal((partnerReservationsRoute as Record<string, unknown>).POST, undefined, 'création d’une réservation par la partenaire');
    });

    test('attaque : une table réservée ne peut plus être supprimée (la réservation garderait sa règle)', async () => {
        const venue = await newVenue(partner);
        const table = await newTable(partner, venue, 4);
        assert.equal((await reserveRpc(client, venue, { date: dayFromNow(37) })).ok, true);
        const { error } = await service.from('restaurant_tables').delete().eq('id', table);
        assert.ok(error, 'table réservée supprimée');
    });
});

describe('B. Payer l’acompte : montant relu en base, confirmation, paiement sur place', () => {
    test('acompte 21 000 (Wave) : frais 1 000, 1,5 % = 315, Event Village net 685, établissement 20 000 après la fin du créneau ; confirmée ; avis', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 5_000 });
        await newTable(partner, venue, 4);
        const date = dayFromNow(38);
        const id = String((await reserveRpc(client, venue, { date, time: '20:00' })).reservation_id);
        const pay = await payConfirmed(client, id);
        assert.deepEqual([n(pay.amount), n(pay.facial_amount), n(pay.service_fee), n(pay.aggregator_fee), n(pay.gross_event_village_revenue),
            n(pay.net_event_village_revenue), n(pay.partner_payout_amount), pay.status, pay.payment_target, pay.is_platform_payment],
            [21_000, 20_000, 1_000, 315, 1_000, 685, 20_000, 'SUCCESS', 'TABLE_RESERVATION', true]);
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, row.status, n(row.paid_amount), row.payment_status], ['CONFIRMEE', 'CONFIRMEE', 21_000, 'SUCCESS']);
        assert.equal(await ledgerOfPayment(pay.id, 'VENTE'), 20_000);
        const { data: sale } = await service.from('finance_ledger').select('available_at').eq('source_key', `VENTE-${pay.id}`).single();
        assert.equal(Date.parse(String(sale!.available_at)), Date.parse(`${date}T22:00:00Z`) + 48 * 3_600_000, 'fin du créneau + 48 h');
        assert.deepEqual(await outboxOf(client.userId, id), allChannels('TABLE_RESERVATION_CONFIRMED'));
        assert.deepEqual(await outboxOf(partner.userId, id), allChannels('TABLE_NEW_RESERVATION'));
    });

    test('attaque : montant envoyé au paiement ignoré ; réservation d’un autre client ; gratuite ; déjà payée ; un paiement à la fois', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 3_000 });
        await newTable(partner, venue, 4);
        const id = String((await reserveRpc(client, venue, { guests: 2, date: dayFromNow(39) })).reservation_id);
        const other = await newBuyer('l11a-intrus');
        const stolen = await startPayment(other, id);
        assert.deepEqual([stolen.status, stolen.body.code], [404, 'RESERVATION_NOT_FOUND']);
        const started = await startPayment(client, id, { amount: 1, totalAmount: 1, part: 'SOLDE' });
        assert.equal(started.status, 201, JSON.stringify(started.body));
        assert.equal(n(started.payment!.amount), 6_300, '3 000 × 2 = 6 000 + 300 de frais');
        const twice = await startPayment(client, id);
        assert.deepEqual([twice.status, twice.body.code], [409, 'PAYMENT_PENDING']);
        providerSays(started.payment!, 'SUCCESS');
        await deliverWebhook(started.payment!);
        const again = await startPayment(client, id);
        assert.deepEqual([again.status, again.body.code], [409, 'ALREADY_PAID']);
        const freeVenue = await newVenue(partner);
        await newTable(partner, freeVenue, 4);
        const freeId = String((await reserveRpc(client, freeVenue, { date: dayFromNow(39) })).reservation_id);
        const nothing = await startPayment(client, freeId);
        assert.deepEqual([nothing.status, nothing.body.code, nothing.body.error],
            [409, 'NOTHING_TO_PAY', 'Cette réservation est sans acompte : il n’y a rien à payer.']);
    });

    test('paiement arrivé après l’attente, table reprise : remboursé en entier (21 000), avis au client ; la demande reste « Non payée à temps »', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 5_000 });
        await newTable(partner, venue, 4);
        const date = dayFromNow(40);
        const id = String((await reserveRpc(client, venue, { date })).reservation_id);
        const started = await startPayment(client, id);
        assert.equal(started.status, 201, JSON.stringify(started.body));
        await shiftReservation(id, { holdMinutes: -1 });
        const taker = await newBuyer('l11a-preneur');
        assert.equal((await reserveRpc(taker, venue, { date })).ok, true, 'table reprise après l’attente');
        providerSays(started.payment!, 'SUCCESS');
        await deliverWebhook(started.payment!);
        const pay = await paymentById(started.payment!.id);
        assert.ok(['REFUND_PENDING', 'REFUNDED'].includes(String(pay.status)), String(pay.status));
        const { data: refunds } = await service.from('refunds').select('amount, aggregator_fee_bearer').eq('payment_id', pay.id);
        assert.deepEqual((refunds ?? []).map((r) => [n(r.amount), r.aggregator_fee_bearer]), [[21_000, 'EVENT_VILLAGE']]);
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, n(row.paid_amount)], ['EXPIREE', 0]);
        // Deux avis : la table rendue à la fin de l'attente, puis le paiement arrivé trop tard, remboursé
        const notices = await outboxOf(client.userId, id);
        assert.deepEqual(notices, [...allChannels('TABLE_HOLD_EXPIRED'), ...allChannels('TABLE_PAYMENT_REFUNDED')].sort());
    });

    test('échec du paiement : la demande reste en attente de paiement (la table est tenue jusqu’à la fin de l’attente)', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 5_000 });
        await newTable(partner, venue, 4);
        const id = String((await reserveRpc(client, venue, { date: dayFromNow(41) })).reservation_id);
        const started = await startPayment(client, id);
        providerSays(started.payment!, 'FAILED');
        await deliverWebhook(started.payment!);
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, row.status, n(row.paid_amount)], ['EN_ATTENTE_PAIEMENT', 'EN_ATTENTE', 0]);
    });

    test('acceptation manuelle avec acompte : payée → « En attente de réponse » (sous 2 h) ; acceptée → confirmée ; avis', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 5_000, confirmation_mode: 'MANUELLE' });
        await newTable(partner, venue, 4);
        const id = String((await reserveRpc(client, venue, { date: dayFromNow(42) })).reservation_id);
        // C1 : l'établissement ne peut pas accepter avant le paiement de l'acompte
        const early = await partnerAction(id, partner.accessToken, { action: 'ACCEPTER' });
        assert.deepEqual([early.status, early.body.code, early.body.error],
            [409, 'NOT_PAID', 'L’acompte n’est pas encore payé : la demande ne peut pas être acceptée.']);
        await payConfirmed(client, id);
        const paid = await reservation(id);
        assert.deepEqual([paid.booking_state, n(paid.paid_amount)], ['EN_ATTENTE_ACCEPTATION', 21_000]);
        const due = Date.parse(String(paid.response_due_at)) - Date.now();
        assert.ok(due > 118 * 60_000 && due <= 120 * 60_000, `réponse sous 2 h (${Math.round(due / 60_000)} min)`);
        assert.deepEqual(await outboxOf(client.userId, id), allChannels('TABLE_REQUEST_SENT'));
        assert.deepEqual(await outboxOf(partner.userId, id), allChannels('TABLE_REQUEST_TO_ANSWER'));
        const stranger = await newPartner('l11a-accept-etrangere');
        const foreign = await partnerAction(id, stranger.accessToken, { action: 'ACCEPTER' });
        assert.deepEqual([foreign.status, foreign.body.code], [404, 'RESERVATION_NOT_FOUND']);
        const ok = await partnerAction(id, partner.accessToken, { action: 'ACCEPTER' });
        assert.equal(ok.status, 200, JSON.stringify(ok.body));
        assert.equal(ok.body.state, 'Confirmée');
        assert.equal((await reservation(id)).booking_state, 'CONFIRMEE');
        assert.deepEqual((await outboxOf(client.userId, id)).filter((t) => t.startsWith('TABLE_RESERVATION_CONFIRMED:')), allChannels('TABLE_RESERVATION_CONFIRMED'));
        const twice = await partnerAction(id, partner.accessToken, { action: 'ACCEPTER' });
        assert.deepEqual([twice.status, twice.body.code], [409, 'NOT_PENDING']);
    });

    test('attaque : l’ancien changement de statut libre par la partenaire est refusé', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 5_000 });
        await newTable(partner, venue, 4);
        const id = String((await reserveRpc(client, venue, { date: dayFromNow(43) })).reservation_id);
        for (const body of [{ status: 'CONFIRMEE' }, { status: 'TERMINEE' }, { action: 'PAYEE' }]) {
            const res = await partnerAction(id, partner.accessToken, body);
            assert.equal(res.status, 400, `${JSON.stringify(body)} : ${JSON.stringify(res.body)}`);
        }
        assert.equal((await reservation(id)).booking_state, 'EN_ATTENTE_PAIEMENT');
    });

    test('paiement sur place (T4) : enregistré, jamais un encaissement d’Event Village (aucun paiement, aucune écriture au grand livre)', async () => {
        const venue = await newVenue(partner);
        await newTable(partner, venue, 4);
        const at = startIn(30);
        const id = String((await reserveRpc(client, venue, at)).reservation_id);
        const arrived = await partnerAction(id, partner.accessToken, { action: 'ARRIVEE' });
        assert.equal(arrived.status, 200, JSON.stringify(arrived.body));
        assert.equal((await reservation(id)).booking_state, 'ARRIVEE');
        const before = await service.from('finance_ledger').select('id', { count: 'exact', head: true });
        const rec = await partnerAction(id, partner.accessToken, { action: 'PAIEMENT_SUR_PLACE', amount: 35_000, method: 'ESPECES' });
        assert.equal(rec.status, 200, JSON.stringify(rec.body));
        const row = await reservation(id);
        assert.deepEqual([n(row.onsite_amount), row.offline_payment_method, row.payment_status, n(row.paid_amount), row.is_platform_payment],
            [35_000, 'ESPECES', 'PENDING', 0, false]);
        const { count: pays } = await service.from('payments').select('id', { count: 'exact', head: true }).eq('table_reservation_id', id);
        assert.equal(pays, 0, 'aucune ligne de paiement');
        const afterCount = await service.from('finance_ledger').select('id', { count: 'exact', head: true });
        assert.equal(afterCount.count, before.count, 'aucune écriture au grand livre');
        for (const body of [{ amount: 0, method: 'ESPECES' }, { amount: 10.5, method: 'ESPECES' }, { amount: 1000, method: 'CARTE_CADEAU' }]) {
            const bad = await partnerAction(id, partner.accessToken, { action: 'PAIEMENT_SUR_PLACE', ...body });
            assert.equal(bad.status, 400, JSON.stringify(bad.body));
        }
        const stranger = await newPartner('l11a-surplace-etrangere');
        const foreign = await partnerAction(id, stranger.accessToken, { action: 'PAIEMENT_SUR_PLACE', amount: 1, method: 'ESPECES' });
        assert.equal(foreign.status, 404);
    });

    test('arrivée trop tôt refusée ; absence marquée avant l’heure refusée', async () => {
        const venue = await newVenue(partner);
        await newTable(partner, venue, 4);
        const id = String((await reserveRpc(client, venue, { date: dayFromNow(44) })).reservation_id);
        for (const action of ['ARRIVEE', 'ABSENT']) {
            const res = await partnerAction(id, partner.accessToken, { action });
            assert.deepEqual([res.status, res.body.code, res.body.error], [409, 'TOO_EARLY', 'Il est trop tôt : attendez l’heure de la réservation.'], action);
        }
    });
});

describe('Établissements : création par la route', () => {
    async function createVenue(token: string, body: Row): Promise<{ status: number; body: Row }> {
        const res = await createVenueRoute(new NextRequest(`${BASE_URL}/api/partner/venues`, {
            method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body),
        }));
        return { status: res.status, body: (await res.json()) as Row };
    }
    const body = {
        kind: 'BAR', name: 'Bar de la Pointe', address: 'Pointe des Almadies', city: 'Dakar', latitude: 14.74, longitude: -17.52,
        deposit_per_person: 2_000, confirmation_mode: 'MANUELLE', hours: [{ weekday: 5, opens_at: '19:00', closes_at: '03:00' }],
        validation_status: 'VALIDEE',
    };

    test('attaque : une fiche partenaire en attente ou suspendue ne crée pas d’établissement', async () => {
        for (const status of ['EN_ATTENTE', 'SUSPENDU']) {
            const p = await newPartner(`l11a-fiche-${status.toLowerCase()}`);
            await service.from('partners').update({ status }).eq('id', p.partnerId);
            const res = await createVenue(p.accessToken, body);
            assert.deepEqual([res.status, res.body.error], [400, 'Votre compte partenaire doit être validé avant de créer un établissement.'], status);
            const { count } = await service.from('venues').select('id', { count: 'exact', head: true }).eq('partner_id', p.partnerId);
            assert.equal(count, 0, `${status} : aucun établissement`);
        }
    });

    test('fiche VALIDE : établissement créé « En attente de validation » (statut envoyé ignoré), horaires posés, administrateurs prévenus', async () => {
        const res = await createVenue(partner.accessToken, body);
        assert.equal(res.status, 201, JSON.stringify(res.body));
        const v = res.body.venue as Row;
        assert.deepEqual([v.validation_status, v.status, v.kindLabel], ['EN_ATTENTE_VALIDATION', 'En attente de validation', 'Bar']);
        const { data: hours } = await service.from('venue_opening_hours').select('weekday, opens_at, closes_at').eq('venue_id', String(v.id));
        assert.deepEqual(hours, [{ weekday: 5, opens_at: '19:00:00', closes_at: '03:00:00' }]);
        const { data: notices } = await service.from('notification_outbox').select('channel, template_data').eq('type', 'ADMIN_VENUE_SUBMITTED');
        const mine = (notices ?? []).filter((n) => (n.template_data as Row | null)?.venue_id === v.id);
        assert.ok(mine.some((n) => n.channel === 'IN_APP'), 'administrateurs prévenus (cloche)');
    });
});

// Contre-vérification de la 10a (T1, T2), équivalent côté tables : routes partenaire par la clé de service, relance
// d'une attente échue sans refaire les contrôles
describe('Routes partenaire et publiques : jamais la ligne d’une autre partenaire, jamais une partenaire au hasard', () => {
    type Handler = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
    async function call(handler: Handler, method: string, path: string, token: string | null, id?: string, body?: Row) {
        const res = await handler(new NextRequest(`${BASE_URL}${path}`, {
            method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
        }), { params: Promise.resolve({ id: id ?? '' }) });
        return { status: res.status, text: await res.text() };
    }

    test('une autre partenaire ne lit ni ne modifie les zones, tables, établissements et réservations d’une partenaire', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 2_000 });
        const zone = await newZone(partner, venue, 'Patio');
        const table = await newTable(partner, venue, 4, { zoneId: zone });
        const resa = String((await reserveRpc(client, venue, { date: dayFromNow(45), notes: 'Anniversaire de Fatou' })).reservation_id);
        const stranger = await newPartner('l11a-routes-etrangere');
        const t = stranger.accessToken;
        for (const type of ['zones', 'tables']) {
            const r = await call(partnerTablesGet as unknown as Handler, 'GET', `/api/partner/tables?type=${type}`, t);
            assert.equal(r.status, 200, r.text);
            assert.ok(!r.text.includes(zone) && !r.text.includes(table), `${type} d’une autre partenaire servies`);
        }
        const list = await call(partnerReservationsGet as unknown as Handler, 'GET', `/api/partner/tables/reservations?venueId=${venue}`, t);
        assert.equal(list.status, 200, list.text);
        assert.ok(!list.text.includes(resa) && !list.text.includes('Fatou'), 'réservation d’une autre partenaire servie');
        const patchTable = await call(partnerTablePatch, 'PATCH', `/api/partner/tables/${table}`, t, table, { capacity: 50 });
        assert.ok(patchTable.status >= 400, `table d’une autre partenaire modifiée : ${patchTable.text}`);
        const patchZone = await call(partnerTablePatch, 'PATCH', `/api/partner/tables/${zone}`, t, zone, { type: 'zone', name: 'Volée' });
        assert.ok(patchZone.status >= 400, `zone d’une autre partenaire modifiée : ${patchZone.text}`);
        await call(partnerTableDelete, 'DELETE', `/api/partner/tables/${table}`, t, table);
        const patchVenue = await call(updateVenueRoute, 'PATCH', `/api/partner/venues/${venue}`, t, venue, { deposit_per_person: 100 });
        assert.ok(patchVenue.status >= 400, `établissement d’une autre partenaire modifié : ${patchVenue.text}`);
        const { data: tRow } = await service.from('restaurant_tables').select('capacity, is_active').eq('id', table).single();
        const { data: zRow } = await service.from('restaurant_zones').select('name').eq('id', zone).single();
        const { data: vRow } = await service.from('venues').select('deposit_per_person').eq('id', venue).single();
        assert.deepEqual([tRow!.capacity, tRow!.is_active, zRow!.name, n(vRow!.deposit_per_person)], [4, true, 'Patio', 2_000], 'rien de changé');
    });

    test('menu public : un identifiant inconnu ou une partenaire non validée → 404, jamais « la première partenaire venue »', async () => {
        const pending = await newPartner('l11a-menu-attente');
        await service.from('partners').update({ status: 'EN_ATTENTE' }).eq('id', pending.partnerId);
        const { error } = await service.from('products').insert({ partner_id: pending.partnerId, name: 'TEST Plat caché 11a', price: 1_000, status: 'DISPONIBLE' });
        assert.equal(error, null, error?.message);
        await withFeatureFlags({ orders: true }, async () => {
            for (const id of ['00000000-0000-4000-8000-000000000000', 'restaurant-qui-nexiste-pas-11a', pending.partnerId]) {
                const r = await call(menuRoute, 'GET', `/api/restaurants/${id}/menu`, null, id);
                assert.equal(r.status, 404, `${id} : ${r.text}`);
                assert.ok(!r.text.includes('TEST Plat caché 11a'));
            }
        });
    });
});

describe('Relance d’une attente échue : tous les contrôles refaits', () => {
    test('attente échue, établissement suspendu entre-temps : le paiement n’est pas lancé', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 2_000 });
        await newTable(partner, venue, 4);
        const id = String((await reserveRpc(client, venue, { date: dayFromNow(46) })).reservation_id);
        await shiftReservation(id, { holdMinutes: -1 });
        assert.equal((await decideVenue(venue, 'SUSPENDRE', 'Contrôle d’hygiène en cours.')).ok, true);
        const r = await startPayment(client, id);
        assert.deepEqual([r.status, r.body.code, r.body.error], [409, 'VENUE_NOT_AVAILABLE', 'Cet établissement n’accepte pas de réservation pour le moment.']);
        assert.equal(r.payment, null, 'aucun paiement créé');
    });

    test('attente échue, table retirée ou horaires changés : le paiement n’est pas lancé', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 2_000 });
        const table = await newTable(partner, venue, 4);
        const date = dayFromNow(47);
        const a = String((await reserveRpc(client, venue, { date, time: '20:00' })).reservation_id);
        await shiftReservation(a, { holdMinutes: -1 });
        await service.from('restaurant_tables').update({ is_active: false }).eq('id', table);
        assert.equal((await startPayment(client, a)).body.code, 'TABLE_NOT_FOUND');
        await service.from('restaurant_tables').update({ is_active: true }).eq('id', table);
        await setHours(partner, venue, [{ weekday: isoWeekday(date), opens_at: '12:00', closes_at: '15:00' }]);
        assert.equal((await startPayment(client, a)).body.code, 'OUTSIDE_HOURS');
    });

    test('paiement lancé à temps, établissement suspendu avant la confirmation : remboursé en entier, jamais confirmé', async () => {
        const venue = await newVenue(partner, { deposit_per_person: 2_000 });
        await newTable(partner, venue, 4);
        const id = String((await reserveRpc(client, venue, { date: dayFromNow(48), guests: 2 })).reservation_id);
        const started = await startPayment(client, id);
        assert.equal(started.status, 201, JSON.stringify(started.body));
        await shiftReservation(id, { holdMinutes: -1 });
        assert.equal((await decideVenue(venue, 'SUSPENDRE', 'Fermeture administrative.')).ok, true);
        providerSays(started.payment!, 'SUCCESS');
        await deliverWebhook(started.payment!);
        const pay = await paymentById(started.payment!.id);
        assert.ok(['REFUND_PENDING', 'REFUNDED'].includes(String(pay.status)), String(pay.status));
        const row = await reservation(id);
        assert.notEqual(row.booking_state, 'CONFIRMEE');
        assert.equal(n(row.paid_amount), 0);
    });
});

describe('Horaires : saisie par l’établissement seulement', () => {
    test('une autre partenaire ne peut pas changer les horaires ; plage de nuit acceptée ; 24 h sur 24 accepté', async () => {
        const venue = await newVenue(partner, { validate: false });
        const stranger = await newPartner('l11a-horaires');
        const { data } = await service.rpc('venue_hours_set', { p: { actor_id: stranger.userId, venue_id: venue, hours: ALWAYS_OPEN } });
        assert.deepEqual([(data as Row).ok, (data as Row).code], [false, 'VENUE_NOT_FOUND']);
        assert.equal((await setHours(partner, venue, [{ weekday: 5, opens_at: '19:00', closes_at: '03:00' }])).ok, true);
        assert.equal((await setHours(partner, venue, ALWAYS_OPEN)).ok, true);
    });
});
