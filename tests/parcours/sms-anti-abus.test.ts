/**
 * Lot 1C.9 — anti-abus SMS (chaque SMS est facturé au client).
 * Compteurs en base, réservation atomique, refus en fail-closed si la garde ne répond pas.
 * Ce processus règle de petites limites (variables d'environnement, propres à la suite) :
 *  - rafale de demandes d'OTP sur un même numéro → bloquée après la limite (même en parallèle) ;
 *  - même IP, numéros différents → bloquée après la limite par IP ;
 *  - plafond global quotidien atteint → refus propre, alerte journalisée et notification in-app
 *    aux superadmins, aucun SMS ;
 *  - garde indisponible (EXECUTE retiré au service_role) → 503, aucun SMS ;
 *  - inscription d'un numéro déjà inscrit → 409 sans SMS ;
 *  - hook SMS de Supabase Auth : un fragment du secret ne suffit plus ; une signature Standard
 *    Webhooks valide relaie le SMS, une signature à l'horodatage périmé (rejeu) est refusée.
 * Lot 7 (7.0 d et D1, T9) :
 *  - plafond global : la suite ne dépend plus des lignes écrites par d'autres suites le même jour UTC
 *    (acces-limiteurs, notif-admins) : le compteur d'alerte sms_alert/global_cap du jour est remis à zéro en
 *    base locale, la fenêtre de lecture commence au début du test (et non 10 min avant), et le destinataire
 *    vérifié est un admin notifications.read créé par le test (sa clé ADMIN_SMS_CAP_GLOBAL:<jour>:<admin> ne
 *    peut pas préexister) ;
 *  - inscription « numéro d'abord » : un numéro déjà inscrit est refusé dès le démarrage
 *    (POST /api/auth/register/start, 409 PHONE_ALREADY_REGISTERED), sans SMS ; rouge jusqu'à fix(7.3s).
 */
import '../helpers/env';
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { NextRequest } from 'next/server';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { resetServerEnvCache } from '../../lib/env';
import { loadFixtures } from '../helpers/fixtures';
import { POST as sendOtp } from '../../app/api/auth/send-otp/route';
import { POST as smsHook } from '../../app/api/auth/sms-hook/route';
import { getFakes } from '../fakes';
import { BASE_URL, jsonRequest, randomSenegalPhone } from './helpers';
import { flushNotifications, newAdmin, outboxRows } from './notif-helpers';
import { registerClientFlow } from './terrain-helpers';
import { newBuyer } from './paiement-helpers';

const LIMITS = {
    SMS_OTP_PER_PHONE_15MIN: '2',
    SMS_OTP_PER_PHONE_DAY: '20',
    SMS_OTP_PER_IP_HOUR: '3',
    SMS_OTP_PER_IP_DAY: '50',
};

let ipSeq = 0;
function freshIp(): string {
    ipSeq += 1;
    return `198.51.100.${(ipSeq % 250) + 1}`;
}

function otpRequest(phone: string, ip: string) {
    return jsonRequest('/api/auth/send-otp', { phone }, { 'x-forwarded-for': `${ip}, 10.0.0.1` });
}

/** Appel du hook signé comme Supabase Auth (Standard Webhooks : HMAC-SHA256 de « id.horodatage.corps »). */
function signedHookRequest(body: unknown, timestamp = Math.floor(Date.now() / 1000)): NextRequest {
    const raw = JSON.stringify(body);
    const secret = String(process.env.SUPABASE_AUTH_HOOK_SECRET);
    const key = Buffer.from(secret.replace(/^v1,/, '').replace(/^whsec_/, ''), 'base64');
    const id = `msg_${crypto.randomUUID()}`;
    const signature = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${raw}`).digest('base64');
    return new NextRequest(`${BASE_URL}/api/auth/sms-hook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(timestamp), 'webhook-signature': `v1,${signature}` },
        body: raw,
    });
}

async function globalCountToday(): Promise<number> {
    const day = new Date().toISOString().slice(0, 10);
    const { data, error } = await getServiceRoleClient()
        .from('quota_counters')
        .select('hits, window_start')
        .eq('scope', 'sms_global')
        .eq('bucket', 'all')
        .gte('window_start', `${day}T00:00:00Z`);
    assert.equal(error, null, `lecture du compteur global : ${error?.message}`);
    return (data || []).reduce((s, r) => s + Number(r.hits), 0);
}

before(() => {
    Object.assign(process.env, LIMITS);
    resetServerEnvCache();
});

describe('Anti-abus SMS', () => {
    test('rafale parallèle sur un même numéro : seuls les envois sous la limite partent', async () => {
        const phone = randomSenegalPhone('76');
        const results = await Promise.all(Array.from({ length: 6 }, () => sendOtp(otpRequest(phone, freshIp()))));
        const statuses = results.map((r) => r.status).sort();
        const ok = statuses.filter((s) => s === 200).length;
        assert.equal(ok, 2, `envois acceptés : ${ok} (statuts ${statuses.join(',')})`);
        assert.ok(statuses.filter((s) => s === 429).length === 4, `refus 429 attendus : ${statuses.join(',')}`);
        assert.equal(getFakes().sms.messagesTo(phone).length, 2, 'exactement 2 SMS envoyés à ce numéro');
        const refused = await Promise.all(results.filter((r) => r.status === 429).map((r) => r.json()));
        assert.ok(refused.every((b) => b.code === 'SMS_RATE_LIMITED'), `code de refus : ${JSON.stringify(refused[0])}`);
    });

    test('même IP, numéros différents : bloquée après la limite par IP', async () => {
        const ip = freshIp();
        const statuses: number[] = [];
        for (let i = 0; i < 5; i += 1) statuses.push((await sendOtp(otpRequest(randomSenegalPhone('77'), ip))).status);
        assert.deepEqual(statuses, [200, 200, 200, 429, 429], `statuts par envoi depuis ${ip}`);
    });

    test('plafond global quotidien atteint : refus propre, alerte journalisée, aucun SMS', async () => {
        // Lot 7 (T9) : suite autonome. Début du test (marge d'une seconde pour l'horloge de la base, même machine),
        // admin neuf destinataire de l'alerte, compteur d'alerte du jour remis à zéro en base locale.
        const startedAt = new Date(Date.now() - 1000).toISOString();
        const recipient = await newAdmin('anti-abus-plafond', ['notifications.read']);
        const dayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
        const { error: resetErr } = await getServiceRoleClient().from('quota_counters').delete()
            .eq('scope', 'sms_alert').eq('bucket', 'global_cap').gte('window_start', dayStart);
        assert.equal(resetErr, null, `remise à zéro du compteur d'alerte du jour : ${resetErr?.message}`);
        const used = await globalCountToday();
        process.env.SMS_GLOBAL_DAILY_CAP = String(used + 1);
        resetServerEnvCache();
        try {
            // Lot 9 quater (A8 : AUD-05) : codes vers des numéros qui ont un compte (seuls à tirer sur le plafond global ;
            // modification signalée au rapport)
            const first = (await newBuyer('plafond-premier')).phoneE164;
            const second = (await newBuyer('plafond-second')).phoneE164;
            assert.equal((await sendOtp(otpRequest(first, freshIp()))).status, 200, 'dernier SMS sous le plafond');
            const res = await sendOtp(otpRequest(second, freshIp()));
            const body = await res.json();
            assert.equal(res.status, 429, `plafond : HTTP ${res.status} ${JSON.stringify(body)}`);
            assert.equal(body.code, 'SMS_DAILY_CAP_REACHED');
            assert.equal(getFakes().sms.messagesTo(second).length, 0, 'aucun SMS au-delà du plafond');

            const service = getServiceRoleClient();
            const since = startedAt;
            const { data: audit, error: auditErr } = await service.from('audit_logs').select('id').eq('action', 'SMS_GLOBAL_DAILY_CAP_REACHED').gte('created_at', since);
            assert.equal(auditErr, null, `audit_logs : ${auditErr?.message}`);
            assert.ok((audit || []).length >= 1, 'alerte « plafond SMS atteint » journalisée dans audit_logs pendant le test');
            // Lot 6 (6.1, J2.13) : l'alerte est mise en file par notification_admin_alert (ADMIN_SMS_CAP_GLOBAL,
            // clé du jour UTC). Lot 7 (T9) : la ligne de l'admin neuf est exigée, puis livrée par l'envoyeur.
            const capDay = new Date().toISOString().slice(0, 10);
            const queued = await outboxRows({ userId: recipient.userId, keyPrefix: `ADMIN_SMS_CAP_GLOBAL:${capDay}:` });
            assert.deepEqual(queued.map((r) => r.idempotency_key).sort(), [`ADMIN_SMS_CAP_GLOBAL:${capDay}:${recipient.userId}:EMAIL`, `ADMIN_SMS_CAP_GLOBAL:${capDay}:${recipient.userId}:IN_APP`],
                'alerte du plafond mise en file pour l’admin notifications.read créé par le test (in-app et email, G.49 ; jamais de SMS)');
            await flushNotifications({ ids: queued.map((r) => r.id) });
            const { data: notif, error: notifErr } = await service.from('notifications').select('id, channel').eq('user_id', recipient.userId).eq('type', 'SMS_DAILY_CAP_REACHED').gte('created_at', since);
            assert.equal(notifErr, null, `notifications : ${notifErr?.message}`);
            assert.equal((notif || []).length, 1, 'une notification in-app à l’admin notifications.read');
            assert.ok((notif || []).every((n) => n.channel !== 'SMS'), 'l’alerte ne part jamais par SMS');
        } finally {
            delete process.env.SMS_GLOBAL_DAILY_CAP;
            resetServerEnvCache();
        }
    });

    test('garde indisponible : refus 503 en fail-closed, aucun SMS', async () => {
        const db = new Client({ connectionString: process.env.SUPABASE_DB_URL });
        await db.connect();
        const phone = randomSenegalPhone('76');
        try {
            await db.query('REVOKE EXECUTE ON FUNCTION public.quota_reserve(jsonb) FROM service_role');
            const res = await sendOtp(otpRequest(phone, freshIp()));
            const body = await res.json();
            assert.equal(res.status, 503, `HTTP ${res.status} ${JSON.stringify(body)}`);
            assert.equal(body.code, 'SMS_GUARD_UNAVAILABLE');
            assert.equal(getFakes().sms.messagesTo(phone).length, 0, 'aucun SMS sans garde');
        } finally {
            // La connexion est fermée même si la restauration échoue (sinon le processus de test ne se termine pas).
            try {
                await db.query('GRANT EXECUTE ON FUNCTION public.quota_reserve(jsonb) TO service_role').catch((e: Error) => {
                    throw new Error(`restauration du droit EXECUTE impossible : ${e.message}`);
                });
            } finally {
                await db.end();
            }
        }
    });

    test('inscription d’un numéro déjà inscrit : 409, aucun SMS', async () => {
        const fx = await loadFixtures();
        const phone = fx.users.CLIENT_BIS.phone;
        const before = getFakes().sms.messagesTo(phone).length;
        // Lot 7 (D1, T9) : inscription « numéro d'abord » ; le refus tombe au démarrage, avant tout code.
        const flow = await registerClientFlow({ phone, headers: { 'x-forwarded-for': freshIp() } }, { expectOk: false });
        assert.equal(flow.start.status, 409, `HTTP ${flow.start.status} ${JSON.stringify(flow.start.body)}`);
        assert.equal(flow.start.body.code, 'PHONE_ALREADY_REGISTERED', `code du refus : ${JSON.stringify(flow.start.body)}`);
        assert.equal(flow.register, null, 'aucune inscription tentée après le refus');
        assert.equal(getFakes().sms.messagesTo(phone).length, before, 'aucun SMS envoyé à un numéro déjà inscrit');
    });

    test('hook SMS de Supabase Auth : un fragment du secret est refusé, aucun SMS', async () => {
        const phone = randomSenegalPhone('77');
        const secret = String(process.env.SUPABASE_AUTH_HOOK_SECRET);
        const res = await smsHook(jsonRequest('/api/auth/sms-hook', { user: { phone }, sms: { otp: '123456' } }, { authorization: `Bearer ${secret.slice(0, 2)}` }));
        assert.equal(res.status, 401, `fragment du secret : HTTP ${res.status}`);
        assert.equal(getFakes().sms.messagesTo(phone).length, 0, 'aucun SMS relayé');
    });

    test('hook SMS de Supabase Auth : signature Standard Webhooks valide → SMS relayé', async () => {
        const phone = randomSenegalPhone('77');
        const res = await smsHook(signedHookRequest({ user: { phone }, sms: { otp: '482913' } }));
        assert.equal(res.status, 200, `signature valide : HTTP ${res.status} ${JSON.stringify(await res.json())}`);
        const sent = getFakes().sms.messagesTo(phone);
        assert.equal(sent.length, 1, 'un SMS relayé');
        assert.ok(sent[0].message.includes('482913'), 'le code reçu de Supabase Auth est transmis');
    });

    test('hook SMS de Supabase Auth : signature valide mais horodatage périmé (rejeu) → 401, aucun SMS', async () => {
        const phone = randomSenegalPhone('77');
        const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
        const res = await smsHook(signedHookRequest({ user: { phone }, sms: { otp: '482913' } }, tenMinutesAgo));
        assert.equal(res.status, 401, `horodatage périmé : HTTP ${res.status}`);
        assert.equal(getFakes().sms.messagesTo(phone).length, 0, 'aucun SMS relayé');
    });

    test('point d’envoi unique : aucun accès direct à l’adaptateur SMS hors lib/sms et lib/integrations', () => {
        const offenders: string[] = [];
        const walk = (p: string) => {
            for (const e of fs.readdirSync(p, { withFileTypes: true })) {
                const full = path.join(p, e.name);
                if (e.isDirectory()) walk(full);
                else if (/\.(ts|tsx)$/.test(e.name)) {
                    const rel = full.replace(/\\/g, '/');
                    if (rel.startsWith('lib/sms/') || rel.startsWith('lib/integrations/')) continue;
                    const src = fs.readFileSync(full, 'utf8');
                    if (/getSmsAdapter|MTargetHttpAdapter|mtarget\.fr/.test(src)) offenders.push(rel);
                }
            }
        };
        for (const d of ['app', 'lib', 'components', 'hooks']) if (fs.existsSync(d)) walk(d);
        assert.deepEqual(offenders, [], `accès direct à l’adaptateur SMS :\n${offenders.join('\n')}`);
    });
});
