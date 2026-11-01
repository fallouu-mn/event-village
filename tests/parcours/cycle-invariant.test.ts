/**
 * Lot 5, tâche 5.12 — garde-fou de l'invariant du cycle de vie (j)(k)(l) (contrat K et U ;
 * tests/helpers/lifecycle-invariants.ts). Un invariant toujours vide ne prouverait rien : dans des
 * transactions annulées (tests/helpers/db.ts, inRolledBackTransaction, comme acces-invariant.test.ts du
 * lot 4), chaque règle de LIFECYCLE_INVARIANT_SQL détecte une violation fabriquée exprès.
 *  - (j) : les triggers de events et de event_status_history (INSERT forcé à BROUILLON, ligne CREATION,
 *    garde D3, ajout seul) sont désactivés le temps de la transaction (ALTER TABLE … DISABLE TRIGGER USER,
 *    annulé avec elle) pour écrire des états que les RPC rendent impossibles : événement sans historique,
 *    première ligne autre que CREATION, chaîne rompue, transition absente de la table, statut différent de
 *    la dernière ligne ; un événement à la chaîne complète sert de témoin (aucune ligne (j)) ;
 *  - (k) : PUBLIE dont la fin est passée depuis plus d'une heure (la requête seule ne passe pas le cron) ;
 *  - (l) par les données : billet UTILISE sans scan accepté, caisse dont le total attendu ne correspond à
 *    aucun encaissement ; (l) par les fonctions : pilotage_compute_overview et pilotage_compute_cash sont
 *    renommées dans la transaction et enveloppées pour fausser un seul chiffre d'un seul événement
 *    (vendus, caisse manquante, caisse d'un autre événement, clé shifts qui n'est pas un tableau).
 * Puis l'état réel : un PUBLIE réellement en retard est signalé par (k) avant le cron et plus après ; après
 * le passage du cron, 0 violation.
 * Rouge avant correctif : event_status_history, event_status_transitions, event_end_at,
 * pilotage_compute_overview et pilotage_compute_cash n'existent pas (grep vide dans supabase/migrations) :
 * LIFECYCLE_INVARIANT_SQL échoue (relation ou fonction absente), et createEventInStatus échoue sur la RPC
 * event_transition absente.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { inRolledBackTransaction } from '../helpers/db';
import { loadFixtures, type Fixtures } from '../helpers/fixtures';
import { assertLifecycleInvariants, finishOverdueEvents, LIFECYCLE_INVARIANT_SQL, lifecycleViolations } from '../helpers/lifecycle-invariants';
import { newPartner } from './finance-helpers';
import { createEventInStatus, eventStatus, shiftEventDates } from './cycle-helpers';

interface Violation { regle: string; objet: string; detail: string }
type Status = 'BROUILLON' | 'EN_ATTENTE' | 'VALIDE' | 'PUBLIE';

after(async () => {
    await assertLifecycleInvariants('cycle-invariant');
});

// ── Outils locaux (dans la transaction annulée) ────────────────────────────

function isoDate(daysFromNow: number): string {
    return new Date(Date.now() + daysFromNow * 24 * 3600_000).toISOString().slice(0, 10);
}

/** Désactive, pour la seule transaction en cours, les triggers utilisateur de events et de event_status_history. */
async function disableLifecycleTriggers(db: Client): Promise<void> {
    await db.query('ALTER TABLE public.events DISABLE TRIGGER USER');
    await db.query('ALTER TABLE public.event_status_history DISABLE TRIGGER USER');
}

async function insertEvent(db: Client, fx: Fixtures, id: string, status: Status, dates: { start: string; end?: string }): Promise<void> {
    await db.query(
        `INSERT INTO public.events (id, partner_id, title, start_date, start_time, end_date, end_time, location, city, status)
         VALUES ($1, $2, $3, $4::date, '20:00:00', $5::date, $6::time, 'Salle de test, Dakar', 'Dakar', $7)`,
        [id, fx.partners.A.id, `TEST Invariant cycle ${id.slice(0, 8)}`, dates.start, dates.end ?? null, dates.end ? '22:00:00' : null, status]);
}

/** Ligne d'historique horodatée à now() + `second` secondes (ordre explicite des lignes d'une même transaction). */
async function insertHistory(db: Client, fx: Fixtures, eventId: string, second: number, old: Status | null, next: Status,
    role: 'PARTENAIRE' | 'ADMIN' | 'SYSTEM', channel: 'CREATION' | 'TRANSITION' | 'CANCELLATION' | 'CRON'): Promise<void> {
    const actor = role === 'PARTENAIRE' ? fx.partners.A.userId : role === 'ADMIN' ? fx.users.SUPERADMIN.id : null;
    await db.query(
        `INSERT INTO public.event_status_history (event_id, old_status, new_status, actor_id, actor_role, channel, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, now() + ($7::int * interval '1 second'))`,
        [eventId, old, next, actor, role, channel, second]);
}

/** Chaîne complète et conforme jusqu'à PUBLIE : création, soumission, validation, publication. */
async function publishedChain(db: Client, fx: Fixtures, eventId: string): Promise<void> {
    await insertHistory(db, fx, eventId, 1, null, 'BROUILLON', 'PARTENAIRE', 'CREATION');
    await insertHistory(db, fx, eventId, 2, 'BROUILLON', 'EN_ATTENTE', 'PARTENAIRE', 'TRANSITION');
    await insertHistory(db, fx, eventId, 3, 'EN_ATTENTE', 'VALIDE', 'ADMIN', 'TRANSITION');
    await insertHistory(db, fx, eventId, 4, 'VALIDE', 'PUBLIE', 'PARTENAIRE', 'TRANSITION');
}

/** Événement PUBLIE à venir, chaîne conforme, avec une catégorie ; renvoie l'identifiant de la catégorie. */
async function publishedEventWithCategory(db: Client, fx: Fixtures, eventId: string, price: number): Promise<string> {
    await insertEvent(db, fx, eventId, 'PUBLIE', { start: isoDate(40), end: isoDate(40) });
    await publishedChain(db, fx, eventId);
    const { rows } = await db.query<{ id: string }>(
        `INSERT INTO public.ticket_categories (event_id, name, price, total_quantity, sold_quantity)
         VALUES ($1, 'Standard', $2, 10, 1) RETURNING id`, [eventId, price]);
    return rows[0].id;
}

async function insertTicket(db: Client, fx: Fixtures, eventId: string, categoryId: string, price: number, status: 'VALIDE' | 'UTILISE'): Promise<string> {
    const id = randomUUID();
    await db.query(
        `INSERT INTO public.tickets (id, event_id, category_id, user_id, ticket_number, price, qr_code, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, eventId, categoryId, fx.users.CLIENT.id, `TCK-INV-CYCLE-${id.slice(0, 8)}`, price, `EV-QR-INV-CYCLE-${id}`, status]);
    return id;
}

async function insertShift(db: Client, fx: Fixtures, eventId: string, expected: number): Promise<string> {
    const id = randomUUID();
    await db.query(
        `INSERT INTO public.controller_shifts (id, controller_id, event_id, partner_id, status, expected_cash_total)
         VALUES ($1, $2, $3, $4, 'OUVERT', $5)`,
        [id, fx.users.CONTROLLER_A.id, eventId, fx.partners.A.id, expected]);
    return id;
}

function has(rows: Violation[], regle: string, objet: string, detail: RegExp): boolean {
    return rows.some((r) => r.regle === regle && r.objet === objet && detail.test(r.detail));
}

function about(rows: Violation[], objet: string): string {
    return JSON.stringify(rows.filter((r) => r.objet === objet));
}

// ── Violations fabriquées ──────────────────────────────────────────────────

describe('5.12 Invariant du cycle de vie : chaque règle détecte une violation fabriquée (transaction annulée)', () => {
    test('(j) historique et (k) PUBLIE en retard', async () => {
        const fx = await loadFixtures();
        const ids = { noHistory: randomUUID(), badFirst: randomUUID(), broken: randomUUID(), offTable: randomUUID(), lastDiffers: randomUUID(), overdue: randomUUID() };
        const future = { start: isoDate(40), end: isoDate(40) };

        const rows = await inRolledBackTransaction(async (db) => {
            await disableLifecycleTriggers(db);
            // (j) événement sans aucune ligne d'historique
            await insertEvent(db, fx, ids.noHistory, 'BROUILLON', future);
            // (j) première ligne qui n'est pas NULL → BROUILLON (canal CREATION)
            await insertEvent(db, fx, ids.badFirst, 'EN_ATTENTE', future);
            await insertHistory(db, fx, ids.badFirst, 1, 'BROUILLON', 'EN_ATTENTE', 'PARTENAIRE', 'TRANSITION');
            // (j) chaîne rompue : la ligne 2 ne part pas du statut où menait la ligne 1
            await insertEvent(db, fx, ids.broken, 'VALIDE', future);
            await insertHistory(db, fx, ids.broken, 1, null, 'BROUILLON', 'PARTENAIRE', 'CREATION');
            await insertHistory(db, fx, ids.broken, 2, 'EN_ATTENTE', 'VALIDE', 'ADMIN', 'TRANSITION');
            // (j) transition absente de event_status_transitions (publication directe d'un brouillon)
            await insertEvent(db, fx, ids.offTable, 'PUBLIE', future);
            await insertHistory(db, fx, ids.offTable, 1, null, 'BROUILLON', 'PARTENAIRE', 'CREATION');
            await insertHistory(db, fx, ids.offTable, 2, 'BROUILLON', 'PUBLIE', 'PARTENAIRE', 'TRANSITION');
            // (j) statut de l'événement différent de la dernière ligne
            await insertEvent(db, fx, ids.lastDiffers, 'PUBLIE', future);
            await insertHistory(db, fx, ids.lastDiffers, 1, null, 'BROUILLON', 'PARTENAIRE', 'CREATION');
            // (k) PUBLIE fini il y a 3 jours, chaîne conforme (témoin de (j))
            await insertEvent(db, fx, ids.overdue, 'PUBLIE', { start: isoDate(-3), end: isoDate(-3) });
            await publishedChain(db, fx, ids.overdue);
            return (await db.query<Violation>(LIFECYCLE_INVARIANT_SQL)).rows;
        });

        assert.ok(has(rows, 'j', ids.noHistory, /sans aucune ligne d'historique/), `(j) événement sans historique : ${about(rows, ids.noHistory)}`);
        assert.ok(has(rows, 'j', ids.badFirst, /^première ligne BROUILLON → EN_ATTENTE/), `(j) première ligne : ${about(rows, ids.badFirst)}`);
        assert.ok(has(rows, 'j', ids.broken, /^ligne 2 : EN_ATTENTE → VALIDE, alors que la ligne précédente mène à BROUILLON/), `(j) chaîne rompue : ${about(rows, ids.broken)}`);
        assert.ok(has(rows, 'j', ids.offTable, /BROUILLON → PUBLIE par PARTENAIRE \(canal TRANSITION\) absente de event_status_transitions/), `(j) transition hors table : ${about(rows, ids.offTable)}`);
        assert.ok(has(rows, 'j', ids.lastDiffers, /^statut PUBLIE, alors que la dernière ligne d'historique mène à BROUILLON/), `(j) dernière ligne : ${about(rows, ids.lastDiffers)}`);
        assert.ok(has(rows, 'k', ids.overdue, /PUBLIE dont la fin/), `(k) PUBLIE en retard : ${about(rows, ids.overdue)}`);
        assert.ok(!rows.some((r) => r.regle === 'j' && r.objet === ids.overdue), `(j) aucune violation pour une chaîne conforme : ${about(rows, ids.overdue)}`);
    });

    test('(l) par les données : billet UTILISE sans scan accepté, caisse sans encaissement correspondant', async () => {
        const fx = await loadFixtures();
        const eventId = randomUUID();
        let ticketId = '';
        let shiftId = '';
        const rows = await inRolledBackTransaction(async (db) => {
            await disableLifecycleTriggers(db);
            const categoryId = await publishedEventWithCategory(db, fx, eventId, 0);
            ticketId = await insertTicket(db, fx, eventId, categoryId, 0, 'UTILISE');
            shiftId = await insertShift(db, fx, eventId, 1000);
            return (await db.query<Violation>(LIFECYCLE_INVARIANT_SQL)).rows;
        });
        assert.ok(ticketId && shiftId, 'données fabriquées');
        assert.ok(has(rows, 'l', eventId, /^pilotage_compute_overview : entrées /),
            `(l) entrées : un billet UTILISE sans scan accepté ne peut égaler à la fois les scans et les billets : ${about(rows, eventId)}`);
        assert.ok(has(rows, 'l', shiftId, /^caisse OUVERT : espèces au pilotage .*, total attendu 1000/),
            `(l) caisse : total attendu 1000 sans aucun paiement rattaché : ${about(rows, shiftId)}`);
    });

    test('(l) par les fonctions : vendus faussés, caisse manquante, caisse d’un autre événement, clé shifts invalide', async () => {
        const fx = await loadFixtures();
        const eventId = randomUUID();
        const foreignShift = randomUUID();
        let shiftId = '';

        const rows = await inRolledBackTransaction(async (db) => {
            await disableLifecycleTriggers(db);
            const categoryId = await publishedEventWithCategory(db, fx, eventId, 0);
            await insertTicket(db, fx, eventId, categoryId, 0, 'VALIDE');
            shiftId = await insertShift(db, fx, eventId, 0);
            await db.query('ALTER FUNCTION public.pilotage_compute_overview(uuid) RENAME TO pilotage_compute_overview__reel');
            await db.query(`CREATE FUNCTION public.pilotage_compute_overview(p_event uuid) RETURNS jsonb LANGUAGE sql STABLE AS $f$
                SELECT CASE WHEN p_event = '${eventId}'::uuid
                            THEN jsonb_set(public.pilotage_compute_overview__reel(p_event), '{tickets,sold}', to_jsonb(-1))
                            ELSE public.pilotage_compute_overview__reel(p_event) END
            $f$`);
            await db.query('ALTER FUNCTION public.pilotage_compute_cash(uuid) RENAME TO pilotage_compute_cash__reel');
            await db.query(`CREATE FUNCTION public.pilotage_compute_cash(p_event uuid) RETURNS jsonb LANGUAGE sql STABLE AS $f$
                SELECT CASE WHEN p_event = '${eventId}'::uuid
                            THEN jsonb_build_object('shifts',
                                     COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements(public.pilotage_compute_cash__reel(p_event)->'shifts') x
                                                WHERE x->>'id' <> '${shiftId}'), '[]'::jsonb)
                                     || jsonb_build_array(jsonb_build_object('id', '${foreignShift}', 'cash_collected', 0)))
                            ELSE public.pilotage_compute_cash__reel(p_event) END
            $f$`);
            return (await db.query<Violation>(LIFECYCLE_INVARIANT_SQL)).rows;
        });
        assert.ok(has(rows, 'l', eventId, /^pilotage_compute_overview : vendus -1, vérité en base 1 /), `(l) vendus faussés : ${about(rows, eventId)}`);
        assert.ok(has(rows, 'l', shiftId, /0 entrée\(s\) dans pilotage_compute_cash, attendu 1/), `(l) caisse absente du pilotage : ${about(rows, shiftId)}`);
        assert.ok(has(rows, 'l', foreignShift, /rend une caisse qui n'est pas de cet événement/), `(l) caisse étrangère : ${about(rows, foreignShift)}`);

        const shape = await inRolledBackTransaction(async (db) => {
            await disableLifecycleTriggers(db);
            const categoryId = await publishedEventWithCategory(db, fx, eventId, 0);
            await insertTicket(db, fx, eventId, categoryId, 0, 'VALIDE');
            await db.query('ALTER FUNCTION public.pilotage_compute_cash(uuid) RENAME TO pilotage_compute_cash__reel');
            await db.query(`CREATE FUNCTION public.pilotage_compute_cash(p_event uuid) RETURNS jsonb LANGUAGE sql STABLE AS $f$
                SELECT CASE WHEN p_event = '${eventId}'::uuid
                            THEN jsonb_build_object('shifts', 'absent'::text)
                            ELSE public.pilotage_compute_cash__reel(p_event) END
            $f$`);
            return (await db.query<Violation>(LIFECYCLE_INVARIANT_SQL)).rows;
        });
        assert.ok(has(shape, 'l', eventId, /^pilotage_compute_cash : clé shifts string, tableau attendu/), `(l) clé shifts invalide : ${about(shape, eventId)}`);
    });
});

// ── État réel ──────────────────────────────────────────────────────────────

describe('5.12 Invariant du cycle de vie sur l’état réel', () => {
    test('(k) un PUBLIE réellement en retard est signalé avant le passage du cron, plus après', async () => {
        const owner = await newPartner('cycleinv');
        const ev = await createEventInStatus(owner, 'inv-retard', [{ name: 'Standard', price: 5000, total: 10 }], 'PUBLIE', { startsInHours: 48 });
        await shiftEventDates(ev.eventId, { startsInHours: -6, durationHours: 3 });
        const before = await lifecycleViolations();
        assert.ok(has(before, 'k', ev.eventId, /PUBLIE dont la fin/), `(k) avant le cron : ${about(before, ev.eventId)}`);
        const cron = await finishOverdueEvents();
        assert.ok(cron.ids.includes(ev.eventId), `le cron termine l’événement : ${JSON.stringify(cron)}`);
        assert.equal(await eventStatus(ev.eventId), 'TERMINE');
        const afterCron = await lifecycleViolations();
        assert.deepEqual(afterCron.filter((r) => r.objet === ev.eventId), [], `aucune violation pour l’événement terminé : ${about(afterCron, ev.eventId)}`);
    });

    test('état propre : après le passage du cron, 0 violation (j)(k)(l)', async () => {
        await finishOverdueEvents();
        const rows = await lifecycleViolations();
        assert.deepEqual(rows, [], `violations :\n${rows.map((r) => `(${r.regle}) ${r.objet} : ${r.detail}`).join('\n')}`);
    });
});
