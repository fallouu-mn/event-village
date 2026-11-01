/**
 * Lot 5, tâche 5.6 — validation serveur par un schéma partagé (constats events-cdc-6, -13, partner-ux-11,
 * -12). Contrat : section F1 de la conception du lot 5 (et F3 pour EVENT_START_PAST au changement de date).
 *  - schéma Zod unique lib/validations/event.ts, utilisé par le formulaire (components/events/EventForm.tsx)
 *    et par le serveur (POST /api/partner/events, PUT /api/partner/events/[id] : 400 avec la liste des
 *    champs en cause), en .strict() (clé inconnue refusée) ;
 *  - titre 3 à 120 caractères, description ≤ 5000, lieu 2 à 200, ville 2 à 80, chaque info pratique ≤ 300 ;
 *    catégorie d'événement obligatoire parmi CONCERT, FESTIVAL, FOOD, SALLE ; latitude −90 à 90, longitude
 *    −180 à 180 ;
 *  - dates en Africa/Dakar : start_date et start_time obligatoires, end_date exigée si end_time, début dans
 *    le futur à la création et à chaque changement de date (EVENT_START_PAST), fin après le début
 *    (EVENT_END_BEFORE_START) ;
 *  - affiche : `${SUPABASE_URL}/storage/v1/object/public/public-images/events/<partner_id>/…` seulement
 *    (IMAGE_ORIGIN_INVALID) ;
 *  - programme : au plus 50 lignes { id uuid, time HH:mm, kind ARTISTE | INTERVENANT | ACTIVITE,
 *    title ≤ 120, participant ≤ 120 ?, description ≤ 500 ?, day ? }, lignes vides retirées, tri par
 *    (jour, heure) ;
 *  - catégorie de billet : nom 1 à 60, description ≤ 300, prix entier 0 à 10 000 000, quota entier 1 à
 *    100 000, max_per_order entier 1 à 50, dates de vente datetime-local de Dakar avec début < fin ≤ fin de
 *    l'événement ;
 *  - CHECK en base : prix entier (price = trunc(price)).
 * Interface du module choisie ici, le contrat étant muet (signalée au rapport) :
 *  - createEventSchema(ctx: { partnerId, now? }) : schéma Zod du corps de POST /api/partner/events
 *    (événement et ticket_categories) ;
 *  - updateEventSchema(ctx: { partnerId, current: { start_date, start_time, end_date, end_time }, now? }) :
 *    schéma Zod du `patch` de PUT /api/partner/events/[id] (champs facultatifs) ;
 *  - codes métier portés par l'issue Zod dans params.code (EVENT_START_PAST, EVENT_END_BEFORE_START,
 *    IMAGE_ORIGIN_INVALID) ; chemins d'issue pointés (« ticket_categories.0.price ») ; clé inconnue : issue
 *    unrecognized_keys (ou issue sur le chemin de la clé) ;
 *  - ligne de programme vide : heure, titre, participant et description vides (le type choisi par défaut dans
 *    le formulaire ne compte pas) ; une ligne sans `day` se range au jour du début ;
 *  - réponse 400 des routes : { error, code, fields: [{ path, code?, message }] } (ou { chemin: message }) ;
 *    corps du PUT : { patch, expected_updated_at } (comme edition-formulaire).
 * Fuseau : les règles sont calculées à Dakar (UTC+0) quel que soit le fuseau du processus ; les tests le
 * vérifient en changeant process.env.TZ (Pacific/Kiritimati UTC+14, Pacific/Pago_Pago UTC−11).
 * Rouge avant correctif : lib/validations/ ne contient que auth.ts, payment.ts et transfer.ts (aucun schéma
 * d'événement) ; le serveur ne contrôle que la présence du titre, des dates et du lieu
 * (lib/events/event.service.ts:98-106) et passe le corps brut (app/api/partner/events/route.ts:49-50,
 * app/api/partner/events/[id]/route.ts:53-66) ; en BROUILLON, le PUT ignore les clés non reconnues
 * (service:280-316) ; price NUMERIC(12,2) sans contrainte d'entier (supabase/migrations/0001_initial_schema.sql:317) ;
 * chaque formulaire a son schéma local (app/partner/events/new/page.tsx:55-91, app/partner/events/[id]/edit/page.tsx:39-57) ;
 * components/events/EventForm.tsx absent.
 * La suite crée son partenaire et ses événements.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { routeContext } from './helpers';
import { importModule, service, type Buyer } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { createDraftEvent, posterUrl } from './cycle-helpers';

const ROOT = process.cwd();
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/** Partenaire des tests du schéma seul (aucune écriture en base). */
const SCHEMA_PARTNER_ID: string = randomUUID();

let partner: TestPartner;

before(async () => {
    partner = await newPartner('edition-valid');
});

after(async () => {
    await assertLifecycleInvariants('edition-validation');
});

// ── Schéma (import dynamique : le module n'existe pas avant le correctif) ──

type Row = Record<string, unknown>;
interface Issue { code: string; path: Array<string | number>; message: string; params?: Row; keys?: string[] }
interface Parsed { success: boolean; data?: Row; error?: { issues: Issue[] } }
interface Schema { safeParse(input: unknown): Parsed }
interface EventDates { start_date: string; start_time: string; end_date: string | null; end_time: string | null }
interface EventSchemas {
    createEventSchema(ctx: { partnerId: string; now?: Date }): Schema;
    updateEventSchema(ctx: { partnerId: string; current: EventDates; now?: Date }): Schema;
}

async function schemas(): Promise<EventSchemas> {
    let mod: Row;
    try {
        mod = await importModule('../../lib/validations/event');
    } catch (err) {
        assert.fail(`schéma partagé lib/validations/event.ts introuvable (contrat F1) : ${err instanceof Error ? err.message : String(err)}`);
    }
    assert.equal(typeof mod.createEventSchema, 'function', 'lib/validations/event.ts : createEventSchema(ctx) exporté');
    assert.equal(typeof mod.updateEventSchema, 'function', 'lib/validations/event.ts : updateEventSchema(ctx) exporté');
    return mod as unknown as EventSchemas;
}

async function parseCreate(input: unknown, partnerId = SCHEMA_PARTNER_ID): Promise<Parsed> {
    return (await schemas()).createEventSchema({ partnerId }).safeParse(input);
}

async function parseUpdate(current: EventDates, patch: unknown): Promise<Parsed> {
    return (await schemas()).updateEventSchema({ partnerId: SCHEMA_PARTNER_ID, current }).safeParse(patch);
}

function issuesOf(r: Parsed): Issue[] {
    return r.success ? [] : (r.error?.issues ?? []);
}

function show(r: Parsed): string {
    return JSON.stringify(issuesOf(r).map((i) => ({ path: i.path.join('.'), code: i.code, params: i.params, keys: i.keys, message: i.message })));
}

function expectValid(r: Parsed, label: string): Row {
    assert.equal(r.success, true, `${label} : accepté attendu, refusé : ${show(r)}`);
    return (r.data ?? {}) as Row;
}

interface IssueMatch {
    /** Chemin pointé de l'issue (un parmi la liste). */
    path?: string | string[];
    /** Code métier (issue.params.code). */
    code?: string;
    /** Clé inconnue : issue unrecognized_keys au chemin `parent` qui la cite, ou issue au chemin `parent.key`. */
    key?: string;
    parent?: string;
}

function matches(i: Issue, m: IssueMatch): boolean {
    const p = i.path.join('.');
    if (m.key !== undefined) {
        const parent = m.parent ?? '';
        const own = parent ? `${parent}.${m.key}` : m.key;
        return (i.code === 'unrecognized_keys' && p === parent && (i.keys ?? []).includes(m.key)) || p === own;
    }
    if (m.path !== undefined && !(Array.isArray(m.path) ? m.path : [m.path]).includes(p)) return false;
    if (m.code !== undefined && i.params?.code !== m.code) return false;
    return true;
}

function expectIssue(r: Parsed, label: string, m: IssueMatch): void {
    assert.equal(r.success, false, `${label} : refus attendu, accepté : ${JSON.stringify(r.data)}`);
    assert.ok(issuesOf(r).some((i) => matches(i, m)), `${label} : issue attendue ${JSON.stringify(m)}, reçues : ${show(r)}`);
}

// ── Données ────────────────────────────────────────────────────────────────

function dakarDay(offsetDays: number): string {
    return new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

/** Date et heure de Dakar (UTC+0) d'un instant, heure au format HH:mm. */
function dakarParts(ms: number): { date: string; time: string } {
    const iso = new Date(ms).toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** Corps de création conforme (début J+10 20:00 à Dakar, fin 23:30). */
function base(partnerId = SCHEMA_PARTNER_ID, overrides: Row = {}): Row {
    const d = dakarDay(10);
    return {
        title: 'Concert de validation',
        category: 'CONCERT',
        description: 'Description de validation.',
        start_date: d,
        start_time: '20:00',
        end_date: d,
        end_time: '23:30',
        location: 'Grand Théâtre de Dakar',
        city: 'Dakar',
        latitude: 14.6937,
        longitude: -17.4441,
        image_url: posterUrl(partnerId),
        capacity: 500,
        program: [{ id: randomUUID(), time: '20:00', kind: 'ARTISTE', title: 'Ouverture', participant: 'Orchestre de test' }],
        practical_info: { address: 'Place de la Nation, Dakar', accessNotes: 'Entrée principale' },
        ticket_categories: [{ name: 'Standard', description: 'Placement libre', price: 5000, total_quantity: 100, max_per_order: 10, sale_end: `${d}T19:00`, is_visible: true }],
        ...overrides,
    };
}

/** Copie de `from` où le chemin pointé reçoit `value` (undefined : clé retirée). */
function variant(from: Row, dotted: string, value: unknown): Row {
    const out = structuredClone(from) as Row;
    const keys = dotted.split('.');
    let cur = out as Record<string, unknown>;
    for (const k of keys.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
    const last = keys[keys.length - 1];
    if (value === undefined) delete cur[last];
    else cur[last] = value;
    return out;
}

/** Corps dont l'événement commence à `startMs` (Dakar) pour 3 h, sans fin de vente (règles de date seules). */
function bodyStartingAt(startMs: number): Row {
    const s = dakarParts(startMs);
    const e = dakarParts(startMs + 3 * HOUR_MS);
    const b = base(SCHEMA_PARTNER_ID, { start_date: s.date, start_time: s.time, end_date: e.date, end_time: e.time });
    b.ticket_categories = [{ name: 'Standard', price: 5000, total_quantity: 100, max_per_order: 10 }];
    return b;
}

/** Exécute `fn` avec le fuseau du processus fixé à `tz` (décalage attendu en minutes, convention getTimezoneOffset). */
async function withTimezone<T>(tz: string, expectedOffset: number, fn: () => Promise<T>): Promise<T> {
    const saved = process.env.TZ;
    process.env.TZ = tz;
    try {
        assert.equal(new Date(Date.UTC(2026, 0, 15, 12)).getTimezoneOffset(), expectedOffset, `fuseau ${tz} appliqué au processus`);
        return await fn();
    } finally {
        if (saved === undefined) delete process.env.TZ;
        else process.env.TZ = saved;
    }
}

// ── Routes ─────────────────────────────────────────────────────────────────

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
interface RouteResult { status: number; body: Row }

async function invoke(handler: Handler, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

async function handlerOf(modulePath: string, method: string): Promise<Handler> {
    const mod = await importModule(modulePath);
    assert.equal(typeof mod[method], 'function', `${modulePath} : gestionnaire ${method} exporté`);
    return mod[method] as Handler;
}

async function postEvent(user: Buyer, body: Row): Promise<RouteResult> {
    const post = await handlerOf('../../app/api/partner/events/route', 'POST');
    return invoke(post, jsonRequest('/api/partner/events', 'POST', user.accessToken, body));
}

async function eventRow(eventId: string): Promise<Row> {
    const { data, error } = await service.from('events').select('*').eq('id', eventId).single();
    assert.equal(error, null, `événement ${eventId} : ${error?.message}`);
    return data as Row;
}

async function putEvent(user: Buyer, eventId: string, patch: Row): Promise<RouteResult> {
    const put = await handlerOf('../../app/api/partner/events/[id]/route', 'PUT');
    const expected = String((await eventRow(eventId)).updated_at);
    return invoke(put, jsonRequest(`/api/partner/events/${eventId}`, 'PUT', user.accessToken, { patch, expected_updated_at: expected }), routeContext({ id: eventId }));
}

async function eventsTitled(title: string): Promise<Row[]> {
    const { data, error } = await service.from('events').select('id').eq('title', title);
    assert.equal(error, null, `événements « ${title} » : ${error?.message}`);
    return (data ?? []) as Row[];
}

const RAW_DB = /violates|constraint|duplicate key|null value|invalid input|syntax error|PGRST|relation "|column "|chk_|_fkey|_pkey|does not exist/i;
const RAW_CODE = /\b(BROUILLON|EN_ATTENTE|VALIDE|PUBLIE|SUSPENDU|TERMINE|ANNULE)\b|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/;

function assertFrenchError(body: Row, label: string): void {
    assert.equal(typeof body.error, 'string', `${label} : message d'erreur attendu : ${JSON.stringify(body)}`);
    const msg = String(body.error);
    assert.ok(msg.trim().length >= 10, `${label} : message d'erreur explicite attendu : ${JSON.stringify(body)}`);
    assert.doesNotMatch(msg, RAW_DB, `${label} : message Postgres brut exposé : ${msg}`);
    assert.doesNotMatch(msg, RAW_CODE, `${label} : code ou enum brut dans le message : ${msg}`);
}

/** Champs en cause d'une réponse 400 : fields (tableau d'objets { path } ou de chemins, ou objet { chemin: message }), puis field. */
function reportedFields(body: Row): string[] {
    const out: string[] = [];
    if (typeof body.field === 'string') out.push(body.field);
    const f = body.fields;
    if (Array.isArray(f)) {
        for (const x of f) {
            if (typeof x === 'string') out.push(x);
            else if (x && typeof x === 'object') {
                const p = (x as Row).path ?? (x as Row).field;
                if (typeof p === 'string') out.push(p);
                else if (Array.isArray(p)) out.push(p.join('.'));
            }
        }
    } else if (f && typeof f === 'object') {
        out.push(...Object.keys(f as Row));
    }
    return out;
}

/** Codes portés par une réponse : code, puis fields[].code. */
function reportedCodes(body: Row): string[] {
    const out: string[] = [];
    if (typeof body.code === 'string') out.push(body.code);
    if (Array.isArray(body.fields)) {
        for (const x of body.fields) if (x && typeof x === 'object' && typeof (x as Row).code === 'string') out.push(String((x as Row).code));
    }
    return out;
}

function stripComments(src: string): string {
    const blank = (m: string): string => m.replace(/[^\n]/g, ' ');
    return src
        .replace(/\/\*[\s\S]*?\*\//g, blank)
        .replace(/(^|[^:\\'"`])(\/\/[^\n]*)/gm, (_m: string, p1: string, c: string) => p1 + blank(c));
}

function code(file: string): string {
    const abs = path.join(ROOT, file);
    assert.ok(fs.existsSync(abs), `${file} absent`);
    return stripComments(fs.readFileSync(abs, 'utf8'));
}

const SHARED_SCHEMA_IMPORT = /from\s+['"](?:@\/|(?:\.\.\/)+)lib\/validations\/event['"]/;

// ── Schéma partagé ─────────────────────────────────────────────────────────

describe('F1 — schéma partagé lib/validations/event.ts', () => {
    test('corps complet conforme : accepté, valeurs conservées', async () => {
        const input = base();
        const data = expectValid(await parseCreate(input), 'corps conforme');
        assert.equal(data.title, input.title, 'titre conservé');
        assert.equal(data.category, 'CONCERT', 'catégorie conservée');
        assert.equal(Array.isArray(data.ticket_categories) ? data.ticket_categories.length : -1, 1, 'catégorie de billet conservée');
    });

    test('clés inconnues refusées (.strict), y compris dans une catégorie de billet ; services et statut ne sont pas des champs du formulaire', async () => {
        for (const [label, input, m] of [
            ['clé inconnue', { ...base(), champ_inconnu: 1 }, { key: 'champ_inconnu' }],
            ['services en entrée', { ...base(), services: { ticketing: true, tableBooking: false, communication: false } }, { key: 'services' }],
            ['statut en entrée', { ...base(), status: 'PUBLIE' }, { key: 'status' }],
            ['slug en entrée', { ...base(), slug: 'impose' }, { key: 'slug' }],
            ['clé inconnue d’une catégorie', variant(base(), 'ticket_categories.0.sold_quantity', 3), { key: 'sold_quantity', parent: 'ticket_categories.0' }],
        ] as Array<[string, Row, IssueMatch]>) {
            expectIssue(await parseCreate(input), label, m);
        }
        const current: EventDates = { start_date: dakarDay(10), start_time: '20:00:00', end_date: dakarDay(10), end_time: '23:30:00' };
        expectIssue(await parseUpdate(current, { description: 'ok', champ_inconnu: true }), 'mise à jour : clé inconnue', { key: 'champ_inconnu' });
    });

    test('longueurs bornées : titre, description, lieu, ville, infos pratiques, catégorie de billet, programme', async () => {
        const x = (n: number): string => 'x'.repeat(n);
        const refused: Array<[string, unknown]> = [
            ['title', 'ab'], ['title', x(121)],
            ['description', x(5001)],
            ['location', 'A'], ['location', x(201)],
            ['city', 'D'], ['city', x(81)],
            ['practical_info.accessNotes', x(301)],
            ['ticket_categories.0.name', ''], ['ticket_categories.0.name', x(61)],
            ['ticket_categories.0.description', x(301)],
            ['program.0.title', x(121)], ['program.0.participant', x(121)], ['program.0.description', x(501)],
        ];
        for (const [p, v] of refused) {
            expectIssue(await parseCreate(variant(base(), p, v)), `${p} de ${String(v).length} caractère(s)`, { path: p });
        }
        const accepted: Array<[string, unknown]> = [
            ['title', 'Bal'], ['title', x(120)],
            ['description', x(5000)],
            ['location', 'Ab'], ['location', x(200)],
            ['city', 'Ab'], ['city', x(80)],
            ['practical_info.accessNotes', x(300)],
            ['ticket_categories.0.name', x(60)],
            ['ticket_categories.0.description', x(300)],
            ['program.0.title', x(120)], ['program.0.participant', x(120)], ['program.0.description', x(500)],
        ];
        for (const [p, v] of accepted) {
            expectValid(await parseCreate(variant(base(), p, v)), `${p} de ${String(v).length} caractère(s) (borne)`);
        }
    });

    test('catégorie d’événement obligatoire, parmi CONCERT, FESTIVAL, FOOD et SALLE', async () => {
        expectIssue(await parseCreate(variant(base(), 'category', undefined)), 'catégorie absente', { path: 'category' });
        expectIssue(await parseCreate(variant(base(), 'category', 'SPORT')), 'catégorie hors liste', { path: 'category' });
        for (const c of ['CONCERT', 'FESTIVAL', 'FOOD', 'SALLE']) {
            expectValid(await parseCreate(variant(base(), 'category', c)), `catégorie ${c}`);
        }
    });

    test('coordonnées : latitude de −90 à 90, longitude de −180 à 180', async () => {
        for (const [p, v] of [['latitude', 90.5], ['latitude', -91], ['longitude', 180.5], ['longitude', -181]] as Array<[string, number]>) {
            expectIssue(await parseCreate(variant(base(), p, v)), `${p} ${v}`, { path: p });
        }
        expectValid(await parseCreate({ ...base(), latitude: -90, longitude: 180 }), 'coordonnées (−90, 180)');
        expectValid(await parseCreate({ ...base(), latitude: 90, longitude: -180 }), 'coordonnées (90, −180)');
    });

    test('montants et quantités entiers et bornés (prix 1500,5 refusé)', async () => {
        const unlimited = { ...base(), capacity: null };
        const refused: Array<[string, number]> = [
            ['ticket_categories.0.price', 1500.5], ['ticket_categories.0.price', -1], ['ticket_categories.0.price', 10_000_001],
            ['ticket_categories.0.total_quantity', 0], ['ticket_categories.0.total_quantity', 100_001], ['ticket_categories.0.total_quantity', 2.5],
            ['ticket_categories.0.max_per_order', 0], ['ticket_categories.0.max_per_order', 51], ['ticket_categories.0.max_per_order', 1.5],
            ['capacity', 10.5],
        ];
        for (const [p, v] of refused) expectIssue(await parseCreate(variant(unlimited, p, v)), `${p} = ${v}`, { path: p });
        const accepted: Array<[string, number]> = [
            ['ticket_categories.0.price', 0], ['ticket_categories.0.price', 10_000_000],
            ['ticket_categories.0.total_quantity', 1], ['ticket_categories.0.total_quantity', 100_000],
            ['ticket_categories.0.max_per_order', 1], ['ticket_categories.0.max_per_order', 50],
        ];
        for (const [p, v] of accepted) expectValid(await parseCreate(variant(unlimited, p, v)), `${p} = ${v} (borne)`);
    });

    test('dates : début obligatoire, end_date exigée si end_time, fin après le début, heures au format HH:mm', async () => {
        const d10 = dakarDay(10);
        const d11 = dakarDay(11);
        const d9 = dakarDay(9);
        expectIssue(await parseCreate(variant(base(), 'start_date', undefined)), 'start_date absente', { path: 'start_date' });
        expectIssue(await parseCreate(variant(base(), 'start_time', undefined)), 'start_time absente', { path: 'start_time' });
        expectIssue(await parseCreate({ ...base(), end_date: null, end_time: '23:30' }), 'end_time sans end_date', { path: 'end_date' });
        expectIssue(await parseCreate({ ...base(), end_date: d10, end_time: '19:00' }), 'fin à 19:00 pour un début à 20:00', { code: 'EVENT_END_BEFORE_START' });
        expectIssue(await parseCreate({ ...base(), end_date: d9, end_time: '23:30' }), 'fin la veille du début', { code: 'EVENT_END_BEFORE_START' });
        for (const t of ['25:00', '20h', '8:5']) {
            expectIssue(await parseCreate(variant(base(), 'start_time', t)), `heure de début « ${t} »`, { path: 'start_time' });
        }
        const noEnd: Row = { ...base(), end_date: null, end_time: null };
        noEnd.ticket_categories = [{ name: 'Standard', price: 5000, total_quantity: 100, max_per_order: 10 }];
        expectValid(await parseCreate(noEnd), 'événement sans fin (fin = début à 23:59)');
        expectValid(await parseCreate({ ...base(), end_date: d11, end_time: '02:00' }), 'soirée qui passe minuit (fin J+1 02:00)');
    });

    test('début dans le futur à la création (EVENT_START_PAST), calculé à Dakar quel que soit le fuseau du processus', async () => {
        expectIssue(await parseCreate(bodyStartingAt(Date.now() - DAY_MS)), 'début hier', { code: 'EVENT_START_PAST' });
        await withTimezone('Pacific/Kiritimati', -840, async () => {
            expectValid(await parseCreate(bodyStartingAt(Date.now() + 2 * HOUR_MS)), 'début dans 2 h à Dakar, processus en UTC+14');
        });
        await withTimezone('Pacific/Pago_Pago', 660, async () => {
            expectIssue(await parseCreate(bodyStartingAt(Date.now() - 2 * HOUR_MS)), 'début il y a 2 h à Dakar, processus en UTC−11', { code: 'EVENT_START_PAST' });
        });
    });

    test('mise à jour : EVENT_START_PAST seulement si les dates changent ; HH:mm égal à HH:mm:ss n’est pas un changement ; fin comparée au début actuel', async () => {
        const started: EventDates = { start_date: dakarDay(-1), start_time: '20:00:00', end_date: dakarDay(1), end_time: '02:00:00' };
        expectValid(await parseUpdate(started, { description: 'Correction pendant l’événement' }), 'événement commencé : champ libre');
        expectValid(await parseUpdate(started, { start_date: started.start_date, start_time: '20:00' }), 'événement commencé : dates renvoyées à l’identique (HH:mm)');
        expectIssue(await parseUpdate(started, { start_date: dakarDay(-2) }), 'événement commencé : début déplacé dans le passé', { code: 'EVENT_START_PAST' });
        expectValid(await parseUpdate(started, { start_date: dakarDay(3), start_time: '20:00', end_date: dakarDay(3), end_time: '23:00' }), 'report dans le futur');
        const future: EventDates = { start_date: dakarDay(3), start_time: '20:00:00', end_date: dakarDay(3), end_time: '23:30:00' };
        expectIssue(await parseUpdate(future, { end_time: '19:00' }), 'fin seule déplacée avant le début actuel', { code: 'EVENT_END_BEFORE_START' });
    });

    test('dates de vente : début < fin ≤ fin de l’événement (datetime-local de Dakar)', async () => {
        const d10 = dakarDay(10);
        const d11 = dakarDay(11);
        expectIssue(await parseCreate(variant(base(), 'ticket_categories.0.sale_end', `${d10}T23:31`)), 'fin de vente après la fin (23:30)', { path: 'ticket_categories.0.sale_end' });
        expectValid(await parseCreate(variant(base(), 'ticket_categories.0.sale_end', `${d10}T23:30`)), 'fin de vente égale à la fin');
        const inverted = variant(variant(base(), 'ticket_categories.0.sale_start', `${d10}T10:00`), 'ticket_categories.0.sale_end', `${d10}T09:00`);
        expectIssue(await parseCreate(inverted), 'fin de vente avant le début de vente', { path: ['ticket_categories.0.sale_end', 'ticket_categories.0.sale_start'] });
        const equal = variant(variant(base(), 'ticket_categories.0.sale_start', `${d10}T10:00`), 'ticket_categories.0.sale_end', `${d10}T10:00`);
        expectIssue(await parseCreate(equal), 'début de vente égal à la fin de vente', { path: ['ticket_categories.0.sale_end', 'ticket_categories.0.sale_start'] });
        const noEnd: Row = { ...base(), end_date: null, end_time: null };
        expectValid(await parseCreate(variant(noEnd, 'ticket_categories.0.sale_end', `${d10}T23:59`)), 'sans fin : vente jusqu’à 23:59 le jour du début');
        expectIssue(await parseCreate(variant(noEnd, 'ticket_categories.0.sale_end', `${d11}T00:30`)), 'sans fin : vente le lendemain', { path: 'ticket_categories.0.sale_end' });
    });

    test('programme typé : heure HH:mm, type ARTISTE, INTERVENANT ou ACTIVITE, identifiant uuid, au plus 50 lignes', async () => {
        for (const [p, v, label] of [
            ['program.0.time', '8h', 'heure « 8h »'],
            ['program.0.time', '25:00', 'heure « 25:00 »'],
            ['program.0.kind', 'DJ', 'type hors liste'],
            ['program.0.kind', undefined, 'type absent'],
            ['program.0.id', '1730000000000', 'identifiant non uuid'],
        ] as Array<[string, unknown, string]>) {
            expectIssue(await parseCreate(variant(base(), p, v)), label, { path: p });
        }
        for (const kind of ['ARTISTE', 'INTERVENANT', 'ACTIVITE']) {
            expectValid(await parseCreate(variant(base(), 'program.0.kind', kind)), `type ${kind}`);
        }
        const line = (i: number): Row => ({ id: randomUUID(), time: `${String(10 + Math.floor(i / 6)).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}`, kind: 'ACTIVITE', title: `Séquence ${i + 1}` });
        expectValid(await parseCreate({ ...base(), program: Array.from({ length: 50 }, (_, i) => line(i)) }), '50 lignes');
        expectIssue(await parseCreate({ ...base(), program: Array.from({ length: 51 }, (_, i) => line(i)) }), '51 lignes', { path: 'program' });
    });

    test('programme : lignes vides retirées, tri par jour puis par heure', async () => {
        const d10 = dakarDay(10);
        const d11 = dakarDay(11);
        const input = {
            ...base(),
            end_date: d11,
            end_time: '03:00',
            program: [
                { id: randomUUID(), day: d11, time: '01:00', kind: 'ACTIVITE', title: 'Clôture' },
                { id: randomUUID(), time: '23:00', kind: 'ARTISTE', title: 'Tête d’affiche', participant: 'Artiste de test' },
                { id: randomUUID(), time: '', kind: 'ACTIVITE', title: '', participant: '', description: '' },
                { id: randomUUID(), day: d10, time: '20:00', kind: 'INTERVENANT', title: 'Ouverture', description: 'Mot d’accueil' },
            ],
        };
        const data = expectValid(await parseCreate(input), 'programme avec une ligne vide, dans le désordre');
        const program = data.program as Row[] | undefined;
        assert.ok(Array.isArray(program), `programme rendu par le schéma : ${JSON.stringify(data.program)}`);
        assert.deepEqual(program.map((p) => p.title), ['Ouverture', 'Tête d’affiche', 'Clôture'], `ligne vide retirée, tri (jour, heure) : ${JSON.stringify(program)}`);
    });

    test('affiche : stockage public-images du projet, dossier du partenaire, sinon IMAGE_ORIGIN_INVALID', async () => {
        const projectUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '');
        const own = posterUrl(SCHEMA_PARTNER_ID);
        const other = randomUUID();
        expectValid(await parseCreate({ ...base(), image_url: own }), 'affiche du partenaire dans public-images');
        expectValid(await parseCreate(variant(base(), 'image_url', undefined)), 'sans affiche (exigée seulement à la soumission)');
        for (const [label, url] of [
            ['hôte externe', 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a.jpg'],
            ['autre compartiment du projet', `${projectUrl}/storage/v1/object/public/partner_documents/${SCHEMA_PARTNER_ID}/piece.png`],
            ['dossier d’un autre partenaire', posterUrl(other)],
            ['remontée de dossier', `${projectUrl}/storage/v1/object/public/public-images/events/${SCHEMA_PARTNER_ID}/../${other}/affiche.png`],
            ['adresse du projet en paramètre d’une autre URL', `https://exemple.invalid/redirection?to=${encodeURIComponent(own)}`],
        ] as Array<[string, string]>) {
            expectIssue(await parseCreate({ ...base(), image_url: url }), `affiche : ${label}`, { path: 'image_url', code: 'IMAGE_ORIGIN_INVALID' });
        }
    });
});

// ── Serveur et formulaire ──────────────────────────────────────────────────

describe('F1 — même schéma côté serveur (routes) et côté formulaire', () => {
    test('POST /api/partner/events : 400 avec la liste des champs en cause, aucun événement créé', async () => {
        const title = `TEST Validation ${randomUUID()} `.padEnd(121, 'x');
        let body = base(partner.partnerId, { title });
        body = variant(body, 'ticket_categories.0.price', 1500.5);
        body = variant(body, 'program.0.time', '8h');
        const res = await postEvent(partner, body);
        assert.equal(res.status, 400, `corps invalide : HTTP 400 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
        assert.equal(typeof res.body.code, 'string', `corps invalide : code attendu : ${JSON.stringify(res.body)}`);
        assertFrenchError(res.body, 'corps invalide');
        const fields = reportedFields(res.body);
        for (const f of ['title', 'ticket_categories.0.price', 'program.0.time']) {
            assert.ok(fields.includes(f), `champ ${f} listé dans la réponse : ${JSON.stringify(res.body)}`);
        }
        assert.deepEqual(await eventsTitled(title), [], 'aucun événement créé');
    });

    test('POST : début passé → EVENT_START_PAST ; affiche externe → IMAGE_ORIGIN_INVALID ; aucun événement créé', async () => {
        const past = base(partner.partnerId, { title: `TEST Validation passé ${randomUUID()}` });
        const yesterday = dakarDay(-1);
        Object.assign(past, { start_date: yesterday, end_date: yesterday });
        past.ticket_categories = [{ name: 'Standard', price: 5000, total_quantity: 100, max_per_order: 10 }];
        const external = base(partner.partnerId, { title: `TEST Validation affiche ${randomUUID()}`, image_url: 'https://images.unsplash.com/photo-1.jpg' });
        for (const [label, body, codeExpected, field] of [
            ['début hier', past, 'EVENT_START_PAST', null],
            ['affiche externe', external, 'IMAGE_ORIGIN_INVALID', 'image_url'],
        ] as Array<[string, Row, string, string | null]>) {
            const res = await postEvent(partner, body);
            assert.equal(res.status, 400, `${label} : HTTP 400 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
            assert.ok(reportedCodes(res.body).includes(codeExpected), `${label} : code ${codeExpected} attendu : ${JSON.stringify(res.body)}`);
            if (field) assert.ok(reportedFields(res.body).includes(field), `${label} : champ ${field} listé : ${JSON.stringify(res.body)}`);
            assertFrenchError(res.body, label);
            assert.deepEqual(await eventsTitled(String(body.title)), [], `${label} : aucun événement créé`);
        }
    });

    test('POST : début dans 2 h à Dakar accepté et heure de vente stockée en heure de Dakar, serveur en UTC+14 (garde-fou)', async () => {
        const start = Date.now() + 2 * HOUR_MS;
        const s = dakarParts(start);
        const e = dakarParts(start + 3 * HOUR_MS);
        const saleEnd = dakarParts(start + HOUR_MS);
        const body = base(partner.partnerId, {
            title: `TEST Validation fuseau ${randomUUID()}`,
            start_date: s.date, start_time: s.time, end_date: e.date, end_time: e.time,
            ticket_categories: [{ name: 'Standard', price: 5000, total_quantity: 100, max_per_order: 10, sale_end: `${saleEnd.date}T${saleEnd.time}` }],
        });
        const res = await withTimezone('Pacific/Kiritimati', -840, () => postEvent(partner, body));
        assert.equal(res.status, 201, `début dans 2 h : HTTP 201 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
        const created = await eventsTitled(String(body.title));
        assert.equal(created.length, 1, 'événement créé');
        const { data, error } = await service.from('ticket_categories').select('sale_end').eq('event_id', String(created[0].id));
        assert.equal(error, null, `catégorie : ${error?.message}`);
        assert.equal(Date.parse(String(data?.[0]?.sale_end)), Date.parse(`${saleEnd.date}T${saleEnd.time}:00Z`), 'fin de vente = heure saisie, à Dakar');
    });

    test('PUT : patch invalide → 400 avec les champs, date passée → EVENT_START_PAST, rien n’est modifié', async () => {
        const ev = await createDraftEvent(partner, 'valid-put', [{ name: 'Standard', price: 5000, total: 10 }], { startsInHours: 72 });
        const before = await eventRow(ev.eventId);
        const badProgram = await putEvent(partner, ev.eventId, { program: [{ id: randomUUID(), time: '25:00', kind: 'ARTISTE', title: 'Ouverture' }] });
        assert.equal(badProgram.status, 400, `programme invalide : HTTP 400 attendu, reçu ${badProgram.status} ${JSON.stringify(badProgram.body)}`);
        assert.ok(reportedFields(badProgram.body).includes('program.0.time'), `champ program.0.time listé : ${JSON.stringify(badProgram.body)}`);
        assertFrenchError(badProgram.body, 'programme invalide');
        assert.deepEqual(await eventRow(ev.eventId), before, 'programme invalide : rien n’est modifié');

        const past = await putEvent(partner, ev.eventId, { start_date: dakarDay(-1) });
        assert.equal(past.status, 400, `début déplacé dans le passé : HTTP 400 attendu, reçu ${past.status} ${JSON.stringify(past.body)}`);
        assert.ok(reportedCodes(past.body).includes('EVENT_START_PAST'), `code EVENT_START_PAST attendu : ${JSON.stringify(past.body)}`);
        assertFrenchError(past.body, 'début déplacé dans le passé');
        assert.deepEqual(await eventRow(ev.eventId), before, 'début passé : rien n’est modifié');
    });

    test('PUT : un événement déjà commencé reste modifiable hors dates, sans EVENT_START_PAST', async () => {
        const ev = await createDraftEvent(partner, 'valid-commence', [{ name: 'Standard', price: 5000, total: 10 }], { startsInHours: -2, durationHours: 6 });
        const res = await putEvent(partner, ev.eventId, { description: 'Précision ajoutée pendant l’événement' });
        assert.equal(res.status, 200, `champ libre sur un événement commencé : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        assert.equal((await eventRow(ev.eventId)).description, 'Précision ajoutée pendant l’événement', 'modification appliquée');
    });

    test('statique : lib/validations/event importé par EventForm et par le serveur ; aucun schéma local dans les pages', () => {
        assert.match(code('components/events/EventForm.tsx'), SHARED_SCHEMA_IMPORT, 'components/events/EventForm.tsx importe lib/validations/event');
        const server = ['app/api/partner/events/route.ts', 'app/api/partner/events/[id]/route.ts', 'app/api/partner/events/[id]/categories/route.ts',
            'app/api/partner/events/[id]/categories/[categoryId]/route.ts', 'lib/events/event.service.ts'].map((f) => code(f)).join('\n');
        assert.match(server, SHARED_SCHEMA_IMPORT, 'les routes des événements (ou EventService) importent lib/validations/event');
        for (const page of ['app/partner/events/new/page.tsx', 'app/partner/events/[id]/edit/page.tsx']) {
            assert.doesNotMatch(code(page), /\bz\.object\(/, `${page} : aucun schéma Zod local`);
        }
    });

    test('CHECK en base : un prix non entier est refusé à l’insertion et à la modification d’une catégorie', async () => {
        const ev = await createDraftEvent(partner, 'valid-check', [{ name: 'Standard', price: 5000, total: 10 }], { startsInHours: 72 });
        const name = `Décimal ${randomUUID().slice(0, 8)}`;
        const ins = await service.from('ticket_categories').insert({ event_id: ev.eventId, name, price: 1500.5, total_quantity: 5 }).select('id');
        try {
            assert.notEqual(ins.error, null, `insertion d’un prix de 1500,5 acceptée par la base : ${JSON.stringify(ins.data)}`);
        } finally {
            const created = (ins.data ?? []) as Row[];
            if (created.length > 0) {
                const del = await service.from('ticket_categories').delete().eq('id', String(created[0].id));
                assert.equal(del.error, null, `nettoyage de la catégorie décimale : ${del.error?.message}`);
            }
        }
        const id = ev.categories.Standard.id;
        const upd = await service.from('ticket_categories').update({ price: 2500.25 }).eq('id', id).select('price');
        try {
            assert.notEqual(upd.error, null, `modification vers un prix de 2500,25 acceptée par la base : ${JSON.stringify(upd.data)}`);
        } finally {
            if (!upd.error) {
                const back = await service.from('ticket_categories').update({ price: 5000 }).eq('id', id);
                assert.equal(back.error, null, `remise du prix : ${back.error?.message}`);
            }
        }
    });
});
