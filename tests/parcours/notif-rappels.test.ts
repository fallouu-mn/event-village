/**
 * Lot 6, tâche 6.5 — rappels J-1 et H-3 et rappel du contrôleur (contrat I2, I3, I5, E1 pour la
 * revérification à l'envoi, F4 pour le push, G3/G4 pour les textes ; décisions 21 à 26 ; section Y).
 * Horloge simulée : seulement par `now` de scheduleAt / dispatchAt (notif-helpers), jamais dans le passé ;
 * aucune attente réelle. Les planifications et les envois sont filtrés par événement (onlyEventIds) :
 * aucune ligne d'une autre suite n'est touchée. Les envois se comptent par numéro neuf (newBuyer,
 * newController) ou par appareil neuf, et par texte exact du catalogue, jamais globalement.
 *
 * Événements à date exacte (createReminderEvent) : début J+3 à 20:00 (Dakar = UTC) pour les cas à horloge
 * future ; début dans 2 h 50 à 3 h 10 pour les cas qui dépendent de l'heure réelle (achat tardif, scan,
 * attente de la ligne PUSH par le SMS IF_NO_PUSH, dont l'âge se mesure sur created_at).
 *  - J-1 : rien à 09:59 la veille, créé à 10:00 (une ligne par canal I P S M, clé
 *    `REMINDER_J1:<event>:<user>:<début AAAAMMJJTHHMMZ>:<canal>`, échéance 10:00, données du modèle) ;
 *    tolérance de 15 min : premier passage à 10:14 crée, premier passage à 10:16 ne crée rien, ni ensuite ;
 *  - H-3 : rien à début - 3 h - 1 min, créé à début - 3 h (canaux I P S, politique IF_NO_PUSH), le J-1
 *    n'est pas rattrapé ; `notif.reminder_h3_hours = 5` déplace l'échéance ; rappels désactivés → rien ;
 *  - plage de silence (J-1 réglé à 7 h) : application et push envoyés, SMS SKIPPED QUIET_HOURS (instantané
 *    `quiet.in_quiet`), aucun report à 08:05 ; textes in-app et push du J-1 ;
 *  - achat tardif à l'heure réelle (événement dans 2 h 50 : échéance du H-3 dépassée de 10 min) → aucun
 *    rappel ; témoin acheté avant l'échéance (événement dans 3 h 05) → rappel ;
 *  - 5 billets d'un compte → une ligne par canal ; deux planifications et deux envois → aucun doublon,
 *    un seul SMS au texte exact, instantané `holder.valid_ticket_ids` de 5 billets ;
 *  - billets UTILISE (scannés) → pas de H-3 pour un compte sans billet VALIDE ; un billet VALIDE suffit ;
 *  - invitation → rappel ; billet de guichet (sans porteur) → rien ; compte suspendu → lignes tracées
 *    SKIPPED ACCOUNT_SUSPENDED ;
 *  - `notif.j1_sms = NEVER` → SMS SKIPPED SMS_POLICY_NEVER dès la planification ;
 *  - `notif.h3_sms = IF_NO_PUSH` : push accepté → SMS SKIPPED PUSH_DELIVERED ; sans appareil → push
 *    SKIPPED NO_PUSH_SUBSCRIPTION et SMS envoyé (texte exact) ; push du H-3 urgent, TTL jusqu'au début ;
 *  - rappel du contrôleur la veille à 18:00 : une ligne par affectation, point d'entrée (ou « à préciser »)
 *    et permission espèces dans les textes ;
 *  - réglage notif.* absent : la planification lève (transaction annulée, décision 25) ;
 *  - route /api/cron/reminders : 503, 401, 200 ; contrôles statiques (I3, mêmes règles qu'E5).
 *
 * Rouge avant correctif : lib/notifications/reminders.ts (scheduleReminders), la RPC
 * notification_reminders_schedule, la boîte d'envoi, l'envoyeur, push_subscriptions et la route
 * app/api/cron/reminders n'existent pas : scheduleAt échoue « planificateur des rappels (contrat I3)
 * absent », la route est absente, la transaction de la décision 25 ne trouve pas la RPC.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { inRolledBackTransaction } from '../helpers/db';
import { getFakes } from '../fakes';
import { BASE_URL } from './helpers';
import { cronRequest, newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { newController, scan, ticketPayload, ticketRow } from './acces-helpers';
import {
    assertNotificationInvariants, createReminderEvent, dakarAt, dakarDay, dispatchAt, fakeBrowserSubscription,
    loadLotModule, newVapidKeys, outboxRows, pushTo, scheduleAt, smsMark, smsTo, withEnv, withNotifSettings, withVapid,
    type FakeBrowserSubscription, type OutboxChannel, type OutboxRow, type OutboxStatus, type ReminderEvent,
    type ScheduleReport, type VapidKeys,
} from './notif-helpers';

after(async () => {
    await assertNotificationInvariants('notif-rappels');
});

// ── Constantes du contrat ──────────────────────────────────────────────────

type Row = Record<string, unknown>;
type ReminderType = 'REMINDER_J1' | 'REMINDER_H3' | 'CONTROLLER_REMINDER';

const MIN = 60_000;
const HOUR = 60 * MIN;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
const LOCATION = 'Salle Sorano';
const CITY = 'Dakar';
const STANDARD = 'Standard';
const FREE = 'Entree libre';
const CATEGORIES: CategorySpec[] = [{ name: STANDARD, price: 5_000, total: 50 }, { name: FREE, price: 0, total: 50 }];
const REMINDER_TYPES: ReminderType[] = ['REMINDER_J1', 'REMINDER_H3', 'CONTROLLER_REMINDER'];
const J1_CHANNELS: OutboxChannel[] = ['EMAIL', 'IN_APP', 'PUSH', 'SMS'];
const H3_CHANNELS: OutboxChannel[] = ['IN_APP', 'PUSH', 'SMS'];
const CTRL_CHANNELS: OutboxChannel[] = ['IN_APP', 'PUSH', 'SMS'];
/** Jour du début des événements à horloge future, et sa veille (Dakar). */
const EVENT_DAY = dakarDay(3);
const EVE = dakarDay(2);

const J1_TITLE = "Rappel : c'est demain";
const H3_TITLE = "C'est bientôt";
const CTRL_TITLE = 'Contrôle demain';

const ROUTE_MODULE = '../../app/api/cron/reminders/route';
const ROUTE_FILE = path.join(process.cwd(), 'app', 'api', 'cron', 'reminders', 'route.ts');

let partner: TestPartner;

before(async () => {
    assert.ok(APP_URL.startsWith('http'), 'NEXT_PUBLIC_APP_URL absente de .env.test');
    partner = await newPartner('rappels');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function hhmm(d: Date): string {
    return d.toISOString().slice(11, 16);
}

/** Début de l'événement dans la clé d'idempotence (contrat I2 : AAAAMMJJ"T"HH24MI"Z", UTC). */
function startKey(d: Date): string {
    const iso = d.toISOString();
    return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;
}

/** Instant à la minute pleine, dans `minutes` minutes (heure réelle). */
function inMinutes(minutes: number): Date {
    return new Date(Math.ceil((Date.now() + minutes * MIN) / MIN) * MIN);
}

function plusSeconds(d: Date, s: number): Date {
    return new Date(d.getTime() + s * 1000);
}

/** Titre court en GSM-7 de base (≤ 25 caractères : aucune troncature smsVar, G3). */
function shortTitle(prefix: string): string {
    const t = `${prefix} ${randomBytes(3).toString('hex')}`;
    assert.ok(t.length <= 25 && /^[A-Za-z0-9 ]+$/.test(t), `titre de test « ${t} » : 25 caractères GSM-7 au plus`);
    return t;
}

/** Événement PUBLIE du partenaire de la suite ; début par défaut J+3 à 20:00 (Dakar). */
async function reminderEvent(prefix: string, startAt: Date = dakarAt(EVENT_DAY, '20:00')): Promise<ReminderEvent> {
    const iso = startAt.toISOString();
    return createReminderEvent(partner, `rappels-${prefix}`, {
        startDate: iso.slice(0, 10), startTime: iso.slice(11, 19), categories: CATEGORIES,
        title: shortTitle(prefix), location: LOCATION, city: CITY,
    });
}

/**
 * Billet à 0 F émis directement (service_role), stock vendu + 1 : FREE (porteur ordinaire), INVITATION
 * (contrat C7 du lot 5) ou COUNTER sans porteur (vente au guichet, tickets_holder_or_counter).
 */
async function giveTicket(ev: ReminderEvent, holder: Buyer | null, channel: 'FREE' | 'INVITATION' | 'COUNTER' = 'FREE'): Promise<string> {
    const cat = ev.categories[channel === 'FREE' ? FREE : STANDARD];
    const { data, error } = await service.from('tickets').insert({
        event_id: ev.eventId, category_id: cat.id, user_id: holder?.userId ?? null, price: 0, status: 'VALIDE', sale_channel: channel,
        ticket_number: `TCK-RAP-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
        qr_code: `EV-QR-RAP-${randomUUID()}`,
    }).select('id').single();
    assert.equal(error, null, `billet ${channel} : ${error?.message}`);
    const { data: c, error: cErr } = await service.from('ticket_categories').select('sold_quantity').eq('id', cat.id).single();
    assert.equal(cErr, null, `stock : ${cErr?.message}`);
    const { error: uErr } = await service.from('ticket_categories').update({ sold_quantity: Number(c.sold_quantity) + 1 }).eq('id', cat.id);
    assert.equal(uErr, null, `stock vendu : ${uErr?.message}`);
    return data.id as string;
}

async function holderWithTicket(ev: ReminderEvent, label: string): Promise<Buyer> {
    const holder = await newBuyer(`rap-${label}`);
    await giveTicket(ev, holder);
    return holder;
}

function createdOf(r: ScheduleReport, type: ReminderType): number {
    const v = r.created?.[type];
    assert.equal(typeof v, 'number', `rapport de planification : created.${type} numérique attendu (${JSON.stringify(r)})`);
    return v;
}

async function eventReminders(ev: ReminderEvent): Promise<OutboxRow[]> {
    return outboxRows({ type: REMINDER_TYPES, eventId: ev.eventId });
}

function byChannel(rows: OutboxRow[], what: string): Record<OutboxChannel, OutboxRow> {
    const out = {} as Record<OutboxChannel, OutboxRow>;
    for (const r of rows) {
        assert.equal(out[r.channel], undefined, `${what} : deux lignes pour le canal ${r.channel}`);
        out[r.channel] = r;
    }
    return out;
}

interface ExpectedReminder {
    due: Date;
    channels: OutboxChannel[];
    smsPolicy?: 'ALWAYS' | 'IF_NO_PUSH' | 'NEVER';
    /** Statut attendu de chaque ligne (défaut : PENDING). */
    status?: OutboxStatus;
}

/**
 * Lignes d'un rappel pour un compte : une par canal attendu, clé `<TYPE>:<event>:<user>:<début>:<canal>`,
 * famille OPTIONAL, sujet REMINDERS, échéance, données du modèle (I2). Renvoie les lignes par canal.
 */
async function assertReminderRows(type: ReminderType, ev: ReminderEvent, userId: string, exp: ExpectedReminder): Promise<Record<OutboxChannel, OutboxRow>> {
    const what = `${type} de ${userId} (événement ${ev.title})`;
    const rows = await outboxRows({ type, eventId: ev.eventId, userId });
    assert.deepEqual(rows.map((r) => r.channel).sort(), [...exp.channels].sort(), `${what} : une ligne par canal ${exp.channels.join(', ')} (reçu ${JSON.stringify(rows.map((r) => `${r.channel}:${r.status}`))})`);
    const group = `${type}:${ev.eventId}:${userId}:${startKey(ev.startAt)}`;
    for (const r of rows) {
        assert.equal(r.group_key, group, `${what} : group_key`);
        assert.equal(r.idempotency_key, `${group}:${r.channel}`, `${what} : clé d'idempotence`);
        assert.equal(r.family, 'OPTIONAL', `${what} : famille`);
        assert.equal(r.topic, 'REMINDERS', `${what} : sujet`);
        assert.equal(r.origin, 'OUTBOX', `${what} : origine`);
        assert.equal(Date.parse(r.due_at), exp.due.getTime(), `${what} ${r.channel} : échéance ${r.due_at}, attendu ${exp.due.toISOString()}`);
        if (exp.status) assert.equal(r.status, exp.status, `${what} ${r.channel} : statut ${r.status} (${r.reason})`);
        const d = r.template_data;
        assert.equal(d.event_id, ev.eventId, `${what} : template_data.event_id`);
        assert.equal(d.title, ev.title, `${what} : template_data.title`);
        assert.equal(Date.parse(String(d.start_at)), ev.startAt.getTime(), `${what} : template_data.start_at ${String(d.start_at)}`);
        assert.equal(d.location, LOCATION, `${what} : template_data.location`);
        if (type !== 'CONTROLLER_REMINDER') assert.equal(d.city, CITY, `${what} : template_data.city`);
        if (exp.smsPolicy) assert.equal(d.sms_policy, exp.smsPolicy, `${what} : template_data.sms_policy`);
    }
    return byChannel(rows, what);
}

async function freshRow(id: string): Promise<OutboxRow> {
    const rows = await outboxRows({ ids: [id] });
    assert.equal(rows.length, 1, `ligne ${id} introuvable`);
    return rows[0];
}

function assertStatus(r: OutboxRow, status: OutboxStatus, reason: string | null, what: string): void {
    assert.equal(r.status, status, `${what} : statut ${r.status} (motif ${r.reason}), attendu ${status}${reason ? ` ${reason}` : ''}`);
    if (reason !== null) assert.equal(r.reason, reason, `${what} : motif`);
}

/** Notification de la cloche écrite par le marquage de la ligne IN_APP (contrat E2 : notification_id). */
async function inAppOf(row: OutboxRow): Promise<Row> {
    const fresh = await freshRow(row.id);
    assertStatus(fresh, 'SENT', null, `IN_APP ${fresh.type}`);
    assert.ok(fresh.notification_id, `IN_APP ${fresh.type} : notification_id posé par le marquage`);
    const { data, error } = await service.from('notifications').select('*').eq('id', fresh.notification_id).single();
    assert.equal(error, null, `notification ${fresh.notification_id} : ${error?.message}`);
    const n = data as Row;
    assert.equal(n.user_id, fresh.recipient_user_id, 'notification au destinataire de la ligne');
    assert.equal(n.channel, 'IN_APP', 'notifications.channel IN_APP (contrat F1)');
    assert.equal((n.metadata as Row | null)?.outbox_id, fresh.id, 'metadata.outbox_id');
    return n;
}

/** Espaces insécables et apostrophe typographique ramenés à leur forme simple (comparaison in-app et push). */
function norm(s: unknown): string {
    return String(s).replace(/[  ]/g, ' ').replace(/’/g, "'");
}

function esc(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Heure in-app : « 20:00 » ou « 20 h 00 » (le format exact de {h} n'est pas fixé par G4). */
function timeRe(d: Date): string {
    const [h, m] = hhmm(d).split(':');
    return `${h}(?::| ?h ?)${m}`;
}

// Textes exacts des SMS (catalogue G3 ; variables courtes en GSM-7 : aucune troncature).
function j1Sms(ev: ReminderEvent): string {
    return `Event Village : rappel, ${ev.title} demain à ${hhmm(ev.startAt)}, ${LOCATION}. Vos billets : ${APP_URL}/tickets`;
}
function h3Sms(ev: ReminderEvent): string {
    return `Event Village : ${ev.title} à ${hhmm(ev.startAt)}. Ouvrez votre billet avant d'arriver : QR renouvelé toutes les 20 s. ${APP_URL}/tickets`;
}
function controllerSms(ev: ReminderEvent, point: string | null, cash: boolean): string {
    return `Event Village : demain ${ev.title} à ${hhmm(ev.startAt)}, point ${point ?? 'à préciser'}, espèces ${cash ? 'autorisées' : 'non autorisées'}. Connexion : ${APP_URL}/login`;
}

// Contenus in-app (catalogue G4), comparés après norm().
function j1InAppRe(ev: ReminderEvent): RegExp {
    return new RegExp(`^« ${esc(ev.title)} » demain à ${timeRe(ev.startAt)}, ${esc(LOCATION)}, ${esc(CITY)}\\. Vos billets sont dans Mes billets\\.$`);
}
function h3InAppRe(ev: ReminderEvent): RegExp {
    return new RegExp(`^« ${esc(ev.title)} » commence à ${timeRe(ev.startAt)} \\(${esc(LOCATION)}\\)\\. Ouvrez votre billet dans l'application avant d'arriver : le QR change toutes les 20 secondes et demande une connexion\\.$`);
}
function controllerInAppRe(ev: ReminderEvent, point: string | null, cash: boolean): RegExp {
    return new RegExp(`^Demain « ${esc(ev.title)} » à ${timeRe(ev.startAt)}, point d'entrée ${esc(point ?? 'à préciser')}, espèces ${cash ? 'autorisées' : 'non autorisées'}\\.$`);
}

/** Abonnement push du compte sous la clé VAPID donnée (table C5, écrit par le service_role). */
async function addDevice(userId: string, keys: VapidKeys): Promise<FakeBrowserSubscription> {
    const sub = fakeBrowserSubscription();
    const { error } = await service.from('push_subscriptions').insert({
        user_id: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, vapid_key_id: keys.keyId,
    });
    assert.equal(error, null, `abonnement push : ${error?.message} (code ${error?.code}) — table push_subscriptions du contrat C5`);
    return sub;
}

/** Deux passages de l'envoyeur, à t puis t + 61 s (section Y : le SMS IF_NO_PUSH attend la ligne PUSH). */
async function dispatchTwice(t: Date, eventIds: string[]): Promise<void> {
    await dispatchAt(t, { eventIds });
    await dispatchAt(plusSeconds(t, 61), { eventIds });
}

function remindersSmsTo(phone: string, since: number, marker: RegExp): string[] {
    return smsTo(phone, since).map((m) => m.message).filter((m) => marker.test(m));
}

// ── J-1 ────────────────────────────────────────────────────────────────────

describe('6.5 Rappel J-1 : la veille à l’heure réglée (contrat I2)', () => {
    test('rien à 09:59 la veille ; à 10:00 une ligne par canal, clé avec le début, échéance 10:00 ; pas de H-3 à cette heure', async () => {
        const ev = await reminderEvent('Veille A');
        const holder = await holderWithTicket(ev, 'j1-a');

        const early = await scheduleAt(dakarAt(EVE, '09:59'), [ev.eventId]);
        assert.equal(createdOf(early, 'REMINDER_J1'), 0, '09:59 : aucun J-1');
        assert.deepEqual(await eventReminders(ev), [], '09:59 : aucune ligne de rappel');

        const onTime = await scheduleAt(dakarAt(EVE, '10:00'), [ev.eventId]);
        assert.ok(createdOf(onTime, 'REMINDER_J1') >= 1, `10:00 : J-1 créé (${JSON.stringify(onTime)})`);
        assert.equal(createdOf(onTime, 'REMINDER_H3'), 0, '10:00 la veille : pas de H-3');
        await assertReminderRows('REMINDER_J1', ev, holder.userId, { due: dakarAt(EVE, '10:00'), channels: J1_CHANNELS, smsPolicy: 'ALWAYS', status: 'PENDING' });
        assert.equal((await eventReminders(ev)).length, J1_CHANNELS.length, 'aucune autre ligne de rappel pour cet événement');
    });

    test('tolérance de 15 min : premier passage à 10:14 → créé (échéance 10:00) ; premier passage à 10:16 → rien, ni ensuite', async () => {
        const inTolerance = await reminderEvent('Veille B');
        const hb = await holderWithTicket(inTolerance, 'j1-b');
        const late = await reminderEvent('Veille C');
        await holderWithTicket(late, 'j1-c');

        const r14 = await scheduleAt(dakarAt(EVE, '10:14'), [inTolerance.eventId]);
        assert.ok(createdOf(r14, 'REMINDER_J1') >= 1, `10:14 : J-1 créé dans la tolérance (${JSON.stringify(r14)})`);
        await assertReminderRows('REMINDER_J1', inTolerance, hb.userId, { due: dakarAt(EVE, '10:00'), channels: J1_CHANNELS, smsPolicy: 'ALWAYS', status: 'PENDING' });

        for (const t of ['10:16', '10:30', '23:59']) {
            const r = await scheduleAt(dakarAt(EVE, t), [late.eventId]);
            assert.equal(createdOf(r, 'REMINDER_J1'), 0, `${t} la veille (premier passage après 10:15) : aucun J-1`);
        }
        const r = await scheduleAt(dakarAt(EVENT_DAY, '09:00'), [late.eventId]);
        assert.equal(createdOf(r, 'REMINDER_J1'), 0, 'le jour même : aucun J-1 rattrapé');
        assert.deepEqual(await eventReminders(late), [], 'aucune ligne de rappel pour l’événement manqué');
    });

    test('rappels désactivés (notif.reminder_j1_enabled, notif.reminder_h3_enabled = false) : rien ; réactivés dans la fenêtre : créés', async () => {
        const ev = await reminderEvent('Veille Off');
        const holder = await holderWithTicket(ev, 'j1-off');
        await withNotifSettings({ 'notif.reminder_j1_enabled': false }, async () => {
            const r = await scheduleAt(dakarAt(EVE, '10:00'), [ev.eventId]);
            assert.equal(createdOf(r, 'REMINDER_J1'), 0, 'J-1 désactivé : rien');
        });
        assert.deepEqual(await eventReminders(ev), [], 'J-1 désactivé : aucune ligne');
        const again = await scheduleAt(dakarAt(EVE, '10:05'), [ev.eventId]);
        assert.ok(createdOf(again, 'REMINDER_J1') >= 1, 'J-1 réactivé dans la fenêtre : créé');
        await assertReminderRows('REMINDER_J1', ev, holder.userId, { due: dakarAt(EVE, '10:00'), channels: J1_CHANNELS, status: 'PENDING' });

        await withNotifSettings({ 'notif.reminder_h3_enabled': false }, async () => {
            const r = await scheduleAt(dakarAt(EVENT_DAY, '17:00'), [ev.eventId]);
            assert.equal(createdOf(r, 'REMINDER_H3'), 0, 'H-3 désactivé : rien');
        });
        assert.deepEqual(await outboxRows({ type: 'REMINDER_H3', eventId: ev.eventId }), [], 'H-3 désactivé : aucune ligne');
        const h3 = await scheduleAt(dakarAt(EVENT_DAY, '17:05'), [ev.eventId]);
        assert.ok(createdOf(h3, 'REMINDER_H3') >= 1, 'H-3 réactivé dans la fenêtre : créé');
    });

    test('plage de silence (J-1 réglé à 7 h) : application et push envoyés, SMS SKIPPED QUIET_HOURS sans report ; textes in-app et push', async () => {
        const ev = await reminderEvent('Veille Tot');
        const holder = await holderWithTicket(ev, 'j1-silence');
        const keys = newVapidKeys();
        const device = await addDevice(holder.userId, keys);
        const due = dakarAt(EVE, '07:00');

        await withNotifSettings({ 'notif.reminder_j1_hour': 7 }, async () => {
            const r = await scheduleAt(due, [ev.eventId]);
            assert.ok(createdOf(r, 'REMINDER_J1') >= 1, `7 h : J-1 créé (${JSON.stringify(r)})`);
        });
        const rows = await assertReminderRows('REMINDER_J1', ev, holder.userId, { due, channels: J1_CHANNELS, smsPolicy: 'ALWAYS', status: 'PENDING' });

        const mark = smsMark(holder.phoneE164);
        await withVapid(async () => {
            await dispatchTwice(due, [ev.eventId]);
            const sms = await freshRow(rows.SMS.id);
            assertStatus(sms, 'SKIPPED', 'QUIET_HOURS', 'SMS du J-1 à 7 h');
            assert.equal((sms.decision?.quiet as Row | undefined)?.in_quiet, true, `instantané : quiet.in_quiet (decision ${JSON.stringify(sms.decision)})`);
            assertStatus(await freshRow(rows.PUSH.id), 'SENT', null, 'PUSH du J-1 à 7 h');
            assert.notEqual((await freshRow(rows.EMAIL.id)).reason, 'QUIET_HOURS', 'la plage de silence ne vise que le SMS');

            // Aucun report : un passage après la fin de la plage ne renvoie rien.
            await dispatchAt(dakarAt(EVE, '08:05'), { eventIds: [ev.eventId] });
        }, keys);
        const after8 = await freshRow(rows.SMS.id);
        assertStatus(after8, 'SKIPPED', 'QUIET_HOURS', 'SMS du J-1 après 8 h (sans report)');
        assert.equal(after8.sent_at, null, 'SMS jamais envoyé');
        assert.deepEqual(remindersSmsTo(holder.phoneE164, mark, /rappel/i), [], 'aucun SMS de rappel au porteur');

        const n = await inAppOf(rows.IN_APP);
        assert.equal(norm(n.title), J1_TITLE, 'titre in-app du J-1');
        assert.equal(n.type, 'REMINDER', 'notifications.type du J-1 (inAppType REMINDER)');
        assert.match(norm(n.content), j1InAppRe(ev), 'contenu in-app du J-1 (G4)');
        assert.equal((n.metadata as Row).actionUrl, '/tickets', 'lien vers Mes billets');

        const pushes = pushTo(device.endpoint);
        assert.equal(pushes.length, 1, 'un push accepté pour l’appareil du porteur');
        assert.equal(norm(pushes[0].message.title), J1_TITLE, 'titre du push');
        assert.equal(norm(pushes[0].message.body), norm(n.content), 'corps du push = contenu in-app (≤ 160)');
        assert.equal(pushes[0].message.url, '/tickets', 'lien du push');
        assert.equal(pushes[0].message.tag, rows.PUSH.group_key, 'tag = group_key');
        assert.equal(pushes[0].options.urgency, 'normal', 'J-1 : urgence normale');
        assert.equal(pushes[0].options.ttlSeconds, 86_400, 'J-1 : TTL 86 400 s');
    });

    test('notif.j1_sms = NEVER : SMS SKIPPED SMS_POLICY_NEVER dès la planification, les autres canaux en attente', async () => {
        const ev = await reminderEvent('Veille Never');
        const holder = await holderWithTicket(ev, 'j1-never');
        await withNotifSettings({ 'notif.j1_sms': 'NEVER' }, async () => {
            const r = await scheduleAt(dakarAt(EVE, '10:00'), [ev.eventId]);
            assert.ok(createdOf(r, 'REMINDER_J1') >= 1, 'J-1 créé');
        });
        const rows = await assertReminderRows('REMINDER_J1', ev, holder.userId, { due: dakarAt(EVE, '10:00'), channels: J1_CHANNELS, smsPolicy: 'NEVER' });
        assertStatus(rows.SMS, 'SKIPPED', 'SMS_POLICY_NEVER', 'SMS du J-1 (politique NEVER)');
        assert.ok(rows.SMS.finished_at, 'SKIPPED dès l’insertion : finished_at posé');
        for (const c of ['IN_APP', 'PUSH', 'EMAIL'] as const) assertStatus(rows[c], 'PENDING', null, `${c} du J-1 (politique NEVER)`);
    });
});

// ── H-3 ────────────────────────────────────────────────────────────────────

describe('6.5 Rappel H-3 : au début moins le nombre d’heures réglé (contrat I2)', () => {
    test('rien à début - 3 h - 1 min, créé à début - 3 h (I P S, IF_NO_PUSH) ; le J-1 n’est pas rattrapé ; notif.reminder_h3_hours = 5 déplace l’échéance', async () => {
        const ev = await reminderEvent('Bientot D');
        const holder = await holderWithTicket(ev, 'h3-d');
        const early = await scheduleAt(dakarAt(EVENT_DAY, '16:59'), [ev.eventId]);
        assert.equal(createdOf(early, 'REMINDER_H3'), 0, '16:59 : aucun H-3');
        const onTime = await scheduleAt(dakarAt(EVENT_DAY, '17:00'), [ev.eventId]);
        assert.ok(createdOf(onTime, 'REMINDER_H3') >= 1, `17:00 : H-3 créé (${JSON.stringify(onTime)})`);
        assert.equal(createdOf(onTime, 'REMINDER_J1'), 0, 'le jour même : J-1 jamais rattrapé');
        await assertReminderRows('REMINDER_H3', ev, holder.userId, { due: dakarAt(EVENT_DAY, '17:00'), channels: H3_CHANNELS, smsPolicy: 'IF_NO_PUSH', status: 'PENDING' });
        assert.deepEqual(await outboxRows({ type: 'REMINDER_J1', eventId: ev.eventId }), [], 'aucun J-1');

        const five = await reminderEvent('Bientot D5');
        const h5 = await holderWithTicket(five, 'h3-d5');
        await withNotifSettings({ 'notif.reminder_h3_hours': 5 }, async () => {
            const r3 = await scheduleAt(dakarAt(EVENT_DAY, '17:00'), [five.eventId]);
            assert.equal(createdOf(r3, 'REMINDER_H3'), 0, 'réglé à 5 h : rien à début - 3 h');
            const r5 = await scheduleAt(dakarAt(EVENT_DAY, '15:00'), [five.eventId]);
            assert.ok(createdOf(r5, 'REMINDER_H3') >= 1, 'réglé à 5 h : créé à début - 5 h');
        });
        await assertReminderRows('REMINDER_H3', five, h5.userId, { due: dakarAt(EVENT_DAY, '15:00'), channels: H3_CHANNELS, status: 'PENDING' });
    });

    test('achat tardif (heure réelle) : billet acheté après l’échéance du H-3 → aucun rappel ; témoin acheté avant → rappel', async () => {
        const lateEv = await reminderEvent('Tardif', inMinutes(170));
        const lateDue = new Date(lateEv.startAt.getTime() - 3 * HOUR);
        const lateBuyer = await newBuyer('rap-tardif');
        const purchase = await buyConfirmed(lateBuyer, lateEv, [[STANDARD, 1]]);
        assert.equal(purchase.tickets.length, 1, 'un billet acheté');
        assert.ok(Date.parse(String(purchase.tickets[0].created_at)) > lateDue.getTime(), 'précondition : billet émis après l’échéance du H-3');
        const now = new Date();
        assert.ok(now.getTime() >= lateDue.getTime() && now.getTime() < lateDue.getTime() + 15 * MIN, 'précondition : fenêtre de 15 min du H-3 ouverte');
        const r = await scheduleAt(now, [lateEv.eventId]);
        assert.equal(createdOf(r, 'REMINDER_H3'), 0, 'achat après l’échéance : aucun H-3 (pas de rattrapage)');
        assert.deepEqual(await eventReminders(lateEv), [], 'aucune ligne de rappel pour l’achat tardif');

        const witness = await reminderEvent('Temoin', inMinutes(185));
        const witnessDue = new Date(witness.startAt.getTime() - 3 * HOUR);
        const early = await newBuyer('rap-temoin');
        await buyConfirmed(early, witness, [[STANDARD, 1]]);
        const rw = await scheduleAt(witnessDue, [witness.eventId]);
        assert.ok(createdOf(rw, 'REMINDER_H3') >= 1, `témoin acheté avant l’échéance : H-3 créé (${JSON.stringify(rw)})`);
        await assertReminderRows('REMINDER_H3', witness, early.userId, { due: witnessDue, channels: H3_CHANNELS, smsPolicy: 'IF_NO_PUSH' });
    });

    test('billets UTILISE : pas de H-3 pour un compte sans billet VALIDE ; un billet VALIDE restant suffit', async () => {
        const ev = await reminderEvent('Entres', inMinutes(190));
        const due = new Date(ev.startAt.getTime() - 3 * HOUR);
        const used = await newBuyer('rap-utilise');
        const valid = await newBuyer('rap-valide');
        const mixed = await newBuyer('rap-mixte');
        const pUsed = await buyConfirmed(used, ev, [[STANDARD, 1]]);
        await buyConfirmed(valid, ev, [[STANDARD, 1]]);
        const pMixed = await buyConfirmed(mixed, ev, [[STANDARD, 2]]);
        const ctrl = await newController(partner, ev.eventId, { label: 'rap-scan' });
        for (const id of [String(pUsed.tickets[0].id), String(pMixed.tickets[0].id)]) {
            const r = await scan(ctrl, { eventId: ev.eventId, payload: await ticketPayload(id) });
            assert.equal(r.status, 200, `scan du billet ${id} : HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
            assert.equal((await ticketRow(id)).status, 'UTILISE', `billet ${id} composté`);
        }

        const r = await scheduleAt(due, [ev.eventId]);
        assert.ok(createdOf(r, 'REMINDER_H3') >= 1, `H-3 créé (${JSON.stringify(r)})`);
        assert.deepEqual(await outboxRows({ type: 'REMINDER_H3', eventId: ev.eventId, userId: used.userId }), [], 'compte dont le seul billet est UTILISE : aucun H-3');
        await assertReminderRows('REMINDER_H3', ev, valid.userId, { due, channels: H3_CHANNELS, status: 'PENDING' });
        await assertReminderRows('REMINDER_H3', ev, mixed.userId, { due, channels: H3_CHANNELS, status: 'PENDING' });
    });

    test('notif.h3_sms = IF_NO_PUSH : push accepté → SMS SKIPPED PUSH_DELIVERED ; sans appareil → SMS envoyé au texte exact ; push urgent', async () => {
        const ev = await reminderEvent('Arrivee', inMinutes(185));
        const due = new Date(ev.startAt.getTime() - 3 * HOUR);
        const withPush = await holderWithTicket(ev, 'h3-push');
        const noPush = await holderWithTicket(ev, 'h3-sanspush');
        const keys = newVapidKeys();
        const device = await addDevice(withPush.userId, keys);

        const r = await scheduleAt(due, [ev.eventId]);
        assert.ok(createdOf(r, 'REMINDER_H3') >= 1, 'H-3 créé');
        const pRows = await assertReminderRows('REMINDER_H3', ev, withPush.userId, { due, channels: H3_CHANNELS, smsPolicy: 'IF_NO_PUSH', status: 'PENDING' });
        const qRows = await assertReminderRows('REMINDER_H3', ev, noPush.userId, { due, channels: H3_CHANNELS, smsPolicy: 'IF_NO_PUSH', status: 'PENDING' });

        const pMark = smsMark(withPush.phoneE164);
        const qMark = smsMark(noPush.phoneE164);
        // Plage de silence vide le temps de l'envoi : l'échéance suit l'heure réelle (section Y).
        await withNotifSettings({ 'notif.sms_quiet_start': 0, 'notif.sms_quiet_end': 0 }, () => withVapid(async () => {
            await dispatchTwice(due, [ev.eventId]);
            await dispatchAt(plusSeconds(due, 122), { eventIds: [ev.eventId] });
        }, keys));

        assertStatus(await freshRow(pRows.PUSH.id), 'SENT', null, 'PUSH du porteur équipé');
        assertStatus(await freshRow(pRows.SMS.id), 'SKIPPED', 'PUSH_DELIVERED', 'SMS du porteur équipé (push remis)');
        assert.deepEqual(remindersSmsTo(withPush.phoneE164, pMark, /Ouvrez votre billet/), [], 'aucun SMS de H-3 au porteur équipé');
        const pushes = pushTo(device.endpoint);
        assert.equal(pushes.length, 1, 'un push accepté');
        assert.equal(norm(pushes[0].message.title), H3_TITLE, 'titre du push H-3');
        assert.equal(pushes[0].message.url, '/tickets', 'lien du push H-3');
        assert.ok(pushes[0].message.body.length <= 160, 'corps du push ≤ 160 caractères');
        assert.equal(pushes[0].options.urgency, 'high', 'H-3 : urgence haute');
        const ttl = pushes[0].options.ttlSeconds;
        assert.ok(ttl >= 60 && ttl <= 3 * 3600 + 120, `H-3 : TTL = secondes jusqu’au début (${ttl})`);

        const n = await inAppOf(pRows.IN_APP);
        assert.equal(norm(n.title), H3_TITLE, 'titre in-app du H-3');
        assert.match(norm(n.content), h3InAppRe(ev), 'contenu in-app du H-3 (G4)');
        assert.ok(norm(n.content).startsWith(norm(pushes[0].message.body).replace(/(\.\.\.|…)$/, '')), 'corps du push = début du contenu in-app');

        assertStatus(await freshRow(qRows.PUSH.id), 'SKIPPED', 'NO_PUSH_SUBSCRIPTION', 'PUSH du porteur sans appareil');
        const qSms = await freshRow(qRows.SMS.id);
        assertStatus(qSms, 'SENT', null, 'SMS du porteur sans appareil');
        assert.ok(qSms.provider_message_id, 'identifiant du fournisseur');
        assert.deepEqual(remindersSmsTo(noPush.phoneE164, qMark, /Ouvrez votre billet/), [h3Sms(ev)], 'un seul SMS de H-3, texte exact (G3)');
    });
});

// ── Destinataires et unicité ───────────────────────────────────────────────

describe('6.5 Destinataires et unicité (contrat I2)', () => {
    test('5 billets d’un compte → une ligne par canal ; deux planifications et deux envois → aucun doublon, un seul SMS au texte exact', async () => {
        const ev = await reminderEvent('Cinq Billets');
        const buyer = await newBuyer('rap-cinq');
        const purchase = await buyConfirmed(buyer, ev, [[STANDARD, 5]]);
        assert.equal(purchase.tickets.length, 5, 'cinq billets émis');
        const due = dakarAt(EVE, '10:00');

        const first = await scheduleAt(due, [ev.eventId]);
        assert.ok(createdOf(first, 'REMINDER_J1') >= 1, 'premier passage : J-1 créé');
        const second = await scheduleAt(due, [ev.eventId]);
        assert.equal(createdOf(second, 'REMINDER_J1'), 0, 'second passage du cron : aucune ligne créée');
        const rows = await assertReminderRows('REMINDER_J1', ev, buyer.userId, { due, channels: J1_CHANNELS, smsPolicy: 'ALWAYS', status: 'PENDING' });
        assert.equal((await eventReminders(ev)).length, J1_CHANNELS.length, 'une seule ligne par canal pour 5 billets');

        const mark = smsMark(buyer.phoneE164);
        await dispatchAt(due, { eventIds: [ev.eventId] });
        await dispatchAt(due, { eventIds: [ev.eventId] });
        await dispatchAt(plusSeconds(due, 61), { eventIds: [ev.eventId] });

        const sms = await freshRow(rows.SMS.id);
        assertStatus(sms, 'SENT', null, 'SMS du J-1');
        assert.ok(sms.provider_message_id, 'identifiant du fournisseur');
        assert.equal(sms.attempts, 1, 'une seule tentative');
        const held = ((sms.decision?.holder as Row | undefined)?.valid_ticket_ids ?? []) as string[];
        assert.deepEqual([...held].sort(), purchase.tickets.map((t) => String(t.id)).sort(), 'instantané : les 5 billets VALIDE du porteur');
        assert.deepEqual(remindersSmsTo(buyer.phoneE164, mark, /rappel/i), [j1Sms(ev)], 'un seul SMS de rappel, texte exact (G3)');
        const n = await inAppOf(rows.IN_APP);
        const { data, error } = await service.from('notifications').select('id').eq('user_id', buyer.userId).eq('type', 'REMINDER');
        assert.equal(error, null, error?.message);
        assert.deepEqual((data ?? []).map((x) => x.id), [n.id], 'une seule notification de rappel dans la cloche');
    });

    test('invitation → rappel ; billet de guichet (sans porteur) → rien ; compte suspendu → lignes SKIPPED ACCOUNT_SUSPENDED (trace)', async () => {
        const ev = await reminderEvent('Invites');
        const invitee = await newBuyer('rap-invite');
        await giveTicket(ev, invitee, 'INVITATION');
        await giveTicket(ev, null, 'COUNTER');
        const suspended = await holderWithTicket(ev, 'suspendu');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspended.userId);
        assert.equal(error, null, `suspension du compte : ${error?.message}`);

        const r = await scheduleAt(dakarAt(EVE, '10:00'), [ev.eventId]);
        assert.ok(createdOf(r, 'REMINDER_J1') >= 1, 'J-1 créé');
        await assertReminderRows('REMINDER_J1', ev, invitee.userId, { due: dakarAt(EVE, '10:00'), channels: J1_CHANNELS, status: 'PENDING' });
        const blocked = await assertReminderRows('REMINDER_J1', ev, suspended.userId, { due: dakarAt(EVE, '10:00'), channels: J1_CHANNELS });
        for (const c of J1_CHANNELS) assertStatus(blocked[c], 'SKIPPED', 'ACCOUNT_SUSPENDED', `${c} du compte suspendu`);
        const all = await eventReminders(ev);
        assert.equal(all.length, 2 * J1_CHANNELS.length, `deux comptes, une ligne par canal chacun (reçu ${all.length})`);
        assert.ok(all.every((x) => x.recipient_user_id === invitee.userId || x.recipient_user_id === suspended.userId), 'aucune ligne pour le billet de guichet');
    });

    test('rappel du contrôleur : la veille à 18:00, une ligne par affectation, point d’entrée et espèces dans les textes', async () => {
        const ev = await reminderEvent('Controle K');
        const withCash = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'rap-c1' });
        const noCash = await newController(partner, ev.eventId, { canAcceptCash: false, label: 'rap-c2' });
        const { error } = await service.from('event_controllers').update({ entry_point: 'Porte Nord' }).eq('event_id', ev.eventId).eq('user_id', withCash.userId);
        assert.equal(error, null, `point d’entrée : ${error?.message}`);
        const { data: assignments, error: aErr } = await service.from('event_controllers').select('id, user_id').eq('event_id', ev.eventId);
        assert.equal(aErr, null, aErr?.message);
        const assignmentOf = (uid: string) => String((assignments ?? []).find((a) => a.user_id === uid)?.id);

        const early = await scheduleAt(dakarAt(EVE, '17:59'), [ev.eventId]);
        assert.equal(createdOf(early, 'CONTROLLER_REMINDER'), 0, '17:59 la veille : rien');
        const onTime = await scheduleAt(dakarAt(EVE, '18:00'), [ev.eventId]);
        assert.ok(createdOf(onTime, 'CONTROLLER_REMINDER') >= 1, `18:00 la veille : rappel du contrôleur créé (${JSON.stringify(onTime)})`);
        const due = dakarAt(EVE, '18:00');
        const c1 = await assertReminderRows('CONTROLLER_REMINDER', ev, withCash.userId, { due, channels: CTRL_CHANNELS, status: 'PENDING' });
        const c2 = await assertReminderRows('CONTROLLER_REMINDER', ev, noCash.userId, { due, channels: CTRL_CHANNELS, status: 'PENDING' });
        assert.equal(c1.SMS.template_data.assignment_id, assignmentOf(withCash.userId), 'affectation de C1');
        assert.equal(c1.SMS.template_data.entry_point, 'Porte Nord', 'point d’entrée lu à la planification');
        assert.equal(c1.SMS.template_data.can_accept_cash, true, 'permission espèces de C1');
        assert.equal(c2.SMS.template_data.assignment_id, assignmentOf(noCash.userId), 'affectation de C2');
        assert.equal(c2.SMS.template_data.entry_point ?? null, null, 'C2 sans point d’entrée');
        assert.equal(c2.SMS.template_data.can_accept_cash, false, 'permission espèces de C2');

        const m1 = smsMark(withCash.phoneE164);
        const m2 = smsMark(noCash.phoneE164);
        await dispatchTwice(due, [ev.eventId]);
        assert.deepEqual(remindersSmsTo(withCash.phoneE164, m1, /^Event Village : demain /), [controllerSms(ev, 'Porte Nord', true)], 'SMS de C1, texte exact (G3)');
        assert.deepEqual(remindersSmsTo(noCash.phoneE164, m2, /^Event Village : demain /), [controllerSms(ev, null, false)], 'SMS de C2 (« à préciser », « non autorisées »)');
        const n1 = await inAppOf(c1.IN_APP);
        assert.equal(norm(n1.title), CTRL_TITLE, 'titre in-app du rappel contrôleur');
        assert.match(norm(n1.content), controllerInAppRe(ev, 'Porte Nord', true), 'contenu in-app de C1 (G4)');
        assert.match(norm((await inAppOf(c2.IN_APP)).content), controllerInAppRe(ev, null, false), 'contenu in-app de C2 (G4)');
    });

    test('réglage notif.* absent : la planification lève une exception nommant la clé (transaction annulée, décision 25)', async () => {
        const ev = await reminderEvent('Sans Reglage');
        await holderWithTicket(ev, 'sans-reglage');
        await inRolledBackTransaction(async (db) => {
            const fn = await db.query<{ ok: boolean }>("SELECT to_regprocedure('public.notification_reminders_schedule(jsonb)') IS NOT NULL AS ok");
            assert.equal(fn.rows[0].ok, true, 'RPC public.notification_reminders_schedule(p jsonb) absente (contrat I2, migration 20261103000004)');
            const del = await db.query("DELETE FROM public.platform_settings WHERE key = 'notif.reminder_j1_hour'");
            assert.equal(del.rowCount, 1, 'précondition : réglage notif.reminder_j1_hour présent');
            await assert.rejects(
                db.query('SELECT public.notification_reminders_schedule($1::jsonb)', [JSON.stringify({ now: dakarAt(EVE, '10:00').toISOString(), only_event_ids: [ev.eventId] })]),
                (err: Error) => /notif\.reminder_j1_hour/.test(err.message),
                'réglage absent : exception attendue qui nomme notif.reminder_j1_hour (jamais de défaut caché)',
            );
        });
    });
});

// ── Route ──────────────────────────────────────────────────────────────────

describe('6.5 Route /api/cron/reminders (contrat I3)', () => {
    type Handler = (req: NextRequest) => Promise<Response>;

    async function handlers(): Promise<{ GET: Handler; POST: Handler }> {
        const mod = await loadLotModule(ROUTE_MODULE, 'route /api/cron/reminders (contrat I3)');
        assert.equal(typeof mod.GET, 'function', 'GET exporté');
        assert.equal(typeof mod.POST, 'function', 'POST exporté');
        return { GET: mod.GET as Handler, POST: mod.POST as Handler };
    }

    test('503 sans CRON_SECRET, 401 sans jeton ou avec un mauvais jeton, 200 avec le rapport de planification', async () => {
        const { GET, POST } = await handlers();
        const secret = randomBytes(24).toString('hex');
        const pathName = '/api/cron/reminders';
        await withEnv({ CRON_SECRET: undefined }, async () => {
            const res = await GET(cronRequest(pathName, 'jeton-quelconque'));
            assert.equal(res.status, 503, `sans CRON_SECRET : HTTP ${res.status}`);
        });
        await withEnv({ CRON_SECRET: secret }, async () => {
            const none = await GET(cronRequest(pathName, null));
            assert.equal(none.status, 401, `sans jeton : HTTP ${none.status}`);
            const wrong = await POST(new NextRequest(`${BASE_URL}${pathName}`, { method: 'POST', headers: { authorization: `Bearer ${secret}x` } }));
            assert.equal(wrong.status, 401, `mauvais jeton : HTTP ${wrong.status}`);
            for (const h of [GET, POST]) {
                const ok = await h(cronRequest(pathName, secret));
                const body = (await ok.json()) as Record<string, unknown>;
                assert.equal(ok.status, 200, `jeton valide : HTTP ${ok.status} ${JSON.stringify(body)}`);
                assert.equal(body.ok, true, 'ok: true');
                const created = (body.created ?? {}) as Record<string, unknown>;
                for (const k of REMINDER_TYPES) assert.equal(typeof created[k], 'number', `created.${k} numérique (${JSON.stringify(body)})`);
                assert.equal(typeof body.events, 'number', 'events numérique');
            }
        });
    });

    test('contrôles statiques : aucune heure lue dans la requête, scheduleReminders() sans argument, protégée par CRON_SECRET', () => {
        assert.ok(fs.existsSync(ROUTE_FILE), `route absente : ${path.relative(process.cwd(), ROUTE_FILE)}`);
        const code = fs.readFileSync(ROUTE_FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        assert.match(code, /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/, 'dynamic = force-dynamic');
        assert.match(code, /\brefuseUnlessCron\s*\(/, 'refuseUnlessCron appelée');
        assert.match(code, /export\s+(const|async\s+function)\s+GET\b/, 'GET exporté');
        assert.match(code, /export\s+(const|async\s+function)\s+POST\b/, 'POST exporté');
        const calls = Array.from(code.matchAll(/\bscheduleReminders\s*\(([^)]*)\)/g)).map((m) => m[1].trim());
        assert.ok(calls.length >= 1, 'scheduleReminders appelée');
        assert.deepEqual(calls.filter((a) => a !== ''), [], `scheduleReminders appelée avec un argument : ${JSON.stringify(calls)}`);
        assert.doesNotMatch(code, /searchParams|nextUrl/, 'aucun paramètre d’URL lu');
        assert.doesNotMatch(code, /\.(json|text|formData|arrayBuffer|blob)\s*\(\s*\)/, 'aucun corps de requête lu');
        assert.doesNotMatch(code, /\bnow\s*:/, 'aucune horloge passée par la route');
        assert.doesNotMatch(code, /notification_reminders_schedule/, 'la route passe par lib/notifications/reminders.ts, pas par la RPC');
        assert.match(code, /REMINDERS_FAILED/, 'erreur 500 avec le code REMINDERS_FAILED');
        assert.match(code, /Planification des rappels momentanément impossible\./, 'message d’erreur du contrat');
    });

    test('planifier n’envoie rien : aucun SMS ni push avant le passage de l’envoyeur (contrat 6.1)', async () => {
        const ev = await reminderEvent('Sans Envoi');
        const holder = await holderWithTicket(ev, 'sans-envoi');
        const mark = smsMark(holder.phoneE164);
        const r = await scheduleAt(dakarAt(EVE, '10:00'), [ev.eventId]);
        assert.ok(createdOf(r, 'REMINDER_J1') >= 1, 'J-1 créé');
        assert.equal(getFakes().sms.messagesTo(holder.phoneE164).length - mark, 0, 'planifier n’envoie rien : seul l’envoyeur envoie (contrat 6.1)');
        assert.equal(getFakes().push.sent.filter((p) => p.message.tag.startsWith(`REMINDER_J1:${ev.eventId}:`)).length, 0, 'aucun push avant l’envoyeur');
    });
});
