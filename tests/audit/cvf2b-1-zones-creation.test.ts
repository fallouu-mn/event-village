/**
 * Contre-vérification de la finition 2b, attaque 1 — portes et zones réglées dès la création de l'événement, dans la même
 * transaction que lui (event_create : category_refs résolus après l'insertion des catégories, puis
 * event_zones_form_refusal et event_zones_write ; refus = exception EVZ22 qui annule l'événement et ses catégories).
 *
 * Ce que tests/parcours/f2b-zones-creation ne couvre pas :
 *  a. zones ou portes qui visent un AUTRE événement (catégorie, zone, porte d'une autre partenaire) : route et base ;
 *  b. ordre de catégorie (category_refs) hors limites : négatif, égal au nombre de catégories, 99, 100, décimal, texte,
 *     null, booléen, tableau : route et base ;
 *  c. zone sans catégorie, 21 zones, 51 portes : route et base ;
 *  d. fiche partenaire EN_ATTENTE, REJETE, SUSPENDU : création avec zones refusée (route et base), témoin VALIDE ;
 *  e. session de l'attaquante (clé publique + jeton) : RPC event_create (y compris au nom d'une autre partenaire),
 *     event_zones_write et event_zones_save sur l'événement d'une autre, event_zones_form_refusal ; REST directe sur
 *     event_zones, event_gates, zone_categories ;
 *  f. scanner : mêmes verdicts (et mêmes zones proposées) que les zones soient créées avec l'événement ou ajoutées après,
 *     avec deux zones d'entrée, une catégorie citée deux fois et une catégorie ajoutée APRÈS les zones.
 * Chaque refus est vérifié en base : ni événement, ni catégorie, ni zone, ni porte, ni ligne d'audit de création.
 * Une attaque réussie = un 2xx (ou `ok: true`) avec écriture, ou un état de la victime changé. Sortie brute `[CVF2B-1]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newBuyer, service, type Buyer, type SaleEvent } from '../parcours/paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from '../parcours/finance-helpers';
import { newController, ticketPayload, type RouteResult } from '../parcours/acces-helpers';
import { advanceEventTo, storedPosterUrl } from '../parcours/cycle-helpers';
import { assignGate, createZonedEvent, getZones, saveZones, scanAtGate, type ZonedEvent } from '../parcours/zones-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { CATS, FREE, PAID, setFiche } from './cvf1-helpers';
import {
    asAttacker, asServer, eventBody, is2xx, list, lit, mark, nothingWritten, postCategory, postEvent, rpcEvent, show, showBase,
    traces, userClient, type Reply, type Row,
} from './cvf2b-12-helpers';

let A: TestPartner;      // attaquante (fiche VALIDE)
let AF: TestPartner;     // attaquante dont la fiche change (d)
let V: TestPartner;      // victime
let VE: ZonedEvent;      // événement de la victime : Pelouse (ENTREE, deux catégories), Carré (CONTROLE, PAID seule)
let posterA: string;
let posterAF: string;
const restore: string[] = [];

before(async () => {
    A = await newPartner('cvf2b-1');
    AF = await newPartner('cvf2b-1-fiche');
    V = await newPartner('cvf2b-1-victime');
    VE = await createZonedEvent(V, 'cvf2b-1-victime', CATS, [
        { name: 'Pelouse', kind: 'ENTREE', admits: [FREE, PAID], gates: ['Porte 1'] },
        { name: 'Carré', kind: 'CONTROLE', admits: [PAID], gates: ['Porte Carré'] },
    ], { startsInHours: 48 });
    posterA = await storedPosterUrl(A.partnerId);
    posterAF = await storedPosterUrl(AF.partnerId);
});

after(async () => {
    for (const id of restore) await setFiche(id, 'VALIDE');
    await assertFinition1Invariants('cvf2b-1-zones-creation');
});

// ── Montage commun ─────────────────────────────────────────────────────────

function cats(m: string): Row[] {
    return [
        { name: `Simple ${m}`, price: 5_000, total_quantity: 100 },
        { name: `VIP ${m}`, price: 20_000, total_quantity: 20 },
    ];
}

function zone(m: string, extra: Row = {}): Row {
    return { name: `Entrée ${m}`, kind: 'ENTREE', category_refs: [0, 1], gates: [{ name: `Porte ${m}` }], ...extra };
}

/** État de l'événement de la victime : zones, portes, admissions, catégories ; admissions de ses catégories ou zones ailleurs. */
async function victimState(): Promise<string> {
    const catIds = Object.values(VE.categories).map((c) => c.id);
    const zoneIds = Object.values(VE.zones).map((z) => z.id);
    const [zones, gates, adm, catsRows, foreignByCat, foreignByZone] = await Promise.all([
        service.from('event_zones').select('id, event_id, name, kind, position').eq('event_id', VE.eventId).order('id'),
        service.from('event_gates').select('id, event_id, zone_id, name').eq('event_id', VE.eventId).order('id'),
        service.from('zone_categories').select('event_id, zone_id, category_id').eq('event_id', VE.eventId).order('zone_id').order('category_id'),
        service.from('ticket_categories').select('id, event_id, name, price, scan_color, entry_instruction').eq('event_id', VE.eventId).order('id'),
        service.from('zone_categories').select('event_id, zone_id, category_id').in('category_id', catIds).neq('event_id', VE.eventId),
        service.from('zone_categories').select('event_id, zone_id, category_id').in('zone_id', zoneIds).neq('event_id', VE.eventId),
    ]);
    for (const r of [zones, gates, adm, catsRows, foreignByCat, foreignByZone]) assert.equal(r.error, null, `état de la victime : ${r.error?.message}`);
    return JSON.stringify({ zones: zones.data, gates: gates.data, adm: adm.data, cats: catsRows.data, foreignByCat: foreignByCat.data, foreignByZone: foreignByZone.data });
}

/** Admissions d'un événement créé : chaque catégorie admise est bien une catégorie de CET événement. */
async function foreignAdmissions(eventId: string): Promise<Row[]> {
    const { data: own, error: e1 } = await service.from('ticket_categories').select('id').eq('event_id', eventId);
    assert.equal(e1, null, e1?.message);
    const ownIds = new Set((own ?? []).map((c) => String(c.id)));
    const { data: adm, error: e2 } = await service.from('zone_categories').select('zone_id, category_id').eq('event_id', eventId);
    assert.equal(e2, null, e2?.message);
    return ((adm ?? []) as Row[]).filter((r) => !ownIds.has(String(r.category_id)));
}

function createdId(r: Reply): string | null {
    const ev = (r.body.event ?? null) as Row | null;
    return typeof ev?.id === 'string' ? ev.id : null;
}

/** Tentative par la route : refus exigé, rien d'écrit. Rend la ligne de manquement, ou null. */
async function routeAttempt(label: string, token: string, actorId: string, m: string, body: Row, expectCode?: string): Promise<string | null> {
    const before = await traces(m, actorId);
    const r = await postEvent(token, body);
    const after = await traces(m, actorId);
    console.log(`[CVF2B-1] route POST /api/partner/events, ${label} → ${show(r).slice(0, 400)} ; traces avant ${JSON.stringify(before)} après ${JSON.stringify(after)}`);
    if (is2xx(r)) return `${label} : accepté par la route (${show(r).slice(0, 200)}) ; traces ${JSON.stringify(after)}`;
    if (!nothingWritten(before, after)) return `${label} : refusé (${r.status}) mais écrit : avant ${JSON.stringify(before)} après ${JSON.stringify(after)}`;
    if (expectCode && r.body.code !== expectCode) return `${label} : refus ${r.status} ${String(r.body.code)} au lieu de ${expectCode} (${show(r).slice(0, 200)})`;
    return null;
}

/** Tentative par la base (event_create comme l'appelle le serveur) : refus exigé, rien d'écrit. */
async function baseAttempt(label: string, actorId: string, m: string, p: Row, expectCode?: string): Promise<string | null> {
    const before = await traces(m, actorId);
    const r = await asServer('event_create', { actor_id: actorId, ...p });
    const after = await traces(m, actorId);
    console.log(`[CVF2B-1] base event_create, ${label} → ${showBase(r)} ; traces avant ${JSON.stringify(before)} après ${JSON.stringify(after)}`);
    if (r.ok) return `${label} : accepté par event_create (${showBase(r).slice(0, 200)}) ; traces ${JSON.stringify(after)}`;
    if (!nothingWritten(before, after)) return `${label} : refusé mais écrit : avant ${JSON.stringify(before)} après ${JSON.stringify(after)}`;
    if (expectCode && r.data?.code !== expectCode) return `${label} : refus ${String(r.data?.code ?? r.error)} au lieu de ${expectCode}`;
    return null;
}

// ── a. Un autre événement ──────────────────────────────────────────────────

describe('a. zones ou portes qui visent l’événement d’une autre partenaire', () => {
    const attacks: Array<[string, (m: string) => Row[]]> = [
        ['catégorie de la victime ajoutée (category_ids à côté de category_refs)', (m) => [zone(m, { category_ids: [VE.categories[FREE].id, VE.categories[PAID].id] })]],
        ['catégorie de la victime seule (category_ids sans category_refs)', (m) => [{ name: `Entrée ${m}`, kind: 'ENTREE', category_ids: [VE.categories[PAID].id], gates: [{ name: `Porte ${m}` }] }]],
        ['zone de la victime (id de la zone Carré)', (m) => [zone(m, { id: VE.zones['Carré'].id })]],
        ['porte de la victime (gates[].id de « Porte 1 »)', (m) => [zone(m, { gates: [{ name: `Porte ${m}`, id: VE.zones['Pelouse'].gates['Porte 1'] }] })]],
        ['porte de la victime déplacée vers une zone CONTROLE (gates[].id de « Porte Carré »)', (m) => [
            zone(m), { name: `Contrôle ${m}`, kind: 'CONTROLE', category_refs: [1], gates: [{ name: `Porte C ${m}`, id: VE.zones['Carré'].gates['Porte Carré'] }] },
        ]],
    ];

    test('route POST /api/partner/events : refus, rien d’écrit, événement de la victime intact', async () => {
        const breaches: string[] = [];
        for (const [label, zonesOf] of attacks) {
            const m = mark();
            const victimBefore = await victimState();
            const b = await routeAttempt(label, A.accessToken, A.userId, m, eventBody(`TEST CVF2B-1 a ${m}`, posterA, cats(m), { zones: zonesOf(m) }));
            if (b) breaches.push(b);
            const victimAfter = await victimState();
            if (victimAfter !== victimBefore) breaches.push(`${label} : événement de la victime changé\n    avant ${victimBefore}\n    après ${victimAfter}`);
        }
        assert.deepEqual(breaches, [], `zones visant un autre événement, par la route :\n${list(breaches)}`);
    });

    test('base event_create (auteur = l’attaquante) : aucune admission ni porte de la victime touchée', async () => {
        const breaches: string[] = [];
        for (const [label, zonesOf] of attacks) {
            const m = mark();
            const victimBefore = await victimState();
            const r = await asServer('event_create', { actor_id: A.userId, event: rpcEvent(`TEST CVF2B-1 a base ${m}`), ticket_categories: cats(m), zones: zonesOf(m) });
            const t = await traces(m, A.userId);
            console.log(`[CVF2B-1] base event_create, ${label} → ${showBase(r)} ; traces ${JSON.stringify(t)}`);
            const victimAfter = await victimState();
            if (victimAfter !== victimBefore) breaches.push(`${label} : événement de la victime changé\n    avant ${victimBefore}\n    après ${victimAfter}`);
            if (r.ok) {
                // Clé étrangère ignorée par la résolution des category_refs : admis seulement si rien ne vise la victime
                const id = String(r.data?.event_id);
                const foreign = await foreignAdmissions(id);
                console.log(`[CVF2B-1]   événement créé ${id} : admissions étrangères ${JSON.stringify(foreign)}`);
                if (foreign.length > 0) breaches.push(`${label} : l’événement créé ${id} admet des catégories qui ne sont pas les siennes : ${JSON.stringify(foreign)}`);
            } else if (t.events !== 0 || t.categories !== 0 || t.zones !== 0 || t.gates !== 0) {
                breaches.push(`${label} : refusé mais écrit ${JSON.stringify(t)}`);
            }
        }
        assert.deepEqual(breaches, [], `zones visant un autre événement, par la base :\n${list(breaches)}`);
    });
});

// ── b. category_refs hors limites ──────────────────────────────────────────

describe('b. ordre de catégorie (category_refs) hors limites', () => {
    // Deux catégories : seuls 0 et 1 sont valables
    const refs: unknown[] = [-1, 2, 3, 99, 100, 1.5, 0.0001, '0', '1', null, true, [0], { i: 0 }, 1e2];

    test('route : chaque valeur refusée, rien d’écrit', async () => {
        const breaches: string[] = [];
        for (const ref of refs) {
            const m = mark();
            const b = await routeAttempt(`category_refs [0, ${lit(ref)}]`, A.accessToken, A.userId, m,
                eventBody(`TEST CVF2B-1 b ${m}`, posterA, cats(m), { zones: [zone(m, { category_refs: [0, ref] })] }));
            if (b) breaches.push(b);
        }
        assert.deepEqual(breaches, [], `category_refs hors limites acceptés par la route :\n${list(breaches)}`);
    });

    test('base : chaque valeur refusée (INVALID_INPUT, zones.0.category_refs), rien d’écrit', async () => {
        const breaches: string[] = [];
        for (const ref of refs) {
            const m = mark();
            const b = await baseAttempt(`category_refs [0, ${lit(ref)}]`, A.userId, m,
                { event: rpcEvent(`TEST CVF2B-1 b base ${m}`), ticket_categories: cats(m), zones: [zone(m, { category_refs: [0, ref] })] }, 'INVALID_INPUT');
            if (b) breaches.push(b);
        }
        // Aucune catégorie : tout ordre est inconnu
        const m = mark();
        const b = await baseAttempt('category_refs [0] sans aucune catégorie', A.userId, m,
            { event: rpcEvent(`TEST CVF2B-1 b vide ${m}`), ticket_categories: [], zones: [zone(m, { category_refs: [0] })] });
        if (b) breaches.push(b);
        assert.deepEqual(breaches, [], `category_refs hors limites acceptés par la base :\n${list(breaches)}`);
    });
});

// ── c. Formes refusées ─────────────────────────────────────────────────────

function manyZones(m: string, n: number): Row[] {
    return Array.from({ length: n }, (_, i) => ({ name: `Z${i} ${m}`, kind: 'ENTREE', category_refs: [0, 1], gates: [{ name: `P${i} ${m}` }] }));
}

function manyGates(m: string, n: number): Row[] {
    const half = Math.ceil(n / 2);
    return [
        { name: `Entrée ${m}`, kind: 'ENTREE', category_refs: [0, 1], gates: Array.from({ length: half }, (_, i) => ({ name: `PE${i} ${m}` })) },
        { name: `Contrôle ${m}`, kind: 'CONTROLE', category_refs: [1], gates: Array.from({ length: n - half }, (_, i) => ({ name: `PC${i} ${m}` })) },
    ];
}

describe('c. zone sans catégorie, plus de 20 zones, plus de 50 portes', () => {
    const cases: Array<[string, (m: string) => Row[], string]> = [
        ['zone sans catégorie (category_refs vide)', (m) => [zone(m), { name: `Contrôle ${m}`, kind: 'CONTROLE', category_refs: [], gates: [{ name: `Porte C ${m}` }] }], 'ZONE_WITHOUT_CATEGORY'],
        ['21 zones', (m) => manyZones(m, 21), 'TOO_MANY_ZONES'],
        ['51 portes', (m) => manyGates(m, 51), 'TOO_MANY_GATES'],
    ];

    test('témoin : 20 zones et 50 portes acceptées par la route', async () => {
        for (const [label, zonesOf] of [['20 zones', (m: string) => manyZones(m, 20)], ['50 portes', (m: string) => manyGates(m, 50)]] as const) {
            const m = mark();
            const r = await postEvent(A.accessToken, eventBody(`TEST CVF2B-1 c témoin ${m}`, posterA, cats(m), { zones: zonesOf(m) }));
            console.log(`[CVF2B-1] témoin ${label} → ${show(r).slice(0, 200)}`);
            assert.equal(r.status, 201, `témoin ${label} : ${show(r)}`);
        }
    });

    for (const [label, zonesOf, code] of cases) {
        test(`route : ${label} → ${code}, rien d’écrit`, async () => {
            const m = mark();
            const b = await routeAttempt(label, A.accessToken, A.userId, m, eventBody(`TEST CVF2B-1 c ${m}`, posterA, cats(m), { zones: zonesOf(m) }), code);
            assert.equal(b, null, b ?? '');
        });
        test(`base : ${label} → ${code}, rien d’écrit`, async () => {
            const m = mark();
            const b = await baseAttempt(label, A.userId, m, { event: rpcEvent(`TEST CVF2B-1 c base ${m}`), ticket_categories: cats(m), zones: zonesOf(m) }, code);
            assert.equal(b, null, b ?? '');
        });
    }
});

// ── d. Fiche non validée ───────────────────────────────────────────────────

describe('d. fiche EN_ATTENTE, REJETE, SUSPENDU : création avec zones refusée', () => {
    for (const status of ['EN_ATTENTE', 'REJETE', 'SUSPENDU'] as const) {
        test(`fiche ${status} : route et base refusées, rien d’écrit`, async () => {
            await setFiche(AF.partnerId, status);
            restore.push(AF.partnerId);
            const breaches: string[] = [];
            try {
                const m1 = mark();
                const b1 = await routeAttempt(`fiche ${status}`, AF.accessToken, AF.userId, m1, eventBody(`TEST CVF2B-1 d ${m1}`, posterAF, cats(m1), { zones: [zone(m1)] }));
                if (b1) breaches.push(b1);
                const m2 = mark();
                const b2 = await baseAttempt(`fiche ${status}`, AF.userId, m2, { event: rpcEvent(`TEST CVF2B-1 d base ${m2}`), ticket_categories: cats(m2), zones: [zone(m2)] });
                if (b2) breaches.push(b2);
            } finally {
                await setFiche(AF.partnerId, 'VALIDE');
            }
            assert.deepEqual(breaches, [], `fiche ${status} :\n${list(breaches)}`);
        });
    }

    test('témoin : la même création acceptée une fois la fiche VALIDE', async () => {
        const m = mark();
        const r = await postEvent(AF.accessToken, eventBody(`TEST CVF2B-1 d témoin ${m}`, posterAF, cats(m), { zones: [zone(m)] }));
        console.log(`[CVF2B-1] témoin fiche VALIDE → ${show(r).slice(0, 200)}`);
        assert.equal(r.status, 201, show(r));
    });
});

// ── e. Session de l'attaquante : RPC et REST ───────────────────────────────

describe('e. session de l’attaquante (clé publique + jeton) : fonctions et tables des zones', () => {
    test('RPC event_create, event_zones_write, event_zones_save, event_zones_form_refusal : refusées, rien d’écrit', async () => {
        const m = mark();
        const victimBefore = await victimState();
        const before = await traces(m, A.userId);
        const victimEventsBefore = (await service.from('events').select('id').eq('partner_id', V.partnerId)).data?.length ?? -1;
        const calls: Array<[string, string, Row]> = [
            ['event_create (auteur = elle-même)', 'event_create', { p: { actor_id: A.userId, event: rpcEvent(`TEST CVF2B-1 e ${m}`), ticket_categories: cats(m), zones: [zone(m)] } }],
            ['event_create (au nom de la victime)', 'event_create', { p: { actor_id: V.userId, event: rpcEvent(`TEST CVF2B-1 e usurpée ${m}`), ticket_categories: cats(m), zones: [zone(m)] } }],
            ['event_zones_write sur l’événement de la victime', 'event_zones_write', {
                p_event: VE.eventId, p_actor: A.userId, p_at_creation: true,
                p_zones: [{ name: `Pirate ${m}`, kind: 'ENTREE', category_ids: [VE.categories[FREE].id, VE.categories[PAID].id], gates: [{ name: `Porte pirate ${m}` }] }],
            }],
            ['event_zones_save au nom de la victime (zones vidées)', 'event_zones_save', { p: { event_id: VE.eventId, actor_id: V.userId, zones: [] } }],
            ['event_zones_form_refusal', 'event_zones_form_refusal', { p_zones: [] }],
        ];
        const breaches: string[] = [];
        for (const [label, fn, args] of calls) {
            const r = await asAttacker(A.accessToken, fn, args);
            console.log(`[CVF2B-1] REST rpc/${fn} (jeton de l’attaquante), ${label} → ok=${r.ok} ${r.error ?? JSON.stringify(r.data).slice(0, 300)}`);
            if (r.ok) breaches.push(`${label} : exécutée (${JSON.stringify(r.data).slice(0, 200)})`);
        }
        const after = await traces(m, A.userId);
        const victimAfter = await victimState();
        const victimEventsAfter = (await service.from('events').select('id').eq('partner_id', V.partnerId)).data?.length ?? -1;
        console.log(`[CVF2B-1] après les RPC : traces ${JSON.stringify(after)} ; événements de la victime ${victimEventsBefore} → ${victimEventsAfter}`);
        if (!nothingWritten(before, after)) breaches.push(`écritures : avant ${JSON.stringify(before)} après ${JSON.stringify(after)}`);
        if (victimAfter !== victimBefore) breaches.push(`événement de la victime changé\n    avant ${victimBefore}\n    après ${victimAfter}`);
        if (victimEventsAfter !== victimEventsBefore) breaches.push(`événements de la victime : ${victimEventsBefore} → ${victimEventsAfter}`);
        assert.deepEqual(breaches, [], `fonctions des zones par la REST :\n${list(breaches)}`);
    });

    test('REST directe : insertion, modification, suppression sur event_zones, event_gates, zone_categories de la victime', async () => {
        const m = mark();
        const db = userClient(A.accessToken);
        const victimBefore = await victimState();
        const carre = VE.zones['Carré'].id;
        const pelouse = VE.zones['Pelouse'].id;
        const porte1 = VE.zones['Pelouse'].gates['Porte 1'];
        const attempts: Array<[string, () => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>]> = [
            ['INSERT event_zones (événement de la victime)', () => db.from('event_zones').insert({ event_id: VE.eventId, name: `Pirate ${m}`, kind: 'ENTREE', position: 9 }).select()],
            ['INSERT event_gates (zone Pelouse de la victime)', () => db.from('event_gates').insert({ event_id: VE.eventId, zone_id: pelouse, name: `Porte pirate ${m}` }).select()],
            ['INSERT zone_categories (Carré admet la catégorie gratuite)', () => db.from('zone_categories').insert({ event_id: VE.eventId, zone_id: carre, category_id: VE.categories[FREE].id }).select()],
            ['UPDATE event_gates (Porte 1 déplacée au Carré)', () => db.from('event_gates').update({ zone_id: carre, name: `Porte 1 ${m}` }).eq('id', porte1).select()],
            ['UPDATE event_zones (Carré devient ENTREE)', () => db.from('event_zones').update({ kind: 'ENTREE' }).eq('id', carre).select()],
            ['DELETE zone_categories (admissions de la victime)', () => db.from('zone_categories').delete().eq('event_id', VE.eventId).select()],
            ['DELETE event_gates (portes de la victime)', () => db.from('event_gates').delete().eq('event_id', VE.eventId).select()],
        ];
        const breaches: string[] = [];
        for (const [label, run] of attempts) {
            const { data, error } = await run();
            const rows = Array.isArray(data) ? data : [];
            console.log(`[CVF2B-1] REST ${label} → ${error ? `erreur ${error.code ?? ''} ${error.message}` : `${rows.length} ligne(s) ${JSON.stringify(rows).slice(0, 200)}`}`);
            if (!error && rows.length > 0) breaches.push(`${label} : ${rows.length} ligne(s) écrite(s) ${JSON.stringify(rows).slice(0, 200)}`);
        }
        const victimAfter = await victimState();
        if (victimAfter !== victimBefore) breaches.push(`événement de la victime changé\n    avant ${victimBefore}\n    après ${victimAfter}`);
        const t = await traces(m, A.userId);
        if (t.zones !== 0 || t.gates !== 0) breaches.push(`zones ou portes marquées écrites : ${JSON.stringify(t)}`);
        assert.deepEqual(breaches, [], `REST directe sur les zones :\n${list(breaches)}`);
    });
});

// ── f. Scanner ─────────────────────────────────────────────────────────────

describe('f. scanner : mêmes verdicts, zones créées avec l’événement ou ajoutées après', () => {
    const SIMPLE = 'Simple';
    const VIP = 'VIP';
    const TARDIVE = 'Tardive';
    // Deux zones d'entrée (Simple d'un côté, VIP de l'autre), un carré VIP qui cite VIP deux fois
    const ZONES_BY_REF = [
        { name: 'Entrée générale', kind: 'ENTREE', category_refs: [0], gates: [{ name: 'Porte générale' }] },
        { name: 'Entrée VIP', kind: 'ENTREE', category_refs: [1], gates: [{ name: 'Porte VIP' }] },
        { name: 'Carré VIP', kind: 'CONTROLE', category_refs: [1, 1], gates: [{ name: 'Porte carré' }] },
    ];

    function gateIdOf(config: Row, gateName: string): string {
        for (const z of (config.zones ?? []) as Row[]) {
            for (const g of (z.gates ?? []) as Row[]) if (g.name === gateName) return String(g.id);
        }
        assert.fail(`porte ${gateName} absente : ${JSON.stringify(config.zones)}`);
    }

    async function saleEventOf(eventId: string): Promise<SaleEvent> {
        const { data, error } = await service.from('ticket_categories').select('id, name, price, total_quantity').eq('event_id', eventId);
        assert.equal(error, null, error?.message);
        const categories: SaleEvent['categories'] = {};
        for (const c of data ?? []) categories[String(c.name)] = { id: String(c.id), price: Number(c.price), total: Number(c.total_quantity) };
        return { eventId, categories };
    }

    function shape(config: Row): string {
        const names = new Map(((config.categories ?? []) as Row[]).map((c) => [String(c.id), String(c.name)]));
        return JSON.stringify(((config.zones ?? []) as Row[]).map((z) => ({
            name: z.name, kind: z.kind,
            admits: ((z.category_ids ?? []) as string[]).map((id) => names.get(id) ?? id).sort(),
            gates: ((z.gates ?? []) as Row[]).map((g) => String(g.name)).sort(),
        })));
    }

    async function verdicts(atCreation: boolean): Promise<{ config: string; steps: string[] }> {
        // Libellés sans accent : ils entrent dans l'adresse email des comptes de test
        const label = atCreation ? 'avec' : 'apres';
        const r = await postEvent(A.accessToken, eventBody(`TEST CVF2B-1 f ${label} ${mark()}`, posterA, [
            { name: SIMPLE, price: 5_000, total_quantity: 100 },
            { name: VIP, price: 20_000, total_quantity: 20 },
        ], atCreation ? { zones: ZONES_BY_REF } : {}, { soon: true }));
        assert.equal(r.status, 201, `création (${label}) : ${show(r)}`);
        const eventId = createdId(r);
        assert.ok(eventId, `identifiant de l'événement (${label}) : ${show(r)}`);
        if (!atCreation) {
            const ev0 = await saleEventOf(eventId);
            const put = await saveZones(A, eventId, { zones: ZONES_BY_REF.map((z) => ({
                name: z.name, kind: z.kind, gates: z.gates,
                category_ids: z.category_refs.map((i) => ev0.categories[[SIMPLE, VIP][i]].id),
            })) });
            assert.equal(put.status, 200, `zones ajoutées après (montage) : ${show(put as Reply)}`);
        }
        // Catégorie ajoutée APRÈS les zones (dans les deux cas) : admise par les seules zones d'entrée
        const late = await postCategory(A.accessToken, eventId, { name: TARDIVE, price: 3_000, total_quantity: 10 });
        assert.equal(late.status, 201, `catégorie ajoutée après les zones (${label}) : ${show(late)}`);
        await advanceEventTo(eventId, 'PUBLIE', { partnerUserId: A.userId });
        const configRes = await getZones(A, eventId);
        assert.equal(configRes.status, 200, `configuration (${label}) : ${show(configRes as Reply)}`);
        const config = configRes.body;
        const ev = await saleEventOf(eventId);
        const ctrls: Record<string, Buyer> = {};
        for (const gate of ['Porte générale', 'Porte VIP', 'Porte carré']) {
            const c = await newController(A, eventId, { label: `cvf2b-${label}-${gate.replace(/[^a-z]/gi, '').toLowerCase()}` });
            const a = await assignGate(A, eventId, c.userId, gateIdOf(config, gate));
            assert.equal(a.status, 200, `porte ${gate} (${label}) : ${show(a as Reply)}`);
            ctrls[gate] = c;
        }
        const buyer = await newBuyer(`cvf2b-f-${label}`, { firstName: 'Awa', lastName: 'Spectatrice' });
        const [simple] = (await buyConfirmed(buyer, ev, [[SIMPLE, 1]])).tickets;
        const [vip] = (await buyConfirmed(buyer, ev, [[VIP, 1]])).tickets;
        const [tardive] = (await buyConfirmed(buyer, ev, [[TARDIVE, 1]])).tickets;
        const steps: Array<[string, Row, string]> = [
            ['Porte VIP', simple, 'Simple à l’entrée VIP'],
            ['Porte générale', simple, 'Simple à l’entrée générale'],
            ['Porte carré', simple, 'Simple au carré'],
            ['Porte carré', tardive, 'Tardive au carré avant d’entrer'],
            ['Porte VIP', tardive, 'Tardive à l’entrée VIP'],
            ['Porte générale', tardive, 'Tardive à l’entrée générale, déjà entrée'],
            ['Porte carré', tardive, 'Tardive au carré, entrée'],
            ['Porte générale', vip, 'VIP à l’entrée générale'],
            ['Porte carré', vip, 'VIP au carré avant d’entrer'],
            ['Porte VIP', vip, 'VIP à l’entrée VIP'],
            ['Porte carré', vip, 'VIP au carré, entrée'],
        ];
        const out: string[] = [];
        for (const [gate, ticket, what] of steps) {
            const s: RouteResult = await scanAtGate(ctrls[gate], { eventId, payload: await ticketPayload(String(ticket.id)) }, gateIdOf(config, gate));
            assert.equal(s.status, 200, `${what} (${label}) : ${show(s as Reply)}`);
            const line = `${what} : ${String(s.body.result)} ${JSON.stringify(s.body.redirect_zones ?? null)}`;
            console.log(`[CVF2B-1] scanner, zones ${atCreation ? 'à la création' : 'ajoutées après'} : ${line}`);
            out.push(line);
        }
        return { config: shape(config), steps: out };
    }

    test('mêmes zones lues et mêmes verdicts, catégorie tardive comprise', async () => {
        const created = await verdicts(true);
        const added = await verdicts(false);
        console.log(`[CVF2B-1] configuration, à la création : ${created.config}`);
        console.log(`[CVF2B-1] configuration, ajoutées après : ${added.config}`);
        assert.equal(created.config, added.config, 'configurations différentes selon le moment de création des zones');
        assert.deepEqual(created.steps, added.steps, 'verdicts différents selon le moment de création des zones');
        const results = created.steps.map((s) => s.split(' : ')[1].split(' ')[0]);
        // Verdicts sûrs attendus : mauvaise zone à une entrée qui n'admet pas la catégorie, entrée validée par la bonne entrée,
        // tardive admise par les deux entrées seulement, carré VIP pour le seul VIP entré
        assert.deepEqual(
            [results[0], results[1], results[2], results[4], results[5], results[6], results[7], results[9], results[10]],
            ['wrong_zone', 'valid', 'wrong_zone', 'valid', 'already_used', 'wrong_zone', 'wrong_zone', 'valid', 'zone_ok'],
            `verdicts : ${JSON.stringify(created.steps)}`,
        );
    });
});
