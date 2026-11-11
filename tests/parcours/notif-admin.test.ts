/**
 * Lot 6, tâche 6.8 — supervision admin des notifications (contrat L1 à L4 ; S2 « Cloche et admin »).
 *  - GET /api/admin/notifications : filtres statut, canal, type, période (jours de Dakar), tri
 *    `created_at DESC, id DESC`, pagination (`page`, `page_size`, `total`), compteurs par statut ;
 *    destinataire masqué (« +221 77 *** ** 45 », « aw***@domaine », nom du compte), jamais d'endpoint
 *    push ; `can_retry` vrai pour FAILED seulement ; filtre inconnu → 400 INVALID_FILTER ;
 *  - GET /api/admin/notifications/[id] : ligne sans `claim_token`, destinataire, instantané de décision,
 *    données du modèle ; journal OTP (`origin = 'SYNC_LOG'`) : `template_data = { purpose }` seulement,
 *    aucun code ni lien même si la ligne en portait ; ligne inconnue → 404 NOT_FOUND ;
 *  - GET /api/admin/notifications/stats : par jour et par canal (envoyées, échecs, non envoyées,
 *    incertaines, annulées), SMS du mois (SENT + UNCERTAIN, journaux OTP compris, nombre d'OTP), SMS du
 *    jour — mesurés par différence autour de lignes écrites par la suite ; lot 7 (7.0 a, T3) : `threshold` =
 *    80 % du plafond des SMS optionnels (ceil(0,8 × notif.sms_optional_daily_cap), qui remplace
 *    notif.sms_daily_alert), `optional_cap` et `optional_today` servis tels quels ;
 *  - permissions (L1, L3) : sans session 401 ; client 403 ; ADMIN sans `notifications.*` 403 partout ;
 *    `notifications.read` seule : lecture oui, relance 403 ; `notifications.write` : relance ; SUPERADMIN
 *    partout ; RPC notification_retry avec un acteur sans permission, suspendu ou client → FORBIDDEN ;
 *  - relance (L2) : FAILED seulement → PENDING, `attempts = 0`, `reason = NULL`, `manual_retries + 1`,
 *    `next_attempt_at` à maintenant, journal `audit_logs` NOTIFICATION_RETRY ; SENT, UNCERTAIN, SKIPPED,
 *    CANCELLED, PENDING, SENDING → 409 NOT_RETRYABLE (« Seule une notification en échec peut être
 *    relancée. »), ligne inchangée ; une ligne relancée ne se relance pas deux fois ;
 *  - libellés humains (L4, lib/notifications/outbox-labels.ts) : statuts, canaux, chaque motif de C4 et
 *    chaque type du registre.
 * Les lignes sont écrites par insertOutboxRow (échéance à J+30 : l'envoyeur ne les prend jamais) et
 * supprimées en fin de suite ; les comptes admin créés sont suspendus en fin de suite (ils ne reçoivent
 * plus d'alertes des suites suivantes). Lot 9 bis (T32) : motifs EMAIL_NOT_VERIFIED, DEMO_ACCOUNT, DEMO_GUARD_UNAVAILABLE ; refus PERMISSION_MISSING (R51).
 *
 * Rouge avant correctif : app/api/admin/notifications/** , les RPC admin_notifications_list,
 * admin_notification_detail, admin_notifications_stats, notification_retry, la table notification_outbox
 * et lib/notifications/outbox-labels.ts n'existent pas ; `notifications.read` et `notifications.write`
 * ne sont pas des permissions connues (lib/admin/admin-auth.ts:22-36).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { loadFixtures, signInAs } from '../helpers/fixtures';
import { randomSenegalPhone, routeContext } from './helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { jsonRequest } from './finance-helpers';
import {
    assertNotificationInvariants, dakarDay, deleteOutboxRows, fakeBrowserSubscription, getNotifSetting, insertOutboxRow, loadLotModule,
    lotFunction, newAdmin, newVapidKeys, outboxRows, type OutboxInsert, type OutboxRow, type OutboxStatus, type TestAdmin,
} from './notif-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
interface RouteResult { status: number; body: Row }

const LIST_ROUTE = '../../app/api/admin/notifications/route';
const DETAIL_ROUTE = '../../app/api/admin/notifications/[id]/route';
const STATS_ROUTE = '../../app/api/admin/notifications/stats/route';
const RETRY_ROUTE = '../../app/api/admin/notifications/[id]/retry/route';
const LABELS_MODULE = '../../lib/notifications/outbox-labels';
const NOT_RETRYABLE_MESSAGE = 'Seule une notification en échec peut être relancée.';

const STATUS_LABELS: Record<OutboxStatus, string> = {
    PENDING: 'En attente',
    SENDING: "En cours d'envoi",
    SENT: 'Envoyée',
    FAILED: 'En échec',
    SKIPPED: 'Non envoyée',
    CANCELLED: 'Annulée',
    UNCERTAIN: 'Incertaine',
};
const CHANNEL_LABELS: Record<string, string> = { IN_APP: 'Application', SMS: 'SMS', EMAIL: 'Email', PUSH: 'Notification push' };
/** Motifs du contrat C4 (liste fermée). */
const REASONS = [
    'PREFERENCE_DISABLED', 'ACCOUNT_SUSPENDED', 'QUIET_HOURS', 'NO_PHONE', 'NO_REAL_EMAIL', 'EMAIL_NOT_CONFIGURED', 'PUSH_NOT_CONFIGURED',
    'NO_PUSH_SUBSCRIPTION', 'PUSH_DELIVERED', 'SMS_POLICY_NEVER', 'SMS_DAILY_CAP', 'SMS_RECIPIENT_CAP', 'SMS_ACCOUNT_CAP', 'COUNTER_RECEIPT_CAP',
    'NO_VALID_TICKET', 'TITLE_ONLY', 'COVERED_BY_INVITATION', 'SETTING_MISSING', 'MIGRATED_NO_PHONE',
    'EVENT_SUSPENDU', 'EVENT_ANNULE', 'EVENT_TERMINE', 'EVENT_RESCHEDULED', 'EVENT_NOT_PUBLISHED', 'EVENT_STARTED', 'NO_LONGER_HOLDER',
    'NO_LONGER_ASSIGNED', 'NO_LONGER_RELEVANT', 'SUPERSEDED',
    'SMS_REJECTED', 'SMS_GUARD_UNAVAILABLE', 'SMS_PROVIDER_ERROR', 'EMAIL_REJECTED', 'EMAIL_PROVIDER_ERROR', 'PUSH_REJECTED',
    'PUSH_PAYLOAD_TOO_LARGE', 'PUSH_PROVIDER_ERROR', 'TEMPLATE_ERROR', 'SENDING_INTERRUPTED', 'MIGRATED_FAILED',
    'PROVIDER_TIMEOUT', 'PROVIDER_UNREADABLE', 'MIGRATED_WHILE_SENDING',
    // Lot 7 (7.0 a, 7.0 b, T3) : budget des SMS optionnels atteint ; rappel d'un porteur de billets gratuits seulement.
    'SMS_OPTIONAL_CAP', 'FREE_TICKETS_ONLY', 'EMAIL_NOT_VERIFIED', 'DEMO_ACCOUNT', 'DEMO_GUARD_UNAVAILABLE', // lot 9 bis (T32 : G.52, I1, 11.2)
];

/** Lignes écrites par la suite (supprimées en fin de suite) et comptes admin créés (suspendus en fin de suite). */
const createdRows: string[] = [];
const createdAdmins: string[] = [];

after(async () => {
    const existing = createdRows.length === 0 ? [] : (await outboxRows({ ids: createdRows })).map((r) => r.id);
    await deleteOutboxRows(existing);
    if (createdAdmins.length > 0) {
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).in('id', createdAdmins);
        assert.equal(error, null, `suspension des comptes admin de la suite : ${error?.message}`);
    }
    await assertNotificationInvariants('notif-admin');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

async function call(relPath: string, method: string, what: string, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const h = await lotFunction<Handler>(relPath, method, what);
    const res = await h(req, ctx);
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

function list(token: string | null, query = ''): Promise<RouteResult> {
    return call(LIST_ROUTE, 'GET', 'GET /api/admin/notifications (contrat L3)', jsonRequest(`/api/admin/notifications${query}`, 'GET', token));
}

function detail(token: string | null, id: string): Promise<RouteResult> {
    return call(DETAIL_ROUTE, 'GET', 'GET /api/admin/notifications/[id] (contrat L3)', jsonRequest(`/api/admin/notifications/${id}`, 'GET', token), routeContext({ id }));
}

function stats(token: string | null, query = ''): Promise<RouteResult> {
    return call(STATS_ROUTE, 'GET', 'GET /api/admin/notifications/stats (contrat L3)', jsonRequest(`/api/admin/notifications/stats${query}`, 'GET', token));
}

function retry(token: string | null, id: string): Promise<RouteResult> {
    return call(RETRY_ROUTE, 'POST', 'POST /api/admin/notifications/[id]/retry (contrat L3)', jsonRequest(`/api/admin/notifications/${id}/retry`, 'POST', token, {}), routeContext({ id }));
}

async function row(values: OutboxInsert): Promise<OutboxRow> {
    const r = await insertOutboxRow(values);
    createdRows.push(r.id);
    return r;
}

async function admin(label: string, permissions: string[]): Promise<TestAdmin> {
    const a = await newAdmin(label, permissions);
    createdAdmins.push(a.userId);
    return a;
}

function itemsOf(r: RouteResult, what: string): Row[] {
    assert.equal(r.status, 200, `${what} : ${show(r)}`);
    assert.ok(Array.isArray(r.body.items), `${what} : « items » attendu, ${show(r)}`);
    return r.body.items as Row[];
}

function itemIds(items: Row[]): string[] {
    return items.map((i) => String(i.id));
}

async function freshRow(id: string): Promise<OutboxRow> {
    const [r] = await outboxRows({ ids: [id] });
    assert.ok(r, `ligne ${id} introuvable`);
    return r;
}

function maskedPhone(p: string): string {
    return `+221 ${p.slice(4, 6)} *** ** ${p.slice(-2)}`;
}

let superToken: string;
let superId: string;

before(async () => {
    const s = await signInAs('SUPERADMIN');
    superToken = s.accessToken;
    superId = s.userId;
});

// ── Liste, filtres, pagination (L2, L3) ────────────────────────────────────

describe('6.8 Liste des notifications : filtres, pagination, destinataire masqué (L2, L3)', () => {
    let reader: TestAdmin;
    let client: Buyer;
    const phoneA = randomSenegalPhone('77');
    const email = `awa.diop.${randomBytes(3).toString('hex')}@exemple.sn`;
    let eventId: string;
    let eventTitle: string;
    let sent: OutboxRow;
    let failedA: OutboxRow;
    let failedB: OutboxRow;
    let failedC: OutboxRow;
    let uncertain: OutboxRow;
    let skippedPush: OutboxRow;
    let cancelled: OutboxRow;
    let pending: OutboxRow;
    let otpLog: OutboxRow;
    let pushSent: OutboxRow;
    let pushEndpoint: string;
    const otpCode = String(randomInt(100_000, 999_999));
    const otpLink = `https://app.eventvillage.sn/controller/setup?ref=${randomBytes(6).toString('hex')}`;

    before(async () => {
        reader = await admin('notif-lecture', ['notifications.read']);
        client = await newBuyer('notif-admin-client', { firstName: 'Awa', lastName: 'Destinataire' });
        const fx = await loadFixtures();
        const ev = Object.values(fx.events)[0];
        const { data: evRow, error } = await service.from('events').select('id, title').eq('id', ev.id).single();
        assert.equal(error, null, `événement du seed : ${error?.message}`);
        eventId = String(evRow.id);
        eventTitle = String(evRow.title);

        const keys = newVapidKeys();
        const sub = fakeBrowserSubscription();
        pushEndpoint = sub.endpoint;
        const { data: subRow, error: subErr } = await service.from('push_subscriptions').insert({
            user_id: client.userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, vapid_key_id: keys.keyId,
        }).select('id').single();
        assert.equal(subErr, null, `abonnement push : ${subErr?.message} (code ${subErr?.code}) — table push_subscriptions du contrat C5`);

        sent = await row({ status: 'SENT', recipient_phone: phoneA, attempts: 1, provider_message_id: `fake-sms-${randomUUID().slice(0, 8)}`,
            decision: { at: new Date().toISOString(), stage: 'CLAIM', outcome: 'SEND', family: 'ESSENTIAL', preference: null } });
        failedA = await row({ status: 'FAILED', recipient_phone: phoneA, attempts: 5, reason: 'SMS_REJECTED', reason_detail: '102',
            decision: { at: new Date().toISOString(), stage: 'CLAIM', outcome: 'SEND', delivery: { outcome: 'REJECTED', code: '102' } } });
        failedB = await row({ status: 'FAILED', channel: 'EMAIL', recipient_email: email, attempts: 5, reason: 'EMAIL_REJECTED' });
        failedC = await row({ status: 'FAILED', channel: 'IN_APP', recipient_user_id: client.userId, attempts: 1, reason: 'TEMPLATE_ERROR', reason_detail: 'title' });
        uncertain = await row({ status: 'UNCERTAIN', recipient_phone: phoneA, attempts: 1, reason: 'PROVIDER_TIMEOUT' });
        skippedPush = await row({ status: 'SKIPPED', type: 'TICKET_SCANNED', channel: 'PUSH', recipient_user_id: client.userId, reason: 'NO_PUSH_SUBSCRIPTION' });
        cancelled = await row({ status: 'CANCELLED', type: 'REMINDER_H3', family: 'OPTIONAL', topic: 'REMINDERS', recipient_user_id: client.userId,
            event_id: eventId, reason: 'EVENT_ANNULE', template_data: { event_id: eventId, title: eventTitle, sms_policy: 'IF_NO_PUSH' } });
        pending = await row({ status: 'PENDING', recipient_phone: phoneA });
        otpLog = await row({ status: 'SENT', type: 'OTP_LOGIN', origin: 'SYNC_LOG', recipient_phone: randomSenegalPhone('78'), attempts: 1,
            provider_message_id: `fake-sms-${randomUUID().slice(0, 8)}`,
            // Ligne fabriquée qui porte un code et un lien (jamais écrits par notification_sync_log) : le détail ne doit rien en montrer.
            template_data: { purpose: 'LOGIN', note: `Votre code de verification Event Village est : ${otpCode}`, lien: otpLink } });
        pushSent = await row({ status: 'SENT', type: 'TICKET_SCANNED', channel: 'PUSH', recipient_user_id: client.userId, attempts: 1,
            decision: { at: new Date().toISOString(), stage: 'CLAIM', outcome: 'SEND', delivery: { devices: [{ subscription_id: subRow?.id, status: 'ACCEPTED' }] } } });
    });

    test('statut FAILED : uniquement des FAILED, les 3 de la suite en tête (created_at DESC), can_retry vrai ; compteurs par statut', async () => {
        const r = await list(reader.accessToken, '?status=FAILED&pageSize=50');
        const items = itemsOf(r, 'liste FAILED');
        assert.ok(items.every((i) => i.status === 'FAILED'), `statuts reçus : ${JSON.stringify(Array.from(new Set(items.map((i) => i.status))))}`);
        assert.deepEqual(itemIds(items).slice(0, 3), [failedC.id, failedB.id, failedA.id], 'les 3 FAILED de la suite, de la plus récente à la plus ancienne');
        assert.ok(!itemIds(items).includes(sent.id), 'une ligne SENT n’apparaît pas sous le filtre FAILED');
        assert.ok(items.every((i) => i.can_retry === true), 'can_retry vrai pour une ligne FAILED');
        for (const k of ['id', 'created_at', 'type', 'channel', 'status', 'reason', 'attempts', 'recipient_masked', 'event_title', 'sent_at', 'can_retry']) {
            assert.ok(Object.prototype.hasOwnProperty.call(items[0], k), `champ ${k} attendu : ${JSON.stringify(items[0])}`);
        }
        assert.equal(r.body.page, 1, show(r));
        assert.equal(r.body.page_size, 50, show(r));
        assert.ok(Number(r.body.total) >= 3, `total ≥ 3, ${show(r)}`);
        const counts = r.body.counts as Record<string, unknown> | undefined;
        assert.ok(counts && typeof counts === 'object', `compteurs par statut : ${show(r)}`);
        assert.ok(Number(counts.FAILED) >= 3, `compteur FAILED ≥ 3 : ${JSON.stringify(counts)}`);
    });

    test('pagination : page_size 2, page 1 puis page 2, sans recouvrement ; 20 par défaut', async () => {
        const p1 = itemsOf(await list(reader.accessToken, '?status=FAILED&pageSize=2&page=1'), 'FAILED page 1');
        const p2r = await list(reader.accessToken, '?status=FAILED&pageSize=2&page=2');
        const p2 = itemsOf(p2r, 'FAILED page 2');
        assert.deepEqual(itemIds(p1), [failedC.id, failedB.id], 'page 1 : les deux FAILED les plus récentes');
        assert.equal(itemIds(p2)[0], failedA.id, 'page 2 : la troisième');
        assert.equal(p2r.body.page, 2, show(p2r));
        assert.equal(p2r.body.page_size, 2, show(p2r));
        const def = await list(reader.accessToken, '');
        assert.equal(def.body.page_size, 20, `20 par page par défaut, ${show(def)}`);
        assert.ok(itemsOf(def, 'liste sans filtre').length <= 20, '20 lignes au plus');
    });

    test('canal, type et période : chaque filtre restreint la liste ; période en jours de Dakar', async () => {
        const email1 = itemsOf(await list(reader.accessToken, '?status=FAILED&channel=EMAIL&pageSize=50'), 'FAILED EMAIL');
        assert.ok(email1.every((i) => i.channel === 'EMAIL' && i.status === 'FAILED'), 'canal EMAIL et statut FAILED');
        assert.equal(itemIds(email1)[0], failedB.id, 'la ligne EMAIL FAILED de la suite en tête');
        assert.ok(!itemIds(email1).includes(failedA.id), 'la ligne SMS est exclue');

        const otp = itemsOf(await list(reader.accessToken, '?type=OTP_LOGIN&pageSize=50'), 'type OTP_LOGIN');
        assert.ok(otp.every((i) => i.type === 'OTP_LOGIN'), 'type OTP_LOGIN seulement');
        assert.equal(itemIds(otp)[0], otpLog.id, 'le journal OTP de la suite en tête');
        assert.ok(otp.every((i) => i.can_retry === false), 'un journal OTP ne se relance pas');

        const today = dakarDay(0);
        const inDay = itemIds(itemsOf(await list(reader.accessToken, `?status=FAILED&from=${today}&to=${today}&pageSize=50`), 'période du jour'));
        assert.ok([failedA.id, failedB.id, failedC.id].every((id) => inDay.includes(id)), 'les lignes du jour sont dans la période du jour');
        const fromTomorrow = itemIds(itemsOf(await list(reader.accessToken, `?status=FAILED&from=${dakarDay(1)}&pageSize=50`), 'à partir de demain'));
        assert.ok(![failedA.id, failedB.id, failedC.id].some((id) => fromTomorrow.includes(id)), 'aucune ligne du jour à partir de demain');
        const toYesterday = itemIds(itemsOf(await list(reader.accessToken, `?status=FAILED&to=${dakarDay(-1)}&pageSize=50`), 'jusqu’à hier'));
        assert.ok(![failedA.id, failedB.id, failedC.id].some((id) => toYesterday.includes(id)), 'aucune ligne du jour jusqu’à hier');
    });

    test('filtre inconnu (statut, canal, type) → 400 INVALID_FILTER', async () => {
        for (const q of ['?status=EXPEDIEE', '?channel=FAX', '?type=TYPE_INCONNU', "?status=FAILED'%20OR%201=1"]) {
            const r = await list(reader.accessToken, q);
            assert.equal(r.status, 400, `${q} : 400 attendu, ${show(r)}`);
            assert.equal(r.body.code, 'INVALID_FILTER', `${q} : code INVALID_FILTER, ${show(r)}`);
        }
    });

    test('destinataire masqué : numéro « +221 77 *** ** 45 », email « aw***@domaine », compte par son nom, jamais d’endpoint push', async () => {
        const all = itemsOf(await list(reader.accessToken, '?pageSize=50'), 'liste sans filtre');
        const byId = new Map(all.map((i) => [String(i.id), i]));
        for (const r of [sent, failedA, failedB, failedC, uncertain, skippedPush, cancelled, pending, otpLog, pushSent]) {
            assert.ok(byId.has(r.id), `ligne ${r.status} ${r.channel} de la suite présente dans les 50 plus récentes`);
        }
        assert.equal(byId.get(failedA.id)?.recipient_masked, maskedPhone(phoneA), 'numéro masqué');
        assert.equal(byId.get(failedB.id)?.recipient_masked, `aw***@${email.split('@')[1]}`, 'email masqué');
        const byAccount = String(byId.get(failedC.id)?.recipient_masked ?? '');
        assert.match(byAccount, /Awa/, `compte désigné par son nom : « ${byAccount} »`);
        const text = JSON.stringify(all);
        assert.ok(!text.includes(phoneA), 'le numéro complet n’apparaît pas dans la liste');
        assert.ok(!text.includes(phoneA.slice(4)), 'les 9 chiffres du numéro n’apparaissent pas');
        assert.ok(!text.includes(email), 'l’email complet n’apparaît pas');
        assert.ok(!text.includes(client.phoneE164) && !text.includes(client.email), 'ni le numéro ni l’email du compte destinataire');
        assert.ok(!text.includes(pushEndpoint) && !text.includes('fcm.googleapis.com'), 'jamais d’endpoint push');
        assert.ok(!text.includes(otpCode) && !text.includes(otpLink), 'aucun code ni lien de journal OTP dans la liste');
        assert.ok(!text.includes('claim_token'), 'aucun claim_token');
        assert.equal(byId.get(cancelled.id)?.event_title, eventTitle, 'titre de l’événement de la ligne');
        assert.equal(byId.get(sent.id)?.can_retry, false, 'can_retry faux pour SENT');
        assert.equal(byId.get(uncertain.id)?.can_retry, false, 'can_retry faux pour UNCERTAIN');
        assert.equal(byId.get(pending.id)?.can_retry, false, 'can_retry faux pour PENDING');
    });

    test('détail : ligne sans claim_token, destinataire, décision, données ; can_retry selon le statut ; inconnue → 404 NOT_FOUND', async () => {
        const d = await detail(reader.accessToken, failedA.id);
        assert.equal(d.status, 200, `détail FAILED : ${show(d)}`);
        const item = d.body.item as Row;
        assert.ok(item && typeof item === 'object', `{ item } attendu : ${show(d)}`);
        assert.equal(item.id, failedA.id);
        assert.equal(item.status, 'FAILED');
        assert.equal(item.reason, 'SMS_REJECTED');
        assert.equal(item.attempts, 5);
        assert.equal(item.can_retry, true, 'can_retry vrai pour FAILED');
        assert.ok(!Object.prototype.hasOwnProperty.call(item, 'claim_token'), 'claim_token jamais renvoyé');
        assert.deepEqual((item.decision as Row | null)?.delivery, { outcome: 'REJECTED', code: '102' }, 'instantané de décision renvoyé');
        assert.equal((item.recipient as Row | undefined)?.phone, phoneA, 'destinataire : numéro complet dans le détail (admin)');

        const forAccount = await detail(reader.accessToken, failedC.id);
        const recipient = (forAccount.body.item as Row | undefined)?.recipient as Row | undefined;
        assert.equal(recipient?.user_id, client.userId, `destinataire : compte, ${show(forAccount)}`);
        assert.match(String(recipient?.display_name ?? ''), /Awa/, 'nom du compte');

        const s = await detail(reader.accessToken, sent.id);
        assert.equal((s.body.item as Row | undefined)?.can_retry, false, `can_retry faux pour SENT, ${show(s)}`);

        const push = await detail(reader.accessToken, pushSent.id);
        assert.equal(push.status, 200, show(push));
        assert.ok(!JSON.stringify(push.body).includes(pushEndpoint), 'jamais d’endpoint push dans le détail');

        const missing = await detail(reader.accessToken, randomUUID());
        assert.equal(missing.status, 404, `ligne inconnue : ${show(missing)}`);
        assert.equal(missing.body.code, 'NOT_FOUND', show(missing));
    });

    test('journal OTP : template_data réduit à { purpose }, aucun code ni lien, jamais relançable', async () => {
        const d = await detail(reader.accessToken, otpLog.id);
        assert.equal(d.status, 200, `détail du journal OTP : ${show(d)}`);
        const item = d.body.item as Row;
        assert.equal(item.origin, 'SYNC_LOG');
        assert.deepEqual(item.template_data, { purpose: 'LOGIN' }, 'données réduites à { purpose }');
        const text = JSON.stringify(d.body);
        assert.ok(!text.includes(otpCode), 'le code n’apparaît nulle part dans la réponse');
        assert.ok(!text.includes(otpLink), 'le lien n’apparaît nulle part dans la réponse');
        assert.equal(item.can_retry, false, 'journal OTP jamais relançable');
    });
});

// ── Statistiques (L2) ──────────────────────────────────────────────────────

interface DayStat { day: string; channel: string; sent: number; failed: number; skipped: number; uncertain: number; cancelled: number }
interface StatsSnapshot {
    byDay: DayStat[];
    smsMonth: { month: string; sent: number; uncertain: number; otp: number };
    smsToday: number;
    threshold: unknown;
    /** Lot 7 (T3) : plafond des SMS optionnels et SMS optionnels du jour, tels que servis. */
    optionalCap: unknown;
    optionalToday: unknown;
}

function snapshotOf(r: RouteResult): StatsSnapshot {
    assert.equal(r.status, 200, `statistiques : ${show(r)}`);
    assert.ok(Array.isArray(r.body.by_day), `by_day attendu : ${show(r)}`);
    const m = r.body.sms_month as Row | undefined;
    assert.ok(m && typeof m === 'object', `sms_month attendu : ${show(r)}`);
    return {
        byDay: (r.body.by_day as Row[]).map((d) => ({
            day: String(d.day), channel: String(d.channel), sent: Number(d.sent), failed: Number(d.failed),
            skipped: Number(d.skipped), uncertain: Number(d.uncertain), cancelled: Number(d.cancelled),
        })),
        smsMonth: { month: String(m.month), sent: Number(m.sent), uncertain: Number(m.uncertain), otp: Number(m.otp) },
        smsToday: Number(r.body.sms_today),
        threshold: r.body.threshold,
        optionalCap: r.body.optional_cap,
        optionalToday: r.body.optional_today,
    };
}

function dayStat(s: StatsSnapshot, day: string, channel: string): DayStat {
    return s.byDay.find((d) => d.day === day && d.channel === channel) ?? { day, channel, sent: 0, failed: 0, skipped: 0, uncertain: 0, cancelled: 0 };
}

describe('6.8 Statistiques : par canal et par jour, SMS du mois et du jour (L2)', () => {
    test('par différence autour de lignes de la suite : SMS envoyés (journal OTP compris), échecs, incertains, non envoyés, annulés ; email ; seuil', async () => {
        const reader = await admin('notif-stats', ['notifications.read']);
        const phone = randomSenegalPhone('77');
        let attempt = 0;
        for (;;) {
            attempt += 1;
            const day = dakarDay(0);
            const before1 = snapshotOf(await stats(reader.accessToken, '?days=14'));
            await row({ status: 'SENT', recipient_phone: phone, attempts: 1 });
            await row({ status: 'SENT', recipient_phone: phone, attempts: 1 });
            await row({ status: 'UNCERTAIN', recipient_phone: phone, attempts: 1, reason: 'PROVIDER_TIMEOUT' });
            await row({ status: 'FAILED', recipient_phone: phone, attempts: 5, reason: 'SMS_REJECTED' });
            await row({ status: 'SKIPPED', recipient_phone: phone, reason: 'SMS_DAILY_CAP' });
            await row({ status: 'CANCELLED', recipient_phone: phone, reason: 'NO_LONGER_RELEVANT', type: 'EVENT_CHANGED', family: 'OPTIONAL', topic: 'EVENT_UPDATES' });
            await row({ status: 'SENT', channel: 'EMAIL', recipient_email: `stats.${randomBytes(3).toString('hex')}@exemple.sn`, attempts: 1 });
            await row({ status: 'SENT', type: 'OTP_LOGIN', origin: 'SYNC_LOG', recipient_phone: phone, attempts: 1, template_data: { purpose: 'LOGIN' } });
            const after1 = snapshotOf(await stats(reader.accessToken, '?days=14'));
            if (dakarDay(0) !== day && attempt < 2) {
                console.log('[notif-admin] minuit de Dakar franchi pendant la mesure : nouvelle mesure');
                continue;
            }
            const smsB = dayStat(before1, day, 'SMS');
            const smsA = dayStat(after1, day, 'SMS');
            assert.deepEqual(
                { sent: smsA.sent - smsB.sent, failed: smsA.failed - smsB.failed, uncertain: smsA.uncertain - smsB.uncertain, skipped: smsA.skipped - smsB.skipped, cancelled: smsA.cancelled - smsB.cancelled },
                { sent: 3, failed: 1, uncertain: 1, skipped: 1, cancelled: 1 },
                'SMS du jour : 2 envoyés + 1 journal OTP, 1 échec, 1 incertain, 1 non envoyé, 1 annulé');
            const emailB = dayStat(before1, day, 'EMAIL');
            const emailA = dayStat(after1, day, 'EMAIL');
            assert.equal(emailA.sent - emailB.sent, 1, 'email du jour : 1 envoyé');
            assert.equal(after1.smsMonth.month, day.slice(0, 7), 'mois de Dakar (AAAA-MM)');
            assert.equal(after1.smsMonth.sent - before1.smsMonth.sent, 3, 'SMS du mois : SENT, journaux OTP compris');
            assert.equal(after1.smsMonth.uncertain - before1.smsMonth.uncertain, 1, 'SMS du mois : UNCERTAIN');
            assert.equal(after1.smsMonth.otp - before1.smsMonth.otp, 1, 'SMS du mois : 1 journal OTP');
            assert.equal(after1.smsToday - before1.smsToday, 4, 'SMS du jour : SENT + UNCERTAIN, journal OTP compris');
            // Lot 7 (7.0 a, T3) : seuil = 80 % du plafond des SMS optionnels (null si le plafond vaut 0), servi par le serveur.
            const cap = await getNotifSetting('notif.sms_optional_daily_cap');
            assert.equal(typeof cap, 'number', `plafond des SMS optionnels : ${JSON.stringify(cap)}`);
            assert.equal(after1.optionalCap, cap, `optional_cap = notif.sms_optional_daily_cap (${JSON.stringify(after1.optionalCap)})`);
            assert.deepEqual(after1.threshold, (cap as number) > 0 ? Math.ceil(((cap as number) * 8) / 10) : null, `seuil = ceil(0,8 × ${String(cap)}) (${JSON.stringify(after1.threshold)})`);
            assert.ok(Number.isInteger(after1.optionalToday) && (after1.optionalToday as number) >= 0, `optional_today : entier servi par le serveur (${JSON.stringify(after1.optionalToday)})`);
            const days = new Set(after1.byDay.map((d) => d.day));
            assert.ok(days.size <= 14, `14 jours au plus, ${days.size}`);
            assert.ok(after1.byDay.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day) && d.day <= day && d.day >= dakarDay(-13)), 'jours de Dakar des 14 derniers jours');
            break;
        }
    });
});

// ── Permissions (L1, L3) ───────────────────────────────────────────────────

describe('6.8 Permissions notifications.read et notifications.write (L1, L3)', () => {
    test('sans session 401 ; client 403 ; ADMIN sans permission 403 partout ; lecture seule : lecture oui, relance 403 ; SUPERADMIN : lecture', async () => {
        const none = await admin('notif-aucune', ['events.read']);
        const reader = await admin('notif-lecture-seule', ['notifications.read']);
        const client = await newBuyer('notif-admin-intrus');
        const id = randomUUID();

        for (const [who, token] of [['sans session', null], ['client', client.accessToken], ['ADMIN sans notifications.*', none.accessToken]] as Array<[string, string | null]>) {
            const expected = token === null ? 401 : 403;
            for (const [what, r] of [
                ['liste', await list(token)],
                ['détail', await detail(token, id)],
                ['statistiques', await stats(token)],
                ['relance', await retry(token, id)],
            ] as Array<[string, RouteResult]>) {
                assert.equal(r.status, expected, `${who} : ${what} → ${expected} attendu, ${show(r)}`);
            }
        }
        const denied = await list(none.accessToken);
        assert.deepEqual([denied.body.code, denied.body.permission], ['PERMISSION_MISSING', 'notifications.read'], `lot 9 bis (R51, T32) : code et permission du refus, ${show(denied)}`); assert.match(String(denied.body.error).replace(/[\u00a0\u202f]/g, ' '), /^Action non autorisée : votre compte n['’]a pas la permission « [^»]*[a-zé][^»]* »\.$/, `libellé français, sans code technique (B34), ${show(denied)}`); assert.doesNotMatch(String(denied.body.error), /notifications\.read/, show(denied));

        assert.equal((await list(reader.accessToken)).status, 200, 'lecture seule : liste');
        assert.equal((await stats(reader.accessToken)).status, 200, 'lecture seule : statistiques');
        assert.equal((await detail(reader.accessToken, id)).status, 404, 'lecture seule : détail (ligne inconnue → 404, pas 403)');
        const r = await retry(reader.accessToken, id);
        assert.equal(r.status, 403, `lecture seule : relance refusée, ${show(r)}`);
        assert.match(String(r.body.error), /notifications\.write/, show(r));

        assert.equal((await list(superToken)).status, 200, 'SUPERADMIN : liste');
        assert.equal((await stats(superToken)).status, 200, 'SUPERADMIN : statistiques');
    });

    test('lib/admin/admin-auth.ts : notifications.read et notifications.write sont des permissions connues', async () => {
        const mod = await loadLotModule('../../lib/admin/admin-auth', 'vérification des droits admin');
        const perms = mod.ADMIN_PERMISSIONS as readonly string[];
        assert.ok(perms.includes('notifications.read'), 'notifications.read dans ADMIN_PERMISSIONS');
        assert.ok(perms.includes('notifications.write'), 'notifications.write dans ADMIN_PERMISSIONS');
    });
});

// ── Relance (L2, L3) ───────────────────────────────────────────────────────

describe('6.8 Relance : FAILED seulement, permission vérifiée aussi par la RPC (L2, L3)', () => {
    let reader: TestAdmin;
    let writer: TestAdmin;
    let suspendedWriter: TestAdmin;
    let client: Buyer;
    let f1: OutboxRow;
    let f2: OutboxRow;
    let f3: OutboxRow;
    const others: Partial<Record<OutboxStatus, OutboxRow>> = {};

    before(async () => {
        reader = await admin('notif-relance-lecture', ['notifications.read']);
        writer = await admin('notif-relance-ecriture', ['notifications.read', 'notifications.write']);
        suspendedWriter = await admin('notif-relance-suspendu', ['notifications.read', 'notifications.write']);
        client = await newBuyer('notif-relance-client');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspendedWriter.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        f1 = await row({ status: 'FAILED', attempts: 5, reason: 'SMS_REJECTED', reason_detail: '102' });
        f2 = await row({ status: 'FAILED', attempts: 5, reason: 'SMS_PROVIDER_ERROR' });
        f3 = await row({ status: 'FAILED', attempts: 5, reason: 'SMS_REJECTED' });
        others.SENT = await row({ status: 'SENT', attempts: 1 });
        others.UNCERTAIN = await row({ status: 'UNCERTAIN', attempts: 1, reason: 'PROVIDER_TIMEOUT' });
        others.SKIPPED = await row({ status: 'SKIPPED', reason: 'SMS_DAILY_CAP' });
        others.CANCELLED = await row({ status: 'CANCELLED', reason: 'NO_LONGER_RELEVANT' });
        others.PENDING = await row({ status: 'PENDING' });
        others.SENDING = await row({ status: 'SENDING', attempts: 1, claimed_at: new Date().toISOString(), claim_token: randomUUID() });
    });

    test('RPC notification_retry : acteur ADMIN en lecture seule, ADMIN suspendu ou client → FORBIDDEN, ligne intacte', async () => {
        for (const [who, actor] of [['lecture seule', reader.userId], ['ADMIN suspendu', suspendedWriter.userId], ['client', client.userId]] as Array<[string, string]>) {
            const { data, error } = await service.rpc('notification_retry', { p: { id: f3.id, actor_id: actor } });
            assert.equal(error, null, `notification_retry (${who}) : ${error?.message} (code ${error?.code}) — RPC du contrat L2, migration 20261103000008`);
            assert.equal((data as Row).ok, false, `${who} : refus attendu, ${JSON.stringify(data)}`);
            assert.equal((data as Row).code, 'FORBIDDEN', `${who} : FORBIDDEN, ${JSON.stringify(data)}`);
        }
        const r = await freshRow(f3.id);
        assert.equal(r.status, 'FAILED');
        assert.equal(r.manual_retries, 0);
    });

    test('route : lecture seule 403, ADMIN suspendu 403 ; la ligne reste FAILED', async () => {
        const a = await retry(reader.accessToken, f3.id);
        assert.equal(a.status, 403, `lecture seule : ${show(a)}`);
        const b = await retry(suspendedWriter.accessToken, f3.id);
        assert.equal(b.status, 403, `ADMIN suspendu : ${show(b)}`);
        assert.equal((await freshRow(f3.id)).status, 'FAILED');
    });

    test('notifications.write : FAILED → PENDING, tentatives remises à zéro, motif effacé, manual_retries 1, audit ; seconde relance 409', async () => {
        const t0 = Date.now();
        const r = await retry(writer.accessToken, f1.id);
        assert.equal(r.status, 200, `relance : ${show(r)}`);
        assert.equal(r.body.success, true, show(r));
        const after1 = await freshRow(f1.id);
        assert.equal(after1.status, 'PENDING', 'ligne remise en attente');
        assert.equal(after1.attempts, 0, 'tentatives remises à zéro');
        assert.equal(after1.reason, null, 'motif effacé');
        assert.equal(after1.manual_retries, 1, 'manual_retries + 1');
        assert.equal(after1.claim_token, null, 'aucun jeton de réservation');
        const next = Date.parse(after1.next_attempt_at);
        assert.ok(next >= t0 - 60_000 && next <= Date.now() + 5_000, `prochain essai à maintenant (${after1.next_attempt_at})`);
        const { data: audit, error } = await service.from('audit_logs').select('user_id, action, object_id')
            .eq('action', 'NOTIFICATION_RETRY').eq('object_id', f1.id);
        assert.equal(error, null, error?.message);
        assert.deepEqual((audit ?? []).map((a) => a.user_id), [writer.userId], `audit NOTIFICATION_RETRY par ${writer.userId} : ${JSON.stringify(audit)}`);

        const again = await retry(writer.accessToken, f1.id);
        assert.equal(again.status, 409, `ligne déjà relancée (PENDING) : ${show(again)}`);
        assert.equal(again.body.code, 'NOT_RETRYABLE', show(again));
        assert.equal((await freshRow(f1.id)).manual_retries, 1, 'pas de seconde relance');
    });

    test('SENT, UNCERTAIN, SKIPPED, CANCELLED, PENDING, SENDING → 409 NOT_RETRYABLE, message exact, ligne inchangée', async () => {
        for (const [status, r0] of Object.entries(others) as Array<[OutboxStatus, OutboxRow]>) {
            const r = await retry(writer.accessToken, r0.id);
            assert.equal(r.status, 409, `${status} : 409 attendu, ${show(r)}`);
            assert.equal(r.body.code, 'NOT_RETRYABLE', `${status} : ${show(r)}`);
            assert.equal(r.body.error, NOT_RETRYABLE_MESSAGE, `${status} : message`);
            const fresh = await freshRow(r0.id);
            assert.equal(fresh.status, status, `${status} : statut inchangé`);
            assert.equal(fresh.manual_retries, 0, `${status} : aucune relance comptée`);
            const { data, error } = await service.rpc('notification_retry', { p: { id: r0.id, actor_id: writer.userId } });
            assert.equal(error, null, error?.message);
            assert.equal((data as Row).code, 'NOT_RETRYABLE', `${status} : RPC NOT_RETRYABLE, ${JSON.stringify(data)}`);
        }
    });

    test('SUPERADMIN : relance d’une ligne FAILED ; ligne inconnue → 404', async () => {
        const r = await retry(superToken, f2.id);
        assert.equal(r.status, 200, `SUPERADMIN : ${show(r)}`);
        const fresh = await freshRow(f2.id);
        assert.equal(fresh.status, 'PENDING');
        assert.equal(fresh.manual_retries, 1);
        const { data: audit } = await service.from('audit_logs').select('user_id').eq('action', 'NOTIFICATION_RETRY').eq('object_id', f2.id);
        assert.deepEqual((audit ?? []).map((a) => a.user_id), [superId], 'audit par le SUPERADMIN');
        const missing = await retry(superToken, randomUUID());
        assert.equal(missing.status, 404, `ligne inconnue : ${show(missing)}`);
        assert.equal(missing.body.code, 'NOT_FOUND', show(missing));
    });
});

// ── Libellés humains (L4) ──────────────────────────────────────────────────

describe('6.8 Libellés humains (lib/notifications/outbox-labels.ts, L4)', () => {
    test('statuts, canaux, chaque motif de C4 et chaque type du registre ont un libellé français, jamais le code', async () => {
        const mod = await loadLotModule(LABELS_MODULE, 'libellés de la boîte d’envoi (contrat L4)');
        const statusLabels = mod.OUTBOX_STATUS_LABELS as Record<string, string> | undefined;
        const channelLabels = mod.OUTBOX_CHANNEL_LABELS as Record<string, string> | undefined;
        const reasonLabels = mod.OUTBOX_REASON_LABELS as Record<string, string> | undefined;
        const typeLabels = mod.OUTBOX_TYPE_LABELS as Record<string, string> | undefined;
        for (const [name, v] of [['OUTBOX_STATUS_LABELS', statusLabels], ['OUTBOX_CHANNEL_LABELS', channelLabels], ['OUTBOX_REASON_LABELS', reasonLabels], ['OUTBOX_TYPE_LABELS', typeLabels]] as const) {
            assert.ok(v && typeof v === 'object', `${name} exporté par lib/notifications/outbox-labels.ts`);
        }
        const norm = (s: string) => s.replace(/[’‘]/g, "'");
        assert.deepEqual(Object.fromEntries(Object.entries(statusLabels!).map(([k, v]) => [k, norm(v)])), STATUS_LABELS, 'libellés des statuts (L4)');
        assert.deepEqual(channelLabels, CHANNEL_LABELS, 'libellés des canaux (L4)');

        const humane = (code: string, label: unknown) => typeof label === 'string' && label.trim().length > 0 && label !== code && !/[A-Z]{2,}_[A-Z]/.test(label);
        const badReasons = REASONS.filter((c) => !humane(c, reasonLabels![c]));
        assert.deepEqual(badReasons, [], `motifs sans libellé humain : ${badReasons.join(', ')}`);

        const { data, error } = await service.from('notification_types').select('type');
        assert.equal(error, null, `registre notification_types : ${error?.message} (code ${error?.code})`);
        const types = (data ?? []).map((t) => String(t.type));
        assert.ok(types.length >= 50, `registre rempli (G2), ${types.length} types`);
        const badTypes = types.filter((t) => !humane(t, typeLabels![t]));
        assert.deepEqual(badTypes, [], `types sans libellé humain : ${badTypes.join(', ')}`);
    });
});
