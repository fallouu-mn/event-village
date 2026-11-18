/**
 * Contre-vérification du lot 11a — point 3 : délais. Attente de paiement de 15 min, réponse sous 2 h, absence à 30 min,
 * annulation gratuite jusqu'à 2 h avant, à quelques minutes des seuils ; demande payée annulée avant la réponse ;
 * réservation prise à moins de 2 h ; tâche ev_tables rejouée ou lancée en parallèle (fonction et route).
 * Un test rouge est un TROU (docs/audit-lot11a.md). Le temps est simulé par shiftReservation, jamais l'horloge.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { assertLot11aInvariants } from '../helpers/lot11a-invariants';
import { BASE_URL } from '../parcours/helpers';
import { GET as cronTables } from '../../app/api/cron/tables/route';
import {
    clientCancel, confirmByWebhook, dayFromNow, depositVenue, n, newBuyer, newPartner, openTablesService, partnerAction, payConfirmed,
    refundsOf, reservation, reserveRoute, reserved, service, shiftReservation, show, started, startIn, tick, trace, type Row, type TestPartner,
} from './cv11a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;

before(async () => {
    restore = await openTablesService();
    partner = await newPartner('cv11a-delais');
});

after(async () => {
    await restore();
    await assertLot11aInvariants('cv11a-3-delais');
});

const refunded = async (id: string): Promise<number> => (await refundsOf(id)).reduce((s, r) => s + n(r.amount), 0);

describe('3.1 Attente de paiement (15 min)', () => {
    test('1 min avant la fin : la tâche ne rend pas la table ; 1 min après : « Non payée à temps »', async () => {
        const cl = await newBuyer('cv11a-attente');
        const { venue } = await depositVenue(partner);
        const id = await reserved(cl, venue, { date: dayFromNow(60) });
        await shiftReservation(id, { holdMinutes: 1 });
        await tick();
        const s1 = (await reservation(id)).booking_state;
        await shiftReservation(id, { holdMinutes: -1 });
        await tick();
        const s2 = (await reservation(id)).booking_state;
        trace('3.1a', { avant: s1, apres: s2 });
        assert.deepEqual([s1, s2], ['EN_ATTENTE_PAIEMENT', 'EXPIREE']);
    });

    test('paiement lancé à la dernière seconde, attente échue avant la confirmation, table encore libre : confirmée (rien de perdu)', async () => {
        const cl = await newBuyer('cv11a-derniere-seconde');
        const { venue } = await depositVenue(partner);
        const id = await reserved(cl, venue, { date: dayFromNow(61) });
        const p = await started(cl, id);
        await shiftReservation(id, { holdMinutes: -1 });
        await tick();
        const mid = (await reservation(id)).booking_state;
        await confirmByWebhook(p);
        const row = await reservation(id);
        trace('3.1b', { apresTache: mid, final: row.booking_state, paid: row.paid_amount, rendu: await refunded(id) });
        assert.equal(row.booking_state, 'CONFIRMEE');
        assert.equal(n(row.paid_amount), 21_000);
        assert.equal(await refunded(id), 0);
    });
});

describe('3.2 Réponse de l’établissement (2 h)', () => {
    test('1 min avant l’échéance : la tâche attend, l’établissement accepte ; 1 min après : accepter est trop tard, tout rendu', async () => {
        const cl = await newBuyer('cv11a-reponse');
        const { venue } = await depositVenue(partner, 5_000, { confirmation_mode: 'MANUELLE' });
        const id = await reserved(cl, venue, { date: dayFromNow(62) });
        await payConfirmed(cl, id);
        await shiftReservation(id, { responseMinutes: 1 });
        await tick();
        const s1 = (await reservation(id)).booking_state;
        const ok = await partnerAction(id, partner.accessToken, { action: 'ACCEPTER' });

        const cl2 = await newBuyer('cv11a-reponse-tard');
        const { venue: v2 } = await depositVenue(partner, 5_000, { confirmation_mode: 'MANUELLE' });
        const id2 = await reserved(cl2, v2, { date: dayFromNow(62) });
        await payConfirmed(cl2, id2);
        await shiftReservation(id2, { responseMinutes: -1 });
        const late = await partnerAction(id2, partner.accessToken, { action: 'ACCEPTER' });
        const row2 = await reservation(id2);
        trace('3.2a', { avant: s1, accepte: show(ok), tard: show(late), etatTard: row2.booking_state, rendu: await refunded(id2) });
        assert.equal(s1, 'EN_ATTENTE_ACCEPTATION');
        assert.equal(ok.status, 200, show(ok));
        assert.equal((await reservation(id)).booking_state, 'CONFIRMEE');
        assert.notEqual(late.status, 200);
        assert.equal(row2.booking_state, 'SANS_REPONSE');
        assert.equal(await refunded(id2), 21_000);
    });

    test('échéance dépassée : acceptation et tâche (×3) en même temps → un seul résultat, rendu une fois', async () => {
        const cl = await newBuyer('cv11a-reponse-course');
        const { venue } = await depositVenue(partner, 5_000, { confirmation_mode: 'MANUELLE' });
        const id = await reserved(cl, venue, { date: dayFromNow(63) });
        await payConfirmed(cl, id);
        await shiftReservation(id, { responseMinutes: -1 });
        const replies = await Promise.all([partnerAction(id, partner.accessToken, { action: 'ACCEPTER' }), tick(), tick(), tick()]);
        const row = await reservation(id);
        const refunds = await refundsOf(id);
        trace('3.2b', { accept: show(replies[0] as { status: number; body: Row }), state: row.booking_state, refunds: refunds.map((r) => r.amount) });
        assert.equal(row.booking_state, 'SANS_REPONSE');
        assert.deepEqual(refunds.map((r) => n(r.amount)), [21_000]);
    });
});

describe('3.3 Annulation par le client autour de 2 h', () => {
    test('à 2 h 03 de l’heure : tout rendu ; à 1 h 57 : rien rendu (réservation confirmée)', async () => {
        const out: Row = {};
        for (const [label, minutes, expected] of [['2h03', 123, 21_000], ['1h57', 117, 0]] as const) {
            const cl = await newBuyer(`cv11a-seuil-${label}`);
            const { venue } = await depositVenue(partner);
            const id = await reserved(cl, venue, { date: dayFromNow(64) });
            await payConfirmed(cl, id);
            await shiftReservation(id, { startMinutes: minutes });
            const r = await clientCancel(id, cl.accessToken);
            out[label] = { http: r.status, rendu: await refunded(id), message: (r.body as Row).message };
            assert.equal(await refunded(id), expected, label);
        }
        trace('3.3a', out);
    });

    test('demande payée pas encore acceptée par l’établissement, annulée par le client à 1 h 30 de l’heure : acompte rendu', async () => {
        const cl = await newBuyer('cv11a-annule-demande');
        const { venue } = await depositVenue(partner, 5_000, { confirmation_mode: 'MANUELLE' });
        const id = await reserved(cl, venue, startIn(180));
        await payConfirmed(cl, id);
        await shiftReservation(id, { startMinutes: 90, responseMinutes: 30 });
        const before = (await reservation(id)).booking_state;
        const r = await clientCancel(id, cl.accessToken);
        const row = await reservation(id);
        const rendu = await refunded(id);
        trace('3.3b', { avant: before, http: r.status, message: (r.body as Row).message, state: row.booking_state, paid: row.paid_amount, rendu });
        assert.equal(before, 'EN_ATTENTE_ACCEPTATION');
        assert.equal(rendu, 21_000, `${rendu} F rendus : l’établissement garde ${21_000 - rendu} F sur une demande qu’il n’a jamais acceptée`);
    });

    test('réservation avec acompte prise à 1 h de l’heure : le client n’est pas assuré d’un remboursement impossible', async () => {
        const cl = await newBuyer('cv11a-moins-2h');
        const { venue } = await depositVenue(partner);
        const r = await reserveRoute(cl, { venueId: venue, ...startIn(60), guests: 4 });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const text = String((r.body.reservation as Row).cancellation);
        trace('3.3c', { cancellation: text });
        assert.ok(!/remboursé si vous annulez au moins/i.test(text), `réservation à 1 h de l’heure, le client lit : « ${text} »`);
    });
});

describe('3.4 Absence (30 min)', () => {
    test('29 min après l’heure : rien ; 31 min : « Absent » ; « Client arrivé » envoyé en même temps que la tâche : un seul état', async () => {
        const cl = await newBuyer('cv11a-absent');
        const { venue } = await depositVenue(partner);
        const id = await reserved(cl, venue, startIn(240));
        await payConfirmed(cl, id);
        await shiftReservation(id, { startMinutes: -29 });
        await tick();
        const s1 = (await reservation(id)).booking_state;

        const cl2 = await newBuyer('cv11a-absent-course');
        const { venue: v2 } = await depositVenue(partner);
        const id2 = await reserved(cl2, v2, startIn(240));
        await payConfirmed(cl2, id2);
        await shiftReservation(id2, { startMinutes: -31 });
        const [arrived] = await Promise.all([partnerAction(id2, partner.accessToken, { action: 'ARRIVEE' }), tick(), tick()]);
        const row2 = await reservation(id2);
        trace('3.4', { a29: s1, course: show(arrived), etat: row2.booking_state, rendu: await refunded(id2) });
        assert.equal(s1, 'CONFIRMEE');
        assert.ok(['ARRIVEE', 'ABSENT'].includes(String(row2.booking_state)), String(row2.booking_state));
        assert.equal(arrived.status === 200, row2.booking_state === 'ARRIVEE', 'réponse et état d’accord');
        assert.equal(await refunded(id2), 0);
    });
});

describe('3.5 Tâche ev_tables rejouée ou en parallèle', () => {
    test('attente échue, demande sans réponse, absence : 4 passages de la fonction + 2 de la route en même temps, puis 2 de plus', async () => {
        const c1 = await newBuyer('cv11a-tache-1');
        const c2 = await newBuyer('cv11a-tache-2');
        const c3 = await newBuyer('cv11a-tache-3');
        const { venue: v1 } = await depositVenue(partner);
        const { venue: v2 } = await depositVenue(partner, 5_000, { confirmation_mode: 'MANUELLE' });
        const { venue: v3 } = await depositVenue(partner);
        const hold = await reserved(c1, v1, { date: dayFromNow(65) });
        const ask = await reserved(c2, v2, { date: dayFromNow(65) });
        await payConfirmed(c2, ask);
        const noShow = await reserved(c3, v3, startIn(300));
        await payConfirmed(c3, noShow);
        await shiftReservation(hold, { holdMinutes: -1 });
        await shiftReservation(ask, { responseMinutes: -1 });
        await shiftReservation(noShow, { startMinutes: -40 });
        const cron = async () => {
            const res = await cronTables(new NextRequest(`${BASE_URL}/api/cron/tables`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
            return { status: res.status, body: (await res.json()) as Row };
        };
        const settled = await Promise.allSettled([
            service.rpc('table_reservations_tick'), service.rpc('table_reservations_tick'), service.rpc('table_reservations_tick'), service.rpc('table_reservations_tick'),
            cron(), cron(),
        ]);
        const errors = settled.map((s) => (s.status === 'rejected' ? String(s.reason)
            : (s.value as { error?: { message: string } | null }).error?.message ?? ((s.value as { status?: number }).status && (s.value as { status: number }).status >= 400 ? `HTTP ${(s.value as { status: number }).status}` : null))).filter(Boolean);
        await tick();
        await tick();
        const states = [(await reservation(hold)).booking_state, (await reservation(ask)).booking_state, (await reservation(noShow)).booking_state];
        const refundsAsk = await refundsOf(ask);
        const refundsNoShow = await refundsOf(noShow);
        trace('3.5', { errors, states, refundsAsk: refundsAsk.map((r) => r.amount), refundsNoShow: refundsNoShow.length });
        assert.deepEqual(errors, [], 'passages en erreur (blocage mutuel ?)');
        assert.deepEqual(states, ['EXPIREE', 'SANS_REPONSE', 'ABSENT']);
        assert.deepEqual(refundsAsk.map((r) => n(r.amount)), [21_000]);
        assert.equal(refundsNoShow.length, 0);
    });

    test('la route de la tâche refuse un appel sans secret ou avec un faux secret', async () => {
        const none = await cronTables(new NextRequest(`${BASE_URL}/api/cron/tables`));
        const wrong = await cronTables(new NextRequest(`${BASE_URL}/api/cron/tables`, { headers: { authorization: 'Bearer faux-secret' } }));
        const serviceKey = await cronTables(new NextRequest(`${BASE_URL}/api/cron/tables`, { headers: { authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } }));
        trace('3.5b', { none: none.status, wrong: wrong.status, serviceKey: serviceKey.status });
        assert.deepEqual([none.status, wrong.status], [401, 401]);
        assert.equal(serviceKey.status, 401);
    });
});
