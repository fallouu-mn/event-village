/**
 * Lot 9 bis, tâche 21 (R16 ; contrat 5.21, 4.3, B47, B48) — le serveur dit si le contrôle est ouvert et à partir de
 * quand ; le scanner décide par `scan.open` ; un événement sans date de fin finit à début + 6 h.
 *  1. TERMINE fini il y a 2 h (fenêtre 6 h) : GET /api/controller/assignments sert `scan { open: true, problem: null,
 *     opens_at, closes_at }` par affectation ; ticket_scan l'accepte (témoin, cycle-cron.test.ts:283-307).
 *  2. VALIDE à venir : `scan.open = false`, `problem = 'event_not_open'`, `opens_at` = début − 6 h.
 *  3. Statique : `app/controller/scanner/page.tsx` décide par `scan.open`, plus par isEventEligibleForController
 *     (`:820`), bandeaux « Contrôle ouvert à partir du … » et « Contrôle fermé depuis le … » ; le scan partenaire lit
 *     GET /api/controller/scan/state.
 *  4. Fin par défaut : sans fin, début 22:00 → event_end_at le lendemain à 04:00 ; début 08:00 → 14:00 ; même valeur
 *     par event_end_from_v2 et par eventEndAt (lib/events/event-end.ts) ; date de fin sans heure : 23:59 (témoin).
 *  5. GET /api/controller/scan/state?event_ids= : la partenaire propriétaire lit l'état de ses événements, une autre
 *     partenaire est refusée (403).
 * Rouge avant correctif : aucun champ `scan` (route assignments `:38-49`) ; scanner `eligible =
 * isEventEligibleForController(eventStatus)` ; fin par défaut à 23:59 (M/20261102000003:149-159, event-end.ts:7-12) ;
 * event_end_from_v2 et la route scan/state absentes (nommées par l'échec).
 * Verts dès l'écriture (témoins, signalés) : scan accepté d'un TERMINE dans la fenêtre ; fin sans heure à 23:59.
 * Fuseau : Africa/Dakar = UTC+0. Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inspect } from '../helpers/db';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { importModule, service, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent, newController, scan, ticketPayload, withAccessSettings, type RouteResult } from './acces-helpers';
import { createDraftEvent } from './cycle-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { issueFreeTicket } from './terrain-helpers';

type Row = Record<string, unknown>;

const HOUR = 3600_000;
const FREE: CategorySpec[] = [{ name: 'Gratuit', price: 0, total: 20 }];
const WINDOW = { 'access.scan_window_before_hours': 6, 'access.scan_window_after_hours': 6 } as const;
const ASSIGNMENTS_ROUTE = '../../app/api/controller/assignments/route';
const SCAN_STATE_ROUTE = '../../app/api/controller/scan/state/route';
const SCANNER_PAGE = path.join('app', 'controller', 'scanner', 'page.tsx');
const PARTNER_SCAN_PAGE = path.join('app', 'partner', 'scan', 'page.tsx');

let partner: TestPartner;
let stranger: TestPartner;

before(async () => {
    partner = await newPartner('fenetre-scan');
    stranger = await newPartner('fenetre-scan-b');
});

after(async () => {
    await assertLot9bisInvariants('cycle9bis-fenetre-scan');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

interface Bounds { start: Date; end: Date }

async function bounds(eventId: string): Promise<Bounds> {
    const { data, error } = await service.from('events').select('start_date, start_time, end_date, end_time').eq('id', eventId).single();
    assert.equal(error, null, `dates de l'événement ${eventId} : ${error?.message}`);
    assert.ok(data.end_date && data.end_time, 'précondition : fin saisie');
    return { start: new Date(`${data.start_date}T${data.start_time}Z`), end: new Date(`${data.end_date}T${data.end_time}Z`) };
}

async function assignmentsOf(user: { accessToken: string }): Promise<Row[]> {
    const handler = await routeHandler(ASSIGNMENTS_ROUTE, 'GET', 'GET /api/controller/assignments');
    const res = await invoke(handler, jsonRequest('/api/controller/assignments', 'GET', user.accessToken));
    assert.equal(res.status, 200, `affectations du contrôleur : ${show(res)}`);
    assert.ok(Array.isArray(res.body.assignments), `assignments[] : ${show(res)}`);
    return res.body.assignments as Row[];
}

function assignmentFor(list: Row[], eventId: string): Row {
    const a = list.find((x) => (x.events as Row | null)?.id === eventId);
    assert.ok(a, `affectation à l'événement ${eventId} : ${JSON.stringify(list).slice(0, 400)}`);
    return a;
}

function scanState(a: Row, label: string): Row {
    const s = a.scan as Row | undefined;
    assert.ok(s && typeof s === 'object', `${label} : champ scan { open, problem, opens_at, closes_at } servi par affectation (contrat 4.3), reçu ${JSON.stringify(a).slice(0, 400)}`);
    return s;
}

function sameInstant(v: unknown, expected: Date, label: string): void {
    assert.ok(typeof v === 'string' && !Number.isNaN(Date.parse(v)), `${label} : date ISO attendue, reçu ${JSON.stringify(v)}`);
    assert.equal(Date.parse(v), expected.getTime(), `${label} : ${v} au lieu de ${expected.toISOString()}`);
}

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

function code(file: string): string {
    assert.ok(fs.existsSync(file), `${file} absent`);
    return stripComments(fs.readFileSync(file, 'utf8'));
}

async function scanStateRoute(user: { accessToken: string }, eventIds: string[]): Promise<RouteResult> {
    const handler = await routeHandler(SCAN_STATE_ROUTE, 'GET', 'GET /api/controller/scan/state (contrat 4.3, fix(9b.21))');
    return invoke(handler, jsonRequest(`/api/controller/scan/state?event_ids=${eventIds.join(',')}`, 'GET', user.accessToken));
}

/** Brouillon sans fin dont le début est posé à `day` + `time` (Dakar). */
async function noEndDraft(label: string, day: string, time: string, endDate: string | null = null): Promise<string> {
    const ev = await createDraftEvent(partner, label, FREE, { startsInHours: 240, durationHours: null });
    const { error } = await service.from('events').update({ start_date: day, start_time: time, end_date: endDate, end_time: null }).eq('id', ev.eventId);
    assert.equal(error, null, `dates du brouillon ${label} : ${error?.message}`);
    return ev.eventId;
}

function dayPlus(days: number): string {
    return new Date(Date.now() + days * 24 * HOUR).toISOString().slice(0, 10);
}

// ── 1 et 2. État du contrôle servi par affectation ─────────────────────────

describe('R16 — GET /api/controller/assignments : scan { open, problem, opens_at, closes_at } par affectation', () => {
    test('TERMINE fini il y a 2 h, fenêtre de 6 h : scan.open = true, problem null, bornes de la fenêtre ; ticket_scan accepte (témoin)', async () => {
        await withAccessSettings(WINDOW, async () => {
            const ev: SaleEvent = await createTimedEvent(partner.partnerId, 'fenetre-termine', FREE, { startsInHours: -6, durationHours: 4, status: 'TERMINE' });
            const ctrl = await newController(partner, ev.eventId, { label: 'fenetre-termine' });
            const b = await bounds(ev.eventId);
            const s = scanState(assignmentFor(await assignmentsOf(ctrl), ev.eventId), 'TERMINE dans la fenêtre');
            assert.equal(s.open, true, `contrôle encore ouvert jusqu'à fin + 6 h : ${JSON.stringify(s)}`);
            assert.equal(s.problem ?? null, null, `aucun problème : ${JSON.stringify(s)}`);
            sameInstant(s.opens_at, new Date(b.start.getTime() - 6 * HOUR), 'opens_at = début − 6 h');
            sameInstant(s.closes_at, new Date(b.end.getTime() + 6 * HOUR), 'closes_at = fin + 6 h');

            const ticketId = await issueFreeTicket(ev.eventId, ev.categories.Gratuit.id, ctrl);
            const scanned = await scan(ctrl, { eventId: ev.eventId, payload: await ticketPayload(ticketId) });
            assert.equal(scanned.body.result, 'valid', `témoin : le serveur accepte l'entrée que le scanner doit permettre : ${JSON.stringify(scanned.body)}`);
        });
    });

    test('VALIDE à venir (dans 10 h) : scan.open = false, problem event_not_open, opens_at = début − 6 h', async () => {
        await withAccessSettings(WINDOW, async () => {
            const ev = await createTimedEvent(partner.partnerId, 'fenetre-valide', FREE, { startsInHours: 10, durationHours: 4, status: 'VALIDE' });
            const ctrl = await newController(partner, ev.eventId, { label: 'fenetre-valide' });
            const b = await bounds(ev.eventId);
            const s = scanState(assignmentFor(await assignmentsOf(ctrl), ev.eventId), 'VALIDE à venir');
            assert.equal(s.open, false, `contrôle fermé : ${JSON.stringify(s)}`);
            assert.equal(s.problem, 'event_not_open', `problème event_not_open : ${JSON.stringify(s)}`);
            sameInstant(s.opens_at, new Date(b.start.getTime() - 6 * HOUR), 'opens_at = début − 6 h (heure du bandeau)');
            sameInstant(s.closes_at, new Date(b.end.getTime() + 6 * HOUR), 'closes_at = fin + 6 h');
        });
    });
});

// ── 3. Écrans ──────────────────────────────────────────────────────────────

describe('R16 — le scanner décide par scan.open (contrôle statique)', () => {
    test('scanner : eligible = scan.open, plus isEventEligibleForController ; bandeaux d’ouverture et de fermeture ; scan partenaire par scan/state', () => {
        const src = code(SCANNER_PAGE);
        assert.doesNotMatch(src, /const\s+eligible\s*=\s*isEventEligibleForController\s*\(/,
            'le scanner ne décide plus d’après le statut (aujourd’hui :820 : isEventEligibleForController(eventStatus))');
        assert.match(src, /const\s+eligible\s*=\s*[^;\n]*\bscan\??\.open\b/, 'eligible lu dans scan.open servi par le serveur');
        assert.match(src, /Contrôle ouvert à partir du/, 'bandeau « Contrôle ouvert à partir du {date} à {heure} »');
        assert.match(src, /Contrôle fermé depuis le/, 'bandeau « Contrôle fermé depuis le {date} à {heure} »');
        assert.match(src, /opens_at/, 'minuterie : relecture à opens_at');
        assert.match(src, /closes_at/, 'minuterie : relecture à closes_at');
        assert.match(code(PARTNER_SCAN_PAGE), /\/api\/controller\/scan\/state/, 'scan partenaire : état lu par GET /api/controller/scan/state');
    });
});

// ── 4. Fin par défaut ──────────────────────────────────────────────────────

describe('R16 — fin par défaut : début + 6 h (date de fin sans heure : 23:59)', () => {
    test('sans fin, début 22:00 → lendemain 04:00 ; début 08:00 → 14:00 ; même valeur par event_end_at, event_end_from_v2 et eventEndAt', async () => {
        const day = dayPlus(10);
        const next = dayPlus(11);
        const night = await noEndDraft('fin-22h', day, '22:00:00');
        const morning = await noEndDraft('fin-08h', day, '08:00:00');
        const ends = await inspect(async (db) => (await db.query<{ n: Date; m: Date }>(
            'SELECT public.event_end_at($1) AS n, public.event_end_at($2) AS m', [night, morning])).rows[0]);
        assert.equal(ends.n.toISOString(), `${next}T04:00:00.000Z`, 'début 22:00 sans fin : fin le lendemain à 04:00 (aujourd’hui 23:59 du jour)');
        assert.equal(ends.m.toISOString(), `${day}T14:00:00.000Z`, 'début 08:00 sans fin : fin à 14:00 (aujourd’hui 23:59)');

        const fn = await inspect(async (db) => (await db.query<{ signature: string }>(
            `SELECT p.oid::regprocedure::text AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'event_end_from_v2'`)).rows);
        assert.equal(fn.length, 1, `fonction public.event_end_from_v2(date, time, date, time) (migration 20261109000008_lot9bis_cycle, X7) : ${JSON.stringify(fn)}`);
        const v2 = await inspect(async (db) => (await db.query<{ n: Date; m: Date }>(
            `SELECT public.event_end_from_v2($1::date, '22:00'::time, NULL::date, NULL::time) AS n,
                    public.event_end_from_v2($1::date, '08:00'::time, NULL::date, NULL::time) AS m`, [day])).rows[0]);
        assert.equal(v2.n.toISOString(), `${next}T04:00:00.000Z`, 'event_end_from_v2 : même règle (22:00 → lendemain 04:00)');
        assert.equal(v2.m.toISOString(), `${day}T14:00:00.000Z`, 'event_end_from_v2 : même règle (08:00 → 14:00)');

        const mod = await importModule('../../lib/events/event-end');
        const ts = (time: string): Date => mod.eventEndAt({ start_date: day, start_time: time, end_date: null, end_time: null }) as Date;
        assert.equal(ts('22:00:00').toISOString(), `${next}T04:00:00.000Z`, 'eventEndAt (lectures publiques) : 22:00 → lendemain 04:00');
        assert.equal(ts('08:00').toISOString(), `${day}T14:00:00.000Z`, 'eventEndAt : 08:00 → 14:00');
    });

    test('témoin : date de fin sans heure → cette date à 23:59 (règle inchangée)', async () => {
        const day = dayPlus(12);
        const next = dayPlus(13);
        const id = await noEndDraft('fin-sans-heure', day, '20:00:00', next);
        const end = await inspect(async (db) => (await db.query<{ e: Date }>('SELECT public.event_end_at($1) AS e', [id])).rows[0].e);
        assert.equal(end.toISOString(), `${next}T23:59:00.000Z`, 'date de fin sans heure : 23:59');
    });
});

// ── 5. État du contrôle pour la partenaire ─────────────────────────────────

describe('R16 — GET /api/controller/scan/state?event_ids= (scan partenaire)', () => {
    test('la propriétaire lit { event_id, open, problem, opens_at, closes_at } de ses événements ; une autre partenaire : 403', async () => {
        await withAccessSettings(WINDOW, async () => {
            const done = await createTimedEvent(partner.partnerId, 'etat-termine', FREE, { startsInHours: -6, durationHours: 4, status: 'TERMINE' });
            const later = await createTimedEvent(partner.partnerId, 'etat-valide', FREE, { startsInHours: 10, durationHours: 4, status: 'VALIDE' });
            const res = await scanStateRoute(partner, [done.eventId, later.eventId]);
            assert.equal(res.status, 200, `état du contrôle pour la propriétaire : ${show(res)}`);
            const items = (Array.isArray(res.body.items) ? res.body.items : []) as Row[];
            const byId = new Map(items.map((i) => [String(i.event_id), i]));
            assert.equal(byId.get(done.eventId)?.open, true, `TERMINE dans la fenêtre : ouvert, ${show(res)}`);
            assert.equal(byId.get(later.eventId)?.open, false, `VALIDE à venir : fermé, ${show(res)}`);
            assert.equal(byId.get(later.eventId)?.problem, 'event_not_open', show(res));
            const b = await bounds(later.eventId);
            sameInstant(byId.get(later.eventId)?.opens_at, new Date(b.start.getTime() - 6 * HOUR), 'opens_at servi à la partenaire');

            const foreign = await scanStateRoute(stranger, [done.eventId]);
            assert.equal(foreign.status, 403, `autre partenaire : 403 attendu, ${show(foreign)}`);
            assert.ok(!JSON.stringify(foreign.body).includes(done.eventId), `aucune donnée de l'événement d'autrui : ${show(foreign)}`);
        });
    });
});
