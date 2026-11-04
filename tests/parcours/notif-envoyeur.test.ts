/**
 * Lot 6, tâche 6.1 — l'envoyeur unique (contrat E1 à E5, Conventions « Horloge », décisions 1 à 3 et 9).
 * L'envoyeur est appelé DANS le processus du test (dispatchAt / flushNotifications de notif-helpers, qui
 * appellent dispatchNotifications de lib/notifications/dispatcher.ts) : les faux adaptateurs SMS et
 * push enregistrent ce qui aurait été envoyé, compté par numéro neuf ou par appareil neuf, jamais
 * globalement. Les lignes sont filtrées par `onlyIds` : aucune ligne d'une autre suite n'est touchée.
 * Horloge : seulement par `now` (jamais dans le passé) ; les relances se prouvent à `now + 59 s`
 * (non reprise) et `now + 61 s` (reprise), sans attente réelle.
 *  - réservation concurrente : deux passages en parallèle, chaque ligne réservée et envoyée une fois ;
 *  - revérification à l'envoi : numéro du compte résolu à l'envoi, compte suspendu → SKIPPED
 *    ACCOUNT_SUSPENDED ; ordre des canaux (IN_APP avant SMS) ; marquage par jeton (`stale`) ;
 *  - relances 1, 5, 15, 60 min ; 5 tentatives puis FAILED avec motif, alerte ADMIN_NOTIFICATION_FAILED
 *    aux admins qui ont notifications.read et signal admin_signals ; refus définitif → FAILED dès la
 *    première tentative ; Retry-After du service push plafonné à 240 min ;
 *  - reprise des lignes SENDING de plus de 10 min : IN_APP renvoyée (une seule notification), SMS
 *    UNCERTAIN SENDING_INTERRUPTED sans second envoi, dernière tentative → FAILED ;
 *  - SMS incertain (uncertainNext) : UNCERTAIN, jamais renvoyé, même un jour plus tard ;
 *  - horloge passée refusée : INVALID_NOW (claim, mark, daily_checks), dispatchNotifications rejette ;
 *  - plafond SMS (SMS_GLOBAL_DAILY_CAP par withEnv) : lot 7 (7.0 a, T1, renverse la décision 9 du lot 6) —
 *    un SMS indispensable (PASSWORD_CHANGED) part quand même, un rappel optionnel (REMINDER_J1) → SKIPPED
 *    SMS_DAILY_CAP sans relance ; alerte à 80 % du budget optionnel (notif.sms_optional_daily_cap, remplace
 *    notif.sms_daily_alert) → une seule alerte par jour ;
 *  - route /api/cron/notifications-dispatch : 503, 401, 200 (rapport, envoi réel) ; contrôles statiques E5.
 * Texte vérifié (catalogue G3/G4, type PASSWORD_CHANGED, sans variable) :
 *  SMS « Event Village : le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous,
 *  contactez le support. » ; in-app « Mot de passe modifié ».
 *
 * Rouge avant correctif : lib/notifications/dispatcher.ts, les RPC notification_outbox_claim /
 * notification_outbox_mark / notification_daily_checks, la table notification_outbox et la route
 * app/api/cron/notifications-dispatch n'existent pas : insertOutboxRow échoue (table absente, PGRST205),
 * dispatchAt échoue « envoyeur (contrat E4) absent », les RPC renvoient PGRST202, la route est absente.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { getFakes } from '../fakes';
import { service, newBuyer, cronRequest, type Buyer } from './paiement-helpers';
import { BASE_URL, randomSenegalPhone } from './helpers';
import { newPartner } from './finance-helpers';
import {
    addMinutes, assertNotificationInvariants, createReminderEvent, dakarAt, dakarDay, dispatchAt, fakeBrowserSubscription, insertOutboxRow,
    loadLotModule, lotFunction, newAdmin, outboxRows, smsMark, smsTo, pushTo, withEnv, withNotifSettings, withVapid,
    type DispatchRunReport, type OutboxInsert, type OutboxRow, type TestAdmin,
} from './notif-helpers';
import { issueFreeTicket } from './terrain-helpers';

after(async () => {
    await assertNotificationInvariants('notif-envoyeur');
});

// ── Textes du catalogue (G3, G4) ───────────────────────────────────────────

const PASSWORD_SMS = "Event Village : le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support.";
const PASSWORD_IN_APP_TITLE = 'Mot de passe modifié';
const PASSWORD_IN_APP_CONTENT = "Le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support.";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const DISPATCHER_MODULE = '../../lib/notifications/dispatcher';
const ROUTE_MODULE = '../../app/api/cron/notifications-dispatch/route';
const ROUTE_FILE = path.join(process.cwd(), 'app', 'api', 'cron', 'notifications-dispatch', 'route.ts');

// ── Outils locaux ──────────────────────────────────────────────────────────

/** Ligne due maintenant (next_attempt_at une seconde avant l'heure réelle), PASSWORD_CHANGED, SMS par défaut. */
async function dueRow(over: OutboxInsert = {}): Promise<OutboxRow> {
    const due = new Date(Date.now() - 1000).toISOString();
    return insertOutboxRow({ type: 'PASSWORD_CHANGED', family: 'ESSENTIAL', channel: 'SMS', due_at: due, next_attempt_at: due, ...over });
}

async function rowOf(id: string): Promise<OutboxRow> {
    const rows = await outboxRows({ ids: [id] });
    assert.equal(rows.length, 1, `ligne ${id} introuvable dans notification_outbox`);
    return rows[0];
}

function ms(iso: string | null): number {
    assert.ok(iso, 'horodatage attendu');
    return Date.parse(iso);
}

function brief(r: OutboxRow): string {
    return JSON.stringify({ status: r.status, reason: r.reason, detail: r.reason_detail, attempts: r.attempts, next: r.next_attempt_at, claimed: r.claimed_at, sent: r.sent_at });
}

interface RpcResult { data: Record<string, unknown> | null; error: { code?: string; message: string } | null }

async function rpc(fn: string, p: Record<string, unknown>): Promise<RpcResult> {
    const { data, error } = await service.rpc(fn, { p });
    return { data: (data ?? null) as Record<string, unknown> | null, error };
}

async function rpcOk(fn: string, p: Record<string, unknown>): Promise<Record<string, unknown>> {
    const r = await rpc(fn, p);
    assert.equal(r.error, null, `${fn} : ${r.error?.message} (code ${r.error?.code})`);
    assert.equal(r.data?.ok, true, `${fn} refusé : ${JSON.stringify(r.data)}`);
    return r.data!;
}

interface ClaimedItem { id: string; claim_token: string; channel: string; type: string; attempts: number; recipient?: { user_id?: string | null; phone?: string | null } }

async function claim(now: Date, ids: string[], limit?: number): Promise<ClaimedItem[]> {
    const p: Record<string, unknown> = { now: now.toISOString(), only_ids: ids };
    if (limit !== undefined) p.limit = limit;
    const body = await rpcOk('notification_outbox_claim', p);
    assert.ok(Array.isArray(body.claimed), `notification_outbox_claim : « claimed » attendu (${JSON.stringify(body)})`);
    return body.claimed as ClaimedItem[];
}

async function failedAlerts(outboxId: string): Promise<OutboxRow[]> {
    return outboxRows({ type: 'ADMIN_NOTIFICATION_FAILED', keyPrefix: `ADMIN_NOTIFICATION_FAILED:${outboxId}:` });
}

async function signals(kind: string, refIds: string[]): Promise<Array<Record<string, unknown>>> {
    if (refIds.length === 0) return [];
    const { data, error } = await service.from('admin_signals').select('id, kind, ref_id').eq('kind', kind).in('ref_id', refIds);
    assert.equal(error, null, `lecture de admin_signals : ${error?.message}`);
    return data ?? [];
}

/** Alerte ADMIN_NOTIFICATION_FAILED attendue pour `admin` (notifications.read), absente pour `other`. */
async function assertFailedAlert(outboxId: string, failedType: string, channel: string, reason: string): Promise<void> {
    const alerts = await failedAlerts(outboxId);
    const mine = alerts.filter((a) => a.recipient_user_id === adminWith.userId);
    assert.equal(mine.length, 1, `ADMIN_NOTIFICATION_FAILED pour l’admin qui a notifications.read : ${JSON.stringify(alerts.map((a) => a.idempotency_key))}`);
    assert.equal(mine[0].idempotency_key, `ADMIN_NOTIFICATION_FAILED:${outboxId}:${adminWith.userId}:IN_APP`, 'clé de l’alerte');
    assert.equal(mine[0].channel, 'IN_APP');
    assert.deepEqual(
        { outbox_id: mine[0].template_data.outbox_id, failed_type: mine[0].template_data.failed_type, channel: mine[0].template_data.channel, reason: mine[0].template_data.reason },
        { outbox_id: outboxId, failed_type: failedType, channel, reason }, 'données de l’alerte');
    assert.equal(alerts.filter((a) => a.recipient_user_id === adminWithout.userId).length, 0, 'admin sans notifications.read : aucune alerte');
    const sig = await signals('NOTIFICATION_FAILED', [outboxId]);
    assert.equal(sig.length, 1, `admin_signals NOTIFICATION_FAILED pour la ligne : ${JSON.stringify(sig)}`);
}

let adminWith: TestAdmin;
let adminWithout: TestAdmin;

before(async () => {
    adminWith = await newAdmin('envoyeur', ['notifications.read']);
    adminWithout = await newAdmin('envoyeur-sans', []);
});

// ── Réservation et envoi ───────────────────────────────────────────────────

describe('6.1 Envoyeur : réservation, revérification et marquage (contrat E1, E2, E4)', () => {
    test('deux envoyeurs en parallèle : chaque ligne est réservée et envoyée une seule fois (FOR UPDATE SKIP LOCKED)', async () => {
        const phones = Array.from({ length: 6 }, () => randomSenegalPhone('76'));
        const rows: OutboxRow[] = [];
        for (const phone of phones) rows.push(await dueRow({ recipient_phone: phone }));
        const ids = rows.map((r) => r.id);
        const marks = phones.map((p) => smsMark(p));
        const t = new Date();
        const [a, b] = await Promise.all([dispatchAt(t, { ids }), dispatchAt(t, { ids })]);
        assert.equal(a.claimed + b.claimed, 6, `réservations cumulées : ${JSON.stringify({ a, b })}`);
        assert.equal(a.sent + b.sent, 6, `envois cumulés : ${JSON.stringify({ a, b })}`);
        phones.forEach((phone, i) => {
            const got = smsTo(phone, marks[i]);
            assert.equal(got.length, 1, `${phone} : un seul SMS (${got.length})`);
            assert.equal(got[0].message, PASSWORD_SMS, `${phone} : texte exact du catalogue`);
        });
        for (const r of await outboxRows({ ids })) {
            assert.equal(r.status, 'SENT', `ligne ${r.id} : ${brief(r)}`);
            assert.equal(r.attempts, 1, `ligne ${r.id} : une tentative`);
            assert.equal(ms(r.sent_at), t.getTime(), 'sent_at = horloge de l’envoyeur');
            assert.equal(ms(r.claimed_at), t.getTime(), 'claimed_at = horloge de l’envoyeur');
            assert.match(r.provider_message_id ?? '', /^fake-sms-\d+$/, 'identifiant du fournisseur enregistré');
            assert.equal(r.reason, null, 'SENT sans motif');
        }
    });

    test('numéro du compte résolu à l’envoi ; compte suspendu entre-temps : SKIPPED ACCOUNT_SUSPENDED, aucun SMS', async () => {
        const active = await newBuyer('envoyeur-actif');
        const suspended = await newBuyer('envoyeur-suspendu');
        const okRow = await dueRow({ recipient_user_id: active.userId });
        const koRow = await dueRow({ recipient_user_id: suspended.userId });
        assert.equal(okRow.recipient_phone, null, 'précondition : aucun numéro recopié dans la ligne');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspended.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        const markOk = smsMark(active.phoneE164);
        const markKo = smsMark(suspended.phoneE164);
        const t = new Date();
        await dispatchAt(t, { ids: [okRow.id, koRow.id] });

        const sent = smsTo(active.phoneE164, markOk);
        assert.deepEqual(sent.map((m) => m.message), [PASSWORD_SMS], 'compte actif : un SMS au numéro du compte (users.phone)');
        assert.equal((await rowOf(okRow.id)).status, 'SENT');

        assert.equal(getFakes().sms.messagesTo(suspended.phoneE164).length - markKo, 0, 'compte suspendu : aucun SMS tenté');
        const ko = await rowOf(koRow.id);
        assert.equal(ko.status, 'SKIPPED', brief(ko));
        assert.equal(ko.reason, 'ACCOUNT_SUSPENDED');
        assert.equal(ms(ko.finished_at), t.getTime(), 'finished_at = horloge de l’envoyeur');
        const decision = (ko.decision ?? {}) as { stage?: string; outcome?: string; account?: { blocked?: boolean } };
        assert.equal(decision.stage, 'CLAIM', `instantané de la réservation : ${JSON.stringify(ko.decision)}`);
        assert.equal(decision.outcome, 'SKIP');
        assert.equal(decision.account?.blocked, true, 'instantané : compte bloqué');
    });

    test('ordre de réservation : IN_APP avant SMS ; réponse de la réservation ; marquage par jeton (stale)', async () => {
        const user: Buyer = await newBuyer('envoyeur-ordre');
        const sms = await dueRow({ recipient_user_id: user.userId });
        const inApp = await dueRow({ channel: 'IN_APP', recipient_user_id: user.userId });
        const t = new Date();
        const first = await claim(t, [sms.id, inApp.id], 1);
        assert.deepEqual(first.map((c) => c.id), [inApp.id], `limit 1 : la ligne IN_APP passe avant le SMS plus ancien : ${JSON.stringify(first)}`);
        assert.equal(first[0].channel, 'IN_APP');
        assert.equal(first[0].type, 'PASSWORD_CHANGED');
        assert.equal(first[0].attempts, 1, 'tentative comptée à la réservation');
        assert.match(first[0].claim_token, /^[0-9a-f-]{36}$/, 'jeton de réservation');
        assert.equal(first[0].recipient?.user_id, user.userId, 'destinataire renvoyé');
        const second = await claim(t, [sms.id, inApp.id]);
        assert.deepEqual(second.map((c) => c.id), [sms.id], `seconde réservation : le SMS seul (l’in-app est SENDING) : ${JSON.stringify(second)}`);
        assert.equal(second[0].recipient?.phone, user.phoneE164, 'SMS : numéro résolu sur le compte');
        const inAppRow = await rowOf(inApp.id);
        assert.equal(inAppRow.status, 'SENDING', brief(inAppRow));
        assert.equal(ms(inAppRow.claimed_at), t.getTime());
        assert.equal(inAppRow.claim_token, first[0].claim_token);

        const stale = await rpcOk('notification_outbox_mark', {
            now: t.toISOString(), results: [{ id: sms.id, claim_token: randomUUID(), outcome: 'SENT', provider_message_id: 'jeton-faux' }],
        });
        assert.equal(stale.marked, 0, `mauvais jeton : rien marqué (${JSON.stringify(stale)})`);
        assert.equal(stale.stale, 1, 'mauvais jeton : ligne ignorée (stale)');
        assert.equal((await rowOf(sms.id)).status, 'SENDING', 'la ligne reste SENDING');

        const good = await rpcOk('notification_outbox_mark', {
            now: t.toISOString(), results: [{ id: sms.id, claim_token: second[0].claim_token, outcome: 'SENT', provider_message_id: 'fake-sms-marquage' }],
        });
        assert.equal(good.marked, 1, `bon jeton : ${JSON.stringify(good)}`);
        const marked = await rowOf(sms.id);
        assert.equal(marked.status, 'SENT', brief(marked));
        assert.equal(ms(marked.sent_at), t.getTime(), 'sent_at = now du marquage');
        assert.equal(marked.provider_message_id, 'fake-sms-marquage');
        const again = await rpcOk('notification_outbox_mark', {
            now: t.toISOString(), results: [{ id: sms.id, claim_token: second[0].claim_token, outcome: 'FAILED', reason: 'SMS_REJECTED' }],
        });
        assert.equal(again.stale, 1, `second marquage d’une ligne terminée : stale (${JSON.stringify(again)})`);
        assert.equal((await rowOf(sms.id)).status, 'SENT', 'la ligne reste SENT');

        // La ligne IN_APP réservée et jamais marquée est reprise après 10 min puis écrite dans la cloche.
        await dispatchAt(addMinutes(t, 11), { ids: [inApp.id] });
        await dispatchAt(addMinutes(t, 13), { ids: [inApp.id] });
        const done = await rowOf(inApp.id);
        assert.equal(done.status, 'SENT', `in-app reprise : ${brief(done)}`);
    });
});

// ── Relances ───────────────────────────────────────────────────────────────

describe('6.1 Envoyeur : relances avec attente croissante, 5 tentatives au plus (contrat E2, décision 3)', () => {
    test('SMS refusé à réessayer : relances à 1, 5, 15 et 60 min, puis FAILED après la 5e tentative, alerte admin et signal', async () => {
        const phone = randomSenegalPhone('76');
        const row = await dueRow({ recipient_phone: phone });
        const sms = getFakes().sms;
        const mark = smsMark(phone);
        const waits = [1, 5, 15, 60];
        let t = new Date();
        for (let attempt = 1; attempt <= 4; attempt++) {
            sms.failNext(`refus temporaire ${attempt} (simulation)`);
            const report = await dispatchAt(t, { ids: [row.id] });
            assert.equal(sms.pendingScenarios(), 0, `tentative ${attempt} : le scénario a été consommé par la ligne`);
            assert.equal(report.retried, 1, `tentative ${attempt} : rapport ${JSON.stringify(report)}`);
            const r = await rowOf(row.id);
            assert.equal(r.status, 'PENDING', `tentative ${attempt} : ${brief(r)}`);
            assert.equal(r.attempts, attempt, `tentative ${attempt} : compteur`);
            assert.equal(r.claim_token, null, `tentative ${attempt} : jeton libéré`);
            const next = t.getTime() + waits[attempt - 1] * MIN;
            assert.equal(ms(r.next_attempt_at), next, `tentative ${attempt} : prochain essai à +${waits[attempt - 1]} min`);
            // Une seconde avant l'échéance : la ligne n'est pas reprise.
            const early = await dispatchAt(new Date(next - 1000), { ids: [row.id] });
            assert.equal(early.claimed, 0, `tentative ${attempt} : rien avant l’échéance (${JSON.stringify(early)})`);
            assert.equal((await rowOf(row.id)).attempts, attempt, `tentative ${attempt} : aucune tentative avant l’échéance`);
            t = new Date(next + 1000);
        }
        sms.failNext('refus temporaire 5 (simulation)');
        const last = await dispatchAt(t, { ids: [row.id] });
        assert.equal(last.failed, 1, `5e tentative : FAILED (${JSON.stringify(last)})`);
        const failed = await rowOf(row.id);
        assert.equal(failed.status, 'FAILED', brief(failed));
        assert.equal(failed.attempts, 5, '5 tentatives');
        assert.equal(failed.reason, 'SMS_PROVIDER_ERROR', 'motif du dernier refus');
        assert.equal(ms(failed.finished_at), t.getTime(), 'finished_at = horloge de l’envoyeur');
        const recorded = getFakes().sms.messagesTo(phone).slice(mark);
        assert.equal(recorded.length, 5, `5 envois tentés : ${recorded.length}`);
        assert.ok(recorded.every((m) => m.outcome === 'REJECTED' && m.message === PASSWORD_SMS), 'tous refusés, même texte');
        assert.equal(smsTo(phone, mark).length, 0, 'aucun SMS remis');

        const later = await dispatchAt(new Date(t.getTime() + DAY), { ids: [row.id] });
        assert.equal(later.claimed, 0, 'FAILED est final : plus aucune réservation');
        assert.equal(getFakes().sms.messagesTo(phone).length - mark, 5, 'plus aucun envoi');
        await assertFailedAlert(row.id, 'PASSWORD_CHANGED', 'SMS', 'SMS_PROVIDER_ERROR');
    });

    test('refus définitif du fournisseur : FAILED SMS_REJECTED dès la 1re tentative, code en détail, alerte admin', async () => {
        const phone = randomSenegalPhone('76');
        const row = await dueRow({ recipient_phone: phone });
        const mark = smsMark(phone);
        getFakes().sms.rejectNext('102');
        const t = new Date();
        await dispatchAt(t, { ids: [row.id] });
        const r = await rowOf(row.id);
        assert.equal(r.status, 'FAILED', brief(r));
        assert.equal(r.attempts, 1, 'aucune relance');
        assert.equal(r.reason, 'SMS_REJECTED');
        assert.match(r.reason_detail ?? '', /102/, `code MTarget dans le détail : ${r.reason_detail}`);
        assert.equal(getFakes().sms.messagesTo(phone).length - mark, 1, 'un seul envoi tenté');
        await dispatchAt(addMinutes(t, 2), { ids: [row.id] });
        assert.equal(getFakes().sms.messagesTo(phone).length - mark, 1, 'pas de relance après un refus définitif');
        await assertFailedAlert(row.id, 'PASSWORD_CHANGED', 'SMS', 'SMS_REJECTED');
    });

    test('Retry-After du service push : plafonné à 240 min, jamais sous l’attente de la tentative', async () => {
        await withVapid(async (keys) => {
            const user = await newBuyer('envoyeur-push');
            const device = fakeBrowserSubscription();
            const { error } = await service.from('push_subscriptions').insert({
                user_id: user.userId, endpoint: device.endpoint, p256dh: device.keys.p256dh, auth: device.keys.auth, vapid_key_id: keys.keyId,
            });
            assert.equal(error, null, `abonnement push : ${error?.message} (code ${error?.code})`);
            const row = await dueRow({ type: 'PUSH_TEST', channel: 'PUSH', recipient_user_id: user.userId });
            const push = getFakes().push;

            push.respondNext(429, { retryAfterSeconds: 86_400 });
            const t1 = new Date();
            await dispatchAt(t1, { ids: [row.id] });
            const r1 = await rowOf(row.id);
            assert.equal(r1.status, 'PENDING', brief(r1));
            assert.equal(r1.attempts, 1);
            assert.equal(ms(r1.next_attempt_at), t1.getTime() + 240 * MIN, `Retry-After d’un jour plafonné à 240 min : ${brief(r1)}`);

            push.respondNext(503, { retryAfterSeconds: 600 });
            const t2 = new Date(ms(r1.next_attempt_at) + 1000);
            await dispatchAt(t2, { ids: [row.id] });
            const r2 = await rowOf(row.id);
            assert.equal(r2.attempts, 2, brief(r2));
            assert.equal(ms(r2.next_attempt_at), t2.getTime() + 10 * MIN, `Retry-After de 10 min > attente de 5 min : ${brief(r2)}`);

            push.respondNext(503, { retryAfterSeconds: 30 });
            const t3 = new Date(ms(r2.next_attempt_at) + 1000);
            await dispatchAt(t3, { ids: [row.id] });
            const r3 = await rowOf(row.id);
            assert.equal(r3.attempts, 3, brief(r3));
            assert.equal(ms(r3.next_attempt_at), t3.getTime() + 15 * MIN, `Retry-After de 30 s < attente de 15 min : ${brief(r3)}`);

            const t4 = new Date(ms(r3.next_attempt_at) + 1000);
            await dispatchAt(t4, { ids: [row.id] });
            const r4 = await rowOf(row.id);
            assert.equal(r4.status, 'SENT', brief(r4));
            assert.equal(r4.attempts, 4);
            assert.equal(push.messagesTo(device.endpoint).length, 4, 'quatre envois vers l’appareil');
            assert.equal(pushTo(device.endpoint).length, 1, 'un seul push accepté');
        });
    });
});

// ── Reprise des lignes SENDING ─────────────────────────────────────────────

describe('6.1 Envoyeur : reprise des lignes SENDING de plus de 10 minutes (contrat E1, décision 2)', () => {
    test('IN_APP : non reprise à 9 min, reprise après 10 min et envoyée, une seule notification', async () => {
        const user = await newBuyer('envoyeur-reprise');
        const row = await dueRow({ channel: 'IN_APP', recipient_user_id: user.userId });
        const t = new Date();
        const claimed = await claim(t, [row.id]);
        assert.deepEqual(claimed.map((c) => c.id), [row.id], 'ligne réservée puis abandonnée (envoyeur interrompu)');

        const at9 = await dispatchAt(addMinutes(t, 9), { ids: [row.id] });
        assert.equal(at9.reclaimed, 0, `9 min : pas de reprise (${JSON.stringify(at9)})`);
        assert.equal((await rowOf(row.id)).status, 'SENDING', '9 min : toujours SENDING');

        const at11 = await dispatchAt(addMinutes(t, 11), { ids: [row.id] });
        assert.ok(at11.reclaimed >= 1, `11 min : ligne reprise (${JSON.stringify(at11)})`);
        await dispatchAt(addMinutes(t, 13), { ids: [row.id] });
        const r = await rowOf(row.id);
        assert.equal(r.status, 'SENT', brief(r));
        assert.equal(r.attempts, 2, 'deux tentatives (la réservation abandonnée, puis l’envoi)');
        assert.ok(r.notification_id, 'notification_id posé');
        const { data, error } = await service.from('notifications').select('id, type, title, content, channel, metadata').eq('user_id', user.userId);
        assert.equal(error, null, error?.message);
        const mine = (data ?? []).filter((n) => (n.metadata as { outbox_id?: string } | null)?.outbox_id === row.id);
        assert.equal(mine.length, 1, `une seule notification pour la ligne : ${JSON.stringify(data)}`);
        assert.equal(mine[0].id, r.notification_id);
        assert.equal(mine[0].title, PASSWORD_IN_APP_TITLE);
        assert.equal(mine[0].content, PASSWORD_IN_APP_CONTENT);
        assert.equal(mine[0].type, 'SECURITY', 'inAppType du catalogue');
        assert.equal(mine[0].channel, 'IN_APP');
    });

    test('SMS : passé UNCERTAIN SENDING_INTERRUPTED, jamais renvoyé, même un jour plus tard', async () => {
        const phone = randomSenegalPhone('76');
        const row = await dueRow({ recipient_phone: phone });
        const mark = smsMark(phone);
        const t = new Date();
        await claim(t, [row.id]);
        const at11 = await dispatchAt(addMinutes(t, 11), { ids: [row.id] });
        assert.ok(at11.reclaimed >= 1, `ligne SMS reprise (${JSON.stringify(at11)})`);
        const r = await rowOf(row.id);
        assert.equal(r.status, 'UNCERTAIN', brief(r));
        assert.equal(r.reason, 'SENDING_INTERRUPTED');
        assert.equal(ms(r.finished_at), addMinutes(t, 11).getTime(), 'finished_at = horloge de l’envoyeur');
        assert.equal(getFakes().sms.messagesTo(phone).length - mark, 0, 'aucun envoi (ni avant, ni après la reprise)');
        await dispatchAt(new Date(t.getTime() + DAY), { ids: [row.id] });
        assert.equal(getFakes().sms.messagesTo(phone).length - mark, 0, 'toujours aucun envoi un jour plus tard');
        assert.equal((await rowOf(row.id)).status, 'UNCERTAIN');
        assert.deepEqual(await failedAlerts(row.id), [], 'UNCERTAIN : pas d’alerte « envoi en échec »');
    });

    test('dernière tentative interrompue : FAILED SENDING_INTERRUPTED, alerte admin et signal', async () => {
        const user = await newBuyer('envoyeur-epuise');
        const row = await dueRow({ channel: 'IN_APP', recipient_user_id: user.userId, attempts: 4 });
        const t = new Date();
        const claimed = await claim(t, [row.id]);
        assert.equal(claimed[0]?.attempts, 5, '5e tentative réservée');
        await dispatchAt(addMinutes(t, 11), { ids: [row.id] });
        const r = await rowOf(row.id);
        assert.equal(r.status, 'FAILED', brief(r));
        assert.equal(r.reason, 'SENDING_INTERRUPTED');
        assert.equal(r.attempts, 5);
        await assertFailedAlert(row.id, 'PASSWORD_CHANGED', 'IN_APP', 'SENDING_INTERRUPTED');
    });
});

// ── SMS incertain ──────────────────────────────────────────────────────────

describe('6.1 Envoyeur : SMS peut-être parti (délai dépassé après l’envoi)', () => {
    test('UNCERTAIN, sent_at posé, jamais renvoyé même à now + 1 jour, pas d’alerte FAILED', async () => {
        const phone = randomSenegalPhone('76');
        const row = await dueRow({ recipient_phone: phone });
        const mark = smsMark(phone);
        getFakes().sms.uncertainNext(1);
        const t = new Date();
        const report = await dispatchAt(t, { ids: [row.id] });
        assert.equal(report.uncertain, 1, `rapport : ${JSON.stringify(report)}`);
        const r = await rowOf(row.id);
        assert.equal(r.status, 'UNCERTAIN', brief(r));
        assert.ok(r.reason === 'PROVIDER_TIMEOUT' || r.reason === 'PROVIDER_UNREADABLE', `motif : ${r.reason}`);
        assert.equal(r.attempts, 1);
        assert.equal(ms(r.sent_at), t.getTime(), 'UNCERTAIN : sent_at = horloge de l’envoyeur (envoi peut-être facturé)');
        assert.equal(ms(r.finished_at), t.getTime());
        const recorded = getFakes().sms.messagesTo(phone).slice(mark);
        assert.equal(recorded.length, 1, 'un seul envoi (peut-être parti)');
        assert.equal(recorded[0].outcome, 'UNCERTAIN');
        assert.equal(recorded[0].message, PASSWORD_SMS);

        for (const later of [addMinutes(t, 2), addMinutes(t, 61), new Date(t.getTime() + DAY)]) {
            const rep = await dispatchAt(later, { ids: [row.id] });
            assert.equal(rep.claimed, 0, `${later.toISOString()} : aucune réservation (${JSON.stringify(rep)})`);
        }
        assert.equal(getFakes().sms.messagesTo(phone).length - mark, 1, 'aucun second envoi');
        assert.equal((await rowOf(row.id)).status, 'UNCERTAIN');
        assert.deepEqual(await failedAlerts(row.id), [], 'pas d’alerte « envoi en échec »');
        assert.deepEqual(await signals('NOTIFICATION_FAILED', [row.id]), [], 'pas de signal NOTIFICATION_FAILED');
    });
});

// ── Horloge ────────────────────────────────────────────────────────────────

describe('6.1 Envoyeur : horloge dans le passé refusée (Conventions)', () => {
    test('INVALID_NOW pour la réservation, le marquage et les contrôles du jour ; dispatchNotifications rejette', async () => {
        const phone = randomSenegalPhone('76');
        const row = await dueRow({ recipient_phone: phone });
        const past = new Date(Date.now() - 5 * MIN).toISOString();
        for (const [fn, p] of [
            ['notification_outbox_claim', { now: past, only_ids: [row.id] }],
            ['notification_outbox_mark', { now: past, results: [] }],
            ['notification_daily_checks', { now: past }],
        ] as const) {
            const r = await rpc(fn, p);
            assert.equal(r.error, null, `${fn} : ${r.error?.message} (code ${r.error?.code})`);
            assert.equal(r.data?.ok, false, `${fn} avec une horloge passée : ${JSON.stringify(r.data)}`);
            assert.equal(r.data?.code, 'INVALID_NOW', `${fn} : code`);
            assert.equal(typeof r.data?.message, 'string', `${fn} : message pour un humain`);
        }
        const dispatch = await lotFunction<(o: Record<string, unknown>) => Promise<DispatchRunReport>>(DISPATCHER_MODULE, 'dispatchNotifications', 'envoyeur (contrat E4)');
        const mark = smsMark(phone);
        await assert.rejects(dispatch({ now: new Date(Date.now() - 5 * MIN), onlyIds: [row.id] }), 'dispatchNotifications avec une horloge passée : exception');
        const r = await rowOf(row.id);
        assert.equal(r.status, 'PENDING', `rien réservé : ${brief(r)}`);
        assert.equal(r.attempts, 0);
        assert.equal(getFakes().sms.messagesTo(phone).length - mark, 0, 'aucun SMS');
    });
});

// ── Plafond et seuil ───────────────────────────────────────────────────────

describe('6.1 Envoyeur : plafond SMS et seuil du jour (décision 4, contrat E3 ; lot 7, 7.0 a)', () => {
    // Lot 7 (7.0 a, T1) : la décision 9 du lot 6 (plafond appliqué aussi aux indispensables) est renversée par la
    // consigne. Sous SMS_GLOBAL_DAILY_CAP = 1 (part non OTP 0), l'indispensable part ; l'optionnel garde la garde
    // anti-abus (D14) et sort en SKIPPED SMS_DAILY_CAP, définitif. Jour simulé lointain tiré au hasard : le budget
    // optionnel de ce jour (compté au jour de l'envoyeur) n'est consommé par aucune autre suite.
    test('plafond global (SMS_GLOBAL_DAILY_CAP = 1) : PASSWORD_CHANGED (indispensable) SENT au texte exact ; REMINDER_J1 (optionnel) SKIPPED SMS_DAILY_CAP, aucune relance', async () => {
        const day = dakarDay(150 + randomInt(0, 400));
        const t = dakarAt(day, '12:00');
        const nextDay = new Date(t.getTime() + DAY).toISOString().slice(0, 10);
        const partner = await newPartner('envoyeur-plafond');
        const ev = await createReminderEvent(partner, 'envoyeur-plafond', {
            startDate: nextDay, startTime: '20:00', categories: [{ name: 'Entree libre', price: 0, total: 5 }],
            title: `Plafond ${randomBytes(3).toString('hex')}`, location: 'Salle Sorano', city: 'Dakar',
        });
        const holder = await newBuyer('envoyeur-plafond');
        await issueFreeTicket(ev.eventId, ev.categories['Entree libre'].id, holder);
        const phone = randomSenegalPhone('76');
        const essential = await dueRow({ recipient_phone: phone });
        const optional = await dueRow({
            type: 'REMINDER_J1', family: 'OPTIONAL', topic: 'REMINDERS', recipient_user_id: holder.userId, event_id: ev.eventId,
            template_data: { sms_policy: 'ALWAYS' },
        });
        const mark = smsMark(phone);
        const markOptional = smsMark(holder.phoneE164);
        await withEnv({ SMS_GLOBAL_DAILY_CAP: '1' }, async () => {
            await dispatchAt(t, { ids: [essential.id, optional.id] });
        });
        const e = await rowOf(essential.id);
        assert.equal(e.status, 'SENT', `indispensable sous le plafond global : ${brief(e)}`);
        assert.deepEqual(smsTo(phone, mark).map((m) => m.message), [PASSWORD_SMS], 'un SMS indispensable, texte exact');
        const r = await rowOf(optional.id);
        assert.equal(r.status, 'SKIPPED', brief(r));
        assert.equal(r.reason, 'SMS_DAILY_CAP');
        assert.equal(getFakes().sms.messagesTo(holder.phoneE164).length - markOptional, 0, 'aucun SMS optionnel tenté');
        const later = await dispatchAt(new Date(t.getTime() + DAY), { ids: [optional.id] });
        assert.equal(later.claimed, 0, 'SKIPPED est final : pas de relance le lendemain');
        assert.equal(getFakes().sms.messagesTo(holder.phoneE164).length - markOptional, 0, 'toujours aucun SMS optionnel');
    });

    // Lot 7 (7.0 a, T1, D15) : le seuil notif.sms_daily_alert est supprimé ; l'alerte part à 80 % du budget des SMS
    // optionnels (ceil(0,8 × plafond)), une fois par jour. Plafond 1 : seuil 1, un SMS optionnel du jour suffit.
    test('80 % du budget des SMS optionnels atteint : une seule alerte ADMIN_SMS_OPTIONAL_80 et un seul signal SMS_OPTIONAL_80 par jour', async () => {
        // Jour lointain de Dakar : seuls les SMS datés par cette horloge y comptent (aucune autre suite).
        const day = dakarDay(150 + randomInt(0, 400));
        const t = dakarAt(day, '12:00');
        const phone = randomSenegalPhone('76');
        const row = await dueRow({ type: 'FIRST_TICKET_SOLD', family: 'OPTIONAL', topic: 'PRO_ACTIVITY', recipient_phone: phone, template_data: { title: 'TEST Seuil optionnel' } });
        await withNotifSettings({ 'notif.sms_optional_daily_cap': 1 }, async () => {
            await dispatchAt(t, { ids: [row.id] });
            assert.equal((await rowOf(row.id)).status, 'SENT', 'SMS optionnel du jour envoyé');
            const first = await rpcOk('notification_daily_checks', { now: addMinutes(t, 1).toISOString() });
            assert.equal(first.day, day, `jour de Dakar : ${JSON.stringify(first)}`);
            assert.ok(Number(first.sms_today) >= 1, `SMS du jour comptés : ${JSON.stringify(first)}`);
            assert.ok(Number(first.optional_today) >= 1, `SMS optionnels du jour comptés : ${JSON.stringify(first)}`);
            assert.equal(first.optional_cap, 1, 'plafond lu dans notif.sms_optional_daily_cap');
            assert.equal(first.optional_threshold, 1, 'seuil = ceil(0,8 × 1)');
            const second = await rpcOk('notification_daily_checks', { now: addMinutes(t, 2).toISOString() });
            assert.equal(second.alerted, false, `seconde vérification du même jour : aucune nouvelle alerte (${JSON.stringify(second)})`);
            await dispatchAt(addMinutes(t, 3), { ids: [row.id] });
        });
        const all = await outboxRows({ type: 'ADMIN_SMS_OPTIONAL_80', keyPrefix: `ADMIN_SMS_OPTIONAL_80:${day}:` });
        const mine = all.filter((a) => a.recipient_user_id === adminWith.userId);
        assert.deepEqual(mine.map((a) => a.channel).sort(), ['EMAIL', 'IN_APP'], `alerte du jour pour l’admin (I M) : ${JSON.stringify(mine.map((a) => a.idempotency_key))}`);
        for (const a of mine) {
            assert.equal(a.idempotency_key, `ADMIN_SMS_OPTIONAL_80:${day}:${adminWith.userId}:${a.channel}`, 'clé par jour et par admin');
            assert.equal(a.template_data.day, day);
            assert.equal(a.template_data.cap, 1);
            assert.equal(a.template_data.threshold, 1);
            const used = Number(a.template_data.used);
            assert.ok(used >= 1, `nombre de SMS optionnels : ${JSON.stringify(a.template_data)}`);
            assert.equal(a.template_data.percent, Math.floor(100 * used / 1), `pourcentage : ${JSON.stringify(a.template_data)}`);
        }
        assert.equal(all.filter((a) => a.recipient_user_id === adminWithout.userId).length, 0, 'admin sans notifications.read : aucune alerte');
        const sig = await signals('SMS_OPTIONAL_80', all.map((a) => a.id));
        assert.equal(sig.length, 1, `un seul signal SMS_OPTIONAL_80 pour le jour : ${JSON.stringify(sig)}`);
    });
});

// ── Route cron ─────────────────────────────────────────────────────────────

describe('6.1 Route /api/cron/notifications-dispatch (contrat E5)', () => {
    type Handler = (req: NextRequest) => Promise<Response>;

    async function handlers(): Promise<{ GET: Handler; POST: Handler }> {
        const mod = await loadLotModule(ROUTE_MODULE, 'route /api/cron/notifications-dispatch (contrat E5)');
        assert.equal(typeof mod.GET, 'function', 'GET exporté');
        assert.equal(typeof mod.POST, 'function', 'POST exporté');
        return { GET: mod.GET as Handler, POST: mod.POST as Handler };
    }

    function post(secret: string): NextRequest {
        return new NextRequest(`${BASE_URL}/api/cron/notifications-dispatch`, { method: 'POST', headers: { authorization: `Bearer ${secret}` } });
    }

    test('503 sans CRON_SECRET, 401 sans jeton ou avec un mauvais jeton (rien n’est envoyé), 200 avec le rapport et l’envoi réel', async () => {
        const { GET, POST } = await handlers();
        const secret = randomBytes(24).toString('hex');
        const phone = randomSenegalPhone('76');
        const row = await dueRow({ recipient_phone: phone });
        const mark = smsMark(phone);
        const pathName = '/api/cron/notifications-dispatch';

        await withEnv({ CRON_SECRET: undefined }, async () => {
            const res = await GET(cronRequest(pathName, 'jeton-quelconque'));
            assert.equal(res.status, 503, `sans CRON_SECRET : HTTP ${res.status}`);
        });
        await withEnv({ CRON_SECRET: secret }, async () => {
            const none = await GET(cronRequest(pathName, null));
            assert.equal(none.status, 401, `sans jeton : HTTP ${none.status}`);
            const wrong = await POST(post(`${secret}x`));
            assert.equal(wrong.status, 401, `mauvais jeton : HTTP ${wrong.status}`);
            assert.equal((await rowOf(row.id)).status, 'PENDING', 'refus : aucune réservation');
            assert.equal(getFakes().sms.messagesTo(phone).length - mark, 0, 'refus : aucun SMS');

            const ok = await GET(cronRequest(pathName, secret));
            const body = (await ok.json()) as Record<string, unknown>;
            assert.equal(ok.status, 200, `jeton valide : HTTP ${ok.status} ${JSON.stringify(body)}`);
            assert.equal(body.ok, true);
            for (const k of ['claimed', 'sent', 'retried', 'failed', 'skipped', 'uncertain', 'cancelled', 'waiting', 'reclaimed', 'rounds', 'smsToday']) {
                assert.equal(typeof body[k], 'number', `rapport : ${k} numérique (${JSON.stringify(body)})`);
            }
            assert.ok(Number(body.claimed) >= 1, 'au moins la ligne due de ce test réservée');
            assert.deepEqual(smsTo(phone, mark).map((m) => m.message), [PASSWORD_SMS], 'la ligne due est envoyée une fois par la route');
            assert.equal((await rowOf(row.id)).status, 'SENT');

            const again = await POST(post(secret));
            assert.equal(again.status, 200, `POST : HTTP ${again.status}`);
            assert.equal(smsTo(phone, mark).length, 1, 'second passage : aucun doublon');
        });
    });

    test('contrôles statiques : aucune heure lue dans la requête, dispatchNotifications() sans argument, protégée par CRON_SECRET', () => {
        assert.ok(fs.existsSync(ROUTE_FILE), `route absente : ${path.relative(process.cwd(), ROUTE_FILE)}`);
        const src = fs.readFileSync(ROUTE_FILE, 'utf8');
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        assert.match(code, /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/, 'dynamic = force-dynamic');
        assert.match(code, /\brefuseUnlessCron\s*\(/, 'refuseUnlessCron appelée');
        assert.match(code, /export\s+(const|async\s+function)\s+GET\b/, 'GET exporté');
        assert.match(code, /export\s+(const|async\s+function)\s+POST\b/, 'POST exporté');
        const calls = Array.from(code.matchAll(/\bdispatchNotifications\s*\(([^)]*)\)/g)).map((m) => m[1].trim());
        assert.ok(calls.length >= 1, 'dispatchNotifications appelée');
        assert.deepEqual(calls.filter((a) => a !== ''), [], `dispatchNotifications appelée avec un argument : ${JSON.stringify(calls)}`);
        assert.doesNotMatch(code, /searchParams|nextUrl/, 'aucun paramètre d’URL lu');
        // Lecture du corps : req.json(), request.text()… (sans argument, contrairement à NextResponse.json(…)).
        assert.doesNotMatch(code, /\.(json|text|formData|arrayBuffer|blob)\s*\(\s*\)/, 'aucun corps de requête lu');
        assert.doesNotMatch(code, /\bnow\s*:/, 'aucune horloge passée par la route');
        assert.match(code, /DISPATCH_FAILED/, 'erreur 500 avec le code DISPATCH_FAILED');
        assert.match(code, /Envoi des notifications momentanément impossible\./, 'message d’erreur du contrat');
    });
});
