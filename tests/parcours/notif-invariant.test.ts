/**
 * Lot 6, tâche 6.11 — garde-fous des invariants (m)(n)(o) de la boîte d'envoi (contrat O2 et O3 ;
 * requête dans tests/helpers/notification-invariants.ts). Un invariant toujours vide ne prouverait
 * rien : dans des transactions annulées (tests/helpers/db.ts, inRolledBackTransaction, comme
 * cycle-invariant.test.ts et pilotage-invariant.test.ts du lot 5), chaque règle de
 * NOTIFICATION_INVARIANT_SQL détecte une violation fabriquée exprès, à côté d'un témoin conforme
 * écrit dans la même transaction (aucune ligne pour le témoin).
 *  - Les triggers utilisateur de notification_outbox (garde des statuts NT409, updated_at) sont
 *    désactivés le temps de la transaction (ALTER TABLE … DISABLE TRIGGER USER, annulé avec elle) ;
 *    ceux de events, event_status_history, ticket_categories, tickets et ticket_transfers aussi, pour
 *    écrire un historique et des billets datés sans passer par les RPC.
 *  - Les contraintes qui rendent une violation impossible sont supprimées dans la transaction :
 *    notification_outbox_idempotency_key_key (m1), notification_outbox_attempts_chk (o2),
 *    notification_outbox_reason_chk (o3).
 *  - (m) : deux lignes SENT de même clé, SENT et SENDING de même clé ; ligne OPTIONAL SENT avec
 *    preference.enabled = false dans l'instantané ; préférence désactivée avant sent_at ;
 *  - (n) : rappel SENT avec un instantané SUSPENDU ; rappel SENT dont l'historique donne SUSPENDU avant
 *    sent_at ; rappel SENT sans billet dans l'instantané ; rappel SENT au compte A après un transfert
 *    réclamé par B avant sent_at ; SMS optionnel SENT à 23:00 Dakar avec une plage 22 h - 8 h, et SMS
 *    optionnel SENT sans plage dans l'instantané ;
 *  - (o) : SENDING depuis 11 min (témoin : 9 min) ; tentatives 6 sur 5, maximum 6 ; FAILED sans motif,
 *    SKIPPED au motif blanc (témoin : FAILED avec motif).
 * Dernier cas : après ROLLBACK, notificationViolations() ne contient aucune ligne fabriquée.
 * Les instants (`now()`, `sent_at`) sont des DONNÉES écrites dans la transaction : aucune horloge n'est
 * passée à une RPC ni à l'envoyeur ici (Conventions, « Horloge »).
 *
 * Rouge avant correctif : public.notification_outbox, public.notification_preferences,
 * public.notification_types et public.notif_in_quiet_hours n'existent pas (aucune migration
 * 20261103000002) : assertNotificationSchema échoue dans chaque transaction en nommant ce qui manque,
 * puis assertNotificationInvariants échoue en after() pour la même raison.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { loadFixtures, type Fixtures } from '../helpers/fixtures';
import { assertNotificationSchema } from '../helpers/notification-invariants';
import { assertNotificationInvariants, notificationViolations, type NotificationViolation } from './notif-helpers';
import { randomSenegalPhone } from './helpers';

after(async () => {
    await assertNotificationInvariants('notif-invariant');
});

/** Identifiants et clés de toutes les lignes fabriquées (contrôle final après ROLLBACK). */
const FABRICATED = new Set<string>();

// ── Outils locaux (dans la transaction annulée) ────────────────────────────

/** Expression SQL écrite telle quelle dans un INSERT (ex. `now() - interval '1 hour'`). */
class Sql {
    constructor(readonly text: string) {}
}
const sql = (text: string): Sql => new Sql(text);

const NOW = sql('now()');
const HOUR_AGO = sql(`now() - interval '1 hour'`);
const IN_ONE_HOUR = sql(`now() + interval '1 hour'`);
/** 23:00 à Dakar la veille du jour de la transaction (dans la plage 22 h - 8 h). */
const YESTERDAY_23H_DAKAR = sql(`(date_trunc('day', now() AT TIME ZONE 'Africa/Dakar') AT TIME ZONE 'Africa/Dakar') - interval '1 hour'`);
/** 12:00 à Dakar la veille du jour de la transaction (hors plage 22 h - 8 h). */
const YESTERDAY_NOON_DAKAR = sql(`(date_trunc('day', now() AT TIME ZONE 'Africa/Dakar') AT TIME ZONE 'Africa/Dakar') - interval '12 hours'`);

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
 * Ligne de public.notification_outbox (colonnes du contrat C2). Défauts : PASSWORD_CHANGED, ESSENTIAL,
 * SMS vers un numéro neuf, PENDING, dû maintenant ; `group_key` INV-<uuid>, clé `<group_key>:<canal>`.
 * Renvoie l'identifiant de la ligne et sa clé d'idempotence (tous deux retenus dans FABRICATED).
 */
async function insertOutbox(db: Client, over: Record<string, unknown>): Promise<{ id: string; key: string }> {
    const id = (over.id as string | undefined) ?? randomUUID();
    const channel = (over.channel as string | undefined) ?? 'SMS';
    const groupKey = (over.group_key as string | undefined) ?? `INV-NOTIF:${id}`;
    const key = (over.idempotency_key as string | undefined) ?? `${groupKey}:${channel}`;
    const row: Record<string, unknown> = {
        type: 'PASSWORD_CHANGED',
        family: 'ESSENTIAL',
        topic: null,
        origin: 'OUTBOX',
        template_data: {},
        status: 'PENDING',
        attempts: 0,
        max_attempts: 5,
        due_at: NOW,
        next_attempt_at: NOW,
        ...(channel === 'SMS' && over.recipient_user_id === undefined && over.recipient_phone === undefined
            ? { recipient_phone: randomSenegalPhone('76') } : {}),
        ...over,
        id,
        channel,
        group_key: groupKey,
        idempotency_key: key,
    };
    await insertRow(db, 'public.notification_outbox', row);
    FABRICATED.add(id);
    FABRICATED.add(key);
    return { id, key };
}

/**
 * Prépare la transaction : schéma du lot présent (échec explicite sinon), triggers utilisateur coupés,
 * contraintes demandées supprimées (annulé avec la transaction).
 */
async function prepare(db: Client, label: string, dropConstraints: string[] = []): Promise<void> {
    await assertNotificationSchema(`notif-invariant ${label}`, db);
    for (const table of ['notification_outbox', 'events', 'event_status_history', 'ticket_categories', 'tickets', 'ticket_transfers']) {
        await db.query(`ALTER TABLE public.${table} DISABLE TRIGGER USER`);
    }
    for (const c of dropConstraints) await db.query(`ALTER TABLE public.notification_outbox DROP CONSTRAINT ${c}`);
}

/** Instantané conforme d'un rappel envoyé (contrat C3) ; `over` remplace des sous-objets. */
function reminderDecision(validTicketIds: string[], over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        at: new Date().toISOString(),
        stage: 'CLAIM',
        outcome: 'SEND',
        family: 'OPTIONAL',
        topic: 'REMINDERS',
        account: { status: 'ACTIF', blocked: false },
        preference: { topic: 'REMINDERS', channel: 'IN_APP', enabled: true },
        event: { status: 'PUBLIE' },
        holder: { valid_ticket_ids: validTicketIds },
        ...over,
    };
}

function sentReminder(type: 'REMINDER_J1' | 'REMINDER_H3', userId: string, eventId: string | null, sentAt: Sql, decision: Record<string, unknown>): Record<string, unknown> {
    return {
        type,
        family: 'OPTIONAL',
        topic: 'REMINDERS',
        channel: 'IN_APP',
        recipient_user_id: userId,
        event_id: eventId,
        status: 'SENT',
        attempts: 1,
        claimed_at: sentAt,
        sent_at: sentAt,
        finished_at: sentAt,
        decision,
    };
}

function isoDate(daysFromNow: number): string {
    return new Date(Date.now() + daysFromNow * 24 * 3600_000).toISOString().slice(0, 10);
}

/** Événement à J+40 inséré directement (triggers coupés), avec une catégorie ; renvoie l'id de la catégorie. */
async function insertEventWithCategory(db: Client, fx: Fixtures, eventId: string, status: 'PUBLIE' | 'SUSPENDU'): Promise<string> {
    await db.query(
        `INSERT INTO public.events (id, partner_id, title, start_date, start_time, end_date, end_time, location, city, status)
         VALUES ($1, $2, $3, $4::date, '20:00:00', $4::date, '23:00:00', 'Salle de test, Dakar', 'Dakar', $5)`,
        [eventId, fx.partners.A.id, `TEST Invariant notif ${eventId.slice(0, 8)}`, isoDate(40), status]);
    const { rows } = await db.query<{ id: string }>(
        `INSERT INTO public.ticket_categories (event_id, name, price, total_quantity, sold_quantity)
         VALUES ($1, 'Standard', 5000, 10, 1) RETURNING id`, [eventId]);
    return rows[0].id;
}

/** Ligne d'historique horodatée à now() + `offset` (intervalle SQL, ex. '-3 hours'). */
async function insertHistory(db: Client, eventId: string, offset: string, old: string | null, next: string,
    channel: 'CREATION' | 'TRANSITION'): Promise<void> {
    await db.query(
        `INSERT INTO public.event_status_history (event_id, old_status, new_status, actor_role, channel, created_at)
         VALUES ($1, $2, $3, 'SYSTEM', $4, now() + $5::interval)`,
        [eventId, old, next, channel, offset]);
}

async function insertTicket(db: Client, eventId: string, categoryId: string, userId: string): Promise<string> {
    const id = randomUUID();
    await db.query(
        `INSERT INTO public.tickets (id, event_id, category_id, user_id, ticket_number, price, qr_code, status)
         VALUES ($1, $2, $3, $4, $5, 5000, $6, 'VALIDE')`,
        [id, eventId, categoryId, userId, `TCK-INV-NOTIF-${id.slice(0, 8)}`, `EV-QR-INV-NOTIF-${id}`]);
    return id;
}

function has(rows: NotificationViolation[], regle: string, objet: string, detail?: RegExp): boolean {
    return rows.some((r) => r.regle === regle && r.objet === objet && (detail === undefined || detail.test(String(r.detail))));
}

function about(rows: NotificationViolation[], objet: string): string {
    return JSON.stringify(rows.filter((r) => r.objet === objet));
}

function assertClean(rows: NotificationViolation[], objet: string, what: string): void {
    assert.deepEqual(rows.filter((r) => r.objet === objet), [], `${what} : aucune violation attendue pour le témoin conforme : ${about(rows, objet)}`);
}

// ── Violations fabriquées ──────────────────────────────────────────────────

describe('6.11 Invariants (m)(n)(o) : chaque règle détecte une violation fabriquée (transaction annulée)', () => {
    test('(m) une seule ligne SENT ou SENDING par clé ; aucune ligne optionnelle SENT sans préférence activée', async () => {
        const fx = await loadFixtures();
        const client = fx.users.CLIENT.id;
        const other = fx.users.CLIENT_BIS.id;
        const dupKey = `INV-NOTIF-M1:${randomUUID()}:SMS`;
        const mixedKey = `INV-NOTIF-M1B:${randomUUID()}:SMS`;
        let ids: Record<string, string> = {};

        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, '(m)', ['notification_outbox_idempotency_key_key']);
            // Préférences propres à la transaction : aucune ligne réelle ne vient brouiller (m3).
            await db.query(`DELETE FROM public.notification_preferences WHERE user_id = ANY($1::uuid[]) AND topic = 'EVENT_UPDATES' AND channel = 'IN_APP'`, [[client, other]]);
            const sentSms = { status: 'SENT', attempts: 1, claimed_at: NOW, sent_at: NOW, finished_at: NOW };
            // (m1) deux lignes SENT de même clé
            const dupA = await insertOutbox(db, { ...sentSms, group_key: dupKey.replace(/:SMS$/, ''), idempotency_key: dupKey });
            await insertOutbox(db, { ...sentSms, group_key: dupKey.replace(/:SMS$/, ''), idempotency_key: dupKey });
            // (m1) une ligne SENT et une ligne SENDING de même clé
            await insertOutbox(db, { ...sentSms, group_key: mixedKey.replace(/:SMS$/, ''), idempotency_key: mixedKey });
            await insertOutbox(db, { status: 'SENDING', attempts: 1, claimed_at: NOW, claim_token: randomUUID(),
                group_key: mixedKey.replace(/:SMS$/, ''), idempotency_key: mixedKey });
            // témoin (m1) : une seule ligne SENT pour sa clé
            const single = await insertOutbox(db, sentSms);
            const optionalInApp = (userId: string, sentAt: Sql, enabled: boolean): Record<string, unknown> => ({
                type: 'EVENT_CHANGED', family: 'OPTIONAL', topic: 'EVENT_UPDATES', channel: 'IN_APP', recipient_user_id: userId,
                status: 'SENT', attempts: 1, claimed_at: sentAt, sent_at: sentAt, finished_at: sentAt,
                decision: { stage: 'CLAIM', outcome: 'SEND', family: 'OPTIONAL', topic: 'EVENT_UPDATES',
                    preference: { topic: 'EVENT_UPDATES', channel: 'IN_APP', enabled } },
            });
            // (m2) ligne optionnelle SENT dont l'instantané dit « préférence désactivée »
            const m2 = await insertOutbox(db, optionalInApp(client, IN_ONE_HOUR, false));
            // (m2) ligne optionnelle SENT sans préférence dans l'instantané
            const m2b = await insertOutbox(db, { ...optionalInApp(client, IN_ONE_HOUR, true), decision: { stage: 'CLAIM', outcome: 'SEND' } });
            // (m3) préférence désactivée 2 h avant l'envoi, instantané (faux) « activée »
            await db.query(
                `INSERT INTO public.notification_preferences (user_id, topic, channel, enabled, updated_at)
                 VALUES ($1, 'EVENT_UPDATES', 'IN_APP', false, now() - interval '2 hours')`, [other]);
            const m3 = await insertOutbox(db, optionalInApp(other, HOUR_AGO, true));
            // témoin (m2)(m3) : préférence activée dans l'instantané, aucune ligne de préférence
            const witness = await insertOutbox(db, optionalInApp(client, HOUR_AGO, true));
            ids = { dupA: dupA.id, single: single.key, m2: m2.id, m2b: m2b.id, m3: m3.id, witness: witness.id };
            return notificationViolations(db);
        });

        assert.ok(has(rows, 'm', dupKey, /^plusieurs lignes SENT ou SENDING pour la même clé \(2\)$/), `(m1) deux SENT : ${about(rows, dupKey)}`);
        assert.ok(has(rows, 'm', mixedKey, /^plusieurs lignes SENT ou SENDING pour la même clé \(2\)$/), `(m1) SENT et SENDING : ${about(rows, mixedKey)}`);
        assert.ok(has(rows, 'm', ids.m2, /^ligne optionnelle SENT sans préférence activée dans l'instantané$/), `(m2) préférence désactivée dans l'instantané : ${about(rows, ids.m2)}`);
        assert.ok(has(rows, 'm', ids.m2b, /^ligne optionnelle SENT sans préférence activée dans l'instantané$/), `(m2) instantané sans préférence : ${about(rows, ids.m2b)}`);
        assert.ok(has(rows, 'm', ids.m3, /^ligne optionnelle SENT alors que la préférence était désactivée depuis /), `(m3) préférence désactivée avant l'envoi : ${about(rows, ids.m3)}`);
        assertClean(rows, ids.single, '(m1) clé unique');
        assertClean(rows, ids.witness, '(m2)(m3) préférence activée');
    });

    test('(n) rappels : événement non PUBLIE, porteur sans billet VALIDE, SMS optionnel dans la plage de silence', async () => {
        const fx = await loadFixtures();
        const a = fx.users.CLIENT.id;
        const b = fx.users.CLIENT_BIS.id;
        const ev = { suspended: randomUUID(), transferred: randomUUID(), witness: randomUUID() };
        let ids: Record<string, string> = {};

        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, '(n)');
            await db.query(`DELETE FROM public.notification_preferences WHERE user_id = ANY($1::uuid[])`, [[a, b]]);
            // E1 : PUBLIE 3 h avant, SUSPENDU 2 h avant (l'historique contredit un instantané « PUBLIE »)
            const catSusp = await insertEventWithCategory(db, fx, ev.suspended, 'SUSPENDU');
            await insertHistory(db, ev.suspended, '-5 hours', null, 'BROUILLON', 'CREATION');
            await insertHistory(db, ev.suspended, '-3 hours', 'VALIDE', 'PUBLIE', 'TRANSITION');
            await insertHistory(db, ev.suspended, '-2 hours', 'PUBLIE', 'SUSPENDU', 'TRANSITION');
            const ticketSusp = await insertTicket(db, ev.suspended, catSusp, a);
            // E2 : PUBLIE ; le billet de A est transféré à B (réclamé 2 h avant l'envoi du rappel à A)
            const catTr = await insertEventWithCategory(db, fx, ev.transferred, 'PUBLIE');
            await insertHistory(db, ev.transferred, '-5 hours', null, 'BROUILLON', 'CREATION');
            await insertHistory(db, ev.transferred, '-3 hours', 'VALIDE', 'PUBLIE', 'TRANSITION');
            const ticketTr = await insertTicket(db, ev.transferred, catTr, b);
            await db.query(
                `INSERT INTO public.ticket_transfers (ticket_id, from_user_id, to_user_id, to_phone_or_email, status, claim_token_hash,
                                                      created_at, expires_at, claimed_at)
                 VALUES ($1, $2, $3, $4, 'CLAIMED', $5, now() - interval '150 minutes', now() + interval '46 hours', now() - interval '2 hours')`,
                [ticketTr, a, b, fx.users.CLIENT_BIS.phone, randomBytes(32).toString('hex')]);
            // E3 : témoin, PUBLIE, billet VALIDE de A
            const catW = await insertEventWithCategory(db, fx, ev.witness, 'PUBLIE');
            await insertHistory(db, ev.witness, '-5 hours', null, 'BROUILLON', 'CREATION');
            await insertHistory(db, ev.witness, '-3 hours', 'VALIDE', 'PUBLIE', 'TRANSITION');
            const ticketW = await insertTicket(db, ev.witness, catW, a);

            // (n1) instantané SUSPENDU ; envoi daté dans le futur (horloge simulée) : n2 et n4 ne s'appliquent pas
            const n1 = await insertOutbox(db, sentReminder('REMINDER_H3', a, null, IN_ONE_HOUR,
                reminderDecision([ticketW], { event: { status: 'SUSPENDU' } })));
            // (n2) instantané PUBLIE, mais l'historique donne SUSPENDU 2 h avant l'envoi
            const n2 = await insertOutbox(db, sentReminder('REMINDER_J1', a, ev.suspended, HOUR_AGO, reminderDecision([ticketSusp])));
            // (n3) aucun billet VALIDE dans l'instantané
            const n3 = await insertOutbox(db, sentReminder('REMINDER_J1', a, null, IN_ONE_HOUR, reminderDecision([])));
            // (n4) le seul billet de l'instantané a été réclamé par B avant l'envoi à A
            const n4 = await insertOutbox(db, sentReminder('REMINDER_H3', a, ev.transferred, HOUR_AGO, reminderDecision([ticketTr])));
            // (n5) SMS optionnel SENT à 23:00 Dakar, plage 22 h - 8 h
            const smsOptional = (sentAt: Sql, decision: Record<string, unknown>): Record<string, unknown> => ({
                type: 'EVENT_CHANGED', family: 'OPTIONAL', topic: 'EVENT_UPDATES', channel: 'SMS', recipient_phone: randomSenegalPhone('76'),
                status: 'SENT', attempts: 1, claimed_at: sentAt, sent_at: sentAt, finished_at: sentAt, decision,
            });
            const smsPref = { topic: 'EVENT_UPDATES', channel: 'SMS', enabled: true };
            const n5 = await insertOutbox(db, smsOptional(YESTERDAY_23H_DAKAR,
                { stage: 'CLAIM', outcome: 'SEND', preference: smsPref, quiet: { start: 22, end: 8, hour: 23, in_quiet: true } }));
            // (n5) SMS optionnel SENT sans plage de silence dans l'instantané
            const n5b = await insertOutbox(db, smsOptional(YESTERDAY_NOON_DAKAR, { stage: 'CLAIM', outcome: 'SEND', preference: smsPref }));
            // témoins : rappel conforme (E3, billet VALIDE de A) et SMS optionnel à midi avec la plage 22 h - 8 h
            const wReminder = await insertOutbox(db, sentReminder('REMINDER_J1', a, ev.witness, HOUR_AGO, reminderDecision([ticketW])));
            const wSms = await insertOutbox(db, smsOptional(YESTERDAY_NOON_DAKAR,
                { stage: 'CLAIM', outcome: 'SEND', preference: smsPref, quiet: { start: 22, end: 8, hour: 12, in_quiet: false } }));
            ids = { n1: n1.id, n2: n2.id, n3: n3.id, n4: n4.id, n5: n5.id, n5b: n5b.id, wReminder: wReminder.id, wSms: wSms.id };
            return notificationViolations(db);
        });

        assert.ok(has(rows, 'n', ids.n1, /^rappel SENT pour un événement non PUBLIE à l'envoi \(instantané : SUSPENDU\)$/), `(n1) instantané SUSPENDU : ${about(rows, ids.n1)}`);
        assert.ok(has(rows, 'n', ids.n2, /^rappel SENT alors que l'historique donne SUSPENDU à l'envoi$/), `(n2) historique SUSPENDU : ${about(rows, ids.n2)}`);
        assert.ok(has(rows, 'n', ids.n3, /^rappel SENT à un compte sans billet VALIDE dans l'instantané$/), `(n3) sans billet : ${about(rows, ids.n3)}`);
        assert.ok(has(rows, 'n', ids.n4, /^rappel SENT alors qu'aucun des billets de l'instantané n'était au compte et VALIDE à l'envoi$/), `(n4) billet transféré : ${about(rows, ids.n4)}`);
        assert.ok(has(rows, 'n', ids.n5, /^SMS optionnel SENT dans la plage de silence \(22 h - 8 h\)$/), `(n5) 23:00 Dakar : ${about(rows, ids.n5)}`);
        // Plage absente de l'instantané : la règle la signale ; le texte du détail n'est pas exigé (voir la réponse de l'écrivain).
        assert.ok(has(rows, 'n', ids.n5b), `(n5) instantané sans plage de silence : ${about(rows, ids.n5b)}`);
        assert.ok(!has(rows, 'n', ids.n1, /historique|aucun des billets/), `(n1) envoi daté dans le futur : (n2)(n4) ne s'appliquent pas : ${about(rows, ids.n1)}`);
        assert.ok(!has(rows, 'n', ids.n2, /aucun des billets/), `(n2) le billet de l'instantané est bien au compte : ${about(rows, ids.n2)}`);
        assertClean(rows, ids.wReminder, '(n) rappel conforme');
        assertClean(rows, ids.wSms, '(n5) SMS optionnel à midi');
    });

    test('(o) SENDING de plus de 10 min, tentatives au-delà du maximum, ligne terminée sans motif', async () => {
        let ids: Record<string, string> = {};
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, '(o)', ['notification_outbox_attempts_chk', 'notification_outbox_reason_chk']);
            // (o1) SENDING depuis 11 min ; témoin : 9 min
            const o1 = await insertOutbox(db, { status: 'SENDING', attempts: 1, claimed_at: sql(`now() - interval '11 minutes'`), claim_token: randomUUID() });
            const w1 = await insertOutbox(db, { status: 'SENDING', attempts: 1, claimed_at: sql(`now() - interval '9 minutes'`), claim_token: randomUUID() });
            // (o2) 6 tentatives pour un maximum de 5 ; maximum de 6
            const o2 = await insertOutbox(db, { status: 'PENDING', attempts: 6, max_attempts: 5 });
            const o2b = await insertOutbox(db, { status: 'PENDING', attempts: 1, max_attempts: 6 });
            // (o3) FAILED sans motif ; SKIPPED au motif blanc ; témoin : FAILED avec motif après 5 tentatives
            const o3 = await insertOutbox(db, { status: 'FAILED', attempts: 5, reason: null, finished_at: NOW });
            const o3b = await insertOutbox(db, { status: 'SKIPPED', attempts: 0, reason: '   ', finished_at: NOW });
            const w3 = await insertOutbox(db, { status: 'FAILED', attempts: 5, reason: 'SMS_REJECTED', reason_detail: 'code 102', finished_at: NOW });
            ids = { o1: o1.id, w1: w1.id, o2: o2.id, o2b: o2b.id, o3: o3.id, o3b: o3b.id, w3: w3.id };
            return notificationViolations(db);
        });

        assert.ok(has(rows, 'o', ids.o1, /^SENDING depuis .+ après le passage de l'envoyeur$/), `(o1) SENDING depuis 11 min : ${about(rows, ids.o1)}`);
        assert.ok(has(rows, 'o', ids.o2, /^tentatives 6 > maximum 5$/), `(o2) 6 tentatives sur 5 : ${about(rows, ids.o2)}`);
        assert.ok(has(rows, 'o', ids.o2b, /^tentatives 1 > maximum 6$/), `(o2) maximum de 6 : ${about(rows, ids.o2b)}`);
        assert.ok(has(rows, 'o', ids.o3, /^ligne FAILED sans motif$/), `(o3) FAILED sans motif : ${about(rows, ids.o3)}`);
        assert.ok(has(rows, 'o', ids.o3b, /^ligne SKIPPED sans motif$/), `(o3) SKIPPED au motif blanc : ${about(rows, ids.o3b)}`);
        assertClean(rows, ids.w1, '(o1) SENDING depuis 9 min');
        assertClean(rows, ids.w3, '(o3) FAILED avec motif');
    });
});

// ── Après ROLLBACK ─────────────────────────────────────────────────────────

describe('6.11 Invariants (m)(n)(o) sur l’état réel', () => {
    test('après ROLLBACK, aucune ligne fabriquée ne reste dans la boîte d’envoi ni dans les violations', async () => {
        assert.ok(FABRICATED.size > 0, 'les garde-fous ci-dessus ont fabriqué des lignes');
        const ids = Array.from(FABRICATED).filter((v) => /^[0-9a-f-]{36}$/.test(v));
        const left = await inspect(async (db) => {
            await assertNotificationSchema('notif-invariant après ROLLBACK', db);
            return (await db.query<{ id: string }>('SELECT id::text AS id FROM public.notification_outbox WHERE id = ANY($1::uuid[])', [ids])).rows;
        });
        assert.deepEqual(left, [], `lignes fabriquées encore présentes après ROLLBACK : ${JSON.stringify(left)}`);
        const rows = await notificationViolations();
        const leaked = rows.filter((r) => FABRICATED.has(r.objet));
        assert.deepEqual(leaked, [], `violations fabriquées visibles après ROLLBACK : ${JSON.stringify(leaked)}`);
    });
});
