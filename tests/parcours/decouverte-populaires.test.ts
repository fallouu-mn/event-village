/**
 * Lot 9, tâche 9.1 (contrat 3.1 M3, 4.2, 5.2 ; L20, L21, AR12) — « Populaires » : classement exact sur des données
 * fabriquées. La base de test est commune aux suites : le top 10 global est pollué par les autres. Chaque cas
 * appelle donc la RPC avec une grande limite (p_limit := 100000) et ne lit que les événements de la suite.
 *  - tous canaux sauf INVITATION (FREE, ONLINE, COUNTER comptés) ; VALIDE et UTILISE ; fenêtre de 168 h ;
 *  - PUBLIE non terminé seulement ; départage : ventes décroissantes, début le plus proche, id ;
 *  - défaut : exactement 10 lignes (13 événements propres éligibles) ;
 *  - route : public (middleware, rappel A41), 10 au plus, aucune donnée personnelle ni `sold`, ordre de la RPC,
 *    panne : 500 POPULAR_UNAVAILABLE, jamais gardée.
 * Les états qu'un test ne peut pas laisser en base (billet remboursé sans remboursement, événement annulé qui
 * garde ses billets, âge de billet) sont posés dans des transactions annulées (inRolledBackTransaction), triggers
 * coupés dans la transaction : la RPC y lit la même transaction.
 * Les cas d'échec de la route passent avant le premier succès : un succès resterait 60 s dans le cache du module.
 *
 * Rouge avant correctif : la RPC events_popular et la route n'existent pas (message PostgREST, ou échec qui les
 * nomme) ; après les tests, assertLot9Invariants reste rouge tant que M2 et M4 ne sont pas livrés. Cas déjà vert,
 * signalé au commit : le passage du middleware (préfixe public /api/events).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import type { Client } from 'pg';
import { GET as eventsRoute } from '../../app/api/events/route';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { callMiddleware } from '../helpers/middleware';
import { createTimedEvent } from './acces-helpers';
import { buyConfirmed, createPartnerEvent, newPartner, type TestPartner } from './finance-helpers';
import { BASE_URL } from './helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { issueFreeTicket } from './terrain-helpers';

const ALL = 100000;
const CATEGORY = 'Entrée';
const FREE_CATEGORIES = [{ name: CATEGORY, price: 0, total: 40 }];
const MARK = randomUUID().replace(/-/g, '').slice(0, 8);

interface Fixture { eventId: string; categoryId: string; ticketIds: string[] }
interface PopularRow { event_id: string; sold: number }

let partner: TestPartner;
let holder: Buyer;

let fort: Fixture;
let moyen: Fixture;
let egalProche: Fixture;
let egalLoin: Fixture;
let faible: Fixture;
let memeDebut: Fixture[];
let fenetre: Fixture;
let etats: Fixture;
let statuts: Fixture;
let mixte: Fixture;
let invitationsSeules: Fixture;
let fini: Fixture;
let sansBillet: Fixture;
let enLigne: Fixture;

async function freeEvent(label: string, tickets: number, daysFromNow?: number): Promise<Fixture> {
    const ev = await createPartnerEvent(partner.partnerId, `popu-${MARK}-${label}`, FREE_CATEGORIES, daysFromNow === undefined ? {} : { daysFromNow });
    const categoryId = ev.categories[CATEGORY].id;
    const ticketIds: string[] = [];
    for (let i = 0; i < tickets; i++) ticketIds.push(await issueFreeTicket(ev.eventId, categoryId, holder));
    return { eventId: ev.eventId, categoryId, ticketIds };
}

before(async () => {
    partner = await newPartner(`popu-${MARK}`);
    holder = await newBuyer('popu-porteur');

    fort = await freeEvent('fort', 4, 30);
    moyen = await freeEvent('moyen', 2, 30);
    egalProche = await freeEvent('egal-proche', 2, 20);
    egalLoin = await freeEvent('egal-loin', 2, 40);
    faible = await freeEvent('faible', 1, 30);

    // Départage par id : même début exact pour les trois, posé après coup (aucune dépendance à minuit).
    memeDebut = [await freeEvent('id-1', 1), await freeEvent('id-2', 1), await freeEvent('id-3', 1)];
    const date = new Date(Date.now() + 50 * 86_400_000).toISOString().slice(0, 10);
    const { error } = await service.from('events')
        .update({ start_date: date, start_time: '20:00:00', end_date: date, end_time: '23:00:00' })
        .in('id', memeDebut.map((f) => f.eventId));
    assert.equal(error, null, `même début : ${error?.message}`);

    fenetre = await freeEvent('fenetre', 3);
    etats = await freeEvent('etats', 5);
    statuts = await freeEvent('statuts', 2);

    mixte = await freeEvent('mixte', 2);
    for (let i = 0; i < 3; i++) await issueFreeTicket(mixte.eventId, mixte.categoryId, holder, { saleChannel: 'INVITATION' });

    invitationsSeules = await freeEvent('invit-seules', 0);
    for (let i = 0; i < 2; i++) await issueFreeTicket(invitationsSeules.eventId, invitationsSeules.categoryId, holder, { saleChannel: 'INVITATION' });

    sansBillet = await freeEvent('sans-billet', 0);

    const finished = await createTimedEvent(partner.partnerId, `popu-${MARK}-fini`, FREE_CATEGORIES, { startsInHours: -72, durationHours: 1, status: 'PUBLIE' });
    fini = { eventId: finished.eventId, categoryId: finished.categories[CATEGORY].id, ticketIds: [] };
    fini.ticketIds.push(await issueFreeTicket(fini.eventId, fini.categoryId, holder));

    const online = await createPartnerEvent(partner.partnerId, `popu-${MARK}-en-ligne`, [{ name: 'Standard', price: 2000, total: 20 }]);
    const bought = await buyConfirmed(holder, online, [['Standard', 2]]);
    assert.equal(bought.tickets.length, 2, 'précondition : deux billets ONLINE');
    enLigne = { eventId: online.eventId, categoryId: online.categories.Standard.id, ticketIds: bought.tickets.map((t) => String(t.id)) };
});

after(async () => {
    await assertLot9Invariants('decouverte-populaires');
});

/** Appel réel de la RPC par le service_role, comme la route. */
async function popular(limit?: number): Promise<PopularRow[]> {
    const { data, error } = limit === undefined
        ? await service.rpc('events_popular')
        : await service.rpc('events_popular', { p_limit: limit });
    assert.equal(error, null, `events_popular : ${error?.message} (code ${error?.code})`);
    assert.ok(Array.isArray(data), `events_popular : réponse inattendue ${JSON.stringify(data)}`);
    return (data as Array<{ event_id: string; sold: number | string }>).map((r) => ({ event_id: String(r.event_id), sold: Number(r.sold) }));
}

const own = (rows: PopularRow[], fixtures: Fixture[]): PopularRow[] => {
    const ids = new Set(fixtures.map((f) => f.eventId));
    return rows.filter((r) => ids.has(r.event_id));
};

/** Ventes de l'événement dans la transaction ; null : absent du classement. */
async function soldIn(db: Client, eventId: string): Promise<number | null> {
    const { rows } = await db.query<{ sold: string }>('SELECT sold FROM public.events_popular($1) WHERE event_id = $2', [ALL, eventId]);
    return rows.length === 0 ? null : Number(rows[0].sold);
}

/** Échec nommé si la fonction manque, avant toute écriture ; puis triggers utilisateur coupés dans la transaction. */
async function prepare(db: Client, tables: string[]): Promise<void> {
    const { rows } = await db.query(
        `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'events_popular'`);
    assert.equal(rows.length, 1, 'fonction public.events_popular absente (migration M3, contrat 5.2)');
    for (const table of tables) await db.query(`ALTER TABLE public.${table} DISABLE TRIGGER USER`);
}

const age = (db: Client, ticketId: string, interval: string): Promise<unknown> =>
    db.query('UPDATE public.tickets SET created_at = now() - $2::interval WHERE id = $1', [ticketId, interval]);

const setStatus = (db: Client, ticketId: string, status: string): Promise<unknown> =>
    db.query('UPDATE public.tickets SET status = $2 WHERE id = $1', [ticketId, status]);

async function addTicket(db: Client, f: Fixture, channel: 'FREE' | 'COUNTER', userId: string | null, price: number): Promise<void> {
    const id = randomUUID();
    await db.query(
        `INSERT INTO public.tickets (id, event_id, category_id, user_id, ticket_number, price, qr_code, status, sale_channel)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'VALIDE', $8)`,
        [id, f.eventId, f.categoryId, userId, `TCK-POPU-${id.slice(0, 8)}`, price, `EV-QR-POPU-${id}`, channel]);
}

describe('events_popular : classement exact', () => {
    test('ordre et comptes exacts sur la sous-liste de la suite', async () => {
        const rows = own(await popular(ALL), [fort, moyen, egalProche, egalLoin, faible, ...memeDebut]);
        const idOrder = memeDebut.map((f) => f.eventId).sort();
        assert.deepEqual(rows, [
            { event_id: fort.eventId, sold: 4 },
            { event_id: egalProche.eventId, sold: 2 },
            { event_id: moyen.eventId, sold: 2 },
            { event_id: egalLoin.eventId, sold: 2 },
            { event_id: faible.eventId, sold: 1 },
            ...idOrder.map((event_id) => ({ event_id, sold: 1 })),
        ]);
    });

    test('à ventes égales, le début le plus proche passe devant', async () => {
        const rows = own(await popular(ALL), [egalLoin, egalProche]);
        assert.deepEqual(rows.map((r) => r.event_id), [egalProche.eventId, egalLoin.eventId]);
    });

    test('à ventes et début égaux, l’id départage', async () => {
        const rows = own(await popular(ALL), memeDebut);
        assert.deepEqual(rows.map((r) => r.event_id), memeDebut.map((f) => f.eventId).sort());
    });

    test('un événement sans vente n’apparaît pas', async () => {
        assert.deepEqual(own(await popular(ALL), [sansBillet]), []);
    });
});

describe('events_popular : ce qui compte', () => {
    test('fenêtre de 168 h : 6 j 23 h compté, 7 j 1 h non', async () => {
        await inRolledBackTransaction(async (db) => {
            await prepare(db, ['tickets']);
            assert.equal(await soldIn(db, fenetre.eventId), 3, 'témoin : trois billets récents');
            await age(db, fenetre.ticketIds[1], '6 days 23 hours');
            await age(db, fenetre.ticketIds[2], '7 days 1 hour');
            assert.equal(await soldIn(db, fenetre.eventId), 2, 'seul le billet de plus de 168 h sort');
            await age(db, fenetre.ticketIds[0], '7 days 1 hour');
            await age(db, fenetre.ticketIds[1], '7 days 1 hour');
            assert.equal(await soldIn(db, fenetre.eventId), null, 'événement absent quand tout est hors fenêtre');
        });
    });

    test('UTILISE compté ; ANNULE et REMBOURSE non', async () => {
        await inRolledBackTransaction(async (db) => {
            await prepare(db, ['tickets']);
            assert.equal(await soldIn(db, etats.eventId), 5, 'témoin : cinq billets VALIDE');
            await setStatus(db, etats.ticketIds[0], 'UTILISE');
            assert.equal(await soldIn(db, etats.eventId), 5, 'UTILISE reste compté');
            await setStatus(db, etats.ticketIds[1], 'ANNULE');
            assert.equal(await soldIn(db, etats.eventId), 4, 'ANNULE sort');
            await setStatus(db, etats.ticketIds[2], 'REMBOURSE');
            assert.equal(await soldIn(db, etats.eventId), 3, 'REMBOURSE sort');
        });
    });

    test('INVITATION exclue : 2 vendus sur 5 billets', async () => {
        assert.deepEqual(own(await popular(ALL), [mixte]), [{ event_id: mixte.eventId, sold: 2 }]);
    });

    test('un événement fait uniquement d’invitations est absent', async () => {
        assert.deepEqual(own(await popular(ALL), [invitationsSeules]), []);
    });

    test('ONLINE, FREE et COUNTER comptés (L20, définition « vendus » du pilotage)', async () => {
        assert.deepEqual(own(await popular(ALL), [enLigne]), [{ event_id: enLigne.eventId, sold: 2 }], 'deux billets ONLINE réellement payés');
        await inRolledBackTransaction(async (db) => {
            await prepare(db, ['tickets']);
            await addTicket(db, enLigne, 'COUNTER', null, 2000);
            assert.equal(await soldIn(db, enLigne.eventId), 3, 'guichet compté, billet sans porteur compris');
            await addTicket(db, enLigne, 'FREE', holder.userId, 0);
            assert.equal(await soldIn(db, enLigne.eventId), 4, 'gratuit compté');
        });
    });
});

describe('events_popular : événements non publics', () => {
    test('BROUILLON, EN_ATTENTE, VALIDE, SUSPENDU, TERMINE, ANNULE : absents, PUBLIE présent', async () => {
        await inRolledBackTransaction(async (db) => {
            await prepare(db, ['events']);
            assert.equal(await soldIn(db, statuts.eventId), 2, 'témoin : présent quand PUBLIE');
            for (const status of ['BROUILLON', 'EN_ATTENTE', 'VALIDE', 'SUSPENDU', 'TERMINE', 'ANNULE']) {
                await db.query('UPDATE public.events SET status = $2 WHERE id = $1', [statuts.eventId, status]);
                assert.equal(await soldIn(db, statuts.eventId), null, `${status} : absent du classement`);
            }
        });
    });

    test('PUBLIE terminé : absent', async () => {
        const { data, error } = await service.from('events').select('status').eq('id', fini.eventId).single();
        assert.equal(error, null, `lecture : ${error?.message}`);
        assert.equal(data.status, 'PUBLIE', 'précondition : encore PUBLIE, fin passée');
        assert.deepEqual(own(await popular(ALL), [fini]), []);
    });
});

describe('events_popular : limite et droits', () => {
    test('par défaut : exactement 10 lignes, triées par ventes décroissantes (13 événements propres éligibles)', async () => {
        const rows = await popular();
        assert.equal(rows.length, 10, `10 lignes attendues : ${rows.length}`);
        for (let i = 1; i < rows.length; i++) {
            assert.ok(rows[i - 1].sold >= rows[i].sold, `ligne ${i} : ventes croissantes (${rows[i - 1].sold} puis ${rows[i].sold})`);
        }
    });

    test('limite respectée ; 0 et négative : aucune ligne', async () => {
        assert.equal((await popular(3)).length, 3);
        assert.deepEqual(await popular(0), []);
        assert.deepEqual(await popular(-1), []);
    });

    test('signature, SECURITY DEFINER, search_path, STABLE ; anon et authenticated sans EXECUTE ; index du calcul', async () => {
        const facts = await inspect(async (db) => {
            const fn = await db.query<{ args: string; result: string; secdef: boolean; config: string[] | null; volatility: string; anon: boolean; auth: boolean; svc: boolean }>(
                `SELECT pg_get_function_identity_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS result,
                        p.prosecdef AS secdef, p.proconfig AS config, p.provolatile AS volatility,
                        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
                        has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc
                   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'events_popular'`);
            const idx = await db.query(`SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'tickets' AND indexname = 'idx_tickets_created_at'`);
            return { fn: fn.rows, index: idx.rows.length };
        });
        assert.equal(facts.fn.length, 1, `fonction public.events_popular : une signature attendue (migration M3) : ${JSON.stringify(facts.fn)}`);
        const f = facts.fn[0];
        assert.equal(f.args, 'p_limit integer');
        assert.match(f.result, /event_id uuid, sold bigint/);
        assert.equal(f.secdef, true, 'SECURITY DEFINER');
        assert.ok((f.config ?? []).some((c) => /^search_path=public$/.test(c)), `search_path : ${JSON.stringify(f.config)}`);
        assert.equal(f.volatility, 's', 'STABLE');
        assert.deepEqual([f.anon, f.auth, f.svc], [false, false, true], 'réservée au service_role');
        assert.equal(facts.index, 1, 'index idx_tickets_created_at (contrat M3)');
    });
});

// ── Route GET /api/events/popular ──────────────────────────────────────────

const POPULAR_PATH = '/api/events/popular';
const FORBIDDEN_KEYS = ['sold', 'user_id', 'phone', 'email', 'ticket_categories', 'partner_id'];

interface RouteModule { GET: (req: NextRequest) => Promise<Response>; dynamic?: string }

async function popularRoute(): Promise<RouteModule> {
    const mod = await importModule('../../app/api/events/popular/route') as RouteModule;
    assert.equal(typeof mod.GET, 'function', 'app/api/events/popular/route doit exporter GET (contrat 4.2)');
    return mod;
}

const popularRequest = (): NextRequest => new NextRequest(`${BASE_URL}${POPULAR_PATH}`);

/** Toutes les clés d'une réponse, en profondeur. */
function allKeys(value: unknown, out = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
    else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
            out.add(k);
            allKeys(v, out);
        }
    }
    return out;
}

/** Appelle la route pendant une panne de `path` (corps PostgREST avec une sentinelle), panne atteinte exigée. */
async function callDuringOutage(path: string, method: string): Promise<{ status: number; text: string; body: Record<string, unknown>; logged: string[] }> {
    const route = await popularRoute();
    const previousFetch = globalThis.fetch;
    const previousError = console.error;
    const logged: string[] = [];
    let hits = 0;
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const verb = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (verb !== method || new URL(href).pathname !== path) return previousFetch(input, init);
        hits++;
        return new Response(JSON.stringify({ message: 'relation "tickets" sentinelle', code: '42P01' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    console.error = (...args: unknown[]): void => { logged.push(args.map(String).join(' ')); };
    try {
        const res = await route.GET(popularRequest());
        const text = await res.text();
        assert.ok(hits >= 1, `panne simulée de ${path} non atteinte`);
        return { status: res.status, text, body: text ? JSON.parse(text) as Record<string, unknown> : {}, logged };
    } finally {
        globalThis.fetch = previousFetch;
        console.error = previousError;
    }
}

describe('GET /api/events/popular', () => {
    test('panne de la RPC : 500 POPULAR_UNAVAILABLE, journalisée, sans texte de la base', async () => {
        const r = await callDuringOutage('/rest/v1/rpc/events_popular', 'POST');
        assert.equal(r.status, 500, r.text);
        assert.equal(r.body.code, 'POPULAR_UNAVAILABLE', r.text);
        assert.equal(typeof r.body.error, 'string', r.text);
        assert.equal(r.text.includes('sentinelle'), false, `texte de la base renvoyé : ${r.text}`);
        assert.ok(r.logged.length >= 1, 'panne journalisée');
    });

    test('panne de la lecture des événements : 500 POPULAR_UNAVAILABLE, aucune liste vide déguisée', async () => {
        const r = await callDuringOutage('/rest/v1/events', 'GET');
        assert.equal(r.status, 500, r.text);
        assert.equal(r.body.code, 'POPULAR_UNAVAILABLE', r.text);
        assert.equal(r.text.includes('sentinelle'), false, r.text);
    });

    test('après une panne, la route répond : 200, 10 événements au plus, no-store, force-dynamic', async () => {
        const route = await popularRoute();
        assert.equal(route.dynamic, 'force-dynamic');
        const res = await route.GET(popularRequest());
        const body = await res.json() as { events?: unknown[] };
        assert.equal(res.status, 200, JSON.stringify(body).slice(0, 400));
        assert.ok(Array.isArray(body.events), 'liste events');
        assert.ok(body.events.length >= 1 && body.events.length <= 10, `1 à 10 événements attendus : ${body.events.length}`);
        assert.match(res.headers.get('cache-control') ?? '', /no-store/);
    });

    test('aucune clé sold, user_id, phone, email, ticket_categories, partner_id', async () => {
        const route = await popularRoute();
        const res = await route.GET(popularRequest());
        const keys = allKeys(await res.json());
        for (const forbidden of FORBIDDEN_KEYS) assert.equal(keys.has(forbidden), false, `clé ${forbidden} exposée`);
    });

    test('ordre de la RPC, et même carte que le catalogue', async () => {
        const route = await popularRoute();
        const res = await route.GET(popularRequest());
        const body = await res.json() as { events: Array<Record<string, unknown>> };
        assert.deepEqual(body.events.map((e) => e.id), (await popular()).map((r) => r.event_id), 'ordre et contenu du top 10');
        const catalog = await (await eventsRoute(new NextRequest(`${BASE_URL}/api/events`))).json() as { events: Array<Record<string, unknown>> };
        assert.ok(catalog.events.length > 0, 'catalogue non vide');
        assert.deepEqual(Object.keys(body.events[0]).sort(), Object.keys(catalog.events[0]).sort(), 'même format de carte');
    });

    test('un visiteur sans session passe le middleware (déjà vrai, garde-fou, rappel A41)', async () => {
        const result = await callMiddleware(POPULAR_PATH, []);
        assert.equal(result.passedThrough, true, JSON.stringify(result));
        assert.equal(result.status, 200);
    });
});
