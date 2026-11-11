/**
 * Lot 5, tâche 5.3 — visibilité publique selon le statut (constats R28, events-cdc-2, events-cdc-11,
 * client-ux-4). Contrat : section E (et D7 pour la fin d'un événement).
 *  - GET /api/events/[id] : BROUILLON, EN_ATTENTE et VALIDE → 404 pour tous ; PUBLIE, SUSPENDU, ANNULE et
 *    TERMINE → 200 avec `purchasable` (PUBLIE et vente ouverte) et `banner` (null, ou { kind, title,
 *    message } pour SUSPENDU, ANNULE, TERMINE) ; pour ANNULE, `cancellation: { publicNotice, cancelledAt,
 *    refundInfo }` sans le motif interne ; catégories limitées à is_active AND is_visible ;
 *  - GET /api/events (catalogue, accueil) : PUBLIE dont la fin (event_end_at) est à venir seulement ; prix
 *    « à partir de » sur les catégories actives ET visibles ; sans catégorie achetable : sans prix,
 *    « Bientôt en vente », jamais « Gratuit » ;
 *  - page publique app/events/[id]/page.tsx : bandeau StatusBanner selon le statut, module d'achat masqué
 *    hors purchasable.
 * Champs lus : `event.purchasable`, `event.banner`, `event.cancellation`, `event.categories` de la fiche
 * (forme actuelle { event }), et `events[]` du catalogue (`id`, `price`).
 * Rouge avant correctif :
 *  - app/api/events/[id]/route.ts lit l'événement en service_role sans filtre de statut (l.48) : BROUILLON,
 *    EN_ATTENTE et VALIDE répondent 200 ; ni purchasable, ni banner, ni cancellation (l.169-213) ; les
 *    catégories inactives restent listées en CLOSED (filtre is_visible seul, l.93) ;
 *  - app/api/events/route.ts garde PUBLIE (l.40) sans exclure les événements passés, calcule le prix sur
 *    is_active seul (l.58, masquées comprises) et vaut 0, « Gratuit », sans catégorie (l.61, 78) ;
 *  - app/events/[id]/page.tsx ne lit jamais le statut : aucun bandeau, module d'achat toujours affiché
 *    (l.845) ; components/ui/StatusBanner.tsx n'existe pas ;
 *  - createEventInStatus échoue avant tout (RPC event_transition et event_cancel absentes).
 * La suite crée son partenaire et ses événements.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { importModule, type CategorySpec } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { createEventInStatus, shiftEventDates, type AdvanceOptions, type DraftEvent, type DraftEventOptions, type EventStatus } from './cycle-helpers';

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
interface Reply { status: number; body: Record<string, unknown> }
type Row = Record<string, unknown>;

const CATS: CategorySpec[] = [{ name: 'Standard', price: 5000, total: 30 }];
const RAW_STATUS = /\b(BROUILLON|EN_ATTENTE|VALIDE|PUBLIE|SUSPENDU|TERMINE|ANNULE)\b/;

let owner: TestPartner;

before(async () => {
    owner = await newPartner('cyclevis');
});

after(async () => {
    await assertLifecycleInvariants('cycle-visibilite');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function eventIn(label: string, target: EventStatus, opts: DraftEventOptions & AdvanceOptions = {}, categories: CategorySpec[] = CATS): Promise<DraftEvent> {
    return createEventInStatus(owner, label, categories, target, { startsInHours: 48, ...opts });
}

function routeCtx<T extends Record<string, string>>(params: T): { params: Promise<T> & T } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

async function loadGet(rel: string): Promise<Handler> {
    let mod: Record<string, unknown>;
    try {
        mod = await importModule(rel);
    } catch (err) {
        assert.fail(`route ${rel} absente : ${err instanceof Error ? err.message : String(err)}`);
    }
    assert.equal(typeof mod.GET, 'function', `${rel} : GET non exporté`);
    return mod.GET as Handler;
}

async function read(handler: Handler, req: NextRequest, ctx?: unknown): Promise<Reply> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Record<string, unknown>;
    try {
        body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

function show(r: Reply): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 700)}`;
}

/** Fiche publique, sans session (comme un visiteur anonyme). */
async function publicEvent(eventId: string): Promise<Reply> {
    const h = await loadGet('../../app/api/events/[id]/route');
    return read(h, jsonRequest(`/api/events/${eventId}`, 'GET', null), routeCtx({ id: eventId }));
}

/** Fiche publique attendue en 200 : renvoie l'objet `event`. */
async function publicSheet(eventId: string, label: string): Promise<Row> {
    const r = await publicEvent(eventId);
    assert.equal(r.status, 200, `${label} : fiche publique attendue, ${show(r)}`);
    assert.ok(r.body.event && typeof r.body.event === 'object', `${label} : objet event, ${show(r)}`);
    return r.body.event as Row;
}

async function catalog(): Promise<Row[]> {
    const h = await loadGet('../../app/api/events/route');
    const r = await read(h, jsonRequest('/api/events', 'GET', null));
    assert.equal(r.status, 200, `catalogue : ${show(r)}`);
    assert.ok(Array.isArray(r.body.events), `catalogue : events[] attendu, ${show(r)}`);
    return r.body.events as Row[];
}

function assertBanner(e: Row, kind: 'SUSPENDU' | 'ANNULE' | 'TERMINE', label: string): void {
    const b = e.banner as Row | null | undefined;
    assert.ok(b && typeof b === 'object', `${label} : bandeau attendu, reçu ${JSON.stringify(e.banner)}`);
    assert.equal(b.kind, kind, `${label} : bandeau ${kind}, reçu ${JSON.stringify(b)}`);
    assert.ok(typeof b.title === 'string' && b.title.trim().length > 0, `${label} : titre du bandeau, reçu ${JSON.stringify(b)}`);
    assert.ok(typeof b.message === 'string' && b.message.trim().length > 0, `${label} : message du bandeau, reçu ${JSON.stringify(b)}`);
    assert.doesNotMatch(`${b.title} ${b.message}`, RAW_STATUS, `${label} : aucun statut brut dans le texte du bandeau`);
}

function categoryNames(e: Row): string[] {
    assert.ok(Array.isArray(e.categories), `catégories attendues : ${JSON.stringify(e.categories)}`);
    return (e.categories as Row[]).map((c) => String(c.name)).sort();
}

function hoursSinceDakarMidnight(): number {
    const now = new Date();
    return (now.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 3600_000;
}

/** Retire les commentaires d'un source TS/TSX (blocs, y compris ceux du JSX, et lignes ; les URL « http:// » sont conservées). */
function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

// ── Fiche publique ─────────────────────────────────────────────────────────

describe('5.3 Fiche publique GET /api/events/[id]', () => {
    test('BROUILLON, EN_ATTENTE et VALIDE → 404, sans rien divulguer', async () => {
        for (const status of ['BROUILLON', 'EN_ATTENTE', 'VALIDE'] as const) {
            const ev = await eventIn(`nonpublic-${status.toLowerCase()}`, status);
            const r = await publicEvent(ev.eventId);
            assert.equal(r.status, 404, `${status} : 404 attendu, ${show(r)}`);
            assert.equal(r.body.event, undefined, `${status} : aucune fiche servie`);
            assert.ok(!JSON.stringify(r.body).includes(ev.title), `${status} : le titre ne fuit pas`);
            assert.equal(typeof r.body.error, 'string', `${status} : message d’erreur, ${show(r)}`);
        }
    });

    test('PUBLIE : fiche normale, purchasable true, aucun bandeau', async () => {
        const ev = await eventIn('publie', 'PUBLIE');
        const e = await publicSheet(ev.eventId, 'PUBLIE');
        assert.equal(e.purchasable, true, `PUBLIE en vente : purchasable, reçu ${JSON.stringify(e.purchasable)}`);
        assert.equal(e.banner, null, `PUBLIE : banner null, reçu ${JSON.stringify(e.banner)}`);
        assert.deepEqual(categoryNames(e), ['Standard']);
    });

    test('PUBLIE dont la vente est close → purchasable false, aucun bandeau', async () => {
        const closed = new Date(Date.now() - 3600_000).toISOString();
        const ev = await eventIn('venteclose', 'PUBLIE', {}, [{ name: 'Standard', price: 5000, total: 30, saleEnd: closed }]);
        const e = await publicSheet(ev.eventId, 'PUBLIE, vente close');
        assert.equal(e.purchasable, false, `vente close : purchasable false, reçu ${JSON.stringify(e.purchasable)}`);
        assert.equal(e.banner, null, `PUBLIE : banner null, reçu ${JSON.stringify(e.banner)}`);
    });

    test('SUSPENDU : 200 avec bandeau, purchasable false', async () => {
        const ev = await eventIn('suspendu', 'SUSPENDU', { suspendReason: 'Vérification des autorisations' });
        const e = await publicSheet(ev.eventId, 'SUSPENDU');
        assertBanner(e, 'SUSPENDU', 'SUSPENDU');
        assert.equal(e.purchasable, false, `SUSPENDU : purchasable false, reçu ${JSON.stringify(e.purchasable)}`);
    });

    test('ANNULE : 200 avec bandeau, avis public, date et information de remboursement, sans motif interne, purchasable false', async () => {
        const NOTICE = `Le concert est annulé, chaque acheteur est remboursé (${Date.now()}).`;
        const SECRET = `Différend avec le gérant de la salle ${randomUUID()}`;
        const ev = await eventIn('annule', 'ANNULE', { publicNotice: NOTICE, internalReason: SECRET });
        const r = await publicEvent(ev.eventId);
        assert.equal(r.status, 200, `ANNULE : ${show(r)}`);
        assert.ok(!JSON.stringify(r.body).includes(SECRET), `ANNULE : le motif interne ne fuit pas, ${show(r)}`);
        assert.ok(!/internal_?reason/i.test(JSON.stringify(r.body)), 'ANNULE : aucun champ de motif interne');
        const e = r.body.event as Row;
        assertBanner(e, 'ANNULE', 'ANNULE');
        assert.equal(e.purchasable, false, `ANNULE : purchasable false, reçu ${JSON.stringify(e.purchasable)}`);
        const c = e.cancellation as Row | undefined;
        assert.ok(c && typeof c === 'object', `ANNULE : cancellation attendu, reçu ${JSON.stringify(e.cancellation)}`);
        assert.equal(c.publicNotice, NOTICE, 'avis public de event_cancellations');
        assert.ok(!Number.isNaN(Date.parse(String(c.cancelledAt))), `date d’annulation lisible : ${JSON.stringify(c.cancelledAt)}`);
        assert.ok(c.refundInfo !== null && c.refundInfo !== undefined && !['""', '{}', '[]'].includes(JSON.stringify(c.refundInfo)),
            `information de remboursement : ${JSON.stringify(c.refundInfo)}`);
    });

    test('TERMINE : 200 en archive, bandeau, purchasable false', async () => {
        const ev = await eventIn('termine', 'TERMINE', { finishShift: { startsInHours: -3 } });
        const e = await publicSheet(ev.eventId, 'TERMINE');
        assertBanner(e, 'TERMINE', 'TERMINE');
        assert.equal(e.purchasable, false, `TERMINE : purchasable false, reçu ${JSON.stringify(e.purchasable)}`);
    });

    test('catégories inactives ou masquées absentes de la fiche', async () => {
        const ev = await eventIn('categories', 'PUBLIE', {}, [
            { name: 'Ouverte', price: 5000, total: 30 },
            { name: 'Masquée', price: 3000, total: 10, isVisible: false },
            { name: 'Fermée', price: 2000, total: 10, isActive: false },
        ]);
        const e = await publicSheet(ev.eventId, 'catégories');
        assert.deepEqual(categoryNames(e), ['Ouverte'], `seules les catégories actives et visibles : ${JSON.stringify(e.categories)}`);
        assert.ok(!JSON.stringify(e).includes('Masquée') && !JSON.stringify(e).includes('Fermée'), 'aucune trace des catégories retirées');
    });
});

// ── Catalogue ──────────────────────────────────────────────────────────────

describe('5.3 Catalogue GET /api/events', () => {
    test('seulement les PUBLIE à venir : passés, suspendus, annulés, terminés et non publics exclus ; en cours inclus', async () => {
        const future = await eventIn('cat-avenir', 'PUBLIE');
        const running = await eventIn('cat-encours', 'PUBLIE');
        await shiftEventDates(running.eventId, { startsInHours: -1, durationHours: 4 });
        const past = await eventIn('cat-passe', 'PUBLIE');
        await shiftEventDates(past.eventId, { startsInHours: -6, durationHours: 3 });
        const pastNoEnd = await eventIn('cat-veille', 'PUBLIE');
        await shiftEventDates(pastNoEnd.eventId, { startsInHours: -(hoursSinceDakarMidnight() + 7), durationHours: null }); // lot 9 bis (R16, T44) : veille 17:00, fin 23:00
        const excluded: Array<[string, DraftEvent]> = [
            ['PUBLIE fini il y a 3 h', past],
            ['PUBLIE sans fin, commencé la veille à 17:00 (fin à début + 6 h, la veille à 23:00)', pastNoEnd],
            ['SUSPENDU', await eventIn('cat-suspendu', 'SUSPENDU')],
            ['ANNULE', await eventIn('cat-annule', 'ANNULE')],
            ['TERMINE', await eventIn('cat-termine', 'TERMINE', { finishShift: { startsInHours: -3 } })],
            ['VALIDE', await eventIn('cat-valide', 'VALIDE')],
            ['EN_ATTENTE', await eventIn('cat-attente', 'EN_ATTENTE')],
            ['BROUILLON', await eventIn('cat-brouillon', 'BROUILLON')],
        ];
        const ids = (await catalog()).map((e) => String(e.id));
        assert.ok(ids.includes(future.eventId), 'PUBLIE à venir présent');
        assert.ok(ids.includes(running.eventId), 'PUBLIE en cours (fin à venir) présent');
        for (const [label, ev] of excluded) assert.ok(!ids.includes(ev.eventId), `${label} absent du catalogue`);
    });

    test('prix « à partir de » calculé sur les catégories actives ET visibles', async () => {
        const ev = await eventIn('cat-prix', 'PUBLIE', {}, [
            { name: 'Catégorie masquée', price: 1000, total: 10, isVisible: false },
            { name: 'Catégorie fermée', price: 2000, total: 10, isActive: false },
            { name: 'Normale', price: 8000, total: 30 },
            { name: 'Carré or', price: 15_000, total: 10 },
        ]);
        const entry = (await catalog()).find((e) => e.id === ev.eventId);
        assert.ok(entry, 'événement présent au catalogue');
        assert.equal(Number(entry.price), 8000, `prix « à partir de » = 8 000 F (ni la masquée à 1 000 F, ni la fermée à 2 000 F) : ${JSON.stringify(entry)}`);
        const text = JSON.stringify(entry);
        assert.ok(!text.includes('Catégorie masquée') && !text.includes('Catégorie fermée'), `aucune catégorie retirée exposée : ${text}`);
    });

    test('jamais « Gratuit » sans catégorie achetable : sans prix, « Bientôt en vente » ; témoin : catégorie gratuite achetable → 0 F', async () => {
        const hidden = await eventIn('cat-bientot', 'PUBLIE', {}, [{ name: 'Réservée', price: 3000, total: 10, isVisible: false }]);
        const free = await eventIn('cat-gratuit', 'PUBLIE', {}, [{ name: 'Entrée libre', price: 0, total: 50 }]);
        const list = await catalog();
        const entry = list.find((e) => e.id === hidden.eventId);
        assert.ok(entry, 'événement sans catégorie achetable affiché au catalogue');
        assert.ok(entry.price === null || entry.price === undefined, `sans prix, reçu ${JSON.stringify(entry.price)}`);
        const text = JSON.stringify(entry);
        assert.ok(!text.includes('Gratuit'), `jamais « Gratuit » : ${text}`);
        assert.ok(text.includes('Bientôt en vente'), `« Bientôt en vente » : ${text}`);
        // Garde-fou (vert avant correctif) : un événement réellement gratuit garde son prix de 0 F.
        const freeEntry = list.find((e) => e.id === free.eventId);
        assert.ok(freeEntry, 'événement gratuit présent');
        assert.equal(Number(freeEntry.price), 0, `catégorie gratuite achetable : 0 F, reçu ${JSON.stringify(freeEntry)}`);
    });
});

// ── Page publique ──────────────────────────────────────────────────────────

describe('5.3 Page publique app/events/[id] (contrôle statique)', () => {
    test('bandeau StatusBanner selon le statut et module d’achat masqué hors purchasable', () => {
        assert.ok(fs.existsSync(path.join('components', 'ui', 'StatusBanner.tsx')), 'components/ui/StatusBanner.tsx (contrat Q)');
        const src = stripComments(fs.readFileSync(path.join('app', 'events', '[id]', 'page.tsx'), 'utf8'));
        assert.match(src, /import\s+(?:\{[^}]*\bStatusBanner\b[^}]*\}|StatusBanner)\s+from\s+['"]@\/components\/ui(?:\/StatusBanner)?['"]/,
            'StatusBanner importé de components/ui');
        assert.match(src, /<StatusBanner\b/, 'StatusBanner rendu par la page');
        assert.match(src, /\.banner\b/, 'bandeau alimenté par le champ banner de la fiche');
        assert.match(src, /\.purchasable\b/, 'la page lit purchasable');
        assert.match(src, /\.purchasable\b[^;\n]*(?:&&|\?)|(?:&&|\?|!|\|\|)\s*\(?\s*[\w?.]*\.purchasable\b/,
            'module d’achat rendu sous condition de purchasable');
    });
});
