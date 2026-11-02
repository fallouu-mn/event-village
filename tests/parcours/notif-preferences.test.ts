/**
 * Lot 6, tâche 6.4 — préférences de notification (contrat H1 à H3, C3 pour l'instantané, E1 pour la
 * revérification à l'envoi ; S2 « Préférences »).
 *  - GET /api/notifications/preferences : sujets optionnels avec libellés et descriptions, une ligne par
 *    canal (« Application », « SMS », « Email », « Notifications push »), tout activé par défaut (absence
 *    de ligne), liste des indispensables ; « Activité de vos ventes » (PRO_ACTIVITY) pour un partenaire
 *    seulement (RPC notification_preferences_get : `is_partner`) ;
 *  - PUT : un sujet et un canal désactivés puis réactivés (ligne notification_preferences), aucun autre
 *    canal touché ; sujet ou canal inconnu, valeur non booléenne, indispensable → 400 INVALID_PREFERENCE,
 *    sans écriture ; RPC notification_preference_set : INVALID_PREFERENCE ;
 *  - statut du compte : EN_ATTENTE admis, SUSPENDU 403, sans session 401 ;
 *  - préférence désactivée → ligne SKIPPED PREFERENCE_DISABLED, jamais une absence : à l'insertion
 *    (rappel J-1 planifié, instantané `decision.preference`, stage ENQUEUE) et à l'envoi (préférence
 *    coupée après la planification : revérification, stage CLAIM, aucun SMS) ; par canal et par sujet
 *    (témoin : SMS reçu malgré EVENT_UPDATES coupé, push coupé seul) ;
 *  - indispensables toujours envoyés : tout optionnel coupé, un achat crée et envoie sa confirmation ;
 *  - bouton d'essai (H3) : 409 NO_PUSH_SUBSCRIPTION sans appareil (aucune ligne) ; 202 avec appareil, une
 *    ligne PUSH_TEST à la minute (double clic dédoublonné), aucun envoi depuis la route, push remis au
 *    passage de l'envoyeur ; quota PUSH_TEST_PER_USER_HOUR → 429, par compte.
 * Horloge simulée seulement par `now` de scheduleAt / dispatchAt (jamais dans le passé) ; réglages des
 * rappels posés à leurs défauts le temps des cas (withNotifSettings) ; comptage par numéro neuf.
 *
 * Rouge avant correctif : app/api/notifications/preferences et app/api/notifications/test-push n'existent
 * pas ; ni notification_preferences, ni push_subscriptions, ni la boîte d'envoi, ni les RPC
 * notification_preferences_get / notification_preference_set / notification_test_push_enqueue, ni le
 * planificateur ni l'envoyeur.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getFakes } from '../fakes';
import { newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { authed } from './acces-helpers';
import {
    addMinutes, assertNotificationInvariants, createReminderEvent, dakarAt, dakarDay, dispatchAt, fakeBrowserSubscription,
    flushNotifications, lotFunction, outboxRows, pushTo, scheduleAt, smsMark, smsTo, withEnv, withNotifSettings, withVapid,
    type FakeBrowserSubscription, type NotifSettingKey, type OutboxRow, type ReminderEvent, type VapidKeys,
} from './notif-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
interface RouteResult { status: number; body: Row }

const PREFS_ROUTE = '../../app/api/notifications/preferences/route';
const TEST_PUSH_ROUTE = '../../app/api/notifications/test-push/route';

const CHANNELS = ['IN_APP', 'SMS', 'EMAIL', 'PUSH'] as const;
type Channel = (typeof CHANNELS)[number];
const CHANNEL_LABELS: Record<Channel, string> = { IN_APP: 'Application', SMS: 'SMS', EMAIL: 'Email', PUSH: 'Notifications push' };
const TOPIC_LABELS: Record<string, string> = {
    REMINDERS: "Rappels avant l'événement",
    EVENT_UPDATES: "Changements d'un événement",
    PRO_ACTIVITY: 'Activité de vos ventes',
};
const ESSENTIALS = [
    'Codes de connexion', "Confirmations d'achat et reçus", 'Billets transférés', 'Annulations', 'Remboursements', 'Sécurité du compte',
];
const NO_DEVICE_ERROR = "Activez d'abord les notifications sur cet appareil.";
const TEST_PUSH_MESSAGE = "Notification d'essai envoyée : elle arrive dans la minute.";

/** Réglages des rappels au défaut du contrat I1 le temps des cas (aucune dépendance aux autres suites). */
const REMINDER_DEFAULTS: Partial<Record<NotifSettingKey, unknown>> = {
    'notif.reminder_j1_enabled': true,
    'notif.reminder_j1_hour': 10,
    'notif.j1_sms': 'ALWAYS',
    'notif.sms_quiet_start': 22,
    'notif.sms_quiet_end': 8,
};

const FREE = 'Entree libre';
const STANDARD = 'Standard';
const CATEGORIES: CategorySpec[] = [{ name: STANDARD, price: 5_000, total: 50 }, { name: FREE, price: 0, total: 50 }];
const EVENT_DAY = dakarDay(3);
const EVE = dakarDay(2);

let partner: TestPartner;

before(async () => {
    partner = await newPartner('preferences');
});

after(async () => {
    await assertNotificationInvariants('notif-preferences');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

async function call(relPath: string, method: string, what: string, req: NextRequest): Promise<RouteResult> {
    const h = await lotFunction<Handler>(relPath, method, what);
    const res = await h(req);
    const text = await res.text();
    let body: Row = {};
    if (text) {
        try {
            body = JSON.parse(text) as Row;
        } catch (err) {
            body = { raw: text.slice(0, 2000), parseError: (err as Error).message };
        }
    }
    return { status: res.status, body };
}

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 800)}`;
}

function getPrefs(user: Buyer | null): Promise<RouteResult> {
    const req = user ? authed('/api/notifications/preferences', 'GET', user) : jsonRequest('/api/notifications/preferences', 'GET', null);
    return call(PREFS_ROUTE, 'GET', 'GET /api/notifications/preferences (contrat H2)', req);
}

function putPref(user: Buyer, body: unknown): Promise<RouteResult> {
    return call(PREFS_ROUTE, 'PUT', 'PUT /api/notifications/preferences (contrat H2)', authed('/api/notifications/preferences', 'PUT', user, body));
}

async function setPref(user: Buyer, topic: string, channel: Channel, enabled: boolean): Promise<void> {
    const r = await putPref(user, { topic, channel, enabled });
    assert.equal(r.status, 200, `PUT ${topic}/${channel}=${enabled} : ${show(r)}`);
    assert.equal(r.body.success, true, `PUT ${topic}/${channel} : { success: true } attendu, ${show(r)}`);
}

function testPush(user: Buyer): Promise<RouteResult> {
    return call(TEST_PUSH_ROUTE, 'POST', 'POST /api/notifications/test-push (contrat H3)', authed('/api/notifications/test-push', 'POST', user, {}));
}

interface TopicView { topic: string; label: string; description: string; channels: Record<string, { label: string; enabled: boolean }> }

function topicsOf(r: RouteResult, what: string): Map<string, TopicView> {
    assert.equal(r.status, 200, `${what} : ${show(r)}`);
    assert.ok(Array.isArray(r.body.topics), `${what} : « topics » attendu, ${show(r)}`);
    const out = new Map<string, TopicView>();
    for (const t of r.body.topics as Row[]) {
        assert.ok(Array.isArray(t.channels), `${what} : canaux du sujet ${String(t.topic)} en liste, ${JSON.stringify(t)}`);
        const channels: TopicView['channels'] = {};
        for (const c of t.channels as Row[]) channels[String(c.channel)] = { label: String(c.label), enabled: c.enabled as boolean };
        out.set(String(t.topic), { topic: String(t.topic), label: String(t.label), description: String(t.description ?? ''), channels });
    }
    return out;
}

function norm(s: string): string {
    return s.replace(/[’‘]/g, "'");
}

async function prefRows(userId: string): Promise<Row[]> {
    const { data, error } = await service.from('notification_preferences').select('topic, channel, enabled').eq('user_id', userId).order('topic').order('channel');
    assert.equal(error, null, `notification_preferences : ${error?.message} (code ${error?.code}) — table du contrat C5`);
    return (data ?? []) as Row[];
}

async function setStatus(userId: string, status: string): Promise<void> {
    const { error } = await service.from('users').update({ status }).eq('id', userId);
    assert.equal(error, null, `statut ${status} : ${error?.message}`);
}

/** Billet gratuit émis directement (service_role), stock vendu + 1 : porteur ordinaire d'un billet VALIDE. */
async function giveTicket(ev: ReminderEvent, holder: Buyer): Promise<string> {
    const cat = ev.categories[FREE];
    const { data, error } = await service.from('tickets').insert({
        event_id: ev.eventId, category_id: cat.id, user_id: holder.userId, price: 0, status: 'VALIDE', sale_channel: 'FREE',
        ticket_number: `TCK-PREF-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
        qr_code: `EV-QR-PREF-${randomUUID()}`,
    }).select('id').single();
    assert.equal(error, null, `billet gratuit : ${error?.message}`);
    const { data: c, error: cErr } = await service.from('ticket_categories').select('sold_quantity').eq('id', cat.id).single();
    assert.equal(cErr, null, `stock : ${cErr?.message}`);
    const { error: uErr } = await service.from('ticket_categories').update({ sold_quantity: Number(c.sold_quantity) + 1 }).eq('id', cat.id);
    assert.equal(uErr, null, `stock vendu : ${uErr?.message}`);
    return String(data.id);
}

function shortTitle(prefix: string): string {
    return `${prefix} ${randomBytes(3).toString('hex')}`;
}

async function reminderEvent(prefix: string): Promise<ReminderEvent> {
    return createReminderEvent(partner, `pref-${prefix}`, {
        startDate: EVENT_DAY, startTime: '20:00', categories: CATEGORIES, title: shortTitle(prefix), location: 'Salle Sorano', city: 'Dakar',
    });
}

function byChannel(rows: OutboxRow[], what: string): Record<Channel, OutboxRow> {
    const out = {} as Record<Channel, OutboxRow>;
    for (const r of rows) {
        assert.ok(!out[r.channel], `${what} : une seule ligne ${r.channel} attendue (${rows.map((x) => x.idempotency_key).join(', ')})`);
        out[r.channel] = r;
    }
    return out;
}

async function j1Rows(ev: ReminderEvent, user: Buyer): Promise<Record<Channel, OutboxRow>> {
    const rows = await outboxRows({ type: 'REMINDER_J1', eventId: ev.eventId, userId: user.userId });
    assert.ok(rows.length > 0, `rappel J-1 de ${user.email} : aucune ligne (une préférence désactivée donne SKIPPED, jamais une absence)`);
    return byChannel(rows, `J-1 de ${user.email}`);
}

function assertPrefSkip(r: OutboxRow, topic: string, channel: Channel, stage: 'ENQUEUE' | 'CLAIM', what: string): void {
    assert.equal(r.status, 'SKIPPED', `${what} : SKIPPED attendu, ${r.status} (${r.reason})`);
    assert.equal(r.reason, 'PREFERENCE_DISABLED', `${what} : motif PREFERENCE_DISABLED, reçu ${r.reason}`);
    const decision = (r.decision ?? {}) as Row;
    assert.equal(decision.stage, stage, `${what} : instantané pris à l'étape ${stage}, ${JSON.stringify(decision)}`);
    assert.equal(decision.outcome, 'SKIP', `${what} : instantané SKIP, ${JSON.stringify(decision)}`);
    assert.deepEqual(decision.preference, { topic, channel, enabled: false }, `${what} : instantané de la préférence`);
    assert.ok(r.finished_at, `${what} : finished_at posé`);
}

async function addDevice(userId: string, keys: VapidKeys): Promise<FakeBrowserSubscription> {
    const sub = fakeBrowserSubscription();
    const { error } = await service.from('push_subscriptions').insert({
        user_id: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, vapid_key_id: keys.keyId,
    });
    assert.equal(error, null, `abonnement push : ${error?.message} (code ${error?.code}) — table push_subscriptions du contrat C5`);
    return sub;
}

/** Minute de Dakar (= UTC) au format de la clé du bouton d'essai : AAAAMMJJHHmm (contrat G2). */
function minuteKey(d: Date): string {
    const iso = d.toISOString();
    return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(11, 13)}${iso.slice(14, 16)}`;
}

// ── Lecture et défauts (H1, H2) ────────────────────────────────────────────

describe('6.4 Préférences : lecture, défauts et indispensables (H1, H2)', () => {
    test('client : sujets « Rappels avant l’événement » et « Changements d’un événement », 4 canaux activés, indispensables listés, pas d’« Activité de vos ventes »', async () => {
        const client = await newBuyer('pref-lecture');
        const r = await getPrefs(client);
        const topics = topicsOf(r, 'GET client');
        assert.deepEqual(Array.from(topics.keys()).sort(), ['EVENT_UPDATES', 'REMINDERS'], 'sujets d’un client : rappels et changements (PRO_ACTIVITY réservé aux partenaires)');
        for (const t of Array.from(topics.values())) {
            assert.equal(norm(t.label), TOPIC_LABELS[t.topic], `libellé du sujet ${t.topic}`);
            assert.ok(t.description.trim().length > 0, `description du sujet ${t.topic}`);
            assert.deepEqual(Object.keys(t.channels).sort(), [...CHANNELS].sort(), `canaux du sujet ${t.topic}`);
            for (const c of CHANNELS) {
                assert.equal(t.channels[c].label, CHANNEL_LABELS[c], `libellé du canal ${c}`);
                assert.equal(t.channels[c].enabled, true, `${t.topic}/${c} activé par défaut (absence de ligne)`);
            }
        }
        assert.deepEqual((r.body.essentials as string[] | undefined)?.map(norm), ESSENTIALS, 'indispensables toujours envoyés (H2)');
        const text = JSON.stringify(r.body);
        assert.doesNotMatch(text, /PURCHASE_CONFIRMED|OTP_|ESSENTIAL|OPTIONAL/, 'aucun code technique hors identifiants de sujet et de canal');
        assert.deepEqual(await prefRows(client.userId), [], 'lecture sans écriture : aucune ligne de préférence créée');
    });

    test('partenaire : « Activité de vos ventes » en plus ; RPC notification_preferences_get : is_partner', async () => {
        const p = await newPartner('pref-partenaire');
        const topics = topicsOf(await getPrefs(p), 'GET partenaire');
        assert.deepEqual(Array.from(topics.keys()).sort(), ['EVENT_UPDATES', 'PRO_ACTIVITY', 'REMINDERS'], 'sujets d’un partenaire');
        assert.equal(topics.get('PRO_ACTIVITY')?.label, TOPIC_LABELS.PRO_ACTIVITY);

        const forPartner = await service.rpc('notification_preferences_get', { p: { user_id: p.userId } });
        assert.equal(forPartner.error, null, `notification_preferences_get : ${forPartner.error?.message} (code ${forPartner.error?.code}) — RPC du contrat H2`);
        assert.equal((forPartner.data as Row).ok, true, JSON.stringify(forPartner.data));
        assert.equal((forPartner.data as Row).is_partner, true, `is_partner vrai pour un partenaire : ${JSON.stringify(forPartner.data)}`);
        const rpcTopics = (forPartner.data as Row).topics as Array<{ topic: string; channels: Record<string, boolean> }>;
        const reminders = rpcTopics.find((t) => t.topic === 'REMINDERS');
        assert.deepEqual(reminders?.channels, { IN_APP: true, SMS: true, EMAIL: true, PUSH: true }, 'canaux de la RPC : objet par canal, tout activé');

        const client = await newBuyer('pref-non-partenaire');
        const forClient = await service.rpc('notification_preferences_get', { p: { user_id: client.userId } });
        assert.equal(forClient.error, null, forClient.error?.message);
        assert.equal((forClient.data as Row).is_partner, false, `is_partner faux pour un client : ${JSON.stringify(forClient.data)}`);
    });
});

// ── Écriture (H1, H2) ──────────────────────────────────────────────────────

describe('6.4 Préférences : écriture et refus (H1, H2)', () => {
    test('PUT REMINDERS/SMS désactivé puis réactivé : seul ce canal change, ligne notification_preferences', async () => {
        const client = await newBuyer('pref-ecriture');
        await setPref(client, 'REMINDERS', 'SMS', false);
        let topics = topicsOf(await getPrefs(client), 'GET après désactivation');
        assert.equal(topics.get('REMINDERS')?.channels.SMS.enabled, false, 'REMINDERS/SMS désactivé');
        for (const [topic, t] of Array.from(topics.entries())) {
            for (const c of CHANNELS) {
                if (topic === 'REMINDERS' && c === 'SMS') continue;
                assert.equal(t.channels[c].enabled, true, `${topic}/${c} inchangé`);
            }
        }
        assert.deepEqual(await prefRows(client.userId), [{ topic: 'REMINDERS', channel: 'SMS', enabled: false }], 'une ligne de préférence');

        await setPref(client, 'REMINDERS', 'SMS', true);
        topics = topicsOf(await getPrefs(client), 'GET après réactivation');
        assert.equal(topics.get('REMINDERS')?.channels.SMS.enabled, true, 'REMINDERS/SMS réactivé');
        assert.deepEqual(await prefRows(client.userId), [{ topic: 'REMINDERS', channel: 'SMS', enabled: true }], 'la ligne passe à enabled = true');
    });

    test('sujet inconnu, canal inconnu, valeur non booléenne, indispensable → 400 INVALID_PREFERENCE, aucune écriture', async () => {
        const client = await newBuyer('pref-refus');
        const bad: unknown[] = [
            { topic: 'MARKETING', channel: 'SMS', enabled: false },
            { topic: 'REMINDERS', channel: 'WHATSAPP', enabled: false },
            { topic: 'REMINDERS', channel: 'SMS', enabled: 'non' },
            { topic: 'REMINDERS', channel: 'SMS' },
            { topic: 'ESSENTIAL', channel: 'SMS', enabled: false },
            { topic: 'PURCHASE_CONFIRMED', channel: 'SMS', enabled: false },
            { topic: 'SECURITY', channel: 'EMAIL', enabled: false },
            { topic: 'OTP_LOGIN', channel: 'SMS', enabled: false },
        ];
        for (const body of bad) {
            const r = await putPref(client, body);
            assert.equal(r.status, 400, `${JSON.stringify(body)} : 400 attendu, ${show(r)}`);
            assert.equal(r.body.code, 'INVALID_PREFERENCE', `${JSON.stringify(body)} : ${show(r)}`);
        }
        assert.deepEqual(await prefRows(client.userId), [], 'aucune ligne écrite');

        const rpc = await service.rpc('notification_preference_set', { p: { user_id: client.userId, topic: 'MARKETING', channel: 'SMS', enabled: false } });
        assert.equal(rpc.error, null, `notification_preference_set : ${rpc.error?.message} (code ${rpc.error?.code}) — RPC du contrat H2`);
        assert.equal((rpc.data as Row).ok, false, JSON.stringify(rpc.data));
        assert.equal((rpc.data as Row).code, 'INVALID_PREFERENCE', JSON.stringify(rpc.data));
    });

    test('statut du compte : EN_ATTENTE admis (lecture et écriture) ; SUSPENDU 403 ; sans session 401', async () => {
        const pending = await newBuyer('pref-en-attente');
        await setStatus(pending.userId, 'EN_ATTENTE');
        assert.equal((await getPrefs(pending)).status, 200, 'EN_ATTENTE : lecture admise');
        await setPref(pending, 'EVENT_UPDATES', 'PUSH', false);

        const suspended = await newBuyer('pref-suspendu');
        await setStatus(suspended.userId, 'SUSPENDU');
        const g = await getPrefs(suspended);
        assert.equal(g.status, 403, `SUSPENDU : lecture refusée, ${show(g)}`);
        assert.equal(g.body.code, 'ACCOUNT_NOT_ACTIVE', show(g));
        const p = await putPref(suspended, { topic: 'REMINDERS', channel: 'SMS', enabled: false });
        assert.equal(p.status, 403, `SUSPENDU : écriture refusée, ${show(p)}`);
        assert.deepEqual(await prefRows(suspended.userId), [], 'aucune écriture pour le compte suspendu');
        const t = await testPush(suspended);
        assert.equal(t.status, 403, `SUSPENDU : bouton d’essai refusé, ${show(t)}`);

        const anon = await getPrefs(null);
        assert.equal(anon.status, 401, `sans session : ${show(anon)}`);
    });
});

// ── SKIPPED PREFERENCE_DISABLED à l'insertion et à l'envoi (H1, C3, E1) ────

describe('6.4 Préférence désactivée → SKIPPED PREFERENCE_DISABLED, jamais une absence (rappel J-1)', () => {
    let ev: ReminderEvent;
    /** REMINDERS/SMS coupé avant la planification. */
    let early: Buyer;
    /** REMINDERS/SMS coupé après la planification, avant l'envoi. */
    let late: Buyer;
    /** Témoin : EVENT_UPDATES/SMS et REMINDERS/PUSH coupés (autre sujet, autre canal) : son SMS de rappel part. */
    let witness: Buyer;
    const due = dakarAt(EVE, '10:00');

    before(async () => {
        ev = await reminderEvent('skip');
        early = await newBuyer('pref-avant');
        late = await newBuyer('pref-apres');
        witness = await newBuyer('pref-temoin');
        for (const u of [early, late, witness]) await giveTicket(ev, u);
        await setPref(early, 'REMINDERS', 'SMS', false);
        await setPref(witness, 'EVENT_UPDATES', 'SMS', false);
        await setPref(witness, 'REMINDERS', 'PUSH', false);
    });

    test('à l’insertion : SMS SKIPPED PREFERENCE_DISABLED (stage ENQUEUE) ; autres canaux en attente ; préférence d’un autre sujet sans effet', async () => {
        await withNotifSettings(REMINDER_DEFAULTS, async () => {
            await scheduleAt(due, [ev.eventId]);
        });
        const e = await j1Rows(ev, early);
        assertPrefSkip(e.SMS, 'REMINDERS', 'SMS', 'ENQUEUE', 'SMS J-1 (coupé avant)');
        assert.equal(e.IN_APP.status, 'PENDING', 'application en attente : seule la préférence SMS est coupée');

        const l = await j1Rows(ev, late);
        assert.equal(l.SMS.status, 'PENDING', 'SMS J-1 de « late » en attente (préférence encore active)');

        const w = await j1Rows(ev, witness);
        assert.equal(w.SMS.status, 'PENDING', 'témoin : EVENT_UPDATES/SMS coupé ne touche pas les rappels');
        assertPrefSkip(w.PUSH, 'REMINDERS', 'PUSH', 'ENQUEUE', 'push J-1 du témoin (REMINDERS/PUSH coupé)');
        assert.equal(w.IN_APP.status, 'PENDING', 'témoin : application en attente');
    });

    test('à l’envoi : préférence coupée après la planification → SKIPPED PREFERENCE_DISABLED (stage CLAIM), aucun SMS ; témoin : un SMS', async () => {
        const marks = new Map([early, late, witness].map((u) => [u.userId, smsMark(u.phoneE164)]));
        await setPref(late, 'REMINDERS', 'SMS', false);
        await withNotifSettings(REMINDER_DEFAULTS, async () => {
            await dispatchAt(addMinutes(due, 1), { eventIds: [ev.eventId] });
        });
        const l = await j1Rows(ev, late);
        assertPrefSkip(l.SMS, 'REMINDERS', 'SMS', 'CLAIM', 'SMS J-1 (coupé après la planification)');
        assert.equal(l.SMS.attempts, 0, 'aucune tentative comptée pour un SMS non envoyé');
        assert.equal(l.SMS.provider_message_id, null, 'aucun identifiant du fournisseur');
        assert.equal(l.IN_APP.status, 'SENT', 'application envoyée (préférence IN_APP active)');
        assert.equal(smsTo(late.phoneE164, marks.get(late.userId)).length, 0, 'aucun SMS pour le compte qui a coupé les SMS de rappel');
        assert.equal(smsTo(early.phoneE164, marks.get(early.userId)).length, 0, 'aucun SMS pour le compte coupé avant la planification');
        const e = await j1Rows(ev, early);
        assert.equal(e.SMS.status, 'SKIPPED', 'la ligne SKIPPED reste SKIPPED');
        assert.equal(e.IN_APP.status, 'SENT', 'application envoyée');

        const w = await j1Rows(ev, witness);
        assert.equal(w.SMS.status, 'SENT', `témoin : SMS envoyé, ${w.SMS.status} (${w.SMS.reason})`);
        assert.deepEqual((w.SMS.decision as Row | null)?.preference, { topic: 'REMINDERS', channel: 'SMS', enabled: true }, 'instantané : préférence active à l’envoi');
        const sms = smsTo(witness.phoneE164, marks.get(witness.userId));
        assert.equal(sms.length, 1, `témoin : un SMS de rappel, ${sms.length} reçu(s)`);
        assert.match(sms[0].message, /^Event Village : rappel, /, `texte du rappel J-1 (G3) : ${sms[0].message}`);
        assert.equal(w.PUSH.status, 'SKIPPED', 'push du témoin : reste SKIPPED');
    });
});

// ── Indispensables toujours envoyés (H1) ───────────────────────────────────

describe('6.4 Indispensables : toujours envoyés, quelles que soient les préférences (H1)', () => {
    test('tous les optionnels coupés : l’achat crée sa confirmation sans PREFERENCE_DISABLED et le SMS part', async () => {
        const buyer = await newBuyer('pref-indispensable');
        for (const topic of ['REMINDERS', 'EVENT_UPDATES']) {
            for (const c of CHANNELS) await setPref(buyer, topic, c, false);
        }
        assert.equal((await prefRows(buyer.userId)).filter((p) => p.enabled === false).length, 8, 'huit préférences coupées');
        const ev = await reminderEvent('achat');
        const mark = smsMark(buyer.phoneE164);
        const { payment } = await buyConfirmed(buyer, ev, [[STANDARD, 1]]);
        const rows = await outboxRows({ keyPrefix: `PURCHASE_CONFIRMED:${payment.id}:` });
        const channels = byChannel(rows, 'confirmation d’achat');
        assert.ok(channels.IN_APP && channels.SMS, `confirmation d’achat : lignes IN_APP et SMS (${rows.map((r) => r.channel).join(', ')})`);
        const skippedByPref = rows.filter((r) => r.reason === 'PREFERENCE_DISABLED');
        assert.deepEqual(skippedByPref.map((r) => r.channel), [], 'aucun canal d’un indispensable coupé par une préférence');
        assert.ok(rows.every((r) => r.family === 'ESSENTIAL'), 'famille ESSENTIAL');
        assert.equal(channels.SMS.status, 'PENDING', 'SMS de confirmation en attente de l’envoyeur');

        await flushNotifications({ ids: rows.map((r) => r.id) });
        const sms = smsTo(buyer.phoneE164, mark);
        assert.equal(sms.length, 1, `un SMS de confirmation, ${sms.length} reçu(s)`);
        assert.match(sms[0].message, /^Event Village : achat confirmé, 1 billet /, `texte de la confirmation (G3) : ${sms[0].message}`);
        const [inApp] = await outboxRows({ ids: [channels.IN_APP.id] });
        assert.equal(inApp.status, 'SENT', 'confirmation dans l’application envoyée');
    });
});

// ── Bouton d'essai (H3) ────────────────────────────────────────────────────

describe('6.4 Bouton d’essai du push (H3)', () => {
    test('sans appareil : 409 NO_PUSH_SUBSCRIPTION, message exact, aucune ligne', async () => {
        const client = await newBuyer('pref-essai-sans');
        const r = await testPush(client);
        assert.equal(r.status, 409, `sans appareil : ${show(r)}`);
        assert.equal(r.body.code, 'NO_PUSH_SUBSCRIPTION', show(r));
        assert.equal(r.body.error, NO_DEVICE_ERROR, show(r));
        assert.deepEqual(await outboxRows({ type: 'PUSH_TEST', userId: client.userId }), [], 'aucune ligne PUSH_TEST');
    });

    test('avec appareil : 202, une ligne PUSH_TEST à la minute (double clic dédoublonné), aucun envoi depuis la route, push remis par l’envoyeur', async () => {
        const client = await newBuyer('pref-essai');
        await withVapid(async (keys) => {
            const sub = await addDevice(client.userId, keys);
            const t0 = new Date();
            const first = await testPush(client);
            const second = await testPush(client);
            const t1 = new Date();
            for (const r of [first, second]) {
                assert.equal(r.status, 202, `bouton d’essai : ${show(r)}`);
                assert.equal(r.body.queued, true, show(r));
                assert.equal(r.body.message, TEST_PUSH_MESSAGE, show(r));
            }
            assert.equal(getFakes().push.messagesTo(sub.endpoint).length, 0, 'aucun envoi depuis la route (H3)');
            const rows = await outboxRows({ type: 'PUSH_TEST', userId: client.userId });
            const sameMinute = minuteKey(t0) === minuteKey(t1);
            if (sameMinute) assert.equal(rows.length, 1, `double clic dans la même minute : une seule ligne (${rows.map((r) => r.idempotency_key).join(', ')})`);
            else assert.ok(rows.length >= 1 && rows.length <= 2, `deux clics à cheval sur deux minutes : une ou deux lignes (${rows.length})`);
            const r0 = rows[0];
            assert.equal(r0.channel, 'PUSH', 'canal PUSH');
            assert.equal(r0.status, 'PENDING', 'ligne en attente de l’envoyeur');
            assert.equal(r0.family, 'ESSENTIAL', 'famille ESSENTIAL (G2)');
            const keyRe = new RegExp(`^PUSH_TEST:${client.userId}:(\\d{12}):PUSH$`);
            const m = keyRe.exec(r0.idempotency_key);
            assert.ok(m, `clé PUSH_TEST:<user_id>:<AAAAMMJJHHmm>:PUSH, reçu ${r0.idempotency_key}`);
            assert.ok([minuteKey(t0), minuteKey(t1)].includes(m[1]), `minute de la demande dans la clé (${m[1]})`);

            await flushNotifications({ ids: rows.map((r) => r.id) });
            const delivered = pushTo(sub.endpoint);
            assert.equal(delivered.length, rows.length, `push remis au passage de l’envoyeur (${delivered.length})`);
            assert.ok(delivered.some((p) => p.message.tag === r0.group_key), `tag = clé de groupe (${delivered.map((p) => p.message.tag).join(', ')})`);
            assert.match(delivered[0].message.url, /\/profile\/notifications$/, `lien vers les préférences : ${delivered[0].message.url}`);
            assert.equal(delivered[0].options.urgency, 'high', 'urgence haute pour le bouton d’essai (F4)');
            const [sent] = await outboxRows({ ids: [r0.id] });
            assert.equal(sent.status, 'SENT', `ligne PUSH_TEST envoyée, ${sent.status} (${sent.reason})`);
        });
    });

    test('quota PUSH_TEST_PER_USER_HOUR : 429 au-delà, par compte (un autre compte n’est pas touché)', async () => {
        const client = await newBuyer('pref-essai-quota');
        const other = await newBuyer('pref-essai-quota-autre');
        await withVapid(async (keys) => {
            await addDevice(client.userId, keys);
            await addDevice(other.userId, keys);
            await withEnv({ PUSH_TEST_PER_USER_HOUR: '2' }, async () => {
                const statuses: number[] = [];
                for (let i = 0; i < 3; i += 1) statuses.push((await testPush(client)).status);
                assert.deepEqual(statuses, [202, 202, 429], `quota de 2 essais par heure : ${JSON.stringify(statuses)}`);
                const o = await testPush(other);
                assert.equal(o.status, 202, `un autre compte garde son quota : ${show(o)}`);
            });
        });
        const rows = await outboxRows({ type: 'PUSH_TEST', userId: client.userId });
        assert.ok(rows.length >= 1 && rows.length <= 2, `refus du quota : aucune ligne de plus (${rows.length})`);
    });
});
