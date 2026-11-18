/**
 * Contre-vérification du lot 10a — point 2 : réservation. Chevauchements simultanés (même salle, créneaux qui se
 * touchent, heure de Dakar), salle d'une partenaire non validée, suspendue ou refusée, salle non validée, date passée,
 * plus de 3 attentes, réservation au nom d'un autre client. Un test rouge est un TROU (docs/audit-lot10a.md).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot10aInvariants } from '../helpers/lot10a-invariants';
import { inspect } from '../helpers/db';
import {
    dayFromNow, decideHall, expireHold, n, newBuyer, newHall, newPartner, openHallsService, pendingCount, reservation,
    reservationsOf, reserveRoute, reserveRpc, service, show, sql, startPayment, tick, trace, type Row, type TestPartner,
} from './cv10a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;

before(async () => {
    restore = await openHallsService();
    partner = await newPartner('cv10a-resa');
});

after(async () => {
    await restore();
    await assertLot10aInvariants('cv10a-2-reservation');
});

async function activeSlots(hall: string): Promise<Row[]> {
    return sql(`SELECT id, client_id, lower(slot)::text AS a, upper(slot)::text AS b FROM public.hall_reservations
                 WHERE hall_id = $1 AND status::text IN ('EN_ATTENTE', 'CONFIRMEE') ORDER BY lower(slot)`, [hall]);
}

describe('2.1 Chevauchements', () => {
    test('8 clients réservent la même journée en même temps : une seule réservation', async () => {
        const hall = await newHall(partner);
        const clients = await Promise.all(Array.from({ length: 8 }, (_, i) => newBuyer(`cv10a-course-${i}`)));
        const rs = await Promise.all(clients.map((c) => reserveRoute(c, { hallId: hall, startDate: dayFromNow(60), units: 1 })));
        trace('2.1a', rs.map((r) => `${r.status} ${String(r.body.code ?? '')}`));
        assert.equal(rs.filter((r) => r.status === 200).length, 1);
        assert.equal((await activeSlots(hall)).length, 1);
    });

    test('journée de 3 jours contre des réservations à l’heure et à la journée lancées en même temps : jamais deux créneaux qui se chevauchent', async () => {
        const hall = await newHall(partner, { price_per_hour: 10_000 });
        const d = dayFromNow(61);
        const d2 = dayFromNow(63);
        const cs = await Promise.all(Array.from({ length: 5 }, (_, i) => newBuyer(`cv10a-mix-${i}`)));
        const rs = await Promise.all([
            reserveRoute(cs[0], { hallId: hall, startDate: d, units: 3 }),
            reserveRoute(cs[1], { hallId: hall, startDate: d, mode: 'HEURE', startTime: '10:00', units: 2 }),
            reserveRoute(cs[2], { hallId: hall, startDate: d2, mode: 'HEURE', startTime: '23:00', units: 1 }),
            reserveRoute(cs[3], { hallId: hall, startDate: d2, units: 1 }),
            reserveRoute(cs[4], { hallId: hall, startDate: dayFromNow(62), mode: 'HEURE', startTime: '00:00', units: 24 }),
        ]);
        const slots = await activeSlots(hall);
        trace('2.1b', { replies: rs.map((r) => `${r.status} ${String(r.body.code ?? '')}`), slots });
        for (let i = 0; i < slots.length; i++) {
            for (let j = i + 1; j < slots.length; j++) {
                assert.ok(String(slots[j].a) >= String(slots[i].b), `chevauchement ${JSON.stringify(slots[i])} / ${JSON.stringify(slots[j])}`);
            }
        }
        assert.ok(slots.length >= 1);
    });

    test('créneaux qui se touchent : acceptés ; créneaux qui se recouvrent d’une minute : refusés', async () => {
        const hall = await newHall(partner, { price_per_hour: 10_000 });
        const d = dayFromNow(70);
        const before1 = dayFromNow(69);
        const after3 = dayFromNow(73);
        const c = await Promise.all(Array.from({ length: 7 }, (_, i) => newBuyer(`cv10a-touche-${i}`)));
        const day = await reserveRpc(c[0], hall, { startDate: d, days: 3 });
        const eveBefore = await reserveRpc(c[1], hall, { mode: 'HEURE', startDate: before1, startTime: '22:00', hours: 2 });
        const dayAfter = await reserveRpc(c[2], hall, { startDate: after3, days: 1 });
        const lastNight = await reserveRpc(c[3], hall, { mode: 'HEURE', startDate: dayFromNow(72), startTime: '23:00', hours: 1 });
        const first = await reserveRpc(c[4], hall, { mode: 'HEURE', startDate: before1, startTime: '10:00', hours: 2 });
        const next = await reserveRpc(c[5], hall, { mode: 'HEURE', startDate: before1, startTime: '12:00', hours: 2 });
        const overlap = await reserveRpc(c[6], hall, { mode: 'HEURE', startDate: before1, startTime: '13:30', hours: 1 });
        trace('2.1c', [day, eveBefore, dayAfter, lastNight, first, next, overlap].map((r) => r.ok === true ? 'ok' : r.code));
        assert.deepEqual([day.ok, eveBefore.ok, dayAfter.ok, first.ok, next.ok], [true, true, true, true, true], 'créneaux qui se touchent');
        assert.deepEqual([lastNight.code, overlap.code], ['SLOT_TAKEN', 'SLOT_TAKEN'], 'créneaux qui se recouvrent');
    });

    test('heure de Dakar : journée d’aujourd’hui refusée ; échéance du solde à J-7 00:00 à Dakar ; calcul identique quel que soit le fuseau de la session', async () => {
        const client = await newBuyer('cv10a-dakar');
        const hall = await newHall(partner, { price_per_hour: 10_000 });
        const today = new Date().toISOString().slice(0, 10);
        const t = await reserveRoute(client, { hallId: hall, startDate: today, units: 1 });
        assert.deepEqual([t.status, t.body.code], [400, 'DATE_PASSED'], show(t));
        const hourNow = new Date().getUTCHours();
        if (hourNow >= 1) {
            const past = await reserveRoute(client, { hallId: hall, startDate: today, mode: 'HEURE', startTime: '00:00', units: 1 });
            assert.deepEqual([past.status, past.body.code], [400, 'DATE_PASSED'], show(past));
        }
        const start = dayFromNow(40);
        const q = await reserveRpc(client, hall, { startDate: start, days: 1 });
        const expectedDue = new Date(Date.parse(`${start}T00:00:00Z`) - 7 * 86_400_000).toISOString();
        assert.equal(new Date(String(q.balance_due_at)).toISOString(), expectedDue);
        const p = JSON.stringify({ hall_id: hall, mode: 'HEURE', start_date: dayFromNow(41), start_time: '10:00', units: 2 });
        const quotes: Row[] = [];
        for (const tz of ['UTC', 'Pacific/Kiritimati', 'America/Los_Angeles', 'Africa/Dakar']) {
            const qq = await inspect(async (c) => {
                await c.query(`SELECT set_config('TimeZone', $1, true)`, [tz]);
                return (await c.query<{ q: Row }>(`SELECT public.hall_quote($1::jsonb) AS q`, [p])).rows[0].q;
            });
            quotes.push({ tz, start_at: qq.start_at, balance_due_at: new Date(String(qq.balance_due_at)).toISOString(), full: qq.full_payment_required, end: qq.end_time });
        }
        trace('2.1d', quotes);
        for (const x of quotes) assert.deepEqual([x.start_at, x.balance_due_at, x.full, x.end], [quotes[0].start_at, quotes[0].balance_due_at, quotes[0].full, quotes[0].end], String(x.tz));
    });
});

describe('2.2 Salle ou partenaire non ouverte à la réservation', () => {
    const cases: Array<[string, (hall: string, partnerId: string) => Promise<void>]> = [
        ['partenaire EN_ATTENTE', async (_h, p) => { const { error } = await service.from('partners').update({ status: 'EN_ATTENTE' }).eq('id', p); assert.equal(error, null, error?.message); }],
        ['partenaire SUSPENDU', async (_h, p) => { const { error } = await service.from('partners').update({ status: 'SUSPENDU' }).eq('id', p); assert.equal(error, null, error?.message); }],
        ['partenaire REJETE', async (_h, p) => { const { error } = await service.from('partners').update({ status: 'REJETE' }).eq('id', p); assert.equal(error, null, error?.message); }],
        ['salle SUSPENDUE', async (h) => { await decideHall(h, 'SUSPENDRE', 'Plainte des voisins'); }],
        ['salle inactive', async (h) => { const { error } = await service.from('halls').update({ is_active: false }).eq('id', h); assert.equal(error, null, error?.message); }],
    ];
    for (const [label, apply] of cases) {
        test(`${label} : réservation refusée`, async () => {
            const owner = await newPartner(`cv10a-st-${label.replace(/\W/g, '')}`);
            const hall = await newHall(owner);
            await apply(hall, owner.partnerId);
            const client = await newBuyer('cv10a-st');
            const r = await reserveRoute(client, { hallId: hall, startDate: dayFromNow(64), units: 1 });
            trace(`2.2 ${label}`, show(r));
            assert.ok(r.status === 409 || r.status === 404, show(r));
            assert.deepEqual(await reservationsOf(client.userId), []);
        });
    }

    test('salle en attente de validation, salle refusée : réservation refusée', async () => {
        const client = await newBuyer('cv10a-val');
        const pendingHall = await newHall(partner, { validate: false });
        const refused = await newHall(partner, { validate: false });
        await decideHall(refused, 'REFUSER', 'Photos manquantes');
        for (const h of [pendingHall, refused]) {
            const r = await reserveRoute(client, { hallId: h, startDate: dayFromNow(65), units: 1 });
            assert.deepEqual([r.status, r.body.code], [409, 'HALL_NOT_AVAILABLE'], show(r));
        }
    });

    test('réservation échue relancée par un paiement après la suspension de la salle : refusée', async () => {
        const owner = await newPartner('cv10a-relance-s');
        const hall = await newHall(owner);
        const client = await newBuyer('cv10a-relance-s');
        const id = String((await reserveRpc(client, hall, { days: 1, startInDays: 66 })).reservation_id);
        await expireHold(id);
        await tick();
        await decideHall(hall, 'SUSPENDRE', 'Salle fermée par la mairie');
        const r = await startPayment(client, id, 'ACOMPTE');
        trace('2.2 relance salle suspendue', `${r.status} ${JSON.stringify(r.body).slice(0, 200)} → ${(await reservation(id)).booking_state}`);
        assert.notEqual(r.status, 201, 'paiement lancé sur une salle suspendue');
        assert.notEqual((await reservation(id)).booking_state, 'EN_ATTENTE_PAIEMENT', 'la date est de nouveau tenue');
    });

    test('réservation échue relancée par un paiement après la suspension de la partenaire : refusée', async () => {
        const owner = await newPartner('cv10a-relance-p');
        const hall = await newHall(owner);
        const client = await newBuyer('cv10a-relance-p');
        const id = String((await reserveRpc(client, hall, { days: 1, startInDays: 67 })).reservation_id);
        await expireHold(id);
        await tick();
        await service.from('partners').update({ status: 'SUSPENDU' }).eq('id', owner.partnerId);
        const r = await startPayment(client, id, 'INTEGRAL');
        trace('2.2 relance partenaire suspendue', `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
        assert.notEqual(r.status, 201, 'paiement lancé chez une partenaire suspendue');
    });
});

describe('2.3 Date passée', () => {
    test('hier, aujourd’hui, 1970 : refusés', async () => {
        const client = await newBuyer('cv10a-passe');
        const hall = await newHall(partner);
        for (const startDate of [dayFromNow(-1), dayFromNow(0), '1970-01-01']) {
            const r = await reserveRoute(client, { hallId: hall, startDate, units: 1 });
            assert.deepEqual([r.status, r.body.code], [400, 'DATE_PASSED'], `${startDate} : ${show(r)}`);
        }
        const multi = await reserveRoute(client, { hallId: hall, startDate: dayFromNow(-2), units: 5 });
        assert.deepEqual([multi.status, multi.body.code], [400, 'DATE_PASSED'], 'période commencée hier');
    });
});

describe('2.4 Plus de 3 réservations non payées', () => {
    test('une 4e à la suite : refusée', async () => {
        const client = await newBuyer('cv10a-3a');
        const halls = await Promise.all(Array.from({ length: 4 }, () => newHall(partner)));
        const rs: Row[] = [];
        for (const h of halls) rs.push(await reserveRpc(client, h, { days: 1, startInDays: 75 }));
        assert.deepEqual(rs.map((r) => r.ok === true ? 'ok' : r.code), ['ok', 'ok', 'ok', 'TOO_MANY_PENDING']);
    });

    test('10 salles différentes réservées en même temps : au plus 3 attentes', async () => {
        const client = await newBuyer('cv10a-3b');
        const halls = await Promise.all(Array.from({ length: 10 }, () => newHall(partner)));
        const rs = await Promise.all(halls.map((h) => reserveRoute(client, { hallId: h, startDate: dayFromNow(76), units: 1 })));
        const pending = await pendingCount(client.userId);
        trace('2.4b', { replies: rs.map((r) => r.status), pending });
        assert.ok(pending <= 3, `${pending} réservations non payées tiennent des dates en même temps`);
    });

    test('3 attentes, puis deux réservations échues relancées par un paiement : au plus 3 dates tenues sans paiement', async () => {
        const client = await newBuyer('cv10a-3c');
        const halls = await Promise.all(Array.from({ length: 5 }, () => newHall(partner)));
        const old1 = String((await reserveRpc(client, halls[0], { days: 1, startInDays: 77 })).reservation_id);
        const old2 = String((await reserveRpc(client, halls[1], { days: 1, startInDays: 77 })).reservation_id);
        await expireHold(old1);
        await expireHold(old2);
        await tick();
        for (const h of halls.slice(2)) assert.equal((await reserveRpc(client, h, { days: 1, startInDays: 77 })).ok, true);
        const r1 = await startPayment(client, old1, 'ACOMPTE');
        const r2 = await startPayment(client, old2, 'ACOMPTE');
        const held = await sql<{ c: string }>(`SELECT count(*)::text AS c FROM public.hall_reservations
                                                 WHERE client_id = $1 AND booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at > now()`, [client.userId]);
        trace('2.4c', { relances: [r1.status, r2.status], held: held[0].c });
        assert.ok(n(held[0].c) <= 3, `${held[0].c} dates tenues sans paiement par le même client`);
    });
});

describe('2.5 Au nom d’un autre client', () => {
    test('identifiant d’un autre client dans le corps : la réservation est au nom de la session', async () => {
        const attacker = await newBuyer('cv10a-usurp');
        const victim = await newBuyer('cv10a-victime');
        const hall = await newHall(partner);
        const r = await reserveRoute(attacker, { hallId: hall, startDate: dayFromNow(78), units: 1, client_id: victim.userId, clientId: victim.userId, userId: victim.userId, client: victim.userId });
        assert.equal(r.status, 200, show(r));
        assert.equal((await reservation(String((r.body.reservation as Row).id))).client_id, attacker.userId);
        assert.deepEqual(await reservationsOf(victim.userId), []);
    });

    test('payer ou annuler la réservation d’un autre : « Réservation introuvable »', async () => {
        const owner = await newBuyer('cv10a-proprio');
        const attacker = await newBuyer('cv10a-payeur');
        const id = String((await reserveRpc(owner, await newHall(partner), { days: 1, startInDays: 79 })).reservation_id);
        const pay = await startPayment(attacker, id, 'INTEGRAL');
        assert.deepEqual([pay.status, pay.body.code], [404, 'RESERVATION_NOT_FOUND'], JSON.stringify(pay.body));
        assert.equal((await reservation(id)).booking_state, 'EN_ATTENTE_PAIEMENT');
    });

    test('la partenaire réserve sa propre salle : refusé', async () => {
        const hall = await newHall(partner);
        const r = await reserveRoute(partner, { hallId: hall, startDate: dayFromNow(80), units: 1 });
        assert.deepEqual([r.status, r.body.code], [409, 'OWN_HALL'], show(r));
    });
});
