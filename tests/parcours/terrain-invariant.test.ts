/**
 * Lot 7, tâche 7.6 — garde-fous des invariants (p)(q) du scanner et du billet hors ligne (contrat, section
 * 10.3 ; requête TERRAIN_INVARIANT_SQL dans tests/helpers/terrain-invariants.ts). Un invariant toujours vide
 * ne prouverait rien : dans des transactions annulées (tests/helpers/db.ts, inRolledBackTransaction, modèle
 * notif-invariant.test.ts du lot 6), chaque règle détecte une violation fabriquée exprès, à côté d'un témoin
 * conforme écrit dans la même transaction (aucune ligne pour le témoin).
 *  - Les triggers utilisateur de tickets (dont trg_tickets_secret_issue / _guard / _log, qui écriraient
 *    eux-mêmes l'historique), ticket_scans (ticket_scans_enrich), ticket_secret_versions et
 *    ticket_offline_downloads sont désactivés le temps de la transaction (ALTER TABLE … DISABLE TRIGGER USER,
 *    annulé avec elle) : l'historique des versions est écrit à la main, daté comme une donnée.
 *  - Chaque scan accepté porte sur un billet fabriqué distinct : uq_ticket_scans_one_accepted n'est pas
 *    supprimée. Aucune autre contrainte n'empêche les violations : aucune n'est supprimée.
 *  - (p) : scan QR accepté sans version d'un billet dont l'historique précède le scan (témoins : scan MANUAL
 *    accepté sans version ; scan QR sans version antérieur à l'historique de son billet, cas des scans du
 *    lot 6 en production) ; versions 1 et 2 datées now() - 10 min et now() - 5 min, scan accepté en version 1
 *    daté now() (témoins : scan en version 2 ; scan en version 1 daté avant la rotation) ; scan en version 3
 *    d'un billet en version 2 ;
 *  - (q) : instantané au nom de A, téléchargement de B (q1) ; version 2 de A, téléchargement de B en version 2
 *    (q2) ; téléchargement en version 1 daté après la rotation vers 2 (q3, témoin : version 2) ;
 *    downloaded_at = window_closes_at + 1 min, window_opens_at ≠ début − 24 h, window_closes_at ≠ fin +
 *    after_hours, instantané sans fenêtre (q4) ; instantané UTILISE, événement SUSPENDU, statut absent (q5) ;
 *    billet composté 10 min avant le téléchargement (q6, témoin : composté 30 s avant, tolérance d'une
 *    minute) ; témoin : téléchargement conforme ;
 *  - schéma : missingTerrainSchema() vide ;
 *  - dernier cas : après ROLLBACK, aucune ligne fabriquée ne reste, ni en base ni dans terrainViolations().
 * Les instants (`now()`, `created_at`, `downloaded_at`, fenêtres de l'instantané) sont des DONNÉES écrites
 * dans la transaction : aucune horloge n'est passée à une RPC (Conventions, « Horloge »).
 *
 * Rouge avant correctif : public.ticket_secret_versions et public.ticket_offline_downloads n'existent pas
 * (migration 20261105000004 absente), ni ticket_scans.secret_version / client_key (20261105000005), ni les
 * triggers trg_tickets_secret_* : assertTerrainSchema échoue dans chaque transaction en nommant chaque objet
 * manquant (jamais d'erreur Postgres brute), puis assertTerrainInvariants échoue en after() pour la même
 * raison.
 *
 * Écart signalé (repris de l'INFRA) : q4 est évaluée en COALESCE(…, TRUE) dans TERRAIN_INVARIANT_SQL ; le cas
 * « instantané sans fenêtre » exige donc le détail « téléchargement hors de la fenêtre [? ; ?] ». Avec le SQL
 * exact du contrat (10.2), la comparaison NULL ferait ignorer la ligne et ce garde-fou serait rouge.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { loadFixtures, type Fixtures } from '../helpers/fixtures';
import {
    assertTerrainInvariants,
    assertTerrainSchema,
    missingTerrainSchema,
    terrainViolations,
    type TerrainViolation,
} from '../helpers/terrain-invariants';

after(async () => {
    await assertTerrainInvariants('terrain-invariant');
});

/** Identifiants de toutes les lignes fabriquées, par table (contrôle final après ROLLBACK). */
const FABRICATED = { tickets: new Set<string>(), scans: new Set<string>(), downloads: new Set<string>() };

// ── Outils locaux (dans la transaction annulée) ────────────────────────────

/** Expression SQL écrite telle quelle dans un INSERT (ex. `now() - interval '10 minutes'`). */
class Sql {
    constructor(readonly text: string) {}
}
const sql = (text: string): Sql => new Sql(text);

const NOW = sql('now()');
const ago = (interval: string): Sql => sql(`now() - interval '${interval}'`);

/** INSERT paramétré ; les objets vont en jsonb, les Sql sont écrits tels quels, le reste en paramètre. */
async function insertRow(db: Client, table: string, row: Record<string, unknown>): Promise<void> {
    const cols: string[] = [];
    const vals: string[] = [];
    const params: unknown[] = [];
    for (const [col, value] of Object.entries(row)) {
        cols.push(col);
        if (value instanceof Sql) {
            vals.push(value.text);
        } else if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
            params.push(JSON.stringify(value));
            vals.push(`$${params.length}::jsonb`);
        } else {
            params.push(value);
            vals.push(`$${params.length}`);
        }
    }
    await db.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')})`, params);
}

/**
 * Prépare la transaction : schéma du lot 7 présent (échec explicite sinon, AVANT tout DDL sur une table
 * peut-être absente), puis triggers utilisateur coupés (annulé avec la transaction).
 */
async function prepare(db: Client, label: string): Promise<void> {
    await assertTerrainSchema(`terrain-invariant ${label}`, db);
    for (const table of ['tickets', 'ticket_scans', 'ticket_secret_versions', 'ticket_offline_downloads']) {
        await db.query(`ALTER TABLE public.${table} DISABLE TRIGGER USER`);
    }
}

interface Scene { fx: Fixtures; eventId: string; categoryId: string; price: number; scanner: string; a: string; b: string }

async function scene(): Promise<Scene> {
    const fx = await loadFixtures();
    const ev = fx.events.A_PUBLIE;
    const category = Object.values(ev.categories)[0];
    assert.ok(category, 'fixture A_PUBLIE sans catégorie');
    return { fx, eventId: ev.id, categoryId: category.id, price: category.price, scanner: fx.users.CONTROLLER_A.id,
        a: fx.users.CLIENT.id, b: fx.users.CLIENT_BIS.id };
}

/** Billet fabriqué (triggers coupés : aucune ligne d'historique automatique). */
async function insertTicket(db: Client, s: Scene, over: { userId?: string; version?: number; status?: string; checkedInAt?: Sql | null } = {}): Promise<string> {
    const id = randomUUID();
    await insertRow(db, 'public.tickets', {
        id,
        event_id: s.eventId,
        category_id: s.categoryId,
        user_id: over.userId ?? s.a,
        ticket_number: `TCK-INV-TERRAIN-${id.slice(0, 8)}`,
        price: s.price,
        qr_code: `EV-QR-INV-TERRAIN-${id}`,
        status: over.status ?? 'VALIDE',
        security_version: over.version ?? 1,
        checked_in_at: over.checkedInAt ?? null,
    });
    FABRICATED.tickets.add(id);
    return id;
}

/** Ligne d'historique des versions (contrat M4.1), datée comme une donnée. */
async function insertVersion(db: Client, ticketId: string, version: number, holder: string | null, createdAt: Sql,
    reason: 'ISSUE' | 'BACKFILL' | 'TRANSFER' | 'REGENERATE' = version === 1 ? 'ISSUE' : 'REGENERATE'): Promise<void> {
    await insertRow(db, 'public.ticket_secret_versions', { ticket_id: ticketId, version, holder_user_id: holder, reason, created_at: createdAt });
}

/** Scan accepté (résultat valid) du contrôleur A. */
async function insertScan(db: Client, s: Scene, ticketId: string, over: { method?: 'QR' | 'MANUAL'; version?: number | null; createdAt?: Sql; accepted?: boolean } = {}): Promise<string> {
    const id = randomUUID();
    const accepted = over.accepted ?? true;
    await insertRow(db, 'public.ticket_scans', {
        id,
        ticket_id: ticketId,
        event_id: s.eventId,
        scanner_id: s.scanner,
        result: accepted ? 'valid' : 'qr_expired',
        accepted,
        method: over.method ?? 'QR',
        identity_verified: (over.method ?? 'QR') === 'MANUAL',
        secret_version: over.version ?? null,
        created_at: over.createdAt ?? NOW,
    });
    FABRICATED.scans.add(id);
    return id;
}

/** Fenêtre d'un événement (instantané de décision, contrat M4.5), en heures relatives à l'instant réel. */
interface Timeline { startAt: Date; endAt: Date; afterHours: number; beforeHours: number }

function timeline(startInHours: number, durationHours = 4, afterHours = 6): Timeline {
    const startAt = new Date(Date.now() + startInHours * 3600_000);
    return { startAt, endAt: new Date(startAt.getTime() + durationHours * 3600_000), afterHours, beforeHours: 6 };
}

/** Instantané conforme : porteur `holder`, billet VALIDE, événement PUBLIE, fenêtre [début − 24 h ; fin + after]. */
function decision(holder: string, tl: Timeline, over: Record<string, unknown> = {}): Record<string, unknown> {
    const opens = new Date(tl.startAt.getTime() - 24 * 3600_000);
    const closes = new Date(tl.endAt.getTime() + tl.afterHours * 3600_000);
    return {
        holder_user_id: holder,
        ticket_status: 'VALIDE',
        event_status: 'PUBLIE',
        transfer_locked: false,
        event_start_at: tl.startAt.toISOString(),
        event_end_at: tl.endAt.toISOString(),
        after_hours: tl.afterHours,
        before_hours: tl.beforeHours,
        window_opens_at: opens.toISOString(),
        window_closes_at: closes.toISOString(),
        scan_opens_at: new Date(tl.startAt.getTime() - tl.beforeHours * 3600_000).toISOString(),
        scan_closes_at: closes.toISOString(),
        ...over,
    };
}

/** Téléchargement de codes hors ligne (contrat M4.5) ; `downloadedAt` : Sql ou instant ISO. */
async function insertDownload(db: Client, s: Scene, ticketId: string, userId: string, version: number,
    snapshot: Record<string, unknown>, downloadedAt: Sql | string = NOW): Promise<string> {
    const id = randomUUID();
    await insertRow(db, 'public.ticket_offline_downloads', {
        id,
        ticket_id: ticketId,
        user_id: userId,
        event_id: s.eventId,
        secret_version: version,
        downloaded_at: downloadedAt,
        first_step_at: downloadedAt,
        last_step_at: downloadedAt instanceof Sql ? sql(`${downloadedAt.text} + interval '48 hours'`) : new Date(new Date(downloadedAt).getTime() + 48 * 3600_000).toISOString(),
        codes_count: 8640,
        decision: snapshot,
    });
    FABRICATED.downloads.add(id);
    return id;
}

function has(rows: TerrainViolation[], regle: string, objet: string, detail?: RegExp): boolean {
    return rows.some((r) => r.regle === regle && r.objet === objet && (detail === undefined || detail.test(String(r.detail))));
}

function about(rows: TerrainViolation[], objet: string): string {
    return JSON.stringify(rows.filter((r) => r.objet === objet));
}

function assertClean(rows: TerrainViolation[], objet: string, what: string): void {
    assert.deepEqual(rows.filter((r) => r.objet === objet), [], `${what} : aucune violation attendue pour le témoin conforme : ${about(rows, objet)}`);
}

const reEscape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── Schéma ─────────────────────────────────────────────────────────────────

describe('7.6 Invariants (p)(q) : schéma du lot 7', () => {
    test('missingTerrainSchema() est vide (tables, colonnes et triggers de rotation présents)', async () => {
        const missing = await missingTerrainSchema();
        assert.deepEqual(missing, [], `schéma du lot 7 incomplet, (p)(q) invérifiables :\n${missing.join('\n')}`);
    });
});

// ── (p) scans ──────────────────────────────────────────────────────────────

describe('7.6 Invariant (p) : aucun scan QR accepté avec une version de secret périmée (transaction annulée)', () => {
    test('(p1) scan QR accepté sans version alors que l\'historique du billet précède le scan', async () => {
        const s = await scene();
        let ids: Record<string, string> = {};
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, '(p1)');
            const t = await insertTicket(db, s, { status: 'UTILISE', checkedInAt: NOW });
            await insertVersion(db, t, 1, s.a, ago('1 hour'));
            const p1 = await insertScan(db, s, t, { version: null });
            // témoin : scan MANUAL accepté sans version (aucun code présenté)
            const tm = await insertTicket(db, s, { status: 'UTILISE', checkedInAt: NOW });
            await insertVersion(db, tm, 1, s.a, ago('1 hour'));
            const wManual = await insertScan(db, s, tm, { method: 'MANUAL', version: null });
            // témoin : scan QR sans version antérieur à l'historique de son billet (reprise BACKFILL)
            const tb = await insertTicket(db, s, { status: 'UTILISE', checkedInAt: ago('2 hours') });
            await insertVersion(db, tb, 1, s.a, ago('1 hour'), 'BACKFILL');
            const wBefore = await insertScan(db, s, tb, { version: null, createdAt: ago('2 hours') });
            // témoin : scan QR refusé sans version (seuls les scans acceptés comptent)
            const tr = await insertTicket(db, s);
            await insertVersion(db, tr, 1, s.a, ago('1 hour'));
            const wRefused = await insertScan(db, s, tr, { version: null, accepted: false });
            ids = { p1, wManual, wBefore, wRefused };
            return terrainViolations(db);
        });
        assert.ok(has(rows, 'p', ids.p1, /^scan QR accepté sans version de secret$/), `(p1) scan QR sans version : ${about(rows, ids.p1)}`);
        assertClean(rows, ids.wManual, '(p1) scan MANUAL sans version');
        assertClean(rows, ids.wBefore, '(p1) scan antérieur à l\'historique');
        assertClean(rows, ids.wRefused, '(p1) scan QR refusé');
    });

    test('(p2) versions 1 et 2 datées now() - 10 min et now() - 5 min, scan accepté en version 1 daté now()', async () => {
        const s = await scene();
        let ids: Record<string, string> = {};
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, '(p2)');
            const rotated = async (): Promise<string> => {
                const t = await insertTicket(db, s, { version: 2, status: 'UTILISE', checkedInAt: NOW });
                await insertVersion(db, t, 1, s.a, ago('10 minutes'));
                await insertVersion(db, t, 2, s.a, ago('5 minutes'));
                return t;
            };
            const p2 = await insertScan(db, s, await rotated(), { version: 1 });
            // témoin : scan en version 2 après la rotation
            const wV2 = await insertScan(db, s, await rotated(), { version: 2 });
            // témoin : scan en version 1 daté avant la rotation (il a tenu le verrou avant elle, D86)
            const wEarly = await insertScan(db, s, await rotated(), { version: 1, createdAt: ago('7 minutes') });
            ids = { p2, wV2, wEarly };
            return terrainViolations(db);
        });
        assert.ok(has(rows, 'p', ids.p2, /^scan QR accepté avec la version 1 alors que la version courante était 2$/), `(p2) version périmée : ${about(rows, ids.p2)}`);
        assertClean(rows, ids.wV2, '(p2) scan en version 2');
        assertClean(rows, ids.wEarly, '(p2) scan en version 1 avant la rotation');
    });

    test('(p3) scan en version 3 d\'un billet en version 2', async () => {
        const s = await scene();
        let p3 = '';
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, '(p3)');
            const t = await insertTicket(db, s, { version: 2, status: 'UTILISE', checkedInAt: NOW });
            await insertVersion(db, t, 1, s.a, ago('10 minutes'));
            await insertVersion(db, t, 2, s.a, ago('5 minutes'));
            p3 = await insertScan(db, s, t, { version: 3 });
            return terrainViolations(db);
        });
        assert.ok(has(rows, 'p', p3, /^scan avec la version 3, supérieure à la version du billet 2$/), `(p3) version inconnue du billet : ${about(rows, p3)}`);
        assert.ok(!has(rows, 'p', p3, /alors que la version courante/), `(p3) n'est pas une version périmée : ${about(rows, p3)}`);
    });
});

// ── (q) téléchargements hors ligne ─────────────────────────────────────────

describe('7.6 Invariant (q) : tout téléchargement par le porteur, dans la fenêtre, d\'un billet VALIDE (transaction annulée)', () => {
    test('(q1) instantané au nom de A, téléchargement par B ; témoin : téléchargement conforme', async () => {
        const s = await scene();
        const tl = timeline(2);
        let ids: Record<string, string> = {};
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, '(q1)');
            // L'historique dit B (q2 ne s'applique pas) : seul l'instantané contredit le compte.
            const t = await insertTicket(db, s, { userId: s.b });
            await insertVersion(db, t, 1, s.b, ago('1 hour'));
            const q1 = await insertDownload(db, s, t, s.b, 1, decision(s.a, tl));
            const tw = await insertTicket(db, s, { userId: s.a });
            await insertVersion(db, tw, 1, s.a, ago('1 hour'));
            const witness = await insertDownload(db, s, tw, s.a, 1, decision(s.a, tl));
            ids = { q1, witness };
            return terrainViolations(db);
        });
        assert.ok(has(rows, 'q', ids.q1, new RegExp(`^téléchargement par un compte qui n'était pas le porteur \\(instantané : ${reEscape(s.a)}\\)$`)),
            `(q1) instantané d'un autre porteur : ${about(rows, ids.q1)}`);
        assert.ok(!has(rows, 'q', ids.q1, /porteur de la version/), `(q1) l'historique est cohérent avec le compte : ${about(rows, ids.q1)}`);
        assertClean(rows, ids.witness, '(q) téléchargement conforme');
    });

    test('(q2) version 2 au nom de A, téléchargement de B en version 2', async () => {
        const s = await scene();
        const tl = timeline(2);
        let q2 = '';
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, '(q2)');
            const t = await insertTicket(db, s, { userId: s.b, version: 2 });
            await insertVersion(db, t, 1, s.a, ago('10 minutes'));
            await insertVersion(db, t, 2, s.a, ago('5 minutes'));
            // Instantané (faux) au nom de B : seule la règle q2 le contredit.
            q2 = await insertDownload(db, s, t, s.b, 2, decision(s.b, tl));
            return terrainViolations(db);
        });
        assert.ok(has(rows, 'q', q2, /^téléchargement par un compte qui n'était pas le porteur de la version 2$/), `(q2) porteur de la version : ${about(rows, q2)}`);
        assert.ok(!has(rows, 'q', q2, /instantané :/), `(q2) l'instantané est au nom du compte : ${about(rows, q2)}`);
    });

    test('(q3) téléchargement en version 1 daté après la rotation vers 2 ; témoin : version 2', async () => {
        const s = await scene();
        const tl = timeline(2);
        let ids: Record<string, string> = {};
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, '(q3)');
            const t = await insertTicket(db, s, { version: 2 });
            await insertVersion(db, t, 1, s.a, ago('10 minutes'));
            await insertVersion(db, t, 2, s.a, ago('5 minutes'));
            const q3 = await insertDownload(db, s, t, s.a, 1, decision(s.a, tl));
            const witness = await insertDownload(db, s, t, s.a, 2, decision(s.a, tl));
            // témoin : version 1 téléchargée avant la rotation
            const wEarly = await insertDownload(db, s, t, s.a, 1, decision(s.a, tl), ago('7 minutes'));
            ids = { q3, witness, wEarly };
            return terrainViolations(db);
        });
        assert.ok(has(rows, 'q', ids.q3, /^lot de la version 1 alors que la version courante était 2$/), `(q3) lot périmé : ${about(rows, ids.q3)}`);
        assertClean(rows, ids.witness, '(q3) lot de la version 2');
        assertClean(rows, ids.wEarly, '(q3) lot de la version 1 avant la rotation');
    });

    test('(q4) hors fenêtre : après window_closes_at, window_opens_at ≠ début − 24 h, window_closes_at ≠ fin + after, instantané sans fenêtre', async () => {
        const s = await scene();
        let ids: Record<string, string> = {};
        let late = { opens: '', closes: '' };
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, '(q4)');
            const ticket = async (): Promise<string> => {
                const t = await insertTicket(db, s);
                await insertVersion(db, t, 1, s.a, ago('2 days'));
                return t;
            };
            // Événement terminé : fenêtre close 10 h avant l'instant réel ; téléchargement 1 min après la fermeture.
            const past = timeline(-20, 4, 6);
            const pastDecision = decision(s.a, past);
            late = { opens: String(pastDecision.window_opens_at), closes: String(pastDecision.window_closes_at) };
            const afterClose = new Date(new Date(late.closes).getTime() + 60_000).toISOString();
            const qLate = await insertDownload(db, s, await ticket(), s.a, 1, pastDecision, afterClose);
            // Fenêtre ouverte 48 h avant le début (au lieu de 24 h) ; téléchargement maintenant, dans cette fenêtre.
            const tl = timeline(2);
            const qOpens = await insertDownload(db, s, await ticket(), s.a, 1,
                decision(s.a, tl, { window_opens_at: new Date(tl.startAt.getTime() - 48 * 3600_000).toISOString() }));
            // Fenêtre fermée 12 h après la fin pour after_hours = 6.
            const qCloses = await insertDownload(db, s, await ticket(), s.a, 1,
                decision(s.a, tl, { window_closes_at: new Date(tl.endAt.getTime() + 12 * 3600_000).toISOString() }));
            // Instantané sans fenêtre : fail-closed.
            const noWindow = decision(s.a, tl);
            delete noWindow.window_opens_at;
            delete noWindow.window_closes_at;
            const qNone = await insertDownload(db, s, await ticket(), s.a, 1, noWindow);
            // témoin : téléchargement 1 min avant la fermeture de la fenêtre de l'événement terminé
            const beforeClose = new Date(new Date(late.closes).getTime() - 60_000).toISOString();
            const witness = await insertDownload(db, s, await ticket(), s.a, 1, pastDecision, beforeClose);
            ids = { qLate, qOpens, qCloses, qNone, witness };
            return terrainViolations(db);
        });
        const window = /^téléchargement hors de la fenêtre \[.+ ; .+\]$/;
        assert.ok(has(rows, 'q', ids.qLate, new RegExp(`^téléchargement hors de la fenêtre \\[${reEscape(late.opens)} ; ${reEscape(late.closes)}\\]$`)),
            `(q4) téléchargement après la fermeture : ${about(rows, ids.qLate)}`);
        assert.ok(has(rows, 'q', ids.qOpens, window), `(q4) ouverture ≠ début − 24 h : ${about(rows, ids.qOpens)}`);
        assert.ok(has(rows, 'q', ids.qCloses, window), `(q4) fermeture ≠ fin + after_hours : ${about(rows, ids.qCloses)}`);
        assert.ok(has(rows, 'q', ids.qNone, /^téléchargement hors de la fenêtre \[\? ; \?\]$/), `(q4) instantané sans fenêtre : ${about(rows, ids.qNone)}`);
        assertClean(rows, ids.witness, '(q4) téléchargement 1 min avant la fermeture');
    });

    test('(q5) instantané UTILISE, événement SUSPENDU, statut du billet absent', async () => {
        const s = await scene();
        const tl = timeline(2);
        let ids: Record<string, string> = {};
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, '(q5)');
            const ticket = async (): Promise<string> => {
                const t = await insertTicket(db, s);
                await insertVersion(db, t, 1, s.a, ago('1 hour'));
                return t;
            };
            const used = await insertDownload(db, s, await ticket(), s.a, 1, decision(s.a, tl, { ticket_status: 'UTILISE' }));
            const suspended = await insertDownload(db, s, await ticket(), s.a, 1, decision(s.a, tl, { event_status: 'SUSPENDU' }));
            const noStatus = decision(s.a, tl);
            delete noStatus.ticket_status;
            const absent = await insertDownload(db, s, await ticket(), s.a, 1, noStatus);
            ids = { used, suspended, absent };
            return terrainViolations(db);
        });
        assert.ok(has(rows, 'q', ids.used, /^téléchargement d'un billet UTILISE \(événement PUBLIE\)$/), `(q5) billet UTILISE : ${about(rows, ids.used)}`);
        assert.ok(has(rows, 'q', ids.suspended, /^téléchargement d'un billet VALIDE \(événement SUSPENDU\)$/), `(q5) événement SUSPENDU : ${about(rows, ids.suspended)}`);
        assert.ok(has(rows, 'q', ids.absent, /^téléchargement d'un billet absent \(événement PUBLIE\)$/), `(q5) statut absent de l'instantané : ${about(rows, ids.absent)}`);
    });

    test('(q6) billet composté 10 min avant le téléchargement ; témoin : composté 30 s avant (tolérance d\'une minute)', async () => {
        const s = await scene();
        const tl = timeline(2);
        let ids: Record<string, string> = {};
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, '(q6)');
            const t = await insertTicket(db, s, { status: 'UTILISE', checkedInAt: ago('10 minutes') });
            await insertVersion(db, t, 1, s.a, ago('1 hour'));
            const q6 = await insertDownload(db, s, t, s.a, 1, decision(s.a, tl));
            const tw = await insertTicket(db, s, { status: 'UTILISE', checkedInAt: ago('30 seconds') });
            await insertVersion(db, tw, 1, s.a, ago('1 hour'));
            const witness = await insertDownload(db, s, tw, s.a, 1, decision(s.a, tl));
            ids = { q6, witness };
            return terrainViolations(db);
        });
        assert.ok(has(rows, 'q', ids.q6, /^téléchargement après le compostage du billet \(.+\)$/), `(q6) téléchargement après le compostage : ${about(rows, ids.q6)}`);
        assertClean(rows, ids.witness, '(q6) compostage 30 s avant le téléchargement');
    });
});

// ── Après ROLLBACK ─────────────────────────────────────────────────────────

describe('7.6 Invariants (p)(q) sur l\'état réel', () => {
    test('après ROLLBACK, aucune ligne fabriquée ne reste en base ni dans les violations', async () => {
        // Schéma d'abord : avant le correctif, l'échec nomme ce qui manque (et non « rien n'a été fabriqué »).
        await assertTerrainSchema('terrain-invariant après ROLLBACK');
        const total = FABRICATED.tickets.size + FABRICATED.scans.size + FABRICATED.downloads.size;
        assert.ok(FABRICATED.scans.size > 0 && FABRICATED.downloads.size > 0, `les garde-fous ci-dessus ont fabriqué des scans et des téléchargements (${total} ligne(s))`);
        const left = await inspect(async (db) => {
            await assertTerrainSchema('terrain-invariant après ROLLBACK', db);
            const q = async (table: string, ids: Set<string>): Promise<string[]> =>
                (await db.query<{ id: string }>(`SELECT id::text AS id FROM public.${table} WHERE id = ANY($1::uuid[])`, [Array.from(ids)])).rows.map((r) => `${table}:${r.id}`);
            return [
                ...(await q('tickets', FABRICATED.tickets)),
                ...(await q('ticket_scans', FABRICATED.scans)),
                ...(await q('ticket_offline_downloads', FABRICATED.downloads)),
                ...(await db.query<{ id: string }>(`SELECT ticket_id::text AS id FROM public.ticket_secret_versions WHERE ticket_id = ANY($1::uuid[])`,
                    [Array.from(FABRICATED.tickets)])).rows.map((r) => `ticket_secret_versions:${r.id}`),
            ];
        });
        assert.deepEqual(left, [], `lignes fabriquées encore présentes après ROLLBACK : ${JSON.stringify(left)}`);
        const rows = await terrainViolations();
        const fabricated = new Set([...Array.from(FABRICATED.scans), ...Array.from(FABRICATED.downloads)]);
        const leaked = rows.filter((r) => fabricated.has(r.objet));
        assert.deepEqual(leaked, [], `violations fabriquées visibles après ROLLBACK : ${JSON.stringify(leaked)}`);
    });
});
