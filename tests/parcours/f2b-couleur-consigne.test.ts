/**
 * Finition 2b (A, E-22) — couleur au contrôle et consigne d'entrée saisissables dès la création de l'événement, et sur une
 * catégorie nouvelle en modification. Mon état des lieux du 15/11 (point 2) : seulement dans Modifier › Billets, sur une
 * catégorie déjà enregistrée ; le schéma de création refusait les deux clés (.strict()), ticket_category_normalize aussi,
 * et l'insertion de event_create ne les avait pas.
 *  a. Création par la route : couleur et consigne de chaque catégorie enregistrées.
 *  b. Couleur hors de la palette, consigne de 61 caractères : refus rangé sous la bonne catégorie (route et base).
 *  c. Catégorie nouvelle en modification (POST …/categories) : couleur et consigne enregistrées (garde-fou, déjà permis).
 *  d. Écran : les champs « Couleur au contrôle » et « Consigne d'entrée » ne sont plus réservés aux catégories
 *     enregistrées, et partent avec le corps de création.
 * Rouge avant le correctif : 400 FIELD_NOT_EDITABLE ou clé inconnue à la création ; champs absents de l'écran. Sortie
 * brute `[F2B-A1]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { routeContext } from './helpers';
import { importModule, service, type Buyer } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { createDraftEvent, storedPosterUrl } from './cycle-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
interface Reply { status: number; body: Row }

const ROOT = process.cwd();
const DAY_MS = 86_400_000;

let P: TestPartner;
let poster: string;

before(async () => {
    P = await newPartner('f2b-couleur');
    poster = await storedPosterUrl(P.partnerId);
});

after(async () => {
    await assertFinition1Invariants('f2b-couleur-consigne');
});

async function call(modPath: string, method: string, req: NextRequest, ctx?: unknown): Promise<Reply> {
    const mod = await importModule(modPath);
    assert.equal(typeof mod[method], 'function', `${modPath} : ${method} exporté`);
    const res = await (mod[method] as Handler)(req, ctx);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? (JSON.parse(text) as Row) : {};
    } catch {
        body = { raw: text.slice(0, 2000) };
    }
    return { status: res.status, body };
}

function show(r: Reply): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 900)}`;
}

function day(offset: number): string {
    return new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10);
}

function createBody(label: string, categories: Row[]): Row {
    const d = day(12);
    return {
        title: `TEST Couleurs ${label} ${Date.now().toString(36)}`,
        category: 'CONCERT',
        start_date: d, start_time: '20:00', end_date: d, end_time: '23:30',
        location: 'Grand Théâtre de Dakar', city: 'Dakar', latitude: 14.6937, longitude: -17.4441,
        image_url: poster, capacity: 300,
        ticket_categories: categories,
    };
}

async function postEvent(user: Buyer, body: Row): Promise<Reply> {
    return call('../../app/api/partner/events/route', 'POST', jsonRequest('/api/partner/events', 'POST', user.accessToken, body));
}

async function categoriesByName(eventId: string): Promise<Record<string, Row>> {
    const { data, error } = await service.from('ticket_categories').select('name, scan_color, entry_instruction').eq('event_id', eventId);
    assert.equal(error, null, error?.message);
    return Object.fromEntries((data ?? []).map((r) => [String(r.name), r as Row]));
}

function eventIdOf(r: Reply): string {
    const ev = (r.body.event ?? r.body.data ?? null) as Row | null;
    const id = (ev?.id ?? r.body.event_id ?? r.body.id) as string | undefined;
    assert.ok(typeof id === 'string', `identifiant de l'événement créé : ${show(r)}`);
    return id;
}

function fieldPaths(r: Reply): string[] {
    const fields = Array.isArray(r.body.fields) ? (r.body.fields as Row[]) : [];
    return [...fields.map((f) => String(f.path)), ...(typeof r.body.field === 'string' ? [r.body.field] : [])];
}

describe('a. création : couleur et consigne de chaque catégorie enregistrées', () => {
    test('POST /api/partner/events avec scan_color et entry_instruction', async () => {
        const r = await postEvent(P, createBody('a', [
            { name: 'Standard', price: 0, total_quantity: 100, scan_color: 'BLEU', entry_instruction: 'Bracelet bleu' },
            { name: 'VIP', price: 0, total_quantity: 20, scan_color: 'VIOLET', entry_instruction: 'Remettre bracelet doré' },
        ]));
        console.log(`[F2B-A1] création avec couleurs et consignes : ${show(r)}`);
        assert.equal(r.status, 201, show(r));
        const cats = await categoriesByName(eventIdOf(r));
        assert.deepEqual(cats.Standard, { name: 'Standard', scan_color: 'BLEU', entry_instruction: 'Bracelet bleu' });
        assert.deepEqual(cats.VIP, { name: 'VIP', scan_color: 'VIOLET', entry_instruction: 'Remettre bracelet doré' });
    });
});

describe('b. refus rangés sous la bonne catégorie', () => {
    test('route : couleur hors de la palette (2e catégorie) → champ ticket_categories.1.scan_color', async () => {
        const r = await postEvent(P, createBody('b1', [
            { name: 'Standard', price: 0, total_quantity: 100, scan_color: 'BLEU' },
            { name: 'VIP', price: 0, total_quantity: 20, scan_color: 'VERT' },
        ]));
        console.log(`[F2B-A1] couleur VERT : ${show(r)}`);
        assert.equal(r.status, 400, show(r));
        assert.ok(fieldPaths(r).includes('ticket_categories.1.scan_color'), `chemin du refus : ${JSON.stringify(fieldPaths(r))}`);
    });

    test('route : consigne de 61 caractères (1re catégorie) → champ ticket_categories.0.entry_instruction', async () => {
        const r = await postEvent(P, createBody('b2', [{ name: 'Standard', price: 0, total_quantity: 100, entry_instruction: 'x'.repeat(61) }]));
        assert.equal(r.status, 400, show(r));
        assert.ok(fieldPaths(r).includes('ticket_categories.0.entry_instruction'), `chemin du refus : ${JSON.stringify(fieldPaths(r))}`);
    });

    test('base : event_create refuse la même couleur avec le même chemin, et accepte une couleur valide', async () => {
        const event = { title: `TEST Couleurs base ${Date.now().toString(36)}`, category: 'CONCERT', start_date: day(12), start_time: '20:00',
            location: 'Salle de test', city: 'Dakar', latitude: 14.6937, longitude: -17.4441 };
        const refused = await service.rpc('event_create', { p: { actor_id: P.userId, event,
            ticket_categories: [{ name: 'Standard', price: 0, total_quantity: 10 }, { name: 'VIP', price: 0, total_quantity: 5, scan_color: 'VERT' }] } });
        console.log(`[F2B-A1] RPC event_create, couleur VERT : ${JSON.stringify(refused.data)} ${refused.error?.message ?? ''}`);
        assert.equal(refused.error, null, refused.error?.message);
        assert.equal((refused.data as Row).ok, false, JSON.stringify(refused.data));
        assert.equal((refused.data as Row).field, 'ticket_categories.1.scan_color', JSON.stringify(refused.data));
        const ok = await service.rpc('event_create', { p: { actor_id: P.userId, event: { ...event, title: `${event.title} bis` },
            ticket_categories: [{ name: 'Standard', price: 0, total_quantity: 10, scan_color: 'ROSE', entry_instruction: '  Tampon   rose  ' }] } });
        assert.equal(ok.error, null, ok.error?.message);
        assert.equal((ok.data as Row).ok, true, JSON.stringify(ok.data));
        const cats = await categoriesByName(String((ok.data as Row).event_id));
        assert.deepEqual(cats.Standard, { name: 'Standard', scan_color: 'ROSE', entry_instruction: 'Tampon rose' }, 'consigne nettoyée comme à la création seule');
    });
});

describe('c. catégorie nouvelle en modification : couleur et consigne enregistrées', () => {
    test('POST /api/partner/events/[id]/categories avec scan_color et entry_instruction', async () => {
        const ev = await createDraftEvent(P, 'f2b-a1-modif', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 96 });
        const r = await call('../../app/api/partner/events/[id]/categories/route', 'POST',
            jsonRequest(`/api/partner/events/${ev.eventId}/categories`, 'POST', P.accessToken,
                { name: 'VIP', price: 0, total_quantity: 5, scan_color: 'TURQUOISE', entry_instruction: 'Accès carré' }),
            routeContext({ id: ev.eventId }));
        assert.equal(r.status, 201, show(r));
        const cats = await categoriesByName(ev.eventId);
        assert.deepEqual(cats.VIP, { name: 'VIP', scan_color: 'TURQUOISE', entry_instruction: 'Accès carré' });
    });
});

describe('d. écran : champs ouverts à toute catégorie, envoyés à la création', () => {
    const source = fs.readFileSync(path.join(ROOT, 'components/events/EventTicketing.tsx'), 'utf8');
    test('« Au contrôle des entrées » n’est plus réservé aux catégories enregistrées', () => {
        assert.doesNotMatch(source, /scanFields\s*=\s*showLocks\s*&&\s*draft\.id\s*!==\s*null/, 'champs de contrôle réservés aux catégories enregistrées');
        assert.match(source, /Au contrôle des entrées/);
    });
    test('categoryCreateBody envoie scan_color et entry_instruction', () => {
        const start = source.indexOf('export function categoryCreateBody');
        assert.ok(start >= 0, 'categoryCreateBody exportée');
        const body = source.slice(start, source.indexOf('\n}\n', start));
        assert.match(body, /scan_color/, `corps de création : ${body}`);
        assert.match(body, /entry_instruction/, `corps de création : ${body}`);
    });
});
