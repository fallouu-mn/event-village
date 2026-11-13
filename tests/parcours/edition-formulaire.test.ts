/**
 * Lot 5, tâche 5.5 — création et édition d'un événement (constats R29, events-cdc-3, -4, -12, -15,
 * partner-ux-3, -10, ticketing-finance-11). Contrat : sections F2, F3 et F6 de la conception du lot 5,
 * précisions de la section U.
 *  - création : POST /api/partner/events → RPC event_create(p) : l'événement et ses catégories dans une
 *    seule transaction, au statut BROUILLON (ligne d'historique NULL → BROUILLON, canal CREATION) ; tout ou
 *    rien ; statut, slug, partenaire et clés inconnues refusés (400) ;
 *  - édition : PUT /api/partner/events/[id] → RPC event_update(p) { event_id, actor_id, patch,
 *    expected_updated_at } : verrou, EDIT_CONFLICT (409) si expected_updated_at est périmé ; propriétaire
 *    seul (admin : 403 ADMIN_CANNOT_EDIT) ; BROUILLON libre ; EN_ATTENTE → 409 WITHDRAW_TO_EDIT ; VALIDE,
 *    PUBLIE et SUSPENDU : champs libres (description, programme, infos pratiques hors adresse, affiche,
 *    coordonnées), champs notifiés (titre, dates et heures, lieu, ville, adresse), champs verrouillés dès
 *    qu'il y a des ventes (catégorie d'événement ; jauge supprimée ou sous vendus + réservés :
 *    LOCKED_AFTER_SALES et le champ en cause) ; TERMINE et ANNULE → 409 EVENT_LOCKED ; status, services,
 *    gallery_urls, ticket_categories, slug, partner_id, is_featured → 400 FIELD_NOT_EDITABLE partout ;
 *  - champ notifié qui change : une ligne SMS EVENT_CHANGED de la boîte d'envoi par porteur (billets
 *    VALIDE ; lot 6 : la file du lot 5 est absorbée), une notification dans l'application au passage de
 *    l'envoyeur, un SMS en file pour les dates, les heures et le lieu (titre seul : ligne SKIPPED
 *    TITLE_ONLY), envoyé par l'envoyeur unique ; réponse
 *    { notified_holders, sms_queued } ; une valeur renvoyée à l'identique n'est pas un changement (heure
 *    « HH:mm » du formulaire contre « HH:mm:ss » en base, R29) ;
 *  - fonds : report de la fin après des ventes → available_at des crédits VENTE recalculé dans la même
 *    transaction, jamais avancé ; avancement sous une fin de vente → 409 SALE_END_AFTER_EVENT avec la liste
 *    des catégories concernées ;
 *  - formulaire unique components/events/EventForm.tsx, rendu par la création et par l'édition (F6).
 * Formes choisies ici, le contrat étant muet (signalées au rapport) :
 *  - corps du PUT : { patch: { <colonnes> }, expected_updated_at: <events.updated_at relu> }, mêmes noms
 *    que la RPC ; réponse 200 : { success: true, event, notified_holders, sms_queued } ;
 *  - réponse 201 du POST : { success: true, event: { id, … } } (forme actuelle conservée) ;
 *  - refus : { error: <message français>, code, field?, fields? } ; fields : [{ path, code?, message }]
 *    (chemin pointé, « ticket_categories.0.price ») ou { chemin: message } ; LOCKED_AFTER_SALES et doublon de
 *    nom : HTTP 400 ou 409 (contrat muet sur le statut) ;
 *  - boîte d'envoi (lot 6) : lignes EVENT_CHANGED, canal SMS, event_id et recipient_user_id (porteur) ;
 *    notification dans l'application (après passage de l'envoyeur) :
 *    ligne notifications du porteur dont metadata cite l'événement ;
 *  - SALE_END_AFTER_EVENT : liste dans body.categories (identifiants, ou objets { id, name }) ;
 *  - envoi (lot 6) : dispatchNotifications à midi (Dakar) le lendemain, hors plage de silence ; l'ancien
 *    cron de la file du lot 5 est supprimé.
 * Rouge avant correctif :
 *  - préparation : event_transition et event_cancel n'existent pas (cycle-helpers.ts, advanceEventTo) pour
 *    tout événement au-delà de BROUILLON ;
 *  - POST : catégories insérées après l'événement, rattrapage par DELETE (lib/events/event.service.ts:155-177),
 *    aucun contrôle de doublon ; statut et clés inconnues ignorés (service:120-146 ;
 *    app/api/partner/events/route.ts:49-50) ; aucun historique (event_status_history absente) ;
 *  - PUT : corps passé brut au service (app/api/partner/events/[id]/route.ts:53-66) ; en PUBLIE, toute clé
 *    hors liste blanche, dont patch, est refusée par un message sans code (service:262-277) ; ailleurs, les
 *    clés non reconnues sont ignorées et la réponse est un succès (service:280-316) ; EN_ATTENTE éditable
 *    (service:257) ; TERMINE et ANNULE : 400 avec l'enum brut (service:257-259) ; admin : 400 « Profil
 *    partenaire introuvable » (service:74-87) ; aucun contrôle de version ; catégorie et jauge nulle
 *    acceptées après des ventes (service:262-266, :297, :322) ; notification : titre et fin non surveillés,
 *    faux positif d'heure (service:333-336), colonne users.full_name inexistante (service:383), ni file ni
 *    réponse chiffrée ; available_at figé à la vente (supabase/migrations/20261101000004_lot3_grand_livre.sql:288-293) ;
 *    aucune règle fin de vente / fin d'événement ;
 *  - formulaire : deux copies divergentes, chacune avec son schéma Zod (app/partner/events/new/page.tsx:55-91,
 *    app/partner/events/[id]/edit/page.tsx:39-57) ; components/events/EventForm.tsx absent.
 * La suite crée ses partenaires, son admin, ses acheteurs et ses événements.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { getFakes } from '../fakes';
import { routeContext } from './helpers';
import { cart, checkout, importModule, newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { dispatchAt, flushNotifications, noonDakarTomorrow } from './notif-helpers';
import { buyConfirmed, jsonRequest, newPartner, withSettings, type TestPartner } from './finance-helpers';
import {
    advanceEventTo, assertRpcOk, createDraftEvent, createEventInStatus, eventHistory, posterUrl, rpcTransition,
    type DraftEvent, type EventStatus,
} from './cycle-helpers';

const ROOT = process.cwd();
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const PRACTICAL = { address: 'Place de l’Obélisque, Dakar', accessNotes: 'Entrée par la porte A' };
const STANDARD: CategorySpec[] = [{ name: 'Standard', price: 5000, total: 20 }];

let partner: TestPartner;
let otherPartner: TestPartner;
let admin: Buyer;

before(async () => {
    partner = await newPartner('edition-form');
    otherPartner = await newPartner('edition-form-b');
    admin = await newAdmin('edition-form');
});

after(async () => {
    await assertLifecycleInvariants('edition-formulaire');
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

async function newAdmin(label: string): Promise<Buyer> {
    const user = await newBuyer(`admin-${label}`, { firstName: 'Aminata', lastName: 'Administratrice' });
    const { error } = await service.from('user_roles').upsert([{ user_id: user.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(error, null, `rôle ADMIN : ${error?.message}`);
    return user;
}

// Dates de Dakar (UTC+0 toute l'année)
function dakarDay(offsetDays: number): string {
    return new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

function dakarInstant(date: string, time: string): number {
    return Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}Z`);
}

/**
 * Brouillon du partenaire, dates posées au jour J+`day` de 20:00 à 23:30 (heures rondes, comme le formulaire),
 * infos pratiques avec adresse, puis avancé jusqu'à `target` par les RPC du contrat. Les dates initiales de
 * createDraftEvent sont un jour plus tard, pour qu'aucune fin de vente ne dépasse la fin à l'insertion.
 */
async function prepareEvent(label: string, categories: CategorySpec[], target: EventStatus, opts: { day?: number; capacity?: number | null } = {}): Promise<DraftEvent> {
    const day = opts.day ?? 5;
    const ev = await createDraftEvent(partner, label, categories, { capacity: opts.capacity, startsInHours: (day + 1) * 24 });
    const d = dakarDay(day);
    const { data, error } = await service.from('events')
        .update({ start_date: d, start_time: '20:00:00', end_date: d, end_time: '23:30:00', practical_info: PRACTICAL })
        .eq('id', ev.eventId).select('id');
    assert.equal(error, null, `dates de l'événement ${label} : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `dates de l'événement ${label} : aucune ligne modifiée`);
    if (target !== 'BROUILLON') await advanceEventTo(ev.eventId, target, { partnerUserId: partner.userId });
    return ev;
}

async function eventRow(eventId: string): Promise<Row> {
    const { data, error } = await service.from('events').select('*').eq('id', eventId).single();
    assert.equal(error, null, `événement ${eventId} : ${error?.message}`);
    return data as Row;
}

async function updatedAt(eventId: string): Promise<string> {
    return String((await eventRow(eventId)).updated_at);
}

async function putEvent(user: Buyer, eventId: string, patch: Row, expectedUpdatedAt?: string): Promise<RouteResult> {
    const put = await handlerOf('../../app/api/partner/events/[id]/route', 'PUT');
    const expected = expectedUpdatedAt ?? await updatedAt(eventId);
    return invoke(put, jsonRequest(`/api/partner/events/${eventId}`, 'PUT', user.accessToken, { patch, expected_updated_at: expected }), routeContext({ id: eventId }));
}

async function postEvent(user: Buyer, body: Row): Promise<RouteResult> {
    const post = await handlerOf('../../app/api/partner/events/route', 'POST');
    return invoke(post, jsonRequest('/api/partner/events', 'POST', user.accessToken, body));
}

/** Corps de création conforme au contrat F1 (début à J+10 20:00, Dakar). */
function createBody(label: string, overrides: Row = {}): Row {
    const d = dakarDay(10);
    return {
        // Lot 9 quater (D3 : AUD-26) : 13 chiffres d'affilée ressemblent à un numéro ; horodatage en base 36 (modification signalée)
        title: `TEST Édition ${label} ${Date.now().toString(36)}`,
        category: 'CONCERT',
        description: 'Concert de test du lot 5 (édition).',
        start_date: d,
        start_time: '20:00',
        end_date: d,
        end_time: '23:30',
        location: 'Grand Théâtre de Dakar',
        city: 'Dakar',
        latitude: 14.6937,
        longitude: -17.4441,
        image_url: posterUrl(partner.partnerId),
        capacity: 200,
        program: [{ id: randomUUID(), time: '20:00', kind: 'ARTISTE', title: 'Ouverture', participant: 'Orchestre de test' }],
        practical_info: { address: 'Boulevard de la République, Dakar', accessNotes: 'Entrée principale' },
        ticket_categories: [
            { name: 'Standard', price: 5000, total_quantity: 100, max_per_order: 6, sale_end: `${d}T19:00`, is_visible: true },
            { name: 'VIP', description: 'Accès au carré VIP', price: 15000, total_quantity: 20, max_per_order: 2, is_visible: false },
        ],
        ...overrides,
    };
}

async function eventsTitled(title: string): Promise<Row[]> {
    const { data, error } = await service.from('events').select('id, status').eq('title', title);
    assert.equal(error, null, `événements « ${title} » : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function categoriesOf(eventId: string): Promise<Row[]> {
    const { data, error } = await service.from('ticket_categories').select('*').eq('event_id', eventId).order('name');
    assert.equal(error, null, `catégories de l'événement ${eventId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

interface Sale { buyer: Buyer; paymentId: string; ticketIds: string[] }

/** Vente réelle : acheteur neuf, checkout, succès SamirPay, webhook (billets VALIDE). */
async function sell(ev: DraftEvent, category: string, quantity = 1): Promise<Sale> {
    const buyer = await newBuyer('ed-form-ach');
    const p = await buyConfirmed(buyer, ev, [[category, quantity]]);
    assert.equal(p.tickets.length, quantity, `vente de ${quantity} billet(s) ${category} : ${p.tickets.length} émis`);
    return { buyer, paymentId: String(p.payment.id), ticketIds: p.tickets.map((t) => String(t.id)) };
}

/** Paiement en cours : réservation ACTIVE de `quantity` billets (held_quantity), sans billet. */
async function hold(ev: DraftEvent, category: string, quantity: number): Promise<void> {
    const buyer = await newBuyer('ed-form-res');
    const catId = ev.categories[category].id;
    const res = await checkout(buyer, cart(ev.eventId, [[catId, quantity]], buyer));
    assert.equal(res.status, 200, `paiement en cours (${quantity} ${category}) : HTTP ${res.status} ${JSON.stringify(res.body)}`);
    assert.ok(res.payment, 'paiement en cours créé');
    const { data, error } = await service.from('stock_reservations').select('quantity, status').eq('payment_id', res.payment.id).eq('category_id', catId);
    assert.equal(error, null, `réservation : ${error?.message}`);
    assert.deepEqual((data ?? []).map((r) => [Number(r.quantity), r.status]), [[quantity, 'ACTIVE']], 'réservation ACTIVE du paiement en cours');
}

async function notificationIds(userId: string): Promise<Set<string>> {
    const { data, error } = await service.from('notifications').select('id').eq('user_id', userId);
    assert.equal(error, null, `notifications de ${userId} : ${error?.message}`);
    return new Set((data ?? []).map((r) => String(r.id)));
}

/** Notifications du porteur créées depuis `seen` et rattachées à l'événement (metadata). */
async function newEventNotifications(userId: string, eventId: string, seen: Set<string>): Promise<Row[]> {
    const { data, error } = await service.from('notifications').select('id, title, content, channel, metadata').eq('user_id', userId);
    assert.equal(error, null, `notifications de ${userId} : ${error?.message}`);
    return ((data ?? []) as Row[]).filter((n) => !seen.has(String(n.id)) && JSON.stringify(n.metadata ?? {}).includes(eventId));
}

/**
 * Lot 6 (contrat J1.9, T) : la file du lot 5 est absorbée par la boîte d'envoi. Lignes SMS EVENT_CHANGED de
 * l'événement, une par porteur ; `user_id` = destinataire (recipient_user_id).
 */
async function changeRows(eventId: string): Promise<Row[]> {
    const { data, error } = await service.from('notification_outbox').select('*')
        .eq('event_id', eventId).eq('type', 'EVENT_CHANGED').eq('channel', 'SMS');
    assert.equal(error, null, `boîte d'envoi (EVENT_CHANGED, SMS) de ${eventId} : ${error?.message} (code ${error?.code})`);
    return ((data ?? []) as Row[]).map((r) => ({ ...r, user_id: r.recipient_user_id }));
}

/** Lot 6 (T) : l'in-app est écrite par l'envoyeur ; passage restreint à l'événement (vider → photographier → agir → vider). */
async function flushEvent(eventId: string): Promise<void> {
    await flushNotifications({ eventIds: [eventId] });
}

async function saleCredit(paymentId: string): Promise<Row> {
    const { data, error } = await service.from('finance_ledger').select('*').eq('payment_id', paymentId).eq('entry_type', 'VENTE');
    assert.equal(error, null, `crédit VENTE du paiement ${paymentId} : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `une écriture VENTE pour le paiement ${paymentId} : ${JSON.stringify(data)}`);
    return (data as Row[])[0];
}

function hhmm(t: unknown): string | null {
    return typeof t === 'string' && t.length >= 5 ? t.slice(0, 5) : null;
}

/** Envoi complet du formulaire d'édition (F6) : toutes les valeurs relues, heures au format HH:mm. */
function formPatch(row: Row, overrides: Row = {}): Row {
    return {
        title: row.title,
        category: row.category,
        description: row.description,
        start_date: row.start_date,
        start_time: hhmm(row.start_time),
        end_date: row.end_date ?? null,
        end_time: hhmm(row.end_time),
        location: row.location,
        city: row.city,
        image_url: row.image_url,
        capacity: row.capacity,
        program: Array.isArray(row.program) ? row.program : [],
        practical_info: row.practical_info,
        ...overrides,
    };
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

/** Champs en cause d'un refus : body.field, puis body.fields (tableau de chemins ou d'objets { path }, ou objet { chemin: message }). */
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

function assertRefused(res: RouteResult, label: string, code: string, statuses: number[]): void {
    assert.ok(statuses.includes(res.status), `${label} : HTTP ${statuses.join(' ou ')} attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
    assert.equal(res.body.code, code, `${label} : code ${code} attendu : ${JSON.stringify(res.body)}`);
    assertFrenchError(res.body, label);
}

function assertOk(res: RouteResult, label: string): void {
    assert.equal(res.status, 200, `${label} : HTTP 200 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
}

function assertNotified(res: RouteResult, label: string, holders: number, sms: number): void {
    assert.equal(res.body.notified_holders, holders, `${label} : notified_holders = ${holders} attendu : ${JSON.stringify(res.body)}`);
    assert.equal(res.body.sms_queued, sms, `${label} : sms_queued = ${sms} attendu : ${JSON.stringify(res.body)}`);
}

/** Source sans commentaires (blocs, JSX et lignes ; les URL « https:// » sont conservées), lignes préservées. */
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

/** Modules locaux importés par un fichier (components/, hooks/, lib/ hors schéma), pour suivre un formulaire découpé. */
function componentImports(file: string, src: string): string[] {
    const out: string[] = [];
    for (const m of Array.from(src.matchAll(/from\s+['"]((?:@\/|\.{1,2}\/)[^'"]+)['"]/g))) {
        const spec = m[1];
        const base = spec.startsWith('@/') ? path.join(ROOT, spec.slice(2)) : path.resolve(path.dirname(path.join(ROOT, file)), spec);
        for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
            const candidate = base + ext;
            if (fs.existsSync(candidate)) {
                const rel = path.relative(ROOT, candidate).replace(/\\/g, '/');
                if (/^(components|hooks|lib)\//.test(rel) && !rel.startsWith('lib/validations/')) out.push(rel);
                break;
            }
        }
    }
    return out;
}

// ── Création ───────────────────────────────────────────────────────────────

describe('5.5 — création : POST /api/partner/events (event_create)', () => {
    test('événement BROUILLON et ses catégories créés ensemble, champs appliqués, historique NULL → BROUILLON (CREATION)', async () => {
        const body = createBody('creation');
        const res = await postEvent(partner, body);
        assert.equal(res.status, 201, `création : HTTP 201 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
        const created = res.body.event as Row | undefined;
        assert.equal(typeof created?.id, 'string', `réponse { success, event: { id } } attendue : ${JSON.stringify(res.body)}`);
        const eventId = String(created!.id);

        const row = await eventRow(eventId);
        assert.equal(row.status, 'BROUILLON', 'statut BROUILLON à la création');
        assert.equal(row.partner_id, partner.partnerId, 'partenaire dérivé de la session');
        assert.equal(row.title, body.title, 'titre');
        assert.equal(row.category, 'CONCERT', 'catégorie d’événement');
        assert.equal(Number(row.capacity), 200, 'jauge');
        assert.equal(row.image_url, body.image_url, 'affiche');
        assert.equal(Number(row.latitude), 14.6937, 'latitude (carte)');
        assert.equal(Number(row.longitude), -17.4441, 'longitude (carte)');

        const cats = await categoriesOf(eventId);
        assert.deepEqual(
            cats.map((c) => [c.name, Number(c.price), Number(c.total_quantity), Number(c.max_per_order), c.is_visible, c.is_active]),
            [['Standard', 5000, 100, 6, true, true], ['VIP', 15000, 20, 2, false, true]],
            `catégories créées avec tous leurs champs : ${JSON.stringify(cats)}`);
        assert.equal(Date.parse(String(cats[0].sale_end)), dakarInstant(String(body.start_date), '19:00'), 'fin de vente saisie en heure de Dakar');

        const hist = await eventHistory(eventId);
        assert.deepEqual(hist.map((h) => [h.old_status, h.new_status, h.channel]), [[null, 'BROUILLON', 'CREATION']],
            `une ligne d'historique NULL → BROUILLON (CREATION) : ${JSON.stringify(hist)}`);
    });

    test('tout ou rien : deux catégories au même nom (casse différente) → refus, ni événement ni catégorie créés', async () => {
        const body = createBody('doublon', {
            ticket_categories: [
                { name: 'Standard', price: 5000, total_quantity: 50, max_per_order: 6 },
                { name: 'standard', price: 6000, total_quantity: 50, max_per_order: 6 },
            ],
        });
        const res = await postEvent(partner, body);
        assert.ok([400, 409].includes(res.status), `doublon de nom : HTTP 400 ou 409 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
        assert.equal(typeof res.body.code, 'string', `doublon de nom : code attendu : ${JSON.stringify(res.body)}`);
        assertFrenchError(res.body, 'doublon de nom');
        assert.deepEqual(await eventsTitled(String(body.title)), [], 'aucun événement créé (une seule transaction)');
    });

    test('statut, slug, partenaire ou clé inconnue dans le corps → 400 avec le champ refusé, aucun événement créé', async () => {
        for (const [key, value] of [
            ['status', 'PUBLIE'],
            ['slug', 'evenement-impose'],
            ['partner_id', otherPartner.partnerId],
            ['champ_inconnu', 'valeur'],
        ] as Array<[string, unknown]>) {
            const body = createBody(`cle-${key}`, { [key]: value });
            const res = await postEvent(partner, body);
            assert.equal(res.status, 400, `${key} en entrée : HTTP 400 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
            assert.equal(typeof res.body.code, 'string', `${key} en entrée : code attendu : ${JSON.stringify(res.body)}`);
            assert.ok(reportedFields(res.body).includes(key), `${key} en entrée : champ refusé listé : ${JSON.stringify(res.body)}`);
            assertFrenchError(res.body, `${key} en entrée`);
            assert.deepEqual(await eventsTitled(String(body.title)), [], `${key} en entrée : aucun événement créé`);
        }
    });

    test('compte sans rôle partenaire → 403, aucun événement (garde-fou)', async () => {
        const client = await newBuyer('ed-form-client');
        const body = createBody('client');
        const res = await postEvent(client, body);
        assert.equal(res.status, 403, `client : HTTP 403 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
        assert.deepEqual(await eventsTitled(String(body.title)), [], 'client : aucun événement créé');
    });

    test('statique : la création passe par event_create ; plus d’insertion directe des catégories ni de rattrapage par suppression', () => {
        const route = code('app/api/partner/events/route.ts');
        const svc = code('lib/events/event.service.ts');
        assert.match(route + svc, /\b(?:rpc|rpcWithRetry)(?:<[^>]*>)?\(\s*['"]event_create['"]/, 'POST /api/partner/events (ou EventService) appelle la RPC event_create');
        assert.doesNotMatch(svc, /from\(\s*['"]ticket_categories['"]\s*\)\s*\.insert\(/,
            'lib/events/event.service.ts : plus d’insertion directe dans ticket_categories (event_create, ticket_category_create)');
        assert.doesNotMatch(route + svc, /from\(\s*['"]events['"]\s*\)\s*\.insert\(/, 'plus d’insertion directe dans events hors RPC');
    });
});

// ── Édition ────────────────────────────────────────────────────────────────

describe('5.5 — édition : PUT /api/partner/events/[id] (event_update)', () => {
    test('R29 — PUBLIÉ avec une vente : l’ancien envoi (ticket_categories) est refusé en clair, le nouvel envoi du formulaire est appliqué', async () => {
        const ev = await prepareEvent('r29', STANDARD, 'PUBLIE');
        await sell(ev, 'Standard');
        const before = await eventRow(ev.eventId);

        const legacy = await putEvent(partner, ev.eventId, formPatch(before, {
            description: 'Description de l’ancien formulaire',
            ticket_categories: [{ id: ev.categories.Standard.id, name: 'Standard', price: 5000, total_quantity: 20, description: '' }],
        }));
        assertRefused(legacy, 'ancien envoi avec ticket_categories', 'FIELD_NOT_EDITABLE', [400]);
        assert.ok(reportedFields(legacy.body).includes('ticket_categories'), `champ en cause ticket_categories : ${JSON.stringify(legacy.body)}`);
        assert.deepEqual(await eventRow(ev.eventId), before, 'refus : rien n’est modifié');

        const res = await putEvent(partner, ev.eventId, formPatch(before, { description: 'Nouvelle description après publication (R29)' }));
        assertOk(res, 'nouvel envoi du formulaire sur un PUBLIÉ');
        const after = await eventRow(ev.eventId);
        assert.equal(after.description, 'Nouvelle description après publication (R29)', 'modification appliquée');
        assert.equal(after.status, 'PUBLIE', 'statut inchangé');
    });

    test('enregistrement sans changement réel (heure HH:mm contre HH:mm:ss en base, champs verrouillés renvoyés à l’identique) : aucun porteur notifié', async () => {
        const ev = await prepareEvent('sans-changement', STANDARD, 'PUBLIE');
        const sale = await sell(ev, 'Standard');
        const before = await eventRow(ev.eventId);
        assert.equal(before.start_time, '20:00:00', 'précondition : heure stockée au format HH:mm:ss');
        await flushEvent(ev.eventId);
        const seen = await notificationIds(sale.buyer.userId);

        const res = await putEvent(partner, ev.eventId, formPatch(before, { description: 'Correction de la description, rien d’autre' }));
        assertOk(res, 'enregistrement sans changement de champ notifié');
        assertNotified(res, 'enregistrement sans changement réel', 0, 0);
        await flushEvent(ev.eventId);
        assert.deepEqual(await changeRows(ev.eventId), [], 'aucune ligne de changement dans la boîte d’envoi');
        assert.deepEqual(await newEventNotifications(sale.buyer.userId, ev.eventId, seen), [], 'aucune notification au porteur');
        const after = await eventRow(ev.eventId);
        assert.equal(after.description, 'Correction de la description, rien d’autre', 'champ libre appliqué');
        assert.deepEqual([after.start_date, after.start_time, after.end_date, after.end_time, after.category, after.capacity],
            [before.start_date, before.start_time, before.end_date, before.end_time, before.category, before.capacity],
            'dates, catégorie et jauge inchangées');
    });

    test('changement de date d’un PUBLIÉ : une ligne SMS EVENT_CHANGED par porteur VALIDE, notification dans l’application, { notified_holders, sms_queued }', async () => {
        const ev = await prepareEvent('date', STANDARD, 'PUBLIE', { day: 6 });
        const a = await sell(ev, 'Standard', 2);
        const b = await sell(ev, 'Standard', 1);
        await flushEvent(ev.eventId);
        const seenA = await notificationIds(a.buyer.userId);
        const seenB = await notificationIds(b.buyer.userId);
        const seenPartner = await notificationIds(partner.userId);

        const newDay = dakarDay(7);
        const res = await putEvent(partner, ev.eventId, { start_date: newDay, end_date: newDay });
        assertOk(res, 'report d’un jour');
        const after = await eventRow(ev.eventId);
        assert.deepEqual([after.start_date, after.end_date], [newDay, newDay], 'dates appliquées');
        assertNotified(res, 'report d’un jour (3 billets, 2 porteurs)', 2, 2);

        const rows = await changeRows(ev.eventId);
        assert.ok(rows.every((r) => r.status === 'PENDING'), `SMS de changement en file : ${JSON.stringify(rows.map((r) => [r.status, r.reason]))}`);
        await flushEvent(ev.eventId);
        assert.deepEqual(rows.map((r) => String(r.user_id)).sort(), [a.buyer.userId, b.buyer.userId].sort(),
            `une ligne par porteur, dédoublonnée : ${JSON.stringify(rows)}`);
        for (const [label, holder, seen] of [['porteur de 2 billets', a.buyer, seenA], ['porteur d’un billet', b.buyer, seenB]] as Array<[string, Buyer, Set<string>]>) {
            const notes = await newEventNotifications(holder.userId, ev.eventId, seen);
            assert.ok(notes.length >= 1, `${label} : notification dans l’application créée au passage de l’envoyeur`);
        }
        assert.deepEqual(await newEventNotifications(partner.userId, ev.eventId, seenPartner), [], 'l’organisateur n’est pas notifié comme porteur');
    });

    test('changement de titre : notification dans l’application seulement, aucun SMS en file', async () => {
        const ev = await prepareEvent('titre', STANDARD, 'PUBLIE');
        const sale = await sell(ev, 'Standard');
        await flushEvent(ev.eventId);
        const seen = await notificationIds(sale.buyer.userId);
        const res = await putEvent(partner, ev.eventId, { title: `${ev.title} (nouveau titre)` });
        assertOk(res, 'changement de titre');
        assert.equal((await eventRow(ev.eventId)).title, `${ev.title} (nouveau titre)`, 'titre appliqué');
        assertNotified(res, 'changement de titre', 1, 0);
        const titleRows = await changeRows(ev.eventId);
        assert.deepEqual(titleRows.map((r) => String(r.user_id)), [sale.buyer.userId], 'une ligne pour le porteur');
        assert.deepEqual(titleRows.map((r) => [r.status, r.reason]), [['SKIPPED', 'TITLE_ONLY']], 'titre seul : aucun SMS, ligne SKIPPED TITLE_ONLY');
        await flushEvent(ev.eventId);
        assert.ok((await newEventNotifications(sale.buyer.userId, ev.eventId, seen)).length >= 1, 'notification dans l’application créée');
    });

    test('lieu et adresse : porteur notifié, SMS en file', async () => {
        const ev = await prepareEvent('lieu', STANDARD, 'PUBLIE');
        const sale = await sell(ev, 'Standard');
        const res = await putEvent(partner, ev.eventId, {
            location: 'Nouvelle salle de test, Dakar',
            practical_info: { ...PRACTICAL, address: 'Route de la Corniche Ouest, Dakar' },
        });
        assertOk(res, 'changement de lieu et d’adresse');
        const after = await eventRow(ev.eventId);
        assert.equal(after.location, 'Nouvelle salle de test, Dakar', 'lieu appliqué');
        assert.equal((after.practical_info as Row | null)?.address, 'Route de la Corniche Ouest, Dakar', 'adresse appliquée');
        assertNotified(res, 'changement de lieu', 1, 1);
        const placeRows = await changeRows(ev.eventId);
        assert.deepEqual(placeRows.map((r) => String(r.user_id)), [sale.buyer.userId], 'une ligne pour le porteur');
        assert.deepEqual(placeRows.map((r) => r.status), ['PENDING'], 'SMS de changement de lieu en file');
    });

    test('champs libres d’un PUBLIÉ (description, programme, infos pratiques hors adresse, affiche, coordonnées) : appliqués sans notification', async () => {
        const ev = await prepareEvent('libres', STANDARD, 'PUBLIE');
        const sale = await sell(ev, 'Standard');
        await flushEvent(ev.eventId);
        const seen = await notificationIds(sale.buyer.userId);
        const poster = posterUrl(partner.partnerId);
        const program = [
            { id: randomUUID(), time: '20:00', kind: 'ARTISTE', title: 'Première partie', participant: 'Groupe de test' },
            { id: randomUUID(), time: '21:30', kind: 'ACTIVITE', title: 'Entracte' },
        ];
        const res = await putEvent(partner, ev.eventId, {
            description: 'Programme détaillé publié',
            program,
            practical_info: { ...PRACTICAL, accessNotes: 'Entrée par la porte C', parking: 'Parking gratuit sur place' },
            image_url: poster,
            latitude: 14.7167,
            longitude: -17.4677,
        });
        assertOk(res, 'champs libres');
        assertNotified(res, 'champs libres', 0, 0);
        await flushEvent(ev.eventId);
        assert.deepEqual(await changeRows(ev.eventId), [], 'aucune ligne de changement dans la boîte d’envoi');
        assert.deepEqual(await newEventNotifications(sale.buyer.userId, ev.eventId, seen), [], 'aucune notification au porteur');
        const after = await eventRow(ev.eventId);
        assert.equal(after.description, 'Programme détaillé publié', 'description');
        assert.deepEqual((after.program as Row[] | null)?.map((p) => p.title), ['Première partie', 'Entracte'], 'programme');
        assert.equal((after.practical_info as Row | null)?.accessNotes, 'Entrée par la porte C', 'infos pratiques');
        assert.equal((after.practical_info as Row | null)?.address, PRACTICAL.address, 'adresse inchangée');
        assert.equal(after.image_url, poster, 'affiche');
        assert.deepEqual([Number(after.latitude), Number(after.longitude)], [14.7167, -17.4677], 'coordonnées');
    });

    test('catégorie d’événement et jauge verrouillées dès qu’il y a des ventes (LOCKED_AFTER_SALES, champ en cause) ; hausse de jauge acceptée ; sans vente, modifiables', async () => {
        const ev = await prepareEvent('verrous', [{ name: 'Standard', price: 5000, total: 10 }], 'PUBLIE', { capacity: 20 });
        await sell(ev, 'Standard', 1);
        await hold(ev, 'Standard', 2);
        const before = await eventRow(ev.eventId);
        for (const [label, patch, field] of [
            ['changement de catégorie d’événement', { category: 'FESTIVAL' }, 'category'],
            ['suppression de la jauge', { capacity: null }, 'capacity'],
            ['jauge sous vendus + réservés (1 + 2)', { capacity: 2 }, 'capacity'],
        ] as Array<[string, Row, string]>) {
            const res = await putEvent(partner, ev.eventId, patch);
            assertRefused(res, label, 'LOCKED_AFTER_SALES', [400, 409]);
            assert.ok(reportedFields(res.body).includes(field), `${label} : champ en cause ${field} : ${JSON.stringify(res.body)}`);
            assert.deepEqual(await eventRow(ev.eventId), before, `${label} : rien n’est modifié`);
        }
        const up = await putEvent(partner, ev.eventId, { capacity: 30 });
        assertOk(up, 'hausse de la jauge après des ventes');
        assert.equal(Number((await eventRow(ev.eventId)).capacity), 30, 'jauge relevée');

        const draft = await prepareEvent('verrous-brouillon', STANDARD, 'BROUILLON');
        const free = await putEvent(partner, draft.eventId, { category: 'FESTIVAL', capacity: null });
        assertOk(free, 'brouillon sans vente : catégorie et jauge modifiables');
        const row = await eventRow(draft.eventId);
        assert.deepEqual([row.category, row.capacity], ['FESTIVAL', null], 'catégorie et suppression de la jauge appliquées');
    });

    test('champs interdits (status, services, gallery_urls, ticket_categories, slug, partner_id, is_featured) → 400 FIELD_NOT_EDITABLE, rien n’est modifié', async () => {
        const ev = await prepareEvent('interdits', STANDARD, 'BROUILLON');
        const before = await eventRow(ev.eventId);
        for (const [key, value] of [
            ['status', 'PUBLIE'],
            ['services', { ticketing: true, tableBooking: true, communication: true }],
            ['gallery_urls', [posterUrl(partner.partnerId)]],
            ['ticket_categories', []],
            ['slug', 'slug-impose'],
            ['partner_id', otherPartner.partnerId],
            ['is_featured', true],
        ] as Array<[string, unknown]>) {
            const res = await putEvent(partner, ev.eventId, { [key]: value });
            assertRefused(res, `champ ${key}`, 'FIELD_NOT_EDITABLE', [400]);
            assert.ok(reportedFields(res.body).includes(key), `champ ${key} : champ en cause listé : ${JSON.stringify(res.body)}`);
            assert.deepEqual(await eventRow(ev.eventId), before, `champ ${key} : rien n’est modifié`);
        }
    });

    test('EN_ATTENTE → 409 WITHDRAW_TO_EDIT ; après retrait en BROUILLON, la modification passe', async () => {
        const ev = await prepareEvent('en-attente', STANDARD, 'EN_ATTENTE');
        const before = await eventRow(ev.eventId);
        const res = await putEvent(partner, ev.eventId, { description: 'Modification pendant la validation' });
        assertRefused(res, 'édition en EN_ATTENTE', 'WITHDRAW_TO_EDIT', [409]);
        assert.deepEqual(await eventRow(ev.eventId), before, 'EN_ATTENTE : rien n’est modifié');

        assertRpcOk(await rpcTransition(ev.eventId, partner.userId, 'BROUILLON'), 'retrait de la validation par le partenaire');
        const ok = await putEvent(partner, ev.eventId, { description: 'Modification après retrait' });
        assertOk(ok, 'édition après retrait');
        assert.equal((await eventRow(ev.eventId)).description, 'Modification après retrait', 'modification appliquée après retrait');
    });

    test('VALIDE et SUSPENDU : règles d’après publication (champ libre appliqué, statut refusé)', async () => {
        for (const status of ['VALIDE', 'SUSPENDU'] as EventStatus[]) {
            const ev = await prepareEvent(`apres-${status.toLowerCase()}`, STANDARD, status);
            const res = await putEvent(partner, ev.eventId, { description: `Description en ${status.toLowerCase()}` });
            assertOk(res, `champ libre en ${status}`);
            assert.equal((await eventRow(ev.eventId)).description, `Description en ${status.toLowerCase()}`, `${status} : champ libre appliqué`);
            const forced = await putEvent(partner, ev.eventId, { status: 'PUBLIE' });
            assertRefused(forced, `statut en ${status}`, 'FIELD_NOT_EDITABLE', [400]);
            assert.equal((await eventRow(ev.eventId)).status, status, `${status} : statut inchangé`);
        }
    });

    test('TERMINE et ANNULE → 409 EVENT_LOCKED, rien n’est modifié', async () => {
        const finished = await createEventInStatus(partner, 'ed-termine', STANDARD, 'TERMINE', { finishShift: { startsInHours: -3 } });
        const cancelled = await createEventInStatus(partner, 'ed-annule', STANDARD, 'ANNULE', { startsInHours: 72 });
        for (const ev of [finished, cancelled]) {
            const before = await eventRow(ev.eventId);
            const res = await putEvent(partner, ev.eventId, { description: 'Modification d’un événement clos' });
            assertRefused(res, `édition en ${ev.status}`, 'EVENT_LOCKED', [409]);
            assert.deepEqual(await eventRow(ev.eventId), before, `${ev.status} : rien n’est modifié`);
        }
    });

    test('admin → 403 ADMIN_CANNOT_EDIT ; partenaire B → refus sans effet', async () => {
        const ev = await prepareEvent('droits', STANDARD, 'BROUILLON');
        const before = await eventRow(ev.eventId);
        const byAdmin = await putEvent(admin, ev.eventId, { description: 'Modifié par un admin' });
        assertRefused(byAdmin, 'admin', 'ADMIN_CANNOT_EDIT', [403]);
        assert.deepEqual(await eventRow(ev.eventId), before, 'admin : rien n’est modifié');

        const byOther = await putEvent(otherPartner, ev.eventId, { description: 'Modifié par le partenaire B' });
        assert.ok([403, 404].includes(byOther.status), `partenaire B : HTTP 403 ou 404 attendu, reçu ${byOther.status} ${JSON.stringify(byOther.body)}`);
        assertFrenchError(byOther.body, 'partenaire B');
        assert.deepEqual(await eventRow(ev.eventId), before, 'partenaire B : rien n’est modifié');
    });

    test('EDIT_CONFLICT : expected_updated_at périmé → 409, la première modification reste', async () => {
        const ev = await prepareEvent('conflit', STANDARD, 'BROUILLON');
        const stale = await updatedAt(ev.eventId);
        const first = await putEvent(partner, ev.eventId, { description: 'Première session' }, stale);
        assertOk(first, 'première modification');
        const afterFirst = await eventRow(ev.eventId);
        assert.equal(afterFirst.description, 'Première session', 'première modification appliquée');
        assert.notEqual(String(afterFirst.updated_at), stale, 'updated_at avancé par la première modification');

        const second = await putEvent(partner, ev.eventId, { description: 'Seconde session, version périmée' }, stale);
        assertRefused(second, 'version périmée', 'EDIT_CONFLICT', [409]);
        assert.deepEqual(await eventRow(ev.eventId), afterFirst, 'version périmée : rien n’est écrasé');
    });

    test('report de la fin après des ventes : available_at du crédit VENTE recalculé dans la même modification, jamais avancé', async () => {
        const ev = await prepareEvent('fonds', STANDARD, 'PUBLIE', { day: 5 });
        const sale = await withSettings({ 'finance.payout_hold_enabled': true, 'finance.payout_delay_hours': 48 }, () => sell(ev, 'Standard'));
        const delay = 48 * HOUR_MS;
        const day5 = dakarDay(5);
        const credit0 = await saleCredit(sale.paymentId);
        assert.equal(Date.parse(String(credit0.available_at)), dakarInstant(day5, '23:30') + delay,
            `précondition : fonds disponibles à la fin (J+5 23:30) + 48 h : ${credit0.available_at}`);

        const day6 = dakarDay(6);
        const later = await putEvent(partner, ev.eventId, { end_date: day6, end_time: '02:00' });
        assertOk(later, 'report de la fin');
        assert.equal(Date.parse(String((await saleCredit(sale.paymentId)).available_at)), dakarInstant(day6, '02:00') + delay,
            'report : available_at = nouvelle fin + 48 h');

        const earlier = await putEvent(partner, ev.eventId, { end_date: day5, end_time: '23:00' });
        assertOk(earlier, 'fin avancée (aucune fin de vente au-delà)');
        assert.equal(Date.parse(String((await saleCredit(sale.paymentId)).available_at)), dakarInstant(day6, '02:00') + delay,
            'avancement : available_at jamais avancé');
    });

    test('fin avancée sous une fin de vente → 409 SALE_END_AFTER_EVENT avec les catégories concernées ; rien n’est modifié', async () => {
        const day5 = dakarDay(5);
        const ev = await prepareEvent('fin-de-vente', [
            { name: 'Prévente', price: 4000, total: 10, saleEnd: `${day5}T22:00:00Z` },
            { name: 'Sur place', price: 6000, total: 10, saleEnd: `${day5}T18:00:00Z` },
        ], 'BROUILLON', { day: 5 });
        const before = await eventRow(ev.eventId);
        const res = await putEvent(partner, ev.eventId, { end_time: '21:00' });
        assertRefused(res, 'fin à 21:00 sous la fin de vente de 22:00', 'SALE_END_AFTER_EVENT', [409]);
        const list = res.body.categories;
        assert.ok(Array.isArray(list), `liste des catégories concernées (categories) attendue : ${JSON.stringify(res.body)}`);
        const listed = list.flatMap((c: unknown) => typeof c === 'string' ? [c]
            : c && typeof c === 'object' ? [(c as Row).id, (c as Row).category_id, (c as Row).name].filter((x): x is string => typeof x === 'string') : []);
        assert.ok(listed.includes(ev.categories['Prévente'].id) || listed.includes('Prévente'), `Prévente listée : ${JSON.stringify(list)}`);
        assert.ok(!listed.includes(ev.categories['Sur place'].id) && !listed.includes('Sur place'), `Sur place (fin de vente 18:00) non listée : ${JSON.stringify(list)}`);
        assert.deepEqual(await eventRow(ev.eventId), before, 'refus : rien n’est modifié');

        const ok = await putEvent(partner, ev.eventId, { end_time: '22:30' });
        assertOk(ok, 'fin à 22:30, après toutes les fins de vente');
        assert.equal((await eventRow(ev.eventId)).end_time, '22:30:00', 'fin appliquée');
    });

    // Lot 6 (T) : l'ancien cron de la file du lot 5 est supprimé ; l'envoyeur unique envoie le SMS regroupé.
    // Passage à midi (Dakar) le lendemain : SMS optionnel hors plage de silence (section Y du contrat).
    test('SMS de changement : l’envoyeur envoie un SMS par porteur et une seule fois', async () => {
        const ev = await prepareEvent('cron-sms', STANDARD, 'PUBLIE', { day: 8 });
        const sale = await sell(ev, 'Standard');
        await flushEvent(ev.eventId);
        const res = await putEvent(partner, ev.eventId, { start_time: '21:00', end_time: '23:45' });
        assertOk(res, 'changement d’heure');
        assertNotified(res, 'changement d’heure', 1, 1);

        const sms = getFakes().sms;
        const before = sms.messagesTo(sale.buyer.phoneE164).length;
        const noon = noonDakarTomorrow();
        await dispatchAt(noon, { eventIds: [ev.eventId] });
        assert.equal(sms.messagesTo(sale.buyer.phoneE164).length, before + 1, 'un SMS au porteur après le passage de l’envoyeur');
        await dispatchAt(new Date(noon.getTime() + 61_000), { eventIds: [ev.eventId] });
        assert.equal(sms.messagesTo(sale.buyer.phoneE164).length, before + 1, 'second passage : aucun SMS en double');
        const rows = await changeRows(ev.eventId);
        assert.deepEqual(rows.map((r) => r.status), ['SENT'], `ligne SMS du changement envoyée : ${JSON.stringify(rows.map((r) => [r.status, r.reason]))}`);
    });
});

// ── Formulaire partagé et schéma ───────────────────────────────────────────

describe('F6 — formulaire partagé et RPC (contrôles statiques et catalogue)', () => {
    test('un seul composant components/events/EventForm.tsx, rendu par la création et l’édition, sans copie locale du formulaire', () => {
        const formFile = 'components/events/EventForm.tsx';
        const form = code(formFile);
        for (const page of ['app/partner/events/new/page.tsx', 'app/partner/events/[id]/edit/page.tsx']) {
            const src = code(page);
            assert.match(src, /import\s+(?:\{[^}]*\bEventForm\b[^}]*\}|EventForm)\s+from\s+['"][^'"]*components\/events\/EventForm['"]/, `${page} importe components/events/EventForm`);
            assert.match(src, /<EventForm\b/, `${page} rend <EventForm>`);
            assert.doesNotMatch(src, /from\s+['"]zod['"]|\bz\.object\(/, `${page} : aucun schéma Zod local`);
            assert.doesNotMatch(src, /\bMapPicker\b|<ImageUpload\b/, `${page} : aucun champ du formulaire recopié dans la page`);
        }
        assert.match(form, /\bMapPicker\b/, `${formFile} : carte (MapPicker)`);
        assert.match(form, /\bcategory\b/, `${formFile} : catégorie d’événement`);
        assert.match(form, /\bkind\b/, `${formFile} : programme typé (kind)`);
        const sources = [form, ...componentImports(formFile, form).map((f) => code(f))];
        assert.ok(sources.some((s) => /\/categories\b/.test(s)),
            `${formFile} (ou ses composants) : en édition, la billetterie passe par les routes /categories (F4)`);
    });

    test('statique : l’édition passe par event_update ; plus de notification synchrone dans le service', () => {
        const route = code('app/api/partner/events/[id]/route.ts');
        const svc = code('lib/events/event.service.ts');
        assert.match(route + svc, /\b(?:rpc|rpcWithRetry)(?:<[^>]*>)?\(\s*['"]event_update['"]/, 'PUT /api/partner/events/[id] (ou EventService) appelle la RPC event_update');
        assert.doesNotMatch(svc, /full_name/, 'lib/events/event.service.ts : plus de lecture de users.full_name (colonne inexistante)');
        assert.doesNotMatch(route, /body\.ticket_categories/, 'PUT : plus de contrôle de jauge sur body.ticket_categories (champ refusé, FIELD_NOT_EDITABLE)');
    });

    test('RPC event_create et event_update : SECURITY DEFINER, search_path = public, (p jsonb) RETURNS jsonb, réservées au service_role', async () => {
        const names = ['event_create', 'event_update'];
        const rows = await inspect(async (db) => (await db.query<{ proname: string; secdef: boolean; config: string[] | null; args: string; result: string; anon: boolean; auth: boolean; svc: boolean }>(
            `SELECT p.proname, p.prosecdef AS secdef, p.proconfig AS config,
                    pg_get_function_identity_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS result,
                    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
                    has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [names])).rows);
        for (const fn of names) {
            const r = rows.filter((x) => x.proname === fn);
            assert.equal(r.length, 1, `fonction ${fn} : une seule signature attendue (${JSON.stringify(r)})`);
            const x = r[0];
            assert.equal(x.args, 'p jsonb', `${fn} : argument (p jsonb)`);
            assert.equal(x.result, 'jsonb', `${fn} : RETURNS jsonb`);
            assert.equal(x.secdef, true, `${fn} : SECURITY DEFINER`);
            assert.ok((x.config ?? []).some((c) => /^search_path=public$/.test(c)), `${fn} : search_path = public (${JSON.stringify(x.config)})`);
            assert.equal(x.anon, false, `${fn} : non exécutable par anon`);
            assert.equal(x.auth, false, `${fn} : non exécutable par authenticated`);
            assert.equal(x.svc, true, `${fn} : exécutable par le service_role`);
        }
    });
});
