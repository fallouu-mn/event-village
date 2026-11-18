/**
 * Contre-vérification du lot 11a — point 2 : réservation. Chevauchements simultanés (même table, créneaux qui se
 * touchent, plage de nuit 19:00-02:00, passage de minuit, heure de Dakar), table trop petite, table ou zone d'un autre
 * établissement, établissement non validé ou suspendu, hors horaires, date passée ou à plus de 90 jours, plus de 3
 * demandes (à la suite, en parallèle, par relance). Un test rouge est un TROU (docs/audit-lot11a.md).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot11aInvariants } from '../helpers/lot11a-invariants';
import { setFiche } from './cvf1-helpers';
import {
    dayFromNow, decideVenue, depositVenue, heldWithoutPayment, isoWeekday, newBuyer, newPartner, newTable, newVenue, newZone,
    openTablesService, releasePending, reservation, reserveRoute, reserveRpc, reserved, shiftReservation, show, sql, started,
    startIn, startPayment, tick, trace, type Row, type TestPartner,
} from './cv11a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;

before(async () => {
    restore = await openTablesService();
    partner = await newPartner('cv11a-resa');
});

after(async () => {
    await restore();
    await assertLot11aInvariants('cv11a-2-reservation');
});

const code = (r: Row): string => (r.ok === true ? 'OK' : String(r.code));

describe('2.1 Chevauchements', () => {
    test('8 clients sur la dernière table, en même temps : une seule réservation la tient', async () => {
        const venue = await newVenue(partner);
        await newTable(partner, venue, 4);
        const clients = await Promise.all(Array.from({ length: 8 }, (_, i) => newBuyer(`cv11a-course-${i}`)));
        const date = dayFromNow(40);
        const replies = await Promise.all(clients.map((c) => reserveRoute(c, { venueId: venue, date, time: '20:00', guests: 2 })));
        trace('2.1a', replies.map((r) => `${r.status} ${String(r.body.code ?? '')}`));
        assert.equal(replies.filter((r) => r.status === 200).length, 1);
    });

    test('plage de nuit 19:00-02:00, créneau 90 min : 23:00 et 00:30 (lendemain) se touchent ; 00:15 et 22:00 chevauchent ; 8 demandes simultanées autour de minuit : une seule', async () => {
        const date = dayFromNow(41);
        const night = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens_at: '19:00', closes_at: '02:00' }));
        const venue = await newVenue(partner, { slot_minutes: 90, hours: night });
        await newTable(partner, venue, 4);
        const c = await Promise.all(Array.from({ length: 4 }, (_, i) => newBuyer(`cv11a-nuit-${i}`)));
        const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
        const a = await reserveRpc(c[0], venue, { date, time: '23:00', guests: 2 });
        const b = await reserveRpc(c[1], venue, { date: next, time: '00:30', guests: 2 });
        const x = await reserveRpc(c[2], venue, { date: next, time: '00:15', guests: 2 });
        const y = await reserveRpc(c[3], venue, { date, time: '22:00', guests: 2 });
        const z = await reserveRpc(c[3], venue, { date, time: '21:30', guests: 2 });
        trace('2.1b', { '23:00': code(a), '00:30 lendemain': code(b), '00:15 lendemain': code(x), '22:00': code(y), '21:30': code(z) });
        assert.deepEqual([code(a), code(b), code(z)], ['OK', 'OK', 'OK']);
        assert.notEqual(code(x), 'OK', '00:15 chevauche 23:00-00:30');
        assert.notEqual(code(y), 'OK', '22:00-23:30 chevauche 23:00');

        const venue2 = await newVenue(partner, { slot_minutes: 90, hours: night });
        await newTable(partner, venue2, 4);
        const many = await Promise.all(Array.from({ length: 8 }, (_, i) => newBuyer(`cv11a-minuit-${i}`)));
        const replies = await Promise.all(many.map((cl, i) => reserveRpc(cl, venue2, i % 2 === 0 ? { date, time: '23:30', guests: 2 } : { date: next, time: '00:00', guests: 2 })));
        trace('2.1c', replies.map(code));
        assert.equal(replies.filter((r) => r.ok === true).length, 1, '23:30-01:00 et 00:00-01:30 se chevauchent par-dessus minuit');
    });

    test('ouvert seulement le jour J de 19:00 à 02:00 : 00:30 le lendemain accepté (nuit de J), 01:00 le matin de J et 19:00 le lendemain refusés', async () => {
        const date = dayFromNow(42);
        const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
        const venue = await newVenue(partner, { slot_minutes: 60, hours: [{ weekday: isoWeekday(date), opens_at: '19:00', closes_at: '02:00' }] });
        await newTable(partner, venue, 4);
        const cl = await newBuyer('cv11a-jour-j');
        const out = {
            nuitDeJ: code(await reserveRpc(cl, venue, { date: next, time: '00:30', guests: 2 })),
            matinDeJ: code(await reserveRpc(cl, venue, { date, time: '01:00', guests: 2 })),
            soirLendemain: code(await reserveRpc(cl, venue, { date: next, time: '19:00', guests: 2 })),
            debordeFermeture: code(await reserveRpc(cl, venue, { date: next, time: '01:15', guests: 2 })),
        };
        trace('2.1d', out);
        assert.deepEqual(out, { nuitDeJ: 'OK', matinDeJ: 'OUTSIDE_HOURS', soirLendemain: 'OUTSIDE_HOURS', debordeFermeture: 'OUTSIDE_HOURS' });
    });

    test('heure de Dakar : 15 min dans le passé refusée ; à 90 jours + 1 h refusée ; à 89 jours acceptée ; heure ou date avec fuseau', async () => {
        const venue = await newVenue(partner);
        await newTable(partner, venue, 4);
        const cl = await newBuyer('cv11a-dakar');
        const past = startIn(-30);
        const far = startIn(90 * 24 * 60 + 60);
        const out: Row = {
            passe: code(await reserveRpc(cl, venue, past)),
            loin: code(await reserveRpc(cl, venue, far)),
            j89: code(await reserveRpc(cl, venue, { date: dayFromNow(89), time: '20:00', guests: 2 })),
        };
        const tz = await reserveRpc(cl, venue, { date: `${dayFromNow(43)}T23:30:00-05:00`, time: '20:00+05:00', guests: 2 });
        out.fuseau = code(tz);
        if (tz.ok === true) {
            const row = await reservation(String(tz.reservation_id));
            out.fuseauLu = `${String(row.reservation_date)} ${String(row.reservation_time)}`;
        }
        trace('2.1e', out);
        assert.deepEqual([out.passe, out.loin, out.j89], ['DATE_PASSED', 'DATE_TOO_FAR', 'OK']);
        if (tz.ok === true) assert.equal(out.fuseauLu, `${dayFromNow(43)} 20:00:00`, 'fuseau envoyé par le client pris en compte');
    });
});

describe('2.2 Table, zone, établissement', () => {
    test('table trop petite, en dessous du minimum, d’un autre établissement de la même partenaire, d’une autre partenaire, retirée ; zone d’ailleurs', async () => {
        const other = await newPartner('cv11a-resa-autre');
        const v1 = await newVenue(partner);
        const v2 = await newVenue(partner);
        const vo = await newVenue(other);
        const z1 = await newZone(partner, v1);
        const z2 = await newZone(partner, v2);
        const t6 = await newTable(partner, v1, 6, { min: 2, zoneId: z1 });
        const t2 = await newTable(partner, v2, 8);
        const to = await newTable(other, vo, 8);
        const off = await newTable(partner, v1, 8, { active: false });
        const cl = await newBuyer('cv11a-tables');
        const date = dayFromNow(44);
        const out = {
            septATableDe6: code(await reserveRpc(cl, v1, { date, guests: 7, tableId: t6 })),
            unATableDe2a6: code(await reserveRpc(cl, v1, { date, guests: 1, tableId: t6 })),
            tableAutreEtab: code(await reserveRpc(cl, v1, { date, guests: 4, tableId: t2 })),
            tableAutrePartenaire: code(await reserveRpc(cl, v1, { date, guests: 4, tableId: to })),
            tableRetiree: code(await reserveRpc(cl, v1, { date, guests: 4, tableId: off })),
            zoneAutreEtab: code(await reserveRpc(cl, v1, { date, guests: 4, zoneId: z2 })),
            tableHorsZone: code(await reserveRpc(cl, v2, { date, guests: 4, tableId: t2, zoneId: z2 })),
            septSansTable: code(await reserveRpc(cl, v1, { date, guests: 7 })),
        };
        trace('2.2a', out);
        assert.deepEqual(out, {
            septATableDe6: 'TABLE_TOO_SMALL', unATableDe2a6: 'TABLE_TOO_SMALL', tableAutreEtab: 'TABLE_NOT_FOUND', tableAutrePartenaire: 'TABLE_NOT_FOUND',
            tableRetiree: 'TABLE_NOT_FOUND', zoneAutreEtab: 'ZONE_NOT_FOUND', tableHorsZone: 'TABLE_NOT_FOUND', septSansTable: 'NO_TABLE_FITS',
        });
    });

    test('établissement en attente, refusé, suspendu, inactif, inconnu ; partenaire suspendue ou en attente : aucune réservation', async () => {
        const p2 = await newPartner('cv11a-resa-susp');
        const pending = await newVenue(partner, { validate: false });
        const refused = await newVenue(partner, { validate: false });
        assert.equal((await decideVenue(refused, 'REFUSER', 'Photos manquantes')).ok, true);
        const suspended = await newVenue(partner);
        assert.equal((await decideVenue(suspended, 'SUSPENDRE', 'Plaintes de clients')).ok, true);
        const inactive = await newVenue(partner, { is_active: false });
        const ofSuspended = await newVenue(p2);
        for (const v of [pending, refused, suspended, inactive, ofSuspended]) await newTable(v === ofSuspended ? p2 : partner, v, 4);
        await setFiche(p2.partnerId, 'SUSPENDU');
        const cl = await newBuyer('cv11a-etab');
        const date = dayFromNow(45);
        const out: Row = {
            attente: code(await reserveRpc(cl, pending, { date })), refuse: code(await reserveRpc(cl, refused, { date })),
            suspendu: code(await reserveRpc(cl, suspended, { date })), inactif: code(await reserveRpc(cl, inactive, { date })),
            partenaireSuspendue: code(await reserveRpc(cl, ofSuspended, { date })),
            inconnu: code(await reserveRpc(cl, '00000000-0000-4000-8000-000000000000', { date })),
        };
        await setFiche(p2.partnerId, 'EN_ATTENTE');
        out.partenaireEnAttente = code(await reserveRpc(cl, ofSuspended, { date }));
        await setFiche(p2.partnerId, 'VALIDE');
        const route = await reserveRoute(cl, { venueId: 'pas-un-uuid', date, time: '20:00', guests: 2 });
        out.routeIdentifiantIllisible = route.status;
        trace('2.2b', out);
        for (const k of ['attente', 'refuse', 'suspendu', 'inactif', 'partenaireSuspendue', 'partenaireEnAttente']) assert.equal(out[k], 'VENUE_NOT_AVAILABLE', k);
        assert.equal(out.inconnu, 'VENUE_NOT_FOUND');
        assert.equal(out.routeIdentifiantIllisible, 404);
        assert.equal((await sql(`SELECT id FROM public.table_reservations WHERE client_id = $1`, [cl.userId])).length, 0);
    });
});

describe('2.3 Plus de 3 demandes', () => {
    test('10 demandes simultanées dans 10 établissements (acompte ou acceptation manuelle) : au plus 3 tenues sans paiement', async () => {
        const cl = await newBuyer('cv11a-dix');
        const venues: string[] = [];
        for (let i = 0; i < 10; i += 1) {
            const v = await newVenue(partner, i % 2 === 0 ? { deposit_per_person: 2_000 } : { confirmation_mode: 'MANUELLE' });
            await newTable(partner, v, 4);
            venues.push(v);
        }
        const replies = await Promise.all(venues.map((v) => reserveRoute(cl, { venueId: v, date: dayFromNow(46), time: '20:00', guests: 2 })));
        const held = await heldWithoutPayment(cl.userId);
        trace('2.3a', { replies: replies.map((r) => r.status), held: held.length });
        assert.ok(held.length <= 3, `${held.length} demandes en attente pour le même client`);
    });

    test('2 demandes en attente + 3 attentes échues relancées en même temps par un paiement : au plus 3 tenues', async () => {
        const cl = await newBuyer('cv11a-relances');
        const ids: string[] = [];
        for (let i = 0; i < 5; i += 1) {
            const { venue } = await depositVenue(partner, 2_000);
            ids.push(await reserved(cl, venue, { date: dayFromNow(47) }));
            if (i >= 2) {
                await shiftReservation(ids[i], { holdMinutes: -1 });
                await tick();
                assert.equal((await reservation(ids[i])).booking_state, 'EXPIREE');
            }
        }
        const replies = await Promise.all(ids.slice(2).map((id) => startPayment(cl, id)));
        const held = await heldWithoutPayment(cl.userId);
        trace('2.3b', { replies: replies.map((r) => `${r.status} ${String(r.body.code ?? '')}`), held: held.length });
        assert.ok(held.length <= 3, `${held.length} demandes tenues sans paiement`);
    });

    test('relance d’une attente échue quand le numéro payeur a déjà 3 paiements en attente : la table n’est pas reprise sans paiement', async () => {
        const cl = await newBuyer('cv11a-plafond-numero');
        const rival = await newBuyer('cv11a-plafond-rival');
        // 3 acomptes lancés sur le même numéro (3 établissements), attentes échues : les 3 paiements restent en attente (< 1 h)
        for (let i = 0; i < 3; i += 1) {
            const { venue } = await depositVenue(partner, 2_000);
            const id = await reserved(cl, venue, { date: dayFromNow(48) });
            await started(cl, id);
            await shiftReservation(id, { holdMinutes: -1 });
        }
        await tick();
        const { venue } = await depositVenue(partner, 2_000);
        const date = dayFromNow(48);
        const id = await reserved(cl, venue, { date, time: '20:00', guests: 2 });
        await shiftReservation(id, { holdMinutes: -1 });
        await tick();
        assert.equal((await reservation(id)).booking_state, 'EXPIREE');
        const relances: Row[] = [];
        for (let i = 0; i < 3; i += 1) {
            const r = await startPayment(cl, id);
            const row = await reservation(id);
            relances.push({ http: r.status, code: r.body.code ?? null, payment: Boolean(r.payment), state: row.booking_state, hold: row.hold_expires_at });
        }
        const pays = await sql(`SELECT id FROM public.payments WHERE table_reservation_id = $1`, [id]);
        const steal = await reserveRpc(rival, venue, { date, time: '20:00', guests: 2 });
        trace('2.3c', { relances, paiementsDeLaReservation: pays.length, rival: code(steal) });
        assert.equal(pays.length, 0, 'précondition : aucun paiement créé pour cette réservation');
        assert.notEqual((await reservation(id)).booking_state, 'EN_ATTENTE_PAIEMENT',
            `table reprise et tenue sans aucun paiement (${String(relances[0].http)} ${String(relances[0].code)}), le rival reçoit ${code(steal)}`);
        assert.equal(code(steal), 'OK', 'la table devrait être libre pour un autre client');
    });

    test('même plafond du numéro payeur : une attente en cours est prolongée sans paiement à chaque appel', async () => {
        const cl = await newBuyer('cv11a-prolonge');
        for (let i = 0; i < 3; i += 1) {
            const { venue } = await depositVenue(partner, 2_000);
            const id = await reserved(cl, venue, { date: dayFromNow(49) });
            await started(cl, id);
            await shiftReservation(id, { holdMinutes: -1 });
        }
        await tick();
        const { venue } = await depositVenue(partner, 2_000);
        const id = await reserved(cl, venue, { date: dayFromNow(49) });
        await shiftReservation(id, { holdMinutes: 1 });
        const before = String((await reservation(id)).hold_expires_at);
        const r = await startPayment(cl, id);
        const afterHold = String((await reservation(id)).hold_expires_at);
        const gainedMin = (Date.parse(afterHold) - Date.parse(before)) / 60_000;
        trace('2.3d', { http: r.status, code: r.body.code, before, after: afterHold, gainedMin: Math.round(gainedMin), payment: Boolean(r.payment) });
        assert.ok(!(r.status !== 201 && gainedMin > 1), `attente prolongée de ${Math.round(gainedMin)} min par un appel refusé (${r.status} ${String(r.body.code)})`);
    });

    test('réservations gratuites, confirmation automatique (réglage par défaut) : un client ne tient pas plus de 3 tables sans payer', async () => {
        const venue = await newVenue(partner);
        for (let i = 0; i < 6; i += 1) await newTable(partner, venue, 4);
        const cl = await newBuyer('cv11a-gratuit');
        const rival = await newBuyer('cv11a-gratuit-rival');
        const date = dayFromNow(50);
        const replies: string[] = [];
        for (let i = 0; i < 6; i += 1) replies.push(code(await reserveRpc(cl, venue, { date, time: '20:00', guests: 2 })));
        const held = await heldWithoutPayment(cl.userId);
        const rivalTry = code(await reserveRpc(rival, venue, { date, time: '20:00', guests: 2 }));
        trace('2.3e', { replies, held: held.map((h) => h.booking_state), rival: rivalTry });
        assert.ok(held.length <= 3, `${held.length} tables tenues sans payer par un seul compte, le client suivant reçoit ${rivalTry}`);
    });

    test('4e demande à la suite refusée ; réserver pour un autre client par le corps impossible', async () => {
        const cl = await newBuyer('cv11a-quatre');
        const other = await newBuyer('cv11a-quatre-autre');
        const replies: string[] = [];
        for (let i = 0; i < 4; i += 1) {
            const { venue } = await depositVenue(partner, 2_000);
            const r = await reserveRoute(cl, { venueId: venue, date: dayFromNow(51), time: '20:00', guests: 2, client_id: other.userId, clientId: other.userId });
            replies.push(`${r.status} ${String(r.body.code ?? '')}`);
        }
        const others = await sql(`SELECT id FROM public.table_reservations WHERE client_id = $1`, [other.userId]);
        trace('2.3f', { replies, others: others.length });
        assert.match(replies[3], /^429 TOO_MANY_PENDING/);
        assert.equal(others.length, 0);
        await releasePending(cl.userId);
    });
});

describe('2.4 Payer la réservation d’un autre', () => {
    test('un autre client lance le paiement de ma réservation : introuvable', async () => {
        const cl = await newBuyer('cv11a-payer-autre');
        const thief = await newBuyer('cv11a-payer-voleur');
        const { venue } = await depositVenue(partner, 2_000);
        const id = await reserved(cl, venue, { date: dayFromNow(52) });
        const r = await startPayment(thief, id);
        trace('2.4', show({ status: r.status, body: r.body }));
        assert.equal(r.status, 404);
        assert.equal((await sql(`SELECT id FROM public.payments WHERE table_reservation_id = $1`, [id])).length, 0);
    });
});
