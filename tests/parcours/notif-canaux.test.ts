/**
 * Lot 6, tâche 6.2 — les quatre canaux de l'envoyeur (contrat F1 à F4, E4, E6, C3 ; S2 « Canaux »).
 *  - IN_APP : la ligne de la cloche est écrite par le marquage (`notifications` : type du catalogue,
 *    titre et contenu, canal IN_APP, `metadata` = données + actionUrl + outbox_id, `notification_id`
 *    posé sur la ligne de la boîte d'envoi), une seule fois même après un second passage ;
 *  - SMS : encodage et segments tracés dans `decision.delivery` (calcul GSM-7 / UCS-2 fait ICI) ;
 *    adaptateur MTarget RÉEL contre un serveur HTTP local : accepté → SENT, code de refus → REJECTED
 *    définitif, réponse illisible → UNCERTAIN, 429 / 500 → REJECTED à réessayer, 400 → REJECTED
 *    définitif, délai dépassé (MTARGET_TIMEOUT_MS) → UNCERTAIN, connexion coupée après l'envoi →
 *    UNCERTAIN, connexion refusée → REJECTED à réessayer ; une seule requête à chaque fois ;
 *  - EMAIL : sans RESEND_API_KEY SKIPPED EMAIL_NOT_CONFIGURED sans appel et un seul avertissement ;
 *    adresse factice (compte ou destinataire) SKIPPED NO_REAL_EMAIL ; HTML échappé ; lien et en-tête
 *    List-Unsubscribe sur une famille optionnelle seulement ; clé d'idempotence transmise ; refus
 *    à réessayer → relance, refus définitif → FAILED EMAIL_REJECTED ;
 *  - PUSH (faux adaptateur) : sans VAPID SKIPPED PUSH_NOT_CONFIGURED ; aucun appareil SKIPPED
 *    NO_PUSH_SUBSCRIPTION ; 2 appareils → 2 envois, 1 ligne SENT, charge exacte ; 410 → abonnement
 *    supprimé, l'autre servi ; 404 seul → supprimé puis SKIPPED ; 500, 429, délai → relances à 1, 5,
 *    15 min ; 413 → FAILED PUSH_PAYLOAD_TOO_LARGE, 401 → FAILED PUSH_REJECTED ; clé VAPID changée →
 *    abonnement ignoré et supprimé ; point d'arrivée hors liste blanche jamais appelé ; urgence haute
 *    pour une annulation ;
 *  - PUSH (adaptateur réel lib/push/web-push.adapter.ts) contre un serveur local qui VÉRIFIE l'en-tête
 *    VAPID (JWT ES256, aud, sub, exp) et DÉCHIFFRE la charge aes128gcm (RFC 8291) avec node:crypto ;
 *    correspondance des statuts 201, 404, 410, 413, 429 (Retry-After), 5xx, 401, 400, délai ;
 *  - contrôles statiques : web-push 3.6.7 et @types/web-push 3.6.4 épinglés, generateRequestDetails
 *    seul, jamais sendNotification( ; VAPID_PRIVATE_KEY parmi les secrets dont la réutilisation est
 *    refusée (lib/env.ts).
 * Les lignes sont écrites par insertOutboxRow (dues maintenant) et envoyées par dispatchAt(…, { ids }) :
 * aucune ligne d'une autre suite n'est touchée ; les envois se comptent par numéro, adresse ou appareil
 * neufs.
 *
 * Rouge avant correctif : notification_outbox, push_subscriptions et l'envoyeur n'existent pas
 * (insertOutboxRow échoue, PGRST205), lib/push/web-push.adapter.ts est absent, l'adaptateur MTarget n'a
 * ni délai ni issue `outcome`, web-push n'est pas une dépendance.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto, { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import path from 'node:path';
import { getServerEnv } from '../../lib/env';
import type { SmsSendResult } from '../../lib/integrations/types';
import { MTargetHttpAdapter } from '../../lib/sms/mtarget-http.adapter';
import { getFakes } from '../fakes';
import { service, newBuyer } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { randomSenegalPhone } from './helpers';
import {
    addMinutes, assertNotificationInvariants, dispatchAt, emailsTo, fakeBrowserSubscription, insertOutboxRow, loadLotModule,
    newVapidKeys, outboxRows, pushTo, smsMark, smsTo, withEnv, withVapid,
    type FakeBrowserSubscription, type OutboxInsert, type OutboxRow, type VapidKeys,
} from './notif-helpers';

after(async () => {
    await assertNotificationInvariants('notif-canaux');
});

const MIN = 60_000;
const ROOT = process.cwd();
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');

// ── Outils communs ─────────────────────────────────────────────────────────

/** Ligne due maintenant (next_attempt_at une seconde avant l'heure réelle). */
async function dueRow(over: OutboxInsert): Promise<OutboxRow> {
    const due = new Date(Date.now() - 1000).toISOString();
    return insertOutboxRow({ due_at: due, next_attempt_at: due, ...over });
}

async function rowOf(id: string): Promise<OutboxRow> {
    const rows = await outboxRows({ ids: [id] });
    assert.equal(rows.length, 1, `ligne ${id} introuvable dans notification_outbox`);
    return rows[0];
}

function brief(r: OutboxRow): string {
    return JSON.stringify({ status: r.status, reason: r.reason, detail: r.reason_detail, attempts: r.attempts, next: r.next_attempt_at, decision: r.decision });
}

function ms(iso: string | null): number {
    assert.ok(iso, 'horodatage attendu');
    return Date.parse(iso);
}

/** Espaces insécables et apostrophes typographiques ramenés à leur forme simple (in-app, push, email). */
function norm(s: string): string {
    return s.replace(/[  ]/g, ' ').replace(/[’‘]/g, '\'');
}

const EVENT_ID = randomUUID();
function eventData(title: string): Record<string, unknown> {
    return { event_id: EVENT_ID, title, location: 'CICAD', city: 'Diamniadio', start_at: '2026-11-14T20:00:00.000Z' };
}

/** Avertissements émis pendant fn (console.warn espionné, puis rendu). */
async function capturingWarnings<T>(fn: () => Promise<T>): Promise<{ result: T; warnings: string[] }> {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
        warnings.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
        original(...args);
    };
    try {
        const result = await fn();
        return { result, warnings };
    } finally {
        console.warn = original;
    }
}

// ── GSM 03.38 (calcul indépendant du module testé) ─────────────────────────

const GSM7_BASIC = new Set(Array.from(
    '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
));
const GSM7_EXTENSION = new Set(Array.from('\f^{}\\[~]|€'));

function measureSms(text: string): { encoding: 'GSM7' | 'UCS2'; segments: number } {
    let septets = 0;
    for (const ch of Array.from(text)) {
        if (GSM7_BASIC.has(ch)) septets += 1;
        else if (GSM7_EXTENSION.has(ch)) septets += 2;
        else return { encoding: 'UCS2', segments: text.length <= 70 ? 1 : Math.ceil(text.length / 67) };
    }
    return { encoding: 'GSM7', segments: septets <= 160 ? 1 : Math.ceil(septets / 153) };
}

// ── Serveur HTTP local (MTarget, service push) ─────────────────────────────

interface ReceivedRequest { method: string; url: string; headers: http.IncomingHttpHeaders; body: Buffer }
type Responder = (req: http.IncomingMessage, body: Buffer, res: http.ServerResponse) => void;

interface LocalServer {
    origin: string;
    port: number;
    requests: ReceivedRequest[];
    respond(fn: Responder): void;
    close(): Promise<void>;
}

async function startLocalServer(responder: Responder): Promise<LocalServer> {
    const requests: ReceivedRequest[] = [];
    const sockets = new Set<Socket>();
    let current = responder;
    const server = http.createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
            const body = Buffer.concat(chunks);
            requests.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
            current(req, body, res);
        });
    });
    server.on('connection', (s: Socket) => {
        sockets.add(s);
        s.on('close', () => sockets.delete(s));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as AddressInfo).port;
    return {
        origin: `http://127.0.0.1:${port}`,
        port,
        requests,
        respond(fn: Responder) { current = fn; },
        async close() {
            sockets.forEach((s) => s.destroy());
            await new Promise<void>((resolve) => server.close(() => resolve()));
        },
    };
}

/** Port local sans serveur (connexion refusée). */
async function closedPort(): Promise<number> {
    const s = await startLocalServer((_req, _body, res) => res.end());
    const port = s.port;
    await s.close();
    return port;
}

const HANG = Symbol('hang');
/** Résultat de p, ou HANG si p n'a pas abouti dans `limitMs` (aucune attente infinie en CI). */
async function within<T>(p: Promise<T>, limitMs: number): Promise<T | typeof HANG> {
    let timer: NodeJS.Timeout | undefined;
    const guard = new Promise<typeof HANG>((resolve) => { timer = setTimeout(() => resolve(HANG), limitMs); });
    try {
        return await Promise.race([p, guard]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function json(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(JSON.stringify(body));
}

// ── IN_APP ─────────────────────────────────────────────────────────────────

interface NotificationRow {
    id: string; user_id: string; type: string; title: string; content: string; channel: string; status: string;
    metadata: Record<string, unknown> | null;
}

async function notificationsOf(userId: string): Promise<NotificationRow[]> {
    const { data, error } = await service.from('notifications').select('id, user_id, type, title, content, channel, status, metadata').eq('user_id', userId);
    assert.equal(error, null, `lecture de notifications : ${error?.message}`);
    return (data ?? []) as NotificationRow[];
}

describe('6.2 IN_APP : la cloche est écrite par le marquage de l\'envoyeur (contrat F1, E2, E4)', () => {
    test('PASSWORD_CHANGED : une notification IN_APP (type, titre, contenu du catalogue, metadata), notification_id posé, une seule fois', async () => {
        const buyer = await newBuyer('canaux-inapp');
        const row = await dueRow({ type: 'PASSWORD_CHANGED', family: 'ESSENTIAL', channel: 'IN_APP', recipient_user_id: buyer.userId });
        const t = new Date();
        await dispatchAt(t, { ids: [row.id] });

        const done = await rowOf(row.id);
        assert.equal(done.status, 'SENT', brief(done));
        assert.equal(ms(done.sent_at), t.getTime(), 'sent_at = horloge de l’envoyeur');
        assert.ok(done.notification_id, 'notification_id posé sur la ligne de la boîte d’envoi');
        const mine = (await notificationsOf(buyer.userId)).filter((n) => n.metadata?.outbox_id === row.id);
        assert.equal(mine.length, 1, `une notification pour la ligne ${row.id} : ${JSON.stringify(mine)}`);
        const n = mine[0];
        assert.equal(n.id, done.notification_id, 'notification_id = id de la notification écrite');
        assert.deepEqual(
            { type: n.type, title: norm(n.title), content: norm(n.content), channel: n.channel, status: n.status },
            {
                type: 'SECURITY', title: 'Mot de passe modifié',
                content: 'Le mot de passe de votre compte a été défini ou modifié. Si ce n\'est pas vous, contactez le support.',
                channel: 'IN_APP', status: 'SENT',
            }, 'notification IN_APP du catalogue (G4)');
        assert.equal(n.metadata?.actionUrl, '/profile', 'metadata.actionUrl = lien du catalogue');

        await dispatchAt(addMinutes(t, 2), { ids: [row.id] });
        const again = (await notificationsOf(buyer.userId)).filter((x) => x.metadata?.outbox_id === row.id);
        assert.equal(again.length, 1, 'second passage : aucune seconde notification');
    });

    test('type lié à un événement (optionnel) : metadata = données du modèle + actionUrl /events/<id> + outbox_id ; préférence dans l’instantané', async () => {
        const buyer = await newBuyer('canaux-inapp-ev');
        const title = 'Gala de la Teranga';
        const row = await dueRow({
            type: 'EVENT_SUSPENDED_HOLDER', family: 'OPTIONAL', topic: 'EVENT_UPDATES', channel: 'IN_APP',
            recipient_user_id: buyer.userId, group_key: `EVENT_SUSPENDED_HOLDER:${randomUUID()}:${buyer.userId}`, template_data: eventData(title),
        });
        await dispatchAt(new Date(), { ids: [row.id] });
        const done = await rowOf(row.id);
        assert.equal(done.status, 'SENT', brief(done));
        const n = (await notificationsOf(buyer.userId)).find((x) => x.id === done.notification_id);
        assert.ok(n, 'notification écrite');
        assert.equal(n.type, 'EVENT_STATUS');
        assert.equal(norm(n.title), 'Événement suspendu');
        assert.equal(norm(n.content), `« ${title} » est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite.`);
        assert.equal(n.channel, 'IN_APP');
        assert.equal(n.metadata?.actionUrl, `/events/${EVENT_ID}`, 'lien vers l’événement');
        assert.equal(n.metadata?.event_id, EVENT_ID, 'metadata reprend template_data (event_id)');
        assert.equal(n.metadata?.title, title, 'metadata reprend template_data (title)');
        assert.equal(n.metadata?.outbox_id, row.id);
        const pref = (done.decision as { preference?: { topic?: string; channel?: string; enabled?: boolean } } | null)?.preference;
        assert.deepEqual(pref, { topic: 'EVENT_UPDATES', channel: 'IN_APP', enabled: true }, `instantané de préférence : ${JSON.stringify(done.decision)}`);
    });
});

// ── SMS ────────────────────────────────────────────────────────────────────

describe('6.2 SMS : encodage tracé par l\'envoyeur (contrat F2, C3)', () => {
    test('GSM-7 et UCS-2 : texte exact, un SMS, encodage et segments dans decision.delivery', async () => {
        const cases: Array<{ title: string; expected: string }> = [
            { title: 'Gala Dakar', expected: 'Event Village : le transfert du billet Gala Dakar a été annulé par son propriétaire.' },
            { title: 'Gala 日本 Dakar', expected: 'Event Village : le transfert du billet Gala 日本 Dakar a été annulé par son propriétaire.' },
        ];
        for (const c of cases) {
            const phone = randomSenegalPhone('76');
            const row = await dueRow({
                type: 'TRANSFER_CANCELLED', family: 'ESSENTIAL', channel: 'SMS', recipient_phone: phone, group_key: `TRANSFER_CANCELLED:${randomUUID()}`,
                template_data: { transfer_id: randomUUID(), ticket_id: randomUUID(), ...eventData(c.title) },
            });
            const mark = smsMark(phone);
            await dispatchAt(new Date(), { ids: [row.id] });
            assert.deepEqual(smsTo(phone, mark).map((m) => m.message), [c.expected], `${c.title} : un SMS, texte exact (G3)`);
            const done = await rowOf(row.id);
            assert.equal(done.status, 'SENT', brief(done));
            const delivery = (done.decision as { delivery?: { outcome?: string; encoding?: string; segments?: number } } | null)?.delivery;
            const mine = measureSms(c.expected);
            assert.deepEqual({ outcome: delivery?.outcome, encoding: delivery?.encoding, segments: delivery?.segments },
                { outcome: 'SENT', encoding: mine.encoding, segments: mine.segments }, `${c.title} : decision.delivery (${JSON.stringify(done.decision)})`);
        }
    });
});

type SmsOutcomeResult = SmsSendResult & { outcome?: string; retryable?: boolean };

describe('6.2 SMS : adaptateur MTarget réel contre un serveur HTTP local (contrat E6)', () => {
    const user = `mt-${randomBytes(4).toString('hex')}`;
    const password = randomBytes(12).toString('base64url');
    const phone = '+221771234567';
    const message = 'Event Village : test de l’adaptateur.';
    const adapterFor = (url: string): MTargetHttpAdapter => new MTargetHttpAdapter({ apiUrl: url, username: user, password, serviceId: '42', sender: 'EVTEST' });

    async function sendAgainst(responder: Responder, env: Record<string, string | undefined> = {}): Promise<{ result: SmsOutcomeResult | typeof HANG; server: LocalServer; elapsed: number }> {
        const server = await startLocalServer(responder);
        try {
            const started = Date.now();
            const result = await withEnv(env, () => within(adapterFor(`${server.origin}/messages`).sendSms(phone, message) as Promise<SmsOutcomeResult>, 5000));
            return { result, server, elapsed: Date.now() - started };
        } finally {
            await server.close();
        }
    }

    test('2xx accepté (code 0) : SENT, identifiant du ticket ; la requête porte numéro MTarget et message', async () => {
        const { result, server } = await sendAgainst((_req, _body, res) => json(res, 200, { results: [{ msisdn: '00221771234567', code: '0', reason: 'ACCEPTED', ticket: 'T-ok-1' }] }));
        assert.notEqual(result, HANG);
        const r = result as SmsOutcomeResult;
        assert.equal(r.outcome, 'SENT', `issue : ${JSON.stringify(r)}`);
        assert.equal(r.success, true);
        assert.equal(r.messageId, 'T-ok-1');
        assert.equal(server.requests.length, 1, 'une seule requête');
        const sent = JSON.parse(server.requests[0].body.toString('utf8')) as Record<string, unknown>;
        assert.equal(sent.msisdn, '00221771234567');
        assert.equal(sent.msg, message);
    });

    test('2xx avec un code MTarget de refus : REJECTED définitif', async () => {
        const { result, server } = await sendAgainst((_req, _body, res) => json(res, 200, { results: [{ msisdn: '00221771234567', code: '102', reason: 'INVALID_MSISDN' }] }));
        const r = result as SmsOutcomeResult;
        assert.equal(r.outcome, 'REJECTED', `issue : ${JSON.stringify(r)}`);
        assert.equal(r.success, false);
        assert.notEqual(r.retryable, true, 'refus du fournisseur : pas de relance');
        assert.equal(server.requests.length, 1);
    });

    test('2xx illisible (texte, ou JSON sans « results ») : UNCERTAIN, jamais compté comme envoyé', async () => {
        for (const responder of [
            ((_req, _body, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('OK'); }) as Responder,
            ((_req, _body, res) => json(res, 200, { status: 'queued' })) as Responder,
        ]) {
            const { result, server } = await sendAgainst(responder);
            const r = result as SmsOutcomeResult;
            assert.equal(r.outcome, 'UNCERTAIN', `réponse illisible : ${JSON.stringify(r)}`);
            assert.equal(r.success, false, 'issue incertaine : success = false');
            assert.equal(server.requests.length, 1);
        }
    });

    test('HTTP 429 et 500 : REJECTED à réessayer ; HTTP 400 : REJECTED définitif', async () => {
        for (const [status, retryable] of [[429, true], [500, true], [503, true], [400, false]] as const) {
            const { result, server } = await sendAgainst((_req, _body, res) => json(res, status, { error: 'simulation' }));
            const r = result as SmsOutcomeResult;
            assert.equal(r.outcome, 'REJECTED', `HTTP ${status} : ${JSON.stringify(r)}`);
            assert.equal(r.retryable === true, retryable, `HTTP ${status} : retryable ${String(r.retryable)}`);
            assert.equal(server.requests.length, 1, `HTTP ${status} : une seule requête`);
        }
    });

    test('délai dépassé (MTARGET_TIMEOUT_MS) après l’envoi de la requête : UNCERTAIN, une seule requête, abandon dans le délai', async () => {
        const { result, server, elapsed } = await sendAgainst(() => { /* ne répond jamais */ }, { MTARGET_TIMEOUT_MS: '300' });
        assert.notEqual(result, HANG, 'l’adaptateur doit abandonner après MTARGET_TIMEOUT_MS (aucun délai aujourd’hui)');
        const r = result as SmsOutcomeResult;
        assert.equal(r.outcome, 'UNCERTAIN', `délai dépassé : ${JSON.stringify(r)}`);
        assert.equal(r.success, false);
        assert.ok(elapsed < 4000, `abandon en ${elapsed} ms (délai réglé à 300 ms)`);
        assert.equal(server.requests.length, 1, 'requête reçue une seule fois');
    });

    test('connexion coupée après l’envoi de la requête : UNCERTAIN', async () => {
        const { result, server } = await sendAgainst((req) => { req.socket.destroy(); });
        const r = result as SmsOutcomeResult;
        assert.equal(r.outcome, 'UNCERTAIN', `coupure après envoi : ${JSON.stringify(r)}`);
        assert.equal(r.success, false);
        assert.equal(server.requests.length, 1);
    });

    test('connexion refusée (rien n’est parti) : REJECTED à réessayer', async () => {
        const port = await closedPort();
        const r = await adapterFor(`http://127.0.0.1:${port}/messages`).sendSms(phone, message) as SmsOutcomeResult;
        assert.equal(r.outcome, 'REJECTED', `connexion refusée : ${JSON.stringify(r)}`);
        assert.equal(r.retryable, true, 'connexion refusée : relance permise');
    });
});

// ── EMAIL ──────────────────────────────────────────────────────────────────

const EMAIL_WARNED = Symbol.for('event-village.email-disabled-warned');

function header(headers: Record<string, string> | undefined, name: string): string | undefined {
    if (!headers) return undefined;
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
    return key === undefined ? undefined : headers[key];
}

describe('6.2 EMAIL facultatif (contrat F3, E4)', () => {
    test('sans RESEND_API_KEY : SKIPPED EMAIL_NOT_CONFIGURED, aucun appel, un seul avertissement pour deux passages', async () => {
        const a = await newBuyer('canaux-mail-a');
        const b = await newBuyer('canaux-mail-b');
        const rows = [
            await dueRow({ type: 'PASSWORD_CHANGED', family: 'ESSENTIAL', channel: 'EMAIL', recipient_user_id: a.userId }),
            await dueRow({ type: 'PASSWORD_CHANGED', family: 'ESSENTIAL', channel: 'EMAIL', recipient_user_id: b.userId }),
        ];
        delete (globalThis as Record<symbol, unknown>)[EMAIL_WARNED];
        const marks = [getFakes().email.messagesTo(a.email).length, getFakes().email.messagesTo(b.email).length];
        const t = new Date();
        const { warnings } = await withEnv({ RESEND_API_KEY: undefined }, () => capturingWarnings(async () => {
            await dispatchAt(t, { ids: [rows[0].id] });
            await dispatchAt(t, { ids: [rows[1].id] });
        }));
        for (const r of rows) {
            const done = await rowOf(r.id);
            assert.equal(done.status, 'SKIPPED', brief(done));
            assert.equal(done.reason, 'EMAIL_NOT_CONFIGURED');
            assert.equal(ms(done.finished_at), t.getTime(), 'finished_at = horloge de l’envoyeur');
        }
        assert.equal(getFakes().email.messagesTo(a.email).length - marks[0], 0, 'aucun email tenté');
        assert.equal(getFakes().email.messagesTo(b.email).length - marks[1], 0, 'aucun email tenté');
        const emailWarnings = warnings.filter((w) => /RESEND_API_KEY|email/i.test(w));
        assert.equal(emailWarnings.length, 1, `un seul avertissement par processus : ${JSON.stringify(emailWarnings)}`);
    });

    test('adresse factice (<chiffres>@eventvillage.sn) du compte ou du destinataire : SKIPPED NO_REAL_EMAIL, aucun appel', async () => {
        const buyer = await newBuyer('canaux-mail-factice');
        const fake = `${buyer.phoneE164.replace(/\D/g, '')}@eventvillage.sn`;
        const { error } = await service.from('users').update({ email: fake }).eq('id', buyer.userId);
        assert.equal(error, null, `email factice du compte : ${error?.message}`);
        const explicit = `221${String(Date.now()).slice(-9)}@eventvillage.sn`;
        const rows = [
            await dueRow({ type: 'PASSWORD_CHANGED', family: 'ESSENTIAL', channel: 'EMAIL', recipient_user_id: buyer.userId }),
            await dueRow({ type: 'PASSWORD_CHANGED', family: 'ESSENTIAL', channel: 'EMAIL', recipient_email: explicit }),
        ];
        const marks = [getFakes().email.messagesTo(fake).length, getFakes().email.messagesTo(explicit).length];
        await dispatchAt(new Date(), { ids: rows.map((r) => r.id) });
        for (const r of rows) {
            const done = await rowOf(r.id);
            assert.equal(done.status, 'SKIPPED', brief(done));
            assert.equal(done.reason, 'NO_REAL_EMAIL');
        }
        assert.equal(getFakes().email.messagesTo(fake).length - marks[0], 0, 'adresse factice du compte jamais destinataire');
        assert.equal(getFakes().email.messagesTo(explicit).length - marks[1], 0, 'adresse factice explicite jamais destinataire');
    });

    test('message indispensable : HTML échappé (titre <script>), version texte, bouton vers l’application, sans désabonnement, clé d’idempotence transmise', async () => {
        const buyer = await newBuyer('canaux-mail-ess');
        const hostile = '<script>alert("x")</script> & Cie';
        const row = await dueRow({
            type: 'PURCHASE_CONFIRMED', family: 'ESSENTIAL', channel: 'EMAIL', recipient_user_id: buyer.userId, group_key: `PURCHASE_CONFIRMED:${randomUUID()}`,
            template_data: { payment_id: randomUUID(), ticket_count: 2, service_fee: 100, total: 10100, ...eventData(hostile) },
        });
        const mark = getFakes().email.messagesTo(buyer.email).length;
        await dispatchAt(new Date(), { ids: [row.id] });
        const done = await rowOf(row.id);
        assert.equal(done.status, 'SENT', brief(done));
        assert.match(done.provider_message_id ?? '', /^fake-email-\d+$/, 'identifiant du fournisseur enregistré');
        const got = emailsTo(buyer.email, mark);
        assert.equal(got.length, 1, 'un email');
        const mail = got[0];
        assert.equal(norm(mail.subject), 'Achat confirmé — Event Village');
        assert.ok(!/<script/i.test(mail.html), `balise <script> injectée dans le HTML : ${mail.html.slice(0, 300)}`);
        assert.ok(mail.html.includes('&lt;script&gt;'), 'titre échappé dans le HTML');
        assert.ok(mail.html.includes('&amp; Cie'), '« & » échappé');
        assert.ok(mail.text && norm(mail.text).includes(hostile), 'version texte avec la valeur telle quelle');
        assert.ok(mail.html.includes(`href="${APP_URL}/tickets"`), `bouton vers ${APP_URL}/tickets`);
        // Lot 7, tâche 7.9 (D93) : la confirmation d'achat mène à Mes billets par « Voir mes billets ».
        assert.ok(mail.html.includes('Voir mes billets'), 'libellé du bouton (« Voir mes billets », D93)');
        assert.equal(header(mail.headers, 'List-Unsubscribe'), undefined, 'pas de List-Unsubscribe sur un message indispensable');
        assert.ok(!/Ne plus recevoir/.test(`${mail.text ?? ''} ${mail.html}`), 'pas de pied de désabonnement sur un message indispensable');
        assert.equal(mail.idempotencyKey, row.idempotency_key, 'clé d’idempotence transmise au fournisseur (en-tête Idempotency-Key chez Resend)');
    });

    test('famille optionnelle : pied « Ne plus recevoir ces emails » et en-tête List-Unsubscribe vers la page de préférences', async () => {
        const partner: TestPartner = await newPartner('canaux-mail-opt');
        const row = await dueRow({
            type: 'FIRST_TICKET_SOLD', family: 'OPTIONAL', topic: 'PRO_ACTIVITY', channel: 'EMAIL', recipient_user_id: partner.userId,
            group_key: `FIRST_TICKET_SOLD:${randomUUID()}`, template_data: eventData('Gala Dakar'),
        });
        const mark = getFakes().email.messagesTo(partner.email).length;
        await dispatchAt(new Date(), { ids: [row.id] });
        const done = await rowOf(row.id);
        assert.equal(done.status, 'SENT', brief(done));
        const got = emailsTo(partner.email, mark);
        assert.equal(got.length, 1, 'un email');
        const mail = got[0];
        const unsubscribe = `${APP_URL}/profile/notifications?topic=PRO_ACTIVITY`;
        assert.equal(norm(mail.subject), 'Premier billet vendu — Event Village');
        assert.ok(norm(mail.text ?? '').includes(`Ne plus recevoir ces emails : ${unsubscribe}`), `pied de désabonnement : ${mail.text}`);
        assert.ok(mail.html.includes(unsubscribe), 'lien de désabonnement dans le HTML');
        const listUnsubscribe = header(mail.headers, 'List-Unsubscribe');
        assert.ok(listUnsubscribe === `<${unsubscribe}>` || listUnsubscribe === unsubscribe, `List-Unsubscribe : ${String(listUnsubscribe)}`);
        assert.ok(mail.html.includes(`href="${APP_URL}/partner/events/${EVENT_ID}?tab=ventes"`), 'bouton vers les ventes de l’événement');
        assert.ok(!/token|claim/i.test(listUnsubscribe ?? ''), 'aucun jeton dans le lien de désabonnement');
        assert.equal(mail.idempotencyKey, row.idempotency_key);
    });

    test('refus du fournisseur : à réessayer → relance dans 1 min ; définitif → FAILED EMAIL_REJECTED', async () => {
        const buyer = await newBuyer('canaux-mail-refus');
        const row = await dueRow({ type: 'PASSWORD_CHANGED', family: 'ESSENTIAL', channel: 'EMAIL', recipient_user_id: buyer.userId });
        const t = new Date();
        getFakes().email.failNext('Resend 503 (simulation)', { retryable: true });
        await dispatchAt(t, { ids: [row.id] });
        const retry = await rowOf(row.id);
        assert.equal(retry.status, 'PENDING', brief(retry));
        assert.equal(retry.attempts, 1);
        assert.equal(ms(retry.next_attempt_at), t.getTime() + MIN, 'relance 1 min plus tard');

        const t2 = new Date(t.getTime() + MIN + 1000);
        getFakes().email.failNext('Adresse refusée (simulation)');
        await dispatchAt(t2, { ids: [row.id] });
        const failed = await rowOf(row.id);
        assert.equal(failed.status, 'FAILED', brief(failed));
        assert.equal(failed.reason, 'EMAIL_REJECTED');
        assert.equal(failed.attempts, 2);
        assert.equal(emailsTo(buyer.email).length, 0, 'aucun email remis');
    });
});

// ── PUSH (faux adaptateur) ─────────────────────────────────────────────────

interface SubscriptionRow {
    id: string; user_id: string; endpoint: string; p256dh: string; auth: string; vapid_key_id: string;
    last_success_at: string | null; last_failure_at: string | null; failure_count: number;
}

async function addSubscription(userId: string, keyId: string, opts: { endpoint?: string } = {}): Promise<{ row: SubscriptionRow; sub: FakeBrowserSubscription }> {
    const sub = fakeBrowserSubscription(opts.endpoint ? { endpoint: opts.endpoint } : {});
    const { data, error } = await service.from('push_subscriptions')
        .insert({ user_id: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, vapid_key_id: keyId, user_agent: 'Navigateur de test' })
        .select('*').single();
    assert.equal(error, null, `abonnement push : ${error?.message} (code ${error?.code}) — table push_subscriptions du contrat C5, migration 20261103000002`);
    return { row: data as SubscriptionRow, sub };
}

async function subscriptionsOf(userId: string): Promise<SubscriptionRow[]> {
    const { data, error } = await service.from('push_subscriptions').select('*').eq('user_id', userId);
    assert.equal(error, null, `lecture de push_subscriptions : ${error?.message}`);
    return (data ?? []) as SubscriptionRow[];
}

const SCANNED_TITLE = 'Gala Dakar';
const SCANNED_MESSAGE = { title: 'Entrée validée', body: `Votre billet pour « ${SCANNED_TITLE} » a été contrôlé à l'entrée.`, url: '/tickets?tab=historique' };

async function scannedPushRow(userId: string): Promise<OutboxRow> {
    return dueRow({
        type: 'TICKET_SCANNED', family: 'ESSENTIAL', channel: 'PUSH', recipient_user_id: userId, group_key: `TICKET_SCANNED:${randomUUID()}`,
        template_data: { ticket_id: randomUUID(), ...eventData(SCANNED_TITLE) },
    });
}

describe('6.2 PUSH : envoi par l’envoyeur, faux adaptateur (contrat F4)', () => {
    let keys: VapidKeys;
    before(() => { keys = newVapidKeys(); });

    test('sans VAPID : SKIPPED PUSH_NOT_CONFIGURED, aucun envoi, abonnement conservé, un avertissement au plus', async () => {
        const buyer = await newBuyer('canaux-push-sansvapid');
        const { sub } = await addSubscription(buyer.userId, keys.keyId);
        const rows = [await scannedPushRow(buyer.userId), await scannedPushRow(buyer.userId)];
        const { warnings } = await withEnv({ VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: undefined, VAPID_SUBJECT: undefined }, () => capturingWarnings(async () => {
            await dispatchAt(new Date(), { ids: [rows[0].id] });
            await dispatchAt(new Date(), { ids: [rows[1].id] });
        }));
        for (const r of rows) {
            const done = await rowOf(r.id);
            assert.equal(done.status, 'SKIPPED', brief(done));
            assert.equal(done.reason, 'PUSH_NOT_CONFIGURED');
        }
        assert.equal(getFakes().push.messagesTo(sub.endpoint).length, 0, 'aucun push tenté');
        assert.equal((await subscriptionsOf(buyer.userId)).length, 1, 'abonnement conservé');
        assert.ok(warnings.filter((w) => /VAPID|push/i.test(w)).length <= 1, `un seul avertissement par processus : ${JSON.stringify(warnings)}`);
    });

    test('aucun appareil : SKIPPED NO_PUSH_SUBSCRIPTION', async () => {
        const buyer = await newBuyer('canaux-push-aucun');
        const row = await scannedPushRow(buyer.userId);
        await withVapid(async () => { await dispatchAt(new Date(), { ids: [row.id] }); }, keys);
        const done = await rowOf(row.id);
        assert.equal(done.status, 'SKIPPED', brief(done));
        assert.equal(done.reason, 'NO_PUSH_SUBSCRIPTION');
    });

    test('deux appareils : deux envois, une ligne SENT, charge exacte (titre, corps, lien, tag), TTL 24 h, urgence normale', async () => {
        const buyer = await newBuyer('canaux-push-deux');
        const a = await addSubscription(buyer.userId, keys.keyId);
        const b = await addSubscription(buyer.userId, keys.keyId);
        const row = await scannedPushRow(buyer.userId);
        const t = new Date();
        await withVapid(async () => { await dispatchAt(t, { ids: [row.id] }); }, keys);
        const done = await rowOf(row.id);
        assert.equal(done.status, 'SENT', brief(done));
        assert.equal(done.attempts, 1);
        for (const { sub } of [a, b]) {
            const got = pushTo(sub.endpoint);
            assert.equal(got.length, 1, `${sub.endpoint} : un push`);
            const p = got[0];
            assert.deepEqual({ ...p.message, title: norm(p.message.title), body: norm(p.message.body) }, { ...SCANNED_MESSAGE, tag: row.group_key }, 'charge du push (G4 : titre et contenu in-app, lien, tag = group_key)');
            assert.deepEqual(p.options, { ttlSeconds: 86_400, urgency: 'normal' }, 'TTL 24 h, urgence normale');
            assert.deepEqual({ p256dh: p.p256dh, auth: p.auth }, sub.keys, 'clés de l’abonnement transmises');
        }
        const subs = await subscriptionsOf(buyer.userId);
        assert.equal(subs.length, 2);
        for (const s of subs) assert.equal(ms(s.last_success_at), t.getTime(), 'last_success_at posé');
        const devices = (done.decision as { delivery?: { devices?: Array<{ subscription_id?: string }> } } | null)?.delivery?.devices ?? [];
        assert.deepEqual(devices.map((d) => d.subscription_id).sort(), [a.row.id, b.row.id].sort(), `decision.delivery.devices : ${JSON.stringify(done.decision)}`);
    });

    test('410 sur un appareil : abonnement supprimé, l’autre servi, ligne SENT', async () => {
        const buyer = await newBuyer('canaux-push-410');
        const gone = await addSubscription(buyer.userId, keys.keyId);
        const ok = await addSubscription(buyer.userId, keys.keyId);
        getFakes().push.respondFor(gone.sub.endpoint, 410);
        const row = await scannedPushRow(buyer.userId);
        await withVapid(async () => { await dispatchAt(new Date(), { ids: [row.id] }); }, keys);
        assert.equal((await rowOf(row.id)).status, 'SENT');
        assert.equal(pushTo(ok.sub.endpoint).length, 1, 'appareil valide servi');
        assert.equal(getFakes().push.messagesTo(gone.sub.endpoint).length, 1, 'appareil expiré tenté une fois');
        assert.deepEqual((await subscriptionsOf(buyer.userId)).map((s) => s.id), [ok.row.id], 'abonnement 410 supprimé');
    });

    test('404 sur le seul appareil : abonnement supprimé puis SKIPPED NO_PUSH_SUBSCRIPTION', async () => {
        const buyer = await newBuyer('canaux-push-404');
        const only = await addSubscription(buyer.userId, keys.keyId);
        getFakes().push.respondFor(only.sub.endpoint, 404);
        const row = await scannedPushRow(buyer.userId);
        await withVapid(async () => { await dispatchAt(new Date(), { ids: [row.id] }); }, keys);
        const done = await rowOf(row.id);
        assert.equal(done.status, 'SKIPPED', brief(done));
        assert.equal(done.reason, 'NO_PUSH_SUBSCRIPTION');
        assert.equal((await subscriptionsOf(buyer.userId)).length, 0, 'abonnement 404 supprimé');
    });

    test('500, 429 puis délai dépassé : relances à 1, 5 et 15 min, abonnement conservé (failure_count), puis SENT', async () => {
        const buyer = await newBuyer('canaux-push-relance');
        const dev = await addSubscription(buyer.userId, keys.keyId);
        getFakes().push.respondFor(dev.sub.endpoint, 500, 429, 'timeout', 201);
        const row = await scannedPushRow(buyer.userId);
        const t0 = new Date();
        await withVapid(async () => {
            await dispatchAt(t0, { ids: [row.id] });
            let r = await rowOf(row.id);
            assert.equal(r.status, 'PENDING', `500 : ${brief(r)}`);
            assert.equal(r.attempts, 1);
            assert.equal(ms(r.next_attempt_at), t0.getTime() + MIN, '500 : relance à 1 min');

            const t1 = new Date(t0.getTime() + MIN + 1000);
            await dispatchAt(t1, { ids: [row.id] });
            r = await rowOf(row.id);
            assert.equal(r.status, 'PENDING', `429 : ${brief(r)}`);
            assert.equal(r.attempts, 2);
            assert.equal(ms(r.next_attempt_at), t1.getTime() + 5 * MIN, '429 : relance à 5 min');

            const t2 = new Date(t1.getTime() + 5 * MIN + 1000);
            await dispatchAt(t2, { ids: [row.id] });
            r = await rowOf(row.id);
            assert.equal(r.status, 'PENDING', `délai : ${brief(r)}`);
            assert.equal(r.attempts, 3);
            assert.equal(ms(r.next_attempt_at), t2.getTime() + 15 * MIN, 'délai : relance à 15 min');
            const [s] = await subscriptionsOf(buyer.userId);
            assert.ok(s, 'abonnement conservé après 3 échecs temporaires');
            assert.equal(s.failure_count, 3, 'failure_count compté par appareil');
            assert.ok(s.last_failure_at, 'last_failure_at posé');

            const t3 = new Date(t2.getTime() + 15 * MIN + 1000);
            await dispatchAt(t3, { ids: [row.id] });
            r = await rowOf(row.id);
            assert.equal(r.status, 'SENT', `201 : ${brief(r)}`);
            assert.equal(r.attempts, 4);
        }, keys);
        assert.equal(getFakes().push.messagesTo(dev.sub.endpoint).length, 4, 'quatre tentatives vers l’appareil');
        assert.equal(pushTo(dev.sub.endpoint).length, 1, 'un seul push accepté');
    });

    test('413 → FAILED PUSH_PAYLOAD_TOO_LARGE ; 401 → FAILED PUSH_REJECTED ; abonnement conservé, aucune relance', async () => {
        for (const [status, reason] of [[413, 'PUSH_PAYLOAD_TOO_LARGE'], [401, 'PUSH_REJECTED']] as const) {
            const buyer = await newBuyer(`canaux-push-${status}`);
            const dev = await addSubscription(buyer.userId, keys.keyId);
            getFakes().push.respondFor(dev.sub.endpoint, status);
            const row = await scannedPushRow(buyer.userId);
            const t = new Date();
            await withVapid(async () => {
                await dispatchAt(t, { ids: [row.id] });
                await dispatchAt(addMinutes(t, 2), { ids: [row.id] });
            }, keys);
            const done = await rowOf(row.id);
            assert.equal(done.status, 'FAILED', `${status} : ${brief(done)}`);
            assert.equal(done.reason, reason, `${status} : motif`);
            assert.equal(done.attempts, 1, `${status} : aucune relance`);
            assert.equal(getFakes().push.messagesTo(dev.sub.endpoint).length, 1, `${status} : une seule tentative`);
            assert.equal((await subscriptionsOf(buyer.userId)).length, 1, `${status} : abonnement conservé`);
        }
    });

    test('clé VAPID changée : l’abonnement de l’ancienne clé est ignoré et supprimé, celui de la clé courante est servi', async () => {
        const buyer = await newBuyer('canaux-push-rotation');
        const old = newVapidKeys();
        const stale = await addSubscription(buyer.userId, old.keyId);
        const fresh = await addSubscription(buyer.userId, keys.keyId);
        const row = await scannedPushRow(buyer.userId);
        await withVapid(async () => { await dispatchAt(new Date(), { ids: [row.id] }); }, keys);
        assert.equal((await rowOf(row.id)).status, 'SENT');
        assert.equal(getFakes().push.messagesTo(stale.sub.endpoint).length, 0, 'ancienne clé : aucun envoi');
        assert.equal(pushTo(fresh.sub.endpoint).length, 1, 'clé courante : servi');
        assert.deepEqual((await subscriptionsOf(buyer.userId)).map((s) => s.id), [fresh.row.id], 'abonnement de l’ancienne clé supprimé');
    });

    test('point d’arrivée hors liste blanche (inscrit sans passer par la route) : jamais appelé à l’envoi', async () => {
        const buyer = await newBuyer('canaux-push-ssrf');
        const evil = await addSubscription(buyer.userId, keys.keyId, { endpoint: `https://push.evil.example/send/${randomUUID()}` });
        const good = await addSubscription(buyer.userId, keys.keyId);
        const row = await scannedPushRow(buyer.userId);
        await withVapid(async () => { await dispatchAt(new Date(), { ids: [row.id] }); }, keys);
        assert.equal(getFakes().push.messagesTo(evil.sub.endpoint).length, 0, 'hôte hors liste blanche : aucun envoi');
        assert.equal(pushTo(good.sub.endpoint).length, 1, 'appareil autorisé servi');
        assert.equal((await rowOf(row.id)).status, 'SENT');
    });

    test('annulation d’un événement : urgence haute, TTL 24 h, titre « Événement annulé », lien Mes billets', async () => {
        const buyer = await newBuyer('canaux-push-annul');
        const dev = await addSubscription(buyer.userId, keys.keyId);
        const row = await dueRow({
            type: 'EVENT_CANCELLED', family: 'ESSENTIAL', channel: 'PUSH', recipient_user_id: buyer.userId, group_key: `EVENT_CANCELLED:${randomUUID()}:${buyer.userId}`,
            template_data: { ...eventData('Gala Dakar'), public_notice: 'Intempéries annoncées.', refund_mode: 'AUTO' },
        });
        await withVapid(async () => { await dispatchAt(new Date(), { ids: [row.id] }); }, keys);
        const got = pushTo(dev.sub.endpoint);
        assert.equal(got.length, 1);
        assert.equal(norm(got[0].message.title), 'Événement annulé');
        assert.equal(got[0].message.url, '/tickets');
        assert.equal(got[0].message.tag, row.group_key);
        assert.deepEqual(got[0].options, { ttlSeconds: 86_400, urgency: 'high' });
        assert.ok(got[0].message.body.length <= 160, 'corps ≤ 160 caractères');
    });
});

// ── PUSH : adaptateur réel contre un service push local qui déchiffre ──────

interface PushAdapterLike {
    send(target: { endpoint: string; p256dh: string; auth: string }, message: { title: string; body: string; url: string; tag: string },
        options: { ttlSeconds: number; urgency: 'normal' | 'high' }): Promise<{ outcome: string; statusCode: number | null; retryAfterSeconds?: number }>;
}

async function realPushAdapter(): Promise<PushAdapterLike> {
    const mod = await loadLotModule('../../lib/push/web-push.adapter', 'adaptateur push réel (contrat F4)');
    const Ctor = mod.WebPushAdapter as (new () => PushAdapterLike) | undefined;
    assert.equal(typeof Ctor, 'function', 'lib/push/web-push.adapter.ts : classe WebPushAdapter non exportée (contrat F4)');
    return new Ctor!();
}

/** Déchiffrement aes128gcm d'un message push (RFC 8188, RFC 8291), indépendant de web-push. */
function decryptAes128gcm(body: Buffer, ua: FakeBrowserSubscription): string {
    assert.ok(body.length > 21 + 65 + 16, `corps push trop court (${body.length} octets)`);
    const salt = body.subarray(0, 16);
    const idlen = body[20];
    assert.equal(idlen, 65, 'keyid = clé publique éphémère P-256 (65 octets)');
    const asPublic = body.subarray(21, 21 + idlen);
    const ciphertext = body.subarray(21 + idlen);
    const shared = ua.ecdh.computeSecret(asPublic);
    const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'latin1'), ua.ecdh.getPublicKey(), asPublic]);
    const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, ua.authSecret, keyInfo, 32));
    const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'latin1'), 16));
    const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'latin1'), 12));
    const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
    decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
    const padded = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
    let end = padded.length - 1;
    while (end >= 0 && padded[end] === 0) end -= 1;
    assert.equal(padded[end], 2, 'délimiteur du dernier enregistrement (0x02)');
    return padded.subarray(0, end).toString('utf8');
}

/** Vérifie l'en-tête VAPID (RFC 8292) : `vapid t=<JWT ES256>, k=<clé publique>`. */
function verifyVapid(authorization: string | undefined, keys: VapidKeys, audience: string): void {
    const m = /^vapid t=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+),\s*k=([A-Za-z0-9_-]+)$/.exec(authorization ?? '');
    assert.ok(m, `en-tête Authorization VAPID attendu : ${String(authorization)}`);
    const [, jwt, k] = m;
    assert.equal(k, keys.publicKey, 'k = VAPID_PUBLIC_KEY');
    const [h, p, s] = jwt.split('.');
    const head = JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) as { alg?: string };
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as { aud?: string; sub?: string; exp?: number };
    assert.equal(head.alg, 'ES256');
    assert.equal(claims.aud, audience, 'aud = origine du service push');
    assert.equal(claims.sub, keys.subject, 'sub = VAPID_SUBJECT');
    const now = Math.floor(Date.now() / 1000);
    assert.ok(typeof claims.exp === 'number' && claims.exp > now && claims.exp <= now + 24 * 3600 + 60, `exp dans les 24 h : ${claims.exp}`);
    const raw = Buffer.from(keys.publicKey, 'base64url');
    const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33, 65).toString('base64url') }, format: 'jwk' });
    const ok = crypto.verify('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
    assert.ok(ok, 'signature ES256 du JWT VAPID valide');
}

describe('6.2 PUSH : adaptateur réel (web-push pour le chiffrement, transport par fetch) contre un service local (contrat F4)', () => {
    const message = { title: 'Rappel : c\'est demain', body: '« Gala Dakar » demain à 20:00, CICAD.', url: '/tickets', tag: `REMINDER_J1:${randomUUID()}` };

    async function withPushServer<T>(responder: Responder, fn: (server: LocalServer, keys: VapidKeys, sub: FakeBrowserSubscription) => Promise<T>, extraEnv: Record<string, string> = {}): Promise<T> {
        const server = await startLocalServer(responder);
        try {
            const keys = newVapidKeys();
            const sub = fakeBrowserSubscription({ origin: server.origin });
            return await withVapid(() => withEnv({ PUSH_ENDPOINT_ALLOWED_ORIGINS: server.origin, ...extraEnv }, () => fn(server, keys, sub)), keys);
        } finally {
            await server.close();
        }
    }

    test('201 : charge chiffrée aes128gcm déchiffrée à l’identique, en-tête VAPID valide, TTL et Urgency transmis', async () => {
        await withPushServer((_req, _body, res) => { res.writeHead(201); res.end(); }, async (server, keys, sub) => {
            const adapter = await realPushAdapter();
            const result = await within(adapter.send({ endpoint: sub.endpoint, ...sub.keys }, message, { ttlSeconds: 600, urgency: 'high' }), 5000);
            assert.notEqual(result, HANG);
            assert.deepEqual(result, { outcome: 'ACCEPTED', statusCode: 201 });
            assert.equal(server.requests.length, 1, 'une requête');
            const req = server.requests[0];
            assert.equal(req.method, 'POST');
            assert.equal(req.url, new URL(sub.endpoint).pathname);
            assert.equal(req.headers['content-encoding'], 'aes128gcm');
            assert.equal(req.headers.ttl, '600');
            assert.equal(req.headers.urgency, 'high');
            verifyVapid(req.headers.authorization, keys, server.origin);
            assert.deepEqual(JSON.parse(decryptAes128gcm(req.body, sub)), message, 'charge déchiffrée = message envoyé');
        });
    });

    test('statuts du service push : 202 ACCEPTED, 404/410 GONE, 413 TOO_LARGE, 429 (Retry-After) et 5xx RETRY, 400/401/403 REJECTED', async () => {
        const cases: Array<[number, string, Record<string, string>, number | undefined]> = [
            [202, 'ACCEPTED', {}, undefined], [404, 'GONE', {}, undefined], [410, 'GONE', {}, undefined], [413, 'TOO_LARGE', {}, undefined],
            [429, 'RETRY', { 'retry-after': '120' }, 120], [500, 'RETRY', {}, undefined], [503, 'RETRY', {}, undefined],
            [400, 'REJECTED', {}, undefined], [401, 'REJECTED', {}, undefined], [403, 'REJECTED', {}, undefined],
        ];
        for (const [status, outcome, headers, retryAfter] of cases) {
            await withPushServer((_req, _body, res) => { res.writeHead(status, headers); res.end(); }, async (server, _keys, sub) => {
                const adapter = await realPushAdapter();
                const r = await within(adapter.send({ endpoint: sub.endpoint, ...sub.keys }, message, { ttlSeconds: 86_400, urgency: 'normal' }), 5000);
                assert.notEqual(r, HANG, `HTTP ${status} : réponse attendue`);
                const res = r as Awaited<ReturnType<PushAdapterLike['send']>>;
                assert.equal(res.outcome, outcome, `HTTP ${status} : ${JSON.stringify(res)}`);
                assert.equal(res.statusCode, status, `HTTP ${status} : statusCode`);
                if (retryAfter !== undefined) assert.equal(res.retryAfterSeconds, retryAfter, 'Retry-After lu en secondes');
                assert.equal(server.requests.length, 1, `HTTP ${status} : une seule requête`);
            });
        }
    });

    test('délai dépassé (PUSH_TIMEOUT_MS) : RETRY sans code HTTP, abandon dans le délai', async () => {
        await withPushServer(() => { /* ne répond jamais */ }, async (server, _keys, sub) => {
            const adapter = await realPushAdapter();
            const started = Date.now();
            const r = await within(adapter.send({ endpoint: sub.endpoint, ...sub.keys }, message, { ttlSeconds: 86_400, urgency: 'normal' }), 5000);
            assert.notEqual(r, HANG, 'l’adaptateur doit abandonner après PUSH_TIMEOUT_MS');
            const res = r as Awaited<ReturnType<PushAdapterLike['send']>>;
            assert.deepEqual({ outcome: res.outcome, statusCode: res.statusCode }, { outcome: 'RETRY', statusCode: null });
            assert.ok(Date.now() - started < 4000, 'abandon rapide');
            assert.equal(server.requests.length, 1);
        }, { PUSH_TIMEOUT_MS: '300' });
    });

    test('contrôles statiques : web-push 3.6.7 et @types/web-push 3.6.4 épinglés, generateRequestDetails seul, jamais sendNotification(', async () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
        assert.equal(pkg.dependencies?.['web-push'], '3.6.7', 'web-push épinglé à 3.6.7 (sans ^ ni ~)');
        assert.equal(pkg.devDependencies?.['@types/web-push'], '3.6.4', '@types/web-push épinglé à 3.6.4 en devDependency');
        const adapterFile = path.join(ROOT, 'lib', 'push', 'web-push.adapter.ts');
        assert.ok(fs.existsSync(adapterFile), 'lib/push/web-push.adapter.ts absent');
        const src = fs.readFileSync(adapterFile, 'utf8');
        assert.match(src, /generateRequestDetails\s*\(/, 'chiffrement par webpush.generateRequestDetails');
        assert.match(src, /\bfetch\s*\(/, 'transport par fetch');
        assert.match(src, /AbortSignal\.timeout\s*\(/, 'délai du transport (AbortSignal.timeout)');
        const offenders: string[] = [];
        const walk = (dir: string): void => {
            if (!fs.existsSync(dir)) return;
            for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, ent.name);
                if (ent.isDirectory()) { if (ent.name !== 'node_modules' && !ent.name.startsWith('.')) walk(full); continue; }
                if (!/\.(ts|tsx|js|mjs|cjs)$/.test(ent.name)) continue;
                const text = fs.readFileSync(full, 'utf8');
                // Visé : le transport de la bibliothèque web-push (webpush.sendNotification ou import nommé), pas
                // MTargetService.sendNotification, exigé par notif-migration et fondations-lot0 (contradiction relevée
                // après le run rouge 60, motif resserré sans changer l'intention).
                const webPushTransport = /\bweb-?push\s*\.\s*sendNotification\s*\(/i.test(text)
                    || /import\s*\{[^}]*\bsendNotification\b[^}]*\}\s*from\s*['"]web-push['"]/.test(text)
                    || /require\(\s*['"]web-push['"]\s*\)\s*\.\s*sendNotification\b/.test(text);
                if (webPushTransport) offenders.push(path.relative(ROOT, full));
            }
        };
        for (const d of ['app', 'lib', 'components', 'hooks', 'scripts', 'public']) walk(path.join(ROOT, d));
        assert.deepEqual(offenders, [], 'le sendNotification de web-push n’apparaît nulle part (transport par notre fetch)');
    });

    test('VAPID_PRIVATE_KEY parmi les secrets : réutilisée comme secret dédié, la configuration est refusée', async () => {
        const keys = newVapidKeys();
        await withEnv({ VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: keys.subject }, async () => {
            assert.doesNotThrow(() => getServerEnv(), 'témoin : clés VAPID distinctes des secrets dédiés acceptées');
        });
        await withEnv({ VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: keys.subject, OTP_HASH_SECRET: keys.privateKey }, async () => {
            let caught: unknown = null;
            try {
                getServerEnv();
            } catch (err) {
                caught = err;
            }
            assert.ok(caught instanceof Error, 'getServerEnv doit refuser un secret dédié égal à VAPID_PRIVATE_KEY');
            assert.match(caught.message, /OTP_HASH_SECRET[^\n]*VAPID_PRIVATE_KEY/, `motif du refus : ${caught.message}`);
        });
    });
});

// Garde-fou de l'outil local : la table GSM-7 de base compte 127 caractères distincts.
assert.equal(GSM7_BASIC.size, 127, 'table GSM-7 de base');
