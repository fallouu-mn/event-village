/**
 * Lot 5, tâche 5.7 — côté admin (constats events-cdc-8, -16, partner-ux-5). Contrat : sections G, D4, D5
 * et D6 (routes admin), U (helpers).
 *  - GET /api/admin/events?status=&q=&page=&pageSize= (verifyAdminAuth avec events.read) : filtre par
 *    statut, recherche dans le titre (jokers % et _ pris à la lettre), pagination (20 par défaut, 50 au
 *    plus), réponse { items, page, pageSize, total, counts } ; counts par statut calculés sans le filtre de
 *    statut ; statut inconnu → 400 UNKNOWN_STATUS ;
 *  - GET /api/admin/events/[id] : fiche complète (affiche, dates, lieu, programme, catégories et prix,
 *    catégories masquées ou inactives comprises, organisateur avec contact, historique des statuts,
 *    event_actions) ;
 *  - POST /api/admin/events/[id]/transition { to, reason? } (events.write) : valider, refuser (motif),
 *    suspendre (motif), réactiver, terminer ; POST /api/admin/events/[id]/cancel : annuler ;
 *  - event_actions(p) : actions exactes par statut et par rôle (propriétaire, admin, tiers) ;
 *  - motif de refus et de suspension persistés dans event_status_history et rendus au partenaire par
 *    event_actions.last_reason, plus rendus quand le statut courant n'en découle plus (resoumission,
 *    retrait, réactivation) ;
 *  - écrans : app/admin/events/page.tsx et [id]/page.tsx (StatusBadge, Tabs, Pagination, ReasonDialog),
 *    entrée « Événements » dans le menu et la barre du bas, plus aucune écriture de statut d'événement
 *    depuis /admin/services.
 * Hypothèses tranchées (contrat muet) : la liste admin couvre les 7 statuts, BROUILLON compris ; un
 * pageSize > 50 est ramené à 50 (ou refusé en 400 avec un code) ; `actions` de event_actions liste les
 * transitions du canal TRANSITION, l'annulation passant par `can_cancel` (une entrée ANNULE éventuelle est
 * tolérée si can_cancel est vrai) ; les libellés d'action commencent par le verbe de la consigne
 * (Soumettre, Retirer, Valider, Refuser, Publier, Suspendre, Réactiver, Terminer).
 * La suite crée son partenaire, son partenaire tiers, ses admins (permissions dédiées) et ses
 * événements (titres marqués d'un jeton propre à la suite) ; aucune fixture partagée n'est modifiée.
 *
 * Rouge avant correctif :
 *  - app/api/admin/events/route.ts, app/api/admin/events/[id]/route.ts et
 *    app/api/admin/events/[id]/transition/route.ts n'existent pas (seul [id]/cancel/route.ts existe) ; la
 *    liste admin passe par GET /api/admin/services?type=events (app/api/admin/services/route.ts:13-31),
 *    sans filtre, recherche ni pagination ;
 *  - RPC event_transition, event_cancel et event_actions absentes : createEventInStatus / advanceEventTo
 *    (cycle-helpers) échouent sur « function … does not exist » ; event_status_history absente ;
 *  - le motif n'est écrit nulle part sur l'événement (lib/events/event.service.ts:804-812 ne met à jour
 *    que status et updated_at) ;
 *  - app/api/admin/events/[id]/cancel/route.ts:6-9 ignore confirmTitle (aucun TITLE_MISMATCH) ;
 *  - app/admin/events/ absent ; components/layout/AppLayout.tsx:144-150 (menu) et 105-111 (barre du bas,
 *    deux entrées /admin/dashboard) sans « Événements » ;
 *  - app/admin/services/page.tsx:37, 60-64, 211-237 : l'onglet Événements écrit le statut par
 *    PATCH /api/admin/services { table: 'events' }.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import ts from 'typescript';
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { signInAs } from '../helpers/fixtures';
import { importModule, newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import {
    EVENT_STATUSES, advanceEventTo, createDraftEvent, createEventInStatus, eventHistory, eventStatus, rpcTransition, shiftEventDates,
    type DraftEvent, type EventHistoryRow, type EventStatus,
} from './cycle-helpers';

const TOKEN = `adm${randomBytes(4).toString('hex')}`;
const CATS: CategorySpec[] = [{ name: 'Standard', price: 5000, total: 50 }];
const ENUM_RE = new RegExp('(?<![\\p{L}\\p{N}_])(BROUILLON|EN_ATTENTE|VALIDE|PUBLIE|SUSPENDU|TERMINE|ANNULE)(?![\\p{L}\\p{N}_])', 'u');

const LIST_ROUTE = '../../app/api/admin/events/route';
const FICHE_ROUTE = '../../app/api/admin/events/[id]/route';
const TRANSITION_ROUTE = '../../app/api/admin/events/[id]/transition/route';
const CANCEL_ROUTE = '../../app/api/admin/events/[id]/cancel/route';

let partner: TestPartner;
let partnerB: TestPartner;
let client: Buyer;
let adminReader: Buyer;
let adminWriter: Buyer;
let adminNoPerm: Buyer;
let superToken: string;
let superId: string;

before(async () => {
    partner = await newPartner('adm-ev');
    partnerB = await newPartner('adm-ev-b');
    client = await newBuyer('adm-ev-client');
    adminReader = await newAdmin('lecteur', ['events.read']);
    adminWriter = await newAdmin('ecrivain', ['events.read', 'events.write']);
    adminNoPerm = await newAdmin('sans-droit', []);
    superToken = (await signInAs('SUPERADMIN')).accessToken;
    superId = await superadminId();
});

after(async () => {
    await assertLifecycleInvariants('admin-evenements');
});

// ── Outils ─────────────────────────────────────────────────────────────────

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

interface RouteResult {
    status: number;
    body: Record<string, unknown>;
}

async function newAdmin(label: string, permissions: string[]): Promise<Buyer> {
    const user = await newBuyer(`adm-ev-${label}`, { firstName: 'Ndeye', lastName: 'Moderatrice' });
    const { error } = await service.from('user_roles').upsert([{ user_id: user.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(error, null, `rôle ADMIN : ${error?.message}`);
    for (const permission of permissions) {
        const { error: pErr } = await service.from('admin_permissions').upsert({ user_id: user.userId, permission }, { onConflict: 'user_id,permission' });
        assert.equal(pErr, null, `permission ${permission} : ${pErr?.message}`);
    }
    return user;
}

/** Contexte de route compatible Next 14 (objet) et Next 15 (promesse). */
function routeCtx<T extends Record<string, string>>(params: T): { params: Promise<T> & T } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

async function callRoute(modulePath: string, method: 'GET' | 'POST', req: NextRequest, params?: Record<string, string>): Promise<RouteResult> {
    const mod = await importModule(modulePath);
    const handler = mod[method] as Handler | undefined;
    assert.equal(typeof handler, 'function', `${modulePath} : pas de handler ${method}`);
    const res = await handler!(req, params ? routeCtx(params) : undefined);
    const text = await res.text();
    let body: Record<string, unknown>;
    try {
        body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
        body = { raw: text.slice(0, 300) };
    }
    return { status: res.status, body };
}

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`;
}

function tokenOf(who: Buyer | null): string | null {
    return who ? who.accessToken : null;
}

async function listEvents(who: Buyer | string | null, query: Record<string, string | number> = {}): Promise<RouteResult> {
    const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
    const token = typeof who === 'string' ? who : tokenOf(who);
    return callRoute(LIST_ROUTE, 'GET', jsonRequest(`/api/admin/events${qs ? `?${qs}` : ''}`, 'GET', token));
}

async function fiche(who: Buyer | string | null, eventId: string): Promise<RouteResult> {
    const token = typeof who === 'string' ? who : tokenOf(who);
    return callRoute(FICHE_ROUTE, 'GET', jsonRequest(`/api/admin/events/${eventId}`, 'GET', token), { id: eventId });
}

async function adminTransition(who: Buyer, eventId: string, to: string, reason?: string): Promise<RouteResult> {
    const body: Record<string, unknown> = { to };
    if (reason !== undefined) body.reason = reason;
    return callRoute(TRANSITION_ROUTE, 'POST', jsonRequest(`/api/admin/events/${eventId}/transition`, 'POST', who.accessToken, body), { id: eventId });
}

async function adminCancel(who: Buyer, eventId: string, body: Record<string, unknown>): Promise<RouteResult> {
    return callRoute(CANCEL_ROUTE, 'POST', jsonRequest(`/api/admin/events/${eventId}/cancel`, 'POST', who.accessToken, body), { id: eventId });
}

interface AdminList {
    items: Array<Record<string, unknown>>;
    page: number;
    pageSize: number;
    total: number;
    counts: Record<string, unknown>;
}

function asList(r: RouteResult, what: string): AdminList {
    assert.equal(r.status, 200, `${what} : ${show(r)}`);
    const b = r.body;
    assert.ok(Array.isArray(b.items), `${what} : items absent (${show(r)})`);
    for (const k of ['page', 'pageSize', 'total']) assert.equal(typeof b[k], 'number', `${what} : ${k} absent ou non numérique (${show(r)})`);
    assert.ok(b.counts && typeof b.counts === 'object', `${what} : counts absent (${show(r)})`);
    return b as unknown as AdminList;
}

function ids(items: Array<Record<string, unknown>>): string[] {
    return items.map((i) => String(i.id)).sort();
}

async function tokenEventIds(status?: EventStatus): Promise<string[]> {
    let q = service.from('events').select('id').ilike('title', `%${TOKEN}%`);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    assert.equal(error, null, `événements de la suite : ${error?.message}`);
    return (data ?? []).map((r) => String(r.id)).sort();
}

async function globalCounts(): Promise<Record<string, number>> {
    const rows = await inspect(async (db) => (await db.query<{ status: string; n: number }>(
        'SELECT status::text AS status, count(*)::int AS n FROM public.events GROUP BY 1')).rows);
    const out: Record<string, number> = {};
    for (const s of EVENT_STATUSES) out[s] = 0;
    for (const r of rows) out[r.status] = Number(r.n);
    return out;
}

function title(label: string): string {
    return `TEST AdminEv ${TOKEN} ${label}`;
}

async function eventIn(label: string, target: EventStatus, opts: Parameters<typeof createEventInStatus>[4] = {}): Promise<DraftEvent> {
    return createEventInStatus(partner, label, CATS, target, { title: title(label), ...opts });
}

/** Événement PUBLIE déjà commencé (fin dans 3 h) : créé dans le futur, publié, puis déplacé (contrat S). */
async function startedPublished(label: string): Promise<DraftEvent> {
    const ev = await eventIn(label, 'PUBLIE', { startsInHours: 2 });
    await shiftEventDates(ev.eventId, { startsInHours: -1, durationHours: 4 });
    return ev;
}

function lastRow(rows: EventHistoryRow[]): EventHistoryRow {
    assert.ok(rows.length > 0, 'historique vide');
    return rows[rows.length - 1];
}

/** Premier objet (parcours en profondeur) qui satisfait le prédicat. */
function findDeep(node: unknown, pred: (o: Record<string, unknown>) => boolean, depth = 0): Record<string, unknown> | null {
    if (depth > 8 || node === null || typeof node !== 'object') return null;
    if (!Array.isArray(node) && pred(node as Record<string, unknown>)) return node as Record<string, unknown>;
    for (const v of Array.isArray(node) ? node : Object.values(node as Record<string, unknown>)) {
        const hit = findDeep(v, pred, depth + 1);
        if (hit) return hit;
    }
    return null;
}

function findArrayDeep(node: unknown, pred: (a: unknown[]) => boolean, depth = 0): unknown[] | null {
    if (depth > 8 || node === null || typeof node !== 'object') return null;
    if (Array.isArray(node) && pred(node)) return node;
    for (const v of Array.isArray(node) ? node : Object.values(node as Record<string, unknown>)) {
        const hit = findArrayDeep(v, pred, depth + 1);
        if (hit) return hit;
    }
    return null;
}

// ── event_actions (D5) ─────────────────────────────────────────────────────

interface ActionsBody {
    ok?: boolean;
    code?: string;
    status?: string;
    actions?: Array<{ to?: string; reason_required?: boolean; label?: string }>;
    can_edit?: boolean;
    can_cancel?: boolean;
    last_reason?: { kind?: string; reason?: string; at?: string } | null;
}

async function eventActions(eventId: string, actorId: string): Promise<ActionsBody> {
    const { data, error } = await service.rpc('event_actions', { p: { event_id: eventId, actor_id: actorId } });
    assert.equal(error, null, `event_actions : ${error?.message} (code ${error?.code})`);
    assert.ok(data && typeof data === 'object', 'event_actions : réponse vide');
    return data as ActionsBody;
}

interface ExpectedAction {
    to: EventStatus;
    reasonRequired: boolean;
    verb: RegExp;
}

const PARTNER_ACTIONS: Record<EventStatus, ExpectedAction[]> = {
    BROUILLON: [{ to: 'EN_ATTENTE', reasonRequired: false, verb: /^soumettre/i }],
    EN_ATTENTE: [{ to: 'BROUILLON', reasonRequired: false, verb: /^retirer/i }],
    VALIDE: [{ to: 'PUBLIE', reasonRequired: false, verb: /^publier/i }],
    PUBLIE: [],
    SUSPENDU: [],
    TERMINE: [],
    ANNULE: [],
};

const ADMIN_ACTIONS: Record<EventStatus, ExpectedAction[]> = {
    BROUILLON: [],
    EN_ATTENTE: [{ to: 'VALIDE', reasonRequired: false, verb: /^valider/i }, { to: 'BROUILLON', reasonRequired: true, verb: /^refuser/i }],
    VALIDE: [{ to: 'PUBLIE', reasonRequired: false, verb: /^publier/i }],
    PUBLIE: [{ to: 'SUSPENDU', reasonRequired: true, verb: /^suspendre/i }, { to: 'TERMINE', reasonRequired: false, verb: /^terminer/i }],
    SUSPENDU: [{ to: 'PUBLIE', reasonRequired: false, verb: /^réactiver/i }],
    TERMINE: [],
    ANNULE: [],
};

/** Modification par le propriétaire (contrat F3) : BROUILLON, puis VALIDE, PUBLIE, SUSPENDU ; jamais par un admin. */
const PARTNER_CAN_EDIT: Record<EventStatus, boolean> = {
    BROUILLON: true, EN_ATTENTE: false, VALIDE: true, PUBLIE: true, SUSPENDU: true, TERMINE: false, ANNULE: false,
};

const CAN_CANCEL: Record<EventStatus, boolean> = {
    BROUILLON: false, EN_ATTENTE: false, VALIDE: true, PUBLIE: true, SUSPENDU: true, TERMINE: false, ANNULE: false,
}; /** Lot 9 bis (R105, B68) : seul un admin annule un SUSPENDU, la propriétaire ne le peut plus. */ const OWNER_CAN_CANCEL: Record<EventStatus, boolean> = { ...CAN_CANCEL, SUSPENDU: false };

function assertActions(body: ActionsBody, status: EventStatus, expected: ExpectedAction[], canEdit: boolean, label: string, cancelTable: Record<EventStatus, boolean> = CAN_CANCEL): void {
    const raw = JSON.stringify(body);
    assert.notEqual(body.ok, false, `${label} : event_actions refusé ${raw}`);
    assert.equal(body.status, status, `${label} : status ${body.status}, attendu ${status} (${raw})`);
    assert.ok(Array.isArray(body.actions), `${label} : actions absent (${raw})`);
    const transitions = body.actions.filter((a) => a.to !== 'ANNULE');
    if (transitions.length !== body.actions.length) assert.equal(body.can_cancel, true, `${label} : action ANNULE alors que can_cancel est faux (${raw})`);
    assert.deepEqual(transitions.map((a) => a.to).sort(), expected.map((e) => e.to).sort(), `${label} : actions possibles (${raw})`);
    for (const e of expected) {
        const a = transitions.find((x) => x.to === e.to)!;
        assert.equal(a.reason_required, e.reasonRequired, `${label} → ${e.to} : reason_required (${raw})`);
        assert.equal(typeof a.label, 'string', `${label} → ${e.to} : libellé absent (${raw})`);
        assert.match(String(a.label), e.verb, `${label} → ${e.to} : libellé « ${a.label} »`);
        assert.doesNotMatch(String(a.label), ENUM_RE, `${label} → ${e.to} : enum brut dans le libellé « ${a.label} »`);
    }
    assert.equal(body.can_edit, canEdit, `${label} : can_edit (${raw})`);
    assert.equal(body.can_cancel, cancelTable[status], `${label} : can_cancel (${raw})`);
}

function assertNothingFor(body: ActionsBody, label: string): void {
    const raw = JSON.stringify(body);
    if (body.ok === false) {
        assert.equal(typeof body.code, 'string', `${label} : refus sans code (${raw})`);
        return;
    }
    assert.deepEqual(body.actions ?? [], [], `${label} : aucune action attendue (${raw})`);
    assert.notEqual(body.can_edit, true, `${label} : can_edit (${raw})`);
    assert.notEqual(body.can_cancel, true, `${label} : can_cancel (${raw})`);
    assert.ok(!body.last_reason, `${label} : motif divulgué à un tiers (${raw})`);
}

// ── GET /api/admin/events ──────────────────────────────────────────────────

describe('5.7 — GET /api/admin/events : filtres, recherche, pagination, compteurs', () => {
    const PAGINATION_DRAFTS = 22;
    const byStatus = {} as Record<EventStatus, DraftEvent>;

    before(async () => {
        for (let i = 0; i < PAGINATION_DRAFTS; i++) {
            await createDraftEvent(partner, `pagination-${i}`, CATS, { title: title(`pagination ${i}`) });
        }
        byStatus.BROUILLON = await createDraftEvent(partner, 'liste BROUILLON', CATS, { title: title('liste BROUILLON') });
        byStatus.EN_ATTENTE = await eventIn('liste EN_ATTENTE', 'EN_ATTENTE');
        byStatus.VALIDE = await eventIn('liste VALIDE', 'VALIDE');
        byStatus.PUBLIE = await eventIn('liste PUBLIE', 'PUBLIE');
        byStatus.SUSPENDU = await eventIn('liste SUSPENDU', 'SUSPENDU');
        byStatus.TERMINE = await eventIn('liste TERMINE', 'TERMINE', { finishShift: { startsInHours: -3 } });
        byStatus.ANNULE = await eventIn('liste ANNULE', 'ANNULE', { cancelFrom: 'VALIDE' });
    });

    test('filtre par statut (les 7, ANNULE compris) avec q : exactement les événements de ce statut, total = vérité en base', async () => {
        for (const s of EVENT_STATUSES) {
            const list = asList(await listEvents(adminReader, { status: s, q: TOKEN, pageSize: 50 }), `?status=${s}`);
            const truth = await tokenEventIds(s);
            assert.ok(truth.includes(byStatus[s].eventId), `${s} : l'événement de la suite n'est pas en base dans ce statut`);
            assert.deepEqual(ids(list.items), truth, `?status=${s}&q=${TOKEN} : éléments`);
            assert.ok(list.items.every((i) => i.status === s), `?status=${s} : un élément d'un autre statut (${JSON.stringify(list.items.map((i) => i.status))})`);
            assert.equal(list.total, truth.length, `?status=${s} : total`);
        }
    });

    test('sans statut : tous les statuts ; counts par statut = vérité en base, indépendants du filtre de statut', async () => {
        const all = asList(await listEvents(adminReader, { q: TOKEN, pageSize: 50 }), 'sans statut, q');
        const truthAll = await tokenEventIds();
        assert.equal(all.total, truthAll.length, 'sans statut : total = tous les événements de la suite');
        const statuses = new Set(all.items.map((i) => String(i.status)));
        assert.ok(statuses.size >= 2, `sans statut : un seul statut renvoyé (${Array.from(statuses).join(', ')})`);

        const filtered = asList(await listEvents(adminReader, { status: 'PUBLIE' }), '?status=PUBLIE sans q');
        const truth = await globalCounts();
        for (const s of EVENT_STATUSES) {
            assert.equal(Number(filtered.counts[s] ?? 0), truth[s], `counts.${s} = ${String(filtered.counts[s])}, vérité en base ${truth[s]}`);
        }
        assert.equal(filtered.total, truth.PUBLIE, '?status=PUBLIE : total = nombre de PUBLIE en base');
    });

    test('pagination : 20 par défaut, page 2 disjointe, réunion = vérité ; pageSize plafonné à 50', async () => {
        const truth = await tokenEventIds('BROUILLON');
        assert.ok(truth.length > 20 && truth.length <= 40, `jeu de données : ${truth.length} brouillons (attendu entre 21 et 40)`);
        const p1 = asList(await listEvents(adminReader, { status: 'BROUILLON', q: TOKEN }), 'page 1');
        assert.equal(p1.page, 1, 'page par défaut');
        assert.equal(p1.pageSize, 20, 'pageSize par défaut');
        assert.equal(p1.items.length, 20, 'page 1 : 20 éléments');
        assert.equal(p1.total, truth.length, 'page 1 : total');
        const p2 = asList(await listEvents(adminReader, { status: 'BROUILLON', q: TOKEN, page: 2 }), 'page 2');
        assert.equal(p2.page, 2, 'page 2');
        assert.equal(p2.items.length, truth.length - 20, 'page 2 : le reste');
        const overlap = ids(p1.items).filter((id) => ids(p2.items).includes(id));
        assert.deepEqual(overlap, [], 'pages 1 et 2 disjointes');
        assert.deepEqual([...ids(p1.items), ...ids(p2.items)].sort(), truth, 'réunion des pages = vérité en base');

        const big = await listEvents(adminReader, { status: 'BROUILLON', q: TOKEN, pageSize: 100 });
        if (big.status === 400) {
            assert.equal(typeof big.body.code, 'string', `pageSize=100 refusé sans code : ${show(big)}`);
        } else {
            const l = asList(big, 'pageSize=100');
            assert.ok(l.pageSize <= 50, `pageSize=100 : pageSize renvoyé ${l.pageSize} > 50`);
            assert.ok(l.items.length <= 50, `pageSize=100 : ${l.items.length} éléments > 50`);
        }
        const unbounded = await listEvents(adminReader, { pageSize: 1000 });
        if (unbounded.status === 200) assert.ok((unbounded.body.items as unknown[]).length <= 50, 'pageSize=1000 sans filtre : plus de 50 éléments');
    });

    test('recherche q : insensible à la casse ; % et _ pris à la lettre', async () => {
        const truth = await tokenEventIds();
        const upper = asList(await listEvents(adminReader, { q: TOKEN.toUpperCase(), pageSize: 50 }), 'q en majuscules');
        assert.equal(upper.total, truth.length, 'q en majuscules : même résultat');
        const percent = asList(await listEvents(adminReader, { q: `${TOKEN}%` }), 'q avec %');
        assert.equal(percent.total, 0, `q=${TOKEN}% : le % doit être pris à la lettre (${percent.total} résultat(s))`);
        const underscore = asList(await listEvents(adminReader, { q: `${TOKEN.slice(0, 3)}_${TOKEN.slice(4)}` }), 'q avec _');
        assert.equal(underscore.total, 0, `q avec _ : le _ doit être pris à la lettre (${underscore.total} résultat(s))`);
    });

    test('statut inconnu → 400 UNKNOWN_STATUS, message en français, aucune erreur Postgres', async () => {
        for (const bad of ['PUBLISHED', 'publie', 'ANNULE;DROP']) {
            const r = await listEvents(adminReader, { status: bad });
            assert.equal(r.status, 400, `?status=${bad} : ${show(r)}`);
            assert.equal(r.body.code, 'UNKNOWN_STATUS', `?status=${bad} : code (${show(r)})`);
            assert.equal(typeof r.body.error, 'string', `?status=${bad} : message absent`);
            assert.doesNotMatch(String(r.body.error), /invalid input value|enum|syntax/i, `?status=${bad} : erreur Postgres brute`);
        }
    });

    test('droits : sans session 401 ; CLIENT, partenaire et ADMIN sans events.read 403 ; ADMIN events.read et SUPERADMIN 200', async () => {
        assert.equal((await listEvents(null)).status, 401, 'sans session');
        for (const [label, who] of [['CLIENT', client], ['partenaire', partner], ['ADMIN sans events.read', adminNoPerm]] as Array<[string, Buyer]>) {
            const r = await listEvents(who, { q: TOKEN });
            assert.equal(r.status, 403, `${label} : ${show(r)}`);
            assert.ok(!Array.isArray(r.body.items), `${label} : aucune donnée renvoyée`);
        }
        asList(await listEvents(adminReader, { q: TOKEN }), 'ADMIN events.read');
        asList(await listEvents(superToken, { q: TOKEN }), 'SUPERADMIN');
    });

    test('élément de liste : id, titre, statut, date, lieu et organisateur', async () => {
        const list = asList(await listEvents(adminReader, { status: 'PUBLIE', q: TOKEN }), 'liste PUBLIE');
        const item = list.items.find((i) => i.id === byStatus.PUBLIE.eventId);
        assert.ok(item, 'événement PUBLIE de la suite absent');
        assert.equal(item.title, byStatus.PUBLIE.title, 'titre');
        assert.equal(item.status, 'PUBLIE', 'statut');
        assert.equal(typeof item.start_date, 'string', `date de début absente (${JSON.stringify(item)})`);
        assert.equal(typeof item.location, 'string', `lieu absent (${JSON.stringify(item)})`);
        const { data: p, error } = await service.from('partners').select('company_name').eq('id', partner.partnerId).single();
        assert.equal(error, null, error?.message);
        assert.ok(findDeep(item, (o) => o.company_name === p.company_name), `organisateur (${p.company_name}) absent de l'élément (${JSON.stringify(item)})`);
    });
});

// ── GET /api/admin/events/[id] ─────────────────────────────────────────────

describe('5.7 — GET /api/admin/events/[id] : fiche complète avant validation', () => {
    let ev: DraftEvent;
    const program = [
        { id: randomUUID(), time: '20:00', kind: 'ARTISTE', title: `Orchestre ${TOKEN}`, participant: 'Orchestre national' },
        { id: randomUUID(), time: '22:30', kind: 'ACTIVITE', title: 'Tombola des partenaires' },
    ];

    before(async () => {
        ev = await createDraftEvent(partner, 'fiche', [
            { name: 'Standard', price: 5000, total: 100 },
            { name: 'VIP masquée', price: 15000, total: 20, isVisible: false },
            { name: 'Prévente inactive', price: 3000, total: 30, isActive: false },
        ], { title: title('fiche'), durationHours: 5 });
        const { error } = await service.from('events').update({ program }).eq('id', ev.eventId);
        assert.equal(error, null, `programme : ${error?.message}`);
        await advanceEventTo(ev.eventId, 'EN_ATTENTE');
    });

    test('affiche, dates, lieu, programme, catégories et prix (masquées et inactives comprises), organisateur et contact, historique, actions', async () => {
        const r = await fiche(adminWriter, ev.eventId); // lot 9 bis (R2, B31) : valider et refuser exigent events.write
        assert.equal(r.status, 200, `fiche : ${show(r)}`);
        const { data: row, error } = await service.from('events').select('*').eq('id', ev.eventId).single();
        assert.equal(error, null, error?.message);

        const event = findDeep(r.body, (o) => o.id === ev.eventId && typeof o.title === 'string');
        assert.ok(event, `fiche : objet de l'événement introuvable (${show(r)})`);
        for (const k of ['title', 'image_url', 'start_date', 'start_time', 'end_date', 'end_time', 'location', 'city']) {
            assert.deepEqual(event[k], row[k], `fiche : ${k} = ${JSON.stringify(event[k])}, en base ${JSON.stringify(row[k])}`);
        }
        assert.ok(row.image_url, 'jeu de données : affiche renseignée');
        assert.deepEqual(event.program, row.program, 'fiche : programme');

        const cats = findArrayDeep(r.body, (a) => a.length > 0 && a.every((x) => !!x && typeof x === 'object' && 'name' in x && 'price' in x));
        assert.ok(cats, `fiche : catégories introuvables (${show(r)})`);
        const catRows = cats as Array<Record<string, unknown>>;
        for (const [name, c] of Object.entries(ev.categories)) {
            const got: Record<string, unknown> | undefined = catRows.find((x) => x.id === c.id);
            assert.ok(got, `fiche : catégorie « ${name} » absente (les admins voient toutes les catégories)`);
            assert.equal(Number(got.price), c.price, `fiche : prix de « ${name} »`);
            assert.equal(Number(got.total_quantity), c.total, `fiche : quota de « ${name} »`);
        }

        const { data: p, error: pErr } = await service.from('partners').select('company_name, phone, email').eq('id', partner.partnerId).single();
        assert.equal(pErr, null, pErr?.message);
        const org = findDeep(r.body, (o) => o.company_name === p.company_name);
        assert.ok(org, `fiche : organisateur ${p.company_name} absent`);
        assert.ok((p.phone && org.phone === p.phone) || (p.email && org.email === p.email), `fiche : contact de l'organisateur absent (${JSON.stringify(org)})`);

        const expectedHistory = (await eventHistory(ev.eventId)).map((h) => h.new_status);
        const hist = findArrayDeep(r.body, (a) => a.length > 0 && a.every((x) => !!x && typeof x === 'object' && ('new_status' in x || 'newStatus' in x)));
        assert.ok(hist, `fiche : historique des statuts introuvable (${show(r)})`);
        const got = (hist as Array<Record<string, unknown>>).map((h) => String(h.new_status ?? h.newStatus));
        assert.deepEqual(got.slice().sort(), expectedHistory.slice().sort(), 'fiche : historique = event_status_history');

        const actions = findDeep(r.body, (o) => Array.isArray(o.actions) && ('can_cancel' in o || 'canCancel' in o));
        assert.ok(actions, `fiche : event_actions absent (${show(r)})`);
        const tos = (actions.actions as Array<{ to?: string }>).map((a) => a.to).filter((t) => t !== 'ANNULE').sort();
        assert.deepEqual(tos, ['BROUILLON', 'VALIDE'], 'fiche EN_ATTENTE : actions valider et refuser');
    });

    test('événement inconnu → 404 ; droits : 401 sans session, 403 CLIENT, partenaire propriétaire et ADMIN sans events.read', async () => {
        const unknown = await fiche(adminReader, randomUUID());
        assert.equal(unknown.status, 404, `événement inconnu : ${show(unknown)}`);
        assert.equal((await fiche(null, ev.eventId)).status, 401, 'sans session');
        for (const [label, who] of [['CLIENT', client], ['partenaire propriétaire', partner], ['ADMIN sans events.read', adminNoPerm]] as Array<[string, Buyer]>) {
            const r = await fiche(who, ev.eventId);
            assert.equal(r.status, 403, `${label} : ${show(r)}`);
        }
    });
});

// ── POST /api/admin/events/[id]/transition et /cancel ──────────────────────

describe('5.7 — actions admin par statut (transition D4, annulation D6)', () => {
    async function assertAdminRow(eventId: string, from: EventStatus, to: EventStatus, actorId: string, reason: string | null, channel = 'TRANSITION'): Promise<void> {
        const row = lastRow(await eventHistory(eventId));
        assert.equal(row.old_status, from, `historique : ancien statut (${JSON.stringify(row)})`);
        assert.equal(row.new_status, to, `historique : nouveau statut (${JSON.stringify(row)})`);
        assert.equal(row.actor_role, 'ADMIN', `historique : rôle (${JSON.stringify(row)})`);
        assert.equal(row.actor_id, actorId, `historique : acteur (${JSON.stringify(row)})`);
        assert.equal(row.channel, channel, `historique : canal (${JSON.stringify(row)})`);
        if (reason !== null) assert.equal(row.reason, reason, `historique : motif (${JSON.stringify(row)})`);
    }

    test('valider : EN_ATTENTE → VALIDE, journalisé (ADMIN, acteur, canal TRANSITION)', async () => {
        const ev = await eventIn('valider', 'EN_ATTENTE');
        const r = await adminTransition(adminWriter, ev.eventId, 'VALIDE');
        assert.equal(r.status, 200, `valider : ${show(r)}`);
        assert.equal(await eventStatus(ev.eventId), 'VALIDE');
        await assertAdminRow(ev.eventId, 'EN_ATTENTE', 'VALIDE', adminWriter.userId, null);
    });

    test('refuser : motif obligatoire (absent, vide ou < 3 caractères → REASON_REQUIRED, statut inchangé), puis refus motivé → BROUILLON', async () => {
        const ev = await eventIn('refuser', 'EN_ATTENTE');
        for (const reason of [undefined, '', '  ', 'ab']) {
            const r = await adminTransition(adminWriter, ev.eventId, 'BROUILLON', reason);
            assert.ok(r.status >= 400 && r.status < 500, `refus avec motif ${JSON.stringify(reason)} : ${show(r)}`);
            assert.equal(r.body.code, 'REASON_REQUIRED', `refus avec motif ${JSON.stringify(reason)} : code (${show(r)})`);
            assert.equal(await eventStatus(ev.eventId), 'EN_ATTENTE', 'statut inchangé');
        }
        const motif = 'Affiche illisible : merci de la remplacer avant une nouvelle soumission.';
        const ok = await adminTransition(adminWriter, ev.eventId, 'BROUILLON', motif);
        assert.equal(ok.status, 200, `refus motivé : ${show(ok)}`);
        assert.equal(await eventStatus(ev.eventId), 'BROUILLON');
        await assertAdminRow(ev.eventId, 'EN_ATTENTE', 'BROUILLON', adminWriter.userId, motif);
    });

    test('suspendre (PUBLIE → SUSPENDU, motif obligatoire) puis réactiver (SUSPENDU → PUBLIE)', async () => {
        const ev = await eventIn('suspendre', 'PUBLIE');
        const noReason = await adminTransition(adminWriter, ev.eventId, 'SUSPENDU');
        assert.equal(noReason.body.code, 'REASON_REQUIRED', `suspension sans motif : ${show(noReason)}`);
        assert.equal(await eventStatus(ev.eventId), 'PUBLIE', 'suspension sans motif : statut inchangé');
        const motif = 'Signalement en cours de vérification par la modération.';
        const s = await adminTransition(adminWriter, ev.eventId, 'SUSPENDU', motif);
        assert.equal(s.status, 200, `suspendre : ${show(s)}`);
        assert.equal(await eventStatus(ev.eventId), 'SUSPENDU');
        await assertAdminRow(ev.eventId, 'PUBLIE', 'SUSPENDU', adminWriter.userId, motif);
        const re = await adminTransition(adminWriter, ev.eventId, 'PUBLIE');
        assert.equal(re.status, 200, `réactiver : ${show(re)}`);
        assert.equal(await eventStatus(ev.eventId), 'PUBLIE');
        await assertAdminRow(ev.eventId, 'SUSPENDU', 'PUBLIE', adminWriter.userId, null);
    });

    test('terminer : PUBLIE commencé → TERMINE (fin manuelle, canal TRANSITION)', async () => {
        const ev = await startedPublished('terminer');
        const r = await adminTransition(adminWriter, ev.eventId, 'TERMINE');
        assert.equal(r.status, 200, `terminer : ${show(r)}`);
        assert.equal(await eventStatus(ev.eventId), 'TERMINE');
        await assertAdminRow(ev.eventId, 'PUBLIE', 'TERMINE', adminWriter.userId, null);
    });

    test('annuler : POST /api/admin/events/[id]/cancel exige le titre retapé (TITLE_MISMATCH), puis ANNULE journalisé (canal CANCELLATION)', async () => {
        const ev = await eventIn('annuler', 'VALIDE');
        const base = { publicNotice: 'Événement annulé par la plateforme : aucun billet n’avait été vendu.', internalReason: 'Contrôle de conformité défavorable' };
        const wrong = await adminCancel(adminWriter, ev.eventId, { ...base, confirmTitle: `${ev.title} (faux)` });
        assert.ok(wrong.status >= 400 && wrong.status < 500, `titre faux : ${show(wrong)}`);
        assert.equal(wrong.body.code, 'TITLE_MISMATCH', `titre faux : code (${show(wrong)})`);
        assert.equal(await eventStatus(ev.eventId), 'VALIDE', 'titre faux : statut inchangé');
        const ok = await adminCancel(adminWriter, ev.eventId, { ...base, confirmTitle: `  ${ev.title}  ` });
        assert.equal(ok.status, 200, `annulation : ${show(ok)}`);
        assert.equal(await eventStatus(ev.eventId), 'ANNULE');
        await assertAdminRow(ev.eventId, 'VALIDE', 'ANNULE', adminWriter.userId, null, 'CANCELLATION');
    });

    test('ADMIN avec events.read seul : 403 sur /transition, statut inchangé, aucune ligne d’historique', async () => {
        const ev = await eventIn('lecteur-seul', 'EN_ATTENTE');
        const rows0 = (await eventHistory(ev.eventId)).length;
        const r = await adminTransition(adminReader, ev.eventId, 'VALIDE');
        assert.equal(r.status, 403, `ADMIN events.read : ${show(r)}`);
        assert.equal(await eventStatus(ev.eventId), 'EN_ATTENTE', 'statut inchangé');
        assert.equal((await eventHistory(ev.eventId)).length, rows0, 'aucune ligne d’historique');
        const cl = await callRoute(TRANSITION_ROUTE, 'POST', jsonRequest(`/api/admin/events/${ev.eventId}/transition`, 'POST', client.accessToken, { to: 'VALIDE' }), { id: ev.eventId });
        assert.equal(cl.status, 403, `CLIENT : ${show(cl)}`);
        assert.equal(await eventStatus(ev.eventId), 'EN_ATTENTE', 'CLIENT : statut inchangé');
    });

    test('refus explicites : statut inconnu 400 UNKNOWN_STATUS ; ANNULE par /transition CANCELLATION_REQUIRED ; hors table 409 TRANSITION_NOT_ALLOWED ; événement inconnu 404', async () => {
        const ev = await createDraftEvent(partner, 'refus-admin', CATS, { title: title('refus-admin') });
        const unknown = await adminTransition(adminWriter, ev.eventId, 'PUBLISHED');
        assert.equal(unknown.status, 400, `statut inconnu : ${show(unknown)}`);
        assert.equal(unknown.body.code, 'UNKNOWN_STATUS', `statut inconnu : code (${show(unknown)})`);
        const cancel = await adminTransition(adminWriter, ev.eventId, 'ANNULE');
        assert.ok(cancel.status >= 400 && cancel.status < 500, `ANNULE par /transition : ${show(cancel)}`);
        assert.ok(['CANCELLATION_REQUIRED', 'TRANSITION_NOT_ALLOWED'].includes(String(cancel.body.code)), `ANNULE par /transition : code (${show(cancel)})`);
        const jump = await adminTransition(adminWriter, ev.eventId, 'VALIDE');
        assert.equal(jump.status, 409, `BROUILLON → VALIDE par l'admin : ${show(jump)}`);
        assert.equal(jump.body.code, 'TRANSITION_NOT_ALLOWED', `BROUILLON → VALIDE : code (${show(jump)})`);
        assert.equal(await eventStatus(ev.eventId), 'BROUILLON', 'statut inchangé');
        const missing = await adminTransition(adminWriter, randomUUID(), 'VALIDE');
        assert.equal(missing.status, 404, `événement inconnu : ${show(missing)}`);
        for (const r of [unknown, cancel, jump, missing]) {
            assert.equal(typeof r.body.error, 'string', `message absent : ${show(r)}`);
            assert.doesNotMatch(String(r.body.error), ENUM_RE, `enum brut dans le message : ${show(r)}`);
        }
    });
});

// ── event_actions (D5) ─────────────────────────────────────────────────────

describe('D5 — event_actions : actions exactes par statut et par rôle', () => {
    const byStatus = {} as Record<EventStatus, DraftEvent>;

    before(async () => {
        byStatus.BROUILLON = await createDraftEvent(partner, 'actions BROUILLON', CATS, { title: title('actions BROUILLON') });
        byStatus.EN_ATTENTE = await eventIn('actions EN_ATTENTE', 'EN_ATTENTE');
        byStatus.VALIDE = await eventIn('actions VALIDE', 'VALIDE');
        byStatus.PUBLIE = await startedPublished('actions PUBLIE');
        byStatus.SUSPENDU = await eventIn('actions SUSPENDU', 'SUSPENDU');
        byStatus.TERMINE = await eventIn('actions TERMINE', 'TERMINE', { finishShift: { startsInHours: -3 } });
        byStatus.ANNULE = await eventIn('actions ANNULE', 'ANNULE', { cancelFrom: 'VALIDE' });
    });

    test('partenaire propriétaire : soumettre, retirer, publier selon le statut ; can_edit et can_cancel', async () => {
        for (const s of EVENT_STATUSES) {
            assertActions(await eventActions(byStatus[s].eventId, partner.userId), s, PARTNER_ACTIONS[s], PARTNER_CAN_EDIT[s], `propriétaire, ${s}`, OWNER_CAN_CANCEL);
        }
    });

    test('admin (SUPERADMIN et ADMIN) : valider, refuser, publier, suspendre, terminer, réactiver ; jamais can_edit', async () => {
        for (const s of EVENT_STATUSES) {
            assertActions(await eventActions(byStatus[s].eventId, superId), s, ADMIN_ACTIONS[s], false, `SUPERADMIN, ${s}`);
        }
        for (const s of ['EN_ATTENTE', 'PUBLIE', 'SUSPENDU'] as EventStatus[]) {
            assertActions(await eventActions(byStatus[s].eventId, adminWriter.userId), s, ADMIN_ACTIONS[s], false, `ADMIN, ${s}`);
        }
    });

    test('partenaire tiers et client : aucune action, aucun droit, aucun motif', async () => {
        for (const s of EVENT_STATUSES) {
            assertNothingFor(await eventActions(byStatus[s].eventId, partnerB.userId), `partenaire tiers, ${s}`);
            assertNothingFor(await eventActions(byStatus[s].eventId, client.userId), `client, ${s}`);
        }
    });
});

// ── Motifs de refus et de suspension (G, D5) ───────────────────────────────

describe('5.7 — motifs de refus et de suspension : persistés, rendus au partenaire, effacés quand le statut n’en découle plus', () => {
    function assertReason(body: ActionsBody, kind: 'REFUS' | 'SUSPENSION', reason: string, row: EventHistoryRow, label: string): void {
        const lr = body.last_reason;
        assert.ok(lr, `${label} : last_reason absent (${JSON.stringify(body)})`);
        assert.equal(lr.kind, kind, `${label} : kind (${JSON.stringify(lr)})`);
        assert.equal(lr.reason, reason, `${label} : motif (${JSON.stringify(lr)})`);
        assert.ok(lr.at && Math.abs(Date.parse(lr.at) - Date.parse(row.created_at)) < 2000, `${label} : date du motif ${lr.at}, historique ${row.created_at}`);
    }

    test('refus : motif dans l’historique et la fiche admin, rendu au propriétaire (pas au tiers), plus rendu après resoumission ou retrait ; le dernier refus fait foi', async () => {
        const ev = await eventIn('motif-refus', 'EN_ATTENTE');
        const motif1 = 'Programme incomplet : ajoutez les horaires des artistes.';
        const r1 = await adminTransition(adminWriter, ev.eventId, 'BROUILLON', motif1);
        assert.equal(r1.status, 200, `refus : ${show(r1)}`);
        const row1 = lastRow(await eventHistory(ev.eventId));
        assert.equal(row1.reason, motif1, 'motif persisté dans event_status_history');
        assertReason(await eventActions(ev.eventId, partner.userId), 'REFUS', motif1, row1, 'après refus');
        assertNothingFor(await eventActions(ev.eventId, partnerB.userId), 'partenaire tiers après refus');

        const f = await fiche(adminReader, ev.eventId);
        assert.equal(f.status, 200, `fiche : ${show(f)}`);
        assert.ok(findDeep(f.body, (o) => o.reason === motif1), 'fiche admin : motif du refus absent de l’historique');

        assert.equal((await rpcTransition(ev.eventId, partner.userId, 'EN_ATTENTE')).data?.ok, true, 'resoumission');
        assert.ok(!(await eventActions(ev.eventId, partner.userId)).last_reason, 'après resoumission : plus de motif');
        assert.equal((await rpcTransition(ev.eventId, partner.userId, 'BROUILLON')).data?.ok, true, 'retrait par le partenaire');
        assert.ok(!(await eventActions(ev.eventId, partner.userId)).last_reason, 'BROUILLON issu d’un retrait : pas de motif de refus');

        assert.equal((await rpcTransition(ev.eventId, partner.userId, 'EN_ATTENTE')).data?.ok, true, 'nouvelle soumission');
        const motif2 = 'Lieu introuvable : précisez l’adresse.';
        assert.equal((await adminTransition(adminWriter, ev.eventId, 'BROUILLON', motif2)).status, 200, 'second refus');
        assertReason(await eventActions(ev.eventId, partner.userId), 'REFUS', motif2, lastRow(await eventHistory(ev.eventId)), 'second refus');
    });

    test('suspension : motif rendu au propriétaire, effacé à la réactivation, le dernier motif fait foi', async () => {
        const ev = await eventIn('motif-suspension', 'PUBLIE');
        const motif1 = 'Plainte d’acheteurs en cours d’instruction.';
        assert.equal((await adminTransition(adminWriter, ev.eventId, 'SUSPENDU', motif1)).status, 200, 'suspension');
        assertReason(await eventActions(ev.eventId, partner.userId), 'SUSPENSION', motif1, lastRow(await eventHistory(ev.eventId)), 'après suspension');
        assertNothingFor(await eventActions(ev.eventId, partnerB.userId), 'partenaire tiers après suspension');

        assert.equal((await adminTransition(adminWriter, ev.eventId, 'PUBLIE')).status, 200, 'réactivation');
        assert.ok(!(await eventActions(ev.eventId, partner.userId)).last_reason, 'après réactivation : plus de motif');

        const motif2 = 'Nouvelle vérification de l’organisateur demandée.';
        assert.equal((await adminTransition(adminWriter, ev.eventId, 'SUSPENDU', motif2)).status, 200, 'seconde suspension');
        assertReason(await eventActions(ev.eventId, partner.userId), 'SUSPENSION', motif2, lastRow(await eventHistory(ev.eventId)), 'seconde suspension');
    });
});

// ── Écrans admin (contrôles statiques) ─────────────────────────────────────

const ROOT = process.cwd();
const printer = ts.createPrinter({ removeComments: true });
const sfCache = new Map<string, ts.SourceFile>();

function absPath(rel: string): string {
    return path.join(ROOT, ...rel.split('/'));
}

function isFile(rel: string): boolean {
    const p = absPath(rel);
    return fs.existsSync(p) && fs.statSync(p).isFile();
}

function sourceOf(rel: string): ts.SourceFile {
    let sf = sfCache.get(rel);
    if (!sf) {
        sf = ts.createSourceFile(rel, fs.readFileSync(absPath(rel), 'utf8'), ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        sfCache.set(rel, sf);
    }
    return sf;
}

function codeOf(rel: string): string {
    return printer.printFile(sourceOf(rel));
}

function listFiles(dirRel: string, re: RegExp): string[] {
    const out: string[] = [];
    const walk = (d: string): void => {
        if (!fs.existsSync(absPath(d))) return;
        for (const entry of fs.readdirSync(absPath(d), { withFileTypes: true })) {
            const child = `${d}/${entry.name}`;
            if (entry.isDirectory()) walk(child);
            else if (entry.isFile() && re.test(entry.name)) out.push(child);
        }
    };
    walk(dirRel);
    return out.sort();
}

function resolveImport(fromRel: string, spec: string): string | null {
    let base: string;
    if (spec.startsWith('@/')) base = spec.slice(2);
    else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
    else return null;
    for (const cand of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) if (isFile(cand)) return cand;
    return null;
}

interface Binding {
    local: string;
    imported: string;
    from: string | null;
}

function bindingsOf(rel: string): Binding[] {
    const out: Binding[] = [];
    for (const st of sourceOf(rel).statements) {
        if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !st.importClause) continue;
        const from = resolveImport(rel, st.moduleSpecifier.text);
        if (st.importClause.name) out.push({ local: st.importClause.name.text, imported: 'default', from });
        const nb = st.importClause.namedBindings;
        if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) out.push({ local: el.name.text, imported: (el.propertyName ?? el.name).text, from });
    }
    return out;
}

function exportedNames(rel: string): Set<string> {
    const out = new Set<string>();
    for (const st of sourceOf(rel).statements) {
        const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined;
        const exported = !!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        if (exported && ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) out.add(d.name.text);
        if (exported && (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) out.add(st.name.text);
        if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) for (const el of st.exportClause.elements) out.add(el.name.text);
    }
    return out;
}

/** Fichier de components/ui qui exporte le composant (StatusBadge : le nouveau, qui lit EVENT_STATUS_META). */
function uiComponent(name: string): string | null {
    const files = listFiles('components/ui', /\.tsx?$/).filter((f) => !/\/index\.tsx?$/.test(f) && exportedNames(f).has(name));
    if (name === 'StatusBadge') return files.find((f) => bindingsOf(f).some((b) => b.imported === 'EVENT_STATUS_META' && b.from === 'lib/events/event-status.ts')) ?? null;
    return files[0] ?? null;
}

/** Fichiers propres à l'écran : la page et ses imports locaux (app/, components/ hors ui, hooks/), récursivement. */
function screenFiles(entry: string): string[] {
    const seen = new Set<string>([entry]);
    let frontier = [entry];
    for (let depth = 0; depth < 6 && frontier.length > 0; depth++) {
        const next: string[] = [];
        for (const f of frontier) {
            for (const b of bindingsOf(f)) {
                const to = b.from;
                if (!to || seen.has(to) || !/\.tsx?$/.test(to) || to.startsWith('components/ui/')) continue;
                if (!['app/', 'components/', 'hooks/'].some((p) => to.startsWith(p))) continue;
                seen.add(to);
                next.push(to);
            }
        }
        frontier = next;
    }
    return Array.from(seen);
}

interface JsxUse {
    file: string;
    attrs: Map<string, ts.JsxAttribute>;
}

/** Éléments JSX rendus dans `files` dont la balise est le composant `name` importé de `componentFile`. */
function rendered(files: string[], name: string, componentFile: string | null): JsxUse[] {
    if (!componentFile) return [];
    const out: JsxUse[] = [];
    for (const file of files) {
        const locals = new Set(bindingsOf(file).filter((b) => b.imported === name && b.from === componentFile).map((b) => b.local));
        if (locals.size === 0) continue;
        const visit = (node: ts.Node): void => {
            if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && locals.has(node.tagName.getText())) {
                const attrs = new Map<string, ts.JsxAttribute>();
                for (const p of node.attributes.properties) if (ts.isJsxAttribute(p)) attrs.set(p.name.getText(), p);
                out.push({ file, attrs });
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceOf(file));
    }
    return out;
}

function assertRenders(files: string[], name: string, what: string): JsxUse[] {
    const file = uiComponent(name);
    assert.ok(file, `${what} : composant ${name} absent de components/ui`);
    const uses = rendered(files, name, file);
    assert.ok(uses.length > 0, `${what} : ${name} (${file}) n'est rendu par aucun fichier de l'écran (${files.join(', ')})`);
    return uses;
}

const ADMIN_LIST_PAGE = 'app/admin/events/page.tsx';
const ADMIN_FICHE_PAGE = 'app/admin/events/[id]/page.tsx';

describe('5.7 — écrans admin (contrôles statiques)', () => {
    test('app/admin/events/page.tsx : StatusBadge, Tabs (par statut), Pagination ; lit /api/admin/events ; états chargement, vide, erreur avec « Réessayer »', () => {
        assert.ok(isFile(ADMIN_LIST_PAGE), `${ADMIN_LIST_PAGE} absent`);
        const files = screenFiles(ADMIN_LIST_PAGE);
        const code = files.map(codeOf).join('\n');
        assertRenders(files, 'StatusBadge', ADMIN_LIST_PAGE);
        // Lot 6 (contrat A7, adaptation signalée) : les onglets par statut sont rendus par components/ui/ScrollableTabs,
        // qui enveloppe Tabs avec les indices de défilement ; screenFiles exclut components/ui, d'où ce nom.
        assertRenders(files, 'ScrollableTabs', ADMIN_LIST_PAGE);
        assertRenders(files, 'Pagination', ADMIN_LIST_PAGE);
        assert.match(code, /['"`]\/api\/admin\/events[?'"`]/, `${ADMIN_LIST_PAGE} : ne lit pas GET /api/admin/events`);
        const retry = assertRenders(files, 'ErrorState', ADMIN_LIST_PAGE);
        assert.ok(retry.some((u) => u.attrs.has('onRetry')), `${ADMIN_LIST_PAGE} : ErrorState sans onRetry`);
        assertRenders(files, 'EmptyState', ADMIN_LIST_PAGE);
        assert.ok(files.some((f) => bindingsOf(f).some((b) => /Skeleton$/.test(b.imported) && !!b.from?.startsWith('components/ui/'))), `${ADMIN_LIST_PAGE} : aucun squelette de chargement`);
        assert.ok(files.some((f) => bindingsOf(f).some((b) => b.from === 'lib/events/event-status.ts')), `${ADMIN_LIST_PAGE} : onglets sans EVENT_STATUS_META (libellés)`);
    });

    test('app/admin/events/[id]/page.tsx : StatusBadge, ReasonDialog (refuser, suspendre), POST …/transition, historique, lien depuis la liste', () => {
        assert.ok(isFile(ADMIN_FICHE_PAGE), `${ADMIN_FICHE_PAGE} absent`);
        const files = screenFiles(ADMIN_FICHE_PAGE);
        const code = files.map(codeOf).join('\n');
        assertRenders(files, 'StatusBadge', ADMIN_FICHE_PAGE);
        assertRenders(files, 'ReasonDialog', ADMIN_FICHE_PAGE);
        assert.match(code, /\/api\/admin\/events\/\$\{[^}]+\}\/transition/, `${ADMIN_FICHE_PAGE} : aucun appel à POST /api/admin/events/[id]/transition`);
        assert.match(code, /\/api\/admin\/events\/\$\{[^}]+\}[`'"]/, `${ADMIN_FICHE_PAGE} : ne lit pas GET /api/admin/events/[id]`);
        assert.match(code, /reason_required|reasonRequired/, `${ADMIN_FICHE_PAGE} : le motif n'est pas demandé selon event_actions (reason_required)`);
        assert.match(code, /\bhistory\b|historique/i, `${ADMIN_FICHE_PAGE} : historique des statuts non affiché`);
        assert.doesNotMatch(code, /JSON\.stringify\(\s*\{[^}]*\b(?:to|status)\s*:\s*['"][A-Z_]+['"]/, `${ADMIN_FICHE_PAGE} : transition codée en dur au lieu des actions de event_actions`);
        assert.ok(isFile(ADMIN_LIST_PAGE), `${ADMIN_LIST_PAGE} absent`);
        const listCode = screenFiles(ADMIN_LIST_PAGE).map(codeOf).join('\n');
        assert.match(listCode, /\/admin\/events\/\$\{[^}]+\}[`'"]/, `${ADMIN_LIST_PAGE} : aucun lien vers la fiche /admin/events/[id]`);
    });

    test('navigation admin : « Événements » → /admin/events dans le menu et dans la barre du bas ; aucune entrée en double', () => {
        const navFiles = [...listFiles('components', /\.tsx?$/), ...listFiles('lib', /\.tsx?$/)];
        const entries: Array<{ file: string; owner: string }> = [];
        const duplicates: string[] = [];
        for (const file of navFiles) {
            const sf = sourceOf(file);
            const visit = (node: ts.Node): void => {
                if (ts.isObjectLiteralExpression(node)) {
                    const strings = node.properties.filter(ts.isPropertyAssignment)
                        .map((p) => ({ key: p.name.getText(sf), value: ts.isStringLiteralLike(p.initializer) ? p.initializer.text : null }));
                    if (strings.some((s) => s.key === 'href' && s.value === '/admin/events') && strings.some((s) => s.value === 'Événements')) {
                        let cur: ts.Node | undefined = node.parent;
                        while (cur && !ts.isVariableDeclaration(cur)) cur = cur.parent;
                        entries.push({ file, owner: cur && ts.isVariableDeclaration(cur) ? cur.name.getText(sf) : '' });
                    }
                }
                if (ts.isArrayLiteralExpression(node) && node.elements.length > 1 && node.elements.every(ts.isObjectLiteralExpression)) {
                    const hrefs = node.elements.map((el) => {
                        const p = (el as ts.ObjectLiteralExpression).properties.find((x) => ts.isPropertyAssignment(x) && x.name.getText(sf) === 'href');
                        return p && ts.isPropertyAssignment(p) && ts.isStringLiteralLike(p.initializer) ? p.initializer.text : null;
                    });
                    const adminHrefs = hrefs.filter((h): h is string => !!h && h.startsWith('/admin'));
                    if (adminHrefs.length > 0) {
                        const dup = adminHrefs.filter((h, i) => adminHrefs.indexOf(h) !== i);
                        if (dup.length > 0) duplicates.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1} ${dup.join(', ')}`);
                    }
                }
                ts.forEachChild(node, visit);
            };
            visit(sf);
        }
        assert.ok(entries.some((e) => /mobile/i.test(e.owner)), `barre du bas admin sans « Événements » → /admin/events (entrées trouvées : ${JSON.stringify(entries)})`);
        assert.ok(entries.some((e) => !/mobile/i.test(e.owner)), `menu admin sans « Événements » → /admin/events (entrées trouvées : ${JSON.stringify(entries)})`);
        assert.deepEqual(duplicates, [], `entrées de navigation admin en double (même href, onglets actifs ensemble) : ${duplicates.join(' ; ')}`);
    });

    test('app/admin/services/page.tsx n’écrit plus le statut d’un événement (PATCH table events retiré)', () => {
        const file = 'app/admin/services/page.tsx';
        const code = codeOf(file);
        assert.doesNotMatch(code, /(?:handleUpdateStatus|openRejectModal)\(\s*['"]events['"]/, `${file} : changement de statut d'événement depuis l'onglet services`);
        assert.doesNotMatch(code, /\btable\s*:\s*['"]events['"]/, `${file} : la table events reste une cible de PATCH /api/admin/services`);
        if (/key\s*:\s*['"]events['"]/.test(code)) assert.match(code, /\/admin\/events/, `${file} : l'onglet Événements ne renvoie pas vers /admin/events`);
    });
});
