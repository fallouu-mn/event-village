/**
 * Lot 5, tâches 5.11 (liste des événements du partenaire : partner-ux-4, -8, -16) et 5.8 (annulation dans
 * l'interface : events-cdc-9, partner-ux-2). Contrat : sections H, J, D5, D6 et I (définitions des chiffres).
 *  - RPC partner_events_overview({ actor_id }) et GET /api/partner/events/overview :
 *    { counts: {par statut}, totals: { events, tickets_sold, revenue_online, revenue_cash } } calculés sur
 *    TOUS les événements du partenaire, quel que soit le filtre de la liste ; comparés à la vérité en base
 *    (requêtes SQL indépendantes) sur un partenaire dédié qui a un événement dans chacun des 7 statuts,
 *    des ventes en ligne (PUBLIE, puis SUSPENDU et TERMINE après ventes) et une vente en espèces ;
 *    définitions reprises de la section I : vendus = billets VALIDE et UTILISE hors invitations ; CA en
 *    ligne = prix faciaux des billets payés en ligne non remboursés ; CA espèces = paiements hors
 *    plateforme SUCCESS ;
 *  - GET /api/partner/events?status=ANNULE renvoie les annulés ; statut inconnu → 400 avec code ;
 *  - app/partner/events/page.tsx (statique) : StatusBadge du contrat, onglets Tabs avec « Annulé » et
 *    compteurs, actions issues de event_actions (soumettre, retirer, publier par …/transition ; piloter ;
 *    modifier selon can_edit ; annuler selon can_cancel), motif affiché (StatusBanner ou Callout), états
 *    chargement, vide et erreur avec « Réessayer », plus aucun calcul d'indicateurs dans le navigateur ;
 *  - 5.8 (statique) : la liste, le pilotage (app/partner/events/[id]/page.tsx) et la fiche admin
 *    (app/admin/events/[id]/page.tsx) rendent une ConfirmDialog avec requireText (titre retapé), qui
 *    affiche l'impact (GET …/cancellation) et envoie publicNotice, internalReason et confirmTitle à
 *    …/cancel ; le pilotage et la fiche admin montrent l'avancement des remboursements (versés, en cours,
 *    en vérification ; « à reprendre » pour l'admin).
 * Les contrôles statiques suivent les imports locaux de la page (app/, components/ hors ui, hooks/) : un
 * composant extrait de la page compte comme la page.
 *
 * Rouge avant correctif :
 *  - RPC partner_events_overview et route app/api/partner/events/overview/route.ts absentes ;
 *    createEventInStatus / advanceEventTo (cycle-helpers) échouent : RPC event_transition et event_cancel
 *    absentes ; colonne tickets.sale_channel absente (vérité en base) ;
 *  - app/api/partner/events/route.ts:21-24 passe ?status= tel quel à Postgres : un statut inconnu donne
 *    500 avec l'erreur d'enum brute ;
 *  - app/partner/events/page.tsx : indicateurs calculés dans le navigateur sur la liste filtrée
 *    (l.162-172, Σ sold_quantity) ; onglets bruts sans ANNULE ni Tabs (l.255-266, type l.37) ;
 *    StatusBadge de components/ui/Badge.tsx:51-146 (enum en majuscules) ; transitions codées en dur vers
 *    …/status (l.92-131) ; ni Piloter ni Annuler (l.390-482) ; aucun motif ; erreur avalée (l.69-78,
 *    console.error) sans « Réessayer » ; ConfirmDialog sans requireText (l.489-498) ;
 *  - app/partner/events/[id]/page.tsx et app/admin/events/[id]/page.tsx absents ; EventCancelModal
 *    (components/events/EventCancelModal.tsx) n'est importé nulle part et n'exige pas le titre.
 * Garde-fou (vert sur le code actuel, rouge seulement par la mise en place) : le filtre ?status=ANNULE
 * de GET /api/partner/events (lib/events/event.service.ts:196-198 filtre déjà tout statut).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { importModule, newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { authed, newController, openShift, withAccessSettings } from './acces-helpers';
import { advanceEventTo, createDraftEvent, createEventInStatus, EVENT_STATUSES, type DraftEvent, type EventStatus } from './cycle-helpers';

const PRICE = 5000;
const CASH_PRICE = 3000;
const CATS: CategorySpec[] = [
    { name: 'Standard', price: PRICE, total: 50 },
    { name: 'Sur place', price: CASH_PRICE, total: 20 },
];

const OVERVIEW_ROUTE = '../../app/api/partner/events/overview/route';
const LIST_ROUTE = '../../app/api/partner/events/route';

after(async () => {
    await assertLifecycleInvariants('partenaire-liste');
});

// ── Outils ─────────────────────────────────────────────────────────────────

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

interface RouteResult {
    status: number;
    body: Record<string, unknown>;
}

async function callRoute(modulePath: string, req: NextRequest): Promise<RouteResult> {
    const mod = await importModule(modulePath);
    const handler = mod.GET as Handler | undefined;
    assert.equal(typeof handler, 'function', `${modulePath} : pas de handler GET`);
    const res = await handler!(req);
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

function findDeep(node: unknown, pred: (o: Record<string, unknown>) => boolean, depth = 0): Record<string, unknown> | null {
    if (depth > 6 || node === null || typeof node !== 'object') return null;
    if (!Array.isArray(node) && pred(node as Record<string, unknown>)) return node as Record<string, unknown>;
    for (const v of Array.isArray(node) ? node : Object.values(node as Record<string, unknown>)) {
        const hit = findDeep(v, pred, depth + 1);
        if (hit) return hit;
    }
    return null;
}

interface Overview {
    counts: Record<string, unknown>;
    totals: { events?: unknown; tickets_sold?: unknown; revenue_online?: unknown; revenue_cash?: unknown };
}

function asOverview(body: unknown, what: string): Overview {
    const o = findDeep(body, (x) => !!x.counts && typeof x.counts === 'object' && !!x.totals && typeof x.totals === 'object');
    assert.ok(o, `${what} : { counts, totals } introuvable (${JSON.stringify(body).slice(0, 400)})`);
    return o as unknown as Overview;
}

async function rpcOverview(actorId: string): Promise<Record<string, unknown>> {
    const { data, error } = await service.rpc('partner_events_overview', { p: { actor_id: actorId } });
    assert.equal(error, null, `partner_events_overview : ${error?.message} (code ${error?.code})`);
    assert.ok(data && typeof data === 'object', 'partner_events_overview : réponse vide');
    return data as Record<string, unknown>;
}

interface Truth {
    counts: Record<string, number>;
    events: number;
    ticketsSold: number;
    revenueOnline: number;
    revenueCash: number;
}

/** Vérité en base, par des requêtes indépendantes de la RPC (définitions de la section I). */
async function truthFor(partnerId: string): Promise<Truth> {
    return inspect(async (db) => {
        const counts: Record<string, number> = {};
        for (const s of EVENT_STATUSES) counts[s] = 0;
        const byStatus = await db.query<{ status: string; n: number }>(
            'SELECT status::text AS status, count(*)::int AS n FROM public.events WHERE partner_id = $1 GROUP BY 1', [partnerId]);
        for (const r of byStatus.rows) counts[r.status] = Number(r.n);
        const sold = await db.query<{ n: number }>(
            `SELECT count(*)::int AS n FROM public.tickets t JOIN public.events e ON e.id = t.event_id
              WHERE e.partner_id = $1 AND t.status IN ('VALIDE', 'UTILISE') AND t.sale_channel IS DISTINCT FROM 'INVITATION'`, [partnerId]);
        const online = await db.query<{ total: string }>(
            `SELECT coalesce(sum(t.price), 0)::text AS total FROM public.tickets t
               JOIN public.events e ON e.id = t.event_id JOIN public.payments p ON p.id = t.payment_id
              WHERE e.partner_id = $1 AND t.status IN ('VALIDE', 'UTILISE') AND p.is_platform_payment AND p.status = 'SUCCESS'`, [partnerId]);
        const cash = await db.query<{ total: string }>(
            `SELECT coalesce(sum(p.amount), 0)::text AS total FROM public.payments p
              WHERE NOT p.is_platform_payment AND p.status = 'SUCCESS'
                AND p.id IN (SELECT t.payment_id FROM public.tickets t JOIN public.events e ON e.id = t.event_id
                              WHERE e.partner_id = $1 AND t.payment_id IS NOT NULL)`, [partnerId]);
        return {
            counts,
            events: Object.values(counts).reduce((a, b) => a + b, 0),
            ticketsSold: Number(sold.rows[0].n),
            revenueOnline: Number(online.rows[0].total),
            revenueCash: Number(cash.rows[0].total),
        };
    });
}

function assertOverview(o: Overview, truth: Truth, label: string): void {
    for (const s of EVENT_STATUSES) assert.equal(Number(o.counts[s] ?? 0), truth.counts[s], `${label} : counts.${s} = ${String(o.counts[s])}, vérité ${truth.counts[s]}`);
    assert.equal(Number(o.totals.events), truth.events, `${label} : totals.events`);
    assert.equal(Number(o.totals.tickets_sold), truth.ticketsSold, `${label} : totals.tickets_sold`);
    assert.equal(Number(o.totals.revenue_online), truth.revenueOnline, `${label} : totals.revenue_online`);
    assert.equal(Number(o.totals.revenue_cash), truth.revenueCash, `${label} : totals.revenue_cash`);
}

async function listRoute(who: Buyer | null, status?: string): Promise<RouteResult> {
    return callRoute(LIST_ROUTE, jsonRequest(`/api/partner/events${status ? `?status=${encodeURIComponent(status)}` : ''}`, 'GET', who ? who.accessToken : null));
}

function listItems(r: RouteResult, what: string): Array<Record<string, unknown>> {
    assert.equal(r.status, 200, `${what} : ${show(r)}`);
    const items = (r.body.events ?? r.body.items) as unknown;
    assert.ok(Array.isArray(items), `${what} : ni events ni items (${show(r)})`);
    return items as Array<Record<string, unknown>>;
}

/**
 * Lot 9 (A16) : la vente en espèces passe par le guichet. counter_sale exige un contrôleur affecté (NOT_ASSIGNED sinon) :
 * contrôleur, caisse ouverte, puis un billet « Sur place » vendu, réglé en espèces et composté dans la même transaction.
 */
async function cashSale(p: TestPartner, ev: DraftEvent): Promise<void> {
    const seller = await newController(p, ev.eventId, { canAcceptCash: true, label: 'liste-guichet' });
    const shift = await openShift(seller, ev.eventId);
    assert.equal(shift.status, 200, `ouverture de caisse : HTTP ${shift.status} ${JSON.stringify(shift.body)}`);
    const sold = await withAccessSettings({ 'access.counter_sale_enabled': true }, async () => {
        const mod = await importModule('../../app/api/controller/counter-sale/route');
        const res = await (mod.POST as Handler)(authed('/api/controller/counter-sale', 'POST', seller,
            { eventId: ev.eventId, items: [{ categoryId: ev.categories['Sur place'].id, quantity: 1 }] },
            { 'idempotency-key': randomUUID() }));
        const text = await res.text();
        return { status: res.status, body: JSON.parse(text) as Record<string, unknown> };
    });
    assert.equal(sold.status, 200, `vente au guichet : HTTP ${sold.status} ${JSON.stringify(sold.body)}`);
    assert.equal(sold.body.ok, true, `vente au guichet : ${JSON.stringify(sold.body)}`);
}

// ── 5.11 : indicateurs sur tous les événements ─────────────────────────────

describe('5.11 — partner_events_overview : indicateurs calculés sur TOUS les événements', () => {
    let partner: TestPartner;
    let other: TestPartner;
    let client: Buyer;
    const byStatus = {} as Record<EventStatus, DraftEvent>;

    before(async () => {
        partner = await newPartner('liste');
        other = await newPartner('liste-autre');
        client = await newBuyer('liste-client');
        const buyer = await newBuyer('liste-acheteur');

        byStatus.BROUILLON = await createDraftEvent(partner, 'liste BROUILLON', CATS);
        byStatus.EN_ATTENTE = await createEventInStatus(partner, 'liste EN_ATTENTE', CATS, 'EN_ATTENTE');
        byStatus.VALIDE = await createEventInStatus(partner, 'liste VALIDE', CATS, 'VALIDE');
        byStatus.PUBLIE = await createEventInStatus(partner, 'liste PUBLIE', CATS, 'PUBLIE');
        await buyConfirmed(buyer, byStatus.PUBLIE, [['Standard', 2]]);
        await cashSale(partner, byStatus.PUBLIE);
        byStatus.SUSPENDU = await createEventInStatus(partner, 'liste SUSPENDU', CATS, 'PUBLIE');
        await buyConfirmed(buyer, byStatus.SUSPENDU, [['Standard', 1]]);
        await advanceEventTo(byStatus.SUSPENDU.eventId, 'SUSPENDU');
        byStatus.TERMINE = await createEventInStatus(partner, 'liste TERMINE', CATS, 'PUBLIE');
        await buyConfirmed(buyer, byStatus.TERMINE, [['Standard', 1]]);
        await advanceEventTo(byStatus.TERMINE.eventId, 'TERMINE', { finishShift: { startsInHours: -3 } });
        byStatus.ANNULE = await createEventInStatus(partner, 'liste ANNULE', CATS, 'ANNULE', { cancelFrom: 'VALIDE' });

        const otherEv = await createEventInStatus(other, 'liste autre PUBLIE', CATS, 'PUBLIE');
        await buyConfirmed(buyer, otherEv, [['Standard', 3]]);
    });

    test('RPC : counts par statut et totaux = vérité en base = jeu de données connu (1 événement par statut, 5 vendus, 20 000 F en ligne, 3 000 F espèces)', async () => {
        const truth = await truthFor(partner.partnerId);
        for (const s of EVENT_STATUSES) assert.equal(truth.counts[s], 1, `jeu de données : un événement ${s}`);
        assert.equal(truth.ticketsSold, 5, 'jeu de données : 2 + 1 (espèces) + 1 + 1 billets vendus');
        assert.equal(truth.revenueOnline, 4 * PRICE, 'jeu de données : 4 billets en ligne');
        assert.equal(truth.revenueCash, CASH_PRICE, 'jeu de données : 1 billet en espèces');
        const body = await rpcOverview(partner.userId);
        assert.notEqual(body.ok, false, `partner_events_overview refusé : ${JSON.stringify(body)}`);
        assertOverview(asOverview(body, 'RPC'), truth, 'RPC');
    });

    test('route GET /api/partner/events/overview : mêmes chiffres, insensibles au filtre de la liste ; la liste filtrée PUBLIE ne contient qu’un événement', async () => {
        const truth = await truthFor(partner.partnerId);
        for (const qs of ['', '?status=PUBLIE', '?status=ANNULE&search=introuvable']) {
            const r = await callRoute(OVERVIEW_ROUTE, jsonRequest(`/api/partner/events/overview${qs}`, 'GET', partner.accessToken));
            assert.equal(r.status, 200, `overview${qs} : ${show(r)}`);
            assertOverview(asOverview(r.body, `overview${qs}`), truth, `overview${qs}`);
        }
        const filtered = listItems(await listRoute(partner, 'PUBLIE'), '?status=PUBLIE');
        assert.deepEqual(filtered.map((i) => i.id), [byStatus.PUBLIE.eventId], '?status=PUBLIE : seul l’événement publié');
    });

    test('isolation : les indicateurs d’un autre partenaire ne comptent pas ses événements ; un client ne lit rien', async () => {
        const truthOther = await truthFor(other.partnerId);
        assert.equal(truthOther.events, 1, 'jeu de données : l’autre partenaire a un événement');
        assertOverview(asOverview(await rpcOverview(other.userId), 'RPC autre partenaire'), truthOther, 'autre partenaire');
        const asClient = await rpcOverview(client.userId);
        if (asClient.ok !== false) {
            const o = asOverview(asClient, 'RPC client');
            assert.equal(Number(o.totals.events ?? 0), 0, `client : aucun événement compté (${JSON.stringify(asClient)})`);
        }
        const noSession = await callRoute(OVERVIEW_ROUTE, jsonRequest('/api/partner/events/overview', 'GET', null));
        assert.equal(noSession.status, 401, `sans session : ${show(noSession)}`);
        const r = await callRoute(OVERVIEW_ROUTE, jsonRequest('/api/partner/events/overview', 'GET', client.accessToken));
        assert.ok(r.status === 401 || r.status === 403, `client : ${show(r)}`);
    });

    test('garde-fou : GET /api/partner/events?status=ANNULE renvoie les annulés, sans statut tous les événements', async () => {
        const cancelled = listItems(await listRoute(partner, 'ANNULE'), '?status=ANNULE');
        assert.deepEqual(cancelled.map((i) => i.id), [byStatus.ANNULE.eventId], '?status=ANNULE');
        assert.ok(cancelled.every((i) => i.status === 'ANNULE'), '?status=ANNULE : statuts');
        const all = listItems(await listRoute(partner), 'sans statut');
        assert.deepEqual(all.map((i) => String(i.id)).sort(), Object.values(byStatus).map((e) => e.eventId).sort(), 'sans statut : les 7 événements');
    });

    test('GET /api/partner/events : statut inconnu → 400 avec code, jamais l’erreur Postgres', async () => {
        const r = await listRoute(partner, 'PUBLISHED');
        assert.equal(r.status, 400, `?status=PUBLISHED : ${show(r)}`);
        assert.equal(typeof r.body.code, 'string', `?status=PUBLISHED : code absent (${show(r)})`);
        assert.doesNotMatch(String(r.body.error ?? ''), /invalid input value|enum/i, `?status=PUBLISHED : erreur Postgres brute (${show(r)})`);
    });
});

// ── Contrôles statiques ────────────────────────────────────────────────────

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

/** Contenu JSX d'un enfant `{x.status}` ou `{status}` rendu tel quel. */
function rawStatusChildren(files: string[]): string[] {
    const out: string[] = [];
    for (const file of files) {
        const sf = sourceOf(file);
        const visit = (node: ts.Node): void => {
            if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
                const e = node.expression;
                if ((ts.isPropertyAccessExpression(e) && e.name.text === 'status') || (ts.isIdentifier(e) && /^(status|tab|selectedStatus)$/.test(e.text))) {
                    out.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1} ${node.getText(sf)}`);
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sf);
    }
    return out;
}

const LIST_PAGE = 'app/partner/events/page.tsx';
const PILOTAGE_PAGE = 'app/partner/events/[id]/page.tsx';
const ADMIN_FICHE_PAGE = 'app/admin/events/[id]/page.tsx';
const ANNULER_RE = /Annuler l(?:'|’|&apos;|&rsquo;)événement/;

describe('5.11 — app/partner/events/page.tsx (contrôles statiques)', () => {
    test('statuts en libellés humains : StatusBadge du contrat, aucun statut brut rendu', () => {
        const files = screenFiles(LIST_PAGE);
        assertRenders(files, 'StatusBadge', LIST_PAGE);
        const legacy = files.filter((f) => bindingsOf(f).some((b) => b.imported === 'StatusBadge' && b.from === 'components/ui/Badge.tsx'));
        assert.deepEqual(legacy, [], `ancien StatusBadge (Badge.tsx, enum en majuscules) encore importé`);
        assert.deepEqual(rawStatusChildren(files), [], 'statut rendu tel quel dans le JSX');
        const code = files.map(codeOf).join('\n');
        assert.doesNotMatch(code, /statut[^`]*\$\{\s*\w*(?:status|tab)\w*\s*\}/i, 'message qui recopie l’enum du statut');
    });

    test('onglets : composant Tabs, libellés de EVENT_STATUS_META, onglet « Annulé », compteurs de l’overview', () => {
        const files = screenFiles(LIST_PAGE);
        const code = files.map(codeOf).join('\n');
        // Lot 6 (contrat A7, adaptation signalée) : onglets rendus par components/ui/ScrollableTabs, qui enveloppe Tabs ;
        // screenFiles exclut components/ui (l'ancien ScrollableTabs du dossier partenaire laissait voir Tabs).
        assertRenders(files, 'ScrollableTabs', LIST_PAGE);
        assert.ok(files.some((f) => bindingsOf(f).some((b) => b.from === 'lib/events/event-status.ts')), 'onglets sans EVENT_STATUS_META (source unique des libellés, contrat B)');
        assert.ok(/['"]ANNULE['"]/.test(code) || /Object\.(?:keys|entries)\(\s*EVENT_STATUS_META\s*\)/.test(code) || /\bEVENT_STATUSES\b/.test(code), 'pas d’onglet ANNULE');
        assert.match(code, /\bcounts\b/, 'onglets sans compteurs (counts de l’overview)');
    });

    test('actions issues de event_actions : soumettre/retirer/publier par …/transition, Piloter, Modifier (can_edit), Annuler (can_cancel)', () => {
        const files = screenFiles(LIST_PAGE);
        const code = files.map(codeOf).join('\n');
        assert.match(code, /\/api\/partner\/events\/\$\{[^}]+\}\/transition/, 'aucun appel à POST /api/partner/events/[id]/transition');
        assert.doesNotMatch(code, /\/api\/partner\/events\/\$\{[^}]+\}\/status/, 'appel à l’ancienne route …/status (supprimée)');
        assert.doesNotMatch(code, /JSON\.stringify\(\s*\{[^}]*\b(?:to|status)\s*:\s*['"][A-Z_]+['"]/, 'transition codée en dur au lieu des actions de event_actions');
        assert.match(code, /\bactions\b/, 'actions de event_actions non lues');
        assert.match(code, /can_edit|canEdit/, 'Modifier non conditionné par can_edit');
        assert.match(code, /can_cancel|canCancel/, 'Annuler non conditionné par can_cancel');
        assert.match(code, /Piloter/, 'action « Piloter » absente');
        assert.match(code, /`\/partner\/events\/\$\{[^}]+\}`/, 'aucun lien vers la page de pilotage /partner/events/[id]');
        assert.match(code, /Modifier/, 'action « Modifier » absente');
        assert.match(code, /\/partner\/events\/\$\{[^}]+\}\/edit/, 'aucun lien vers l’édition');
        assert.match(code, ANNULER_RE, 'bouton « Annuler l’événement » absent');
    });

    test('motif de refus ou de suspension affiché sur la carte (last_reason, StatusBanner ou Callout)', () => {
        const files = screenFiles(LIST_PAGE);
        const code = files.map(codeOf).join('\n');
        assert.match(code, /last_reason|lastReason/, 'motif (last_reason de event_actions) non lu');
        const banner = rendered(files, 'StatusBanner', uiComponent('StatusBanner')).length + rendered(files, 'Callout', uiComponent('Callout')).length;
        assert.ok(banner > 0, 'motif non affiché par StatusBanner ou Callout');
    });

    test('états : squelette de chargement, EmptyState, ErrorState avec onRetry (« Réessayer »)', () => {
        const files = screenFiles(LIST_PAGE);
        assert.ok(files.some((f) => bindingsOf(f).some((b) => /Skeleton$/.test(b.imported) && !!b.from?.startsWith('components/ui/'))), 'aucun squelette de chargement');
        assertRenders(files, 'EmptyState', LIST_PAGE);
        const err = assertRenders(files, 'ErrorState', LIST_PAGE);
        assert.ok(err.some((u) => u.attrs.has('onRetry')), 'ErrorState sans onRetry : l’erreur n’offre pas « Réessayer »');
    });

    test('indicateurs : KpiCard alimentés par /api/partner/events/overview, aucun calcul dans le navigateur', () => {
        const files = screenFiles(LIST_PAGE);
        const code = files.map(codeOf).join('\n');
        assertRenders(files, 'KpiCard', LIST_PAGE);
        assert.ok(/\/api\/partner\/events\/overview/.test(code) || /partner_events_overview/.test(code), 'indicateurs non lus depuis /api/partner/events/overview');
        assert.doesNotMatch(code, /sold_quantity/, 'sold_quantity lu dans le navigateur (compte les réservations, partner-ux-8)');
        const local = files.filter((f) => f.startsWith('app/partner/events/') && !f.startsWith('app/partner/events/['));
        const reducers = local.filter((f) => /\.reduce\(/.test(codeOf(f)));
        assert.deepEqual(reducers, [], 'calcul d’agrégats (.reduce) dans la page de liste');
    });
});

describe('5.8 — interface de l’annulation (contrôles statiques)', () => {
    for (const [label, page, adminPath] of [
        ['liste du partenaire', LIST_PAGE, false],
        ['pilotage', PILOTAGE_PAGE, false],
        ['fiche admin', ADMIN_FICHE_PAGE, true],
    ] as Array<[string, string, boolean]>) {
        test(`${label} (${page}) : « Annuler l’événement » ouvre une ConfirmDialog avec requireText (titre), impact, avis public, motif interne, POST …/cancel`, () => {
            assert.ok(isFile(page), `${page} absent`);
            const files = screenFiles(page);
            const code = files.map(codeOf).join('\n');
            const dialogs = assertRenders(files, 'ConfirmDialog', page).filter((u) => u.attrs.has('requireText'));
            assert.ok(dialogs.length > 0, `${page} : aucune ConfirmDialog avec requireText`);
            assert.ok(dialogs.some((u) => /title/i.test(u.attrs.get('requireText')!.getText())), `${page} : requireText n'est pas le titre de l'événement`);
            assert.match(code, ANNULER_RE, `${page} : bouton « Annuler l’événement » absent`);
            assert.match(code, /can_cancel|canCancel/, `${page} : bouton non conditionné par can_cancel`);
            const cancelRe = adminPath ? /\/api\/admin\/events\/\$\{[^}]+\}\/cancel[`'"]/ : /\/api\/partner\/events\/\$\{[^}]+\}\/cancel[`'"]/;
            assert.match(code, cancelRe, `${page} : aucun POST vers ${adminPath ? '/api/admin' : '/api/partner'}/events/[id]/cancel`);
            for (const k of ['publicNotice', 'internalReason', 'confirmTitle']) assert.match(code, new RegExp(`\\b${k}\\b`), `${page} : ${k} non envoyé`);
            assert.match(code, /\/cancellation[`'"?]/, `${page} : impact non lu (GET …/cancellation)`);
            assert.match(code, /online_refund_total|onlineRefundTotal/, `${page} : montant à rembourser non affiché`);
            assert.match(code, /\bbuyers\b/, `${page} : nombre d'acheteurs non affiché`);
        });
    }

    for (const [label, page, admin] of [
        ['pilotage', PILOTAGE_PAGE, false],
        ['fiche admin', ADMIN_FICHE_PAGE, true],
    ] as Array<[string, string, boolean]>) {
        test(`${label} (${page}) : bloc « Remboursements » (versés, en cours, en vérification${admin ? ', à reprendre' : ''})`, () => {
            assert.ok(isFile(page), `${page} absent`);
            const code = screenFiles(page).map(codeOf).join('\n');
            assert.match(code, /Remboursements/, `${page} : bloc « Remboursements » absent`);
            assert.match(code, /versés/i, `${page} : « versés » absent`);
            assert.match(code, /en cours/i, `${page} : « en cours » absent`);
            assert.match(code, /en vérification/i, `${page} : « en vérification » absent`);
            assert.match(code, /in_progress|inProgress/, `${page} : avancement in_progress non lu`);
            assert.match(code, /\bverifying\b/, `${page} : avancement verifying non lu`);
            if (admin) {
                assert.match(code, /à reprendre/i, `${page} : « à reprendre » absent`);
                assert.match(code, /to_retry|toRetry/, `${page} : avancement to_retry non lu`);
            }
        });
    }
});
