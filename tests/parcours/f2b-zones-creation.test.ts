/**
 * Finition 2b (B, E-23) — étape 5 « Contrôle à l'entrée (facultatif) » : portes et zones réglées dès la création, dans la
 * même transaction que l'événement (fonctions communes event_zones_form_refusal et event_zones_write, extraites de
 * event_zones_save) ; catégories insérées avant les zones et désignées par leur ordre ; mêmes règles qu'aujourd'hui.
 *  a. Création par la route avec deux zones : configuration lue par GET …/zones (types, catégories admises, portes).
 *  b. Refus à la création (zone sans porte, catégorie qui n'entre par aucune zone d'entrée, catégorie inconnue) : texte et
 *     champ de l'enregistrement des zones, RIEN n'est créé (ni événement, ni catégorie).
 *  c. Mêmes verdicts au scanner, que les zones soient créées avec l'événement ou ajoutées après (PUT …/zones) : pas encore
 *     entré, mauvaise zone, entrée validée, zone vérifiée.
 *  d. Écran : étape 5 « Contrôle à l'entrée (facultatif) », texte « Une seule entrée : chaque contrôleur laisse entrer
 *     toutes les catégories. », zones envoyées avec la création ; le lien « Modifier les portes et les couleurs » mène à
 *     l'étape du formulaire.
 * Rouge avant le correctif : `zones` refusé à la création (clé inconnue du schéma), étape absente. Sortie brute
 * `[F2B-B]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { newController, ticketPayload, type RouteResult } from './acces-helpers';
import { advanceEventTo, storedPosterUrl } from './cycle-helpers';
import { assignGate, getZones, saveZones, scanAtGate } from './zones-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const ROOT = process.cwd();
const SIMPLE = 'Simple';
const VIP = 'VIP';

let P: TestPartner;
let poster: string;
let buyer: Buyer;

before(async () => {
    P = await newPartner('f2b-zones');
    poster = await storedPosterUrl(P.partnerId);
    buyer = await newBuyer('f2b-zones', { firstName: 'Awa', lastName: 'Spectatrice' });
});

after(async () => {
    await assertFinition1Invariants('f2b-zones-creation');
});

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 900)}`;
}

/** Début dans 90 minutes (fenêtre de contrôle ouverte, début dans le futur), heure de Dakar (UTC). */
function soon(): { start_date: string; start_time: string } {
    const d = new Date(Date.now() + 90 * 60_000);
    return { start_date: d.toISOString().slice(0, 10), start_time: d.toISOString().slice(11, 16) };
}

function createBody(title: string, zones?: unknown): Row {
    return {
        title, category: 'CONCERT', ...soon(), location: 'Esplanade de test', city: 'Dakar', latitude: 14.6937, longitude: -17.4441,
        image_url: poster, capacity: 200,
        ticket_categories: [
            { name: SIMPLE, price: 5_000, total_quantity: 100 },
            { name: VIP, price: 20_000, total_quantity: 20 },
        ],
        ...(zones === undefined ? {} : { zones }),
    };
}

const ZONES_BY_REF = [
    { name: 'Entrée générale', kind: 'ENTREE', category_refs: [0, 1], gates: [{ name: 'Porte principale' }] },
    { name: 'Carré VIP', kind: 'CONTROLE', category_refs: [1], gates: [{ name: 'Porte VIP' }] },
];

async function postEvent(body: Row): Promise<RouteResult> {
    const mod = await importModule('../../app/api/partner/events/route');
    const res = await (mod.POST as Handler)(jsonRequest('/api/partner/events', 'POST', P.accessToken, body));
    const text = await res.text();
    let parsed: Row = {};
    try {
        parsed = text ? (JSON.parse(text) as Row) : {};
    } catch {
        parsed = { raw: text.slice(0, 2000) };
    }
    return { status: res.status, body: parsed };
}

async function eventsTitled(title: string): Promise<number> {
    const { data, error } = await service.from('events').select('id').eq('title', title);
    assert.equal(error, null, error?.message);
    return (data ?? []).length;
}

async function saleEventOf(eventId: string): Promise<SaleEvent> {
    const { data, error } = await service.from('ticket_categories').select('id, name, price, total_quantity').eq('event_id', eventId);
    assert.equal(error, null, error?.message);
    const categories: SaleEvent['categories'] = {};
    for (const c of data ?? []) categories[String(c.name)] = { id: String(c.id), price: Number(c.price), total: Number(c.total_quantity) };
    return { eventId, categories };
}

/** Configuration lue : par zone, type, catégories admises (noms) et portes (noms). */
function shape(config: Row): Array<{ name: string; kind: string; admits: string[]; gates: string[] }> {
    const cats = new Map(((config.categories ?? []) as Row[]).map((c) => [String(c.id), String(c.name)]));
    return ((config.zones ?? []) as Row[]).map((z) => ({
        name: String(z.name),
        kind: String(z.kind),
        admits: ((z.category_ids ?? []) as string[]).map((id) => cats.get(id) ?? id).sort(),
        gates: ((z.gates ?? []) as Row[]).map((g) => String(g.name)).sort(),
    }));
}

function gateIdOf(config: Row, gateName: string): string {
    for (const z of (config.zones ?? []) as Row[]) {
        for (const g of (z.gates ?? []) as Row[]) if (g.name === gateName) return String(g.id);
    }
    assert.fail(`porte ${gateName} absente : ${JSON.stringify(config.zones)}`);
}

describe('a. création avec ses zones', () => {
    test('POST /api/partner/events avec deux zones : configuration lue par GET …/zones', async () => {
        const r = await postEvent(createBody(`TEST Zones création ${Date.now().toString(36)}`, ZONES_BY_REF));
        console.log(`[F2B-B] création avec zones : ${show(r)}`);
        assert.equal(r.status, 201, show(r));
        const eventId = String((r.body.event as Row).id);
        const config = await getZones(P, eventId);
        assert.equal(config.status, 200, show(config));
        assert.deepEqual(shape(config.body), [
            { name: 'Entrée générale', kind: 'ENTREE', admits: [SIMPLE, VIP].sort(), gates: ['Porte principale'] },
            { name: 'Carré VIP', kind: 'CONTROLE', admits: [VIP], gates: ['Porte VIP'] },
        ]);
    });
});

describe('b. refus à la création : texte et champ des zones, rien n’est créé', () => {
    const cases: Array<[string, unknown, string, string]> = [
        ['zone sans porte', [ZONES_BY_REF[0], { ...ZONES_BY_REF[1], gates: [] }], 'ZONE_WITHOUT_GATE', 'zones.1.gates'],
        ['catégorie sans zone d’entrée', [{ ...ZONES_BY_REF[0], category_refs: [0] }, ZONES_BY_REF[1]], 'CATEGORY_WITHOUT_ENTRANCE', ''],
        ['catégorie inconnue', [{ ...ZONES_BY_REF[0], category_refs: [0, 5] }, ZONES_BY_REF[1]], 'INVALID_INPUT', 'zones.0.category_refs'],
    ];
    for (const [label, zones, code, field] of cases) {
        test(label, async () => {
            const title = `TEST Zones refus ${label} ${Date.now().toString(36)}`;
            const r = await postEvent(createBody(title, zones));
            console.log(`[F2B-B] ${label} : ${show(r)}`);
            assert.ok(r.status === 400 || r.status === 409, show(r));
            assert.equal(r.body.code, code, show(r));
            if (field) assert.equal(r.body.field, field, show(r));
            assert.equal(await eventsTitled(title), 0, 'événement créé malgré le refus des zones');
        });
    }
});

describe('c. mêmes verdicts au scanner, zones créées avec l’événement ou ajoutées après', () => {
    async function verdicts(withZonesAtCreation: boolean): Promise<string[]> {
        const label = withZonesAtCreation ? 'avec' : 'après';
        const r = await postEvent(createBody(`TEST Zones verdicts ${label} ${Date.now().toString(36)}`, withZonesAtCreation ? ZONES_BY_REF : undefined));
        assert.equal(r.status, 201, show(r));
        const eventId = String((r.body.event as Row).id);
        const ev = await saleEventOf(eventId);
        if (!withZonesAtCreation) {
            const put = await saveZones(P, eventId, { zones: ZONES_BY_REF.map((z) => ({
                name: z.name, kind: z.kind, gates: z.gates,
                category_ids: z.category_refs.map((i) => ev.categories[[SIMPLE, VIP][i]].id),
            })) });
            assert.equal(put.status, 200, `zones ajoutées après : ${show(put)}`);
        }
        await advanceEventTo(eventId, 'PUBLIE', { partnerUserId: P.userId });
        const config = (await getZones(P, eventId)).body;
        const principale = await newController(P, eventId, { label: `f2b-${label}-principale` });
        const carre = await newController(P, eventId, { label: `f2b-${label}-carre` });
        for (const [ctrl, gate] of [[principale, 'Porte principale'], [carre, 'Porte VIP']] as const) {
            const a = await assignGate(P, eventId, ctrl.userId, gateIdOf(config, gate));
            assert.equal(a.status, 200, `porte ${gate} : ${show(a)}`);
        }
        const [simple] = (await buyConfirmed(buyer, ev, [[SIMPLE, 1]])).tickets;
        const [vip] = (await buyConfirmed(buyer, ev, [[VIP, 1]])).tickets;
        const qr = async (t: Row) => ({ eventId, payload: await ticketPayload(String(t.id)) });
        const steps: Array<[Buyer, Row, string]> = [
            [carre, vip, 'Porte VIP'], [carre, simple, 'Porte VIP'], [principale, vip, 'Porte principale'],
            [carre, vip, 'Porte VIP'], [principale, simple, 'Porte principale'],
        ];
        const out: string[] = [];
        for (const [ctrl, ticket, gate] of steps) {
            const s = await scanAtGate(ctrl, await qr(ticket), gateIdOf(config, gate));
            assert.equal(s.status, 200, show(s));
            out.push(String(s.body.result));
        }
        return out;
    }

    test('pas encore entré, mauvaise zone, entrée validée, zone vérifiée : identiques', async () => {
        const created = await verdicts(true);
        const added = await verdicts(false);
        console.log(`[F2B-B] verdicts, zones à la création : ${JSON.stringify(created)} ; zones ajoutées après : ${JSON.stringify(added)}`);
        assert.deepEqual(created, ['not_entered', 'wrong_zone', 'valid', 'zone_ok', 'valid']);
        assert.deepEqual(created, added);
    });
});

describe('d. écran : étape 5, une seule entrée par défaut, lien de l’équipe', () => {
    const form = fs.readFileSync(path.join(ROOT, 'components/events/EventForm.tsx'), 'utf8');
    const panel = fs.readFileSync(path.join(ROOT, 'components/partner/team/TeamPanel.tsx'), 'utf8');
    test('étape « Contrôle à l’entrée (facultatif) » ; zones envoyées avec la création', () => {
        assert.match(form, /Contrôle à l’entrée \(facultatif\)/);
        assert.match(form, /zones/);
        const step = fs.readFileSync(path.join(ROOT, 'components/events/EntryControlStep.tsx'), 'utf8');
        assert.match(step, /Une seule entrée : chaque contrôleur laisse entrer toutes les catégories\./);
    });
    test('« Modifier les portes et les couleurs » mène à l’étape du formulaire', () => {
        assert.match(panel, /Modifier les portes et les couleurs/);
        assert.match(panel, /\/edit\?etape=controle/);
        assert.doesNotMatch(panel, /#portes-et-couleurs/);
    });
});
