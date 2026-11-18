/**
 * Design 1b (À LA UNE) — « À la une » de l'accueil, choisi par le SUPERADMIN (migration 20261123000001_d1b_a_la_une.sql,
 * routes app/api/admin/a-la-une/**, lib/events/featured.server.ts).
 *
 *  1. Qui écrit : seul le SUPERADMIN ; anon 401, client 403, ADMIN muni de events.write 403 SUPERADMIN_ONLY ; un SUPERADMIN
 *     sans mot de passe ni code administrateur récents : 403 PASSWORD_CONFIRMATION_REQUIRED (lecture permise).
 *  2. RLS : aucune lecture ni écriture directe de home_featured par anon ou un compte connecté (le SUPERADMIN compris),
 *     aucune fonction home_featured_* exécutable par l'API.
 *  3. Refus : événement non publié, événement terminé, motif absent ou porteur d'un caractère de contrôle ou d'un contrôle
 *     de sens d'écriture, étiquette « Sponsorisé » pas encore ouverte, fin d'affichage après la fin de l'événement.
 *  4. Ordre (ajout en fin de liste, « Monter / Descendre » par la liste complète, liste périmée refusée), dates
 *     d'affichage (programmé : absent de l'accueil), motif nettoyé, journal audit_logs de chaque action.
 *  5. Retrait automatique à l'annulation et à la suspension (motif automatique, journal sans auteur), retrait à la main
 *     (historique).
 *  6. Lecture publique : home_featured_public ne rend que (event_id, sort_order, label) ; listHomeFeatured rend les cartes
 *     du catalogue dans l'ordre, avec featuredLabel, sans auteur ni motif.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { createSaleEvent, newBuyer, service, type Buyer } from './paiement-helpers';
import { createTimedEvent } from './acces-helpers';
import { newPartner } from './finance-helpers';
import { advanceEventTo } from './cycle-helpers';
import { callRoute, confirmIdentity, show, type CallResult } from './f3d-helpers';

const ROOT = '../../app/api/admin/a-la-une/route';
const ORDER = '../../app/api/admin/a-la-une/ordre/route';
const ITEM = '../../app/api/admin/a-la-une/[id]/route';
const SEARCH = '../../app/api/admin/a-la-une/evenements/route';
const CATS = [{ name: 'Standard', price: 5000, total: 50 }];

let boss: TestAdmin;
const mine = new Set<string>();

function anonClient(): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
}

function userClient(token: string): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
}

async function add(actor: Pick<Buyer, 'accessToken'> | null, body: Record<string, unknown>): Promise<CallResult> {
    const r = await callRoute(ROOT, 'POST', '/api/admin/a-la-une', actor?.accessToken ?? null, body);
    if (r.status === 201 && typeof r.body.id === 'string') mine.add(r.body.id);
    return r;
}

async function list(actor: Pick<Buyer, 'accessToken'>): Promise<CallResult> {
    return callRoute(ROOT, 'GET', '/api/admin/a-la-une', actor.accessToken);
}

async function activeIds(): Promise<string[]> {
    const r = await list(boss);
    assert.equal(r.status, 200, show(r));
    return (r.body.active as Array<{ id: string }>).map((i) => i.id);
}

async function publicRows(): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.rpc('home_featured_public', { p_limit: 20 });
    assert.equal(error, null, error?.message);
    return (data ?? []) as Array<Record<string, unknown>>;
}

async function placement(id: string): Promise<Record<string, unknown>> {
    const { data, error } = await service.from('home_featured').select('*').eq('id', id).single();
    assert.equal(error, null, error?.message);
    return data as Record<string, unknown>;
}

async function audits(objectId: string, action: string): Promise<Array<{ user_id: string | null; user_role: string | null; metadata: Record<string, unknown> }>> {
    const { data, error } = await service.from('audit_logs').select('user_id, user_role, metadata').eq('object_type', 'home_featured')
        .eq('object_id', objectId).eq('action', action);
    assert.equal(error, null, error?.message);
    return (data ?? []) as Array<{ user_id: string | null; user_role: string | null; metadata: Record<string, unknown> }>;
}

async function published(label: string, days = 20): Promise<string> {
    return (await createSaleEvent(`d1b-une-${label}`, CATS, { daysFromNow: days })).eventId;
}

const REASON = 'Belle affiche pour la rentrée';

before(async () => {
    boss = await newAdmin('d1b-une-boss', [], { role: 'SUPERADMIN' });
    await confirmIdentity(boss);
});

after(async () => {
    // Nettoyage par la route : les placements de la suite encore actifs sont retirés (journalisés), jamais effacés.
    const active = new Set(await activeIds().catch(() => []));
    for (const id of mine) {
        if (!active.has(id)) continue;
        const r = await callRoute(ITEM, 'DELETE', `/api/admin/a-la-une/${id}`, boss.accessToken, { reason: 'Fin de la suite de test' }, { id });
        assert.equal(r.status, 200, `nettoyage ${id} : ${show(r)}`);
    }
});

describe('1. seul le SUPERADMIN choisit la une', () => {
    test('anon 401, client 403, ADMIN muni de events.write 403 SUPERADMIN_ONLY, en lecture comme en écriture ; rien d’écrit', async () => {
        const eventId = await published('droits');
        const client = await newBuyer('d1b-une-client');
        const admin = await newAdmin('d1b-une-admin', ['events.read', 'events.write']);
        const body = { event_id: eventId, reason: REASON };

        const anon = await add(null, body);
        assert.equal(anon.status, 401, show(anon));
        const c = await add(client, body);
        assert.equal(c.status, 403, show(c));
        const a = await add(admin, body);
        assert.deepEqual([a.status, a.body.code], [403, 'SUPERADMIN_ONLY'], show(a));
        assert.doesNotMatch(String(a.body.error), /[A-Z]{3,}_[A-Z_]+/, 'refus sans code technique dans le texte');
        const aGet = await list(admin);
        assert.deepEqual([aGet.status, aGet.body.code], [403, 'SUPERADMIN_ONLY'], show(aGet));
        const aSearch = await callRoute(SEARCH, 'GET', '/api/admin/a-la-une/evenements', admin.accessToken);
        assert.equal(aSearch.status, 403, show(aSearch));

        const { count } = await service.from('home_featured').select('id', { count: 'exact', head: true }).eq('event_id', eventId);
        assert.equal(count, 0, 'aucun placement écrit');
    });

    test('SUPERADMIN sans mot de passe ni code récents : lecture permise, écriture 403 PASSWORD_CONFIRMATION_REQUIRED', async () => {
        const other = await newAdmin('d1b-une-boss-b', [], { role: 'SUPERADMIN' });
        const eventId = await published('identite');
        const g = await list(other);
        assert.equal(g.status, 200, show(g));
        const r = await add(other, { event_id: eventId, reason: REASON });
        assert.deepEqual([r.status, r.body.code], [403, 'PASSWORD_CONFIRMATION_REQUIRED'], show(r));
    });
});

describe('2. RLS : aucune écriture ni lecture directe', () => {
    test('anon et compte connecté (SUPERADMIN compris) : home_featured illisible et non écrivable ; fonctions refusées', async () => {
        const eventId = await published('rls');
        for (const [label, client] of [['anon', anonClient()], ['SUPERADMIN par REST', userClient(boss.accessToken)]] as const) {
            const ins = await client.from('home_featured').insert({ event_id: eventId, sort_order: 1, reason: REASON }).select('id');
            assert.ok(ins.error || (ins.data ?? []).length === 0, `${label} : insertion directe acceptée`);
            const sel = await client.from('home_featured').select('id').limit(1);
            assert.ok(sel.error || (sel.data ?? []).length === 0, `${label} : lecture directe`);
            const upd = await client.from('home_featured').update({ reason: 'Changé par REST' }).neq('reason', '').select('id');
            assert.ok(upd.error || (upd.data ?? []).length === 0, `${label} : modification directe`);
            for (const fn of ['home_featured_add', 'home_featured_remove', 'home_featured_reorder', 'home_featured_set_window', 'home_featured_admin_list']) {
                const rpc = await client.rpc(fn, { p: { actor_id: boss.userId, event_id: eventId, reason: REASON } });
                assert.ok(rpc.error, `${label} : ${fn} exécutée par l’API`);
            }
            const pub = await client.rpc('home_featured_public', { p_limit: 5 });
            assert.ok(pub.error, `${label} : home_featured_public exécutée par l’API (lecture réservée au serveur)`);
        }
        const { count } = await service.from('home_featured').select('id', { count: 'exact', head: true }).eq('event_id', eventId);
        assert.equal(count, 0);
    });
});

describe('3. refus : événement, motif, étiquette, dates', () => {
    test('événement non publié : 409 EVENT_NOT_PUBLISHED ; événement terminé : 409 EVENT_FINISHED ; absents de la recherche', async () => {
        const draft = (await createSaleEvent('d1b-une-brouillon', CATS, { daysFromNow: 20, status: 'BROUILLON' })).eventId;
        const partner = await newPartner('d1bune');
        const done = (await createTimedEvent(partner.partnerId, 'd1b-une-fini', CATS, { startsInHours: -10, durationHours: 2 })).eventId;
        const r1 = await add(boss, { event_id: draft, reason: REASON });
        assert.deepEqual([r1.status, r1.body.code], [409, 'EVENT_NOT_PUBLISHED'], show(r1));
        const r2 = await add(boss, { event_id: done, reason: REASON });
        assert.deepEqual([r2.status, r2.body.code], [409, 'EVENT_FINISHED'], show(r2));
        const s = await callRoute(SEARCH, 'GET', '/api/admin/a-la-une/evenements?q=d1b-une', boss.accessToken);
        assert.equal(s.status, 200, show(s));
        const ids = (s.body.events as Array<{ id: string }>).map((e) => e.id);
        assert.ok(!ids.includes(draft) && !ids.includes(done), 'brouillon ou événement fini proposé');
    });

    test('motif absent, blanc, avec un caractère de contrôle ou un contrôle de sens d’écriture : 400 ; « Sponsorisé » : 400 LABEL_NOT_OPEN', async () => {
        const eventId = await published('motif');
        const cases: Array<[unknown, string]> = [
            [undefined, 'REASON_REQUIRED'], ['  ', 'REASON_REQUIRED'], ['ab', 'REASON_REQUIRED'], ['x'.repeat(501), 'REASON_REQUIRED'],
            ['Belle\u0007 affiche', 'REASON_INVALID_CHARACTERS'], ['Belle ‮ affiche', 'REASON_INVALID_CHARACTERS'],
            ['Belle ⁦affiche⁩', 'REASON_INVALID_CHARACTERS'],
        ];
        for (const [reason, code] of cases) {
            const r = await add(boss, { event_id: eventId, ...(reason === undefined ? {} : { reason }) });
            assert.deepEqual([r.status, r.body.code], [400, code], `motif ${JSON.stringify(reason)} : ${show(r)}`);
        }
        const s = await add(boss, { event_id: eventId, reason: REASON, label: 'SPONSORISE' });
        assert.deepEqual([s.status, s.body.code], [400, 'LABEL_NOT_OPEN'], show(s));
        const extra = await add(boss, { event_id: eventId, reason: REASON, created_by: boss.userId });
        assert.equal(extra.status, 400, `champ non accepté : ${show(extra)}`);
        const { count } = await service.from('home_featured').select('id', { count: 'exact', head: true }).eq('event_id', eventId);
        assert.equal(count, 0);
    });

    test('fin d’affichage après la fin de l’événement, déjà passée, ou avant le début : 400 ; date sans fuseau : 400 INVALID_DATE', async () => {
        const eventId = await published('fenetre', 5);
        const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
        const cases: Array<[Record<string, unknown>, string]> = [
            [{ ends_at: inDays(30) }, 'WINDOW_AFTER_EVENT'],
            [{ starts_at: inDays(30) }, 'WINDOW_AFTER_EVENT'],
            [{ ends_at: inDays(-1) }, 'WINDOW_IN_PAST'],
            [{ starts_at: inDays(3), ends_at: inDays(2) }, 'WINDOW_INVALID'],
            [{ ends_at: '2030-01-01T10:00' }, 'INVALID_DATE'],
        ];
        for (const [dates, code] of cases) {
            const r = await add(boss, { event_id: eventId, reason: REASON, ...dates });
            assert.deepEqual([r.status, r.body.code], [400, code], `${JSON.stringify(dates)} : ${show(r)}`);
        }
    });
});

describe('4 à 6. ordre, dates, journal, retraits, lecture publique', () => {
    let a: string; let b: string; let c: string;
    let pa: string; let pb: string; let pc: string;

    test('ajout en fin de liste, motif nettoyé, journal HOME_FEATURED_ADDED ; doublon refusé', async () => {
        [a, b, c] = [await published('ordre-a', 10), await published('ordre-b', 11), await published('ordre-c', 12)];
        const r1 = await add(boss, { event_id: a, reason: '  Belle\n\taffiche    pour la rentrée  ' });
        assert.equal(r1.status, 201, show(r1));
        pa = String(r1.body.id);
        const r2 = await add(boss, { event_id: b, reason: REASON });
        const r3 = await add(boss, { event_id: c, reason: REASON });
        assert.deepEqual([r2.status, r3.status], [201, 201], `${show(r2)} ${show(r3)}`);
        pb = String(r2.body.id);
        pc = String(r3.body.id);
        const ids = await activeIds();
        assert.ok(ids.indexOf(pa) < ids.indexOf(pb) && ids.indexOf(pb) < ids.indexOf(pc), `ordre d’ajout : ${ids.join(', ')}`);

        const row = await placement(pa);
        assert.deepEqual([row.reason, row.label, row.created_by, row.removed_at], ['Belle affiche pour la rentrée', 'A_LA_UNE', boss.userId, null]);
        const logs = await audits(pa, 'HOME_FEATURED_ADDED');
        assert.equal(logs.length, 1);
        assert.deepEqual([logs[0].user_id, logs[0].user_role, logs[0].metadata.reason, logs[0].metadata.event_id],
            [boss.userId, 'SUPERADMIN', 'Belle affiche pour la rentrée', a]);

        const dup = await add(boss, { event_id: a, reason: REASON });
        assert.deepEqual([dup.status, dup.body.code], [409, 'ALREADY_FEATURED'], show(dup));
        const s = await callRoute(SEARCH, 'GET', '/api/admin/a-la-une/evenements?q=d1b-une-ordre', boss.accessToken);
        assert.ok(!(s.body.events as Array<{ id: string }>).some((e) => [a, b, c].includes(e.id)), 'un événement déjà à la une est encore proposé');
    });

    test('ordre : C, A, B par la liste complète ; journal HOME_FEATURED_REORDERED ; liste périmée : 409 ORDER_STALE', async () => {
        const ids = await activeIds();
        const wanted = [pc, pa, pb, ...ids.filter((i) => ![pa, pb, pc].includes(i))];
        const r = await callRoute(ORDER, 'POST', '/api/admin/a-la-une/ordre', boss.accessToken, { ids: wanted });
        assert.deepEqual([r.status, r.body.changed], [200, true], show(r));
        assert.deepEqual((await activeIds()).slice(0, 3), [pc, pa, pb]);
        const pub = (await publicRows()).map((x) => String(x.event_id));
        assert.ok(pub.indexOf(c) < pub.indexOf(a) && pub.indexOf(a) < pub.indexOf(b), `ordre public : ${pub.join(', ')}`);

        const { data: logs } = await service.from('audit_logs').select('user_id, old_value, new_value').eq('action', 'HOME_FEATURED_REORDERED')
            .eq('user_id', boss.userId).order('created_at', { ascending: false }).limit(1);
        assert.equal((logs ?? []).length, 1, 'journal de l’ordre absent');
        const logged = (logs![0].new_value as { order: string[] }).order;
        assert.ok(logged.indexOf(c) < logged.indexOf(a), 'ordre journalisé faux');

        const stale = await callRoute(ORDER, 'POST', '/api/admin/a-la-une/ordre', boss.accessToken, { ids: [pa, pb] });
        assert.deepEqual([stale.status, stale.body.code], [409, 'ORDER_STALE'], show(stale));
    });

    test('dates : début dans deux jours → programmé, absent de l’accueil ; journal HOME_FEATURED_WINDOW_SET ; puis dès maintenant', async () => {
        const start = new Date(Date.now() + 2 * 86_400_000).toISOString();
        const r = await callRoute(ITEM, 'PATCH', `/api/admin/a-la-une/${pb}`, boss.accessToken, { starts_at: start, ends_at: null, reason: 'Attendre la fin des examens' }, { id: pb });
        assert.equal(r.status, 200, show(r));
        assert.ok(!(await publicRows()).some((x) => x.event_id === b), 'placement programmé déjà sur l’accueil');
        const l = await list(boss);
        const item = (l.body.active as Array<{ id: string; display_state: string }>).find((i) => i.id === pb);
        assert.equal(item?.display_state, 'SCHEDULED');
        const logs = await audits(pb, 'HOME_FEATURED_WINDOW_SET');
        assert.equal(logs.length, 1);
        assert.equal(logs[0].metadata.reason, 'Attendre la fin des examens');

        const noReason = await callRoute(ITEM, 'PATCH', `/api/admin/a-la-une/${pb}`, boss.accessToken, { starts_at: null }, { id: pb });
        assert.deepEqual([noReason.status, noReason.body.code], [400, 'REASON_REQUIRED'], show(noReason));
        const back = await callRoute(ITEM, 'PATCH', `/api/admin/a-la-une/${pb}`, boss.accessToken, { starts_at: null, ends_at: null, reason: 'Affiché tout de suite' }, { id: pb });
        assert.equal(back.status, 200, show(back));
        assert.ok((await publicRows()).some((x) => x.event_id === b), 'placement absent de l’accueil après « dès maintenant »');
    });

    test('lecture publique : (event_id, sort_order, label) seulement ; listHomeFeatured dans l’ordre, cartes du catalogue, sans auteur ni motif', async () => {
        const rows = await publicRows();
        assert.ok(rows.length > 0);
        for (const row of rows) assert.deepEqual(Object.keys(row).sort(), ['event_id', 'label', 'sort_order']);
        const { listHomeFeatured } = await import('../../lib/events/featured.server');
        const cards = await listHomeFeatured(20);
        const order = cards.map((x) => x.id);
        assert.ok(order.indexOf(c) >= 0 && order.indexOf(c) < order.indexOf(a) && order.indexOf(a) < order.indexOf(b), `ordre des cartes : ${order.join(', ')}`);
        const card = cards.find((x) => x.id === a)!;
        assert.equal(card.featuredLabel, 'A_LA_UNE');
        assert.ok(card.title.includes('d1b-une-ordre-a') && typeof card.saleLabel === 'string' && typeof card.dateFormatted === 'string', JSON.stringify(card));
        const text = JSON.stringify(cards);
        for (const forbidden of ['reason', 'created_by', 'Belle affiche', 'Administratrice', boss.userId]) {
            assert.ok(!text.includes(forbidden), `donnée de l’administration dans les cartes publiques : ${forbidden}`);
        }
        assert.deepEqual(await listHomeFeatured(0), []);
    });

    test('annulation et suspension : retrait automatique (motif, code), journal sans auteur ; plus sur l’accueil', async () => {
        await advanceEventTo(a, 'ANNULE');
        await advanceEventTo(b, 'SUSPENDU');
        const ra = await placement(pa);
        const rb = await placement(pb);
        assert.deepEqual([ra.removed_code, ra.removed_by], ['EVENT_CANCELLED', null]);
        assert.match(String(ra.removed_reason), /annulé/);
        assert.deepEqual([rb.removed_code, rb.removed_by], ['EVENT_SUSPENDED', null]);
        assert.match(String(rb.removed_reason), /suspendu/);
        for (const id of [pa, pb]) {
            const logs = await audits(id, 'HOME_FEATURED_AUTO_REMOVED');
            assert.equal(logs.length, 1, `journal automatique de ${id}`);
            assert.deepEqual([logs[0].user_id, logs[0].user_role], [null, 'SYSTEM']);
        }
        const pub = (await publicRows()).map((x) => x.event_id);
        assert.ok(!pub.includes(a) && !pub.includes(b), 'événement annulé ou suspendu encore sur l’accueil');
        const ids = await activeIds();
        assert.ok(!ids.includes(pa) && !ids.includes(pb));
    });

    test('retrait à la main : confirmation par le motif, historique, journal HOME_FEATURED_REMOVED ; second retrait 404', async () => {
        const noReason = await callRoute(ITEM, 'DELETE', `/api/admin/a-la-une/${pc}`, boss.accessToken, { reason: '' }, { id: pc });
        assert.deepEqual([noReason.status, noReason.body.code], [400, 'REASON_REQUIRED'], show(noReason));
        const r = await callRoute(ITEM, 'DELETE', `/api/admin/a-la-une/${pc}`, boss.accessToken, { reason: 'Fin de la campagne' }, { id: pc });
        assert.equal(r.status, 200, show(r));
        const row = await placement(pc);
        assert.deepEqual([row.removed_code, row.removed_by, row.removed_reason], ['MANUAL', boss.userId, 'Fin de la campagne']);
        const logs = await audits(pc, 'HOME_FEATURED_REMOVED');
        assert.deepEqual([logs.length, logs[0]?.user_id, logs[0]?.metadata.reason], [1, boss.userId, 'Fin de la campagne']);
        const l = await list(boss);
        const history = l.body.history as Array<{ id: string; removed_code: string }>;
        assert.ok(history.some((h) => h.id === pc && h.removed_code === 'MANUAL'), 'retrait absent de l’historique');
        assert.ok(history.some((h) => h.id === pa && h.removed_code === 'EVENT_CANCELLED'), 'retrait automatique absent de l’historique');
        const again = await callRoute(ITEM, 'DELETE', `/api/admin/a-la-une/${pc}`, boss.accessToken, { reason: 'Fin de la campagne' }, { id: pc });
        assert.deepEqual([again.status, again.body.code], [404, 'NOT_FOUND'], show(again));
    });
});
