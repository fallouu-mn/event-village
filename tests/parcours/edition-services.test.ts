/**
 * Lot 5, tâche 5.9 — services associés : seule la billetterie est proposée (constat events-cdc-7). Contrat :
 * section F5 de la conception du lot 5 (et F6 pour le formulaire partagé).
 *  - events.services est forcé à { ticketing: true, tableBooking: false, communication: false } à la
 *    création ; un champ services en entrée donne 400 (à l'édition : FIELD_NOT_EDITABLE, suite
 *    edition-formulaire) ; les colonnes restent ;
 *  - POST /api/partner/events/[id]/promotion par le partenaire → 403 SERVICE_UNAVAILABLE : aucune demande
 *    dans sponsored_promotions, aucune notification ;
 *  - l'interface ne propose plus que la billetterie : l'étape « Services » est retirée du formulaire partagé
 *    (components/events/EventForm.tsx) et des pages de création et d'édition ; rien des tables, de la
 *    communication ni de la promotion côté public ni côté partenaire.
 * Contrôles statiques : sources lues avec fs, commentaires retirés (blocs, JSX, lignes), expressions précises
 * (identifiants tableBooking, setServices, services.<clé> ; libellés « Services associés », « Tables VIP »,
 * « Réservation de tables », « Pack Communication », « Newsletter » ; route /promotion ; mise en avant
 * is_featured, featured_until, FeaturedEventCard). Le mot « services » seul n'est cherché que dans le
 * formulaire et ses deux pages.
 * Rouge avant correctif :
 *  - création : services vaut {} quand le corps n'en a pas, et un services fourni est recopié
 *    (lib/events/event.service.ts:140-144) ; le corps passe brut (app/api/partner/events/route.ts:49-50) ;
 *  - promotion : la route crée une demande EN_ATTENTE et notifie les superadmins
 *    (app/api/partner/events/[id]/promotion/route.ts:59-82) ; sur un brouillon, 400
 *    (promotion/route.ts:38-40) ;
 *  - interface : étape 4 « Services (§34) » avec tables VIP et pack communication
 *    (app/partner/events/new/page.tsx:127-132, :402, :779-893 ; app/partner/events/[id]/edit/page.tsx:92-96,
 *    :153-159, :453, :642-666) ; components/events/EventForm.tsx absent ;
 *  - la page publique et la liste partenaire n'affichent déjà rien des services : garde-fous ;
 *  - préparation de l'événement publié : event_transition absente (cycle-helpers.ts, advanceEventTo).
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
import { importModule, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { createDraftEvent, createEventInStatus, posterUrl } from './cycle-helpers';

const ROOT = process.cwd();
const DAY_MS = 86_400_000;
const FORCED_SERVICES = { ticketing: true, tableBooking: false, communication: false };
const STANDARD: CategorySpec[] = [{ name: 'Standard', price: 5000, total: 20 }];

let partner: TestPartner;

before(async () => {
    partner = await newPartner('edition-services');
});

after(async () => {
    await assertLifecycleInvariants('edition-services');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
type Row = Record<string, unknown>;
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

function dakarDay(offsetDays: number): string {
    return new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

/** Corps de création conforme au contrat F1 (début J+10 20:00 à Dakar), sans champ services. */
function createBody(label: string, overrides: Row = {}): Row {
    const d = dakarDay(10);
    return {
        title: `TEST Services ${label} ${randomUUID().slice(0, 8)}`,
        category: 'FESTIVAL',
        description: 'Festival de test du lot 5 (services associés).',
        start_date: d,
        start_time: '18:00',
        end_date: d,
        end_time: '23:00',
        location: 'Place du Souvenir, Dakar',
        city: 'Dakar',
        image_url: posterUrl(partner.partnerId),
        capacity: 300,
        program: [],
        practical_info: { address: 'Corniche Ouest, Dakar' },
        ticket_categories: [{ name: 'Pass journée', price: 3000, total_quantity: 200, max_per_order: 5 }],
        ...overrides,
    };
}

async function postEvent(user: Buyer, body: Row): Promise<RouteResult> {
    const post = await handlerOf('../../app/api/partner/events/route', 'POST');
    return invoke(post, jsonRequest('/api/partner/events', 'POST', user.accessToken, body));
}

async function requestPromotion(user: Buyer, eventId: string): Promise<RouteResult> {
    const post = await handlerOf('../../app/api/partner/events/[id]/promotion/route', 'POST');
    return invoke(post, jsonRequest(`/api/partner/events/${eventId}/promotion`, 'POST', user.accessToken, {}), routeContext({ id: eventId }));
}

async function eventsTitled(title: string): Promise<Row[]> {
    const { data, error } = await service.from('events').select('id, services, status').eq('title', title);
    assert.equal(error, null, `événements « ${title} » : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function promotionsOf(eventId: string): Promise<Row[]> {
    const { data, error } = await service.from('sponsored_promotions').select('*').eq('event_id', eventId);
    assert.equal(error, null, `demandes de promotion de ${eventId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function notificationIds(userId: string): Promise<Set<string>> {
    const { data, error } = await service.from('notifications').select('id').eq('user_id', userId);
    assert.equal(error, null, `notifications de ${userId} : ${error?.message}`);
    return new Set((data ?? []).map((r) => String(r.id)));
}

async function newEventNotifications(userId: string, eventId: string, seen: Set<string>): Promise<Row[]> {
    const { data, error } = await service.from('notifications').select('id, title, metadata').eq('user_id', userId);
    assert.equal(error, null, `notifications de ${userId} : ${error?.message}`);
    return ((data ?? []) as Row[]).filter((n) => !seen.has(String(n.id)) && JSON.stringify(n.metadata ?? {}).includes(eventId));
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

// ── Contrôles statiques ────────────────────────────────────────────────────

function stripComments(src: string): string {
    const blank = (m: string): string => m.replace(/[^\n]/g, ' ');
    return src
        .replace(/\/\*[\s\S]*?\*\//g, blank)
        .replace(/(^|[^:\\'"`])(\/\/[^\n]*)/gm, (_m: string, p1: string, c: string) => p1 + blank(c));
}

/** Expressions des services associés, dans tout fichier d'interface. */
const SERVICE_PATTERNS: Array<[RegExp, string]> = [
    [/\btableBooking\b/, 'service tableBooking'],
    [/\bservices\s*\??\.\s*(ticketing|tableBooking|communication|promotion)\b/, 'lecture de services.<clé>'],
    [/\bsetServices\b/, 'état des services associés'],
    [/Services?\s+associ[ée]s?/i, 'étape « Services associés »'],
    [/label:\s*['"]Services\b/, 'onglet « Services »'],
    [/R[ée]servation\s+de\s+tables?/i, 'réservation de tables'],
    [/\bTables?\s+VIP\b/i, 'tables VIP'],
    [/Pack\s+Communication/i, 'pack communication'],
    [/\bNewsletter\b/i, 'newsletter'],
    [/\/promotion\b/, 'appel de la route de promotion'],
    [/sponsoris/i, 'promotion sponsorisée'],
    [/\bFeaturedEventCard\b|\bis_featured\b|\bfeatured_until\b/, 'mise en avant'],
];

/** En plus, dans le formulaire et ses pages : le mot « services » seul (état, envoi, libellé). */
const FORM_PATTERNS: Array<[RegExp, string]> = [...SERVICE_PATTERNS, [/\bservices\b/i, 'services associés']];

function offendingLines(file: string, patterns: Array<[RegExp, string]>): string[] {
    const abs = path.join(ROOT, file);
    assert.ok(fs.existsSync(abs), `${file} absent`);
    const lines = stripComments(fs.readFileSync(abs, 'utf8')).split(/\r?\n/);
    const out: string[] = [];
    lines.forEach((line, i) => {
        for (const [re, why] of patterns) if (re.test(line)) out.push(`${file}:${i + 1} (${why}) ${line.trim()}`);
    });
    return out;
}

// ── Création ───────────────────────────────────────────────────────────────

describe('5.9 — services associés à la création', () => {
    test('services forcé à { ticketing: true, tableBooking: false, communication: false } quand le corps n’en a pas', async () => {
        const body = createBody('force');
        const res = await postEvent(partner, body);
        assert.equal(res.status, 201, `création : HTTP 201 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
        const rows = await eventsTitled(String(body.title));
        assert.equal(rows.length, 1, 'événement créé');
        assert.deepEqual(rows[0].services, FORCED_SERVICES, `services forcé à la seule billetterie : ${JSON.stringify(rows[0].services)}`);
    });

    test('un champ services en entrée → 400, aucun événement créé (même la valeur imposée)', async () => {
        for (const [label, services] of [
            ['tous les services', { ticketing: true, tableBooking: true, communication: true }],
            ['valeur imposée', FORCED_SERVICES],
            ['promotion', { ticketing: true, promotion: true }],
        ] as Array<[string, Row]>) {
            const body = createBody(`entree-${label.replace(/\s+/g, '-')}`, { services });
            const res = await postEvent(partner, body);
            assert.equal(res.status, 400, `services en entrée (${label}) : HTTP 400 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
            assert.equal(typeof res.body.code, 'string', `services en entrée (${label}) : code attendu : ${JSON.stringify(res.body)}`);
            assertFrenchError(res.body, `services en entrée (${label})`);
            assert.deepEqual(await eventsTitled(String(body.title)), [], `services en entrée (${label}) : aucun événement créé`);
        }
    });
});

// ── Promotion ──────────────────────────────────────────────────────────────

describe('5.9 — promotion indisponible : POST /api/partner/events/[id]/promotion', () => {
    test('brouillon du partenaire → 403 SERVICE_UNAVAILABLE, aucune demande créée', async () => {
        const ev = await createDraftEvent(partner, 'services-promo-brouillon', STANDARD, { startsInHours: 72 });
        const res = await requestPromotion(partner, ev.eventId);
        assert.equal(res.status, 403, `promotion d’un brouillon : HTTP 403 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
        assert.equal(res.body.code, 'SERVICE_UNAVAILABLE', `code SERVICE_UNAVAILABLE attendu : ${JSON.stringify(res.body)}`);
        assertFrenchError(res.body, 'promotion d’un brouillon');
        assert.deepEqual(await promotionsOf(ev.eventId), [], 'aucune demande de promotion');
    });

    test('événement PUBLIÉ du partenaire → 403 SERVICE_UNAVAILABLE, aucune demande, aucune notification', async () => {
        const ev = await createEventInStatus(partner, 'services-promo-publie', STANDARD, 'PUBLIE', { startsInHours: 72 });
        const admin = await superadminId();
        const seenAdmin = await notificationIds(admin);
        const seenPartner = await notificationIds(partner.userId);
        const res = await requestPromotion(partner, ev.eventId);
        assert.equal(res.status, 403, `promotion d’un PUBLIÉ : HTTP 403 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
        assert.equal(res.body.code, 'SERVICE_UNAVAILABLE', `code SERVICE_UNAVAILABLE attendu : ${JSON.stringify(res.body)}`);
        assertFrenchError(res.body, 'promotion d’un PUBLIÉ');
        assert.deepEqual(await promotionsOf(ev.eventId), [], 'aucune demande de promotion');
        assert.deepEqual(await newEventNotifications(admin, ev.eventId, seenAdmin), [], 'aucune notification aux superadmins');
        assert.deepEqual(await newEventNotifications(partner.userId, ev.eventId, seenPartner), [], 'aucune notification au partenaire');
    });
});

// ── Interface ──────────────────────────────────────────────────────────────

describe('5.9 — interface : billetterie seule (contrôles statiques, commentaires exclus)', () => {
    test('plus d’étape « Services » ni de tables, communication ou promotion dans EventForm et les pages de création et d’édition', () => {
        const files = ['components/events/EventForm.tsx', 'app/partner/events/new/page.tsx', 'app/partner/events/[id]/edit/page.tsx'];
        const offenders = files.flatMap((f) => offendingLines(f, FORM_PATTERNS));
        assert.deepEqual(offenders, [], `services associés encore proposés dans le formulaire :\n${offenders.join('\n')}`);
    });

    test('rien des services associés côté public ni côté partenaire (garde-fou ; page de pilotage contrôlée si présente)', () => {
        const files = ['app/events/[id]/page.tsx', 'components/events/EventCard.tsx', 'app/partner/events/page.tsx'];
        const pilotage = 'app/partner/events/[id]/page.tsx';
        if (fs.existsSync(path.join(ROOT, pilotage))) files.push(pilotage);
        const offenders = files.flatMap((f) => offendingLines(f, SERVICE_PATTERNS));
        assert.deepEqual(offenders, [], `services associés affichés (${files.join(', ')}) :\n${offenders.join('\n')}`);
    });
});
