/**
 * Lot 9 ter (contrat C.7, X3, X16, EC7) — outils des suites des zones, des portes et de la liste des invités
 * (9t.15 à 9t.18). Chaque appel passe par la route du contrat, avec le jeton de l'acteur (jamais le service_role pour
 * l'acteur testé). Les routes nouvelles sont importées dynamiquement : le typecheck passe avant le correctif, et
 * chaque appel échoue en nommant la route absente et sa tâche (rouge propre, jamais une erreur d'import brute).
 *
 * Routes (contrat 4.3, C.2.3, C.3.4) :
 *  - GET et PUT /api/partner/events/[id]/zones (9t.15) ; PATCH /api/partner/team/gate (9t.15) ;
 *  - GET /api/controller/gates?eventId= et POST /api/controller/gate (9t.15) ;
 *  - POST /api/controller/scan et /scan/lookup avec `gateId` (9t.15) ; POST /api/controller/scan/guests (9t.17) ;
 *  - POST /api/partner/events/[id]/invitations (corps libre, `guest_names` en 9t.17) ;
 *    PATCH /api/partner/events/[id]/invitations/[ticketId] (`guest_name`, 9t.17).
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { routeContext } from './helpers';
import { importModule, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { authed, createTimedEvent, scan, type RouteResult, type ScanOptions } from './acces-helpers';
import type { TestPartner } from './finance-helpers';

export type ZoneKind = 'ENTREE' | 'CONTROLE';

/** Zone demandée par une suite : noms des catégories admises et des portes (contrat C.7). */
export interface ZoneSpec { name: string; kind: ZoneKind; admits: string[]; gates: string[] }

/** Événement à zones : identifiants lus dans la réponse du PUT des zones, par nom de zone puis de porte. */
export interface ZonedEvent extends SaleEvent { zones: Record<string, { id: string; kind: ZoneKind; gates: Record<string, string> }> }

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const ZONES_ROUTE = '../../app/api/partner/events/[id]/zones/route';
const TEAM_GATE_ROUTE = '../../app/api/partner/team/gate/route';
const CONTROLLER_GATES_ROUTE = '../../app/api/controller/gates/route';
const CONTROLLER_GATE_ROUTE = '../../app/api/controller/gate/route';
const LOOKUP_ROUTE = '../../app/api/controller/scan/lookup/route';
const GUESTS_ROUTE = '../../app/api/controller/scan/guests/route';
const INVITATIONS_ROUTE = '../../app/api/partner/events/[id]/invitations/route';
const INVITATION_ROUTE = '../../app/api/partner/events/[id]/invitations/[ticketId]/route';

function errText(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/** Gestionnaire d'une route du contrat ; échec explicite qui nomme la route et sa tâche si elle manque. */
async function routeOf(modPath: string, method: string, what: string, task: string): Promise<Handler> {
    let mod: Record<string, unknown>;
    try {
        mod = (await importModule(modPath)) as Record<string, unknown>;
    } catch (err) {
        assert.fail(`${what} : route absente (${task}) : ${errText(err)}`);
    }
    assert.equal(typeof mod[method], 'function', `${what} : gestionnaire ${method} exporté par ${modPath} (${task})`);
    return mod[method] as Handler;
}

/** Réponse lue en entier ; un corps qui n'est pas du JSON est rendu tel quel sous `raw` (jamais avalé). */
async function call(handler: Handler, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Record<string, unknown> = {};
    if (text) {
        try {
            body = JSON.parse(text) as Record<string, unknown>;
        } catch {
            body = { raw: text.slice(0, 2000) };
        }
    }
    return { status: res.status, body };
}

function showResult(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 1200)}`;
}

// ── Zones et portes de l'événement (propriétaire) ─────────────────────────

/** PUT /api/partner/events/[id]/zones, corps brut (configuration complète, contrat 4.3). */
export async function saveZones(caller: Pick<Buyer, 'accessToken'>, eventId: string, body: unknown): Promise<RouteResult> {
    const PUT = await routeOf(ZONES_ROUTE, 'PUT', 'PUT /api/partner/events/[id]/zones', '9t.15');
    return call(PUT, authed(`/api/partner/events/${eventId}/zones`, 'PUT', caller as Buyer, body), routeContext({ id: eventId }));
}

/** GET /api/partner/events/[id]/zones (contrat 4.3, réponse de F30 sans `ok`). */
export async function getZones(caller: Pick<Buyer, 'accessToken'>, eventId: string): Promise<RouteResult> {
    const GET = await routeOf(ZONES_ROUTE, 'GET', 'GET /api/partner/events/[id]/zones', '9t.15');
    return call(GET, authed(`/api/partner/events/${eventId}/zones`, 'GET', caller as Buyer), routeContext({ id: eventId }));
}

/**
 * Événement de la partenaire (createTimedEvent, mêmes options), puis zones posées par PUT …/zones (200 exigé) :
 * pour chaque zone, `category_ids` = identifiants des catégories nommées dans `admits`, `gates` = `[{ name }]`. Les
 * identifiants des zones et des portes sont lus dans la réponse (`zones[].id`, `zones[].gates[].id`).
 */
export async function createZonedEvent(partner: TestPartner, label: string, categories: CategorySpec[], zones: ZoneSpec[],
    opts: { startsInHours?: number; durationHours?: number; status?: string } = {}): Promise<ZonedEvent> {
    const ev = await createTimedEvent(partner.partnerId, label, categories, opts);
    const body = {
        zones: zones.map((z) => ({
            name: z.name,
            kind: z.kind,
            category_ids: z.admits.map((name) => {
                const cat = ev.categories[name];
                assert.ok(cat, `zone ${z.name} : catégorie ${name} absente de l'événement ${label} (${Object.keys(ev.categories).join(', ')})`);
                return cat.id;
            }),
            gates: z.gates.map((name) => ({ name })),
        })),
    };
    const res = await saveZones(partner, ev.eventId, body);
    assert.equal(res.status, 200, `zones de l'événement ${label} enregistrées (contrat 4.3) : ${showResult(res)}`);
    const served = Array.isArray(res.body.zones) ? (res.body.zones as Array<Record<string, unknown>>) : [];
    const out: ZonedEvent['zones'] = {};
    for (const z of zones) {
        const found = served.find((s) => s.name === z.name);
        assert.ok(found, `zone ${z.name} absente de la réponse du PUT : ${showResult(res)}`);
        assert.equal(found.kind, z.kind, `zone ${z.name} : type servi`);
        const gates = Array.isArray(found.gates) ? (found.gates as Array<Record<string, unknown>>) : [];
        const byName: Record<string, string> = {};
        for (const g of z.gates) {
            const gate = gates.find((s) => s.name === g);
            assert.ok(gate && typeof gate.id === 'string', `porte ${g} de la zone ${z.name} absente de la réponse du PUT : ${showResult(res)}`);
            byName[g] = gate.id as string;
        }
        assert.equal(typeof found.id, 'string', `zone ${z.name} : identifiant servi`);
        out[z.name] = { id: found.id as string, kind: z.kind, gates: byName };
    }
    return { ...ev, zones: out };
}

/** Identifiant d'une porte de l'événement, par son nom ; échec explicite si elle n'existe pas. */
export function gateOf(ev: ZonedEvent, gateName: string): string {
    for (const zone of Object.values(ev.zones)) {
        const id = zone.gates[gateName];
        if (id) return id;
    }
    const known = Object.values(ev.zones).flatMap((z) => Object.keys(z.gates));
    assert.fail(`porte ${gateName} absente de l'événement à zones (portes : ${known.join(', ') || 'aucune'})`);
}

/** PATCH /api/partner/team/gate : porte d'un contrôleur affecté (null : retirée), droit de changer de porte. */
export async function assignGate(caller: Pick<Buyer, 'accessToken'>, eventId: string, controllerId: string, gateId: string | null,
    opts: { canChange?: boolean } = {}): Promise<RouteResult> {
    const PATCH = await routeOf(TEAM_GATE_ROUTE, 'PATCH', 'PATCH /api/partner/team/gate', '9t.15');
    const body: Record<string, unknown> = { eventId, controllerId, gateId };
    if (opts.canChange !== undefined) body.gateChangeAllowed = opts.canChange;
    return call(PATCH, authed('/api/partner/team/gate', 'PATCH', caller as Buyer, body));
}

// ── Contrôleur : porte, scan, vérification manuelle ───────────────────────

/** POST /api/controller/scan avec `gateId` (null compris) ; `undefined` : corps sans `gateId` (contrat C.2.3). */
export async function scanAtGate(user: Buyer, body: Record<string, unknown>, gateId: string | null | undefined, opts: ScanOptions = {}): Promise<RouteResult> {
    return scan(user, gateId === undefined ? body : { ...body, gateId }, opts);
}

/** POST /api/controller/scan/lookup `{ eventId, manualTicketNumber, gateId? }` ; `undefined` : sans `gateId`. */
export async function lookupAtGate(user: Buyer, eventId: string, ticketNumber: string, gateId: string | null | undefined): Promise<RouteResult> {
    const POST = await routeOf(LOOKUP_ROUTE, 'POST', 'POST /api/controller/scan/lookup', '9t.15');
    const body: Record<string, unknown> = { eventId, manualTicketNumber: ticketNumber };
    if (gateId !== undefined) body.gateId = gateId;
    return call(POST, authed('/api/controller/scan/lookup', 'POST', user, body));
}

/** GET /api/controller/gates?eventId= : portes de l'événement pour le contrôleur (contrat 4.3). */
export async function controllerGates(user: Buyer, eventId: string): Promise<RouteResult> {
    const GET = await routeOf(CONTROLLER_GATES_ROUTE, 'GET', 'GET /api/controller/gates', '9t.15');
    return call(GET, authed(`/api/controller/gates?eventId=${encodeURIComponent(eventId)}`, 'GET', user));
}

/** POST /api/controller/gate `{ eventId, gateId }` : le contrôleur autorisé change de porte (contrat 4.3). */
export async function selectGate(user: Buyer, eventId: string, gateId: string): Promise<RouteResult> {
    const POST = await routeOf(CONTROLLER_GATE_ROUTE, 'POST', 'POST /api/controller/gate', '9t.15');
    return call(POST, authed('/api/controller/gate', 'POST', user, { eventId, gateId }));
}

// ── Liste des invités ─────────────────────────────────────────────────────

/** POST /api/controller/scan/guests `{ eventId, query }` (contrat C.3.4). */
export async function guestSearch(user: Buyer, eventId: string, query: string): Promise<RouteResult> {
    const POST = await routeOf(GUESTS_ROUTE, 'POST', 'POST /api/controller/scan/guests', '9t.17');
    return call(POST, authed('/api/controller/scan/guests', 'POST', user, { eventId, query }));
}

/**
 * Validation par la liste : POST /api/controller/scan `{ eventId, guestTicketId, identityVerified, gateId? }`
 * (contrat C.2.3). `identityVerified` vaut vrai par défaut ; clé d'idempotence neuve sauf `idempotencyKey`.
 */
export async function guestAdmit(user: Buyer, eventId: string, ticketId: string,
    opts: { gateId?: string | null; identityVerified?: boolean; idempotencyKey?: string } = {}): Promise<RouteResult> {
    const body: Record<string, unknown> = { eventId, guestTicketId: ticketId, identityVerified: opts.identityVerified ?? true };
    if (opts.gateId !== undefined) body.gateId = opts.gateId;
    return scan(user, body, { idempotencyKey: opts.idempotencyKey });
}

// ── Invitations nommées ───────────────────────────────────────────────────

/** POST /api/partner/events/[id]/invitations, corps brut (`category_id`, `phones`, `quantity`, `guest_names`). */
export async function sendInvitations(caller: Pick<Buyer, 'accessToken'>, eventId: string, body: unknown): Promise<RouteResult> {
    const POST = await routeOf(INVITATIONS_ROUTE, 'POST', 'POST /api/partner/events/[id]/invitations', '9t.17');
    return call(POST, authed(`/api/partner/events/${eventId}/invitations`, 'POST', caller as Buyer, body), routeContext({ id: eventId }));
}

/** PATCH /api/partner/events/[id]/invitations/[ticketId] `{ guest_name }` (null : nom retiré ; contrat C.3.4). */
export async function setGuestName(caller: Pick<Buyer, 'accessToken'>, eventId: string, ticketId: string, guestName: string | null): Promise<RouteResult> {
    const PATCH = await routeOf(INVITATION_ROUTE, 'PATCH', 'PATCH /api/partner/events/[id]/invitations/[ticketId]', '9t.17');
    return call(PATCH, authed(`/api/partner/events/${eventId}/invitations/${ticketId}`, 'PATCH', caller as Buyer, { guest_name: guestName }),
        routeContext({ id: eventId, ticketId }));
}
