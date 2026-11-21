/**
 * Contre-vérification du lot 11b — suite 2 : GARDE-FOUS. Attaques qui doivent être bloquées ; un test rouge ici serait
 * un trou (sortie brute lue au rapport). Aucun correctif (branche lot11b/cv-rouges, jamais fusionnée).
 *
 *  G1  cloisonnement des partenaires : établissement, tables, plan, fermetures, planning, réservations, recettes d'autrui ;
 *  G2  cloisonnement des clients : réservation d'un autre client (détail, aperçu, « J'arrive », annulation) ;
 *  G3  REST (clé anon + jeton) : établissements non publics, fermetures, réservations, paiements ; écritures ; fonctions ;
 *  G4  fiche SUSPENDU : lecture seule partout ; exception voulue : acceptation refusée et client remboursé en entier ;
 *  G5  lien court /t/<code> : session exigée, même 404 sans indice (code d'autrui, inconnu, mal formé) ;
 *  G6  argent des fermetures : deux fermetures et fermeture + annulation en même temps, attente de paiement touchée ;
 *  G7  délais : demande sans réponse à 2 h et absence à 30 min, tâches et action de l'établissement en même temps ;
 *  G8  créneaux : course sur une table, une table par créneau et par client, 3 non payées, fermeture et horaires en base ;
 *  G9  service fermé : catalogue, nouvelle réservation, création et modification fermés ; réservation existante ouverte ;
 *  G10 données : prénom et initiale, téléphone seulement pour une table tenue, avis, contacts de la partenaire (admin) ;
 *  G11 validation : non validé, refusé, suspendu, partenaire suspendue → ni visible ni réservable ; refusé modifié reste refusé ;
 *  G12 photos et plan : photos du seul dossier de la partenaire, positions bornées, plan d'autrui.
 *
 * Base LOCALE, faux SamirPay ; routes réelles (gestionnaires importés, session par jeton).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { assertLot11aInvariants } from '../helpers/lot11a-invariants';
import { newAdmin } from '../parcours/notif-helpers';
import { withFeatureFlags } from '../parcours/terrain-helpers';
import {
    api, cashoutsOf, closureCreate, closurePreview, confirmByWebhook, dayFromNow, decideVenue, linkRoute, n, newBuyer, newPartner,
    newTable, newVenue, newZone, openTablesService, paidOn, partnerPatch, payConfirmed, photoOf, releasePending, reservation,
    reserveRoute, reserveRpc, restAs, routeId, service, setFiche, shiftReservation, show, sql, started, startPayment, tick, trace,
    type Buyer, type Reply, type Row, type TestPartner,
} from './cv11b-helpers';

let restore: () => Promise<void>;
let owner: TestPartner;
let stranger: TestPartner;
let alice: Buyer;
let bob: Buyer;

before(async () => {
    restore = await openTablesService();
    owner = await newPartner('cv11b-2-proprio');
    stranger = await newPartner('cv11b-2-autre');
    alice = await newBuyer('cv11b-2-alice', { firstName: 'Awa', lastName: 'Ndiayegueye' });
    bob = await newBuyer('cv11b-2-bob', { firstName: 'Modou', lastName: 'Fallsène' });
});

after(async () => {
    await setFiche(owner.partnerId, 'VALIDE');
    await restore();
    await assertFinanceInvariants('cv11b-2-gardes');
    await assertLot11aInvariants('cv11b-2-gardes');
});

const codeOf = (r: Reply): unknown => r.body.code;

describe('G1. Cloisonnement des partenaires', () => {
    test('une autre partenaire, avec les identifiants de l’établissement : rien lu, rien écrit', async () => {
        const venue = await newVenue(owner, { deposit_per_person: 5_000, confirmation_mode: 'MANUELLE' });
        const zone = await newZone(owner, venue, 'Salle');
        const table = await newTable(owner, venue, 4, { number: 'C1', zoneId: zone });
        const date = dayFromNow(50);
        const res = await reserveRpc(alice, venue, { date, time: '20:00', guests: 4, tableId: table });
        assert.equal(res.ok, true, JSON.stringify(res));
        const id = String(res.reservation_id);
        await payConfirmed(alice, id);
        assert.equal((await reservation(id)).booking_state, 'EN_ATTENTE_ACCEPTATION');
        const closure = await closureCreate(owner, venue, { start_date: dayFromNow(51), reason: 'Inventaire annuel', expected_count: 0 });
        assert.equal(closure.status, 201, show(closure));
        const closureId = String((closure.body.closure as Row).id);
        const ownVenue = await newVenue(stranger);
        const before0 = (await sql(`SELECT name, photos, floor_plan_enabled FROM public.venues WHERE id = $1`, [venue]))[0];
        const tBefore = (await sql(`SELECT plan_x, capacity, is_active FROM public.restaurant_tables WHERE id = $1`, [table]))[0];
        const t = stranger.accessToken;
        const tries: Record<string, Reply> = {
            fiche: await routeId('GET', 'partner/venues/[id]', venue, t),
            modifier: await routeId('PATCH', 'partner/venues/[id]', venue, t, { name: 'Volé' }),
            renvoyer: await routeId('POST', 'partner/venues/[id]/submit', venue, t),
            plan: await routeId('PUT', 'partner/venues/[id]/plan', venue, t, { enabled: false, tables: [{ id: table, x: 50, y: 50 }], zones: [] }),
            planDepuisLeSien: await routeId('PUT', 'partner/venues/[id]/plan', ownVenue, t, { enabled: false, tables: [{ id: table, x: 50, y: 50 }], zones: [{ id: zone, x: 1, y: 1, w: 10, h: 10 }] }),
            apercuFermeture: await closurePreview(stranger, venue, { start_date: dayFromNow(52), reason: 'Fermeture volée' }),
            fermer: await closureCreate(stranger, venue, { start_date: date, reason: 'Fermeture volée', expected_count: 1 }),
            retirerFermeture: await routeId('DELETE', 'partner/venues/closures/[id]', closureId, t),
            planning: await routeId('GET', 'partner/venues/[id]/planning', venue, t, undefined, `?date=${date}`),
            reservation: await routeId('GET', 'partner/tables/reservations/[id]', id, t),
            accepter: await partnerPatch(id, stranger, { action: 'ACCEPTER' }),
            refuser: await partnerPatch(id, stranger, { action: 'REFUSER', reason: 'Refus par une autre partenaire' }),
            annuler: await routeId('DELETE', 'partner/tables/reservations/[id]', id, t, { reason: 'Annulation par une autre partenaire' }),
            surPlace: await partnerPatch(id, stranger, { action: 'PAIEMENT_SUR_PLACE', amount: 1000, method: 'ESPECES' }),
            table: await routeId('PATCH', 'partner/tables/[id]', table, t, { capacity: 2, is_active: false }),
            supprimerTable: await routeId('DELETE', 'partner/tables/[id]', table, t),
            zone: await api('POST', 'partner/tables', { token: t, body: { type: 'zone', venue_id: venue, name: 'Zone volée' } }),
            nouvelleTable: await api('POST', 'partner/tables', { token: t, body: { venue_id: venue, table_number: 'X9', capacity: 2 } }),
        };
        const earnings = await api('GET', 'partner/tables/earnings', { token: t });
        const list = await api('GET', 'partner/venues', { token: t });
        trace('G1 autre partenaire', Object.fromEntries(Object.entries(tries).map(([k, r]) => [k, `${r.status} ${String(codeOf(r) ?? r.body.error ?? '')}`])));
        for (const [k, r] of Object.entries(tries)) assert.ok(r.status >= 400, `${k} : ${show(r)}`);
        assert.ok(!JSON.stringify(earnings.body).includes(id), 'recettes : rien de l’autre établissement');
        assert.ok(!JSON.stringify(list.body).includes(venue), 'liste : rien de l’autre établissement');
        assert.deepEqual((await sql(`SELECT name, photos, floor_plan_enabled FROM public.venues WHERE id = $1`, [venue]))[0], before0, 'établissement inchangé');
        assert.deepEqual((await sql(`SELECT plan_x, capacity, is_active FROM public.restaurant_tables WHERE id = $1`, [table]))[0], tBefore, 'table inchangée');
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, row.onsite_amount ?? null], ['EN_ATTENTE_ACCEPTATION', null], 'demande inchangée');
        assert.equal((await sql(`SELECT cancelled_at FROM public.venue_closures WHERE id = $1`, [closureId]))[0].cancelled_at, null, 'fermeture gardée');
        assert.equal(n((await sql(`SELECT count(*) AS c FROM public.restaurant_zones WHERE venue_id = $1`, [venue]))[0].c), 1, 'aucune zone ajoutée');
        // Ménage : la demande est refusée par sa propriétaire (remboursée en entier)
        assert.equal((await partnerPatch(id, owner, { action: 'REFUSER', reason: 'Fin du test de cloisonnement' })).status, 200);
    });
});

describe('G2. Cloisonnement des clients', () => {
    test('réservation d’un autre client : détail, aperçu, « J’arrive », annulation → 404 ; liste : les siennes seulement', async () => {
        const venue = await newVenue(owner);
        const table = await newTable(owner, venue, 4);
        const res = await reserveRpc(alice, venue, { date: dayFromNow(53), time: '20:00', guests: 2, tableId: table });
        const id = String(res.reservation_id);
        const tries = {
            detail: await routeId('GET', 'tables/reservations/[id]', id, bob.accessToken),
            apercu: await routeId('GET', 'tables/reservations/[id]/cancel-preview', id, bob.accessToken),
            arrive: await routeId('POST', 'tables/reservations/[id]/coming', id, bob.accessToken, {}),
            annuler: await routeId('POST', 'tables/reservations/[id]/cancel', id, bob.accessToken, {}),
            sansSession: await routeId('GET', 'tables/reservations/[id]', id, null),
        };
        const list = await api('GET', 'tables/reservations', { token: bob.accessToken });
        trace('G2 autre client', Object.fromEntries(Object.entries(tries).map(([k, r]) => [k, `${r.status} ${String(codeOf(r) ?? '')}`])));
        for (const [k, r] of Object.entries(tries)) assert.ok(r.status === 404 || r.status === 401, `${k} : ${show(r)}`);
        assert.ok(!JSON.stringify(list.body).includes(id), 'liste de bob sans la réservation d’alice');
        assert.equal((await reservation(id)).booking_state, 'CONFIRMEE');
        await releasePending(alice.userId);
    });
});

describe('G3. REST : clé anon et jeton de l’attaquant', () => {
    test('lectures : établissement non public, fermetures, réservations, paiements', async () => {
        const pending = await newVenue(owner, { validate: false });
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        const r = await paidOn(owner, venue, alice, 54);
        const closure = await closureCreate(owner, venue, { start_date: dayFromNow(55), reason: 'Peinture de la salle', expected_count: 0 });
        assert.equal(closure.status, 201, show(closure));
        const anon = restAs(null);
        const own = restAs(owner.accessToken);
        const other = restAs(stranger.accessToken);
        const client = restAs(alice.accessToken);
        const thief = restAs(bob.accessToken);
        const rows = async (q: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<string> => {
            const { data, error } = await q;
            return error ? `erreur ${error.message}` : String((data ?? []).length);
        };
        const out = {
            nonPublicAnon: await rows(anon.from('venues').select('id').eq('id', pending)),
            nonPublicTiers: await rows(other.from('venues').select('id').eq('id', pending)),
            tablesNonPublicTiers: await rows(other.from('restaurant_tables').select('id').eq('venue_id', pending)),
            fermeturesProprio: await rows(own.from('venue_closures').select('id').eq('venue_id', venue)),
            fermeturesAnon: await rows(anon.from('venue_closures').select('id')),
            reservationsProprio: await rows(own.from('table_reservations').select('id').eq('venue_id', venue)),
            reservationsTiers: await rows(thief.from('table_reservations').select('id').eq('id', r.id)),
            reservationsAnon: await rows(anon.from('table_reservations').select('id').eq('id', r.id)),
            paiementsProprio: await rows(own.from('payments').select('id').eq('table_reservation_id', r.id)),
            grandLivreProprio: await rows(own.from('finance_ledger').select('id').eq('partner_id', owner.partnerId)),
            saReservationClient: await rows(client.from('table_reservations').select('id, short_code').eq('id', r.id)),
        };
        trace('G3 lectures REST', out);
        for (const k of ['nonPublicAnon', 'nonPublicTiers', 'tablesNonPublicTiers', 'fermeturesProprio', 'fermeturesAnon', 'reservationsProprio',
            'reservationsTiers', 'reservationsAnon', 'paiementsProprio'] as const) {
            assert.ok(out[k] === '0' || out[k].startsWith('erreur'), `${k} : ${out[k]}`);
        }
        assert.equal(out.saReservationClient, '1', 'le client lit sa réservation');
    });

    test('écritures et fonctions : rien ne passe', async () => {
        const venue = await newVenue(owner);
        const table = await newTable(owner, venue, 4);
        const res = await reserveRpc(alice, venue, { date: dayFromNow(56), time: '20:00', guests: 2, tableId: table });
        const id = String(res.reservation_id);
        const own = restAs(owner.accessToken);
        const client = restAs(alice.accessToken);
        const anon = restAs(null);
        const before0 = (await sql(`SELECT photos, floor_plan_enabled FROM public.venues WHERE id = $1`, [venue]))[0];
        const writes = {
            photosParLaRest: (await own.from('venues').update({ photos: ['https://exemple.invalid/x.webp'], floor_plan_enabled: true }).eq('id', venue).select('id')),
            planParLaRest: (await own.from('restaurant_tables').update({ plan_x: 50, plan_y: 50 }).eq('id', table).select('id')),
            fermetureParLaRest: (await own.from('venue_closures').insert({ venue_id: venue, starts_at: `${dayFromNow(57)}T00:00:00`, ends_at: `${dayFromNow(58)}T00:00:00`, reason: 'Par la REST' }).select('id')),
            reservationParLaRest: (await client.from('table_reservations').update({ booking_state: 'ANNULEE_CLIENT', short_code: 'zzzzzzz' }).eq('id', id).select('id')),
        };
        const fns: Array<[string, Row]> = [
            ['venue_create', { p: { actor_id: owner.userId } }], ['venue_submit', { p: { actor_id: owner.userId, venue_id: venue } }],
            ['venue_plan_set', { p: { actor_id: owner.userId, venue_id: venue, tables: [] } }], ['venue_owner_refusal', { p_actor: owner.userId, p_venue_id: venue }],
            ['venue_closure_preview', { p: { actor_id: owner.userId, venue_id: venue, start_date: dayFromNow(57), reason: 'REST' } }],
            ['venue_closure_create', { p: { actor_id: owner.userId, venue_id: venue, start_date: dayFromNow(57), reason: 'REST', expected_count: 0 } }],
            ['venue_closure_delete', { p: { actor_id: owner.userId, closure_id: venue } }], ['venue_search', { p: {} }],
            ['venue_slots', { p: { venue_id: venue, date: dayFromNow(57), guests: 2 } }], ['venue_floor', { p: { venue_id: venue } }],
            ['table_cancel_preview', { p: { client_id: alice.userId, reservation_id: id } }], ['table_client_coming', { p: { client_id: alice.userId, reservation_id: id } }],
            ['table_partner_earnings', { p_actor: owner.userId }], ['table_quote', { p: { venue_id: venue, guests: 2 } }], ['table_short_code', {}],
        ];
        const calls: Record<string, string> = {};
        for (const [fn, args] of fns) {
            const a = await own.rpc(fn, args);
            const b = await anon.rpc(fn, args);
            calls[fn] = `${a.error ? 'refusé' : 'EXÉCUTÉ'} / ${b.error ? 'refusé' : 'EXÉCUTÉ'}`;
        }
        const summary = Object.fromEntries(Object.entries(writes).map(([k, w]) => [k, w.error ? `erreur ${w.error.code}` : `${(w.data ?? []).length} ligne(s)`]));
        trace('G3 écritures REST', summary);
        trace('G3 fonctions (propriétaire / anon)', calls);
        for (const [k, w] of Object.entries(writes)) assert.ok(w.error || (w.data ?? []).length === 0, `${k} : ${JSON.stringify(w.data)}`);
        for (const [fn, v] of Object.entries(calls)) assert.equal(v, 'refusé / refusé', fn);
        assert.deepEqual((await sql(`SELECT photos, floor_plan_enabled FROM public.venues WHERE id = $1`, [venue]))[0], before0);
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, row.short_code === 'zzzzzzz'], ['CONFIRMEE', false]);
        await releasePending(alice.userId);
    });
});

describe('G4. Fiche SUSPENDU : lecture seule, sauf l’exception voulue', () => {
    test('toutes les écritures refusées (403) ; demande payée acceptée par une fiche suspendue → refusée, client remboursé en entier', async () => {
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        const manual = await newVenue(owner, { deposit_per_person: 5_000, confirmation_mode: 'MANUELLE' });
        const table = await newTable(owner, venue, 4);
        const r = await paidOn(owner, venue, alice, 60);
        await shiftReservation(r.id, { startMinutes: -40 });
        const later = await paidOn(owner, venue, bob, 61);
        const ask = String((await reserveRpc(bob, manual, { date: dayFromNow(62), time: '20:00', guests: 4, tableId: await newTable(owner, manual, 4) })).reservation_id);
        await payConfirmed(bob, ask);
        const closure = await closureCreate(owner, venue, { start_date: dayFromNow(63), reason: 'Désinfection', expected_count: 0 });
        const closureId = String((closure.body.closure as Row).id);
        await setFiche(owner.partnerId, 'SUSPENDU');
        let tries: Record<string, Reply> = {};
        let accept: Reply | null = null;
        try {
            const t = owner.accessToken;
            tries = {
                modifier: await routeId('PATCH', 'partner/venues/[id]', venue, t, { name: 'Pendant la suspension' }),
                creer: await api('POST', 'partner/venues', { token: t, body: { name: 'Nouveau pendant la suspension' } }),
                plan: await routeId('PUT', 'partner/venues/[id]/plan', venue, t, { enabled: false, tables: [{ id: table, x: 1, y: 1 }], zones: [] }),
                fermer: await closureCreate(owner, venue, { start_date: dayFromNow(64), reason: 'Pendant la suspension', expected_count: 0 }),
                retirerFermeture: await routeId('DELETE', 'partner/venues/closures/[id]', closureId, t),
                renvoyer: await routeId('POST', 'partner/venues/[id]/submit', venue, t),
                table: await routeId('PATCH', 'partner/tables/[id]', table, t, { capacity: 2 }),
                arrive: await partnerPatch(r.id, owner, { action: 'ARRIVEE' }),
                annuler: await partnerPatch(later.id, owner, { action: 'ANNULER', reason: 'Annulation pendant la suspension' }),
                annulerDelete: await routeId('DELETE', 'partner/tables/reservations/[id]', later.id, t, { reason: 'Annulation pendant la suspension' }),
                surPlace: await partnerPatch(r.id, owner, { action: 'PAIEMENT_SUR_PLACE', amount: 5000, method: 'ESPECES' }),
            };
            accept = await partnerPatch(ask, owner, { action: 'ACCEPTER' });
        } finally {
            await setFiche(owner.partnerId, 'VALIDE');
        }
        const askRow = await reservation(ask);
        const outs = await cashoutsOf(ask);
        trace('G4 fiche suspendue', { ...Object.fromEntries(Object.entries(tries).map(([k, x]) => [k, `${x.status} ${String(codeOf(x) ?? '')}`])),
            acceptation: show(accept!), demande: { etat: askRow.booking_state, paye: askRow.paid_amount, rendu: askRow.refunded_amount, cashouts: outs.map((c) => c.amount) } });
        for (const [k, x] of Object.entries(tries)) assert.equal(x.status, 403, `${k} : ${show(x)}`);
        assert.notEqual(accept!.status, 200, show(accept!));
        assert.deepEqual([askRow.booking_state, n(askRow.refunded_amount)], ['REFUSEE', n(askRow.paid_amount)], 'demande refusée, remboursée en entier');
        assert.deepEqual(outs.map((c) => n(c.amount)), [21_000]);
        assert.deepEqual([(await reservation(r.id)).booking_state, (await reservation(later.id)).booking_state], ['CONFIRMEE', 'CONFIRMEE']);
        assert.equal((await sql(`SELECT cancelled_at FROM public.venue_closures WHERE id = $1`, [closureId]))[0].cancelled_at, null);
        // Ménage : réservations du test annulées par l'établissement (fiche de nouveau VALIDE)
        await partnerPatch(later.id, owner, { action: 'ANNULER', reason: 'Fin du test de la fiche suspendue' });
    });
});

describe('G5. Lien court /t/<code>', () => {
    test('sans session : 401 ; code d’autrui, inconnu ou mal formé : même 404 ; client et établissement : leur page', async () => {
        const venue = await newVenue(owner);
        const table = await newTable(owner, venue, 4);
        const id = String((await reserveRpc(alice, venue, { date: dayFromNow(65), time: '20:00', guests: 2, tableId: table })).reservation_id);
        const code = String((await reservation(id)).short_code);
        let unknown = 'zzzzzzz';
        for (const c of ['zzzzzzz', 'yyyyyyy', 'xxxxxxx']) {
            if ((await sql(`SELECT 1 FROM public.table_reservations WHERE short_code = $1`, [c])).length === 0) { unknown = c; break; }
        }
        const r = {
            anon: await linkRoute(code, null),
            client: await linkRoute(code, alice.accessToken),
            proprio: await linkRoute(code, owner.accessToken),
            autreClient: await linkRoute(code, bob.accessToken),
            autrePartenaire: await linkRoute(code, stranger.accessToken),
            inconnu: await linkRoute(unknown, bob.accessToken),
            malForme: await linkRoute('ABC\'--', bob.accessToken),
            majuscules: await linkRoute(code.toUpperCase(), bob.accessToken),
        };
        // Temps de réponse : code d'autrui (2 lectures) contre code inconnu (1 lecture), 15 essais chacun
        const time = async (c: string): Promise<number> => {
            const all: number[] = [];
            for (let i = 0; i < 15; i += 1) { const t0 = process.hrtime.bigint(); await linkRoute(c, bob.accessToken); all.push(Number(process.hrtime.bigint() - t0) / 1e6); }
            return all.sort((a, b) => a - b)[7];
        };
        const medians = { codeDAutrui: await time(code), codeInconnu: await time(unknown) };
        trace('G5 lien court', { ...Object.fromEntries(Object.entries(r).map(([k, x]) => [k, show(x)])), medianesMs: medians });
        assert.equal(r.anon.status, 401, show(r.anon));
        assert.deepEqual(r.client.body.target, `/tables/reservations/${id}`);
        assert.deepEqual(r.proprio.body.target, `/partner/tables/reservations/${id}`);
        for (const k of ['autreClient', 'autrePartenaire', 'inconnu', 'malForme', 'majuscules'] as const) {
            assert.equal(r[k].status, 404, `${k} : ${show(r[k])}`);
            assert.deepEqual(r[k].body, r.inconnu.body, `${k} : même réponse qu’un code inconnu`);
        }
        await releasePending(alice.userId);
    });
});

describe('G6. Argent des fermetures', () => {
    test('deux fermetures en même temps sur la même réservation : une seule passe, un seul remboursement de 21 000', async () => {
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        const r = await paidOn(owner, venue, alice, 66);
        const date = dayFromNow(66);
        const [c1, c2] = await Promise.all([
            closureCreate(owner, venue, { start_date: date, reason: 'Fermeture concurrente un', expected_count: 1 }),
            closureCreate(owner, venue, { start_date: date, start_time: '19:00', end_time: '23:00', reason: 'Fermeture concurrente deux', expected_count: 1 }),
        ]);
        const row = await reservation(r.id);
        const outs = await cashoutsOf(r.id);
        trace('G6a deux fermetures', { c1: show(c1), c2: show(c2), etat: row.booking_state, rendu: row.refunded_amount, cashouts: outs.map((c) => c.amount) });
        assert.equal([c1, c2].filter((c) => c.status === 201).length, 1, 'une seule fermeture');
        assert.deepEqual([row.booking_state, n(row.refunded_amount)], ['ANNULEE_ETABLISSEMENT', 21_000]);
        assert.deepEqual(outs.map((c) => n(c.amount)), [21_000], 'un seul remboursement');
    });

    test('fermeture et annulation du client en même temps : un seul remboursement', async () => {
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        const r = await paidOn(owner, venue, bob, 67);
        const [closure, cancel] = await Promise.all([
            closureCreate(owner, venue, { start_date: dayFromNow(67), reason: 'Fermeture pendant une annulation', expected_count: 1 }),
            routeId('POST', 'tables/reservations/[id]/cancel', r.id, bob.accessToken, {}),
        ]);
        const row = await reservation(r.id);
        const outs = await cashoutsOf(r.id);
        trace('G6b fermeture + annulation', { fermeture: show(closure), annulation: show(cancel), etat: row.booking_state, rendu: row.refunded_amount, cashouts: outs.map((c) => c.amount) });
        assert.equal(n(row.refunded_amount), 21_000);
        assert.deepEqual(outs.map((c) => n(c.amount)), [21_000], 'un seul remboursement');
    });

    test('attente de paiement touchée par la fermeture : annulée ; le paiement arrivé ensuite est rendu en entier', async () => {
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        const table = await newTable(owner, venue, 4);
        const id = String((await reserveRpc(alice, venue, { date: dayFromNow(68), time: '20:00', guests: 4, tableId: table })).reservation_id);
        const payment = await started(alice, id);
        const preview = await closurePreview(owner, venue, { start_date: dayFromNow(68), reason: 'Coupure de courant' });
        const p = preview.body.preview as Row;
        const created = await closureCreate(owner, venue, { start_date: dayFromNow(68), reason: 'Coupure de courant', expected_count: n(p.count) });
        assert.equal(created.status, 201, show(created));
        await confirmByWebhook(payment);
        const row = await reservation(id);
        const outs = await cashoutsOf(id);
        trace('G6c attente touchée puis payée', { apercu: { count: p.count, refundTotal: p.refundTotal }, fermeture: created.body.closure, etat: row.booking_state, paye: row.paid_amount, cashouts: outs.map((c) => c.amount) });
        assert.equal(n(p.count), 1, 'l’attente en cours est dans l’aperçu');
        assert.equal(row.booking_state, 'ANNULEE_ETABLISSEMENT', 'la réservation reste annulée');
        assert.deepEqual(outs.map((c) => n(c.amount)), [21_000], 'paiement arrivé trop tard rendu en entier, une fois');
    });
});

describe('G7. Délais : 2 h et 30 min', () => {
    test('demande sans réponse à l’échéance : deux tâches et l’acceptation en même temps → « Sans réponse », remboursée une fois', async () => {
        const manual = await newVenue(owner, { deposit_per_person: 5_000, confirmation_mode: 'MANUELLE' });
        const table = await newTable(owner, manual, 4);
        const id = String((await reserveRpc(alice, manual, { date: dayFromNow(69), time: '20:00', guests: 4, tableId: table })).reservation_id);
        await payConfirmed(alice, id);
        await shiftReservation(id, { responseMinutes: -1 });
        const [, , accept] = await Promise.all([tick(), tick(), partnerPatch(id, owner, { action: 'ACCEPTER' })]);
        const row = await reservation(id);
        const outs = await cashoutsOf(id);
        trace('G7a sans réponse', { acceptation: show(accept), etat: row.booking_state, rendu: row.refunded_amount, cashouts: outs.map((c) => c.amount) });
        assert.notEqual(accept.status, 200, show(accept));
        assert.deepEqual([row.booking_state, n(row.refunded_amount)], ['SANS_REPONSE', 21_000]);
        assert.deepEqual(outs.map((c) => n(c.amount)), [21_000]);
    });

    test('absence à 31 min : deux tâches et « Client absent » en même temps → absent une fois, acompte gardé, aucun remboursement', async () => {
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        const r = await paidOn(owner, venue, bob, 70);
        await shiftReservation(r.id, { startMinutes: -31 });
        const [, , absent] = await Promise.all([tick(), tick(), partnerPatch(r.id, owner, { action: 'ABSENT' })]);
        const row = await reservation(r.id);
        const notices = await sql(`SELECT channel FROM public.notification_outbox WHERE type = 'TABLE_NO_SHOW' AND template_data->>'reservation_id' = $1`, [r.id]);
        trace('G7b absence', { absent: show(absent), etat: row.booking_state, rendu: row.refunded_amount, cashouts: (await cashoutsOf(r.id)).length, avis: notices.map((x) => x.channel) });
        assert.deepEqual([row.booking_state, n(row.refunded_amount)], ['ABSENT', 0]);
        assert.equal((await cashoutsOf(r.id)).length, 0);
        assert.equal(notices.length, new Set(notices.map((x) => x.channel)).size, 'un avis par canal, pas deux');
    });
});

describe('G8. Créneaux', () => {
    test('cinq clients sur la même table au même créneau en même temps : une seule réservation', async () => {
        const venue = await newVenue(owner);
        const table = await newTable(owner, venue, 4);
        const buyers = await Promise.all([1, 2, 3, 4, 5].map((i) => newBuyer(`cv11b-2-course-${i}`)));
        const date = dayFromNow(71);
        const results = await Promise.all(buyers.map((b) => reserveRpc(b, venue, { date, time: '20:00', guests: 2, tableId: table })));
        trace('G8a course', results.map((x) => x.ok ? 'ok' : x.code));
        assert.equal(results.filter((x) => x.ok).length, 1, JSON.stringify(results));
        assert.equal(n((await sql(`SELECT count(*) AS c FROM public.table_reservations WHERE table_id = $1 AND status::text IN ('EN_ATTENTE','CONFIRMEE')`, [table]))[0].c), 1);
        for (const b of buyers) await releasePending(b.userId);
    });

    test('même client, même établissement, même créneau, deux tables : refusé ; 4e réservation non payée : refusée', async () => {
        const carol = await newBuyer('cv11b-2-carol');
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        const t1 = await newTable(owner, venue, 4);
        const t2 = await newTable(owner, venue, 4);
        const date = dayFromNow(72);
        const first = await reserveRpc(carol, venue, { date, time: '20:00', guests: 2, tableId: t1 });
        const second = await reserveRpc(carol, venue, { date, time: '20:30', guests: 2, tableId: t2 });
        const holds = [first];
        for (const d of [73, 74]) holds.push(await reserveRpc(carol, venue, { date: dayFromNow(d), time: '20:00', guests: 2, tableId: t1 }));
        const fourth = await reserveRpc(carol, venue, { date: dayFromNow(75), time: '20:00', guests: 2, tableId: t1 });
        trace('G8b limites du client', { premiere: first.ok, memeCreneau: second.code, troisNonPayees: holds.map((h) => h.ok), quatrieme: fourth.code });
        assert.equal(first.ok, true, JSON.stringify(first));
        assert.equal(second.ok, false, JSON.stringify(second));
        assert.ok(holds.every((h) => h.ok === true), JSON.stringify(holds));
        assert.equal(fourth.ok, false, JSON.stringify(fourth));
        await releasePending(carol.userId);
    });

    test('en base : fermeture exceptionnelle et horaires respectés (fonction, route, paiement d’une attente échue)', async () => {
        const dan = await newBuyer('cv11b-2-dan');
        const venue = await newVenue(owner, { deposit_per_person: 5_000, hours: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens_at: '12:00', closes_at: '23:00' })) });
        const table = await newTable(owner, venue, 4);
        const holdDay = dayFromNow(76);
        const hold = String((await reserveRpc(dan, venue, { date: holdDay, time: '20:00', guests: 4, tableId: table })).reservation_id);
        await shiftReservation(hold, { holdMinutes: -1 });
        const created = await closureCreate(owner, venue, { start_date: holdDay, reason: 'Fermeture pour travaux', expected_count: 0 });
        assert.equal(created.status, 201, show(created));
        const rpc = await reserveRpc(alice, venue, { date: holdDay, time: '13:00', guests: 2 });
        const route = await reserveRoute(alice, { venueId: venue, date: holdDay, time: '13:00', guests: 2 });
        const late = await reserveRpc(alice, venue, { date: dayFromNow(77), time: '23:30', guests: 2 });
        const pay = await startPayment(dan, hold);
        trace('G8c fermeture et horaires en base', { fonction: rpc.code, route: `${route.status} ${String(route.body.code)}`, horsHoraires: late.code, paiementAttenteEchue: `${pay.status} ${String(pay.body.code ?? pay.body.error)}` });
        assert.equal(rpc.code, 'VENUE_CLOSED');
        assert.notEqual(route.status, 201, JSON.stringify(route.body));
        assert.equal(late.code, 'OUTSIDE_HOURS');
        assert.notEqual(pay.status, 201, JSON.stringify(pay.body));
        assert.equal((await reservation(hold)).paid_amount, 0);
        await releasePending(dan.userId);
    });
});

describe('G9. Service fermé (décision du 20/11)', () => {
    test('catalogue, nouvelle réservation, création et modification fermés ; réservation existante ouverte', async () => {
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        const table = await newTable(owner, venue, 4);
        const r = await paidOn(owner, venue, alice, 78);
        const hold = String((await reserveRpc(bob, venue, { date: dayFromNow(79), time: '20:00', guests: 4, tableId: table })).reservation_id);
        const code = String((await reservation(r.id)).short_code);
        const closed: Record<string, Reply | Row> = {};
        const open: Record<string, Reply> = {};
        await withFeatureFlags({ tables: false }, async () => {
            closed.recherche = await api('GET', 'tables', { path: '/api/tables' });
            closed.fiche = await routeId('GET', 'tables/[id]', venue, null);
            closed.pastilles = await api('GET', 'tables/[id]/slots', { params: { id: venue }, path: `/api/tables/${venue}/slots?date=${dayFromNow(80)}&guests=2` });
            closed.plan = await api('GET', 'tables/[id]/floor', { params: { id: venue }, path: `/api/tables/${venue}/floor` });
            closed.devis = await api('GET', 'tables/[id]/quote', { params: { id: venue }, path: `/api/tables/${venue}/quote?guests=2` });
            closed.reserverRoute = await reserveRoute(bob, { venueId: venue, date: dayFromNow(80), time: '20:00', guests: 2 }) as Reply;
            closed.reserverFonction = await reserveRpc(bob, venue, { date: dayFromNow(80), time: '20:00', guests: 2 });
            closed.payerAttente = await startPayment(bob, hold) as unknown as Reply;
            closed.creer = await api('POST', 'partner/venues', { token: owner.accessToken, body: { name: 'Service fermé' } });
            closed.modifier = await routeId('PATCH', 'partner/venues/[id]', venue, owner.accessToken, { name: 'Service fermé' });
            closed.planSalle = await routeId('PUT', 'partner/venues/[id]/plan', venue, owner.accessToken, { enabled: false, tables: [], zones: [] });
            closed.fermer = await closureCreate(owner, venue, { start_date: dayFromNow(81), reason: 'Service fermé', expected_count: 0 });
            closed.table = await api('POST', 'partner/tables', { token: owner.accessToken, body: { venue_id: venue, table_number: 'SF', capacity: 2 } });
            closed.modifierTable = await routeId('PATCH', 'partner/tables/[id]', table, owner.accessToken, { capacity: 2 });
            open.mesReservations = await api('GET', 'tables/reservations', { token: alice.accessToken });
            open.detail = await routeId('GET', 'tables/reservations/[id]', r.id, alice.accessToken);
            open.apercu = await routeId('GET', 'tables/reservations/[id]/cancel-preview', r.id, alice.accessToken);
            open.lien = await linkRoute(code, alice.accessToken);
            open.planning = await routeId('GET', 'partner/venues/[id]/planning', venue, owner.accessToken, undefined, `?date=${dayFromNow(78)}`);
            open.detailPro = await routeId('GET', 'partner/tables/reservations/[id]', r.id, owner.accessToken);
            open.recettes = await api('GET', 'partner/tables/earnings', { token: owner.accessToken });
            open.annuler = await routeId('POST', 'tables/reservations/[id]/cancel', r.id, alice.accessToken, {});
        });
        const fmt = (x: Reply | Row): string => ('status' in x ? `${String(x.status)} ${String((x as Reply).body?.code ?? '')}` : String((x as Row).code));
        trace('G9 service fermé', { fermes: Object.fromEntries(Object.entries(closed).map(([k, x]) => [k, fmt(x)])), ouverts: Object.fromEntries(Object.entries(open).map(([k, x]) => [k, x.status])) });
        for (const [k, x] of Object.entries(closed)) {
            if ('status' in x) assert.equal((x as Reply).status, 404, `${k} : ${JSON.stringify(x)}`);
            else assert.equal((x as Row).code, 'SERVICE_CLOSED', `${k} : ${JSON.stringify(x)}`);
        }
        for (const [k, x] of Object.entries(open)) assert.equal(x.status, 200, `${k} : ${show(x)}`);
        assert.equal((await reservation(hold)).paid_amount, 0);
        await releasePending(bob.userId);
    });
});

describe('G10. Données des clients', () => {
    test('prénom et initiale partout ; téléphone seulement pour une table tenue ; avis sans nom de famille ni numéro', async () => {
        const venue = await newVenue(owner, { deposit_per_person: 5_000 });
        const date = dayFromNow(82);
        const paid = await paidOn(owner, venue, alice, 82);
        const table = await newTable(owner, venue, 4);
        const holding = String((await reserveRpc(bob, venue, { date, time: '20:00', guests: 4, tableId: table })).reservation_id);
        const planning = await routeId('GET', 'partner/venues/[id]/planning', venue, owner.accessToken, undefined, `?date=${date}`);
        const byId = Object.fromEntries(((planning.body.reservations as Row[]) ?? []).map((x) => [x.id, x.client as Row]));
        const holdDetail = await routeId('GET', 'partner/tables/reservations/[id]', holding, owner.accessToken);
        const preview = await closurePreview(owner, venue, { start_date: date, reason: 'Contrôle des données' });
        const outbox = await sql(`SELECT type, channel, template_data::text AS d FROM public.notification_outbox
                                   WHERE recipient_user_id = $1 AND template_data->>'reservation_id' = $2`, [owner.userId, paid.id]);
        // Le téléphone d'alice (réservation confirmée) est attendu au planning : il est cherché partout ailleurs
        const elsewhere = JSON.stringify({ holdDetail: holdDetail.body, preview: preview.body, outbox });
        const inPlanning = JSON.stringify(planning.body);
        trace('G10 données', { payee: byId[paid.id], attente: byId[holding], attenteDetail: (holdDetail.body.reservation as Row).client, apercu: ((preview.body.preview as Row).reservations as Row[]).map((x) => x.client_name), avis: outbox.map((o) => `${String(o.type)}:${String(o.channel)}`) });
        assert.equal(byId[paid.id].name, 'Awa N.');
        assert.ok(byId[paid.id].phone, 'réservation confirmée : téléphone');
        assert.equal(byId[holding].phone, null, 'attente de paiement : aucun téléphone');
        assert.equal(((holdDetail.body.reservation as Row).client as Row).phone, null);
        for (const leak of [alice.lastName, bob.lastName, alice.phone9, bob.phone9, alice.email, bob.email]) assert.ok(!elsewhere.includes(leak), `donnée exposée (détail, aperçu, avis) : ${leak}`);
        for (const leak of [alice.lastName, bob.lastName, bob.phone9, alice.email, bob.email]) assert.ok(!inPlanning.includes(leak), `donnée exposée (planning) : ${leak}`);
        assert.ok(outbox.length > 0, 'avis à l’établissement présents');
        await releasePending(bob.userId);
    });

    test('administration : file et fiche avec halls.validate seulement ; contacts de la partenaire avec partners.read seulement', async () => {
        const venue = await newVenue(owner, { validate: false });
        const validator = await newAdmin('cv11b-valide', ['halls.validate']);
        const reader = await newAdmin('cv11b-lecteur', ['halls.validate', 'partners.read']);
        const weak = await newAdmin('cv11b-faible', ['partners.read', 'events.write']);
        const r = {
            fileSansDroit: await api('GET', 'admin/venues', { token: weak.accessToken }),
            ficheSansDroit: await routeId('GET', 'admin/venues/[id]', venue, weak.accessToken),
            fileClient: await api('GET', 'admin/venues', { token: alice.accessToken }),
            fiche: await routeId('GET', 'admin/venues/[id]', venue, validator.accessToken),
            ficheContacts: await routeId('GET', 'admin/venues/[id]', venue, reader.accessToken),
        };
        const partner = ((r.fiche.body.venue as Row | undefined)?.partner as Row | undefined) ?? {};
        const partner2 = ((r.ficheContacts.body.venue as Row | undefined)?.partner as Row | undefined) ?? {};
        trace('G10 administration', { fileSansDroit: r.fileSansDroit.status, ficheSansDroit: r.ficheSansDroit.status, fileClient: r.fileClient.status, contactsSansDroit: [partner.phone, partner.email], contactsAvecDroit: [Boolean(partner2.phone), Boolean(partner2.email)] });
        assert.equal(r.fileSansDroit.status, 403);
        assert.equal(r.ficheSansDroit.status, 403);
        assert.ok(r.fileClient.status === 401 || r.fileClient.status === 403, show(r.fileClient));
        assert.deepEqual([partner.phone, partner.email], [null, null]);
        assert.ok(partner2.phone, show(r.ficheContacts));
    });
});

describe('G11. Validation : ni visible ni réservable', () => {
    test('en attente, refusé, suspendu, partenaire suspendue : fiche 404, absente de la recherche, réservation refusée, REST anon vide ; refusé modifié reste refusé', async () => {
        const third = await newPartner('cv11b-2-tiers');
        const cases: Record<string, string> = {
            enAttente: await newVenue(owner, { validate: false }),
            refuse: await newVenue(owner, { validate: false }),
            suspendu: await newVenue(owner),
            partenaireSuspendue: await newVenue(third),
        };
        for (const v of Object.values(cases)) await newTable(v === cases.partenaireSuspendue ? third : owner, v, 4);
        assert.equal((await decideVenue(cases.refuse, 'REFUSER', 'Photos manquantes et adresse floue')).ok, true);
        assert.equal((await decideVenue(cases.suspendu, 'SUSPENDRE', 'Contrôle d’hygiène en cours')).ok, true);
        await setFiche(third.partnerId, 'SUSPENDU');
        const out: Record<string, Row> = {};
        try {
            for (const [k, v] of Object.entries(cases)) {
                const { data: nameRow } = await service.from('venues').select('name').eq('id', v).single();
                const sheet = await routeId('GET', 'tables/[id]', v, alice.accessToken);
                const search = await api('GET', 'tables', { path: `/api/tables?q=${encodeURIComponent(String(nameRow!.name))}` });
                const slots = await api('GET', 'tables/[id]/slots', { params: { id: v }, path: `/api/tables/${v}/slots?date=${dayFromNow(83)}&guests=2` });
                const book = await reserveRpc(alice, v, { date: dayFromNow(83), time: '20:00', guests: 2 });
                const anon = await restAs(null).from('venues').select('id').eq('id', v);
                out[k] = { fiche: sheet.status, recherche: ((search.body.venues as Row[]) ?? []).some((x) => x.id === v), pastilles: slots.status, reserver: book.ok ? 'ok' : book.code, restAnon: (anon.data ?? []).length };
            }
        } finally {
            await setFiche(third.partnerId, 'VALIDE');
        }
        const patch = await routeId('PATCH', 'partner/venues/[id]', cases.refuse, owner.accessToken, { name: 'Renommé après refus' });
        const after0 = (await sql(`SELECT validation_status FROM public.venues WHERE id = $1`, [cases.refuse]))[0].validation_status;
        trace('G11 validation', { ...out, refuseModifie: `${patch.status} → ${String(after0)}` });
        for (const [k, o] of Object.entries(out)) {
            assert.equal(o.fiche, 404, `${k} fiche`);
            assert.equal(o.recherche, false, `${k} recherche`);
            assert.equal(o.pastilles, 404, `${k} pastilles`);
            assert.notEqual(o.reserver, 'ok', `${k} réservation`);
            assert.equal(o.restAnon, 0, `${k} REST`);
        }
        assert.equal(after0, 'REFUSEE');
    });
});

describe('G12. Photos et plan', () => {
    test('photos : dossier d’une autre partenaire, adresse extérieure, nom non réencodé → refusées, rien d’écrit', async () => {
        const venue = await newVenue(owner);
        await newTable(owner, venue, 4);
        const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
        const before0 = (await sql(`SELECT photos FROM public.venues WHERE id = $1`, [venue]))[0].photos;
        const attempts: Record<string, string[]> = {
            autrePartenaire: [photoOf(stranger.partnerId)],
            exterieure: ['https://exemple.invalid/photo.webp'],
            nomBrut: [`${base}/storage/v1/object/public/public-images/venues/${owner.partnerId}/photo-originale.png`],
            remontee: [`${base}/storage/v1/object/public/public-images/venues/${owner.partnerId}/../${stranger.partnerId}/1700000000000_abcd1234.webp`],
            affiche: [`${base}/storage/v1/object/public/public-images/posters/${owner.partnerId}/1700000000000_abcd1234.webp`],
        };
        const results: Record<string, Reply> = {};
        for (const [k, photos] of Object.entries(attempts)) results[k] = await routeId('PATCH', 'partner/venues/[id]', venue, owner.accessToken, { photos });
        const create = await api('POST', 'partner/venues', { token: owner.accessToken, body: {
            name: 'Photo d’autrui', address: 'Plateau', city: 'Dakar', photos: attempts.autrePartenaire,
            hours: [{ weekday: 1, opens_at: '10:00', closes_at: '22:00' }], tables: [{ number: '1', capacity: 2 }],
        } });
        trace('G12a photos', { ...Object.fromEntries(Object.entries(results).map(([k, x]) => [k, `${x.status} ${String(codeOf(x) ?? '')}`])), creation: `${create.status} ${String(codeOf(create))}` });
        for (const [k, x] of Object.entries(results)) assert.equal(x.status, 400, `${k} : ${show(x)}`);
        assert.equal(create.status, 400, show(create));
        assert.deepEqual((await sql(`SELECT photos FROM public.venues WHERE id = $1`, [venue]))[0].photos, before0);
    });

    test('plan : positions hors cadre refusées (route et base) ; plan d’un autre établissement refusé', async () => {
        const venue = await newVenue(owner);
        const zone = await newZone(owner, venue, 'Terrasse');
        const table = await newTable(owner, venue, 4);
        const tries = {
            xTropGrand: await routeId('PUT', 'partner/venues/[id]/plan', venue, owner.accessToken, { enabled: true, tables: [{ id: table, x: 101, y: 10 }], zones: [] }),
            negatif: await routeId('PUT', 'partner/venues/[id]/plan', venue, owner.accessToken, { enabled: true, tables: [{ id: table, x: -1, y: 10 }], zones: [] }),
            zoneDeborde: await routeId('PUT', 'partner/venues/[id]/plan', venue, owner.accessToken, { enabled: false, tables: [], zones: [{ id: zone, x: 60, y: 10, w: 50, h: 20 }] }),
            rotation: await routeId('PUT', 'partner/venues/[id]/plan', venue, owner.accessToken, { enabled: true, tables: [{ id: table, x: 10, y: 10, rotation: 7 }], zones: [] }),
            forme: await routeId('PUT', 'partner/venues/[id]/plan', venue, owner.accessToken, { enabled: true, tables: [{ id: table, x: 10, y: 10, shape: 'ETOILE' }], zones: [] }),
            autreEtablissement: await routeId('PUT', 'partner/venues/[id]/plan', venue, stranger.accessToken, { enabled: true, tables: [{ id: table, x: 10, y: 10 }], zones: [] }),
        };
        const [t] = await sql(`SELECT plan_x, plan_y, plan_rotation, plan_shape FROM public.restaurant_tables WHERE id = $1`, [table]);
        const [z] = await sql(`SELECT plan_x, plan_w FROM public.restaurant_zones WHERE id = $1`, [zone]);
        trace('G12b plan', { ...Object.fromEntries(Object.entries(tries).map(([k, x]) => [k, `${x.status} ${String(codeOf(x) ?? '')}`])), table: t, zone: z });
        for (const [k, x] of Object.entries(tries)) assert.ok(x.status === 400 || x.status === 404, `${k} : ${show(x)}`);
        assert.deepEqual([t.plan_x, t.plan_rotation, t.plan_shape, z.plan_x], [null, 0, 'CARREE', null], 'rien d’écrit');
    });
});
