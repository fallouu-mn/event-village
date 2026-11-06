/**
 * Lot 5, tâche 5.5 — catégories de billets par des routes dédiées (constats R29, events-cdc-4, -12,
 * partner-ux-3, -13, ticketing-finance-11). Contrat : section F4 de la conception du lot 5 (et F1 pour les
 * bornes, U pour les précisions).
 *  - POST /api/partner/events/[id]/categories → RPC ticket_category_create ; PATCH et DELETE sur
 *    /categories/[categoryId] → ticket_category_update et ticket_category_delete ;
 *  - « il y a des ventes » = au moins un billet de la catégorie (tout statut) ou une réservation ACTIVE ;
 *  - prix modifiable seulement sans vente, sinon 409 PRICE_LOCKED_AFTER_SALES ;
 *  - quota ≥ vendus (QUOTA_BELOW_SOLD) et ≥ vendus + réservés (QUOTA_BELOW_HELD) ; Σ quotas ≤ jauge
 *    (QUOTA_ABOVE_CAPACITY) ;
 *  - suppression seulement sans billet ni réservation, sinon 409 CATEGORY_HAS_SALES, la réponse proposant
 *    de désactiver la catégorie ;
 *  - TERMINE ou ANNULE → 409 EVENT_LOCKED ;
 *  - name, dates de vente (datetime-local, heure de Dakar), max_per_order, is_visible et is_active tous
 *    appliqués : plus rien d'ignoré ni de modifié en silence (une hausse de quota ne réactive plus une
 *    catégorie désactivée) ; nom unique par événement sans tenir compte de la casse ; clés inconnues
 *    refusées (.strict()) ; prix et quantités entiers ;
 *  - erreurs { error: <message français>, code } sans message Postgres brut ni enum.
 * Formes choisies ici, le contrat étant muet (signalées au rapport) : réponses 201 { success, category } du
 * POST et 200 du PATCH et du DELETE (formes actuelles) ; HTTP 400 ou 409 pour les codes QUOTA_* et pour un
 * nom en double ; partenaire B : 403 ou 404 ; Σ quotas calculée sur les catégories actives (le quota testé
 * dépasse la jauge dans les deux lectures, actives seules ou toutes).
 * Rouge avant correctif :
 *  - POST : is_active forcé à true (lib/events/event.service.ts:643), max_per_order 0 remplacé par 10
 *    (app/api/partner/events/[id]/categories/route.ts:39), prix décimal accepté (NUMERIC(12,2),
 *    supabase/migrations/0001_initial_schema.sql:317), clés inconnues ignorées, aucun contrôle de doublon,
 *    jauge dépassée refusée sans code (service:625-627) ;
 *  - PATCH : name, sale_start, sale_end et max_per_order non transmis
 *    (app/api/partner/events/[id]/categories/[categoryId]/route.ts:26-32) ; prix modifiable après des ventes
 *    (service:507-511) ; plancher sur les seuls vendus, sans code (service:525-527) ; vendus + réservés
 *    rejeté par la contrainte chk_ticket_categories_quantities, message Postgres brut (service:559) ;
 *    réactivation implicite (service:544-546) ; quota non numérique envoyé à null (message « null value… ») ;
 *  - DELETE : aucun gestionnaire exporté ; statuts TERMINE et ANNULE refusés en 400 avec l'enum brut
 *    (service:493, :612) ; partenaire B : 400 « Événement introuvable » (service:489, :608) ;
 *  - préparation des événements publiés, terminés ou annulés : event_transition et event_cancel absentes
 *    (cycle-helpers.ts, advanceEventTo).
 * La suite crée ses partenaires, ses acheteurs et ses événements.
 *
 * Lot 8 (8.2 v) : cas T8 de tests/legacy/event-live-editing-and-stock.test.ts porté, vert dès l'écriture : deux hausses
 * de quota simultanées par la route. T1 du legacy attendait une réactivation implicite, contredite par la suite :
 * non porté. Plus strict que le legacy (au moins une réussite) : les deux réussissent, sans mise à jour perdue,
 * ticket_category_guard verrouillant l'événement.
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
import { routeContext } from './helpers';
import { cart, categoryState, checkout, importModule, newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { advanceEventTo, createDraftEvent, createEventInStatus, type DraftEvent, type EventStatus } from './cycle-helpers';

const ROOT = process.cwd();
const DAY_MS = 86_400_000;
const CATEGORIES_ROUTE = '../../app/api/partner/events/[id]/categories/route';
const CATEGORY_ROUTE = '../../app/api/partner/events/[id]/categories/[categoryId]/route';

let partner: TestPartner;
let otherPartner: TestPartner;

before(async () => {
    partner = await newPartner('edition-cat');
    otherPartner = await newPartner('edition-cat-b');
});

after(async () => {
    await assertLifecycleInvariants('edition-categories');
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

/** Instant d'une date et d'une heure de Dakar (UTC+0 toute l'année). */
function dakarInstant(date: string, time: string): number {
    return Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}Z`);
}

/** Événement du partenaire au jour J+5 de 20:00 à 23:30 (Dakar), avancé jusqu'à `target` par les RPC du contrat. */
async function prepareEvent(label: string, categories: CategorySpec[], target: EventStatus, capacity: number): Promise<DraftEvent> {
    const ev = await createDraftEvent(partner, label, categories, { capacity, startsInHours: 6 * 24 });
    const d = dakarDay(5);
    const { data, error } = await service.from('events')
        .update({ start_date: d, start_time: '20:00:00', end_date: d, end_time: '23:30:00' })
        .eq('id', ev.eventId).select('id');
    assert.equal(error, null, `dates de l'événement ${label} : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `dates de l'événement ${label} : aucune ligne modifiée`);
    if (target !== 'BROUILLON') await advanceEventTo(ev.eventId, target, { partnerUserId: partner.userId });
    return ev;
}

async function postCategory(user: Buyer, eventId: string, body: Row): Promise<RouteResult> {
    const post = await handlerOf(CATEGORIES_ROUTE, 'POST');
    return invoke(post, jsonRequest(`/api/partner/events/${eventId}/categories`, 'POST', user.accessToken, body), routeContext({ id: eventId }));
}

async function patchCategory(user: Buyer, eventId: string, categoryId: string, body: Row): Promise<RouteResult> {
    const patch = await handlerOf(CATEGORY_ROUTE, 'PATCH');
    return invoke(patch, jsonRequest(`/api/partner/events/${eventId}/categories/${categoryId}`, 'PATCH', user.accessToken, body),
        routeContext({ id: eventId, categoryId }));
}

async function deleteCategory(user: Buyer, eventId: string, categoryId: string): Promise<RouteResult> {
    const del = await handlerOf(CATEGORY_ROUTE, 'DELETE');
    return invoke(del, jsonRequest(`/api/partner/events/${eventId}/categories/${categoryId}`, 'DELETE', user.accessToken),
        routeContext({ id: eventId, categoryId }));
}

async function categoryRow(categoryId: string): Promise<Row | null> {
    const { data, error } = await service.from('ticket_categories').select('*').eq('id', categoryId).maybeSingle();
    assert.equal(error, null, `catégorie ${categoryId} : ${error?.message}`);
    return (data ?? null) as Row | null;
}

async function existingCategory(categoryId: string): Promise<Row> {
    const row = await categoryRow(categoryId);
    assert.ok(row, `catégorie ${categoryId} introuvable`);
    return row;
}

async function categoriesOf(eventId: string): Promise<Row[]> {
    const { data, error } = await service.from('ticket_categories').select('*').eq('event_id', eventId).order('created_at').order('id');
    assert.equal(error, null, `catégories de l'événement ${eventId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function namedLike(eventId: string, name: string): Promise<Row[]> {
    return (await categoriesOf(eventId)).filter((c) => String(c.name).toLowerCase() === name.toLowerCase());
}

/** Σ des quotas des catégories actives de l'événement, hors `exceptId`. */
async function activeQuotaSum(eventId: string, exceptId?: string): Promise<number> {
    return (await categoriesOf(eventId))
        .filter((c) => c.is_active === true && c.id !== exceptId)
        .reduce((s, c) => s + Number(c.total_quantity), 0);
}

/** Vente réelle : acheteur neuf, checkout, succès SamirPay, webhook. */
async function sell(ev: DraftEvent, category: string, quantity: number): Promise<void> {
    const buyer = await newBuyer('ed-cat-ach');
    const p = await buyConfirmed(buyer, ev, [[category, quantity]]);
    assert.equal(p.tickets.length, quantity, `vente de ${quantity} billet(s) ${category} : ${p.tickets.length} émis`);
}

/** Paiement en cours : réservation ACTIVE (held_quantity), aucun billet. */
async function hold(ev: DraftEvent, category: string, quantity: number): Promise<void> {
    const buyer = await newBuyer('ed-cat-res');
    const catId = ev.categories[category].id;
    const res = await checkout(buyer, cart(ev.eventId, [[catId, quantity]], buyer));
    assert.equal(res.status, 200, `paiement en cours (${quantity} ${category}) : HTTP ${res.status} ${JSON.stringify(res.body)}`);
    assert.ok(res.payment, 'paiement en cours créé');
    const { data, error } = await service.from('stock_reservations').select('quantity, status').eq('payment_id', res.payment.id).eq('category_id', catId);
    assert.equal(error, null, `réservation : ${error?.message}`);
    assert.deepEqual((data ?? []).map((r) => [Number(r.quantity), r.status]), [[quantity, 'ACTIVE']], 'réservation ACTIVE du paiement en cours');
}

async function ticketCount(categoryId: string): Promise<number> {
    const { count, error } = await service.from('tickets').select('id', { count: 'exact', head: true }).eq('category_id', categoryId);
    assert.equal(error, null, `billets de la catégorie ${categoryId} : ${error?.message}`);
    return count ?? 0;
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

/** Champs en cause : body.field, puis body.fields (tableau de chemins ou d'objets { path }, ou objet { chemin: message }). */
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

/** Refus de validation : HTTP attendu, code présent, champ en cause listé, message français. */
function assertInvalid(res: RouteResult, label: string, field: string, statuses: number[] = [400]): void {
    assert.ok(statuses.includes(res.status), `${label} : HTTP ${statuses.join(' ou ')} attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
    assert.equal(typeof res.body.code, 'string', `${label} : code attendu : ${JSON.stringify(res.body)}`);
    assert.ok(reportedFields(res.body).some((f) => f === field || f.endsWith(`.${field}`)), `${label} : champ ${field} en cause : ${JSON.stringify(res.body)}`);
    assertFrenchError(res.body, label);
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

// ── Création ───────────────────────────────────────────────────────────────

describe('F4 — création : POST /api/partner/events/[id]/categories (ticket_category_create)', () => {
    let draft: DraftEvent;

    before(async () => {
        draft = await prepareEvent('cat-creation', [{ name: 'Standard', price: 5000, total: 10 }], 'BROUILLON', 100);
    });

    test('tous les champs appliqués, rien d’ignoré (is_active: false, max_per_order, dates de vente en heure de Dakar)', async () => {
        const d2 = dakarDay(2);
        const d5 = dakarDay(5);
        const res = await postCategory(partner, draft.eventId, {
            name: 'Prévente', description: 'Tarif de prévente', price: 4000, total_quantity: 15, max_per_order: 3,
            sale_start: `${d2}T08:00`, sale_end: `${d5}T18:00`, is_visible: false, is_active: false,
        });
        assert.equal(res.status, 201, `création : HTTP 201 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
        const rows = await namedLike(draft.eventId, 'Prévente');
        assert.equal(rows.length, 1, 'catégorie Prévente créée');
        const c = rows[0];
        assert.deepEqual(
            [c.name, c.description, Number(c.price), Number(c.total_quantity), Number(c.max_per_order), c.is_visible, c.is_active],
            ['Prévente', 'Tarif de prévente', 4000, 15, 3, false, false],
            `tous les champs appliqués : ${JSON.stringify(c)}`);
        assert.equal(Date.parse(String(c.sale_start)), dakarInstant(d2, '08:00'), 'début de vente en heure de Dakar');
        assert.equal(Date.parse(String(c.sale_end)), dakarInstant(d5, '18:00'), 'fin de vente en heure de Dakar');
    });

    test('max_per_order 0, prix 1500,5 ou clé inconnue (sold_quantity) → 400 en français, aucune catégorie créée', async () => {
        for (const [label, name, extra, field] of [
            ['max_per_order 0', 'Groupe zéro', { max_per_order: 0 }, 'max_per_order'],
            ['prix décimal', 'Prix décimal', { price: 1500.5 }, 'price'],
            ['clé inconnue sold_quantity', 'Stock imposé', { sold_quantity: 5 }, 'sold_quantity'],
        ] as Array<[string, string, Row, string]>) {
            const res = await postCategory(partner, draft.eventId, { name, price: 2000, total_quantity: 5, max_per_order: 2, ...extra });
            assertInvalid(res, label, field);
            assert.deepEqual(await namedLike(draft.eventId, name), [], `${label} : aucune catégorie créée`);
        }
    });

    test('Σ des quotas au-delà de la jauge → QUOTA_ABOVE_CAPACITY, aucune catégorie créée', async () => {
        const quota = 100 - await activeQuotaSum(draft.eventId) + 1;
        const res = await postCategory(partner, draft.eventId, { name: 'Débordement', price: 1000, total_quantity: quota, max_per_order: 2 });
        assertRefused(res, `quota ${quota} au-delà de la jauge de 100`, 'QUOTA_ABOVE_CAPACITY', [400, 409]);
        assert.deepEqual(await namedLike(draft.eventId, 'Débordement'), [], 'aucune catégorie créée');
    });

    test('nom déjà pris (casse différente) → refusé, aucune catégorie créée', async () => {
        const res = await postCategory(partner, draft.eventId, { name: 'STANDARD', price: 3000, total_quantity: 5, max_per_order: 2 });
        assert.ok([400, 409].includes(res.status), `nom en double : HTTP 400 ou 409 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
        assert.equal(typeof res.body.code, 'string', `nom en double : code attendu : ${JSON.stringify(res.body)}`);
        assertFrenchError(res.body, 'nom en double');
        assert.equal((await namedLike(draft.eventId, 'standard')).length, 1, 'une seule catégorie « Standard »');
    });
});

// ── Modification sans vente ────────────────────────────────────────────────

describe('F4 — modification sans vente : PATCH …/categories/[categoryId] (ticket_category_update)', () => {
    let draft: DraftEvent;

    before(async () => {
        draft = await prepareEvent('cat-modif', [
            { name: 'Standard', price: 5000, total: 10 },
            { name: 'Tardif', price: 3000, total: 5, isActive: false },
        ], 'BROUILLON', 100);
    });

    test('name, description, dates de vente, max_per_order, is_visible et is_active appliqués (plus rien d’ignoré)', async () => {
        const id = draft.categories.Standard.id;
        const d1 = dakarDay(1);
        const d5 = dakarDay(5);
        const res = await patchCategory(partner, draft.eventId, id, {
            name: 'Plein tarif', description: 'Billet plein tarif', sale_start: `${d1}T09:00`, sale_end: `${d5}T19:30`,
            max_per_order: 7, is_visible: false, is_active: false,
        });
        assert.equal(res.status, 200, `modification : HTTP 200 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
        const c = await existingCategory(id);
        assert.deepEqual([c.name, c.description, Number(c.max_per_order), c.is_visible, c.is_active],
            ['Plein tarif', 'Billet plein tarif', 7, false, false], `champs appliqués : ${JSON.stringify(c)}`);
        assert.equal(Date.parse(String(c.sale_start)), dakarInstant(d1, '09:00'), 'début de vente appliqué (Dakar)');
        assert.equal(Date.parse(String(c.sale_end)), dakarInstant(d5, '19:30'), 'fin de vente appliquée (Dakar)');
    });

    test('prix et quota modifiables sans vente ni réservation (garde-fou)', async () => {
        const id = draft.categories.Standard.id;
        const res = await patchCategory(partner, draft.eventId, id, { price: 4500, total_quantity: 8 });
        assert.equal(res.status, 200, `prix et quota sans vente : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        const c = await existingCategory(id);
        assert.deepEqual([Number(c.price), Number(c.total_quantity)], [4500, 8], 'prix et quota appliqués');
    });

    test('hausse de quota d’une catégorie désactivée : elle reste désactivée (aucune réactivation implicite)', async () => {
        const id = draft.categories.Tardif.id;
        assert.equal((await existingCategory(id)).is_active, false, 'précondition : catégorie désactivée');
        const res = await patchCategory(partner, draft.eventId, id, { total_quantity: 9 });
        assert.equal(res.status, 200, `hausse de quota : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        const c = await existingCategory(id);
        assert.equal(Number(c.total_quantity), 9, 'quota appliqué');
        assert.equal(c.is_active, false, 'la catégorie reste désactivée : aucune modification implicite');
    });

    test('clé inconnue (sold_quantity, held_quantity, event_id) → 400 avec le champ refusé, rien n’est modifié', async () => {
        const id = draft.categories.Tardif.id;
        for (const [key, value] of [['sold_quantity', 0], ['held_quantity', 0], ['event_id', randomUUID()]] as Array<[string, unknown]>) {
            const before = await existingCategory(id);
            const res = await patchCategory(partner, draft.eventId, id, { [key]: value });
            assertInvalid(res, `clé ${key}`, key);
            assert.deepEqual(await existingCategory(id), before, `clé ${key} : rien n’est modifié`);
        }
    });

    test('renommer vers un nom déjà pris (casse différente) → refusé, rien n’est modifié', async () => {
        const id = draft.categories.Tardif.id;
        const taken = String((await existingCategory(draft.categories.Standard.id)).name);
        const before = await existingCategory(id);
        const res = await patchCategory(partner, draft.eventId, id, { name: taken.toUpperCase() });
        assert.ok([400, 409].includes(res.status), `nom en double : HTTP 400 ou 409 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
        assert.equal(typeof res.body.code, 'string', `nom en double : code attendu : ${JSON.stringify(res.body)}`);
        assertFrenchError(res.body, 'nom en double');
        assert.deepEqual(await existingCategory(id), before, 'nom en double : rien n’est modifié');
    });

    test('valeurs invalides (quota non numérique, prix décimal, fin de vente avant le début ou après la fin) → refus en français, sans message Postgres', async () => {
        const id = draft.categories.Tardif.id;
        const d3 = dakarDay(3);
        const d4 = dakarDay(4);
        const d6 = dakarDay(6);
        for (const [label, body, field, statuses] of [
            ['quota non numérique', { total_quantity: 'abc' }, 'total_quantity', [400]],
            ['prix décimal', { price: 1500.5 }, 'price', [400]],
            ['fin de vente avant le début', { sale_start: `${d4}T10:00`, sale_end: `${d3}T10:00` }, 'sale_end', [400]],
            ['fin de vente après la fin de l’événement (J+5 23:30)', { sale_end: `${d6}T10:00` }, 'sale_end', [400, 409]],
        ] as Array<[string, Row, string, number[]]>) {
            const before = await existingCategory(id);
            const res = await patchCategory(partner, draft.eventId, id, body);
            if (label === 'fin de vente avant le début') {
                assert.ok(res.status === 400, `${label} : HTTP 400 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
                assert.ok(reportedFields(res.body).some((f) => /sale_(start|end)$/.test(f)), `${label} : champ sale_start ou sale_end en cause : ${JSON.stringify(res.body)}`);
                assertFrenchError(res.body, label);
            } else {
                assertInvalid(res, label, field, statuses);
            }
            assert.deepEqual(await existingCategory(id), before, `${label} : rien n’est modifié`);
        }
    });
});

// ── Avec des ventes ────────────────────────────────────────────────────────

describe('F4 — catégories avec des ventes (événement publié)', () => {
    let ev: DraftEvent;
    const CAPACITY = 30;

    before(async () => {
        ev = await prepareEvent('cat-ventes', [
            { name: 'Standard', price: 5000, total: 10 },
            { name: 'VIP', price: 15000, total: 5 },
            { name: 'Libre', price: 2000, total: 5 },
        ], 'PUBLIE', CAPACITY);
        await sell(ev, 'Standard', 2);
        await hold(ev, 'Standard', 3);
        await hold(ev, 'VIP', 1);
        const s = await categoryState(ev.categories.Standard.id);
        assert.deepEqual([s.sold, s.held], [2, 3], `précondition Standard : 2 vendus, 3 réservés (${JSON.stringify(s)})`);
        const v = await categoryState(ev.categories.VIP.id);
        assert.deepEqual([v.sold, v.held], [0, 1], `précondition VIP : aucun vendu, 1 réservé (${JSON.stringify(v)})`);
        assert.equal(await ticketCount(ev.categories.VIP.id), 0, 'précondition VIP : aucun billet');
    });

    test('quota sous les vendus → QUOTA_BELOW_SOLD, rien n’est modifié', async () => {
        const id = ev.categories.Standard.id;
        const before = await existingCategory(id);
        const res = await patchCategory(partner, ev.eventId, id, { total_quantity: 1 });
        assertRefused(res, 'quota 1 pour 2 vendus', 'QUOTA_BELOW_SOLD', [400, 409]);
        assert.deepEqual(await existingCategory(id), before, 'rien n’est modifié');
    });

    test('quota sous vendus + réservés → QUOTA_BELOW_HELD, sans message Postgres, rien n’est modifié', async () => {
        const id = ev.categories.Standard.id;
        const before = await existingCategory(id);
        const res = await patchCategory(partner, ev.eventId, id, { total_quantity: 4 });
        assertRefused(res, 'quota 4 pour 2 vendus et 3 réservés', 'QUOTA_BELOW_HELD', [400, 409]);
        assert.deepEqual(await existingCategory(id), before, 'rien n’est modifié');
    });

    test('quota égal à vendus + réservés : accepté (garde-fou)', async () => {
        const id = ev.categories.Standard.id;
        const res = await patchCategory(partner, ev.eventId, id, { total_quantity: 5 });
        assert.equal(res.status, 200, `quota 5 = 2 vendus + 3 réservés : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        assert.equal(Number((await existingCategory(id)).total_quantity), 5, 'quota appliqué');
    });

    test('Σ des quotas au-delà de la jauge → QUOTA_ABOVE_CAPACITY, rien n’est modifié', async () => {
        const id = ev.categories.Libre.id;
        const quota = CAPACITY - await activeQuotaSum(ev.eventId, id) + 1;
        const before = await existingCategory(id);
        const res = await patchCategory(partner, ev.eventId, id, { total_quantity: quota });
        assertRefused(res, `quota ${quota} au-delà de la jauge de ${CAPACITY}`, 'QUOTA_ABOVE_CAPACITY', [400, 409]);
        assert.deepEqual(await existingCategory(id), before, 'rien n’est modifié');
    });

    test('prix d’une catégorie vendue → 409 PRICE_LOCKED_AFTER_SALES, rien n’est modifié', async () => {
        const id = ev.categories.Standard.id;
        const before = await existingCategory(id);
        const res = await patchCategory(partner, ev.eventId, id, { price: 6000 });
        assertRefused(res, 'prix d’une catégorie vendue', 'PRICE_LOCKED_AFTER_SALES', [409]);
        assert.deepEqual(await existingCategory(id), before, 'rien n’est modifié');
    });

    test('prix d’une catégorie qui n’a qu’une réservation en cours → 409 PRICE_LOCKED_AFTER_SALES', async () => {
        const id = ev.categories.VIP.id;
        const before = await existingCategory(id);
        const res = await patchCategory(partner, ev.eventId, id, { price: 12000 });
        assertRefused(res, 'prix d’une catégorie réservée', 'PRICE_LOCKED_AFTER_SALES', [409]);
        assert.deepEqual(await existingCategory(id), before, 'rien n’est modifié');
    });

    test('champs non financiers d’une catégorie vendue (nom, description, max_per_order, visibilité) : appliqués', async () => {
        const id = ev.categories.Standard.id;
        const res = await patchCategory(partner, ev.eventId, id, { name: 'Standard (soirée)', description: 'Placement libre', max_per_order: 5, is_visible: true });
        assert.equal(res.status, 200, `champs non financiers : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        const c = await existingCategory(id);
        assert.deepEqual([c.name, c.description, Number(c.max_per_order), c.is_visible, Number(c.price)],
            ['Standard (soirée)', 'Placement libre', 5, true, 5000], `champs appliqués, prix inchangé : ${JSON.stringify(c)}`);
    });

    test('prix d’une catégorie sans vente ni réservation : modifiable (garde-fou)', async () => {
        const id = ev.categories.Libre.id;
        const res = await patchCategory(partner, ev.eventId, id, { price: 2500 });
        assert.equal(res.status, 200, `prix sans vente : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        assert.equal(Number((await existingCategory(id)).price), 2500, 'prix appliqué');
    });

    test('suppression d’une catégorie vendue ou réservée → 409 CATEGORY_HAS_SALES, la réponse propose de la désactiver', async () => {
        for (const [label, id] of [['catégorie vendue', ev.categories.Standard.id], ['catégorie réservée', ev.categories.VIP.id]] as Array<[string, string]>) {
            const before = await existingCategory(id);
            const res = await deleteCategory(partner, ev.eventId, id);
            assertRefused(res, `suppression d’une ${label}`, 'CATEGORY_HAS_SALES', [409]);
            assert.match(String(res.body.error), /désactiv/i, `${label} : la réponse propose de désactiver la catégorie : ${JSON.stringify(res.body)}`);
            assert.deepEqual(await existingCategory(id), before, `${label} : catégorie conservée`);
        }
    });

    test('suppression d’une catégorie sans vente ni réservation : effective', async () => {
        const id = ev.categories.Libre.id;
        const res = await deleteCategory(partner, ev.eventId, id);
        assert.equal(res.status, 200, `suppression sans vente : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        assert.equal(await categoryRow(id), null, 'catégorie supprimée');
    });
});

// ── Statuts et droits ──────────────────────────────────────────────────────

describe('F4 — statuts et droits', () => {
    test('TERMINE et ANNULE → 409 EVENT_LOCKED pour la création, la modification et la suppression', async () => {
        const cats: CategorySpec[] = [{ name: 'Standard', price: 5000, total: 10 }];
        const finished = await createEventInStatus(partner, 'cat-termine', cats, 'TERMINE', { finishShift: { startsInHours: -3 } });
        const cancelled = await createEventInStatus(partner, 'cat-annule', cats, 'ANNULE', { startsInHours: 72 });
        for (const e of [finished, cancelled]) {
            const before = await categoriesOf(e.eventId);
            const id = e.categories.Standard.id;
            assertRefused(await postCategory(partner, e.eventId, { name: 'Ajout tardif', price: 1000, total_quantity: 2, max_per_order: 2 }),
                `création en ${e.status}`, 'EVENT_LOCKED', [409]);
            assertRefused(await patchCategory(partner, e.eventId, id, { description: 'Modification tardive' }),
                `modification en ${e.status}`, 'EVENT_LOCKED', [409]);
            assertRefused(await deleteCategory(partner, e.eventId, id), `suppression en ${e.status}`, 'EVENT_LOCKED', [409]);
            assert.deepEqual(await categoriesOf(e.eventId), before, `${e.status} : catégories inchangées`);
        }
    });

    test('partenaire B : création, modification et suppression sur l’événement de A refusées sans effet', async () => {
        const draft = await prepareEvent('cat-droits', [{ name: 'Standard', price: 5000, total: 10 }], 'BROUILLON', 50);
        const id = draft.categories.Standard.id;
        const before = await categoriesOf(draft.eventId);
        for (const [label, res] of [
            ['création', await postCategory(otherPartner, draft.eventId, { name: 'Intrusion', price: 1000, total_quantity: 2, max_per_order: 2 })],
            ['modification', await patchCategory(otherPartner, draft.eventId, id, { price: 1 })],
            ['suppression', await deleteCategory(otherPartner, draft.eventId, id)],
        ] as Array<[string, RouteResult]>) {
            assert.ok([403, 404].includes(res.status), `partenaire B, ${label} : HTTP 403 ou 404 attendu, reçu ${res.status} ${JSON.stringify(res.body)}`);
            assertFrenchError(res.body, `partenaire B, ${label}`);
        }
        assert.deepEqual(await categoriesOf(draft.eventId), before, 'partenaire B : catégories de A inchangées');
    });
});

// ── RPC et code ────────────────────────────────────────────────────────────

describe('8.2 v — concurrence sur les quotas (cas T8 porté)', () => {
    test('deux hausses simultanées du quota : deux 200, aucune mise à jour perdue, vendus intacts', async () => {
        const ev = await prepareEvent('quota-simultane', [{ name: 'Standard', price: 5000, total: 50 }], 'PUBLIE', 200);
        await sell(ev, 'Standard', 2);
        const id = ev.categories.Standard.id;
        const results = await Promise.all([
            patchCategory(partner, ev.eventId, id, { total_quantity: 80 }),
            patchCategory(partner, ev.eventId, id, { total_quantity: 90 }),
        ]);
        assert.deepEqual(results.map((r) => r.status), [200, 200], `les deux hausses sont acceptées : ${JSON.stringify(results)}`);
        const c = await existingCategory(id);
        assert.equal(Number(c.sold_quantity), 2, 'vendus intacts');

        const { data, error } = await service.from('audit_logs').select('metadata').eq('action', 'CATEGORY_UPDATED').eq('object_id', id);
        assert.equal(error, null, `journal CATEGORY_UPDATED : ${error?.message}`);
        const steps = (data ?? []).map((row) => {
            const m = row.metadata as { old: { total_quantity: number }; new: { total_quantity: number } };
            return { from: Number(m.old.total_quantity), to: Number(m.new.total_quantity) };
        });
        assert.equal(steps.length, 2, `deux modifications journalisées : ${JSON.stringify(steps)}`);
        const first = steps.find((s) => s.from === 50);
        assert.ok(first, `une modification part du quota d’origine : ${JSON.stringify(steps)}`);
        const second = steps.find((s) => s !== first)!;
        assert.equal(second.from, first.to, `la seconde part du résultat de la première, aucune mise à jour perdue : ${JSON.stringify(steps)}`);
        assert.equal(Number(c.total_quantity), second.to, 'le quota final est celui de la dernière modification validée');
    });
});

describe('F4 — RPC et routes (catalogue et contrôles statiques)', () => {
    test('RPC ticket_category_create, _update et _delete : SECURITY DEFINER, search_path = public, (p jsonb) RETURNS jsonb, réservées au service_role', async () => {
        const names = ['ticket_category_create', 'ticket_category_update', 'ticket_category_delete'];
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

    test('statique : les routes des catégories passent par les RPC ; DELETE exporté', () => {
        const collection = code('app/api/partner/events/[id]/categories/route.ts');
        const item = code('app/api/partner/events/[id]/categories/[categoryId]/route.ts');
        const svc = code('lib/events/event.service.ts');
        const rpcCall = (fn: string): RegExp => new RegExp(`\\b(?:rpc|rpcWithRetry)(?:<[^>]*>)?\\(\\s*['"]${fn}['"]`);
        assert.match(collection + svc, rpcCall('ticket_category_create'), 'POST /categories (ou EventService) appelle ticket_category_create');
        assert.match(item + svc, rpcCall('ticket_category_update'), 'PATCH /categories/[categoryId] (ou EventService) appelle ticket_category_update');
        assert.match(item + svc, rpcCall('ticket_category_delete'), 'DELETE /categories/[categoryId] (ou EventService) appelle ticket_category_delete');
        assert.match(item, /export\s+(async\s+)?function\s+DELETE\b|export\s+const\s+DELETE\b/, 'gestionnaire DELETE exporté');
        assert.doesNotMatch(svc, /from\(\s*['"]ticket_categories['"]\s*\)\s*\.(update|insert)\(/,
            'lib/events/event.service.ts : plus d’écriture directe dans ticket_categories hors RPC');
    });
});
