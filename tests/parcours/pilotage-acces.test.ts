/**
 * Lot 5, tâche 5.10 — page de pilotage : droits d'accès et page (contrat, sections I, O3 et Q).
 * Exigence de la consigne : « le partenaire B ne voit rien de l'événement de A ».
 *  - GET /api/partner/events/[id]/pilotage/{overview,sales,entries,team,cash,closing} et
 *    POST …/participants-export : partenaire propriétaire avec compte ACTIF → 200 ; admin → 200 ;
 *    partenaire B → 404 sans aucune donnée (et 200 sur son propre événement, témoin) ; client, même
 *    porteur d'un billet de l'événement → 403 ou 404 ; sans session → 401 ; événement inconnu → 404 ;
 *    compte du partenaire propriétaire SUSPENDU → refusé (401, 403 ou 404), sans donnée ;
 *  - participant_exports : lisible par le propriétaire (RLS : propriétaire et admins), ni par le
 *    partenaire B ni par un client ;
 *  - page app/partner/events/[id]/page.tsx (contrôles statiques, commentaires exclus, sur la page et
 *    les modules qu'elle importe sous app/partner/events/[id]/ et components/partner/) : onglets du
 *    composant partagé Tabs (Aperçu, Ventes, Entrées, Équipe, Caisse, Clôture) ; KpiCard ;
 *    useRealtimeRefresh sur ticket_scans, scan_incidents et controller_shifts ; appels des routes
 *    pilotage/* et participants-export ; aucun calcul d'agrégat dans le navigateur (ni reduce, ni
 *    filter(…).length, ni lecture directe des tables de billets, scans, paiements ou caisses, ni des
 *    anciennes routes …/shifts et …/tickets) ; les anciennes pages team et caisse redirigent vers les
 *    onglets (?tab=).
 * Jeu de données léger, propre à la suite : partenaires A, B et S, un événement PUBLIE chacun, un achat
 * en ligne et un scan sur l'événement de A.
 *
 * Rouge avant correctif :
 *  - aucune route app/api/partner/events/[id]/pilotage/* ni …/participants-export, aucune table
 *    participant_exports (aucune migration) ;
 *  - aucune page app/partner/events/[id]/page.tsx (le dossier ne contient que caisse/, edit/ et team/) ;
 *    composants KpiCard et Tabs absents de components/ui/, hook hooks/useRealtimeRefresh.ts absent
 *    (seul hooks/usePartnerOrders.ts existe) ;
 *  - app/partner/events/[id]/team/page.tsx et caisse/page.tsx sont des pages complètes (useState,
 *    team/page.tsx:49-58, caisse/page.tsx:22-33) ; la caisse calcule ses totaux par reduce et
 *    filter().length dans le navigateur (caisse/page.tsx:125-135) ;
 *  - les helpers du cycle échouent avant (RPC event_transition absente, contrat D4).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { signInAs, type SignedInUser } from '../helpers/fixtures';
import { disposeClients, signedInClient } from '../helpers/realtime';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { newController, scan, ticketPayload, type RouteResult } from './acces-helpers';
import { createEventInStatus, type DraftEvent } from './cycle-helpers';
import {
    participantsExport, PILOTAGE_TABS, pilotageGet, show, showExport, STANDARD, type ExportResult,
} from './pilotage-helpers';

let partnerA: TestPartner;
let partnerB: TestPartner;
let partnerS: TestPartner;
let evA: DraftEvent;
let evB: DraftEvent;
let evS: DraftEvent;
let client: Buyer;
let controller: Buyer;
let admin: SignedInUser;

after(async () => {
    await assertLifecycleInvariants('pilotage-acces');
});

/** Aucune donnée de l'événement de A dans une réponse refusée. */
function assertNoLeak(text: string, what: string): void {
    for (const secret of [evA.title, client.lastName, client.email, controller.email]) {
        assert.ok(!text.includes(secret), `${what} : donnée de l’événement de A dans la réponse (${secret}) : ${text.slice(0, 400)}`);
    }
}

function assertRefusal(res: RouteResult, allowed: number[], what: string): void {
    assert.ok(allowed.includes(res.status), `${what} : HTTP ${allowed.join(' ou ')} attendu, ${show(res)}`);
    assert.equal(typeof res.body.error, 'string', `${what} : message d’erreur { error, code } attendu, ${show(res)}`);
    for (const key of ['tickets', 'entries', 'revenue', 'by_category', 'by_scanner', 'controllers', 'shifts', 'absents', 'z', 'finance']) {
        assert.equal(res.body[key], undefined, `${what} : aucune donnée (${key}) dans un refus, ${show(res)}`);
    }
    assertNoLeak(JSON.stringify(res.body), what);
}

function assertExportRefused(res: ExportResult, allowed: number[], what: string): void {
    assert.ok(allowed.includes(res.status), `${what} : HTTP ${allowed.join(' ou ')} attendu, ${showExport(res)}`);
    assert.ok(!/text\/csv/i.test(res.contentType), `${what} : aucun fichier CSV servi (${res.contentType})`);
    assertNoLeak(res.text, what);
}

describe('5.10 Isolation : le partenaire B ne voit rien de l’événement de A', () => {
    before(async () => {
        partnerA = await newPartner('pil-acces-a');
        partnerB = await newPartner('pil-acces-b');
        partnerS = await newPartner('pil-acces-s');
        const cats = [{ name: STANDARD, price: 3_000, total: 20 }];
        evA = await createEventInStatus(partnerA, 'pilotage-acces-a', cats, 'PUBLIE', { startsInHours: 2 });
        evB = await createEventInStatus(partnerB, 'pilotage-acces-b', cats, 'PUBLIE', { startsInHours: 2 });
        evS = await createEventInStatus(partnerS, 'pilotage-acces-s', cats, 'PUBLIE', { startsInHours: 2 });
        client = await newBuyer('pil-acces-client', { firstName: 'Bineta', lastName: 'Thiam' });
        const { tickets } = await buyConfirmed(client, evA, [[STANDARD, 1]]);
        controller = await newController(partnerA, evA.eventId, { label: 'pil-acces' });
        const res = await scan(controller, { eventId: evA.eventId, payload: await ticketPayload(String(tickets[0].id)) });
        assert.equal(res.body.result, 'valid', `scan du jeu : ${show(res)}`);
        admin = await signInAs('ADMIN');
    });

    test('propriétaire : 200 sur les six onglets et l’export (témoin)', async () => {
        for (const tab of PILOTAGE_TABS) {
            const res = await pilotageGet(partnerA, evA.eventId, tab);
            assert.equal(res.status, 200, `propriétaire, pilotage/${tab} : ${show(res)}`);
        }
        const exp = await participantsExport(partnerA, evA.eventId, { includeContacts: false });
        assert.equal(exp.status, 200, `propriétaire, export : ${showExport(exp)}`);
    });

    test('partenaire B : 404 sans aucune donnée sur les six onglets et l’export de A ; 200 sur son propre événement (témoin)', async () => {
        for (const tab of PILOTAGE_TABS) {
            assertRefusal(await pilotageGet(partnerB, evA.eventId, tab), [404], `partenaire B, pilotage/${tab} de A`);
            const own = await pilotageGet(partnerB, evB.eventId, tab);
            assert.equal(own.status, 200, `témoin : partenaire B, pilotage/${tab} de son propre événement : ${show(own)}`);
        }
        assertExportRefused(await participantsExport(partnerB, evA.eventId, { includeContacts: false }), [404], 'partenaire B, export de A');
        assertExportRefused(await participantsExport(partnerB, evA.eventId, { includeContacts: true, purpose: 'URGENT_EVENT_INFO' }), [404], 'partenaire B, export de A avec contacts');
    });

    test('client (porteur d’un billet de l’événement) : 403 ou 404 ; sans session : 401', async () => {
        for (const tab of PILOTAGE_TABS) {
            assertRefusal(await pilotageGet(client, evA.eventId, tab), [403, 404], `client, pilotage/${tab}`);
            assertRefusal(await pilotageGet(null, evA.eventId, tab), [401], `sans session, pilotage/${tab}`);
        }
        assertExportRefused(await participantsExport(client, evA.eventId, { includeContacts: false }), [403, 404], 'client, export');
        assertExportRefused(await participantsExport(null, evA.eventId, { includeContacts: false }), [401], 'sans session, export');
    });

    test('admin : 200 sur les six onglets et l’export', async () => {
        for (const tab of PILOTAGE_TABS) {
            const res = await pilotageGet(admin, evA.eventId, tab);
            assert.equal(res.status, 200, `admin, pilotage/${tab} : ${show(res)}`);
        }
        const exp = await participantsExport(admin, evA.eventId, { includeContacts: false });
        assert.equal(exp.status, 200, `admin, export : ${showExport(exp)}`);
    });

    test('événement inconnu : 404, même pour un partenaire ou un admin', async () => {
        const unknown = randomUUID();
        for (const tab of PILOTAGE_TABS) {
            assertRefusal(await pilotageGet(partnerA, unknown, tab), [404], `propriétaire, pilotage/${tab} d’un événement inconnu`);
            assertRefusal(await pilotageGet(admin, unknown, tab), [404], `admin, pilotage/${tab} d’un événement inconnu`);
        }
    });

    test('compte du partenaire propriétaire SUSPENDU : refusé sur son propre événement, sans donnée', async () => {
        const temoin = await pilotageGet(partnerS, evS.eventId, 'overview');
        assert.equal(temoin.status, 200, `témoin : partenaire S ACTIF, aperçu de son événement : ${show(temoin)}`);
        const { error: susErr } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', partnerS.userId);
        assert.equal(susErr, null, `suspension du compte : ${susErr?.message}`);
        try {
            for (const tab of PILOTAGE_TABS) {
                const res = await pilotageGet(partnerS, evS.eventId, tab);
                assert.ok([401, 403, 404].includes(res.status), `compte SUSPENDU, pilotage/${tab} : refus attendu, ${show(res)}`);
                assert.ok(!JSON.stringify(res.body).includes(evS.title), `compte SUSPENDU, pilotage/${tab} : aucune donnée de l’événement`);
                assert.equal(res.body.tickets, undefined, `compte SUSPENDU, pilotage/${tab} : aucune donnée`);
            }
            const exp = await participantsExport(partnerS, evS.eventId, { includeContacts: false });
            assert.ok([401, 403, 404].includes(exp.status), `compte SUSPENDU, export : refus attendu, ${showExport(exp)}`);
            assert.ok(!/text\/csv/i.test(exp.contentType), 'compte SUSPENDU : aucun fichier');
        } finally {
            const { error } = await service.from('users').update({ status: 'ACTIF' }).eq('id', partnerS.userId);
            assert.equal(error, null, `rétablissement du compte : ${error?.message}`);
        }
    });

    test('participant_exports : lisible par le propriétaire, ni par le partenaire B ni par un client (RLS)', async () => {
        const exp = await participantsExport(partnerA, evA.eventId, { includeContacts: false });
        assert.equal(exp.status, 200, `export du propriétaire : ${showExport(exp)}`);
        const owner = await signedInClient(partnerA);
        const other = await signedInClient(partnerB);
        const buyer = await signedInClient(client);
        try {
            const mine = await owner.from('participant_exports').select('id, event_id, actor_id').eq('event_id', evA.eventId);
            assert.equal(mine.error, null, `lecture par le propriétaire : ${mine.error?.message}`);
            assert.ok((mine.data ?? []).length >= 1, 'le propriétaire lit le journal des exports de son événement');
            for (const [label, c] of [['partenaire B', other], ['client', buyer]] as const) {
                const res = await c.from('participant_exports').select('id').eq('event_id', evA.eventId);
                assert.equal(res.error, null, `${label} : lecture sans erreur (RLS) : ${res.error?.message}`);
                assert.deepEqual(res.data ?? [], [], `${label} : aucune ligne du journal des exports de A`);
            }
        } finally {
            await disposeClients(owner, other, buyer);
        }
    });
});

// ── Contrôles statiques de la page ─────────────────────────────────────────

const ROOT = process.cwd();
const PAGE = 'app/partner/events/[id]/page.tsx';
const TAB_LABELS = ['Aperçu', 'Ventes', 'Entrées', 'Équipe', 'Caisse', 'Clôture'];

interface Source { rel: string; code: string; strings: string[]; resolved: string[] }

function resolveImport(fromRel: string, spec: string): string | null {
    let base: string;
    if (spec.startsWith('@/')) base = spec.slice(2);
    else if (spec.startsWith('./') || spec.startsWith('../')) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
    else return null;
    for (const cand of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
        const abs = path.join(ROOT, cand);
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return cand;
    }
    return null;
}

/** Code sans commentaires (réimprimé par TypeScript), textes littéraux (chaînes, gabarits, JSX) et imports résolus. */
function readSource(rel: string): Source {
    const abs = path.join(ROOT, rel);
    assert.ok(fs.existsSync(abs), `${rel} absent`);
    const text = fs.readFileSync(abs, 'utf8');
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const code = ts.createPrinter({ removeComments: true }).printFile(sf);
    const strings: string[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
            strings.push(node.text);
        } else if (ts.isJsxText(node)) {
            const t = node.text.trim();
            if (t) strings.push(t);
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    const resolved = ts.preProcessFile(text, true, true).importedFiles
        .map((f) => resolveImport(rel, f.fileName))
        .filter((r): r is string => r !== null);
    return { rel, code, strings, resolved };
}

function inScope(rel: string): boolean {
    return rel.startsWith('app/partner/events/[id]/') || rel.startsWith('components/partner/');
}

/** La page et les modules qu'elle importe, récursivement, sous app/partner/events/[id]/ et components/partner/. */
function pageGraph(): Source[] {
    const seen = new Map<string, Source>();
    const queue = [PAGE];
    while (queue.length > 0) {
        const rel = queue.shift()!;
        if (seen.has(rel)) continue;
        const src = readSource(rel);
        seen.set(rel, src);
        for (const dep of src.resolved) if (inScope(dep) && !seen.has(dep)) queue.push(dep);
    }
    return Array.from(seen.values());
}

function importsModule(graph: Source[], candidates: string[]): boolean {
    return graph.some((s) => s.resolved.some((r) => candidates.includes(r)));
}

describe('5.10 Page de pilotage app/partner/events/[id]/page.tsx (contrôles statiques)', () => {
    test('onglets du composant partagé Tabs : Aperçu, Ventes, Entrées, Équipe, Caisse, Clôture', () => {
        assert.ok(fs.existsSync(path.join(ROOT, PAGE)), `${PAGE} absente : la page de pilotage n’existe pas`);
        const graph = pageGraph();
        assert.ok(importsModule(graph, ['components/ui/Tabs.tsx', 'components/ui/Tabs.ts']), `Tabs importé de components/ui/Tabs (fichiers lus : ${graph.map((s) => s.rel).join(', ')})`);
        assert.ok(graph.some((s) => /<Tabs\b/.test(s.code)), 'composant <Tabs> rendu');
        const strings = new Set(graph.flatMap((s) => s.strings.map((x) => x.trim())));
        for (const label of TAB_LABELS) assert.ok(strings.has(label), `onglet « ${label} » absent des textes de la page`);
    });

    test('indicateurs KpiCard et temps réel par useRealtimeRefresh (ticket_scans, scan_incidents, controller_shifts)', () => {
        const graph = pageGraph();
        assert.ok(importsModule(graph, ['components/ui/KpiCard.tsx', 'components/ui/KpiCard.ts']), 'KpiCard importé de components/ui/KpiCard');
        assert.ok(graph.some((s) => /<KpiCard\b/.test(s.code)), 'composant <KpiCard> rendu');
        assert.ok(importsModule(graph, ['hooks/useRealtimeRefresh.ts', 'hooks/useRealtimeRefresh.tsx']), 'hook partagé importé de hooks/useRealtimeRefresh');
        assert.ok(graph.some((s) => /\buseRealtimeRefresh\s*\(/.test(s.code)), 'useRealtimeRefresh appelé');
        const strings = graph.flatMap((s) => s.strings);
        for (const table of ['ticket_scans', 'scan_incidents', 'controller_shifts']) {
            assert.ok(strings.includes(table), `abonnement temps réel à ${table} (contrat I, temps réel)`);
        }
        assert.ok(strings.some((x) => x.includes('pilotage/')), 'données lues par les routes …/pilotage/*');
        assert.ok(strings.some((x) => x.includes('participants-export')), 'export des participants par sa route');
    });

    test('aucun calcul d’agrégat dans le navigateur : ni reduce, ni filter(…).length, ni lecture directe des tables ou des anciennes routes', () => {
        const graph = pageGraph();
        const filterLength = /\.filter\s*\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)\s*\.length\b/;
        const directRead = /\.from\(\s*['"`](tickets|ticket_scans|payments|controller_shifts|ticket_categories|scan_incidents|stock_reservations|finance_ledger)['"`]/;
        for (const s of graph) {
            assert.ok(!/\.reduce\s*\(/.test(s.code), `${s.rel} : reduce dans le navigateur (les totaux viennent des RPC pilotage_*)`);
            assert.ok(!filterLength.test(s.code), `${s.rel} : filter(…).length dans le navigateur (comptage côté client)`);
            assert.ok(!directRead.test(s.code), `${s.rel} : lecture directe d’une table de billets, scans, paiements ou caisses`);
            for (const x of s.strings) {
                assert.ok(!/^\/(shifts|tickets)(\?|$)/.test(x) && !/\/api\/partner\/events\/[^/]*\/(shifts|tickets)\b/.test(x),
                    `${s.rel} : ancienne route de données brutes (« ${x} »)`);
            }
        }
    });

    test('les anciennes pages team et caisse redirigent vers les onglets (?tab=)', () => {
        for (const rel of ['app/partner/events/[id]/team/page.tsx', 'app/partner/events/[id]/caisse/page.tsx']) {
            const s = readSource(rel);
            assert.ok(/\b(redirect|permanentRedirect)\s*\(|\brouter\.replace\s*\(/.test(s.code), `${rel} : redirection attendue (redirect, permanentRedirect ou router.replace)`);
            assert.ok(s.strings.some((x) => x.includes('/partner/events/')), `${rel} : redirection vers la page de pilotage /partner/events/[id]`);
            assert.ok(s.strings.some((x) => x.includes('tab=')), `${rel} : redirection vers un onglet (?tab=)`);
            assert.ok(!/\buseState\s*\(/.test(s.code), `${rel} : plus de page complète (useState), seulement la redirection`);
        }
    });
});
