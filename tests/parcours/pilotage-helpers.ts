/**
 * Lot 5, tâche 5.10 — outils des suites de la page de pilotage (contrat, sections I, K (l) et U).
 *
 * 1. Jeu de données connu (buildKnownDataset), créé par chaque suite qui l'appelle (partenaire dédié,
 *    aucune fixture du seed modifiée) :
 *    - événement PUBLIE à horaire précis (début dans 2 h, durée 4 h, fenêtre de scan ouverte), créé
 *      BROUILLON puis avancé par les RPC du cycle (cycle-helpers, contrat D4) ;
 *    - catégories : Standard 5 000 F (quota 50), VIP 15 000 F (10), Étudiant 2 000 F (20), plus une
 *      catégorie témoin inactive « Prévente (fermée) » 3 000 F (30), sans vente : capacité = Σ des
 *      quotas des catégories ACTIVES = 80 ;
 *    - ventes en ligne confirmées (checkout, SamirPay simulé, webhook) : P1 Standard ×2 (Awa Diop),
 *      P2 VIP ×1 (Moussa Fall), P3 Étudiant ×2 (Khady Sow), P4 Standard ×1 (Cheikh Gueye), puis le
 *      billet de P4 remboursé (ticket_refund_request, versement confirmé) ;
 *    - un panier en cours de paiement : Standard ×3 (Ndeye Faye), paiement PENDING, réservation ACTIVE ;
 *    - une invitation : billet VIP à 0 F, canal INVITATION (Mariama Cisse), stock vendu + 1 ;
 *    - une vente espèces au scan (données historiques, lot 9 A16 : legacyCashCheckin reproduit en base ce que
 *      l'encaissement retiré laissait) : commande impayée de 2 billets Standard (Ousmane Ba), le premier encaissé au
 *      scan puis composté (caisse S1), le second laissé impayé ;
 *    - ventes au guichet (contrat C7 : billet vendu ET composté, scan COUNTER) : Étudiant ×1 sur S1,
 *      Standard ×2 sur S2 ;
 *    - contrôleurs : C1 Ibrahima Ndiaye (« Porte Nord », espèces), C2 Fatou Sarr (« Porte Sud »,
 *      espèces), C4 Aissatou Kane (« Entrée VIP », sans espèces, aucun scan), et un contrôleur non
 *      affecté C3 Lamine Diallo (tentative refusée forbidden) ;
 *    - scans : C1 composte P1-a, C1 puis C2 retentent P1-a (already_used ×2 : le billet tenté 3 fois),
 *      C2 composte P2, C2 présente P3-b avec un code de plus de 40 s (qr_expired), C3 tente P3-a
 *      (forbidden), C1 composte l'invitation ; ligne historique : C1 a encaissé et composté le billet ESP-a ;
 *    - incidents techniques (scan_incidents, contrat C8) : C1 NETWORK ×2, C2 TIMEOUT ×1 et
 *      RATE_LIMITED ×1 ;
 *    - caisses : S1 (C1, fonds 10 000 F) encaisse 5 000 F au scan et 2 000 F au guichet, clôturée par
 *      la route du contrat C2 avec 6 500 F déclarés hors fonds (écart −500 F justifié, PIN régisseur) ;
 *      S2 (C2, fonds 0 F) encaisse 10 000 F au guichet et reste ouverte.
 *    Le jeu est contrôlé en fin de construction par des requêtes brutes (assertDatasetTruth) : une
 *    divergence ultérieure vient donc de la page de pilotage, pas du jeu.
 *
 * 2. Valeurs attendues (EXPECTED) : calculées à la main à partir du jeu ci-dessus (détail dans les
 *    commentaires), jamais par une requête qui recopierait l'implémentation.
 *
 * 3. Routes du contrat I, importées dynamiquement (elles n'existent pas avant le correctif) :
 *    GET /api/partner/events/[id]/pilotage/{overview,sales,entries,team,cash,closing},
 *    POST /api/partner/events/[id]/participants-export, PATCH /api/partner/team/assignments/[id].
 *
 * 4. Champs de réponse fixés par ces suites (le contrat I nomme les données, pas les clés JSON).
 *    Chaque route renvoie le corps de sa RPC pilotage_* tel quel, sans enveloppe :
 *    - overview : status, actions[] { to, reason_required, label }, tickets { sold, invitations,
 *      capacity, in_payment, remaining }, entries { total, counter, attendance_rate (rapport de 0 à 1) },
 *      revenue { online, cash, refunded } (clés de pilotage_compute_overview, contrat U) ;
 *    - sales : by_category[] { category_id, name, sold, in_payment, remaining }, by_day[] { day
 *      (AAAA-MM-JJ à Dakar), sold } ;
 *    - entries : total, counter, refused, by_scanner[] { scanner_id, name, accepted, refused,
 *      last_activity_at }, by_entry_point[] { entry_point, accepted }, by_category[] { category_id,
 *      accepted }, by_quarter[] { start, accepted, refused }, refusals_by_reason[] { result, label,
 *      count }, repeated_attempts[] { ticket_id, ticket_number, attempts, last_result },
 *      incidents[] { scanner_id, kind, count } ;
 *    - team : controllers[] { assignment_id, controller_id, name, entry_point, can_accept_cash } ;
 *    - cash : shifts[] { id, controller_id, status, opening_float, cash_collected, declared,
 *      difference, justification } (clés de pilotage_compute_cash, contrat U), by_controller[]
 *      { controller_id, cash_collected }, pin { hasPin, updatedAt } ;
 *    - closing : absents { count, list[] { name, category } }, z[] { shift_id, status, opening_float,
 *      expected, declared, difference, by_source[] { source SCAN|GUICHET, count, amount },
 *      by_category[] { category_id, count, amount } }, finance { organizer_net,
 *      funds_available_from, funds_available_to }.
 *    Refus : { error, code } (convention du contrat), sans aucune donnée de l'événement.
 *
 * Fuseau : Africa/Dakar = UTC+0 toute l'année (comme acces-helpers et cycle-helpers).
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { CashoutService } from '../../lib/payments/cashout.service';
import { openConcurrentClient } from '../helpers/db';
import { routeContext } from './helpers';
import { cart, checkout, importModule, newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, withSettings, type Purchase, type TestPartner } from './finance-helpers';
import {
    authed, createCashOrderTickets, newController, openShift, scan, ticketPayload, ticketRow, type RouteResult,
} from './acces-helpers';
import { createEventInStatus, type DraftEvent } from './cycle-helpers';

export type Row = Record<string, unknown>;

/** Appelant d'une route : compte créé par la suite (Buyer, TestPartner) ou compte du seed (signInAs). */
export interface Caller {
    accessToken: string;
}

// ── Jeu de données : catégories, prix, réglages ────────────────────────────

export const STANDARD = 'Standard';
export const VIP = 'VIP';
export const ETUDIANT = 'Étudiant';
export const PREVENTE = 'Prévente (fermée)';

export const CATEGORY_SPECS: CategorySpec[] = [
    { name: STANDARD, price: 5_000, total: 50 },
    { name: VIP, price: 15_000, total: 10 },
    { name: ETUDIANT, price: 2_000, total: 20 },
    // Témoin : catégorie inactive, exclue de la capacité (contrat I : Σ total_quantity des catégories actives)
    { name: PREVENTE, price: 3_000, total: 30, isActive: false },
];

/** Délai de disponibilité des fonds appliqué aux ventes en ligne du jeu (réglage recopié sur le paiement). */
export const PAYOUT_DELAY_HOURS = 48;
export const S1_OPENING_FLOAT = 10_000;
export const S1_DECLARED = 6_500;
export const S1_JUSTIFICATION = 'Erreur de rendu de monnaie sur un billet Standard au guichet';

export const ENTRY_POINTS = { c1: 'Porte Nord', c2: 'Porte Sud', c4: 'Entrée VIP' } as const;

/**
 * Valeurs attendues, calculées à la main.
 *
 * Billets de l'événement (12 lignes) :
 *   P1-a Standard en ligne UTILISE · P1-b Standard en ligne VALIDE · P2 VIP en ligne UTILISE ·
 *   P3-a Étudiant en ligne VALIDE · P3-b Étudiant en ligne VALIDE · P4 Standard en ligne REMBOURSE ·
 *   INV VIP invitation UTILISE · ESP-a Standard à régler sur place, encaissé, UTILISE ·
 *   ESP-b Standard à régler sur place, impayé, VALIDE · G1 Étudiant guichet S1 UTILISE ·
 *   G2-a et G2-b Standard guichet S2 UTILISE.
 * vendus (VALIDE et UTILISE, hors invitations) = P1-a, P1-b, P2, P3-a, P3-b, ESP-a, ESP-b, G1, G2-a, G2-b = 10
 *   Standard 6 (P1-a, P1-b, ESP-a, ESP-b, G2-a, G2-b), VIP 1 (P2), Étudiant 3 (P3-a, P3-b, G1).
 * invitations = 1 (VIP). capacité = 50 + 10 + 20 = 80 (Prévente inactive exclue).
 * en cours de paiement = 3 (Standard, panier PENDING).
 * restants = capacité − vendus − invitations − en cours = 80 − 10 − 1 − 3 = 66
 *   (Standard 50 − 6 − 3 = 41, VIP 10 − 1 − 1 = 8, Étudiant 20 − 3 = 17) : une place donnée en invitation
 *   n'est plus vendable (stock en base : total − sold_quantity − held_quantity, contrôle de vente du lot 2).
 * CA en ligne = P1 10 000 + P2 15 000 + P3 4 000 = 29 000 (VENTE 34 000 − REMBOURSEMENT 5 000).
 * CA espèces = ESP-a 5 000 + G1 2 000 + G2 10 000 = 17 000 (ESP-b, sans paiement, exclu).
 * remboursé = 5 000 en ligne + 0 espèces à rembourser par l'organisateur.
 * entrées = P1-a, P2, INV, ESP-a, G1, G2-a, G2-b = 7, dont guichet 3 ; taux = 7 / (10 + 1).
 * refus = already_used ×2 (P1-a par C1 puis C2), qr_expired ×1 (P3-b), forbidden ×1 (C3) = 4 ; la
 *   ligne cash_required consommée d'ESP-a n'est pas un refus (donnée historique, lot 9 A16 : billet encaissé puis composté).
 * par contrôleur : C1 entrées 4 (P1-a, INV, ESP-a, G1), refus 1 ; C2 entrées 3 (P2, G2-a, G2-b), refus 2.
 * par point d'entrée : Porte Nord 4, Porte Sud 3. par catégorie : Standard 4, VIP 2, Étudiant 1.
 * tentatives multiples : P1-a seul (3 tentatives, dernière already_used) ; le couple historique cash_required →
 *   valid d'ESP-a est exclu.
 * caisses : S1 fonds 10 000, encaissé 5 000 (scan) + 2 000 (guichet) = 7 000, déclaré 6 500, écart −500 ;
 *   S2 fonds 0, encaissé 10 000, ouverte.
 * absents = billets VALIDE = P1-b, P3-a, P3-b, ESP-b = 4. net organisateur = 29 000.
 * export des participants = billets VALIDE et UTILISE, invitations comprises = 10 + 1 = 11 lignes.
 */
export const EXPECTED = {
    tickets: { sold: 10, invitations: 1, capacity: 80, in_payment: 3, remaining: 66 },
    entries: { total: 7, counter: 3, refused: 4, attendance_rate: 7 / 11 },
    revenue: { online: 29_000, cash: 17_000, refunded: 5_000 },
    byCategory: {
        [STANDARD]: { sold: 6, in_payment: 3, remaining: 41, accepted: 4 },
        [VIP]: { sold: 1, in_payment: 0, remaining: 8, accepted: 2 },
        [ETUDIANT]: { sold: 3, in_payment: 0, remaining: 17, accepted: 1 },
    } as Record<string, { sold: number; in_payment: number; remaining: number; accepted: number }>,
    byEntryPoint: { [ENTRY_POINTS.c1]: 4, [ENTRY_POINTS.c2]: 3 } as Record<string, number>,
    byScanner: { c1: { accepted: 4, refused: 1 }, c2: { accepted: 3, refused: 2 } },
    refusalsByReason: { already_used: 2, qr_expired: 1, forbidden: 1 } as Record<string, number>,
    repeatedAttempts: { attempts: 3, lastResult: 'already_used' },
    incidents: { c1: { NETWORK: 2 }, c2: { TIMEOUT: 1, RATE_LIMITED: 1 } } as Record<'c1' | 'c2', Record<string, number>>,
    shifts: {
        s1: { status: 'CLOTURE', opening_float: S1_OPENING_FLOAT, cash_collected: 7_000, declared: S1_DECLARED, difference: S1_DECLARED - 7_000 },
        s2: { status: 'OUVERT', opening_float: 0, cash_collected: 10_000, declared: null, difference: null },
    },
    cashByController: { c1: 7_000, c2: 10_000 },
    zS1: {
        bySource: { SCAN: { count: 1, amount: 5_000 }, GUICHET: { count: 1, amount: 2_000 } } as Record<string, { count: number; amount: number }>,
        byCategory: { [STANDARD]: { count: 1, amount: 5_000 }, [ETUDIANT]: { count: 1, amount: 2_000 } } as Record<string, { count: number; amount: number }>,
    },
    absents: 4,
    organizerNet: 29_000,
    exportRows: 11,
} as const;

// ── Jeu de données : construction ──────────────────────────────────────────

export interface KnownDataset {
    label: string;
    partner: TestPartner;
    event: DraftEvent;
    eventId: string;
    title: string;
    /** Identifiant de chaque catégorie, par nom. */
    categoryIds: Record<string, string>;
    /** Fin de l'événement à sa création (Dakar = UTC) : base de la disponibilité des fonds des ventes en ligne. */
    originalEnd: Date;
    c1: Buyer;
    c2: Buyer;
    /** Contrôleur NON affecté (tentative forbidden). */
    c3: Buyer;
    c4: Buyer;
    /** Identifiants des affectations (event_controllers.id) de C1, C2 et C4 sur l'événement. */
    assignments: { c1: string; c2: string; c4: string };
    buyers: { b1: Buyer; b2: Buyer; b3: Buyer; b4: Buyer; b5: Buyer; b6: Buyer; invitee: Buyer };
    tickets: {
        p1a: string; p1b: string; p2: string; p3a: string; p3b: string; p4: string; invitation: string;
        cashPaid: string; cashUnpaid: string; counterS1: string; counterS2: string[];
    };
    payments: { online: string[]; refunded: string; pending: string; cashCheckin: string; counterS1: string; counterS2: string };
    shifts: { s1: string; s2: string };
    regisseurPin: string;
}

export function fullName(user: Pick<Buyer, 'firstName' | 'lastName'>): string {
    return `${user.firstName} ${user.lastName}`;
}

export function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 1200)}`;
}

function errText(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

async function rename(user: Buyer, firstName: string, lastName: string): Promise<void> {
    const { error } = await service.from('users').update({ first_name: firstName, last_name: lastName }).eq('id', user.userId);
    assert.equal(error, null, `nom du compte ${user.email} : ${error?.message}`);
    user.firstName = firstName;
    user.lastName = lastName;
}

async function namedController(partner: TestPartner, eventId: string | null, cash: boolean, label: string, firstName: string, lastName: string): Promise<Buyer> {
    const user = await newController(partner, eventId, { canAcceptCash: cash, label });
    await rename(user, firstName, lastName);
    return user;
}

/** Point d'entrée de l'affectation, posé en base (donnée du jeu) ; renvoie l'identifiant de l'affectation. */
async function setEntryPoint(eventId: string, userId: string, entryPoint: string): Promise<string> {
    const { data, error } = await service.from('event_controllers').update({ entry_point: entryPoint })
        .eq('event_id', eventId).eq('user_id', userId).select('id').single();
    assert.equal(error, null, `point d’entrée ${entryPoint} : ${error?.message}`);
    return String(data.id);
}

async function openCashShift(user: Buyer, eventId: string, openingFloat: number): Promise<string> {
    const res = await openShift(user, eventId, openingFloat);
    assert.equal(res.status, 200, `ouverture de la caisse de ${fullName(user)} : ${show(res)}`);
    const { data, error } = await service.from('controller_shifts').select('id, opening_float_amount')
        .eq('controller_id', user.userId).eq('event_id', eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisse ouverte : ${error?.message}`);
    const rows = (data ?? []) as Row[];
    assert.equal(rows.length, 1, `une caisse OUVERT pour ${fullName(user)} (trouvé : ${rows.length})`);
    assert.equal(Number(rows[0].opening_float_amount), openingFloat, `fonds de caisse de ${fullName(user)}`);
    return String(rows[0].id);
}

/** Scan caméra du billet par le compte ; `forbidden` attend le 403 du contrat du lot 4. */
async function scanExpect(user: Buyer, eventId: string, ticketId: string, expected: string, label: string, at?: Date): Promise<RouteResult> {
    const res = await scan(user, { eventId, payload: await ticketPayload(ticketId, at) });
    if (expected === 'forbidden') {
        assert.equal(res.status, 403, `${label} : scanneur non affecté → 403 attendu, ${show(res)}`);
    } else {
        assert.equal(res.status, 200, `${label} : ${show(res)}`);
        assert.equal(res.body.result, expected, `${label} : résultat ${expected} attendu, ${show(res)}`);
    }
    return res;
}

// ── Appels de routes ───────────────────────────────────────────────────────

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
const handlers = new Map<string, Handler>();

/** Gestionnaire d'une route du contrat, importé dynamiquement ; échec explicite si la route n'existe pas. */
export async function routeHandler(modPath: string, method: string, what: string): Promise<Handler> {
    const key = `${modPath}#${method}`;
    const cached = handlers.get(key);
    if (cached) return cached;
    let mod: Record<string, unknown>;
    try {
        mod = (await importModule(modPath)) as Record<string, unknown>;
    } catch (err) {
        assert.fail(`${what} absente (${modPath}) : ${errText(err)}`);
    }
    const handler = mod[method];
    assert.equal(typeof handler, 'function', `${what} : gestionnaire ${method} exporté par ${modPath}`);
    handlers.set(key, handler as Handler);
    return handler as Handler;
}

export async function invoke(handler: Handler, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
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

export const PILOTAGE_TABS = ['overview', 'sales', 'entries', 'team', 'cash', 'closing'] as const;
export type PilotageTab = (typeof PILOTAGE_TABS)[number];

/** GET /api/partner/events/[id]/pilotage/<onglet> (contrat I) ; caller null : sans session. */
export async function pilotageGet(caller: Caller | null, eventId: string, tab: PilotageTab): Promise<RouteResult> {
    const handler = await routeHandler(`../../app/api/partner/events/[id]/pilotage/${tab}/route`, 'GET', `GET /api/partner/events/[id]/pilotage/${tab} (contrat I)`);
    return invoke(handler, jsonRequest(`/api/partner/events/${eventId}/pilotage/${tab}`, 'GET', caller?.accessToken ?? null), routeContext({ id: eventId }));
}

/** Lecture d'un onglet par un appelant autorisé : 200 exigé, corps renvoyé. */
export async function pilotageOk(caller: Caller, eventId: string, tab: PilotageTab, who: string): Promise<Record<string, unknown>> {
    const res = await pilotageGet(caller, eventId, tab);
    assert.equal(res.status, 200, `pilotage/${tab} par ${who} : ${show(res)}`);
    return res.body;
}

export interface ExportResult {
    status: number;
    contentType: string;
    disposition: string;
    bytes: Uint8Array;
    /** Contenu décodé en UTF-8, BOM retiré. */
    text: string;
    /** Corps JSON (réponse d'erreur), sinon null. */
    json: Record<string, unknown> | null;
}

/** POST /api/partner/events/[id]/participants-export (contrat I, export des participants). */
export async function participantsExport(caller: Caller | null, eventId: string, body: Record<string, unknown>): Promise<ExportResult> {
    const handler = await routeHandler('../../app/api/partner/events/[id]/participants-export/route', 'POST', 'POST /api/partner/events/[id]/participants-export (contrat I)');
    const res = await handler(jsonRequest(`/api/partner/events/${eventId}/participants-export`, 'POST', caller?.accessToken ?? null, body), routeContext({ id: eventId }));
    const bytes = new Uint8Array(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') ?? '';
    const text = new TextDecoder('utf-8').decode(bytes);
    let json: Record<string, unknown> | null = null;
    if (contentType.includes('json')) {
        try {
            json = JSON.parse(text) as Record<string, unknown>;
        } catch {
            json = { raw: text.slice(0, 2000) };
        }
    }
    return { status: res.status, contentType, disposition: res.headers.get('content-disposition') ?? '', bytes, text, json };
}

export function showExport(r: ExportResult): string {
    return `HTTP ${r.status} (${r.contentType}) ${r.json ? JSON.stringify(r.json) : r.text.slice(0, 600)}`;
}

/** PATCH /api/partner/team/assignments/[id] { canAcceptCash } (contrat I, pilotage_team). */
export async function patchAssignment(caller: Caller, assignmentId: string, body: Record<string, unknown>): Promise<RouteResult> {
    const handler = await routeHandler('../../app/api/partner/team/assignments/[id]/route', 'PATCH', 'PATCH /api/partner/team/assignments/[id] (contrat I)');
    return invoke(handler, jsonRequest(`/api/partner/team/assignments/${assignmentId}`, 'PATCH', caller.accessToken, body), routeContext({ id: assignmentId }));
}

/** POST /api/partner/events/[id]/regisseur-pin (route du lot 4, régénération confirmée). */
export async function regisseurPin(caller: Caller, eventId: string, body: Record<string, unknown>): Promise<RouteResult> {
    const handler = await routeHandler('../../app/api/partner/events/[id]/regisseur-pin/route', 'POST', 'POST /api/partner/events/[id]/regisseur-pin (lot 4)');
    return invoke(handler, jsonRequest(`/api/partner/events/${eventId}/regisseur-pin`, 'POST', caller.accessToken, body), routeContext({ id: eventId }));
}

/** POST /api/controller/counter-sale avec Idempotency-Key (contrat C7). */
async function counterSale(user: Buyer, eventId: string, items: Array<[string, number]>): Promise<RouteResult> {
    const handler = await routeHandler('../../app/api/controller/counter-sale/route', 'POST', 'POST /api/controller/counter-sale (contrat C7)');
    return invoke(handler, authed('/api/controller/counter-sale', 'POST', user,
        { eventId, items: items.map(([categoryId, quantity]) => ({ categoryId, quantity })) },
        { 'idempotency-key': randomUUID() }));
}

/** POST /api/controller/shifts/close { shiftId, declaredCashTotal, justification, regisseurPin } (contrat C2). */
async function closeShift(user: Buyer, body: Record<string, unknown>): Promise<RouteResult> {
    const handler = await routeHandler('../../app/api/controller/shifts/close/route', 'POST', 'POST /api/controller/shifts/close (contrat C2)');
    return invoke(handler, authed('/api/controller/shifts/close', 'POST', user, body));
}

// ── Lecture des réponses ───────────────────────────────────────────────────

/** Valeur au chemin pointé (« tickets.sold ») ; undefined si un maillon manque. */
export function at(body: unknown, dotted: string): unknown {
    let cur: unknown = body;
    for (const key of dotted.split('.')) {
        if (cur === null || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[key];
    }
    return cur;
}

/** Nombre au chemin pointé (nombre JSON ou chaîne numérique) ; échec explicite s'il manque. */
export function numberAt(body: unknown, dotted: string, what: string): number {
    const v = at(body, dotted);
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    assert.ok(Number.isFinite(n), `${what} : champ « ${dotted} » numérique attendu, reçu ${JSON.stringify(v)} dans ${JSON.stringify(body).slice(0, 800)}`);
    return n;
}

/** Nombre ou null (champ facultatif comme l'écart d'une caisse ouverte). */
export function nullableNumber(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    return Number(v);
}

export function listAt(body: unknown, dotted: string, what: string): Row[] {
    const v = at(body, dotted);
    assert.ok(Array.isArray(v), `${what} : tableau « ${dotted} » attendu, reçu ${JSON.stringify(v)} dans ${JSON.stringify(body).slice(0, 800)}`);
    return v as Row[];
}

export function findItem(list: Row[], key: string, value: unknown, what: string): Row {
    const hit = list.find((x) => x[key] === value);
    assert.ok(hit, `${what} : élément ${key} = ${JSON.stringify(value)} absent de ${JSON.stringify(list).slice(0, 800)}`);
    return hit;
}

/** Date ISO d'un champ ; échec explicite si illisible. */
export function dateOf(v: unknown, what: string): Date {
    const d = new Date(String(v));
    assert.ok(typeof v === 'string' && !Number.isNaN(d.getTime()), `${what} : date ISO attendue, reçu ${JSON.stringify(v)}`);
    return d;
}

// ── Lectures brutes (vérité en base) ───────────────────────────────────────

export async function eventScans(eventId: string): Promise<Row[]> {
    const { data, error } = await service.from('ticket_scans').select('*').eq('event_id', eventId).order('created_at');
    assert.equal(error, null, `ticket_scans de l'événement : ${error?.message}`);
    return (data ?? []) as Row[];
}

export async function eventTicketRows(eventId: string): Promise<Row[]> {
    const { data, error } = await service.from('tickets').select('*').eq('event_id', eventId).order('created_at');
    assert.equal(error, null, `billets de l'événement : ${error?.message}`);
    return (data ?? []) as Row[];
}

/** Règle des suites : une ligne non acceptée est un refus, sauf le cash_required historique consommé par un encaissement. */
export function isRefusal(scanRow: Row): boolean {
    if (scanRow.accepted === true) return false;
    return !(scanRow.result === 'cash_required' && scanRow.consumed_at !== null && scanRow.consumed_at !== undefined);
}

/** Début du quart d'heure (Africa/Dakar = UTC+0), en millisecondes. */
export function quarterStart(iso: unknown): number {
    const ms = new Date(String(iso)).getTime();
    return Math.floor(ms / 900_000) * 900_000;
}

/** Jour AAAA-MM-JJ à Dakar (UTC+0). */
export function dakarDay(iso: unknown): string {
    return new Date(String(iso)).toISOString().slice(0, 10);
}

/** Tentative journalisée sans billet (scan_log du lot 4), pour la vivacité et la sentinelle du Realtime ; renvoie l'empreinte. */
export async function logRefusedAttempt(eventId: string, scannerId: string): Promise<string> {
    const hash = randomBytes(32).toString('hex');
    const { error } = await service.rpc('scan_log', {
        p_ticket: null, p_event: eventId, p_scanner: scannerId, p_result: 'invalid', p_accepted: false,
        p_method: 'QR', p_identity: false, p_hash: hash, p_amount: null,
    });
    assert.equal(error, null, `journal d’une tentative : ${error?.message}`);
    return hash;
}

/**
 * Lot 9 (A16, L46, X5) : l'encaissement au scan est retiré, mais ses lignes restent en base sur les anciennes données et les
 * filtres du pilotage continuent de les lire. Ce jeu les reproduit donc telles que ticket_cash_checkin les laissait
 * (M/20261105000005_lot7_scan.sql:335-360), sur une connexion directe (rôle postgres) et en une transaction : scan
 * cash_required consommé, paiement ESPECES hors plateforme CASH_CHECKIN, billet UTILISE avec payment_id, commande créditée,
 * total attendu de la caisse crédité, scan valid accepté. Une vente au guichet ne convient pas : elle n'a pas de porteur
 * (pilotage-cloture-export attend ESP-a au nom de l'acheteur). Renvoie l'identifiant du paiement.
 */
async function legacyCashCheckin(eventId: string, scanner: Buyer, shiftId: string, ticketId: string): Promise<string> {
    const db = await openConcurrentClient({ applicationName: 'ev-test-pilotage-historique' });
    try {
        const { rows: [t] } = await db.query<{ price: string; security_version: number; order_id: string; user_id: string }>(
            'SELECT price, security_version, order_id, user_id FROM public.tickets WHERE id = $1 FOR UPDATE', [ticketId]);
        assert.ok(t, `billet à encaisser ${ticketId} introuvable`);
        assert.ok(t.order_id, 'billet à encaisser : commande impayée attendue (order_id)');
        const amount = Number(t.price);
        const hash = randomBytes(32).toString('hex');
        const required = await db.query<{ id: string }>(
            `INSERT INTO public.ticket_scans (ticket_id, event_id, scanner_id, result, accepted, method, identity_verified, payload_hash,
                                              amount_due, secret_version, consumed_at, created_at)
             VALUES ($1, $2, $3, 'cash_required', FALSE, 'QR', FALSE, $4, $5, $6, now(), now() - interval '1 second')
             RETURNING id`, [ticketId, eventId, scanner.userId, hash, amount, t.security_version]);
        const scanId = required.rows[0].id;
        const payment = await db.query<{ id: string }>(
            `INSERT INTO public.payments (transaction_id, client_id, partner_id, order_id, ticket_id, event_id, payment_target, amount, currency,
                                          payment_method, is_platform_payment, offline_payment_method, aggregator, facial_amount,
                                          aggregator_fee, service_fee, gross_event_village_revenue, net_event_village_revenue,
                                          partner_payout_amount, status, paid_at, shift_id, metadata)
             VALUES ('TX-CASH-' || upper(replace(gen_random_uuid()::text, '-', '')), $1, (SELECT partner_id FROM public.events WHERE id = $4::uuid), $2, $3, $4, 'TICKET',
                     $5, 'XOF', 'ESPECES', FALSE, 'ESPECES', NULL, $5, 0, 0, 0, 0, 0, 'SUCCESS', now(), $6,
                     jsonb_build_object('source', 'CASH_CHECKIN', 'scan_id', $7::text))
             RETURNING id`, [t.user_id, t.order_id, ticketId, eventId, amount, shiftId, scanId]);
        const paymentId = payment.rows[0].id;
        const ticket = await db.query(
            `UPDATE public.tickets
                SET payment_id = $1, status = 'UTILISE', checked_in_at = now(), checked_in_by = $2, updated_at = now()
              WHERE id = $3 AND status = 'VALIDE'`, [paymentId, scanner.userId, ticketId]);
        assert.equal(ticket.rowCount, 1, 'billet encaissé puis composté');
        const order = await db.query(
            `UPDATE public.orders
                SET paid_amount = paid_amount + $1::numeric,
                    balance_amount = GREATEST(total_amount - (paid_amount + $1::numeric), 0),
                    payment_status = CASE WHEN NOT EXISTS (
                            SELECT 1 FROM public.tickets x WHERE x.order_id = $2::uuid AND x.payment_id IS NULL AND x.id <> $3::uuid)
                        THEN 'SUCCESS'::payment_status_enum ELSE 'PARTIAL'::payment_status_enum END,
                    updated_at = now()
              WHERE id = $2::uuid`, [amount, t.order_id, ticketId]);
        assert.equal(order.rowCount, 1, 'commande créditée');
        const shift = await db.query(
            `UPDATE public.controller_shifts SET expected_cash_total = expected_cash_total + $1::numeric, updated_at = now()
              WHERE id = $2 AND status = 'OUVERT'`, [amount, shiftId]);
        assert.equal(shift.rowCount, 1, 'caisse OUVERT créditée');
        await db.query(
            `INSERT INTO public.ticket_scans (ticket_id, event_id, scanner_id, result, accepted, method, identity_verified, payload_hash,
                                              shift_id, amount_due, secret_version)
             VALUES ($1, $2, $3, 'valid', TRUE, 'QR', FALSE, $4, $5, $6, $7)`,
            [ticketId, eventId, scanner.userId, hash, shiftId, amount, t.security_version]);
        await db.commit();
        return paymentId;
    } finally {
        await db.close();
    }
}

// ── Construction du jeu ────────────────────────────────────────────────────

export async function buildKnownDataset(label: string): Promise<KnownDataset> {
    const partner = await newPartner(`pil-${label}`);
    const event = await createEventInStatus(partner, `pilotage-${label}`, CATEGORY_SPECS, 'PUBLIE', { startsInHours: 2, durationHours: 4 });
    const eventId = event.eventId;
    const categoryIds: Record<string, string> = {};
    for (const [name, c] of Object.entries(event.categories)) categoryIds[name] = c.id;

    const { data: evRow, error: evErr } = await service.from('events').select('end_date, end_time').eq('id', eventId).single();
    assert.equal(evErr, null, `dates de l'événement : ${evErr?.message}`);
    const originalEnd = new Date(`${evRow.end_date}T${String(evRow.end_time).slice(0, 8)}Z`);
    assert.ok(!Number.isNaN(originalEnd.getTime()), `fin de l'événement lisible : ${JSON.stringify(evRow)}`);

    // Équipe
    const c1 = await namedController(partner, eventId, true, `${label}-c1`, 'Ibrahima', 'Ndiaye');
    const c2 = await namedController(partner, eventId, true, `${label}-c2`, 'Fatou', 'Sarr');
    const c4 = await namedController(partner, eventId, false, `${label}-c4`, 'Aissatou', 'Kane');
    const c3 = await namedController(partner, null, false, `${label}-c3`, 'Lamine', 'Diallo');
    const assignments = {
        c1: await setEntryPoint(eventId, c1.userId, ENTRY_POINTS.c1),
        c2: await setEntryPoint(eventId, c2.userId, ENTRY_POINTS.c2),
        c4: await setEntryPoint(eventId, c4.userId, ENTRY_POINTS.c4),
    };

    // PIN régisseur, avant toute caisse ouverte (sinon 409 OPEN_SHIFTS, lot 4)
    const pinRes = await regisseurPin(partner, eventId, { confirm: true });
    assert.equal(pinRes.status, 200, `génération du PIN régisseur : ${show(pinRes)}`);
    const regisseurPinValue = String(pinRes.body.pin);

    // Acheteurs
    const buyers = {
        b1: await newBuyer(`pil-${label}-b1`, { firstName: 'Awa', lastName: 'Diop' }),
        b2: await newBuyer(`pil-${label}-b2`, { firstName: 'Moussa', lastName: 'Fall' }),
        b3: await newBuyer(`pil-${label}-b3`, { firstName: 'Khady', lastName: 'Sow' }),
        b4: await newBuyer(`pil-${label}-b4`, { firstName: 'Cheikh', lastName: 'Gueye' }),
        b5: await newBuyer(`pil-${label}-b5`, { firstName: 'Ndeye', lastName: 'Faye' }),
        b6: await newBuyer(`pil-${label}-b6`, { firstName: 'Ousmane', lastName: 'Ba' }),
        invitee: await newBuyer(`pil-${label}-inv`, { firstName: 'Mariama', lastName: 'Cisse' }),
    };

    // Ventes en ligne confirmées, puis remboursement du billet de P4 (réglages fixés le temps des ventes)
    const online = await withSettings({
        'finance.payout_hold_enabled': true,
        'finance.payout_delay_hours': PAYOUT_DELAY_HOURS,
        'finance.cancellation_aggregator_fee_bearer': 'EVENT_VILLAGE',
    }, async () => {
        const p1: Purchase = await buyConfirmed(buyers.b1, event, [[STANDARD, 2]]);
        const p2: Purchase = await buyConfirmed(buyers.b2, event, [[VIP, 1]]);
        const p3: Purchase = await buyConfirmed(buyers.b3, event, [[ETUDIANT, 2]]);
        const p4: Purchase = await buyConfirmed(buyers.b4, event, [[STANDARD, 1]]);
        for (const [p, n, what] of [[p1, 2, 'P1'], [p2, 1, 'P2'], [p3, 2, 'P3'], [p4, 1, 'P4']] as Array<[Purchase, number, string]>) {
            assert.equal(p.tickets.length, n, `${what} : ${n} billet(s) émis (reçu ${p.tickets.length})`);
        }
        const refundTicket = String(p4.tickets[0].id);
        const { data, error } = await service.rpc('ticket_refund_request', {
            p_ticket_id: refundTicket, p_actor: partner.userId, p_reason: 'Remboursement du jeu de pilotage (lot 5)',
        });
        assert.equal(error, null, `ticket_refund_request : ${error?.message}`);
        const r = data as { ok?: boolean; mode?: string; cashout_id?: string } | null;
        assert.equal(r?.ok, true, `remboursement du billet de P4 refusé : ${JSON.stringify(data)}`);
        assert.equal(r?.mode, 'CASHOUT', `remboursement en ligne par cashout : ${JSON.stringify(data)}`);
        await CashoutService.send(String(r?.cashout_id));
        assert.equal((await ticketRow(refundTicket)).status, 'REMBOURSE', 'billet de P4 remboursé (versement confirmé)');
        return { p1, p2, p3, p4 };
    });

    // Panier en cours de paiement : réservation ACTIVE, aucun webhook
    const pending = await checkout(buyers.b5, cart(eventId, [[categoryIds[STANDARD], 3]], buyers.b5));
    assert.equal(pending.status, 200, `panier en cours de paiement : HTTP ${pending.status} ${JSON.stringify(pending.body)}`);
    assert.ok(pending.payment, `panier en cours de paiement : paiement créé ${JSON.stringify(pending.body)}`);
    assert.equal(pending.payment.status, 'PENDING', `panier en cours de paiement : paiement PENDING (${pending.payment.status})`);

    // Invitation : billet VIP à 0 F, canal INVITATION (contrat C7), stock vendu + 1
    const { data: inv, error: invErr } = await service.from('tickets').insert({
        event_id: eventId, category_id: categoryIds[VIP], user_id: buyers.invitee.userId, price: 0, status: 'VALIDE',
        sale_channel: 'INVITATION',
        ticket_number: `TCK-PIL-INV-${randomBytes(5).toString('hex').toUpperCase()}`,
        qr_code: `EV-QR-${randomUUID().replace(/-/g, '')}`,
    }).select('id').single();
    assert.equal(invErr, null, `invitation (tickets.sale_channel = INVITATION, contrat C7) : ${invErr?.message}`);
    const { data: vipCat, error: vipErr } = await service.from('ticket_categories').select('sold_quantity').eq('id', categoryIds[VIP]).single();
    assert.equal(vipErr, null, `stock VIP : ${vipErr?.message}`);
    const { error: vipUpErr } = await service.from('ticket_categories').update({ sold_quantity: Number(vipCat.sold_quantity) + 1 }).eq('id', categoryIds[VIP]);
    assert.equal(vipUpErr, null, `stock VIP de l'invitation : ${vipUpErr?.message}`);

    // Commande « à régler sur place » de 2 billets Standard
    const cashOrder = await createCashOrderTickets(buyers.b6, partner, event, STANDARD, 2);
    assert.equal(cashOrder.ticketIds.length, 2, 'commande à régler sur place : 2 billets');

    // Caisses
    const s1 = await openCashShift(c1, eventId, S1_OPENING_FLOAT);
    const s2 = await openCashShift(c2, eventId, 0);

    // Scans
    const p1a = String(online.p1.tickets[0].id);
    const p1b = String(online.p1.tickets[1].id);
    const p2 = String(online.p2.tickets[0].id);
    const p3a = String(online.p3.tickets[0].id);
    const p3b = String(online.p3.tickets[1].id);
    await scanExpect(c1, eventId, p1a, 'valid', 'C1 composte P1-a');
    await scanExpect(c1, eventId, p1a, 'already_used', 'C1 retente P1-a');
    await scanExpect(c2, eventId, p1a, 'already_used', 'C2 retente P1-a (3e tentative)');
    await scanExpect(c2, eventId, p2, 'valid', 'C2 composte P2');
    await scanExpect(c2, eventId, p3b, 'qr_expired', 'C2 présente P3-b avec un code de plus de 40 s', new Date(Date.now() - 60_000));
    await scanExpect(c3, eventId, p3a, 'forbidden', 'C3 non affecté tente P3-a');
    await scanExpect(c1, eventId, String(inv.id), 'valid', 'C1 composte l’invitation');

    // Encaissement au scan historique du premier billet (lot 9, A16), par C1 (caisse S1)
    const [cashPaid, cashUnpaid] = cashOrder.ticketIds;
    const cashCheckinPayment = await legacyCashCheckin(eventId, c1, s1, cashPaid);
    const cashTicket = await ticketRow(cashPaid);
    assert.equal(cashTicket.status, 'UTILISE', 'billet encaissé puis composté');
    assert.equal(String(cashTicket.payment_id), cashCheckinPayment, 'paiement historique rattaché au billet');

    // Ventes au guichet (contrat C7 : billets compostés dans la même transaction)
    const saleS1 = await counterSale(c1, eventId, [[categoryIds[ETUDIANT], 1]]);
    assert.equal(saleS1.status, 200, `vente au guichet sur S1 : ${show(saleS1)}`);
    assert.equal(saleS1.body.ok, true, `vente au guichet sur S1 : ${show(saleS1)}`);
    const saleS2 = await counterSale(c2, eventId, [[categoryIds[STANDARD], 2]]);
    assert.equal(saleS2.status, 200, `vente au guichet sur S2 : ${show(saleS2)}`);
    assert.equal(saleS2.body.ok, true, `vente au guichet sur S2 : ${show(saleS2)}`);
    const counterS1Ids = ((saleS1.body.ticket_ids as unknown[] | undefined) ?? []).map(String);
    const counterS2Ids = ((saleS2.body.ticket_ids as unknown[] | undefined) ?? []).map(String);
    assert.equal(counterS1Ids.length, 1, `vente au guichet sur S1 : 1 billet (${show(saleS1)})`);
    assert.equal(counterS2Ids.length, 2, `vente au guichet sur S2 : 2 billets (${show(saleS2)})`);

    // Incidents techniques (contrat C8), posés en base comme le serveur et l'appareil les déclarent
    const { error: incErr } = await service.from('scan_incidents').insert([
        { scanner_id: c1.userId, event_id: eventId, kind: 'NETWORK', source: 'DEVICE' },
        { scanner_id: c1.userId, event_id: eventId, kind: 'NETWORK', source: 'DEVICE' },
        { scanner_id: c2.userId, event_id: eventId, kind: 'TIMEOUT', source: 'DEVICE' },
        { scanner_id: c2.userId, event_id: eventId, kind: 'RATE_LIMITED', source: 'SERVER' },
    ]);
    assert.equal(incErr, null, `incidents de scan (table scan_incidents, contrat C8) : ${incErr?.message}`);

    // Clôture de S1 : 6 500 F déclarés hors fonds pour 7 000 F attendus, écart justifié, PIN régisseur
    const close = await closeShift(c1, { shiftId: s1, declaredCashTotal: S1_DECLARED, justification: S1_JUSTIFICATION, regisseurPin: regisseurPinValue });
    assert.equal(close.status, 200, `clôture de S1 avec écart justifié (contrat C2) : ${show(close)}`);

    const ds: KnownDataset = {
        label, partner, event, eventId, title: event.title, categoryIds, originalEnd,
        c1, c2, c3, c4, assignments, buyers,
        tickets: {
            p1a, p1b, p2, p3a, p3b, p4: String(online.p4.tickets[0].id), invitation: String(inv.id),
            cashPaid, cashUnpaid, counterS1: counterS1Ids[0], counterS2: counterS2Ids,
        },
        payments: {
            online: [online.p1, online.p2, online.p3].map((p) => String(p.payment.id)),
            refunded: String(online.p4.payment.id),
            pending: String(pending.payment.id),
            cashCheckin: cashCheckinPayment,
            counterS1: String(saleS1.body.payment_id),
            counterS2: String(saleS2.body.payment_id),
        },
        shifts: { s1, s2 },
        regisseurPin: regisseurPinValue,
    };
    await assertDatasetTruth(ds);
    return ds;
}

/**
 * Garde-fou du jeu : la base contient exactement le jeu décrit (requêtes brutes, sans agrégat du
 * pilotage). Une divergence entre la page et EXPECTED vient alors de la page.
 */
export async function assertDatasetTruth(ds: KnownDataset): Promise<void> {
    const what = `jeu de données « ${ds.label} »`;
    const tickets = await eventTicketRows(ds.eventId);
    const live = tickets.filter((t) => t.status === 'VALIDE' || t.status === 'UTILISE');
    assert.equal(live.filter((t) => t.sale_channel !== 'INVITATION').length, EXPECTED.tickets.sold, `${what} : billets vendus en base`);
    assert.equal(live.filter((t) => t.sale_channel === 'INVITATION').length, EXPECTED.tickets.invitations, `${what} : invitations en base`);
    assert.equal(tickets.filter((t) => t.status === 'UTILISE').length, EXPECTED.entries.total, `${what} : billets UTILISE en base`);
    assert.equal(tickets.filter((t) => t.status === 'REMBOURSE').length, 1, `${what} : un billet remboursé`);
    for (const id of [...ds.tickets.counterS2, ds.tickets.counterS1]) {
        const t = tickets.find((x) => x.id === id);
        assert.equal(t?.status, 'UTILISE', `${what} : billet vendu au guichet composté immédiatement (contrat C7)`);
        assert.equal(t?.sale_channel, 'COUNTER', `${what} : canal COUNTER du billet vendu au guichet`);
    }
    const scans = await eventScans(ds.eventId);
    const accepted = scans.filter((s) => s.accepted === true);
    assert.equal(accepted.length, EXPECTED.entries.total, `${what} : scans acceptés en base`);
    assert.equal(accepted.filter((s) => s.method === 'COUNTER').length, EXPECTED.entries.counter, `${what} : scans acceptés au guichet`);
    assert.equal(scans.filter(isRefusal).length, EXPECTED.entries.refused, `${what} : refus en base`);

    const { data: cats, error: catErr } = await service.from('ticket_categories').select('name, held_quantity, sold_quantity, total_quantity, is_active').eq('event_id', ds.eventId);
    assert.equal(catErr, null, `${what} : catégories : ${catErr?.message}`);
    const byName = new Map((cats ?? []).map((c) => [String(c.name), c]));
    assert.equal(Number(byName.get(STANDARD)?.held_quantity), EXPECTED.tickets.in_payment, `${what} : places Standard réservées par le panier en cours`);
    for (const name of [STANDARD, VIP, ETUDIANT]) {
        const c = byName.get(name);
        assert.equal(Number(c?.total_quantity) - Number(c?.sold_quantity) - Number(c?.held_quantity), EXPECTED.byCategory[name].remaining,
            `${what} : stock vendable en base de ${name} (total − sold_quantity − held_quantity)`);
    }

    const { data: pays, error: payErr } = await service.from('payments').select('amount, status, is_platform_payment').eq('event_id', ds.eventId);
    assert.equal(payErr, null, `${what} : paiements : ${payErr?.message}`);
    const cash = (pays ?? []).filter((p) => p.is_platform_payment === false && p.status === 'SUCCESS').reduce((s, p) => s + Number(p.amount), 0);
    assert.equal(cash, EXPECTED.revenue.cash, `${what} : paiements hors plateforme SUCCESS en base`);

    const { data: ledger, error: ledErr } = await service.from('finance_ledger').select('entry_type, amount')
        .eq('event_id', ds.eventId).eq('account_kind', 'ORGANISATEUR');
    assert.equal(ledErr, null, `${what} : grand livre : ${ledErr?.message}`);
    const sum = (type: string) => (ledger ?? []).filter((l) => l.entry_type === type).reduce((s, l) => s + Number(l.amount), 0);
    assert.equal(sum('VENTE'), EXPECTED.revenue.online + EXPECTED.revenue.refunded, `${what} : écritures VENTE en base`);
    assert.equal(sum('REMBOURSEMENT'), -EXPECTED.revenue.refunded, `${what} : écritures REMBOURSEMENT en base`);

    const { data: shifts, error: shErr } = await service.from('controller_shifts').select('id, status, expected_cash_total, declared_cash_total').eq('event_id', ds.eventId);
    assert.equal(shErr, null, `${what} : caisses : ${shErr?.message}`);
    const s1 = (shifts ?? []).find((s) => s.id === ds.shifts.s1);
    const s2 = (shifts ?? []).find((s) => s.id === ds.shifts.s2);
    assert.equal(s1?.status, 'CLOTURE', `${what} : S1 clôturée`);
    assert.equal(Number(s1?.expected_cash_total), EXPECTED.shifts.s1.cash_collected, `${what} : total attendu de S1`);
    assert.equal(Number(s1?.declared_cash_total), S1_DECLARED, `${what} : déclaré de S1`);
    assert.equal(s2?.status, 'OUVERT', `${what} : S2 ouverte`);
    assert.equal(Number(s2?.expected_cash_total), EXPECTED.shifts.s2.cash_collected, `${what} : total attendu de S2`);
}
